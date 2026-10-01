"""JENKIN S1 checkpoint 4: private account access.

Synthetic identities only (@example.com); mail goes to the in-process
MemoryMailDelivery outbox — no test sends real mail.
"""

import json
import logging
import re
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text, update

from app.mail import DisabledMailDelivery
from app.main import create_app
from app.models import AccountInvitation, AuthAuditEvent, AuthToken, User, UserSession
from app.security.sessions import hash_session_token
from tests.aa_helpers import authenticate

PASSWORD = "correct-horse-battery"
NEW_PASSWORD = "a-brand-new-passphrase"
HEADER = "X-LifeOS-Account"
LINK = re.compile(r"/#/auth/(reset|verify|invite)/([A-Za-z0-9_-]+)")


def _link_token(message) -> tuple[str, str]:
    match = LINK.search(message.text)
    assert match, message.text
    return match.group(1), match.group(2)


def _login(client: TestClient, email: str, password: str = PASSWORD, **headers):
    return client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}, headers=headers or None
    )


def _events(session_factory, user_id=None) -> list[str]:
    with session_factory() as db:
        query = select(AuthAuditEvent.event).order_by(AuthAuditEvent.id)
        if user_id is not None:
            query = query.where(AuthAuditEvent.user_id == user_id)
        return list(db.scalars(query))


def _make_owner(session_factory, account) -> None:
    with session_factory.begin() as db:
        db.execute(update(User).where(User.id == account.user_id).values(role="owner"))


# ── bootstrap ──────────────────────────────────────────────────────────────


def test_bootstrap_account_is_the_owner(client, settings):
    response = client.post(
        "/api/v1/auth/bootstrap",
        json={
            "email": "owner@example.com",
            "password": PASSWORD,
            "bootstrap_token": settings.bootstrap_token.get_secret_value(),
        },
    )
    assert response.status_code == 201
    assert response.json()["role"] == "owner"
    assert response.json()["email_verified_at"] is None


# ── login throttling ───────────────────────────────────────────────────────


def test_login_throttles_an_address_identically_whether_or_not_it_exists(
    client, account_factory, session_factory
):
    account_factory("known@example.com")
    for email in ("known@example.com", "unknown@example.com"):
        statuses = [_login(client, email, "wrong-password").status_code for _ in range(5)]
        assert statuses == [401] * 5
        locked = _login(client, email, "wrong-password")
        assert locked.status_code == 429
        assert locked.json() == {"code": "too_many_attempts", "message": "Too many attempts. Try again later."}
        assert int(locked.headers["retry-after"]) > 0
    # Even the right password is refused while the address is locked.
    assert _login(client, "known@example.com").status_code == 429
    assert "login_throttled" in _events(session_factory)


def test_successful_login_clears_the_address_counter(client, account_factory):
    account_factory("steady@example.com")
    for _ in range(4):
        assert _login(client, "steady@example.com", "wrong").status_code == 401
    assert _login(client, "steady@example.com").status_code == 200
    for _ in range(4):
        assert _login(client, "steady@example.com", "wrong").status_code == 401
    assert _login(client, "steady@example.com").status_code == 200


def test_login_throttles_a_network_across_addresses(client):
    statuses = [
        _login(client, f"spray-{index}@example.com", "wrong").status_code for index in range(31)
    ]
    assert statuses[:30] == [401] * 30
    assert statuses[30] == 429


def test_login_records_a_session_device_label_and_audit(client, account_factory, session_factory):
    account = account_factory("device@example.com")
    response = _login(
        client, "device@example.com",
        **{"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit Chrome/131.0 Safari/537"},
    )
    assert response.status_code == 200
    with session_factory() as db:
        labels = set(db.scalars(select(UserSession.device_label).where(UserSession.user_id == account.user_id)))
        event = db.scalars(select(AuthAuditEvent).where(AuthAuditEvent.event == "login_succeeded")).one()
    assert "Chrome · macOS" in labels
    assert event.network == "127.0.0.0/24" or event.network is None or event.network.endswith("/24")
    assert event.device_label == "Chrome · macOS"


# ── password change ────────────────────────────────────────────────────────


