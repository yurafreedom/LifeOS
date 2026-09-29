"""Relations: the user's own links and their answers to system proposals (OD-7.1).

* A **user link** («Связать») is created ``approved`` with ``source=user``: the
  user is the one asserting it. Default type ``related``; epistemic kind follows
  the type (``may_*`` → hypothesis). It can carry a note and can be removed.
* A **system proposal** is derived live and has no row until the user answers
  it; the first answer creates the row with the rule's exact provenance and
  evidence, and every answer (first or changed) appends to the feedback log.
  The system never approves anything itself.
* Causal wording is refused outright; there is no confidence or strength field.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Text, cast, delete, exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.enums import (
    SYMMETRIC_RELATION_TYPES,
    RelationResponse,
    RelationSource,
    RelationStatus,
    relation_epistemic_kind,
)
from app.models import AACrossReference, AAImportanceRating, AARelationFeedback
from app.services.system_review.contracts import (
    LIST_LIMIT_MAX,
    PROPOSAL_MODEL,
    advisory_lock,
    normalize_relation_type,
)
from app.services.system_review.errors import (
    IdempotencyKeyReusedError,
    InvalidRelationError,
    ProposalNotCurrentError,
    RelationNotDeletableError,
    RelationNotFoundError,
    SelfRelationError,
)
from app.services.system_review.refs import REDACTED, relation_ref, valid_period
from app.services.system_review.resolve import resolve


class RelationIdUnavailableError(IdempotencyKeyReusedError):
    code = "relation_id_unavailable"
    message = "This relation id cannot be used."


class InvalidResponseError(InvalidRelationError):
    code = "invalid_response"
    message = "A link you created can only be kept (its note edited) or removed."


def _clean_note(note: str | None) -> str | None:
    if note is None:
        return None
    stripped = note.strip()
    return stripped or None


def _owned(db: Session, *, user_id: UUID, relation_id: UUID, lock: bool = False):
    query = select(AACrossReference).where(
        AACrossReference.user_id == user_id, AACrossReference.id == relation_id
    )
    if lock:
        query = query.with_for_update()
    row = db.scalar(query)
    if row is None:
        raise RelationNotFoundError
    return row


# ───────────────────────────── user links ─────────────────────────────


def create_link(
    db: Session,
    *,
    user_id: UUID,
    relation_id: UUID,
    from_key: str,
    to_key: str,
    relation_type: str,
    note: str | None,
    period: str | None,
    key: str,
) -> tuple[AACrossReference, bool]:
    """Store a user link. Returns ``(row, replayed)``; a natural duplicate is a replay."""
    note = _clean_note(note)
    kind = normalize_relation_type(relation_type)
    existing = db.scalar(
        select(AACrossReference).where(
            AACrossReference.user_id == user_id, AACrossReference.idempotency_key == key
        )
    )
    if existing is not None:
        if existing.id != relation_id or existing.source != RelationSource.USER:
            raise IdempotencyKeyReusedError
        return existing, True
    if period is not None and not valid_period(period):
        raise InvalidRelationError
    source = resolve(db, user_id=user_id, key=from_key, endpoint=True)
    target = resolve(db, user_id=user_id, key=to_key, endpoint=True)
    if source.ref.key == target.ref.key:
        raise SelfRelationError
    if kind in SYMMETRIC_RELATION_TYPES and target.ref.key < source.ref.key:
        source, target = target, source
    duplicate = db.scalar(
        select(AACrossReference).where(
            AACrossReference.user_id == user_id,
            AACrossReference.source == RelationSource.USER,
            AACrossReference.from_key == source.ref.key,
            AACrossReference.to_key == target.ref.key,
            AACrossReference.relation_type == kind,
            AACrossReference.endpoint_redacted_at.is_(None),
        )
    )
    if duplicate is not None:
        return duplicate, True
    if db.scalar(select(exists().where(AACrossReference.id == relation_id))):
        raise RelationIdUnavailableError
    row = AACrossReference(
        id=relation_id,
        user_id=user_id,
        source=RelationSource.USER.value,
        evidence=[],
        from_key=source.ref.key,
        to_key=target.ref.key,
        from_domain=source.domain,
        to_domain=target.domain,
        relation_type=kind,
        epistemic_kind=relation_epistemic_kind(kind).value,
        period_key=period,
        status=RelationStatus.APPROVED.value,
        note=note,
        idempotency_key=key,
    )
    try:
        db.add(row)
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(AACrossReference).where(
                AACrossReference.user_id == user_id, AACrossReference.idempotency_key == key
            )
        )
        if existing is not None and existing.id == relation_id:
            return existing, True
        raise
    except BaseException:
        db.rollback()
        raise
    return row, False


def delete_link(db: Session, *, user_id: UUID, relation_id: UUID) -> bool:
    """Hard-delete a user link (its feedback cascades). Idempotent: absent → done."""
    row = db.scalar(
        select(AACrossReference)
        .where(AACrossReference.user_id == user_id, AACrossReference.id == relation_id)
        .with_for_update()
    )
    if row is None:
        db.rollback()
        return True
    if row.source != RelationSource.USER:
        db.rollback()
        raise RelationNotDeletableError
    try:
        db.execute(
            delete(AAImportanceRating).where(
                AAImportanceRating.user_id == user_id,
                AAImportanceRating.target_key == relation_ref(relation_id),
            )
        )
        db.delete(row)
        db.commit()
    except BaseException:
        db.rollback()
        raise
    return False


# ───────────────────────────── answers ─────────────────────────────


def _feedback_by_key(db: Session, *, user_id: UUID, key: str) -> AARelationFeedback | None:
    return db.scalar(
        select(AARelationFeedback).where(
            AARelationFeedback.user_id == user_id, AARelationFeedback.idempotency_key == key
        )
    )


def _append_answer(
    db: Session,
    row: AACrossReference,
    *,
    response: str,
    note: str | None,
    fingerprint: str | None,
    key: str,
    now: datetime,
) -> None:
    db.add(
        AARelationFeedback(
            id=uuid4(),
            user_id=row.user_id,
            relation_id=row.id,
            response=response,
            note=note,
            responded_at=now,
            input_fingerprint=fingerprint,
            idempotency_key=key,
        )
    )
    row.status = response
    row.note = note
    row.responded_at = now


def record_feedback(
    db: Session,
    *,
    user_id: UUID,
    relation_id: UUID,
    response: str,
    note: str | None,
    key: str,
) -> tuple[AACrossReference, bool]:
    """Change an answer (or a user link's note). Appends; never rewrites history."""
    if response not in {member.value for member in RelationResponse}:
        raise InvalidRelationError
    note = _clean_note(note)
    replay = _feedback_by_key(db, user_id=user_id, key=key)
    if replay is not None:
        if replay.relation_id != relation_id or replay.response != response:
            raise IdempotencyKeyReusedError
        return _owned(db, user_id=user_id, relation_id=relation_id), True
    try:
        row = _owned(db, user_id=user_id, relation_id=relation_id, lock=True)
        if row.source == RelationSource.USER and response != RelationResponse.APPROVED:
            raise InvalidResponseError
        _append_answer(
            db, row, response=response, note=note, fingerprint=row.input_fingerprint, key=key,
            now=datetime.now(UTC),
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        replay = _feedback_by_key(db, user_id=user_id, key=key)
        if replay is not None and replay.relation_id == relation_id:
            return _owned(db, user_id=user_id, relation_id=relation_id), True
        raise
    except BaseException:
        db.rollback()
        raise
    return row, False


def respond_to_proposal(
    db: Session,
    *,
    user_id: UUID,
    candidate: Any | None,
    proposal_key: str,
    response: str,
    note: str | None,
    evaluated_at: datetime | None,
    key: str,
) -> tuple[AACrossReference, bool]:
    """Answer a live proposal. ``candidate`` is the server's own re-derivation.

    The row is created at the first answer with the server's current evidence and
    fingerprint; a later answer to the same occurrence appends to the log. If the
    evidence no longer supports the proposal, nothing is stored (409).
    """
    if response not in {member.value for member in RelationResponse}:
        raise InvalidRelationError
    note = _clean_note(note)
    replay = _feedback_by_key(db, user_id=user_id, key=key)
    if replay is not None:
        row = _owned(db, user_id=user_id, relation_id=replay.relation_id)
        if row.proposal_key != proposal_key or replay.response != response:
            raise IdempotencyKeyReusedError
        return row, True
    now = datetime.now(UTC)
    try:
        advisory_lock(db, "aa_cross_references", user_id, proposal_key)
        replay = _feedback_by_key(db, user_id=user_id, key=key)
        if replay is not None:
            db.rollback()
            return _owned(db, user_id=user_id, relation_id=replay.relation_id), True
        row = db.scalar(
            select(AACrossReference)
            .where(
                AACrossReference.user_id == user_id,
                AACrossReference.proposal_key == proposal_key,
            )
            .with_for_update()
        )
        if row is None:
            if candidate is None:
                raise ProposalNotCurrentError
            # When the user saw it, bounded to [now − 7 days, now].
            proposed = evaluated_at if evaluated_at is not None else now
            proposed = min(max(proposed, now - timedelta(days=7)), now)
            row = AACrossReference(
                id=uuid4(),
                user_id=user_id,
                source=RelationSource.RULE.value,
                proposal_family=candidate.family,
                proposal_model=PROPOSAL_MODEL,
                proposal_model_version=candidate.rule_version,
                proposal_key=candidate.proposal_key,
                input_fingerprint=candidate.fingerprint,
                evidence=[dict(entry) for entry in candidate.evidence],
                from_key=candidate.from_key,
                to_key=candidate.to_key,
                from_domain=candidate.from_domain,
                to_domain=candidate.to_domain,
                relation_type=candidate.relation_type,
                epistemic_kind=candidate.epistemic_kind,
                period_key=candidate.period,
                status=response,
                note=note,
                proposed_at=proposed,
                responded_at=now,
                idempotency_key=key,
            )
            db.add(row)
            db.flush()
        fingerprint = candidate.fingerprint if candidate is not None else row.input_fingerprint
        _append_answer(
            db, row, response=response, note=note, fingerprint=fingerprint,
            key=key, now=now,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        replay = _feedback_by_key(db, user_id=user_id, key=key)
        if replay is not None:
            return _owned(db, user_id=user_id, relation_id=replay.relation_id), True
        raise
    except BaseException:
        db.rollback()
        raise
    return row, False


# ───────────────────────────── reads ─────────────────────────────


def feedback_log(db: Session, *, user_id: UUID, relation_ids: list[UUID]) -> dict[UUID, list]:
    if not relation_ids:
        return {}
    rows = db.scalars(
        select(AARelationFeedback)
        .where(
            AARelationFeedback.user_id == user_id,
            AARelationFeedback.relation_id.in_(relation_ids),
        )
        .order_by(AARelationFeedback.responded_at, AARelationFeedback.id)
    )
    log: dict[UUID, list] = {}
    for row in rows:
        log.setdefault(row.relation_id, []).append(
            {
                "response": row.response,
                "note": row.note,
                "responded_at": row.responded_at.isoformat(),
                "input_fingerprint": row.input_fingerprint,
            }
        )
    return log


def _endpoint(key: str, domain: str) -> dict[str, Any]:
    return {"key": key, "domain": domain, "redacted": key == REDACTED}


def relation_payload(
    row: AACrossReference, history: list | None = None, current_fingerprint: str | None = None
) -> dict[str, Any]:
    changed = None
    if row.source != RelationSource.USER and current_fingerprint is not None:
        changed = current_fingerprint != row.input_fingerprint
    return {
        "id": str(row.id),
        "source": row.source,
        "family": row.proposal_family,
        "model": row.proposal_model,
        "rule_version": row.proposal_model_version,
        "proposal_key": row.proposal_key,
        "from": _endpoint(row.from_key, row.from_domain),
        "to": _endpoint(row.to_key, row.to_domain),
        "relation_type": row.relation_type,
        "epistemic_kind": row.epistemic_kind,
        "status": row.status,
        "note": row.note,
        "period": row.period_key,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "proposed_at": row.proposed_at.isoformat() if row.proposed_at else None,
        "responded_at": row.responded_at.isoformat() if row.responded_at else None,
        "evidence": list(row.evidence or []),
        "endpoint_redacted": row.endpoint_redacted_at is not None,
        "evidence_changed_since_response": changed,
        "revisit_eligible": bool(changed) and row.status == RelationStatus.UNSURE,
        "history": history or [],
    }


def list_relations(
    db: Session,
    *,
    user_id: UUID,
    statuses: tuple[str, ...] = (),
    types: tuple[str, ...] = (),
    sources: tuple[str, ...] = (),
    domains: tuple[str, ...] = (),
    period: str | None = None,
    importance: tuple[str, ...] = (),
    limit: int = LIST_LIMIT_MAX,
) -> list[AACrossReference]:
    """Persisted relations. Proposals that were never answered are not rows."""
    query = select(AACrossReference).where(AACrossReference.user_id == user_id)
    if statuses:
        query = query.where(AACrossReference.status.in_(statuses))
    if types:
        query = query.where(AACrossReference.relation_type.in_(types))
    if sources:
        query = query.where(AACrossReference.source.in_(sources))
    if domains:
        query = query.where(
            or_(AACrossReference.from_domain.in_(domains), AACrossReference.to_domain.in_(domains))
        )
    if period:
        query = query.where(
            or_(AACrossReference.period_key == period,
                AACrossReference.period_key.like(f"{period}-%"))
        )
    if importance:
        rated = select(AAImportanceRating.target_key).where(
            AAImportanceRating.user_id == user_id,
            AAImportanceRating.status == "active",
            AAImportanceRating.importance.in_(
                [value for value in importance if value != "undecided"]
            ),
        )
        undecided = "undecided" in importance
        any_rating = select(AAImportanceRating.target_key).where(
            AAImportanceRating.user_id == user_id,
            AAImportanceRating.status == "active",
            AAImportanceRating.importance != "none",
        )
        target = func.concat("relation|", cast(AACrossReference.id, Text))
        clauses = [target.in_(rated)]
        if undecided:
            # Undecided = no active rating, or the user's explicit reset to «не решил».
            clauses.append(target.not_in(any_rating))
        query = query.where(or_(*clauses))
    query = query.order_by(
        AACrossReference.period_key.desc().nulls_last(),
        AACrossReference.created_at.desc(),
        AACrossReference.id,
    ).limit(max(1, min(int(limit), LIST_LIMIT_MAX)))
    return list(db.scalars(query))


def responded_keys(db: Session, *, user_id: UUID) -> dict[str, AACrossReference]:
    """Every proposal occurrence the user already answered, by key."""
    rows = db.scalars(
        select(AACrossReference).where(
            AACrossReference.user_id == user_id,
            AACrossReference.proposal_key.is_not(None),
        )
    )
    return {row.proposal_key: row for row in rows}


def family_history(db: Session, *, user_id: UUID) -> dict[str, dict[str, int]]:
    """Current answers per proposal family — the ranking input, never a truth value."""
    rows = db.execute(
        select(AACrossReference.proposal_family, AACrossReference.status).where(
            AACrossReference.user_id == user_id,
            AACrossReference.source != RelationSource.USER,
            AACrossReference.proposal_family.is_not(None),
        )
    ).all()
    history: dict[str, dict[str, int]] = {}
    for family, status in rows:
        counts = history.setdefault(family, {"approved": 0, "rejected": 0, "unsure": 0})
        if status in counts:
            counts[status] += 1
    return history
