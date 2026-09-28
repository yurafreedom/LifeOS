"""The user's decision — nullable by design (plan §3: NO_DECISION ≠ INCONCLUSIVE).

Three states are distinct and all representable:

* no row at all — the step was skipped;
* a row with ``choice IS NULL`` — «Пока без решения»;
* a row with ``choice = 'inconclusive'`` — «Непонятно — данных недостаточно».

Review scope only for now. Slice 6 (M6) widens ``scope`` and ``choice`` for
experiments; the CHECKs are written so that widening is a constraint swap.
"""

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import DecisionScope, ReviewDecisionChoice, check_in
from app.models.base import Base
from app.models.mixins import AAOwnedMixin


class AADecision(AAOwnedMixin, Base):
    __tablename__ = "aa_decisions"

    scope: Mapped[str] = mapped_column(Text, nullable=False)
    review_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_reviews.id", ondelete="CASCADE"), nullable=True
    )
    choice: Mapped[str | None] = mapped_column(Text, nullable=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    superseded_in_revision: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        CheckConstraint(check_in("scope", DecisionScope), name="ck_aa_decisions_scope"),
        CheckConstraint(
            "scope <> 'review' OR review_id IS NOT NULL", name="ck_aa_decisions_review_scope"
        ),
        CheckConstraint(
            f"choice IS NULL OR {check_in('choice', ReviewDecisionChoice)}",
            name="ck_aa_decisions_choice",
        ),
        CheckConstraint("revision >= 1", name="ck_aa_decisions_revision"),
        CheckConstraint(
            "superseded_in_revision IS NULL OR superseded_in_revision > revision",
            name="ck_aa_decisions_superseded_order",
        ),
        # One current decision per review; history is kept, never overwritten.
        Index(
            "uq_aa_decisions_current_review",
            "review_id",
            unique=True,
            postgresql_where=text("superseded_in_revision IS NULL AND review_id IS NOT NULL"),
        ),
    )


__all__ = ["AADecision"]