def test_password_change_verifies_current_and_revokes_other_sessions(
    client, settings, account_factory, session_factory
):
    account = account_factory("change@example.com")
    with session_factory.begin() as db:
        db.add(UserSession(
            user_id=account.user_id, token_hash=hash_session_token("other-device-token"),
            last_seen_at=datetime.now(UTC), expires_at=datetime.now(UTC) + timedelta(days=1),
        ))
    authenticate(client, settings, account)

    wrong = client.post("/api/v1/account/password", json={"current_password": "nope", "new_password": NEW_PASSWORD})
    assert wrong.status_code == 400
    assert wrong.json()["code"] == "invalid_current_password"

    changed = client.post("/api/v1/account/password", json={"current_password": PASSWORD, "new_password": NEW_PASSWORD})
    assert changed.status_code == 200
    assert changed.json() == {"status": "changed", "revoked_sessions": 1}
    # This session survives; the other device does not.
    assert client.get("/api/v1/account/sessions").status_code == 200
    with session_factory() as db:
        hashes = set(db.scalars(select(UserSession.token_hash).where(UserSession.user_id == account.user_id)))
        user = db.get(User, account.user_id)
    assert hash_session_token("other-device-token") not in hashes
    assert user.password_changed_at is not None
    client.cookies.clear()
    assert _login(client, "change@example.com").status_code == 401
    assert _login(client, "change@example.com", NEW_PASSWORD).status_code == 200
    assert _events(session_factory, account.user_id)[:2] == ["password_change_failed", "password_changed"]


def test_password_change_requires_a_long_new_password(client, settings, account_factory):
    authenticate(client, settings, account_factory("short@example.com"))
    response = client.post("/api/v1/account/password", json={"current_password": PASSWORD, "new_password": "short"})
    assert response.status_code == 422


def test_password_change_current_password_guessing_is_throttled(client, settings, account_factory):
    authenticate(client, settings, account_factory("guess@example.com"))
    statuses = [
        client.post("/api/v1/account/password", json={"current_password": f"x{i}", "new_password": NEW_PASSWORD}).status_code
        for i in range(6)
    ]
    assert statuses == [400] * 5 + [429]


# ── password recovery ──────────────────────────────────────────────────────


def test_recovery_answers_identically_and_mails_only_existing_accounts(
    client, account_factory, mail, session_factory
):
    account_factory("recover@example.com")
    known = client.post("/api/v1/auth/password-reset/request", json={"email": "Recover@Example.com"})
    unknown = client.post("/api/v1/auth/password-reset/request", json={"email": "nobody@example.com"})
    assert (known.status_code, known.json()) == (202, {"status": "accepted"})
    assert (unknown.status_code, unknown.json()) == (202, {"status": "accepted"})
    assert [message.to for message in mail.outbox] == ["recover@example.com"]
    action, raw = _link_token(mail.outbox[0])
    assert action == "reset"
    with session_factory() as db:
        stored = db.scalars(select(AuthToken.token_hash)).all()
    assert raw not in stored
    assert hash_session_token(raw) in stored


def test_recovery_reports_unavailable_mail_for_every_address(settings, session_factory, account_factory):
    account_factory("nomail@example.com")
    app = create_app(settings=settings, session_factory=session_factory, mail=DisabledMailDelivery())
    with TestClient(app, headers={"Origin": "http://testserver"}) as client:
        for email in ("nomail@example.com", "ghost@example.com"):
            response = client.post("/api/v1/auth/password-reset/request", json={"email": email})
            assert response.status_code == 503
            assert response.json()["code"] == "mail_unavailable"
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AuthToken)) == 0


def test_reset_is_single_use_revokes_every_session_and_verifies_the_mailbox(
    client, settings, account_factory, mail, session_factory
):
    account = account_factory("reset@example.com")
    authenticate(client, settings, account)
    client.post("/api/v1/auth/password-reset/request", json={"email": "reset@example.com"})
    _action, raw = _link_token(mail.outbox[-1])

    confirmed = client.post(
        "/api/v1/auth/password-reset/confirm", json={"token": raw, "new_password": NEW_PASSWORD}
    )
    assert confirmed.status_code == 204
    replay = client.post(
        "/api/v1/auth/password-reset/confirm", json={"token": raw, "new_password": "yet-another-passphrase"}
    )
    assert replay.status_code == 400
    assert replay.json()["code"] == "invalid_or_expired_token"
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(UserSession).where(UserSession.user_id == account.user_id)) == 0
        assert db.get(User, account.user_id).email_verified_at is not None
    assert _login(client, "reset@example.com", NEW_PASSWORD).status_code == 200


