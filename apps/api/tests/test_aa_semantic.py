"""Slice 1 permanent semantic, API, history, privacy and C-gallery proofs."""

import ast
import inspect as python_inspect
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.analytics.asof import apply_as_of
from app.analytics.enums import CoverageState, ValueType
from app.analytics.subjects import SubjectRef
from app.analytics.values import FactValue
from app.main import create_app
from app.models import (
    AAMeasurement,
    AAMetricMembershipOverride,
    Base,
    UserSnapshot,
)
from app.schemas.aa_comparison import (
    ExpectationCreate,
    OverrideCreate,
    PolicyCreate,
    SemanticOut,
)
from app.schemas.aa_subjects import SubjectSummaryOut
from app.services import aa_desirability
from app.services.aa_comparison import CONCEPT_MODELS, SEMANTIC_TABLES, append_semantic
from app.services.aa_coverage_claims import record_coverage_claim
from app.services.aa_desirability import NormativeGrounding, desirability
from app.services.aa_metric_policy import membership_as_of, record_override, record_policy
from app.services.export import EXPORT_TABLES, validate_export_registry
from tests.aa_helpers import authenticate, measurement_payload, money
from tests.test_aa_coverage import claim_request
from tests.test_aa_m2_migration import protected_schema
from tests.test_export import read_export

ROUTES = {
    "expectation": "expectations",
    "forecast": "forecasts",
    "baseline": "baselines",
    "target": "targets",
    "preference": "preferences",
    "observation": "observations",
}
SUBJECT = {"domain": "finance", "type": "period", "id": "2026-08"}
KEY = "finance:period:2026-08"
WINDOW = {"window_start": "2026-08-01", "window_end": "2026-08-31", "timezone": "Europe/Kyiv"}
WHEN = "2026-08-01T00:00:00Z"
VARIANTS = json.loads((Path(__file__).parents[3] / "tests/fixtures/aa_c_variants.json").read_text())


def payload(concept, **changes):
    body = {
        "subject": SUBJECT.copy(),
        "metric_key": "finance.transaction_amount",
        "provenance": {
            "source_kind": "USER_REPORTED",
            "basis": "explicit input",
            "method": "manual",
        },
        "idempotency_key": f"semantic-{concept}",
        "value": money("100"),
    }
    if concept in ("expectation", "baseline", "target"):
        body.update(WINDOW)
    if concept in ("expectation", "preference"):
        body["effective_from"] = WHEN
    if concept == "forecast":
        body["horizon_at"] = "2026-08-31T21:00:00Z"
    if concept == "target":
        body["desired_direction"] = "lower"
    if concept == "preference":
        del body["value"]
        body.update(statement="Prefer lower expenses", desired_direction="lower")
    if concept == "observation":
        body.update(occurred_at=WHEN, occurred_tz="Europe/Kyiv")
    body.update(changes)
    return body


def post(client, concept, body):
    response = client.post("/api/v1/aa/" + ROUTES[concept], json=body)
    assert response.status_code in (200, 201), response.text
    return response.json()


@pytest.mark.parametrize("concept", ROUTES)
def test_each_concept_strict_authenticated_idempotent_and_isolated(
    concept, client, settings, account_factory, session_factory
):
    body = payload(concept)
    assert client.post("/api/v1/aa/" + ROUTES[concept], json=body).status_code == 401
    owner = account_factory("semantic-owner@example.com")
    other = account_factory("semantic-other@example.com")
    authenticate(client, settings, owner)
    response = client.post("/api/v1/aa/" + ROUTES[concept], json=body)
    assert response.status_code == 201, response.text
    fact = response.json()
    assert fact["concept"] == concept
    assert fact["provenance"]["basis"] == body["provenance"]["basis"]
    assert fact["provenance"]["recorded_at"] != WHEN
    replay = client.post("/api/v1/aa/" + ROUTES[concept], json=body)
    assert replay.status_code == 200 and replay.json()["id"] == fact["id"]
    assert (
        client.post(
            "/api/v1/aa/" + ROUTES[concept], json={**body, "user_id": str(other.user_id)}
        ).status_code
        == 422
    )
    assert (
        client.post("/api/v1/aa/" + ROUTES[concept], json={**body, "recorded_at": WHEN}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/aa/" + ROUTES[concept], json=body, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/aa/" + ROUTES[concept], content="{}", headers={"Content-Type": "text/plain"}
        ).status_code
        == 415
    )
    provenance = f"/api/v1/aa/facts/{fact['fact_table']}/{fact['id']}/provenance"
    assert client.get(provenance).status_code == 200
    authenticate(client, settings, other)
    assert client.get(provenance).status_code == 404
    assert client.get(f"/api/v1/aa/subjects/{KEY}/summary").status_code == 404
    assert (
        client.get(f"/api/v1/aa/subjects/{KEY}/coverage?from=2026-08-01&to=2026-08-31").status_code
        == 404
    )
    assert (
        client.delete(f"/api/v1/aa/facts/{fact['fact_table']}/{fact['id']}?mode=hard").status_code
        == 404
    )
    with session_factory() as db:
        model = CONCEPT_MODELS[concept]
        assert db.scalar(select(func.count()).select_from(model)) == 1


