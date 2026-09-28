"""Seeding and request helpers for the Slice 4 Review suites.

Facts are seeded in August 2026, before the real clock, so ``GET
/reviews/context`` (always derived as of *now*) sees all of them. Values are
distinctive on purpose: residue scans search for them as strings.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from app.analytics.enums import FactStatus, SourceKind
from app.models import AAMeasurement, AAObservation, AATarget
from tests.aa_signal_helpers import (
    AUGUST_END,
    AUGUST_START,
    KYIV,
    MONTHLY_METRIC,
    PROJECT_METRIC,
    coverage_claim,
    expectation,
    forecast,
    transaction,
    utc,
)

FINANCE_SUBJECT = "finance:period:2026-08"
FINANCE_SUBJECT_IN = {"domain": "finance", "type": "period", "id": "2026-08"}
PROJECT_ID = "p-review"
PROJECT_SUBJECT = f"project:project:{PROJECT_ID}"
PROJECT_SUBJECT_IN = {"domain": "project", "type": "project", "id": PROJECT_ID}

EXPECTED_AMOUNT = "62345.67"
TX_ONE = "41234.56"
TX_TWO = "20111.11"
ACTUAL_AMOUNT = Decimal(TX_ONE) + Decimal(TX_TWO)  # 61345.67

REVIEW_TABLES = (
    "aa_reviews",
    "aa_review_revisions",
    "aa_review_context_items",
    "aa_review_context_sources",
    "aa_review_factors",
    "aa_decisions",
)


def seed_finance(
    session_factory: sessionmaker[Session], user_id: UUID, *, claim: bool = True
) -> dict[str, Any]:
    with session_factory() as db:
        exp = expectation(db, user_id=user_id, amount=EXPECTED_AMOUNT)
        one = transaction(db, user_id=user_id, amount=TX_ONE, identity="rv-1")
        two = transaction(
            db, user_id=user_id, amount=TX_TWO, identity="rv-2", occurred_at=utc(2026, 8, 10)
        )
        db.commit()
        ids = {"expectation": exp.id, "tx_one": one.id, "tx_two": two.id}
        if claim:
            coverage_claim(
                db, user_id=user_id, window_start=AUGUST_START, window_end=AUGUST_END
            )
    return ids


def target(
    db: Session,
    *,
    user_id: UUID,
    amount: str | None,
    direction: str = "lower",
    subject: tuple[str, str, str] = ("finance", "period", "2026-08"),
    metric: str = MONTHLY_METRIC,
    window: tuple[date, date] = (AUGUST_START, AUGUST_END),
) -> AATarget:
    at = datetime(2026, 8, 1, 9, 0, tzinfo=UTC)
    row = AATarget(
        user_id=user_id,
        metric_key=metric,
        subject_domain=subject[0],
        subject_type=subject[1],
        subject_id=subject[2],
        value_type="money" if metric == MONTHLY_METRIC else "date",
        unit_code="UAH" if amount is not None else None,
        value_num=Decimal(amount) if amount is not None else None,
        is_explicitly_absent=amount is None,
        desired_direction=direction,
        window_start=window[0],
        window_end=window[1],
        timezone=KYIV,
        recorded_at=at,
        source_kind=SourceKind.USER_REPORTED,
        status=FactStatus.ACTIVE,
        idempotency_key=f"review-target-{uuid4()}",
    )
    db.add(row)
    db.flush()
    return row


def observation(
    db: Session,
    *,
    user_id: UUID,
    score: str = "2",
    subject: tuple[str, str, str] = ("finance", "period", "2026-08"),
    occurred_at: datetime | None = None,
    kind: str = "observed",
) -> AAObservation:
    at = occurred_at or utc(2026, 8, 12)
    row = AAObservation(
        user_id=user_id,
        metric_key=None,
        subject_domain=subject[0],
        subject_type=subject[1],
        subject_id=subject[2],
        value_type="scale",
        value_num=Decimal(score),
        scale_min=Decimal("1"),
        scale_max=Decimal("7"),
        occurred_at=at,
        occurred_tz=KYIV,
        recorded_at=at,
        epistemic_kind=kind,
        source_kind=SourceKind.USER_REPORTED,
        status=FactStatus.ACTIVE,
        idempotency_key=f"review-observation-{uuid4()}",
    )
    db.add(row)
    db.flush()
    return row


def completion(
    db: Session, *, user_id: UUID, day: date, project_id: str = PROJECT_ID
) -> AAMeasurement:
    at = datetime.combine(day, datetime.min.time(), tzinfo=UTC).replace(hour=15)
    row = AAMeasurement(
        user_id=user_id,
        metric_key=PROJECT_METRIC,
        subject_domain="project",
        subject_type="project",
        subject_id=project_id,
        value_type="date",
        value_date=day,
        occurred_at=at,
        occurred_tz=KYIV,
        recorded_at=at,
        source_kind=SourceKind.OBSERVED,
        status=FactStatus.ACTIVE,
        idempotency_key=f"review-completion-{uuid4()}",
    )
    db.add(row)
    db.flush()
    return row


def seed_project(session_factory: sessionmaker[Session], user_id: UUID) -> dict[str, Any]:
    """The accepted G scenario: 20 → 24 → 26 Aug forecasts, Actual 25 Aug."""
    with session_factory() as db:
        first = forecast(
            db, user_id=user_id, project_id=PROJECT_ID, completion=date(2026, 8, 20),
            recorded_at=utc(2026, 8, 12),
        )
        second = forecast(
            db, user_id=user_id, project_id=PROJECT_ID, completion=date(2026, 8, 24),
            recorded_at=utc(2026, 8, 16),
        )
        latest = forecast(
            db, user_id=user_id, project_id=PROJECT_ID, completion=date(2026, 8, 26),
            recorded_at=utc(2026, 8, 20),
        )
        actual = completion(db, user_id=user_id, day=date(2026, 8, 25))
        db.commit()
        return {"forecasts": [first.id, second.id, latest.id], "actual": actual.id}


def get_context(client, subject: str = FINANCE_SUBJECT, frm="2026-08-01", to="2026-08-31"):
    return client.get(
        "/api/v1/aa/reviews/context", params={"subject": subject, "from": frm, "to": to}
    )


def review_body(context: dict[str, Any], subject_in: dict[str, str], **overrides) -> dict:
    body: dict[str, Any] = {
        "subject": dict(subject_in),
        "window_start": context["window_start"],
        "window_end": context["window_end"],
        "timezone": context["timezone"],
        "context_as_of": context["context_as_of"],
        "context_fingerprint": context["context_fingerprint"],
        "idempotency_key": f"review-save-{uuid4()}",
    }
    body.update(overrides)
    return body


def save(client, subject: str = FINANCE_SUBJECT, subject_in=None, **overrides):
    frm, to = ("2026-08-01", "2026-08-31")
    context_response = get_context(client, subject, frm, to)
    assert context_response.status_code == 200, context_response.text
    context = context_response.json()
    subject_in = subject_in or (
        FINANCE_SUBJECT_IN if subject == FINANCE_SUBJECT else PROJECT_SUBJECT_IN
    )
    response = client.post(
        "/api/v1/aa/reviews", json=review_body(context, subject_in, **overrides)
    )
    return context, response


def items_by_role(review: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {item["label_key"]: item for item in review["items"]}


def review_rows(engine, user_id: UUID) -> dict[str, list[tuple]]:
    """Every column of every Review row an account owns, for residue scans."""
    rows = {}
    with engine.connect() as connection:
        for table in REVIEW_TABLES:
            rows[table] = [
                tuple(row)
                for row in connection.execute(
                    text(f"SELECT * FROM {table} WHERE user_id = :u"), {"u": user_id}
                )
            ]
    return rows


def row_counts(engine, user_id: UUID) -> dict[str, int]:
    return {table: len(rows) for table, rows in review_rows(engine, user_id).items()}
