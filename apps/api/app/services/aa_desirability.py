"""Normative boundary: no predictive or signed-delta inputs."""

from dataclasses import dataclass
from typing import Literal

from app.analytics.values import FactValue, validate_value


@dataclass(frozen=True)
class NormativeGrounding:
    kind: Literal["target", "preference", "decision"]
    direction: Literal["higher", "lower"]
    reference: FactValue
    fact_id: str


def desirability(actual: FactValue | None, grounding: NormativeGrounding | None) -> str:
    """Preference references must be prior Actual/Baseline, never predictions.

    Future Decision can supply explicit grounding, but no Decision table or
    route exists in this slice. No grounding => neutral, independent of sign.
    """
    if grounding is None:
        return "neutral"
    if grounding.kind not in ("target", "preference", "decision"):
        raise ValueError("Unsupported normative grounding")
    if grounding.direction not in ("higher", "lower"):
        raise ValueError("Unsupported normative direction")
    if actual is None:
        return "unknown"
    validate_value(actual)
    validate_value(grounding.reference)
    reference = grounding.reference
    if (actual.value_type, actual.unit_code, actual.scale_min, actual.scale_max) != (
        reference.value_type,
        reference.unit_code,
        reference.scale_min,
        reference.scale_max,
    ):
        return "unknown"
    if actual.value_type == "categorical":
        return "unknown"
    current = actual.value_date if actual.value_type == "date" else actual.value_num
    norm = reference.value_date if reference.value_type == "date" else reference.value_num
    if current == norm:
        return "neutral"
    conforms = current > norm if grounding.direction == "higher" else current < norm
    return "favorable" if conforms else "unfavorable"
