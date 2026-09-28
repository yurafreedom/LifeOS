"""Episode persistence, the HTTP surface, ranking, and the truthful zero state.

These are the Slice 3 acceptance gates that are not about one rule's thresholds:
that dismissal is acknowledgement rather than deletion and survives a reload, that
Home never receives more than three cards, that absence of cards is never dressed
up as confidence, and that none of it leaks between accounts.
"""

import io
import json
import zipfile
from datetime import date

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.analytics.enums import (
    CoverageState,
    SignalMateriality,
    SignalResolution,
    SignalState,
    ZeroSignalState,
)
from app.analytics.rules import (
    coverage_partial,
    data_stale,
    finance_threshold,
    input_fingerprint,
    project_forecast_revision,
    signal_rules,
)
from app.models import AASignalEpisode
from app.services.aa_signals import HOME_SIGNAL_LIMIT, acknowledge_episode, evaluate_signals
from tests.aa_helpers import authenticate
from tests.aa_signal_helpers import (
    KYIV,
    PERIOD,
    coverage_claim,
    episodes,
    expectation,
    forecast,
    report,
    spend_at_percent,
    transaction,
    utc,
)

OBSERVED_AT = utc(2026, 8, 20)
BAND_80 = f"finance.monthly_spend.threshold:1:finance:period:{PERIOD}:band=80"


# ─────────────────────────── the catalogue ───────────────────────────


def test_the_catalogue_holds_exactly_the_four_accepted_rules() -> None:
    assert [rule.RULE_ID for rule in signal_rules()] == [
        "finance.monthly_spend.threshold",
        "project.forecast.revision",
        "data.source.stale",
        "coverage.window.partial",
    ]
    assert all(rule.RULE_VERSION == 1 for rule in signal_rules())


def test_no_rule_module_can_reach_the_desirability_derivation() -> None:
    """T-06. Materiality is not desirability, enforced at the source level."""
    import inspect as inspect_module

    for module in (finance_threshold, project_forecast_revision, data_stale, coverage_partial):
        source = inspect_module.getsource(module)
        assert "aa_desirability" not in source, f"{module.RULE_ID} reaches for desirability"
        assert "desirability(" not in source
        for forbidden in ("favorable", "unfavorable", "desired_direction"):
            assert f'"{forbidden}"' not in source, (
                f"{module.RULE_ID} expresses desirability as {forbidden}"
            )


def test_an_evaluation_that_tries_to_express_desirability_is_rejected() -> None:
    from app.analytics.rules import Evaluation

    with pytest.raises(ValueError, match="desirability"):
        Evaluation(
            materiality=SignalMateriality.MATERIAL,
            state=SignalState.MATERIAL,
            stakes=False,
            rendered_values={"desire": "unfavorable"},
            input_version_ids=("a",),
            discriminator="x=1",
        )


def test_resolved_is_episode_state_and_never_a_rule_verdict() -> None:
    from app.analytics.rules import Evaluation

    with pytest.raises(ValueError, match="resolved"):
        Evaluation(
            materiality=SignalMateriality.NORMAL,
            state=SignalState.RESOLVED,
            stakes=False,
            rendered_values={},
            input_version_ids=("a",),
            discriminator="x=1",
        )


def test_the_fingerprint_is_order_independent_sha256() -> None:
    assert input_fingerprint(("b", "a")) == input_fingerprint(("a", "b"))
    assert len(input_fingerprint(("a",))) == 64
    # Ids are newline-joined so two cannot concatenate into a third.
    assert input_fingerprint(("ab", "c")) != input_fingerprint(("a", "bc"))


# ─────────────────────────── all six states ───────────────────────────


