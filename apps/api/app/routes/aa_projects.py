"""Project Analytics read. Authentication only: a read is never behind the write gate."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.analytics.subjects import InvalidSubjectError
from app.db import get_db
from app.dependencies import get_current_user
from app.models import User
from app.routes.aa_history import _bad_request
from app.schemas.aa_projects import ProjectAnalyticsOut
from app.services.aa_project_analytics import project_analytics, project_subject

router = APIRouter(prefix="/api/v1/aa/projects", tags=["adaptive-analytics"])
Auth = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]


@router.get("/{project_id}/analytics", response_model=ProjectAnalyticsOut)
def analytics(project_id: str, user: Auth, db: DB, as_of: datetime | None = None):
    """A project with no facts in this account answers ``no_facts``, exactly as a
    project that only exists in another account does — existence never leaks."""
    now = datetime.now(UTC)
    if as_of is not None and as_of.tzinfo is None:
        return _bad_request("invalid_time", "as_of requires an offset.")
    if as_of is not None and as_of > now:
        return _bad_request("invalid_time", "as_of must not be in the future.")
    try:
        subject = project_subject(project_id)
    except InvalidSubjectError as error:
        return _bad_request("invalid_subject", str(error))
    return project_analytics(db, user_id=user.id, subject=subject, as_of=as_of, now=now)
