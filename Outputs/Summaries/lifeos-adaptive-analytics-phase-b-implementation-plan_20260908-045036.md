# Adaptive Analytics — Phase B Implementation Plan · Summary

**2026-09-08 04:50:36** · mode `PLAN_ONLY` · **revised with architecture corrections C5–C8**
Full plan → `Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md`

```
PHASE_B_PLAN_STATUS=COMPLETE
BRANCH=design/adaptive-analytics-import
HEAD=f6e27f3060a735458735e8acbdce8abc5f2bb0f0
DESIGN_TAG=adaptive-analytics-design-accepted → d496028 (annotated, unmoved)
DISCOVERY=both artifacts present · DISCOVERY_CODE_DRIFT=NONE
TARGET_ARCHITECTURE=Option D hybrid (unchanged)
OWNER_DECISIONS=D1..D5 resolved · NEW_OWNER_DECISIONS=0
CORRECTIONS=C5 missing-model · C6 coverage-evidence · C7 versioned-inclusion · C8 rollback
MIGRATION_GRAPH=8 (unchanged) · NEW_SUPPORT_TABLES=3 · REGRESSION_TESTS=20
IMPLEMENTATION_READY=YES
PRE_0_READY=YES · SLICE_0_READY=YES · SLICE_0B_READY=YES · SLICE_1_READY=YES
APPLICATION_CODE_CHANGED=NO · DB_CHANGED=NO · MIGRATIONS_CREATED=NO
DEPENDENCIES_INSTALLED=NO · COMMIT=NO · PUSH=NO · DEPLOY=NO
```

## Verdict

The frozen A–J contract, the Discovery, the accepted Option D architecture, five resolved owner decisions, four post-Discovery corrections (C1–C4) and four post-plan architecture corrections (**C5–C8**) are turned into **12 execution units, 8 additive migrations, 3 metrics, 4 signal rules, ~104 concrete file paths and 20 permanent regression tests**. No new owner decisions are raised.

The migration graph stays at **8**: the three new support tables were absorbed into existing boundaries (`aa_source_coverage` → M1, the two C7 tables → M3). No slice was reordered.

Nothing existing is modified structurally: `user_snapshots`, its CAS `revision`, the 5 MiB cap, `StateSyncCoordinator` and `schema_version = 2` are all untouched. Every AA table is additive and invisible to an old client.

## Post-plan corrections C5–C8 (§34 of the plan)

| # | Defect | Correction |
| --- | --- | --- |
| **C5** | `value_type='unknown'` was called "how missing is stored", conflating three states and inviting synthetic rows | `value_type` has **no `unknown`**. Missing = **no row**. Explicit unknown = a concept-specific column only where meaningful (`aa_targets.is_explicitly_absent`, adherence `state='unknown'`, `epistemic_kind='unknown'`, `aa_observations.value_availability`). Derived unknown/no-data = a response state, never persisted |
| **C6** | Finance coverage inferred from transaction presence — a zero-transaction day may be fully observed, a one-transaction day may be partly covered | New **`aa_source_coverage`** (M1): source, scope, local window, `coverage_state`, `completeness_known`, timezone, provenance, supersession. A day is `observed` only with evidence; absent evidence is `unknown_coverage`. Manual-only data never claims completeness. New invariant: `observed + partial + missing + unknown_coverage + future == denominator` |
| **C7** | `finance.monthly_spend` honoured *current* `included_in_totals`/`categoryOverrides`, so a December toggle would silently rewrite August | **Hybrid** (chosen over A or B alone): versioned **`aa_metric_policy_versions`** (category intent) + sparse **`aa_metric_membership_overrides`** (per-fact) + **immutable `dimensions`** captured on the measurement. `include(fact,T)` resolves as-of T from AA tables only. Legacy policy captured at import with `effective_from` = ingestion, never backdated; earlier windows report `policy_known = false` |
| **C8** | Two contradictory claims: "rollback = `DROP TABLE`" *and* "data survives rollback" | New **§22.1**: pre-write → schema downgrade permitted; **after AA history exists → rollback is non-destructive** (disable flag, roll back behaviour, keep schema and data). Destructive downgrade then needs a separately authorized data-preserving procedure. Also: "No existing table is modified" → "**No PRE-AA existing table is modified**" |

New tests: **T-18** historical monthly spend reproducible after a later inclusion-policy change · **T-19** coverage never inferred from fact presence · **T-20** derivation never reads snapshot policy. **T-05** rewritten: missing never becomes zero **and no synthetic unknown Measurement is created** because an expected observation is absent.

Everything previously settled is preserved: Option D, D1–D5, Review R2, the signal episode/fingerprint split, the IndexedDB queue, account-level export/delete, Slice P, no `activityLog` backfill, no snapshot `schema_version` bump, no global score, Expectation ≠ Target, Actual ≠ Forecast. `missing ≠ zero` and `no silent history loss` are both **strengthened**.

