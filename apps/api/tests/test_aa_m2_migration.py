"""C8: destructive round-trip is tested only on empty, disposable history."""

from pathlib import Path

from alembic.config import Config
from sqlalchemy import inspect, text

from alembic import command


def protected_schema(engine):
    inspector = inspect(engine)
    return {
        name: {
            "columns": [
                (c["name"], str(c["type"]), c["nullable"], c["default"])
                for c in inspector.get_columns(name)
            ],
            "checks": inspector.get_check_constraints(name),
            "fks": inspector.get_foreign_keys(name),
            "pk": inspector.get_pk_constraint(name),
            "indexes": inspector.get_indexes(name),
        }
        for name in ("users", "sessions", "user_snapshots")
    }


def test_m2_empty_disposable_roundtrip_preserves_pre_aa_schema(engine, test_database_url):
    with engine.connect() as connection:
        original_head = connection.scalar(text("SELECT version_num FROM alembic_version"))
    with engine.begin() as connection:
        for name in ("aa_measurements", "aa_source_coverage", "aa_deletion_receipts"):
            assert connection.scalar(text(f"SELECT count(*) FROM {name}")) == 0
    before = protected_schema(engine)
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", test_database_url)
    command.downgrade(config, "20260909_0002")
    try:
        assert "aa_deletion_receipts" not in inspect(engine).get_table_names()
        assert protected_schema(engine) == before
        with engine.begin() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM alembic_version"))
                == "20260909_0002"
            )
    finally:
        command.upgrade(config, original_head)
    assert protected_schema(engine) == before
    with engine.begin() as connection:
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == original_head
    assert "aa_deletion_receipts" in inspect(engine).get_table_names()
