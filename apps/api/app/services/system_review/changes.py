"""What changed in a period — typed, juxtaposed, never reduced (plan §6.1–6.5).

Every item keeps its own value type, unit, subject, window and provenance. The
direction of a delta is descriptive («выше / ниже»); desirability comes only
from explicit grounding (a Target, or a Preference with a Baseline) and is never
derived from a sign, an Expectation, a Forecast, a Decision or a project date.
No item is added to, averaged with or ranked against another.

Internally each item carries ``sources`` — the exact ``(table, id)`` rows it was
derived from — so a saved revision can be redacted item by item (D1). The live
response strips them (``public``).
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.asof import apply_as_of
from app.analytics.delta import DeltaUnknown, IncompatibleUnitsError, compute_delta
from app.analytics.enums import FactStatus, ValueType
from app.analytics.subjects import SubjectRef
from app.analytics.values import FactValue
from app.models import (
    AAExpectationVersion,
    AAExperiment,
    AAForecastVersion,
    AAMeasurement,
    AAMetricMembershipOverride,
    AAMetricPolicyVersion,
    AAObservation,
    AATarget,
)
from app.services.aa_coverage_claims import coverage_report_for_window
from app.services.aa_desirability import NormativeGrounding, desirability
from app.services.aa_finance import MONTHLY_METRIC, MonthlySpendInputs, monthly_spend_inputs
from app.services.aa_project_analytics import project_analytics
from app.services.system_review.contracts import MAX_GROUP_ITEMS, plain, value_payload
from app.services.system_review.periods import Period, shift_month
from app.services.system_review.refs import (
    ChangeKind,
    change_ref,
    fact_ref,
    subject_ref,
)

PROJECT_METRIC = "project.completion_date"
DOMAIN_RANK = {"finance": 0, "project": 1, "experiment": 2, "observation": 3}


def _fact_value(row: Any) -> FactValue | None:
    if row is None or getattr(row, "is_explicitly_absent", False):
        return None
    if getattr(row, "value_availability", None) == "explicitly_unknown":
        return None
    if getattr(row, "value_type", None) is None:
        return None
    return FactValue(
        value_type=ValueType(row.value_type),
        unit_code=row.unit_code,
        value_num=row.value_num,
        value_date=row.value_date,
        value_text=row.value_text,
        scale_min=row.scale_min,
        scale_max=row.scale_max,
    )


def fact_value_payload(value: FactValue | None) -> dict[str, Any] | None:
    if value is None:
        return None
    return {
        "type": str(value.value_type),
        "unit_code": value.unit_code,
        "num": plain(value.value_num),
        "date": plain(value.value_date),
        "text": value.value_text,
        "scale_min": plain(value.scale_min),
        "scale_max": plain(value.scale_max),
    }


def delta_payload(current: FactValue | None, reference: FactValue | None) -> dict[str, Any]:
    try:
        result = compute_delta(current, reference)
    except IncompatibleUnitsError as error:
        return {"state": "not_applicable", "reason": error.code}
    if isinstance(result, DeltaUnknown):
        return {"state": "unknown", "reason": result.reason}
    return {
        "state": "known",
        "value": {
            "type": str(result.value_type),
            "unit_code": result.unit_code,
            "num": plain(result.value_num),
            "scale_min": plain(result.scale_min),
            "scale_max": plain(result.scale_max),
        },
        "direction": "higher" if result.value_num > 0 else ("lower" if result.value_num < 0
                                                           else "same"),
    }


def _provenance(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "source_kind": row.source_kind,
        "basis": row.basis,
        "method": row.method,
        "recorded_at": plain(row.recorded_at),
    }


def public(item: dict[str, Any]) -> dict[str, Any]:
    """The live response shape: identical minus the internal source manifest."""
    return {key: value for key, value in item.items() if key != "sources"}


# ───────────────────────────── finance month ─────────────────────────────


@dataclass
class FinanceMonth:
    period: Period
    inputs: MonthlySpendInputs
    availability: str
    actual: FactValue | None
    expectation: AAExpectationVersion | None
    target: AATarget | None
    expectation_versions: list[AAExpectationVersion]
    coverage: Any
    sources: list[tuple[str, str]] = field(default_factory=list)

    @property
    def has_data(self) -> bool:
        return bool(self.inputs.rows) or self.expectation is not None or self.target is not None

    @property
    def grounding(self) -> NormativeGrounding | None:
        target = self.target
        if target is None or target.is_explicitly_absent or target.desired_direction is None:
            return None
        value = _fact_value(target)
        if value is None:
            return None
        return NormativeGrounding("target", target.desired_direction, value, str(target.id))


def _current(db: Session, model, *, user_id: UUID, subject_key: str, at: datetime):
    query = select(model).where(
        model.user_id == user_id,
        model.subject_key == subject_key,
        model.metric_key == MONTHLY_METRIC,
    )
    if hasattr(model, "effective_from"):
        query = query.where(model.effective_from <= at)
    return db.scalar(
        apply_as_of(query, model, at).order_by(model.recorded_at.desc(), model.id.desc()).limit(1)
    )


def typed_sources(db: Session, ids: tuple[str, ...]) -> list[tuple[str, str]]:
    """Attach the table to each id a monthly derivation read (for per-item redaction)."""
    wanted = [UUID(value) for value in ids]
    if not wanted:
        return []
    policies = {str(v) for v in db.scalars(
        select(AAMetricPolicyVersion.id).where(AAMetricPolicyVersion.id.in_(wanted)))}
    overrides = {str(v) for v in db.scalars(
        select(AAMetricMembershipOverride.id).where(AAMetricMembershipOverride.id.in_(wanted)))}
    typed = []
    for value in ids:
        if value in policies:
            typed.append(("aa_metric_policy_versions", value))
        elif value in overrides:
            typed.append(("aa_metric_membership_overrides", value))
        else:
            typed.append(("aa_measurements", value))
    return typed


def finance_month(db: Session, *, user_id: UUID, period: Period, now: datetime) -> FinanceMonth:
    """The Finance page's own month derivation, read-only, with its exact sources."""
    inputs = monthly_spend_inputs(
        db, user_id=user_id, period=period.key, timezone=period.timezone, as_of=None
    )
    unknown = inputs.unknown_membership_count
    availability = "insufficient_data" if unknown else ("present" if inputs.rows else "no_data")
    actual = (
        FactValue(value_type=ValueType.MONEY, unit_code="UAH", value_num=inputs.total)
        if unknown == 0 and inputs.rows
        else None
    )
    subject_key = period.subject_key
    expectation = _current(db, AAExpectationVersion, user_id=user_id, subject_key=subject_key,
                           at=now)
    target = _current(db, AATarget, user_id=user_id, subject_key=subject_key, at=now)
    versions = list(
        db.scalars(
            select(AAExpectationVersion)
            .where(
                AAExpectationVersion.user_id == user_id,
                AAExpectationVersion.subject_key == subject_key,
                AAExpectationVersion.metric_key == MONTHLY_METRIC,
                AAExpectationVersion.status != FactStatus.TOMBSTONED,
            )
            .order_by(AAExpectationVersion.recorded_at, AAExpectationVersion.id)
        )
    )
    coverage = coverage_report_for_window(
        db,
        user_id=user_id,
        subject_key=subject_key,
        window_start=period.window_start,
        window_end=period.window_end,
        timezone=period.timezone,
        now=now,
    )
    return FinanceMonth(
        period=period,
        inputs=inputs,
        availability=availability,
        actual=actual,
        expectation=expectation,
        target=target,
        expectation_versions=versions,
        coverage=coverage,
        sources=typed_sources(db, inputs.input_version_ids),
    )


