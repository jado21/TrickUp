import pytest


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "trikup-backend", "version": "0.1.0"}


@pytest.mark.parametrize("path,payload", [
    ("/api/roadmaps/generate", {"career": "Sistemas", "semester": 5, "goals": ["APIs"]}),
    ("/api/planner/generate", {
        "week_start": "2026-11-09",
        "availability": [{"day": "monday", "start": "18:00", "end": "20:00"}],
        "courses": [{"id": "c1", "name": "Cálculo", "weekly_hours": 2}],
    }),
])
def test_pending_json_routes(client, path, payload):
    response = client.post(path, json=payload)
    assert response.status_code == 501
    assert response.json()["error"]["code"] == "NOT_IMPLEMENTED"


def test_invalid_syllabus(client):
    response = client.post("/api/syllabus/analyze", files={"file": ("syllabus.pdf", b"%PDF-test", "application/pdf")})
    assert response.status_code == 422
    assert response.json()["error"]["details"] == []


@pytest.mark.parametrize("path", ["syllabus/analyze", "missions/generate", "roadmaps/generate", "planner/generate"])
def test_missing_input(client, path):
    response = client.post(f"/api/{path}")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.json()["error"]["details"]


def test_invalid_mission_and_extra_fields(client):
    response = client.post("/api/missions/generate", json={"course_name": " ", "topic": "Límites", "question_count": 0, "unexpected": True})
    assert response.status_code == 422
    fields = {item["field"] for item in response.json()["error"]["details"]}
    assert {"body.course_name", "body.question_count", "body.unexpected", "body.source_text"}.issubset(fields)


def test_invalid_json(client):
    response = client.post("/api/missions/generate", content="{", headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("method,path,status,code", [("get", "/api/missing", 404, "NOT_FOUND"), ("post", "/api/health", 405, "METHOD_NOT_ALLOWED")])
def test_http_errors(client, method, path, status, code):
    response = getattr(client, method)(path)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code


def test_cors(client):
    headers = {"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"}
    response = client.options("/api/missions/generate", headers=headers)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    headers["Origin"] = "https://other.example"
    assert "access-control-allow-origin" not in client.options("/api/missions/generate", headers=headers).headers


def test_openapi_contract(client):
    schema = client.get("/api/openapi.json").json()
    assert set(schema["paths"]) == {"/api/health", "/api/syllabus/analyze", "/api/missions/generate", "/api/missions/answer", "/api/missions/{mission_id}", "/api/roadmaps/generate", "/api/planner/generate"}
    for path in schema["paths"]:
        if "post" not in schema["paths"][path]:
            continue
        responses = schema["paths"][path]["post"]["responses"]
        assert responses["422"]["content"]["application/json"]["schema"]["$ref"].endswith("ErrorResponse")
        assert "200" in responses
        if path == "/api/syllabus/analyze" or path.startswith("/api/missions/"):
            assert "503" in responses and "501" not in responses
        else:
            assert "501" in responses
