"""Slice 6 · Experiment lifecycle through the real API.

Lifecycle ≠ outcome (D4). Six legal edges; everything else is 409, except a
request for a state this row has already entered, which is a harmless 200
no-op so a duplicate from another tab can never dead-letter the write queue.
"""

import json
import threading
import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.main import create_app
from app.models import AAExperiment
from app.services import aa_experiments
from app.services.experiments import lifecycle as lifecycle_module
from tests.aa_experiment_helpers import (
    BASE,
    HYPOTHESIS_AT,
    STARTED_AT,
    adhere,
    baseline,
    clock,  # noqa: F401 — fixture
    completed,
    condition,
    create,
    create_body,
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

TARGETS = ("RUNNING", "COMPLETED_AWAITING_REVIEW", "REVIEWED", "ABANDONED")
INSTANTS = {
    "RUNNING": ("started_at", "start_key"),
    "COMPLETED_AWAITING_REVIEW": ("completed_at", "complete_key"),
    "REVIEWED": ("reviewed_at", "review_key"),
    "ABANDONED": ("abandoned_at", "abandon_key"),
}


@pytest.fixture
def owner(client, settings, account_factory, clock):  # noqa: F811
    account = account_factory("exp-owner@example.com")
    authenticate(client, settings, account)
    return account


def stored(session_factory, experiment_id: str) -> AAExperiment:
    with session_factory() as db:
        return db.scalar(select(AAExperiment).where(AAExperiment.id == uuid.UUID(experiment_id)))


def in_state(client, clock, state: str, origin: str | None = None) -> str:  # noqa: F811
    """An experiment in ``state`` (for ABANDONED, abandoned from ``origin``)."""
    if state == "DRAFT":
        return created(client)
    if state == "RUNNING":
        return running(client)
    if state in ("COMPLETED_AWAITING_REVIEW", "REVIEWED"):
        experiment_id = completed(client, clock)
        if state == "REVIEWED":
            assert move(client, experiment_id, "REVIEWED", utc(2026, 10, 23, 9)).status_code == 200
        return experiment_id
    assert state == "ABANDONED"
    experiment_id = in_state(client, clock, origin)
    response = move(client, experiment_id, "ABANDONED", clock["now"])
    assert response.status_code == 200, response.text
    return experiment_id


# ───────────────────── L1 · every legal edge ─────────────────────


@pytest.mark.parametrize(
    ("source", "target"),
    sorted(tuple(map(str, edge)) for edge in aa_experiments.LEGAL_EDGES),
)
def test_every_legal_edge_applies_and_stores_its_instant_and_key(
    client, owner, clock, session_factory, source, target  # noqa: F811
):
    experiment_id = in_state(client, clock, source)
    if target == "COMPLETED_AWAITING_REVIEW":
        clock["now"] = utc(2026, 10, 23, 9)
    at, transition_key = clock["now"], key()
    response = move(client, experiment_id, target, at, transition_key)
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["lifecycle"], body["replayed"], body["no_op"]) == (target, False, False)
    row = stored(session_factory, experiment_id)
    instant, key_column = INSTANTS[target]
    assert getattr(row, instant) == at
    assert getattr(row, key_column) == transition_key
    if target == "ABANDONED":
        assert row.abandoned_from == source
        assert body["abandoned_from"] == source
    else:
        assert row.abandoned_from is None


# ───────────────────── L2 · every illegal edge ─────────────────────


@pytest.mark.parametrize(
    ("state", "origin"),
    [
        ("DRAFT", None),
        ("RUNNING", None),
        ("COMPLETED_AWAITING_REVIEW", None),
        ("REVIEWED", None),
        ("ABANDONED", "DRAFT"),
        ("ABANDONED", "RUNNING"),
        ("ABANDONED", "COMPLETED_AWAITING_REVIEW"),
    ],
)
def test_every_illegal_edge_to_an_unentered_state_is_409(
    client, owner, clock, session_factory, state, origin  # noqa: F811
):
    experiment_id = in_state(client, clock, state, origin)
    before = stored(session_factory, experiment_id)
    tried = 0
    for target in TARGETS:
        if (state, target) in aa_experiments.LEGAL_EDGES:
            continue
        if getattr(before, INSTANTS[target][0]) is not None:
            continue  # already entered: L4, not an illegal edge
        response = move(client, experiment_id, target, clock["now"])
        assert (response.status_code, response.json()["code"]) == (409, "invalid_transition"), (
            state, origin, target,
        )
        tried += 1
    # From COMPLETED_AWAITING_REVIEW every non-legal target was already entered (L4).
    assert tried >= (0 if state == "COMPLETED_AWAITING_REVIEW" else 1)
    after = stored(session_factory, experiment_id)
    assert (after.lifecycle, after.abandoned_from) == (before.lifecycle, before.abandoned_from)


