"""M6 · Experiments schema: migration roundtrip, scoped decisions/factors, DB backstops.

Every test here talks to the database directly. The service normally keeps these
rows legal; the point is that the schema alone refuses an illegal *shape* even
when a write bypasses the service.
"""

import re
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.analytics.enums import (
    AdherenceState,
    ExperimentLifecycle,
    ExperimentObservationRole,
    ExperimentOutcomeType,
    members,
)
from app.models import (
    AADecision,
    AAExperiment,
    AAExperimentAdherence,
    AAExperimentObservation,
    AAReviewFactor,
)
from tests.test_aa_m2_migration import protected_schema
from tests.test_aa_schema_guards import constraint_definition

M5 = "20260928_0006"
M6 = "20260929_0007"
EXPERIMENT_TABLES = ("aa_experiments", "aa_experiment_adherence", "aa_experiment_observations")
WIDENED = ("aa_decisions", "aa_review_factors")
QUOTED = re.compile(r"'([^']*)'")
KYIV = "Europe/Kyiv"


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC)


def _config(test_database_url: str) -> Config:
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", test_database_url)
    return config


def _shape(engine, table: str) -> dict:
    """Everything that makes a table's contract, rendered by PostgreSQL itself."""
    with engine.begin() as connection:
        constraints = dict(
            connection.execute(
                text(
                    "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint"
                    " WHERE conrelid = CAST(:table AS regclass)"
                ),
                {"table": table},
            ).all()
        )
        indexes = dict(
            connection.execute(
                text("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = :table"),
                {"table": table},
            ).all()
        )
    columns = [
        (c["name"], str(c["type"]), c["nullable"], c["default"])
        for c in inspect(engine).get_columns(table)
    ]
    return {"constraints": constraints, "indexes": indexes, "columns": columns}


def _execute(engine, sql: str, **params) -> None:
    with engine.begin() as connection:
        connection.execute(text(sql), params)


def insert_experiment(engine, user_id, **columns) -> str:
    values = {
        "id": str(uuid4()),
        "user_id": user_id,
        "title": "Экран до 23:00",
        "hypothesis": "Без экрана после 23:00 я засыпаю быстрее.",
        "hypothesis_recorded_at": utc(2026, 9, 1, 8),
        "intervention": "Телефон в другой комнате с 23:00.",
        "window_start": date(2026, 9, 2),
        "window_end": date(2026, 9, 22),
        "timezone": KYIV,
        "outcome_label": "Время засыпания",
        "outcome_value_type": "duration",
        "outcome_unit_code": "minute",
        "lifecycle": "DRAFT",
        "idempotency_key": f"exp-{uuid4()}",
    }
    values.update(columns)
    names = ", ".join(values)
    placeholders = ", ".join(f":{name}" for name in values)
    _execute(engine, f"INSERT INTO aa_experiments ({names}) VALUES ({placeholders})", **values)
    return values["id"]


# ───────────────────── M1 · migration roundtrip ─────────────────────


def test_m6_chain_is_linear_on_m5(test_database_url):
    script = ScriptDirectory.from_config(_config(test_database_url))
    # M7 (Slice 7) sits directly on M6; M8 (Slice 8) is the head.
    assert script.get_heads() == ["20260930_0009"]
    assert script.get_revision("20260930_0008").down_revision == M6
    assert script.get_revision(M6).down_revision == M5


