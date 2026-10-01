"""Account security records (JENKIN S1).

* ``auth_tokens`` — single-use, expiring password-reset and email-verification
  tokens. Only a SHA-256 digest of the token is stored; the raw token exists
  only in the delivered link.
* ``account_invitations`` — owner-issued, email-bound, single-use, expiring
  invitations (digest only, like tokens).
* ``auth_throttle`` — sliding-window failure counters for login, recovery and
  token guessing, keyed by a digest of the scope key (email or network); no
  plaintext email or IP is stored.
* ``auth_audit_events`` — security events (login, logout, reset, invitation,
  session revocation). Never passwords, tokens, financial or snapshot content.
  Erased with the account; retained ``AUDIT_RETENTION_DAYS`` otherwise.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CHAR,
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

TOKEN_PURPOSES = ("password_reset", "email_verification")


class AuthToken(Base):
    __tablename__ = "auth_tokens"
    __table_args__ = (
        CheckConstraint(
            "purpose IN ('password_reset', 'email_verification')", name="ck_auth_tokens_purpose"
        ),
        Index("ix_auth_tokens_user_purpose", "user_id", "purpose"),
        Index("ix_auth_tokens_expires_at", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    purpose: Mapped[str] = mapped_column(String(32), nullable=False)
    token_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False, unique=True)
    # The address the token was sent to: verification is void if the account's
    # email changed in between.
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AccountInvitation(Base):
    __tablename__ = "account_invitations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # 'sent' | 'manual' | 'failed': how the link reached the invitee, never the link.
    delivery: Mapped[str] = mapped_column(String(16), nullable=False)

    __table_args__ = (
        Index("ix_account_invitations_email_lower", func.lower(email)),
        Index("ix_account_invitations_invited_by", "invited_by"),
    )


class AuthThrottle(Base):
    __tablename__ = "auth_throttle"

    scope: Mapped[str] = mapped_column(String(32), primary_key=True)
    key_hash: Mapped[str] = mapped_column(CHAR(64), primary_key=True)
    failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    window_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthAuditEvent(Base):
    __tablename__ = "auth_audit_events"
    __table_args__ = (
        Index("ix_auth_audit_events_user_occurred", "user_id", "occurred_at"),
        Index("ix_auth_audit_events_occurred_at", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    event: Mapped[str] = mapped_column(String(48), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    # Coarse network (IPv4 /24, IPv6 /48) and device label; never the full address.
    network: Mapped[str | None] = mapped_column(String(64))
    device_label: Mapped[str | None] = mapped_column(String(80))
    details: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
