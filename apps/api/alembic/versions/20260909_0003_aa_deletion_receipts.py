"""Slice 0b: erasure receipts and erased tombstone representation.

Destructive downgrade is pre-write/disposable-only. After personal AA history
exists, roll back behaviour and KEEP schema/data (C8).
No PRE-AA table is changed; live value legality remains unchanged.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from app.analytics.values import value_check_sql

revision: str = "20260909_0003"
down_revision: str | Sequence[str] | None = "20260909_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "aa_deletion_receipts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("table_name", sa.Text(), nullable=False),
        sa.Column("fact_id", sa.UUID(), nullable=False),
        sa.Column(
            "deleted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint("table_name <> ''", name="ck_aa_deletion_receipts_table_name"),
    )
    op.create_index(
        "ix_aa_deletion_receipts_user_deleted_at", "aa_deletion_receipts", ["user_id", "deleted_at"]
    )
    op.drop_constraint("ck_aa_measurements_value_shape", "aa_measurements", type_="check")
    erased = (
        "status = 'tombstoned' AND unit_code IS NULL AND value_num IS NULL"
        " AND value_date IS NULL AND value_text IS NULL AND scale_min IS NULL"
        " AND scale_max IS NULL"
    )
    op.create_check_constraint(
        "ck_aa_measurements_value_shape", "aa_measurements", f"({erased}) OR ({value_check_sql()})"
    )
    op.alter_column("aa_source_coverage", "source_id", nullable=True)
    op.alter_column("aa_source_coverage", "coverage_state", nullable=True)
    op.create_check_constraint(
        "ck_aa_source_coverage_present_claim",
        "aa_source_coverage",
        "status = 'tombstoned' OR (source_id IS NOT NULL AND coverage_state IS NOT NULL)",
    )


def downgrade() -> None:
    # Do not run against populated personal history. Empty/disposable only.
    op.drop_constraint("ck_aa_source_coverage_present_claim", "aa_source_coverage", type_="check")
    op.alter_column("aa_source_coverage", "coverage_state", nullable=False)
    op.alter_column("aa_source_coverage", "source_id", nullable=False)
    op.drop_constraint("ck_aa_measurements_value_shape", "aa_measurements", type_="check")
    op.create_check_constraint(
        "ck_aa_measurements_value_shape", "aa_measurements", value_check_sql()
    )
    op.drop_index("ix_aa_deletion_receipts_user_deleted_at", table_name="aa_deletion_receipts")
    op.drop_table("aa_deletion_receipts")
