"""System Review, relations, importance and finance-context endpoints (Slice 7).

Reads need a session only and never write: the live review runs in a READ ONLY
transaction, whatever the AA write gate says. Writes additionally need the write
gate, a JSON body (route dependency: 415 before 422) and a same-origin request.
Ownership comes from the session only; a foreign item is simply not found.
Every write is idempotent by key and answers ``replayed`` on a retry.
"""

from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.routes.aa_measurements import _error_response
from app.schemas.aa_common import validate_timezone
from app.schemas.aa_system_review import (
    FinanceContextAppend,
    FinanceContextDelete,
    ImportanceSet,
    ProposalResponse,
    RelationCreate,
    RelationDelete,
    RelationFeedback,
    RevisionCreate,
)
from app.security.aa_gate import require_aa_write_enabled
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.aa_facts import AAServiceError
from app.services.aa_system_review import (
    FORMATS,
    LIST_LIMIT_DEFAULT,
    LIST_LIMIT_MAX,
    InvalidExportFormatError,
    active_contexts,
    append_context,
    candidates_for,
    context_payload,
    create_link,
    current_revision,
    delete_context,
    delete_link,
    export_revision,
    feedback_log,
    get_revision,
    list_relations,
    list_revisions,
    live_review,
    live_source_ids,
    parse_period,
    read_only,
    record_feedback,
    relation_payload,
    respond_to_proposal,
    revision_payload,
    save_revision,
    server_now,
    set_importance,
    waiting,
)

_VALIDATION_CODES = (
    ("/relations", "invalid_relation", "Invalid relation payload."),
    ("/importance", "invalid_importance", "Invalid importance payload."),
    ("/finance-contexts", "invalid_finance_context", "Invalid finance context."),
)


class SystemReviewRoute(APIRoute):
    """Stable ``{code, message}`` validation errors per Slice 7 surface."""

    def get_route_handler(self):
        handler = super().get_route_handler()

        async def validated(request):
            try:
                return await handler(request)
            except RequestValidationError:
                path = request.url.path
                for fragment, code, message in _VALIDATION_CODES:
                    if fragment in path:
                        return JSONResponse(
                            status_code=422, content={"code": code, "message": message}
                        )
                return JSONResponse(
                    status_code=422,
                    content={"code": "invalid_system_review",
                             "message": "Invalid system review payload."},
                )

        return validated


router = APIRouter(route_class=SystemReviewRoute, prefix="/api/v1/aa",
                   tags=["adaptive-analytics"])
Auth = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]
Config = Annotated[Settings, Depends(get_request_settings)]
WRITE_GUARDS = [Depends(require_json_content_type), Depends(require_aa_write_enabled)]
Timezone = Annotated[str, Query(max_length=64)]


def _bad(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": code, "message": message})


def _timezone(value: str) -> JSONResponse | None:
    try:
        validate_timezone(value)
    except (ValueError, ZoneInfoNotFoundError):
        return _bad(422, "invalid_timezone", "Unknown IANA timezone.")
    return None


# ───────────────────────────── live review ─────────────────────────────


@router.get("/system-review")
def system_review(
    user: Auth,
    db: DB,
    period: Annotated[str | None, Query(max_length=7)] = None,
    timezone: Timezone = "Europe/Kyiv",
):
    """The live review for a month (YYYY-MM) or a year (YYYY). Writes nothing."""
    if not period:
        return _bad(400, "period_required", "A period (YYYY-MM or YYYY) is required.")
    if (error := _timezone(timezone)) is not None:
        return error
    try:
        read_only(db)
        payload = live_review(db, user_id=user.id, period=parse_period(period, timezone),
                              now=server_now())
    except AAServiceError as error:
        return _error_response(error)
    finally:
        db.rollback()
    return payload


@router.get("/system-review/waiting")
def system_review_waiting(user: Auth, db: DB, timezone: Timezone = "Europe/Kyiv"):
    """«Ревью доступно · N» and «Требует подтверждения · N» — separate, exact items."""
    if (error := _timezone(timezone)) is not None:
        return error
    try:
        read_only(db)
        return waiting(db, user_id=user.id, timezone=timezone, now=server_now())
    finally:
        db.rollback()


# ───────────────────────────── relations ─────────────────────────────


def _relation(db, user, row, replayed: bool, response: Response):
    log = feedback_log(db, user_id=user.id, relation_ids=[row.id])
    response.status_code = 200 if replayed else 201
    return {**relation_payload(row, log.get(row.id)), "replayed": replayed}


@router.get("/relations")
def relations(
    user: Auth,
    db: DB,
    status: Annotated[list[str] | None, Query()] = None,
    type: Annotated[list[str] | None, Query()] = None,  # noqa: A002
    source: Annotated[list[str] | None, Query()] = None,
    domain: Annotated[list[str] | None, Query()] = None,
    period: Annotated[str | None, Query(max_length=7)] = None,
    importance: Annotated[list[str] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=LIST_LIMIT_MAX)] = LIST_LIMIT_DEFAULT,
):
    try:
        read_only(db)
        rows = list_relations(
            db, user_id=user.id, statuses=tuple(status or ()), types=tuple(type or ()),
            sources=tuple(source or ()), domains=tuple(domain or ()), period=period,
            importance=tuple(importance or ()), limit=limit,
        )
        log = feedback_log(db, user_id=user.id, relation_ids=[row.id for row in rows])
        return {"relations": [relation_payload(row, log.get(row.id)) for row in rows],
                "limit": limit}
    finally:
        db.rollback()


