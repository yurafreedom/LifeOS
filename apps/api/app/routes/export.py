import threading
import weakref
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.config import Settings
from app.dependencies import get_current_user, get_request_settings
from app.models import User
from app.routes.documents import TransferSlots, get_runtime, get_slots
from app.services.auth import resolve_session
from app.services.documents.export import stream_documents_export
from app.services.documents.service import DocumentError, DocumentRuntime
from app.services.export import build_account_export, stream_archive

router = APIRouter(prefix="/api/v1", tags=["account"])


@router.get("/export")
def export_account(request: Request, user: Annotated[User, Depends(get_current_user)]):
    archive = build_account_export(request.app.state.session_factory, user_id=user.id)
    return StreamingResponse(
        stream_archive(archive),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="lifeos-account.zip"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
        background=BackgroundTask(archive.close),
    )


@router.get("/export/documents")
def export_documents(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_request_settings)],
    runtime: Annotated[DocumentRuntime, Depends(get_runtime)],
    slots: Annotated[TransferSlots, Depends(get_slots)],
):
    """Decrypted documents — only on this explicit, authenticated, account-bound
    request. Streamed without a server temporary file (services/documents/export.py)."""
    try:
        runtime.require_keyring()
    except DocumentError as error:
        raise HTTPException(
            status_code=error.status, detail={"code": error.code, "message": error.message}
        ) from None
    if not slots.try_acquire():
        raise HTTPException(
            status_code=503,
            detail={"code": "documents_busy", "message": "Too many document transfers."},
            headers={"Retry-After": "5"},
        )
    factory = request.app.state.session_factory
    raw_token = request.cookies.get(settings.cookie_name) or ""
    owner = user.id
    release_lock = threading.Lock()
    released = False

    def release_once() -> None:
        nonlocal released
        with release_lock:
            if not released:
                released = True
                slots.release()

    def still_authorized() -> bool:
        with factory() as db:
            current = resolve_session(db, raw_token, settings, touch=False)
            return current is not None and current.user.id == owner

    def body():
        try:
            yield from stream_documents_export(
                factory, runtime, owner=owner, still_authorized=still_authorized
            )
        finally:
            release_once()

    stream = body()
    # A stream that is never started (client gone before the first byte) never
    # runs its ``finally``; release the slot when it is collected instead.
    weakref.finalize(stream, release_once)
    return StreamingResponse(
        stream,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="jenkin-documents.zip"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
