"""Strict input reading with exact issue reporting.

Three kinds of problem are kept apart, because they mean different things:

* ``missing_inputs`` — a required rule or value is absent. It is never filled
  with a default.
* ``unsupported`` — the value names a mechanic outside the catalogue (an
  unknown field, an unknown fee kind, a variable rate, a disclosed APR offered
  as an accrual rate …). It is named with its path and value.
* ``errors`` — the document is malformed or contradictory (a float, a negative
  amount, a date outside the calculation, overlapping versions …).

Each missing/unsupported issue is *blocking* (nothing can be computed without
it) or *non-blocking* (the computation proceeds without that component and the
result can then only be ``partial``).
"""

from __future__ import annotations

import hashlib
import json
from datetime import date
from decimal import Decimal
from typing import Any

from app.services.finance.calc.contracts import MAX_MINOR
from app.services.finance.calc.numbers import parse_decimal_text


class Issues:
    def __init__(self) -> None:
        self.missing: list[str] = []
        self.unsupported: list[dict[str, Any]] = []
        self.errors: list[dict[str, Any]] = []
        self.not_applied: list[dict[str, Any]] = []
        self.limitations: list[str] = []
        self.blocked = False

    def miss(self, path: str, *, blocking: bool = True) -> None:
        if path not in self.missing:
            self.missing.append(path)
        self.blocked = self.blocked or blocking

    def unsupport(self, path: str, code: str, value: Any = None, *, blocking: bool = True) -> None:
        entry: dict[str, Any] = {"path": path, "code": code}
        if value is not None:
            entry["value"] = value
        self.unsupported.append(entry)
        self.blocked = self.blocked or blocking

    def error(self, path: str, code: str) -> None:
        self.errors.append({"path": path, "code": code})

    def limit(self, code: str) -> None:
        if code not in self.limitations:
            self.limitations.append(code)


# ───────────────────────── canonical form and hash ─────────────────────────


class CanonicalError(ValueError):
    def __init__(self, path: str, code: str) -> None:
        super().__init__(code)
        self.path = path
        self.code = code


def _check_json(value: Any, path: str) -> None:
    if value is None or isinstance(value, (bool, str)):
        return
    if isinstance(value, int):
        return
    if isinstance(value, float):
        raise CanonicalError(path, "float_not_allowed")
    if isinstance(value, Decimal):
        raise CanonicalError(path, "decimal_must_be_text")
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise CanonicalError(path, "non_text_key")
            _check_json(item, f"{path}.{key}" if path else key)
        return
    if isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            _check_json(item, f"{path}[{index}]")
        return
    raise CanonicalError(path, "unsupported_json_type")


def canonical_json(document: Any) -> str:
    """Sorted keys, no insignificant whitespace, UTF-8 text. Raises CanonicalError."""
    _check_json(document, "")
    return json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def input_hash(document: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(document).encode("utf-8")).hexdigest()


# ───────────────────────────── typed getters ─────────────────────────────


def _join(path: str, key: str) -> str:
    return f"{path}.{key}" if path else key


