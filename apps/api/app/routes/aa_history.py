"""Layered history and provenance reads.

Two rules shape this surface:

* A range is mandatory. There is no way to ask for all history at once, so the
  response size stays bounded by what the caller asked for and pagination is
  keyset-based on ``(occurred_at, id)`` rather than an offset that drifts.
* Asking a question never writes one. A window with no observations returns an
  empty layer and a coverage report saying so; it never causes a placeholder row
  to be created.
"""

import base64
import binascii
import json
import logging
from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, tuple_
from sqlalchemy.orm import Session

from app.analytics.asof import apply_as_of
from app.analytics.subjects import InvalidSubjectError, parse_subject_key
from app.db import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas.aa_common import ProvenanceOut
from app.schemas.aa_comparison import SemanticOut
from app.schemas.aa_measurement import (
    CoverageReportOut,
    FactProvenanceOut,
    MeasurementOut,
    MetricHistoryOut,
)
from app.services.aa_comparison import CONCEPT_MODELS
from app.services.aa_coverage_claims import coverage_report_for_window
from app.services.aa_deletion import FACT_TABLES
from app.services.aa_facts import (
    DEFAULT_HISTORY_LIMIT,
    MAX_HISTORY_LIMIT,
    AAServiceError,
    read_history,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/aa", tags=["adaptive-analytics"])

# Only tables that exist in this slice may be addressed by name.
PROVENANCE_TABLES = frozenset(FACT_TABLES)


def _bad_request(code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"code": code, "message": message},
    )


