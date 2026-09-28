"""Signal evaluation and episode acknowledgement (plan §13, §19, §24.5).

A signal is a derived interpretation over durable AA facts. Evaluating one may
create or update **episode state**, and must never invent a semantic measurement
because a card needs content: a rule that finds nothing returns nothing, and the
absence of cards is reported honestly rather than dressed up as reassurance.

The two identities stay separate throughout (correction C2). ``episode_key`` — the
rule's occurrence identity — decides what the user's dismissal applies to.
``input_fingerprint`` — ``sha256`` over the exact input version ids — decides what
is auditable and what must be re-evaluated. Ordinary churn inside one occurrence
moves the fingerprint and leaves the dismissal alone.

Nothing here derives desirability, and no ranking combines incomparable units
into a score. Materiality orders the list; that is all it does.
"""

import logging
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.asof import apply_as_of
from app.analytics.enums import (
    FactStatus,
    SignalMateriality,
    SignalResolution,
    SignalState,
    ZeroSignalState,
)
from app.analytics.rules import (
    Evaluation,
    FactScope,
    SignalRule,
    SignalSubject,
    signal_rules,
)
from app.analytics.rules import coverage_partial as coverage_rule
from app.analytics.subjects import SubjectRef
from app.models import (
    AAExpectationVersion,
    AAForecastVersion,
    AAMeasurement,
    AASignalEpisode,
    AATarget,
)
from app.services.aa_facts import AAServiceError
from app.services.aa_finance import MONTHLY_METRIC, TRANSACTION_METRIC

logger = logging.getLogger(__name__)

DEFAULT_TIMEZONE = "Europe/Kyiv"
HOME_SIGNAL_LIMIT = 3

# How far back subject discovery looks. Signals speak about the present; an
# unbounded scan over all history would be both slow and beside the point.
DISCOVERY_MONTHS = 13

_MATERIALITY_RANK: dict[SignalMateriality, int] = {
    SignalMateriality.MATERIAL: 2,
    SignalMateriality.INFO: 1,
    SignalMateriality.NORMAL: 0,
}


class EpisodeNotFoundError(AAServiceError):
    code = "episode_not_found"
    message = "No such signal episode."


class EpisodeChangedError(AAServiceError):
    code = "episode_changed"
    message = "This signal has been re-evaluated since it was shown."


class UnsupportedResolutionError(AAServiceError):
    code = "unsupported_resolution"
    message = "Only acknowledgement is a user action; withdrawal is the rule's verdict."


@dataclass(frozen=True, slots=True)
class SignalCard:
    """One evaluated signal, ready for the accepted Signal Card."""

    episode_key: str
    rule_id: str
    rule_version: int
    subject_domain: str
    subject_type: str
    subject_id: str
    subject_key: str
    state: SignalState
    materiality: SignalMateriality
    stakes: bool
    rendered_values: Mapping[str, Any]
    provenance: Mapping[str, Any]
    input_fingerprint: str
    first_seen_at: datetime
    last_evaluated_at: datetime
    acknowledged: bool
    acknowledged_at: datetime | None
    reopened_count: int


@dataclass(frozen=True, slots=True)
class CoverageConfidence:
    """What the evaluation knows about the completeness of what it read."""

    subjects_evaluated: int
    subjects_with_coverage_window: int
    subjects_with_coverage_evidence: int
    subjects_with_unknown_coverage: int


@dataclass(frozen=True, slots=True)
class SignalReport:
    as_of: datetime
    limit: int
    signals: tuple[SignalCard, ...]
    acknowledged: tuple[SignalCard, ...]
    active_total: int
    zero_state: ZeroSignalState
    coverage: CoverageConfidence
    persisted: bool


@dataclass
class _Outcome:
    produced: dict[str, tuple[SignalRule, SignalSubject, Evaluation]] = field(default_factory=dict)
    evaluated_pairs: set[tuple[str, str]] = field(default_factory=set)


# ─────────────────────────── subject discovery ───────────────────────────


def _month_bounds(period: str, timezone: str) -> tuple[date, date, datetime, datetime]:
    year, month = (int(part) for part in period.split("-"))
    if month == 12:
        next_first = date(year + 1, 1, 1)
    else:
        next_first = date(year, month + 1, 1)
    first = date(year, month, 1)
    last = next_first - timedelta(days=1)
    zone = ZoneInfo(timezone)
    return (
        first,
        last,
        datetime.combine(first, time.min, zone),
        datetime.combine(next_first, time.min, zone),
    )


