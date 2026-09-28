"""Review constants and the frozen-context DTOs (``ContextItem``, ``ReviewContext``)."""

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from app.analytics.enums import ReviewSection
from app.analytics.subjects import SubjectRef
from app.analytics.values import FactValue
from app.models import (
    AABaseline,
    AAExpectationVersion,
    AAForecastVersion,
    AAMeasurement,
    AAMetricMembershipOverride,
    AAMetricPolicyVersion,
    AAObservation,
    AAPreference,
    AASourceCoverage,
    AATarget,
)
from app.services.reviews.values import VALUE_COLUMNS, _plain

PROJECT_METRIC = "project.completion_date"
MANIFEST_VERSION = 1
MAX_ALONGSIDE = 20
MAX_WINDOW_DAYS = 3661
LIST_LIMIT_MAX = 50


# Every table a frozen item may point at, by name. Mirrors the fact tables
# hard deletion can reach.
SOURCE_MODELS = {
    "aa_measurements": AAMeasurement,
    "aa_source_coverage": AASourceCoverage,
    "aa_expectation_versions": AAExpectationVersion,
    "aa_forecast_versions": AAForecastVersion,
    "aa_baselines": AABaseline,
    "aa_targets": AATarget,
    "aa_preferences": AAPreference,
    "aa_observations": AAObservation,
    "aa_metric_policy_versions": AAMetricPolicyVersion,
    "aa_metric_membership_overrides": AAMetricMembershipOverride,
}


# Everything on an item that came from a source. Setting all of it to NULL is
# exactly what the ``ck_aa_review_context_items_redacted_erased`` CHECK demands.
ERASED_ITEM_VALUES: dict[str, Any] = {
    "availability": None,
    "value_type": None,
    **{column: None for column in VALUE_COLUMNS},
    "desire": None,
    "epistemic_kind": None,
    "estimate": False,
    "source_kind": None,
    "basis": None,
    "method": None,
    "provenance_recorded_at": None,
    "original_recorded_at_known": None,
}


@dataclass(frozen=True)
class ContextItem:
    section: str
    role: str
    label_key: str
    availability: str
    metric_key: str | None = None
    value: FactValue | None = None
    desire: str | None = None
    epistemic_kind: str | None = None
    estimate: bool = False
    source_kind: str | None = None
    basis: str | None = None
    method: str | None = None
    provenance_recorded_at: datetime | None = None
    original_recorded_at_known: bool | None = None
    sources: tuple[tuple[str, str], ...] = ()

    def canonical(self) -> dict[str, Any]:
        value = None
        if self.value is not None:
            value = {
                "type": str(self.value.value_type),
                **{
                    column: _plain(getattr(self.value, column))
                    for column in VALUE_COLUMNS
                },
            }
        return {
            "section": self.section,
            "role": self.role,
            "label_key": self.label_key,
            "availability": self.availability,
            "metric_key": self.metric_key,
            "value": value,
            "desire": self.desire,
            "epistemic_kind": self.epistemic_kind,
            "estimate": self.estimate,
            "source_kind": self.source_kind,
            "basis": self.basis,
            "method": self.method,
            "provenance_recorded_at": _plain(self.provenance_recorded_at),
            "original_recorded_at_known": self.original_recorded_at_known,
            "sources": sorted([table, fact_id] for table, fact_id in self.sources),
        }


@dataclass(frozen=True)
class ReviewContext:
    subject: SubjectRef
    subject_kind: str
    window_start: date
    window_end: date
    timezone: str
    as_of: datetime
    items: tuple[ContextItem, ...] = field(default_factory=tuple)

    @property
    def fingerprint(self) -> str:
        """sha256 over the content the user sees, so "same context" is checkable.

        ``as_of`` is deliberately excluded: two derivations are the same context
        when they show the same things, whenever they were computed.
        """
        payload = {
            "subject_key": self.subject.subject_key,
            "window_start": self.window_start.isoformat(),
            "window_end": self.window_end.isoformat(),
            "timezone": self.timezone,
            "items": [item.canonical() for item in self.items],
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    @property
    def manifest(self) -> dict[str, Any]:
        """Layout only: which ordinals sit in which section. No values, ever."""
        sections = []
        for section in ReviewSection:
            ordinals = [
                index for index, item in enumerate(self.items, start=1)
                if item.section == section
            ]
            sections.append({"key": str(section), "ordinals": ordinals})
        return {
            "manifest_version": MANIFEST_VERSION,
            "subject_kind": self.subject_kind,
            "sections": sections,
        }
