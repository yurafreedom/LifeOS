"""Effective-dated term versions (amendments) for ``daily_accrual`` loans.

A versions document lists complete daily-accrual inputs, each with
``effective_from``. Version *k* covers ``[effective_from_k, effective_from_k+1)``.
Nothing is rewritten: each version is calculated as its own result with its
own input hash, and an earlier result stays exactly as it was.

Rules (all enforced, none defaulted):
* ``effective_from`` strictly increases; equal or decreasing dates are an
  ambiguous overlap and are rejected;
* version 1 opens on its ``effective_from``; every later version opens on the
  day before its ``effective_from`` and accrues from the day after opening, so
  no day accrues twice and the boundary day belongs to the new version;
* a later version's opening is either explicit (``observed`` or ``projected``
  with every balance stated) or ``{"basis": "projected_from_previous"}``, which
  carries the previous version's calculated closing balances, labelled projected;
* fees and payments of a version must fall inside its range;
* only the last version states a horizon; earlier ones end the day before the
  next version (a version boundary is a posting point).

Amendments of ``amortizing`` and ``revolving`` inputs are not supported in L2.
"""

from __future__ import annotations

import copy
from collections.abc import Mapping
from datetime import date
from typing import Any

from app.services.finance.calc.contracts import (
    COMPLETE,
    ENGINE_VERSION,
    INVALID,
    MAX_VERSIONS,
    PARTIAL,
    PROJECTED_FROM_PREVIOUS,
    SCHEMA_VERSION,
    UNSUPPORTED,
)
from app.services.finance.calc.engine import calculate
from app.services.finance.calc.numbers import ONE_DAY
from app.services.finance.calc.reader import CanonicalError, input_hash


def _fail(
    digest: str | None,
    status: str,
    errors: list[dict[str, Any]],
    unsupported: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "schema_version": SCHEMA_VERSION,
        "input_hash": digest,
        "status": status,
        "errors": errors,
        "unsupported": unsupported or [],
        "segments": [],
        "boundaries": [],
        "closing": None,
        "balance_nature": "calculated_not_lender_statement",
    }


def _day(value: Any) -> date | None:
    try:
        return date.fromisoformat(value) if isinstance(value, str) and len(value) == 10 else None
    except ValueError:
        return None


def _event_dates(doc: Mapping[str, Any]) -> list[tuple[str, date | None]]:
    found: list[tuple[str, date | None]] = []
    for index, payment in enumerate(doc.get("payments") or []):
        if isinstance(payment, dict):
            found.append((f"payments[{index}]", _day(payment.get("date"))))
    for index, fee in enumerate(doc.get("fees") or []):
        if isinstance(fee, dict):
            schedule = fee.get("schedule") if isinstance(fee.get("schedule"), dict) else {}
            found.append((f"fees[{index}]", _day(fee.get("date") or schedule.get("first_date"))))
            if schedule.get("until") not in (None, "loan_closure"):
                found.append((f"fees[{index}].schedule.until", _day(schedule.get("until"))))
    return found