def _period_id(moment: date) -> str:
    return f"{moment.year:04d}-{moment.month:02d}"


def _earliest_discovery_period(now: datetime, timezone: str) -> str:
    today = now.astimezone(ZoneInfo(timezone)).date()
    months = today.year * 12 + (today.month - 1) - (DISCOVERY_MONTHS - 1)
    return f"{months // 12:04d}-{months % 12 + 1:02d}"


def _finance_periods(
    db: Session, *, user_id: UUID, now: datetime, timezone: str, as_of: datetime | None
) -> list[str]:
    """Periods the user actually has finance history or a reference for."""
    local_month = func.to_char(func.timezone(timezone, AAMeasurement.occurred_at), "YYYY-MM")
    transaction_query = (
        select(local_month)
        .where(
            AAMeasurement.user_id == user_id,
            AAMeasurement.metric_key == TRANSACTION_METRIC,
            AAMeasurement.subject_domain == "finance",
            AAMeasurement.subject_type == "transaction",
            AAMeasurement.status != FactStatus.TOMBSTONED,
        )
        .distinct()
    )
    periods = {
        value for value in db.scalars(apply_as_of(transaction_query, AAMeasurement, as_of)) if value
    }
    for model in (AAExpectationVersion, AATarget):
        query = (
            select(model.subject_id)
            .where(
                model.user_id == user_id,
                model.subject_domain == "finance",
                model.subject_type == "period",
                model.metric_key == MONTHLY_METRIC,
            )
            .distinct()
        )
        periods.update(value for value in db.scalars(apply_as_of(query, model, as_of)) if value)

    current = _period_id(now.astimezone(ZoneInfo(timezone)).date())
    earliest = _earliest_discovery_period(now, timezone)
    # Only periods that have begun: a future month is not under-covered, it has
    # not happened.
    return sorted(period for period in periods if earliest <= period <= current)


def _project_subject_ids(
    db: Session, *, user_id: UUID, as_of: datetime | None
) -> list[str]:
    identifiers: set[str] = set()
    for model in (AAForecastVersion, AAMeasurement):
        query = (
            select(model.subject_id)
            .where(
                model.user_id == user_id,
                model.subject_domain == "project",
                model.subject_type == "project",
                model.status != FactStatus.TOMBSTONED,
            )
            .distinct()
        )
        identifiers.update(value for value in db.scalars(apply_as_of(query, model, as_of)) if value)
    return sorted(identifiers)


def evaluation_subjects(
    db: Session,
    *,
    user_id: UUID,
    now: datetime,
    timezone: str = DEFAULT_TIMEZONE,
    as_of: datetime | None = None,
) -> list[SignalSubject]:
    """The subjects this account actually has AA history for.

    Discovery is fact-driven, so a subject cannot appear because a rule wanted
    something to evaluate. It is also bounded — a finance period must have begun
    and must fall inside the discovery horizon.
    """
    subjects: list[SignalSubject] = []
    for period in _finance_periods(
        db, user_id=user_id, now=now, timezone=timezone, as_of=as_of
    ):
        window_start, window_end, occurred_from, occurred_to = _month_bounds(period, timezone)
        subjects.append(
            SignalSubject(
                subject=SubjectRef("finance", "period", period),
                timezone=timezone,
                window_start=window_start,
                window_end=window_end,
                window_id=period,
                period=period,
                fact_scope=FactScope(
                    subject_domain="finance",
                    subject_types=("transaction",),
                    metric_keys=(TRANSACTION_METRIC,),
                    occurred_from=occurred_from,
                    occurred_to=occurred_to,
                ),
            )
        )

    today = now.astimezone(ZoneInfo(timezone)).date()
    for identity in _project_subject_ids(db, user_id=user_id, as_of=as_of):
        subjects.append(
            SignalSubject(
                subject=SubjectRef("project", "project", identity),
                timezone=timezone,
                # A project's lifetime carries no coverage denominator in this
                # slice, so its window is nominal: the rules that run against a
                # project read its fact scope, never these dates.
                window_start=today,
                window_end=today,
                window_id=f"project:{identity}",
                period=None,
                fact_scope=FactScope(
                    subject_domain="project",
                    subject_types=("project",),
                    metric_keys=("project.completion_date",),
                ),
            )
        )
    return subjects


