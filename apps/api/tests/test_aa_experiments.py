"""Slice 6 · Experiments: decisions, factors, result, privacy — the T-08 experiment home.

Hypothesis ≠ fact. Result ≠ causal proof. No decision row ≠ a row with a NULL
choice ≠ ``inconclusive``. Every decision vocabulary stays inside its own scope.
"""

import io
import json
import uuid
import zipfile
from datetime import date

import pytest
from sqlalchemy import func, inspect, select, text

from app.analytics.enums import ExperimentLifecycle, SourceKind
from app.analytics.rules import signal_rules
from app.models import (
    AADecision,
    AAExperiment,
    AAExperimentAdherence,
    AAExperimentObservation,
    AAMetricDefinition,
    AAReviewFactor,
    Base,
)
from app.services import aa_experiments
from app.services.export import EXPORT_TABLES
from tests.aa_experiment_helpers import (
    BASE,
    adhere,
    baseline,
    clock,  # noqa: F401 — fixture
    completed,
    condition,
    created,
    decide,
    detail,
    key,
    minutes,
    move,
    observe,
    running,
    utc,
)
from tests.aa_helpers import authenticate
from tests.aa_review_helpers import (
    FINANCE_SUBJECT_IN,
    get_context,
    review_body,
    seed_finance,
)

FORBIDDEN_KEYS = {"cause", "because", "effect", "caused_by", "score"}
FORBIDDEN_PREFIXES = ("recommend", "suggest")
FACTORS = [{"text": "Отпуск в середине месяца", "epistemic_kind": "maybe"}]
EXPERIMENT_TABLES = ("aa_experiments", "aa_experiment_adherence", "aa_experiment_observations")


@pytest.fixture
def owner(client, settings, account_factory, clock):  # noqa: F811
    account = account_factory("exp2-owner@example.com")
    authenticate(client, settings, account)
    return account


def decisions(session_factory, experiment_id: str) -> list[AADecision]:
    with session_factory() as db:
        return db.scalars(
            select(AADecision)
            .where(AADecision.experiment_id == uuid.UUID(experiment_id))
            .order_by(AADecision.revision)
        ).all()


def keys_of(value, path="") -> list[str]:
    if isinstance(value, dict):
        found = []
        for name, child in value.items():
            found.append(name)
            found.extend(keys_of(child, f"{path}.{name}"))
        return found
    if isinstance(value, list):
        return [k for child in value for k in keys_of(child, path)]
    return []


def aa_counts(engine) -> dict[str, int]:
    with engine.begin() as connection:
        return {
            name: connection.scalar(text(f"SELECT count(*) FROM {name}"))
            for name in inspect(engine).get_table_names()
            if name.startswith("aa_")
        }


# ───────────────────── E3 · T-08 tri-state ─────────────────────


def test_t08_no_row_null_choice_and_inconclusive_are_distinct(
    client, owner, clock, session_factory  # noqa: F811
):
    skipped = completed(client, clock)
    undecided = completed(client, clock)
    unclear = completed(client, clock)
    decide(client, undecided, None)
    decide(client, unclear, "inconclusive")
    assert decisions(session_factory, skipped) == []
    assert [d.choice for d in decisions(session_factory, undecided)] == [None]
    assert [d.choice for d in decisions(session_factory, unclear)] == ["inconclusive"]
    assert detail(client, skipped)["decision"]["current"] is None
    assert detail(client, undecided)["decision"]["current"]["choice"] is None
    assert detail(client, unclear)["decision"]["current"]["choice"] == "inconclusive"


def test_t08_an_omitted_choice_is_422_never_null(client, owner, clock, session_factory):  # noqa: F811
    experiment_id = completed(client, clock)
    response = client.post(f"{BASE}/{experiment_id}/decision", json={"idempotency_key": key()})
    assert (response.status_code, response.json()["code"]) == (422, "invalid_experiment")
    assert decisions(session_factory, experiment_id) == []


# ───────────────────── E4 · scoped vocabularies over the API ─────────────────────


@pytest.mark.parametrize("choice", ["adjust", "later", "maybe", ""])
def test_review_only_or_unknown_choices_are_refused_for_an_experiment(
    client, owner, clock, choice  # noqa: F811
):
    experiment_id = completed(client, clock)
    response = decide(client, experiment_id, choice)
    assert (response.status_code, response.json()["code"]) == (422, "invalid_experiment")