def test_terminal_states_admit_no_new_state(client, owner, clock):  # noqa: F811
    reviewed = in_state(client, clock, "REVIEWED")
    assert move(client, reviewed, "ABANDONED", clock["now"]).json()["code"] == "invalid_transition"
    abandoned = in_state(client, clock, "ABANDONED", "DRAFT")
    for target in ("RUNNING", "COMPLETED_AWAITING_REVIEW", "REVIEWED"):
        assert move(client, abandoned, target, clock["now"]).status_code == 409


def test_draft_is_not_a_transition_target(client, owner):
    experiment_id = created(client)
    response = move(client, experiment_id, "DRAFT", STARTED_AT)
    assert (response.status_code, response.json()["code"]) == (422, "invalid_experiment")


# ───────────────────── L3 · same-key replay ─────────────────────


def test_same_key_replay_returns_200_and_never_overwrites_the_instant(
    client, owner, clock, session_factory  # noqa: F811
):
    experiment_id = created(client)
    start_key = key()
    assert move(client, experiment_id, "RUNNING", STARTED_AT, start_key).status_code == 200
    clock["now"] = utc(2026, 10, 9, 15)
    replay = move(client, experiment_id, "RUNNING", utc(2026, 10, 9, 14), start_key)
    assert replay.status_code == 200
    assert (replay.json()["replayed"], replay.json()["no_op"]) == (True, False)
    assert stored(session_factory, experiment_id).started_at == STARTED_AT


# ───────────────────── L4 · target already entered ─────────────────────


@pytest.mark.parametrize(
    ("state", "origin", "target"),
    [
        ("RUNNING", None, "RUNNING"),
        ("ABANDONED", "RUNNING", "ABANDONED"),
        ("REVIEWED", None, "COMPLETED_AWAITING_REVIEW"),
        ("REVIEWED", None, "RUNNING"),
        ("ABANDONED", "RUNNING", "RUNNING"),
    ],
)
def test_a_target_already_entered_is_a_200_no_op_that_stores_nothing(
    client, owner, clock, session_factory, state, origin, target  # noqa: F811
):
    experiment_id = in_state(client, clock, state, origin)
    before = stored(session_factory, experiment_id)
    response = move(client, experiment_id, target, clock["now"], key())
    assert response.status_code == 200, response.text
    assert (response.json()["no_op"], response.json()["replayed"]) == (True, False)
    after = stored(session_factory, experiment_id)
    for column in ("lifecycle", *INSTANTS[target], "abandoned_from"):
        assert getattr(after, column) == getattr(before, column)


# ───────────────────── L5 · key reuse ─────────────────────


def test_a_key_reused_for_another_transition_or_experiment_is_409(client, owner, clock):  # noqa: F811
    first = created(client)
    start_key = key()
    assert move(client, first, "RUNNING", STARTED_AT, start_key).status_code == 200
    reused = move(client, first, "ABANDONED", clock["now"], start_key)
    assert (reused.status_code, reused.json()["code"]) == (409, "idempotency_key_reused")
    second = created(client)
    elsewhere = move(client, second, "RUNNING", STARTED_AT, start_key)
    assert (elsewhere.status_code, elsewhere.json()["code"]) == (409, "idempotency_key_reused")
    create_key = key()
    third = created(client, idempotency_key=create_key)
    as_transition = move(client, third, "RUNNING", STARTED_AT, create_key)
    assert as_transition.json()["code"] == "idempotency_key_reused"


# ───────────────────── L6 · compare-and-set ─────────────────────