def test_m6_roundtrip_restores_exact_m5_and_keeps_review_rows(
    engine, test_database_url, account_factory
):
    owner = account_factory("m6-roundtrip@example.com")
    config = _config(test_database_url)
    protected = protected_schema(engine)
    earlier = {
        name: _shape(engine, name)
        for name in inspect(engine).get_table_names()
        if name.startswith("aa_") and name not in EXPERIMENT_TABLES + WIDENED
    }
    # A freshly created M5, to compare the downgraded M5 against.
    command.downgrade(config, "20260928_0005")
    try:
        command.upgrade(config, M5)
        fresh_m5 = {name: _shape(engine, name) for name in WIDENED}

        review_id, decision_id, factor_id = uuid4(), uuid4(), uuid4()
        _execute(
            engine,
            "INSERT INTO aa_reviews (id, user_id, subject_domain, subject_type, subject_id,"
            " window_start, window_end, timezone, context_as_of, render_manifest)"
            " VALUES (:id, :u, 'finance', 'period', '2026-08', '2026-08-01', '2026-08-31',"
            " 'Europe/Kyiv', now(), '{}'::jsonb)",
            id=review_id,
            u=owner.user_id,
        )
        _execute(
            engine,
            "INSERT INTO aa_decisions (id, user_id, scope, review_id, choice, revision)"
            " VALUES (:id, :u, 'review', :r, 'later', 1)",
            id=decision_id,
            u=owner.user_id,
            r=review_id,
        )
        _execute(
            engine,
            "INSERT INTO aa_review_factors (id, user_id, review_id, ordinal, text,"
            " epistemic_kind, added_in_revision) VALUES (:id, :u, :r, 1, 'Отпуск', 'mine', 1)",
            id=factor_id,
            u=owner.user_id,
            r=review_id,
        )

        command.upgrade(config, M6)
        with engine.begin() as connection:
            decision = connection.execute(
                text(
                    "SELECT scope, review_id, experiment_id, idempotency_key, choice"
                    " FROM aa_decisions WHERE id = :id"
                ),
                {"id": decision_id},
            ).one()
            factor = connection.execute(
                text("SELECT scope, review_id, experiment_id FROM aa_review_factors WHERE id = :id"),
                {"id": factor_id},
            ).one()
        assert tuple(decision) == ("review", review_id, None, None, "later")
        assert tuple(factor) == ("review", review_id, None)

        # Experiment-scoped history present: the downgrade must still succeed.
        experiment_id = insert_experiment(
            engine,
            owner.user_id,
            lifecycle="COMPLETED_AWAITING_REVIEW",
            started_at=utc(2026, 9, 2, 6),
            start_key="k-start",
            completed_at=utc(2026, 9, 23, 6),
            complete_key="k-complete",
        )
        _execute(
            engine,
            "INSERT INTO aa_decisions (id, user_id, scope, experiment_id, choice, revision,"
            " idempotency_key) VALUES (:id, :u, 'experiment', :e, 'reject', 1, 'k-decision')",
            id=uuid4(),
            u=owner.user_id,
            e=experiment_id,
        )
        _execute(
            engine,
            "INSERT INTO aa_review_factors (id, user_id, scope, experiment_id, ordinal, text,"
            " epistemic_kind, added_in_revision)"
            " VALUES (:id, :u, 'experiment', :e, 1, 'Жара', 'maybe', 1)",
            id=uuid4(),
            u=owner.user_id,
            e=experiment_id,
        )

        command.downgrade(config, M5)
        assert not set(EXPERIMENT_TABLES) & set(inspect(engine).get_table_names())
        for name in WIDENED:
            assert _shape(engine, name) == fresh_m5[name], f"M6 downgrade left {name} changed"
        with engine.begin() as connection:
            assert connection.scalar(text("SELECT count(*) FROM aa_decisions")) == 1
            assert connection.scalar(text("SELECT count(*) FROM aa_review_factors")) == 1
            assert connection.scalar(
                text("SELECT choice FROM aa_decisions WHERE id = :id"), {"id": decision_id}
            ) == "later"
    finally:
        command.upgrade(config, "head")

    assert protected_schema(engine) == protected
    for name, shape in earlier.items():
        assert _shape(engine, name) == shape, f"M6 altered {name}"
    inspector = inspect(engine)
    for model in (AAExperiment, AAExperimentAdherence, AAExperimentObservation, AADecision,
                  AAReviewFactor):
        name = model.__tablename__
        assert set(model.__table__.c.keys()) == {c["name"] for c in inspector.get_columns(name)}
        assert {
            check.name for check in model.__table__.constraints
            if check.name and check.name.startswith("ck_")
        } == {check["name"] for check in inspector.get_check_constraints(name)}
        installed = {index["name"] for index in inspector.get_indexes(name)}
        assert {index.name for index in model.__table__.indexes} <= installed


