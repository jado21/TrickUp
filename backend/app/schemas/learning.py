from typing import Annotated, Literal

from pydantic import Field

from app.schemas.common import ContractModel

Text = Annotated[str, Field(min_length=1, max_length=2000)]
Difficulty = Literal["beginner", "intermediate", "advanced"]


class Level(ContractModel):
    id: Text
    title: Text
    objectives: list[Text] = Field(min_length=1)


class Unit(ContractModel):
    id: Text
    title: Text
    levels: list[Level] = Field(min_length=1)


class SyllabusResponse(ContractModel):
    course_name: Text
    summary: Text
    units: list[Unit] = Field(min_length=1)


class RoadmapRequest(ContractModel):
    career: Text
    semester: int = Field(ge=1, le=20)
    skills: list[Text] = Field(default_factory=list, max_length=50)
    goals: list[Text] = Field(min_length=1, max_length=20)
    weekly_hours: int = Field(default=5, ge=1, le=40)


class RoadmapStage(ContractModel):
    order: int = Field(ge=1)
    title: Text
    duration_weeks: int = Field(ge=1)
    skills: list[Text] = Field(min_length=1)
    activities: list[Text] = Field(min_length=1)
    deliverable: Text


class RoadmapResponse(ContractModel):
    title: Text
    summary: Text
    stages: list[RoadmapStage] = Field(min_length=1)
