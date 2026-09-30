"""Set-based provenance redaction for retention (F2, Plan §6 step 6).

``aa_deletion._references`` decides per fact whether an untyped ``source_ref``
names an erased id (a case-folded substring match of the canonical UUID, or a
string that parses as that UUID). Doing that per pruned id over every row of the
account is O(pruned × provenance). Here the same question is answered once per
table with a hash join:

1. lower-case ``source_ref::text`` (keys and values, as ``_references`` walks both);
2. extract every run of ``[0-9a-f-]`` at least 32 characters long;
3. drop the hyphens and slide a 32-character window across the run;
4. join the windows against the pruned ids' 32-hex form.

Every case ``_references`` matches produces such a window (a canonical UUID is a
hex/hyphen run; ``UUID()`` accepts hyphen-free, braced, ``urn:uuid:`` and
mixed-case spellings, all of which reduce to the same 32 hex digits inside one
run), so this is **at least as conservative**: it may also erase a payload that
merely contains the 32 digits inside a longer hex run. Proven by
``test_aa_retention_redaction.py``.
"""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import AAExperimentAdherence
from app.services.aa_deletion import FACT_TABLES

# Every table carrying the provenance grammar. Adherence is not in FACT_TABLES
# (it is never hard-deleted singly) but it carries ``source_ref`` too.
PROVENANCE_TABLES: tuple[str, ...] = (
    *sorted(FACT_TABLES),
    AAExperimentAdherence.__tablename__,
)


def provenance_hits(db: Session, *, user_id: UUID, pruned: list[UUID]) -> dict[str, list[UUID]]:
    """``{table: [row id]}`` of surviving rows whose provenance names a pruned id."""
    if not pruned:
        return {}
    hexes = sorted({identity.hex for identity in pruned})
    doomed = set(pruned)
    hits: dict[str, list[UUID]] = {}
    for table in PROVENANCE_TABLES:
        rows = db.scalars(
            text(
                f"""
                WITH pruned AS (SELECT unnest(CAST(:hexes AS text[])) AS hex)
                SELECT DISTINCT t.id
                  FROM {table} t
                 CROSS JOIN LATERAL regexp_matches(
                       lower(t.source_ref::text), '[0-9a-f-]{{32,}}', 'g') AS m(tok)
                 CROSS JOIN LATERAL (SELECT replace(m.tok[1], '-', '') AS h) AS s
                 CROSS JOIN LATERAL generate_series(1, length(s.h) - 31) AS g(i)
                  JOIN pruned ON pruned.hex = substr(s.h, g.i, 32)
                 WHERE t.user_id = :user_id AND t.source_ref IS NOT NULL
                """
            ),
            {"user_id": user_id, "hexes": hexes},
        )
        survivors = sorted(identity for identity in rows if identity not in doomed)
        if survivors:
            hits[table] = survivors
    return hits


def redact_provenance(db: Session, *, user_id: UUID, hits: dict[str, list[UUID]]) -> int:
    """Erase ``source_ref`` / ``basis`` / ``method`` of the hit rows. Never commits."""
    total = 0
    for table, ids in hits.items():
        total += db.execute(
            text(
                f"UPDATE {table} SET source_ref = NULL, basis = NULL, method = NULL"
                " WHERE user_id = :user_id AND id = ANY(CAST(:ids AS uuid[]))"
            ),
            {"user_id": user_id, "ids": ids},
        ).rowcount
    return total
