"""Encrypted documents API (JENKIN S2).

Every route depends on :func:`get_current_user`, so it is authenticated and
bound to the client's expected account (S1) before anything else runs —
including before an upload body is read.

Uploads are a raw ``application/octet-stream`` body, **not** multipart:
* no multipart parser and no ``UploadFile`` — Starlette spools multipart
  files above 1 MiB to a temporary file on disk, which would leave plaintext
  residue; the raw body is read from the ASGI stream into bounded memory;
* the size limit is enforced while reading (``Content-Length`` is only used
  to refuse early, never trusted to be honest);
* ``application/octet-stream`` is not a CORS "simple" type, so a cross-site
  page cannot send it without a preflight, and the Origin/Referer check
  (``enforce_same_origin``) runs as well;
* descriptive fields travel in ``X-LifeOS-Document-Meta`` (base64url JSON),
  never in the URL, so they stay out of access logs.

Downloads are authorized first, decrypted and authenticated in full, and only
then returned — always as an attachment with ``nosniff`` and a sandboxing CSP.
"""

from __future__ import annotations

import base64
import binascii
import json
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Annotated, Any
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.security.origin import enforce_same_origin, require_json_content_type
from app.services.documents import service
from app.services.documents.service import (
    DocumentError,
    DocumentRuntime,
    DocumentView,
    UploadMeta,
    VersionView,
)
from app.services.documents.validation import ACCEPTED_TYPES

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

META_HEADER = "X-LifeOS-Document-Meta"
EXPECTED_REVISION_HEADER = "X-LifeOS-Expected-Revision"
MAX_META_HEADER = 24 * 1024


# ───────────────────────────── runtime ─────────────────────────────


class TransferSlots:
    """Bounded number of uploads/downloads/exports holding plaintext in memory."""

    def __init__(self, limit: int) -> None:
        self._limit = limit
        self._used = 0
        self._lock = threading.Lock()

    def try_acquire(self) -> bool:
        with self._lock:
            if self._used >= self._limit:
                return False
            self._used += 1
            return True

    def release(self) -> None:
        with self._lock:
            self._used = max(0, self._used - 1)

    @contextmanager
    def hold(self):
        if not self.try_acquire():
            raise HTTPException(
                status_code=503,
                detail={"code": "documents_busy", "message": "Too many document transfers."},
                headers={"Retry-After": "5"},
            )
        try:
            yield
        finally:
            self.release()


def get_runtime(request: Request) -> DocumentRuntime:
    return request.app.state.documents


def get_slots(request: Request) -> TransferSlots:
    return request.app.state.document_slots


def _http(error: DocumentError) -> HTTPException:
    detail: dict[str, Any] = {"code": error.code, "message": error.message, **error.extra}
    return HTTPException(status_code=error.status, detail=detail)


def _require_enabled(runtime: DocumentRuntime) -> None:
    try:
        runtime.require_keyring()
    except DocumentError as error:
        raise _http(error) from None


# ───────────────────────────── schemas ─────────────────────────────


class VersionOut(BaseModel):
    id: UUID
    number: int
    content_type: str
    size_bytes: int
    created_at: datetime
    filename: str | None
    state: str


class DocumentOut(BaseModel):
    id: UUID
    revision: int
    title: str | None
    notes: str | None
    state: str
    created_at: datetime
    updated_at: datetime
    current_version: VersionOut | None
    version_count: int
    total_bytes: int
    versions: list[VersionOut] | None = None


class DocumentListOut(BaseModel):
    documents: list[DocumentOut]


class DocumentStatusOut(BaseModel):
    enabled: bool
    accepted_types: list[str]
    max_bytes: int
    max_documents: int
    max_account_bytes: int
    document_count: int | None
    used_bytes: int | None
    protection: str = Field(
        description="server_side_at_rest: contents, file names, titles and notes are encrypted "
        "in the database; the server can decrypt them to serve you. Not end-to-end."
    )


class MetadataUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=1)
    title: str | None = Field(default=None, max_length=service.TITLE_MAX * 2)
    notes: str | None = Field(default=None, max_length=service.NOTES_MAX * 2)


class DeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=1)


class UploadMetaIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    filename: str = Field(min_length=1, max_length=1024)
    title: str | None = Field(default=None, max_length=service.TITLE_MAX * 2)
    notes: str | None = Field(default=None, max_length=service.NOTES_MAX * 2)
    declared_type: str | None = Field(default=None, max_length=128)


