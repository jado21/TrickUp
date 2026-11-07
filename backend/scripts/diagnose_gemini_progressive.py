"""A → B → C, máximo tres llamadas reales y parada en el primer fallo.

Opt-in: desde backend/ ejecutar con --live. Nunca invocar desde pytest.
"""

import argparse
import asyncio
import json
import logging
from pathlib import Path
import re
import sys
from urllib.parse import quote, quote_plus

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from google import genai
from google.genai import errors, models, types
from pydantic import ValidationError

from app.config import load_settings
from app.schemas.common import ContractModel
from app.schemas.learning import SyllabusResponse
from app.services.errors import ServiceError
from app.services.gemini import GeminiService
from scripts.audit_phase2 import make_pdf, provider_error_details
from app.services.pdf_service import extract_text

BACKEND = Path(__file__).resolve().parents[1]
MINIMAL_SCHEMA = {
    "type": "object", "properties": {"status": {"type": "string"}, "count": {"type": "integer"}},
    "required": ["status", "count"], "additionalProperties": False,
}


class MinimalResponse(ContractModel):
    status: str
    count: int


async def run_sequence(model, source, generate, academic, error_details, on_stage=lambda stage: None):
    """El orden y la parada se prueban sin usar el SDK real."""
    report = {"stages": [], "academic_generation_works": False}
    for stage in ("A", "B", "C"):
        on_stage(stage)
        item = {"stage": stage}
        report["stages"].append(item)
        try:
            if stage == "A":
                # Sin config ni parámetros opcionales de generación.
                response = await generate(model=model, contents="Responde únicamente OK.")
            elif stage == "B":
                response = await generate(model=model, contents="Devuelve un objeto JSON con status igual a ok y count igual a 1.", config=types.GenerateContentConfig(
                    response_mime_type="application/json", response_json_schema=MINIMAL_SCHEMA,
                ))
            else:
                result = await academic(source)
                validated = SyllabusResponse.model_validate(result)
                item.update(status="PASSED", response=validated.model_dump())
                report["academic_generation_works"] = True
                continue
            if not response.candidates or response.candidates[0].finish_reason != types.FinishReason.STOP or not response.text or not response.text.strip():
                raise ValueError("Respuesta vacía, bloqueada o incompleta.")
            if stage == "B":
                value = MinimalResponse.model_validate_json(response.text, strict=True)
                item.update(status="PASSED", response=value.model_dump())
            else:
                item.update(status="PASSED", response=response.text)
        except Exception as exc:
            item.update(status="FAILED", error=error_details(exc))
            report["stopped_at"] = stage
            return report
    return report


async def main():
    settings = load_settings()
    if not settings.gemini_api_key or settings.gemini_model != "gemini-3.5-flash-lite":
        raise RuntimeError("Falta configuración o el modelo no coincide con el autorizado; cero llamadas.")
    key = settings.gemini_api_key.get_secret_value()
    def redact(value):
        text = str(value)
        for secret in (key,):
            for variant in (secret, quote(secret, safe=""), quote_plus(secret)):
                text = text.replace(variant, "[REDACTED]")
        text = re.sub(r"AIza[\w-]{20,}", "[REDACTED]", text)
        return re.sub(r"(?i)([?&](?:key|api_key)=)[^&\s]+", r"\1[REDACTED]", text)

    state = {"calls": 0, "stage": None, "provider_error": None}
    original = models.AsyncModels.generate_content
    async def tracked(self, *args, **kwargs):
        if state["calls"] >= 3:
            raise RuntimeError("Presupuesto de tres llamadas agotado.")
        state["calls"] += 1
        try:
            return await original(self, *args, **kwargs)
        except errors.APIError as exc:
            state["provider_error"] = provider_error_details(exc, redact)
            raise

    def error_details(exc):
        if state["provider_error"]:
            return state["provider_error"]
        if isinstance(exc, ServiceError):
            return {"type": "ServiceError", "http_status": exc.status, "message": exc.message}
        if isinstance(exc, ValidationError):
            return {"type": "ValidationError", "message": "Respuesta incompatible con Pydantic."}
        return {"type": type(exc).__name__, "message": redact(str(exc))}

    def on_stage(stage):
        state["stage"] = stage
        state["provider_error"] = None
        print(f"Ejecutando prueba {stage}; sin reintentos.", flush=True)

    async def generate(**kwargs):
        # Timeout y retries en el transporte, fuera del cuerpo de generación A.
        with genai.Client(api_key=key, http_options=types.HttpOptions(timeout=45000, retry_options=types.HttpRetryOptions(attempts=1))) as client:
            async with client.aio as api:
                async with asyncio.timeout(60):
                    return await api.models.generate_content(**kwargs)

    source = extract_text(make_pdf((BACKEND / "tests/fixtures/syllabus-example.txt").read_text(encoding="utf-8")))
    models.AsyncModels.generate_content = tracked
    logging.disable(logging.CRITICAL)
    try:
        report = await run_sequence(settings.gemini_model, source, generate, GeminiService(settings).analyze_syllabus, error_details, on_stage)
        report.update(sdk_version=genai.__version__, real_calls=state["calls"], retries=0)
        safe = redact(json.dumps(report, ensure_ascii=False, indent=2))
        folder = BACKEND / ".tmp"
        folder.mkdir(exist_ok=True)
        (folder / "gemini-progressive-result.json").write_text(safe + "\n", encoding="utf-8")
        print(safe)
        return 0 if report["academic_generation_works"] else 1
    finally:
        models.AsyncModels.generate_content = original


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    if not parser.parse_args().live:
        parser.error("Requiere --live: puede consumir hasta tres generaciones reales.")
    raise SystemExit(asyncio.run(main()))
