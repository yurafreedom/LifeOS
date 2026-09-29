"""PDF writer: a hand-written PDF 1.7 with embedded, subset DejaVu Sans.

No PDF library is used, so this module owns three things a library would:

* Fonts. Cyrillic needs a real embedded font, so DejaVu Sans (regular + bold)
  is embedded as Type0/CIDFontType2 with ``Identity-H`` (text is written as
  glyph ids) plus a ``/ToUnicode`` CMap so copy/paste and ``pdftotext`` return
  the original text. ``ttf.py`` subsets each font to the glyphs actually used.
* Layout. Text is wrapped with the font's real advance widths; tables get
  content-proportional column widths, repeat their header on a new page and
  keep a row together whenever it fits on a page. Pages break automatically and
  get a "page N / M" footer.
* Determinism. No timestamps, a content-derived subset tag and document ID, and
  fixed zlib settings, so the same document always yields the same bytes.

User text is never interpreted: it only ever becomes glyph-id hex strings.
Redacted text is drawn grey and slanted (a shear matrix; no italic font).
"""

import hashlib
import re
import zlib
from dataclasses import dataclass

from app.services.system_review.exports.columns import fit_columns
from app.services.system_review.exports.document import (
    BulletList,
    Cell,
    Paragraph,
    ReportDocument,
    Table,
)
from app.services.system_review.exports.ttf import TrueTypeFont, load_font

_PAGE_W, _PAGE_H = 595.28, 841.89
_MARGIN = 48.0
_TEXT_W = _PAGE_W - 2 * _MARGIN
_TOP = _PAGE_H - _MARGIN
_BOTTOM = _MARGIN
_FOOTER_Y = 26.0
_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f  ﻿]")
_PAGE_LABEL = {"ru": "стр.", "uk": "стор."}

_BLACK = (0.0, 0.0, 0.0)
_GREY = (0.42, 0.42, 0.42)
_GRID = 0.75
_HEADER_FILL = 0.93
_OBLIQUE = 0.2


def _num(value: float) -> str:
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return "0" if text in ("", "-0") else text


def _clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    return _CONTROL.sub("", text)


class _FontUse:
    """One embedded font within one document: widths plus the glyphs it used."""

    def __init__(self, font: TrueTypeFont, resource: str, base_name: str) -> None:
        self.font = font
        self.resource = resource
        self.base_name = base_name
        self.scale = 1 / font.metrics.units_per_em
        # gid → the text it stands for, for /ToUnicode (first writer wins).
        self.used: dict[int, str] = {}

    def width(self, text: str, size: float) -> float:
        font = self.font
        return sum(font.advance(font.glyph_id(ord(ch))) for ch in text) * self.scale * size

    def encode(self, text: str) -> str:
        out = []
        for ch in text:
            gid = self.font.glyph_id(ord(ch))
            self.used.setdefault(gid, ch)
            out.append(f"{gid:04X}")
        return "".join(out)


@dataclass(frozen=True, slots=True)
class _Style:
    font: _FontUse
    size: float
    leading: float
    color: tuple[float, float, float] = _BLACK
    oblique: bool = False

    def width(self, text: str) -> float:
        return self.font.width(text, self.size)


def _wrap(style: _Style, text: str, max_width: float) -> list[str]:
    # A hair of tolerance: column widths are rescaled floats of measured text.
    max_width = max(max_width, style.size) + 0.01
    space = style.width(" ")
    lines: list[str] = []
    for paragraph in _clean(text).split("\n"):
        current, current_w = "", 0.0
        for word in paragraph.split():
            word_w = style.width(word)
            if current and current_w + space + word_w <= max_width:
                current, current_w = f"{current} {word}", current_w + space + word_w
                continue
            if current:
                lines.append(current)
            while word_w > max_width and len(word) > 1:
                cut, cut_w = 1, style.width(word[0])
                while cut < len(word):
                    next_w = cut_w + style.width(word[cut])
                    if next_w > max_width:
                        break
                    cut, cut_w = cut + 1, next_w
                lines.append(word[:cut])
                word = word[cut:]
                word_w = style.width(word)
            current, current_w = word, word_w
        lines.append(current)
    while len(lines) > 1 and not lines[-1]:
        lines.pop()
    return lines or [""]


