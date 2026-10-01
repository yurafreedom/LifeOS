"""Wrapping-key rotation and verification for document records.

Rotation **re-wraps data keys**; it never decrypts or rewrites document
content (or metadata ciphertext). For each live record not yet on the active
KEK: unwrap its 32-byte data key with the old KEK, wrap it with the active
KEK, and store it with a compare-and-swap on the old wrapped value — so a
record that changed meanwhile (an edit, a deletion) is skipped and picked up by
the next pass rather than overwritten.

* Resumable / idempotent: records already on the active key are not touched;
  each batch commits independently; re-running after an interruption simply
  continues.
* Never removes keys: old KEKs stay in the keyring until an operator retires
  them explicitly after :func:`verify` reports completion.
* "Complete" means the **live database** has no record left on another key and
  every record authenticates. Backups taken before rotation still need the old
  key(s) — see the key runbook.

Records whose key is absent or whose wrapped key fails authentication are
reported, never "fixed" or skipped silently.
"""

from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass, field

from sqlalchemy import select, true, update
from sqlalchemy.orm import Session, sessionmaker

from app.crypto import (
    DecryptionFailed,
    Keyring,
    KeyUnavailable,
    UnsupportedEnvelope,
    WrappedKey,
    unwrap_data_key,
    wrap_data_key,
)
from app.models import Document, DocumentVersion
from app.services.documents.envelopes import (
    document_meta_context,
    open_content,
    open_document_meta,
    open_version_meta,
    version_contexts,
    version_data_key,
)
from app.services.documents.store import BlobStore, PostgresBlobStore

logger = logging.getLogger(__name__)
_FAILURES = (KeyUnavailable, DecryptionFailed, UnsupportedEnvelope)


@dataclass
class RotationReport:
    active_key_id: str
    rewrapped: int = 0
    skipped_concurrent: int = 0
    failures: list[str] = field(default_factory=list)
    _failed_ids: set = field(default_factory=set, repr=False)

    @property
    def clean(self) -> bool:
        return not self.failures and self.skipped_concurrent == 0


