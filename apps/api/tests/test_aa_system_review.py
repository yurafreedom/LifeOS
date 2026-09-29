"""Slice 7 · live System Review, «Ревью доступно» and «Требует подтверждения»
(S7-12, 13, 18…25, 27…29, 50)."""

from decimal import Decimal

import pytest

from app.analytics.rules import signal_rules
from tests.aa_experiment_helpers import (
    created,
    move,
    utc,
)
from tests.aa_helpers import authenticate
from tests.aa_system_review_helpers import (
    BASE,
    SEPTEMBER,
    correct,
    expectation,
    expense_context,
    key,
    obligation,
    ok,
    respond,
    review,
    row_counts,
    save,
    sr_clock,  # noqa: F401  (fixture, applied module-wide)
    target,
    transaction,
    waiting,
    walk_keys,
    walk_strings,
)

pytestmark = pytest.mark.usefixtures("sr_clock")


def _owner(client, settings, account_factory, email="system-review@example.com"):
    owner = account_factory(email)
    authenticate(client, settings, owner)
    return owner


def _items(body, section="changed"):
    return body["sections"][section]["items"]


def _by_kind(body, kind):
    return next(item for item in _items(body) if item["kind"] == kind)


# ───────────────────────────── read-only guarantee ─────────────────────────────


def test_s7_12_50_every_slice_7_get_writes_zero_rows_with_the_gate_open(
    client, settings, account_factory, engine
):
    assert settings.aa_write_enabled is True
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00")
    transaction(client, "t0", "900.00", "2026-08-10")
    debt = obligation(client)
    expense_context(client, "t1", plannedness="unplanned", funding_source="credit",
                    obligation_entity_id=debt["entity_id"], expected_recurrence="recurring",
                    recurrence_per_month="2")
    target(client, SEPTEMBER, "150.00")
    ok(save(client, finalize=True), 201)
    before = row_counts(engine)
    for path, params in (
        ("/system-review", {"period": SEPTEMBER}),
        ("/system-review", {"period": "2026-10"}),
        ("/system-review", {"period": "2026"}),
        ("/system-review/waiting", {}),
        ("/relations", {}),
        ("/finance-contexts", {}),
        ("/system-reviews/2026-09/revisions", {}),
        ("/system-reviews/2026-09/revisions/1", {"compare": "true"}),
        ("/system-reviews/2026-09/revisions/1/export", {"format": "pdf"}),
    ):
        assert client.get(BASE + path, params=params).status_code == 200, path
    assert row_counts(engine) == before


def test_s7_18_logical_review_exists_without_any_row(
    client, settings, account_factory, engine
):
    _owner(client, settings, account_factory)
    before = row_counts(engine)
    body = review(client, "2026-10")
    assert body["status"] == "IN_PROGRESS" and body["period_state"] == "in_progress"
    assert body["saved"] == {"count": 0, "latest_revision": None, "finalized_revision": None,
                             "has_newer_draft": False}
    assert body["not_a_verdict"] is True
    assert all(not _items(body, name) for name in ("changed", "improved", "repeated",
                                                   "tradeoffs", "relations"))
    assert row_counts(engine) == before
    empty_year = review(client, "2026")
    assert empty_year["period_kind"] == "year" and empty_year["status"] == "IN_PROGRESS"


def test_period_validation(client, settings, account_factory):
    _owner(client, settings, account_factory)
    assert client.get(f"{BASE}/system-review").json()["code"] == "period_required"
    for bad in ("2026-13", "26-09", "1999-01", "2026-9"):
        assert client.get(f"{BASE}/system-review", params={"period": bad}).status_code == 422
    future = client.get(f"{BASE}/system-review", params={"period": "2026-11"})
    assert future.status_code == 422 and future.json()["code"] == "period_in_future"
    assert client.get(f"{BASE}/system-review", params={
        "period": SEPTEMBER, "timezone": "Mars/Base"}).json()["code"] == "invalid_timezone"


# ───────────────────────────── what changed / improved ─────────────────────────────


def test_changes_are_typed_juxtaposed_and_grounded_only_by_a_target(
    client, settings, account_factory
):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "700.00")
    transaction(client, "t0", "900.00", "2026-08-10")
    expectation(client, SEPTEMBER, "800.00")
    body = review(client)
    vs_expectation = _by_kind(body, "finance_spend_vs_expectation")
    assert vs_expectation["current"]["value"] == {
        "type": "money", "unit_code": "UAH", "num": "700.000000", "date": None, "text": None,
        "scale_min": None, "scale_max": None}
    assert vs_expectation["delta"]["state"] == "known"
    assert Decimal(vs_expectation["delta"]["value"]["num"]) == Decimal("-100")
    # An Expectation predicts; it never makes anything «better».
    assert vs_expectation["desire"] == "neutral"
    prior = _by_kind(body, "finance_spend_vs_prior")
    assert Decimal(prior["delta"]["value"]["num"]) == Decimal("-200")
    assert prior["delta"]["direction"] == "lower" and prior["desire"] == "neutral"
    assert _items(body, "improved") == []
    assert _by_kind(body, "finance_target_state")["details"]["target_state"] == "none"
    target(client, SEPTEMBER, "750.00", "lower")
    grounded = review(client)
    improved = _items(grounded, "improved")
    assert len(improved) == 1 and improved[0]["basis"]["kind"] == "target"
    assert improved[0]["basis"]["direction"] == "lower"
    assert "sources" not in walk_keys(grounded)


