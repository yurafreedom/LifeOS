"""Coverage derivation (correction C6).

Coverage is never "the number of rows found", and it is never inferred from the
presence of facts, because ``transaction presence != source completeness`` in
both directions: a day with zero transactions may be completely observed, and a
day with one transaction may be only partly observed.

A day is therefore ``observed`` only when an ``aa_source_coverage`` claim
supports it. Absence of a claim is neither ``observed`` nor ``missing`` — it is
``unknown_coverage``, which is the honest state. ``missing`` means a source
affirmatively said nothing happened.

Nothing in this module writes: it turns stored claims into a read-time report.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.analytics.enums import CoverageState, DayCoverage, DenominatorBasis

# Strength ordering: the strongest claim covering a day wins. A claim that
# cannot vouch for completeness never outranks one that can.
_CLAIM_RANK: dict[DayCoverage, int] = {
    DayCoverage.OBSERVED: 4,
    DayCoverage.PARTIAL: 3,
    DayCoverage.MISSING: 2,
    DayCoverage.UNKNOWN_COVERAGE: 1,
}


@dataclass(frozen=True, slots=True)
class CoverageClaim:
    """The shape :mod:`app.services.aa_coverage_claims` reads out of the table."""

    window_start_date: date
    window_end_date: date
    coverage_state: CoverageState
    completeness_known: bool


@dataclass(frozen=True, slots=True)
class CoverageReport:
    window_start: date
    window_end: date
    timezone: str
    denominator_basis: DenominatorBasis
    expected_denominator: int
    observed_count: int
    partial_count: int
    missing_count: int
    unknown_coverage_count: int
    future_count: int
    estimated_count: int
    corrected_count: int
    freshest_recorded_at: datetime | None
    has_legacy_imports: bool
    reason: str | None

    def __post_init__(self) -> None:
        counted = (
            self.observed_count
            + self.partial_count
            + self.missing_count
            + self.unknown_coverage_count
            + self.future_count
        )
        if counted != self.expected_denominator:
            raise ValueError(
                "coverage buckets must exhaust the denominator: "
                f"{counted} != {self.expected_denominator}"
            )


def classify_claim(claim: CoverageClaim) -> DayCoverage:
    """Map one claim onto what it lets us say about a day it covers."""
    if claim.coverage_state is CoverageState.COMPLETE and claim.completeness_known:
        return DayCoverage.OBSERVED
    if claim.coverage_state is CoverageState.PARTIAL:
        return DayCoverage.PARTIAL
    if claim.coverage_state is CoverageState.NONE and claim.completeness_known:
        return DayCoverage.MISSING
    return DayCoverage.UNKNOWN_COVERAGE


def _local_today(timezone: str, now: datetime) -> date:
    return now.astimezone(ZoneInfo(timezone)).date()


def classify_days(
    *,
    window_start: date,
    window_end: date,
    timezone: str,
    now: datetime,
    claims: Sequence[CoverageClaim],
) -> dict[date, DayCoverage]:
    """Resolve every local day in the window to exactly one classification."""
    today = _local_today(timezone, now)
    classification: dict[date, DayCoverage] = {}
    day = window_start
    while day <= window_end:
        if day > today:
            classification[day] = DayCoverage.FUTURE
        else:
            best = DayCoverage.UNKNOWN_COVERAGE
            for claim in claims:
                if claim.window_start_date <= day <= claim.window_end_date:
                    candidate = classify_claim(claim)
                    if _CLAIM_RANK[candidate] > _CLAIM_RANK[best]:
                        best = candidate
            classification[day] = best
        day += timedelta(days=1)
    return classification


def build_coverage_report(
    *,
    window_start: date,
    window_end: date,
    timezone: str,
    now: datetime,
    claims: Iterable[CoverageClaim],
    denominator_basis: DenominatorBasis = DenominatorBasis.CALENDAR_DAYS,
    estimated_count: int = 0,
    corrected_count: int = 0,
    freshest_recorded_at: datetime | None = None,
    has_legacy_imports: bool = False,
    reason: str | None = None,
) -> CoverageReport:
    if window_end < window_start:
        raise ValueError("window_end must not precede window_start")

    classification = classify_days(
        window_start=window_start,
        window_end=window_end,
        timezone=timezone,
        now=now,
        claims=tuple(claims),
    )
    tally = {state: 0 for state in DayCoverage}
    for state in classification.values():
        tally[state] += 1

    return CoverageReport(
        window_start=window_start,
        window_end=window_end,
        timezone=timezone,
        denominator_basis=denominator_basis,
        expected_denominator=len(classification),
        observed_count=tally[DayCoverage.OBSERVED],
        partial_count=tally[DayCoverage.PARTIAL],
        missing_count=tally[DayCoverage.MISSING],
        unknown_coverage_count=tally[DayCoverage.UNKNOWN_COVERAGE],
        future_count=tally[DayCoverage.FUTURE],
        estimated_count=estimated_count,
        corrected_count=corrected_count,
        freshest_recorded_at=freshest_recorded_at,
        has_legacy_imports=has_legacy_imports,
        reason=reason,
    )
