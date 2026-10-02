# LifeOS Adaptive Analytics — Slice 8 · Retention / Legacy / Hardening
## PROVISIONAL Plan candidate

Generated: 2026-09-29 · Claude Code (Opus 5.5) · parallel planning wave
Pinned baseline: `414df142700653d616016ff644bff3d9c0007540` (Slice 5 merged; Slices 6/7 absent)
**PLAN_FINALITY = PROVISIONAL.** A final Slice 8 Plan cannot exist until Slice 7 merges. Nothing here authorizes
implementation, migration or deletion. Companion artifacts: reconciled Discovery, dependency matrix, owner-confirmables.

---

## P-0. Settled principles (owner authority — not reopened)

AA retention separate from `activityLog` (D2) · default **UNLIMITED** (D2) · `activityLog` never imported into AA (D3) ·
`activityLog` cleanup never touches AA · hard erasure wins over frozen Review source-derived evidence (D1) ·
user-authored durable entities specially preserved · missing ≠ zero · retention-truncated ≠ unknown ≠ never-recorded ·
nothing disappears silently · post-personal-history rollback is non-destructive (C8).

## P-1. Sequencing

| Step | What | Where | Gate |
|---|---|---|---|
| **S8-0** | **F3 cursor fix** + regression test | **Recommended: small dedicated correctness PR before Slice 8** (can land now, independent of S6/S7). Fallback: first commit of Slice 8, before any EXPLAIN work | tests on `lifeos_test` |
| S8-1 | Final reverify after Slice 7 merge (matrix §5, Discovery §8) | planning | produces FINAL Plan |
| S8-2 | Truthful-truncation read contracts (history, finance month, coverage, signals zero-state, Project Analytics, S6/S7 reads) — **no deletion yet**; driven by a horizon that is always `NULL` until an apply exists | code | contract tests |
| S8-3 | M8 schema: retention policy (+ run log if O4 = run-level) | migration | `lifeos_test` up/down roundtrip; registry parity |
| S8-4 | Policy GET/PUT + preview (read-only consequences + counts) | code | API tests |
| S8-5 | Bulk redaction primitives (Review + provenance), no caller yet | code | residue tests |
| S8-6 | Apply engine (lock → eligibility → redact → delete → record) | code | destructive tests on `lifeos_test` only |
| S8-7 | Settings UI (separate section), RU/UK | web | vitest + parity |
| S8-8 | Opt-in performance/EXPLAIN evidence; indexes only from evidence | `lifeos_test` | recorded in report |
| S8-9 | D3 finalisation: static T-17 scan | test | — |

Rationale for S8-0 as its own PR: F3 is a live silent-omission defect today (legacy imports share local-midnight
`occurred_at`), unrelated to retention, and the performance plan must target the fixed query shape.

### S8-0 detail (for the correctness PR — not implemented here)
- `services/aa_facts.py` `read_history`: replace Python tuple comparison with
  `tuple_(AAMeasurement.occurred_at, AAMeasurement.id) > tuple_(cursor_occurred_at, cursor_id)` (precedent:
  `routes/aa_history.py:211`).
- Regression: N (> 2×limit) rows with **identical** `occurred_at`, page through with small `limit` ⇒ union of pages
  = full set, no duplicates, strictly increasing `(occurred_at, id)`, deterministic across repeats; plus mixed
  distinct/equal timestamps straddling a page boundary; plus `as_of` variant.
- Optional static guard: no Python-tuple comparison of SQLAlchemy columns in `app/` (grep-level test).

## P-2. Semantic age axes (eligibility)

| Concept | Axis | Unit |
|---|---|---|
| Measurement (non-project) | `occurred_at` | whole chain; finance: whole local month |
| Observation (non-project) | `occurred_at` | whole chain |
| Coverage | `window_end_date` | whole chain; never split a claim window |
| Expectation / Baseline / Target | `window_end` (and `effective_from` where present) | whole chain + window |
| Forecast / Project Actual / Project observations | Project unit (completion Actual `occurred_at`, all forecast `horizon_at` & `recorded_at`, all observations) | whole Project unit; only when completion Actual exists |
| Preference / Metric policy | in-force rule | chain containing a version in force at/after horizon is retained whole |
| Membership override | follows its measurement (CASCADE) | never selected directly |
| Signal episode | subject window | wholly pre-horizon windows / pruned Project units |
| Reviews, revisions, factors, decisions, S6/S7 user entities | — | **never age-pruned** |

Eligibility predicate: *every* member of the unit has semantic time < horizon. `recorded_at` never decides alone
(legacy imports recorded yesterday for 2019 must not evade; partial windows must not arise). Never `created_at`.

