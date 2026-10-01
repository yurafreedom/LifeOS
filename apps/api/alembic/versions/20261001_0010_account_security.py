"""M10: account security foundation (JENKIN S1).

* ``users.role`` ('owner' | 'member', default 'member'), ``email_verified_at``,
  ``password_changed_at``.
* ``sessions.device_label`` — coarse device description for the session list.
* ``auth_tokens`` — password-reset / email-verification token digests.
* ``account_invitations`` — owner-issued, email-bound, single-use invitations.
* ``auth_throttle`` — failure windows for login / recovery / token guessing.
* ``auth_audit_events`` — security events, erased with the account.

Ownership is assigned deterministically and never guessed: when the database
holds exactly one user, that user (the bootstrap account) becomes the owner.
With several historical users no one is promoted — an operator designates the
owner explicitly (``python -m app.cli grant-owner <email>``). With no users the
first bootstrap creates the owner.

Downgrade drops every new table and column. Use it only on disposable data:
it erases invitations, tokens and security history.
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "20261001_0010"
down_revision = "20260930_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(16), nullable=False, server_default=sa.text("'member'")),
    )
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("password_changed_at", sa.DateTime(timezone=True)))
    op.create_check_constraint("ck_users_role", "users", "role IN ('owner', 'member')")
    op.execute(
        "UPDATE users SET role = 'owner' "
        "WHERE (SELECT count(*) FROM users) = 1"
    )

    op.add_column("sessions", sa.Column("device_label", sa.String(80)))

    op.create_table(
        "auth_tokens",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("token_hash", sa.CHAR(64), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "purpose IN ('password_reset', 'email_verification')", name="ck_auth_tokens_purpose"
        ),
        sa.UniqueConstraint("token_hash", name="uq_auth_tokens_token_hash"),
    )
    op.create_index("ix_auth_tokens_user_purpose", "auth_tokens", ["user_id", "purpose"])
    op.create_index("ix_auth_tokens_expires_at", "auth_tokens", ["expires_at"])

    op.create_table(
        "account_invitations",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column(
            "invited_by",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.CHAR(64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column(
            "accepted_user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("delivery", sa.String(16), nullable=False),
        sa.UniqueConstraint("token_hash", name="uq_account_invitations_token_hash"),
    )
    op.create_index(
        "ix_account_invitations_email_lower", "account_invitations", [sa.text("lower(email)")]
    )
    op.create_index("ix_account_invitations_invited_by", "account_invitations", ["invited_by"])

    op.create_table(
        "auth_throttle",
        sa.Column("scope", sa.String(32), primary_key=True),
        sa.Column("key_hash", sa.CHAR(64), primary_key=True),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "auth_audit_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("event", sa.String(48), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("session_id", sa.UUID()),
        sa.Column("network", sa.String(64)),
        sa.Column("device_label", sa.String(80)),
        sa.Column("details", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index(
        "ix_auth_audit_events_user_occurred", "auth_audit_events", ["user_id", "occurred_at"]
    )
    op.create_index("ix_auth_audit_events_occurred_at", "auth_audit_events", ["occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_auth_audit_events_occurred_at", table_name="auth_audit_events")
    op.drop_index("ix_auth_audit_events_user_occurred", table_name="auth_audit_events")
    op.drop_table("auth_audit_events")
    op.drop_table("auth_throttle")
    op.drop_index("ix_account_invitations_invited_by", table_name="account_invitations")
    op.drop_index("ix_account_invitations_email_lower", table_name="account_invitations")
    op.drop_table("account_invitations")
    op.drop_index("ix_auth_tokens_expires_at", table_name="auth_tokens")
    op.drop_index("ix_auth_tokens_user_purpose", table_name="auth_tokens")
    op.drop_table("auth_tokens")
    op.drop_column("sessions", "device_label")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "role")
