"""Subject reads require authentication but not the collection gate."""

from dataclasses import asdict
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.analytics.subjects import InvalidSubjectError, parse_subject_key
from app.db import get_db
from app.dependencies import get_current_user
from app.models import User
from app.routes.aa_history import _bad_request, _not_found
from app.schemas.aa_common import validate_timezone
from app.schemas.aa_measurement import CoverageReportOut
from app.schemas.aa_subjects import SubjectSummaryOut
from app.services.aa_coverage_claims import coverage_report_for_window
from app.services.aa_facts import FactNotFoundError
from app.services.aa_subjects import require_subject, subject_summary

router = APIRouter(prefix="/api/v1/aa/subjects", tags=["adaptive-analytics"])
Auth = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]


@router.get("/{key}/summary", response_model=SubjectSummaryOut)
def summary(
    key: str, user: Auth, db: DB, as_of: datetime | None = None, metric_key: str | None = None
):
    if as_of is not None and as_of.tzinfo is None:
        return _bad_request("invalid_time", "as_of requires an offset.")
    try:
        subject = parse_subject_key(key)
        result = subject_summary(
            db, user_id=user.id, subject_key=subject.subject_key, as_of=as_of, metric_key=metric_key
        )
        return SubjectSummaryOut.model_validate(result)
    except InvalidSubjectError as error:
        return _bad_request("invalid_subject", str(error))
    except FactNotFoundError:
        return _not_found()


@router.get("/{key}/coverage", response_model=CoverageReportOut)
def coverage(
    key: str,
    user: Auth,
    db: DB,
    range_from: Annotated[date | None, Query(alias="from")] = None,
    range_to: Annotated[date | None, Query(alias="to")] = None,
    timezone: str = "UTC",
    as_of: datetime | None = None,
):
    if range_from is None or range_to is None or range_to < range_from:
        return _bad_request("range_required", "An ordered from/to range is required.")
    if (range_to - range_from).days > 3660 or range_to == date.max:
        return _bad_request("range_too_large", "Coverage range must not exceed 3661 days.")
    if as_of is not None and as_of.tzinfo is None:
        return _bad_request("invalid_time", "as_of requires an offset.")
    try:
        subject = parse_subject_key(key)
        validate_timezone(timezone)
        require_subject(db, user_id=user.id, subject_key=subject.subject_key)
        result = coverage_report_for_window(
            db,
            user_id=user.id,
            subject_key=subject.subject_key,
            window_start=range_from,
            window_end=range_to,
            timezone=timezone,
            now=as_of or datetime.now(UTC),
            as_of=as_of,
        )
        return CoverageReportOut(
            **{
                **asdict(result),
                "window_start": result.window_start.isoformat(),
                "window_end": result.window_end.isoformat(),
            }
        )
    except (InvalidSubjectError, ValueError) as error:
        return _bad_request("invalid_subject_or_timezone", str(error))
    except FactNotFoundError:
        return _not_found()
