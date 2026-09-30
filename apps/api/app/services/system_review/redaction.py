"""D1 hard-erasure adapters for Slice 7 (registered in ``aa_deletion.SOURCE_REDACTORS``
through the ``app.services.aa_system_review`` facade).

Each runs inside the hard-delete transaction of a fact (or of a finance-context
entity the user deleted). None commits, none logs content, and none leaves a
link to the erased id behind. User-authored content — a saved reflection, its
decisions and adjustments, a relation's note and status — survives: it has no
source link, and D1 says hard erasure wins only over *source-derived* values.
"""

from collections.abc import Collection
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Text, cast, delete, or_, select
from sqlalchemy.orm import Session

from app.analytics.enums import RedactionReason
from app.models import AACrossReference, AAImportanceRating, AASystemReviewRevision
from app.services.system_review.errors import InvalidRefError
from app.services.system_review.refs import REDACTED, RefKind, embeds, parse_ref

# ``(table, str(id))`` pairs — the shape frozen items store their sources in.
SourceSet = Collection[tuple[str, str]]


def _item_uses(item: dict[str, Any], sources: SourceSet) -> bool:
    return any(
        isinstance(source, list) and len(source) == 2 and (source[0], source[1]) in sources
        for source in item.get("sources", ())
    )


def _walk(value: Any, sources: SourceSet, reason: RedactionReason) -> tuple[Any, int]:
    """Walk a frozen context; replace every item derived from any source in the set.

    Returns the new value and how many items were redacted.
    """
    if isinstance(value, dict):
        if "sources" in value and _item_uses(value, sources):
            return {
                "ordinal": value.get("ordinal"),
                "section": value.get("section"),
                "kind": value.get("kind"),
                "redacted": True,
                "redaction_reason": str(reason),
            }, 1
        hits = 0
        out: dict[str, Any] = {}
        for key, inner in value.items():
            out[key], hit = _walk(inner, sources, reason)
            hits += hit
        return out, hits
    if isinstance(value, list):
        hits = 0
        out_list = []
        for inner in value:
            redacted, hit = _walk(inner, sources, reason)
            out_list.append(redacted)
            hits += hit
        return out_list, hits
    return value, 0


def _redact_items(value: Any, table: str, identity: str) -> tuple[Any, bool]:
    """Walk a frozen context; replace every item derived from the source."""
    redacted, hits = _walk(value, {(table, identity)}, RedactionReason.SOURCE_HARD_DELETED)
    return redacted, bool(hits)


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


# ───────────── set-based variants for Slice 8 retention (one call per Apply) ─────────────


def _fact_source(key: str | None) -> tuple[str, str] | None:
    """``(table, id)`` a ref key names when it is a fact ref, else ``None``."""
    if not key or key == REDACTED:
        return None
    try:
        ref = parse_ref(key)
    except InvalidRefError:
        return None
    if ref.kind != RefKind.FACT or ref.identity is None:
        return None
    return ref.table or "", str(ref.identity)


def system_review_revisions_for(db: Session, user_id: UUID, ids: list[UUID]) -> list[UUID]:
    """Saved revisions whose manifest names any id (GIN ``source_ids`` overlap)."""
    if not ids:
        return []
    return sorted(
        db.scalars(
            select(AASystemReviewRevision.id).where(
                AASystemReviewRevision.user_id == user_id,
                AASystemReviewRevision.source_ids.overlap(ids),
            )
        )
    )


def redact_system_review_sources_bulk(
    db: Session,
    user_id: UUID,
    revision_ids: list[UUID],
    sources: SourceSet,
    reason: RedactionReason,
) -> int:
    """Redact every frozen item derived from any source; ids leave ``source_ids``.

    Reflection, decisions and adjustments are user-authored and untouched.
    Returns the number of frozen items redacted.
    """
    if not revision_ids:
        return 0
    identities = {identity for _, identity in sources}
    now = datetime.now(UTC)
    redacted = 0
    for revision in db.scalars(
        select(AASystemReviewRevision)
        .where(
            AASystemReviewRevision.user_id == user_id,
            AASystemReviewRevision.id.in_(revision_ids),
        )
        .with_for_update()
    ):
        frozen, hits = _walk(revision.frozen_context, sources, reason)
        if hits:
            revision.frozen_context = frozen
            revision.redacted_at = now
            redacted += hits
        revision.source_ids = [
            value for value in revision.source_ids if str(value) not in identities
        ]
    db.flush()
    return redacted


