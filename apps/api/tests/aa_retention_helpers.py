"""Helpers for the Slice 8 retention suites."""

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID, uuid4

from app.models import AARetentionPolicy, AARetentionRun

BASE = "/api/v1/aa"
POLICY = f"{BASE}/retention-policy"
KYIV = "Europe/Kyiv"
CONSEQUENCES = "retention-consequences-v1"


def key() -> str:
    return f"k-{uuid4()}"


def ok(response, *codes: int) -> dict[str, Any]:
    assert response.status_code in (codes or (200, 201)), response.text
    return response.json()


def completed_run(
    session_factory,
    user_id: UUID,
    horizon: date,
    *,
    timezone: str = KYIV,
    pruned_projects: tuple[str, ...] = (),
    retain_months: int = 36,
) -> UUID:
    """A completed run row as the engine would leave it — for read-contract tests
    that must not depend on the deletion engine."""
    now = datetime.now(UTC)
    with session_factory.begin() as db:
        policy = db.query(AARetentionPolicy).filter_by(user_id=user_id, status="active").first()
        if policy is None:
            policy = AARetentionPolicy(
                user_id=user_id, mode="finite", retain_months=retain_months,
                consequences_version=CONSEQUENCES, confirmed_at=now, recorded_at=now,
                status="active", idempotency_key=key(),
            )
            db.add(policy)
            db.flush()
        run = AARetentionRun(
            user_id=user_id, policy_id=policy.id, retain_months=retain_months,
            target_horizon_date=horizon, timezone=timezone, engine_version=1,
            preview_fingerprint="c" * 64, status="completed", started_at=now,
            completed_at=now, pruned_units={"project_subject_ids": list(pruned_projects)},
            idempotency_key=key(),
        )
        db.add(run)
        db.flush()
        return run.id


def measurement(
    client, *, metric: str = "finance.transaction_amount", subject: dict[str, str] | None = None,
    value: dict[str, Any] | None = None, occurred_at: str, idempotency_key: str | None = None,
    dimensions: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "metric_key": metric,
        "subject": subject or {"domain": "finance", "type": "transaction", "id": f"t-{uuid4()}"},
        "value": value or {"type": "money", "unit_code": "UAH", "num": "100.00"},
        "occurred_at": occurred_at,
        "occurred_tz": KYIV,
        "provenance": {"source_kind": "USER_REPORTED", "basis": "1 операция",
                       "method": "Ручная запись"},
        "idempotency_key": idempotency_key or key(),
        "dimensions": dimensions
        if dimensions is not None
        else {"category_id": "food", "included_by_default": True},
    }
    return ok(client.post(f"{BASE}/measurements", json=body))
