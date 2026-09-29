"""Constants and shared helpers for the Experiment service."""

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.enums import ExperimentLifecycle as L
from app.analytics.subjects import SubjectRef
from app.models import AAExperiment
from app.services.experiments import days
from app.services.experiments.errors import ExperimentNotFoundError, InvalidTimeError

LEGAL_EDGES: frozenset[tuple[str, str]] = frozenset(
    {
        (L.DRAFT, L.RUNNING),
        (L.DRAFT, L.ABANDONED),
        (L.RUNNING, L.COMPLETED_AWAITING_REVIEW),
        (L.RUNNING, L.ABANDONED),
        (L.COMPLETED_AWAITING_REVIEW, L.REVIEWED),
        (L.COMPLETED_AWAITING_REVIEW, L.ABANDONED),
    }
)
# Each state is entered at most once, so each has its own instant + key pair.
STATE_COLUMNS: dict[str, tuple[str, str]] = {
    L.RUNNING: ("started_at", "start_key"),
    L.COMPLETED_AWAITING_REVIEW: ("completed_at", "complete_key"),
    L.REVIEWED: ("reviewed_at", "review_key"),
    L.ABANDONED: ("abandoned_at", "abandon_key"),
}
KEY_COLUMNS = ("idempotency_key", "start_key", "complete_key", "review_key", "abandon_key")

# The Phase B allow-list Slice 7 reads: ABANDONED and REVIEWED are never pending.
PENDING_LIFECYCLES: tuple[str, ...] = (L.DRAFT, L.RUNNING, L.COMPLETED_AWAITING_REVIEW)
EVIDENCE_LIFECYCLES: tuple[str, ...] = (L.RUNNING, L.COMPLETED_AWAITING_REVIEW)
BASELINE_LIFECYCLES: tuple[str, ...] = (L.DRAFT, L.RUNNING)
DECISION_LIFECYCLES: tuple[str, ...] = (L.COMPLETED_AWAITING_REVIEW, L.REVIEWED)

TIME_SKEW = timedelta(minutes=5)
MAX_WINDOW_DAYS = 366
LIST_LIMIT_DEFAULT = 20
LIST_LIMIT_MAX = 50
MAX_FACTOR_CHANGES = 20
SUBJECT_DOMAIN = SUBJECT_TYPE = "experiment"


def experiment_subject(experiment_id: UUID) -> SubjectRef:
    return SubjectRef(
        subject_domain=SUBJECT_DOMAIN, subject_type=SUBJECT_TYPE, subject_id=str(experiment_id)
    )


def load_owned(
    db: Session, *, user_id: UUID, experiment_id: UUID, for_update: bool = False
) -> AAExperiment:
    query = select(AAExperiment).where(
        AAExperiment.id == experiment_id, AAExperiment.user_id == user_id
    )
    if for_update:
        query = query.with_for_update()
    row = db.scalar(query)
    if row is None:
        raise ExperimentNotFoundError
    return row


def require_not_future(instant: datetime) -> None:
    if instant.tzinfo is None or instant > days.server_now() + TIME_SKEW:
        raise InvalidTimeError


def outcome_matches(experiment: AAExperiment, value) -> bool:
    """A value is an outcome of this experiment only in its exact defined shape."""
    return (
        str(value.type) == experiment.outcome_value_type
        and (value.unit_code or None) == experiment.outcome_unit_code
        and value.scale_min == experiment.outcome_scale_min
        and value.scale_max == experiment.outcome_scale_max
    )
