from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.models import User
from app.services.auth import AuthenticatedSession, resolve_session


def get_request_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_current_session(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
) -> AuthenticatedSession:
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


def get_current_user(
    authenticated: Annotated[AuthenticatedSession, Depends(get_current_session)],
) -> User:
    return authenticated.user
