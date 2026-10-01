"""S2 checkpoint 1: envelope encryption and keyring validation (no database)."""

import base64
import json
import os
import uuid

import pytest

from app.crypto import (
    Context,
    DecryptionFailed,
    Keyring,
    KeyringError,
    KeyUnavailable,
    UnsupportedEnvelope,
    WrappedKey,
    decrypt,
    encrypt,
    load_keyring,
    new_data_key,
    unwrap_data_key,
    wrap_data_key,
)
from app.crypto.envelope import NONCE_BYTES, WRAPPED_KEY_BYTES
from app.crypto.keyring import check_value, parse_keyring, serialize_keyring
from tests.document_helpers import make_keyring

OWNER = uuid.UUID("11111111-1111-4111-8111-111111111111")
OTHER = uuid.UUID("22222222-2222-4222-8222-222222222222")


def ctx(**overrides) -> Context:
    base = {"purpose": "document.content", "owner": OWNER, "fields": (("document", "d1"),)}
    base.update(overrides)
    return Context(base["purpose"], base["owner"], base["fields"])


def test_round_trip_and_fresh_random_nonces():
    key = new_data_key()
    assert len(key) == 32
    nonces = set()
    for _ in range(200):
        nonce, sealed = encrypt(key, b"synthetic payload", ctx())
        assert len(nonce) == NONCE_BYTES
        nonces.add(nonce)
        assert decrypt(key, nonce, sealed, ctx()) == b"synthetic payload"
    assert len(nonces) == 200
    first = encrypt(key, b"same", ctx())
    second = encrypt(key, b"same", ctx())
    assert first != second, "equal plaintexts must not produce equal ciphertexts"


@pytest.mark.parametrize(
    "tamper",
    [
        lambda n, c: (n, bytes([c[0] ^ 1]) + c[1:]),  # altered ciphertext
        lambda n, c: (n, c[:-1] + bytes([c[-1] ^ 1])),  # altered tag
        lambda n, c: (bytes([n[0] ^ 1]) + n[1:], c),  # altered nonce
        lambda n, c: (n, c[:-17] + c[-16:]),  # truncated body
        lambda n, c: (n, c[:-16]),  # tag stripped
        lambda n, c: (n, c + b"\x00"),  # extended
    ],
)
def test_any_alteration_fails_authentication(tamper):
    key = new_data_key()
    nonce, sealed = encrypt(key, b"0123456789abcdef" * 4, ctx())
    altered_nonce, altered = tamper(nonce, sealed)
    with pytest.raises(DecryptionFailed):
        decrypt(key, altered_nonce, altered, ctx())


@pytest.mark.parametrize(
    "other",
    [
        {"owner": OTHER},  # cross-owner substitution
        {"purpose": "document.meta"},  # moved to another field/purpose
        {"fields": (("document", "d2"),)},  # moved to another object
        {"fields": (("document", "d1"), ("number", "2"))},  # extra binding
        {"fields": ()},
    ],
)
def test_context_binding_rejects_moved_ciphertext(other):
    key = new_data_key()
    nonce, sealed = encrypt(key, b"bound", ctx())
    with pytest.raises(DecryptionFailed):
        decrypt(key, nonce, sealed, ctx(**other))


def test_wrong_key_fails():
    nonce, sealed = encrypt(new_data_key(), b"x", ctx())
    with pytest.raises(DecryptionFailed):
        decrypt(new_data_key(), nonce, sealed, ctx())


def test_associated_data_encoding_is_unambiguous():
    # Delimiter-joined encodings would make these two identical.
    a = Context("p", OWNER, (("a", "b|c"),)).encode()
    b = Context("p", OWNER, (("a|b", "c"),)).encode()
    assert a != b
    with pytest.raises(ValueError):
        Context("p", OWNER, (("owner", "x"),)).encode()


def test_unknown_envelope_version_is_an_explicit_error():
    key = new_data_key()
    nonce, sealed = encrypt(key, b"x", ctx())
    with pytest.raises(UnsupportedEnvelope):
        decrypt(key, nonce, sealed, ctx(), envelope_version=99)


