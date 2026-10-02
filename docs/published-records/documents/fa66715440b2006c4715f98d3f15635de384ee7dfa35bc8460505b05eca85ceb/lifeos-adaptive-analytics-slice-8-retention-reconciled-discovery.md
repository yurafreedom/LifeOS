# LifeOS Adaptive Analytics — Slice 8 · Retention / Legacy / Hardening
## Reconciled Discovery (old Discovery @ `ea3a75e` → current main @ `414df14`)

Generated: 2026-09-29 · Claude Code (Opus 5.5) · parallel planning wave
Mode: READ-ONLY static reconciliation. No branch/worktree change, no tracked-file edit, no DB, no tests,
no app imports, no benchmark data, no DELETE. Artifacts written only under `_parallel_planning/slice8/`.

---

## 1. Verdict

**RECONCILIATION = PASS.** Every old finding F1–F5 is still true on current main. Slice 4 (Review) is now
merged, so the old "future contract" for Review is replaced by verified schema. Slice 5 added no table but
added a new read model (Project Analytics) with its own retention hazard. Slices 6 and 7 are absent.

| # | Old finding | Current status | Evidence at `414df14` |
|---|---|---|---|
| F1 | `delete_fact(mode="hard")` refuses any chain member | **CONFIRMED_CURRENT** | `services/aa_deletion.py:109-121` (`DeletionConflictError`, both directions); supersession FKs have no `ON DELETE` (`models/mixins.py:118-133`) |
| F2 | provenance redaction is O(account-provenance) per deleted fact | **CONFIRMED** (unchanged) + Review redactor now exists, **per-fact** | `_redact_provenance` `aa_deletion.py:67-88` walks every FACT_TABLE in 200-row `FOR UPDATE` batches per fact id; `SOURCE_REDACTORS = (redact_review_context,)` `aa_deletion.py:36`, signature `(db, user_id, table_name, fact_id)` |
| F3 | Actual-history keyset cursor loses `id` tie-break | **CONFIRMED_CURRENT** | `services/aa_facts.py:365-367` Python tuple `>`; isolated compile (SQLAlchemy 2.0.51, no `app.*` import) → `aa_measurements.occurred_at > %(occurred_at_1)s`; `tuple_()` form compiles to `(occurred_at, id) > (:p1, :p2)`; semantic layers already use `tuple_` (`routes/aa_history.py:211`); only test uses 3 distinct timestamps (`tests/test_aa_measurements.py:175-205`) |
| F4 | partial month presented as `present` | **CONFIRMED** | `services/aa_finance.py:216` `availability = "insufficient_data" if unknown else ("present" if rows else "no_data")` |
| F5 | absent/deleted coverage reported as never established | **CONFIRMED** | `services/aa_coverage_claims.py:282` `reason=None if claims else "не установлена"`; `analytics/coverage.py` has no truncated state |

`git diff ea3a75e 414df14` over `aa_facts.py`, `aa_finance.py`, `aa_coverage_claims.py`, `analytics/coverage.py`,
`models/mixins.py` is **empty**; `aa_deletion.py` changed only to register the Review redactor (+8/−2).

---

## 2. Baseline and remote state

```
PINNED_BASELINE   414df142700653d616016ff644bff3d9c0007540   (git cat-file -t → commit)
LOCAL HEAD        414df14… on main, clean
REMOTE main       414df14… at start (git ls-remote, read-only)
Old Discovery     ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef (pre-Slice-4)
```

## 3. Sources read

`AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md` (§40–§43, §65), `Outputs/architecture/module-boundaries.md`,
Phase B Plan (§4, §7, §11.4, §14, §22.1, §24.9–§24.11, §27, §29), implementation reports 0/0b/1/2/3/4/P/5,
Architecture Hardening (modularization) report, PR #14 correctness report, old Slice 8 Discovery (full),
and current code listed per finding. Reports were read in full by a read-only sub-agent via `git show` at the
pinned SHA; code seams were read directly.

