"""Account export: bounded-memory NDJSON serialization into a temporary ZIP.

One repeatable-read transaction prevents torn correction chains. Rows stream
from PostgreSQL in batches; the archive is disk-backed, never a history-sized
BytesIO/list. The file is closed on completion or disconnect. Secrets are excluded.

Plaintext on the server's disk (recorded, not changed in S2): the archive is an
anonymous ``tempfile.TemporaryFile`` holding the account's snapshot and analytics
rows in plaintext until the download ends. On POSIX it is unlinked at creation,
so no path remains, but its blocks stay in the temp filesystem until reused.
Decrypted documents are therefore *not* added here; they use the streamed,
file-less export in ``services/documents/export.py``.
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
    AABaseline,
    AACrossReference,
    AADecision,
    AADeletionReceipt,
    AAExpectationVersion,
    AAExperiment,
    AAExperimentAdherence,
    AAExperimentObservation,
    AAFinanceContext,
    AAForecastVersion,
    AAImportanceRating,
    AAMeasurement,
    AAMetricDefinition,
    AAMetricMembershipOverride,
    AAMetricPolicyVersion,
    AAObservation,
    AAPreference,
    AARelationFeedback,
    AARetentionPolicy,
    AARetentionRun,
    AAReview,
    AAReviewContextItem,
    AAReviewContextSource,
    AAReviewFactor,
    AAReviewRevision,
    AASignalEpisode,
    AASourceCoverage,
    AASystemReviewRevision,
    AATarget,
    AccountInvitation,
    AuthAuditEvent,
    Base,
    Document,
    DocumentVersion,
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
    "aa_expectation_versions": AAExpectationVersion.__table__,
    "aa_forecast_versions": AAForecastVersion.__table__,
    "aa_baselines": AABaseline.__table__,
    "aa_targets": AATarget.__table__,
    "aa_preferences": AAPreference.__table__,
    "aa_observations": AAObservation.__table__,
    "aa_metric_policy_versions": AAMetricPolicyVersion.__table__,
    "aa_metric_membership_overrides": AAMetricMembershipOverride.__table__,
    # Episode state is personal data — the user's own acknowledgements — so it
    # leaves with an account export like any fact.
    "aa_signal_episodes": AASignalEpisode.__table__,
    # Reviews: frozen evidence (with redaction markers, never erased values),
    # its source links, and everything the user wrote.
    "aa_reviews": AAReview.__table__,
    "aa_review_revisions": AAReviewRevision.__table__,
    "aa_review_context_items": AAReviewContextItem.__table__,
    "aa_review_context_sources": AAReviewContextSource.__table__,
    "aa_review_factors": AAReviewFactor.__table__,
    "aa_decisions": AADecision.__table__,
    # Experiments: the claim and lifecycle, every adherence row (superseded
    # corrections included) and every outcome/context observation. Experiment
    # decisions and factors leave through aa_decisions / aa_review_factors,
    # every revision included.
    "aa_experiments": AAExperiment.__table__,
    "aa_experiment_adherence": AAExperimentAdherence.__table__,
    "aa_experiment_observations": AAExperimentObservation.__table__,
    # System Review (Slice 7): every importance rating (superseded included), every
    # relation with every answer the user gave, every version of the finance
    # context the user entered, and every saved review revision exactly as stored
    # (redaction markers, never erased values).
    "aa_importance_ratings": AAImportanceRating.__table__,
    "aa_cross_references": AACrossReference.__table__,
    "aa_relation_feedback": AARelationFeedback.__table__,
    "aa_finance_contexts": AAFinanceContext.__table__,
    "aa_system_review_revisions": AASystemReviewRevision.__table__,
    # Retention (Slice 8): every policy version the user chose and one audit row
    # per Apply — counts and horizons only, never a deleted value.
    "aa_retention_policies": AARetentionPolicy.__table__,
    "aa_retention_runs": AARetentionRun.__table__,
}


# JENKIN S2 documents. The account export (a server temporary file) carries only
# their readable operational metadata; titles, notes, file names and contents
# are decrypted only by the explicit, streamed GET /api/v1/export/documents.
DOCUMENT_TABLES = frozenset({"documents", "document_versions", "document_blobs"})
DOCUMENT_EXPORT_NOTE = (
    "Readable document metadata only. Titles, notes, original file names and file "
    "contents are encrypted at rest and are exported, decrypted, only by the explicit "
    "documents export (GET /api/v1/export/documents → jenkin-documents.zip). Ciphertext, "
    "wrapped data keys and wrapping-key ids are never exported."
)


def validate_export_registry() -> None:
    mapped = {name for name in Base.metadata.tables if name.startswith("aa_")}
    if mapped != set(EXPORT_TABLES):
        raise RuntimeError("AA export registry does not cover the mapped AA schema")
    documents = {name for name in Base.metadata.tables if name.startswith("document")}
    if documents != DOCUMENT_TABLES:
        raise RuntimeError("document export registry does not cover the mapped document schema")
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
            actual_documents = set(
                db.scalars(
                    text(
                        "SELECT table_name FROM information_schema.tables "
                        "WHERE table_schema = 'public' AND table_name LIKE 'document%'"
                    )
                )
            )
            if actual_documents != DOCUMENT_TABLES:
                raise RuntimeError("document export registry does not cover the database schema")
            statements = {
                "account": select(
                    User.id, User.email, User.is_active, User.role, User.email_verified_at,
                    User.password_changed_at, User.created_at, User.updated_at,
                ).where(User.id == user_id),
                "sessions": select(
                    UserSession.id,
                    UserSession.user_id,
                    UserSession.created_at,
                    UserSession.last_seen_at,
                    UserSession.expires_at,
                    UserSession.device_label,
                ).where(UserSession.user_id == user_id),
                # JENKIN S1: the account's own security history and the
                # invitations it issued — never token digests.
                "auth_audit_events": select(
                    AuthAuditEvent.id,
                    AuthAuditEvent.occurred_at,
                    AuthAuditEvent.event,
                    AuthAuditEvent.session_id,
                    AuthAuditEvent.network,
                    AuthAuditEvent.device_label,
                    AuthAuditEvent.details,
                ).where(AuthAuditEvent.user_id == user_id).order_by(AuthAuditEvent.id),
                "account_invitations": select(
                    AccountInvitation.id,
                    AccountInvitation.email,
                    AccountInvitation.created_at,
                    AccountInvitation.expires_at,
                    AccountInvitation.accepted_at,
                    AccountInvitation.revoked_at,
                    AccountInvitation.delivery,
                ).where(AccountInvitation.invited_by == user_id).order_by(AccountInvitation.created_at),
                "user_snapshots": select(UserSnapshot.__table__).where(
                    UserSnapshot.user_id == user_id
                ),
                # JENKIN S2: readable columns only (see DOCUMENT_EXPORT_NOTE).
                "documents": select(
                    Document.id,
                    Document.revision,
                    Document.current_version,
                    Document.created_at,
                    Document.updated_at,
                ).where(Document.user_id == user_id).order_by(Document.created_at, Document.id),
                "document_versions": select(
                    DocumentVersion.id,
                    DocumentVersion.document_id,
                    DocumentVersion.version_number,
                    DocumentVersion.content_type,
                    DocumentVersion.size_bytes,
                    DocumentVersion.created_at,
                ).where(DocumentVersion.user_id == user_id).order_by(
                    DocumentVersion.document_id, DocumentVersion.version_number
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
                    "documents": DOCUMENT_EXPORT_NOTE,
                    "semantics": {
                        "all_statuses": True,
                        "correction_links": ["supersedes_id", "superseded_by_id"],
                        "numeric_encoding": "decimal string",
                        "missing_measurement": "no row",
                        "coverage": "explicit source evidence, not transaction presence",
                        "excluded_secrets": [
                            "password_hash",
                            "session token/hash",
                            "reset/verification/invitation token digests",
                            "login throttle counters",
                            "document ciphertext, wrapped data keys and wrapping-key ids",
                        ],
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
