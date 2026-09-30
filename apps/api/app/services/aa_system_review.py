"""System Review — live and saved, with relationship and consequence intelligence (Slice 7).

* **Live** review: derived from current durable evidence on every read; a GET
  writes nothing (no episodes, no relations, no reviews) and runs in a
  read-only transaction.
* **Saved** review: append-only revisions of the user's reflection, decisions and
  adjustments with a frozen, redactable copy of what the review showed.
* **Relations**: user links («Связать») and rule-based proposals the user
  approves, rejects or is unsure about. A relation is an association or a marked
  hypothesis — never a fact, never proof, never a causal claim.
* **Consequences**: transparent projections under explicit inputs and
  assumptions; missing inputs stay missing.

There is no score of any kind. The implementation lives in the
``app.services.system_review`` package; this module is the stable surface, and no
module in the package imports it.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.system_review import periods as _periods
from app.services.system_review.contexts import (
    active_contexts,
    append_context,
    context_payload,
    delete_context,
)
from app.services.system_review.contracts import LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX
from app.services.system_review.errors import (
    CausalRelationForbiddenError,
    FinanceContextConflictError,
    IdempotencyKeyReusedError,
    InvalidExportFormatError,
    InvalidFinanceContextError,
    InvalidImportanceError,
    InvalidPeriodError,
    InvalidRefError,
    InvalidRelationError,
    InvalidSystemReviewError,
    PeriodInFutureError,
    PeriodNotEndedError,
    ProposalNotCurrentError,
    RefNotFoundError,
    RelationNotDeletableError,
    RelationNotFoundError,
    RevisionConflictError,
    RevisionNotFoundError,
    SelfRelationError,
)
from app.services.system_review.exports.report import FORMATS, build_report, export_revision
from app.services.system_review.importance import importance_history, set_importance
from app.services.system_review.periods import Period, parse_period
from app.services.system_review.read_model import candidates_for, live_review, waiting
from app.services.system_review.redaction import (
    SLICE_7_REDACTORS,
    erase_importance_bulk,
    erase_importance_for_source,
    importance_for,
    redact_relation_endpoints,
    redact_relation_endpoints_bulk,
    redact_system_review_sources,
    redact_system_review_sources_bulk,
    relations_for,
    system_review_revisions_for,
)
from app.services.system_review.relations import (
    InvalidResponseError,
    RelationIdUnavailableError,
    create_link,
    delete_link,
    feedback_log,
    list_relations,
    record_feedback,
    relation_payload,
    respond_to_proposal,
)
from app.services.system_review.revisions import (
    current_revision,
    get_revision,
    list_revisions,
    live_source_ids,
    revision_payload,
    save_revision,
)
from app.services.system_review.selfcheck import evaluate_self_check


def server_now():
    """The System Review clock, resolved at call time so tests can pin it."""
    return _periods.server_now()


def read_only(db: Session) -> None:
    """Start a repeatable-read, READ ONLY transaction: a stray write fails loudly."""
    db.connection(execution_options={"isolation_level": "REPEATABLE READ"})
    db.execute(text("SET TRANSACTION READ ONLY"))


__all__ = [
    "FORMATS",
    "LIST_LIMIT_DEFAULT",
    "LIST_LIMIT_MAX",
    "SLICE_7_REDACTORS",
    "CausalRelationForbiddenError",
    "FinanceContextConflictError",
    "IdempotencyKeyReusedError",
    "InvalidExportFormatError",
    "InvalidFinanceContextError",
    "InvalidImportanceError",
    "InvalidPeriodError",
    "InvalidRefError",
    "InvalidRelationError",
    "InvalidResponseError",
    "InvalidSystemReviewError",
    "Period",
    "PeriodInFutureError",
    "PeriodNotEndedError",
    "ProposalNotCurrentError",
    "RefNotFoundError",
    "RelationIdUnavailableError",
    "RelationNotDeletableError",
    "RelationNotFoundError",
    "RevisionConflictError",
    "RevisionNotFoundError",
    "SelfRelationError",
    "active_contexts",
    "append_context",
    "build_report",
    "candidates_for",
    "context_payload",
    "create_link",
    "current_revision",
    "delete_context",
    "delete_link",
    "erase_importance_bulk",
    "erase_importance_for_source",
    "evaluate_self_check",
    "export_revision",
    "feedback_log",
    "get_revision",
    "importance_for",
    "importance_history",
    "list_relations",
    "list_revisions",
    "live_review",
    "live_source_ids",
    "parse_period",
    "read_only",
    "record_feedback",
    "redact_relation_endpoints",
    "redact_relation_endpoints_bulk",
    "redact_system_review_sources",
    "redact_system_review_sources_bulk",
    "relation_payload",
    "relations_for",
    "respond_to_proposal",
    "revision_payload",
    "save_revision",
    "server_now",
    "set_importance",
    "system_review_revisions_for",
    "waiting",
]
