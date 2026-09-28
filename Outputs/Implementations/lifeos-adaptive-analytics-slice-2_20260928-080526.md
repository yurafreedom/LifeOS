# LifeOS Adaptive Analytics — Slice 2 · Finance Pilot + Durable AA Queue

**Generated:** 2026-09-28 08:05:26 EEST
**Mode:** recovered-work completion audit, scoped correction, validation and publication
**Branch:** `feat/adaptive-analytics-slice-2`
**Start HEAD:** `81ea9b098ab18a9bcf35b890a6412383be10216c` (Hero-merged main)

## Verdict

`SLICE_2_STATUS=PASS`

Slice 2 now provides account-scoped Finance semantic facts, a non-persisted monthly-spend
derivation, correction-safe C7 membership, honest legacy import, a durable IndexedDB queue,
independent AA synchronization, Finance analytics/history UI and the required permanent
regressions. There is no new migration, Project/Clarify/Signals work or deployment.

## Recovery context

The implementation began as 14 modified and 18 untracked recovered entries on the pre-Hero
prepared branch. The preservation task moved the branch by fast-forward only from
`40ae9281c077d1bd65ed595c04f0eb424d9a00db` to `81ea9b098ab18a9bcf35b890a6412383be10216c`,
then reapplied the work. The sole Hero overlap, `apps/web/src/pages/FinancesPage.jsx`, preserves
both `PageHeader`/Hero behavior and the Slice 2 analytics action.

- Preserved stash: `stash@{0}` → `51184836ace557fbd9492527bd845329b17b2a76`
- Recovery bundle: `/tmp/lifeos-slice2-recovery-20260928T044442Z-qTIDWL`
- Recovery patch: `tracked-working-tree.patch`
- Recovery manifest: `dirty-files-sha256.txt`
- The stash was not reapplied again and remains retained for owner/finalization review.

## Authorities read

- `Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md`
  (§15, §18, §24.4, C1/C5/C6/C7, security, rollout and test matrix)
- targeted technical Discovery
- PRE-0 baseline
- Slice 0, Slice 0b and Slice 1 implementation reports
- Hero Vignette implementation report
- current merged models, services, routes, state synchronization and React code

## Completion audit matrix — recovered state before completion edits

The audit used 48 explicit deliverables. Initial totals were **30 COMPLETE**, **15 PARTIAL**,
**0 MISSING**, **3 INCORRECT**, **0 OUT_OF_SCOPE_FOUND**.

