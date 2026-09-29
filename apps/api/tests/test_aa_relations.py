"""Slice 7 · relations, proposals, feedback, ranking and importance (S7-01…11, 26, 35, 45)."""

from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.models import AACrossReference, AAImportanceRating, AARelationFeedback
from tests.aa_helpers import authenticate
from tests.aa_system_review_helpers import (
    BASE,
    SEPTEMBER,
    expense_context,
    key,
    link,
    obligation,
    observation,
    ok,
    respond,
    review,
    sr_clock,  # noqa: F401  (fixture, applied module-wide)
    transaction,
    walk_keys,
)

PERIOD_KEY = "change|finance_spend_vs_prior|finance:period:2026-09|finance.monthly_spend|2026-09"
TX_KEY = "subject|finance:transaction:t1"

pytestmark = pytest.mark.usefixtures("sr_clock")


def _setup(client, settings, account_factory, email="relations@example.com"):
    owner = account_factory(email)
    authenticate(client, settings, owner)
    transaction(client, "t1", "180.00")
    transaction(client, "t2", "90.00", "2026-09-12")
    return owner


# ───────────────────────────── user links ─────────────────────────────


def test_s7_01_02_manual_link_defaults_and_note(client, settings, account_factory):
    _setup(client, settings, account_factory)
    body = ok(link(client, TX_KEY, PERIOD_KEY, note="  совпало с переездом  ", period=SEPTEMBER),
              201)
    assert body["relation_type"] == "related"
    assert body["epistemic_kind"] == "association"
    assert body["status"] == "approved"
    assert body["source"] == "user"
    assert body["note"] == "совпало с переездом"
    assert body["family"] is None and body["proposal_key"] is None
    listed = ok(client.get(f"{BASE}/relations"), 200)["relations"]
    assert [row["note"] for row in listed] == ["совпало с переездом"]


def test_s7_10_causal_vocabulary_is_refused_before_anything_else(
    client, settings, account_factory
):
    _setup(client, settings, account_factory)
    for word in ("caused", "Caused By", "definitely-caused-by", "leads_to", "because",
                 "причина", "DUE TO"):
        response = link(client, TX_KEY, PERIOD_KEY, relation_type=word)
        assert response.status_code == 422, word
        assert response.json()["code"] == "causal_relation_forbidden", word
    unknown = link(client, TX_KEY, PERIOD_KEY, relation_type="correlates_strongly")
    assert unknown.json()["code"] == "invalid_relation"
    assert ok(client.get(f"{BASE}/relations"), 200)["relations"] == []


def test_s7_11_hypothesis_types_are_marked_hypotheses(client, settings, account_factory):
    _setup(client, settings, account_factory)
    for kind in ("may_contribute_to", "may_increase_risk_of", "may_reduce_probability_of"):
        body = ok(link(client, TX_KEY, PERIOD_KEY, relation_type=kind), 201)
        assert body["epistemic_kind"] == "hypothesis"
        assert body["status"] == "approved" and body["source"] == "user"
    for kind in ("temporally_associated", "co_occurs_with", "conflicts_with", "supports",
                 "preceded_by", "followed_by"):
        assert ok(link(client, TX_KEY, PERIOD_KEY, relation_type=kind), 201)[
            "epistemic_kind"] == "association"


def test_link_validation_ownership_and_symmetry(
    client, settings, account_factory, session_factory
):
    _setup(client, settings, account_factory)
    assert link(client, TX_KEY, TX_KEY).json()["code"] == "self_relation"
    assert link(client, "subject|nope", PERIOD_KEY).json()["code"] == "invalid_ref"
    assert link(client, "section|2026-09|changed", PERIOD_KEY).json()["code"] == "invalid_ref"
    missing = link(client, f"fact|aa_observations|{uuid4()}", TX_KEY)
    assert missing.status_code == 404 and missing.json()["code"] == "ref_not_found"
    assert link(client, "subject|finance:transaction:ghost", TX_KEY).status_code == 404
    # Symmetric types are stored canonically: the reverse link is the same link.
    first = ok(link(client, TX_KEY, PERIOD_KEY, relation_type="co_occurs_with"), 201)
    again = link(client, PERIOD_KEY, TX_KEY, relation_type="co_occurs_with")
    assert again.status_code == 200 and again.json()["id"] == first["id"]
    # A directed type keeps its order.
    directed = ok(link(client, TX_KEY, PERIOD_KEY, relation_type="supports"), 201)
    assert directed["from"]["key"] == TX_KEY


def test_foreign_items_cannot_be_linked(client, settings, account_factory):
    other = account_factory("relations-other@example.com")
    authenticate(client, settings, other)
    seen = observation(client, "усталость")
    _setup(client, settings, account_factory)
    response = link(client, f"fact|aa_observations|{seen['id']}", TX_KEY)
    assert response.status_code == 404


