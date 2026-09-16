"""Measurement request and response contracts."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.analytics.enums import (
    DenominatorBasis,
    FactStatus,
    SupersedeKind,
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

TimezoneName = Annotated[str, Field(min_length=1, max_length=64)]


class MeasurementCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_key: str = Field(min_length=1, max_length=200)
    subject: SubjectIn
    value: ValueIn
    occurred_at: datetime
    occurred_tz: TimezoneName
    provenance: ProvenanceIn
    # Written once, at record time, so that a later policy question can be
    # answered without re-reading mutable current state.
    dimensions: dict[str, Any] | None = None
    idempotency_key: IdempotencyKey

    @field_validator("occurred_tz")
    @classmethod
    def check_timezone(cls, value: str) -> str:
        return validate_timezone(value)


class MeasurementCorrect(BaseModel):
    """A correction states that the earlier record was wrong.

    It never carries a new ``occurred_at``: correcting a value does not move the
    event. Only the value, its dimensions and the reason may change.
    """

    model_config = ConfigDict(extra="forbid")

    value: ValueIn
    reason: str = Field(min_length=1, max_length=500)
    provenance: ProvenanceIn
    dimensions: dict[str, Any] | None = None
    idempotency_key: IdempotencyKey


class MeasurementOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    metric_key: str
    subject_key: str
    subject_domain: str
    subject_type: str
    subject_id: str
    value: ValueOut
    dimensions: dict[str, Any] | None
    occurred_at: datetime
    occurred_tz: str
    provenance: ProvenanceOut
    status: FactStatus
    supersedes_id: UUID | None
    superseded_by_id: UUID | None
    superseded_at: datetime | None
    supersede_kind: SupersedeKind | None
    supersede_reason: str | None

    @classmethod
    def from_row(cls, row: Any) -> "MeasurementOut":
        return cls(
            id=row.id,
            metric_key=row.metric_key,
            subject_key=row.subject_key,
            subject_domain=row.subject_domain,
            subject_type=row.subject_type,
            subject_id=row.subject_id,
            value=ValueOut.from_row(row),
            dimensions=row.dimensions,
            occurred_at=row.occurred_at,
            occurred_tz=row.occurred_tz,
            provenance=ProvenanceOut.from_row(row),
            status=FactStatus(row.status),
            supersedes_id=row.supersedes_id,
            superseded_by_id=row.superseded_by_id,
            superseded_at=row.superseded_at,
            supersede_kind=SupersedeKind(row.supersede_kind) if row.supersede_kind else None,
            supersede_reason=row.supersede_reason,
        )


class CorrectionOut(BaseModel):
    """The replacement, plus a reference to the original it supersedes."""

    model_config = ConfigDict(extra="forbid")

    measurement: MeasurementOut
    superseded: MeasurementOut


class CoverageReportOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    window_start: str
    window_end: str
    timezone: str
    denominator_basis: DenominatorBasis
    expected_denominator: int
    observed_count: int
    partial_count: int
    missing_count: int
    unknown_coverage_count: int
    future_count: int
    estimated_count: int
    corrected_count: int
    freshest_recorded_at: datetime | None
    has_legacy_imports: bool
    reason: str | None


class MetricHistoryOut(BaseModel):
    """Layered history.

    Each layer is its own array. An Actual is never mixed into the forecast
    list, so "how many forecast versions" needs no filter to be correct. The
    layers beyond ``actual`` have no storage yet and are always empty here;
    their tables arrive with the semantic-comparison slice.
    """

    model_config = ConfigDict(extra="forbid")

    metric_key: str
    subject_key: str | None
    range_from: datetime
    range_to: datetime
    as_of: datetime | None
    actual: list[MeasurementOut]
    expectations: list[MeasurementOut] = Field(default_factory=list)
    forecasts: list[MeasurementOut] = Field(default_factory=list)
    baselines: list[MeasurementOut] = Field(default_factory=list)
    events: list[MeasurementOut] = Field(default_factory=list)
    coverage: CoverageReportOut | None
    next_cursor: str | None


class FactProvenanceOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fact_table: str
    fact_id: UUID
    provenance: ProvenanceOut
    status: FactStatus
    supersedes_id: UUID | None
    superseded_by_id: UUID | None
    supersede_kind: SupersedeKind | None
    supersede_reason: str | None
