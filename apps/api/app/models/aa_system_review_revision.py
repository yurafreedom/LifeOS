"""Saved System Review — append-only revisions of one period's review (Slice 7, OD-7.2 C).

The live System Review is derived on every read and stores nothing. A saved
review is what the user explicitly kept: their reflection, decisions and
adjustments, plus the evidence the review showed at that moment, frozen so the
revision stays interpretable after corrections change the live picture.

There is no header row. The logical review is ``(user, period_kind,
period_key)``; each explicit save, finalize or revise appends revision N+1 and
never touches revision N. ``(user, period_kind, period_key, revision)`` is
unique, which makes two concurrent saves from the same base deterministic: one
wins, the other is a conflict.

``frozen_context`` items each carry their source references; ``source_ids`` is
the manifest of every fact id and finance-context entity id they were derived
from, so a hard delete finds exactly the items to redact (D1). Redaction is the
only in-place change a revision ever receives.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import ReviewPeriodKind, SystemReviewRevisionStatus, check_in
from app.models.base import Base
from app.models.mixins import AAOwnedMixin


class AASystemReviewRevision(AAOwnedMixin, Base):
    __tablename__ = "aa_system_review_revisions"

    period_kind: Mapped[str] = mapped_column(Text, nullable=False)
    period_key: Mapped[str] = mapped_column(Text, nullable=False)
    timezone: Mapped[str] = mapped_column(Text, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_revision_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_system_review_revisions.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(Text, nullable=False)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    context_as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reflection: Mapped[str | None] = mapped_column(Text, nullable=True)
    no_conclusion: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    decisions: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    adjustments: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    frozen_context: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    source_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, server_default=text("'{}'::uuid[]")
    )
    redacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint(
            check_in("period_kind", ReviewPeriodKind),
            name="ck_aa_system_review_revisions_period_kind",
        ),
        CheckConstraint(
            "(period_kind = 'month' AND period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')"
            " OR (period_kind = 'year' AND period_key ~ '^[0-9]{4}$')",
            name="ck_aa_system_review_revisions_period_key",
        ),
        CheckConstraint("timezone <> ''", name="ck_aa_system_review_revisions_timezone"),
        CheckConstraint("revision >= 1", name="ck_aa_system_review_revisions_revision"),
        CheckConstraint(
            "(revision = 1) = (previous_revision_id IS NULL)",
            name="ck_aa_system_review_revisions_chain",
        ),
        CheckConstraint(
            check_in("status", SystemReviewRevisionStatus),
            name="ck_aa_system_review_revisions_status",
        ),
        CheckConstraint(
            "(status = 'finalized') = (finalized_at IS NOT NULL)",
            name="ck_aa_system_review_revisions_finalized_pair",
        ),
        CheckConstraint(
            "reflection IS NULL"
            " OR (btrim(reflection) <> '' AND char_length(reflection) <= 4000)",
            name="ck_aa_system_review_revisions_reflection",
        ),
        CheckConstraint(
            "NOT (no_conclusion AND reflection IS NOT NULL)",
            name="ck_aa_system_review_revisions_no_conclusion",
        ),
        CheckConstraint(
            "jsonb_typeof(decisions) = 'array' AND jsonb_typeof(adjustments) = 'array'",
            name="ck_aa_system_review_revisions_lists",
        ),
        CheckConstraint(
            "jsonb_typeof(frozen_context) = 'object'",
            name="ck_aa_system_review_revisions_frozen_context",
        ),
        UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_system_review_revisions_idempotency_key"
        ),
        UniqueConstraint(
            "user_id",
            "period_kind",
            "period_key",
            "revision",
            name="uq_aa_system_review_revisions_revision",
        ),
        Index(
            "ix_aa_system_review_revisions_period",
            "user_id",
            "period_kind",
            "period_key",
            "revision",
        ),
        Index(
            "ix_aa_system_review_revisions_sources", "source_ids", postgresql_using="gin"
        ),
    )


__all__ = ["AASystemReviewRevision"]
