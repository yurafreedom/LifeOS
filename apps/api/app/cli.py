"""Operator commands. Run from apps/api with the deployment's environment.

    python -m app.cli grant-owner <email>

Designates the owner explicitly. The M10 migration promotes a sole existing
user automatically; with several historical users it promotes no one, because
choosing among them would be a guess. Exactly one owner exists afterwards:
any previous owner becomes a member.
"""

import sys

from sqlalchemy import func, select, update

from app.config import get_settings
from app.db import create_engine_from_settings, create_session_factory
from app.models import User
from app.security.passwords import normalize_email


def grant_owner(email: str) -> int:
    factory = create_session_factory(create_engine_from_settings(get_settings()))
    canonical = normalize_email(email)
    with factory.begin() as db:
        user = db.scalar(select(User).where(func.lower(User.email) == canonical))
        if user is None:
            print("No account with that email.", file=sys.stderr)
            return 1
        db.execute(update(User).where(User.role == "owner", User.id != user.id).values(role="member"))
        user.role = "owner"
    print("Owner designated.")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) == 2 and argv[0] == "grant-owner":
        return grant_owner(argv[1])
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
