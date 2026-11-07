import asyncio
import io
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pymupdf
import pytest
from fastapi import UploadFile
from fastapi.testclient import TestClient
from google.genai import errors, types
from google.genai.client import Client as TransportTestClient
from starlette.datastructures import Headers

from app.api.upload_limits import MAX_REQUEST_BYTES, SyllabusBodyLimitMiddleware
from app.config import Settings
from app.main import app
from app.schemas.learning import SyllabusResponse
from app.services.errors import ServiceError
from app.services.gemini import GeminiService
from app.services.gemini_schema import generation_schema
from app.services.pdf_service import MAX_PDF_BYTES, extract_text, read_pdf
from app.services.syllabus import SyllabusService

SOURCE = """Curso: Calculo I
Descripcion: Fundamentos de limites y derivadas.
Unidad 1: Limites
Tema: Concepto de limite
Objetivo: Interpretar limites en una grafica
"""


def pdf_bytes(text=SOURCE, *, encrypted=False, pages=1):
    with pymupdf.open() as doc:
        for _ in range(pages):
            page = doc.new_page()
            if text:
                page.insert_text((50, 60), text)
        if encrypted:
            return doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="test")
        return doc.tobytes()


def supported(text):
    return {"text": text, "source_quote": text}


def analysis():
    return {"is_syllabus": True, "syllabus": {
        "course_name": supported("Calculo I"),
        "summary": supported("Fundamentos de limites y derivadas."),
        "units": [{"title": supported("Limites"), "levels": [{
            "title": supported("Concepto de limite"),
            "objectives": [supported("Interpretar limites en una grafica")],
        }]}],
    }}


@pytest.fixture
def sdk(monkeypatch):
    monkeypatch.setitem(app.state._state, "syllabus_service", SyllabusService(GeminiService(Settings(
        gemini_api_key="test-not-real", gemini_model="configured-test-model",
    ))))
    async_client = MagicMock()
    async_client.models.generate_content = AsyncMock(return_value=SimpleNamespace(
        candidates=[SimpleNamespace(finish_reason=types.FinishReason.STOP)],
        text=json.dumps(analysis()),
    ))
    constructor = MagicMock()
    constructor.return_value.aio.__aenter__ = AsyncMock(return_value=async_client)
    constructor.return_value.aio.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr("app.services.gemini.genai.Client", constructor)
    return async_client.models.generate_content, constructor


def upload(client, content=None, mime="application/pdf"):
    return client.post("/api/syllabus/analyze", files={"file": ("syllabus.pdf", content if content is not None else pdf_bytes(), mime)})


def test_success_pdf_to_sdk_to_public_contract(client, sdk):
    generate, constructor = sdk
    response = upload(client)
    assert response.status_code == 200
    result = SyllabusResponse.model_validate(response.json())
    assert result.course_name == "Calculo I"
    assert result.units[0].levels[0].objectives == ["Interpretar limites en una grafica"]
    assert set(response.json()) == {"course_name", "summary", "units"}
    assert "source_quote" not in response.text
    generate.assert_awaited_once()
    args = generate.call_args.kwargs
    assert args["model"] == "configured-test-model"
    assert "Concepto de limite" in args["contents"]
    assert "%PDF-" not in args["contents"]
    assert args["config"].response_json_schema
    assert args["config"].http_options.retry_options.attempts == 1
    constructor.return_value.aio.__aexit__.assert_awaited_once()


@pytest.mark.parametrize("content,mime,status", [
    (b"", "application/pdf", 422), (b"not a PDF", "application/pdf", 422),
    (b"%PDF-corrupted", "application/pdf", 422), (b"test", "text/plain", 415),
    (b"%PDF-" + b"x" * MAX_PDF_BYTES, "application/pdf", 413),
])
def test_invalid_upload_never_calls_gemini(client, sdk, content, mime, status):
    response = upload(client, content, mime)
    assert response.status_code == status
    assert response.json()["error"]["message"]
    sdk[0].assert_not_awaited()