## P-3. Horizon

- Computed in the user's IANA zone (same zone parameter as finance month), aligned to **local month start**:
  `horizon_date = first_day_of_month(local_today − retain_months)`; stored as `date` + `timezone`.
- Horizon semantics: "history before X was deleted at time T by the user's policy" — **not** "no data may exist
  before X". A post-apply write with pre-horizon `occurred_at` is accepted and shown; reads for pre-horizon ranges
  disclose truncation alongside whatever exists (Plan choice P-D3 below).
- Applied horizons are durable and monotone: returning to UNLIMITED keeps disclosing the latest applied horizon.

## P-4. Retention policy model (candidate)

```
aa_retention_policies        (append-only versions; NO ROW = UNLIMITED)
  id uuid PK · user_id → users ON DELETE CASCADE · created_at
  mode text CHECK IN ('unlimited','finite')
  retain_months int NULL      CHECK ((mode='unlimited') = (retain_months IS NULL))
                              CHECK (retain_months IS NULL OR retain_months IN (<O3 list>))
  consequences_version text NULL   CHECK (mode='unlimited' OR consequences_version IS NOT NULL)
  confirmed_at timestamptz NULL    CHECK (mode='unlimited' OR confirmed_at IS NOT NULL)
  recorded_at timestamptz NOT NULL
  supersedes_id / superseded_by_id / superseded_at / status   (shared chain template, no ON DELETE)
  idempotency_key text NOT NULL  · UNIQUE(user_id, idempotency_key)
  partial UNIQUE(user_id) WHERE status='active'
```

- Versioned history, never update-in-place for the setting itself.
- **Finite policy does not delete.** Flow: choose → consequences + preview → explicit confirm → explicit apply.
- **Horizon location — OPEN** (depends on O4):
  - O4 = run-level (recommended): separate `aa_retention_runs(id, user_id, policy_id, horizon_date, timezone,
    preview_token, started_at, completed_at, per_table_counts jsonb, idempotency_key)`; applied horizon = max over runs.
    Policy rows stay pure intent. Never age-pruned; exported.
  - O4 = per-fact receipts: horizon columns on the policy row + `aa_deletion_receipts` per deleted fact (~180k rows).
- `aa_metric_definitions`, receipts, policy and run rows are never age-pruned (they are the disclosure).
- Migration M8: `down_revision` = head after Slice 7 (unknown). Additive only. Possibly also a CHECK swap on
  `ck_aa_review_context_items_redaction_reason` if P-D2 chooses a retention reason. Downgrade only pre-personal-data (C8);
  dropping the table after an apply would lose horizon disclosure ⇒ treated as personal AA history.

## P-5. Deletion engine (candidate, not final order)

See dependency matrix §4. Summary per unit/batch transaction:
lock (`pg_advisory_xact_lock` per user retention key) → re-validate preview token & policy → eligibility under
`FOR UPDATE` → **bulk Review redaction** → **bulk provenance redaction** → signal episodes of pruned windows/units →
whole-chain `DELETE … WHERE id = ANY(:ids)` per table (overrides CASCADE) → run record / receipts → commit.

- New module candidate `app/services/aa_retention.py` (+ policy model, route). Bulk Review redactor lives in
  `services/reviews/redaction.py` next to the per-fact adapter and is exported through the facade
  (module-boundaries rule). Retention never calls `delete_fact` and never tombstones.
- Bulk Review redactor: `(db, user_id, sources: Iterable[(table, id)])`; lookup via
  `ix_aa_review_context_sources_user_fact` with `source_fact_id = ANY(:ids)` (+ `source_table` filter); same ERASED
  values; deletes all links of erased items. Never commits.
- Bulk provenance redaction: set-based over each FACT_TABLE's `source_ref` JSONB; must be **at least as conservative**
  as `_references()` (UUID or case-folded substring anywhere in keys/values). Candidate: `source_ref::text` containment
  against a temp set of pruned id strings, restricted to `user_id` and `source_ref IS NOT NULL`. Cost proven in S8-8.
- Bounded transactions: one per semantic unit class/month batch; a failed batch rolls back fully; runs are resumable
  and idempotent by `(user_id, horizon_date)`/run id; horizon is recorded only for completed batches (a partially
  applied run discloses the lowest fully-applied boundary — detail for final Plan).
- No per-fact 180k adapter loop unless S8-8 evidence proves it safe.

## P-6. Truthful truncation contracts (S8-2)

