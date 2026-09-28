"""R2 · project forecast revision over the real, superseding forecast write path.

``tests/aa_signal_helpers.forecast()`` inserts several ACTIVE rows directly. That
is a low-level fixture, not a simulation of production: ``POST /api/v1/aa/forecasts``
appends a new version and retires the prior one as ``superseded`` / ``REVISION``,
so only the newest version is ever active. These tests write forecasts through
that real path and prove the rule still reads the whole surviving history.

``recorded_at`` is stamped by the service itself. Where a test needs deterministic
instants it pins the service clock rather than writing rows by hand, so the
supersession bookkeeping is still the production code's own.
"""

from datetime import datetime

import pytest

from app.analytics.enums import (
    FactStatus,
    SignalMateriality,
    SignalResolution,
    SignalState,
    SupersedeKind,
)
from app.analytics.rules import input_fingerprint, project_forecast_revision, signal_rules
from app.models import AAForecastVersion, AASignalEpisode
from app.services import aa_comparison
from app.services.aa_deletion import delete_fact
from app.services.aa_signals import acknowledge_episode
from tests.aa_helpers import authenticate
from tests.aa_signal_helpers import NOW, PROJECT_METRIC, episodes, report, utc

PROJECT = "p-redesign"


@pytest.fixture
def write_clock(monkeypatch):
    """Pin the instant the semantic write path stamps as ``recorded_at``."""
    state: dict[str, datetime] = {}

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return state["at"]

    monkeypatch.setattr(aa_comparison, "datetime", Clock)
    return state


