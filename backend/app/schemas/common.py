from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ErrorDetail(ContractModel):
    field: str
    message: str


class ErrorBody(ContractModel):
    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorResponse(ContractModel):
    error: ErrorBody


class HealthResponse(ContractModel):
    status: Literal["ok"] = "ok"
    service: Literal["trikup-backend"] = "trikup-backend"
    version: Literal["0.1.0"] = "0.1.0"
