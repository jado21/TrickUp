"""Auditoría opt-in: --live autoriza una sola generación real, sin reintentos.

Desde backend/: .venv/Scripts/python.exe scripts/audit_phase2.py --live
No imprime los valores de GEMINI_API_KEY ni GEMINI_MODEL. No forma parte de pytest.
"""

import argparse
import json
import logging
from pathlib import Path
import re
import socket
import sys
import threading
import time
from urllib.parse import quote, quote_plus

import httpx
import pymupdf
from dotenv import dotenv_values
from google.genai import errors, models
import uvicorn

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.config import load_settings
from app.main import app
from app.schemas.common import ErrorResponse
from app.schemas.learning import SyllabusResponse
from app.services.gemini import normalized
from app.services.pdf_service import MAX_PDF_BYTES, extract_text


def make_pdf(text=None, scanned=False):
    with pymupdf.open() as doc:
        page = doc.new_page()
        if text:
            page.insert_text((50, 60), text, fontsize=11)
        if scanned:
            pix = pymupdf.Pixmap(pymupdf.csRGB, (0, 0, 20, 20), False)
            pix.clear_with(255)
            page.insert_image(page.rect, stream=pix.tobytes("png"))
        return doc.tobytes()


def provider_error_details(exc, redact):
    """google-genai 1.75 almacena el cuerpo en APIError.details, no response_json."""
    raw = getattr(exc, "details", None)
    if not isinstance(raw, dict):
        raw = getattr(exc, "response_json", {})
    error = raw.get("error", raw) if isinstance(raw, dict) else {}
    if not isinstance(error, dict):
        error = {}
    result = {
        "http_status": exc.code,
        "message": redact(exc.message or ""),
        "status": redact(getattr(exc, "status", None) or error.get("status", "")),
        "details": [],
    }
    details = error.get("details", [])
    for detail in details if isinstance(details, list) else []:
        if not isinstance(detail, dict):
            continue
        if "reason" in detail:
            result["details"].append({"reason": redact(detail["reason"])})
        violations = detail.get("fieldViolations", [])
        for violation in violations if isinstance(violations, list) else []:
            if isinstance(violation, dict):
                result["details"].append({
                    "field": redact(violation.get("field", "")),
                    "description": redact(violation.get("description", "")),
                })
    return result


