"""Read-only subject layers and comparisons; no domain aggregation or snapshot reads."""

from dataclasses import asdict
from datetime import UTC, datetime

from sqlalchemy import select

from app.analytics.asof import apply_as_of
from app.analytics.delta import DeltaUnknown, IncompatibleUnitsError, compute_delta
from app.analytics.enums import ValueType
from app.analytics.values import FactValue
from app.models import AAMeasurement, AASourceCoverage
from app.schemas.aa_comparison import ComparisonOut, DerivedDeltaOut, SemanticOut
from app.schemas.aa_measurement import MeasurementOut
from app.services.aa_comparison import CONCEPT_MODELS
from app.services.aa_coverage_claims import coverage_report_for_window
from app.services.aa_desirability import NormativeGrounding, desirability
from app.services.aa_facts import FactNotFoundError


def require_subject(db, *, user_id, subject_key):
    for model in (AAMeasurement, AASourceCoverage, *CONCEPT_MODELS.values()):
        if db.scalar(
            select(model.id)
            .where(
                model.user_id == user_id,
                model.subject_key == subject_key,
                model.status != "tombstoned",
            )
            .limit(1)
        ):
            return
    raise FactNotFoundError


def _value(row):
    if (
        row is None
        or getattr(row, "is_explicitly_absent", False)
        or (getattr(row, "value_availability", None) == "explicitly_unknown")
    ):
        return None
    return FactValue(
        value_type=ValueType(row.value_type),
        **{
            key: getattr(row, key)
            for key in (
                "unit_code",
                "value_num",
                "value_date",
                "value_text",
                "scale_min",
                "scale_max",
            )
        },
    )


def subject_summary(db, *, user_id, subject_key, as_of=None, metric_key=None):
    require_subject(db, user_id=user_id, subject_key=subject_key)
    at = as_of or datetime.now(UTC)
    layers = {}
    # Keep one current version per metric and concept, not one flattened value.
    # Bounded summary; the ranged history endpoint exposes complete version lists.
    truncated = False
    for concept, model in {"actual": AAMeasurement, **CONCEPT_MODELS}.items():
        query = select(model).where(model.user_id == user_id, model.subject_key == subject_key)
        if metric_key:
            query = query.where(model.metric_key == metric_key)
        if hasattr(model, "effective_from"):
            query = query.where(model.effective_from <= at)
        if concept in ("actual", "observation"):
            query = query.where(model.occurred_at <= at)
        rows = db.scalars(
            apply_as_of(query, model, at)
            .order_by(model.recorded_at.desc(), model.id.desc())
            .limit(201)
        ).all()
        truncated |= len(rows) > 200
        current = {}
        for row in rows[:200]:
            current.setdefault(row.metric_key, row)
        layers[concept] = current
    metrics = sorted({key for rows in layers.values() for key in rows}, key=lambda x: x or "")
    comparisons = []
    if not metrics:
        comparisons.append(
            ComparisonOut(
                metric_key=metric_key,
                current_concept=None,
                current_id=None,
                reference_concept=None,
                reference_id=None,
                availability="no_data",
                delta=DerivedDeltaOut(state="unknown", reason="operand_absent"),
                desire="neutral",
                grounding_id=None,
                grounding_kind=None,
            )
        )
    for metric in metrics:
        rows = {concept: layer.get(metric) for concept, layer in layers.items()}
        current_kind = next(
            (kind for kind in ("actual", "forecast", "observation") if rows[kind]), None
        )
        current = rows.get(current_kind)
        ref_kind = next((kind for kind in ("expectation", "baseline") if rows[kind]), None)
        ref = rows.get(ref_kind)
        coverage = None
        if ref and hasattr(ref, "window_start"):
            coverage = coverage_report_for_window(
                db,
                user_id=user_id,
                subject_key=subject_key,
                window_start=ref.window_start,
                window_end=ref.window_end,
                timezone=ref.timezone,
                now=at,
                as_of=at,
            )
        partial = coverage is not None and coverage.partial_count > 0
        current_value, reference_value = _value(current), _value(ref)
        availability = (
            "no_data"
            if current_value is None or reference_value is None
            else ("insufficient_data" if partial else "present")
        )
        try:
            result = (
                DeltaUnknown("insufficient_data")
                if partial
                else compute_delta(current_value, reference_value)
            )
            if isinstance(result, DeltaUnknown):
                delta = DerivedDeltaOut(state="unknown", reason=result.reason)
            else:
                delta = DerivedDeltaOut(
                    state="known",
                    type=result.value_type,
                    num=result.value_num,
                    unit_code=result.unit_code,
                    scale_min=result.scale_min,
                    scale_max=result.scale_max,
                )
        except IncompatibleUnitsError as error:
            delta = DerivedDeltaOut(state="not_applicable", reason=error.code)
        grounding = None
        target = rows["target"]
        if target and ref and hasattr(ref, "window_start"):
            if (target.window_start, target.window_end, target.timezone) != (
                ref.window_start,
                ref.window_end,
                ref.timezone,
            ):
                target = None  # a target for a different period is not grounding
        preference = rows["preference"]
        if target and not target.is_explicitly_absent:
            grounding = NormativeGrounding(
                "target", target.desired_direction, _value(target), str(target.id)
            )
        elif preference and rows["baseline"]:
            grounding = NormativeGrounding(
                "preference",
                preference.desired_direction,
                _value(rows["baseline"]),
                str(preference.id),
            )
        # A forecast/subjective interpretation is never evaluated as an Actual.
        desire = desirability(_value(rows["actual"]) if not partial else None, grounding)
        comparisons.append(
            ComparisonOut(
                metric_key=metric,
                current_concept=current_kind,
                current_id=current.id if current else None,
                reference_concept=ref_kind,
                reference_id=ref.id if ref else None,
                availability=availability,
                delta=delta,
                desire=desire,
                grounding_id=grounding.fact_id if grounding else None,
                grounding_kind=grounding.kind if grounding else None,
                coverage=asdict(coverage) if coverage else None,
            )
        )
    output = {
        "subject_key": subject_key,
        "as_of": at,
        "truncated": truncated,
        "actual": [MeasurementOut.from_row(row) for row in layers["actual"].values()],
        "comparisons": comparisons,
    }
    names = {
        "expectation": "expectations",
        "forecast": "forecasts",
        "baseline": "baselines",
        "target": "targets",
        "preference": "preferences",
        "observation": "observations",
    }
    for concept, name in names.items():
        output[name] = [SemanticOut.from_row(row, concept) for row in layers[concept].values()]
    return output
