"""Retention request contracts (Slice 8). Unknown fields — including ``user_id`` —
are rejected: ownership always comes from the session."""

from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    field_validator,
    model_validator,
)

from app.schemas.aa_common import IdempotencyKey, validate_timezone

Months = Literal[24, 36, 60]


class _Zoned(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timezone: str = "Europe/Kyiv"

    @field_validator("timezone")
    @classmethod
    def timezone_is_iana(cls, value: str) -> str:
        return validate_timezone(value)


class RetentionPolicyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["unlimited", "finite"]
    retain_months: Months | None = None
    consequences_version: str | None = Field(default=None, max_length=100)
    confirm_consequences: bool = False
    idempotency_key: IdempotencyKey

    @model_validator(mode="after")
    def months_match_mode(self):
        if (self.mode == "finite") != (self.retain_months is not None):
            raise ValueError("retain_months is required for finite and forbidden for unlimited")
        return self


class RetentionPreviewIn(_Zoned):
    pass


class RetentionApplyIn(_Zoned):
    preview_token: str = Field(pattern=r"^[0-9a-f]{64}$")
    # The destructive confirmation must be the JSON literal ``true``; ``1``, ``"yes"``
    # or an omitted field are all a 422.
    confirm: StrictBool
    idempotency_key: IdempotencyKey

    @field_validator("confirm")
    @classmethod
    def confirmed(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Apply requires confirm: true")
        return value
