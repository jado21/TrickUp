import asyncio
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json
from unittest.mock import AsyncMock

import pytest
import httpx
from google.genai import types
from google.genai.client import Client as SDKClient
from pydantic import ValidationError

from app.main import app
from app.schemas.mission_internal import MissionDraft
from app.schemas.missions import AnswerRequest, MissionRequest, MissionResponse, MODALITIES
from app.services.errors import ServiceError
from app.services.mission_store import MissionStore
from app.services.missions import MissionService
from app.services.gemini import GeminiService
from app.config import Settings
from app.services.mission_engine import normalize_answer
from mission_fixtures import SOURCE, activity_data, mock_generation, request_payload


@pytest.fixture
def missions(monkeypatch):
    service = app.state.mission_service
    service.gemini.generate_json = AsyncMock(side_effect=mock_generation)
    return service


def generate(client, **updates):
    response = client.post("/api/missions/generate", json=request_payload(**updates))
    assert response.status_code == 200, response.text
    return response.json()


def answer_payload(service, mission, index, *, correct=True):
    activity = mission["activities"][index]
    entry = service.store.read(mission["mission_id"])
    answer = entry.private[activity["id"]].solution.model_dump()
    if not correct:
        mode = activity["modality"]
        if mode == "MULTIPLE_CHOICE":
            answer["option_id"] = next(item["id"] for item in activity["options"] if item["id"] != answer["option_id"])
        elif mode == "FILL_BLANK":
            answer["text"] = "respuesta equivocada"
        elif mode == "MEMORY_MATCH":
            answer["pairs"][0]["right_id"], answer["pairs"][1]["right_id"] = answer["pairs"][1]["right_id"], answer["pairs"][0]["right_id"]
        elif mode == "ORDER_SEQUENCE":
            answer["item_ids"] = list(reversed(answer["item_ids"]))
        else:
            answer["tile_ids"] = [next(item["id"] for item in activity["tiles"] if item["id"] not in answer["tile_ids"])]
    return {"mission_id": mission["mission_id"], "activity_id": activity["id"], "answer": answer}


@pytest.mark.parametrize("mode", MODALITIES)
def test_generate_all_modalities_and_hide_solutions(client, missions, mode):
    mission = generate(client, modalities=[mode], activity_count=1)
    assert MissionResponse.model_validate(mission).activities[0].modality == mode
    assert missions.gemini.generate_json.await_count == 1
    hidden = {"solution", "correct_choice_index", "explanation", "evidence", "accepted_answers", "correct", "private"}
    def inspect(node):
        if isinstance(node, dict):
            # progress.correct is a count, not a solution.
            assert not (set(node) & (hidden - {"correct"}))
            if "correct" in node:
                assert "answered" in node
            for value in node.values(): inspect(value)
        elif isinstance(node, list):
            for value in node: inspect(value)
    inspect(mission)
    assert client.get(f"/api/missions/{mission['mission_id']}").json() == mission


@pytest.mark.parametrize("mode", MODALITIES)
@pytest.mark.parametrize("correct", [True, False])
def test_correct_incorrect_and_xp(client, missions, mode, correct):
    mission = generate(client, modalities=[mode], activity_count=1)
    response = client.post("/api/missions/answer", json=answer_payload(missions, mission, 0, correct=correct))
    assert response.status_code == 200
    body = response.json()
    assert body["correct"] == correct
    assert body["xp_awarded"] == (mission["activities"][0]["max_xp"] if correct else 0)
    assert body["progress"]["completed"]
    assert body["explanation"] and body["solution"]
    assert missions.gemini.generate_json.await_count == 1  # Responder no usa Gemini.


def test_idempotency_and_no_second_attempt(client, missions):
    mission = generate(client, modalities=["MULTIPLE_CHOICE"], activity_count=1)
    payload = answer_payload(missions, mission, 0)
    first = client.post("/api/missions/answer", json=payload).json()
    second = client.post("/api/missions/answer", json=payload).json()
    assert first["xp_awarded"] == 10 and second["xp_awarded"] == 0 and second["replayed"]
    assert second["progress"]["xp"] == 10
    changed = client.post("/api/missions/answer", json=answer_payload(missions, mission, 0, correct=False))
    assert changed.status_code == 409
    assert missions.store.read(mission["mission_id"]).public.progress.xp == 10


def test_out_of_order_does_not_expose_solution(client, missions):
    mission = generate(client)
    response = client.post("/api/missions/answer", json=answer_payload(missions, mission, 1))
    assert response.status_code == 409
    assert "solution" not in response.text and "explanation" not in response.text
    assert not missions.store.read(mission["mission_id"]).outcomes


