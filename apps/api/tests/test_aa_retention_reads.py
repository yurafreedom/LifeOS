"""Slice 8 · truthful retention read contracts (no deletion engine involved).

A completed run row is inserted directly, exactly as an Apply leaves it, so these
contracts are pinned independently of the deletion engine: R8-31/32/33/34/35/36/
37/38/39/41/42, and the backward-compatible "no Apply ever" shape.
"""

from datetime import UTC, date, datetime

from app.analytics.enums import CoverageState, SourceKind
from app.analytics.rules import signal_rules
from app.analytics.subjects import SubjectRef
from app.services.aa_coverage_claims import CoverageClaimRequest, record_coverage_claim
from app.services.aa_signals import evaluation_subjects
from tests.aa_helpers import authenticate
from tests.aa_retention_helpers import BASE, KYIV, completed_run, measurement, ok
from tests.aa_system_review_helpers import review, sr_clock  # noqa: F401

HORIZON = date(2024, 9, 1)


def _history(client, start: str, end: str) -> dict:
    return ok(client.get(f"{BASE}/metrics/finance.transaction_amount/history",
                         params={"from": start, "to": end}), 200)


def test_no_apply_ever_keeps_every_read_backward_compatible(
    client, settings, account_factory
):
    owner = account_factory("ret-read-none@example.com")
    authenticate(client, settings, owner)
    measurement(client, occurred_at="2024-03-10T09:00:00+00:00")
    history = _history(client, "2024-01-01T00:00:00+00:00", "2024-12-31T00:00:00+00:00")
    assert history["retention_horizon"] is None and history["retention_truncated"] is False
    month = ok(client.get(f"{BASE}/finance/months/2024-03"), 200)
    assert month["availability"] == "present"
    assert month["retention_truncated"] is False and month["retention_horizon"] is None
    assert month["coverage"]["retention_truncated_count"] == 0
    assert month["coverage"]["retention_horizon"] is None


def test_r8_36_37_history_discloses_the_horizon_and_empty_is_not_never(
    client, settings, account_factory, session_factory
):
    owner = account_factory("ret-read-history@example.com")
    authenticate(client, settings, owner)
    completed_run(session_factory, owner.user_id, HORIZON)
    before = _history(client, "2024-01-01T00:00:00+00:00", "2024-06-30T00:00:00+00:00")
    assert before["actual"] == []
    assert before["retention_truncated"] is True
    assert before["retention_horizon"] == "2024-09-01"
    # Local midnight in Kyiv is 21:00 UTC the previous day: a range starting at the
    # horizon instant is complete.
    after = _history(client, "2024-08-31T21:00:00+00:00", "2024-12-31T00:00:00+00:00")
    assert after["retention_truncated"] is False
    crossing = _history(client, "2024-08-31T20:59:59+00:00", "2024-12-31T00:00:00+00:00")
    assert crossing["retention_truncated"] is True


def test_r8_38_late_explicit_old_fact_is_accepted_shown_and_still_truncated(
    client, settings, account_factory, session_factory
):
    owner = account_factory("ret-read-late@example.com")
    authenticate(client, settings, owner)
    completed_run(session_factory, owner.user_id, HORIZON)
    late = measurement(client, occurred_at="2024-03-10T09:00:00+00:00")
    history = _history(client, "2024-03-01T00:00:00+00:00", "2024-03-31T00:00:00+00:00")
    assert [row["id"] for row in history["actual"]] == [late["id"]]
    assert history["retention_truncated"] is True


def test_r8_33_34_finance_old_month_is_retention_truncated_never_a_partial_sum(
    client, settings, account_factory, session_factory
):
    owner = account_factory("ret-read-finance@example.com")
    authenticate(client, settings, owner)
    completed_run(session_factory, owner.user_id, HORIZON)
    measurement(client, occurred_at="2024-03-10T09:00:00+00:00")
    measurement(client, occurred_at="2024-10-10T09:00:00+00:00")
    old = ok(client.get(f"{BASE}/finance/months/2024-03"), 200)
    assert old["availability"] == "retention_truncated"
    assert old["actual"] is None and old["known_subtotal"] is None
    assert old["delta"] == {"state": "unknown", "reason": "retention_truncated",
                            "type": None, "num": None, "unit_code": None,
                            "scale_min": None, "scale_max": None}
    assert old["desire"] == "unknown"
    assert old["retention_truncated"] is True and old["retention_horizon"] == "2024-09-01"
    # The horizon month itself and later months are whole.
    boundary = ok(client.get(f"{BASE}/finance/months/2024-09"), 200)
    assert boundary["availability"] == "no_data" and boundary["retention_truncated"] is False
    later = ok(client.get(f"{BASE}/finance/months/2024-10"), 200)
    assert later["availability"] == "present" and later["actual"]["num"] == "100.000000"


