"""Project Analytics read contract: Forecast versions and the Actual stay apart.

``ComparisonOut`` is not reused: its reference concept is an Expectation or a
Baseline, and a Forecast is neither. The dual delta is its own truthful shape.
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.aa_comparison import DerivedDeltaOut, SemanticOut
from app.schemas.aa_measurement import MeasurementOut

ProjectAnalyticsState = Literal[
    "no_facts",
    "too_early",
    "actual_not_recorded",
    "no_forecast",
    "compared",
    "history_deleted_by_retention",
]


class ProjectDeltaOut(BaseModel):
    """Actual minus one Forecast version. Neutral: no normative source is read."""

    model_config = ConfigDict(extra="forbid")
    reference_forecast_id: UUID | None
    delta: DerivedDeltaOut
    desire: Literal["neutral", "favorable", "unfavorable", "unknown"]
    grounding_id: str | None
    grounding_kind: Literal["target", "preference", "decision"] | None


class ProjectAnalyticsOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject_key: str
    metric_key: str
    as_of: datetime | None
    evaluated_at: datetime
    state: ProjectAnalyticsState
    # Slice 8: the whole unit was erased by retention (≠ ``no_facts``); unrelated to
    # the page cap ``forecast_versions_truncated``.
    retention_history_deleted: bool = False
    retention_horizon: date | None = None
    forecast_versions: list[SemanticOut]
    forecast_version_count: int
    forecast_versions_truncated: bool
    withdrawn_forecast_count: int
    first_forecast: SemanticOut | None
    latest_forecast: SemanticOut | None
    actual: MeasurementOut | None
    actual_count: int
    actual_corrections: list[MeasurementOut]
    delta_vs_first: ProjectDeltaOut
    delta_vs_latest: ProjectDeltaOut
    observation_count: int
