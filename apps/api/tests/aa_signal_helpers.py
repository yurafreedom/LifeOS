"""Seeding helpers for the Slice 3 signal suites.

Rows are written directly through the session rather than through the API
because signal semantics depend on ``recorded_at`` — the instant LifeOS learned a
fact — and the API, correctly, stamps that itself. Controlling it is the only way
to test staleness and correction re-evaluation deterministically.
"""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy.orm import Session, sessionmaker

from app.analytics.enums import (
    CoverageState,
    FactStatus,
    SourceKind,
    SupersedeKind,
)
from app.analytics.subjects import SubjectRef
from app.models import AAExpectationVersion, AAForecastVersion, AAMeasurement, AASignalEpisode
from app.services.aa_coverage_claims import CoverageClaimRequest, record_coverage_claim

KYIV = "Europe/Kyiv"
PERIOD = "2026-08"
PERIOD_SUBJECT = SubjectRef("finance", "period", PERIOD)
TRANSACTION_METRIC = "finance.transaction_amount"
MONTHLY_METRIC = "finance.monthly_spend"
PROJECT_METRIC = "project.completion_date"

AUGUST_START = date(2026, 8, 1)
AUGUST_END = date(2026, 8, 31)
# A fixed observation instant so «future days» and staleness stay deterministic.
NOW = datetime(2026, 8, 20, 12, 0, tzinfo=UTC)
# Facts default to the day before `NOW`, so a suite that is not about staleness
# does not accidentally trip the stale rule as well.
DEFAULT_FACT_INSTANT = datetime(2026, 8, 19, 9, 0, tzinfo=UTC)


def transaction(
    db: Session,
    *,
    user_id: UUID,
    amount: str,
    identity: str,
    occurred_at: datetime | None = None,
    recorded_at: datetime | None = None,
    source_kind: str = SourceKind.USER_REPORTED,
    included_by_default: bool = True,
) -> AAMeasurement:
    row = AAMeasurement(
        user_id=user_id,
        metric_key=TRANSACTION_METRIC,
        subject_domain="finance",
        subject_type="transaction",
        subject_id=identity,
        value_type="money",
        unit_code="UAH",
        value_num=Decimal(amount),
        dimensions={"included_by_default": included_by_default},
        occurred_at=occurred_at or DEFAULT_FACT_INSTANT,
        occurred_tz=KYIV,
        recorded_at=recorded_at or DEFAULT_FACT_INSTANT,
        source_kind=source_kind,
        status=FactStatus.ACTIVE,
        idempotency_key=f"signal-tx-{identity}-{uuid4()}",
    )
    db.add(row)
    db.flush()
    return row


def correct(
    db: Session,
    *,
    user_id: UUID,
    original: AAMeasurement,
    amount: str,
    recorded_at: datetime,
) -> AAMeasurement:
    """Append a correction and retire the original, exactly as the service does."""
    replacement = AAMeasurement(
        user_id=user_id,
        metric_key=original.metric_key,
        subject_domain=original.subject_domain,
        subject_type=original.subject_type,
        subject_id=original.subject_id,
        value_type="money",
        unit_code="UAH",
        value_num=Decimal(amount),
        dimensions=original.dimensions,
        occurred_at=original.occurred_at,
        occurred_tz=original.occurred_tz,
        recorded_at=recorded_at,
        source_kind=SourceKind.USER_REPORTED,
        status=FactStatus.ACTIVE,
        supersedes_id=original.id,
        idempotency_key=f"signal-correction-{uuid4()}",
    )
    db.add(replacement)
    db.flush()
    original.status = FactStatus.SUPERSEDED
    original.superseded_at = recorded_at
    original.superseded_by_id = replacement.id
    original.supersede_kind = SupersedeKind.CORRECTION
    db.flush()
    return replacement


def expectation(
    db: Session,
    *,
    user_id: UUID,
    amount: str,
    period: str = PERIOD,
    recorded_at: datetime | None = None,
) -> AAExpectationVersion:
    at = recorded_at or datetime(2026, 8, 1, 8, 0, tzinfo=UTC)
    row = AAExpectationVersion(
        user_id=user_id,
        metric_key=MONTHLY_METRIC,
        subject_domain="finance",
        subject_type="period",
        subject_id=period,
        value_type="money",
        unit_code="UAH",
        value_num=Decimal(amount),
        window_start=AUGUST_START,
        window_end=AUGUST_END,
        timezone=KYIV,
        effective_from=at,
        recorded_at=at,
        source_kind=SourceKind.USER_REPORTED,
        status=FactStatus.ACTIVE,
        idempotency_key=f"signal-expectation-{uuid4()}",
    )
    db.add(row)
    db.flush()
    return row


def forecast(
    db: Session,
    *,
    user_id: UUID,
    project_id: str,
    completion: date,
    recorded_at: datetime,
) -> AAForecastVersion:
    row = AAForecastVersion(
        user_id=user_id,
        metric_key=PROJECT_METRIC,
        subject_domain="project",
        subject_type="project",
        subject_id=project_id,
        value_type="date",
        value_date=completion,
        horizon_at=datetime.combine(completion, datetime.min.time(), tzinfo=UTC),
        recorded_at=recorded_at,
        source_kind=SourceKind.USER_REPORTED,
        status=FactStatus.ACTIVE,
        idempotency_key=f"signal-forecast-{uuid4()}",
    )
    db.add(row)
    db.flush()
    return row


def coverage_claim(
    db: Session,
    *,
    user_id: UUID,
    window_start: date,
    window_end: date,
    coverage_state: str = CoverageState.COMPLETE,
    completeness_known: bool = True,
    period: str = PERIOD,
) -> None:
    record_coverage_claim(
        db,
        user_id=user_id,
        request=CoverageClaimRequest(
            source_id="monobank",
            subject=SubjectRef("finance", "period", period),
            window_start_date=window_start,
            window_end_date=window_end,
            timezone=KYIV,
            coverage_state=coverage_state,
            completeness_known=completeness_known,
            source_kind=SourceKind.IMPORTED,
            idempotency_key=f"signal-coverage-{uuid4()}",
        ),
    )


def spend_at_percent(
    db: Session,
    *,
    user_id: UUID,
    percent: int,
    reference: str = "1000",
    identity: str = "tx",
    recorded_at: datetime | None = None,
) -> AAMeasurement:
    """One transaction placing the period at ``percent`` of its expectation."""
    amount = (Decimal(reference) * Decimal(percent)) / Decimal(100)
    return transaction(
        db,
        user_id=user_id,
        amount=str(amount),
        identity=identity,
        recorded_at=recorded_at,
    )


def episodes(db: Session, *, user_id: UUID) -> list[AASignalEpisode]:
    return list(
        db.query(AASignalEpisode)
        .filter(AASignalEpisode.user_id == user_id)
        .order_by(AASignalEpisode.episode_key)
        .all()
    )


def report(session_factory: sessionmaker[Session], user_id: UUID, **overrides):
    from app.services.aa_signals import evaluate_signals

    options: dict[str, object] = {"now": NOW, "timezone": KYIV, "limit": 3}
    options.update(overrides)
    with session_factory() as db:
        return evaluate_signals(db, user_id=user_id, **options)


def days_before(moment: datetime, days: int) -> datetime:
    return moment - timedelta(days=days)


def utc(year: int, month: int, day: int, hour: int = 12) -> datetime:
    return datetime(year, month, day, hour, tzinfo=UTC)
