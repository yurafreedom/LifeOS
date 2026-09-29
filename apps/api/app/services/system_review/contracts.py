"""Constants and small shared helpers for the System Review service."""

import hashlib
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.analytics.enums import RelationType
from app.services.system_review.errors import (
    CausalRelationForbiddenError,
    InvalidRelationError,
)

# Bounds. Every group and generator is bounded; truncation is always reported.
MAX_GROUP_ITEMS = 50
MAX_CANDIDATES = 30
MAX_EXPENSE_CONTEXTS = 200
MAX_OBSERVATIONS = 100
MAX_OBLIGATIONS = 10
MAX_CROSS_DOMAIN_PAIRS = 10
OBSERVATION_WINDOW_DAYS = 3
REQUIRES_CONFIRMATION_HORIZON_MONTHS = 3
REVIEW_AVAILABLE_MONTHS = 12
LIST_LIMIT_DEFAULT = 50
LIST_LIMIT_MAX = 200
MAX_LIST_ENTRIES = 20
MAX_ENTRY_CHARS = 500
MAX_REFLECTION_CHARS = 4000
MAX_NOTE_CHARS = 1000

# Candidate provenance. ``source='ai'`` stays reserved until a provider and
# privacy contract are accepted; v1 proposals come only from these rules.
PROPOSAL_MODEL = "lifeos_rules"
RULE_VERSION = 1
MANIFEST_VERSION = 1
DEFAULT_TIMEZONE = "Europe/Kyiv"

# Causal vocabulary is refused before the allow-list is consulted, so a causal
# claim is named as such instead of looking like a typo.
CAUSAL_DENYLIST: frozenset[str] = frozenset(
    {
        "cause", "causes", "caused", "caused_by", "definitely_caused_by", "leads_to",
        "led_to", "results_in", "resulted_in", "because", "because_of", "due_to", "drives",
        "driven_by", "effect", "effect_of", "причина", "вызвал", "вызвало", "привело_к",
        "спричинив", "спричинило", "призвело_до",
    }
)


def normalize_relation_type(value: str) -> str:
    """Causal family → 422 ``causal_relation_forbidden``; unknown → ``invalid_relation``."""
    normalized = "_".join((value or "").strip().casefold().replace("-", " ").split())
    if normalized in CAUSAL_DENYLIST or normalized.startswith(("caused", "definitely")):
        raise CausalRelationForbiddenError
    if normalized not in {member.value for member in RelationType}:
        raise InvalidRelationError
    return normalized


def plain(value: Any) -> Any:
    """JSON-safe scalar: Decimal → exact string, dates → ISO, UUID → str."""
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


def value_payload(row_or_value: Any) -> dict[str, Any] | None:
    """Typed value ``{type, unit_code, num, date, text, scale_min, scale_max}``."""
    if row_or_value is None:
        return None
    def get(name: str) -> Any:
        return getattr(row_or_value, name, None)

    value_type = get("value_type")
    if value_type is None:
        return None
    return {
        "type": str(value_type),
        "unit_code": get("unit_code"),
        "num": plain(get("value_num")),
        "date": plain(get("value_date")),
        "text": get("value_text"),
        "scale_min": plain(get("scale_min")),
        "scale_max": plain(get("scale_max")),
    }


def money(amount: Decimal, currency: str) -> dict[str, Any]:
    return {"type": "money", "unit_code": currency, "num": plain(amount.quantize(Decimal("0.01")))}


def advisory_lock(db: Session, *grain: object) -> None:
    """Serialize one write grain for the rest of the transaction (aa_comparison precedent)."""
    digest = hashlib.sha256(repr(tuple(str(part) for part in grain)).encode()).digest()
    db.execute(
        text("SELECT pg_advisory_xact_lock(:key)"),
        {"key": int.from_bytes(digest[:8], "big", signed=True)},
    )
