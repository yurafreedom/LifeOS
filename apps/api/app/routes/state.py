from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.schemas.state import StateEnvelope, StateReplace
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.state import RevisionConflictError, get_user_snapshot, replace_user_snapshot

router = APIRouter(prefix="/api/v1", tags=["state"])


@router.get("/state", response_model=StateEnvelope)
def get_state(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    snapshot = get_user_snapshot(db, user_id=user.id)
    if snapshot is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"code": "state_not_initialized", "message": "State is not initialized."},
        )
    return snapshot


@router.put(
    "/state",
    response_model=StateEnvelope,
    dependencies=[Depends(require_json_content_type)],
)
def put_state(
    body: StateReplace,
    request: Request,
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        snapshot = replace_user_snapshot(db, user.id, body)
    except RevisionConflictError as error:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "code": "revision_conflict",
                "message": "State revision does not match.",
                "current_revision": error.current_revision,
            },
        )
    if snapshot.revision == 1:
        response.status_code = status.HTTP_201_CREATED
    return snapshot
