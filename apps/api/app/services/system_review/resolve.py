"""Ownership resolution for ref keys. A foreign item and a missing item look the same.

``change`` refs are value-free derivations and need no row. ``subject`` refs
need this account to hold facts for the subject (or, for an experiment, the
experiment itself). ``fact`` and ``context`` refs name one owned row.
"""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.enums import FactStatus
from app.models import (
    AABaseline,
    AACrossReference,
    AAExpectationVersion,
    AAExperiment,
    AAExperimentObservation,
    AAFinanceContext,
    AAForecastVersion,
    AAMeasurement,
    AAObservation,
    AAPreference,
    AATarget,
)
from app.services.aa_facts import FactNotFoundError
from app.services.aa_subjects import require_subject
from app.services.system_review.errors import InvalidRefError, RefNotFoundError
from app.services.system_review.refs import Ref, RefKind, parse_ref

FACT_MODELS = {
    "aa_measurements": AAMeasurement,
    "aa_observations": AAObservation,
    "aa_targets": AATarget,
    "aa_preferences": AAPreference,
    "aa_baselines": AABaseline,
    "aa_expectation_versions": AAExpectationVersion,
    "aa_forecast_versions": AAForecastVersion,
    "aa_experiment_observations": AAExperimentObservation,
}
ENDPOINT_KINDS = (RefKind.CHANGE, RefKind.SUBJECT, RefKind.FACT, RefKind.CONTEXT)


@dataclass(frozen=True, slots=True)
class Resolved:
    ref: Ref
    domain: str


def active_context(db: Session, *, user_id: UUID, entity_id: UUID) -> AAFinanceContext | None:
    return db.scalar(
        select(AAFinanceContext).where(
            AAFinanceContext.user_id == user_id,
            AAFinanceContext.entity_id == entity_id,
            AAFinanceContext.status == "active",
        )
    )


def resolve(db: Session, *, user_id: UUID, key: str, endpoint: bool = False) -> Resolved:
    ref = parse_ref(key)
    if endpoint and ref.kind not in ENDPOINT_KINDS:
        raise InvalidRefError
    if ref.kind is RefKind.SUBJECT:
        assert ref.subject is not None
        if ref.subject.subject_domain == "experiment":
            try:
                experiment_id = UUID(ref.subject.subject_id)
            except ValueError:
                raise RefNotFoundError from None
            found = db.scalar(
                select(AAExperiment.id).where(
                    AAExperiment.user_id == user_id, AAExperiment.id == experiment_id
                )
            )
            if found is None:
                raise RefNotFoundError
        else:
            try:
                require_subject(db, user_id=user_id, subject_key=ref.subject.subject_key)
            except FactNotFoundError:
                raise RefNotFoundError from None
        return Resolved(ref, ref.subject.subject_domain)
    if ref.kind is RefKind.FACT:
        model = FACT_MODELS[ref.table or ""]
        row = db.scalar(
            select(model).where(
                model.user_id == user_id,
                model.id == ref.identity,
                model.status != FactStatus.TOMBSTONED,
            )
        )
        if row is None:
            raise RefNotFoundError
        domain = "observation" if ref.table == "aa_observations" else row.subject_domain
        return Resolved(ref, domain)
    if ref.kind is RefKind.CONTEXT:
        assert ref.identity is not None
        if active_context(db, user_id=user_id, entity_id=ref.identity) is None:
            raise RefNotFoundError
        return Resolved(ref, "finance")
    if ref.kind is RefKind.RELATION:
        found = db.scalar(
            select(AACrossReference.id).where(
                AACrossReference.user_id == user_id, AACrossReference.id == ref.identity
            )
        )
        if found is None:
            raise RefNotFoundError
    return Resolved(ref, ref.domain)
