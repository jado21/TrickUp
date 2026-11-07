"""Limita el cuerpo completo antes y durante el parseo multipart de FastAPI."""

import asyncio

from starlette.responses import JSONResponse

from app.schemas.common import ErrorBody, ErrorResponse
from app.services.pdf_service import MAX_PDF_BYTES

MAX_REQUEST_BYTES = MAX_PDF_BYTES + 64 * 1024


class SyllabusBodyLimitMiddleware:
    def __init__(self, app):
        self.app = app
        self.slots = asyncio.Semaphore(2)

    async def reject(self, scope, receive, send, status, message):
        body = ErrorResponse(error=ErrorBody(code="HTTP_ERROR", message=message))
        await JSONResponse(status_code=status, content=body.model_dump())(scope, receive, send)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"].rstrip("/") != "/api/syllabus/analyze":
            return await self.app(scope, receive, send)

        if self.slots.locked():
            return await self.reject(scope, receive, send, 429, "Hay dos análisis en curso. Intenta nuevamente más tarde.")
        async with self.slots:
            return await self.handle_upload(scope, receive, send)

    async def handle_upload(self, scope, receive, send):
        message_limit = "La solicitud supera el límite de carga (5 MiB más 64 KiB multipart)."

        headers = dict(scope["headers"])
        try:
            length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            length = 0  # El conteo real se aplica incluso sin Content-Length.
        if length > MAX_REQUEST_BYTES:
            return await self.reject(scope, receive, send, 413, message_limit)
        # Primero acotar el cuerpo: FastAPI convierte errores de receive durante
        # multipart a HTTP 400. Así conservamos el 413 incluso en transferencias chunked.
        data = bytearray()
        try:
            async with asyncio.timeout(30):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    chunk = message.get("body", b"")
                    if len(data) + len(chunk) > MAX_REQUEST_BYTES:
                        return await self.reject(scope, receive, send, 413, message_limit)
                    data.extend(chunk)
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            return await self.reject(scope, receive, send, 408, "Se agotó el tiempo de carga del PDF (30 segundos).")

        delivered = False

        async def replay_receive():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(data), "more_body": False}

        await self.app(scope, replay_receive, send)