def test_expired_and_superseded_reset_links_fail_the_same_way(
    client, account_factory, mail, session_factory
):
    account_factory("expire@example.com")
    client.post("/api/v1/auth/password-reset/request", json={"email": "expire@example.com"})
    _a, first = _link_token(mail.outbox[-1])
    client.post("/api/v1/auth/password-reset/request", json={"email": "expire@example.com"})
    _a, second = _link_token(mail.outbox[-1])
    with session_factory.begin() as db:
        db.execute(
            update(AuthToken)
            .where(AuthToken.token_hash == hash_session_token(second))
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
    for token in (first, second, "x" * 43):
        response = client.post(
            "/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": NEW_PASSWORD}
        )
        assert response.status_code == 400
        assert response.json() == {"code": "invalid_or_expired_token", "message": "This link is invalid or has expired."}


def test_recovery_requests_per_address_are_capped_silently(client, account_factory, mail):
    account_factory("flood@example.com")
    for _ in range(5):
        response = client.post("/api/v1/auth/password-reset/request", json={"email": "flood@example.com"})
        assert response.status_code == 202
    assert len(mail.outbox) == 3


def test_reset_delivery_failure_is_audited_without_changing_the_answer(
    client, account_factory, mail, session_factory
):
    account = account_factory("bounce@example.com")
    mail.fail_next = True
    response = client.post("/api/v1/auth/password-reset/request", json={"email": "bounce@example.com"})
    assert response.status_code == 202
    assert mail.outbox == []
    assert "password_reset_delivery_failed" in _events(session_factory, account.user_id)


# ── email verification ─────────────────────────────────────────────────────


def test_email_verification_is_sent_honestly_and_confirmed_once(
    client, settings, account_factory, mail, session_factory
):
    account = account_factory("verify@example.com")
    authenticate(client, settings, account)
    sent = client.post("/api/v1/account/email-verification", json={})
    assert sent.json() == {"status": "sent"}
    action, raw = _link_token(mail.outbox[-1])
    assert action == "verify"

    anonymous = TestClient(client.app, headers={"Origin": "http://testserver"})
    assert anonymous.post("/api/v1/auth/email-verification/confirm", json={"token": raw}).status_code == 204
    assert anonymous.post("/api/v1/auth/email-verification/confirm", json={"token": raw}).status_code == 400
    assert client.get("/api/v1/auth/me").json()["email_verified_at"] is not None
    again = client.post("/api/v1/account/email-verification", json={})
    assert again.status_code == 409
    assert again.json()["code"] == "already_verified"


def test_verification_link_for_an_old_address_is_void(
    client, settings, account_factory, mail, session_factory
):
    account = account_factory("old@example.com")
    authenticate(client, settings, account)
    client.post("/api/v1/account/email-verification", json={})
    _a, raw = _link_token(mail.outbox[-1])
    with session_factory.begin() as db:
        db.execute(update(User).where(User.id == account.user_id).values(email="new@example.com"))
    assert client.post("/api/v1/auth/email-verification/confirm", json={"token": raw}).status_code == 400


def test_verification_reports_failed_and_unavailable_delivery(
    client, settings, account_factory, mail, session_factory
):
    account = account_factory("undelivered@example.com")
    authenticate(client, settings, account)
    mail.fail_next = True
    failed = client.post("/api/v1/account/email-verification", json={})
    assert failed.status_code == 502
    assert failed.json()["code"] == "mail_delivery_failed"
    app = create_app(settings=settings, session_factory=session_factory, mail=DisabledMailDelivery())
    with TestClient(app, headers={"Origin": "http://testserver"}) as other:
        authenticate(other, settings, account)
        unavailable = other.post("/api/v1/account/email-verification", json={})
    assert unavailable.status_code == 503


# ── sessions ───────────────────────────────────────────────────────────────


