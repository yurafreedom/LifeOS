"""T-15 and D1 privacy: erasure, receipts, cascades, redaction, isolation."""

import json
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select

from app.models import AADeletionReceipt, AAMeasurement, AASourceCoverage, Base, UserSnapshot
from app.services import aa_deletion
from app.services.aa_coverage_claims import record_coverage_claim, supersede_coverage_claim
from tests.aa_helpers import authenticate, correction_payload, measurement_payload
from tests.test_aa_coverage import claim_request
from tests.test_export import read_export


def record(client, **overrides):
    response = client.post("/api/v1/aa/measurements", json=measurement_payload(**overrides))
    assert response.status_code == 201
    return response.json()


def erase(client, fact, mode="hard", table="aa_measurements"):
    return client.delete(f"/api/v1/aa/facts/{table}/{fact['id']}?mode={mode}")


def test_hard_delete_receipt_contains_metadata_only_and_residue_scan(
    client, settings, account_factory, session_factory, monkeypatch, caplog
):
    caplog.set_level("INFO")
    owner = account_factory("erase-owner@example.com")
    other = account_factory("erase-other@example.com")
    authenticate(client, settings, owner)
    marker = "private-erasure-marker-93817"
    fact = record(
        client,
        dimensions={"secret": marker},
        provenance={
            "source_kind": "USER_REPORTED",
            "basis": marker,
            "method": marker,
            "source_ref": {"content": marker},
        },
    )
    dependent = record(
        client,
        idempotency_key="dependent",
        provenance={
            "source_kind": "DERIVED",
            "basis": marker,
            "method": marker,
            "source_ref": {"nested": [{"id": fact["id"]}], "content": marker},
        },
    )
    uri_dependent = record(
        client,
        idempotency_key="uri-dependent",
        provenance={
            "source_kind": "DERIVED",
            "source_ref": {"uri": f"aa_measurements:{fact['id']}"},
        },
    )
    with session_factory() as db:
        coverage, _ = record_coverage_claim(
            db,
            user_id=owner.user_id,
            request=claim_request(
                source_ref={"fact": fact["id"], "content": marker}, basis=marker, method=marker
            ),
        )
        unrelated, _ = record_coverage_claim(
            db, user_id=other.user_id, request=claim_request(source_ref={"fact": fact["id"]})
        )
    calls = []
    monkeypatch.setattr(
        aa_deletion,
        "SOURCE_REDACTORS",
        (lambda db, user, table, id: calls.append((user, table, id)),),
    )
    response = erase(client, fact)
    assert response.status_code == 200
    assert calls == [(owner.user_id, "aa_measurements", UUID(fact["id"]))]
    with session_factory() as db:
        assert db.get(AAMeasurement, UUID(fact["id"])) is None
        assert db.get(AAMeasurement, UUID(dependent["id"])).source_ref is None
        assert db.get(AAMeasurement, UUID(uri_dependent["id"])).source_ref is None
        assert db.get(AASourceCoverage, coverage.id).source_ref is None
        assert db.get(AASourceCoverage, unrelated.id).source_ref == {"fact": fact["id"]}
        receipt = db.scalar(select(AADeletionReceipt))
        assert receipt.fact_id == UUID(fact["id"])
        assert set(AADeletionReceipt.__table__.columns.keys()) == {
            "id",
            "user_id",
            "table_name",
            "fact_id",
            "deleted_at",
        }
        for table in Base.metadata.tables.values():
            if table.name.startswith("aa_") and "user_id" in table.c:
                rows = db.execute(select(table).where(table.c.user_id == owner.user_id)).mappings()
                assert marker not in json.dumps([dict(row) for row in rows], default=str)
    _, tables = read_export(client.get("/api/v1/export"))
    assert marker not in json.dumps(tables)
    assert marker not in json.dumps([vars(record) for record in caplog.records], default=str)
    assert erase(client, fact).status_code == 404


