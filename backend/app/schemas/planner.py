from datetime import date, time
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import ContractModel
from app.schemas.learning import Text

Day = Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


class TimeWindow(ContractModel):
    day: Day
    start: time
    end: time

    @model_validator(mode="after")
    def validate_window(self):
        if self.start.tzinfo or self.end.tzinfo:
            raise ValueError("Usa horas locales sin zona horaria.")
        if self.start.second or self.start.microsecond or self.end.second or self.end.microsecond:
            raise ValueError("Usa precisión de minutos.")
        if self.end <= self.start:
            raise ValueError("end debe ser posterior a start dentro del mismo día.")
        return self


class Course(ContractModel):
    id: Text
    name: Text
    priority: Literal["low", "medium", "high"] = "medium"
    weekly_hours: int = Field(ge=1, le=40)


class PlannerRequest(ContractModel):
    week_start: date
    timezone: Literal["America/Lima"] = "America/Lima"
    availability: list[TimeWindow] = Field(min_length=1, max_length=50)
    courses: list[Course] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.week_start.weekday() != 0:
            raise ValueError("week_start debe ser lunes.")
        ids = [course.id for course in self.courses]
        if len(ids) != len(set(ids)):
            raise ValueError("Los identificadores de cursos deben ser únicos.")
        for index, window in enumerate(self.availability):
            for other in self.availability[index + 1:]:
                if window.day == other.day and window.start < other.end and other.start < window.end:
                    raise ValueError("Las ventanas de disponibilidad no deben superponerse.")
        return self


class StudySession(TimeWindow):
    course_id: Text
    objective: Text


class PlannerResponse(ContractModel):
    week_start: date
    timezone: Literal["America/Lima"] = "America/Lima"
    sessions: list[StudySession]
    warnings: list[Text] = Field(default_factory=list)
