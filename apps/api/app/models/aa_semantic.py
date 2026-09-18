"""Shared columns, never a shared row space for comparison concepts."""

from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, declared_attr, mapped_column

from app.analytics.enums import DesiredDirection, check_in
from app.analytics.values import value_check_sql
from app.models.mixins import (
    AAIdempotencyMixin,
    AAOwnedMixin,
    AAProvenanceMixin,
    AASubjectMixin,
    AASupersessionMixin,
    AAValueMixin,
    aa_integrity_constraints,
    aa_value_type_constraint,
)

EMPTY_VALUE = (
    "unit_code IS NULL AND value_num IS NULL AND value_date IS NULL "
    "AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL"
)


class SemanticFactMixin(
    AAOwnedMixin, AASubjectMixin, AAProvenanceMixin, AASupersessionMixin, AAIdempotencyMixin
):
    @declared_attr
    def metric_key(cls) -> Mapped[str | None]:  # noqa: N805
        return mapped_column(Text, ForeignKey("aa_metric_definitions.metric_key"), nullable=True)


class ValuedFactMixin(SemanticFactMixin, AAValueMixin):
    pass


class WindowMixin:
    window_start: Mapped[date] = mapped_column(Date, nullable=False)
    window_end: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(Text, nullable=False)


def fact_constraints(
    table: str,
    *,
    value: bool = True,
    window: bool = False,
    absent: bool = False,
    observation: bool = False,
):
    constraints = [
        *aa_integrity_constraints(table),
        Index(f"ix_{table}_user_subject_recorded", "user_id", "subject_key", "recorded_at"),
    ]
    if value:
        constraints.append(aa_value_type_constraint(table))
        special = "status = 'tombstoned'"
        if absent:
            special += " OR is_explicitly_absent"
        if observation:
            special += " OR value_availability = 'explicitly_unknown'"
        constraints.append(
            CheckConstraint(
                f"(({special}) AND {EMPTY_VALUE}) OR (NOT ({special}) AND ({value_check_sql()}))",
                name=f"ck_{table}_value_shape",
            )
        )
    if window:
        constraints.extend(
            [
                CheckConstraint("window_end >= window_start", name=f"ck_{table}_window_order"),
                CheckConstraint("timezone <> ''", name=f"ck_{table}_timezone"),
            ]
        )
    return tuple(constraints)


def direction_constraint(table: str):
    return CheckConstraint(
        f"(desired_direction IS NOT NULL AND {check_in('desired_direction', DesiredDirection)}) OR "
        "(status = 'tombstoned' AND desired_direction IS NULL)",
        name=f"ck_{table}_desired_direction",
    )
