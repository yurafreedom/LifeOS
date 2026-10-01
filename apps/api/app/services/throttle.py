"""Throttling for authentication (JENKIN S1, hardened).

Database-backed, so every API worker and process shares the same counters.
Keys are SHA-256 digests (scope-prefixed) of a normalized email, an account id
or a client address — no plaintext address is stored. A key is throttled the
same way whether or not an account exists for it, so throttling never reveals
account existence.

**Atomic admission.** ``admit()`` is one ``INSERT … ON CONFLICT DO UPDATE …
RETURNING`` statement: it creates the counter row (first use) or updates the
existing row under PostgreSQL's row lock, and decides admission from the row
it wrote. Concurrent requests therefore serialise on the row and a limit of N
admits at most N attempts per window — the earlier read-then-count design let
every concurrent request pass the read. Callers commit the admission in its
own short transaction before doing slow work (password hashing, SMTP).

Two kinds of policy share the mechanism:

- **Request quotas** (``reset_*``, ``verify_send_user``, ``invite_user``):
  every admitted request consumes a slot; nothing is refunded.
- **Failure counters** (``login_*``, ``password_change_user``,
  ``token_network``): an attempt *reserves* a slot before the secret is
  checked (so concurrent guesses cannot exceed the limit) and a successful
  attempt gives it back (``release``) or clears the key (``clear``). Net
  effect: the counter holds failures plus attempts still in flight.

Policy (``POLICIES``): at most ``limit`` admissions per ``window``; the next
attempt locks the key for ``lock`` and is refused.
"""

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import case, delete, func, null, update
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
    def __init__(self, retry_after_seconds: int, *, newly_locked: bool = False) -> None:
        super().__init__("Too many attempts.")
        self.retry_after_seconds = max(1, retry_after_seconds)
        # True only for the refusal that started the lock (audit it once, not per attempt).
        self.newly_locked = newly_locked


def key_hash(scope: str, value: str) -> str:
    return hashlib.sha256(f"{scope}\x1f{value}".encode()).hexdigest()


def admit(db: Session, scope: str, value: str | None, *, now: datetime | None = None) -> int:
    """Atomically take one slot for ``value`` in ``scope``; raise ThrottledError if none is left.

    Returns the number of slots used in the current window (1 … limit). The
    caller decides the transaction boundary; commit it before slow work so the
    row lock is held only for this statement.
    """
    if not value:
        return 0
    policy = POLICIES[scope]
    current = now or datetime.now(UTC)
    table = AuthThrottle.__table__
    locked = table.c.locked_until > current
    expired = table.c.window_started_at < current - policy.window
    next_count = case((expired, 1), else_=table.c.failures + 1)
    over = next_count > policy.limit
    lock_until = current + policy.lock
    statement = (
        insert(table)
        .values(
            scope=scope, key_hash=key_hash(scope, value), failures=1,
            window_started_at=current, locked_until=None,
        )
        .on_conflict_do_update(
            index_elements=[table.c.scope, table.c.key_hash],
            set_={
                "failures": case((locked, table.c.failures), (over, table.c.failures), else_=next_count),
                "window_started_at": case(
                    (locked, table.c.window_started_at), (expired, current),
                    else_=table.c.window_started_at,
                ),
                "locked_until": case(
                    (locked, table.c.locked_until), (over, lock_until), else_=null()
                ),
            },
        )
        .returning(table.c.failures, table.c.locked_until)
    )
    used, locked_until = db.execute(statement).one()
    if locked_until is not None and locked_until > current:
        raise ThrottledError(
            int((locked_until - current).total_seconds()) + 1,
            newly_locked=locked_until == lock_until,
        )
    return used


def release(db: Session, scope: str, value: str | None) -> None:
    """Give back one reserved slot after a successful attempt (failure counters only)."""
    if not value:
        return
    table = AuthThrottle.__table__
    db.execute(
        update(table)
        .where(table.c.scope == scope, table.c.key_hash == key_hash(scope, value))
        .values(failures=func.greatest(table.c.failures - 1, 0))
    )


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
