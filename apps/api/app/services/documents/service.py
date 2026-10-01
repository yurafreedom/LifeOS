"""Encrypted documents: create, list, read, edit, version, download, delete.

Every function takes the **server-derived** owner id; nothing here trusts an
id from the client without filtering by that owner, and another account's
document is indistinguishable from a missing one (``document_not_found``).

Concurrency and retries:
* uploads carry a client-minted ``Idempotency-Key``; a retry with the same key
  and the same bytes returns the original record (``created = False``), the
  same key with different bytes is ``idempotency_conflict``;
* metadata edits, new versions and deletion require the document revision the
  client last saw (compare-and-swap); a stale revision is ``revision_conflict``
  and nothing is overwritten. Versions are immutable and append-only;
* per-account uploads serialise on the account row (``FOR UPDATE``), so count
  and storage quotas are exact under concurrency.

Plaintext exists only in process memory while a request is served; it is never
written to disk, the database, logs or exceptions.
"""

from __future__ import annotations

import hashlib
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.crypto import DecryptionFailed, Keyring, KeyUnavailable, UnsupportedEnvelope
from app.models import Document, DocumentVersion, User
from app.services.documents.envelopes import (
    ENVELOPE_VERSION,
    open_content,
    open_document_meta,
    open_version_meta,
    seal_document_meta,
    seal_version,
    version_data_key,
)
from app.services.documents.store import BlobStore, PostgresBlobStore, StoredCiphertext
from app.services.documents.validation import EXTENSIONS, ValidationRefused, validate_content

logger = logging.getLogger(__name__)

TITLE_MAX = 200
NOTES_MAX = 4000
FILENAME_MAX = 255
IDEMPOTENCY_KEY = re.compile(r"^[A-Za-z0-9_-]{16,128}$")


class DocumentError(Exception):
    """A refusal with a stable code. Never carries document content or names."""

    def __init__(self, status: int, code: str, message: str, **extra: object) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.extra = extra


def not_found() -> DocumentError:
    return DocumentError(404, "document_not_found", "Document not found.")


def _revision_conflict(current: int) -> DocumentError:
    return DocumentError(
        409,
        "revision_conflict",
        "The document changed since it was loaded.",
        current_revision=current,
    )


@dataclass
class DocumentRuntime:
    settings: Settings
    keyring: Keyring | None
    store: BlobStore = field(default_factory=PostgresBlobStore)

    def require_keyring(self) -> Keyring:
        if not self.settings.documents_enabled or self.keyring is None:
            raise DocumentError(
                503, "documents_unavailable", "Document storage is not enabled on this server."
            )
        return self.keyring


# ───────────────────────────── text hygiene ─────────────────────────────


def _strip_controls(value: str, *, keep_newlines: bool) -> str:
    allowed = {"\n", "\t"} if keep_newlines else set()
    return "".join(
        ch for ch in value if ch in allowed or unicodedata.category(ch)[0] != "C"
    )


def clean_filename(raw: str | None) -> str:
    name = unicodedata.normalize("NFC", raw or "")
    name = name.replace("\\", "/").rsplit("/", 1)[-1]
    name = _strip_controls(name, keep_newlines=False).strip().lstrip(".").strip()
    return name[:FILENAME_MAX] or "document"


def clean_title(raw: str | None, *, fallback: str) -> str:
    title = _strip_controls(unicodedata.normalize("NFC", raw or ""), keep_newlines=False).strip()
    if not title:
        stem = fallback.rsplit(".", 1)[0] if "." in fallback[1:] else fallback
        title = stem.strip() or "document"
    if len(title) > TITLE_MAX:
        raise DocumentError(422, "invalid_document_metadata", "The title is too long.")
    return title


def clean_notes(raw: str | None) -> str:
    notes = _strip_controls(unicodedata.normalize("NFC", raw or ""), keep_newlines=True).strip()
    if len(notes) > NOTES_MAX:
        raise DocumentError(422, "invalid_document_metadata", "The notes are too long.")
    return notes


def download_filename(filename: str, content_type: str) -> str:
    """The stored name with the extension of the *verified* type."""
    extension = EXTENSIONS[content_type]
    stem = filename
    dot = filename.rfind(".")
    if dot > 0:
        stem = filename[:dot]
    return (stem.strip() or "document")[: FILENAME_MAX - len(extension)] + extension


