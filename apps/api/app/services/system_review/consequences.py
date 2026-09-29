"""Consequence intelligence — transparent projections under explicit inputs (plan §10).

A consequence is not a relation: it is a derived impact under stated
assumptions. Every impact exposes its inputs (and where each came from), its
assumptions, the calculation, the horizon, the result, what is missing and its
limitations. When an input is missing the impact says ``needs_input`` and names
it — it is never estimated, defaulted or guessed. Money arithmetic happens only
within one currency; there is no conversion.

Nothing here judges a purchase. The output is conditions and projections
("unplanned, funded by credit; under these repayment assumptions the payoff
projection moves by 11 days"), never "good/bad", never a score.
"""

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_FLOOR, ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.asof import apply_as_of
from app.analytics.enums import FinanceContextKind
from app.models import AAFinanceContext, AAMeasurement
from app.services.aa_desirability import desirability
from app.services.aa_finance import TRANSACTION_METRIC
from app.services.system_review.changes import FinanceMonth, _fact_value, fact_value_payload
from app.services.system_review.contexts import active_contexts
from app.services.system_review.contracts import (
    MAX_EXPENSE_CONTEXTS,
    MAX_OBLIGATIONS,
    money,
    plain,
)
from app.services.system_review.periods import Period
from app.services.system_review.refs import context_ref, subject_ref
from app.services.system_review.selfcheck import evaluate_self_check

CENT = Decimal("0.01")
HORIZON_MONTHS = 600
REPEAT_HORIZON_MONTHS = 12
CREDIT_FUNDING = ("credit", "borrowed")
RESERVE_FUNDING = ("cash_balance", "debit_balance")


def _d(value: Any) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def add_months(day: date, months: int) -> date:
    index = day.year * 12 + day.month - 1 + months
    year, month = divmod(index, 12)
    last = calendar.monthrange(year, month + 1)[1]
    return date(year, month + 1, min(day.day, last))


@dataclass(frozen=True)
class Expense:
    context: AAFinanceContext
    measurement: AAMeasurement
    transaction_id: str

    @property
    def payload(self) -> dict[str, Any]:
        return self.context.payload

    @property
    def amount(self) -> Decimal:
        return self.measurement.value_num or Decimal("0")

    @property
    def currency(self) -> str:
        return self.measurement.unit_code or ""

    def local_date(self, timezone: str) -> date:
        return self.measurement.occurred_at.astimezone(ZoneInfo(timezone)).date()

    @property
    def recurrence(self) -> Decimal | None:
        if self.payload.get("expected_recurrence") not in ("occasional", "recurring"):
            return None
        return _d(self.payload.get("recurrence_per_month"))


def _impact(
    kind: str,
    state: str,
    *,
    inputs: list[dict[str, Any]] | None = None,
    assumptions: list[str] | None = None,
    calculation: dict[str, Any] | None = None,
    horizon: str | None = None,
    result: dict[str, Any] | None = None,
    missing: list[str] | None = None,
    limitations: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "kind": kind,
        "state": state,
        "inputs": inputs or [],
        "assumptions": assumptions or [],
        "calculation": calculation,
        "horizon": horizon,
        "result": result,
        "missing_inputs": missing or [],
        "limitations": limitations or [],
    }


def _input(name: str, value: Any, source: str, ref: str | None = None) -> dict[str, Any]:
    return {"name": name, "value": value, "source": source, "ref": ref}


# ───────────────────────────── loading ─────────────────────────────


