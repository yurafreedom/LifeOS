"""Pure reads: the experiment detail and the lifecycle-filtered list.

Nothing here writes, caches or advances a lifecycle — a period that has ended
is reported as ``completion_due``, and only a client transition completes it.
The result is derived at read time from live facts, so a hard-deleted baseline
or outcome simply leaves the result without an operand. Desirability is
always neutral: an experiment has no Target or Preference, and a delta sign is
not a verdict. No field names a cause, an effect, a score or a recommendation.
"""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.delta import Delta, IncompatibleUnitsError, compute_delta
from app.analytics.enums import ExperimentLifecycle as L
from app.analytics.enums import ExperimentObservationRole, ExperimentResultState
from app.analytics.values import FactValue
from app.models import (
    AABaseline,
    AADecision,
    AAExperiment,
    AAExperimentAdherence,
    AAExperimentObservation,
    AAObservation,
    AAReviewFactor,
)
from app.schemas.aa_common import ProvenanceOut, ValueOut
from app.schemas.aa_comparison import SemanticOut
from app.services.aa_desirability import desirability
from app.services.experiments import days
from app.services.experiments.contracts import (
    LIST_LIMIT_DEFAULT,
    experiment_subject,
    load_owned,
)


def _window(row: AAExperiment, now: datetime) -> dict[str, Any]:
    today = days.local_today(row.timezone, now)
    return {
        "start": row.window_start,
        "end": row.window_end,
        "timezone": row.timezone,
        "total_days": (row.window_end - row.window_start).days + 1,
        "local_today": today,
        "window_elapsed": today > row.window_end,
        "completion_due": row.lifecycle == L.RUNNING and today > row.window_end,
    }


def _events(row: AAExperiment) -> list[dict[str, Any]]:
    events = [
        (L.DRAFT.value, row.hypothesis_recorded_at),
        (L.RUNNING.value, row.started_at),
        (L.COMPLETED_AWAITING_REVIEW.value, row.completed_at),
        (L.REVIEWED.value, row.reviewed_at),
        (L.ABANDONED.value, row.abandoned_at),
    ]
    present = [(state, at) for state, at in events if at is not None]
    return [{"state": state, "occurred_at": at} for state, at in sorted(present, key=lambda e: e[1])]


def _abandon_day(row: AAExperiment) -> date | None:
    if row.lifecycle != L.ABANDONED or row.abandoned_at is None:
        return None
    return days.local_date(row.abandoned_at, row.timezone)


def _adherence(db: Session, row: AAExperiment, now: datetime) -> dict[str, Any]:
    rows = db.scalars(
        select(AAExperimentAdherence)
        .where(AAExperimentAdherence.experiment_id == row.id)
        .order_by(AAExperimentAdherence.day, AAExperimentAdherence.recorded_at)
    ).all()
    active = {record.day: record for record in rows if record.status == "active"}
    applicable = not (
        row.lifecycle == L.DRAFT
        or (row.lifecycle == L.ABANDONED and row.abandoned_from == L.DRAFT)
    )
    summary = days.classify_adherence(
        window_start=row.window_start,
        window_end=row.window_end,
        today=days.local_today(row.timezone, now),
        abandon_day=_abandon_day(row),
        applicable=applicable,
        records=active,
    )
    summary["days"] = [
        {
            "day": entry["day"],
            "state": entry["state"],
            "record": None
            if entry["row"] is None
            else {
                "id": entry["row"].id,
                "idempotency_key": entry["row"].idempotency_key,
                "recorded_at": entry["row"].recorded_at,
                "corrected": entry["row"].supersedes_id is not None,
            },
        }
        for entry in summary["days"]
    ]
    summary["correction_count"] = sum(1 for record in rows if record.supersedes_id is not None)
    return summary


