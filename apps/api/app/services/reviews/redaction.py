"""D1 hard-erasure adapter. ``redact_review_context`` is registered in
``aa_deletion.SOURCE_REDACTORS`` through the ``app.services.aa_reviews`` facade
and runs inside the hard-delete transaction.
"""

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select, text, update
from sqlalchemy.orm import Session

from app.analytics.enums import RedactionReason
from app.models import (
    AAReviewContextItem,
    AAReviewContextSource,
)
from app.services.reviews.contracts import ERASED_ITEM_VALUES


def redact_review_context(db: Session, user_id: UUID, table_name: str, fact_id: UUID) -> None:
    """Erase every frozen item derived from ``fact_id``. Transactional adapter.

    Runs inside ``delete_fact``'s transaction: it never commits, never logs
    content, and leaves no link to the erased id behind. User-authored rows are
    untouched because they have no source link to find.
    """
    item_ids = list(
        db.scalars(
            select(AAReviewContextSource.item_id).where(
                AAReviewContextSource.user_id == user_id,
                AAReviewContextSource.source_table == table_name,
                AAReviewContextSource.source_fact_id == fact_id,
            )
        )
    )
    if not item_ids:
        return
    db.execute(
        update(AAReviewContextItem)
        .where(
            AAReviewContextItem.user_id == user_id,
            AAReviewContextItem.id.in_(item_ids),
            AAReviewContextItem.redacted_at.is_(None),
        )
        .values(
            **ERASED_ITEM_VALUES,
            redacted_at=datetime.now(UTC),
            redaction_reason=str(RedactionReason.SOURCE_HARD_DELETED),
        )
        .execution_options(synchronize_session=False)
    )
    # The erased item no longer needs any link; removing all of them means no
    # reference to the deleted fact survives either.
    db.execute(
        delete(AAReviewContextSource)
        .where(
            AAReviewContextSource.user_id == user_id,
            AAReviewContextSource.item_id.in_(item_ids),
        )
        .execution_options(synchronize_session=False)
    )
    db.flush()


def review_items_for_sources(
    db: Session, user_id: UUID, sources: Sequence[tuple[str, UUID]]
) -> list[UUID]:
    """Unredacted frozen items linked to any ``(table, fact_id)`` — one set query.

    Slice 8 retention erases thousands of facts at once; this is the set-based
    counterpart of the per-fact lookup above (index ``(user_id, source_fact_id)``).
    """
    if not sources:
        return []
    tables = [table for table, _ in sources]
    identities = [identity for _, identity in sources]
    rows = db.execute(
        text(
            "SELECT DISTINCT s.item_id FROM aa_review_context_sources s"
            " JOIN unnest(CAST(:tables AS text[]), CAST(:ids AS uuid[])) AS p(tbl, id)"
            "   ON s.source_fact_id = p.id AND s.source_table = p.tbl"
            " JOIN aa_review_context_items i ON i.id = s.item_id"
            " WHERE s.user_id = :user_id AND i.redacted_at IS NULL"
        ),
        {"tables": tables, "ids": identities, "user_id": user_id},
    )
    return sorted(row[0] for row in rows)


def redact_review_items(
    db: Session, user_id: UUID, item_ids: Sequence[UUID], reason: RedactionReason
) -> int:
    """Erase the given frozen items and all their links. Transactional; never commits.

    User-authored rows (note, revisions, factors, decisions) have no source link
    and are untouched — D1 / O2.
    """
    if not item_ids:
        return 0
    erased = db.execute(
        update(AAReviewContextItem)
        .where(
            AAReviewContextItem.user_id == user_id,
            AAReviewContextItem.id.in_(item_ids),
            AAReviewContextItem.redacted_at.is_(None),
        )
        .values(**ERASED_ITEM_VALUES, redacted_at=datetime.now(UTC), redaction_reason=str(reason))
        .execution_options(synchronize_session=False)
    ).rowcount
    db.execute(
        delete(AAReviewContextSource)
        .where(
            AAReviewContextSource.user_id == user_id,
            AAReviewContextSource.item_id.in_(item_ids),
        )
        .execution_options(synchronize_session=False)
    )
    db.flush()
    return erased
