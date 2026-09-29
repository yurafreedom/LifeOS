"""System Review — live and saved, with relationship and consequence intelligence (Slice 7).

* **Live** review: derived from current durable evidence on every read; a GET
  writes nothing (no episodes, no relations, no reviews).
* **Saved** review: append-only revisions of the user's reflection, decisions and
  adjustments with a frozen, redactable copy of what the review showed.
* **Relations**: user links («Связать») and rule-based proposals the user
  approves, rejects or is unsure about. A relation is an association or a marked
  hypothesis — never a fact, never proof, never a causal claim.
* **Consequences**: transparent projections under explicit inputs and
  assumptions; missing inputs stay missing.

There is no score of any kind. The implementation lives in the
``app.services.system_review`` package; this module is the stable surface, and no
module in the package imports it.
"""

from app.services.system_review.redaction import (
    SLICE_7_REDACTORS,
    erase_importance_for_source,
    redact_relation_endpoints,
    redact_system_review_sources,
)

__all__ = [
    "SLICE_7_REDACTORS",
    "erase_importance_for_source",
    "redact_relation_endpoints",
    "redact_system_review_sources",
]
