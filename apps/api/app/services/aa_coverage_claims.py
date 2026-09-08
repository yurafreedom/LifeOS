"""Record and read source-coverage evidence (correction C6).

Coverage claims are written and superseded exactly like any other fact — a
re-import that reached further back supersedes the narrower earlier claim rather
than overwriting it, so what the system believed at any past instant stays
recoverable.

Nothing here consults measurements. The whole point of the table is that a
window's completeness is evidence a source provided, not something inferred from
how many rows happen to exist.
"""

import logging
from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.asof import apply_as_of
from app.analytics.coverage import (
    CoverageClaim,
    CoverageReport,
    build_coverage_report,
)
from app.analytics.enums import (
    CoverageState,
    DenominatorBasis,
    FactStatus,
    SourceKind,
    SupersedeKind,
)
from app.analytics.subjects import SubjectRef
from app.models import AAMeasurement, AASourceCoverage
from app.services.aa_facts import AAServiceError, FactNotFoundError

logger = logging.getLogger(__name__)


class CoverageClaimConflictError(AAServiceError):
    code = "coverage_claim_conflict"
    message = "This coverage claim has already been superseded."


@dataclass(frozen=True, slots=True)
class CoverageClaimRequest:
    source_id: str
    subject: SubjectRef
    window_start_date: date
    window_end_date: date
    timezone: str
    coverage_state: CoverageState
    completeness_known: bool
    source_kind: SourceKind
    idempotency_key: str
    metric_key: str | None = None
    observed_units: int | None = None
    expected_units: int | None = None
    basis: str | None = None
    method: str | None = None
    source_ref: dict[str, object] | None = None
    original_recorded_at_known: bool = True


def _find_by_idempotency_key(
    db: Session, *, user_id: UUID, idempotency_key: str
) -> AASourceCoverage | None:
    return db.scalar(
        select(AASourceCoverage).where(
            AASourceCoverage.user_id == user_id,
            AASourceCoverage.idempotency_key == idempotency_key,
        )
    )


def _build_row(user_id: UUID, request: CoverageClaimRequest) -> AASourceCoverage:
    return AASourceCoverage(
        user_id=user_id,
        source_id=request.source_id,
        metric_key=request.metric_key,
        subject_domain=request.subject.subject_domain,
        subject_type=request.subject.subject_type,
        subject_id=request.subject.subject_id,
        window_start_date=request.window_start_date,
        window_end_date=request.window_end_date,
        timezone=request.timezone,
        coverage_state=request.coverage_state,
        completeness_known=request.completeness_known,
        observed_units=request.observed_units,
        expected_units=request.expected_units,
        source_kind=request.source_kind,
        basis=request.basis,
        method=request.method,
        source_ref=request.source_ref,
        original_recorded_at_known=request.original_recorded_at_known,
        status=FactStatus.ACTIVE,
        idempotency_key=request.idempotency_key,
    )


def record_coverage_claim(
    db: Session, *, user_id: UUID, request: CoverageClaimRequest
) -> tuple[AASourceCoverage, bool]:
    """Persist what a source says it covered. Returns ``(row, replayed)``."""
    existing = _find_by_idempotency_key(
        db, user_id=user_id, idempotency_key=request.idempotency_key
    )
    if existing is not None:
        logger.info(
            "aa.idempotency_replay",
            extra={
                "aa_table": AASourceCoverage.__tablename__,
                "aa_fact_id": str(existing.id),
                "aa_user_id": str(user_id),
            },
        )
        return existing, True

    row = _build_row(user_id, request)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        replayed = _find_by_idempotency_key(
            db, user_id=user_id, idempotency_key=request.idempotency_key
        )
        if replayed is None:
            raise
        return replayed, True
    db.refresh(row)
    return row, False