@pytest.mark.parametrize("concept", ROUTES)
def test_all_semantic_routes_preserve_default_closed_write_gate(
    concept, settings, session_factory, account_factory
):
    owner = account_factory("gate-semantic@example.com")
    closed = settings.model_copy(update={"aa_write_enabled": False})
    with TestClient(
        create_app(settings=closed, session_factory=session_factory),
        headers={"Origin": "http://testserver"},
    ) as client:
        authenticate(client, closed, owner)
        response = client.post("/api/v1/aa/" + ROUTES[concept], json=payload(concept))
        assert response.status_code == 403 and response.json()["code"] == "aa_writes_disabled"


@pytest.mark.parametrize("concept", ["expectation", "forecast"])
def test_versions_keep_values_and_answer_as_of(
    concept, client, settings, account_factory, session_factory
):
    owner = account_factory("versions@example.com")
    authenticate(client, settings, owner)
    first = post(client, concept, payload(concept))
    at = datetime.now(UTC)
    second = post(
        client, concept, payload(concept, value=money("200"), idempotency_key="second-version")
    )
    model = CONCEPT_MODELS[concept]
    with session_factory() as db:
        old = db.get(model, UUID(first["id"]))
        assert old.value_num == Decimal("100")
        assert old.status == "superseded" and old.supersede_kind == "REVISION"
        assert str(old.superseded_by_id) == second["id"]
        assert (
            db.scalar(
                apply_as_of(select(model).where(model.user_id == owner.user_id), model, at)
            ).id
            == old.id
        )
        assert db.scalar(select(func.count()).select_from(model)) == 2
    summary = client.get(
        f"/api/v1/aa/subjects/{KEY}/summary", params={"as_of": at.isoformat()}
    ).json()
    assert summary[ROUTES[concept]][0]["id"] == first["id"]
    history_url = "/api/v1/aa/metrics/finance.transaction_amount/history"
    query = {
        "subject": KEY,
        "from": WHEN,
        "to": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "limit": 1,
    }
    page = client.get(history_url, params=query).json()
    assert page[ROUTES[concept]][0]["id"] == second["id"]
    cursor = page["layer_cursors"][ROUTES[concept]]
    assert cursor
    query[concept + "_cursor"] = cursor
    page2 = client.get(history_url, params=query).json()
    assert page2[ROUTES[concept]][0]["id"] == first["id"]
    assert page2["layer_cursors"][ROUTES[concept]] is None


def test_future_effective_version_does_not_erase_current_expectation(
    client, settings, account_factory
):
    owner = account_factory("future-effective@example.com")
    authenticate(client, settings, owner)
    first = post(client, "expectation", payload("expectation"))
    future = datetime.now(UTC) + timedelta(days=10)
    second = post(
        client,
        "expectation",
        payload("expectation", effective_from=future.isoformat(), idempotency_key="future-version"),
    )
    assert (
        client.get(f"/api/v1/aa/subjects/{KEY}/summary").json()["expectations"][0]["id"]
        == first["id"]
    )
    assert (
        client.get(
            f"/api/v1/aa/subjects/{KEY}/summary", params={"as_of": future.isoformat()}
        ).json()["expectations"][0]["id"]
        == second["id"]
    )
    bad = client.post(
        "/api/v1/aa/expectations", json=payload("expectation", idempotency_key="backdate-version")
    )
    assert bad.status_code == 409


def test_concurrent_first_insert_revision_and_replay_do_not_fork(account_factory, session_factory):
    owner = account_factory("concurrent-semantic@example.com")

    def write(key):
        with session_factory() as db:
            row, replay = append_semantic(
                db,
                user_id=owner.user_id,
                concept="expectation",
                request=ExpectationCreate.model_validate(
                    payload("expectation", idempotency_key=key)
                ),
            )
            return row.id, replay

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(write, ["concurrent-same-key", "concurrent-same-key"]))
    assert results[0][0] == results[1][0]
    assert sorted(result[1] for result in results) == [False, True]
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(write, ["concurrent-next-1", "concurrent-next-2"]))
    model = CONCEPT_MODELS["expectation"]
    with session_factory() as db:
        rows = db.scalars(select(model).where(model.user_id == owner.user_id)).all()
        assert len(rows) == 3 and sum(row.status == "active" for row in rows) == 1
        assert len({row.supersedes_id for row in rows if row.supersedes_id}) == 2


