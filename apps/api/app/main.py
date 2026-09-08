from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, sessionmaker
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import Settings, get_settings
from app.db import create_engine_from_settings, create_session_factory
from app.middleware.body_limit import SnapshotBodyLimitMiddleware
from app.routes import aa_history, aa_measurements, auth, health, state


def create_app(
    settings: Settings | None = None,
    session_factory: sessionmaker[Session] | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()
    resolved_factory = session_factory
    if resolved_factory is None:
        engine = create_engine_from_settings(resolved_settings)
        resolved_factory = create_session_factory(engine)

    app = FastAPI(
        title="LifeOS API",
        version="0.1.0",
        docs_url=None if resolved_settings.environment == "production" else "/docs",
        redoc_url=None,
    )
    app.state.settings = resolved_settings
    app.state.session_factory = resolved_factory

    app.add_middleware(
        SnapshotBodyLimitMiddleware,
        max_bytes=resolved_settings.max_snapshot_bytes,
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=resolved_settings.allowed_hosts)

    @app.exception_handler(HTTPException)
    async def stable_http_error(_request: Request, error: HTTPException) -> JSONResponse:
        if isinstance(error.detail, dict) and {"code", "message"} <= error.detail.keys():
            return JSONResponse(status_code=error.status_code, content=error.detail)
        return JSONResponse(status_code=error.status_code, content={"detail": error.detail})

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(state.router)
    app.include_router(aa_measurements.router)
    app.include_router(aa_history.router)
    return app
