"""Review / Debrief — frozen context, user-authored reflection, D1 redaction.

A Review is semantic reflection, not a GTD weekly review and not a verdict. It
never scores, never infers a cause and never recommends. It does three things:

1. **Freezes what the user saw.** ``build_context`` derives the evidence from
   real AA facts *as of an explicit instant*. The same instant always yields the
   same items, which is how a save queued offline for days still stores exactly
   the context the user looked at: the client sends back only that instant and a
   fingerprint, the server re-derives, compares, and stores its own result.
2. **Records what the user wrote** — a note, factors with an epistemic kind, and
   an optional decision. Nothing is required; an empty Review is valid.
3. **Honours erasure.** ``redact_review_context`` is registered as a
   ``SOURCE_REDACTORS`` adapter and runs inside the hard-delete transaction, so
   an erased fact leaves no value behind in any Review, and a failed redaction
   rolls the deletion back.

Corrections are *not* applied to frozen items. They are detected at read time
and reported beside the frozen value (``source_state``), and correction is
never conflated with a legitimate revision.

The implementation lives in the ``app.services.reviews`` package, one module per
responsibility. This module is the stable public surface: routes, the D1
``SOURCE_REDACTORS`` registration and tests import from here, and no module in
the package imports this one.
"""

from app.services.reviews.context import build_context, resolve_review_subject, validate_window
from app.services.reviews.contracts import (
    LIST_LIMIT_MAX,
    MANIFEST_VERSION,
    MAX_ALONGSIDE,
    MAX_WINDOW_DAYS,
    PROJECT_METRIC,
    ContextItem,
    ReviewContext,
)
from app.services.reviews.errors import (
    EmptyRevisionError,
    IdempotencyKeyReusedError,
    InvalidFactorError,
    InvalidReviewError,
    InvalidReviewWindowError,
    ReviewContextChangedError,
    ReviewNotFoundError,
    UnsupportedReviewSubjectError,
)
from app.services.reviews.persistence import revise_review, save_review
from app.services.reviews.read_model import context_payload, list_reviews, read_review
from app.services.reviews.redaction import redact_review_context

__all__ = [
    "LIST_LIMIT_MAX",
    "MANIFEST_VERSION",
    "MAX_ALONGSIDE",
    "MAX_WINDOW_DAYS",
    "PROJECT_METRIC",
    "ContextItem",
    "EmptyRevisionError",
    "IdempotencyKeyReusedError",
    "InvalidFactorError",
    "InvalidReviewError",
    "InvalidReviewWindowError",
    "ReviewContext",
    "ReviewContextChangedError",
    "ReviewNotFoundError",
    "UnsupportedReviewSubjectError",
    "build_context",
    "context_payload",
    "list_reviews",
    "read_review",
    "redact_review_context",
    "resolve_review_subject",
    "revise_review",
    "save_review",
    "validate_window",
]
