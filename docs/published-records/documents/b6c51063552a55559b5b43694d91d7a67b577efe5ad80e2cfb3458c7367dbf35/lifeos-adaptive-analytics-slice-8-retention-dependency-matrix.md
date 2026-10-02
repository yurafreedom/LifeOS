# LifeOS Adaptive Analytics — Slice 8 · Retention dependency matrix (reconciled)

Generated: 2026-09-29 · Claude Code (Opus 5.5) · parallel planning wave · READ-ONLY
Pinned baseline: `414df142700653d616016ff644bff3d9c0007540` (main, includes Slice 5)
Status: **PROVISIONAL** — current rows statically verified; future rows are placeholders.

Evidence method: `git show` / `git grep` / `git ls-tree` against the pinned object only.
No DB, no tests, no app imports.

---

## 0. Static inventory check — 19 `aa_*` tables (CURRENTLY_VERIFIED)

| Source | Count | Notes |
|---|---|---|
| Models (`__tablename__` literals 17 + `_TABLE` in `aa_measurement.py`, `aa_source_coverage.py`) | **19** | |
| Migrations `0002` (3) + `0003` (1) + `0004` (8) + `0005` (1) + `0006` (6) | **19** | head `20260928_0006`; Slice 5 added **no** migration |
| `EXPORT_TABLES` (`services/export.py`) | **19** | Review block added by Slice 4 |
| `TRUNCATED_TABLES` (`tests/conftest.py`) | **18 aa_\*** + `user_snapshots, sessions, users` | `aa_metric_definitions` intentionally absent (seeded global catalogue) — same as before |

13 (through Slice 3) + 6 (Slice 4: `aa_reviews`, `aa_review_revisions`, `aa_review_context_items`,
`aa_review_context_sources`, `aa_review_factors`, `aa_decisions`) + 0 (Slice 5) = **19**. Matches expectation.

Future (placeholders, NOT authoritative): +3 Slice 6 (and `aa_decisions` altered) ≈ 22 · +2 Slice 7 ≈ 24 ·
Slice 8 retention policy/audit ≈ 25 (26 if a separate run log table is chosen, see O4).

---

## 1. Legend

- **Age-prunable:** `NEVER` · `COND` (conditional, whole chain/window/unit only) · `CASCADE-ONLY` (never selected directly).
- **Semantic age axis:** the column that decides eligibility. *Never* `created_at`; `recorded_at` never alone.
- **Chain rule:** every table using `AASupersessionMixin` has self-FKs `supersedes_id` / `superseded_by_id`
  with **no `ON DELETE`** (NO ACTION) and `UNIQUE(supersedes_id)`. `delete_fact(mode="hard")` refuses any chain
  member (F1, `aa_deletion.py:109-121`). ⇒ a chain is eligible only if **every** member is past the horizon;
  delete the whole chain in **one statement**; never rewire links; never delete part of a retained chain.
- **Order:** position in the provisional deletion order (§3). Lower = earlier.
- **Reverify:** `—` none beyond final re-pin · `R-S6` / `R-S7` = `MUST_REVERIFY_AFTER_PREDECESSOR_MERGE`.

---

## 2. Matrix — current tables (19)

