"""Private account access (JENKIN S1 checkpoint 4).

Owner-issued invitations, password change / recovery, email verification and
session management. Shared rules:

- Single-use secrets (reset, verification, invitation) are 32 random bytes,
  delivered only inside a link; the database keeps their SHA-256 digest.
- Every token check is constant-shape: unknown, expired, consumed and
  mismatched tokens all fail with the same code, and failures are throttled
  per client network.
- Password recovery answers identically whether or not the address has an
  account; the mail itself is sent after the response (``BackgroundTasks``),
  so neither the body nor the timing reveals existence. When no mail delivery
  is configured at all, recovery says so for every address alike.
- Password change keeps the current session and revokes the others; a reset
  revokes every session.
- Audit events record what happened, never a secret.
"""

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.mail import MailDelivery, MailMessage, templates
from app.models import AccountInvitation, AuthAuditEvent, AuthToken, User, UserSession
from app.security.client_info import ClientContext
from app.security.passwords import hash_password, normalize_email, verify_password
from app.security.sessions import hash_session_token
from app.services import security_audit, throttle
from app.services.auth import AuthServiceError, IssuedSession, new_session

INVALID_TOKEN = ("invalid_or_expired_token", "This link is invalid or has expired.")
INVALID_INVITATION = ("invalid_or_expired_invitation", "This invitation is invalid or has expired.")


def _throttled(error: throttle.ThrottledError) -> AuthServiceError:
    return AuthServiceError(
        "too_many_attempts",
        "Too many attempts. Try again later.",
        429,
        retry_after=error.retry_after_seconds,
    )


def _new_secret() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, hash_session_token(raw)


def _link(settings: Settings, action: str, raw: str) -> str:
    # Fragment, not query: the token never reaches a server log or Referer.
    return f"{settings.app_url}/#/auth/{action}/{raw}"


def _token_failure(db: Session, client: ClientContext) -> AuthServiceError:
    throttle.register_failure(db, "token_network", client.address)
    db.commit()
    return AuthServiceError(*INVALID_TOKEN, 400)


def _require_mail(mail: MailDelivery) -> None:
    if not mail.available:
        raise AuthServiceError(
            "mail_unavailable", "Email delivery is not configured on this server.", 503
        )


# ── password change ────────────────────────────────────────────────────────


def change_password(
    db: Session,
    *,
    user: User,
    session: UserSession,
    current_password: str,
    new_password: str,
    client: ClientContext,
) -> int:
    """Verify the current password, set the new one, revoke the other sessions."""
    user_key = str(user.id)
    try:
        throttle.check(db, "password_change_user", user_key)
    except throttle.ThrottledError as error:
        db.rollback()
        raise _throttled(error) from None
    if not verify_password(current_password, user.password_hash):
        throttle.register_failure(db, "password_change_user", user_key)
        security_audit.record(
            db, "password_change_failed", user_id=user.id, session_id=session.id, client=client
        )
        db.commit()
        raise AuthServiceError("invalid_current_password", "The current password is incorrect.", 400)
    now = datetime.now(UTC)
    locked = db.get(User, user.id, with_for_update=True)
    assert locked is not None
    locked.password_hash = hash_password(new_password)
    locked.password_changed_at = now
    revoked = db.execute(
        delete(UserSession).where(UserSession.user_id == user.id, UserSession.id != session.id)
    ).rowcount
    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == "password_reset",
            AuthToken.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )
    throttle.clear(db, "password_change_user", user_key)
    security_audit.record(
        db, "password_changed", user_id=user.id, session_id=session.id, client=client,
        details={"revoked_sessions": revoked},
    )
    db.commit()
    return revoked


# ── password recovery ──────────────────────────────────────────────────────


def request_password_reset(
    db: Session, *, email: str, settings: Settings, mail: MailDelivery, client: ClientContext
) -> tuple[MailMessage, UUID] | None:
    """Return the message to send after the response, or None. Same answer for every address."""
    _require_mail(mail)
    try:
        throttle.check(db, "reset_network", client.address)
    except throttle.ThrottledError as error:
        db.rollback()
        raise _throttled(error) from None
    throttle.register_failure(db, "reset_network", client.address)
    canonical = normalize_email(email)
    try:
        throttle.check(db, "reset_email", canonical)
    except throttle.ThrottledError:
        # Quietly send nothing more to this address; the answer stays generic.
        db.commit()
        return None
    throttle.register_failure(db, "reset_email", canonical)
    user = db.scalar(select(User).where(func.lower(User.email) == canonical))
    if user is None or not user.is_active:
        db.commit()
        return None
    now = datetime.now(UTC)
    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == "password_reset",
            AuthToken.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )
    raw, digest = _new_secret()
    db.add(
        AuthToken(
            user_id=user.id, purpose="password_reset", token_hash=digest, email=user.email,
            expires_at=now + timedelta(seconds=settings.password_reset_ttl_seconds),
        )
    )
    security_audit.record(db, "password_reset_requested", user_id=user.id, client=client)
    db.commit()
    message = templates.password_reset(
        user.email, _link(settings, "reset", raw), settings.password_reset_ttl_seconds // 60
    )
    return message, user.id


