"""Extracción acotada en memoria. No ejecuta OCR ni guarda archivos."""

import re

import pymupdf
from fastapi import UploadFile

from app.services.errors import ServiceError

MAX_PDF_BYTES = 5 * 1024 * 1024
MAX_PAGES = 40
MAX_TEXT_CHARS = 60_000


async def read_pdf(file: UploadFile) -> bytes:
    try:
        if (file.content_type or "").split(";")[0].strip().lower() != "application/pdf":
            raise ServiceError(415, "HTTP_ERROR", "El archivo debe tener MIME application/pdf.")
        data = await file.read(MAX_PDF_BYTES + 1)
        if len(data) > MAX_PDF_BYTES:
            raise ServiceError(413, "HTTP_ERROR", "El PDF supera el límite de 5 MiB.")
        if not data or not data.startswith(b"%PDF-"):
            raise ServiceError(422, "VALIDATION_ERROR", "El archivo no contiene un PDF válido.")
        return data
    finally:
        await file.close()


def extract_text(data: bytes) -> str:
    # Se invoca sin await desde el event loop: no usar PyMuPDF concurrentemente
    # desde varios threads. Archivos/páginas/texto están acotados para este MVP.
    try:
        with pymupdf.open(stream=data, filetype="pdf") as document:
            if not document.is_pdf:
                raise ServiceError(422, "VALIDATION_ERROR", "El archivo no contiene un PDF válido.")
            if document.needs_pass:
                raise ServiceError(422, "VALIDATION_ERROR", "El PDF está protegido con contraseña.")
            if document.page_count > MAX_PAGES:
                raise ServiceError(413, "HTTP_ERROR", "El PDF supera el límite de 40 páginas.")
            pages: list[str] = []
            total = 0
            for page in document:
                # TEXTFLAGS_TEXT excluye imágenes: solo enviamos texto al modelo.
                raw = page.get_text("text", flags=pymupdf.TEXTFLAGS_TEXT, sort=True)
                if len(raw) > MAX_TEXT_CHARS:
                    raise ServiceError(413, "HTTP_ERROR", "El texto del PDF supera 60000 caracteres.")
                text = "\n".join(line.strip() for line in raw.splitlines() if line.strip())
                if text:
                    total += len(text) + (2 if pages else 0)
                    if total > MAX_TEXT_CHARS:
                        raise ServiceError(413, "HTTP_ERROR", "El texto del PDF supera 60000 caracteres.")
                    pages.append(text)
            result = "\n\n".join(pages)
            if not re.search(r"[^\W\d_]", result, flags=re.UNICODE):
                raise ServiceError(422, "VALIDATION_ERROR", "El PDF no tiene texto académico extraíble. Si es escaneado, requiere OCR; esta fase no incluye OCR.")
            return result
    except ServiceError:
        raise
    except (pymupdf.FileDataError, RuntimeError, ValueError):
        raise ServiceError(422, "VALIDATION_ERROR", "No se pudo leer el PDF; puede estar dañado.") from None
