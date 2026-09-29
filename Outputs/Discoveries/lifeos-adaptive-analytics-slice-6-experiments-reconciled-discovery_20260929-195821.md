# LifeOS · Adaptive Analytics · Slice 6 · First-Class Experiments — Reconciled Discovery

Status: **reconciled, parallel-wave, read-only**. Written outside Git on 2026-09-29.
It reconciles the provisional parallel Discovery
(`/Users/yurasachenko/LifeOS/_parallel_discovery/lifeos-adaptive-analytics-slice-6-experiments-discovery.md`,
baseline `ea3a75e1`, pre-Slice-4) against merged `main`. It does not authorize
implementation. The serial implementation session must copy it into `Outputs/Discoveries/`
after one final re-verify.

---

## 1. Verdict

**RECONCILIATION_STATUS = PASS.** Every item the old Discovery marked
`UNKNOWN_UNTIL_PREDECESSOR_MERGES` is now resolved from merged code. The old strategy holds
in its main points: lifecycle in the database and the service, client-minted UUID, no queue
change, and derived future/after-stop days. Five items change or get sharper:

1. **Decision idempotency.** `aa_decisions` has **no idempotency column**. Review
   idempotency lives on `aa_review_revisions`, and decisions/factors point at a *review
   revision number*. So Experiment decisions cannot reuse Review's replay mechanism.
   M6 must add `aa_decisions.idempotency_key`, required for experiment scope only, and make
   the experiment decision row the **revision ledger** for experiment factors (§6).
2. **Factor seam: Option A (widen `aa_review_factors`).** The frozen page says so literally:
   «“что могло повлиять” — факторы из ревью, решение — выбор из ревью». Option B
   (`aa_observations`) would turn a factor (an epistemic claim about influence) into an
   observation. Option C (a Review on subject `experiment:experiment`) is unsupported:
   `UnsupportedReviewSubjectError` allows only finance periods and projects, and the frozen
   context roles/source tables have no baseline or experiment-observation member. No owner
   decision is needed (§7).
3. **Parent/child FK convention.** Slice 4 uses a **plain FK + `ON DELETE CASCADE` + an
   owner-scoped service load**, not composite FKs. Slice 6 adopts the same convention.
   The old Discovery's composite-FK recommendation is withdrawn (§5).
4. **Transition duplicates.** Several tabs (or an automatic "period over" transition) can
   enqueue the same target with *different* keys. Strict 409 on the second request would
   create a `terminal_conflict` that blocks the whole AA queue at its head. Reconciled
   rule: once the target state has been entered on this row's path, a request for it is a
   **200 no-op** that stores nothing. An illegal edge is still 409 `invalid_transition` (§9).
5. **Existing tests pin M5 facts that M6 changes.** These must be *updated*, not weakened:
   - `test_aa_reviews.py` enum/CHECK parity for `ck_aa_decisions_choice`;
   - the M5 roundtrip (`get_heads() == ["20260928_0006"]`);
   - `test_aa_project_analytics.py:637` (head);
   - the export manifest revision pins in `test_export.py`, `test_aa_reviews.py` and
     `test_aa_semantic.py` (§12).

`OWNER_DECISION_REQUIRED = NO`. The Plan's non-blocking defaults are listed in §14.

---

## 2. Baseline and remote state

