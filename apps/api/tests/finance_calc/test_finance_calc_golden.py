"""Golden synthetic contracts: one engine, many rule combinations, no per-contract code.

Each fixture in ``fixtures/`` is a synthetic lender configuration with its
expected values derived **by hand** (the derivation is stored in the fixture).
The same ``calculate`` call runs all of them: adding a contract whose mechanics
are in the catalogue means adding a JSON file, never code.

These fixtures demonstrate defined calculation mechanics only. They say nothing
about document extraction accuracy.
"""

import copy
import json
from pathlib import Path

import pytest

from app.services.finance.calc import calculate

FIXTURES = sorted((Path(__file__).parent / "fixtures").glob("*.json"))


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _subset(actual, expected, where: str) -> None:
    if isinstance(expected, dict):
        assert isinstance(actual, dict), where
        for key, value in expected.items():
            assert key in actual, f"{where}.{key} missing"
            _subset(actual[key], value, f"{where}.{key}")
    else:
        assert actual == expected, f"{where}: {actual!r} != {expected!r}"


def test_at_least_eight_distinct_synthetic_contracts() -> None:
    fixtures = [_load(path) for path in FIXTURES]
    assert len(fixtures) >= 8
    assert {fixture["input"]["model"] for fixture in fixtures} == {
        "daily_accrual",
        "amortizing",
        "revolving",
    }
    for fixture in fixtures:
        assert fixture["derivation"], f"{fixture['id']} has no hand derivation"


@pytest.mark.parametrize("path", FIXTURES, ids=lambda path: path.stem)
def test_golden_contract(path: Path) -> None:
    fixture = _load(path)
    document = fixture["input"]
    before = copy.deepcopy(document)
    result = calculate(document)
    assert document == before, "the input document must not be modified"

    expected = fixture["expected"]
    assert result["status"] == expected["status"], (
        result["missing_inputs"],
        result["unsupported"],
        result["errors"],
    )
    for section in ("closing", "totals"):
        if section in expected:
            _subset(result[section], expected[section], section)
    for kind, rows in expected.get("rows_of_kind", {}).items():
        actual = [row for row in result["rows"] if row["kind"] == kind]
        assert len(actual) == len(rows), f"{kind}: {len(actual)} rows, expected {len(rows)}"
        for index, (got, want) in enumerate(zip(actual, rows, strict=True)):
            _subset(got, want, f"{kind}[{index}]")


@pytest.mark.parametrize("path", FIXTURES, ids=lambda path: path.stem)
def test_every_row_is_explained(path: Path) -> None:
    result = calculate(_load(path)["input"])
    sequences = {entry["seq"] for entry in result["explanations"]}
    for row in result["rows"]:
        assert row["explanation"], row
        assert set(row["explanation"]) <= sequences
    assert result["balance_nature"] == "calculated_not_lender_statement"
    assert result["closing"]["nature"] == "calculated"
