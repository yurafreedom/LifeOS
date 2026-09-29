"""Slice 7 · Saved System Review revisions (S7-14, 15, 49): append-only, frozen, deterministic."""

import threading

import pytest
from sqlalchemy import select

from app.models import AASystemReviewRevision
from tests.aa_helpers import authenticate
from tests.aa_system_review_helpers import (
    BASE,
    SEPTEMBER,
    correct,
    key,
    ok,
    review,
    save,
    sr_clock,  # noqa: F401  (fixture, applied module-wide)
    transaction,
)

pytestmark = pytest.mark.usefixtures("sr_clock")


def _setup(client, settings, account_factory, email="revisions@example.com"):
    owner = account_factory(email)
    authenticate(client, settings, owner)
    return owner, transaction(client, "t1", "1800.00")


def _frozen_total(body):
    item = next(i for i in body["frozen"]["sections"]["changed"]
                if i["kind"] == "finance_spend_vs_prior")
    return item["current"]["value"]["num"]


def test_save_draft_then_finalize_then_revise_appends(
    client, settings, account_factory, session_factory
):
    _setup(client, settings, account_factory)
    draft = ok(save(client, reflection="Месяц был плотный",
                    decisions=["Записывать крупные траты в тот же день"]), 201)
    assert (draft["revision"], draft["status"]) == (1, "draft")
    assert draft["finalized_at"] is None
    assert review(client)["status"] == "AVAILABLE"
    final = ok(save(client, base=1, finalize=True, no_conclusion=True), 201)
    assert (final["revision"], final["status"]) == (2, "finalized")
    assert final["reflection"] is None and final["no_conclusion"] is True
    assert review(client)["status"] == "FINALIZED"
    revised = ok(save(client, base=2, reflection="После исправления вывод другой",
                      adjustments=["Ставить лимит на кафе"]), 201)
    assert revised["revision"] == 3
    summary = review(client)["saved"]
    assert summary["finalized_revision"] == 2 and summary["has_newer_draft"] is True
    history = ok(client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions"), 200)["revisions"]
    assert [(r["revision"], r["status"]) for r in history] == [
        (1, "draft"), (2, "finalized"), (3, "draft")]
    first = ok(client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions/1"), 200)
    assert first["reflection"] == "Месяц был плотный"
    assert first["decisions"] == ["Записывать крупные траты в тот же день"]
    with session_factory() as db:
        rows = db.scalars(select(AASystemReviewRevision).order_by(
            AASystemReviewRevision.revision)).all()
        assert rows[1].previous_revision_id == rows[0].id
        assert rows[2].previous_revision_id == rows[1].id


def test_s7_14_saved_revision_keeps_what_it_saw_after_a_correction(
    client, settings, account_factory
):
    _, fact = _setup(client, settings, account_factory)
    ok(save(client, finalize=True, reflection="Дорогой месяц"), 201)
    correct(client, fact["id"], "180.00")
    saved = ok(client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions/1",
                          params={"compare": "true"}), 200)
    assert _frozen_total(saved) == "1800.000000"
    assert saved["live_sources_changed"] is True
    live = next(i for i in review(client)["sections"]["changed"]["items"]
                if i["kind"] == "finance_spend_vs_prior")
    assert live["current"]["value"]["num"] == "180.000000"
    # S7-15 · a revision after the correction appends; revision 1 is untouched.
    ok(save(client, base=1, finalize=True, reflection="После исправления — обычный месяц"), 201)
    assert _frozen_total(ok(client.get(
        f"{BASE}/system-reviews/{SEPTEMBER}/revisions/2"), 200)) == "180.000000"
    assert _frozen_total(ok(client.get(
        f"{BASE}/system-reviews/{SEPTEMBER}/revisions/1"), 200)) == "1800.000000"


def test_s7_49_concurrency_is_deterministic(client, settings, account_factory, app):
    _setup(client, settings, account_factory)
    ok(save(client), 201)
    stale = save(client, base=0)
    assert stale.status_code == 409
    assert stale.json() == {"code": "revision_conflict", "message": stale.json()["message"],
                            "current_revision": 1}
    from fastapi.testclient import TestClient

    results: list[int] = []
    cookies = dict(client.cookies)

    def attempt() -> None:
        with TestClient(app, headers={"Origin": "http://testserver"}) as other:
            other.cookies.update(cookies)
            results.append(save(other, base=1, reflection="параллельно").status_code)

    threads = [threading.Thread(target=attempt) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(results) == [201, 409, 409, 409]
    history = ok(client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions"), 200)["revisions"]
    assert [r["revision"] for r in history] == [1, 2]


def test_replay_validation_and_finalize_rules(client, settings, account_factory):
    _setup(client, settings, account_factory)
    request_key = key()
    assert save(client, idempotency_key=request_key).status_code == 201
    replay = save(client, idempotency_key=request_key)
    assert replay.status_code == 200 and replay.json()["replayed"] is True
    reused = save(client, "2026-08", idempotency_key=request_key)
    assert reused.status_code == 409 and reused.json()["code"] == "idempotency_key_reused"
    early = save(client, "2026-10", finalize=True)
    assert early.status_code == 422 and early.json()["code"] == "period_not_ended"
    both = save(client, base=1, no_conclusion=True, reflection="вывод")
    assert both.status_code == 422 and both.json()["code"] == "invalid_system_review"
    blank = save(client, base=1, decisions=["   "])
    assert blank.status_code == 422
    too_many = save(client, base=1, adjustments=[f"шаг {n}" for n in range(21)])
    assert too_many.status_code == 422
    assert client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions/9").status_code == 404
    # A draft is allowed while the period is still running; it never finalizes itself.
    running = ok(save(client, "2026-10", reflection="пока идёт"), 201)
    assert running["status"] == "draft"
    assert review(client, "2026-10")["status"] == "IN_PROGRESS"
