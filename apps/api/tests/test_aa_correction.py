"""Permanent regression test T-03 — a correction counts once, the original survives.

Correcting a fact never updates it in place. A replacement row is inserted, the
original is marked superseded, and every aggregate reads the active set — so the
corrected value is counted exactly once and the record that ₴12,000 was once
believed remains discoverable.
"""

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.analytics.enums import FactStatus
from app.config import Settings
from app.models import AAMeasurement
from tests.aa_helpers import (
    METRIC_TRANSACTION,
    authenticate,
    correction_payload,
    measurement_payload,
    money,
)


def active_total(session_factory: sessionmaker[Session]) -> Decimal:
    with session_factory() as db:
        return db.scalar(
            select(func.coalesce(func.sum(AAMeasurement.value_num), 0)).where(
                AAMeasurement.status == FactStatus.ACTIVE
            )
        )


def test_correction_replaces_the_value_and_preserves_the_original(
    client: TestClient, account_factory, settings: Settings, session_factory
) -> None:
    account = account_factory("correct@example.com")
    authenticate(client, settings, account)

    original = client.post(
        "/api/v1/aa/measurements", json=measurement_payload(value=money("12000.00"))
    ).json()

    corrected = client.post(
        f"/api/v1/aa/measurements/{original['id']}/correct",
        json=correction_payload(value=money("1200.00")),
    )
    assert corrected.status_code == 201
    body = corrected.json()

    assert body["measurement"]["status"] == "active"
    assert Decimal(body["measurement"]["value"]["num"]) == Decimal("1200.00")
    assert body["measurement"]["supersedes_id"] == original["id"]

    assert body["superseded"]["id"] == original["id"]
    assert body["superseded"]["status"] == "superseded"
    assert body["superseded"]["supersede_kind"] == "CORRECTION"
    assert body["superseded"]["supersede_reason"] == "Сумма записана с лишним нулём"
    assert Decimal(body["superseded"]["value"]["num"]) == Decimal("12000.00")

    # Both rows exist; only the replacement is active, so the corrected value is
    # counted once and the mistaken value is not counted at all.
    with session_factory() as db:
        assert db.scalar(select(func.count(AAMeasurement.id))) == 2
    assert active_total(session_factory) == Decimal("1200.00")


def test_the_original_stays_discoverable_after_correction(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("discover@example.com")
    authenticate(client, settings, account)

    original = client.post(
        "/api/v1/aa/measurements", json=measurement_payload(value=money("12000.00"))
    ).json()
    client.post(
        f"/api/v1/aa/measurements/{original['id']}/correct",
        json=correction_payload(value=money("1200.00")),
    )

    provenance = client.get(
        f"/api/v1/aa/facts/aa_measurements/{original['id']}/provenance"
    )
    assert provenance.status_code == 200
    assert provenance.json()["status"] == "superseded"
    assert provenance.json()["supersede_kind"] == "CORRECTION"
    assert provenance.json()["superseded_by_id"] is not None


def test_current_history_shows_the_corrected_value_once(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("once@example.com")
    authenticate(client, settings, account)

    original = client.post(
        "/api/v1/aa/measurements", json=measurement_payload(value=money("12000.00"))
    ).json()
    client.post(
        f"/api/v1/aa/measurements/{original['id']}/correct",
        json=correction_payload(value=money("1200.00")),
    )

    history = client.get(
        f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history",
        params={
            "from": "2026-08-01T00:00:00+00:00",
            "to": "2026-08-31T23:59:59+00:00",
        },
    ).json()
    assert len(history["actual"]) == 1
    assert Decimal(history["actual"][0]["value"]["num"]) == Decimal("1200.00")


def test_a_second_correction_of_the_same_row_conflicts(
    client: TestClient, account_factory, settings: Settings, session_factory
) -> None:
    account = account_factory("conflict@example.com")
    authenticate(client, settings, account)

    original = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    client.post(
        f"/api/v1/aa/measurements/{original['id']}/correct",
        json=correction_payload(idempotency_key="idem-correction-first"),
    )
    second = client.post(
        f"/api/v1/aa/measurements/{original['id']}/correct",
        json=correction_payload(idempotency_key="idem-correction-second"),
    )
    assert second.status_code == 409
    assert second.json()["code"] == "correction_conflict"

    # The rejected attempt left nothing behind.
    with session_factory() as db:
        assert db.scalar(select(func.count(AAMeasurement.id))) == 2


def test_replaying_one_correction_does_not_conflict_with_itself(
    client: TestClient, account_factory, settings: Settings, session_factory
) -> None:
    account = account_factory("correct-retry@example.com")
    authenticate(client, settings, account)

    original = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    payload = correction_payload()

    first = client.post(f"/api/v1/aa/measurements/{original['id']}/correct", json=payload)
    assert first.status_code == 201
    second = client.post(f"/api/v1/aa/measurements/{original['id']}/correct", json=payload)
    assert second.status_code == 200
    assert second.json()["measurement"]["id"] == first.json()["measurement"]["id"]

    with session_factory() as db:
        assert db.scalar(select(func.count(AAMeasurement.id))) == 2


def test_no_row_can_acquire_two_successors(
    app: FastAPI, account_factory, settings: Settings, session_factory
) -> None:
    account = account_factory("successors@example.com")

    with TestClient(app, headers={"Origin": "http://testserver"}) as setup_client:
        authenticate(setup_client, settings, account)
        original = setup_client.post(
            "/api/v1/aa/measurements", json=measurement_payload()
        ).json()

    def send(index: int) -> int:
        with TestClient(app, headers={"Origin": "http://testserver"}) as concurrent_client:
            authenticate(concurrent_client, settings, account)
            return concurrent_client.post(
                f"/api/v1/aa/measurements/{original['id']}/correct",
                json=correction_payload(idempotency_key=f"idem-race-{index}"),
            ).status_code

    with ThreadPoolExecutor(max_workers=4) as pool:
        statuses = list(pool.map(send, range(4)))

    assert statuses.count(201) == 1
    assert set(statuses) <= {201, 409}

    with session_factory() as db:
        successors = db.scalar(
            select(func.count(AAMeasurement.id)).where(
                AAMeasurement.supersedes_id == original["id"]
            )
        )
        assert successors == 1
        actives = db.scalar(
            select(func.count(AAMeasurement.id)).where(
                AAMeasurement.status == FactStatus.ACTIVE
            )
        )
        assert actives == 1


def test_correcting_another_account_fact_is_not_found(
    client: TestClient, app: FastAPI, account_factory, settings: Settings
) -> None:
    owner = account_factory("owner-correct@example.com")
    intruder = account_factory("intruder-correct@example.com")

    authenticate(client, settings, owner)
    original = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()

    with TestClient(app, headers={"Origin": "http://testserver"}) as intruder_client:
        authenticate(intruder_client, settings, intruder)
        response = intruder_client.post(
            f"/api/v1/aa/measurements/{original['id']}/correct",
            json=correction_payload(idempotency_key="idem-intruder"),
        )
    assert response.status_code == 404