def test_r8_35_coverage_retention_truncated_is_its_own_bucket(
    client, settings, account_factory, session_factory
):
    owner = account_factory("ret-read-coverage@example.com")
    authenticate(client, settings, owner)
    with session_factory() as db:
        record_coverage_claim(db, user_id=owner.user_id, request=CoverageClaimRequest(
            source_id="bank", subject=SubjectRef("finance", "period", "2024-08"),
            window_start_date=date(2024, 8, 1), window_end_date=date(2024, 9, 30),
            timezone=KYIV, coverage_state=CoverageState.COMPLETE, completeness_known=True,
            source_kind=SourceKind.IMPORTED, idempotency_key="cov-straddle",
            original_recorded_at_known=False,
        ))
    before = ok(client.get(f"{BASE}/finance/months/2024-08"), 200)["coverage"]
    assert before["observed_count"] == 31 and before["retention_truncated_count"] == 0
    completed_run(session_factory, owner.user_id, HORIZON)
    after = ok(client.get(f"{BASE}/finance/months/2024-08"), 200)["coverage"]
    # A surviving straddling claim no longer vouches for erased days.
    assert after["retention_truncated_count"] == 31
    assert after["observed_count"] == after["unknown_coverage_count"] == 0
    assert after["reason"] == "retention_truncated"
    assert after["retention_horizon"] == "2024-09-01"
    straddle = ok(client.get(
        f"{BASE}/subjects/finance:period:2024-08/coverage",
        params={"from": "2024-08-01", "to": "2024-09-30", "timezone": KYIV},
    ), 200)
    # Only the post-horizon part of the straddling claim still counts.
    assert straddle["retention_truncated_count"] == 31 and straddle["observed_count"] == 30
    assert straddle["reason"] is None


def test_r8_31_32_project_history_deleted_is_not_no_facts_nor_the_page_cap(
    client, settings, account_factory, session_factory
):
    owner = account_factory("ret-read-project@example.com")
    authenticate(client, settings, owner)
    completed_run(session_factory, owner.user_id, HORIZON, pruned_projects=("p-old",))
    pruned = ok(client.get(f"{BASE}/projects/p-old/analytics"), 200)
    assert pruned["state"] == "history_deleted_by_retention"
    assert pruned["retention_history_deleted"] is True
    assert pruned["forecast_versions_truncated"] is False
    never = ok(client.get(f"{BASE}/projects/p-never/analytics"), 200)
    assert never["state"] == "no_facts" and never["retention_history_deleted"] is False


def test_r8_39_40_signal_discovery_is_clipped_at_the_horizon(
    client, settings, account_factory, session_factory
):
    owner = account_factory("ret-read-signals@example.com")
    authenticate(client, settings, owner)
    for day in ("2026-06-10", "2026-07-10", "2026-08-10", "2026-09-10"):
        measurement(client, occurred_at=f"{day}T09:00:00+00:00")
    now = datetime(2026, 9, 20, tzinfo=UTC)
    with session_factory() as db:
        before = [s.period for s in evaluation_subjects(db, user_id=owner.user_id, now=now)]
    assert before == ["2026-06", "2026-07", "2026-08", "2026-09"]
    # A horizon inside the discovery window (only reachable in tests; the engine's
    # 24-month minimum keeps it older) must remove the erased months from discovery.
    completed_run(session_factory, owner.user_id, date(2026, 8, 1))
    with session_factory() as db:
        after = [s.period for s in evaluation_subjects(db, user_id=owner.user_id, now=now)]
    assert after == ["2026-08", "2026-09"]
    assert len(signal_rules()) == 4


def test_r8_41_42_system_review_discloses_truncated_months(
    client, settings, account_factory, session_factory, sr_clock  # noqa: F811
):
    owner = account_factory("ret-read-sr@example.com")
    authenticate(client, settings, owner)
    measurement(client, occurred_at="2026-03-10T09:00:00+00:00")
    measurement(client, occurred_at="2026-09-10T09:00:00+00:00")
    untouched = review(client, "2026-03")
    assert untouched["retention"] == {"horizon": None, "truncated": False,
                                      "truncated_months": []}
    completed_run(session_factory, owner.user_id, date(2026, 6, 1))
    old = review(client, "2026-03")
    assert old["retention"]["truncated"] is True
    assert old["retention"]["truncated_months"] == ["2026-03"]
    for section in ("changed", "improved", "repeated", "tradeoffs"):
        assert old["sections"][section]["items"] == []
    assert old["sections"]["requires_confirmation"]["count"] == 0
    assert old["sections"]["consequences"]["expenses"] == []
    current = review(client, "2026-09")
    assert current["retention"]["truncated"] is False
    annual = review(client, "2026")
    assert annual["retention"]["truncated_months"] == [
        "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
    ]
    assert annual["retention"]["truncated"] is True
