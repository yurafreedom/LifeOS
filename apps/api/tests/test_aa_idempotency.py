"""Permanent regression test T-04 — a retried idempotency key cannot duplicate a fact.

A retry is a retry, not a second observation. The key is minted by the writer
before its first attempt, so a browser restart mid-flight replays the same key
and the server resolves it to the fact it already created.
"""

from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.models import AAMeasurement
from tests.aa_helpers import METRIC_TRANSACTION, authenticate, measurement_payload, money


def count_measurements(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        return db.scalar(select(func.count(AAMeasurement.id))) or 0


def test_replaying_a_key_returns_the_existing_fact(
    client: TestClient, account_factory, settings: Settings, session_factory
) -> None:
    account = account_factory("retry@example.com")
    authenticate(client, settings, account)
    payload = measurement_payload()

    first = client.post("/api/v1/aa/measurements", json=payload)
    assert first.status_code == 201

    second = client.post("/api/v1/aa/measurements", json=payload)
    # 200 rather than 201: nothing was created by this call.
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert count_measurements(session_factory) == 1


def test_a_replay_is_not_reinterpreted_as_a_new_observation(
    client: TestClient, account_factory, settings: Settings, session_factory
) -> None:
    # The same key carrying a different value must not create a second fact and
    # must not silently overwrite the first: the server returns what it stored.
    account = account_factory("replay@example.com")
    authenticate(client, settings, account)

    first = client.post("/api/v1/aa/measurements", json=measurement_payload())
    second = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(value=money("9999.00")),
    )
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["value"]["num"] == first.json()["value"]["num"]
    assert count_measurements(session_factory) == 1


def test_idempotency_keys_are_scoped_to_one_account(
    client: TestClient, app: FastAPI, account_factory, settings: Settings, session_factory
) -> None:
    # Two accounts may legitimately mint the same key; neither may see or
    # collide with the other's fact.
    first_account = account_factory("keys-a@example.com")
    second_account = account_factory("keys-b@example.com")
    payload = measurement_payload(idempotency_key="idem-shared-key")

    authenticate(client, settings, first_account)
    first = client.post("/api/v1/aa/measurements", json=payload)
    assert first.status_code == 201

    with TestClient(app, headers={"Origin": "http://testserver"}) as second_client:
        authenticate(second_client, settings, second_account)
        second = second_client.post("/api/v1/aa/measurements", json=payload)
        assert second.status_code == 201
        assert second.json()["id"] != first.json()["id"]

    assert count_measurements(session_factory) == 2


def test_concurrent_replays_of_one_key_create_one_fact(
    app: FastAPI, account_factory, settings: Settings, session_factory
) -> None:
    account = account_factory("concurrent@example.com")
    payload = measurement_payload(idempotency_key="idem-concurrent-key")

    def send() -> int:
        with TestClient(app, headers={"Origin": "http://testserver"}) as concurrent_client:
            authenticate(concurrent_client, settings, account)
            return concurrent_client.post("/api/v1/aa/measurements", json=payload).status_code

    with ThreadPoolExecutor(max_workers=4) as pool:
        statuses = list(pool.map(lambda _: send(), range(4)))

    assert all(status in (200, 201) for status in statuses)
    assert statuses.count(201) == 1
    assert count_measurements(session_factory) == 1


def test_a_replayed_write_does_not_appear_twice_in_history(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("history-retry@example.com")
    authenticate(client, settings, account)
    payload = measurement_payload()

    client.post("/api/v1/aa/measurements", json=payload)
    client.post("/api/v1/aa/measurements", json=payload)

    history = client.get(
        f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history",
        params={
            "from": "2026-08-01T00:00:00+00:00",
            "to": "2026-08-31T23:59:59+00:00",
        },
    ).json()
    assert len(history["actual"]) == 1
