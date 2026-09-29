"""M7 · System Review schema: chain, roundtrip, registries and database backstops.

The service keeps these rows legal; the point here is that the schema alone
refuses an illegal *shape* — a hypothesis dressed as an association, a system
proposal approved without the user, a numeric importance — even when a write
bypasses the service.
"""

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.analytics.enums import (
    FinanceContextKind,
    Importance,
    RelationEpistemicKind,
    RelationResponse,
    RelationSource,
    RelationStatus,
    RelationType,
    ReviewPeriodKind,
    SystemReviewRevisionStatus,
    members,
)
from app.models import Base
from app.services.export import EXPORT_TABLES
from tests.conftest import TRUNCATED_TABLES
from tests.test_aa_m2_migration import protected_schema
from tests.test_aa_schema_guards import constraint_definition

M6 = "20260929_0007"
M7 = "20260930_0008"
M7_TABLES = (
    "aa_importance_ratings",
    "aa_cross_references",
    "aa_relation_feedback",
    "aa_finance_contexts",
    "aa_system_review_revisions",
)
QUOTED = re.compile(r"'([^']*)'")
SHA = "a" * 64


def _config(test_database_url: str) -> Config:
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", test_database_url)
    return config


def _insert(engine, table: str, **values) -> str:
    values.setdefault("id", str(uuid4()))
    values.setdefault("idempotency_key", f"k-{uuid4()}")
    for key, value in list(values.items()):
        if isinstance(value, (dict, list)) and key != "source_ids":
            values[key] = json.dumps(value)
    names = ", ".join(values)
    placeholders = ", ".join(
        f"CAST(:{name} AS jsonb)" if name in ("evidence", "payload", "decisions",
                                              "adjustments", "frozen_context")
        else f":{name}"
        for name in values
    )
    with engine.begin() as connection:
        connection.execute(text(f"INSERT INTO {table} ({names}) VALUES ({placeholders})"), values)
    return values["id"]


def _relation(engine, user_id, **overrides) -> str:
    values = {
        "user_id": user_id,
        "source": "user",
        "from_key": "subject|finance:period:2026-08",
        "to_key": "subject|finance:period:2026-09",
        "from_domain": "finance",
        "to_domain": "finance",
        "relation_type": "related",
        "epistemic_kind": "association",
        "status": "approved",
    }
    values.update(overrides)
    return _insert(engine, "aa_cross_references", **values)


def _system(**overrides):
    values = {
        "source": "rule",
        "proposal_family": "observation_temporal",
        "proposal_model": "lifeos_rules",
        "proposal_model_version": 1,
        "proposal_key": SHA,
        "input_fingerprint": SHA,
        "proposed_at": datetime(2026, 9, 1, tzinfo=UTC),
        "relation_type": "temporally_associated",
        "status": "proposed",
    }
    values.update(overrides)
    return values


def _revision(engine, user_id, **overrides) -> str:
    values = {
        "user_id": user_id,
        "period_kind": "month",
        "period_key": "2026-08",
        "timezone": "Europe/Kyiv",
        "revision": 1,
        "status": "draft",
        "context_as_of": datetime(2026, 9, 2, tzinfo=UTC),
        "frozen_context": {"manifest_version": 1, "sections": {}},
    }
    values.update(overrides)
    return _insert(engine, "aa_system_review_revisions", **values)


# ───────────────────── chain, roundtrip, registries ─────────────────────


def test_m7_is_the_single_head_on_m6(test_database_url):
    script = ScriptDirectory.from_config(_config(test_database_url))
    assert script.get_heads() == [M7]
    assert script.get_revision(M7).down_revision == M6


def test_m7_tables_are_mapped_exported_truncated_and_present(engine):
    mapped = {name for name in Base.metadata.tables if name.startswith("aa_")}
    with engine.begin() as connection:
        present = set(
            connection.scalars(
                text(
                    "SELECT table_name FROM information_schema.tables"
                    " WHERE table_schema = 'public' AND table_name LIKE 'aa\\_%'"
                )
            )
        )
    assert set(M7_TABLES) <= mapped
    assert mapped == set(EXPORT_TABLES) == present
    assert len(present) == 27
    assert set(M7_TABLES) <= set(TRUNCATED_TABLES)


