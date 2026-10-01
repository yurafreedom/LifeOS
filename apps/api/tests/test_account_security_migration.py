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
M11 = "20261001_0011"
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


def test_m11_is_the_head_on_m10_on_m9(test_database_url):
    from alembic.script import ScriptDirectory

    script = ScriptDirectory.from_config(_config(test_database_url))
    assert script.get_heads() == [M11]
    assert script.get_revision(M11).down_revision == M10
    assert script.get_revision(M10).down_revision == M9


def test_m11_clears_only_verification_that_an_unsent_invitation_produced(engine, test_database_url):
    """Each case: (delivery, verified at acceptance?, expect verified after M11)."""
    config = _config(test_database_url)
    command.downgrade(config, M10)
    cases = {
        "manual-accept": ("manual", "accepted", False),
        "failed-accept": ("failed", "accepted", False),
        "pending-accept": ("pending", "accepted", False),
        "sent-accept": ("sent", "accepted", True),
        "manual-later": ("manual", "later", True),   # verified some other way afterwards
        "manual-never": ("manual", None, False),     # was never verified: stays unverified
    }
    try:
        with engine.begin() as connection:
            owner = str(uuid4())
            connection.execute(
                text("INSERT INTO users (id, email, password_hash, role) VALUES (:id, 'm11-owner@example.com', 'x', 'owner')"),
                {"id": owner},
            )
            for name, (delivery, verified, _expected) in cases.items():
                user_id = str(uuid4())
                verified_sql = {
                    "accepted": "TIMESTAMPTZ '2026-10-01 10:00:00+00'",
                    "later": "TIMESTAMPTZ '2026-10-02 09:00:00+00'",
                    None: "NULL",
                }[verified]
                connection.execute(
                    text(
                        "INSERT INTO users (id, email, password_hash, email_verified_at) "
                        f"VALUES (:id, :email, 'x', {verified_sql})"
                    ),
                    {"id": user_id, "email": f"{name}@example.com"},
                )
                connection.execute(
                    text(
                        "INSERT INTO account_invitations (id, email, invited_by, token_hash, expires_at, "
                        "accepted_at, accepted_user_id, delivery) VALUES (:id, :email, :owner, :hash, "
                        "TIMESTAMPTZ '2026-10-08 10:00:00+00', TIMESTAMPTZ '2026-10-01 10:00:00+00', :user, :delivery)"
                    ),
                    {"id": str(uuid4()), "email": f"{name}@example.com", "owner": owner,
                     "hash": uuid4().hex + uuid4().hex, "user": user_id, "delivery": delivery},
                )
    finally:
        command.upgrade(config, "head")
    with engine.connect() as connection:
        rows = dict(connection.execute(text(
            "SELECT split_part(email, '@', 1), email_verified_at IS NOT NULL FROM users WHERE email <> 'm11-owner@example.com'"
        )).all())
    for name, (_delivery, _verified, expected) in cases.items():
        assert rows[name] is expected, name