@pytest.mark.parametrize("choice", ["reject", "modify", "longer"])
def test_experiment_only_choices_are_refused_for_a_review(
    client, owner, session_factory, choice
):
    seed_finance(session_factory, owner.user_id)
    context = get_context(client).json()
    saved = client.post(
        "/api/v1/aa/reviews", json=review_body(context, FINANCE_SUBJECT_IN)
    )
    assert saved.status_code == 201, saved.text
    revise = client.post(
        f"/api/v1/aa/reviews/{saved.json()['id']}/revise",
        json={"decision": {"choice": choice}, "idempotency_key": key()},
    )
    assert (revise.status_code, revise.json()["code"]) == (422, "invalid_review")


# ───────────────────── E5 · decision revisions and factors ─────────────────────


def test_decision_revisions_and_factor_ledger(client, owner, clock, session_factory):  # noqa: F811
    experiment_id = completed(client, clock)
    first = decide(
        client, experiment_id, "keep",
        add_factors=[{"text": "Жара", "epistemic_kind": "observed"},
                     {"text": "Отпуск", "epistemic_kind": "maybe"}],
    ).json()
    heat, holiday = first["decision"]["factors"]
    assert (heat["added_in_revision"], heat["retracted_in_revision"]) == (1, None)
    second = decide(
        client, experiment_id, "longer", retract=[heat["id"]],
        add_factors=[{"text": "Жара в первую неделю", "epistemic_kind": "mine",
                      "replaces_id": heat["id"]}],
    ).json()
    history = second["decision"]["history"]
    assert [(h["revision"], h["choice"], h["superseded_in_revision"]) for h in history] == [
        (1, "keep", 2), (2, "longer", None),
    ]
    assert second["decision"]["current"] == {**second["decision"]["current"], "revision": 2,
                                             "choice": "longer"}
    factors = {f["text"]: f for f in second["decision"]["factors"]}
    assert factors["Жара"]["retracted_in_revision"] == 2
    assert factors["Отпуск"]["retracted_in_revision"] is None
    assert factors["Жара в первую неделю"]["replaces_id"] == heat["id"]
    assert factors["Жара в первую неделю"]["added_in_revision"] == 2
    with session_factory() as db:
        scopes = set(db.scalars(select(AAReviewFactor.scope)))
    assert scopes == {"experiment"}
    assert holiday["retracted_in_revision"] is None


def test_factors_cannot_cross_experiments_or_reach_review_factors(
    client, owner, clock, session_factory  # noqa: F811
):
    one = completed(client, clock)
    two = completed(client, clock)
    theirs = decide(client, one, None, add_factors=[{"text": "Жара"}]).json()
    factor_id = theirs["decision"]["factors"][0]["id"]
    cross_replace = decide(client, two, None,
                           add_factors=[{"text": "x", "replaces_id": factor_id}])
    assert (cross_replace.status_code, cross_replace.json()["code"]) == (422, "invalid_factor")
    cross_retract = decide(client, two, None, retract=[factor_id])
    assert cross_retract.json()["code"] == "invalid_factor"
    seed_finance(session_factory, owner.user_id)
    review = client.post(
        "/api/v1/aa/reviews",
        json=review_body(get_context(client).json(), FINANCE_SUBJECT_IN, factors=FACTORS[:1]),
    ).json()
    review_factor = review["factors"][0]["id"]
    assert decide(client, two, None, retract=[review_factor]).json()["code"] == "invalid_factor"
    # …and the Review cannot retract an experiment factor either.
    revise = client.post(
        f"/api/v1/aa/reviews/{review['id']}/revise",
        json={"retract_factor_ids": [factor_id], "idempotency_key": key()},
    )
    assert revise.json()["code"] == "invalid_factor"


def test_decision_replay_and_key_reuse(client, owner, clock, session_factory):  # noqa: F811
    one = completed(client, clock)
    two = completed(client, clock)
    decision_key = "decision-key-000001"
    assert decide(client, one, "keep", idempotency_key=decision_key).status_code == 201
    replay = decide(client, one, "keep", idempotency_key=decision_key)
    assert (replay.status_code, replay.json()["replayed"]) == (200, True)
    elsewhere = decide(client, two, "keep", idempotency_key=decision_key)
    assert (elsewhere.status_code, elsewhere.json()["code"]) == (409, "idempotency_key_reused")
    assert len(decisions(session_factory, one)) == 1


