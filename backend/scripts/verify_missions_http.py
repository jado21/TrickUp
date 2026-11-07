"""Prueba opt-in por HTTP de una generación de misión, sin reintentos.

Ejecutar SOLO tras autorización explícita:
  .venv/Scripts/python.exe scripts/verify_missions_http.py --live
El flujo también se prueba con TestClient y generación simulada en pytest.
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
from google import genai
from google.genai import errors, models
import uvicorn

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.config import load_settings
from app.main import app
from app.schemas.common import ErrorResponse
from app.schemas.mission_internal import MissionDraft
from app.schemas.missions import AnswerRequest, FeedbackResponse, MissionRequest, MissionResponse, MODALITIES
from app.services.gemini_schema import generation_schema
from app.services.mission_engine import normalize_answer
from scripts.audit_phase2 import provider_error_details


def verification_request():
    example = BACKEND.parent / "docs/examples/missions-generate-request.json"
    body = json.loads(example.read_text(encoding="utf-8"))
    body.update(modalities=MODALITIES.copy(), activity_count=5)
    body.pop("previous_mission_id", None)
    return MissionRequest.model_validate(body, strict=True)


def assert_public(activities):
    """Solo inspeccionar actividades: progress.correct es un contador legítimo."""
    forbidden = {"solution", "correct", "correct_choice_index", "accepted_answers", "explanation", "evidence", "private"}
    ids = []
    def inspect(node):
        if isinstance(node, dict):
            assert not forbidden.intersection(node), "Solución privada expuesta antes de resolver."
            if "id" in node:
                ids.append(node["id"])
            for value in node.values():
                inspect(value)
        elif isinstance(node, list):
            for value in node:
                inspect(value)
    inspect(activities)
    assert len(ids) == len(set(ids)), "IDs públicos repetidos."


def submission(activity, private, correct):
    """Oráculo QA interno: nunca se añade una ruta que publique soluciones."""
    answer = private.solution.model_dump()
    if correct:
        return answer
    mode = activity.modality
    if mode == "MULTIPLE_CHOICE":
        answer["option_id"] = next(item.id for item in activity.options if item.id != answer["option_id"])
    elif mode == "FILL_BLANK":
        accepted = {normalize_answer(value) for value in private.accepted_answers}
        answer["text"] = next(f"__qa_incorrecta_{i}__" for i in range(8) if normalize_answer(f"__qa_incorrecta_{i}__") not in accepted)
    elif mode == "MEMORY_MATCH":
        answer["pairs"][0]["right_id"], answer["pairs"][1]["right_id"] = answer["pairs"][1]["right_id"], answer["pairs"][0]["right_id"]
    elif mode == "ORDER_SEQUENCE":
        answer["item_ids"] = list(reversed(answer["item_ids"]))
    else:
        answer["tile_ids"] = [next(tile.id for tile in activity.tiles if tile.id not in answer["tile_ids"])]
    return answer


def verify_http_flow(client, service, request, state):
    report = {"requested_modalities": request.selected_modalities(), "verified_modalities": [], "checks": {}}
    response = client.post("/api/missions/generate", json=request.model_dump(mode="json", exclude_none=True))
    report["generation_http_status"] = response.status_code
    if response.status_code != 200:
        ErrorResponse.model_validate_json(response.content, strict=True)
        observed = set(state.get("observed_modalities", []))
        report.update(error=response.json()["error"],
                      missing_modalities=sorted(set(request.selected_modalities()) - observed),
                      unverified_modalities=request.selected_modalities(), passed=False)
        return report  # Sin otro POST generate ni evaluaciones tras un fallo.

    mission = MissionResponse.model_validate_json(response.content, strict=True)
    public = response.json()
    assert_public(public["activities"])
    assert mission.course_name == request.course_name and mission.level_id == request.level_id
    present = {item.modality for item in mission.activities}
    report["returned_modalities"] = sorted(present)
    report["missing_modalities"] = sorted(set(request.selected_modalities()) - present)
    assert not report["missing_modalities"]
    assert len(mission.activities) == request.activity_count
    report["public_response"] = public
    report["checks"].update(pydantic_valid=True, no_solutions_in_generation=True, unique_public_ids=True,
                             textual_grounding_validated_by_endpoint=True)
    restored = client.get(f"/api/missions/{mission.mission_id}")
    assert restored.status_code == 200
    assert_public(restored.json()["activities"])
    report["checks"]["no_solutions_in_get"] = True

    # Cada modalidad se comprueba con una entrega. Mocks cubren ambos resultados
    # para las cinco; aquí alternamos aciertos/errores sin otra generación real.
    wrong_modes = {"FILL_BLANK", "ORDER_SEQUENCE"}
    rewards = {"MULTIPLE_CHOICE": 10, "FILL_BLANK": 12, "MEMORY_MATCH": 16, "ORDER_SEQUENCE": 14, "FALLING_TILES": 12}
    multiplier = {"beginner": 1, "intermediate": 2, "advanced": 3}[mission.difficulty]
    total_xp = 0
    for activity in mission.activities:
        private = service.store.read(mission.mission_id).private[activity.id]
        correct = activity.modality not in wrong_modes
        payload = AnswerRequest(mission_id=mission.mission_id, activity_id=activity.id,
                                answer=submission(activity, private, correct)).model_dump(mode="json")
        answered = client.post("/api/missions/answer", json=payload)
        assert answered.status_code == 200
        feedback = FeedbackResponse.model_validate_json(answered.content, strict=True)
        expected_xp = rewards[activity.modality] * multiplier if correct else 0
        total_xp += expected_xp
        assert activity.max_xp == rewards[activity.modality] * multiplier
        assert feedback.correct == correct and feedback.xp_awarded == expected_xp
        assert feedback.progress.xp == total_xp and feedback.explanation == private.explanation
        assert feedback.solution == private.solution
        replay = client.post("/api/missions/answer", json=payload)
        assert replay.status_code == 200
        repeated = FeedbackResponse.model_validate_json(replay.content, strict=True)
        assert repeated.replayed and repeated.xp_awarded == 0 and repeated.progress.xp == total_xp
        changed = dict(payload, answer=submission(activity, private, not correct))
        assert client.post("/api/missions/answer", json=changed).status_code == 409
        report["verified_modalities"].append({
            "modality": activity.modality, "activity_id": activity.id,
            "expected_correct": correct, "feedback_correct": feedback.correct,
            "xp_awarded": feedback.xp_awarded, "replay_awarded": repeated.xp_awarded,
        })
    final = client.get(f"/api/missions/{mission.mission_id}")
    assert final.status_code == 200
    assert_public(final.json()["activities"])
    assert final.json()["progress"]["completed"] and final.json()["progress"]["xp"] == total_xp
    assert state["sdk_calls"] == 1
    report["checks"].update(feedback_matches_server_solutions=True, no_duplicate_xp=True,
                             changed_submission_rejected=True, completed=True)
    report.update(final_xp=total_xp, passed=True, semantic_review="PENDING_MANUAL_REVIEW")
    return report


def main():
    settings = load_settings()
    if not settings.gemini_api_key or settings.gemini_model != "gemini-3.5-flash-lite" or not settings.gemini_structured_output:
        raise RuntimeError("Configuración ausente o distinta de la prevista. No se llamó a Gemini.")
    key = settings.gemini_api_key.get_secret_value()
    def redact(value):
        text = str(value)
        for secret in (key,):
            for variant in (secret, quote(secret, safe=""), quote_plus(secret)):
                text = text.replace(variant, "[REDACTED]")
        return re.sub(r"AIza[\w-]{20,}", "[REDACTED]", text)

    state = {"sdk_calls": 0, "provider_error": None, "private_draft": None, "observed_modalities": []}
    original = models.AsyncModels.generate_content
    async def tracked(self, *args, **kwargs):
        if state["sdk_calls"] >= 1:
            raise RuntimeError("La verificación impide otra generación.")
        config = kwargs["config"]
        state["request_checks"] = {
            "configured_model": kwargs["model"] == settings.gemini_model,
            "same_schema_adapter": config.response_json_schema == generation_schema(MissionDraft),
            "json_mime_type": config.response_mime_type == "application/json",
            "single_attempt": config.http_options.retry_options.attempts == 1,
        }
        assert all(state["request_checks"].values())
        state["sdk_calls"] += 1
        try:
            response = await original(self, *args, **kwargs)
            if response.text:
                try:
                    raw = json.loads(response.text)
                    state["private_draft"] = raw
                    if isinstance(raw, dict) and isinstance(raw.get("activities"), list):
                        state["observed_modalities"] = sorted({item["modality"] for item in raw["activities"] if isinstance(item, dict) and item.get("modality") in MODALITIES})
                except ValueError:
                    pass
            return response
        except errors.APIError as exc:
            state["provider_error"] = provider_error_details(exc, redact)
            raise

    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="critical", access_log=False))
    thread = threading.Thread(target=server.run, daemon=True)
    previous_logging = logging.root.manager.disable
    report = {"passed": False}
    folder = BACKEND / ".tmp"
    folder.mkdir(exist_ok=True)
    models.AsyncModels.generate_content = tracked
    logging.disable(logging.CRITICAL)
    try:
        thread.start()
        deadline = time.monotonic() + 15
        while not server.started and time.monotonic() < deadline:
            time.sleep(0.05)
        if not server.started:
            raise RuntimeError("Uvicorn no arrancó; no se ejecutó generación.")
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=75, trust_env=False) as client:
            assert client.get("/api/health").status_code == 200
            print("Ejecutando el único POST /api/missions/generate autorizado.", flush=True)
            report = verify_http_flow(client, app.state.mission_service, verification_request(), state)
    except Exception as exc:
        report.update(passed=False, verification_error={"type": type(exc).__name__, "message": redact(str(exc))})
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        models.AsyncModels.generate_content = original
        logging.disable(previous_logging)
        if state["private_draft"] is not None:
            # Solo QA local, ignorado por Git; nunca una respuesta pública o ruta API.
            (folder / "missions-http-private-draft.json").write_text(redact(json.dumps(state["private_draft"], ensure_ascii=False, indent=2)), encoding="utf-8")
        report.update(sdk_calls=state["sdk_calls"], sdk_version=genai.__version__,
                      provider_error=state["provider_error"], request_checks=state.get("request_checks", {}),
                      provider_modalities=state["observed_modalities"], server_stopped=not thread.is_alive())
        safe = redact(json.dumps(report, ensure_ascii=False, indent=2))
        (folder / "missions-http-verification.json").write_text(safe + "\n", encoding="utf-8")
        print(safe)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Requiere autorización; una generación real.")
    if not parser.parse_args().live:
        parser.error("Falta --live. No se realizaron llamadas a Gemini.")
    raise SystemExit(main())
