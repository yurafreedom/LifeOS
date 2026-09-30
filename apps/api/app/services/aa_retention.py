"""AA history retention (Slice 8) — the stable surface.

* **Policy** — append-only intent. No row = UNLIMITED (default). Finite is 24, 36
  or 60 months only. Saving a policy never deletes anything.
* **Preview** — read-only aggregates of what an Apply would erase and redact,
  bound to an opaque token (sha256 of the exact set).
* **Apply** — explicit, confirmed, atomic; whole chains / windows / completed
  Project units only; frozen evidence redacted first; one run-level audit row.
* **Horizon** — the effective historical-completeness horizon comes from
  completed runs only, so erased history is never "restored" by a later, looser
  policy.

There is no scheduler: deletion happens only after preview + explicit Apply.
The implementation lives in ``app.services.retention``; no module there imports
this facade.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.enums import RetentionMode
from app.models import AARetentionRun
from app.services.retention.contracts import (
    ALLOWED_MONTHS,
    CONSEQUENCES_VERSION,
    ENGINE_VERSION,
    PRESERVED_KINDS,
    PRUNABLE_KINDS,
    RUN_HISTORY_LIMIT,
    RetentionConsequencesStaleError,
    RetentionConsequencesUnconfirmedError,
    RetentionError,
    RetentionIdempotencyReusedError,
    RetentionPolicyNotFiniteError,
    RetentionPreviewStaleError,
)
from app.services.retention.engine import apply_retention, preview, run_payload
from app.services.retention.horizon import (
    RetentionHorizon,
    effective_horizon,
    pruned_project_ids,
    target_horizon_date,
)
from app.services.retention.policy import (
    PolicyRequest,
    active_policy,
    policy_version_count,
    set_policy,
)


def recent_runs(db: Session, *, user_id: UUID, limit: int = RUN_HISTORY_LIMIT) -> list:
    return list(
        db.scalars(
            select(AARetentionRun)
            .where(AARetentionRun.user_id == user_id)
            .order_by(AARetentionRun.started_at.desc(), AARetentionRun.id.desc())
            .limit(limit)
        )
    )


def policy_state(
    db: Session, *, user_id: UUID, timezone: str, now: datetime | None = None
) -> dict[str, Any]:
    """Current intent, the effective applied horizon and the latest runs — kept
    apart, because they may differ after an earlier stricter Apply."""
    at = now or datetime.now(UTC)
    policy = active_policy(db, user_id=user_id)
    horizon = effective_horizon(db, user_id=user_id)
    runs = recent_runs(db, user_id=user_id)
    mode = policy.mode if policy is not None else RetentionMode.UNLIMITED
    months = policy.retain_months if policy is not None else None
    return {
        "mode": str(mode),
        "retain_months": months,
        "source": "explicit" if policy is not None else "default",
        "policy_id": str(policy.id) if policy is not None else None,
        "policy_version": policy_version_count(db, user_id=user_id),
        "recorded_at": policy.recorded_at.isoformat() if policy is not None else None,
        "confirmed_at": policy.confirmed_at.isoformat()
        if policy is not None and policy.confirmed_at is not None
        else None,
        "consequences_version": CONSEQUENCES_VERSION,
        "allowed_months": list(ALLOWED_MONTHS),
        "engine_version": ENGINE_VERSION,
        "target_horizon_date": target_horizon_date(months, timezone, at).isoformat()
        if months is not None
        else None,
        "effective_horizon": {
            "date": horizon.date.isoformat(),
            "timezone": horizon.timezone,
            "run_id": str(horizon.run_id),
            "applied_at": horizon.applied_at.isoformat(),
        }
        if horizon is not None
        else None,
        "latest_run": run_payload(runs[0]) if runs else None,
        "runs": [run_payload(run) for run in runs],
        "prunable": list(PRUNABLE_KINDS),
        "preserved": list(PRESERVED_KINDS),
    }


__all__ = [
    "ALLOWED_MONTHS",
    "CONSEQUENCES_VERSION",
    "ENGINE_VERSION",
    "PolicyRequest",
    "RetentionConsequencesStaleError",
    "RetentionConsequencesUnconfirmedError",
    "RetentionError",
    "RetentionHorizon",
    "RetentionIdempotencyReusedError",
    "RetentionPolicyNotFiniteError",
    "RetentionPreviewStaleError",
    "active_policy",
    "apply_retention",
    "effective_horizon",
    "policy_state",
    "preview",
    "pruned_project_ids",
    "recent_runs",
    "run_payload",
    "set_policy",
    "target_horizon_date",
]