def test_a_transition_decided_on_a_stale_state_never_applies(
    client, owner, clock, session_factory, monkeypatch  # noqa: F811
):
    experiment_id = created(client)
    original = lifecycle_module._check_preconditions
    raced = {"done": False}

    def race_then_check(db, row, *, target, occurred_at):
        if not raced["done"]:
            raced["done"] = True
            with session_factory() as other:
                aa_experiments.transition(
                    other, user_id=owner.user_id, experiment_id=uuid.UUID(experiment_id),
                    target="ABANDONED", occurred_at=STARTED_AT, key=key(),
                )
        return original(db, row, target=target, occurred_at=occurred_at)

    monkeypatch.setattr(lifecycle_module, "_check_preconditions", race_then_check)
    loser = move(client, experiment_id, "RUNNING", STARTED_AT)
    assert (loser.status_code, loser.json()["code"]) == (409, "invalid_transition")
    row = stored(session_factory, experiment_id)
    assert (row.lifecycle, row.abandoned_from, row.started_at) == ("ABANDONED", "DRAFT", None)


def test_racing_transitions_apply_exactly_one(owner, clock, session_factory, client):  # noqa: F811
    for _ in range(5):
        experiment_id = uuid.UUID(created(client))
        barrier = threading.Barrier(2)
        outcomes: dict[str, object] = {}

        def attempt(target: str) -> None:
            with session_factory() as db:
                barrier.wait()
                try:
                    outcomes[target] = aa_experiments.transition(
                        db, user_id=owner.user_id, experiment_id=experiment_id,
                        target=target, occurred_at=STARTED_AT, key=key(),
                    )
                except aa_experiments.InvalidTransitionError as error:
                    outcomes[target] = error

        threads = [threading.Thread(target=attempt, args=(t,)) for t in ("RUNNING", "ABANDONED")]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        winners = [
            target for target, result in outcomes.items()
            if isinstance(result, aa_experiments.TransitionResult) and not result.no_op
        ]
        assert len(winners) == 1, outcomes
        row = stored(session_factory, str(experiment_id))
        if winners == ["RUNNING"]:
            assert row.lifecycle == "RUNNING"
        else:
            assert (row.lifecycle, row.abandoned_from, row.started_at) == (
                "ABANDONED", "DRAFT", None,
            )


# ───────────────────── L8 · IANA completion boundary ─────────────────────


@pytest.mark.parametrize(
    ("window_start", "window_end", "last_minute", "first_minute"),
    [
        # Summer offset (UTC+3), the night before the 25 October DST switch.
        (date(2026, 10, 10), date(2026, 10, 24), utc(2026, 10, 24, 20, 59), utc(2026, 10, 24, 21)),
        # Winter offset (UTC+2).
        (date(2027, 1, 1), date(2027, 1, 15), utc(2027, 1, 15, 21, 59), utc(2027, 1, 15, 22)),
    ],
)
def test_completion_waits_for_the_local_end_of_the_window(
    client, owner, clock, window_start, window_end, last_minute, first_minute  # noqa: F811
):
    start_instant = utc(window_start.year, window_start.month, window_start.day, 6)
    clock["now"] = start_instant
    experiment_id = created(
        client,
        window_start=window_start.isoformat(),
        window_end=window_end.isoformat(),
        hypothesis_recorded_at=(start_instant - timedelta(days=1)).isoformat(),
    )
    assert move(client, experiment_id, "RUNNING", start_instant).status_code == 200
    clock["now"] = last_minute
    early = move(client, experiment_id, "COMPLETED_AWAITING_REVIEW", last_minute)
    assert (early.status_code, early.json()["code"]) == (422, "window_not_elapsed")
    assert detail(client, experiment_id)["window"]["completion_due"] is False
    clock["now"] = first_minute
    assert detail(client, experiment_id)["window"]["completion_due"] is True
    on_time = move(client, experiment_id, "COMPLETED_AWAITING_REVIEW", first_minute)
    assert on_time.status_code == 200, on_time.text
    assert on_time.json()["lifecycle"] == "COMPLETED_AWAITING_REVIEW"


