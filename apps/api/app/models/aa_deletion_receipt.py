"""Metadata-only hard-erasure receipt. Never stores deleted fact content."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AADeletionReceipt(Base):
    __tablename__ = "aa_deletion_receipts"
    __table_args__ = (
        CheckConstraint("table_name <> ''", name="ck_aa_deletion_receipts_table_name"),
        Index("ix_aa_deletion_receipts_user_deleted_at", "user_id", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    table_name: Mapped[str] = mapped_column(Text, nullable=False)
    fact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    deleted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
