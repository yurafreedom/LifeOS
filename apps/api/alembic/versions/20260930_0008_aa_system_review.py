"""M7: System Review, relationship and consequence intelligence (Slice 7).

Five new account-owned tables; no existing table is altered and
``user_snapshots.schema_version`` stays 2:

* ``aa_importance_ratings`` — user-owned importance per item (append-only, one
  active rating per target, no numeric column);
* ``aa_cross_references`` — relations between two value-free ref keys, with an
  explicit epistemic kind tied to the relation type, proposal provenance and the
  current status (a system proposal cannot be approved without a response);
* ``aa_relation_feedback`` — the append-only log of the user's answers;
* ``aa_finance_contexts`` — explicit, user-authored finance context (expense
  context, obligations, reserve, essentials, self-check), versioned per entity;
* ``aa_system_review_revisions`` — Saved System Review, append-only revisions with
  a frozen, redactable context and a source manifest.

The count follows the semantics (Plan §4): relation identity and the answer log
are different lifetimes; the saved review needs no header row because revisions
are unique per period.

Downgrade drops the five tables and destroys the user's importance ratings,
relations, finance context and saved reviews: use ONLY on disposable or
pre-write environments. Once Slice 7 writes are enabled in production, roll back
behaviour and the write gate, never this schema (correction C8).
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

from alembic import op

revision = "20260930_0008"
down_revision = "20260929_0007"
branch_labels = None
depends_on = None

# Frozen M7 SQL, intentionally independent of future ORM/enum/helper changes.
SHA256 = "'^[0-9a-f]{64}$'"
IMPORTANCE = "('none', 'matters', 'ok', 'ignore')"
RELATION_TYPES = (
    "('related', 'temporally_associated', 'co_occurs_with', 'conflicts_with', 'supports',"
    " 'preceded_by', 'followed_by', 'may_contribute_to', 'may_increase_risk_of',"
    " 'may_reduce_probability_of')"
)
HYPOTHESES = "('may_contribute_to', 'may_increase_risk_of', 'may_reduce_probability_of')"
NOTE = "note IS NULL OR (btrim(note) <> '' AND char_length(note) <= 1000)"
CONTEXT_KINDS = "('expense_context', 'obligation', 'reserve', 'essentials', 'self_check')"


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


def _key(name):
    return [
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.UniqueConstraint("user_id", "idempotency_key", name=f"uq_{name}_idempotency_key"),
    ]


def upgrade():
    name = "aa_importance_ratings"
    op.create_table(
        name,
        *_owned(),
        sa.Column("target_key", sa.Text(), nullable=False),
        sa.Column("importance", sa.Text(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("supersedes_id", sa.UUID(), sa.ForeignKey(f"{name}.id")),
        sa.Column("superseded_at", sa.DateTime(timezone=True)),
        *_key(name),
        sa.CheckConstraint(
            "char_length(target_key) BETWEEN 3 AND 600", name=f"ck_{name}_target"
        ),
        sa.CheckConstraint(f"importance IN {IMPORTANCE}", name=f"ck_{name}_importance"),
        sa.CheckConstraint("status IN ('active', 'superseded')", name=f"ck_{name}_status"),
        sa.CheckConstraint(
            "(status = 'active') = (superseded_at IS NULL)", name=f"ck_{name}_superseded_pair"
        ),
    )
    op.create_index(
        "uq_aa_importance_ratings_active",
        name,
        ["user_id", "target_key"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_index(
        "ix_aa_importance_ratings_user_target", name, ["user_id", "target_key", "recorded_at"]
    )

    name = "aa_cross_references"
    op.create_table(
        name,
        *_owned(),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("proposal_family", sa.Text()),
        sa.Column("proposal_model", sa.Text()),
        sa.Column("proposal_model_version", sa.Integer()),
        sa.Column("proposal_key", sa.Text()),
        sa.Column("input_fingerprint", sa.Text()),
        sa.Column("evidence", JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("from_key", sa.Text(), nullable=False),
        sa.Column("to_key", sa.Text(), nullable=False),
        sa.Column("from_domain", sa.Text(), nullable=False),
        sa.Column("to_domain", sa.Text(), nullable=False),
        sa.Column("relation_type", sa.Text(), nullable=False),
        sa.Column("epistemic_kind", sa.Text(), nullable=False),
        sa.Column("period_key", sa.Text()),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("proposed_at", sa.DateTime(timezone=True)),
        sa.Column("responded_at", sa.DateTime(timezone=True)),
        sa.Column("endpoint_redacted_at", sa.DateTime(timezone=True)),
        *_key(name),
        sa.CheckConstraint("source IN ('user', 'rule', 'ai')", name=f"ck_{name}_source"),
        sa.CheckConstraint(f"relation_type IN {RELATION_TYPES}", name=f"ck_{name}_relation_type"),
        sa.CheckConstraint(
            "epistemic_kind IN ('association', 'hypothesis')", name=f"ck_{name}_epistemic_kind"
        ),
        sa.CheckConstraint(
            "status IN ('proposed', 'approved', 'rejected', 'unsure')", name=f"ck_{name}_status"
        ),
        sa.CheckConstraint(
            f"(relation_type IN {HYPOTHESES}) = (epistemic_kind = 'hypothesis')",
            name=f"ck_{name}_epistemic",
        ),
        sa.CheckConstraint(
            f"proposal_key IS NULL OR proposal_key ~ {SHA256}", name=f"ck_{name}_proposal_key"
        ),
        sa.CheckConstraint(
            f"input_fingerprint IS NULL OR input_fingerprint ~ {SHA256}",
            name=f"ck_{name}_fingerprint",
        ),
        sa.CheckConstraint("jsonb_typeof(evidence) = 'array'", name=f"ck_{name}_evidence"),
        sa.CheckConstraint(
            "char_length(from_key) BETWEEN 3 AND 600 AND char_length(to_key) BETWEEN 3 AND 600",
            name=f"ck_{name}_keys",
        ),
        sa.CheckConstraint(
            "period_key IS NULL OR period_key ~ '^[0-9]{4}(-(0[1-9]|1[0-2]))?$'",
            name=f"ck_{name}_period",
        ),
        sa.CheckConstraint(NOTE, name=f"ck_{name}_note"),
        sa.CheckConstraint(
            "source <> 'user' OR (status = 'approved' AND proposal_key IS NULL"
            " AND proposal_family IS NULL AND proposal_model IS NULL"
            " AND proposal_model_version IS NULL AND input_fingerprint IS NULL"
            " AND proposed_at IS NULL)",
            name=f"ck_{name}_user_source",
        ),
        sa.CheckConstraint(
            "source = 'user' OR (proposal_key IS NOT NULL AND proposal_family IS NOT NULL"
            " AND proposal_model IS NOT NULL AND proposal_model_version IS NOT NULL"
            " AND input_fingerprint IS NOT NULL AND proposed_at IS NOT NULL)",
            name=f"ck_{name}_system_source",
        ),
        sa.CheckConstraint(
            "source = 'user' OR ((status = 'proposed') = (responded_at IS NULL))",
            name=f"ck_{name}_no_auto_approval",
        ),
        sa.CheckConstraint(
            "from_key <> to_key OR endpoint_redacted_at IS NOT NULL",
            name=f"ck_{name}_distinct_endpoints",
        ),
    )
    op.create_index(
        "uq_aa_cross_references_proposal",
        name,
        ["user_id", "proposal_key"],
        unique=True,
        postgresql_where=sa.text("proposal_key IS NOT NULL"),
    )
    op.create_index(
        "uq_aa_cross_references_manual",
        name,
        ["user_id", "from_key", "to_key", "relation_type"],
        unique=True,
        postgresql_where=sa.text("source = 'user' AND endpoint_redacted_at IS NULL"),
    )
    op.create_index(
        "ix_aa_cross_references_user_status", name, ["user_id", "status", "period_key"]
    )
    op.create_index(
        "ix_aa_cross_references_user_family", name, ["user_id", "source", "proposal_family"]
    )

    name = "aa_relation_feedback"
    op.create_table(
        name,
        *_owned(),
        sa.Column(
            "relation_id",
            sa.UUID(),
            sa.ForeignKey("aa_cross_references.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("response", sa.Text(), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("input_fingerprint", sa.Text()),
        *_key(name),
        sa.CheckConstraint(
            "response IN ('approved', 'rejected', 'unsure')", name=f"ck_{name}_response"
        ),
        sa.CheckConstraint(NOTE, name=f"ck_{name}_note"),
        sa.CheckConstraint(
            f"input_fingerprint IS NULL OR input_fingerprint ~ {SHA256}",
            name=f"ck_{name}_fingerprint",
        ),
    )
    op.create_index("ix_aa_relation_feedback_relation", name, ["relation_id", "responded_at"])

    name = "aa_finance_contexts"
    op.create_table(
        name,
        *_owned(),
        sa.Column("entity_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("subject_key", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("supersedes_id", sa.UUID(), sa.ForeignKey(f"{name}.id")),
        sa.Column("superseded_at", sa.DateTime(timezone=True)),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        *_key(name),
        sa.CheckConstraint(f"kind IN {CONTEXT_KINDS}", name=f"ck_{name}_kind"),
        sa.CheckConstraint("jsonb_typeof(payload) = 'object'", name=f"ck_{name}_payload"),
        sa.CheckConstraint("version >= 1", name=f"ck_{name}_version"),
        sa.CheckConstraint("status IN ('active', 'superseded')", name=f"ck_{name}_status"),
        sa.CheckConstraint(
            "(status = 'active') = (superseded_at IS NULL)", name=f"ck_{name}_superseded_pair"
        ),
        sa.CheckConstraint(
            "(kind IN ('expense_context', 'self_check')) = (subject_key <> '')",
            name=f"ck_{name}_subject_required",
        ),
        sa.CheckConstraint(
            "kind <> 'expense_context' OR subject_key ~ '^finance:transaction:[^:]+$'",
            name=f"ck_{name}_expense_subject",
        ),
        sa.CheckConstraint(
            "kind <> 'self_check'"
            " OR subject_key ~ '^finance:period:[0-9]{4}-(0[1-9]|1[0-2])$'",
            name=f"ck_{name}_self_check_subject",
        ),
        sa.UniqueConstraint(
            "user_id", "entity_id", "version", name=f"uq_{name}_entity_version"
        ),
    )
    op.create_index(
        "uq_aa_finance_contexts_active_entity",
        name,
        ["user_id", "entity_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_index(
        "uq_aa_finance_contexts_active_subject",
        name,
        ["user_id", "kind", "subject_key"],
        unique=True,
        postgresql_where=sa.text(
            "status = 'active' AND kind IN ('expense_context', 'self_check')"
        ),
    )
    op.create_index("ix_aa_finance_contexts_user_kind", name, ["user_id", "kind", "status"])

    name = "aa_system_review_revisions"
    op.create_table(
        name,
        *_owned(),
        sa.Column("period_kind", sa.Text(), nullable=False),
        sa.Column("period_key", sa.Text(), nullable=False),
        sa.Column("timezone", sa.Text(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("previous_revision_id", sa.UUID(), sa.ForeignKey(f"{name}.id")),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("finalized_at", sa.DateTime(timezone=True)),
        sa.Column("context_as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reflection", sa.Text()),
        sa.Column("no_conclusion", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("decisions", JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("adjustments", JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("frozen_context", JSONB(), nullable=False),
        sa.Column(
            "source_ids", ARRAY(sa.UUID()), server_default=sa.text("'{}'::uuid[]"), nullable=False
        ),
        sa.Column("redacted_at", sa.DateTime(timezone=True)),
        *_key(name),
        sa.CheckConstraint("period_kind IN ('month', 'year')", name=f"ck_{name}_period_kind"),
        sa.CheckConstraint(
            "(period_kind = 'month' AND period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')"
            " OR (period_kind = 'year' AND period_key ~ '^[0-9]{4}$')",
            name=f"ck_{name}_period_key",
        ),
        sa.CheckConstraint("timezone <> ''", name=f"ck_{name}_timezone"),
        sa.CheckConstraint("revision >= 1", name=f"ck_{name}_revision"),
        sa.CheckConstraint(
            "(revision = 1) = (previous_revision_id IS NULL)", name=f"ck_{name}_chain"
        ),
        sa.CheckConstraint("status IN ('draft', 'finalized')", name=f"ck_{name}_status"),
        sa.CheckConstraint(
            "(status = 'finalized') = (finalized_at IS NOT NULL)",
            name=f"ck_{name}_finalized_pair",
        ),
        sa.CheckConstraint(
            "reflection IS NULL"
            " OR (btrim(reflection) <> '' AND char_length(reflection) <= 4000)",
            name=f"ck_{name}_reflection",
        ),
        sa.CheckConstraint(
            "NOT (no_conclusion AND reflection IS NOT NULL)", name=f"ck_{name}_no_conclusion"
        ),
        sa.CheckConstraint(
            "jsonb_typeof(decisions) = 'array' AND jsonb_typeof(adjustments) = 'array'",
            name=f"ck_{name}_lists",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(frozen_context) = 'object'", name=f"ck_{name}_frozen_context"
        ),
        sa.UniqueConstraint(
            "user_id", "period_kind", "period_key", "revision", name=f"uq_{name}_revision"
        ),
    )
    op.create_index(
        "ix_aa_system_review_revisions_period",
        name,
        ["user_id", "period_kind", "period_key", "revision"],
    )
    op.create_index(
        "ix_aa_system_review_revisions_sources",
        name,
        ["source_ids"],
        postgresql_using="gin",
    )


def downgrade():
    op.drop_table("aa_system_review_revisions")
    op.drop_table("aa_finance_contexts")
    op.drop_table("aa_relation_feedback")
    op.drop_table("aa_cross_references")
    op.drop_table("aa_importance_ratings")