@router.post("/relations", dependencies=WRITE_GUARDS)
def create_relation(
    body: RelationCreate, request: Request, response: Response, user: Auth, db: DB,
    settings: Config,
):
    """«Связать»: a user link, stored approved. Causal wording is refused."""
    enforce_same_origin(request, settings)
    try:
        row, replayed = create_link(
            db, user_id=user.id, relation_id=body.id, from_key=body.from_key,
            to_key=body.to_key, relation_type=body.relation_type, note=body.note,
            period=body.period, key=body.idempotency_key,
        )
        return _relation(db, user, row, replayed, response)
    except AAServiceError as error:
        return _error_response(error)


@router.post("/relations/proposals/respond", dependencies=WRITE_GUARDS)
def respond(
    body: ProposalResponse, request: Request, response: Response, user: Auth, db: DB,
    settings: Config,
):
    """Approve / reject / unsure for a live proposal, re-derived by the server."""
    enforce_same_origin(request, settings)
    try:
        period = parse_period(body.period, "Europe/Kyiv")
        candidate = candidates_for(db, user_id=user.id, period=period, now=server_now()).get(
            body.proposal_key
        )
        db.rollback()
        row, replayed = respond_to_proposal(
            db, user_id=user.id, candidate=candidate, proposal_key=body.proposal_key,
            response=body.response, note=body.note, evaluated_at=body.evaluated_at,
            key=body.idempotency_key,
        )
        return _relation(db, user, row, replayed, response)
    except AAServiceError as error:
        return _error_response(error)


@router.post("/relations/{relation_id}/feedback", dependencies=WRITE_GUARDS)
def feedback(
    relation_id: UUID, body: RelationFeedback, request: Request, response: Response,
    user: Auth, db: DB, settings: Config,
):
    enforce_same_origin(request, settings)
    try:
        row, replayed = record_feedback(
            db, user_id=user.id, relation_id=relation_id, response=body.response,
            note=body.note, key=body.idempotency_key,
        )
        return _relation(db, user, row, replayed, response)
    except AAServiceError as error:
        return _error_response(error)


@router.post("/relations/{relation_id}/delete", dependencies=WRITE_GUARDS)
def remove_relation(
    relation_id: UUID, body: RelationDelete, request: Request, user: Auth, db: DB,
    settings: Config,
):
    """Remove a link you created (hard delete). A proposal is rejected instead."""
    enforce_same_origin(request, settings)
    try:
        absent = delete_link(db, user_id=user.id, relation_id=relation_id)
    except AAServiceError as error:
        return _error_response(error)
    return {"id": str(relation_id), "deleted": True, "replayed": absent}


# ───────────────────────────── importance ─────────────────────────────


@router.post("/importance", dependencies=WRITE_GUARDS)
def importance(
    body: ImportanceSet, request: Request, response: Response, user: Auth, db: DB,
    settings: Config,
):
    enforce_same_origin(request, settings)
    try:
        row, replayed = set_importance(
            db, user_id=user.id, target_key=body.target_key, importance=body.importance,
            key=body.idempotency_key,
        )
    except AAServiceError as error:
        return _error_response(error)
    response.status_code = 200 if replayed else 201
    return {"target_key": row.target_key, "importance": row.importance,
            "recorded_at": row.recorded_at.isoformat(), "replayed": replayed}


# ───────────────────────────── finance context ─────────────────────────────


@router.get("/finance-contexts")
def finance_contexts(
    user: Auth, db: DB, kind: Annotated[list[str] | None, Query()] = None
):
    try:
        read_only(db)
        rows = active_contexts(db, user_id=user.id, kinds=tuple(kind or ()))
        return {"contexts": [context_payload(row) for row in rows]}
    finally:
        db.rollback()


