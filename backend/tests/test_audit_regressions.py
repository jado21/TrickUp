def test_standard_documentation_redirects(client):
    for alias, canonical in [("/docs", "/api/docs"), ("/openapi.json", "/api/openapi.json")]:
        response = client.get(alias, follow_redirects=False)
        assert response.status_code == 307
        assert response.headers["location"] == canonical
        assert client.get(alias).status_code == 200


def test_documentation_aliases_do_not_change_api_paths(client):
    spec = client.get("/openapi.json").json()
    assert all(path.startswith("/api/") for path in spec["paths"])
    post = spec["paths"]["/api/syllabus/analyze"]["post"]
    assert "multipart/form-data" in post["requestBody"]["content"]
    assert post["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith("SyllabusResponse")
