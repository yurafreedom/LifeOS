"""S2 checkpoints 2 and 4: encrypted documents through the real API and database."""

from __future__ import annotations

import io
import json
import logging
import tempfile
import threading
import zipfile
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text, update

from app.crypto import KeyringError
from app.main import create_app
from app.models import Document, DocumentBlob, DocumentVersion
from tests.aa_helpers import authenticate
from tests.document_helpers import (
    encode_meta,
    idem,
    make_jpeg,
    make_keyring,
    make_pdf,
    make_png,
    upload,
    upload_version,
)

SECRET_TITLE = "Кредитний договір синтетичний"
SECRET_NOTES = "synthetic-note-should-never-appear-in-logs"
SECRET_FILENAME = "synthetic-contract-filename.pdf"


@pytest.fixture
def keyring():
    return make_keyring("kek-test-1")


@pytest.fixture
def doc_settings(settings):
    return settings.model_copy(update={"documents_enabled": True, "keyring_file": "/unused"})


@pytest.fixture
def doc_app(doc_settings, session_factory, mail, keyring):
    return create_app(
        settings=doc_settings, session_factory=session_factory, mail=mail, keyring=keyring
    )


@pytest.fixture
def doc_client(doc_app):
    with TestClient(doc_app, headers={"Origin": "http://testserver"}) as test_client:
        yield test_client


@pytest.fixture
def owner(doc_client, doc_settings, account_factory):
    account = account_factory("docs-owner@example.com")
    authenticate(doc_client, doc_settings, account)
    return account


def _created(response):
    assert response.status_code == 201, response.text
    return response.json()


# ───────────────────────────── happy path ─────────────────────────────


def test_upload_list_download_round_trip_for_each_format(doc_client, owner):
    for content, name, ctype in (
        (make_pdf(pages=2), "synthetic.pdf", "application/pdf"),
        (make_jpeg(), "photo.jpeg", "image/jpeg"),
        (make_png(), "scan.png", "image/png"),
    ):
        body = _created(upload(doc_client, content, filename=name, title=f"T {name}"))
        assert body["current_version"]["content_type"] == ctype
        assert body["current_version"]["size_bytes"] == len(content)
        assert body["current_version"]["filename"] == name
        assert body["state"] == "ok" and body["revision"] == 1
        download = doc_client.get(f"/api/v1/documents/{body['id']}/content")
        assert download.status_code == 200
        assert download.content == content
        assert download.headers["content-type"] == ctype
        assert download.headers["content-disposition"].startswith("attachment;")
        assert download.headers["x-content-type-options"] == "nosniff"
        assert download.headers["cache-control"] == "no-store"
        assert "sandbox" in download.headers["content-security-policy"]
    listed = doc_client.get("/api/v1/documents").json()["documents"]
    assert len(listed) == 3
    status = doc_client.get("/api/v1/documents/status").json()
    assert status["enabled"] is True and status["document_count"] == 3
    assert status["protection"] == "server_side_at_rest"


def test_title_defaults_to_the_file_name_and_download_name_uses_the_verified_type(doc_client, owner):
    body = _created(upload(doc_client, make_png(), filename="../../etc/Квитанція.png"))
    assert body["title"] == "Квитанція"
    assert body["current_version"]["filename"] == "Квитанція.png"
    disposition = doc_client.get(f"/api/v1/documents/{body['id']}/content").headers[
        "content-disposition"
    ]
    assert "filename*=UTF-8''%D0%9A" in disposition and ".png" in disposition
    assert "/" not in disposition.split("filename=")[1].split(";")[0]