def coverage_payload(report: Any) -> dict[str, Any]:
    return {
        "observed": report.observed_count,
        "partial": report.partial_count,
        "missing": report.missing_count,
        "unknown_coverage": report.unknown_coverage_count,
        "future": report.future_count,
        "expected_denominator": report.expected_denominator,
        "corrected": report.corrected_count,
        "has_legacy_imports": report.has_legacy_imports,
    }


def _finance_item(
    month: FinanceMonth,
    kind: str,
    *,
    current: FactValue | None,
    reference: FactValue | None,
    current_concept: str,
    reference_concept: str | None,
    desire: str = "neutral",
    basis: dict[str, Any] | None = None,
    details: dict[str, Any] | None = None,
    sources: list[tuple[str, str]] | None = None,
) -> dict[str, Any]:
    period = month.period
    return {
        "ref": change_ref(kind, period.subject_key, MONTHLY_METRIC, period.key),
        "kind": kind,
        "domain": "finance",
        "subject_key": period.subject_key,
        "metric_key": MONTHLY_METRIC,
        "period": period.key,
        "current": {
            "concept": current_concept,
            "value": fact_value_payload(current),
            "availability": month.availability if current_concept == "actual" else (
                "present" if current is not None else "no_data"),
        },
        "reference": None if reference_concept is None else {
            "concept": reference_concept,
            "value": fact_value_payload(reference),
            "availability": "present" if reference is not None else "no_data",
        },
        "delta": delta_payload(current, reference) if reference_concept else None,
        "desire": desire,
        "basis": basis,
        "details": details or {},
        "coverage": coverage_payload(month.coverage),
        "provenance": None,
        "sources": [list(source) for source in (sources or [])],
    }