def test_sessions_are_listed_and_revoked_with_ownership(
    client, settings, account_factory, session_factory
):
    owner = account_factory("sessions@example.com")
    stranger = account_factory("stranger@example.com")
    with session_factory.begin() as db:
        other = UserSession(
            user_id=owner.user_id, token_hash=hash_session_token("owner-phone"),
            last_seen_at=datetime.now(UTC), expires_at=datetime.now(UTC) + timedelta(days=1),
            device_label="Safari · iOS",
        )
        db.add(other)
        db.flush()
        other_id = other.id
        stranger_session_id = db.scalar(select(UserSession.id).where(UserSession.user_id == stranger.user_id))
    authenticate(client, settings, owner)

    listed = client.get("/api/v1/account/sessions").json()["sessions"]
    assert len(listed) == 2
    assert sum(1 for row in listed if row["current"]) == 1
    assert {row["device"] for row in listed} >= {"Safari · iOS"}
    assert "token_hash" not in json.dumps(listed)

    # Another account's session id is simply not found.
    assert client.delete(f"/api/v1/account/sessions/{stranger_session_id}").status_code == 404
    assert client.delete(f"/api/v1/account/sessions/{other_id}").status_code == 204
    assert len(client.get("/api/v1/account/sessions").json()["sessions"]) == 1
    with session_factory() as db:
        assert db.get(UserSession, stranger_session_id) is not None


def test_revoke_others_keeps_only_the_current_session(client, settings, account_factory, session_factory):
    owner = account_factory("others@example.com")
    with session_factory.begin() as db:
        for index in range(3):
            db.add(UserSession(
                user_id=owner.user_id, token_hash=hash_session_token(f"device-{index}"),
                last_seen_at=datetime.now(UTC), expires_at=datetime.now(UTC) + timedelta(days=1),
            ))
    authenticate(client, settings, owner)
    assert client.post("/api/v1/account/sessions/revoke-others", json={}).json() == {"revoked_sessions": 3}
    sessions = client.get("/api/v1/account/sessions").json()["sessions"]
    assert [row["current"] for row in sessions] == [True]


def test_revoking_the_current_session_signs_this_browser_out(client, settings, account_factory):
    owner = account_factory("self@example.com")
    authenticate(client, settings, owner)
    current = next(row for row in client.get("/api/v1/account/sessions").json()["sessions"] if row["current"])
    response = client.delete(f"/api/v1/account/sessions/{current['id']}")
    assert response.status_code == 204
    assert f'{settings.cookie_name}=""' in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert client.get("/api/v1/auth/me").status_code == 401


# ── invitations ────────────────────────────────────────────────────────────


def test_only_the_owner_may_invite(client, settings, account_factory):
    authenticate(client, settings, account_factory("member@example.com"))
    response = client.post("/api/v1/account/invitations", json={"email": "friend@example.com"})
    assert response.status_code == 403
    assert response.json()["code"] == "owner_required"
    assert client.get("/api/v1/account/invitations").status_code == 403


