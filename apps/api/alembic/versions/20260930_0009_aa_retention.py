"""M8: AA history retention (Slice 8).

Two new account-owned tables and one widened CHECK; ``user_snapshots.schema_version``
stays 2:

* ``aa_retention_policies`` — append-only retention intent. No row = UNLIMITED
  (default). Finite durations are exactly 24, 36 or 60 months (owner decision
  O3). A policy never deletes anything by itself.
* ``aa_retention_runs`` — one durable audit row per explicit Apply (owner
  decision O4): horizon, zone, preview fingerprint, status and counts. Never
  per-fact receipts, never a deleted value.
* ``ck_aa_review_context_items_redaction_reason`` gains ``source_retention_pruned``
  (owner decision O2), so a Review can say the source was erased by the user's
  retention rule rather than by a manual hard delete.

Downgrade drops both tables and restores the narrow CHECK. Use ONLY on disposable
or pre-write environments: once a retention run has redacted a Review item the
CHECK restore fails by design, and once personal retention history exists a
production rollback must keep this schema (correction C8).
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "20260930_0009"
down_revision = "20260930_0008"
branch_labels = None
depends_on = None

# Frozen M8 SQL, intentionally independent of future ORM/enum/helper changes.
MONTHS = "(60, 36, 24)"
COUNTS = (
    "total_deleted",
    "chain_count",
    "project_unit_count",
    "review_redaction_count",
    "system_review_redaction_count",
    "relation_redaction_count",
    "importance_redaction_count",
    "provenance_redaction_count",
    "signal_episode_count",
)
JSONS = ("table_counts", "unit_counts", "skipped", "pruned_units", "progress")
REASON_CK = "ck_aa_review_context_items_redaction_reason"


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


def upgrade():
    op.create_table(
        "aa_retention_policies",
        *_owned(),
        sa.Column("mode", sa.Text(), nullable=False),
        sa.Column("retain_months", sa.Integer(), nullable=True),
        sa.Column("consequences_version", sa.Text(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column(
            "supersedes_id",
            sa.UUID(),
            sa.ForeignKey("aa_retention_policies.id"),
            nullable=True,
        ),
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "mode IN ('unlimited', 'finite')", name="ck_aa_retention_policies_mode"
        ),
        sa.CheckConstraint(
            "(mode = 'unlimited') = (retain_months IS NULL)",
            name="ck_aa_retention_policies_months_pair",
        ),
        sa.CheckConstraint(
            f"retain_months IS NULL OR retain_months IN {MONTHS}",
            name="ck_aa_retention_policies_months",
        ),
        sa.CheckConstraint(
            "mode = 'unlimited' OR (consequences_version IS NOT NULL AND confirmed_at IS NOT NULL)",
            name="ck_aa_retention_policies_confirmed",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'superseded')", name="ck_aa_retention_policies_status"
        ),
        sa.CheckConstraint(
            "(status = 'active') = (superseded_at IS NULL)",
            name="ck_aa_retention_policies_superseded_pair",
        ),
        sa.CheckConstraint("supersedes_id <> id", name="ck_aa_retention_policies_no_self"),
        sa.UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_retention_policies_idempotency_key"
        ),
    )
    op.create_index(
        "uq_aa_retention_policies_active",
        "aa_retention_policies",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "aa_retention_runs",
        *_owned(),
        sa.Column(
            "policy_id", sa.UUID(), sa.ForeignKey("aa_retention_policies.id"), nullable=False
        ),
        sa.Column("retain_months", sa.Integer(), nullable=False),
        sa.Column("target_horizon_date", sa.Date(), nullable=False),
        sa.Column("timezone", sa.Text(), nullable=False),
        sa.Column("engine_version", sa.Integer(), nullable=False),
        sa.Column("preview_fingerprint", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_code", sa.Text(), nullable=True),
        *[
            sa.Column(name, sa.Integer(), server_default=sa.text("0"), nullable=False)
            for name in COUNTS
        ],
        *[
            sa.Column(name, JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False)
            for name in JSONS
        ],
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "status IN ('running', 'completed', 'failed')", name="ck_aa_retention_runs_status"
        ),
        sa.CheckConstraint(f"retain_months IN {MONTHS}", name="ck_aa_retention_runs_months"),
        sa.CheckConstraint("timezone <> ''", name="ck_aa_retention_runs_timezone"),
        sa.CheckConstraint("engine_version >= 1", name="ck_aa_retention_runs_engine_version"),
        sa.CheckConstraint(
            "preview_fingerprint ~ '^[0-9a-f]{64}$'", name="ck_aa_retention_runs_fingerprint"
        ),
        sa.CheckConstraint(
            "(status = 'completed') = (completed_at IS NOT NULL)",
            name="ck_aa_retention_runs_completed_pair",
        ),
        sa.CheckConstraint(
            "(status = 'failed') = (failed_at IS NOT NULL)"
            " AND (status = 'failed') = (failure_code IS NOT NULL)",
            name="ck_aa_retention_runs_failed_pair",
        ),
        sa.CheckConstraint(
            "status <> 'failed' OR total_deleted = 0", name="ck_aa_retention_runs_failed_empty"
        ),
        sa.CheckConstraint(
            " AND ".join(f"{name} >= 0" for name in COUNTS), name="ck_aa_retention_runs_counts"
        ),
        sa.CheckConstraint(
            " AND ".join(f"jsonb_typeof({name}) = 'object'" for name in JSONS),
            name="ck_aa_retention_runs_json",
        ),
        sa.UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_retention_runs_idempotency_key"
        ),
    )
    op.create_index(
        "ix_aa_retention_runs_user_status_horizon",
        "aa_retention_runs",
        ["user_id", "status", "target_horizon_date"],
    )

    op.drop_constraint(REASON_CK, "aa_review_context_items", type_="check")
    op.create_check_constraint(
        REASON_CK,
        "aa_review_context_items",
        "redaction_reason IS NULL OR redaction_reason IN"
        " ('source_hard_deleted', 'source_retention_pruned')",
    )


def downgrade():
    op.drop_constraint(REASON_CK, "aa_review_context_items", type_="check")
    op.create_check_constraint(
        REASON_CK,
        "aa_review_context_items",
        "redaction_reason IS NULL OR redaction_reason IN ('source_hard_deleted')",
    )
    op.drop_index("ix_aa_retention_runs_user_status_horizon", table_name="aa_retention_runs")
    op.drop_table("aa_retention_runs")
    op.drop_index("uq_aa_retention_policies_active", table_name="aa_retention_policies")
    op.drop_table("aa_retention_policies")
