"""Synthetic documents and fixtures for the S2 suites. No real document is ever used."""

from __future__ import annotations

import base64
import io
import json
import secrets
import struct
import zlib
from pathlib import Path
from typing import Any

from app.crypto.keyring import Keyring

FIXTURES = Path(__file__).parent / "fixtures"


def make_png(width: int = 8, height: int = 6, rgb: tuple[int, int, int] = (30, 120, 200)) -> bytes:
    raw = b"".join(b"\x00" + bytes(rgb) * width for _ in range(height))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def make_jpeg() -> bytes:
    """A real 16×12 JPEG converted from a synthetic PNG (macOS ``sips``)."""
    return (FIXTURES / "synthetic-16x12.jpg").read_bytes()


def make_pdf(pages: int = 1, text: str = "synthetic") -> bytes:
    from pypdf import PdfWriter

    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=200, height=200)
    writer.add_metadata({"/Title": text})
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def make_encrypted_pdf() -> bytes:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.encrypt(user_password="synthetic-password", algorithm="AES-256")
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def make_keyring(*key_ids: str, active: str | None = None) -> Keyring:
    ids = key_ids or ("kek-test-1",)
    return Keyring({key_id: secrets.token_bytes(32) for key_id in ids}, active or ids[0])


def extend_keyring(keyring: Keyring, key_id: str, *, activate: bool = True) -> Keyring:
    keys = {existing: keyring.material(existing) for existing in keyring.key_ids}
    keys[key_id] = secrets.token_bytes(32)
    return Keyring(keys, key_id if activate else keyring.active_key_id)


def without_key(keyring: Keyring, key_id: str, *, active: str) -> Keyring:
    keys = {k: keyring.material(k) for k in keyring.key_ids if k != key_id}
    return Keyring(keys, active)


def default_name(content: bytes) -> str:
    from app.services.documents.validation import EXTENSIONS, sniff

    detected = sniff(content)
    return "synthetic" + (EXTENSIONS[detected] if detected else ".bin")


def encode_meta(**fields: Any) -> str:
    return base64.urlsafe_b64encode(json.dumps(fields).encode("utf-8")).decode("ascii").rstrip("=")


def idem() -> str:
    return "idem-" + secrets.token_hex(12)


def upload(
    client,
    content: bytes,
    *,
    filename: str | None = None,
    title: str | None = None,
    notes: str | None = None,
    declared_type: str | None = None,
    key: str | None = None,
    headers: dict[str, str] | None = None,
):
    meta: dict[str, Any] = {"filename": filename or default_name(content)}
    if title is not None:
        meta["title"] = title
    if notes is not None:
        meta["notes"] = notes
    if declared_type is not None:
        meta["declared_type"] = declared_type
    request_headers = {
        "Content-Type": "application/octet-stream",
        "X-LifeOS-Document-Meta": encode_meta(**meta),
        "Idempotency-Key": key or idem(),
    }
    request_headers.update(headers or {})
    return client.post("/api/v1/documents", content=content, headers=request_headers)


def upload_version(
    client,
    document_id: str,
    content: bytes,
    *,
    expected_revision: int,
    filename: str | None = None,
    key: str | None = None,
):
    return client.post(
        f"/api/v1/documents/{document_id}/versions",
        content=content,
        headers={
            "Content-Type": "application/octet-stream",
            "X-LifeOS-Document-Meta": encode_meta(filename=filename or default_name(content)),
            "Idempotency-Key": key or idem(),
            "X-LifeOS-Expected-Revision": str(expected_revision),
        },
    )
