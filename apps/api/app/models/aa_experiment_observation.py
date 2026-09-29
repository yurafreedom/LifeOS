"""Experiment observations — measurements taken for an experiment, not conclusions.

The shared valued-fact template (plan §7.1), pinned to the experiment subject.
``outcome`` rows are values of the experiment's own outcome definition (the
service enforces the match: type, unit, scale); ``context`` rows are anything
else the user measured alongside. ``metric_key`` is always NULL — there are no
catalogued experiment metrics and none is invented.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import ExperimentObservationRole, ExperimentOutcomeType, check_in
from app.models.aa_semantic import ValuedFactMixin, fact_constraints
from app.models.base import Base


class AAExperimentObservation(ValuedFactMixin, Base):
    __tablename__ = "aa_experiment_observations"

    experiment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_experiments.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    occurred_tz: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        *fact_constraints(__tablename__),
        CheckConstraint(
            check_in("role", ExperimentObservationRole),
            name="ck_aa_experiment_observations_role",
        ),
        CheckConstraint(
            "btrim(label) <> '' AND char_length(label) <= 200",
            name="ck_aa_experiment_observations_label",
        ),
        CheckConstraint("occurred_tz <> ''", name="ck_aa_experiment_observations_occurred_tz"),
        CheckConstraint(
            "subject_domain = 'experiment' AND subject_type = 'experiment'"
            " AND subject_id = experiment_id::text",
            name="ck_aa_experiment_observations_subject",
        ),
        CheckConstraint("metric_key IS NULL", name="ck_aa_experiment_observations_metric_key"),
        CheckConstraint(
            f"role <> 'outcome' OR {check_in('value_type', ExperimentOutcomeType)}",
            name="ck_aa_experiment_observations_outcome_comparable",
        ),
        Index(
            "ix_aa_experiment_observations_experiment", "experiment_id", "role", "occurred_at"
        ),
    )


__all__ = ["AAExperimentObservation"]
