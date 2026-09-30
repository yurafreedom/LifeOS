"""Slice 5 · Project Analytics over the real, superseding write paths.

Forecasts are written through ``POST /api/v1/aa/forecasts`` so every revision
retires its predecessor as ``superseded`` / ``REVISION`` exactly as production
does; the completion Actual through ``POST /api/v1/aa/measurements``. Where a
test needs deterministic instants it pins the semantic write clock (the same
technique as the PR #14 suite), so supersession bookkeeping stays the
production code's own.

Canonical scenario (frozen G):

    Forecast 1: 20 Aug · Forecast 2: 24 Aug · Forecast 3: 26 Aug · Actual: 25 Aug
    versions 3, Actual separate, +5 days to the first, −1 day to the latest, both neutral
"""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select

from app.analytics.enums import FactStatus, SupersedeKind
from app.config import Settings
from app.main import create_app
from app.models import (
    AAForecastVersion,
    AAMeasurement,
    AAObservation,
    Base,
)
from app.services import aa_comparison
from app.services.aa_deletion import delete_fact
from app.services.export import EXPORT_TABLES
from tests.aa_helpers import authenticate

PROJECT = "project-1f3c"
METRIC = "project.completion_date"
URL = f"/api/v1/aa/projects/{PROJECT}/analytics"
DAY_MINUTES = Decimal(1440)


def utc(month: int, day: int, hour: int = 12) -> datetime:
    return datetime(2026, month, day, hour, tzinfo=UTC)


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


def _subject(project: str = PROJECT) -> dict[str, str]:
    return {"domain": "project", "type": "project", "id": project}


