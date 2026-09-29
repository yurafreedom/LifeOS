"""DOCX writer: a hand-written WordprocessingML document (stdlib ``zipfile`` only).

The export must stay an editable, human-readable report — real headings, real
``<w:tbl>`` tables, paragraphs a user can retype — not a dump of the saved JSON.
Styles live in ``word/styles.xml`` (Title, Heading1/2, Normal, a grey "Quiet"
paragraph style and a bordered table style) so the document reads the same in
Word and LibreOffice and can be restyled in one place. User text is XML-escaped,
stripped of characters XML 1.0 forbids, and its newlines become ``<w:br/>``.
Redacted items render in italic grey. The zip uses a fixed timestamp so
identical documents give identical bytes.
"""

import re
import zipfile
from io import BytesIO
from xml.sax.saxutils import escape

from app.services.system_review.exports.columns import fit_columns
from app.services.system_review.exports.document import (
    BulletList,
    Cell,
    Paragraph,
    ReportDocument,
    Table,
)
from app.services.system_review.exports.ttf import load_font

_ILLEGAL_XML = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]")
_ZIP_DATE = (2000, 1, 1, 0, 0, 0)
_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_FONT = (
    '<w:rFonts w:ascii="DejaVu Sans" w:hAnsi="DejaVu Sans" w:cs="DejaVu Sans" '
    'w:eastAsia="DejaVu Sans"/>'
)
_GREY = "6B6B6B"
# A4 portrait in twentieths of a point; 2 cm margins → 9638 twips text width.
_PAGE_W, _PAGE_H, _MARGIN = 11906, 16838, 1134
_TEXT_W = _PAGE_W - 2 * _MARGIN
# Table text is 8 pt (160 twips); cells have 80-twip side margins (ReportTable).
_CELL_TWIPS, _CELL_PAD = 160, 80

