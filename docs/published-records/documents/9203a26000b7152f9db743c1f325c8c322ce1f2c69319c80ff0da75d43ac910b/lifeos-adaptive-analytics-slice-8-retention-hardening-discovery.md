# LifeOS Adaptive Analytics — Slice 8 · Retention / Legacy / Hardening
## Parallel Discovery (read-only, destructive-domain, conservative)

Generated: 2026-09-28 · Claude Code (Opus 5.5) · parallel-discovery wave
Mode: DISCOVERY ONLY — no implementation, no migration, no branch change, no commit,
no DB access, no benchmark data created.

---

## 1. Executive verdict

**DISCOVERY_STATUS = PASS (provisional, predecessor-dependent).**

Enough architecture is known to draft a provisional Slice 8 plan **for the tables that
exist on baseline** (13 `aa_*` tables). The future tables of Slices 4, 6, 7 are known
only as *contracts* (parent Phase B Plan §7, §12, §24.6–§24.10) and — for Slice 4 — as
one **unmerged, in-flight** plan. Their physical FKs, indexes and deletion hooks must be
re-verified after merge before any deletion code is planned for them.

Five findings materially shape Slice 8 and were **not** visible in the parent plan:

| # | Finding | Consequence for Slice 8 |
|---|---|---|
| F1 | `delete_fact(mode="hard")` **refuses any row that is part of a correction/revision chain** (`DeletionConflictError`, `aa_deletion.py:108-119`). | Retention cannot reuse the per-fact hard-delete path. It needs a **chain-aware** eligibility rule (delete a chain only as a whole, only when every member is past the horizon). |
| F2 | Provenance redaction (`_redact_provenance`) walks **every row of every fact table** per deleted fact in Python (batched 200, `FOR UPDATE`). | O(deleted × total) — unusable for bulk retention at ~180k rows. A **set-based** redaction path is required. |
| F3 | **Confirmed defect:** Actual-history keyset cursor in `read_history` (`aa_facts.py:363-367`) uses a *Python tuple* comparison. With SQLAlchemy 2.0.51 it compiles to `m.occurred_at > :occurred_at_1` — **the `id` tie-breaker is lost** (verified by compiling the expression). Legacy-imported transactions all share local-midnight `occurred_at`, so rows at a page boundary are **silently skipped**. The semantic-layer cursors in `aa_history.py:211` use `tuple_()` correctly. Existing test uses distinct timestamps and does not catch it. | In-scope Slice 8 *hardening* (history query review). Must be fixed + regression-tested **before** EXPLAIN review, since the fixed query shape is what must be planned. |
| F4 | `derive_month` returns `availability="present"` with a **partial sum** for any month that still has some rows (`aa_finance.py:215-216`). A retention cutoff falling mid-month would present a truncated month as complete. | Retention horizon must be **aligned to whole windows** (month boundary for finance periods) *and* read models must carry an explicit truncation marker. |
| F5 | Coverage report returns `reason="не установлена"` and `unknown_coverage` when claims are absent (`aa_coverage_claims.py:282`). After pruning coverage claims, pre-horizon windows would be reported as *never established* rather than *deleted by policy*. | `CoverageReport` (and quality strip) needs a distinct **retention-truncated** state; truncated ≠ unknown ≠ missing ≠ zero. |

No owner decision is strictly required to proceed to a **provisional** plan; the
conservative defaults proposed in §19 are derivable from D1/D2/D3, C5–C8 and the
"nothing disappears silently" principle. Four points are flagged as *owner-confirmable*
(non-blocking) because they change what a finite policy actually deletes.

---

## 2. Baseline SHA actually inspected

```
BASELINE        ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef   (git cat-file -e: OK)
Inspection      git show / git grep / git ls-tree against the baseline object
Worktree note   The canonical checkout was concurrently on
                feat/adaptive-analytics-slice-4-reviews @ fb7f8a4b7f032b3d176609da0650d2b0ca4988ef
                ("Add Slice 4 Review discovery and implementation plan") — another session.
```

Some files were read from the working tree while `git` was temporarily unavailable to this
session. Afterwards, `git diff --stat ea3a75e -- <every file read>` returned **empty** —
those reads are byte-identical to baseline. All other evidence was taken from Git objects.

No `git switch/checkout/reset/stash/commit` was run. No DB was contacted. No Python code
was run against the repository modules; the only execution was a standalone SQLAlchemy
expression compile in `apps/api/.venv` (no imports of `app.*`, no I/O).

---

## 3. Source authority list

| Source | Status | Used for |
|---|---|---|
| `AGENTS.md`, `CLAUDE.md` | authority | process, safety |
| `LIFEOS_MASTER_CONTEXT.md` @ baseline | authority (§36 says Slice 4 next) | D1–D5, C1–C8, invariants |
| `Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` | accepted parent plan | §7 table map, §11.4 delete semantics, §12 Review R2, §14 export/delete, §20 coverage, §22 migration graph (M8), §24.11 Slice 8, §27 T-17, §29 performance |
| `Outputs/Discoveries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md` | accepted discovery | §23 volume estimate (~35k rows/yr, ~180k/5y) as cited by plan §29 |
| `Outputs/Implementations/lifeos-adaptive-analytics-slice-3_20260928-151155.md` | accepted report | M4 schema, `DISCOVERY_MONTHS=13`, export/TRUNCATE registries |
| Baseline code (`apps/api`, `apps/web`) | **primary truth** | everything in §4, §6 |
| Frozen design `adaptive-analytics-design-accepted` → `d496028` | semantic reference | `git grep` for retention/horizon/хранение in `ui_kits/life-os-analytics`: **no matches** — the frozen kit specifies no retention UI |
| Unmerged Slice 4 plan `fb7f8a4:Outputs/Plans/lifeos-adaptive-analytics-slice-4-review-implementation-plan_20260928-163820.md` | **in-flight, NOT accepted** | only as a hint of how the parent contract is being realised; every item from it is MUST_REVERIFY |

