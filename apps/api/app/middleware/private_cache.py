"""Private-response caching policy (JENKIN S1).

Every ``/api/`` response is account-private or security-relevant (auth errors,
session state), so no browser, proxy or back/forward cache may store it, and
no shared cache may answer one account's request with another's response. A
route that already set ``Cache-Control`` keeps it (they all say ``no-store``);
the liveness probe ``/api/healthz`` is public and left alone.
"""

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

PUBLIC_PATHS = frozenset({"/api/healthz"})


class PrivateNoStoreMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "") if scope["type"] == "http" else ""
        if not path.startswith("/api/") or path in PUBLIC_PATHS:
            await self.app(scope, receive, send)
            return

        async def send_private(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                if "cache-control" not in headers:
                    headers["Cache-Control"] = "no-store"
                headers["Pragma"] = "no-cache"
                headers.setdefault("X-Content-Type-Options", "nosniff")
                existing_vary = headers.get("vary")
                if existing_vary is None:
                    headers["Vary"] = "Cookie"
                elif "cookie" not in existing_vary.casefold():
                    headers["Vary"] = f"{existing_vary}, Cookie"
            await send(message)

        await self.app(scope, receive, send_private)