def observation_payload(row: AAExperimentObservation) -> dict[str, Any]:
    return {
        "id": row.id,
        "role": row.role,
        "label": row.label,
        "value": ValueOut.from_row(row) if row.status != "tombstoned" else None,
        "occurred_at": row.occurred_at,
        "occurred_tz": row.occurred_tz,
        "provenance": ProvenanceOut.from_row(row),
        "status": row.status,
        "supersedes_id": row.supersedes_id,
        "superseded_by_id": row.superseded_by_id,
    }


def _fact_value(row: Any) -> FactValue:
    return FactValue(
        value_type=row.value_type,
        unit_code=row.unit_code,
        value_num=row.value_num,
        value_date=row.value_date,
        value_text=row.value_text,
        scale_min=row.scale_min,
        scale_max=row.scale_max,
    )


def _result(
    row: AAExperiment,
    *,
    baselines: list[AABaseline],
    outcomes: list[AAExperimentObservation],
) -> dict[str, Any]:
    baseline = baselines[0] if baselines else None
    outcome = (
        max(outcomes, key=lambda o: (o.occurred_at, o.recorded_at, str(o.id))) if outcomes else None
    )
    outcome_day = days.local_date(outcome.occurred_at, row.timezone) if outcome else None

    if row.lifecycle == L.DRAFT or (
        row.lifecycle == L.ABANDONED and row.abandoned_from in (L.DRAFT, L.RUNNING)
    ):
        state, delta = ExperimentResultState.NOT_APPLICABLE, {"state": "not_applicable"}
    elif row.lifecycle == L.RUNNING:
        state = ExperimentResultState.TOO_EARLY
        delta = {"state": "unknown", "reason": "period_not_finished"}
    elif baseline is None or outcome is None:
        state = ExperimentResultState.NO_DATA
        delta = {"state": "unknown", "reason": "operand_absent"}
    else:
        try:
            computed = compute_delta(_fact_value(outcome), _fact_value(baseline))
        except IncompatibleUnitsError:
            computed = None
        if isinstance(computed, Delta):
            state = ExperimentResultState.KNOWN
            delta = {
                "state": "known",
                "type": computed.value_type,
                "num": computed.value_num,
                "unit_code": computed.unit_code,
                "scale_min": computed.scale_min,
                "scale_max": computed.scale_max,
            }
        else:
            state = ExperimentResultState.NO_DATA
            delta = {"state": "unknown", "reason": "operand_absent"}

    known = state == ExperimentResultState.KNOWN
    return {
        "state": state.value,
        "reason": delta.get("reason"),
        "outcome_day": outcome_day,
        "covered_days": (outcome_day - row.window_start).days + 1 if outcome_day else None,
        "summary": {
            "baselines": [SemanticOut.from_row(b, "baseline") for b in baselines],
            "observations": [observation_payload(o) for o in outcomes],
        },
        "comparison": {
            "metric_key": None,
            "current_concept": "observation",
            "current_id": outcome.id if outcome else None,
            "reference_concept": "baseline",
            "reference_id": baseline.id if baseline else None,
            "availability": "present" if known else "no_data",
            "delta": delta,
            # No normative grounding exists for an experiment outcome.
            "desire": desirability(_fact_value(outcome), None) if known else "unknown",
            "grounding_id": None,
            "grounding_kind": None,
            "coverage": None,
        },
    }


def _decision(db: Session, row: AAExperiment) -> dict[str, Any]:
    decisions = db.scalars(
        select(AADecision)
        .where(AADecision.experiment_id == row.id)
        .order_by(AADecision.revision)
    ).all()
    factors = db.scalars(
        select(AAReviewFactor)
        .where(AAReviewFactor.experiment_id == row.id)
        .order_by(AAReviewFactor.ordinal)
    ).all()
    current = next((d for d in decisions if d.superseded_in_revision is None), None)
    return {
        "current": None
        if current is None
        else {"choice": current.choice, "revision": current.revision, "created_at": current.created_at},
        "history": [
            {
                "choice": d.choice,
                "revision": d.revision,
                "created_at": d.created_at,
                "superseded_in_revision": d.superseded_in_revision,
            }
            for d in decisions
        ],
        "factors": [
            {
                "id": f.id,
                "text": f.text,
                "epistemic_kind": f.epistemic_kind,
                "added_in_revision": f.added_in_revision,
                "retracted_in_revision": f.retracted_in_revision,
                "replaces_id": f.replaces_id,
            }
            for f in factors
        ],
    }