| ID | Deliverable | Initial | Completion action / evidence |
| --- | --- | --- | --- |
| A1 | transaction Measurements | COMPLETE | real `finance.transaction_amount`, UAH, transaction subject |
| A2 | monthly derivation | PARTIAL | added exact subject filter and historical current-layer resolution |
| A3 | correction semantics | PARTIAL | expanded Decimal/tombstone/no-FX/counted-once proofs |
| A4 | C7 correction membership | INCORRECT | inherit sparse override through correction lineage at correction-time cutoff |
| A5 | legacy policy vs override | INCORRECT | category exclusion remains policy; only explicit transaction choice writes override |
| A6 | legacy import route | COMPLETE | authenticated, origin checked and gated |
| A7 | legacy tests | PARTIAL | added sparse-shape and no-synthetic-coverage persistence proofs |
| A8 | account isolation | COMPLETE | authenticated scope in derivation/import and cross-account tests |
| A9 | write gate | COMPLETE | expanded gate proof to queue-safe correction, Finance policy and import |
| A10 | coverage/legacy quality | COMPLETE | explicit claims only; legacy disclosure remains derived |
| B1 | AnalyticsRepository | COMPLETE | semantic HTTP/replay boundary retained |
| B2 | AnalyticsWriteQueue | PARTIAL | added schema version, ISO client time, UUID requirement, scoped inspect/discard |
| B3 | AnalyticsSyncCoordinator | PARTIAL | completed restart scheduling, FIFO barrier and surfaced failures |
| C1 | IndexedDB persistence | COMPLETE | durable object store |
| C2 | injected IDBFactory | COMPLETE | no core dependency on global IndexedDB |
| C3 | enqueue-time idempotency | COMPLETE | key embedded and persisted before send |
| C4 | restart persistence | COMPLETE | recreation proof retained |
| C5 | strict FIFO | INCORRECT | terminal/dead-letter entry now blocks later semantic operations until explicit discard |
| C6 | single-flight | COMPLETE | coordinator in-flight guard and ordered loop |
| C7 | retry/backoff | PARTIAL | delayed retry restored after restart; exponential cap proven at five minutes |
| C8 | permanent dead letter | PARTIAL | retained details plus visible export/discard UI |
| C9 | 401 retention | COMPLETE | `blocked_auth`, retained, explicit resume |
| C10 | 409 terminal conflict | COMPLETE | retained server code/reason |
| C11 | account-switch isolation | COMPLETE | queue rows scoped by authenticated user |
| C12 | multi-tab | PARTIAL | retained Web Lock and added no-lock duplicate-safety proof |
| D1 | AnalyticsContext | PARTIAL | exposed retained failures and account-scoped export/discard actions |
| D2 | context separation | COMPLETE | AA provider remains separate from `LifeDataContext` |
| D3 | Finance snapshot integration | COMPLETE | durable intent precedes snapshot mutation; no double-summing |
| D4 | StateSyncCoordinator unchanged | COMPLETE | zero source diff |
| D5 | T-12 | COMPLETE | both failure directions covered |
| E1 | FinanceAnalytics | PARTIAL | surfaced queue failures, reused `AAFacts`, preserved Hero header |
| E2 | MetricHistoryPage | PARTIAL | preserved Hero/PageHeader behavior |
| E3 | AAChart | COMPLETE | API-shaped series only |
| E4 | AAChartLayers | COMPLETE | presentation-only SVG layer |
| E5 | MoneyWidget | COMPLETE | hardcoded `budget = 300` removed; expectation/target distinct |
| E6 | routes/App | COMPLETE | dark feature flag retained and internal navigation no longer bypasses it |
| E7 | coverage UI | COMPLETE | explicit buckets and future-day disclosure |
| E8 | provenance UI | COMPLETE | accepted four-row disclosure reused |
| E9 | target absence | COMPLETE | absent vs missing vs zero remains distinct |
| E10 | expectation history | COMPLETE | all versions retained |
| E11 | neutral delta | COMPLETE | −₴800 without normative grounding remains neutral |
| E12 | Hero compatibility | PARTIAL | both new analytics pages now use production `PageHeader` |
| F1 | fake-indexeddb | COMPLETE | dev dependency only |
| F2 | lockfile | COMPLETE | exact package-lock entry, no other package |
| F3 | backend targeted tests | PARTIAL | expanded Finance/C7/import/write-gate coverage |
| F4 | queue tests | PARTIAL | added FIFO/restart/backoff/no-lock/local-error cases |
| F5 | UI tests | PARTIAL | added failure actions, AAFacts and Hero page checks |
| F6 | recovered full regression | COMPLETE | 248 API and 96 web tests green before edits |

Every PARTIAL/INCORRECT row is COMPLETE after the scoped changes. No recovered Slice 2 work was
removed, and no meaningful out-of-scope product implementation was found.

## Finance architecture

`finance.transaction_amount` is an atomic account-owned Measurement with UAH money and a
transaction subject. `finance.monthly_spend` is derived on read for the exact local month from
visible transaction facts; it is never inserted as a Measurement. The derivation uses Decimal,
explicit timezone boundaries, current/as-of fact visibility and C7 membership, excludes
superseded/tombstoned/excluded facts and performs no FX conversion or snapshot fallback.