# ───────────────────── E8 · result ─────────────────────


def test_while_running_the_result_is_too_early_with_the_interim_value(client, owner, clock):  # noqa: F811
    experiment_id = running(client)
    baseline(client, experiment_id, minutes("40"))
    interim = observe(client, experiment_id, minutes("25"), utc(2026, 10, 8, 20)).json()
    result = interim["result"]
    assert result["state"] == "too_early"
    assert result["comparison"]["delta"] == {**result["comparison"]["delta"], "state": "unknown",
                                             "reason": "period_not_finished"}
    assert result["comparison"]["desire"] == "unknown"
    current_id = result["comparison"]["current_id"]
    assert current_id == interim["observations"]["outcome"][0]["id"]
    assert (result["outcome_day"], result["covered_days"]) == ("2026-10-08", 8)


@pytest.mark.parametrize(("outcome", "sign"), [("25", "-15"), ("55", "15")])
def test_a_known_result_is_neutral_whatever_its_sign(client, owner, clock, outcome, sign):  # noqa: F811
    experiment_id = running(client)
    baseline(client, experiment_id, minutes("40"))
    clock["now"] = utc(2026, 10, 21, 9)
    assert observe(client, experiment_id, minutes(outcome), utc(2026, 10, 20, 20)).status_code == 201
    clock["now"] = utc(2026, 10, 23, 9)
    body = move(client, experiment_id, "COMPLETED_AWAITING_REVIEW", clock["now"]).json()
    result = body["result"]
    assert result["state"] == "known"
    comparison = result["comparison"]
    assert comparison["availability"] == "present"
    assert comparison["delta"]["state"] == "known"
    assert float(comparison["delta"]["num"]) == float(sign)
    assert comparison["desire"] == "neutral"
    assert (comparison["grounding_id"], comparison["grounding_kind"]) == (None, None)
    assert (comparison["current_concept"], comparison["reference_concept"]) == (
        "observation", "baseline",
    )


def test_missing_operands_and_early_stops_have_no_result(client, owner, clock):  # noqa: F811
    no_baseline = running(client)
    observe(client, no_baseline, minutes("30"), utc(2026, 10, 5, 20))
    clock["now"] = utc(2026, 10, 23, 9)
    move(client, no_baseline, "COMPLETED_AWAITING_REVIEW", clock["now"])
    result = detail(client, no_baseline)["result"]
    assert (result["state"], result["reason"]) == ("no_data", "operand_absent")
    clock["now"] = utc(2026, 10, 9, 9)
    stopped = running(client)
    baseline(client, stopped, minutes("40"))
    observe(client, stopped, minutes("30"), utc(2026, 10, 5, 20))
    move(client, stopped, "ABANDONED", clock["now"])
    stopped_result = detail(client, stopped)["result"]
    assert stopped_result["state"] == "not_applicable"
    assert stopped_result["comparison"]["delta"]["state"] == "not_applicable"
    # The operands stay listed; nothing is computed from them.
    assert len(stopped_result["summary"]["observations"]) == 1


def test_a_hard_deleted_baseline_leaves_no_data_and_no_residue(client, owner, clock):  # noqa: F811
    experiment_id = running(client)
    base = baseline(client, experiment_id, minutes("47.25")).json()["baseline"]
    clock["now"] = utc(2026, 10, 21, 9)
    assert observe(client, experiment_id, minutes("25"), utc(2026, 10, 20, 20)).status_code == 201
    clock["now"] = utc(2026, 10, 23, 9)
    move(client, experiment_id, "COMPLETED_AWAITING_REVIEW", clock["now"])
    assert detail(client, experiment_id)["result"]["state"] == "known"
    erased = client.delete(f"/api/v1/aa/facts/aa_baselines/{base['id']}", params={"mode": "hard"})
    assert erased.status_code == 200, erased.text
    after = client.get(f"{BASE}/{experiment_id}")
    assert after.json()["result"]["state"] == "no_data"
    assert after.json()["baseline"] is None
    assert "47.25" not in after.text


def test_the_latest_outcome_is_the_operand(client, owner, clock):  # noqa: F811
    experiment_id = running(client)
    observe(client, experiment_id, minutes("30"), utc(2026, 10, 7, 20))
    latest = observe(client, experiment_id, minutes("20"), utc(2026, 10, 8, 20)).json()
    observe(client, experiment_id, minutes("99"), utc(2026, 10, 8, 19), role="context",
            label="Шаги")
    outcomes = latest["observations"]["outcome"]
    assert latest["result"]["comparison"]["current_id"] == outcomes[-1]["id"]
    assert [o["value"]["num"] for o in outcomes] == ["30.000000", "20.000000"]


