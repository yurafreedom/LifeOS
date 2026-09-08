"""Append, correct and read semantic facts.

Three behaviours here are load-bearing and are covered by permanent regression
tests:

* **Idempotency.** ``UNIQUE (user_id, idempotency_key)`` plus a lookup-then-
  insert-then-recover-from-conflict sequence means a retried write returns the
  fact it already created. A retry is not a new observation.
* **Correction.** The original is never updated in place. A predicate CAS claims
  the target only while it is unclaimed, so two concurrent corrections cannot
  both succeed and history cannot fork.
* **Isolation.** Every statement leads with ``user_id``, taken from the
  authenticated session. A fact belonging to another account is indistinguishable
  from a fact that does not exist.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.asof import apply_as_of
from app.analytics.enums import FactStatus, SupersedeKind
from app.analytics.subjects import SubjectRef
from app.models import AAMeasurement, AAMetricDefinition
from app.schemas.aa_measurement import MeasurementCorrect, MeasurementCreate

logger = logging.getLogger(__name__)

MAX_HISTORY_LIMIT = 200
DEFAULT_HISTORY_LIMIT = 50


class AAServiceError(Exception):
    """Base for failures that map onto a stable API error code."""

    code = "aa_error"
    message = "Adaptive Analytics request failed."


class FactNotFoundError(AAServiceError):
    code = "fact_not_found"
    message = "Fact not found."


class MetricNotFoundError(AAServiceError):
    code = "metric_not_found"
    message = "Metric definition not found."


class MetricValueMismatchError(AAServiceError):
    code = "metric_value_type_mismatch"
    message = "Value does not match the metric definition."


class CorrectionConflictError(AAServiceError):
    code = "correction_conflict"
    message = "This fact has already been superseded."


@dataclass(frozen=True, slots=True)
class AppendResult:
    measurement: AAMeasurement
    replayed: bool


@dataclass(frozen=True, slots=True)
class CorrectionResult:
    measurement: AAMeasurement
    superseded: AAMeasurement
    replayed: bool


def _find_by_idempotency_key(
    db: Session, *, user_id: UUID, idempotency_key: str
) -> AAMeasurement | None:
    return db.scalar(
        select(AAMeasurement).where(
            AAMeasurement.user_id == user_id,
            AAMeasurement.idempotency_key == idempotency_key,
        )
    )


def get_measurement(db: Session, *, user_id: UUID, measurement_id: UUID) -> AAMeasurement:
    """Load one fact owned by this account, or raise as if it did not exist."""
    row = db.scalar(
        select(AAMeasurement).where(
            AAMeasurement.user_id == user_id,
            AAMeasurement.id == measurement_id,
        )
    )
    if row is None:
        raise FactNotFoundError
    return row


def _resolve_metric(db: Session, metric_key: str) -> AAMetricDefinition:
    definition = db.get(AAMetricDefinition, metric_key)
    if definition is None:
        raise MetricNotFoundError
    return definition


def _assert_value_matches_metric(definition: AAMetricDefinition, value: Any) -> None:
    """A metric owns its unit. A fact may not quietly disagree with its metric."""
    if definition.value_type != value.type:
        raise MetricValueMismatchError
    if definition.unit_code is not None and definition.unit_code != value.unit_code:
        raise MetricValueMismatchError


def append_measurement(
    db: Session, *, user_id: UUID, request: MeasurementCreate
) -> AppendResult:
    existing = _find_by_idempotency_key(
        db, user_id=user_id, idempotency_key=request.idempotency_key
    )
    if existing is not None:
        logger.info(
            "aa.idempotency_replay",
            extra={
                "aa_table": AAMeasurement.__tablename__,
                "aa_fact_id": str(existing.id),
                "aa_user_id": str(user_id),
            },
        )
        return AppendResult(measurement=existing, replayed=True)

    definition = _resolve_metric(db, request.metric_key)
    _assert_value_matches_metric(definition, request.value)
    subject: SubjectRef = request.subject.to_ref()
    value = request.value.to_fact_value()

    measurement = AAMeasurement(
        user_id=user_id,
        metric_key=request.metric_key,
        subject_domain=subject.subject_domain,
        subject_type=subject.subject_type,
        subject_id=subject.subject_id,
        value_type=value.value_type,
        unit_code=value.unit_code,
        value_num=value.value_num,
        value_date=value.value_date,
        value_text=value.value_text,
        scale_min=value.scale_min,
        scale_max=value.scale_max,
        dimensions=request.dimensions,
        occurred_at=request.occurred_at,
        occurred_tz=request.occurred_tz,
        source_kind=request.provenance.source_kind,
        basis=request.provenance.basis,
        method=request.provenance.method,
        source_ref=request.provenance.source_ref,
        original_recorded_at_known=request.provenance.original_recorded_at_known,
        status=FactStatus.ACTIVE,
        idempotency_key=request.idempotency_key,
    )
    db.add(measurement)
    try:
        db.commit()
    except IntegrityError:
        # Another writer used the same key between the lookup and the insert.
        db.rollback()
        replayed = _find_by_idempotency_key(
            db, user_id=user_id, idempotency_key=request.idempotency_key
        )
        if replayed is None:
            raise
        logger.info(
            "aa.idempotency_replay_race",
            extra={
                "aa_table": AAMeasurement.__tablename__,
                "aa_fact_id": str(replayed.id),
                "aa_user_id": str(user_id),
            },
        )
        return AppendResult(measurement=replayed, replayed=True)

    db.refresh(measurement)
    return AppendResult(measurement=measurement, replayed=False)


def correct_measurement(
    db: Session,
    *,
    user_id: UUID,
    measurement_id: UUID,
    request: MeasurementCorrect,
) -> CorrectionResult:
    """Replace a wrong value while preserving the record that it was believed.

    A replay of the same idempotency key returns the correction that was already
    made rather than reporting a conflict — the caller is retrying one write,
    not attempting a second one.
    """
    existing = _find_by_idempotency_key(
        db, user_id=user_id, idempotency_key=request.idempotency_key
    )
    if existing is not None:
        if existing.supersedes_id != measurement_id:
            raise CorrectionConflictError
        superseded = get_measurement(db, user_id=user_id, measurement_id=measurement_id)
        logger.info(
            "aa.idempotency_replay",
            extra={
                "aa_table": AAMeasurement.__tablename__,
                "aa_fact_id": str(existing.id),
                "aa_user_id": str(user_id),
            },
        )
        return CorrectionResult(measurement=existing, superseded=superseded, replayed=True)

    target = get_measurement(db, user_id=user_id, measurement_id=measurement_id)
    if target.status == FactStatus.TOMBSTONED:
        raise CorrectionConflictError

    definition = _resolve_metric(db, target.metric_key)
    _assert_value_matches_metric(definition, request.value)
    value = request.value.to_fact_value()

    replacement = AAMeasurement(
        user_id=user_id,
        metric_key=target.metric_key,
        subject_domain=target.subject_domain,
        subject_type=target.subject_type,
        subject_id=target.subject_id,
        value_type=value.value_type,
        unit_code=value.unit_code,
        value_num=value.value_num,
        value_date=value.value_date,
        value_text=value.value_text,
        scale_min=value.scale_min,
        scale_max=value.scale_max,
        dimensions=request.dimensions if request.dimensions is not None else target.dimensions,
        occurred_at=target.occurred_at,
        occurred_tz=target.occurred_tz,
        source_kind=request.provenance.source_kind,
        basis=request.provenance.basis,
        method=request.provenance.method,
        source_ref=request.provenance.source_ref,
        original_recorded_at_known=request.provenance.original_recorded_at_known,
        status=FactStatus.ACTIVE,
        supersedes_id=target.id,
        idempotency_key=request.idempotency_key,
    )
    db.add(replacement)
    try:
        # uq_aa_measurements_supersedes_id fires here when another correction
        # already claimed this predecessor: a row may have only one successor.
        db.flush()
    except IntegrityError:
        db.rollback()
        logger.info(
            "aa.correction_conflict_unique",
            extra={
                "aa_table": AAMeasurement.__tablename__,
                "aa_fact_id": str(measurement_id),
                "aa_user_id": str(user_id),
            },
        )
        raise CorrectionConflictError from None

    # Predicate CAS: claim the target only while it is unclaimed. Zero rows
    # means someone else corrected it first, so this correction must not land.
    claimed = db.execute(
        update(AAMeasurement)
        .where(
            AAMeasurement.id == measurement_id,
            AAMeasurement.user_id == user_id,
            AAMeasurement.superseded_at.is_(None),
            AAMeasurement.status == FactStatus.ACTIVE,
        )
        .values(
            status=FactStatus.SUPERSEDED,
            superseded_at=func.now(),
            superseded_by_id=replacement.id,
            supersede_kind=SupersedeKind.CORRECTION,
            supersede_reason=request.reason,
        )
    ).rowcount

    if claimed != 1:
        db.rollback()
        logger.info(
            "aa.correction_conflict",
            extra={
                "aa_table": AAMeasurement.__tablename__,
                "aa_fact_id": str(measurement_id),
                "aa_user_id": str(user_id),
            },
        )
        raise CorrectionConflictError

    db.commit()
    db.refresh(replacement)
    superseded = get_measurement(db, user_id=user_id, measurement_id=measurement_id)
    return CorrectionResult(measurement=replacement, superseded=superseded, replayed=False)


def _history_statement(
    *,
    user_id: UUID,
    metric_key: str,
    subject_key: str | None,
    range_from: datetime,
    range_to: datetime,
    as_of: datetime | None,
) -> Select[tuple[AAMeasurement]]:
    statement = select(AAMeasurement).where(
        AAMeasurement.user_id == user_id,
        AAMeasurement.metric_key == metric_key,
        AAMeasurement.occurred_at >= range_from,
        AAMeasurement.occurred_at <= range_to,
    )
    if subject_key is not None:
        statement = statement.where(AAMeasurement.subject_key == subject_key)
    return apply_as_of(statement, AAMeasurement, as_of)


def read_history(
    db: Session,
    *,
    user_id: UUID,
    metric_key: str,
    subject_key: str | None,
    range_from: datetime,
    range_to: datetime,
    as_of: datetime | None = None,
    cursor: tuple[datetime, UUID] | None = None,
    limit: int = DEFAULT_HISTORY_LIMIT,
) -> list[AAMeasurement]:
    """Read one page of actuals, keyset-paginated on ``(occurred_at, id)``.

    Keyset rather than offset: history is appended to continuously, and an
    offset would silently skip or repeat rows as it grows.
    """
    statement = _history_statement(
        user_id=user_id,
        metric_key=metric_key,
        subject_key=subject_key,
        range_from=range_from,
        range_to=range_to,
        as_of=as_of,
    )
    if cursor is not None:
        cursor_occurred_at, cursor_id = cursor
        statement = statement.where(
            (AAMeasurement.occurred_at, AAMeasurement.id) > (cursor_occurred_at, cursor_id)
        )
    statement = statement.order_by(AAMeasurement.occurred_at, AAMeasurement.id).limit(limit)
    return list(db.scalars(statement))


def read_as_of(
    db: Session,
    *,
    user_id: UUID,
    subject_key: str,
    as_of: datetime,
    metric_key: str | None = None,
) -> AAMeasurement | None:
    """The single fact in force for a subject at an instant."""
    statement = select(AAMeasurement).where(
        AAMeasurement.user_id == user_id,
        AAMeasurement.subject_key == subject_key,
    )
    if metric_key is not None:
        statement = statement.where(AAMeasurement.metric_key == metric_key)
    statement = apply_as_of(statement, AAMeasurement, as_of).order_by(
        AAMeasurement.recorded_at.desc(), AAMeasurement.id.desc()
    )
    return db.scalars(statement.limit(1)).first()
