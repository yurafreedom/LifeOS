# LifeOS Adaptive Analytics — Slice 8 · Retention · Final post-Slice-7/F3 reconciliation

Generated: 2026-09-30 03:04 (Europe/Kyiv) · Claude Code (Opus 5.5) · canonical checkout
Status: **RECONCILIATION = PASS** — the provisional Slice 8 planning (pinned `414df14`, pre-Slice-6/7/F3)
is re-verified against current `main` and replaced by the current-truth rows below.

---

## 1. Live state (verified, not copied)

| Item | Value |
|---|---|
| `main` = `origin/main` | `b8d129e87f48217eac6eda39d1b208a1b047cdfc` (PR #19 merge, MERGED 2026-09-29T23:09:11Z) |
| PR #19 head | `0239f922e02a8bf80947d171157ff5e803ca3a6a` (`fix/aa-history-cursor-tiebreak`) |
| Worktrees | exactly one: `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` |
| Working tree | clean at start |
| Recovery stash | `stash@{0}` = `51184836ace557fbd9492527bd845329b17b2a76` (retained) |
| Frozen tag | `adaptive-analytics-design-accepted` → `6c507b82…` (unmoved) |
| Alembic head / current (`lifeos_test`) | `20260930_0008` / `20260930_0008` |
| DB `aa_%` tables (`lifeos_test`) | **27** |
| Signal rules | 4 (`finance.monthly_spend.threshold`, `project.forecast.revision`, `data.source.stale`, `coverage.window.partial`) |
| Backend baseline (`LIFEOS_TEST_DATABASE_URL` → `lifeos_test`, DB tests ran) | **676 passed**, ruff clean, compileall clean |
| Frontend baseline | **522 passed / 41 files**, typecheck / lint / build / build --manifest clean, entry JS 321.10 kB |
| Slice 8 code present | none |

Sources read in full: `AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md`, `Outputs/architecture/module-boundaries.md`,
Slice 7 and F3 implementation reports, the four `_parallel_planning/slice8/` artifacts, and the code seams cited below.

## 2. Findings F1–F6 against current code

| # | Finding | Status @ `b8d129e` | Evidence |
|---|---|---|---|
| F1 | single-fact hard delete refuses any chain member; supersession self-FKs are `NO ACTION` | **CONFIRMED_CURRENT** | `services/aa_deletion.py` `delete_fact` (`DeletionConflictError` both directions); live FK inventory: every `supersedes_id` / `superseded_by_id` is `NO ACTION` |
| F2 | provenance redaction is O(account-provenance) **per fact**; Review + Slice 7 redactors are per-fact | **CONFIRMED_CURRENT** | `_redact_provenance` walks every `FACT_TABLES` model in 200-row `FOR UPDATE` batches per id; `SOURCE_REDACTORS = (redact_review_context, *SLICE_7_REDACTORS)`, signature `(db, user_id, table, fact_id)` |
| F3 | Actual-history keyset lost `id` tie-break | **FIXED (PR #19)** | `services/aa_facts.py read_history`: `tuple_(occurred_at, id) > tuple_(cursor_time, cursor_id)`; regressions `test_history_keyset_keeps_the_id_tie_break_for_equal_timestamps`, `test_legacy_imports_sharing_one_local_date_are_all_reachable_through_history` green in the 676 baseline |
| F4 | partial finance month presented as `present` | **CONFIRMED_CURRENT** | `services/aa_finance.py derive_month`: `availability = "insufficient_data" if unknown else ("present" if rows else "no_data")` |
| F5 | pruned coverage would read as never established | **CONFIRMED_CURRENT** | `aa_coverage_claims.coverage_report_for_window`: `reason=None if claims else "не установлена"`; `analytics/coverage.py` has no truncated bucket |
| F6 | **retention rehydration / resurrection** through legacy import | **CONFIRMED_CURRENT (new)** | `services/aa_legacy_import.py` re-reads snapshot transactions and calls `append_measurement(... idempotency_key="legacy-transaction:<id>")`; idempotency holds only while the AA row exists. After a hard delete the key is free, so a rerun recreates the fact. Coverage claims likewise use a deterministic key and would be recreated. Policy reconstruction records the *current* category policy with `effective_from=now` (current-state, not history). |

F6 reconstruction-path audit: the only automatic/reconstruction writer of AA history is
`import_legacy_transactions` (`POST /api/v1/aa/import/legacy-transactions`, user-triggered from Finance Analytics
«Импортировать существующие операции»). It writes transaction measurements, per-transaction membership overrides,
one metric-policy version and explicit legacy coverage claims. No connector, scheduler, snapshot hook or
`activityLog` path writes AA facts (`git grep -i activitylog apps/api/app` → only the `activity_log_imported: Literal[0]`
schema field). The durable web queue only replays *explicit* user writes (not reconstruction).

## 3. Current AA inventory (27) — models = `EXPORT_TABLES` = DB = `TRUNCATED_TABLES` (+ seeded catalogue)

Foundation / comparison (13): `aa_metric_definitions`, `aa_measurements`, `aa_source_coverage`, `aa_deletion_receipts`,
`aa_expectation_versions`, `aa_forecast_versions`, `aa_baselines`, `aa_targets`, `aa_preferences`, `aa_observations`,
`aa_metric_policy_versions`, `aa_metric_membership_overrides`, `aa_signal_episodes`.
Review (6): `aa_reviews`, `aa_review_revisions`, `aa_review_context_items`, `aa_review_context_sources`,
`aa_review_factors`, `aa_decisions`.
Experiments M6 (3): `aa_experiments`, `aa_experiment_adherence`, `aa_experiment_observations`.
System Review M7 (5): `aa_importance_ratings`, `aa_cross_references`, `aa_relation_feedback`, `aa_finance_contexts`,
`aa_system_review_revisions`.

Registries:
- `FACT_TABLES` (`aa_deletion.py`) = `SEMANTIC_TABLES` (expectation, forecast, baseline, target, preference,
  observation, metric policy, membership override) + `aa_measurements`, `aa_source_coverage`,
  `aa_experiment_observations` = **11**. `aa_experiment_adherence` deliberately absent.
- `REVIEW_SOURCE_TABLES` (`models/aa_review.py`) = the 10 foundation fact tables (no experiment observations).
- `SOURCE_REDACTORS` = `(redact_review_context, redact_system_review_sources, redact_relation_endpoints,
  erase_importance_for_source)`.
- Export registry `EXPORT_TABLES` = 27 (validated against mapped metadata and `information_schema`).
- Test cleanup `TRUNCATED_TABLES` = 26 `aa_*` + `user_snapshots`, `sessions`, `users`
  (`aa_metric_definitions` intentionally absent).

## 4. Live foreign keys (from `information_schema` on `lifeos_test`)

- Every account-owned table: `user_id → users ON DELETE CASCADE`.
- Every supersession self-FK (`supersedes_id`, `superseded_by_id`) on the 11 chain tables: **NO ACTION**.
- `aa_metric_membership_overrides.source_fact_id → aa_measurements ON DELETE CASCADE` — the **only** cross-table FK
  from a prunable table into another prunable table.
- Preserved-entity FKs: `aa_decisions.review_id/experiment_id`, `aa_review_*`, `aa_experiment_*`,
  `aa_relation_feedback.relation_id` → CASCADE from their preserved parents; self NO ACTION on
  `aa_review_factors.replaces_id`, `aa_importance_ratings.supersedes_id`, `aa_finance_contexts.supersedes_id`,
  `aa_system_review_revisions.previous_revision_id`.
- **No FK from any preserved entity to any prunable fact.** Every preserved → prunable dependency is soft:
  Review `(source_table, source_fact_id)` links, Saved System Review `source_ids uuid[]` + frozen per-item
  `sources`, relation ref keys `fact|<table>|<id>`, importance `target_key`, experiment evidence by
  `subject_key = experiment:experiment:<id>`, provenance `source_ref` JSON.

## 5. Slice 6 / Slice 7 reverification

- **Experiments (M6)**: the experiment row is state; evidence is `aa_experiment_adherence`, `aa_experiment_observations`
  (FK CASCADE to experiment) and — soft — `aa_baselines` / `aa_observations` rows whose subject is
  `experiment:experiment:<id>` (`services/experiments/evidence.py`, `read_model.py` reads them by `subject_key`).
  A retained experiment therefore pins every semantic row on an `experiment` subject ⇒ Slice 8 excludes
  `subject_domain = 'experiment'` from age-pruning entirely (preserved-by-default, O1).
- **System Review (M7)**: the four D1 adapters are per-fact; frozen revisions carry per-item `sources` and a
  `source_ids` GIN manifest; relation endpoints/evidence use ref keys; importance ratings targeting an erased
  fact are removed by the hard-delete adapter; finance contexts reference **snapshot** transaction ids through
  `subject_key finance:transaction:<snapshot id>` (not AA fact ids) and are never redacted by a fact deletion.
  Live review / candidates / consequences read only surviving rows (no cache, GET is READ ONLY) — erased evidence
  cannot feed them, but a pre-horizon month would otherwise be rendered as a *quiet* month (truncation needed).
- **Project Analytics (Slice 5)**: `no_facts` for a subject with no rows (hazard K13); `forecast_versions_truncated`
  is the page-cap flag (K14, must stay distinct).
- **Signals**: `DISCOVERY_MONTHS = 13`, subjects = finance periods + project subjects; with the 24-month minimum the
  discovery window is always after any applied horizon at evaluation time, but discovery must still clip at the horizon.

## 6. Route guard ordering (reverified)

- Standard unsafe AA routers declare `dependencies=[Depends(require_json_content_type), Depends(require_aa_write_enabled)]`
  and call `enforce_same_origin` in the handler (measurements, reviews, experiments, system review, import).
- **K15 confirmed**: `routes/aa_finance.py` `POST /finance/policies` and `POST /finance/membership-overrides` call
  `require_json_content_type` inside the handler, after Pydantic body validation — a `text/plain` body yields a parser
  422 before 415. Narrow fix in scope (route dependencies + regression).
- Privacy routes (`DELETE /aa/facts/...`, export, account delete) are gate-independent.

## 7. Settings architecture

`components/SettingsPage.jsx` section nav (`account … export, danger`); `components/settings/DangerSection.jsx`
owns the `activityLog` cleanup (3/6/12 months, local snapshot only, copy `set_clear_history*`). No AA retention surface
exists. Web AA client modules live in `api/analytics/*.ts` behind the `api/analytics.ts` facade; direct `requestJson`.

## 8. Updated risks

| # | Risk | Current handling |
|---|---|---|
| K1 | chain refusal / rewire temptation | whole-chain set deletes, one statement per table, NO ACTION end-of-statement proven on `lifeos_test` |
| K2 | O(N×M) provenance/redaction | set-based bulk redactors + UUID token hash join |
| K3 | F3 | fixed; regressions green |
| K4/K5 | partial month / coverage truthfulness | `retention_truncated` states |
| K7 | tombstone keeps frozen values | retention never tombstones |
| K11 | S7 endpoints embed pruned ids | bulk relation / importance / revision redaction |
| K13/K14 | Project `no_facts` after unit prune; name clash | `history_deleted_by_retention` state + separate `retention_*` fields |
| K15 | finance 415-vs-422 | fixed narrowly |
| K16 | single-valued `RedactionReason` CHECK | M8 widens with `source_retention_pruned` |
| **K17** | **F6 legacy re-import resurrects pruned history** | retention-aware import guard driven by completed runs |
| **K18** | experiment evidence on `experiment` subjects is soft-pinned | `experiment` domain never age-pruned |

## 9. Dependency matrix — see the Final Plan §3 (all 27 current tables + 2 new)