---

## 4. Current baseline architecture relevant to this slice

### 4.1 Complete `aa_*` inventory at baseline — **13 tables** (CURRENTLY_VERIFIED)

Registered in `app/models/__init__.py`, `EXPORT_TABLES` (`services/export.py:43-59`) and —
except the seeded catalogue — `TRUNCATED_TABLES` (`tests/conftest.py:67-83`).

| Table | Migration | Owner | Supersession chain | Extra FKs | Notable indexes |
|---|---|---|---|---|---|
| `aa_metric_definitions` | M1 `20260909_0002` | **global / no `user_id`** | — | — | PK `metric_key` |
| `aa_measurements` | M1 | user, CASCADE | self FK `supersedes_id`, `superseded_by_id` (no ON DELETE) + `UNIQUE(supersedes_id)` | `metric_key → aa_metric_definitions` | `(user_id, recorded_at DESC)`, `(user_id, subject_key, occurred_at DESC)`, `(user_id, metric_key, occurred_at DESC)`, partial `(user_id, subject_key, occurred_at) WHERE status='active'` |
| `aa_source_coverage` | M1 | user, CASCADE | self FK chain | `metric_key` (nullable) | partial `(user_id, subject_key, window_start_date, window_end_date) WHERE status='active'`, `(user_id, recorded_at DESC)` |
| `aa_deletion_receipts` | M2 `20260909_0003` | user, CASCADE | — | — | `(user_id, deleted_at)`; columns `table_name, fact_id, deleted_at` — **no content** |
| `aa_expectation_versions` | M3 `20260910_0004` | user, CASCADE | self FK chain | `metric_key` | `(user_id, recorded_at DESC)`, `(user_id, subject_key, recorded_at)` |
| `aa_forecast_versions` | M3 | user, CASCADE | self FK chain | `metric_key` | same |
| `aa_baselines` | M3 | user, CASCADE | self FK chain | `metric_key` | same (+ window cols) |
| `aa_targets` | M3 | user, CASCADE | self FK chain | `metric_key` | same (+ window, `is_explicitly_absent`) |
| `aa_preferences` | M3 | user, CASCADE | self FK chain | `metric_key` | same |
| `aa_observations` | M3 | user, CASCADE | self FK chain | `metric_key` | same |
| `aa_metric_policy_versions` | M3 | user, CASCADE | self FK chain | `metric_key` | `(user_id, metric_key, effective_from)`, `(user_id, recorded_at DESC)` |
| `aa_metric_membership_overrides` | M3 | user, CASCADE | self FK chain | **`source_fact_id → aa_measurements.id ON DELETE CASCADE`** | `(user_id, metric_key, source_fact_id)` + partial active variant |
| `aa_signal_episodes` | M4 `20260928_0005` | user, CASCADE | **none** (state row) | — | `(user_id, rule_id)`, `(user_id, subject_key)`, partial `(user_id, last_evaluated_at) WHERE resolution IS NULL`; `UNIQUE(user_id, episode_key)` |

Shared integrity (`mixins.aa_integrity_constraints`): `UNIQUE(user_id, idempotency_key)`,
`UNIQUE(supersedes_id)`, `status ∈ {active, superseded, tombstoned}`,
`superseded ⇒ superseded_by_id AND superseded_at`, `active ⇒ no successor`,
`tombstoned ⇒ tombstoned_at`, `original_recorded_at_known OR source_kind='IMPORTED'`.

**Supersession FKs have no `ON DELETE` action** (default NO ACTION). Deleting one member
of a chain while another references it fails; deleting a whole chain in **one statement**
is expected to pass because NO ACTION is checked at statement end. *(MUST_VERIFY in plan
with a lifeos_test test — not assumed.)*

### 4.2 Hard-delete / tombstone (`services/aa_deletion.py`, `routes/aa_facts.py`)

- `FACT_TABLES` = 6 concept tables + policy versions + membership overrides +
  `aa_measurements` + `aa_source_coverage` (10 tables). Not addressable: definitions,
  receipts, signal episodes.
- **hard:** row lock → **refuse if any chain link exists** (F1) → redact every
  `source_ref` in all FACT_TABLES that mentions the id (F2, also nulls `basis`/`method`)
  → for measurements, also redact references to cascading membership overrides →
  `SOURCE_REDACTORS` hook (empty tuple on baseline; "Slice 4 will register") → delete →
  receipt `(user_id, table_name, fact_id, deleted_at)` → commit. Signal episodes are
  **not** touched (plan §11.4 said acknowledgements whose fingerprint contains the fact
  would be deleted — **drift**, see §17).
- **tombstone:** values/provenance nulled in place, row kept (`status='tombstoned'`).
- Route: `DELETE /api/v1/aa/facts/{table}/{fact_id}?mode=`, `enforce_same_origin`, no
  body; available even with the write gate closed.

### 4.3 Account erasure / export (CURRENTLY_VERIFIED)

