"""Later corrections show **beside** frozen values, never instead of them.

correction ≠ legitimate revision ≠ withdrawal: each has its own flag, and in
every case the value the user saw when saving is returned unchanged.
"""

from datetime import UTC, date, datetime
from decimal import Decimal

from app.models import AAMeasurement
from tests.aa_helpers import authenticate
from tests.aa_review_helpers import (
    ACTUAL_AMOUNT,
    EXPECTED_AMOUNT,
    PROJECT_SUBJECT,
    items_by_role,
    observation,
    save,
    seed_finance,
    seed_project,
)
from tests.aa_signal_helpers import correct


def _frozen_values(review):
    return [(item["label_key"], item["value"]) for item in review["items"]]


def test_a_corrected_transaction_is_flagged_and_the_frozen_total_kept(
    client, settings, account_factory, session_factory
):
    owner = account_factory("cv-tx@example.com")
    ids = seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    review = save(client)[1].json()
    with session_factory() as db:
        original = db.get(AAMeasurement, ids["tx_two"])
        correct(
            db, user_id=owner.user_id, original=original, amount="2011.11",
            recorded_at=datetime.now(UTC),
        )
        db.commit()

    reopened = client.get(f"/api/v1/aa/reviews/{review['id']}").json()
    items = items_by_role(reopened)
    assert Decimal(items["actual"]["value"]["num"]) == ACTUAL_AMOUNT
    assert items["actual"]["source_state"] == "corrected"
    assert items["delta"]["source_state"] == "corrected"
    # A derived total has many sources; there is no single "current value" to
    # put beside it, and none is invented.
    assert items["actual"]["current_value"] is None
    assert items["expectation"]["source_state"] == "current"
    assert _frozen_values(reopened) == _frozen_values(review)


def test_a_corrected_project_actual_shows_the_current_value_beside(
    client, settings, account_factory, session_factory
):
    owner = account_factory("cv-project@example.com")
    ids = seed_project(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    review = save(client, PROJECT_SUBJECT)[1].json()
    with session_factory() as db:
        original = db.get(AAMeasurement, ids["actual"])
        replacement = AAMeasurement(
            user_id=owner.user_id,
            metric_key=original.metric_key,
            subject_domain="project",
            subject_type="project",
            subject_id=original.subject_id,
            value_type="date",
            value_date=date(2026, 8, 27),
            occurred_at=original.occurred_at,
            occurred_tz=original.occurred_tz,
            recorded_at=datetime.now(UTC),
            source_kind="USER_REPORTED",
            status="active",
            supersedes_id=original.id,
            idempotency_key="cv-project-correction",
        )
        db.add(replacement)
        db.flush()
        original.status = "superseded"
        original.superseded_at = datetime.now(UTC)
        original.superseded_by_id = replacement.id
        original.supersede_kind = "CORRECTION"
        db.commit()

    items = items_by_role(client.get(f"/api/v1/aa/reviews/{review['id']}").json())
    assert items["actual"]["value"]["date"] == "2026-08-25"  # frozen, as seen
    assert items["actual"]["source_state"] == "corrected"
    assert items["actual"]["current_value"]["date"] == "2026-08-27"  # beside it
    assert items["forecast_latest"]["source_state"] == "current"


def test_a_revised_expectation_is_a_revision_not_a_correction(
    client, settings, account_factory, session_factory
):
    owner = account_factory("cv-revision@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    review = save(client)[1].json()
    revision = client.post(
        "/api/v1/aa/expectations",
        json={
            "subject": {"domain": "finance", "type": "period", "id": "2026-08"},
            "metric_key": "finance.monthly_spend",
            "value": {"type": "money", "unit_code": "UAH", "num": "70000"},
            "window_start": "2026-08-01",
            "window_end": "2026-08-31",
            "timezone": "Europe/Kyiv",
            "effective_from": datetime.now(UTC).isoformat(),
            "provenance": {"source_kind": "USER_REPORTED", "basis": "новое ожидание"},
            "idempotency_key": "cv-expectation-revision",
        },
    )
    assert revision.status_code == 201, revision.text
    items = items_by_role(client.get(f"/api/v1/aa/reviews/{review['id']}").json())
    assert items["expectation"]["source_state"] == "revised"
    assert "corrected" not in items["expectation"]["source_flags"]
    assert items["expectation"]["value"]["num"].startswith(EXPECTED_AMOUNT)
    assert Decimal(items["expectation"]["current_value"]["num"]) == Decimal("70000")


def test_a_tombstoned_source_is_withdrawn_and_the_frozen_value_kept(
    client, settings, account_factory, session_factory
):
    owner = account_factory("cv-tombstone@example.com")
    seed_finance(session_factory, owner.user_id)
    with session_factory() as db:
        noted = observation(db, user_id=owner.user_id, score="5")
        db.commit()
        noted_id = noted.id
    authenticate(client, settings, owner)
    review = save(client)[1].json()
    response = client.delete(
        f"/api/v1/aa/facts/aa_observations/{noted_id}", params={"mode": "tombstone"}
    )
    assert response.status_code == 200
    items = items_by_role(client.get(f"/api/v1/aa/reviews/{review['id']}").json())
    # Plan §11.4: only a HARD delete redacts Review context.
    assert items["observation"]["source_state"] == "withdrawn"
    assert items["observation"]["redacted"] is False
    assert Decimal(items["observation"]["value"]["num"]) == Decimal("5")