def test_t02_forecast_has_no_actual_discriminator_or_event_fields(
    client, settings, account_factory
):
    authenticate(client, settings, account_factory("no-actual-forecast@example.com"))
    for illegal in (
        {"kind": "actual"},
        {"actual": True},
        {"occurred_at": WHEN},
        {"occurred_tz": "UTC"},
    ):
        assert (
            client.post("/api/v1/aa/forecasts", json=payload("forecast", **illegal)).status_code
            == 422
        )
    row = post(
        client,
        "forecast",
        payload(
            "forecast",
            value={"type": "date", "date": "2026-08-26"},
            metric_key="project.completion_date",
            subject={"domain": "project", "type": "project", "id": "p01"},
        ),
    )
    assert row["concept"] == "forecast" and row["value"]["date"] == "2026-08-26"
    assert datetime.fromisoformat(row["horizon_at"]) == datetime(2026, 8, 31, 21, tzinfo=UTC)
    assert row["occurred_at"] is None
    assert "actual" not in Base.metadata.tables["aa_forecast_versions"].c
    assert "occurred_at" not in Base.metadata.tables["aa_forecast_versions"].c


def test_target_absent_zero_and_missing_are_distinct(
    client, settings, account_factory, session_factory
):
    owner = account_factory("absence@example.com")
    authenticate(client, settings, owner)
    post(client, "expectation", payload("expectation"))
    assert client.get(f"/api/v1/aa/subjects/{KEY}/summary").json()["targets"] == []
    absent = post(client, "target", payload("target", value=None, is_explicitly_absent=True))
    assert absent["value"] is None and absent["is_explicitly_absent"] is True
    zero = post(
        client, "target", payload("target", value=money("0"), idempotency_key="zero-target")
    )
    assert Decimal(zero["value"]["num"]) == 0 and zero["is_explicitly_absent"] is False
    for changes in ({"value": money("0"), "is_explicitly_absent": True}, {"value": None}):
        bad = client.post("/api/v1/aa/targets", json=payload("target", **changes))
        assert bad.status_code == 422 and bad.json()["code"] == "value_or_absent_required"
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(CONCEPT_MODELS["target"])) == 2
        assert db.scalar(select(func.count()).select_from(AAMeasurement)) == 0


def test_observation_explicit_unknown_is_subjective_not_a_measurement(
    client, settings, account_factory, session_factory
):
    authenticate(client, settings, account_factory("observation-unknown@example.com"))
    row = post(
        client,
        "observation",
        payload("observation", value=None, value_availability="explicitly_unknown"),
    )
    assert row["value"] is None and row["epistemic_kind"] == "unknown"
    assert row["occurred_at"].startswith("2026-08-01") and row["occurred_tz"] == "Europe/Kyiv"
    assert (
        client.post(
            "/api/v1/aa/observations",
            json=payload("observation", value_availability="explicitly_unknown"),
        ).status_code
        == 422
    )
    assert (
        client.post("/api/v1/aa/observations", json=payload("observation", value=None)).status_code
        == 422
    )
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AAMeasurement)) == 0


@pytest.mark.parametrize("amount", ["50", "100", "200"])
def test_t01_no_grounding_remains_neutral_independent_of_difference(amount):
    actual = FactValue(ValueType.MONEY, unit_code="UAH", value_num=Decimal(amount))
    assert desirability(actual, None) == "neutral"
    assert desirability(None, None) == "neutral"
    target = NormativeGrounding(
        "target",
        "lower",
        FactValue(ValueType.MONEY, unit_code="UAH", value_num=Decimal("100")),
        "explicit-target",
    )
    assert (
        desirability(actual, target)
        == {"50": "favorable", "100": "neutral", "200": "unfavorable"}[amount]
    )
    assert desirability(None, target) == "unknown"
    with pytest.raises(ValueError):
        desirability(actual, NormativeGrounding("expectation", "lower", actual, "not-normative"))


def test_desirability_dependency_boundary_is_structural():
    source = python_inspect.getsource(aa_desirability)
    tree = ast.parse(source)
    imports = [node.module or "" for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)]
    assert imports == ["dataclasses", "typing", "app.analytics.values"]
    assert list(python_inspect.signature(desirability).parameters) == ["actual", "grounding"]
    assert not any(
        isinstance(node, ast.Name)
        and any(
            word in node.id.lower() for word in ("expectation", "forecast", "delta", "materiality")
        )
        for node in ast.walk(tree)
    )


def test_summary_expectation_forecast_neutral_but_target_grounded(
    client, settings, account_factory
):
    authenticate(client, settings, account_factory("grounding-summary@example.com"))
    post(client, "expectation", payload("expectation", value=money("200")))
    post(client, "forecast", payload("forecast", value=money("250")))
    forecast_summary = client.get(f"/api/v1/aa/subjects/{KEY}/summary").json()
    assert (
        forecast_summary["actual"] == []
        and forecast_summary["comparisons"][0]["desire"] == "neutral"
    )
    client.post(
        "/api/v1/aa/measurements", json=measurement_payload(subject=SUBJECT, value=money("150"))
    )
    summary = client.get(f"/api/v1/aa/subjects/{KEY}/summary").json()
    assert summary["comparisons"][0]["desire"] == "neutral"
    post(client, "target", payload("target", value=money("100")))
    summary = client.get(f"/api/v1/aa/subjects/{KEY}/summary").json()
    assert summary["comparisons"][0]["desire"] == "unfavorable"
    assert summary["comparisons"][0]["grounding_kind"] == "target"


