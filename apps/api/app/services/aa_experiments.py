"""Experiments — a first-class, user-authored test of a hypothesis (Slice 6, D4).

An Experiment states a hypothesis, runs an intervention over a local-day
window, collects evidence and ends with the user's own decision. It never
concludes a cause, never scores and never recommends:

* **Lifecycle ≠ outcome.** ``DRAFT → RUNNING → COMPLETED_AWAITING_REVIEW →
  REVIEWED``, with ``ABANDONED`` reachable from the first three. ``REVIEWED``
  and ``ABANDONED`` are terminal; ``ABANDONED`` is not a failure. A decision
  never moves the lifecycle.
* **Days are honest.** Adherence stores only ``kept | missed | unknown``;
  ``future``, ``not_recorded`` and ``not_run_after_stop`` are derived, and the
  denominator counts elapsed days only.
* **Hypothesis ≠ fact; result ≠ proof.** The result is a neutral difference
  between the latest outcome the user reported and the baseline.

The implementation lives in the ``app.services.experiments`` package, one module
per responsibility. This module is the stable public surface: routes and tests
import from here, and no module in the package imports this one.
"""

from app.services.experiments.contracts import (
    DECISION_LIFECYCLES,
    EVIDENCE_LIFECYCLES,
    LEGAL_EDGES,
    LIST_LIMIT_DEFAULT,
    LIST_LIMIT_MAX,
    MAX_FACTOR_CHANGES,
    MAX_WINDOW_DAYS,
    PENDING_LIFECYCLES,
    TIME_SKEW,
)
from app.services.experiments.decisions import record_decision
from app.services.experiments.errors import (
    AdherenceDayFutureError,
    AdherenceDayOutsideWindowError,
    AdherenceDayRecordedError,
    BaselineWindowInvalidError,
    ExperimentIdempotencyKeyReusedError,
    ExperimentIdUnavailableError,
    ExperimentNotFoundError,
    InvalidExperimentError,
    InvalidExperimentFactorError,
    InvalidTimeError,
    InvalidTransitionError,
    NotAcceptingEvidenceError,
    NotAwaitingDecisionError,
    ObservationOutsideWindowError,
    OutcomeShapeMismatchError,
    WindowAlreadyEndedError,
    WindowNotElapsedError,
)
from app.services.experiments.evidence import (
    record_adherence,
    record_baseline,
    record_condition,
    record_observation,
)
from app.services.experiments.lifecycle import TransitionResult, create_experiment, transition
from app.services.experiments.read_model import experiment_detail, list_experiments

__all__ = [
    "DECISION_LIFECYCLES",
    "EVIDENCE_LIFECYCLES",
    "LEGAL_EDGES",
    "LIST_LIMIT_DEFAULT",
    "LIST_LIMIT_MAX",
    "MAX_FACTOR_CHANGES",
    "MAX_WINDOW_DAYS",
    "PENDING_LIFECYCLES",
    "TIME_SKEW",
    "AdherenceDayFutureError",
    "AdherenceDayOutsideWindowError",
    "AdherenceDayRecordedError",
    "BaselineWindowInvalidError",
    "ExperimentIdUnavailableError",
    "ExperimentIdempotencyKeyReusedError",
    "ExperimentNotFoundError",
    "InvalidExperimentError",
    "InvalidExperimentFactorError",
    "InvalidTimeError",
    "InvalidTransitionError",
    "NotAcceptingEvidenceError",
    "NotAwaitingDecisionError",
    "ObservationOutsideWindowError",
    "OutcomeShapeMismatchError",
    "TransitionResult",
    "WindowAlreadyEndedError",
    "WindowNotElapsedError",
    "create_experiment",
    "experiment_detail",
    "list_experiments",
    "record_adherence",
    "record_baseline",
    "record_condition",
    "record_decision",
    "record_observation",
    "transition",
]
