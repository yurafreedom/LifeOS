from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.models import UserSession


def test_bootstrap_creates_only_first_account_and_session(
    client: TestClient, settings: Settings
) -> None:
    response = client.post(
        "/api/v1/auth/bootstrap",
        json={
            "email": "Owner@Example.com",
            "password": "correct-horse-battery",
            "bootstrap_token": settings.bootstrap_token.get_secret_value(),
        },
    )
    assert response.status_code == 201
    assert response.json()["email"] == "owner@example.com"
    assert settings.cookie_name in response.cookies
    assert client.get("/api/v1/state").status_code == 404

    second_response = client.post(
        "/api/v1/auth/bootstrap",
        json={
            "email": "other@example.com",
            "password": "correct-horse-battery",
            "bootstrap_token": settings.bootstrap_token.get_secret_value(),
        },
    )
    assert second_response.status_code == 409
    assert second_response.json()["code"] == "bootstrap_closed"


def test_login_is_case_insensitive_and_logout_revokes_session(
    client: TestClient,
    account_factory,
    settings: Settings,
    session_factory: sessionmaker[Session],
) -> None:
    account_factory("person@example.com", "correct-horse-battery")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": " PERSON@EXAMPLE.COM ", "password": "correct-horse-battery"},
    )
    assert response.status_code == 200
    raw_token = response.cookies.get(settings.cookie_name)
    assert raw_token
    with session_factory() as db:
        stored_hashes = list(db.scalars(select(UserSession.token_hash)))
    assert raw_token not in stored_hashes
    set_cookie = response.headers["set-cookie"]
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert client.get("/api/v1/auth/me").status_code == 200

    logout_response = client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    assert settings.cookie_name not in client.cookies


def test_login_uses_generic_error_for_unknown_email(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "incorrect-password"},
    )
    assert response.status_code == 401
    assert response.json() == {
        "code": "invalid_credentials",
        "message": "Email or password is invalid.",
    }
