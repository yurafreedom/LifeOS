from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator


class StateReplace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int = Field(ge=0)
    schema_version: Literal[2]
    payload: dict[str, JsonValue]

    @model_validator(mode="after")
    def validate_snapshot_contract(self) -> "StateReplace":
        payload_version = self.payload.get("version")
        if isinstance(payload_version, bool) or payload_version != self.schema_version:
            raise ValueError("payload.version must equal schema_version")
        return self


class StateEnvelope(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    schema_version: Literal[2]
    revision: int = Field(ge=1)
    payload: dict[str, JsonValue]
    created_at: datetime
    updated_at: datetime
