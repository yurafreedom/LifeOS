"""Slice 7 · consequence intelligence and the self-check (S7-30…34, §37 scenario)."""

from datetime import date
from decimal import Decimal

import pytest

from app.services.system_review.consequences import _projection, simulate_payoff
from app.services.system_review.selfcheck import evaluate_self_check
from tests.aa_helpers import authenticate
from tests.aa_system_review_helpers import (
    BASE,
    SEPTEMBER,
    context,
    expense_context,
    key,
    obligation,
    observation,
    ok,
    review,
    sr_clock,  # noqa: F401  (fixture, applied module-wide)
    target,
    transaction,
    walk_strings,
)

pytestmark = pytest.mark.usefixtures("sr_clock")


def _owner(client, settings, account_factory, email="consequences@example.com"):
    owner = account_factory(email)
    authenticate(client, settings, owner)
    return owner


def _analysis(body, transaction_id="t1"):
    return next(a for a in body["sections"]["consequences"]["expenses"]
                if a["transaction_id"] == transaction_id)


def _impact(analysis, kind):
    return next(i for i in analysis["impacts"] if i["kind"] == kind)


def test_payoff_simulation_is_explicit_arithmetic():
    as_of = date(2026, 9, 1)
    a = _projection(as_of, simulate_payoff(Decimal("20000"), Decimal("2000"), Decimal("24"),
                                           Decimal("0")))
    assert (a["months"], a["payoff_date"], a["total_interest"]) == (12, "2027-08-09", "2540.66")
    assert simulate_payoff(Decimal("20000"), Decimal("400"), Decimal("24"), Decimal("0"))[
        "state"] == "does_not_decrease"
    assert simulate_payoff(Decimal("20000"), Decimal("2000"), Decimal("0"), Decimal("0"))[
        "months"] == 10
    assert simulate_payoff(Decimal("0"), Decimal("1"), Decimal("0"), Decimal("0"))[
        "months"] == 0


def test_s37_unplanned_credit_expense_full_picture(client, settings, account_factory):
    """The owner's acceptance scenario, with every input stated explicitly."""
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00", "2026-09-10", category="entertainment")
    transaction(client, "t2", "4000.00", "2026-09-03")
    target(client, SEPTEMBER, "4000.00", "lower")
    debt = obligation(client, planned_payoff_date="2027-09-30")
    context(client, "reserve", {"label": "Подушка", "currency": "UAH", "amount": "30000.00",
                                "threshold": "10000.00", "as_of": "2026-09-01"})
    context(client, "essentials", {"currency": "UAH", "monthly_amount": "15000.00",
                                   "as_of": "2026-09-01"})
    expense_context(client, "t1", plannedness="unplanned", funding_source="credit",
                    obligation_entity_id=debt["entity_id"], purpose="Концерт",
                    motive="хотелось отвлечься", emotional_context="напряжённая неделя",
                    worth_it="unsure", expected_recurrence="recurring",
                    recurrence_per_month="2")
    observation(client, "плохо спал", "2026-09-09")
    body = review(client)
    analysis = _analysis(body)
    assert analysis["expense"] == {"amount": {"type": "money", "unit_code": "UAH",
                                              "num": "180.00"},
                                   "date": "2026-09-10", "category_id": "entertainment"}
    assert analysis["context"]["purpose"] == "Концерт"
    assert analysis["context"]["emotional_context"] == "напряжённая неделя"

    budget = _impact(analysis, "budget_deviation")
    assert budget["state"] == "computed"
    assert budget["result"]["over_target"]["num"] == "180.00"

    repeat = _impact(analysis, "repeat_scenario")
    assert repeat["state"] == "computed"
    assert repeat["result"]["monthly"]["num"] == "360.00"
    assert repeat["result"]["twelve_months"]["num"] == "4320.00"

    debt_projection = _impact(analysis, "debt_projection")
    assert debt_projection["state"] == "computed"
    result = debt_projection["result"]
    assert result["a_as_entered"]["payoff_date"] == "2027-08-09"
    assert result["b_with_this_expense"]["payoff_date"] == "2027-08-13"
    assert result["c_if_repeated"]["payoff_date"] == "2027-11-13"
    assert (result["delta_days_b"], result["delta_days_c"]) == (4, 96)
    assert set(debt_projection["assumptions"]) == {
        "fixed_monthly_payment", "fixed_annual_rate", "no_other_new_borrowing"}
    assert {entry["name"] for entry in debt_projection["inputs"]} >= {
        "outstanding", "monthly_payment", "annual_rate_percent", "as_of", "expense_amount"}
    assert debt_projection["calculation"]["formula"].startswith("B(k+1)")

    # Credit funding does not touch the reserve: that projection is not applicable.
    assert _impact(analysis, "reserve_projection")["state"] == "not_applicable"
    assert analysis["priority"]["kind"] == "payoff_after_planned_date"
    flags = {flag["flag"]: flag for flag in analysis["attention"]}
    assert set(flags) == {"unplanned_credit_funded", "debt_payoff_moves_later",
                          "payoff_after_planned_date"}
    assert flags["unplanned_credit_funded"]["conditions"] == [
        {"field": "plannedness", "value": "unplanned"},
        {"field": "funding_source", "value": "credit"}]

    pending = {i["family"]: i for i in body["sections"]["requires_confirmation"]["items"]}
    emotional = pending["finance_emotional_context"]
    assert (emotional["relation_type"], emotional["epistemic_kind"]) == (
        "may_contribute_to", "hypothesis")
    assert pending["observation_temporal"]["epistemic_kind"] == "association"
    self_check = body["sections"]["consequences"]["self_check"]
    assert self_check["offered"] is True and self_check["highlighted"] is True
    assert self_check["result"] is None


