"""Saved System Review revisions — append-only (OD-7.2 C, plan §13).

A save, a finalize and a revise each append revision N+1 carrying the user's
own words and a frozen copy of what the live review showed at that instant.
Revision N is never rewritten: if a transaction is corrected later, the live
review changes and the saved revision keeps what it saw; a new revision may say
"after the correction, my conclusion changed". The only in-place change a
revision ever receives is D1 redaction.

Concurrency is optimistic and deterministic: the client states the revision it
based its change on; a mismatch, or losing the unique ``(period, revision)``
race, is ``409 revision_conflict`` — never a silent overwrite, never a fork.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AASystemReviewRevision
from app.services.system_review.contracts import (
    MANIFEST_VERSION,
    MAX_ENTRY_CHARS,
    MAX_LIST_ENTRIES,
    MAX_REFLECTION_CHARS,
)
from app.services.system_review.errors import (
    IdempotencyKeyReusedError,
    InvalidSystemReviewError,
    PeriodNotEndedError,
    RevisionConflictError,
    RevisionNotFoundError,
)
from app.services.system_review.periods import Period, has_ended
from app.services.system_review.read_model import build_review, strip_sources
from app.services.system_review.refs import id_bearing_sources

FROZEN_SECTIONS = ("changed", "improved", "repeated", "tradeoffs", "relations")


def _clean_list(values: list[str] | None) -> list[str]:
    cleaned = []
    for value in values or []:
        if not isinstance(value, str) or not value.strip():
            raise InvalidSystemReviewError
        if len(value.strip()) > MAX_ENTRY_CHARS:
            raise InvalidSystemReviewError
        cleaned.append(value.strip())
    if len(cleaned) > MAX_LIST_ENTRIES:
        raise InvalidSystemReviewError
    return cleaned


def _relation_sources(item: dict[str, Any]) -> list[list[str]]:
    sources = []
    for key in (item["from"]["key"], item["to"]["key"],
                *[entry.get("ref") for entry in item.get("evidence", [])]):
        sources += [list(pair) for pair in id_bearing_sources(key or "")]
    return sources


def freeze(review: dict[str, Any]) -> tuple[dict[str, Any], list[UUID]]:
    """What the revision keeps: items with their sources, ordinals and sections."""
    sections = review["sections"]
    frozen_sections: dict[str, Any] = {}
    for name in FROZEN_SECTIONS:
        items = []
        for ordinal, item in enumerate(sections[name]["items"], start=1):
            sources = item.get("sources", [])
            if name == "relations":
                sources = _relation_sources(item)
            items.append({**item, "ordinal": ordinal, "section": name, "sources": sources})
        frozen_sections[name] = items
    consequences = sections["consequences"]
    expenses = [
        {**analysis, "ordinal": ordinal, "section": "consequences"}
        for ordinal, analysis in enumerate(consequences.get("expenses", []), start=1)
    ]
    position = consequences.get("position") or {}
    position_items = []
    for group in ("obligations", "reserves", "essentials"):
        for entry in position.get(group, []):
            position_items.append({
                **entry, "group": group, "kind": "position", "section": "consequences",
                "ordinal": len(position_items) + 1,
                "sources": [["aa_finance_contexts", entry["entity_id"]]],
            })
    priorities = [
        {**priority, "section": "consequences", "ordinal": ordinal,
         "sources": priority.get("sources", [])}
        for ordinal, priority in enumerate(consequences.get("priorities", []), start=1)
    ]
    self_check = consequences.get("self_check")
    if self_check and self_check.get("entity_id"):
        self_check = {**self_check, "kind": "self_check", "section": "consequences",
                      "ordinal": 1, "sources": [["aa_finance_contexts", self_check["entity_id"]]]}
    frozen_sections["consequences"] = {
        "expenses": expenses,
        "position": position_items,
        "position_missing": position.get("missing_inputs", []),
        "priorities": priorities,
        "self_check": self_check,
        "unplanned_count": consequences.get("unplanned_count"),
        "funding_summary": consequences.get("funding_summary"),
    }
    frozen_sections["quality"] = sections["quality"]["items"]
    frozen = {
        "manifest_version": MANIFEST_VERSION,
        "period": review["period"],
        "period_kind": review["period_kind"],
        "timezone": review["timezone"],
        "evaluated_at": review["evaluated_at"],
        "period_state": review["period_state"],
        "not_a_verdict": True,
        "pending_proposals_count": sections["requires_confirmation"]["count"],
        "sections": frozen_sections,
    }
    ids: set[UUID] = set()
    _collect(frozen, ids)
    return frozen, sorted(ids, key=str)


def _collect(value: Any, ids: set[UUID]) -> None:
    if isinstance(value, dict):
        for pair in value.get("sources", []) or []:
            if isinstance(pair, list) and len(pair) == 2:
                try:
                    ids.add(UUID(str(pair[1])))
                except ValueError:
                    continue
        for key, inner in value.items():
            if key != "sources":
                _collect(inner, ids)
    elif isinstance(value, list):
        for inner in value:
            _collect(inner, ids)


def _by_key(db: Session, *, user_id: UUID, key: str) -> AASystemReviewRevision | None:
    return db.scalar(
        select(AASystemReviewRevision).where(
            AASystemReviewRevision.user_id == user_id,
            AASystemReviewRevision.idempotency_key == key,
        )
    )


def _replay(row: AASystemReviewRevision, period: Period) -> AASystemReviewRevision:
    if (row.period_kind, row.period_key) != (period.kind, period.key):
        raise IdempotencyKeyReusedError
    return row


def current_revision(db: Session, *, user_id: UUID, period: Period) -> int:
    return int(
        db.scalar(
            select(func.max(AASystemReviewRevision.revision)).where(
                AASystemReviewRevision.user_id == user_id,
                AASystemReviewRevision.period_kind == period.kind,
                AASystemReviewRevision.period_key == period.key,
            )
        )
        or 0
    )


def save_revision(
    db: Session,
    *,
    user_id: UUID,
    period: Period,
    base_revision: int | None,
    finalize: bool,
    reflection: str | None,
    no_conclusion: bool,
    decisions: list[str] | None,
    adjustments: list[str] | None,
    key: str,
    now: datetime,
) -> tuple[AASystemReviewRevision, bool]:
    existing = _by_key(db, user_id=user_id, key=key)
    if existing is not None:
        return _replay(existing, period), True
    reflection = (reflection or "").strip() or None
    if reflection is not None and len(reflection) > MAX_REFLECTION_CHARS:
        raise InvalidSystemReviewError
    if no_conclusion and reflection is not None:
        raise InvalidSystemReviewError
    decisions = _clean_list(decisions)
    adjustments = _clean_list(adjustments)
    if finalize and not has_ended(period, now):
        raise PeriodNotEndedError
    current = current_revision(db, user_id=user_id, period=period)
    if (base_revision or 0) != current:
        db.rollback()
        raise RevisionConflictError
    previous = None
    if current:
        previous = db.scalar(
            select(AASystemReviewRevision.id).where(
                AASystemReviewRevision.user_id == user_id,
                AASystemReviewRevision.period_kind == period.kind,
                AASystemReviewRevision.period_key == period.key,
                AASystemReviewRevision.revision == current,
            )
        )
    review = build_review(db, user_id=user_id, period=period, now=now)
    frozen, source_ids = freeze(review)
    saved_at = datetime.now(UTC)
    row = AASystemReviewRevision(
        id=uuid4(),
        user_id=user_id,
        period_kind=period.kind,
        period_key=period.key,
        timezone=period.timezone,
        revision=current + 1,
        previous_revision_id=previous,
        status="finalized" if finalize else "draft",
        finalized_at=saved_at if finalize else None,
        context_as_of=now,
        reflection=reflection,
        no_conclusion=no_conclusion,
        decisions=decisions,
        adjustments=adjustments,
        frozen_context=frozen,
        source_ids=source_ids,
        idempotency_key=key,
    )
    try:
        db.add(row)
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = _by_key(db, user_id=user_id, key=key)
        if existing is not None:
            return _replay(existing, period), True
        raise RevisionConflictError from None
    except BaseException:
        db.rollback()
        raise
    return row, False


def list_revisions(db: Session, *, user_id: UUID, period: Period) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(AASystemReviewRevision)
        .where(
            AASystemReviewRevision.user_id == user_id,
            AASystemReviewRevision.period_kind == period.kind,
            AASystemReviewRevision.period_key == period.key,
        )
        .order_by(AASystemReviewRevision.revision)
    )
    return [
        {
            "revision": row.revision,
            "status": row.status,
            "created_at": row.created_at.isoformat(),
            "finalized_at": row.finalized_at.isoformat() if row.finalized_at else None,
            "context_as_of": row.context_as_of.isoformat(),
            "redacted_at": row.redacted_at.isoformat() if row.redacted_at else None,
            "has_reflection": row.reflection is not None,
            "no_conclusion": row.no_conclusion,
            "decisions": len(row.decisions or []),
            "adjustments": len(row.adjustments or []),
        }
        for row in rows
    ]


def get_revision(
    db: Session, *, user_id: UUID, period: Period, revision: int
) -> AASystemReviewRevision:
    row = db.scalar(
        select(AASystemReviewRevision).where(
            AASystemReviewRevision.user_id == user_id,
            AASystemReviewRevision.period_kind == period.kind,
            AASystemReviewRevision.period_key == period.key,
            AASystemReviewRevision.revision == revision,
        )
    )
    if row is None:
        raise RevisionNotFoundError
    return row


def revision_payload(
    row: AASystemReviewRevision, *, live_source_ids: set[UUID] | None = None
) -> dict[str, Any]:
    changed = None
    if live_source_ids is not None:
        changed = set(row.source_ids or []) != live_source_ids
    return {
        "period": row.period_key,
        "period_kind": row.period_kind,
        "timezone": row.timezone,
        "revision": row.revision,
        "status": row.status,
        "created_at": row.created_at.isoformat(),
        "finalized_at": row.finalized_at.isoformat() if row.finalized_at else None,
        "context_as_of": row.context_as_of.isoformat(),
        "reflection": row.reflection,
        "no_conclusion": row.no_conclusion,
        "decisions": list(row.decisions or []),
        "adjustments": list(row.adjustments or []),
        "redacted_at": row.redacted_at.isoformat() if row.redacted_at else None,
        "frozen": strip_sources(row.frozen_context),
        "live_sources_changed": changed,
    }


def live_source_ids(db: Session, *, user_id: UUID, period: Period, now: datetime) -> set[UUID]:
    _, ids = freeze(build_review(db, user_id=user_id, period=period, now=now))
    return set(ids)
