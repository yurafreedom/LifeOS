"""Delta legality — no cross-unit arithmetic, and no fabricated operands."""

from datetime import date
from decimal import Decimal

import pytest

from app.analytics.delta import (
    CategoricalComparisonError,
    Delta,
    DeltaUnknown,
    IncompatibleUnitsError,
    compute_delta,
)
from app.analytics.enums import ValueType
from app.analytics.values import FactValue


def uah(amount: str) -> FactValue:
    return FactValue(ValueType.MONEY, unit_code="UAH", value_num=Decimal(amount))


def test_same_currency_subtracts() -> None:
    result = compute_delta(uah("57000"), uah("50000"))
    assert isinstance(result, Delta)
    assert result.value_num == Decimal("7000")
    assert result.unit_code == "UAH"


def test_currencies_do_not_convert_implicitly() -> None:
    other = FactValue(ValueType.MONEY, unit_code="USD", value_num=Decimal("100"))
    with pytest.raises(IncompatibleUnitsError):
        compute_delta(uah("100"), other)


def test_date_difference_is_a_duration_in_canonical_minutes() -> None:
    result = compute_delta(
        FactValue(ValueType.DATE, value_date=date(2026, 8, 25)),
        FactValue(ValueType.DATE, value_date=date(2026, 8, 20)),
    )
    assert isinstance(result, Delta)
    assert result.value_type is ValueType.DURATION
    assert result.value_num == Decimal(5 * 24 * 60)


def test_scale_bounds_must_match() -> None:
    seven_of_ten = FactValue(
        ValueType.SCALE, value_num=Decimal("7"), scale_min=Decimal("1"), scale_max=Decimal("10")
    )
    four_of_five = FactValue(
        ValueType.SCALE, value_num=Decimal("4"), scale_min=Decimal("1"), scale_max=Decimal("5")
    )
    assert isinstance(compute_delta(seven_of_ten, seven_of_ten), Delta)
    with pytest.raises(IncompatibleUnitsError):
        compute_delta(seven_of_ten, four_of_five)


def test_categorical_values_are_juxtaposed_not_subtracted() -> None:
    low = FactValue(ValueType.CATEGORICAL, value_text="низкая")
    high = FactValue(ValueType.CATEGORICAL, value_text="высокая")
    with pytest.raises(CategoricalComparisonError):
        compute_delta(high, low)


def test_cross_type_pairs_are_rejected() -> None:
    with pytest.raises(IncompatibleUnitsError):
        compute_delta(uah("10"), FactValue(ValueType.COUNT, value_num=Decimal("10")))


def test_absent_operand_yields_a_derived_unknown_and_never_a_zero() -> None:
    # An absent operand must not be replaced by zero to make the subtraction
    # succeed: «нет данных» is an answer, not a value.
    assert compute_delta(uah("100"), None) == DeltaUnknown(reason="operand_absent")
    assert compute_delta(None, uah("100")) == DeltaUnknown(reason="operand_absent")
    assert compute_delta(None, None) == DeltaUnknown(reason="operand_absent")