def load_expenses(
    db: Session, *, user_id: UUID, contexts: list[AAFinanceContext], period: Period
) -> tuple[list[Expense], int]:
    """Expense contexts whose transaction's live Measurement occurred in the period."""
    wanted = {row.subject_key: row for row in contexts
              if row.kind == FinanceContextKind.EXPENSE_CONTEXT}
    if not wanted:
        return [], 0
    rows = db.scalars(
        apply_as_of(
            select(AAMeasurement).where(
                AAMeasurement.user_id == user_id,
                AAMeasurement.metric_key == TRANSACTION_METRIC,
                AAMeasurement.subject_key.in_(list(wanted)),
            ),
            AAMeasurement,
            None,
        ).order_by(AAMeasurement.recorded_at.desc(), AAMeasurement.id.desc())
    )
    live: dict[str, AAMeasurement] = {}
    for row in rows:
        live.setdefault(row.subject_key, row)
    expenses = []
    unavailable = 0
    for subject_key, context in wanted.items():
        measurement = live.get(subject_key)
        if measurement is None or measurement.value_num is None:
            unavailable += 1
            continue
        if period.contains_instant(measurement.occurred_at):
            expenses.append(
                Expense(context, measurement, subject_key.split(":", 2)[2])
            )
    expenses.sort(key=lambda e: (e.measurement.occurred_at, e.transaction_id))
    return expenses[:MAX_EXPENSE_CONTEXTS], unavailable


@dataclass
class Position:
    obligations: dict[str, AAFinanceContext]
    reserves: list[AAFinanceContext]
    essentials: list[AAFinanceContext]
    self_check: AAFinanceContext | None

    def reserve_total(self, currency: str) -> tuple[Decimal, Decimal | None, list] | None:
        same = [row for row in self.reserves if row.payload.get("currency") == currency]
        if not same:
            return None
        total = sum((_d(row.payload["amount"]) for row in same), Decimal("0"))
        thresholds = [_d(row.payload.get("threshold")) for row in same]
        threshold = (
            sum((value for value in thresholds if value is not None), Decimal("0"))
            if any(value is not None for value in thresholds)
            else None
        )
        return total, threshold, same

    def essentials_for(self, currency: str) -> AAFinanceContext | None:
        same = [row for row in self.essentials if row.payload.get("currency") == currency]
        return max(same, key=lambda row: row.payload["as_of"]) if same else None


def load_position(
    contexts: list[AAFinanceContext], period: Period | None = None
) -> Position:
    obligations = {
        str(row.entity_id): row for row in contexts if row.kind == FinanceContextKind.OBLIGATION
    }
    self_check = None
    if period is not None and period.kind == "month":
        self_check = next(
            (row for row in contexts
             if row.kind == FinanceContextKind.SELF_CHECK
             and row.subject_key == period.subject_key),
            None,
        )
    return Position(
        obligations=dict(list(obligations.items())[:MAX_OBLIGATIONS]),
        reserves=[row for row in contexts if row.kind == FinanceContextKind.RESERVE],
        essentials=[row for row in contexts if row.kind == FinanceContextKind.ESSENTIALS],
        self_check=self_check,
    )


# ───────────────────────────── calculations ─────────────────────────────


def simulate_payoff(
    balance: Decimal, payment: Decimal, annual_rate_percent: Decimal, monthly_add: Decimal
) -> dict[str, Any]:
    """Monthly amortisation: B(k+1) = B(k)·(1 + i/12) + add − P, capped at 600 months.

    The last payment is usually partial; ``final_fraction`` (needed ÷ P) lets the
    payoff date land on a day, so a small one-off change is not rounded away.
    """
    rate = annual_rate_percent / Decimal(100) / Decimal(12)
    if balance <= 0:
        return {"state": "paid_off", "months": 0, "total_interest": "0.00",
                "final_fraction": "0"}
    if payment <= (balance * rate).quantize(CENT, ROUND_HALF_UP) + monthly_add:
        return {"state": "does_not_decrease", "months": None, "total_interest": None,
                "final_fraction": None}
    interest_total = Decimal("0")
    for month in range(1, HORIZON_MONTHS + 1):
        interest = (balance * rate).quantize(CENT, ROUND_HALF_UP)
        interest_total += interest
        due = balance + interest + monthly_add
        if due <= payment:
            fraction = (due / payment).quantize(Decimal("0.0001"), ROUND_HALF_UP)
            return {"state": "paid_off", "months": month, "total_interest": plain(interest_total),
                    "final_fraction": plain(fraction)}
        balance = due - payment
    return {"state": "beyond_horizon", "months": None, "total_interest": None,
            "final_fraction": None}


