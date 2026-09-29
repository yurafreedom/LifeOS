"""Characterization: the Review service's importable contract.

The error ``code``/``message`` pairs are the API contract (routes catch the
``AAServiceError`` base and serialize them), and ``app.services.aa_reviews`` is
the facade every caller imports. These pins let the service be reorganized
internally without a caller, a route or the D1 registration noticing.
"""

import pytest

from app.services import aa_deletion, aa_reviews
from app.services.aa_facts import AAServiceError

REVIEW_ERRORS = {
    "ReviewNotFoundError": ("review_not_found", "Review not found."),
    "ReviewContextChangedError": (
        "review_context_changed",
        "The evidence this Review was written against can no longer be reproduced; "
        "nothing was saved.",
    ),
    "IdempotencyKeyReusedError": (
        "idempotency_key_reused",
        "This idempotency key already belongs to a different Review write.",
    ),
    "UnsupportedReviewSubjectError": (
        "unsupported_review_subject",
        "Reviews are available for finance periods and projects.",
    ),
    "InvalidReviewWindowError": (
        "invalid_review_window",
        "The review window is not valid for this subject.",
    ),
    "InvalidFactorError": (
        "invalid_factor",
        "A named factor does not belong to this Review or is already retracted.",
    ),
    "EmptyRevisionError": (
        "empty_revision",
        "A revision must add a note, change factors or record a decision.",
    ),
    "InvalidReviewError": ("invalid_review", "Invalid review payload."),
}

FACADE_SYMBOLS = (
    "LIST_LIMIT_MAX",
    "MANIFEST_VERSION",
    "MAX_ALONGSIDE",
    "MAX_WINDOW_DAYS",
    "PROJECT_METRIC",
    "ContextItem",
    "ReviewContext",
    "build_context",
    "context_payload",
    "list_reviews",
    "read_review",
    "redact_review_context",
    "resolve_review_subject",
    "revise_review",
    "save_review",
    "validate_window",
    *REVIEW_ERRORS,
)


@pytest.mark.parametrize("name", sorted(REVIEW_ERRORS))
def test_review_error_codes_are_stable(name: str) -> None:
    error = getattr(aa_reviews, name)
    assert issubclass(error, AAServiceError)
    assert (error.code, error.message) == REVIEW_ERRORS[name]


def test_review_constants_are_stable() -> None:
    assert aa_reviews.PROJECT_METRIC == "project.completion_date"
    assert aa_reviews.MANIFEST_VERSION == 1
    assert aa_reviews.MAX_ALONGSIDE == 20
    assert aa_reviews.MAX_WINDOW_DAYS == 3661
    assert aa_reviews.LIST_LIMIT_MAX == 50


def test_facade_exposes_every_caller_symbol() -> None:
    missing = [name for name in FACADE_SYMBOLS if not hasattr(aa_reviews, name)]
    assert missing == []


def test_review_redactor_is_registered_through_the_facade() -> None:
    from app.services import aa_system_review

    # Review first, then the three Slice 7 adapters — each through its own facade.
    assert aa_deletion.SOURCE_REDACTORS == (
        aa_reviews.redact_review_context,
        aa_system_review.redact_system_review_sources,
        aa_system_review.redact_relation_endpoints,
        aa_system_review.erase_importance_for_source,
    )
