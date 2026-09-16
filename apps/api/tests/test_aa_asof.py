"""As-of reconstruction — what did LifeOS believe at an earlier instant?

A correction changes what is true now without changing what was believed then.
An as-of read taken before the correction must still return the original value,
otherwise history would be quietly rewritten every time a mistake was fixed.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.analytics.enums import FactStatus, SourceKind
from app.config import Settings
from app.models import AAMeasurement
from app.services.aa_facts import read_as_of
from tests.aa_helpers import (
    METRIC_TRANSACTION,
    authenticate,
    correction_payload,
    measurement_payload,
    money,
)

RANGE = {
    "from": "2026-08-01T00:00:00+00:00",
    "to": "2026-08-31T23:59:59+00:00",
    "subject": "finance:transaction:t01",
}


def history_values(client: TestClient, **params: object) -> list[Decimal]:
    response = client.get(
        f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history", params={**RANGE, **params}
    )
    assert response.status_code == 200
    return [Decimal(row["value"]["num"]) for row in response.json()["actual"]]


def test_as_of_before_a_correction_returns_the_original(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("asof@example.com")
    authenticate(client, settings, account)

    original = client.post(
        "/api/v1/aa/measurements", json=measurement_payload(value=money("12000.00"))
    ).json()
    before_correction = original["provenance"]["recorded_at"]

    corrected = client.post(
        f"/api/v1/aa/measurements/{original['id']}/correct",
        json=correction_payload(value=money("1200.00")),
    ).json()
    after_correction = corrected["measurement"]["provenance"]["recorded_at"]

    assert history_values(client, as_of=before_correction) == [Decimal("12000.00")]
    assert history_values(client, as_of=after_correction) == [Decimal("1200.00")]
    # With no as_of the answer is current truth.
    assert history_values(client) == [Decimal("1200.00")]


def test_as_of_before_a_fact_existed_returns_nothing(
    client: TestClient, account_factory, settings: Settings
) -> None:
    # Nothing was known then, so nothing is returned — and no placeholder row is
    # invented to fill the gap.
    account = account_factory("asof-empty@example.com")
    authenticate(client, settings, account)

    created = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    recorded_at = datetime.fromisoformat(created["provenance"]["recorded_at"])
    assert history_values(client, as_of=(recorded_at - timedelta(seconds=1)).isoformat()) == []


def test_as_of_ties_resolve_deterministically(
    session_factory: sessionmaker[Session], account_factory
) -> None:
    # Two rows recorded in the very same instant must always resolve the same
    # way: `ORDER BY recorded_at DESC, id DESC` breaks the tie by id.
    account = account_factory("asof-tie@example.com")
    instant = datetime(2026, 8, 20, 8, 40, tzinfo=UTC)
    ids = sorted(uuid4() for _ in range(2))

    with session_factory.begin() as db:
        for index, fact_id in enumerate(ids):
            db.add(
                AAMeasurement(
                    id=fact_id,
                    user_id=account.user_id,
                    metric_key=METRIC_TRANSACTION,
                    subject_domain="finance",
                    subject_type="transaction",
                    subject_id="tie",
                    value_type="money",
                    unit_code="UAH",
                    value_num=Decimal(index + 1),
                    occurred_at=instant,
                    occurred_tz="Europe/Kyiv",
                    recorded_at=instant,
                    source_kind=SourceKind.USER_REPORTED,
                    status=FactStatus.ACTIVE,
                    idempotency_key=f"idem-tie-{index}",
                )
            )

    with session_factory() as db:
        for _ in range(3):
            resolved = read_as_of(
                db,
                user_id=account.user_id,
                subject_key="finance:transaction:tie",
                as_of=instant,
            )
            assert resolved is not None
            assert resolved.id == ids[-1]


def test_a_tombstoned_fact_is_excluded_from_as_of_reads(
    session_factory: sessionmaker[Session], account_factory
) -> None:
    account = account_factory("asof-tombstone@example.com")
    instant = datetime(2026, 8, 20, 8, 40, tzinfo=UTC)

    with session_factory.begin() as db:
        db.add(
            AAMeasurement(
                user_id=account.user_id,
                metric_key=METRIC_TRANSACTION,
                subject_domain="finance",
                subject_type="transaction",
                subject_id="gone",
                value_type="money",
                unit_code="UAH",
                value_num=Decimal("5"),
                occurred_at=instant,
                occurred_tz="Europe/Kyiv",
                recorded_at=instant,
                source_kind=SourceKind.USER_REPORTED,
                status=FactStatus.TOMBSTONED,
                tombstoned_at=instant,
                idempotency_key="idem-tombstoned",
            )
        )

    with session_factory() as db:
        assert (
            read_as_of(
                db,
                user_id=account.user_id,
                subject_key="finance:transaction:gone",
                as_of=instant + timedelta(days=1),
            )
            is None
        )
