"""Slice 4 · Review / Debrief — context, save, reopen, revise, isolation, export."""

import io
import json
import zipfile
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.analytics.enums import (
    DecisionScope,
    Desire,
    ExperimentDecisionChoice,
    RedactionReason,
    ReviewAvailability,
    ReviewDecisionChoice,
    ReviewRole,
    ReviewSection,
    members,
)
from app.analytics.rules import signal_rules
from app.config import Settings
from app.main import create_app
from app.models import (
    AADecision,
    AAReview,
    AAReviewContextItem,
    AAReviewContextSource,
    AAReviewFactor,
    AAReviewRevision,
)
from app.services.aa_finance import derive_month
from tests.aa_helpers import authenticate
from tests.aa_review_helpers import (
    ACTUAL_AMOUNT,
    EXPECTED_AMOUNT,
    FINANCE_SUBJECT,
    FINANCE_SUBJECT_IN,
    PROJECT_SUBJECT,
    PROJECT_SUBJECT_IN,
    REVIEW_TABLES,
    get_context,
    items_by_role,
    observation,
    review_body,
    row_counts,
    save,
    seed_finance,
    seed_project,
    target,
)
from tests.aa_signal_helpers import KYIV
from tests.test_aa_schema_guards import QUOTED, constraint_definition

FACTORS = [
    {"text": "Объём вырос после аудита", "epistemic_kind": "observed"},
    {"text": "Отпуск в середине месяца", "epistemic_kind": "maybe"},
    {"text": "Причина неизвестна"},
]


def _num(value) -> Decimal:
    return Decimal(str(value))


# ── context from real facts ───────────────────────────────────────────────


