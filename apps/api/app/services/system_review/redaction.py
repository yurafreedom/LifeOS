"""D1 hard-erasure adapters for Slice 7 (registered in ``aa_deletion.SOURCE_REDACTORS``
through the ``app.services.aa_system_review`` facade).

Each runs inside the hard-delete transaction of a fact (or of a finance-context
entity the user deleted). None commits, none logs content, and none leaves a
link to the erased id behind. User-authored content — a saved reflection, its
decisions and adjustments, a relation's note and status — survives: it has no
source link, and D1 says hard erasure wins only over *source-derived* values.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Text, cast, delete, or_, select
from sqlalchemy.orm import Session

from app.analytics.enums import RedactionReason
from app.models import AACrossReference, AAImportanceRating, AASystemReviewRevision
from app.services.system_review.refs import REDACTED, embeds


def _item_uses(item: dict[str, Any], table: str, identity: str) -> bool:
    return any(
        isinstance(source, list) and len(source) == 2 and source[0] == table
        and source[1] == identity
        for source in item.get("sources", ())
    )


def _redact_items(value: Any, table: str, identity: str) -> tuple[Any, bool]:
    """Walk a frozen context; replace every item derived from the source."""
    if isinstance(value, dict):
        if "sources" in value and _item_uses(value, table, identity):
            return {
                "ordinal": value.get("ordinal"),
                "section": value.get("section"),
                "kind": value.get("kind"),
                "redacted": True,
                "redaction_reason": str(RedactionReason.SOURCE_HARD_DELETED),
            }, True
        changed = False
        out: dict[str, Any] = {}
        for key, inner in value.items():
            out[key], hit = _redact_items(inner, table, identity)
            changed |= hit
        return out, changed
    if isinstance(value, list):
        changed = False
        out_list = []
        for inner in value:
            redacted, hit = _redact_items(inner, table, identity)
            out_list.append(redacted)
            changed |= hit
        return out_list, changed
    return value, False


def redact_system_review_sources(
    db: Session, user_id: UUID, table_name: str, fact_id: UUID
) -> None:
    """Erase every frozen revision item derived from ``(table_name, fact_id)``."""
    revisions = db.scalars(
        select(AASystemReviewRevision)
        .where(
            AASystemReviewRevision.user_id == user_id,
            AASystemReviewRevision.source_ids.any(fact_id),
        )
        .with_for_update()
    ).all()
    identity = str(fact_id)
    now = datetime.now(UTC)
    for revision in revisions:
        frozen, changed = _redact_items(revision.frozen_context, table_name, identity)
        if changed:
            revision.frozen_context = frozen
            revision.redacted_at = now
        # The id leaves the manifest either way: no link to the erased row survives.
        revision.source_ids = [value for value in revision.source_ids if value != fact_id]
    db.flush()


def _redact_evidence(evidence: list[Any], table: str, identity: UUID) -> tuple[list[Any], bool]:
    changed = False
    out = []
    for entry in evidence or []:
        if isinstance(entry, dict) and embeds(entry.get("ref"), table, identity):
            out.append({"ref": REDACTED, "role": entry.get("role")})
            changed = True
        else:
            out.append(entry)
    return out, changed


def redact_relation_endpoints(
    db: Session, user_id: UUID, table_name: str, fact_id: UUID
) -> None:
    """Replace endpoints / evidence refs naming the erased row with ``redacted``."""
    needle = f"%{fact_id}%"
    rows = db.scalars(
        select(AACrossReference)
        .where(
            AACrossReference.user_id == user_id,
            or_(
                AACrossReference.from_key.like(needle),
                AACrossReference.to_key.like(needle),
                cast(AACrossReference.evidence, Text).like(needle),
            ),
        )
        .with_for_update()
    ).all()
    now = datetime.now(UTC)
    for row in rows:
        touched = False
        if embeds(row.from_key, table_name, fact_id):
            row.from_key = REDACTED
            touched = True
        if embeds(row.to_key, table_name, fact_id):
            row.to_key = REDACTED
            touched = True
        evidence, hit = _redact_evidence(row.evidence, table_name, fact_id)
        if hit:
            row.evidence = evidence
            touched = True
        if touched:
            row.endpoint_redacted_at = row.endpoint_redacted_at or now
    db.flush()


def erase_importance_for_source(
    db: Session, user_id: UUID, table_name: str, fact_id: UUID
) -> None:
    """A rating of an erased item says nothing any more; it leaves with the item."""
    rows = db.scalars(
        select(AAImportanceRating).where(
            AAImportanceRating.user_id == user_id,
            AAImportanceRating.target_key.like(f"%{fact_id}%"),
        )
    ).all()
    doomed = [row.id for row in rows if embeds(row.target_key, table_name, fact_id)]
    if doomed:
        # Break the supersession chain inside the doomed set before deleting it.
        for row in rows:
            if row.id in doomed:
                row.supersedes_id = None
        db.flush()
        db.execute(
            delete(AAImportanceRating)
            .where(AAImportanceRating.user_id == user_id, AAImportanceRating.id.in_(doomed))
            .execution_options(synchronize_session=False)
        )
    db.flush()


SLICE_7_REDACTORS = (
    redact_system_review_sources,
    redact_relation_endpoints,
    erase_importance_for_source,
)