_STYLES = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="{_W}">
<w:docDefaults>
<w:rPrDefault><w:rPr>{_FONT}<w:sz w:val="20"/><w:szCs w:val="20"/>\
<w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="264" w:lineRule="auto"/></w:pPr>\
</w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>\
<w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>\
<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>\
<w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/>\
</w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/>\
<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>\
<w:pPr><w:spacing w:after="200"/></w:pPr><w:rPr><w:color w:val="{_GREY}"/>\
<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>\
<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>\
<w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>\
<w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>\
<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>\
<w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>\
<w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quiet"><w:name w:val="Quiet"/>\
<w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="{_GREY}"/>\
<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/>\
<w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/>\
<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>\
</w:pPr><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/>\
<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/>\
<w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/>\
<w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="table" w:styleId="ReportTable"><w:name w:val="Report Table"/>\
<w:basedOn w:val="TableNormal"/><w:tblPr><w:tblBorders>\
<w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>\
<w:left w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>\
<w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>\
<w:right w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>\
<w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>\
<w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/></w:tblBorders>\
<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/>\
<w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>\
</w:style>
</w:styles>
"""


def _xml_text(text: str) -> str:
    return escape(_ILLEGAL_XML.sub("", text), {'"': "&quot;"})


def _runs(text: str, *, bold: bool = False, quiet: bool = False) -> str:
    props = ""
    if bold:
        props += "<w:b/>"
    if quiet:
        props += f'<w:i/><w:color w:val="{_GREY}"/>'
    rpr = f"<w:rPr>{props}</w:rPr>" if props else ""
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    body = "<w:br/>".join(f'<w:t xml:space="preserve">{_xml_text(line)}</w:t>' for line in lines)
    return f"<w:r>{rpr}{body}</w:r>"


def _para(text: str, style: str | None = None, **run_flags: bool) -> str:
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    return f"<w:p>{ppr}{_runs(text, **run_flags)}</w:p>"


def _column_widths(table: Table, count: int) -> list[int]:
    regular, bold = load_font("DejaVuSans.ttf"), load_font("DejaVuSans-Bold.ttf")

    def measure(text: str, head: bool) -> float:
        font = bold if head else regular
        units = sum(font.advance(font.glyph_id(ord(ch))) for ch in text)
        return units * _CELL_TWIPS / font.metrics.units_per_em

    widths = fit_columns(
        table.columns, [[cell.text for cell in row] for row in table.rows],
        count, _TEXT_W, measure, _CELL_PAD,
    )
    return [round(width) for width in widths]


def _table(table: Table) -> str:
    count = max([len(table.columns), *(len(row) for row in table.rows)], default=0)
    if count == 0:
        return ""
    widths = _column_widths(table, count)

    def cell(text: str, width: int, *, bold: bool = False, quiet: bool = False) -> str:
        return (
            f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/></w:tcPr>'
            f"{_para(text, 'TableText', bold=bold, quiet=quiet)}</w:tc>"
        )

    rows = []
    if table.columns:
        header = "".join(
            cell(table.columns[i] if i < len(table.columns) else "", widths[i], bold=True)
            for i in range(count)
        )
        rows.append(
            '<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>'
            f"{header}</w:tr>"
        )
    for row in table.rows:
        padded: list[Cell] = list(row) + [Cell("")] * (count - len(row))
        cells = "".join(
            cell(item.text, widths[i], quiet=item.redacted) for i, item in enumerate(padded)
        )
        rows.append(f"<w:tr><w:trPr><w:cantSplit/></w:trPr>{cells}</w:tr>")
    grid = "".join(f'<w:gridCol w:w="{width}"/>' for width in widths)
    table_xml = (
        '<w:tbl><w:tblPr><w:tblStyle w:val="ReportTable"/>'
        f'<w:tblW w:w="{sum(widths)}" w:type="dxa"/><w:tblLayout w:type="fixed"/>'
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" '
        'w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>'
        f"<w:tblGrid>{grid}</w:tblGrid>{''.join(rows)}</w:tbl>"
    )
    parts = [_para(table.title, "Heading2")] if table.title else []
    # Word requires a paragraph between two adjacent tables and after a trailing one.
    parts += [table_xml, '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>']
    return "".join(parts)


def _block(block: Paragraph | Table | BulletList) -> str:
    if isinstance(block, Paragraph):
        if block.redacted:
            return _para(block.text, quiet=True)
        return _para(block.text, "Quiet" if block.style == "note" else None)
    if isinstance(block, BulletList):
        return "".join(
            '<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>'
            f"<w:r><w:t>•</w:t><w:tab/></w:r>{_runs(item)}</w:p>"
            for item in block.items
        )
    return _table(block)


def _meta_table(meta: tuple[tuple[str, str], ...]) -> str:
    rows = tuple((Cell(label), Cell(value)) for label, value in meta)
    return _table(Table(columns=(), rows=rows))


def _document_xml(doc: ReportDocument) -> str:
    body = [_para(doc.title, "Title")]
    if doc.subtitle:
        body.append(_para(doc.subtitle, "Subtitle"))
    if doc.meta:
        body.append(_meta_table(doc.meta))
    if doc.notice:
        body.append(_para(doc.notice, "Quiet"))
    for section in doc.sections:
        body.append(_para(section.heading, "Heading1"))
        body.extend(_block(block) for block in section.blocks)
    sect = (
        f'<w:sectPr><w:pgSz w:w="{_PAGE_W}" w:h="{_PAGE_H}"/>'
        f'<w:pgMar w:top="{_MARGIN}" w:right="{_MARGIN}" w:bottom="{_MARGIN}" '
        f'w:left="{_MARGIN}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>'
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        f'<w:document xmlns:w="{_W}" xmlns:r="{_R}"><w:body>'
        f"{''.join(body)}{sect}</w:body></w:document>"
    )


def render_docx(doc: ReportDocument) -> bytes:
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" '
        'ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/'
        'vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/'
        'vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        '<Override PartName="/docProps/core.xml" '
        'ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        "</Types>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'<Relationship Id="rId1" Type="{_R}/officeDocument" Target="word/document.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/'
        'relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        "</Relationships>"
    )
    document_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'<Relationship Id="rId1" Type="{_R}/styles" Target="styles.xml"/></Relationships>'
    )
    core = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/'
        'metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">'
        f"<dc:title>{_xml_text(doc.title)}</dc:title><dc:creator>LifeOS</dc:creator>"
        f"<dc:language>{_xml_text(doc.locale)}</dc:language></cp:coreProperties>"
    )
    parts = [
        ("[Content_Types].xml", content_types),
        ("_rels/.rels", root_rels),
        ("docProps/core.xml", core),
        ("word/document.xml", _document_xml(doc)),
        ("word/styles.xml", _STYLES),
        ("word/_rels/document.xml.rels", document_rels),
    ]
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in parts:
            info = zipfile.ZipInfo(name, date_time=_ZIP_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content.encode("utf-8"))
    return buffer.getvalue()
