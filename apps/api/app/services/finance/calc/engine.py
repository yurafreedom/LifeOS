"""``calculate``: validate one versioned input document and run its model.

The input is a JSON-compatible mapping and is never modified. The result is a
new JSON-compatible dict carrying the engine version and the canonical input
hash, so any change of input yields a different, separately identifiable result.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from app.services.finance.calc import amortizing, daily, revolving
from app.services.finance.calc.contracts import (
    COMPLETE,
    ENGINE_VERSION,
    INVALID,
    MODELS,
    PARTIAL,
    SCHEMA_VERSION,
    UNSUPPORTED,
)
from app.services.finance.calc.ledger import Ledger
from app.services.finance.calc.numbers import calc_context
from app.services.finance.calc.reader import CanonicalError, Issues, Reader, input_hash

_MODELS: dict[str, tuple[Callable[..., Any], Callable[..., dict[str, Any]]]] = {
    "daily_accrual": (daily.parse, daily.run),
    "amortizing": (amortizing.parse, amortizing.run),
    "revolving": (revolving.parse, revolving.run),
}


def _envelope(model: Any, digest: str | None, status: str, issues: Issues) -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "schema_version": SCHEMA_VERSION,
        "input_hash": digest,
        "model": model if isinstance(model, str) else None,
        "status": status,
        "missing_inputs": list(issues.missing),
        "unsupported": list(issues.unsupported),
        "errors": list(issues.errors),
        "not_applied": list(issues.not_applied),
        "limitations": list(issues.limitations),
        # A calculated balance is never the lender's statement of the debt.
        "balance_nature": "calculated_not_lender_statement",
    }


def _empty(result: dict[str, Any]) -> dict[str, Any]:
    return {
        **result,
        "currency": None,
        "opening": None,
        "closing": None,
        "totals": None,
        "rows": [],
        "explanations": [],
    }


def calculate(document: Mapping[str, Any]) -> dict[str, Any]:
    issues = Issues()
    if not isinstance(document, Mapping):
        issues.error("", "object_expected")
        return _empty(_envelope(None, None, INVALID, issues))
    try:
        digest = input_hash(document)
    except CanonicalError as exc:
        issues.error(exc.path, exc.code)
        return _empty(_envelope(document.get("model"), None, INVALID, issues))
    doc = dict(document)
    reader = Reader(issues)
    version = doc.get("schema_version")
    if version is None:
        issues.miss("schema_version")
    elif version != SCHEMA_VERSION:
        issues.unsupport("schema_version", "unsupported_schema_version", version)
    model = reader.choice(doc, "model", "", MODELS)
    spec = None
    if model is not None:
        parse, _ = _MODELS[model]
        with calc_context():
            spec = parse(reader, doc)
    if issues.errors:
        return _empty(_envelope(model, digest, INVALID, issues))
    if issues.blocked or spec is None:
        return _empty(_envelope(model, digest, UNSUPPORTED, issues))
    ledger = Ledger()
    _, run = _MODELS[model]
    with calc_context():
        try:
            body = run(spec, ledger, issues)
        except OverflowError as exc:
            issues.error("", str(exc))
            return _empty(_envelope(model, digest, INVALID, issues))
    if issues.errors:
        return _empty(_envelope(model, digest, INVALID, issues))
    incomplete = bool(issues.missing or issues.unsupported)
    status = PARTIAL if incomplete else COMPLETE
    body["totals"]["complete"] = not incomplete
    body["totals"]["excludes"] = [entry["path"] for entry in issues.unsupported] + list(
        issues.missing
    )
    result = _envelope(model, digest, status, issues)
    result.update(body)
    result["horizon"] = {"end_date": doc["horizon"]["end_date"]}
    result["rows"] = ledger.rows
    result["explanations"] = ledger.explanations
    return result
