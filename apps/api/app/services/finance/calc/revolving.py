"""Model ``revolving``: a limited credit-line forecast under fully stated rules.

Nothing about a card is inferred from its product name or APR. A forecast is
computed only when the input states:

* the opening state per bucket (purchases, cash, posted interest, fees), with
  whether the previous statement was paid in full; opening purchases still in
  a grace period are unsupported (their statement history is not representable);
* explicit statement cycles: ``statement_date`` and ``due_date`` per cycle;
* the contractual rate (per day, or per year with a day count) and which
  buckets bear interest (``interest_bearing``);
* the grace rule: ``none``, or ``full_statement_payment`` with eligible
  transaction kinds, whether the previous statement must also have been paid in
  full, the loss policy (``retroactive_from_transaction_date`` |
  ``from_statement_date`` | ``from_due_date``) and when lost-grace interest is
  charged (``due_date`` | ``next_statement``);
* the payment allocation order over fees / interest / cash / purchases
  (within a bucket: oldest transaction first — fixed);
* the minimum-payment formula (percent of the statement balance, floor, plus
  interest and/or fees charged on that statement). If it is absent the forecast
  is still returned but ``partial``, with every minimum shown as unknown.

Day order (fixed): next_day accrual → transactions → fees → payments →
same_day accrual → statement → due-date evaluation. Interest accrued during a
cycle is charged on its statement date. A grace-eligible transaction accrues
"shadow" interest that is charged only if grace is lost under the stated policy.

Never applied: late fees, penalties, limit-exceeded fees, promotional rates,
balance transfers, instalment plans, credit-balance offsets (an overpayment is
held and reported, not applied to later transactions).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from app.services.finance.calc.contracts import (
    GRACE_KINDS,
    GRACE_LOSS_CHARGES,
    GRACE_LOSS_POLICIES,
    INTEREST_BEARING,
    MAX_CYCLES,
    MAX_EVENTS,
    MINIMUM_PLUS,
    OPENING_BASES,
    PAYMENT_BASES,
    PAYMENT_EFFECTS,
    RATE_UNITS,
    REVOLVING_COMPONENTS,
    TRANSACTION_KINDS,
)
from app.services.finance.calc.ledger import Ledger, Segments
from app.services.finance.calc.numbers import ONE_DAY, ZERO, Rate, round_minor
from app.services.finance.calc.reader import Issues, Reader
from app.services.finance.calc.terms import (
    FeeRule,
    Rounding,
    currency,
    fees,
    horizon_end,
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
    "accrual",
    "rounding",
    "interest_bearing",
    "grace",
    "minimum_payment",
    "allocation",
    "cycles",
    "transactions",
    "payments",
    "fees",
    "credit_limit_minor",
    "penalties",
)


@dataclass(frozen=True)
class RevolvingOpening:
    date: date
    basis: str
    purchases: int
    cash: int
    interest_due: int
    fees_due: int
    previous_paid_in_full: bool


@dataclass(frozen=True)
class Grace:
    kind: str
    eligible: tuple[str, ...] = ()
    requires_previous: bool = False
    loss_policy: str | None = None
    loss_charge: str | None = None


@dataclass(frozen=True)
class Minimum:
    fraction: Decimal
    floor: int
    plus: tuple[str, ...]


@dataclass(frozen=True)
class Event:
    index: int
    date: date
    amount: int
    kind: str
    basis: str | None = None


@dataclass(frozen=True)
class RevolvingSpec:
    currency: str
    opening: RevolvingOpening
    end: date
    rate: Rate
    payment_effect: str
    rounding: Rounding
    interest_bearing: tuple[str, ...]
    grace: Grace
    minimum: Minimum | None
    allocation: tuple[str, ...]
    cycles: tuple[tuple[date, date], ...]
    transactions: tuple[Event, ...]
    payments: tuple[Event, ...]
    fees: tuple[FeeRule, ...]
    credit_limit: int | None


def _opening(reader: Reader, doc: dict[str, Any]) -> RevolvingOpening | None:
    section = reader.section(doc, "opening", "")
    keys = (
        "date",
        "basis",
        "purchases_minor",
        "cash_minor",
        "interest_due_minor",
        "fees_due_minor",
        "purchases_in_grace",
        "previous_statement_paid_in_full",
    )
    reader.known_keys(section, "opening", keys)
    day = reader.day(section, "date", "opening")
    basis = reader.choice(section, "basis", "opening", OPENING_BASES)
    amounts = [reader.minor(section, key, "opening") for key in keys[2:6]]
    in_grace = reader.flag(section, "purchases_in_grace", "opening")
    previous = reader.flag(section, "previous_statement_paid_in_full", "opening")
    if in_grace and amounts[0]:
        reader.issues.unsupport("opening.purchases_in_grace", "opening_purchases_in_grace", True)
    if None in (day, basis, in_grace, previous, *amounts):
        return None
    return RevolvingOpening(day, basis, *amounts, previous)


def _grace(reader: Reader, doc: dict[str, Any]) -> Grace | None:
    section = reader.section(doc, "grace", "")
    kind = reader.choice(section, "kind", "grace", GRACE_KINDS)
    if kind == "none":
        reader.known_keys(section, "grace", ("kind",))
        return Grace(kind)
    reader.known_keys(
        section,
        "grace",
        ("kind", "eligible", "requires_previous_paid_in_full", "loss_policy", "loss_charge"),
    )
    eligible = reader.choice_list(section, "eligible", "grace", TRANSACTION_KINDS)
    previous = reader.flag(section, "requires_previous_paid_in_full", "grace")
    policy = reader.choice(section, "loss_policy", "grace", GRACE_LOSS_POLICIES)
    charge = reader.choice(section, "loss_charge", "grace", GRACE_LOSS_CHARGES)
    if None in (kind, eligible, previous, policy, charge):
        return None
    return Grace(kind, eligible, previous, policy, charge)


def _minimum(reader: Reader, doc: dict[str, Any]) -> Minimum | None:
    section = reader.section(doc, "minimum_payment", "", blocking=False)
    if section is None:
        return None
    reader.known_keys(section, "minimum_payment", ("percent", "of", "floor_minor", "plus"))
    pct = reader.section(section, "percent", "minimum_payment", blocking=False)
    reader.known_keys(pct, "minimum_payment.percent", ("value", "unit"))
    value = reader.decimal(pct, "value", "minimum_payment.percent", blocking=False)
    unit = reader.choice(pct, "unit", "minimum_payment.percent", tuple(RATE_UNITS), blocking=False)
    reader.choice(section, "of", "minimum_payment", ("statement_balance",), blocking=False)
    floor = reader.minor(section, "floor_minor", "minimum_payment", blocking=False)
    plus = reader.choice_list(section, "plus", "minimum_payment", MINIMUM_PLUS, blocking=False)
    if None in (value, unit, floor, plus) or section.get("of") != "statement_balance":
        return None
    return Minimum(value / Decimal(RATE_UNITS[unit]), floor, plus)


def _events(
    reader: Reader, doc: dict[str, Any], key: str, kinds: tuple[str, ...] | None
) -> list[Event]:
    result = []
    for index, raw in enumerate(reader.items(doc, key, "")):
        path = f"{key}[{index}]"
        if not isinstance(raw, dict):
            reader.issues.error(path, "object_expected")
            continue
        reader.known_keys(
            raw,
            path,
            ("date", "amount_minor", "kind") if kinds else ("date", "amount_minor", "basis"),
        )
        day = reader.day(raw, "date", path)
        amount = reader.minor(raw, "amount_minor", path, positive=True)
        if kinds:
            kind = reader.choice(raw, "kind", path, kinds)
            basis = None
        else:
            kind = "payment"
            basis = reader.choice(raw, "basis", path, PAYMENT_BASES)
            if basis is None:
                continue
        if None in (day, amount, kind):
            continue
        result.append(Event(index, day, amount, kind, basis))
    if len(result) > MAX_EVENTS:
        reader.issues.error(key, "too_many_events")
    return result


def parse(reader: Reader, doc: dict[str, Any]) -> RevolvingSpec | None:
    issues = reader.issues
    reader.known_keys(doc, "", TOP_KEYS)
    cur = currency(reader, doc)
    op = _opening(reader, doc)
    end = horizon_end(reader, doc, op.date if op else None)
    rt, _ = rate(reader, doc, periods=("day", "year"))
    accrual = reader.section(doc, "accrual", "")
    reader.known_keys(accrual, "accrual", ("payment_effect",))
    effect = reader.choice(accrual, "payment_effect", "accrual", PAYMENT_EFFECTS)
    rnd = rounding(reader, doc, staged=True)
    bearing = reader.choice_list(doc, "interest_bearing", "", INTEREST_BEARING)
    grace = _grace(reader, doc)
    minimum = _minimum(reader, doc)
    allocation = reader.choice_list(doc, "allocation", "", REVOLVING_COMPONENTS)
    if allocation is not None and set(allocation) != set(REVOLVING_COMPONENTS):
        issues.error("allocation", "allocation_must_order_every_bucket")
    limit = reader.minor(doc, "credit_limit_minor", "", required=False)
    fee_rules = fees(reader, doc, kinds=("one_off", "periodic_fixed"))
    for rule in list(fee_rules):
        if rule.until_closure:
            issues.unsupport(
                f"{rule.path}.schedule.until", "loan_closure_in_revolving_model", blocking=False
            )
            fee_rules.remove(rule)
    penalties(reader, doc)

    cycles: list[tuple[date, date]] = []
    raw_cycles = reader.items(doc, "cycles", "", required=True)
    if len(raw_cycles) > MAX_CYCLES:
        issues.error("cycles", "too_many_cycles")
    for index, raw in enumerate(raw_cycles):
        path = f"cycles[{index}]"
        if not isinstance(raw, dict):
            issues.error(path, "object_expected")
            continue
        reader.known_keys(raw, path, ("statement_date", "due_date"))
        statement = reader.day(raw, "statement_date", path)
        due = reader.day(raw, "due_date", path)
        if statement is not None and due is not None:
            cycles.append((statement, due))
    if raw_cycles and len(cycles) == len(raw_cycles) and op is not None:
        previous = op.date
        for index, (statement, due) in enumerate(cycles):
            if statement <= previous:
                issues.error(
                    f"cycles[{index}].statement_date", "statements_must_increase_after_opening"
                )
            if due <= statement:
                issues.error(f"cycles[{index}].due_date", "due_date_not_after_statement")
            if index + 1 < len(cycles) and due >= cycles[index + 1][0]:
                issues.error(f"cycles[{index}].due_date", "due_date_not_before_next_statement")
            previous = statement
    elif not raw_cycles:
        issues.miss("cycles")

    transactions = _events(reader, doc, "transactions", TRANSACTION_KINDS)
    pays = _events(reader, doc, "payments", None)
    if op is not None and end is not None:
        for key, events in (("transactions", transactions), ("payments", pays)):
            for event in list(events):
                if event.date <= op.date:
                    issues.error(f"{key}[{event.index}].date", "event_on_or_before_opening")
                elif event.date > end:
                    issues.not_applied.append(
                        {
                            "path": f"{key}[{event.index}]",
                            "code": "after_horizon",
                            "value": event.date.isoformat(),
                        }
                    )
                    events.remove(event)
        for rule in fee_rules:
            if (rule.on or rule.first) <= op.date:
                issues.error(rule.path, "event_on_or_before_opening")
    if None in (cur, op, end, rt, effect, rnd, bearing, grace, allocation) or not cycles:
        return None
    return RevolvingSpec(
        cur,
        op,
        end,
        rt,
        effect,
        rnd,
        bearing,
        grace,
        minimum,
        allocation,
        tuple(cycles),
        tuple(transactions),
        tuple(pays),
        tuple(fee_rules),
        limit,
    )


@dataclass
class Lot:
    id: str
    date: date
    kind: str
    remaining: int
    cycle: int | None  # index of the statement the transaction appears on
    grace_pending: bool
    shadow_pre: Decimal = ZERO  # grace-period interest through the statement date
    shadow_post: Decimal = ZERO  # … after the statement date through the due date


@dataclass
class Statement:
    index: int
    date: date
    due: date
    balance: int
    minimum: int | None
    paid: int = 0
    paid_in_full: bool | None = None
    lots: list[str] = field(default_factory=list)


class RevolvingRun:
    def __init__(self, spec: RevolvingSpec, ledger: Ledger, issues: Issues) -> None:
        self.s = spec
        self.ledger = ledger
        self.issues = issues
        op = spec.opening
        self.lots: list[Lot] = []
        if op.purchases:
            self.lots.append(
                Lot("opening.purchases", op.date, "purchase", op.purchases, None, False)
            )
        if op.cash:
            self.lots.append(Lot("opening.cash", op.date, "cash_withdrawal", op.cash, None, False))
        self.interest_due = op.interest_due
        self.fees_due = op.fees_due
        self.accrued = ZERO  # real interest accrued in the current cycle, not yet charged
        self.pending_retro = 0  # lost-grace interest waiting for the next statement
        self.held_overpayment = 0
        self.statements: list[Statement] = []
        self.fees_in_cycle = 0
        self.segments = Segments(ledger, "interest", "interest_bearing_minor")
        self.totals = {
            "purchases_minor": 0,
            "cash_withdrawals_minor": 0,
            "payments_minor": 0,
            "interest_charged_minor": 0,
            "grace_interest_charged_minor": 0,
            "fees_assessed_minor": 0,
            "overpayment_minor": 0,
            "allocated_minor": {name: 0 for name in REVOLVING_COMPONENTS},
        }

    def _round(self, value: Decimal) -> int:
        return round_minor(value, self.s.rounding.step, self.s.rounding.mode)

    def _bucket(self, kind: str) -> int:
        return sum(lot.remaining for lot in self.lots if lot.kind == kind)

    def balances(self) -> dict[str, int]:
        purchases = self._bucket("purchase")
        cash = self._bucket("cash_withdrawal")
        return {
            "purchases_minor": purchases,
            "cash_minor": cash,
            "interest_due_minor": self.interest_due,
            "fees_due_minor": self.fees_due,
            "total_minor": purchases + cash + self.interest_due + self.fees_due,
        }

    def _cycle_of(self, day: date) -> int | None:
        for index, (statement, _) in enumerate(self.s.cycles):
            if day <= statement:
                return index
        return None

    def interest_base(self) -> int:
        bearing = self.s.interest_bearing
        base = 0
        for lot in self.lots:
            if lot.grace_pending:
                continue
            if lot.kind == "purchase" and "purchases_out_of_grace" in bearing:
                base += lot.remaining
            if lot.kind == "cash_withdrawal" and "cash" in bearing:
                base += lot.remaining
        if "posted_interest" in bearing:
            base += self.interest_due
        if "fees" in bearing:
            base += self.fees_due
        return base

    def accrue(self, day: date) -> None:
        daily_rate = self.s.rate.daily(day)
        daily = self.s.rounding.stage == "daily"
        base = self.interest_base()
        if base:
            exact = Decimal(base) * daily_rate
            amount = self._round(exact) if daily else None
            self.accrued += Decimal(amount) if daily else exact
            self.segments.add(day, base, daily_rate, amount, exact)
        for lot in self.lots:
            if not lot.grace_pending or not lot.remaining:
                continue
            exact = Decimal(lot.remaining) * daily_rate
            value = Decimal(self._round(exact)) if daily else exact
            statement = self.s.cycles[lot.cycle][0] if lot.cycle is not None else None
            if statement is None or day <= statement:
                lot.shadow_pre += value
            else:
                lot.shadow_post += value

    def transaction(self, event: Event) -> None:
        grace = self.s.grace
        pending = grace.kind != "none" and event.kind in grace.eligible
        lot = Lot(
            f"transactions[{event.index}]",
            event.date,
            event.kind,
            event.amount,
            self._cycle_of(event.date),
            pending,
        )
        self.lots.append(lot)
        key = "purchases_minor" if event.kind == "purchase" else "cash_withdrawals_minor"
        self.totals[key] += event.amount
        seq = self.ledger.explain(
            event.date,
            "transaction",
            lot.id,
            amount_minor=event.amount,
            kind=event.kind,
            grace_pending=pending,
        )
        self.ledger.row(
            event.date,
            "transaction",
            explanation=[seq],
            transaction_kind=event.kind,
            amount_minor=event.amount,
            grace_pending=pending,
            balances_after=self.balances(),
        )

    def fee(self, rule: FeeRule, day: date) -> None:
        self.fees_due += rule.amount
        self.fees_in_cycle += rule.amount
        self.totals["fees_assessed_minor"] += rule.amount
        seq = self.ledger.explain(
            day, "fee_assessed", rule.path, amount_minor=rule.amount, fee_id=rule.id
        )
        self.ledger.row(
            day,
            "fee",
            explanation=[seq],
            fee_id=rule.id,
            amount_minor=rule.amount,
            balances_after=self.balances(),
        )

    def pay(self, event: Event) -> None:
        remaining = event.amount
        allocated = {}
        for component in self.s.allocation:
            take = 0
            if component == "fees":
                take = min(remaining, self.fees_due)
                self.fees_due -= take
            elif component == "interest":
                take = min(remaining, self.interest_due)
                self.interest_due -= take
            else:
                kind = "cash_withdrawal" if component == "cash" else "purchase"
                # Oldest first: ``self.lots`` is kept in transaction order (date, then input order).
                for lot in self.lots:
                    if lot.kind != kind or not remaining - take:
                        continue
                    part = min(remaining - take, lot.remaining)
                    lot.remaining -= part
                    take += part
            allocated[component] = take
            remaining -= take
            self.totals["allocated_minor"][component] += take
        self.held_overpayment += remaining
        self.totals["payments_minor"] += event.amount
        self.totals["overpayment_minor"] += remaining
        for statement in self.statements:
            if statement.date < event.date <= statement.due:
                statement.paid += event.amount
        if remaining:
            self.issues.limit("overpayment_held_not_applied")
        seq = self.ledger.explain(
            event.date,
            "payment_allocated",
            "allocation",
            amount_minor=event.amount,
            order=list(self.s.allocation),
            allocated=allocated,
            overpayment_minor=remaining,
        )
        self.ledger.row(
            event.date,
            "payment",
            explanation=[seq],
            label=f"{event.basis}_payment",
            amount_minor=event.amount,
            allocated_minor=allocated,
            overpayment_minor=remaining,
            balances_after=self.balances(),
        )

    def statement(self, index: int, day: date, due: date) -> None:
        self.segments.flush()
        charged = self._round(self.accrued)
        explanation = [
            self.ledger.explain(
                day,
                "interest_charged",
                "rounding",
                amount_minor=charged,
                accrued=self.accrued,
                stage=self.s.rounding.stage,
            )
        ]
        self.accrued = ZERO
        self.interest_due += charged
        self.totals["interest_charged_minor"] += charged
        retro = self.pending_retro
        if retro:
            self.interest_due += retro
            explanation.append(
                self.ledger.explain(
                    day, "grace_interest_charged", "grace.loss_charge", amount_minor=retro
                )
            )
            self.pending_retro = 0
        balance = self.balances()["total_minor"]
        minimum = None
        if self.s.minimum is not None:
            m = self.s.minimum
            percent = self._round(Decimal(balance) * m.fraction)
            minimum = max(m.floor, percent)
            if "interest" in m.plus:
                minimum += charged + retro
            if "fees" in m.plus:
                minimum += self.fees_in_cycle
            minimum = min(minimum, balance)
            explanation.append(
                self.ledger.explain(
                    day,
                    "minimum_payment",
                    "minimum_payment",
                    amount_minor=minimum,
                    balance_minor=balance,
                    percent_amount_minor=percent,
                    floor_minor=m.floor,
                    plus=list(m.plus),
                    interest_charged_minor=charged + retro,
                    fees_in_cycle_minor=self.fees_in_cycle,
                )
            )
        else:
            self.issues.limit("minimum_payment_unknown")
        self.fees_in_cycle = 0
        record = Statement(
            index,
            day,
            due,
            balance,
            minimum,
            lots=[lot.id for lot in self.lots if lot.cycle == index and lot.grace_pending],
        )
        self.statements.append(record)
        self.ledger.row(
            day,
            "statement",
            explanation=explanation,
            cycle=index,
            interest_charged_minor=charged + retro,
            statement_balance_minor=balance,
            minimum_due_minor=minimum,
            due_date=due,
            balances_after=self.balances(),
        )

    def due(self, record: Statement) -> None:
        self.segments.flush()
        day = record.due
        grace = self.s.grace
        full = record.paid >= record.balance
        record.paid_in_full = full
        previous = (
            self.statements[record.index - 1].paid_in_full
            if record.index > 0
            else self.s.opening.previous_paid_in_full
        )
        keep = full and (previous or not grace.requires_previous)
        minimum_met = None if record.minimum is None else record.paid >= record.minimum
        explanation = [
            self.ledger.explain(
                day,
                "due_evaluation",
                "grace",
                paid_minor=record.paid,
                statement_balance_minor=record.balance,
                paid_in_full=full,
                previous_paid_in_full=previous,
                requires_previous=grace.requires_previous,
                minimum_due_minor=record.minimum,
                minimum_met=minimum_met,
            )
        ]
        if minimum_met is False:
            self.issues.not_applied.append(
                {
                    "path": f"cycles[{record.index}]",
                    "code": "late_payment_consequences_not_applied",
                    "value": day.isoformat(),
                }
            )
            self.issues.limit("assumes_no_late_payment_consequences")
        retro_total = 0
        for lot in self.lots:
            if lot.id not in record.lots:
                continue
            lot.grace_pending = False
            if keep:
                explanation.append(
                    self.ledger.explain(
                        day, "grace_kept", lot.id, discarded_exact=lot.shadow_pre + lot.shadow_post
                    )
                )
                continue
            policy = grace.loss_policy
            exact = (
                lot.shadow_pre + lot.shadow_post
                if policy == "retroactive_from_transaction_date"
                else lot.shadow_post
                if policy == "from_statement_date"
                else ZERO
            )
            amount = self._round(exact)
            retro_total += amount
            explanation.append(
                self.ledger.explain(
                    day, "grace_lost", lot.id, amount_minor=amount, policy=policy, exact=exact
                )
            )
        if retro_total:
            self.totals["grace_interest_charged_minor"] += retro_total
            self.totals["interest_charged_minor"] += retro_total
            if grace.loss_charge == "due_date":
                self.interest_due += retro_total
            else:
                self.pending_retro += retro_total
        self.ledger.row(
            day,
            "due_evaluation",
            explanation=explanation,
            cycle=record.index,
            paid_minor=record.paid,
            paid_in_full=full,
            minimum_met=minimum_met,
            grace_kept=keep if record.lots else None,
            grace_interest_minor=retro_total,
            balances_after=self.balances(),
        )

    def run(self) -> None:
        s = self.s
        by_day: dict[date, dict[str, list[Any]]] = defaultdict(lambda: defaultdict(list))
        for event in sorted(s.transactions, key=lambda item: item.index):
            by_day[event.date]["transactions"].append(event)
        for event in sorted(s.payments, key=lambda item: item.index):
            by_day[event.date]["payments"].append(event)
        count = 0
        for rule in s.fees:
            for day in rule.dates(s.end):
                by_day[day]["fees"].append(rule)
                count += 1
        if count > MAX_EVENTS:
            raise OverflowError("too_many_fee_events")
        statements = {statement: index for index, (statement, _) in enumerate(s.cycles)}
        seq = self.ledger.explain(
            s.opening.date,
            "opening",
            "opening",
            basis=s.opening.basis,
            previous_paid_in_full=s.opening.previous_paid_in_full,
            **self.balances(),
        )
        self.ledger.row(
            s.opening.date,
            "opening",
            explanation=[seq],
            label=f"{s.opening.basis}_opening",
            balances_after=self.balances(),
        )
        day = s.opening.date + ONE_DAY
        while day <= s.end:
            events = by_day.get(day, {})
            if s.payment_effect == "next_day":
                self.accrue(day)
            if events:
                self.segments.flush()
            for event in events.get("transactions", ()):
                self.transaction(event)
            for rule in events.get("fees", ()):
                self.fee(rule, day)
            for event in events.get("payments", ()):
                self.pay(event)
            if s.payment_effect == "same_day":
                self.accrue(day)
            if day in statements:
                index = statements[day]
                self.statement(index, day, s.cycles[index][1])
            for record in self.statements:
                if record.due == day:
                    self.due(record)
            self.lots = [lot for lot in self.lots if lot.remaining or lot.grace_pending]
            day += ONE_DAY
        self.segments.flush()

    def closing(self) -> dict[str, Any]:
        s = self.s
        contingent = sum(
            (lot.shadow_pre + lot.shadow_post for lot in self.lots if lot.grace_pending), ZERO
        )
        if any(record.due > s.end for record in self.statements) or contingent:
            self.issues.limit("grace_outcome_beyond_horizon")
        balances = self.balances()
        closing = {
            "date": s.end.isoformat(),
            **balances,
            "accrued_not_yet_charged_minor": self._round(self.accrued),
            "grace_interest_pending_minor": self.pending_retro,
            "contingent_grace_interest_minor": self._round(contingent),
            "overpayment_held_minor": self.held_overpayment,
            "nature": "calculated",
            "derived_from": f"{s.opening.basis}_opening",
        }
        if s.credit_limit is not None:
            closing["available_credit_calculated_minor"] = s.credit_limit - balances["total_minor"]
        return closing


def run(spec: RevolvingSpec, ledger: Ledger, issues: Issues) -> dict[str, Any]:
    card = RevolvingRun(spec, ledger, issues)
    op = spec.opening
    opening = {
        "date": op.date.isoformat(),
        "basis": op.basis,
        **card.balances(),
        "previous_statement_paid_in_full": op.previous_paid_in_full,
    }
    card.run()
    return {
        "currency": spec.currency,
        "opening": opening,
        "closing": card.closing(),
        "totals": card.totals,
    }
