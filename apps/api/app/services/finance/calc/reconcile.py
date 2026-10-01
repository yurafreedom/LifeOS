"""Reconcile a calculated result with a lender-published schedule.

A lender schedule is a **source-labelled published schedule**: it is neither
unconditional truth nor proof of the current debt. Reconciliation therefore
never rewrites a source row and never chooses a winner. Both schedules are
returned unchanged next to a per-row, per-component difference report.

Matching is by date: an ``installment`` row (amortizing) or a ``payment`` row
(daily accrual) on the lender row's ``due_date``. Components compared are only
those the lender row actually publishes. Tolerance is explicit: the lender
schedule may carry ``tolerance.per_component_minor`` with a reason (e.g. "one
rounding step: the lender rounds interest down"); without it the comparison
is exact. Totals are compared over matched rows and reported with the largest
difference the per-row tolerance could explain.
"""

from __future__ import annotations

import copy
from datetime import date
from typing import Any

from app.services.finance.calc.contracts import ENGINE_VERSION, MAX_EVENTS
from app.services.finance.calc.reader import CanonicalError, input_hash

COMPONENTS = (
    "payment_minor",
    "principal_minor",
    "interest_minor",
    "fees_minor",
    "balance_after_minor",
)
_ROW_KEYS = ("due_date", *COMPONENTS)


def _calculated_components(row: dict[str, Any]) -> dict[str, int]:
    if row["kind"] == "installment":
        return {
            "payment_minor": row["payment_minor"],
            "principal_minor": row["principal_minor"],
            "interest_minor": row["interest_minor"],
            "fees_minor": row["fees_minor"],
            "balance_after_minor": row["closing_principal_minor"],
        }
    allocated = row["allocated_minor"]
    return {
        "payment_minor": row["amount_minor"],
        "principal_minor": allocated["principal"],
        "interest_minor": allocated["interest"],
        "fees_minor": allocated["fees"],
        "balance_after_minor": row["balances_after"]["principal_minor"],
    }


def _validate(schedule: Any) -> tuple[list[dict[str, Any]], int, str | None, list[dict[str, str]]]:
    errors: list[dict[str, str]] = []
    if not isinstance(schedule, dict):
        return [], 0, None, [{"path": "", "code": "object_expected"}]
    rows = schedule.get("rows")
    if not isinstance(rows, list) or not rows or len(rows) > MAX_EVENTS:
        errors.append({"path": "rows", "code": "rows_expected"})
        rows = []
    tolerance, reason = 0, None
    raw_tol = schedule.get("tolerance")
    if raw_tol is not None:
        value = raw_tol.get("per_component_minor") if isinstance(raw_tol, dict) else None
        reason = raw_tol.get("reason") if isinstance(raw_tol, dict) else None
        if type(value) is not int or value < 0 or not isinstance(reason, str) or not reason:
            errors.append({"path": "tolerance", "code": "tolerance_needs_minor_units_and_reason"})
        else:
            tolerance = value
    seen: set[str] = set()
    for index, row in enumerate(rows):
        path = f"rows[{index}]"
        if not isinstance(row, dict):
            errors.append({"path": path, "code": "object_expected"})
            continue
        for key in row:
            if key not in _ROW_KEYS:
                errors.append({"path": f"{path}.{key}", "code": "unknown_field"})
        due = row.get("due_date")
        try:
            date.fromisoformat(due)
        except (TypeError, ValueError):
            errors.append({"path": f"{path}.due_date", "code": "iso_date_expected"})
            continue
        if due in seen:
            errors.append({"path": f"{path}.due_date", "code": "duplicate_due_date"})
        seen.add(due)
        if not any(key in row for key in COMPONENTS):
            errors.append({"path": path, "code": "no_component_published"})
        for key in COMPONENTS:
            if key in row and (type(row[key]) is not int or row[key] < 0):
                errors.append({"path": f"{path}.{key}", "code": "integer_minor_units_expected"})
    return rows, tolerance, reason, errors


