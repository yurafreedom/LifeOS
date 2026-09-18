"""Separate subject layers; references are explicit IDs/concepts."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.aa_comparison import ComparisonOut, SemanticOut
from app.schemas.aa_measurement import MeasurementOut


class SubjectSummaryOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject_key: str
    as_of: datetime
    truncated: bool
    actual: list[MeasurementOut]
    expectations: list[SemanticOut]
    forecasts: list[SemanticOut]
    baselines: list[SemanticOut]
    targets: list[SemanticOut]
    preferences: list[SemanticOut]
    observations: list[SemanticOut]
    comparisons: list[ComparisonOut]
