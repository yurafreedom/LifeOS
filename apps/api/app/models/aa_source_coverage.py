"""``aa_source_coverage`` — what a source declares it covered (correction C6).

This table exists because coverage cannot be inferred from facts. A complete
zero-spend day carries no transaction, and an interrupted import may still
carry several — so "28 из 31 дня" has to rest on evidence about the source, not
on counting rows.

A coverage claim is an ordinary fact: it carries provenance, it can be corrected
or superseded by a wider re-import rather than overwritten, and it is owned by
the account like everything else.
"""

from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import CoverageState, check_in
from app.models.base import Base
from app.models.mixins import (
    AAIdempotencyMixin,
    AAOwnedMixin,
    AAProvenanceMixin,
    AASubjectMixin,
    AASupersessionMixin,
    aa_integrity_constraints,
)

_TABLE = "aa_source_coverage"


class AASourceCoverage(
    AAOwnedMixin,
    AASubjectMixin,
    AAProvenanceMixin,
    AASupersessionMixin,
    AAIdempotencyMixin,
    Base,
):
    __tablename__ = _TABLE
    __table_args__ = (
        *aa_integrity_constraints(_TABLE),
        CheckConstraint(
            check_in("coverage_state", CoverageState), name=f"ck_{_TABLE}_coverage_state"
        ),
        CheckConstraint("window_end_date >= window_start_date", name=f"ck_{_TABLE}_window_order"),
        CheckConstraint("timezone <> ''", name=f"ck_{_TABLE}_timezone"),
        CheckConstraint("source_id <> ''", name=f"ck_{_TABLE}_source_id"),
        # A source that cannot say what it covered cannot also vouch for
        # completeness; 'unknown' and completeness_known are mutually exclusive.
        CheckConstraint(
            "NOT completeness_known OR coverage_state <> 'unknown'",
            name=f"ck_{_TABLE}_unknown_not_known",
        ),
        # Only a partial claim quantifies how much it covered, and it must
        # quantify both sides of the fraction.
        CheckConstraint(
            "(coverage_state = 'partial') = (observed_units IS NOT NULL"
            " AND expected_units IS NOT NULL)",
            name=f"ck_{_TABLE}_partial_units",
        ),
        CheckConstraint(
            "observed_units IS NULL OR (observed_units >= 0 AND observed_units <= expected_units)",
            name=f"ck_{_TABLE}_units_range",
        ),
        Index(
            f"ix_{_TABLE}_active_user_subject_window",
            "user_id",
            "subject_key",
            "window_start_date",
            "window_end_date",
            postgresql_where=text("status = 'active'"),
        ),
    )

    source_id: Mapped[str] = mapped_column(Text, nullable=False)
    metric_key: Mapped[str | None] = mapped_column(
        Text, ForeignKey("aa_metric_definitions.metric_key"), nullable=True
    )
    window_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    window_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(Text, nullable=False)
    coverage_state: Mapped[str] = mapped_column(Text, nullable=False)
    completeness_known: Mapped[bool] = mapped_column(nullable=False)
    observed_units: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expected_units: Mapped[int | None] = mapped_column(Integer, nullable=True)
