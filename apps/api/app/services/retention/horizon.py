"""The effective historical-completeness horizon (Slice 8). Leaf: models only.

Every read that must admit "older history is incomplete" asks this module. The
horizon comes from **completed** retention runs only — never from the current
policy — so switching back to UNLIMITED, or to a longer duration, never pretends
that erased history is whole again (owner decisions O3/O4, Plan §2).

The horizon means *completeness before this boundary is no longer guaranteed*.
It does not mean no row may exist before it: an explicit late write with an old
semantic date is accepted, and the disclosure stays.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.enums import RetentionRunStatus
from app.models import AARetentionRun


@dataclass(frozen=True, slots=True)
class RetentionHorizon:
    """The latest horizon a completed run applied, in that run's IANA zone."""

    date: date
    timezone: str
    run_id: UUID
    applied_at: datetime

    @property
    def instant(self) -> datetime:
        """Local midnight of the horizon date — DST-correct via ``zoneinfo``."""
        return datetime.combine(self.date, time.min, tzinfo=ZoneInfo(self.timezone))

    def truncates_instant(self, moment: datetime) -> bool:
        return moment < self.instant

    def truncates_day(self, day: date) -> bool:
        return day < self.date

    def truncates_month(self, period: str) -> bool:
        """``YYYY-MM`` strictly before the horizon month (the horizon is a month start)."""
        return period < f"{self.date.year:04d}-{self.date.month:02d}"


def target_horizon_date(retain_months: int, timezone: str, now: datetime | None = None) -> date:
    """First day of the local month containing ``local_today - retain_months``.

    Computed in the user's IANA zone; never a hardcoded offset.
    """
    moment = now or datetime.now(UTC)
    today = moment.astimezone(ZoneInfo(timezone)).date()
    index = today.year * 12 + (today.month - 1) - retain_months
    return date(index // 12, index % 12 + 1, 1)


def effective_horizon(db: Session, *, user_id: UUID) -> RetentionHorizon | None:
    """The strictest horizon among completed runs, or ``None`` (no Apply ever)."""
    row = db.execute(
        select(
            AARetentionRun.target_horizon_date,
            AARetentionRun.timezone,
            AARetentionRun.id,
            AARetentionRun.completed_at,
        )
        .where(
            AARetentionRun.user_id == user_id,
            AARetentionRun.status == RetentionRunStatus.COMPLETED,
        )
        .order_by(
            AARetentionRun.target_horizon_date.desc(),
            AARetentionRun.completed_at.desc(),
            AARetentionRun.id.desc(),
        )
        .limit(1)
    ).first()
    if row is None:
        return None
    horizon_date, timezone, run_id, completed_at = row
    return RetentionHorizon(horizon_date, timezone, run_id, completed_at)


def pruned_project_ids(db: Session, *, user_id: UUID) -> frozenset[str]:
    """Project subjects erased as whole units by any completed run."""
    rows = db.scalars(
        select(AARetentionRun.pruned_units).where(
            AARetentionRun.user_id == user_id,
            AARetentionRun.status == RetentionRunStatus.COMPLETED,
        )
    )
    identities: set[str] = set()
    for units in rows:
        identities.update(str(value) for value in (units or {}).get("project_subject_ids", []))
    return frozenset(identities)


__all__ = [
    "RetentionHorizon",
    "effective_horizon",
    "pruned_project_ids",
    "target_horizon_date",
]