def test_completion_is_refused_while_the_server_day_is_inside_the_window(client, owner, clock):  # noqa: F811
    experiment_id = running(client)
    # A client clock claiming the future is not enough; the server re-checks.
    response = move(client, experiment_id, "COMPLETED_AWAITING_REVIEW", clock["now"])
    assert response.json()["code"] == "window_not_elapsed"


def test_start_after_the_window_ended_is_refused(client, owner, clock):  # noqa: F811
    clock["now"] = utc(2026, 10, 23, 9)
    experiment_id = created(client)
    response = move(client, experiment_id, "RUNNING", clock["now"])
    assert (response.status_code, response.json()["code"]) == (422, "window_already_ended")


# ───────────────────── L9 · client occurrence time ─────────────────────


def test_the_client_instant_is_stored_even_when_replayed_hours_later(
    client, owner, clock, session_factory  # noqa: F811
):
    experiment_id = created(client)
    clock["now"] = utc(2026, 10, 9, 18)  # the queued request arrives hours later
    assert move(client, experiment_id, "RUNNING", STARTED_AT).status_code == 200
    assert stored(session_factory, experiment_id).started_at == STARTED_AT
    events = detail(client, experiment_id)["lifecycle_events"]
    assert [event["state"] for event in events] == ["DRAFT", "RUNNING"]


def test_future_and_non_monotonic_instants_are_refused(client, owner, clock):  # noqa: F811
    experiment_id = created(client)
    future = move(client, experiment_id, "RUNNING", clock["now"] + timedelta(minutes=6))
    assert (future.status_code, future.json()["code"]) == (422, "invalid_time")
    backwards = move(client, experiment_id, "RUNNING", HYPOTHESIS_AT - timedelta(minutes=1))
    assert (backwards.status_code, backwards.json()["code"]) == (422, "invalid_time")
    skew = move(client, experiment_id, "RUNNING", clock["now"] + timedelta(minutes=4))
    assert skew.status_code == 200
    naive = client.post(
        f"{BASE}/{experiment_id}/transition",
        json={"to": "ABANDONED", "occurred_at": "2026-10-09T10:00:00", "idempotency_key": key()},
    )
    assert (naive.status_code, naive.json()["code"]) == (422, "invalid_experiment")


# ───────────────────── L10 · decision ⊥ lifecycle ─────────────────────


@pytest.mark.parametrize("choice", ["keep", "modify", "longer", "reject", "inconclusive", None])
def test_a_decision_never_moves_the_lifecycle(client, owner, clock, choice):  # noqa: F811
    experiment_id = completed(client, clock)
    response = decide(client, experiment_id, choice)
    assert response.status_code == 201, response.text
    assert response.json()["lifecycle"] == "COMPLETED_AWAITING_REVIEW"
    assert response.json()["decision"]["current"]["choice"] == choice


def test_reviewed_without_any_decision_is_valid(client, owner, clock):  # noqa: F811
    experiment_id = completed(client, clock)
    response = move(client, experiment_id, "REVIEWED", clock["now"])
    assert response.status_code == 200
    assert response.json()["decision"] == {"current": None, "history": [], "factors": []}


@pytest.mark.parametrize(
    ("state", "origin"),
    [("DRAFT", None), ("RUNNING", None), ("ABANDONED", "RUNNING"),
     ("ABANDONED", "COMPLETED_AWAITING_REVIEW")],
)
def test_a_decision_outside_review_states_is_409(client, owner, clock, state, origin):  # noqa: F811
    experiment_id = in_state(client, clock, state, origin)
    response = decide(client, experiment_id, "keep")
    assert (response.status_code, response.json()["code"]) == (
        409, "experiment_not_awaiting_decision",
    )


def test_a_decision_is_allowed_after_review(client, owner, clock):  # noqa: F811
    experiment_id = in_state(client, clock, "REVIEWED")
    response = decide(client, experiment_id, "inconclusive")
    assert response.status_code == 201
    assert response.json()["lifecycle"] == "REVIEWED"


# ───────────────────── E1 · client-minted create ─────────────────────