def _text_op(x: float, baseline: float, style: _Style, text: str) -> str:
    red, green, blue = style.color
    shear = _num(_OBLIQUE) if style.oblique else "0"
    return (
        f"BT {_num(red)} {_num(green)} {_num(blue)} rg /{style.font.resource} "
        f"{_num(style.size)} Tf 1 0 {shear} 1 {_num(x)} {_num(baseline)} Tm "
        f"<{style.font.encode(text)}> Tj ET"
    )


def _baseline(top: float, style: _Style) -> float:
    return top - style.leading + (style.leading - style.size) / 2 + style.size * 0.22


class _Layout:
    def __init__(self) -> None:
        self.pages: list[list[str]] = []
        self.y = _TOP
        self.new_page()

    def new_page(self) -> None:
        self.pages.append([])
        self.y = _TOP

    def fits(self, height: float) -> bool:
        return self.y - height >= _BOTTOM

    def ensure(self, height: float) -> None:
        if not self.fits(height) and self.y < _TOP:
            self.new_page()

    def gap(self, height: float) -> None:
        if self.y < _TOP:
            self.y = max(self.y - height, _BOTTOM)

    def text(self, x: float, baseline: float, style: _Style, text: str) -> None:
        if text:
            self.pages[-1].append(_text_op(x, baseline, style, text))

    def lines(self, lines: list[str], style: _Style, x: float = _MARGIN) -> None:
        for line in lines:
            self.ensure(style.leading)
            self.text(x, _baseline(self.y, style), style, line)
            self.y -= style.leading

    def flow(self, text: str, style: _Style, x: float = _MARGIN) -> None:
        self.lines(_wrap(style, text, _PAGE_W - _MARGIN - x), style, x)

    def rect(self, x: float, y: float, w: float, h: float, *, fill: float | None) -> None:
        box = f"{_num(x)} {_num(y)} {_num(w)} {_num(h)} re"
        if fill is not None:
            self.pages[-1].append(f"{_num(fill)} g {box} f")
        self.pages[-1].append(f"{_num(_GRID)} G 0.5 w {box} S")


@dataclass(frozen=True, slots=True)
class _Styles:
    title: _Style
    subtitle: _Style
    meta_label: _Style
    meta_value: _Style
    notice: _Style
    heading: _Style
    table_title: _Style
    body: _Style
    note: _Style
    redacted: _Style
    cell: _Style
    cell_head: _Style
    cell_redacted: _Style
    footer: _Style


def _styles(regular: _FontUse, bold: _FontUse) -> _Styles:
    return _Styles(
        title=_Style(bold, 20, 25),
        subtitle=_Style(regular, 11, 15, _GREY),
        meta_label=_Style(bold, 9, 12.5),
        meta_value=_Style(regular, 9, 12.5),
        notice=_Style(regular, 9, 12.5, _GREY),
        heading=_Style(bold, 14, 19),
        table_title=_Style(bold, 10, 14),
        body=_Style(regular, 10, 14),
        note=_Style(regular, 9, 12.5, _GREY),
        redacted=_Style(regular, 10, 14, _GREY, oblique=True),
        cell=_Style(regular, 8, 10.5),
        cell_head=_Style(bold, 8, 10.5),
        cell_redacted=_Style(regular, 8, 10.5, _GREY, oblique=True),
        footer=_Style(regular, 8, 10, _GREY),
    )


_PAD = 3.0


@dataclass(slots=True)
class _RowCell:
    lines: list[str]
    style: _Style
    align_right: bool = False


