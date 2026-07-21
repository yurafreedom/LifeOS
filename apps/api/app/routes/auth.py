from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.schemas.auth import BootstrapRequest, LoginRequest, SessionUser
from app.security.origin import enforce_same_origin, require_json_content_type
from app.security.sessions import clear_session_cookie, set_session_cookie
from app.services.auth import (
    AuthServiceError,
    authenticate_user,
    bootstrap_first_user,
    revoke_session,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _auth_error(error: AuthServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"code": error.code, "message": error.message},
    )


@router.post(
    "/bootstrap",
    response_model=SessionUser,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_json_content_type)],
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
        issued = bootstrap_first_user(db, body, settings)
    except AuthServiceError as error:
        return _auth_error(error)
    set_session_cookie(response, issued.raw_token, settings)
    return issued.user


@router.post(
    "/login",
    response_model=SessionUser,
    dependencies=[Depends(require_json_content_type)],
)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
) -> User | JSONResponse:
    enforce_same_origin(request, settings)
    try:
        issued = authenticate_user(db, body, settings)
    except AuthServiceError as error:
        return _auth_error(error)
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
        revoke_session(db, raw_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookie(response, settings)
    return response


@router.get("/me", response_model=SessionUser)
def me(user: Annotated[User, Depends(get_current_user)]) -> User:
    return user
