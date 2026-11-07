import pytest
from pydantic import ValidationError

from app.schemas.planner import PlannerRequest


def payload():
    return {"week_start": "2026-11-09", "availability": [{"day": "monday", "start": "18:00", "end": "20:00"}], "courses": [{"id": "c1", "name": "Cálculo", "weekly_hours": 2}]}


@pytest.mark.parametrize("case", ["reverse", "overlap", "duplicate", "not_monday", "offset", "seconds"])
def test_invalid_schedule(case):
    data = payload()
    if case == "reverse":
        data["availability"][0]["end"] = "17:00"
    elif case == "overlap":
        data["availability"].append({"day": "monday", "start": "19:00", "end": "21:00"})
    elif case == "duplicate":
        data["courses"].append(data["courses"][0].copy())
    elif case == "not_monday":
        data["week_start"] = "2026-11-10"
    elif case == "offset":
        data["availability"][0]["start"] = "18:00-05:00"
    else:
        data["availability"][0]["start"] = "18:00:01"
    with pytest.raises(ValidationError):
        PlannerRequest.model_validate(data)


def test_adjacent_windows_are_valid():
    data = payload()
    data["availability"].append({"day": "monday", "start": "20:00", "end": "21:00"})
    assert len(PlannerRequest.model_validate(data).availability) == 2