def _not_found() -> JSONResponse:
    """Cross-account and non-existent resolve identically — no existence leak."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"code": "fact_not_found", "message": "Fact not found."},
    )


def encode_cursor(time: datetime, fact_id: UUID, *, time_field: str = "occurred_at") -> str:
    payload = json.dumps({time_field: time.isoformat(), "id": str(fact_id)})
    return base64.urlsafe_b64encode(payload.encode()).decode()


def decode_cursor(cursor: str, *, time_field: str = "occurred_at") -> tuple[datetime, UUID]:
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor.encode()))
        if not isinstance(payload, dict) or set(payload) != {time_field, "id"}:
            raise ValueError("invalid cursor fields")
        time = datetime.fromisoformat(payload[time_field])
        if time.tzinfo is None:
            raise ValueError("cursor time requires an offset")
        return time, UUID(payload["id"])
    except (ValueError, KeyError, TypeError, AttributeError, binascii.Error) as error:
        raise ValueError("invalid cursor") from error


@router.get("/metrics/{metric_key}/history", response_model=MetricHistoryOut)
def read_metric_history(
    metric_key: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    range_from: Annotated[datetime | None, Query(alias="from")] = None,
    range_to: Annotated[datetime | None, Query(alias="to")] = None,
    subject: Annotated[str | None, Query()] = None,
    as_of: Annotated[datetime | None, Query()] = None,
    coverage_from: Annotated[date | None, Query()] = None,
    coverage_to: Annotated[date | None, Query()] = None,
    timezone: Annotated[str, Query()] = "UTC",
    cursor: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_HISTORY_LIMIT)] = DEFAULT_HISTORY_LIMIT,
    expectation_cursor: str | None = None,
    forecast_cursor: str | None = None,
    baseline_cursor: str | None = None,
    layers: str | None = None,
):
    if range_from is None or range_to is None:
        return _bad_request("range_required", "Both 'from' and 'to' are required.")
    if any(time is not None and time.tzinfo is None for time in (range_from, range_to, as_of)):
        return _bad_request("invalid_time", "History timestamps require offsets.")
    if range_to < range_from:
        return _bad_request("range_required", "'to' must not precede 'from'.")
    wanted = (
        {"actual", "expectations", "forecasts", "baselines", "events"}
        if layers is None
        else set(layers.split(","))
    )
    if not wanted <= {"actual", "expectations", "forecasts", "baselines", "events"}:
        return _bad_request("invalid_layers", "Unknown history layer.")

    subject_key: str | None = None
    if subject is not None:
        try:
            subject_key = parse_subject_key(subject).subject_key
        except InvalidSubjectError as error:
            return _bad_request("invalid_subject", str(error))

    decoded_cursor: tuple[datetime, UUID] | None = None
    if cursor is not None:
        try:
            decoded_cursor = decode_cursor(cursor)
        except ValueError:
            return _bad_request("invalid_cursor", "Cursor is not readable.")

    rows = read_history(
        db,
        user_id=user.id,
        metric_key=metric_key,
        subject_key=subject_key,
        range_from=range_from,
        range_to=range_to,
        as_of=as_of,
        cursor=decoded_cursor,
        limit=limit,
    )

    coverage: CoverageReportOut | None = None
    if subject_key is not None and coverage_from is not None and coverage_to is not None:
        report = coverage_report_for_window(
            db,
            user_id=user.id,
            subject_key=subject_key,
            window_start=coverage_from,
            window_end=coverage_to,
            timezone=timezone,
            now=datetime.now(tz=range_to.tzinfo),
            as_of=as_of,
        )
        coverage = CoverageReportOut(
            window_start=report.window_start.isoformat(),
            window_end=report.window_end.isoformat(),
            timezone=report.timezone,
            denominator_basis=report.denominator_basis,
            expected_denominator=report.expected_denominator,
            observed_count=report.observed_count,
            partial_count=report.partial_count,
            missing_count=report.missing_count,
            unknown_coverage_count=report.unknown_coverage_count,
            future_count=report.future_count,
            estimated_count=report.estimated_count,
            corrected_count=report.corrected_count,
            freshest_recorded_at=report.freshest_recorded_at,
            has_legacy_imports=report.has_legacy_imports,
            reason=report.reason,
        )

    next_cursor = encode_cursor(rows[-1].occurred_at, rows[-1].id) if len(rows) == limit else None
    semantic_layers = {}
    layer_cursors = {}
    for concept, raw_cursor in (
        ("expectation", expectation_cursor),
        ("forecast", forecast_cursor),
        ("baseline", baseline_cursor),
    ):
        name = {"expectation": "expectations", "forecast": "forecasts", "baseline": "baselines"}[
            concept
        ]
        if name not in wanted:
            semantic_layers[name] = []
            layer_cursors[name] = None
            continue
        model = CONCEPT_MODELS[concept]
        query = select(model).where(
            model.user_id == user.id,
            model.metric_key == metric_key,
            model.recorded_at >= range_from,
            model.recorded_at <= range_to,
            model.status != "tombstoned",
        )
        if subject_key:
            query = query.where(model.subject_key == subject_key)
        if as_of is not None:
            query = apply_as_of(query, model, as_of)
            if hasattr(model, "effective_from"):
                query = query.where(model.effective_from <= as_of)
        if raw_cursor:
            try:
                time, fact_id = decode_cursor(raw_cursor, time_field="recorded_at")
                query = query.where(tuple_(model.recorded_at, model.id) < tuple_(time, fact_id))
            except ValueError:
                return _bad_request("invalid_cursor", "Layer cursor is not readable.")
        versions = db.scalars(
            query.order_by(model.recorded_at.desc(), model.id.desc()).limit(limit + 1)
        ).all()
        name = {"expectation": "expectations", "forecast": "forecasts", "baseline": "baselines"}[
            concept
        ]
        semantic_layers[name] = [SemanticOut.from_row(row, concept) for row in versions[:limit]]
        layer_cursors[name] = (
            encode_cursor(
                versions[limit - 1].recorded_at, versions[limit - 1].id, time_field="recorded_at"
            )
            if len(versions) > limit
            else None
        )
    return MetricHistoryOut(
        metric_key=metric_key,
        subject_key=subject_key,
        range_from=range_from,
        range_to=range_to,
        as_of=as_of,
        actual=[MeasurementOut.from_row(row) for row in rows] if "actual" in wanted else [],
        coverage=coverage,
        next_cursor=next_cursor if "actual" in wanted else None,
        **semantic_layers,
        layer_cursors=layer_cursors,
    )


@router.get("/facts/{fact_table}/{fact_id}/provenance", response_model=FactProvenanceOut)
def read_fact_provenance(
    fact_table: str,
    fact_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if fact_table not in PROVENANCE_TABLES:
        return _not_found()
    try:
        model = FACT_TABLES[fact_table]
        row = db.scalar(select(model).where(model.user_id == user.id, model.id == fact_id))
        if row is None:
            return _not_found()
    except AAServiceError:
        return _not_found()

    return FactProvenanceOut(
        fact_table=fact_table,
        fact_id=row.id,
        provenance=ProvenanceOut.from_row(row),
        status=row.status,
        supersedes_id=row.supersedes_id,
        superseded_by_id=row.superseded_by_id,
        supersede_kind=row.supersede_kind,
        supersede_reason=row.supersede_reason,
    )
