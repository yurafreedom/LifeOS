"""Account security routes for the signed-in, account-bound user (JENKIN S1).

Password change, email-verification mail, session list / revocation, the
owner's invitations and the account's own security events. All bound
(``get_bound_session``); every mutating route enforces same-origin + JSON.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_bound_session, get_mail, get_request_settings
from app.mail import MailDelivery, MailDeliveryError, MailUnavailableError
from app.routes.auth import auth_error
from app.schemas.auth import (
    InvitationCreate,
    InvitationCreated,
    InvitationList,
    InvitationOut,
    PasswordChange,
    SecurityEventList,
    SecurityEventOut,
    SessionList,
    SessionOut,
)
from app.security.client_info import client_context
from app.security.origin import enforce_same_origin, require_json_content_type
from app.security.sessions import clear_session_cookie
from app.services import account_access
from app.services.auth import AuthenticatedSession, AuthServiceError

router = APIRouter(prefix="/api/v1/account", tags=["account-security"])
Bound = Annotated[AuthenticatedSession, Depends(get_bound_session)]
JSON_ONLY = [Depends(require_json_content_type)]


@router.post("/password", dependencies=JSON_ONLY)
def change_password(
    body: PasswordChange,
    request: Request,
    bound: Bound,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        revoked = account_access.change_password(
            db, user=bound.user, session=bound.session,
            current_password=body.current_password.get_secret_value(),
            new_password=body.new_password.get_secret_value(),
            client=client_context(request, settings),
        )
    except AuthServiceError as error:
        return auth_error(error)
    return {"status": "changed", "revoked_sessions": revoked}


@router.post("/email-verification", dependencies=JSON_ONLY)
def send_email_verification(
    request: Request,
    bound: Bound,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
    mail: Annotated[MailDelivery, Depends(get_mail)],
):
    """Reports exactly what happened: sent, or why not (signed-in owner of the address)."""
    enforce_same_origin(request, settings)
    try:
        message = account_access.send_email_verification(
            db, user=bound.user, settings=settings, mail=mail,
            client=client_context(request, settings),
        )
        mail.send(message)
    except AuthServiceError as error:
        return auth_error(error)
    except MailUnavailableError:
        return auth_error(AuthServiceError("mail_unavailable", "Email delivery is not configured.", 503))
    except MailDeliveryError:
        return auth_error(AuthServiceError("mail_delivery_failed", "The message could not be sent.", 502))
    return {"status": "sent"}


@router.get("/sessions", response_model=SessionList)
def sessions(bound: Bound, db: Annotated[Session, Depends(get_db)]):
    views = account_access.list_sessions(
        db, user_id=bound.user.id, current_session_id=bound.session.id
    )
    return SessionList(sessions=[SessionOut.model_validate(view) for view in views])


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(
    session_id: UUID,
    request: Request,
    bound: Bound,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        was_current = account_access.revoke_session_by_id(
            db, user_id=bound.user.id, session_id=session_id, actor_session_id=bound.session.id,
            client=client_context(request, settings),
        )
    except AuthServiceError as error:
        return auth_error(error)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    if was_current:
        clear_session_cookie(response, settings)
    return response


@router.post("/sessions/revoke-others", dependencies=JSON_ONLY)
def revoke_other_sessions(
    request: Request,
    bound: Bound,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    revoked = account_access.revoke_other_sessions(
        db, user_id=bound.user.id, current_session_id=bound.session.id,
        client=client_context(request, settings),
    )
    return {"revoked_sessions": revoked}


def _invitation_out(invitation) -> dict:
    return {
        "id": invitation.id,
        "email": invitation.email,
        "created_at": invitation.created_at,
        "expires_at": invitation.expires_at,
        "status": account_access.invitation_status(invitation),
        "delivery": invitation.delivery,
    }


@router.get("/invitations", response_model=InvitationList)
def invitations(bound: Bound, db: Annotated[Session, Depends(get_db)]):
    try:
        rows = account_access.list_invitations(db, owner=bound.user)
    except AuthServiceError as error:
        return auth_error(error)
    return InvitationList(invitations=[InvitationOut(**_invitation_out(row)) for row in rows])


@router.post(
    "/invitations",
    response_model=InvitationCreated,
    status_code=status.HTTP_201_CREATED,
    dependencies=JSON_ONLY,
)
def create_invitation(
    body: InvitationCreate,
    request: Request,
    bound: Bound,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
    mail: Annotated[MailDelivery, Depends(get_mail)],
):
    enforce_same_origin(request, settings)
    try:
        result = account_access.create_invitation(
            db, owner=bound.user, email=str(body.email), settings=settings, mail=mail,
            client=client_context(request, settings),
        )
    except AuthServiceError as error:
        return auth_error(error)
    return InvitationCreated(**_invitation_out(result.invitation), invite_url=result.invite_url)


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(
    invitation_id: UUID,
    request: Request,
    bound: Bound,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        account_access.revoke_invitation(
            db, owner=bound.user, invitation_id=invitation_id,
            client=client_context(request, settings),
        )
    except AuthServiceError as error:
        return auth_error(error)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/security-events", response_model=SecurityEventList)
def security_events(bound: Bound, db: Annotated[Session, Depends(get_db)]):
    rows = account_access.recent_security_events(db, user_id=bound.user.id)
    return SecurityEventList(events=[SecurityEventOut.model_validate(row) for row in rows])
