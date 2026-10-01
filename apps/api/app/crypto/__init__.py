"""Server-side envelope encryption at rest (JENKIN S2).

Scope, stated once so nobody reads more into it: this protects selected
records against someone who obtains the **database** (a dump, a stolen
backup, read access to the tables) but not the wrapping keys. The running
API can decrypt every record it is authorized to serve; whoever controls the
API process or its keyring can decrypt everything. It is not end-to-end or
zero-knowledge encryption.

* ``keyring``  — versioned key-encryption keys (KEKs) loaded from a restricted
  file; validated at startup; never generated implicitly.
* ``envelope`` — AES-256-GCM with a fresh random data key per object; data
  keys wrapped by a KEK; associated data binds every ciphertext to its owner,
  object, purpose and schema version.

All primitives come from ``cryptography`` (``AESGCM``). Nothing here
implements a cipher, a mode or a MAC.
"""

from app.crypto.envelope import (
    ENVELOPE_VERSION,
    Context,
    DecryptionFailed,
    UnsupportedEnvelope,
    WrappedKey,
    decrypt,
    encrypt,
    new_data_key,
    unwrap_data_key,
    wrap_data_key,
)
from app.crypto.keyring import Keyring, KeyringError, KeyUnavailable, load_keyring

__all__ = [
    "ENVELOPE_VERSION",
    "Context",
    "DecryptionFailed",
    "KeyUnavailable",
    "Keyring",
    "KeyringError",
    "UnsupportedEnvelope",
    "WrappedKey",
    "decrypt",
    "encrypt",
    "load_keyring",
    "new_data_key",
    "unwrap_data_key",
    "wrap_data_key",
]
