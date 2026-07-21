import os
from collections.abc import Callable, Generator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import pytest
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from alembic import command
from app.config import Settings
from app.main import create_app
from app.models import User, UserSession
from app.security.passwords import hash_password
from app.security.sessions import hash_session_token


@dataclass(frozen=True)
class TestAccount:
    user_id: UUID
    email: str
    raw_token: str


@pytest.fixture(scope="session")
def test_database_url() -> str:
    database_url = os.getenv("LIFEOS_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("LIFEOS_TEST_DATABASE_URL is required for API integration tests")
    database_name = make_url(database_url).database or ""
    if not database_name.endswith("_test"):
        raise pytest.UsageError("Refusing to run unless the database name ends with _test")
    return database_url


@pytest.fixture(scope="session")
def engine(test_database_url: str) -> Generator[Engine, None, None]:
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", test_database_url)
    command.upgrade(config, "head")
    test_engine = create_engine(test_database_url, pool_pre_ping=True)
    try:
        yield test_engine
    finally:
        test_engine.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, class_=Session, expire_on_commit=False)


@pytest.fixture(autouse=True)
def clean_database(engine: Engine) -> Generator[None, None, None]:
    statement = text("TRUNCATE TABLE user_snapshots, sessions, users CASCADE")
    with engine.begin() as connection:
        connection.execute(statement)
    yield
    with engine.begin() as connection:
        connection.execute(statement)


@pytest.fixture
def settings(test_database_url: str) -> Settings:
    return Settings(
        environment="test",
        database_url=test_database_url,
        bootstrap_token="test-bootstrap-token-that-is-at-least-32-chars",
        allowed_hosts=["testserver"],
        allowed_origins=["http://testserver"],
        cookie_secure=False,
    )


@pytest.fixture
def app(settings: Settings, session_factory: sessionmaker[Session]) -> FastAPI:
    return create_app(settings=settings, session_factory=session_factory)


@pytest.fixture
def client(app: FastAPI) -> Generator[TestClient, None, None]:
    with TestClient(app, headers={"Origin": "http://testserver"}) as test_client:
        yield test_client


@pytest.fixture
def account_factory(
    session_factory: sessionmaker[Session],
) -> Callable[[str, str], TestAccount]:
    def create_account(email: str, password: str = "correct-horse-battery") -> TestAccount:
        raw_token = f"test-token-{email}"
        with session_factory.begin() as db:
            user = User(email=email.casefold(), password_hash=hash_password(password))
            db.add(user)
            db.flush()
            db.add(
                UserSession(
                    user_id=user.id,
                    token_hash=hash_session_token(raw_token),
                    last_seen_at=datetime.now(UTC),
                    expires_at=datetime.now(UTC) + timedelta(days=30),
                )
            )
        return TestAccount(user_id=user.id, email=user.email, raw_token=raw_token)

    return create_account
