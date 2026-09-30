"""Finance-pilot request and response contracts."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.analytics.enums import CoverageState
from app.schemas.aa_common import IdempotencyKey, ProvenanceIn, ValueOut, validate_timezone
from app.schemas.aa_comparison import DerivedDeltaOut, Policy, SemanticOut
from app.schemas.aa_measurement import CoverageReportOut


class LegacyCoverageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_id: str = Field(min_length=1, max_length=200)
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    window_start: date
    window_end: date
    timezone: str = "Europe/Kyiv"
    coverage_state: CoverageState
    completeness_known: bool

    @field_validator("timezone")
    @classmethod
    def timezone_is_iana(cls, value: str) -> str:
        return validate_timezone(value)

    @model_validator(mode="after")
    def ordered(self):
        if self.window_end < self.window_start:
            raise ValueError("window_end must not precede window_start")
        return self


class LegacyImportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timezone: str = "Europe/Kyiv"
    coverage: list[LegacyCoverageIn] = Field(default_factory=list, max_length=120)

    @field_validator("timezone")
    @classmethod
    def timezone_is_iana(cls, value: str) -> str:
        return validate_timezone(value)


class LegacyImportOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    transactions_imported: int
    transactions_replayed: int
    policies_imported: int
    policies_replayed: int
    overrides_imported: int
    overrides_replayed: int
    coverage_imported: int
    coverage_replayed: int
    activity_log_imported: Literal[0] = 0
    expectations_backfilled: Literal[0] = 0
    forecasts_backfilled: Literal[0] = 0
    targets_backfilled: Literal[0] = 0
    baselines_backfilled: Literal[0] = 0
    synthetic_coverage_backfilled: Literal[0] = 0
    moneywidget_budget_backfilled: Literal[0] = 0


class PolicyByMeasurementKeyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    metric_key: Literal["finance.monthly_spend"] = "finance.monthly_spend"
    measurement_idempotency_key: IdempotencyKey
    included: bool
    provenance: ProvenanceIn
    idempotency_key: IdempotencyKey


class FinancePolicyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    metric_key: Literal["finance.monthly_spend"] = "finance.monthly_spend"
    policy: Policy
    effective_from: AwareDatetime
    provenance: ProvenanceIn
    idempotency_key: IdempotencyKey


class FinancePointOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: date
    amount: Decimal


class FinanceMonthOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    period: str
    subject_key: str
    timezone: str
    as_of: datetime
    availability: Literal["present", "no_data", "insufficient_data", "retention_truncated"]
    actual: ValueOut | None
    known_subtotal: ValueOut | None
    # Slice 8: the month starts before an applied retention horizon.
    retention_horizon: date | None = None
    retention_truncated: bool = False
    transaction_count: int
    excluded_count: int
    unknown_membership_count: int
    policy_known: bool
    persisted: Literal[False] = False
    derivation: str
    series: list[FinancePointOut]
    expectations: list[SemanticOut]
    targets: list[SemanticOut]
    current_expectation: SemanticOut | None
    current_target: SemanticOut | None
    delta: DerivedDeltaOut
    desire: Literal["neutral", "favorable", "unfavorable", "unknown"]
    coverage: CoverageReportOut
