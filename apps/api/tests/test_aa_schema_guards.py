"""Structural guards.

These tests exist because the failure modes they cover are silent. A table left
out of the test cleanup list makes the suite order-dependent months later; an
enum value the database rejects fails only when a user first uses it; a value
constraint that lives only in Python is bypassed by any direct write.
"""

import re
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError

from app.analytics.enums import (
    CoverageState,
    FactStatus,
    SourceKind,
    SupersedeKind,
    ValueType,
    members,
)
from app.models import Base
from tests.conftest import SEEDED_TABLES, TRUNCATED_TABLES

AA_TABLES = ("aa_metric_definitions", "aa_measurements", "aa_source_coverage")

QUOTED = re.compile(r"'([^']*)'")


def constraint_definition(engine: Engine, name: str) -> str:
    with engine.begin() as connection:
        definition = connection.execute(
            text("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = :name"),
            {"name": name},
        ).scalar_one_or_none()
    assert definition is not None, f"constraint {name} is missing from the database"
    return definition


def test_every_mapped_table_is_either_cleaned_or_seeded() -> None:
    # The guard the plan calls for: a future migration cannot add a table
    # without deciding, explicitly, whether tests must clean it.
    mapped = set(Base.metadata.tables)
    accounted = set(TRUNCATED_TABLES) | set(SEEDED_TABLES)
    assert mapped - accounted == set(), (
        "these tables are neither truncated between tests nor declared as seed data: "
        f"{sorted(mapped - accounted)}"
    )


def test_the_truncate_list_names_only_real_tables() -> None:
    assert set(TRUNCATED_TABLES) <= set(Base.metadata.tables)


def test_every_analytics_table_is_cleaned_between_tests() -> None:
    per_test_state = set(AA_TABLES) - set(SEEDED_TABLES)
    assert per_test_state <= set(TRUNCATED_TABLES)


def test_all_analytics_tables_exist_with_a_cascade_from_users(engine: Engine) -> None:
    with engine.begin() as connection:
        present = {
            row[0]
            for row in connection.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name LIKE 'aa\\_%'"
                )
            )
        }
        cascading = {
            row[0]
            for row in connection.execute(
                text(
                    "SELECT DISTINCT tc.table_name FROM information_schema.table_constraints tc "
                    "JOIN information_schema.referential_constraints rc "
                    "  ON tc.constraint_name = rc.constraint_name "
                    "JOIN information_schema.constraint_column_usage ccu "
                    "  ON rc.unique_constraint_name = ccu.constraint_name "
                    "WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users' "
                    "  AND rc.delete_rule = 'CASCADE'"
                )
            )
        }
    assert set(AA_TABLES) <= present
    # The metric catalogue is reference data and is not account-owned.
    assert {"aa_measurements", "aa_source_coverage"} <= cascading


@pytest.mark.parametrize(
    ("constraint", "enum_cls"),
    [
        ("ck_aa_measurements_value_type", ValueType),
        ("ck_aa_measurements_source_kind", SourceKind),
        ("ck_aa_measurements_status", FactStatus),
        ("ck_aa_measurements_supersede_kind", SupersedeKind),
        ("ck_aa_source_coverage_source_kind", SourceKind),
        ("ck_aa_source_coverage_status", FactStatus),
        ("ck_aa_source_coverage_coverage_state", CoverageState),
        ("ck_aa_metric_definitions_value_type", ValueType),
    ],
)
def test_enum_members_match_their_database_constraint(
    engine: Engine, constraint: str, enum_cls: type
) -> None:
    definition = constraint_definition(engine, constraint)
    assert set(QUOTED.findall(definition)) == set(members(enum_cls))


def test_the_value_type_enum_admits_no_unknown(engine: Engine) -> None:
    # C5 at the schema level: even a direct SQL write cannot spell "unknown".
    definition = constraint_definition(engine, "ck_aa_measurements_value_type")
    assert "unknown" not in QUOTED.findall(definition)


def insert_measurement(engine: Engine, user_id: object, **columns: object) -> None:
    values: dict[str, object] = {
        "id": uuid4(),
        "user_id": user_id,
        "metric_key": "finance.transaction_amount",
        "subject_domain": "finance",
        "subject_type": "transaction",
        "subject_id": "guard",
        "value_type": "money",
        "unit_code": "UAH",
        "value_num": Decimal("10"),
        "value_date": None,
        "value_text": None,
        "scale_min": None,
        "scale_max": None,
        "occurred_at": datetime(2026, 8, 14, 10, 0, tzinfo=UTC),
        "occurred_tz": "Europe/Kyiv",
        "recorded_at": datetime(2026, 8, 14, 10, 0, tzinfo=UTC),
        "source_kind": "USER_REPORTED",
        "original_recorded_at_known": True,
        "status": "active",
        "idempotency_key": f"guard-{uuid4()}",
    }
    values.update(columns)
    column_names = ", ".join(values)
    placeholders = ", ".join(f":{name}" for name in values)
    with engine.begin() as connection:
        connection.execute(
            text(f"INSERT INTO aa_measurements ({column_names}) VALUES ({placeholders})"),
            values,
        )


