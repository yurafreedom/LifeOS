"""Shared column template for Adaptive Analytics tables.

Every account-owned AA row carries the same identity, ownership, provenance,
supersession and idempotency columns. Expressing them once as mixins — and the
matching constraints once as :func:`aa_integrity_constraints` — is what makes it
impossible for one table to quietly acquire weaker integrity rules than another.

Provenance is stored inline rather than in a join table: it is rendered on
nearly every analytical row, is never queried independently, and is never shared
between facts.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column

from app.analytics.enums import FactStatus, SourceKind, SupersedeKind, ValueType, check_in
from app.analytics.values import value_check_sql

VALUE_NUMERIC = Numeric(20, 6)


class AAOwnedMixin:
    """UUID identity, account ownership with cascade, and a storage timestamp.

    ``created_at`` is a storage fact only. It is never used as a semantic
    timestamp — ``occurred_at`` and ``recorded_at`` carry those meanings.
    """

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    @declared_attr
    def user_id(cls) -> Mapped[uuid.UUID]:  # noqa: N805
        return mapped_column(
            UUID(as_uuid=True),
            ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AASubjectMixin:
    """The generic typed subject triple, plus its generated key."""

    subject_domain: Mapped[str] = mapped_column(Text, nullable=False)
    subject_type: Mapped[str] = mapped_column(Text, nullable=False)
    subject_id: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    subject_key: Mapped[str] = mapped_column(
        Text,
        Computed("subject_domain || ':' || subject_type || ':' || subject_id", persisted=True),
        nullable=False,
    )


class AAValueMixin:
    """The discriminated value.

    There is no availability column here: an objective observation either
    happened or did not. ``dimensions`` is written once, at record time, and is
    never updated — later policy must be evaluable without re-reading mutable
    current state.
    """

    value_type: Mapped[str] = mapped_column(Text, nullable=False)
    unit_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_num: Mapped[Decimal | None] = mapped_column(VALUE_NUMERIC, nullable=True)
    value_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    scale_min: Mapped[Decimal | None] = mapped_column(VALUE_NUMERIC, nullable=True)
    scale_max: Mapped[Decimal | None] = mapped_column(VALUE_NUMERIC, nullable=True)
    dimensions: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)


class AAProvenanceMixin:
    """The accepted four-row provenance grammar: источник · основание · когда · как.

    ``recorded_at`` is NOT NULL and always means *when LifeOS learned the fact*.
    Historical uncertainty about an imported record is expressed by
    ``original_recorded_at_known = false``, never by inventing a timestamp.
    """

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    source_kind: Mapped[str] = mapped_column(Text, nullable=False)
    basis: Mapped[str | None] = mapped_column(Text, nullable=True)
    method: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_ref: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    original_recorded_at_known: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )


class AASupersessionMixin:
    """Correction and revision history. Values are never updated in place."""

    @declared_attr
    def supersedes_id(cls) -> Mapped[uuid.UUID | None]:  # noqa: N805
        return mapped_column(
            UUID(as_uuid=True),
            ForeignKey(f"{cls.__tablename__}.id"),
            nullable=True,
        )

    @declared_attr
    def superseded_by_id(cls) -> Mapped[uuid.UUID | None]:  # noqa: N805
        return mapped_column(
            UUID(as_uuid=True),
            ForeignKey(f"{cls.__tablename__}.id"),
            nullable=True,
        )

    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    supersede_kind: Mapped[str | None] = mapped_column(Text, nullable=True)
    supersede_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'active'"))
    tombstoned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AAIdempotencyMixin:
    """Retry safety. The key is minted by the writer, before the first attempt."""

    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)


def aa_integrity_constraints(table: str) -> tuple[Any, ...]:
    """Integrity rules every account-owned AA table shares.

    Notably ``uq_{table}_supersedes_id`` — a row can have at most one successor,
    so a double correction cannot fork history into two live branches.
    """
    return (
        CheckConstraint(check_in("source_kind", SourceKind), name=f"ck_{table}_source_kind"),
        CheckConstraint(check_in("status", FactStatus), name=f"ck_{table}_status"),
        CheckConstraint(
            f"supersede_kind IS NULL OR {check_in('supersede_kind', SupersedeKind)}",
            name=f"ck_{table}_supersede_kind",
        ),
        CheckConstraint(
            "status <> 'superseded' OR superseded_by_id IS NOT NULL",
            name=f"ck_{table}_superseded_has_successor",
        ),
        CheckConstraint(
            "status <> 'superseded' OR superseded_at IS NOT NULL",
            name=f"ck_{table}_superseded_has_timestamp",
        ),
        CheckConstraint(
            "status <> 'active' OR (superseded_at IS NULL AND superseded_by_id IS NULL)",
            name=f"ck_{table}_active_not_superseded",
        ),
        CheckConstraint(
            "status <> 'tombstoned' OR tombstoned_at IS NOT NULL",
            name=f"ck_{table}_tombstoned_has_timestamp",
        ),
        CheckConstraint("supersedes_id <> id", name=f"ck_{table}_no_self_supersedes"),
        CheckConstraint("superseded_by_id <> id", name=f"ck_{table}_no_self_successor"),
        CheckConstraint(
            "original_recorded_at_known OR source_kind = 'IMPORTED'",
            name=f"ck_{table}_recorded_at_known",
        ),
        UniqueConstraint("user_id", "idempotency_key", name=f"uq_{table}_idempotency_key"),
        UniqueConstraint("supersedes_id", name=f"uq_{table}_supersedes_id"),
        Index(f"ix_{table}_user_recorded_at", "user_id", text("recorded_at DESC")),
    )


def aa_value_constraint(table: str) -> CheckConstraint:
    """The per-``value_type`` legality constraint, rendered from the contract."""
    return CheckConstraint(value_check_sql(), name=f"ck_{table}_value_shape")


def aa_value_type_constraint(table: str) -> CheckConstraint:
    return CheckConstraint(check_in("value_type", ValueType), name=f"ck_{table}_value_type")
