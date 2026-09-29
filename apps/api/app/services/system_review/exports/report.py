"""Build the neutral report document from one saved revision (plan §16).

The document is built from the revision exactly as stored — the frozen context,
its redaction markers and the user's own words — never from live data. A
redacted item reaches every writer only as «источник удалён»; its erased value
does not exist anywhere in the revision to leak.
"""

from decimal import Decimal, InvalidOperation
from typing import Any

from app.models import AASystemReviewRevision
from app.services.system_review.exports.document import (
    BulletList,
    Cell,
    Paragraph,
    ReportDocument,
    Section,
    Table,
)
from app.services.system_review.exports.docx import render_docx
from app.services.system_review.exports.labels import MONTHS, labels, term
from app.services.system_review.exports.markdown import render_markdown
from app.services.system_review.exports.pdf import render_pdf
from app.services.system_review.exports.xlsx import render_xlsx


def _value(value: dict[str, Any] | None) -> Cell:
    if not value:
        return Cell("—")
    kind = value.get("type")
    if kind == "date":
        return Cell(value.get("date") or "—")
    if kind == "categorical":
        return Cell(value.get("text") or "—")
    number = value.get("num")
    try:
        parsed = Decimal(str(number)) if number is not None else None
    except InvalidOperation:
        parsed = None
    if kind == "duration" and parsed is not None:
        days = parsed / Decimal(1440)
        return Cell(f"{days.normalize():f} d", number=days)
    if kind == "scale":
        return Cell(f"{number} / {value.get('scale_min')}–{value.get('scale_max')}", number=parsed)
    unit = value.get("unit_code") or ""
    return Cell(f"{number} {unit}".strip(), number=parsed)


def _text(value: Any) -> str:
    if isinstance(value, dict) and "type" in value:
        return _value(value).text
    return "—" if value is None else str(value)


def _terms(locale: str, codes: list[str]) -> str:
    return "; ".join(term(locale, code) for code in codes) or "—"


def _period_title(period: str, kind: str, locale: str) -> str:
    if kind == "month":
        year, month = period.split("-")
        return f"{MONTHS.get(locale, MONTHS['ru'])[int(month) - 1].capitalize()} {year}"
    return period


def _redacted_row(width: int, text: str) -> tuple[Cell, ...]:
    return (Cell(text, redacted=True),) + tuple(Cell("—") for _ in range(width - 1))


def _changed_rows(items: list[dict], L: dict, locale: str) -> tuple[tuple[Cell, ...], ...]:
    rows = []
    for item in items:
        if item.get("redacted"):
            rows.append(_redacted_row(7, L["redacted"]))
            continue
        delta = item.get("delta") or {}
        basis = item.get("basis") or {}
        rows.append((
            Cell(term(locale, item.get("kind"))),
            Cell(item.get("subject_key") or "—"),
            _value((item.get("current") or {}).get("value")),
            _value((item.get("reference") or {}).get("value")),
            _value(delta.get("value")) if delta.get("state") == "known" else Cell(
                L["unknown"] if delta else "—"),
            Cell(L.get(f"desire.{item.get('desire')}", item.get("desire") or "—")),
            Cell(f"{basis.get('kind')} · {basis.get('direction')}" if basis else "—"),
        ))
    return tuple(rows)


