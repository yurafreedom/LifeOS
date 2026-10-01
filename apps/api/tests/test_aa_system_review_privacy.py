"""Slice 7 · privacy: account export/deletion and D1 redaction (S7-16, 17, 38, 39, 44)."""

import io
import json
import zipfile
from uuid import UUID

import pytest
from sqlalchemy import func, select, text

from app.models import AACrossReference, AAImportanceRating, AASystemReviewRevision
from tests.aa_helpers import authenticate
from tests.aa_system_review_helpers import (
    BASE,
    M7_TABLES,
    SEPTEMBER,
    expense_context,
    key,
    obligation,
    observation,
    ok,
    respond,
    review,
    save,
    sr_clock,  # noqa: F401  (fixture, applied module-wide)
    transaction,
)

pytestmark = pytest.mark.usefixtures("sr_clock")


def _owner(client, settings, account_factory, email="sr-privacy@example.com"):
    owner = account_factory(email)
    authenticate(client, settings, owner)
    return owner


def _populate(client):
    """One row (or more) in every Slice 7 table, superseded versions included."""
    t1 = transaction(client, "t1", "180.00")
    debt = obligation(client)
    obligation(client, entity_id=None)  # a second obligation entity
    expense = expense_context(client, "t1", plannedness="unplanned", funding_source="credit",
                              obligation_entity_id=debt["entity_id"],
                              emotional_context="очень личная заметка")
    ok(client.post(f"{BASE}/finance-contexts", json={
        "entity_id": expense["entity_id"], "kind": "expense_context",
        "subject_key": "finance:transaction:t1",
        "payload": {"plannedness": "unplanned", "funding_source": "credit",
                    "obligation_entity_id": debt["entity_id"],
                    "emotional_context": "очень личная заметка", "worth_it": "no"},
        "idempotency_key": key()}), 201)
    pending = review(client)["sections"]["requires_confirmation"]["items"]
    relation = ok(respond(client, next(p for p in pending
                                       if p["family"] == "finance_credit_obligation"),
                          "approved", note="да, это эта карта"), 201)
    target_key = f"relation|{relation['id']}"
    for importance in ("matters", "ok"):
        ok(client.post(f"{BASE}/importance", json={
            "target_key": target_key, "importance": importance, "idempotency_key": key()}), 201)
    ok(save(client, finalize=True, reflection="Я понимаю, откуда это"), 201)
    return {"transaction": t1, "debt": debt, "expense": expense, "relation": relation}


def _read_zip(response):
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        tables = {name: [json.loads(line) for line in archive.read(info["file"]).splitlines()]
                  for name, info in manifest["tables"].items()}
    return manifest, tables


def test_s7_38_44_account_export_carries_every_slice_7_row(
    client, settings, account_factory
):
    _owner(client, settings, account_factory)
    _populate(client)
    manifest, tables = _read_zip(client.get("/api/v1/export"))
    assert manifest["alembic_revision"] == "20261001_0011"
    assert set(M7_TABLES) <= set(manifest["aa_columns"])
    assert {row["status"] for row in tables["aa_importance_ratings"]} == {"active", "superseded"}
    assert {row["status"] for row in tables["aa_finance_contexts"]} == {"active", "superseded"}
    assert len(tables["aa_cross_references"]) == 1
    assert len(tables["aa_relation_feedback"]) == 1
    revision = tables["aa_system_review_revisions"][0]
    assert revision["reflection"] == "Я понимаю, откуда это"
    assert revision["frozen_context"]["manifest_version"] == 1
    for name in M7_TABLES:
        assert manifest["tables"][name]["rows"] == len(tables[name])


def test_s7_39_account_deletion_leaves_no_slice_7_row(
    client, settings, account_factory, engine
):
    owner = _owner(client, settings, account_factory)
    _populate(client)
    response = client.request("DELETE", "/api/v1/account",
                              json={"confirmation": "DELETE_ACCOUNT"})
    assert response.status_code == 204
    with engine.begin() as connection:
        for name in M7_TABLES:
            assert connection.scalar(
                text(f"SELECT count(*) FROM {name} WHERE user_id = :u"), {"u": owner.user_id}
            ) == 0, name


