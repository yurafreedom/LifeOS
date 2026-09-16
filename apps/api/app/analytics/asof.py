"""As-of reconstruction — "what did LifeOS believe on 15 August?".

Written once and reused by every bitemporal concept. A row is visible at an
instant ``T`` when LifeOS had already recorded it (``recorded_at <= T``) and it
had not yet been replaced (``superseded_at IS NULL OR superseded_at > T``).
Tombstoned rows are excluded outright.

``ORDER BY recorded_at DESC, id DESC`` makes ties deterministic, so two rows
recorded in the same instant always resolve the same way.
"""

from datetime import datetime
from typing import Any, Protocol, TypeVar

from sqlalchemy import ColumnElement, Select, or_

from app.analytics.enums import FactStatus


class BitemporalRow(Protocol):
    """The columns as-of resolution needs. Satisfied by every AA fact table."""

    id: Any
    recorded_at: Any
    superseded_at: Any
    status: Any


ModelT = TypeVar("ModelT", bound=BitemporalRow)
SelectT = TypeVar("SelectT", bound=Select[Any])


def active_predicate(model: type[ModelT]) -> ColumnElement[bool]:
    """The current-truth predicate used by every aggregate."""
    return model.status == FactStatus.ACTIVE


def known_as_of_predicate(model: type[ModelT], as_of: datetime) -> ColumnElement[bool]:
    """Rows believed at ``as_of``: already recorded, not yet superseded."""
    return (
        (model.recorded_at <= as_of)
        & or_(model.superseded_at.is_(None), model.superseded_at > as_of)
        & (model.status != FactStatus.TOMBSTONED)
    )


def apply_as_of(statement: SelectT, model: type[ModelT], as_of: datetime | None) -> SelectT:
    """Restrict a select to current truth, or to what was believed at ``as_of``."""
    if as_of is None:
        return statement.where(active_predicate(model))
    return statement.where(known_as_of_predicate(model, as_of))


def as_of_order(model: type[ModelT]) -> tuple[Any, ...]:
    return (model.recorded_at.desc(), model.id.desc())