def check_idempotency_key(value: str | None) -> str:
    if value is None or not IDEMPOTENCY_KEY.fullmatch(value):
        raise DocumentError(
            422,
            "invalid_idempotency_key",
            "Idempotency-Key must be 16–128 characters of A–Z, a–z, 0–9, '_' or '-'.",
        )
    return value


# ───────────────────────────── views ─────────────────────────────


@dataclass
class VersionView:
    id: UUID
    number: int
    content_type: str
    size_bytes: int
    created_at: datetime
    filename: str | None
    state: str  # ok | key_unavailable | integrity_failed


@dataclass
class DocumentView:
    id: UUID
    revision: int
    title: str | None
    notes: str | None
    state: str
    created_at: datetime
    updated_at: datetime
    current_version: VersionView | None
    version_count: int
    total_bytes: int
    versions: list[VersionView] | None = None


def _state_for(error: Exception) -> str:
    return "key_unavailable" if isinstance(error, KeyUnavailable) else "integrity_failed"


def _log_unreadable(kind: str, row_id: UUID, error: Exception) -> None:
    if isinstance(error, KeyUnavailable):
        logger.error(
            "document.key_unavailable",
            extra={"record": kind, "record_id": str(row_id), "kek_id": error.key_id},
        )
    else:
        logger.error(
            "document.integrity_failed", extra={"record": kind, "record_id": str(row_id)}
        )


_UNREADABLE = (KeyUnavailable, DecryptionFailed, UnsupportedEnvelope, ValueError, KeyError)


def _version_view(keyring: Keyring, row: DocumentVersion) -> VersionView:
    filename: str | None = None
    state = "ok"
    try:
        filename = open_version_meta(version_data_key(keyring, row), row)["filename"]
    except _UNREADABLE as error:
        state = _state_for(error)
        _log_unreadable("document_version", row.id, error)
    return VersionView(
        row.id, row.version_number, row.content_type, row.size_bytes, row.created_at, filename,
        state,
    )


def _document_view(
    keyring: Keyring,
    row: Document,
    versions: list[DocumentVersion],
    *,
    include_versions: bool,
) -> DocumentView:
    title: str | None = None
    notes: str | None = None
    state = "ok"
    try:
        meta = open_document_meta(keyring, row)
        title, notes = meta["title"], meta["notes"]
    except _UNREADABLE as error:
        state = _state_for(error)
        _log_unreadable("document", row.id, error)
    ordered = sorted(versions, key=lambda version: version.version_number, reverse=True)
    current_row = next((v for v in ordered if v.version_number == row.current_version), None)
    current = _version_view(keyring, current_row) if current_row is not None else None
    if current is not None and current.state != "ok" and state == "ok":
        state = current.state
    view = DocumentView(
        row.id,
        row.revision,
        title,
        notes,
        state,
        row.created_at,
        row.updated_at,
        current,
        len(versions),
        sum(version.size_bytes for version in versions),
    )
    if include_versions:
        view.versions = [
            current if current is not None and v.id == current.id else _version_view(keyring, v)
            for v in ordered
        ]
    return view


# ───────────────────────────── reads ─────────────────────────────


def _owned_document(db: Session, owner: UUID, document_id: UUID, *, lock: bool = False) -> Document:
    statement = select(Document).where(Document.id == document_id, Document.user_id == owner)
    if lock:
        statement = statement.with_for_update()
    row = db.scalar(statement)
    if row is None:
        raise not_found()
    return row


def _versions_of(db: Session, owner: UUID, document_ids: list[UUID]) -> dict[UUID, list[DocumentVersion]]:
    grouped: dict[UUID, list[DocumentVersion]] = {document_id: [] for document_id in document_ids}
    if not document_ids:
        return grouped
    rows = db.scalars(
        select(DocumentVersion).where(
            DocumentVersion.user_id == owner, DocumentVersion.document_id.in_(document_ids)
        )
    )
    for row in rows:
        grouped[row.document_id].append(row)
    return grouped


def usage(db: Session, owner: UUID) -> tuple[int, int]:
    count = db.scalar(select(func.count()).select_from(Document).where(Document.user_id == owner))
    used = db.scalar(
        select(func.coalesce(func.sum(DocumentVersion.size_bytes), 0)).where(
            DocumentVersion.user_id == owner
        )
    )
    return int(count or 0), int(used or 0)


def list_documents(db: Session, runtime: DocumentRuntime, owner: UUID) -> list[DocumentView]:
    keyring = runtime.require_keyring()
    rows = list(
        db.scalars(
            select(Document)
            .where(Document.user_id == owner)
            .order_by(Document.updated_at.desc(), Document.id)
        )
    )
    versions = _versions_of(db, owner, [row.id for row in rows])
    return [_document_view(keyring, row, versions[row.id], include_versions=False) for row in rows]