A correction preserves its original historical row while only the replacement contributes to
current totals. Sparse per-fact membership follows a correction lineage unless the replacement
receives a newer explicit override; ancestor lookup is capped at the correction's recording time,
so a later write against an obsolete row cannot rewrite the replacement.

Expectation history is returned in full. The current Expectation/Target for an `as_of` read now
uses the same bitemporal visibility and effective-time rules as the shared subject service.
Target grounding remains separate from Expectation comparison; absent Target gives neutral
desirability even when the descriptive delta is −₴800.

## C7 and legacy import

Historical inclusion reads only AA policy versions, sparse membership overrides and immutable
measurement dimensions. A later snapshot category mutation cannot reinterpret an earlier month.
The permanent policy test records two policy versions and proves the earlier as-of Finance result
is byte-identical before/after current snapshot mutation.

Legacy import reads only the authenticated account's genuine snapshot transactions. It preserves
date/amount/category/source dimensions, records ingestion time, marks original recording time
unknown and uses `LEGACY_IMPORT`. Category intent is captured once as policy; a sparse override is
created only for a transaction whose own inclusion flag was explicitly false. `activityLog`,
Expectation, Forecast, Target, Baseline, synthetic coverage and the former MoneyWidget constant
remain unimported. Retry reuses deterministic per-account idempotency identities.

## Durable queue and consistency model

IndexedDB store records contain queue order, user, operation/route, payload schema version,
payload, enqueue-time UUID, ISO client creation time, attempts, next retry time, state and the
last structured error. The queue takes an injected `IDBFactory`.

- strict ascending FIFO; one semantic request in flight per coordinator;
- failed/terminal head entries block later operations until explicit user discard;
- transient/network/408/425/429/5xx retry at 1s, 2s, 4s … capped at 300s;
- 401 becomes retained `blocked_auth`; 400/422 retained `failed_permanent`; 409 retained
  `terminal_conflict` with server reason;
- browser restart preserves inflight/pending rows and recreates delayed timers;
- logout/account switch retains rows and cannot replay another user's records;
- `navigator.locks.request('aa-write-queue')` elects a leader where available;
- without Web Locks, the same persisted idempotency key makes duplicate sends server-safe;
- visible Finance UI lists failures and offers export or explicit account-scoped discard.

The consistency contract is deliberately not distributed ACID. Snapshot state may succeed while
AA is offline; AA intent stays durable. Snapshot 409 cannot pause/drain AA, and AA failure cannot
freeze snapshot synchronization. A lost acknowledgement retries the same idempotency key.

## Repository, context and current-state integration

Layering is `api/analytics.ts → AnalyticsRepository → queue/coordinator → AnalyticsContext`.
`AnalyticsContext` owns AA reads, writes, queue status and failure handling. `LifeDataContext`
continues to own snapshot version 2 and emits Finance semantic intent alongside transaction
changes; AA writes never use snapshot CAS. `stateSyncCoordinator.ts` is unchanged.

## UI and Hero compatibility

Finance Analytics uses `AAFacts`, `AADelta`, `AAQualityStrip`, `AAProvenance`, `AAHistoryList`,
`AAChart` and `AAChartLayers` with real API-shaped data. Metric History keeps Actual, Expectation
and Target separate. The 28/31 scenario identifies three future days without zero filling and
shows imported-data quality. Explicit Target absence is labelled as not set, not ₴0.

The Finance list, Finance Analytics and Metric History preserve the Hero/PageHeader contract.
Paradise receives the vignette; dark/light keep the compact fallback. Hero component, CSS and
regression test are unchanged from merged main.

## Pre-merge owner review correction — timezone-safe date-only Finance facts

Owner review found that the manual Finance transaction payload appended a fixed `+03:00` to a
date-only source value while declaring `Europe/Kyiv`. That offset is wrong during standard time:
`2026-12-01T00:00:00+03:00` resolves to 23:00 on November 30 in Kyiv, so a December transaction
could enter the preceding local day and month.

