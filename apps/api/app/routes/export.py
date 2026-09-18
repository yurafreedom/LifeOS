from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.dependencies import get_current_user
from app.models import User
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
