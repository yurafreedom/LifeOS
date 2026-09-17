"""Account export: bounded-memory NDJSON serialization into a temporary ZIP.

One repeatable-read transaction prevents torn correction chains. Rows stream
from PostgreSQL in batches; the archive is disk-backed, never a history-sized
BytesIO/list. The file is closed on completion or disconnect. Secrets are excluded.
"""

import json
import logging
import tempfile
import time
import zipfile
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import BinaryIO
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.orm import Session, sessionmaker

from app.models import (
    AADeletionReceipt,
    AAMeasurement,
    AAMetricDefinition,
    AASourceCoverage,
    Base,
    User,
    UserSession,
    UserSnapshot,
)

logger = logging.getLogger(__name__)

EXPORT_TABLES = {
    "aa_metric_definitions": AAMetricDefinition.__table__,
    "aa_measurements": AAMeasurement.__table__,
    "aa_source_coverage": AASourceCoverage.__table__,
    "aa_deletion_receipts": AADeletionReceipt.__table__,
}


def validate_export_registry() -> None:
    mapped = {name for name in Base.metadata.tables if name.startswith("aa_")}
    if mapped != set(EXPORT_TABLES):
        raise RuntimeError("AA export registry does not cover the mapped AA schema")
    for name, table in EXPORT_TABLES.items():
        if table is not Base.metadata.tables[name]:
            raise RuntimeError("AA export registry table mismatch")


def _json_default(value: object) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (UUID, Decimal)):
        return str(value)
    raise TypeError(f"Unsupported export type: {type(value).__name__}")


def encode_json(value: object) -> bytes:
    return json.dumps(
        value, default=_json_default, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def build_account_export(factory: sessionmaker[Session], *, user_id: UUID) -> BinaryIO:
    validate_export_registry()
    started = time.monotonic()
    archive = tempfile.TemporaryFile(mode="w+b")
    counts: dict[str, int] = {}
    try:
        with factory() as db:
            db.connection(execution_options={"isolation_level": "REPEATABLE READ"})
            db.execute(text("SET TRANSACTION READ ONLY"))
            actual_tables = set(
                db.scalars(
                    text(
                        "SELECT table_name FROM information_schema.tables "
                        "WHERE table_schema = 'public' AND table_name LIKE 'aa\\_%'"
                    )
                )
            )
            if actual_tables != set(EXPORT_TABLES):
                raise RuntimeError("AA export registry does not cover the database AA schema")
            statements = {
                "account": select(
                    User.id, User.email, User.is_active, User.created_at, User.updated_at
                ).where(User.id == user_id),
                "sessions": select(
                    UserSession.id,
                    UserSession.user_id,
                    UserSession.created_at,
                    UserSession.last_seen_at,
                    UserSession.expires_at,
                ).where(UserSession.user_id == user_id),
                "user_snapshots": select(UserSnapshot.__table__).where(
                    UserSnapshot.user_id == user_id
                ),
            }
            for name, table in EXPORT_TABLES.items():
                statement = select(table)
                if "user_id" in table.c:
                    statement = statement.where(table.c.user_id == user_id)
                statements[name] = statement.order_by(*table.primary_key.columns)
            with zipfile.ZipFile(
                archive, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True
            ) as zipped:
                for name, statement in statements.items():
                    counts[name] = 0
                    with zipped.open(f"{name}.ndjson", "w", force_zip64=True) as member:
                        result = db.execute(statement.execution_options(yield_per=200))
                        try:
                            for row in result.mappings():
                                member.write(encode_json(dict(row)) + b"\n")
                                counts[name] += 1
                        finally:
                            result.close()
                manifest = {
                    "format": "lifeos-account-export",
                    "format_version": 1,
                    "snapshot_schema_version": 2,
                    "alembic_revision": db.scalar(text("SELECT version_num FROM alembic_version")),
                    "exported_at": datetime.now(UTC),
                    "user_id": user_id,
                    "tables": {
                        name: {"file": f"{name}.ndjson", "rows": count}
                        for name, count in counts.items()
                    },
                    "aa_columns": {
                        name: [
                            {"name": c.name, "type": str(c.type), "nullable": c.nullable}
                            for c in table.c
                        ]
                        for name, table in EXPORT_TABLES.items()
                    },
                    "semantics": {
                        "all_statuses": True,
                        "correction_links": ["supersedes_id", "superseded_by_id"],
                        "numeric_encoding": "decimal string",
                        "missing_measurement": "no row",
                        "coverage": "explicit source evidence, not transaction presence",
                        "excluded_secrets": ["password_hash", "session token/hash"],
                    },
                }
                zipped.writestr("manifest.json", encode_json(manifest))
        archive.seek(0)
        logger.info(
            "account.export",
            extra={
                "account_id": str(user_id),
                "row_counts": counts,
                "duration_seconds": time.monotonic() - started,
            },
        )
        return archive
    except BaseException:
        archive.close()
        raise


def stream_archive(archive: BinaryIO):
    try:
        while chunk := archive.read(64 * 1024):
            yield chunk
    finally:
        archive.close()