@pytest.mark.parametrize("variant", VARIANTS, ids=lambda item: item["name"])
def test_all_seven_frozen_c_variants_are_api_backed(
    variant, client, settings, account_factory, session_factory
):
    owner = account_factory("c-gallery@example.com")
    authenticate(client, settings, owner)
    metric = (
        "project.completion_date"
        if variant["reference"] and variant["reference"]["type"] == "date"
        else (
            "finance.transaction_amount"
            if variant["reference"] and variant["reference"]["type"] == "money"
            else None
        )
    )
    subject = (
        {"domain": "project", "type": "project", "id": "p01"}
        if metric == "project.completion_date"
        else SUBJECT
    )
    key = ":".join([subject["domain"], subject["type"], subject["id"]])
    if variant["reference"]:
        post(
            client,
            variant["reference_concept"],
            payload(
                variant["reference_concept"],
                subject=subject,
                metric_key=metric,
                value=variant["reference"],
            ),
        )
    if variant["current"]:
        concept = variant["current_concept"]
        if concept == "actual":
            response = client.post(
                "/api/v1/aa/measurements",
                json=measurement_payload(
                    subject=subject, metric_key=metric, value=variant["current"]
                ),
            )
            assert response.status_code == 201
        else:
            post(
                client,
                concept,
                payload(concept, subject=subject, metric_key=metric, value=variant["current"]),
            )
    if variant["target_absent"]:
        post(
            client,
            "target",
            payload(
                "target", subject=subject, metric_key=metric, value=None, is_explicitly_absent=True
            ),
        )
    # Explicit coverage evidence creates subject ownership even for an empty
    # fact layer. This is NOT a placeholder Measurement or implicit zero.
    with session_factory() as db:
        record_coverage_claim(
            db,
            user_id=owner.user_id,
            request=claim_request(
                subject=SubjectRef(subject["domain"], subject["type"], subject["id"]),
                window_end_date=date(2026, 8, 21) if variant["partial"] else date(2026, 8, 28),
            ),
        )
        if variant["partial"]:
            record_coverage_claim(
                db,
                user_id=owner.user_id,
                request=claim_request(
                    source_id="partial-import",
                    idempotency_key="partial-days",
                    window_start_date=date(2026, 8, 22),
                    window_end_date=date(2026, 8, 31),
                    coverage_state=CoverageState.PARTIAL,
                    completeness_known=False,
                    observed_units=0,
                    expected_units=10,
                ),
            )
        before = db.scalar(select(func.count()).select_from(AAMeasurement))
    response = client.get(f"/api/v1/aa/subjects/{key}/summary")
    assert response.status_code == 200, response.text
    summary = SubjectSummaryOut.model_validate(response.json())
    # An entirely empty subject has no comparison grain; derived presentation
    # can use the canonical absent-operands state without adding any facts.
    if variant["name"] == "no-data":
        assert not summary.actual and not summary.expectations
        assert summary.comparisons[0].availability == "no_data"
        assert summary.comparisons[0].delta.state == "unknown"
        assert summary.comparisons[0].desire == "neutral"
    else:
        comparison = summary.comparisons[0]
        assert comparison.current_concept == variant["current_concept"]
        assert comparison.desire == "neutral"
        for field, value in variant["delta"].items():
            actual = getattr(comparison.delta, field)
            assert Decimal(str(actual)) == Decimal(value) if field == "num" else actual == value
        if variant["partial"]:
            assert comparison.coverage["observed_count"] == 21
            assert comparison.availability == "insufficient_data"
        if variant["current_concept"] == "forecast":
            assert not summary.actual and len(summary.forecasts) == 1
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AAMeasurement)) == before


def test_subject_coverage_uses_claims_not_fact_presence(client, settings, account_factory):
    authenticate(client, settings, account_factory("subject-coverage@example.com"))
    post(client, "expectation", payload("expectation"))
    response = client.get(f"/api/v1/aa/subjects/{KEY}/coverage?from=2026-08-01&to=2026-08-31")
    assert response.status_code == 200
    assert (
        response.json()["observed_count"] == 0 and response.json()["unknown_coverage_count"] == 31
    )
    assert client.get(f"/api/v1/aa/subjects/{KEY}/coverage").status_code == 400
    assert (
        client.get(f"/api/v1/aa/subjects/{KEY}/summary?as_of=2026-08-01T00:00:00").status_code
        == 400
    )