def test_finance_context_comes_from_real_facts(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rv-context@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    response = get_context(client)
    assert response.status_code == 200, response.text
    context = response.json()
    items = items_by_role(context)

    with session_factory() as db:
        month = derive_month(
            db, user_id=owner.user_id, period="2026-08", timezone=KYIV,
            as_of=datetime.fromisoformat(context["context_as_of"]),
        )
    assert _num(items["expectation"]["value"]["num"]) == Decimal(EXPECTED_AMOUNT)
    assert _num(items["actual"]["value"]["num"]) == ACTUAL_AMOUNT == month.actual.num
    assert _num(items["delta"]["value"]["num"]) == ACTUAL_AMOUNT - Decimal(EXPECTED_AMOUNT)
    # An Expectation is never normative grounding: the difference stays neutral.
    assert items["delta"]["desire"] == "neutral"
    assert "target" not in items
    assert items["expectation"]["provenance"]["source_kind"] == "USER_REPORTED"
    assert items["actual"]["provenance"]["source_kind"] == "DERIVED"
    assert int(_num(items["coverage.observed_count"]["value"]["num"])) == (
        month.coverage.observed_count
    )
    assert context["manifest"]["subject_kind"] == "finance_period"
    assert len(context["context_fingerprint"]) == 64


def test_only_a_target_grounds_desirability(client, settings, account_factory, session_factory):
    owner = account_factory("rv-target@example.com")
    seed_finance(session_factory, owner.user_id)
    with session_factory() as db:
        target(db, user_id=owner.user_id, amount="60000", direction="lower")
        db.commit()
    authenticate(client, settings, owner)
    items = items_by_role(get_context(client).json())
    assert items["target"]["availability"] == "present"
    # Spending 61,345.67 against a «lower than 60,000» target.
    assert items["delta"]["desire"] == "unfavorable"


def test_explicitly_absent_target_is_neither_zero_nor_grounding(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rv-absent@example.com")
    seed_finance(session_factory, owner.user_id)
    with session_factory() as db:
        target(db, user_id=owner.user_id, amount=None)
        db.commit()
    authenticate(client, settings, owner)
    items = items_by_role(get_context(client).json())
    assert items["target"]["availability"] == "explicitly_absent"
    assert items["target"]["value"] is None
    assert items["delta"]["desire"] == "neutral"


def test_project_context_uses_latest_forecast_and_the_actual(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rv-project@example.com")
    seed_project(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    context = get_context(client, PROJECT_SUBJECT).json()
    items = items_by_role(context)
    assert items["forecast_latest"]["value"]["date"] == "2026-08-26"
    assert items["forecast_latest"]["estimate"] is True
    assert items["actual"]["value"]["date"] == "2026-08-25"
    assert items["delta"]["value"]["type"] == "duration"
    assert _num(items["delta"]["value"]["num"]) == Decimal(-1440)
    assert items["delta"]["desire"] == "neutral"
    assert context["manifest"]["subject_kind"] == "project"
    assert all(item["section"] != "quality" for item in context["items"])


def test_absent_inputs_are_no_data_and_asking_writes_nothing(
    client, settings, account_factory, engine
):
    owner = account_factory("rv-empty@example.com")
    authenticate(client, settings, owner)
    context = get_context(client, PROJECT_SUBJECT).json()
    items = items_by_role(context)
    assert {items[key]["availability"] for key in ("forecast_latest", "actual", "delta")} == {
        "no_data"
    }
    assert all(item["value"] is None for item in context["items"])
    with engine.connect() as connection:
        for table in ("aa_measurements", "aa_forecast_versions", *REVIEW_TABLES):
            assert connection.scalar(text(f"SELECT count(*) FROM {table}")) == 0


def test_observations_are_juxtaposed_alongside(client, settings, account_factory, session_factory):
    owner = account_factory("rv-obs@example.com")
    seed_finance(session_factory, owner.user_id)
    with session_factory() as db:
        observation(db, user_id=owner.user_id, score="2", kind="mine")
        observation(db, user_id=owner.user_id, occurred_at=datetime(2026, 9, 3, tzinfo=UTC))
        db.commit()
    authenticate(client, settings, owner)
    context = get_context(client).json()
    alongside = [item for item in context["items"] if item["section"] == "alongside"]
    assert len(alongside) == 1  # the September observation is outside the window
    assert alongside[0]["epistemic_kind"] == "mine"
    assert alongside[0]["value"]["type"] == "scale"


def test_unsupported_subject_window_and_range(client, settings, account_factory):
    owner = account_factory("rv-bad@example.com")
    authenticate(client, settings, owner)
    assert get_context(client, "system:window:x").json()["code"] == "unsupported_review_subject"
    wrong_window = get_context(client, FINANCE_SUBJECT, "2026-08-02", "2026-08-31")
    assert wrong_window.status_code == 422
    assert wrong_window.json()["code"] == "invalid_review_window"
    missing = client.get("/api/v1/aa/reviews/context", params={"subject": FINANCE_SUBJECT})
    assert missing.status_code == 400
    assert missing.json()["code"] == "range_required"


# ── save and reopen ───────────────────────────────────────────────────────


def _frozen(item):
    return {
        key: item[key]
        for key in (
            "ordinal", "section", "role", "label_key", "metric_key", "availability", "value",
            "desire", "epistemic_kind", "estimate", "provenance",
        )
    }


def test_saved_review_reopens_exactly_as_seen(client, settings, account_factory, session_factory):
    owner = account_factory("rv-reopen@example.com")
    seed_finance(session_factory, owner.user_id)
    with session_factory() as db:
        observation(db, user_id=owner.user_id)
        db.commit()
    authenticate(client, settings, owner)
    context, response = save(
        client,
        note_text="Объём вырос после аудита дизайна.",
        factors=FACTORS,
        decision={"choice": "adjust"},
    )
    assert response.status_code == 201, response.text
    saved = response.json()
    reopened = client.get(f"/api/v1/aa/reviews/{saved['id']}").json()
    assert [_frozen(item) for item in reopened["items"]] == [
        _frozen(item) for item in context["items"]
    ]
    assert {item["source_state"] for item in reopened["items"]} == {"current"}
    assert reopened["revisions"] == [
        {
            "revision": 1,
            "created_at": reopened["revisions"][0]["created_at"],
            "note_text": "Объём вырос после аудита дизайна.",
        }
    ]
    assert [(f["text"], f["epistemic_kind"]) for f in reopened["factors"]] == [
        ("Объём вырос после аудита", "observed"),
        ("Отпуск в середине месяца", "maybe"),
        ("Причина неизвестна", "unknown"),  # «неизвестно» is the default, not NULL
    ]
    assert reopened["decision"]["choice"] == "adjust"
    assert reopened["manifest"] == context["manifest"]


def test_an_empty_review_is_valid(client, settings, account_factory, session_factory, engine):
    owner = account_factory("rv-emptysave@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    _, response = save(client)
    assert response.status_code == 201, response.text
    review = response.json()
    assert review["revisions"][0]["note_text"] is None
    assert review["factors"] == []
    assert review["decision"] is None
    assert row_counts(engine, owner.user_id)["aa_decisions"] == 0


def test_a_review_with_no_facts_at_all_can_still_be_saved(client, settings, account_factory):
    owner = account_factory("rv-nofacts@example.com")
    authenticate(client, settings, owner)
    _, response = save(client, PROJECT_SUBJECT)
    assert response.status_code == 201, response.text


STEPS = {
    "note": {"note_text": "Своими словами."},
    "factors": {"factors": FACTORS[:1]},
    "decision": {"decision": {"choice": "keep"}},
}


@pytest.mark.parametrize(
    "present",
    [(), ("note",), ("factors",), ("decision",), ("note", "factors"), ("note", "factors",
     "decision")],
)
def test_every_step_is_skippable(client, settings, account_factory, session_factory, present):
    owner = account_factory(f"rv-skip-{'-'.join(present) or 'none'}@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    overrides = {}
    for step in present:
        overrides.update(STEPS[step])
    _, response = save(client, **overrides)
    assert response.status_code == 201, response.text
    review = response.json()
    assert (review["revisions"][0]["note_text"] is not None) == ("note" in present)
    assert bool(review["factors"]) == ("factors" in present)
    assert (review["decision"] is not None) == ("decision" in present)


def test_null_decision_is_neither_inconclusive_nor_a_skipped_step(
    client, settings, account_factory, session_factory, engine
):
    owner = account_factory("rv-null@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    skipped = save(client)[1].json()
    undecided = save(client, decision={"choice": None})[1].json()
    inconclusive = save(client, decision={"choice": "inconclusive"})[1].json()

    assert skipped["decision"] is None
    assert undecided["decision"] is not None and undecided["decision"]["choice"] is None
    assert inconclusive["decision"]["choice"] == "inconclusive"
    with engine.connect() as connection:
        stored = dict(
            connection.execute(
                text("SELECT review_id, choice FROM aa_decisions WHERE user_id = :u"),
                {"u": owner.user_id},
            ).all()
        )
    assert str(skipped["id"]) not in {str(key) for key in stored}
    assert {str(k): v for k, v in stored.items()} == {
        undecided["id"]: None,
        inconclusive["id"]: "inconclusive",
    }
    listed = client.get("/api/v1/aa/reviews", params={"subject": FINANCE_SUBJECT}).json()
    states = {row["id"]: row["decision_state"] for row in listed["reviews"]}
    assert states == {skipped["id"]: "none", undecided["id"]: "undecided",
                      inconclusive["id"]: "chosen"}


def test_decision_choice_rejects_values_outside_the_vocabulary(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rv-choice@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    _, response = save(client, decision={"choice": "reject"})
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_review"


def test_save_is_idempotent_and_a_key_cannot_be_reused(
    client, settings, account_factory, session_factory, engine
):
    owner = account_factory("rv-idem@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    context = get_context(client).json()
    body = review_body(context, FINANCE_SUBJECT_IN, note_text="Один раз.")
    first = client.post("/api/v1/aa/reviews", json=body)
    replay = client.post("/api/v1/aa/reviews", json=body)
    assert (first.status_code, replay.status_code) == (201, 200)
    assert replay.json()["id"] == first.json()["id"] and replay.json()["replayed"] is True
    assert row_counts(engine, owner.user_id)["aa_reviews"] == 1
    reused = client.post(
        f"/api/v1/aa/reviews/{first.json()['id']}/revise",
        json={"note_text": "x", "idempotency_key": body["idempotency_key"]},
    )
    assert reused.status_code == 409
    assert reused.json()["code"] == "idempotency_key_reused"


def test_a_save_replayed_later_freezes_the_context_that_was_seen(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rv-offline@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    context = get_context(client).json()
    # Facts LifeOS learns after the user looked do not leak into the Review.
    with session_factory() as db:
        from tests.aa_signal_helpers import transaction

        transaction(
            db, user_id=owner.user_id, amount="999.99", identity="late",
            recorded_at=datetime.now(UTC),
        )
        db.commit()
    response = client.post("/api/v1/aa/reviews", json=review_body(context, FINANCE_SUBJECT_IN))
    assert response.status_code == 201, response.text
    items = items_by_role(response.json())
    assert _num(items["actual"]["value"]["num"]) == ACTUAL_AMOUNT
    assert get_context(client).json()["context_fingerprint"] != context["context_fingerprint"]


def test_a_context_that_can_no_longer_be_reproduced_is_refused(
    client, settings, account_factory, session_factory, engine
):
    owner = account_factory("rv-changed@example.com")
    ids = seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    context = get_context(client).json()
    tampered = client.post(
        "/api/v1/aa/reviews",
        json=review_body(context, FINANCE_SUBJECT_IN, context_fingerprint="0" * 64),
    )
    assert tampered.status_code == 409
    assert tampered.json()["code"] == "review_context_changed"
    erased = client.delete(f"/api/v1/aa/facts/aa_expectation_versions/{ids['expectation']}",
                           params={"mode": "hard"})
    assert erased.status_code == 200
    stale = client.post("/api/v1/aa/reviews", json=review_body(context, FINANCE_SUBJECT_IN))
    assert stale.status_code == 409
    assert row_counts(engine, owner.user_id)["aa_reviews"] == 0


def test_context_as_of_in_the_future_is_rejected(client, settings, account_factory):
    owner = account_factory("rv-future@example.com")
    authenticate(client, settings, owner)
    context = get_context(client, PROJECT_SUBJECT).json()
    body = review_body(context, PROJECT_SUBJECT_IN, context_as_of="2099-01-01T00:00:00+00:00")
    response = client.post("/api/v1/aa/reviews", json=body)
    assert response.status_code == 422


# ── revise ────────────────────────────────────────────────────────────────


def test_revision_appends_and_never_rewrites(client, settings, account_factory, session_factory):
    owner = account_factory("rv-revise@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    _, response = save(
        client, note_text="Сначала так.", factors=FACTORS[:1], decision={"choice": "keep"}
    )
    first = response.json()
    factor_id = first["factors"][0]["id"]
    revised = client.post(
        f"/api/v1/aa/reviews/{first['id']}/revise",
        json={
            "note_text": "Позже добавлю: не только аудит.",
            "retract_factor_ids": [factor_id],
            "add_factors": [
                {"text": "Объём вырос после аудита", "epistemic_kind": "mine",
                 "replaces_id": factor_id},
            ],
            "decision": {"choice": "inconclusive"},
            "idempotency_key": "rv-revise-0001",
        },
    )
    assert revised.status_code == 201, revised.text
    review = revised.json()
    assert review["current_revision"] == 2 and review["revised_at"] is not None
    assert [row["note_text"] for row in review["revisions"]] == [
        "Сначала так.", "Позже добавлю: не только аудит."
    ]
    old, new = review["factors"]
    assert old["id"] == factor_id and old["retracted_in_revision"] == 2
    assert old["epistemic_kind"] == "observed"  # the original interpretation is kept
    assert new["replaces_id"] == factor_id and new["added_in_revision"] == 2
    assert [(d["choice"], d["superseded_in_revision"]) for d in review["decisions"]] == [
        ("keep", 2), ("inconclusive", None)
    ]
    assert review["decision"]["choice"] == "inconclusive"
    assert [_frozen(item) for item in review["items"]] == [
        _frozen(item) for item in first["items"]
    ]
    replay = client.post(
        f"/api/v1/aa/reviews/{first['id']}/revise",
        json={"note_text": "ignored", "idempotency_key": "rv-revise-0001"},
    )
    assert replay.status_code == 200 and replay.json()["current_revision"] == 2


def test_revision_can_set_no_decision_explicitly(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rv-revise-null@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    review = save(client, decision={"choice": "later"})[1].json()
    revised = client.post(
        f"/api/v1/aa/reviews/{review['id']}/revise",
        json={"decision": {"choice": None}, "idempotency_key": "rv-null-rev-01"},
    ).json()
    assert revised["decision"]["choice"] is None
    assert [d["choice"] for d in revised["decisions"]] == ["later", None]


def test_revision_validation(client, settings, account_factory, session_factory):
    owner = account_factory("rv-revise-bad@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    review = save(client, factors=FACTORS[:1])[1].json()
    url = f"/api/v1/aa/reviews/{review['id']}/revise"
    empty = client.post(url, json={"idempotency_key": "rv-empty-rev-1"})
    assert (empty.status_code, empty.json()["code"]) == (422, "empty_revision")
    whitespace = client.post(url, json={"note_text": "   ", "idempotency_key": "rv-empty-rev-2"})
    assert whitespace.json()["code"] == "empty_revision"
    unknown = client.post(
        url,
        json={"retract_factor_ids": ["00000000-0000-0000-0000-000000000001"],
              "idempotency_key": "rv-bad-factor-1"},
    )
    assert (unknown.status_code, unknown.json()["code"]) == (422, "invalid_factor")
    factor_id = review["factors"][0]["id"]
    assert client.post(
        url, json={"retract_factor_ids": [factor_id], "idempotency_key": "rv-retract-01"}
    ).status_code == 201
    again = client.post(
        url, json={"retract_factor_ids": [factor_id], "idempotency_key": "rv-retract-02"}
    )
    assert again.json()["code"] == "invalid_factor"
    missing = client.post(
        "/api/v1/aa/reviews/00000000-0000-0000-0000-000000000009/revise",
        json={"note_text": "x", "idempotency_key": "rv-missing-01"},
    )
    assert (missing.status_code, missing.json()["code"]) == (404, "review_not_found")


# ── isolation and guards ──────────────────────────────────────────────────


def test_reviews_are_isolated_between_accounts(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rv-owner@example.com")
    other = account_factory("rv-other@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    review = save(client, note_text="Моё.")[1].json()

    authenticate(client, settings, other)
    assert client.get(f"/api/v1/aa/reviews/{review['id']}").status_code == 404
    listed = client.get("/api/v1/aa/reviews", params={"subject": FINANCE_SUBJECT}).json()
    assert listed["reviews"] == []
    revise = client.post(
        f"/api/v1/aa/reviews/{review['id']}/revise",
        json={"note_text": "чужое", "idempotency_key": "rv-cross-0001"},
    )
    assert revise.status_code == 404
    items = items_by_role(get_context(client).json())
    assert items["expectation"]["availability"] == "no_data"
    assert items["actual"]["value"] is None


def test_write_guards_run_before_the_body_is_parsed(
    client, settings, account_factory, session_factory
):
    owner = account_factory("rv-guards@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    context = get_context(client).json()
    body = review_body(context, FINANCE_SUBJECT_IN)
    wrong_type = client.post(
        "/api/v1/aa/reviews", content=json.dumps(body), headers={"Content-Type": "text/plain"}
    )
    # 415 from the dependency, not a parser 422 (Slice 3 regression guard).
    assert wrong_type.status_code == 415
    garbage = client.post(
        "/api/v1/aa/reviews", content="not json", headers={"Content-Type": "text/plain"}
    )
    assert garbage.status_code == 415
    with_user = client.post(
        "/api/v1/aa/reviews", json={**body, "user_id": str(owner.user_id)}
    )
    assert (with_user.status_code, with_user.json()["code"]) == (422, "invalid_review")
    cross = client.post(
        "/api/v1/aa/reviews", json=body, headers={"Origin": "https://evil.example"}
    )
    assert cross.status_code == 403
    revise_type = client.post(
        "/api/v1/aa/reviews/00000000-0000-0000-0000-000000000009/revise",
        content="{}",
        headers={"Content-Type": "text/plain"},
    )
    assert revise_type.status_code == 415


def test_writes_are_closed_when_the_gate_is_closed(
    test_database_url, session_factory, account_factory
):
    gated = Settings(
        environment="test",
        database_url=test_database_url,
        bootstrap_token="test-bootstrap-token-that-is-at-least-32-chars",
        allowed_hosts=["testserver"],
        allowed_origins=["http://testserver"],
        cookie_secure=False,
    )
    owner = account_factory("rv-gate@example.com")
    app = create_app(settings=gated, session_factory=session_factory)
    with TestClient(app, headers={"Origin": "http://testserver"}) as gated_client:
        authenticate(gated_client, gated, owner)
        context = get_context(gated_client, PROJECT_SUBJECT)
        assert context.status_code == 200  # reading is not collection
        response = gated_client.post(
            "/api/v1/aa/reviews", json=review_body(context.json(), PROJECT_SUBJECT_IN)
        )
    assert response.status_code == 403
    assert response.json()["code"] == "aa_writes_disabled"


def test_list_is_bounded_and_newest_first(client, settings, account_factory, session_factory):
    owner = account_factory("rv-list@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    ids = [save(client)[1].json()["id"] for _ in range(3)]
    listed = client.get(
        "/api/v1/aa/reviews", params={"subject": FINANCE_SUBJECT, "limit": 2}
    ).json()
    assert [row["id"] for row in listed["reviews"]] == ids[::-1][:2]
    assert client.get(
        "/api/v1/aa/reviews", params={"subject": FINANCE_SUBJECT, "limit": 500}
    ).status_code == 422


# ── manifest, export, erasure, catalogue ──────────────────────────────────


def test_render_manifest_holds_layout_only(client, settings, account_factory, session_factory,
                                           engine):
    owner = account_factory("rv-manifest@example.com")
    seed_finance(session_factory, owner.user_id)
    with session_factory() as db:
        observation(db, user_id=owner.user_id, score="6")
        db.commit()
    authenticate(client, settings, owner)
    review = save(client, note_text="Текст пользователя")[1].json()
    with engine.connect() as connection:
        manifest = connection.scalar(
            text("SELECT render_manifest FROM aa_reviews WHERE id = :id"), {"id": review["id"]}
        )
    assert set(manifest) == {"manifest_version", "subject_kind", "sections"}
    assert manifest["subject_kind"] in {"finance_period", "project"}
    assert [section["key"] for section in manifest["sections"]] == list(members(ReviewSection))
    for section in manifest["sections"]:
        assert set(section) == {"key", "ordinals"}
        assert all(isinstance(ordinal, int) for ordinal in section["ordinals"])
    encoded = json.dumps(manifest)
    for needle in ("62345", "61345", "41234", "20111", "Текст", "2026-08"):
        assert needle not in encoded
    ordinals = sorted(o for s in manifest["sections"] for o in s["ordinals"])
    assert ordinals == [item["ordinal"] for item in review["items"]]


def test_export_contains_every_review_table(client, settings, account_factory, session_factory):
    owner = account_factory("rv-export@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    review = save(
        client, note_text="Экспорт.", factors=FACTORS[:1], decision={"choice": "later"}
    )[1].json()
    response = client.get("/api/v1/export")
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        for table in REVIEW_TABLES:
            assert manifest["tables"][table]["rows"] >= 1, table
            assert table in manifest["aa_columns"]
        reviews = [json.loads(line) for line in archive.read("aa_reviews.ndjson").splitlines()]
    assert manifest["alembic_revision"] == "20261001_0010"
    assert [row["id"] for row in reviews] == [review["id"]]


def test_account_deletion_removes_every_review_row(
    client, settings, account_factory, session_factory, engine
):
    owner = account_factory("rv-erase@example.com")
    other = account_factory("rv-erase-other@example.com")
    for account in (owner, other):
        seed_finance(session_factory, account.user_id)
        authenticate(client, settings, account)
        save(client, note_text="x", factors=FACTORS[:1], decision={"choice": None})
    assert all(count >= 1 for count in row_counts(engine, owner.user_id).values())
    authenticate(client, settings, owner)
    deleted = client.request(
        "DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"}
    )
    assert deleted.status_code == 204
    assert set(row_counts(engine, owner.user_id).values()) == {0}
    assert all(count >= 1 for count in row_counts(engine, other.user_id).values())


def test_signal_catalogue_is_still_exactly_four_rules():
    # Slice 4 must not add a «review available» signal: that would be a fifth rule.
    assert sorted(rule.RULE_ID for rule in signal_rules()) == [
        "coverage.window.partial",
        "data.source.stale",
        "finance.monthly_spend.threshold",
        "project.forecast.revision",
    ]


@pytest.mark.parametrize(
    ("constraint", "enum_cls"),
    [
        ("ck_aa_review_context_items_section", ReviewSection),
        ("ck_aa_review_context_items_role", ReviewRole),
        ("ck_aa_review_context_items_availability", ReviewAvailability),
        ("ck_aa_review_context_items_desire", Desire),
        ("ck_aa_review_context_items_redaction_reason", RedactionReason),
        ("ck_aa_decisions_review_choice", ReviewDecisionChoice),
        ("ck_aa_decisions_experiment_choice", ExperimentDecisionChoice),
        ("ck_aa_decisions_scope", DecisionScope),
        ("ck_aa_review_factors_scope", DecisionScope),
    ],
)
def test_review_enums_match_their_database_constraints(engine, constraint, enum_cls):
    definition = constraint_definition(engine, constraint)
    found = set(QUOTED.findall(definition))
    if enum_cls is Desire:
        found -= {"delta"}  # the constraint also pins desire to the delta role
    if constraint == "ck_aa_decisions_review_choice":
        found -= {"review"}  # the constraint also pins the vocabulary to its scope
    if constraint == "ck_aa_decisions_experiment_choice":
        found -= {"experiment"}
    assert found == set(members(enum_cls))


def test_redacted_item_cannot_keep_a_value(client, settings, account_factory, session_factory):
    owner = account_factory("rv-check@example.com")
    seed_finance(session_factory, owner.user_id)
    authenticate(client, settings, owner)
    review = save(client)[1].json()
    with session_factory() as db:
        with pytest.raises(IntegrityError):
            db.execute(
                text(
                    "UPDATE aa_review_context_items SET redacted_at = now(),"
                    " redaction_reason = 'source_hard_deleted'"
                    " WHERE review_id = :id AND availability = 'present'"
                ),
                {"id": review["id"]},
            )
            db.flush()
        db.rollback()


def test_m5_roundtrip_leaves_earlier_schema_untouched(engine, test_database_url):
    from tests.test_aa_m2_migration import protected_schema

    before = protected_schema(engine)
    earlier = {
        name: [
            (c["name"], str(c["type"]), c["nullable"], c["default"])
            for c in inspect(engine).get_columns(name)
        ]
        for name in inspect(engine).get_table_names()
        if name.startswith("aa_") and name not in REVIEW_TABLES
    }
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", test_database_url)
    script = ScriptDirectory.from_config(config)
    # M6 (Slice 6) sits directly on M5; the M5 chain position is unchanged.
    # M7 (Slice 7) sits on M6; the M5 chain position is unchanged.
    assert script.get_heads() == ["20261001_0010"]
    assert script.get_revision("20260930_0008").down_revision == "20260929_0007"
    assert script.get_revision("20260929_0007").down_revision == "20260928_0006"
    assert script.get_revision("20260928_0006").down_revision == "20260928_0005"
    command.downgrade(config, "20260928_0005")
    try:
        assert not set(REVIEW_TABLES) & set(inspect(engine).get_table_names())
        assert protected_schema(engine) == before
    finally:
        command.upgrade(config, "head")
    for name, columns in earlier.items():
        assert columns == [
            (c["name"], str(c["type"]), c["nullable"], c["default"])
            for c in inspect(engine).get_columns(name)
        ], f"M5 altered {name}"
    inspector = inspect(engine)
    for model in (AAReview, AAReviewRevision, AAReviewContextItem, AAReviewContextSource,
                  AAReviewFactor, AADecision):
        name = model.__tablename__
        assert set(model.__table__.c.keys()) == {c["name"] for c in inspector.get_columns(name)}
        assert {
            check.name for check in model.__table__.constraints
            if check.name and check.name.startswith("ck_")
        } == {check["name"] for check in inspector.get_check_constraints(name)}
        installed = {index["name"] for index in inspector.get_indexes(name)}
        assert {index.name for index in model.__table__.indexes} <= installed


def test_snapshot_contract_is_untouched_by_the_review_slice():
    from typing import get_args

    from app.schemas.state import StateEnvelope, StateReplace

    # Reviews live in relational AA history; the operational snapshot stays v2.
    for model in (StateReplace, StateEnvelope):
        assert get_args(model.model_fields["schema_version"].annotation) == (2,)