def test_invitation_is_mailed_email_bound_single_use_and_seven_days(
    client, settings, account_factory, mail, session_factory
):
    owner = account_factory("inviter@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    created = client.post("/api/v1/account/invitations", json={"email": "Friend@Example.com"})
    assert created.status_code == 201
    body = created.json()
    assert body["delivery"] == "sent" and body["invite_url"] is None and body["status"] == "pending"
    lifetime = datetime.fromisoformat(body["expires_at"]) - datetime.fromisoformat(body["created_at"])
    assert timedelta(days=6, hours=23) < lifetime <= timedelta(days=7, seconds=5)
    action, raw = _link_token(mail.outbox[-1])
    assert action == "invite" and mail.outbox[-1].to == "friend@example.com"

    invitee = TestClient(client.app, headers={"Origin": "http://testserver"})
    preview = invitee.post("/api/v1/auth/invitations/inspect", json={"token": raw})
    assert preview.json()["email"] == "friend@example.com"
    wrong = invitee.post("/api/v1/auth/invitations/accept", json={"token": raw, "email": "other@example.com", "password": NEW_PASSWORD})
    assert wrong.status_code == 400
    assert wrong.json()["code"] == "invitation_email_mismatch"
    accepted = invitee.post("/api/v1/auth/invitations/accept", json={"token": raw, "email": "friend@example.com", "password": NEW_PASSWORD})
    assert accepted.status_code == 201
    assert accepted.json()["role"] == "member"
    assert accepted.json()["email_verified_at"] is not None
    assert invitee.get("/api/v1/auth/me").json()["email"] == "friend@example.com"
    replay = TestClient(client.app, headers={"Origin": "http://testserver"}).post(
        "/api/v1/auth/invitations/accept", json={"token": raw, "email": "friend@example.com", "password": NEW_PASSWORD}
    )
    assert replay.status_code == 400
    statuses = [row["status"] for row in client.get("/api/v1/account/invitations").json()["invitations"]]
    assert statuses == ["accepted"]


def test_invitation_without_mail_is_honest_manual_delivery(settings, session_factory, account_factory):
    owner = account_factory("manual@example.com")
    _make_owner(session_factory, owner)
    app = create_app(settings=settings, session_factory=session_factory, mail=DisabledMailDelivery())
    with TestClient(app, headers={"Origin": "http://testserver"}) as client:
        authenticate(client, settings, owner)
        created = client.post("/api/v1/account/invitations", json={"email": "manual-friend@example.com"}).json()
    assert created["delivery"] == "manual"
    assert created["invite_url"].startswith("http://testserver/#/auth/invite/")
    with session_factory() as db:
        stored = db.scalar(select(AccountInvitation.token_hash))
    assert created["invite_url"].rsplit("/", 1)[1] not in stored


def test_failed_invitation_mail_is_reported_not_claimed(client, settings, account_factory, mail, session_factory):
    owner = account_factory("fail-invite@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    mail.fail_next = True
    created = client.post("/api/v1/account/invitations", json={"email": "bounced@example.com"}).json()
    assert created["delivery"] == "failed"
    assert created["invite_url"]


def test_revoked_expired_and_registered_invitations_are_refused(
    client, settings, account_factory, mail, session_factory
):
    owner = account_factory("gatekeeper@example.com")
    account_factory("taken@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    assert client.post("/api/v1/account/invitations", json={"email": "taken@example.com"}).status_code == 409

    revoked = client.post("/api/v1/account/invitations", json={"email": "revoked@example.com"}).json()
    _a, revoked_token = _link_token(mail.outbox[-1])
    assert client.delete(f"/api/v1/account/invitations/{revoked['id']}").status_code == 204
    client.post("/api/v1/account/invitations", json={"email": "late@example.com"})
    _a, late_token = _link_token(mail.outbox[-1])
    with session_factory.begin() as db:
        db.execute(update(AccountInvitation).where(func.lower(AccountInvitation.email) == "late@example.com")
                   .values(expires_at=datetime.now(UTC) - timedelta(minutes=1)))
    invitee = TestClient(client.app, headers={"Origin": "http://testserver"})
    for token, email in ((revoked_token, "revoked@example.com"), (late_token, "late@example.com")):
        response = invitee.post("/api/v1/auth/invitations/accept", json={"token": token, "email": email, "password": NEW_PASSWORD})
        assert response.status_code == 400
        assert response.json()["code"] == "invalid_or_expired_invitation"


def test_reinviting_supersedes_the_previous_open_invitation(client, settings, account_factory, mail, session_factory):
    owner = account_factory("again@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    client.post("/api/v1/account/invitations", json={"email": "twice@example.com"})
    _a, first = _link_token(mail.outbox[-1])
    client.post("/api/v1/account/invitations", json={"email": "twice@example.com"})
    invitee = TestClient(client.app, headers={"Origin": "http://testserver"})
    assert invitee.post("/api/v1/auth/invitations/inspect", json={"token": first}).status_code == 400


# ── cross-cutting: CSRF, binding, audit hygiene, export, erasure ──────────


MUTATING_ROUTES = [
    ("POST", "/api/v1/auth/password-reset/request", {"email": "a@example.com"}),
    ("POST", "/api/v1/auth/password-reset/confirm", {"token": "t" * 43, "new_password": NEW_PASSWORD}),
    ("POST", "/api/v1/auth/email-verification/confirm", {"token": "t" * 43}),
    ("POST", "/api/v1/auth/invitations/inspect", {"token": "t" * 43}),
    ("POST", "/api/v1/auth/invitations/accept", {"token": "t" * 43, "email": "a@example.com", "password": NEW_PASSWORD}),
    ("POST", "/api/v1/account/password", {"current_password": PASSWORD, "new_password": NEW_PASSWORD}),
    ("POST", "/api/v1/account/email-verification", {}),
    ("POST", "/api/v1/account/sessions/revoke-others", {}),
    ("POST", "/api/v1/account/invitations", {"email": "a@example.com"}),
]


@pytest.mark.parametrize(("method", "path", "body"), MUTATING_ROUTES)
def test_new_mutating_routes_refuse_cross_site_requests(app, settings, account_factory, method, path, body):
    account = account_factory("csrf@example.com")
    with TestClient(app, headers={"Origin": "https://evil.example"}) as hostile:
        authenticate(hostile, settings, account)
        response = hostile.request(method, path, json=body)
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden_origin"


@pytest.mark.parametrize("path", ["/api/v1/account/sessions", "/api/v1/account/invitations", "/api/v1/account/security-events"])
def test_account_security_reads_are_bound(client, settings, account_factory, path):
    first = account_factory("bound-a@example.com")
    second = account_factory("bound-b@example.com")
    authenticate(client, settings, second)
    client.headers[HEADER] = str(first.user_id)
    response = client.get(path)
    assert response.status_code == 409
    assert response.json()["code"] == "session_user_mismatch"


def test_audit_trail_and_logs_hold_no_secrets(
    client, settings, account_factory, mail, session_factory, caplog
):
    caplog.set_level(logging.DEBUG)
    owner = account_factory("audit@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    _login(client, "audit@example.com", "wrong-password-xyz")
    client.post("/api/v1/account/invitations", json={"email": "secret-friend@example.com"})
    _a, invite_token = _link_token(mail.outbox[-1])
    client.post("/api/v1/auth/password-reset/request", json={"email": "audit@example.com"})
    _a, reset_token = _link_token(mail.outbox[-1])
    client.post("/api/v1/auth/password-reset/confirm", json={"token": reset_token, "new_password": NEW_PASSWORD})

    with session_factory() as db:
        dump = json.dumps(
            [list(row) for row in db.execute(text("SELECT * FROM auth_audit_events")).all()], default=str
        )
    for secret in (invite_token, reset_token, PASSWORD, NEW_PASSWORD, "wrong-password-xyz", "secret-friend@example.com"):
        assert secret not in dump
        assert secret not in caplog.text
    assert {"login_failed", "invitation_created", "password_reset_requested", "password_reset_completed"} <= set(
        _events(session_factory, owner.user_id)
    )


def test_security_events_and_invitations_are_exported_without_digests(
    client, settings, account_factory, mail, session_factory
):
    import io
    import zipfile

    owner = account_factory("export-sec@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    client.post("/api/v1/account/invitations", json={"email": "exported-friend@example.com"})
    _login(client, "export-sec@example.com", "wrong")
    archive = zipfile.ZipFile(io.BytesIO(client.get("/api/v1/export").content))
    events = [json.loads(line) for line in archive.read("auth_audit_events.ndjson").splitlines()]
    invitations = [json.loads(line) for line in archive.read("account_invitations.ndjson").splitlines()]
    assert {event["event"] for event in events} >= {"invitation_created", "login_failed"}
    assert invitations[0]["email"] == "exported-friend@example.com"
    assert "token_hash" not in archive.read("account_invitations.ndjson").decode()
    account = json.loads(archive.read("account.ndjson"))
    assert account["role"] == "owner"


def test_account_erasure_removes_security_records_and_leaves_one_anonymous_event(
    client, settings, account_factory, mail, session_factory
):
    owner = account_factory("erase-sec@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    client.post("/api/v1/account/invitations", json={"email": "orphan@example.com"})
    client.post("/api/v1/account/email-verification", json={})
    assert client.request("DELETE", "/api/v1/account", json={"confirmation": "DELETE_ACCOUNT"}).status_code == 204
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AccountInvitation)) == 0
        assert db.scalar(select(func.count()).select_from(AuthToken)) == 0
        remaining = db.execute(select(AuthAuditEvent.event, AuthAuditEvent.user_id, AuthAuditEvent.network, AuthAuditEvent.device_label)).all()
    assert remaining == [("account_deleted", None, None, None)]


def test_security_events_list_is_the_accounts_own(client, settings, account_factory):
    first = account_factory("events-a@example.com")
    account_factory("events-b@example.com")
    _login(client, "events-b@example.com", "wrong")
    authenticate(client, settings, first)
    events = client.get("/api/v1/account/security-events").json()["events"]
    assert events == []


# ── S1 hardening: invitation authorization is not email verification ──────


def _accept(app, token: str, email: str):
    invitee = TestClient(app, headers={"Origin": "http://testserver"})
    return invitee, invitee.post(
        "/api/v1/auth/invitations/accept",
        json={"token": token, "email": email, "password": NEW_PASSWORD},
    )


def test_emailed_invitation_verifies_the_address(client, settings, account_factory, mail, session_factory):
    """Policy: a link handed only to the mail adapter for that address is a verification link."""
    owner = account_factory("policy-sent@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    assert client.post("/api/v1/account/invitations", json={"email": "sent-friend@example.com"}).json()["delivery"] == "sent"
    _a, token = _link_token(mail.outbox[-1])
    _invitee, accepted = _accept(client.app, token, "sent-friend@example.com")
    assert accepted.json()["email_verified_at"] is not None


def test_failed_delivery_invitation_creates_an_unverified_member_who_can_verify(
    client, settings, account_factory, mail, session_factory
):
    owner = account_factory("policy-failed@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    mail.fail_next = True
    created = client.post("/api/v1/account/invitations", json={"email": "failed-friend@example.com"}).json()
    assert created["delivery"] == "failed" and created["invite_url"]
    token = created["invite_url"].rsplit("/", 1)[1]
    invitee, accepted = _accept(client.app, token, "failed-friend@example.com")
    assert accepted.status_code == 201
    assert accepted.json()["email_verified_at"] is None
    # The independent verification flow works for this member.
    invitee.headers["X-LifeOS-Account"] = accepted.json()["id"]
    assert invitee.post("/api/v1/account/email-verification", json={}).json() == {"status": "sent"}
    _a, verify_token = _link_token(mail.outbox[-1])
    assert invitee.post("/api/v1/auth/email-verification/confirm", json={"token": verify_token}).status_code == 204
    assert invitee.get("/api/v1/auth/me").json()["email_verified_at"] is not None


def test_manual_invitation_creates_an_unverified_member(settings, session_factory, account_factory):
    owner = account_factory("policy-manual@example.com")
    _make_owner(session_factory, owner)
    app = create_app(settings=settings, session_factory=session_factory, mail=DisabledMailDelivery())
    with TestClient(app, headers={"Origin": "http://testserver"}) as client:
        authenticate(client, settings, owner)
        created = client.post("/api/v1/account/invitations", json={"email": "manual-member@example.com"}).json()
        assert created["delivery"] == "manual"
        invitee, accepted = _accept(app, created["invite_url"].rsplit("/", 1)[1], "manual-member@example.com")
        assert accepted.json()["email_verified_at"] is None
        # Without a mail backend the verification flow says so honestly; nothing is faked.
        invitee.headers["X-LifeOS-Account"] = accepted.json()["id"]
        refused = invitee.post("/api/v1/account/email-verification", json={})
    assert refused.status_code == 503 and refused.json()["code"] == "mail_unavailable"


def test_pending_delivery_invitation_creates_an_unverified_member(
    client, settings, account_factory, mail, session_factory
):
    """A crash between commit and send leaves 'pending': never treated as delivered."""
    owner = account_factory("policy-pending@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    client.post("/api/v1/account/invitations", json={"email": "pending-friend@example.com"})
    _a, token = _link_token(mail.outbox[-1])
    with session_factory.begin() as db:
        db.execute(update(AccountInvitation).values(delivery="pending"))
    _invitee, accepted = _accept(client.app, token, "pending-friend@example.com")
    assert accepted.json()["email_verified_at"] is None


def test_invitation_mail_is_sent_after_the_row_is_committed(client, settings, account_factory, mail, session_factory):
    """No transaction is held across delivery: the adapter sees a committed 'pending' row."""
    owner = account_factory("policy-commit@example.com")
    _make_owner(session_factory, owner)
    authenticate(client, settings, owner)
    seen: list[str] = []
    original = mail.send

    def observing_send(message):
        with session_factory() as db:  # an independent session
            seen.extend(db.scalars(select(AccountInvitation.delivery)))
        original(message)

    mail.send = observing_send
    assert client.post("/api/v1/account/invitations", json={"email": "commit-friend@example.com"}).json()["delivery"] == "sent"
    assert seen == ["pending"]
