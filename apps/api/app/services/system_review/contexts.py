"""Explicit finance context the user chooses to enter (plan §4.4, §12).

Nothing here is inferred. Every field is optional unless a calculation cannot be
stated without it, and "unknown" is a real answer. The free-text fields (purpose,
motive, emotional context) are the user's own words: they are stored because
the user typed them, returned only to that user, and never copied into
relations, proposals, evidence or logs.
"""

import re
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.enums import FinanceContextKind
from app.models import AAFinanceContext
from app.services.system_review.contracts import advisory_lock, plain
from app.services.system_review.errors import (
    FinanceContextConflictError,
    IdempotencyKeyReusedError,
    InvalidFinanceContextError,
)
from app.services.system_review.redaction import SLICE_7_REDACTORS

Currency = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
Amount = Annotated[Decimal, Field(ge=0, le=Decimal("100000000000000"), decimal_places=2)]
Positive = Annotated[Decimal, Field(gt=0, le=Decimal("100000000000000"), decimal_places=2)]
Text300 = Annotated[str, Field(min_length=1, max_length=300)]
Text1000 = Annotated[str, Field(min_length=1, max_length=1000)]
Label = Annotated[str, Field(min_length=1, max_length=120)]
SELF_CHECK_QUESTIONNAIRE = "lifeos_debt_selfcheck_v1"
SELF_CHECK_QUESTIONS = (
    "q_know_total",
    "q_repayment_plan",
    "q_payments_delayed",
    "q_new_spend_on_credit",
    "q_avoid_checking",
    "q_income_sufficient",
    "q_pattern_repeat",
)


