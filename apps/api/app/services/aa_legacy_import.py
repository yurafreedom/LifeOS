"""Explicit, retry-safe reconstruction of genuine legacy transaction facts."""

import hashlib
from datetime import UTC, datetime, time
from decimal import Decimal, InvalidOperation
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.analytics.enums import SourceKind
from app.analytics.subjects import SubjectRef
from app.schemas.aa_common import ProvenanceIn, SubjectIn, ValueIn
from app.schemas.aa_comparison import OverrideCreate, Policy, PolicyCreate
from app.schemas.aa_finance import LegacyImportCreate, LegacyImportOut
from app.schemas.aa_measurement import MeasurementCreate
from app.services.aa_coverage_claims import CoverageClaimRequest, record_coverage_claim
from app.services.aa_facts import append_measurement
from app.services.aa_metric_policy import record_override, record_policy
from app.services.state import get_user_snapshot

TRANSACTION_METRIC = "finance.transaction_amount"
MONTHLY_METRIC = "finance.monthly_spend"


def _key(prefix: str, identity: str) -> str:
    return f"legacy-{prefix}-{hashlib.sha256(identity.encode()).hexdigest()}"


def _transaction_key(transaction_id: str) -> str:
    readable = f"legacy-transaction:{transaction_id}"
    return readable if len(readable) <= 200 else _key("transaction", transaction_id)


def _legacy_provenance(*, transaction_id: str | None = None) -> ProvenanceIn:
    return ProvenanceIn(
        source_kind=SourceKind.IMPORTED,
        basis="Existing genuine snapshot transaction",
        method="LEGACY_IMPORT",
        source_ref={"snapshot_transaction_id": transaction_id} if transaction_id else None,
        original_recorded_at_known=False,
    )


def import_legacy_transactions(
    db: Session, *, user_id: UUID, request: LegacyImportCreate
) -> LegacyImportOut:
    snapshot = get_user_snapshot(db, user_id=user_id)
    payload = snapshot.payload if snapshot is not None else {}
    transactions = payload.get("transactions", [])
    if not isinstance(transactions, list):
        raise ValueError("snapshot transactions must be an array")
    category_overrides = payload.get("categoryOverrides", {})
    if not isinstance(category_overrides, dict):
        category_overrides = {}

    imported = replayed = overrides_imported = overrides_replayed = 0
    for item in transactions:
        if not isinstance(item, dict):
            raise ValueError("snapshot transaction must be an object")
        transaction_id = str(item.get("id", "")).strip()
        transaction_date = str(item.get("date", "")).strip()
        if not transaction_id or not transaction_date:
            raise ValueError("snapshot transaction id and date are required")
        try:
            amount = Decimal(str(item["amount"]))
            occurred_date = datetime.strptime(transaction_date, "%Y-%m-%d").date()
        except (KeyError, InvalidOperation, ValueError):
            raise ValueError("snapshot transaction amount/date is invalid") from None
        if amount < 0:
            raise ValueError("snapshot transaction amount must not be negative")
        category_id = str(item.get("category_id", ""))
        setting = category_overrides.get(category_id, {})
        category_included = not (
            isinstance(setting, dict) and setting.get("included_in_totals") is False
        )
        result = append_measurement(
            db,
            user_id=user_id,
            request=MeasurementCreate(
                metric_key=TRANSACTION_METRIC,
                subject=SubjectIn(domain="finance", type="transaction", id=transaction_id),
                value=ValueIn(type="money", unit_code="UAH", num=amount),
                occurred_at=datetime.combine(
                    occurred_date, time.min, tzinfo=ZoneInfo(request.timezone)
                ),
                occurred_tz=request.timezone,
                provenance=_legacy_provenance(transaction_id=transaction_id),
                dimensions={
                    "category_id": category_id,
                    "included_by_default": category_included,
                    "legacy_source": item.get("source"),
                },
                idempotency_key=_transaction_key(transaction_id),
            ),
        )
        replayed += int(result.replayed)
        imported += int(not result.replayed)
        # Category intent belongs to the versioned policy. Only an explicit
        # per-transaction choice belongs in the sparse override table.
        if item.get("included_in_totals") is False:
            _, was_replayed = record_override(
                db,
                user_id=user_id,
                request=OverrideCreate(
                    metric_key=MONTHLY_METRIC,
                    source_fact_id=result.measurement.id,
                    included=False,
                    provenance=_legacy_provenance(transaction_id=transaction_id),
                    idempotency_key=_key("membership", transaction_id),
                ),
            )
            overrides_replayed += int(was_replayed)
            overrides_imported += int(not was_replayed)

    excluded_categories = sorted(
        str(category_id)
        for category_id, setting in category_overrides.items()
        if isinstance(setting, dict) and setting.get("included_in_totals") is False
    )
    _, policy_replayed = record_policy(
        db,
        user_id=user_id,
        request=PolicyCreate(
            metric_key=MONTHLY_METRIC,
            policy=Policy(exclude_categories=excluded_categories, default="include"),
            effective_from=datetime.now(UTC),
            provenance=_legacy_provenance(),
            idempotency_key=_key(
                "policy", ",".join(excluded_categories) or "default-include"
            ),
        ),
    )

    coverage_imported = coverage_replayed = 0
    for claim in request.coverage:
        _, was_replayed = record_coverage_claim(
            db,
            user_id=user_id,
            request=CoverageClaimRequest(
                source_id=claim.source_id,
                subject=SubjectRef("finance", "period", claim.period),
                window_start_date=claim.window_start,
                window_end_date=claim.window_end,
                timezone=claim.timezone,
                coverage_state=claim.coverage_state,
                completeness_known=claim.completeness_known,
                source_kind=SourceKind.IMPORTED,
                metric_key=MONTHLY_METRIC,
                basis="Explicit legacy-source coverage declaration",
                method="LEGACY_IMPORT",
                source_ref={"source_id": claim.source_id},
                original_recorded_at_known=False,
                idempotency_key=_key(
                    "coverage",
                    f"{claim.source_id}:{claim.period}:{claim.window_start}:{claim.window_end}",
                ),
            ),
        )
        coverage_replayed += int(was_replayed)
        coverage_imported += int(not was_replayed)

    return LegacyImportOut(
        transactions_imported=imported,
        transactions_replayed=replayed,
        policies_imported=int(not policy_replayed),
        policies_replayed=int(policy_replayed),
        overrides_imported=overrides_imported,
        overrides_replayed=overrides_replayed,
        coverage_imported=coverage_imported,
        coverage_replayed=coverage_replayed,
    )
