"""AA history retention (Slice 8): the user's intent and one audit row per Apply.

``aa_retention_policies`` is append-only intent. No row means UNLIMITED — the
default. A finite policy only *allows* deletion; it deletes nothing by itself.
Changing it appends a version and retires the previous one, so the history of
what the user chose, and when, is kept.

``aa_retention_runs`` is the durable, run-level audit (owner decision O4): one
row per explicit Apply, never one row per deleted fact. It carries counts,
the horizon and the preview fingerprint — never a deleted value. Only
``pruned_units`` names identities (the Project subjects erased as whole units),
exactly as ``aa_deletion_receipts`` names a fact id, so Project Analytics can say
"history deleted by retention" instead of "nothing was ever recorded".

Neither table is ever age-pruned: they are what makes the loss visible. The
effective historical-completeness horizon is the latest horizon among
*completed* runs — a policy switched back to UNLIMITED never restores it.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Date,
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

from app.analytics.enums import (
    RETENTION_MONTHS,
    RetentionMode,
    RetentionPolicyStatus,
    RetentionRunStatus,
    check_in,
)
from app.models.base import Base
from app.models.mixins import AAOwnedMixin

_MONTHS = ", ".join(str(months) for months in RETENTION_MONTHS)
COUNT_COLUMNS: tuple[str, ...] = (
    "total_deleted",
    "chain_count",
    "project_unit_count",
    "review_redaction_count",
    "system_review_redaction_count",
    "relation_redaction_count",
    "importance_redaction_count",
    "provenance_redaction_count",
    "signal_episode_count",
)
JSON_COLUMNS: tuple[str, ...] = (
    "table_counts",
    "unit_counts",
    "skipped",
    "pruned_units",
    "progress",
)


class AARetentionPolicy(AAOwnedMixin, Base):
    __tablename__ = "aa_retention_policies"

    mode: Mapped[str] = mapped_column(Text, nullable=False)
    retain_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    consequences_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    supersedes_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_retention_policies.id"), nullable=True
    )
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint(check_in("mode", RetentionMode), name="ck_aa_retention_policies_mode"),
        CheckConstraint(
            "(mode = 'unlimited') = (retain_months IS NULL)",
            name="ck_aa_retention_policies_months_pair",
        ),
        CheckConstraint(
            f"retain_months IS NULL OR retain_months IN ({_MONTHS})",
            name="ck_aa_retention_policies_months",
        ),
        CheckConstraint(
            "mode = 'unlimited' OR (consequences_version IS NOT NULL AND confirmed_at IS NOT NULL)",
            name="ck_aa_retention_policies_confirmed",
        ),
        CheckConstraint(
            check_in("status", RetentionPolicyStatus), name="ck_aa_retention_policies_status"
        ),
        CheckConstraint(
            "(status = 'active') = (superseded_at IS NULL)",
            name="ck_aa_retention_policies_superseded_pair",
        ),
        CheckConstraint("supersedes_id <> id", name="ck_aa_retention_policies_no_self"),
        UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_retention_policies_idempotency_key"
        ),
        Index(
            "uq_aa_retention_policies_active",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


class AARetentionRun(AAOwnedMixin, Base):
    __tablename__ = "aa_retention_runs"

    policy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_retention_policies.id"), nullable=False
    )
    retain_months: Mapped[int] = mapped_column(Integer, nullable=False)
    target_horizon_date: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(Text, nullable=False)
    engine_version: Mapped[int] = mapped_column(Integer, nullable=False)
    preview_fingerprint: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_deleted: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    chain_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    project_unit_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    review_redaction_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    system_review_redaction_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    relation_redaction_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    importance_redaction_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    provenance_redaction_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    signal_episode_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    table_counts: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    unit_counts: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    skipped: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    pruned_units: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    progress: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint(
            check_in("status", RetentionRunStatus), name="ck_aa_retention_runs_status"
        ),
        CheckConstraint(
            f"retain_months IN ({_MONTHS})", name="ck_aa_retention_runs_months"
        ),
        CheckConstraint("timezone <> ''", name="ck_aa_retention_runs_timezone"),
        CheckConstraint("engine_version >= 1", name="ck_aa_retention_runs_engine_version"),
        CheckConstraint(
            "preview_fingerprint ~ '^[0-9a-f]{64}$'", name="ck_aa_retention_runs_fingerprint"
        ),
        CheckConstraint(
            "(status = 'completed') = (completed_at IS NOT NULL)",
            name="ck_aa_retention_runs_completed_pair",
        ),
        CheckConstraint(
            "(status = 'failed') = (failed_at IS NOT NULL)"
            " AND (status = 'failed') = (failure_code IS NOT NULL)",
            name="ck_aa_retention_runs_failed_pair",
        ),
        # A failed run is atomic: it never claims a deletion it rolled back.
        CheckConstraint(
            "status <> 'failed' OR total_deleted = 0", name="ck_aa_retention_runs_failed_empty"
        ),
        CheckConstraint(
            " AND ".join(f"{column} >= 0" for column in COUNT_COLUMNS),
            name="ck_aa_retention_runs_counts",
        ),
        CheckConstraint(
            " AND ".join(f"jsonb_typeof({column}) = 'object'" for column in JSON_COLUMNS),
            name="ck_aa_retention_runs_json",
        ),
        UniqueConstraint("user_id", "idempotency_key", name="uq_aa_retention_runs_idempotency_key"),
        Index(
            "ix_aa_retention_runs_user_status_horizon",
            "user_id",
            "status",
            "target_horizon_date",
        ),
    )


__all__ = ["AARetentionPolicy", "AARetentionRun"]