| Read | Today | Required after apply |
|---|---|---|
| `GET /aa/metrics/{key}/history` | pre-horizon range silently empty | `retention_horizon` + `truncated: true` when range starts before horizon; layer cursors same |
| `derive_month` (`/aa/finance/months/{period}`) | `present` with partial sum (F4) | month < horizon ⇒ distinct `availability` value (e.g. `retention_truncated`), `actual = null`, never 0, never `present` |
| coverage report | `unknown_coverage`, «не установлена» (F5) | pre-horizon days counted as a separate truncated bucket; distinct reason; never `observed`, never `unknown` |
| signals zero-state | `confident · unknown_coverage · no_data` | truncated windows excluded from discovery; zero-state never `confident` over truncated windows; `DISCOVERY_MONTHS` window clipped at horizon |
| Project Analytics | pruned unit ⇒ `no_facts` («ещё не записаны») | new state/flag (e.g. `history_deleted_by_retention`) distinct from `no_facts`; separate from the page-cap `forecast_versions_truncated`; «первая сохранённая оценка» never shown for a partial chain (impossible by unit rule) |
| as-of before horizon | residue | truncated/unknown, never post-deletion residue |
| Review reopen | — | redacted items «источник удалён»; wording for retention reason per P-D2 |
| S6 Experiment / S7 System Review, `/aa/changes` | n/a | **R-S6/R-S7**: horizon-aware, user entities retained, orphan endpoints rendered as deleted |

Horizon awareness is derived from the durable applied horizon (never inferred from missing rows). With no apply ever,
all responses are unchanged (backward-compatible additive fields).

## P-7. API candidate (provisional)

| Method / path | Purpose | Guards |
|---|---|---|
| `GET /api/v1/aa/retention-policy` | current mode (`unlimited`, `source: default` when no row), current policy version, applied horizon(s), consequence list + `consequences_version` | session auth; ownership from session |
| `PUT /api/v1/aa/retention-policy` | set unlimited / finite{`retain_months` ∈ O3 list}; finite requires `confirm: true` + current `consequences_version`; `idempotency_key` | `require_json_content_type` **as route dependency** (415 before 422); `enforce_same_origin`; **write gate: see P-D1**; body `user_id` rejected |
| `POST /api/v1/aa/retention-policy/preview` (or `GET …/preview`) | per-table counts, horizon, affected Review items count, Project units count; returns `preview_token` (hash of policy version + horizon + counts) | read-only |
| `POST /api/v1/aa/retention-policy/apply` | explicit execution: body `{preview_token, horizon_date, confirm: true, idempotency_key}` | JSON dependency; same-origin; **independent of AA write gate** (privacy action, like `/aa/facts` hard delete); `409 retention_preview_stale` if token/horizon/counts differ; `409` if mode unlimited (no-op, deletes nothing); replay returns prior run |

Changing the policy alone never deletes. No scheduler/background worker in v1. Policy change and apply are direct
calls, **never** via `AnalyticsWriteQueue` (offline replay of a destructive action would violate explicit confirmation).

**P-D1 (write-gate for policy PUT) — recommendation:** put policy **storage** behind `require_aa_write_enabled`
(it records a new personal preference, like other AA writes), but keep **apply** gate-independent. Counter-argument
recorded: a user who disabled recording and wants to *reduce* data should still be able to shrink history; mitigated
because apply works gate-closed only when a confirmed finite policy already exists. Final Plan must choose.

## P-8. Concurrency / idempotency

Per-user advisory xact lock for apply (and for policy PUT) · re-check eligibility under lock with `FOR UPDATE` ·
a concurrent correction either commits first (unit now straddles/contains a new member → re-evaluated, possibly
retained) or waits · bounded transactions per unit batch · idempotent by user + horizon / run id · export is
REPEATABLE READ → sees a consistent before-or-after snapshot · signal evaluation concurrent with apply must not
recreate episodes for truncated windows (discovery clipped at horizon).

## P-9. Performance plan (no execution now)

`lifeos_test` only, opt-in (pytest marker excluded by default or script reusing conftest `_test` guard); data via
`INSERT … SELECT generate_series`; cleaned by existing TRUNCATE; `ANALYZE`.
Dataset: account A ≈ 150k `aa_measurements` (~5y, many equal local-midnight `occurred_at`, 2–3 % chains,
~1 % tombstones), ~2k coverage, ~3k semantic versions, ~500 policy/override rows, some Reviews with sources;
account B ≈ 30k noise.
Queries (`EXPLAIN (ANALYZE, BUFFERS)`): actual history first/deep cursor (fixed `tuple_` shape) · 1m / 12m ·
with/without subject · current / `as_of` · semantic layer pages · coverage report stats · `derive_month` inputs ·
R3 stale input · `/aa/changes` (after S7) · retention eligibility + bulk redaction + whole-chain delete (in rolled-back
transactions). Record node types, rows, buffers, timings. Add indexes **only from evidence**.

