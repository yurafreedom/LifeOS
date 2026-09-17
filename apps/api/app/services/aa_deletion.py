"""Account-scoped erasure, with a transactional extension point for Review.

Future context-table adapters must erase source-derived content in the supplied
transaction. They must not commit, log content, or retain a deleted value.
"""

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AADeletionReceipt, AAMeasurement, AASourceCoverage
from app.services.aa_facts import AAServiceError, FactNotFoundError

logger = logging.getLogger(__name__)
FACT_TABLES = {
    "aa_measurements": AAMeasurement,
    "aa_source_coverage": AASourceCoverage,
}
Redactor = Callable[[Session, UUID, str, UUID], None]
# Slice 4 will register its context-table adapter here. No Review table exists yet.
SOURCE_REDACTORS: tuple[Redactor, ...] = ()


class DeletionConflictError(AAServiceError):
    code = "fact_deletion_conflict"
    message = "This fact is part of a correction chain; use tombstone or account deletion."


def redact_source_context(db: Session, user_id: UUID, table_name: str, fact_id: UUID) -> None:
    """Run all source-erasure adapters before commit; failures roll back deletion."""
    for adapter in SOURCE_REDACTORS:
        adapter(db, user_id, table_name, fact_id)


def _references(value: object, fact_id: UUID) -> bool:
    if isinstance(value, str):
        # Preserve no dangling URI/table-qualified references either. Slice 0
        # intentionally allows untyped source_ref JSON, not just {"id": UUID}.
        if str(fact_id) in value.casefold():
            return True
        try:
            return UUID(value) == fact_id
        except ValueError:
            return False
    if isinstance(value, dict):
        return any(_references(k, fact_id) or _references(v, fact_id) for k, v in value.items())
    if isinstance(value, list):
        return any(_references(item, fact_id) for item in value)
    return False


def _redact_provenance(db: Session, user_id: UUID, fact_id: UUID) -> int:
    """Source references are untyped JSON in Slice 0; conservatively erase the
    entire dependent provenance payload rather than guessing its JSON shape.
    Process bounded batches and never touch another account's provenance.
    """
    count = 0
    for model in FACT_TABLES.values():
        last_id = None
        while True:
            query = select(model).where(model.user_id == user_id, model.source_ref.is_not(None))
            if last_id is not None:
                query = query.where(model.id > last_id)
            rows = db.scalars(query.order_by(model.id).limit(200).with_for_update()).all()
            if not rows:
                break
            last_id = rows[-1].id
            for row in rows:
                if _references(row.source_ref, fact_id):
                    row.source_ref = row.basis = row.method = None
                    count += 1
            db.flush()
    return count


def delete_fact(
    db: Session,
    *,
    user_id: UUID,
    table_name: str,
    fact_id: UUID,
    mode: Literal["tombstone", "hard"],
) -> dict[str, object]:
    model = FACT_TABLES.get(table_name)
    if model is None:
        raise FactNotFoundError
    row = db.scalar(
        select(model).where(model.user_id == user_id, model.id == fact_id).with_for_update()
    )
    if row is None:
        raise FactNotFoundError
    now = datetime.now(UTC)
    try:
        if mode == "hard":
            # Preserve accepted correction/as-of semantics. Silently rewiring or
            # erasing other facts would exceed a single-fact deletion request.
            linked = db.scalar(
                select(model.id)
                .where(
                    model.user_id == user_id,
                    or_(model.supersedes_id == fact_id, model.superseded_by_id == fact_id),
                )
                .limit(1)
            )
            if linked or row.supersedes_id or row.superseded_by_id:
                raise DeletionConflictError
            redacted = _redact_provenance(db, user_id, fact_id)
            redact_source_context(db, user_id, table_name, fact_id)
            db.delete(row)
            receipt = AADeletionReceipt(
                user_id=user_id, table_name=table_name, fact_id=fact_id, deleted_at=now
            )
            db.add(receipt)
            db.flush()
            result = {
                "id": str(receipt.id),
                "table_name": table_name,
                "fact_id": str(fact_id),
                "deleted_at": now.isoformat(),
                "mode": mode,
            }
        else:
            row.status = "tombstoned"
            row.tombstoned_at = row.tombstoned_at or now
            row.basis = row.method = row.source_ref = row.supersede_reason = None
            if isinstance(row, AAMeasurement):
                row.unit_code = row.value_num = row.value_date = row.value_text = None
                row.scale_min = row.scale_max = row.dimensions = None
            else:
                row.source_id = row.coverage_state = None
                row.observed_units = row.expected_units = None
                row.completeness_known = False
            result = {
                "table_name": table_name,
                "fact_id": str(fact_id),
                "tombstoned_at": row.tombstoned_at.isoformat(),
                "mode": mode,
            }
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise DeletionConflictError from error
    except BaseException:
        db.rollback()
        raise
    logger.info(
        "aa.fact_deleted",
        extra={
            "aa_user_id": str(user_id),
            "aa_table": table_name,
            "aa_fact_id": str(fact_id),
            "aa_deletion_mode": mode,
            "aa_redacted_provenance_count": redacted if mode == "hard" else 0,
        },
    )
    return result
