"""R4 · partial coverage — evidence only, and never «0 из 31».

Correction C6 twice over. Coverage is read from explicit ``aa_source_coverage``
claims, so the presence of transactions proves nothing about it; and the *absence*
of claims is unknown coverage, not low coverage, because «0 % covered» would read
to the user as «you spent nothing».
"""

from datetime import date

from app.analytics.enums import (
    CoverageState,
    SignalMateriality,
    SignalResolution,
    SignalState,
    ZeroSignalState,
)
from app.analytics.rules import coverage_partial
from app.services.aa_signals import acknowledge_episode
from tests.aa_signal_helpers import (
    PERIOD,
    coverage_claim,
    episodes,
    expectation,
    report,
    transaction,
    utc,
)

AS_OF = utc(2026, 8, 20)
# 20 days of August have elapsed in Kyiv at noon UTC on the 20th.
ELAPSED = 20
WINDOW_KEY = f"coverage.window.partial:1:finance:period:{PERIOD}:window={PERIOD}"


def _coverage_signals(result):
    return [card for card in result.signals if card.rule_id == coverage_partial.RULE_ID]


def _discoverable(db, user_id):
    """Give the account a period to evaluate without tripping other rules."""
    expectation(db, user_id=user_id, amount="100000")
    transaction(
        db,
        user_id=user_id,
        amount="100",
        identity="anchor",
        occurred_at=utc(2026, 8, 19),
        recorded_at=utc(2026, 8, 19),
    )


def _claim(session_factory, user_id, *, last_day, state=CoverageState.COMPLETE):
    with session_factory() as db:
        coverage_claim(
            db,
            user_id=user_id,
            window_start=date(2026, 8, 1),
            window_end=date(2026, 8, last_day),
            coverage_state=state,
        )


def test_full_coverage_of_the_elapsed_window_is_not_a_signal(
    session_factory, account_factory
):
    owner = account_factory("r4-complete@example.com")
    with session_factory.begin() as db:
        _discoverable(db, owner.user_id)
    _claim(session_factory, owner.user_id, last_day=ELAPSED)
    result = report(session_factory, owner.user_id, now=AS_OF)
    assert _coverage_signals(result) == []
    # Future days are not a shortfall, and the zero state may now say so.
    assert result.zero_state is ZeroSignalState.CONFIDENT


def test_transactions_alone_never_establish_coverage(session_factory, account_factory):
    """C6. Facts are present on many days; no claim exists; coverage is unknown."""
    owner = account_factory("r4-facts-only@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="100000")
        for day in range(1, ELAPSED + 1):
            transaction(
                db,
                user_id=owner.user_id,
                amount="10",
                identity=f"day-{day}",
                occurred_at=utc(2026, 8, day, 9),
                recorded_at=utc(2026, 8, 19),
            )
    result = report(session_factory, owner.user_id, now=AS_OF)
    # Not a «0 % covered» card, and emphatically not a confident zero state.
    assert _coverage_signals(result) == []
    assert result.zero_state is ZeroSignalState.UNKNOWN_COVERAGE
    assert result.coverage.subjects_with_coverage_evidence == 0


def test_evidence_below_ninety_percent_is_informational(
    session_factory, account_factory
):
    owner = account_factory("r4-info@example.com")
    with session_factory.begin() as db:
        _discoverable(db, owner.user_id)
    # 17 of 20 elapsed days observed → 85 %.
    _claim(session_factory, owner.user_id, last_day=17)
    signals = _coverage_signals(report(session_factory, owner.user_id, now=AS_OF))
    assert len(signals) == 1
    card = signals[0]
    assert card.materiality is SignalMateriality.INFO
    assert card.state is SignalState.PARTIAL
    assert card.stakes is False
    assert card.episode_key == WINDOW_KEY
    assert card.rendered_values["observed"] == 17
    assert card.rendered_values["elapsed"] == ELAPSED
    assert card.rendered_values["expected_denominator"] == 31
    assert card.rendered_values["future_days"] == 11
    assert card.provenance["denominator_basis"] == "calendar_days"


def test_evidence_below_half_is_material_and_a_distinct_episode(
    session_factory, account_factory
):
    owner = account_factory("r4-material@example.com")
    with session_factory.begin() as db:
        _discoverable(db, owner.user_id)
    # 8 of 20 elapsed days observed → 40 %.
    _claim(session_factory, owner.user_id, last_day=8)
    signals = _coverage_signals(report(session_factory, owner.user_id, now=AS_OF))
    assert len(signals) == 1
    card = signals[0]
    assert card.materiality is SignalMateriality.MATERIAL
    assert card.state is SignalState.PARTIAL
    # The worse tier is its own occurrence, as the plan's worked example requires.
    assert card.episode_key == f"{WINDOW_KEY}:tier=material"


def test_another_uncovered_day_does_not_respawn_a_dismissed_card(
    session_factory, account_factory
):
    owner = account_factory("r4-no-daily-respawn@example.com")
    with session_factory.begin() as db:
        _discoverable(db, owner.user_id)
    _claim(session_factory, owner.user_id, last_day=17)
    first = _coverage_signals(report(session_factory, owner.user_id, now=AS_OF))[0]
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=first.episode_key,
            observed_fingerprint=first.input_fingerprint,
        )
    # Two more days elapse with no new evidence: the fraction worsens, the
    # occurrence does not change.
    later = report(session_factory, owner.user_id, now=utc(2026, 8, 22))
    assert _coverage_signals(later) == []
    held = [c for c in later.acknowledged if c.rule_id == coverage_partial.RULE_ID]
    assert len(held) == 1 and held[0].episode_key == first.episode_key


