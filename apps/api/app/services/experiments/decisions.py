"""Experiment decision + factors — the user's own «что дальше» and «что могло повлиять».

Every save appends one ``aa_decisions`` row (experiment scope) carrying the
choice the user saw at save time — possibly ``NULL``. That row is the
experiment's revision ledger: factors added or retracted in a save carry its
revision number. Nothing is overwritten; the previous decision is marked with
the revision that superseded it. The lifecycle is never touched here.
"""

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.enums import DecisionScope
from app.models import AADecision, AAReviewFactor
from app.services.experiments.contracts import DECISION_LIFECYCLES, load_owned
from app.services.experiments.errors import (
    ExperimentIdempotencyKeyReusedError,
    InvalidExperimentFactorError,
    NotAwaitingDecisionError,
)

SCOPE = DecisionScope.EXPERIMENT.value


def _by_key(db: Session, *, user_id: UUID, key: str) -> AADecision | None:
    return db.scalar(
        select(AADecision).where(AADecision.user_id == user_id, AADecision.idempotency_key == key)
    )


def _is_replay(row: AADecision | None, experiment_id: UUID) -> bool:
    if row is None:
        return False
    if row.scope != SCOPE or row.experiment_id != experiment_id:
        raise ExperimentIdempotencyKeyReusedError
    return True


def record_decision(
    db: Session, *, user_id: UUID, experiment_id: UUID, request: Any
) -> bool:
    """Append one decision revision. Returns ``replayed``."""
    key = request.idempotency_key
    if _is_replay(_by_key(db, user_id=user_id, key=key), experiment_id):
        return True
    try:
        experiment = load_owned(db, user_id=user_id, experiment_id=experiment_id, for_update=True)
        if experiment.lifecycle not in DECISION_LIFECYCLES:
            raise NotAwaitingDecisionError
        revision = (
            db.scalar(
                select(func.max(AADecision.revision)).where(
                    AADecision.experiment_id == experiment_id
                )
            )
            or 0
        ) + 1

        current = db.scalar(
            select(AADecision)
            .where(
                AADecision.experiment_id == experiment_id,
                AADecision.superseded_in_revision.is_(None),
            )
            .with_for_update()
        )
        if current is not None:
            current.superseded_in_revision = revision
            db.flush()
        db.add(
            AADecision(
                id=uuid4(),
                user_id=user_id,
                scope=SCOPE,
                experiment_id=experiment_id,
                choice=None if request.choice is None else str(request.choice),
                revision=revision,
                idempotency_key=key,
            )
        )

        own_factors = select(AAReviewFactor).where(
            AAReviewFactor.user_id == user_id,
            AAReviewFactor.scope == SCOPE,
            AAReviewFactor.experiment_id == experiment_id,
        )
        retract = set(request.retract_factor_ids)
        if retract:
            rows = db.scalars(
                own_factors.where(
                    AAReviewFactor.id.in_(retract),
                    AAReviewFactor.retracted_in_revision.is_(None),
                )
            ).all()
            if len(rows) != len(retract):
                raise InvalidExperimentFactorError
            for row in rows:
                row.retracted_in_revision = revision

        if request.add_factors:
            known = {row.id for row in db.scalars(own_factors)}
            next_ordinal = (
                db.scalar(
                    select(func.max(AAReviewFactor.ordinal)).where(
                        AAReviewFactor.experiment_id == experiment_id
                    )
                )
                or 0
            ) + 1
            for offset, factor in enumerate(request.add_factors):
                if factor.replaces_id is not None and factor.replaces_id not in known:
                    raise InvalidExperimentFactorError
                db.add(
                    AAReviewFactor(
                        id=uuid4(),
                        user_id=user_id,
                        scope=SCOPE,
                        experiment_id=experiment_id,
                        ordinal=next_ordinal + offset,
                        text=factor.text,
                        epistemic_kind=str(factor.epistemic_kind),
                        added_in_revision=revision,
                        replaces_id=factor.replaces_id,
                    )
                )
        db.commit()
    except IntegrityError:
        db.rollback()
        if _is_replay(_by_key(db, user_id=user_id, key=key), experiment_id):
            return True
        raise
    except BaseException:
        db.rollback()
        raise
    return False
