"""User-owned importance of one item (Slice 7, master context §41).

Importance is the user's word on whether something matters to them. It is never
inferred from size, sign or materiality, never mapped to a number and never
combined with anything — there is deliberately no numeric column here.

Append-only: a new rating supersedes the active one for the same target, so the
history of what the user said, and when, is kept. No row means «не решил»; an
explicit ``none`` row means the user reset it.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import Importance, check_in
from app.models.base import Base
from app.models.mixins import AAOwnedMixin


class AAImportanceRating(AAOwnedMixin, Base):
    __tablename__ = "aa_importance_ratings"

    target_key: Mapped[str] = mapped_column(Text, nullable=False)
    importance: Mapped[str] = mapped_column(Text, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    supersedes_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_importance_ratings.id"), nullable=True
    )
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "char_length(target_key) BETWEEN 3 AND 600", name="ck_aa_importance_ratings_target"
        ),
        CheckConstraint(
            check_in("importance", Importance), name="ck_aa_importance_ratings_importance"
        ),
        CheckConstraint(
            "status IN ('active', 'superseded')", name="ck_aa_importance_ratings_status"
        ),
        CheckConstraint(
            "(status = 'active') = (superseded_at IS NULL)",
            name="ck_aa_importance_ratings_superseded_pair",
        ),
        UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_importance_ratings_idempotency_key"
        ),
        Index(
            "uq_aa_importance_ratings_active",
            "user_id",
            "target_key",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        Index("ix_aa_importance_ratings_user_target", "user_id", "target_key", "recorded_at"),
    )


__all__ = ["AAImportanceRating"]
