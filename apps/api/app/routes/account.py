from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.security.origin import enforce_same_origin, require_json_content_type
from app.security.sessions import clear_session_cookie
from app.services.account import delete_account

router = APIRouter(prefix="/api/v1", tags=["account"])


class AccountDeleteConfirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmation: Literal["DELETE_ACCOUNT"]


@router.delete("/account", dependencies=[Depends(require_json_content_type)])
def erase_account(
    body: AccountDeleteConfirmation,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    delete_account(db, user_id=user.id)
    response = Response(status_code=204, headers={"Cache-Control": "no-store"})
    clear_session_cookie(response, settings)
    return response