## P-10. Test matrix (future; none run here)

1. default unlimited = no row; GET reports unlimited/default
2. unlimited apply deletes nothing (all `aa_*` counts identical)
3. finite PUT without confirm / stale `consequences_version` ⇒ 422/409, no change; PUT never deletes
4. stale preview token ⇒ 409 `retention_preview_stale`, no change
5. chain straddling horizon retained whole; whole pre-horizon chain pruned in one statement (proves NO ACTION timing)
6. override chains cascading with measurements (K12 proof)
7. in-force policy version and active preference chains preserved; C7 `policy_known` unchanged for post-horizon windows
8. month-aligned horizon in user zone (DST/month-edge cases)
9. finance month before horizon ⇒ truncated, never `present`/partial, never 0
10. coverage before horizon ⇒ truncated, never `unknown`/«не установлена», never `observed`
11. no baseline recomputed/fabricated; pruned baseline ⇒ `no_data` + truncation marker
12. Review redaction residue zero (all ERASED columns) and no links to pruned ids; notes/revisions/factors/decisions intact
13. provenance residue zero (no `source_ref` mentions a pruned id or cascaded override id)
14. durable horizon/run record written; exported; survives switch back to unlimited
15. activityLog cleanup changes no `aa_*` count; AA apply changes no `payload.activityLog`
16. static T-17: no AA module references `activityLog` (beyond `activity_log_imported: Literal[0]`)
17. F3 equal-timestamp cursor regression (S8-0)
18. 415 before 422 on every new unsafe route (+ sweep finance POSTs, K15)
19. account isolation: 404 cross-account, body `user_id` rejected; account deletion removes policy/runs
20. migration up/down on `lifeos_test`; export registry parity (mapped == registry == DB); manifest revision bump
21. performance evidence recorded (opt-in)
22. no partial Project history; pruned unit ⇒ retention state, not `no_facts`; open/Actual-less projects never pruned
23. S6/S7 user-authored entities preserved under final policy (R-S6/R-S7)
24. apply idempotent replay; concurrent apply serialized; concurrent correction race
25. queued offline write with pre-horizon `occurred_at` after apply: accepted and visible per P-D3

## P-11. Frontend (S8-7)

Separate Settings section «Хранение аналитической истории» / «Зберігання аналітичної історії», distinct from
`DangerSection.jsx` activityLog row (copy unchanged). Default «Без ограничений» / «Без обмежень». Finite flow:
duration (O3 list) → consequence disclosure (older baselines, repeated patterns, long-window coverage, long comparisons,
truncated finance months shown as deleted not zero, completed-project forecast history, old signal periods, Review
evidence redacted «источник удалён») → confirm → preview counts → apply. Horizon disclosure in history/quality strip:
«история до … удалена по вашему правилу хранения». RU/UK key parity. No frozen-design retention surface exists → build
from current Settings primitives. Direct API calls, fail visibly offline.

## P-12. Open Plan decisions (non-owner, engineering)

- **P-D1** policy PUT behind write gate? (rec: yes; apply gate-independent)
- **P-D2** Review redaction reason: reuse `source_hard_deleted` vs add `source_retention_pruned` (CHECK swap in M8).
  Rec: add distinct reason so Review can say "deleted by your retention rule"; D1 behaviour identical.
- **P-D3** pre-horizon writes after apply: accept + disclose (rec) vs reject.
- **P-D4** preview endpoint shape (POST vs GET) and token composition.
- **P-D5** batch granularity and partial-run horizon semantics.
- **P-D6** provenance set-based strategy (text containment vs JSONB path) — decided by S8-8 evidence + equivalence tests.

## P-13. Owner-confirmables

O1 finite scope (recommendation supplied) · O2 Review evidence redaction (recommendation: yes, D1) ·
**O3 durations — OPEN** · **O4 receipt granularity — OPEN**. See owner-confirmables memo. No owner approval is implied.

## P-14. Explicitly out of scope

Scheduler/background retention · activityLog changes · partitioning/materialized views · any deletion of user-authored
entities · tombstone-based retention · changing `user_snapshots.schema_version` · Slice 5 behaviour changes outside the
truthful-truncation contract · final schema for S6/S7 tables.
