"""Subject reference contract — a generic typed triple, always scoped by user.

AA addresses subjects as ``(subject_domain, subject_type, subject_id)`` rather
than by foreign keys, because the first two subjects it must address cannot be
FK targets: a finance period (``finance:period:2026-08``) has no row anywhere,
and a project will live inside the snapshot's JSONB array, where a real foreign
key is not enforceable.

``subject_id`` is ``TEXT NOT NULL DEFAULT ''`` — snapshot ids are heterogeneous
and ``''`` marks an account- or domain-scoped subject without NULL-in-index
semantics. Every index and every query leads with ``user_id``, so two accounts
may both hold ``finance:period:2026-08`` and neither can resolve the other's.

Legality of a ``(domain, type)`` pair is validated here, at the service
boundary, and not by the database: adding a subject type in a later slice must
not require a migration.
"""

from dataclasses import dataclass

SUBJECT_KEY_SEPARATOR = ":"

# (domain, type) pairs AA is allowed to address. Registering a pair costs
# nothing and unblocks no feature by itself; the concepts that use them arrive
# with their own slices.
SUBJECT_REGISTRY: frozenset[tuple[str, str]] = frozenset(
    {
        ("finance", "transaction"),
        ("finance", "period"),
        ("project", "project"),
        ("experiment", "experiment"),
        ("system", "window"),
    }
)


class UnknownSubjectError(ValueError):
    """A (domain, type) pair outside the registry was used."""

    code = "unknown_subject"

    def __init__(self, subject_domain: str, subject_type: str) -> None:
        self.subject_domain = subject_domain
        self.subject_type = subject_type
        super().__init__(f"Unknown subject type: {subject_domain}:{subject_type}")


class InvalidSubjectError(ValueError):
    """A subject component is structurally unusable."""

    code = "invalid_subject"


@dataclass(frozen=True, slots=True)
class SubjectRef:
    subject_domain: str
    subject_type: str
    subject_id: str = ""

    @property
    def subject_key(self) -> str:
        """Mirror of the database's generated ``subject_key`` column.

        Composed for grouping and indexing only; it is never parsed back into
        its parts.
        """
        return SUBJECT_KEY_SEPARATOR.join(
            (self.subject_domain, self.subject_type, self.subject_id)
        )


def validate_subject(subject: SubjectRef) -> SubjectRef:
    for name, value in (
        ("subject_domain", subject.subject_domain),
        ("subject_type", subject.subject_type),
    ):
        if not value:
            raise InvalidSubjectError(f"{name} must not be empty")
    for name, value in (
        ("subject_domain", subject.subject_domain),
        ("subject_type", subject.subject_type),
        ("subject_id", subject.subject_id),
    ):
        if SUBJECT_KEY_SEPARATOR in value:
            raise InvalidSubjectError(f"{name} must not contain '{SUBJECT_KEY_SEPARATOR}'")
    if (subject.subject_domain, subject.subject_type) not in SUBJECT_REGISTRY:
        raise UnknownSubjectError(subject.subject_domain, subject.subject_type)
    return subject


def parse_subject_key(subject_key: str) -> SubjectRef:
    """Split a subject key supplied as a single query parameter.

    Used only at the request boundary, where a caller names a subject in one
    string; stored rows always carry the three columns.
    """
    parts = subject_key.split(SUBJECT_KEY_SEPARATOR)
    if len(parts) != 3:
        raise InvalidSubjectError("subject must be 'domain:type:id'")
    return SubjectRef(subject_domain=parts[0], subject_type=parts[1], subject_id=parts[2])
