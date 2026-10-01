"""Content validation for uploaded documents: PDF, JPEG, PNG.

The type is decided by the bytes, never by the file name, the browser's MIME
type or ``Content-Length``. A declared type or extension that disagrees with
the bytes is refused as a mismatch.

What this is: a structural check that the file is a well-formed instance of
an accepted format, with bounded work. What it is **not**: antivirus
scanning, sanitisation or rendering. A valid PDF may still contain scripts,
forms or embedded files; JENKIN never renders documents in the application
origin and only delivers them as attachment downloads.

* PNG — signature, IHDR first with sane dimensions, every chunk's CRC, at
  least one IDAT, IEND last and nothing after it. Pixels are never decoded.
* JPEG — SOI, a well-formed marker walk with a frame header and a scan,
  EOI. Data after EOI is accepted only when it is another JPEG stream (the
  multi-picture format phones write). Pixels are never decoded.
* PDF — ``%PDF-`` header at offset 0, ``%%EOF`` near the end, then pypdf parses
  the cross-reference data and page tree (no content stream is executed or
  rendered, no external reference is fetched). Encrypted / password-protected
  PDFs are refused: their structure cannot be validated without the password.
"""

from __future__ import annotations

import io
import logging
import struct
import zlib
from dataclasses import dataclass

PDF = "application/pdf"
JPEG = "image/jpeg"
PNG = "image/png"
ACCEPTED_TYPES = (PDF, JPEG, PNG)
EXTENSIONS = {PDF: ".pdf", JPEG: ".jpg", PNG: ".png"}
_EXTENSION_TYPES = {".pdf": PDF, ".jpg": JPEG, ".jpeg": JPEG, ".jpe": JPEG, ".png": PNG}

MAX_IMAGE_SIDE = 30_000
MAX_PNG_CHUNKS = 100_000
MAX_JPEG_SEGMENTS = 10_000
MAX_PDF_PAGES = 5_000

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

# pypdf reports recoverable structure problems as log warnings that can quote
# object data; keep them out of the service log.
logging.getLogger("pypdf").setLevel(logging.ERROR)


