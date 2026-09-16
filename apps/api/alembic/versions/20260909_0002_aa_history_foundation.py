"""Create the Adaptive Analytics semantic history foundation (M1).

Additive only. No pre-AA table is touched: ``users``, ``sessions`` and
``user_snapshots`` are untouched, ``user_snapshots.schema_version`` stays 2, and
the three new tables are invisible to an old client.

Downgrade policy (correction C8): ``downgrade()`` drops the tables and is safe
**only while no personal AA history exists** — development, test and disposable
environments, or a production rollback occurring before the AA write path was
ever enabled. Once personal AA history has been written, rollback must be
behavioural: disable ``LIFEOS_AA_WRITE_ENABLED`` and keep both the schema and
the data. Do not run this downgrade against populated AA tables.

Revision ID: 20260909_0002
Revises: 20260721_0001
Create Date: 2026-09-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = '20260909_0002'
down_revision: str | Sequence[str] | None = '20260721_0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _metric_definitions_table() -> sa.Table:
    return sa.table(
        "aa_metric_definitions",
        sa.column("metric_key", sa.Text),
        sa.column("domain", sa.Text),
        sa.column("subject_type", sa.Text),
        sa.column("subject_id_form", sa.Text),
        sa.column("value_type", sa.Text),
        sa.column("unit_code", sa.Text),
        sa.column("aggregation", sa.Text),
        sa.column("actual_source", sa.Text),
        sa.column("coverage_basis", sa.Text),
        sa.column("derivation", sa.Text),
        sa.column("description", sa.Text),
    )


# Metric catalogue v1. The definitions are reference data, not personal data, so
# they ship with the schema; the domain surfaces that use them arrive in later
# slices. `finance.monthly_spend` is deliberately `derived` rather than stored:
# correcting a transaction supersedes its measurement, and the monthly sum then
# counts the corrected value once with no stored aggregate to invalidate.
METRIC_CATALOGUE_V1: list[dict[str, str | None]] = [
    {
        "metric_key": "finance.transaction_amount",
        "domain": "finance",
        "subject_type": "transaction",
        "subject_id_form": "transaction id",
        "value_type": "money",
        "unit_code": "UAH",
        "aggregation": "none",
        "actual_source": "observed",
        "coverage_basis": None,
        "derivation": None,
        "description": "One recorded financial operation.",
    },
    {
        "metric_key": "finance.monthly_spend",
        "domain": "finance",
        "subject_type": "period",
        "subject_id_form": "YYYY-MM",
        "value_type": "money",
        "unit_code": "UAH",
        "aggregation": "sum",
        "actual_source": "derived",
        "coverage_basis": "calendar_days",
        "derivation": (
            "Sum of active finance.transaction_amount measurements in the window whose "
            "as-of-T inclusion resolves to included, from versioned policy and per-fact "
            "overrides only, never from live snapshot state."
        ),
        "description": "Spending over one calendar month.",
    },
    {
        "metric_key": "project.completion_date",
        "domain": "project",
        "subject_type": "project",
        "subject_id_form": "project id",
        "value_type": "date",
        "unit_code": None,
        "aggregation": "none",
        "actual_source": "observed",
        "coverage_basis": None,
        "derivation": None,
        "description": "The date a project was actually completed.",
    },
]


def upgrade() -> None:
    op.create_table('aa_metric_definitions',
    sa.Column('metric_key', sa.Text(), nullable=False),
    sa.Column('domain', sa.Text(), nullable=False),
    sa.Column('subject_type', sa.Text(), nullable=False),
    sa.Column('subject_id_form', sa.Text(), nullable=False),
    sa.Column('value_type', sa.Text(), nullable=False),
    sa.Column('unit_code', sa.Text(), nullable=True),
    sa.Column('aggregation', sa.Text(), nullable=False),
    sa.Column('actual_source', sa.Text(), nullable=False),
    sa.Column('coverage_basis', sa.Text(), nullable=True),
    sa.Column('derivation', sa.Text(), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("actual_source <> 'derived' OR derivation IS NOT NULL", name='ck_aa_metric_definitions_derivation'),
    sa.CheckConstraint("actual_source IN ('observed', 'derived')", name='ck_aa_metric_definitions_actual_source'),
    sa.CheckConstraint("aggregation IN ('none', 'sum')", name='ck_aa_metric_definitions_aggregation'),
    sa.CheckConstraint("coverage_basis IS NULL OR coverage_basis IN ('calendar_days', 'experiment_elapsed_days', 'expected_observations')", name='ck_aa_metric_definitions_coverage_basis'),
    sa.CheckConstraint("value_type <> 'money' OR unit_code IS NOT NULL", name='ck_aa_metric_definitions_money_unit'),
    sa.CheckConstraint("value_type IN ('money', 'date', 'duration', 'count', 'scale', 'categorical')", name='ck_aa_metric_definitions_value_type'),
    sa.PrimaryKeyConstraint('metric_key')
    )
    op.create_table('aa_measurements',
    sa.Column('metric_key', sa.Text(), nullable=False),
    sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('occurred_tz', sa.Text(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('subject_domain', sa.Text(), nullable=False),
    sa.Column('subject_type', sa.Text(), nullable=False),
    sa.Column('subject_id', sa.Text(), server_default=sa.text("''"), nullable=False),
    sa.Column('subject_key', sa.Text(), sa.Computed("subject_domain || ':' || subject_type || ':' || subject_id", persisted=True), nullable=False),
    sa.Column('value_type', sa.Text(), nullable=False),
    sa.Column('unit_code', sa.Text(), nullable=True),
    sa.Column('value_num', sa.Numeric(precision=20, scale=6), nullable=True),
    sa.Column('value_date', sa.Date(), nullable=True),
    sa.Column('value_text', sa.Text(), nullable=True),
    sa.Column('scale_min', sa.Numeric(precision=20, scale=6), nullable=True),
    sa.Column('scale_max', sa.Numeric(precision=20, scale=6), nullable=True),
    sa.Column('dimensions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('source_kind', sa.Text(), nullable=False),
    sa.Column('basis', sa.Text(), nullable=True),
    sa.Column('method', sa.Text(), nullable=True),
    sa.Column('source_ref', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('original_recorded_at_known', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('superseded_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('supersede_kind', sa.Text(), nullable=True),
    sa.Column('supersede_reason', sa.Text(), nullable=True),
    sa.Column('status', sa.Text(), server_default=sa.text("'active'"), nullable=False),
    sa.Column('tombstoned_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('supersedes_id', sa.UUID(), nullable=True),
    sa.Column('superseded_by_id', sa.UUID(), nullable=True),
    sa.Column('idempotency_key', sa.Text(), nullable=False),
    sa.CheckConstraint("CASE value_type\n    WHEN 'money' THEN value_num IS NOT NULL AND unit_code IS NOT NULL AND value_date IS NULL AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL AND unit_code ~ '^[A-Z]{3}$'\n    WHEN 'date' THEN value_date IS NOT NULL AND unit_code IS NULL AND value_num IS NULL AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL\n    WHEN 'duration' THEN value_num IS NOT NULL AND unit_code IS NOT NULL AND value_date IS NULL AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL AND unit_code = 'minute'\n    WHEN 'count' THEN value_num IS NOT NULL AND unit_code IS NULL AND value_date IS NULL AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL\n    WHEN 'scale' THEN value_num IS NOT NULL AND scale_min IS NOT NULL AND scale_max IS NOT NULL AND unit_code IS NULL AND value_date IS NULL AND value_text IS NULL AND scale_min < scale_max AND value_num >= scale_min AND value_num <= scale_max\n    WHEN 'categorical' THEN value_text IS NOT NULL AND unit_code IS NULL AND value_num IS NULL AND value_date IS NULL AND scale_min IS NULL AND scale_max IS NULL AND btrim(value_text) <> ''\n    ELSE false\nEND", name='ck_aa_measurements_value_shape'),
    sa.CheckConstraint("occurred_tz <> ''", name='ck_aa_measurements_occurred_tz'),
    sa.CheckConstraint("original_recorded_at_known OR source_kind = 'IMPORTED'", name='ck_aa_measurements_recorded_at_known'),
    sa.CheckConstraint("source_kind IN ('OBSERVED', 'USER_REPORTED', 'IMPORTED', 'DERIVED', 'ESTIMATED', 'FORECAST', 'UNKNOWN')", name='ck_aa_measurements_source_kind'),
    sa.CheckConstraint("status <> 'active' OR (superseded_at IS NULL AND superseded_by_id IS NULL)", name='ck_aa_measurements_active_not_superseded'),
    sa.CheckConstraint("status <> 'superseded' OR superseded_at IS NOT NULL", name='ck_aa_measurements_superseded_has_timestamp'),
    sa.CheckConstraint("status <> 'superseded' OR superseded_by_id IS NOT NULL", name='ck_aa_measurements_superseded_has_successor'),
    sa.CheckConstraint("status <> 'tombstoned' OR tombstoned_at IS NOT NULL", name='ck_aa_measurements_tombstoned_has_timestamp'),
    sa.CheckConstraint("status IN ('active', 'superseded', 'tombstoned')", name='ck_aa_measurements_status'),
    sa.CheckConstraint("supersede_kind IS NULL OR supersede_kind IN ('CORRECTION', 'REVISION')", name='ck_aa_measurements_supersede_kind'),
    sa.CheckConstraint("value_type IN ('money', 'date', 'duration', 'count', 'scale', 'categorical')", name='ck_aa_measurements_value_type'),
    sa.CheckConstraint('superseded_by_id <> id', name='ck_aa_measurements_no_self_successor'),
    sa.CheckConstraint('supersedes_id <> id', name='ck_aa_measurements_no_self_supersedes'),
    sa.ForeignKeyConstraint(['metric_key'], ['aa_metric_definitions.metric_key'], ),
    sa.ForeignKeyConstraint(['superseded_by_id'], ['aa_measurements.id'], ),
    sa.ForeignKeyConstraint(['supersedes_id'], ['aa_measurements.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('supersedes_id', name='uq_aa_measurements_supersedes_id'),
    sa.UniqueConstraint('user_id', 'idempotency_key', name='uq_aa_measurements_idempotency_key')
    )
    op.create_index('ix_aa_measurements_active_user_subject_occurred_at', 'aa_measurements', ['user_id', 'subject_key', 'occurred_at'], unique=False, postgresql_where=sa.text("status = 'active'"))
    op.create_index('ix_aa_measurements_user_metric_occurred_at', 'aa_measurements', ['user_id', 'metric_key', sa.literal_column('occurred_at DESC')], unique=False)
    op.create_index('ix_aa_measurements_user_recorded_at', 'aa_measurements', ['user_id', sa.literal_column('recorded_at DESC')], unique=False)
    op.create_index('ix_aa_measurements_user_subject_occurred_at', 'aa_measurements', ['user_id', 'subject_key', sa.literal_column('occurred_at DESC')], unique=False)
    op.create_table('aa_source_coverage',
    sa.Column('source_id', sa.Text(), nullable=False),
    sa.Column('metric_key', sa.Text(), nullable=True),
    sa.Column('window_start_date', sa.Date(), nullable=False),
    sa.Column('window_end_date', sa.Date(), nullable=False),
    sa.Column('timezone', sa.Text(), nullable=False),
    sa.Column('coverage_state', sa.Text(), nullable=False),
    sa.Column('completeness_known', sa.Boolean(), nullable=False),
    sa.Column('observed_units', sa.Integer(), nullable=True),
    sa.Column('expected_units', sa.Integer(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('subject_domain', sa.Text(), nullable=False),
    sa.Column('subject_type', sa.Text(), nullable=False),
    sa.Column('subject_id', sa.Text(), server_default=sa.text("''"), nullable=False),
    sa.Column('subject_key', sa.Text(), sa.Computed("subject_domain || ':' || subject_type || ':' || subject_id", persisted=True), nullable=False),
    sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('source_kind', sa.Text(), nullable=False),
    sa.Column('basis', sa.Text(), nullable=True),
    sa.Column('method', sa.Text(), nullable=True),
    sa.Column('source_ref', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('original_recorded_at_known', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('superseded_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('supersede_kind', sa.Text(), nullable=True),
    sa.Column('supersede_reason', sa.Text(), nullable=True),
    sa.Column('status', sa.Text(), server_default=sa.text("'active'"), nullable=False),
    sa.Column('tombstoned_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('supersedes_id', sa.UUID(), nullable=True),
    sa.Column('superseded_by_id', sa.UUID(), nullable=True),
    sa.Column('idempotency_key', sa.Text(), nullable=False),
    sa.CheckConstraint("(coverage_state = 'partial') = (observed_units IS NOT NULL AND expected_units IS NOT NULL)", name='ck_aa_source_coverage_partial_units'),
    sa.CheckConstraint("NOT completeness_known OR coverage_state <> 'unknown'", name='ck_aa_source_coverage_unknown_not_known'),
    sa.CheckConstraint("coverage_state IN ('complete', 'partial', 'none', 'unknown')", name='ck_aa_source_coverage_coverage_state'),
    sa.CheckConstraint("original_recorded_at_known OR source_kind = 'IMPORTED'", name='ck_aa_source_coverage_recorded_at_known'),
    sa.CheckConstraint("source_id <> ''", name='ck_aa_source_coverage_source_id'),
    sa.CheckConstraint("source_kind IN ('OBSERVED', 'USER_REPORTED', 'IMPORTED', 'DERIVED', 'ESTIMATED', 'FORECAST', 'UNKNOWN')", name='ck_aa_source_coverage_source_kind'),
    sa.CheckConstraint("status <> 'active' OR (superseded_at IS NULL AND superseded_by_id IS NULL)", name='ck_aa_source_coverage_active_not_superseded'),
    sa.CheckConstraint("status <> 'superseded' OR superseded_at IS NOT NULL", name='ck_aa_source_coverage_superseded_has_timestamp'),
    sa.CheckConstraint("status <> 'superseded' OR superseded_by_id IS NOT NULL", name='ck_aa_source_coverage_superseded_has_successor'),
    sa.CheckConstraint("status <> 'tombstoned' OR tombstoned_at IS NOT NULL", name='ck_aa_source_coverage_tombstoned_has_timestamp'),
    sa.CheckConstraint("status IN ('active', 'superseded', 'tombstoned')", name='ck_aa_source_coverage_status'),
    sa.CheckConstraint("supersede_kind IS NULL OR supersede_kind IN ('CORRECTION', 'REVISION')", name='ck_aa_source_coverage_supersede_kind'),
    sa.CheckConstraint("timezone <> ''", name='ck_aa_source_coverage_timezone'),
    sa.CheckConstraint('observed_units IS NULL OR (observed_units >= 0 AND observed_units <= expected_units)', name='ck_aa_source_coverage_units_range'),
    sa.CheckConstraint('superseded_by_id <> id', name='ck_aa_source_coverage_no_self_successor'),
    sa.CheckConstraint('supersedes_id <> id', name='ck_aa_source_coverage_no_self_supersedes'),
    sa.CheckConstraint('window_end_date >= window_start_date', name='ck_aa_source_coverage_window_order'),
    sa.ForeignKeyConstraint(['metric_key'], ['aa_metric_definitions.metric_key'], ),
    sa.ForeignKeyConstraint(['superseded_by_id'], ['aa_source_coverage.id'], ),
    sa.ForeignKeyConstraint(['supersedes_id'], ['aa_source_coverage.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('supersedes_id', name='uq_aa_source_coverage_supersedes_id'),
    sa.UniqueConstraint('user_id', 'idempotency_key', name='uq_aa_source_coverage_idempotency_key')
    )
    op.create_index('ix_aa_source_coverage_active_user_subject_window', 'aa_source_coverage', ['user_id', 'subject_key', 'window_start_date', 'window_end_date'], unique=False, postgresql_where=sa.text("status = 'active'"))
    op.create_index('ix_aa_source_coverage_user_recorded_at', 'aa_source_coverage', ['user_id', sa.literal_column('recorded_at DESC')], unique=False)

    op.bulk_insert(_metric_definitions_table(), METRIC_CATALOGUE_V1)


def downgrade() -> None:
    op.drop_index('ix_aa_source_coverage_user_recorded_at', table_name='aa_source_coverage')
    op.drop_index('ix_aa_source_coverage_active_user_subject_window', table_name='aa_source_coverage', postgresql_where=sa.text("status = 'active'"))
    op.drop_table('aa_source_coverage')
    op.drop_index('ix_aa_measurements_user_subject_occurred_at', table_name='aa_measurements')
    op.drop_index('ix_aa_measurements_user_recorded_at', table_name='aa_measurements')
    op.drop_index('ix_aa_measurements_user_metric_occurred_at', table_name='aa_measurements')
    op.drop_index('ix_aa_measurements_active_user_subject_occurred_at', table_name='aa_measurements', postgresql_where=sa.text("status = 'active'"))
    op.drop_table('aa_measurements')
    op.drop_table('aa_metric_definitions')