@pytest.mark.parametrize("kind", ["empty", "scanned", "encrypted", "many_pages"])
def test_pdf_content_errors(client, sdk, kind):
    if kind == "encrypted":
        data = pdf_bytes(encrypted=True)
    elif kind == "many_pages":
        data = pdf_bytes(pages=41)
    elif kind == "scanned":
        with pymupdf.open() as doc:
            page = doc.new_page()
            pix = pymupdf.Pixmap(pymupdf.csRGB, (0, 0, 20, 20), False)
            pix.clear_with(255)
            page.insert_image(page.rect, stream=pix.tobytes("png"))
            data = doc.tobytes()
    else:
        data = pdf_bytes("")
    response = upload(client, data)
    assert response.status_code == (413 if kind == "many_pages" else 422)
    if kind in ("empty", "scanned"):
        assert "OCR" in response.json()["error"]["message"]
    sdk[0].assert_not_awaited()


def test_excessive_extracted_text(client, sdk, monkeypatch):
    monkeypatch.setattr("app.services.pdf_service.MAX_TEXT_CHARS", 10)
    assert upload(client).status_code == 413
    sdk[0].assert_not_awaited()


def test_missing_configuration(client):
    response = upload(client)
    assert response.status_code == 503
    assert "GEMINI_MODEL" in response.json()["error"]["message"]


@pytest.mark.parametrize("code,status", [(400, 502), (401, 503), (403, 503), (404, 503), (429, 429), (500, 502), (503, 502), (504, 504)])
def test_provider_errors_are_sanitized_and_not_retried(client, sdk, code, status):
    sdk[0].side_effect = errors.APIError(code, {"error": {"message": "secret-key-and-private-pdf"}})
    response = upload(client)
    assert response.status_code == status
    assert "secret-key" not in response.text
    assert response.json()["error"]["code"] == "HTTP_ERROR"
    sdk[0].assert_awaited_once()


@pytest.mark.parametrize("exc,status", [
    (TimeoutError(), 504), (httpx.ReadTimeout("private-data"), 504),
    (httpx.ConnectError("secret-key"), 502),
])
def test_network_failures(client, sdk, exc, status):
    sdk[0].side_effect = exc
    response = upload(client)
    assert response.status_code == status
    assert "private-data" not in response.text and "secret-key" not in response.text
    sdk[0].assert_awaited_once()


@pytest.mark.parametrize("text,finish", [("not json", "STOP"), ("{}", "STOP"), ("", "STOP"), (json.dumps(analysis()), "MAX_TOKENS"), (json.dumps(analysis()), "SAFETY")])
def test_invalid_responses(client, sdk, text, finish):
    sdk[0].return_value.text = text
    sdk[0].return_value.candidates[0].finish_reason = finish
    assert upload(client).status_code == 502
    sdk[0].assert_awaited_once()


@pytest.mark.parametrize("case", ["invented_quote", "invented_text", "missing_syllabus", "inconsistent", "extra_public_field"])
def test_unsubstantiated_or_inconsistent_analysis(client, sdk, case):
    data = analysis()
    if case == "invented_quote":
        data["syllabus"]["units"][0]["title"] = supported("Quantum computing")
    elif case == "invented_text":
        data["syllabus"]["course_name"]["text"] = "Invented course"
    elif case == "missing_syllabus":
        data["syllabus"] = None
    elif case == "inconsistent":
        data["is_syllabus"] = False
    else:
        data["syllabus"]["description"] = "extra"
    sdk[0].return_value.text = json.dumps(data)
    assert upload(client).status_code == 502


def test_not_a_syllabus(client, sdk):
    sdk[0].return_value.text = json.dumps({"is_syllabus": False, "syllabus": None})
    assert upload(client).status_code == 422


def test_reject_extra_multipart_fields(client, sdk):
    response = client.post("/api/syllabus/analyze", data={"extra": "unexpected"}, files={"file": ("test.pdf", pdf_bytes(), "application/pdf")})
    assert response.status_code == 422
    sdk[0].assert_not_awaited()