def test_progression_and_difficulty_from_server_performance(client, missions):
    mission = generate(client, modalities=["MULTIPLE_CHOICE"], activity_count=3)
    for index in range(3):
        response = client.post("/api/missions/answer", json=answer_payload(missions, mission, index))
        assert response.status_code == 200
    feedback = response.json()
    assert feedback["progress"]["can_advance"]
    assert feedback["progress"]["xp"] == 30
    assert feedback["adaptation"]["action"] == "advance"


def test_three_correct_increase_before_completion_and_continue(client, missions):
    mission = generate(client, modalities=["MULTIPLE_CHOICE"], activity_count=4)
    for index in range(3):
        feedback = client.post("/api/missions/answer", json=answer_payload(missions, mission, index)).json()
    assert feedback["adaptation"]["action"] == "increase_difficulty"
    assert feedback["adaptation"]["next_difficulty"] == "intermediate"
    client.post("/api/missions/answer", json=answer_payload(missions, mission, 3, correct=False))
    # Último error recomienda repaso y no subir dificultad de forma automática.
    follow = generate(client, modalities=["FILL_BLANK"], activity_count=1, previous_mission_id=mission["mission_id"])
    assert follow["difficulty"] == "beginner"
    assert client.post("/api/missions/generate", json=request_payload(modalities=["FILL_BLANK"], activity_count=1, previous_mission_id=mission["mission_id"])).status_code == 409


def test_repeated_errors_reinforce(client, missions):
    mission = generate(client, modalities=["MULTIPLE_CHOICE"], activity_count=2)
    for index in range(2):
        body = client.post("/api/missions/answer", json=answer_payload(missions, mission, index, correct=False)).json()
    assert body["adaptation"]["action"] == "reinforce"
    assert body["adaptation"]["review_objective_index"] == 0
    assert not body["progress"]["can_advance"]


def test_80_percent_mastery_requires_all_objectives(client, missions):
    mission = generate(client, activity_count=5, objectives=["Objetivo A", "Objetivo B"])
    for index in range(5):
        body = client.post("/api/missions/answer", json=answer_payload(missions, mission, index, correct=index != 1)).json()
    assert body["progress"]["correct"] == 4
    assert body["progress"]["can_advance"]  # Objetivo B también se evaluó bien en índice 3.


def test_preferences_do_not_raise_difficulty(client, missions):
    profile = {"study_area": "Sistemas", "academic_level": "Universitario", "learning_goal": "Funciones", "available_minutes": 20,
               "preferred_modalities": ["FALLING_TILES"], "motivation_tone": "humorous", "initial_knowledge": "beginner"}
    mission = generate(client, profile=profile, activity_count=1)
    assert mission["difficulty"] == "beginner" and mission["activities"][0]["modality"] == "FALLING_TILES"
    feedback = client.post("/api/missions/answer", json=answer_payload(missions, mission, 0)).json()
    assert "cerebro" in feedback["feedback"]


def test_expiry_and_ids(client, missions):
    now = [0.0]
    missions.store = MissionStore(ttl=5, clock=lambda: now[0])
    one, two = generate(client), generate(client)
    ids = [one["mission_id"], two["mission_id"], *[a["id"] for a in one["activities"]], *[a["id"] for a in two["activities"]]]
    assert len(ids) == len(set(ids))
    now[0] = 5.0
    assert client.get(f"/api/missions/{one['mission_id']}").status_code == 410
    assert client.post("/api/missions/answer", json=answer_payload_expired(one)).status_code == 410
    assert not missions.store._entries and missions.store._bytes == 0


def answer_payload_expired(mission):
    return {"mission_id": mission["mission_id"], "activity_id": mission["activities"][0]["id"], "answer": {"modality": "MULTIPLE_CHOICE", "option_id": "unknown"}}


def test_capacity_prevents_more_generation(client, missions):
    missions.store = MissionStore(max_missions=1)
    generate(client)
    response = client.post("/api/missions/generate", json=request_payload())
    assert response.status_code == 503
    assert missions.gemini.generate_json.await_count == 1


def test_byte_budget_does_not_store_large_mission(client, missions):
    missions.store = MissionStore(max_bytes=100)
    response = client.post("/api/missions/generate", json=request_payload())
    assert response.status_code == 503 and not missions.store._entries


def test_insufficient_context_and_unsupported_material(client, missions):
    missions.gemini.generate_json.side_effect = None
    missions.gemini.generate_json.return_value = MissionDraft(sufficient_context=False, activities=[])
    response = client.post("/api/missions/generate", json=request_payload())
    assert response.status_code == 422 and response.json()["error"]["code"] == "INSUFFICIENT_CONTEXT"
    data = activity_data("MULTIPLE_CHOICE")
    data["explanation"] = "Contenido inventado"
    missions.gemini.generate_json.return_value = MissionDraft(sufficient_context=True, activities=[data])
    response = client.post("/api/missions/generate", json=request_payload(modalities=["MULTIPLE_CHOICE"], activity_count=1))
    assert response.status_code == 502