# ─────────────────────────── evaluation ───────────────────────────


def _evaluate_rules(
    db: Session,
    *,
    user_id: UUID,
    subjects: Sequence[SignalSubject],
    now: datetime,
    as_of: datetime | None,
    rules: Sequence[SignalRule] | None = None,
) -> _Outcome:
    outcome = _Outcome()
    catalogue = rules if rules is not None else signal_rules()
    for subject in subjects:
        for rule in catalogue:
            if not rule.handles(subject):
                continue
            outcome.evaluated_pairs.add((rule.RULE_ID, subject.subject_key))
            rule_inputs = rule.inputs(
                db, user_id=user_id, subject=subject, now=now, as_of=as_of
            )
            evaluation = rule.evaluate(rule_inputs)
            if evaluation is None:
                continue
            key = rule.episode_key(subject, evaluation)
            outcome.produced[key] = (rule, subject, evaluation)
    return outcome


def _coverage_confidence(
    db: Session,
    *,
    user_id: UUID,
    subjects: Sequence[SignalSubject],
    now: datetime,
    as_of: datetime | None,
) -> CoverageConfidence:
    """Whether absence of signals is backed by evidence about what was observed.

    Zero cards over data whose completeness nobody vouched for is not «всё в
    порядке». This is the measurement that keeps the zero state honest.
    """
    with_window = evidence = unknown = 0
    for subject in subjects:
        if not coverage_rule.handles(subject):
            continue
        with_window += 1
        rule_inputs = coverage_rule.inputs(
            db, user_id=user_id, subject=subject, now=now, as_of=as_of
        )
        if coverage_rule.has_coverage_evidence(rule_inputs):
            evidence += 1
        if rule_inputs.report.unknown_coverage_count > 0:
            unknown += 1
    return CoverageConfidence(
        subjects_evaluated=len(subjects),
        subjects_with_coverage_window=with_window,
        subjects_with_coverage_evidence=evidence,
        subjects_with_unknown_coverage=unknown,
    )


def _zero_state(coverage: CoverageConfidence) -> ZeroSignalState:
    if coverage.subjects_evaluated == 0:
        return ZeroSignalState.NO_DATA
    if coverage.subjects_with_coverage_window == 0:
        # Nothing evaluated here carries a coverage denominator, so nobody can
        # vouch for completeness either way.
        return ZeroSignalState.UNKNOWN_COVERAGE
    if coverage.subjects_with_unknown_coverage > 0:
        return ZeroSignalState.UNKNOWN_COVERAGE
    if coverage.subjects_with_coverage_evidence < coverage.subjects_with_coverage_window:
        return ZeroSignalState.UNKNOWN_COVERAGE
    return ZeroSignalState.CONFIDENT


def _existing_episodes(
    db: Session, *, user_id: UUID, pairs: Iterable[tuple[str, str]]
) -> dict[str, AASignalEpisode]:
    wanted = set(pairs)
    if not wanted:
        return {}
    rule_ids = {rule_id for rule_id, _ in wanted}
    subject_keys = {subject_key for _, subject_key in wanted}
    rows = db.scalars(
        select(AASignalEpisode).where(
            AASignalEpisode.user_id == user_id,
            AASignalEpisode.rule_id.in_(rule_ids),
            AASignalEpisode.subject_key.in_(subject_keys),
        )
    )
    # The IN-pair product can over-select, so the exact pairs are filtered here.
    # Only episodes this run actually re-evaluated may be withdrawn.
    return {row.episode_key: row for row in rows if (row.rule_id, row.subject_key) in wanted}


def _card(
    *,
    episode_key: str,
    rule: SignalRule,
    subject: SignalSubject,
    evaluation: Evaluation,
    first_seen_at: datetime,
    last_evaluated_at: datetime,
    acknowledged: bool,
    acknowledged_at: datetime | None,
    reopened_count: int,
) -> SignalCard:
    return SignalCard(
        episode_key=episode_key,
        rule_id=rule.RULE_ID,
        rule_version=rule.RULE_VERSION,
        subject_domain=subject.subject.subject_domain,
        subject_type=subject.subject.subject_type,
        subject_id=subject.subject.subject_id,
        subject_key=subject.subject_key,
        # Acknowledged is the card's state, not a rule verdict, which is why
        # `resolved` never appears in an Evaluation.
        state=SignalState.RESOLVED if acknowledged else evaluation.state,
        materiality=evaluation.materiality,
        stakes=False if acknowledged else evaluation.stakes,
        rendered_values=dict(evaluation.rendered_values),
        provenance=dict(evaluation.provenance),
        input_fingerprint=evaluation.input_fingerprint,
        first_seen_at=first_seen_at,
        last_evaluated_at=last_evaluated_at,
        acknowledged=acknowledged,
        acknowledged_at=acknowledged_at,
        reopened_count=reopened_count,
    )