def test_m3_empty_roundtrip_and_registry_schema_parity(engine, test_database_url):
    before = protected_schema(engine)
    old_tables = {
        name: [
            tuple((c["name"], str(c["type"]), c["nullable"], c["default"]))
            for c in inspect(engine).get_columns(name)
        ]
        for name in (
            "aa_measurements",
            "aa_source_coverage",
            "aa_deletion_receipts",
            "aa_metric_definitions",
        )
    }
    with engine.connect() as connection:
        for name in SEMANTIC_TABLES:
            assert connection.scalar(text(f"SELECT count(*) FROM {name}")) == 0
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", test_database_url)
    assert ScriptDirectory.from_config(config).get_heads() == ["20260910_0004"]
    command.downgrade(config, "20260909_0003")
    try:
        assert not (set(SEMANTIC_TABLES) & set(inspect(engine).get_table_names()))
        assert protected_schema(engine) == before
    finally:
        command.upgrade(config, "head")
    assert protected_schema(engine) == before
    for name, columns in old_tables.items():
        assert columns == [
            tuple((c["name"], str(c["type"]), c["nullable"], c["default"]))
            for c in inspect(engine).get_columns(name)
        ]
    inspector = inspect(engine)
    for name, model in SEMANTIC_TABLES.items():
        assert set(model.__table__.c.keys()) == {c["name"] for c in inspector.get_columns(name)}
        assert {
            check.name
            for check in model.__table__.constraints
            if check.name and check.name.startswith("ck_")
        } == {check["name"] for check in inspector.get_check_constraints(name)}
    validate_export_registry()
    assert set(EXPORT_TABLES) == {
        name for name in inspector.get_table_names() if name.startswith("aa_")
    }


@pytest.mark.parametrize("concept", ROUTES)
def test_new_fact_tombstone_erases_personal_content(
    concept, client, settings, account_factory, session_factory
):
    owner = account_factory("semantic-erase@example.com")
    authenticate(client, settings, owner)
    row = post(client, concept, payload(concept))
    response = client.delete(f"/api/v1/aa/facts/{row['fact_table']}/{row['id']}?mode=tombstone")
    assert response.status_code == 200, response.text
    with session_factory() as db:
        erased = db.get(CONCEPT_MODELS[concept], UUID(row["id"]))
        assert erased.status == "tombstoned"
        assert erased.source_ref is None and erased.basis is None and erased.method is None
        for name in (
            "unit_code",
            "value_num",
            "value_date",
            "value_text",
            "scale_min",
            "scale_max",
            "dimensions",
            "statement",
            "desired_direction",
        ):
            if hasattr(erased, name):
                assert getattr(erased, name) is None
        assert SemanticOut.from_row(erased, concept).value is None


def seed_policy_and_override(db, user_id, fact_id):
    policy = PolicyCreate(
        metric_key="finance.monthly_spend",
        policy={"exclude_categories": ["health"], "default": "include"},
        effective_from=datetime(2026, 8, 1, tzinfo=UTC),
        provenance={"source_kind": "USER_REPORTED"},
        idempotency_key="policy-version-1",
    )
    override = OverrideCreate(
        metric_key="finance.monthly_spend",
        source_fact_id=fact_id,
        included=True,
        provenance={"source_kind": "USER_REPORTED"},
        idempotency_key="override-version-1",
    )
    first, _ = record_policy(db, user_id=user_id, request=policy)
    second, _ = record_override(db, user_id=user_id, request=override)
    return first, second


def test_export_account_delete_and_all_eight_new_tables(
    client, settings, account_factory, session_factory
):
    owner = account_factory("all-new-privacy@example.com")
    other = account_factory("all-new-other@example.com")
    authenticate(client, settings, owner)
    for concept in ROUTES:
        post(client, concept, payload(concept))
    measurement = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    with session_factory() as db:
        seed_policy_and_override(db, owner.user_id, UUID(measurement["id"]))
    authenticate(client, settings, other)
    for concept in ROUTES:
        post(client, concept, payload(concept))
    other_fact = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    with session_factory() as db:
        seed_policy_and_override(db, other.user_id, UUID(other_fact["id"]))
    authenticate(client, settings, owner)
    manifest, tables = read_export(client.get("/api/v1/export"))
    assert manifest["alembic_revision"] == "20260910_0004"
    for name in SEMANTIC_TABLES:
        assert len(tables[name]) == 1 and tables[name][0]["user_id"] == str(owner.user_id)
    assert (
        client.request(
            "DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"}
        ).status_code
        == 204
    )
    with session_factory() as db:
        for model in SEMANTIC_TABLES.values():
            assert (
                db.scalar(
                    select(func.count()).select_from(model).where(model.user_id == owner.user_id)
                )
                == 0
            )
            assert (
                db.scalar(
                    select(func.count()).select_from(model).where(model.user_id == other.user_id)
                )
                == 1
            )


