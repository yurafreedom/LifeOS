"""Explicit, user-authored finance context (Slice 7).

LifeOS models transactions, but not how an expense was funded, whether it was
planned, what it was for, how the user felt, what they owe, what they keep in
reserve or what their essential commitments are. Consequence projections need
those inputs, and they must never be inferred — so the user states them here.

One row per version of one logical entity (``entity_id``, minted by the client so
queued follow-ups can address it). A new version supersedes the active one; the
history is kept. Deleting an entity is a hard delete of every version, and the
Slice 7 redactors erase whatever was derived from it in the same transaction.

The payload is a JSON object whose shape depends on ``kind`` and is validated by
the service schema per kind. Free text inside it is sensitive, user-typed
content: it is never copied into relations, candidates, evidence or logs.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import FinanceContextKind, check_in
from app.models.base import Base
from app.models.mixins import AAOwnedMixin


class AAFinanceContext(AAOwnedMixin, Base):
    __tablename__ = "aa_finance_contexts"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    subject_key: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    supersedes_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_finance_contexts.id"), nullable=True
    )
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint(check_in("kind", FinanceContextKind), name="ck_aa_finance_contexts_kind"),
        CheckConstraint(
            "jsonb_typeof(payload) = 'object'", name="ck_aa_finance_contexts_payload"
        ),
        CheckConstraint("version >= 1", name="ck_aa_finance_contexts_version"),
        CheckConstraint(
            "status IN ('active', 'superseded')", name="ck_aa_finance_contexts_status"
        ),
        CheckConstraint(
            "(status = 'active') = (superseded_at IS NULL)",
            name="ck_aa_finance_contexts_superseded_pair",
        ),
        CheckConstraint(
            "(kind IN ('expense_context', 'self_check')) = (subject_key <> '')",
            name="ck_aa_finance_contexts_subject_required",
        ),
        CheckConstraint(
            "kind <> 'expense_context' OR subject_key ~ '^finance:transaction:[^:]+$'",
            name="ck_aa_finance_contexts_expense_subject",
        ),
        CheckConstraint(
            "kind <> 'self_check'"
            " OR subject_key ~ '^finance:period:[0-9]{4}-(0[1-9]|1[0-2])$'",
            name="ck_aa_finance_contexts_self_check_subject",
        ),
        UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_finance_contexts_idempotency_key"
        ),
        UniqueConstraint(
            "user_id", "entity_id", "version", name="uq_aa_finance_contexts_entity_version"
        ),
        Index(
            "uq_aa_finance_contexts_active_entity",
            "user_id",
            "entity_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        Index(
            "uq_aa_finance_contexts_active_subject",
            "user_id",
            "kind",
            "subject_key",
            unique=True,
            postgresql_where=text(
                "status = 'active' AND kind IN ('expense_context', 'self_check')"
            ),
        ),
        Index("ix_aa_finance_contexts_user_kind", "user_id", "kind", "status"),
    )


__all__ = ["AAFinanceContext"]
