"""Límite de JSON de misiones antes del parseo; sin cambios al middleware de PDF."""

import asyncio

from starlette.responses import JSONResponse

from app.schemas.common import ErrorBody, ErrorResponse


class MissionBodyLimitMiddleware:
    MAX_BYTES = 128 * 1024

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST" or scope["path"].rstrip("/") not in ("/api/missions/generate", "/api/missions/answer"):
            return await self.app(scope, receive, send)

        async def reject(status, message):
            body = ErrorResponse(error=ErrorBody(code="HTTP_ERROR", message=message))
            await JSONResponse(status_code=status, content=body.model_dump())(scope, receive, send)

        body = bytearray()
        try:
            async with asyncio.timeout(30):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    chunk = message.get("body", b"")
                    if len(body) + len(chunk) > self.MAX_BYTES:
                        return await reject(413, "El cuerpo JSON supera 128 KiB.")
                    body.extend(chunk)
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            return await reject(408, "Se agotó el tiempo de carga de la solicitud.")
        delivered = False
        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}
        await self.app(scope, replay, send)