def test_reject_duplicate_files(client, sdk):
    response = client.post("/api/syllabus/analyze", files=[("file", ("a.pdf", pdf_bytes(), "application/pdf")), ("file", ("b.pdf", pdf_bytes(), "application/pdf"))])
    assert response.status_code == 422
    sdk[0].assert_not_awaited()


def test_unsupported_schema_does_not_retry(client, sdk):
    sdk[0].side_effect = errors.APIError(400, {"error": {"message": "response_json_schema not supported"}})
    assert upload(client).status_code == 503
    sdk[0].assert_awaited_once()


def test_non_structured_mode_still_validates(client, sdk):
    app.state.syllabus_service.gemini.settings.gemini_structured_output = False
    assert upload(client).status_code == 200
    config = sdk[0].call_args.kwargs["config"]
    assert config.response_json_schema is None
    assert "ESQUEMA JSON" in sdk[0].call_args.kwargs["contents"]


def test_file_closed_on_error_and_success():
    for mime, data in [("application/pdf", b"%PDF-test"), ("text/plain", b"x")]:
        file = UploadFile(io.BytesIO(data), headers=Headers({"content-type": mime}))
        try:
            asyncio.run(read_pdf(file))
        except ServiceError:
            pass
        assert file.file.closed


def test_oversized_body_content_length(client, sdk):
    response = client.post("/api/syllabus/analyze", content=b"x", headers={"Content-Length": str(MAX_REQUEST_BYTES + 1), "Origin": "http://localhost:3000"})
    assert response.status_code == 413
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    sdk[0].assert_not_awaited()


def test_chunked_body_limit_before_multipart_parser():
    async def scenario():
        called = False
        async def downstream(scope, receive, send):
            nonlocal called
            called = True
        middleware = SyllabusBodyLimitMiddleware(downstream)
        messages = iter([
            {"type": "http.request", "body": b"x" * MAX_REQUEST_BYTES, "more_body": True},
            {"type": "http.request", "body": b"x", "more_body": False},
        ])
        async def receive():
            return next(messages)
        sent = []
        async def send(message):
            sent.append(message)
        await middleware({"type": "http", "path": "/api/syllabus/analyze", "headers": []}, receive, send)
        assert not called
        assert sent[0]["status"] == 413
        assert json.loads(sent[1]["body"])["error"]["code"] == "HTTP_ERROR"
    asyncio.run(scenario())


def test_concurrency_limit_releases_slots(client, sdk):
    async def scenario():
        service = app.state.syllabus_service
        await service.slots.acquire()
        await service.slots.acquire()
        file = UploadFile(io.BytesIO(pdf_bytes()), headers=Headers({"content-type": "application/pdf"}))
        try:
            with pytest.raises(ServiceError) as exc:
                await service.analyze(file)
            assert exc.value.status == 429
            assert file.file.closed
        finally:
            service.slots.release()
            service.slots.release()
        assert not service.slots.locked()
    asyncio.run(scenario())


def test_real_sdk_serializes_structured_request_with_mock_transport():
    """Ejercita el SDK instalado, sin red, clave real ni tokens de Gemini."""
    async def scenario():
        requests = []

        def handle(request):
            requests.append(request)
            return httpx.Response(200, json={"candidates": [{
                "content": {"role": "model", "parts": [{"text": json.dumps(analysis())}]},
                "finishReason": "STOP",
            }]})

        transport = httpx.MockTransport(handle)
        async_http = httpx.AsyncClient(transport=transport)
        sdk_client = TransportTestClient(
            api_key="test-not-real",
            http_options=types.HttpOptions(httpx_async_client=async_http),
        )
        service = GeminiService(Settings(gemini_api_key="test-not-real", gemini_model="configured-test-model"))
        service.create_client = lambda: sdk_client
        try:
            result = await service.analyze_syllabus(SOURCE)
            assert result.course_name == "Calculo I"
            assert len(requests) == 1
            request = requests[0]
            assert request.method == "POST"
            assert request.url.path.endswith("/models/configured-test-model:generateContent")
            payload = json.loads(request.content)
            assert SOURCE in payload["contents"][0]["parts"][0]["text"]
            assert payload["generationConfig"]["responseMimeType"] == "application/json"
            assert payload["generationConfig"]["responseJsonSchema"]["type"] == "object"
            assert "http_options" not in payload["generationConfig"]
            assert set(payload["generationConfig"]) == {"responseMimeType", "responseJsonSchema", "maxOutputTokens"}
            assert payload["generationConfig"]["maxOutputTokens"] == 8192
            supported_text = payload["generationConfig"]["responseJsonSchema"]["$defs"]["SupportedText"]
            assert "minLength" not in supported_text["properties"]["text"]
            assert "maxLength" not in supported_text["properties"]["text"]
        finally:
            await async_http.aclose()
            sdk_client.close()
    asyncio.run(scenario())


