"""Leaf: content-proportional table column widths shared by the PDF and DOCX writers.

Both formats lay a report table across a fixed text width, and both used to
starve the one text-heavy column while short columns (dates, amounts, yes/no)
kept space they did not need. The rule here: a column whose longest line fits
its fair share gets exactly that; the remaining columns start at their longest
unbreakable word (bounded) and split what is left by how much text they carry.
Units are whatever ``measure`` returns (points for PDF, twips for DOCX).
"""

from collections.abc import Callable, Sequence

# (text, is_header) → rendered width of that single line.
Measure = Callable[[str, bool], float]


def fit_columns(
    header: Sequence[str],
    rows: Sequence[Sequence[str]],
    count: int,
    total: float,
    measure: Measure,
    pad: float,
) -> list[float]:
    natural: list[float] = []
    minimal: list[float] = []
    demand: list[float] = []
    for col in range(count):
        texts = [(header[col], True)] if col < len(header) else []
        texts += [(row[col], False) for row in rows if col < len(row)]
        nat = shortest = volume = 0.0
        for text, is_header in texts:
            for line in text.split("\n"):
                line_w = measure(line, is_header)
                nat, volume = max(nat, line_w), volume + line_w
                for word in line.split():
                    shortest = max(shortest, measure(word, is_header))
        natural.append(nat + 2 * pad)
        minimal.append(shortest + 2 * pad)
        demand.append(volume / max(len(texts), 1) + 1.0)

    low = [min(max(value, total * 0.056), total * 0.18) for value in minimal]
    high = [min(max(nat, lo), total * 0.5) for nat, lo in zip(natural, low, strict=True)]
    widths = list(high)
    remaining, open_cols = total, set(range(count))
    while open_cols:
        fair = remaining / len(open_cols)
        settled = {col for col in open_cols if high[col] <= fair}
        if not settled:
            break
        remaining -= sum(high[col] for col in settled)
        open_cols -= settled
    while open_cols:
        spare = max(remaining - sum(low[col] for col in open_cols), 0.0)
        share = sum(demand[col] for col in open_cols)
        for col in open_cols:
            widths[col] = low[col] + spare * demand[col] / share
        capped = {col for col in open_cols if widths[col] > high[col]}
        if not capped:
            break
        for col in capped:
            widths[col] = high[col]
        remaining -= sum(high[col] for col in capped)
        open_cols -= capped
    used = sum(widths) or 1.0
    return [width * total / used for width in widths]
