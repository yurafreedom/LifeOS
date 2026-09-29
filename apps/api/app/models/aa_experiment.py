"""Experiment — a first-class, user-authored test of a hypothesis (plan §24.9, D4).

State, not a fact (the ``aa_signal_episodes`` precedent): the row carries the
immutable claim (hypothesis, intervention, window, outcome definition) and the
lifecycle. Evidence lives elsewhere — adherence in ``aa_experiment_adherence``,
outcome/context values in ``aa_experiment_observations``, the baseline in
``aa_baselines``, conditions in ``aa_observations`` — and the decision in
``aa_decisions`` (experiment scope).

Lifecycle and outcome are orthogonal. Every state is entered at most once, so
each has its own instant + idempotency-key pair; the row-shape CHECKs make
every illegal *path* unrepresentable (REVIEWED without completion, ABANDONED
and REVIEWED, ABANDONED from RUNNING without a start). Rewriting one legal
shape into another is prevented by the service's compare-and-set, not by a
trigger.

``id`` is minted by the client (UUID v4) so queued child writes can address the
experiment before its create is acknowledged.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, Index, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import ExperimentLifecycle, ExperimentOutcomeType, check_in
from app.models.base import Base
from app.models.mixins import VALUE_NUMERIC, AAOwnedMixin

ABANDONABLE = "('DRAFT', 'RUNNING', 'COMPLETED_AWAITING_REVIEW')"


class AAExperiment(AAOwnedMixin, Base):
    __tablename__ = "aa_experiments"

    title: Mapped[str] = mapped_column(Text, nullable=False)
    hypothesis: Mapped[str] = mapped_column(Text, nullable=False)
    hypothesis_recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    intervention: Mapped[str] = mapped_column(Text, nullable=False)
    window_start: Mapped[date] = mapped_column(Date, nullable=False)
    window_end: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(Text, nullable=False)
    outcome_label: Mapped[str] = mapped_column(Text, nullable=False)
    outcome_value_type: Mapped[str] = mapped_column(Text, nullable=False)
    outcome_unit_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome_scale_min: Mapped[Decimal | None] = mapped_column(VALUE_NUMERIC, nullable=True)
    outcome_scale_max: Mapped[Decimal | None] = mapped_column(VALUE_NUMERIC, nullable=True)
    lifecycle: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'DRAFT'"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    start_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    complete_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    abandoned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    abandon_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    abandoned_from: Mapped[str | None] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "btrim(title) <> '' AND char_length(title) <= 200", name="ck_aa_experiments_title"
        ),
        CheckConstraint(
            "btrim(hypothesis) <> '' AND char_length(hypothesis) <= 1000",
            name="ck_aa_experiments_hypothesis",
        ),
        CheckConstraint(
            "btrim(intervention) <> '' AND char_length(intervention) <= 1000",
            name="ck_aa_experiments_intervention",
        ),
        CheckConstraint("window_end >= window_start", name="ck_aa_experiments_window_order"),
        CheckConstraint("window_end - window_start <= 365", name="ck_aa_experiments_window_length"),
        CheckConstraint("timezone <> ''", name="ck_aa_experiments_timezone"),
        CheckConstraint(
            "btrim(outcome_label) <> '' AND char_length(outcome_label) <= 200",
            name="ck_aa_experiments_outcome_label",
        ),
        CheckConstraint(
            check_in("outcome_value_type", ExperimentOutcomeType),
            name="ck_aa_experiments_outcome_value_type",
        ),
        CheckConstraint(
            "CASE outcome_value_type"
            " WHEN 'money' THEN outcome_unit_code ~ '^[A-Z]{3}$'"
            " AND outcome_scale_min IS NULL AND outcome_scale_max IS NULL"
            " WHEN 'duration' THEN outcome_unit_code = 'minute'"
            " AND outcome_scale_min IS NULL AND outcome_scale_max IS NULL"
            " WHEN 'count' THEN outcome_unit_code IS NULL"
            " AND outcome_scale_min IS NULL AND outcome_scale_max IS NULL"
            " WHEN 'scale' THEN outcome_unit_code IS NULL"
            " AND outcome_scale_min IS NOT NULL AND outcome_scale_max IS NOT NULL"
            " AND outcome_scale_min < outcome_scale_max"
            " ELSE false END",
            name="ck_aa_experiments_outcome_shape",
        ),
        CheckConstraint(
            check_in("lifecycle", ExperimentLifecycle), name="ck_aa_experiments_lifecycle"
        ),
        CheckConstraint(
            "CASE lifecycle"
            " WHEN 'DRAFT' THEN started_at IS NULL AND completed_at IS NULL"
            " AND reviewed_at IS NULL AND abandoned_at IS NULL"
            " WHEN 'RUNNING' THEN started_at IS NOT NULL AND completed_at IS NULL"
            " AND reviewed_at IS NULL AND abandoned_at IS NULL"
            " WHEN 'COMPLETED_AWAITING_REVIEW' THEN started_at IS NOT NULL"
            " AND completed_at IS NOT NULL AND reviewed_at IS NULL AND abandoned_at IS NULL"
            " WHEN 'REVIEWED' THEN started_at IS NOT NULL AND completed_at IS NOT NULL"
            " AND reviewed_at IS NOT NULL AND abandoned_at IS NULL"
            " WHEN 'ABANDONED' THEN abandoned_at IS NOT NULL AND reviewed_at IS NULL"
            " ELSE false END",
            name="ck_aa_experiments_lifecycle_shape",
        ),
        CheckConstraint(
            f"abandoned_from IS NULL OR abandoned_from IN {ABANDONABLE}",
            name="ck_aa_experiments_abandoned_from",
        ),
        CheckConstraint(
            "abandoned_from IS NULL"
            " OR (abandoned_from = 'DRAFT' AND started_at IS NULL AND completed_at IS NULL)"
            " OR (abandoned_from = 'RUNNING' AND started_at IS NOT NULL AND completed_at IS NULL)"
            " OR (abandoned_from = 'COMPLETED_AWAITING_REVIEW' AND started_at IS NOT NULL"
            " AND completed_at IS NOT NULL)",
            name="ck_aa_experiments_abandon_shape",
        ),
        CheckConstraint(
            "(started_at IS NULL) = (start_key IS NULL)", name="ck_aa_experiments_start_pair"
        ),
        CheckConstraint(
            "(completed_at IS NULL) = (complete_key IS NULL)",
            name="ck_aa_experiments_complete_pair",
        ),
        CheckConstraint(
            "(reviewed_at IS NULL) = (review_key IS NULL)", name="ck_aa_experiments_review_pair"
        ),
        CheckConstraint(
            "(abandoned_at IS NULL) = (abandon_key IS NULL)"
            " AND (abandoned_at IS NULL) = (abandoned_from IS NULL)",
            name="ck_aa_experiments_abandon_pair",
        ),
        CheckConstraint(
            "(started_at IS NULL OR started_at >= hypothesis_recorded_at)"
            " AND (completed_at IS NULL OR completed_at >= started_at)"
            " AND (reviewed_at IS NULL OR reviewed_at >= completed_at)"
            " AND (abandoned_at IS NULL"
            " OR abandoned_at >= COALESCE(completed_at, started_at, hypothesis_recorded_at))",
            name="ck_aa_experiments_instant_order",
        ),
        UniqueConstraint("user_id", "idempotency_key", name="uq_aa_experiments_idempotency_key"),
        UniqueConstraint("user_id", "start_key", name="uq_aa_experiments_start_key"),
        UniqueConstraint("user_id", "complete_key", name="uq_aa_experiments_complete_key"),
        UniqueConstraint("user_id", "review_key", name="uq_aa_experiments_review_key"),
        UniqueConstraint("user_id", "abandon_key", name="uq_aa_experiments_abandon_key"),
        Index("ix_aa_experiments_user_lifecycle", "user_id", "lifecycle"),
        Index("ix_aa_experiments_user_created", "user_id", "created_at"),
    )


__all__ = ["AAExperiment"]
