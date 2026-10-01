"""Account binding: a stale tab must never act for whoever owns the shared cookie.

Scenario (JENKIN S1 checkpoint 1): tab A loaded account A; another tab signed out
and signed in as B, so the browser's single session cookie now resolves to B.
Tab A still sends its expected account (A) with every request. The server must
refuse before any read, write, import or export happens.

Both accounts deliberately hold snapshots at the *same* revision, so a
revision compare-and-swap coincidence cannot hide a cross-account write.
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.models import AAMeasurement, UserSnapshot
from tests.aa_helpers import authenticate, measurement_payload

HEADER = "X-LifeOS-Account"


def _put_state(client: TestClient, revision: int, owner: str, headers: dict[str, str] | None = None):
    return client.put(
        "/api/v1/state",
        json={
            "expected_revision": revision,
            "schema_version": 2,
            "payload": {"version": 2, "owner": owner},
        },
        headers=headers,
    )


@pytest.fixture
def two_accounts(client, settings, account_factory) -> tuple[Any, Any]:
    first = account_factory("tab-a@example.com")
    second = account_factory("tab-b@example.com")
    for account, owner in ((first, "A"), (second, "B")):
        authenticate(client, settings, account)
        assert _put_state(client, 0, owner).status_code == 201
        assert _put_state(client, 1, owner).status_code == 200
    # Both snapshots are now at revision 2: equal revisions on purpose.
    return first, second


def _signed_in_as_b_but_bound_to_a(client, settings, first, second) -> None:
    client.cookies.set(settings.cookie_name, second.raw_token)
    client.headers[HEADER] = str(first.user_id)


def _owner(session_factory, account) -> str:
    with session_factory() as db:
        snapshot = db.get(UserSnapshot, account.user_id)
        assert snapshot is not None
        return snapshot.payload["owner"]


def test_stale_tab_snapshot_write_is_refused_before_it_reaches_b(
    client, settings, session_factory, two_accounts
):
    first, second = two_accounts
    _signed_in_as_b_but_bound_to_a(client, settings, first, second)

    response = _put_state(client, 2, "A-from-stale-tab")

    assert response.status_code == 409
    assert response.json()["code"] == "session_user_mismatch"
    assert _owner(session_factory, second) == "B"
    assert _owner(session_factory, first) == "A"


def test_stale_tab_reads_and_exports_are_refused(client, settings, two_accounts):
    first, second = two_accounts
    _signed_in_as_b_but_bound_to_a(client, settings, first, second)

    for path in ("/api/v1/state", "/api/v1/export", "/api/v1/aa/finance/months/2026-09?timezone=Europe/Kyiv"):
        response = client.get(path)
        assert response.status_code == 409, path
        assert response.json()["code"] == "session_user_mismatch"
        assert "owner" not in response.text


def test_stale_tab_queued_analytics_replay_is_refused(
    client, settings, session_factory, two_accounts
):
    first, second = two_accounts
    _signed_in_as_b_but_bound_to_a(client, settings, first, second)

    response = client.post("/api/v1/aa/measurements", json=measurement_payload())

    assert response.status_code == 409
    assert response.json()["code"] == "session_user_mismatch"
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AAMeasurement)) == 0


def test_stale_tab_legacy_import_and_account_deletion_are_refused(
    client, settings, session_factory, two_accounts
):
    first, second = two_accounts
    _signed_in_as_b_but_bound_to_a(client, settings, first, second)

    imported = client.post(
        "/api/v1/aa/import/legacy-transactions", json={"timezone": "Europe/Kyiv"}
    )
    deleted = client.request("DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"})

    assert imported.status_code == 409
    assert deleted.status_code == 409
    assert deleted.json()["code"] == "session_user_mismatch"
    assert _owner(session_factory, second) == "B"


def test_matching_binding_proceeds_normally(client, settings, session_factory, two_accounts):
    _first, second = two_accounts
    authenticate(client, settings, second)

    assert client.get("/api/v1/state").json()["payload"]["owner"] == "B"
    assert _put_state(client, 2, "B2").status_code == 200
    assert _owner(session_factory, second) == "B2"


def test_binding_is_case_insensitive_and_whitespace_tolerant(client, settings, two_accounts):
    _first, second = two_accounts
    authenticate(client, settings, second)
    client.headers[HEADER] = f"  {str(second.user_id).upper()} "

    assert client.get("/api/v1/state").status_code == 200


def test_missing_binding_fails_closed_on_reads_and_writes(
    client, settings, session_factory, two_accounts
):
    _first, second = two_accounts
    client.cookies.set(settings.cookie_name, second.raw_token)
    client.headers.pop(HEADER, None)

    read = client.get("/api/v1/state")
    write = _put_state(client, 2, "unbound")
    export = client.get("/api/v1/export")

    for response in (read, write, export):
        assert response.status_code == 428
        assert response.json()["code"] == "account_binding_required"
    assert _owner(session_factory, second) == "B"


def test_unauthenticated_requests_still_report_not_authenticated(client, two_accounts):
    first, _second = two_accounts
    client.cookies.clear()
    client.headers[HEADER] = str(first.user_id)

    response = client.get("/api/v1/state")

    assert response.status_code == 401
    assert response.json()["code"] == "not_authenticated"


def test_identity_discovery_is_unbound(client, settings, two_accounts):
    first, second = two_accounts
    _signed_in_as_b_but_bound_to_a(client, settings, first, second)

    me = client.get("/api/v1/auth/me")

    assert me.status_code == 200
    assert me.json()["id"] == str(second.user_id)


def test_stale_tab_cannot_sign_out_the_other_account(client, settings, two_accounts):
    first, second = two_accounts
    _signed_in_as_b_but_bound_to_a(client, settings, first, second)

    refused = client.post("/api/v1/auth/logout")
    assert refused.status_code == 409
    assert refused.json()["code"] == "session_user_mismatch"

    client.headers.pop(HEADER)
    assert client.get("/api/v1/auth/me").json()["id"] == str(second.user_id)
    assert client.post("/api/v1/auth/logout").status_code == 204


def test_every_protected_route_is_bound(app):
    """No authenticated route may skip the binding dependency by accident."""
    from fastapi.routing import APIRoute

    from app.dependencies import get_bound_session, get_current_session

    unbound_allowed = {
        ("GET", "/api/v1/auth/me"),
    }

    def dependency_calls(dependant) -> set:
        calls = {dependant.call}
        for sub in dependant.dependencies:
            calls |= dependency_calls(sub)
        return calls

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        calls = dependency_calls(route.dependant)
        if get_current_session not in calls:
            continue
        for method in route.methods:
            if (method, route.path) in unbound_allowed:
                continue
            assert get_bound_session in calls, f"{method} {route.path} is authenticated but unbound"


def test_private_api_responses_are_not_stored(client, settings, two_accounts):
    _first, second = two_accounts
    authenticate(client, settings, second)

    for response in (
        client.get("/api/v1/state"),
        client.get("/api/v1/auth/me"),
        client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "x"}),
        client.get("/api/v1/export"),
    ):
        assert response.headers["cache-control"] == "no-store"
        assert "cookie" in response.headers["vary"].casefold()