# ───────────────────── E9 · no fake outcomes ─────────────────────


def test_no_catalogue_metric_is_invented_and_shapes_must_match(
    client, owner, clock, session_factory  # noqa: F811
):
    with session_factory() as db:
        catalogue = db.scalar(select(func.count()).select_from(AAMetricDefinition))
    experiment_id = running(client)
    money = observe(client, experiment_id, {"type": "money", "unit_code": "UAH", "num": "5"},
                    utc(2026, 10, 5, 20))
    assert (money.status_code, money.json()["code"]) == (422, "outcome_shape_mismatch")
    wrong_base = baseline(client, experiment_id, {"type": "count", "num": "3"})
    assert wrong_base.json()["code"] == "outcome_shape_mismatch"
    context = observe(client, experiment_id, {"type": "categorical", "text": "чаще «нормально»"},
                      utc(2026, 10, 5, 20), role="context", label="Самочувствие")
    assert context.status_code == 201
    observe(client, experiment_id, minutes("20"), utc(2026, 10, 5, 20))
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AAMetricDefinition)) == catalogue
        assert set(db.scalars(select(AAExperimentObservation.metric_key))) == {None}
        names = set(db.scalars(select(AAMetricDefinition.metric_key)))
    assert not {n for n in names if any(w in n for w in ("sleep", "fatigue", "energy"))}


def test_observations_outside_the_window_or_in_the_future_are_refused(client, owner, clock):  # noqa: F811
    experiment_id = running(client)
    early = observe(client, experiment_id, minutes("20"), utc(2026, 9, 30, 12))
    assert early.json()["code"] == "observation_outside_window"
    future = observe(client, experiment_id, minutes("20"), utc(2026, 10, 9, 12))
    assert future.json()["code"] == "invalid_time"


def test_baseline_rules(client, owner, clock):  # noqa: F811
    experiment_id = created(client)
    overlapping = baseline(client, experiment_id, minutes("40"), window_end="2026-10-01")
    assert (overlapping.status_code, overlapping.json()["code"]) == (422, "baseline_window_invalid")
    assert baseline(client, experiment_id, minutes("40")).status_code == 201  # DRAFT is fine
    finished = completed(client, clock)
    late = baseline(client, finished, minutes("40"))
    assert late.json()["code"] == "experiment_not_accepting_evidence"


def test_conditions_are_observations_on_the_experiment_never_causes(client, owner, clock):  # noqa: F811
    experiment_id = running(client)
    response = condition(client, experiment_id, "Жара, спал с открытым окном",
                         utc(2026, 10, 6, 18), epistemic_kind="maybe")
    assert response.status_code == 201, response.text
    conditions = response.json()["conditions"]
    assert len(conditions) == 1
    assert conditions[0]["concept"] == "observation"
    assert conditions[0]["subject_key"] == f"experiment:experiment:{experiment_id}"
    assert conditions[0]["epistemic_kind"] == "maybe"
    assert conditions[0]["value"]["text"] == "Жара, спал с открытым окном"
    draft = created(client)
    assert condition(client, draft, "x", utc(2026, 10, 6, 18)).json()["code"] == (
        "experiment_not_accepting_evidence"
    )


# ───────────────────── E10 · no causal assertion ─────────────────────


def test_no_response_or_column_names_a_cause_score_or_recommendation(
    client, owner, clock  # noqa: F811
):
    experiment_id = running(client)
    baseline(client, experiment_id, minutes("40"))
    observe(client, experiment_id, minutes("25"), utc(2026, 10, 8, 20))
    condition(client, experiment_id, "Жара", utc(2026, 10, 6, 18))
    adhere(client, experiment_id, date(2026, 10, 2))
    clock["now"] = utc(2026, 10, 23, 9)
    move(client, experiment_id, "COMPLETED_AWAITING_REVIEW", clock["now"])
    decide(client, experiment_id, "keep", add_factors=[{"text": "Жара"}])
    payloads = [detail(client, experiment_id), client.get(BASE).json()]
    for payload in payloads:
        for name in keys_of(payload):
            assert name not in FORBIDDEN_KEYS and not name.startswith(FORBIDDEN_PREFIXES), name
    for model in (AAExperiment, AAExperimentAdherence, AAExperimentObservation, AADecision,
                  AAReviewFactor):
        for column in model.__table__.c.keys():
            assert column not in FORBIDDEN_KEYS and not column.startswith(FORBIDDEN_PREFIXES)


