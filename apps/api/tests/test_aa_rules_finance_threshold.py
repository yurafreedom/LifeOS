"""R1 · finance monthly spend threshold — the C2 correction, proved.

The acceptance case the plan calls T-11a/b/c lives here: a signal dismissed at
90 % must not respawn as ordinary transactions push it to 91, 92, 93 %, a genuine
band crossing must come back, and a correction that drops spend below the band
must withdraw the episode rather than leave a stale card.
"""

from decimal import Decimal

import pytest

from app.analytics.enums import SignalMateriality, SignalResolution, SignalState
from app.analytics.rules import finance_threshold, input_fingerprint
from app.models import AAMeasurement
from app.services.aa_signals import acknowledge_episode
from tests.aa_signal_helpers import (
    PERIOD,
    correct,
    episodes,
    expectation,
    report,
    spend_at_percent,
    transaction,
    utc,
)

BAND_80 = f"finance.monthly_spend.threshold:1:finance:period:{PERIOD}:band=80"
BAND_100 = f"finance.monthly_spend.threshold:1:finance:period:{PERIOD}:band=100"


def _finance_signals(result):
    return [card for card in result.signals if card.rule_id == finance_threshold.RULE_ID]


def _seed(db, user_id, percent, reference="1000"):
    expectation(db, user_id=user_id, amount=reference)
    spend_at_percent(db, user_id=user_id, percent=percent, reference=reference)