| Item | Value |
| --- | --- |
| Pinned baseline | `414df142700653d616016ff644bff3d9c0007540` (`git cat-file -t` → `commit`) |
| Remote `origin/main` at start and at finish | `414df142700653d616016ff644bff3d9c0007540` (unmoved) |
| Includes | Slice 4 (PR #12), hardening (PR #13), PR #14 forecast-history fix, Slice 5 (PR #15, merge `414df14`) |
| Frozen design tag | `adaptive-analytics-design-accepted` → tag `6c507b82…` → commit `d4960286…` (unmoved) |
| Read method | `git archive <sha>` / `git archive <tag>` extracted to the session scratchpad; `git show`, `git ls-remote` |
| Worktree / branch | canonical checkout on `main`, clean; not switched, not modified |

---

## 3. Sources read (authority order)

1. Owner decisions D1–D5 (master context §43). Esp. **D4 ABANDONED**, **D5 durable queue**.
2. Merged code at `414df14`:
   - `apps/api`: `alembic/versions/20260928_0006_aa_reviews.py`;
     `models/{aa_decision, aa_review, mixins, aa_semantic, aa_observation, aa_signal_episode, __init__}.py`;
     `analytics/{enums, subjects, coverage, delta}.py`;
     `services/{aa_reviews, aa_deletion, aa_comparison, export}.py`;
     `services/reviews/{contracts, errors, persistence, redaction}.py`;
     `routes/{aa_reviews, aa_measurements}.py`;
     `schemas/{aa_common, aa_comparison}.py`;
     `security/{aa_gate, origin}.py`;
     `tests/{conftest, test_aa_schema_guards, test_aa_reviews}.py`;
     `main.py`.
   - `apps/web`: `repositories/{analyticsWriteQueue, analyticsSyncCoordinator, analyticsRepository}.ts`;
     `context/AnalyticsContext.jsx`;
     `app/{routes.js, routeRegistry.js, lazyRoutes.jsx}`;
     `components/analytics/{AADelta, AAFacts, AAHistoryList, AAFactorTag, AAQualityStrip}.jsx`;
     `pages/analytics/review/Flow.jsx`;
     `components/{Sidebar, MobileBottomNav}.jsx`;
     `analytics/timezone.ts`.
3. Reports:
   - Slice 4 `…slice-4_20260928-171500.md`;
   - hardening `…development-architecture-modularization_20260928-200005.md`;
   - PR #14 `…project-forecast-revision-signal-correctness_20260928-195351.md`;
   - Slice 5 `…slice-5-project-analytics_20260929-001128.md`.
4. Phase B Plan: §7, §7.1, §9.1–9.2, §10, §15, §20.3, §21.2, §22, §24.6, §24.9, §27.
5. Old Discovery, read in full.
6. Frozen I: `ui_kits/life-os-analytics/experiment.jsx` and `data.js` (`experiments[]`).
   Used for product semantics only.

Also read: `AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md` (§§8–15, 22–23, 36–50) and
`Outputs/architecture/module-boundaries.md`.

---

## 4. Predecessor state — static re-verification

| Claim | Verified value | Evidence |
| --- | --- | --- |
| Slice 5 merged | **YES**. `414df14` = merge of PR #15; report present; master context §39 | `git log`, report |
| Alembic head | **`20260928_0006`**, single head; `down_revision = "20260928_0005"` | versions dir (6 files); `test_aa_reviews.py:731-732`; `test_aa_project_analytics.py:637` |
| AA table count | **19** | `EXPORT_TABLES` (19 keys); Slice 4 report §5 "mapped (19) == export (19) == DB (19)" |
| Snapshot / server schema version | **2 / 2** | `schemas/state.py:11,25` `schema_version: Literal[2]`; Slice 5 §8 |
| Signal rules | **exactly 4**: `coverage_partial`, `data_stale`, `finance_threshold`, `project_forecast_revision` | `analytics/rules/` listing; `test_aa_reviews.py` catalogue assertion |
| Export registry | `services/export.py::EXPORT_TABLES` (19). `validate_export_registry()`: mapped `aa_*` == registry; DB `aa_%` == registry at export time | lines 49–83, 108–117 |
| TRUNCATE registry | `tests/conftest.py::TRUNCATED_TABLES` (18 `aa_*` + `user_snapshots`, `sessions`, `users`), `TRUNCATE … CASCADE`; `SEEDED_TABLES = {aa_metric_definitions, alembic_version}` | lines 67–92 |
| Registry guards | `test_every_mapped_table_is_either_cleaned_or_seeded`; `test_all_analytics_tables_exist_with_a_cascade_from_users` (every `aa_*` except definitions has a users CASCADE FK) | `test_aa_schema_guards.py` |
| Privacy / deletion | Account deletion = users CASCADE. `aa_deletion.FACT_TABLES` = `SEMANTIC_TABLES` (8) + measurements + coverage. `SOURCE_REDACTORS = (redact_review_context,)`, registered through the facade. Generic tombstone nulls value columns when `hasattr(row, "value_type")` | `services/aa_deletion.py` |
| Durable queue | **FIFO + single-flight + head-of-line blocking — confirmed** (§8) | coordinator/queue source |

### 4.1 Slice 4 actual Review schema (the parts M6 touches)

`aa_decisions`, created by M5:

```
id uuid PK · user_id uuid NOT NULL FK users ON DELETE CASCADE · created_at timestamptz NOT NULL DEFAULT now()
scope text NOT NULL
review_id uuid NULL FK aa_reviews(id) ON DELETE CASCADE          -- default FK name aa_decisions_review_id_fkey
choice text NULL
revision integer NOT NULL
superseded_in_revision integer NULL
CHECK ck_aa_decisions_scope              scope IN ('review')
CHECK ck_aa_decisions_review_scope       scope <> 'review' OR review_id IS NOT NULL
CHECK ck_aa_decisions_choice             choice IS NULL OR choice IN ('keep','adjust','later','inconclusive')
CHECK ck_aa_decisions_revision           revision >= 1
CHECK ck_aa_decisions_superseded_order   superseded_in_revision IS NULL OR superseded_in_revision > revision
UNIQUE INDEX uq_aa_decisions_current_review ON (review_id) WHERE superseded_in_revision IS NULL AND review_id IS NOT NULL
```

- **No `idempotency_key` column.** Review replay uses `aa_review_revisions.idempotency_key`
  (`UNIQUE (user_id, idempotency_key)`).
- ORM: `app/models/aa_decision.py`. The docstring says "Slice 6 (M6) widens scope and choice
  for experiments; the CHECKs are written so that widening is a constraint swap."
- Enums: `DecisionScope = {review}` ("Experiment scope arrives with Slice 6 (M6)"),
  `ReviewDecisionChoice = {keep, adjust, later, inconclusive}`.
- Tri-state preserved: **no row** (skipped) ≠ **row, `choice NULL`** («Пока без решения») ≠
  **row, `inconclusive`**.

`aa_review_factors`, created by M5:

```
id · user_id (CASCADE) · created_at
review_id uuid NOT NULL FK aa_reviews ON DELETE CASCADE
ordinal int NOT NULL · text text NOT NULL · epistemic_kind text NOT NULL DEFAULT 'unknown'
added_in_revision int NOT NULL · retracted_in_revision int NULL · replaces_id uuid NULL FK aa_review_factors(id)
CHECKs: ck_aa_review_factors_{ordinal, text (btrim<>'' ∧ ≤500), epistemic_kind (observed/mine/maybe/unknown), added, retracted_order, no_self_replace}
INDEX ix_aa_review_factors_review (review_id, ordinal)
```

Review subjects are finance period and project only (`UnsupportedReviewSubjectError`).
`ReviewRole` has no `baseline`, and `REVIEW_SOURCE_TABLES` excludes any experiment table.

### 4.2 Parent/child ownership convention

Every Slice 4 child uses `review_id → aa_reviews(id) ON DELETE CASCADE` (plain FK). Ownership
comes from `WHERE user_id = :u` in the service. There is no `UNIQUE(id, user_id)` and no
composite FK anywhere in the AA schema. **Slice 6 matches this convention.**

---

## 5. Reconciliation table — old Discovery vs merged `main`

| # | Old Discovery claim | Merged reality | Verdict |
| --- | --- | --- | --- |
| 1 | M6 down_revision "preview 20260928_0006" | `20260928_0006` is the single head | **CONFIRMED** |
| 2 | `aa_decisions` shape: scope/review_id/choice/revision/superseded_in_revision; partial unique | Exactly as previewed | **CONFIRMED** |
| 3 | Decisions are "designed to be widened" | Only partly: scope + nullable parent. **No idempotency key.** Revision numbers belong to the review revision ledger | **AMENDED** — M6 adds `idempotency_key` and uses the experiment decision row as its own revision ledger |
| 4 | Composite FK `(experiment_id, user_id)` + `UNIQUE(id,user_id)` | No composite FKs anywhere | **WITHDRAWN** — plain FK CASCADE + owner-scoped load |
| 5 | Factor seam: recommended widen `aa_review_factors` | Frozen page states it explicitly; B and C do not fit | **CONFIRMED (A)** |
| 6 | Review subjects exclude `experiment:experiment` | Confirmed | **CONFIRMED** — Option C rejected |
| 7 | `SOURCE_REDACTORS` probably needs no Slice 6 adapter | Experiment result is derived at read time, never frozen | **CONFIRMED** — no adapter |
| 8 | 13 → 19 AA tables after S4 | 19 | **CONFIRMED**. After M6: **22** |
| 9 | Queue: FIFO, single-flight, head blocks on `failed_permanent`/`terminal_conflict` | Confirmed. Head also blocks on `blocked_auth` and on backoff (`next_attempt_at > now`) | **CONFIRMED (stronger)** |
| 10 | 403/404 → `failed_permanent` | Confirmed (default branch) | **CONFIRMED** |
| 11 | No queue change needed | Confirmed; but `discardQueueFailure` lets the **user** discard a failed head | **CONFIRMED + NOTE** (§8.2) |
| 12 | `crypto.randomUUID` required by the queue | `analyticsWriteQueue.defaultKey()` **throws** without it | **CONFIRMED** |
| 13 | 415 before 422 via route dependency | `WRITE_GUARDS = [Depends(require_json_content_type), Depends(require_aa_write_enabled)]`; route class maps `RequestValidationError` → 422 `{code,message}` | **CONFIRMED** |
| 14 | Local day rule `day > today ⇒ future`, today elapsed | `coverage._local_today` / `classify_days` | **CONFIRMED** |
| 15 | `DenominatorBasis.EXPERIMENT_ELAPSED_DAYS`, `DayCoverage.FUTURE` exist | Present | **CONFIRMED** |
| 16 | Subject `("experiment","experiment")` registered | Present | **CONFIRMED** |
| 17 | `AAQualityStrip({coverage})` coverage-only | Confirmed | **CONFIRMED** — adherence never passed as coverage |
| 18 | `AAFactorTag` would be added by S4 | Present: `AAFactorTag({kind, onChange, onRemove, readOnly})` | **CONFIRMED** |
| 19 | Review `ChoiceList` is reusable | It hard-codes `REVIEW_CHOICES` / review keys | **AMENDED** — experiment needs its own choice list; `AAFactorTag` is reused as is |
| 20 | `AADelta` needs an experiment label | `AADelta({summary, comparison, notes})` already supports `current_concept='observation'`, `reference_concept='baseline'` (`layerNames`/`labelKeys`) | **RESOLVED** — detail API returns an AADelta-shaped pair; no primitive change |
| 21 | Route: add `experiment` | Routes registry, lazy loaders and hash families now exist (hardening + Slice 5). Route count pinned **20** in `smoke.test.jsx:47` and `route-registry.test.ts:37` | **AMENDED** — one route id `experiment` with a hash family (count → 21) |
| 22 | Slice 5 may conflict with `AADelta`/`aa_comparison` | Slice 5 changed neither (dual delta lives in `aa_project_analytics.py`) | **RESOLVED** |
| 23 | Transition replay 200 via per-state keys | Confirmed viable. Different-key duplicates for an already-entered target were not addressed | **AMENDED** — target-idempotent 200 no-op (§9) |
| 24 | Conditions: `aa_observations` or a role | Frozen conditions render with an epistemic tag «наблюдение» | **DECIDED** — `aa_observations` on subject `experiment:experiment:<id>` through an experiment-guarded route |
| 25 | Outcome definition on `aa_experiments` | No catalogued sleep/fatigue metric; `compute_delta` rejects categorical | **CONFIRMED** — outcome type limited to `money/duration/count/scale` |
| 26 | Adherence in `FACT_TABLES` (recommended) | Generic tombstone nulls only value columns and `statement/desired_direction/policy/included`; adherence `state` would survive a tombstone | **REVERSED** — adherence stays out of `FACT_TABLES`; per-day changes are CORRECTION supersession; account deletion covers it |

---

## 6. Decision seam — exact reconciliation

M6 must ALTER `aa_decisions` (`AA_DECISIONS_ALTER_REQUIRED = YES`). Every constraint below
uses its real merged name:

- **Scope.** `ck_aa_decisions_scope` is recreated as `scope IN ('review','experiment')`.
  `DecisionScope` gains `EXPERIMENT`. The existing parity test stays valid.
- **Parent.** `ck_aa_decisions_review_scope` is dropped and replaced by
  `ck_aa_decisions_parent`, which requires exactly one parent matching the scope.
- **Choice.** `ck_aa_decisions_choice` is dropped and replaced by **two scope-dependent CHECKs**:
  - `ck_aa_decisions_review_choice`:
    `scope <> 'review' OR choice IS NULL OR choice IN ('keep','adjust','later','inconclusive')`;
  - `ck_aa_decisions_experiment_choice`:
    `scope <> 'experiment' OR choice IS NULL OR choice IN ('keep','modify','longer','reject','inconclusive')`.

  So `reject`/`modify`/`longer` on a Review and `adjust`/`later` on an Experiment are
  unrepresentable. There is **no union widening**.
- **Idempotency.** `idempotency_key text NULL` is added, with
  `ck_aa_decisions_idempotency (scope = 'experiment') = (idempotency_key IS NOT NULL)` and
  `UNIQUE (user_id, idempotency_key)` (NULLs distinct, so review rows are unaffected).
- **Uniqueness.**
  - `uq_aa_decisions_current_experiment`: partial unique on `(experiment_id)`, current rows only.
  - `uq_aa_decisions_experiment_revision`: partial unique on `(experiment_id, revision)`.
- **Tri-state preserved.** No row ≠ NULL choice ≠ `inconclusive`. `choice` stays nullable, and
  the request field is *required but nullable*, so an omitted field is 422, never NULL.
- **Vocabularies stay separate enums:** `ReviewDecisionChoice` (unchanged) and a new
  `ExperimentDecisionChoice`. `keep` means «Оставить как есть» in a Review and «Оставить
  правило» in an Experiment.
- **Existing tests that change (update, not weaken).** `test_aa_reviews.py` parametrises
  `("ck_aa_decisions_choice", ReviewDecisionChoice)`. It becomes
  `("ck_aa_decisions_review_choice", ReviewDecisionChoice)` with the `'review'` literal
  subtracted, plus a new experiment row.

---

## 7. Factor seam — evaluation and choice

| Option | Fit | Verdict |
| --- | --- | --- |
| **A. Widen `aa_review_factors`** (`scope`, nullable `review_id`, `experiment_id`) | Same concept, same epistemic vocabulary, same `AAFactorTag`, the frozen statement «факторы из ревью». Revision anchoring works because the experiment decision row is the revision ledger (§6). Existing Review code is untouched thanks to `scope DEFAULT 'review'` | **CHOSEN** |
| B. `aa_observations` on `experiment:experiment:<id>` | An observation is a valued fact about the subject. A factor is a user's claim about what *may have influenced* the result. It has no value, and the table would need `value_text` misused as free text | Rejected for factors. **Adopted for conditions** («условия изменились»), which the frozen page tags «наблюдение» |
| C. Review with subject `experiment:experiment` | Unsupported subject. No `baseline` role. `aa_experiment_observations` is not in the source-table CHECK. Review decision vocabulary is wrong for Experiments | Rejected |
| D. New `aa_experiment_factors` | Duplicates A's concept | Rejected (not needed) |

The choice follows the frozen product statement, so product semantics do not change.
`OWNER_DECISION_REQUIRED = NO` for this seam.

---

## 8. Durable queue — verified contract

### 8.1 Current behaviour (unchanged by Slice 6)

- **Enqueue.** `AnalyticsWriteQueue.enqueue` mints `idempotency_key` with
  `crypto.randomUUID()` at enqueue and throws if it is missing. It freezes `route` and
  `payload` (the key is written into the payload).
- **Head selection.** `first(userId)` = the lowest `queue_id` in **any** state.
- **Flush loop.** `AnalyticsSyncCoordinator.flushAsLeader` works on one record at a time and stops at the first:
  - `blocked_auth`;
  - `failed_permanent`;
  - `terminal_conflict`;
  - record whose `next_attempt_at > now` (backoff).

  Otherwise it replays exactly one record, removes it on success, and stops on the first failure.
  This is **FIFO + single-flight + head-of-line blocking.**
- **Failure mapping.**
  - 401 → `blocked_auth`;
  - 400/422 → `failed_permanent`;
  - 409 → `terminal_conflict`;
  - network/408/425/429/5xx → backoff;
  - **anything else (403, 404, 415) → `failed_permanent`**.
- **Replay guards.** `replayQueuedWrite` requires `payload_schema_version === 1`, a route
  under `/api/v1/aa/` without `..`, and `payload.idempotency_key === record.idempotency_key`.
  It always POSTs.
- **Leader election.** Web Locks `aa-write-queue` with `ifAvailable`. Correctness without
  locks rests on server idempotency.

### 8.2 Consequences for Experiment writes

- A child route (`/experiments/<id>/…`) needs the id at enqueue time. A client-minted UUID v4
  satisfies this, so there is **no queue change and no schema-version bump**.
- If a parent create fails, it blocks every later child.
- **User discard (`discardQueueFailure`).** After the user discards a failed create, children
  replay and receive **404 `experiment_not_found`** → `failed_permanent`. The result is
  visible and never silently applied. No queue change is needed; the Plan tests this.
- **Duplicate enqueues are not blocked.** Two tabs, or the automatic "period over" transition,
  can enqueue the same transition target with different keys. The server must answer the
  second with 200, not 409 (§9). Otherwise a benign duplicate dead-letters the head and
  stalls all AA writes.

`QUEUE_CHANGE_REQUIRED = NO`.

---

## 9. Lifecycle — reconciled strategy

Kept from the old Discovery:
- TEXT + CHECK lifecycle;
- per-state instant + key columns (the graph is a DAG, so each state is entered at most once);
- row-shape CHECKs that make every illegal path unrepresentable;
- the service as the single writer;
- an owner-scoped load;
- a legal-edge table;
- a predicate CAS `WHERE lifecycle = :from`;
- `409 invalid_transition`;
- the client `occurred_at` stored truthfully;
- `RUNNING → COMPLETED_AWAITING_REVIEW` only after `window_end` has elapsed in the
  experiment's IANA timezone;
- a decision never changes lifecycle.

Added by this reconciliation:
- **Target-idempotence.** A replay with the same key returns 200. A request whose target
  state's instant is already set (the state was entered on this row's path) returns
  **200 `no_op`** and stores nothing, whatever key it carries. A CAS loser re-reads and
  lands in one of these two cases.