@router.post("/finance-contexts", dependencies=WRITE_GUARDS)
def add_finance_context(
    body: FinanceContextAppend, request: Request, response: Response, user: Auth, db: DB,
    settings: Config,
):
    """Store what the user chose to state. Nothing here is inferred."""
    enforce_same_origin(request, settings)
    try:
        row, replayed = append_context(
            db, user_id=user.id, entity_id=body.entity_id, kind=body.kind,
            subject_key=body.subject_key, payload=body.payload, key=body.idempotency_key,
        )
    except AAServiceError as error:
        return _error_response(error)
    response.status_code = 200 if replayed else 201
    return {**context_payload(row), "replayed": replayed}


@router.post("/finance-contexts/{entity_id}/delete", dependencies=WRITE_GUARDS)
def remove_finance_context(
    entity_id: UUID, body: FinanceContextDelete, request: Request, user: Auth, db: DB,
    settings: Config,
):
    """Hard delete, with everything derived from it redacted in the same transaction."""
    enforce_same_origin(request, settings)
    try:
        absent = delete_context(db, user_id=user.id, entity_id=entity_id)
    except AAServiceError as error:
        return _error_response(error)
    return {"entity_id": str(entity_id), "deleted": True, "replayed": absent}


# ───────────────────────────── saved review ─────────────────────────────


@router.post("/system-reviews/{period}/revisions", dependencies=WRITE_GUARDS)
def add_revision(
    period: str, body: RevisionCreate, request: Request, response: Response, user: Auth,
    db: DB, settings: Config,
):
    """Save a draft, finalize or revise: always a new revision, never a rewrite."""
    enforce_same_origin(request, settings)
    if (error := _timezone(body.timezone)) is not None:
        return error
    try:
        row, replayed = save_revision(
            db, user_id=user.id, period=parse_period(period, body.timezone),
            base_revision=body.base_revision, finalize=body.finalize,
            reflection=body.reflection, no_conclusion=body.no_conclusion,
            decisions=body.decisions, adjustments=body.adjustments,
            key=body.idempotency_key, now=server_now(),
        )
    except AAServiceError as error:
        response_error = _error_response(error)
        if error.code == "revision_conflict":
            period_ref = parse_period(period, body.timezone)
            response_error = JSONResponse(
                status_code=409,
                content={"code": error.code, "message": error.message,
                         "current_revision": current_revision(db, user_id=user.id,
                                                              period=period_ref)},
            )
        return response_error
    response.status_code = 200 if replayed else 201
    return {**revision_payload(row), "replayed": replayed}


@router.get("/system-reviews/{period}/revisions")
def revisions(period: str, user: Auth, db: DB, timezone: Timezone = "Europe/Kyiv"):
    if (error := _timezone(timezone)) is not None:
        return error
    try:
        read_only(db)
        ref = parse_period(period, timezone)
        return {"period": ref.key, "period_kind": ref.kind,
                "revisions": list_revisions(db, user_id=user.id, period=ref)}
    except AAServiceError as error:
        return _error_response(error)
    finally:
        db.rollback()


@router.get("/system-reviews/{period}/revisions/{revision}")
def revision(
    period: str, revision: int, user: Auth, db: DB, timezone: Timezone = "Europe/Kyiv",
    compare: bool = False,
):
    """Exactly what was saved. ``compare`` reports whether live evidence moved since."""
    if (error := _timezone(timezone)) is not None:
        return error
    try:
        read_only(db)
        ref = parse_period(period, timezone)
        row = get_revision(db, user_id=user.id, period=ref, revision=revision)
        live = live_source_ids(db, user_id=user.id, period=ref, now=server_now()) if compare \
            else None
        return revision_payload(row, live_source_ids=live)
    except AAServiceError as error:
        return _error_response(error)
    finally:
        db.rollback()


@router.get("/system-reviews/{period}/revisions/{revision}/export")
def export(
    period: str, revision: int, user: Auth, db: DB,
    format: Annotated[str, Query(max_length=8)] = "md",  # noqa: A002
    locale: Annotated[str, Query(max_length=4)] = "ru",
    timezone: Timezone = "Europe/Kyiv",
):
    """PDF / DOCX / XLSX / MD of one saved revision, redaction markers included."""
    if (error := _timezone(timezone)) is not None:
        return error
    try:
        if format not in FORMATS:
            raise InvalidExportFormatError
        read_only(db)
        row = get_revision(db, user_id=user.id, period=parse_period(period, timezone),
                           revision=revision)
        content, media_type, filename = export_revision(row, format, locale)
    except AAServiceError as error:
        return _error_response(error)
    finally:
        db.rollback()
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
