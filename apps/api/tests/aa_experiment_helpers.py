"""Request helpers and a pinned clock for the Slice 6 Experiment suites.

The canonical window is 1–21 October 2026 in Europe/Kyiv (UTC+3 until the
switch on 25 October). With the default pinned clock, 9 October 12:00 Kyiv,
nine window days have elapsed and twelve are still in the future.
"""

from datetime import UTC, date, datetime
from typing import Any
from uuid import uuid4

import pytest

from app.services import aa_comparison
from app.services.experiments import days

KYIV = "Europe/Kyiv"
WINDOW_START = date(2026, 10, 1)
WINDOW_END = date(2026, 10, 21)
HYPOTHESIS_AT = datetime(2026, 9, 30, 9, tzinfo=UTC)
STARTED_AT = datetime(2026, 10, 1, 6, tzinfo=UTC)
NOW = datetime(2026, 10, 9, 9, tzinfo=UTC)  # 12:00 Kyiv, day 9 of 21
BASE = "/api/v1/aa/experiments"


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC)


@pytest.fixture
def clock(monkeypatch) -> dict[str, datetime]:
    """Pin the server clock the experiment rules and the semantic writer read."""
    state = {"now": NOW}
    monkeypatch.setattr(days, "server_now", lambda: state["now"])

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return state["now"]

    monkeypatch.setattr(aa_comparison, "datetime", Clock)
    return state


def key() -> str:
    return f"k-{uuid4()}"


def create_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "id": str(uuid4()),
        "title": "Экран до 23:00",
        "hypothesis": "Если убрать экран после 23:00, я буду засыпать быстрее.",
        "hypothesis_recorded_at": HYPOTHESIS_AT.isoformat(),
        "intervention": "Телефон в другой комнате с 23:00.",
        "window_start": WINDOW_START.isoformat(),
        "window_end": WINDOW_END.isoformat(),
        "timezone": KYIV,
        "outcome": {"label": "Время засыпания", "value_type": "duration", "unit_code": "minute"},
        "idempotency_key": key(),
    }
    body.update(overrides)
    return body


def create(client, **overrides: Any):
    return client.post(BASE, json=create_body(**overrides))


def created(client, **overrides: Any) -> str:
    response = create(client, **overrides)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def move(client, experiment_id: str, to: str, at: datetime, idempotency_key: str | None = None):
    return client.post(
        f"{BASE}/{experiment_id}/transition",
        json={"to": to, "occurred_at": at.isoformat(), "idempotency_key": idempotency_key or key()},
    )


def running(client, **overrides: Any) -> str:
    experiment_id = created(client, **overrides)
    response = move(client, experiment_id, "RUNNING", STARTED_AT)
    assert response.status_code == 200, response.text
    return experiment_id


def adhere(
    client, experiment_id: str, day: date, state: str = "kept", *,
    supersedes: str | None = None, idempotency_key: str | None = None,
):
    body = {"day": day.isoformat(), "state": state, "idempotency_key": idempotency_key or key()}
    if supersedes is not None:
        body["supersedes_idempotency_key"] = supersedes
    return client.post(f"{BASE}/{experiment_id}/adherence", json=body)


def minutes(num: str) -> dict[str, Any]:
    return {"type": "duration", "unit_code": "minute", "num": num}


def observe(
    client, experiment_id: str, value: dict[str, Any], at: datetime, *,
    role: str = "outcome", label: str = "Время засыпания", idempotency_key: str | None = None,
):
    return client.post(
        f"{BASE}/{experiment_id}/observations",
        json={
            "role": role, "label": label, "value": value, "occurred_at": at.isoformat(),
            "occurred_tz": KYIV, "idempotency_key": idempotency_key or key(),
        },
    )


def baseline(
    client, experiment_id: str, value: dict[str, Any], *, idempotency_key: str | None = None,
    window_start: str = "2026-09-01", window_end: str = "2026-09-30",
):
    return client.post(
        f"{BASE}/{experiment_id}/baseline",
        json={
            "value": value, "window_start": window_start, "window_end": window_end,
            "basis": "Средняя по дневнику сна", "idempotency_key": idempotency_key or key(),
        },
    )


def condition(
    client, experiment_id: str, text: str, at: datetime, *, epistemic_kind: str = "observed",
    idempotency_key: str | None = None,
):
    return client.post(
        f"{BASE}/{experiment_id}/conditions",
        json={
            "text": text, "epistemic_kind": epistemic_kind, "occurred_at": at.isoformat(),
            "occurred_tz": KYIV, "idempotency_key": idempotency_key or key(),
        },
    )


def decide(
    client, experiment_id: str, choice: str | None, *, add_factors=(), retract=(),
    idempotency_key: str | None = None,
):
    return client.post(
        f"{BASE}/{experiment_id}/decision",
        json={
            "choice": choice, "add_factors": list(add_factors),
            "retract_factor_ids": list(retract), "idempotency_key": idempotency_key or key(),
        },
    )


def completed(client, clock, **overrides: Any) -> str:
    """A RUNNING experiment whose window has elapsed, moved to awaiting review."""
    experiment_id = running(client, **overrides)
    clock["now"] = utc(2026, 10, 23, 9)
    response = move(client, experiment_id, "COMPLETED_AWAITING_REVIEW", utc(2026, 10, 23, 8))
    assert response.status_code == 200, response.text
    return experiment_id


def detail(client, experiment_id: str) -> dict[str, Any]:
    response = client.get(f"{BASE}/{experiment_id}")
    assert response.status_code == 200, response.text
    return response.json()
