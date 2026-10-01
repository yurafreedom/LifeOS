"""Model ``daily_accrual``: fixed contractual daily (or annual + day-count) interest.

Supported, all by explicit input:
* interest on the **outstanding principal** only (no capitalisation);
* first accrual day: the opening day or the day after it; accrual runs through
  the horizon end date inclusive;
* ``payment_effect``: ``same_day`` (a payment on D reduces the balance before
  D accrues) or ``next_day`` (D accrues on the pre-payment balance);
* rounding of interest per day, or exact accrual rounded at posting points
  (each payment day before allocation, and the horizon end);
* one-off and periodic fees (fixed or percent of opening/outstanding principal);
* payments allocated in the contractual order of fees / interest / principal;
  partial and full early repayment with a ``none`` or ``fixed`` fee;
  overpayment is recorded, never turned into negative principal.

Same-day order (fixed, reproducible): next_day accrual → fees (input order) →
posting → payments (input order) → same_day accrual.

Never applied: penalties, legal caps, variable rates, capitalisation, business-day
shifts. Disclosed APR / total-cost metrics are refused as accrual inputs.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from app.services.finance.calc.contracts import (
    ALLOCATION_IGNORED,
    BALANCE_BASES,
    FIRST_ACCRUAL_DAYS,
    KNOWN_UNSUPPORTED_BALANCE_BASES,
    LOAN_COMPONENTS,
    MAX_EVENTS,
    PAYMENT_EFFECTS,
    PAYMENT_KINDS,
)
from app.services.finance.calc.ledger import Ledger, Segments
from app.services.finance.calc.numbers import ONE_DAY, ZERO, Rate, round_minor
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
    "balance_basis",
    "accrual",
    "rounding",
    "fees",
    "allocation",
    "payments",
    "early_repayment",
    "penalties",
)


@dataclass(frozen=True)
class DailySpec:
    currency: str
    opening: Opening
    end: date
    rate: Rate
    first_day: str
    payment_effect: str
    rounding: Rounding
    fees: tuple[FeeRule, ...]
    allocation: tuple[str, ...]
    payments: tuple[Payment, ...]
    early_fee: int


def parse(reader: Reader, doc: dict[str, Any]) -> DailySpec | None:
    issues = reader.issues
    reader.known_keys(doc, "", TOP_KEYS)
    cur = currency(reader, doc)
    op = opening(reader, doc)
    end = horizon_end(reader, doc, op.date if op else None)
    rt, _ = rate(reader, doc, periods=("day", "year"))
    basis = reader.choice(
        doc, "balance_basis", "", BALANCE_BASES, known_unsupported=KNOWN_UNSUPPORTED_BALANCE_BASES
    )
    accrual = reader.section(doc, "accrual", "")
    reader.known_keys(accrual, "accrual", ("first_day", "payment_effect"))
    first_day = reader.choice(accrual, "first_day", "accrual", FIRST_ACCRUAL_DAYS)
    effect = reader.choice(accrual, "payment_effect", "accrual", PAYMENT_EFFECTS)
    rnd = rounding(reader, doc, staged=True)
    fee_rules = fees(reader, doc)
    allocation = reader.choice_list(
        doc, "allocation", "", LOAN_COMPONENTS, ignored=ALLOCATION_IGNORED
    )
    if allocation is not None and set(allocation) != set(LOAN_COMPONENTS):
        issues.error("allocation", "allocation_must_order_fees_interest_principal")
    pays = payments(reader, doc, "payments", PAYMENT_KINDS)
    early, _ = early_fee(reader, doc, any(p.kind != "regular" for p in pays))
    penalties(reader, doc)

    kept: list[Payment] = []
    if op is not None and end is not None:
        for p in pays:
            if p.date < op.date:
                issues.error(f"payments[{p.index}].date", "payment_before_opening")
            elif p.date > end:
                issues.not_applied.append(
                    {
                        "path": f"payments[{p.index}]",
                        "code": "after_horizon",
                        "value": p.date.isoformat(),
                    }
                )
            else:
                kept.append(p)
        for rule in fee_rules:
            start = rule.on or rule.first
            if start < op.date:
                issues.error(f"{rule.path}", "fee_before_opening")
    if None in (cur, op, end, rt, basis, first_day, effect, rnd, allocation):
        return None
    return DailySpec(
        cur,
        op,
        end,
        rt,
        first_day,
        effect,
        rnd,
        tuple(fee_rules),
        allocation,
        tuple(kept),
        early or 0,
    )


class DailyRun:
    def __init__(self, spec: DailySpec, ledger: Ledger, issues: Issues) -> None:
        self.s = spec
        self.ledger = ledger
        self.issues = issues
        op = spec.opening
        self.principal = op.principal
        self.interest_due = op.interest_due
        self.fees_due = op.fees_due
        self.residual = ZERO
        self.closed = False
        self.segments = Segments(ledger, "interest", "base_principal_minor")
        self.totals = {
            "interest_charged_minor": 0,
            "fees_assessed_minor": 0,
            "payments_minor": 0,
            "allocated_minor": {"fees": 0, "interest": 0, "principal": 0},
            "overpayment_minor": 0,
        }

    # ── helpers ──
    def _round(self, value: Decimal) -> int:
        return round_minor(value, self.s.rounding.step, self.s.rounding.mode)

    def _balances(self) -> dict[str, int]:
        return {
            "principal_minor": self.principal,
            "interest_due_minor": self.interest_due,
            "fees_due_minor": self.fees_due,
        }

    def _open(self) -> None:
        op = self.s.opening
        seq = self.ledger.explain(op.date, "opening", "opening", basis=op.basis, **self._balances())
        self.ledger.row(
            op.date,
            "opening",
            explanation=[seq],
            label=f"{op.basis}_opening",
            balances_after=self._balances(),
        )

    def accrue(self, day: date) -> None:
        if self.principal == 0:
            return
        daily_rate = self.s.rate.daily(day)
        exact = Decimal(self.principal) * daily_rate
        if self.s.rounding.stage == "daily":
            amount = self._round(exact)
            self.interest_due += amount
            self.totals["interest_charged_minor"] += amount
            self.segments.add(day, self.principal, daily_rate, amount, exact)
        else:
            self.residual += exact
            self.segments.add(day, self.principal, daily_rate, None, exact)

    def post(self, day: date, reason: str) -> None:
        if self.s.rounding.stage != "at_posting" or self.residual == 0:
            return
        self.segments.flush()
        amount = self._round(self.residual)
        seq = self.ledger.explain(
            day,
            "interest_posted",
            "rounding",
            amount_minor=amount,
            exact=self.residual,
            reason=reason,
            mode=self.s.rounding.mode,
            step_minor=self.s.rounding.step,
        )
        self.interest_due += amount
        self.totals["interest_charged_minor"] += amount
        self.ledger.row(
            day,
            "interest_posted",
            explanation=[seq],
            interest_exact=self.residual,
            amount_minor=amount,
            reason=reason,
            balances_after=self._balances(),
        )
        self.residual = ZERO

    def assess(self, rule: FeeRule, day: date) -> None:
        if rule.until_closure and self.closed:
            self.ledger.explain(day, "fee_not_assessed_loan_closed", rule.path, fee_id=rule.id)
            return
        if rule.amount is not None:
            amount, inputs = rule.amount, {"fixed_amount_minor": rule.amount}
        else:
            base = self.s.opening.principal if rule.base == "opening_principal" else self.principal
            amount = self._round(Decimal(base) * rule.rate)
            inputs = {"base": rule.base, "base_minor": base, "rate_fraction": rule.rate}
        if amount == 0:
            self.ledger.explain(day, "fee_zero", rule.path, fee_id=rule.id, **inputs)
            return
        self.fees_due += amount
        self.totals["fees_assessed_minor"] += amount
        seq = self.ledger.explain(
            day,
            "fee_assessed",
            rule.path,
            amount_minor=amount,
            fee_id=rule.id,
            kind=rule.kind,
            **inputs,
        )
        self.ledger.row(
            day,
            "fee",
            explanation=[seq],
            fee_id=rule.id,
            amount_minor=amount,
            balances_after=self._balances(),
        )

    def pay(self, p: Payment) -> None:
        day = p.date
        path = f"payments[{p.index}]"
        explanation = []
        if p.kind != "regular" and self.s.early_fee and not self.closed:
            self.fees_due += self.s.early_fee
            self.totals["fees_assessed_minor"] += self.s.early_fee
            seq = self.ledger.explain(
                day, "early_repayment_fee", "early_repayment.fee", amount_minor=self.s.early_fee
            )
            self.ledger.row(
                day,
                "fee",
                explanation=[seq],
                fee_id="early_repayment",
                amount_minor=self.s.early_fee,
                balances_after=self._balances(),
            )
        if p.kind == "early_full":
            amount = self.fees_due + self.interest_due + self.principal
            explanation.append(
                self.ledger.explain(
                    day, "payoff_amount", path, amount_minor=amount, **self._balances()
                )
            )
        else:
            amount = p.amount
        remaining = amount
        allocated = {}
        for component in self.s.allocation:
            attr = {"fees": "fees_due", "interest": "interest_due", "principal": "principal"}[
                component
            ]
            take = min(remaining, getattr(self, attr))
            setattr(self, attr, getattr(self, attr) - take)
            allocated[component] = take
            remaining -= take
            self.totals["allocated_minor"][component] += take
        explanation.append(
            self.ledger.explain(
                day,
                "payment_allocated",
                "allocation",
                amount_minor=amount,
                order=list(self.s.allocation),
                allocated=allocated,
                overpayment_minor=remaining,
            )
        )
        if remaining:
            explanation.append(
                self.ledger.explain(day, "overpayment", path, amount_minor=remaining)
            )
        self.totals["payments_minor"] += amount
        self.totals["overpayment_minor"] += remaining
        if not self.closed and self.principal == self.interest_due == self.fees_due == 0:
            self.closed = True
            explanation.append(self.ledger.explain(day, "loan_closed", path))
        self.ledger.row(
            day,
            "payment",
            explanation=explanation,
            label=f"{p.basis}_payment",
            payment_kind=p.kind,
            amount_minor=amount,
            allocated_minor=allocated,
            overpayment_minor=remaining,
            balances_after=self._balances(),
        )

    def run(self) -> None:
        s = self.s
        fees_on: dict[date, list[FeeRule]] = defaultdict(list)
        count = 0
        for rule in s.fees:
            for day in rule.dates(s.end):
                fees_on[day].append(rule)
                count += 1
        if count > MAX_EVENTS:
            raise OverflowError("too_many_fee_events")
        pays_on: dict[date, list[Payment]] = defaultdict(list)
        for p in sorted(s.payments, key=lambda item: (item.date, item.index)):
            pays_on[p.date].append(p)

        self._open()
        start = s.opening.date if s.first_day == "opening_day" else s.opening.date + ONE_DAY
        day = s.opening.date
        while day <= s.end:
            accrues = day >= start
            if accrues and s.payment_effect == "next_day":
                self.accrue(day)
            if day in fees_on or day in pays_on:
                self.segments.flush()
            for rule in fees_on.get(day, ()):
                self.assess(rule, day)
            if day in pays_on:
                self.post(day, "payment")
                for p in pays_on[day]:
                    self.pay(p)
            if accrues and s.payment_effect == "same_day":
                self.accrue(day)
            day += ONE_DAY
        self.segments.flush()
        self.post(s.end, "horizon_end")

    def closing(self) -> dict[str, Any]:
        total = self.principal + self.interest_due + self.fees_due
        return {
            "date": self.s.end.isoformat(),
            **self._balances(),
            "total_minor": total,
            "loan_closed": self.closed,
            "nature": "calculated",
            "derived_from": f"{self.s.opening.basis}_opening",
        }


def run(spec: DailySpec, ledger: Ledger, issues: Issues) -> dict[str, Any]:
    loan = DailyRun(spec, ledger, issues)
    loan.run()
    op = spec.opening
    return {
        "currency": spec.currency,
        "opening": {
            "date": op.date.isoformat(),
            "basis": op.basis,
            "principal_minor": op.principal,
            "interest_due_minor": op.interest_due,
            "fees_due_minor": op.fees_due,
            "total_minor": op.principal + op.interest_due + op.fees_due,
        },
        "closing": loan.closing(),
        "totals": loan.totals,
    }
