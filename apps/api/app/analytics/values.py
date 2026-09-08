"""Value / unit contract.

``value_type`` is a discriminator with per-type requirements, enforced in two
places: here at the Pydantic/service boundary, and by a database CHECK
constraint rendered by :func:`value_check_sql`. A single unchecked
``value_num + value_text + unit`` triple would be the "anything field"; instead a
stored fact always carries exactly the columns its declared shape requires and
no others.

Two consequences are load-bearing:

* There is **no** ``unknown`` value type. A missing observation is the absence of
  a row (correction C5). ``0`` remains a legitimate numeric value, and is
  therefore not interchangeable with absence.
* No numeric column spans units, so a cross-unit score has nowhere to live.
"""

import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.analytics.enums import ValueType

CURRENCY_PATTERN = re.compile(r"^[A-Z]{3}$")
CANONICAL_DURATION_UNIT = "minute"

VALUE_COLUMNS = ("unit_code", "value_num", "value_date", "value_text", "scale_min", "scale_max")

# Per value_type: the columns that must be populated, and the columns that must
# be NULL. Every column not required is forbidden — "no illegal multiple value
# columns" is enforced structurally rather than by convention.
REQUIRED_COLUMNS: dict[ValueType, tuple[str, ...]] = {
    ValueType.MONEY: ("value_num", "unit_code"),
    ValueType.DATE: ("value_date",),
    ValueType.DURATION: ("value_num", "unit_code"),
    ValueType.COUNT: ("value_num",),
    ValueType.SCALE: ("value_num", "scale_min", "scale_max"),
    ValueType.CATEGORICAL: ("value_text",),
}

FORBIDDEN_COLUMNS: dict[ValueType, tuple[str, ...]] = {
    value_type: tuple(column for column in VALUE_COLUMNS if column not in required)
    for value_type, required in REQUIRED_COLUMNS.items()
}


class InvalidValueError(ValueError):
    """A value does not satisfy the contract for its declared type."""

    code = "invalid_value_for_type"

    def __init__(self, value_type: ValueType | str, field: str, message: str) -> None:
        self.value_type = str(value_type)
        self.field = field
        super().__init__(message)


@dataclass(frozen=True, slots=True)
class FactValue:
    """A validated value of one declared domain shape."""

    value_type: ValueType
    unit_code: str | None = None
    value_num: Decimal | None = None
    value_date: date | None = None
    value_text: str | None = None
    scale_min: Decimal | None = None
    scale_max: Decimal | None = None

    def column_values(self) -> dict[str, object]:
        return {column: getattr(self, column) for column in VALUE_COLUMNS}


def validate_value(value: FactValue) -> FactValue:
    """Raise :class:`InvalidValueError` unless the value matches its type."""
    value_type = ValueType(value.value_type)
    present = value.column_values()

    for column in REQUIRED_COLUMNS[value_type]:
        if present[column] is None:
            raise InvalidValueError(
                value_type, column, f"{value_type} requires {column}"
            )
    for column in FORBIDDEN_COLUMNS[value_type]:
        if present[column] is not None:
            raise InvalidValueError(
                value_type, column, f"{value_type} must not carry {column}"
            )

    if value_type is ValueType.MONEY:
        if not CURRENCY_PATTERN.match(value.unit_code or ""):
            raise InvalidValueError(
                value_type, "unit_code", "money requires an ISO-4217 alphabetic code"
            )
    elif value_type is ValueType.DURATION:
        if value.unit_code != CANONICAL_DURATION_UNIT:
            raise InvalidValueError(
                value_type,
                "unit_code",
                f"duration is stored in canonical '{CANONICAL_DURATION_UNIT}' units",
            )
    elif value_type is ValueType.SCALE:
        assert value.scale_min is not None and value.scale_max is not None
        assert value.value_num is not None
        if value.scale_min >= value.scale_max:
            raise InvalidValueError(value_type, "scale_min", "scale_min must be below scale_max")
        if not (value.scale_min <= value.value_num <= value.scale_max):
            raise InvalidValueError(
                value_type, "value_num", "scale value must fall within its own bounds"
            )
    elif value_type is ValueType.CATEGORICAL:
        if not (value.value_text or "").strip():
            raise InvalidValueError(
                value_type, "value_text", "categorical requires a non-empty label"
            )

    return value


def _branch_sql(value_type: ValueType) -> str:
    clauses = [f"{column} IS NOT NULL" for column in REQUIRED_COLUMNS[value_type]]
    clauses += [f"{column} IS NULL" for column in FORBIDDEN_COLUMNS[value_type]]
    if value_type is ValueType.MONEY:
        clauses.append("unit_code ~ '^[A-Z]{3}$'")
    elif value_type is ValueType.DURATION:
        clauses.append(f"unit_code = '{CANONICAL_DURATION_UNIT}'")
    elif value_type is ValueType.SCALE:
        clauses.append("scale_min < scale_max")
        clauses.append("value_num >= scale_min")
        clauses.append("value_num <= scale_max")
    elif value_type is ValueType.CATEGORICAL:
        clauses.append("btrim(value_text) <> ''")
    return " AND ".join(clauses)


def value_check_sql() -> str:
    """Render the CHECK expression enforcing the value contract in the database.

    Kept as one expression so that no value_type can be added to the enum
    without a matching branch here; the ``ELSE false`` arm rejects anything that
    slips past the ``value_type`` membership constraint.
    """
    branches = "\n".join(
        f"    WHEN '{value_type.value}' THEN {_branch_sql(value_type)}" for value_type in ValueType
    )
    return f"CASE value_type\n{branches}\n    ELSE false\nEND"
