"""The write gate that holds until export and erasure exist (Slice 0b).

Slice 0 makes personal semantic history recordable, but the ability to export
and erase it does not arrive until the next slice. Until then no deployment may
accumulate that history, so the gate is closed by default everywhere and cannot
be opened in production at all.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.main import create_app
from app.models import AAMeasurement
from tests.aa_helpers import (
    METRIC_TRANSACTION,
    authenticate,
    correction_payload,
    measurement_payload,
)


@pytest.fixture
def gated_settings(test_database_url: str) -> Settings:
    return Settings(
        environment="test",
        database_url=test_database_url,
        bootstrap_token="test-bootstrap-token-that-is-at-least-32-chars",
        allowed_hosts=["testserver"],
        allowed_origins=["http://testserver"],
        cookie_secure=False,
    )


def test_the_gate_is_closed_unless_a_deployment_opts_in(gated_settings: Settings) -> None:
    assert gated_settings.aa_write_enabled is False


def test_production_may_not_open_the_gate(test_database_url: str) -> None:
    # Structural, not procedural: the settings object refuses to exist.
    with pytest.raises(ValueError, match="aa_write_enabled"):
        Settings(
            environment="production",
            database_url=test_database_url,
            bootstrap_token="test-bootstrap-token-that-is-at-least-32-chars",
            allowed_hosts=["lifeos.example"],
            allowed_origins=["https://lifeos.example"],
            cookie_secure=True,
            aa_write_enabled=True,
        )


def test_writes_are_refused_while_the_gate_is_closed(
    gated_settings: Settings, session_factory: sessionmaker, account_factory
) -> None:
    account = account_factory("gate@example.com")
    gated_app = create_app(settings=gated_settings, session_factory=session_factory)

    with TestClient(gated_app, headers={"Origin": "http://testserver"}) as gated_client:
        authenticate(gated_client, gated_settings, account)

        recorded = gated_client.post("/api/v1/aa/measurements", json=measurement_payload())
        assert recorded.status_code == 403
        assert recorded.json()["code"] == "aa_writes_disabled"

        corrected = gated_client.post(
            "/api/v1/aa/measurements/00000000-0000-4000-8000-000000000000/correct",
            json=correction_payload(),
        )
        assert corrected.status_code == 403
        assert corrected.json()["code"] == "aa_writes_disabled"

    with session_factory() as db:
        assert db.scalar(select(func.count(AAMeasurement.id))) == 0


def test_reads_stay_available_while_the_gate_is_closed(
    gated_settings: Settings, session_factory: sessionmaker, account_factory
) -> None:
    # The gate stops history accumulating, not the API existing. A read of an
    # empty history is harmless and keeps the surface testable.
    account = account_factory("gate-read@example.com")
    gated_app = create_app(settings=gated_settings, session_factory=session_factory)

    with TestClient(gated_app, headers={"Origin": "http://testserver"}) as gated_client:
        authenticate(gated_client, gated_settings, account)
        history = gated_client.get(
            f"/api/v1/aa/metrics/{METRIC_TRANSACTION}/history",
            params={"from": "2026-08-01T00:00:00+00:00", "to": "2026-08-31T23:59:59+00:00"},
        )
    assert history.status_code == 200
    assert history.json()["actual"] == []
