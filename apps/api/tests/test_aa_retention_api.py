"""Slice 8 · retention HTTP surface, security ordering, F6 anti-resurrection,
privacy parity and activityLog independence (real clock; dates are relative).

R8-02/03/10/11/53/54/55/56/57/61/62/63/64/65/67/70, K15.
"""

import io
import json
import re
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.models import AAMeasurement, AARetentionPolicy, AARetentionRun, UserSnapshot
from tests.aa_helpers import authenticate
from tests.aa_retention_helpers import CONSEQUENCES, KYIV, POLICY, key, measurement, ok
from tests.aa_retention_seed import counts

TODAY = datetime.now(ZoneInfo(KYIV)).date()


def _months_ago(months: int) -> date:
    index = TODAY.year * 12 + TODAY.month - 1 - months
    return date(index // 12, index % 12 + 1, 10)


OLD = _months_ago(30)  # well before any 24-month horizon
RECENT = TODAY - timedelta(days=3)


def _finite(client, months: int = 24, **extra):
    body = {"mode": "finite", "retain_months": months, "confirm_consequences": True,
            "consequences_version": CONSEQUENCES, "idempotency_key": key(), **extra}
    return client.put(POLICY, json=body)


def _preview(client):
    return client.post(f"{POLICY}/preview", json={"timezone": KYIV})


def _apply(client, token: str, **extra):
    return client.post(f"{POLICY}/apply", json={
        "preview_token": token, "confirm": True, "timezone": KYIV, "idempotency_key": key(),
        **extra,
    })


def _snapshot(session_factory, user_id, transactions, activity=None):
    with session_factory.begin() as db:
        db.add(UserSnapshot(user_id=user_id, schema_version=2, revision=1, payload={
            "transactions": transactions, "categoryOverrides": {},
            "activityLog": activity or [],
        }))


def _import(client, coverage=None):
    return ok(client.post("/api/v1/aa/import/legacy-transactions",
                          json={"timezone": KYIV, "coverage": coverage or []}), 200)


# ───────────────────────────── GET / PUT ─────────────────────────────


def test_r8_01_get_reports_unlimited_default_and_allowed_months(
    client, settings, account_factory, engine
):
    owner = account_factory("ret-api-get@example.com")
    authenticate(client, settings, owner)
    before = counts(engine, owner.user_id)
    state = ok(client.get(POLICY), 200)
    assert state["mode"] == "unlimited" and state["source"] == "default"
    assert state["allowed_months"] == [60, 36, 24]
    assert state["consequences_version"] == CONSEQUENCES
    assert state["effective_horizon"] is None and state["runs"] == []
    assert counts(engine, owner.user_id) == before  # a GET writes nothing
    assert client.get(POLICY, params={"timezone": "Mars/Base"}).status_code == 422


@pytest.mark.parametrize("months", [1, 3, 6, 12, 18, 23, 30, 48, 120, 0, -24])
def test_r8_02_03_04_only_24_36_60_are_accepted(client, settings, account_factory, months):
    owner = account_factory(f"ret-api-months-{months}@example.com")
    authenticate(client, settings, owner)
    assert _finite(client, months).status_code == 422
    assert ok(client.get(POLICY), 200)["mode"] == "unlimited"


def test_r8_06_finite_requires_the_current_consequences(client, settings, account_factory):
    owner = account_factory("ret-api-confirm@example.com")
    authenticate(client, settings, owner)
    unconfirmed = _finite(client, confirm_consequences=False)
    assert unconfirmed.status_code == 422
    assert unconfirmed.json()["code"] == "retention_consequences_unconfirmed"
    stale = _finite(client, consequences_version="retention-consequences-v0")
    assert stale.status_code == 409 and stale.json()["code"] == "retention_consequences_stale"
    created = ok(_finite(client, 36), 201)
    assert created["mode"] == "finite" and created["retain_months"] == 36
    assert created["changed"] is True
    same = ok(_finite(client, 36), 200)
    assert same["changed"] is False
    # Idempotent replay of one request.
    body = {"mode": "unlimited", "idempotency_key": "policy-replay-0001"}
    first = ok(client.put(POLICY, json=body), 201)
    again = ok(client.put(POLICY, json=body), 200)
    assert first["mode"] == again["mode"] == "unlimited" and again["replayed"] is True
    reused = client.put(POLICY, json={**body, "mode": "finite", "retain_months": 24,
                                      "confirm_consequences": True,
                                      "consequences_version": CONSEQUENCES})
    assert reused.status_code == 409


# ───────────────────────────── guards ─────────────────────────────


@pytest.mark.parametrize(
    ("method", "path"),
    [("put", POLICY), ("post", f"{POLICY}/preview"), ("post", f"{POLICY}/apply"),
     ("post", "/api/v1/aa/finance/policies"),
     ("post", "/api/v1/aa/finance/membership-overrides")],
)
def test_r8_55_415_before_422_on_every_unsafe_route(
    client, settings, account_factory, method, path
):
    owner = account_factory(f"ret-415-{path.count('/')}-{method}{len(path)}@example.com")
    authenticate(client, settings, owner)
    response = getattr(client, method)(
        path, content=b"not json at all", headers={"Content-Type": "text/plain"}
    )
    assert response.status_code == 415, response.text
    assert response.json()["code"] == "unsupported_media_type"


def test_r8_54_body_user_id_rejected_and_cross_origin_refused(
    client, settings, account_factory
):
    owner = account_factory("ret-guards@example.com")
    authenticate(client, settings, owner)
    injected = client.put(POLICY, json={"mode": "unlimited", "idempotency_key": key(),
                                        "user_id": str(owner.user_id)})
    assert injected.status_code == 422
    foreign = client.put(POLICY, json={"mode": "unlimited", "idempotency_key": key()},
                         headers={"Origin": "https://evil.example"})
    assert foreign.status_code == 403
    assert client.post(f"{POLICY}/preview", json={"timezone": KYIV},
                       headers={"Origin": "https://evil.example"}).status_code == 403
    client.cookies.clear()
    assert client.get(POLICY).status_code == 401


def test_r8_10_apply_requires_explicit_confirmation(client, settings, account_factory):
    owner = account_factory("ret-api-confirm-apply@example.com")
    authenticate(client, settings, owner)
    ok(_finite(client), 201)
    token = ok(_preview(client), 200)["preview_token"]
    for confirm in (False, None, "yes", 1):
        response = client.post(f"{POLICY}/apply", json={
            "preview_token": token, "confirm": confirm, "timezone": KYIV,
            "idempotency_key": key()})
        assert response.status_code == 422, confirm
    missing = client.post(f"{POLICY}/apply", json={
        "preview_token": token, "timezone": KYIV, "idempotency_key": key()})
    assert missing.status_code == 422
    assert client.post(f"{POLICY}/apply", json={
        "preview_token": "not-a-token", "confirm": True, "timezone": KYIV,
        "idempotency_key": key()}).status_code == 422


def test_policy_and_apply_work_with_recording_disabled(
    app, client, settings, account_factory
):
    """Retention is a privacy control: a user can always reduce what is kept."""
    owner = account_factory("ret-gate@example.com")
    authenticate(client, settings, owner)
    measurement(client, occurred_at=f"{OLD.isoformat()}T09:00:00+00:00")
    app.state.settings = settings.model_copy(update={"aa_write_enabled": False})
    ok(_finite(client), 201)
    preview = ok(_preview(client), 200)
    assert preview["table_counts"]["aa_measurements"] == 1
    run = ok(_apply(client, preview["preview_token"]), 201)
    assert run["status"] == "completed" and run["total_deleted"] == 1


def test_unlimited_preview_and_apply_are_refused(client, settings, account_factory):
    owner = account_factory("ret-unlimited@example.com")
    authenticate(client, settings, owner)
    assert _preview(client).status_code == 409
    assert _apply(client, "a" * 64).json()["code"] == "retention_policy_not_finite"


# ───────────────────────────── end to end + F6 ─────────────────────────────


def test_r8_61_62_63_64_legacy_import_never_resurrects_erased_history(
    client, settings, account_factory, session_factory
):
    owner = account_factory("ret-f6@example.com")
    authenticate(client, settings, owner)
    _snapshot(session_factory, owner.user_id, [
        {"id": "legacy-old", "amount": 321.5, "date": OLD.isoformat(), "category_id": "food"},
        {"id": "legacy-new", "amount": 12.0, "date": RECENT.isoformat(), "category_id": "food"},
    ])
    old_period = f"{OLD.year:04d}-{OLD.month:02d}"
    old_claim = {"source_id": "bank", "period": old_period,
                 "window_start": OLD.replace(day=1).isoformat(),
                 "window_end": OLD.replace(day=28).isoformat(),
                 "coverage_state": "complete", "completeness_known": True}
    first = _import(client, [old_claim])
    assert first["transactions_imported"] == 2 and first["coverage_imported"] == 1

    ok(_finite(client, 24), 201)
    preview = ok(_preview(client), 200)
    assert preview["table_counts"]["aa_measurements"] == 1
    assert preview["table_counts"]["aa_source_coverage"] == 1
    run = ok(_apply(client, preview["preview_token"]), 201)
    assert run["status"] == "completed"

    again = _import(client, [old_claim])
    assert again["transactions_retention_skipped"] == 1
    assert again["transactions_imported"] == 0 and again["transactions_replayed"] == 1
    assert again["coverage_retention_skipped"] == 1 and again["coverage_imported"] == 0
    # Back to Unlimited: the applied horizon still guards reconstruction.
    ok(client.put(POLICY, json={"mode": "unlimited", "idempotency_key": key()}), 201)
    third = _import(client, [old_claim])
    assert third["transactions_retention_skipped"] == 1 and third["coverage_imported"] == 0
    with session_factory() as db:
        subjects = sorted(db.scalars(select(AAMeasurement.subject_id).where(
            AAMeasurement.user_id == owner.user_id)))
    assert subjects == ["legacy-new"]
    # R8-64: an explicit, user-entered fact with an old date is still accepted…
    late = measurement(client, occurred_at=f"{OLD.isoformat()}T09:00:00+00:00")
    assert late["id"]
    # …and the old month stays disclosed as truncated.
    month = ok(client.get(f"/api/v1/aa/finance/months/{old_period}"), 200)
    assert month["availability"] == "retention_truncated" and month["actual"] is None


def test_r8_11_http_apply_replay_and_run_summary(client, settings, account_factory):
    owner = account_factory("ret-api-replay@example.com")
    authenticate(client, settings, owner)
    measurement(client, occurred_at=f"{OLD.isoformat()}T09:00:00+00:00")
    ok(_finite(client), 201)
    token = ok(_preview(client), 200)["preview_token"]
    body = {"preview_token": token, "confirm": True, "timezone": KYIV,
            "idempotency_key": "apply-http-0001"}
    created = client.post(f"{POLICY}/apply", json=body)
    assert created.status_code == 201 and created.json()["replayed"] is False
    replay = client.post(f"{POLICY}/apply", json=body)
    assert replay.status_code == 200 and replay.json()["id"] == created.json()["id"]
    state = ok(client.get(POLICY), 200)
    assert state["latest_run"]["id"] == created.json()["id"]
    assert state["latest_run"]["total_deleted"] == 1
    assert len(state["runs"]) == 1
    assert state["effective_horizon"]["date"] == created.json()["target_horizon_date"]
    # The stale path over HTTP: a new old fact after the preview.
    measurement(client, occurred_at=f"{OLD.isoformat()}T10:00:00+00:00")
    stale = _apply(client, token)
    assert stale.status_code == 409 and stale.json()["code"] == "retention_preview_stale"


def test_r8_53_57_56_isolation_export_and_account_deletion(
    client, settings, account_factory, session_factory, engine
):
    owner = account_factory("ret-privacy@example.com")
    other = account_factory("ret-privacy-other@example.com")
    authenticate(client, settings, other)
    measurement(client, occurred_at=f"{OLD.isoformat()}T09:00:00+00:00")
    authenticate(client, settings, owner)
    measurement(client, occurred_at=f"{OLD.isoformat()}T09:00:00+00:00")
    ok(_finite(client), 201)
    ok(_apply(client, ok(_preview(client), 200)["preview_token"]), 201)
    assert counts(engine, other.user_id)["aa_measurements"] == 1

    response = client.get("/api/v1/export")
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        policies = archive.read("aa_retention_policies.ndjson").decode().splitlines()
        runs = archive.read("aa_retention_runs.ndjson").decode().splitlines()
    assert manifest["alembic_revision"] == "20261001_0011"
    assert manifest["snapshot_schema_version"] == 2
    assert len(policies) == 1 and len(runs) == 1
    assert json.loads(runs[0])["status"] == "completed"

    erased = client.request("DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"})
    assert erased.status_code == 204
    with session_factory() as db:
        for model in (AARetentionPolicy, AARetentionRun):
            assert db.scalars(select(model).where(model.user_id == owner.user_id)).all() == []


