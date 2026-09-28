"""R2 · ``project.forecast.revision`` v1 (plan §19, §13.3b).

A genuine new ``ForecastVersion`` is a genuine new occurrence, so the episode
discriminator is the newest forecast version's id. Ordinary Task/Project edits
that do not append a forecast version change nothing here — there is no new
version id, so there is no new episode, and re-evaluating produces the identical
key.

The card reads «Прогноз сдвинулся»: the frozen design renders a forecast revision
in the base card state, while plan §19 rates its materiality as ``material``.
Those are the two different dimensions the design keeps apart — the visual family
and the ranking weight — so this rule sets ``state = NORMAL`` and
``materiality = MATERIAL``.

No desirability. A forecast moving later is not «bad» and moving earlier is not
«good»: that judgement needs a Target or a Preference, which a rule may not
invent.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.enums import FactStatus, SignalMateriality, SignalState
from app.analytics.rules import Evaluation, SignalSubject, compose_episode_key
from app.models import AAForecastVersion, AASignalEpisode

RULE_ID = "project.forecast.revision"
RULE_VERSION = 1

FORECAST_METRIC = "project.completion_date"


@dataclass(frozen=True, slots=True)
class Inputs:
    subject: SignalSubject
    versions: tuple[AAForecastVersion, ...]


def handles(subject: SignalSubject) -> bool:
    return (
        subject.subject.subject_domain == "project" and subject.subject.subject_type == "project"
    )


def inputs(
    db: Session,
    *,
    user_id: UUID,
    subject: SignalSubject,
    now: datetime,
    as_of: datetime | None = None,
) -> Inputs:
    """Every forecast version LifeOS had recorded by the belief instant.

    Not ``apply_as_of``: that answers "which version was live at T", and the
    semantic write path supersedes each prior forecast as a ``REVISION``, so a
    live-version read collapses the history to its newest row. A revision's
    history is every non-erased version recorded by ``as_of`` (or ever, when
    ``as_of`` is absent), superseded ones included. Tombstones are excluded
    outright.
    """
    query = select(AAForecastVersion).where(
        AAForecastVersion.user_id == user_id,
        AAForecastVersion.subject_key == subject.subject_key,
        AAForecastVersion.metric_key == FORECAST_METRIC,
        AAForecastVersion.status != FactStatus.TOMBSTONED,
    )
    if as_of is not None:
        query = query.where(AAForecastVersion.recorded_at <= as_of)
    versions = list(
        db.scalars(query.order_by(AAForecastVersion.recorded_at, AAForecastVersion.id))
    )
    return Inputs(subject=subject, versions=tuple(versions))


def _value(row: AAForecastVersion) -> str | None:
    return None if row.value_date is None else row.value_date.isoformat()


def evaluate(rule_inputs: Inputs) -> Evaluation | None:
    versions = rule_inputs.versions
    if not versions:
        return None
    newest = versions[-1]
    previous = versions[-2] if len(versions) > 1 else None
    return Evaluation(
        materiality=SignalMateriality.MATERIAL,
        state=SignalState.NORMAL,
        stakes=False,
        rendered_values={
            "from": None if previous is None else _value(previous),
            "to": _value(newest),
            "revision_count": len(versions),
            "recorded_at": newest.recorded_at.isoformat(),
            "horizon_at": newest.horizon_at.isoformat(),
            "value_type": newest.value_type,
        },
        # Every version the project has, so a correction or a retraction anywhere
        # in its forecast history changes the fingerprint and is re-evaluated.
        input_version_ids=tuple(str(row.id) for row in versions),
        discriminator=f"fv={newest.id}",
        provenance={
            "derived_by": "lifeos",
            "forecast_version_count": len(versions),
            "newest_recorded_at": newest.recorded_at.isoformat(),
            "source_kinds": sorted({str(row.source_kind) for row in versions}),
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
    """A newer version is a different key, so reaching here means the same one.

    The fingerprint can still move — an older version in the same history may be
    corrected — but the occurrence the user dismissed is the newest revision, and
    that has not changed.
    """
    del episode, evaluation
    return False


__all__ = [
    "FORECAST_METRIC",
    "RULE_ID",
    "RULE_VERSION",
    "episode_key",
    "evaluate",
    "handles",
    "inputs",
    "reopen_on",
]