def test_no_experiment_factor_table_and_no_snapshot_change():
    from typing import get_args

    from app.models import Base
    from app.schemas.state import StateEnvelope, StateReplace

    assert "aa_experiment_factors" not in Base.metadata.tables
    assert get_args(StateEnvelope.model_fields["schema_version"].annotation) == (2,)
    assert get_args(StateReplace.model_fields["schema_version"].annotation) == (2,)


# ───────────────────── M2 · enum ↔ CHECK parity ─────────────────────


@pytest.mark.parametrize(
    ("constraint", "expected", "extra"),
    [
        ("ck_aa_experiments_lifecycle", members(ExperimentLifecycle), set()),
        (
            "ck_aa_experiments_abandoned_from",
            tuple(
                m for m in members(ExperimentLifecycle) if m not in ("REVIEWED", "ABANDONED")
            ),
            set(),
        ),
        ("ck_aa_experiments_outcome_value_type", members(ExperimentOutcomeType), set()),
        ("ck_aa_experiment_adherence_state", members(AdherenceState), set()),
        ("ck_aa_experiment_observations_role", members(ExperimentObservationRole), set()),
        (
            "ck_aa_experiment_observations_outcome_comparable",
            members(ExperimentOutcomeType),
            {"outcome"},
        ),
    ],
)
def test_experiment_enums_match_their_database_constraints(engine, constraint, expected, extra):
    found = set(QUOTED.findall(constraint_definition(engine, constraint))) - extra
    assert found == set(expected)


def test_adherence_check_admits_no_derived_state(engine):
    found = set(QUOTED.findall(constraint_definition(engine, "ck_aa_experiment_adherence_state")))
    assert not {"future", "not_recorded", "not_run_after_stop"} & found


# ───────────────────── L7 · lifecycle shape backstops ─────────────────────

STARTED = {"started_at": utc(2026, 9, 2, 6), "start_key": "s"}
COMPLETED = {**STARTED, "completed_at": utc(2026, 9, 23, 6), "complete_key": "c"}


@pytest.mark.parametrize(
    "columns",
    [
        pytest.param({"lifecycle": "PAUSED"}, id="unknown-lifecycle"),
        pytest.param({"lifecycle": "RUNNING"}, id="running-without-start"),
        pytest.param(
            {"lifecycle": "REVIEWED", **STARTED, "reviewed_at": utc(2026, 9, 24), "review_key": "r"},
            id="reviewed-without-completion",
        ),
        pytest.param(
            {
                "lifecycle": "ABANDONED",
                **COMPLETED,
                "reviewed_at": utc(2026, 9, 24),
                "review_key": "r",
                "abandoned_at": utc(2026, 9, 25),
                "abandon_key": "a",
                "abandoned_from": "COMPLETED_AWAITING_REVIEW",
            },
            id="abandoned-and-reviewed",
        ),
        pytest.param(
            {
                "lifecycle": "ABANDONED",
                "abandoned_at": utc(2026, 9, 5),
                "abandon_key": "a",
                "abandoned_from": "RUNNING",
            },
            id="abandoned-from-running-without-start",
        ),
        pytest.param(
            {
                "lifecycle": "ABANDONED",
                **STARTED,
                "abandoned_at": utc(2026, 9, 5),
                "abandon_key": "a",
                "abandoned_from": "REVIEWED",
            },
            id="abandoned-from-terminal",
        ),
        pytest.param(
            {"lifecycle": "ABANDONED", "abandoned_at": utc(2026, 9, 5), "abandon_key": "a"},
            id="abandoned-without-origin",
        ),
        pytest.param(
            {"lifecycle": "RUNNING", "started_at": utc(2026, 9, 2)}, id="half-start-pair"
        ),
        pytest.param(
            {"lifecycle": "RUNNING", "started_at": utc(2026, 8, 1), "start_key": "s"},
            id="start-before-hypothesis",
        ),
        pytest.param(
            {
                "lifecycle": "COMPLETED_AWAITING_REVIEW",
                **STARTED,
                "completed_at": utc(2026, 9, 1),
                "complete_key": "c",
            },
            id="completion-before-start",
        ),
        pytest.param({"window_end": date(2026, 9, 1)}, id="window-reversed"),
        pytest.param({"window_end": date(2027, 9, 3)}, id="window-too-long"),
        pytest.param({"outcome_value_type": "categorical"}, id="outcome-categorical"),
        pytest.param({"outcome_unit_code": "hour"}, id="outcome-duration-unit"),
        pytest.param({"title": "  "}, id="blank-title"),
    ],
)
def test_illegal_experiment_shapes_are_rejected(engine, account_factory, columns):
    owner = account_factory(f"m6-shape-{uuid4().hex[:8]}@example.com")
    with pytest.raises(IntegrityError):
        insert_experiment(engine, owner.user_id, **columns)