def run_audit():
    settings = load_settings()
    env = dotenv_values(BACKEND / ".env")
    key = settings.gemini_api_key.get_secret_value() if settings.gemini_api_key else ""
    report = {"configuration": {
        "env_exists": (BACKEND / ".env").is_file(),
        "key_present": bool(env.get("GEMINI_API_KEY")),
        "model_present": bool(env.get("GEMINI_MODEL")),
        "key_loaded_matches_file": bool(key) and key == env.get("GEMINI_API_KEY"),
        "model_loaded_matches_file": settings.gemini_model == env.get("GEMINI_MODEL"),
    }, "sdk_calls": 0, "local_http": {}}
    if not key or not settings.gemini_model:
        raise RuntimeError("Configuración incompleta; no se enviaron solicitudes a Gemini.")

    def redact(value):
        text = str(value)
        for secret in (key, settings.gemini_model):
            for variant in (secret, quote(secret, safe=""), quote_plus(secret)):
                if variant:
                    text = text.replace(variant, "[REDACTED]")
        text = re.sub(r"AIza[\w-]{20,}", "[REDACTED]", text)
        return re.sub(r"(?i)([?&](?:key|api_key)=)[^&\s]+", r"\1[REDACTED]", text)

    source_file = BACKEND / "tests/fixtures/syllabus-example.txt"
    sample = make_pdf(source_file.read_text(encoding="utf-8"))
    source = extract_text(sample)
    report["pdf_extraction"] = {"text_present": bool(source), "characters": len(source)}
    negative_cases = [
        ("invalid", b"not pdf", "application/pdf", 422),
        ("empty_file", b"", "application/pdf", 422),
        ("blank_pdf", make_pdf(), "application/pdf", 422),
        ("scanned_pdf", make_pdf(scanned=True), "application/pdf", 422),
        ("wrong_mime", sample, "text/plain", 415),
        ("oversized_pdf", b"%PDF-" + b"x" * MAX_PDF_BYTES, "application/pdf", 413),
    ]
    original = models.AsyncModels.generate_content

    async def tracked_generate(self, *args, **kwargs):
        report["sdk_calls"] += 1
        if report["sdk_calls"] > 1:
            raise RuntimeError("La auditoría impide una segunda llamada real.")
        report["request_checks"] = {
            "extracted_text_sent": source in kwargs["contents"],
            "configured_model_used": kwargs["model"] == settings.gemini_model,
            "structured_output": bool(kwargs["config"].response_json_schema),
            "sdk_attempts": kwargs["config"].http_options.retry_options.attempts,
        }
        try:
            return await original(self, *args, **kwargs)
        except errors.APIError as exc:
            report["provider_error"] = provider_error_details(exc, redact)
            raise
        except Exception as exc:
            report["provider_error"] = {"type": type(exc).__name__, "message": redact(str(exc))}
            raise

    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    models.AsyncModels.generate_content = tracked_generate
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="critical", access_log=False))
    thread = threading.Thread(target=server.run, daemon=True)
    logging.disable(logging.CRITICAL)  # No imprimir tracebacks del SDK ni credenciales.
    thread.start()
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=75, trust_env=False, follow_redirects=True) as client:
            deadline = time.monotonic() + 15
            while not server.started and time.monotonic() < deadline:
                time.sleep(0.05)
            if not server.started:
                raise RuntimeError("Uvicorn no arrancó; no se llamó a Gemini.")
            report["uvicorn_started"] = True
            for path in ("/api/health", "/docs", "/openapi.json", "/api/docs", "/api/openapi.json"):
                response = client.get(path)
                report["local_http"][path] = response.status_code
                assert response.status_code == 200
            spec = client.get("/openapi.json").json()
            report["syllabus_registered"] = "post" in spec["paths"].get("/api/syllabus/analyze", {})
            response = client.options("/api/syllabus/analyze", headers={
                "Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type",
            })
            report["cors"] = response.status_code == 200 and response.headers.get("access-control-allow-origin") == "http://localhost:3000"
            report["negative_pdf_cases"] = {}
            for name, data, mime, expected in negative_cases:
                response = client.post("/api/syllabus/analyze", files={"file": ("sample.pdf", data, mime)})
                ErrorResponse.model_validate(response.json())
                report["negative_pdf_cases"][name] = {"expected": expected, "actual": response.status_code}
                assert response.status_code == expected
            assert report["sdk_calls"] == 0
            print("Uvicorn, documentación, CORS y casos negativos: correctos. Ejecutando la única generación real.", flush=True)
            response = client.post("/api/syllabus/analyze", files={"file": ("sample.pdf", sample, "application/pdf")}, headers={"Origin": "http://localhost:3000"})
            body = response.json()
            report["live_http_status"] = response.status_code
            report["key_absent_from_response"] = key not in response.text
            report["live_cors"] = response.headers.get("access-control-allow-origin") == "http://localhost:3000"
            report["live_response"] = body
            assert report["sdk_calls"] == 1
            assert report["key_absent_from_response"]
            if response.status_code == 200:
                result = SyllabusResponse.model_validate_json(response.content, strict=True)
                report["pydantic_valid"] = True
                texts = [result.course_name, result.summary]
                level_titles = []
                ids = []
                for unit in result.units:
                    texts.append(unit.title)
                    ids.append(unit.id)
                    for level in unit.levels:
                        ids.append(level.id)
                        texts.extend([level.title, *level.objectives])
                        level_titles.append(level.title)
                report["content_checks"] = {
                    "all_academic_text_is_in_pdf": all(normalized(text) in normalized(source) for text in texts),
                    "course_matches_fixture": normalized(result.course_name) == normalized("Cálculo I"),
                    "one_unit_two_levels": len(result.units) == 1 and len(level_titles) == 2,
                    "expected_topic_order": len(level_titles) == 2 and normalized("Concepto de límite") in normalized(level_titles[0]) and normalized("Continuidad de funciones") in normalized(level_titles[1]),
                    "unique_ids": len(ids) == len(set(ids)),
                    "public_fields_match_contract": set(body) == {"course_name", "summary", "units"},
                }
                report["phase2_approved"] = all(report["content_checks"].values()) and report["cors"] and report["live_cors"] and all(report["configuration"].values())
            else:
                ErrorResponse.model_validate(body)
                report["pydantic_error_valid"] = True
                report["phase2_approved"] = False
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        models.AsyncModels.generate_content = original
        report["uvicorn_stopped"] = not thread.is_alive()
        folder = BACKEND / ".tmp"
        folder.mkdir(exist_ok=True)
        safe_report = redact(json.dumps(report, ensure_ascii=False, indent=2))
        (folder / "qa-audit-result.json").write_text(safe_report + "\n", encoding="utf-8")
        print(safe_report)
    return 0 if report.get("phase2_approved") else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Ejecuta exactamente una generación real (puede consumir tokens).")
    if not parser.parse_args().live:
        parser.error("Se requiere --live para autorizar la única solicitud real.")
    raise SystemExit(run_audit())
