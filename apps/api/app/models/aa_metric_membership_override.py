from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import (
    AAIdempotencyMixin,
    AAOwnedMixin,
    AAProvenanceMixin,
    AASupersessionMixin,
    aa_integrity_constraints,
)


class AAMetricMembershipOverride(
    AAOwnedMixin, AAProvenanceMixin, AASupersessionMixin, AAIdempotencyMixin, Base
):
    __tablename__ = "aa_metric_membership_overrides"
    __table_args__ = (
        *aa_integrity_constraints(__tablename__),
        CheckConstraint(
            "source_table = 'aa_measurements'",
            name="ck_aa_metric_membership_overrides_source_table",
        ),
        CheckConstraint(
            "included IS NOT NULL OR status = 'tombstoned'",
            name="ck_aa_metric_membership_overrides_included",
        ),
        Index(
            "ix_aa_metric_membership_overrides_user_metric_fact",
            "user_id",
            "metric_key",
            "source_fact_id",
        ),
        Index(
            "ix_aa_metric_membership_overrides_active_user_metric_fact",
            "user_id",
            "metric_key",
            "source_fact_id",
            postgresql_where=text("status = 'active'"),
        ),
    )
    metric_key: Mapped[str] = mapped_column(
        Text, ForeignKey("aa_metric_definitions.metric_key"), nullable=False
    )
    source_table: Mapped[str] = mapped_column(Text, nullable=False)
    source_fact_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("aa_measurements.id", ondelete="CASCADE"), nullable=False
    )
    included: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
