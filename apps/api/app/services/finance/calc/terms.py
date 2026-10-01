"""Parsers for the term blocks shared by several models.

Each parser returns a frozen value object or ``None``; problems are recorded on
the reader's ``Issues``. No parser supplies a default for a contractual rule.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from app.services.finance.calc.contracts import (
    CONTRACTUAL_RATE,
    DAY_COUNTS,
    DISCLOSED_METRICS,
    EARLY_FEE_KINDS,
    FEE_BASES,
    FEE_KINDS,
    INTEREST_STAGES,
    KNOWN_UNSUPPORTED_DAY_COUNTS,
    KNOWN_UNSUPPORTED_EARLY_FEES,
    KNOWN_UNSUPPORTED_RATE_KINDS,
    LOAN_CLOSURE,
    MAX_EVENTS,
    MAX_HORIZON_DAYS,
    MAX_STEP_MINOR,
    OPENING_BASES,
    PAYMENT_BASES,
    RATE_KINDS,
    RATE_PERIODS,
    RATE_UNITS,
    ROUNDING_MODES,
)
from app.services.finance.calc.numbers import Rate, is_on_anchor, monthly_date
from app.services.finance.calc.reader import Reader

CURRENCY_LETTERS = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


@dataclass(frozen=True)
class Opening:
    date: date
    basis: str
    principal: int
    interest_due: int
    fees_due: int


@dataclass(frozen=True)
class Rounding:
    mode: str
    step: int
    stage: str | None


@dataclass(frozen=True)
class FeeRule:
    id: str
    kind: str
    path: str
    amount: int | None = None
    rate: Decimal | None = None
    base: str | None = None
    on: date | None = None
    first: date | None = None
    every_months: int | None = None
    anchor_day: int | None = None
    until: date | None = None
    until_closure: bool = False

    def dates(self, end: date) -> list[date]:
        if self.on is not None:
            return [self.on] if self.on <= end else []
        last = end if self.until is None else min(end, self.until)
        result = []
        k = 0
        while len(result) <= MAX_EVENTS:
            day = monthly_date(self.first, self.anchor_day, k * self.every_months)
            if day > last:
                break
            result.append(day)
            k += 1
        return result


@dataclass(frozen=True)
class Payment:
    index: int
    date: date
    amount: int | None
    kind: str
    basis: str


def currency(reader: Reader, doc: dict[str, Any]) -> str | None:
    value = reader.text(doc, "currency", "", max_length=3)
    if value is not None and (len(value) != 3 or not set(value) <= CURRENCY_LETTERS):
        reader.issues.error("currency", "iso_4217_code_expected")
        return None
    return value


def horizon_end(reader: Reader, doc: dict[str, Any], start: date | None) -> date | None:
    section = reader.section(doc, "horizon", "")
    reader.known_keys(section, "horizon", ("end_date",))
    end = reader.day(section, "end_date", "horizon")
    if end is not None and start is not None:
        if end < start:
            reader.issues.error("horizon.end_date", "horizon_before_opening")
            return None
        if (end - start).days > MAX_HORIZON_DAYS:
            reader.issues.error("horizon.end_date", "horizon_exceeds_limit")
            return None
    return end


def opening(reader: Reader, doc: dict[str, Any], *, allow_due: bool = True) -> Opening | None:
    section = reader.section(doc, "opening", "")
    reader.known_keys(
        section,
        "opening",
        ("date", "basis", "principal_minor", "interest_due_minor", "fees_due_minor"),
    )
    day = reader.day(section, "date", "opening")
    basis = reader.choice(section, "basis", "opening", OPENING_BASES)
    principal = reader.minor(section, "principal_minor", "opening")
    # A disbursement has nothing accrued by definition; any other opening states it explicitly.
    needs_due = basis is not None and basis != "contractual_disbursement"
    interest_due = reader.minor(section, "interest_due_minor", "opening", required=needs_due)
    fees_due = reader.minor(section, "fees_due_minor", "opening", required=needs_due)
    if basis == "contractual_disbursement" and (interest_due or fees_due):
        reader.issues.error("opening", "disbursement_cannot_carry_dues")
    if not allow_due and (interest_due or fees_due):
        reader.issues.unsupport("opening", "opening_dues_in_period_model", blocking=True)
    if None in (day, basis, principal):
        return None
    return Opening(day, basis, principal, interest_due or 0, fees_due or 0)


def rate(
    reader: Reader,
    doc: dict[str, Any],
    *,
    periods: tuple[str, ...] = RATE_PERIODS,
    day_count_for_year: bool = True,
    extra_keys: tuple[str, ...] = (),
) -> tuple[Rate | None, dict[str, Any] | None]:
    """The contractual rate. Disclosed metrics (APR, real annual cost …) are refused by name.

    Daily-accruing models need a day count for an annual rate; period models
    declare their own period-rate rule instead (``day_count_for_year=False``).
    """
    section = reader.section(doc, "interest", "")
    keys = ("source_metric", "kind", "value", "unit", "per", *extra_keys)
    reader.known_keys(section, "interest", (*keys, "day_count") if day_count_for_year else keys)
    metric = reader.choice(
        section,
        "source_metric",
        "interest",
        (CONTRACTUAL_RATE,),
        known_unsupported=DISCLOSED_METRICS,
    )
    kind = reader.choice(
        section, "kind", "interest", RATE_KINDS, known_unsupported=KNOWN_UNSUPPORTED_RATE_KINDS
    )
    value = reader.decimal(section, "value", "interest")
    unit = reader.choice(section, "unit", "interest", tuple(RATE_UNITS))
    per = reader.choice(section, "per", "interest", RATE_PERIODS)
    if per is not None and per not in periods:
        reader.issues.unsupport("interest.per", f"rate_per_{per}_in_this_model", per)
        per = None
    day_count = None
    if per == "year" and day_count_for_year:
        day_count = reader.choice(
            section,
            "day_count",
            "interest",
            DAY_COUNTS,
            known_unsupported=KNOWN_UNSUPPORTED_DAY_COUNTS,
        )
        if day_count is None:
            return None, section
    elif section is not None and "day_count" in section and day_count_for_year:
        reader.issues.error("interest.day_count", "day_count_only_for_annual_rates")
    if None in (metric, kind, value, unit, per):
        return None, section
    return Rate(value / Decimal(RATE_UNITS[unit]), per, day_count), section


def rounding(reader: Reader, doc: dict[str, Any], *, staged: bool) -> Rounding | None:
    section = reader.section(doc, "rounding", "")
    keys = ("mode", "step_minor", "interest_stage") if staged else ("mode", "step_minor")
    reader.known_keys(section, "rounding", keys)
    mode = reader.choice(section, "mode", "rounding", ROUNDING_MODES)
    step = reader.integer(section, "step_minor", "rounding", 1, MAX_STEP_MINOR)
    stage = (
        reader.choice(section, "interest_stage", "rounding", INTEREST_STAGES) if staged else None
    )
    if None in (mode, step) or (staged and stage is None):
        return None
    return Rounding(mode, step, stage)


def _fee(reader: Reader, raw: Any, path: str) -> FeeRule | None:
    """One fee rule. Every problem is non-blocking: the fee is excluded and named."""
    issues = reader.issues
    if not isinstance(raw, dict):
        issues.error(path, "object_expected")
        return None
    fee_id = reader.text(raw, "id", path, blocking=False)
    kind = raw.get("kind")
    if kind not in FEE_KINDS:
        issues.unsupport(f"{path}.kind", "unsupported_fee_kind", kind, blocking=False)
        return None
    before = (len(issues.missing), len(issues.unsupported), len(issues.errors))
    common = ("id", "kind")
    rule: FeeRule | None = None
    if kind == "one_off":
        reader.known_keys(raw, path, (*common, "date", "amount_minor"))
        on = reader.day(raw, "date", path, blocking=False)
        amount = reader.minor(raw, "amount_minor", path, blocking=False, positive=True)
        if None not in (fee_id, on, amount):
            rule = FeeRule(fee_id, kind, path, amount=amount, on=on)
    elif kind == "one_off_percent":
        reader.known_keys(raw, path, (*common, "date", "rate", "base"))
        on = reader.day(raw, "date", path, blocking=False)
        fee_rate = _fee_rate(reader, raw, path)
        base = reader.choice(raw, "base", path, ("opening_principal",), blocking=False)
        if None not in (fee_id, on, fee_rate, base):
            rule = FeeRule(fee_id, kind, path, rate=fee_rate, base=base, on=on)
    else:
        extra = ("amount_minor",) if kind == "periodic_fixed" else ("rate", "base")
        reader.known_keys(raw, path, (*common, "schedule", *extra))
        amount = fee_rate = base = None
        if kind == "periodic_fixed":
            amount = reader.minor(raw, "amount_minor", path, blocking=False, positive=True)
        else:
            fee_rate = _fee_rate(reader, raw, path)
            base = reader.choice(raw, "base", path, FEE_BASES, blocking=False)
        schedule = reader.section(raw, "schedule", path, blocking=False)
        spath = f"{path}.schedule"
        reader.known_keys(schedule, spath, ("first_date", "every_months", "anchor_day", "until"))
        first = reader.day(schedule, "first_date", spath, blocking=False)
        every = reader.integer(schedule, "every_months", spath, 1, 12, blocking=False)
        anchor = reader.integer(schedule, "anchor_day", spath, 1, 31, blocking=False)
        until_raw = None if schedule is None else schedule.get("until")
        until = None
        until_closure = until_raw == LOAN_CLOSURE
        if until_raw is None:
            issues.miss(f"{spath}.until", blocking=False)
        elif not until_closure:
            until = reader.day(schedule, "until", spath, blocking=False)
        if first is not None and anchor is not None and not is_on_anchor(first, anchor):
            issues.error(f"{spath}.first_date", "first_date_not_on_anchor_day")
        if (
            None not in (fee_id, first, every, anchor)
            and (until is not None or until_closure)
            and (amount is not None or (fee_rate is not None and base is not None))
        ):
            rule = FeeRule(
                fee_id,
                kind,
                path,
                amount=amount,
                rate=fee_rate,
                base=base,
                first=first,
                every_months=every,
                anchor_day=anchor,
                until=until,
                until_closure=until_closure,
            )
    if rule is None and before == (
        len(issues.missing),
        len(issues.unsupported),
        len(issues.errors),
    ):
        issues.miss(path, blocking=False)
    return rule


def _fee_rate(reader: Reader, raw: dict[str, Any], path: str) -> Decimal | None:
    section = reader.section(raw, "rate", path, blocking=False)
    reader.known_keys(section, f"{path}.rate", ("value", "unit"))
    value = reader.decimal(section, "value", f"{path}.rate", blocking=False)
    unit = reader.choice(section, "unit", f"{path}.rate", tuple(RATE_UNITS), blocking=False)
    if value is None or unit is None:
        return None
    return value / Decimal(RATE_UNITS[unit])


def fees(
    reader: Reader, doc: dict[str, Any], *, kinds: tuple[str, ...] = FEE_KINDS
) -> list[FeeRule]:
    rules: list[FeeRule] = []
    seen: set[str] = set()
    for index, raw in enumerate(reader.items(doc, "fees", "")):
        path = f"fees[{index}]"
        if isinstance(raw, dict) and raw.get("kind") in FEE_KINDS and raw.get("kind") not in kinds:
            reader.issues.unsupport(
                f"{path}.kind", "fee_kind_not_supported_in_model", raw.get("kind"), blocking=False
            )
            continue
        rule = _fee(reader, raw, path)
        if rule is None:
            continue
        if rule.id in seen:
            reader.issues.error(f"{path}.id", "duplicate_fee_id")
            continue
        seen.add(rule.id)
        rules.append(rule)
    return rules


def payments(
    reader: Reader, doc: dict[str, Any], key: str, kinds: tuple[str, ...]
) -> list[Payment]:
    result = []
    for index, raw in enumerate(reader.items(doc, key, "")):
        path = f"{key}[{index}]"
        if not isinstance(raw, dict):
            reader.issues.error(path, "object_expected")
            continue
        reader.known_keys(raw, path, ("date", "amount_minor", "kind", "basis"))
        day = reader.day(raw, "date", path)
        kind = reader.choice(raw, "kind", path, kinds)
        basis = reader.choice(raw, "basis", path, PAYMENT_BASES)
        if kind == "early_full":
            if raw.get("amount_minor") is not None:
                reader.issues.error(f"{path}.amount_minor", "early_full_amount_is_calculated")
            amount = None
        else:
            amount = reader.minor(raw, "amount_minor", path, positive=True)
            if amount is None:
                continue
        if None in (day, kind, basis):
            continue
        result.append(Payment(index, day, amount, kind, basis))
    if len(result) > MAX_EVENTS:
        reader.issues.error(key, "too_many_events")
    return result


def early_fee(reader: Reader, doc: dict[str, Any], needed: bool, *, extra: tuple[str, ...] = ()):
    """``(fee_minor, section)`` for early repayment; required only when an early payment exists."""
    section = reader.section(doc, "early_repayment", "", required=needed)
    reader.known_keys(section, "early_repayment", ("allowed", "fee", *extra))
    if section is None:
        return None, None
    allowed = reader.flag(section, "allowed", "early_repayment")
    fee = reader.section(section, "fee", "early_repayment")
    reader.known_keys(fee, "early_repayment.fee", ("kind", "amount_minor"))
    kind = reader.choice(
        fee,
        "kind",
        "early_repayment.fee",
        EARLY_FEE_KINDS,
        known_unsupported=KNOWN_UNSUPPORTED_EARLY_FEES,
    )
    amount = 0
    if kind == "fixed":
        amount = reader.minor(fee, "amount_minor", "early_repayment.fee")
    if needed and allowed is False:
        reader.issues.error("early_repayment.allowed", "early_repayment_not_allowed_by_terms")
    if allowed is None or kind is None or amount is None:
        return None, section
    return amount, section


def penalties(reader: Reader, doc: dict[str, Any]) -> None:
    """Penalty rules are recorded facts only; the engine never charges them."""
    for index, raw in enumerate(reader.items(doc, "penalties", "")):
        path = f"penalties[{index}]"
        label = raw.get("id") if isinstance(raw, dict) else None
        reader.issues.not_applied.append(
            {
                "path": path,
                "code": "penalty_not_applied",
                "value": label if isinstance(label, str) else None,
            }
        )
        reader.issues.limit("assumes_no_penalty_events")