def test_s7_30_31_projections_show_assumptions_or_refuse(client, settings, account_factory):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00")
    debt = obligation(client, annual_rate_percent=None)
    expense_context(client, "t1", plannedness="unplanned", funding_source="credit",
                    obligation_entity_id=debt["entity_id"])
    analysis = _analysis(review(client))
    projection = _impact(analysis, "debt_projection")
    assert projection["state"] == "needs_input"
    assert projection["missing_inputs"] == ["annual_rate_percent"]
    assert projection["result"] is None
    repeat = _impact(analysis, "repeat_scenario")
    assert repeat["state"] == "needs_input" and repeat["missing_inputs"] == [
        "expected_recurrence"]
    # No obligation named for a credit expense: we never guess which one it was.
    transaction(client, "t2", "90.00", "2026-09-12")
    expense_context(client, "t2", plannedness="unplanned", funding_source="credit")
    assert _impact(_analysis(review(client), "t2"), "debt_projection")["missing_inputs"] == [
        "obligation"]
    transaction(client, "t3", "90.00", "2026-09-13")
    expense_context(client, "t3", funding_source="mixed")
    assert _impact(_analysis(review(client), "t3"), "debt_projection")["missing_inputs"] == [
        "credit_portion"]


def test_reserve_and_essentials_projection(client, settings, account_factory):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "1000.00", "2026-09-10")
    context(client, "reserve", {"currency": "UAH", "amount": "10000.00",
                                "as_of": "2026-09-01"})
    context(client, "essentials", {"currency": "UAH", "monthly_amount": "4000.00",
                                   "as_of": "2026-09-01"})
    expense_context(client, "t1", plannedness="unplanned", funding_source="cash_balance",
                    expected_recurrence="occasional", recurrence_per_month="1")
    analysis = _analysis(review(client))
    reserve = _impact(analysis, "reserve_projection")
    assert reserve["state"] == "computed"
    assert reserve["result"]["after_this_expense"]["num"] == "9000.00"
    assert reserve["result"]["months_until_threshold"] == 9
    assert "threshold_not_set_calculated_to_zero" in reserve["assumptions"]
    assert "income_not_modeled" in reserve["limitations"]
    essentials = _impact(analysis, "essentials_risk")
    assert essentials["result"]["coverage_months_now"] == "2.5"
    assert essentials["result"]["coverage_months_after"] == "2.2"
    assert {f["flag"] for f in analysis["attention"]} == {
        "reserve_reaches_threshold_within_12_months"}


