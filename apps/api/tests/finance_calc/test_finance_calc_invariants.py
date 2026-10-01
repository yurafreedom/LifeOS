"""Invariants over many seeded synthetic inputs (no expected values come from the engine).

Checked: the accounting identity of every result, non-negative balances,
explicit overpayment, determinism, input immutability, canonical hashing,
bounded horizons and reproducible same-day ordering.
"""

import ast
import copy
import json
import random
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

import pytest

from app.services.finance.calc import ENGINE_VERSION, calculate, input_hash
from app.services.finance.calc.contracts import MAX_HORIZON_DAYS
from app.services.finance.calc.numbers import anchor_date, monthly_date, round_minor

FIXTURES = Path(__file__).parent / "fixtures"
SOURCE = Path(__file__).parents[2] / "app" / "services" / "finance" / "calc"


def fixture(name: str) -> dict:
    return copy.deepcopy(
        json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))["input"]
    )


def random_daily(seed: int) -> dict:
    rng = random.Random(seed)
    start = date(2025, 1, 1) + timedelta(days=rng.randrange(0, 1500))
    end = start + timedelta(days=rng.randrange(1, 400))
    span = (end - start).days
    payments = []
    for _ in range(rng.randrange(0, 12)):
        day = start + timedelta(days=rng.randrange(0, span + 1))
        kind = rng.choice(["regular", "regular", "regular", "early_partial", "early_full"])
        payment = {
            "date": day.isoformat(),
            "kind": kind,
            "basis": rng.choice(["actual", "planned"]),
        }
        if kind != "early_full":
            payment["amount_minor"] = rng.randrange(1, 600_000)
        payments.append(payment)
    fees = []
    if rng.random() < 0.7:
        fees.append(
            {
                "id": "one",
                "kind": "one_off",
                "date": start.isoformat(),
                "amount_minor": rng.randrange(1, 5000),
            }
        )
    if rng.random() < 0.7:
        anchor = rng.randrange(1, 32)
        first = date(start.year, start.month, 1) + timedelta(days=40)
        first = first.replace(day=min(anchor, 28)) if anchor <= 28 else first.replace(day=28)
        fees.append(
            {
                "id": "monthly",
                "kind": rng.choice(["periodic_fixed", "periodic_percent"]),
                "schedule": {
                    "first_date": first.isoformat(),
                    "every_months": rng.randrange(1, 4),
                    "anchor_day": first.day,
                    "until": rng.choice(["loan_closure", end.isoformat()]),
                },
            }
        )
        if fees[-1]["kind"] == "periodic_fixed":
            fees[-1]["amount_minor"] = rng.randrange(1, 3000)
        else:
            fees[-1]["rate"] = {"value": rng.choice(["0.5", "1.25", "2"]), "unit": "percent"}
            fees[-1]["base"] = rng.choice(["opening_principal", "outstanding_principal"])
    per = rng.choice(["day", "year"])
    interest = {
        "source_metric": "contractual_rate",
        "kind": "fixed",
        "unit": "percent",
        "per": per,
        "value": rng.choice(["0", "0.01", "0.05", "0.5", "1.3"])
        if per == "day"
        else rng.choice(["0", "9.99", "36.5", "48"]),
    }
    if per == "year":
        interest["day_count"] = rng.choice(["ACT_365_FIXED", "ACT_360", "ACT_ACT_ISDA"])
    allocation = ["fees", "interest", "principal"]
    rng.shuffle(allocation)
    return {
        "schema_version": 1,
        "model": "daily_accrual",
        "currency": "UAH",
        "opening": {
            "date": start.isoformat(),
            "basis": "contractual_disbursement",
            "principal_minor": rng.randrange(1, 5_000_000),
        },
        "horizon": {"end_date": end.isoformat()},
        "interest": interest,
        "balance_basis": "outstanding_principal",
        "accrual": {
            "first_day": rng.choice(["opening_day", "day_after_opening"]),
            "payment_effect": rng.choice(["same_day", "next_day"]),
        },
        "rounding": {
            "mode": rng.choice(["half_up", "half_even", "down", "up"]),
            "step_minor": rng.choice([1, 1, 1, 10, 100]),
            "interest_stage": rng.choice(["daily", "at_posting"]),
        },
        "fees": fees,
        "allocation": allocation,
        "payments": payments,
        "early_repayment": {
            "allowed": True,
            "fee": rng.choice([{"kind": "none"}, {"kind": "fixed", "amount_minor": 777}]),
        },
    }