def test_r8_65_activity_log_cleanup_changes_no_aa_rows(
    client, settings, account_factory, engine
):
    owner = account_factory("ret-activity@example.com")
    authenticate(client, settings, owner)
    measurement(client, occurred_at=f"{OLD.isoformat()}T09:00:00+00:00")
    ok(client.put("/api/v1/state", json={"expected_revision": 0, "schema_version": 2,
                                         "payload": {"version": 2, "activityLog": [
                                             {"timestamp": "2020-01-01T00:00:00Z"},
                                             {"timestamp": RECENT.isoformat()}]}}), 201)
    before = counts(engine, owner.user_id)
    # The client's «Очистить историю» trims activityLog and saves the snapshot.
    ok(client.put("/api/v1/state", json={"expected_revision": 1, "schema_version": 2,
                                         "payload": {"version": 2, "activityLog": [
                                             {"timestamp": RECENT.isoformat()}]}}), 200)
    assert counts(engine, owner.user_id) == before


def test_r8_67_no_activity_log_path_into_adaptive_analytics():
    root = Path(__file__).parents[1] / "app"
    offenders = []
    for path in root.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        for line in source.splitlines():
            if re.search(r"activity_?log", line, re.IGNORECASE):
                offenders.append(f"{path.relative_to(root)}: {line.strip()}")
    # The only mention is the schema's pinned zero counter.
    assert offenders == ["schemas/aa_finance.py: activity_log_imported: Literal[0] = 0"]


def test_retention_never_writes_per_fact_receipts_or_uses_tombstones():
    """Static guard (pre-push audit): the retention engine never calls the single-fact
    ``delete_fact``, never tombstones and never writes ``aa_deletion_receipts``."""
    package = Path(__file__).parents[1] / "app" / "services" / "retention"
    source = "\n".join(path.read_text(encoding="utf-8") for path in package.glob("*.py"))
    assert "delete_fact" not in source
    assert "AADeletionReceipt" not in source and "aa_deletion_receipts" not in source
    assert "tombstoned'" not in source.replace("t.tombstoned_at", "")
    # No generic storage-time age axis anywhere in executable code.
    assert not re.search(r"\.created_at|created_at\s*[<>]", source)
    # Every destructive statement is account-scoped.
    for statement in re.findall(r"(DELETE FROM[^\"]+|UPDATE \{table\}[^\"]+)", source):
        assert "user_id" in statement or "{table}" in statement, statement
