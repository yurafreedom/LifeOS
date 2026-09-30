"""Deterministic ORM seeding for the destructive Slice 8 suites (``lifeos_test`` only).

Rows are written through the session so every semantic instant (``occurred_at``,
``recorded_at``, windows) is controlled exactly. The pinned clock is
2026-09-30 12:00 UTC, so a 24-month policy has its horizon at 2024-09-01 (Kyiv).
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text

from app.analytics.enums import FactStatus, SourceKind, SupersedeKind
from app.models import (
    AABaseline,
    AAExpectationVersion,
    AAExperiment,
    AAExperimentAdherence,
    AAExperimentObservation,
    AAForecastVersion,
    AAMeasurement,
    AAMetricMembershipOverride,
    AAMetricPolicyVersion,
    AAObservation,
    AAPreference,
    AASignalEpisode,
    AASourceCoverage,
    AATarget,
)

NOW = datetime(2026, 9, 30, 12, 0, tzinfo=UTC)
HORIZON_24 = date(2024, 9, 1)
KYIV = "Europe/Kyiv"
TX = "finance.transaction_amount"
MONTHLY = "finance.monthly_spend"
PROJECT = "project.completion_date"


def utc(year: int, month: int, day: int, hour: int = 9) -> datetime:
    return datetime(year, month, day, hour, tzinfo=UTC)


def _key(prefix: str) -> str:
    return f"seed-{prefix}-{uuid4()}"


def tx(db, user_id: UUID, amount: str, occurred: datetime, *, recorded: datetime | None = None,
       subject_id: str | None = None, source_ref: dict | None = None,
       domain: tuple[str, str] = ("finance", "transaction"), metric: str = TX,
       value_date: date | None = None) -> AAMeasurement:
    row = AAMeasurement(
        user_id=user_id, metric_key=metric, subject_domain=domain[0], subject_type=domain[1],
        subject_id=subject_id or f"t-{uuid4()}",
        value_type="date" if value_date else "money",
        unit_code=None if value_date else "UAH",
        value_num=None if value_date else Decimal(amount),
        value_date=value_date,
        dimensions={"category_id": "food", "included_by_default": True},
        occurred_at=occurred, occurred_tz=KYIV, recorded_at=recorded or occurred,
        source_kind=SourceKind.USER_REPORTED, basis="seed basis", method="seed method",
        source_ref=source_ref, status=FactStatus.ACTIVE, idempotency_key=_key("tx"),
    )
    db.add(row)
    db.flush()
    return row


def correct(db, original, amount: str, recorded: datetime, *, occurred: datetime | None = None):
    """A correction exactly as the service writes it (``occurred`` override only for
    deliberately malformed straddling chains)."""
    replacement = AAMeasurement(
        user_id=original.user_id, metric_key=original.metric_key,
        subject_domain=original.subject_domain, subject_type=original.subject_type,
        subject_id=original.subject_id, value_type=original.value_type,
        unit_code=original.unit_code,
        value_num=Decimal(amount) if original.value_type == "money" else None,
        value_date=original.value_date,
        dimensions=original.dimensions, occurred_at=occurred or original.occurred_at,
        occurred_tz=original.occurred_tz, recorded_at=recorded,
        source_kind=SourceKind.USER_REPORTED, status=FactStatus.ACTIVE,
        supersedes_id=original.id, idempotency_key=_key("corr"),
    )
    db.add(replacement)
    db.flush()
    original.status = FactStatus.SUPERSEDED
    original.superseded_at = recorded
    original.superseded_by_id = replacement.id
    original.supersede_kind = SupersedeKind.CORRECTION
    db.flush()
    return replacement


def override(db, user_id: UUID, measurement: AAMeasurement, *, supersedes=None,
             recorded: datetime | None = None) -> AAMetricMembershipOverride:
    at = recorded or measurement.recorded_at
    row = AAMetricMembershipOverride(
        user_id=user_id, metric_key=MONTHLY, source_table="aa_measurements",
        source_fact_id=measurement.id, included=supersedes is None, recorded_at=at,
        source_kind=SourceKind.USER_REPORTED, status=FactStatus.ACTIVE,
        supersedes_id=supersedes.id if supersedes is not None else None,
        idempotency_key=_key("override"),
    )
    db.add(row)
    db.flush()
    if supersedes is not None:
        supersedes.status = FactStatus.SUPERSEDED
        supersedes.superseded_at = at
        supersedes.superseded_by_id = row.id
        supersedes.supersede_kind = SupersedeKind.REVISION
        db.flush()
    return row


def coverage(db, user_id: UUID, start: date, end: date, period: str) -> AASourceCoverage:
    row = AASourceCoverage(
        user_id=user_id, source_id="bank", metric_key=MONTHLY, subject_domain="finance",
        subject_type="period", subject_id=period, window_start_date=start, window_end_date=end,
        timezone=KYIV, coverage_state="complete", completeness_known=True,
        recorded_at=utc(start.year, start.month, start.day),
        source_kind=SourceKind.IMPORTED, original_recorded_at_known=False,
        status=FactStatus.ACTIVE, idempotency_key=_key("coverage"),
    )
    db.add(row)
    db.flush()
    return row


def windowed(db, model, user_id: UUID, start: date, end: date, *, amount: str = "5000",
             subject: tuple[str, str, str] | None = None, recorded: datetime | None = None,
             supersedes=None):
    subject = subject or ("finance", "period", f"{start.year:04d}-{start.month:02d}")
    at = recorded or utc(start.year, start.month, start.day)
    values: dict[str, Any] = dict(
        user_id=user_id, metric_key=MONTHLY, subject_domain=subject[0],
        subject_type=subject[1], subject_id=subject[2], value_type="money", unit_code="UAH",
        value_num=Decimal(amount), window_start=start, window_end=end, timezone=KYIV,
        recorded_at=at, source_kind=SourceKind.USER_REPORTED, status=FactStatus.ACTIVE,
        supersedes_id=supersedes.id if supersedes is not None else None,
        idempotency_key=_key(model.__tablename__),
    )
    if model is AAExpectationVersion:
        values["effective_from"] = at
    if model is AATarget:
        values["desired_direction"] = "lower"
    row = model(**values)
    db.add(row)
    db.flush()
    if supersedes is not None:
        supersedes.status = FactStatus.SUPERSEDED
        supersedes.superseded_at = at
        supersedes.superseded_by_id = row.id
        supersedes.supersede_kind = SupersedeKind.REVISION
        db.flush()
    return row


def preference(db, user_id: UUID, recorded: datetime, *, tombstoned: datetime | None = None):
    row = AAPreference(
        user_id=user_id, metric_key=MONTHLY, subject_domain="finance", subject_type="period",
        subject_id="*", statement=None if tombstoned else "меньше тратить",
        desired_direction=None if tombstoned else "lower", effective_from=recorded,
        recorded_at=recorded, source_kind=SourceKind.USER_REPORTED,
        status=FactStatus.TOMBSTONED if tombstoned else FactStatus.ACTIVE,
        tombstoned_at=tombstoned, idempotency_key=_key("pref"),
    )
    db.add(row)
    db.flush()
    return row


def policy_version(db, user_id: UUID, recorded: datetime) -> AAMetricPolicyVersion:
    row = AAMetricPolicyVersion(
        user_id=user_id, metric_key=MONTHLY,
        policy={"exclude_categories": [], "default": "include"}, effective_from=recorded,
        recorded_at=recorded, source_kind=SourceKind.USER_REPORTED,
        status=FactStatus.ACTIVE, idempotency_key=_key("policy"),
    )
    db.add(row)
    db.flush()
    return row


def observation(db, user_id: UUID, occurred: datetime, *,
                subject: tuple[str, str, str] = ("finance", "period", "2024-03")):
    row = AAObservation(
        user_id=user_id, metric_key=None, subject_domain=subject[0], subject_type=subject[1],
        subject_id=subject[2], value_type="scale", value_num=Decimal("3"),
        scale_min=Decimal("1"), scale_max=Decimal("7"), occurred_at=occurred, occurred_tz=KYIV,
        recorded_at=occurred, epistemic_kind="observed", source_kind=SourceKind.USER_REPORTED,
        status=FactStatus.ACTIVE, idempotency_key=_key("obs"),
    )
    db.add(row)
    db.flush()
    return row


def forecast(db, user_id: UUID, project_id: str, completion: date, recorded: datetime,
             *, supersedes=None) -> AAForecastVersion:
    row = AAForecastVersion(
        user_id=user_id, metric_key=PROJECT, subject_domain="project", subject_type="project",
        subject_id=project_id, value_type="date", value_date=completion,
        horizon_at=datetime.combine(completion, datetime.min.time(), tzinfo=UTC),
        recorded_at=recorded, source_kind=SourceKind.USER_REPORTED, status=FactStatus.ACTIVE,
        supersedes_id=supersedes.id if supersedes is not None else None,
        idempotency_key=_key("forecast"),
    )
    db.add(row)
    db.flush()
    if supersedes is not None:
        supersedes.status = FactStatus.SUPERSEDED
        supersedes.superseded_at = recorded
        supersedes.superseded_by_id = row.id
        supersedes.supersede_kind = SupersedeKind.REVISION
        db.flush()
    return row


def completion(db, user_id: UUID, project_id: str, day: date) -> AAMeasurement:
    return tx(db, user_id, "0", utc(day.year, day.month, day.day), subject_id=project_id,
              domain=("project", "project"), metric=PROJECT, value_date=day)


def episode(db, user_id: UUID, subject: tuple[str, str, str], rule: str) -> AASignalEpisode:
    now = utc(2026, 9, 1)
    row = AASignalEpisode(
        user_id=user_id, subject_domain=subject[0], subject_type=subject[1],
        subject_id=subject[2], episode_key=f"{rule}:{subject[2]}:{uuid4()}", rule_id=rule,
        rule_version=1, first_seen_at=now, last_evaluated_at=now, last_fingerprint="d" * 64,
    )
    db.add(row)
    db.flush()
    return row


def experiment(db, user_id: UUID) -> AAExperiment:
    row = AAExperiment(
        id=uuid4(), user_id=user_id, title="Без кофе", hypothesis="Сплю лучше",
        hypothesis_recorded_at=utc(2023, 1, 1), intervention="Нет кофе после 14:00",
        window_start=date(2023, 1, 2), window_end=date(2023, 1, 30), timezone=KYIV,
        outcome_label="Сон", outcome_value_type="count", idempotency_key=_key("exp"),
    )
    db.add(row)
    db.flush()
    subject = ("experiment", "experiment", str(row.id))
    windowed(db, AABaseline, user_id, date(2022, 12, 1), date(2022, 12, 31), subject=subject)
    observation(db, user_id, utc(2023, 1, 10), subject=subject)
    db.add(AAExperimentAdherence(
        user_id=user_id, experiment_id=row.id, day=date(2023, 1, 3), state="kept",
        recorded_at=utc(2023, 1, 3), source_kind=SourceKind.USER_REPORTED,
        status=FactStatus.ACTIVE, idempotency_key=_key("adh"),
    ))
    db.add(AAExperimentObservation(
        user_id=user_id, experiment_id=row.id, role="context", label="шаги",
        subject_domain="experiment", subject_type="experiment", subject_id=str(row.id),
        value_type="count", value_num=Decimal("5000"), occurred_at=utc(2023, 1, 5),
        occurred_tz=KYIV, recorded_at=utc(2023, 1, 5), source_kind=SourceKind.USER_REPORTED,
        status=FactStatus.ACTIVE, idempotency_key=_key("expobs"),
    ))
    db.flush()
    return row


def counts(engine, user_id: UUID) -> dict[str, int]:
    """Row counts of every ``aa_*`` table for one account (catalogue excluded)."""
    with engine.begin() as connection:
        names = list(connection.scalars(text(
            "SELECT table_name FROM information_schema.tables"
            " WHERE table_schema = 'public' AND table_name LIKE 'aa\\_%'"
            " AND table_name <> 'aa_metric_definitions' ORDER BY 1"
        )))
        return {
            name: connection.scalar(
                text(f"SELECT count(*) FROM {name} WHERE user_id = :u"), {"u": user_id}
            )
            for name in names
        }


def exists(engine, table: str, identity: UUID) -> bool:
    with engine.begin() as connection:
        return bool(connection.scalar(
            text(f"SELECT count(*) FROM {table} WHERE id = :id"), {"id": identity}
        ))
