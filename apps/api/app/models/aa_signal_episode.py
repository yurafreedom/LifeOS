"""Signal episode state — the one AA table that is state, not a fact.

Every other ``aa_*`` table is an append-only fact carrying the shared provenance
and supersession template. An episode is deliberately different: it records that
a **user-facing occurrence** exists and what the user did about it. It therefore
has no value, no provenance grammar and no supersession chain — the facts a
signal is derived from already carry all three, and duplicating them here would
invite a second, divergent copy of history.

Two identities live in this row and are never collapsed (plan §13, correction
C2):

``episode_key``
    Stable occurrence identity, defined by the rule's own semantics. It drives
    acknowledgement, dedup and reappearance. While it is unchanged the user's
    dismissal holds, however much the underlying inputs churn — a budget signal
    dismissed at 90 % does not respawn at 91 %, 92 %, 93 %.

``last_fingerprint`` / ``acknowledged_fingerprint``
    ``sha256`` over the exact input version ids one evaluation read. It drives
    audit, reproducibility and correction re-evaluation. It may change without
    the episode changing; the two columns differing is precisely the trigger for
    a rule's ``reopen_on``.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.analytics.enums import SignalResolution, check_in
from app.models.base import Base
from app.models.mixins import AAOwnedMixin, AASubjectMixin

FINGERPRINT_SQL = "~ '^[0-9a-f]{64}$'"


class AASignalEpisode(AAOwnedMixin, AASubjectMixin, Base):
    __tablename__ = "aa_signal_episodes"

    episode_key: Mapped[str] = mapped_column(Text, nullable=False)
    rule_id: Mapped[str] = mapped_column(Text, nullable=False)
    rule_version: Mapped[int] = mapped_column(Integer, nullable=False)

    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_fingerprint: Mapped[str] = mapped_column(Text, nullable=False)

    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    acknowledged_fingerprint: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)

    # A withdrawn episode whose condition holds again is the same key but a new
    # occurrence, so its acknowledgement is cleared. These two columns keep that
    # transition auditable instead of silently erasing the earlier dismissal.
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reopened_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    __table_args__ = (
        UniqueConstraint("user_id", "episode_key", name="uq_aa_signal_episodes_episode_key"),
        CheckConstraint(
            f"resolution IS NULL OR {check_in('resolution', SignalResolution)}",
            name="ck_aa_signal_episodes_resolution",
        ),
        # Acknowledgement is a pair: the instant and the fingerprint it was made
        # against. One without the other could not be re-evaluated.
        CheckConstraint(
            "(acknowledged_at IS NULL) = (acknowledged_fingerprint IS NULL)",
            name="ck_aa_signal_episodes_acknowledged_pair",
        ),
        CheckConstraint(
            "resolution <> 'acknowledged' OR acknowledged_at IS NOT NULL",
            name="ck_aa_signal_episodes_acknowledged_has_instant",
        ),
        CheckConstraint("rule_version >= 1", name="ck_aa_signal_episodes_rule_version"),
        CheckConstraint("reopened_count >= 0", name="ck_aa_signal_episodes_reopened_count"),
        CheckConstraint(
            "(reopened_at IS NULL) = (reopened_count = 0)",
            name="ck_aa_signal_episodes_reopened_pair",
        ),
        # The fingerprint contract is sha256 hex. Enforced in the database so a
        # direct write cannot substitute an opaque token for it.
        CheckConstraint(
            f"last_fingerprint {FINGERPRINT_SQL}",
            name="ck_aa_signal_episodes_last_fingerprint",
        ),
        CheckConstraint(
            f"acknowledged_fingerprint IS NULL OR acknowledged_fingerprint {FINGERPRINT_SQL}",
            name="ck_aa_signal_episodes_acknowledged_fingerprint",
        ),
        CheckConstraint("episode_key <> ''", name="ck_aa_signal_episodes_episode_key_present"),
        CheckConstraint(
            "last_evaluated_at >= first_seen_at", name="ck_aa_signal_episodes_evaluated_order"
        ),
        Index("ix_aa_signal_episodes_user_rule", "user_id", "rule_id"),
        Index("ix_aa_signal_episodes_user_subject", "user_id", "subject_key"),
        Index(
            "ix_aa_signal_episodes_user_active",
            "user_id",
            "last_evaluated_at",
            postgresql_where=text("resolution IS NULL"),
        ),
    )

    @property
    def is_acknowledged(self) -> bool:
        return self.resolution == SignalResolution.ACKNOWLEDGED

    @property
    def is_withdrawn(self) -> bool:
        return self.resolution == SignalResolution.WITHDRAWN


__all__ = ["AASignalEpisode"]
