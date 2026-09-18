"""Concept-specific writes; shared, explicitly labelled read infrastructure."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.analytics.enums import (
    DesiredDirection,
    EpistemicKind,
    FactStatus,
    ObservationAvailability,
    SupersedeKind,
    ValueType,
)
from app.schemas.aa_common import (
    IdempotencyKey,
    ProvenanceIn,
    ProvenanceOut,
    SubjectIn,
    ValueIn,
    ValueOut,
    validate_timezone,
)

Direction = DesiredDirection


class SemanticCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject: SubjectIn
    metric_key: str | None = Field(default=None, min_length=1, max_length=200)
    provenance: ProvenanceIn
    idempotency_key: IdempotencyKey


class ValuedCreate(SemanticCreate):
    value: ValueIn
    dimensions: dict[str, Any] | None = None


class Window(BaseModel):
    model_config = ConfigDict(extra="forbid")
    window_start: date
    window_end: date
    timezone: str = Field(min_length=1, max_length=64)

    @field_validator("timezone")
    @classmethod
    def zone(cls, value):
        return validate_timezone(value)

    @model_validator(mode="after")
    def ordered(self):
        if self.window_end < self.window_start:
            raise ValueError("window_end must not precede window_start")
        if (self.window_end - self.window_start).days > 3660 or self.window_end == date.max:
            raise ValueError("window must not exceed 3661 days")
        return self


class ExpectationCreate(ValuedCreate, Window):
    effective_from: AwareDatetime


class ForecastCreate(ValuedCreate):
    horizon_at: AwareDatetime


class BaselineCreate(ValuedCreate, Window):
    pass


class TargetCreate(SemanticCreate, Window):
    value: ValueIn | None = None
    is_explicitly_absent: bool = False
    desired_direction: Direction
    # Domain shape remains known for intentionally absent values.
    declared_value_type: ValueType | None = None
    dimensions: dict[str, Any] | None = None

    @model_validator(mode="after")
    def absence(self):
        if (self.value is not None) == self.is_explicitly_absent:
            raise ValueError("value_or_absent_required")
        if self.value is None and self.metric_key is None and self.declared_value_type is None:
            raise ValueError("declared_value_type required without metric for explicit absence")
        if self.value and self.declared_value_type and self.value.type != self.declared_value_type:
            raise ValueError("declared_value_type does not match value")
        return self


class PreferenceCreate(SemanticCreate):
    statement: str = Field(min_length=1, max_length=2000)
    desired_direction: Direction
    effective_from: AwareDatetime


class ObservationCreate(SemanticCreate):
    value: ValueIn | None = None
    declared_value_type: ValueType | None = None
    value_availability: ObservationAvailability = ObservationAvailability.PRESENT
    epistemic_kind: EpistemicKind = EpistemicKind.UNKNOWN
    occurred_at: AwareDatetime
    occurred_tz: str = Field(min_length=1, max_length=64)
    dimensions: dict[str, Any] | None = None

    @field_validator("occurred_tz")
    @classmethod
    def zone(cls, value):
        return validate_timezone(value)

    @model_validator(mode="after")
    def availability(self):
        if (self.value is not None) != (self.value_availability == "present"):
            raise ValueError("value must be present exactly when availability is present")
        if self.value is None and self.metric_key is None and self.declared_value_type is None:
            raise ValueError("declared_value_type required for explicit unknown without metric")
        if self.value and self.declared_value_type and self.value.type != self.declared_value_type:
            raise ValueError("declared_value_type does not match value")
        return self


class Policy(BaseModel):
    model_config = ConfigDict(extra="forbid")
    exclude_categories: list[str] = Field(default_factory=list, max_length=200)
    default: Literal["include", "exclude"] = "include"


class PolicyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    metric_key: str = Field(min_length=1, max_length=200)
    policy: Policy
    effective_from: AwareDatetime
    provenance: ProvenanceIn
    idempotency_key: IdempotencyKey


class OverrideCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    metric_key: str = Field(min_length=1, max_length=200)
    source_table: Literal["aa_measurements"] = "aa_measurements"
    source_fact_id: UUID
    included: bool
    provenance: ProvenanceIn
    idempotency_key: IdempotencyKey


class SemanticOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    concept: Literal["expectation", "forecast", "baseline", "target", "preference", "observation"]
    fact_table: str
    subject_key: str
    metric_key: str | None
    value: ValueOut | None
    value_type: ValueType | None
    dimensions: dict[str, Any] | None
    provenance: ProvenanceOut
    status: FactStatus
    supersedes_id: UUID | None
    superseded_by_id: UUID | None
    superseded_at: datetime | None
    supersede_kind: SupersedeKind | None
    supersede_reason: str | None
    effective_from: datetime | None = None
    horizon_at: datetime | None = None
    window_start: date | None = None
    window_end: date | None = None
    timezone: str | None = None
    occurred_at: datetime | None = None
    occurred_tz: str | None = None
    is_explicitly_absent: bool | None = None
    desired_direction: Direction | None = None
    statement: str | None = None
    epistemic_kind: EpistemicKind | None = None
    value_availability: ObservationAvailability | None = None

    @classmethod
    def from_row(cls, row, concept):
        payload = {name: getattr(row, name) for name in cls.model_fields if hasattr(row, name)}
        unavailable = (
            row.status == "tombstoned"
            or getattr(row, "is_explicitly_absent", False)
            or getattr(row, "value_availability", None) == "explicitly_unknown"
        )
        payload.update(
            concept=concept,
            fact_table=row.__tablename__,
            value=ValueOut.from_row(row)
            if hasattr(row, "value_type") and not unavailable
            else None,
            value_type=getattr(row, "value_type", None),
            dimensions=getattr(row, "dimensions", None),
            provenance=ProvenanceOut.from_row(row),
        )
        return cls(**payload)


class DerivedDeltaOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: Literal["known", "unknown", "not_applicable"]
    type: ValueType | None = None
    num: Decimal | None = None
    unit_code: str | None = None
    scale_min: Decimal | None = None
    scale_max: Decimal | None = None
    reason: str | None = None


class ComparisonOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    metric_key: str | None
    current_concept: Literal["actual", "forecast", "observation"] | None
    current_id: UUID | None
    reference_concept: Literal["expectation", "baseline"] | None
    reference_id: UUID | None
    availability: Literal["present", "no_data", "insufficient_data"]
    delta: DerivedDeltaOut
    desire: Literal["neutral", "favorable", "unfavorable", "unknown"]
    grounding_id: str | None
    grounding_kind: Literal["target", "preference", "decision"] | None
    # Coverage is a read-only explicit-evidence report, never inferred from presence.
    coverage: dict[str, Any] | None = None
