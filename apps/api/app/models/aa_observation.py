from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import EpistemicKind, ObservationAvailability, check_in
from app.models.aa_semantic import ValuedFactMixin, fact_constraints
from app.models.base import Base


class AAObservation(ValuedFactMixin, Base):
    __tablename__ = "aa_observations"
    __table_args__ = (
        *fact_constraints(__tablename__, observation=True),
        CheckConstraint(
            check_in("epistemic_kind", EpistemicKind),
            name="ck_aa_observations_epistemic_kind",
        ),
        CheckConstraint(
            check_in("value_availability", ObservationAvailability),
            name="ck_aa_observations_value_availability",
        ),
        CheckConstraint("occurred_tz <> ''", name="ck_aa_observations_occurred_tz"),
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    occurred_tz: Mapped[str] = mapped_column(Text, nullable=False)
    epistemic_kind: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'unknown'")
    )
    value_availability: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'present'")
    )
