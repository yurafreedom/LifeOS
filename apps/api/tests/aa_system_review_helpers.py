"""Request helpers and a pinned clock for the Slice 7 System Review suites.

The pinned instant is 15 October 2026, 12:00 Kyiv: September 2026 has ended (its
review is available), October is in progress. Facts are written through the
real API so every derivation reads exactly what production would.
"""

import calendar
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.services.system_review import periods

KYIV = "Europe/Kyiv"
NOW = datetime(2026, 10, 15, 9, tzinfo=UTC)
SEPTEMBER = "2026-09"
BASE = "/api/v1/aa"
M7_TABLES = (
    "aa_importance_ratings",
    "aa_cross_references",
    "aa_relation_feedback",
    "aa_finance_contexts",
    "aa_system_review_revisions",
)


@pytest.fixture
def sr_clock(monkeypatch) -> dict[str, datetime]:
    state = {"now": NOW}
    monkeypatch.setattr(periods, "server_now", lambda: state["now"])
    return state


def key() -> str:
    return f"k-{uuid4()}"


def money(amount: str, unit: str = "UAH") -> dict[str, Any]:
    return {"type": "money", "unit_code": unit, "num": amount}


def ok(response, *codes: int) -> dict[str, Any]:
    assert response.status_code in (codes or (200, 201)), response.text
    return response.json()


def transaction(
    client, transaction_id: str, amount: str, day: str = "2026-09-10", *,
    category: str = "restaurants", idempotency_key: str | None = None,
) -> dict[str, Any]:
    return ok(client.post(f"{BASE}/measurements", json={
        "metric_key": "finance.transaction_amount",
        "subject": {"domain": "finance", "type": "transaction", "id": transaction_id},
        "value": money(amount),
        "occurred_at": f"{day}T09:00:00+00:00",
        "occurred_tz": KYIV,
        "provenance": {"source_kind": "USER_REPORTED", "basis": "1 операция",
                       "method": "Ручная запись"},
        "dimensions": {"category_id": category, "included_by_default": True},
        "idempotency_key": idempotency_key or key(),
    }))


def correct(client, measurement_id: str, amount: str) -> dict[str, Any]:
    return ok(client.post(f"{BASE}/measurements/{measurement_id}/correct", json={
        "value": money(amount),
        "reason": "Сумма записана с ошибкой",
        "provenance": {"source_kind": "USER_REPORTED", "basis": "исправление",
                       "method": "CORRECTION"},
        "idempotency_key": key(),
    }))


def _window(period: str) -> dict[str, str]:
    year, month = (int(part) for part in period.split("-"))
    last = calendar.monthrange(year, month)[1]
    return {"window_start": f"{period}-01", "window_end": f"{period}-{last:02d}",
            "timezone": KYIV}


def target(client, period: str, amount: str, direction: str = "lower") -> dict[str, Any]:
    return ok(client.post(f"{BASE}/targets", json={
        "subject": {"domain": "finance", "type": "period", "id": period},
        "metric_key": "finance.monthly_spend",
        "value": money(amount),
        "desired_direction": direction,
        **_window(period),
        "provenance": {"source_kind": "USER_REPORTED"},
        "idempotency_key": key(),
    }))


def expectation(client, period: str, amount: str) -> dict[str, Any]:
    return ok(client.post(f"{BASE}/expectations", json={
        "subject": {"domain": "finance", "type": "period", "id": period},
        "metric_key": "finance.monthly_spend",
        "value": money(amount),
        **_window(period),
        "effective_from": f"{period}-01T00:00:00+00:00",
        "provenance": {"source_kind": "USER_REPORTED"},
        "idempotency_key": key(),
    }))


def observation(client, label: str, day: str = "2026-09-11") -> dict[str, Any]:
    return ok(client.post(f"{BASE}/observations", json={
        "subject": {"domain": "system", "type": "window", "id": ""},
        "metric_key": None,
        "value": {"type": "categorical", "text": label},
        "epistemic_kind": "mine",
        "occurred_at": f"{day}T18:00:00+00:00",
        "occurred_tz": KYIV,
        "provenance": {"source_kind": "USER_REPORTED", "basis": "самонаблюдение",
                       "method": "manual"},
        "idempotency_key": key(),
    }))


def context(client, kind: str, payload: dict[str, Any], *, subject_key: str = "",
            entity_id: str | None = None) -> dict[str, Any]:
    return ok(client.post(f"{BASE}/finance-contexts", json={
        "entity_id": entity_id or str(uuid4()),
        "kind": kind,
        "subject_key": subject_key,
        "payload": payload,
        "idempotency_key": key(),
    }))


def expense_context(client, transaction_id: str, **payload: Any) -> dict[str, Any]:
    return context(client, "expense_context", payload,
                   subject_key=f"finance:transaction:{transaction_id}")


def obligation(client, **overrides: Any) -> dict[str, Any]:
    payload = {"label": "Кредитная карта", "obligation_kind": "credit_card",
               "currency": "UAH", "outstanding": "20000.00", "monthly_payment": "2000.00",
               "annual_rate_percent": "24", "as_of": "2026-09-01"}
    payload.update(overrides)
    return context(client, "obligation", {k: v for k, v in payload.items() if v is not None})


def review(client, period: str = SEPTEMBER) -> dict[str, Any]:
    return ok(client.get(f"{BASE}/system-review", params={"period": period}), 200)


def waiting(client) -> dict[str, Any]:
    return ok(client.get(f"{BASE}/system-review/waiting"), 200)


def link(client, from_key: str, to_key: str, **extra: Any):
    body = {"id": str(uuid4()), "from_key": from_key, "to_key": to_key,
            "idempotency_key": key(), **extra}
    return client.post(f"{BASE}/relations", json=body)


def respond(client, candidate: dict[str, Any], response: str, **extra: Any):
    return client.post(f"{BASE}/relations/proposals/respond", json={
        "period": candidate["period"],
        "proposal_key": candidate["proposal_key"],
        "response": response,
        "evaluated_at": NOW.isoformat(),
        "idempotency_key": extra.pop("idempotency_key", key()),
        **extra,
    })


def save(client, period: str = SEPTEMBER, base: int | None = None, **body: Any):
    return client.post(f"{BASE}/system-reviews/{period}/revisions", json={
        "base_revision": base, "idempotency_key": body.pop("idempotency_key", key()), **body,
    })


def row_counts(engine) -> dict[str, int]:
    with engine.begin() as connection:
        names = list(connection.scalars(text(
            "SELECT table_name FROM information_schema.tables"
            " WHERE table_schema = 'public' AND table_name LIKE 'aa\\_%'"
        )))
        return {
            name: connection.scalar(text(f"SELECT count(*) FROM {name}")) for name in names
        }


def walk_keys(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        for name, inner in value.items():
            found.add(str(name))
            found |= walk_keys(inner)
    elif isinstance(value, list):
        for inner in value:
            found |= walk_keys(inner)
    return found


def walk_strings(value: Any) -> list[str]:
    if isinstance(value, dict):
        return [s for inner in value.values() for s in walk_strings(inner)]
    if isinstance(value, list):
        return [s for inner in value for s in walk_strings(inner)]
    return [value] if isinstance(value, str) else []