def test_s7_45_link_idempotency_and_key_reuse(client, settings, account_factory):
    _setup(client, settings, account_factory)
    body = {"id": str(uuid4()), "from_key": TX_KEY, "to_key": PERIOD_KEY,
            "idempotency_key": key()}
    assert client.post(f"{BASE}/relations", json=body).status_code == 201
    replay = client.post(f"{BASE}/relations", json=body)
    assert replay.status_code == 200 and replay.json()["replayed"] is True
    reused = client.post(f"{BASE}/relations", json={**body, "id": str(uuid4())})
    assert reused.status_code == 409 and reused.json()["code"] == "idempotency_key_reused"
    taken = client.post(f"{BASE}/relations", json={**body, "idempotency_key": key(),
                                                    "relation_type": "supports"})
    assert taken.status_code == 409 and taken.json()["code"] == "relation_id_unavailable"


def test_link_note_edit_appends_and_removal_is_idempotent(
    client, settings, account_factory, session_factory
):
    _setup(client, settings, account_factory)
    created = ok(link(client, TX_KEY, PERIOD_KEY, note="первая"), 201)
    edited = ok(client.post(f"{BASE}/relations/{created['id']}/feedback", json={
        "response": "approved", "note": "вторая", "idempotency_key": key()}), 201)
    assert edited["note"] == "вторая"
    assert [entry["note"] for entry in edited["history"]] == ["вторая"]
    refused = client.post(f"{BASE}/relations/{created['id']}/feedback", json={
        "response": "rejected", "note": None, "idempotency_key": key()})
    assert refused.status_code == 422 and refused.json()["code"] == "invalid_response"
    ok(client.post(f"{BASE}/importance", json={
        "target_key": f"relation|{created['id']}", "importance": "matters",
        "idempotency_key": key()}), 201)
    removal = {"idempotency_key": key()}
    assert ok(client.post(f"{BASE}/relations/{created['id']}/delete", json=removal), 200)[
        "replayed"] is False
    assert ok(client.post(f"{BASE}/relations/{created['id']}/delete", json=removal), 200)[
        "replayed"] is True
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AACrossReference)) == 0
        assert db.scalar(select(func.count()).select_from(AARelationFeedback)) == 0
        assert db.scalar(select(func.count()).select_from(AAImportanceRating)) == 0


def test_write_guards(client, settings, account_factory, app):
    owner = _setup(client, settings, account_factory)
    body = {"id": str(uuid4()), "from_key": TX_KEY, "to_key": PERIOD_KEY,
            "idempotency_key": key()}
    wrong_type = client.post(f"{BASE}/relations", content="{}",
                             headers={"Content-Type": "text/plain"})
    assert wrong_type.status_code == 415
    injected = client.post(f"{BASE}/relations", json={**body, "user_id": str(owner.user_id)})
    assert injected.status_code == 422 and injected.json()["code"] == "invalid_relation"
    app.state.settings.aa_write_enabled = False
    try:
        closed = client.post(f"{BASE}/relations", json=body)
        assert closed.status_code == 403
        # Reads stay open: they never write.
        assert client.get(f"{BASE}/system-review", params={"period": SEPTEMBER}).status_code == 200
    finally:
        app.state.settings.aa_write_enabled = True
    client.cookies.clear()
    assert client.get(f"{BASE}/relations").status_code == 401


# ───────────────────────────── proposals ─────────────────────────────


def _proposal_setup(client, settings, account_factory, email="proposals@example.com"):
    owner = _setup(client, settings, account_factory, email)
    debt = obligation(client)
    expense_context(client, "t1", plannedness="unplanned", funding_source="credit",
                    obligation_entity_id=debt["entity_id"],
                    emotional_context="тяжёлая неделя", expected_recurrence="recurring",
                    recurrence_per_month="2")
    observation(client, "плохо спал", "2026-09-11")
    return owner, debt


def _pending(client, period=SEPTEMBER):
    return review(client, period)["sections"]["requires_confirmation"]


def test_s7_03_candidates_start_proposed_and_are_not_rows(
    client, settings, account_factory, session_factory
):
    _proposal_setup(client, settings, account_factory)
    pending = _pending(client)
    families = {item["family"] for item in pending["items"]}
    assert {"finance_credit_obligation", "finance_emotional_context",
            "observation_temporal"} <= families
    assert pending["count"] == len(pending["items"])
    for item in pending["items"]:
        assert item["status"] == "proposed" and item["source"] == "rule"
        assert item["conditions"] and item["evidence"] and item["rule_version"] == 1
        assert item["epistemic_kind"] in ("association", "hypothesis")
    emotional = next(i for i in pending["items"] if i["family"] == "finance_emotional_context")
    assert emotional["epistemic_kind"] == "hypothesis"
    assert emotional["relation_type"] == "may_contribute_to"
    # The self-report's words never travel in a proposal.
    assert "тяжёлая неделя" not in str(pending)
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AACrossReference)) == 0


