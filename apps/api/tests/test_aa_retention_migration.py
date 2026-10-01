"""M8 · retention schema: linear head, roundtrip on ``lifeos_test``, registries and
database backstops (R8-02/03/04, R8-73, R8-74, R8-75)."""

import json
import re
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.analytics.enums import (
    RETENTION_MONTHS,
    RedactionReason,
    RetentionMode,
    RetentionPolicyStatus,
    RetentionRunStatus,
    members,
)
from app.models import Base
from app.services.export import EXPORT_TABLES
from tests.conftest import TRUNCATED_TABLES
from tests.test_aa_m2_migration import protected_schema
from tests.test_aa_schema_guards import constraint_definition

M7 = "20260930_0008"
M8 = "20260930_0009"
M8_TABLES = ("aa_retention_policies", "aa_retention_runs")
QUOTED = re.compile(r"'([^']*)'")
SHA = "b" * 64


def _config(test_database_url: str) -> Config:
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", test_database_url)
    return config


def _insert(engine, table: str, **values) -> str:
    values.setdefault("id", str(uuid4()))
    values.setdefault("idempotency_key", f"k-{uuid4()}")
    json_columns = {"table_counts", "unit_counts", "skipped", "pruned_units", "progress"}
    for key in json_columns & set(values):
        values[key] = json.dumps(values[key])
    names = ", ".join(values)
    placeholders = ", ".join(
        f"CAST(:{name} AS jsonb)" if name in json_columns else f":{name}" for name in values
    )
    with engine.begin() as connection:
        connection.execute(text(f"INSERT INTO {table} ({names}) VALUES ({placeholders})"), values)
    return values["id"]


def _policy(engine, user_id, **overrides) -> str:
    values = {
        "user_id": user_id,
        "mode": "finite",
        "retain_months": 36,
        "consequences_version": "retention-consequences-v1",
        "confirmed_at": datetime(2026, 9, 30, tzinfo=UTC),
        "recorded_at": datetime(2026, 9, 30, tzinfo=UTC),
        "status": "active",
    }
    values.update(overrides)
    return _insert(engine, "aa_retention_policies", **values)


def _run(engine, user_id, policy_id, **overrides) -> str:
    values = {
        "user_id": user_id,
        "policy_id": policy_id,
        "retain_months": 36,
        "target_horizon_date": date(2023, 9, 1),
        "timezone": "Europe/Kyiv",
        "engine_version": 1,
        "preview_fingerprint": SHA,
        "status": "completed",
        "started_at": datetime(2026, 9, 30, tzinfo=UTC),
        "completed_at": datetime(2026, 9, 30, tzinfo=UTC),
    }
    values.update(overrides)
    return _insert(engine, "aa_retention_runs", **values)


def _rejects(callable_, *args, **kwargs):
    with pytest.raises(IntegrityError):
        callable_(*args, **kwargs)


# ───────────────────── chain, roundtrip, registries ─────────────────────


def test_m8_sits_on_m7_under_the_m10_head(test_database_url):
    script = ScriptDirectory.from_config(_config(test_database_url))
    assert script.get_heads() == ["20261001_0010"]
    assert script.get_revision("20261001_0010").down_revision == M8
    assert script.get_revision(M8).down_revision == M7


def test_m8_tables_are_mapped_exported_truncated_and_present(engine):
    mapped = {name for name in Base.metadata.tables if name.startswith("aa_")}
    with engine.begin() as connection:
        present = set(
            connection.scalars(
                text(
                    "SELECT table_name FROM information_schema.tables"
                    " WHERE table_schema = 'public' AND table_name LIKE 'aa\\_%'"
                )
            )
        )
    assert set(M8_TABLES) <= mapped
    assert mapped == set(EXPORT_TABLES) == present
    assert len(present) == 29
    assert set(M8_TABLES) <= set(TRUNCATED_TABLES)


def test_m8_roundtrip_drops_only_its_tables_and_restores_m7(
    engine, test_database_url, account_factory
):
    account_factory("m8-roundtrip@example.com")
    config = _config(test_database_url)
    protected = protected_schema(engine)
    earlier = {
        name: [
            (c["name"], str(c["type"]), c["nullable"], c["default"])
            for c in inspect(engine).get_columns(name)
        ]
        for name in inspect(engine).get_table_names()
        if name.startswith("aa_") and name not in M8_TABLES
    }
    command.downgrade(config, M7)
    try:
        remaining = set(inspect(engine).get_table_names())
        assert not set(M8_TABLES) & remaining
        assert protected_schema(engine) == protected
        assert "'source_retention_pruned'" not in constraint_definition(
            engine, "ck_aa_review_context_items_redaction_reason"
        )
        with engine.begin() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == M7
    finally:
        command.upgrade(config, "head")
    assert set(M8_TABLES) <= set(inspect(engine).get_table_names())
    for name, columns in earlier.items():
        assert columns == [
            (c["name"], str(c["type"]), c["nullable"], c["default"])
            for c in inspect(engine).get_columns(name)
        ]