- **Truly illegal edges → 409 `invalid_transition`.** This covers a target never reached
  and no longer reachable, and any edge out of a terminal state to an unentered state.
- **Key reuse.** A key already stored in another key column or on another experiment →
  409 `idempotency_key_reused`.
- **Period completion.** A client transition, enqueued automatically by the page when the
  client's local today is after `window_end`. The server re-checks against its own clock.
  A GET never writes.
- **ABANDONED transition guard.** It fails with 422 `invalid_time` if an active adherence row
  exists for a local day after `local_date(abandoned_at, tz)`. This keeps "no stored row after
  the stop day" a true invariant.

---

## 10. Adherence and temporal semantics — reconciled

These are unchanged from the old Discovery and confirmed against `coverage.classify_days`:

- **Stored states.** Storage is `kept | missed | unknown` only. There is one active row per
  (experiment, local day): partial unique on `status = 'active'`. A change is a CORRECTION
  supersession, never an in-place update.
- **Derived states** (never stored): `future`, `not_recorded`, `not_run_after_stop`.
- **Writable days.** A day is writable only while the lifecycle is `RUNNING` or
  `COMPLETED_AWAITING_REVIEW`, and only if `window_start ≤ day ≤ window_end` and
  `day ≤ local_today(tz, server now)`. Today counts as elapsed.
  - A future day → **422 `adherence_day_future`**.
  - A day outside the window → 422 `adherence_day_outside_window`.
