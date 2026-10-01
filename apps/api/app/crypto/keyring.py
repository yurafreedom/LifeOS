"""Versioned key-encryption keys (KEKs) loaded from a restricted file.

File format (JSON, UTF-8, at most 64 KiB)::

    {
      "format": "jenkin-keyring",
      "format_version": 1,
      "active_key_id": "kek-20261001",
      "keys": [
        {"id": "kek-20261001", "created_at": "2026-10-01T12:00:00Z",
         "material": "<base64 of exactly 32 random bytes>"}
      ]
    }

Rules enforced on every load (fail closed — a document-enabled API refuses to
start rather than run without, or with a doubtful, keyring):

* the file is a regular file owned by the service user (or root), with no
  permission bits for "other" and no group write/execute; group *read* is
  refused unless the deployment opts in (``allow_group_read``) for a secret
  mount that grants read through a dedicated group;
* every key is exactly 32 bytes of strict base64; ids are unique, short and
  plain; no two ids share key material;
* the active key id names a present key.

Keys are never generated here, never derived from a password or from the
bootstrap token, and never written to the database, logs or responses. Old
keys stay in the file until an operator removes them after a verified
rotation (see the key runbook); a record that names an absent key fails with
:class:`KeyUnavailable`, never with a silent fallback.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import stat
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

FORMAT = "jenkin-keyring"
FORMAT_VERSION = 1
KEY_BYTES = 32
MAX_FILE_BYTES = 64 * 1024
MAX_KEYS = 64
KEY_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
_CHECK_LABEL = b"jenkin-keyring-check-v1"


class KeyringError(RuntimeError):
    """The keyring file is missing, unsafe or malformed. Never contains key material."""


class KeyUnavailable(LookupError):
    """A record names a wrapping key that this keyring does not hold."""

    def __init__(self, key_id: str) -> None:
        super().__init__(f"wrapping key {key_id!r} is not in the configured keyring")
        self.key_id = key_id


@dataclass(frozen=True)
class KeyInfo:
    key_id: str
    created_at: str | None
    check_value: str


def check_value(material: bytes) -> str:
    """A short, non-reversible key check value (HMAC of a fixed label).

    Lets an operator confirm that two keyring copies hold the same key without
    printing the key. It reveals nothing usable about the key."""
    return hmac.new(material, _CHECK_LABEL, hashlib.sha256).hexdigest()[:16]


class Keyring:
    """In-memory KEKs. ``repr`` and ``str`` never show material."""

    __slots__ = ("_keys", "_created", "active_key_id")

    def __init__(
        self,
        keys: dict[str, bytes],
        active_key_id: str,
        created: dict[str, str | None] | None = None,
    ) -> None:
        if active_key_id not in keys:
            raise KeyringError("the active key id is not in the keyring")
        for key_id, material in keys.items():
            _validate_id(key_id)
            if len(material) != KEY_BYTES:
                raise KeyringError(f"key {key_id!r} must be exactly {KEY_BYTES} bytes")
        if len(set(keys.values())) != len(keys):
            raise KeyringError("two key ids share the same key material")
        self._keys = dict(keys)
        self._created = dict(created or {})
        self.active_key_id = active_key_id

    def __repr__(self) -> str:
        return f"Keyring(active={self.active_key_id!r}, ids={sorted(self._keys)!r})"

    __str__ = __repr__

    @property
    def key_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._keys))

    def material(self, key_id: str) -> bytes:
        try:
            return self._keys[key_id]
        except KeyError:
            raise KeyUnavailable(key_id) from None

    @property
    def active_material(self) -> bytes:
        return self._keys[self.active_key_id]

    def info(self) -> list[KeyInfo]:
        return [
            KeyInfo(key_id, self._created.get(key_id), check_value(self._keys[key_id]))
            for key_id in self.key_ids
        ]


def _validate_id(key_id: object) -> str:
    if not isinstance(key_id, str) or not KEY_ID_PATTERN.fullmatch(key_id):
        raise KeyringError(
            "key ids must be 1–64 characters of a–z, 0–9, '.', '_' or '-', starting "
            "with a letter or digit"
        )
    return key_id


def _decode_material(key_id: str, encoded: object) -> bytes:
    if not isinstance(encoded, str):
        raise KeyringError(f"key {key_id!r} material must be a base64 string")
    try:
        material = base64.b64decode(encoded.encode("ascii"), validate=True)
    except (binascii.Error, UnicodeEncodeError):
        raise KeyringError(f"key {key_id!r} material is not strict base64") from None
    if len(material) != KEY_BYTES:
        raise KeyringError(f"key {key_id!r} must decode to exactly {KEY_BYTES} bytes")
    return material


def check_file_permissions(path: Path, *, allow_group_read: bool) -> None:
    try:
        info = os.stat(path)
    except FileNotFoundError:
        raise KeyringError("the keyring file does not exist") from None
    except PermissionError:
        raise KeyringError("the keyring file is not readable by the service user") from None
    if not stat.S_ISREG(info.st_mode):
        raise KeyringError("the keyring path is not a regular file")
    mode = stat.S_IMODE(info.st_mode)
    forbidden = 0o037 if allow_group_read else 0o077
    if mode & forbidden:
        raise KeyringError(
            f"the keyring file permissions {mode:04o} are too open "
            f"(expected 0600 or 0400{', or 0440 with group read allowed' if allow_group_read else ''})"
        )
    geteuid = getattr(os, "geteuid", None)
    if geteuid is not None and info.st_uid not in {geteuid(), 0}:
        raise KeyringError("the keyring file must be owned by the service user or root")


def parse_keyring(raw: bytes) -> Keyring:
    if len(raw) > MAX_FILE_BYTES:
        raise KeyringError("the keyring file is larger than 64 KiB")
    try:
        document = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise KeyringError("the keyring file is not valid UTF-8 JSON") from None
    if not isinstance(document, dict):
        raise KeyringError("the keyring file must hold a JSON object")
    if set(document) - {"format", "format_version", "active_key_id", "keys"}:
        raise KeyringError("the keyring file has unknown top-level fields")
    if document.get("format") != FORMAT or document.get("format_version") != FORMAT_VERSION:
        raise KeyringError(f"the keyring file is not a {FORMAT} v{FORMAT_VERSION} file")
    entries = document.get("keys")
    if not isinstance(entries, list) or not entries:
        raise KeyringError("the keyring file must list at least one key")
    if len(entries) > MAX_KEYS:
        raise KeyringError(f"the keyring file lists more than {MAX_KEYS} keys")
    keys: dict[str, bytes] = {}
    created: dict[str, str | None] = {}
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) - {"id", "material", "created_at"}:
            raise KeyringError("every key entry must be {id, material, created_at?}")
        key_id = _validate_id(entry.get("id"))
        if key_id in keys:
            raise KeyringError(f"key id {key_id!r} appears twice")
        keys[key_id] = _decode_material(key_id, entry.get("material"))
        created_at = entry.get("created_at")
        created[key_id] = created_at if isinstance(created_at, str) else None
    active = document.get("active_key_id")
    if not isinstance(active, str) or active not in keys:
        raise KeyringError("active_key_id must name a key listed in the file")
    return Keyring(keys, active, created)


def load_keyring(path: str | os.PathLike[str], *, allow_group_read: bool = False) -> Keyring:
    resolved = Path(path)
    check_file_permissions(resolved, allow_group_read=allow_group_read)
    try:
        with open(resolved, "rb") as handle:
            raw = handle.read(MAX_FILE_BYTES + 1)
    except OSError:
        raise KeyringError("the keyring file could not be read") from None
    return parse_keyring(raw)


def serialize_keyring(
    entries: Iterable[tuple[str, bytes, str | None]], active_key_id: str
) -> bytes:
    """Render a keyring file (operator tooling only)."""
    keys = [
        {
            "id": _validate_id(key_id),
            "created_at": created_at,
            "material": base64.b64encode(material).decode("ascii"),
        }
        for key_id, material, created_at in entries
    ]
    document = {
        "format": FORMAT,
        "format_version": FORMAT_VERSION,
        "active_key_id": active_key_id,
        "keys": keys,
    }
    rendered = json.dumps(document, indent=2).encode("utf-8") + b"\n"
    parse_keyring(rendered)  # never write a file that would not load
    return rendered
