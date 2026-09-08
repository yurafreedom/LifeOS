"""Measurement append and correction endpoints.

Both are unsafe methods and therefore reuse the existing session dependency,
same-origin enforcement and JSON content-type enforcement. Neither accepts a
user id: ownership comes from the authenticated session, and a body carrying
``user_id`` is rejected as an unknown field.

Both are additionally behind the AA write gate until export and erasure exist.
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.schemas.aa_measurement import (
    CorrectionOut,
    MeasurementCorrect,
    MeasurementCreate,
    MeasurementOut,
)
from app.security.aa_gate import require_aa_write_enabled
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.aa_facts import (
    AAServiceError,
    CorrectionConflictError,
    FactNotFoundError,
    append_measurement,
    correct_measurement,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/aa", tags=["adaptive-analytics"])

_ERROR_STATUS: dict[str, int] = {
    "fact_not_found": status.HTTP_404_NOT_FOUND,
    "metric_not_found": status.HTTP_404_NOT_FOUND,
    "metric_value_type_mismatch": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "correction_conflict": status.HTTP_409_CONFLICT,
}


def _error_response(error: AAServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=_ERROR_STATUS.get(error.code, status.HTTP_400_BAD_REQUEST),
        content={"code": error.code, "message": error.message},
    )


@router.post(
    "/measurements",
    response_model=MeasurementOut,
    dependencies=[Depends(require_json_content_type), Depends(require_aa_write_enabled)],
)
def record_measurement(
    body: MeasurementCreate,
    request: Request,
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        result = append_measurement(db, user_id=user.id, request=body)
    except AAServiceError as error:
        return _error_response(error)

    # 201 for a fact that was created here; 200 when a retry resolved to the
    # fact an earlier attempt already created.
    response.status_code = status.HTTP_200_OK if result.replayed else status.HTTP_201_CREATED
    return MeasurementOut.from_row(result.measurement)


@router.post(
    "/measurements/{measurement_id}/correct",
    response_model=CorrectionOut,
    dependencies=[Depends(require_json_content_type), Depends(require_aa_write_enabled)],
)
def correct_recorded_measurement(
    measurement_id: UUID,
    body: MeasurementCorrect,
    request: Request,
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    enforce_same_origin(request, settings)
    try:
        result = correct_measurement(
            db, user_id=user.id, measurement_id=measurement_id, request=body
        )
    except (FactNotFoundError, CorrectionConflictError, AAServiceError) as error:
        return _error_response(error)

    response.status_code = status.HTTP_200_OK if result.replayed else status.HTTP_201_CREATED
    return CorrectionOut(
        measurement=MeasurementOut.from_row(result.measurement),
        superseded=MeasurementOut.from_row(result.superseded),
    )
