"""Finance Slice 2 aggregation and semantic acceptance."""

from decimal import Decimal

from sqlalchemy import func, select

from app.models import AAMeasurement
from tests.aa_helpers import authenticate, correction_payload, measurement_payload, money


def _transaction(client, identity, amount, category="food", key=None):
    response = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(
            subject={"domain": "finance", "type": "transaction", "id": identity},
            value=money(str(amount)),
            occurred_at="2026-08-14T10:00:00+00:00",
            dimensions={"category_id": category, "included_by_default": True},
            idempotency_key=key or f"finance-transaction-{identity}",
        ),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_monthly_spend_is_derived_from_active_facts_and_correction_once(
    client, settings, account_factory, session_factory
):
    owner = account_factory("finance-correction@example.com")
    authenticate(client, settings, owner)
    _transaction(client, "tx-correct", "12000")
    corrected = client.post(
        "/api/v1/aa/measurements/by-idempotency/finance-transaction-tx-correct/correct",
        json=correction_payload(value=money("1200"), idempotency_key="finance-correction-key"),
    )
    assert corrected.status_code == 201, corrected.text

    month = client.get(
        "/api/v1/aa/finance/months/2026-08", params={"timezone": "Europe/Kyiv"}
    )
    assert month.status_code == 200, month.text
    body = month.json()
    assert Decimal(body["actual"]["num"]) == Decimal("1200")
    assert body["transaction_count"] == 1
    assert body["persisted"] is False
    with session_factory() as db:
        assert db.scalar(
            select(func.count()).select_from(AAMeasurement).where(
                AAMeasurement.user_id == owner.user_id,
                AAMeasurement.metric_key == "finance.monthly_spend",
            )
        ) == 0


def test_c7_override_and_account_isolation_control_aggregate(
    client, settings, account_factory
):
    owner = account_factory("finance-owner@example.com")
    other = account_factory("finance-other@example.com")
    authenticate(client, settings, owner)
    included = _transaction(client, "mine", "10", key="owner-included-key")
    excluded = _transaction(client, "hidden", "20", key="owner-excluded-key")
    override = client.post(
        "/api/v1/aa/finance/membership-overrides",
        json={
            "measurement_idempotency_key": "owner-excluded-key",
            "included": False,
            "provenance": {"source_kind": "USER_REPORTED"},
            "idempotency_key": "owner-membership-override",
        },
    )
    assert override.status_code == 201, override.text
    authenticate(client, settings, other)
    _transaction(client, "theirs", "999", key="other-transaction-key")
    authenticate(client, settings, owner)
    body = client.get("/api/v1/aa/finance/months/2026-08").json()
    assert Decimal(body["actual"]["num"]) == Decimal("10")
    assert body["transaction_count"] == 1 and body["excluded_count"] == 1
    assert included["id"] != excluded["id"]


def test_c7_override_survives_value_correction_without_becoming_a_policy_change(
    client, settings, account_factory
):
    owner = account_factory("finance-correction-membership@example.com")
    authenticate(client, settings, owner)
    _transaction(client, "overridden", "12000", key="overridden-create-key")
    override = client.post(
        "/api/v1/aa/finance/membership-overrides",
        json={
            "measurement_idempotency_key": "overridden-create-key",
            "included": False,
            "provenance": {"source_kind": "USER_REPORTED"},
            "idempotency_key": "overridden-membership-key",
        },
    )
    assert override.status_code == 201, override.text
    correction = client.post(
        "/api/v1/aa/measurements/by-idempotency/overridden-create-key/correct",
        json=correction_payload(
            value=money("1200"), idempotency_key="overridden-correction-key"
        ),
    )
    assert correction.status_code == 201, correction.text

    body = client.get("/api/v1/aa/finance/months/2026-08").json()
    assert Decimal(body["actual"]["num"]) == Decimal("0")
    assert body["transaction_count"] == 0
    assert body["excluded_count"] == 1


def test_finance_uses_decimal_uah_and_excludes_tombstones(
    client, settings, account_factory
):
    owner = account_factory("finance-decimal@example.com")
    authenticate(client, settings, owner)
    first = _transaction(client, "decimal-one", "0.1", key="decimal-one-key")
    _transaction(client, "decimal-two", "0.2", key="decimal-two-key")
    initial = client.get("/api/v1/aa/finance/months/2026-08").json()
    assert Decimal(initial["actual"]["num"]) == Decimal("0.3")

    erased = client.delete(
        f"/api/v1/aa/facts/aa_measurements/{first['id']}?mode=tombstone"
    )
    assert erased.status_code == 200, erased.text
    current = client.get("/api/v1/aa/finance/months/2026-08").json()
    assert Decimal(current["actual"]["num"]) == Decimal("0.2")
    assert current["transaction_count"] == 1

    wrong_currency = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(
            subject={"domain": "finance", "type": "transaction", "id": "usd"},
            value=money("10", "USD"),
            idempotency_key="implicit-fx-forbidden",
        ),
    )
    assert wrong_currency.status_code == 422
    assert wrong_currency.json()["code"] == "metric_value_type_mismatch"


def test_three_expectation_versions_target_absence_and_neutral_delta(
    client, settings, account_factory
):
    owner = account_factory("finance-semantics@example.com")
    authenticate(client, settings, owner)
    _transaction(client, "actual", "61200")
    subject = {"domain": "finance", "type": "period", "id": "2026-08"}
    for index, amount in enumerate(("50000", "57000", "62000"), 1):
        response = client.post(
            "/api/v1/aa/expectations",
            json={
                "subject": subject,
                "metric_key": "finance.monthly_spend",
                "value": money(amount),
                "window_start": "2026-08-01",
                "window_end": "2026-08-31",
                "timezone": "Europe/Kyiv",
                "effective_from": f"2026-08-0{index}T00:00:00+00:00",
                "provenance": {"source_kind": "USER_REPORTED"},
                "idempotency_key": f"finance-expectation-{index}",
            },
        )
        assert response.status_code == 201, response.text
    target = client.post(
        "/api/v1/aa/targets",
        json={
            "subject": subject,
            "metric_key": "finance.monthly_spend",
            "value": None,
            "is_explicitly_absent": True,
            "desired_direction": "lower",
            "window_start": "2026-08-01",
            "window_end": "2026-08-31",
            "timezone": "Europe/Kyiv",
            "provenance": {"source_kind": "USER_REPORTED"},
            "idempotency_key": "finance-target-absent",
        },
    )
    assert target.status_code == 201, target.text
    body = client.get("/api/v1/aa/finance/months/2026-08").json()
    assert [Decimal(row["value"]["num"]) for row in body["expectations"]] == [
        Decimal("50000"), Decimal("57000"), Decimal("62000")
    ]
    assert body["current_target"]["is_explicitly_absent"] is True
    assert Decimal(body["delta"]["num"]) == Decimal("-800")
    assert body["desire"] == "neutral"


def test_finance_read_rejects_invalid_period_timezone_and_naive_asof(
    client, settings, account_factory
):
    owner = account_factory("finance-invalid-query@example.com")
    authenticate(client, settings, owner)
    for path, params in (
        ("/api/v1/aa/finance/months/not-a-month", {}),
        ("/api/v1/aa/finance/months/2026-08", {"timezone": "Not/AZone"}),
        ("/api/v1/aa/finance/months/2026-08", {"as_of": "2026-08-10T10:00:00"}),
    ):
        response = client.get(path, params=params)
        assert response.status_code == 422
        assert response.json()["code"] == "invalid_finance_query"