def test_wrap_unwrap_binds_kek_id_owner_and_context():
    keyring = make_keyring("kek-a", "kek-b")
    data_key = new_data_key()
    wrapped = wrap_data_key(keyring, data_key, ctx())
    assert wrapped.key_id == "kek-a" and len(wrapped.blob) == WRAPPED_KEY_BYTES
    assert unwrap_data_key(keyring, wrapped, ctx()) == data_key
    with pytest.raises(DecryptionFailed):
        unwrap_data_key(keyring, wrapped, ctx(owner=OTHER))
    with pytest.raises(DecryptionFailed):  # relabelled to another KEK id
        unwrap_data_key(keyring, WrappedKey("kek-b", wrapped.blob), ctx())
    with pytest.raises(KeyUnavailable) as missing:
        unwrap_data_key(keyring, WrappedKey("kek-gone", wrapped.blob), ctx())
    assert missing.value.key_id == "kek-gone"
    other_ring = make_keyring("kek-a")  # same id, different material
    with pytest.raises(DecryptionFailed):
        unwrap_data_key(other_ring, wrapped, ctx())


# ───────────────────────────── keyring ─────────────────────────────


def _file(entries, active="k1"):
    return json.dumps(
        {"format": "jenkin-keyring", "format_version": 1, "active_key_id": active, "keys": entries}
    ).encode()


def _key(key_id="k1", material=None):
    material = material or os.urandom(32)
    return {"id": key_id, "material": base64.b64encode(material).decode()}


def test_keyring_parses_and_never_shows_material():
    material = os.urandom(32)
    keyring = parse_keyring(_file([_key("k1", material)]))
    assert keyring.active_key_id == "k1"
    assert keyring.material("k1") == material
    for rendered in (repr(keyring), str(keyring), str(keyring.info())):
        assert base64.b64encode(material).decode() not in rendered
        assert material.hex() not in rendered
    assert keyring.info()[0].check_value == check_value(material)


@pytest.mark.parametrize(
    "raw",
    [
        b"not json",
        b"[]",
        _file([]),
        _file([_key("k1", os.urandom(16))]),  # short key
        _file([{"id": "k1", "material": "!!!notbase64!!!"}]),
        _file([_key("k1"), _key("k1")]),  # duplicate id
        _file([_key("k1")], active="k2"),  # active absent
        _file([_key("K1 with spaces")], active="K1 with spaces"),
        _file([{**_key("k1"), "extra": 1}]),
        json.dumps({"format": "other", "format_version": 1, "active_key_id": "k1",
                    "keys": [_key("k1")]}).encode(),
    ],
)
def test_malformed_keyrings_fail_closed(raw):
    with pytest.raises(KeyringError):
        parse_keyring(raw)


def test_keys_sharing_material_are_refused():
    material = os.urandom(32)
    with pytest.raises(KeyringError):
        parse_keyring(_file([_key("k1", material), _key("k2", material)]))


def test_keyring_file_permissions_and_absence(tmp_path):
    path = tmp_path / "keyring.json"
    with pytest.raises(KeyringError, match="does not exist"):
        load_keyring(path)
    path.write_bytes(serialize_keyring([("k1", os.urandom(32), None)], "k1"))
    path.chmod(0o644)
    with pytest.raises(KeyringError, match="too open"):
        load_keyring(path)
    path.chmod(0o640)
    with pytest.raises(KeyringError, match="too open"):
        load_keyring(path)
    assert load_keyring(path, allow_group_read=True).active_key_id == "k1"
    path.chmod(0o600)
    assert load_keyring(path).active_key_id == "k1"
    directory = tmp_path / "dir"
    directory.mkdir(mode=0o700)
    with pytest.raises(KeyringError, match="regular file"):
        load_keyring(directory)


def test_keyring_rejects_inconsistent_construction():
    with pytest.raises(KeyringError):
        Keyring({"k1": os.urandom(32)}, "k2")
    with pytest.raises(KeyringError):
        Keyring({"k1": os.urandom(31)}, "k1")