@pytest.mark.parametrize("status", [429, 502, 503, 504])
def test_gemini_errors_are_preserved(client, missions, status):
    missions.gemini.generate_json.side_effect = ServiceError(status, "HTTP_ERROR", "Error seguro")
    response = client.post("/api/missions/generate", json=request_payload())
    assert response.status_code == status
    assert not missions.store._entries


def test_unknown_ids_and_client_score_injection(client, missions):
    mission = generate(client)
    payload = answer_payload(missions, mission, 0)
    payload["xp"] = 999999
    assert client.post("/api/missions/answer", json=payload).status_code == 422
    payload.pop("xp")
    payload["answer"]["correct"] = True
    assert client.post("/api/missions/answer", json=payload).status_code == 422
    payload["answer"].pop("correct")
    payload["activity_id"] = "unrelated"
    assert client.post("/api/missions/answer", json=payload).status_code == 404
    payload["mission_id"] = "unknown"
    assert client.post("/api/missions/answer", json=payload).status_code == 404


def test_invalid_answer_ids_do_not_consume_attempt(client, missions):
    mission = generate(client, modalities=["ORDER_SEQUENCE"], activity_count=1)
    payload = answer_payload(missions, mission, 0)
    payload["answer"]["item_ids"] = [payload["answer"]["item_ids"][0]] * 2
    assert client.post("/api/missions/answer", json=payload).status_code == 422
    assert missions.store.read(mission["mission_id"]).public.progress.answered == 0


def test_fill_normalization_and_replay(client, missions):
    mission = generate(client, modalities=["FILL_BLANK"], activity_count=1)
    payload = answer_payload(missions, mission, 0)
    payload["answer"]["text"] = " EL CONJUNTO   DE ENTRADAS "
    assert client.post("/api/missions/answer", json=payload).json()["correct"]
    payload["answer"]["text"] = "el conjunto de entradas"
    assert client.post("/api/missions/answer", json=payload).json()["replayed"]


def test_parallel_identical_answers_award_once(client, missions):
    mission = generate(client, modalities=["MULTIPLE_CHOICE"], activity_count=1)
    request = AnswerRequest.model_validate(answer_payload(missions, mission, 0))
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: missions.answer(request), range(4)))
    assert sum(result.xp_awarded for result in results) == 10
    assert missions.store.read(mission["mission_id"]).public.progress.xp == 10


