"""AES-256-GCM envelope encryption with unambiguous associated data.

Every protected object gets its own random 256-bit data key (DEK). The DEK
encrypts the object; a versioned key-encryption key (KEK) from the keyring
wraps the DEK. Rotation therefore re-wraps 60-byte DEKs and never touches
the (possibly large) object ciphertext.

Nonces: 96 bits from the operating system CSPRNG for every single
encryption — never derived from names, ids or timestamps. A DEK encrypts at
most a handful of messages (one content, one metadata record), far below
the random-nonce bound for GCM; descriptive metadata is re-encrypted under a
*fresh* DEK on every edit, so edits never accumulate under one key.

Associated data (AAD) is a length-prefixed encoding of named fields, so no
two different contexts can produce the same bytes (no delimiter ambiguity):

    b"JENKIN-AAD" ‖ u8 envelope_version
      ‖ for each field: u16 len(name) ‖ name ‖ u32 len(value) ‖ value

Contexts always name the purpose, the owning account and the object identity
(plus, where relevant, the version number, declared type and size), so a
ciphertext moved to another account, object, version or field — or a row
whose readable size/type columns were edited — fails authentication.
"""

from __future__ import annotations

import os
import struct
from dataclasses import dataclass
from uuid import UUID

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.crypto.keyring import KEY_BYTES, Keyring

ENVELOPE_VERSION = 1
SUPPORTED_ENVELOPE_VERSIONS = frozenset({1})
NONCE_BYTES = 12
TAG_BYTES = 16
WRAPPED_KEY_BYTES = NONCE_BYTES + KEY_BYTES + TAG_BYTES  # 60
_AAD_MAGIC = b"JENKIN-AAD"


class UnsupportedEnvelope(ValueError):
    """A stored record declares an envelope version this build cannot read."""


class DecryptionFailed(ValueError):
    """Authentication failed: wrong key, altered ciphertext, or altered context.

    Deliberately carries no detail about which — and never any plaintext."""


@dataclass(frozen=True)
class Context:
    """What a ciphertext is bound to. ``fields`` keeps its order; names are unique."""

    purpose: str
    owner: UUID
    fields: tuple[tuple[str, str], ...] = ()

    def with_fields(self, *extra: tuple[str, str]) -> Context:
        return Context(self.purpose, self.owner, self.fields + tuple(extra))

    def encode(self, envelope_version: int = ENVELOPE_VERSION) -> bytes:
        if envelope_version not in SUPPORTED_ENVELOPE_VERSIONS:
            raise UnsupportedEnvelope(f"envelope version {envelope_version} is not supported")
        named = (("purpose", self.purpose), ("owner", str(self.owner)), *self.fields)
        names = [name for name, _ in named]
        if len(set(names)) != len(names):
            raise ValueError("context field names must be unique")
        parts = [_AAD_MAGIC, struct.pack(">B", envelope_version)]
        for name, value in named:
            name_bytes = name.encode("utf-8")
            value_bytes = value.encode("utf-8")
            parts.append(struct.pack(">H", len(name_bytes)) + name_bytes)
            parts.append(struct.pack(">I", len(value_bytes)) + value_bytes)
        return b"".join(parts)


@dataclass(frozen=True)
class WrappedKey:
    key_id: str
    blob: bytes  # nonce ‖ AES-GCM(KEK, DEK) ‖ tag


def new_data_key() -> bytes:
    return AESGCM.generate_key(bit_length=256)


def encrypt(key: bytes, plaintext: bytes, context: Context) -> tuple[bytes, bytes]:
    """Return ``(nonce, ciphertext‖tag)``."""
    nonce = os.urandom(NONCE_BYTES)
    return nonce, AESGCM(key).encrypt(nonce, plaintext, context.encode())


def decrypt(
    key: bytes,
    nonce: bytes,
    ciphertext: bytes,
    context: Context,
    *,
    envelope_version: int = ENVELOPE_VERSION,
) -> bytes:
    aad = context.encode(envelope_version)
    if len(nonce) != NONCE_BYTES or len(ciphertext) < TAG_BYTES:
        raise DecryptionFailed("malformed envelope")
    try:
        return AESGCM(key).decrypt(nonce, ciphertext, aad)
    except InvalidTag:
        raise DecryptionFailed("authentication failed") from None


def _wrap_context(context: Context, key_id: str) -> Context:
    return Context(
        "dek.wrap",
        context.owner,
        (("wraps", context.purpose), *context.fields, ("kek_id", key_id)),
    )


def wrap_data_key(keyring: Keyring, data_key: bytes, context: Context) -> WrappedKey:
    """Wrap ``data_key`` with the keyring's *active* KEK, bound to ``context``."""
    if len(data_key) != KEY_BYTES:
        raise ValueError("data keys are 32 bytes")
    key_id = keyring.active_key_id
    nonce, sealed = encrypt(keyring.active_material, data_key, _wrap_context(context, key_id))
    return WrappedKey(key_id, nonce + sealed)


def unwrap_data_key(
    keyring: Keyring,
    wrapped: WrappedKey,
    context: Context,
    *,
    envelope_version: int = ENVELOPE_VERSION,
) -> bytes:
    """Raises :class:`KeyUnavailable` for an unknown KEK id, :class:`DecryptionFailed`
    for anything that does not authenticate."""
    material = keyring.material(wrapped.key_id)
    if len(wrapped.blob) != WRAPPED_KEY_BYTES:
        raise DecryptionFailed("malformed wrapped key")
    data_key = decrypt(
        material,
        wrapped.blob[:NONCE_BYTES],
        wrapped.blob[NONCE_BYTES:],
        _wrap_context(context, wrapped.key_id),
        envelope_version=envelope_version,
    )
    if len(data_key) != KEY_BYTES:
        raise DecryptionFailed("malformed data key")
    return data_key
