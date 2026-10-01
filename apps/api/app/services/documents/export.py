"""Explicit, authenticated export of decrypted documents.

Separate from the account export on purpose: the account export is written to
a server temporary file before it is sent (``services/export.py``), and
decrypted documents must not leave plaintext residue on the server's disk.
This export is therefore **streamed**: a ZIP is produced incrementally into an
in-memory buffer that is drained after every write, one document version is
decrypted and authenticated at a time, and nothing touches the filesystem.

Bounded memory: at most one version's ciphertext + plaintext (≤ the upload
limit each) plus zipfile's small buffers. A ZIP written to a non-seekable
stream uses data descriptors, which every mainstream unzip tool reads.

Integrity: each version is authenticated before its bytes are written. A
version that fails (key unavailable, tampered) is **not** written; it is listed
in ``documents.json`` with its state, so the export is honest about gaps.

Account changes: the export is bound to the account at request time (S1
binding). The session is re-checked before every document; if it was revoked
or signed out meanwhile, the stream stops and the client receives a broken
download rather than a complete archive.
"""

from __future__ import annotations

import hashlib
import json
import logging
import zipfile
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.crypto import DecryptionFailed, KeyUnavailable, UnsupportedEnvelope
from app.models import Document, DocumentVersion
from app.services.documents.envelopes import (
    open_content,
    open_document_meta,
    open_version_meta,
    version_data_key,
)
from app.services.documents.service import DocumentRuntime, download_filename

logger = logging.getLogger(__name__)


class _Drain:
    """A write-only, non-seekable sink whose contents are taken after each write."""

    def __init__(self) -> None:
        self._parts: list[bytes] = []

    def write(self, data: bytes) -> int:
        self._parts.append(bytes(data))
        return len(data)

    def flush(self) -> None:
        pass

    def take(self) -> bytes:
        data = b"".join(self._parts)
        self._parts.clear()
        return data


class ExportInterrupted(RuntimeError):
    """The account's session ended while the export was streaming."""


def _safe_member(document_id: UUID, number: int, filename: str) -> str:
    cleaned = "".join(
        ch if ch.isalnum() or ch in "._- " else "_" for ch in filename
    ).strip(" .") or "document"
    return f"documents/{document_id}/v{number}-{cleaned[:120]}"


def stream_documents_export(
    factory: sessionmaker[Session],
    runtime: DocumentRuntime,
    *,
    owner: UUID,
    still_authorized: Callable[[], bool],
) -> Iterator[bytes]:
    keyring = runtime.require_keyring()
    sink = _Drain()
    index: list[dict[str, object]] = []
    written = 0
    with factory() as db:
        db.connection(execution_options={"isolation_level": "REPEATABLE READ"})
        documents = list(
            db.scalars(
                select(Document).where(Document.user_id == owner).order_by(Document.created_at)
            )
        )
        with zipfile.ZipFile(sink, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            for document in documents:
                if not still_authorized():
                    raise ExportInterrupted("session ended during the document export")
                entry: dict[str, object] = {
                    "id": str(document.id),
                    "created_at": document.created_at.isoformat(),
                    "updated_at": document.updated_at.isoformat(),
                    "current_version": document.current_version,
                    "versions": [],
                }
                try:
                    meta = open_document_meta(keyring, document)
                    entry.update(title=meta["title"], notes=meta["notes"], state="ok")
                except (KeyUnavailable, DecryptionFailed, UnsupportedEnvelope, ValueError, KeyError) as error:
                    entry.update(title=None, notes=None, state=_state(error))
                versions = db.scalars(
                    select(DocumentVersion)
                    .where(DocumentVersion.document_id == document.id, DocumentVersion.user_id == owner)
                    .order_by(DocumentVersion.version_number)
                )
                for version in versions:
                    item: dict[str, object] = {
                        "number": version.version_number,
                        "content_type": version.content_type,
                        "size_bytes": version.size_bytes,
                        "created_at": version.created_at.isoformat(),
                    }
                    sealed = runtime.store.get(db, version_id=version.id, owner=owner)
                    try:
                        if sealed is None:
                            raise DecryptionFailed("missing blob")
                        data_key = version_data_key(keyring, version)
                        version_meta = open_version_meta(data_key, version)
                        content = open_content(data_key, version, sealed.nonce, sealed.ciphertext)
                        if hashlib.sha256(content).hexdigest() != version_meta["sha256"]:
                            raise DecryptionFailed("digest")
                    except (KeyUnavailable, DecryptionFailed, UnsupportedEnvelope, ValueError, KeyError) as error:
                        item.update(state=_state(error), file=None, original_filename=None)
                        logger.error(
                            "document.export_unreadable",
                            extra={"record_id": str(version.id), "state": item["state"]},
                        )
                    else:
                        member = _safe_member(
                            document.id,
                            version.version_number,
                            download_filename(version_meta["filename"], version.content_type),
                        )
                        archive.writestr(member, content)
                        written += 1
                        item.update(
                            state="ok",
                            file=member,
                            original_filename=version_meta["filename"],
                            sha256=version_meta["sha256"],
                        )
                        del content
                        yield sink.take()
                    entry["versions"].append(item)  # type: ignore[union-attr]
                index.append(entry)
            manifest = {
                "format": "jenkin-documents-export",
                "format_version": 1,
                "exported_at": datetime.now(UTC).isoformat(),
                "user_id": str(owner),
                "documents": index,
                "protection": (
                    "These files are DECRYPTED copies. Store this archive as carefully as the "
                    "originals; JENKIN's server-side encryption no longer protects it."
                ),
            }
            archive.writestr(
                "documents.json",
                json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"),
                compress_type=zipfile.ZIP_DEFLATED,
            )
    yield sink.take()
    logger.info(
        "document.export_completed",
        extra={"account_id": str(owner), "documents": len(index), "files": written},
    )


def _state(error: Exception) -> str:
    return "key_unavailable" if isinstance(error, KeyUnavailable) else "integrity_failed"
