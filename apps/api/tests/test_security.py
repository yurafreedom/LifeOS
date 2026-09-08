from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings


def test_unsafe_route_rejects_cross_site_request(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": "https://attacker.example", "Sec-Fetch-Site": "cross-site"},
        json={"email": "person@example.com", "password": "incorrect-password"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden_origin"


def test_json_endpoint_rejects_wrong_content_type(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        content="email=person%40example.com&password=incorrect-password",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 415


def test_state_body_limit_rejects_before_json_parsing(
    client: TestClient, settings: Settings
) -> None:
    response = client.put(
        "/api/v1/state",
        content=b"x" * (settings.max_snapshot_bytes + 1),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json()["code"] == "snapshot_too_large"


def test_unsafe_route_rejects_missing_source_headers(app: FastAPI) -> None:
    with TestClient(app) as no_origin_client:
        response = no_origin_client.post(
            "/api/v1/auth/login",
            json={"email": "person@example.com", "password": "incorrect-password"},
        )
    assert response.status_code == 403


def test_production_requires_secure_cookie(test_database_url: str) -> None:
    try:
        Settings(
            environment="production",
            database_url=test_database_url,
            bootstrap_token="test-bootstrap-token-that-is-at-least-32-chars",
            allowed_hosts=["lifeos.example"],
            allowed_origins=["https://lifeos.example"],
            cookie_secure=False,
        )
    except ValueError as error:
        assert "cookie_secure" in str(error)
    else:
        raise AssertionError("Production settings accepted an insecure cookie")
