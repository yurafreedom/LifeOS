# LifeOS · Adaptive Analytics · Slice 6 · First-Class Experiments (I) — Implementation Report

Status: **implemented and validated on `feat/adaptive-analytics-slice-6-experiments`**.
No deploy. Normal merge-commit PR.

## 1. Start state and sources

| Item | Value |
| --- | --- |
| Start `main` / `origin/main` | `414df142700653d616016ff644bff3d9c0007540` (PR #15 merge); no open PRs |
| Checkout | canonical `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem`, clean, one worktree |
| Recovery stash | `51184836ace557fbd9492527bd845329b17b2a76` present (stash@{0}), untouched |
| Frozen tag | `adaptive-analytics-design-accepted` → tag `6c507b82…` → commit `d4960286…`, unmoved |
| Plan (external, exact) | `/Users/yurasachenko/LifeOS/_parallel_planning/slice6/lifeos-adaptive-analytics-slice-6-experiments-final-plan-candidate.md` — 1022 lines (`wc -l`; the file has 1023 lines by a trailing-line count), 64 593 bytes, SHA-256 `4e41ece863069a6c562fa52834c33ef7fcd930a8764bc50f8441be21d025a8e5` (**matches the expected identity**) |
| Reconciled Discovery (external) | `…/slice6/lifeos-adaptive-analytics-slice-6-experiments-reconciled-discovery.md` — 442 lines, 29 314 bytes, SHA-256 `506137a649d5f164204aeb5a63fd9f4a23da13ef282aa36374e2d5b3bb7887e1` |
| Repo copies (byte-identical, same hashes) | `Outputs/Plans/lifeos-adaptive-analytics-slice-6-experiments-plan_20260929-195821.md`, `Outputs/Discoveries/lifeos-adaptive-analytics-slice-6-experiments-reconciled-discovery_20260929-195821.md` |

Both external files were read in full, then `AGENTS.md`, `CLAUDE.md`,
`LIFEOS_MASTER_CONTEXT.md`, `module-boundaries.md`, the relevant merged code and
frozen `ui_kits/life-os-analytics/experiment.jsx` / `analytics.css` from the tag
(product reference only; no demo value ported).

## 2. Final serial reverify

`FINAL_REVERIFY_STATUS=PASS`, `RECONCILIATION_DRIFT=none`. `main` had not moved.
Confirmed against live code: M5 decision/factor constraint names exactly as the
Discovery states (`ck_aa_decisions_{scope,review_scope,choice,revision,superseded_order}`,
`uq_aa_decisions_current_review`; `aa_decisions` has no idempotency column; Review
replay anchored on `aa_review_revisions`); Review choices `keep|adjust|later|inconclusive|NULL`;
`EXPORT_TABLES` 19 = mapped 19 = DB 19; `TRUNCATED_TABLES`; `FACT_TABLES`;
`SOURCE_REDACTORS=(redact_review_context,)`; four rule modules; `schema_version`
`Literal[2]`; Alembic single head `20260928_0006`; coordinator FIFO + single-flight
+ head blocking on `blocked_auth`/`failed_permanent`/`terminal_conflict`/backoff;
`discardQueueFailure` present; test pins at the lines Discovery §12 lists.
`OWNER_DECISIONS_OPEN=0`.

Baseline before code (actual): backend **420 passed** (`lifeos_test`), ruff clean,
compileall OK, Alembic head/current `20260928_0006`; frontend **316 passed / 31 files**,
typecheck/lint/build clean, entry JS 322.11 kB, no 500 kB warning.

## 3. Commits

| SHA | Commit |
| --- | --- |
| `53d7f99` | docs: add reconciled Slice 6 experiment plan |
| `644aade` | Add M6 experiments schema, widen decisions and factors by scope |
| `2696156` | Add Experiment lifecycle, evidence and decision service with API |
| `ae55ff8` | Add Experiment page with stages, adherence, result and decision |
| `ed55814` | Keep the last acknowledged experiment on a failed re-read (browser-QA fix) |
| (this) | Record Slice 6 implementation report and context |

## 4. M6 schema

`alembic/versions/20260929_0007_aa_experiments.py`: **revision `20260929_0007`,
down_revision `20260928_0006`**, frozen SQL strings, C8 docstring. Single linear head.
AA tables **19 → 22** (mapped = `EXPORT_TABLES` = DB = 22). No `aa_experiment_factors`.
No pre-AA table, no Project/Goal table, `user_snapshots` untouched.

New tables:

- `aa_experiments` (state entity): client UUID `id`, claim columns (title, hypothesis,
  `hypothesis_recorded_at`, intervention, window, IANA timezone, outcome definition
  `money|duration|count|scale` + unit/scale), `lifecycle`, per-state instant + key
  pairs (`started_at/start_key`, `completed_at/complete_key`, `reviewed_at/review_key`,
  `abandoned_at/abandon_key/abandoned_from`), create `idempotency_key`. Every CHECK
  in Plan §4.1 by exact name (lifecycle, lifecycle_shape, abandoned_from,
  abandon_shape, four pair CHECKs, instant_order, window order/length ≤ 365,
  outcome type/shape, text bounds); five `(user_id, key)` uniques; two indexes. No trigger.
- `aa_experiment_adherence`: owned + provenance + supersession + idempotency mixins,
  `experiment_id` (CASCADE), `day`, `state ∈ {kept, missed, unknown}` only,
  CORRECTION-only supersession, partial unique active row per `(experiment_id, day)`.
- `aa_experiment_observations`: shared valued-fact template, `role ∈ {outcome, context}`,
  label, `occurred_at/occurred_tz`, subject pinned to `experiment:experiment:<id>`,
  `metric_key IS NULL`, outcome rows comparable types only.

`aa_decisions` (ALTER): `+experiment_id` (FK CASCADE), `+idempotency_key`;
`ck_aa_decisions_scope` → `scope IN ('review','experiment')`;
`ck_aa_decisions_review_scope` → `ck_aa_decisions_parent` (exactly one parent);
`ck_aa_decisions_choice` → **`ck_aa_decisions_review_choice`**
`scope <> 'review' OR choice IS NULL OR choice IN ('keep','adjust','later','inconclusive')`
and **`ck_aa_decisions_experiment_choice`**
`scope <> 'experiment' OR choice IS NULL OR choice IN ('keep','modify','longer','reject','inconclusive')`;
`ck_aa_decisions_idempotency` `(scope='experiment') = (idempotency_key IS NOT NULL)`;
`uq_aa_decisions_idempotency_key (user_id, idempotency_key)`;
partial uniques `uq_aa_decisions_current_experiment`, `uq_aa_decisions_experiment_revision`.
`ck_aa_decisions_revision`, `ck_aa_decisions_superseded_order`, `uq_aa_decisions_current_review` unchanged.

`aa_review_factors` (ALTER, factor seam A): `+scope TEXT NOT NULL DEFAULT 'review'`,
`+experiment_id` (FK CASCADE), `review_id` nullable, `ck_aa_review_factors_scope`,
`ck_aa_review_factors_parent`, `uq_aa_review_factors_experiment_ordinal`. Review
`persistence.py` unchanged (the default writes `review`).

Downgrade (disposable/pre-write only): deletes experiment-scoped decisions and
factors, restores **exactly** M5 (tested by `pg_get_constraintdef` + index + column
comparison against a freshly created M5), then drops the three tables.

## 5. Semantics as implemented

**Lifecycle.** Legal edges DRAFT→RUNNING, DRAFT→ABANDONED, RUNNING→CAR, RUNNING→ABANDONED,
CAR→REVIEWED, CAR→ABANDONED. REVIEWED and ABANDONED terminal. Order: owner load
(404 identical for missing/foreign) → same-key replay (200 `replayed`) → key reuse
(409 `idempotency_key_reused`) → target already entered on this row's path
(**200 `no_op`, nothing written, second key not stored**) → legality (409
`invalid_transition`) → preconditions (422: client instant aware, ≤ server + 5 min,
monotonic; RUNNING needs local day ≤ window_end; CAR needs local day of `occurred_at`
and server local today > window_end in the experiment's IANA zone; ABANDONED refused
if an active adherence row lies after the stop day) → CAS `UPDATE … WHERE lifecycle=:from`.
Client `occurred_at` is stored, never the receive time. REVIEWED needs no decision.
A decision write never touches lifecycle; the transition code never reads decisions.

**Adherence.** Writable only in RUNNING/CAR, only for window days ≤ server local
today (future → 422 `adherence_day_future`, stores nothing). One active row per day;
a change must name the key of the answer it corrects (else 409 `adherence_day_recorded`)
and is appended as a CORRECTION successor in one statement. Derived states
`future`, `not_recorded`, `not_run_after_stop` are never stored. Abandon day = local
date of client `abandoned_at`; later days are `not_run_after_stop` and leave the
denominator; post-abandon writes 409 `experiment_not_accepting_evidence`; pre-abandon
rows retained. Invariants asserted: kept+missed+unknown+not_recorded = elapsed;
elapsed+future+not_run_after_stop = total. Not applicable for DRAFT / abandoned-from-DRAFT.

**Evidence.** Outcome/context → `aa_experiment_observations` (outcome must match the
definition, else 422 `outcome_shape_mismatch`; local day inside the window). Baseline
→ existing `aa_baselines` via unchanged `append_semantic` (DRAFT/RUNNING only; window
must end before the experiment starts). Conditions → existing `aa_observations`
(categorical text + epistemic kind, RUNNING/CAR). Replay keys belonging to another
experiment/subject → 409. No catalogue metric, no server averaging.

**Result.** `not_applicable` (DRAFT; abandoned from DRAFT/RUNNING; operands still
listed) · `too_early` (RUNNING; interim value exposed; delta unknown
`period_not_finished`) · `no_data` (missing operand) · `known`
(`compute_delta(latest outcome, latest baseline)`), **desire always `neutral`**
(`desirability(outcome, None)`), no grounding. No `cause/because/effect/score/recommend*/suggest*`
key in any response or column (recursive test).

**Decision/factors.** Every save appends an experiment-scoped decision revision with
its own key (the experiment's revision ledger); choice required-but-nullable (omitted
→ 422, never NULL); allowed only in CAR/REVIEWED (else 409
`experiment_not_awaiting_decision`); factors added/retracted/replaced by revision,
never across experiments or into Review factors. Tri-state: no row ≠ NULL ≠ `inconclusive`.

**Create.** Client UUID v4; replay by `(user, key)` requires every client field equal
(else 409); any existing id (own under another key, or foreign) → generic 409
`experiment_id_unavailable`, byte-identical body, nothing read from the other row.

## 6. API (`/api/v1/aa`, `routes/aa_experiments.py`)

`POST /experiments` · `GET /experiments?lifecycle=…&limit=` · `GET /experiments/{id}` ·
`POST /experiments/{id}/{transition,adherence,observations,baseline,conditions,decision}`.
Writes: `require_json_content_type` + write gate as route dependencies (**415 before
422**), same-origin, session ownership, `extra="forbid"` (body `user_id` → 422),
`RequestValidationError` → 422 `invalid_experiment`. Reads: auth only, pure, no gate.
Error codes added to `_ERROR_STATUS` per Plan §7.3. `PENDING_LIFECYCLES =
(DRAFT, RUNNING, COMPLETED_AWAITING_REVIEW)` exported from the facade for Slice 7.

## 7. Privacy / export / delete

`EXPORT_TABLES` +3 (all statuses, every decision revision and factor via the existing
tables); `TRUNCATED_TABLES` +3; `aa_deletion.FACT_TABLES` + `aa_experiment_observations`
only (generic tombstone/hard delete/provenance). Adherence deliberately not in
`FACT_TABLES`. `SOURCE_REDACTORS` and Review CHECKs unchanged. Account deletion
cascades from `users`; tested zero rows across all 22 tables for the deleted account.

## 8. Frontend

- Data: `api/analytics/experiments.ts` (+1 facade line); `analytics/experimentFacts.ts`
  (builders, `newExperimentId()` requires `crypto.randomUUID`, no fallback; hash
  routing; `decisionSaveRequests`; local-day helpers for UI enablement only);
  `analytics/experimentQueue.ts` (read-only queue helpers kept out of the builders so
  the eager context does not pull them into the entry chunk); repository reads;
  `AnalyticsContext.enqueueExperiment/readExperiment/listExperiments/pendingExperimentWrites`.
  **No queue, coordinator or replay change.**
- Route `experiment` (`#/experiment`, `#/experiment/new`, `#/experiment/<uuid>`),
  lazy (`LAZY_ROUTE_LOADERS.experiment`), one `renderRoute` case, `LIFE_ROUTES` 21.
  One Sidebar item (`flag` icon, `nav_experiments`) only when `ANALYTICS_ROUTE_ENABLED`
  (passed from `App.jsx` as a prop to avoid a components→app import).
- `AAExpStages` (lifecycle only), `AAAdherence` (server days in calendar order;
  `is-kept/missed/unknown/not-recorded/future/after-stop`, localized per-day
  aria-labels). Detail: header + status, stages, dashed hypothesis claim, `AAFacts`
  (baseline/intervention/period), adherence + quality line + conditions, observations
  with provenance, result through **unchanged `AADelta`** (notes only), decision
  choices (5 + «Пока без решения») + `AAFactorTag`, plain-text history (consecutive
  equal choices collapsed). Stop dialog DRAFT/RUNNING only (D4), focus trap, Escape,
  focus return. Actions are ordered queue records (create → baseline → start;
  decision → REVIEWED). «Period over» auto-enqueued once. Pending/failed queue
  records shown beside server truth with export/discard; an unacknowledged create is
  shown from its queue record, marked «ещё не сохранено на сервере».
- RU/UK: 175 keys each (`aa_ex_*` + `nav_experiments`), UK written in Ukrainian;
  counts ru 906→1081, uk 905→1080. `analytics.css` Slice 6 block; no demo chrome.

## 9. Validation (final, actual)

| Check | Result |
| --- | --- |
| `apps/api: python -m pytest` (`lifeos_test`) | **602 passed** (420 → 602) |
| ruff / compileall | pass / pass |
| `alembic heads` / `current` (`lifeos_test`) | `20260929_0007 (head)` / `20260929_0007 (head)` |
| DB `aa_%` tables | 22 |
| `apps/web: npm test` | **375 passed / 33 files** (316 → 375) |
| typecheck / lint / build / build --manifest | pass / pass / pass / pass |
| `git diff --check` | pass |
| Import cycles (static graph, script) | frontend 0, backend import-time 0 (baseline 0/0) |
| Signal rules | exactly 4 (tested) |
| Snapshot / server schema version | 2 / 2 (tested) |

New suites: `test_aa_experiment_migration.py` (53), `test_aa_experiment_lifecycle.py`
(75), `test_aa_adherence.py` (21, **T-07**), `test_aa_experiments.py` (31, **T-08**,
T-09 precursor, T-14, T-15, E8–E12); `analytics-experiment.test.ts` (21, F1–F6, F13),
`analytics-experiment.test.jsx` (33, F7–F12, F14–F16). Updated pins (not weakened):
review choice parity split into review/experiment CHECKs + factor scope; M5 roundtrip
now asserts M6 on M5; head pins in project analytics; export manifest revision (3
files); `LIFE_ROUTES.size` 21 (2 files); lazy loader map; locale counts. T-12 suite
unchanged and green.

Bundle (default build): entry JS **322.11 → 323.34 kB**; new lazy chunk
`ExperimentPage` **42.72 kB** (10.51 kB gzip); CSS 148.00 → 152.57 kB (Slice 6 block of
`analytics.css`); `LocaleContext` chunk 103.95 → 126.79 kB (RU/UK copy). With
`VITE_LIFEOS_ANALYTICS_ENABLED=true` the entry is 335.97 kB. No 500 kB warning.

## 10. Browser / visual QA

Headless Chrome over DevTools (Node built-ins), production build with analytics
enabled via `vite preview`, local API on **lifeos_test**, throwaway bootstrapped QA
user, data seeded through the real API with the real clock (DRAFT; RUNNING with
kept/missed/unknown/not-recorded/future; RUNNING with no adherence; CAR with a result;
REVIEWED keep / NULL / inconclusive; ABANDONED from RUNNING with 16 post-stop days;
a RUNNING experiment whose window had ended; unknown id).

- Matrix 390/768/1440 × dark/light/paradise × 12 screens (list, new, 9 details,
  not-found) = **108 screens**, every screen a fresh document load (deep-link refresh),
  all settled. Only logged errors: the expected first-login `GET /api/v1/state` 404
  and the deliberate unknown-id 404 — **0 application exceptions / console errors**.
- Horizontal overflow: none, except paradise at 768 px (+16 px) which also occurs on
  untouched `#/home`, `#/tasks`, `#/projects`, `#/settings` from `ParadiseScene`
  `ps-layer` backdrops — **pre-existing**, not attributed.
- UK (switched in Settings → оформление, client-side navigation) 390 + 1440 × 12 =
  24 screens: 0 Russian-only letters outside seeded data, 0 overflow.
- Flows: Sidebar «эксперименты» → `#/experiment`; list item → detail → `history.back()`
  → list; stop dialog: focus moves in, 3× Tab stays inside, Escape closes, focus returns
  to «Прекратить эксперимент», lifecycle unchanged; «period over» auto-transition
  applied exactly once (`completed_at` set once).
- Queue: gate closed → adherence write refused (403) → «Не принято сервером · 1» with
  export/discard, server truth still «не записано», discard clears it. API down →
  «Есть записи, ещё не подтверждённые сервером: 1» with the last server state kept;
  API back + `online` → drained, correction applied (`unknown` superseded/CORRECTION,
  `missed` active).
- Full-page screenshots reviewed (dark 1440/390 RUNNING, light 1440 REVIEWED, paradise
  1440 ABANDONED, dark 768 CAR, light 390 list, dark 1440 new).

QA finding fixed in `ed55814`: a failed re-read while offline blanked the detail; it
now keeps the last acknowledged state beside the pending note.

## 11. Corrections / deviations from the candidate

1. **CAS loser settles, never re-decides.** Plan §6.3 step 7 says "re-enter at step 2",
   which would let a DRAFT→ABANDONED request that lost to DRAFT→RUNNING apply
   RUNNING→ABANDONED (both applied — found by the L6 race test). The Plan's own text
   ("lands on replay, no-op or 409"), L6 ("never both applied") and the master prompt
   ("concurrency mismatch → 409") agree on the implemented rule: after a lost CAS the
   request re-reads and returns replay / no-op / `invalid_transition` only.
2. **Mobile entry.** The Plan asks to add the item to the «ещё» drawer if `more` does
   not open the Sidebar. There is no drawer: `more` navigates to Settings and the
   Sidebar is hidden under 640 px, exactly as for Projects, Goals, Finances. No new
   mobile navigation was invented; mobile reach is the deep link, like the other LIFE
   routes. Recorded as backlog.
3. **Dead-letter UI.** The only existing failure UI lives inside the Finance page, so
   the Experiment page lists its own failed records with the existing
   `discardQueueFailure` / `exportQueueFailure` context functions (no queue change).
4. **Interactive tests.** There is no DOM test environment and adding one would be a
   dependency, so decision→REVIEWED ordering (`decisionSaveRequests`) and the dialog
   focus step (`focusStep`) are pure helpers under unit test; focus trap/Escape/return
   were verified in the real browser.
5. **Adherence copy** uses «дн.» (as in the Plan's copy) so no plural form is wrong for 1/21.
6. `experimentQueue.ts` is an extra module (not in the Plan table) to keep the builders
   out of the entry chunk (entry +1.23 kB instead of +5.19 kB).
7. Factor re-tagging in the decision editor is sent as retract + add with `replaces_id`.

No product semantic was changed; no owner decision was needed.

## 12. Known backlog (not done here)

- Mobile navigation to LIFE routes (no drawer) — pre-existing, all routes.
- Paradise 768 px backdrop overflow — pre-existing (`ps-layer`).
- Per-experiment deletion, editing the claim, as-of experiment reads, correcting an
  outcome observation (use tombstone/hard delete), Home signal — out of scope by Plan.
- Slice 7 (System Review / trade-off) consumes `PENDING_LIFECYCLES`; Slice 8 retention.

## 13. Invariants

Dependencies added: **none** · deploy: **no** · force-push/rebase/reset: **no** ·
recovery stash retained · frozen tag unmoved · one worktree · snapshot `version` 2 /
server `schema_version` 2 · exactly four signal rules · no Project/Goal coupling · no
activityLog use · no Slice 7/8 work · no `dist/` committed.

Verdict: **SLICE_6_STATUS=PASS** (pending normal-merge of the PR).