def test_m7_roundtrip_drops_only_its_tables_and_restores_m6(
    engine, test_database_url, account_factory
):
    account_factory("m7-roundtrip@example.com")
    config = _config(test_database_url)
    protected = protected_schema(engine)
    earlier = {
        name: [
            (c["name"], str(c["type"]), c["nullable"], c["default"])
            for c in inspect(engine).get_columns(name)
        ]
        for name in inspect(engine).get_table_names()
        if name.startswith("aa_") and name not in M7_TABLES
    }
    command.downgrade(config, M6)
    try:
        remaining = set(inspect(engine).get_table_names())
        assert not set(M7_TABLES) & remaining
        assert protected_schema(engine) == protected
        with engine.begin() as connection:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == M6
    finally:
        command.upgrade(config, "head")
    assert set(M7_TABLES) <= set(inspect(engine).get_table_names())
    for name, columns in earlier.items():
        assert columns == [
            (c["name"], str(c["type"]), c["nullable"], c["default"])
            for c in inspect(engine).get_columns(name)
        ]


@pytest.mark.parametrize(
    ("constraint", "enum_cls"),
    [
        ("ck_aa_importance_ratings_importance", Importance),
        ("ck_aa_cross_references_source", RelationSource),
        ("ck_aa_cross_references_relation_type", RelationType),
        ("ck_aa_cross_references_epistemic_kind", RelationEpistemicKind),
        ("ck_aa_cross_references_status", RelationStatus),
        ("ck_aa_relation_feedback_response", RelationResponse),
        ("ck_aa_finance_contexts_kind", FinanceContextKind),
        ("ck_aa_system_review_revisions_period_kind", ReviewPeriodKind),
        ("ck_aa_system_review_revisions_status", SystemReviewRevisionStatus),
    ],
)
def test_m7_enum_members_match_their_database_constraint(engine, constraint, enum_cls):
    assert set(QUOTED.findall(constraint_definition(engine, constraint))) == set(
        members(enum_cls)
    )


def test_judgement_tables_have_no_numeric_or_score_like_column(engine):
    """No global score, no weight, no confidence: nowhere for one to live."""
    forbidden = re.compile(r"score|weight|confidence|probab|rank|priority|composite|total|net")
    for table in ("aa_importance_ratings", "aa_cross_references", "aa_relation_feedback"):
        for column in inspect(engine).get_columns(table):
            assert not forbidden.search(column["name"]), (table, column["name"])
            numeric = re.search(r"NUMERIC|DOUBLE|REAL|FLOAT|DECIMAL", str(column["type"]))
            assert not numeric, (table, column["name"])
            if "INT" in str(column["type"]):
                # The only integer is the proposing rule/model version.
                assert column["name"] == "proposal_model_version"
    for table in M7_TABLES:
        for column in inspect(engine).get_columns(table):
            assert not forbidden.search(column["name"]), (table, column["name"])


def test_the_catalogue_of_signal_rules_is_untouched_by_m7():
    from app.analytics.rules import signal_rules

    assert [rule.RULE_ID for rule in signal_rules()] == [
        "finance.monthly_spend.threshold",
        "project.forecast.revision",
        "data.source.stale",
        "coverage.window.partial",
    ]


# ───────────────────── database backstops ─────────────────────


def _rejects(callable_, *args, **kwargs):
    with pytest.raises(IntegrityError):
        callable_(*args, **kwargs)


def test_hypothesis_types_are_always_hypotheses_and_associations_never_are(
    engine, account_factory
):
    owner = account_factory("m7-epistemic@example.com")
    _rejects(
        _relation, engine, owner.user_id,
        relation_type="may_contribute_to", epistemic_kind="association",
    )
    _rejects(_relation, engine, owner.user_id, epistemic_kind="hypothesis")
    _rejects(_relation, engine, owner.user_id, relation_type="caused")
    _rejects(_relation, engine, owner.user_id, epistemic_kind="fact")
    assert _relation(
        engine, owner.user_id, relation_type="may_contribute_to", epistemic_kind="hypothesis"
    )


def test_a_user_link_is_approved_and_carries_no_proposal_metadata(engine, account_factory):
    owner = account_factory("m7-user-link@example.com")
    _rejects(_relation, engine, owner.user_id, status="unsure")
    _rejects(_relation, engine, owner.user_id, status="proposed")
    _rejects(_relation, engine, owner.user_id, proposal_key=SHA)
    _rejects(_relation, engine, owner.user_id, from_key="subject|finance:period:2026-09")
    assert _relation(engine, owner.user_id, note="совпало с переездом")
    # The same user link twice is one link.
    _rejects(_relation, engine, owner.user_id)


