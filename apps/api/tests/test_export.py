"""T-14: complete, isolated, interpretable, bounded-memory account export."""

import io
import json
import zipfile
from uuid import UUID

import pytest
from sqlalchemy import Column, Table, Text, text

from app.models import Base, UserSnapshot
from app.services.aa_coverage_claims import record_coverage_claim
from app.services.export import (
    EXPORT_TABLES,
    build_account_export,
    stream_archive,
    validate_export_registry,
)
from tests.aa_helpers import authenticate, correction_payload, measurement_payload
from tests.test_aa_coverage import claim_request


def read_export(response):
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.headers["cache-control"] == "no-store"
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        tables = {
            name: [json.loads(line) for line in archive.read(info["file"]).splitlines()]
            for name, info in manifest["tables"].items()
        }
    return manifest, tables


def test_export_all_statuses_chains_snapshot_receipts_and_coverage(
    client, settings, account_factory, session_factory
):
    owner = account_factory("export-owner@example.com")
    authenticate(client, settings, owner)
    original = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    corrected = client.post(
        f"/api/v1/aa/measurements/{original['id']}/correct", json=correction_payload()
    ).json()["measurement"]
    erased = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(
            idempotency_key="idem-erase",
            value={"type": "money", "num": "987654.123456", "unit_code": "UAH"},
        ),
    ).json()
    client.delete(f"/api/v1/aa/facts/aa_measurements/{erased['id']}?mode=hard")
    tombstone = client.post(
        "/api/v1/aa/measurements", json=measurement_payload(idempotency_key="tombstone")
    ).json()
    client.delete(f"/api/v1/aa/facts/aa_measurements/{tombstone['id']}?mode=tombstone")
    with session_factory() as db:
        record_coverage_claim(db, user_id=owner.user_id, request=claim_request())
        db.add(
            UserSnapshot(
                user_id=owner.user_id,
                schema_version=2,
                revision=3,
                payload={"schemaVersion": 2, "private": "current snapshot"},
            )
        )
        db.commit()
    response = client.get("/api/v1/export")
    manifest, tables = read_export(response)
    assert set(EXPORT_TABLES) <= tables.keys()
    assert manifest["alembic_revision"] == "20260909_0003"
    assert manifest["snapshot_schema_version"] == 2
    assert tables["user_snapshots"][0]["revision"] == 3
    assert tables["user_snapshots"][0]["payload"]["private"] == "current snapshot"
    rows = {row["id"]: row for row in tables["aa_measurements"]}
    assert rows[original["id"]]["status"] == "superseded"
    assert rows[original["id"]]["superseded_by_id"] == corrected["id"]
    assert rows[corrected["id"]]["supersedes_id"] == original["id"]
    assert rows[corrected["id"]]["value_num"] == "120.000000"
    assert rows[tombstone["id"]]["status"] == "tombstoned"
    assert rows[tombstone["id"]]["value_num"] is None
    assert erased["id"] not in rows
    assert len(tables["aa_source_coverage"]) == 1
    assert len(tables["aa_deletion_receipts"]) == 1
    assert tables["aa_deletion_receipts"][0]["fact_id"] == erased["id"]
    assert "987654.123456" not in json.dumps(tables)
    for name, entries in tables.items():
        assert manifest["tables"][name]["rows"] == len(entries)
    assert set(manifest["aa_columns"]) == set(EXPORT_TABLES)


def test_export_is_account_isolated_and_excludes_auth_secrets(
    client, settings, account_factory, session_factory
):
    owner = account_factory("export-a@example.com")
    other = account_factory("export-b@example.com")
    authenticate(client, settings, other)
    client.post("/api/v1/aa/measurements", json=measurement_payload())
    with session_factory.begin() as db:
        db.add(
            UserSnapshot(
                user_id=other.user_id,
                schema_version=2,
                revision=1,
                payload={"other-secret": "do not export"},
            )
        )
    authenticate(client, settings, owner)
    manifest, tables = read_export(client.get("/api/v1/export"))
    content = json.dumps(tables)
    assert manifest["user_id"] == str(owner.user_id)
    assert str(other.user_id) not in content
    assert other.email not in content
    assert "other-secret" not in content
    assert "password_hash" not in content and "token_hash" not in content
    assert owner.raw_token not in content
    assert tables["aa_measurements"] == []
    assert len(tables["sessions"]) == 1


def test_export_requires_authentication(client):
    assert client.get("/api/v1/export").status_code == 401


def test_registry_rejects_future_unregistered_table():
    future = Table("aa_future_export_test", Base.metadata, Column("id", Text, primary_key=True))
    try:
        with pytest.raises(RuntimeError, match="registry"):
            validate_export_registry()
    finally:
        Base.metadata.remove(future)
    validate_export_registry()


def test_registry_rejects_wrong_table_binding(monkeypatch):
    monkeypatch.setitem(EXPORT_TABLES, "aa_measurements", Base.metadata.tables["users"])
    with pytest.raises(RuntimeError, match="mismatch"):
        validate_export_registry()


def test_stream_is_chunk_bounded_and_closes_on_disconnect():
    archive = io.BytesIO(b"x" * 200000)
    generator = stream_archive(archive)
    assert len(next(generator)) == 64 * 1024
    generator.close()
    assert archive.closed


def test_export_file_is_disk_backed_and_closed_after_stream(session_factory, account_factory):
    owner = account_factory("file-export@example.com")
    archive = build_account_export(session_factory, user_id=owner.user_id)
    assert archive.fileno() >= 0
    chunks = list(stream_archive(archive))
    assert archive.closed
    assert all(len(chunk) <= 64 * 1024 for chunk in chunks)
    with zipfile.ZipFile(io.BytesIO(b"".join(chunks))) as exported:
        assert "aa_deletion_receipts.ndjson" in exported.namelist()


def test_export_failure_closes_temporary_file(monkeypatch, session_factory, account_factory):
    from app.services import export

    owner = account_factory("failed-export@example.com")
    file = io.BytesIO()
    monkeypatch.setattr(export.tempfile, "TemporaryFile", lambda **kwargs: file)

    def fail(_value):
        raise RuntimeError("serialization failure")

    monkeypatch.setattr(export, "encode_json", fail)
    with pytest.raises(RuntimeError, match="serialization"):
        build_account_export(session_factory, user_id=owner.user_id)
    assert file.closed


def test_export_registry_detects_an_unmapped_database_table(
    engine, session_factory, account_factory
):
    owner = account_factory("database-guard@example.com")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE aa_export_guard_test (id integer PRIMARY KEY)"))
    try:
        with pytest.raises(RuntimeError, match="database AA schema"):
            build_account_export(session_factory, user_id=owner.user_id)
    finally:
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE aa_export_guard_test"))


def test_export_multiple_history_batches_without_truncation(
    client, settings, session_factory, account_factory
):
    from app.models import AAMeasurement

    owner = account_factory("batched-export@example.com")
    authenticate(client, settings, owner)
    seed = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    with session_factory.begin() as db:
        row = db.get(AAMeasurement, UUID(seed["id"]))
        values = {
            c.name: getattr(row, c.name)
            for c in AAMeasurement.__table__.c
            if c.name not in {"id", "subject_key", "created_at", "recorded_at"}
        }
        for i in range(405):
            db.add(AAMeasurement(**{**values, "idempotency_key": f"idem-batched-{i}"}))
    _, tables = read_export(client.get("/api/v1/export"))
    assert len(tables["aa_measurements"]) == 406
    assert len({r["id"] for r in tables["aa_measurements"]}) == 406
