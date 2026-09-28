"""Review / Debrief endpoints.

Reads need a session. Writes additionally need the AA write gate, a JSON body
(checked as a route dependency, so a wrong ``Content-Type`` is 415 before the
body is parsed, never a parser 422) and a same-origin request. Ownership comes
from the session only: a Review that is not this account's is simply not found.
"""

from datetime import UTC, date, datetime
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from app.analytics.subjects import (
    InvalidSubjectError,
    UnknownSubjectError,
    parse_subject_key,
    validate_subject,
)
from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.routes.aa_measurements import _error_response
from app.schemas.aa_common import validate_timezone
from app.schemas.aa_reviews import (
    ReviewContextOut,
    ReviewCreate,
    ReviewListOut,
    ReviewOut,
    ReviewRevise,
)
from app.security.aa_gate import require_aa_write_enabled
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.aa_facts import AAServiceError
from app.services.aa_reviews import (
    LIST_LIMIT_MAX,
    UnsupportedReviewSubjectError,
    build_context,
    context_payload,
    list_reviews,
    read_review,
    revise_review,
    save_review,
)


class ReviewRoute(APIRoute):
    """Stable ``{code, message}`` validation errors for the Review surface."""

    def get_route_handler(self):
        handler = super().get_route_handler()

        async def validated(request):
            try:
                return await handler(request)
            except RequestValidationError:
                return JSONResponse(
                    status_code=422,
                    content={"code": "invalid_review", "message": "Invalid review payload."},
                )

        return validated


router = APIRouter(route_class=ReviewRoute, prefix="/api/v1/aa", tags=["adaptive-analytics"])
Auth = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]
Config = Annotated[Settings, Depends(get_request_settings)]
WRITE_GUARDS = [Depends(require_json_content_type), Depends(require_aa_write_enabled)]


def _bad_request(code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=400, content={"code": code, "message": message})


def _subject(value: str):
    try:
        return validate_subject(parse_subject_key(value))
    except (InvalidSubjectError, UnknownSubjectError) as error:
        raise UnsupportedReviewSubjectError from error


@router.get("/reviews/context", response_model=ReviewContextOut)
def review_context(
    user: Auth,
    db: DB,
    subject: Annotated[str, Query(min_length=1, max_length=300)],
    range_from: Annotated[date | None, Query(alias="from")] = None,
    range_to: Annotated[date | None, Query(alias="to")] = None,
    timezone: Annotated[str, Query(max_length=64)] = "Europe/Kyiv",
):
    """The evidence a new Review would freeze, as of now. Writes nothing."""
    if range_from is None or range_to is None:
        return _bad_request("range_required", "An explicit from/to window is required.")
    try:
        validate_timezone(timezone)
    except (ValueError, ZoneInfoNotFoundError) as error:
        return _bad_request("invalid_timezone", str(error))
    try:
        context = build_context(
            db,
            user_id=user.id,
            subject=_subject(subject),
            window_start=range_from,
            window_end=range_to,
            timezone=timezone,
            as_of=datetime.now(UTC),
        )
    except AAServiceError as error:
        return _error_response(error)
    return ReviewContextOut.model_validate(context_payload(context))


@router.get("/reviews", response_model=ReviewListOut)
def reviews(
    user: Auth,
    db: DB,
    subject: Annotated[str, Query(min_length=1, max_length=300)],
    limit: Annotated[int, Query(ge=1, le=LIST_LIMIT_MAX)] = 20,
):
    try:
        ref = _subject(subject)
    except AAServiceError as error:
        return _error_response(error)
    rows = list_reviews(db, user_id=user.id, subject_key=ref.subject_key, limit=limit)
    return ReviewListOut(subject_key=ref.subject_key, limit=limit, reviews=rows)


@router.post("/reviews", response_model=ReviewOut, dependencies=WRITE_GUARDS)
def create_review(
    body: ReviewCreate,
    request: Request,
    response: Response,
    user: Auth,
    db: DB,
    settings: Config,
):
    """Save a Review in one transaction. An empty Review is valid."""
    enforce_same_origin(request, settings)
    try:
        review_id, replayed = save_review(db, user_id=user.id, request=body)
        payload = read_review(db, user_id=user.id, review_id=review_id)
    except AAServiceError as error:
        return _error_response(error)
    response.status_code = 200 if replayed else 201
    return ReviewOut.model_validate({**payload, "replayed": replayed})


@router.get("/reviews/{review_id}", response_model=ReviewOut)
def get_review(review_id: UUID, user: Auth, db: DB):
    """Exactly what was saved, with later corrections flagged beside it."""
    try:
        payload = read_review(db, user_id=user.id, review_id=review_id)
    except AAServiceError as error:
        return _error_response(error)
    return ReviewOut.model_validate(payload)


@router.post("/reviews/{review_id}/revise", response_model=ReviewOut, dependencies=WRITE_GUARDS)
def revise(
    review_id: UUID,
    body: ReviewRevise,
    request: Request,
    response: Response,
    user: Auth,
    db: DB,
    settings: Config,
):
    """Append to a Review. Frozen evidence is never re-derived by a revision."""
    enforce_same_origin(request, settings)
    try:
        _, replayed = revise_review(db, user_id=user.id, review_id=review_id, request=body)
        payload = read_review(db, user_id=user.id, review_id=review_id)
    except AAServiceError as error:
        return _error_response(error)
    response.status_code = 200 if replayed else 201
    return ReviewOut.model_validate({**payload, "replayed": replayed})
