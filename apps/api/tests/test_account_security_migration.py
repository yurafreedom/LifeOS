"""M10 (JENKIN S1): account-security schema round trip and deterministic ownership.

Destructive downgrades run only against the disposable *_test database.
"""

from pathlib import Path
from uuid import uuid4

from alembic.config import Config
from sqlalchemy import inspect, text

from alembic import command

M9 = "20260930_0009"
M10 = "20261001_0010"
M10_TABLES = ("auth_tokens", "account_invitations", "auth_throttle", "auth_audit_events")


def _config(url: str) -> Config:
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    return config


def _insert_users(engine, count: int) -> list[str]:
    ids = [str(uuid4()) for _ in range(count)]
    with engine.begin() as connection:
        for index, user_id in enumerate(ids):
            connection.execute(
                text("INSERT INTO users (id, email, password_hash) VALUES (:id, :email, 'x')"),
                {"id": user_id, "email": f"m10-{index}@example.com"},
            )
    return ids


def _roles(engine) -> dict[str, str]:
    with engine.connect() as connection:
        return dict(connection.execute(text("SELECT email, role FROM users ORDER BY email")).all())


def test_m10_roundtrip_and_single_user_becomes_owner(engine, test_database_url):
    config = _config(test_database_url)
    command.downgrade(config, M9)
    try:
        names = set(inspect(engine).get_table_names())
        assert not set(M10_TABLES) & names
        assert "role" not in {c["name"] for c in inspect(engine).get_columns("users")}
        _insert_users(engine, 1)
    finally:
        command.upgrade(config, "head")
    assert set(M10_TABLES) <= set(inspect(engine).get_table_names())
    assert _roles(engine) == {"m10-0@example.com": "owner"}


def test_m10_promotes_no_one_when_historical_users_are_ambiguous(engine, test_database_url):
    config = _config(test_database_url)
    command.downgrade(config, M9)
    try:
        _insert_users(engine, 3)
    finally:
        command.upgrade(config, "head")
    assert set(_roles(engine).values()) == {"member"}


def test_m10_is_the_head_on_m9(test_database_url):
    from alembic.script import ScriptDirectory

    script = ScriptDirectory.from_config(_config(test_database_url))
    assert script.get_heads() == [M10]
    assert script.get_revision(M10).down_revision == M9