No CLAUDE.md ↔ AGENTS.md conflict found.

---

## 4. What changed since the old Discovery

### 4.1 Table inventory 13 → 19 (CURRENTLY_VERIFIED)

Models 19 = migrations 19 (`0002`:3, `0003`:1, `0004`:8, `0005`:1, `0006`:6) = `EXPORT_TABLES` 19;
`TRUNCATED_TABLES` = 18 `aa_*` (+ seeded `aa_metric_definitions` excluded by design). Alembic head `20260928_0006`.
Slice 5 report confirms registries unchanged. See dependency matrix §0.

### 4.2 Slice 4 Review — now verified (was FUTURE_CONTRACT)

- Six tables: `aa_reviews`, `aa_review_revisions`, `aa_review_context_items`, `aa_review_context_sources`,
  `aa_review_factors`, `aa_decisions` (the in-flight six-table design merged).
- `aa_review_context_sources(item_id → items ON DELETE CASCADE, source_table CHECK ∈ REVIEW_SOURCE_TABLES,
  source_fact_id)` + index `ix_aa_review_context_sources_user_fact (user_id, source_fact_id)` — **no `source_table`
  in the index** (fine for bulk `ANY(:ids)` lookup since ids are UUIDs).
- `REVIEW_SOURCE_TABLES` = the 10 FACT_TABLES (`models/aa_review.py:60-71`).
- Redactor `services/reviews/redaction.py:20-62`: select item ids by `(user_id, source_table, source_fact_id)`,
  bulk `UPDATE … SET ERASED_ITEM_VALUES, redacted_at, redaction_reason='source_hard_deleted'`, then delete **all**
  links of those items. It is set-friendly internally but its **entry point is per fact**.
- CHECK `ck_aa_review_context_items_redacted_erased` makes residue unrepresentable.
- `RedactionReason` has exactly one value `source_hard_deleted` (`analytics/enums.py:260-261`) enforced by CHECK.
  A retention-specific reason would require a CHECK swap (Plan choice, §P-5 in provisional plan).
- **Tombstone does NOT redact** Review values (Slice 4 D-8; `reviews/read_model.py:45` → `WITHDRAWN`). Hence
  retention must never be implemented as tombstone.
- `aa_decisions`: review scope only; Slice 6 swaps CHECKs (`models/aa_decision.py:9-10`).

### 4.3 Architecture Hardening seam moves

- Review code split into `app/services/reviews/{errors,values,contracts,context,persistence,redaction,read_model}.py`;
  facade `app/services/aa_reviews.py`; `SOURCE_REDACTORS` must keep importing via the facade (pinned by
  `test_aa_review_contracts.py`).
- `module-boundaries.md` L30: a new AA fact table requires model + migration + export registry + deletion coverage
  **in the same change** — applies to `aa_retention_policies`.
- Settings split: activityLog cleanup now in `apps/web/src/components/settings/DangerSection.jsx:31,72`
  (was `SettingsPage.jsx:315-371`); server export in `settings/ExportSection.jsx`.
- Locale split: `apps/web/src/context/locale/{ru,uk}.js` (`set_clear_history_hint` ru:927, uk:865).
- Web AA client split: `apps/web/src/api/analytics/{facts,finance,history,projects}.ts`.
- No F1/F2/F3 semantics changed by hardening.

### 4.4 Slice 5 Project Analytics — new read-model hazard

`GET /api/v1/aa/projects/{project_id}/analytics` (`routes/aa_projects.py:22-35`, auth only, no gate, no body).
Service `services/aa_project_analytics.py`:
- forecast grain = all non-tombstoned rows (incl. superseded/REVISION), `recorded_at <= as_of`; ordered `recorded_at, id`;
- `first_forecast` = **first surviving** version; `latest_forecast`; dual delta neutral;
- `forecast_versions_truncated` = **page-cap flag** (`MAX_FORECAST_VERSIONS = 200`), *not* retention —
  name collision risk: retention must use a distinct field;
