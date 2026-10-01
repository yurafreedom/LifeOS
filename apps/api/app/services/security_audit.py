"""Security audit events (JENKIN S1).

What is recorded: the event name, when, which account (when known), which
session, a coarse network and device label, and small non-secret details
(counts, delivery mode). Never passwords, tokens, links, snapshot or financial
content, and never the email address typed into a failed login.

Retention: ``Settings.audit_retention_days`` (365 by default), purged
opportunistically. Erasure: events cascade with the account; the deletion
itself leaves one anonymous ``account_deleted`` row with no identifier.
Export: the account's own events leave with the account export.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import AuthAuditEvent
from app.security.client_info import ClientContext

EVENTS = frozenset({
    "account_bootstrapped",
    "login_succeeded",
    "login_failed",
    "login_throttled",
    "logout",
    "session_revoked",
    "sessions_revoked_others",
    "password_changed",
    "password_change_failed",
    "password_reset_requested",
    "password_reset_delivery_failed",
    "password_reset_completed",
    "email_verification_sent",
    "email_verified",
    "invitation_created",
    "invitation_revoked",
    "invitation_accepted",
    "account_deleted",
})


def record(
    db: Session,
    event: str,
    *,
    user_id: UUID | None = None,
    session_id: UUID | None = None,
    client: ClientContext | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Add an event to the caller's transaction (it commits with the action)."""
    if event not in EVENTS:
        raise ValueError(f"unknown audit event {event}")
    db.add(
        AuthAuditEvent(
            event=event,
            user_id=user_id,
            session_id=session_id,
            network=client.network if client else None,
            device_label=client.device_label if client else None,
            details=details or {},
            occurred_at=datetime.now(UTC),
        )
    )


def purge_expired(db: Session, *, retention_days: int, now: datetime | None = None) -> int:
    cutoff = (now or datetime.now(UTC)) - timedelta(days=retention_days)
    return db.execute(delete(AuthAuditEvent).where(AuthAuditEvent.occurred_at < cutoff)).rowcount