- `services/account.py`: `DELETE FROM users WHERE id=:u` → every `aa_*` row goes by FK
  cascade. Route `DELETE /api/v1/account`, `require_json_content_type` dependency,
  body `confirmation: "DELETE_ACCOUNT"`.
- Export: `validate_export_registry()` asserts *mapped aa_* == registry*;
  `build_account_export` asserts *registry == real `aa\_%` tables in DB*; REPEATABLE READ,
  READ ONLY, streamed NDJSON in a temp ZIP; `aa_metric_definitions` exported in full (no
  `user_id` filter). Manifest records `alembic_revision`.

### 4.4 Read models that assume retained history (CURRENTLY_VERIFIED)

| Read model | History assumption | Retention hazard |
|---|---|---|
| `GET /aa/metrics/{key}/history` (`routes/aa_history.py`) | mandatory range; actual layer by `occurred_at`; semantic layers by `recorded_at` | pre-horizon range silently returns empty — must say *truncated*, not *empty* |
| `derive_month` / `monthly_spend_inputs` (`services/aa_finance.py`) | month = sum of active measurements; `no_data` if none, **`present` if any** | F4: partial month looks complete |
| `coverage_report_for_window` | claims only; no claim ⇒ `unknown_coverage`, reason «не установлена» | F5 |
| C7 inclusion `include(fact, T)` (`services/aa_metric_policy.py`) | policy version **in force at T** + overrides as-of T | deleting an old-but-still-in-force policy version makes *current* windows `policy_known=false` |
| Signals (`services/aa_signals.py`) | subject discovery `DISCOVERY_MONTHS = 13`; R1 month spend; R2 whole forecast history; R3 `max(recorded_at)`; R4 coverage | a cutoff < 13 months truncates evaluated windows; R2 fingerprint spans full forecast history |
| Baselines | **stored captured rows** (`aa_baselines`), not derived from measurement history at read time | pruning measurements does not fabricate or alter a baseline; pruning the baseline row itself removes the reference |
| Project forecast history (Slice P/5) | first forecast needed for "actual vs first" dual delta | pruning early versions of a live project destroys the dual delta |

### 4.5 Legacy `activityLog` (CURRENTLY_VERIFIED)

- Snapshot field `payload.activityLog`, `lib/activity.js` FIFO `CAP = 5000`.
- Settings «очистить историю старше» 3/6/12 months → `data.clearActivityOlderThan(cutoff)`
  → `LifeActivity.pruneOlderThan` → **snapshot-only mutation**, emits no log, no AA call
  (`SettingsPage.jsx:315-325`, `LifeDataContext.jsx:830-834`). Copy
  `set_clear_history_hint` «удалит activityLog старше порога» (ru) / «видалить activityLog
  старший порогу» (uk).
- «Сбросить» (`hardReset`) replaces the snapshot only; no AA endpoint.

### 4.6 Proof: no `activityLog → AA` conversion path (CURRENTLY_VERIFIED)

`git grep -i -E 'activityLog|pruneOlderThan|LifeActivity' ea3a75e -- apps/` (non-test):
references exist only in `ActivityTimeline.jsx`, `MultiChangeWarningModal.jsx`,
`SettingsPage.jsx`, `TaskDetailModal.jsx`, `LifeDataContext.jsx`, `LocaleContext.jsx`,
`domain/clarify.ts`, `lib/activity.js`, `MedConfigDrawer.jsx`, `TakeDoseModal.jsx`.
`git grep -i activity` over `apps/web/src/analytics`, `apps/web/src/repositories`,
`AnalyticsContext.jsx` and `apps/api/app` → only
`schemas/aa_finance.py:58 activity_log_imported: Literal[0] = 0`.
`aa_legacy_import.py` reads only `payload.transactions` and `payload.categoryOverrides`.
`tests/test_aa_legacy_import.py:32` seeds `"activityLog": [{"action": "must-not-import"}]`
and asserts `activity_log_imported == 0` (plus five other `*_backfilled == 0`).

**ACTIVITY_LOG_TO_AA_PATH_FOUND = NO.** The plan-named permanent test **T-17** exists in
spirit (schema-level `Literal[0]` + import test) but not as a *code-path* scan; Slice 8
should add the static assertion the plan describes.

---

## 5. Planned predecessor contracts this slice depends on

| Slice | Contract (parent plan) | Classification |
|---|---|---|
| 4 Review | `aa_reviews`, `aa_review_context_items` (normalized, `source_table`/`source_fact_id`, `redacted_at`, CHECK redacted ⇒ values NULL, INDEX `(user_id, source_fact_id)`), `aa_review_factors` (no source link, never redacted), `aa_decisions` (nullable choice); redactor registered in `SOURCE_REDACTORS` | FUTURE_CONTRACT · MUST_REVERIFY_AFTER_MERGE |
| 4 (in-flight) | Unmerged plan adds `aa_review_revisions` and a separate context-source link table (`item_id → items ON DELETE CASCADE`, `(user_id, source_fact_id)` index); **tombstone does not redact** («источник позже отозван», value kept) | UNKNOWN_UNTIL_PREDECESSOR_MERGES |
| 5 Project analytics | dual delta (actual vs first / latest forecast); no new table | FUTURE_CONTRACT (read-model dependency on full forecast chains) |
| 6 Experiment | `aa_experiments` (lifecycle ⊥ outcome, `ABANDONED` terminal), `aa_experiment_adherence` (one row per elapsed day, `state='unknown'` legal), `aa_experiment_observations` (fact template), `aa_decisions` widened to experiment scope | FUTURE_CONTRACT · MUST_REVERIFY |
| 7 Trade-off / System Review | `aa_importance_ratings` (user-owned, keyed by `change_key`), `aa_cross_references` (explicit user relations only; `causal_relation_forbidden`), `GET /aa/changes` (keyset), `GET /aa/system-review` (pending allow-list excludes ABANDONED) | FUTURE_CONTRACT · MUST_REVERIFY |
| 8 | `aa_retention_policies` (M8, `down_revision` = then-current head; parent plan names `aa_0009_retention`) | this slice |