def _projection(as_of: date, outcome: dict[str, Any]) -> dict[str, Any]:
    months = outcome["months"]
    if months is None:
        return {**outcome, "payoff_date": None}
    if months == 0:
        return {**outcome, "payoff_date": as_of.isoformat()}
    start = add_months(as_of, months - 1)
    length = (add_months(as_of, months) - start).days
    offset = (Decimal(outcome["final_fraction"]) * length).to_integral_value(ROUND_HALF_UP)
    return {**outcome, "payoff_date": (start + timedelta(days=int(offset))).isoformat()}


def _days_between(first: dict[str, Any] | None, second: dict[str, Any] | None) -> int | None:
    if not first or not second or not first.get("payoff_date") or not second.get("payoff_date"):
        return None
    return (date.fromisoformat(second["payoff_date"]) - date.fromisoformat(first["payoff_date"])).days


def budget_impact(expense: Expense, month: FinanceMonth) -> dict[str, Any]:
    if month.actual is None:
        return _impact(
            "budget_deviation", "not_applicable",
            limitations=[f"month_actual_{month.availability}"],
        )
    target = month.target
    target_value = (
        _fact_value(target) if target is not None and not target.is_explicitly_absent else None
    )
    expectation_value = _fact_value(month.expectation)
    actual = month.actual.value_num
    inputs = [
        _input("expense_amount", money(expense.amount, expense.currency), "fact",
               subject_ref(expense.context.subject_key)),
        _input("month_actual", fact_value_payload(month.actual), "derived"),
    ]
    result: dict[str, Any] = {"expense_amount": money(expense.amount, expense.currency),
                              "month_actual": fact_value_payload(month.actual)}
    limitations: list[str] = []
    if target_value is not None:
        if target_value.unit_code != expense.currency:
            limitations.append("currency_mismatch")
        else:
            inputs.append(_input("target", fact_value_payload(target_value), "fact"))
            result["target"] = fact_value_payload(target_value)
            result["over_target"] = money(actual - target_value.value_num, "UAH")
    if expectation_value is not None and expectation_value.unit_code == "UAH":
        inputs.append(_input("expectation", fact_value_payload(expectation_value), "fact"))
        result["expectation"] = fact_value_payload(expectation_value)
        result["vs_expectation"] = money(actual - expectation_value.value_num, "UAH")
    if "target" not in result and "expectation" not in result:
        return _impact(
            "budget_deviation", "needs_input", inputs=inputs,
            missing=["target_or_expectation"], limitations=limitations,
        )
    return _impact(
        "budget_deviation", "computed",
        inputs=inputs,
        assumptions=["expectation_is_a_prediction_not_a_norm"],
        calculation={"formula": "month_actual − target; month_actual − expectation"},
        horizon="period",
        result=result,
        limitations=limitations,
    )


def repeat_impact(expense: Expense) -> dict[str, Any]:
    recurrence = expense.payload.get("expected_recurrence", "unknown")
    if recurrence == "one_off":
        return _impact("repeat_scenario", "not_applicable", limitations=["marked_one_off"])
    per_month = expense.recurrence
    if per_month is None:
        return _impact(
            "repeat_scenario", "needs_input",
            missing=["expected_recurrence" if recurrence == "unknown" else "recurrence_per_month"],
        )
    monthly = (expense.amount * per_month).quantize(CENT, ROUND_HALF_UP)
    return _impact(
        "repeat_scenario", "computed",
        inputs=[
            _input("expense_amount", money(expense.amount, expense.currency), "fact"),
            _input("recurrence_per_month", plain(per_month), "user"),
        ],
        assumptions=["same_amount_each_time"],
        calculation={"formula": "amount × recurrence_per_month; × 12"},
        horizon=f"{REPEAT_HORIZON_MONTHS}_months",
        result={
            "monthly": money(monthly, expense.currency),
            "twelve_months": money(monthly * REPEAT_HORIZON_MONTHS, expense.currency),
        },
    )


