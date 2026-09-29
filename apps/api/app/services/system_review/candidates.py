"""Rule-based relation proposals (v1) — deterministic, bounded, read-only (plan §8).

Not an oracle and not a model: six conservative families, each firing only on
explicit inputs, each explaining itself with structured conditions and the
exact evidence refs it read. A proposal is an association or a *marked*
hypothesis; it never says one thing caused another, and it is never approved by
the system.

Identity (the signals precedent, correction C2):

* ``proposal_key = sha256(v1|family|from|to|period)`` — the occurrence the user
  answers. Same key → the same candidate, never a duplicate. A key the user has
  answered is never proposed again; a new period or new endpoints are a new
  occurrence.
* ``fingerprint = sha256(sorted evidence version ids + rule version)`` — the exact
  evidence. It may change while the key does not; an answered relation then
  shows "evidence changed since your answer".

Ranking uses only the user's past answers per family (Laplace-smoothed approval
share, never returned), then a fixed family order, then the key. It orders the
list; it changes no type, no epistemic kind and no status, and it is never
shown as confidence.

Bounds: ≤ 200 expense contexts, ≤ 100 observations, ≤ 10 obligations and ≤ 10
cross-domain pairs per month; observations are bucketed by local date before
pairing (±3 days), so the work is O(E + O·7) rather than all pairs of history.
"""

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.analytics.enums import (
    SYMMETRIC_RELATION_TYPES,
    RelationType,
    relation_epistemic_kind,
)
from app.analytics.rules import input_fingerprint
from app.models import AAExperiment, AAFinanceContext, AAObservation
from app.services.system_review.changes import free_observations
from app.services.system_review.consequences import Expense, load_expenses, load_position
from app.services.system_review.contracts import (
    MAX_CANDIDATES,
    MAX_CROSS_DOMAIN_PAIRS,
    MAX_OBSERVATIONS,
    OBSERVATION_WINDOW_DAYS,
    RULE_VERSION,
)
from app.services.system_review.periods import Period
from app.services.system_review.refs import (
    ChangeKind,
    change_ref,
    context_ref,
    fact_ref,
    subject_ref,
)

FAMILIES = (
    "finance_credit_obligation",
    "finance_emotional_context",
    "observation_temporal",
    "finance_repeated_unplanned_obligation",
    "period_cross_domain",
    "experiment_observation_temporal",
)
_ORDER = {family: index for index, family in enumerate(FAMILIES)}


