"""Reads: stored items with read-time correction detection (``source_state``),
``context_payload``, ``read_review`` and ``list_reviews``.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.enums import (
    ReviewAvailability,
    ReviewSourceState,
    SupersedeKind,
)
from app.analytics.values import FactValue
from app.models import (
    AADecision,
    AAReview,
    AAReviewContextItem,
    AAReviewContextSource,
    AAReviewFactor,
    AAReviewRevision,
)
from app.services.reviews.contracts import SOURCE_MODELS, ContextItem, ReviewContext
from app.services.reviews.errors import ReviewNotFoundError
from app.services.reviews.values import _fact_value, _q, _utc


def _source_states(
    db: Session, *, user_id: UUID, links: list[AAReviewContextSource]
) -> dict[tuple[str, UUID], Any]:
    by_table: dict[str, set[UUID]] = {}
    for link in links:
        by_table.setdefault(link.source_table, set()).add(link.source_fact_id)
    rows: dict[tuple[str, UUID], Any] = {}
    for table, ids in by_table.items():
        model = SOURCE_MODELS[table]
        for row in db.scalars(select(model).where(model.user_id == user_id, model.id.in_(ids))):
            rows[(table, row.id)] = row
    return rows


def _state_of(row: Any) -> ReviewSourceState:
    if row is None or row.status == "tombstoned":
        return ReviewSourceState.WITHDRAWN
    if row.status == "superseded":
        if row.supersede_kind == SupersedeKind.CORRECTION:
            return ReviewSourceState.CORRECTED
        return ReviewSourceState.REVISED
    return ReviewSourceState.CURRENT


PRIORITY = (
    ReviewSourceState.CORRECTED,
    ReviewSourceState.WITHDRAWN,
    ReviewSourceState.REVISED,
    ReviewSourceState.CURRENT,
)


def _chain_head(db: Session, *, user_id: UUID, row: Any) -> Any:
    model = type(row)
    current = row
    for _ in range(64):
        if current.superseded_by_id is None:
            return current
        current = db.scalar(
            select(model).where(model.user_id == user_id, model.id == current.superseded_by_id)
        )
        if current is None:
            return None
    return None


def _value_payload(value: FactValue | None) -> dict[str, Any] | None:
    if value is None:
        return None
    return {
        "type": value.value_type,
        "unit_code": value.unit_code,
        "num": _q(value.value_num),
        "date": value.value_date,
        "text": value.value_text,
        "scale_min": _q(value.scale_min),
        "scale_max": _q(value.scale_max),
    }


def _item_payload(item: ContextItem, ordinal: int) -> dict[str, Any]:
    return {
        "ordinal": ordinal,
        "section": item.section,
        "role": item.role,
        "label_key": item.label_key,
        "metric_key": item.metric_key,
        "availability": item.availability,
        "value": _value_payload(item.value),
        "desire": item.desire,
        "epistemic_kind": item.epistemic_kind,
        "estimate": item.estimate,
        "provenance": {
            "source_kind": item.source_kind,
            "basis": item.basis,
            "method": item.method,
            "recorded_at": _utc(item.provenance_recorded_at),
            "original_recorded_at_known": item.original_recorded_at_known,
        }
        if item.source_kind is not None
        else None,
    }


def context_payload(context: ReviewContext) -> dict[str, Any]:
    return {
        "subject_key": context.subject.subject_key,
        "window_start": context.window_start,
        "window_end": context.window_end,
        "timezone": context.timezone,
        "context_as_of": context.as_of,
        "context_fingerprint": context.fingerprint,
        "manifest": context.manifest,
        "items": [
            _item_payload(item, ordinal) for ordinal, item in enumerate(context.items, start=1)
        ],
    }


def _stored_item_payload(
    db: Session,
    *,
    user_id: UUID,
    row: AAReviewContextItem,
    links: list[AAReviewContextSource],
    sources: dict[tuple[str, UUID], Any],
) -> dict[str, Any]:
    if row.redacted_at is not None:
        return {
            "ordinal": row.ordinal,
            "section": row.section,
            "role": row.role,
            "label_key": row.label_key,
            "metric_key": row.metric_key,
            "availability": None,
            "value": None,
            "desire": None,
            "epistemic_kind": None,
            "estimate": False,
            "provenance": None,
            "redacted": True,
            "source_state": ReviewSourceState.REDACTED,
            "source_flags": [ReviewSourceState.REDACTED],
            "current_value": None,
        }
    frozen = _fact_value(row) if row.availability == ReviewAvailability.PRESENT else None
    states = {_state_of(sources.get((link.source_table, link.source_fact_id))) for link in links}
    flags = [state for state in PRIORITY if state in states and state != ReviewSourceState.CURRENT]
    primary = flags[0] if flags else ReviewSourceState.CURRENT
    current_value = None
    if len(links) == 1 and primary in (ReviewSourceState.CORRECTED, ReviewSourceState.REVISED):
        source = sources.get((links[0].source_table, links[0].source_fact_id))
        head = _chain_head(db, user_id=user_id, row=source) if source is not None else None
        if head is not None and head.status == "active":
            current_value = _value_payload(_fact_value(head))
    return {
        "ordinal": row.ordinal,
        "section": row.section,
        "role": row.role,
        "label_key": row.label_key,
        "metric_key": row.metric_key,
        "availability": row.availability,
        "value": _value_payload(frozen),
        "desire": row.desire,
        "epistemic_kind": row.epistemic_kind,
        "estimate": row.estimate,
        "provenance": {
            "source_kind": row.source_kind,
            "basis": row.basis,
            "method": row.method,
            "recorded_at": _utc(row.provenance_recorded_at),
            "original_recorded_at_known": row.original_recorded_at_known,
        }
        if row.source_kind is not None
        else None,
        "redacted": False,
        "source_state": primary,
        "source_flags": flags,
        "current_value": current_value,
    }


def _decision_payload(row: AADecision) -> dict[str, Any]:
    return {
        "id": row.id,
        "choice": row.choice,
        "revision": row.revision,
        "superseded_in_revision": row.superseded_in_revision,
        "created_at": row.created_at,
    }


def read_review(db: Session, *, user_id: UUID, review_id: UUID) -> dict[str, Any]:
    review = db.scalar(
        select(AAReview).where(AAReview.user_id == user_id, AAReview.id == review_id)
    )
    if review is None:
        raise ReviewNotFoundError
    items = db.scalars(
        select(AAReviewContextItem)
        .where(AAReviewContextItem.user_id == user_id, AAReviewContextItem.review_id == review.id)
        .order_by(AAReviewContextItem.ordinal)
    ).all()
    links = db.scalars(
        select(AAReviewContextSource).where(
            AAReviewContextSource.user_id == user_id,
            AAReviewContextSource.item_id.in_([item.id for item in items]),
        )
    ).all()
    by_item: dict[UUID, list[AAReviewContextSource]] = {}
    for link in links:
        by_item.setdefault(link.item_id, []).append(link)
    sources = _source_states(db, user_id=user_id, links=list(links))
    revisions = db.scalars(
        select(AAReviewRevision)
        .where(AAReviewRevision.user_id == user_id, AAReviewRevision.review_id == review.id)
        .order_by(AAReviewRevision.revision)
    ).all()
    factors = db.scalars(
        select(AAReviewFactor)
        .where(AAReviewFactor.user_id == user_id, AAReviewFactor.review_id == review.id)
        .order_by(AAReviewFactor.ordinal)
    ).all()
    decisions = db.scalars(
        select(AADecision)
        .where(AADecision.user_id == user_id, AADecision.review_id == review.id)
        .order_by(AADecision.revision)
    ).all()
    current = next((row for row in decisions if row.superseded_in_revision is None), None)
    return {
        "id": review.id,
        "subject": {
            "domain": review.subject_domain,
            "type": review.subject_type,
            "id": review.subject_id,
        },
        "subject_key": review.subject_key,
        "window_start": review.window_start,
        "window_end": review.window_end,
        "timezone": review.timezone,
        "context_as_of": review.context_as_of,
        "created_at": review.created_at,
        "revised_at": review.revised_at,
        "current_revision": review.current_revision,
        "manifest": review.render_manifest,
        "items": [
            _stored_item_payload(
                db, user_id=user_id, row=item, links=by_item.get(item.id, []), sources=sources
            )
            for item in items
        ],
        "revisions": [
            {"revision": row.revision, "created_at": row.created_at, "note_text": row.note_text}
            for row in revisions
        ],
        "factors": [
            {
                "id": row.id,
                "ordinal": row.ordinal,
                "text": row.text,
                "epistemic_kind": row.epistemic_kind,
                "added_in_revision": row.added_in_revision,
                "retracted_in_revision": row.retracted_in_revision,
                "replaces_id": row.replaces_id,
            }
            for row in factors
        ],
        "decision": _decision_payload(current) if current is not None else None,
        "decisions": [_decision_payload(row) for row in decisions],
    }


def list_reviews(
    db: Session, *, user_id: UUID, subject_key: str, limit: int
) -> list[dict[str, Any]]:
    reviews = db.scalars(
        select(AAReview)
        .where(AAReview.user_id == user_id, AAReview.subject_key == subject_key)
        .order_by(AAReview.created_at.desc(), AAReview.id.desc())
        .limit(limit)
    ).all()
    current = {
        row.review_id: row
        for row in db.scalars(
            select(AADecision).where(
                AADecision.user_id == user_id,
                AADecision.review_id.in_([review.id for review in reviews]),
                AADecision.superseded_in_revision.is_(None),
            )
        )
    }
    summaries = []
    for review in reviews:
        decision = current.get(review.id)
        state = "none" if decision is None else ("undecided" if decision.choice is None else "chosen")
        summaries.append(
            {
                "id": review.id,
                "subject_key": review.subject_key,
                "window_start": review.window_start,
                "window_end": review.window_end,
                "created_at": review.created_at,
                "revised_at": review.revised_at,
                "current_revision": review.current_revision,
                "decision_state": state,
                "decision_choice": decision.choice if decision is not None else None,
            }
        )
    return summaries