def _version_out(view: VersionView | None) -> VersionOut | None:
    if view is None:
        return None
    return VersionOut(**view.__dict__)


def _document_out(view: DocumentView) -> DocumentOut:
    return DocumentOut(
        id=view.id,
        revision=view.revision,
        title=view.title,
        notes=view.notes,
        state=view.state,
        created_at=view.created_at,
        updated_at=view.updated_at,
        current_version=_version_out(view.current_version),
        version_count=view.version_count,
        total_bytes=view.total_bytes,
        versions=None if view.versions is None else [_version_out(v) for v in view.versions],
    )


# ───────────────────────────── upload plumbing ─────────────────────────────


def _invalid_meta() -> HTTPException:
    return HTTPException(
        status_code=422,
        detail={
            "code": "invalid_document_metadata",
            "message": f"{META_HEADER} must be base64url-encoded JSON.",
        },
    )


def _parse_meta(request: Request) -> UploadMeta:
    raw = request.headers.get(META_HEADER)
    if raw is None or len(raw) > MAX_META_HEADER:
        raise _invalid_meta()
    try:
        padded = raw + "=" * (-len(raw) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
        parsed = UploadMetaIn.model_validate(decoded)
    except (binascii.Error, UnicodeError, ValueError):
        raise _invalid_meta() from None
    return UploadMeta(parsed.filename, parsed.title, parsed.notes, parsed.declared_type)


def _require_octet_stream(request: Request) -> None:
    content_type = request.headers.get("content-type", "").partition(";")[0].strip().casefold()
    if content_type != "application/octet-stream":
        raise HTTPException(
            status_code=415,
            detail={
                "code": "unsupported_media_type",
                "message": "Uploads must be sent as an application/octet-stream body.",
            },
        )


def _too_large(limit: int) -> HTTPException:
    return HTTPException(
        status_code=413,
        detail={
            "code": "document_too_large",
            "message": f"The file exceeds the {limit // (1024 * 1024)} MiB upload limit.",
            "max_bytes": limit,
        },
    )


async def read_bounded_body(request: Request, limit: int) -> bytes:
    """Read the request body into memory, refusing as soon as it exceeds ``limit``.

    ``Content-Length`` only allows an early refusal; the count of bytes actually
    received is what is enforced (chunked bodies have no length at all)."""
    declared = request.headers.get("content-length")
    if declared is not None:
        try:
            if int(declared) > limit:
                raise _too_large(limit)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_content_length", "message": "Bad Content-Length."},
            ) from None
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > limit:
            body.clear()
            raise _too_large(limit)
        body.extend(chunk)
    return bytes(body)


async def _upload_prelude(
    request: Request, settings: Settings, runtime: DocumentRuntime
) -> tuple[UploadMeta, str]:
    # Everything cheap is checked before a single body byte is read.
    enforce_same_origin(request, settings)
    _require_enabled(runtime)
    _require_octet_stream(request)
    meta = _parse_meta(request)
    try:
        key = service.check_idempotency_key(request.headers.get("idempotency-key"))
    except DocumentError as error:
        raise _http(error) from None
    return meta, key


# ───────────────────────────── routes ─────────────────────────────


@router.get("/status", response_model=DocumentStatusOut)
def document_status(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    runtime: Annotated[DocumentRuntime, Depends(get_runtime)],
):
    settings = runtime.settings
    enabled = settings.documents_enabled and runtime.keyring is not None
    count, used = service.usage(db, user.id) if enabled else (None, None)
    return DocumentStatusOut(
        enabled=enabled,
        accepted_types=list(ACCEPTED_TYPES),
        max_bytes=settings.document_max_bytes,
        max_documents=settings.document_max_per_account,
        max_account_bytes=settings.document_max_account_bytes,
        document_count=count,
        used_bytes=used,
        protection="server_side_at_rest",
    )


@router.get("", response_model=DocumentListOut)
def list_documents(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    runtime: Annotated[DocumentRuntime, Depends(get_runtime)],
):
    try:
        views = service.list_documents(db, runtime, user.id)
    except DocumentError as error:
        raise _http(error) from None
    return DocumentListOut(documents=[_document_out(view) for view in views])


