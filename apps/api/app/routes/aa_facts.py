"""Privacy routes remain available even when AA recording is disabled."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.security.origin import enforce_same_origin
from app.services.aa_deletion import delete_fact
from app.services.aa_facts import AAServiceError

router = APIRouter(prefix="/api/v1/aa/facts", tags=["adaptive-analytics"])


@router.delete("/{table}/{fact_id}")
def erase_fact(
    table: str,
    fact_id: UUID,
    mode: Literal["tombstone", "hard"],
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        result = delete_fact(db, user_id=user.id, table_name=table, fact_id=fact_id, mode=mode)
    except AAServiceError as error:
        return JSONResponse(
            status_code=404 if error.code == "fact_not_found" else 409,
            content={"code": error.code, "message": error.message},
            headers={"Cache-Control": "no-store"},
        )
    return JSONResponse(content=result, headers={"Cache-Control": "no-store"})
