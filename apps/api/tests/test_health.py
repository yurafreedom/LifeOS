from fastapi.testclient import TestClient


def test_health_checks_database(client: TestClient) -> None:
    response = client.get("/api/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
