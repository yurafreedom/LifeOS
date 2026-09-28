"""Review / Debrief persistence (plan §12, correction C4, owner decision D1).

A Review freezes what the user saw and records what the user wrote. The two are
stored apart on purpose:

``aa_review_context_items``
    One row per rendered evidence item — the frozen value, exactly as displayed,
    with its frozen provenance. Source-derived, so individually redactable.
``aa_review_context_sources``
    Normalized links from an item to every fact it was derived from. A derived
    item (a monthly total, a delta) has many sources; erasing **any** of them
    must erase the item, which one ``source_fact_id`` column could not express.
``aa_review_revisions`` / ``aa_review_factors`` / ``aa_decisions``
    User-authored. No source link, so hard deletion of a fact never reaches them.
    Nothing here is overwritten in place: a revision appends a row, a factor is
    retracted by marking the revision that retracted it, and a decision is
    superseded by the revision that replaced it.

``aa_reviews.render_manifest`` holds layout only — section order and ordinals —
so it never contains a value that would need redacting.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy import text as sql_text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import (
    Desire,
    EpistemicKind,
    RedactionReason,
    ReviewAvailability,
    ReviewRole,
    ReviewSection,
    SourceKind,
    ValueType,
    check_in,
)
from app.analytics.values import value_check_sql
from app.models.base import Base
from app.models.mixins import VALUE_NUMERIC, AAOwnedMixin, AASubjectMixin

# The fact tables a frozen item may be derived from — the same set hard
# deletion can reach (``app.services.aa_deletion.FACT_TABLES``).
REVIEW_SOURCE_TABLES: tuple[str, ...] = (
    "aa_measurements",
    "aa_source_coverage",
    "aa_expectation_versions",
    "aa_forecast_versions",
    "aa_baselines",
    "aa_targets",
    "aa_preferences",
    "aa_observations",
    "aa_metric_policy_versions",
    "aa_metric_membership_overrides",
)

EMPTY_VALUE = (
    "unit_code IS NULL AND value_num IS NULL AND value_date IS NULL"
    " AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL"
)
# Everything on an item that came from a source fact. A redacted item keeps its
# position and role (so the Review still reads «источник удалён» in place) and
# nothing else.
ERASED = (
    f"availability IS NULL AND value_type IS NULL AND {EMPTY_VALUE}"
    " AND desire IS NULL AND epistemic_kind IS NULL AND estimate = false"
    " AND source_kind IS NULL AND basis IS NULL AND method IS NULL"
    " AND provenance_recorded_at IS NULL AND original_recorded_at_known IS NULL"
)


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def _review_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_reviews.id", ondelete="CASCADE"), nullable=False
    )


class AAReview(AAOwnedMixin, AASubjectMixin, Base):
    __tablename__ = "aa_reviews"

    window_start: Mapped[date] = mapped_column(Date, nullable=False)
    window_end: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(Text, nullable=False)
    context_as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    render_manifest: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    current_revision: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=sql_text("1")
    )
    revised_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("window_end >= window_start", name="ck_aa_reviews_window_order"),
        CheckConstraint("timezone <> ''", name="ck_aa_reviews_timezone"),
        CheckConstraint("current_revision >= 1", name="ck_aa_reviews_current_revision"),
        CheckConstraint(
            "(revised_at IS NULL) = (current_revision = 1)", name="ck_aa_reviews_revised_pair"
        ),
        Index("ix_aa_reviews_user_subject_created", "user_id", "subject_key", "created_at"),
    )


class AAReviewRevision(AAOwnedMixin, Base):
    """One authoring act. Revision 1 is the save; each revise appends the next."""

    __tablename__ = "aa_review_revisions"

    review_id: Mapped[uuid.UUID] = _review_fk()
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    note_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint("revision >= 1", name="ck_aa_review_revisions_revision"),
        CheckConstraint(
            "note_text IS NULL OR (btrim(note_text) <> '' AND char_length(note_text) <= 4000)",
            name="ck_aa_review_revisions_note_text",
        ),
        UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_review_revisions_idempotency_key"
        ),
        UniqueConstraint("review_id", "revision", name="uq_aa_review_revisions_revision"),
    )


class AAReviewContextItem(AAOwnedMixin, Base):
    __tablename__ = "aa_review_context_items"

    review_id: Mapped[uuid.UUID] = _review_fk()
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    section: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    label_key: Mapped[str] = mapped_column(Text, nullable=False)
    metric_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    availability: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_num: Mapped[Decimal | None] = mapped_column(VALUE_NUMERIC, nullable=True)
    value_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    scale_min: Mapped[Decimal | None] = mapped_column(VALUE_NUMERIC, nullable=True)
    scale_max: Mapped[Decimal | None] = mapped_column(VALUE_NUMERIC, nullable=True)
    desire: Mapped[str | None] = mapped_column(Text, nullable=True)
    epistemic_kind: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimate: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sql_text("false"))
    source_kind: Mapped[str | None] = mapped_column(Text, nullable=True)
    basis: Mapped[str | None] = mapped_column(Text, nullable=True)
    method: Mapped[str | None] = mapped_column(Text, nullable=True)
    provenance_recorded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    original_recorded_at_known: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    redacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    redaction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("review_id", "ordinal", name="uq_aa_review_context_items_ordinal"),
        CheckConstraint("ordinal >= 1", name="ck_aa_review_context_items_ordinal"),
        CheckConstraint("label_key <> ''", name="ck_aa_review_context_items_label_key"),
        CheckConstraint(check_in("section", ReviewSection), name="ck_aa_review_context_items_section"),
        CheckConstraint(check_in("role", ReviewRole), name="ck_aa_review_context_items_role"),
        CheckConstraint(
            f"availability IS NULL OR {check_in('availability', ReviewAvailability)}",
            name="ck_aa_review_context_items_availability",
        ),
        CheckConstraint(
            f"value_type IS NULL OR {check_in('value_type', ValueType)}",
            name="ck_aa_review_context_items_value_type",
        ),
        CheckConstraint(
            f"desire IS NULL OR (role = 'delta' AND {check_in('desire', Desire)})",
            name="ck_aa_review_context_items_desire",
        ),
        CheckConstraint(
            f"epistemic_kind IS NULL OR (role = 'observation'"
            f" AND {check_in('epistemic_kind', EpistemicKind)})",
            name="ck_aa_review_context_items_epistemic_kind",
        ),
        CheckConstraint(
            f"source_kind IS NULL OR {check_in('source_kind', SourceKind)}",
            name="ck_aa_review_context_items_source_kind",
        ),
        CheckConstraint(
            "(availability = 'present' AND value_type IS NOT NULL"
            f" AND ({value_check_sql()}))"
            f" OR (availability IS DISTINCT FROM 'present' AND {EMPTY_VALUE})",
            name="ck_aa_review_context_items_value_shape",
        ),
        CheckConstraint(
            "(redacted_at IS NULL) = (redaction_reason IS NULL)",
            name="ck_aa_review_context_items_redaction_pair",
        ),
        CheckConstraint(
            f"redaction_reason IS NULL OR {check_in('redaction_reason', RedactionReason)}",
            name="ck_aa_review_context_items_redaction_reason",
        ),
        # D1 made structural: "redacted but a value is still present" cannot be
        # stored, and an unredacted item always says what the user saw.
        CheckConstraint(
            f"redacted_at IS NULL OR ({ERASED})",
            name="ck_aa_review_context_items_redacted_erased",
        ),
        CheckConstraint(
            "redacted_at IS NOT NULL OR availability IS NOT NULL",
            name="ck_aa_review_context_items_availability_present",
        ),
        Index("ix_aa_review_context_items_review", "review_id", "ordinal"),
    )


class AAReviewContextSource(AAOwnedMixin, Base):
    """One item → fact link. The redaction lookup runs on ``(user_id, source_fact_id)``."""

    __tablename__ = "aa_review_context_sources"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("aa_review_context_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_table: Mapped[str] = mapped_column(Text, nullable=False)
    source_fact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "item_id", "source_table", "source_fact_id", name="uq_aa_review_context_sources_link"
        ),
        CheckConstraint(
            _in("source_table", REVIEW_SOURCE_TABLES),
            name="ck_aa_review_context_sources_source_table",
        ),
        Index("ix_aa_review_context_sources_user_fact", "user_id", "source_fact_id"),
        Index("ix_aa_review_context_sources_item", "item_id"),
    )


class AAReviewFactor(AAOwnedMixin, Base):
    """A user-named contributing factor with its epistemic kind. Never causal."""

    __tablename__ = "aa_review_factors"

    review_id: Mapped[uuid.UUID] = _review_fk()
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    epistemic_kind: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=sql_text("'unknown'")
    )
    added_in_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    retracted_in_revision: Mapped[int | None] = mapped_column(Integer, nullable=True)
    replaces_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aa_review_factors.id"), nullable=True
    )

    __table_args__ = (
        CheckConstraint("ordinal >= 1", name="ck_aa_review_factors_ordinal"),
        CheckConstraint(
            "btrim(text) <> '' AND char_length(text) <= 500", name="ck_aa_review_factors_text"
        ),
        CheckConstraint(
            check_in("epistemic_kind", EpistemicKind), name="ck_aa_review_factors_epistemic_kind"
        ),
        CheckConstraint("added_in_revision >= 1", name="ck_aa_review_factors_added"),
        CheckConstraint(
            "retracted_in_revision IS NULL OR retracted_in_revision > added_in_revision",
            name="ck_aa_review_factors_retracted_order",
        ),
        CheckConstraint("replaces_id <> id", name="ck_aa_review_factors_no_self_replace"),
        Index("ix_aa_review_factors_review", "review_id", "ordinal"),
    )


__all__ = [
    "REVIEW_SOURCE_TABLES",
    "AAReview",
    "AAReviewContextItem",
    "AAReviewContextSource",
    "AAReviewFactor",
    "AAReviewRevision",
]
