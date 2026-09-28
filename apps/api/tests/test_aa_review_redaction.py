"""T-13 · D1: hard erasure wins over frozen Review values.

A hard-deleted fact leaves no value behind in any Review — proven by scanning
every column of every Review row — while the user's own note, factors and
decision survive untouched, and a failed redaction rolls the deletion back.
"""

import io
import zipfile
from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.analytics.enums import FactStatus, SourceKind
from app.models import (
    AADeletionReceipt,
    AAExpectationVersion,
    AAMetricMembershipOverride,
    AAReviewContextItem,
)
from app.services import aa_deletion
from app.services.aa_deletion import delete_fact
from app.services.aa_reviews import redact_review_context
from tests.aa_helpers import authenticate
from tests.aa_review_helpers import (
    EXPECTED_AMOUNT,
    FINANCE_SUBJECT,
    REVIEW_TABLES,
    TX_TWO,
    items_by_role,
    observation,
    review_rows,
    save,
    seed_finance,
)

USER_AUTHORED = {
    "note_text": "Объём вырос после аудита дизайна.",
    "factors": [
        {"text": "Аудит дизайна", "epistemic_kind": "observed"},
        {"text": "Причина неизвестна", "epistemic_kind": "unknown"},
    ],
    "decision": {"choice": "inconclusive"},
}


def _user_authored(review):
    return {
        "revisions": [(r["revision"], r["note_text"]) for r in review["revisions"]],
        "factors": [(f["id"], f["text"], f["epistemic_kind"]) for f in review["factors"]],
        "decision": review["decision"],
    }


def _erase(client, table, fact_id):
    response = client.delete(f"/api/v1/aa/facts/{table}/{fact_id}", params={"mode": "hard"})
    assert response.status_code == 200, response.text
    return response


def _residue(engine, user_id, needles):
    """Every stringified column of every Review row that contains a needle."""
    found = []
    for table, rows in review_rows(engine, user_id).items():
        for row in rows:
            for column in row:
                rendered = str(column)
                found += [(table, needle) for needle in needles if needle in rendered]
    return found


def _saved(client, settings, owner, session_factory, **extra):
    ids = seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    _, response = save(client, **{**USER_AUTHORED, **extra})
    assert response.status_code == 201, response.text
    return ids, response.json()


def test_hard_deleting_the_expectation_redacts_it_and_the_delta_only(
    client, settings, account_factory, session_factory, engine
):
    owner = account_factory("rd-exp@example.com")
    ids, review = _saved(client, settings, owner, session_factory)
    before = _user_authored(review)
    _erase(client, "aa_expectation_versions", ids["expectation"])

    reopened = client.get(f"/api/v1/aa/reviews/{review['id']}").json()
    items = items_by_role(reopened)
    for key in ("expectation", "delta"):
        assert items[key]["redacted"] is True
        assert items[key]["source_state"] == "redacted"
        assert items[key]["value"] is None and items[key]["provenance"] is None
        assert items[key]["availability"] is None
    # The derived Actual never read the expectation; it stays exactly as frozen.
    assert items["actual"]["redacted"] is False
    assert items["actual"]["source_state"] == "current"
    # Positions stay, so the Review still reads «источник удалён» in place.
    assert [item["ordinal"] for item in reopened["items"]] == [
        item["ordinal"] for item in review["items"]
    ]
    assert _user_authored(reopened) == before

    expectation_id = str(ids["expectation"])
    assert _residue(engine, owner.user_id, [EXPECTED_AMOUNT, "62345", expectation_id]) == []


def test_hard_deleting_a_transaction_redacts_every_value_derived_from_it(
    client, settings, account_factory, session_factory, engine
):
    owner = account_factory("rd-tx@example.com")
    ids, review = _saved(client, settings, owner, session_factory)
    before = _user_authored(review)
    _erase(client, "aa_measurements", ids["tx_two"])

    reopened = client.get(f"/api/v1/aa/reviews/{review['id']}").json()
    items = items_by_role(reopened)
    assert items["actual"]["redacted"] and items["delta"]["redacted"]
    assert all(
        item["redacted"] for item in reopened["items"] if item["section"] == "quality"
    )
    # The Expectation has nothing to do with the transaction.
    assert items["expectation"]["redacted"] is False
    assert items["expectation"]["value"]["num"].startswith("62345.67")
    assert _user_authored(reopened) == before
    assert _residue(
        engine, owner.user_id, [str(ids["tx_two"]), "61345", "20111", TX_TWO]
    ) == []


