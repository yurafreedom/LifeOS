"""D1 hard-erasure adapter. ``redact_review_context`` is registered in
``aa_deletion.SOURCE_REDACTORS`` through the ``app.services.aa_reviews`` facade
and runs inside the hard-delete transaction.
"""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select, update
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
