"""M6: first-class Experiments (plan §24.9, owner decision D4).

Three new tables — ``aa_experiments`` (state), ``aa_experiment_adherence`` and
``aa_experiment_observations`` (facts) — and two scope widenings:

* ``aa_decisions`` gains ``experiment_id`` and ``idempotency_key``. The single
  union choice CHECK is replaced by two scope-dependent CHECKs, so a Review can
  never store ``modify/longer/reject`` and an Experiment never ``adjust/later``.
* ``aa_review_factors`` gains ``scope`` (DEFAULT ``'review'``, so existing
  Review writers are untouched) and ``experiment_id``; ``review_id`` becomes
  nullable under an exactly-one-parent CHECK.

Every existing row is review-scoped with ``review_id`` set and no key, and so
satisfies every new CHECK. No pre-AA table is touched; ``user_snapshots`` keeps
``schema_version = 2``.

Downgrade destroys personal Experiment history: use ONLY on disposable or
pre-write environments. Once experiment writes are enabled in production, roll
back behaviour and the write gate, never this schema (correction C8).
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "20260929_0007"
down_revision = "20260928_0006"
branch_labels = None
depends_on = None

# Frozen M6 SQL, intentionally independent of future ORM/enum/helper changes.
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
LIFECYCLES = "('DRAFT', 'RUNNING', 'COMPLETED_AWAITING_REVIEW', 'REVIEWED', 'ABANDONED')"
ABANDONABLE = "('DRAFT', 'RUNNING', 'COMPLETED_AWAITING_REVIEW')"
OUTCOME_TYPES = "('money', 'duration', 'count', 'scale')"
PARENT = (
    "(scope = 'review' AND review_id IS NOT NULL AND experiment_id IS NULL)"
    " OR (scope = 'experiment' AND experiment_id IS NOT NULL AND review_id IS NULL)"
)
# The exact M5 decision constraints, recreated by downgrade.
M5_DECISION_SCOPE = "scope IN ('review')"
M5_DECISION_REVIEW_SCOPE = "scope <> 'review' OR review_id IS NOT NULL"
M5_DECISION_CHOICE = "choice IS NULL OR choice IN ('keep', 'adjust', 'later', 'inconclusive')"


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


def _experiment_fk():
    return sa.Column(
        "experiment_id",
        sa.UUID(),
        sa.ForeignKey("aa_experiments.id", ondelete="CASCADE"),
        nullable=False,
    )


def _fact(name):
    """Provenance, supersession and idempotency columns plus the shared integrity set."""
    columns = [
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
        "source_kind": "source_kind IN ('OBSERVED', 'USER_REPORTED', 'IMPORTED', 'DERIVED',"
        " 'ESTIMATED', 'FORECAST', 'UNKNOWN')",
        "status": "status IN ('active', 'superseded', 'tombstoned')",
        "supersede_kind": "supersede_kind IS NULL OR supersede_kind IN ('CORRECTION', 'REVISION')",
        "superseded_has_successor": "status <> 'superseded' OR superseded_by_id IS NOT NULL",
        "superseded_has_timestamp": "status <> 'superseded' OR superseded_at IS NOT NULL",
        "active_not_superseded": "status <> 'active'"
        " OR (superseded_at IS NULL AND superseded_by_id IS NULL)",
        "tombstoned_has_timestamp": "status <> 'tombstoned' OR tombstoned_at IS NOT NULL",
        "no_self_supersedes": "supersedes_id <> id",
        "no_self_successor": "superseded_by_id <> id",
        "recorded_at_known": "original_recorded_at_known OR source_kind = 'IMPORTED'",
    }
    columns += [
        sa.CheckConstraint(sql, name=f"ck_{name}_{suffix}") for suffix, sql in checks.items()
    ]
    return columns


def upgrade():
    op.create_table(
        "aa_experiments",
        *_owned(),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("hypothesis", sa.Text(), nullable=False),
        sa.Column("hypothesis_recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("intervention", sa.Text(), nullable=False),
        sa.Column("window_start", sa.Date(), nullable=False),
        sa.Column("window_end", sa.Date(), nullable=False),
        sa.Column("timezone", sa.Text(), nullable=False),
        sa.Column("outcome_label", sa.Text(), nullable=False),
        sa.Column("outcome_value_type", sa.Text(), nullable=False),
        sa.Column("outcome_unit_code", sa.Text()),
        sa.Column("outcome_scale_min", sa.Numeric(20, 6)),
        sa.Column("outcome_scale_max", sa.Numeric(20, 6)),
        sa.Column("lifecycle", sa.Text(), server_default=sa.text("'DRAFT'"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("start_key", sa.Text()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("complete_key", sa.Text()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("review_key", sa.Text()),
        sa.Column("abandoned_at", sa.DateTime(timezone=True)),
        sa.Column("abandon_key", sa.Text()),
        sa.Column("abandoned_from", sa.Text()),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "btrim(title) <> '' AND char_length(title) <= 200", name="ck_aa_experiments_title"
        ),
        sa.CheckConstraint(
            "btrim(hypothesis) <> '' AND char_length(hypothesis) <= 1000",
            name="ck_aa_experiments_hypothesis",
        ),
        sa.CheckConstraint(
            "btrim(intervention) <> '' AND char_length(intervention) <= 1000",
            name="ck_aa_experiments_intervention",
        ),
        sa.CheckConstraint("window_end >= window_start", name="ck_aa_experiments_window_order"),
        sa.CheckConstraint(
            "window_end - window_start <= 365", name="ck_aa_experiments_window_length"
        ),
        sa.CheckConstraint("timezone <> ''", name="ck_aa_experiments_timezone"),
        sa.CheckConstraint(
            "btrim(outcome_label) <> '' AND char_length(outcome_label) <= 200",
            name="ck_aa_experiments_outcome_label",
        ),
        sa.CheckConstraint(
            f"outcome_value_type IN {OUTCOME_TYPES}", name="ck_aa_experiments_outcome_value_type"
        ),
        sa.CheckConstraint(
            "CASE outcome_value_type"
            " WHEN 'money' THEN outcome_unit_code ~ '^[A-Z]{3}$'"
            " AND outcome_scale_min IS NULL AND outcome_scale_max IS NULL"
            " WHEN 'duration' THEN outcome_unit_code = 'minute'"
            " AND outcome_scale_min IS NULL AND outcome_scale_max IS NULL"
            " WHEN 'count' THEN outcome_unit_code IS NULL"
            " AND outcome_scale_min IS NULL AND outcome_scale_max IS NULL"
            " WHEN 'scale' THEN outcome_unit_code IS NULL"
            " AND outcome_scale_min IS NOT NULL AND outcome_scale_max IS NOT NULL"
            " AND outcome_scale_min < outcome_scale_max"
            " ELSE false END",
            name="ck_aa_experiments_outcome_shape",
        ),
        sa.CheckConstraint(f"lifecycle IN {LIFECYCLES}", name="ck_aa_experiments_lifecycle"),
        sa.CheckConstraint(
            "CASE lifecycle"
            " WHEN 'DRAFT' THEN started_at IS NULL AND completed_at IS NULL"
            " AND reviewed_at IS NULL AND abandoned_at IS NULL"
            " WHEN 'RUNNING' THEN started_at IS NOT NULL AND completed_at IS NULL"
            " AND reviewed_at IS NULL AND abandoned_at IS NULL"
            " WHEN 'COMPLETED_AWAITING_REVIEW' THEN started_at IS NOT NULL"
            " AND completed_at IS NOT NULL AND reviewed_at IS NULL AND abandoned_at IS NULL"
            " WHEN 'REVIEWED' THEN started_at IS NOT NULL AND completed_at IS NOT NULL"
            " AND reviewed_at IS NOT NULL AND abandoned_at IS NULL"
            " WHEN 'ABANDONED' THEN abandoned_at IS NOT NULL AND reviewed_at IS NULL"
            " ELSE false END",
            name="ck_aa_experiments_lifecycle_shape",
        ),
        sa.CheckConstraint(
            f"abandoned_from IS NULL OR abandoned_from IN {ABANDONABLE}",
            name="ck_aa_experiments_abandoned_from",
        ),
        sa.CheckConstraint(
            "abandoned_from IS NULL"
            " OR (abandoned_from = 'DRAFT' AND started_at IS NULL AND completed_at IS NULL)"
            " OR (abandoned_from = 'RUNNING' AND started_at IS NOT NULL AND completed_at IS NULL)"
            " OR (abandoned_from = 'COMPLETED_AWAITING_REVIEW' AND started_at IS NOT NULL"
            " AND completed_at IS NOT NULL)",
            name="ck_aa_experiments_abandon_shape",
        ),
        sa.CheckConstraint(
            "(started_at IS NULL) = (start_key IS NULL)", name="ck_aa_experiments_start_pair"
        ),
        sa.CheckConstraint(
            "(completed_at IS NULL) = (complete_key IS NULL)",
            name="ck_aa_experiments_complete_pair",
        ),
        sa.CheckConstraint(
            "(reviewed_at IS NULL) = (review_key IS NULL)", name="ck_aa_experiments_review_pair"
        ),
        sa.CheckConstraint(
            "(abandoned_at IS NULL) = (abandon_key IS NULL)"
            " AND (abandoned_at IS NULL) = (abandoned_from IS NULL)",
            name="ck_aa_experiments_abandon_pair",
        ),
        sa.CheckConstraint(
            "(started_at IS NULL OR started_at >= hypothesis_recorded_at)"
            " AND (completed_at IS NULL OR completed_at >= started_at)"
            " AND (reviewed_at IS NULL OR reviewed_at >= completed_at)"
            " AND (abandoned_at IS NULL"
            " OR abandoned_at >= COALESCE(completed_at, started_at, hypothesis_recorded_at))",
            name="ck_aa_experiments_instant_order",
        ),
        sa.UniqueConstraint(
            "user_id", "idempotency_key", name="uq_aa_experiments_idempotency_key"
        ),
        sa.UniqueConstraint("user_id", "start_key", name="uq_aa_experiments_start_key"),
        sa.UniqueConstraint("user_id", "complete_key", name="uq_aa_experiments_complete_key"),
        sa.UniqueConstraint("user_id", "review_key", name="uq_aa_experiments_review_key"),
        sa.UniqueConstraint("user_id", "abandon_key", name="uq_aa_experiments_abandon_key"),
    )
    op.create_index("ix_aa_experiments_user_lifecycle", "aa_experiments", ["user_id", "lifecycle"])
    op.create_index("ix_aa_experiments_user_created", "aa_experiments", ["user_id", "created_at"])

    name = "aa_experiment_adherence"
    op.create_table(
        name,
        *_owned(),
        *_fact(name),
        _experiment_fk(),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("state", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "state IN ('kept', 'missed', 'unknown')", name="ck_aa_experiment_adherence_state"
        ),
        sa.CheckConstraint(
            "supersede_kind IS NULL OR supersede_kind = 'CORRECTION'",
            name="ck_aa_experiment_adherence_correction_only",
        ),
    )
    op.create_index(f"ix_{name}_user_recorded_at", name, ["user_id", sa.text("recorded_at DESC")])
    op.create_index(
        "uq_aa_experiment_adherence_active_day",
        name,
        ["experiment_id", "day"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_index("ix_aa_experiment_adherence_experiment_day", name, ["experiment_id", "day"])

    name = "aa_experiment_observations"
    op.create_table(
        name,
        *_owned(),
        *_fact(name),
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
        sa.Column("metric_key", sa.Text(), sa.ForeignKey("aa_metric_definitions.metric_key")),
        sa.Column("value_type", sa.Text(), nullable=False),
        sa.Column("unit_code", sa.Text()),
        sa.Column("value_num", sa.Numeric(20, 6)),
        sa.Column("value_date", sa.Date()),
        sa.Column("value_text", sa.Text()),
        sa.Column("scale_min", sa.Numeric(20, 6)),
        sa.Column("scale_max", sa.Numeric(20, 6)),
        sa.Column("dimensions", JSONB()),
        _experiment_fk(),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("occurred_tz", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "value_type IN ('money', 'date', 'duration', 'count', 'scale', 'categorical')",
            name=f"ck_{name}_value_type",
        ),
        sa.CheckConstraint(
            f"((status = 'tombstoned') AND {EMPTY_VALUE})"
            f" OR (NOT (status = 'tombstoned') AND ({VALUE_SHAPE}))",
            name=f"ck_{name}_value_shape",
        ),
        sa.CheckConstraint("role IN ('outcome', 'context')", name=f"ck_{name}_role"),
        sa.CheckConstraint(
            "btrim(label) <> '' AND char_length(label) <= 200", name=f"ck_{name}_label"
        ),
        sa.CheckConstraint("occurred_tz <> ''", name=f"ck_{name}_occurred_tz"),
        sa.CheckConstraint(
            "subject_domain = 'experiment' AND subject_type = 'experiment'"
            " AND subject_id = experiment_id::text",
            name=f"ck_{name}_subject",
        ),
        sa.CheckConstraint("metric_key IS NULL", name=f"ck_{name}_metric_key"),
        sa.CheckConstraint(
            f"role <> 'outcome' OR value_type IN {OUTCOME_TYPES}",
            name=f"ck_{name}_outcome_comparable",
        ),
    )
    op.create_index(f"ix_{name}_user_recorded_at", name, ["user_id", sa.text("recorded_at DESC")])
    op.create_index(
        f"ix_{name}_user_subject_recorded", name, ["user_id", "subject_key", "recorded_at"]
    )
    op.create_index(
        "ix_aa_experiment_observations_experiment", name, ["experiment_id", "role", "occurred_at"]
    )

    # ── aa_decisions: experiment scope with its own vocabulary and replay key ──
    op.add_column(
        "aa_decisions",
        sa.Column(
            "experiment_id",
            sa.UUID(),
            sa.ForeignKey("aa_experiments.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.add_column("aa_decisions", sa.Column("idempotency_key", sa.Text(), nullable=True))
    op.drop_constraint("ck_aa_decisions_scope", "aa_decisions", type_="check")
    op.create_check_constraint(
        "ck_aa_decisions_scope", "aa_decisions", "scope IN ('review', 'experiment')"
    )
    op.drop_constraint("ck_aa_decisions_review_scope", "aa_decisions", type_="check")
    op.create_check_constraint("ck_aa_decisions_parent", "aa_decisions", PARENT)
    op.drop_constraint("ck_aa_decisions_choice", "aa_decisions", type_="check")
    op.create_check_constraint(
        "ck_aa_decisions_review_choice",
        "aa_decisions",
        "scope <> 'review' OR choice IS NULL"
        " OR choice IN ('keep', 'adjust', 'later', 'inconclusive')",
    )
    op.create_check_constraint(
        "ck_aa_decisions_experiment_choice",
        "aa_decisions",
        "scope <> 'experiment' OR choice IS NULL"
        " OR choice IN ('keep', 'modify', 'longer', 'reject', 'inconclusive')",
    )
    op.create_check_constraint(
        "ck_aa_decisions_idempotency",
        "aa_decisions",
        "(scope = 'experiment') = (idempotency_key IS NOT NULL)",
    )
    op.create_unique_constraint(
        "uq_aa_decisions_idempotency_key", "aa_decisions", ["user_id", "idempotency_key"]
    )
    op.create_index(
        "uq_aa_decisions_current_experiment",
        "aa_decisions",
        ["experiment_id"],
        unique=True,
        postgresql_where=sa.text("superseded_in_revision IS NULL AND experiment_id IS NOT NULL"),
    )
    op.create_index(
        "uq_aa_decisions_experiment_revision",
        "aa_decisions",
        ["experiment_id", "revision"],
        unique=True,
        postgresql_where=sa.text("experiment_id IS NOT NULL"),
    )

    # ── aa_review_factors: factor seam A (widen, never a fourth factor table) ──
    op.add_column(
        "aa_review_factors",
        sa.Column("scope", sa.Text(), server_default=sa.text("'review'"), nullable=False),
    )
    op.add_column(
        "aa_review_factors",
        sa.Column(
            "experiment_id",
            sa.UUID(),
            sa.ForeignKey("aa_experiments.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.alter_column("aa_review_factors", "review_id", nullable=True)
    op.create_check_constraint(
        "ck_aa_review_factors_scope", "aa_review_factors", "scope IN ('review', 'experiment')"
    )
    op.create_check_constraint("ck_aa_review_factors_parent", "aa_review_factors", PARENT)
    op.create_index(
        "uq_aa_review_factors_experiment_ordinal",
        "aa_review_factors",
        ["experiment_id", "ordinal"],
        unique=True,
        postgresql_where=sa.text("experiment_id IS NOT NULL"),
    )


def downgrade():
    # Experiment-scoped decisions and factors cannot satisfy the M5 constraints;
    # like dropping the experiment tables, this destroys experiment history.
    op.execute("DELETE FROM aa_review_factors WHERE scope = 'experiment'")
    op.execute("DELETE FROM aa_decisions WHERE scope = 'experiment'")

    op.drop_index("uq_aa_review_factors_experiment_ordinal", table_name="aa_review_factors")
    op.drop_constraint("ck_aa_review_factors_parent", "aa_review_factors", type_="check")
    op.drop_constraint("ck_aa_review_factors_scope", "aa_review_factors", type_="check")
    op.alter_column("aa_review_factors", "review_id", nullable=False)
    op.drop_column("aa_review_factors", "experiment_id")
    op.drop_column("aa_review_factors", "scope")

    op.drop_index("uq_aa_decisions_experiment_revision", table_name="aa_decisions")
    op.drop_index("uq_aa_decisions_current_experiment", table_name="aa_decisions")
    op.drop_constraint("uq_aa_decisions_idempotency_key", "aa_decisions", type_="unique")
    op.drop_constraint("ck_aa_decisions_idempotency", "aa_decisions", type_="check")
    op.drop_constraint("ck_aa_decisions_experiment_choice", "aa_decisions", type_="check")
    op.drop_constraint("ck_aa_decisions_review_choice", "aa_decisions", type_="check")
    op.drop_constraint("ck_aa_decisions_parent", "aa_decisions", type_="check")
    op.create_check_constraint("ck_aa_decisions_choice", "aa_decisions", M5_DECISION_CHOICE)
    op.create_check_constraint(
        "ck_aa_decisions_review_scope", "aa_decisions", M5_DECISION_REVIEW_SCOPE
    )
    op.drop_constraint("ck_aa_decisions_scope", "aa_decisions", type_="check")
    op.create_check_constraint("ck_aa_decisions_scope", "aa_decisions", M5_DECISION_SCOPE)
    op.drop_column("aa_decisions", "idempotency_key")
    op.drop_column("aa_decisions", "experiment_id")

    op.drop_table("aa_experiment_observations")
    op.drop_table("aa_experiment_adherence")
    op.drop_table("aa_experiments")
