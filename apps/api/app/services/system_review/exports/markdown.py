"""Markdown writer: a GFM rendering of the neutral report model.

User-typed text reaches this writer verbatim, so every string is escaped before
it lands in the output: a ``|`` cannot break a table row, a newline cannot end a
cell, and a leading ``#``/``>``/``-``/``+``/``*`` cannot turn a sentence into a
heading, quote or list. Backticks are escaped so no text becomes code. Output is
a pure function of the document — no timestamps — so the same revision always
exports to the same bytes.
"""

import re

from app.services.system_review.exports.document import (
    BulletList,
    Cell,
    Paragraph,
    ReportDocument,
    Table,
)

_LEADING_MARKER = re.compile(r"^(\s*)([#>\-+*])")
_ORDERED_MARKER = re.compile(r"^(\s*\d+)([.)])")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _clean(text: str) -> str:
    return _CONTROL.sub("", text.replace("\r\n", "\n").replace("\r", "\n"))


def _inline(text: str) -> str:
    text = _clean(text).replace("\\", "\\\\").replace("`", "\\`")
    for char in "*_[]<>":
        text = text.replace(char, "\\" + char)
    return text


def _line(text: str) -> str:
    """Escape one line of flowing text, including a structure-forming first char."""
    text = _inline(text)
    text = _LEADING_MARKER.sub(lambda m: m.group(1) + "\\" + m.group(2), text)
    return _ORDERED_MARKER.sub(lambda m: m.group(1) + "\\" + m.group(2), text)


def _block_text(text: str) -> str:
    return "\n".join(_line(part) for part in _clean(text).split("\n"))


def _cell(text: str) -> str:
    lines = [_inline(part).replace("|", "\\|").strip() for part in _clean(text).split("\n")]
    return "<br>".join(lines)


def _cell_value(cell: Cell) -> str:
    value = _cell(cell.text)
    return f"_{value}_" if cell.redacted and value else value


def _table(header: tuple[str, ...], rows: list[list[str]]) -> list[str]:
    width = max([len(header), *(len(row) for row in rows)]) if header or rows else 0
    if width == 0:
        return []
    padded_header = [_cell(text) for text in header] + [""] * (width - len(header))
    lines = [
        "| " + " | ".join(padded_header) + " |",
        "|" + "|".join(["---"] * width) + "|",
    ]
    for row in rows:
        lines.append("| " + " | ".join(row + [""] * (width - len(row))) + " |")
    return lines


def _paragraph(block: Paragraph) -> list[str]:
    body = _block_text(block.text).strip()
    if not body:
        return []
    if block.redacted:
        return ["_" + body.replace("\n", "_\n_") + "_"]
    if block.style == "note":
        return ["> " + line if line else ">" for line in body.split("\n")]
    return body.split("\n")


def _render_block(block: Paragraph | Table | BulletList) -> list[str]:
    if isinstance(block, Paragraph):
        return _paragraph(block)
    if isinstance(block, BulletList):
        return [
            "- " + _block_text(item).strip().replace("\n", "\n  ")
            for item in block.items
        ]
    lines: list[str] = []
    if block.title:
        lines += [f"### {_inline(block.title).strip()}", ""]
    rows = [[_cell_value(cell) for cell in row] for row in block.rows]
    lines += _table(block.columns, rows)
    return lines


def render_markdown(doc: ReportDocument) -> bytes:
    out: list[list[str]] = [[f"# {_inline(doc.title).strip()}"]]
    if doc.subtitle:
        out.append([_block_text(doc.subtitle)])
    if doc.meta:
        out.append(_table(("", ""), [[_cell(label), _cell(value)] for label, value in doc.meta]))
    if doc.notice:
        out.append(["> " + line if line else ">" for line in _block_text(doc.notice).split("\n")])
    for section in doc.sections:
        out.append([f"## {_inline(section.heading).strip()}"])
        for block in section.blocks:
            lines = _render_block(block)
            if lines:
                out.append(lines)
    text = "\n\n".join("\n".join(chunk) for chunk in out if chunk) + "\n"
    return text.encode("utf-8")