# ───────────────────── E11 · hypothesis ─────────────────────


def test_the_hypothesis_is_an_immutable_claim_not_a_source(client, owner, session_factory):
    experiment_id = created(client)
    body = detail(client, experiment_id)
    assert body["hypothesis"].startswith("Если убрать экран")
    assert client.patch(f"{BASE}/{experiment_id}", json={"hypothesis": "x"}).status_code == 405
    assert client.put(f"{BASE}/{experiment_id}", json={"hypothesis": "x"}).status_code == 405
    assert "HYPOTHESIS" not in {member.value for member in SourceKind}


# ───────────────────── E12 · reads never write ─────────────────────


def test_reads_write_nothing_even_when_completion_is_due(client, owner, clock, engine):  # noqa: F811
    experiment_id = running(client)
    clock["now"] = utc(2026, 10, 23, 9)
    before = aa_counts(engine)
    body = detail(client, experiment_id)
    client.get(BASE)
    client.get(BASE, params={"lifecycle": ["RUNNING"]})
    assert body["window"]["completion_due"] is True
    assert body["lifecycle"] == "RUNNING"
    assert aa_counts(engine) == before


# ───────────────────── E13 · T-09 precursor ─────────────────────


def test_the_pending_filter_excludes_abandoned_and_reviewed(client, owner, clock):  # noqa: F811
    draft = created(client)
    run = running(client)
    stopped = running(client)
    move(client, stopped, "ABANDONED", clock["now"])
    awaiting = completed(client, clock)
    reviewed = completed(client, clock)
    move(client, reviewed, "REVIEWED", clock["now"])
    pending = client.get(
        BASE, params={"lifecycle": ["DRAFT", "RUNNING", "COMPLETED_AWAITING_REVIEW"]}
    ).json()
    assert {item["id"] for item in pending["experiments"]} == {draft, run, awaiting}
    assert aa_experiments.PENDING_LIFECYCLES == (
        ExperimentLifecycle.DRAFT, ExperimentLifecycle.RUNNING,
        ExperimentLifecycle.COMPLETED_AWAITING_REVIEW,
    )
    everything = client.get(BASE).json()["experiments"]
    assert len(everything) == 5
    assert [item["created_at"] for item in everything] == sorted(
        (item["created_at"] for item in everything), reverse=True
    )
    assert client.get(BASE, params={"lifecycle": "PAUSED"}).json()["code"] == "invalid_experiment"
    assert client.get(BASE, params={"limit": 51}).status_code == 422
    assert len(client.get(BASE, params={"limit": 2}).json()["experiments"]) == 2


# ───────────────────── P1 · T-14 export ─────────────────────


def test_t14_export_carries_every_experiment_row_and_registries_agree(
    client, owner, clock, engine  # noqa: F811
):
    experiment_id = running(client)
    adhere(client, experiment_id, date(2026, 10, 2), "missed", idempotency_key="exp-export-adh-1")
    adhere(client, experiment_id, date(2026, 10, 2), "kept", supersedes="exp-export-adh-1")
    observe(client, experiment_id, minutes("25"), utc(2026, 10, 8, 20))
    clock["now"] = utc(2026, 10, 23, 9)
    move(client, experiment_id, "COMPLETED_AWAITING_REVIEW", clock["now"])
    decide(client, experiment_id, "keep", add_factors=[{"text": "Жара"}])
    decide(client, experiment_id, None)
    response = client.get("/api/v1/export")
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        rows = {
            name: [json.loads(line) for line in archive.read(f"{name}.ndjson").splitlines()]
            for name in (*EXPERIMENT_TABLES, "aa_decisions", "aa_review_factors")
        }
    assert manifest["alembic_revision"] == "20260929_0007"
    assert len(rows["aa_experiments"]) == 1
    assert {r["status"] for r in rows["aa_experiment_adherence"]} == {"active", "superseded"}
    assert len(rows["aa_experiment_observations"]) == 1
    assert [r["choice"] for r in sorted(rows["aa_decisions"], key=lambda r: r["revision"])] == [
        "keep", None,
    ]
    assert [r["scope"] for r in rows["aa_review_factors"]] == ["experiment"]
    mapped = {name for name in Base.metadata.tables if name.startswith("aa_")}
    in_database = {name for name in inspect(engine).get_table_names() if name.startswith("aa_")}
    assert len(mapped) == len(EXPORT_TABLES) == len(in_database) == 22
    assert mapped == set(EXPORT_TABLES) == in_database