## The four original decisions carrying the most structural weight

1. **Review context is normalized (`aa_review_context_items`), not a JSONB blob.** D1 requires selective erasure from historical reviews. With a blob, redaction is a read-modify-write that must understand every JSON shape ever written; with rows it is one indexed `UPDATE … WHERE source_fact_id = :id`, plus a CHECK making "redacted but value present" unrepresentable. R2 wins decisively on erasure, correction display, export and testability.
2. **Signal identity splits in two** — a rule-defined `episode_key` and an `input_fingerprint`. The Discovery's single global hash would have respawned a dismissed 90 % budget signal on every subsequent transaction. Worked examples cover all four required cases (finance threshold band, project forecast version, staleness period, coverage window).
3. **Value typing is enforced by CHECK constraints.** `value_type` discriminates required columns per type, so a stored fact always carries a real value, and no numeric type spans units — a global score has nowhere to live. (Revised by C5: missing is the absence of a row, not a stored `unknown`.)
4. **Enums are `TEXT + CHECK`, not native PostgreSQL enums.** D4 already adds `ABANDONED`; a CHECK swaps inside an ordinary transactional migration, `ALTER TYPE … ADD VALUE` does not.

## Other high-value decisions

- **Legacy import (C1):** `recorded_at` is NOT NULL and means *when AA ingested it*; uncertainty is carried by `original_recorded_at_known = false` + `method = 'LEGACY_IMPORT'`, enforced by a CHECK. Only `transactions[]` is imported, as facts. No Expectation/Forecast/Target/Baseline backfill; `activityLog` untouched (D3).
- **Export/delete are account-level (C3):** `GET /api/v1/export`, `DELETE /api/v1/account`. AA owns only per-fact deletion. A registry-completeness test fails if any `aa_*` table falls out of export.
- **Slice 0b is a hard gate:** after Slice 0 and before 0b, AA writes exist only behind `LIFEOS_AA_WRITE_ENABLED` (off outside test). No user-facing history accumulates before erasure exists.
- **`finance.monthly_spend` is `actual_source = derived`,** summing active transaction measurements whose **as-of-T inclusion** resolves to included (C7). Correcting a transaction supersedes its measurement, so the month counts the corrected value once with no stored aggregate to invalidate — and correction stays distinct from an inclusion change.
- **Subject reference = generic typed triple** — Finance is period-scoped and Project will live in snapshot JSONB, so neither can be an enforceable FK target; every index leads with `user_id`, making cross-account resolution impossible.
- **Coverage invariant (C6):** `observed + partial + missing + unknown_coverage + future == denominator`. Finance August = 28 observed (backed by the import's coverage claim) + 3 future = 31. A manual-only August with no claim reports 28 `unknown_coverage`, never «0 / 31». A running experiment reports kept/**elapsed** (6/9 of a 21-day window), never 6/21.
- **Two write paths, no coupling:** a snapshot 409 must not pause the AA queue (permanent test T-12). The offline queue generates its idempotency key **at enqueue**, which is what makes replay-exactly-once structurally true.
- **Slice P is a real prerequisite:** Project current state lives in `payload.projects[]` (additive, no `schema_version` bump); forecasts and completion are AA facts. The completion Actual is a Measurement, never a forecast version.
- **`fake-indexeddb` is the only new dependency** in the whole plan — dev-only. `vite.config.js` sets `test.environment = 'node'`, so the queue must take its `IDBFactory` by injection.
- **`conftest.clean_database` TRUNCATEs a hardcoded table list** — every migration must extend it, guarded by a metadata-introspection test (risk R1).

## Slice sequence

```
PRE-0 dev baseline → 0 history foundation → 0b export+delete (hard gate)
   → 1 semantic contracts + primitives
   → 2 Finance pilot ─┬→ 3 Signals+Home → 4 Review ─┬→ 5 Project analytics
     (P runs parallel)─┘                            └→ 6 Experiment
                                                        → 7 Trade-off + System Review
                                                        → 8 Retention / legacy / hardening
```

Parallel-safe: **P** alongside 2/3; **5** and **6** after 4 + P.

## New owner decisions

**None.** Every remaining question was decidable from repository evidence and is decided in the plan.

## Recommended first implementation prompt

> Execute **PRE-0 · Development Baseline** from
> `Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` §23.
> Install backend deps from `apps/api/requirements-dev.lock` into `apps/api/.venv` and frontend deps via `npm ci` in `apps/web`. Create a PostgreSQL database whose name ends in `_test`, export `LIFEOS_TEST_DATABASE_URL`, then run `python -m pytest` and `ruff check .` in `apps/api`, and `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` in `apps/web`.
> Record versions and pass/fail counts, classify every failure as environmental / pre-existing / blocking, and write the baseline report to `Outputs/Reports/`.
> **Change no application code and create no migrations.** If anything is blocking, stop and report — Slice 0 must not begin against an unexplained red baseline.