- **Abandon day.** It is the local date, in the experiment's timezone, of the client-supplied
  `abandoned_at`.
  - Days in `(abandon_day, window_end]` are derived `not_run_after_stop`. They are never
    `missed` and never in the denominator.
  - Pre-abandon rows are retained.
  - After ABANDONED, every evidence write is **409 `experiment_not_accepting_evidence`**.
- **Denominator.** `elapsed = |{d ∈ window : d ≤ min(local_today, abandon_day?)}|`.
  - Running example: «6 / 9 прошедших · период 21 дн.», never 6/21.
  - Completed example: «9 из 14».
- **Invariants:**
  - `kept + missed + unknown + not_recorded = elapsed`;
  - `elapsed + future + not_run_after_stop = total_days`.
- **Missing vs unknown.** Missing (no row → `not_recorded`) is distinct from explicit `unknown`.
- **Not applicable.** Adherence is **not applicable** for `DRAFT` and for
  `ABANDONED` with `abandoned_from = DRAFT`. The experiment never ran, so no day is "not recorded".

---

## 11. Outcome / observation semantics — reconciled

- **`aa_experiment_observations`** is the Plan-named table, on the shared fact template.
  - `role` is `outcome` or `context`.
  - `metric_key` is **NULL only**. There is no catalogue metric, and none is invented.
  - The subject is pinned to `experiment:experiment:<experiment_id>` by CHECK.
  - An `outcome` value must match the experiment's outcome definition (type/unit/scale).
  - A `context` value may be any legal shape, including categorical «чаще «нормально»».
