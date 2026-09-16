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


class DenominatorBasis(StrEnum):
    """What a coverage denominator counts."""

    CALENDAR_DAYS = "calendar_days"
    EXPERIMENT_ELAPSED_DAYS = "experiment_elapsed_days"
    EXPECTED_OBSERVATIONS = "expected_observations"


def members(enum_cls: type[StrEnum]) -> tuple[str, ...]:
    return tuple(member.value for member in enum_cls)


def check_in(column: str, enum_cls: type[StrEnum]) -> str:
    """Render ``column IN ('a', 'b', ...)`` for a CHECK constraint."""
    allowed = ", ".join(f"'{value}'" for value in members(enum_cls))
    return f"{column} IN ({allowed})"
