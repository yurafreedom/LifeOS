"""Adaptive Analytics enumerations.

Enumerations are persisted as ``TEXT`` columns guarded by ``CHECK`` constraints
rather than PostgreSQL native enums: a CHECK can be dropped and recreated inside
an ordinary transactional migration, while ``ALTER TYPE ... ADD VALUE`` cannot be
combined freely with dependent DDL and its values can never be removed.

The Python members below are the source of truth. ``check_in`` renders the SQL
membership predicate from them, and ``tests/test_aa_schema_guards.py`` asserts
that the constraints actually installed in the database admit exactly these
members, so schema and code cannot drift apart silently.
"""

from enum import StrEnum


class ValueType(StrEnum):
    """Domain shape of a stored value.

    There is deliberately **no** ``unknown`` member. A stored fact always
    carries a real value of its declared shape; a missing observation is the
    absence of a row, never a synthesized one (correction C5).
    """

    MONEY = "money"
    DATE = "date"
    DURATION = "duration"
    COUNT = "count"
    SCALE = "scale"
    CATEGORICAL = "categorical"


class DesiredDirection(StrEnum):
    HIGHER = "higher"
    LOWER = "lower"


class EpistemicKind(StrEnum):
    OBSERVED = "observed"
    MINE = "mine"
    MAYBE = "maybe"
    UNKNOWN = "unknown"


class ObservationAvailability(StrEnum):
    PRESENT = "present"
    EXPLICITLY_UNKNOWN = "explicitly_unknown"


class SourceKind(StrEnum):
    """Value provenance — where the value came from.

    ``HYPOTHESIS`` is intentionally absent: a hypothesis is not the source of a
    value. ``INFERRED`` is absent as having no rendering distinct from
    ``DERIVED``. No member exists purely for symmetry.
    """

    OBSERVED = "OBSERVED"
    USER_REPORTED = "USER_REPORTED"
    IMPORTED = "IMPORTED"
    DERIVED = "DERIVED"
    ESTIMATED = "ESTIMATED"
    FORECAST = "FORECAST"
    UNKNOWN = "UNKNOWN"


