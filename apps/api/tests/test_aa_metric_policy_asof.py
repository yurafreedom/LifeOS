"""Slice 2 regression: mutable snapshots never reinterpret C7 history."""

import time
from decimal import Decimal

from sqlalchemy import select

from app.models import AAMetricPolicyVersion, UserSnapshot
from tests.aa_helpers import authenticate, measurement_payload, money


def test_snapshot_category_change_cannot_rewrite_captured_membership(
    client, settings, account_factory, session_factory
):
    owner = account_factory("finance-snapshot-independent@example.com")
    authenticate(client, settings, owner)
    response = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(
            subject={"domain": "finance", "type": "transaction", "id": "captured"},
            value=money("19.99"),
            dimensions={"category_id": "food", "included_by_default": True},
            idempotency_key="captured-membership-key",
        ),
    )
    assert response.status_code == 201
    with session_factory.begin() as db:
        db.add(UserSnapshot(
            user_id=owner.user_id, schema_version=2, revision=1,
            payload={"categoryOverrides": {"food": {"included_in_totals": False}}},
        ))
    month = client.get("/api/v1/aa/finance/months/2026-08").json()
    assert Decimal(month["actual"]["num"]) == Decimal("19.99")
    assert month["policy_known"] is False


def test_later_policy_version_cannot_rewrite_an_earlier_asof_month(
    client, settings, account_factory, session_factory
):
    owner = account_factory("finance-policy-history@example.com")
    authenticate(client, settings, owner)
    response = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(
            subject={"domain": "finance", "type": "transaction", "id": "policy-history"},
            value=money("19.99"),
            dimensions={"category_id": "food", "included_by_default": True},
            idempotency_key="policy-history-fact",
        ),
    )
    assert response.status_code == 201, response.text

    def policy(excluded, key):
        return client.post(
            "/api/v1/aa/finance/policies",
            json={
                "policy": {"exclude_categories": excluded, "default": "include"},
                "effective_from": "2026-08-01T00:00:00+00:00",
                "provenance": {"source_kind": "USER_REPORTED"},
                "idempotency_key": key,
            },
        )

    first = policy([], "policy-history-v1")
    assert first.status_code == 201, first.text
    time.sleep(0.01)
    second = policy(["food"], "policy-history-v2")
    assert second.status_code == 201, second.text
    with session_factory() as db:
        versions = list(db.scalars(
            select(AAMetricPolicyVersion)
            .where(AAMetricPolicyVersion.user_id == owner.user_id)
            .order_by(AAMetricPolicyVersion.recorded_at)
        ))
        assert len(versions) == 2
        historical_at = versions[0].recorded_at + (
            versions[1].recorded_at - versions[0].recorded_at
        ) / 2

    historical_before = client.get(
        "/api/v1/aa/finance/months/2026-08",
        params={"as_of": historical_at.isoformat()},
    ).json()
    with session_factory.begin() as db:
        db.add(UserSnapshot(
            user_id=owner.user_id,
            schema_version=2,
            revision=1,
            payload={"categoryOverrides": {"food": {"included_in_totals": True}}},
        ))
    historical_after = client.get(
        "/api/v1/aa/finance/months/2026-08",
        params={"as_of": historical_at.isoformat()},
    ).json()
    current = client.get("/api/v1/aa/finance/months/2026-08").json()

    assert historical_after == historical_before
    assert Decimal(historical_before["actual"]["num"]) == Decimal("19.99")
    assert Decimal(current["actual"]["num"]) == Decimal("0")
    assert current["excluded_count"] == 1