def experiment_detail(db: Session, *, user_id: UUID, experiment_id: UUID) -> dict[str, Any]:
    row = load_owned(db, user_id=user_id, experiment_id=experiment_id)
    now = days.server_now()
    subject_key = experiment_subject(row.id).subject_key
    baselines = db.scalars(
        select(AABaseline)
        .where(
            AABaseline.user_id == user_id,
            AABaseline.subject_key == subject_key,
            AABaseline.status == "active",
        )
        .order_by(AABaseline.recorded_at.desc(), AABaseline.id.desc())
    ).all()
    observations = db.scalars(
        select(AAExperimentObservation)
        .where(
            AAExperimentObservation.experiment_id == row.id,
            AAExperimentObservation.status == "active",
        )
        .order_by(AAExperimentObservation.occurred_at, AAExperimentObservation.id)
    ).all()
    conditions = db.scalars(
        select(AAObservation)
        .where(
            AAObservation.user_id == user_id,
            AAObservation.subject_key == subject_key,
            AAObservation.status == "active",
        )
        .order_by(AAObservation.occurred_at, AAObservation.id)
    ).all()
    outcomes = [o for o in observations if o.role == ExperimentObservationRole.OUTCOME]
    return {
        "id": row.id,
        "title": row.title,
        "hypothesis": row.hypothesis,
        "hypothesis_recorded_at": row.hypothesis_recorded_at,
        "intervention": row.intervention,
        "created_at": row.created_at,
        "evaluated_at": now,
        "window": _window(row, now),
        "outcome": {
            "label": row.outcome_label,
            "value_type": row.outcome_value_type,
            "unit_code": row.outcome_unit_code,
            "scale_min": row.outcome_scale_min,
            "scale_max": row.outcome_scale_max,
        },
        "lifecycle": row.lifecycle,
        "abandoned_from": row.abandoned_from,
        "lifecycle_events": _events(row),
        "adherence": _adherence(db, row, now),
        "baseline": SemanticOut.from_row(baselines[0], "baseline") if baselines else None,
        "baselines": [SemanticOut.from_row(b, "baseline") for b in baselines],
        "observations": {
            "outcome": [observation_payload(o) for o in outcomes],
            "context": [
                observation_payload(o)
                for o in observations
                if o.role == ExperimentObservationRole.CONTEXT
            ],
        },
        "conditions": [SemanticOut.from_row(c, "observation") for c in conditions],
        "result": _result(row, baselines=list(baselines), outcomes=outcomes),
        "decision": _decision(db, row),
    }


def list_experiments(
    db: Session,
    *,
    user_id: UUID,
    lifecycles: tuple[str, ...] = (),
    limit: int = LIST_LIMIT_DEFAULT,
) -> list[dict[str, Any]]:
    query = select(AAExperiment).where(AAExperiment.user_id == user_id)
    if lifecycles:
        query = query.where(AAExperiment.lifecycle.in_(lifecycles))
    rows = db.scalars(
        query.order_by(AAExperiment.created_at.desc(), AAExperiment.id.desc()).limit(limit)
    ).all()
    now = days.server_now()
    items = []
    for row in rows:
        window = _window(row, now)
        items.append(
            {
                "id": row.id,
                "title": row.title,
                "lifecycle": row.lifecycle,
                "abandoned_from": row.abandoned_from,
                "window_start": row.window_start,
                "window_end": row.window_end,
                "timezone": row.timezone,
                "window_elapsed": window["window_elapsed"],
                "completion_due": window["completion_due"],
                "created_at": row.created_at,
            }
        )
    return items
