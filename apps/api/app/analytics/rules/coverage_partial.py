"""R4 · ``coverage.window.partial`` v1 (plan §19, §13.3d, §20).

Coverage comes from explicit ``aa_source_coverage`` evidence, read through
:func:`app.services.aa_coverage_claims.coverage_report_for_window`. It is never
inferred from how many facts exist: a day with zero transactions may be fully
observed and a day with one may be barely observed (correction C6).

Two absences are kept apart, and the difference is the whole point of the rule:

* **Incomplete coverage** — evidence exists and says the window is only partly
  observed. That is this signal.
* **Unknown coverage** — no evidence either way. That is *not* «0 % covered»; the
  honest report is «полнота данных неизвестна», which the zero-signal state
  carries. Claiming 0 % here would read as «you spent nothing».

The denominator is elapsed days. Days that have not happened yet are never a
shortfall, so a period on its tenth day is not 32 % covered.

One episode per window at the info tier; crossing into the worse tier appends
``:tier=material`` and is a new occurrence, as the plan's worked example requires.
No desirability — coverage is an epistemic fact, not a good or bad one.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.analytics.coverage import CoverageReport
from app.analytics.enums import SignalMateriality, SignalState
from app.analytics.rules import Evaluation, SignalSubject, compose_episode_key
from app.models import AASignalEpisode
from app.services.aa_coverage_claims import coverage_report_for_window

RULE_ID = "coverage.window.partial"
RULE_VERSION = 1

# Accepted thresholds, as fractions of the elapsed window.
INFO_BELOW = 0.90
MATERIAL_BELOW = 0.50


@dataclass(frozen=True, slots=True)
class Inputs:
    subject: SignalSubject
    report: CoverageReport
    claim_ids: tuple[str, ...]


def handles(subject: SignalSubject) -> bool:
    return True


def inputs(
    db: Session,
    *,
    user_id: UUID,
    subject: SignalSubject,
    now: datetime,
    as_of: datetime | None = None,
) -> Inputs:
    from app.services.aa_coverage_claims import active_claims

    report = coverage_report_for_window(
        db,
        user_id=user_id,
        subject_key=subject.subject_key,
        window_start=subject.window_start,
        window_end=subject.window_end,
        timezone=subject.timezone,
        now=as_of or now,
        as_of=as_of,
    )
    claims = active_claims(
        db,
        user_id=user_id,
        subject_key=subject.subject_key,
        window_start=subject.window_start,
        window_end=subject.window_end,
        as_of=as_of,
    )
    return Inputs(
        subject=subject,
        report=report,
        claim_ids=tuple(sorted(str(claim.id) for claim in claims)),
    )


def elapsed_days(report: CoverageReport) -> int:
    """Denominator honouring ``future != missing``."""
    return report.expected_denominator - report.future_count


def has_coverage_evidence(rule_inputs: Inputs) -> bool:
    """Whether any day in the window is backed by a claim.

    Without evidence the window's completeness is unknown, and unknown is not a
    low number — it is a different statement altogether.
    """
    return bool(rule_inputs.claim_ids) and elapsed_days(rule_inputs.report) > (
        rule_inputs.report.unknown_coverage_count
    )


def evaluate(rule_inputs: Inputs) -> Evaluation | None:
    report = rule_inputs.report
    elapsed = elapsed_days(report)
    if elapsed <= 0:
        # The window has not started elapsing. Nothing is missing yet.
        return None
    if not has_coverage_evidence(rule_inputs):
        # Unknown coverage is reported by the zero-signal state, not as a
        # fabricated «0 % covered» card.
        return None
    ratio = report.observed_count / elapsed
    if ratio >= INFO_BELOW:
        return None
    material = ratio < MATERIAL_BELOW
    materiality = SignalMateriality.MATERIAL if material else SignalMateriality.INFO
    discriminator = f"window={rule_inputs.subject.window_id}"
    if material:
        discriminator += f":tier={SignalMateriality.MATERIAL.value}"
    return Evaluation(
        materiality=materiality,
        state=SignalState.PARTIAL,
        stakes=False,
        rendered_values={
            "window_id": rule_inputs.subject.window_id,
            "observed": report.observed_count,
            "elapsed": elapsed,
            "expected_denominator": report.expected_denominator,
            "partial_days": report.partial_count,
            "missing_days": report.missing_count,
            "unknown_coverage_days": report.unknown_coverage_count,
            "future_days": report.future_count,
            "percent": int(ratio * 100),
        },
        input_version_ids=rule_inputs.claim_ids,
        discriminator=discriminator,
        provenance={
            "window_id": rule_inputs.subject.window_id,
            "observed": report.observed_count,
            "denominator": elapsed,
            "denominator_basis": report.denominator_basis.value,
            "claim_count": len(rule_inputs.claim_ids),
            "derivation": "explicit source coverage evidence over elapsed local days",
        },
    )


def episode_key(subject: SignalSubject, evaluation: Evaluation) -> str:
    return compose_episode_key(
        rule_id=RULE_ID,
        rule_version=RULE_VERSION,
        subject_key=subject.subject_key,
        discriminator=evaluation.discriminator,
    )


def reopen_on(episode: AASignalEpisode, evaluation: Evaluation) -> bool:
    """Same window, same tier — the acknowledgement stands.

    Another uncovered day passing changes the fraction, not the occurrence, so a
    dismissed «частичные данные» card does not return daily. A worse tier has a
    different key and therefore arrives as a new card instead.
    """
    del episode, evaluation
    return False


__all__ = [
    "INFO_BELOW",
    "MATERIAL_BELOW",
    "RULE_ID",
    "RULE_VERSION",
    "elapsed_days",
    "episode_key",
    "evaluate",
    "handles",
    "has_coverage_evidence",
    "inputs",
    "reopen_on",
]
