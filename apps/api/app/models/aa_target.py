from sqlalchemy import Boolean, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.aa_semantic import (
    ValuedFactMixin,
    WindowMixin,
    direction_constraint,
    fact_constraints,
)
from app.models.base import Base


class AATarget(ValuedFactMixin, WindowMixin, Base):
    __tablename__ = "aa_targets"
    __table_args__ = (
        *fact_constraints(__tablename__, window=True, absent=True),
        direction_constraint(__tablename__),
    )
    is_explicitly_absent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    desired_direction: Mapped[str | None] = mapped_column(Text, nullable=True)