def reconcile_schedule(result: dict[str, Any], lender_schedule: Any) -> dict[str, Any]:
    """Compare without modifying either side; both are preserved and no authority is chosen."""
    rows, tolerance, reason, errors = _validate(lender_schedule)
    try:
        lender_hash = input_hash(lender_schedule)
    except CanonicalError as exc:
        lender_hash = None
        errors.append({"path": exc.path, "code": exc.code})
    base = {
        "engine_version": ENGINE_VERSION,
        "calculated_input_hash": result.get("input_hash"),
        "lender_schedule_hash": lender_hash,
        "authority": "none_selected",
        "lender_source": copy.deepcopy(lender_schedule.get("source"))
        if isinstance(lender_schedule, dict)
        else None,
        "tolerance": {
            "per_component_minor": tolerance,
            "basis": reason or "exact comparison (no tolerance supplied)",
        },
    }
    if errors or result.get("status") not in ("complete", "partial"):
        code = "invalid_lender_schedule" if errors else f"calculation_{result.get('status')}"
        return {
            **base,
            "status": "not_comparable",
            "reason": code,
            "errors": errors,
            "rows": [],
            "totals": None,
            "unmatched_lender_rows": [],
            "unmatched_calculated_rows": [],
        }

    calculated: dict[str, list[int]] = {}
    for index, row in enumerate(result["rows"]):
        if row["kind"] in ("installment", "payment"):
            calculated.setdefault(row["date"], []).append(index)
    report = []
    totals = {
        key: {"calculated": 0, "lender": 0} for key in COMPONENTS if key != "balance_after_minor"
    }
    matched_dates: set[str] = set()
    unmatched_lender = []
    worst = "match"
    for index, lender_row in enumerate(rows):
        due = lender_row["due_date"]
        indexes = calculated.get(due, [])
        if len(indexes) != 1:
            unmatched_lender.append(
                {
                    "lender_row": index,
                    "due_date": due,
                    "reason": "no_calculated_row" if not indexes else "ambiguous",
                }
            )
            worst = "mismatch"
            continue
        matched_dates.add(due)
        calc = _calculated_components(result["rows"][indexes[0]])
        diffs = {}
        status = "match"
        for key in COMPONENTS:
            if key not in lender_row:
                continue
            diff = calc[key] - lender_row[key]
            within = abs(diff) <= tolerance
            diffs[key] = {
                "calculated": calc[key],
                "lender": lender_row[key],
                "difference": diff,
                "within_tolerance": within,
            }
            if diff and within and status == "match":
                status = "within_tolerance"
            if not within:
                status = "mismatch"
            if key in totals:
                totals[key]["calculated"] += calc[key]
                totals[key]["lender"] += lender_row[key]
        if status == "mismatch" or (status == "within_tolerance" and worst == "match"):
            worst = status
        report.append(
            {
                "lender_row": index,
                "calculated_row": indexes[0],
                "due_date": due,
                "status": status,
                "components": diffs,
            }
        )
    explainable = tolerance * len(report)
    for key, value in totals.items():
        value["difference"] = value["calculated"] - value["lender"]
        value["max_explained_by_tolerance"] = explainable
    unmatched_calculated = [
        {"calculated_row": index, "due_date": day}
        for day, indexes in calculated.items()
        if day not in matched_dates
        for index in indexes
    ]
    if unmatched_calculated:
        worst = "mismatch"
    return {
        **base,
        "status": worst,
        "rows": report,
        "totals": totals,
        "unmatched_lender_rows": unmatched_lender,
        "unmatched_calculated_rows": unmatched_calculated,
        # Both inputs are preserved as given: the lender rows verbatim, the calculated
        # result by its input hash. Neither replaces the other.
        "lender_rows": copy.deepcopy(rows),
    }


def payments_from_lender_schedule(
    lender_schedule: dict[str, Any], *, basis: str
) -> list[dict[str, Any]]:
    """Published payment amounts as ``daily_accrual`` input payments (kind ``regular``).

    The schedule is not modified; rows without a published payment are refused.
    """
    if basis not in ("actual", "planned"):
        raise ValueError("basis must be actual or planned")
    result = []
    for index, row in enumerate(lender_schedule["rows"]):
        amount = row.get("payment_minor")
        if type(amount) is not int or amount <= 0:
            raise ValueError(f"rows[{index}].payment_minor is required")
        result.append(
            {"date": row["due_date"], "amount_minor": amount, "kind": "regular", "basis": basis}
        )
    return result