def test_s7_29_missing_stays_missing(client, settings, account_factory):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00")
    expense_context(client, "t1")
    body = review(client)
    state = _by_kind(body, "finance_target_state")
    assert state["details"]["target_state"] == "none"
    assert state["reference"] is None and state["delta"] is None
    prior = _by_kind(body, "finance_spend_vs_prior")
    assert prior["reference"]["value"] is None
    assert prior["delta"] == {"state": "unknown", "reason": "operand_absent"}
    analysis = body["sections"]["consequences"]["expenses"][0]
    assert analysis["context"]["plannedness"] == "unknown"
    assert analysis["context"]["funding_source"] == "unknown"
    budget = next(i for i in analysis["impacts"] if i["kind"] == "budget_deviation")
    assert budget["state"] == "needs_input" and budget["missing_inputs"] == [
        "target_or_expectation"]
    assert budget["result"] is None and budget["calculation"] is None
    position = body["sections"]["consequences"]["position"]
    assert position["income"] == "not_modeled"
    assert set(position["missing_inputs"]) == {"reserve", "essentials"}


def test_s7_13_live_review_recomputes_after_a_correction(
    client, settings, account_factory
):
    _owner(client, settings, account_factory)
    fact = transaction(client, "t1", "1800.00")
    assert _by_kind(review(client), "finance_spend_vs_prior")["current"]["value"]["num"] == \
        "1800.000000"
    correct(client, fact["id"], "180.00")
    assert _by_kind(review(client), "finance_spend_vs_prior")["current"]["value"]["num"] == \
        "180.000000"


def test_s7_27_no_global_score_and_structural_order(client, settings, account_factory):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00")
    transaction(client, "t2", "99999.00", "2026-09-02")
    expectation(client, SEPTEMBER, "500.00")
    body = review(client)
    forbidden = {"score", "life_score", "composite", "overall", "net", "winner", "total_score",
                 "confidence", "probability", "weight"}
    assert not forbidden & walk_keys(body)
    # No top-level number of any kind (a bool is not a measure).
    assert not any(isinstance(value, (int, float)) and not isinstance(value, bool)
                   for value in body.values())
    kinds = [item["kind"] for item in _items(body)]
    assert kinds == sorted(kinds)  # finance items only: fixed structural order by kind


def test_s7_28_contradictions_coexist_side_by_side(client, settings, account_factory):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00")
    target(client, SEPTEMBER, "5000.00", "lower")  # spend within target → favorable
    debt = obligation(client, planned_payoff_date="2026-12-01")
    expense_context(client, "t1", plannedness="unplanned", funding_source="credit",
                    obligation_entity_id=debt["entity_id"])
    pairs = _items(review(client), "tradeoffs")
    assert len(pairs) == 1
    pair = pairs[0]
    assert pair["a"]["desire"] == "favorable" and pair["b"]["desire"] == "unfavorable"
    assert pair["b"]["kind"] == "payoff_after_planned_date"
    assert pair["causality_checked"] is False
    assert not {"winner", "net", "resolution"} & walk_keys(pair)


def test_s7_25_repeated_uses_only_the_four_accepted_rules(
    client, settings, account_factory
):
    assert len(signal_rules()) == 4
    _owner(client, settings, account_factory)
    for period, day in (("2026-07", "2026-07-10"), ("2026-08", "2026-08-10"),
                        (SEPTEMBER, "2026-09-10")):
        transaction(client, f"t{period}", "1000.00", day)
        expectation(client, period, "1000.00")
    body = review(client)
    repeated = _items(body, "repeated")
    rules = {item["source"] for item in repeated if item["kind"] == "signal_rule"}
    assert "finance.monthly_spend.threshold" in rules
    assert rules <= {rule.RULE_ID for rule in signal_rules()}
    threshold = next(i for i in repeated if i["source"] == "finance.monthly_spend.threshold")
    assert [w["window"] for w in threshold["windows"]] == ["2026-07", "2026-08", "2026-09"]