def _impact_rows(analysis: dict, L: dict, locale: str) -> tuple[tuple[Cell, ...], ...]:
    rows = []
    for impact in analysis.get("impacts", []):
        if impact.get("redacted"):
            rows.append(_redacted_row(8, L["redacted"]))
            continue
        inputs = "; ".join(
            f"{entry['name']}={_text(entry['value'])}" for entry in impact.get("inputs", [])
        )
        result = impact.get("result") or {}
        rendered = "; ".join(
            f"{key}={_text(value)}"
            for key, value in result.items()
            if not isinstance(value, dict) or "type" in value
        )
        for key, value in result.items():
            if isinstance(value, dict) and "type" not in value and value:
                rendered += f"; {key}: " + ", ".join(
                    f"{k}={v}" for k, v in value.items() if v is not None
                )
        rows.append((
            Cell(term(locale, impact.get("kind"))),
            Cell(L.get(f"state.{impact.get('state')}", impact.get("state") or "")),
            Cell(inputs or "—"),
            Cell(_terms(locale, impact.get("assumptions", []))),
            Cell((impact.get("calculation") or {}).get("formula") or "—"),
            Cell(rendered or "—"),
            Cell(_terms(locale, impact.get("missing_inputs", []))),
            Cell(_terms(locale, impact.get("limitations", []))),
        ))
    return tuple(rows)


def _relation_rows(items: list[dict], L: dict, locale: str) -> tuple[tuple[Cell, ...], ...]:
    rows = []
    for item in items:
        if item.get("redacted"):
            rows.append(_redacted_row(8, L["redacted"]))
            continue
        def endpoint(side: str) -> str:
            return L["redacted"] if item[side].get("redacted") else item[side]["key"]

        rows.append((
            Cell(endpoint("from"), redacted=item["from"].get("redacted", False)),
            Cell(term(locale, item.get("relation_type"))),
            Cell(endpoint("to"), redacted=item["to"].get("redacted", False)),
            Cell(L.get(f"epistemic.{item.get('epistemic_kind')}", "")),
            Cell(L.get(f"rstatus.{item.get('status')}", item.get("status") or "")),
            Cell(L.get(f"source.{item.get('source')}", item.get("source") or "")),
            Cell(item.get("note") or "—"),
            Cell(item.get("period") or "—"),
        ))
    return tuple(rows)


def _provenance_rows(frozen: dict, L: dict) -> tuple[tuple[Cell, ...], ...]:
    rows: list[tuple[Cell, ...]] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            if value.get("redacted"):
                rows.append((Cell(str(value.get("section") or "")),
                             Cell(str(value.get("ordinal") or "")),
                             Cell(L["redacted"], redacted=True), Cell("—")))
                return
            if "sources" in value and "section" in value:
                for table, identity in value.get("sources", []):
                    rows.append((Cell(str(value.get("section"))),
                                 Cell(str(value.get("ordinal") or "")),
                                 Cell(table), Cell(identity)))
            for key, inner in value.items():
                if key != "sources":
                    visit(inner)
        elif isinstance(value, list):
            for inner in value:
                visit(inner)

    visit(frozen.get("sections", {}))
    return tuple(rows)