def _basis(target: AATarget) -> dict[str, Any]:
    return {
        "kind": "target",
        "fact_id": str(target.id),
        "direction": target.desired_direction,
        "reference": value_payload(target),
        "window": [plain(target.window_start), plain(target.window_end)],
        "recorded_at": plain(target.recorded_at),
    }


def finance_items(
    db: Session, *, user_id: UUID, month: FinanceMonth, now: datetime
) -> list[dict[str, Any]]:
    if not month.has_data:
        return []
    items: list[dict[str, Any]] = []
    base_sources = list(month.sources)
    grounding = month.grounding
    target = month.target
    target_sources = [("aa_targets", str(target.id))] if target is not None else []
    desire = desirability(month.actual, grounding) if grounding is not None else "neutral"
    if month.expectation is not None:
        expectation_value = _fact_value(month.expectation)
        items.append(
            _finance_item(
                month,
                ChangeKind.FINANCE_SPEND_VS_EXPECTATION,
                current=month.actual,
                reference=expectation_value,
                current_concept="actual",
                reference_concept="expectation",
                desire=desire,
                basis=_basis(target) if grounding is not None else None,
                details={"expectation_is_not_a_target": True},
                sources=base_sources
                + [("aa_expectation_versions", str(month.expectation.id))]
                + target_sources,
            )
        )
    prior = finance_month(db, user_id=user_id, period=shift_month(month.period, -1), now=now)
    if month.actual is not None or prior.actual is not None:
        items.append(
            _finance_item(
                month,
                ChangeKind.FINANCE_SPEND_VS_PRIOR,
                current=month.actual,
                reference=prior.actual,
                current_concept="actual",
                reference_concept="prior_actual",
                # The prior month is not a norm: always neutral.
                details={"prior_period": prior.period.key,
                         "prior_availability": prior.availability},
                sources=base_sources + prior.sources,
            )
        )
    live_versions = month.expectation_versions
    if len(live_versions) >= 2:
        first, latest = live_versions[0], live_versions[-1]
        items.append(
            _finance_item(
                month,
                ChangeKind.FINANCE_EXPECTATION_REVISIONS,
                current=_fact_value(latest),
                reference=_fact_value(first),
                current_concept="latest_expectation",
                reference_concept="first_expectation",
                details={"versions": len(live_versions)},
                sources=[("aa_expectation_versions", str(row.id)) for row in live_versions],
            )
        )
    if target is None:
        state = "none"
    elif target.is_explicitly_absent:
        state = "explicitly_absent"
    else:
        state = "present"
    items.append(
        _finance_item(
            month,
            ChangeKind.FINANCE_TARGET_STATE,
            current=month.actual,
            reference=_fact_value(target) if state == "present" else None,
            current_concept="actual",
            reference_concept="target" if state == "present" else None,
            desire=desire,
            basis=_basis(target) if grounding is not None else None,
            details={"target_state": state,
                     "direction": target.desired_direction if target is not None else None},
            sources=(base_sources + target_sources) if state == "present" else target_sources,
        )
    )
    return items


# ───────────────────────────── projects ─────────────────────────────


