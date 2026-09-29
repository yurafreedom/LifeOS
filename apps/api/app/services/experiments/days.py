"""Leaf: the server clock, IANA local-day math and adherence classification.

A local day is the calendar date of an instant in the experiment's IANA zone.
Offsets are never hard-coded; ``ZoneInfo`` applies the zone's rule for that
instant, so a window ending across a DST switch is judged correctly.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.analytics.enums import AdherenceDay, DenominatorBasis


def server_now() -> datetime:
    """The one server clock for experiment rules. Tests pin it here."""
    return datetime.now(UTC)


def local_date(instant: datetime, timezone: str) -> date:
    return instant.astimezone(ZoneInfo(timezone)).date()


def local_today(timezone: str, now: datetime) -> date:
    # Same rule as ``app.analytics.coverage._local_today``; a test pins equality.
    return now.astimezone(ZoneInfo(timezone)).date()


def window_days(window_start: date, window_end: date) -> list[date]:
    return [window_start + timedelta(days=offset) for offset in range((window_end - window_start).days + 1)]


def classify_adherence(
    *,
    window_start: date,
    window_end: date,
    today: date,
    abandon_day: date | None,
    applicable: bool,
    records: dict[date, Any],
) -> dict[str, Any]:
    """Resolve every window day to exactly one derived state.

    ``records`` maps a day to its single active row. A day after the stop is
    ``not_run_after_stop`` and leaves the denominator; a day after local today
    is ``future``; an elapsed day without a row is ``not_recorded`` — never
    ``missed`` and never ``unknown``.
    """
    days = window_days(window_start, window_end)
    counts = {state.value: 0 for state in AdherenceDay}
    rendered: list[dict[str, Any]] = []
    if applicable:
        for day in days:
            record = records.get(day)
            if abandon_day is not None and day > abandon_day:
                state = AdherenceDay.NOT_RUN_AFTER_STOP
            elif day > today:
                state = AdherenceDay.FUTURE
            elif record is not None:
                state = AdherenceDay(record.state)
            else:
                state = AdherenceDay.NOT_RECORDED
            counts[state.value] += 1
            rendered.append({"day": day, "state": state.value, "row": record})
    elapsed = (
        counts["kept"] + counts["missed"] + counts["unknown"] + counts["not_recorded"]
    )
    if applicable:
        assert elapsed + counts["future"] + counts["not_run_after_stop"] == len(days)
    return {
        "applicable": applicable,
        "denominator_basis": DenominatorBasis.EXPERIMENT_ELAPSED_DAYS.value,
        "total_days": len(days),
        "elapsed_days": elapsed,
        **counts,
        "abandon_day": abandon_day,
        "days": rendered,
    }
