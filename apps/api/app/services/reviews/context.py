"""Context derivation: resolve the subject, validate the window and derive the
frozen evidence *as of an explicit instant* (``build_context``).
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.asof import apply_as_of
from app.analytics.delta import DeltaUnknown, IncompatibleUnitsError, compute_delta
from app.analytics.enums import (
    Desire,
    ReviewAvailability,
    ReviewRole,
    ReviewSection,
    ValueType,
)
from app.analytics.subjects import SubjectRef
from app.analytics.values import FactValue
from app.models import (
    AAForecastVersion,
    AAMeasurement,
    AAMetricMembershipOverride,
    AAMetricPolicyVersion,
    AAObservation,
    AATarget,
)
from app.services.aa_coverage_claims import active_claims
from app.services.aa_desirability import NormativeGrounding, desirability
from app.services.aa_finance import MONTHLY_METRIC, derive_month, monthly_spend_inputs
from app.services.reviews.contracts import (
    MAX_ALONGSIDE,
    MAX_WINDOW_DAYS,
    PROJECT_METRIC,
    ContextItem,
    ReviewContext,
)
from app.services.reviews.errors import (
    InvalidReviewError,
    InvalidReviewWindowError,
    UnsupportedReviewSubjectError,
)
from app.services.reviews.values import (
    _derived_provenance,
    _fact_value,
    _provenance,
    _semantic_provenance,
    _value_out_to_fact,
)


def _delta_item(
    *,
    metric_key: str,
    current: FactValue | None,
    reference: FactValue | None,
    grounding: NormativeGrounding | None,
    sources: tuple[tuple[str, str], ...],
    estimate: bool,
    as_of: datetime,
    partial: bool = False,
) -> ContextItem:
    """The difference cell. Desirability comes only from explicit grounding."""
    availability = ReviewAvailability.PRESENT
    value: FactValue | None = None
    try:
        result = DeltaUnknown("insufficient_data") if partial else compute_delta(current, reference)
    except IncompatibleUnitsError:
        availability = ReviewAvailability.NOT_APPLICABLE
    else:
        if isinstance(result, DeltaUnknown):
            availability = (
                ReviewAvailability.INSUFFICIENT_DATA
                if result.reason == "insufficient_data"
                else ReviewAvailability.NO_DATA
            )
        else:
            value = FactValue(
                value_type=result.value_type,
                unit_code=result.unit_code,
                value_num=result.value_num,
                scale_min=result.scale_min,
                scale_max=result.scale_max,
            )
    if availability != ReviewAvailability.PRESENT:
        desire = Desire.UNKNOWN
    else:
        # An Expectation or Forecast is never grounding; without a Target the
        # difference is neutral whatever its sign.
        desire = desirability(current, grounding)
    return ContextItem(
        section=ReviewSection.COMPARE,
        role=ReviewRole.DELTA,
        label_key="delta",
        metric_key=metric_key,
        availability=availability,
        value=value,
        desire=desire,
        estimate=estimate,
        sources=sources,
        **_derived_provenance(as_of, None, "difference of the two shown operands"),
    )


def _target_items(target: Any, metric_key: str) -> tuple[ContextItem, NormativeGrounding | None]:
    if target.is_explicitly_absent:
        item = ContextItem(
            section=ReviewSection.COMPARE,
            role=ReviewRole.TARGET,
            label_key="target",
            metric_key=metric_key,
            availability=ReviewAvailability.EXPLICITLY_ABSENT,
            sources=(("aa_targets", str(target.id)),),
            **_provenance(target),
        )
        return item, None
    value = _fact_value(target)
    item = ContextItem(
        section=ReviewSection.COMPARE,
        role=ReviewRole.TARGET,
        label_key="target",
        metric_key=metric_key,
        availability=ReviewAvailability.PRESENT,
        value=value,
        sources=(("aa_targets", str(target.id)),),
        **_provenance(target),
    )
    grounding = NormativeGrounding("target", target.desired_direction, value, str(target.id))
    return item, grounding


def _observation_items(
    db: Session,
    *,
    user_id: UUID,
    subject_key: str,
    window_start: date,
    window_end: date,
    timezone: str,
    as_of: datetime,
) -> list[ContextItem]:
    """Real observations on this subject in the window — juxtaposed, never scored."""
    zone = ZoneInfo(timezone)
    start = datetime.combine(window_start, time.min, zone)
    end = datetime.combine(window_end + timedelta(days=1), time.min, zone)
    rows = db.scalars(
        apply_as_of(
            select(AAObservation).where(
                AAObservation.user_id == user_id,
                AAObservation.subject_key == subject_key,
                AAObservation.occurred_at >= start,
                AAObservation.occurred_at < end,
            ),
            AAObservation,
            as_of,
        )
        .order_by(AAObservation.occurred_at, AAObservation.id)
        .limit(MAX_ALONGSIDE)
    ).all()
    items = []
    for row in rows:
        unknown = row.value_availability == "explicitly_unknown"
        items.append(
            ContextItem(
                section=ReviewSection.ALONGSIDE,
                role=ReviewRole.OBSERVATION,
                label_key="observation",
                metric_key=row.metric_key,
                availability=(
                    ReviewAvailability.EXPLICITLY_UNKNOWN if unknown else ReviewAvailability.PRESENT
                ),
                value=None if unknown else _fact_value(row),
                epistemic_kind=row.epistemic_kind,
                sources=(("aa_observations", str(row.id)),),
                **_provenance(row),
            )
        )
    return items


def _classify_version_ids(db: Session, ids: set[str]) -> list[tuple[str, str]]:
    """Name the table each policy/override version id lives in."""
    sources: list[tuple[str, str]] = []
    if not ids:
        return sources
    uuids = [UUID(value) for value in ids]
    for table, model in (
        ("aa_metric_policy_versions", AAMetricPolicyVersion),
        ("aa_metric_membership_overrides", AAMetricMembershipOverride),
    ):
        for found in db.scalars(select(model.id).where(model.id.in_(uuids))):
            sources.append((table, str(found)))
    return sources


def _finance_context(
    db: Session, *, user_id: UUID, subject: SubjectRef, timezone: str, as_of: datetime
) -> tuple[list[ContextItem], date, date]:
    period = subject.subject_id
    month = derive_month(db, user_id=user_id, period=period, timezone=timezone, as_of=as_of)
    inputs = monthly_spend_inputs(
        db, user_id=user_id, period=period, timezone=timezone, as_of=as_of
    )
    coverage = month.coverage
    partial = coverage.partial_count > 0
    counting = partial or coverage.future_count > 0 or month.availability != "present"

    row_ids = {str(row.id) for row in inputs.rows}
    actual_sources = tuple(
        [("aa_measurements", value) for value in inputs.input_version_ids if value in row_ids]
        + _classify_version_ids(db, set(inputs.input_version_ids) - row_ids)
    )

    items: list[ContextItem] = []
    expectation = month.current_expectation
    expected_sources: tuple[tuple[str, str], ...] = ()
    if expectation is not None:
        expected_sources = (("aa_expectation_versions", str(expectation.id)),)
        items.append(
            ContextItem(
                section=ReviewSection.COMPARE,
                role=ReviewRole.EXPECTED,
                label_key="expectation",
                metric_key=MONTHLY_METRIC,
                availability=ReviewAvailability.PRESENT,
                value=_value_out_to_fact(expectation.value),
                sources=expected_sources,
                **_semantic_provenance(expectation),
            )
        )
    else:
        items.append(
            ContextItem(
                section=ReviewSection.COMPARE,
                role=ReviewRole.EXPECTED,
                label_key="expectation",
                metric_key=MONTHLY_METRIC,
                availability=ReviewAvailability.NO_DATA,
            )
        )

    actual_value = _value_out_to_fact(month.actual)
    items.append(
        ContextItem(
            section=ReviewSection.COMPARE,
            role=ReviewRole.ACTUAL,
            label_key="actual",
            metric_key=MONTHLY_METRIC,
            availability=month.availability,
            value=actual_value,
            estimate=counting and actual_value is not None,
            sources=actual_sources,
            **_derived_provenance(
                as_of, f"{month.transaction_count} included transaction(s)", month.derivation
            ),
        )
    )

    target_item = grounding = None
    target_sources: tuple[tuple[str, str], ...] = ()
    target = None
    if month.current_target is not None:
        target = db.get(AATarget, month.current_target.id)
    if target is not None:
        target_item, grounding = _target_items(target, MONTHLY_METRIC)
        if grounding is not None:
            target_sources = target_item.sources

    items.append(
        _delta_item(
            metric_key=MONTHLY_METRIC,
            current=actual_value,
            reference=_value_out_to_fact(expectation.value) if expectation else None,
            grounding=grounding,
            sources=expected_sources + actual_sources + target_sources,
            estimate=counting and actual_value is not None,
            as_of=as_of,
        )
    )
    if target_item is not None:
        items.append(target_item)

    claim_sources = [
        ("aa_source_coverage", str(row.id))
        for row in active_claims(
            db,
            user_id=user_id,
            subject_key=subject.subject_key,
            window_start=inputs.window_start,
            window_end=inputs.window_end,
            as_of=as_of,
        )
    ]
    coverage_sources = tuple(claim_sources + [("aa_measurements", value) for value in row_ids])
    for key in (
        "expected_denominator",
        "observed_count",
        "partial_count",
        "missing_count",
        "unknown_coverage_count",
        "future_count",
        "estimated_count",
        "corrected_count",
        "has_legacy_imports",
    ):
        items.append(
            ContextItem(
                section=ReviewSection.QUALITY,
                role=ReviewRole.COVERAGE,
                label_key=f"coverage.{key}",
                metric_key=MONTHLY_METRIC,
                availability=ReviewAvailability.PRESENT,
                value=FactValue(
                    value_type=ValueType.COUNT, value_num=Decimal(int(getattr(coverage, key)))
                ),
                sources=coverage_sources,
                **_derived_provenance(
                    as_of, None, "explicit source coverage claims, never fact presence"
                ),
            )
        )
    return items, inputs.window_start, inputs.window_end


def _latest(db: Session, model: Any, *, user_id: UUID, subject_key: str, as_of: datetime, order):
    return db.scalar(
        apply_as_of(
            select(model).where(
                model.user_id == user_id,
                model.subject_key == subject_key,
                model.metric_key == PROJECT_METRIC,
            ),
            model,
            as_of,
        )
        .order_by(*order)
        .limit(1)
    )


def _project_context(
    db: Session, *, user_id: UUID, subject: SubjectRef, as_of: datetime
) -> list[ContextItem]:
    key = subject.subject_key
    forecast = _latest(
        db, AAForecastVersion, user_id=user_id, subject_key=key, as_of=as_of,
        order=(AAForecastVersion.recorded_at.desc(), AAForecastVersion.id.desc()),
    )
    actual = _latest(
        db, AAMeasurement, user_id=user_id, subject_key=key, as_of=as_of,
        order=(AAMeasurement.occurred_at.desc(), AAMeasurement.recorded_at.desc(),
               AAMeasurement.id.desc()),
    )
    target = _latest(
        db, AATarget, user_id=user_id, subject_key=key, as_of=as_of,
        order=(AATarget.recorded_at.desc(), AATarget.id.desc()),
    )
    items: list[ContextItem] = []
    forecast_sources: tuple[tuple[str, str], ...] = ()
    if forecast is not None:
        forecast_sources = (("aa_forecast_versions", str(forecast.id)),)
        items.append(
            ContextItem(
                section=ReviewSection.COMPARE,
                role=ReviewRole.FORECAST,
                label_key="forecast_latest",
                metric_key=PROJECT_METRIC,
                availability=ReviewAvailability.PRESENT,
                value=_fact_value(forecast),
                estimate=True,
                sources=forecast_sources,
                **_provenance(forecast),
            )
        )
    else:
        items.append(
            ContextItem(
                section=ReviewSection.COMPARE,
                role=ReviewRole.FORECAST,
                label_key="forecast_latest",
                metric_key=PROJECT_METRIC,
                availability=ReviewAvailability.NO_DATA,
            )
        )
    actual_sources: tuple[tuple[str, str], ...] = ()
    if actual is not None:
        actual_sources = (("aa_measurements", str(actual.id)),)
        items.append(
            ContextItem(
                section=ReviewSection.COMPARE,
                role=ReviewRole.ACTUAL,
                label_key="actual",
                metric_key=PROJECT_METRIC,
                availability=ReviewAvailability.PRESENT,
                value=_fact_value(actual),
                sources=actual_sources,
                **_provenance(actual),
            )
        )
    else:
        # Not completed yet is not "missed": the cell says there is no Actual.
        items.append(
            ContextItem(
                section=ReviewSection.COMPARE,
                role=ReviewRole.ACTUAL,
                label_key="actual",
                metric_key=PROJECT_METRIC,
                availability=ReviewAvailability.NO_DATA,
            )
        )
    target_item = grounding = None
    target_sources: tuple[tuple[str, str], ...] = ()
    if target is not None:
        target_item, grounding = _target_items(target, PROJECT_METRIC)
        if grounding is not None:
            target_sources = target_item.sources
    items.append(
        _delta_item(
            metric_key=PROJECT_METRIC,
            current=_fact_value(actual),
            reference=_fact_value(forecast),
            grounding=grounding,
            sources=forecast_sources + actual_sources + target_sources,
            estimate=False,
            as_of=as_of,
        )
    )
    if target_item is not None:
        items.append(target_item)
    return items


def _month_bounds(period: str) -> tuple[date, date]:
    try:
        year, month = (int(part) for part in period.split("-"))
        start = date(year, month, 1)
    except (ValueError, TypeError):
        raise UnsupportedReviewSubjectError from None
    if len(period) != 7:
        raise UnsupportedReviewSubjectError
    end = (date(year + month // 12, month % 12 + 1, 1)) - timedelta(days=1)
    return start, end


def resolve_review_subject(subject: SubjectRef) -> str:
    """Return the subject kind, or refuse a subject Review does not support."""
    pair = (subject.subject_domain, subject.subject_type)
    if pair == ("finance", "period"):
        _month_bounds(subject.subject_id)
        return "finance_period"
    if pair == ("project", "project") and subject.subject_id:
        return "project"
    raise UnsupportedReviewSubjectError


def validate_window(subject: SubjectRef, window_start: date, window_end: date) -> None:
    kind = resolve_review_subject(subject)
    if window_end < window_start or (window_end - window_start).days > MAX_WINDOW_DAYS:
        raise InvalidReviewWindowError
    if kind == "finance_period" and (window_start, window_end) != _month_bounds(
        subject.subject_id
    ):
        raise InvalidReviewWindowError


def build_context(
    db: Session,
    *,
    user_id: UUID,
    subject: SubjectRef,
    window_start: date,
    window_end: date,
    timezone: str,
    as_of: datetime,
) -> ReviewContext:
    """Derive the evidence a Review shows, as LifeOS knew it at ``as_of``.

    Absent inputs yield ``no_data`` items and nothing else: no operand is ever
    fabricated and asking for a context never writes a row.
    """
    if as_of.tzinfo is None:
        raise InvalidReviewError
    validate_window(subject, window_start, window_end)
    kind = resolve_review_subject(subject)
    if kind == "finance_period":
        items, _, _ = _finance_context(
            db, user_id=user_id, subject=subject, timezone=timezone, as_of=as_of
        )
    else:
        items = _project_context(db, user_id=user_id, subject=subject, as_of=as_of)
    items += _observation_items(
        db,
        user_id=user_id,
        subject_key=subject.subject_key,
        window_start=window_start,
        window_end=window_end,
        timezone=timezone,
        as_of=as_of,
    )
    order = {section: index for index, section in enumerate(ReviewSection)}
    items.sort(key=lambda item: order[ReviewSection(item.section)])
    return ReviewContext(
        subject=subject,
        subject_kind=kind,
        window_start=window_start,
        window_end=window_end,
        timezone=timezone,
        as_of=as_of,
        items=tuple(items),
    )
