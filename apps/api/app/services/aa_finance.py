"""Finance monthly-spend derivation over immutable AA facts only."""

import calendar
from collections import defaultdict
from dataclasses import asdict, dataclass, replace
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.analytics.asof import apply_as_of
from app.analytics.delta import DeltaUnknown, compute_delta
from app.analytics.enums import ValueType
from app.analytics.subjects import SubjectRef
from app.analytics.values import FactValue
from app.models import AAExpectationVersion, AAMeasurement, AATarget
from app.schemas.aa_common import ValueOut
from app.schemas.aa_comparison import DerivedDeltaOut, SemanticOut
from app.schemas.aa_finance import FinanceMonthOut, FinancePointOut
from app.schemas.aa_measurement import CoverageReportOut
from app.services.aa_coverage_claims import coverage_report_for_window
from app.services.aa_desirability import NormativeGrounding, desirability
from app.services.aa_metric_policy import membership_as_of
from app.services.retention.horizon import effective_horizon

TRANSACTION_METRIC = "finance.transaction_amount"
MONTHLY_METRIC = "finance.monthly_spend"


def _month(period: str, timezone: str):
    try:
        year, month = (int(part) for part in period.split("-"))
        last = calendar.monthrange(year, month)[1]
    except (ValueError, TypeError):
        raise ValueError("period must be YYYY-MM") from None
    zone = ZoneInfo(timezone)
    start_date, end_date = date(year, month, 1), date(year, month, last)
    start = datetime.combine(start_date, time.min, zone)
    end = datetime.combine(end_date + timedelta(days=1), time.min, zone)
    return start_date, end_date, start, end


def _semantic_versions(db, *, model, user_id, subject_key, as_of):
    query = select(model).where(
        model.user_id == user_id,
        model.subject_key == subject_key,
        model.metric_key == MONTHLY_METRIC,
        model.recorded_at <= as_of,
    )
    return list(db.scalars(query.order_by(model.recorded_at, model.id)))


def _current_semantic(db, *, model, user_id, subject_key, as_of):
    query = select(model).where(
        model.user_id == user_id,
        model.subject_key == subject_key,
        model.metric_key == MONTHLY_METRIC,
    )
    if hasattr(model, "effective_from"):
        query = query.where(model.effective_from <= as_of)
    return db.scalar(
        apply_as_of(query, model, as_of)
        .order_by(model.recorded_at.desc(), model.id.desc())
        .limit(1)
    )


@dataclass(frozen=True, slots=True)
class MonthlySpendInputs:
    """The exact rows one monthly-spend derivation read.

    Both the Finance surface and the finance threshold signal rule read the
    period through this function, so a signal can never disagree with the number
    the user is looking at. ``input_version_ids`` is what the signal fingerprint
    is taken over: every included measurement row plus every policy/override
    version that decided inclusion.
    """

    period: str
    subject: SubjectRef
    timezone: str
    window_start: date
    window_end: date
    occurred_from: datetime
    occurred_to: datetime
    as_of: datetime
    rows: tuple[AAMeasurement, ...]
    total: Decimal
    included_count: int
    excluded_count: int
    unknown_membership_count: int
    policy_known: bool
    daily: dict[date, Decimal]
    input_version_ids: tuple[str, ...]
    source_kinds: tuple[str, ...]
    newest_recorded_at: datetime | None


def monthly_spend_inputs(
    db, *, user_id, period: str, timezone: str, as_of=None
) -> MonthlySpendInputs:
    """Sum the period's active, included transaction facts — nothing else.

    Historical inclusion is resolved through the versioned C7 policy as of the
    evaluation instant, never from current snapshot category settings.
    """
    start_date, end_date, start, end = _month(period, timezone)
    at = as_of or datetime.now(UTC)
    if at.tzinfo is None:
        raise ValueError("as_of requires an offset")
    subject = SubjectRef("finance", "period", period)
    query = select(AAMeasurement).where(
        AAMeasurement.user_id == user_id,
        AAMeasurement.metric_key == TRANSACTION_METRIC,
        AAMeasurement.subject_domain == "finance",
        AAMeasurement.subject_type == "transaction",
        AAMeasurement.occurred_at >= start,
        AAMeasurement.occurred_at < end,
    )
    rows = list(db.scalars(apply_as_of(query, AAMeasurement, as_of)))
    total = Decimal("0")
    included = excluded = unknown = 0
    policy_known = True
    daily: dict[date, Decimal] = defaultdict(lambda: Decimal("0"))
    version_ids: set[str] = set()
    source_kinds: set[str] = set()
    newest_recorded_at: datetime | None = None
    for row in rows:
        if row.value_type != ValueType.MONEY or row.unit_code != "UAH":
            continue
        membership = membership_as_of(
            db,
            user_id=user_id,
            metric_key=MONTHLY_METRIC,
            fact_id=row.id,
            as_of=at,
        )
        policy_known = policy_known and membership.policy_known
        if membership.version_id is not None:
            version_ids.add(membership.version_id)
        if membership.included is True:
            amount = row.value_num or Decimal("0")
            total += amount
            included += 1
            daily[row.occurred_at.astimezone(ZoneInfo(timezone)).date()] += amount
            version_ids.add(str(row.id))
            source_kinds.add(str(row.source_kind))
            if newest_recorded_at is None or row.recorded_at > newest_recorded_at:
                newest_recorded_at = row.recorded_at
        elif membership.included is False:
            excluded += 1
        else:
            unknown += 1
    return MonthlySpendInputs(
        period=period,
        subject=subject,
        timezone=timezone,
        window_start=start_date,
        window_end=end_date,
        occurred_from=start,
        occurred_to=end,
        as_of=at,
        rows=tuple(rows),
        total=total,
        included_count=included,
        excluded_count=excluded,
        unknown_membership_count=unknown,
        policy_known=policy_known,
        daily=dict(daily),
        input_version_ids=tuple(sorted(version_ids)),
        source_kinds=tuple(sorted(source_kinds)),
        newest_recorded_at=newest_recorded_at,
    )


