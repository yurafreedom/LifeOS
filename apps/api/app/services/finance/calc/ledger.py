"""Result rows and the explanation ledger.

Every amount the engine produces is written once, as a row, and justified by
one or more explanation entries that name the date, the rule (input path) and
the inputs used. Rows point at their explanations by sequence number.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from app.services.finance.calc.numbers import iso, plain


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return plain(value)
    if isinstance(value, date):
        return iso(value)
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return value


@dataclass
class Ledger:
    rows: list[dict[str, Any]] = field(default_factory=list)
    explanations: list[dict[str, Any]] = field(default_factory=list)

    def explain(
        self, day: date, code: str, rule: str, *, amount_minor: int | None = None, **inputs: Any
    ) -> int:
        seq = len(self.explanations) + 1
        entry: dict[str, Any] = {"seq": seq, "date": iso(day), "code": code, "rule": rule}
        if amount_minor is not None:
            entry["amount_minor"] = amount_minor
        if inputs:
            entry["inputs"] = _jsonable(inputs)
        self.explanations.append(entry)
        return seq

    def row(self, day: date, kind: str, *, explanation: list[int], **values: Any) -> dict[str, Any]:
        row = {"date": iso(day), "kind": kind, **_jsonable(values), "explanation": explanation}
        self.rows.append(row)
        return row


class Segments:
    """Merges consecutive accrual days with the same base and daily rate into one row."""

    def __init__(self, ledger: Ledger, rule: str, base_name: str) -> None:
        self.ledger = ledger
        self.rule = rule
        self.base_name = base_name
        self.current: dict[str, Any] | None = None

    def add(
        self, day: date, base: int, daily_rate: Decimal, rounded: int | None, exact: Decimal
    ) -> None:
        cur = self.current
        if (
            cur is not None
            and cur["base"] == base
            and cur["rate"] == daily_rate
            and (day - cur["end"]).days == 1
        ):
            cur["end"] = day
            cur["days"] += 1
            cur["exact"] += exact
            if rounded is not None:
                cur["rounded"] += rounded
            return
        self.flush()
        self.current = {
            "start": day,
            "end": day,
            "days": 1,
            "base": base,
            "rate": daily_rate,
            "exact": exact,
            "rounded": rounded,
        }

    def flush(self) -> None:
        cur = self.current
        if cur is None:
            return
        self.current = None
        values: dict[str, Any] = {
            "from": cur["start"],
            "to": cur["end"],
            "days": cur["days"],
            self.base_name: cur["base"],
            "daily_rate": cur["rate"],
            "interest_exact": cur["exact"],
        }
        if cur["rounded"] is not None:
            values["interest_minor"] = cur["rounded"]
        seq = self.ledger.explain(
            cur["end"],
            "accrual",
            self.rule,
            amount_minor=cur["rounded"],
            **{
                "from": cur["start"],
                "days": cur["days"],
                self.base_name: cur["base"],
                "daily_rate": cur["rate"],
                "interest_exact": cur["exact"],
                "rounded_per_day": cur["rounded"] is not None,
            },
        )
        self.ledger.row(cur["end"], "accrual", explanation=[seq], **values)