def _rewrap_documents(db: Session, keyring: Keyring, report: RotationReport, batch: int) -> int:
    rows = list(
        db.scalars(
            select(Document)
            .where(Document.meta_kek_id != keyring.active_key_id)
            .where(Document.id.notin_(report._failed_ids) if report._failed_ids else true())
            .order_by(Document.id)
            .limit(batch)
        )
    )
    progressed = 0
    for row in rows:
        label = f"documents/{row.id}"
        context = document_meta_context(owner=row.user_id, document_id=row.id, revision=row.revision)
        try:
            data_key = unwrap_data_key(
                keyring,
                WrappedKey(row.meta_kek_id, bytes(row.meta_wrapped_dek)),
                context,
                envelope_version=row.meta_envelope_version,
            )
        except _FAILURES as error:
            report.failures.append(label)
            report._failed_ids.add(row.id)
            logger.error("rotation.unreadable", extra={"record": label, "error": type(error).__name__})
            continue
        rewrapped = wrap_data_key(keyring, data_key, context)
        result = db.execute(
            update(Document)
            .where(
                Document.id == row.id,
                Document.revision == row.revision,
                Document.meta_kek_id == row.meta_kek_id,
                Document.meta_wrapped_dek == row.meta_wrapped_dek,
            )
            .values(meta_kek_id=rewrapped.key_id, meta_wrapped_dek=rewrapped.blob)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount == 1:
            report.rewrapped += 1
            progressed += 1
        else:
            report.skipped_concurrent += 1
    db.commit()
    return progressed


def _rewrap_versions(db: Session, keyring: Keyring, report: RotationReport, batch: int) -> int:
    rows = list(
        db.scalars(
            select(DocumentVersion)
            .where(DocumentVersion.kek_id != keyring.active_key_id)
            .where(DocumentVersion.id.notin_(report._failed_ids) if report._failed_ids else true())
            .order_by(DocumentVersion.id)
            .limit(batch)
        )
    )
    progressed = 0
    for row in rows:
        label = f"document_versions/{row.id}"
        wrap_context, _, _ = version_contexts(row)
        try:
            data_key = version_data_key(keyring, row)
        except _FAILURES as error:
            report.failures.append(label)
            report._failed_ids.add(row.id)
            logger.error("rotation.unreadable", extra={"record": label, "error": type(error).__name__})
            continue
        rewrapped = wrap_data_key(keyring, data_key, wrap_context)
        result = db.execute(
            update(DocumentVersion)
            .where(
                DocumentVersion.id == row.id,
                DocumentVersion.kek_id == row.kek_id,
                DocumentVersion.wrapped_dek == row.wrapped_dek,
            )
            .values(kek_id=rewrapped.key_id, wrapped_dek=rewrapped.blob)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount == 1:
            report.rewrapped += 1
            progressed += 1
        else:
            report.skipped_concurrent += 1
    db.commit()
    return progressed


def rewrap_all(
    factory: sessionmaker[Session],
    keyring: Keyring,
    *,
    batch_size: int = 200,
    max_batches: int | None = None,
) -> RotationReport:
    """Re-wrap every live data key not on the active KEK. ``max_batches`` exists
    for tests and cautious operators: stopping early is always safe."""
    report = RotationReport(keyring.active_key_id)
    batches = 0
    for step in (_rewrap_documents, _rewrap_versions):
        while max_batches is None or batches < max_batches:
            with factory() as db:
                progressed = step(db, keyring, report, batch_size)
            batches += 1
            if progressed <= 0:
                break
    logger.info(
        "rotation.pass",
        extra={
            "active_key_id": keyring.active_key_id,
            "rewrapped": report.rewrapped,
            "skipped_concurrent": report.skipped_concurrent,
            "failures": len(report.failures),
        },
    )
    return report


@dataclass
class VerificationReport:
    active_key_id: str
    documents: int = 0
    versions: int = 0
    by_key: Counter[str] = field(default_factory=Counter)
    failures: list[str] = field(default_factory=list)
    deep: bool = False

    @property
    def on_other_keys(self) -> int:
        return sum(count for key, count in self.by_key.items() if key != self.active_key_id)

    @property
    def complete(self) -> bool:
        """Rotation is complete for the live database: everything authenticates
        and nothing still depends on a non-active key."""
        return not self.failures and self.on_other_keys == 0


def verify(
    factory: sessionmaker[Session],
    keyring: Keyring,
    *,
    deep: bool = False,
    store: BlobStore | None = None,
    batch_size: int = 200,
) -> VerificationReport:
    """Check every live record. Shallow: every wrapped key unwraps and every
    metadata envelope authenticates. Deep: additionally decrypt and authenticate
    every content blob (reads all ciphertext; plaintext is discarded at once)."""
    blob_store = store or PostgresBlobStore()
    report = VerificationReport(keyring.active_key_id, deep=deep)
    last = None
    while True:
        with factory() as db:
            statement = select(Document).order_by(Document.id).limit(batch_size)
            if last is not None:
                statement = statement.where(Document.id > last)
            rows = list(db.scalars(statement))
            for row in rows:
                report.documents += 1
                report.by_key[row.meta_kek_id] += 1
                try:
                    open_document_meta(keyring, row)
                except (*_FAILURES, ValueError, KeyError):
                    report.failures.append(f"documents/{row.id}")
        if not rows:
            break
        last = rows[-1].id
    last = None
    while True:
        with factory() as db:
            statement = select(DocumentVersion).order_by(DocumentVersion.id).limit(batch_size)
            if last is not None:
                statement = statement.where(DocumentVersion.id > last)
            rows = list(db.scalars(statement))
            for row in rows:
                report.versions += 1
                report.by_key[row.kek_id] += 1
                try:
                    data_key = version_data_key(keyring, row)
                    open_version_meta(data_key, row)
                    if deep:
                        sealed = blob_store.get(db, version_id=row.id, owner=row.user_id)
                        if sealed is None:
                            raise DecryptionFailed("missing blob")
                        open_content(data_key, row, sealed.nonce, sealed.ciphertext)
                except (*_FAILURES, ValueError, KeyError):
                    report.failures.append(f"document_versions/{row.id}")
        if not rows:
            break
        last = rows[-1].id
    return report


def records_using_key(factory: sessionmaker[Session], key_id: str) -> int:
    from sqlalchemy import func

    with factory() as db:
        documents = db.scalar(
            select(func.count()).select_from(Document).where(Document.meta_kek_id == key_id)
        )
        versions = db.scalar(
            select(func.count())
            .select_from(DocumentVersion)
            .where(DocumentVersion.kek_id == key_id)
        )
    return int(documents or 0) + int(versions or 0)
