"""Review error types. Each maps onto a stable API ``code``/``message``."""

from app.services.aa_facts import AAServiceError


class ReviewNotFoundError(AAServiceError):
    code = "review_not_found"
    message = "Review not found."


class ReviewContextChangedError(AAServiceError):
    code = "review_context_changed"
    message = (
        "The evidence this Review was written against can no longer be reproduced; "
        "nothing was saved."
    )


class IdempotencyKeyReusedError(AAServiceError):
    code = "idempotency_key_reused"
    message = "This idempotency key already belongs to a different Review write."


class UnsupportedReviewSubjectError(AAServiceError):
    code = "unsupported_review_subject"
    message = "Reviews are available for finance periods and projects."


class InvalidReviewWindowError(AAServiceError):
    code = "invalid_review_window"
    message = "The review window is not valid for this subject."


class InvalidFactorError(AAServiceError):
    code = "invalid_factor"
    message = "A named factor does not belong to this Review or is already retracted."


class EmptyRevisionError(AAServiceError):
    code = "empty_revision"
    message = "A revision must add a note, change factors or record a decision."


class InvalidReviewError(AAServiceError):
    code = "invalid_review"
    message = "Invalid review payload."
