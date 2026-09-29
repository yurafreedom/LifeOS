"""Experiment request and response shapes.

Requests forbid extra fields, so a body-supplied ``user_id`` is a 422 and never
authority. Instants must carry an offset. A decision's ``choice`` is required
but nullable: omitting it is a 422, never a silent «Пока без решения».
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.analytics.enums import (
    AdherenceDay,
    AdherenceState,
    EpistemicKind,
    ExperimentDecisionChoice,
    ExperimentLifecycle,
    ExperimentObservationRole,
    ExperimentOutcomeType,
    ExperimentResultState,
)
from app.analytics.values import FactValue, InvalidValueError, validate_value
from app.schemas.aa_common import (
    IdempotencyKey,
    ProvenanceOut,
    ValueIn,
    ValueOut,
    validate_timezone,
)
from app.schemas.aa_comparison import ComparisonOut, SemanticOut

TITLE_MAX = 200
CLAIM_MAX = 1000
LABEL_MAX = 200
FACTOR_MAX = 500
NOTE_FIELD_MAX = 500
MAX_FACTOR_CHANGES = 20
MAX_WINDOW_SPAN = 365  # window_end - window_start, i.e. at most 366 local days


def _text(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be blank")
    return stripped


def _zone(value: str) -> str:
    return validate_timezone(value)


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ─────────────────────────────── requests ───────────────────────────────


class OutcomeDefinitionIn(_Strict):
    label: str = Field(min_length=1, max_length=LABEL_MAX)
    value_type: ExperimentOutcomeType
    unit_code: str | None = Field(default=None, max_length=32)
    scale_min: Decimal | None = None
    scale_max: Decimal | None = None

    _label = field_validator("label")(_text)

    @model_validator(mode="after")
    def shape(self) -> "OutcomeDefinitionIn":
        # Reuse the value contract with a probe inside the defined bounds.
        probe = self.scale_min if self.value_type == ExperimentOutcomeType.SCALE else Decimal(0)
        try:
            validate_value(
                FactValue(
                    value_type=self.value_type,
                    unit_code=self.unit_code,
                    value_num=probe,
                    scale_min=self.scale_min,
                    scale_max=self.scale_max,
                )
            )
        except (InvalidValueError, AssertionError) as error:
            raise ValueError("outcome definition does not match its type") from error
        return self


class ExperimentCreate(_Strict):
    id: UUID
    title: str = Field(min_length=1, max_length=TITLE_MAX)
    hypothesis: str = Field(min_length=1, max_length=CLAIM_MAX)
    hypothesis_recorded_at: AwareDatetime
    intervention: str = Field(min_length=1, max_length=CLAIM_MAX)
    window_start: date
    window_end: date
    timezone: str = Field(min_length=1, max_length=64)
    outcome: OutcomeDefinitionIn
    idempotency_key: IdempotencyKey

    _texts = field_validator("title", "hypothesis", "intervention")(_text)
    _tz = field_validator("timezone")(_zone)

    @field_validator("id")
    @classmethod
    def client_uuid_v4(cls, value: UUID) -> UUID:
        if value.version != 4:
            raise ValueError("experiment id must be a UUID v4")
        return value

    @model_validator(mode="after")
    def window(self) -> "ExperimentCreate":
        if self.window_end < self.window_start:
            raise ValueError("window_end must not precede window_start")
        if (self.window_end - self.window_start).days > MAX_WINDOW_SPAN:
            raise ValueError("window must not exceed 366 days")
        return self


class TransitionCreate(_Strict):
    to: Literal["RUNNING", "COMPLETED_AWAITING_REVIEW", "REVIEWED", "ABANDONED"]
    occurred_at: AwareDatetime
    idempotency_key: IdempotencyKey


class AdherenceCreate(_Strict):
    day: date
    state: AdherenceState
    supersedes_idempotency_key: IdempotencyKey | None = None
    idempotency_key: IdempotencyKey


class ExperimentObservationCreate(_Strict):
    role: ExperimentObservationRole
    label: str = Field(min_length=1, max_length=LABEL_MAX)
    value: ValueIn
    occurred_at: AwareDatetime
    occurred_tz: str = Field(min_length=1, max_length=64)
    basis: str | None = Field(default=None, max_length=NOTE_FIELD_MAX)
    method: str | None = Field(default=None, max_length=NOTE_FIELD_MAX)
    idempotency_key: IdempotencyKey

    _label = field_validator("label")(_text)
    _tz = field_validator("occurred_tz")(_zone)


class ExperimentBaselineCreate(_Strict):
    value: ValueIn
    window_start: date
    window_end: date
    basis: str | None = Field(default=None, max_length=NOTE_FIELD_MAX)
    method: str | None = Field(default=None, max_length=NOTE_FIELD_MAX)
    idempotency_key: IdempotencyKey

    @model_validator(mode="after")
    def window(self) -> "ExperimentBaselineCreate":
        if self.window_end < self.window_start:
            raise ValueError("window_end must not precede window_start")
        return self


class ConditionCreate(_Strict):
    text: str = Field(min_length=1, max_length=LABEL_MAX)
    epistemic_kind: EpistemicKind
    occurred_at: AwareDatetime
    occurred_tz: str = Field(min_length=1, max_length=64)
    idempotency_key: IdempotencyKey

    _condition = field_validator("text")(_text)
    _tz = field_validator("occurred_tz")(_zone)


class ExperimentFactorIn(_Strict):
    text: str = Field(min_length=1, max_length=FACTOR_MAX)
    # Default is «неизвестно», never an implied cause.
    epistemic_kind: EpistemicKind = EpistemicKind.UNKNOWN
    replaces_id: UUID | None = None

    _factor = field_validator("text")(_text)


class ExperimentDecisionCreate(_Strict):
    choice: ExperimentDecisionChoice | None
    add_factors: list[ExperimentFactorIn] = Field(
        default_factory=list, max_length=MAX_FACTOR_CHANGES
    )
    retract_factor_ids: list[UUID] = Field(default_factory=list, max_length=MAX_FACTOR_CHANGES)
    idempotency_key: IdempotencyKey


# ─────────────────────────────── responses ───────────────────────────────


class WindowOut(_Strict):
    start: date
    end: date
    timezone: str
    total_days: int
    local_today: date
    window_elapsed: bool
    completion_due: bool


class OutcomeDefinitionOut(_Strict):
    label: str
    value_type: ExperimentOutcomeType
    unit_code: str | None
    scale_min: Decimal | None
    scale_max: Decimal | None


class LifecycleEventOut(_Strict):
    state: ExperimentLifecycle
    occurred_at: datetime


class AdherenceRecordOut(_Strict):
    id: UUID
    idempotency_key: str
    recorded_at: datetime
    corrected: bool


class AdherenceDayOut(_Strict):
    day: date
    state: AdherenceDay
    record: AdherenceRecordOut | None


class AdherenceOut(_Strict):
    applicable: bool
    denominator_basis: Literal["experiment_elapsed_days"]
    total_days: int
    elapsed_days: int
    kept: int
    missed: int
    unknown: int
    not_recorded: int
    future: int
    not_run_after_stop: int
    abandon_day: date | None
    days: list[AdherenceDayOut]
    correction_count: int


class ExperimentObservationOut(_Strict):
    id: UUID
    role: ExperimentObservationRole
    label: str
    value: ValueOut | None
    occurred_at: datetime
    occurred_tz: str
    provenance: ProvenanceOut
    status: str
    supersedes_id: UUID | None
    superseded_by_id: UUID | None


class ObservationGroupsOut(_Strict):
    outcome: list[ExperimentObservationOut]
    context: list[ExperimentObservationOut]


class ResultSummaryOut(_Strict):
    baselines: list[SemanticOut]
    observations: list[ExperimentObservationOut]


class ResultOut(_Strict):
    state: ExperimentResultState
    reason: str | None
    outcome_day: date | None
    covered_days: int | None
    summary: ResultSummaryOut
    comparison: ComparisonOut


class DecisionRevisionOut(_Strict):
    choice: ExperimentDecisionChoice | None
    revision: int
    created_at: datetime


class DecisionHistoryOut(DecisionRevisionOut):
    superseded_in_revision: int | None


class FactorOut(_Strict):
    id: UUID
    text: str
    epistemic_kind: EpistemicKind
    added_in_revision: int
    retracted_in_revision: int | None
    replaces_id: UUID | None


class DecisionOut(_Strict):
    current: DecisionRevisionOut | None
    history: list[DecisionHistoryOut]
    factors: list[FactorOut]


class ExperimentOut(_Strict):
    id: UUID
    title: str
    hypothesis: str
    hypothesis_recorded_at: datetime
    intervention: str
    created_at: datetime
    evaluated_at: datetime
    window: WindowOut
    outcome: OutcomeDefinitionOut
    lifecycle: ExperimentLifecycle
    abandoned_from: ExperimentLifecycle | None
    lifecycle_events: list[LifecycleEventOut]
    adherence: AdherenceOut
    baseline: SemanticOut | None
    baselines: list[SemanticOut]
    observations: ObservationGroupsOut
    conditions: list[SemanticOut]
    result: ResultOut
    decision: DecisionOut
    replayed: bool = False
    no_op: bool = False


class ExperimentListItemOut(_Strict):
    id: UUID
    title: str
    lifecycle: ExperimentLifecycle
    abandoned_from: ExperimentLifecycle | None
    window_start: date
    window_end: date
    timezone: str
    window_elapsed: bool
    completion_due: bool
    created_at: datetime


class ExperimentListOut(_Strict):
    lifecycles: list[ExperimentLifecycle]
    limit: int
    experiments: list[ExperimentListItemOut]


def as_payload(payload: dict[str, Any], **flags: bool) -> ExperimentOut:
    return ExperimentOut.model_validate({**payload, **flags})
