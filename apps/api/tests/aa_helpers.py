"""Shared request builders for the Adaptive Analytics suites."""

from typing import Any

METRIC_TRANSACTION = "finance.transaction_amount"
SUBJECT_TRANSACTION: dict[str, str] = {"domain": "finance", "type": "transaction", "id": "t01"}
SUBJECT_PERIOD: dict[str, str] = {"domain": "finance", "type": "period", "id": "2026-08"}
KYIV = "Europe/Kyiv"


def money(amount: str, unit_code: str = "UAH") -> dict[str, Any]:
    return {"type": "money", "unit_code": unit_code, "num": amount}


def measurement_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "metric_key": METRIC_TRANSACTION,
        "subject": dict(SUBJECT_TRANSACTION),
        "value": money("1200.00"),
        "occurred_at": "2026-08-14T10:00:00+00:00",
        "occurred_tz": KYIV,
        "provenance": {
            "source_kind": "USER_REPORTED",
            "basis": "1 операция",
            "method": "Ручная запись",
        },
        "idempotency_key": "idem-measurement-0001",
    }
    payload.update(overrides)
    return payload


def correction_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "value": money("120.00"),
        "reason": "Сумма записана с лишним нулём",
        "provenance": {
            "source_kind": "USER_REPORTED",
            "basis": "1 операция",
            "method": "Исправление вручную",
        },
        "idempotency_key": "idem-correction-0001",
    }
    payload.update(overrides)
    return payload


def authenticate(client: Any, settings: Any, account: Any) -> None:
    client.cookies.set(settings.cookie_name, account.raw_token)
