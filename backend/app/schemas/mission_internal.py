"""Datos privados: esquema de proveedor sencillo y soluciones solo en memoria."""

from pydantic import Field, model_validator

from app.schemas.common import ContractModel
from app.schemas.learning import Text
from app.schemas.missions import Answer, FeedbackResponse, MissionResponse, Modality, Tone


class DraftPair(ContractModel):
    concept: Text
    definition: Text


class DraftTile(ContractModel):
    text: Text
    correct: bool


class DraftActivity(ContractModel):
    modality: Modality
    prompt: Text
    objective_index: int = Field(ge=0, le=4)
    explanation: Text
    evidence: list[Text] = Field(min_length=1, max_length=3)
    choices: list[Text] | None = Field(min_length=4, max_length=4)
    correct_choice_index: int | None = Field(ge=0, le=3)
    accepted_answers: list[Text] | None = Field(min_length=1, max_length=5)
    pairs: list[DraftPair] | None = Field(min_length=2, max_length=6)
    ordered_steps: list[Text] | None = Field(min_length=2, max_length=8)
    tiles: list[DraftTile] | None = Field(min_length=3, max_length=10)

    @model_validator(mode="after")
    def modality_fields(self):
        fields = {
            "MULTIPLE_CHOICE": {"choices", "correct_choice_index"},
            "FILL_BLANK": {"accepted_answers"}, "MEMORY_MATCH": {"pairs"},
            "ORDER_SEQUENCE": {"ordered_steps"}, "FALLING_TILES": {"tiles"},
        }
        active = fields[self.modality]
        for name in set.union(*fields.values()):
            if (getattr(self, name) is not None) != (name in active):
                raise ValueError("Campos privados incompatibles con la modalidad.")
        if self.modality == "FILL_BLANK" and (self.prompt.count("___") != 1 or "____" in self.prompt):
            raise ValueError("FILL_BLANK requiere exactamente un espacio ___.")
        if self.tiles and not (any(t.correct for t in self.tiles) and any(not t.correct for t in self.tiles)):
            raise ValueError("Se requiere al menos un bloque correcto y un distractor.")
        return self


class MissionDraft(ContractModel):
    sufficient_context: bool
    activities: list[DraftActivity] = Field(max_length=10)


class PrivateActivity(ContractModel):
    solution: Answer
    explanation: Text
    accepted_answers: list[Text] = Field(default_factory=list)


class Outcome(ContractModel):
    objective_index: int
    correct: bool


class MissionEntry(ContractModel):
    public: MissionResponse
    private: dict[str, PrivateActivity]
    context_key: str
    objective_count: int
    tone: Tone
    outcomes: list[Outcome] = Field(default_factory=list, max_length=100)
    feedback: dict[str, FeedbackResponse] = Field(default_factory=dict)
    submissions: dict[str, str] = Field(default_factory=dict)
    continuation_reserved: bool = False
    continued_to: str | None = None
