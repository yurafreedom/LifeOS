"""C7 membership reconstructed solely from captured immutable AA history."""

from dataclasses import dataclass

from sqlalchemy import select

from app.analytics.asof import apply_as_of
from app.models import AAMetricMembershipOverride, AAMetricPolicyVersion
from app.services.aa_comparison import append_version
from app.services.aa_facts import get_measurement


@dataclass(frozen=True)
class Membership:
    included: bool | None
    policy_known: bool
    basis: str


def record_policy(db, *, user_id, request):
    return append_version(db, user_id=user_id, model=AAMetricPolicyVersion, request=request)


def record_override(db, *, user_id, request):
    return append_version(db, user_id=user_id, model=AAMetricMembershipOverride, request=request)


def _override_as_of(db, *, user_id, metric_key, fact_id, as_of):
    model = AAMetricMembershipOverride
    return db.scalar(
        apply_as_of(
            select(model).where(
                model.user_id == user_id,
                model.metric_key == metric_key,
                model.source_fact_id == fact_id,
            ),
            model,
            as_of,
        )
        .order_by(model.recorded_at.desc(), model.id.desc())
        .limit(1)
    )


def _inherited_override_as_of(db, *, user_id, metric_key, fact, as_of):
    """Resolve an override through a correction chain without rewriting it.

    A correction changes the value, not the user's inclusion decision. An
    override attached to the original therefore remains in force for its
    replacement until the replacement receives its own override. Ancestor
    lookups are capped at the correction's recorded time so a later write
    against an obsolete fact cannot retroactively change its replacement.
    """
    current = fact
    cutoff = as_of
    seen = set()
    while current.id not in seen:
        seen.add(current.id)
        override = _override_as_of(
            db,
            user_id=user_id,
            metric_key=metric_key,
            fact_id=current.id,
            as_of=cutoff,
        )
        if override is not None:
            return override
        if current.supersedes_id is None:
            break
        cutoff = min(cutoff, current.recorded_at)
        current = get_measurement(
            db, user_id=user_id, measurement_id=current.supersedes_id
        )
    return None


def membership_as_of(db, *, user_id, metric_key, fact_id, as_of):
    fact = get_measurement(db, user_id=user_id, measurement_id=fact_id)
    if fact.recorded_at > as_of or fact.status == "tombstoned":
        return Membership(None, False, "fact_not_known")
    override = _inherited_override_as_of(
        db,
        user_id=user_id,
        metric_key=metric_key,
        fact=fact,
        as_of=as_of,
    )
    if override:
        return Membership(override.included, True, "override")
    model = AAMetricPolicyVersion
    policy = db.scalar(
        apply_as_of(
            select(model).where(
                model.user_id == user_id,
                model.metric_key == metric_key,
                model.effective_from <= as_of,
            ),
            model,
            as_of,
        )
        .order_by(model.recorded_at.desc(), model.id.desc())
        .limit(1)
    )
    dimensions = fact.dimensions or {}
    if policy:
        if policy.policy["exclude_categories"] and "category_id" not in dimensions:
            return Membership(None, True, "category_unknown")
        excluded = dimensions.get("category_id") in policy.policy["exclude_categories"]
        return Membership(not excluded and policy.policy["default"] == "include", True, "policy")
    included = dimensions.get("included_by_default")
    return Membership(
        included if isinstance(included, bool) else None,
        False,
        "captured_default" if isinstance(included, bool) else "policy_unknown",
    )