class FactStatus(StrEnum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    TOMBSTONED = "tombstoned"


class SupersedeKind(StrEnum):
    """Why a row was replaced.

    ``CORRECTION`` means the earlier record was wrong; ``REVISION`` means it was
    valid when made and a newer belief replaced it. They are never conflated.
    """

    CORRECTION = "CORRECTION"
    REVISION = "REVISION"


class CoverageState(StrEnum):
    """What a source declares it covered over a local window."""

    COMPLETE = "complete"
    PARTIAL = "partial"
    NONE = "none"
    UNKNOWN = "unknown"


class DayCoverage(StrEnum):
    """Derived per-day coverage classification. Never persisted."""

    OBSERVED = "observed"
    PARTIAL = "partial"
    MISSING = "missing"
    UNKNOWN_COVERAGE = "unknown_coverage"
    FUTURE = "future"


class DerivedAvailability(StrEnum):
    """Read-time availability of a derived answer. Never persisted.

    ``NO_DATA`` is what a caller receives when the inputs a derivation needs are
    absent. It is a response state; asking the question never writes a row.
    """

    PRESENT = "present"
    NO_DATA = "no_data"


class ActualSource(StrEnum):
    """How a metric's Actual is obtained."""

    OBSERVED = "observed"
    DERIVED = "derived"


class Aggregation(StrEnum):
    NONE = "none"
    SUM = "sum"


class SignalMateriality(StrEnum):
    """How much a signal asks to be looked at. Never desirability.

    This is the ranking dimension of the Signal catalogue (plan §19). A rule may
    set it; no rule may derive ``desire`` from it. ``NORMAL`` means "this held,
    but it carries no elevated weight" — it is not "nothing happened", which is
    the absence of a signal.
    """

    NORMAL = "normal"
    INFO = "info"
    MATERIAL = "material"


class SignalState(StrEnum):
    """The accepted Signal Card visual family. Derived read-time, never stored.

    One card renders exactly one state. Materiality composes on top of it, which
    is why ``INFO``/``MATERIAL`` appear here as well as in
    :class:`SignalMateriality`: a stale card at the material tier is
    ``STALE`` + material weight, not a third state.
    """

    NORMAL = "normal"
    MATERIAL = "material"
    INFO = "info"
    STALE = "stale"
    PARTIAL = "partial"
    RESOLVED = "resolved"


class SignalResolution(StrEnum):
    """Why an episode is no longer an active card.

    ``ACKNOWLEDGED`` is the user's own «скрыть»; ``WITHDRAWN`` is the rule
    observing that its condition stopped holding. They are never conflated: a
    withdrawn episode keeps whatever acknowledgement it already carried, because
    the card disappearing is not a reason to forget that the user dismissed it.
    """

    ACKNOWLEDGED = "acknowledged"
    WITHDRAWN = "withdrawn"


class ZeroSignalState(StrEnum):
    """What "no active signals" is allowed to mean. Derived, never stored.

    ``CONFIDENT`` requires coverage evidence. Absence of cards over data whose
    completeness is unknown is ``UNKNOWN_COVERAGE`` — reassurance the evidence
    does not support would be a lie in the user's favour.
    """

    CONFIDENT = "confident"
    UNKNOWN_COVERAGE = "unknown_coverage"
    NO_DATA = "no_data"


class DenominatorBasis(StrEnum):
    """What a coverage denominator counts."""

    CALENDAR_DAYS = "calendar_days"
    EXPERIMENT_ELAPSED_DAYS = "experiment_elapsed_days"
    EXPECTED_OBSERVATIONS = "expected_observations"


class ReviewSection(StrEnum):
    """Where a frozen Review context item is shown. Layout, never meaning."""

    COMPARE = "compare"
    QUALITY = "quality"
    ALONGSIDE = "alongside"


class ReviewRole(StrEnum):
    """What a frozen Review context item is.

    The concepts stay as separate as they are in the fact tables: an
    ``expected`` item is never a ``target``, and a ``forecast`` item is never an
    ``actual``.
    """

    EXPECTED = "expected"
    FORECAST = "forecast"
    ACTUAL = "actual"
    DELTA = "delta"
    TARGET = "target"
    COVERAGE = "coverage"
    OBSERVATION = "observation"


class ReviewAvailability(StrEnum):
    """What the user saw in place of, or as, a value when the Review was saved.

    These are frozen *display* states of a Review, not facts: a ``no_data``
    item records that the comparison had nothing to show, and no Measurement or
    other fact row is ever written for it.
    """

    PRESENT = "present"
    NO_DATA = "no_data"
    INSUFFICIENT_DATA = "insufficient_data"
    NOT_APPLICABLE = "not_applicable"
    EXPLICITLY_ABSENT = "explicitly_absent"
    EXPLICITLY_UNKNOWN = "explicitly_unknown"


class Desire(StrEnum):
    NEUTRAL = "neutral"
    FAVORABLE = "favorable"
    UNFAVORABLE = "unfavorable"
    UNKNOWN = "unknown"


class ReviewDecisionChoice(StrEnum):
    """The user's own «что дальше». Never suggested by the system.

    There is no member for "no decision": that is ``NULL``, and it is not
    ``INCONCLUSIVE``. «Пока без решения» means nothing was decided;
    «Непонятно — данных недостаточно» is a decision that the evidence does
    not settle the question.
    """

    KEEP = "keep"
    ADJUST = "adjust"
    LATER = "later"
    INCONCLUSIVE = "inconclusive"


class DecisionScope(StrEnum):
    """What a decision or factor belongs to.

    Each scope has its own choice vocabulary (``ReviewDecisionChoice``,
    ``ExperimentDecisionChoice``); the database pins each vocabulary to its
    scope, so a Review can never store ``reject`` and an Experiment never
    ``adjust``.
    """

    REVIEW = "review"
    EXPERIMENT = "experiment"


class ExperimentLifecycle(StrEnum):
    """Where an Experiment is in its own life. Never an outcome (owner decision D4).

    ``REVIEWED`` and ``ABANDONED`` are terminal. ``ABANDONED`` means the
    experiment was stopped; it says nothing about whether the hypothesis held,
    and a decision never moves an experiment between these states.
    """

    DRAFT = "DRAFT"
    RUNNING = "RUNNING"
    COMPLETED_AWAITING_REVIEW = "COMPLETED_AWAITING_REVIEW"
    REVIEWED = "REVIEWED"
    ABANDONED = "ABANDONED"


class AdherenceState(StrEnum):
    """What the user recorded for one elapsed local day. The only stored states.

    ``unknown`` is an explicit answer («не помню»); a day with no row is
    ``not_recorded``, which is derived and never stored.
    """

    KEPT = "kept"
    MISSED = "missed"
    UNKNOWN = "unknown"


class AdherenceDay(StrEnum):
    """Derived per-day adherence classification. Never persisted.

    ``FUTURE``, ``NOT_RECORDED`` and ``NOT_RUN_AFTER_STOP`` exist only at read
    time: a future day is not a miss, a day without a record is not ``unknown``,
    and a day after the experiment was stopped was never run at all.
    """

    KEPT = "kept"
    MISSED = "missed"
    UNKNOWN = "unknown"
    NOT_RECORDED = "not_recorded"
    FUTURE = "future"
    NOT_RUN_AFTER_STOP = "not_run_after_stop"


class ExperimentObservationRole(StrEnum):
    """``outcome`` is a value of the experiment's own outcome definition;
    ``context`` is anything else the user measured alongside it."""

    OUTCOME = "outcome"
    CONTEXT = "context"


class ExperimentOutcomeType(StrEnum):
    """Outcome shapes that ``compute_delta`` can compare. Categorical and date
    are excluded: they cannot, or should not, be subtracted."""

    MONEY = "money"
    DURATION = "duration"
    COUNT = "count"
    SCALE = "scale"


class ExperimentDecisionChoice(StrEnum):
    """The user's own «что дальше» for an Experiment. Never suggested.

    As with Reviews there is no member for "no decision": that is ``NULL``, and
    it is not ``INCONCLUSIVE``. ``MODIFY`` and ``LONGER`` describe a *next*
    attempt; they never reopen this one.
    """

    KEEP = "keep"
    MODIFY = "modify"
    LONGER = "longer"
    REJECT = "reject"
    INCONCLUSIVE = "inconclusive"


class ExperimentResultState(StrEnum):
    """Read-time state of an Experiment's result. Never persisted, never causal."""

    NOT_APPLICABLE = "not_applicable"
    TOO_EARLY = "too_early"
    NO_DATA = "no_data"
    KNOWN = "known"


class RedactionReason(StrEnum):
    SOURCE_HARD_DELETED = "source_hard_deleted"


class ReviewSourceState(StrEnum):
    """How a frozen item's sources stand *now*. Derived at read time, never stored.

    ``CORRECTED`` (the source was wrong) and ``REVISED`` (a newer belief
    replaced a valid one) are kept apart, exactly like ``SupersedeKind``.
    """

    CURRENT = "current"
    CORRECTED = "corrected"
    REVISED = "revised"
    WITHDRAWN = "withdrawn"
    REDACTED = "redacted"


def members(enum_cls: type[StrEnum]) -> tuple[str, ...]:
    return tuple(member.value for member in enum_cls)


def check_in(column: str, enum_cls: type[StrEnum]) -> str:
    """Render ``column IN ('a', 'b', ...)`` for a CHECK constraint."""
    allowed = ", ".join(f"'{value}'" for value in members(enum_cls))
    return f"{column} IN ({allowed})"
