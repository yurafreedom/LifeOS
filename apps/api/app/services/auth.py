import hmac
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import User, UserSession
from app.schemas.auth import BootstrapRequest, LoginRequest
from app.security.passwords import hash_password, normalize_email, verify_password_or_dummy
from app.security.sessions import generate_session_token, hash_session_token

_BOOTSTRAP_LOCK_ID = 83_872_935_508_051


class AuthServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class IssuedSession:
    user: User
    raw_token: str
    expires_at: datetime


@dataclass(frozen=True)
class AuthenticatedSession:
    user: User
    session: UserSession


def _new_session(user: User, settings: Settings) -> tuple[UserSession, str]:
    raw_token = generate_session_token()
    now = datetime.now(UTC)
    session = UserSession(
        user_id=user.id,
        token_hash=hash_session_token(raw_token),
        last_seen_at=now,
        expires_at=now + timedelta(seconds=settings.session_ttl_seconds),
    )
    return session, raw_token


def bootstrap_first_user(
    db: Session, request: BootstrapRequest, settings: Settings
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

            user = User(
                email=canonical_email,
                password_hash=hash_password(request.password.get_secret_value()),
            )
            db.add(user)
            db.flush()
            session, raw_token = _new_session(user, settings)
            db.add(session)
            db.flush()
    except IntegrityError as exc:
        raise AuthServiceError("bootstrap_conflict", "Bootstrap account already exists.", 409) from exc

    return IssuedSession(user=user, raw_token=raw_token, expires_at=session.expires_at)


def authenticate_user(db: Session, request: LoginRequest, settings: Settings) -> IssuedSession:
    canonical_email = normalize_email(str(request.email))
    password = request.password.get_secret_value()
    now = datetime.now(UTC)

    with db.begin():
        db.execute(delete(UserSession).where(UserSession.expires_at <= now))
        user = db.scalar(select(User).where(func.lower(User.email) == canonical_email))
        password_hash = user.password_hash if user is not None and user.is_active else None
        if not verify_password_or_dummy(password, password_hash):
            raise AuthServiceError("invalid_credentials", "Email or password is invalid.", 401)
        assert user is not None

        session, raw_token = _new_session(user, settings)
        db.add(session)
        db.flush()

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


def revoke_session(db: Session, raw_token: str) -> None:
    token_hash = hash_session_token(raw_token)
    with db.begin():
        db.execute(delete(UserSession).where(UserSession.token_hash == token_hash))
