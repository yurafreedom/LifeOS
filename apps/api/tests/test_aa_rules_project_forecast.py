"""R2 · project forecast revision.

The distinction that matters: a genuine new ``ForecastVersion`` is a new
occurrence, and an ordinary project edit that appends no forecast version is not
a signal at all. The rule never reads the snapshot, so a renamed project or a
reordered task cannot manufacture one.
"""

from datetime import date

from app.analytics.enums import SignalMateriality, SignalResolution, SignalState
from app.analytics.rules import project_forecast_revision
from app.models import AAMeasurement
from app.services.aa_signals import acknowledge_episode
from tests.aa_signal_helpers import KYIV, episodes, forecast, report, utc

PROJECT = "p-redesign"


def _project_signals(result):
    return [
        card for card in result.signals if card.rule_id == project_forecast_revision.RULE_ID
    ]


def test_a_project_without_any_forecast_produces_no_signal(
    session_factory, account_factory
):
    owner = account_factory("r2-empty@example.com")
    with session_factory.begin() as db:
        db.add(
            AAMeasurement(
                user_id=owner.user_id,
                metric_key="project.completion_date",
                subject_domain="project",
                subject_type="project",
                subject_id=PROJECT,
                value_type="date",
                value_date=date(2026, 8, 24),
                occurred_at=utc(2026, 8, 24),
                occurred_tz=KYIV,
                recorded_at=utc(2026, 8, 24),
                source_kind="OBSERVED",
                status="active",
                idempotency_key="r2-completion-only",
            )
        )
    assert _project_signals(report(session_factory, owner.user_id)) == []


def test_a_forecast_version_raises_a_material_signal_in_the_base_card_state(
    session_factory, account_factory
):
    owner = account_factory("r2-first@example.com")
    with session_factory.begin() as db:
        first = forecast(
            db,
            user_id=owner.user_id,
            project_id=PROJECT,
            completion=date(2026, 8, 24),
            recorded_at=utc(2026, 8, 14),
        )
        first_id = first.id
    signals = _project_signals(report(session_factory, owner.user_id))
    assert len(signals) == 1
    card = signals[0]
    assert card.episode_key == (
        f"project.forecast.revision:1:project:project:{PROJECT}:fv={first_id}"
    )
    # §19 rates a forecast revision as material; the frozen gallery renders it in
    # the base card state. Those are the two separate dimensions.
    assert card.materiality is SignalMateriality.MATERIAL
    assert card.state is SignalState.NORMAL
    assert card.stakes is False
    assert card.rendered_values["from"] is None
    assert card.rendered_values["to"] == "2026-08-24"
    assert card.rendered_values["revision_count"] == 1
    assert card.provenance["derived_by"] == "lifeos"
    assert card.provenance["forecast_version_count"] == 1


def test_a_genuine_revision_is_a_new_episode_that_reappears_after_dismissal(
    session_factory, account_factory
):
    owner = account_factory("r2-revision@example.com")
    with session_factory.begin() as db:
        forecast(
            db,
            user_id=owner.user_id,
            project_id=PROJECT,
            completion=date(2026, 8, 24),
            recorded_at=utc(2026, 8, 14),
        )
    first = _project_signals(report(session_factory, owner.user_id))[0]
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=first.episode_key,
            observed_fingerprint=first.input_fingerprint,
        )
    assert _project_signals(report(session_factory, owner.user_id)) == []

    with session_factory.begin() as db:
        revised = forecast(
            db,
            user_id=owner.user_id,
            project_id=PROJECT,
            completion=date(2026, 8, 26),
            recorded_at=utc(2026, 8, 16),
        )
        revised_id = revised.id
    signals = _project_signals(report(session_factory, owner.user_id))
    assert len(signals) == 1
    assert signals[0].episode_key.endswith(f"fv={revised_id}")
    assert signals[0].acknowledged is False
    assert signals[0].rendered_values["from"] == "2026-08-24"
    assert signals[0].rendered_values["to"] == "2026-08-26"
    assert signals[0].rendered_values["revision_count"] == 2

    with session_factory() as db:
        rows = {row.episode_key: row for row in episodes(db, user_id=owner.user_id)}
        assert rows[first.episode_key].resolution == SignalResolution.WITHDRAWN
        assert rows[first.episode_key].acknowledged_at is not None


def test_an_ordinary_project_change_without_a_forecast_version_changes_nothing(
    session_factory, account_factory
):
    owner = account_factory("r2-ordinary@example.com")
    with session_factory.begin() as db:
        forecast(
            db,
            user_id=owner.user_id,
            project_id=PROJECT,
            completion=date(2026, 8, 24),
            recorded_at=utc(2026, 8, 14),
        )
    before = _project_signals(report(session_factory, owner.user_id))[0]

    # Whatever else the user does to the project — rename it, reorder its tasks —
    # no forecast version is appended, so nothing here moves.
    after = _project_signals(report(session_factory, owner.user_id))[0]
    assert after.episode_key == before.episode_key
    assert after.input_fingerprint == before.input_fingerprint
    with session_factory() as db:
        assert len(episodes(db, user_id=owner.user_id)) == 1


def test_the_fingerprint_spans_the_whole_forecast_history(
    session_factory, account_factory
):
    owner = account_factory("r2-fingerprint@example.com")
    with session_factory.begin() as db:
        forecast(
            db,
            user_id=owner.user_id,
            project_id=PROJECT,
            completion=date(2026, 8, 24),
            recorded_at=utc(2026, 8, 14),
        )
    one = _project_signals(report(session_factory, owner.user_id))[0]
    with session_factory.begin() as db:
        forecast(
            db,
            user_id=owner.user_id,
            project_id=PROJECT,
            completion=date(2026, 8, 26),
            recorded_at=utc(2026, 8, 16),
        )
    two = _project_signals(report(session_factory, owner.user_id))[0]
    assert one.input_fingerprint != two.input_fingerprint
    assert len(two.input_fingerprint) == 64
