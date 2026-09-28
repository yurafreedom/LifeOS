"""Review / Debrief — frozen context, user-authored reflection, D1 redaction.

A Review is semantic reflection, not a GTD weekly review and not a verdict. It
never scores, never infers a cause and never recommends. It does three things:

1. **Freezes what the user saw.** ``build_context`` derives the evidence from
   real AA facts *as of an explicit instant*. The same instant always yields the
   same items, which is how a save queued offline for days still stores exactly
   the context the user looked at: the client sends back only that instant and a
   fingerprint, the server re-derives, compares, and stores its own result.
2. **Records what the user wrote** — a note, factors with an epistemic kind, and
   an optional decision. Nothing is required; an empty Review is valid.
3. **Honours erasure.** ``redact_review_context`` is registered as a
   ``SOURCE_REDACTORS`` adapter and runs inside the hard-delete transaction, so
   an erased fact leaves no value behind in any Review, and a failed redaction
   rolls the deletion back.

Corrections are *not* applied to frozen items. They are detected at read time
and reported beside the frozen value (``source_state``), and correction is
never conflated with a legitimate revision.
"""

import hashlib
import json
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.asof import apply_as_of
from app.analytics.delta import DeltaUnknown, IncompatibleUnitsError, compute_delta
from app.analytics.enums import (
    DecisionScope,
    Desire,
    RedactionReason,
    ReviewAvailability,
    ReviewRole,
    ReviewSection,
    ReviewSourceState,
    SourceKind,
    SupersedeKind,
    ValueType,
)
from app.analytics.subjects import SubjectRef
from app.analytics.values import FactValue
from app.models import (
    AABaseline,
    AADecision,
    AAExpectationVersion,
    AAForecastVersion,
    AAMeasurement,
    AAMetricMembershipOverride,
    AAMetricPolicyVersion,
    AAObservation,
    AAPreference,
    AAReview,
    AAReviewContextItem,
    AAReviewContextSource,
    AAReviewFactor,
    AAReviewRevision,
    AASourceCoverage,
    AATarget,
)
from app.services.aa_coverage_claims import active_claims
from app.services.aa_desirability import NormativeGrounding, desirability
from app.services.aa_facts import AAServiceError
from app.services.aa_finance import MONTHLY_METRIC, derive_month, monthly_spend_inputs

PROJECT_METRIC = "project.completion_date"
MANIFEST_VERSION = 1
MAX_ALONGSIDE = 20
MAX_WINDOW_DAYS = 3661
LIST_LIMIT_MAX = 50

# Every table a frozen item may point at, by name. Mirrors the fact tables
# hard deletion can reach.
SOURCE_MODELS = {
    "aa_measurements": AAMeasurement,
    "aa_source_coverage": AASourceCoverage,
    "aa_expectation_versions": AAExpectationVersion,
    "aa_forecast_versions": AAForecastVersion,
    "aa_baselines": AABaseline,
    "aa_targets": AATarget,
    "aa_preferences": AAPreference,
    "aa_observations": AAObservation,
    "aa_metric_policy_versions": AAMetricPolicyVersion,
    "aa_metric_membership_overrides": AAMetricMembershipOverride,
}

VALUE_COLUMNS = ("unit_code", "value_num", "value_date", "value_text", "scale_min", "scale_max")

# Everything on an item that came from a source. Setting all of it to NULL is
# exactly what the ``ck_aa_review_context_items_redacted_erased`` CHECK demands.
ERASED_ITEM_VALUES: dict[str, Any] = {
    "availability": None,
    "value_type": None,
    **{column: None for column in VALUE_COLUMNS},
    "desire": None,
    "epistemic_kind": None,
    "estimate": False,
    "source_kind": None,
    "basis": None,
    "method": None,
    "provenance_recorded_at": None,
    "original_recorded_at_known": None,
}


# ── errors ────────────────────────────────────────────────────────────────


class ReviewNotFoundError(AAServiceError):
    code = "review_not_found"
    message = "Review not found."