- **Outcome definition.** It lives on `aa_experiments`: `label`, `value_type ∈
  {money, duration, count, scale}`, and unit/scale. Categorical and date are excluded because
  `compute_delta` cannot or should not subtract them.
- **Baseline** reuses `aa_baselines` on the experiment subject. It is written through an
  experiment-guarded route that validates shape and lifecycle. There is no new table.
- **Conditions** reuse `aa_observations` on the experiment subject: categorical text plus
  `epistemic_kind`, written through an experiment-guarded route.
- **Result:**
  - the operands are the latest active baseline and the latest active outcome observation;
  - the difference is `compute_delta(outcome, baseline)`;
  - `desire` is **always `neutral`**. No Target or Preference exists for an experiment, and
    Experiment choices carry no direction.
  - The result is **not computed** while RUNNING (`too_early`, interim value shown). It is
    **not applicable** for DRAFT and for experiments abandoned before completion.
- **No server aggregation.** The server does not average daily values. An outcome
  observation is a user-reported *period-to-date* value. The response exposes the day it
  covers, so the UI can say «на 9-й день из 14». «Дней с записью» is never stored.
- **Hypothesis ≠ fact.** The hypothesis is an immutable column rendered as a claim. There is
  no `HYPOTHESIS` source kind.
- **Result ≠ causal proof.** No causal field exists in the schema or response. The copy is
  fixed.

