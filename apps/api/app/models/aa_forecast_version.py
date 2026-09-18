from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.models.aa_semantic import ValuedFactMixin, fact_constraints
from app.models.base import Base


class AAForecastVersion(ValuedFactMixin, Base):
    __tablename__ = "aa_forecast_versions"
    __table_args__ = fact_constraints(__tablename__)
    horizon_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
