"""Failure throttling for authentication (JENKIN S1).

Database-backed, so every API worker and process shares the same counters.
Keys are SHA-256 digests (scope-prefixed) of a normalized email, an account id
or a client address — no plaintext address is stored. A key is throttled the
same way whether or not an account exists for it, so throttling never reveals
account existence.

Policy (``POLICIES``): ``limit`` failures inside ``window`` lock the key for
``lock``. Successful login clears the email key (not the network key).
"""

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import AuthThrottle


@dataclass(frozen=True)
class Policy:
    limit: int
    window: timedelta
    lock: timedelta


POLICIES: dict[str, Policy] = {
    # Online password guessing against one address, and from one network.
    "login_email": Policy(5, timedelta(minutes=15), timedelta(minutes=15)),
    "login_network": Policy(30, timedelta(minutes=15), timedelta(minutes=15)),
    # Recovery mail: per address and per network (counts every request).
    "reset_email": Policy(3, timedelta(hours=1), timedelta(hours=1)),
    "reset_network": Policy(10, timedelta(hours=1), timedelta(hours=1)),
    # Token guessing (reset confirm, invitation inspect/accept, verification).
    "token_network": Policy(20, timedelta(minutes=15), timedelta(minutes=15)),
    # Current-password checks of a signed-in account.
    "password_change_user": Policy(5, timedelta(minutes=15), timedelta(minutes=15)),
    # Verification mail per account.
    "verify_send_user": Policy(3, timedelta(hours=1), timedelta(hours=1)),
    # Invitations per owner.
    "invite_user": Policy(20, timedelta(hours=24), timedelta(hours=1)),
}


class ThrottledError(Exception):
    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__("Too many attempts.")
        self.retry_after_seconds = max(1, retry_after_seconds)


def key_hash(scope: str, value: str) -> str:
    return hashlib.sha256(f"{scope}\x1f{value}".encode()).hexdigest()


def check(db: Session, scope: str, value: str | None, *, now: datetime | None = None) -> None:
    """Raise ThrottledError if ``value`` is currently locked in ``scope``."""
    if not value:
        return
    current = now or datetime.now(UTC)
    row = db.get(AuthThrottle, (scope, key_hash(scope, value)))
    if row is not None and row.locked_until is not None and row.locked_until > current:
        raise ThrottledError(int((row.locked_until - current).total_seconds()) + 1)


def register_failure(
    db: Session, scope: str, value: str | None, *, now: datetime | None = None
) -> bool:
    """Count one failure; return True when this failure locked the key."""
    if not value:
        return False
    policy = POLICIES[scope]
    current = now or datetime.now(UTC)
    digest = key_hash(scope, value)
    db.execute(
        insert(AuthThrottle)
        .values(scope=scope, key_hash=digest, failures=0, window_started_at=current)
        .on_conflict_do_nothing()
    )
    row = db.execute(
        select(AuthThrottle)
        .where(AuthThrottle.scope == scope, AuthThrottle.key_hash == digest)
        .with_for_update()
    ).scalar_one()
    if current - row.window_started_at > policy.window:
        row.failures = 0
        row.window_started_at = current
        row.locked_until = None
    row.failures += 1
    if row.failures >= policy.limit:
        row.locked_until = current + policy.lock
        return True
    return False


def clear(db: Session, scope: str, value: str | None) -> None:
    if not value:
        return
    db.execute(
        delete(AuthThrottle).where(
            AuthThrottle.scope == scope, AuthThrottle.key_hash == key_hash(scope, value)
        )
    )


def purge_stale(db: Session, *, now: datetime | None = None) -> int:
    current = now or datetime.now(UTC)
    longest = max(policy.window + policy.lock for policy in POLICIES.values())
    return db.execute(
        delete(AuthThrottle).where(AuthThrottle.window_started_at < current - longest)
    ).rowcount