def _rank(card: SignalCard) -> tuple:
    """Materiality first, then a deterministic tiebreak. Never a composite score.

    Two signals in different units are never added together or normalised against
    each other; ordering compares their materiality and, failing that, their
    recency and key. There is no global priority number and no Life Score.
    """
    return (
        -_MATERIALITY_RANK[card.materiality],
        0 if card.stakes else 1,
        -card.first_seen_at.timestamp(),
        card.episode_key,
    )


def evaluate_signals(
    db: Session,
    *,
    user_id: UUID,
    now: datetime | None = None,
    as_of: datetime | None = None,
    timezone: str = DEFAULT_TIMEZONE,
    limit: int = HOME_SIGNAL_LIMIT,
    persist: bool = True,
) -> SignalReport:
    """Evaluate the catalogue, reconcile episode state, and rank what is active.

    ``now`` is the **observation instant** — what "stale" and "elapsed" are measured
    against. ``as_of`` is the **belief instant**: with it set, only facts recorded by
    then are read, so a past evaluation is reproducible. They are separate because
    a caller may legitimately ask "how did 20 August look" while still reading
    everything known today.

    ``persist=False`` evaluates read-only. The AA write gate uses it so a
    deployment that has not opted into collecting personal history can still read
    its signals without accumulating episode rows.
    """
    if now is not None and now.tzinfo is None:
        raise ValueError("now requires an offset")
    if as_of is not None and as_of.tzinfo is None:
        raise ValueError("as_of requires an offset")
    observation = now or as_of or datetime.now(UTC)

    subjects = evaluation_subjects(
        db, user_id=user_id, now=observation, timezone=timezone, as_of=as_of
    )
    outcome = _evaluate_rules(
        db, user_id=user_id, subjects=subjects, now=observation, as_of=as_of
    )
    existing = _existing_episodes(db, user_id=user_id, pairs=outcome.evaluated_pairs)

    active: list[SignalCard] = []
    acknowledged: list[SignalCard] = []
    dirty = False

    # A condition that stopped holding withdraws its episode. The acknowledgement
    # it already carried is kept: the card disappearing is not a reason to forget
    # that the user dismissed it.
    for episode_key, episode in existing.items():
        if episode_key in outcome.produced:
            continue
        if episode.resolution == SignalResolution.WITHDRAWN:
            continue
        if persist:
            episode.resolution = SignalResolution.WITHDRAWN
            episode.last_evaluated_at = max(episode.last_evaluated_at, observation)
            dirty = True

    for episode_key, (rule, subject, evaluation) in outcome.produced.items():
        fingerprint = evaluation.input_fingerprint
        episode = existing.get(episode_key)
        if episode is None:
            if persist:
                episode = AASignalEpisode(
                    user_id=user_id,
                    subject_domain=subject.subject.subject_domain,
                    subject_type=subject.subject.subject_type,
                    subject_id=subject.subject.subject_id,
                    episode_key=episode_key,
                    rule_id=rule.RULE_ID,
                    rule_version=rule.RULE_VERSION,
                    first_seen_at=observation,
                    last_evaluated_at=observation,
                    last_fingerprint=fingerprint,
                )
                db.add(episode)
                dirty = True
            active.append(
                _card(
                    episode_key=episode_key,
                    rule=rule,
                    subject=subject,
                    evaluation=evaluation,
                    first_seen_at=observation,
                    last_evaluated_at=observation,
                    acknowledged=False,
                    acknowledged_at=None,
                    reopened_count=0,
                )
            )
            continue

        is_acknowledged = episode.resolution == SignalResolution.ACKNOWLEDGED
        reopened = False
        if episode.resolution == SignalResolution.WITHDRAWN:
            # The condition holds again under the same key. Per the accepted rule
            # semantics that is a fresh occurrence, so the earlier dismissal no
            # longer applies — and the reopen columns record that it happened.
            reopened = True
        elif is_acknowledged and fingerprint != episode.acknowledged_fingerprint:
            reopened = rule.reopen_on(episode, evaluation)

        if reopened and persist:
            episode.resolution = None
            episode.acknowledged_at = None
            episode.acknowledged_fingerprint = None
            episode.first_seen_at = min(observation, episode.last_evaluated_at)
            episode.reopened_at = observation
            episode.reopened_count = (episode.reopened_count or 0) + 1
            is_acknowledged = False
            dirty = True
        elif reopened:
            is_acknowledged = False

        if persist:
            if episode.last_fingerprint != fingerprint:
                episode.last_fingerprint = fingerprint
                dirty = True
            # Monotonic: a retrospective read (an `as_of` in the past, or a
            # deliberately earlier observation instant) must not rewind the record
            # of when this episode was last looked at.
            if observation > episode.last_evaluated_at:
                episode.last_evaluated_at = observation
                dirty = True

        card = _card(
            episode_key=episode_key,
            rule=rule,
            subject=subject,
            evaluation=evaluation,
            first_seen_at=observation if reopened else episode.first_seen_at,
            last_evaluated_at=observation,
            acknowledged=is_acknowledged,
            acknowledged_at=None if reopened else episode.acknowledged_at,
            reopened_count=(episode.reopened_count or 0),
        )
        (acknowledged if is_acknowledged else active).append(card)

    if persist and dirty:
        db.commit()
    elif persist:
        db.rollback()

    coverage = _coverage_confidence(
        db, user_id=user_id, subjects=subjects, now=observation, as_of=as_of
    )
    active.sort(key=_rank)
    acknowledged.sort(key=_rank)
    bounded = max(int(limit), 0)
    return SignalReport(
        as_of=observation,
        limit=bounded,
        signals=tuple(active[:bounded]),
        acknowledged=tuple(acknowledged[:bounded]),
        active_total=len(active),
        zero_state=_zero_state(coverage),
        coverage=coverage,
        persisted=persist,
    )


