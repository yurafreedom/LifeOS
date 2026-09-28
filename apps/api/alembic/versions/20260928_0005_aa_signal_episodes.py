"""M4: signal episode state (plan §13, correction C2).

Additive: no pre-AA table and no Slice 0/0b/1 table is altered. `user_snapshots`
keeps `schema_version = 2`, so old clients are unaffected.

This is the one AA table that stores state rather than an append-only fact, so it
deliberately does not carry the shared provenance/supersession/value template.
It stores the two identities the plan insists must stay separate — the rule-defined
`episode_key` and the evaluator's `sha256` input fingerprint — and nothing that
could be re-derived from the facts a signal reads.

Downgrade destroys personal acknowledgement history: use ONLY on disposable or
pre-write environments. Once the write path has been enabled in production, roll
back behaviour and the write gate, never this schema (correction C8).
"""

import sqlalchemy as sa

from alembic import op

revision = "20260928_0005"
down_revision = "20260910_0004"
branch_labels = None
depends_on = None

TABLE = "aa_signal_episodes"

# Frozen M4 SQL, intentionally independent of future ORM/enum/helper changes.
FINGERPRINT = "~ '^[0-9a-f]{64}$'"


def upgrade():
    op.create_table(
        TABLE,
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
        sa.Column("subject_domain", sa.Text(), nullable=False),
        sa.Column("subject_type", sa.Text(), nullable=False),
        sa.Column("subject_id", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column(
            "subject_key",
            sa.Text(),
            sa.Computed("subject_domain || ':' || subject_type || ':' || subject_id", persisted=True),
            nullable=False,
        ),
        sa.Column("episode_key", sa.Text(), nullable=False),
        sa.Column("rule_id", sa.Text(), nullable=False),
        sa.Column("rule_version", sa.Integer(), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_fingerprint", sa.Text(), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.Column("acknowledged_fingerprint", sa.Text()),
        sa.Column("resolution", sa.Text()),
        sa.Column("reopened_at", sa.DateTime(timezone=True)),
        sa.Column("reopened_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.UniqueConstraint("user_id", "episode_key", name=f"uq_{TABLE}_episode_key"),
        sa.CheckConstraint(
            "resolution IS NULL OR resolution IN ('acknowledged', 'withdrawn')",
            name=f"ck_{TABLE}_resolution",
        ),
        sa.CheckConstraint(
            "(acknowledged_at IS NULL) = (acknowledged_fingerprint IS NULL)",
            name=f"ck_{TABLE}_acknowledged_pair",
        ),
        sa.CheckConstraint(
            "resolution <> 'acknowledged' OR acknowledged_at IS NOT NULL",
            name=f"ck_{TABLE}_acknowledged_has_instant",
        ),
        sa.CheckConstraint("rule_version >= 1", name=f"ck_{TABLE}_rule_version"),
        sa.CheckConstraint("reopened_count >= 0", name=f"ck_{TABLE}_reopened_count"),
        sa.CheckConstraint(
            "(reopened_at IS NULL) = (reopened_count = 0)", name=f"ck_{TABLE}_reopened_pair"
        ),
        sa.CheckConstraint(
            f"last_fingerprint {FINGERPRINT}", name=f"ck_{TABLE}_last_fingerprint"
        ),
        sa.CheckConstraint(
            f"acknowledged_fingerprint IS NULL OR acknowledged_fingerprint {FINGERPRINT}",
            name=f"ck_{TABLE}_acknowledged_fingerprint",
        ),
        sa.CheckConstraint("episode_key <> ''", name=f"ck_{TABLE}_episode_key_present"),
        sa.CheckConstraint(
            "last_evaluated_at >= first_seen_at", name=f"ck_{TABLE}_evaluated_order"
        ),
    )
    op.create_index(f"ix_{TABLE}_user_rule", TABLE, ["user_id", "rule_id"])
    op.create_index(f"ix_{TABLE}_user_subject", TABLE, ["user_id", "subject_key"])
    op.create_index(
        f"ix_{TABLE}_user_active",
        TABLE,
        ["user_id", "last_evaluated_at"],
        postgresql_where=sa.text("resolution IS NULL"),
    )


def downgrade():
    op.drop_table(TABLE)
