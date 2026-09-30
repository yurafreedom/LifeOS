"""Finance pilot reads and queue-friendly policy writes."""

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
from app.schemas.aa_comparison import OverrideCreate, PolicyCreate
from app.schemas.aa_finance import (
    FinanceMonthOut,
    FinancePolicyCreate,
    PolicyByMeasurementKeyCreate,
)
from app.security.aa_gate import require_aa_write_enabled
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.aa_facts import AAServiceError, get_measurement_by_idempotency_key
from app.services.aa_finance import derive_month
from app.services.aa_metric_policy import record_override, record_policy

router = APIRouter(prefix="/api/v1/aa", tags=["adaptive-analytics"])
Auth = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]
Config = Annotated[Settings, Depends(get_request_settings)]


@router.get("/finance/months/{period}", response_model=FinanceMonthOut)
def finance_month(
    period: str,
    user: Auth,
    db: DB,
    timezone: Annotated[str, Query(max_length=64)] = "Europe/Kyiv",
    as_of: datetime | None = None,
):
    try:
        return derive_month(db, user_id=user.id, period=period, timezone=timezone, as_of=as_of)
    except (ValueError, ZoneInfoNotFoundError) as error:
        return JSONResponse(
            status_code=422,
            content={"code": "invalid_finance_query", "message": str(error)},
        )


# Guards run as route dependencies so a non-JSON body is a 415, not a parser 422
# (Slice 8 hardening, K15); same-origin still precedes any body semantics.
WRITE_GUARDS = [Depends(require_json_content_type), Depends(require_aa_write_enabled)]


def _authorize_write(request: Request, settings: Settings):
    enforce_same_origin(request, settings)


@router.post("/finance/policies", dependencies=WRITE_GUARDS)
def finance_policy(
    body: FinancePolicyCreate,
    request: Request,
    response: Response,
    user: Auth,
    db: DB,
    settings: Config,
):
    _authorize_write(request, settings)
    try:
        row, replayed = record_policy(
            db, user_id=user.id, request=PolicyCreate(**body.model_dump())
        )
    except AAServiceError as error:
        return _error_response(error)
    response.status_code = 200 if replayed else 201
    return {"id": str(row.id), "replayed": replayed}


@router.post("/finance/membership-overrides", dependencies=WRITE_GUARDS)
def membership_override(
    body: PolicyByMeasurementKeyCreate,
    request: Request,
    response: Response,
    user: Auth,
    db: DB,
    settings: Config,
):
    _authorize_write(request, settings)
    try:
        measurement = get_measurement_by_idempotency_key(
            db, user_id=user.id, idempotency_key=body.measurement_idempotency_key
        )
        row, replayed = record_override(
            db,
            user_id=user.id,
            request=OverrideCreate(
                metric_key=body.metric_key,
                source_fact_id=measurement.id,
                included=body.included,
                provenance=body.provenance,
                idempotency_key=body.idempotency_key,
            ),
        )
    except AAServiceError as error:
        return _error_response(error)
    response.status_code = 200 if replayed else 201
    return {"id": str(row.id), "replayed": replayed}