---

## 12. Tests that M6 forces to change (identified statically)

| File:line | Current pin | Required update |
| --- | --- | --- |
| `test_aa_reviews.py:685` | `("ck_aa_decisions_choice", ReviewDecisionChoice)` | `ck_aa_decisions_review_choice`, subtracting `'review'` from the quoted set; add the experiment CHECK |
| `test_aa_reviews.py:731-738` | `get_heads() == ["20260928_0006"]` | Assert chain position (M5 `down_revision == 0005`) and that M6 is the head. Same pattern Slice 4 used for M4 |
| `test_aa_project_analytics.py:637` | heads == `["20260928_0006"]` | new head |
| `test_export.py:71`, `test_aa_reviews.py:644`, `test_aa_semantic.py:650` | manifest `alembic_revision == "20260928_0006"` | M6 revision |
| `smoke.test.jsx:47`, `route-registry.test.ts:37` | `LIFE_ROUTES.size === 20` | 21 |
| `lazy-routes.test.jsx`, `locale-shape.test.ts` | loader map / key counts | + `experiment` loader; + `aa_ex_*` keys |

---

## 13. Risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| R-1 | Scope-crossing choices | Two scope-dependent CHECKs, separate Python enums, both parity-tested |
| R-2 | Factor revision numbers mean different ledgers per scope | Documented in the model: review scope → `aa_review_revisions.revision`; experiment scope → `aa_decisions.revision` of that experiment. Service-enforced; tested |
| R-3 | A duplicate transition dead-letters the queue head | Target-idempotent 200 no-op |
| R-4 | A user discards a failed create, then children replay | Children 404 → visible `failed_permanent`. Tested |
| R-5 | Offline replay stamps a server time | Client `occurred_at`, validated ≤ now + 5 min skew and monotonic |
| R-6 | An outcome recorded daily is misread as a period value | UI input framed as «значение за период на дату». Result exposes `outcome_day`/`covered_days` |
| R-7 | Frozen demo shortcuts (kept-first fill; decision-driven stage status) | Not ported. Days in calendar order from the server; stages from lifecycle only |
| R-8 | Parent-plan §22 errata ("only if no row uses ABANDONED"; "adding ABANDONED is DROP/ADD") | Recorded as errata in the Plan. The frozen plan is not edited |
| R-9 | A second parallel session changes `main` before implementation | `FINAL_REVERIFY_REQUIRED = YES` |

