"""Writes: ``save_review`` (re-derive, compare fingerprint, store) and
``revise_review`` (append-only revision with idempotency).
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.enums import DecisionScope
from app.models import (
    AADecision,
    AAReview,
    AAReviewContextItem,
    AAReviewContextSource,
    AAReviewFactor,
    AAReviewRevision,
)
from app.services.reviews.context import build_context
from app.services.reviews.contracts import ReviewContext
from app.services.reviews.errors import (
    EmptyRevisionError,
    IdempotencyKeyReusedError,
    InvalidFactorError,
    InvalidReviewError,
    ReviewContextChangedError,
    ReviewNotFoundError,
)
from app.services.reviews.values import VALUE_COLUMNS


def _persist_items(db: Session, *, user_id: UUID, review_id: UUID, context: ReviewContext):
    for ordinal, item in enumerate(context.items, start=1):
        row = AAReviewContextItem(
            id=uuid4(),
            user_id=user_id,
            review_id=review_id,
            ordinal=ordinal,
            section=str(item.section),
            role=str(item.role),
            label_key=item.label_key,
            metric_key=item.metric_key,
            availability=str(item.availability),
            value_type=str(item.value.value_type) if item.value is not None else None,
            **{
                column: (getattr(item.value, column) if item.value is not None else None)
                for column in VALUE_COLUMNS
            },
            desire=str(item.desire) if item.desire is not None else None,
            epistemic_kind=item.epistemic_kind,
            estimate=item.estimate,
            source_kind=item.source_kind,
            basis=item.basis,
            method=item.method,
            provenance_recorded_at=item.provenance_recorded_at,
            original_recorded_at_known=item.original_recorded_at_known,
        )
        db.add(row)
        for table, fact_id in sorted(set(item.sources)):
            db.add(
                AAReviewContextSource(
                    id=uuid4(),
                    user_id=user_id,
                    item_id=row.id,
                    source_table=table,
                    source_fact_id=UUID(fact_id),
                )
            )


def _revision_by_key(db: Session, *, user_id: UUID, key: str) -> AAReviewRevision | None:
    return db.scalar(
        select(AAReviewRevision).where(
            AAReviewRevision.user_id == user_id, AAReviewRevision.idempotency_key == key
        )
    )


def save_review(db: Session, *, user_id: UUID, request: Any) -> tuple[UUID, bool]:
    """Create a Review in one transaction. Returns ``(review_id, replayed)``."""
    existing = _revision_by_key(db, user_id=user_id, key=request.idempotency_key)
    if existing is not None:
        if existing.revision != 1:
            raise IdempotencyKeyReusedError
        return existing.review_id, True

    subject = request.subject.to_ref()
    if request.context_as_of > datetime.now(UTC):
        raise InvalidReviewError
    context = build_context(
        db,
        user_id=user_id,
        subject=subject,
        window_start=request.window_start,
        window_end=request.window_end,
        timezone=request.timezone,
        as_of=request.context_as_of,
    )
    if context.fingerprint != request.context_fingerprint:
        db.rollback()
        raise ReviewContextChangedError

    try:
        review = AAReview(
            id=uuid4(),
            user_id=user_id,
            subject_domain=subject.subject_domain,
            subject_type=subject.subject_type,
            subject_id=subject.subject_id,
            window_start=context.window_start,
            window_end=context.window_end,
            timezone=context.timezone,
            context_as_of=context.as_of,
            render_manifest=context.manifest,
            current_revision=1,
        )
        db.add(review)
        db.flush()
        _persist_items(db, user_id=user_id, review_id=review.id, context=context)
        db.add(
            AAReviewRevision(
                id=uuid4(),
                user_id=user_id,
                review_id=review.id,
                revision=1,
                note_text=request.note_text,
                idempotency_key=request.idempotency_key,
            )
        )
        for ordinal, factor in enumerate(request.factors, start=1):
            db.add(
                AAReviewFactor(
                    id=uuid4(),
                    user_id=user_id,
                    review_id=review.id,
                    ordinal=ordinal,
                    text=factor.text,
                    epistemic_kind=str(factor.epistemic_kind),
                    added_in_revision=1,
                )
            )
        if request.decision is not None:
            db.add(
                AADecision(
                    id=uuid4(),
                    user_id=user_id,
                    scope=str(DecisionScope.REVIEW),
                    review_id=review.id,
                    choice=_choice(request.decision.choice),
                    revision=1,
                )
            )
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = _revision_by_key(db, user_id=user_id, key=request.idempotency_key)
        if existing is not None and existing.revision == 1:
            return existing.review_id, True
        raise
    except BaseException:
        db.rollback()
        raise
    return review.id, False


def _choice(choice: Any) -> str | None:
    return None if choice is None else str(choice)


def revise_review(
    db: Session, *, user_id: UUID, review_id: UUID, request: Any
) -> tuple[UUID, bool]:
    """Append one revision. Nothing already written is rewritten."""
    existing = _revision_by_key(db, user_id=user_id, key=request.idempotency_key)
    if existing is not None:
        if existing.review_id != review_id or existing.revision == 1:
            raise IdempotencyKeyReusedError
        return review_id, True

    changes_decision = request.changes_decision
    if not (
        request.note_text
        or request.add_factors
        or request.retract_factor_ids
        or changes_decision
    ):
        raise EmptyRevisionError

    try:
        review = db.scalar(
            select(AAReview)
            .where(AAReview.user_id == user_id, AAReview.id == review_id)
            .with_for_update()
        )
        if review is None:
            raise ReviewNotFoundError
        revision = review.current_revision + 1
        now = datetime.now(UTC)

        retract = set(request.retract_factor_ids)
        if retract:
            rows = db.scalars(
                select(AAReviewFactor).where(
                    AAReviewFactor.user_id == user_id,
                    AAReviewFactor.review_id == review.id,
                    AAReviewFactor.id.in_(retract),
                    AAReviewFactor.retracted_in_revision.is_(None),
                )
            ).all()
            if len(rows) != len(retract):
                raise InvalidFactorError
            for row in rows:
                row.retracted_in_revision = revision

        if request.add_factors:
            known = set(
                db.scalars(
                    select(AAReviewFactor.id).where(
                        AAReviewFactor.user_id == user_id,
                        AAReviewFactor.review_id == review.id,
                    )
                )
            )
            next_ordinal = (
                db.scalar(
                    select(func.max(AAReviewFactor.ordinal)).where(
                        AAReviewFactor.review_id == review.id
                    )
                )
                or 0
            ) + 1
            for offset, factor in enumerate(request.add_factors):
                if factor.replaces_id is not None and factor.replaces_id not in known:
                    raise InvalidFactorError
                db.add(
                    AAReviewFactor(
                        id=uuid4(),
                        user_id=user_id,
                        review_id=review.id,
                        ordinal=next_ordinal + offset,
                        text=factor.text,
                        epistemic_kind=str(factor.epistemic_kind),
                        added_in_revision=revision,
                        replaces_id=factor.replaces_id,
                    )
                )

        if changes_decision:
            current = db.scalar(
                select(AADecision)
                .where(
                    AADecision.user_id == user_id,
                    AADecision.review_id == review.id,
                    AADecision.superseded_in_revision.is_(None),
                )
                .with_for_update()
            )
            if current is not None:
                current.superseded_in_revision = revision
                db.flush()
            db.add(
                AADecision(
                    id=uuid4(),
                    user_id=user_id,
                    scope=str(DecisionScope.REVIEW),
                    review_id=review.id,
                    choice=_choice(request.decision.choice),
                    revision=revision,
                )
            )

        db.add(
            AAReviewRevision(
                id=uuid4(),
                user_id=user_id,
                review_id=review.id,
                revision=revision,
                note_text=request.note_text,
                idempotency_key=request.idempotency_key,
            )
        )
        review.current_revision = revision
        review.revised_at = now
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = _revision_by_key(db, user_id=user_id, key=request.idempotency_key)
        if existing is not None and existing.review_id == review_id and existing.revision > 1:
            return review_id, True
        raise
    except BaseException:
        db.rollback()
        raise
    return review_id, False
