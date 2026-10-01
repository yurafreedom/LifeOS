from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from tests.aa_helpers import authenticate


def test_snapshots_are_isolated_by_authenticated_user(
    app: FastAPI, account_factory, settings: Settings
) -> None:
    first = account_factory("first@example.com")
    second = account_factory("second@example.com")

    with TestClient(app, headers={"Origin": "http://testserver"}) as first_client:
        authenticate(first_client, settings, first)
        rejected = first_client.put(
            "/api/v1/state",
            json={
                "expected_revision": 0,
                "schema_version": 2,
                "payload": {"version": 2},
                "user_id": str(second.user_id),
            },
        )
        assert rejected.status_code == 422
        response = first_client.put(
            "/api/v1/state",
            json={
                "expected_revision": 0,
                "schema_version": 2,
                "payload": {"version": 2, "owner": "first"},
            },
        )
        assert response.status_code == 201

    with TestClient(app, headers={"Origin": "http://testserver"}) as second_client:
        authenticate(second_client, settings, second)
        assert second_client.get("/api/v1/state").status_code == 404
        response = second_client.put(
            "/api/v1/state",
            json={
                "expected_revision": 0,
                "schema_version": 2,
                "payload": {"version": 2, "owner": "second"},
            },
        )
        assert response.status_code == 201
        assert response.json()["payload"]["owner"] == "second"

    with TestClient(app, headers={"Origin": "http://testserver"}) as first_client:
        authenticate(first_client, settings, first)
        response = first_client.get("/api/v1/state")
        assert response.status_code == 200
        assert response.json()["payload"]["owner"] == "first"