def test_legal_shapes_for_every_lifecycle_are_accepted(engine, account_factory):
    owner = account_factory("m6-legal@example.com")
    insert_experiment(engine, owner.user_id)
    insert_experiment(engine, owner.user_id, lifecycle="RUNNING", **STARTED | {"start_key": "s1"})
    insert_experiment(
        engine,
        owner.user_id,
        lifecycle="REVIEWED",
        **COMPLETED | {"start_key": "s2", "complete_key": "c2"},
        reviewed_at=utc(2026, 9, 24),
        review_key="r2",
    )
    for origin, extra in (("DRAFT", {}), ("RUNNING", STARTED), ("COMPLETED_AWAITING_REVIEW", COMPLETED)):
        suffix = uuid4().hex[:6]
        keyed = {
            key: (f"{value}-{suffix}" if key.endswith("_key") else value)
            for key, value in extra.items()
        }
        insert_experiment(
            engine,
            owner.user_id,
            lifecycle="ABANDONED",
            abandoned_at=utc(2026, 9, 25),
            abandon_key=f"a-{suffix}",
            abandoned_from=origin,
            **keyed,
        )


def test_a_legal_update_cannot_rewrite_a_terminal_row_into_an_illegal_shape(
    engine, account_factory
):
    owner = account_factory("m6-update@example.com")
    experiment_id = insert_experiment(
        engine,
        owner.user_id,
        lifecycle="ABANDONED",
        abandoned_at=utc(2026, 9, 3),
        abandon_key="a",
        abandoned_from="DRAFT",
    )
    with pytest.raises(IntegrityError):
        _execute(
            engine,
            "UPDATE aa_experiments SET lifecycle = 'REVIEWED' WHERE id = :id",
            id=experiment_id,
        )


# ───────────────────── E4 · scoped decisions and factors ─────────────────────


def _review(engine, user_id) -> str:
    review_id = str(uuid4())
    _execute(
        engine,
        "INSERT INTO aa_reviews (id, user_id, subject_domain, subject_type, subject_id,"
        " window_start, window_end, timezone, context_as_of, render_manifest)"
        " VALUES (:id, :u, 'finance', 'period', '2026-08', '2026-08-01', '2026-08-31',"
        " 'Europe/Kyiv', now(), '{}'::jsonb)",
        id=review_id,
        u=user_id,
    )
    return review_id


def _decision(engine, user_id, **columns) -> None:
    values = {"id": str(uuid4()), "user_id": user_id, "revision": 1, **columns}
    names = ", ".join(values)
    placeholders = ", ".join(f":{name}" for name in values)
    _execute(engine, f"INSERT INTO aa_decisions ({names}) VALUES ({placeholders})", **values)


@pytest.mark.parametrize("choice", ["modify", "longer", "reject"])
def test_a_review_decision_cannot_store_an_experiment_only_choice(engine, account_factory, choice):
    owner = account_factory(f"m6-rc-{choice}@example.com")
    review_id = _review(engine, owner.user_id)
    with pytest.raises(IntegrityError):
        _decision(engine, owner.user_id, scope="review", review_id=review_id, choice=choice)


@pytest.mark.parametrize("choice", ["adjust", "later"])
def test_an_experiment_decision_cannot_store_a_review_only_choice(engine, account_factory, choice):
    owner = account_factory(f"m6-ec-{choice}@example.com")
    experiment_id = insert_experiment(engine, owner.user_id)
    with pytest.raises(IntegrityError):
        _decision(
            engine,
            owner.user_id,
            scope="experiment",
            experiment_id=experiment_id,
            choice=choice,
            idempotency_key="k",
        )