def test_the_system_can_never_approve_its_own_proposal(engine, account_factory):
    owner = account_factory("m7-no-auto@example.com")
    _rejects(_relation, engine, owner.user_id, **_system(status="approved"))
    _rejects(
        _relation, engine, owner.user_id,
        **_system(status="proposed", responded_at=datetime(2026, 9, 2, tzinfo=UTC)),
    )
    _rejects(_relation, engine, owner.user_id, **_system(input_fingerprint=None))
    _rejects(_relation, engine, owner.user_id, **_system(proposal_key="not-a-hash"))
    relation_id = _relation(
        engine, owner.user_id,
        **_system(status="unsure", responded_at=datetime(2026, 9, 2, tzinfo=UTC)),
    )
    # One row per proposal occurrence.
    _rejects(
        _relation, engine, owner.user_id,
        **_system(status="rejected", responded_at=datetime(2026, 9, 3, tzinfo=UTC)),
    )
    _rejects(
        _insert, engine, "aa_relation_feedback",
        user_id=owner.user_id, relation_id=relation_id, response="proposed",
        responded_at=datetime(2026, 9, 2, tzinfo=UTC),
    )
    assert _insert(
        engine, "aa_relation_feedback",
        user_id=owner.user_id, relation_id=relation_id, response="unsure",
        responded_at=datetime(2026, 9, 2, tzinfo=UTC),
    )


def test_importance_is_a_word_with_one_active_rating_per_item(engine, account_factory):
    owner = account_factory("m7-importance@example.com")
    base = {
        "user_id": owner.user_id,
        "target_key": "change|finance_spend_vs_prior|finance:period:2026-08|"
        "finance.monthly_spend|2026-08",
        "recorded_at": datetime(2026, 9, 1, tzinfo=UTC),
        "status": "active",
    }
    _rejects(_insert, engine, "aa_importance_ratings", **{**base, "importance": "5"})
    _rejects(_insert, engine, "aa_importance_ratings", **{**base, "importance": "high"})
    assert _insert(engine, "aa_importance_ratings", **{**base, "importance": "matters"})
    _rejects(_insert, engine, "aa_importance_ratings", **{**base, "importance": "ok"})
    _rejects(
        _insert, engine, "aa_importance_ratings",
        **{**base, "importance": "ok", "status": "superseded"},
    )


def test_finance_context_subjects_and_versions(engine, account_factory):
    owner = account_factory("m7-context@example.com")
    entity = str(uuid4())
    base = {
        "user_id": owner.user_id,
        "entity_id": entity,
        "payload": {"plannedness": "unplanned"},
        "version": 1,
        "status": "active",
        "recorded_at": datetime(2026, 9, 1, tzinfo=UTC),
    }
    _rejects(_insert, engine, "aa_finance_contexts", **{**base, "kind": "expense_context"})
    _rejects(
        _insert, engine, "aa_finance_contexts",
        **{**base, "kind": "expense_context", "subject_key": "finance:period:2026-08"},
    )
    _rejects(
        _insert, engine, "aa_finance_contexts",
        **{**base, "kind": "obligation", "subject_key": "finance:transaction:t1"},
    )
    _rejects(
        _insert, engine, "aa_finance_contexts",
        **{**base, "kind": "expense_context", "subject_key": "finance:transaction:t1",
           "payload": ["not", "an", "object"]},
    )
    assert _insert(
        engine, "aa_finance_contexts",
        **{**base, "kind": "expense_context", "subject_key": "finance:transaction:t1"},
    )
    # One active context per transaction, even under another entity.
    _rejects(
        _insert, engine, "aa_finance_contexts",
        **{**base, "entity_id": str(uuid4()), "kind": "expense_context",
           "subject_key": "finance:transaction:t1"},
    )


def test_saved_review_revisions_append_and_stay_well_formed(engine, account_factory):
    owner = account_factory("m7-revisions@example.com")
    _rejects(_revision, engine, owner.user_id, period_key="2026-13")
    _rejects(_revision, engine, owner.user_id, period_kind="year", period_key="2026-08")
    _rejects(_revision, engine, owner.user_id, status="finalized")
    _rejects(_revision, engine, owner.user_id, no_conclusion=True, reflection="Вывод")
    _rejects(_revision, engine, owner.user_id, reflection="   ")
    _rejects(_revision, engine, owner.user_id, revision=2)
    first = _revision(engine, owner.user_id, reflection="Месяц был плотный")
    _rejects(_revision, engine, owner.user_id)
    assert _revision(
        engine, owner.user_id, revision=2, previous_revision_id=first, status="finalized",
        finalized_at=datetime(2026, 9, 3, tzinfo=UTC), no_conclusion=True,
    )
    assert _revision(engine, owner.user_id, period_kind="year", period_key="2025")
