"""Missing, unsupported and invalid inputs are reported exactly — never defaulted or guessed."""

import copy
import json
from decimal import Decimal
from pathlib import Path

import pytest

from app.services.finance.calc import calculate

FIXTURES = Path(__file__).parent / "fixtures"


def base(name: str) -> dict:
    return copy.deepcopy(
        json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))["input"]
    )


DAILY = "lender-a-daily-same-day-partial"
ANNUITY = "lender-f-annuity-monthly"
CARD = "lender-k-revolving-grace-lost-retroactive"


def _codes(result: dict) -> set[tuple[str, str]]:
    return {(entry["path"], entry["code"]) for entry in result["unsupported"]}


def test_missing_contractual_rules_are_named_and_nothing_is_computed() -> None:
    doc = base(DAILY)
    del doc["rounding"]
    del doc["allocation"]
    del doc["accrual"]["payment_effect"]
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert set(result["missing_inputs"]) == {"rounding", "allocation", "accrual.payment_effect"}
    assert result["rows"] == [] and result["totals"] is None and result["closing"] is None


def test_annual_rate_without_day_count_is_missing_not_assumed() -> None:
    doc = base(DAILY)
    doc["interest"] = {
        "source_metric": "contractual_rate",
        "kind": "fixed",
        "value": "36.5",
        "unit": "percent",
        "per": "year",
    }
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert result["missing_inputs"] == ["interest.day_count"]


def test_unknown_day_count_is_named() -> None:
    doc = base(DAILY)
    doc["interest"] = {
        "source_metric": "contractual_rate",
        "kind": "fixed",
        "value": "36",
        "unit": "percent",
        "per": "year",
        "day_count": "30_360",
    }
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("interest.day_count", "day_count_30_360") in _codes(result)


@pytest.mark.parametrize("metric", ["apr", "real_annual_cost", "daily_total_cost"])
def test_disclosed_cost_metrics_are_refused_as_accrual_inputs(metric: str) -> None:
    doc = base(DAILY)
    doc["interest"]["source_metric"] = metric
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("interest.source_metric", "disclosed_metric_not_accrual_input") in _codes(result)


def test_variable_rate_is_unsupported_by_name() -> None:
    doc = base(DAILY)
    doc["interest"]["kind"] = "variable"
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("interest.kind", "variable_rate") in _codes(result)


def test_unknown_fee_is_excluded_named_and_the_total_is_not_complete() -> None:
    doc = base(DAILY)
    doc["fees"] = [{"id": "insurance", "kind": "insurance_bundle", "amount_minor": 1000}]
    result = calculate(doc)
    assert result["status"] == "partial"
    assert ("fees[0].kind", "unsupported_fee_kind") in _codes(result)
    assert result["totals"]["complete"] is False
    assert "fees[0].kind" in result["totals"]["excludes"]
    # The independent part is still calculated (same as the complete fixture).
    assert result["closing"]["principal_minor"] == 734936


def test_unknown_field_is_never_silently_ignored() -> None:
    doc = base(DAILY)
    doc["capitalisation"] = {"monthly": True}
    result = calculate(doc)
    assert result["status"] == "partial"
    assert ("capitalisation", "unknown_field") in _codes(result)


def test_capitalising_balance_basis_is_unsupported() -> None:
    doc = base(DAILY)
    doc["balance_basis"] = "principal_plus_unpaid_interest"
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("balance_basis", "interest_capitalisation") in _codes(result)


def test_early_payment_needs_explicit_early_repayment_terms() -> None:
    doc = base(DAILY)
    doc["payments"].append({"date": "2026-01-08", "kind": "early_full", "basis": "planned"})
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert "early_repayment" in result["missing_inputs"]


def test_early_payment_forbidden_by_terms_is_invalid() -> None:
    doc = base(DAILY)
    doc["payments"].append({"date": "2026-01-08", "kind": "early_full", "basis": "planned"})
    doc["early_repayment"] = {"allowed": False, "fee": {"kind": "none"}}
    result = calculate(doc)
    assert result["status"] == "invalid"
    assert {
        "path": "early_repayment.allowed",
        "code": "early_repayment_not_allowed_by_terms",
    } in result["errors"]


def test_percent_early_repayment_fee_is_unsupported() -> None:
    doc = base(DAILY)
    doc["payments"].append(
        {"date": "2026-01-08", "amount_minor": 1000, "kind": "early_partial", "basis": "planned"}
    )
    doc["early_repayment"] = {"allowed": True, "fee": {"kind": "percent_of_prepaid"}}
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("early_repayment.fee.kind", "early_repayment_fee_percent") in _codes(result)


def test_observed_opening_must_state_every_balance() -> None:
    doc = base(DAILY)
    doc["opening"]["basis"] = "observed"
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert set(result["missing_inputs"]) == {"opening.interest_due_minor", "opening.fees_due_minor"}


def test_penalties_are_recorded_never_applied() -> None:
    doc = base(DAILY)
    doc["penalties"] = [{"id": "late_payment_penalty"}]
    result = calculate(doc)
    assert result["status"] == "complete"
    assert result["not_applied"] == [
        {"path": "penalties[0]", "code": "penalty_not_applied", "value": "late_payment_penalty"}
    ]
    assert "assumes_no_penalty_events" in result["limitations"]
    assert result["closing"] == calculate(base(DAILY))["closing"]