def test_spend_below_the_lowest_band_is_not_a_signal(
    session_factory, account_factory
):
    owner = account_factory("r1-below@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, 70)
    assert _finance_signals(report(session_factory, owner.user_id)) == []


def test_no_reference_means_nothing_to_cross(session_factory, account_factory):
    # Spend without an Expectation or a Target is not «100 % of nothing». There is
    # simply no reference, and inventing one would fabricate an Expectation.
    owner = account_factory("r1-no-reference@example.com")
    with session_factory.begin() as db:
        transaction(db, user_id=owner.user_id, amount="9999", identity="lonely")
    assert _finance_signals(report(session_factory, owner.user_id)) == []


@pytest.mark.parametrize(
    ("percent", "band"), [(85, 80), (90, 80), (104, 100), (130, 120)]
)
def test_the_highest_crossed_band_is_the_episode(
    session_factory, account_factory, percent, band
):
    owner = account_factory(f"r1-band-{percent}@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, percent)
    signals = _finance_signals(report(session_factory, owner.user_id))
    assert len(signals) == 1
    card = signals[0]
    assert card.episode_key.endswith(f"band={band}")
    assert card.rendered_values["band"] == band
    assert card.materiality is SignalMateriality.MATERIAL
    assert card.state is SignalState.MATERIAL
    # Budget at or past its reference is the accepted stakes trigger — the one
    # warm case in the signal design.
    assert card.stakes is True


def test_acknowledgement_survives_ordinary_churn_inside_the_same_band(
    session_factory, account_factory
):
    """T-11a. Dismissed at 90 %, still dismissed at 91, 92, 93 %."""
    owner = account_factory("r1-churn@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, 90)

    first = _finance_signals(report(session_factory, owner.user_id))[0]
    assert first.episode_key == BAND_80 and first.acknowledged is False
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=BAND_80,
            observed_fingerprint=first.input_fingerprint,
        )

    fingerprints = {first.input_fingerprint}
    for step, identity in enumerate(("churn-1", "churn-2", "churn-3"), start=1):
        with session_factory.begin() as db:
            transaction(db, user_id=owner.user_id, amount="10", identity=identity)
        result = report(session_factory, owner.user_id)
        assert _finance_signals(result) == [], (
            f"a dismissed band-80 signal respawned after {step} ordinary transaction(s)"
        )
        still = [c for c in result.acknowledged if c.rule_id == finance_threshold.RULE_ID]
        assert len(still) == 1
        assert still[0].episode_key == BAND_80
        assert still[0].acknowledged is True
        assert still[0].state is SignalState.RESOLVED
        fingerprints.add(still[0].input_fingerprint)

    # The fingerprint moved for audit; the episode and the dismissal did not.
    assert len(fingerprints) == 4
    with session_factory() as db:
        rows = episodes(db, user_id=owner.user_id)
        band = next(row for row in rows if row.episode_key == BAND_80)
        assert band.resolution == SignalResolution.ACKNOWLEDGED
        assert band.acknowledged_fingerprint == first.input_fingerprint
        assert band.last_fingerprint != band.acknowledged_fingerprint
        assert band.reopened_count == 0


def test_crossing_into_a_higher_band_is_a_new_unacknowledged_episode(
    session_factory, account_factory
):
    """T-11b. 100 % is a different occurrence, so the card comes back."""
    owner = account_factory("r1-new-band@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, 90)
    first = _finance_signals(report(session_factory, owner.user_id))[0]
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=BAND_80,
            observed_fingerprint=first.input_fingerprint,
        )
    assert _finance_signals(report(session_factory, owner.user_id)) == []

    with session_factory.begin() as db:
        transaction(db, user_id=owner.user_id, amount="150", identity="over")
    signals = _finance_signals(report(session_factory, owner.user_id))
    assert [card.episode_key for card in signals] == [BAND_100]
    assert signals[0].acknowledged is False

    with session_factory() as db:
        keys = {row.episode_key: row for row in episodes(db, user_id=owner.user_id)}
        # The earlier dismissal is retained: its band simply is not the current one.
        assert keys[BAND_80].resolution == SignalResolution.WITHDRAWN
        assert keys[BAND_80].acknowledged_at is not None
        assert keys[BAND_100].resolution is None


def test_a_correction_dropping_below_the_band_withdraws_the_episode(
    session_factory, account_factory
):
    """T-11c. The card disappears because the condition stopped holding."""
    owner = account_factory("r1-correction@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        original = transaction(db, user_id=owner.user_id, amount="900", identity="typo")
        original_id = original.id
    first = _finance_signals(report(session_factory, owner.user_id))[0]
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=BAND_80,
            observed_fingerprint=first.input_fingerprint,
        )

    with session_factory.begin() as db:
        correct(
            db,
            user_id=owner.user_id,
            original=db.get(AAMeasurement, original_id),
            amount="740",
            recorded_at=utc(2026, 8, 15),
        )

    result = report(session_factory, owner.user_id)
    assert _finance_signals(result) == []
    assert [c for c in result.acknowledged if c.rule_id == finance_threshold.RULE_ID] == []
    with session_factory() as db:
        band = next(
            row for row in episodes(db, user_id=owner.user_id) if row.episode_key == BAND_80
        )
        assert band.resolution == SignalResolution.WITHDRAWN
        # Acknowledgement history is not deleted because a card disappeared.
        assert band.acknowledged_at is not None
        assert band.acknowledged_fingerprint is not None


def test_re_entering_a_withdrawn_band_is_a_fresh_unacknowledged_occurrence(
    session_factory, account_factory
):
    owner = account_factory("r1-reenter@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        original = transaction(db, user_id=owner.user_id, amount="900", identity="typo")
        original_id = original.id
    first = _finance_signals(report(session_factory, owner.user_id))[0]
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=BAND_80,
            observed_fingerprint=first.input_fingerprint,
        )
    with session_factory.begin() as db:
        correct(
            db,
            user_id=owner.user_id,
            original=db.get(AAMeasurement, original_id),
            amount="740",
            recorded_at=utc(2026, 8, 15),
        )
    assert _finance_signals(report(session_factory, owner.user_id)) == []

    # Spend climbs back into the band from below: a new occurrence per the
    # accepted rule semantics, so the user is told again.
    with session_factory.begin() as db:
        transaction(db, user_id=owner.user_id, amount="120", identity="back-up")
    signals = _finance_signals(report(session_factory, owner.user_id))
    assert [card.episode_key for card in signals] == [BAND_80]
    assert signals[0].acknowledged is False
    with session_factory() as db:
        band = next(
            row for row in episodes(db, user_id=owner.user_id) if row.episode_key == BAND_80
        )
        assert band.resolution is None
        assert band.acknowledged_at is None
        assert band.reopened_count == 1
        assert band.reopened_at is not None


def test_unknown_membership_suppresses_the_comparison(
    session_factory, account_factory
):
    # A partly unknown aggregate is not compared as if it were complete: that
    # would report a ratio the data cannot support.
    owner = account_factory("r1-unknown@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        transaction(db, user_id=owner.user_id, amount="900", identity="known")
        row = transaction(db, user_id=owner.user_id, amount="50", identity="mystery")
        row.dimensions = None
    assert _finance_signals(report(session_factory, owner.user_id)) == []


def test_the_fingerprint_is_sha256_over_the_exact_input_versions(
    session_factory, account_factory
):
    owner = account_factory("r1-fingerprint@example.com")
    with session_factory.begin() as db:
        reference = expectation(db, user_id=owner.user_id, amount="1000")
        row = spend_at_percent(db, user_id=owner.user_id, percent=90)
        expected_ids = (str(row.id), str(reference.id))
    card = _finance_signals(report(session_factory, owner.user_id))[0]
    assert card.input_fingerprint == input_fingerprint(expected_ids)
    # Order must not matter: the contract sorts before hashing.
    assert input_fingerprint(reversed(expected_ids)) == card.input_fingerprint


def test_provenance_carries_the_accepted_four_items(session_factory, account_factory):
    owner = account_factory("r1-provenance@example.com")
    with session_factory.begin() as db:
        _seed(db, owner.user_id, 90)
    card = _finance_signals(report(session_factory, owner.user_id))[0]
    assert card.provenance["source_kinds"] == ["USER_REPORTED"]
    assert card.provenance["operation_count"] == 1
    assert card.provenance["newest_recorded_at"] is not None
    assert "SUM" in card.provenance["derivation"]
    assert card.rendered_values["unit_code"] == "UAH"
    assert Decimal(card.rendered_values["spend"]) == Decimal("900")
    # 20 August in Kyiv, so eleven days of the month have not happened yet. They
    # are never counted as a shortfall.
    assert card.rendered_values["days_remaining"] == 11