@pytest.mark.parametrize("table", list(SEMANTIC_TABLES))
def test_per_fact_hard_delete_covers_every_new_table(
    table, client, settings, account_factory, session_factory
):
    owner = account_factory("hard-new@example.com")
    authenticate(client, settings, owner)
    concept = next(
        (key for key, model in CONCEPT_MODELS.items() if model.__tablename__ == table), None
    )
    if concept:
        fact = post(client, concept, payload(concept))
        fact_id = UUID(fact["id"])
    else:
        measurement = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
        with session_factory() as db:
            policy, override = seed_policy_and_override(db, owner.user_id, UUID(measurement["id"]))
            fact_id = policy.id if table == "aa_metric_policy_versions" else override.id
    dependent = post(
        client,
        "observation",
        payload(
            "observation",
            idempotency_key="dependent-source",
            provenance={
                "source_kind": "DERIVED",
                "basis": "private source-derived text",
                "method": "private",
                "source_ref": {"id": str(fact_id)},
            },
        ),
    )
    deleted = client.delete(f"/api/v1/aa/facts/{table}/{fact_id}?mode=hard")
    assert deleted.status_code == 200, deleted.text
    with session_factory() as db:
        assert db.get(SEMANTIC_TABLES[table], fact_id) is None
        row = db.get(CONCEPT_MODELS["observation"], UUID(dependent["id"]))
        assert row.source_ref is None and row.basis is None and row.method is None
    _, tables = read_export(client.get("/api/v1/export"))
    assert str(fact_id) not in {row["id"] for row in tables[table]}
    assert len(tables[table]) == (1 if table == "aa_observations" else 0)
    receipt = tables["aa_deletion_receipts"][0]
    assert set(receipt) == {"id", "user_id", "table_name", "fact_id", "deleted_at"}


def test_c7_policy_override_history_and_snapshot_independence(
    client, settings, account_factory, session_factory
):
    owner = account_factory("historical-policy@example.com")
    authenticate(client, settings, owner)
    measurement = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(dimensions={"category_id": "health", "included_by_default": True}),
    ).json()
    fact_id = UUID(measurement["id"])
    with session_factory() as db:
        captured_at = datetime.now(UTC)
        result = membership_as_of(
            db,
            user_id=owner.user_id,
            metric_key="finance.monthly_spend",
            fact_id=fact_id,
            as_of=captured_at,
        )
        assert result.included is True and result.policy_known is False
        policy_request = PolicyCreate(
            metric_key="finance.monthly_spend",
            policy={"exclude_categories": ["health"]},
            effective_from=WHEN,
            provenance={"source_kind": "USER_REPORTED"},
            idempotency_key="policy-history-1",
        )
        policy, _ = record_policy(db, user_id=owner.user_id, request=policy_request)
        first_at = datetime.now(UTC)
        assert (
            membership_as_of(
                db,
                user_id=owner.user_id,
                metric_key=policy.metric_key,
                fact_id=fact_id,
                as_of=first_at,
            ).included
            is False
        )
        future = first_at + timedelta(days=10)
        new_policy, _ = record_policy(
            db,
            user_id=owner.user_id,
            request=policy_request.model_copy(
                update={
                    "policy": policy_request.policy.model_copy(update={"exclude_categories": []}),
                    "effective_from": future,
                    "idempotency_key": "policy-history-2",
                }
            ),
        )
        db.add(
            UserSnapshot(
                user_id=owner.user_id,
                schema_version=2,
                revision=1,
                payload={"categories": {"health": "include NOW"}},
            )
        )
        db.commit()
        assert policy.policy == {"exclude_categories": ["health"], "default": "include"}
        assert (
            membership_as_of(
                db,
                user_id=owner.user_id,
                metric_key=policy.metric_key,
                fact_id=fact_id,
                as_of=first_at,
            ).included
            is False
        )
        assert (
            membership_as_of(
                db,
                user_id=owner.user_id,
                metric_key=policy.metric_key,
                fact_id=fact_id,
                as_of=future,
            ).included
            is True
        )
        request = OverrideCreate(
            metric_key=policy.metric_key,
            source_fact_id=fact_id,
            included=True,
            provenance={"source_kind": "USER_REPORTED"},
            idempotency_key="override-history-1",
        )
        first, _ = record_override(db, user_id=owner.user_id, request=request)
        override_at = datetime.now(UTC)
        second, _ = record_override(
            db,
            user_id=owner.user_id,
            request=request.model_copy(
                update={"included": False, "idempotency_key": "override-history-2"}
            ),
        )
        assert first.included is True and second.included is False
        assert (
            membership_as_of(
                db,
                user_id=owner.user_id,
                metric_key=policy.metric_key,
                fact_id=fact_id,
                as_of=override_at,
            ).included
            is True
        )
        assert (
            membership_as_of(
                db,
                user_id=owner.user_id,
                metric_key=policy.metric_key,
                fact_id=fact_id,
                as_of=datetime.now(UTC),
            ).included
            is False
        )
        assert first.superseded_by_id == second.id and policy.superseded_by_id == new_policy.id
    source = python_inspect.getsource(
        __import__("app.services.aa_metric_policy", fromlist=["membership_as_of"])
    )
    assert "Snapshot" not in source and "snapshot" not in source


