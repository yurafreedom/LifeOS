from fastapi.testclient import TestClient

from app.config import Settings
from tests.aa_helpers import authenticate


def test_state_replace_uses_compare_and_swap(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("person@example.com")
    authenticate(client, settings, account)

    created = client.put(
        "/api/v1/state",
        json={
            "expected_revision": 0,
            "schema_version": 2,
            "payload": {"version": 2, "value": "initial"},
        },
    )
    assert created.status_code == 201
    assert created.json()["revision"] == 1

    updated = client.put(
        "/api/v1/state",
        json={
            "expected_revision": 1,
            "schema_version": 2,
            "payload": {"version": 2, "value": "updated"},
        },
    )
    assert updated.status_code == 200
    assert updated.json()["revision"] == 2

    stale = client.put(
        "/api/v1/state",
        json={
            "expected_revision": 1,
            "schema_version": 2,
            "payload": {"version": 2, "value": "stale"},
        },
    )
    assert stale.status_code == 409
    assert stale.json()["current_revision"] == 2
    assert client.get("/api/v1/state").json()["payload"]["value"] == "updated"
