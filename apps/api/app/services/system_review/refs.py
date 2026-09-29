"""Leaf: value-free item references ("ref keys") and their grammar.

A relation endpoint, an importance target and a frozen review item name what
they are about with a ref key — never with a value. The outer separator is ``|``
because subject keys already contain ``:``.

    change|<kind>|<subject_key>|<metric_key or ->|<period>
    subject|<subject_key>
    fact|<table>|<uuid>
    context|<entity uuid>
    section|<period>|<section>
    relation|<uuid>

``change`` and ``subject`` keys carry no fact id, so corrections never orphan
them and a hard delete leaves no residue in them. ``fact`` and ``context`` keys
embed an id; the D1 redactors find them by that id. The literal ``redacted`` is
what an endpoint becomes after its source was erased.
"""

import re
from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from app.analytics.subjects import (
    InvalidSubjectError,
    SubjectRef,
    UnknownSubjectError,
    parse_subject_key,
    validate_subject,
)
from app.services.system_review.errors import InvalidRefError

SEPARATOR = "|"
REDACTED = "redacted"
MAX_REF_LENGTH = 600
PERIOD_PATTERN = re.compile(r"^(20\d{2}|2100)(-(0[1-9]|1[0-2]))?$")


class RefKind(StrEnum):
    CHANGE = "change"
    SUBJECT = "subject"
    FACT = "fact"
    CONTEXT = "context"
    SECTION = "section"
    RELATION = "relation"


class ChangeKind(StrEnum):
    FINANCE_SPEND_VS_EXPECTATION = "finance_spend_vs_expectation"
    FINANCE_SPEND_VS_PRIOR = "finance_spend_vs_prior"
    FINANCE_EXPECTATION_REVISIONS = "finance_expectation_revisions"
    FINANCE_TARGET_STATE = "finance_target_state"
    FINANCE_UNPLANNED_REPEAT = "finance_unplanned_repeat"
    PROJECT_FORECAST_REVISIONS = "project_forecast_revisions"
    PROJECT_COMPLETION = "project_completion"
    EXPERIMENT_LIFECYCLE = "experiment_lifecycle"
    OBSERVATION = "observation"


class ReviewSectionKey(StrEnum):
    CHANGED = "changed"
    IMPROVED = "improved"
    REPEATED = "repeated"
    TRADEOFFS = "tradeoffs"
    CONSEQUENCES = "consequences"
    RELATIONS = "relations"
    QUALITY = "quality"


# Fact tables a ``fact|…`` ref may name. The same tables hard deletion can reach
# (plus experiment observations), so every embedded id has a redaction path.
FACT_REF_TABLES: frozenset[str] = frozenset(
    {
        "aa_measurements",
        "aa_observations",
        "aa_targets",
        "aa_preferences",
        "aa_baselines",
        "aa_expectation_versions",
        "aa_forecast_versions",
        "aa_experiment_observations",
    }
)
CONTEXT_TABLE = "aa_finance_contexts"
_OBSERVATION_TABLES = {"aa_observations", "aa_experiment_observations"}


@dataclass(frozen=True, slots=True)
class Ref:
    kind: RefKind
    key: str
    subject: SubjectRef | None = None
    table: str | None = None
    identity: UUID | None = None
    change_kind: str | None = None
    period: str | None = None
    section: str | None = None

    @property
    def domain(self) -> str:
        """Coarse domain for filters. A fact's own domain is resolved from its row."""
        if self.kind in (RefKind.CHANGE, RefKind.SUBJECT) and self.subject is not None:
            return self.subject.subject_domain
        if self.kind is RefKind.FACT:
            return "observation" if self.table in _OBSERVATION_TABLES else "fact"
        if self.kind is RefKind.CONTEXT:
            return "finance"
        if self.kind is RefKind.SECTION:
            return "review"
        return "relation"


def _subject(value: str) -> SubjectRef:
    try:
        return validate_subject(parse_subject_key(value))
    except (InvalidSubjectError, UnknownSubjectError):
        raise InvalidRefError from None


def _uuid(value: str) -> UUID:
    try:
        parsed = UUID(value)
    except ValueError:
        raise InvalidRefError from None
    if str(parsed) != value.lower():
        raise InvalidRefError
    return parsed


def valid_period(value: str) -> bool:
    return bool(PERIOD_PATTERN.match(value or ""))


def parse_ref(key: str) -> Ref:
    """Validate a ref key's grammar. Ownership is checked by the caller."""
    if not isinstance(key, str) or not (3 <= len(key) <= MAX_REF_LENGTH):
        raise InvalidRefError
    parts = key.split(SEPARATOR)
    head = parts[0]
    if head == RefKind.CHANGE and len(parts) == 5:
        _, kind, subject_key, metric, period = parts
        if kind not in {member.value for member in ChangeKind} or not valid_period(period):
            raise InvalidRefError
        if metric != "-" and not re.fullmatch(r"[a-z0-9_.]{3,100}", metric):
            raise InvalidRefError
        return Ref(
            RefKind.CHANGE, key, subject=_subject(subject_key), change_kind=kind, period=period
        )
    if head == RefKind.SUBJECT and len(parts) == 2:
        return Ref(RefKind.SUBJECT, key, subject=_subject(parts[1]))
    if head == RefKind.FACT and len(parts) == 3:
        if parts[1] not in FACT_REF_TABLES:
            raise InvalidRefError
        return Ref(RefKind.FACT, key, table=parts[1], identity=_uuid(parts[2]))
    if head == RefKind.CONTEXT and len(parts) == 2:
        return Ref(RefKind.CONTEXT, key, table=CONTEXT_TABLE, identity=_uuid(parts[1]))
    if head == RefKind.SECTION and len(parts) == 3:
        if not valid_period(parts[1]) or parts[2] not in {m.value for m in ReviewSectionKey}:
            raise InvalidRefError
        return Ref(RefKind.SECTION, key, period=parts[1], section=parts[2])
    if head == RefKind.RELATION and len(parts) == 2:
        return Ref(RefKind.RELATION, key, identity=_uuid(parts[1]))
    raise InvalidRefError


def change_ref(kind: str, subject_key: str, metric_key: str | None, period: str) -> str:
    return SEPARATOR.join((RefKind.CHANGE, kind, subject_key, metric_key or "-", period))


def subject_ref(subject_key: str) -> str:
    return SEPARATOR.join((RefKind.SUBJECT, subject_key))


def fact_ref(table: str, identity: UUID | str) -> str:
    return SEPARATOR.join((RefKind.FACT, table, str(identity)))


def context_ref(entity_id: UUID | str) -> str:
    return SEPARATOR.join((RefKind.CONTEXT, str(entity_id)))


def section_ref(period: str, section: str) -> str:
    return SEPARATOR.join((RefKind.SECTION, period, section))


def relation_ref(relation_id: UUID | str) -> str:
    return SEPARATOR.join((RefKind.RELATION, str(relation_id)))


def embeds(key: str | None, table: str, identity: UUID) -> bool:
    """Whether ``key`` names the row ``(table, identity)`` — the redaction test."""
    if not key or key == REDACTED:
        return False
    try:
        ref = parse_ref(key)
    except InvalidRefError:
        return False
    return ref.identity == identity and ref.table == table


def id_bearing_sources(key: str) -> list[tuple[str, str]]:
    """``[(table, id)]`` a ref key depends on, for frozen-item source manifests."""
    try:
        ref = parse_ref(key)
    except InvalidRefError:
        return []
    if ref.kind in (RefKind.FACT, RefKind.CONTEXT) and ref.identity is not None:
        return [(ref.table or "", str(ref.identity))]
    return []