def derive_month(db, *, user_id, period: str, timezone: str, as_of=None) -> FinanceMonthOut:
    derived = monthly_spend_inputs(
        db, user_id=user_id, period=period, timezone=timezone, as_of=as_of
    )
    start_date, end_date = derived.window_start, derived.window_end
    start, end = derived.occurred_from, derived.occurred_to
    at = derived.as_of
    subject = derived.subject
    rows = list(derived.rows)
    total = derived.total
    included, excluded, unknown = (
        derived.included_count,
        derived.excluded_count,
        derived.unknown_membership_count,
    )
    policy_known = derived.policy_known
    daily = derived.daily

    expectations = _semantic_versions(
        db, model=AAExpectationVersion, user_id=user_id, subject_key=subject.subject_key, as_of=at
    )
    targets = _semantic_versions(
        db, model=AATarget, user_id=user_id, subject_key=subject.subject_key, as_of=at
    )
    current_expectation = _current_semantic(
        db,
        model=AAExpectationVersion,
        user_id=user_id,
        subject_key=subject.subject_key,
        as_of=at,
    )
    current_target = _current_semantic(
        db,
        model=AATarget,
        user_id=user_id,
        subject_key=subject.subject_key,
        as_of=at,
    )
    known_value = ValueOut(type="money", unit_code="UAH", num=total)
    actual = known_value if unknown == 0 and rows else None
    availability = "insufficient_data" if unknown else ("present" if rows else "no_data")
    # F4 (Slice 8): a month that starts before an applied retention horizon lost
    # its evidence to the user's rule. Whatever survives (a late explicit write)
    # is never presented as the month: no actual, no subtotal, never zero.
    horizon = effective_horizon(db, user_id=user_id)
    truncated = horizon is not None and horizon.truncates_instant(start)
    if truncated:
        availability = "retention_truncated"
        actual = None
    reference = None
    if current_expectation is not None:
        reference = FactValue(
            value_type=ValueType(current_expectation.value_type),
            unit_code=current_expectation.unit_code,
            value_num=current_expectation.value_num,
        )
    actual_fact_value = (
        FactValue(value_type=ValueType.MONEY, unit_code="UAH", value_num=total)
        if actual is not None
        else None
    )
    result = compute_delta(actual_fact_value, reference)
    delta = (
        DerivedDeltaOut(state="unknown", reason="retention_truncated")
        if truncated
        else DerivedDeltaOut(state="unknown", reason=result.reason)
        if isinstance(result, DeltaUnknown)
        else DerivedDeltaOut(
            state="known", type=result.value_type, num=result.value_num, unit_code=result.unit_code
        )
    )
    coverage = coverage_report_for_window(
        db,
        user_id=user_id,
        subject_key=subject.subject_key,
        window_start=start_date,
        window_end=end_date,
        timezone=timezone,
        now=at,
        as_of=as_of,
    )
    history_rows = list(
        db.scalars(
            select(AAMeasurement).where(
                AAMeasurement.user_id == user_id,
                AAMeasurement.metric_key == TRANSACTION_METRIC,
                AAMeasurement.occurred_at >= start,
                AAMeasurement.occurred_at < end,
                AAMeasurement.recorded_at <= at,
                AAMeasurement.status != "tombstoned",
            )
        )
    )
    coverage = replace(
        coverage,
        has_legacy_imports=any(row.source_kind == "IMPORTED" for row in history_rows),
        corrected_count=sum(
            row.supersede_kind == "CORRECTION"
            and row.superseded_at is not None
            and row.superseded_at <= at
            for row in history_rows
        ),
        freshest_recorded_at=max(
            (row.recorded_at for row in history_rows), default=coverage.freshest_recorded_at
        ),
    )
    grounding = None
    if current_target is not None and not current_target.is_explicitly_absent:
        grounding = NormativeGrounding(
            "target",
            current_target.desired_direction,
            FactValue(
                value_type=ValueType(current_target.value_type),
                unit_code=current_target.unit_code,
                value_num=current_target.value_num,
            ),
            str(current_target.id),
        )
    return FinanceMonthOut(
        period=period,
        subject_key=subject.subject_key,
        timezone=timezone,
        as_of=at,
        availability=availability,
        actual=actual,
        known_subtotal=known_value if rows and not truncated else None,
        retention_horizon=horizon.date if horizon is not None else None,
        retention_truncated=truncated,
        transaction_count=included,
        excluded_count=excluded,
        unknown_membership_count=unknown,
        policy_known=policy_known and bool(rows),
        derivation=f"SUM of {included} active included finance.transaction_amount fact(s)",
        series=[FinancePointOut(date=day, amount=daily[day]) for day in sorted(daily)],
        expectations=[SemanticOut.from_row(row, "expectation") for row in expectations],
        targets=[SemanticOut.from_row(row, "target") for row in targets],
        current_expectation=SemanticOut.from_row(current_expectation, "expectation")
        if current_expectation
        else None,
        current_target=SemanticOut.from_row(current_target, "target") if current_target else None,
        delta=delta,
        desire="unknown" if truncated else desirability(actual_fact_value, grounding),
        coverage=CoverageReportOut(
            **{
                **asdict(coverage),
                "window_start": coverage.window_start.isoformat(),
                "window_end": coverage.window_end.isoformat(),
            }
        ),
    )
