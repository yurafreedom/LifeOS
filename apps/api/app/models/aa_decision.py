"""The user's decision — nullable by design (plan §3: NO_DECISION ≠ INCONCLUSIVE).

Three states are distinct and all representable:

* no row at all — the step was skipped;
* a row with ``choice IS NULL`` — «Пока без решения»;
* a row with ``choice = 'inconclusive'`` — «Непонятно — данных недостаточно».

Two scopes, each with its own vocabulary, pinned by scope-dependent CHECKs so a
choice can never leak across:

* ``review`` — ``keep | adjust | later | inconclusive``; parent ``review_id``;
  ``revision`` counts ``aa_review_revisions``; replay is anchored on the Review
  revision's idempotency key, so ``idempotency_key`` stays NULL.
* ``experiment`` (M6) — ``keep | modify | longer | reject | inconclusive``;
  parent ``experiment_id``; every save appends one row, which is the
  experiment's own revision ledger (its factors count against it) and carries
  its own required ``idempotency_key``.

A decision never changes an experiment's lifecycle.
"""

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import (
    DecisionScope,
    ExperimentDecisionChoice,
    ReviewDecisionChoice,
    check_in,
)
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
    experiment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_experiments.id", ondelete="CASCADE"), nullable=True
    )
    idempotency_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(check_in("scope", DecisionScope), name="ck_aa_decisions_scope"),
        CheckConstraint(
            "(scope = 'review' AND review_id IS NOT NULL AND experiment_id IS NULL)"
            " OR (scope = 'experiment' AND experiment_id IS NOT NULL AND review_id IS NULL)",
            name="ck_aa_decisions_parent",
        ),
        CheckConstraint(
            f"scope <> 'review' OR choice IS NULL OR {check_in('choice', ReviewDecisionChoice)}",
            name="ck_aa_decisions_review_choice",
        ),
        CheckConstraint(
            "scope <> 'experiment' OR choice IS NULL"
            f" OR {check_in('choice', ExperimentDecisionChoice)}",
            name="ck_aa_decisions_experiment_choice",
        ),
        CheckConstraint(
            "(scope = 'experiment') = (idempotency_key IS NOT NULL)",
            name="ck_aa_decisions_idempotency",
        ),
        CheckConstraint("revision >= 1", name="ck_aa_decisions_revision"),
        CheckConstraint(
            "superseded_in_revision IS NULL OR superseded_in_revision > revision",
            name="ck_aa_decisions_superseded_order",
        ),
        UniqueConstraint("user_id", "idempotency_key", name="uq_aa_decisions_idempotency_key"),
        # One current decision per parent; history is kept, never overwritten.
        Index(
            "uq_aa_decisions_current_review",
            "review_id",
            unique=True,
            postgresql_where=text("superseded_in_revision IS NULL AND review_id IS NOT NULL"),
        ),
        Index(
            "uq_aa_decisions_current_experiment",
            "experiment_id",
            unique=True,
            postgresql_where=text(
                "superseded_in_revision IS NULL AND experiment_id IS NOT NULL"
            ),
        ),
        Index(
            "uq_aa_decisions_experiment_revision",
            "experiment_id",
            "revision",
            unique=True,
            postgresql_where=text("experiment_id IS NOT NULL"),
        ),
    )


__all__ = ["AADecision"]
