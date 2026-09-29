"""Leaf: review periods (calendar month / year in an IANA zone) and the server clock.

A logical System Review exists for every period that has started — as a derived
resource, not a row. Its status is derived here: ``IN_PROGRESS`` until the local
period end, then ``AVAILABLE`` until the user finalizes a revision, then
``FINALIZED``. Nothing finalizes itself because a month ended.
"""

import calendar
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.services.system_review.errors import (
    InvalidPeriodError,
    InvalidSystemReviewError,
    PeriodInFutureError,
)
from app.services.system_review.refs import valid_period


def server_now() -> datetime:
    """The one server clock for System Review rules. Tests pin it here."""
    return datetime.now(UTC)


def zone(timezone: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        raise InvalidSystemReviewError from None


def local_today(timezone: str, now: datetime | None = None) -> date:
    return (now or server_now()).astimezone(zone(timezone)).date()


@dataclass(frozen=True, slots=True)
class Period:
    key: str
    kind: str  # month | year
    year: int
    month: int | None
    timezone: str
    window_start: date
    window_end: date

    @property
    def start(self) -> datetime:
        return datetime.combine(self.window_start, time.min, zone(self.timezone))

    @property
    def end(self) -> datetime:
        """Exclusive: local midnight after the last day."""
        return datetime.combine(
            self.window_end + timedelta(days=1), time.min, zone(self.timezone)
        )

    @property
    def subject_key(self) -> str:
        return f"finance:period:{self.key}"

    def contains(self, day: date) -> bool:
        return self.window_start <= day <= self.window_end

    def contains_instant(self, instant: datetime) -> bool:
        return self.start <= instant < self.end


def month(year: int, month_number: int, timezone: str) -> Period:
    last = calendar.monthrange(year, month_number)[1]
    return Period(
        key=f"{year:04d}-{month_number:02d}",
        kind="month",
        year=year,
        month=month_number,
        timezone=timezone,
        window_start=date(year, month_number, 1),
        window_end=date(year, month_number, last),
    )


def year(value: int, timezone: str) -> Period:
    return Period(
        key=f"{value:04d}",
        kind="year",
        year=value,
        month=None,
        timezone=timezone,
        window_start=date(value, 1, 1),
        window_end=date(value, 12, 31),
    )


def parse_period(value: str, timezone: str) -> Period:
    zone(timezone)
    if not valid_period(value or ""):
        raise InvalidPeriodError
    if len(value) == 4:
        return year(int(value), timezone)
    return month(int(value[:4]), int(value[5:7]), timezone)


def require_started(period: Period, now: datetime | None = None) -> None:
    if local_today(period.timezone, now) < period.window_start:
        raise PeriodInFutureError


def has_ended(period: Period, now: datetime | None = None) -> bool:
    return local_today(period.timezone, now) > period.window_end


def period_state(period: Period, now: datetime | None = None) -> str:
    return "ended" if has_ended(period, now) else "in_progress"


def months_of(period: Period) -> list[Period]:
    if period.kind == "month":
        return [period]
    return [month(period.year, number, period.timezone) for number in range(1, 13)]


def shift_month(period: Period, offset: int) -> Period:
    index = period.year * 12 + (period.month or 1) - 1 + offset
    return month(index // 12, index % 12 + 1, period.timezone)


def current_month(timezone: str, now: datetime | None = None) -> Period:
    today = local_today(timezone, now)
    return month(today.year, today.month, timezone)


def logical_status(period: Period, *, finalized: bool, now: datetime | None = None) -> str:
    if not has_ended(period, now):
        return "IN_PROGRESS"
    return "FINALIZED" if finalized else "AVAILABLE"