def test_every_accepted_signal_state_is_representable_from_real_evaluation_data(
    session_factory, account_factory
):
    """Acceptance gate 1: normal · material · info · stale · partial · resolved."""
    owner = account_factory("states-all-six@example.com")
    with session_factory.begin() as db:
        # material + stakes — finance at 90 % of its own expectation.
        expectation(db, user_id=owner.user_id, amount="1000")
        spend_at_percent(db, user_id=owner.user_id, percent=90, identity="threshold")
        # normal — a genuine project forecast revision.
        forecast(
            db,
            user_id=owner.user_id,
            project_id="p-states",
            completion=date(2026, 9, 1),
            recorded_at=utc(2026, 8, 19),
        )
    # info + partial — nine covered days of an eleven-day elapsed window.
    with session_factory() as db:
        coverage_claim(
            db,
            user_id=owner.user_id,
            window_start=date(2026, 8, 1),
            window_end=date(2026, 8, 9),
        )

    result = report(session_factory, owner.user_id, now=utc(2026, 8, 11), limit=10)
    by_rule = {card.rule_id: card for card in result.signals}
    states = {card.state for card in result.signals}
    materialities = {card.materiality for card in result.signals}

    assert SignalState.MATERIAL in states, "finance threshold must render material"
    assert SignalState.NORMAL in states, "a forecast revision must render in the base state"
    assert SignalState.PARTIAL in states, "partial coverage must render partial"
    assert SignalMateriality.INFO in materialities, "the info tier must be reachable"
    assert by_rule[finance_threshold.RULE_ID].stakes is True
    assert by_rule[project_forecast_revision.RULE_ID].stakes is False

    # stale — a separate account whose source has gone quiet, so this account's
    # episode state is not evaluated against two different observation instants.
    quiet = account_factory("states-stale@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=quiet.user_id, amount="100000")
        transaction(
            db,
            user_id=quiet.user_id,
            amount="100",
            identity="long-ago",
            occurred_at=utc(2026, 8, 2),
            recorded_at=utc(2026, 8, 2),
        )
    stale = report(session_factory, quiet.user_id, now=utc(2026, 8, 20), limit=10)
    assert SignalState.STALE in {card.state for card in stale.signals}

    # resolved — an acknowledged episode whose condition still holds.
    target = by_rule[finance_threshold.RULE_ID]
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=target.episode_key,
            observed_fingerprint=target.input_fingerprint,
        )
    after = report(session_factory, owner.user_id, now=utc(2026, 8, 11), limit=10)
    resolved = [card for card in after.acknowledged if card.episode_key == target.episode_key]
    assert len(resolved) == 1
    assert resolved[0].state is SignalState.RESOLVED
    # An acknowledged card never keeps the warm accent.
    assert resolved[0].stakes is False


# ─────────────────────────── Home ceiling and ranking ───────────────────────────


