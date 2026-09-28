"""Review / Debrief request and response shapes.

Requests forbid extra fields, so a body-supplied ``user_id`` is a 422 and never
authority. A save carries **no frozen values**: only the instant the context was
derived and its fingerprint. The server re-derives the context itself and stores
its own result, so a client can never write a "source-derived" value.
"""

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.analytics.enums import (
    Desire,
    EpistemicKind,
    ReviewAvailability,
    ReviewDecisionChoice,
    ReviewRole,
    ReviewSection,
    ReviewSourceState,
    SourceKind,
)
from app.schemas.aa_common import IdempotencyKey, SubjectIn, ValueOut, validate_timezone

MAX_FACTORS = 50
NOTE_MAX = 4000
FACTOR_MAX = 500


def _clean_note(value: str | None) -> str | None:
    """A note of only whitespace is no note. Content is otherwise kept as written."""
    if value is None:
        return None
    return value if value.strip() else None


class FactorIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=FACTOR_MAX)
    # Default is «неизвестно», never an implied cause.
    epistemic_kind: EpistemicKind = EpistemicKind.UNKNOWN

    @field_validator("text")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("factor text must not be blank")
        return value.strip()


class RevisedFactorIn(FactorIn):
    # Links a re-worded or re-tagged factor to the one it replaces, so history
    # reads "this became that" instead of an unrelated removal and addition.
    replaces_id: UUID | None = None


class DecisionIn(BaseModel):
    """``choice`` is required but may be ``null`` — «Пока без решения».

    Omitting ``decision`` altogether is a skipped step, which stores nothing.
    """

    model_config = ConfigDict(extra="forbid")

    choice: ReviewDecisionChoice | None


class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: SubjectIn
    window_start: date
    window_end: date
    timezone: str = Field(min_length=1, max_length=64)
    context_as_of: datetime
    context_fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    note_text: str | None = Field(default=None, max_length=NOTE_MAX)
    factors: list[FactorIn] = Field(default_factory=list, max_length=MAX_FACTORS)
    decision: DecisionIn | None = None
    idempotency_key: IdempotencyKey

    _note = field_validator("note_text")(_clean_note)

    @field_validator("timezone")
    @classmethod
    def known_timezone(cls, value: str) -> str:
        return validate_timezone(value)

    @field_validator("context_as_of")
    @classmethod
    def aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("context_as_of requires an offset")
        return value


class ReviewRevise(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note_text: str | None = Field(default=None, max_length=NOTE_MAX)
    add_factors: list[RevisedFactorIn] = Field(default_factory=list, max_length=MAX_FACTORS)
    retract_factor_ids: list[UUID] = Field(default_factory=list, max_length=MAX_FACTORS)
    decision: DecisionIn | None = None
    idempotency_key: IdempotencyKey

    _note = field_validator("note_text")(_clean_note)

    @property
    def changes_decision(self) -> bool:
        return "decision" in self.model_fields_set and self.decision is not None


class ItemProvenanceOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_kind: SourceKind | None
    basis: str | None
    method: str | None
    recorded_at: datetime | None
    original_recorded_at_known: bool | None


class ContextItemOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ordinal: int
    section: ReviewSection
    role: ReviewRole
    label_key: str
    metric_key: str | None
    availability: ReviewAvailability | None
    value: ValueOut | None
    desire: Desire | None
    epistemic_kind: EpistemicKind | None
    estimate: bool
    provenance: ItemProvenanceOut | None
    redacted: bool = False
    # Present on a saved Review only: how the item's sources stand now. The
    # frozen value above is never replaced by ``current_value``; it sits beside it.
    source_state: ReviewSourceState | None = None
    source_flags: list[ReviewSourceState] = Field(default_factory=list)
    current_value: ValueOut | None = None


class ReviewContextOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject_key: str
    window_start: date
    window_end: date
    timezone: str
    context_as_of: datetime
    context_fingerprint: str
    manifest: dict[str, Any]
    items: list[ContextItemOut]


class RevisionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    revision: int
    created_at: datetime
    note_text: str | None


class FactorOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    ordinal: int
    text: str
    epistemic_kind: EpistemicKind
    added_in_revision: int
    retracted_in_revision: int | None
    replaces_id: UUID | None


class DecisionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    choice: ReviewDecisionChoice | None
    revision: int
    superseded_in_revision: int | None
    created_at: datetime


class ReviewSubjectOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    domain: str
    type: str
    id: str


class ReviewOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    subject: ReviewSubjectOut
    subject_key: str
    window_start: date
    window_end: date
    timezone: str
    context_as_of: datetime
    created_at: datetime
    revised_at: datetime | None
    current_revision: int
    manifest: dict[str, Any]
    items: list[ContextItemOut]
    revisions: list[RevisionOut]
    factors: list[FactorOut]
    # ``decision`` is the current one. ``None`` here means the step was skipped;
    # a decision whose ``choice`` is ``None`` means «Пока без решения».
    decision: DecisionOut | None
    decisions: list[DecisionOut]
    replayed: bool = False


class ReviewSummaryOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    subject_key: str
    window_start: date
    window_end: date
    created_at: datetime
    revised_at: datetime | None
    current_revision: int
    decision_state: Literal["none", "undecided", "chosen"]
    decision_choice: ReviewDecisionChoice | None


class ReviewListOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject_key: str
    limit: int
    reviews: list[ReviewSummaryOut]
