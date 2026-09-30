# LifeOS · Adaptive Analytics · Slice 8 · Retention / Legacy / Hardening — Implementation Report

Status: **implemented and validated on `feat/adaptive-analytics-slice-8-retention`**.
No deploy. Normal merge-commit PR.

## 1. Start state and sources

| Item | Value |
|---|---|
| Start `main` / `origin/main` | `b8d129e87f48217eac6eda39d1b208a1b047cdfc` (PR #19 merge) |
| PR #19 | MERGED 2026-09-29T23:09:11Z, head `0239f922…`, merge commit `b8d129e8…` — **F3 present** |
| Checkout | canonical, clean, exactly one worktree |
| Recovery stash | `51184836ace557fbd9492527bd845329b17b2a76` (stash@{0}) retained |
| Frozen tag | `adaptive-analytics-design-accepted` → `6c507b82…` unmoved |
| Owner decisions | O1–O4 closed in the Slice 8 master prompt; `OWNER_DECISIONS_OPEN=0` |
| Read in full | `AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md`, `module-boundaries.md`, Slice 7 and F3 reports, the four `_parallel_planning/slice8/` artifacts, and the code seams cited in the reconciliation |
| Reconciliation | `Outputs/Discoveries/lifeos-adaptive-analytics-slice-8-final-reconciliation_20260930-030431.md` |
| Final Plan | `Outputs/Plans/lifeos-adaptive-analytics-slice-8-retention-final-plan_20260930-030431.md` (committed before any production code; `PLAN_STATUS=FINAL`, `SAFE_DELETION_ORDER_FINAL=YES`, `ALL_CURRENT_AA_TABLES_CLASSIFIED=YES`, `F6_REHYDRATION_PLAN=DEFINED`) |

## 2. Baseline (before any production change)

Backend on `lifeos_test` with `LIFEOS_TEST_DATABASE_URL` set (DB tests really ran):
**676 passed**, ruff clean, compileall clean, Alembic head/current `20260930_0008`, 27 AA tables,
4 signal rules. Frontend **522 passed / 41 files**, typecheck / lint / build / build --manifest
clean, entry JS 321.10 kB.

## 3. Commits

| SHA | Commit |
|---|---|
| `42d0ad5` | docs: final reconciliation + FINAL Plan |
| `6aa105d` | M8 schema (policies, runs, CHECK widening, registries, pins 27 → 29) |
| `25503a1` | truthful retention-truncated read contracts (no deletion) |
| `203c976` | policy, eligibility and set-based redaction primitives |
| `b42df45` | F6 legacy anti-resurrection guard; finance 415-before-422 |
| `6bf67d2` | atomic preview/apply engine, API, destructive + API + redaction tests, perf harness |
| `2ba5c41` | perf: evidence-backed indexes for set deletes |
| `e8a2cc1` | Settings retention section + truncated read copy (RU/UK) |
| (this) | report, module boundaries, master context, test-seed shape fix |

Deviation from the suggested order: M8 landed before the read contracts, because the
effective horizon those contracts disclose is read from `aa_retention_runs`. No read contract
depended on deletion; they were pinned (8 tests) before any deletion code existed.

## 4. F1–F6

| # | Result |
|---|---|
| F1 chains | retention never calls `delete_fact`; whole chains resolved by recursive CTE and deleted in one statement per table; NO ACTION end-of-statement proven (R8-18/20, cascaded override revision chain) |
| F2 redaction | set-based Review / Saved System Review / relation / importance / provenance redactors; provenance via UUID-token hash join, proven at least as conservative as `_references` on 10 encodings |
| F3 | already fixed (PR #19); equal-timestamp regressions green; perf targets the `tuple_` query (0.13 ms deep cursor at 150k rows) |
| F4 finance | `availability = retention_truncated`, `actual = null`, `known_subtotal = null`, delta unknown (`retention_truncated`), desire unknown |
| F5 coverage | new day bucket `retention_truncated` (overrides surviving straddling claims), `retention_truncated_count`, `retention_horizon`, reason `retention_truncated` |
| F6 rehydration | legacy transactions / coverage before the effective applied horizon are skipped unless their AA row survives; counted as `transactions_retention_skipped` / `coverage_retention_skipped`; Unlimited after a finite Apply still blocks resurrection; explicit old writes accepted |

## 5. M8 — `20260930_0009_aa_retention` (down `20260930_0008`)

* `aa_retention_policies` — mode `unlimited|finite`, `retain_months ∈ {24,36,60}` (CHECK),
  finite ⇒ confirmed consequences version + instant, append-only chain, one active per user,
  `(user, idempotency_key)` unique.
* `aa_retention_runs` — policy, months, `target_horizon_date`, IANA zone, engine version,
  sha256 preview fingerprint, `running|completed|failed` with timestamp pairing, failed ⇒
  `failure_code` and `total_deleted = 0`, per-table / unit / skipped counts, redaction counts,
  `pruned_units` (Project subject ids only), progress, idempotency key. No value columns
  (tested).
* `ck_aa_review_context_items_redaction_reason` += `source_retention_pruned`.
* Indexes: `ix_aa_measurements_superseded_by_id` (partial) and
  `ix_aa_metric_membership_overrides_source_fact` — see §11.
* AA tables **27 → 29**; snapshot / server schema version **2**; single head.
  Roundtrip down/up on `lifeos_test` tested; production rollback non-destructive (C8).

## 6. Semantics implemented

* Horizon: first local day of the month containing `local_today − retain_months`
  (`zoneinfo`, DST-correct; tested for Kyiv month edge and New York).
* Effective horizon = latest horizon among **completed** runs; Unlimited / 5y after 2y never
  restores; a later stricter Apply advances (tested at a later pinned clock).
* Eligibility (Plan §3): measurements / observations `occurred_at`; coverage and windowed
  versions `window_end` (straddling kept whole); preferences / metric policies only chains with no
  active member and every instant before H; project forecasts / Actual / observations only as a
  **whole completed Project unit** (open, Actual-less, straddling or co-evidenced units kept,
  counted by reason); `experiment` subjects never; overrides cascade with their measurement.
* Preserved: Reviews, revisions, factors, decisions, Experiments + adherence + observations,
  relations + feedback (endpoint redaction only), finance contexts, Saved System Reviews
  (item redaction only), policies, runs, receipts. Importance ratings that target an erased
  **fact ref** are removed exactly like hard delete (R8-48); section / change / subject
  ratings are untouched.
* Deletion order (atomic transaction): advisory lock → idempotency replay → policy →
  derive → `FOR UPDATE` every candidate → re-derive + fingerprint compare → run row →
  Review → Saved System Review → relations → importance → provenance → signal episodes →
  measurements (+ cascade) → coverage → expectation / baseline / target → observations →
  forecasts → preferences → metric policies → run `completed` → commit.
* Failure: full rollback, then a separate `failed` run row with the same identity
  (nothing deleted, nothing redacted; effective horizon unchanged) — tested by injecting a
  failure mid-delete.
* Concurrency: 3 simultaneous applies → one `completed`, two `retention_preview_stale`; a
  correction racing an Apply blocks on the row lock and then fails with `correction_conflict`
  (no forked or partial chain). Tested with threads.

## 7. API / security

`GET /api/v1/aa/retention-policy` (READ ONLY txn, zero writes) · `PUT …` · `POST …/preview`
(READ ONLY) · `POST …/apply` (`confirm` must be the JSON literal `true`). Unsafe routes:
`require_json_content_type` and same-origin as **route dependencies** (415 / 403 before any body
422), session ownership, `extra=forbid` rejects `user_id`. Policy and Apply stay usable with
the AA recording gate closed (privacy control; tested). K15 fixed: finance POSTs now 415 before
422 (tested for all five unsafe routes).

## 8. Truthful reads (additive; no Apply ever ⇒ unchanged — tested)

History `retention_horizon` / `retention_truncated`; finance month (F4); coverage (F5); Project
Analytics `history_deleted_by_retention` + `retention_history_deleted`; signal discovery
clipped at the horizon month (still exactly 4 rules); live System Review `retention`
block, truncated month ⇒ empty derived sections, no proposals, no consequences; annual view lists
truncated months; recurrence discloses `retention_truncated_windows`; «Ревью доступно» skips
truncated months; Review reopen exposes `redaction_reason`.

## 9. Frontend

Settings section `retention` («Хранение аналитической истории» / «Зберігання аналітичної
історії»), separate from `DangerSection`'s activityLog cleanup. Native radio group (fieldset /
legend) Unlimited · 5 · 3 · 2 years; consequence disclosure + «Я понимаю последствия»; save
never deletes; preview counts; `alertdialog` confirm with focus moved to its heading; direct
online Apply (offline ⇒ visible error, no request, nothing queued); stale / failure copy;
current intent, applied horizon (+ «текущее правило мягче уже применённого») and latest run
summary (expandable per-table counts, no values) shown separately. Retention copy on Review,
Saved System Review, Project Analytics, System Review banner, finance / history notes and the
quality strip. RU/UK +84 keys each (ru 1625 → 1709, uk 1624 → 1708).

## 10. Browser QA (production build with analytics enabled, `vite preview`, local API on `lifeos_test`)

* Interactive (headless Chrome over CDP, throwaway accounts): 16/16 checks — Unlimited default,
  4 choices, consequences, save disabled until confirmed, save deletes nothing (history count
  unchanged), preview counts, confirm focus, cancel, **stale 409 with nothing deleted**, apply +
  run summary, preview zero, back to Unlimited keeps the applied horizon, **offline Apply sends
  no request and queues nothing**, reconnect + second run, keyboard reachability.
* Matrix: 3 themes × 2 locales × 6 widths (320/390/768/1024/1440/1920) × 8 screens (settings
  retention, Project Analytics, redacted Review, truncated System Review month, saved revision
  with retention redaction, annual review crossing the horizon, finance, home) = **288 loads,
  0 horizontal overflow, 0 untranslated keys, 0 console errors**. The previously classified
  Paradise 768 overflow did not reproduce in this harness.
* Screenshots reviewed (dark/light/paradise, 390/1440, RU/UK).
* Observation: `#/project-analytics/<id>` for a project that exists only in AA (not in the
  snapshot) shows the pre-existing «Проект не найден» guard; the `history_deleted_by_retention`
  state is covered by a component test and the API test.
* A QA seed initially used a non-real Saved System Review `frozen_context` shape and crashed the
  revision view; the seed (and the unit-test seed) now use the real list shape. Not a product
  defect.

## 11. Performance / EXPLAIN (opt-in `tests/test_aa_retention_perf.py`, `lifeos_test`)

Dataset: account A 153,766 measurements over five years (dense equal local midnights, 3,766
correction chains, 1,431 tombstones, 1/7 legacy-import rows), 60 months of coverage /
expectations / targets / baselines, 60 Reviews × 3 linked items, 60 Saved System Reviews;
account B 30,745 noise rows. `ANALYZE` before plans.

| Query | Execution |
|---|---|
| F3 history first page / deep cursor | 0.17 ms / 0.13 ms |
| semantic layer page · coverage stats · `derive_month` inputs | 0.04 · 0.03 · 1.1 ms |
| signal finance-period discovery | 49 ms |
| eligibility: measurement chains (recursive CTE) | 424 ms |
| bulk Review lookup (89,867 ids) · SR GIN overlap | 39 ms · 15 ms |
| bulk provenance hits | 172 ms |
| whole-chain DELETE of 89,867 rows | **> 590 s before indexes (cancelled) → 1.29 s after** |
| preview (end to end) | 4.2 s |
| atomic Apply of 90,007 rows | **10.6 s**, noise account untouched |

The delete finding is the only index evidence: each erased row fires the NO ACTION check on
`superseded_by_id` and the CASCADE lookup on overrides' `source_fact_id`, neither indexed.
No other index added. No benchmark data committed.

## 12. Validation (final, actual)

| Check | Result |
|---|---|
| `apps/api: python -m pytest` (`lifeos_test`, DB tests ran) | **748 passed, 1 skipped** (the skip is the opt-in perf harness; it passed separately with `LIFEOS_RETENTION_PERF=1`) |
| ruff / compileall | pass / pass |
| `alembic heads` / `current` | `20260930_0009 (head)` / `20260930_0009 (head)` |
| DB `aa_%` tables | 29 |
| `apps/web: npm test` | **535 passed / 42 files** |
| typecheck / lint / build / build --manifest | pass |
| `git diff --check` | pass |
| import cycles | backend 0 (158 modules) / frontend 0 (170 modules) |
| signal rules | 4 |
| bundle | entry JS 321.10 → 321.11 kB (97.34 kB gzip), `SettingsPage` 13.64 → 23.41 kB, `LocaleContext` 200.23 → 215.78 kB, no 500 kB warning |
| dependencies added | none |

New suites: `test_aa_retention_migration.py`, `test_aa_retention_reads.py`,
`test_aa_retention_apply.py`, `test_aa_retention_api.py`, `test_aa_retention_redaction.py`,
opt-in `test_aa_retention_perf.py`; web `settings-retention.test.jsx`. Updated pins (not
weakened): Alembic head (7 places), AA table count 29, locale counts.

R8 map (each ≥ 1 test): 01/05/06 policy tests · 02/03/04 migration + API parametrised months ·
07/08/09 preview + stale · 10 API confirm · 11 replay (service + HTTP) · 12/13/15/16/17/80
apply test · 14 receipt test · 18–30 apply test · 22 IANA test · 31–42 reads tests · 43–48 apply
+ redaction tests · 49/50 System Review truncated month (no candidates / consequences) ·
51/52 provenance tests · 53 noise account · 54/55 guards · 56/57 export / account deletion ·
58–60 horizon test · 61–64 F6 end-to-end · 65/67 activityLog tests · 66 snapshot untouched ·
68 existing F3 tests · 69/70 web queue guard + `runApply` offline test · 71/72 failure test ·
73 migration roundtrip · 74 registry parity · 75 export manifest schema 2 · 76 export redaction
reason · 77 experiment preservation · 78 dangling-FK scan · 79 idempotent replay (atomic, no
resume needed).

## 13. Non-scope (confirmed not done)

No scheduler / worker, no arbitrary or < 24-month duration, no per-fact retention receipts, no
activityLog change or import, no tombstone retention, no age-pruning of user-authored
entities, no partitioning / materialized views, no snapshot v3, no new analytics domain, no
dependency, no deploy.

## 14. PR

Branch `feat/adaptive-analytics-slice-8-retention`; title «Add Adaptive Analytics retention
controls»; normal merge commit (PR metadata in the session's final machine block).
