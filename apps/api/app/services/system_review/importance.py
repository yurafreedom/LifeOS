"""User-owned importance (master context §41). A word, never a number.

A rating is appended and supersedes the active one for the same target under
an advisory transaction lock, so two concurrent answers leave exactly one active
rating and the full history. Importance is never read by any derivation: it
only lets the user order or filter what they asked to see.
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.enums import Importance
from app.models import AAImportanceRating
from app.services.system_review.contracts import advisory_lock
from app.services.system_review.errors import IdempotencyKeyReusedError, InvalidImportanceError
from app.services.system_review.resolve import resolve


def _by_key(db: Session, *, user_id: UUID, key: str) -> AAImportanceRating | None:
    return db.scalar(
        select(AAImportanceRating).where(
            AAImportanceRating.user_id == user_id, AAImportanceRating.idempotency_key == key
        )
    )


def _replay(row: AAImportanceRating, target_key: str, importance: str) -> AAImportanceRating:
    if (row.target_key, row.importance) != (target_key, importance):
        raise IdempotencyKeyReusedError
    return row


def set_importance(
    db: Session, *, user_id: UUID, target_key: str, importance: str, key: str
) -> tuple[AAImportanceRating, bool]:
    if importance not in {member.value for member in Importance}:
        raise InvalidImportanceError
    existing = _by_key(db, user_id=user_id, key=key)
    if existing is not None:
        return _replay(existing, target_key, importance), True
    resolve(db, user_id=user_id, key=target_key)
    now = datetime.now(UTC)
    try:
        advisory_lock(db, "aa_importance_ratings", user_id, target_key)
        existing = _by_key(db, user_id=user_id, key=key)
        if existing is not None:
            db.rollback()
            return _replay(existing, target_key, importance), True
        current = db.scalar(
            select(AAImportanceRating)
            .where(
                AAImportanceRating.user_id == user_id,
                AAImportanceRating.target_key == target_key,
                AAImportanceRating.status == "active",
            )
            .with_for_update()
        )
        if current is not None:
            current.status = "superseded"
            current.superseded_at = now
            db.flush()
        row = AAImportanceRating(
            id=uuid4(),
            user_id=user_id,
            target_key=target_key,
            importance=importance,
            recorded_at=now,
            status="active",
            supersedes_id=current.id if current is not None else None,
            idempotency_key=key,
        )
        db.add(row)
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = _by_key(db, user_id=user_id, key=key)
        if existing is not None:
            return _replay(existing, target_key, importance), True
        raise
    except BaseException:
        db.rollback()
        raise
    return row, False


def importance_map(
    db: Session, *, user_id: UUID, keys: list[str] | None = None
) -> dict[str, dict[str, str]]:
    """Active ratings, keyed by target. No row → absent from the map (undecided)."""
    query = select(AAImportanceRating).where(
        AAImportanceRating.user_id == user_id, AAImportanceRating.status == "active"
    )
    if keys is not None:
        if not keys:
            return {}
        query = query.where(AAImportanceRating.target_key.in_(keys))
    return {
        row.target_key: {"importance": row.importance, "recorded_at": row.recorded_at.isoformat()}
        for row in db.scalars(query)
    }


def importance_history(db: Session, *, user_id: UUID, target_key: str) -> list[dict[str, str]]:
    rows = db.scalars(
        select(AAImportanceRating)
        .where(
            AAImportanceRating.user_id == user_id, AAImportanceRating.target_key == target_key
        )
        .order_by(AAImportanceRating.recorded_at, AAImportanceRating.id)
    )
    return [
        {"importance": row.importance, "recorded_at": row.recorded_at.isoformat(),
         "status": row.status}
        for row in rows
    ]


def rated_count(db: Session, *, user_id: UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(AAImportanceRating)
            .where(
                AAImportanceRating.user_id == user_id, AAImportanceRating.status == "active"
            )
        )
        or 0
    )
