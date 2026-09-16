"""Recording and reading one Measurement through the API."""

from decimal import Decimal

from fastapi.testclient import TestClient

from app.config import Settings
from tests.aa_helpers import (
    METRIC_TRANSACTION,
    SUBJECT_TRANSACTION,
    authenticate,
    measurement_payload,
    money,
)


def test_a_measurement_can_be_recorded_and_read_back(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("recorder@example.com")
    authenticate(client, settings, account)

    created = client.post("/api/v1/aa/measurements", json=measurement_payload())
    assert created.status_code == 201
    body = created.json()
    assert body["metric_key"] == METRIC_TRANSACTION
    assert body["subject_key"] == "finance:transaction:t01"
    assert body["value"]["type"] == "money"
    assert body["value"]["unit_code"] == "UAH"
    assert Decimal(body["value"]["num"]) == Decimal("1200.00")
    assert body["value"]["date"] is None
    assert body["value"]["text"] is None
    assert body["status"] == "active"
    assert body["provenance"]["source_kind"] == "USER_REPORTED"
    assert body["provenance"]["recorded_at"] is not None

    history = client.get(
        f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history",
        params={
            "from": "2026-08-01T00:00:00+00:00",
            "to": "2026-08-31T23:59:59+00:00",
            "subject": "finance:transaction:t01",
        },
    )
    assert history.status_code == 200
    assert [row["id"] for row in history.json()["actual"]] == [body["id"]]
    # Layers that have no storage yet stay separate and empty rather than being
    # folded into `actual`.
    assert history.json()["forecasts"] == []


def test_zero_is_stored_as_a_real_observation(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("zero@example.com")
    authenticate(client, settings, account)

    created = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(value=money("0.00"), idempotency_key="idem-zero-0001"),
    )
    assert created.status_code == 201
    assert Decimal(created.json()["value"]["num"]) == Decimal("0")


def test_an_absent_observation_creates_no_row(
    client: TestClient, account_factory, settings: Settings
) -> None:
    # T-05: reading a window in which nothing was observed returns an empty
    # layer. No placeholder, no synthetic unknown, no zero.
    account = account_factory("absent@example.com")
    authenticate(client, settings, account)

    history = client.get(
        f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history",
        params={
            "from": "2026-08-01T00:00:00+00:00",
            "to": "2026-08-31T23:59:59+00:00",
            "subject": "finance:transaction:t01",
        },
    )
    assert history.status_code == 200
    assert history.json()["actual"] == []

    again = client.get(
        f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history",
        params={
            "from": "2026-08-01T00:00:00+00:00",
            "to": "2026-08-31T23:59:59+00:00",
            "subject": "finance:transaction:t01",
        },
    )
    assert again.json()["actual"] == []


def test_a_value_that_contradicts_its_type_is_rejected(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("invalid@example.com")
    authenticate(client, settings, account)

    response = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(value={"type": "money", "num": "10.00"}),
    )
    assert response.status_code == 422


def test_a_value_that_contradicts_its_metric_is_rejected(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("mismatch@example.com")
    authenticate(client, settings, account)

    response = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(value=money("10.00", unit_code="USD")),
    )
    assert response.status_code == 422
    assert response.json()["code"] == "metric_value_type_mismatch"


def test_an_unregistered_subject_is_rejected(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("subject@example.com")
    authenticate(client, settings, account)

    response = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(subject={"domain": "health", "type": "vital", "id": "v1"}),
    )
    assert response.status_code == 422


def test_a_body_supplied_user_id_is_rejected(
    client: TestClient, account_factory, settings: Settings
) -> None:
    # Mirrors test_state_isolation: ownership comes from the session only.
    account = account_factory("owner@example.com")
    other = account_factory("other@example.com")
    authenticate(client, settings, account)

    response = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(user_id=str(other.user_id)),
    )
    assert response.status_code == 422


def test_unauthenticated_requests_are_refused(client: TestClient) -> None:
    assert client.post("/api/v1/aa/measurements", json=measurement_payload()).status_code == 401
    assert (
        client.get(
            f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history",
            params={"from": "2026-08-01T00:00:00+00:00", "to": "2026-08-31T00:00:00+00:00"},
        ).status_code
        == 401
    )


def test_history_requires_an_explicit_range(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("range@example.com")
    authenticate(client, settings, account)

    response = client.get(f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history")
    assert response.status_code == 400
    assert response.json()["code"] == "range_required"


def test_history_pages_by_keyset(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("paging@example.com")
    authenticate(client, settings, account)

    for index in range(3):
        response = client.post(
            "/api/v1/aa/measurements",
            json=measurement_payload(
                subject={**SUBJECT_TRANSACTION, "id": f"t{index:02d}"},
                occurred_at=f"2026-08-{index + 1:02d}T10:00:00+00:00",
                idempotency_key=f"idem-page-{index}",
            ),
        )
        assert response.status_code == 201

    params = {
        "from": "2026-08-01T00:00:00+00:00",
        "to": "2026-08-31T23:59:59+00:00",
        "limit": 2,
    }
    first = client.get(f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history", params=params).json()
    assert len(first["actual"]) == 2
    assert first["next_cursor"] is not None

    second = client.get(
        f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history",
        params={**params, "cursor": first["next_cursor"]},
    ).json()
    assert len(second["actual"]) == 1
    assert second["next_cursor"] is None
    first_ids = {row["id"] for row in first["actual"]}
    assert first_ids.isdisjoint({row["id"] for row in second["actual"]})


def test_provenance_is_readable_for_a_fact(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("prov@example.com")
    authenticate(client, settings, account)

    created = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    provenance = client.get(
        f"/api/v1/aa/facts/aa_measurements/{created['id']}/provenance"
    )
    assert provenance.status_code == 200
    body = provenance.json()
    assert body["provenance"]["source_kind"] == "USER_REPORTED"
    assert body["provenance"]["basis"] == "1 операция"
    assert body["provenance"]["method"] == "Ручная запись"
    assert body["provenance"]["recorded_at"] is not None
    assert body["status"] == "active"


def test_provenance_of_an_unknown_table_is_not_found(
    client: TestClient, account_factory, settings: Settings
) -> None:
    account = account_factory("table@example.com")
    authenticate(client, settings, account)
    created = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()

    response = client.get(f"/api/v1/aa/facts/users/{created['id']}/provenance")
    assert response.status_code == 404
