"""Authenticated, gated, concept-specific semantic writes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.routes.aa_measurements import _error_response
from app.schemas.aa_comparison import (
    BaselineCreate,
    ExpectationCreate,
    ForecastCreate,
    ObservationCreate,
    PreferenceCreate,
    SemanticOut,
    TargetCreate,
)
from app.security.aa_gate import require_aa_write_enabled
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.aa_comparison import append_semantic
from app.services.aa_facts import AAServiceError


class SemanticRoute(APIRoute):
    """Keep stable AA errors without changing legacy product route validation."""

    def get_route_handler(self):
        handler = super().get_route_handler()

        async def validated(request):
            try:
                return await handler(request)
            except RequestValidationError as error:
                code = "invalid_request"
                if any(
                    "value_or_absent_required" in str(item.get("msg", ""))
                    for item in error.errors()
                ):
                    code = "value_or_absent_required"
                elif any("value" in item.get("loc", ()) for item in error.errors()):
                    code = "invalid_value_for_type"
                return JSONResponse(
                    status_code=422,
                    content={"code": code, "message": "Invalid semantic fact payload."},
                )

        return validated


router = APIRouter(
    route_class=SemanticRoute,
    prefix="/api/v1/aa",
    tags=["adaptive-analytics"],
    dependencies=[Depends(require_json_content_type), Depends(require_aa_write_enabled)],
)
Auth = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]
Config = Annotated[Settings, Depends(get_request_settings)]


def _write(concept, body, request, response, user, db, settings):
    enforce_same_origin(request, settings)
    try:
        row, replayed = append_semantic(db, user_id=user.id, concept=concept, request=body)
    except AAServiceError as error:
        return _error_response(error)
    response.status_code = 200 if replayed else 201
    return SemanticOut.from_row(row, concept)


@router.post("/expectations", response_model=SemanticOut)
def expectation(
    body: ExpectationCreate,
    request: Request,
    response: Response,
    user: Auth,
    db: DB,
    settings: Config,
):
    return _write("expectation", body, request, response, user, db, settings)


@router.post("/forecasts", response_model=SemanticOut)
def forecast(
    body: ForecastCreate, request: Request, response: Response, user: Auth, db: DB, settings: Config
):
    return _write("forecast", body, request, response, user, db, settings)


@router.post("/baselines", response_model=SemanticOut)
def baseline(
    body: BaselineCreate, request: Request, response: Response, user: Auth, db: DB, settings: Config
):
    return _write("baseline", body, request, response, user, db, settings)


@router.post("/targets", response_model=SemanticOut)
def target(
    body: TargetCreate, request: Request, response: Response, user: Auth, db: DB, settings: Config
):
    return _write("target", body, request, response, user, db, settings)


@router.post("/preferences", response_model=SemanticOut)
def preference(
    body: PreferenceCreate,
    request: Request,
    response: Response,
    user: Auth,
    db: DB,
    settings: Config,
):
    return _write("preference", body, request, response, user, db, settings)


@router.post("/observations", response_model=SemanticOut)
def observation(
    body: ObservationCreate,
    request: Request,
    response: Response,
    user: Auth,
    db: DB,
    settings: Config,
):
    return _write("observation", body, request, response, user, db, settings)