def calculate_versions(document: Mapping[str, Any]) -> dict[str, Any]:
    try:
        digest = input_hash(document)
    except CanonicalError as exc:
        return _fail(None, INVALID, [{"path": exc.path, "code": exc.code}])
    errors: list[dict[str, Any]] = []
    if document.get("schema_version") != SCHEMA_VERSION:
        errors.append({"path": "schema_version", "code": "unsupported_schema_version"})
    versions = document.get("versions")
    if not isinstance(versions, list) or not versions or len(versions) > MAX_VERSIONS:
        return _fail(digest, INVALID, [*errors, {"path": "versions", "code": "versions_expected"}])
    starts: list[date] = []
    for index, version in enumerate(versions):
        path = f"versions[{index}]"
        if not isinstance(version, dict) or not isinstance(version.get("input"), dict):
            errors.append({"path": path, "code": "version_needs_effective_from_and_input"})
            continue
        start = _day(version.get("effective_from"))
        if start is None:
            errors.append({"path": f"{path}.effective_from", "code": "iso_date_expected"})
            continue
        if starts and start <= starts[-1]:
            errors.append({"path": f"{path}.effective_from", "code": "ambiguous_version_overlap"})
        starts.append(start)
        if version["input"].get("model") != "daily_accrual":
            return _fail(
                digest,
                UNSUPPORTED,
                errors,
                [
                    {
                        "path": f"{path}.input.model",
                        "code": "amendments_for_model",
                        "value": version["input"].get("model"),
                    }
                ],
            )
    if errors or len(starts) != len(versions):
        return _fail(digest, INVALID, errors)

    segments: list[dict[str, Any]] = []
    boundaries: list[dict[str, Any]] = []
    status = COMPLETE
    for index, version in enumerate(versions):
        path = f"versions[{index}]"
        start = starts[index]
        last = index == len(versions) - 1
        end = None if last else starts[index + 1] - ONE_DAY
        doc = copy.deepcopy(version["input"])
        opening = doc.get("opening") if isinstance(doc.get("opening"), dict) else {}
        accrual = doc.get("accrual") if isinstance(doc.get("accrual"), dict) else {}
        if index == 0:
            if _day(opening.get("date")) != start:
                errors.append(
                    {
                        "path": f"{path}.input.opening.date",
                        "code": "first_version_opens_on_effective_date",
                    }
                )
        else:
            if accrual.get("first_day") != "day_after_opening":
                errors.append(
                    {
                        "path": f"{path}.input.accrual.first_day",
                        "code": "later_versions_accrue_from_day_after_opening",
                    }
                )
            if opening == {"basis": PROJECTED_FROM_PREVIOUS}:
                closing = segments[-1]["closing"]
                doc["opening"] = {
                    "date": (start - ONE_DAY).isoformat(),
                    "basis": "projected",
                    "principal_minor": closing["principal_minor"],
                    "interest_due_minor": closing["interest_due_minor"],
                    "fees_due_minor": closing["fees_due_minor"],
                }
            elif opening.get("basis") in ("observed", "projected"):
                if _day(opening.get("date")) != start - ONE_DAY:
                    errors.append(
                        {
                            "path": f"{path}.input.opening.date",
                            "code": "opening_must_be_day_before_effective_from",
                        }
                    )
            else:
                errors.append(
                    {"path": f"{path}.input.opening", "code": "later_version_opening_basis"}
                )
        if last:
            if not isinstance(doc.get("horizon"), dict):
                errors.append(
                    {"path": f"{path}.input.horizon", "code": "last_version_needs_horizon"}
                )
        else:
            if "horizon" in doc:
                errors.append(
                    {"path": f"{path}.input.horizon", "code": "only_last_version_has_horizon"}
                )
            doc["horizon"] = {"end_date": end.isoformat()}
        for event_path, day in _event_dates(doc):
            if day is not None and (day < start or (end is not None and day > end)):
                errors.append(
                    {"path": f"{path}.input.{event_path}", "code": "event_outside_version_range"}
                )
        if errors:
            return _fail(digest, INVALID, errors)
        result = calculate(doc)
        boundaries.append(
            {
                "version": index,
                "effective_from": start.isoformat(),
                "opening_basis": doc["opening"].get("basis"),
                "opening_from_previous": opening == {"basis": PROJECTED_FROM_PREVIOUS},
                "input_hash": result["input_hash"],
            }
        )
        segments.append(result)
        if result["status"] in (INVALID, UNSUPPORTED):
            return {
                **_fail(digest, result["status"], result["errors"], result["unsupported"]),
                "segments": segments,
                "boundaries": boundaries,
            }
        if result["status"] == PARTIAL:
            status = PARTIAL
    return {
        "engine_version": ENGINE_VERSION,
        "schema_version": SCHEMA_VERSION,
        "input_hash": digest,
        "status": status,
        "errors": [],
        "unsupported": [],
        "segments": segments,
        "boundaries": boundaries,
        "closing": segments[-1]["closing"],
        "balance_nature": "calculated_not_lender_statement",
    }