def _relation_hits(row: AACrossReference, sources: SourceSet) -> bool:
    if _fact_source(row.from_key) in sources or _fact_source(row.to_key) in sources:
        return True
    return any(
        isinstance(entry, dict) and _fact_source(entry.get("ref")) in sources
        for entry in row.evidence or []
    )


def relations_for(db: Session, user_id: UUID, sources: SourceSet) -> list[UUID]:
    """Relations whose endpoints/evidence name a source. Bounded by the account's
    relations that carry a fact ref at all; membership is a set lookup."""
    if not sources:
        return []
    rows = db.scalars(
        select(AACrossReference).where(
            AACrossReference.user_id == user_id,
            or_(
                AACrossReference.from_key.like("fact|%"),
                AACrossReference.to_key.like("fact|%"),
                cast(AACrossReference.evidence, Text).like('%"fact|%'),
            ),
        )
    )
    return sorted(row.id for row in rows if _relation_hits(row, sources))


def redact_relation_endpoints_bulk(
    db: Session, user_id: UUID, relation_ids: list[UUID], sources: SourceSet
) -> int:
    """Replace endpoints / evidence refs naming any source with ``redacted``.

    The relation's type, status and the user's note survive (user-authored).
    """
    if not relation_ids:
        return 0
    now = datetime.now(UTC)
    touched = 0
    for row in db.scalars(
        select(AACrossReference)
        .where(AACrossReference.user_id == user_id, AACrossReference.id.in_(relation_ids))
        .with_for_update()
    ):
        hit = False
        if _fact_source(row.from_key) in sources:
            row.from_key = REDACTED
            hit = True
        if _fact_source(row.to_key) in sources:
            row.to_key = REDACTED
            hit = True
        evidence = []
        for entry in row.evidence or []:
            if isinstance(entry, dict) and _fact_source(entry.get("ref")) in sources:
                evidence.append({"ref": REDACTED, "role": entry.get("role")})
                hit = True
            else:
                evidence.append(entry)
        if hit:
            row.evidence = evidence
            row.endpoint_redacted_at = row.endpoint_redacted_at or now
            touched += 1
    db.flush()
    return touched


def importance_for(db: Session, user_id: UUID, sources: SourceSet) -> list[UUID]:
    if not sources:
        return []
    rows = db.execute(
        select(AAImportanceRating.id, AAImportanceRating.target_key).where(
            AAImportanceRating.user_id == user_id,
            AAImportanceRating.target_key.like("fact|%"),
        )
    )
    return sorted(identity for identity, target in rows if _fact_source(target) in sources)


def erase_importance_bulk(db: Session, user_id: UUID, rating_ids: list[UUID]) -> int:
    """Same semantics as the hard-delete adapter: a rating of an erased item says
    nothing any more and leaves with it (a rating targets one item, so a doomed
    rating's whole supersession chain is doomed with it)."""
    if not rating_ids:
        return 0
    rows = db.scalars(
        select(AAImportanceRating).where(
            AAImportanceRating.user_id == user_id, AAImportanceRating.id.in_(rating_ids)
        )
    ).all()
    for row in rows:
        row.supersedes_id = None
    db.flush()
    erased = db.execute(
        delete(AAImportanceRating)
        .where(AAImportanceRating.user_id == user_id, AAImportanceRating.id.in_(rating_ids))
        .execution_options(synchronize_session=False)
    ).rowcount
    db.flush()
    return erased


SLICE_7_REDACTORS = (
    redact_system_review_sources,
    redact_relation_endpoints,
    erase_importance_for_source,
)