@pytest.mark.parametrize(
    ("mutate", "path", "code"),
    [
        (
            lambda d: d["opening"].__setitem__("principal_minor", 1234567.0),
            "opening.principal_minor",
            "float_not_allowed",
        ),
        (lambda d: d["interest"].__setitem__("value", 0.01), "interest.value", "float_not_allowed"),
        (
            lambda d: d["interest"].__setitem__("value", Decimal("0.01")),
            "interest.value",
            "decimal_must_be_text",
        ),
    ],
)
def test_binary_floats_and_decimal_objects_are_rejected(mutate, path: str, code: str) -> None:
    doc = base(DAILY)
    mutate(doc)
    result = calculate(doc)
    assert result["status"] == "invalid"
    assert result["errors"] == [{"path": path, "code": code}]
    assert result["input_hash"] is None


@pytest.mark.parametrize("value", ["1e-4", "-0.01", " 0.01", "0,01", "abc"])
def test_rate_text_must_be_plain_decimal(value: str) -> None:
    doc = base(DAILY)
    doc["interest"]["value"] = value
    result = calculate(doc)
    assert result["status"] == "invalid"
    assert {"path": "interest.value", "code": "decimal_text_expected"} in result["errors"]


def test_unsupported_schema_version() -> None:
    doc = base(DAILY)
    doc["schema_version"] = 2
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("schema_version", "unsupported_schema_version") in _codes(result)


def test_payment_before_opening_is_invalid_and_after_horizon_is_not_applied() -> None:
    doc = base(DAILY)
    doc["payments"].append(
        {"date": "2025-12-31", "amount_minor": 1, "kind": "regular", "basis": "actual"}
    )
    assert calculate(doc)["status"] == "invalid"
    doc = base(DAILY)
    doc["payments"].append(
        {"date": "2026-02-01", "amount_minor": 1, "kind": "regular", "basis": "planned"}
    )
    result = calculate(doc)
    assert result["status"] == "complete"
    assert result["not_applied"] == [
        {"path": "payments[1]", "code": "after_horizon", "value": "2026-02-01"}
    ]


# ── amortizing ──


def test_annuity_label_does_not_turn_a_daily_rate_into_a_monthly_formula() -> None:
    doc = base(ANNUITY)
    doc["interest"] = {
        "source_metric": "contractual_rate",
        "kind": "fixed",
        "value": "0.05",
        "unit": "percent",
        "per": "day",
    }
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("interest.per", "daily_rate_requires_daily_accrual_model") in _codes(result)


def test_irregular_first_period_is_unsupported_not_approximated() -> None:
    doc = base(ANNUITY)
    doc["opening"]["date"] = "2026-01-20"
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("term.first_payment_date", "irregular_first_period") in _codes(result)


def test_annual_rate_in_period_model_needs_its_period_rule() -> None:
    doc = base(ANNUITY)
    del doc["interest"]["period_rate_rule"]
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert result["missing_inputs"] == ["interest.period_rate_rule"]


def test_prepayment_between_due_dates_is_unsupported() -> None:
    doc = base(ANNUITY)
    doc["prepayments"] = [
        {"date": "2026-02-20", "amount_minor": 1000, "kind": "early_partial", "basis": "planned"}
    ]
    doc["early_repayment"] = {
        "allowed": True,
        "fee": {"kind": "none"},
        "recalculation": "reduce_term",
    }
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("prepayments[0].date", "prepayment_between_due_dates") in _codes(result)


def test_prepayment_without_recalculation_rule_is_missing() -> None:
    doc = base(ANNUITY)
    doc["prepayments"] = [
        {"date": "2026-02-15", "amount_minor": 1000, "kind": "early_partial", "basis": "planned"}
    ]
    doc["early_repayment"] = {"allowed": True, "fee": {"kind": "none"}}
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert "early_repayment.recalculation" in result["missing_inputs"]


def test_fee_on_a_non_due_date_is_excluded_in_period_model() -> None:
    doc = base(ANNUITY)
    doc["fees"] = [{"id": "service", "kind": "one_off", "date": "2026-02-01", "amount_minor": 500}]
    result = calculate(doc)
    assert result["status"] == "partial"
    assert ("fees[0]", "fee_date_not_a_due_date") in _codes(result)


# ── revolving ──


def test_revolving_without_minimum_rule_is_partial_with_unknown_minimum() -> None:
    doc = base(CARD)
    del doc["minimum_payment"]
    result = calculate(doc)
    assert result["status"] == "partial"
    assert result["missing_inputs"] == ["minimum_payment"]
    statements = [row for row in result["rows"] if row["kind"] == "statement"]
    assert all(row["minimum_due_minor"] is None for row in statements)
    # The rest of the forecast does not depend on the minimum and is still returned.
    assert result["closing"]["total_minor"] == 54150


@pytest.mark.parametrize("section", ["grace", "cycles", "interest_bearing", "allocation"])
def test_revolving_forecast_needs_its_stated_rules(section: str) -> None:
    doc = base(CARD)
    del doc[section]
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert section in result["missing_inputs"]


def test_revolving_opening_purchases_in_grace_are_unsupported() -> None:
    doc = base(CARD)
    doc["opening"]["purchases_minor"] = 1000
    doc["opening"]["purchases_in_grace"] = True
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("opening.purchases_in_grace", "opening_purchases_in_grace") in _codes(result)


def test_revolving_due_date_must_precede_next_statement() -> None:
    doc = base(CARD)
    doc["cycles"][0]["due_date"] = "2026-03-31"
    result = calculate(doc)
    assert result["status"] == "invalid"
    assert {"path": "cycles[0].due_date", "code": "due_date_not_before_next_statement"} in result[
        "errors"
    ]


def test_unknown_transaction_kind_blocks_the_forecast() -> None:
    doc = base(CARD)
    doc["transactions"].append(
        {"date": "2026-02-12", "amount_minor": 100, "kind": "balance_transfer"}
    )
    result = calculate(doc)
    assert result["status"] == "unsupported"
    assert ("transactions[1].kind", "unsupported_value") in _codes(result)