def confirm_password_reset(
    db: Session, *, raw_token: str, new_password: str, client: ClientContext
) -> int:
    try:
        throttle.check(db, "token_network", client.address)
    except throttle.ThrottledError as error:
        db.rollback()
        raise _throttled(error) from None
    now = datetime.now(UTC)
    token = db.execute(
        select(AuthToken)
        .where(AuthToken.token_hash == hash_session_token(raw_token))
        .with_for_update()
    ).scalar_one_or_none()
    user = db.get(User, token.user_id, with_for_update=True) if token is not None else None
    if (
        token is None
        or user is None
        or token.purpose != "password_reset"
        or token.consumed_at is not None
        or token.expires_at <= now
        or not user.is_active
        or normalize_email(token.email) != normalize_email(user.email)
    ):
        raise _token_failure(db, client)
    user.password_hash = hash_password(new_password)
    user.password_changed_at = now
    if user.email_verified_at is None:
        # Opening the link proved control of this mailbox.
        user.email_verified_at = now
    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == "password_reset",
            AuthToken.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )
    revoked = db.execute(delete(UserSession).where(UserSession.user_id == user.id)).rowcount
    throttle.clear(db, "login_email", normalize_email(user.email))
    security_audit.record(
        db, "password_reset_completed", user_id=user.id, client=client,
        details={"revoked_sessions": revoked},
    )
    db.commit()
    return revoked


# ── email verification ─────────────────────────────────────────────────────


def send_email_verification(
    db: Session, *, user: User, settings: Settings, mail: MailDelivery, client: ClientContext
) -> MailMessage:
    _require_mail(mail)
    if user.email_verified_at is not None:
        raise AuthServiceError("already_verified", "This email address is already verified.", 409)
    user_key = str(user.id)
    try:
        throttle.check(db, "verify_send_user", user_key)
    except throttle.ThrottledError as error:
        db.rollback()
        raise _throttled(error) from None
    throttle.register_failure(db, "verify_send_user", user_key)
    now = datetime.now(UTC)
    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == "email_verification",
            AuthToken.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )
    raw, digest = _new_secret()
    db.add(
        AuthToken(
            user_id=user.id, purpose="email_verification", token_hash=digest, email=user.email,
            expires_at=now + timedelta(seconds=settings.email_verification_ttl_seconds),
        )
    )
    security_audit.record(db, "email_verification_sent", user_id=user.id, client=client)
    db.commit()
    return templates.email_verification(
        user.email, _link(settings, "verify", raw), settings.email_verification_ttl_seconds // 3600
    )


def confirm_email_verification(db: Session, *, raw_token: str, client: ClientContext) -> None:
    try:
        throttle.check(db, "token_network", client.address)
    except throttle.ThrottledError as error:
        db.rollback()
        raise _throttled(error) from None
    now = datetime.now(UTC)
    token = db.execute(
        select(AuthToken)
        .where(AuthToken.token_hash == hash_session_token(raw_token))
        .with_for_update()
    ).scalar_one_or_none()
    user = db.get(User, token.user_id, with_for_update=True) if token is not None else None
    if (
        token is None
        or user is None
        or token.purpose != "email_verification"
        or token.consumed_at is not None
        or token.expires_at <= now
        or not user.is_active
        or normalize_email(token.email) != normalize_email(user.email)
    ):
        raise _token_failure(db, client)
    token.consumed_at = now
    if user.email_verified_at is None:
        user.email_verified_at = now
    security_audit.record(db, "email_verified", user_id=user.id, client=client)
    db.commit()


# ── sessions ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class SessionView:
    id: UUID
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    device: str | None
    current: bool


