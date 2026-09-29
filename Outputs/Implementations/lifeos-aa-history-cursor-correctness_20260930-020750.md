# LifeOS — AA history cursor correctness (F3)

Post-Slice-7 narrow correctness fix, landed before Slice 8 retention.
Status: **F3_STATUS=PASS** (merge metadata in §11).

## 1. Starting state

- Start `main` = `origin/main` = `4f19c5ef9e74f42513099ca1ad3fa4938c86364c`. The worktree was clean, with one worktree.
- PR #18 (Add System Review and relationship intelligence) was **MERGED** at 2026-09-29T22:11:38Z. Its head was `c1c86c64702b…` and its merge commit is `4f19c5ef9e74…`.
- The merged remote branch `feat/adaptive-analytics-slice-7-system-review-intelligence` was deleted after proving its tip `c1c86c6` is an ancestor of `origin/main`.
- Recovery stash `51184836ace557fbd9492527bd845329b17b2a76` was retained. Frozen tag `adaptive-analytics-design-accepted` is still at `6c507b829ebc…`.

## 2. F3 source

`/Users/yurasachenko/LifeOS/_parallel_planning/slice8/lifeos-adaptive-analytics-slice-8-retention-reconciled-discovery.md`
records F3 as CONFIRMED_CURRENT: "Actual-history keyset cursor loses `id` tie-break". The provisional
plan recommends it as S8-0, a dedicated correctness PR before Slice 8.

## 3. The defect

`apps/api/app/services/aa_facts.py` `read_history` orders by `(occurred_at ASC, id ASC)`. The cursor it
receives from `routes/aa_history.py` encodes `(occurred_at, id)`. Before the fix, the continuation predicate was:

```python
(AAMeasurement.occurred_at, AAMeasurement.id) > (cursor_occurred_at, cursor_id)
```

That is a **Python** tuple comparison, not a SQL row value. Python compares tuples element by element and
first tests `occurred_at == cursor_occurred_at`. That builds a SQLAlchemy `BinaryExpression`, and its
truthiness is `False` for distinct operand objects. So Python decides that the first elements differ and
returns the first-element comparison alone. Compiled for PostgreSQL:

```
BROKEN: aa_measurements.occurred_at > %(occurred_at_1)s
FIXED:  (aa_measurements.occurred_at, aa_measurements.id) > (%(param_1)s, %(param_2)s::UUID)
```

Suppose a page ends inside a group of rows that share one `occurred_at`. The next page starts strictly
after that instant, so every remaining row in the group is **silently skipped**. Legacy imports hit this
path: every transaction on one date normalizes to the same local midnight.

## 4. Red regressions (before the fix, on `lifeos_test`)

| Test | Shape | Before fix |
|---|---|---|
| `tests/test_aa_measurements.py::test_history_keyset_keeps_the_id_tie_break_for_equal_timestamps` | 5 measurements, 4 at exactly `2026-08-10T00:00Z`, `limit=2` | **FAILED**: 3 of 5 rows returned; the 2 equal-timestamp rows after the page-1 boundary were skipped |
| `tests/test_aa_legacy_import.py::test_legacy_imports_sharing_one_local_date_are_all_reachable_through_history` | 3 legacy snapshot transactions on `2026-08-10` (Europe/Kyiv → one instant), `limit=1` | **FAILED**: 1 of 3 rows returned |

Both tests call the public `GET /api/v1/aa/metrics/{metric}/history` endpoint and paginate until
`next_cursor is None`, with an iteration guard for termination. They assert:

- every id appears exactly once, with no skips and no duplicates;
- the concatenated order equals `(occurred_at ASC, id ASC)`, using the UUID as the tie-break rather than insertion order;
- page 1 ends inside the equal-timestamp group.

## 5. Fix

In `apps/api/app/services/aa_facts.py`, add `tuple_` to the SQLAlchemy import and change the predicate to:

```python
statement = statement.where(
    tuple_(AAMeasurement.occurred_at, AAMeasurement.id)
    > tuple_(cursor_occurred_at, cursor_id)
)
```

This follows the existing precedent in `routes/aa_history.py` (semantic layers). The following are unchanged:

- cursor payload / wire format;
- ordering direction and page size;
- range, `as_of`, subject filter and correction semantics;
- semantic-layer cursors.

After the fix, both regressions and all 17 targeted tests pass.

## 6. Other-cursor audit

| Path | Order | Continuation | Class |
|---|---|---|---|
| `services/aa_facts.py` `read_history` (Actual) | `occurred_at, id` ASC | was Python tuple → now `tuple_ >` | **SAME_BUG → fixed** |
| `routes/aa_history.py` expectation / forecast / baseline layers | `recorded_at DESC, id DESC` | `tuple_(recorded_at, id) < tuple_(…)` | **CORRECT** |
| `analytics/rules/coverage_partial.py:101` | n/a | scalar `elapsed_days > (…)` | **DIFFERENT_CONTRACT** (not a cursor) |

The app has no other keyset cursors. F3 was not broadened.

## 7. Non-changes

- No Alembic migration and no schema/model change. Head/current is `20260930_0008`, and there are still 27 AA tables.
- There are still 4 signal rules, as asserted by the existing catalogue tests.
- No production frontend change, and no dependencies added.
- No Slice 8 retention code, and no System Review, Calendar or Experiment changes.
- No browser QA was needed, since this is a backend predicate only.

## 8. Validation

| Gate | Result |
|---|---|
| targeted `tests/test_aa_measurements.py tests/test_aa_legacy_import.py` | 17 passed (2 red before the fix) |
| `apps/api: python -m pytest` (`lifeos_test`) | **676 passed** (674 → 676) |
| `ruff check .` | All checks passed |
| `python -m compileall app` | clean |
| `alembic heads` / `alembic current` | `20260930_0008 (head)` / `20260930_0008 (head)` |
| `apps/web: npm test` | **522 passed / 41 files** |
| typecheck / lint / build | green |
| `git diff --check` | clean |
| static import cycles | backend 0 (147 modules) / frontend 0 (208 modules) |

## 9. Files

- `apps/api/app/services/aa_facts.py`: the predicate fix.
- `apps/api/tests/test_aa_measurements.py`: equal-timestamp endpoint regression.
- `apps/api/tests/test_aa_legacy_import.py`: legacy same-date regression.
- `LIFEOS_MASTER_CONTEXT.md`: status and NEXT updated.
- This report.

## 10. Safety

No force push, rebase, `reset --hard`, `git clean`, new worktree, stash operation or deploy was used.
The recovery stash was retained and the design tag was not moved.

## 11. PR / merge

- Branch: `fix/aa-history-cursor-tiebreak`
- PR: https://github.com/yurafreedom/LifeOS/pull/19, "Fix AA history cursor tie-break", base `main`
- Merge: normal merge commit (no squash or rebase). The merge SHA is recorded in the session's final machine block.

## 12. Next

Slice 8 retention (Discovery → Plan → Implementation gates). The F3 prerequisite (S8-0) is now satisfied.