def test_s7_04_05_06_answers_persist_and_rejected_is_not_respawned(
    client, settings, account_factory, session_factory
):
    _proposal_setup(client, settings, account_factory)
    items = {item["family"]: item for item in _pending(client)["items"]}
    approved = ok(respond(client, items["finance_credit_obligation"], "approved"), 201)
    assert approved["status"] == "approved" and approved["source"] == "rule"
    assert approved["epistemic_kind"] == "hypothesis"
    assert approved["responded_at"] and approved["proposed_at"]
    rejected = ok(respond(client, items["observation_temporal"], "rejected", note="не связано"),
                  201)
    assert rejected["status"] == "rejected" and rejected["note"] == "не связано"
    unsure = ok(respond(client, items["finance_emotional_context"], "unsure"), 201)
    assert unsure["status"] == "unsure"
    left = _pending(client)
    answered = {items[f]["proposal_key"] for f in
                ("finance_credit_obligation", "observation_temporal", "finance_emotional_context")}
    assert not answered & {item["proposal_key"] for item in left["items"]}
    # A changed answer appends; history keeps the rejection.
    changed = ok(client.post(f"{BASE}/relations/{rejected['id']}/feedback", json={
        "response": "unsure", "note": None, "idempotency_key": key()}), 201)
    assert [entry["response"] for entry in changed["history"]] == ["rejected", "unsure"]
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AARelationFeedback)) == 4
    # Reading again never re-proposes an answered occurrence.
    assert not answered & {item["proposal_key"] for item in _pending(client)["items"]}


def test_s7_07_same_evidence_is_one_candidate_and_one_row(
    client, settings, account_factory, session_factory
):
    _proposal_setup(client, settings, account_factory)
    first, second = _pending(client), _pending(client)
    assert [i["proposal_key"] for i in first["items"]] == [i["proposal_key"] for i in
                                                            second["items"]]
    assert len({i["proposal_key"] for i in first["items"]}) == len(first["items"])
    candidate = first["items"][0]
    request_key = key()
    ok(respond(client, candidate, "approved", idempotency_key=request_key), 201)
    replay = respond(client, candidate, "approved", idempotency_key=request_key)
    assert replay.status_code == 200 and replay.json()["replayed"] is True
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AACrossReference)) == 1


def test_s7_08_new_occurrence_and_changed_evidence(
    client, settings, account_factory
):
    _, debt = _proposal_setup(client, settings, account_factory)
    september = {i["family"]: i for i in _pending(client)["items"]}
    credit = september["finance_credit_obligation"]
    ok(respond(client, credit, "unsure"), 201)
    # Editing the expense context changes the evidence, not the occurrence.
    expense = ok(client.get(f"{BASE}/finance-contexts", params={"kind": "expense_context"}),
                 200)["contexts"][0]
    ok(client.post(f"{BASE}/finance-contexts", json={
        "entity_id": expense["entity_id"], "kind": "expense_context",
        "subject_key": expense["subject_key"],
        "payload": {**expense["payload"], "motive": "подарок"}, "idempotency_key": key()}), 201)
    relations = review(client)["sections"]["relations"]["items"]
    answered = next(r for r in relations if r["proposal_key"] == credit["proposal_key"])
    assert answered["evidence_changed_since_response"] is True
    assert answered["revisit_eligible"] is True
    assert credit["proposal_key"] not in {i["proposal_key"] for i in _pending(client)["items"]}
    # The same pattern in another month is a new occurrence with a new key.
    transaction(client, "t9", "180.00", "2026-10-03")
    expense_context(client, "t9", plannedness="unplanned", funding_source="credit",
                    obligation_entity_id=debt["entity_id"])
    october = {i["family"]: i for i in _pending(client, "2026-10")["items"]}
    assert october["finance_credit_obligation"]["proposal_key"] != credit["proposal_key"]


