"""System Review error types. Each maps onto a stable API ``code``/``message``."""

from app.services.aa_facts import AAServiceError


class InvalidRefError(AAServiceError):
    code = "invalid_ref"
    message = "The item reference is not a valid LifeOS reference."


class RefNotFoundError(AAServiceError):
    # Identical for a missing and a foreign item.
    code = "ref_not_found"
    message = "The referenced item was not found."


class InvalidRelationError(AAServiceError):
    code = "invalid_relation"
    message = "Unknown relation type."


class CausalRelationForbiddenError(AAServiceError):
    code = "causal_relation_forbidden"
    message = (
        "LifeOS does not record causal claims. Use an association, or a relation marked "
        "as a hypothesis."
    )


class SelfRelationError(AAServiceError):
    code = "self_relation"
    message = "An item cannot be related to itself."


class RelationNotFoundError(AAServiceError):
    code = "relation_not_found"
    message = "Relation not found."


class RelationNotDeletableError(AAServiceError):
    code = "relation_not_deletable"
    message = "Only a relation you created can be removed; a proposal can be rejected."


class ProposalNotCurrentError(AAServiceError):
    code = "proposal_not_current"
    message = "This proposal is no longer supported by the current evidence."


class InvalidImportanceError(AAServiceError):
    code = "invalid_importance"
    message = "Unknown importance value."


class InvalidPeriodError(AAServiceError):
    code = "invalid_period"
    message = "A period is YYYY-MM or YYYY between 2000 and 2100."


class PeriodInFutureError(AAServiceError):
    code = "period_in_future"
    message = "This period has not started yet."


class PeriodNotEndedError(AAServiceError):
    code = "period_not_ended"
    message = "A review can be finalized only after its period has ended."


class RevisionConflictError(AAServiceError):
    code = "revision_conflict"
    message = "The review has a newer revision than the one this change was based on."


class RevisionNotFoundError(AAServiceError):
    code = "revision_not_found"
    message = "Saved review revision not found."


class InvalidSystemReviewError(AAServiceError):
    code = "invalid_system_review"
    message = "Invalid system review payload."


class InvalidFinanceContextError(AAServiceError):
    code = "invalid_finance_context"
    message = "Invalid finance context."


class FinanceContextNotFoundError(AAServiceError):
    code = "finance_context_not_found"
    message = "Finance context not found."


class FinanceContextConflictError(AAServiceError):
    code = "finance_context_conflict"
    message = "This item already has a finance context of this kind."


class IdempotencyKeyReusedError(AAServiceError):
    code = "idempotency_key_reused"
    message = "This idempotency key already belongs to a different write."


class InvalidExportFormatError(AAServiceError):
    code = "invalid_export_format"
    message = "Export format is one of pdf, docx, xlsx, md."
