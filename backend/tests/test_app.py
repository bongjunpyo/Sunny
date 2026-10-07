from fastapi.testclient import TestClient

from api.main import create_app


def test_health_does_not_need_external_credentials(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_PUBLISHABLE_KEY", raising=False)
    with TestClient(create_app()) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_openapi_is_served_under_api_prefix():
    with TestClient(create_app()) as client:
        response = client.get("/api/openapi.json")
        assert response.status_code == 200
        assert "/api/health" in response.json()["paths"]
        assert client.get("/api/docs").status_code == 200


def test_unimplemented_business_routes_are_not_mock_successes():
    with TestClient(create_app()) as client:
        response = client.post("/api/orders", json={})
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"