def get_document(
    db: Session, runtime: DocumentRuntime, owner: UUID, document_id: UUID
) -> DocumentView:
    keyring = runtime.require_keyring()
    row = _owned_document(db, owner, document_id)
    versions = _versions_of(db, owner, [row.id])[row.id]
    return _document_view(keyring, row, versions, include_versions=True)


@dataclass(frozen=True)
class DownloadedContent:
    content: bytes
    content_type: str
    filename: str
    document_id: UUID
    version_number: int


def read_content(
    db: Session,
    runtime: DocumentRuntime,
    owner: UUID,
    document_id: UUID,
    version_number: int | None,
) -> DownloadedContent:
    """Authorize, then decrypt **and authenticate the whole object**; only an
    authenticated plaintext ever leaves this function."""
    keyring = runtime.require_keyring()
    document = _owned_document(db, owner, document_id)
    number = document.current_version if version_number is None else version_number
    row = db.scalar(
        select(DocumentVersion).where(
            DocumentVersion.document_id == document.id,
            DocumentVersion.user_id == owner,
            DocumentVersion.version_number == number,
        )
    )
    if row is None:
        raise not_found()
    sealed = runtime.store.get(db, version_id=row.id, owner=owner)
    if sealed is None:
        logger.error("document.blob_missing", extra={"record_id": str(row.id)})
        raise DocumentError(
            500, "document_integrity_failed", "The stored document is incomplete."
        )
    try:
        data_key = version_data_key(keyring, row)
        meta = open_version_meta(data_key, row)
        content = open_content(data_key, row, sealed.nonce, sealed.ciphertext)
    except KeyUnavailable as error:
        _log_unreadable("document_version", row.id, error)
        raise DocumentError(
            503,
            "document_key_unavailable",
            "The key needed to decrypt this document is not configured on this server.",
        ) from None
    except (DecryptionFailed, UnsupportedEnvelope, ValueError, KeyError) as error:
        _log_unreadable("document_version", row.id, error)
        raise DocumentError(
            500,
            "document_integrity_failed",
            "The stored document failed its integrity check and was not returned.",
        ) from None
    if len(content) != row.size_bytes or hashlib.sha256(content).hexdigest() != meta["sha256"]:
        _log_unreadable("document_version", row.id, DecryptionFailed("digest"))
        raise DocumentError(
            500,
            "document_integrity_failed",
            "The stored document failed its integrity check and was not returned.",
        )
    return DownloadedContent(
        content,
        row.content_type,
        download_filename(meta["filename"], row.content_type),
        document.id,
        row.version_number,
    )


# ───────────────────────────── writes ─────────────────────────────


@dataclass(frozen=True)
class UploadMeta:
    filename: str
    title: str | None = None
    notes: str | None = None
    declared_type: str | None = None


def _validate(content: bytes, runtime: DocumentRuntime, meta: UploadMeta) -> str:
    if len(content) > runtime.settings.document_max_bytes:
        raise DocumentError(413, "document_too_large", "The file exceeds the upload limit.")
    try:
        return validate_content(
            content, filename=meta.filename, declared_type=meta.declared_type
        ).content_type
    except ValidationRefused as refusal:
        status = 415 if refusal.code in {"unsupported_document_type", "content_type_mismatch"} else 422
        raise DocumentError(status, refusal.code, refusal.message) from None


def _lock_account_and_check_quota(
    db: Session, runtime: DocumentRuntime, owner: UUID, *, new_document: bool, adding: int
) -> None:
    db.execute(select(User.id).where(User.id == owner).with_for_update())
    count, used = usage(db, owner)
    if new_document and count >= runtime.settings.document_max_per_account:
        raise DocumentError(
            409, "document_limit_reached", "This account has reached its document limit."
        )
    if used + adding > runtime.settings.document_max_account_bytes:
        raise DocumentError(
            409, "document_storage_full", "This account has no document storage left."
        )


def _replayed_version(
    db: Session, keyring: Keyring, owner: UUID, idempotency_key: str, digest: str
) -> DocumentVersion | None:
    existing = db.scalar(
        select(DocumentVersion).where(
            DocumentVersion.user_id == owner, DocumentVersion.idempotency_key == idempotency_key
        )
    )
    if existing is None:
        return None
    try:
        stored = open_version_meta(version_data_key(keyring, existing), existing)["sha256"]
    except _UNREADABLE:
        stored = None
    if stored != digest:
        raise DocumentError(
            409,
            "idempotency_conflict",
            "This Idempotency-Key was already used for a different upload.",
        )
    return existing


