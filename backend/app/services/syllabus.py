import asyncio

from fastapi import UploadFile

from app.services.errors import ServiceError
from app.services.gemini import GeminiService
from app.services.pdf_service import extract_text, read_pdf


class SyllabusService:
    def __init__(self, gemini: GeminiService):
        self.gemini = gemini
        self.slots = asyncio.Semaphore(2)

    async def analyze(self, file: UploadFile):
        if self.slots.locked():
            await file.close()
            raise ServiceError(429, "HTTP_ERROR", "Hay dos análisis en curso. Intenta nuevamente más tarde.")
        async with self.slots:
            text = extract_text(await read_pdf(file))
            return await self.gemini.analyze_syllabus(text)