def test_generate_body_limit_and_cors(client, missions):
    response = client.post("/api/missions/generate", content=b"x" * (128 * 1024 + 1), headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 413
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    missions.gemini.generate_json.assert_not_awaited()


def test_draft_validation_and_request_coverage():
    with pytest.raises(ValidationError):
        MissionRequest.model_validate(request_payload(activity_count=1))
    bad = activity_data("FILL_BLANK")
    bad["prompt"] = "Sin hueco"
    with pytest.raises(ValidationError):
        MissionDraft.model_validate({"sufficient_context": True, "activities": [bad]})


def test_continuation_increases_using_server_record_and_ignores_initial_hint(client, missions):
    mission = generate(client, modalities=["MULTIPLE_CHOICE"], activity_count=3)
    for index in range(3):
        client.post("/api/missions/answer", json=answer_payload(missions, mission, index))
    profile = {"study_area": "Sistemas", "academic_level": "Universitario", "learning_goal": "Funciones", "available_minutes": 20, "initial_knowledge": "advanced"}
    follow = generate(client, modalities=["MULTIPLE_CHOICE"], activity_count=1, previous_mission_id=mission["mission_id"], profile=profile)
    assert follow["difficulty"] == "intermediate"
    assert follow["activities"][0]["max_xp"] == 20


def test_continuation_rejects_incomplete_or_changed_context_without_gemini(client, missions):
    mission = generate(client, modalities=["MULTIPLE_CHOICE"], activity_count=1)
    response = client.post("/api/missions/generate", json=request_payload(modalities=["MULTIPLE_CHOICE"], activity_count=1, previous_mission_id=mission["mission_id"]))
    assert response.status_code == 409
    client.post("/api/missions/answer", json=answer_payload(missions, mission, 0))
    response = client.post("/api/missions/generate", json=request_payload(modalities=["MULTIPLE_CHOICE"], activity_count=1, previous_mission_id=mission["mission_id"], level_id="other-level"))
    assert response.status_code == 409
    assert missions.gemini.generate_json.await_count == 1


def test_failed_continuation_releases_reservation(client, missions):
    mission = generate(client, modalities=["MULTIPLE_CHOICE"], activity_count=1)
    client.post("/api/missions/answer", json=answer_payload(missions, mission, 0))
    missions.gemini.generate_json.side_effect = ServiceError(429, "HTTP_ERROR", "Cuota agotada")
    response = client.post("/api/missions/generate", json=request_payload(modalities=["MULTIPLE_CHOICE"], activity_count=1, previous_mission_id=mission["mission_id"]))
    assert response.status_code == 429
    parent = missions.store.read(mission["mission_id"])
    assert not parent.continuation_reserved and parent.continued_to is None


def test_generation_concurrency_limit(client, missions):
    async def check():
        await missions.slots.acquire()
        await missions.slots.acquire()
        try:
            with pytest.raises(ServiceError) as error:
                await missions.generate(MissionRequest.model_validate(request_payload()))
            assert error.value.status == 429
        finally:
            missions.slots.release()
            missions.slots.release()
    asyncio.run(check())
    missions.gemini.generate_json.assert_not_awaited()


def test_failed_store_update_does_not_award_xp(client, missions):
    mission = generate(client, modalities=["MULTIPLE_CHOICE"], activity_count=1)
    missions.store.max_bytes = missions.store._bytes + 1
    response = client.post("/api/missions/answer", json=answer_payload(missions, mission, 0))
    assert response.status_code == 503
    entry = missions.store.read(mission["mission_id"])
    assert entry.public.progress.xp == 0 and not entry.feedback and not entry.outcomes


def test_math_symbols_are_not_erased_by_answer_normalization():
    assert normalize_answer("x²") != normalize_answer("x2")
    assert normalize_answer(" SÍ ") == normalize_answer("sí")


def test_gemini_wrong_count_coverage_and_duplicates(client, missions):
    missions.gemini.generate_json.side_effect = None
    for kind in ("count", "objective", "duplicates", "fabrication"):
        data = activity_data("MULTIPLE_CHOICE")
        if kind == "objective":
            data["objective_index"] = 4
        elif kind == "duplicates":
            data["choices"][1] = data["choices"][0]
        elif kind == "fabrication":
            data["choices"][0] = "Respuesta no sustentada"
        activities = [] if kind == "count" else [data]
        missions.gemini.generate_json.return_value = MissionDraft(sufficient_context=True, activities=activities)
        response = client.post("/api/missions/generate", json=request_payload(modalities=["MULTIPLE_CHOICE"], activity_count=1))
        assert response.status_code == 502
    assert not missions.store._entries


def test_endpoint_with_official_sdk_and_mock_transport(client, monkeypatch):
    captured = []
    draft = MissionDraft(sufficient_context=True, activities=[activity_data(mode) for mode in MODALITIES])
    def handle(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200, json={"candidates": [{
            "content": {"role": "model", "parts": [{"text": draft.model_dump_json()}]}, "finishReason": "STOP",
        }]})
    http = httpx.AsyncClient(transport=httpx.MockTransport(handle))
    sdk = SDKClient(api_key="test-not-real", http_options=types.HttpOptions(httpx_async_client=http))
    gemini = GeminiService(Settings(gemini_api_key="test-not-real", gemini_model="configured-test-model"))
    gemini.create_client = lambda: sdk
    monkeypatch.setitem(app.state._state, "mission_service", MissionService(gemini, MissionStore()))
    try:
        mission = generate(client)
        assert len(mission["activities"]) == 5 and len(captured) == 1
        wire = captured[0]
        assert "generador de actividades" in wire["systemInstruction"]["parts"][0]["text"]
        assert wire["generationConfig"]["responseJsonSchema"]["title"] == "MissionDraft"
        assert "correct_choice_index" not in json.dumps(mission)
    finally:
        asyncio.run(http.aclose())
        sdk.close()


def test_memory_cards_do_not_encode_pairing_through_forced_two_card_order(client, missions, monkeypatch):
    class ControlledRandom:
        def __init__(self):
            self.calls = 0
        def shuffle(self, values):
            self.calls += 1
            if self.calls == 2:
                values.reverse()
    monkeypatch.setattr("app.services.missions.random.SystemRandom", ControlledRandom)
    mission = generate(client, modalities=["MEMORY_MATCH"], activity_count=1)
    activity = mission["activities"][0]
    solution = missions.store.read(mission["mission_id"]).private[activity["id"]].solution
    actual = {(pair.left_id, pair.right_id) for pair in solution.pairs}
    displayed_rows = {(left["id"], right["id"]) for left, right in zip(activity["left_cards"], activity["right_cards"])}
    assert displayed_rows != actual