def test_legal_choice_combinations_and_the_tri_state_are_accepted(engine, account_factory):
    owner = account_factory("m6-choices@example.com")
    for choice in ("keep", "adjust", "later", "inconclusive", None):
        review_id = _review(engine, owner.user_id)
        _decision(engine, owner.user_id, scope="review", review_id=review_id, choice=choice)
    experiment_id = insert_experiment(engine, owner.user_id)
    choices = ("keep", "modify", "longer", "reject", "inconclusive", None)
    for revision, choice in enumerate(choices, start=1):
        _decision(
            engine,
            owner.user_id,
            scope="experiment",
            experiment_id=experiment_id,
            choice=choice,
            revision=revision,
            superseded_in_revision=revision + 1 if revision < len(choices) else None,
            idempotency_key=f"k-{revision}",
        )


@pytest.mark.parametrize(
    "shape",
    ["both-parents", "no-parent", "review-scope-experiment-parent", "experiment-without-key",
     "review-with-key"],
)
def test_decision_parent_and_key_shape_is_enforced(engine, account_factory, shape):
    owner = account_factory(f"m6-parent-{shape}@example.com")
    review_id = _review(engine, owner.user_id)
    experiment_id = insert_experiment(engine, owner.user_id)
    columns = {
        "both-parents": {
            "scope": "experiment",
            "review_id": review_id,
            "experiment_id": experiment_id,
            "idempotency_key": "k",
        },
        "no-parent": {"scope": "review"},
        "review-scope-experiment-parent": {"scope": "review", "experiment_id": experiment_id},
        "experiment-without-key": {"scope": "experiment", "experiment_id": experiment_id},
        "review-with-key": {"scope": "review", "review_id": review_id, "idempotency_key": "k"},
    }[shape]
    with pytest.raises(IntegrityError):
        _decision(engine, owner.user_id, **columns)


def test_one_current_decision_per_experiment(engine, account_factory):
    owner = account_factory("m6-current@example.com")
    experiment_id = insert_experiment(engine, owner.user_id)
    _decision(
        engine, owner.user_id, scope="experiment", experiment_id=experiment_id,
        choice="keep", idempotency_key="k1",
    )
    with pytest.raises(IntegrityError):
        _decision(
            engine, owner.user_id, scope="experiment", experiment_id=experiment_id,
            choice="reject", revision=2, idempotency_key="k2",
        )


@pytest.mark.parametrize("shape", ["both-parents", "no-parent", "unknown-scope"])
def test_factor_scope_integrity(engine, account_factory, shape):
    owner = account_factory(f"m6-factor-{shape}@example.com")
    review_id = _review(engine, owner.user_id)
    experiment_id = insert_experiment(engine, owner.user_id)
    columns = {
        "both-parents": {"scope": "experiment", "review_id": review_id,
                         "experiment_id": experiment_id},
        "no-parent": {"scope": "experiment"},
        "unknown-scope": {"scope": "system", "review_id": review_id},
    }[shape]
    values = {
        "id": str(uuid4()), "user_id": owner.user_id, "ordinal": 1, "text": "Жара",
        "epistemic_kind": "maybe", "added_in_revision": 1, **columns,
    }
    names = ", ".join(values)
    placeholders = ", ".join(f":{name}" for name in values)
    with pytest.raises(IntegrityError):
        _execute(engine, f"INSERT INTO aa_review_factors ({names}) VALUES ({placeholders})",
                 **values)


def test_a_review_factor_written_without_scope_defaults_to_review(engine, account_factory):
    owner = account_factory("m6-factor-default@example.com")
    review_id = _review(engine, owner.user_id)
    factor_id = str(uuid4())
    _execute(
        engine,
        "INSERT INTO aa_review_factors (id, user_id, review_id, ordinal, text, epistemic_kind,"
        " added_in_revision) VALUES (:id, :u, :r, 1, 'Отпуск', 'mine', 1)",
        id=factor_id, u=owner.user_id, r=review_id,
    )
    with engine.begin() as connection:
        assert connection.scalar(
            text("SELECT scope FROM aa_review_factors WHERE id = :id"), {"id": factor_id}
        ) == "review"


