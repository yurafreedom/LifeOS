"""Facade of the JENKIN deterministic loan calculation engine (L2).

Import only from here. The engine is pure: no database, HTTP, UI, files,
network or clock. Inputs are versioned JSON-compatible documents and are never
modified; results are new JSON-compatible dicts carrying the engine version and
a canonical input hash. Specification and rule catalogue:
``Outputs/Plans/jenkin-loan-engine-l2-spec_20261001-163647.md``.
"""

from app.services.finance.calc.contracts import ENGINE_VERSION, SCHEMA_VERSION
from app.services.finance.calc.engine import calculate
from app.services.finance.calc.reader import input_hash

__all__ = [
    "ENGINE_VERSION",
    "SCHEMA_VERSION",
    "calculate",
    "input_hash",
]
