"""Signal reads and episode acknowledgement — the smallest surface Slice 3 needs.

Two endpoints, no notification infrastructure: there is nothing to poll, nothing
to push, and no alert history to page through. The read is bounded by an explicit
limit and the write acts on one episode the caller has demonstrably just seen.
"""

from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.routes.aa_measurements import _error_response
from app.schemas.aa_common import validate_timezone
from app.schemas.aa_signals import EpisodeAcknowledge, EpisodeOut, SignalsOut
from app.security.aa_gate import require_aa_write_enabled
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.aa_facts import AAServiceError
from app.services.aa_signals import (
    DEFAULT_TIMEZONE,
    HOME_SIGNAL_LIMIT,
    acknowledge_episode,
    evaluate_signals,
)

router = APIRouter(prefix="/api/v1/aa", tags=["adaptive-analytics"])
Auth = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]
Config = Annotated[Settings, Depends(get_request_settings)]

# Home's accepted ceiling is three. A caller may ask for fewer; asking for many
# more would turn a quiet observational layer into a feed.
MAX_LIMIT = 10


@router.get("/signals", response_model=SignalsOut)
def signals(
    user: Auth,
    db: DB,
    settings: Config,
    limit: Annotated[int, Query(ge=0, le=MAX_LIMIT)] = HOME_SIGNAL_LIMIT,
    timezone: Annotated[str, Query(max_length=64)] = DEFAULT_TIMEZONE,
    as_of: datetime | None = None,
):
    """Evaluate the catalogue and return the ranked active cards.

    Evaluation records episode state, which is personal data, so it is written
    only when the AA write gate is open. With the gate closed the same signals are
    returned read-only and nothing accumulates.
    """
    if as_of is not None and as_of.tzinfo is None:
        return JSONResponse(
            status_code=400,
            content={"code": "invalid_time", "message": "as_of requires an offset."},
        )
    try:
        validate_timezone(timezone)
        report = evaluate_signals(
            db,
            user_id=user.id,
            as_of=as_of,
            timezone=timezone,
            limit=limit,
            persist=settings.aa_write_enabled,
        )
    except (ValueError, ZoneInfoNotFoundError) as error:
        return JSONResponse(
            status_code=422,
            content={"code": "invalid_signal_query", "message": str(error)},
        )
    return SignalsOut.from_report(report)


@router.post(
    "/signal-episodes/{episode_key}/ack",
    response_model=EpisodeOut,
    dependencies=[Depends(require_json_content_type), Depends(require_aa_write_enabled)],
)
def acknowledge(
    episode_key: str,
    body: EpisodeAcknowledge,
    request: Request,
    response: Response,
    user: Auth,
    db: DB,
    settings: Config,
):
    """Record the user's dismissal of one episode. Never a deletion.

    Ownership comes from the session; the path names an episode, and an episode
    that is not this account's simply is not found. No identifier in the body is
    trusted as authority.
    """
    enforce_same_origin(request, settings)
    try:
        episode, replayed = acknowledge_episode(
            db,
            user_id=user.id,
            episode_key=episode_key,
            observed_fingerprint=body.input_fingerprint,
            resolution=body.resolution,
        )
    except AAServiceError as error:
        return _error_response(error)
    response.status_code = 200
    return EpisodeOut.from_row(episode, replayed=replayed)
