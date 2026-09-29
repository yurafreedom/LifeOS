"""Leaf: the neutral report model every export writer renders.

The model is built once from a saved revision (``report.py``); the writers only
lay it out. Redaction therefore happens in exactly one place: a redacted item
reaches every format as a ``Cell``/``Paragraph`` with ``redacted=True`` and the
localized «источник удалён» text — no writer ever sees the erased value.

Cells carry an optional typed number so the XLSX writer can store real numbers;
every other writer uses ``text``. User-typed strings arrive unmodified; each
writer is responsible for escaping them for its own format (and XLSX for the
formula-injection defence).
"""

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class Cell:
    text: str
    number: Decimal | None = None
    redacted: bool = False


@dataclass(frozen=True, slots=True)
class Table:
    columns: tuple[str, ...]
    rows: tuple[tuple[Cell, ...], ...]
    title: str | None = None
    # XLSX sheet this table belongs to (one of ReportDocument.sheets).
    sheet: str = "Summary"


@dataclass(frozen=True, slots=True)
class Paragraph:
    text: str
    # body · note (quiet, e.g. "not a verdict") · redacted («источник удалён»)
    style: str = "body"

    @property
    def redacted(self) -> bool:
        return self.style == "redacted"


@dataclass(frozen=True, slots=True)
class BulletList:
    items: tuple[str, ...]


Block = Paragraph | Table | BulletList


@dataclass(frozen=True, slots=True)
class Section:
    heading: str
    blocks: tuple[Block, ...] = ()


@dataclass(frozen=True, slots=True)
class ReportDocument:
    title: str
    subtitle: str
    meta: tuple[tuple[str, str], ...]
    notice: str
    sections: tuple[Section, ...]
    locale: str = "ru"
    filename_stem: str = "lifeos-system-review"
    # Stable XLSX sheet order; every Table.sheet is one of these.
    sheets: tuple[str, ...] = field(
        default=("Summary", "Facts", "Relations", "Consequences", "User Decisions", "Provenance")
    )
