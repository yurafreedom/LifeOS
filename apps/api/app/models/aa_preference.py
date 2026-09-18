from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.aa_semantic import SemanticFactMixin, direction_constraint, fact_constraints
from app.models.base import Base


class AAPreference(SemanticFactMixin, Base):
    __tablename__ = "aa_preferences"
    __table_args__ = (
        *fact_constraints(__tablename__, value=False),
        direction_constraint(__tablename__),
        CheckConstraint(
            "statement IS NOT NULL OR status = 'tombstoned'", name="ck_aa_preferences_statement"
        ),
    )
    statement: Mapped[str | None] = mapped_column(Text, nullable=True)
    desired_direction: Mapped[str | None] = mapped_column(Text, nullable=True)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