# ───────────────────── adherence / observation backstops ─────────────────────


def _adherence(engine, user_id, experiment_id, **columns) -> str:
    values = {
        "id": str(uuid4()), "user_id": user_id, "experiment_id": experiment_id,
        "day": date(2026, 9, 3), "state": "kept", "source_kind": "USER_REPORTED",
        "idempotency_key": f"adh-{uuid4()}", **columns,
    }
    names = ", ".join(values)
    placeholders = ", ".join(f":{name}" for name in values)
    _execute(engine, f"INSERT INTO aa_experiment_adherence ({names}) VALUES ({placeholders})",
             **values)
    return values["id"]


@pytest.mark.parametrize("state", ["future", "not_recorded", "not_run_after_stop", ""])
def test_a_derived_adherence_state_can_never_be_stored(engine, account_factory, state):
    owner = account_factory(f"m6-adh-{state or 'blank'}@example.com")
    experiment_id = insert_experiment(engine, owner.user_id)
    with pytest.raises(IntegrityError):
        _adherence(engine, owner.user_id, experiment_id, state=state)


def test_one_active_adherence_row_per_day_and_corrections_only(engine, account_factory):
    owner = account_factory("m6-adh-day@example.com")
    experiment_id = insert_experiment(engine, owner.user_id)
    _adherence(engine, owner.user_id, experiment_id)
    with pytest.raises(IntegrityError):
        _adherence(engine, owner.user_id, experiment_id, state="missed")
    with pytest.raises(IntegrityError):
        # A changed day is a correction, never a revision.
        _adherence(
            engine, owner.user_id, experiment_id, day=date(2026, 9, 4), supersede_kind="REVISION"
        )


@pytest.mark.parametrize(
    "columns",
    [
        pytest.param({"metric_key": "finance.transaction_amount"}, id="catalogue-metric"),
        pytest.param({"subject_id": "someone-else"}, id="foreign-subject"),
        pytest.param({"role": "cause"}, id="unknown-role"),
        pytest.param(
            {"value_type": "categorical", "unit_code": None, "value_num": None,
             "value_text": "лучше"},
            id="categorical-outcome",
        ),
    ],
)
def test_experiment_observation_backstops(engine, account_factory, columns):
    owner = account_factory(f"m6-obs-{uuid4().hex[:8]}@example.com")
    experiment_id = insert_experiment(engine, owner.user_id)
    values = {
        "id": str(uuid4()), "user_id": owner.user_id, "experiment_id": experiment_id,
        "subject_domain": "experiment", "subject_type": "experiment", "subject_id": experiment_id,
        "value_type": "duration", "unit_code": "minute", "value_num": 25, "role": "outcome",
        "label": "Время засыпания", "occurred_at": utc(2026, 9, 10), "occurred_tz": KYIV,
        "source_kind": "USER_REPORTED", "idempotency_key": f"obs-{uuid4()}", **columns,
    }
    names = ", ".join(values)
    placeholders = ", ".join(f":{name}" for name in values)
    with pytest.raises(IntegrityError):
        _execute(
            engine, f"INSERT INTO aa_experiment_observations ({names}) VALUES ({placeholders})",
            **values,
        )


def test_deleting_an_experiment_cascades_to_every_child(engine, account_factory):
    owner = account_factory("m6-cascade@example.com")
    experiment_id = insert_experiment(engine, owner.user_id)
    _adherence(engine, owner.user_id, experiment_id)
    _decision(
        engine, owner.user_id, scope="experiment", experiment_id=experiment_id,
        choice=None, idempotency_key="k",
    )
    _execute(engine, "DELETE FROM aa_experiments WHERE id = :id", id=experiment_id)
    with engine.begin() as connection:
        for table in ("aa_experiment_adherence", "aa_decisions"):
            assert connection.scalar(text(f"SELECT count(*) FROM {table}")) == 0
