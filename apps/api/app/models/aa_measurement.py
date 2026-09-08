"""``aa_measurements`` — timestamped objective observations (Actual).

Bitemporal by construction: ``occurred_at`` is when the observation happened,
``recorded_at`` is when LifeOS learned it, and neither is ``created_at``.
``occurred_tz`` travels with ``occurred_at`` because coverage is counted in
local days, so a day boundary must follow the user's zone.

A measurement is never updated in place. A correction inserts a replacement and
marks the original superseded, so the original stays discoverable and an as-of
read before the correction still returns it.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import (
    AAIdempotencyMixin,
    AAOwnedMixin,
    AAProvenanceMixin,
    AASubjectMixin,
    AASupersessionMixin,
    AAValueMixin,
    aa_integrity_constraints,
    aa_value_constraint,
    aa_value_type_constraint,
)

_TABLE = "aa_measurements"


class AAMeasurement(
    AAOwnedMixin,
    AASubjectMixin,
    AAValueMixin,
    AAProvenanceMixin,
    AASupersessionMixin,
    AAIdempotencyMixin,
    Base,
):
    __tablename__ = _TABLE
    __table_args__ = (
        *aa_integrity_constraints(_TABLE),
        aa_value_type_constraint(_TABLE),
        aa_value_constraint(_TABLE),
        CheckConstraint("occurred_tz <> ''", name=f"ck_{_TABLE}_occurred_tz"),
        Index(
            f"ix_{_TABLE}_user_subject_occurred_at",
            "user_id",
            "subject_key",
            text("occurred_at DESC"),
        ),
        Index(
            f"ix_{_TABLE}_user_metric_occurred_at",
            "user_id",
            "metric_key",
            text("occurred_at DESC"),
        ),
        Index(
            f"ix_{_TABLE}_active_user_subject_occurred_at",
            "user_id",
            "subject_key",
            "occurred_at",
            postgresql_where=text("status = 'active'"),
        ),
    )

    metric_key: Mapped[str] = mapped_column(
        Text, ForeignKey("aa_metric_definitions.metric_key"), nullable=False
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    occurred_tz: Mapped[str] = mapped_column(Text, nullable=False)
