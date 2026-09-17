"""Account deletion invalidates every session, not just the current cookie."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.models import User, UserSession
from app.security.sessions import hash_session_token
from tests.aa_helpers import authenticate


def test_account_deletion_revokes_all_sessions(client, settings, account_factory, session_factory):
    owner = account_factory("all-sessions@example.com")
    second_token = "second-device-test-session"
    with session_factory.begin() as db:
        db.add(
            UserSession(
                user_id=owner.user_id,
                token_hash=hash_session_token(second_token),
                last_seen_at=datetime.now(UTC),
                expires_at=datetime.now(UTC) + timedelta(days=1),
            )
        )
    authenticate(client, settings, owner)
    response = client.request("DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"})
    assert response.status_code == 204
    with session_factory() as db:
        assert db.get(User, owner.user_id) is None
        assert (
            db.scalar(
                select(func.count())
                .select_from(UserSession)
                .where(UserSession.user_id == owner.user_id)
            )
            == 0
        )
    client.cookies.set(settings.cookie_name, second_token)
    assert client.get("/api/v1/export").status_code == 401
    assert (
        client.request(
            "DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"}
        ).status_code
        == 401
    )
