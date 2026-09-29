"""Evidence for an experiment: adherence, observations, baseline and conditions.

Adherence and outcome/context observations are Experiment tables. Baseline and
conditions reuse the existing semantic tables (``aa_baselines``,
``aa_observations``) on the experiment subject, through the unchanged
``append_semantic`` path, behind an experiment-owned guard: owner, lifecycle,
shape. Nothing here invents a catalogue metric or averages a value.
"""

from datetime import date, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.enums import (
    EpistemicKind,
    ExperimentObservationRole,
    ObservationAvailability,
    SourceKind,
)
from app.models import (
    AABaseline,
    AAExperiment,
    AAExperimentAdherence,
    AAExperimentObservation,
    AAObservation,
)
from app.schemas.aa_common import ProvenanceIn, SubjectIn, ValueIn
from app.schemas.aa_comparison import BaselineCreate, ObservationCreate
from app.services.aa_comparison import append_semantic
from app.services.experiments import days
from app.services.experiments.contracts import (
    BASELINE_LIFECYCLES,
    EVIDENCE_LIFECYCLES,
    experiment_subject,
    load_owned,
    outcome_matches,
    require_not_future,
)
from app.services.experiments.errors import (
    AdherenceDayFutureError,
    AdherenceDayOutsideWindowError,
    AdherenceDayRecordedError,
    BaselineWindowInvalidError,
    ExperimentIdempotencyKeyReusedError,
    NotAcceptingEvidenceError,
    ObservationOutsideWindowError,
    OutcomeShapeMismatchError,
)

MANUAL = "MANUAL"


def _replay(db: Session, model, *, user_id: UUID, key: str, owned) -> bool:
    """``True`` when this key already wrote this record; 409 when it wrote another."""
    row = db.scalar(select(model).where(model.user_id == user_id, model.idempotency_key == key))
    if row is None:
        return False
    if not owned(row):
        raise ExperimentIdempotencyKeyReusedError
    return True


def _require_evidence_state(experiment: AAExperiment, allowed: tuple[str, ...]) -> None:
    if experiment.lifecycle not in allowed:
        raise NotAcceptingEvidenceError


# ───────────────────────────── adherence ─────────────────────────────

_CORRECT_SQL = text(
    """
    WITH retired AS (
        UPDATE aa_experiment_adherence
           SET status = 'superseded', superseded_by_id = :new_id,
               superseded_at = :now, supersede_kind = 'CORRECTION'
         WHERE id = :prior_id AND status = 'active'
     RETURNING id
    )
    INSERT INTO aa_experiment_adherence
        (id, user_id, experiment_id, day, state, source_kind, method, recorded_at,
         original_recorded_at_known, status, supersedes_id, idempotency_key)
    SELECT :new_id, :user_id, :experiment_id, :day, :state, :source_kind, :method, :now,
           true, 'active', retired.id, :key
      FROM retired
    """
)


def record_adherence(
    db: Session,
    *,
    user_id: UUID,
    experiment_id: UUID,
    day: date,
    state: str,
    supersedes_key: str | None,
    key: str,
) -> bool:
    """Record one elapsed day. Returns ``replayed``.

    A day already recorded changes only by naming the record it corrects, so a
    stale correction from another tab never silently wins.
    """
    if _replay(
        db, AAExperimentAdherence, user_id=user_id, key=key,
        owned=lambda row: row.experiment_id == experiment_id,
    ):
        return True
    try:
        experiment = load_owned(db, user_id=user_id, experiment_id=experiment_id, for_update=True)
        _require_evidence_state(experiment, EVIDENCE_LIFECYCLES)
        if day < experiment.window_start or day > experiment.window_end:
            raise AdherenceDayOutsideWindowError
        now = days.server_now()
        if day > days.local_today(experiment.timezone, now):
            raise AdherenceDayFutureError
        active = db.scalar(
            select(AAExperimentAdherence).where(
                AAExperimentAdherence.experiment_id == experiment_id,
                AAExperimentAdherence.day == day,
                AAExperimentAdherence.status == "active",
            )
        )
        if active is None:
            if supersedes_key is not None:
                raise AdherenceDayRecordedError
            db.add(
                AAExperimentAdherence(
                    id=uuid4(),
                    user_id=user_id,
                    experiment_id=experiment_id,
                    day=day,
                    state=state,
                    source_kind=SourceKind.USER_REPORTED.value,
                    method=MANUAL,
                    recorded_at=now,
                    idempotency_key=key,
                )
            )
        else:
            if supersedes_key is None or supersedes_key != active.idempotency_key:
                raise AdherenceDayRecordedError
            # One statement: the successor is inserted after the prior row has
            # left the active-day index, and the prior's successor link is
            # checked at statement end, once the successor exists.
            inserted = db.execute(
                _CORRECT_SQL,
                {
                    "new_id": uuid4(),
                    "prior_id": active.id,
                    "now": now,
                    "user_id": user_id,
                    "experiment_id": experiment_id,
                    "day": day,
                    "state": state,
                    "source_kind": SourceKind.USER_REPORTED.value,
                    "method": MANUAL,
                    "key": key,
                },
            )
            if inserted.rowcount != 1:
                raise AdherenceDayRecordedError
        db.commit()
    except IntegrityError:
        db.rollback()
        if _replay(
            db, AAExperimentAdherence, user_id=user_id, key=key,
            owned=lambda row: row.experiment_id == experiment_id,
        ):
            return True
        # A concurrent write took the day (or the correction) first.
        raise AdherenceDayRecordedError from None
    except BaseException:
        db.rollback()
        raise
    return False