SEEDS = range(200)


@pytest.mark.parametrize("seed", SEEDS)
def test_daily_accounting_identity_and_balances(seed: int) -> None:
    doc = random_daily(seed)
    before = copy.deepcopy(doc)
    result = calculate(doc)
    assert doc == before
    assert result["status"] == "complete", (result["errors"], result["unsupported"])
    totals, opening, closing = result["totals"], result["opening"], result["closing"]
    applied = totals["payments_minor"] - totals["overpayment_minor"]
    assert sum(totals["allocated_minor"].values()) == applied
    assert closing["total_minor"] == (
        opening["total_minor"]
        + totals["interest_charged_minor"]
        + totals["fees_assessed_minor"]
        - applied
    )
    for row in result["rows"]:
        balances = row.get("balances_after")
        if balances:
            assert min(balances.values()) >= 0, row
        if row["kind"] == "payment":
            assert row["overpayment_minor"] >= 0
            assert (
                sum(row["allocated_minor"].values()) + row["overpayment_minor"]
                == row["amount_minor"]
            )
            if row["overpayment_minor"]:
                assert row["balances_after"] == {
                    "principal_minor": 0,
                    "interest_due_minor": 0,
                    "fees_due_minor": 0,
                }


@pytest.mark.parametrize("seed", range(0, 200, 10))
def test_results_are_deterministic_and_hash_is_canonical(seed: int) -> None:
    doc = random_daily(seed)
    first = calculate(doc)
    second = calculate(copy.deepcopy(doc))
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)
    reordered = json.loads(json.dumps(doc, sort_keys=True))
    reordered = dict(reversed(list(reordered.items())))
    assert input_hash(reordered) == first["input_hash"]
    assert first["engine_version"] == ENGINE_VERSION


def test_changing_any_input_creates_a_new_result() -> None:
    doc = fixture("lender-a-daily-same-day-partial")
    original = calculate(doc)
    snapshot = copy.deepcopy(original)
    changed = copy.deepcopy(doc)
    changed["interest"]["value"] = "0.02"
    other = calculate(changed)
    assert other["input_hash"] != original["input_hash"]
    assert other["closing"] != original["closing"]
    assert original == snapshot, "an earlier result is never mutated by a later calculation"


@pytest.mark.parametrize("seed", range(40))
def test_amortizing_schedules_reconcile(seed: int) -> None:
    rng = random.Random(seed)
    anchor = rng.randrange(1, 32)
    year, month = 2026 + rng.randrange(0, 3), rng.randrange(1, 13)
    opening = anchor_date(year, month, anchor)
    periods = rng.randrange(1, 61)
    doc = {
        "schema_version": 1,
        "model": "amortizing",
        "currency": "UAH",
        "opening": {
            "date": opening.isoformat(),
            "basis": "contractual_disbursement",
            "principal_minor": rng.randrange(periods, 10_000_000),
        },
        "horizon": {"end_date": "2040-12-31"},
        "interest": {
            "source_metric": "contractual_rate",
            "kind": "fixed",
            "value": rng.choice(["0", "7.5", "12", "29.99"]),
            "unit": "percent",
            "per": "year",
            "period_rate_rule": "annual_div_12",
        },
        "method": rng.choice(["annuity", "equal_principal"]),
        "term": {
            "periods": periods,
            "frequency": "monthly",
            "anchor_day": anchor,
            "first_payment_date": monthly_date(opening, anchor, 1).isoformat(),
        },
        "rounding": {"mode": rng.choice(["half_up", "half_even", "down", "up"]), "step_minor": 1},
        "final_adjustment": "last_payment_settles_balance",
    }
    result = calculate(doc)
    assert result["status"] == "complete", (result["errors"], result["unsupported"])
    rows = [row for row in result["rows"] if row["kind"] == "installment"]
    assert sum(row["principal_minor"] for row in rows) == doc["opening"]["principal_minor"]
    assert rows[-1]["closing_principal_minor"] == 0
    for row in rows:
        assert row["principal_minor"] > 0
        assert (
            row["payment_minor"]
            == row["principal_minor"] + row["interest_minor"] + row["fees_minor"]
        )
        assert (
            row["closing_principal_minor"]
            == row["opening_principal_minor"] - row["principal_minor"]
        )
    totals = result["totals"]
    assert (
        totals["payments_minor"]
        == totals["principal_minor"] + totals["interest_minor"] + totals["fees_minor"]
    )


