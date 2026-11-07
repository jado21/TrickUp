"""Formato privado de generación con evidencia; nunca se expone en la API."""

from pydantic import Field

from app.schemas.common import ContractModel
from app.schemas.learning import Text


class SupportedText(ContractModel):
    text: Text
    source_quote: Text


class DraftLevel(ContractModel):
    title: SupportedText
    objectives: list[SupportedText] = Field(min_length=1, max_length=10)


class DraftUnit(ContractModel):
    title: SupportedText
    levels: list[DraftLevel] = Field(min_length=1, max_length=20)


class DraftSyllabus(ContractModel):
    course_name: SupportedText
    summary: SupportedText
    units: list[DraftUnit] = Field(min_length=1, max_length=20)


class SyllabusAnalysis(ContractModel):
    is_syllabus: bool
    syllabus: DraftSyllabus | None
