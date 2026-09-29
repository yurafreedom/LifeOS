"""Experiment error types. Each maps onto a stable API ``code``/``message``."""

from app.services.aa_facts import AAServiceError


class ExperimentNotFoundError(AAServiceError):
    # Identical for a missing and a foreign experiment.
    code = "experiment_not_found"
    message = "Experiment not found."


class InvalidExperimentError(AAServiceError):
    code = "invalid_experiment"
    message = "Invalid experiment payload."


class InvalidTimeError(AAServiceError):
    code = "invalid_time"
    message = "The instant is in the future or precedes an earlier step of this experiment."


class InvalidTransitionError(AAServiceError):
    code = "invalid_transition"
    message = "This experiment cannot move to that state from where it is."


class ExperimentIdUnavailableError(AAServiceError):
    # Generic on purpose: the same body whoever holds the id.
    code = "experiment_id_unavailable"
    message = "This experiment id cannot be used."


class ExperimentIdempotencyKeyReusedError(AAServiceError):
    code = "idempotency_key_reused"
    message = "This idempotency key already belongs to a different Experiment write."


class NotAcceptingEvidenceError(AAServiceError):
    code = "experiment_not_accepting_evidence"
    message = "This experiment does not accept this record in its current state."


class NotAwaitingDecisionError(AAServiceError):
    code = "experiment_not_awaiting_decision"
    message = "A decision can be recorded only after the experiment period has ended."


class AdherenceDayRecordedError(AAServiceError):
    code = "adherence_day_recorded"
    message = "This day already has a different record; correct that record instead."


class WindowNotElapsedError(AAServiceError):
    code = "window_not_elapsed"
    message = "The experiment period has not ended yet in the experiment's timezone."


class WindowAlreadyEndedError(AAServiceError):
    code = "window_already_ended"
    message = "The experiment period has already ended."


class AdherenceDayFutureError(AAServiceError):
    code = "adherence_day_future"
    message = "A day that has not happened yet cannot be recorded."


class AdherenceDayOutsideWindowError(AAServiceError):
    code = "adherence_day_outside_window"
    message = "The day is outside the experiment period."


class ObservationOutsideWindowError(AAServiceError):
    code = "observation_outside_window"
    message = "The observation is outside the experiment period."


class OutcomeShapeMismatchError(AAServiceError):
    code = "outcome_shape_mismatch"
    message = "The value does not match the experiment's outcome definition."


class BaselineWindowInvalidError(AAServiceError):
    code = "baseline_window_invalid"
    message = "A baseline must describe a period that ends before the experiment starts."


class InvalidExperimentFactorError(AAServiceError):
    code = "invalid_factor"
    message = "A named factor does not belong to this Experiment or is already retracted."