def test_s7_16_17_hard_deleted_source_is_redacted_and_reflection_survives(
    client, settings, account_factory, session_factory
):
    _owner(client, settings, account_factory)
    doomed = transaction(client, "t9", "987654.32", "2026-09-20")
    transaction(client, "t1", "100.00")
    ok(save(client, finalize=True, reflection="Мой вывод остаётся"), 201)
    with session_factory() as db:
        before = db.scalar(select(AASystemReviewRevision))
        assert UUID(doomed["id"]) in before.source_ids
    deleted = client.delete(f"/api/v1/aa/facts/aa_measurements/{doomed['id']}?mode=hard")
    assert deleted.status_code == 200, deleted.text
    saved = ok(client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions/1"), 200)
    assert saved["reflection"] == "Мой вывод остаётся"
    assert saved["redacted_at"] is not None
    changed = saved["frozen"]["sections"]["changed"]
    redacted = [item for item in changed if item.get("redacted")]
    assert redacted and all(item["redaction_reason"] == "source_hard_deleted"
                            for item in redacted)
    assert "987654" not in json.dumps(saved)
    with session_factory() as db:
        after = db.scalar(select(AASystemReviewRevision))
        assert UUID(doomed["id"]) not in after.source_ids
        assert "987654" not in json.dumps(after.frozen_context)
        assert doomed["id"] not in json.dumps(after.frozen_context)
    export = client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions/1/export",
                        params={"format": "md"})
    assert "источник удалён" in export.text and "987654" not in export.text


def test_deleting_a_finance_context_redacts_everything_derived_from_it(
    client, settings, account_factory, session_factory
):
    _owner(client, settings, account_factory)
    created = _populate(client)
    expense = created["expense"]
    response = ok(client.post(f"{BASE}/finance-contexts/{expense['entity_id']}/delete",
                              json={"idempotency_key": key()}), 200)
    assert response["replayed"] is False
    again = ok(client.post(f"{BASE}/finance-contexts/{expense['entity_id']}/delete",
                           json={"idempotency_key": key()}), 200)
    assert again["replayed"] is True
    saved = ok(client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions/1"), 200)
    assert "очень личная заметка" not in json.dumps(saved)
    assert saved["reflection"] == "Я понимаю, откуда это"
    # The obligation is still there; deleting it redacts the relation's endpoint.
    ok(client.post(f"{BASE}/finance-contexts/{created['debt']['entity_id']}/delete",
                   json={"idempotency_key": key()}), 200)
    with session_factory() as db:
        relation = db.scalar(select(AACrossReference))
        assert relation.to_key == "redacted" and relation.endpoint_redacted_at is not None
        assert relation.note == "да, это эта карта" and relation.status == "approved"
        assert created["debt"]["entity_id"] not in json.dumps(relation.evidence)
        assert db.scalar(select(func.count()).select_from(AAImportanceRating)) == 2


def test_observation_hard_delete_redacts_relation_endpoint_and_importance(
    client, settings, account_factory, session_factory
):
    _owner(client, settings, account_factory)
    transaction(client, "t1", "180.00")
    seen = observation(client, "ссора", "2026-09-10")
    fact_key = f"fact|aa_observations|{seen['id']}"
    ok(client.post(f"{BASE}/relations", json={
        "id": "33333333-3333-4333-8333-333333333333", "from_key": fact_key,
        "to_key": "subject|finance:transaction:t1", "idempotency_key": key()}), 201)
    ok(client.post(f"{BASE}/importance", json={
        "target_key": fact_key, "importance": "matters", "idempotency_key": key()}), 201)
    deleted = client.delete(f"/api/v1/aa/facts/aa_observations/{seen['id']}?mode=hard")
    assert deleted.status_code == 200, deleted.text
    with session_factory() as db:
        relation = db.scalar(select(AACrossReference))
        assert "redacted" in (relation.from_key, relation.to_key)
        assert seen["id"] not in relation.from_key + relation.to_key
        assert db.scalar(select(func.count()).select_from(AAImportanceRating)) == 0
    listed = ok(client.get(f"{BASE}/relations"), 200)["relations"][0]
    assert listed["endpoint_redacted"] is True


def test_sensitive_text_never_reaches_relations_or_evidence(
    client, settings, account_factory, session_factory
):
    _owner(client, settings, account_factory)
    _populate(client)
    with session_factory() as db:
        rows = db.scalars(select(AACrossReference)).all()
        dumped = json.dumps([[r.from_key, r.to_key, r.evidence, r.note] for r in rows],
                            ensure_ascii=False)
    assert "очень личная заметка" not in dumped
