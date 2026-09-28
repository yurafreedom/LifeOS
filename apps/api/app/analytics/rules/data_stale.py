"""R3 · ``data.source.stale`` v1 (plan §19, §13.3c).

One episode per continuous staleness period, per source kind. The discriminator
is the local date the source *first* crossed the threshold — derived as
``newest_recorded_at + 7 days`` — which is a property of the data, not of today.
That is what keeps the card from re-firing every morning the source is still
stale: tomorrow's evaluation computes the same ``since`` and finds the same
episode.

A fresh record moves ``newest_recorded_at`` forward, the condition stops holding,
and the episode is withdrawn. A later staleness period computes a different
``since`` and is therefore a different episode.

Crossing from the 7-day tier to the 14-day tier raises the **materiality** of the
same episode; it is not a new occurrence, because the staleness period did not
restart.

Freshness says nothing about whether the data is welcome. No desirability.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.enums import FactStatus, SignalMateriality, SignalState
from app.analytics.rules import Evaluation, SignalSubject, compose_episode_key
from app.models import AAMeasurement, AASignalEpisode

RULE_ID = "data.source.stale"
RULE_VERSION = 1

# Accepted thresholds, in whole days since the newest record.
INFO_AFTER_DAYS = 7
MATERIAL_AFTER_DAYS = 14


@dataclass(frozen=True, slots=True)
class SourceFreshness:
    source_kind: str
    newest_recorded_at: datetime
    newest_fact_id: str
    fact_count: int


@dataclass(frozen=True, slots=True)
class Inputs:
    subject: SignalSubject
    now: datetime
    sources: tuple[SourceFreshness, ...]


def handles(subject: SignalSubject) -> bool:
    # Every subject AA reports on has a freshness. The subject's fact scope says
    # which rows speak for it, so no subject kind needs special-casing here.
    return True


def inputs(
    db: Session,
    *,
    user_id: UUID,
    subject: SignalSubject,
    now: datetime,
    as_of: datetime | None = None,
) -> Inputs:
    scope = subject.fact_scope
    at = as_of or now
    newest = func.max(AAMeasurement.recorded_at)
    query = (
        select(
            AAMeasurement.source_kind,
            newest,
            func.count(AAMeasurement.id),
        )
        .where(
            AAMeasurement.user_id == user_id,
            AAMeasurement.subject_domain == scope.subject_domain,
            AAMeasurement.subject_type.in_(scope.subject_types),
            AAMeasurement.metric_key.in_(scope.metric_keys),
            AAMeasurement.recorded_at <= at,
            AAMeasurement.status != FactStatus.TOMBSTONED,
        )
        .group_by(AAMeasurement.source_kind)
        .order_by(AAMeasurement.source_kind)
    )
    if scope.occurred_from is not None:
        query = query.where(AAMeasurement.occurred_at >= scope.occurred_from)
    if scope.occurred_to is not None:
        query = query.where(AAMeasurement.occurred_at < scope.occurred_to)

    sources: list[SourceFreshness] = []
    for source_kind, newest_recorded_at, fact_count in db.execute(query):
        newest_id = db.scalar(
            select(AAMeasurement.id)
            .where(
                AAMeasurement.user_id == user_id,
                AAMeasurement.source_kind == source_kind,
                AAMeasurement.recorded_at == newest_recorded_at,
                AAMeasurement.subject_domain == scope.subject_domain,
                AAMeasurement.subject_type.in_(scope.subject_types),
                AAMeasurement.metric_key.in_(scope.metric_keys),
                AAMeasurement.status != FactStatus.TOMBSTONED,
            )
            .order_by(AAMeasurement.id)
            .limit(1)
        )
        sources.append(
            SourceFreshness(
                source_kind=str(source_kind),
                newest_recorded_at=newest_recorded_at,
                newest_fact_id=str(newest_id),
                fact_count=int(fact_count),
            )
        )
    return Inputs(subject=subject, now=at, sources=tuple(sources))


def _stalest(rule_inputs: Inputs) -> SourceFreshness | None:
    """The source that has been silent longest — one card, not one per source."""
    if not rule_inputs.sources:
        return None
    return min(rule_inputs.sources, key=lambda source: source.newest_recorded_at)


def evaluate(rule_inputs: Inputs) -> Evaluation | None:
    source = _stalest(rule_inputs)
    if source is None:
        # No facts at all is not stale data; it is no data. Coverage, not
        # freshness, is what speaks to that.
        return None
    elapsed = (rule_inputs.now - source.newest_recorded_at).days
    if elapsed <= INFO_AFTER_DAYS:
        return None
    materiality = (
        SignalMateriality.MATERIAL if elapsed > MATERIAL_AFTER_DAYS else SignalMateriality.INFO
    )
    zone = ZoneInfo(rule_inputs.subject.timezone)
    since = (source.newest_recorded_at + timedelta(days=INFO_AFTER_DAYS)).astimezone(zone).date()
    return Evaluation(
        materiality=materiality,
        state=SignalState.STALE,
        stakes=False,
        rendered_values={
            "source_kind": source.source_kind,
            "days_stale": elapsed,
            "newest_recorded_at": source.newest_recorded_at.isoformat(),
            "since": since.isoformat(),
            "threshold_days": (
                MATERIAL_AFTER_DAYS
                if materiality is SignalMateriality.MATERIAL
                else INFO_AFTER_DAYS
            ),
        },
        # Only the newest row identifies this staleness period. Older rows cannot
        # end it, so folding them in would churn the fingerprint for nothing.
        input_version_ids=(source.newest_fact_id,),
        discriminator=f"{source.source_kind}:since={since.isoformat()}",
        provenance={
            "source_kinds": [source.source_kind],
            "newest_recorded_at": source.newest_recorded_at.isoformat(),
            "fact_count": source.fact_count,
            "derivation": "max(recorded_at) per source kind for this subject",
        },
    )


def episode_key(subject: SignalSubject, evaluation: Evaluation) -> str:
    return compose_episode_key(
        rule_id=RULE_ID,
        rule_version=RULE_VERSION,
        subject_key=subject.subject_key,
        discriminator=evaluation.discriminator,
    )


def reopen_on(episode: AASignalEpisode, evaluation: Evaluation) -> bool:
    """Still the same silence, so the acknowledgement stands.

    A changed fingerprint here means the newest row was corrected in place rather
    than superseded by a fresher one; the source is still as quiet as it was, so
    telling the user again would be noise. A genuinely fresher record ends the
    period and the episode is withdrawn instead.
    """
    del episode, evaluation
    return False


__all__ = [
    "INFO_AFTER_DAYS",
    "MATERIAL_AFTER_DAYS",
    "RULE_ID",
    "RULE_VERSION",
    "episode_key",
    "evaluate",
    "handles",
    "inputs",
    "reopen_on",
]