class Reader:
    def __init__(self, issues: Issues) -> None:
        self.issues = issues

    def known_keys(self, obj: dict[str, Any] | None, path: str, keys: tuple[str, ...]) -> None:
        if obj is None:
            return
        for key in obj:
            if key not in keys:
                self.issues.unsupport(_join(path, key), "unknown_field", blocking=False)

    def _value(
        self, obj: dict[str, Any] | None, key: str, path: str, required: bool, blocking: bool
    ):
        if obj is None:
            return None
        if key not in obj or obj[key] is None:
            if required:
                self.issues.miss(_join(path, key), blocking=blocking)
            return None
        return obj[key]

    def section(
        self,
        obj: dict[str, Any] | None,
        key: str,
        path: str,
        *,
        required: bool = True,
        blocking: bool = True,
    ) -> dict[str, Any] | None:
        value = self._value(obj, key, path, required, blocking)
        if value is None:
            return None
        if not isinstance(value, dict):
            self.issues.error(_join(path, key), "object_expected")
            return None
        return value

    def items(
        self, obj: dict[str, Any] | None, key: str, path: str, *, required: bool = False
    ) -> list[Any]:
        value = self._value(obj, key, path, required, True)
        if value is None:
            return []
        if not isinstance(value, list):
            self.issues.error(_join(path, key), "list_expected")
            return []
        return value

    def minor(
        self,
        obj: dict[str, Any] | None,
        key: str,
        path: str,
        *,
        required: bool = True,
        blocking: bool = True,
        positive: bool = False,
    ) -> int | None:
        value = self._value(obj, key, path, required, blocking)
        if value is None:
            return None
        if type(value) is not int:
            self.issues.error(_join(path, key), "integer_minor_units_expected")
            return None
        if value < 0 or value > MAX_MINOR or (positive and value == 0):
            self.issues.error(_join(path, key), "amount_out_of_range")
            return None
        return value

    def integer(
        self,
        obj: dict[str, Any] | None,
        key: str,
        path: str,
        low: int,
        high: int,
        *,
        required: bool = True,
        blocking: bool = True,
    ) -> int | None:
        value = self._value(obj, key, path, required, blocking)
        if value is None:
            return None
        if type(value) is not int:
            self.issues.error(_join(path, key), "integer_expected")
            return None
        if not low <= value <= high:
            self.issues.error(_join(path, key), "integer_out_of_range")
            return None
        return value

    def decimal(
        self,
        obj: dict[str, Any] | None,
        key: str,
        path: str,
        *,
        required: bool = True,
        blocking: bool = True,
    ) -> Decimal | None:
        value = self._value(obj, key, path, required, blocking)
        if value is None:
            return None
        if type(value) is int and value >= 0:
            return Decimal(value)
        if not isinstance(value, str):
            self.issues.error(_join(path, key), "decimal_text_expected")
            return None
        parsed = parse_decimal_text(value)
        if parsed is None:
            self.issues.error(_join(path, key), "decimal_text_expected")
        return parsed

    def day(
        self,
        obj: dict[str, Any] | None,
        key: str,
        path: str,
        *,
        required: bool = True,
        blocking: bool = True,
    ) -> date | None:
        value = self._value(obj, key, path, required, blocking)
        if value is None:
            return None
        if not isinstance(value, str) or len(value) != 10:
            self.issues.error(_join(path, key), "iso_date_expected")
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            self.issues.error(_join(path, key), "iso_date_expected")
            return None

    def flag(
        self,
        obj: dict[str, Any] | None,
        key: str,
        path: str,
        *,
        required: bool = True,
        blocking: bool = True,
    ) -> bool | None:
        value = self._value(obj, key, path, required, blocking)
        if value is None:
            return None
        if not isinstance(value, bool):
            self.issues.error(_join(path, key), "boolean_expected")
            return None
        return value

    def text(
        self,
        obj: dict[str, Any] | None,
        key: str,
        path: str,
        *,
        required: bool = True,
        blocking: bool = True,
        max_length: int = 64,
    ) -> str | None:
        value = self._value(obj, key, path, required, blocking)
        if value is None:
            return None
        if not isinstance(value, str) or not value or len(value) > max_length:
            self.issues.error(_join(path, key), "short_text_expected")
            return None
        return value

    def choice(
        self,
        obj: dict[str, Any] | None,
        key: str,
        path: str,
        choices: tuple[str, ...],
        *,
        required: bool = True,
        blocking: bool = True,
        known_unsupported: dict[str, str] | None = None,
    ) -> str | None:
        """An enumerated value. Unknown or known-unsupported values are *named* as unsupported."""
        value = self._value(obj, key, path, required, blocking)
        if value is None:
            return None
        if not isinstance(value, str):
            self.issues.error(_join(path, key), "text_expected")
            return None
        if value in choices:
            return value
        code = (known_unsupported or {}).get(value, "unsupported_value")
        self.issues.unsupport(_join(path, key), code, value, blocking=blocking)
        return None

    def choice_list(
        self,
        obj: dict[str, Any] | None,
        key: str,
        path: str,
        choices: tuple[str, ...],
        *,
        required: bool = True,
        blocking: bool = True,
        ignored: tuple[str, ...] = (),
    ) -> tuple[str, ...] | None:
        value = self._value(obj, key, path, required, blocking)
        if value is None:
            return None
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            self.issues.error(_join(path, key), "list_of_text_expected")
            return None
        if len(set(value)) != len(value):
            self.issues.error(_join(path, key), "duplicate_entries")
            return None
        result = []
        ok = True
        for item in value:
            if item in choices:
                result.append(item)
            elif item in ignored:
                self.issues.not_applied.append(
                    {"path": _join(path, key), "code": f"{item}_never_charged", "value": item}
                )
            else:
                self.issues.unsupport(
                    _join(path, key), "unsupported_value", item, blocking=blocking
                )
                ok = False
        return tuple(result) if ok else None