class ReviewContextChangedError(AAServiceError):
    code = "review_context_changed"
    message = (
        "The evidence this Review was written against can no longer be reproduced; "
        "nothing was saved."
    )


class IdempotencyKeyReusedError(AAServiceError):
    code = "idempotency_key_reused"
    message = "This idempotency key already belongs to a different Review write."


class UnsupportedReviewSubjectError(AAServiceError):
    code = "unsupported_review_subject"
    message = "Reviews are available for finance periods and projects."


class InvalidReviewWindowError(AAServiceError):
    code = "invalid_review_window"
    message = "The review window is not valid for this subject."


class InvalidFactorError(AAServiceError):
    code = "invalid_factor"
    message = "A named factor does not belong to this Review or is already retracted."


class EmptyRevisionError(AAServiceError):
    code = "empty_revision"
    message = "A revision must add a note, change factors or record a decision."


class InvalidReviewError(AAServiceError):
    code = "invalid_review"
    message = "Invalid review payload."


# ── the frozen context ────────────────────────────────────────────────────


@dataclass(frozen=True)
class ContextItem:
    section: str
    role: str
    label_key: str
    availability: str
    metric_key: str | None = None
    value: FactValue | None = None
    desire: str | None = None
    epistemic_kind: str | None = None
    estimate: bool = False
    source_kind: str | None = None
    basis: str | None = None
    method: str | None = None
    provenance_recorded_at: datetime | None = None
    original_recorded_at_known: bool | None = None
    sources: tuple[tuple[str, str], ...] = ()

    def canonical(self) -> dict[str, Any]:
        value = None
        if self.value is not None:
            value = {
                "type": str(self.value.value_type),
                **{
                    column: _plain(getattr(self.value, column))
                    for column in VALUE_COLUMNS
                },
            }
        return {
            "section": self.section,
            "role": self.role,
            "label_key": self.label_key,
            "availability": self.availability,
            "metric_key": self.metric_key,
            "value": value,
            "desire": self.desire,
            "epistemic_kind": self.epistemic_kind,
            "estimate": self.estimate,
            "source_kind": self.source_kind,
            "basis": self.basis,
            "method": self.method,
            "provenance_recorded_at": _plain(self.provenance_recorded_at),
            "original_recorded_at_known": self.original_recorded_at_known,
            "sources": sorted([table, fact_id] for table, fact_id in self.sources),
        }


