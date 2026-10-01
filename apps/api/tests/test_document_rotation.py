"""S2 checkpoint 4: wrapping-key rotation, interruption, rerun and verification."""

from __future__ import annotations

import io
import os
import zipfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from alembic import command
from app import cli
from app.main import create_app
from app.models import Document, DocumentBlob, DocumentVersion
from app.services.documents.rotation import records_using_key, rewrap_all, verify
from tests.aa_helpers import authenticate
from tests.document_helpers import (
    extend_keyring,
    make_jpeg,
    make_keyring,
    make_pdf,
    make_png,
    upload,
    upload_version,
    without_key,
)


def _client(settings, session_factory, mail, keyring):
    app = create_app(settings=settings, session_factory=session_factory, mail=mail, keyring=keyring)
    return TestClient(app, headers={"Origin": "http://testserver"})


@pytest.fixture
def doc_settings(settings):
    return settings.model_copy(update={"documents_enabled": True, "keyring_file": "/unused"})


@pytest.fixture
def seeded(doc_settings, session_factory, mail, account_factory):
    """Two accounts, five documents, seven versions — all under kek-old."""
    keyring = make_keyring("kek-old")
    originals: dict[str, list[bytes]] = {}
    with _client(doc_settings, session_factory, mail, keyring) as client:
        for email in ("rot-a@example.com", "rot-b@example.com"):
            account = account_factory(email)
            authenticate(client, doc_settings, account)
            contents = (make_pdf(), make_png(), make_jpeg())
            for index, content in enumerate(contents[: 3 if email.startswith("rot-a") else 2]):
                body = upload(client, content).json()
                originals[body["id"]] = [content]
                if index == 0:
                    second = make_png(rgb=(index, 9, 9))
                    upload_version(client, body["id"], second, expected_revision=1)
                    originals[body["id"]].append(second)
    return keyring, originals


def _blobs(session_factory) -> dict:
    with session_factory() as db:
        return {
            row.version_id: (bytes(row.content_nonce), bytes(row.content_ciphertext))
            for row in db.scalars(select(DocumentBlob))
        }


def _downloads(doc_settings, session_factory, mail, keyring, originals):
    with _client(doc_settings, session_factory, mail, keyring) as client:
        with session_factory() as db:
            owners = {str(d.id): d.user_id for d in db.scalars(select(Document))}
        for doc_id, versions in originals.items():
            client.cookies.set(doc_settings.cookie_name, _token(session_factory, owners[doc_id]))
            client.headers["X-LifeOS-Account"] = str(owners[doc_id])
            for number, content in enumerate(versions, start=1):
                response = client.get(f"/api/v1/documents/{doc_id}/versions/{number}/content")
                assert response.status_code == 200, response.text
                assert response.content == content


def _token(session_factory, user_id) -> str:
    with session_factory() as db:
        email = db.execute(text("SELECT email FROM users WHERE id = :id"), {"id": user_id}).scalar()
    return f"test-token-{email}"


def test_rotation_rewraps_keys_without_touching_ciphertext(
    seeded, doc_settings, session_factory, mail
):
    old_ring, originals = seeded
    before = _blobs(session_factory)
    report = verify(session_factory, old_ring, deep=True)
    assert report.complete and report.documents == 5 and report.versions == 7
    new_ring = extend_keyring(old_ring, "kek-new")
    pending = verify(session_factory, new_ring)
    assert not pending.complete and pending.on_other_keys == 12

    result = rewrap_all(session_factory, new_ring, batch_size=3)
    assert result.rewrapped == 12 and result.clean
    assert _blobs(session_factory) == before, "content ciphertext must not be rewritten"
    final = verify(session_factory, new_ring, deep=True)
    assert final.complete and dict(final.by_key) == {"kek-new": 12}
    assert records_using_key(session_factory, "kek-old") == 0

    # Old key retired from the running keyring: everything still decrypts.
    retired = without_key(new_ring, "kek-old", active="kek-new")
    _downloads(doc_settings, session_factory, mail, retired, originals)
    # Idempotent: a second pass does nothing.
    assert rewrap_all(session_factory, new_ring).rewrapped == 0


def test_interrupted_rotation_resumes_and_is_detected_until_complete(seeded, session_factory):
    old_ring, _ = seeded
    new_ring = extend_keyring(old_ring, "kek-new")
    partial = rewrap_all(session_factory, new_ring, batch_size=2, max_batches=2)
    assert 0 < partial.rewrapped < 12
    halfway = verify(session_factory, new_ring)
    assert not halfway.complete
    assert halfway.by_key["kek-old"] + halfway.by_key["kek-new"] == 12
    # Mixed state is fully readable with both keys present.
    assert not halfway.failures
    resumed = rewrap_all(session_factory, new_ring, batch_size=2)
    assert partial.rewrapped + resumed.rewrapped == 12
    assert verify(session_factory, new_ring, deep=True).complete