def test_redaction_adapter_failure_rolls_back_all_erasure(
    client, settings, account_factory, session_factory, monkeypatch
):
    owner = account_factory("hook-rollback@example.com")
    authenticate(client, settings, owner)
    fact = record(client)

    def fail(*args):
        raise RuntimeError("redaction failed")

    monkeypatch.setattr(aa_deletion, "SOURCE_REDACTORS", (fail,))
    with session_factory() as db:
        with pytest.raises(RuntimeError, match="redaction failed"):
            aa_deletion.delete_fact(
                db,
                user_id=owner.user_id,
                table_name="aa_measurements",
                fact_id=UUID(fact["id"]),
                mode="hard",
            )
        assert db.get(AAMeasurement, UUID(fact["id"])) is not None
        assert db.scalar(select(func.count()).select_from(AADeletionReceipt)) == 0


def test_tombstone_clears_value_keeps_existence_and_retry_cannot_restore(
    client, settings, account_factory, session_factory
):
    owner = account_factory("tombstone-owner@example.com")
    authenticate(client, settings, owner)
    fact = record(client, dimensions={"private": "secret"})
    assert erase(client, fact, "tombstone").status_code == 200
    first = erase(client, fact, "tombstone").json()
    assert erase(client, fact, "tombstone").json() == first
    replay = client.post("/api/v1/aa/measurements", json=measurement_payload())
    assert replay.status_code == 200 and replay.json()["status"] == "tombstoned"
    assert replay.json()["value"]["num"] is None
    with session_factory() as db:
        row = db.get(AAMeasurement, UUID(fact["id"]))
        assert row.recorded_at.isoformat() == fact["provenance"]["recorded_at"]
        assert row.source_kind == fact["provenance"]["source_kind"]
        assert row.tombstoned_at is not None
        assert all(
            getattr(row, key) is None
            for key in (
                "unit_code",
                "value_num",
                "value_text",
                "value_date",
                "scale_min",
                "scale_max",
                "dimensions",
                "basis",
                "method",
                "source_ref",
                "supersede_reason",
            )
        )
        assert db.scalar(select(func.count()).select_from(AADeletionReceipt)) == 0
    assert erase(client, fact).status_code == 200


@pytest.mark.parametrize("mode", ["hard", "tombstone"])
@pytest.mark.parametrize("table", ["aa_measurements", "aa_source_coverage"])
def test_cross_account_delete_is_identical_to_missing(
    client, settings, account_factory, session_factory, mode, table
):
    owner = account_factory("delete-a@example.com")
    other = account_factory("delete-b@example.com")
    authenticate(client, settings, owner)
    if table == "aa_measurements":
        fact = record(client)
    else:
        with session_factory() as db:
            row, _ = record_coverage_claim(db, user_id=owner.user_id, request=claim_request())
            fact = {"id": str(row.id)}
    authenticate(client, settings, other)
    foreign = erase(client, fact, mode, table)
    missing = erase(client, {"id": str(uuid4())}, mode, table)
    assert foreign.status_code == missing.status_code == 404
    assert (
        foreign.json() == missing.json() == {"code": "fact_not_found", "message": "Fact not found."}
    )
    with session_factory() as db:
        assert db.get(aa_deletion.FACT_TABLES[table], UUID(fact["id"])) is not None


@pytest.mark.parametrize(
    "table", ["aa_metric_definitions", "aa_deletion_receipts", "users", "nonsense"]
)
def test_table_whitelist_does_not_expose_reference_or_account_tables(
    client, settings, account_factory, table
):
    authenticate(client, settings, account_factory("whitelist@example.com"))
    assert erase(client, {"id": str(uuid4())}, table=table).status_code == 404


def test_correction_chain_hard_delete_blocked_tombstone_preserves_links(
    client, settings, account_factory, session_factory
):
    authenticate(client, settings, account_factory("chain@example.com"))
    original = record(client)
    successor = client.post(
        f"/api/v1/aa/measurements/{original['id']}/correct", json=correction_payload()
    ).json()["measurement"]
    for fact in (original, successor):
        response = erase(client, fact)
        assert response.status_code == 409
        assert response.json()["code"] == "fact_deletion_conflict"
        assert erase(client, fact, "tombstone").status_code == 200
    with session_factory() as db:
        assert db.get(AAMeasurement, UUID(original["id"])).superseded_by_id == UUID(successor["id"])
        assert db.get(AAMeasurement, UUID(successor["id"])).supersedes_id == UUID(original["id"])