# ─────────────────────── outcome / context observations ───────────────────────


def record_observation(
    db: Session, *, user_id: UUID, experiment_id: UUID, request: Any
) -> bool:
    if _replay(
        db, AAExperimentObservation, user_id=user_id, key=request.idempotency_key,
        owned=lambda row: row.experiment_id == experiment_id,
    ):
        return True
    try:
        experiment = load_owned(db, user_id=user_id, experiment_id=experiment_id, for_update=True)
        _require_evidence_state(experiment, EVIDENCE_LIFECYCLES)
        require_not_future(request.occurred_at)
        local_day = days.local_date(request.occurred_at, experiment.timezone)
        if not experiment.window_start <= local_day <= experiment.window_end:
            raise ObservationOutsideWindowError
        if request.role == ExperimentObservationRole.OUTCOME and not outcome_matches(
            experiment, request.value
        ):
            raise OutcomeShapeMismatchError
        subject = experiment_subject(experiment_id)
        db.add(
            AAExperimentObservation(
                id=uuid4(),
                user_id=user_id,
                experiment_id=experiment_id,
                subject_domain=subject.subject_domain,
                subject_type=subject.subject_type,
                subject_id=subject.subject_id,
                metric_key=None,
                role=str(request.role),
                label=request.label,
                occurred_at=request.occurred_at,
                occurred_tz=request.occurred_tz,
                source_kind=SourceKind.USER_REPORTED.value,
                basis=request.basis,
                method=request.method,
                recorded_at=days.server_now(),
                idempotency_key=request.idempotency_key,
                **request.value.to_fact_value().column_values(),
                value_type=str(request.value.type),
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        if _replay(
            db, AAExperimentObservation, user_id=user_id, key=request.idempotency_key,
            owned=lambda row: row.experiment_id == experiment_id,
        ):
            return True
        raise
    except BaseException:
        db.rollback()
        raise
    return False


# ───────────────────── baseline / conditions (existing tables) ─────────────────────


def _subject_in(experiment_id: UUID) -> SubjectIn:
    subject = experiment_subject(experiment_id)
    return SubjectIn(domain=subject.subject_domain, type=subject.subject_type, id=subject.subject_id)


def _on_subject(experiment_id: UUID):
    subject_key = experiment_subject(experiment_id).subject_key
    return lambda row: row.subject_key == subject_key


def record_baseline(
    db: Session, *, user_id: UUID, experiment_id: UUID, request: Any
) -> bool:
    """Fix the reference level before the result. Appends; never supersedes."""
    if _replay(
        db, AABaseline, user_id=user_id, key=request.idempotency_key,
        owned=_on_subject(experiment_id),
    ):
        return True
    experiment = load_owned(db, user_id=user_id, experiment_id=experiment_id)
    try:
        _require_evidence_state(experiment, BASELINE_LIFECYCLES)
        if request.window_end >= experiment.window_start:
            raise BaselineWindowInvalidError
        if not outcome_matches(experiment, request.value):
            raise OutcomeShapeMismatchError
        timezone = experiment.timezone
    finally:
        db.rollback()
    semantic = BaselineCreate(
        subject=_subject_in(experiment_id),
        metric_key=None,
        provenance=ProvenanceIn(
            source_kind=SourceKind.USER_REPORTED, basis=request.basis, method=request.method
        ),
        idempotency_key=request.idempotency_key,
        value=request.value,
        window_start=request.window_start,
        window_end=request.window_end,
        timezone=timezone,
    )
    _, replayed = append_semantic(db, user_id=user_id, concept="baseline", request=semantic)
    return replayed


def record_condition(
    db: Session,
    *,
    user_id: UUID,
    experiment_id: UUID,
    condition_text: str,
    epistemic_kind: EpistemicKind,
    occurred_at: datetime,
    occurred_tz: str,
    key: str,
) -> bool:
    """«Условия изменились»: a condition the user noticed — never a cause."""
    if _replay(
        db, AAObservation, user_id=user_id, key=key, owned=_on_subject(experiment_id)
    ):
        return True
    experiment = load_owned(db, user_id=user_id, experiment_id=experiment_id)
    try:
        _require_evidence_state(experiment, EVIDENCE_LIFECYCLES)
        require_not_future(occurred_at)
    finally:
        db.rollback()
    semantic = ObservationCreate(
        subject=_subject_in(experiment_id),
        metric_key=None,
        provenance=ProvenanceIn(source_kind=SourceKind.USER_REPORTED, method=MANUAL),
        idempotency_key=key,
        value=ValueIn(type="categorical", text=condition_text),
        value_availability=ObservationAvailability.PRESENT,
        epistemic_kind=epistemic_kind,
        occurred_at=occurred_at,
        occurred_tz=occurred_tz,
    )
    _, replayed = append_semantic(db, user_id=user_id, concept="observation", request=semantic)
    return replayed
