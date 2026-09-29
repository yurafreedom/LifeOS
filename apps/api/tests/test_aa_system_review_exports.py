"""Slice 7 · Saved System Review exports (S7-40…43): PDF, DOCX, XLSX, MD.

Every format renders the same report model, so a redacted source is «источник
удалён» everywhere and its erased value exists in none of them. User-typed text
that looks like a spreadsheet formula stays text.
"""

import io
import re
import zipfile
import zlib

import pytest

from app.services.system_review.exports.ttf import load_font
from tests.aa_helpers import authenticate
from tests.aa_system_review_helpers import (
    BASE,
    SEPTEMBER,
    expense_context,
    obligation,
    ok,
    save,
    sr_clock,  # noqa: F401  (fixture, applied module-wide)
    transaction,
)

ERASED = "987654.32"
FORMULA = '=HYPERLINK("http://example.test","x")'

pytestmark = pytest.mark.usefixtures("sr_clock")


def _setup(client, settings, account_factory, email="sr-export@example.com"):
    owner = account_factory(email)
    authenticate(client, settings, owner)
    doomed = transaction(client, "t9", ERASED, "2026-09-20")
    transaction(client, "t1", "180.00")
    debt = obligation(client)
    expense_context(client, "t1", plannedness="unplanned", funding_source="credit",
                    obligation_entity_id=debt["entity_id"], expected_recurrence="recurring",
                    recurrence_per_month="2")
    ok(save(client, finalize=True, reflection="Месяц с концертом",
            decisions=[FORMULA, "+380 позвонить в банк", "@me напомнить"],
            adjustments=["-1 кафе в неделю"]), 201)
    deleted = client.delete(f"/api/v1/aa/facts/aa_measurements/{doomed['id']}?mode=hard")
    assert deleted.status_code == 200, deleted.text
    return owner


def _export(client, fmt, locale="ru"):
    response = client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions/1/export",
                          params={"format": fmt, "locale": locale})
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    assert f"lifeos-system-review-{SEPTEMBER}-r1.{fmt}" in response.headers[
        "content-disposition"]
    return response


def test_s7_43_markdown(client, settings, account_factory):
    _setup(client, settings, account_factory)
    body = _export(client, "md").content.decode("utf-8")
    assert body.startswith("# Обзор системы · Сентябрь 2026")
    for heading in ("## Что менялось", "## Последствия", "## Связи", "## Ваши выводы и решения",
                    "## Происхождение данных"):
        assert heading in body
    assert "источник удалён" in body
    assert "987654" not in body
    assert "Месяц с концертом" in body
    assert "Проекция погашения долга" in body
    assert "фиксированный ежемесячный платёж" in body  # assumptions travel with it
    uk = _export(client, "md", "uk").content.decode("utf-8")
    assert uk.startswith("# Огляд системи · Вересень 2026") and "джерело видалено" in uk


def test_s7_42_xlsx_is_typed_redacted_and_formula_safe(client, settings, account_factory):
    _setup(client, settings, account_factory)
    content = _export(client, "xlsx").content
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        workbook = archive.read("xl/workbook.xml").decode()
        sheets = re.findall(r'<sheet [^>]*name="([^"]+)"', workbook)
        assert sheets == ["Summary", "Facts", "Relations", "Consequences", "User Decisions",
                          "Provenance"]
        parts = {name: archive.read(name).decode() for name in archive.namelist()
                 if name.endswith(".xml")}
    joined = "".join(parts.values())
    assert "<f>" not in joined and "<f " not in joined
    assert "987654" not in joined
    assert "источник удалён" in joined
    styles = parts["xl/styles.xml"]
    quoted = {str(i) for i, xf in enumerate(re.findall(r"<xf [^>]*/?>", styles.split(
        "<cellXfs")[1])) if 'quotePrefix="1"' in xf}
    assert quoted
    for risky in ("=HYPERLINK(", "+380", "@me", "-1 кафе"):
        cell = re.search(r'<c [^>]*s="(\d+)"[^>]*><is><t[^>]*>' + re.escape(risky), joined)
        assert cell is not None, risky
        assert cell.group(1) in quoted, risky
    assert 't="n"' in joined  # numbers stay numbers


def test_s7_41_docx(client, settings, account_factory):
    _setup(client, settings, account_factory)
    content = _export(client, "docx").content
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        document = archive.read("word/document.xml").decode()
        assert "word/styles.xml" in archive.namelist()
    assert "<w:tbl>" in document
    assert "Обзор системы" in document and "источник удалён" in document
    assert "987654" not in document
    assert "HYPERLINK" in document  # the user's text, as text


def _pdf_text(content: bytes) -> str:
    streams = re.findall(rb"stream\r?\n(.*?)\r?\nendstream", content, re.S)
    decoded = []
    for raw in streams:
        try:
            decoded.append(zlib.decompress(raw))
        except zlib.error:
            continue
    reverse = {}
    for name in ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf"):
        font = load_font(name)
        reverse[name] = {gid: chr(code) for code, gid in font.cmap.items()}
    text = []
    for stream in decoded:
        for hexes in re.findall(rb"<([0-9A-Fa-f]+)>\s*Tj", stream):
            ids = [int(hexes[i:i + 4], 16) for i in range(0, len(hexes), 4)]
            for mapping in reverse.values():
                text.append("".join(mapping.get(gid, "") for gid in ids))
    return "\n".join(text)


def test_s7_40_pdf(client, settings, account_factory):
    _setup(client, settings, account_factory)
    content = _export(client, "pdf").content
    assert content.startswith(b"%PDF-1.7") and content.rstrip().endswith(b"%%EOF")
    assert b"/ToUnicode" in content and b"/FontFile2" in content
    text = _pdf_text(content)
    assert "Обзор" in text and "источник" in text and "удалён" in text
    assert "987654" not in text
    assert len(content) < 400_000


def test_export_errors(client, settings, account_factory):
    _setup(client, settings, account_factory)
    bad = client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions/1/export",
                     params={"format": "exe"})
    assert bad.status_code == 422 and bad.json()["code"] == "invalid_export_format"
    missing = client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions/7/export",
                         params={"format": "md"})
    assert missing.status_code == 404
    other = account_factory("sr-export-other@example.com")
    authenticate(client, settings, other)
    assert client.get(f"{BASE}/system-reviews/{SEPTEMBER}/revisions/1/export",
                      params={"format": "md"}).status_code == 404