def _post_forecast(client, completion: str, key: str, *, project: str = PROJECT) -> str:
    response = client.post(
        "/api/v1/aa/forecasts",
        json={
            "subject": {"domain": "project", "type": "project", "id": project},
            "metric_key": PROJECT_METRIC,
            "value": {"type": "date", "date": completion},
            "horizon_at": f"{completion}T00:00:00+00:00",
            "provenance": {
                "source_kind": "USER_REPORTED",
                "basis": "explicit input",
                "method": "manual",
            },
            "idempotency_key": key,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _write_chain(client, clock, values: list[tuple[str, datetime]]) -> list[str]:
    ids = []
    for index, (completion, recorded_at) in enumerate(values):
        clock["at"] = recorded_at
        ids.append(_post_forecast(client, completion, f"fv-chain-{index}"))
    return ids


def _project_signals(result):
    return [
        card for card in result.signals if card.rule_id == project_forecast_revision.RULE_ID
    ]


def _key(forecast_id: str) -> str:
    return f"project.forecast.revision:1:project:project:{PROJECT}:fv={forecast_id}"


# ───────────────────── T1 · the real write path, end to end ─────────────────────


def test_a_revision_through_the_api_keeps_the_previous_forecast_in_the_signal(
    client, settings, account_factory, session_factory
):
    owner = account_factory("r2h-api@example.com")
    authenticate(client, settings, owner)
    first_id = _post_forecast(client, "2026-08-24", "fv-api-1")
    second_id = _post_forecast(client, "2026-08-26", "fv-api-2")

    with session_factory() as db:
        first = db.get(AAForecastVersion, first_id)
        second = db.get(AAForecastVersion, second_id)
        assert first.status == FactStatus.SUPERSEDED
        assert first.supersede_kind == SupersedeKind.REVISION
        assert str(first.superseded_by_id) == second_id
        assert second.status == FactStatus.ACTIVE

    response = client.get("/api/v1/aa/signals")
    assert response.status_code == 200, response.text
    cards = [
        card
        for card in response.json()["signals"]
        if card["rule_id"] == project_forecast_revision.RULE_ID
    ]
    assert len(cards) == 1
    card = cards[0]
    assert card["episode_key"] == _key(second_id)
    assert card["rendered_values"]["from"] == "2026-08-24"
    assert card["rendered_values"]["to"] == "2026-08-26"
    assert card["rendered_values"]["revision_count"] == 2
    assert card["provenance"]["forecast_version_count"] == 2
    assert card["input_fingerprint"] == input_fingerprint([first_id, second_id])
    assert card["input_fingerprint"] != input_fingerprint([second_id])


# ───────────────────── T2 · three-version canonical history ─────────────────────


def test_three_revisions_read_the_immediately_previous_forecast_and_the_full_history(
    client, settings, account_factory, session_factory, write_clock
):
    owner = account_factory("r2h-three@example.com")
    authenticate(client, settings, owner)
    ids = _write_chain(
        client,
        write_clock,
        [
            ("2026-08-20", utc(2026, 8, 12)),
            ("2026-08-24", utc(2026, 8, 14)),
            ("2026-08-26", utc(2026, 8, 16)),
        ],
    )
    card = _project_signals(report(session_factory, owner.user_id))[0]
    # `from` is the immediately previous forecast, not the first-ever one.
    assert card.rendered_values["from"] == "2026-08-24"
    assert card.rendered_values["to"] == "2026-08-26"
    assert card.rendered_values["revision_count"] == 3
    assert card.episode_key == _key(ids[2])
    assert card.input_fingerprint == input_fingerprint(ids)


# ───────────────────── T3 · retrospective as_of ─────────────────────


def test_as_of_reconstructs_the_versions_recorded_by_then_not_only_the_live_one(
    client, settings, account_factory, session_factory, write_clock
):
    owner = account_factory("r2h-asof@example.com")
    authenticate(client, settings, owner)
    first_id, second_id = _write_chain(
        client,
        write_clock,
        [("2026-08-24", utc(2026, 8, 14)), ("2026-08-26", utc(2026, 8, 16))],
    )

    # Between the two writes only the first version had been recorded.
    before = _project_signals(report(session_factory, owner.user_id, as_of=utc(2026, 8, 15)))
    assert len(before) == 1
    assert before[0].rendered_values["from"] is None
    assert before[0].rendered_values["to"] == "2026-08-24"
    assert before[0].rendered_values["revision_count"] == 1
    assert before[0].episode_key == _key(first_id)
    assert before[0].input_fingerprint == input_fingerprint([first_id])

    # After the revision is known, the history holds both — even though at this
    # instant the first version is no longer the live one.
    after = _project_signals(report(session_factory, owner.user_id, as_of=utc(2026, 8, 17)))
    assert len(after) == 1
    assert after[0].rendered_values["from"] == "2026-08-24"
    assert after[0].rendered_values["to"] == "2026-08-26"
    assert after[0].rendered_values["revision_count"] == 2
    assert after[0].episode_key == _key(second_id)
    assert after[0].input_fingerprint == input_fingerprint([first_id, second_id])


# ───────────────────── T4 · tombstoned history ─────────────────────


@pytest.mark.parametrize(
    ("erased", "expected_from"),
    [(0, "2026-08-24"), (1, "2026-08-20")],
    ids=["oldest", "middle"],
)
def test_a_tombstoned_older_forecast_leaves_the_history_entirely(
    client, settings, account_factory, session_factory, write_clock, erased, expected_from
):
    owner = account_factory(f"r2h-tomb-{erased}@example.com")
    authenticate(client, settings, owner)
    values = ["2026-08-20", "2026-08-24", "2026-08-26"]
    ids = _write_chain(
        client,
        write_clock,
        [
            (values[0], utc(2026, 8, 12)),
            (values[1], utc(2026, 8, 14)),
            (values[2], utc(2026, 8, 16)),
        ],
    )
    with session_factory() as db:
        delete_fact(
            db,
            user_id=owner.user_id,
            table_name="aa_forecast_versions",
            fact_id=ids[erased],
            mode="tombstone",
        )

    surviving = [identity for index, identity in enumerate(ids) if index != erased]
    card = _project_signals(report(session_factory, owner.user_id))[0]
    assert card.rendered_values["from"] == expected_from
    assert card.rendered_values["to"] == "2026-08-26"
    assert card.rendered_values["revision_count"] == 2
    assert card.provenance["forecast_version_count"] == 2
    assert card.episode_key == _key(ids[2])
    assert card.input_fingerprint == input_fingerprint(surviving)
    # The erased value never resurfaces anywhere on the card.
    assert values[erased] not in repr(card.rendered_values)
    assert values[erased] not in repr(card.provenance)

    # Retrospectively too: a tombstone is excluded outright, not only from now on.
    past = _project_signals(report(session_factory, owner.user_id, as_of=utc(2026, 8, 17)))[0]
    assert past.input_fingerprint == input_fingerprint(surviving)
    assert values[erased] not in repr(past.rendered_values)


# ───────────────────── T5 · pre-fix acknowledgement is honoured ─────────────────────


def test_an_acknowledged_pre_fix_episode_for_the_same_forecast_is_not_reopened(
    client, settings, account_factory, session_factory, write_clock
):
    owner = account_factory("r2h-ack@example.com")
    authenticate(client, settings, owner)
    first_id, second_id = _write_chain(
        client,
        write_clock,
        [("2026-08-24", utc(2026, 8, 14)), ("2026-08-26", utc(2026, 8, 16))],
    )
    # What the defective rule persisted: the same occurrence (newest forecast id),
    # acknowledged over a fingerprint that covered only the newest version.
    narrow = input_fingerprint([second_id])
    acknowledged_at = utc(2026, 8, 17)
    with session_factory.begin() as db:
        db.add(
            AASignalEpisode(
                user_id=owner.user_id,
                subject_domain="project",
                subject_type="project",
                subject_id=PROJECT,
                episode_key=_key(second_id),
                rule_id=project_forecast_revision.RULE_ID,
                rule_version=project_forecast_revision.RULE_VERSION,
                first_seen_at=utc(2026, 8, 16, 13),
                last_evaluated_at=acknowledged_at,
                last_fingerprint=narrow,
                resolution=SignalResolution.ACKNOWLEDGED,
                acknowledged_at=acknowledged_at,
                acknowledged_fingerprint=narrow,
                reopened_count=0,
            )
        )

    result = report(session_factory, owner.user_id)
    assert _project_signals(result) == []
    held = [
        card
        for card in result.acknowledged
        if card.rule_id == project_forecast_revision.RULE_ID
    ]
    assert len(held) == 1
    assert held[0].episode_key == _key(second_id)
    assert held[0].input_fingerprint == input_fingerprint([first_id, second_id])
    assert held[0].input_fingerprint != narrow
    assert held[0].acknowledged is True
    assert held[0].reopened_count == 0

    with session_factory() as db:
        [row] = episodes(db, user_id=owner.user_id)
        assert row.episode_key == _key(second_id)
        assert row.resolution == SignalResolution.ACKNOWLEDGED
        assert row.acknowledged_at == acknowledged_at
        assert row.acknowledged_fingerprint == narrow
        assert row.last_fingerprint == input_fingerprint([first_id, second_id])
        assert row.reopened_count == 0
        assert row.reopened_at is None


# ───────────────────── T6 · a genuine new revision still reappears ─────────────────────


def test_a_genuine_new_revision_after_acknowledgement_is_a_new_unacknowledged_card(
    client, settings, account_factory, session_factory, write_clock
):
    owner = account_factory("r2h-reappear@example.com")
    authenticate(client, settings, owner)
    ids = _write_chain(
        client,
        write_clock,
        [("2026-08-24", utc(2026, 8, 14)), ("2026-08-26", utc(2026, 8, 16))],
    )
    current = _project_signals(report(session_factory, owner.user_id))[0]
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=current.episode_key,
            observed_fingerprint=current.input_fingerprint,
            now=NOW,
        )
    assert _project_signals(report(session_factory, owner.user_id)) == []

    write_clock["at"] = utc(2026, 8, 18)
    ids.append(_post_forecast(client, "2026-08-29", "fv-chain-new"))
    [card] = _project_signals(report(session_factory, owner.user_id))
    assert card.episode_key == _key(ids[2])
    assert card.acknowledged is False
    assert card.rendered_values["from"] == "2026-08-26"
    assert card.rendered_values["to"] == "2026-08-29"
    assert card.rendered_values["revision_count"] == 3
    assert card.input_fingerprint == input_fingerprint(ids)

    with session_factory() as db:
        rows = {row.episode_key: row for row in episodes(db, user_id=owner.user_id)}
        assert rows[current.episode_key].resolution == SignalResolution.WITHDRAWN
        assert rows[current.episode_key].acknowledged_at is not None


# ───────────────────── T7 · no semantic drift ─────────────────────


def test_the_fix_changes_no_rule_identity_or_semantics(
    client, settings, account_factory, session_factory, write_clock
):
    assert project_forecast_revision.RULE_ID == "project.forecast.revision"
    assert project_forecast_revision.RULE_VERSION == 1
    assert len(signal_rules()) == 4

    owner = account_factory("r2h-drift@example.com")
    authenticate(client, settings, owner)
    _write_chain(
        client,
        write_clock,
        [("2026-08-26", utc(2026, 8, 14)), ("2026-08-24", utc(2026, 8, 16))],
    )
    card = _project_signals(report(session_factory, owner.user_id))[0]
    # Earlier is not «good»: the card is the same material, base-state card.
    assert card.materiality is SignalMateriality.MATERIAL
    assert card.state is SignalState.NORMAL
    assert card.stakes is False
    for forbidden in ("desire", "desirability", "favorable", "unfavorable"):
        assert forbidden not in card.rendered_values
        assert forbidden not in card.provenance


# ───────────────────── T8 · account isolation ─────────────────────


def test_another_accounts_forecasts_never_enter_the_history(
    client, settings, account_factory, session_factory, write_clock
):
    owner = account_factory("r2h-owner@example.com")
    other = account_factory("r2h-other@example.com")

    authenticate(client, settings, other)
    write_clock["at"] = utc(2026, 8, 13)
    _post_forecast(client, "2026-08-30", "fv-other-1")
    write_clock["at"] = utc(2026, 8, 15)
    _post_forecast(client, "2026-08-31", "fv-other-2")

    authenticate(client, settings, owner)
    ids = _write_chain(
        client,
        write_clock,
        [("2026-08-24", utc(2026, 8, 14)), ("2026-08-26", utc(2026, 8, 16))],
    )
    [card] = _project_signals(report(session_factory, owner.user_id))
    assert card.rendered_values["from"] == "2026-08-24"
    assert card.rendered_values["to"] == "2026-08-26"
    assert card.rendered_values["revision_count"] == 2
    assert card.input_fingerprint == input_fingerprint(ids)
    assert "2026-08-3" not in repr(card.rendered_values)
