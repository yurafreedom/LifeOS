"""Full account erasure through the existing users cascade boundary."""

import logging
from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import User

logger = logging.getLogger(__name__)


def delete_account(db: Session, *, user_id: UUID) -> None:
    removed = db.execute(delete(User).where(User.id == user_id)).rowcount
    db.commit()
    logger.info("account.deleted", extra={"account_id": str(user_id), "rows_deleted": removed})
