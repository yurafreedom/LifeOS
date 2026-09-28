"""Project Analytics — Forecast version history, the Actual, and a neutral dual delta.

Read-only and derived on every request: nothing here writes, caches or persists
a value, so an erased fact disappears from the answer the moment it is erased.

Two different questions are answered with two different predicates:

* **Forecast versions** — "which versions had LifeOS recorded by T?". Every
  non-tombstoned row of the grain counts, including versions retired as
  ``superseded`` / ``REVISION``. This is the history predicate PR #14 gave the
  ``project.forecast.revision`` rule; ``apply_as_of`` is deliberately not used,
  because it answers "which version was live at T?" and sees only one.
* **Actual** — the completion Measurement live at T (``apply_as_of``) that had
  also occurred by T. A correction replaces its original, so it counts once.

The Actual never enters the version list: it lives in another table.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select

from app.analytics.asof import apply_as_of
from app.analytics.delta import Delta, DeltaUnknown, compute_delta
from app.analytics.enums import FactStatus, ValueType
from app.analytics.subjects import SubjectRef, validate_subject
from app.analytics.values import FactValue
from app.models import AAForecastVersion, AAMeasurement, AAObservation
from app.schemas.aa_comparison import DerivedDeltaOut, SemanticOut
from app.schemas.aa_measurement import MeasurementOut
from app.schemas.aa_projects import ProjectAnalyticsOut, ProjectDeltaOut
from app.services.aa_desirability import desirability

PROJECT_METRIC = "project.completion_date"
MAX_FORECAST_VERSIONS = 200
# A correction chain is short in practice; the bound only guards a cycle.
MAX_CORRECTION_DEPTH = 200


def project_subject(project_id: str) -> SubjectRef:
    """Raises ``InvalidSubjectError`` for an empty id or one containing ``:``."""
    return validate_subject(SubjectRef("project", "project", project_id))


def _fact_value(row) -> FactValue | None:
    if row is None:
        return None
    return FactValue(
        value_type=ValueType(row.value_type),
        unit_code=row.unit_code,
        value_num=row.value_num,
        value_date=row.value_date,
        value_text=row.value_text,
        scale_min=row.scale_min,
        scale_max=row.scale_max,
    )


def _forecast_grain(user_id, subject_key: str, as_of: datetime | None, *, surviving: bool):
    """The forecast VERSION HISTORY predicate (PR #14), user scope first."""
    predicates = [
        AAForecastVersion.user_id == user_id,
        AAForecastVersion.subject_key == subject_key,
        AAForecastVersion.metric_key == PROJECT_METRIC,
        (AAForecastVersion.status != FactStatus.TOMBSTONED)
        if surviving
        else (AAForecastVersion.status == FactStatus.TOMBSTONED),
    ]
    if as_of is not None:
        predicates.append(AAForecastVersion.recorded_at <= as_of)
    return predicates


def _actual_rows(db, user_id, subject_key: str, as_of: datetime | None):
    query = select(AAMeasurement).where(
        AAMeasurement.user_id == user_id,
        AAMeasurement.subject_key == subject_key,
        AAMeasurement.metric_key == PROJECT_METRIC,
    )
    if as_of is not None:
        query = query.where(AAMeasurement.occurred_at <= as_of)
    return db.scalars(
        apply_as_of(query, AAMeasurement, as_of).order_by(
            AAMeasurement.occurred_at.desc(),
            AAMeasurement.recorded_at.desc(),
            AAMeasurement.id.desc(),
        )
    ).all()


def _corrections(db, user_id, actual, as_of: datetime | None) -> list:
    """Earlier versions of the current Actual, oldest first; erased ones skipped."""
    chain = []
    predecessor_id = actual.supersedes_id
    for _ in range(MAX_CORRECTION_DEPTH):
        if predecessor_id is None:
            break
        row = db.scalar(
            select(AAMeasurement).where(
                AAMeasurement.user_id == user_id, AAMeasurement.id == predecessor_id
            )
        )
        if row is None:
            break
        if row.status != FactStatus.TOMBSTONED and (as_of is None or row.recorded_at <= as_of):
            chain.append(row)
        predecessor_id = row.supersedes_id
    chain.reverse()
    return chain


def _observation_count(db, user_id, subject_key: str, at: datetime, as_of: datetime | None) -> int:
    query = (
        select(func.count())
        .select_from(AAObservation)
        .where(
            AAObservation.user_id == user_id,
            AAObservation.subject_key == subject_key,
            AAObservation.occurred_at <= at,
        )
    )
    return db.scalar(apply_as_of(query, AAObservation, as_of)) or 0


def _delta_out(actual, forecast) -> ProjectDeltaOut:
    actual_value = _fact_value(actual)
    result = compute_delta(actual_value, _fact_value(forecast))
    if isinstance(result, DeltaUnknown):
        delta = DerivedDeltaOut(state="unknown", reason=result.reason)
    else:
        assert isinstance(result, Delta)
        delta = DerivedDeltaOut(
            state="known", type=result.value_type, num=result.value_num, unit_code=result.unit_code
        )
    # No Target, Preference or Decision is consulted for a project date, and a
    # Forecast or Expectation can never ground desirability: always neutral.
    return ProjectDeltaOut(
        reference_forecast_id=forecast.id if forecast is not None else None,
        delta=delta,
        desire=desirability(actual_value, None),
        grounding_id=None,
        grounding_kind=None,
    )


def dual_delta(actual, first, latest) -> tuple[ProjectDeltaOut, ProjectDeltaOut]:
    """Actual − first surviving version, and Actual − latest surviving version."""
    return _delta_out(actual, first), _delta_out(actual, latest)


@dataclass(frozen=True)
class _History:
    versions: list
    count: int
    first: object | None
    latest: object | None


def _forecast_history(db, user_id, subject_key: str, as_of: datetime | None) -> _History:
    predicates = _forecast_grain(user_id, subject_key, as_of, surviving=True)
    count = db.scalar(select(func.count()).select_from(AAForecastVersion).where(*predicates)) or 0
    versions = db.scalars(
        select(AAForecastVersion)
        .where(*predicates)
        .order_by(AAForecastVersion.recorded_at.asc(), AAForecastVersion.id.asc())
        .limit(MAX_FORECAST_VERSIONS)
    ).all()
    latest = versions[-1] if versions else None
    if count > len(versions):
        latest = db.scalar(
            select(AAForecastVersion)
            .where(*predicates)
            .order_by(AAForecastVersion.recorded_at.desc(), AAForecastVersion.id.desc())
            .limit(1)
        )
    return _History(list(versions), count, versions[0] if versions else None, latest)


def _state(history: _History, actual, at: datetime) -> str:
    if actual is not None:
        return "compared" if history.count else "no_forecast"
    if not history.count:
        return "no_facts"
    # A horizon that has passed without an Actual is not a miss: nothing is judged.
    return "too_early" if at < history.latest.horizon_at else "actual_not_recorded"


def project_analytics(
    db, *, user_id, subject: SubjectRef, as_of: datetime | None = None, now: datetime | None = None
) -> ProjectAnalyticsOut:
    at = as_of or now or datetime.now(UTC)
    key = subject.subject_key
    history = _forecast_history(db, user_id, key, as_of)
    withdrawn = (
        db.scalar(
            select(func.count())
            .select_from(AAForecastVersion)
            .where(*_forecast_grain(user_id, key, as_of, surviving=False))
        )
        or 0
    )
    actual_rows = _actual_rows(db, user_id, key, as_of)
    actual = actual_rows[0] if actual_rows else None
    delta_first, delta_latest = dual_delta(actual, history.first, history.latest)
    return ProjectAnalyticsOut(
        subject_key=key,
        metric_key=PROJECT_METRIC,
        as_of=as_of,
        evaluated_at=at,
        state=_state(history, actual, at),
        forecast_versions=[SemanticOut.from_row(row, "forecast") for row in history.versions],
        forecast_version_count=history.count,
        forecast_versions_truncated=history.count > len(history.versions),
        withdrawn_forecast_count=withdrawn,
        first_forecast=SemanticOut.from_row(history.first, "forecast") if history.first else None,
        latest_forecast=(
            SemanticOut.from_row(history.latest, "forecast") if history.latest else None
        ),
        actual=MeasurementOut.from_row(actual) if actual is not None else None,
        actual_count=len(actual_rows),
        actual_corrections=[
            MeasurementOut.from_row(row) for row in _corrections(db, user_id, actual, as_of)
        ]
        if actual is not None
        else [],
        delta_vs_first=delta_first,
        delta_vs_latest=delta_latest,
        observation_count=_observation_count(db, user_id, key, at, as_of),
    )