def list_sessions(db: Session, *, user_id: UUID, current_session_id: UUID) -> list[SessionView]:
    now = datetime.now(UTC)
    rows = db.scalars(
        select(UserSession)
        .where(UserSession.user_id == user_id, UserSession.expires_at > now)
        .order_by(UserSession.last_seen_at.desc())
    ).all()
    db.rollback()
    return [
        SessionView(
            id=row.id, created_at=row.created_at, last_seen_at=row.last_seen_at,
            expires_at=row.expires_at, device=row.device_label, current=row.id == current_session_id,
        )
        for row in rows
    ]


def revoke_session_by_id(
    db: Session, *, user_id: UUID, session_id: UUID, actor_session_id: UUID, client: ClientContext
) -> bool:
    """Revoke one of the account's own sessions. Another account's id is simply not found."""
    removed = db.execute(
        delete(UserSession).where(UserSession.id == session_id, UserSession.user_id == user_id)
    ).rowcount
    if not removed:
        db.rollback()
        raise AuthServiceError("session_not_found", "Session not found.", 404)
    security_audit.record(
        db, "session_revoked", user_id=user_id, session_id=actor_session_id, client=client,
        details={"current": session_id == actor_session_id},
    )
    db.commit()
    return session_id == actor_session_id


def revoke_other_sessions(
    db: Session, *, user_id: UUID, current_session_id: UUID, client: ClientContext
) -> int:
    removed = db.execute(
        delete(UserSession).where(
            UserSession.user_id == user_id, UserSession.id != current_session_id
        )
    ).rowcount
    security_audit.record(
        db, "sessions_revoked_others", user_id=user_id, session_id=current_session_id,
        client=client, details={"revoked_sessions": removed},
    )
    db.commit()
    return removed


# ── invitations ────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class InvitationResult:
    invitation: AccountInvitation
    # Present only when the link did not go out by mail (manual or failed
    # delivery): shown to the owner once, never stored or logged.
    invite_url: str | None


def invitation_status(invitation: AccountInvitation, now: datetime | None = None) -> str:
    current = now or datetime.now(UTC)
    if invitation.accepted_at is not None:
        return "accepted"
    if invitation.revoked_at is not None:
        return "revoked"
    if invitation.expires_at <= current:
        return "expired"
    return "pending"


def invitation_verifies_email(invitation: AccountInvitation) -> bool:
    """Invitation authorization is not email verification.

    Policy: only an invitation whose link was handed to the mail adapter for
    that address and never shown to anyone else (delivery ``sent``) proves
    control of the mailbox — the same standard as a verification link. A link
    delivered manually, exposed after a failed delivery, or still ``pending``
    proves only that its holder was invited: the new member starts
    **unverified** and verifies through the independent email-verification flow.
    """
    return invitation.delivery == "sent"


def _require_owner(user: User) -> None:
    if user.role != "owner":
        raise AuthServiceError("owner_required", "Only the owner can manage invitations.", 403)