def test_nothing_readable_is_stored_in_plaintext(doc_client, owner, session_factory):
    content = make_pdf(text="synthetic-unique-marker-4711")
    _created(upload(doc_client, content, filename=SECRET_FILENAME, title=SECRET_TITLE,
                    notes=SECRET_NOTES))
    with session_factory() as db:
        dump = b"".join(
            bytes(value)
            for row in db.execute(text("SELECT * FROM documents")).all()
            + db.execute(text("SELECT * FROM document_versions")).all()
            + db.execute(text("SELECT * FROM document_blobs")).all()
            for value in row
            if isinstance(value, (bytes, memoryview))
        ) + json.dumps(
            [
                [str(value) for value in row]
                for table in ("documents", "document_versions", "document_blobs")
                for row in db.execute(text(f"SELECT * FROM {table}")).all()
            ]
        ).encode()
    for secret in (SECRET_TITLE.encode(), SECRET_NOTES.encode(), SECRET_FILENAME.encode(),
                   b"synthetic-unique-marker-4711", content[:64]):
        assert secret not in dump


# ───────────────────────────── ownership & binding ─────────────────────────────


def test_cross_owner_ids_do_not_reveal_existence(doc_client, doc_settings, owner, account_factory):
    body = _created(upload(doc_client, make_png()))
    stranger = account_factory("docs-stranger@example.com")
    authenticate(doc_client, doc_settings, stranger)
    missing = str(uuid4())
    for path in (body["id"], missing):
        for response in (
            doc_client.get(f"/api/v1/documents/{path}"),
            doc_client.get(f"/api/v1/documents/{path}/content"),
            doc_client.get(f"/api/v1/documents/{path}/versions/1/content"),
            doc_client.patch(f"/api/v1/documents/{path}", json={"expected_revision": 1, "title": "x"}),
            doc_client.request("DELETE", f"/api/v1/documents/{path}", json={"expected_revision": 1}),
            upload_version(doc_client, path, make_png(), expected_revision=1, filename="x.png"),
        ):
            assert response.status_code == 404, response.text
            assert response.json() == {"code": "document_not_found", "message": "Document not found."}
    assert doc_client.get("/api/v1/documents").json()["documents"] == []


def test_stale_account_binding_and_missing_binding_are_refused(
    doc_client, doc_settings, owner, account_factory
):
    body = _created(upload(doc_client, make_png()))
    other = account_factory("docs-other@example.com")
    # Tab still believes it is `owner`, but the cookie now belongs to `other`.
    doc_client.cookies.set(doc_settings.cookie_name, other.raw_token)
    for response in (
        doc_client.get("/api/v1/documents"),
        doc_client.get(f"/api/v1/documents/{body['id']}/content"),
        upload(doc_client, make_png()),
        doc_client.get("/api/v1/export/documents"),
    ):
        assert response.status_code == 409
        assert response.json()["code"] == "session_user_mismatch"
    del doc_client.headers["X-LifeOS-Account"]
    assert doc_client.get("/api/v1/documents").status_code == 428
    assert upload(doc_client, make_png()).status_code == 428


