"""Which rows a finite retention horizon may erase — whole units only (Plan §3–§4).

Every statement is account-scoped first and set-based: chains are resolved with a
recursive CTE from their roots along ``supersedes_id`` (unique-indexed), and a
chain is a candidate only when **every** member is eligible (``bool_and``). A
chain that straddles the horizon, or holds a version still in force, is kept
whole and counted as skipped. Nothing here writes.

Semantic axes, never ``created_at``:

* measurements, observations — ``occurred_at``;
* coverage — ``window_end_date`` (a straddling window is kept whole);
* expectation / baseline / target — ``window_end``;
* preference / metric policy — strict: no active member and every instant before H;
* forecasts on a project — only as a whole completed Project unit; other forecasts
  by ``recorded_at`` and ``horizon_at``;
* ``experiment`` subjects — never (a retained experiment pins its evidence);
* membership overrides — cascade with their measurement, never selected alone.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

PROJECT_METRIC = "project.completion_date"
_UNIT_DOMAINS = "('project', 'experiment')"
_SCOPED = f"subject_domain NOT IN {_UNIT_DOMAINS}"


@dataclass(frozen=True, slots=True)
class _ChainRule:
    table: str
    touches: str  # a member lies (at least partly) before the horizon
    eligible: str  # the member is wholly before the horizon and prunable
    scope: str | None  # restricts both recursion legs (chain members share a subject)


CHAIN_RULES: tuple[_ChainRule, ...] = (
    _ChainRule("aa_measurements", "t.occurred_at < :h_at", "t.occurred_at < :h_at", _SCOPED),
    _ChainRule(
        "aa_source_coverage",
        "t.window_start_date < :h_date",
        "t.window_end_date < :h_date",
        _SCOPED,
    ),
    _ChainRule(
        "aa_expectation_versions", "t.window_start < :h_date", "t.window_end < :h_date", _SCOPED
    ),
    _ChainRule("aa_baselines", "t.window_start < :h_date", "t.window_end < :h_date", _SCOPED),
    _ChainRule("aa_targets", "t.window_start < :h_date", "t.window_end < :h_date", _SCOPED),
    _ChainRule("aa_observations", "t.occurred_at < :h_at", "t.occurred_at < :h_at", _SCOPED),
    _ChainRule(
        "aa_forecast_versions",
        "t.recorded_at < :h_at",
        "t.recorded_at < :h_at AND t.horizon_at < :h_at",
        _SCOPED,
    ),
    _ChainRule(
        "aa_preferences",
        "t.recorded_at < :h_at",
        "t.status <> 'active' AND t.recorded_at < :h_at AND t.effective_from < :h_at"
        " AND COALESCE(t.superseded_at, t.tombstoned_at) < :h_at",
        _SCOPED,
    ),
    _ChainRule(
        "aa_metric_policy_versions",
        "t.recorded_at < :h_at",
        "t.status <> 'active' AND t.recorded_at < :h_at AND t.effective_from < :h_at"
        " AND COALESCE(t.superseded_at, t.tombstoned_at) < :h_at",
        None,
    ),
)
# Deletion order (Plan §6 step 8). Overrides cascade with measurements.
DELETE_ORDER: tuple[str, ...] = (
    "aa_measurements",
    "aa_source_coverage",
    "aa_expectation_versions",
    "aa_baselines",
    "aa_targets",
    "aa_observations",
    "aa_forecast_versions",
    "aa_preferences",
    "aa_metric_policy_versions",
)
OVERRIDES = "aa_metric_membership_overrides"


@dataclass
class Candidates:
    """The exact rows one horizon would erase, grouped per table."""

    rows: dict[str, list[UUID]] = field(default_factory=dict)
    chains: dict[str, int] = field(default_factory=dict)
    multi_member_chains: int = 0
    skipped: dict[str, int] = field(default_factory=dict)
    project_units: list[str] = field(default_factory=list)
    episode_ids: list[UUID] = field(default_factory=list)
    finance_months: list[str] = field(default_factory=list)

    def fact_sources(self) -> list[tuple[str, UUID]]:
        """Every erased ``(table, id)`` including cascading overrides — the
        redaction set."""
        return [(table, identity) for table in sorted(self.rows) for identity in self.rows[table]]


def _chain_candidates(
    db: Session, rule: _ChainRule, params: dict[str, object]
) -> tuple[list[UUID], int, int, int]:
    """Return ``(ids, candidate chains, multi-member candidate chains, skipped chains)``."""
    scope = f" AND {rule.scope}" if rule.scope else ""
    sql = text(
        f"""
        WITH RECURSIVE chain(id, root) AS (
            SELECT id, id FROM {rule.table}
             WHERE user_id = :user_id AND supersedes_id IS NULL{scope}
            UNION ALL
            SELECT c.id, chain.root FROM {rule.table} c
              JOIN chain ON c.supersedes_id = chain.id
             WHERE c.user_id = :user_id{scope.replace(' AND ', ' AND c.', 1)}
        )
        SELECT array_agg(t.id ORDER BY t.id) AS ids, bool_and({rule.eligible}) AS eligible
          FROM chain JOIN {rule.table} t ON t.id = chain.id
         GROUP BY chain.root
        HAVING bool_or({rule.touches})
        """
    )
    ids: list[UUID] = []
    chains = multi = skipped = 0
    for members, eligible in db.execute(sql, params):
        if eligible:
            ids.extend(members)
            chains += 1
            multi += int(len(members) > 1)
        else:
            skipped += 1
    return ids, chains, multi, skipped


def _project_units(db: Session, params: dict[str, object]) -> tuple[list[str], dict[str, int]]:
    """Whole completed Project units wholly before the horizon.

    Eligible iff a live completion Actual exists, every forecast (``recorded_at``,
    ``horizon_at``), Actual-chain member (``occurred_at``) and project observation
    (``occurred_at``) is before H, and no other table holds a row on the subject.
    Open / Actual-less projects are never eligible.
    """
    sql = text(
        """
        WITH subjects AS (
            SELECT subject_key, subject_id FROM aa_forecast_versions
             WHERE user_id = :user_id AND subject_domain = 'project' AND subject_type = 'project'
            UNION
            SELECT subject_key, subject_id FROM aa_measurements
             WHERE user_id = :user_id AND subject_domain = 'project' AND subject_type = 'project'
            UNION
            SELECT subject_key, subject_id FROM aa_observations
             WHERE user_id = :user_id AND subject_domain = 'project' AND subject_type = 'project'
        )
        SELECT s.subject_id,
               EXISTS (SELECT 1 FROM aa_measurements m
                        WHERE m.user_id = :user_id AND m.subject_key = s.subject_key
                          AND m.metric_key = :project_metric AND m.status = 'active')
                 AS has_actual,
               NOT EXISTS (SELECT 1 FROM aa_measurements m
                            WHERE m.user_id = :user_id AND m.subject_key = s.subject_key
                              AND m.occurred_at >= :h_at)
               AND NOT EXISTS (SELECT 1 FROM aa_forecast_versions f
                                WHERE f.user_id = :user_id AND f.subject_key = s.subject_key
                                  AND (f.recorded_at >= :h_at OR f.horizon_at >= :h_at))
               AND NOT EXISTS (SELECT 1 FROM aa_observations o
                                WHERE o.user_id = :user_id AND o.subject_key = s.subject_key
                                  AND o.occurred_at >= :h_at)
                 AS wholly_before,
               EXISTS (SELECT 1 FROM aa_expectation_versions x
                        WHERE x.user_id = :user_id AND x.subject_key = s.subject_key)
               OR EXISTS (SELECT 1 FROM aa_baselines x
                           WHERE x.user_id = :user_id AND x.subject_key = s.subject_key)
               OR EXISTS (SELECT 1 FROM aa_targets x
                           WHERE x.user_id = :user_id AND x.subject_key = s.subject_key)
               OR EXISTS (SELECT 1 FROM aa_preferences x
                           WHERE x.user_id = :user_id AND x.subject_key = s.subject_key)
               OR EXISTS (SELECT 1 FROM aa_source_coverage x
                           WHERE x.user_id = :user_id AND x.subject_key = s.subject_key)
                 AS other_evidence,
               EXISTS (SELECT 1 FROM aa_measurements m
                        WHERE m.user_id = :user_id AND m.subject_key = s.subject_key
                          AND m.occurred_at < :h_at)
               OR EXISTS (SELECT 1 FROM aa_forecast_versions f
                           WHERE f.user_id = :user_id AND f.subject_key = s.subject_key
                             AND f.recorded_at < :h_at)
               OR EXISTS (SELECT 1 FROM aa_observations o
                           WHERE o.user_id = :user_id AND o.subject_key = s.subject_key
                             AND o.occurred_at < :h_at)
                 AS touches
          FROM subjects s
         ORDER BY s.subject_id
        """
    )
    units: list[str] = []
    skipped = {"open": 0, "not_wholly_before_horizon": 0, "other_evidence": 0}
    for subject_id, has_actual, wholly_before, other, touches in db.execute(
        sql, {**params, "project_metric": PROJECT_METRIC}
    ):
        if not touches:
            continue
        if not has_actual:
            skipped["open"] += 1
        elif not wholly_before:
            skipped["not_wholly_before_horizon"] += 1
        elif other:
            skipped["other_evidence"] += 1
        else:
            units.append(subject_id)
    return units, skipped


def _unit_rows(db: Session, user_id: UUID, subject_ids: list[str]) -> dict[str, list[UUID]]:
    if not subject_ids:
        return {}
    keys = [f"project:project:{subject_id}" for subject_id in subject_ids]
    out: dict[str, list[UUID]] = {}
    for table in ("aa_measurements", "aa_forecast_versions", "aa_observations"):
        out[table] = sorted(
            db.scalars(
                text(
                    f"SELECT id FROM {table} WHERE user_id = :user_id"
                    " AND subject_key = ANY(CAST(:keys AS text[]))"
                ),
                {"user_id": user_id, "keys": keys},
            )
        )
    return out


def derive_candidates(
    db: Session, *, user_id: UUID, horizon_date: date, horizon_at: datetime
) -> Candidates:
    params: dict[str, object] = {"user_id": user_id, "h_date": horizon_date, "h_at": horizon_at}
    result = Candidates()
    for rule in CHAIN_RULES:
        ids, chains, multi, skipped = _chain_candidates(db, rule, params)
        if ids:
            result.rows[rule.table] = ids
            result.chains[rule.table] = chains
        result.multi_member_chains += multi
        if skipped:
            result.skipped[f"{rule.table}.retained_chains"] = skipped
    units, unit_skipped = _project_units(db, params)
    result.project_units = units
    for reason, count in unit_skipped.items():
        if count:
            result.skipped[f"project_units.{reason}"] = count
    for table, ids in _unit_rows(db, user_id, units).items():
        if ids:
            result.rows[table] = sorted({*result.rows.get(table, []), *ids})
    measurement_ids = result.rows.get("aa_measurements", [])
    if measurement_ids:
        overrides = sorted(
            db.scalars(
                text(
                    f"SELECT id FROM {OVERRIDES} WHERE user_id = :user_id"
                    " AND source_fact_id = ANY(CAST(:ids AS uuid[]))"
                ),
                {"user_id": user_id, "ids": measurement_ids},
            )
        )
        if overrides:
            result.rows[OVERRIDES] = overrides
        result.finance_months = sorted(
            db.scalars(
                text(
                    "SELECT DISTINCT to_char(timezone(occurred_tz, occurred_at), 'YYYY-MM')"
                    " FROM aa_measurements WHERE user_id = :user_id"
                    " AND id = ANY(CAST(:ids AS uuid[]))"
                    " AND metric_key = 'finance.transaction_amount'"
                ),
                {"user_id": user_id, "ids": measurement_ids},
            )
        )
    horizon_month = f"{horizon_date.year:04d}-{horizon_date.month:02d}"
    unit_keys = [f"project:project:{subject_id}" for subject_id in units]
    result.episode_ids = sorted(
        db.scalars(
            text(
                "SELECT id FROM aa_signal_episodes WHERE user_id = :user_id AND ("
                " (subject_domain = 'finance' AND subject_type = 'period'"
                "  AND subject_id < :month)"
                " OR subject_key = ANY(CAST(:keys AS text[])))"
            ),
            {"user_id": user_id, "month": horizon_month, "keys": unit_keys},
        )
    )
    return result


def lock_candidates(db: Session, *, user_id: UUID, candidates: Candidates) -> None:
    """``FOR UPDATE`` every candidate row: a concurrent correction's successor
    insert needs ``KEY SHARE`` on its predecessor, so it waits and then fails
    cleanly instead of forking a chain that is being erased."""
    for table, ids in candidates.rows.items():
        db.execute(
            text(
                f"SELECT id FROM {table} WHERE user_id = :user_id"
                " AND id = ANY(CAST(:ids AS uuid[])) ORDER BY id FOR UPDATE"
            ),
            {"user_id": user_id, "ids": ids},
        ).all()