@dataclass(frozen=True)
class Candidate:
    family: str
    from_key: str
    to_key: str
    from_domain: str
    to_domain: str
    relation_type: str
    period: str
    evidence: tuple[dict[str, str], ...]
    evidence_versions: tuple[str, ...]
    conditions: tuple[dict[str, Any], ...]
    rule_version: int = RULE_VERSION

    @property
    def epistemic_kind(self) -> str:
        return relation_epistemic_kind(self.relation_type).value

    @property
    def proposal_key(self) -> str:
        canonical = "|".join(
            ("v1", self.family, self.from_key, self.to_key, self.period)
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @property
    def fingerprint(self) -> str:
        return input_fingerprint(
            [*self.evidence_versions, f"rule_version={self.rule_version}"]
        )


def _make(
    family: str,
    first: tuple[str, str],
    second: tuple[str, str],
    relation_type: RelationType,
    period: Period,
    evidence: list[tuple[str, str]],
    versions: list[str],
    conditions: list[dict[str, Any]],
) -> Candidate:
    if relation_type in SYMMETRIC_RELATION_TYPES and second[0] < first[0]:
        first, second = second, first
    return Candidate(
        family=family,
        from_key=first[0],
        to_key=second[0],
        from_domain=first[1],
        to_domain=second[1],
        relation_type=relation_type.value,
        period=period.key,
        evidence=tuple({"ref": ref, "role": role} for ref, role in evidence),
        evidence_versions=tuple(sorted(set(versions))),
        conditions=tuple(conditions),
    )


def _expense_endpoint(expense: Expense) -> tuple[str, str]:
    return subject_ref(expense.context.subject_key), "finance"


def _credit_obligation(expenses, obligations, period) -> list[Candidate]:
    out = []
    for expense in expenses:
        payload = expense.payload
        if payload.get("funding_source") not in ("credit", "borrowed", "mixed"):
            continue
        obligation = obligations.get(str(payload.get("obligation_entity_id")))
        if obligation is None:
            continue
        out.append(_make(
            "finance_credit_obligation",
            _expense_endpoint(expense),
            (context_ref(obligation.entity_id), "finance"),
            RelationType.MAY_CONTRIBUTE_TO,
            period,
            [(subject_ref(expense.context.subject_key), "expense"),
             (context_ref(expense.context.entity_id), "expense_context"),
             (context_ref(obligation.entity_id), "obligation")],
            [str(expense.measurement.id), str(expense.context.id), str(obligation.id)],
            [{"field": "funding_source", "value": payload.get("funding_source")},
             {"field": "obligation_named_by_user", "value": True}],
        ))
    return out


def _emotional_context(expenses, period) -> list[Candidate]:
    out = []
    for expense in expenses:
        payload = expense.payload
        if payload.get("plannedness") != "unplanned" or not payload.get("emotional_context"):
            continue
        out.append(_make(
            "finance_emotional_context",
            (context_ref(expense.context.entity_id), "finance"),
            _expense_endpoint(expense),
            RelationType.MAY_CONTRIBUTE_TO,
            period,
            [(context_ref(expense.context.entity_id), "self_report"),
             (subject_ref(expense.context.subject_key), "expense")],
            [str(expense.measurement.id), str(expense.context.id)],
            # The self-report's text is never copied here — only that it exists.
            [{"field": "plannedness", "value": "unplanned"},
             {"field": "emotional_context_recorded", "value": True}],
        ))
    return out


def _observation_temporal(expenses, observations, period) -> list[Candidate]:
    zone = ZoneInfo(period.timezone)
    by_day: dict[Any, list[AAObservation]] = {}
    for row in observations:
        by_day.setdefault(row.occurred_at.astimezone(zone).date(), []).append(row)
    out = []
    for expense in expenses:
        if expense.payload.get("plannedness") != "unplanned":
            continue
        day = expense.local_date(period.timezone)
        for offset in range(-OBSERVATION_WINDOW_DAYS, OBSERVATION_WINDOW_DAYS + 1):
            for row in by_day.get(day + timedelta(days=offset), ()):
                out.append(_make(
                    "observation_temporal",
                    (fact_ref("aa_observations", row.id), "observation"),
                    _expense_endpoint(expense),
                    RelationType.TEMPORALLY_ASSOCIATED,
                    period,
                    [(fact_ref("aa_observations", row.id), "observation"),
                     (subject_ref(expense.context.subject_key), "expense")],
                    [str(row.id), str(expense.measurement.id), str(expense.context.id)],
                    [{"field": "days_apart", "value": abs(offset)},
                     {"field": "window_days", "value": OBSERVATION_WINDOW_DAYS},
                     {"field": "plannedness", "value": "unplanned"}],
                ))
    return out


def _repeated_unplanned(expenses, obligations, period) -> list[Candidate]:
    unplanned = [e for e in expenses if e.payload.get("plannedness") == "unplanned"]
    if len(unplanned) < 2 or not obligations:
        return []
    change = change_ref(ChangeKind.FINANCE_UNPLANNED_REPEAT, period.subject_key, None, period.key)
    versions = [str(v) for e in unplanned for v in (e.measurement.id, e.context.id)]
    out = []
    for obligation in obligations.values():
        out.append(_make(
            "finance_repeated_unplanned_obligation",
            (change, "finance"),
            (context_ref(obligation.entity_id), "finance"),
            RelationType.MAY_INCREASE_RISK_OF,
            period,
            [(change, "pattern")] + [(subject_ref(e.context.subject_key), "expense")
                                     for e in unplanned]
            + [(context_ref(obligation.entity_id), "obligation")],
            versions + [str(obligation.id)],
            [{"field": "unplanned_in_period", "value": len(unplanned)},
             {"field": "obligation_recorded", "value": True}],
        ))
    return out


def _cross_domain(changes: list[dict[str, Any]], period) -> list[Candidate]:
    finance = [
        item for item in changes
        if item["kind"] == ChangeKind.FINANCE_SPEND_VS_PRIOR
        and (item.get("delta") or {}).get("state") == "known"
        and Decimal((item["delta"]["value"] or {}).get("num") or "0") != 0
    ]
    others = [
        item for item in changes
        if item["kind"] in (ChangeKind.PROJECT_FORECAST_REVISIONS, ChangeKind.EXPERIMENT_LIFECYCLE)
    ]
    out = []
    for money_change in finance:
        for other in others[:MAX_CROSS_DOMAIN_PAIRS]:
            versions = [source[1] for item in (money_change, other)
                        for source in item.get("sources", [])]
            if other["kind"] == ChangeKind.EXPERIMENT_LIFECYCLE:
                versions += [f"{event['event']}@{event['at']}"
                             for event in other["details"]["events"]]
            out.append(_make(
                "period_cross_domain",
                (money_change["ref"], "finance"),
                (other["ref"], other["domain"]),
                RelationType.CO_OCCURS_WITH,
                period,
                [(money_change["ref"], "change"), (other["ref"], "change")],
                versions,
                [{"field": "same_period", "value": period.key},
                 {"field": "finance_delta_direction",
                  "value": money_change["delta"].get("direction")},
                 {"field": "other_kind", "value": other["kind"]}],
            ))
    return out[:MAX_CROSS_DOMAIN_PAIRS]


def _experiment_observation(experiments, observations, period) -> list[Candidate]:
    zone = ZoneInfo(period.timezone)
    out = []
    for experiment in experiments:
        if experiment.started_at is None:
            continue
        stop = experiment.abandoned_at
        for row in observations:
            day = row.occurred_at.astimezone(zone).date()
            if not (experiment.window_start <= day <= experiment.window_end):
                continue
            if row.occurred_at < experiment.started_at or (stop is not None and row.occurred_at > stop):
                continue
            key = subject_ref(f"experiment:experiment:{experiment.id}")
            out.append(_make(
                "experiment_observation_temporal",
                (key, "experiment"),
                (fact_ref("aa_observations", row.id), "observation"),
                RelationType.TEMPORALLY_ASSOCIATED,
                period,
                [(key, "experiment"), (fact_ref("aa_observations", row.id), "observation")],
                [str(experiment.id), str(row.id), str(experiment.started_at)],
                [{"field": "inside_experiment_window", "value": True},
                 {"field": "attached_to_experiment", "value": False}],
            ))
    return out


def generate(
    db: Session,
    *,
    user_id: UUID,
    period: Period,
    contexts: list[AAFinanceContext],
    changes: list[dict[str, Any]],
    experiments: list[AAExperiment],
    now: datetime,
) -> list[Candidate]:
    """Every candidate for one month. Pure read; deduplicated by proposal key."""
    if period.kind != "month":
        return []
    position = load_position(contexts)
    expenses, _ = load_expenses(db, user_id=user_id, contexts=contexts, period=period)
    observations = free_observations(db, user_id=user_id, period=period, limit=MAX_OBSERVATIONS)
    produced = [
        *_credit_obligation(expenses, position.obligations, period),
        *_emotional_context(expenses, period),
        *_observation_temporal(expenses, observations, period),
        *_repeated_unplanned(expenses, position.obligations, period),
        *_cross_domain(changes, period),
        *_experiment_observation(experiments, observations, period),
    ]
    unique: dict[str, Candidate] = {}
    for candidate in produced:
        unique.setdefault(candidate.proposal_key, candidate)
    return list(unique.values())


def rank(
    candidates: list[Candidate], history: dict[str, dict[str, int]]
) -> list[tuple[Candidate, dict[str, int]]]:
    """Order by the user's past answers per family — a ranking signal, never truth."""
    def share(family: str) -> Decimal:
        counts = history.get(family, {})
        approved, rejected = counts.get("approved", 0), counts.get("rejected", 0)
        return Decimal(approved + 1) / Decimal(approved + rejected + 2)

    ordered = sorted(
        candidates,
        key=lambda c: (-share(c.family), _ORDER.get(c.family, 99), c.proposal_key),
    )
    return [
        (candidate, dict(history.get(candidate.family, {"approved": 0, "rejected": 0,
                                                         "unsure": 0})))
        for candidate in ordered[:MAX_CANDIDATES]
    ]


def candidate_payload(candidate: Candidate, rank_index: int,
                      history: dict[str, int]) -> dict[str, Any]:
    return {
        "proposal_key": candidate.proposal_key,
        "family": candidate.family,
        "rule_version": candidate.rule_version,
        "source": "rule",
        "status": "proposed",
        "from": {"key": candidate.from_key, "domain": candidate.from_domain},
        "to": {"key": candidate.to_key, "domain": candidate.to_domain},
        "relation_type": candidate.relation_type,
        "epistemic_kind": candidate.epistemic_kind,
        "period": candidate.period,
        "evidence": [dict(entry) for entry in candidate.evidence],
        "conditions": [dict(entry) for entry in candidate.conditions],
        "input_fingerprint": candidate.fingerprint,
        "rank": rank_index,
        "history": history,
    }