def test_uploads_refuse_cross_site_multipart_and_form_requests(doc_client, owner):
    assert upload(doc_client, make_png(), headers={"Origin": "https://evil.example"}).status_code == 403
    assert upload(doc_client, make_png(), headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403
    for content_type in ("multipart/form-data; boundary=x", "text/plain", "application/x-www-form-urlencoded",
                         "image/png"):
        response = upload(doc_client, make_png(), headers={"Content-Type": content_type})
        assert response.status_code == 415
        assert response.json()["code"] == "unsupported_media_type"
    files = doc_client.post("/api/v1/documents", files={"file": ("a.png", make_png(), "image/png")})
    assert files.status_code == 415


# ───────────────────────────── upload limits & validation ─────────────────────────────


def test_size_limit_is_enforced_while_reading_not_from_content_length(doc_client, owner, doc_app):
    limit = doc_app.state.settings.document_max_bytes
    big = make_png() + b"\x00" * limit
    early = upload(doc_client, big)
    assert early.status_code == 413 and early.json()["code"] == "document_too_large"

    def chunks():  # no Content-Length at all: only the byte count can stop it
        for _ in range(limit // 65536 + 2):
            yield b"\x00" * 65536

    streamed = doc_client.post(
        "/api/v1/documents",
        content=chunks(),
        headers={
            "Content-Type": "application/octet-stream",
            "X-LifeOS-Document-Meta": encode_meta(filename="big.png"),
            "Idempotency-Key": idem(),
        },
    )
    assert streamed.status_code == 413
    lying = doc_client.post(
        "/api/v1/documents",
        content=big,
        headers={
            "Content-Type": "application/octet-stream",
            "X-LifeOS-Document-Meta": encode_meta(filename="big.png"),
            "Idempotency-Key": idem(),
            "Content-Length": "10",
        },
    )
    assert lying.status_code in {400, 413}


def test_small_configured_limit(doc_settings, session_factory, mail, keyring, account_factory):
    small = doc_settings.model_copy(update={"document_max_bytes": 1024})
    app = create_app(settings=small, session_factory=session_factory, mail=mail, keyring=keyring)
    with TestClient(app, headers={"Origin": "http://testserver"}) as client:
        authenticate(client, small, account_factory("docs-small@example.com"))
        too_big = make_pdf(pages=30)
        assert len(too_big) > 1024
        assert upload(client, too_big).status_code == 413
        assert upload(client, make_png()).status_code == 201


@pytest.mark.parametrize(
    "content,filename,declared,status,code",
    [
        (b"<html></html>", "page.html", None, 415, "unsupported_document_type"),
        (make_png(), "scan.pdf", None, 415, "content_type_mismatch"),
        (make_png(), "scan.png", "application/pdf", 415, "content_type_mismatch"),
        (make_png()[:-5], "scan.png", None, 422, "malformed_document"),
        (b"", "empty.pdf", None, 422, "empty_document"),
    ],
)
def test_invalid_content_is_refused(doc_client, owner, session_factory, content, filename,
                                    declared, status, code):
    response = upload(doc_client, content, filename=filename, declared_type=declared)
    assert response.status_code == status and response.json()["code"] == code
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(DocumentBlob)) == 0


def test_encrypted_pdf_is_refused_with_an_honest_reason(doc_client, owner):
    from tests.document_helpers import make_encrypted_pdf

    response = upload(doc_client, make_encrypted_pdf(), filename="locked.pdf")
    assert response.status_code == 422
    assert response.json()["code"] == "encrypted_pdf"
    assert "password" in response.json()["message"].casefold()


def test_metadata_header_and_idempotency_key_are_required_and_bounded(doc_client, owner):
    no_meta = doc_client.post(
        "/api/v1/documents",
        content=make_png(),
        headers={"Content-Type": "application/octet-stream", "Idempotency-Key": idem()},
    )
    assert no_meta.status_code == 422 and no_meta.json()["code"] == "invalid_document_metadata"
    bad_meta = upload(doc_client, make_png(), headers={"X-LifeOS-Document-Meta": "%%%"})
    assert bad_meta.status_code == 422
    no_key = upload(doc_client, make_png(), headers={"Idempotency-Key": "short"})
    assert no_key.status_code == 422 and no_key.json()["code"] == "invalid_idempotency_key"
    long_title = upload(doc_client, make_png(), filename="a.png", title="x" * 201)
    assert long_title.status_code == 422


def test_no_plaintext_spooling_to_disk(doc_client, owner, monkeypatch):
    """Accepted uploads, downloads and the documents export never create a temp file."""

    def forbidden(*_args, **_kwargs):
        raise AssertionError("a temporary file was created while handling a document")

    for name in ("TemporaryFile", "NamedTemporaryFile", "SpooledTemporaryFile", "mkstemp",
                 "mkdtemp"):
        monkeypatch.setattr(tempfile, name, forbidden)
    body = _created(upload(doc_client, make_pdf(pages=3)))
    assert doc_client.get(f"/api/v1/documents/{body['id']}/content").status_code == 200
    export = doc_client.get("/api/v1/export/documents")
    assert export.status_code == 200


def test_failed_uploads_leave_nothing_behind(doc_client, owner, session_factory, monkeypatch):
    from app.services.documents import service

    def broken_put(*_args, **_kwargs):
        raise RuntimeError("simulated storage failure")

    monkeypatch.setattr(service.PostgresBlobStore, "put", broken_put)
    with pytest.raises(RuntimeError):
        upload(doc_client, make_png())
    with session_factory() as db:
        for model in (Document, DocumentVersion, DocumentBlob):
            assert db.scalar(select(func.count()).select_from(model)) == 0


# ───────────────────────────── retries & concurrency ─────────────────────────────


def test_upload_retry_is_idempotent_and_key_reuse_is_detected(doc_client, owner, session_factory):
    key = idem()
    first = upload(doc_client, make_png(), key=key)
    assert first.status_code == 201
    again = upload(doc_client, make_png(), key=key)
    assert again.status_code == 200 and again.json()["id"] == first.json()["id"]
    conflict = upload(doc_client, make_png(rgb=(1, 2, 3)), key=key)
    assert conflict.status_code == 409 and conflict.json()["code"] == "idempotency_conflict"
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Document)) == 1


