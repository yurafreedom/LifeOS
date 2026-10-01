"""S2 checkpoint 2: content validation decides the type by the bytes (no database)."""

import struct
import zlib

import pytest

from app.services.documents.validation import (
    JPEG,
    PDF,
    PNG,
    ValidationRefused,
    validate_content,
)
from tests.document_helpers import make_encrypted_pdf, make_jpeg, make_pdf, make_png


def code_of(data: bytes, **kwargs) -> str:
    with pytest.raises(ValidationRefused) as refused:
        validate_content(data, **kwargs)
    return refused.value.code


def test_accepts_the_three_formats_by_content():
    assert validate_content(make_png(8, 6)).content_type == PNG
    assert validate_content(make_jpeg()).content_type == JPEG
    pdf = validate_content(make_pdf(pages=3))
    assert pdf.content_type == PDF and pdf.detail == {"pages": 3}


def test_extension_and_declared_type_must_agree_with_the_bytes():
    png = make_png()
    assert code_of(png, filename="scan.pdf") == "content_type_mismatch"
    assert code_of(png, declared_type="application/pdf") == "content_type_mismatch"
    assert code_of(make_pdf(), filename="photo.JPG") == "content_type_mismatch"
    assert validate_content(png, filename="photo.PNG", declared_type="image/png").content_type == PNG
    assert validate_content(make_jpeg(), declared_type="image/jpg").content_type == JPEG
    # An unknown extension is refused rather than trusted.
    assert code_of(png, filename="evil.html") == "content_type_mismatch"
    # The browser's generic type is not evidence either way.
    assert validate_content(png, declared_type="application/octet-stream").content_type == PNG


@pytest.mark.parametrize(
    "data",
    [
        b"<html><script>alert(1)</script></html>",
        b"GIF89a\x01\x00\x01\x00",
        b"<svg xmlns='http://www.w3.org/2000/svg'/>",
        b"PK\x03\x04",
    ],
)
def test_unsupported_formats_are_refused(data):
    assert code_of(data) == "unsupported_document_type"


def test_empty_file_is_refused():
    assert code_of(b"") == "empty_document"


def test_malformed_png_variants():
    good = make_png()
    assert code_of(good[:-6]) == "malformed_document"  # truncated
    corrupted = bytearray(good)
    corrupted[40] ^= 0xFF  # inside IDAT → CRC mismatch
    assert code_of(bytes(corrupted)) == "malformed_document"
    assert code_of(good + b"<html>") == "malformed_document"  # trailing polyglot data
    ihdr = struct.pack(">IIBBBBB", 0, 6, 8, 2, 0, 0, 0)
    zero_width = (
        good[:8]
        + struct.pack(">I", 13) + b"IHDR" + ihdr
        + struct.pack(">I", zlib.crc32(b"IHDR" + ihdr) & 0xFFFFFFFF)
        + good[33:]
    )
    assert code_of(zero_width) == "malformed_document"


def test_malformed_jpeg_variants():
    good = make_jpeg()
    assert code_of(good[:-2]) == "malformed_document"  # no EOI
    assert code_of(good[:200]) == "malformed_document"  # truncated
    assert code_of(good + b"<html>appended</html>") == "malformed_document"
    assert validate_content(good + good).content_type == JPEG  # multi-picture
    assert code_of(b"\xff\xd8\xff\xd9") == "malformed_document"  # no frame/scan


def test_malformed_and_encrypted_pdf():
    good = make_pdf()
    assert code_of(b"%PDF-1.7\nnot really a pdf\n%%EOF") == "malformed_document"
    assert code_of(good.replace(b"%%EOF", b"%%XXX")) == "malformed_document"
    assert code_of(b"%PDF-9.9" + good[8:]) == "malformed_document"
    refused = code_of(make_encrypted_pdf())
    assert refused == "encrypted_pdf"
