from typing import Annotated

from google.genai import errors
from pydantic import BaseModel, Field, ValidationError
import pytest

from app.schemas.syllabus_internal import SupportedText, SyllabusAnalysis
from app.services.gemini_schema import generation_schema
from scripts.audit_phase2 import provider_error_details


def test_provider_schema_preserves_structure_and_refs():
    original = SyllabusAnalysis.model_json_schema()
    schema = generation_schema(SyllabusAnalysis)
    assert schema["properties"] == original["properties"]
    assert schema["required"] == original["required"]
    assert set(schema["$defs"]) == set(original["$defs"])
    for definition, field in (("DraftUnit", "levels"), ("DraftLevel", "objectives"), ("DraftSyllabus", "units")):
        expected = original["$defs"][definition]["properties"][field].copy()
        assert expected.pop("minItems") == 1
        assert expected.pop("maxItems") in (10, 20)
        assert schema["$defs"][definition]["properties"][field] == expected
    for field in ("text", "source_quote"):
        assert "minLength" not in schema["$defs"]["SupportedText"]["properties"][field]
        assert "maxLength" not in schema["$defs"]["SupportedText"]["properties"][field]
        assert original["$defs"]["SupportedText"]["properties"][field]["maxLength"] == 2000
    assert schema["$defs"]["SupportedText"]["additionalProperties"] is False


@pytest.mark.parametrize("value", ["", " ", "x" * 2001])
def test_pydantic_still_enforces_text_limits(value):
    generation_schema(SyllabusAnalysis)
    with pytest.raises(ValidationError):
        SupportedText.model_validate({"text": value, "source_quote": "source"})


def test_schema_adaptation_preserves_property_names():
    class KeywordNames(BaseModel):
        minLength: Annotated[str, Field(min_length=1)]
        maxLength: Annotated[str, Field(max_length=10)]

    schema = generation_schema(KeywordNames)
    assert set(schema["properties"]) == {"minLength", "maxLength"}
    assert "minLength" not in schema["properties"]["minLength"]
    assert "maxLength" not in schema["properties"]["maxLength"]


def test_extracts_actual_sdk_error_details_and_redacts():
    exc = errors.APIError(400, {"error": {
        "status": "INVALID_ARGUMENT", "message": "Invalid argument fake-secret",
        "details": [
            {"reason": "SCHEMA_INVALID", "metadata": {"private": "do-not-export"}},
            {"fieldViolations": [{"field": "generation_config.response_json_schema", "description": "Invalid fake-secret"}]},
        ],
    }})
    assert not hasattr(exc, "response_json")
    result = provider_error_details(exc, lambda value: str(value).replace("fake-secret", "[REDACTED]"))
    assert result == {
        "http_status": 400, "message": "Invalid argument [REDACTED]", "status": "INVALID_ARGUMENT",
        "details": [
            {"reason": "SCHEMA_INVALID"},
            {"field": "generation_config.response_json_schema", "description": "Invalid [REDACTED]"},
        ],
    }
    assert "do-not-export" not in str(result)


def test_provider_error_without_detailed_reason_does_not_crash():
    exc = errors.APIError(400, {"error": {"message": "Request contains an invalid argument.", "details": None}})
    result = provider_error_details(exc, str)
    assert result["http_status"] == 400
    assert result["details"] == []