def test_concurrent_identical_uploads_create_one_document(doc_app, doc_settings, owner,
                                                          session_factory):
    key = idem()
    results: list[int] = []
    barrier = threading.Barrier(4)

    def attempt():
        with TestClient(doc_app, headers={"Origin": "http://testserver"}) as client:
            authenticate(client, doc_settings, owner)
            barrier.wait()
            results.append(upload(client, make_pdf(), key=key).status_code)

    threads = [threading.Thread(target=attempt) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(results).count(201) == 1 and all(code in (200, 201) for code in results)
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Document)) == 1


def test_versions_metadata_and_deletion_use_revisions(doc_client, owner):
    body = _created(upload(doc_client, make_pdf(), filename="v1.pdf", title="Original"))
    doc_id = body["id"]
    v2 = upload_version(doc_client, doc_id, make_png(), expected_revision=1, filename="v2.png")
    assert v2.status_code == 201
    assert v2.json()["revision"] == 2 and v2.json()["current_version"]["number"] == 2
    stale_version = upload_version(doc_client, doc_id, make_jpeg(), expected_revision=1,
                                   filename="v3.jpg")
    assert stale_version.status_code == 409
    assert stale_version.json() == {
        "code": "revision_conflict",
        "message": "The document changed since it was loaded.",
        "current_revision": 2,
    }
    stale_edit = doc_client.patch(f"/api/v1/documents/{doc_id}",
                                  json={"expected_revision": 1, "title": "Lost edit"})
    assert stale_edit.status_code == 409
    edit = doc_client.patch(f"/api/v1/documents/{doc_id}",
                            json={"expected_revision": 2, "title": "Renamed", "notes": "n"})
    assert edit.status_code == 200 and edit.json()["title"] == "Renamed"
    assert edit.json()["revision"] == 3
    empty = doc_client.patch(f"/api/v1/documents/{doc_id}", json={"expected_revision": 3, "title": " "})
    assert empty.status_code == 422
    detail = doc_client.get(f"/api/v1/documents/{doc_id}").json()
    assert [v["number"] for v in detail["versions"]] == [2, 1]
    assert [v["filename"] for v in detail["versions"]] == ["v2.png", "v1.pdf"]
    assert doc_client.get(f"/api/v1/documents/{doc_id}/versions/1/content").content == make_pdf()
    assert doc_client.get(f"/api/v1/documents/{doc_id}/versions/2/content").content == make_png()
    assert doc_client.get(f"/api/v1/documents/{doc_id}/versions/9/content").status_code == 404
    stale_delete = doc_client.request("DELETE", f"/api/v1/documents/{doc_id}",
                                      json={"expected_revision": 2})
    assert stale_delete.status_code == 409
    gone = doc_client.request("DELETE", f"/api/v1/documents/{doc_id}", json={"expected_revision": 3})
    assert gone.status_code == 204
    assert doc_client.get(f"/api/v1/documents/{doc_id}").status_code == 404


def test_version_retry_is_idempotent(doc_client, owner):
    doc_id = _created(upload(doc_client, make_pdf()))["id"]
    key = idem()
    first = upload_version(doc_client, doc_id, make_png(), expected_revision=1, key=key)
    retry = upload_version(doc_client, doc_id, make_png(), expected_revision=1, key=key)
    assert first.status_code == 201 and retry.status_code == 200
    assert retry.json()["version_count"] == 2


