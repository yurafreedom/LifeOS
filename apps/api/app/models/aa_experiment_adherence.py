"""Experiment adherence — one user-reported state per elapsed local day.

Stored states are ``kept | missed | unknown`` only. ``future``,
``not_recorded`` and ``not_run_after_stop`` are derived at read time and have
no member here, so a future day can never be stored — let alone as a miss.

At most one *active* row per ``(experiment, day)``. Changing a day appends a
CORRECTION successor (the earlier answer was wrong), never a REVISION and never
an in-place update. There are no value or subject columns: the day and the
state are the whole fact.
"""

import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import AdherenceState, check_in
from app.models.base import Base
from app.models.mixins import (
    AAIdempotencyMixin,
    AAOwnedMixin,
    AAProvenanceMixin,
    AASupersessionMixin,
    aa_integrity_constraints,
)


class AAExperimentAdherence(
    AAOwnedMixin, AAProvenanceMixin, AASupersessionMixin, AAIdempotencyMixin, Base
):
    __tablename__ = "aa_experiment_adherence"

    experiment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_experiments.id", ondelete="CASCADE"), nullable=False
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)
    state: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        *aa_integrity_constraints(__tablename__),
        CheckConstraint(check_in("state", AdherenceState), name="ck_aa_experiment_adherence_state"),
        CheckConstraint(
            "supersede_kind IS NULL OR supersede_kind = 'CORRECTION'",
            name="ck_aa_experiment_adherence_correction_only",
        ),
        Index(
            "uq_aa_experiment_adherence_active_day",
            "experiment_id",
            "day",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        Index("ix_aa_experiment_adherence_experiment_day", "experiment_id", "day"),
    )


__all__ = ["AAExperimentAdherence"]