---

## 6. Exact current code seams

| Seam | Location | Slice 8 use |
|---|---|---|
| Model registry | `apps/api/app/models/__init__.py` | add `AARetentionPolicy` |
| Export registry | `apps/api/app/services/export.py:43` `EXPORT_TABLES` | add `aa_retention_policies`; manifest `alembic_revision` test bump |
| TRUNCATE registry | `apps/api/tests/conftest.py:67` | add table; guard test enforces |
| Cascade guard | `test_all_analytics_tables_exist_with_a_cascade_from_users` (Slice 0) | covers new table automatically |
| Deletion service | `apps/api/app/services/aa_deletion.py` | reuse `SOURCE_REDACTORS` hook contract; **add** set-based bulk path (do not route retention through `delete_fact`) |
| Receipts | `AADeletionReceipt(user_id, table_name, fact_id, deleted_at)` | per-fact receipts are possible without schema change |
| Coverage | `apps/api/app/analytics/coverage.py` `CoverageReport`, `services/aa_coverage_claims.py` | add retention-horizon awareness |
| History | `apps/api/app/services/aa_facts.py:338` `read_history` (F3) + `routes/aa_history.py` | fix keyset; expose horizon |
| Finance | `apps/api/app/services/aa_finance.py:176` `derive_month` | truncated-month availability |
| Signals | `apps/api/app/services/aa_signals.py:64` `DISCOVERY_MONTHS` | must not evaluate truncated windows |
| Security | `security/origin.py` `enforce_same_origin`, `require_json_content_type` (as **route dependency**, the Slice 3 415 fix) | new unsafe routes |
| Settings | `apps/web/src/components/SettingsPage.jsx:315-371` (activityLog cleanup), `:254` server export | add a **separate** AA retention section |
| Locale | `apps/web/src/context/LocaleContext.jsx` (ru + uk) | new keys, parity test pattern from Slice 3 |
| AA client | `apps/web/src/api/analytics.ts`, `repositories/analyticsRepository.ts`, `context/AnalyticsContext.jsx` | get/update policy (direct call, not the durable queue — see §11) |

## 7. Exact expected future seams (MUST_REVERIFY_AFTER_MERGE)

- `SOURCE_REDACTORS` entry from Slice 4 — its signature `(db, user_id, table_name, fact_id)`
  is **per-fact**; bulk retention needs a set-based variant (`fact_ids` array) or must call
  it per id (cost to be measured).
- Review context link table name/columns and whether links are deleted on redaction.
- Slice 6 experiment children FK directions (`experiment_id ON DELETE CASCADE`?) and
  whether experiment observations use the shared supersession template.
- Slice 7 `change_key` format (does it embed fact ids or window ids?) and whether
  `aa_cross_references` point at fact ids (dangling-reference risk after pruning).
- `GET /aa/changes` query shape and indexes (EXPLAIN target that does not exist yet).
- Final Alembic head that M8 must chain onto.

---

## 8. Data model implications

### 8.1 `aa_retention_policies` — **expected YES**