class _Payload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="before")
    @classmethod
    def strip_text(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return {
                key: (value.strip() or None) if isinstance(value, str) and key in cls._free_text()
                else value
                for key, value in data.items()
            }
        return data

    @classmethod
    def _free_text(cls) -> set[str]:
        return {"purpose", "motive", "emotional_context", "label"}


class ExpenseContext(_Payload):
    plannedness: Literal["planned", "unplanned", "unknown"] = "unknown"
    funding_source: Literal[
        "income", "cash_balance", "debit_balance", "credit", "borrowed", "mixed", "unknown"
    ] = "unknown"
    obligation_entity_id: UUID | None = None
    purpose: Text300 | None = None
    motive: Text1000 | None = None
    emotional_context: Text1000 | None = None
    worth_it: Literal["yes", "no", "unsure"] | None = None
    expected_recurrence: Literal["one_off", "occasional", "recurring", "unknown"] = "unknown"
    recurrence_per_month: Annotated[Decimal, Field(gt=0, le=31, decimal_places=2)] | None = None

    @model_validator(mode="after")
    def consistent(self) -> "ExpenseContext":
        if self.obligation_entity_id is not None and self.funding_source not in (
            "credit", "borrowed", "mixed"
        ):
            raise ValueError("an obligation can be named only for credit/borrowed funding")
        if self.recurrence_per_month is not None and self.expected_recurrence not in (
            "occasional", "recurring"
        ):
            raise ValueError("a frequency needs an occasional or recurring expense")
        return self


class Obligation(_Payload):
    label: Label
    obligation_kind: Literal["credit_card", "loan", "personal_debt", "other"] = "other"
    currency: Currency
    outstanding: Amount
    monthly_payment: Positive | None = None
    annual_rate_percent: Annotated[Decimal, Field(ge=0, le=200, decimal_places=3)] | None = None
    as_of: date
    planned_payoff_date: date | None = None


class Reserve(_Payload):
    label: Label | None = None
    currency: Currency
    amount: Amount
    threshold: Amount | None = None
    as_of: date


class Essentials(_Payload):
    currency: Currency
    monthly_amount: Positive
    as_of: date


class SelfCheck(_Payload):
    questionnaire: Literal["lifeos_debt_selfcheck_v1"] = SELF_CHECK_QUESTIONNAIRE
    answers: dict[str, Literal["yes", "no", "unknown", "prefer_not"]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def known_questions(self) -> "SelfCheck":
        if set(self.answers) - set(SELF_CHECK_QUESTIONS):
            raise ValueError("unknown self-check question")
        return self


PAYLOADS: dict[str, type[_Payload]] = {
    FinanceContextKind.EXPENSE_CONTEXT: ExpenseContext,
    FinanceContextKind.OBLIGATION: Obligation,
    FinanceContextKind.RESERVE: Reserve,
    FinanceContextKind.ESSENTIALS: Essentials,
    FinanceContextKind.SELF_CHECK: SelfCheck,
}
SUBJECT_PATTERNS = {
    FinanceContextKind.EXPENSE_CONTEXT: re.compile(r"^finance:transaction:[^:|]{1,200}$"),
    FinanceContextKind.SELF_CHECK: re.compile(r"^finance:period:\d{4}-(0[1-9]|1[0-2])$"),
}


def validate_payload(kind: str, subject_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    model = PAYLOADS.get(kind)
    if model is None:
        raise InvalidFinanceContextError
    pattern = SUBJECT_PATTERNS.get(kind)
    if (pattern is None) != (subject_key == "") or (pattern and not pattern.match(subject_key)):
        raise InvalidFinanceContextError
    try:
        parsed = model.model_validate(payload)
    except ValidationError:
        raise InvalidFinanceContextError from None
    return {key: plain(value) for key, value in parsed.model_dump(exclude_none=True).items()}


def _by_key(db: Session, *, user_id: UUID, key: str) -> AAFinanceContext | None:
    return db.scalar(
        select(AAFinanceContext).where(
            AAFinanceContext.user_id == user_id, AAFinanceContext.idempotency_key == key
        )
    )


def _replay(row: AAFinanceContext, entity_id: UUID, kind: str, payload: dict) -> AAFinanceContext:
    if (row.entity_id, row.kind, row.payload) != (entity_id, kind, payload):
        raise IdempotencyKeyReusedError
    return row


def append_context(
    db: Session,
    *,
    user_id: UUID,
    entity_id: UUID,
    kind: str,
    subject_key: str,
    payload: dict[str, Any],
    key: str,
) -> tuple[AAFinanceContext, bool]:
    """Append the next version of one entity. Returns ``(row, replayed)``."""
    clean = validate_payload(kind, subject_key, payload)
    existing = _by_key(db, user_id=user_id, key=key)
    if existing is not None:
        return _replay(existing, entity_id, kind, clean), True
    now = datetime.now(UTC)
    try:
        advisory_lock(db, "aa_finance_contexts", user_id, entity_id)
        if subject_key:
            advisory_lock(db, "aa_finance_contexts", user_id, kind, subject_key)
        existing = _by_key(db, user_id=user_id, key=key)
        if existing is not None:
            db.rollback()
            return _replay(existing, entity_id, kind, clean), True
        if clean.get("obligation_entity_id"):
            named = db.scalar(
                select(AAFinanceContext.id).where(
                    AAFinanceContext.user_id == user_id,
                    AAFinanceContext.entity_id == UUID(clean["obligation_entity_id"]),
                    AAFinanceContext.kind == FinanceContextKind.OBLIGATION,
                    AAFinanceContext.status == "active",
                )
            )
            if named is None:
                raise InvalidFinanceContextError
        current = db.scalar(
            select(AAFinanceContext)
            .where(
                AAFinanceContext.user_id == user_id,
                AAFinanceContext.entity_id == entity_id,
                AAFinanceContext.status == "active",
            )
            .with_for_update()
        )
        if current is not None and (current.kind, current.subject_key) != (kind, subject_key):
            raise FinanceContextConflictError
        if current is None and subject_key:
            other = db.scalar(
                select(AAFinanceContext.id).where(
                    AAFinanceContext.user_id == user_id,
                    AAFinanceContext.kind == kind,
                    AAFinanceContext.subject_key == subject_key,
                    AAFinanceContext.status == "active",
                )
            )
            if other is not None:
                raise FinanceContextConflictError
        version = (
            db.scalar(
                select(func.max(AAFinanceContext.version)).where(
                    AAFinanceContext.user_id == user_id, AAFinanceContext.entity_id == entity_id
                )
            )
            or 0
        ) + 1
        if current is not None:
            current.status = "superseded"
            current.superseded_at = now
            db.flush()
        row = AAFinanceContext(
            id=uuid4(),
            user_id=user_id,
            entity_id=entity_id,
            kind=kind,
            subject_key=subject_key,
            payload=clean,
            version=version,
            status="active",
            supersedes_id=current.id if current is not None else None,
            recorded_at=now,
            idempotency_key=key,
        )
        db.add(row)
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = _by_key(db, user_id=user_id, key=key)
        if existing is not None:
            return _replay(existing, entity_id, kind, clean), True
        raise FinanceContextConflictError from None
    except BaseException:
        db.rollback()
        raise
    return row, False


def delete_context(db: Session, *, user_id: UUID, entity_id: UUID) -> bool:
    """Hard-delete every version of an entity and erase what was derived from it.

    The user's explicit deletion of their own (possibly sensitive) words. Runs the
    Slice 7 redactors in the same transaction, so no saved review, relation or
    importance rating keeps a link to it. Idempotent: an absent entity is done.
    """
    rows = db.scalars(
        select(AAFinanceContext)
        .where(AAFinanceContext.user_id == user_id, AAFinanceContext.entity_id == entity_id)
        .with_for_update()
    ).all()
    if not rows:
        db.rollback()
        return True
    try:
        for adapter in SLICE_7_REDACTORS:
            adapter(db, user_id, AAFinanceContext.__tablename__, entity_id)
        # Clear the self-links first so the whole chain can go in one statement.
        for row in rows:
            row.supersedes_id = None
        db.flush()
        db.execute(
            delete(AAFinanceContext).where(
                AAFinanceContext.user_id == user_id, AAFinanceContext.entity_id == entity_id
            )
        )
        db.commit()
    except BaseException:
        db.rollback()
        raise
    return False


def context_payload(row: AAFinanceContext) -> dict[str, Any]:
    return {
        "entity_id": str(row.entity_id),
        "kind": row.kind,
        "subject_key": row.subject_key or None,
        "version": row.version,
        "status": row.status,
        "recorded_at": row.recorded_at.isoformat(),
        "payload": dict(row.payload),
    }


def active_contexts(
    db: Session, *, user_id: UUID, kinds: tuple[str, ...] = (), limit: int = 500
) -> list[AAFinanceContext]:
    query = select(AAFinanceContext).where(
        AAFinanceContext.user_id == user_id, AAFinanceContext.status == "active"
    )
    if kinds:
        query = query.where(AAFinanceContext.kind.in_(kinds))
    return list(
        db.scalars(
            query.order_by(AAFinanceContext.kind, AAFinanceContext.recorded_at, AAFinanceContext.id)
            .limit(limit)
        )
    )