def test_c7_source_fact_hard_delete_cascades_and_redacts_nested_refs(
    client, settings, account_factory, session_factory
):
    owner = account_factory("c7-cascade@example.com")
    authenticate(client, settings, owner)
    fact = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    with session_factory() as db:
        _, override = seed_policy_and_override(db, owner.user_id, UUID(fact["id"]))
        override_id = override.id
    dependent = post(
        client,
        "observation",
        payload(
            "observation",
            provenance={"source_kind": "DERIVED", "source_ref": {"override": str(override_id)}},
        ),
    )
    assert (
        client.delete(f"/api/v1/aa/facts/aa_measurements/{fact['id']}?mode=hard").status_code == 200
    )
    with session_factory() as db:
        assert db.get(AAMetricMembershipOverride, override_id) is None
        assert db.get(CONCEPT_MODELS["observation"], UUID(dependent["id"])).source_ref is None


@pytest.mark.parametrize(
    "concept", ["expectation", "forecast", "baseline", "target", "observation"]
)
def test_new_tables_reject_empty_fake_values_even_directly(
    concept, account_factory, session_factory
):
    owner = account_factory("db-fake-missing@example.com")
    model = CONCEPT_MODELS[concept]
    values = {
        "id": uuid4(),
        "user_id": owner.user_id,
        "subject_domain": "finance",
        "subject_type": "period",
        "subject_id": "2026-08",
        "metric_key": "finance.transaction_amount",
        "value_type": "money",
        "source_kind": "USER_REPORTED",
        "idempotency_key": "fake-missing-db",
    }
    if concept in ("expectation", "baseline", "target"):
        values.update(
            window_start=date(2026, 8, 1), window_end=date(2026, 8, 31), timezone="Europe/Kyiv"
        )
    if concept == "expectation":
        values["effective_from"] = datetime.now(UTC)
    if concept == "forecast":
        values["horizon_at"] = datetime.now(UTC)
    if concept == "target":
        values["desired_direction"] = "lower"
    if concept == "observation":
        values.update(occurred_at=datetime.now(UTC), occurred_tz="Europe/Kyiv")
    with session_factory() as db:
        with pytest.raises(IntegrityError):
            db.add(model(**values))
            db.commit()


def test_c7_legacy_capture_and_missing_dimensions_are_honest(
    client, settings, account_factory, session_factory
):
    owner = account_factory("legacy-policy@example.com")
    authenticate(client, settings, owner)
    fact = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    with session_factory() as db:
        request = PolicyCreate(
            metric_key="finance.monthly_spend",
            policy={"exclude_categories": ["health"]},
            effective_from=WHEN,
            provenance={"source_kind": "IMPORTED", "original_recorded_at_known": False},
            idempotency_key="legacy-policy-capture",
        )
        row, replayed = record_policy(db, user_id=owner.user_id, request=request)
        assert not replayed and row.effective_from == row.recorded_at
        prior = row.recorded_at - timedelta(microseconds=1)
        result = membership_as_of(
            db,
            user_id=owner.user_id,
            metric_key=row.metric_key,
            fact_id=UUID(fact["id"]),
            as_of=prior,
        )
        assert result.included is None and not result.policy_known
        result = membership_as_of(
            db,
            user_id=owner.user_id,
            metric_key=row.metric_key,
            fact_id=UUID(fact["id"]),
            as_of=datetime.now(UTC),
        )
        assert result.included is None and result.basis == "category_unknown"
        assert record_policy(db, user_id=owner.user_id, request=request)[1] is True


@pytest.mark.parametrize("table", ["aa_metric_policy_versions", "aa_metric_membership_overrides"])
def test_c7_tombstone_erases_rule_or_override(
    table, client, settings, account_factory, session_factory
):
    owner = account_factory("c7-tombstone@example.com")
    authenticate(client, settings, owner)
    fact = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    with session_factory() as db:
        policy, override = seed_policy_and_override(db, owner.user_id, UUID(fact["id"]))
        fact_id = policy.id if table == "aa_metric_policy_versions" else override.id
    response = client.delete(f"/api/v1/aa/facts/{table}/{fact_id}?mode=tombstone")
    assert response.status_code == 200, response.text
    with session_factory() as db:
        row = db.get(SEMANTIC_TABLES[table], fact_id)
        assert row.status == "tombstoned"
        assert getattr(row, "policy", None) is None and getattr(row, "included", None) is None


def test_c7_override_cannot_reference_other_account(
    client, settings, account_factory, session_factory
):
    from app.services.aa_facts import FactNotFoundError

    owner = account_factory("override-other-owner@example.com")
    other = account_factory("override-other@example.com")
    authenticate(client, settings, owner)
    fact = client.post("/api/v1/aa/measurements", json=measurement_payload()).json()
    with session_factory() as db:
        request = OverrideCreate(
            metric_key="finance.monthly_spend",
            source_fact_id=UUID(fact["id"]),
            included=False,
            provenance={"source_kind": "USER_REPORTED"},
            idempotency_key="override-other-account",
        )
        with pytest.raises(FactNotFoundError):
            record_override(db, user_id=other.user_id, request=request)


