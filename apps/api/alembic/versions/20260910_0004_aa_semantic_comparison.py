"""M3: separate semantic comparison facts and historical membership (C7).

Additive: no pre-AA or Slice 0/0b table is altered. Downgrade destroys these
eight tables: use ONLY on disposable/empty history. After personal history is
collected, roll back behaviour/write gate, not schema (C8).
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "20260910_0004"
down_revision = "20260909_0003"
branch_labels = None
depends_on = None

TABLES = (
    "aa_expectation_versions",
    "aa_forecast_versions",
    "aa_baselines",
    "aa_targets",
    "aa_preferences",
    "aa_observations",
    "aa_metric_policy_versions",
    "aa_metric_membership_overrides",
)

# Frozen M3 SQL, intentionally independent of future ORM/enum/helper changes.
SHAPE = """CASE value_type
 WHEN 'money' THEN value_num IS NOT NULL AND unit_code ~ '^[A-Z]{3}$'
   AND unit_code IS NOT NULL AND value_date IS NULL AND value_text IS NULL
   AND scale_min IS NULL AND scale_max IS NULL
 WHEN 'date' THEN value_date IS NOT NULL AND value_num IS NULL AND unit_code IS NULL
   AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL
 WHEN 'duration' THEN value_num IS NOT NULL AND unit_code = 'minute'
   AND unit_code IS NOT NULL AND value_date IS NULL AND value_text IS NULL
   AND scale_min IS NULL AND scale_max IS NULL
 WHEN 'count' THEN value_num IS NOT NULL AND unit_code IS NULL AND value_date IS NULL
   AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL
 WHEN 'scale' THEN value_num IS NOT NULL AND scale_min IS NOT NULL AND scale_max IS NOT NULL
   AND unit_code IS NULL AND value_date IS NULL AND value_text IS NULL
   AND scale_min < scale_max AND value_num >= scale_min AND value_num <= scale_max
 WHEN 'categorical' THEN value_text IS NOT NULL AND btrim(value_text) <> ''
   AND value_num IS NULL AND unit_code IS NULL AND value_date IS NULL
   AND scale_min IS NULL AND scale_max IS NULL
 ELSE false END"""
EMPTY = (
    "unit_code IS NULL AND value_num IS NULL AND value_date IS NULL "
    "AND value_text IS NULL AND scale_min IS NULL AND scale_max IS NULL"
)


def _common(name, *, subject=True, valued=True, window=False):
    columns = [
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
        sa.Column(
            "metric_key",
            sa.Text(),
            sa.ForeignKey("aa_metric_definitions.metric_key"),
            nullable=subject,
        ),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("source_kind", sa.Text(), nullable=False),
        sa.Column("basis", sa.Text()),
        sa.Column("method", sa.Text()),
        sa.Column("source_ref", JSONB()),
        sa.Column(
            "original_recorded_at_known",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("supersedes_id", sa.UUID(), sa.ForeignKey(f"{name}.id")),
        sa.Column("superseded_by_id", sa.UUID(), sa.ForeignKey(f"{name}.id")),
        sa.Column("superseded_at", sa.DateTime(timezone=True)),
        sa.Column("supersede_kind", sa.Text()),
        sa.Column("supersede_reason", sa.Text()),
        sa.Column("status", sa.Text(), server_default=sa.text("'active'"), nullable=False),
        sa.Column("tombstoned_at", sa.DateTime(timezone=True)),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.UniqueConstraint("user_id", "idempotency_key", name=f"uq_{name}_idempotency_key"),
        sa.UniqueConstraint("supersedes_id", name=f"uq_{name}_supersedes_id"),
    ]
    checks = {
        "source_kind": "source_kind IN ('OBSERVED', 'USER_REPORTED', 'IMPORTED', 'DERIVED', 'ESTIMATED', 'FORECAST', 'UNKNOWN')",
        "status": "status IN ('active', 'superseded', 'tombstoned')",
        "supersede_kind": "supersede_kind IS NULL OR supersede_kind IN ('CORRECTION', 'REVISION')",
        "superseded_has_successor": "status <> 'superseded' OR superseded_by_id IS NOT NULL",
        "superseded_has_timestamp": "status <> 'superseded' OR superseded_at IS NOT NULL",
        "active_not_superseded": "status <> 'active' OR (superseded_at IS NULL AND superseded_by_id IS NULL)",
        "tombstoned_has_timestamp": "status <> 'tombstoned' OR tombstoned_at IS NOT NULL",
        "no_self_supersedes": "supersedes_id <> id",
        "no_self_successor": "superseded_by_id <> id",
        "recorded_at_known": "original_recorded_at_known OR source_kind = 'IMPORTED'",
    }
    if subject:
        columns += [
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
        ]
    if valued:
        columns += [
            sa.Column("value_type", sa.Text(), nullable=False),
            sa.Column("unit_code", sa.Text()),
            sa.Column("value_num", sa.Numeric(20, 6)),
            sa.Column("value_date", sa.Date()),
            sa.Column("value_text", sa.Text()),
            sa.Column("scale_min", sa.Numeric(20, 6)),
            sa.Column("scale_max", sa.Numeric(20, 6)),
            sa.Column("dimensions", JSONB()),
        ]
        checks["value_type"] = (
            "value_type IN ('money', 'date', 'duration', 'count', 'scale', 'categorical')"
        )
        special = "status = 'tombstoned'"
        if name == "aa_targets":
            special += " OR is_explicitly_absent"
        if name == "aa_observations":
            special += " OR value_availability = 'explicitly_unknown'"
        checks["value_shape"] = f"(({special}) AND {EMPTY}) OR (NOT ({special}) AND ({SHAPE}))"
    if window:
        columns += [
            sa.Column("window_start", sa.Date(), nullable=False),
            sa.Column("window_end", sa.Date(), nullable=False),
            sa.Column("timezone", sa.Text(), nullable=False),
        ]
        checks.update(window_order="window_end >= window_start", timezone="timezone <> ''")
    if name in ("aa_targets", "aa_preferences"):
        columns.append(sa.Column("desired_direction", sa.Text()))
        checks["desired_direction"] = (
            "(desired_direction IS NOT NULL AND desired_direction IN ('higher','lower')) OR (status = 'tombstoned' AND desired_direction IS NULL)"
        )
    columns += [
        sa.CheckConstraint(sql, name=f"ck_{name}_{suffix}") for suffix, sql in checks.items()
    ]
    return columns


def upgrade():
    for name in TABLES:
        subject = name not in TABLES[-2:]
        columns = _common(
            name,
            subject=subject,
            valued=subject and name != "aa_preferences",
            window=name in ("aa_expectation_versions", "aa_baselines", "aa_targets"),
        )
        if name in ("aa_expectation_versions", "aa_preferences", "aa_metric_policy_versions"):
            columns.append(sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False))
        if name == "aa_forecast_versions":
            columns.append(sa.Column("horizon_at", sa.DateTime(timezone=True), nullable=False))
        if name == "aa_targets":
            columns.append(
                sa.Column(
                    "is_explicitly_absent",
                    sa.Boolean(),
                    server_default=sa.text("false"),
                    nullable=False,
                )
            )
        if name == "aa_preferences":
            columns += [
                sa.Column("statement", sa.Text()),
                sa.CheckConstraint(
                    "statement IS NOT NULL OR status = 'tombstoned'", name=f"ck_{name}_statement"
                ),
            ]
        if name == "aa_observations":
            columns += [
                sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
                sa.Column("occurred_tz", sa.Text(), nullable=False),
                sa.Column(
                    "epistemic_kind", sa.Text(), server_default=sa.text("'unknown'"), nullable=False
                ),
                sa.Column(
                    "value_availability",
                    sa.Text(),
                    server_default=sa.text("'present'"),
                    nullable=False,
                ),
                sa.CheckConstraint(
                    "epistemic_kind IN ('observed','mine','maybe','unknown')",
                    name=f"ck_{name}_epistemic_kind",
                ),
                sa.CheckConstraint(
                    "value_availability IN ('present','explicitly_unknown')",
                    name=f"ck_{name}_value_availability",
                ),
                sa.CheckConstraint("occurred_tz <> ''", name=f"ck_{name}_occurred_tz"),
            ]
        if name == "aa_metric_policy_versions":
            columns += [
                sa.Column("policy", JSONB()),
                sa.CheckConstraint(
                    "policy IS NOT NULL OR status = 'tombstoned'", name=f"ck_{name}_policy"
                ),
            ]
        if name == "aa_metric_membership_overrides":
            columns += [
                sa.Column("source_table", sa.Text(), nullable=False),
                sa.Column(
                    "source_fact_id",
                    sa.UUID(),
                    sa.ForeignKey("aa_measurements.id", ondelete="CASCADE"),
                    nullable=False,
                ),
                sa.Column("included", sa.Boolean()),
                sa.CheckConstraint(
                    "source_table = 'aa_measurements'", name=f"ck_{name}_source_table"
                ),
                sa.CheckConstraint(
                    "included IS NOT NULL OR status = 'tombstoned'", name=f"ck_{name}_included"
                ),
            ]
        op.create_table(name, *columns)
        op.create_index(
            f"ix_{name}_user_recorded_at", name, ["user_id", sa.text("recorded_at DESC")]
        )
        if subject:
            op.create_index(
                f"ix_{name}_user_subject_recorded", name, ["user_id", "subject_key", "recorded_at"]
            )
        elif name == "aa_metric_policy_versions":
            op.create_index(
                f"ix_{name}_user_metric_effective",
                name,
                ["user_id", "metric_key", "effective_from"],
            )
        else:
            op.create_index(
                f"ix_{name}_active_user_metric_fact",
                name,
                ["user_id", "metric_key", "source_fact_id"],
                postgresql_where=sa.text("status = 'active'"),
            )
            op.create_index(
                f"ix_{name}_user_metric_fact", name, ["user_id", "metric_key", "source_fact_id"]
            )


def downgrade():
    for name in reversed(TABLES):
        op.drop_table(name)
