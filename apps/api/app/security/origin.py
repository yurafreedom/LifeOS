from urllib.parse import urlsplit

from fastapi import HTTPException, Request, status

from app.config import Settings


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "forbidden_origin", "message": "Request origin is not allowed."},
    )


def enforce_same_origin(request: Request, settings: Settings) -> None:
    if request.headers.get("sec-fetch-site", "").casefold() == "cross-site":
        raise _forbidden()

    origin = request.headers.get("origin")
    if origin:
        if origin.rstrip("/") not in settings.allowed_origins:
            raise _forbidden()
        return

    referer = request.headers.get("referer")
    if referer:
        parsed = urlsplit(referer)
        referer_origin = f"{parsed.scheme}://{parsed.netloc}"
        if referer_origin not in settings.allowed_origins:
            raise _forbidden()
        return

    raise _forbidden()


def require_json_content_type(request: Request) -> None:
    content_type = request.headers.get("content-type", "").partition(";")[0].strip().casefold()
    if content_type != "application/json":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"code": "unsupported_media_type", "message": "Content-Type must be JSON."},
        )
