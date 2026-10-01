"""Lender-schedule reconciliation keeps both schedules and never picks a winner."""

import copy
import json
from pathlib import Path

from app.services.finance.calc import calculate, payments_from_lender_schedule, reconcile_schedule

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(name: str) -> dict:
    return copy.deepcopy(
        json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))["input"]
    )


def annuity_lender_schedule() -> dict:
    # Synthetic published schedule for lender F's loan: row 1 equal; row 2 differs by one
    # kopeck per component (the lender rounds interest down); row 3 publishes a larger final payment.
    return {
        "source": {"label": "synthetic lender F schedule", "document_version": None, "page": 2},
        "tolerance": {
            "per_component_minor": 1,
            "reason": "one rounding step: lender rounds interest down",
        },
        "rows": [
            {
                "due_date": "2026-02-15",
                "payment_minor": 102007,
                "principal_minor": 99007,
                "interest_minor": 3000,
                "balance_after_minor": 200993,
            },
            {
                "due_date": "2026-03-15",
                "payment_minor": 102007,
                "principal_minor": 99998,
                "interest_minor": 2009,
                "balance_after_minor": 100995,
            },
            {
                "due_date": "2026-04-15",
                "payment_minor": 102100,
                "principal_minor": 100995,
                "interest_minor": 1105,
                "balance_after_minor": 0,
            },
        ],
    }


def test_mismatch_is_reported_per_row_and_component_and_both_are_preserved() -> None:
    result = calculate(fixture("lender-f-annuity-monthly"))
    schedule = annuity_lender_schedule()
    result_before, schedule_before = copy.deepcopy(result), copy.deepcopy(schedule)
    report = reconcile_schedule(result, schedule)
    assert result == result_before and schedule == schedule_before
    assert report["status"] == "mismatch"
    assert report["authority"] == "none_selected"
    assert report["lender_rows"] == schedule["rows"]
    assert report["calculated_input_hash"] == result["input_hash"]
    assert report["tolerance"] == {
        "per_component_minor": 1,
        "basis": "one rounding step: lender rounds interest down",
    }
    assert [row["status"] for row in report["rows"]] == ["match", "within_tolerance", "mismatch"]
    row2 = report["rows"][1]["components"]
    assert row2["principal_minor"]["difference"] == -1
    assert row2["interest_minor"]["difference"] == 1
    assert row2["balance_after_minor"]["difference"] == 1
    row3 = report["rows"][2]["components"]
    assert row3["payment_minor"] == {
        "calculated": 102006,
        "lender": 102100,
        "difference": -94,
        "within_tolerance": False,
    }
    assert row3["interest_minor"]["difference"] == -95
    assert row3["principal_minor"]["within_tolerance"] is True
    assert report["totals"]["payment_minor"] == {
        "calculated": 306020,
        "lender": 306114,
        "difference": -94,
        "max_explained_by_tolerance": 3,
    }
    assert report["totals"]["principal_minor"]["difference"] == 0


def test_identical_schedule_matches_exactly_without_tolerance() -> None:
    result = calculate(fixture("lender-f-annuity-monthly"))
    rows = [
        {
            "due_date": row["date"],
            "payment_minor": row["payment_minor"],
            "principal_minor": row["principal_minor"],
            "interest_minor": row["interest_minor"],
            "balance_after_minor": row["closing_principal_minor"],
        }
        for row in result["rows"]
        if row["kind"] == "installment"
    ]
    report = reconcile_schedule(result, {"source": {"label": "synthetic"}, "rows": rows})
    assert report["status"] == "match"
    assert report["tolerance"]["basis"] == "exact comparison (no tolerance supplied)"


def daily_lender_schedule() -> dict:
    return {
        "source": {"label": "synthetic daily-rate lender"},
        "rows": [
            {
                "due_date": "2026-01-31",
                "payment_minor": 530000,
                "principal_minor": 500000,
                "interest_minor": 30000,
                "balance_after_minor": 500000,
            },
            {
                "due_date": "2026-02-28",
                "payment_minor": 514000,
                "principal_minor": 500000,
                "interest_minor": 14000,
                "balance_after_minor": 0,
            },
        ],
    }