class ValidationRefused(ValueError):
    """The upload is refused. ``code`` is stable; no file content is included."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class ValidatedContent:
    content_type: str
    detail: dict[str, int]


def sniff(data: bytes) -> str | None:
    if data.startswith(_PNG_SIGNATURE):
        return PNG
    if data.startswith(b"\xff\xd8\xff"):
        return JPEG
    if data.startswith(b"%PDF-"):
        return PDF
    return None


def type_for_extension(filename: str) -> str | None:
    dot = filename.rfind(".")
    if dot <= 0:
        return None
    return _EXTENSION_TYPES.get(filename[dot:].casefold(), "unsupported")


def _malformed(kind: str) -> ValidationRefused:
    return ValidationRefused("malformed_document", f"The file is not a well-formed {kind}.")


def _validate_png(data: bytes) -> dict[str, int]:
    position = len(_PNG_SIGNATURE)
    chunks = 0
    seen_idat = False
    width = height = 0
    while True:
        if position + 12 > len(data):
            raise _malformed("PNG")
        length, kind = struct.unpack(">I4s", data[position : position + 8])
        if length > 0x7FFFFFFF or not kind.isalpha():
            raise _malformed("PNG")
        end = position + 8 + length
        if end + 4 > len(data):
            raise _malformed("PNG")
        body = data[position + 8 : end]
        (crc,) = struct.unpack(">I", data[end : end + 4])
        if zlib.crc32(kind + body) & 0xFFFFFFFF != crc:
            raise _malformed("PNG")
        if chunks == 0:
            if kind != b"IHDR" or length != 13:
                raise _malformed("PNG")
            width, height, depth, colour, compression, filtering, interlace = struct.unpack(
                ">IIBBBBB", body
            )
            allowed_depths = {0: {1, 2, 4, 8, 16}, 2: {8, 16}, 3: {1, 2, 4, 8}, 4: {8, 16}, 6: {8, 16}}
            if (
                not (0 < width <= MAX_IMAGE_SIDE and 0 < height <= MAX_IMAGE_SIDE)
                or depth not in allowed_depths.get(colour, set())
                or compression != 0
                or filtering != 0
                or interlace not in (0, 1)
            ):
                raise _malformed("PNG")
        elif kind == b"IHDR":
            raise _malformed("PNG")
        chunks += 1
        if chunks > MAX_PNG_CHUNKS:
            raise _malformed("PNG")
        if kind == b"IDAT":
            seen_idat = True
        position = end + 4
        if kind == b"IEND":
            if length != 0 or not seen_idat or position != len(data):
                raise _malformed("PNG")
            return {"width": width, "height": height}


_JPEG_STANDALONE = {0x01, *range(0xD0, 0xD8)}
_JPEG_FRAMES = {*range(0xC0, 0xD0)} - {0xC4, 0xC8, 0xCC}


def _jpeg_stream_end(data: bytes, start: int) -> tuple[int, dict[str, int]]:
    """Walk one JPEG stream from its SOI; return the offset after its EOI."""
    if data[start : start + 2] != b"\xff\xd8":
        raise _malformed("JPEG")
    position = start + 2
    frame: dict[str, int] | None = None
    scanned = False
    segments = 0
    while True:
        segments += 1
        if segments > MAX_JPEG_SEGMENTS or position + 2 > len(data):
            raise _malformed("JPEG")
        if data[position] != 0xFF:
            raise _malformed("JPEG")
        while position < len(data) and data[position] == 0xFF:
            position += 1  # fill bytes
        if position >= len(data):
            raise _malformed("JPEG")
        marker = data[position]
        position += 1
        if marker == 0xD9:  # EOI
            if frame is None or not scanned:
                raise _malformed("JPEG")
            return position, frame
        if marker in _JPEG_STANDALONE:
            continue
        if marker == 0xD8 or marker == 0x00:
            raise _malformed("JPEG")
        if position + 2 > len(data):
            raise _malformed("JPEG")
        (length,) = struct.unpack(">H", data[position : position + 2])
        if length < 2 or position + length > len(data):
            raise _malformed("JPEG")
        segment = data[position + 2 : position + length]
        position += length
        if marker in _JPEG_FRAMES:
            if len(segment) < 6:
                raise _malformed("JPEG")
            _precision, height, width, components = struct.unpack(">BHHB", segment[:6])
            if not (0 < width <= MAX_IMAGE_SIDE and 0 < height <= MAX_IMAGE_SIDE) or not (
                1 <= components <= 4
            ):
                raise _malformed("JPEG")
            if len(segment) != 6 + 3 * components:
                raise _malformed("JPEG")
            frame = {"width": width, "height": height}
        elif marker == 0xDA:  # SOS: entropy-coded data until a real marker
            if frame is None:
                raise _malformed("JPEG")
            scanned = True
            while True:
                next_ff = data.find(b"\xff", position)
                if next_ff < 0 or next_ff + 1 >= len(data):
                    raise _malformed("JPEG")
                following = data[next_ff + 1]
                if following == 0x00 or 0xD0 <= following <= 0xD7 or following == 0xFF:
                    position = next_ff + (2 if following != 0xFF else 1)
                    continue
                position = next_ff
                break


def _validate_jpeg(data: bytes) -> dict[str, int]:
    end, frame = _jpeg_stream_end(data, 0)
    # Multi-picture JPEGs append further complete streams after the first EOI.
    while end < len(data):
        if data[end:].strip(b"\x00") == b"":
            break
        end, _ = _jpeg_stream_end(data, end)
    return frame


def _validate_pdf(data: bytes) -> dict[str, int]:
    header = data[:16]
    if not header.startswith(b"%PDF-") or header[5:8] not in {
        b"1.0", b"1.1", b"1.2", b"1.3", b"1.4", b"1.5", b"1.6", b"1.7", b"2.0"
    }:
        raise _malformed("PDF")
    if b"%%EOF" not in data[-2048:]:
        raise _malformed("PDF")
    from pypdf import PdfReader  # local import keeps app start-up light
    from pypdf.errors import PyPdfError

    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            raise ValidationRefused(
                "encrypted_pdf",
                "Password-protected or encrypted PDFs cannot be checked safely and are not "
                "accepted. Save an unprotected copy and upload that.",
            )
        pages = len(reader.pages)
    except ValidationRefused:
        raise
    except (PyPdfError, ValueError, KeyError, TypeError, AttributeError, IndexError,
            RecursionError, struct.error, zlib.error, OSError, AssertionError):
        raise _malformed("PDF") from None
    if not 1 <= pages <= MAX_PDF_PAGES:
        raise _malformed("PDF")
    return {"pages": pages}


def validate_content(
    data: bytes, *, filename: str | None = None, declared_type: str | None = None
) -> ValidatedContent:
    if not data:
        raise ValidationRefused("empty_document", "The file is empty.")
    detected = sniff(data)
    if detected is None:
        raise ValidationRefused(
            "unsupported_document_type", "Only PDF, JPEG and PNG files are accepted."
        )
    if declared_type:
        normalized = declared_type.partition(";")[0].strip().casefold()
        if normalized == "image/jpg":
            normalized = JPEG
        if normalized and normalized not in {detected, "application/octet-stream"}:
            raise ValidationRefused(
                "content_type_mismatch", "The file's contents do not match its declared type."
            )
    if filename:
        by_extension = type_for_extension(filename)
        if by_extension is not None and by_extension != detected:
            raise ValidationRefused(
                "content_type_mismatch", "The file's contents do not match its extension."
            )
    if detected == PNG:
        detail = _validate_png(data)
    elif detected == JPEG:
        detail = _validate_jpeg(data)
    else:
        detail = _validate_pdf(data)
    return ValidatedContent(detected, detail)
