"""C1/D3: import genuine snapshot transactions, and nothing invented."""

from decimal import Decimal

from sqlalchemy import select

from app.models import (
    AAMeasurement,
    AAMetricMembershipOverride,
    AAMetricPolicyVersion,
    AASourceCoverage,
    UserSnapshot,
)
from tests.aa_helpers import authenticate


def test_legacy_import_is_honest_idempotent_and_does_not_backfill_other_layers(
    client, settings, account_factory, session_factory
):
    owner = account_factory("legacy-finance@example.com")
    with session_factory.begin() as db:
        db.add(UserSnapshot(
            user_id=owner.user_id,
            schema_version=2,
            revision=1,
            payload={
                "transactions": [{
                    "id": "legacy-t1", "amount": 42.5, "date": "2026-08-10",
                    "category_id": "food", "source": "manual", "included_in_totals": True,
                }],
                "categoryOverrides": {},
                "activityLog": [{"action": "must-not-import"}],
            },
        ))
    authenticate(client, settings, owner)
    first = client.post(
        "/api/v1/aa/import/legacy-transactions", json={"timezone": "Europe/Kyiv", "coverage": []}
    )
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["transactions_imported"] == 1
    for key in (
        "activity_log_imported", "expectations_backfilled", "forecasts_backfilled",
        "targets_backfilled", "baselines_backfilled", "synthetic_coverage_backfilled",
        "moneywidget_budget_backfilled",
    ):
        assert body[key] == 0
    second = client.post(
        "/api/v1/aa/import/legacy-transactions", json={"timezone": "Europe/Kyiv", "coverage": []}
    ).json()
    assert second["transactions_imported"] == 0 and second["transactions_replayed"] == 1
    quality = client.get("/api/v1/aa/finance/months/2026-08").json()["coverage"]
    assert quality["has_legacy_imports"] is True
    with session_factory() as db:
        rows = list(db.scalars(select(AAMeasurement).where(AAMeasurement.user_id == owner.user_id)))
        assert len(rows) == 1
        row = rows[0]
        assert row.value_num == Decimal("42.5")
        assert row.occurred_at.date().isoformat() == "2026-08-10"
        assert row.source_kind == "IMPORTED" and row.method == "LEGACY_IMPORT"
        assert row.original_recorded_at_known is False
        assert row.recorded_at > row.occurred_at
        assert db.scalars(
            select(AASourceCoverage).where(AASourceCoverage.user_id == owner.user_id)
        ).all() == []


def test_legacy_import_reads_only_authenticated_accounts_snapshot(
    client, settings, account_factory, session_factory
):
    owner = account_factory("legacy-owner@example.com")
    other = account_factory("legacy-other@example.com")
    with session_factory.begin() as db:
        db.add(UserSnapshot(
            user_id=owner.user_id, schema_version=2, revision=1,
            payload={"transactions": [{"id": "private", "amount": 500, "date": "2026-08-01", "category_id": "x"}]},
        ))
        db.add(UserSnapshot(user_id=other.user_id, schema_version=2, revision=1, payload={"transactions": []}))
    authenticate(client, settings, other)
    result = client.post(
        "/api/v1/aa/import/legacy-transactions", json={"timezone": "Europe/Kyiv"}
    ).json()
    assert result["transactions_imported"] == 0


def test_legacy_import_keeps_category_policy_separate_from_sparse_fact_override(
    client, settings, account_factory, session_factory
):
    owner = account_factory("legacy-policy-shape@example.com")
    with session_factory.begin() as db:
        db.add(UserSnapshot(
            user_id=owner.user_id,
            schema_version=2,
            revision=1,
            payload={
                "transactions": [
                    {
                        "id": "category-excluded",
                        "amount": 10,
                        "date": "2026-08-10",
                        "category_id": "food",
                        "included_in_totals": True,
                    },
                    {
                        "id": "fact-excluded",
                        "amount": 20,
                        "date": "2026-08-11",
                        "category_id": "other",
                        "included_in_totals": False,
                    },
                ],
                "categoryOverrides": {"food": {"included_in_totals": False}},
            },
        ))
    authenticate(client, settings, owner)
    response = client.post(
        "/api/v1/aa/import/legacy-transactions",
        json={"timezone": "Europe/Kyiv", "coverage": []},
    )
    assert response.status_code == 200, response.text
    assert response.json()["overrides_imported"] == 1

    with session_factory() as db:
        policy = db.scalar(
            select(AAMetricPolicyVersion).where(AAMetricPolicyVersion.user_id == owner.user_id)
        )
        overrides = list(db.scalars(
            select(AAMetricMembershipOverride).where(
                AAMetricMembershipOverride.user_id == owner.user_id
            )
        ))
        measurements = {
            row.subject_id: row
            for row in db.scalars(
                select(AAMeasurement).where(AAMeasurement.user_id == owner.user_id)
            )
        }
        assert policy.policy == {"exclude_categories": ["food"], "default": "include"}
        assert len(overrides) == 1
        assert overrides[0].source_fact_id == measurements["fact-excluded"].id
