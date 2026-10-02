# LifeOS Adaptive Analytics — Slice 8 · Retention / Legacy / Hardening · FINAL Plan

Generated: 2026-09-30 03:04 (Europe/Kyiv) · Claude Code (Opus 5.5)
Base: `main` = `origin/main` = `b8d129e87f48217eac6eda39d1b208a1b047cdfc` (PR #19 merged; F3 fixed)
Branch: `feat/adaptive-analytics-slice-8-retention`
Companion: `Outputs/Discoveries/lifeos-adaptive-analytics-slice-8-final-reconciliation_20260930-030431.md`

```
PLAN_STATUS=FINAL
OWNER_DECISIONS_OPEN=0
SAFE_DELETION_ORDER_FINAL=YES
ALL_CURRENT_AA_TABLES_CLASSIFIED=YES
F3_STATUS=ALREADY_FIXED
F6_REHYDRATION_PLAN=DEFINED
```

## 0. Owner decisions (closed, from the Slice 8 master prompt)

- **O1** finite retention prunes only observational / windowed / versioned evidence, by whole chain / window /
  Project unit. User-authored entities are never age-pruned. Open / Actual-less Projects never pruned.
- **O2** retention is user-chosen hard erasure: source-derived frozen Review / System Review values are redacted
  **before** deletion with reason `source_retention_pruned`; user content survives; never tombstone.
- **O3** `unlimited` (default, no row) · 60 · 36 · 24 months. Nothing shorter, nothing preselected.
- **O4** one `aa_retention_runs` row per Apply; no per-fact retention receipts; `aa_deletion_receipts` stays for
  ordinary hard delete.

Engineering choices made in this Plan (no new product semantics): atomic apply; policy PUT and Apply are
gate-independent privacy controls; preview is a READ ONLY transaction; importance ratings that name a pruned fact
follow the existing hard-delete semantics (R8-48); `experiment` subjects never pruned.

## 1. M8 — `20260930_0009_aa_retention` (down_revision `20260930_0008`)

### `aa_retention_policies` (append-only intent; no row = unlimited)
`id uuid PK · user_id → users CASCADE · created_at · mode text CHECK IN ('unlimited','finite') ·
retain_months int NULL · consequences_version text NULL · confirmed_at timestamptz NULL · recorded_at timestamptz NOT NULL ·
status text CHECK IN ('active','superseded') · supersedes_id → self (NO ACTION) · superseded_at · idempotency_key text`

CHECKs: `(mode='unlimited') = (retain_months IS NULL)`; `retain_months IS NULL OR retain_months IN (24,36,60)`;
`mode='unlimited' OR (consequences_version IS NOT NULL AND confirmed_at IS NOT NULL)`;
`(status='active') = (superseded_at IS NULL)`; `supersedes_id <> id`.
Unique `(user_id, idempotency_key)`; partial unique `(user_id) WHERE status='active'` (one active policy per user).

### `aa_retention_runs` (one row per Apply; never pruned)
`id · user_id → users CASCADE · created_at · policy_id → aa_retention_policies (NO ACTION) · retain_months ·
target_horizon_date date · timezone text · engine_version int · preview_fingerprint text (sha256) ·
status text CHECK IN ('running','completed','failed') · started_at · completed_at · failed_at · failure_code text ·
total_deleted int · table_counts jsonb · unit_counts jsonb · chain_count int · project_unit_count int ·
review_redaction_count · system_review_redaction_count · relation_redaction_count · importance_redaction_count ·
provenance_redaction_count · signal_episode_count · skipped jsonb · pruned_units jsonb · progress jsonb ·
idempotency_key text`

CHECKs: status/timestamp pairing (`completed ⇔ completed_at`, `failed ⇔ failed_at`, failed ⇒ failure_code),
counts ≥ 0, `retain_months IN (24,36,60)`, `jsonb_typeof(...) = 'object'`, fingerprint `~ '^[0-9a-f]{64}$'`.
Unique `(user_id, idempotency_key)`; index `(user_id, status, target_horizon_date)`.
`pruned_units` holds only identifiers of whole pruned Project units (`project_subject_ids`) — identities, like
`aa_deletion_receipts.fact_id`, never values. No deleted value is ever stored.

### CHECK swap
`ck_aa_review_context_items_redaction_reason` widened to `RedactionReason = {source_hard_deleted,
source_retention_pruned}` (enum ⇄ CHECK parity test).

Tables 27 → **29**. Snapshot/server schema stays 2. Downgrade (C8, `lifeos_test` only) drops the two tables and
restores the narrow CHECK; after any retention-redacted item exists that CHECK restore fails — rollback is
non-destructive by construction. Indexes: only the ones above (evidence in §12).

## 2. Horizon semantics

`target_horizon_date = first day of the month containing (local_today − retain_months)` in the request's IANA zone
(`zoneinfo`; never a fixed offset). Instant = local midnight of that date in the same zone (DST-correct).
**Effective historical-completeness horizon** = the latest `target_horizon_date` among the user's **completed** runs
(with its zone). No completed run ⇒ `None` ⇒ every read is byte-compatible with today.
Switching to Unlimited or to a longer duration never lowers it (monotone max over completed runs). A later stricter
Apply advances it. Meaning: "completeness before this boundary is no longer guaranteed" — rows may still exist before it
(late explicit writes are accepted and shown, disclosure persists).

## 3. Dependency matrix — all current tables + M8

Legend: **N** never age-pruned · **C** conditional (whole unit only) · **CO** cascade-only.
Order = position in §6. Export/account-delete: every row is in `EXPORT_TABLES` and cascades from `users`.

| Table | Class | Semantic axis / unit | Chain / FK | Pinning / redaction dependency | Read-model impact | Order | Resurrection risk |
|---|---|---|---|---|---|---|---|
| `aa_metric_definitions` | N | global catalogue | FK target | — | all | — | — |
| `aa_measurements` | C | `occurred_at < H_instant` for **every** chain member; finance transactions therefore whole local months (H is a month start); `project` subjects only inside a Project unit; `experiment` subjects never | self NO ACTION; overrides CASCADE | Review sources, SR revisions, relation/importance refs, provenance | history (F3), finance month (F4), coverage stats, R1/R3, Project Actual | 7a | **F6**: legacy import (guarded) |
| `aa_metric_membership_overrides` | CO | follows its `source_fact_id` measurement; chains are per `(metric, source_fact_id)` grain (`append_version`) so a chain never spans two measurements | CASCADE from measurement; self NO ACTION inside the cascaded set | Review sources (`aa_metric_membership_overrides`), provenance — ids collected **before** delete | C7 inclusion | 7a (cascade) | legacy import (guarded with its transaction) |
| `aa_source_coverage` | C | `window_end_date < H_date` for every chain member (a straddling window is kept whole) | self NO ACTION | Review sources, provenance | coverage (F5), R4 | 7b | **F6**: legacy coverage (guarded) |
| `aa_expectation_versions` | C | `window_end < H_date` every member | self | Review/provenance | Expected layer, finance delta | 7c | none (never imported) |
| `aa_baselines` | C | `window_end < H_date` every member; `experiment` subjects never | self | Review/provenance; **experiment pin** | baseline layer, experiment result | 7c | none |
| `aa_targets` | C | `window_end < H_date` every member (a target only grounds its own window) | self | Review/provenance | grounding | 7c | none |
| `aa_preferences` | C (strict) | chain eligible only if it has **no active member** and every member's `effective_from`, `recorded_at` and `superseded_at`/`tombstoned_at` are `< H_instant` | self | Review/provenance | desirability | 7e | none |
| `aa_metric_policy_versions` | C (strict) | same as preferences (the in-force chain always survives ⇒ C7 `policy_known` unchanged after H) | self | Review/provenance | C7 | 7e | policy reconstruction records current state only |
| `aa_observations` | C | `occurred_at < H_instant` every member; `project` only in unit; `experiment` never | self | Review/provenance; **experiment pin** | observations, Project `observation_count` | 7d | none |
| `aa_forecast_versions` | C | `project` subjects: **only as a whole Project unit**; other subjects: every member `recorded_at < H` and `horizon_at < H` | self | Review/provenance; R2 | Project Analytics, R2 | 7d | none |
| **Project unit** (subject `project:project:<id>`) | C | eligible iff a live completion Actual exists **and** every forecast (`recorded_at`, `horizon_at`), Actual chain member (`occurred_at`) and project observation (`occurred_at`) is `< H`, **and** no other table holds a row on that subject | whole unit | as above + episodes | `history_deleted_by_retention` | 7a/7d | none |
| `aa_signal_episodes` | C | finance-period episodes with `subject_id` month `< H` month; episodes of pruned Project units | no chain | none | ack history | 5 | re-creation prevented by horizon-clipped discovery |
| `aa_deletion_receipts` | N | — | — | — | audit | — | — |
| `aa_reviews`, `aa_review_revisions`, `aa_review_factors`, `aa_decisions` | N | user-authored | CASCADE from review/experiment | — | Review | — | — |
| `aa_review_context_items` | N (rows) | values **redacted** when any linked source is pruned | CASCADE from review | reason `source_retention_pruned` | «источник удалён правилом хранения» | 3 | — |
| `aa_review_context_sources` | links deleted for redacted items | follows source | CASCADE from item | index `(user_id, source_fact_id)` | source state | 3 | — |
| `aa_experiments`, `aa_experiment_adherence`, `aa_experiment_observations` | N | user-authored experiment | CASCADE from experiment | provenance of pruned ids redacted | experiment detail unchanged | 4 (provenance only) | — |
| `aa_importance_ratings` | N (age) | ratings of a **pruned fact ref** removed exactly as hard delete does; section/change/subject ratings untouched | self (chain broken inside the doomed set, as today) | ref key | importance | 3 | — |
| `aa_cross_references` | N | endpoints/evidence naming pruned rows → `redacted` + `endpoint_redacted_at` | — | ref keys | relations | 3 | — |
| `aa_relation_feedback` | N | — | CASCADE from relation | — | — | — | — |
| `aa_finance_contexts` | N | subject is a snapshot transaction id (not an AA fact); a context whose transaction fact is gone renders as «без операции» (existing Slice 7 path) | self | none | consequences need the fact ⇒ cannot compute from erased evidence | — | — |
| `aa_system_review_revisions` | N | frozen items whose `sources` intersect the pruned set → redacted (`source_retention_pruned`), ids leave `source_ids` | self | GIN `source_ids` | saved review | 3 | — |
| `aa_retention_policies` (M8) | N | — | self | — | GET policy | — | — |
| `aa_retention_runs` (M8) | N | — | → policies | — | effective horizon | 8 | — |

`created_at` is never an axis. `recorded_at` is an axis only for forecast versions (it is when the estimate was made)
and never alone. Legacy imports (recent `recorded_at`, old `occurred_at`) age by `occurred_at`.

## 4. Whole-chain / window / Project rules

Chains are resolved with a recursive CTE from roots (`supersedes_id IS NULL`) along `supersedes_id`
(index `uq_<table>_supersedes_id`), user-scoped at every level. A chain is a candidate iff `bool_and(member eligible)`.
A chain with any post-horizon or in-force member is retained whole; skipped chains that have at least one pre-horizon
member are counted per table (`skipped`). Nothing is rewired; retention never calls `delete_fact` and never tombstones.
Each table's chain set is deleted by **one** `DELETE … WHERE user_id = :u AND id = ANY(:ids)` statement, relying on
NO ACTION's end-of-statement check (proven by test R8-18/R8-20 on `lifeos_test`).

## 5. Preview token / fingerprint

`sha256` over a canonical JSON of: engine version, user id, active policy id + months, target horizon, timezone,
sorted candidate `(table, id)` list (incl. cascading override ids), sorted Project unit keys, episode ids, and every
redaction target (Review item ids, SR revision ids, relation ids, importance ids, provenance-hit `(table, id)`),
plus skipped-unit counts. The client receives aggregates + the hex token only. Apply re-derives the same set under the
lock (after `FOR UPDATE` on every candidate row) and compares; mismatch ⇒ **409 `retention_preview_stale`** before any
write. Client-supplied ids are never accepted.

## 6. Apply — FINAL deletion order (one transaction, ATOMIC)

1. `pg_advisory_xact_lock(retention key(user))` (per-user, xact-scoped); idempotency replay check under the lock.
2. Re-read the active policy (must be finite) and recompute `H` in the request zone.
3. Derive candidates; `SELECT … FOR UPDATE` every candidate row (blocks concurrent corrections: a successor insert's
   FK check needs `KEY SHARE` on the predecessor); **re-derive** and fingerprint; mismatch ⇒ rollback + 409.
4. Insert the run row (`running`).
5. Review redaction (bulk, `source_retention_pruned`) → Saved System Review item redaction → relation endpoint /
   evidence redaction → importance erasure (hard-delete semantics).
6. Provenance redaction (bulk; every `FACT_TABLES` table + experiment adherence).
7. Signal episodes of pruned windows / units.
8. Fact deletes: `aa_measurements` (cascades overrides) → `aa_source_coverage` → windowed versions
   (expectation, baseline, target) → observations / forecasts → preferences / metric policy versions.
9. Run row → `completed` with all counts; commit.
On any exception: rollback (nothing deleted), then a separate transaction records the same run identity as `failed`
with `failure_code` (exception class only) — a failed run is auditable and never claims deletion. Effective horizon
reads only `completed` runs. `progress` records the phase reached for completed runs (atomic ⇒ no partial state).

Why atomic: at the representative scale (§12) the whole apply is a few seconds in one transaction; it keeps
"completed destructive work never invisible" trivially true and removes resume complexity. Batching is reserved for a
future scheduler.

## 7. Truthful read contracts (additive; no applied run ⇒ unchanged)

| Read | Contract |
|---|---|
| `GET /aa/metrics/{m}/history` | `retention_horizon` (date/null), `retention_truncated` = `from < H_instant` |
| `GET /aa/finance/months/{p}` | month start `< H` ⇒ `availability = retention_truncated`, `actual = null`, `known_subtotal = null`, delta unknown, desire unknown; `retention_horizon`/`retention_truncated` fields; a late old fact never restores completeness |
| coverage report (history, finance, SR quality, signals) | new day bucket `retention_truncated` (days `< H`, overriding any surviving straddling claim), `retention_truncated_count`, `retention_horizon`; reason `retention_truncated` when every non-future day is truncated |
| Project Analytics | subject listed in a completed run's `pruned_units` and no surviving facts ⇒ state `history_deleted_by_retention` (≠ `no_facts`); `retention_history_deleted` flag; `forecast_versions_truncated` stays the page cap |
| Signals | finance discovery clipped at the horizon month; pruned units have no facts; exactly 4 rules |
| Live System Review | `retention: {horizon, truncated, truncated_months}`; a pre-horizon month returns empty derived sections, no candidates, no consequences; annual view skips and lists truncated months; recurrence windows before H are listed as `retention_truncated_windows`, never as absence; «Ревью доступно» ignores pre-horizon months |
| Review reopen | redacted items expose `redaction_reason` |
| Saved System Review | redacted frozen items carry `redaction_reason: source_retention_pruned` |

## 8. F6 — anti-resurrection guard

`import_legacy_transactions` reads the effective horizon (completed runs only). A snapshot transaction whose semantic
instant (local midnight of its date in the import zone) is `< H_instant` and has **no** surviving AA row for its key is
skipped (its membership override too) → `transactions_retention_skipped`. A coverage claim whose `window_start < H_date`
(wholly before or straddling) without a surviving row is skipped → `coverage_retention_skipped`. Replays of surviving
rows behave as today; post-horizon rows import normally; the current-policy version is still recorded. Unlimited after
a finite Apply keeps the horizon ⇒ still no resurrection. An explicit `POST /aa/measurements` with an old
`occurred_at` stays accepted (and the truncation disclosure persists).

## 9. API (new router `routes/aa_retention.py`, facade `services/aa_retention.py`, package `services/retention/`)

| Route | Guards | Body / result |
|---|---|---|
| `GET /api/v1/aa/retention-policy?timezone=` | session | mode, retain_months, `source: default|explicit`, policy id/version, consequences_version, allowed `[24,36,60]`, effective horizon, latest run summary, recent runs (≤20) |
| `PUT /api/v1/aa/retention-policy` | JSON dependency (415 before 422) → same-origin → session; **not** behind the write gate | `{mode, retain_months?, consequences_version?, confirm_consequences?, idempotency_key}`; finite requires confirmation of the current consequences version (422 / 409 `retention_consequences_stale`); **never deletes**; identical intent ⇒ no new version |
| `POST /api/v1/aa/retention-policy/preview` | JSON → same-origin → session; READ ONLY txn | `{timezone}` → aggregates + `preview_token`; 409 `retention_policy_not_finite` |
| `POST /api/v1/aa/retention-policy/apply` | JSON → same-origin → session; gate-independent | `{preview_token, confirm: true, timezone, idempotency_key}` → run summary; replay ⇒ same run; 409 stale / not finite |

Body `user_id` is rejected (`extra=forbid`). Apply/PUT are direct calls from the web (never `AnalyticsWriteQueue`,
never offline replay). Finance POST 415-vs-422 fixed by moving the guards to route dependencies.

## 10. Frontend

`components/settings/RetentionSection.jsx` + section `retention` in `SettingsPage` («Хранение аналитической истории» /
«Зберігання аналітичної історії»), separate from `DangerSection` (activityLog copy unchanged). Radio group
Unlimited / 5 / 3 / 2 years → consequence disclosure (+ checkbox) → save policy (no deletion) → preview counts →
destructive confirm → Apply → run summary; current intent, effective horizon and latest run shown separately.
Offline or failed request ⇒ visible error, nothing queued. API module `api/analytics/retention.ts`.
Disclosure copy on: metric history, finance month (`retention_truncated`), coverage quality, Project Analytics
(`history_deleted_by_retention`), Review / Saved System Review redaction reason, System Review truncated banner.

## 11. Tests

Backend: `tests/test_aa_retention_migration.py`, `test_aa_retention_policy.py`, `test_aa_retention_apply.py`,
`test_aa_retention_reads.py`, `test_aa_retention_legacy.py`, `test_aa_retention_redaction.py` (incl. provenance
equivalence vs `_references`), opt-in `test_aa_retention_perf.py`; registry pins updated (27 → 29).
R8-01…R8-80 each map to at least one test (map in the implementation report). Frontend: retention section, api client,
RU/UK parity, truncated states.

## 12. Performance plan

Opt-in (`LIFEOS_RETENTION_PERF=1`) on `lifeos_test`: user A ≈150k measurements over 5 years with dense equal local
midnights, 2–3 % correction chains, ~1 % tombstones, coverage / semantic versions / policies, Review + M6 + M7 rows;
user B ≈30k noise. `ANALYZE`, then `EXPLAIN (ANALYZE, BUFFERS)` for: fixed history first/deep cursor, semantic layers,
coverage report, `monthly_spend_inputs`, signal discovery, System Review month, retention eligibility, bulk redaction,
whole-chain delete, Project-unit selection, preview fingerprint; plus an end-to-end apply timing (rolled back).
Indexes only from evidence. No benchmark data committed.

## 13. Rollback

Code rollback is a revert of the merge. Schema: M8 downgrade on `lifeos_test` only; in production, once any run
exists, rollback is non-destructive (tables/data retained, C8).

## 14. Non-scope

Scheduler, arbitrary / < 24-month durations, per-fact retention receipts, activityLog changes, tombstone retention,
age-pruning of user-authored entities, partitioning / materialized views, snapshot v3, deploy.