- states `no_facts · too_early · actual_not_recorded · no_forecast · compared`; `no_facts` copy
  «Прогноз и факт завершения ещё не записаны» (ru:758).

Hazards:
1. If a whole Project unit is pruned, the endpoint returns `no_facts` = "not yet recorded" — **false** after retention.
2. If any partial pruning of forecast chain happened, «первая сохранённая оценка» (ru:762/786) would silently shift.
3. Already today (Slice 5 backlog #5): a lone never-revised forecast can be hard-deleted and leaves no gap indicator
   "without subject-level deletion receipts". Retention must not amplify this; a subject-level horizon/record is needed.
4. Project archival writes **no** AA fact (Slice P); only the completion Actual (`project.completion_date`) closes a unit.

### 4.5 Other reconfirmations

- Account deletion: `DELETE FROM users` + CASCADE (`services/account.py:14-17`); unchanged.
- activityLog → AA path: none. `git grep -i activitylog` in `apps/api/app`, `apps/web/src/{analytics,api,repositories}`
  → only `schemas/aa_finance.py:58 activity_log_imported: Literal[0]` and its TS mirror. `ACTIVITY_LOG_TO_AA_PATH_FOUND=NO`.
- Legacy import: `occurred_at = local midnight` (`aa_legacy_import.py:84-85`), `recorded_at = ingestion time`,
  `source_kind=IMPORTED`, `original_recorded_at_known=False`, `source_ref={"snapshot_transaction_id": …}` —
  confirms `recorded_at` must never be the retention age axis, and equal-`occurred_at` density makes F3 real.
- Signal episodes are still **not** touched by hard delete (plan §11.4 drift, K6 — unchanged).
- `DISCOVERY_MONTHS = 13` (`aa_signals.py:64`); Slice 3 known limitation: corrections to older periods do not re-evaluate.
- Advisory-lock precedent: `aa_comparison.py:93` `pg_advisory_xact_lock`.
- Privacy routes independent of the write gate (0b: "Export and erasure do not depend on the recording gate").

### 4.6 New static observation (not in old Discovery) — `PLAUSIBLE`, verify later

`routes/aa_finance.py:51-53,66,86`: the two finance `POST` routes call `require_json_content_type` **inside the
handler** after a Pydantic body parameter, not as a route dependency. By the Slice 3 reasoning this can yield a
parser 422 before 415 for a non-JSON body. Not verified by test here (tests forbidden). Candidate for the Slice 8
"415 before 422" hardening sweep; do not fix in this session.

---

## 5. Current seams (updated)

| Seam | Location @ 414df14 | Slice 8 use |
|---|---|---|
| Model registry | `app/models/__init__.py` | + retention model(s) |
| Export registry | `services/export.py` `EXPORT_TABLES` | + retention table(s); manifest revision bump |
| TRUNCATE registry | `tests/conftest.py` `TRUNCATED_TABLES` | + table(s); guard test |
| Hard delete | `services/aa_deletion.py` | do **not** route retention through `delete_fact`; add bulk path |
| Review redaction | `services/reviews/redaction.py` via facade `services/aa_reviews.py` | add bulk variant (ids array) in same module |
| Review contracts | `services/reviews/contracts.py` `ERASED_ITEM_VALUES` | reuse |
| History | `services/aa_facts.py:338-369` `read_history`; `routes/aa_history.py` | F3 fix; horizon disclosure |
| Finance | `services/aa_finance.py:176-216` | truncated month |
| Coverage | `services/aa_coverage_claims.py:210-283`, `analytics/coverage.py` | truncated state |
| Signals | `services/aa_signals.py` (`DISCOVERY_MONTHS`, `_zero_state`) | exclude truncated windows |
| Project Analytics | `services/aa_project_analytics.py`, `schemas/aa_projects.py` | retention-truncated state |
| Security | `security/origin.py`, `security/aa_gate.py` | new unsafe routes as dependencies |
| Settings UI | `components/settings/DangerSection.jsx` (activityLog) | new **separate** AA retention section |
| Locale | `context/locale/ru.js`, `uk.js` | new keys + parity |

---

## 6. Retention-specific consequences (reconciled)

1. **Chain-aware deletion (F1).** Never loop `delete_fact`. Eligibility unit = whole chain / whole window / whole
   Project unit. Never rewire links. One-statement whole-chain delete relies on NO ACTION end-of-statement checking —
   **must be proven on `lifeos_test` later**, not assumed. Membership-override chains that CASCADE with measurements
   need the same proof.
2. **Bulk redaction (F2).** Retention needs (a) set-based provenance redaction over `source_ref` JSONB for a set of
   pruned ids (at least as conservative as `_references`, which matches case-folded substring or UUID anywhere in
   keys/values), and (b) a bulk Review redactor keyed by `(user_id, source_fact_id = ANY(:ids))` using the existing index.
   Review redaction runs **before** source deletion, in the same transaction. User note/revisions/factors/decisions survive.
3. **F3 first.** Fix and regression-test the Actual cursor before any EXPLAIN work; plan performance against the
   `tuple_(occurred_at, id) > tuple_(:t, :id)` shape.
4. **Truthful truncation (F4/F5).** Horizon aligned to whole local month start. Reads over pre-horizon ranges must
   report *retention-truncated* — distinct from `no_data`, `unknown_coverage`/«не установлена», zero, and `present`.
5. **Semantic age axes** per concept (matrix §2). Legacy imports recorded recently for old `occurred_at` are pruned
   by `occurred_at`, never escape via `recorded_at`.
6. **Project units.** Only whole completed-project units (Actual present, all semantic times pre-horizon);
   Project Analytics must say "history deleted by retention", never `no_facts`.
7. **Never tombstone for retention** (Slice 4 tombstone keeps frozen Review values).

---

## 7. Risks (updated)

| # | Risk | Sev | Change vs old |
|---|---|---|---|
| K1 | F1 chain refusal / rewire temptation | H | unchanged |
| K2 | F2 O(N×M) provenance + per-fact Review adapter at 180k | H | Review part now concrete |
| K3 | F3 silent history skip | H | unchanged, still live |
| K4 | F4 partial month `present` | H | unchanged |
| K5 | F5 truncated coverage = «не установлена» | M | unchanged |
| K6 | plan §11.4 episodes-on-hard-delete drift | L | unchanged |
| K7 | tombstone keeps frozen Review values | H | now verified |
| K8 | `DISCOVERY_MONTHS=13` vs short horizons | M | unchanged |
| K9 | per-fact receipts at scale; `fact_id NOT NULL` | M | unchanged (O4) |
| K10 | unlimited-after-finite must still disclose horizon | M | unchanged |
| K11 | S7 `change_key` / cross-ref endpoints may embed pruned ids | M | R-S7 |
| K12 | NO ACTION end-of-statement assumption | M | unchanged |
| K13 | **new** Project Analytics `no_facts` after whole-unit prune ⇒ false "never recorded" | H | new (Slice 5) |
| K14 | **new** `forecast_versions_truncated` name collides semantically with retention truncation | L | new (Slice 5) |
| K15 | **new** finance POST 415-vs-422 ordering (PLAUSIBLE) | L | new |
| K16 | **new** `RedactionReason` single-valued CHECK — a retention reason needs a constraint swap in M8 | L | new (Slice 4) |

## 8. Reverify after predecessor merge

Final Alembic head; `aa_*` inventory vs models/migrations/`EXPORT_TABLES`/`TRUNCATED_TABLES`; `FACT_TABLES` /
`REVIEW_SOURCE_TABLES` / `SOURCE_REDACTORS` membership after S6/S7; `aa_decisions` CHECKs after M6; experiment
child FKs; baseline pinning by experiments; `/aa/changes` shape & indexes; `change_key` format; cross-reference
endpoint typing; System Review history windows; whether any predecessor fixed F3 or changed F1/F2; master context
statement that Slice 7 is complete.
