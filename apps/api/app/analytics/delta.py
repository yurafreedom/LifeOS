"""Delta legality and computation.

A delta is computable only between operands of the same ``value_type`` whose
units are already compatible. There is no implicit conversion, no cross-unit
arithmetic, and therefore no place for a global score.

When an operand is absent the answer is a *derived* :class:`DeltaUnknown` — the
read-time «рано судить» / «нет данных» state. Nothing is written, and no operand
is ever fabricated to make the subtraction succeed.
"""

from dataclasses import dataclass
from decimal import Decimal

from app.analytics.enums import ValueType
from app.analytics.values import CANONICAL_DURATION_UNIT, FactValue

MINUTES_PER_DAY = Decimal(24 * 60)


class IncompatibleUnitsError(ValueError):
    """The two operands cannot legally be subtracted."""

    code = "incompatible_units"


class CategoricalComparisonError(IncompatibleUnitsError):
    """Categorical values are juxtaposed, never subtracted."""

    code = "categorical_delta_undefined"


@dataclass(frozen=True, slots=True)
class Delta:
    value_type: ValueType
    value_num: Decimal
    unit_code: str | None = None
    scale_min: Decimal | None = None
    scale_max: Decimal | None = None


@dataclass(frozen=True, slots=True)
class DeltaUnknown:
    """A derived, unwritten no-answer. Rendered, never persisted."""

    reason: str


def compute_delta(current: FactValue | None, reference: FactValue | None) -> Delta | DeltaUnknown:
    """Subtract ``reference`` from ``current`` when the pair is legal."""
    if current is None or reference is None:
        return DeltaUnknown(reason="operand_absent")

    current_type = ValueType(current.value_type)
    reference_type = ValueType(reference.value_type)
    if current_type is not reference_type:
        raise IncompatibleUnitsError(
            f"cannot compare {current_type} with {reference_type}"
        )

    if current_type is ValueType.CATEGORICAL:
        raise CategoricalComparisonError("categorical values have no delta")

    if current_type is ValueType.DATE:
        assert current.value_date is not None and reference.value_date is not None
        days = Decimal((current.value_date - reference.value_date).days)
        return Delta(
            value_type=ValueType.DURATION,
            value_num=days * MINUTES_PER_DAY,
            unit_code=CANONICAL_DURATION_UNIT,
        )

    if current_type in (ValueType.MONEY, ValueType.DURATION):
        if current.unit_code != reference.unit_code:
            raise IncompatibleUnitsError(
                f"cannot compare {current.unit_code} with {reference.unit_code}"
            )

    if current_type is ValueType.SCALE:
        if (current.scale_min, current.scale_max) != (reference.scale_min, reference.scale_max):
            raise IncompatibleUnitsError("scale bounds differ")

    assert current.value_num is not None and reference.value_num is not None
    return Delta(
        value_type=current_type,
        value_num=current.value_num - reference.value_num,
        unit_code=current.unit_code,
        scale_min=current.scale_min,
        scale_max=current.scale_max,
    )
