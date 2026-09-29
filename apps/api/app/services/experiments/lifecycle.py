"""Create an experiment and move it through its lifecycle.

The service is the single writer of ``aa_experiments.lifecycle``. A transition
is decided in a fixed order — replay, key reuse, target already entered,
legality, preconditions — and applied with a compare-and-set on the state it
was decided from. A request that loses the compare-and-set is never re-decided
from the new state: it settles as a replay, a no-op or ``invalid_transition``,
so two racing transitions can never both apply. It never
reads or writes a decision.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import exists, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.enums import ExperimentLifecycle as L
from app.models import AAExperiment, AAExperimentAdherence
from app.services.experiments import days
from app.services.experiments.contracts import (
    KEY_COLUMNS,
    LEGAL_EDGES,
    STATE_COLUMNS,
    load_owned,
    require_not_future,
)
from app.services.experiments.errors import (
    ExperimentIdempotencyKeyReusedError,
    ExperimentIdUnavailableError,
    InvalidTimeError,
    InvalidTransitionError,
    WindowAlreadyEndedError,
    WindowNotElapsedError,
)

# Fields the client supplies at create; a replay must match every one of them.
CREATE_FIELDS = (
    "id",
    "title",
    "hypothesis",
    "hypothesis_recorded_at",
    "intervention",
    "window_start",
    "window_end",
    "timezone",
    "outcome_label",
    "outcome_value_type",
    "outcome_unit_code",
    "outcome_scale_min",
    "outcome_scale_max",
)


@dataclass(frozen=True)
class TransitionResult:
    replayed: bool = False
    no_op: bool = False


def _by_create_key(db: Session, *, user_id: UUID, key: str) -> AAExperiment | None:
    return db.scalar(
        select(AAExperiment).where(
            AAExperiment.user_id == user_id, AAExperiment.idempotency_key == key
        )
    )


def _create_values(request: Any) -> dict[str, Any]:
    outcome = request.outcome
    return {
        "id": request.id,
        "title": request.title,
        "hypothesis": request.hypothesis,
        "hypothesis_recorded_at": request.hypothesis_recorded_at,
        "intervention": request.intervention,
        "window_start": request.window_start,
        "window_end": request.window_end,
        "timezone": request.timezone,
        "outcome_label": outcome.label,
        "outcome_value_type": str(outcome.value_type),
        "outcome_unit_code": outcome.unit_code,
        "outcome_scale_min": outcome.scale_min,
        "outcome_scale_max": outcome.scale_max,
    }


def _replay_create(row: AAExperiment, values: dict[str, Any]) -> UUID:
    if any(getattr(row, field) != values[field] for field in CREATE_FIELDS):
        raise ExperimentIdempotencyKeyReusedError
    return row.id


def create_experiment(db: Session, *, user_id: UUID, request: Any) -> tuple[UUID, bool]:
    """Store a DRAFT under the client-minted id. Returns ``(id, replayed)``."""
    values = _create_values(request)
    existing = _by_create_key(db, user_id=user_id, key=request.idempotency_key)
    if existing is not None:
        return _replay_create(existing, values), True

    require_not_future(request.hypothesis_recorded_at)
    # Whoever holds the id — this account under another key, or another
    # account — the answer is the same and reads nothing from that row.
    if db.scalar(select(exists().where(AAExperiment.id == request.id))):
        raise ExperimentIdUnavailableError
    try:
        db.add(
            AAExperiment(
                **values,
                user_id=user_id,
                lifecycle=L.DRAFT.value,
                idempotency_key=request.idempotency_key,
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = _by_create_key(db, user_id=user_id, key=request.idempotency_key)
        if existing is not None:
            return _replay_create(existing, values), True
        if db.scalar(select(exists().where(AAExperiment.id == request.id))):
            raise ExperimentIdUnavailableError from None
        raise
    except BaseException:
        db.rollback()
        raise
    return request.id, False


def _key_used_elsewhere(db: Session, *, user_id: UUID, key: str) -> bool:
    columns = [getattr(AAExperiment, name) for name in KEY_COLUMNS]
    return bool(
        db.scalar(
            select(
                exists().where(
                    AAExperiment.user_id == user_id, or_(*(column == key for column in columns))
                )
            )
        )
    )


def _check_preconditions(
    db: Session, row: AAExperiment, *, target: str, occurred_at: datetime
) -> None:
    require_not_future(occurred_at)
    latest = max(
        instant
        for instant in (row.hypothesis_recorded_at, row.started_at, row.completed_at)
        if instant is not None
    )
    if occurred_at < latest:
        raise InvalidTimeError
    local_day = days.local_date(occurred_at, row.timezone)
    if target == L.RUNNING and local_day > row.window_end:
        raise WindowAlreadyEndedError
    if target == L.COMPLETED_AWAITING_REVIEW:
        today = days.local_today(row.timezone, days.server_now())
        if not (local_day > row.window_end and today > row.window_end):
            raise WindowNotElapsedError
    if target == L.ABANDONED:
        # No stored adherence may lie after the stop day: those days are derived
        # «not run after stop», never recorded.
        later = db.scalar(
            select(
                exists().where(
                    AAExperimentAdherence.experiment_id == row.id,
                    AAExperimentAdherence.status == "active",
                    AAExperimentAdherence.day > local_day,
                )
            )
        )
        if later:
            raise InvalidTimeError


def transition(
    db: Session,
    *,
    user_id: UUID,
    experiment_id: UUID,
    target: str,
    occurred_at: datetime,
    key: str,
) -> TransitionResult:
    instant_column, key_column = STATE_COLUMNS[target]
    row = load_owned(db, user_id=user_id, experiment_id=experiment_id)
    settled = _settle(db, row, user_id=user_id, key=key, instant_column=instant_column,
                      key_column=key_column)
    if settled is not None:
        return settled
    source = row.lifecycle
    if (source, target) not in LEGAL_EDGES:
        db.rollback()
        raise InvalidTransitionError
    _check_preconditions(db, row, target=target, occurred_at=occurred_at)

    changes: dict[str, Any] = {"lifecycle": target, instant_column: occurred_at, key_column: key}
    if target == L.ABANDONED:
        changes["abandoned_from"] = source
    try:
        applied = db.execute(
            update(AAExperiment)
            .where(
                AAExperiment.id == experiment_id,
                AAExperiment.user_id == user_id,
                AAExperiment.lifecycle == source,
            )
            .values(**changes)
            .returning(AAExperiment.id)
            .execution_options(synchronize_session=False)
        ).first()
        if applied is not None:
            db.commit()
            return TransitionResult()
        db.rollback()
    except IntegrityError:
        db.rollback()
    except BaseException:
        db.rollback()
        raise
    # The row moved under us (or a concurrent write took the key). The request
    # was decided against a state that no longer holds, so it is never re-decided
    # into a different edge: it settles as a replay, a no-op, or a conflict.
    row = load_owned(db, user_id=user_id, experiment_id=experiment_id)
    settled = _settle(db, row, user_id=user_id, key=key, instant_column=instant_column,
                      key_column=key_column)
    if settled is not None:
        return settled
    db.rollback()
    raise InvalidTransitionError


def _settle(
    db: Session, row: AAExperiment, *, user_id: UUID, key: str, instant_column: str,
    key_column: str,
) -> TransitionResult | None:
    """Replay, key reuse and target-idempotence — decided before legality."""
    if getattr(row, key_column) == key:
        db.rollback()
        return TransitionResult(replayed=True)
    if _key_used_elsewhere(db, user_id=user_id, key=key):
        db.rollback()
        raise ExperimentIdempotencyKeyReusedError
    if getattr(row, instant_column) is not None:
        # Already entered on this row's path: a harmless duplicate (another tab,
        # an automatic period-over request). Nothing is stored.
        db.rollback()
        return TransitionResult(no_op=True)
    return None