def test_s7_09_answers_change_ranking_never_truth(client, settings, account_factory):
    _proposal_setup(client, settings, account_factory)
    before = [i["family"] for i in _pending(client)["items"]]
    assert before.index("finance_credit_obligation") < before.index("observation_temporal")
    # Reject the credit family on another occurrence; approve observation-temporal ones.
    transaction(client, "t3", "50.00", "2026-09-20")
    expense_context(client, "t3", plannedness="unplanned")
    observation(client, "ссора", "2026-09-21")
    observation(client, "усталость", "2026-09-19")
    items = _pending(client)["items"]
    ok(respond(client, next(i for i in items if i["family"] == "finance_credit_obligation"),
               "rejected"), 201)
    for item in [i for i in items if i["family"] == "observation_temporal"][:2]:
        ok(respond(client, item, "approved"), 201)
    after = _pending(client)["items"]
    families = [i["family"] for i in after]
    assert families.index("observation_temporal") < families.index("finance_emotional_context")
    observed = next(i for i in after if i["family"] == "observation_temporal")
    assert observed["history"]["approved"] == 2
    assert observed["epistemic_kind"] == "association" and observed["status"] == "proposed"
    forbidden = {"confidence", "probability", "score", "weight", "likelihood"}
    assert not forbidden & walk_keys(review(client))


def test_answering_a_proposal_that_no_longer_holds_is_refused(
    client, settings, account_factory, session_factory
):
    _proposal_setup(client, settings, account_factory)
    candidate = _pending(client)["items"][0]
    stale = {**candidate, "proposal_key": "0" * 64}
    response = respond(client, stale, "approved")
    assert response.status_code == 409 and response.json()["code"] == "proposal_not_current"
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AACrossReference)) == 0
    deletion = client.post(f"{BASE}/relations/{uuid4()}/delete", json={"idempotency_key": key()})
    assert deletion.status_code == 200
    answered = ok(respond(client, candidate, "rejected"), 201)
    refused = client.post(f"{BASE}/relations/{answered['id']}/delete",
                          json={"idempotency_key": key()})
    assert refused.status_code == 409 and refused.json()["code"] == "relation_not_deletable"


def test_s7_35_relation_filters(client, settings, account_factory):
    _proposal_setup(client, settings, account_factory)
    items = {i["family"]: i for i in _pending(client)["items"]}
    manual = ok(link(client, TX_KEY, PERIOD_KEY, period=SEPTEMBER), 201)
    ok(respond(client, items["finance_credit_obligation"], "approved"), 201)
    ok(respond(client, items["observation_temporal"], "rejected"), 201)
    ok(client.post(f"{BASE}/importance", json={
        "target_key": f"relation|{manual['id']}", "importance": "matters",
        "idempotency_key": key()}), 201)

    def ids(**params):
        return [row["relation_type"] + ":" + row["status"]
                for row in ok(client.get(f"{BASE}/relations", params=params), 200)["relations"]]

    assert len(ids()) == 3
    assert ids(status="rejected") == ["temporally_associated:rejected"]
    assert ids(source="user") == ["related:approved"]
    assert sorted(ids(type=["may_contribute_to", "related"])) == [
        "may_contribute_to:approved", "related:approved"]
    assert len(ids(domain="observation")) == 1
    assert len(ids(period="2026")) == 3 and ids(period="2026-08") == []
    assert ids(importance="matters") == ["related:approved"]
    assert len(ids(importance="undecided")) == 2


# ───────────────────────────── importance ─────────────────────────────


def test_s7_26_importance_is_user_owned_and_versioned(
    client, settings, account_factory, session_factory
):
    owner = _setup(client, settings, account_factory)
    body = {"target_key": PERIOD_KEY, "importance": "matters", "idempotency_key": key()}
    assert client.post(f"{BASE}/importance", json=body).status_code == 201
    assert client.post(f"{BASE}/importance", json=body).json()["replayed"] is True
    assert client.post(f"{BASE}/importance", json={**body, "importance": "ok"}).status_code == 409
    ok(client.post(f"{BASE}/importance", json={**body, "importance": "none",
                                               "idempotency_key": key()}), 201)
    assert client.post(f"{BASE}/importance", json={**body, "importance": "5",
                                                   "idempotency_key": key()}).status_code == 422
    assert client.post(f"{BASE}/importance", json={
        "target_key": f"relation|{uuid4()}", "importance": "ok",
        "idempotency_key": key()}).status_code == 404
    with session_factory() as db:
        rows = db.scalars(select(AAImportanceRating).where(
            AAImportanceRating.user_id == owner.user_id).order_by(AAImportanceRating.recorded_at)
        ).all()
    assert [(row.importance, row.status) for row in rows] == [
        ("matters", "superseded"), ("none", "active")]
    importance = review(client)["importance"]
    assert importance[PERIOD_KEY]["importance"] == "none"
    # Importance never reorders or regroups the evidence.
    changed = review(client)["sections"]["changed"]["items"]
    ok(client.post(f"{BASE}/importance", json={
        "target_key": changed[-1]["ref"], "importance": "matters", "idempotency_key": key()}),
       201)
    assert [i["ref"] for i in review(client)["sections"]["changed"]["items"]] == [
        i["ref"] for i in changed]
