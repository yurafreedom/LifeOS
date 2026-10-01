"""Authentication routes.

Anonymous by design (no account binding): bootstrap, login, password-reset
request/confirm, email-verification confirm, invitation inspect/accept.
``/me`` is unbound identity discovery; logout honours an optional binding.
Every mutating route enforces same-origin and a JSON content type — SameSite
cookies alone are not treated as CSRF protection.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import (
    check_account_binding,
    get_current_session,
    get_mail,
    get_request_settings,
)
from app.mail import MailDelivery, MailMessage
from app.models import User
from app.schemas.auth import (
    BootstrapRequest,
    InvitationAccept,
    InvitationPreview,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    SessionUser,
    TokenOnly,
)
from app.security.client_info import client_context
from app.security.origin import enforce_same_origin, require_json_content_type
from app.security.sessions import clear_session_cookie, set_session_cookie
from app.services import account_access, security_audit
from app.services.auth import (
    AuthenticatedSession,
    AuthServiceError,
    authenticate_user,
    bootstrap_first_user,
    resolve_session,
    revoke_session,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
JSON_ONLY = [Depends(require_json_content_type)]


def auth_error(error: AuthServiceError) -> JSONResponse:
    headers = {"Retry-After": str(error.retry_after)} if error.retry_after else None
    return JSONResponse(
        status_code=error.status_code,
        content={"code": error.code, "message": error.message},
        headers=headers,
    )


@router.post(
    "/bootstrap",
    response_model=SessionUser,
    status_code=status.HTTP_201_CREATED,
    dependencies=JSON_ONLY,
)
def bootstrap(
    body: BootstrapRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
) -> User | JSONResponse:
    enforce_same_origin(request, settings)
    try:
        issued = bootstrap_first_user(db, body, settings, client_context(request, settings))
    except AuthServiceError as error:
        return auth_error(error)
    set_session_cookie(response, issued.raw_token, settings)
    return issued.user


@router.post("/login", response_model=SessionUser, dependencies=JSON_ONLY)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
) -> User | JSONResponse:
    enforce_same_origin(request, settings)
    try:
        issued = authenticate_user(db, body, settings, client_context(request, settings))
    except AuthServiceError as error:
        return auth_error(error)
    set_session_cookie(response, issued.raw_token, settings)
    return issued.user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
) -> Response:
    enforce_same_origin(request, settings)
    raw_token = request.cookies.get(settings.cookie_name)
    if raw_token:
        # A stale tab that still believes it is account A must not sign out the
        # account B that another tab signed in: an explicit binding must match.
        authenticated = resolve_session(db, raw_token, settings, touch=False)
        if authenticated is not None:
            check_account_binding(request, authenticated, required=False)
        revoke_session(db, raw_token, client_context(request, settings))
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookie(response, settings)
    return response


@router.get("/me", response_model=SessionUser)
def me(authenticated: Annotated[AuthenticatedSession, Depends(get_current_session)]) -> User:
    """Identity discovery: deliberately unbound, so a tab can learn who is signed in."""
    return authenticated.user


# ── password recovery ──────────────────────────────────────────────────────


def _deliver_reset(factory, mail: MailDelivery, message: MailMessage, user_id) -> None:
    """After the response: send, and record a failed delivery (never the link)."""
    try:
        mail.send(message)
    except Exception:  # noqa: BLE001 - any adapter failure is "not delivered"
        logger.warning("auth.password_reset_delivery_failed")
        with factory.begin() as db:
            security_audit.record(db, "password_reset_delivery_failed", user_id=user_id)


@router.post(
    "/password-reset/request", status_code=status.HTTP_202_ACCEPTED, dependencies=JSON_ONLY
)
def password_reset_request(
    body: PasswordResetRequest,
    request: Request,
    background: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
    mail: Annotated[MailDelivery, Depends(get_mail)],
):
    """Same 202 for every address. 503 only when this server cannot send mail at all."""
    enforce_same_origin(request, settings)
    try:
        outgoing = account_access.request_password_reset(
            db, email=str(body.email), settings=settings, mail=mail,
            client=client_context(request, settings),
        )
    except AuthServiceError as error:
        return auth_error(error)
    if outgoing is not None:
        message, user_id = outgoing
        background.add_task(_deliver_reset, request.app.state.session_factory, mail, message, user_id)
    return {"status": "accepted"}


@router.post(
    "/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT, dependencies=JSON_ONLY
)
def password_reset_confirm(
    body: PasswordResetConfirm,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        account_access.confirm_password_reset(
            db, raw_token=body.token.get_secret_value(),
            new_password=body.new_password.get_secret_value(),
            client=client_context(request, settings),
        )
    except AuthServiceError as error:
        return auth_error(error)
    # Every session of the account was revoked, this browser's included.
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookie(response, settings)
    return response


# ── email verification (link may be opened in any browser) ────────────────


@router.post(
    "/email-verification/confirm", status_code=status.HTTP_204_NO_CONTENT, dependencies=JSON_ONLY
)
def email_verification_confirm(
    body: TokenOnly,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        account_access.confirm_email_verification(
            db, raw_token=body.token.get_secret_value(), client=client_context(request, settings)
        )
    except AuthServiceError as error:
        return auth_error(error)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── invitations (anonymous invitee) ────────────────────────────────────────


@router.post("/invitations/inspect", response_model=InvitationPreview, dependencies=JSON_ONLY)
def invitation_inspect(
    body: TokenOnly,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        email, expires_at = account_access.inspect_invitation(
            db, raw_token=body.token.get_secret_value(), client=client_context(request, settings)
        )
    except AuthServiceError as error:
        return auth_error(error)
    return InvitationPreview(email=email, expires_at=expires_at)


@router.post(
    "/invitations/accept",
    response_model=SessionUser,
    status_code=status.HTTP_201_CREATED,
    dependencies=JSON_ONLY,
)
def invitation_accept(
    body: InvitationAccept,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        issued = account_access.accept_invitation(
            db, raw_token=body.token.get_secret_value(), email=str(body.email),
            password=body.password.get_secret_value(), settings=settings,
            client=client_context(request, settings),
        )
    except AuthServiceError as error:
        return auth_error(error)
    set_session_cookie(response, issued.raw_token, settings)
    return issued.user