def _draw_row(layout: _Layout, cells: list[_RowCell], widths: list[float], fill: float | None,
              line_count: int) -> None:
    leading = cells[0].style.leading if cells else 10.5
    height = line_count * leading + 2 * _PAD
    top = layout.y
    x = _MARGIN
    for cell, width in zip(cells, widths, strict=True):
        layout.rect(x, top - height, width, height, fill=fill)
        line_top = top - _PAD
        for line in cell.lines[:line_count]:
            line_x = x + _PAD
            if cell.align_right:
                line_x = x + width - _PAD - cell.style.width(line)
            layout.text(line_x, _baseline(line_top, cell.style), cell.style, line)
            line_top -= leading
        x += width
    layout.y = top - height


def _table(layout: _Layout, table: Table, styles: _Styles) -> None:
    count = max([len(table.columns), *(len(row) for row in table.rows)], default=0)
    if count == 0:
        return
    header = list(table.columns)
    rows = [list(row) + [Cell("")] * (count - len(row)) for row in table.rows]
    widths = fit_columns(
        [_clean(text) for text in header],
        [[_clean(cell.text) for cell in row] for row in rows],
        count,
        _TEXT_W,
        lambda text, head: (styles.cell_head if head else styles.cell).width(text),
        _PAD,
    )
    inner = [width - 2 * _PAD for width in widths]
    leading = styles.cell.leading

    head_cells = (
        [_RowCell(_wrap(styles.cell_head, header[i] if i < len(header) else "", inner[i]),
                  styles.cell_head) for i in range(count)]
        if header else []
    )
    head_lines = max((len(c.lines) for c in head_cells), default=0)
    head_h = head_lines * leading + 2 * _PAD if head_cells else 0.0

    def draw_header() -> None:
        if head_cells:
            _draw_row(layout, head_cells, widths, _HEADER_FILL, head_lines)

    body = []
    for row in rows:
        cells = []
        for i, cell in enumerate(row):
            style = styles.cell_redacted if cell.redacted else styles.cell
            numeric = cell.number is not None and not cell.redacted
            cells.append(_RowCell(_wrap(style, cell.text, inner[i]), style, numeric))
        body.append(cells)

    first_h = (max(len(c.lines) for c in body[0]) * leading + 2 * _PAD) if body else 0.0
    title_h = styles.table_title.leading if table.title else 0.0
    layout.ensure(title_h + head_h + min(first_h, 4 * leading + 2 * _PAD))
    if table.title:
        layout.lines(_wrap(styles.table_title, table.title, _TEXT_W), styles.table_title)
    draw_header()

    page_room = _TOP - _BOTTOM - head_h
    for cells in body:
        while True:
            line_count = max(len(c.lines) for c in cells) or 1
            height = line_count * leading + 2 * _PAD
            if layout.fits(height):
                _draw_row(layout, cells, widths, None, line_count)
                break
            available = int((layout.y - _BOTTOM - 2 * _PAD) // leading)
            if height <= page_room or available < 2:
                layout.new_page()
                draw_header()
                continue
            _draw_row(layout, cells, widths, None, available)
            cells = [_RowCell(c.lines[available:], c.style, c.align_right) for c in cells]
            layout.new_page()
            draw_header()


def _meta(layout: _Layout, meta: tuple[tuple[str, str], ...], styles: _Styles) -> None:
    label_w = min(
        max((styles.meta_label.width(_clean(label)) for label, _ in meta), default=0) + 10,
        _TEXT_W * 0.35,
    )
    for label, value in meta:
        label_lines = _wrap(styles.meta_label, label, label_w - 10)
        value_lines = _wrap(styles.meta_value, value, _TEXT_W - label_w)
        count = max(len(label_lines), len(value_lines))
        layout.ensure(count * styles.meta_value.leading)
        top = layout.y
        for i in range(count):
            line_top = top - i * styles.meta_value.leading
            if i < len(label_lines):
                layout.text(_MARGIN, _baseline(line_top, styles.meta_label), styles.meta_label,
                            label_lines[i])
            if i < len(value_lines):
                layout.text(_MARGIN + label_w, _baseline(line_top, styles.meta_value),
                            styles.meta_value, value_lines[i])
        layout.y = top - count * styles.meta_value.leading


def _block(layout: _Layout, block: Paragraph | Table | BulletList, styles: _Styles) -> None:
    if isinstance(block, Table):
        layout.gap(4)
        _table(layout, block, styles)
        layout.gap(8)
        return
    if isinstance(block, Paragraph):
        style = {"redacted": styles.redacted, "note": styles.note}.get(block.style, styles.body)
        layout.flow(block.text, style)
        layout.gap(5)
        return
    indent = 14.0
    for item in block.items:
        lines = _wrap(styles.body, item, _TEXT_W - indent)
        layout.ensure(styles.body.leading)
        layout.text(_MARGIN + 3, _baseline(layout.y, styles.body), styles.body, "•")
        layout.lines(lines, styles.body, _MARGIN + indent)
        layout.gap(2)
    layout.gap(4)


def _layout(doc: ReportDocument, styles: _Styles, layout: _Layout) -> None:
    layout.flow(doc.title, styles.title)
    if doc.subtitle:
        layout.flow(doc.subtitle, styles.subtitle)
    layout.gap(8)
    if doc.meta:
        _meta(layout, doc.meta, styles)
        layout.gap(8)
    if doc.notice:
        layout.flow(doc.notice, styles.notice)
        layout.gap(6)
    for section in doc.sections:
        layout.gap(10)
        heading = _wrap(styles.heading, section.heading, _TEXT_W)
        layout.ensure(len(heading) * styles.heading.leading + 3 * styles.body.leading)
        layout.lines(heading, styles.heading)
        layout.gap(4)
        for block in section.blocks:
            _block(layout, block, styles)


def _footers(doc: ReportDocument, layout: _Layout, styles: _Styles) -> None:
    total = len(layout.pages)
    label = _PAGE_LABEL.get(doc.locale)
    for index, page in enumerate(layout.pages, start=1):
        text = f"{index} / {total}" if label is None else f"{label} {index} / {total}"
        x = _PAGE_W - _MARGIN - styles.footer.width(text)
        page.append(_text_op(x, _FOOTER_Y, styles.footer, text))


def _utf16_hex(text: str) -> str:
    return text.encode("utf-16-be").hex().upper()


def _to_unicode(used: dict[int, str]) -> bytes:
    entries = [f"<{gid:04X}> <{_utf16_hex(ch)}>" for gid, ch in sorted(used.items())]
    chunks = []
    for start in range(0, len(entries), 100):
        part = entries[start : start + 100]
        chunks.append(f"{len(part)} beginbfchar\n" + "\n".join(part) + "\nendbfchar")
    return (
        "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n"
        "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n"
        "/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n"
        "1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n"
        + "\n".join(chunks)
        + "\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n"
    ).encode("ascii")


def _widths_array(use: _FontUse, gids: list[int]) -> str:
    scale = 1000 / use.font.metrics.units_per_em
    groups: list[tuple[int, list[str]]] = []
    for gid in gids:
        width = _num(use.font.advance(gid) * scale)
        if groups and groups[-1][0] + len(groups[-1][1]) == gid:
            groups[-1][1].append(width)
        else:
            groups.append((gid, [width]))
    return " ".join(f"{start} [{' '.join(values)}]" for start, values in groups)


class _Writer:
    def __init__(self) -> None:
        self.objects: dict[int, bytes] = {}
        self._next = 1

    def reserve(self) -> int:
        number = self._next
        self._next += 1
        return number

    def put(self, number: int, body: str | bytes) -> None:
        self.objects[number] = body.encode("latin-1") if isinstance(body, str) else body

    def add(self, body: str | bytes) -> int:
        number = self.reserve()
        self.put(number, body)
        return number

    def stream(self, data: bytes, extra: str = "") -> bytes:
        packed = zlib.compress(data, 9)
        head = f"<< {extra}/Length {len(packed)} /Filter /FlateDecode >>\nstream\n"
        return head.encode("latin-1") + packed + b"\nendstream"

    def serialize(self, root: int, info: int) -> bytes:
        out = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
        offsets = {}
        for number in sorted(self.objects):
            offsets[number] = len(out)
            out += f"{number} 0 obj\n".encode("latin-1") + self.objects[number] + b"\nendobj\n"
        xref_at = len(out)
        size = self._next
        out += f"xref\n0 {size}\n0000000000 65535 f \n".encode("latin-1")
        for number in range(1, size):
            out += f"{offsets[number]:010d} 00000 n \n".encode("latin-1")
        digest = hashlib.md5(bytes(out), usedforsecurity=False).hexdigest().upper()
        out += (
            f"trailer\n<< /Size {size} /Root {root} 0 R /Info {info} 0 R "
            f"/ID [<{digest}> <{digest}>] >>\nstartxref\n{xref_at}\n%%EOF\n"
        ).encode("latin-1")
        return bytes(out)


def _embed_font(writer: _Writer, use: _FontUse) -> int:
    font = use.font
    gids = sorted(use.used)
    program = font.subset(set(gids))
    digest = hashlib.sha1(use.base_name.encode() + bytes(str(gids), "ascii"),
                          usedforsecurity=False).digest()
    tag = "".join(chr(65 + byte % 26) for byte in digest[:6])
    name = f"{tag}+{use.base_name}"
    metrics = font.metrics
    scale = 1000 / metrics.units_per_em
    bbox = " ".join(_num(v * scale) for v in metrics.bbox)
    file_id = writer.add(writer.stream(program, f"/Length1 {len(program)} "))
    descriptor = writer.add(
        f"<< /Type /FontDescriptor /FontName /{name} /Flags 32 /FontBBox [{bbox}] "
        f"/ItalicAngle {_num(metrics.italic_angle)} /Ascent {_num(metrics.ascent * scale)} "
        f"/Descent {_num(metrics.descent * scale)} /CapHeight {_num(metrics.cap_height * scale)} "
        f"/StemV 80 /FontFile2 {file_id} 0 R >>"
    )
    cid_font = writer.add(
        f"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /{name} "
        "/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> "
        f"/FontDescriptor {descriptor} 0 R /DW 1000 /W [{_widths_array(use, gids)}] "
        "/CIDToGIDMap /Identity >>"
    )
    to_unicode = writer.add(writer.stream(_to_unicode(use.used)))
    return writer.add(
        f"<< /Type /Font /Subtype /Type0 /BaseFont /{name} /Encoding /Identity-H "
        f"/DescendantFonts [{cid_font} 0 R] /ToUnicode {to_unicode} 0 R >>"
    )


def render_pdf(doc: ReportDocument) -> bytes:
    regular = _FontUse(load_font("DejaVuSans.ttf"), "F1", "DejaVuSans")
    bold = _FontUse(load_font("DejaVuSans-Bold.ttf"), "F2", "DejaVuSans-Bold")
    styles = _styles(regular, bold)
    layout = _Layout()
    _layout(doc, styles, layout)
    _footers(doc, layout, styles)

    writer = _Writer()
    catalog, pages_id, info = writer.reserve(), writer.reserve(), writer.reserve()
    fonts = {use.resource: _embed_font(writer, use) for use in (regular, bold) if use.used}
    font_dict = " ".join(f"/{name} {number} 0 R" for name, number in fonts.items())
    kids = []
    for ops in layout.pages:
        content = writer.add(writer.stream("\n".join(ops).encode("latin-1")))
        kids.append(writer.add(
            f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {_num(_PAGE_W)} "
            f"{_num(_PAGE_H)}] /Resources << /Font << {font_dict} >> >> "
            f"/Contents {content} 0 R >>"
        ))
    writer.put(pages_id, f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] "
                         f"/Count {len(kids)} >>")
    writer.put(catalog, f"<< /Type /Catalog /Pages {pages_id} 0 R >>")
    writer.put(info, f"<< /Title <FEFF{_utf16_hex(_clean(doc.title))}> /Producer (LifeOS) >>")
    return writer.serialize(catalog, info)

