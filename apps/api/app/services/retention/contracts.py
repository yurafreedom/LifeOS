"""Retention vocabulary, stable error codes and the per-user advisory lock."""

import hashlib
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.analytics.enums import RETENTION_MONTHS
from app.services.aa_facts import AAServiceError

# Bump when eligibility semantics change: an old preview token then goes stale.
ENGINE_VERSION = 1
# The consequence disclosure the user must confirm before a finite policy is stored.
CONSEQUENCES_VERSION = "retention-consequences-v1"
ALLOWED_MONTHS: tuple[int, ...] = RETENTION_MONTHS
RUN_HISTORY_LIMIT = 20

# What a finite policy may erase (whole chains / windows / Project units only) and
# what it never age-prunes (O1). Returned verbatim so the UI and tests share one list.
PRUNABLE_KINDS: tuple[str, ...] = (
    "measurements",
    "source_coverage",
    "expectation_versions",
    "baselines",
    "targets",
    "forecast_versions",
    "observations",
    "preferences",
    "metric_policy_versions",
    "membership_overrides",
    "signal_episodes",
    "completed_project_units",
)
PRESERVED_KINDS: tuple[str, ...] = (
    "reviews",
    "review_notes_factors_decisions",
    "experiments",
    "experiment_adherence_and_observations",
    "importance_ratings",
    "relations_and_feedback",
    "finance_contexts",
    "saved_system_reviews",
    "retention_policies_and_runs",
    "deletion_receipts",
    "open_or_actual_less_projects",
)


class RetentionError(AAServiceError):
    code = "retention_error"
    message = "Retention request failed."


class RetentionPolicyNotFiniteError(RetentionError):
    code = "retention_policy_not_finite"
    message = "Retention is unlimited; there is nothing to preview or apply."


class RetentionPreviewStaleError(RetentionError):
    code = "retention_preview_stale"
    message = "What would be deleted changed since the preview. Preview again."


class RetentionConsequencesUnconfirmedError(RetentionError):
    code = "retention_consequences_unconfirmed"
    message = "A finite retention policy requires confirming its consequences."


class RetentionConsequencesStaleError(RetentionError):
    code = "retention_consequences_stale"
    message = "The consequences you confirmed are out of date. Review them again."


class RetentionIdempotencyReusedError(RetentionError):
    code = "idempotency_key_reused"
    message = "This idempotency key was already used for a different request."


def lock_retention(db: Session, user_id: UUID) -> None:
    """Serialize every retention write of one account (xact-scoped advisory lock)."""
    digest = hashlib.sha256(f"aa-retention:{user_id}".encode()).digest()
    key = int.from_bytes(digest[:8], "big", signed=True)
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": key})