def test_concurrent_version_uploads_never_lose_a_version(doc_app, doc_settings, owner,
                                                         doc_client, session_factory):
    doc_id = _created(upload(doc_client, make_pdf()))["id"]
    barrier = threading.Barrier(4)
    results: list[int] = []

    def attempt(index: int):
        with TestClient(doc_app, headers={"Origin": "http://testserver"}) as client:
            authenticate(client, doc_settings, owner)
            barrier.wait()
            response = upload_version(client, doc_id, make_png(rgb=(index, 0, 0)),
                                      expected_revision=1, filename=f"v{index}.png")
            results.append(response.status_code)

    threads = [threading.Thread(target=attempt, args=(i,)) for i in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(results) == [201, 409, 409, 409]
    with session_factory() as db:
        numbers = sorted(db.scalars(select(DocumentVersion.version_number)))
    assert numbers == [1, 2]


def test_quotas_are_exact(doc_settings, session_factory, mail, keyring, account_factory):
    png = make_png()
    limited = doc_settings.model_copy(update={"document_max_per_account": 2,
                                              "document_max_account_bytes": 2 * len(png) + 10})
    app = create_app(settings=limited, session_factory=session_factory, mail=mail, keyring=keyring)
    with TestClient(app, headers={"Origin": "http://testserver"}) as client:
        authenticate(client, limited, account_factory("docs-quota@example.com"))
        assert upload(client, make_png()).status_code == 201
        assert upload(client, make_png()).status_code == 201
        third = upload(client, make_png())
        assert third.status_code == 409 and third.json()["code"] == "document_limit_reached"
        doc_id = client.get("/api/v1/documents").json()["documents"][0]["id"]
        full = upload_version(client, doc_id, make_png(rgb=(9, 9, 9)), expected_revision=1)
        assert full.status_code == 409 and full.json()["code"] == "document_storage_full"


# ───────────────────────────── tamper detection ─────────────────────────────


@pytest.mark.parametrize(
    "mutation",
    [
        "UPDATE document_blobs SET content_ciphertext = overlay(content_ciphertext placing "
        "'\\x00'::bytea from 20 for 1)",
        "UPDATE document_blobs SET content_ciphertext = substring(content_ciphertext from 1 "
        "for octet_length(content_ciphertext) - 1)",
        "UPDATE document_versions SET size_bytes = size_bytes - 1",
        "UPDATE document_versions SET content_type = 'image/jpeg'",
        "UPDATE document_versions SET wrapped_dek = overlay(wrapped_dek placing '\\x01'::bytea "
        "from 30 for 1)",
    ],
)
def test_tampered_records_are_detected_and_never_returned(doc_client, owner, session_factory,
                                                          mutation, caplog):
    doc_id = _created(upload(doc_client, make_png(), filename="t.png"))["id"]
    with session_factory.begin() as db:
        db.execute(text(mutation))
    with caplog.at_level(logging.ERROR):
        response = doc_client.get(f"/api/v1/documents/{doc_id}/content")
    assert response.status_code == 500
    assert response.json()["code"] == "document_integrity_failed"
    assert make_png() not in response.content


def test_swapping_ciphertext_between_versions_or_owners_is_detected(
    doc_client, doc_settings, owner, account_factory, session_factory
):
    first = _created(upload(doc_client, make_png(), filename="mine.png"))["id"]
    second = _created(upload(doc_client, make_png(rgb=(5, 5, 5)), filename="mine2.png"))["id"]
    stranger = account_factory("docs-swap@example.com")
    authenticate(doc_client, doc_settings, stranger)
    theirs = _created(upload(doc_client, make_png(rgb=(7, 7, 7)), filename="theirs.png"))["id"]
    with session_factory.begin() as db:
        rows = {
            row.document_id: row
            for row in db.scalars(select(DocumentVersion))
        }
        blob_a = db.get(DocumentBlob, rows[UUID(first)].id)
        blob_b = db.get(DocumentBlob, rows[UUID(second)].id)
        blob_t = db.get(DocumentBlob, rows[UUID(theirs)].id)
        # Reorder within one owner, and substitute another owner's ciphertext + key.
        blob_a.content_ciphertext, blob_b.content_ciphertext = (
            blob_b.content_ciphertext, blob_a.content_ciphertext)
        blob_a.content_nonce, blob_b.content_nonce = blob_b.content_nonce, blob_a.content_nonce
        mine = rows[UUID(second)]
        other = rows[UUID(theirs)]
        db.execute(
            update(DocumentVersion).where(DocumentVersion.id == mine.id).values(
                wrapped_dek=other.wrapped_dek)
        )
        assert blob_t is not None
    authenticate(doc_client, doc_settings, owner)
    for doc_id in (first, second):
        assert doc_client.get(f"/api/v1/documents/{doc_id}/content").status_code == 500
    listing = {d["id"]: d["state"] for d in doc_client.get("/api/v1/documents").json()["documents"]}
    assert listing[second] == "integrity_failed"


def test_unknown_key_version_is_an_explicit_operational_error(
    doc_client, owner, doc_settings, session_factory, mail, caplog
):
    doc_id = _created(upload(doc_client, make_png()))["id"]
    other_ring = make_keyring("kek-replacement")
    app = create_app(settings=doc_settings, session_factory=session_factory, mail=mail,
                     keyring=other_ring)
    with TestClient(app, headers={"Origin": "http://testserver"}) as client:
        authenticate(client, doc_settings, owner)
        with caplog.at_level(logging.ERROR):
            response = client.get(f"/api/v1/documents/{doc_id}/content")
        assert response.status_code == 503
        assert response.json()["code"] == "document_key_unavailable"
        assert any(getattr(r, "kek_id", None) == "kek-test-1" for r in caplog.records)
        listed = client.get("/api/v1/documents").json()["documents"]
        assert listed[0]["state"] == "key_unavailable" and listed[0]["title"] is None
        refused = client.patch(f"/api/v1/documents/{doc_id}",
                               json={"expected_revision": 1, "title": "overwrite"})
        assert refused.status_code == 503


# ───────────────────────────── disabled / fail closed ─────────────────────────────


def test_disabled_feature_is_honest(client, settings, account_factory):
    authenticate(client, settings, account_factory("docs-off@example.com"))
    status = client.get("/api/v1/documents/status")
    assert status.status_code == 200 and status.json()["enabled"] is False
    for response in (client.get("/api/v1/documents"), upload(client, make_png()),
                     client.get("/api/v1/export/documents")):
        assert response.status_code == 503
        assert response.json()["code"] == "documents_unavailable"


def test_enabled_documents_without_a_valid_keyring_refuse_to_start(
    settings, session_factory, mail, tmp_path
):
    missing = settings.model_copy(update={"documents_enabled": True,
                                          "keyring_file": str(tmp_path / "absent.json")})
    with pytest.raises(KeyringError):
        create_app(settings=missing, session_factory=session_factory, mail=mail)
    loose = tmp_path / "loose.json"
    loose.write_text("{}")
    loose.chmod(0o644)
    with pytest.raises(KeyringError):
        create_app(settings=settings.model_copy(update={"documents_enabled": True,
                                                        "keyring_file": str(loose)}),
                   session_factory=session_factory, mail=mail)
    from app.config import Settings

    with pytest.raises(ValueError, match="keyring_file"):
        Settings(database_url=settings.database_url, bootstrap_token="x" * 40,
                 documents_enabled=True)


def test_transfer_slots_bound_concurrency(doc_client, owner, doc_app):
    slots = doc_app.state.document_slots
    taken = 0
    while slots.try_acquire():
        taken += 1
    try:
        busy = upload(doc_client, make_png())
        assert busy.status_code == 503 and busy.json()["code"] == "documents_busy"
        assert busy.headers["retry-after"] == "5"
    finally:
        for _ in range(taken):
            slots.release()
    assert upload(doc_client, make_png()).status_code == 201


# ───────────────────────────── logs ─────────────────────────────


def test_logs_never_contain_names_titles_notes_or_content(doc_client, owner, caplog):
    content = make_pdf(text="synthetic-log-marker-9931")
    with caplog.at_level(logging.DEBUG):
        doc_id = _created(upload(doc_client, content, filename=SECRET_FILENAME,
                                 title=SECRET_TITLE, notes=SECRET_NOTES))["id"]
        upload_version(doc_client, doc_id, make_png(), expected_revision=1,
                       filename="secret-version-name.png")
        doc_client.patch(f"/api/v1/documents/{doc_id}",
                         json={"expected_revision": 2, "title": SECRET_TITLE + "2"})
        doc_client.get(f"/api/v1/documents/{doc_id}/content")
        doc_client.get("/api/v1/export/documents")
        doc_client.request("DELETE", f"/api/v1/documents/{doc_id}", json={"expected_revision": 3})
    rendered = "\n".join(
        f"{record.getMessage()} {record.__dict__}" for record in caplog.records
    )
    for secret in (SECRET_FILENAME, SECRET_TITLE, SECRET_NOTES, "secret-version-name",
                   "synthetic-log-marker-9931"):
        assert secret not in rendered
    assert "document.created" in rendered and "document.deleted" in rendered


# ───────────────────────────── export & erasure ─────────────────────────────


def test_account_export_carries_readable_document_metadata_only(doc_client, owner):
    doc_id = _created(upload(doc_client, make_png(), filename=SECRET_FILENAME.replace(".pdf", ".png"),
                             title=SECRET_TITLE))["id"]
    response = doc_client.get("/api/v1/export")
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    manifest = json.loads(archive.read("manifest.json"))
    assert manifest["tables"]["documents"]["rows"] == 1
    assert manifest["tables"]["document_versions"]["rows"] == 1
    assert "documents export" in manifest["documents"]
    documents = [json.loads(line) for line in archive.read("documents.ndjson").splitlines()]
    versions = [json.loads(line) for line in archive.read("document_versions.ndjson").splitlines()]
    assert documents[0]["id"] == doc_id
    assert set(documents[0]) == {"id", "revision", "current_version", "created_at", "updated_at"}
    assert set(versions[0]) == {"id", "document_id", "version_number", "content_type",
                                "size_bytes", "created_at"}
    everything = b"".join(archive.read(name) for name in archive.namelist())
    assert SECRET_TITLE.encode() not in everything
    assert b"kek-test-1" not in everything


def test_documents_export_streams_authenticated_plaintext(doc_client, owner):
    pdf, png = make_pdf(pages=2), make_png()
    doc_id = _created(upload(doc_client, pdf, filename="a.pdf", title=SECRET_TITLE,
                             notes=SECRET_NOTES))["id"]
    upload_version(doc_client, doc_id, png, expected_revision=1, filename="b.png")
    response = doc_client.get("/api/v1/export/documents")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.headers["cache-control"] == "no-store"
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    index = json.loads(archive.read("documents.json"))
    entry = index["documents"][0]
    assert entry["title"] == SECRET_TITLE and entry["notes"] == SECRET_NOTES
    files = {v["number"]: archive.read(v["file"]) for v in entry["versions"]}
    assert files == {1: pdf, 2: png}
    assert all(v["state"] == "ok" for v in entry["versions"])
    assert "DECRYPTED" in index["protection"]
    for name in archive.namelist():
        assert ".." not in name and not name.startswith("/")


def test_documents_export_stops_when_the_session_ends(doc_app, doc_client, owner, doc_settings,
                                                      session_factory):
    for _ in range(2):
        _created(upload(doc_client, make_png()))
    from app.services.documents.export import ExportInterrupted, stream_documents_export

    calls = {"n": 0}

    def ended_after_first() -> bool:
        calls["n"] += 1
        return calls["n"] == 1

    stream = stream_documents_export(session_factory, doc_app.state.documents,
                                     owner=owner.user_id, still_authorized=ended_after_first)
    with pytest.raises(ExportInterrupted):
        for _chunk in stream:
            pass


def test_documents_export_marks_unreadable_versions_honestly(doc_client, owner, session_factory):
    doc_id = _created(upload(doc_client, make_png()))["id"]
    with session_factory.begin() as db:
        db.execute(text("UPDATE document_blobs SET content_ciphertext = "
                        "overlay(content_ciphertext placing '\\x00'::bytea from 20 for 1)"))
    archive = zipfile.ZipFile(io.BytesIO(doc_client.get("/api/v1/export/documents").content))
    entry = json.loads(archive.read("documents.json"))["documents"][0]
    assert entry["id"] == doc_id
    assert entry["versions"][0]["state"] == "integrity_failed"
    assert entry["versions"][0]["file"] is None
    assert archive.namelist() == ["documents.json"]


def test_deleting_a_document_removes_ciphertext_and_wrapped_keys(doc_client, owner,
                                                                 session_factory):
    keep = _created(upload(doc_client, make_png()))["id"]
    drop = _created(upload(doc_client, make_pdf()))["id"]
    upload_version(doc_client, drop, make_jpeg(), expected_revision=1)
    assert doc_client.request("DELETE", f"/api/v1/documents/{drop}",
                              json={"expected_revision": 2}).status_code == 204
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Document)) == 1
        assert db.scalar(select(func.count()).select_from(DocumentVersion)) == 1
        assert db.scalar(select(func.count()).select_from(DocumentBlob)) == 1
        assert str(db.scalars(select(Document.id)).one()) == keep


