"""Authenticated contexts and envelope helpers for document records.

Every context names the owner and the object, so a ciphertext copied to
another account, document, version or field fails authentication. Content
contexts also bind the version number, the verified content type and the
plaintext size, so editing those readable columns is detected on download.
Document metadata binds the revision it was written at, so restoring an older
metadata ciphertext on its own is detected too.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.crypto import (
    ENVELOPE_VERSION,
    Context,
    Keyring,
    WrappedKey,
    decrypt,
    encrypt,
    new_data_key,
    unwrap_data_key,
    wrap_data_key,
)
from app.models import Document, DocumentVersion


def document_meta_context(*, owner: UUID, document_id: UUID, revision: int) -> Context:
    return Context(
        "document.meta",
        owner,
        (("document", str(document_id)), ("revision", str(revision))),
    )


def version_context(
    purpose: str,
    *,
    owner: UUID,
    document_id: UUID,
    version_id: UUID,
    number: int,
    content_type: str,
    size_bytes: int,
) -> Context:
    return Context(
        purpose,
        owner,
        (
            ("document", str(document_id)),
            ("version", str(version_id)),
            ("number", str(number)),
            ("content_type", content_type),
            ("size", str(size_bytes)),
        ),
    )


def version_contexts(row: DocumentVersion) -> tuple[Context, Context, Context]:
    """(data-key wrap, content, version metadata) contexts for a stored version."""
    fields = {
        "owner": row.user_id,
        "document_id": row.document_id,
        "version_id": row.id,
        "number": row.version_number,
        "content_type": row.content_type,
        "size_bytes": row.size_bytes,
    }
    return (
        version_context("document.version", **fields),
        version_context("document.content", **fields),
        version_context("document.version.meta", **fields),
    )


def _encode(value: dict[str, Any]) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


@dataclass(frozen=True)
class SealedMeta:
    key_id: str
    wrapped_dek: bytes
    nonce: bytes
    ciphertext: bytes


def seal_document_meta(
    keyring: Keyring, *, owner: UUID, document_id: UUID, revision: int, title: str, notes: str
) -> SealedMeta:
    """Fresh data key on every write: edits never accumulate under one key."""
    context = document_meta_context(owner=owner, document_id=document_id, revision=revision)
    data_key = new_data_key()
    wrapped = wrap_data_key(keyring, data_key, context)
    nonce, ciphertext = encrypt(data_key, _encode({"title": title, "notes": notes}), context)
    return SealedMeta(wrapped.key_id, wrapped.blob, nonce, ciphertext)


def open_document_meta(keyring: Keyring, row: Document) -> dict[str, str]:
    context = document_meta_context(
        owner=row.user_id, document_id=row.id, revision=row.revision
    )
    data_key = unwrap_data_key(
        keyring,
        WrappedKey(row.meta_kek_id, bytes(row.meta_wrapped_dek)),
        context,
        envelope_version=row.meta_envelope_version,
    )
    plain = decrypt(
        data_key,
        bytes(row.meta_nonce),
        bytes(row.meta_ciphertext),
        context,
        envelope_version=row.meta_envelope_version,
    )
    value = json.loads(plain)
    return {"title": str(value["title"]), "notes": str(value["notes"])}


def version_data_key(keyring: Keyring, row: DocumentVersion) -> bytes:
    wrap_context, _, _ = version_contexts(row)
    return unwrap_data_key(
        keyring,
        WrappedKey(row.kek_id, bytes(row.wrapped_dek)),
        wrap_context,
        envelope_version=row.envelope_version,
    )


def open_version_meta(data_key: bytes, row: DocumentVersion) -> dict[str, str]:
    _, _, meta_context = version_contexts(row)
    plain = decrypt(
        data_key,
        bytes(row.meta_nonce),
        bytes(row.meta_ciphertext),
        meta_context,
        envelope_version=row.envelope_version,
    )
    value = json.loads(plain)
    return {"filename": str(value["filename"]), "sha256": str(value["sha256"])}


def open_content(data_key: bytes, row: DocumentVersion, nonce: bytes, ciphertext: bytes) -> bytes:
    """Decrypt and authenticate the whole object before anything is returned."""
    _, content_context, _ = version_contexts(row)
    return decrypt(
        data_key, nonce, ciphertext, content_context, envelope_version=row.envelope_version
    )


@dataclass(frozen=True)
class SealedVersion:
    key_id: str
    wrapped_dek: bytes
    meta_nonce: bytes
    meta_ciphertext: bytes
    content_nonce: bytes
    content_ciphertext: bytes


def seal_version(
    keyring: Keyring,
    *,
    owner: UUID,
    document_id: UUID,
    version_id: UUID,
    number: int,
    content_type: str,
    content: bytes,
    filename: str,
    sha256: str,
) -> SealedVersion:
    fields = {
        "owner": owner,
        "document_id": document_id,
        "version_id": version_id,
        "number": number,
        "content_type": content_type,
        "size_bytes": len(content),
    }
    data_key = new_data_key()
    wrapped = wrap_data_key(keyring, data_key, version_context("document.version", **fields))
    content_nonce, content_ciphertext = encrypt(
        data_key, content, version_context("document.content", **fields)
    )
    meta_nonce, meta_ciphertext = encrypt(
        data_key,
        _encode({"filename": filename, "sha256": sha256}),
        version_context("document.version.meta", **fields),
    )
    return SealedVersion(
        wrapped.key_id, wrapped.blob, meta_nonce, meta_ciphertext, content_nonce, content_ciphertext
    )


__all__ = [
    "ENVELOPE_VERSION",
    "SealedMeta",
    "SealedVersion",
    "document_meta_context",
    "open_content",
    "open_document_meta",
    "open_version_meta",
    "seal_document_meta",
    "seal_version",
    "version_contexts",
    "version_data_key",
]
