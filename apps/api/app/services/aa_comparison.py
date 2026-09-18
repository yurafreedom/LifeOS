"""Append semantic versions with per-grain serialization and no value rewriting."""

import hashlib
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.models import (
    AABaseline,
    AAExpectationVersion,
    AAForecastVersion,
    AAMetricMembershipOverride,
    AAMetricPolicyVersion,
    AAObservation,
    AAPreference,
    AATarget,
)
from app.services.aa_facts import (
    AAServiceError,
    MetricValueMismatchError,
    _assert_value_matches_metric,
    _resolve_metric,
    get_measurement,
)

CONCEPT_MODELS = {
    "expectation": AAExpectationVersion,
    "forecast": AAForecastVersion,
    "baseline": AABaseline,
    "target": AATarget,
    "preference": AAPreference,
    "observation": AAObservation,
}
SEMANTIC_TABLES = {model.__tablename__: model for model in CONCEPT_MODELS.values()}
SEMANTIC_TABLES.update(
    aa_metric_policy_versions=AAMetricPolicyVersion,
    aa_metric_membership_overrides=AAMetricMembershipOverride,
)


class EffectiveOrderError(AAServiceError):
    code = "effective_order_conflict"
    message = "New versions must not precede the effective time of the prior version."


def append_version(db, *, user_id, model, request, concept=None):
    """All callers supply a concept-specific request, never a kind payload.

    Advisory transaction locks serialize a semantic grain, including its first
    insert, so concurrent revisions cannot leave two live versions. Replay is
    checked again under the lock. Value columns of old rows never change.
    """
    replay_query = select(model).where(
        model.user_id == user_id, model.idempotency_key == request.idempotency_key
    )
    existing = db.scalar(replay_query)
    if existing:
        return existing, True
    payload = request.model_dump(exclude={"subject", "value", "provenance", "declared_value_type"})
    predicates = [model.user_id == user_id, model.metric_key == request.metric_key]
    grain = [str(user_id), model.__tablename__, request.metric_key]
    if hasattr(request, "subject"):
        subject = request.subject.to_ref()
        payload.update(
            subject_domain=subject.subject_domain,
            subject_type=subject.subject_type,
            subject_id=subject.subject_id,
        )
        predicates.append(model.subject_key == subject.subject_key)
        grain.append(subject.subject_key)
    if hasattr(request, "window_start"):
        predicates += [
            model.window_start == request.window_start,
            model.window_end == request.window_end,
            model.timezone == request.timezone,
        ]
        grain += [str(request.window_start), str(request.window_end), request.timezone]
    if hasattr(request, "source_fact_id"):
        get_measurement(db, user_id=user_id, measurement_id=request.source_fact_id)
        predicates.append(model.source_fact_id == request.source_fact_id)
        grain.append(str(request.source_fact_id))
    if request.metric_key:
        definition = _resolve_metric(db, request.metric_key)
        if getattr(request, "value", None):
            _assert_value_matches_metric(definition, request.value)
        declared = getattr(request, "declared_value_type", None)
        if declared and declared != definition.value_type:
            raise MetricValueMismatchError
    lock = int.from_bytes(hashlib.sha256(repr(grain).encode()).digest()[:8], "big", signed=True)
    try:
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
        existing = db.scalar(replay_query)
        if existing:
            db.commit()
            return existing, True
        now = datetime.now(UTC)
        if hasattr(model, "value_type"):
            value = getattr(request, "value", None)
            payload["value_type"] = (
                value.type
                if value
                else (getattr(request, "declared_value_type", None) or definition.value_type)
            )
            if value:
                payload.update(value.to_fact_value().column_values())
        if hasattr(request, "policy"):
            payload["policy"] = request.policy.model_dump()
            if not request.provenance.original_recorded_at_known and request.effective_from < now:
                # C7 legacy policy begins when captured, never backdated.
                payload["effective_from"] = now
        payload.update(
            request.provenance.model_dump(), user_id=user_id, id=uuid4(), recorded_at=now
        )
        prior = None
        if concept not in ("baseline", "observation"):
            prior = db.scalar(
                select(model)
                .where(*predicates, model.status == "active")
                .order_by(model.recorded_at.desc(), model.id.desc())
                .limit(1)
                .with_for_update()
            )
        if prior and hasattr(model, "effective_from"):
            if payload["effective_from"] < prior.effective_from:
                raise EffectiveOrderError
        row = model(**payload)
        if prior:
            row.supersedes_id = prior.id
        db.add(row)
        db.flush()
        if prior:
            prior.status = "superseded"
            prior.superseded_by_id = row.id
            prior.superseded_at = max(now, getattr(row, "effective_from", now))
            prior.supersede_kind = "REVISION"
            db.flush()
        db.commit()
        db.refresh(row)
        return row, False
    except IntegrityError:
        db.rollback()
        existing = db.scalar(replay_query)
        if existing:
            return existing, True
        raise
    except BaseException:
        db.rollback()
        raise


def append_semantic(db, *, user_id, concept, request):
    return append_version(
        db, user_id=user_id, model=CONCEPT_MODELS[concept], request=request, concept=concept
    )
