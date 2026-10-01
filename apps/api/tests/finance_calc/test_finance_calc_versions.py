"""Effective-dated amendments: new versions never rewrite earlier results."""

import copy

from app.services.finance.calc import calculate, calculate_versions


def terms(rate: str) -> dict:
    return {
        "schema_version": 1,
        "model": "daily_accrual",
        "currency": "UAH",
        "interest": {
            "source_metric": "contractual_rate",
            "kind": "fixed",
            "value": rate,
            "unit": "percent",
            "per": "day",
        },
        "balance_basis": "outstanding_principal",
        "accrual": {"first_day": "day_after_opening", "payment_effect": "same_day"},
        "rounding": {"mode": "half_up", "step_minor": 1, "interest_stage": "daily"},
        "allocation": ["fees", "interest", "principal"],
        "payments": [],
    }


def original() -> dict:
    return {
        **terms("0.1"),
        "opening": {
            "date": "2026-01-01",
            "basis": "contractual_disbursement",
            "principal_minor": 1_000_000,
        },
    }


def amended(opening: dict, payments: list | None = None) -> dict:
    v2 = {**terms("0.05"), "opening": opening, "horizon": {"end_date": "2026-01-20"}}
    if payments:
        v2["payments"] = payments
    return {
        "schema_version": 1,
        "versions": [
            {"effective_from": "2026-01-01", "input": original()},
            {"effective_from": "2026-01-11", "input": v2},
        ],
    }


def test_projected_opening_carries_the_previous_closing() -> None:
    # v1: 2..10 Jan = 9 days x 1 000 = 9 000. v2 opens 10 Jan (projected): 11..20 Jan = 10 x 500 = 5 000.
    result = calculate_versions(amended({"basis": "projected_from_previous"}))
    assert result["status"] == "complete"
    first, second = result["segments"]
    assert first["closing"]["interest_due_minor"] == 9000
    assert first["horizon"] == {"end_date": "2026-01-10"}
    assert second["opening"] == {
        "date": "2026-01-10",
        "basis": "projected",
        "principal_minor": 1_000_000,
        "interest_due_minor": 9000,
        "fees_due_minor": 0,
        "total_minor": 1_009_000,
    }
    assert result["closing"]["interest_due_minor"] == 14000
    assert result["boundaries"][1]["opening_from_previous"] is True
    assert first["input_hash"] != second["input_hash"]


def test_observed_opening_is_used_as_stated() -> None:
    opening = {
        "date": "2026-01-10",
        "basis": "observed",
        "principal_minor": 990_000,
        "interest_due_minor": 0,
        "fees_due_minor": 0,
    }
    result = calculate_versions(amended(opening))
    assert result["segments"][1]["opening"]["basis"] == "observed"
    assert result["closing"]["interest_due_minor"] == 4950  # 10 days x 495


def test_boundary_day_events_belong_to_the_new_version() -> None:
    # 11 Jan payment 100 000: interest 9 000, principal 91 000 -> 909 000;
    # 11..20 Jan at 909 000 x 0.0005 = 454.5 -> 455 x 10 = 4 550.
    payment = [
        {"date": "2026-01-11", "amount_minor": 100_000, "kind": "regular", "basis": "planned"}
    ]
    result = calculate_versions(amended({"basis": "projected_from_previous"}, payment))
    assert result["status"] == "complete"
    assert result["closing"]["principal_minor"] == 909_000
    assert result["closing"]["interest_due_minor"] == 4550


def test_an_earlier_single_version_result_is_preserved() -> None:
    whole = {**original(), "horizon": {"end_date": "2026-01-20"}}
    before = calculate(whole)
    snapshot = copy.deepcopy(before)
    amendment = calculate_versions(amended({"basis": "projected_from_previous"}))
    assert before == snapshot == calculate(whole)
    assert before["closing"]["interest_due_minor"] == 19000  # unchanged history: 19 days x 1 000
    assert amendment["closing"]["interest_due_minor"] == 14000


def test_overlapping_versions_are_rejected() -> None:
    doc = amended({"basis": "projected_from_previous"})
    doc["versions"][1]["effective_from"] = "2026-01-01"
    result = calculate_versions(doc)
    assert result["status"] == "invalid"
    assert {"path": "versions[1].effective_from", "code": "ambiguous_version_overlap"} in result[
        "errors"
    ]


def test_events_outside_a_version_range_are_rejected() -> None:
    doc = amended({"basis": "projected_from_previous"})
    doc["versions"][0]["input"]["payments"] = [
        {"date": "2026-01-15", "amount_minor": 1, "kind": "regular", "basis": "planned"}
    ]
    result = calculate_versions(doc)
    assert result["status"] == "invalid"
    assert {
        "path": "versions[0].input.payments[0]",
        "code": "event_outside_version_range",
    } in result["errors"]


def test_later_version_cannot_accrue_its_opening_day_twice() -> None:
    doc = amended({"basis": "projected_from_previous"})
    doc["versions"][1]["input"]["accrual"]["first_day"] = "opening_day"
    result = calculate_versions(doc)
    assert result["status"] == "invalid"
    assert result["errors"][0]["code"] == "later_versions_accrue_from_day_after_opening"


def test_only_daily_accrual_amendments_are_supported() -> None:
    doc = amended({"basis": "projected_from_previous"})
    doc["versions"][0]["input"]["model"] = "amortizing"
    result = calculate_versions(doc)
    assert result["status"] == "unsupported"
    assert result["unsupported"][0]["code"] == "amendments_for_model"


def test_versions_input_is_not_modified() -> None:
    doc = amended({"basis": "projected_from_previous"})
    before = copy.deepcopy(doc)
    calculate_versions(doc)
    assert doc == before