def test_the_client_uuid_is_the_stored_id_and_create_replays(client, owner, session_factory):
    body = create_body()
    first = client.post(BASE, json=body)
    assert first.status_code == 201
    assert first.json()["id"] == body["id"]
    assert first.json()["lifecycle"] == "DRAFT"
    replay = client.post(BASE, json=body)
    assert (replay.status_code, replay.json()["replayed"]) == (200, True)
    changed = client.post(BASE, json={**body, "title": "Другое"})
    assert (changed.status_code, changed.json()["code"]) == (409, "idempotency_key_reused")
    with session_factory() as db:
        assert db.query(AAExperiment).count() == 1


@pytest.mark.parametrize(
    "overrides",
    [
        pytest.param({"id": str(uuid.uuid1())}, id="uuid-v1"),
        pytest.param({"id": "not-a-uuid"}, id="not-uuid"),
        pytest.param({"timezone": "Mars/Olympus"}, id="unknown-zone"),
        pytest.param({"window_end": "2026-09-30"}, id="reversed-window"),
        pytest.param({"window_end": "2027-10-02"}, id="window-367-days"),
        pytest.param({"title": "   "}, id="blank-title"),
        pytest.param({"hypothesis": "x" * 1001}, id="long-hypothesis"),
        pytest.param({"outcome": {"label": "Сон", "value_type": "categorical"}}, id="categorical"),
        pytest.param(
            {"outcome": {"label": "Сон", "value_type": "duration", "unit_code": "hour"}},
            id="duration-hours",
        ),
        pytest.param(
            {"outcome": {"label": "Сон", "value_type": "scale", "scale_min": "5",
                         "scale_max": "1"}},
            id="reversed-scale",
        ),
        pytest.param({"hypothesis_recorded_at": "2026-09-30T09:00:00"}, id="naive-instant"),
    ],
)
def test_invalid_create_bodies_are_422_invalid_experiment(client, owner, overrides):
    response = create(client, **overrides)
    assert (response.status_code, response.json()["code"]) == (422, "invalid_experiment")


def test_a_create_claimed_in_the_future_is_invalid_time(client, owner, clock):  # noqa: F811
    response = create(client, hypothesis_recorded_at=(clock["now"] + timedelta(hours=1)).isoformat())
    assert (response.status_code, response.json()["code"]) == (422, "invalid_time")


def test_a_366_day_window_is_accepted(client, owner):
    assert create(client, window_end="2027-09-30").status_code == 201


# ───────────────────── E2 · id collision ─────────────────────


def test_a_foreign_or_reused_id_is_unavailable_and_leaks_nothing(
    client, settings, account_factory, clock, session_factory  # noqa: F811
):
    a = account_factory("exp-a@example.com")
    b = account_factory("exp-b@example.com")
    authenticate(client, settings, a)
    body = create_body(title="Секретный заголовок A")
    assert client.post(BASE, json=body).status_code == 201
    own_other_key = client.post(BASE, json={**body, "idempotency_key": key()})
    authenticate(client, settings, b)
    foreign = client.post(BASE, json={**body, "title": "B", "idempotency_key": key()})
    for response in (own_other_key, foreign):
        assert (response.status_code, response.json()["code"]) == (409, "experiment_id_unavailable")
    assert own_other_key.content == foreign.content
    assert "Секретный" not in foreign.text
    row = stored(session_factory, body["id"])
    assert (row.user_id, row.title) == (a.user_id, "Секретный заголовок A")


# ───────────────────── E6 · isolation ─────────────────────


def test_every_route_hides_another_accounts_experiment(
    client, settings, account_factory, clock  # noqa: F811
):
    a = account_factory("exp-iso-a@example.com")
    b = account_factory("exp-iso-b@example.com")
    authenticate(client, settings, a)
    experiment_id = running(client)
    authenticate(client, settings, b)
    assert client.get(f"{BASE}/{experiment_id}").status_code == 404
    assert client.get(f"{BASE}/{uuid.uuid4()}").json()["code"] == "experiment_not_found"
    assert client.get(BASE).json()["experiments"] == []
    writes = [
        move(client, experiment_id, "ABANDONED", clock["now"]),
        adhere(client, experiment_id, date(2026, 10, 2)),
        observe(client, experiment_id, minutes("20"), clock["now"]),
        baseline(client, experiment_id, minutes("40")),
        condition(client, experiment_id, "Жара", clock["now"]),
        decide(client, experiment_id, "keep"),
    ]
    for response in writes:
        assert (response.status_code, response.json()["code"]) == (404, "experiment_not_found")
    authenticate(client, settings, a)
    assert detail(client, experiment_id)["lifecycle"] == "RUNNING"