def test_annual_review(client, settings, account_factory):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "100.00", "2026-02-10")
    transaction(client, "t2", "300.00", "2026-03-10")
    transaction(client, "t3", "180.00", "2026-09-10")
    expense_context(client, "t3", plannedness="unplanned", funding_source="credit")
    body = review(client, "2026")
    assert body["period_kind"] == "year" and body["window_end"] == "2026-12-31"
    months = {item["period"] for item in _items(body)
              if item["kind"] == "finance_spend_vs_prior"}
    assert {"2026-02", "2026-03", "2026-09"} <= months
    summary = body["sections"]["consequences"]["funding_summary"]
    assert summary == [{"plannedness": "unplanned", "funding_source": "credit", "count": 1,
                        "total": {"type": "money", "unit_code": "UAH", "num": "180.00"},
                        "currency": "UAH"}]
    assert body["sections"]["requires_confirmation"]["count"] == 0


# ───────────────────────────── waiting ─────────────────────────────


def test_s7_19_20_21_review_available_is_concrete(client, settings, account_factory):
    _owner(client, settings, account_factory)
    assert waiting(client)["review_available"] == {"count": 0, "items": []}
    transaction(client, "t-oct", "10.00", "2026-10-02")
    assert waiting(client)["review_available"]["count"] == 0  # current month never
    transaction(client, "t-sep", "10.00", "2026-09-02")
    transaction(client, "t-2025", "10.00", "2025-09-02")
    items = waiting(client)["review_available"]["items"]
    assert {"kind": "monthly_review", "period": "2026-09"} in items
    assert {"kind": "annual_review", "period": "2025"} in items
    assert {"kind": "monthly_review", "period": "2025-09"} not in items  # beyond 12 months
    assert not any(item.get("period") == "2026-08" for item in items)  # no evidence
    # Saving a draft does not complete it; finalizing does.
    ok(save(client), 201)
    assert {"kind": "monthly_review", "period": "2026-09"} in waiting(client)[
        "review_available"]["items"]
    ok(save(client, base=1, finalize=True), 201)
    assert {"kind": "monthly_review", "period": "2026-09"} not in waiting(client)[
        "review_available"]["items"]
    assert review(client)["status"] == "FINALIZED"


def test_s7_22_23_experiments_awaiting_review_count_and_nothing_invented(
    client, settings, account_factory, monkeypatch
):
    from app.services.experiments import days

    monkeypatch.setattr(days, "server_now", lambda: utc(2026, 10, 15, 9))
    _owner(client, settings, account_factory)
    awaiting = created(client, window_start="2026-09-01", window_end="2026-09-21",
                       hypothesis_recorded_at=utc(2026, 8, 30).isoformat())
    assert move(client, awaiting, "RUNNING", utc(2026, 9, 1, 6)).status_code == 200
    assert move(client, awaiting, "COMPLETED_AWAITING_REVIEW",
                utc(2026, 9, 23, 6)).status_code == 200
    running = created(client, window_start="2026-10-01", window_end="2026-10-31",
                      hypothesis_recorded_at=utc(2026, 9, 30).isoformat())
    assert move(client, running, "RUNNING", utc(2026, 10, 1, 6)).status_code == 200
    abandoned = created(client, window_start="2026-10-01", window_end="2026-10-21",
                        hypothesis_recorded_at=utc(2026, 9, 30).isoformat())
    assert move(client, abandoned, "ABANDONED", utc(2026, 10, 2, 6)).status_code == 200
    items = waiting(client)["review_available"]["items"]
    experiments = [item for item in items if item["kind"] == "experiment"]
    assert [item["experiment_id"] for item in experiments] == [awaiting]
    assert {item["kind"] for item in items} <= {"experiment", "monthly_review", "annual_review"}


def test_s7_24_requires_confirmation_counts_only_proposed(
    client, settings, account_factory
):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00")
    debt = obligation(client)
    expense_context(client, "t1", plannedness="unplanned", funding_source="credit",
                    obligation_entity_id=debt["entity_id"], emotional_context="стресс")
    first = waiting(client)["requires_confirmation"]
    assert first["count"] == 2 and first["horizon_months"] == 3
    ok(respond(client, first["items"][0], "unsure"), 201)
    second = waiting(client)["requires_confirmation"]
    assert second["count"] == 1
    ok(respond(client, second["items"][0], "rejected"), 201)
    assert waiting(client)["requires_confirmation"]["count"] == 0
    # Review available and requires confirmation are never merged.
    assert "review_available" in waiting(client)
    assert all(item["kind"] != "proposal" for item in waiting(client)["review_available"]["items"])


def test_no_diagnostic_or_moral_vocabulary_in_the_read_model(
    client, settings, account_factory
):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00")
    debt = obligation(client)
    expense_context(client, "t1", plannedness="unplanned", funding_source="credit",
                    obligation_entity_id=debt["entity_id"], worth_it="no")
    text = " ".join(walk_strings(review(client))).casefold() + " ".join(walk_keys(review(client)))
    for word in ("diagnos", "disorder", "sabotage", "addict", "irresponsible", "bad_purchase",
                 "good_purchase", "caused", "because"):
        assert word not in text, word
    assert key()
