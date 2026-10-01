"""Where document ciphertext lives — a deliberately small, replaceable seam.

The store only ever sees **ciphertext** (nonce + AES-GCM output) keyed by the
version id and its owner; encryption, keys and authorization happen above it.
The initial backend is PostgreSQL (``document_blobs``), chosen because it
needs no external service, shares the database's transactions (a version and
its blob commit or roll back together) and its backups. An object-storage
backend can replace it later behind the same three methods; it would then
need its own deletion and backup-retention story.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DocumentBlob


@dataclass(frozen=True)
class StoredCiphertext:
    nonce: bytes
    ciphertext: bytes


class BlobStore(Protocol):
    def put(self, db: Session, *, version_id: UUID, owner: UUID, sealed: StoredCiphertext) -> None:
        """Stage the ciphertext inside the caller's transaction."""

    def get(self, db: Session, *, version_id: UUID, owner: UUID) -> StoredCiphertext | None:
        """The ciphertext, or ``None`` when absent or owned by someone else."""

    def owner_scoped_tables(self) -> tuple[str, ...]:
        """Tables this store writes (for export/erasure completeness guards)."""


class PostgresBlobStore:
    def put(self, db: Session, *, version_id: UUID, owner: UUID, sealed: StoredCiphertext) -> None:
        db.add(
            DocumentBlob(
                version_id=version_id,
                user_id=owner,
                content_nonce=sealed.nonce,
                content_ciphertext=sealed.ciphertext,
            )
        )

    def get(self, db: Session, *, version_id: UUID, owner: UUID) -> StoredCiphertext | None:
        row = db.execute(
            select(DocumentBlob.content_nonce, DocumentBlob.content_ciphertext).where(
                DocumentBlob.version_id == version_id, DocumentBlob.user_id == owner
            )
        ).one_or_none()
        if row is None:
            return None
        return StoredCiphertext(bytes(row[0]), bytes(row[1]))

    def owner_scoped_tables(self) -> tuple[str, ...]:
        return ("document_blobs",)
