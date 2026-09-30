"""XLSX writer: a hand-written OOXML workbook (stdlib ``zipfile`` only).

The workbook is data, never code. No cell ever carries an ``<f>`` formula;
strings are stored inline, and any string a spreadsheet could read as a formula
(leading ``=``, ``+``, ``-``, ``@``, tab or CR) gets a ``quotePrefix`` style so
Excel and LibreOffice keep it literal — the CSV/formula-injection defence for
user-typed text. Real numbers (``Cell.number``) are written as numeric cells so
totals stay usable. All text is XML-escaped and stripped of characters XML 1.0
forbids. Every declared sheet is emitted, in order, even when it has no table.
The zip uses a fixed timestamp so identical documents give identical bytes.
"""

import re
import zipfile
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from app.services.system_review.exports.document import Cell, ReportDocument, Table
from app.services.system_review.exports.labels import PRODUCT_NAME

_ILLEGAL_XML = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]")
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")
_ZIP_DATE = (2000, 1, 1, 0, 0, 0)
_EMPTY_MARK = "—"

# cellXfs indices (see _STYLES).
_S_PLAIN, _S_BOLD, _S_ITALIC, _S_QUOTED, _S_TITLE, _S_QUOTED_BOLD, _S_QUOTED_ITALIC = range(7)

_MIN_WIDTH, _MAX_WIDTH = 8, 60

_STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="11"/><color rgb="FF707070"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill>\
<fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">\
<alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">\
<alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">\
<alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" quotePrefix="1" applyAlignment="1">\
<alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" quotePrefix="1" \
applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" quotePrefix="1" \
applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>
"""

_QUOTED_VARIANT = {_S_PLAIN: _S_QUOTED, _S_BOLD: _S_QUOTED_BOLD, _S_ITALIC: _S_QUOTED_ITALIC}


def _xml_text(text: str) -> str:
    return escape(_ILLEGAL_XML.sub("", text), {'"': "&quot;"})


def _column_letter(index: int) -> str:
    letters = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def _plain_decimal(number: Decimal) -> str:
    if not number.is_finite():
        raise ValueError("non-finite number in export cell")
    text = format(number, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return "0" if text in ("", "-0") else text


class _Sheet:
    def __init__(self) -> None:
        self.rows: list[list[str]] = []
        self.widths: dict[int, int] = {}

    def _measure(self, col: int, text: str) -> None:
        longest = max((len(line) for line in text.split("\n")), default=0)
        self.widths[col] = max(self.widths.get(col, 0), longest)

    def _string(self, ref: str, text: str, style: int) -> str:
        clean = _ILLEGAL_XML.sub("", text)
        if clean.startswith(_FORMULA_START):
            style = _QUOTED_VARIANT.get(style, _S_QUOTED)
        attr = f' s="{style}"' if style else ""
        return (
            f'<c r="{ref}" t="inlineStr"{attr}><is><t xml:space="preserve">'
            f"{_xml_text(clean)}</t></is></c>"
        )

    def add_row(self, values: list[tuple[str, Decimal | None, int]], *, measure: bool = True) -> None:
        index = len(self.rows) + 1
        cells: list[str] = []
        for col, (text, number, style) in enumerate(values):
            ref = f"{_column_letter(col)}{index}"
            if number is not None:
                attr = f' s="{style}"' if style else ""
                cells.append(f'<c r="{ref}" t="n"{attr}><v>{_plain_decimal(number)}</v></c>')
            elif text:
                cells.append(self._string(ref, text, style))
            else:
                continue
            if measure:
                self._measure(col, text)
        self.rows.append(cells)

    def blank(self) -> None:
        self.rows.append([])

    def xml(self) -> str:
        if not any(self.rows):
            self.rows = []
            self.add_row([(_EMPTY_MARK, None, _S_PLAIN)])
        cols = "".join(
            f'<col min="{col + 1}" max="{col + 1}" '
            f'width="{min(_MAX_WIDTH, max(_MIN_WIDTH, width + 2))}" customWidth="1"/>'
            for col, width in sorted(self.widths.items())
        )
        body = "".join(
            f'<row r="{i}">{"".join(cells)}</row>' if cells else f'<row r="{i}"/>'
            for i, cells in enumerate(self.rows, start=1)
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            + (f"<cols>{cols}</cols>" if cols else "")
            + f"<sheetData>{body}</sheetData></worksheet>"
        )


def _cell_entry(cell: Cell) -> tuple[str, Decimal | None, int]:
    if cell.redacted:
        return cell.text, None, _S_ITALIC
    return cell.text, cell.number, _S_PLAIN


def _write_table(sheet: _Sheet, table: Table) -> None:
    if sheet.rows:
        sheet.blank()
    if table.title:
        sheet.add_row([(table.title, None, _S_BOLD)], measure=False)
    if table.columns:
        sheet.add_row([(name, None, _S_BOLD) for name in table.columns])
    for row in table.rows:
        sheet.add_row([_cell_entry(cell) for cell in row])


def _summary_header(sheet: _Sheet, doc: ReportDocument) -> None:
    sheet.add_row([(doc.title, None, _S_TITLE)], measure=False)
    if doc.subtitle:
        sheet.add_row([(doc.subtitle, None, _S_PLAIN)], measure=False)
    if doc.notice:
        sheet.add_row([(doc.notice, None, _S_ITALIC)], measure=False)
    if doc.meta:
        sheet.blank()
        for label, value in doc.meta:
            sheet.add_row([(label, None, _S_BOLD), (value, None, _S_PLAIN)])


def _sheet_name(name: str) -> str:
    return _ILLEGAL_XML.sub("", name)[:31]


def render_xlsx(doc: ReportDocument) -> bytes:
    names = list(doc.sheets) or ["Summary"]
    sheets = {name: _Sheet() for name in names}
    summary = "Summary" if "Summary" in sheets else names[0]
    _summary_header(sheets[summary], doc)
    for section in doc.sections:
        for block in section.blocks:
            if isinstance(block, Table):
                _write_table(sheets.get(block.sheet, sheets[summary]), block)

    sheet_entries = "".join(
        f'<sheet name="{_xml_text(_sheet_name(name))}" sheetId="{i}" r:id="rId{i}"/>'
        for i, name in enumerate(names, start=1)
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<sheets>{sheet_entries}</sheets></workbook>"
    )
    rel_type = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + "".join(
            f'<Relationship Id="rId{i}" Type="{rel_type}/worksheet" '
            f'Target="worksheets/sheet{i}.xml"/>'
            for i in range(1, len(names) + 1)
        )
        + f'<Relationship Id="rId{len(names) + 1}" Type="{rel_type}/styles" '
        'Target="styles.xml"/></Relationships>'
    )
    sheet_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" '
        'ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/'
        'vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/'
        'vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + "".join(
            f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="{sheet_type}"/>'
            for i in range(1, len(names) + 1)
        )
        + '<Override PartName="/docProps/core.xml" '
        'ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/docProps/app.xml" ContentType="application/'
        'vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        "</Types>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'<Relationship Id="rId1" Type="{rel_type}/officeDocument" Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/'
        'relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        f'<Relationship Id="rId3" Type="{rel_type}/extended-properties" '
        'Target="docProps/app.xml"/></Relationships>'
    )
    core = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/'
        'metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">'
        f"<dc:title>{_xml_text(doc.title)}</dc:title><dc:creator>{PRODUCT_NAME}</dc:creator>"
        f"<dc:language>{_xml_text(doc.locale)}</dc:language></cp:coreProperties>"
    )
    app = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/'
        f'extended-properties"><Application>{PRODUCT_NAME}</Application></Properties>'
    )

    parts: list[tuple[str, str]] = [
        ("[Content_Types].xml", content_types),
        ("_rels/.rels", root_rels),
        ("docProps/core.xml", core),
        ("docProps/app.xml", app),
        ("xl/workbook.xml", workbook),
        ("xl/_rels/workbook.xml.rels", workbook_rels),
        ("xl/styles.xml", _STYLES),
    ]
    parts += [
        (f"xl/worksheets/sheet{i}.xml", sheets[name].xml())
        for i, name in enumerate(names, start=1)
    ]
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in parts:
            info = zipfile.ZipInfo(name, date_time=_ZIP_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content.encode("utf-8"))
    return buffer.getvalue()
