"""Signal rule catalogue v1 — exactly the four rules plan §19 admits.

A signal is a **derived interpretation over durable AA facts**. It is not an
Actual, a Forecast, an Expectation, a Target, a recommendation, a notification or
a score, and evaluating one never invents a semantic measurement so that a card
has something to show: a rule that finds nothing returns ``None``.

Each rule is its own module implementing :class:`SignalRule`, and the registry
below is the only place that knows the catalogue. Rules are deliberately not
branches of a shared engine — a single ``if rule_id == ...`` evaluator is how a
rule quietly acquires another rule's thresholds.

Two identities, never collapsed (plan §13, correction C2):

* ``episode_key`` — the rule's own occurrence identity. Acknowledgement, dedup
  and reappearance hang off it. Its rule-defined tail is the ``discriminator``.
* ``input_fingerprint`` — ``sha256`` over the exact input version ids one
  evaluation read. Audit, reproducibility and correction re-evaluation hang off
  it. It may change while the episode does not.

Materiality is not desirability. Every rule sets ``materiality``/``stakes``; no
rule imports or references :mod:`app.services.aa_desirability`, and a test
asserts that none ever does. A delta's sign says nothing about whether the
change is wanted.
"""

import hashlib
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Protocol, runtime_checkable

from sqlalchemy.orm import Session

from app.analytics.enums import SignalMateriality, SignalState
from app.analytics.subjects import SubjectRef

EPISODE_KEY_SEPARATOR = ":"


def input_fingerprint(input_version_ids: Iterable[str]) -> str:
    """``sha256(sorted(input_version_ids))`` — the accepted fingerprint contract.

    Sorted, so the fingerprint depends on *which* versions were read and not on
    the order a query happened to return them. Newline-joined, so two ids cannot
    concatenate into a third.
    """
    joined = "\n".join(sorted(str(identity) for identity in input_version_ids))
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def compose_episode_key(
    *, rule_id: str, rule_version: int, subject_key: str, discriminator: str
) -> str:
    """``<rule_id>:<version>:<subject_key>:<discriminator>`` (plan §13.3).

    The shape is shared so keys stay readable and greppable; the discriminator —
    the part that decides what counts as one occurrence — belongs to the rule.
    """
    if not discriminator:
        raise ValueError("a rule must supply an episode discriminator")
    return EPISODE_KEY_SEPARATOR.join(
        (rule_id, str(rule_version), subject_key, discriminator)
    )


@dataclass(frozen=True, slots=True)
class FactScope:
    """Which measurement rows speak for a subject's freshness and provenance.

    A finance period has no rows of its own — its Actual is derived from the
    period's transaction facts, so its freshness is theirs. A project's rows are
    its own. Making the scope explicit keeps the stale rule from guessing.
    """

    subject_domain: str
    subject_types: tuple[str, ...]
    metric_keys: tuple[str, ...]
    occurred_from: datetime | None = None
    occurred_to: datetime | None = None


@dataclass(frozen=True, slots=True)
class SignalSubject:
    """One subject, with the window and fact scope rules evaluate it over."""

    subject: SubjectRef
    timezone: str
    window_start: date
    window_end: date
    window_id: str
    fact_scope: FactScope
    period: str | None = None

    @property
    def subject_key(self) -> str:
        return self.subject.subject_key


@dataclass(frozen=True, slots=True)
class Evaluation:
    """What one rule concluded from one exact set of inputs.

    ``rendered_values`` carries **values only** — numbers, dates, counts, codes.
    No rendered copy crosses this boundary: production copy lives in the client's
    ru/uk dictionaries, so a rule cannot hardcode a language.
    """

    materiality: SignalMateriality
    state: SignalState
    stakes: bool
    rendered_values: Mapping[str, Any]
    input_version_ids: tuple[str, ...]
    discriminator: str
    provenance: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.state is SignalState.RESOLVED:
            raise ValueError("resolved is episode state, never a rule verdict")
        forbidden = {"desire", "desirability", "desired_direction", "favorable", "unfavorable"}
        leaked = forbidden & set(self.rendered_values)
        if leaked:
            raise ValueError(f"a signal rule may not express desirability: {sorted(leaked)}")

    @property
    def input_fingerprint(self) -> str:
        return input_fingerprint(self.input_version_ids)


@runtime_checkable
class SignalRule(Protocol):
    """The contract every rule module satisfies (plan §13.2)."""

    RULE_ID: str
    RULE_VERSION: int

    def handles(self, subject: SignalSubject) -> bool:
        """Whether this rule has anything to say about this kind of subject."""

    def inputs(
        self, db: Session, *, user_id: Any, subject: SignalSubject, now: datetime, as_of: datetime | None
    ) -> Any:
        """Read the exact fact rows / semantic inputs the evaluation will use."""

    def evaluate(self, rule_inputs: Any) -> Evaluation | None:
        """``None`` when the condition does not hold. Never a synthesized value."""

    def episode_key(self, subject: SignalSubject, evaluation: Evaluation) -> str:
        """Stable rule-specific occurrence identity."""

    def reopen_on(self, episode: Any, evaluation: Evaluation) -> bool:
        """Whether a changed fingerprint means this is a new occurrence."""


def _registry() -> tuple[SignalRule, ...]:
    # Imported lazily so a rule module may import this package's helpers.
    from app.analytics.rules import (
        coverage_partial,
        data_stale,
        finance_threshold,
        project_forecast_revision,
    )

    return (
        finance_threshold,  # type: ignore[return-value]
        project_forecast_revision,  # type: ignore[return-value]
        data_stale,  # type: ignore[return-value]
        coverage_partial,  # type: ignore[return-value]
    )


def signal_rules() -> tuple[SignalRule, ...]:
    """The canonical catalogue, in a deterministic order.

    Exactly four. A fifth rule is a product decision, not an implementation
    detail, and does not belong to this slice.
    """
    rules = _registry()
    identifiers = [rule.RULE_ID for rule in rules]
    if len(set(identifiers)) != len(identifiers):
        raise RuntimeError("duplicate signal rule id in the catalogue")
    return rules


def rules_for(subject: SignalSubject, rules: Sequence[SignalRule] | None = None):
    for rule in rules if rules is not None else signal_rules():
        if rule.handles(subject):
            yield rule


__all__ = [
    "Evaluation",
    "FactScope",
    "SignalRule",
    "SignalSubject",
    "compose_episode_key",
    "input_fingerprint",
    "rules_for",
    "signal_rules",
]
