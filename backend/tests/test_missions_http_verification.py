from unittest.mock import AsyncMock

import pytest

from app.main import app
from app.services.errors import ServiceError
from mission_fixtures import mock_generation
from scripts.verify_missions_http import assert_public, verification_request, verify_http_flow


def test_proposed_http_flow_covers_all_modes_and_replays_with_one_generation(client):
    state = {"sdk_calls": 0}
    service = app.state.mission_service
    async def fake_generation(*args, **kwargs):
        state["sdk_calls"] += 1
        return mock_generation(*args, **kwargs)
    service.gemini.generate_json = AsyncMock(side_effect=fake_generation)
    report = verify_http_flow(client, service, verification_request(), state)
    assert report["passed"]
    assert len(report["verified_modalities"]) == 5
    assert not report["missing_modalities"]
    assert report["final_xp"] == 38
    assert all(item["replay_awarded"] == 0 for item in report["verified_modalities"])
    assert state["sdk_calls"] == 1
    assert report["semantic_review"] == "PENDING_MANUAL_REVIEW"


def test_proposed_http_flow_stops_on_provider_failure(client):
    state = {"sdk_calls": 0}
    service = app.state.mission_service
    async def failed(*args, **kwargs):
        state["sdk_calls"] += 1
        raise ServiceError(429, "HTTP_ERROR", "Cuota agotada; error simulado.")
    service.gemini.generate_json = AsyncMock(side_effect=failed)
    report = verify_http_flow(client, service, verification_request(), state)
    assert not report["passed"] and report["generation_http_status"] == 429
    assert len(report["missing_modalities"]) == 5
    assert not report["verified_modalities"]
    assert not service.store._entries and state["sdk_calls"] == 1


def test_failure_distinguishes_missing_from_returned_but_invalid_modalities(client):
    state = {"sdk_calls": 1, "observed_modalities": ["MULTIPLE_CHOICE", "FILL_BLANK"]}
    service = app.state.mission_service
    service.gemini.generate_json = AsyncMock(side_effect=ServiceError(502, "INVALID_MISSION", "Borrador incompleto simulado."))
    report = verify_http_flow(client, service, verification_request(), state)
    assert set(report["missing_modalities"]) == {"MEMORY_MATCH", "ORDER_SEQUENCE", "FALLING_TILES"}
    assert len(report["unverified_modalities"]) == 5


@pytest.mark.parametrize("field", ["solution", "correct_choice_index", "evidence", "accepted_answers", "correct"])
def test_http_verifier_detects_exposed_private_fields(field):
    with pytest.raises(AssertionError):
        assert_public([{"id": "activity-1", "modality": "FILL_BLANK", field: "private"}])