def test_hard_deleting_an_observation_redacts_only_its_item(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rd-obs@example.com")
    seed_finance(session_factory, owner.user_id)
    with session_factory() as db:
        noted = observation(db, user_id=owner.user_id, score="6")
        db.commit()
        noted_id = noted.id
    authenticate(client, settings, owner)
    review = save(client, **USER_AUTHORED)[1].json()
    _erase(client, "aa_observations", noted_id)
    reopened = client.get(f"/api/v1/aa/reviews/{review['id']}").json()
    redacted = [item["label_key"] for item in reopened["items"] if item["redacted"]]
    assert redacted == ["observation"]


def test_a_cascading_membership_override_leaves_no_link_behind(
    client, settings, account_factory, session_factory, engine
):
    owner = account_factory("rd-override@example.com")
    ids = seed_finance(session_factory, owner.user_id)
    with session_factory() as db:
        override = AAMetricMembershipOverride(
            user_id=owner.user_id,
            metric_key="finance.monthly_spend",
            source_fact_id=ids["tx_two"],
            source_table="aa_measurements",
            included=True,
            source_kind=SourceKind.USER_REPORTED,
            status=FactStatus.ACTIVE,
            idempotency_key=f"rd-override-{uuid4()}",
        )
        db.add(override)
        db.commit()
        override_id = override.id
    authenticate(client, settings, owner)
    review = save(client)[1].json()
    with engine.connect() as connection:
        linked = connection.scalar(
            text("SELECT count(*) FROM aa_review_context_sources WHERE source_fact_id = :id"),
            {"id": override_id},
        )
    assert linked >= 1  # the override decided the derived Actual
    _erase(client, "aa_measurements", ids["tx_two"])
    assert _residue(engine, owner.user_id, [str(override_id), str(ids["tx_two"])]) == []
    items = items_by_role(client.get(f"/api/v1/aa/reviews/{review['id']}").json())
    assert items["actual"]["redacted"] is True


def test_redaction_is_transactional_with_the_deletion(
    client, settings, account_factory, session_factory, engine, monkeypatch
):
    owner = account_factory("rd-atomic@example.com")
    ids, review = _saved(client, settings, owner, session_factory)
    before_rows = review_rows(engine, owner.user_id)

    def failing_adapter(db, user_id, table_name, fact_id):
        raise RuntimeError("adapter failed after the review adapter ran")

    monkeypatch.setattr(
        aa_deletion, "SOURCE_REDACTORS", (redact_review_context, failing_adapter)
    )
    with session_factory() as db:
        with pytest.raises(RuntimeError):
            delete_fact(
                db,
                user_id=owner.user_id,
                table_name="aa_expectation_versions",
                fact_id=ids["expectation"],
                mode="hard",
            )
    with session_factory() as db:
        assert db.get(AAExpectationVersion, ids["expectation"]) is not None
        assert db.scalar(
            select(AADeletionReceipt).where(AADeletionReceipt.fact_id == ids["expectation"])
        ) is None
        assert db.scalars(
            select(AAReviewContextItem).where(AAReviewContextItem.redacted_at.is_not(None))
        ).all() == []
    assert review_rows(engine, owner.user_id) == before_rows


def test_another_accounts_review_is_untouched(
    client, settings, account_factory, session_factory, engine
):
    owner = account_factory("rd-a@example.com")
    other = account_factory("rd-b@example.com")
    ids, _ = _saved(client, settings, owner, session_factory)
    _, other_review = _saved(client, settings, other, session_factory)
    other_before = review_rows(engine, other.user_id)
    authenticate(client, settings, owner)
    _erase(client, "aa_expectation_versions", ids["expectation"])
    assert review_rows(engine, other.user_id) == other_before
    authenticate(client, settings, other)
    items = items_by_role(client.get(f"/api/v1/aa/reviews/{other_review['id']}").json())
    assert items["expectation"]["redacted"] is False


def test_redactor_ignores_a_fact_id_it_does_not_own(
    client, settings, account_factory, session_factory, engine
):
    owner = account_factory("rd-own@example.com")
    ids, _ = _saved(client, settings, owner, session_factory)
    before = review_rows(engine, owner.user_id)
    stranger = account_factory("rd-stranger@example.com")
    with session_factory() as db:
        redact_review_context(db, stranger.user_id, "aa_expectation_versions", ids["expectation"])
        db.commit()
    assert review_rows(engine, owner.user_id) == before


def test_export_after_redaction_contains_no_erased_value(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rd-export@example.com")
    ids, _ = _saved(client, settings, owner, session_factory)
    _erase(client, "aa_expectation_versions", ids["expectation"])
    response = client.get("/api/v1/export")
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        for table in REVIEW_TABLES:
            content = archive.read(f"{table}.ndjson").decode("utf-8")
            assert "62345" not in content, table
            assert str(ids["expectation"]) not in content, table
        items = archive.read("aa_review_context_items.ndjson").decode("utf-8")
        revisions = archive.read("aa_review_revisions.ndjson").decode("utf-8")
    assert "source_hard_deleted" in items
    # The user's own words leave with the export; only the erased value is gone.
    assert "Объём вырос" in revisions


def test_list_still_finds_a_fully_redacted_review(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rd-list@example.com")
    ids, review = _saved(client, settings, owner, session_factory)
    for table, key in (
        ("aa_expectation_versions", "expectation"),
        ("aa_measurements", "tx_one"),
        ("aa_measurements", "tx_two"),
    ):
        _erase(client, table, ids[key])
    listed = client.get("/api/v1/aa/reviews", params={"subject": FINANCE_SUBJECT}).json()
    assert [row["id"] for row in listed["reviews"]] == [review["id"]]
    reopened = client.get(f"/api/v1/aa/reviews/{review['id']}").json()
    compare = [item for item in reopened["items"] if item["section"] == "compare"]
    assert all(item["redacted"] for item in compare)
    assert reopened["decision"]["choice"] == "inconclusive"
    assert reopened["revisions"][0]["note_text"] == USER_AUTHORED["note_text"]