def create_document(
    db: Session,
    runtime: DocumentRuntime,
    owner: UUID,
    *,
    content: bytes,
    meta: UploadMeta,
    idempotency_key: str,
) -> tuple[DocumentView, bool]:
    keyring = runtime.require_keyring()
    content_type = _validate(content, runtime, meta)
    filename = clean_filename(meta.filename)
    title = clean_title(meta.title, fallback=filename)
    notes = clean_notes(meta.notes)
    digest = hashlib.sha256(content).hexdigest()

    replay = _replayed_version(db, keyring, owner, idempotency_key, digest)
    if replay is not None:
        if replay.version_number != 1:
            raise DocumentError(
                409, "idempotency_conflict", "This Idempotency-Key belongs to another upload."
            )
        return get_document(db, runtime, owner, replay.document_id), False

    document_id, version_id = uuid4(), uuid4()
    try:
        _lock_account_and_check_quota(db, runtime, owner, new_document=True, adding=len(content))
        sealed_meta = seal_document_meta(
            keyring, owner=owner, document_id=document_id, revision=1, title=title, notes=notes
        )
        sealed = seal_version(
            keyring,
            owner=owner,
            document_id=document_id,
            version_id=version_id,
            number=1,
            content_type=content_type,
            content=content,
            filename=filename,
            sha256=digest,
        )
        now = datetime.now(UTC)
        db.add(
            Document(
                id=document_id,
                user_id=owner,
                revision=1,
                current_version=1,
                idempotency_key=idempotency_key,
                created_at=now,
                updated_at=now,
                meta_envelope_version=ENVELOPE_VERSION,
                meta_kek_id=sealed_meta.key_id,
                meta_wrapped_dek=sealed_meta.wrapped_dek,
                meta_nonce=sealed_meta.nonce,
                meta_ciphertext=sealed_meta.ciphertext,
            )
        )
        db.flush()
        _add_version_row(db, runtime, owner, document_id, version_id, 1, content_type,
                         len(content), idempotency_key, sealed, now)
        db.commit()
    except IntegrityError:
        db.rollback()
        # A concurrent retry with the same key won the race: answer as a replay.
        replay = _replayed_version(db, keyring, owner, idempotency_key, digest)
        if replay is None:
            raise
        return get_document(db, runtime, owner, replay.document_id), False
    except BaseException:
        db.rollback()
        raise
    logger.info(
        "document.created",
        extra={"document_id": str(document_id), "size_bytes": len(content), "type": content_type},
    )
    return get_document(db, runtime, owner, document_id), True


def _add_version_row(
    db: Session,
    runtime: DocumentRuntime,
    owner: UUID,
    document_id: UUID,
    version_id: UUID,
    number: int,
    content_type: str,
    size_bytes: int,
    idempotency_key: str,
    sealed,
    now: datetime,
) -> None:
    db.add(
        DocumentVersion(
            id=version_id,
            document_id=document_id,
            user_id=owner,
            version_number=number,
            content_type=content_type,
            size_bytes=size_bytes,
            idempotency_key=idempotency_key,
            created_at=now,
            envelope_version=ENVELOPE_VERSION,
            kek_id=sealed.key_id,
            wrapped_dek=sealed.wrapped_dek,
            meta_nonce=sealed.meta_nonce,
            meta_ciphertext=sealed.meta_ciphertext,
        )
    )
    db.flush()
    runtime.store.put(
        db,
        version_id=version_id,
        owner=owner,
        sealed=StoredCiphertext(sealed.content_nonce, sealed.content_ciphertext),
    )
    db.flush()