@pytest.mark.parametrize(
    ("constraint", "enum_cls"),
    [
        ("ck_aa_retention_policies_mode", RetentionMode),
        ("ck_aa_retention_policies_status", RetentionPolicyStatus),
        ("ck_aa_retention_runs_status", RetentionRunStatus),
        ("ck_aa_review_context_items_redaction_reason", RedactionReason),
    ],
)
def test_m8_enum_members_match_their_database_constraint(engine, constraint, enum_cls):
    assert set(QUOTED.findall(constraint_definition(engine, constraint))) == set(
        members(enum_cls)
    )


def test_allowed_finite_months_are_exactly_24_36_60_in_code_and_database(engine):
    """R8-02: the owner's O3 list, and nothing shorter than two years."""
    assert set(RETENTION_MONTHS) == {24, 36, 60}
    assert min(RETENTION_MONTHS) == 24
    for name in ("ck_aa_retention_policies_months", "ck_aa_retention_runs_months"):
        assert set(re.findall(r"\d+", constraint_definition(engine, name))) == {"24", "36", "60"}


def test_run_table_has_no_column_that_could_hold_a_deleted_value(engine):
    """R8-17: the audit is counts, horizon and fingerprint — no value columns."""
    names = {column["name"] for column in inspect(engine).get_columns("aa_retention_runs")}
    forbidden = re.compile(r"value|amount|unit_code|note|text|statement|payload|source_ref")
    assert not {name for name in names if forbidden.search(name)}


# ───────────────────── database backstops ─────────────────────


@pytest.mark.parametrize("months", [1, 3, 6, 12, 18, 23, 30, 48, 120])
def test_database_rejects_every_other_duration(engine, account_factory, months):
    """R8-03 / R8-04: 12 months (and any other value) is unrepresentable."""
    owner = account_factory(f"m8-months-{months}@example.com")
    _rejects(_policy, engine, owner.user_id, retain_months=months)


def test_policy_shape_backstops(engine, account_factory):
    owner = account_factory("m8-policy@example.com")
    _rejects(_policy, engine, owner.user_id, mode="unlimited")  # months with unlimited
    _rejects(_policy, engine, owner.user_id, retain_months=None)  # finite without months
    _rejects(_policy, engine, owner.user_id, confirmed_at=None)  # finite unconfirmed
    _rejects(_policy, engine, owner.user_id, consequences_version=None)
    _rejects(_policy, engine, owner.user_id, mode="forever", retain_months=None)
    assert _policy(
        engine, owner.user_id, mode="unlimited", retain_months=None,
        consequences_version=None, confirmed_at=None,
    )
    # One active policy per account.
    _rejects(_policy, engine, owner.user_id)


def test_run_shape_backstops(engine, account_factory):
    owner = account_factory("m8-run@example.com")
    policy = _policy(engine, owner.user_id)
    _rejects(_run, engine, owner.user_id, policy, completed_at=None)
    _rejects(_run, engine, owner.user_id, policy, status="failed", completed_at=None)
    _rejects(
        _run, engine, owner.user_id, policy, status="failed", completed_at=None,
        failed_at=datetime(2026, 9, 30, tzinfo=UTC), failure_code="Boom", total_deleted=3,
    )
    _rejects(_run, engine, owner.user_id, policy, preview_fingerprint="not-a-sha")
    _rejects(_run, engine, owner.user_id, policy, retain_months=12)
    _rejects(_run, engine, owner.user_id, policy, total_deleted=-1)
    _rejects(_run, engine, owner.user_id, policy, table_counts=[1])
    assert _run(
        engine, owner.user_id, policy, status="failed", completed_at=None,
        failed_at=datetime(2026, 9, 30, tzinfo=UTC), failure_code="OperationalError",
    )
    assert _run(engine, owner.user_id, policy, table_counts={"aa_measurements": 3})


def test_account_deletion_removes_policies_and_runs(engine, account_factory):
    """R8-57: users CASCADE removes both tables (runs → policies is NO ACTION)."""
    owner = account_factory("m8-delete@example.com")
    other = account_factory("m8-keep@example.com")
    for account in (owner, other):
        policy = _policy(engine, account.user_id)
        _run(engine, account.user_id, policy)
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM users WHERE id = :id"), {"id": owner.user_id})
        for table in M8_TABLES:
            assert connection.scalar(
                text(f"SELECT count(*) FROM {table} WHERE user_id = :id"), {"id": owner.user_id}
            ) == 0
            assert connection.scalar(
                text(f"SELECT count(*) FROM {table} WHERE user_id = :id"), {"id": other.user_id}
            ) == 1
