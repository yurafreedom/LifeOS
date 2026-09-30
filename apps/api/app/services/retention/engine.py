"""Preview and explicit Apply of a finite retention policy (Plan §5–§6).

Preview is read-only and returns safe aggregates plus an opaque token — the
sha256 of the exact candidate set and every redaction target. Apply re-derives
that set under a per-user advisory lock *after* locking every candidate row,
and erases nothing unless the token still matches (409 otherwise).

Apply is ATOMIC: one transaction redacts frozen evidence first (Review, Saved
System Review, relations, importance, provenance), removes signal episodes of
erased windows, then deletes whole units table by table, and finally records one
``aa_retention_runs`` row. If anything fails the transaction rolls back — nothing
is deleted — and a separate transaction records the attempt as ``failed``.
There is never a per-fact retention receipt, and never a deleted value in the
audit row.
"""

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, time
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.enums import RedactionReason, RetentionMode, RetentionRunStatus
from app.models import AARetentionPolicy, AARetentionRun
from app.services.aa_reviews import redact_review_items, review_items_for_sources
from app.services.aa_system_review import (
    erase_importance_bulk,
    importance_for,
    redact_relation_endpoints_bulk,
    redact_system_review_sources_bulk,
    relations_for,
    system_review_revisions_for,
)
from app.services.retention.contracts import (
    ENGINE_VERSION,
    PRESERVED_KINDS,
    RetentionIdempotencyReusedError,
    RetentionPolicyNotFiniteError,
    RetentionPreviewStaleError,
    lock_retention,
)
from app.services.retention.eligibility import (
    DELETE_ORDER,
    OVERRIDES,
    Candidates,
    derive_candidates,
    lock_candidates,
)
from app.services.retention.horizon import effective_horizon, target_horizon_date
from app.services.retention.policy import active_policy
from app.services.retention.provenance import provenance_hits, redact_provenance

logger = logging.getLogger(__name__)
REASON = RedactionReason.SOURCE_RETENTION_PRUNED


