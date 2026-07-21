from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import UserSnapshot
from app.schemas.state import StateReplace


@dataclass(frozen=True)
class RevisionConflictError(Exception):
    current_revision: int


def get_user_snapshot(db: Session, *, user_id: UUID) -> UserSnapshot | None:
    return db.scalar(select(UserSnapshot).where(UserSnapshot.user_id == user_id))


def replace_user_snapshot(
    db: Session,
    user_id: UUID,
    request: StateReplace,
) -> UserSnapshot:
    if request.expected_revision == 0:
        statement = (
            insert(UserSnapshot)
            .values(
                user_id=user_id,
                schema_version=request.schema_version,
                revision=1,
                payload=request.payload,
            )
            .on_conflict_do_nothing(index_elements=[UserSnapshot.user_id])
            .returning(UserSnapshot)
        )
    else:
        statement = (
            update(UserSnapshot)
            .where(
                UserSnapshot.user_id == user_id,
                UserSnapshot.revision == request.expected_revision,
            )
            .values(
                schema_version=request.schema_version,
                revision=UserSnapshot.revision + 1,
                payload=request.payload,
                updated_at=func.now(),
            )
            .returning(UserSnapshot)
        )

    snapshot = db.scalar(statement)
    if snapshot is not None:
        db.commit()
        return snapshot

    current_revision = db.scalar(
        select(UserSnapshot.revision).where(UserSnapshot.user_id == user_id)
    )
    db.rollback()
    raise RevisionConflictError(current_revision=current_revision or 0)
