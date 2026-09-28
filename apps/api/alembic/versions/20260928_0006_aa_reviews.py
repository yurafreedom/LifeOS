"""M5: Review / Debrief (plan §12, correction C4, owner decision D1).

Additive: no pre-AA table and no earlier AA table is altered. `user_snapshots`
keeps `schema_version = 2`, so old clients are unaffected.

Six tables. Frozen, source-derived evidence lives in normalized
`aa_review_context_items`, linked to every fact it came from through
`aa_review_context_sources`, so hard deletion of any one source erases exactly
the items derived from it — one indexed lookup, no JSON walker. User-authored
content (`aa_review_revisions`, `aa_review_factors`, `aa_decisions`) carries no
source link and is never redacted. `aa_reviews.render_manifest` is layout only.

The two tables beyond the plan's original four are Discovery findings D-2 (a
derived value has many sources) and D-3 (text must be appendable without
overwriting).

Downgrade destroys personal Review history: use ONLY on disposable or pre-write
environments. Once the write path has been enabled in production, roll back
behaviour and the write gate, never this schema (correction C8).
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "20260928_0006"
down_revision = "20260928_0005"
branch_labels = None
depends_on = None

# Frozen M5 SQL, intentionally independent of future ORM/enum/helper changes.
VALUE_SHAPE = (
    "CASE value_type"
    " WHEN 'money' THEN value_num IS NOT NULL AND unit_code IS NOT NULL AND value_date IS NULL"
    " AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL"
    " AND unit_code ~ '^[A-Z]{3}$'"
    " WHEN 'date' THEN value_date IS NOT NULL AND unit_code IS NULL AND value_num IS NULL"
    " AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL"
    " WHEN 'duration' THEN value_num IS NOT NULL AND unit_code IS NOT NULL AND value_date IS NULL"
    " AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL AND unit_code = 'minute'"
    " WHEN 'count' THEN value_num IS NOT NULL AND unit_code IS NULL AND value_date IS NULL"
    " AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL"
    " WHEN 'scale' THEN value_num IS NOT NULL AND scale_min IS NOT NULL AND scale_max IS NOT NULL"
    " AND unit_code IS NULL AND value_date IS NULL AND value_text IS NULL"
    " AND scale_min < scale_max AND value_num >= scale_min AND value_num <= scale_max"
    " WHEN 'categorical' THEN value_text IS NOT NULL AND unit_code IS NULL AND value_num IS NULL"
    " AND value_date IS NULL AND scale_min IS NULL AND scale_max IS NULL"
    " AND btrim(value_text) <> ''"
    " ELSE false END"
)
EMPTY_VALUE = (
    "unit_code IS NULL AND value_num IS NULL AND value_date IS NULL"
    " AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL"
)
ERASED = (
    f"availability IS NULL AND value_type IS NULL AND {EMPTY_VALUE}"
    " AND desire IS NULL AND epistemic_kind IS NULL AND estimate = false"
    " AND source_kind IS NULL AND basis IS NULL AND method IS NULL"
    " AND provenance_recorded_at IS NULL AND original_recorded_at_known IS NULL"
)
EPISTEMIC = "('observed', 'mine', 'maybe', 'unknown')"
SOURCE_TABLES = (
    "('aa_measurements', 'aa_source_coverage', 'aa_expectation_versions',"
    " 'aa_forecast_versions', 'aa_baselines', 'aa_targets', 'aa_preferences',"
    " 'aa_observations', 'aa_metric_policy_versions', 'aa_metric_membership_overrides')"
)


def _owned():
    return [
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    ]


def _review_fk(nullable=False):
    return sa.Column(
        "review_id",
        sa.UUID(),
        sa.ForeignKey("aa_reviews.id", ondelete="CASCADE"),
        nullable=nullable,
    )


def upgrade():
    op.create_table(
        "aa_reviews",
        *_owned(),
        sa.Column("subject_domain", sa.Text(), nullable=False),
        sa.Column("subject_type", sa.Text(), nullable=False),
        sa.Column("subject_id", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column(
            "subject_key",
            sa.Text(),
            sa.Computed(
                "subject_domain || ':' || subject_type || ':' || subject_id", persisted=True
            ),
            nullable=False,
        ),
        sa.Column("window_start", sa.Date(), nullable=False),
        sa.Column("window_end", sa.Date(), nullable=False),
        sa.Column("timezone", sa.Text(), nullable=False),
        sa.Column("context_as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("render_manifest", JSONB(), nullable=False),
        sa.Column("current_revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("revised_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("window_end >= window_start", name="ck_aa_reviews_window_order"),
        sa.CheckConstraint("timezone <> ''", name="ck_aa_reviews_timezone"),
        sa.CheckConstraint("current_revision >= 1", name="ck_aa_reviews_current_revision"),
        sa.CheckConstraint(
            "(revised_at IS NULL) = (current_revision = 1)", name="ck_aa_reviews_revised_pair"
        ),
    )
    op.create_index(
        "ix_aa_reviews_user_subject_created",
        "aa_reviews",
        ["user_id", "subject_key", "created_at"],
    )

    op.create_table(
        "aa_review_revisions",
        *_owned(),
        _review_fk(),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("note_text", sa.Text()),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.CheckConstraint("revision >= 1", name="ck_aa_review_revisions_revision"),
        sa.CheckConstraint(
            "note_text IS NULL OR (btrim(note_text) <> '' AND char_length(note_text) <= 4000)",
            name="ck_aa_review_revisions_note_text",
        ),
        sa.UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_review_revisions_idempotency_key"
        ),
        sa.UniqueConstraint("review_id", "revision", name="uq_aa_review_revisions_revision"),
    )

    op.create_table(
        "aa_review_context_items",
        *_owned(),
        _review_fk(),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("section", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("label_key", sa.Text(), nullable=False),
        sa.Column("metric_key", sa.Text()),
        sa.Column("availability", sa.Text()),
        sa.Column("value_type", sa.Text()),
        sa.Column("unit_code", sa.Text()),
        sa.Column("value_num", sa.Numeric(20, 6)),
        sa.Column("value_date", sa.Date()),
        sa.Column("value_text", sa.Text()),
        sa.Column("scale_min", sa.Numeric(20, 6)),
        sa.Column("scale_max", sa.Numeric(20, 6)),
        sa.Column("desire", sa.Text()),
        sa.Column("epistemic_kind", sa.Text()),
        sa.Column("estimate", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("source_kind", sa.Text()),
        sa.Column("basis", sa.Text()),
        sa.Column("method", sa.Text()),
        sa.Column("provenance_recorded_at", sa.DateTime(timezone=True)),
        sa.Column("original_recorded_at_known", sa.Boolean()),
        sa.Column("redacted_at", sa.DateTime(timezone=True)),
        sa.Column("redaction_reason", sa.Text()),
        sa.UniqueConstraint("review_id", "ordinal", name="uq_aa_review_context_items_ordinal"),
        sa.CheckConstraint("ordinal >= 1", name="ck_aa_review_context_items_ordinal"),
        sa.CheckConstraint("label_key <> ''", name="ck_aa_review_context_items_label_key"),
        sa.CheckConstraint(
            "section IN ('compare', 'quality', 'alongside')",
            name="ck_aa_review_context_items_section",
        ),
        sa.CheckConstraint(
            "role IN ('expected', 'forecast', 'actual', 'delta', 'target', 'coverage',"
            " 'observation')",
            name="ck_aa_review_context_items_role",
        ),
        sa.CheckConstraint(
            "availability IS NULL OR availability IN ('present', 'no_data', 'insufficient_data',"
            " 'not_applicable', 'explicitly_absent', 'explicitly_unknown')",
            name="ck_aa_review_context_items_availability",
        ),
        sa.CheckConstraint(
            "value_type IS NULL OR value_type IN ('money', 'date', 'duration', 'count', 'scale',"
            " 'categorical')",
            name="ck_aa_review_context_items_value_type",
        ),
        sa.CheckConstraint(
            "desire IS NULL OR (role = 'delta' AND desire IN ('neutral', 'favorable',"
            " 'unfavorable', 'unknown'))",
            name="ck_aa_review_context_items_desire",
        ),
        sa.CheckConstraint(
            f"epistemic_kind IS NULL OR (role = 'observation' AND epistemic_kind IN {EPISTEMIC})",
            name="ck_aa_review_context_items_epistemic_kind",
        ),
        sa.CheckConstraint(
            "source_kind IS NULL OR source_kind IN ('OBSERVED', 'USER_REPORTED', 'IMPORTED',"
            " 'DERIVED', 'ESTIMATED', 'FORECAST', 'UNKNOWN')",
            name="ck_aa_review_context_items_source_kind",
        ),
        sa.CheckConstraint(
            f"(availability = 'present' AND value_type IS NOT NULL AND ({VALUE_SHAPE}))"
            f" OR (availability IS DISTINCT FROM 'present' AND {EMPTY_VALUE})",
            name="ck_aa_review_context_items_value_shape",
        ),
        sa.CheckConstraint(
            "(redacted_at IS NULL) = (redaction_reason IS NULL)",
            name="ck_aa_review_context_items_redaction_pair",
        ),
        sa.CheckConstraint(
            "redaction_reason IS NULL OR redaction_reason IN ('source_hard_deleted')",
            name="ck_aa_review_context_items_redaction_reason",
        ),
        sa.CheckConstraint(
            f"redacted_at IS NULL OR ({ERASED})",
            name="ck_aa_review_context_items_redacted_erased",
        ),
        sa.CheckConstraint(
            "redacted_at IS NOT NULL OR availability IS NOT NULL",
            name="ck_aa_review_context_items_availability_present",
        ),
    )
    op.create_index(
        "ix_aa_review_context_items_review", "aa_review_context_items", ["review_id", "ordinal"]
    )

    op.create_table(
        "aa_review_context_sources",
        *_owned(),
        sa.Column(
            "item_id",
            sa.UUID(),
            sa.ForeignKey("aa_review_context_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_table", sa.Text(), nullable=False),
        sa.Column("source_fact_id", sa.UUID(), nullable=False),
        sa.UniqueConstraint(
            "item_id", "source_table", "source_fact_id", name="uq_aa_review_context_sources_link"
        ),
        sa.CheckConstraint(
            f"source_table IN {SOURCE_TABLES}",
            name="ck_aa_review_context_sources_source_table",
        ),
    )
    op.create_index(
        "ix_aa_review_context_sources_user_fact",
        "aa_review_context_sources",
        ["user_id", "source_fact_id"],
    )
    op.create_index(
        "ix_aa_review_context_sources_item", "aa_review_context_sources", ["item_id"]
    )

    op.create_table(
        "aa_review_factors",
        *_owned(),
        _review_fk(),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "epistemic_kind", sa.Text(), server_default=sa.text("'unknown'"), nullable=False
        ),
        sa.Column("added_in_revision", sa.Integer(), nullable=False),
        sa.Column("retracted_in_revision", sa.Integer()),
        sa.Column("replaces_id", sa.UUID(), sa.ForeignKey("aa_review_factors.id")),
        sa.CheckConstraint("ordinal >= 1", name="ck_aa_review_factors_ordinal"),
        sa.CheckConstraint(
            "btrim(text) <> '' AND char_length(text) <= 500", name="ck_aa_review_factors_text"
        ),
        sa.CheckConstraint(
            f"epistemic_kind IN {EPISTEMIC}", name="ck_aa_review_factors_epistemic_kind"
        ),
        sa.CheckConstraint("added_in_revision >= 1", name="ck_aa_review_factors_added"),
        sa.CheckConstraint(
            "retracted_in_revision IS NULL OR retracted_in_revision > added_in_revision",
            name="ck_aa_review_factors_retracted_order",
        ),
        sa.CheckConstraint("replaces_id <> id", name="ck_aa_review_factors_no_self_replace"),
    )
    op.create_index(
        "ix_aa_review_factors_review", "aa_review_factors", ["review_id", "ordinal"]
    )

    op.create_table(
        "aa_decisions",
        *_owned(),
        sa.Column("scope", sa.Text(), nullable=False),
        _review_fk(nullable=True),
        sa.Column("choice", sa.Text()),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("superseded_in_revision", sa.Integer()),
        sa.CheckConstraint("scope IN ('review')", name="ck_aa_decisions_scope"),
        sa.CheckConstraint(
            "scope <> 'review' OR review_id IS NOT NULL", name="ck_aa_decisions_review_scope"
        ),
        sa.CheckConstraint(
            "choice IS NULL OR choice IN ('keep', 'adjust', 'later', 'inconclusive')",
            name="ck_aa_decisions_choice",
        ),
        sa.CheckConstraint("revision >= 1", name="ck_aa_decisions_revision"),
        sa.CheckConstraint(
            "superseded_in_revision IS NULL OR superseded_in_revision > revision",
            name="ck_aa_decisions_superseded_order",
        ),
    )
    op.create_index(
        "uq_aa_decisions_current_review",
        "aa_decisions",
        ["review_id"],
        unique=True,
        postgresql_where=sa.text("superseded_in_revision IS NULL AND review_id IS NOT NULL"),
    )


def downgrade():
    op.drop_table("aa_decisions")
    op.drop_table("aa_review_factors")
    op.drop_table("aa_review_context_sources")
    op.drop_table("aa_review_context_items")
    op.drop_table("aa_review_revisions")
    op.drop_table("aa_reviews")
