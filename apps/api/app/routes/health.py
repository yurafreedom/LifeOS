import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


@router.get("/api/healthz", response_model=None)
def health(db: Annotated[Session, Depends(get_db)]) -> dict[str, str] | JSONResponse:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Database health check failed")
        return JSONResponse(status_code=503, content={"code": "database_unavailable"})
    return {"status": "ok"}
