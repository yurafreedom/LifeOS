import hmac
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import User, UserSession
from app.schemas.auth import BootstrapRequest, LoginRequest
from app.security.client_info import ClientContext
from app.security.passwords import hash_password, normalize_email, verify_password_or_dummy
from app.security.sessions import generate_session_token, hash_session_token
from app.services import security_audit, throttle

_BOOTSTRAP_LOCK_ID = 83_872_935_508_051


class AuthServiceError(Exception):
    def __init__(
        self, code: str, message: str, status_code: int, *, retry_after: int | None = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retry_after = retry_after


@dataclass(frozen=True)
class IssuedSession:
    user: User
    raw_token: str
    expires_at: datetime


@dataclass(frozen=True)
class AuthenticatedSession:
    user: User
    session: UserSession


def new_session(
    user: User, settings: Settings, client: ClientContext | None = None
) -> tuple[UserSession, str]:
    raw_token = generate_session_token()
    now = datetime.now(UTC)
    session = UserSession(
        user_id=user.id,
        token_hash=hash_session_token(raw_token),
        last_seen_at=now,
        expires_at=now + timedelta(seconds=settings.session_ttl_seconds),
        device_label=client.device_label if client else None,
    )
    return session, raw_token


def _purge_expired_records(db: Session, settings: Settings, now: datetime) -> None:
    """Opportunistic housekeeping on login: sessions, throttles, old audit events."""
    db.execute(delete(UserSession).where(UserSession.expires_at <= now))
    throttle.purge_stale(db, now=now)
    security_audit.purge_expired(db, retention_days=settings.audit_retention_days, now=now)


def bootstrap_first_user(
    db: Session, request: BootstrapRequest, settings: Settings, client: ClientContext | None = None
) -> IssuedSession:
    expected_token = settings.bootstrap_token.get_secret_value()
    if not hmac.compare_digest(request.bootstrap_token.get_secret_value(), expected_token):
        raise AuthServiceError("bootstrap_forbidden", "Bootstrap token is invalid.", 403)

    canonical_email = normalize_email(str(request.email))
    try:
        with db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": _BOOTSTRAP_LOCK_ID})
            if db.scalar(select(User.id).limit(1)) is not None:
                raise AuthServiceError("bootstrap_closed", "Bootstrap is no longer available.", 409)

            # The first account is the owner: the only role that may invite.
            user = User(
                email=canonical_email,
                password_hash=hash_password(request.password.get_secret_value()),
                role="owner",
            )
            db.add(user)
            db.flush()
            session, raw_token = new_session(user, settings, client)
            db.add(session)
            db.flush()
            security_audit.record(
                db, "account_bootstrapped", user_id=user.id, session_id=session.id, client=client
            )
    except IntegrityError as exc:
        raise AuthServiceError("bootstrap_conflict", "Bootstrap account already exists.", 409) from exc

    return IssuedSession(user=user, raw_token=raw_token, expires_at=session.expires_at)


def authenticate_user(
    db: Session, request: LoginRequest, settings: Settings, client: ClientContext | None = None
) -> IssuedSession:
    """Password login with per-address and per-network throttling.

    The same generic error answers an unknown address, an inactive account and
    a wrong password; a throttled address is throttled whether or not it has
    an account, so neither the message nor the lockout reveals existence.
    """
    canonical_email = normalize_email(str(request.email))
    password = request.password.get_secret_value()
    address = client.address if client else None
    now = datetime.now(UTC)

    try:
        throttle.check(db, "login_network", address, now=now)
        throttle.check(db, "login_email", canonical_email, now=now)
    except throttle.ThrottledError as error:
        db.rollback()
        raise AuthServiceError(
            "too_many_attempts", "Too many attempts. Try again later.", 429,
            retry_after=error.retry_after_seconds,
        ) from None
    db.rollback()  # the checks only read; the login runs in its own transaction

    failure: AuthServiceError | None = None
    with db.begin():
        _purge_expired_records(db, settings, now)
        user = db.scalar(select(User).where(func.lower(User.email) == canonical_email))
        password_hash = user.password_hash if user is not None and user.is_active else None
        if not verify_password_or_dummy(password, password_hash):
            locked = throttle.register_failure(db, "login_email", canonical_email, now=now)
            locked = throttle.register_failure(db, "login_network", address, now=now) or locked
            known = user.id if user is not None else None
            security_audit.record(db, "login_failed", user_id=known, client=client)
            if locked:
                security_audit.record(db, "login_throttled", user_id=known, client=client)
            failure = AuthServiceError("invalid_credentials", "Email or password is invalid.", 401)
        else:
            assert user is not None
            throttle.clear(db, "login_email", canonical_email)
            session, raw_token = new_session(user, settings, client)
            db.add(session)
            db.flush()
            security_audit.record(
                db, "login_succeeded", user_id=user.id, session_id=session.id, client=client
            )
    if failure is not None:
        raise failure
    return IssuedSession(user=user, raw_token=raw_token, expires_at=session.expires_at)


def resolve_session(
    db: Session, raw_token: str, settings: Settings, *, touch: bool = True
) -> AuthenticatedSession | None:
    now = datetime.now(UTC)
    token_hash = hash_session_token(raw_token)
    result = db.execute(
        select(UserSession, User)
        .join(User, User.id == UserSession.user_id)
        .where(UserSession.token_hash == token_hash)
    ).one_or_none()

    if result is None:
        db.rollback()
        return None

    session, user = result
    if session.expires_at <= now or not user.is_active:
        db.delete(session)
        db.commit()
        return None

    touch_before = now - timedelta(seconds=settings.session_touch_interval_seconds)
    if touch and session.last_seen_at <= touch_before:
        session.last_seen_at = now
    db.commit()
    return AuthenticatedSession(user=user, session=session)


def revoke_session(db: Session, raw_token: str, client: ClientContext | None = None) -> None:
    token_hash = hash_session_token(raw_token)
    db.rollback()
    with db.begin():
        session = db.scalar(select(UserSession).where(UserSession.token_hash == token_hash))
        if session is not None:
            db.delete(session)
            security_audit.record(
                db, "logout", user_id=session.user_id, session_id=session.id, client=client
            )