---

## 14. Owner decisions

**None required.** The Plan has non-blocking defaults. Each is the most conservative reading
of D4, the Phase B Plan §24.9 and the frozen I page:

1. Decisions and factors are writable only in `COMPLETED_AWAITING_REVIEW` and `REVIEWED`.
   ABANDONED stays terminal for new decisions. Rows written earlier are retained.
2. The hypothesis, window and outcome definition are immutable after create. A new attempt is
   a new experiment. `modify`/`longer` never reopen a terminal experiment.
3. The outcome is a user-reported period-to-date value. There is no server averaging.
4. Entry point: one analytics-gated Sidebar item «Эксперименты» (also reachable through the
   mobile «ещё» drawer). There is no Home signal (that would be a fifth rule).

---

```
RECONCILIATION_STATUS=PASS
PINNED_BASELINE=414df142700653d616016ff644bff3d9c0007540
CURRENT_ALEMBIC_HEAD_STATIC=20260928_0006
CURRENT_AA_TABLE_COUNT_STATIC=19
AA_DECISIONS_ALTER_REQUIRED=YES
FACTOR_SEAM_CHOICE=A (widen aa_review_factors: scope + experiment_id, review_id nullable)
QUEUE_CHANGE_REQUIRED=NO
OWNER_DECISION_REQUIRED=NO
PRODUCTION_FILES_CHANGED=NO
```
