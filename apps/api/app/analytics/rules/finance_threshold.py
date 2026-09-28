"""R1 · ``finance.monthly_spend.threshold`` v1 (plan §19, §13.3a).

The period's spend is compared against the user's own active Expectation, or the
active Target when no Expectation exists. Crossing 80 %, 100 % or 120 % of that
reference raises a signal.

The episode discriminator is the **crossed band**, not the value. That is the
whole point of correction C2: dismissed at 90 %, the card stays dismissed through
91 %, 92 %, 93 % — ordinary transactions change the fingerprint, not the episode.
Crossing 100 % is a different band, so it is a different episode and a fresh
card.

Materiality only. Being at 80 % of an expectation says «look at this», not «this
is bad»: this rule sets ``stakes`` and never touches desirability.
"""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_FLOOR, Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.asof import apply_as_of
from app.analytics.enums import SignalMateriality, SignalState, ValueType
from app.analytics.rules import Evaluation, SignalSubject, compose_episode_key
from app.models import AAExpectationVersion, AASignalEpisode, AATarget
from app.services.aa_finance import MONTHLY_METRIC, MonthlySpendInputs, monthly_spend_inputs

RULE_ID = "finance.monthly_spend.threshold"
RULE_VERSION = 1

# The accepted bands, strongest first. Only the highest crossed band is a signal:
# at 130 % the user is told they are past 120 %, not told three times.
BANDS: tuple[int, ...] = (120, 100, 80)

# The unit :func:`monthly_spend_inputs` aggregates. A reference in any other
# currency is not comparable to it.
DERIVED_UNIT = "UAH"


@dataclass(frozen=True, slots=True)
class Inputs:
    subject: SignalSubject
    # What "days remaining" is measured against. Distinct from ``spend.as_of``,
    # which is the belief instant deciding which facts were known.
    observed_at: datetime
    spend: MonthlySpendInputs
    reference_kind: str | None
    reference_id: str | None
    reference_amount: Decimal | None
    reference_unit: str | None


def handles(subject: SignalSubject) -> bool:
    return (
        subject.subject.subject_domain == "finance" and subject.subject.subject_type == "period"
    )


def _active_reference(db: Session, *, user_id: UUID, subject_key: str, as_of: datetime):
    """The active Expectation for the period, else the active Target.

    A Target that was explicitly recorded as absent is not a reference: «цель не
    задавалась» is a stated absence, not a number to compare against.
    """
    for kind, model in (("expectation", AAExpectationVersion), ("target", AATarget)):
        query = select(model).where(
            model.user_id == user_id,
            model.subject_key == subject_key,
            model.metric_key == MONTHLY_METRIC,
        )
        if hasattr(model, "effective_from"):
            query = query.where(model.effective_from <= as_of)
        row = db.scalar(
            apply_as_of(query, model, as_of)
            .order_by(model.recorded_at.desc(), model.id.desc())
            .limit(1)
        )
        if row is None:
            continue
        if getattr(row, "is_explicitly_absent", False):
            continue
        if row.value_type != ValueType.MONEY or row.value_num is None or row.value_num <= 0:
            continue
        return kind, row
    return None, None


def inputs(
    db: Session,
    *,
    user_id: UUID,
    subject: SignalSubject,
    now: datetime,
    as_of: datetime | None = None,
) -> Inputs:
    if subject.period is None:
        raise ValueError("the finance threshold rule requires a period subject")
    spend = monthly_spend_inputs(
        db, user_id=user_id, period=subject.period, timezone=subject.timezone, as_of=as_of
    )
    kind, row = _active_reference(
        db, user_id=user_id, subject_key=subject.subject_key, as_of=spend.as_of
    )
    return Inputs(
        subject=subject,
        observed_at=now,
        spend=spend,
        reference_kind=kind,
        reference_id=None if row is None else str(row.id),
        reference_amount=None if row is None else row.value_num,
        reference_unit=None if row is None else row.unit_code,
    )


def _band(ratio: Decimal) -> int | None:
    percent = ratio * 100
    for band in BANDS:
        if percent >= band:
            return band
    return None


def evaluate(rule_inputs: Inputs) -> Evaluation | None:
    spend = rule_inputs.spend
    reference = rule_inputs.reference_amount
    # No reference is not «0 % of nothing» — there is simply nothing to cross.
    if reference is None or reference <= 0:
        return None
    # A partly unknown aggregate must not be compared as if it were complete.
    if spend.unknown_membership_count or not spend.included_count:
        return None
    # The derivation sums UAH money only; a reference in another unit is not
    # comparable, and an incomparable ratio is not a signal.
    if rule_inputs.reference_unit != DERIVED_UNIT:
        return None
    ratio = spend.total / reference
    band = _band(ratio)
    if band is None:
        return None

    version_ids = list(spend.input_version_ids)
    if rule_inputs.reference_id is not None:
        version_ids.append(rule_inputs.reference_id)

    return Evaluation(
        materiality=SignalMateriality.MATERIAL,
        state=SignalState.MATERIAL,
        # Budget at or past 80 % of the user's own reference is a genuine stakes
        # event (accepted trigger #7) — the one warm case in the signal design.
        stakes=True,
        rendered_values={
            "period": spend.period,
            "band": band,
            "percent": int((ratio * 100).to_integral_value(rounding=ROUND_FLOOR)),
            "spend": str(spend.total),
            "reference": str(reference),
            "unit_code": rule_inputs.reference_unit,
            "reference_kind": rule_inputs.reference_kind,
            "operation_count": spend.included_count,
            "days_remaining": _days_remaining(
                spend.window_end, rule_inputs.observed_at, spend.timezone
            ),
        },
        input_version_ids=tuple(version_ids),
        discriminator=f"band={band}",
        provenance={
            "source_kinds": list(spend.source_kinds),
            "operation_count": spend.included_count,
            "newest_recorded_at": (
                None if spend.newest_recorded_at is None else spend.newest_recorded_at.isoformat()
            ),
            "derivation": (
                f"SUM of {spend.included_count} active included transaction fact(s)"
                " minus corrections"
            ),
            "policy_known": spend.policy_known,
        },
    )


def _days_remaining(window_end: date, observed_at: datetime, timezone: str) -> int:
    """Elapsed-aware: days that have not happened yet are never a shortfall."""
    today = observed_at.astimezone(ZoneInfo(timezone)).date()
    return max((window_end - today).days, 0)


def episode_key(subject: SignalSubject, evaluation: Evaluation) -> str:
    return compose_episode_key(
        rule_id=RULE_ID,
        rule_version=RULE_VERSION,
        subject_key=subject.subject_key,
        discriminator=evaluation.discriminator,
    )


def reopen_on(episode: AASignalEpisode, evaluation: Evaluation) -> bool:
    """Same band, same occurrence — however much the inputs churned.

    Re-entry *after* a withdrawal is a fresh occurrence, but that is decided by
    the episode's ``resolution``, not here: this method only answers whether a
    changed fingerprint on a still-open episode invalidates the acknowledgement.
    It never does for this rule, which is exactly why a dismissed budget signal
    does not respawn at 91 %.
    """
    del episode, evaluation
    return False


__all__ = [
    "BANDS",
    "RULE_ID",
    "RULE_VERSION",
    "episode_key",
    "evaluate",
    "handles",
    "inputs",
    "reopen_on",
]