def add_version(
    db: Session,
    runtime: DocumentRuntime,
    owner: UUID,
    document_id: UUID,
    *,
    content: bytes,
    meta: UploadMeta,
    idempotency_key: str,
    expected_revision: int,
) -> tuple[DocumentView, bool]:
    keyring = runtime.require_keyring()
    content_type = _validate(content, runtime, meta)
    filename = clean_filename(meta.filename)
    digest = hashlib.sha256(content).hexdigest()

    replay = _replayed_version(db, keyring, owner, idempotency_key, digest)
    if replay is not None:
        if replay.document_id != document_id:
            raise DocumentError(
                409, "idempotency_conflict", "This Idempotency-Key belongs to another upload."
            )
        return get_document(db, runtime, owner, document_id), False

    version_id = uuid4()
    try:
        _lock_account_and_check_quota(db, runtime, owner, new_document=False, adding=len(content))
        document = _owned_document(db, owner, document_id, lock=True)
        if document.revision != expected_revision:
            raise _revision_conflict(document.revision)
        meta_plain = open_document_meta(keyring, document)
        number = document.current_version + 1
        sealed = seal_version(
            keyring,
            owner=owner,
            document_id=document_id,
            version_id=version_id,
            number=number,
            content_type=content_type,
            content=content,
            filename=filename,
            sha256=digest,
        )
        now = datetime.now(UTC)
        _add_version_row(db, runtime, owner, document_id, version_id, number, content_type,
                         len(content), idempotency_key, sealed, now)
        # The revision is part of the metadata context, so re-seal it at the new revision.
        _reseal_meta(keyring, document, document.revision + 1, meta_plain["title"],
                     meta_plain["notes"])
        document.current_version = number
        document.updated_at = now
        db.commit()
    except IntegrityError:
        db.rollback()
        replay = _replayed_version(db, keyring, owner, idempotency_key, digest)
        if replay is None or replay.document_id != document_id:
            raise
        return get_document(db, runtime, owner, document_id), False
    except (KeyUnavailable, DecryptionFailed, UnsupportedEnvelope, ValueError, KeyError):
        db.rollback()
        raise DocumentError(
            503, "document_key_unavailable",
            "The document's current metadata cannot be decrypted with the configured keys.",
        ) from None
    except BaseException:
        db.rollback()
        raise
    logger.info(
        "document.version_added",
        extra={"document_id": str(document_id), "version": number, "size_bytes": len(content)},
    )
    return get_document(db, runtime, owner, document_id), True


def _reseal_meta(keyring: Keyring, document: Document, revision: int, title: str, notes: str) -> None:
    sealed = seal_document_meta(
        keyring,
        owner=document.user_id,
        document_id=document.id,
        revision=revision,
        title=title,
        notes=notes,
    )
    document.revision = revision
    document.meta_envelope_version = ENVELOPE_VERSION
    document.meta_kek_id = sealed.key_id
    document.meta_wrapped_dek = sealed.wrapped_dek
    document.meta_nonce = sealed.nonce
    document.meta_ciphertext = sealed.ciphertext


def update_metadata(
    db: Session,
    runtime: DocumentRuntime,
    owner: UUID,
    document_id: UUID,
    *,
    expected_revision: int,
    title: str | None,
    notes: str | None,
) -> DocumentView:
    keyring = runtime.require_keyring()
    try:
        document = _owned_document(db, owner, document_id, lock=True)
        if document.revision != expected_revision:
            raise _revision_conflict(document.revision)
        try:
            current = open_document_meta(keyring, document)
        except (KeyUnavailable, DecryptionFailed, UnsupportedEnvelope, ValueError, KeyError):
            # Overwriting unreadable metadata would hide the failure; refuse.
            raise DocumentError(
                503,
                "document_key_unavailable",
                "The document's current metadata cannot be decrypted with the configured keys.",
            ) from None
        if title is not None and not _strip_controls(title, keep_newlines=False).strip():
            raise DocumentError(422, "invalid_document_metadata", "The title cannot be empty.")
        new_title = current["title"] if title is None else clean_title(title, fallback="")
        new_notes = current["notes"] if notes is None else clean_notes(notes)
        _reseal_meta(keyring, document, document.revision + 1, new_title, new_notes)
        document.updated_at = datetime.now(UTC)
        db.commit()
    except BaseException:
        db.rollback()
        raise
    logger.info("document.metadata_updated", extra={"document_id": str(document_id)})
    return get_document(db, runtime, owner, document_id)


def delete_document(
    db: Session, owner: UUID, document_id: UUID, *, expected_revision: int
) -> None:
    """Delete the document, every version, every wrapped data key and every blob
    (FK cascades) in one transaction. Requires the revision the client saw, so a
    version added meanwhile in another tab is not deleted unseen."""
    try:
        document = _owned_document(db, owner, document_id, lock=True)
        if document.revision != expected_revision:
            raise _revision_conflict(document.revision)
        db.execute(delete(Document).where(Document.id == document_id, Document.user_id == owner))
        db.commit()
    except BaseException:
        db.rollback()
        raise
    logger.info("document.deleted", extra={"document_id": str(document_id)})
