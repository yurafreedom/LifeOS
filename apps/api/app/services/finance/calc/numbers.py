"""Exact arithmetic, rounding, calendar and day-count primitives (leaf module).

Money results are integers in minor units; rates and intermediate values are
``Decimal`` built only from decimal text or integers — never from ``float``.
"""

from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import (
    ROUND_DOWN,
    ROUND_HALF_EVEN,
    ROUND_HALF_UP,
    ROUND_UP,
    Context,
    Decimal,
    DivisionByZero,
    InvalidOperation,
    Overflow,
    localcontext,
)

ONE_DAY = timedelta(days=1)
ZERO = Decimal(0)
_ROUNDING = {
    "half_up": ROUND_HALF_UP,
    "half_even": ROUND_HALF_EVEN,
    "down": ROUND_DOWN,
    "up": ROUND_UP,
}
_DECIMAL_TEXT = re.compile(r"^(0|[1-9][0-9]{0,17})(\.[0-9]{1,18})?$")


def calc_context():
    """60 significant digits; any inexact-by-error operation raises instead of drifting."""
    return localcontext(
        Context(
            prec=60, rounding=ROUND_HALF_EVEN, traps=[InvalidOperation, DivisionByZero, Overflow]
        )
    )


def parse_decimal_text(value: str) -> Decimal | None:
    """Plain non-negative decimal text (``"0.05"``); exponents, signs and spaces are refused."""
    if not _DECIMAL_TEXT.match(value):
        return None
    return Decimal(value)


def plain(value: Decimal) -> str:
    """Stable text for a Decimal in results (no exponent, no trailing zeros)."""
    text = format(value.normalize(), "f")
    return text if "." not in text else text.rstrip("0").rstrip(".")


def round_minor(value: Decimal, step: int, mode: str) -> int:
    """Round a Decimal amount of minor units to a multiple of ``step``."""
    units = (value / Decimal(step)).quantize(Decimal(1), rounding=_ROUNDING[mode])
    return int(units) * step


def iso(day: date) -> str:
    return day.isoformat()


def days_in_year(year: int) -> int:
    return 366 if calendar.isleap(year) else 365


def anchor_date(year: int, month: int, anchor_day: int) -> date:
    """The anchor day in that month, clamped to the month's last day (31 → 28/29/30)."""
    return date(year, month, min(anchor_day, calendar.monthrange(year, month)[1]))


def monthly_date(first: date, anchor_day: int, months: int) -> date:
    """The anchored date ``months`` after the month of ``first``; the anchor never drifts."""
    index = first.year * 12 + first.month - 1 + months
    year, month0 = divmod(index, 12)
    return anchor_date(year, month0 + 1, anchor_day)


def is_on_anchor(day: date, anchor_day: int) -> bool:
    return day == anchor_date(day.year, day.month, anchor_day)


@dataclass(frozen=True)
class Rate:
    """A contractual rate as a fraction per ``per`` (day | month | year)."""

    fraction: Decimal
    per: str
    day_count: str | None

    def daily(self, day: date) -> Decimal:
        if self.per == "day":
            return self.fraction
        if self.per != "year":
            raise ValueError("only day and year rates accrue daily")
        if self.day_count == "ACT_365_FIXED":
            return self.fraction / Decimal(365)
        if self.day_count == "ACT_360":
            return self.fraction / Decimal(360)
        if self.day_count == "ACT_ACT_ISDA":
            return self.fraction / Decimal(days_in_year(day.year))
        raise ValueError("unsupported day count")