def debt_impact(
    expense: Expense, position: Position, timezone: str
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Payoff projection A (as entered) vs B (+ this expense) vs C (+ its repetition)."""
    funding = expense.payload.get("funding_source", "unknown")
    if funding == "mixed":
        return _impact("debt_projection", "needs_input", missing=["credit_portion"]), None
    if funding not in CREDIT_FUNDING:
        return _impact(
            "debt_projection", "not_applicable", limitations=[f"funding_{funding}"]
        ), None
    obligation = position.obligations.get(str(expense.payload.get("obligation_entity_id")))
    if obligation is None:
        return _impact("debt_projection", "needs_input", missing=["obligation"]), None
    terms = obligation.payload
    missing = [
        name for name in ("outstanding", "monthly_payment", "annual_rate_percent")
        if terms.get(name) is None
    ]
    if missing:
        return _impact("debt_projection", "needs_input", missing=missing), None
    if terms["currency"] != expense.currency:
        return _impact(
            "debt_projection", "not_applicable", limitations=["currency_mismatch"]
        ), None
    balance = _d(terms["outstanding"])
    payment = _d(terms["monthly_payment"])
    rate = _d(terms["annual_rate_percent"])
    as_of = date.fromisoformat(terms["as_of"])
    ref = context_ref(obligation.entity_id)
    assumptions = ["fixed_monthly_payment", "fixed_annual_rate", "no_other_new_borrowing"]
    limitations = []
    a = _projection(as_of, simulate_payoff(balance, payment, rate, Decimal("0")))
    after_as_of = expense.local_date(timezone) > as_of
    b = None
    base_for_c = balance
    if after_as_of:
        b = _projection(as_of, simulate_payoff(balance + expense.amount, payment, rate,
                                               Decimal("0")))
        base_for_c = balance + expense.amount
    else:
        limitations.append("expense_may_already_be_in_outstanding")
    c = None
    per_month = expense.recurrence
    if per_month is not None:
        add = (expense.amount * per_month).quantize(CENT, ROUND_HALF_UP)
        c = _projection(as_of, simulate_payoff(base_for_c, payment, rate, add))
    result = {
        "a_as_entered": a,
        "b_with_this_expense": b,
        "c_if_repeated": c,
        "delta_days_b": _days_between(a, b),
        "delta_days_c": _days_between(a, c),
    }
    planned = terms.get("planned_payoff_date")
    priority = None
    if planned:
        latest = max(
            (p["payoff_date"] for p in (b, c) if p and p.get("payoff_date")), default=None
        )
        stuck = any(p and p["state"] in ("does_not_decrease", "beyond_horizon") for p in (b, c))
        if stuck or (latest is not None and latest > planned):
            priority = {
                "kind": "payoff_after_planned_date",
                "planned_payoff_date": planned,
                "projected_payoff_date": latest,
                "desire": "unfavorable",
                "basis": {"kind": "user_planned_date", "ref": ref, "direction": "lower"},
            }
        elif a.get("payoff_date") and a["payoff_date"] <= planned:
            priority = {
                "kind": "payoff_on_plan",
                "planned_payoff_date": planned,
                "projected_payoff_date": a["payoff_date"],
                "desire": "favorable",
                "basis": {"kind": "user_planned_date", "ref": ref, "direction": "lower"},
            }
    missing_c = [] if per_month is not None else ["recurrence_per_month"]
    impact = _impact(
        "debt_projection", "computed",
        inputs=[
            _input("outstanding", money(balance, terms["currency"]), "user", ref),
            _input("monthly_payment", money(payment, terms["currency"]), "user", ref),
            _input("annual_rate_percent", plain(rate), "user", ref),
            _input("as_of", terms["as_of"], "user", ref),
            _input("expense_amount", money(expense.amount, expense.currency), "fact"),
        ],
        assumptions=assumptions,
        calculation={"formula": "B(k+1) = B(k)·(1 + rate/12) + added − payment;"
                                " last payment partial (days pro rata)",
                     "cap_months": HORIZON_MONTHS},
        horizon="until_paid_or_600_months",
        result=result,
        missing=missing_c,
        limitations=limitations,
    )
    return impact, priority


def reserve_impact(expense: Expense, position: Position, timezone: str) -> dict[str, Any]:
    funding = expense.payload.get("funding_source", "unknown")
    if funding not in RESERVE_FUNDING:
        return _impact("reserve_projection", "not_applicable",
                       limitations=[f"funding_{funding}"])
    reserve = position.reserve_total(expense.currency)
    if reserve is None:
        return _impact("reserve_projection", "needs_input", missing=["reserve"])
    total, threshold, rows = reserve
    as_of = max(date.fromisoformat(row.payload["as_of"]) for row in rows)
    assumptions = ["no_other_inflows_or_outflows"]
    if len(rows) > 1:
        assumptions.append("reserves_summed_same_currency")
    limitations = ["income_not_modeled"]
    result: dict[str, Any] = {"reserve": money(total, expense.currency)}
    current = total
    if expense.local_date(timezone) > as_of:
        current = total - expense.amount
        result["after_this_expense"] = money(current, expense.currency)
    else:
        limitations.append("expense_may_already_be_in_reserve")
    if threshold is None:
        assumptions.append("threshold_not_set_calculated_to_zero")
        floor = Decimal("0")
    else:
        floor = threshold
        result["threshold"] = money(threshold, expense.currency)
    missing = []
    per_month = expense.recurrence
    if per_month is not None:
        draw = (expense.amount * per_month).quantize(CENT, ROUND_HALF_UP)
        room = current - floor
        months = int((room / draw).to_integral_value(ROUND_FLOOR)) if room > 0 else 0
        result["monthly_draw"] = money(draw, expense.currency)
        result["months_until_threshold"] = months
    else:
        missing.append("recurrence_per_month")
    return _impact(
        "reserve_projection", "computed",
        inputs=[
            _input("reserve", money(total, expense.currency), "user",
                   context_ref(rows[0].entity_id)),
            _input("expense_amount", money(expense.amount, expense.currency), "fact"),
        ],
        assumptions=assumptions,
        calculation={"formula": "floor((reserve − threshold) / (amount × recurrence))"},
        horizon="until_threshold",
        result=result,
        missing=missing,
        limitations=limitations,
    )


def essentials_impact(expense: Expense, position: Position) -> dict[str, Any]:
    funding = expense.payload.get("funding_source", "unknown")
    if funding not in RESERVE_FUNDING:
        return _impact("essentials_risk", "not_applicable", limitations=[f"funding_{funding}"])
    reserve = position.reserve_total(expense.currency)
    essentials = position.essentials_for(expense.currency)
    missing = [name for name, value in (("reserve", reserve), ("essentials", essentials))
               if value is None]
    if missing:
        return _impact("essentials_risk", "needs_input", missing=missing)
    total = reserve[0]
    monthly = _d(essentials.payload["monthly_amount"])
    per_month = expense.recurrence
    draw = (expense.amount * per_month).quantize(CENT) if per_month is not None else expense.amount
    step = Decimal("0.1")
    return _impact(
        "essentials_risk", "computed",
        inputs=[
            _input("reserve", money(total, expense.currency), "user"),
            _input("essentials_monthly", money(monthly, expense.currency), "user",
                   context_ref(essentials.entity_id)),
        ],
        assumptions=["no_other_inflows_or_outflows"]
        + ([] if per_month is not None else ["one_off_draw"]),
        calculation={"formula": "reserve / essentials; (reserve − draw) / essentials"},
        horizon="one_month",
        result={
            "coverage_months_now": plain((total / monthly).quantize(step, ROUND_FLOOR)),
            "coverage_months_after": plain(((total - draw) / monthly).quantize(step, ROUND_FLOOR)),
            "draw": money(draw, expense.currency),
        },
        limitations=["income_not_modeled"],
    )


def target_priority(month: FinanceMonth) -> dict[str, Any] | None:
    grounding = month.grounding
    if grounding is None or month.actual is None:
        return None
    desire = desirability(month.actual, grounding)
    if desire != "unfavorable":
        return None
    return {
        "kind": "target_exceeded",
        "desire": "unfavorable",
        "month_actual": fact_value_payload(month.actual),
        "target": fact_value_payload(grounding.reference),
        "basis": {"kind": "target", "fact_id": grounding.fact_id,
                  "direction": grounding.direction},
        "sources": [list(source) for source in month.sources]
        + [["aa_targets", grounding.fact_id]],
    }


def _flags(expense: Expense, impacts: dict[str, dict], unplanned_count: int,
           priority: dict | None) -> list[dict[str, Any]]:
    payload = expense.payload
    flags = []
    if payload.get("plannedness") == "unplanned" and payload.get("funding_source") in CREDIT_FUNDING:
        flags.append({"flag": "unplanned_credit_funded", "conditions": [
            {"field": "plannedness", "value": "unplanned"},
            {"field": "funding_source", "value": payload.get("funding_source")},
        ]})
    if payload.get("plannedness") == "unplanned" and unplanned_count >= 2:
        flags.append({"flag": "repeated_unplanned_in_period", "conditions": [
            {"field": "unplanned_in_period", "value": unplanned_count},
        ]})
    debt = impacts["debt_projection"]
    if debt["state"] == "computed":
        delta = debt["result"].get("delta_days_c") or debt["result"].get("delta_days_b")
        if delta is not None and delta > 0:
            flags.append({"flag": "debt_payoff_moves_later", "conditions": [
                {"field": "delta_days", "value": delta}]})
    reserve = impacts["reserve_projection"]
    months = (reserve.get("result") or {}).get("months_until_threshold")
    if reserve["state"] == "computed" and months is not None and months <= 12:
        flags.append({"flag": "reserve_reaches_threshold_within_12_months", "conditions": [
            {"field": "months_until_threshold", "value": months}]})
    if priority is not None and priority["kind"] == "payoff_after_planned_date":
        flags.append({"flag": "payoff_after_planned_date", "conditions": [
            {"field": "planned_payoff_date", "value": priority["planned_payoff_date"]}]})
    if payload.get("worth_it") == "no":
        flags.append({"flag": "user_marked_not_worth_it", "conditions": [
            {"field": "worth_it", "value": "no"}]})
    return flags


def _impact_sources(
    kind: str, expense: Expense, month: FinanceMonth, position: Position
) -> list[list[str]]:
    """What each impact read, so D1 redacts only the impact a deletion touched."""
    own = [["aa_measurements", str(expense.measurement.id)],
           ["aa_finance_contexts", str(expense.context.entity_id)]]
    if kind == "budget_deviation":
        extra = [list(source) for source in month.sources]
        if month.target is not None:
            extra.append(["aa_targets", str(month.target.id)])
        if month.expectation is not None:
            extra.append(["aa_expectation_versions", str(month.expectation.id)])
        return own + extra
    if kind == "debt_projection":
        named = position.obligations.get(str(expense.payload.get("obligation_entity_id")))
        return own + ([["aa_finance_contexts", str(named.entity_id)]] if named else [])
    if kind in ("reserve_projection", "essentials_risk"):
        rows = list(position.reserves)
        if kind == "essentials_risk":
            rows += list(position.essentials)
        return own + [["aa_finance_contexts", str(row.entity_id)] for row in rows]
    return own


def analyse_expense(
    expense: Expense, *, month: FinanceMonth, position: Position, timezone: str,
    unplanned_count: int,
) -> dict[str, Any]:
    debt, priority = debt_impact(expense, position, timezone)
    impacts = {
        "budget_deviation": budget_impact(expense, month),
        "repeat_scenario": repeat_impact(expense),
        "debt_projection": debt,
        "reserve_projection": reserve_impact(expense, position, timezone),
        "essentials_risk": essentials_impact(expense, position),
    }
    missing = sorted({name for impact in impacts.values() for name in impact["missing_inputs"]})
    context_fields = {
        key: expense.payload.get(key)
        for key in ("plannedness", "funding_source", "purpose", "motive", "emotional_context",
                    "worth_it", "expected_recurrence", "recurrence_per_month",
                    "obligation_entity_id")
    }
    flags = _flags(expense, impacts, unplanned_count, priority)
    for kind, impact in impacts.items():
        impact["section"] = "consequences"
        impact["sources"] = _impact_sources(kind, expense, month, position)
    if priority is not None:
        priority["sources"] = _impact_sources("debt_projection", expense, month, position)
    return {
        "ref": subject_ref(expense.context.subject_key),
        "context_ref": context_ref(expense.context.entity_id),
        "kind": "expense_analysis",
        "transaction_id": expense.transaction_id,
        "expense": {
            "amount": money(expense.amount, expense.currency),
            "date": expense.local_date(timezone).isoformat(),
            "category_id": (expense.measurement.dimensions or {}).get("category_id"),
        },
        "context": context_fields,
        "context_version": expense.context.version,
        "impacts": list(impacts.values()),
        "priority": priority,
        "attention": flags,
        "missing_inputs": missing,
        # The analysis itself rests on the expense and the user's context for it; each
        # impact carries what else it read.
        "sources": [["aa_measurements", str(expense.measurement.id)],
                    ["aa_finance_contexts", str(expense.context.entity_id)]],
    }


def position_summary(position: Position) -> dict[str, Any]:
    def entry(row: AAFinanceContext) -> dict[str, Any]:
        return {"entity_id": str(row.entity_id), "ref": context_ref(row.entity_id),
                "version": row.version, **row.payload}

    missing = []
    if not position.reserves:
        missing.append("reserve")
    if not position.essentials:
        missing.append("essentials")
    return {
        "obligations": [entry(row) for row in position.obligations.values()],
        "reserves": [entry(row) for row in position.reserves],
        "essentials": [entry(row) for row in position.essentials],
        "income": "not_modeled",
        "missing_inputs": missing,
    }


def consequences_for_month(
    db: Session, *, user_id: UUID, period: Period, month: FinanceMonth,
    contexts: list[AAFinanceContext] | None = None,
) -> dict[str, Any]:
    contexts = contexts if contexts is not None else active_contexts(db, user_id=user_id)
    position = load_position(contexts, period)
    expenses, unavailable = load_expenses(db, user_id=user_id, contexts=contexts, period=period)
    unplanned = sum(1 for e in expenses if e.payload.get("plannedness") == "unplanned")
    analyses = [
        analyse_expense(e, month=month, position=position, timezone=period.timezone,
                        unplanned_count=unplanned)
        for e in expenses
    ]
    priorities = [a["priority"] for a in analyses if a["priority"]]
    target = target_priority(month)
    if target is not None:
        priorities.append(target)
    highlighted = any(
        flag["flag"] in ("unplanned_credit_funded", "repeated_unplanned_in_period")
        for a in analyses for flag in a["attention"]
    )
    self_check = None
    if position.obligations or position.self_check is not None:
        saved = position.self_check
        self_check = {
            "offered": bool(position.obligations),
            "highlighted": highlighted and bool(position.obligations),
            "entity_id": str(saved.entity_id) if saved else None,
            "result": evaluate_self_check(saved.payload.get("answers") if saved else None)
            if saved else None,
        }
    return {
        "expenses": analyses,
        "position": position_summary(position),
        "priorities": priorities,
        "self_check": self_check,
        "unplanned_count": unplanned,
        "contexts_without_transaction": unavailable,
        "funding_summary": None,
    }


def unplanned_by_window(
    db: Session, *, user_id: UUID, windows: list[Period], contexts: list[AAFinanceContext]
) -> dict[str, int]:
    counts: dict[str, int] = {}
    for window in windows:
        expenses, _ = load_expenses(db, user_id=user_id, contexts=contexts, period=window)
        counts[window.key] = sum(
            1 for e in expenses if e.payload.get("plannedness") == "unplanned"
        )
    return counts


def funding_summary(expenses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Year view: counts by plannedness × funding and sums per funding — one currency each."""
    buckets: dict[tuple[str, str, str], dict[str, Any]] = {}
    for analysis in expenses:
        context = analysis["context"]
        amount = analysis["expense"]["amount"]
        key = (context.get("plannedness") or "unknown", context.get("funding_source") or "unknown",
               amount["unit_code"])
        bucket = buckets.setdefault(key, {"plannedness": key[0], "funding_source": key[1],
                                          "count": 0, "total": Decimal("0"), "currency": key[2]})
        bucket["count"] += 1
        bucket["total"] += Decimal(amount["num"])
    return [
        {**bucket, "total": money(bucket["total"], bucket["currency"])}
        for _, bucket in sorted(buckets.items())
    ]
