"""Signal read and acknowledgement payloads.

``rendered_values`` deliberately carries values, never rendered copy: production
copy lives in the client's ru/uk dictionaries, so the API cannot hardcode a
language. The client composes the card's sentence from ``rule_id`` plus these
values.
"""

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.analytics.enums import (
    SignalMateriality,
    SignalResolution,
    SignalState,
    ZeroSignalState,
)
from app.schemas.aa_common import IdempotencyKey

Fingerprint = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class SignalCardOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    episode_key: str
    rule_id: str
    rule_version: int
    subject_domain: str
    subject_type: str
    subject_id: str
    subject_key: str
    # The accepted visual family. `resolved` is episode state, never a verdict.
    state: SignalState
    # The ranking dimension. Never desirability — no rule may set `desire`.
    materiality: SignalMateriality
    stakes: bool
    rendered_values: dict[str, Any]
    provenance: dict[str, Any]
    # sha256 over the exact input version ids this card was derived from. The
    # client returns it when acknowledging, so a card that changed underneath
    # cannot be dismissed unseen.
    input_fingerprint: Fingerprint
    first_seen_at: datetime
    last_evaluated_at: datetime
    acknowledged: bool
    acknowledged_at: datetime | None
    reopened_count: int

    @classmethod
    def from_card(cls, card) -> "SignalCardOut":
        return cls(
            episode_key=card.episode_key,
            rule_id=card.rule_id,
            rule_version=card.rule_version,
            subject_domain=card.subject_domain,
            subject_type=card.subject_type,
            subject_id=card.subject_id,
            subject_key=card.subject_key,
            state=card.state,
            materiality=card.materiality,
            stakes=card.stakes,
            rendered_values=dict(card.rendered_values),
            provenance=dict(card.provenance),
            input_fingerprint=card.input_fingerprint,
            first_seen_at=card.first_seen_at,
            last_evaluated_at=card.last_evaluated_at,
            acknowledged=card.acknowledged,
            acknowledged_at=card.acknowledged_at,
            reopened_count=card.reopened_count,
        )


class CoverageConfidenceOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subjects_evaluated: int
    subjects_with_coverage_window: int
    subjects_with_coverage_evidence: int
    subjects_with_unknown_coverage: int


class SignalsOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    as_of: datetime
    limit: int
    signals: list[SignalCardOut]
    # Episodes whose condition still holds but which the user has already
    # dismissed. Present so the accepted `resolved` state is renderable from real
    # evaluation data; bounded by the same limit, never an all-history read.
    acknowledged: list[SignalCardOut]
    active_total: int
    # Why there are no active cards. Absence of signals over data whose coverage
    # nobody vouched for is `unknown_coverage`, never `confident`.
    zero_state: ZeroSignalState
    coverage: CoverageConfidenceOut
    # False when the AA write gate is closed: signals were evaluated read-only
    # and no episode state was recorded.
    persisted: bool

    @classmethod
    def from_report(cls, report) -> "SignalsOut":
        return cls(
            as_of=report.as_of,
            limit=report.limit,
            signals=[SignalCardOut.from_card(card) for card in report.signals],
            acknowledged=[SignalCardOut.from_card(card) for card in report.acknowledged],
            active_total=report.active_total,
            zero_state=report.zero_state,
            coverage=CoverageConfidenceOut(
                subjects_evaluated=report.coverage.subjects_evaluated,
                subjects_with_coverage_window=report.coverage.subjects_with_coverage_window,
                subjects_with_coverage_evidence=report.coverage.subjects_with_coverage_evidence,
                subjects_with_unknown_coverage=report.coverage.subjects_with_unknown_coverage,
            ),
            persisted=report.persisted,
        )


class EpisodeAcknowledge(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Only acknowledgement is a user action. Withdrawal is the rule observing that
    # its own condition stopped holding, which no client may assert.
    resolution: Literal[SignalResolution.ACKNOWLEDGED] = SignalResolution.ACKNOWLEDGED
    input_fingerprint: Fingerprint
    # Accepted for queue compatibility. Idempotency is established by the episode
    # identity itself, so replaying an acknowledgement is a 200, not a duplicate.
    idempotency_key: IdempotencyKey | None = None


class EpisodeOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    episode_key: str
    rule_id: str
    rule_version: int
    subject_key: str
    resolution: SignalResolution | None
    first_seen_at: AwareDatetime
    last_evaluated_at: AwareDatetime
    last_fingerprint: Fingerprint
    acknowledged_at: AwareDatetime | None
    acknowledged_fingerprint: Fingerprint | None
    reopened_at: AwareDatetime | None
    reopened_count: int
    replayed: bool = False

    @classmethod
    def from_row(cls, row, *, replayed: bool = False) -> "EpisodeOut":
        return cls(
            episode_key=row.episode_key,
            rule_id=row.rule_id,
            rule_version=row.rule_version,
            subject_key=row.subject_key,
            resolution=row.resolution,
            first_seen_at=row.first_seen_at,
            last_evaluated_at=row.last_evaluated_at,
            last_fingerprint=row.last_fingerprint,
            acknowledged_at=row.acknowledged_at,
            acknowledged_fingerprint=row.acknowledged_fingerprint,
            reopened_at=row.reopened_at,
            reopened_count=row.reopened_count,
            replayed=replayed,
        )
