"""Retention intent: append-only policy versions. Changing a policy never deletes."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.enums import RetentionMode, RetentionPolicyStatus
from app.models import AARetentionPolicy
from app.services.retention.contracts import (
    CONSEQUENCES_VERSION,
    RetentionConsequencesStaleError,
    RetentionConsequencesUnconfirmedError,
    RetentionIdempotencyReusedError,
    lock_retention,
)


@dataclass(frozen=True, slots=True)
class PolicyRequest:
    mode: RetentionMode
    retain_months: int | None
    consequences_version: str | None
    confirm_consequences: bool
    idempotency_key: str


def active_policy(db: Session, *, user_id: UUID) -> AARetentionPolicy | None:
    return db.scalar(
        select(AARetentionPolicy).where(
            AARetentionPolicy.user_id == user_id,
            AARetentionPolicy.status == RetentionPolicyStatus.ACTIVE,
        )
    )


def policy_version_count(db: Session, *, user_id: UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(AARetentionPolicy).where(
            AARetentionPolicy.user_id == user_id
        )
    ) or 0


def _same_intent(row: AARetentionPolicy, request: PolicyRequest) -> bool:
    return row.mode == request.mode and row.retain_months == request.retain_months


def set_policy(
    db: Session, *, user_id: UUID, request: PolicyRequest, now: datetime | None = None
) -> tuple[AARetentionPolicy | None, bool, bool]:
    """Append a new policy version. Returns ``(active_row, changed, replayed)``.

    Never deletes anything: a finite policy only allows a later explicit Apply.
    A finite policy requires confirmation of the *current* consequence disclosure.
    Choosing the intent already in force appends nothing.
    """
    at = now or datetime.now(UTC)
    finite = request.mode == RetentionMode.FINITE
    if finite and not request.confirm_consequences:
        raise RetentionConsequencesUnconfirmedError
    if finite and request.consequences_version != CONSEQUENCES_VERSION:
        raise RetentionConsequencesStaleError
    try:
        lock_retention(db, user_id)
        replay = db.scalar(
            select(AARetentionPolicy).where(
                AARetentionPolicy.user_id == user_id,
                AARetentionPolicy.idempotency_key == request.idempotency_key,
            )
        )
        if replay is not None:
            if not _same_intent(replay, request):
                raise RetentionIdempotencyReusedError
            db.commit()
            return active_policy(db, user_id=user_id), False, True
        current = active_policy(db, user_id=user_id)
        if current is None and request.mode == RetentionMode.UNLIMITED:
            # No row already means UNLIMITED; an explicit choice is still recorded
            # so the user's intent (not only the default) is visible and exported.
            pass
        elif current is not None and _same_intent(current, request):
            db.commit()
            return current, False, False
        if current is not None:
            current.status = RetentionPolicyStatus.SUPERSEDED
            current.superseded_at = at
            db.flush()
        row = AARetentionPolicy(
            user_id=user_id,
            mode=request.mode,
            retain_months=request.retain_months if finite else None,
            consequences_version=CONSEQUENCES_VERSION if finite else None,
            confirmed_at=at if finite else None,
            recorded_at=at,
            status=RetentionPolicyStatus.ACTIVE,
            supersedes_id=current.id if current is not None else None,
            idempotency_key=request.idempotency_key,
        )
        db.add(row)
        db.commit()
    except BaseException:
        db.rollback()
        raise
    db.refresh(row)
    return row, True, False