| # | Table | Age-prunable | Semantic age axis / unit rule | Chain / FK notes | Privacy / redaction dependency | Export impact | Read-model impact | Order | Reverify |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `aa_metric_definitions` | **NEVER** | — (global catalogue, no `user_id`) | FK target of every fact `metric_key` | none | exported whole | everything | never deleted | — |
| 2 | `aa_measurements` | **COND** | `occurred_at` < horizon (local, month-aligned) for **every** chain member; finance transactions: whole local month must be pre-horizon | self chain (NO ACTION); `aa_metric_membership_overrides.source_fact_id` **ON DELETE CASCADE** | Review sources (`aa_review_context_sources.source_table='aa_measurements'`) → **redact first** (D1); provenance `source_ref` in any FACT_TABLE may mention id → **set-based redact** (F2) | rows vanish; run-level retention record + horizon appear | actual history (F3 cursor), `derive_month` (F4), coverage stats, R1/R3 signals, Project Actual (`project.completion_date`) | 6 | R-S6 (experiment obs may reference), R-S7 (`change_key`) |
| 3 | `aa_source_coverage` | **COND** | `window_end_date` < horizon for every chain member (no partial windows) | self chain | Review source; provenance ref | same | **F5**: absent claims ⇒ `unknown_coverage` / «не установлена» — must become *retention-truncated*; R4 | 6 | — |
| 4 | `aa_deletion_receipts` | **NEVER** | — | none | holds no content | exported | disclosure / audit | never deleted | O4 (run-level vs per-fact) |
| 5 | `aa_expectation_versions` | **COND** | `window_end` < horizon for every chain member (also `effective_from`); never break an in-force version for a post-horizon window | self chain | Review source; provenance | same | Expected layer, finance delta reference, R1 | 6 | R-S7 |
| 6 | `aa_forecast_versions` | **COND — project unit only** | not per-row: eligible only as a **whole Project history unit** (all forecast versions + Actual chain + observations of that subject) when the Actual's `occurred_at` and every forecast `horizon_at` / `recorded_at` are pre-horizon; open/Actual-less projects **never** (archival writes no AA fact — Slice P — so "archived" is not knowable server-side; completion Actual is the only unit-closing evidence) | self chain (revision chain per project) | Review source; provenance; R2 fingerprint over version ids | same | **Slice 5** Project Analytics (first/latest, dual delta, version count, withdrawn count); R2 | 6 (with unit) | R-S7 |
| 7 | `aa_baselines` | **COND** | whole chain, `window_end` < horizon; never recomputed | self chain | Review source; provenance | same | baseline comparison ⇒ `no_data` + truncation marker, never recomputed | 6 | **R-S6** (experiments compare against baselines — may pin) |
| 8 | `aa_targets` | **COND** | whole chain, `window_end` < horizon; **keep** any version still grounding a post-horizon window | self chain; `is_explicitly_absent` ≠ zero | Review source; provenance | same | desirability grounding (→ neutral only for pruned windows) | 6 | R-S7 (INNER JOIN grounding in «Что улучшилось») |
| 9 | `aa_preferences` | **COND (strict)** | a chain containing the active / in-force version is retained **whole** (chain rule forbids partial delete); only chains that are entirely superseded/tombstoned **and** whose last successor's `effective_from` is pre-horizon are eligible | self chain | Review source; provenance | same | desirability | 6 | R-S7 |
| 10 | `aa_observations` | **COND** | `occurred_at` < horizon for every chain member; project-subject observations only with their Project unit | self chain | Review source; provenance | same | H pairing; Project `observation_count` | 6 | R-S6 (experiment observations may be separate table) |
| 11 | `aa_metric_policy_versions` | **COND (strict)** | never delete the version **in force at or after the horizon**; the whole chain containing it is retained; older fully-superseded chains only if no retained measurement's inclusion depends on them | self chain | Review source; provenance | same | C7 `include(fact,T)`; deleting in-force ⇒ `policy_known=false` for current windows | 6 (last among semantic) | — |
| 12 | `aa_metric_membership_overrides` | **CASCADE-ONLY** | follows its `source_fact_id` measurement; never selected directly | self chain **and** CASCADE from measurement; a CASCADE of one chain member while its sibling survives would violate NO ACTION ⇒ override chains must be wholly inside pruned measurement set (verify) | Review source (`redact_source_context(…,"aa_metric_membership_overrides", id)` already done per dependent in `delete_fact`); provenance | same | C7 inclusion | cascades at 6 | — (K12: prove on `lifeos_test`) |
| 13 | `aa_signal_episodes` | **COND** | only episodes whose subject window lies wholly pre-horizon (finance period, coverage window); project episodes with their Project unit | no chain; `UNIQUE(user_id, episode_key)` | `last_fingerprint` = hash of now-deleted ids (evidence of deleted history, not a value) | same | acknowledgement history; zero-state | 5 | R-S7 (System Review may read episodes) |
| 14 | `aa_reviews` | **NEVER** (user-authored) | — | parent of 5 tables (CASCADE) | owner of redaction; header has window + `render_manifest` (layout only, no values) | exported | Review reopen | never | R-S6 (experiment-scoped reviews?) |
| 15 | `aa_review_revisions` | **NEVER** (user note text) | — | FK review CASCADE | none (no source link) | exported | revision history | never | — |
| 16 | `aa_review_context_items` | **NEVER as rows** — values **REDACTED** when any source is pruned (D1) | follows source eligibility | FK review CASCADE; CHECK `redacted ⇒ ERASED` | *is* the redaction target; `RedactionReason` today only `source_hard_deleted` (CHECK) — retention reason is a Plan choice | exported with redaction marker | «источник удалён» | 3 | — |
| 17 | `aa_review_context_sources` | **deleted as links** of redacted items (existing adapter behaviour) | follows source eligibility | FK item CASCADE; index `(user_id, source_fact_id)` | lookup key for bulk redaction | exported (links to surviving facts only) | source state derivation (current/corrected/revised/withdrawn/redacted) | 3 | — |
| 18 | `aa_review_factors` | **NEVER** (user text) | — | FK review CASCADE; self `replaces_id` | none | exported | — | never | — |
| 19 | `aa_decisions` | **NEVER** (NULL ≠ inconclusive) | — | FK review CASCADE (nullable) | none | exported | System Review (S7) | never | **R-S6** (scope widened, experiment FK) |