@dataclass
class RetentionPlan:
    user_id: UUID
    policy_id: UUID
    retain_months: int
    timezone: str
    horizon_date: Any
    horizon_at: datetime
    candidates: Candidates
    review_item_ids: list[UUID]
    system_review_revision_ids: list[UUID]
    relation_ids: list[UUID]
    importance_ids: list[UUID]
    provenance: dict[str, list[UUID]]

    @property
    def source_pairs(self) -> set[tuple[str, str]]:
        return {(table, str(identity)) for table, identity in self.candidates.fact_sources()}

    def fingerprint(self) -> str:
        """sha256 over the exact candidate set and every redaction target."""
        payload = {
            "engine": ENGINE_VERSION,
            "user": str(self.user_id),
            "policy": str(self.policy_id),
            "months": self.retain_months,
            "horizon": self.horizon_date.isoformat(),
            "timezone": self.timezone,
            "rows": {t: [str(i) for i in ids] for t, ids in sorted(self.candidates.rows.items())},
            "units": self.candidates.project_units,
            "episodes": [str(i) for i in self.candidates.episode_ids],
            "review_items": [str(i) for i in self.review_item_ids],
            "system_reviews": [str(i) for i in self.system_review_revision_ids],
            "relations": [str(i) for i in self.relation_ids],
            "importance": [str(i) for i in self.importance_ids],
            "provenance": {t: [str(i) for i in ids] for t, ids in sorted(self.provenance.items())},
            "skipped": dict(sorted(self.candidates.skipped.items())),
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        return hashlib.sha256(encoded).hexdigest()

    def table_counts(self) -> dict[str, int]:
        counts = {table: len(ids) for table, ids in sorted(self.candidates.rows.items())}
        if self.candidates.episode_ids:
            counts["aa_signal_episodes"] = len(self.candidates.episode_ids)
        return counts

    def unit_counts(self) -> dict[str, Any]:
        return {
            "chains": dict(sorted(self.candidates.chains.items())),
            "correction_or_revision_chains": self.candidates.multi_member_chains,
            "finance_months": len(self.candidates.finance_months),
            "project_units": len(self.candidates.project_units),
        }


def _horizon_at(horizon_date, timezone: str) -> datetime:
    return datetime.combine(horizon_date, time.min, tzinfo=ZoneInfo(timezone))


def build_plan(
    db: Session, *, user_id: UUID, policy: AARetentionPolicy, timezone: str, now: datetime
) -> RetentionPlan:
    if policy.mode != RetentionMode.FINITE or policy.retain_months is None:
        raise RetentionPolicyNotFiniteError
    horizon_date = target_horizon_date(policy.retain_months, timezone, now)
    horizon_at = _horizon_at(horizon_date, timezone)
    candidates = derive_candidates(
        db, user_id=user_id, horizon_date=horizon_date, horizon_at=horizon_at
    )
    sources = candidates.fact_sources()
    pairs = {(table, str(identity)) for table, identity in sources}
    ids = [identity for _, identity in sources]
    return RetentionPlan(
        user_id=user_id,
        policy_id=policy.id,
        retain_months=policy.retain_months,
        timezone=timezone,
        horizon_date=horizon_date,
        horizon_at=horizon_at,
        candidates=candidates,
        review_item_ids=review_items_for_sources(db, user_id, sources),
        system_review_revision_ids=system_review_revisions_for(db, user_id, ids),
        relation_ids=relations_for(db, user_id, pairs),
        importance_ids=importance_for(db, user_id, pairs),
        provenance=provenance_hits(db, user_id=user_id, pruned=ids),
    )


def _horizon_payload(db: Session, user_id: UUID) -> dict[str, Any] | None:
    horizon = effective_horizon(db, user_id=user_id)
    if horizon is None:
        return None
    return {
        "date": horizon.date.isoformat(),
        "timezone": horizon.timezone,
        "run_id": str(horizon.run_id),
    }


def preview(db: Session, *, user_id: UUID, timezone: str, now: datetime | None = None) -> dict:
    """Read-only: what an Apply right now would erase and redact."""
    at = now or datetime.now(UTC)
    policy = active_policy(db, user_id=user_id)
    if policy is None:
        raise RetentionPolicyNotFiniteError
    plan = build_plan(db, user_id=user_id, policy=policy, timezone=timezone, now=at)
    counts = plan.table_counts()
    return {
        "policy_id": str(plan.policy_id),
        "retain_months": plan.retain_months,
        "timezone": timezone,
        "target_horizon_date": plan.horizon_date.isoformat(),
        "effective_horizon": _horizon_payload(db, user_id),
        "engine_version": ENGINE_VERSION,
        "computed_at": at.isoformat(),
        "total_deleted": sum(counts.values()),
        "table_counts": counts,
        "unit_counts": plan.unit_counts(),
        "chain_count": plan.candidates.multi_member_chains,
        "project_unit_count": len(plan.candidates.project_units),
        "review_redaction_count": len(plan.review_item_ids),
        "system_review_redaction_count": len(plan.system_review_revision_ids),
        "relation_redaction_count": len(plan.relation_ids),
        "importance_redaction_count": len(plan.importance_ids),
        "provenance_redaction_count": sum(len(ids) for ids in plan.provenance.values()),
        "signal_episode_count": len(plan.candidates.episode_ids),
        "skipped": dict(sorted(plan.candidates.skipped.items())),
        "preserved": list(PRESERVED_KINDS),
        "preview_token": plan.fingerprint(),
    }


def run_payload(run: AARetentionRun) -> dict[str, Any]:
    def iso(value):
        return value.isoformat() if value is not None else None

    return {
        "id": str(run.id),
        "status": run.status,
        "policy_id": str(run.policy_id),
        "retain_months": run.retain_months,
        "target_horizon_date": run.target_horizon_date.isoformat(),
        "timezone": run.timezone,
        "engine_version": run.engine_version,
        "started_at": iso(run.started_at),
        "completed_at": iso(run.completed_at),
        "failed_at": iso(run.failed_at),
        "failure_code": run.failure_code,
        "total_deleted": run.total_deleted,
        "table_counts": run.table_counts,
        "unit_counts": run.unit_counts,
        "chain_count": run.chain_count,
        "project_unit_count": run.project_unit_count,
        "review_redaction_count": run.review_redaction_count,
        "system_review_redaction_count": run.system_review_redaction_count,
        "relation_redaction_count": run.relation_redaction_count,
        "importance_redaction_count": run.importance_redaction_count,
        "provenance_redaction_count": run.provenance_redaction_count,
        "signal_episode_count": run.signal_episode_count,
        "skipped": run.skipped,
    }


def _run_by_key(db: Session, user_id: UUID, key: str) -> AARetentionRun | None:
    return db.scalar(
        select(AARetentionRun).where(
            AARetentionRun.user_id == user_id, AARetentionRun.idempotency_key == key
        )
    )


def _replay(run: AARetentionRun, token: str) -> tuple[AARetentionRun, bool]:
    if run.preview_fingerprint != token:
        raise RetentionIdempotencyReusedError
    return run, True


def _delete(db: Session, user_id: UUID, table: str, ids: list[UUID]) -> int:
    """One statement per table: a whole chain goes in one DELETE, so the NO ACTION
    self-FKs are checked only at statement end, when every member is gone."""
    if not ids:
        return 0
    return db.execute(
        text(f"DELETE FROM {table} WHERE user_id = :user_id AND id = ANY(CAST(:ids AS uuid[]))"),
        {"user_id": user_id, "ids": ids},
    ).rowcount


def _erase(db: Session, plan: RetentionPlan, run: AARetentionRun) -> None:
    """Plan §6 steps 5–8 inside the caller's transaction. Order is load-bearing."""
    user_id = plan.user_id
    sources = plan.source_pairs
    run.review_redaction_count = redact_review_items(db, user_id, plan.review_item_ids, REASON)
    run.system_review_redaction_count = redact_system_review_sources_bulk(
        db, user_id, plan.system_review_revision_ids, sources, REASON
    )
    run.relation_redaction_count = redact_relation_endpoints_bulk(
        db, user_id, plan.relation_ids, sources
    )
    run.importance_redaction_count = erase_importance_bulk(db, user_id, plan.importance_ids)
    run.provenance_redaction_count = redact_provenance(db, user_id=user_id, hits=plan.provenance)
    run.signal_episode_count = _delete(
        db, user_id, "aa_signal_episodes", plan.candidates.episode_ids
    )
    counts: dict[str, int] = {}
    overrides = plan.candidates.rows.get(OVERRIDES, [])
    for table in DELETE_ORDER:
        deleted = _delete(db, user_id, table, plan.candidates.rows.get(table, []))
        if deleted:
            counts[table] = deleted
        if table == "aa_measurements" and overrides:
            # Removed by ON DELETE CASCADE in the same statement; verify, then count.
            left = db.scalar(
                text(
                    f"SELECT count(*) FROM {OVERRIDES} WHERE user_id = :user_id"
                    " AND id = ANY(CAST(:ids AS uuid[]))"
                ),
                {"user_id": user_id, "ids": overrides},
            )
            if left:
                raise RuntimeError("membership overrides survived their measurement")
            counts[OVERRIDES] = len(overrides)
    if run.signal_episode_count:
        counts["aa_signal_episodes"] = run.signal_episode_count
    run.table_counts = dict(sorted(counts.items()))
    run.total_deleted = sum(counts.values())
    run.unit_counts = plan.unit_counts()
    run.chain_count = plan.candidates.multi_member_chains
    run.project_unit_count = len(plan.candidates.project_units)
    run.skipped = dict(sorted(plan.candidates.skipped.items()))
    run.pruned_units = {"project_subject_ids": list(plan.candidates.project_units)}


def apply_retention(
    db: Session,
    *,
    user_id: UUID,
    preview_token: str,
    timezone: str,
    idempotency_key: str,
    now: datetime | None = None,
) -> tuple[AARetentionRun, bool]:
    """Explicit, confirmed Apply. Returns ``(run, replayed)``."""
    at = now or datetime.now(UTC)
    existing = _run_by_key(db, user_id, idempotency_key)
    if existing is not None:
        return _replay(existing, preview_token)
    started: dict[str, Any] = {}
    try:
        lock_retention(db, user_id)
        existing = _run_by_key(db, user_id, idempotency_key)
        if existing is not None:
            db.commit()
            return _replay(existing, preview_token)
        policy = active_policy(db, user_id=user_id)
        if policy is None:
            raise RetentionPolicyNotFiniteError
        plan = build_plan(db, user_id=user_id, policy=policy, timezone=timezone, now=at)
        lock_candidates(db, user_id=user_id, candidates=plan.candidates)
        # Re-derive after the row locks: anything committed meanwhile is now visible
        # and nothing new can attach to a locked chain.
        plan = build_plan(db, user_id=user_id, policy=policy, timezone=timezone, now=at)
        if plan.fingerprint() != preview_token:
            raise RetentionPreviewStaleError
        started = {
            "policy_id": policy.id,
            "retain_months": plan.retain_months,
            "target_horizon_date": plan.horizon_date,
        }
        run = AARetentionRun(
            user_id=user_id,
            policy_id=policy.id,
            retain_months=plan.retain_months,
            target_horizon_date=plan.horizon_date,
            timezone=timezone,
            engine_version=ENGINE_VERSION,
            preview_fingerprint=preview_token,
            status=RetentionRunStatus.RUNNING,
            started_at=at,
            progress={"phase": "running"},
            idempotency_key=idempotency_key,
        )
        db.add(run)
        db.flush()
        _erase(db, plan, run)
        run.status = RetentionRunStatus.COMPLETED
        run.completed_at = datetime.now(UTC)
        run.progress = {"phase": "completed", "atomic": True}
        db.commit()
    except (RetentionPreviewStaleError, RetentionPolicyNotFiniteError,
            RetentionIdempotencyReusedError):
        db.rollback()
        raise
    except BaseException as error:
        db.rollback()
        if started and not isinstance(error, (KeyboardInterrupt, SystemExit)):
            _record_failure(db, user_id, timezone, preview_token, idempotency_key, at,
                            started, error)
        raise
    db.refresh(run)
    logger.info(
        "aa.retention_applied",
        extra={
            "aa_user_id": str(user_id),
            "aa_retention_run_id": str(run.id),
            "aa_retention_total_deleted": run.total_deleted,
        },
    )
    return run, False


def _record_failure(
    db: Session, user_id: UUID, timezone: str, token: str, key: str, at: datetime,
    started: dict[str, Any], error: BaseException,
) -> None:
    """The destructive transaction rolled back (nothing deleted); keep one truthful,
    content-free audit row of the attempt."""
    try:
        db.add(AARetentionRun(
            user_id=user_id,
            timezone=timezone,
            engine_version=ENGINE_VERSION,
            preview_fingerprint=token,
            status=RetentionRunStatus.FAILED,
            started_at=at,
            failed_at=datetime.now(UTC),
            failure_code=type(error).__name__[:100],
            progress={"phase": "rolled_back", "atomic": True},
            idempotency_key=key,
            **started,
        ))
        db.commit()
    except IntegrityError:
        db.rollback()
    logger.warning(
        "aa.retention_failed",
        extra={"aa_user_id": str(user_id), "aa_failure_code": type(error).__name__},
    )