def test_home_receives_at_most_three_signals_ranked_by_materiality(
    session_factory, account_factory
):
    owner = account_factory("home-ranking@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        spend_at_percent(db, user_id=owner.user_id, percent=130, identity="threshold")
        for index in range(4):
            forecast(
                db,
                user_id=owner.user_id,
                project_id=f"p-{index}",
                completion=date(2026, 9, 1),
                recorded_at=utc(2026, 8, 18),
            )
    with session_factory() as db:
        coverage_claim(
            db,
            user_id=owner.user_id,
            window_start=date(2026, 8, 1),
            window_end=date(2026, 8, 9),
        )

    result = report(session_factory, owner.user_id, now=utc(2026, 8, 11))
    assert result.limit == HOME_SIGNAL_LIMIT
    assert len(result.signals) == HOME_SIGNAL_LIMIT
    assert result.active_total > HOME_SIGNAL_LIMIT

    ranks = {
        SignalMateriality.MATERIAL: 2,
        SignalMateriality.INFO: 1,
        SignalMateriality.NORMAL: 0,
    }
    weights = [ranks[card.materiality] for card in result.signals]
    assert weights == sorted(weights, reverse=True)
    # The stakes card wins its materiality tier; it is not a numeric score.
    assert result.signals[0].rule_id == finance_threshold.RULE_ID
    assert result.signals[0].stakes is True

    # Ranking is deterministic: the same inputs produce the same order.
    again = report(session_factory, owner.user_id, now=utc(2026, 8, 11))
    assert [c.episode_key for c in again.signals] == [c.episode_key for c in result.signals]


# ─────────────────────────── truthful zero state ───────────────────────────


def test_an_account_with_no_analytics_history_reports_no_data(
    session_factory, account_factory
):
    owner = account_factory("zero-no-data@example.com")
    result = report(session_factory, owner.user_id)
    assert result.signals == ()
    assert result.zero_state is ZeroSignalState.NO_DATA
    assert result.coverage.subjects_evaluated == 0


def test_zero_signals_over_unvouched_data_never_claims_confidence(
    session_factory, account_factory
):
    """Acceptance gate 2. Absence of cards is not «всё в порядке»."""
    owner = account_factory("zero-unknown@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="100000")
        transaction(
            db,
            user_id=owner.user_id,
            amount="100",
            identity="quiet",
            occurred_at=utc(2026, 8, 19),
            recorded_at=utc(2026, 8, 19),
        )
    result = report(session_factory, owner.user_id, now=OBSERVED_AT)
    assert result.signals == ()
    assert result.zero_state is ZeroSignalState.UNKNOWN_COVERAGE
    assert result.coverage.subjects_with_unknown_coverage == 1


def test_zero_signals_backed_by_full_coverage_evidence_may_be_confident(
    session_factory, account_factory
):
    owner = account_factory("zero-confident@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="100000")
        transaction(
            db,
            user_id=owner.user_id,
            amount="100",
            identity="quiet",
            occurred_at=utc(2026, 8, 19),
            recorded_at=utc(2026, 8, 19),
        )
    with session_factory() as db:
        coverage_claim(
            db,
            user_id=owner.user_id,
            window_start=date(2026, 8, 1),
            window_end=date(2026, 8, 20),
        )
    result = report(session_factory, owner.user_id, now=OBSERVED_AT)
    assert result.signals == ()
    assert result.zero_state is ZeroSignalState.CONFIDENT
    assert result.coverage.subjects_with_unknown_coverage == 0


def test_a_project_alone_cannot_produce_a_confident_zero_state(
    session_factory, account_factory
):
    # A project's lifetime carries no coverage denominator, so nothing vouches for
    # the completeness of what was read.
    owner = account_factory("zero-project-only@example.com")
    with session_factory.begin() as db:
        forecast(
            db,
            user_id=owner.user_id,
            project_id="p-lonely",
            completion=date(2026, 9, 1),
            recorded_at=utc(2026, 8, 19),
        )
    result = report(session_factory, owner.user_id, now=OBSERVED_AT, limit=0)
    assert result.zero_state is ZeroSignalState.UNKNOWN_COVERAGE


# ─────────────────────────── persistence and reload ───────────────────────────


def test_dismissal_survives_a_reload_because_it_is_persisted_state(
    session_factory, account_factory
):
    owner = account_factory("ack-reload@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        spend_at_percent(db, user_id=owner.user_id, percent=90)
    card = report(session_factory, owner.user_id, now=OBSERVED_AT).signals[0]
    with session_factory() as db:
        acknowledge_episode(
            db,
            user_id=owner.user_id,
            episode_key=card.episode_key,
            observed_fingerprint=card.input_fingerprint,
        )
    # A reload is a fresh session and a fresh evaluation. Nothing is held in memory.
    for _ in range(3):
        reloaded = report(session_factory, owner.user_id, now=OBSERVED_AT)
        assert reloaded.signals == ()
        assert [c.episode_key for c in reloaded.acknowledged] == [card.episode_key]


def test_evaluation_writes_nothing_when_the_write_gate_is_closed(
    session_factory, account_factory
):
    owner = account_factory("gate-closed@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        spend_at_percent(db, user_id=owner.user_id, percent=90)
    with session_factory() as db:
        result = evaluate_signals(
            db, user_id=owner.user_id, now=OBSERVED_AT, timezone=KYIV, persist=False
        )
    assert len(result.signals) == 1
    assert result.persisted is False
    with session_factory() as db:
        assert episodes(db, user_id=owner.user_id) == []



def test_a_retrospective_evaluation_never_rewinds_the_evaluation_record(
    session_factory, account_factory
):
    """`as_of` exists for reproducibility, so reading the past must be safe.

    ``last_evaluated_at`` means «when this episode was last looked at», which only
    moves forward. Letting a retrospective read rewind it would both corrupt the
    record and violate the row's own ordering constraint.
    """
    owner = account_factory("retrospective@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        spend_at_percent(db, user_id=owner.user_id, percent=90)
    report(session_factory, owner.user_id, now=utc(2026, 9, 10))
    with session_factory() as db:
        forward = episodes(db, user_id=owner.user_id)[0].last_evaluated_at

    report(session_factory, owner.user_id, now=utc(2026, 8, 20))
    with session_factory() as db:
        row = episodes(db, user_id=owner.user_id)[0]
        assert row.last_evaluated_at == forward
        assert row.last_evaluated_at >= row.first_seen_at


def test_an_episode_row_carries_both_identities_separately(
    session_factory, account_factory
):
    owner = account_factory("two-identities@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        spend_at_percent(db, user_id=owner.user_id, percent=90)
    card = report(session_factory, owner.user_id, now=OBSERVED_AT).signals[0]
    with session_factory() as db:
        row = episodes(db, user_id=owner.user_id)[0]
        assert row.episode_key == card.episode_key
        assert row.last_fingerprint == card.input_fingerprint
        assert row.rule_id == finance_threshold.RULE_ID
        assert row.rule_version == 1
        assert row.subject_key == f"finance:period:{PERIOD}"
        assert row.resolution is None
        assert row.acknowledged_at is None and row.acknowledged_fingerprint is None
        # The episode key is not the fingerprint, and neither is derivable from
        # the other.
        assert row.episode_key != row.last_fingerprint


# ─────────────────────────── schema guards ───────────────────────────


def test_the_database_rejects_an_acknowledgement_without_its_fingerprint(
    engine, account_factory
):
    account = account_factory("episode-guard-pair@example.com")
    with engine.begin() as connection, pytest.raises(IntegrityError):
        connection.execute(
            text(
                "INSERT INTO aa_signal_episodes (id, user_id, subject_domain, subject_type,"
                " subject_id, episode_key, rule_id, rule_version, first_seen_at,"
                " last_evaluated_at, last_fingerprint, acknowledged_at, resolution)"
                " VALUES (gen_random_uuid(), :user_id, 'finance', 'period', '2026-08',"
                " 'guard:1:finance:period:2026-08:band=80', 'guard', 1, now(), now(),"
                f" '{'a' * 64}', now(), 'acknowledged')"
            ),
            {"user_id": account.user_id},
        )


def test_the_database_rejects_a_fingerprint_that_is_not_sha256_hex(
    engine, account_factory
):
    account = account_factory("episode-guard-hash@example.com")
    with engine.begin() as connection, pytest.raises(IntegrityError):
        connection.execute(
            text(
                "INSERT INTO aa_signal_episodes (id, user_id, subject_domain, subject_type,"
                " subject_id, episode_key, rule_id, rule_version, first_seen_at,"
                " last_evaluated_at, last_fingerprint)"
                " VALUES (gen_random_uuid(), :user_id, 'finance', 'period', '2026-08',"
                " 'guard:1:x:band=80', 'guard', 1, now(), now(), 'not-a-hash')"
            ),
            {"user_id": account.user_id},
        )


def test_one_episode_key_per_account(engine, account_factory):
    account = account_factory("episode-guard-unique@example.com")
    statement = text(
        "INSERT INTO aa_signal_episodes (id, user_id, subject_domain, subject_type,"
        " subject_id, episode_key, rule_id, rule_version, first_seen_at,"
        " last_evaluated_at, last_fingerprint)"
        " VALUES (gen_random_uuid(), :user_id, 'finance', 'period', '2026-08',"
        " 'guard:1:finance:period:2026-08:band=80', 'guard', 1, now(), now(),"
        f" '{'a' * 64}')"
    )
    with engine.begin() as connection:
        connection.execute(statement, {"user_id": account.user_id})
    with engine.begin() as connection, pytest.raises(IntegrityError):
        connection.execute(statement, {"user_id": account.user_id})


def test_the_resolution_constraint_admits_exactly_the_accepted_concepts(engine) -> None:
    from tests.test_aa_schema_guards import QUOTED, constraint_definition

    definition = constraint_definition(engine, "ck_aa_signal_episodes_resolution")
    assert set(QUOTED.findall(definition)) == {"acknowledged", "withdrawn"}


# ─────────────────────────── account isolation ───────────────────────────


def test_one_account_never_sees_or_acknowledges_another_accounts_episodes(
    session_factory, account_factory
):
    first = account_factory("isolation-a@example.com")
    second = account_factory("isolation-b@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=first.user_id, amount="1000")
        spend_at_percent(db, user_id=first.user_id, percent=90, identity="a-tx")
    card = report(session_factory, first.user_id, now=OBSERVED_AT).signals[0]

    other = report(session_factory, second.user_id, now=OBSERVED_AT)
    assert other.signals == ()
    assert other.zero_state is ZeroSignalState.NO_DATA

    from app.services.aa_signals import EpisodeNotFoundError

    with session_factory() as db, pytest.raises(EpisodeNotFoundError):
        acknowledge_episode(
            db,
            user_id=second.user_id,
            episode_key=card.episode_key,
            observed_fingerprint=card.input_fingerprint,
        )
    with session_factory() as db:
        assert episodes(db, user_id=second.user_id) == []
        assert episodes(db, user_id=first.user_id)[0].resolution is None


# ─────────────────────────── the HTTP surface ───────────────────────────


def _seed_over_http(client, session_factory, owner):
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        spend_at_percent(db, user_id=owner.user_id, percent=90)


def test_the_signals_endpoint_returns_ranked_bounded_cards(
    client, settings, account_factory, session_factory
):
    owner = account_factory("http-signals@example.com")
    authenticate(client, settings, owner)
    _seed_over_http(client, session_factory, owner)
    response = client.get(
        "/api/v1/aa/signals", params={"as_of": OBSERVED_AT.isoformat(), "timezone": KYIV}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["limit"] == HOME_SIGNAL_LIMIT
    assert len(body["signals"]) == 1
    card = body["signals"][0]
    assert card["rule_id"] == finance_threshold.RULE_ID
    assert card["state"] == "material"
    assert card["materiality"] == "material"
    assert card["stakes"] is True
    assert len(card["input_fingerprint"]) == 64
    # Values, never rendered copy: the client localizes from `rule_id` + values.
    assert card["rendered_values"]["band"] == 80
    assert "desire" not in card["rendered_values"]
    assert body["zero_state"] in {"confident", "unknown_coverage", "no_data"}
    assert body["persisted"] is True


def test_acknowledging_over_http_persists_and_replays(
    client, settings, account_factory, session_factory
):
    owner = account_factory("http-ack@example.com")
    authenticate(client, settings, owner)
    _seed_over_http(client, session_factory, owner)
    params = {"as_of": OBSERVED_AT.isoformat(), "timezone": KYIV}
    card = client.get("/api/v1/aa/signals", params=params).json()["signals"][0]

    path = f"/api/v1/aa/signal-episodes/{card['episode_key']}/ack"
    first = client.post(
        path,
        json={"resolution": "acknowledged", "input_fingerprint": card["input_fingerprint"]},
    )
    assert first.status_code == 200, first.text
    assert first.json()["resolution"] == "acknowledged"
    assert first.json()["replayed"] is False

    replay = client.post(
        path,
        json={"resolution": "acknowledged", "input_fingerprint": card["input_fingerprint"]},
    )
    assert replay.status_code == 200
    assert replay.json()["replayed"] is True

    after = client.get("/api/v1/aa/signals", params=params).json()
    assert after["signals"] == []
    assert after["acknowledged"][0]["state"] == "resolved"


def test_acknowledging_a_card_that_moved_underneath_is_a_conflict(
    client, settings, account_factory, session_factory
):
    owner = account_factory("http-ack-stale@example.com")
    authenticate(client, settings, owner)
    _seed_over_http(client, session_factory, owner)
    params = {"as_of": OBSERVED_AT.isoformat(), "timezone": KYIV}
    card = client.get("/api/v1/aa/signals", params=params).json()["signals"][0]
    with session_factory.begin() as db:
        transaction(db, user_id=owner.user_id, amount="10", identity="moved")
    client.get("/api/v1/aa/signals", params=params)

    response = client.post(
        f"/api/v1/aa/signal-episodes/{card['episode_key']}/ack",
        json={"resolution": "acknowledged", "input_fingerprint": card["input_fingerprint"]},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "episode_changed"


def test_an_unknown_episode_is_a_stable_not_found(
    client, settings, account_factory
):
    owner = account_factory("http-ack-missing@example.com")
    authenticate(client, settings, owner)
    response = client.post(
        "/api/v1/aa/signal-episodes/nope:1:finance:period:2026-08:band=80/ack",
        json={"resolution": "acknowledged", "input_fingerprint": "a" * 64},
    )
    assert response.status_code == 404
    assert response.json()["code"] == "episode_not_found"


def test_withdrawal_is_not_a_user_action(client, settings, account_factory):
    owner = account_factory("http-ack-withdraw@example.com")
    authenticate(client, settings, owner)
    response = client.post(
        "/api/v1/aa/signal-episodes/whatever:1:x:band=80/ack",
        json={"resolution": "withdrawn", "input_fingerprint": "a" * 64},
    )
    assert response.status_code == 422


def test_the_signals_read_requires_a_session(client):
    assert client.get("/api/v1/aa/signals").status_code == 401


def test_acknowledgement_requires_a_session_and_a_same_origin_json_write(
    client, settings, account_factory
):
    owner = account_factory("http-ack-origin@example.com")
    path = "/api/v1/aa/signal-episodes/x:1:y:band=80/ack"
    body = {"resolution": "acknowledged", "input_fingerprint": "a" * 64}
    assert client.post(path, json=body).status_code == 401
    authenticate(client, settings, owner)
    cross = client.post(path, json=body, headers={"Origin": "https://evil.example"})
    assert cross.status_code == 403
    plain = client.post(path, content=json.dumps(body), headers={"Content-Type": "text/plain"})
    assert plain.status_code == 415


def test_the_read_limit_is_bounded(client, settings, account_factory):
    owner = account_factory("http-limit@example.com")
    authenticate(client, settings, owner)
    assert client.get("/api/v1/aa/signals", params={"limit": 999}).status_code == 422
    assert client.get("/api/v1/aa/signals", params={"limit": 0}).status_code == 200


def test_an_as_of_without_an_offset_is_rejected(client, settings, account_factory):
    owner = account_factory("http-naive@example.com")
    authenticate(client, settings, owner)
    response = client.get("/api/v1/aa/signals", params={"as_of": "2026-08-20T12:00:00"})
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_time"


# ─────────────────────────── export and erasure ───────────────────────────


def test_signal_episodes_leave_with_an_account_export(
    client, settings, account_factory, session_factory
):
    owner = account_factory("export-episodes@example.com")
    other = account_factory("export-episodes-other@example.com")
    authenticate(client, settings, owner)
    _seed_over_http(client, session_factory, owner)
    with session_factory.begin() as db:
        expectation(db, user_id=other.user_id, amount="1000")
        spend_at_percent(db, user_id=other.user_id, percent=90, identity="other-tx")
    params = {"as_of": OBSERVED_AT.isoformat(), "timezone": KYIV}
    card = client.get("/api/v1/aa/signals", params=params).json()["signals"][0]
    client.post(
        f"/api/v1/aa/signal-episodes/{card['episode_key']}/ack",
        json={"resolution": "acknowledged", "input_fingerprint": card["input_fingerprint"]},
    )
    report(session_factory, other.user_id, now=OBSERVED_AT)

    response = client.get("/api/v1/export")
    assert response.status_code == 200, response.text
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        names = set(archive.namelist())
        assert "aa_signal_episodes.ndjson" in names
        rows = [
            json.loads(line)
            for line in archive.read("aa_signal_episodes.ndjson").decode().splitlines()
        ]
        manifest = json.loads(archive.read("manifest.json"))
    assert len(rows) == 1
    assert rows[0]["user_id"] == str(owner.user_id)
    assert rows[0]["episode_key"] == card["episode_key"]
    assert rows[0]["resolution"] == "acknowledged"
    assert rows[0]["acknowledged_fingerprint"] == card["input_fingerprint"]
    assert manifest["tables"]["aa_signal_episodes"]["rows"] == 1
    assert "episode_key" in {c["name"] for c in manifest["aa_columns"]["aa_signal_episodes"]}


def test_the_export_registry_still_matches_the_real_schema(engine) -> None:
    from sqlalchemy import inspect

    from app.services.export import EXPORT_TABLES, validate_export_registry

    validate_export_registry()
    assert "aa_signal_episodes" in EXPORT_TABLES
    assert set(EXPORT_TABLES) == {
        name for name in inspect(engine).get_table_names() if name.startswith("aa_")
    }


def test_deleting_an_account_cascades_its_signal_episodes(
    client, settings, account_factory, session_factory
):
    owner = account_factory("delete-episodes@example.com")
    other = account_factory("delete-episodes-other@example.com")
    for account, identity in ((owner, "mine"), (other, "theirs")):
        with session_factory.begin() as db:
            expectation(db, user_id=account.user_id, amount="1000")
            spend_at_percent(db, user_id=account.user_id, percent=90, identity=identity)
        report(session_factory, account.user_id, now=OBSERVED_AT)
    with session_factory() as db:
        assert len(episodes(db, user_id=owner.user_id)) == 1
        assert len(episodes(db, user_id=other.user_id)) == 1

    authenticate(client, settings, owner)
    deleted = client.request(
        "DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"}
    )
    assert deleted.status_code == 204, deleted.text
    with session_factory() as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(AASignalEpisode)
                .where(AASignalEpisode.user_id == owner.user_id)
            )
            == 0
        )
        assert len(episodes(db, user_id=other.user_id)) == 1


# ─────────────────────────── existing surfaces unaffected ───────────────────────────


def test_signal_evaluation_writes_no_measurement_and_no_semantic_fact(
    session_factory, account_factory
):
    """A signal is an interpretation. It never becomes a fact of its own."""
    from app.models import (
        AABaseline,
        AAExpectationVersion,
        AAForecastVersion,
        AAMeasurement,
        AAObservation,
        AAPreference,
        AATarget,
    )

    owner = account_factory("no-fact-writes@example.com")
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        spend_at_percent(db, user_id=owner.user_id, percent=130)
        forecast(
            db,
            user_id=owner.user_id,
            project_id="p-audit",
            completion=date(2026, 9, 1),
            recorded_at=utc(2026, 8, 18),
        )

    def counts(db):
        return {
            model.__tablename__: db.scalar(
                select(func.count()).select_from(model).where(model.user_id == owner.user_id)
            )
            for model in (
                AAMeasurement,
                AAExpectationVersion,
                AAForecastVersion,
                AABaseline,
                AATarget,
                AAPreference,
                AAObservation,
            )
        }

    with session_factory() as db:
        before = counts(db)
    report(session_factory, owner.user_id, now=OBSERVED_AT)
    report(session_factory, owner.user_id, now=OBSERVED_AT)
    with session_factory() as db:
        assert counts(db) == before
        assert len(episodes(db, user_id=owner.user_id)) == 2


def test_the_finance_surface_and_the_signal_agree_on_the_same_number(
    client, settings, account_factory, session_factory
):
    # Slice 2 remains authoritative: the rule reads the period through the same
    # derivation, so a card can never contradict the screen behind it.
    owner = account_factory("agreement@example.com")
    authenticate(client, settings, owner)
    with session_factory.begin() as db:
        expectation(db, user_id=owner.user_id, amount="1000")
        spend_at_percent(db, user_id=owner.user_id, percent=90)
    month = client.get(
        f"/api/v1/aa/finance/months/{PERIOD}", params={"timezone": KYIV}
    ).json()
    card = client.get(
        "/api/v1/aa/signals", params={"as_of": OBSERVED_AT.isoformat(), "timezone": KYIV}
    ).json()["signals"][0]
    assert card["rendered_values"]["spend"] == month["actual"]["num"]
    assert card["rendered_values"]["reference"] == month["current_expectation"]["value"]["num"]
    # The signal did not persist a monthly-spend measurement to say so.
    assert month["persisted"] is False


def test_coverage_state_enum_is_untouched_by_the_signal_slice() -> None:
    assert [state.value for state in CoverageState] == [
        "complete",
        "partial",
        "none",
        "unknown",
    ]
    assert SignalResolution.ACKNOWLEDGED != CoverageState.COMPLETE


# ─────────────────────────── the M4 migration ───────────────────────────


def test_m4_empty_roundtrip_preserves_every_earlier_table(engine, test_database_url):
    """Additive, and reversible only while nothing personal has been written.

    Once real acknowledgement history exists, the rollback path is the write gate
    and client behaviour — never this downgrade (correction C8).
    """
    from pathlib import Path

    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from sqlalchemy import inspect

    from alembic import command
    from tests.test_aa_m2_migration import protected_schema

    before = protected_schema(engine)
    earlier_aa = {
        name: [
            (c["name"], str(c["type"]), c["nullable"], c["default"])
            for c in inspect(engine).get_columns(name)
        ]
        for name in inspect(engine).get_table_names()
        if name.startswith("aa_") and name != "aa_signal_episodes"
    }
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM aa_signal_episodes")) == 0

    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", test_database_url)
    script = ScriptDirectory.from_config(config)
    # M4 is no longer the newest migration, so this asserts its position in the
    # chain rather than that it is head: it still sits directly on M3 and still
    # downgrades cleanly off it (taking any later migration with it).
    assert script.get_revision("20260928_0005").down_revision == "20260910_0004"

    command.downgrade(config, "20260910_0004")
    try:
        assert "aa_signal_episodes" not in inspect(engine).get_table_names()
        assert protected_schema(engine) == before
    finally:
        command.upgrade(config, "head")

    assert protected_schema(engine) == before
    for name, columns in earlier_aa.items():
        assert columns == [
            (c["name"], str(c["type"]), c["nullable"], c["default"])
            for c in inspect(engine).get_columns(name)
        ], f"M4 altered {name}"

    inspector = inspect(engine)
    assert set(AASignalEpisode.__table__.c.keys()) == {
        c["name"] for c in inspector.get_columns("aa_signal_episodes")
    }
    assert {
        constraint.name
        for constraint in AASignalEpisode.__table__.constraints
        if constraint.name and constraint.name.startswith("ck_")
    } == {check["name"] for check in inspector.get_check_constraints("aa_signal_episodes")}
    # The unique constraint is backed by an index, so the mapped indexes are a
    # subset of what the database reports rather than an exact match.
    installed = {index["name"] for index in inspector.get_indexes("aa_signal_episodes")}
    assert {index.name for index in AASignalEpisode.__table__.indexes} <= installed
    assert "uq_aa_signal_episodes_episode_key" in installed


def test_the_snapshot_contract_is_untouched_by_the_signal_slice(engine) -> None:
    with engine.begin() as connection:
        versions = set(
            connection.scalars(text("SELECT DISTINCT schema_version FROM user_snapshots"))
        )
        columns = {
            row[0]
            for row in connection.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'user_snapshots'"
                )
            )
        }
    assert versions <= {2}
    assert columns == {
        "user_id",
        "schema_version",
        "revision",
        "payload",
        "created_at",
        "updated_at",
    }
