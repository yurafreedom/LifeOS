"""Value contract, including permanent regression test T-05.

T-05: **missing never becomes zero, and no synthetic `unknown` Measurement is
created merely because an expected observation is absent.** Absence is the
absence of a row; `value_type` has no `unknown` member; a derived no-data answer
writes nothing.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.analytics.enums import ValueType
from app.analytics.values import FactValue, InvalidValueError, validate_value


def test_value_type_has_no_unknown_member() -> None:
    # T-05: absence is representable only as the absence of a row. If an
    # `unknown` shape existed, code would eventually write one to stand in for a
    # missing observation.
    assert "unknown" not in {member.value for member in ValueType}
    assert len(ValueType) == 6


@pytest.mark.parametrize(
    "value",
    [
        FactValue(ValueType.MONEY, unit_code="UAH", value_num=Decimal("1200.00")),
        FactValue(ValueType.DATE, value_date=date(2026, 8, 25)),
        FactValue(ValueType.DURATION, unit_code="minute", value_num=Decimal("45")),
        FactValue(ValueType.COUNT, value_num=Decimal("3")),
        FactValue(
            ValueType.SCALE,
            value_num=Decimal("7"),
            scale_min=Decimal("1"),
            scale_max=Decimal("10"),
        ),
        FactValue(ValueType.CATEGORICAL, value_text="низкая"),
    ],
)
def test_legal_values_are_accepted(value: FactValue) -> None:
    assert validate_value(value) is value


@pytest.mark.parametrize(
    ("value", "field"),
    [
        (FactValue(ValueType.MONEY, value_num=Decimal("10")), "unit_code"),
        (FactValue(ValueType.MONEY, unit_code="uah", value_num=Decimal("10")), "unit_code"),
        (FactValue(ValueType.MONEY, unit_code="UAH"), "value_num"),
        (
            FactValue(
                ValueType.MONEY,
                unit_code="UAH",
                value_num=Decimal("10"),
                value_text="also text",
            ),
            "value_text",
        ),
        (FactValue(ValueType.DATE, value_num=Decimal("1")), "value_date"),
        (FactValue(ValueType.DURATION, unit_code="hour", value_num=Decimal("2")), "unit_code"),
        (FactValue(ValueType.COUNT, unit_code="UAH", value_num=Decimal("2")), "unit_code"),
        (
            FactValue(
                ValueType.SCALE,
                value_num=Decimal("11"),
                scale_min=Decimal("1"),
                scale_max=Decimal("10"),
            ),
            "value_num",
        ),
        (
            FactValue(
                ValueType.SCALE,
                value_num=Decimal("5"),
                scale_min=Decimal("10"),
                scale_max=Decimal("1"),
            ),
            "scale_min",
        ),
        (FactValue(ValueType.CATEGORICAL, value_text="   "), "value_text"),
        (FactValue(ValueType.CATEGORICAL, value_num=Decimal("1")), "value_text"),
    ],
)
def test_illegal_values_are_rejected(value: FactValue, field: str) -> None:
    with pytest.raises(InvalidValueError) as error:
        validate_value(value)
    assert error.value.field == field


def test_zero_is_a_legitimate_value_and_not_absence() -> None:
    # T-05: `0` is an observation that something amounted to nothing. It is a
    # real value with a real row, and is never interchangeable with "we have no
    # observation", which has no row at all.
    zero = FactValue(ValueType.MONEY, unit_code="UAH", value_num=Decimal("0"))
    assert validate_value(zero).value_num == Decimal("0")


def test_a_value_cannot_be_left_empty_to_signal_absence() -> None:
    # T-05: there is no way to store a Measurement whose value columns are all
    # empty, so "record that we do not know" cannot be spelled as a fact.
    with pytest.raises(InvalidValueError):
        validate_value(FactValue(ValueType.MONEY))
    with pytest.raises(InvalidValueError):
        validate_value(FactValue(ValueType.COUNT))