def test_crossing_into_the_worse_tier_reaches_the_user_again(
    session_factory, account_factory
):
    owner = account_factory("r4-worse-tier@example.com")
    with session_factory.begin() as db:
        _discoverable(db, owner.user_id)
    # 9 observed days: 82 % of an 11-day window, 47 % of a 19-day one.
    _claim(session_factory, owner.user_id, last_day=9)
    info = _coverage_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 11)))[0]
    assert info.materiality is SignalMateriality.INFO
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=info.episode_key,
            observed_fingerprint=info.input_fingerprint,
        )
    # Far enough into the month that 9 observed days is under half.
    worse = _coverage_signals(report(session_factory, owner.user_id, now=utc(2026, 8, 19)))
    assert len(worse) == 1
    assert worse[0].episode_key == f"{WINDOW_KEY}:tier=material"
    assert worse[0].acknowledged is False
    with session_factory() as db:
        rows = {row.episode_key: row for row in episodes(db, user_id=owner.user_id)}
        assert rows[info.episode_key].resolution == SignalResolution.WITHDRAWN
        assert rows[info.episode_key].acknowledged_at is not None


def test_a_claim_that_cannot_vouch_for_completeness_is_not_evidence_of_coverage(
    session_factory, account_factory
):
    owner = account_factory("r4-unknown-claim@example.com")
    with session_factory.begin() as db:
        _discoverable(db, owner.user_id)
    # `complete` the source cannot vouch for is not evidence of completeness: the
    # day resolves to unknown coverage, exactly as if no claim existed.
    with session_factory() as db:
        coverage_claim(
            db,
            user_id=owner.user_id,
            window_start=date(2026, 8, 1),
            window_end=date(2026, 8, ELAPSED),
            completeness_known=False,
        )
    result = report(session_factory, owner.user_id, now=AS_OF)
    assert _coverage_signals(result) == []
    assert result.zero_state is ZeroSignalState.UNKNOWN_COVERAGE


def test_a_source_affirming_nothing_happened_is_not_a_coverage_gap(
    session_factory, account_factory
):
    # `none` + `completeness_known` means «the source says nothing happened», which
    # is a measurement of absence, not an absence of measurement. It is still not
    # `observed`, so the window reads as under-covered — but never as unknown.
    owner = account_factory("r4-affirmed-none@example.com")
    with session_factory.begin() as db:
        _discoverable(db, owner.user_id)
    with session_factory() as db:
        coverage_claim(
            db,
            user_id=owner.user_id,
            window_start=date(2026, 8, 1),
            window_end=date(2026, 8, ELAPSED),
            coverage_state=CoverageState.NONE,
        )
    result = report(session_factory, owner.user_id, now=AS_OF)
    signals = _coverage_signals(result)
    assert len(signals) == 1
    assert signals[0].rendered_values["missing_days"] == ELAPSED
    assert signals[0].rendered_values["unknown_coverage_days"] == 0