def create_invitation(
    db: Session,
    *,
    owner: User,
    email: str,
    settings: Settings,
    mail: MailDelivery,
    client: ClientContext,
) -> InvitationResult:
    _require_owner(owner)
    owner_key = str(owner.id)
    try:
        throttle.check(db, "invite_user", owner_key)
    except throttle.ThrottledError as error:
        db.rollback()
        raise _throttled(error) from None
    throttle.register_failure(db, "invite_user", owner_key)
    canonical = normalize_email(email)
    if db.scalar(select(User.id).where(func.lower(User.email) == canonical)) is not None:
        db.commit()
        raise AuthServiceError(
            "email_already_registered", "An account with this email already exists.", 409
        )
    now = datetime.now(UTC)
    db.execute(
        update(AccountInvitation)
        .where(
            func.lower(AccountInvitation.email) == canonical,
            AccountInvitation.accepted_at.is_(None),
            AccountInvitation.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    raw, digest = _new_secret()
    link = _link(settings, "invite", raw)
    invitation = AccountInvitation(
        email=canonical, invited_by=owner.id, token_hash=digest, delivery="manual",
        expires_at=now + timedelta(seconds=settings.invitation_ttl_seconds),
    )
    db.add(invitation)
    db.flush()
    invite_url: str | None = link
    if mail.available:
        try:
            mail.send(templates.invitation(
                canonical, link, settings.invitation_ttl_seconds // 86400
            ))
            invitation.delivery = "sent"
            invite_url = None
        except Exception:  # noqa: BLE001 - any adapter failure means "not sent"
            invitation.delivery = "failed"
    security_audit.record(
        db, "invitation_created", user_id=owner.id, client=client,
        details={"delivery": invitation.delivery, "invitation_id": str(invitation.id)},
    )
    db.commit()
    return InvitationResult(invitation=invitation, invite_url=invite_url)


def list_invitations(db: Session, *, owner: User) -> list[AccountInvitation]:
    _require_owner(owner)
    rows = db.scalars(
        select(AccountInvitation)
        .where(AccountInvitation.invited_by == owner.id)
        .order_by(AccountInvitation.created_at.desc())
        .limit(100)
    ).all()
    db.rollback()
    return list(rows)


def revoke_invitation(
    db: Session, *, owner: User, invitation_id: UUID, client: ClientContext
) -> None:
    _require_owner(owner)
    invitation = db.execute(
        select(AccountInvitation)
        .where(AccountInvitation.id == invitation_id, AccountInvitation.invited_by == owner.id)
        .with_for_update()
    ).scalar_one_or_none()
    if invitation is None:
        db.rollback()
        raise AuthServiceError("invitation_not_found", "Invitation not found.", 404)
    if invitation_status(invitation) != "pending":
        db.rollback()
        raise AuthServiceError("invitation_not_pending", "This invitation is no longer pending.", 409)
    invitation.revoked_at = datetime.now(UTC)
    security_audit.record(
        db, "invitation_revoked", user_id=owner.id, client=client,
        details={"invitation_id": str(invitation.id)},
    )
    db.commit()


def _open_invitation(db: Session, raw_token: str, client: ClientContext) -> AccountInvitation:
    try:
        throttle.check(db, "token_network", client.address)
    except throttle.ThrottledError as error:
        db.rollback()
        raise _throttled(error) from None
    invitation = db.execute(
        select(AccountInvitation)
        .where(AccountInvitation.token_hash == hash_session_token(raw_token))
        .with_for_update()
    ).scalar_one_or_none()
    if invitation is None or invitation_status(invitation) != "pending":
        throttle.register_failure(db, "token_network", client.address)
        db.commit()
        raise AuthServiceError(*INVALID_INVITATION, 400)
    return invitation


def inspect_invitation(
    db: Session, *, raw_token: str, client: ClientContext
) -> tuple[str, datetime]:
    invitation = _open_invitation(db, raw_token, client)
    email, expires_at = invitation.email, invitation.expires_at
    db.rollback()
    return email, expires_at


def accept_invitation(
    db: Session,
    *,
    raw_token: str,
    email: str,
    password: str,
    settings: Settings,
    client: ClientContext,
) -> IssuedSession:
    invitation = _open_invitation(db, raw_token, client)
    canonical = normalize_email(email)
    if canonical != normalize_email(invitation.email):
        db.rollback()
        raise AuthServiceError(
            "invitation_email_mismatch", "This invitation was issued for another address.", 400
        )
    if db.scalar(select(User.id).where(func.lower(User.email) == canonical)) is not None:
        db.rollback()
        raise AuthServiceError(
            "email_already_registered", "An account with this email already exists.", 409
        )
    now = datetime.now(UTC)
    user = User(
        email=canonical, password_hash=hash_password(password), role="member",
        email_verified_at=now if invitation_verifies_email(invitation) else None,
        password_changed_at=now,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AuthServiceError(
            "email_already_registered", "An account with this email already exists.", 409
        ) from None
    invitation.accepted_at = now
    invitation.accepted_user_id = user.id
    session, raw_session = new_session(user, settings, client)
    db.add(session)
    db.flush()
    security_audit.record(
        db, "invitation_accepted", user_id=user.id, session_id=session.id, client=client,
        details={"invitation_id": str(invitation.id)},
    )
    security_audit.record(
        db, "invitation_accepted", user_id=invitation.invited_by, client=None,
        details={"invitation_id": str(invitation.id)},
    )
    db.commit()
    return IssuedSession(user=user, raw_token=raw_session, expires_at=session.expires_at)


# ── security events ────────────────────────────────────────────────────────


def recent_security_events(db: Session, *, user_id: UUID, limit: int = 50) -> list[AuthAuditEvent]:
    rows = db.scalars(
        select(AuthAuditEvent)
        .where(AuthAuditEvent.user_id == user_id)
        .order_by(AuthAuditEvent.occurred_at.desc(), AuthAuditEvent.id.desc())
        .limit(limit)
    ).all()
    db.rollback()
    return list(rows)
