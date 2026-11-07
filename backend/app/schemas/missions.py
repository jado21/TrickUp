"""Contratos públicos de misiones; ninguna solución aparece en Activity."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, model_validator

from app.schemas.common import ContractModel
from app.schemas.learning import Difficulty, Text

Modality = Literal["MULTIPLE_CHOICE", "FILL_BLANK", "MEMORY_MATCH", "ORDER_SEQUENCE", "FALLING_TILES"]
Tone = Literal["friendly", "competitive", "humorous"]
MODALITIES = ["MULTIPLE_CHOICE", "FILL_BLANK", "MEMORY_MATCH", "ORDER_SEQUENCE", "FALLING_TILES"]
Identifier = Annotated[str, Field(min_length=1, max_length=128)]


class StudentProfile(ContractModel):
    study_area: Text
    academic_level: Text
    learning_goal: Text
    available_minutes: int = Field(ge=1, le=240)
    preferred_modalities: list[Modality] = Field(default_factory=lambda: MODALITIES.copy(), min_length=1, max_length=5)
    motivation_tone: Tone = "friendly"
    initial_knowledge: Difficulty = "beginner"

    @model_validator(mode="after")
    def unique_preferences(self):
        if len(set(self.preferred_modalities)) != len(self.preferred_modalities):
            raise ValueError("Las modalidades preferidas no deben repetirse.")
        return self


class MissionRequest(ContractModel):
    course_name: Text
    unit_title: Text
    level_id: Identifier
    level_title: Text
    objectives: list[Text] = Field(min_length=1, max_length=5)
    source_text: str = Field(min_length=80, max_length=12000)
    activity_count: int = Field(default=5, ge=1, le=10)
    modalities: list[Modality] | None = Field(default=None, min_length=1, max_length=5)
    profile: StudentProfile | None = None
    previous_mission_id: Identifier | None = None

    @model_validator(mode="after")
    def validate_plan(self):
        modes = self.selected_modalities()
        if len(set(modes)) != len(modes):
            raise ValueError("Las modalidades no deben repetirse.")
        if self.activity_count < max(len(modes), len(self.objectives)):
            raise ValueError("activity_count debe cubrir todas las modalidades y objetivos.")
        return self

    def selected_modalities(self) -> list[Modality]:
        return self.modalities or (self.profile.preferred_modalities if self.profile else MODALITIES.copy())


class Item(ContractModel):
    id: Identifier
    text: Text


class ActivityBase(ContractModel):
    id: Identifier
    prompt: Text
    objective_index: int = Field(ge=0, le=4)
    max_xp: int = Field(ge=0)


class ChoiceActivity(ActivityBase):
    modality: Literal["MULTIPLE_CHOICE"]
    options: list[Item] = Field(min_length=4, max_length=4)


class FillActivity(ActivityBase):
    modality: Literal["FILL_BLANK"]


class MemoryActivity(ActivityBase):
    modality: Literal["MEMORY_MATCH"]
    left_cards: list[Item] = Field(min_length=2, max_length=6)
    right_cards: list[Item] = Field(min_length=2, max_length=6)


class OrderActivity(ActivityBase):
    modality: Literal["ORDER_SEQUENCE"]
    items: list[Item] = Field(min_length=2, max_length=8)


class TilesActivity(ActivityBase):
    modality: Literal["FALLING_TILES"]
    tiles: list[Item] = Field(min_length=3, max_length=10)


Activity = Annotated[ChoiceActivity | FillActivity | MemoryActivity | OrderActivity | TilesActivity, Field(discriminator="modality")]


class MatchPair(ContractModel):
    left_id: Identifier
    right_id: Identifier


class ChoiceAnswer(ContractModel):
    modality: Literal["MULTIPLE_CHOICE"]
    option_id: Identifier


class FillAnswer(ContractModel):
    modality: Literal["FILL_BLANK"]
    text: Text


class MemoryAnswer(ContractModel):
    modality: Literal["MEMORY_MATCH"]
    pairs: list[MatchPair] = Field(min_length=2, max_length=6)


class OrderAnswer(ContractModel):
    modality: Literal["ORDER_SEQUENCE"]
    item_ids: list[Identifier] = Field(min_length=2, max_length=8)


class TilesAnswer(ContractModel):
    modality: Literal["FALLING_TILES"]
    tile_ids: list[Identifier] = Field(min_length=1, max_length=10)


Answer = Annotated[ChoiceAnswer | FillAnswer | MemoryAnswer | OrderAnswer | TilesAnswer, Field(discriminator="modality")]


class AnswerRequest(ContractModel):
    mission_id: Identifier
    activity_id: Identifier
    answer: Answer


class Progress(ContractModel):
    answered: int = 0
    correct: int = 0
    total: int
    xp: int = 0
    completed: bool = False
    can_advance: bool = False
    next_activity_id: Identifier | None = None


class Adaptation(ContractModel):
    action: Literal["continue", "review", "reinforce", "increase_difficulty", "advance"]
    next_difficulty: Difficulty
    review_objective_index: int | None = None
    reason: Text


class MissionResponse(ContractModel):
    mission_id: Identifier
    expires_at: datetime
    course_name: Text
    unit_title: Text
    level_id: Identifier
    level_title: Text
    difficulty: Difficulty
    activities: list[Activity] = Field(min_length=1, max_length=10)
    progress: Progress


class FeedbackResponse(ContractModel):
    mission_id: Identifier
    activity_id: Identifier
    correct: bool
    xp_awarded: int
    replayed: bool = False
    feedback: Text
    explanation: Text
    solution: Answer
    accepted_answers: list[Text] = Field(default_factory=list)
    progress: Progress
    adaptation: Adaptation