def test_concurrent_change_is_not_overwritten(seeded, doc_settings, session_factory, monkeypatch):
    """A metadata edit lands between unwrap and compare-and-swap: the stale
    re-wrap is refused (no lost edit) and the record is re-wrapped afresh."""
    old_ring, _ = seeded
    new_ring = extend_keyring(old_ring, "kek-new")
    from app.services.documents import rotation
    from app.services.documents.service import DocumentRuntime, get_document, update_metadata

    original = rotation.wrap_data_key
    raced: dict[str, object] = {}

    def wrap_and_race(keyring, data_key, context):
        wrapped = original(keyring, data_key, context)
        if not raced and context.purpose == "document.meta":
            document_id = dict(context.fields)["document"]
            # Another API process, still on the old active key, edits the title.
            with session_factory() as db:
                row = db.get(Document, document_id)
                raced["owner"], raced["id"] = row.user_id, row.id
                update_metadata(
                    db, DocumentRuntime(doc_settings, old_ring), row.user_id, row.id,
                    expected_revision=row.revision, title="Edited concurrently", notes=None,
                )
        return wrapped

    monkeypatch.setattr(rotation, "wrap_data_key", wrap_and_race)
    report = rewrap_all(session_factory, new_ring, batch_size=50)
    # The CAS refused the stale re-wrap; the edited record (re-sealed under the
    # old key by the other process) was picked up again by a later batch.
    assert report.skipped_concurrent == 1 and not report.failures
    assert verify(session_factory, new_ring, deep=True).complete
    monkeypatch.setattr(rotation, "wrap_data_key", original)
    assert rewrap_all(session_factory, new_ring).rewrapped == 0
    with session_factory() as db:
        view = get_document(db, DocumentRuntime(doc_settings, new_ring), raced["owner"], raced["id"])
    assert view.title == "Edited concurrently"


def test_missing_old_key_is_reported_not_skipped(seeded, session_factory):
    old_ring, _ = seeded
    lost = make_keyring("kek-new")  # kek-old was lost before rotation
    report = rewrap_all(session_factory, lost)
    assert report.rewrapped == 0 and len(report.failures) == 12
    verification = verify(session_factory, lost)
    assert not verification.complete and len(verification.failures) == 12


def test_cli_rotate_verify_and_retire(seeded, session_factory, tmp_path, monkeypatch,
                                      test_database_url, capsys):
    old_ring, _ = seeded
    path = tmp_path / "keyring.json"
    from app.crypto.keyring import serialize_keyring

    path.write_bytes(serialize_keyring([("kek-old", old_ring.material("kek-old"), None)], "kek-old"))
    path.chmod(0o600)
    monkeypatch.setenv("LIFEOS_DATABASE_URL", test_database_url)
    monkeypatch.setenv("LIFEOS_BOOTSTRAP_TOKEN", "x" * 40)
    monkeypatch.setenv("LIFEOS_KEYRING_FILE", str(path))
    from app.config import get_settings

    get_settings.cache_clear()
    try:
        assert cli.main(["keyring-add-key", str(path), "--key-id", "kek-new", "--activate"]) == 0
        assert cli.main(["keyring-retire-key", str(path), "--key-id", "kek-old",
                         "--confirm-no-backups-need-it"]) == 1  # still in use
        assert cli.main(["documents-verify"]) == 1
        assert cli.main(["documents-rotate", "--batch-size", "4"]) == 0
        assert cli.main(["documents-verify", "--deep"]) == 0
        assert cli.main(["keyring-retire-key", str(path), "--key-id", "kek-new",
                         "--confirm-no-backups-need-it"]) == 1  # active
        assert cli.main(["keyring-retire-key", str(path), "--key-id", "kek-old",
                         "--confirm-no-backups-need-it"]) == 0
        assert cli.main(["keyring-check", str(path)]) == 0
        # Restoring the retired key from an escrow copy (here: the original ring).
        escrow = tmp_path / "escrow.json"
        escrow.write_bytes(serialize_keyring(
            [("kek-old", old_ring.material("kek-old"), None)], "kek-old"))
        escrow.chmod(0o600)
        assert cli.main(["keyring-import-key", str(path), "--from", str(escrow),
                         "--key-id", "kek-old"]) == 0
        assert cli.main(["keyring-import-key", str(path), "--from", str(escrow),
                         "--key-id", "kek-old"]) == 1  # already present
        from app.crypto import load_keyring

        restored = load_keyring(path)
        assert restored.active_key_id == "kek-new"
        assert restored.material("kek-old") == old_ring.material("kek-old")
        assert oct(os.stat(path).st_mode & 0o777) == "0o600"
        output = capsys.readouterr()
        assert old_ring.material("kek-old").hex() not in output.out + output.err
    finally:
        get_settings.cache_clear()


def test_migration_downgrade_refuses_to_drop_documents(seeded, test_database_url, monkeypatch):
    from tests.test_account_security_migration import _config

    config = _config(test_database_url)
    with pytest.raises(RuntimeError, match="destructive"):
        command.downgrade(config, "20261001_0011")
    command.upgrade(config, "head")


def test_migration_round_trip_on_empty_tables(engine, test_database_url):
    from tests.test_account_security_migration import _config

    config = _config(test_database_url)
    command.downgrade(config, "20261001_0011")
    try:
        with engine.connect() as connection:
            assert connection.execute(
                text("SELECT to_regclass('public.documents')")
            ).scalar() is None
    finally:
        command.upgrade(config, "head")
    with engine.connect() as connection:
        for table in ("documents", "document_versions", "document_blobs"):
            assert connection.execute(text(f"SELECT to_regclass('public.{table}')")).scalar()


def test_documents_export_after_rotation(seeded, doc_settings, session_factory, mail):
    old_ring, originals = seeded
    new_ring = extend_keyring(old_ring, "kek-new")
    rewrap_all(session_factory, new_ring)
    with _client(doc_settings, session_factory, mail, new_ring) as client:
        with session_factory() as db:
            some_owner = db.scalars(select(DocumentVersion.user_id)).first()
        client.cookies.set(doc_settings.cookie_name, _token(session_factory, some_owner))
        client.headers["X-LifeOS-Account"] = str(some_owner)
        archive = zipfile.ZipFile(io.BytesIO(client.get("/api/v1/export/documents").content))
        exported = {name for name in archive.namelist() if name.startswith("documents/")}
        assert exported and all(archive.read(name) for name in exported)