def test_unexpected_provider_error_does_not_log_or_return_secret(sdk, caplog, capsys):
    sentinel = "audit-fake-key-must-not-leak"
    sdk[0].side_effect = RuntimeError(sentinel)
    with TestClient(app, raise_server_exceptions=False) as client:
        response = upload(client)
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert sentinel not in response.text
    assert sentinel not in caplog.text
    output = capsys.readouterr()
    assert sentinel not in output.out + output.err


def test_original_and_simplified_wire_bodies_only_differ_in_six_bounds(monkeypatch):
    async def scenario():
        captured = []
        for simplified in (False, True):
            def handle(request):
                captured.append({"path": request.url.path, "body": json.loads(request.content)})
                return httpx.Response(200, json={"candidates": [{
                    "content": {"role": "model", "parts": [{"text": json.dumps(analysis())}]},
                    "finishReason": "STOP",
                }]})
            http = httpx.AsyncClient(transport=httpx.MockTransport(handle))
            sdk_client = TransportTestClient(api_key="test-not-real", http_options=types.HttpOptions(httpx_async_client=http))
            service = GeminiService(Settings(gemini_api_key="test-not-real", gemini_model="configured-test-model"))
            service.create_client = lambda: sdk_client
            try:
                with monkeypatch.context() as patch:
                    patch.setattr("app.services.gemini.generation_schema", lambda model: generation_schema(model, omit_array_bounds=simplified))
                    result = await service.analyze_syllabus(SOURCE)
                    assert result.course_name == "Calculo I"
            finally:
                await http.aclose()
                sdk_client.close()
        original, simplified = captured
        assert original["path"] == simplified["path"]
        before = original["body"]
        after = simplified["body"]
        assert {k: v for k, v in before.items() if k != "generationConfig"} == {k: v for k, v in after.items() if k != "generationConfig"}
        assert {k: v for k, v in before["generationConfig"].items() if k != "responseJsonSchema"} == {k: v for k, v in after["generationConfig"].items() if k != "responseJsonSchema"}
        expected = json.loads(json.dumps(before))
        definitions = expected["generationConfig"]["responseJsonSchema"]["$defs"]
        removed = []
        for definition, field, upper in (("DraftSyllabus", "units", 20), ("DraftUnit", "levels", 20), ("DraftLevel", "objectives", 10)):
            array = definitions[definition]["properties"][field]
            assert array.pop("minItems") == 1
            assert array.pop("maxItems") == upper
            removed.extend([f"{definition}.{field}.minItems", f"{definition}.{field}.maxItems"])
        assert len(removed) == 6
        assert expected == after
    asyncio.run(scenario())


@pytest.mark.parametrize("field,size", [("units", 0), ("units", 21), ("levels", 0), ("levels", 21), ("objectives", 0), ("objectives", 11)])
def test_original_pydantic_rejects_invalid_array_sizes(field, size):
    from pydantic import ValidationError
    from app.schemas.syllabus_internal import SyllabusAnalysis

    data = analysis()
    if field == "units":
        data["syllabus"]["units"] = data["syllabus"]["units"] * size
    elif field == "levels":
        unit = data["syllabus"]["units"][0]
        unit["levels"] = unit["levels"] * size
    else:
        level = data["syllabus"]["units"][0]["levels"][0]
        level["objectives"] = level["objectives"] * size
    with pytest.raises(ValidationError):
        SyllabusAnalysis.model_validate(data, strict=True)
