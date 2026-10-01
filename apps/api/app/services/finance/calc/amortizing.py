"""Model ``amortizing``: fixed-period annuity and equal-principal schedules.

Supported assumptions (all explicit inputs):
* **monthly** periods on an anchored day of month (``term.anchor_day``; 31 →
  last day of shorter months, never drifting);
* a period rate that does **not** depend on the number of days: a stated
  monthly rate, or an annual rate with ``period_rate_rule = annual_div_12``;
* a **regular first period**: the opening date is itself an anchor date and the
  first payment falls exactly one month later. Short/long first periods are
  unsupported (named), not approximated;
* interest per period = round(balance × period rate); the annuity payment is
  rounded once with the same mode/step; equal-principal parts are rounded;
* ``final_adjustment = last_payment_settles_balance``: the final instalment pays
  the exact remaining principal plus its interest;
* fees on due dates (fixed, or percent of opening/outstanding principal);
* prepayments on due dates only, after that date's instalment, with a fixed or
  no fee and an explicit ``reduce_term`` / ``reduce_payment`` recalculation.

A contract whose interest accrues daily between dates is **not** this model even
if it calls its schedule "annuity": use ``daily_accrual`` with the published
payments and reconcile against the lender schedule instead.

Missed or partial instalments, payment holidays, penalties and business-day
shifts are outside this model.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from app.services.finance.calc.contracts import (
    AMORTIZING_METHODS,
    FINAL_ADJUSTMENTS,
    FREQUENCIES,
    MAX_PERIODS,
    PERIOD_RATE_RULES,
    RECALCULATIONS,
)
from app.services.finance.calc.ledger import Ledger
from app.services.finance.calc.numbers import is_on_anchor, monthly_date, round_minor
from app.services.finance.calc.reader import Issues, Reader
from app.services.finance.calc.terms import (
    FeeRule,
    Opening,
    Payment,
    Rounding,
    currency,
    early_fee,
    fees,
    horizon_end,
    opening,
    payments,
    penalties,
    rate,
    rounding,
)

TOP_KEYS = (
    "schema_version",
    "model",
    "currency",
    "opening",
    "horizon",
    "interest",
    "method",
    "term",
    "rounding",
    "final_adjustment",
    "fees",
    "prepayments",
    "early_repayment",
    "penalties",
)


@dataclass(frozen=True)
class AmortizingSpec:
    currency: str
    opening: Opening
    end: date
    period_rate: Decimal
    rate_inputs: dict[str, Any]
    method: str
    periods: int
    due_dates: tuple[date, ...]
    rounding: Rounding
    fees: tuple[FeeRule, ...]
    prepayments: tuple[Payment, ...]
    early_fee: int
    recalculation: str | None


def parse(reader: Reader, doc: dict[str, Any]) -> AmortizingSpec | None:
    issues = reader.issues
    reader.known_keys(doc, "", TOP_KEYS)
    cur = currency(reader, doc)
    op = opening(reader, doc, allow_due=False)
    end = horizon_end(reader, doc, op.date if op else None)
    rt, section = rate(
        reader,
        doc,
        periods=("day", "month", "year"),
        day_count_for_year=False,
        extra_keys=("period_rate_rule",),
    )
    period_rate = None
    rate_inputs: dict[str, Any] = {}
    if rt is not None and rt.per == "day":
        issues.unsupport("interest.per", "daily_rate_requires_daily_accrual_model", "day")
    elif rt is not None and rt.per == "year":
        rule = reader.choice(section, "period_rate_rule", "interest", PERIOD_RATE_RULES)
        if rule is not None:
            period_rate = rt.fraction / Decimal(12)
            rate_inputs = {"annual_fraction": rt.fraction, "period_rate_rule": rule}
    elif rt is not None:
        if section is not None and "period_rate_rule" in section:
            issues.error("interest.period_rate_rule", "period_rate_rule_only_for_annual_rates")
        period_rate = rt.fraction
        rate_inputs = {"monthly_fraction": rt.fraction}

    method = reader.choice(doc, "method", "", AMORTIZING_METHODS)
    term = reader.section(doc, "term", "")
    reader.known_keys(term, "term", ("periods", "frequency", "first_payment_date", "anchor_day"))
    periods = reader.integer(term, "periods", "term", 1, MAX_PERIODS)
    reader.choice(term, "frequency", "term", FREQUENCIES)
    first = reader.day(term, "first_payment_date", "term")
    anchor = reader.integer(term, "anchor_day", "term", 1, 31)
    due_dates: tuple[date, ...] | None = None
    if first is not None and anchor is not None:
        if not is_on_anchor(first, anchor):
            issues.error("term.first_payment_date", "first_date_not_on_anchor_day")
        elif op is not None and not (
            is_on_anchor(op.date, anchor) and monthly_date(op.date, anchor, 1) == first
        ):
            issues.unsupport("term.first_payment_date", "irregular_first_period", first.isoformat())
        elif periods is not None:
            due_dates = tuple(monthly_date(first, anchor, k) for k in range(periods))
    rnd = rounding(reader, doc, staged=False)
    reader.choice(doc, "final_adjustment", "", FINAL_ADJUSTMENTS)

    fee_rules = fees(reader, doc)
    pre = payments(reader, doc, "prepayments", ("early_partial", "early_full"))
    early, section_early = early_fee(reader, doc, bool(pre), extra=("recalculation",))
    recalculation = None
    if pre:
        recalculation = reader.choice(
            section_early, "recalculation", "early_repayment", RECALCULATIONS
        )
    penalties(reader, doc)

    kept_fees: list[FeeRule] = []
    kept_pre: list[Payment] = []
    if due_dates is not None and end is not None:
        due_set = set(due_dates)
        for rule in fee_rules:
            if all(day in due_set for day in rule.dates(due_dates[-1])):
                kept_fees.append(rule)
            else:
                issues.unsupport(rule.path, "fee_date_not_a_due_date", rule.id, blocking=False)
        seen: set[date] = set()
        for p in pre:
            path = f"prepayments[{p.index}]"
            if p.date not in due_set:
                issues.unsupport(f"{path}.date", "prepayment_between_due_dates", p.date.isoformat())
            elif p.date in seen:
                issues.error(f"{path}.date", "multiple_prepayments_on_one_due_date")
            elif p.date > end:
                issues.not_applied.append(
                    {"path": path, "code": "after_horizon", "value": p.date.isoformat()}
                )
            else:
                seen.add(p.date)
                kept_pre.append(p)
    if None in (cur, op, end, period_rate, method, due_dates, rnd) or (
        pre and recalculation is None
    ):
        return None
    if op.principal == 0:
        issues.error("opening.principal_minor", "nothing_to_amortize")
        return None
    return AmortizingSpec(
        cur,
        op,
        end,
        period_rate,
        rate_inputs,
        method,
        periods,
        due_dates,
        rnd,
        tuple(kept_fees),
        tuple(kept_pre),
        early or 0,
        recalculation,
    )


def _annuity_exact(balance: int, rate: Decimal, remaining: int) -> Decimal:
    if rate == 0:
        return Decimal(balance) / Decimal(remaining)
    return Decimal(balance) * rate / (1 - (1 + rate) ** (-remaining))


def run(spec: AmortizingSpec, ledger: Ledger, issues: Issues) -> dict[str, Any]:
    r = spec.rounding

    def rnd(value: Decimal) -> int:
        return round_minor(value, r.step, r.mode)

    op = spec.opening
    balance = op.principal
    seq = ledger.explain(op.date, "opening", "opening", basis=op.basis, principal_minor=balance)
    ledger.row(
        op.date,
        "opening",
        explanation=[seq],
        label=f"{op.basis}_opening",
        balances_after={"principal_minor": balance},
    )

    fees_on: dict[date, list[FeeRule]] = defaultdict(list)
    for rule in spec.fees:
        for day in rule.dates(spec.due_dates[-1]):
            fees_on[day].append(rule)
    pre_on = {p.date: p for p in spec.prepayments}

    def level(remaining: int, at: date) -> tuple[int, int]:
        if spec.method == "annuity":
            exact = _annuity_exact(balance, spec.period_rate, remaining)
            amount = rnd(exact)
            s = ledger.explain(
                at,
                "annuity_payment",
                "method",
                amount_minor=amount,
                balance_minor=balance,
                period_rate=spec.period_rate,
                remaining_periods=remaining,
                exact=exact,
                formula="B*i/(1-(1+i)^-n)" if spec.period_rate else "B/n",
            )
        else:
            exact = Decimal(balance) / Decimal(remaining)
            amount = rnd(exact)
            s = ledger.explain(
                at,
                "principal_part",
                "method",
                amount_minor=amount,
                balance_minor=balance,
                remaining_periods=remaining,
                exact=exact,
            )
        return amount, s

    level_amount, level_seq = level(spec.periods, op.date)
    totals = {
        "interest_minor": 0,
        "principal_minor": 0,
        "fees_minor": 0,
        "payments_minor": 0,
        "prepayments_minor": 0,
        "overpayment_minor": 0,
        "instalments": 0,
    }
    for k, due in enumerate(spec.due_dates, start=1):
        if balance == 0:
            break
        if due > spec.end:
            issues.limit("schedule_truncated_at_horizon")
            break
        explanation = [level_seq]
        fee_amount = 0
        for rule in fees_on.get(due, ()):
            if rule.amount is not None:
                amount = rule.amount
            else:
                base = op.principal if rule.base == "opening_principal" else balance
                amount = rnd(Decimal(base) * rule.rate)
            fee_amount += amount
            explanation.append(
                ledger.explain(due, "fee_assessed", rule.path, amount_minor=amount, fee_id=rule.id)
            )
        interest_exact = Decimal(balance) * spec.period_rate
        interest = rnd(interest_exact)
        explanation.append(
            ledger.explain(
                due,
                "period_interest",
                "interest",
                amount_minor=interest,
                balance_minor=balance,
                exact=interest_exact,
                **spec.rate_inputs,
            )
        )
        if spec.method == "annuity":
            principal_part = level_amount - interest
            if principal_part <= 0:
                issues.error("interest", "payment_does_not_cover_interest")
                break
        else:
            principal_part = level_amount
        if k == spec.periods or principal_part >= balance:
            principal_part = balance
            explanation.append(
                ledger.explain(
                    due, "final_adjustment", "final_adjustment", amount_minor=principal_part
                )
            )
        opening_balance = balance
        balance -= principal_part
        payment = principal_part + interest + fee_amount
        totals["interest_minor"] += interest
        totals["principal_minor"] += principal_part
        totals["fees_minor"] += fee_amount
        totals["payments_minor"] += payment
        totals["instalments"] += 1
        ledger.row(
            due,
            "installment",
            explanation=explanation,
            label="calculated_schedule",
            period=k,
            opening_principal_minor=opening_balance,
            interest_minor=interest,
            principal_minor=principal_part,
            fees_minor=fee_amount,
            payment_minor=payment,
            closing_principal_minor=balance,
        )

        p = pre_on.get(due)
        if p is None or balance == 0:
            continue
        path = f"prepayments[{p.index}]"
        fee = spec.early_fee
        amount = balance + fee if p.kind == "early_full" else p.amount
        if amount < fee:
            issues.error(path, "prepayment_below_early_repayment_fee")
            break
        to_principal = min(amount - fee, balance)
        overpay = amount - fee - to_principal
        balance -= to_principal
        explanation = [
            ledger.explain(
                due,
                "prepayment",
                path,
                amount_minor=amount,
                fee_minor=fee,
                principal_minor=to_principal,
                overpayment_minor=overpay,
            )
        ]
        totals["prepayments_minor"] += amount
        totals["payments_minor"] += amount
        totals["principal_minor"] += to_principal
        totals["fees_minor"] += fee
        totals["overpayment_minor"] += overpay
        if balance and spec.recalculation == "reduce_payment":
            level_amount, level_seq = level(spec.periods - k, due)
            explanation.append(level_seq)
        elif balance:
            explanation.append(
                ledger.explain(
                    due,
                    "reduce_term",
                    "early_repayment.recalculation",
                    kept_amount_minor=level_amount,
                )
            )
        ledger.row(
            due,
            "prepayment",
            explanation=explanation,
            label=f"{p.basis}_payment",
            payment_kind=p.kind,
            amount_minor=amount,
            fee_minor=fee,
            principal_minor=to_principal,
            overpayment_minor=overpay,
            closing_principal_minor=balance,
        )

    return {
        "currency": spec.currency,
        "opening": {
            "date": op.date.isoformat(),
            "basis": op.basis,
            "principal_minor": op.principal,
            "interest_due_minor": 0,
            "fees_due_minor": 0,
            "total_minor": op.principal,
        },
        "closing": {
            "date": spec.end.isoformat(),
            "principal_minor": balance,
            # A period-rate model defines interest per period, not per day:
            # interest between the last due date and the horizon is not stated.
            "interest_since_last_due_minor": None,
            "loan_closed": balance == 0,
            "nature": "calculated",
            "derived_from": f"{op.basis}_opening",
        },
        "totals": totals,
    }
