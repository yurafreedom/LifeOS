"""Account isolation — another account's fact is indistinguishable from no fact.

Every AA query leads with the authenticated `user_id`. A cross-account request
therefore resolves to 404 rather than 403: a 403 would confirm that the id names
something real, which is itself a leak.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.models import AAMeasurement
from tests.aa_helpers import (
    METRIC_TRANSACTION,
    authenticate,
    correction_payload,
    measurement_payload,
    money,
)

RANGE = {"from": "2026-08-01T00:00:00+00:00", "to": "2026-08-31T23:59:59+00:00"}


def test_measurements_are_isolated_by_authenticated_user(
    app: FastAPI, account_factory, settings: Settings, session_factory
) -> None:
    first = account_factory("iso-first@example.com")
    second = account_factory("iso-second@example.com")

    with TestClient(app, headers={"Origin": "http://testserver"}) as first_client:
        authenticate(first_client, settings, first)
        created = first_client.post(
            "/api/v1/aa/measurements", json=measurement_payload(value=money("111.00"))
        )
        assert created.status_code == 201
        owned_id = created.json()["id"]

    with TestClient(app, headers={"Origin": "http://testserver"}) as second_client:
        authenticate(second_client, settings, second)

        # Cannot read it.
        history = second_client.get(
            f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history", params=RANGE
        )
        assert history.status_code == 200
        assert history.json()["actual"] == []

        # Cannot read its provenance, and gets the same answer it would get for
        # an id that never existed.
        provenance = second_client.get(
            f"/api/v1/aa/facts/aa_measurements/{owned_id}/provenance"
        )
        assert provenance.status_code == 404
        unknown = second_client.get(
            "/api/v1/aa/facts/aa_measurements/00000000-0000-4000-8000-000000000000/provenance"
        )
        assert unknown.status_code == 404
        assert provenance.json() == unknown.json()

        # Cannot correct it.
        correction = second_client.post(
            f"/api/v1/aa/measurements/{owned_id}/correct",
            json=correction_payload(idempotency_key="idem-iso-intruder"),
        )
        assert correction.status_code == 404

    with session_factory() as db:
        assert db.scalar(select(func.count(AAMeasurement.id))) == 1

    with TestClient(app, headers={"Origin": "http://testserver"}) as owner_client:
        authenticate(owner_client, settings, first)
        history = owner_client.get(
            f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history", params=RANGE
        )
        assert [row["id"] for row in history.json()["actual"]] == [owned_id]
        assert history.json()["actual"][0]["status"] == "active"


def test_deleting_an_account_removes_its_analytics_history(
    session_factory: sessionmaker[Session], account_factory, client: TestClient, settings: Settings
) -> None:
    # The FK cascade from `users` is what a later erasure slice relies on; if it
    # were ever dropped, history would outlive the account.
    account = account_factory("iso-cascade@example.com")
    authenticate(client, settings, account)
    client.post("/api/v1/aa/measurements", json=measurement_payload())

    with session_factory() as db:
        assert db.scalar(select(func.count(AAMeasurement.id))) == 1
        db.execute(
            AAMeasurement.__table__.metadata.tables["users"]
            .delete()
            .where(AAMeasurement.__table__.metadata.tables["users"].c.id == account.user_id)
        )
        db.commit()
        assert db.scalar(select(func.count(AAMeasurement.id))) == 0


def test_unsafe_aa_routes_keep_the_existing_origin_and_content_type_guards(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("iso-origin@example.com")
    authenticate(client, settings, account)

    cross_site = client.post(
        "/api/v1/aa/measurements",
        headers={"Origin": "https://attacker.example", "Sec-Fetch-Site": "cross-site"},
        json=measurement_payload(),
    )
    assert cross_site.status_code == 403
    assert cross_site.json()["code"] == "forbidden_origin"

    wrong_type = client.post(
        "/api/v1/aa/measurements",
        content="metric_key=finance.transaction_amount",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert wrong_type.status_code == 415
