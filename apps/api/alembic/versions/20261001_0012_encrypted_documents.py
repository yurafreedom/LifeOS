"""M12: encrypted documents (JENKIN S2).

Adds ``documents``, ``document_versions`` and ``document_blobs``. Nothing
existing is read, rewritten or encrypted: snapshots, analytics tables and
every other table are untouched (their protection needs its own design —
``Outputs/Plans/jenkin-existing-plaintext-data-plan_20261001.md``).

Downgrade is **destructive** and says so: dropping these tables deletes every
stored document ciphertext and wrapped data key, and no earlier schema can
hold them. It therefore refuses while any document exists, unless the
operator sets ``LIFEOS_ALLOW_DESTRUCTIVE_DOWNGRADE=documents`` after taking a
backup (and keeping the keyring that can decrypt it).
"""

import os

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261001_0012"
down_revision = "20261001_0011"
branch_labels = None
depends_on = None

_TYPES = "'application/pdf', 'image/jpeg', 'image/png'"


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("current_version", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("meta_envelope_version", sa.SmallInteger(), nullable=False),
        sa.Column("meta_kek_id", sa.Text(), nullable=False),
        sa.Column("meta_wrapped_dek", sa.LargeBinary(), nullable=False),
        sa.Column("meta_nonce", sa.LargeBinary(), nullable=False),
        sa.Column("meta_ciphertext", sa.LargeBinary(), nullable=False),
        sa.UniqueConstraint("id", "user_id", name="uq_documents_id_user"),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_documents_idempotency_key"),
        sa.CheckConstraint("revision >= 1", name="ck_documents_revision"),
        sa.CheckConstraint("current_version >= 1", name="ck_documents_current_version"),
        sa.CheckConstraint("octet_length(meta_wrapped_dek) = 60", name="ck_documents_wrapped_dek"),
        sa.CheckConstraint("octet_length(meta_nonce) = 12", name="ck_documents_meta_nonce"),
        sa.CheckConstraint("octet_length(meta_ciphertext) >= 16", name="ck_documents_meta_ct"),
    )
    op.create_index(
        "ix_documents_user_updated", "documents", ["user_id", sa.text("updated_at DESC")]
    )
    op.create_index("ix_documents_meta_kek", "documents", ["meta_kek_id"])

    op.create_table(
        "document_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("envelope_version", sa.SmallInteger(), nullable=False),
        sa.Column("kek_id", sa.Text(), nullable=False),
        sa.Column("wrapped_dek", sa.LargeBinary(), nullable=False),
        sa.Column("meta_nonce", sa.LargeBinary(), nullable=False),
        sa.Column("meta_ciphertext", sa.LargeBinary(), nullable=False),
        sa.ForeignKeyConstraint(
            ["document_id", "user_id"],
            ["documents.id", "documents.user_id"],
            ondelete="CASCADE",
            name="fk_document_versions_document_owner",
        ),
        sa.UniqueConstraint("id", "user_id", name="uq_document_versions_id_user"),
        sa.UniqueConstraint(
            "document_id", "version_number", name="uq_document_versions_number"
        ),
        sa.UniqueConstraint(
            "user_id", "idempotency_key", name="uq_document_versions_idempotency_key"
        ),
        sa.CheckConstraint("version_number >= 1", name="ck_document_versions_number"),
        sa.CheckConstraint(
            f"content_type IN ({_TYPES})", name="ck_document_versions_content_type"
        ),
        sa.CheckConstraint("size_bytes > 0", name="ck_document_versions_size"),
        sa.CheckConstraint(
            "octet_length(wrapped_dek) = 60", name="ck_document_versions_wrapped_dek"
        ),
        sa.CheckConstraint(
            "octet_length(meta_nonce) = 12", name="ck_document_versions_meta_nonce"
        ),
        sa.CheckConstraint(
            "octet_length(meta_ciphertext) >= 16", name="ck_document_versions_meta_ct"
        ),
    )
    op.create_index("ix_document_versions_user", "document_versions", ["user_id"])
    op.create_index("ix_document_versions_kek", "document_versions", ["kek_id"])

    op.create_table(
        "document_blobs",
        sa.Column("version_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content_nonce", sa.LargeBinary(), nullable=False),
        sa.Column("content_ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(
            ["version_id", "user_id"],
            ["document_versions.id", "document_versions.user_id"],
            ondelete="CASCADE",
            name="fk_document_blobs_version_owner",
        ),
        sa.CheckConstraint("octet_length(content_nonce) = 12", name="ck_document_blobs_nonce"),
        sa.CheckConstraint("octet_length(content_ciphertext) > 16", name="ck_document_blobs_ct"),
    )
    op.create_index("ix_document_blobs_user", "document_blobs", ["user_id"])
    # Ciphertext is incompressible: skip TOAST compression attempts.
    op.execute("ALTER TABLE document_blobs ALTER COLUMN content_ciphertext SET STORAGE EXTERNAL")


def downgrade() -> None:
    existing = op.get_bind().execute(sa.text("SELECT count(*) FROM documents")).scalar_one()
    if existing and os.environ.get("LIFEOS_ALLOW_DESTRUCTIVE_DOWNGRADE") != "documents":
        raise RuntimeError(
            f"Refusing to downgrade: {existing} encrypted document(s) would be deleted. "
            "This downgrade is destructive and cannot preserve them. Take a backup, then "
            "set LIFEOS_ALLOW_DESTRUCTIVE_DOWNGRADE=documents to proceed."
        )
    op.drop_table("document_blobs")
    op.drop_table("document_versions")
    op.drop_table("documents")
