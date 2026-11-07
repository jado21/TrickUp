"""Evita que los mocks documentados se desalineen de los modelos públicos."""

from pathlib import Path
import json
import re

import pytest

from app.schemas.common import ErrorResponse, HealthResponse
from app.schemas.learning import RoadmapRequest, RoadmapResponse, SyllabusResponse
from app.schemas.missions import MissionRequest, MissionResponse
from app.schemas.missions import AnswerRequest, FeedbackResponse, MODALITIES
from app.schemas.planner import PlannerRequest, PlannerResponse

EXAMPLES = re.findall(
    r"```json\n(.*?)\n```",
    (Path(__file__).resolve().parents[2] / "docs" / "api-contract.md").read_text(encoding="utf-8"),
    re.DOTALL,
)
MODELS = [HealthResponse, SyllabusResponse, MissionRequest, MissionResponse,
          RoadmapRequest, RoadmapResponse, PlannerRequest, PlannerResponse,
          ErrorResponse, ErrorResponse]


def test_example_count():
    assert len(EXAMPLES) == len(MODELS)


@pytest.mark.parametrize("model,example", list(zip(MODELS, EXAMPLES)))
def test_documented_example(model, example):
    model.model_validate_json(example)


def test_mission_example_files_match_contract_and_keep_solutions_separate():
    folder = Path(__file__).resolve().parents[2] / "docs/examples"
    request = MissionRequest.model_validate_json((folder / "missions-generate-request.json").read_text(encoding="utf-8"))
    mission = MissionResponse.model_validate_json((folder / "missions-response.json").read_text(encoding="utf-8"))
    answers = json.loads((folder / "missions-answer-examples.json").read_text(encoding="utf-8"))
    assert len(mission.activities) == request.activity_count == len(answers) == 5
    assert {activity.modality for activity in mission.activities} == set(MODALITIES)
    for activity, example in zip(mission.activities, answers):
        submitted = AnswerRequest.model_validate(example["request"])
        feedback = FeedbackResponse.model_validate(example["response"])
        assert submitted.activity_id == feedback.activity_id == activity.id
        assert submitted.mission_id == feedback.mission_id == mission.mission_id
        assert feedback.correct and feedback.xp_awarded == activity.max_xp
        assert "solution" not in activity.model_dump()
    assert answers[-1]["response"]["progress"]["xp"] == sum(activity.max_xp for activity in mission.activities)
