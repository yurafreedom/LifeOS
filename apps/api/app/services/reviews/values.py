"""Value and provenance primitives shared by context derivation, persistence
and the read model. Imports nothing else from this package.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from app.analytics.enums import (
    SourceKind,
    ValueType,
)
from app.analytics.values import FactValue

VALUE_COLUMNS = ("unit_code", "value_num", "value_date", "value_text", "scale_min", "scale_max")


STORAGE_QUANTUM = Decimal("0.000001")  # numeric(20,6), the storage precision


def _q(value: Decimal | None) -> Decimal | None:
    """Render at storage precision so a context and its saved copy are identical."""
    return None if value is None else Decimal(value).quantize(STORAGE_QUANTUM)


def _utc(value: datetime | None) -> datetime | None:
    return None if value is None else value.astimezone(UTC)


def _plain(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(_q(value))
    if isinstance(value, datetime):
        return _utc(value).isoformat()
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _fact_value(row: Any) -> FactValue | None:
    if row is None or getattr(row, "value_type", None) is None:
        return None
    if getattr(row, "is_explicitly_absent", False):
        return None
    if getattr(row, "value_availability", None) == "explicitly_unknown":
        return None
    return FactValue(
        value_type=ValueType(row.value_type),
        **{column: getattr(row, column) for column in VALUE_COLUMNS},
    )


def _value_out_to_fact(value: Any) -> FactValue | None:
    if value is None:
        return None
    return FactValue(
        value_type=ValueType(value.type),
        unit_code=value.unit_code,
        value_num=value.num,
        value_date=value.date,
        value_text=value.text,
        scale_min=value.scale_min,
        scale_max=value.scale_max,
    )


def _provenance(row: Any) -> dict[str, Any]:
    return {
        "source_kind": row.source_kind,
        "basis": row.basis,
        "method": row.method,
        "provenance_recorded_at": row.recorded_at,
        "original_recorded_at_known": row.original_recorded_at_known,
    }


def _semantic_provenance(out: Any) -> dict[str, Any]:
    provenance = out.provenance
    return {
        "source_kind": str(provenance.source_kind),
        "basis": provenance.basis,
        "method": provenance.method,
        "provenance_recorded_at": provenance.recorded_at,
        "original_recorded_at_known": provenance.original_recorded_at_known,
    }


def _derived_provenance(as_of: datetime, basis: str | None, method: str) -> dict[str, Any]:
    return {
        "source_kind": str(SourceKind.DERIVED),
        "basis": basis,
        "method": method,
        "provenance_recorded_at": as_of,
        "original_recorded_at_known": True,
    }
