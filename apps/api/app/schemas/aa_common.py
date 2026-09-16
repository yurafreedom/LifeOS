"""Request/response building blocks shared by every Adaptive Analytics concept.

Every model forbids extra fields. That is what makes a body-supplied ``user_id``
a 422 rather than a silently ignored field: ownership comes from the
authenticated session and from nowhere else.
"""

from datetime import date as DateValue
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.analytics.enums import SourceKind, ValueType
from app.analytics.subjects import (
    SubjectRef,
    UnknownSubjectError,
    validate_subject,
)
from app.analytics.values import FactValue, InvalidValueError, validate_value

IdempotencyKey = Annotated[str, Field(min_length=8, max_length=200)]


class SubjectIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    domain: str = Field(min_length=1, max_length=64)
    type: str = Field(min_length=1, max_length=64)
    id: str = Field(default="", max_length=200)

    def to_ref(self) -> SubjectRef:
        ref = SubjectRef(subject_domain=self.domain, subject_type=self.type, subject_id=self.id)
        try:
            return validate_subject(ref)
        except UnknownSubjectError as error:
            raise ValueError(str(error)) from error

    @model_validator(mode="after")
    def validate_registered(self) -> "SubjectIn":
        self.to_ref()
        return self


class ValueIn(BaseModel):
    """A value in the shape its ``type`` requires — and in no other shape."""

    model_config = ConfigDict(extra="forbid")

    type: ValueType
    unit_code: str | None = Field(default=None, max_length=32)
    num: Decimal | None = None
    date: DateValue | None = None
    text: str | None = Field(default=None, max_length=200)
    scale_min: Decimal | None = None
    scale_max: Decimal | None = None

    def to_fact_value(self) -> FactValue:
        return FactValue(
            value_type=self.type,
            unit_code=self.unit_code,
            value_num=self.num,
            value_date=self.date,
            value_text=self.text,
            scale_min=self.scale_min,
            scale_max=self.scale_max,
        )

    @model_validator(mode="after")
    def validate_shape(self) -> "ValueIn":
        try:
            validate_value(self.to_fact_value())
        except InvalidValueError as error:
            raise ValueError(str(error)) from error
        return self


class ValueOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: ValueType
    unit_code: str | None = None
    num: Decimal | None = None
    date: DateValue | None = None
    text: str | None = None
    scale_min: Decimal | None = None
    scale_max: Decimal | None = None

    @classmethod
    def from_row(cls, row: Any) -> "ValueOut":
        return cls(
            type=ValueType(row.value_type),
            unit_code=row.unit_code,
            num=row.value_num,
            date=row.value_date,
            text=row.value_text,
            scale_min=row.scale_min,
            scale_max=row.scale_max,
        )


class ProvenanceIn(BaseModel):
    """источник · основание · когда · как.

    ``recorded_at`` is not accepted from a caller: it means when LifeOS learned
    the fact, and only the server can know that honestly.
    """

    model_config = ConfigDict(extra="forbid")

    source_kind: SourceKind
    basis: str | None = Field(default=None, max_length=500)
    method: str | None = Field(default=None, max_length=500)
    source_ref: dict[str, Any] | None = None
    original_recorded_at_known: bool = True

    @model_validator(mode="after")
    def validate_import_honesty(self) -> "ProvenanceIn":
        if not self.original_recorded_at_known and self.source_kind is not SourceKind.IMPORTED:
            raise ValueError(
                "original_recorded_at_known may only be false for IMPORTED records"
            )
        return self


class ProvenanceOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_kind: SourceKind
    basis: str | None
    method: str | None
    recorded_at: datetime
    source_ref: dict[str, Any] | None
    original_recorded_at_known: bool

    @classmethod
    def from_row(cls, row: Any) -> "ProvenanceOut":
        return cls(
            source_kind=SourceKind(row.source_kind),
            basis=row.basis,
            method=row.method,
            recorded_at=row.recorded_at,
            source_ref=row.source_ref,
            original_recorded_at_known=row.original_recorded_at_known,
        )


def validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ValueError(f"unknown IANA timezone: {value}") from error
    return value

