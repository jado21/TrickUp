import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import Settings
from app.services.gemini import GeminiService
from app.services.syllabus import SyllabusService
from app.services.missions import MissionService
from app.services.mission_store import MissionStore


@pytest.fixture(autouse=True)
def isolate_gemini(monkeypatch):
    def forbidden_client(*args, **kwargs):
        raise AssertionError("Las pruebas deben simular Gemini; nunca consumir tokens.")
    monkeypatch.setattr("app.services.gemini.genai.Client", forbidden_client)
    monkeypatch.setitem(app.state._state, "syllabus_service", SyllabusService(GeminiService(Settings())))
    monkeypatch.setitem(app.state._state, "mission_service", MissionService(GeminiService(Settings()), MissionStore()))


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
