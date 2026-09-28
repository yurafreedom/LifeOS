"""Explicit authenticated legacy transaction import."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.schemas.aa_finance import LegacyImportCreate, LegacyImportOut
from app.security.aa_gate import require_aa_write_enabled
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.aa_legacy_import import import_legacy_transactions

router = APIRouter(
    prefix="/api/v1/aa",
    tags=["adaptive-analytics"],
    dependencies=[Depends(require_json_content_type), Depends(require_aa_write_enabled)],
)


@router.post("/import/legacy-transactions", response_model=LegacyImportOut)
def legacy_transactions(
    body: LegacyImportCreate,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        return import_legacy_transactions(db, user_id=user.id, request=body)
    except ValueError as error:
        return JSONResponse(
            status_code=422,
            content={"code": "invalid_legacy_snapshot", "message": str(error)},
        )
