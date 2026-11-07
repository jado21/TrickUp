import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.schemas.learning import SyllabusResponse
from scripts.diagnose_gemini_progressive import run_sequence


def response(text):
    return SimpleNamespace(candidates=[SimpleNamespace(finish_reason="STOP")], text=text)


def academic_result():
    return SyllabusResponse(course_name="Curso", summary="Resumen", units=[{
        "id": "u1", "title": "Unidad", "levels": [{"id": "l1", "title": "Tema", "objectives": ["Objetivo"]}],
    }])


@pytest.mark.parametrize("fail_at", ["A", "B", "C"])
def test_stops_on_first_failure(fail_at):
    outputs = [response("OK"), response('{"status":"ok","count":1}')]
    academic = AsyncMock(return_value=academic_result())
    if fail_at in ("A", "B"):
        outputs[0 if fail_at == "A" else 1] = RuntimeError("synthetic failure")
    else:
        academic.side_effect = RuntimeError("synthetic failure")
    generate = AsyncMock(side_effect=outputs)
    report = asyncio.run(run_sequence("configured-model", "PDF text", generate, academic, lambda exc: {"type": type(exc).__name__}))
    assert report["stopped_at"] == fail_at
    assert report["stages"][-1]["status"] == "FAILED"
    assert len(report["stages"]) == {"A": 1, "B": 2, "C": 3}[fail_at]
    assert generate.await_count == (1 if fail_at == "A" else 2)
    assert academic.await_count == (1 if fail_at == "C" else 0)
    assert not report["academic_generation_works"]


def test_successful_sequence_and_minimal_parameters():
    generate = AsyncMock(side_effect=[response("OK"), response('{"status":"ok","count":1}')])
    academic = AsyncMock(return_value=academic_result())
    report = asyncio.run(run_sequence("configured-model", "PDF text", generate, academic, lambda exc: {}))
    assert report["academic_generation_works"]
    assert [item["stage"] for item in report["stages"]] == ["A", "B", "C"]
    assert all(item["status"] == "PASSED" for item in report["stages"])
    assert set(generate.call_args_list[0].kwargs) == {"model", "contents"}
    config = generate.call_args_list[1].kwargs["config"]
    assert set(config.response_json_schema["properties"]) == {"status", "count"}
    assert config.response_mime_type == "application/json"
    assert config.thinking_config is None and config.temperature is None
    academic.assert_awaited_once_with("PDF text")


@pytest.mark.parametrize("text", ["not JSON", '{"status":"ok"}', '{"status":"ok","count":"wrong"}'])
def test_invalid_minimal_json_stops_before_academic(text):
    generate = AsyncMock(side_effect=[response("OK"), response(text)])
    academic = AsyncMock()
    report = asyncio.run(run_sequence("configured-model", "PDF text", generate, academic, lambda exc: {"type": type(exc).__name__}))
    assert report["stopped_at"] == "B"
    academic.assert_not_awaited()
