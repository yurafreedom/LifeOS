from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import (
    AAIdempotencyMixin,
    AAOwnedMixin,
    AAProvenanceMixin,
    AASupersessionMixin,
    aa_integrity_constraints,
)


class AAMetricPolicyVersion(
    AAOwnedMixin, AAProvenanceMixin, AASupersessionMixin, AAIdempotencyMixin, Base
):
    __tablename__ = "aa_metric_policy_versions"
    __table_args__ = (
        *aa_integrity_constraints(__tablename__),
        Index(
            "ix_aa_metric_policy_versions_user_metric_effective",
            "user_id",
            "metric_key",
            "effective_from",
        ),
        CheckConstraint(
            "policy IS NOT NULL OR status = 'tombstoned'",
            name="ck_aa_metric_policy_versions_policy",
        ),
    )
    metric_key: Mapped[str] = mapped_column(
        Text, ForeignKey("aa_metric_definitions.metric_key"), nullable=False
    )
    policy: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