@pytest.mark.parametrize("number", ["NaN", "Infinity", "-Infinity", "0.0000001", "100000000000000"])
def test_backend_rejects_lossy_or_nonfinite_scalars(number):
    from app.analytics.values import InvalidValueError, validate_value

    with pytest.raises(InvalidValueError):
        validate_value(FactValue(ValueType.COUNT, value_num=Decimal(number)))


def test_preference_is_grounded_by_baseline_not_expectation(client, settings, account_factory):
    authenticate(client, settings, account_factory("preference-baseline@example.com"))
    post(client, "expectation", payload("expectation", value=money("200")))
    post(client, "preference", payload("preference"))
    response = client.post(
        "/api/v1/aa/measurements", json=measurement_payload(subject=SUBJECT, value=money("150"))
    )
    assert response.status_code == 201
    assert (
        client.get(f"/api/v1/aa/subjects/{KEY}/summary").json()["comparisons"][0]["desire"]
        == "neutral"
    )
    post(client, "baseline", payload("baseline", value=money("100")))
    summary = client.get(f"/api/v1/aa/subjects/{KEY}/summary").json()
    assert summary["comparisons"][0]["desire"] == "unfavorable"
    assert summary["comparisons"][0]["grounding_kind"] == "preference"


def test_target_for_different_window_is_not_grounding(client, settings, account_factory):
    authenticate(client, settings, account_factory("target-window@example.com"))
    post(client, "expectation", payload("expectation"))
    post(client, "target", payload("target", window_start="2026-09-01", window_end="2026-09-30"))
    assert (
        client.get(f"/api/v1/aa/subjects/{KEY}/summary").json()["comparisons"][0]["grounding_id"]
        is None
    )


def test_coverage_quality_does_not_leak_facts_recorded_after_as_of(
    client, settings, account_factory
):
    authenticate(client, settings, account_factory("quality-asof@example.com"))
    post(client, "expectation", payload("expectation"))
    at = datetime.now(UTC)
    response = client.post(
        "/api/v1/aa/measurements",
        json=measurement_payload(
            subject=SUBJECT,
            provenance={
                "source_kind": "IMPORTED",
                "method": "LEGACY_IMPORT",
                "original_recorded_at_known": False,
            },
        ),
    )
    assert response.status_code == 201
    report = client.get(
        f"/api/v1/aa/subjects/{KEY}/coverage",
        params={"from": "2026-08-01", "to": "2026-08-31", "as_of": at.isoformat()},
    ).json()
    assert report["freshest_recorded_at"] is None and report["has_legacy_imports"] is False
    current = client.get(f"/api/v1/aa/subjects/{KEY}/coverage?from=2026-08-01&to=2026-08-31").json()
    assert current["has_legacy_imports"] is True and current["observed_count"] == 0


def test_history_layer_selector_and_invalid_cursor(client, settings, account_factory):
    authenticate(client, settings, account_factory("layer-selection@example.com"))
    post(client, "expectation", payload("expectation"))
    post(client, "forecast", payload("forecast"))
    params = {
        "from": WHEN,
        "to": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        "layers": "forecasts",
    }
    url = "/api/v1/aa/metrics/finance.transaction_amount/history"
    result = client.get(url, params=params).json()
    assert len(result["forecasts"]) == 1 and not result["expectations"] and not result["actual"]
    params["layers"] = "wrong"
    assert client.get(url, params=params).status_code == 400
    params["layers"] = "forecasts"
    params["forecast_cursor"] = "not-a-valid-cursor"
    assert client.get(url, params=params).status_code == 400
    from app.routes.aa_history import encode_cursor

    params["forecast_cursor"] = encode_cursor(datetime.now(UTC), uuid4())
    assert client.get(url, params=params).status_code == 400
    params.pop("forecast_cursor")
    params["from"] = "2026-09-01T00:00:00"
    response = client.get(url, params=params)
    assert response.status_code == 400 and response.json()["code"] == "invalid_time"


ENUM_CHECKS = [
    (f"ck_{name}_{field}", enum)
    for name in SEMANTIC_TABLES
    for field, enum in [
        ("source_kind", "SourceKind"),
        ("status", "FactStatus"),
        ("supersede_kind", "SupersedeKind"),
    ]
]
ENUM_CHECKS += [
    (f"ck_{model.__tablename__}_value_type", "ValueType")
    for model in CONCEPT_MODELS.values()
    if hasattr(model, "value_type")
]
ENUM_CHECKS += [
    ("ck_aa_observations_epistemic_kind", "EpistemicKind"),
    ("ck_aa_observations_value_availability", "ObservationAvailability"),
]


@pytest.mark.parametrize("name, enum_name", ENUM_CHECKS)
def test_all_new_enum_database_checks_match_the_shared_enums(name, enum_name, engine):
    from app.analytics import enums
    from tests.test_aa_schema_guards import QUOTED, constraint_definition

    assert set(QUOTED.findall(constraint_definition(engine, name))) == set(
        enums.members(getattr(enums, enum_name))
    )
