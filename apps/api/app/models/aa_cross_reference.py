"""Relations between two items, and every answer the user gave about them (Slice 7).

``aa_cross_references`` holds a relation's identity: two value-free ref keys, a
controlled ``relation_type``, an explicit ``epistemic_kind`` (association or
hypothesis — a relation is never a fact and never proof), who proposed it, the
exact evidence a system proposal was derived from, and the **current** status.

``aa_relation_feedback`` is the append-only log of the user's answers. Nothing in
it is updated; the relation row mirrors the latest answer so filters and ranking
read one row. A rejected or unsure answer is never erased.

Rules the schema itself enforces:

* the epistemic kind follows the type — a ``may_*`` type is always a hypothesis;
* a user link is always ``approved`` and carries no proposal metadata;
* a system proposal carries its family, model version, key, fingerprint and
  proposal instant, and is ``approved``/``rejected``/``unsure`` only with a
  response instant: the system can never approve its own proposal;
* no confidence, weight, probability or score column exists.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import (
    HYPOTHESIS_RELATION_TYPES,
    RelationEpistemicKind,
    RelationResponse,
    RelationSource,
    RelationStatus,
    RelationType,
    check_in,
)
from app.models.base import Base
from app.models.mixins import AAOwnedMixin

SHA256 = "^[0-9a-f]{64}$"
PERIOD = "^[0-9]{4}(-(0[1-9]|1[0-2]))?$"
_HYPOTHESES = ", ".join(f"'{value}'" for value in sorted(HYPOTHESIS_RELATION_TYPES))
_NOTE = "note IS NULL OR (btrim(note) <> '' AND char_length(note) <= 1000)"


class AACrossReference(AAOwnedMixin, Base):
    __tablename__ = "aa_cross_references"

    source: Mapped[str] = mapped_column(Text, nullable=False)
    proposal_family: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposal_model: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposal_model_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    proposal_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_fingerprint: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    from_key: Mapped[str] = mapped_column(Text, nullable=False)
    to_key: Mapped[str] = mapped_column(Text, nullable=False)
    from_domain: Mapped[str] = mapped_column(Text, nullable=False)
    to_domain: Mapped[str] = mapped_column(Text, nullable=False)
    relation_type: Mapped[str] = mapped_column(Text, nullable=False)
    epistemic_kind: Mapped[str] = mapped_column(Text, nullable=False)
    period_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    endpoint_redacted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint(check_in("source", RelationSource), name="ck_aa_cross_references_source"),
        CheckConstraint(
            check_in("relation_type", RelationType), name="ck_aa_cross_references_relation_type"
        ),
        CheckConstraint(
            check_in("epistemic_kind", RelationEpistemicKind),
            name="ck_aa_cross_references_epistemic_kind",
        ),
        CheckConstraint(check_in("status", RelationStatus), name="ck_aa_cross_references_status"),
        CheckConstraint(
            f"(relation_type IN ({_HYPOTHESES})) = (epistemic_kind = 'hypothesis')",
            name="ck_aa_cross_references_epistemic",
        ),
        CheckConstraint(
            f"proposal_key IS NULL OR proposal_key ~ '{SHA256}'",
            name="ck_aa_cross_references_proposal_key",
        ),
        CheckConstraint(
            f"input_fingerprint IS NULL OR input_fingerprint ~ '{SHA256}'",
            name="ck_aa_cross_references_fingerprint",
        ),
        CheckConstraint(
            "jsonb_typeof(evidence) = 'array'", name="ck_aa_cross_references_evidence"
        ),
        CheckConstraint(
            "char_length(from_key) BETWEEN 3 AND 600 AND char_length(to_key) BETWEEN 3 AND 600",
            name="ck_aa_cross_references_keys",
        ),
        CheckConstraint(
            f"period_key IS NULL OR period_key ~ '{PERIOD}'",
            name="ck_aa_cross_references_period",
        ),
        CheckConstraint(_NOTE, name="ck_aa_cross_references_note"),
        CheckConstraint(
            "source <> 'user' OR (status = 'approved' AND proposal_key IS NULL"
            " AND proposal_family IS NULL AND proposal_model IS NULL"
            " AND proposal_model_version IS NULL AND input_fingerprint IS NULL"
            " AND proposed_at IS NULL)",
            name="ck_aa_cross_references_user_source",
        ),
        CheckConstraint(
            "source = 'user' OR (proposal_key IS NOT NULL AND proposal_family IS NOT NULL"
            " AND proposal_model IS NOT NULL AND proposal_model_version IS NOT NULL"
            " AND input_fingerprint IS NOT NULL AND proposed_at IS NOT NULL)",
            name="ck_aa_cross_references_system_source",
        ),
        CheckConstraint(
            "source = 'user' OR ((status = 'proposed') = (responded_at IS NULL))",
            name="ck_aa_cross_references_no_auto_approval",
        ),
        CheckConstraint(
            "from_key <> to_key OR endpoint_redacted_at IS NOT NULL",
            name="ck_aa_cross_references_distinct_endpoints",
        ),
        UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_cross_references_idempotency_key"
        ),
        Index(
            "uq_aa_cross_references_proposal",
            "user_id",
            "proposal_key",
            unique=True,
            postgresql_where=text("proposal_key IS NOT NULL"),
        ),
        Index(
            "uq_aa_cross_references_manual",
            "user_id",
            "from_key",
            "to_key",
            "relation_type",
            unique=True,
            postgresql_where=text("source = 'user' AND endpoint_redacted_at IS NULL"),
        ),
        Index("ix_aa_cross_references_user_status", "user_id", "status", "period_key"),
        Index("ix_aa_cross_references_user_family", "user_id", "source", "proposal_family"),
    )


class AARelationFeedback(AAOwnedMixin, Base):
    __tablename__ = "aa_relation_feedback"

    relation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("aa_cross_references.id", ondelete="CASCADE"),
        nullable=False,
    )
    response: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    responded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    input_fingerprint: Mapped[str | None] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint(
            check_in("response", RelationResponse), name="ck_aa_relation_feedback_response"
        ),
        CheckConstraint(_NOTE, name="ck_aa_relation_feedback_note"),
        CheckConstraint(
            f"input_fingerprint IS NULL OR input_fingerprint ~ '{SHA256}'",
            name="ck_aa_relation_feedback_fingerprint",
        ),
        UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_relation_feedback_idempotency_key"
        ),
        Index("ix_aa_relation_feedback_relation", "relation_id", "responded_at"),
    )


__all__ = ["AACrossReference", "AARelationFeedback"]
