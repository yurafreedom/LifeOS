"""The Adaptive Analytics write gate.

Slice 0 creates the ability to record personal semantic history; the export and
erasure foundation that must accompany it lands in Slice 0b. Until then no
production deployment may accumulate that history, so every AA write path is
closed unless a deployment opts in — and :class:`app.config.Settings` refuses the
opt-in outright when the environment is production.

The gate exists here, ahead of the slice that formally introduces it, because a
write endpoint must never be reachable before the guard that protects it.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.config import Settings
from app.dependencies import get_request_settings


def require_aa_write_enabled(
    settings: Annotated[Settings, Depends(get_request_settings)],
) -> None:
    if not settings.aa_write_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "aa_writes_disabled",
                "message": "Adaptive Analytics writes are not enabled.",
            },
        )
