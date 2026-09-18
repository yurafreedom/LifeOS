from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.models.aa_semantic import ValuedFactMixin, WindowMixin, fact_constraints
from app.models.base import Base


class AAExpectationVersion(ValuedFactMixin, WindowMixin, Base):
    __tablename__ = "aa_expectation_versions"
    __table_args__ = fact_constraints(__tablename__, window=True)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