## 3. Future placeholders — `MUST_REVERIFY_AFTER_PREDECESSOR_MERGE`

| Table | Slice | Provisional classification | Unknowns that block a final row |
|---|---|---|---|
| `aa_experiments` | 6 | **NEVER** (user-authored; O1) | lifecycle columns; FK to baselines? window columns; whether ABANDONED/REVIEWED experiments form a "unit" |
| `aa_experiment_adherence` | 6 | **NEVER** inside a retained experiment | per-day rows; FK/ON DELETE to experiment; `unknown` state legality |
| `aa_experiment_observations` | 6 | **NEVER** (proposed v1) | shared fact template? FACT_TABLES/REVIEW_SOURCE_TABLES membership? provenance refs |
| `aa_decisions` (altered) | 6 | **NEVER** | new scope CHECK, `experiment_id` FK direction |
| `aa_importance_ratings` | 7 | **NEVER** (user-owned) | `change_key` format — does it embed fact ids / window ids that retention could orphan? |
| `aa_cross_references` | 7 | **NEVER** (user-created) | endpoint typing; FK vs free reference; dangling-endpoint rendering («источник удалён») |
| `aa_retention_policies` | 8 | **NEVER** | shape per provisional Plan §5 |
| `aa_retention_runs` (option) | 8 | **NEVER** | only if O4 → run-level log table chosen |

## 4. Provisional deletion order (NOT FINAL — `SAFE_DELETION_ORDER_FINAL=NO`)

Inside one bounded transaction per semantic unit/batch, under a per-user advisory lock:

1. **Lock** — `pg_advisory_xact_lock(<user retention key>)`; re-read policy + preview token.
2. **Eligibility** — compute the unit set (whole chains / whole windows / whole Project units) with semantic
   axes above; `FOR UPDATE` the candidate rows; abort unit if any member became non-eligible (concurrent correction).
3. **Review redaction (set-based)** — for every `(source_table, source_fact_id)` in the unit set **and** every
   CASCADE-dependent membership override id: erase items + delete their links (bulk form of `redact_review_context`).
4. **Provenance redaction (set-based)** — null `source_ref/basis/method` on surviving rows in any FACT_TABLE whose
   `source_ref` mentions any pruned id (and cascading override ids). JSONB-path or text-containment strategy to be
   proven; must be at least as conservative as `_references()`.
5. **Signal episodes** of wholly pre-horizon subject windows / pruned Project units.
6. **Fact rows** — per table, one `DELETE … WHERE id = ANY(:chain_ids)` per chain set (NO ACTION checked at statement
   end — **must be proven on `lifeos_test`**); `aa_metric_membership_overrides` removed by CASCADE with measurements.
   Semantic order inside step 6: measurements/coverage/observations → windowed versions → project units → policy chains last.
7. **Audit/horizon record** — write run-level record (or per-fact receipts, O4) + durable applied horizon.
8. Commit. Log counts only, never values.

Unknown until S6/S7 merge: where experiment children, importance ratings and cross-references sit in this order
(expected: never deleted, but may need redaction/orphan-marking steps between 3 and 6).

## 5. Tables requiring post-merge reverification

`aa_decisions`, `aa_baselines`, `aa_measurements`, `aa_observations`, `aa_forecast_versions`, `aa_targets`,
`aa_preferences`, `aa_expectation_versions`, `aa_signal_episodes`, `aa_reviews`, and all future rows in §3.
Also: `REVIEW_SOURCE_TABLES` / `FACT_TABLES` membership after S6; `SOURCE_REDACTORS` tuple after S6/S7.
