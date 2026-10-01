"""Encrypted documents (JENKIN S2).

Three owner-scoped tables, all cascading from ``users``:

* ``documents`` — one row per document. Readable: ids, owner, revision (CAS),
  current version number, timestamps. Encrypted (``meta_*``): the user's
  title and notes, under a data key that is replaced on every edit.
* ``document_versions`` — immutable content versions. Readable: version number,
  verified content type, plaintext size, creation time, the wrapping-key id
  and envelope version. Encrypted (``meta_*``): the original filename and a
  SHA-256 digest of the content (used only to recognise a retried upload).
  ``wrapped_dek`` is the version's data key wrapped by the KEK ``kek_id``.
* ``document_blobs`` — the content ciphertext, one per version, kept apart so
  listing never reads it and the storage backend stays replaceable
  (``services/documents/store.py``).

Composite foreign keys ``(…, user_id)`` make the database itself refuse a
version or blob attached to another account's document.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

DOCUMENT_CONTENT_TYPES = ("application/pdf", "image/jpeg", "image/png")
_CONTENT_TYPES_SQL = ", ".join(f"'{value}'" for value in DOCUMENT_CONTENT_TYPES)


def _owner_column() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_documents_id_user"),
        UniqueConstraint("user_id", "idempotency_key", name="uq_documents_idempotency_key"),
        CheckConstraint("revision >= 1", name="ck_documents_revision"),
        CheckConstraint("current_version >= 1", name="ck_documents_current_version"),
        CheckConstraint("octet_length(meta_wrapped_dek) = 60", name="ck_documents_wrapped_dek"),
        CheckConstraint("octet_length(meta_nonce) = 12", name="ck_documents_meta_nonce"),
        CheckConstraint("octet_length(meta_ciphertext) >= 16", name="ck_documents_meta_ct"),
        Index("ix_documents_user_updated", "user_id", text("updated_at DESC")),
        Index("ix_documents_meta_kek", "meta_kek_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = _owner_column()
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    meta_envelope_version: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    meta_kek_id: Mapped[str] = mapped_column(Text, nullable=False)
    meta_wrapped_dek: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    meta_nonce: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    meta_ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["document_id", "user_id"],
            ["documents.id", "documents.user_id"],
            ondelete="CASCADE",
            name="fk_document_versions_document_owner",
        ),
        UniqueConstraint("id", "user_id", name="uq_document_versions_id_user"),
        UniqueConstraint("document_id", "version_number", name="uq_document_versions_number"),
        UniqueConstraint("user_id", "idempotency_key", name="uq_document_versions_idempotency_key"),
        CheckConstraint("version_number >= 1", name="ck_document_versions_number"),
        CheckConstraint(
            f"content_type IN ({_CONTENT_TYPES_SQL})", name="ck_document_versions_content_type"
        ),
        CheckConstraint("size_bytes > 0", name="ck_document_versions_size"),
        CheckConstraint("octet_length(wrapped_dek) = 60", name="ck_document_versions_wrapped_dek"),
        CheckConstraint("octet_length(meta_nonce) = 12", name="ck_document_versions_meta_nonce"),
        CheckConstraint("octet_length(meta_ciphertext) >= 16", name="ck_document_versions_meta_ct"),
        Index("ix_document_versions_user", "user_id"),
        Index("ix_document_versions_kek", "kek_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID] = _owner_column()
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    envelope_version: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    kek_id: Mapped[str] = mapped_column(Text, nullable=False)
    wrapped_dek: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    meta_nonce: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    meta_ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)


class DocumentBlob(Base):
    __tablename__ = "document_blobs"
    __table_args__ = (
        ForeignKeyConstraint(
            ["version_id", "user_id"],
            ["document_versions.id", "document_versions.user_id"],
            ondelete="CASCADE",
            name="fk_document_blobs_version_owner",
        ),
        CheckConstraint("octet_length(content_nonce) = 12", name="ck_document_blobs_nonce"),
        CheckConstraint("octet_length(content_ciphertext) > 16", name="ck_document_blobs_ct"),
        Index("ix_document_blobs_user", "user_id"),
    )

    version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = _owner_column()
    content_nonce: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
