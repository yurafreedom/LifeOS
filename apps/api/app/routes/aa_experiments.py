"""Experiment endpoints.

Reads need a session only. Writes additionally need the AA write gate, a JSON
body (a route dependency, so a wrong ``Content-Type`` is 415 before the body is
parsed, never a parser 422) and a same-origin request. Ownership comes from the
session only: an experiment that is not this account's is simply not found.
Every write answers with the full detail plus ``replayed`` (and ``no_op`` for a
transition whose target was already entered).
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from app.analytics.enums import ExperimentLifecycle
from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.routes.aa_measurements import _error_response
from app.schemas.aa_experiments import (
    AdherenceCreate,
    ConditionCreate,
    ExperimentBaselineCreate,
    ExperimentCreate,
    ExperimentDecisionCreate,
    ExperimentListOut,
    ExperimentObservationCreate,
    ExperimentOut,
    TransitionCreate,
    as_payload,
)
from app.security.aa_gate import require_aa_write_enabled
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.aa_experiments import (
    LIST_LIMIT_DEFAULT,
    LIST_LIMIT_MAX,
    create_experiment,
    experiment_detail,
    list_experiments,
    record_adherence,
    record_baseline,
    record_condition,
    record_decision,
    record_observation,
    transition,
)
from app.services.aa_facts import AAServiceError


class ExperimentRoute(APIRoute):
    """Stable ``{code, message}`` validation errors for the Experiment surface."""

    def get_route_handler(self):
        handler = super().get_route_handler()

        async def validated(request):
            try:
                return await handler(request)
            except RequestValidationError:
                return JSONResponse(
                    status_code=422,
                    content={"code": "invalid_experiment", "message": "Invalid experiment payload."},
                )

        return validated


router = APIRouter(route_class=ExperimentRoute, prefix="/api/v1/aa", tags=["adaptive-analytics"])
Auth = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]
Config = Annotated[Settings, Depends(get_request_settings)]
WRITE_GUARDS = [Depends(require_json_content_type), Depends(require_aa_write_enabled)]


def _answer(db, user, experiment_id, response, *, replayed: bool, no_op: bool = False):
    payload = experiment_detail(db, user_id=user.id, experiment_id=experiment_id)
    response.status_code = 200 if (replayed or no_op) else 201
    return as_payload(payload, replayed=replayed, no_op=no_op)


@router.get("/experiments", response_model=ExperimentListOut)
def experiments(
    user: Auth,
    db: DB,
    lifecycle: Annotated[list[ExperimentLifecycle] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=LIST_LIMIT_MAX)] = LIST_LIMIT_DEFAULT,
):
    wanted = tuple(dict.fromkeys(str(value) for value in lifecycle or ()))
    rows = list_experiments(db, user_id=user.id, lifecycles=wanted, limit=limit)
    return ExperimentListOut(lifecycles=list(wanted), limit=limit, experiments=rows)


@router.post("/experiments", response_model=ExperimentOut, dependencies=WRITE_GUARDS)
def create(
    body: ExperimentCreate, request: Request, response: Response, user: Auth, db: DB,
    settings: Config,
):
    """Store a DRAFT under the client-minted id."""
    enforce_same_origin(request, settings)
    try:
        experiment_id, replayed = create_experiment(db, user_id=user.id, request=body)
        return _answer(db, user, experiment_id, response, replayed=replayed)
    except AAServiceError as error:
        return _error_response(error)


@router.get("/experiments/{experiment_id}", response_model=ExperimentOut)
def read(experiment_id: UUID, user: Auth, db: DB):
    """A pure read: nothing is written, not even an overdue completion."""
    try:
        return as_payload(experiment_detail(db, user_id=user.id, experiment_id=experiment_id))
    except AAServiceError as error:
        return _error_response(error)


@router.post(
    "/experiments/{experiment_id}/transition", response_model=ExperimentOut,
    dependencies=WRITE_GUARDS,
)
def move(
    experiment_id: UUID, body: TransitionCreate, request: Request, response: Response,
    user: Auth, db: DB, settings: Config,
):
    enforce_same_origin(request, settings)
    try:
        result = transition(
            db, user_id=user.id, experiment_id=experiment_id, target=body.to,
            occurred_at=body.occurred_at, key=body.idempotency_key,
        )
        payload = experiment_detail(db, user_id=user.id, experiment_id=experiment_id)
    except AAServiceError as error:
        return _error_response(error)
    # A transition is a state change, not a created resource: always 200.
    response.status_code = 200
    return as_payload(payload, replayed=result.replayed, no_op=result.no_op)


@router.post(
    "/experiments/{experiment_id}/adherence", response_model=ExperimentOut,
    dependencies=WRITE_GUARDS,
)
def adherence(
    experiment_id: UUID, body: AdherenceCreate, request: Request, response: Response,
    user: Auth, db: DB, settings: Config,
):
    enforce_same_origin(request, settings)
    try:
        replayed = record_adherence(
            db, user_id=user.id, experiment_id=experiment_id, day=body.day,
            state=str(body.state), supersedes_key=body.supersedes_idempotency_key,
            key=body.idempotency_key,
        )
        return _answer(db, user, experiment_id, response, replayed=replayed)
    except AAServiceError as error:
        return _error_response(error)


@router.post(
    "/experiments/{experiment_id}/observations", response_model=ExperimentOut,
    dependencies=WRITE_GUARDS,
)
def observation(
    experiment_id: UUID, body: ExperimentObservationCreate, request: Request,
    response: Response, user: Auth, db: DB, settings: Config,
):
    enforce_same_origin(request, settings)
    try:
        replayed = record_observation(
            db, user_id=user.id, experiment_id=experiment_id, request=body
        )
        return _answer(db, user, experiment_id, response, replayed=replayed)
    except AAServiceError as error:
        return _error_response(error)


@router.post(
    "/experiments/{experiment_id}/baseline", response_model=ExperimentOut,
    dependencies=WRITE_GUARDS,
)
def baseline(
    experiment_id: UUID, body: ExperimentBaselineCreate, request: Request, response: Response,
    user: Auth, db: DB, settings: Config,
):
    enforce_same_origin(request, settings)
    try:
        replayed = record_baseline(db, user_id=user.id, experiment_id=experiment_id, request=body)
        return _answer(db, user, experiment_id, response, replayed=replayed)
    except AAServiceError as error:
        return _error_response(error)


@router.post(
    "/experiments/{experiment_id}/conditions", response_model=ExperimentOut,
    dependencies=WRITE_GUARDS,
)
def condition(
    experiment_id: UUID, body: ConditionCreate, request: Request, response: Response,
    user: Auth, db: DB, settings: Config,
):
    enforce_same_origin(request, settings)
    try:
        replayed = record_condition(
            db, user_id=user.id, experiment_id=experiment_id, condition_text=body.text,
            epistemic_kind=body.epistemic_kind, occurred_at=body.occurred_at,
            occurred_tz=body.occurred_tz, key=body.idempotency_key,
        )
        return _answer(db, user, experiment_id, response, replayed=replayed)
    except AAServiceError as error:
        return _error_response(error)


@router.post(
    "/experiments/{experiment_id}/decision", response_model=ExperimentOut,
    dependencies=WRITE_GUARDS,
)
def decision(
    experiment_id: UUID, body: ExperimentDecisionCreate, request: Request, response: Response,
    user: Auth, db: DB, settings: Config,
):
    """Append a decision revision. The lifecycle is never touched."""
    enforce_same_origin(request, settings)
    try:
        replayed = record_decision(db, user_id=user.id, experiment_id=experiment_id, request=body)
        return _answer(db, user, experiment_id, response, replayed=replayed)
    except AAServiceError as error:
        return _error_response(error)