@pytest.mark.parametrize(
    "columns",
    [
        pytest.param({"unit_code": None}, id="money-without-currency"),
        pytest.param({"unit_code": "uah"}, id="money-with-lowercase-currency"),
        pytest.param({"value_text": "also text"}, id="money-with-a-second-value-column"),
        pytest.param(
            {"value_type": "count", "unit_code": None, "value_num": None},
            id="count-without-a-number",
        ),
        pytest.param(
            {"value_type": "duration", "unit_code": "hour"}, id="duration-in-a-foreign-unit"
        ),
        pytest.param(
            {
                "value_type": "scale",
                "unit_code": None,
                "value_num": Decimal("11"),
                "scale_min": Decimal("1"),
                "scale_max": Decimal("10"),
            },
            id="scale-outside-its-bounds",
        ),
        pytest.param({"value_type": "unknown"}, id="the-unknown-value-type-c5"),
    ],
)
def test_the_database_rejects_illegal_value_shapes(
    engine: Engine, account_factory, columns: dict[str, object]
) -> None:
    account = account_factory("guard-values@example.com")
    with pytest.raises(IntegrityError):
        insert_measurement(engine, account.user_id, **columns)


def test_the_database_rejects_an_empty_value_used_to_mean_unknown(
    engine: Engine, account_factory
) -> None:
    # C5: "record that we do not know" has no representation as a Measurement.
    account = account_factory("guard-empty@example.com")
    with pytest.raises(IntegrityError):
        insert_measurement(
            engine,
            account.user_id,
            unit_code=None,
            value_num=None,
            value_date=None,
            value_text=None,
        )


def test_a_superseded_row_must_name_its_successor(engine: Engine, account_factory) -> None:
    account = account_factory("guard-supersede@example.com")
    with pytest.raises(IntegrityError):
        insert_measurement(
            engine,
            account.user_id,
            status="superseded",
            superseded_at=datetime(2026, 8, 15, tzinfo=UTC),
        )


def test_an_active_row_cannot_carry_supersession_timestamps(
    engine: Engine, account_factory
) -> None:
    account = account_factory("guard-active@example.com")
    with pytest.raises(IntegrityError):
        insert_measurement(
            engine,
            account.user_id,
            status="active",
            superseded_at=datetime(2026, 8, 15, tzinfo=UTC),
        )


def test_only_imported_records_may_disclaim_their_recording_time(
    engine: Engine, account_factory
) -> None:
    account = account_factory("guard-import@example.com")
    with pytest.raises(IntegrityError):
        insert_measurement(
            engine,
            account.user_id,
            source_kind="USER_REPORTED",
            original_recorded_at_known=False,
        )
    insert_measurement(
        engine,
        account.user_id,
        source_kind="IMPORTED",
        original_recorded_at_known=False,
    )


def test_one_idempotency_key_per_account(engine: Engine, account_factory) -> None:
    account = account_factory("guard-idem@example.com")
    insert_measurement(engine, account.user_id, idempotency_key="guard-duplicate")
    with pytest.raises(IntegrityError):
        insert_measurement(engine, account.user_id, idempotency_key="guard-duplicate")


def test_a_row_can_have_only_one_successor(engine: Engine, account_factory) -> None:
    account = account_factory("guard-successor@example.com")
    predecessor = uuid4()
    insert_measurement(engine, account.user_id, id=predecessor)
    insert_measurement(engine, account.user_id, supersedes_id=predecessor)
    with pytest.raises(IntegrityError):
        insert_measurement(engine, account.user_id, supersedes_id=predecessor)


def test_a_row_cannot_supersede_itself(engine: Engine, account_factory) -> None:
    account = account_factory("guard-self@example.com")
    fact_id = uuid4()
    with pytest.raises(IntegrityError):
        insert_measurement(engine, account.user_id, id=fact_id, supersedes_id=fact_id)


def test_a_coverage_claim_cannot_claim_completeness_it_does_not_have(
    engine: Engine, account_factory
) -> None:
    account = account_factory("guard-coverage@example.com")
    with engine.begin() as connection, pytest.raises(IntegrityError):
        connection.execute(
            text(
                "INSERT INTO aa_source_coverage (id, user_id, source_id, subject_domain,"
                " subject_type, subject_id, window_start_date, window_end_date, timezone,"
                " coverage_state, completeness_known, source_kind, status, idempotency_key)"
                " VALUES (:id, :user_id, 'manual', 'finance', 'period', '2026-08',"
                " '2026-08-01', '2026-08-31', 'Europe/Kyiv', 'unknown', true,"
                " 'USER_REPORTED', 'active', :key)"
            ),
            {"id": uuid4(), "user_id": account.user_id, "key": f"guard-{uuid4()}"},
        )


def test_the_snapshot_schema_version_is_untouched_by_analytics(engine: Engine) -> None:
    # AA adds tables; it never alters the snapshot contract.
    with engine.begin() as connection:
        columns = {
            row[0]
            for row in connection.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'user_snapshots'"
                )
            )
        }
    assert columns == {
        "user_id",
        "schema_version",
        "revision",
        "payload",
        "created_at",
        "updated_at",
    }