def project_items(
    db: Session, *, user_id: UUID, period: Period, now: datetime
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    versions = list(
        db.scalars(
            select(AAForecastVersion)
            .where(
                AAForecastVersion.user_id == user_id,
                AAForecastVersion.subject_domain == "project",
                AAForecastVersion.metric_key == PROJECT_METRIC,
                AAForecastVersion.status != FactStatus.TOMBSTONED,
                AAForecastVersion.recorded_at < period.end,
            )
            .order_by(AAForecastVersion.subject_id, AAForecastVersion.recorded_at,
                      AAForecastVersion.id)
        )
    )
    by_project: dict[str, list] = {}
    for row in versions:
        by_project.setdefault(row.subject_id, []).append(row)
    for project_id, rows in sorted(by_project.items()):
        inside = [row for row in rows if row.recorded_at >= period.start]
        if not inside:
            continue
        before = [row for row in rows if row.recorded_at < period.start]
        start_row = before[-1] if before else inside[0]
        end_row = inside[-1]
        subject_key = f"project:project:{project_id}"
        items.append({
            "ref": change_ref(ChangeKind.PROJECT_FORECAST_REVISIONS, subject_key, PROJECT_METRIC,
                              period.key),
            "kind": ChangeKind.PROJECT_FORECAST_REVISIONS.value,
            "domain": "project",
            "subject_key": subject_key,
            "metric_key": PROJECT_METRIC,
            "period": period.key,
            "current": {"concept": "latest_forecast", "value": value_payload(end_row),
                        "availability": "present"},
            "reference": {"concept": "forecast_before" if before else "first_forecast",
                          "value": value_payload(start_row), "availability": "present"},
            "delta": delta_payload(_fact_value(end_row), _fact_value(start_row))
            if end_row is not start_row else None,
            "desire": "neutral",
            "basis": None,
            "details": {"versions_in_period": len(inside), "project_id": project_id},
            "coverage": None,
            "provenance": _provenance(end_row),
            "sources": [["aa_forecast_versions", str(row.id)] for row in [start_row, *inside]],
        })
    completions = list(
        db.scalars(
            apply_as_of(
                select(AAMeasurement).where(
                    AAMeasurement.user_id == user_id,
                    AAMeasurement.subject_domain == "project",
                    AAMeasurement.metric_key == PROJECT_METRIC,
                    AAMeasurement.occurred_at >= period.start,
                    AAMeasurement.occurred_at < period.end,
                ),
                AAMeasurement,
                None,
            ).order_by(AAMeasurement.subject_id, AAMeasurement.occurred_at)
        )
    )
    for row in completions:
        subject = SubjectRef("project", "project", row.subject_id)
        analytics = project_analytics(db, user_id=user_id, subject=subject, now=now)
        sources = [["aa_measurements", str(row.id)]]
        if analytics.first_forecast is not None:
            sources.append(["aa_forecast_versions", str(analytics.first_forecast.id)])
        if analytics.latest_forecast is not None:
            sources.append(["aa_forecast_versions", str(analytics.latest_forecast.id)])
        items.append({
            "ref": change_ref(ChangeKind.PROJECT_COMPLETION, subject.subject_key, PROJECT_METRIC,
                              period.key),
            "kind": ChangeKind.PROJECT_COMPLETION.value,
            "domain": "project",
            "subject_key": subject.subject_key,
            "metric_key": PROJECT_METRIC,
            "period": period.key,
            "current": {"concept": "actual", "value": value_payload(row),
                        "availability": "present"},
            "reference": None,
            "delta": None,
            "desire": "neutral",
            "basis": None,
            "details": {
                "project_id": row.subject_id,
                "delta_vs_first": analytics.delta_vs_first.delta.model_dump(mode="json"),
                "delta_vs_latest": analytics.delta_vs_latest.delta.model_dump(mode="json"),
                "state": analytics.state,
            },
            "coverage": None,
            "provenance": _provenance(row),
            "sources": sources,
        })
    return items


# ───────────────────────────── experiments ─────────────────────────────

_EXPERIMENT_EVENTS = (
    ("started", "started_at"),
    ("completed", "completed_at"),
    ("reviewed", "reviewed_at"),
    ("abandoned", "abandoned_at"),
)


def experiment_items(db: Session, *, user_id: UUID, period: Period) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(AAExperiment)
        .where(AAExperiment.user_id == user_id)
        .order_by(AAExperiment.created_at, AAExperiment.id)
    )
    items = []
    for row in rows:
        events = [
            {"event": event, "at": plain(getattr(row, column))}
            for event, column in _EXPERIMENT_EVENTS
            if getattr(row, column) is not None and period.contains_instant(getattr(row, column))
        ]
        if not events:
            continue
        subject_key = f"experiment:experiment:{row.id}"
        items.append({
            "ref": change_ref(ChangeKind.EXPERIMENT_LIFECYCLE, subject_key, None, period.key),
            "kind": ChangeKind.EXPERIMENT_LIFECYCLE.value,
            "domain": "experiment",
            "subject_key": subject_key,
            "metric_key": None,
            "period": period.key,
            "current": {"concept": "lifecycle", "value": None, "availability": "present"},
            "reference": None,
            "delta": None,
            "desire": "neutral",
            "basis": None,
            "details": {
                "experiment_id": str(row.id),
                "title": row.title,
                "lifecycle": row.lifecycle,
                "events": events,
                "subject_ref": subject_ref(subject_key),
            },
            "coverage": None,
            "provenance": None,
            "sources": [],
        })
    return items


