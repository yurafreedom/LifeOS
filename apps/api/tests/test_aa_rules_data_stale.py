"""R3 · data source stale — one episode per staleness period, not per stale day.

The failure this guards against is the obvious one: a card that returns every
morning while a source stays quiet. The ``since`` date is derived from the data's
own newest recording time, so tomorrow's evaluation computes the same key and
finds the same episode.
"""

import pytest

from app.analytics.enums import SignalMateriality, SignalResolution, SignalState
from app.analytics.rules import data_stale
from app.services.aa_signals import acknowledge_episode
from tests.aa_signal_helpers import (
    PERIOD,
    episodes,
    expectation,
    report,
    transaction,
    utc,
)


def _stale_signals(result):
    return [card for card in result.signals if card.rule_id == data_stale.RULE_ID]


def _seed(db, user_id, *, recorded_at, identity="stale-tx"):
    # An expectation keeps the period discoverable without making the finance
    # threshold fire: 100 of 100000 is well under the lowest band.
    expectation(db, user_id=user_id, amount="100000")
    transaction(
        db,
        user_id=user_id,
        amount="100",
        identity=identity,
        occurred_at=recorded_at,
        recorded_at=recorded_at,
    )


def test_data_recorded_within_seven_days_is_not_stale(session_factory, account_factory):
    owner = account_factory("r3-fresh@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, recorded_at=utc(2026, 8, 15))
    assert _stale_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 20))) == []


@pytest.mark.parametrize(
    ("day", "materiality"),
    [
        (utc(2026, 8, 12), SignalMateriality.INFO),
        (utc(2026, 8, 5), SignalMateriality.MATERIAL),
    ],
)
def test_the_two_accepted_thresholds_set_materiality_not_a_new_state(
    session_factory, account_factory, day, materiality
):
    owner = account_factory(f"r3-tier-{day.day}@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, recorded_at=day)
    signals = _stale_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 20)))
    assert len(signals) == 1
    card = signals[0]
    assert card.materiality is materiality
    # Staleness is its own visual family; the tier rides on top of it as weight.
    assert card.state is SignalState.STALE
    assert card.stakes is False
    assert card.rendered_values["source_kind"] == "USER_REPORTED"
    # Seven days after the newest record is the day the source crossed over.
    assert card.rendered_values["since"] == (day.date().replace(day=day.day + 7)).isoformat()


def test_repeated_stale_days_never_open_a_second_episode(
    session_factory, account_factory
):
    owner = account_factory("r3-no-daily-respawn@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, recorded_at=utc(2026, 8, 5))

    first = _stale_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 13)))[0]
    keys = {first.episode_key}
    for day in (14, 15, 16, 20, 25):
        result = report(session_factory, owner.user_id, now=utc(2026, 8, day))
        signals = _stale_signals(result)
        assert len(signals) == 1, f"staleness fragmented into extra cards on 2026-08-{day}"
        keys.add(signals[0].episode_key)
    assert len(keys) == 1
    with session_factory() as db:
        assert len([row for row in episodes(db, user_id=owner.user_id)
                    if row.rule_id == data_stale.RULE_ID]) == 1


def test_a_dismissed_stale_card_stays_dismissed_while_the_source_stays_quiet(
    session_factory, account_factory
):
    owner = account_factory("r3-dismissed@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, recorded_at=utc(2026, 8, 5))
    first = _stale_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 13)))[0]
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=first.episode_key,
            observed_fingerprint=first.input_fingerprint,
        )
    for day in (14, 18, 22):
        result = report(session_factory, owner.user_id, now=utc(2026, 8, day))
        assert _stale_signals(result) == []
        held = [c for c in result.acknowledged if c.rule_id == data_stale.RULE_ID]
        assert len(held) == 1 and held[0].state is SignalState.RESOLVED


def test_a_fresh_record_withdraws_the_episode(session_factory, account_factory):
    owner = account_factory("r3-withdraw@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, recorded_at=utc(2026, 8, 5))
    stale = _stale_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 20)))[0]

    with session_factory.begin() as db:
        transaction(
            db,
            user_id=owner.user_id,
            amount="100",
            identity="fresh",
            occurred_at=utc(2026, 8, 19),
            recorded_at=utc(2026, 8, 19),
        )
    assert _stale_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 20))) == []
    with session_factory() as db:
        row = next(
            r for r in episodes(db, user_id=owner.user_id) if r.episode_key == stale.episode_key
        )
        assert row.resolution == SignalResolution.WITHDRAWN


def test_a_later_independent_stale_period_is_a_new_episode(
    session_factory, account_factory
):
    owner = account_factory("r3-second-period@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, recorded_at=utc(2026, 8, 1))
    first = _stale_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 12)))[0]

    # A fresh import ends the first period.
    with session_factory.begin() as db:
        transaction(
            db,
            user_id=owner.user_id,
            amount="100",
            identity="import",
            occurred_at=utc(2026, 8, 12),
            recorded_at=utc(2026, 8, 12),
        )
    assert _stale_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 13))) == []

    # The source then goes quiet again: a different `since`, a different episode.
    second = _stale_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 25)))[0]
    assert second.episode_key != first.episode_key
    assert second.acknowledged is False
    with session_factory() as db:
        keys = {row.episode_key for row in episodes(db, user_id=owner.user_id)}
        assert first.episode_key in keys and second.episode_key in keys


def test_the_quietest_source_speaks_for_the_subject(session_factory, account_factory):
    # One card per subject, not one per source kind: the card reports the source
    # that has been silent longest.
    owner = account_factory("r3-multi-source@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="100000")
        transaction(
            db,
            user_id=owner.user_id,
            amount="100",
            identity="imported",
            occurred_at=utc(2026, 8, 1),
            recorded_at=utc(2026, 8, 1),
            source_kind="IMPORTED",
        )
        transaction(
            db,
            user_id=owner.user_id,
            amount="100",
            identity="manual",
            occurred_at=utc(2026, 8, 11),
            recorded_at=utc(2026, 8, 11),
        )
    signals = _stale_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 20)))
    assert len(signals) == 1
    assert signals[0].rendered_values["source_kind"] == "IMPORTED"
    assert signals[0].rendered_values["days_stale"] == 19
    assert PERIOD in signals[0].subject_key