def test_a_body_user_id_is_rejected(client, owner):
    response = client.post(BASE, json={**create_body(), "user_id": str(owner.user_id)})
    assert (response.status_code, response.json()["code"]) == (422, "invalid_experiment")


# ───────────────────── E7 · guards ─────────────────────

WRITE_PATHS = ("", "/{id}/transition", "/{id}/adherence", "/{id}/observations", "/{id}/baseline",
               "/{id}/conditions", "/{id}/decision")


def valid_body(path: str, now) -> dict:
    return {
        "": create_body(),
        "/{id}/transition": {"to": "ABANDONED", "occurred_at": now.isoformat()},
        "/{id}/adherence": {"day": "2026-10-02", "state": "kept"},
        "/{id}/observations": {
            "role": "outcome", "label": "Сон", "value": minutes("20"),
            "occurred_at": now.isoformat(), "occurred_tz": "Europe/Kyiv",
        },
        "/{id}/baseline": {
            "value": minutes("40"), "window_start": "2026-09-01", "window_end": "2026-09-30",
        },
        "/{id}/conditions": {
            "text": "Жара", "epistemic_kind": "observed", "occurred_at": now.isoformat(),
            "occurred_tz": "Europe/Kyiv",
        },
        "/{id}/decision": {"choice": None},
    }[path] | ({} if path == "" else {"idempotency_key": key()})


@pytest.mark.parametrize("path", WRITE_PATHS)
def test_wrong_content_type_is_415_before_any_422(client, owner, path):
    experiment_id = created(client)
    url = BASE + path.format(id=experiment_id)
    invalid = client.post(url, content="{\"nonsense\": 1}", headers={"Content-Type": "text/plain"})
    assert invalid.status_code == 415
    garbage = client.post(url, content="not json", headers={"Content-Type": "text/plain"})
    assert garbage.status_code == 415


@pytest.mark.parametrize("path", WRITE_PATHS)
def test_cross_origin_writes_are_refused(client, owner, clock, path):  # noqa: F811
    experiment_id = running(client)
    url = BASE + path.format(id=experiment_id)
    response = client.post(
        url, content=json.dumps(valid_body(path, clock["now"])),
        headers={"Origin": "https://evil.example", "Content-Type": "application/json"},
    )
    assert response.status_code == 403
    assert detail(client, experiment_id)["lifecycle"] == "RUNNING"


def test_writes_are_closed_and_reads_open_when_the_gate_is_closed(
    test_database_url, session_factory, account_factory, client, settings, clock  # noqa: F811
):
    owner = account_factory("exp-gate@example.com")
    authenticate(client, settings, owner)
    experiment_id = running(client)
    gated = Settings(
        environment="test",
        database_url=test_database_url,
        bootstrap_token="test-bootstrap-token-that-is-at-least-32-chars",
        allowed_hosts=["testserver"],
        allowed_origins=["http://testserver"],
        cookie_secure=False,
    )
    app = create_app(settings=gated, session_factory=session_factory)
    with TestClient(app, headers={"Origin": "http://testserver"}) as gated_client:
        authenticate(gated_client, gated, owner)
        assert gated_client.get(f"{BASE}/{experiment_id}").status_code == 200
        assert gated_client.get(BASE).status_code == 200
        responses = [
            create(gated_client),
            move(gated_client, experiment_id, "ABANDONED", clock["now"]),
            adhere(gated_client, experiment_id, date(2026, 10, 2)),
            decide(gated_client, experiment_id, None),
        ]
    for response in responses:
        assert (response.status_code, response.json()["code"]) == (403, "aa_writes_disabled")


def test_reads_require_a_session(client):
    assert client.get(BASE).status_code == 401
    assert client.get(f"{BASE}/{uuid.uuid4()}").status_code == 401