Minimal, one current row per user, **append/version**, not update-in-place (a policy
change is itself history the user may need to audit — "current snapshot policy ≠
historical policy"):

```
aa_retention_policies
  id uuid PK · user_id → users ON DELETE CASCADE · created_at
  mode            text CHECK IN ('unlimited','finite')
  retain_months   int NULL   CHECK ((mode='unlimited') = (retain_months IS NULL))
                             CHECK (retain_months IS NULL OR retain_months >= <min>)
  confirmed_at    timestamptz NULL  CHECK (mode='unlimited' OR confirmed_at IS NOT NULL)
  consequences_version text NULL    -- which disclosure copy the user confirmed
  recorded_at     timestamptz NOT NULL
  supersession + idempotency (shared template) · status
  -- horizon evidence (written by an explicit execution, never by a scheduler)
  applied_horizon_date date NULL    -- "history before this local date was deleted"
  applied_at      timestamptz NULL
  applied_timezone text NULL
UNIQUE (user_id, idempotency_key), partial UNIQUE (user_id) WHERE status='active'
```

**Default = no row = unlimited.** Absence is *not* written as a row (C5 analogue: do not
synthesize a default fact); the read API reports `mode: "unlimited", source: "default"`.
Whether the horizon lives on the policy row or in a separate execution log is a Plan
choice; it **must** be durable and survive policy changes, because a user who later
switches back to *unlimited* still has truncated history — the horizon must keep being
disclosed (**unlimited-after-finite ≠ complete**).

### 8.2 Receipts

Per-fact receipts are schema-compatible today but at ~180k rows produce a receipt stream
as large as the deleted history. Plan must choose: (a) per-fact receipts (uniform with
§11.4, heavy), or (b) a run-level record (`table_name`, `deleted_count`, horizon, run id)
— needs either a new table or extending `aa_deletion_receipts` (**`fact_id` is NOT NULL**
today). Receipts and horizon records are **never age-pruned** (they are the disclosure).

### 8.3 Future retention dependency matrix (required)

Legend — age-prunable: **Y** eligible under finite policy · **C** conditional/whole-unit
only · **N** never by age. Reverify: **R** = MUST_REVERIFY_AFTER_MERGE.

| Table / concept | Now/Future | Age-prunable? | Dependency-sensitive? | Hard-delete interaction | Review-redaction interaction | Export interaction | Read-model impact | Reverify |
|---|---|---|---|---|---|---|---|---|
| `aa_metric_definitions` | now | **N** (global catalogue, no user_id) | FK target of all facts | never deleted | — | exported whole | everything | — |
| `aa_measurements` | now | **C** — by `occurred_at`, **whole chain**, whole window (month) | overrides CASCADE; provenance refs; review sources; signal inputs | `delete_fact` refuses chains (F1) | source of review items ⇒ redact (D1) | rows disappear; receipts/horizon appear | finance month, coverage stats, R1/R3, history | R (review links) |
| `aa_source_coverage` | now | **C** — `window_end_date < horizon`, whole chain | coverage report, R4 | same as above | may be a review source | same | F5: must report *truncated*, not *unknown* | — |
| `aa_metric_membership_overrides` | now | **C** — only via CASCADE with its measurement | depends on measurement | cascades on measurement delete | possible source | same | C7 inclusion | — |
| `aa_metric_policy_versions` | now | **N** for the version **in force at/after horizon**; older superseded versions **C** | C7 as-of for every later window | chain rule | possible source | same | `policy_known` | — |
| `aa_expectation_versions` | now | **C** — window/effective interval wholly before horizon, whole chain | R1 reference, deltas | chain rule | review source | same | Expected layer, delta | R |
| `aa_forecast_versions` | now | **C** — project subjects only as a **whole completed/archived project unit**; never partial | R2 fingerprint, Slice 5 dual delta | chain rule | review source | same | forecast count ("версий 3") | R (Slice 5) |
| `aa_baselines` | now | **C** — whole chain, window before horizon; disclose "older baselines unavailable" | experiments compare against baselines | chain rule | review source | same | baseline comparison becomes `no_data`, never recomputed | R (Slice 6) |
| `aa_targets` | now | **C** — window before horizon, whole chain | desirability grounding | chain rule | review source | same | desirability → neutral for pruned windows only | R |
| `aa_preferences` | now | **N** while active (standing ориентир); superseded **C** | desirability grounding | chain rule | source | same | desirability | — |
| `aa_observations` | now | **C** — `occurred_at`, whole chain | subjective+objective (H) | chain rule | source | same | H pairing | R |
| `aa_signal_episodes` | now | **C** — only episodes whose subject window lies wholly before horizon | derived from pruned facts | not touched by hard delete today | — | same | ack history of old periods | — |
| `aa_deletion_receipts` | now | **N** | disclosure/audit | written by deletions | — | exported | horizon evidence | — |
| `aa_retention_policies` | S8 | **N** | — | — | — | **must be exported** | horizon disclosure | — |
| `aa_reviews` | S4 | **N** (user-authored) | frozen context | survives | owner of redaction | exported | review reopen | R |
| `aa_review_context_items` | S4 | **N** as rows; values **redacted** when source pruned (D1) | source links | redacted, not deleted | *is* the redaction target | redacted items exported with marker | «источник удалён» | R |
| `aa_review_revisions` (in-flight only) | S4? | N | — | — | — | — | — | R |
| `aa_review_factors` | S4 | **N** (user text, never redacted) | — | — | untouched | exported | — | R |
| `aa_decisions` | S4/S6 | **N** (NULL ≠ inconclusive must stay representable) | review/experiment scope | — | — | exported | System Review | R |
| `aa_experiments` | S6 | **N** (proposed v1) | parent of adherence/obs | — | — | exported | lifecycle, pending | R |
| `aa_experiment_adherence` | S6 | **N** (proposed v1); never pruned inside a kept experiment | per-day; future ≠ missed | — | — | exported | «9 из 14» denominators | R |
| `aa_experiment_observations` | S6 | **N** (proposed v1) | experiment result | chain rule | source | exported | interim/result | R |
| `aa_importance_ratings` | S7 | **N** (user-owned) | `change_key` may name pruned windows | — | — | exported | orphan display must say "history deleted" | R |
| `aa_cross_references` | S7 | **N** (user-created) | endpoints may be pruned facts | dangling ref policy needed | — | exported | render endpoint as «источник удалён» | R |
| `activityLog` (snapshot) | now | own cleanup only | none with AA | — | — | in snapshot export | legacy timeline | — |

**TABLES_REQUIRING_POST_MERGE_REVERIFICATION:** all Slice 4/6/7 tables above, plus
`aa_measurements`, `aa_forecast_versions`, `aa_baselines`, `aa_targets`,
`aa_expectation_versions`, `aa_observations` (because they become review/experiment
sources whose link shape is not yet merged).

---

## 9. API implications (smallest surface)

| Method / path | Purpose | Guards |
|---|---|---|
| `GET /api/v1/aa/retention-policy` | current policy (`unlimited` default when no row), applied horizon, consequence list derived server-side | session |
| `PUT` (or `POST`) `/api/v1/aa/retention-policy` | set `unlimited` or `finite{retain_months}`; finite requires `confirm: true` + `consequences_version` equal to server's current; `idempotency_key` | `require_json_content_type` **as route dependency** (415 before parse), `enforce_same_origin`, ownership from session only |
| `POST /api/v1/aa/retention-policy/apply` | **explicit** execution; body echoes expected `horizon_date` and a fresh confirmation (a preview/dry-run response lists per-table counts before confirmation) | same; `409 retention_preview_stale` if counts/horizon changed |

No scheduler, no background worker. Unlimited ⇒ `apply` is a 409/no-op, never deletes.
Setting finite **does not** delete by itself (two-step: choose → preview → confirm apply)
so nothing disappears as a side effect of a settings toggle.

Should the write gate apply? Retention *reduces* personal data and is a privacy action;
per-fact deletion is gate-independent on baseline ("Privacy routes remain available even
when AA recording is disabled"). Policy **write** is a stored preference (personal data).
Plan decision: policy write behind `require_aa_write_enabled`, **apply** gate-independent
like `/aa/facts` deletion. Record rationale.

Read responses gaining horizon: history (`retention_horizon`, `truncated: bool` when range
precedes horizon), finance month (`availability: "truncated"` / `retention_truncated`),
coverage report (`retention_truncated_count` or window-level flag), signals zero state
(`unknown_coverage` must not become `confident` for truncated windows).

## 10. Frontend / product implications

- Settings gains a **separate** «Хранение аналитической истории» / «Зберігання
  аналітичної історії» section, visually and textually distinct from the activityLog
  «очистить историю старше» row (which must keep its current meaning and copy).
- Default renders **«Без ограничений»** / «Без обмежень».
- Finite flow: choose duration → consequence disclosure (older baselines, repeated-pattern
  detection, long-window coverage, long comparisons, *plus* Discovery-found: truncated
  finance months are hidden not zeroed, project forecast history of finished projects,
  signal re-evaluation of old periods, frozen Review evidence redacted «источник удалён»)
  → explicit confirmation → preview counts → apply.
- Frozen design has **no** retention surface → build from current Settings primitives;
  no prototype chrome.
- Quality strip / history must show the horizon («история до … удалена по вашему правилу
  хранения») — distinct from «нет данных» and «полнота неизвестна».
- RU + UK parity test (Slice 3 pattern: key-by-key).

## 11. Durable-write implications

Policy change and apply are **not** semantic facts and are destructive/consequential:
they must **not** go through `AnalyticsWriteQueue` (an offline-queued deletion executing
later, unseen, would violate "explicit confirmation"). Direct call, fail visibly offline —
same reasoning as Slice 3 acknowledgement. The queue must also never replay a stale
pending write *into* a pruned window without it being visible: a queued fact whose
`occurred_at` precedes the applied horizon should be accepted (the user just recorded it)
but then counts as post-horizon evidence only if the Plan decides so — **Plan decision**,
recommended: accept, and treat horizon as "history before X was deleted at time T", not
"no data may exist before X".

## 12. Export / privacy / delete implications

- `aa_retention_policies` into `EXPORT_TABLES`, TRUNCATE registry, cascade guard, M8
  manifest bump. Invariant *mapped == registry == DB* preserved.
- Export after retention contains receipts/horizon, never deleted content.
- **No hidden deleted values:** retention must not tombstone (tombstone keeps rows and —
  per the in-flight Slice 4 plan — **keeps frozen Review values**). Retention = hard
  deletion semantics + D1 redaction.
- Provenance `source_ref` referencing pruned ids must be redacted set-based (F2).
- Signal episodes of pruned periods: `last_fingerprint` is a hash of deleted ids — not a
  value, but evidence of deleted history; recommended: delete episodes whose subject
  window lies wholly before the horizon.
- Account deletion removes policy via CASCADE; add explicit test.

## 13. Temporal / as-of implications

- Age axis per concept (not one timestamp): measurements/observations `occurred_at`;
  coverage `window_end_date`; windowed versions `window_end`; forecasts: project unit
  completion; policy/preference: supersession + in-force rule. **Never `created_at`.**
- `recorded_at` alone is wrong as the age axis: a legacy import ingested yesterday for a
  2019 transaction would look "new" and escape the horizon, while the window it
  describes is pruned around it — leaving a partial window. Plan must define: eligible
  iff semantic time < horizon **and** every chain member's semantic time < horizon.
- Horizon computed in the user's IANA zone, aligned to **local month start** (finance
  periods are months) — `horizon_date = first day of month(today − retain_months)`.
- As-of queries for instants before the horizon cannot be answered truthfully after
  pruning → return truncated/unknown, never the post-deletion residue.

## 14. Migration implications

- One migration **M8**, `down_revision` = head after Slice 7 (unknown now; parent plan
  M7 `aa_0008_tradeoff`). Additive, one table, CASCADE from users.
- Downgrade = `DROP TABLE`, pre-write only (C8); note: dropping the policy after an
  `apply` would lose horizon disclosure → the horizon record must be treated as personal
  AA history (non-destructive rollback).
- No change to `users`, `sessions`, `user_snapshots`; `schema_version` stays 2;
  `state.version` stays 2.
- No index migration unless EXPLAIN evidence demands one (§15, §20).

## 15. Test strategy implications

Must-have (in addition to the owner's list):
1. default unlimited = no row, GET reports unlimited;
2. unlimited ⇒ `apply` deletes nothing (row counts identical across all 13+ tables);
3. finite without `confirm` / with stale `consequences_version` ⇒ 422/409, no change;
4. whole-chain rule: chain straddling horizon kept intact; chain wholly before horizon
   deleted in one statement (verifies NO ACTION FK behaviour);
5. in-force policy version and active preferences preserved;
6. month-aligned horizon; finance month before horizon ⇒ `truncated`, never `present`
   with partial sum, never 0 (F4);
7. coverage before horizon ⇒ truncated state, never `unknown`/«не установлена», never
   `observed` (F5);
8. no baseline recomputed/fabricated; pruned baseline ⇒ comparison `no_data`;
9. Review redaction residue scan after retention (post-Slice-4);
10. provenance residue scan: no `source_ref` mentions a pruned id;
11. receipts / horizon record written; export contains them and the policy;
12. activityLog cleanup does not change any `aa_*` count; AA apply does not change
    `payload.activityLog`; static T-17 scan: no AA module references `activityLog`;
13. **F3 regression:** many rows with identical `occurred_at` across page boundary ⇒ no
    row skipped, no duplicate;
14. 415 on wrong Content-Type for PUT/POST routes (not 422);
15. cross-account isolation (404), body `user_id` rejected;
16. migration up/down roundtrip on lifeos_test; export manifest revision bump;
17. EXPLAIN review recorded (opt-in perf test or script; not in default suite timing).

## 16. Concurrency / idempotency implications

- `apply` runs in one transaction per bounded batch **or** one transaction per unit
  (window/chain); must take a per-user advisory lock (pattern exists:
  `pg_advisory_xact_lock` in `aa_comparison.append_version`) so two tabs cannot apply
  concurrently, and so a concurrent correction cannot create a new chain member between
  eligibility check and delete (re-check eligibility under the lock / `FOR UPDATE`).
- Export uses REPEATABLE READ → an export concurrent with apply sees a consistent
  before-or-after view; acceptable.
- Policy writes idempotency-keyed; `apply` idempotent by `(user_id, horizon_date)` —
  replay returns the prior result.
- Signal evaluation concurrent with apply: episodes reconciliation only touches
  re-evaluated subjects; truncated windows must be excluded from discovery first.

## 17. Risks / ambiguities / hidden coupling

| # | Risk | Sev |
|---|---|---|
| K1 | F1 chain refusal — naive reuse of `delete_fact` makes retention either fail or tempt a "rewire chain" hack (forbidden: "do not silently break supersession chains") | H |
| K2 | F2 O(N×M) provenance redaction; untyped `source_ref` JSON makes set-based redaction need a JSONB-path strategy (`source_ref::text LIKE '%id%'` is what the Python walk effectively does) | H |
| K3 | F3 keyset skip bug — silent history omission today, independent of retention | H |
| K4 | F4 partial month presented as `present` | H |
| K5 | F5 truncated coverage mislabelled as «не установлена» | M |
| K6 | Drift: plan §11.4 says hard delete deletes dependent signal acknowledgements; baseline code does not | L |
| K7 | In-flight Slice 4: tombstone keeps frozen review values; retention must therefore never use tombstone | H |
| K8 | Signals `DISCOVERY_MONTHS=13` vs short retention; R2 fingerprint over whole forecast history | M |
| K9 | Per-fact receipts at scale; receipts `fact_id NOT NULL` | M |
| K10 | Unlimited-after-finite must keep disclosing horizon | M |
| K11 | Slice 7 `change_key` / cross-reference endpoints may embed pruned ids | M (R) |
| K12 | Deleting chains relies on NO ACTION end-of-statement checking — must be proven by test | M |

## 18. What MUST be re-verified after predecessor merge

1. Final Alembic head and full `aa_*` inventory (expected 22 per parent plan; 24 if the
   in-flight Slice 4 six-table design merges) against `EXPORT_TABLES` and DB.
2. Slice 4: redactor signature, link table, whether redaction deletes links, tombstone
   behaviour, CHECK "redacted ⇒ values NULL", index `(user_id, source_fact_id)`.
3. Slice 4/6: `aa_decisions` scope CHECK after M6 widening.
4. Slice 5: dual-delta dependency on first forecast; project unit definition.
5. Slice 6: experiment child FKs/ON DELETE; whether experiment observations are
   `FACT_TABLES` members; baseline usage by experiments.
6. Slice 7: `/aa/changes` query + indexes (EXPLAIN target), `change_key` format,
   cross-reference endpoint typing, System Review historical queries and their windows.
7. Whether any predecessor changed `delete_fact` chain refusal or `_redact_provenance`.
8. Whether any predecessor fixed F3 (then Slice 8 only adds the benchmark + regression).
9. Master context statement that Slice 7 is complete; frozen tag unchanged.

## 19. Owner decisions

**OWNER_DECISION_REQUIRED = NO** for a provisional plan. Conservative defaults proposed,
each derivable from accepted decisions; the owner may override without blocking:

| # | Question | Proposed default | Grounding |
|---|---|---|---|
| O1 | Which concepts does finite retention delete? | v1: observational streams + windowed versions under whole-chain/whole-window rules (§8.3 "C"); **never** user-authored entities (reviews, factors, decisions, experiments, importance, cross-refs) | D2 + "user-authored special preservation" + no silent loss |
| O2 | Does retention redact frozen Review evidence? | **Yes** — retention is a user-chosen hard erasure; D1 "hard erasure wins" applies; disclosed in consequence copy | D1 |
| O3 | Allowed durations | explicit list, e.g. 2 / 3 / 5 years, **minimum 24 months** (> `DISCOVERY_MONTHS` 13 and one year-over-year comparison) — no default selected | D2 "no invented default"; signal horizon |
| O4 | Receipts granularity | run-level retention record + horizon (disclosure), not 180k per-fact receipts — **needs M8 to hold it** | plan §24.11 "deletion receipts" + scale |

If the owner rejects O2 (i.e. wants review-referenced sources exempt), the plan must add a
"pinned by review" predicate — a design change, not a blocker.

## 20. Implementation-planning readiness + benchmark plan

**PERFORMANCE_BENCHMARK_PLAN (safe, isolated):**
- DB: `lifeos_test` only (conftest refuses non-`_test`); never `lifeos_dev`.
- Delivery: opt-in pytest marker (e.g. `-m perf`, excluded by default) or
  `apps/api/scripts/aa_explain_bench.py` that *reuses conftest's `_test` guard*; data
  inserted with `INSERT … SELECT generate_series` inside the test DB, removed by the
  existing `clean_database` TRUNCATE; nothing committed to Git except the script/test
  and the recorded plans in the implementation report.
- Dataset (~180k, Discovery §23 / plan §29 ≈ 35k/yr × 5y): account A ≈ 150k
  `aa_measurements` (`finance.transaction_amount`, ~5 years, ~95/day, many rows sharing
  local-midnight `occurred_at` to exercise F3), 2–3 % corrected (superseded chains),
  ~1 % tombstoned; ~2k coverage claims; ~3k semantic versions across concepts; ~500
  policy/override rows; account B ≈ 30k rows as selectivity noise; `ANALYZE` afterwards.
- Queries: (1) actual history page by metric, range 1 month & 12 months, first page and
  deep cursor, with/without `subject`, current and `as_of`; (2) semantic layer page;
  (3) coverage stats aggregate; (4) `derive_month` inputs; (5) R3 `max(recorded_at)`;
  (6) Slice 7 `/aa/changes` — **after merge only**; (7) retention eligibility + delete
  per window (EXPLAIN only, in a rolled-back transaction).
- Method: `EXPLAIN (ANALYZE, BUFFERS)`, record plan node types (Index Scan vs Seq Scan,
  Incremental Sort), rows, buffers, time; compare against existing indexes
  (`ix_aa_measurements_user_metric_occurred_at` is `(user_id, metric_key, occurred_at
  DESC)` with ASC ordering + `id` tie-break ⇒ expect backward index scan + incremental
  sort); **add an index only with evidence**.

**Readiness:** provisional plan can be drafted now for baseline tables, F3 fix, horizon
disclosure and the benchmark harness. Deletion code for Slice 4/6/7 tables and the
`/changes` EXPLAIN cannot be planned finally until those slices merge.

---

## Explicit outputs

```
CURRENT_AA_TABLE_COUNT=13
FUTURE_EXPECTED_AA_TABLES_AFTER_SLICE_7=22 (parent plan; 24 if in-flight Slice 4 six-table design merges) — MUST_REVERIFY
RETENTION_POLICY_TABLE_EXPECTED=YES
DEFAULT_RETENTION=UNLIMITED
ACTIVITY_LOG_SEPARATE=YES
ACTIVITY_LOG_TO_AA_PATH_FOUND=NO
SAFE_DELETION_ORDER_KNOWN_NOW=NO (known for baseline tables: lock → eligibility(whole chains/windows, not in force) → set-based review redaction → set-based provenance redaction → episodes of pruned windows → chain rows per table in one statement (overrides cascade) → run/horizon record; future-table order unknown)
TABLES_REQUIRING_POST_MERGE_REVERIFICATION=aa_reviews, aa_review_context_items(+ link table), aa_review_factors, aa_decisions, aa_review_revisions?, aa_experiments, aa_experiment_adherence, aa_experiment_observations, aa_importance_ratings, aa_cross_references, aa_measurements, aa_forecast_versions, aa_baselines, aa_targets, aa_expectation_versions, aa_observations
PERFORMANCE_BENCHMARK_PLAN=lifeos_test only; opt-in perf test/script behind the _test guard; ~150k measurements (acct A, shared-midnight timestamps, 2–3% chains) + ~30k noise (acct B) + coverage/semantic/policy rows; ANALYZE; EXPLAIN (ANALYZE, BUFFERS) on history (actual + layers, first/deep cursor, as_of), coverage stats, derive_month inputs, R3, retention eligibility/delete (rolled back); /aa/changes after Slice 7 merge; indexes only on evidence
SLICE_8_PLAN_CAN_BE_DRAFTED_NOW=YES (provisional; final plan after Slice 7 merge)
CONFIRMED_BASELINE_DEFECT=F3 read_history keyset cursor drops id tie-break (aa_facts.py:363-367)
```

```
DISCOVERY_STATUS=PASS
BASELINE_SHA=ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef
OWNER_DECISION_REQUIRED=NO
PREDECESSOR_MERGE_REQUIRED_FOR_DISCOVERY=NO
PREDECESSOR_MERGE_REQUIRED_FOR_PLAN=YES
PLAN_CAN_START_NOW=YES
PLAN_MUST_REVERIFY_AFTER_MERGE=YES
PRODUCTION_FILES_CHANGED=NO
GIT_BRANCH_CHANGED=NO
COMMIT_CREATED=NO
PR_CREATED=NO
```