# ───────────────────── P2 · T-15 account deletion ─────────────────────


def test_t15_account_deletion_leaves_no_experiment_row(
    client, settings, account_factory, clock, engine  # noqa: F811
):
    victim = account_factory("exp-erase@example.com")
    other = account_factory("exp-erase-other@example.com")
    for account in (victim, other):
        authenticate(client, settings, account)
        clock["now"] = utc(2026, 10, 9, 9)
        experiment_id = completed(client, clock)
        adhere(client, experiment_id, date(2026, 10, 2))
        observe(client, experiment_id, minutes("20"), utc(2026, 10, 8, 20))
        decide(client, experiment_id, "reject", add_factors=[{"text": "Жара"}])
    authenticate(client, settings, victim)
    assert client.request(
        "DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"}
    ).status_code == 204
    with engine.begin() as connection:
        for name in EXPORT_TABLES:
            if name == "aa_metric_definitions":
                continue
            assert connection.scalar(
                text(f"SELECT count(*) FROM {name} WHERE user_id = :u"), {"u": victim.user_id}
            ) == 0, name
        for name in (*EXPERIMENT_TABLES, "aa_decisions", "aa_review_factors"):
            assert connection.scalar(
                text(f"SELECT count(*) FROM {name} WHERE user_id = :u"), {"u": other.user_id}
            ) >= 1, name


# ───────────────────── P3 · fact deletion ─────────────────────


def test_experiment_observations_use_the_generic_deletion_but_adherence_does_not(
    client, owner, clock  # noqa: F811
):
    experiment_id = running(client)
    tomb = observe(client, experiment_id, minutes("33.5"), utc(2026, 10, 5, 20)).json()
    hard = observe(client, experiment_id, minutes("44.5"), utc(2026, 10, 6, 20)).json()
    tomb_id = tomb["observations"]["outcome"][0]["id"]
    hard_id = hard["observations"]["outcome"][1]["id"]
    assert client.delete(f"/api/v1/aa/facts/aa_experiment_observations/{tomb_id}",
                         params={"mode": "tombstone"}).status_code == 200
    assert client.delete(f"/api/v1/aa/facts/aa_experiment_observations/{hard_id}",
                         params={"mode": "hard"}).status_code == 200
    after = client.get(f"{BASE}/{experiment_id}")
    assert after.json()["observations"]["outcome"] == []
    assert "33.5" not in after.text and "44.5" not in after.text
    provenance = client.get(f"/api/v1/aa/facts/aa_experiment_observations/{tomb_id}/provenance")
    assert provenance.status_code == 200
    adherence_id = adhere(client, experiment_id, date(2026, 10, 2)).json()["adherence"]["days"][1][
        "record"]["id"]
    refused = client.delete(f"/api/v1/aa/facts/aa_experiment_adherence/{adherence_id}",
                            params={"mode": "hard"})
    assert refused.status_code == 404


# ───────────────────── R1 / S1 · regression ─────────────────────


def test_a_review_save_still_writes_review_scoped_factors_and_decisions(
    client, owner, session_factory
):
    seed_finance(session_factory, owner.user_id)
    saved = client.post(
        "/api/v1/aa/reviews",
        json=review_body(get_context(client).json(), FINANCE_SUBJECT_IN, factors=FACTORS[:1],
                         decision={"choice": "adjust"}),
    )
    assert saved.status_code == 201, saved.text
    with session_factory() as db:
        factor = db.scalar(select(AAReviewFactor))
        decision = db.scalar(select(AADecision))
    assert (factor.scope, factor.experiment_id, factor.review_id is not None) == (
        "review", None, True,
    )
    assert (decision.scope, decision.idempotency_key, decision.experiment_id) == (
        "review", None, None,
    )


def test_the_signal_catalogue_is_still_exactly_four_rules():
    assert sorted(rule.RULE_ID for rule in signal_rules()) == [
        "coverage.window.partial",
        "data.source.stale",
        "finance.monthly_spend.threshold",
        "project.forecast.revision",
    ]