@router.post("", response_model=DocumentOut)
async def upload_document(
    request: Request,
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_request_settings)],
    runtime: Annotated[DocumentRuntime, Depends(get_runtime)],
    slots: Annotated[TransferSlots, Depends(get_slots)],
):
    meta, key = await _upload_prelude(request, settings, runtime)
    owner = user.id
    with slots.hold():
        content = await read_bounded_body(request, settings.document_max_bytes)

        def work():
            with request.app.state.session_factory() as db:
                return service.create_document(
                    db, runtime, owner, content=content, meta=meta, idempotency_key=key
                )

        try:
            view, created = await run_in_threadpool(work)
        except DocumentError as error:
            raise _http(error) from None
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return _document_out(view)


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    runtime: Annotated[DocumentRuntime, Depends(get_runtime)],
):
    try:
        return _document_out(service.get_document(db, runtime, user.id, document_id))
    except DocumentError as error:
        raise _http(error) from None


@router.patch(
    "/{document_id}",
    response_model=DocumentOut,
    dependencies=[Depends(require_json_content_type)],
)
def update_document(
    document_id: UUID,
    body: MetadataUpdate,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
    runtime: Annotated[DocumentRuntime, Depends(get_runtime)],
):
    enforce_same_origin(request, settings)
    try:
        view = service.update_metadata(
            db,
            runtime,
            user.id,
            document_id,
            expected_revision=body.expected_revision,
            title=body.title,
            notes=body.notes,
        )
    except DocumentError as error:
        raise _http(error) from None
    return _document_out(view)


@router.post("/{document_id}/versions", response_model=DocumentOut)
async def upload_version(
    document_id: UUID,
    request: Request,
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_request_settings)],
    runtime: Annotated[DocumentRuntime, Depends(get_runtime)],
    slots: Annotated[TransferSlots, Depends(get_slots)],
):
    meta, key = await _upload_prelude(request, settings, runtime)
    raw_revision = request.headers.get(EXPECTED_REVISION_HEADER, "")
    if not raw_revision.isdigit() or int(raw_revision) < 1:
        raise HTTPException(
            status_code=428,
            detail={
                "code": "expected_revision_required",
                "message": f"{EXPECTED_REVISION_HEADER} must name the document revision.",
            },
        )
    expected = int(raw_revision)
    owner = user.id
    with slots.hold():
        content = await read_bounded_body(request, settings.document_max_bytes)

        def work():
            with request.app.state.session_factory() as db:
                return service.add_version(
                    db,
                    runtime,
                    owner,
                    document_id,
                    content=content,
                    meta=meta,
                    idempotency_key=key,
                    expected_revision=expected,
                )

        try:
            view, created = await run_in_threadpool(work)
        except DocumentError as error:
            raise _http(error) from None
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return _document_out(view)


def content_disposition(filename: str) -> str:
    fallback = "".join(
        ch if ch.isascii() and (ch.isalnum() or ch in "._- ") else "_" for ch in filename
    ).strip() or "document"
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename, safe='')}"


def _download(
    request: Request,
    user: User,
    runtime: DocumentRuntime,
    slots: TransferSlots,
    document_id: UUID,
    number: int | None,
) -> Response:
    with slots.hold():
        with request.app.state.session_factory() as db:
            try:
                result = service.read_content(db, runtime, user.id, document_id, number)
            except DocumentError as error:
                raise _http(error) from None
    return Response(
        content=result.content,
        media_type=result.content_type,
        headers={
            "Content-Disposition": content_disposition(result.filename),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cross-Origin-Resource-Policy": "same-origin",
            "X-LifeOS-Document-Version": str(result.version_number),
        },
    )


@router.get("/{document_id}/content")
def download_current(
    document_id: UUID,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    runtime: Annotated[DocumentRuntime, Depends(get_runtime)],
    slots: Annotated[TransferSlots, Depends(get_slots)],
):
    return _download(request, user, runtime, slots, document_id, None)


@router.get("/{document_id}/versions/{number}/content")
def download_version(
    document_id: UUID,
    number: int,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    runtime: Annotated[DocumentRuntime, Depends(get_runtime)],
    slots: Annotated[TransferSlots, Depends(get_slots)],
):
    if number < 1:
        raise _http(service.not_found())
    return _download(request, user, runtime, slots, document_id, number)


@router.delete("/{document_id}", dependencies=[Depends(require_json_content_type)])
def delete_document(
    document_id: UUID,
    body: DeleteRequest,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_request_settings)],
    runtime: Annotated[DocumentRuntime, Depends(get_runtime)],
):
    enforce_same_origin(request, settings)
    _require_enabled(runtime)
    try:
        service.delete_document(db, user.id, document_id, expected_revision=body.expected_revision)
    except DocumentError as error:
        raise _http(error) from None
    return Response(status_code=204)