# ─────────────────────────── acknowledgement ───────────────────────────


def acknowledge_episode(
    db: Session,
    *,
    user_id: UUID,
    episode_key: str,
    observed_fingerprint: str,
    resolution: str = SignalResolution.ACKNOWLEDGED,
    now: datetime | None = None,
) -> tuple[AASignalEpisode, bool]:
    """Record the user's dismissal against the episode. Returns ``(row, replayed)``.

    Dismissal is not deletion. It is acknowledgement of one occurrence, so it
    survives reload and ordinary input churn, and a genuinely new occurrence
    reappears on its own because it has a different ``episode_key``.

    The fingerprint the client saw must still be current. Otherwise the card on
    screen is not the card being acknowledged, and silently accepting it would
    dismiss something the user never read.
    """
    if resolution != SignalResolution.ACKNOWLEDGED:
        raise UnsupportedResolutionError
    at = now or datetime.now(UTC)
    episode = db.scalar(
        select(AASignalEpisode).where(
            AASignalEpisode.user_id == user_id,
            AASignalEpisode.episode_key == episode_key,
        )
    )
    if episode is None:
        raise EpisodeNotFoundError
    if episode.last_fingerprint != observed_fingerprint:
        raise EpisodeChangedError
    if (
        episode.resolution == SignalResolution.ACKNOWLEDGED
        and episode.acknowledged_fingerprint == observed_fingerprint
    ):
        return episode, True

    episode.resolution = SignalResolution.ACKNOWLEDGED
    episode.acknowledged_at = at
    episode.acknowledged_fingerprint = observed_fingerprint
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(episode)
    logger.info(
        "aa.signal_acknowledged",
        extra={
            "aa_user_id": str(user_id),
            "aa_rule_id": episode.rule_id,
            "aa_episode_key": episode.episode_key,
        },
    )
    return episode, False


__all__ = [
    "DEFAULT_TIMEZONE",
    "HOME_SIGNAL_LIMIT",
    "CoverageConfidence",
    "EpisodeChangedError",
    "EpisodeNotFoundError",
    "SignalCard",
    "SignalReport",
    "UnsupportedResolutionError",
    "acknowledge_episode",
    "evaluate_signals",
    "evaluation_subjects",
]