def test_account_deletion_erases_every_document_row(doc_client, owner, doc_settings,
                                                    account_factory, session_factory):
    _created(upload(doc_client, make_png()))
    doc_id = _created(upload(doc_client, make_pdf()))["id"]
    upload_version(doc_client, doc_id, make_jpeg(), expected_revision=1)
    survivor = account_factory("docs-survivor@example.com")
    authenticate(doc_client, doc_settings, survivor)
    _created(upload(doc_client, make_png()))
    authenticate(doc_client, doc_settings, owner)
    erased = doc_client.request("DELETE", "/api/v1/account",
                                json={"confirmation": "DELETE_ACCOUNT"})
    assert erased.status_code == 204
    with session_factory() as db:
        for model in (Document, DocumentVersion, DocumentBlob):
            owners = set(db.scalars(select(model.user_id)))
            assert owners == {survivor.user_id}


def test_database_refuses_a_version_attached_to_another_owners_document(
    doc_client, owner, account_factory, session_factory
):
    from sqlalchemy.exc import IntegrityError

    doc_id = _created(upload(doc_client, make_png()))["id"]
    stranger = account_factory("docs-fk@example.com")
    with pytest.raises(IntegrityError), session_factory.begin() as db:
        source = db.scalars(select(DocumentVersion)).one()
        db.add(DocumentVersion(
            document_id=UUID(doc_id), user_id=stranger.user_id,
            version_number=2, content_type="image/png", size_bytes=1, idempotency_key=idem(),
            envelope_version=1, kek_id="kek-test-1", wrapped_dek=source.wrapped_dek,
            meta_nonce=source.meta_nonce, meta_ciphertext=source.meta_ciphertext,
        ))


# Owner-scoped tables deliberately absent from the account export, with the reason.
EXPORT_EXCLUSIONS = {
    "auth_tokens": "reset/verification token digests (secrets)",
    "auth_throttle": "throttle counters keyed by digests; no account content",
    "document_blobs": "ciphertext only; contents leave via the documents export",
}


def test_every_owner_scoped_table_is_exported_or_explicitly_excluded(doc_client, owner):
    from app.models import Base

    owner_scoped = {
        name
        for name, table in Base.metadata.tables.items()
        if "user_id" in table.c
        or any(fk.column.table.name == "users" for fk in table.foreign_keys)
    } - {"aa_metric_definitions"}
    manifest = json.loads(
        zipfile.ZipFile(io.BytesIO(doc_client.get("/api/v1/export").content)).read("manifest.json")
    )
    exported = set(manifest["tables"])
    missing = owner_scoped - exported - set(EXPORT_EXCLUSIONS)
    assert not missing, f"owner-scoped tables neither exported nor excluded: {sorted(missing)}"
    assert not (set(EXPORT_EXCLUSIONS) & exported)
