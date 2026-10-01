"""Shared request dependencies.

Account binding (JENKIN S1): the browser tab that loaded account A must never
read, write, import or export as account B merely because another tab signed in
as B and replaced the shared session cookie. Every authenticated data route
therefore requires the client's *expected* account id in ``X-LifeOS-Account``
and compares it with the account the session cookie resolves to.

The header is never an authorization credential: ownership always comes from
the server-side session. It only lets the server refuse a request whose sender
believes it is acting for a different account than the one actually signed in.

Contract (pinned by ``tests/test_account_binding.py``):
- no valid session                       → 401 ``not_authenticated``
- protected route without the header     → 428 ``account_binding_required``
- header present but a different account → 409 ``session_user_mismatch``
These run as dependencies, before the route body reads or writes anything.

Identity discovery (``GET /auth/me``) and the anonymous auth flows are unbound
on purpose; logout accepts an optional binding (see ``routes/auth.py``).
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.mail import MailDelivery
from app.models import User
from app.services.auth import AuthenticatedSession, resolve_session

ACCOUNT_HEADER = "X-LifeOS-Account"


def get_request_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_mail(request: Request) -> MailDelivery:
    return request.app.state.mail


def get_current_session(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
) -> AuthenticatedSession:
    """The authenticated session, without any account binding (identity discovery)."""
    raw_token = request.cookies.get(settings.cookie_name)
    authenticated = (
        resolve_session(db, raw_token, settings) if raw_token else None
    )
    if authenticated is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": "Authentication is required."},
        )
    return authenticated


def account_mismatch() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "session_user_mismatch",
            "message": "The signed-in account is not the account this request was made for.",
        },
    )


def check_account_binding(
    request: Request, authenticated: AuthenticatedSession, *, required: bool
) -> None:
    expected = request.headers.get(ACCOUNT_HEADER)
    if expected is None or not expected.strip():
        if required:
            raise HTTPException(
                status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                detail={
                    "code": "account_binding_required",
                    "message": f"{ACCOUNT_HEADER} must name the expected account.",
                },
            )
        return
    if expected.strip().casefold() != str(authenticated.user.id):
        raise account_mismatch()


def get_bound_session(
    request: Request,
    authenticated: Annotated[AuthenticatedSession, Depends(get_current_session)],
) -> AuthenticatedSession:
    """The authenticated session, refused unless the client names that same account."""
    check_account_binding(request, authenticated, required=True)
    return authenticated


def get_current_user(
    authenticated: Annotated[AuthenticatedSession, Depends(get_bound_session)],
) -> User:
    """The bound account. Every protected data route depends on this."""
    return authenticated.user
