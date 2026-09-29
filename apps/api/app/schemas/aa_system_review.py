"""Request bodies for System Review, relations, importance and finance context.

Every model forbids extra fields, so a body-supplied ``user_id`` is a 422:
ownership comes from the session. Responses are plain JSON built by the service
(typed values carry exact decimal strings, never floats).
"""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.aa_common import IdempotencyKey

Note = str | None


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RelationCreate(_Body):
    id: UUID
    from_key: str = Field(min_length=3, max_length=600)
    to_key: str = Field(min_length=3, max_length=600)
    relation_type: str = Field(default="related", min_length=1, max_length=64)
    note: Note = Field(default=None, max_length=1000)
    period: str | None = Field(default=None, max_length=7)
    idempotency_key: IdempotencyKey


class ProposalResponse(_Body):
    period: str = Field(min_length=7, max_length=7)
    proposal_key: str = Field(pattern=r"^[0-9a-f]{64}$")
    response: Literal["approved", "rejected", "unsure"]
    note: Note = Field(default=None, max_length=1000)
    evaluated_at: datetime | None = None
    idempotency_key: IdempotencyKey


class RelationFeedback(_Body):
    response: Literal["approved", "rejected", "unsure"]
    note: Note = Field(default=None, max_length=1000)
    idempotency_key: IdempotencyKey


class RelationDelete(_Body):
    idempotency_key: IdempotencyKey


class ImportanceSet(_Body):
    target_key: str = Field(min_length=3, max_length=600)
    importance: Literal["none", "matters", "ok", "ignore"]
    idempotency_key: IdempotencyKey


class FinanceContextAppend(_Body):
    entity_id: UUID
    kind: Literal["expense_context", "obligation", "reserve", "essentials", "self_check"]
    subject_key: str = Field(default="", max_length=250)
    payload: dict[str, Any]
    idempotency_key: IdempotencyKey


class FinanceContextDelete(_Body):
    idempotency_key: IdempotencyKey


class RevisionCreate(_Body):
    base_revision: int | None = Field(default=None, ge=0)
    finalize: bool = False
    reflection: str | None = Field(default=None, max_length=4000)
    no_conclusion: bool = False
    decisions: list[str] = Field(default_factory=list, max_length=20)
    adjustments: list[str] = Field(default_factory=list, max_length=20)
    timezone: str = Field(default="Europe/Kyiv", max_length=64)
    idempotency_key: IdempotencyKey
