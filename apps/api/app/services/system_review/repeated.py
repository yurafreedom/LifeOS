"""«Что повторилось» — recurrence of existing derivations only (plan §6.3).

No fifth rule and no pattern catalogue. The four accepted signal rules are
re-evaluated **read-only** for explicit finance-period subjects — each rule
module is pure (``handles`` / ``inputs`` / ``evaluate``) and never touches
``aa_signal_episodes`` — so recurrence is judged from the facts, not from the
biased sample of episodes that happened to be persisted by a gate-open GET.

A window whose coverage is unknown is disclosed beside the result; the absence
of a signal there is not counted as "did not happen".
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.enums import FactStatus
from app.analytics.rules import FactScope, SignalSubject, signal_rules
from app.analytics.subjects import SubjectRef
from app.models import AAForecastVersion
from app.services.aa_coverage_claims import coverage_report_for_window
from app.services.aa_finance import TRANSACTION_METRIC
from app.services.system_review.periods import Period

PROJECT_METRIC = "project.completion_date"


def finance_subject(period: Period) -> SignalSubject:
    return SignalSubject(
        subject=SubjectRef("finance", "period", period.key),
        timezone=period.timezone,
        window_start=period.window_start,
        window_end=period.window_end,
        window_id=period.key,
        period=period.key,
        fact_scope=FactScope(
            subject_domain="finance",
            subject_types=("transaction",),
            metric_keys=(TRANSACTION_METRIC,),
            occurred_from=period.start,
            occurred_to=period.end,
        ),
    )


def rule_occurrences(
    db: Session, *, user_id: UUID, windows: list[Period], now: datetime
) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    """``{rule_id: [{window, materiality, state}]}`` and the unknown-coverage windows."""
    held: dict[str, list[dict[str, Any]]] = {}
    unknown: list[str] = []
    catalogue = signal_rules()
    assert len(catalogue) == 4, "the accepted catalogue is exactly four rules"
    for window in windows:
        observed_at = min(now, window.end)
        subject = finance_subject(window)
        report = coverage_report_for_window(
            db,
            user_id=user_id,
            subject_key=subject.subject_key,
            window_start=window.window_start,
            window_end=window.window_end,
            timezone=window.timezone,
            now=observed_at,
        )
        if report.unknown_coverage_count > 0:
            unknown.append(window.key)
        for rule in catalogue:
            if not rule.handles(subject):
                continue
            evaluation = rule.evaluate(
                rule.inputs(db, user_id=user_id, subject=subject, now=observed_at, as_of=None)
            )
            if evaluation is None:
                continue
            held.setdefault(rule.RULE_ID, []).append(
                {
                    "window": window.key,
                    "materiality": str(evaluation.materiality),
                    "state": str(evaluation.state),
                }
            )
    return held, unknown


def forecast_revision_months(
    db: Session, *, user_id: UUID, windows: list[Period]
) -> dict[str, list[str]]:
    """Per project: the windows in which a new forecast version was recorded."""
    if not windows:
        return {}
    start, end = windows[0].start, windows[-1].end
    rows = db.execute(
        select(AAForecastVersion.subject_id, AAForecastVersion.recorded_at).where(
            AAForecastVersion.user_id == user_id,
            AAForecastVersion.subject_domain == "project",
            AAForecastVersion.metric_key == PROJECT_METRIC,
            AAForecastVersion.status != FactStatus.TOMBSTONED,
            AAForecastVersion.recorded_at >= start,
            AAForecastVersion.recorded_at < end,
        )
    ).all()
    months: dict[str, set[str]] = {}
    for project_id, recorded_at in rows:
        for window in windows:
            if window.contains_instant(recorded_at):
                months.setdefault(project_id, set()).add(window.key)
    return {project: sorted(keys) for project, keys in months.items()}


def repeated_items(
    db: Session,
    *,
    user_id: UUID,
    windows: list[Period],
    now: datetime,
    unplanned_by_window: dict[str, int],
) -> list[dict[str, Any]]:
    held, unknown = rule_occurrences(db, user_id=user_id, windows=windows, now=now)
    items: list[dict[str, Any]] = []
    for rule_id in sorted(held):
        occurrences = held[rule_id]
        if len({entry["window"] for entry in occurrences}) >= 2:
            items.append({
                "kind": "signal_rule",
                "source": rule_id,
                "windows": occurrences,
                "coverage_unknown_windows": unknown,
                "sources": [],
            })
    for project_id, months in sorted(
        forecast_revision_months(db, user_id=user_id, windows=windows).items()
    ):
        if len(months) >= 2:
            items.append({
                "kind": "forecast_revisions",
                "source": "project.forecast.revision",
                "subject_key": f"project:project:{project_id}",
                "windows": [{"window": key} for key in months],
                "coverage_unknown_windows": [],
                "sources": [],
            })
    windows_with_unplanned = [key for key, count in sorted(unplanned_by_window.items()) if count]
    if len(windows_with_unplanned) >= 2:
        items.append({
            "kind": "unplanned_expenses",
            "source": "finance_context",
            "windows": [
                {"window": key, "count": unplanned_by_window[key]} for key in windows_with_unplanned
            ],
            "coverage_unknown_windows": [],
            "sources": [],
        })
    return items