The payload now uses a small deterministic `Intl.DateTimeFormat` helper to resolve local midnight
under IANA `Europe/Kyiv` rules for the transaction's exact source date. It emits the corresponding
UTC instant and retains `occurred_tz=Europe/Kyiv`; it does not consult the browser's local timezone,
assume a fixed offset, add a dependency or fabricate precision beyond the accepted local-midnight
convention. The same pure builder is the payload path used by `AnalyticsContext`.

Four permanent frontend regressions cover summer `2026-08-01`, winter and month boundary
`2026-12-01`, and year boundary `2027-01-01`. They convert the produced instant back through
`Europe/Kyiv` and assert the genuine source calendar date at 00:00:00; the payload assertion also
proves December 1 remains in the December aggregation period. Focused validation passed 28 web
tests and all 6 backend Finance tests. Final validation after this correction is recorded below.

## Dependency and migration delta

- Added dependency: `fake-indexeddb@6.2.5`, **dev-only**.
- Other dependency additions: none.
- Dependency upgrades / audit fix: none.
- New migration: none.
- Alembic heads/current: `20260910_0004`, exactly one head.

## Validation

### Recovered implementation before completion edits

- API: **248 passed**, 7 inherited warnings
- ruff: PASS
- Alembic heads/current: `20260910_0004` / `20260910_0004`
- web: **96 passed / 15 files**
- typecheck, lint, build: PASS
- recovered bundle: 100 modules; CSS 130.95 kB / 23.21 kB gzip; JS 420.41 kB /
  120.73 kB gzip; map 1,046.29 kB

### Focused completion validation

- Finance/C7/import/correction/idempotency/coverage: **34 passed**
- gate/import/Finance/C7 follow-up: **14 passed**
- queue/coordinator/Finance UI/Hero: **26 passed**
- queue/coordinator/Finance UI follow-up: **24 passed**
- focused ruff, typecheck and lint: PASS

### Final full validation

- API: **253 passed**, 7 inherited dependency/config warnings, 45.90s
- ruff: **PASS**
- Alembic heads/current: **`20260910_0004` / `20260910_0004`, one head**
- web: **108 passed / 16 files**, 1.22s
- typecheck: **PASS**
- lint: **PASS**
- build: **PASS**
- final bundle: 102 modules; CSS 130.95 kB / 23.21 kB gzip; JS 423.66 kB /
  121.80 kB gzip; map 1,056.20 kB
- `git diff --check`: PASS

Relative to Hero main: +19 modules; CSS +4.26 kB / +0.84 kB gzip; JS +24.45 kB /
+7.90 kB gzip; map +67.55 kB. Relative to recovered pre-edit Slice 2: +2 modules, no CSS
change, JS +3.25 kB / +1.07 kB gzip and map +9.91 kB.

## Changed paths and recovered implementation set

Backend: Finance route/schema/service, queue-safe correction lookup/route, legacy importer,
metric-policy inheritance, app router integration and focused Finance/C7/import/write-gate tests.

Frontend: analytics API/repository, IndexedDB queue, AA coordinator, AnalyticsContext,
LifeDataContext Finance emission, Finance/Metric History pages, charts, MoneyWidget, flagged App
routes, analytics CSS and queue/coordinator/UI/smoke tests.

This report is the only new workflow artifact. No ignored environments/build products, recovery
bundle, credentials or temporary files are included.

## Deviations and non-scope

The task began from preserved uncommitted work rather than a pristine branch; that state was
explicitly owner-approved and externally backed up. Completion reused it rather than rewriting
already-correct pieces. No generic analytics engine, convenience monthly Measurement, implicit
FX, distributed transaction, production dependency or new table was introduced.

Not implemented: Slice P/Projects, Clarify/Waiting/Reference, Slice 3/M4/signals/Home signals,
Reviews, Experiments, Trade-offs, deployment or PR merge. Main and the frozen design tag remain
unchanged. The recovery stash remains retained pending explicit owner authorization.