def build_report(row: AASystemReviewRevision, locale: str = "ru") -> ReportDocument:
    L = labels(locale)
    frozen = row.frozen_context or {}
    sections = frozen.get("sections", {})
    title_period = _period_title(row.period_key, row.period_kind, locale)
    meta = [
        (L["meta.period"], f"{title_period} ({row.period_key})"),
        (L["meta.kind"], L[f"kind.{row.period_kind}"]),
        (L["meta.revision"], str(row.revision)),
        (L["meta.status"], L[f"status.{row.status}"]),
        (L["meta.saved"], row.created_at.isoformat() if row.created_at else "—"),
        (L["meta.finalized"], row.finalized_at.isoformat() if row.finalized_at else "—"),
        (L["meta.as_of"], row.context_as_of.isoformat()),
        (L["meta.timezone"], row.timezone),
    ]
    if row.redacted_at is not None:
        meta.append((L["meta.redacted"], row.redacted_at.isoformat()))

    changed = sections.get("changed", [])
    improved = sections.get("improved", [])
    repeated = sections.get("repeated", [])
    tradeoffs = sections.get("tradeoffs", [])
    relations = sections.get("relations", [])
    consequences = sections.get("consequences", {}) or {}
    expenses = consequences.get("expenses", [])
    change_columns = (L["col.what"], L["col.subject"], L["col.current"], L["col.reference"],
                      L["col.delta"], L["col.desire"], L["col.basis"])

    summary = Table(
        (L["col.section"], L["col.items"]),
        tuple(
            (Cell(L[f"section.{name}"]), Cell(str(len(items)), number=Decimal(len(items))))
            for name, items in (("changed", changed), ("improved", improved),
                                ("repeated", repeated), ("tradeoffs", tradeoffs),
                                ("consequences", expenses), ("relations", relations))
        ),
        sheet="Summary",
    )
    blocks: list[Section] = [Section(L["section.summary"], (summary,))]

    def table_or_empty(columns, rows, sheet):
        if not rows:
            return (Paragraph(L["empty"], style="note"),)
        return (Table(columns, rows, sheet=sheet),)

    blocks.append(Section(L["section.changed"], table_or_empty(
        change_columns, _changed_rows(changed, L, locale), "Facts")))
    blocks.append(Section(L["section.improved"], table_or_empty(
        change_columns, _changed_rows(improved, L, locale), "Facts")))
    repeated_rows = tuple(
        _redacted_row(3, L["redacted"]) if item.get("redacted") else (
            Cell(item.get("source") or "—"),
            Cell(item.get("subject_key") or item.get("kind") or "—"),
            Cell(", ".join(str(entry.get("window")) for entry in item.get("windows", []))),
        )
        for item in repeated
    )
    blocks.append(Section(L["section.repeated"], table_or_empty(
        (L["col.source"], L["col.what"], L["col.windows"]), repeated_rows, "Facts")))
    tradeoff_rows = tuple(
        _redacted_row(3, L["redacted"]) if item.get("redacted") else (
            Cell(f"{term(locale, item['a'].get('kind'))} · "
                 f"{L.get('desire.' + str(item['a'].get('desire')), '')}"),
            Cell(f"{term(locale, item['b'].get('kind'))} · "
                 f"{L.get('desire.' + str(item['b'].get('desire')), '')}"),
            Cell(L["not_checked"]),
        )
        for item in tradeoffs
    )
    blocks.append(Section(L["section.tradeoffs"], table_or_empty(
        (L["col.a"], L["col.b"], L["col.causality"]), tradeoff_rows, "Facts")))

    consequence_blocks: list[Any] = []
    impact_columns = (L["col.impact"], L["col.state"], L["col.inputs"], L["col.assumptions"],
                      L["col.calculation"], L["col.result"], L["col.missing"],
                      L["col.limitations"])
    for analysis in expenses:
        if analysis.get("redacted"):
            consequence_blocks.append(Paragraph(L["redacted"], style="redacted"))
            continue
        expense = analysis.get("expense", {})
        context = analysis.get("context", {})
        heading = (f"{_value(expense.get('amount')).text} · {expense.get('date')} · "
                   f"{context.get('plannedness') or L['unknown']} · "
                   f"{context.get('funding_source') or L['unknown']}")
        consequence_blocks.append(Table(impact_columns, _impact_rows(analysis, L, locale),
                                        title=heading, sheet="Consequences"))
        details = [f"{key}: {value}" for key, value in context.items()
                   if value not in (None, "") and key != "obligation_entity_id"]
        if details:
            consequence_blocks.append(BulletList(tuple(details)))
    if not consequence_blocks:
        consequence_blocks.append(Paragraph(L["empty"], style="note"))
    blocks.append(Section(L["section.consequences"], tuple(consequence_blocks)))

    position_rows = []
    for entry in consequences.get("position", []):
        if entry.get("redacted"):
            position_rows.append(_redacted_row(3, L["redacted"]))
            continue
        fields = {k: v for k, v in entry.items()
                  if k not in ("sources", "section", "ordinal", "kind", "group", "entity_id",
                               "ref", "version")}
        position_rows.append((Cell(entry.get("group") or ""), Cell(entry.get("label") or "—"),
                              Cell("; ".join(f"{k}={v}" for k, v in fields.items()))))
    if position_rows:
        blocks.append(Section(L["section.position"], (Table(
            (L["col.what"], L["col.field"], L["col.value"]), tuple(position_rows),
            sheet="Consequences"),)))
    priorities = [
        Cell(L["redacted"], redacted=True) if p.get("redacted") else Cell(term(locale, p["kind"]))
        for p in consequences.get("priorities", [])
    ]
    if priorities:
        blocks.append(Section(L["section.priorities"], (Table(
            (L["col.what"],), tuple((cell,) for cell in priorities), sheet="Consequences"),)))
    self_check = consequences.get("self_check")
    if self_check and (self_check.get("redacted") or self_check.get("result")):
        if self_check.get("redacted"):
            check_blocks: tuple[Any, ...] = (Paragraph(L["redacted"], style="redacted"),)
        else:
            result = self_check["result"]
            check_blocks = (
                Paragraph(L["self_check.flag"] if result.get("flag") else L["self_check.no_flag"]),
                Paragraph(L["self_check.rule"], style="note"),
                Table((L["col.question"], L["col.answer"]),
                      tuple((Cell(q), Cell(a)) for q, a in result.get("answers", {}).items()),
                      sheet="User Decisions"),
            )
        blocks.append(Section(L["section.self_check"], check_blocks))

    relation_columns = (L["col.from"], L["col.type"], L["col.to"], L["col.epistemic"],
                        L["col.status"], L["col.source"], L["col.note"], L["col.period"])
    blocks.append(Section(L["section.relations"], table_or_empty(
        relation_columns, _relation_rows(relations, L, locale), "Relations")))

    user_blocks: list[Any] = []
    if row.no_conclusion:
        user_blocks.append(Paragraph(L["user.no_conclusion"]))
    elif row.reflection:
        user_blocks.append(Paragraph(f"{L['user.reflection']}: {row.reflection}"))
    user_rows = []
    if row.reflection:
        user_rows.append((Cell(L["user.reflection"]), Cell(row.reflection)))
    if row.no_conclusion:
        user_rows.append((Cell(L["user.no_conclusion"]), Cell("✓")))
    for label, values in ((L["user.decisions"], row.decisions or []),
                          (L["user.adjustments"], row.adjustments or [])):
        if values:
            user_blocks.append(Paragraph(label))
            user_blocks.append(BulletList(tuple(values)))
            user_rows.extend((Cell(label), Cell(value)) for value in values)
    if not (row.decisions or row.adjustments):
        user_blocks.append(Paragraph(L["user.nothing"], style="note"))
    user_blocks.append(Table((L["col.field"], L["col.value"]), tuple(user_rows) or (
        (Cell(L["user.nothing"]), Cell("—")),), sheet="User Decisions"))
    blocks.append(Section(L["section.user"], tuple(user_blocks)))

    blocks.append(Section(L["section.provenance"], table_or_empty(
        (L["col.section"], L["col.ordinal"], L["col.table"], L["col.id"]),
        _provenance_rows(frozen, L), "Provenance")))

    return ReportDocument(
        title=f"{L['title']} · {title_period}",
        subtitle=f"{L['revision']} {row.revision} · {L[f'status.{row.status}']}",
        meta=tuple(meta),
        notice=L["notice"],
        sections=tuple(blocks),
        locale=locale,
        filename_stem=f"lifeos-system-review-{row.period_key}-r{row.revision}",
    )


FORMATS = {
    "md": (render_markdown, "text/markdown; charset=utf-8"),
    "xlsx": (
        render_xlsx,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    "docx": (
        render_docx,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    "pdf": (render_pdf, "application/pdf"),
}


def export_revision(
    row: AASystemReviewRevision, fmt: str, locale: str = "ru"
) -> tuple[bytes, str, str]:
    """``(content, media_type, filename)`` for one saved revision."""
    render, media_type = FORMATS[fmt]
    document = build_report(row, "uk" if locale == "uk" else "ru")
    return render(document), media_type, f"{document.filename_stem}.{fmt}"