@dataclass(frozen=True)
class ReviewContext:
    subject: SubjectRef
    subject_kind: str
    window_start: date
    window_end: date
    timezone: str
    as_of: datetime
    items: tuple[ContextItem, ...] = field(default_factory=tuple)

    @property
    def fingerprint(self) -> str:
        """sha256 over the content the user sees, so "same context" is checkable.

        ``as_of`` is deliberately excluded: two derivations are the same context
        when they show the same things, whenever they were computed.
        """
        payload = {
            "subject_key": self.subject.subject_key,
            "window_start": self.window_start.isoformat(),
            "window_end": self.window_end.isoformat(),
            "timezone": self.timezone,
            "items": [item.canonical() for item in self.items],
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    @property
    def manifest(self) -> dict[str, Any]:
        """Layout only: which ordinals sit in which section. No values, ever."""
        sections = []
        for section in ReviewSection:
            ordinals = [
                index for index, item in enumerate(self.items, start=1)
                if item.section == section
            ]
            sections.append({"key": str(section), "ordinals": ordinals})
        return {
            "manifest_version": MANIFEST_VERSION,
            "subject_kind": self.subject_kind,
            "sections": sections,
        }


STORAGE_QUANTUM = Decimal("0.000001")  # numeric(20,6), the storage precision


def _q(value: Decimal | None) -> Decimal | None:
    """Render at storage precision so a context and its saved copy are identical."""
    return None if value is None else Decimal(value).quantize(STORAGE_QUANTUM)


def _utc(value: datetime | None) -> datetime | None:
    return None if value is None else value.astimezone(UTC)


def _plain(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(_q(value))
    if isinstance(value, datetime):
        return _utc(value).isoformat()
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _fact_value(row: Any) -> FactValue | None:
    if row is None or getattr(row, "value_type", None) is None:
        return None
    if getattr(row, "is_explicitly_absent", False):
        return None
    if getattr(row, "value_availability", None) == "explicitly_unknown":
        return None
    return FactValue(
        value_type=ValueType(row.value_type),
        **{column: getattr(row, column) for column in VALUE_COLUMNS},
    )


def _value_out_to_fact(value: Any) -> FactValue | None:
    if value is None:
        return None
    return FactValue(
        value_type=ValueType(value.type),
        unit_code=value.unit_code,
        value_num=value.num,
        value_date=value.date,
        value_text=value.text,
        scale_min=value.scale_min,
        scale_max=value.scale_max,
    )


def _provenance(row: Any) -> dict[str, Any]:
    return {
        "source_kind": row.source_kind,
        "basis": row.basis,
        "method": row.method,
        "provenance_recorded_at": row.recorded_at,
        "original_recorded_at_known": row.original_recorded_at_known,
    }


def _semantic_provenance(out: Any) -> dict[str, Any]:
    provenance = out.provenance
    return {
        "source_kind": str(provenance.source_kind),
        "basis": provenance.basis,
        "method": provenance.method,
        "provenance_recorded_at": provenance.recorded_at,
        "original_recorded_at_known": provenance.original_recorded_at_known,
    }


def _derived_provenance(as_of: datetime, basis: str | None, method: str) -> dict[str, Any]:
    return {
        "source_kind": str(SourceKind.DERIVED),
        "basis": basis,
        "method": method,
        "provenance_recorded_at": as_of,
        "original_recorded_at_known": True,
    }


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


# ── writes ────────────────────────────────────────────────────────────────


def _persist_items(db: Session, *, user_id: UUID, review_id: UUID, context: ReviewContext):
    for ordinal, item in enumerate(context.items, start=1):
        row = AAReviewContextItem(
            id=uuid4(),
            user_id=user_id,
            review_id=review_id,
            ordinal=ordinal,
            section=str(item.section),
            role=str(item.role),
            label_key=item.label_key,
            metric_key=item.metric_key,
            availability=str(item.availability),
            value_type=str(item.value.value_type) if item.value is not None else None,
            **{
                column: (getattr(item.value, column) if item.value is not None else None)
                for column in VALUE_COLUMNS
            },
            desire=str(item.desire) if item.desire is not None else None,
            epistemic_kind=item.epistemic_kind,
            estimate=item.estimate,
            source_kind=item.source_kind,
            basis=item.basis,
            method=item.method,
            provenance_recorded_at=item.provenance_recorded_at,
            original_recorded_at_known=item.original_recorded_at_known,
        )
        db.add(row)
        for table, fact_id in sorted(set(item.sources)):
            db.add(
                AAReviewContextSource(
                    id=uuid4(),
                    user_id=user_id,
                    item_id=row.id,
                    source_table=table,
                    source_fact_id=UUID(fact_id),
                )
            )


def _revision_by_key(db: Session, *, user_id: UUID, key: str) -> AAReviewRevision | None:
    return db.scalar(
        select(AAReviewRevision).where(
            AAReviewRevision.user_id == user_id, AAReviewRevision.idempotency_key == key
        )
    )


def save_review(db: Session, *, user_id: UUID, request: Any) -> tuple[UUID, bool]:
    """Create a Review in one transaction. Returns ``(review_id, replayed)``."""
    existing = _revision_by_key(db, user_id=user_id, key=request.idempotency_key)
    if existing is not None:
        if existing.revision != 1:
            raise IdempotencyKeyReusedError
        return existing.review_id, True

    subject = request.subject.to_ref()
    if request.context_as_of > datetime.now(UTC):
        raise InvalidReviewError
    context = build_context(
        db,
        user_id=user_id,
        subject=subject,
        window_start=request.window_start,
        window_end=request.window_end,
        timezone=request.timezone,
        as_of=request.context_as_of,
    )
    if context.fingerprint != request.context_fingerprint:
        db.rollback()
        raise ReviewContextChangedError

    try:
        review = AAReview(
            id=uuid4(),
            user_id=user_id,
            subject_domain=subject.subject_domain,
            subject_type=subject.subject_type,
            subject_id=subject.subject_id,
            window_start=context.window_start,
            window_end=context.window_end,
            timezone=context.timezone,
            context_as_of=context.as_of,
            render_manifest=context.manifest,
            current_revision=1,
        )
        db.add(review)
        db.flush()
        _persist_items(db, user_id=user_id, review_id=review.id, context=context)
        db.add(
            AAReviewRevision(
                id=uuid4(),
                user_id=user_id,
                review_id=review.id,
                revision=1,
                note_text=request.note_text,
                idempotency_key=request.idempotency_key,
            )
        )
        for ordinal, factor in enumerate(request.factors, start=1):
            db.add(
                AAReviewFactor(
                    id=uuid4(),
                    user_id=user_id,
                    review_id=review.id,
                    ordinal=ordinal,
                    text=factor.text,
                    epistemic_kind=str(factor.epistemic_kind),
                    added_in_revision=1,
                )
            )
        if request.decision is not None:
            db.add(
                AADecision(
                    id=uuid4(),
                    user_id=user_id,
                    scope=str(DecisionScope.REVIEW),
                    review_id=review.id,
                    choice=_choice(request.decision.choice),
                    revision=1,
                )
            )
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = _revision_by_key(db, user_id=user_id, key=request.idempotency_key)
        if existing is not None and existing.revision == 1:
            return existing.review_id, True
        raise
    except BaseException:
        db.rollback()
        raise
    return review.id, False


def _choice(choice: Any) -> str | None:
    return None if choice is None else str(choice)


def revise_review(
    db: Session, *, user_id: UUID, review_id: UUID, request: Any
) -> tuple[UUID, bool]:
    """Append one revision. Nothing already written is rewritten."""
    existing = _revision_by_key(db, user_id=user_id, key=request.idempotency_key)
    if existing is not None:
        if existing.review_id != review_id or existing.revision == 1:
            raise IdempotencyKeyReusedError
        return review_id, True

    changes_decision = request.changes_decision
    if not (
        request.note_text
        or request.add_factors
        or request.retract_factor_ids
        or changes_decision
    ):
        raise EmptyRevisionError

    try:
        review = db.scalar(
            select(AAReview)
            .where(AAReview.user_id == user_id, AAReview.id == review_id)
            .with_for_update()
        )
        if review is None:
            raise ReviewNotFoundError
        revision = review.current_revision + 1
        now = datetime.now(UTC)

        retract = set(request.retract_factor_ids)
        if retract:
            rows = db.scalars(
                select(AAReviewFactor).where(
                    AAReviewFactor.user_id == user_id,
                    AAReviewFactor.review_id == review.id,
                    AAReviewFactor.id.in_(retract),
                    AAReviewFactor.retracted_in_revision.is_(None),
                )
            ).all()
            if len(rows) != len(retract):
                raise InvalidFactorError
            for row in rows:
                row.retracted_in_revision = revision

        if request.add_factors:
            known = set(
                db.scalars(
                    select(AAReviewFactor.id).where(
                        AAReviewFactor.user_id == user_id,
                        AAReviewFactor.review_id == review.id,
                    )
                )
            )
            next_ordinal = (
                db.scalar(
                    select(func.max(AAReviewFactor.ordinal)).where(
                        AAReviewFactor.review_id == review.id
                    )
                )
                or 0
            ) + 1
            for offset, factor in enumerate(request.add_factors):
                if factor.replaces_id is not None and factor.replaces_id not in known:
                    raise InvalidFactorError
                db.add(
                    AAReviewFactor(
                        id=uuid4(),
                        user_id=user_id,
                        review_id=review.id,
                        ordinal=next_ordinal + offset,
                        text=factor.text,
                        epistemic_kind=str(factor.epistemic_kind),
                        added_in_revision=revision,
                        replaces_id=factor.replaces_id,
                    )
                )

        if changes_decision:
            current = db.scalar(
                select(AADecision)
                .where(
                    AADecision.user_id == user_id,
                    AADecision.review_id == review.id,
                    AADecision.superseded_in_revision.is_(None),
                )
                .with_for_update()
            )
            if current is not None:
                current.superseded_in_revision = revision
                db.flush()
            db.add(
                AADecision(
                    id=uuid4(),
                    user_id=user_id,
                    scope=str(DecisionScope.REVIEW),
                    review_id=review.id,
                    choice=_choice(request.decision.choice),
                    revision=revision,
                )
            )

        db.add(
            AAReviewRevision(
                id=uuid4(),
                user_id=user_id,
                review_id=review.id,
                revision=revision,
                note_text=request.note_text,
                idempotency_key=request.idempotency_key,
            )
        )
        review.current_revision = revision
        review.revised_at = now
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = _revision_by_key(db, user_id=user_id, key=request.idempotency_key)
        if existing is not None and existing.review_id == review_id and existing.revision > 1:
            return review_id, True
        raise
    except BaseException:
        db.rollback()
        raise
    return review_id, False


# ── D1 redaction ──────────────────────────────────────────────────────────


def redact_review_context(db: Session, user_id: UUID, table_name: str, fact_id: UUID) -> None:
    """Erase every frozen item derived from ``fact_id``. Transactional adapter.

    Runs inside ``delete_fact``'s transaction: it never commits, never logs
    content, and leaves no link to the erased id behind. User-authored rows are
    untouched because they have no source link to find.
    """
    item_ids = list(
        db.scalars(
            select(AAReviewContextSource.item_id).where(
                AAReviewContextSource.user_id == user_id,
                AAReviewContextSource.source_table == table_name,
                AAReviewContextSource.source_fact_id == fact_id,
            )
        )
    )
    if not item_ids:
        return
    db.execute(
        update(AAReviewContextItem)
        .where(
            AAReviewContextItem.user_id == user_id,
            AAReviewContextItem.id.in_(item_ids),
            AAReviewContextItem.redacted_at.is_(None),
        )
        .values(
            **ERASED_ITEM_VALUES,
            redacted_at=datetime.now(UTC),
            redaction_reason=str(RedactionReason.SOURCE_HARD_DELETED),
        )
        .execution_options(synchronize_session=False)
    )
    # The erased item no longer needs any link; removing all of them means no
    # reference to the deleted fact survives either.
    db.execute(
        delete(AAReviewContextSource)
        .where(
            AAReviewContextSource.user_id == user_id,
            AAReviewContextSource.item_id.in_(item_ids),
        )
        .execution_options(synchronize_session=False)
    )
    db.flush()


# ── reads ─────────────────────────────────────────────────────────────────


def _source_states(
    db: Session, *, user_id: UUID, links: list[AAReviewContextSource]
) -> dict[tuple[str, UUID], Any]:
    by_table: dict[str, set[UUID]] = {}
    for link in links:
        by_table.setdefault(link.source_table, set()).add(link.source_fact_id)
    rows: dict[tuple[str, UUID], Any] = {}
    for table, ids in by_table.items():
        model = SOURCE_MODELS[table]
        for row in db.scalars(select(model).where(model.user_id == user_id, model.id.in_(ids))):
            rows[(table, row.id)] = row
    return rows


def _state_of(row: Any) -> ReviewSourceState:
    if row is None or row.status == "tombstoned":
        return ReviewSourceState.WITHDRAWN
    if row.status == "superseded":
        if row.supersede_kind == SupersedeKind.CORRECTION:
            return ReviewSourceState.CORRECTED
        return ReviewSourceState.REVISED
    return ReviewSourceState.CURRENT


PRIORITY = (
    ReviewSourceState.CORRECTED,
    ReviewSourceState.WITHDRAWN,
    ReviewSourceState.REVISED,
    ReviewSourceState.CURRENT,
)


def _chain_head(db: Session, *, user_id: UUID, row: Any) -> Any:
    model = type(row)
    current = row
    for _ in range(64):
        if current.superseded_by_id is None:
            return current
        current = db.scalar(
            select(model).where(model.user_id == user_id, model.id == current.superseded_by_id)
        )
        if current is None:
            return None
    return None


def _value_payload(value: FactValue | None) -> dict[str, Any] | None:
    if value is None:
        return None
    return {
        "type": value.value_type,
        "unit_code": value.unit_code,
        "num": _q(value.value_num),
        "date": value.value_date,
        "text": value.value_text,
        "scale_min": _q(value.scale_min),
        "scale_max": _q(value.scale_max),
    }


def _item_payload(item: ContextItem, ordinal: int) -> dict[str, Any]:
    return {
        "ordinal": ordinal,
        "section": item.section,
        "role": item.role,
        "label_key": item.label_key,
        "metric_key": item.metric_key,
        "availability": item.availability,
        "value": _value_payload(item.value),
        "desire": item.desire,
        "epistemic_kind": item.epistemic_kind,
        "estimate": item.estimate,
        "provenance": {
            "source_kind": item.source_kind,
            "basis": item.basis,
            "method": item.method,
            "recorded_at": _utc(item.provenance_recorded_at),
            "original_recorded_at_known": item.original_recorded_at_known,
        }
        if item.source_kind is not None
        else None,
    }


def context_payload(context: ReviewContext) -> dict[str, Any]:
    return {
        "subject_key": context.subject.subject_key,
        "window_start": context.window_start,
        "window_end": context.window_end,
        "timezone": context.timezone,
        "context_as_of": context.as_of,
        "context_fingerprint": context.fingerprint,
        "manifest": context.manifest,
        "items": [
            _item_payload(item, ordinal) for ordinal, item in enumerate(context.items, start=1)
        ],
    }


def _stored_item_payload(
    db: Session,
    *,
    user_id: UUID,
    row: AAReviewContextItem,
    links: list[AAReviewContextSource],
    sources: dict[tuple[str, UUID], Any],
) -> dict[str, Any]:
    if row.redacted_at is not None:
        return {
            "ordinal": row.ordinal,
            "section": row.section,
            "role": row.role,
            "label_key": row.label_key,
            "metric_key": row.metric_key,
            "availability": None,
            "value": None,
            "desire": None,
            "epistemic_kind": None,
            "estimate": False,
            "provenance": None,
            "redacted": True,
            "source_state": ReviewSourceState.REDACTED,
            "source_flags": [ReviewSourceState.REDACTED],
            "current_value": None,
        }
    frozen = _fact_value(row) if row.availability == ReviewAvailability.PRESENT else None
    states = {_state_of(sources.get((link.source_table, link.source_fact_id))) for link in links}
    flags = [state for state in PRIORITY if state in states and state != ReviewSourceState.CURRENT]
    primary = flags[0] if flags else ReviewSourceState.CURRENT
    current_value = None
    if len(links) == 1 and primary in (ReviewSourceState.CORRECTED, ReviewSourceState.REVISED):
        source = sources.get((links[0].source_table, links[0].source_fact_id))
        head = _chain_head(db, user_id=user_id, row=source) if source is not None else None
        if head is not None and head.status == "active":
            current_value = _value_payload(_fact_value(head))
    return {
        "ordinal": row.ordinal,
        "section": row.section,
        "role": row.role,
        "label_key": row.label_key,
        "metric_key": row.metric_key,
        "availability": row.availability,
        "value": _value_payload(frozen),
        "desire": row.desire,
        "epistemic_kind": row.epistemic_kind,
        "estimate": row.estimate,
        "provenance": {
            "source_kind": row.source_kind,
            "basis": row.basis,
            "method": row.method,
            "recorded_at": _utc(row.provenance_recorded_at),
            "original_recorded_at_known": row.original_recorded_at_known,
        }
        if row.source_kind is not None
        else None,
        "redacted": False,
        "source_state": primary,
        "source_flags": flags,
        "current_value": current_value,
    }


def _decision_payload(row: AADecision) -> dict[str, Any]:
    return {
        "id": row.id,
        "choice": row.choice,
        "revision": row.revision,
        "superseded_in_revision": row.superseded_in_revision,
        "created_at": row.created_at,
    }


def read_review(db: Session, *, user_id: UUID, review_id: UUID) -> dict[str, Any]:
    review = db.scalar(
        select(AAReview).where(AAReview.user_id == user_id, AAReview.id == review_id)
    )
    if review is None:
        raise ReviewNotFoundError
    items = db.scalars(
        select(AAReviewContextItem)
        .where(AAReviewContextItem.user_id == user_id, AAReviewContextItem.review_id == review.id)
        .order_by(AAReviewContextItem.ordinal)
    ).all()
    links = db.scalars(
        select(AAReviewContextSource).where(
            AAReviewContextSource.user_id == user_id,
            AAReviewContextSource.item_id.in_([item.id for item in items]),
        )
    ).all()
    by_item: dict[UUID, list[AAReviewContextSource]] = {}
    for link in links:
        by_item.setdefault(link.item_id, []).append(link)
    sources = _source_states(db, user_id=user_id, links=list(links))
    revisions = db.scalars(
        select(AAReviewRevision)
        .where(AAReviewRevision.user_id == user_id, AAReviewRevision.review_id == review.id)
        .order_by(AAReviewRevision.revision)
    ).all()
    factors = db.scalars(
        select(AAReviewFactor)
        .where(AAReviewFactor.user_id == user_id, AAReviewFactor.review_id == review.id)
        .order_by(AAReviewFactor.ordinal)
    ).all()
    decisions = db.scalars(
        select(AADecision)
        .where(AADecision.user_id == user_id, AADecision.review_id == review.id)
        .order_by(AADecision.revision)
    ).all()
    current = next((row for row in decisions if row.superseded_in_revision is None), None)
    return {
        "id": review.id,
        "subject": {
            "domain": review.subject_domain,
            "type": review.subject_type,
            "id": review.subject_id,
        },
        "subject_key": review.subject_key,
        "window_start": review.window_start,
        "window_end": review.window_end,
        "timezone": review.timezone,
        "context_as_of": review.context_as_of,
        "created_at": review.created_at,
        "revised_at": review.revised_at,
        "current_revision": review.current_revision,
        "manifest": review.render_manifest,
        "items": [
            _stored_item_payload(
                db, user_id=user_id, row=item, links=by_item.get(item.id, []), sources=sources
            )
            for item in items
        ],
        "revisions": [
            {"revision": row.revision, "created_at": row.created_at, "note_text": row.note_text}
            for row in revisions
        ],
        "factors": [
            {
                "id": row.id,
                "ordinal": row.ordinal,
                "text": row.text,
                "epistemic_kind": row.epistemic_kind,
                "added_in_revision": row.added_in_revision,
                "retracted_in_revision": row.retracted_in_revision,
                "replaces_id": row.replaces_id,
            }
            for row in factors
        ],
        "decision": _decision_payload(current) if current is not None else None,
        "decisions": [_decision_payload(row) for row in decisions],
    }


def list_reviews(
    db: Session, *, user_id: UUID, subject_key: str, limit: int
) -> list[dict[str, Any]]:
    reviews = db.scalars(
        select(AAReview)
        .where(AAReview.user_id == user_id, AAReview.subject_key == subject_key)
        .order_by(AAReview.created_at.desc(), AAReview.id.desc())
        .limit(limit)
    ).all()
    current = {
        row.review_id: row
        for row in db.scalars(
            select(AADecision).where(
                AADecision.user_id == user_id,
                AADecision.review_id.in_([review.id for review in reviews]),
                AADecision.superseded_in_revision.is_(None),
            )
        )
    }
    summaries = []
    for review in reviews:
        decision = current.get(review.id)
        state = "none" if decision is None else ("undecided" if decision.choice is None else "chosen")
        summaries.append(
            {
                "id": review.id,
                "subject_key": review.subject_key,
                "window_start": review.window_start,
                "window_end": review.window_end,
                "created_at": review.created_at,
                "revised_at": review.revised_at,
                "current_revision": review.current_revision,
                "decision_state": state,
                "decision_choice": decision.choice if decision is not None else None,
            }
        )
    return summaries