def post_forecast(client, completion: str, key: str, *, project: str = PROJECT) -> str:
    # The next Europe/Kyiv midnight after a summer date (EEST, +03:00).
    horizon = datetime.fromisoformat(f"{completion}T00:00:00+03:00") + timedelta(days=1)
    response = client.post(
        "/api/v1/aa/forecasts",
        json={
            "subject": _subject(project),
            "metric_key": METRIC,
            "value": {"type": "date", "date": completion},
            "horizon_at": horizon.isoformat(),
            "provenance": {
                "source_kind": "USER_REPORTED",
                "basis": "Прогноз завершения проекта пользователя",
                "method": "MANUAL_FORECAST",
            },
            "idempotency_key": key,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def post_actual(client, completion: str, key: str = "actual-1", *, project: str = PROJECT) -> str:
    response = client.post(
        "/api/v1/aa/measurements",
        json={
            "subject": _subject(project),
            "metric_key": METRIC,
            "value": {"type": "date", "date": completion},
            "occurred_at": f"{completion}T15:00:00+03:00",
            "occurred_tz": "Europe/Kyiv",
            "provenance": {
                "source_kind": "OBSERVED",
                "basis": "Фактическое завершение проекта",
                "method": "PROJECT_COMPLETION",
            },
            "idempotency_key": key,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def correct_actual(client, measurement_id: str, completion: str) -> str:
    response = client.post(
        f"/api/v1/aa/measurements/{measurement_id}/correct",
        json={
            "value": {"type": "date", "date": completion},
            "reason": "Дата завершения записана неверно",
            "provenance": {
                "source_kind": "USER_REPORTED",
                "basis": "Исправление даты",
                "method": "CORRECTION",
            },
            "idempotency_key": f"correct-{completion}",
        },
    )
    assert response.status_code in (200, 201), response.text
    return response.json()["measurement"]["id"]


def canonical_chain(client, clock) -> list[str]:
    ids = []
    for index, (completion, recorded_at) in enumerate(
        [("2026-08-20", utc(8, 12)), ("2026-08-24", utc(8, 15)), ("2026-08-26", utc(8, 20))]
    ):
        clock["at"] = recorded_at
        ids.append(post_forecast(client, completion, f"fv-canonical-{index}"))
    return ids


def read(client, **params):
    response = client.get(URL, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def dates(body) -> list[str]:
    return [row["value"]["date"] for row in body["forecast_versions"]]


def assert_neutral(delta):
    assert delta["desire"] == "neutral"
    assert delta["grounding_id"] is None
    assert delta["grounding_kind"] is None


# ───────────────────── T1 · canonical scenario, real write path ─────────────────────


def test_canonical_three_forecasts_and_a_separate_actual(
    client, settings, account_factory, session_factory, write_clock
):
    owner = account_factory("pa-canonical@example.com")
    authenticate(client, settings, owner)
    ids = canonical_chain(client, write_clock)
    actual_id = post_actual(client, "2026-08-25")

    with session_factory() as db:
        rows = [db.get(AAForecastVersion, identity) for identity in ids]
        assert [row.status for row in rows] == [
            FactStatus.SUPERSEDED,
            FactStatus.SUPERSEDED,
            FactStatus.ACTIVE,
        ]
        assert [row.supersede_kind for row in rows[:2]] == [SupersedeKind.REVISION] * 2

    body = read(client)
    assert body["state"] == "compared"
    assert body["subject_key"] == f"project:project:{PROJECT}"
    assert body["metric_key"] == METRIC
    assert body["forecast_version_count"] == 3
    assert body["forecast_versions_truncated"] is False
    assert body["withdrawn_forecast_count"] == 0
    assert dates(body) == ["2026-08-20", "2026-08-24", "2026-08-26"]
    assert [row["id"] for row in body["forecast_versions"]] == ids
    assert [row["status"] for row in body["forecast_versions"]] == [
        "superseded",
        "superseded",
        "active",
    ]
    assert {row["concept"] for row in body["forecast_versions"]} == {"forecast"}
    assert {row["provenance"]["source_kind"] for row in body["forecast_versions"]} == {
        "USER_REPORTED"
    }
    # The Actual is its own field and never one of the versions.
    assert actual_id not in [row["id"] for row in body["forecast_versions"]]
    assert body["actual"]["id"] == actual_id
    assert body["actual"]["value"]["date"] == "2026-08-25"
    assert body["actual"]["provenance"]["source_kind"] == "OBSERVED"
    assert body["actual_count"] == 1
    assert body["actual_corrections"] == []
    assert body["first_forecast"]["id"] == ids[0]
    assert body["latest_forecast"]["id"] == ids[2]

    first, latest = body["delta_vs_first"], body["delta_vs_latest"]
    assert first["reference_forecast_id"] == ids[0]
    assert latest["reference_forecast_id"] == ids[2]
    assert first["delta"]["state"] == latest["delta"]["state"] == "known"
    assert first["delta"]["type"] == latest["delta"]["type"] == "duration"
    assert first["delta"]["unit_code"] == "minute"
    assert Decimal(first["delta"]["num"]) == 5 * DAY_MINUTES
    assert Decimal(latest["delta"]["num"]) == -1 * DAY_MINUTES
    assert_neutral(first)
    assert_neutral(latest)
    assert body["observation_count"] == 0


# ───────────────────── T2 / T3 · nothing grounds desirability ─────────────────────


def test_an_expectation_on_the_same_project_never_grounds(
    client, settings, account_factory, write_clock
):
    owner = account_factory("pa-expectation@example.com")
    authenticate(client, settings, owner)
    canonical_chain(client, write_clock)
    post_actual(client, "2026-08-25")
    write_clock["at"] = utc(8, 21)
    response = client.post(
        "/api/v1/aa/expectations",
        json={
            "subject": _subject(),
            "metric_key": METRIC,
            "value": {"type": "date", "date": "2026-08-22"},
            "window_start": "2026-07-01",
            "window_end": "2026-08-31",
            "timezone": "Europe/Kyiv",
            "effective_from": utc(8, 21).isoformat(),
            "provenance": {"source_kind": "USER_REPORTED", "basis": "b", "method": "m"},
            "idempotency_key": "expectation-1",
        },
    )
    assert response.status_code == 201, response.text

    body = read(client)
    assert_neutral(body["delta_vs_first"])
    assert_neutral(body["delta_vs_latest"])
    assert body["forecast_version_count"] == 3


def test_a_project_target_is_not_given_invented_window_semantics(
    client, settings, account_factory, write_clock
):
    owner = account_factory("pa-target@example.com")
    authenticate(client, settings, owner)
    canonical_chain(client, write_clock)
    post_actual(client, "2026-08-25")
    write_clock["at"] = utc(8, 21)
    response = client.post(
        "/api/v1/aa/targets",
        json={
            "subject": _subject(),
            "metric_key": METRIC,
            "value": {"type": "date", "date": "2026-08-28"},
            "desired_direction": "lower",
            "window_start": "2026-07-01",
            "window_end": "2026-08-31",
            "timezone": "Europe/Kyiv",
            "provenance": {"source_kind": "USER_REPORTED", "basis": "b", "method": "m"},
            "idempotency_key": "target-1",
        },
    )
    assert response.status_code == 201, response.text

    body = read(client)
    # No accepted contract defines a Project Target window: the deltas stay neutral.
    assert_neutral(body["delta_vs_first"])
    assert_neutral(body["delta_vs_latest"])


# ───────────────────── T4 · as_of = versions recorded by T ─────────────────────


def test_as_of_lists_the_versions_recorded_by_then_including_superseded_ones(
    client, settings, account_factory, write_clock
):
    owner = account_factory("pa-asof@example.com")
    authenticate(client, settings, owner)
    ids = canonical_chain(client, write_clock)
    post_actual(client, "2026-08-25")

    # Between version 2 (15 Aug) and version 3 (20 Aug); version 1 is already
    # superseded at T but was recorded by T, so it still counts.
    body = read(client, as_of=utc(8, 17).isoformat())
    assert body["forecast_version_count"] == 2
    assert dates(body) == ["2026-08-20", "2026-08-24"]
    assert ids[2] not in [row["id"] for row in body["forecast_versions"]]
    assert body["latest_forecast"]["value"]["date"] == "2026-08-24"
    assert body["actual"] is None
    assert body["delta_vs_first"]["delta"] == {
        "state": "unknown",
        "type": None,
        "num": None,
        "unit_code": None,
        "scale_min": None,
        "scale_max": None,
        "reason": "operand_absent",
    }
    # 17 Aug is before the latest horizon (25 Aug, Kyiv midnight): too early, not missed.
    assert body["state"] == "too_early"
    assert body["evaluated_at"].startswith("2026-08-17")

    before_everything = read(client, as_of=utc(8, 1).isoformat())
    assert before_everything["state"] == "no_facts"
    assert before_everything["forecast_version_count"] == 0


def test_as_of_does_not_see_a_later_actual_correction(
    client, settings, account_factory, session_factory, write_clock
):
    owner = account_factory("pa-asof-correction@example.com")
    authenticate(client, settings, owner)
    canonical_chain(client, write_clock)
    original_id = post_actual(client, "2026-08-25")
    correct_actual(client, original_id, "2026-08-27")
    with session_factory() as db:
        original = db.get(AAMeasurement, original_id)
        known_at = original.recorded_at

    past = read(client, as_of=known_at.isoformat())
    assert past["actual"]["id"] == original_id
    assert past["actual"]["value"]["date"] == "2026-08-25"
    assert past["actual_corrections"] == []
    assert Decimal(past["delta_vs_latest"]["delta"]["num"]) == -1 * DAY_MINUTES

    current = read(client)
    assert current["actual"]["value"]["date"] == "2026-08-27"


# ───────────────────── T5 · a corrected Actual counts once ─────────────────────


def test_a_corrected_actual_is_used_once_with_its_lineage(
    client, settings, account_factory, write_clock
):
    owner = account_factory("pa-correction@example.com")
    authenticate(client, settings, owner)
    canonical_chain(client, write_clock)
    original_id = post_actual(client, "2026-08-24")
    corrected_id = correct_actual(client, original_id, "2026-08-25")

    body = read(client)
    assert body["actual"]["id"] == corrected_id
    assert body["actual"]["supersedes_id"] == original_id
    assert body["actual_count"] == 1
    assert [row["id"] for row in body["actual_corrections"]] == [original_id]
    assert body["actual_corrections"][0]["supersede_kind"] == "CORRECTION"
    assert body["actual_corrections"][0]["value"]["date"] == "2026-08-24"
    assert body["forecast_version_count"] == 3
    assert Decimal(body["delta_vs_first"]["delta"]["num"]) == 5 * DAY_MINUTES
    assert Decimal(body["delta_vs_latest"]["delta"]["num"]) == -1 * DAY_MINUTES


# ───────────────────── T6 · tombstones leave honest gaps ─────────────────────


@pytest.mark.parametrize(
    ("erased", "expected_dates", "first_date"),
    [
        (1, ["2026-08-20", "2026-08-26"], "2026-08-20"),
        (0, ["2026-08-24", "2026-08-26"], "2026-08-24"),
    ],
    ids=["middle", "first"],
)
def test_tombstoned_versions_leave_the_history(
    client,
    settings,
    account_factory,
    session_factory,
    write_clock,
    erased,
    expected_dates,
    first_date,
):
    owner = account_factory(f"pa-tomb-{erased}@example.com")
    authenticate(client, settings, owner)
    ids = canonical_chain(client, write_clock)
    post_actual(client, "2026-08-25")
    erased_value = ["2026-08-20", "2026-08-24", "2026-08-26"][erased]
    with session_factory() as db:
        delete_fact(
            db,
            user_id=owner.user_id,
            table_name="aa_forecast_versions",
            fact_id=ids[erased],
            mode="tombstone",
        )

    for body in (read(client), read(client, as_of=utc(8, 21).isoformat())):
        assert body["forecast_version_count"] == 2
        assert dates(body) == expected_dates
        assert body["withdrawn_forecast_count"] == 1
        assert body["first_forecast"]["value"]["date"] == first_date
        assert ids[erased] not in [row["id"] for row in body["forecast_versions"]]
    current = read(client)
    expected_first = (date(2026, 8, 25) - date.fromisoformat(first_date)).days
    assert Decimal(current["delta_vs_first"]["delta"]["num"]) == expected_first * DAY_MINUTES
    if erased == 0:
        # The erased first estimate never resurfaces, not even as a delta operand.
        assert erased_value not in dates(current)
        assert current["first_forecast"]["value"]["date"] != erased_value


# ───────────────────── T7 · same date again is a new version ─────────────────────


def test_a_same_date_reforecast_is_a_distinct_version(
    client, settings, account_factory, write_clock
):
    owner = account_factory("pa-same-date@example.com")
    authenticate(client, settings, owner)
    write_clock["at"] = utc(8, 12)
    first = post_forecast(client, "2026-08-24", "same-date-1")
    write_clock["at"] = utc(8, 14)
    second = post_forecast(client, "2026-08-24", "same-date-2")

    body = read(client)
    assert body["forecast_version_count"] == 2
    assert [row["id"] for row in body["forecast_versions"]] == [first, second]
    assert dates(body) == ["2026-08-24", "2026-08-24"]


# ───────────────────── T8 · missing is never zero, future is never missed ─────────────────────


def test_no_forecast_and_no_actual_is_an_empty_state(client, settings, account_factory):
    owner = account_factory("pa-empty@example.com")
    authenticate(client, settings, owner)
    body = read(client)
    assert body["state"] == "no_facts"
    assert body["forecast_versions"] == []
    assert body["forecast_version_count"] == 0
    assert body["first_forecast"] is None and body["latest_forecast"] is None
    assert body["actual"] is None
    assert body["delta_vs_first"]["delta"]["state"] == "unknown"
    assert body["delta_vs_first"]["reference_forecast_id"] is None


def test_a_future_horizon_without_an_actual_is_too_early(client, settings, account_factory):
    owner = account_factory("pa-future@example.com")
    authenticate(client, settings, owner)
    post_forecast(client, "2099-01-10", "future-1")
    body = read(client)
    assert body["state"] == "too_early"
    assert body["delta_vs_latest"]["delta"]["state"] == "unknown"
    assert body["delta_vs_latest"]["delta"]["reason"] == "operand_absent"


def test_a_passed_horizon_without_an_actual_is_not_a_miss(
    client, settings, account_factory, write_clock
):
    owner = account_factory("pa-passed@example.com")
    authenticate(client, settings, owner)
    write_clock["at"] = utc(8, 12)
    post_forecast(client, "2026-08-26", "passed-1")
    body = read(client)
    assert body["state"] == "actual_not_recorded"
    assert body["actual"] is None
    assert body["delta_vs_first"]["delta"]["state"] == "unknown"
    assert body["delta_vs_latest"]["delta"]["state"] == "unknown"


def test_an_actual_without_a_forecast_has_an_unknown_delta(client, settings, account_factory):
    owner = account_factory("pa-actual-only@example.com")
    authenticate(client, settings, owner)
    post_actual(client, "2026-08-25")
    body = read(client)
    assert body["state"] == "no_forecast"
    assert body["actual"]["value"]["date"] == "2026-08-25"
    for delta in (body["delta_vs_first"], body["delta_vs_latest"]):
        assert delta["delta"] == {
            "state": "unknown",
            "type": None,
            "num": None,
            "unit_code": None,
            "scale_min": None,
            "scale_max": None,
            "reason": "operand_absent",
        }
        assert delta["reference_forecast_id"] is None
        assert_neutral(delta)


def test_one_forecast_and_an_actual_share_first_and_latest(
    client, settings, account_factory, write_clock
):
    owner = account_factory("pa-single@example.com")
    authenticate(client, settings, owner)
    write_clock["at"] = utc(8, 12)
    only = post_forecast(client, "2026-08-26", "single-1")
    post_actual(client, "2026-08-25")
    body = read(client)
    assert body["forecast_version_count"] == 1
    assert body["first_forecast"]["id"] == body["latest_forecast"]["id"] == only
    assert body["delta_vs_first"] == body["delta_vs_latest"]
    assert Decimal(body["delta_vs_first"]["delta"]["num"]) == -1 * DAY_MINUTES


def test_real_observations_are_counted_and_none_are_invented(
    client, settings, account_factory, session_factory, write_clock
):
    owner = account_factory("pa-observation@example.com")
    authenticate(client, settings, owner)
    canonical_chain(client, write_clock)
    assert read(client)["observation_count"] == 0
    write_clock["at"] = utc(8, 21)
    response = client.post(
        "/api/v1/aa/observations",
        json={
            "subject": _subject(),
            "metric_key": None,
            "value": None,
            "declared_value_type": "categorical",
            "value_availability": "explicitly_unknown",
            "occurred_at": utc(8, 18).isoformat(),
            "occurred_tz": "Europe/Kyiv",
            "provenance": {"source_kind": "USER_REPORTED", "basis": "b", "method": "m"},
            "idempotency_key": "observation-1",
        },
    )
    assert response.status_code == 201, response.text
    assert read(client)["observation_count"] == 1
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AAObservation)) == 1


# ───────────────────── T9 · account isolation ─────────────────────


def test_the_same_project_id_in_another_account_never_leaks(
    client, settings, account_factory, write_clock
):
    owner = account_factory("pa-owner@example.com")
    other = account_factory("pa-other@example.com")
    authenticate(client, settings, owner)
    canonical_chain(client, write_clock)
    post_actual(client, "2026-08-25")

    authenticate(client, settings, other)
    foreign = client.get(URL)
    never_existed = client.get("/api/v1/aa/projects/project-never/analytics")
    assert foreign.status_code == never_existed.status_code == 200
    body = foreign.json()
    assert body["state"] == "no_facts"
    assert body["forecast_version_count"] == 0
    assert body["actual"] is None
    assert "2026-08-2" not in foreign.text
    # Identical apart from the subject key and the evaluation instant.
    trimmed = {
        key: value for key, value in body.items() if key not in ("subject_key", "evaluated_at")
    }
    other_trimmed = {
        key: value
        for key, value in never_existed.json().items()
        if key not in ("subject_key", "evaluated_at")
    }
    assert trimmed == other_trimmed

    # The other account's own forecast stays its own.
    write_clock["at"] = utc(8, 22)
    post_forecast(client, "2026-09-01", "other-forecast-1")
    authenticate(client, settings, owner)
    assert read(client)["forecast_version_count"] == 3


# ───────────────────── T10 · API security and side effects ─────────────────────


def test_the_read_requires_a_session(client):
    response = client.get(URL)
    assert response.status_code == 401


def test_invalid_subject_and_time_are_stable_400s(client, settings, account_factory):
    owner = account_factory("pa-invalid@example.com")
    authenticate(client, settings, owner)
    colon = client.get("/api/v1/aa/projects/a:b/analytics")
    assert colon.status_code == 400
    assert colon.json()["code"] == "invalid_subject"
    naive = client.get(URL, params={"as_of": "2026-08-17T12:00:00"})
    assert naive.status_code == 400
    assert naive.json()["code"] == "invalid_time"
    future = client.get(URL, params={"as_of": "2999-01-01T00:00:00+00:00"})
    assert future.status_code == 400
    assert future.json()["code"] == "invalid_time"


def test_reads_work_with_the_write_gate_closed_and_write_nothing(
    test_database_url, session_factory, account_factory
):
    gated = Settings(
        environment="test",
        database_url=test_database_url,
        bootstrap_token="test-bootstrap-token-that-is-at-least-32-chars",
        allowed_hosts=["testserver"],
        allowed_origins=["http://testserver"],
        cookie_secure=False,
    )
    assert gated.aa_write_enabled is False
    owner = account_factory("pa-gate@example.com")

    def aa_row_count() -> int:
        with session_factory() as db:
            return sum(
                db.scalar(select(func.count()).select_from(table)) or 0
                for name, table in Base.metadata.tables.items()
                if name.startswith("aa_") and name != "aa_metric_definitions"
            )

    before = aa_row_count()
    with TestClient(
        create_app(settings=gated, session_factory=session_factory),
        headers={"Origin": "http://testserver"},
    ) as gated_client:
        authenticate(gated_client, gated, owner)
        response = gated_client.get(URL)
        historic = gated_client.get(URL, params={"as_of": utc(8, 17).isoformat()})
    assert response.status_code == historic.status_code == 200
    assert response.json()["state"] == "no_facts"
    assert aa_row_count() == before


# ───────────────────── T11 · no schema expansion ─────────────────────


def test_no_project_table_no_migration_and_an_unchanged_export_registry(engine):
    assert not {"projects", "aa_projects"} & set(Base.metadata.tables)
    assert not {"projects", "aa_projects"} & set(inspect(engine).get_table_names())
    script = ScriptDirectory.from_config(Config("alembic.ini"))
    # Slice 5 added no migration: M5 is still reached from the head chain.
    assert script.get_revision("20260929_0007").down_revision == "20260928_0006"
    # M7 (Slice 7) sits on M6; still no project table anywhere in the chain.
    assert script.get_revision("20260930_0008").down_revision == "20260929_0007"
    assert script.get_heads() == ["20260930_0009"]
    assert not any("project" in name for name in EXPORT_TABLES)
    mapped_aa = {name for name in Base.metadata.tables if name.startswith("aa_")}
    assert mapped_aa <= set(EXPORT_TABLES) | {"aa_metric_definitions"}
