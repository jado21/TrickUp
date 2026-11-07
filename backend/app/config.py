"""Configuración local; no exige credenciales para arrancar el servidor."""

import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, SecretStr


class Settings(BaseModel):
    gemini_api_key: SecretStr | None = None
    gemini_model: str | None = None
    gemini_structured_output: bool = True


def load_settings() -> Settings:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
        gemini_model=os.getenv("GEMINI_MODEL") or None,
        gemini_structured_output=os.getenv("GEMINI_STRUCTURED_OUTPUT", "true"),
    )
