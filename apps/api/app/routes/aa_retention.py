"""AA history retention routes (Slice 8).

Retention is a privacy / data-management control, so — like hard delete, export
and account erasure — it stays usable when AA *recording* is disabled: a user can
always reduce what is kept. Unsafe routes check, in order and before any body
semantics: JSON content type (415) → same origin (403) → session; the body never
carries a ``user_id``. Apply is a direct, explicitly confirmed call — the web
client never routes it through the offline write queue.
"""

from datetime import UTC, datetime
from typing import Annotated
from zoneinfo import ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.schemas.aa_common import validate_timezone
from app.schemas.aa_retention import RetentionApplyIn, RetentionPolicyIn, RetentionPreviewIn
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.aa_retention import (
    PolicyRequest,
    RetentionError,
    apply_retention,
    policy_state,
    preview,
    run_payload,
    set_policy,
)

router = APIRouter(prefix="/api/v1/aa", tags=["adaptive-analytics"])
Auth = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]
Timezone = Annotated[str, Query(max_length=64)]

_STATUS = {
    "retention_policy_not_finite": 409,
    "retention_preview_stale": 409,
    "retention_consequences_unconfirmed": 422,
    "retention_consequences_stale": 409,
    "idempotency_key_reused": 409,
}
NO_STORE = {"Cache-Control": "no-store"}


def _same_origin(
    request: Request, settings: Annotated[Settings, Depends(get_request_settings)]
) -> None:
    enforce_same_origin(request, settings)


UNSAFE = [Depends(require_json_content_type), Depends(_same_origin)]


def _error(error: RetentionError) -> JSONResponse:
    return JSONResponse(
        status_code=_STATUS.get(error.code, 400),
        content={"code": error.code, "message": error.message},
        headers=NO_STORE,
    )


def _read_only(db: Session) -> None:
    db.connection(execution_options={"isolation_level": "REPEATABLE READ"})
    db.execute(text("SET TRANSACTION READ ONLY"))


@router.get("/retention-policy")
def read_policy(user: Auth, db: DB, timezone: Timezone = "Europe/Kyiv"):
    try:
        validate_timezone(timezone)
    except (ValueError, ZoneInfoNotFoundError):
        return JSONResponse(
            status_code=422, content={"code": "invalid_timezone", "message": "Unknown timezone."}
        )
    try:
        _read_only(db)
        payload = policy_state(db, user_id=user.id, timezone=timezone)
    finally:
        db.rollback()
    return JSONResponse(content=payload, headers=NO_STORE)


@router.put("/retention-policy", dependencies=UNSAFE)
def write_policy(body: RetentionPolicyIn, response: Response, user: Auth, db: DB):
    """Store retention intent. Never deletes anything — a finite policy only allows
    a later explicit Apply."""
    try:
        _, changed, replayed = set_policy(
            db,
            user_id=user.id,
            request=PolicyRequest(
                mode=body.mode,
                retain_months=body.retain_months,
                consequences_version=body.consequences_version,
                confirm_consequences=body.confirm_consequences,
                idempotency_key=body.idempotency_key,
            ),
        )
    except RetentionError as error:
        return _error(error)
    state = policy_state(db, user_id=user.id, timezone="Europe/Kyiv")
    return JSONResponse(
        status_code=201 if changed else 200,
        content={**state, "changed": changed, "replayed": replayed},
        headers=NO_STORE,
    )


@router.post("/retention-policy/preview", dependencies=UNSAFE)
def preview_policy(body: RetentionPreviewIn, user: Auth, db: DB):
    """Read-only: what an Apply would erase and redact now, plus an opaque token."""
    try:
        _read_only(db)
        payload = preview(db, user_id=user.id, timezone=body.timezone)
    except RetentionError as error:
        return _error(error)
    finally:
        db.rollback()
    return JSONResponse(content=payload, headers=NO_STORE)


@router.post("/retention-policy/apply", dependencies=UNSAFE)
def apply_policy(body: RetentionApplyIn, user: Auth, db: DB):
    """Explicit, confirmed, atomic erasure of whole eligible units."""
    try:
        run, replayed = apply_retention(
            db,
            user_id=user.id,
            preview_token=body.preview_token,
            timezone=body.timezone,
            idempotency_key=body.idempotency_key,
            now=datetime.now(UTC),
        )
    except RetentionError as error:
        return _error(error)
    return JSONResponse(
        status_code=200 if replayed else 201,
        content={**run_payload(run), "replayed": replayed},
        headers=NO_STORE,
    )
