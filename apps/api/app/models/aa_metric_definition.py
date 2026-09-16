"""``aa_metric_definitions`` — the identity of what is measured.

The catalogue owns unit and value shape, how an Actual is obtained, and how a
window's denominator is counted. It deliberately has **no desirability column**:
whether a change is good or bad belongs to Target, Preference and Decision, and
a metric must never carry a sign of its own.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import (
    ActualSource,
    Aggregation,
    DenominatorBasis,
    ValueType,
    check_in,
)
from app.models.base import Base


class AAMetricDefinition(Base):
    __tablename__ = "aa_metric_definitions"
    __table_args__ = (
        CheckConstraint(
            check_in("value_type", ValueType), name="ck_aa_metric_definitions_value_type"
        ),
        CheckConstraint(
            check_in("aggregation", Aggregation), name="ck_aa_metric_definitions_aggregation"
        ),
        CheckConstraint(
            check_in("actual_source", ActualSource),
            name="ck_aa_metric_definitions_actual_source",
        ),
        CheckConstraint(
            f"coverage_basis IS NULL OR {check_in('coverage_basis', DenominatorBasis)}",
            name="ck_aa_metric_definitions_coverage_basis",
        ),
        CheckConstraint(
            "value_type <> 'money' OR unit_code IS NOT NULL",
            name="ck_aa_metric_definitions_money_unit",
        ),
        CheckConstraint(
            "actual_source <> 'derived' OR derivation IS NOT NULL",
            name="ck_aa_metric_definitions_derivation",
        ),
    )

    metric_key: Mapped[str] = mapped_column(Text, primary_key=True)
    domain: Mapped[str] = mapped_column(Text, nullable=False)
    subject_type: Mapped[str] = mapped_column(Text, nullable=False)
    subject_id_form: Mapped[str] = mapped_column(Text, nullable=False)
    value_type: Mapped[str] = mapped_column(Text, nullable=False)
    unit_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    aggregation: Mapped[str] = mapped_column(Text, nullable=False)
    actual_source: Mapped[str] = mapped_column(Text, nullable=False)
    coverage_basis: Mapped[str | None] = mapped_column(Text, nullable=True)
    derivation: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
