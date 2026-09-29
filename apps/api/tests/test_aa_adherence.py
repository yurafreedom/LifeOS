"""Slice 6 · Experiment adherence — the permanent T-07 home.

future ≠ missing ≠ negative. A future day can never be stored, so it can never
be a miss. An elapsed day without a record is ``not_recorded`` — not ``unknown``
and not ``missed``. Days after a stop were never run and leave the
denominator. Partial adherence is a normal state, not bad data.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.analytics.coverage import _local_today as coverage_local_today
from app.models import AAExperimentAdherence
from app.services.experiments import days
from tests.aa_experiment_helpers import (
    NOW,
    WINDOW_END,
    WINDOW_START,
    adhere,
    clock,  # noqa: F401 — fixture
    completed,
    created,
    detail,
    move,
    running,
    utc,
)
from tests.aa_helpers import authenticate

DAY = timedelta(days=1)


@pytest.fixture
def owner(client, settings, account_factory, clock):  # noqa: F811
    account = account_factory("adh-owner@example.com")
    authenticate(client, settings, account)
    return account


def states(body) -> dict[str, str]:
    return {entry["day"]: entry["state"] for entry in body["adherence"]["days"]}


def rows(session_factory, experiment_id: str) -> list[AAExperimentAdherence]:
    with session_factory() as db:
        return db.scalars(
            select(AAExperimentAdherence)
            .where(AAExperimentAdherence.experiment_id == uuid.UUID(experiment_id))
            .order_by(AAExperimentAdherence.day, AAExperimentAdherence.recorded_at)
        ).all()


def invariants(adherence: dict) -> None:
    assert (
        adherence["kept"] + adherence["missed"] + adherence["unknown"] + adherence["not_recorded"]
        == adherence["elapsed_days"]
    )
    assert (
        adherence["elapsed_days"] + adherence["future"] + adherence["not_run_after_stop"]
        == adherence["total_days"]
    )


# ───────────────────── A1 · T-07 future day ─────────────────────


def test_t07_a_future_day_is_refused_stores_nothing_and_is_never_missed(
    client, owner, session_factory
):
    experiment_id = running(client)
    tomorrow = date(2026, 10, 10)
    response = adhere(client, experiment_id, tomorrow, "missed")
    assert (response.status_code, response.json()["code"]) == (422, "adherence_day_future")
    assert rows(session_factory, experiment_id) == []
    body = detail(client, experiment_id)
    assert states(body)["2026-10-10"] == "future"
    assert body["adherence"]["missed"] == 0
    assert "future" not in {row.state for row in rows(session_factory, experiment_id)}


def test_t07_local_tomorrow_is_judged_in_the_experiment_zone(client, owner, clock):  # noqa: F811
    experiment_id = running(client)
    # 21:30 UTC on 9 Oct is already 00:30 on 10 Oct in Kyiv (UTC+3): writable.
    clock["now"] = utc(2026, 10, 9, 21, 30)
    assert adhere(client, experiment_id, date(2026, 10, 10)).status_code == 201
    # …while 11 Oct is still the future there.
    assert adhere(client, experiment_id, date(2026, 10, 11)).json()["code"] == (
        "adherence_day_future"
    )


# ───────────────────── A2 · today is elapsed ─────────────────────


def test_local_today_is_writable(client, owner):
    experiment_id = running(client)
    response = adhere(client, experiment_id, date(2026, 10, 9), "kept")
    assert response.status_code == 201
    assert states(response.json())["2026-10-09"] == "kept"


# ───────────────────── A3 · missing ≠ unknown ─────────────────────


def test_a_day_without_a_record_is_not_recorded_and_unknown_stays_unknown(client, owner):
    experiment_id = running(client)
    adhere(client, experiment_id, date(2026, 10, 2), "unknown")
    body = detail(client, experiment_id)
    assert states(body)["2026-10-02"] == "unknown"
    assert states(body)["2026-10-03"] == "not_recorded"
    adherence = body["adherence"]
    assert (adherence["unknown"], adherence["not_recorded"]) == (1, 8)
    invariants(adherence)


# ───────────────────── A4 · partial adherence ─────────────────────


def test_partial_adherence_counts_against_elapsed_days_never_the_whole_window(client, owner):
    experiment_id = running(client)
    for offset in range(9):
        day = WINDOW_START + offset * DAY
        adhere(client, experiment_id, day, "missed" if offset in (1, 4, 7) else "kept")
    adherence = detail(client, experiment_id)["adherence"]
    assert (adherence["kept"], adherence["missed"]) == (6, 3)
    assert (adherence["elapsed_days"], adherence["total_days"]) == (9, 21)
    assert adherence["denominator_basis"] == "experiment_elapsed_days"
    assert adherence["future"] == 12
    invariants(adherence)


def test_days_are_returned_in_calendar_order(client, owner):
    experiment_id = running(client)
    adhere(client, experiment_id, date(2026, 10, 3), "kept")
    adhere(client, experiment_id, date(2026, 10, 2), "missed")
    body = detail(client, experiment_id)
    listed = [entry["day"] for entry in body["adherence"]["days"]]
    assert listed == sorted(listed)
    assert listed[0] == WINDOW_START.isoformat() and listed[-1] == WINDOW_END.isoformat()
    assert states(body)["2026-10-02"] == "missed"


# ───────────────────── A5 · post-abandon ─────────────────────


def test_after_a_stop_days_are_not_run_writes_are_refused_and_history_stays(
    client, owner, clock, session_factory  # noqa: F811
):
    experiment_id = running(client)
    for offset in range(8):
        adhere(client, experiment_id, WINDOW_START + offset * DAY,
               "missed" if offset == 2 else "kept")
    clock["now"] = utc(2026, 10, 12, 9)
    stop = utc(2026, 10, 8, 18)  # 21:00 Kyiv on day 8
    assert move(client, experiment_id, "ABANDONED", stop).status_code == 200
    body = detail(client, experiment_id)
    adherence = body["adherence"]
    assert adherence["abandon_day"] == "2026-10-08"
    for offset in range(8, 21):
        assert states(body)[(WINDOW_START + offset * DAY).isoformat()] == "not_run_after_stop"
    assert (adherence["elapsed_days"], adherence["not_run_after_stop"]) == (8, 13)
    assert (adherence["kept"], adherence["missed"], adherence["future"]) == (7, 1, 0)
    invariants(adherence)
    for day in (date(2026, 10, 7), date(2026, 10, 10)):
        refused = adhere(client, experiment_id, day, "kept")
        assert (refused.status_code, refused.json()["code"]) == (
            409, "experiment_not_accepting_evidence",
        )
    assert len(rows(session_factory, experiment_id)) == 8


def test_abandoning_a_draft_or_a_completed_experiment_derives_days_correctly(
    client, owner, clock  # noqa: F811
):
    draft = created(client)
    assert move(client, draft, "ABANDONED", clock["now"]).status_code == 200
    assert detail(client, draft)["adherence"]["applicable"] is False
    finished = completed(client, clock)
    assert move(client, finished, "ABANDONED", clock["now"]).status_code == 200
    adherence = detail(client, finished)["adherence"]
    # Stopped after the period ended: every window day had elapsed.
    assert (adherence["elapsed_days"], adherence["not_run_after_stop"]) == (21, 0)
    assert adherence["not_recorded"] == 21
    invariants(adherence)


# ───────────────────── A6 · abandon guard ─────────────────────


def test_a_stop_before_an_already_recorded_day_is_refused(client, owner, clock):  # noqa: F811
    experiment_id = running(client)
    adhere(client, experiment_id, date(2026, 10, 5), "kept")
    response = move(client, experiment_id, "ABANDONED", utc(2026, 10, 3, 12))
    assert (response.status_code, response.json()["code"]) == (422, "invalid_time")
    assert detail(client, experiment_id)["lifecycle"] == "RUNNING"


# ───────────────────── A7 · denominator ─────────────────────


def test_post_stop_days_are_excluded_from_the_denominator(client, owner, clock):  # noqa: F811
    experiment_id = running(client)
    adhere(client, experiment_id, date(2026, 10, 1), "kept")
    adhere(client, experiment_id, date(2026, 10, 2), "kept")
    clock["now"] = utc(2026, 10, 20, 9)
    move(client, experiment_id, "ABANDONED", utc(2026, 10, 4, 9))
    adherence = detail(client, experiment_id)["adherence"]
    # 2 kept of 4 elapsed days (1–4 Oct), never "2 of 21" and never "2 of 20".
    assert adherence["elapsed_days"] == 4
    assert adherence["kept"] / adherence["elapsed_days"] == 0.5
    assert adherence["not_recorded"] == 2
    assert adherence["not_run_after_stop"] == 17
    assert adherence["missed"] == 0


# ───────────────────── A8 · corrections ─────────────────────


def test_a_correction_needs_the_key_it_corrects_and_counts_once(
    client, owner, session_factory
):
    experiment_id = running(client)
    first_key = "adh-first-key-0001"
    assert adhere(client, experiment_id, date(2026, 10, 3), "missed",
                  idempotency_key=first_key).status_code == 201
    blind = adhere(client, experiment_id, date(2026, 10, 3), "kept")
    assert (blind.status_code, blind.json()["code"]) == (409, "adherence_day_recorded")
    stale = adhere(client, experiment_id, date(2026, 10, 3), "kept", supersedes="adh-not-it-0001")
    assert stale.json()["code"] == "adherence_day_recorded"
    fixed = adhere(client, experiment_id, date(2026, 10, 3), "kept", supersedes=first_key)
    assert fixed.status_code == 201, fixed.text
    adherence = fixed.json()["adherence"]
    assert states(fixed.json())["2026-10-03"] == "kept"
    assert (adherence["kept"], adherence["missed"], adherence["correction_count"]) == (1, 0, 1)
    record = next(e for e in adherence["days"] if e["day"] == "2026-10-03")["record"]
    assert record["corrected"] is True
    stored = rows(session_factory, experiment_id)
    assert [(r.state, r.status, r.supersede_kind) for r in stored] == [
        ("missed", "superseded", "CORRECTION"),
        ("kept", "active", None),
    ]
    assert stored[1].supersedes_id == stored[0].id
    assert stored[0].superseded_by_id == stored[1].id
    # The superseded answer can no longer be corrected: a second fork is refused.
    fork = adhere(client, experiment_id, date(2026, 10, 3), "unknown", supersedes=first_key)
    assert fork.json()["code"] == "adherence_day_recorded"


def test_a_correction_for_an_unrecorded_day_is_refused(client, owner):
    experiment_id = running(client)
    response = adhere(client, experiment_id, date(2026, 10, 3), "kept", supersedes="adh-ghost-0001")
    assert (response.status_code, response.json()["code"]) == (409, "adherence_day_recorded")


def test_adherence_replays_by_key_and_refuses_a_key_from_another_experiment(
    client, owner, session_factory
):
    first = running(client)
    second = running(client)
    record_key = "adh-replay-key-0001"
    assert adhere(client, first, date(2026, 10, 2), idempotency_key=record_key).status_code == 201
    replay = adhere(client, first, date(2026, 10, 2), idempotency_key=record_key)
    assert (replay.status_code, replay.json()["replayed"]) == (200, True)
    elsewhere = adhere(client, second, date(2026, 10, 2), idempotency_key=record_key)
    assert (elsewhere.status_code, elsewhere.json()["code"]) == (409, "idempotency_key_reused")
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AAExperimentAdherence)) == 1


# ───────────────────── A9 · window edges ─────────────────────


def test_days_outside_the_window_are_refused(client, owner, clock):  # noqa: F811
    experiment_id = running(client)
    before = adhere(client, experiment_id, date(2026, 9, 30))
    assert (before.status_code, before.json()["code"]) == (422, "adherence_day_outside_window")
    clock["now"] = utc(2026, 10, 30, 9)
    after = adhere(client, experiment_id, date(2026, 10, 22))
    assert after.json()["code"] == "adherence_day_outside_window"


def test_a_window_crossing_month_and_year_boundaries(client, owner, clock):  # noqa: F811
    clock["now"] = utc(2026, 12, 29, 9)
    experiment_id = created(
        client, window_start="2026-12-30", window_end="2027-01-02",
        hypothesis_recorded_at=utc(2026, 12, 29, 8).isoformat(),
    )
    move(client, experiment_id, "RUNNING", utc(2026, 12, 29, 9))
    clock["now"] = utc(2027, 1, 1, 10)  # 12:00 Kyiv (UTC+2)
    for day in ("2026-12-30", "2026-12-31", "2027-01-01"):
        assert adhere(client, experiment_id, date.fromisoformat(day)).status_code == 201
    assert adhere(client, experiment_id, date(2027, 1, 2)).json()["code"] == "adherence_day_future"
    adherence = detail(client, experiment_id)["adherence"]
    assert (adherence["elapsed_days"], adherence["future"], adherence["total_days"]) == (3, 1, 4)


# ───────────────────── A10 · not applicable ─────────────────────


def test_a_draft_has_no_adherence_and_no_not_recorded_days(client, owner):
    experiment_id = created(client)
    adherence = detail(client, experiment_id)["adherence"]
    assert adherence["applicable"] is False
    assert (adherence["not_recorded"], adherence["days"], adherence["elapsed_days"]) == (0, [], 0)
    refused = adhere(client, experiment_id, date(2026, 10, 2))
    assert refused.json()["code"] == "experiment_not_accepting_evidence"


def test_reviewed_experiments_accept_no_more_adherence(client, owner, clock):  # noqa: F811
    experiment_id = completed(client, clock)
    assert adhere(client, experiment_id, date(2026, 10, 2)).status_code == 201
    move(client, experiment_id, "REVIEWED", clock["now"])
    refused = adhere(client, experiment_id, date(2026, 10, 3))
    assert refused.json()["code"] == "experiment_not_accepting_evidence"


# ───────────────────── local-day rule ─────────────────────


@pytest.mark.parametrize(
    "instant",
    [NOW, datetime(2026, 10, 24, 21, tzinfo=UTC), datetime(2027, 1, 15, 22, tzinfo=UTC),
     datetime(2026, 12, 31, 22, 30, tzinfo=UTC)],
)
def test_the_local_day_rule_is_the_coverage_rule(instant):
    assert days.local_today("Europe/Kyiv", instant) == coverage_local_today("Europe/Kyiv", instant)