def supersede_coverage_claim(
    db: Session,
    *,
    user_id: UUID,
    claim_id: UUID,
    request: CoverageClaimRequest,
    supersede_kind: SupersedeKind = SupersedeKind.REVISION,
    reason: str | None = None,
) -> AASourceCoverage:
    """Replace a claim with a wider or more accurate one, keeping the original."""
    target = db.scalar(
        select(AASourceCoverage).where(
            AASourceCoverage.user_id == user_id,
            AASourceCoverage.id == claim_id,
        )
    )
    if target is None:
        raise FactNotFoundError

    replacement = _build_row(user_id, request)
    replacement.supersedes_id = target.id
    db.add(replacement)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise CoverageClaimConflictError from None

    claimed = db.execute(
        update(AASourceCoverage)
        .where(
            AASourceCoverage.id == claim_id,
            AASourceCoverage.user_id == user_id,
            AASourceCoverage.superseded_at.is_(None),
            AASourceCoverage.status == FactStatus.ACTIVE,
        )
        .values(
            status=FactStatus.SUPERSEDED,
            superseded_at=func.now(),
            superseded_by_id=replacement.id,
            supersede_kind=supersede_kind,
            supersede_reason=reason,
        )
    ).rowcount
    if claimed != 1:
        db.rollback()
        raise CoverageClaimConflictError

    db.commit()
    db.refresh(replacement)
    return replacement


def active_claims(
    db: Session,
    *,
    user_id: UUID,
    subject_key: str,
    window_start: date,
    window_end: date,
    as_of: datetime | None = None,
) -> list[AASourceCoverage]:
    """Claims overlapping the window, as current truth or as believed at ``as_of``."""
    statement = select(AASourceCoverage).where(
        AASourceCoverage.user_id == user_id,
        AASourceCoverage.subject_key == subject_key,
        AASourceCoverage.window_start_date <= window_end,
        AASourceCoverage.window_end_date >= window_start,
    )
    return list(db.scalars(apply_as_of(statement, AASourceCoverage, as_of)))


def coverage_report_for_window(
    db: Session,
    *,
    user_id: UUID,
    subject_key: str,
    window_start: date,
    window_end: date,
    timezone: str,
    now: datetime,
    as_of: datetime | None = None,
    denominator_basis: DenominatorBasis = DenominatorBasis.CALENDAR_DAYS,
) -> CoverageReport:
    """Derive the window's data-quality report from claims — never from facts."""
    claims = [
        CoverageClaim(
            window_start_date=row.window_start_date,
            window_end_date=row.window_end_date,
            coverage_state=CoverageState(row.coverage_state),
            completeness_known=row.completeness_known,
        )
        for row in active_claims(
            db,
            user_id=user_id,
            subject_key=subject_key,
            window_start=window_start,
            window_end=window_end,
            as_of=as_of,
        )
    ]

    # Fact statistics colour the report, but never establish coverage.
    stats = db.execute(
        select(
            func.count(AAMeasurement.id).filter(AAMeasurement.status == FactStatus.SUPERSEDED),
            func.count(AAMeasurement.id).filter(
                AAMeasurement.source_kind == SourceKind.ESTIMATED,
                AAMeasurement.status == FactStatus.ACTIVE,
            ),
            func.count(AAMeasurement.id).filter(
                AAMeasurement.method == "LEGACY_IMPORT",
            ),
            func.max(AAMeasurement.recorded_at),
        ).where(
            AAMeasurement.user_id == user_id,
            AAMeasurement.subject_key == subject_key,
        )
    ).one()
    corrected_count, estimated_count, legacy_count, freshest_recorded_at = stats

    return build_coverage_report(
        window_start=window_start,
        window_end=window_end,
        timezone=timezone,
        now=now,
        claims=claims,
        denominator_basis=denominator_basis,
        estimated_count=int(estimated_count or 0),
        corrected_count=int(corrected_count or 0),
        freshest_recorded_at=freshest_recorded_at,
        has_legacy_imports=bool(legacy_count),
        reason=None if claims else "не установлена",
    )