@pytest.mark.parametrize("seed", range(60))
def test_revolving_accounting_identity(seed: int) -> None:
    rng = random.Random(seed)
    doc = fixture("lender-k-revolving-grace-lost-retroactive")
    doc["horizon"]["end_date"] = "2026-06-30"
    doc["cycles"] = [
        {"statement_date": s, "due_date": d}
        for s, d in (
            ("2026-02-28", "2026-03-20"),
            ("2026-03-31", "2026-04-20"),
            ("2026-04-30", "2026-05-20"),
            ("2026-05-31", "2026-06-20"),
            ("2026-06-30", "2026-07-20"),
        )
    ]
    doc["grace"]["loss_policy"] = rng.choice(
        ["retroactive_from_transaction_date", "from_statement_date", "from_due_date"]
    )
    doc["grace"]["loss_charge"] = rng.choice(["due_date", "next_statement"])
    doc["grace"]["requires_previous_paid_in_full"] = rng.choice([True, False])
    doc["interest_bearing"] = rng.sample(
        ["purchases_out_of_grace", "cash", "posted_interest", "fees"], rng.randrange(1, 5)
    )
    doc["rounding"]["interest_stage"] = rng.choice(["daily", "at_posting"])
    doc["accrual"]["payment_effect"] = rng.choice(["same_day", "next_day"])
    allocation = ["fees", "interest", "cash", "purchases"]
    rng.shuffle(allocation)
    doc["allocation"] = allocation
    days = [date(2026, 2, 1) + timedelta(days=i) for i in range(150)]
    doc["transactions"] = [
        {
            "date": rng.choice(days).isoformat(),
            "amount_minor": rng.randrange(1, 90_000),
            "kind": rng.choice(["purchase", "cash_withdrawal"]),
        }
        for _ in range(rng.randrange(0, 15))
    ]
    doc["payments"] = [
        {
            "date": rng.choice(days).isoformat(),
            "amount_minor": rng.randrange(1, 120_000),
            "basis": "planned",
        }
        for _ in range(rng.randrange(0, 10))
    ]
    doc["fees"] = [{"id": "annual", "kind": "one_off", "date": "2026-03-05", "amount_minor": 5000}]
    before = copy.deepcopy(doc)
    result = calculate(doc)
    assert doc == before
    assert result["status"] == "complete", (result["errors"], result["unsupported"])
    t, opening, closing = result["totals"], result["opening"], result["closing"]
    applied = t["payments_minor"] - t["overpayment_minor"]
    assert sum(t["allocated_minor"].values()) == applied
    assert closing["overpayment_held_minor"] == t["overpayment_minor"]
    assert closing["total_minor"] == (
        opening["total_minor"]
        + t["purchases_minor"]
        + t["cash_withdrawals_minor"]
        + t["interest_charged_minor"]
        - closing["grace_interest_pending_minor"]
        + t["fees_assessed_minor"]
        - applied
    )
    for row in result["rows"]:
        if "balances_after" in row:
            assert min(row["balances_after"].values()) >= 0