@pytest.mark.parametrize("mode", ["hard", "tombstone"])
def test_coverage_erasure(client, settings, account_factory, session_factory, mode):
    owner = account_factory("coverage-erasure@example.com")
    authenticate(client, settings, owner)
    with session_factory() as db:
        row, _ = record_coverage_claim(db, user_id=owner.user_id, request=claim_request())
    assert erase(client, {"id": str(row.id)}, mode, "aa_source_coverage").status_code == 200
    with session_factory() as db:
        erased = db.get(AASourceCoverage, row.id)
        if mode == "hard":
            assert erased is None
            assert db.scalar(select(AADeletionReceipt)).table_name == "aa_source_coverage"
        else:
            assert erased.status == "tombstoned"
            assert (
                erased.source_id is erased.coverage_state is erased.basis is erased.method is None
            )
            assert not erased.completeness_known


def test_account_cascade_every_aa_table_snapshot_sessions_and_chain(
    client, settings, account_factory, session_factory
):
    owner = account_factory("account-erase@example.com")
    other = account_factory("account-survivor@example.com")
    authenticate(client, settings, owner)
    original = record(client)
    client.post(f"/api/v1/aa/measurements/{original['id']}/correct", json=correction_payload())
    receipt_fact = record(client, idempotency_key="idem-receipt")
    assert erase(client, receipt_fact).status_code == 200
    tombstone = record(client, idempotency_key="tombstone")
    erase(client, tombstone, "tombstone")
    with session_factory() as db:
        coverage, _ = record_coverage_claim(db, user_id=owner.user_id, request=claim_request())
        supersede_coverage_claim(
            db,
            user_id=owner.user_id,
            claim_id=coverage.id,
            request=claim_request(idempotency_key="coverage-correction"),
        )
        db.add(UserSnapshot(user_id=owner.user_id, schema_version=2, revision=1, payload={}))
        db.commit()
    authenticate(client, settings, other)
    survivor = record(client)
    authenticate(client, settings, owner)
    response = client.request("DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"})
    assert response.status_code == 204 and response.content == b""
    assert settings.cookie_name in response.headers["set-cookie"]
    with session_factory() as db:
        for table in Base.metadata.tables.values():
            if "user_id" in table.c:
                assert (
                    db.scalar(
                        select(func.count())
                        .select_from(table)
                        .where(table.c.user_id == owner.user_id)
                    )
                    == 0
                )
        assert db.get(AAMeasurement, UUID(survivor["id"])) is not None
    assert client.get("/api/v1/export").status_code == 401


def test_privacy_routes_work_with_recording_gate_closed(client, settings, account_factory, app):
    authenticate(client, settings, account_factory("gate-privacy@example.com"))
    fact = record(client)
    app.state.settings = settings.model_copy(update={"aa_write_enabled": False})
    assert client.post("/api/v1/aa/measurements", json=measurement_payload()).status_code == 403
    assert client.get("/api/v1/export").status_code == 200
    assert erase(client, fact).status_code == 200
    assert (
        client.request(
            "DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"}
        ).status_code
        == 204
    )


def test_delete_security_origin_confirmation_content_type_auth(client, settings, account_factory):
    assert erase(client, {"id": str(uuid4())}).status_code == 401
    assert (
        client.request(
            "DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"}
        ).status_code
        == 401
    )
    authenticate(client, settings, account_factory("security-privacy@example.com"))
    fact = record(client)
    assert (
        client.delete(
            f"/api/v1/aa/facts/aa_measurements/{fact['id']}?mode=hard",
            headers={"Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    assert (
        client.request(
            "DELETE",
            "/api/v1/account",
            json={"confirmation": "DELETE_ACCOUNT"},
            headers={"Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    assert (
        client.request(
            "DELETE", "/api/v1/account", content="{}", headers={"Content-Type": "text/plain"}
        ).status_code
        == 415
    )
    for body in (
        {},
        {"confirmation": "wrong"},
        {"confirmation": "DELETE_ACCOUNT", "user_id": str(uuid4())},
    ):
        assert client.request("DELETE", "/api/v1/account", json=body).status_code == 422
    assert (
        client.delete(f"/api/v1/aa/facts/aa_measurements/{fact['id']}?mode=redact").status_code
        == 422
    )