# ───────────────────────────── observations ─────────────────────────────


def free_observations(
    db: Session, *, user_id: UUID, period: Period, limit: int
) -> list[AAObservation]:
    """Observations the user recorded on their own (not attached to an experiment)."""
    return list(
        db.scalars(
            apply_as_of(
                select(AAObservation).where(
                    AAObservation.user_id == user_id,
                    AAObservation.subject_domain != "experiment",
                    AAObservation.occurred_at >= period.start,
                    AAObservation.occurred_at < period.end,
                ),
                AAObservation,
                None,
            )
            .order_by(AAObservation.occurred_at, AAObservation.id)
            .limit(limit)
        )
    )


def observation_items(
    db: Session, *, user_id: UUID, period: Period, rows: list[AAObservation] | None = None
) -> list[dict[str, Any]]:
    rows = rows if rows is not None else free_observations(
        db, user_id=user_id, period=period, limit=MAX_GROUP_ITEMS
    )
    items = []
    for row in rows:
        items.append({
            "ref": fact_ref("aa_observations", row.id),
            "kind": ChangeKind.OBSERVATION.value,
            "domain": "observation",
            "subject_key": row.subject_key,
            "metric_key": row.metric_key,
            "period": period.key,
            "current": {
                "concept": "observation",
                "value": value_payload(row) if row.value_availability == "present" else None,
                "availability": row.value_availability,
            },
            "reference": None,
            "delta": None,
            "desire": "neutral",
            "basis": None,
            "details": {"epistemic_kind": row.epistemic_kind, "occurred_at": plain(row.occurred_at)},
            "coverage": None,
            "provenance": _provenance(row),
            "sources": [["aa_observations", str(row.id)]],
        })
    return items


def order_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Structural order only — never magnitude, importance or materiality."""
    return sorted(
        items,
        key=lambda item: (
            DOMAIN_RANK.get(item["domain"], 9),
            item.get("subject_key") or "",
            item["kind"],
            item["ref"],
        ),
    )


def improved_items(changed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Only explicit grounding makes «лучше». One item per grounded subject."""
    seen: set[str] = set()
    out = []
    for item in changed:
        if item["desire"] != "favorable" or not item.get("basis"):
            continue
        if item["kind"] != ChangeKind.FINANCE_TARGET_STATE:
            continue
        if item["subject_key"] in seen:
            continue
        seen.add(item["subject_key"])
        out.append({**item, "section": "improved"})
    return out


def quality_items(month: FinanceMonth | None) -> list[dict[str, Any]]:
    if month is None or not month.has_data:
        return []
    return [
        {
            "kind": "finance_coverage",
            "period": month.period.key,
            "coverage": coverage_payload(month.coverage),
            "unknown_membership": month.inputs.unknown_membership_count,
            "policy_known": month.inputs.policy_known,
            "availability": month.availability,
            "sources": [],
        },
        {"kind": "income_not_modeled", "period": month.period.key, "sources": []},
    ]
