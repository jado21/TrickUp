from unittest.mock import patch

import pytest

from app.config import Settings, load_settings
from app.services.gemini import GeminiService


def test_environment_settings(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-not-real")
    monkeypatch.setenv("GEMINI_MODEL", "test-model")
    settings = load_settings()
    assert settings.gemini_model == "test-model"
    assert settings.gemini_api_key.get_secret_value() == "test-not-real"
    assert "test-not-real" not in repr(settings)


def test_service_is_lazy():
    with patch("app.services.gemini.genai.Client") as constructor:
        service = GeminiService(Settings())
        constructor.assert_not_called()
        with pytest.raises(ValueError, match="GEMINI_API_KEY"):
            service.create_client()
        constructor.assert_not_called()


def test_service_client_configuration():
    with patch("app.services.gemini.genai.Client") as constructor:
        service = GeminiService(Settings(gemini_api_key="test-not-real", gemini_model="test-model"))
        assert service.create_client() is constructor.return_value
        constructor.assert_called_once_with(api_key="test-not-real")
