"""The live System Review read model (plan §6, §14). Pure reads only.

``build_review`` assembles one period's review from current durable evidence,
with internal ``sources`` on every item; ``live_review`` strips them for the
API; ``revisions.freeze`` keeps them for redaction. Nothing here writes: no
signal episode, no relation, no revision, no semantic fact.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.enums import ExperimentLifecycle, FactStatus
from app.models import (
    AAExpectationVersion,
    AAExperiment,
    AAFinanceContext,
    AAForecastVersion,
    AAMeasurement,
    AAObservation,
    AASystemReviewRevision,
    AATarget,
)
from app.services.system_review.candidates import candidate_payload, generate, rank
from app.services.system_review.changes import (
    experiment_items,
    finance_items,
    finance_month,
    free_observations,
    improved_items,
    observation_items,
    order_items,
    project_items,
    quality_items,
)
from app.services.system_review.consequences import (
    consequences_for_month,
    funding_summary,
    load_expenses,
    unplanned_by_window,
)
from app.services.system_review.contexts import active_contexts
from app.services.system_review.contracts import (
    MAX_GROUP_ITEMS,
    REQUIRES_CONFIRMATION_HORIZON_MONTHS,
    REVIEW_AVAILABLE_MONTHS,
)
from app.services.system_review.importance import importance_map
from app.services.system_review.periods import (
    Period,
    current_month,
    logical_status,
    months_of,
    period_state,
    require_started,
    shift_month,
    year,
)
from app.services.system_review.refs import (
    ReviewSectionKey,
    relation_ref,
    section_ref,
    subject_ref,
)
from app.services.system_review.relations import (
    family_history,
    feedback_log,
    list_relations,
    relation_payload,
    responded_keys,
)
from app.services.system_review.repeated import repeated_items


def _bounded(items: list[dict[str, Any]]) -> dict[str, Any]:
    return {"items": items[:MAX_GROUP_ITEMS], "truncated": len(items) > MAX_GROUP_ITEMS}


def _experiments(db: Session, user_id: UUID) -> list[AAExperiment]:
    return list(
        db.scalars(
            select(AAExperiment)
            .where(AAExperiment.user_id == user_id)
            .order_by(AAExperiment.created_at, AAExperiment.id)
        )
    )


def _tradeoffs(month_key: str, grounded: list[dict[str, Any]]) -> list[dict[str, Any]]:
    favorable = [item for item in grounded if item["desire"] == "favorable"]
    unfavorable = [item for item in grounded if item["desire"] == "unfavorable"]
    pairs = []
    for a in favorable:
        for b in unfavorable:
            pairs.append({
                "kind": "tradeoff",
                "period": month_key,
                "a": {key: value for key, value in a.items() if key != "sources"},
                "b": {key: value for key, value in b.items() if key != "sources"},
                "causality_checked": False,
                "sources": list(a.get("sources", [])) + list(b.get("sources", [])),
            })
    return pairs


def _grounded(changed: list[dict[str, Any]], consequences: dict[str, Any]) -> list[dict]:
    grounded = [
        {"kind": item["kind"], "ref": item["ref"], "desire": item["desire"],
         "basis": item["basis"], "current": item["current"], "reference": item["reference"],
         "sources": item["sources"]}
        for item in changed
        if item["kind"] == "finance_target_state" and item["desire"] in ("favorable",
                                                                          "unfavorable")
    ]
    for priority in consequences.get("priorities", []):
        # «Цель превышена» is the same fact as the target-state item; not a second side.
        if priority["kind"] == "target_exceeded":
            continue
        grounded.append({**priority, "ref": priority["basis"].get("ref"),
                         "sources": priority.get("sources", [])})
    return grounded


def _month_review(
    db: Session, *, user_id: UUID, period: Period, now: datetime,
    contexts: list[AAFinanceContext], experiments: list[AAExperiment],
) -> dict[str, Any]:
    month = finance_month(db, user_id=user_id, period=period, now=now)
    observations = free_observations(db, user_id=user_id, period=period, limit=MAX_GROUP_ITEMS + 1)
    changed = order_items(
        finance_items(db, user_id=user_id, month=month, now=now)
        + project_items(db, user_id=user_id, period=period, now=now)
        + experiment_items(db, user_id=user_id, period=period)
        + observation_items(db, user_id=user_id, period=period, rows=observations)
    )
    consequences = consequences_for_month(
        db, user_id=user_id, period=period, month=month, contexts=contexts
    )
    windows = [shift_month(period, -2), shift_month(period, -1), period]
    repeated = repeated_items(
        db, user_id=user_id, windows=windows, now=now,
        unplanned_by_window=unplanned_by_window(
            db, user_id=user_id, windows=windows, contexts=contexts
        ),
    )
    candidates = generate(
        db, user_id=user_id, period=period, contexts=contexts, changes=changed,
        experiments=experiments, now=now,
    )
    return {
        "month": month,
        "changed": changed,
        "improved": improved_items(changed),
        "repeated": repeated,
        "tradeoffs": _tradeoffs(period.key, _grounded(changed, consequences)),
        "consequences": consequences,
        "quality": quality_items(month),
        "candidates": candidates,
    }


def _year_review(
    db: Session, *, user_id: UUID, period: Period, now: datetime,
    contexts: list[AAFinanceContext], experiments: list[AAExperiment],
) -> dict[str, Any]:
    today_month = current_month(period.timezone, now)
    months = [m for m in months_of(period) if m.window_start <= today_month.window_start]
    changed: list[dict[str, Any]] = []
    tradeoffs: list[dict[str, Any]] = []
    quality: list[dict[str, Any]] = []
    for m in months:
        month = finance_month(db, user_id=user_id, period=m, now=now)
        items = [
            item for item in finance_items(db, user_id=user_id, month=month, now=now)
            if item["kind"] in ("finance_spend_vs_prior", "finance_target_state")
        ]
        changed.extend(items)
        expenses, _ = load_expenses(db, user_id=user_id, contexts=contexts, period=m)
        if expenses or month.grounding is not None:
            consequences = consequences_for_month(
                db, user_id=user_id, period=m, month=month, contexts=contexts
            )
            tradeoffs.extend(_tradeoffs(m.key, _grounded(items, consequences)))
        quality.extend(quality_items(month)[:1])
    changed.extend(project_items(db, user_id=user_id, period=period, now=now))
    changed.extend(experiment_items(db, user_id=user_id, period=period))
    changed.extend(observation_items(db, user_id=user_id, period=period))
    changed = order_items(changed)
    expenses, unavailable = load_expenses(db, user_id=user_id, contexts=contexts, period=period)
    summary_rows = [
        {"context": e.payload, "expense": {"amount": {"unit_code": e.currency,
                                                      "num": format(e.amount, "f")}}}
        for e in expenses
    ]
    return {
        "month": None,
        "changed": changed,
        "improved": improved_items(changed),
        "repeated": repeated_items(
            db, user_id=user_id, windows=months, now=now,
            unplanned_by_window=unplanned_by_window(
                db, user_id=user_id, windows=months, contexts=contexts
            ),
        ),
        "tradeoffs": tradeoffs,
        "consequences": {
            "expenses": [],
            "position": None,
            "priorities": [],
            "self_check": None,
            "unplanned_count": sum(
                1 for e in expenses if e.payload.get("plannedness") == "unplanned"
            ),
            "contexts_without_transaction": unavailable,
            "funding_summary": funding_summary(summary_rows),
        },
        "quality": quality,
        "candidates": [],
    }


def revision_summary(db: Session, *, user_id: UUID, period: Period) -> dict[str, Any]:
    rows = db.execute(
        select(
            AASystemReviewRevision.revision,
            AASystemReviewRevision.status,
            AASystemReviewRevision.created_at,
        )
        .where(
            AASystemReviewRevision.user_id == user_id,
            AASystemReviewRevision.period_kind == period.kind,
            AASystemReviewRevision.period_key == period.key,
        )
        .order_by(AASystemReviewRevision.revision)
    ).all()
    finalized = [revision for revision, status, _ in rows if status == "finalized"]
    latest = rows[-1] if rows else None
    return {
        "count": len(rows),
        "latest_revision": None if latest is None else {
            "revision": latest[0], "status": latest[1], "created_at": latest[2].isoformat()},
        "finalized_revision": finalized[-1] if finalized else None,
        "has_newer_draft": bool(finalized) and latest is not None and latest[1] == "draft",
    }


def build_review(
    db: Session, *, user_id: UUID, period: Period, now: datetime
) -> dict[str, Any]:
    """The whole review with internal sources. Read-only."""
    require_started(period, now)
    contexts = active_contexts(db, user_id=user_id)
    experiments = _experiments(db, user_id)
    build = _month_review if period.kind == "month" else _year_review
    parts = build(db, user_id=user_id, period=period, now=now, contexts=contexts,
                  experiments=experiments)
    answered = responded_keys(db, user_id=user_id)
    live_fingerprints = {c.proposal_key: c.fingerprint for c in parts["candidates"]}
    pending = [c for c in parts["candidates"] if c.proposal_key not in answered]
    ranked = rank(pending, family_history(db, user_id=user_id))
    rows = list_relations(db, user_id=user_id, period=period.key)
    log = feedback_log(db, user_id=user_id, relation_ids=[row.id for row in rows])
    relations = []
    for row in rows:
        item = relation_payload(row, log.get(row.id), live_fingerprints.get(row.proposal_key))
        item["sources"] = []
        relations.append(item)
    saved = revision_summary(db, user_id=user_id, period=period)
    linkable = _linkable(parts)
    keys = [entry["ref"] for entry in linkable]
    keys += [section_ref(period.key, section.value) for section in ReviewSectionKey]
    keys += [relation_ref(row.id) for row in rows]
    return {
        "period": period.key,
        "period_kind": period.kind,
        "timezone": period.timezone,
        "window_start": period.window_start.isoformat(),
        "window_end": period.window_end.isoformat(),
        "evaluated_at": now.isoformat(),
        "period_state": period_state(period, now),
        "status": logical_status(period, finalized=saved["finalized_revision"] is not None,
                                 now=now),
        "not_a_verdict": True,
        "saved": saved,
        "sections": {
            "changed": _bounded(parts["changed"]),
            "improved": _bounded(parts["improved"]),
            "repeated": _bounded(parts["repeated"]),
            "tradeoffs": _bounded(parts["tradeoffs"]),
            "consequences": parts["consequences"],
            "relations": _bounded(relations),
            "requires_confirmation": {
                "count": len(pending),
                "items": [candidate_payload(c, index + 1, history)
                          for index, (c, history) in enumerate(ranked)],
                "truncated": len(pending) > len(ranked),
            },
            "quality": {"items": parts["quality"]},
        },
        "linkable": linkable,
        "importance": importance_map(db, user_id=user_id, keys=sorted(set(keys))),
    }


def _linkable(parts: dict[str, Any]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []

    def add(ref: str, domain: str, kind: str, details: dict[str, Any] | None = None) -> None:
        if ref not in seen:
            seen.add(ref)
            out.append({"ref": ref, "domain": domain, "kind": kind, "details": details or {}})

    for item in parts["changed"]:
        add(item["ref"], item["domain"], item["kind"], {
            key: item["details"].get(key) for key in ("project_id", "title", "experiment_id",
                                                      "target_state")
            if key in item["details"]})
        if item["kind"] == "experiment_lifecycle":
            add(item["details"]["subject_ref"], "experiment", "experiment",
                {"title": item["details"]["title"], "experiment_id":
                 item["details"]["experiment_id"]})
    for analysis in parts["consequences"].get("expenses", []):
        add(analysis["ref"], "finance", "expense", {"transaction_id": analysis["transaction_id"]})
    position = parts["consequences"].get("position") or {}
    for obligation in position.get("obligations", []):
        add(obligation["ref"], "finance", "obligation", {"label": obligation.get("label")})
    return out


def live_review(db: Session, *, user_id: UUID, period: Period, now: datetime) -> dict[str, Any]:
    """The API shape: the same review without the internal source manifests."""
    review = build_review(db, user_id=user_id, period=period, now=now)
    return strip_sources(review)


def strip_sources(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: strip_sources(inner) for key, inner in value.items() if key != "sources"}
    if isinstance(value, list):
        return [strip_sources(inner) for inner in value]
    return value


def candidates_for(
    db: Session, *, user_id: UUID, period: Period, now: datetime
) -> dict[str, Any]:
    """The server's own re-derivation of one month's proposals, by key."""
    require_started(period, now)
    contexts = active_contexts(db, user_id=user_id)
    experiments = _experiments(db, user_id)
    month = finance_month(db, user_id=user_id, period=period, now=now)
    changed = (
        finance_items(db, user_id=user_id, month=month, now=now)
        + project_items(db, user_id=user_id, period=period, now=now)
        + experiment_items(db, user_id=user_id, period=period)
    )
    candidates = generate(db, user_id=user_id, period=period, contexts=contexts,
                          changes=changed, experiments=experiments, now=now)
    return {candidate.proposal_key: candidate for candidate in candidates}


# ───────────────────────────── waiting ─────────────────────────────


def _local_months(db: Session, column, *filters, timezone: str) -> set[str]:
    month = func.to_char(func.timezone(timezone, column), "YYYY-MM")
    return {value for value in db.scalars(select(month).where(*filters).distinct()) if value}


def evidence_months(
    db: Session, *, user_id: UUID, start: datetime, end: datetime, timezone: str
) -> set[str]:
    """Months with any AA evidence: the only months a review can be "ready" for."""
    months: set[str] = set()
    months |= _local_months(
        db, AAMeasurement.occurred_at, AAMeasurement.user_id == user_id,
        AAMeasurement.status != FactStatus.TOMBSTONED, AAMeasurement.occurred_at >= start,
        AAMeasurement.occurred_at < end, timezone=timezone,
    )
    months |= _local_months(
        db, AAObservation.occurred_at, AAObservation.user_id == user_id,
        AAObservation.status != FactStatus.TOMBSTONED, AAObservation.subject_domain != "experiment",
        AAObservation.occurred_at >= start, AAObservation.occurred_at < end, timezone=timezone,
    )
    months |= _local_months(
        db, AAForecastVersion.recorded_at, AAForecastVersion.user_id == user_id,
        AAForecastVersion.status != FactStatus.TOMBSTONED, AAForecastVersion.recorded_at >= start,
        AAForecastVersion.recorded_at < end, timezone=timezone,
    )
    months |= _local_months(
        db, AAFinanceContext.recorded_at, AAFinanceContext.user_id == user_id,
        AAFinanceContext.recorded_at >= start, AAFinanceContext.recorded_at < end,
        timezone=timezone,
    )
    for column in (AAExperiment.started_at, AAExperiment.completed_at, AAExperiment.reviewed_at,
                   AAExperiment.abandoned_at):
        months |= _local_months(
            db, column, AAExperiment.user_id == user_id, column >= start, column < end,
            timezone=timezone,
        )
    for model in (AAExpectationVersion, AATarget):
        months |= {
            value for value in db.scalars(
                select(model.subject_id).where(
                    model.user_id == user_id,
                    model.subject_domain == "finance",
                    model.subject_type == "period",
                    model.status != FactStatus.TOMBSTONED,
                ).distinct()
            )
            if value
        }
    return months


def _finalized(db: Session, *, user_id: UUID) -> set[tuple[str, str]]:
    rows = db.execute(
        select(AASystemReviewRevision.period_kind, AASystemReviewRevision.period_key)
        .where(
            AASystemReviewRevision.user_id == user_id,
            AASystemReviewRevision.status == "finalized",
        )
        .distinct()
    ).all()
    return {(kind, key) for kind, key in rows}


def waiting(db: Session, *, user_id: UUID, timezone: str, now: datetime) -> dict[str, Any]:
    current = current_month(timezone, now)
    finalized = _finalized(db, user_id=user_id)
    items: list[dict[str, Any]] = []
    for experiment in db.scalars(
        select(AAExperiment)
        .where(
            AAExperiment.user_id == user_id,
            AAExperiment.lifecycle == ExperimentLifecycle.COMPLETED_AWAITING_REVIEW,
        )
        .order_by(AAExperiment.completed_at, AAExperiment.id)
    ):
        items.append({"kind": "experiment", "experiment_id": str(experiment.id),
                      "title": experiment.title, "since": experiment.completed_at.isoformat(),
                      "ref": subject_ref(f"experiment:experiment:{experiment.id}")})
    earliest = shift_month(current, -REVIEW_AVAILABLE_MONTHS)
    last_year = year(current.year - 1, timezone)
    start = min(earliest.start, last_year.start)
    months_with_evidence = evidence_months(
        db, user_id=user_id, start=start, end=current.start, timezone=timezone
    )
    for offset in range(REVIEW_AVAILABLE_MONTHS, 0, -1):
        month = shift_month(current, -offset)
        if month.key in months_with_evidence and ("month", month.key) not in finalized:
            items.append({"kind": "monthly_review", "period": month.key})
    if (
        any(key.startswith(f"{last_year.key}-") for key in months_with_evidence)
        and ("year", last_year.key) not in finalized
    ):
        items.append({"kind": "annual_review", "period": last_year.key})

    contexts = active_contexts(db, user_id=user_id)
    experiments = _experiments(db, user_id)
    answered = responded_keys(db, user_id=user_id)
    history = family_history(db, user_id=user_id)
    proposals: list[dict[str, Any]] = []
    for offset in range(REQUIRES_CONFIRMATION_HORIZON_MONTHS):
        month = shift_month(current, -offset)
        finance = finance_month(db, user_id=user_id, period=month, now=now)
        changed = (
            finance_items(db, user_id=user_id, month=finance, now=now)
            + project_items(db, user_id=user_id, period=month, now=now)
            + experiment_items(db, user_id=user_id, period=month)
        )
        pending = [
            c for c in generate(db, user_id=user_id, period=month, contexts=contexts,
                                changes=changed, experiments=experiments, now=now)
            if c.proposal_key not in answered
        ]
        proposals.extend(
            candidate_payload(c, index + 1, h) for index, (c, h) in enumerate(rank(pending,
                                                                                    history))
        )
    return {
        "evaluated_at": now.isoformat(),
        "timezone": timezone,
        "review_available": {"count": len(items), "items": items},
        "requires_confirmation": {
            "count": len(proposals),
            "items": proposals,
            "horizon_months": REQUIRES_CONFIRMATION_HORIZON_MONTHS,
        },
    }
