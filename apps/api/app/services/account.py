"""Full account erasure through the existing users cascade boundary."""

import logging
from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import User
from app.services import security_audit

logger = logging.getLogger(__name__)


def delete_account(db: Session, *, user_id: UUID) -> None:
    """Erase the account and everything it owns (FK cascades), including its
    sessions, tokens, invitations and security events. One anonymous
    ``account_deleted`` event remains — no account id, email or device."""
    removed = db.execute(delete(User).where(User.id == user_id)).rowcount
    if removed:
        security_audit.record(db, "account_deleted")
    db.commit()
    logger.info("account.deleted", extra={"account_id": str(user_id), "rows_deleted": removed})