def test_same_day_order_is_input_order_and_reproducible() -> None:
    doc = fixture("lender-e-daily-full-early-payoff")
    doc["payments"] = [
        {"date": "2026-03-11", "kind": "early_full", "basis": "planned"},
        {"date": "2026-03-11", "amount_minor": 5000, "kind": "regular", "basis": "planned"},
    ]
    first = calculate(doc)
    payments = [row for row in first["rows"] if row["kind"] == "payment"]
    assert payments[0]["amount_minor"] == 1_010_000
    assert payments[1]["overpayment_minor"] == 5000
    assert first == calculate(copy.deepcopy(doc))
    doc["payments"].reverse()
    second = calculate(doc)
    payments = [row for row in second["rows"] if row["kind"] == "payment"]
    assert payments[0]["allocated_minor"] == {"fees": 0, "interest": 5000, "principal": 0}
    assert payments[1]["amount_minor"] == 1_005_000
    assert second["totals"]["overpayment_minor"] == 0


def test_fees_precede_payments_on_the_same_day() -> None:
    doc = fixture("lender-d-fees-allocation-payoff")
    rows = calculate(doc)["rows"]
    jan31 = [row["kind"] for row in rows if row["date"] == "2026-01-31"]
    assert jan31 == ["fee", "payment"]


def test_principal_first_allocation_leaves_fees_due_explicitly() -> None:
    doc = fixture("lender-d-fees-allocation-payoff")
    doc["allocation"] = ["principal", "interest", "fees"]
    doc["payments"] = doc["payments"][:2]
    result = calculate(doc)
    assert result["closing"]["principal_minor"] == 40000
    assert result["closing"]["fees_due_minor"] == 2000 + 1000 * 4
    assert result["totals"]["allocated_minor"]["fees"] == 0


def test_horizon_is_bounded() -> None:
    doc = fixture("lender-a-daily-same-day-partial")
    doc["horizon"]["end_date"] = (
        date(2026, 1, 1) + timedelta(days=MAX_HORIZON_DAYS + 1)
    ).isoformat()
    result = calculate(doc)
    assert result["status"] == "invalid"
    assert {"path": "horizon.end_date", "code": "horizon_exceeds_limit"} in result["errors"]


@pytest.mark.parametrize(
    ("mode", "expected"), [("half_up", 51), ("half_even", 50), ("down", 50), ("up", 51)]
)
def test_rounding_mode_on_an_exact_half(mode: str, expected: int) -> None:
    # 1 262 500 x 0.00004 = 50.5 minor units for one day.
    doc = fixture("lender-a-daily-same-day-partial")
    doc["opening"]["principal_minor"] = 1_262_500
    doc["interest"]["value"] = "0.004"
    doc["horizon"]["end_date"] = "2026-01-02"
    doc["payments"] = []
    doc["rounding"]["mode"] = mode
    assert calculate(doc)["closing"]["interest_due_minor"] == expected


def test_round_minor_with_step() -> None:
    assert round_minor(Decimal("149.99"), 100, "half_up") == 100
    assert round_minor(Decimal("150"), 100, "half_up") == 200
    assert round_minor(Decimal("150"), 100, "half_even") == 200
    assert round_minor(Decimal("250"), 100, "half_even") == 200
    assert round_minor(Decimal("101"), 100, "up") == 200


def test_engine_source_never_builds_decimals_from_floats_or_evaluates_code() -> None:
    forbidden = {"float", "eval", "exec", "compile", "__import__"}
    for path in SOURCE.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                assert node.func.id not in forbidden, (
                    f"{path.name}:{node.lineno} calls {node.func.id}"
                )
            assert not (isinstance(node, ast.Constant) and isinstance(node.value, float)), (
                f"{path.name}:{node.lineno} has a float literal"
            )


def test_revolving_payment_reaches_same_day_purchases_in_input_order() -> None:
    doc = fixture("lender-j-revolving-grace-kept")
    doc["transactions"] = [
        {"date": "2026-02-10", "amount_minor": 1000 + index, "kind": "purchase"} for index in range(11)
    ]
    doc["payments"] = [{"date": "2026-02-11", "amount_minor": 1000 * 9 + 36, "basis": "planned"}]
    doc["horizon"]["end_date"] = "2026-02-11"
    result = calculate(doc)
    # 1000+…+1008 = 9 036 pays the first nine purchases exactly; purchases 9 and 10 remain.
    assert result["closing"]["purchases_minor"] == 1009 + 1010