def daily_loan(effect: str) -> dict:
    return {
        "schema_version": 1,
        "model": "daily_accrual",
        "currency": "UAH",
        "opening": {
            "date": "2026-01-01",
            "basis": "contractual_disbursement",
            "principal_minor": 1_000_000,
        },
        "horizon": {"end_date": "2026-02-28"},
        "interest": {
            "source_metric": "contractual_rate",
            "kind": "fixed",
            "value": "0.1",
            "unit": "percent",
            "per": "day",
        },
        "balance_basis": "outstanding_principal",
        "accrual": {"first_day": "day_after_opening", "payment_effect": effect},
        "rounding": {"mode": "half_up", "step_minor": 1, "interest_stage": "daily"},
        "allocation": ["fees", "interest", "principal"],
        "payments": payments_from_lender_schedule(daily_lender_schedule(), basis="planned"),
    }


def test_daily_loan_reconciles_only_under_the_matching_payment_day_rule() -> None:
    # next_day: 2 Jan..31 Jan = 30 days x 1 000 = 30 000; then 1..28 Feb = 28 x 500 = 14 000.
    report = reconcile_schedule(calculate(daily_loan("next_day")), daily_lender_schedule())
    assert report["status"] == "match"
    # same_day: 2..30 Jan = 29 000; principal 501 000 -> 499 000; 31 Jan..27 Feb = 28 x 499 = 13 972.
    result = calculate(daily_loan("same_day"))
    report = reconcile_schedule(result, daily_lender_schedule())
    assert report["status"] == "mismatch"
    first, second = (row["components"] for row in report["rows"])
    assert first["interest_minor"]["difference"] == -1000
    assert first["principal_minor"]["difference"] == 1000
    assert first["balance_after_minor"]["difference"] == -1000
    assert second["interest_minor"]["difference"] == -28
    assert second["principal_minor"]["difference"] == -1000
    assert result["totals"]["overpayment_minor"] == 1028


def test_payments_from_lender_schedule_does_not_modify_the_schedule() -> None:
    schedule = daily_lender_schedule()
    before = copy.deepcopy(schedule)
    payments = payments_from_lender_schedule(schedule, basis="actual")
    assert schedule == before
    assert payments[0] == {
        "date": "2026-01-31",
        "amount_minor": 530000,
        "kind": "regular",
        "basis": "actual",
    }


def test_unmatched_and_invalid_lender_rows() -> None:
    result = calculate(fixture("lender-f-annuity-monthly"))
    schedule = annuity_lender_schedule()
    schedule["rows"][2]["due_date"] = "2026-04-16"
    report = reconcile_schedule(result, schedule)
    assert report["status"] == "mismatch"
    assert report["unmatched_lender_rows"] == [
        {"lender_row": 2, "due_date": "2026-04-16", "reason": "no_calculated_row"}
    ]
    assert report["unmatched_calculated_rows"][0]["due_date"] == "2026-04-15"

    schedule = annuity_lender_schedule()
    schedule["rows"][1]["due_date"] = "2026-02-15"
    schedule["rows"][0]["interest_minor"] = 3000.0
    report = reconcile_schedule(result, schedule)
    assert report["status"] == "not_comparable"
    codes = {(error["path"], error["code"]) for error in report["errors"]}
    assert ("rows[1].due_date", "duplicate_due_date") in codes
    assert ("rows[0].interest_minor", "integer_minor_units_expected") in codes


def test_an_unsupported_calculation_is_not_comparable() -> None:
    doc = fixture("lender-f-annuity-monthly")
    del doc["rounding"]
    report = reconcile_schedule(calculate(doc), annuity_lender_schedule())
    assert report["status"] == "not_comparable"
    assert report["reason"] == "calculation_unsupported"