def test_currency_is_never_converted(client, settings, account_factory):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00")
    debt = obligation(client, currency="USD")
    expense_context(client, "t1", funding_source="credit",
                    obligation_entity_id=debt["entity_id"])
    projection = _impact(_analysis(review(client)), "debt_projection")
    assert projection["state"] == "not_applicable"
    assert projection["limitations"] == ["currency_mismatch"]


def test_s7_32_context_is_stored_only_from_explicit_input(
    client, settings, account_factory
):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00")
    body = review(client)
    # A transaction alone produces no expense analysis and no inferred context.
    assert body["sections"]["consequences"]["expenses"] == []
    assert ok(client.get(f"{BASE}/finance-contexts"), 200)["contexts"] == []
    stored = expense_context(client, "t1")
    assert stored["payload"] == {"plannedness": "unknown", "funding_source": "unknown",
                                 "expected_recurrence": "unknown"}
    bad = client.post(f"{BASE}/finance-contexts", json={
        "entity_id": stored["entity_id"], "kind": "expense_context",
        "subject_key": "finance:transaction:t1",
        "payload": {"plannedness": "impulsive"}, "idempotency_key": key()})
    assert bad.status_code == 422 and bad.json()["code"] == "invalid_finance_context"
    frequency_without_recurrence = client.post(f"{BASE}/finance-contexts", json={
        "entity_id": stored["entity_id"], "kind": "expense_context",
        "subject_key": "finance:transaction:t1",
        "payload": {"recurrence_per_month": "2"}, "idempotency_key": key()})
    assert frequency_without_recurrence.status_code == 422
    second = client.post(f"{BASE}/finance-contexts", json={
        "entity_id": "11111111-1111-4111-8111-111111111111", "kind": "expense_context",
        "subject_key": "finance:transaction:t1", "payload": {}, "idempotency_key": key()})
    assert second.status_code == 409 and second.json()["code"] == "finance_context_conflict"
    revised = ok(client.post(f"{BASE}/finance-contexts", json={
        "entity_id": stored["entity_id"], "kind": "expense_context",
        "subject_key": "finance:transaction:t1",
        "payload": {"plannedness": "planned"}, "idempotency_key": key()}), 201)
    assert revised["version"] == 2


def test_s7_33_34_self_check_is_transparent_and_not_clinical(
    client, settings, account_factory
):
    result = evaluate_self_check({"q_know_total": "no", "q_payments_delayed": "unknown",
                                  "q_avoid_checking": "prefer_not"})
    assert result["flag"] is None and result["not_clinical"] is True
    result = evaluate_self_check({"q_know_total": "no", "q_repayment_plan": "no",
                                  "q_pattern_repeat": "no"})
    assert result["flag"] == "repayment_friction_pattern_worth_reviewing"
    assert result["triggered_by"] == [{"question": "q_know_total", "answer": "no"},
                                      {"question": "q_repayment_plan", "answer": "no"}]
    assert result["rule"]["threshold"] == 2 and len(result["rule"]["indicators"]) == 7

    _owner(client, settings, account_factory)
    obligation(client)
    context(client, "self_check", {"answers": {"q_new_spend_on_credit": "yes",
                                               "q_avoid_checking": "yes"}},
            subject_key="finance:period:2026-09")
    body = review(client)
    saved = body["sections"]["consequences"]["self_check"]["result"]
    assert saved["flag"] == "repayment_friction_pattern_worth_reviewing"
    assert saved["questionnaire"] == "lifeos_debt_selfcheck_v1"
    unknown = client.post(f"{BASE}/finance-contexts", json={
        "entity_id": "22222222-2222-4222-8222-222222222222", "kind": "self_check",
        "subject_key": "finance:period:2026-08", "payload": {"answers": {"q_mood": "yes"}},
        "idempotency_key": key()})
    assert unknown.status_code == 422
    text = " ".join(walk_strings(body)).casefold()
    for word in ("diagnos", "disorder", "sabotage", "addict", "clinical_test"):
        assert word not in text
