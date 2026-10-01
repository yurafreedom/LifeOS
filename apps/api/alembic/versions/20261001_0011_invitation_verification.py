"""M11: undo email verification that only an invitation link "proved" (JENKIN S1 hardening).

Before this revision, accepting *any* invitation set ``users.email_verified_at``.
An invitation delivered manually, exposed after a failed delivery, or never
confirmed as sent (``pending``) proves only that its holder was invited, not
that they control the mailbox.

Targeted, not indiscriminate: a verification is cleared only when **all** hold —
the account was created by accepting an invitation whose ``delivery`` is
``manual`` / ``failed`` / ``pending``, and ``email_verified_at`` still equals
that invitation's ``accepted_at`` (the timestamp the acceptance code wrote).
Verification obtained any other way (a verification link, a password reset —
both of which only ever set an empty value, so they differ from
``accepted_at``) and accounts invited by successfully sent mail are untouched.

Downgrade is a no-op: the cleared timestamps were not evidence of anything and
are not restored.
"""

from alembic import op

revision = "20261001_0011"
down_revision = "20261001_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users AS u
           SET email_verified_at = NULL
          FROM account_invitations AS i
         WHERE i.accepted_user_id = u.id
           AND i.delivery IN ('manual', 'failed', 'pending')
           AND u.email_verified_at IS NOT NULL
           AND u.email_verified_at = i.accepted_at
        """
    )


def downgrade() -> None:
    pass
