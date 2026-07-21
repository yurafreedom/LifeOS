from typing import Literal

from pydantic import BaseModel, ConfigDict


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str


class RevisionConflictResponse(ErrorResponse):
    code: Literal["revision_conflict"] = "revision_conflict"
    current_revision: int
