"""S1 hardening: throttle admission under concurrency.

Every request below runs in its own thread with its own TestClient and its own
database session (the app's session factory), released together by a barrier,
so admission decisions genuinely race. A limit of N must admit at most N
attempts per window — for a brand-new key (first-row creation) and for an
existing counter — and the generic responses must not change.
"""

import threading
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import AuthThrottle
from app.services import throttle
from tests.aa_helpers import authenticate

PASSWORD = "correct-horse-battery"
WORKERS = 16


def _race(app, count: int, request) -> list:
    """Run `request(client, index)` `count` times at once; return the responses."""
    barrier = threading.Barrier(count)
    results: list = [None] * count

    def worker(index: int) -> None:
        with TestClient(app, headers={"Origin": "http://testserver"}) as client:
            barrier.wait()
            results[index] = request(client, index)

    threads = [threading.Thread(target=worker, args=(index,)) for index in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return results


def _login(email: str, password: str = "wrong-password"):
    def request(client, _index):
        return client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return request


def _statuses(responses) -> list[int]:
    return sorted(response.status_code for response in responses)


def test_concurrent_guesses_for_a_new_address_admit_at_most_the_limit(app):
    """First-row creation: no counter exists for this unknown address yet."""
    responses = _race(app, WORKERS, _login("nobody-yet@example.com"))
    statuses = _statuses(responses)
    assert statuses.count(401) == throttle.POLICIES["login_email"].limit
    assert statuses.count(429) == WORKERS - throttle.POLICIES["login_email"].limit
    # Generic bodies only: the same for every refused or failed attempt.
    assert {r.json()["code"] for r in responses} <= {"invalid_credentials", "too_many_attempts"}


def test_concurrent_guesses_for_a_known_address_with_an_existing_counter(app, account_factory, session_factory):
    account_factory("victim@example.com")
    now = datetime.now(UTC)
    with session_factory.begin() as db:
        db.add(AuthThrottle(
            scope="login_email", key_hash=throttle.key_hash("login_email", "victim@example.com"),
            failures=3, window_started_at=now - timedelta(minutes=1), locked_until=None,
        ))
    responses = _race(app, WORKERS, _login("victim@example.com"))
    statuses = _statuses(responses)
    assert statuses.count(401) == throttle.POLICIES["login_email"].limit - 3
    assert statuses.count(429) == WORKERS - (throttle.POLICIES["login_email"].limit - 3)
    with session_factory() as db:
        row = db.scalars(select(AuthThrottle).where(AuthThrottle.scope == "login_email")).one()
    assert row.locked_until is not None and row.locked_until > datetime.now(UTC)


def test_a_correct_password_is_not_penalised_by_its_own_reservation(app, account_factory):
    account_factory("legit@example.com")
    for _ in range(3):
        responses = _race(app, 2, _login("legit@example.com", PASSWORD))
        assert _statuses(responses) == [200, 200]


def test_concurrent_password_change_guesses_are_capped(app, settings, account_factory):
    account = account_factory("change-race@example.com")

    def request(client, index):
        authenticate(client, settings, account)
        return client.post(
            "/api/v1/account/password",
            json={"current_password": f"guess-{index}", "new_password": "a-brand-new-passphrase"},
        )

    statuses = _statuses(_race(app, WORKERS, request))
    limit = throttle.POLICIES["password_change_user"].limit
    assert statuses.count(400) == limit
    assert statuses.count(429) == WORKERS - limit


def test_concurrent_token_guessing_is_capped(app):
    def request(client, index):
        return client.post("/api/v1/auth/invitations/inspect", json={"token": f"guess-token-{index:04d}-padding"})

    statuses = _statuses(_race(app, 30, request))
    limit = throttle.POLICIES["token_network"].limit
    assert statuses.count(400) == limit
    assert statuses.count(429) == 30 - limit


def test_concurrent_recovery_requests_send_at_most_the_address_quota(app, account_factory, mail):
    account_factory("quota@example.com")

    def request(client, _index):
        return client.post("/api/v1/auth/password-reset/request", json={"email": "quota@example.com"})

    responses = _race(app, 8, request)
    # The address quota is silent: every answer stays the generic 202.
    assert _statuses(responses) == [202] * 8
    assert len(mail.outbox) == throttle.POLICIES["reset_email"].limit


def test_concurrent_recovery_from_one_network_is_capped(app, mail):
    def request(client, index):
        return client.post("/api/v1/auth/password-reset/request", json={"email": f"spray-{index}@example.com"})

    statuses = _statuses(_race(app, 16, request))
    limit = throttle.POLICIES["reset_network"].limit
    assert statuses.count(202) == limit
    assert statuses.count(429) == 16 - limit


def test_admission_is_atomic_with_independent_sessions(session_factory):
    """Service level: N sessions admit concurrently against one fresh key."""
    barrier = threading.Barrier(WORKERS)
    admitted: list[bool] = []
    lock = threading.Lock()

    def worker():
        db = session_factory()
        try:
            barrier.wait()
            try:
                throttle.admit(db, "login_email", "service-level@example.com")
                db.commit()
                outcome = True
            except throttle.ThrottledError:
                db.commit()
                outcome = False
        finally:
            db.close()
        with lock:
            admitted.append(outcome)

    threads = [threading.Thread(target=worker) for _ in range(WORKERS)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert admitted.count(True) == throttle.POLICIES["login_email"].limit


def test_refunds_and_window_reset(session_factory):
    policy = throttle.POLICIES["login_network"]
    start = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
    with session_factory() as db:
        for _ in range(policy.limit):
            throttle.admit(db, "login_network", "203.0.113.7", now=start)
        db.commit()
        # A successful attempt hands its slot back.
        throttle.release(db, "login_network", "203.0.113.7")
        db.commit()
        throttle.admit(db, "login_network", "203.0.113.7", now=start)
        db.commit()
        try:
            throttle.admit(db, "login_network", "203.0.113.7", now=start)
            raise AssertionError("expected the key to be throttled")
        except throttle.ThrottledError as error:
            assert error.retry_after_seconds > 0
        db.commit()
        # After the lock and the window have passed, a new window starts.
        later = start + policy.window + policy.lock + timedelta(seconds=1)
        throttle.admit(db, "login_network", "203.0.113.7", now=later)
        db.commit()
        row = db.get(AuthThrottle, ("login_network", throttle.key_hash("login_network", "203.0.113.7")))
        assert row.failures == 1 and row.locked_until is None
