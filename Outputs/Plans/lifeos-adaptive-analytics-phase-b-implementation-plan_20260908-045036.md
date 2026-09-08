# LifeOS Adaptive Analytics — Phase B Implementation Plan

**Mode:** `PLAN_ONLY` · no implementation, no migrations, no schema change, no dependency install
**Generated:** 2026-09-08 04:50:36
**Author:** Claude Opus 5 (Claude Code session `01UeEfoDq36GfaNtcNTQpLR5`)

---

## 1. Executive plan verdict

`PHASE_B_PLAN_STATUS = COMPLETE`
`IMPLEMENTATION_READY = YES`
`PRE_0_READY = YES` · `SLICE_0_READY = YES` · `SLICE_0B_READY = YES` · `SLICE_1_READY = YES`
`NEW_OWNER_DECISIONS = 0`

All five owner decisions (D1–D5) are resolved, the G · Project sequencing is settled, and the four architecture corrections issued after Discovery — legacy bitemporal contract, signal episode identity, export/delete ownership, and the Review storage shape — are incorporated as binding engineering decisions in this plan.

**No new owner decisions are raised.** Every remaining question was decidable from repository evidence and is decided here with justification, per §31 of the brief.

The plan defines **12 execution units** (PRE-0, Slices 0, 0b, 1, 2, 3, 4, P, 5, 6, 7, 8), **8 additive migrations**, a metric catalogue of 3 entries, a signal rule catalogue of 4 rules, **20 permanent regression tests**, and a file-level manifest of ~104 concrete paths.

**This document incorporates post-plan architecture corrections C5–C8 (§34).** Those corrections are reconciled into every affected section below; §34 is a change record, not a set of overrides.

### The four decisions that carry the most structural weight

1. **Review context is normalized (`aa_review_context_items`), not an opaque JSONB blob.** D1 requires selective erasure of source-derived values from historical reviews. With a blob, redaction is a read-modify-write that must understand every JSON schema version ever written; with rows, it is one indexed `UPDATE … WHERE source_fact_id = :id`. See §12.
2. **Signal identity is split in two** — a rule-defined `episode_key` (stable user-facing occurrence) and an `input_fingerprint` (exact facts used). The Discovery's single global hash would have made a dismissed 90 % budget signal respawn on every subsequent transaction. See §13.
3. **Value typing is enforced by CHECK constraints, not convention.** A `value_type` discriminator with per-type column requirements means a stored fact always carries a real value, and makes cross-unit arithmetic unrepresentable rather than merely discouraged. **Missing is the absence of a row, not a stored `unknown`** — nothing is ever synthesized because an expected observation failed to arrive. See §9.
4. **Enumerations are `TEXT` + `CHECK`, not PostgreSQL native enums.** D4 already adds `ABANDONED` to a lifecycle; more values will follow. A CHECK constraint can be dropped and recreated inside an ordinary transactional migration; `ALTER TYPE … ADD VALUE` cannot be combined with dependent DDL in one transaction and values can never be removed. See §17.

### The corrections that closed real defects (C5–C8)

5. **Missing is the absence of a row** — not a stored `unknown` Measurement. `value_type` has no `unknown` member; explicit unknown survives only where the accepted design gives it meaning, and derived no-data is a response state. (§9.1–§9.3)
6. **Coverage rests on source evidence** (`aa_source_coverage`), never on transaction presence — a day with no transactions can be fully observed, and a day with one can be partly covered. Manual-only data reports `unknown_coverage`, never a bare fraction. (§20)
7. **Inclusion semantics are versioned** (`aa_metric_policy_versions` + `aa_metric_membership_overrides` + immutable per-fact `dimensions`) so a category toggle in December cannot silently rewrite August. (§18.2)
8. **Rollback after first write is non-destructive** — disable the flag, keep the schema and the data. Destructive downgrade is a pre-write-only tool. (§22.1, §28)

### What makes this plan structurally safe

Every frozen invariant is mapped to a mechanism that makes violation *hard*, not merely discouraged:

| Invariant | Structural enforcement |
| --- | --- |
| Expectation ≠ Target | Separate tables. `desire` derivation reads `aa_targets` / `aa_preferences` / `aa_decisions` only — it has no code path to `aa_expectation_versions` |
| Actual ≠ ForecastVersion | Separate tables. `COUNT(*) FROM aa_forecast_versions` needs no `WHERE NOT actual` filter |
| missing ≠ zero | **missing = no row**; coverage carries an explicit denominator backed by evidence; no aggregate zero-fills; no synthetic fact is written because an observation is absent (T-05) |
| missing ≠ explicit unknown | `value_type` has no `unknown` member; explicit unknown is a concept-specific column only where meaningful (§9.2); derived unknown is a response state, never a row |
| future ≠ missed | Per-day adherence rows; days after today simply have no row |
| direction ≠ desirability | `desire` is a derived field whose only inputs are grounding records; it never receives a sign |
| no cross-unit score | Delta requires matching `(value_type, unit_code)`; there is no numeric type that spans units |
| correction ≠ new event | `supersedes_id` chain; active-row predicate excludes superseded rows from every aggregate |
| NO_DECISION ≠ INCONCLUSIVE | `aa_decisions.choice` is nullable; `'inconclusive'` is an explicit value |
| ABANDONED ≠ pending | `lifecycle` excluded from the System Review pending query by an explicit allow-list |
| coverage ≠ fact presence | «Observed» requires an `aa_source_coverage` claim; absent evidence is `unknown_coverage`, never `observed` and never `missing` (T-19) |
| historical derivation ≠ current policy | inclusion resolved as-of T from versioned policy/overrides + immutable dimensions; the derivation path cannot read snapshot policy (T-18, T-20) |
| snapshot revision ≠ history | AA writes never touch `PUT /api/v1/state`; a snapshot 409 cannot pause the AA queue (permanent regression test T-12) |
| deleted ≠ hidden copy | Redaction is a targeted `UPDATE` on normalized context rows, verified by a test that greps for the erased value |

---

## 2. Verified start state

```
pwd                     /Users/yurasachenko/LifeOS/LifeOS_DesignSystem-adaptive-analytics-import
git rev-parse --show-toplevel   (same — worktree root)
branch                  design/adaptive-analytics-import
HEAD                    f6e27f3060a735458735e8acbdce8abc5f2bb0f0
design tag              adaptive-analytics-design-accepted  (annotated) → d4960286ec94f35472600e59c0d533dc50a64351
ancestry                git merge-base --is-ancestor d496028 HEAD  → OK
working tree            M .DS_Store   (pre-existing, user-owned, untouched)
```

**Invariant checks — all pass:**

| Invariant | Result |
| --- | --- |
| branch = `design/adaptive-analytics-import` | ✔ |
| HEAD descends from `d496028` | ✔ |
| tag still targets `d496028`, still annotated | ✔ |
| tag not moved | ✔ |
| no application implementation since Discovery | ✔ — see drift check below |

**Drift check — `DISCOVERY_CODE_DRIFT = NONE`:**

```
git diff --stat d4960286..HEAD -- apps/ ui_kits/ preview/     → (empty)
git diff --name-status d4960286..HEAD
  A  Outputs/Discoveries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md
  A  Outputs/Summaries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md
```

The only change since the frozen design tag is the two Discovery artifacts. **Every code anchor in the Discovery remains valid verbatim**, and all paths in this plan were re-inspected directly rather than copied.

**Discovery artifacts present:**
- `Outputs/Discoveries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md` (1251 lines)
- `Outputs/Summaries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md` (71 lines)

---

## 3. Accepted design + Discovery anchors

**Product / UX / semantic truth** — frozen at `adaptive-analytics-design-accepted` → `d496028`:
`ui_kits/life-os-analytics/{README.md, data.js, primitives.jsx, screens.jsx, domains.jsx, experiment.jsx, system.jsx, analytics.css}`, `preview/aa-delta.html`, `preview/aa-signal-card.html`.

**Engineering evidence base:** the Discovery report above.

**Implementation truth** — re-inspected in this session, all unchanged:

| Path | Fact this plan depends on |
| --- | --- |
| `apps/api/app/models/user_snapshot.py` | `user_id` is the PK — one mutable row per user |
| `apps/api/app/services/state.py` | full-payload replace, CAS on `revision`; prior payload unrecoverable |
| `apps/api/app/middleware/body_limit.py` | 5 MiB cap, enforced pre-parse, PUT `/api/v1/state` only |
| `apps/api/app/models/__init__.py` | models re-exported here; Alembic autogenerate depends on it |
| `apps/api/alembic/env.py` | `target_metadata = Base.metadata`; URL from `sqlalchemy.url` else settings |
| `apps/api/alembic/versions/` | exactly one revision, `20260721_0001`, `down_revision = None` |
| `apps/api/tests/conftest.py` | **`clean_database` TRUNCATEs a hardcoded table list** — must be extended per migration |
| `apps/api/tests/conftest.py` | `LIFEOS_TEST_DATABASE_URL` required; DB name must end `_test`; `account_factory` mints session cookies |
| `apps/api/app/dependencies.py` | `get_current_user` — the auth dependency every AA route reuses |
| `apps/api/app/security/origin.py` | `enforce_same_origin` + `require_json_content_type` for unsafe methods |
| `apps/api/app/schemas/errors.py` | `{code, message}` error envelope convention |
| `apps/api/pyproject.toml` | `[tool.pytest.ini_options] testpaths = ["tests"]`; ruff line-length 100 |
| `apps/web/package.json` | `test` = `vitest run`; `typecheck` = `tsc --noEmit`; deps: react 18.3.1 only |
| `apps/web/vite.config.js` | **`test.environment = 'node'`** — no jsdom, no DOM globals today |
| `apps/web/src/api/client.ts` | `requestJson`, `ApiError`, `NetworkError`, same-origin credentials |
| `apps/web/src/repositories/stateSyncCoordinator.ts` | 409 → `frozen = true` halts all snapshot syncing |
| `apps/web/src/context/LifeDataContext.jsx` | single state tree; no `updateTransaction`/`deleteTransaction` |
| `apps/web/src/components/MoneyWidget.jsx:30` | `const budget = 300;` — hardcoded |
| `apps/web/src/lib/activity.js` | `CAP = 5000` FIFO; `pruneOlderThan` — legacy, untouched per D3 |
| `apps/web/src/app/routes.js` | `LIFE_ROUTES` set — analytics route added here |

---

## 4. Owner decisions D1–D5 (resolved — not reopened)

| ID | Decision | Binding consequence for this plan |
| --- | --- | --- |
| **D1** | **A** — hard deletion wins over frozen Review values | Review context must support **selective, transactional redaction** of source-derived values while user-authored text survives; erased evidence renders «источник удалён». Physical shape chosen in §12 → **normalized rows (R2)** |
| **D2** | **C** — AA retention is its own setting, default unlimited | Legacy «очистить историю старше» keeps referring to `activityLog` only. Schema and delete semantics must make a future AA retention policy possible (Slice 8); no AA retention is implemented early. Any age-based loss must be explicit and disclosed by the data-quality layer |
| **D3** | **A** — `activityLog` is **not** imported into semantic history | No conversion of `activityLog` into Measurement/Expectation/Forecast/Baseline/Review evidence/provenance. The legacy timeline keeps using it. AA history begins honestly at AA rollout |
| **D4** | **A** — add `ABANDONED` to Experiment lifecycle | Lifecycle = `DRAFT · RUNNING · COMPLETED_AWAITING_REVIEW · REVIEWED · ABANDONED`, orthogonal to outcome. Minimal UX delta specified in Slice 6 §22.9. System Review must not treat abandoned experiments as pending |
| **D5** | **A** — user-entered AA facts survive offline | Durable IndexedDB write queue, idempotency-keyed, replay-safe, never riding the snapshot CAS coordinator. Not required for Slice 0; **mandatory before Slice 2** accepts user-entered facts |

**Owner sequencing decision (§6 of the brief):** G · Project is **not** replaced by Habits. A minimal Project domain lands as **Slice P**, strictly scoped to what the frozen G surface needs, before Slice 5 · Project Analytics.

---

## 5. Architecture corrections accepted after Discovery

Four post-Discovery corrections are binding and are reflected throughout:

| # | Discovery said | Corrected direction | Where applied |
| --- | --- | --- | --- |
| **C1** | legacy imports may use `recorded_at = NULL` | `recorded_at` is **NOT NULL** and means *when AA ingested the fact*. Historical uncertainty is expressed by `original_recorded_at_known = false` + `method = 'LEGACY_IMPORT'` | §11, §16, Slice 2 |
| **C2** | one global `hash(subject, rule, version, all input IDs)` as signal identity | **Two identities**: rule-defined `episode_key` (user-facing occurrence) + `input_fingerprint` (audit/reproduction) | §13, Slice 3 |
| **C3** | `GET /api/v1/aa/export` | Export and account deletion are **account-level**, not AA-owned: `GET /api/v1/export`, `DELETE /api/v1/account`. AA owns only per-fact deletion | §14, Slice 0b |
| **C4** | `frozen_context jsonb` for reviews | **Normalized `aa_review_context_items`** + a values-free render manifest | §12, Slice 4 |

**Unchanged from Discovery (do not reopen):** Option D hybrid; `user_snapshots` untouched; `revision` stays snapshot concurrency only; `stateSyncCoordinator` never becomes the AA fact queue; separate semantic tables rather than one generic event table; no event sourcing, CQRS, time-series DB, partitioning, or materialised read models.

---

## 6. Final target architecture

```
┌──────────────────────────────┐        ┌─────────────────────────────────────────┐
│ CURRENT STATE (unchanged)    │        │ SEMANTIC HISTORY (new)                  │
│ user_snapshots · JSONB       │        │ aa_* relational tables                  │
│ CAS on `revision`            │        │ bitemporal · provenance · supersession  │
│ PUT /api/v1/state            │        │ idempotency-keyed appends               │
│ 5 MiB cap                    │        │ POST /api/v1/aa/…                       │
│ StateSyncCoordinator (memory)│        │ AnalyticsWriteQueue (IndexedDB, durable)│
└───────────────┬──────────────┘        └────────────────────┬────────────────────┘
                │ "what is true now"                          │ "how we got here"
                └───────────────────┬─────────────────────────┘
                                    ▼
                    ┌───────────────────────────────────────┐
                    │ DERIVED ANALYTICS (never stored as    │
                    │ fact): Delta · coverage · desirability │
                    │ signal content · materiality · stale/  │
                    │ partial · adherence classification ·   │
                    │ forecast counts · System Review groups │
                    └───────────────────────────────────────┘
```

**Two owners, one rule:** the snapshot owns current state; AA owns facts. Neither writes the other's data. A domain action (e.g. adding a transaction) writes the snapshot through the existing path **and** enqueues an AA fact through the new path; the two are independent and neither blocks the other.

---

## 7. Data model / concept map

Twelve fact-bearing tables plus two support tables. All carry the shared column template (§7.1).

| Table | Slice | Migration | Purpose |
| --- | --- | --- | --- |
| `aa_metric_definitions` | 0 | M1 | identity of what is measured; unit/value type; coverage model |
| `aa_measurements` | 0 | M1 | timestamped objective observations (Actual) |
| `aa_source_coverage` | 0 | M1 | **C6** — what a source declares it covered, per local window; the only basis for «observed» |
| `aa_deletion_receipts` | 0b | M2 | audit of hard deletions; holds **no** deleted content |
| `aa_expectation_versions` | 1 | M3 | predictive; versioned, never overwritten |
| `aa_forecast_versions` | 1 | M3 | estimate; versioned; **never contains an Actual** |
| `aa_baselines` | 1 | M3 | reference level captured before an intervention |
| `aa_targets` | 1 | M3 | **normative**; `is_explicitly_absent` ≠ zero |
| `aa_preferences` | 1 | M3 | user ориентир naming a desired direction |
| `aa_observations` | 1 | M3 | user-reported / subjective evidence (H) |
| `aa_metric_policy_versions` | 1 | M3 | **C7** — versioned category-level inclusion policy per metric |
| `aa_metric_membership_overrides` | 1 | M3 | **C7** — sparse, versioned per-fact inclusion overrides |
| `aa_signal_episodes` | 3 | M4 | episode identity + acknowledgement + fingerprint |
| `aa_reviews` | 4 | M5 | review header, window, user text, render manifest |
| `aa_review_context_items` | 4 | M5 | one frozen, individually redactable evidence item |
| `aa_review_factors` | 4 | M5 | factor text + epistemic kind |
| `aa_decisions` | 4 | M5 | nullable choice; review **or** experiment scoped |
| `aa_experiments` | 6 | M6 | lifecycle ⊥ outcome; hypothesis; window |
| `aa_experiment_adherence` | 6 | M6 | one row per elapsed day |
| `aa_experiment_observations` | 6 | M6 | period measurements with own provenance |
| `aa_importance_ratings` | 7 | M7 | user-owned importance (J) |
| `aa_cross_references` | 7 | M7 | **explicit** user-created relations only |
| `aa_retention_policies` | 8 | M8 | D2 future retention setting |

### 7.1 Shared column template

Applied to every fact table (`aa_measurements`, `aa_expectation_versions`, `aa_forecast_versions`, `aa_baselines`, `aa_targets`, `aa_preferences`, `aa_observations`, `aa_experiment_observations`):

```
id                          uuid       PK, default uuid4
user_id                     uuid       NOT NULL, FK users(id) ON DELETE CASCADE
metric_key                  text       NULL, FK aa_metric_definitions(metric_key) where applicable

-- subject reference (§8)
subject_domain              text       NOT NULL
subject_type                text       NOT NULL
subject_id                  text       NOT NULL DEFAULT ''        -- '' = account/domain-scoped
subject_key                 text       GENERATED ALWAYS AS
                                       (subject_domain||':'||subject_type||':'||subject_id) STORED

-- value (§9)
value_type                  text       NOT NULL  CHECK IN (money,date,duration,count,scale,categorical)
                                       -- NO 'unknown': a stored fact always has a real value (§9)
unit_code                   text       NULL
value_num                   numeric(20,6) NULL
value_date                  date       NULL
value_text                  text       NULL
scale_min, scale_max        numeric    NULL
value_availability          text       NOT NULL DEFAULT 'present'   -- aa_observations only; CHECK IN (present, explicitly_unknown)
dimensions                  jsonb      NULL       -- IMMUTABLE at record time (C7): e.g. {category_id, included_by_default}

-- bitemporal (§10)
occurred_at                 timestamptz NULL
occurred_tz                 text        NULL       -- IANA name
recorded_at                 timestamptz NOT NULL DEFAULT now()

-- provenance (§11)
source_kind                 text       NOT NULL  CHECK IN (OBSERVED,USER_REPORTED,IMPORTED,DERIVED,ESTIMATED,FORECAST,UNKNOWN)
basis                       text       NULL
method                      text       NULL
source_ref                  jsonb      NULL       -- machine-readable originating record ids
original_recorded_at_known  boolean    NOT NULL DEFAULT true

-- correction / supersession / delete (§11 lifecycle)
supersedes_id               uuid       NULL  FK <same table>(id)
superseded_by_id            uuid       NULL  FK <same table>(id)
superseded_at               timestamptz NULL
supersede_kind              text       NULL  CHECK IN (CORRECTION, REVISION)
supersede_reason            text       NULL
status                      text       NOT NULL DEFAULT 'active'  CHECK IN (active,superseded,tombstoned)
tombstoned_at               timestamptz NULL

-- idempotency (§15)
idempotency_key             text       NOT NULL
created_at                  timestamptz NOT NULL DEFAULT now()

UNIQUE (user_id, idempotency_key)
CHECK  (status <> 'superseded' OR superseded_by_id IS NOT NULL)
CHECK  (original_recorded_at_known OR source_kind = 'IMPORTED')
```

**One concept per table, deliberately.** The Discovery documented the collapse hazard visible inside the accepted package itself — «версий прогноза» had to be computed as `forecasts.filter(f => !f.actual)` because an Actual was stored inside the forecast array. Separate tables make that filter unnecessary and therefore unforgettable.

---

## 8. Subject reference contract

**Recommendation: Option A — generic typed triple**, `(subject_domain, subject_type, subject_id)`, always scoped by `user_id`.

**Why not B (domain FKs):** the two subjects AA must address first cannot be FK targets.
- **Finance monthly spend** is scoped to an *account + period* (`finance:period:2026-08`). There is no row anywhere to point at.
- **Project** will live in the snapshot's `projects[]` JSONB array (Slice P). A foreign key into a JSONB array element is not enforceable, and the brief explicitly forbids building fake FKs to snapshot internals.

**Why not C (hybrid):** a mixed strategy doubles every read path (FK join *or* triple match) for no correctness gain at this scale, and would need re-work the moment Project moves between storage models.

**Contract:**

| Rule | Rationale |
| --- | --- |
| `subject_id TEXT NOT NULL DEFAULT ''` | snapshot IDs are heterogeneous (`'t01'`, `1`, `'g1757…'`); `''` marks account/domain-scoped subjects and avoids NULL-in-index semantics |
| every index and every query leads with `user_id` | **cross-account resolution is impossible**: two accounts may both hold `finance:period:2026-08` and never see each other's rows |
| `subject_key` generated column | compact grouping/index target; never parsed to recover parts |
| history outlives the current object | no FK, so deleting a snapshot object cannot cascade-delete history. If the object is gone, the UI renders «источник удалён» via the same D1 path |
| a registry of valid `(domain, type)` pairs lives in `app/analytics/subjects.py` | validated at the service boundary, not by the DB, so adding Project in Slice P needs no migration |

Initial registry: `finance:transaction`, `finance:period`, `project:project` (Slice P), `experiment:experiment` (Slice 6), `system:window` (Slice 7).

---

## 9. Value / unit contract

A single unchecked `value_num + value_text + unit` triple would be the "anything field" the brief warns against. Instead, `value_type` is a discriminator with **per-type CHECK constraints**:

| `value_type` | Required | Forbidden | Notes |
| --- | --- | --- | --- |
| `money` | `value_num`, `unit_code` (ISO-4217, e.g. `UAH`) | `value_date`, `value_text` | stored as major units, `numeric(20,6)` |
| `date` | `value_date` | `value_num`, `unit_code` | Project completion, forecast target dates |
| `duration` | `value_num`, `unit_code = 'minute'` | `value_date`, `value_text` | **canonical minutes**; formatting is presentational |
| `count` | `value_num` | `unit_code`, `value_date`, `value_text` | integral by convention, numeric by storage |
| `scale` | `value_num`, `scale_min`, `scale_max` | `value_date` | e.g. stress 7/10 |
| `categorical` | `value_text` | `value_num`, `value_date` | e.g. energy «низкая» |

There is **no `unknown` value type.** A stored fact always carries a real value of its declared shape. `value_type` describes the *domain shape of the value*, never whether an observation exists.

### 9.1 Missing · explicit unknown · derived unknown — three different things

| State | Representation | Never |
| --- | --- | --- |
| **Missing observation** — no observation exists | **no row.** Absence is absence | never a synthesized row; never zero |
| **Explicit unknown** — an intentionally recorded epistemic state | a concept-specific column, only where the state is meaningful (§9.2) | never a `value_type`; never a Measurement with empty values |
| **Derived unknown / no-data** — a comparison whose inputs are absent or explicitly unknown | a **response/presentation** state (`delta: unknown`, `availability: no_data`) computed at read time | never persisted as a fact |

The accepted C gallery's «нет данных» specimen and «рано судить» delta are **derived** states. Rendering them must never cause a row to be written.

### 9.2 Where explicit unknown is legitimately stored

Only where the accepted design gives the state meaning — and always as a concept-specific column, never as a value shape:

| Concept | Column | Meaning |
| --- | --- | --- |
| `aa_targets` | `is_explicitly_absent` | «цель на месяц не задавалась» — deliberately not set, distinct from `0` and from "no target row yet" |
| `aa_experiment_adherence` | `state = 'unknown'` | the day elapsed but adherence was not established (distinct from `missed` and from `future`) |
| `aa_review_factors`, `aa_observations` | `epistemic_kind = 'unknown'` | «неизвестно» — a first-class factor/interpretation state |
| `aa_observations` | `value_availability = 'explicitly_unknown'` | the user deliberately recorded «не знаю» rather than not recording — permitted **only** here, because subjective self-report is the one place the accepted design treats a stated non-answer as evidence |

`aa_measurements` has **no** availability column: an objective observation either happened or did not. `value_availability` defaults to `present`, and a CHECK enforces that `explicitly_unknown` implies every value column is NULL while `present` implies the value columns required by `value_type` are populated.

### 9.3 Arithmetic and comparison legality

A `Delta` is computable **only** when both operands satisfy a compatibility rule:

| Operands | Result | Legal? |
| --- | --- | --- |
| money(UAH) − money(UAH) | money(UAH) | ✔ |
| money(UAH) − money(USD) | — | ✘ rejected — no implicit conversion |
| date − date | duration(minute), rendered in days | ✔ |
| duration − duration | duration(minute) | ✔ |
| count − count | count | ✔ |
| scale − scale, identical bounds | scale delta | ✔ |
| scale − scale, differing bounds | — | ✘ |
| categorical vs categorical | **no delta** — juxtaposition only (`AAFacts`, not `AADelta`) | ✘ by design |
| an operand is absent, or explicitly unknown | delta = **derived** `unknown`, rendered «рано судить» / «нет данных» — nothing is written | ✔ (as a derived state) |
| any cross-`value_type` pair | — | ✘ |

`compute_delta()` returns a **derived** `DeltaUnknown` when an operand is absent or explicitly unknown — it never fabricates an operand — and raises `IncompatibleUnitsError` for illegal pairs. **There is no numeric type in the schema that spans units**, so a global score has nowhere to live — the J banner «Общего балла нет и не будет» is enforced by the data model.

Implementation home: `apps/api/app/analytics/values.py` (validation, construction) and `apps/api/app/analytics/delta.py` (legality + computation). Mirrored for rendering in `apps/web/src/analytics/values.ts`.

---

## 10. Bitemporal contract

Not one timestamp generalized across concepts — **exact semantics per concept**:

| Concept | Temporal fields | Meaning |
| --- | --- | --- |
| **Measurement** | `occurred_at` + `occurred_tz`, `recorded_at` | happened at / AA learned at |
| **ExpectationVersion** | `recorded_at`, `effective_from`, `window_start`, `window_end` | recorded at / in force from / the period it is an expectation *for* |
| **ForecastVersion** | `recorded_at`, `horizon_at` | recorded at / the time the prediction resolves. For a date-valued forecast the *value* is the predicted date and `horizon_at` is when it can be checked |
| **Baseline** | `recorded_at`, `window_start`, `window_end` | captured at / measured over |
| **Target** | `recorded_at`, `window_start`, `window_end`, `is_explicitly_absent` | set at / applies to |
| **Preference** | `recorded_at`, `effective_from` | standing ориентир |
| **Observation** | `occurred_at` + `occurred_tz`, `recorded_at` | observed at / recorded at |
| **Review** | `window_start`, `window_end` (dates), `created_at`, `revised_at` | covers / authored / last revised |
| **Experiment** | `window_start`, `window_end` (dates), `created_at`, `hypothesis_recorded_at` | run window / created / hypothesis stated |
| **Adherence day** | `day` (date) | the local calendar day |

### 10.1 The as-of query

The single most important read. *"What was the expectation in force on 15 August?"*

```sql
SELECT * FROM aa_expectation_versions
WHERE user_id = :u AND subject_key = :s
  AND recorded_at <= :as_of
  AND (superseded_at IS NULL OR superseded_at > :as_of)
  AND status <> 'tombstoned'
ORDER BY recorded_at DESC, id DESC
LIMIT 1;
```

Implemented once in `apps/api/app/analytics/asof.py` and reused by every concept. `ORDER BY … , id DESC` makes ties deterministic.

### 10.2 Timezone

`occurred_tz` stores an IANA name alongside `occurred_at`. Coverage is counted in **local days** («28 из 31 дня», «9 из 14 дней»), so day boundaries must follow the user's zone — and the accepted Experiment surface has a travel confounder («Две поездки в середине периода») that would otherwise silently corrupt adherence counting. Windows are stored as local dates plus the zone in force.

---

## 11. Provenance contract

Preserves the accepted 4-row `AAProvenance` grammar exactly:

| Column | UI row | Example (accepted seed) |
| --- | --- | --- |
| `source_kind` | источник | «Из моих записей + импорт» |
| `basis` | основание | «184 операции · monobank» |
| `recorded_at` | когда | «28 авг, 08:40» |
| `method` | как | «Сумма расходов за период минус корректировки» |
| `source_ref` (jsonb) | *not rendered* | originating record ids for audit |

**Inline columns, not a join table** — provenance is rendered on nearly every analytical row, is never queried independently, and is never shared between facts.

### 11.1 Fact provenance vs interpretation kind — two separate vocabularies

**`source_kind`** (value provenance): `OBSERVED · USER_REPORTED · IMPORTED · DERIVED · ESTIMATED · FORECAST · UNKNOWN`.

`HYPOTHESIS` is **excluded**: a hypothesis is not the source of a value. It renders in a dashed claim block «предположение, не факт» and is a column on `aa_experiments`. `INFERRED` is excluded as having no rendering distinct from `DERIVED` — no enum values are added for symmetry.

**`epistemic_kind`** (interpretation, on `aa_review_factors` / `aa_observations`): `observed · mine · maybe · unknown`, fixed exactly by `AA_KINDS` in `primitives.jsx`. **Default is `unknown`, not NULL.**

### 11.2 Legacy import provenance (correction C1)

For records ingested from existing snapshot data:

```
source_kind                = 'IMPORTED'
method                     = 'LEGACY_IMPORT'
recorded_at                = <ingestion time>          -- NOT NULL, honest: when AA learned it
original_recorded_at_known = false
occurred_at                = <genuine historical date, if truly known>
basis                      = 'Импортировано из состояния Life OS'
```

Enforced by `CHECK (original_recorded_at_known OR source_kind = 'IMPORTED')`.

**Binding rules:** never fabricate a historical `recorded_at`; never pretend AA knew a legacy fact before migration; **never backfill Expectation, Forecast, Target or Baseline**; never fabricate coverage or provenance that was not captured. Semantic-history auditability begins when AA records or ingests the fact — a legacy fact may still truthfully carry its historical `occurred_at`.

Any coverage report whose window contains legacy-imported facts must set `has_legacy_imports = true`, and the quality strip must disclose «часть данных импортирована · момент записи неизвестен».

### 11.3 Correction vs supersession — kept separate

| | CORRECTION | REVISION (supersession) |
| --- | --- | --- |
| Meaning | the earlier record was **wrong** | the earlier record was **valid when made**, and a newer belief replaced it |
| Example | ₴12,000 → ₴1,200 | forecast 20 Aug → 24 Aug → 26 Aug |
| Counted in aggregates | corrected row **once**; original excluded | each version valid for its own interval |
| Renders as | `original → corrected` | a version sequence |
| Column | `supersede_kind = 'CORRECTION'` | `supersede_kind = 'REVISION'` |

**Transaction boundary and double-correction guard** — one statement, one transaction:

```sql
-- 1. claim the target; 0 rows ⇒ already corrected, return 409 correction_conflict
UPDATE aa_measurements
   SET superseded_at = now(), status = 'superseded', supersede_kind = 'CORRECTION',
       supersede_reason = :reason, superseded_by_id = :new_id
 WHERE id = :target AND user_id = :u AND superseded_at IS NULL;
-- 2. insert the replacement with supersedes_id = :target
```

Chain integrity: `CHECK (status <> 'superseded' OR superseded_by_id IS NOT NULL)` plus a test asserting no cycles and no row with two successors (`UNIQUE (supersedes_id) WHERE supersedes_id IS NOT NULL`).

**Active-row predicate**, used by every aggregate: `status = 'active'`. A partial index supports it.

### 11.4 Delete semantics

| Operation | Retains | Removes | API |
| --- | --- | --- | --- |
| CORRECT | both versions | nothing | `POST /aa/facts/{id}/correct` |
| TOMBSTONE | existence, timestamps, provenance kind | value columns nulled | `DELETE /aa/facts/{id}?mode=tombstone` |
| HARD DELETE | a receipt row with no content | the row + dependent context items redacted | `DELETE /aa/facts/{id}?mode=hard` |

Hard delete of a fact (single transaction): redact every `aa_review_context_items` row referencing it (§12), delete dependent `aa_signal_episodes` acknowledgements whose fingerprint contains it, delete the row, insert an `aa_deletion_receipts` row `(user_id, table_name, fact_id, deleted_at)` — **content never copied into the receipt**.

---

## 12. Review storage — D1 resolved physically

### 12.1 The two candidates

**R1 — `frozen_context jsonb` + input-version references + selective transactional redaction.**
**R2 — normalized `aa_review_context_items`**, one row per rendered semantic evidence item, each independently linked and redactable.

### 12.2 Assessment

| Criterion | R1 (JSONB blob) | R2 (normalized rows) |
| --- | --- | --- |
| **Selective hard delete** | read blob → parse → locate every occurrence → rewrite → write back. Correctness depends on understanding **every JSON shape ever written**, for the life of the product | one indexed statement: `UPDATE aa_review_context_items SET redacted_at = now(), value_* = NULL WHERE user_id=:u AND source_fact_id=:id`. **R2 wins decisively** |
| **Correction indication** | must diff blob values against current facts; the blob may not even record which field came from which fact | `JOIN` on `source_fact_id` → read `status`; superseded ⇒ show «данные позже исправлены». **R2 wins** |
| **Historical stability** | values frozen in the blob | values frozen in the row | tie |
| **Query complexity** | JSONB path queries for anything analytical | ordinary SQL | **R2** |
| **JSON schema versioning** | mandatory, forever — every version needs a redaction walker | **eliminated for values** | **R2** |
| **Implementation complexity** | one column | one table (~10 columns) + FK | R1 marginally simpler up front, far more complex at the redaction path |
| **Migration complexity** | shape changes are code-only but need back-compat readers | ordinary additive migrations | **R2** |
| **Export** | opaque blob dumped as-is | relational rows, readable and diffable | **R2** |
| **Testability** | must construct blobs per schema version; redaction assertions are string-searching | assert on rows; a single test proves erasure | **R2 wins decisively** |
| **Future UX changes** | new rendering ⇒ new blob shape ⇒ new walker | new rendering ⇒ new item `role`, old rows still valid | **R2** |

### 12.3 Recommendation — **R2, normalized**, with a values-free render manifest

```
aa_review_context_items
  id, user_id, review_id            FK aa_reviews ON DELETE CASCADE
  ordinal            int            -- display order within the review
  role               text           -- 'expected' | 'actual' | 'delta' | 'baseline' | 'forecast'
                                    -- | 'coverage' | 'tradeoff' | 'observation'
  label              text           -- «последний прогноз» — frozen label as displayed
  value_type, unit_code, value_num, value_date, value_text, scale_min, scale_max
  sub_line           text           -- «записан 20 авг»
  -- frozen provenance as displayed
  source_kind, basis, method, provenance_recorded_at
  -- link back to the originating fact
  source_table       text NULL
  source_fact_id     uuid NULL
  -- D1 redaction
  redacted_at        timestamptz NULL
  redaction_reason   text NULL      -- 'source_hard_deleted'
  CHECK (redacted_at IS NULL OR (value_num IS NULL AND value_date IS NULL AND value_text IS NULL))
INDEX (user_id, source_fact_id)     -- the redaction lookup
INDEX (review_id, ordinal)
```

`aa_reviews.render_manifest jsonb` holds **only** layout metadata — item ordering, grouping, section titles, `manifest_version`. It contains **no source-derived values**, so it never needs redacting. The CHECK constraint makes "redacted but value still present" unrepresentable.

### 12.4 Required behaviours, satisfied

| Requirement | Mechanism |
| --- | --- |
| reopens as the user saw it | frozen values live on the item rows |
| corrections visible **beside**, not substituted | join `source_fact_id` → `status = 'superseded'` ⇒ render «данные позже исправлены» with the current value alongside |
| hard delete removes source-derived values | one indexed `UPDATE`; the CHECK guarantees no residue; render «источник удалён» |
| user text survives | `aa_reviews.free_text` and `aa_review_factors` have **no** `source_fact_id` and are never redacted |
| revisable later | factors and text are appendable; `revised_at` tracks it |
| interpretation never silently rewritten | factor rows are versioned by append; nothing overwrites in place |

---

## 13. Signal episode identity contract (correction C2)

### 13.1 Two identities, different jobs

| | `episode_key` | `input_fingerprint` |
| --- | --- | --- |
| Purpose | stable **user-facing occurrence** | exact facts used for the current derivation |
| Defined by | the **rule**, per its own semantics | the evaluator: `sha256(sorted(input_version_ids))` |
| Drives | acknowledgement, dedup, reappearance | audit, provenance, correction re-evaluation, reproducibility |
| Changes when | the rule says a new episode began | any input version changes |

The Discovery's single global hash conflated these. Under it, a budget signal dismissed at 90 % would respawn at 91 %, 92 %, 93 % — every ordinary transaction changing the input set. Splitting them fixes that while keeping full auditability.

### 13.2 Rule contract

Every rule module implements:

```
rule_id, rule_version
inputs(user, subject, window)        -> list of fact rows
evaluate(inputs)                     -> {materiality, state, rendered_values, input_version_ids}
episode_key(subject, evaluation)     -> str        # rule-defined episode discriminator
reopen_on(ack, new_evaluation)       -> bool       # does a correction invalidate the ack?
```

`aa_signal_episodes` persists: `user_id, episode_key, rule_id, rule_version, subject_key, first_seen_at, acknowledged_at, acknowledged_fingerprint, resolution ('acknowledged'|'withdrawn'), last_fingerprint, last_evaluated_at`, `UNIQUE (user_id, episode_key)`.

**Acknowledgement holds** while the episode key is unchanged, even as inputs churn. **A new episode key means a new card** — unacknowledged by construction.

### 13.3 Worked examples (all four required)

**(a) Finance budget threshold** — `finance.monthly_spend.threshold` v1
`episode_key = "finance.monthly_spend.threshold:1:finance:period:2026-08:band=80"`
The discriminator is the **crossed threshold band** (`80 · 100 · 120`), not the value.

| Event | Band | Episode | Behaviour |
| --- | --- | --- | --- |
| spend hits 90 % | 80 | `…band=80` | signal appears |
| user dismisses | 80 | same | acknowledged |
| ordinary transactions → 91 %, 92 %, 93 % | 80 | **same key** | **stays dismissed — no spam.** `input_fingerprint` updates for audit |
| spend crosses 100 % | 100 | `…band=100` | **new episode** → appears |
| a correction drops spend to 74 % | — | band-80 episode | `reopen_on` ⇒ `withdrawn`; the card disappears because the condition no longer holds |
| after correction, spend back to 85 % | 80 | `…band=80` | rule declares reopen: the acknowledged fingerprint is stale **and** the acknowledged band was re-entered from below ⇒ new occurrence |

Materiality only. This rule sets `stakes`, **never** `desire` — being at 80 % of an expectation says «look at this», not «this is bad».

**(b) Project forecast revision** — `project.forecast.revision` v1
`episode_key = "project.forecast.revision:1:project:project:<id>:fv=<newest_forecast_version_id>"`
Every genuine new `ForecastVersion` is a **new episode** — matching the accepted seed's «Это третье изменение за месяц». Ordinary task edits that do not produce a new forecast version change nothing.

**(c) Stale data** — `data.source.stale` v1
`episode_key = "data.source.stale:1:<subject>:<source>:since=<YYYY-MM-DD>"` where the date is the day the source first crossed the staleness threshold. One episode per staleness period: it does not re-fire daily while stale. A fresh import ends the episode (`withdrawn`); a later staleness period opens a new one.

**(d) Partial coverage** — `coverage.window.partial` v1
`episode_key = "coverage.window.partial:1:<subject>:window=2026-08"` — **one episode per window**. It does not respawn as each uncovered day passes. Crossing into a worse coverage tier (`<50 %`) appends a tier to the key and opens a new episode.

### 13.4 Correction re-evaluation

On any fact correction, the affected subjects' rules re-run. For each episode where `acknowledged_fingerprint <> last_fingerprint`, `reopen_on()` decides:
- condition no longer holds → `resolution = 'withdrawn'`, card disappears;
- condition holds and the rule considers it the same occurrence → acknowledgement stands;
- the rule considers it a new occurrence → a new `episode_key` is emitted, so a fresh card appears while the record of the earlier dismissal is retained.

---

## 14. Account export / delete architecture (correction C3)

**Export and account deletion are account-level responsibilities, not AA's.**

| Endpoint | Owner module | Scope |
| --- | --- | --- |
| `GET /api/v1/export` | `app/routes/export.py`, `app/services/export.py` | snapshot + **all** `aa_*` + schema metadata, streamed NDJSON-in-ZIP |
| `DELETE /api/v1/account` | `app/routes/account.py`, `app/services/account.py` | full erasure, cascades `users → sessions, user_snapshots, all aa_*` |
| `DELETE /api/v1/aa/facts/{id}` | `app/routes/aa_facts.py` | per-fact tombstone/hard delete only |

The export service holds a **registry** of exportable tables so that every new `aa_*` table is added in the same slice that creates it. A test asserts the registry covers every table whose name starts with `aa_` (introspecting `Base.metadata`) — so a future table cannot silently fall out of export.

Export contents: current snapshot (payload + revision + schema_version), every AA fact **including superseded and tombstoned rows**, correction chains, provenance, deletion receipts, and a `manifest.json` naming schema versions needed to interpret it.

Account deletion relies on the existing `ON DELETE CASCADE` from `users`, which every `aa_*` table inherits by using the same FK pattern. A test asserts zero residual rows across all `aa_*` tables after account deletion.

---

## 15. Offline write queue architecture (D5)

**Not implemented here — contract only.** Required from Slice 2.

### 15.1 Queue record shape (IndexedDB store `aa_outbound`)

```ts
{
  queue_id:              number;   // autoIncrement — replay order
  idempotency_key:       string;   // uuid v4, generated AT ENQUEUE, persisted
  user_id:               string;   // account scoping
  op_type:               string;   // 'measurement.append' | 'measurement.correct' | …
  payload_schema_version:number;
  payload:               unknown;
  client_created_at:     string;   // ISO, client clock
  attempts:              number;
  next_attempt_at:       number;   // epoch ms
  status:  'pending' | 'inflight' | 'failed_permanent';
  last_error:            string | null;
}
```

**The idempotency key is generated at enqueue, not at send.** That single decision is what makes "no duplicate semantic facts after replay" structurally true: a browser restart mid-flight replays the *same* key, and the server's `UNIQUE (user_id, idempotency_key)` returns the existing row.

### 15.2 Contracts

| Concern | Contract |
| --- | --- |
| **Replay order** | strict ascending `queue_id`, **single-flight**. Corrections must never overtake the fact they correct |
| **Retry policy** | exponential backoff (1s → 2s → 4s … cap 5 min), unlimited attempts for transient errors |
| **Permanent errors** | 400/422 → `failed_permanent` (dead letter). **Never silently dropped** — surfaced in the sync UI with an inspect/discard/export action |
| **Auth expiry** | 401 → pause queue, retain everything, resume after re-auth. Never discard |
| **Business conflict** | 409 (e.g. already corrected) → terminal; recorded with the server's reason and surfaced |
| **Account switch / logout** | records carry `user_id`; the queue never replays under a different session. On logout, pending records are **retained**, not dropped (dropping is silent history loss) |
| **Browser restart** | IndexedDB persists; flush resumes on next load |
| **Multi-tab** | leader election via `navigator.locks.request('aa-write-queue')`; all tabs enqueue, one flushes. If Web Locks is unavailable, multiple flushers are still **safe** because idempotency keys dedupe server-side |
| **UI state** | `idle · syncing · offline · retrying · blocked_auth · failed` — a dedicated indicator, distinct from the snapshot's `SyncStatus` |

### 15.3 Coexistence with `StateSyncCoordinator`

| | `StateSyncCoordinator` (existing) | `AnalyticsSyncCoordinator` (new) |
| --- | --- | --- |
| Data | whole current-state snapshot | individual semantic facts |
| Storage | in-memory pending payload | IndexedDB durable queue |
| Endpoint | `PUT /api/v1/state` | `POST /api/v1/aa/*` |
| Concurrency | CAS on `revision`; 409 ⇒ `frozen = true` halts syncing | append + idempotency key; no CAS |
| Failure coupling | **none** | **none** |

**Binding rule:** a snapshot 409 must not pause, freeze, or drain the AA queue, and an AA failure must not freeze the snapshot. Neither owns the other's data. This is permanent regression test **T-12**.

Three new modules, no modification to the existing coordinator:
`apps/web/src/repositories/analyticsRepository.ts` (HTTP boundary) ·
`apps/web/src/repositories/analyticsWriteQueue.ts` (IndexedDB durability) ·
`apps/web/src/repositories/analyticsSyncCoordinator.ts` (flush, backoff, leader election, status).

### 15.4 Test strategy note

`apps/web/vite.config.js` sets `test.environment = 'node'` — there is **no IndexedDB and no DOM** in the current test environment. Slice 2 must add `fake-indexeddb` as a devDependency and either switch the queue tests to a `jsdom`/`happy-dom` environment or inject an IDB factory. **This is the plan's only new frontend dependency**, and it is dev-only. The queue must therefore take its `IDBFactory` by injection rather than reading `globalThis.indexedDB` directly.

---

## 16. Minimal Project domain prerequisite (Slice P)

**Purpose:** give the frozen G surface a truthful domain to analyse. Nothing more.

### 16.1 Storage split

| Lives in | What |
| --- | --- |
| **Snapshot** (`payload.projects[]`) | current configuration and status — the operational current state |
| **AA history** | first estimate + forecast revisions (`aa_forecast_versions`), completion (`aa_measurements`) |

```js
// payload.projects[] — current state only
{ id, title, created_at, started_at, status, current_forecast_date, completed_at }
// status ∈ 'active' | 'completed' | 'archived'
```

`migrateStateCopy` seeds `projects: []` when absent — additive, matching the existing `goals`/`habits` precedent, and requires **no `schema_version` bump**.

### 16.2 Domain actions → AA facts

| Action | Snapshot effect | AA fact emitted |
| --- | --- | --- |
| create project | append to `projects[]` | none |
| record first estimate | set `current_forecast_date` | `aa_forecast_versions` (`recorded_at` = now, value = the date, `source_kind = USER_REPORTED`) |
| revise forecast | update `current_forecast_date` | **new** `aa_forecast_versions` row (never an update) |
| complete project | `status='completed'`, `completed_at` | `aa_measurements` on `project.completion_date`, `source_kind = OBSERVED` |
| archive/cancel | `status='archived'` | none |

**The completion Actual is a Measurement, never a forecast version** — the accepted G surface prints «версий прогноза 3 · факт отдельно», and separate tables make that count correct without a filter.

### 16.3 Explicit boundary — NOT included

No tasks-in-projects, subtasks, dependencies, epics, sprints, milestones, assignees, resource planning, workflow states beyond the three above, Gantt/critical path, templates, or bulk operations. If a G-surface requirement seems to need any of these, it is out of scope and must be raised rather than built.

---

## 17. Enumeration strategy

**Recommendation: `TEXT` columns with `CHECK` constraints, backed by Python `StrEnum`.**

Rationale from this specific codebase:
- D4 already adds `ABANDONED` to a lifecycle after the schema is designed; more values will follow (`source_kind`, `decision.choice`, `role`).
- PostgreSQL `ALTER TYPE … ADD VALUE` cannot be freely combined with dependent DDL in one transactional migration, and values can never be removed or renamed safely.
- A `CHECK` constraint is dropped and recreated inside an ordinary transaction — an additive, reversible, single-migration operation.
- The application already validates at the Pydantic boundary, so the DB constraint is a backstop, not the primary guard.

Enums live in `apps/api/app/analytics/enums.py` as `StrEnum`; the CHECK constraint lists are generated from them so schema and code cannot drift. A test asserts every enum member is permitted by its table's CHECK constraint.

---

## 18. Metric catalogue v1

`aa_metric_definitions` is seeded by migration (data migration, additive) and extended per slice.

| Field | `finance.transaction_amount` | `finance.monthly_spend` | `project.completion_date` |
| --- | --- | --- | --- |
| **metric_key** | `finance.transaction_amount` | `finance.monthly_spend` | `project.completion_date` |
| **domain** | finance | finance | project |
| **subject_type** | `transaction` | `period` | `project` |
| **subject_id form** | transaction id | `YYYY-MM` | project id |
| **value_type** | money | money | date |
| **unit_code** | `UAH` | `UAH` | — |
| **aggregation** | none (atomic) | `sum` | none (atomic) |
| **actual_source** | `observed` | **`derived`** | `observed` |
| **derivation** | — | sum of active `finance.transaction_amount` in window whose **as-of-T inclusion** resolves to included (§19.3) — resolved from **versioned policy + per-fact overrides**, never from live snapshot state | — |
| **coverage model** | n/a | denominator = calendar days in month; **observed days come from `aa_source_coverage` claims (§20), never from transaction presence** | n/a |
| **comparison semantics** | money−money(UAH) | money−money(UAH) | date−date → duration(days) |
| **normative semantics** | none | **none intrinsically** — desirability only from `aa_targets`/`aa_preferences`/`aa_decisions` | none |
| **materiality owner** | — | finance domain (`finance.monthly_spend.threshold`) | project domain (`project.forecast.revision`) |
| **provenance requirement** | `USER_REPORTED` (manual) or `IMPORTED` (bank) | `DERIVED`, with `basis` naming the operation count | `OBSERVED` |
| **Slice** | 2 | 2 | P / 5 |

### 18.1 The `actual_source` distinction

This is the load-bearing design point of the catalogue. `finance.monthly_spend` is **derived**, not stored: its Actual is the sum of active transaction measurements over the window. Expectations, targets and forecasts attach to `finance.monthly_spend` at subject `finance:period:2026-08`.

This makes the accepted correction case correct by construction: correcting a transaction supersedes its measurement, the superseded row leaves the `status = 'active'` set, and the monthly sum counts the corrected value **once** — with no reconciliation step and no stored aggregate to invalidate.

**`desirability` is never attached to a MetricDefinition.** It belongs to Target / Preference / Decision, and there is no column for it here.

### 18.2 Inclusion semantics are versioned, not read from the snapshot (correction C7)

The snapshot's `included_in_totals` (per transaction) and `categoryOverrides` (per category) are **mutable current-state policy**. Deriving a historical month from them would mean that toggling a category off in December silently rewrites August's total — and every Review, signal and System Review item built on it. That violates the binding requirement that a derived analytical value be reproducible from immutable/versioned inputs as-of a timestamp.

**Binding rule: historical derived analytics must not depend on today's mutable snapshot policy.**

#### Options evaluated

**Option A — versioned per-fact membership.** Every inclusion change writes a membership version per transaction fact.
*Reproducible ✔. But a single category toggle affecting 200 transactions writes 200 rows, and the user's actual intent («я исключил всю категорию «здоровье»») is lost — reconstructing it later means inferring intent from a burst of rows.*

**Option B — versioned aggregation policy only.** The metric owns policy versions (`exclude categories [health]`) with `recorded_at` / `effective_from`.
*Compact and intent-preserving ✔. But a **per-transaction** override («эта одна операция не считается») is not expressible as a category rule, and the accepted Finance surface supports exactly that (`toggleTransactionInclusion` exists today).*

#### Recommendation — **hybrid**, and it is the only shape that covers both accepted controls

| Layer | Table | Grain | Why this layer |
| --- | --- | --- | --- |
| **Immutable dimension** | `aa_measurements.dimensions jsonb` | per fact, written once | the transaction's `category_id` and `included_by_default` **as at record time**, so policy can be evaluated later without reading the snapshot |
| **Policy versions** | `aa_metric_policy_versions` | per metric | category-level intent, compact, append-only, `recorded_at` + `effective_from` |
| **Per-fact overrides** | `aa_metric_membership_overrides` | per fact, **sparse** | only transactions the user explicitly overrode; append-only with supersession |

```
aa_metric_policy_versions
  id, user_id, metric_key
  policy jsonb            -- e.g. {"exclude_categories": ["health"], "default": "include"}
  effective_from timestamptz, recorded_at timestamptz
  + provenance, supersession, idempotency, status  (shared template)

aa_metric_membership_overrides
  id, user_id, metric_key
  source_table text, source_fact_id uuid       -- the measurement being overridden
  included boolean
  recorded_at timestamptz
  + provenance, supersession, idempotency, status
INDEX (user_id, metric_key, source_fact_id) WHERE status = 'active'
```

#### As-of evaluation

```
include(fact, T) =
    override_asof(fact, T)                       # per-fact wins if one exists at T
    ?? policy_asof(metric, T).evaluate(fact.dimensions)   # else category policy in force at T
    ?? fact.dimensions.included_by_default       # else the default captured at record time
```

`policy_asof` and `override_asof` use the standard as-of query of §10.1. The whole evaluation reads **only** AA tables and immutable per-fact dimensions — it never touches `payload.included_in_totals` or `payload.categoryOverrides`.

#### Requirements satisfied

| Requirement | How |
| --- | --- |
| per-transaction override | `aa_metric_membership_overrides` |
| category-level override | `aa_metric_policy_versions.policy` |
| monthly spend reproducible as-of T | both layers are versioned by `recorded_at`; dimensions are immutable |
| a later policy change never rewrites an old result | as-of resolution ignores versions recorded after T |
| correction ≠ inclusion change | different tables; `supersede_kind = 'CORRECTION'` on the measurement vs a new membership/policy version. Correcting ₴12,000→₴1,200 changes the **value**; excluding it changes **membership**. Both are visible, neither masquerades as the other |
| no fake backfill | see below |

#### Legacy honesty (with C1)

At Finance import, the *current* `categoryOverrides` and `included_in_totals` are captured as **policy version 1** and as overrides, with `recorded_at` = ingestion time, `method = 'LEGACY_IMPORT'`, `original_recorded_at_known = false`, and **`effective_from` = ingestion time — never backdated**. LifeOS did not know this policy earlier and must not claim it did.

Consequently, windows **earlier than the import** have no policy in force. Those windows resolve with `policy_known = false` in the `CoverageReport` (§20.3), and the data-quality strip discloses «правило учёта за этот период неизвестно». The alternative — retroactively applying today's policy — is exactly the silent rewrite C7 forbids.

#### Live snapshot toggles

The existing snapshot fields stay as the **current-state** UI control (the Finance list keeps working unchanged). Toggling one now writes the snapshot **and** appends the corresponding AA policy/override version. The snapshot is the control surface; the AA versions are the record.

---

## 19. Signal rule catalogue v1

Four rules — exactly those needed by the planned slices. The `trigger #7` in the accepted seed is **design/seed provenance, not a canonical identifier**; no historic eight-rule list exists in the repository, so this catalogue is new and canonical.

| | R1 `finance.monthly_spend.threshold` | R2 `project.forecast.revision` | R3 `data.source.stale` | R4 `coverage.window.partial` |
| --- | --- | --- | --- | --- |
| **version** | 1 | 1 | 1 | 1 |
| **domain owner** | finance | project | shared/data | shared/data |
| **inputs** | active expectation or target for the period + derived monthly spend | forecast versions for subject | `max(recorded_at)` per `source_kind`/subject | coverage report for window |
| **window** | calendar month | project lifetime | rolling | metric window |
| **materiality trigger** | spend ÷ reference ≥ 80 % ⇒ `stakes` | any new forecast version ⇒ `material` | > 7 days since newest ⇒ `info`, > 14 ⇒ `material` | coverage < 90 % ⇒ `info`, < 50 % ⇒ `material` |
| **episode key** | `…:band=<80\|100\|120>` | `…:fv=<newest_forecast_version_id>` | `…:<source>:since=<date>` | `…:window=<id>[:tier=<t>]` |
| **ack persistence** | per episode | per episode | per episode | per episode |
| **reappearance** | crossing into a higher band | any new forecast version | a new staleness period after a fresh import | crossing into a worse coverage tier |
| **stale/partial behaviour** | shown and tagged, never suppressed | n/a | this *is* the stale rule | this *is* the partial rule |
| **provenance shown** | «Из моих записей + импорт» · operation count · newest import time · «Сумма расходов за период минус корректировки» | «Выведено Life OS» · forecast version count · recording time · derivation | source name · newest record time | window · observed/denominator |
| **desirability** | **never set** — materiality only | **never set** | **never set** | **never set** |
| **Slice** | 3 | 3 | 3 | 3 |

Every rule sets `stakes`/`materiality` and **no rule may set `desire`.** Test T-06 asserts that no rule module references the desirability derivation at all.

Rule modules live in `apps/api/app/analytics/rules/` with a registry in `rules/__init__.py`.

---

## 20. Coverage / data-quality contract

Coverage is **never** "number of rows found", and — correction **C6** — it is **never inferred from the presence of facts**.

### 20.0 Why fact presence cannot establish coverage

`transaction presence ≠ source completeness`, in both directions:

- A day with **zero** transactions may be **completely observed** — the user genuinely spent nothing and the bank import covered that day.
- A day with **one** transaction may be **incompletely observed** — the import covered part of the day, or one account of several.

So «28 из 31 дня» cannot be derived by counting distinct days that contain a measurement. It must be backed by **explicit evidence about what the source covered**.

### 20.1 Coverage-evidence model — `aa_source_coverage`

A source declares, as an ordinary append-only fact with provenance and supersession, what it covered:

```
aa_source_coverage
  id, user_id                       FK users ON DELETE CASCADE
  source_id            text         -- 'monobank', 'manual', 'import:2026-08-28T08:40'
  source_kind          text         -- reuses the provenance enum (IMPORTED / USER_REPORTED / OBSERVED …)
  subject_domain, subject_type, subject_id, subject_key   -- scope (finance:period:2026-08, or domain-wide)
  metric_key           text NULL    -- optional narrower scope
  window_start_date    date         -- local dates; a single day has start = end
  window_end_date      date
  timezone             text         -- IANA, the zone the local dates are expressed in
  coverage_state       text         -- CHECK IN (complete, partial, none, unknown)
  completeness_known   boolean      -- false ⇒ the source cannot vouch for completeness
  observed_units       int NULL     -- for `partial`: how much was actually covered
  expected_units       int NULL
  -- provenance (§11), supersession (§11.3), idempotency (§15), status — same shared template
  recorded_at, source_kind, basis, method, source_ref, original_recorded_at_known
  supersedes_id, superseded_by_id, superseded_at, supersede_kind, status, idempotency_key
INDEX (user_id, subject_key, window_start_date, window_end_date) WHERE status = 'active'
```

Coverage claims are **facts like any other**: they carry provenance, they can be corrected or superseded, they are exported, and they are erased with the account. A re-import that covered more days supersedes the earlier, narrower claim rather than overwriting it.

### 20.2 Resolution rule

For each local day in the window, resolve the strongest **active** claim scoped to it:

| Evidence for the day | Classification |
| --- | --- |
| `coverage_state = complete`, `completeness_known = true` | **observed** |
| `coverage_state = partial` | **partial** |
| `coverage_state = none`, `completeness_known = true` | **missing** — the source affirms nothing happened |
| `coverage_state = unknown`, or `completeness_known = false`, or **no claim at all** | **unknown coverage** |
| day has not elapsed in `timezone` | **future** |

**A day is `observed` only when evidence supports the claim.** Absence of a claim is never promoted to "observed", and never to "missing" either — it is `unknown coverage`, which is the honest state.

**Manual-only data:** the system must **not** assert complete coverage without evidence. Manual entry may write a `complete` claim only for a period the user explicitly confirms (e.g. "я записал всё за август"); otherwise manual-only windows resolve to `unknown coverage` and the strip reads «полнота данных неизвестна» instead of a fraction.

### 20.3 `CoverageReport`

```python
CoverageReport:
    window_start, window_end          # local dates
    timezone                          # IANA
    denominator_basis: str            # 'calendar_days' | 'experiment_elapsed_days' | 'expected_observations'
    expected_denominator: int
    observed_count: int               # backed by coverage evidence
    partial_count: int
    missing_count: int                # evidence affirms no data
    unknown_coverage_count: int       # elapsed, but no evidence either way   <-- C6
    future_count: int                 # NOT YET ELAPSED — never a miss
    estimated_count: int
    corrected_count: int
    freshest_recorded_at: datetime | None
    has_legacy_imports: bool          # §11.2
    policy_known: bool                # §19.3 (C7) — was inclusion policy known for this window?
    reason: str | None                # 'не установлена'
```

**Invariant (asserted in code and tested):**
`observed + partial + missing + unknown_coverage + future == expected_denominator`

| Case | Values |
| --- | --- |
| Finance August (accepted F) | denominator 31; the monobank import's active claim covers 1–28 Aug `complete` ⇒ observed 28, partial 0, missing 0, unknown 0, **future 3** → «28 / 31» and «3 дня ещё не наступили — не считаем их нулями» |
| Finance August, manual-only, no claim | denominator 31, observed 0, unknown_coverage 28, future 3 → «полнота данных неизвестна · 28 дней без подтверждения источника» — **never «0 / 31»**, which would read as "spent nothing" |
| Experiment completed (accepted I) | basis `experiment_elapsed_days`, denominator **14** (elapsed), kept 9 → «9 из 14» |
| Experiment running (accepted I) | denominator **9** (elapsed), kept 6, total window 21 → «6 / 9 прошедших · период 21 дн.» — **never 6/21** |

Backend contract: `apps/api/app/analytics/coverage.py`, reading `aa_source_coverage`. Frontend payload: `AAQualityStrip` receives the report verbatim; the accepted items (покрытие · исправлений · оценочных · причина) map to `observed/expected_denominator`, `corrected_count`, `estimated_count`, `reason`. When `unknown_coverage_count > 0` the strip must additionally disclose it — a fraction alone would overstate what is known.

---

## 21. API use-case inventory → proposed API map

Use cases first, endpoints second.

### 21.1 Use cases

**Writes:** W1 record measurement · W2 correct measurement · W3 append expectation version · W4 set/explicitly-unset target · W5 append forecast version · W6 capture baseline · W7 record preference · W8 add observation · W9 acknowledge signal episode · W10 save review · W11 revise review · W12 create/transition experiment · W13 record adherence day · W14 record decision (or none) · W15 set importance · W16 create cross-reference · W17 tombstone/hard-delete a fact.

**Reads:** R1 current signals (≤3 unacknowledged) · R2 signal detail + provenance · R3 subject summary (expected/actual/delta now) · R4 metric history over range, layered · R5 expectation version list · R6 forecast version list + actual separately · R7 provenance for one fact · R8 coverage/quality for window · R9 review context (pre-save) · R10 saved review with correction/redaction flags · R11 experiment detail · R12 cross-domain changes for window · R13 system review groups · R14 subjective+objective pair · R15 pending reviews/experiments · R16 account export.

### 21.2 Endpoint map

Namespace boundary decision: **concept-specific write endpoints, shared read infrastructure.** Writes are concept-specific because collapsing them into one `POST /aa/facts` with a `kind` discriminator would re-create exactly the polymorphic hazard the data model rejects — a single validator that must remember which fields are legal for which concept. Reads are shared because they are genuinely uniform (range + pagination + provenance).

| Method / path | Auth | Request (conceptual) | Response | Idempotency | Pagination | Key errors | Slice |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /api/v1/aa/measurements` | session | subject, metric_key, value{…}, occurred_at+tz, provenance, `idempotency_key` | created fact | **required** | — | 409 `idempotency_replay` (returns existing, 200), 422 `invalid_value_for_type` | 0 |
| `POST /api/v1/aa/measurements/{id}/correct` | session | new value, reason, `idempotency_key` | new fact + superseded ref | required | — | 409 `correction_conflict` (already corrected), 404 | 0 |
| `GET /api/v1/aa/metrics/{metric_key}/history` | session | `?subject=&from=&to=&layers=&cursor=&limit=` | **separate arrays** per layer: `actual[]`, `expectations[]`, `forecasts[]`, `baselines[]`, `events[]` + `coverage` | — | keyset `(occurred_at,id)` | 400 `range_required` | 0→1 |
| `GET /api/v1/aa/subjects/{subject_key}/summary` | session | `?as_of=` | expected/actual/delta/target/forecast + provenance | — | — | 404 | 1 |
| `GET /api/v1/aa/subjects/{subject_key}/coverage` | session | `?from=&to=` | `CoverageReport` | — | — | — | 1 |
| `GET /api/v1/aa/facts/{table}/{id}/provenance` | session | — | 4-tuple + source_ref + correction status | — | — | 404 | 0 |
| `DELETE /api/v1/aa/facts/{table}/{id}` | session | `?mode=tombstone\|hard` | receipt | — | — | 409 if referenced-and-blocked | 0b |
| `POST /api/v1/aa/expectations` | session | subject, value, window, effective_from, provenance, key | version | required | — | 422 | 1 |
| `POST /api/v1/aa/forecasts` | session | subject, value, horizon_at, provenance, key | version | required | — | 422 | 1 |
| `POST /api/v1/aa/baselines` | session | subject, value, window, provenance, key | baseline | required | — | 422 | 1 |
| `POST /api/v1/aa/targets` | session | subject, value **or** `is_explicitly_absent`, window, desired_direction, key | target | required | — | 422 `value_or_absent_required` | 1 |
| `POST /api/v1/aa/preferences` | session | statement, desired_direction, key | preference | required | — | — | 1 |
| `POST /api/v1/aa/observations` | session | subject, value, epistemic_kind, occurred_at, key | observation | required | — | — | 1 |
| `GET /api/v1/aa/signals` | session | `?limit=3` | derived signals, unacknowledged, ranked | — | — | — | 3 |
| `POST /api/v1/aa/signal-episodes/{episode_key}/ack` | session | `resolution`, observed `input_fingerprint`, key | episode | required | — | 409 `episode_changed` | 3 |
| `GET /api/v1/aa/reviews/context` | session | `?subject=&from=&to=` | proposed context items (unsaved) | — | — | — | 4 |
| `POST /api/v1/aa/reviews` | session | subject, window, context items, text, factors, decision, key | review | required | — | 422 | 4 |
| `GET /api/v1/aa/reviews/{id}` | session | — | review + items with `corrected`/`redacted` flags | — | — | 404 | 4 |
| `POST /api/v1/aa/reviews/{id}/revise` | session | text/factors/decision, key | review | required | — | 404 | 4 |
| `POST /api/v1/aa/experiments` · `/{id}/transition` · `/{id}/adherence` · `/{id}/observations` · `/{id}/decision` | session | per concept | experiment | required | — | 409 `invalid_transition` | 6 |
| `GET /api/v1/aa/experiments/{id}` | session | — | full detail + derived adherence classification | — | — | 404 | 6 |
| `GET /api/v1/aa/changes` | session | `?from=&to=&cursor=` | per-domain change cards with unit + coverage + provenance | — | keyset | 400 `range_required` | 7 |
| `GET /api/v1/aa/system-review` | session | `?from=&to=` | six groups + pending + quality | — | — | — | 7 |
| `POST /api/v1/aa/importance` | session | change_key, importance, key | rating | required (upsert) | — | — | 7 |
| `POST /api/v1/aa/cross-references` | session | from_ref, to_ref, relation, key | reference | required | — | 422 `causal_relation_forbidden` | 7 |
| **`GET /api/v1/export`** | session | — | snapshot + all AA + manifest (stream) | — | — | — | **0b** |
| **`DELETE /api/v1/account`** | session | confirmation | 204 | — | — | 409 | **0b** |

**Conventions inherited from existing code (not reinvented):** cookie session via `get_current_user`; `enforce_same_origin` + `require_json_content_type` on every unsafe method; `{code, message}` error envelope per `app/schemas/errors.py`; range parameters mandatory on unbounded reads (never default to all-time); keyset pagination on `(occurred_at, id)` because offsets drift as history is appended.

---

## 22. Migration graph

All migrations are **additive with respect to pre-AA schema**. **No PRE-AA existing table is modified** — `users`, `sessions` and `user_snapshots` are never altered. Later AA migrations **may** evolve constraints or tables created by earlier AA slices (M6 widens an `aa_decisions` CHECK, for example); that is expected and in scope. `user_snapshots.schema_version` stays `2`; `Literal[2]` in `app/schemas/state.py` remains valid, so old clients keep working throughout.

```
20260721_0001 (existing)
      │
      ├─ M1  aa_0002_history_foundation        Slice 0
      │       enums-as-CHECK helpers, aa_metric_definitions, aa_measurements,
      │       aa_source_coverage (C6), shared template columns, indexes,
      │       seed metric rows (data migration)
      │
      ├─ M2  aa_0003_deletion_receipts         Slice 0b
      │       aa_deletion_receipts  (no content columns)
      │
      ├─ M3  aa_0004_semantic_comparison       Slice 1
      │       aa_expectation_versions, aa_forecast_versions, aa_baselines,
      │       aa_targets, aa_preferences, aa_observations,
      │       aa_metric_policy_versions, aa_metric_membership_overrides (C7)
      │
      ├─ M4  aa_0005_signal_episodes           Slice 3
      │       aa_signal_episodes
      │
      ├─ M5  aa_0006_reviews                   Slice 4
      │       aa_reviews, aa_review_context_items, aa_review_factors, aa_decisions
      │
      ├─ M6  aa_0007_experiments               Slice 6
      │       aa_experiments, aa_experiment_adherence, aa_experiment_observations
      │       (+ extend aa_decisions CHECK to allow experiment scope)
      │
      ├─ M7  aa_0008_tradeoff                  Slice 7
      │       aa_importance_ratings, aa_cross_references
      │
      └─ M8  aa_0009_retention                 Slice 8
              aa_retention_policies
```

Per-migration properties:

| M | Depends on | Forward-compatible with old clients | Downgrade (see §22.1) | Lock duration | Index creation | FK cascade |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | 0001 | yes — new tables invisible | `DROP TABLE` — **pre-write environments only** | negligible (new tables) | inline at create | `users ON DELETE CASCADE` |
| M2 | M1 | yes | `DROP TABLE` — pre-write only | negligible | inline | cascade |
| M3 | M1 | yes | `DROP TABLE` — pre-write only | negligible | inline | cascade |
| M4 | M3 | yes | `DROP TABLE` — pre-write only | negligible | inline | cascade |
| M5 | M3 | yes | `DROP TABLE` — pre-write only | negligible | inline | cascade + `review_id` cascade |
| M6 | M5 | yes | pre-write only; the `aa_decisions` CHECK widening reverts by recreating the narrower CHECK — **and only if no row already uses `ABANDONED`** | brief `ACCESS EXCLUSIVE` on `aa_decisions` for the CHECK swap — negligible table size | inline | cascade |
| M7 | M3 | yes | `DROP TABLE` — pre-write only | negligible | inline | cascade |
| M8 | M1 | yes | `DROP TABLE` — pre-write only | negligible | inline | cascade |

**Enum implications:** because enums are `TEXT + CHECK` (§17), adding `ABANDONED` in M6 is `DROP CONSTRAINT` + `ADD CONSTRAINT` inside one ordinary transaction — no `ALTER TYPE`, no transaction-block restriction, and downgrade is symmetric.

### 22.1 Downgrade policy (correction C8)

Alembic `downgrade()` is written for every AA migration, but **its use is conditional on whether personal AA data exists**:

| Situation | Permitted rollback |
| --- | --- |
| **Before any personal AA data exists** — dev, test, disposable environments, or a production rollback that happens *before* the slice's write path was enabled (`LIFEOS_AA_WRITE_ENABLED = false`, §24.2) | Schema downgrade is permitted. `DROP TABLE` is safe because there is nothing to lose |
| **After personal AA history has been written** | Rollback **MUST be non-destructive**: disable the feature flag and/or roll back client and server *behaviour*. **KEEP the `aa_*` schema. KEEP the AA data.** Do **not** run a destructive Alembic downgrade against populated AA tables |

A schema downgrade after user data exists is **not the normal rollback path**. It requires a separately authorized, data-preserving procedure (export first, then a migration that carries data forward or parks it), and is out of scope for routine deployment.

**Deploy gate per slice:** every slice that creates tables records, in its release notes, whether its write path was ever enabled in production. That single fact decides which row of the table above applies. Once the answer is "yes", the destructive downgrade is retired for that migration permanently.

**Every migration must also update `apps/api/tests/conftest.py`** — the `clean_database` fixture TRUNCATEs a hardcoded list (`user_snapshots, sessions, users CASCADE`). A new table absent from that list leaks state between tests. Slice 0 additionally adds a guard test that introspects `Base.metadata` and fails if any table is missing from the TRUNCATE list.

---

## 23. PRE-0 · Development baseline gate

**Goal:** prove the repository is reproducibly testable before any implementation. No feature changes.

Discovery could not run tests because `apps/web/node_modules` and `apps/api/.venv` are absent. Commands below are derived from repository evidence, not guessed.

### 23.1 Backend

```bash
cd apps/api
python3.11 -m venv .venv                     # pyproject: requires-python >=3.11,<3.12
. .venv/bin/activate
pip install --require-hashes -r requirements-dev.lock   # hashes present; includes pytest, httpx, ruff

# PostgreSQL: the test DB name MUST end with _test (conftest refuses otherwise)
createdb lifeos_test
export LIFEOS_TEST_DATABASE_URL='postgresql+psycopg://<user>:<pass>@127.0.0.1:5432/lifeos_test'

python -m pytest                              # testpaths = ["tests"]; conftest runs alembic upgrade head
ruff check .
```

Note: `requirements.lock` is runtime-only; `requirements-dev.lock` adds the dev extra. Run from `apps/api` — tests import `app.*` and `alembic.ini` uses `prepend_sys_path = %(here)s`.

Runtime app config (not needed for tests) comes from `.env` modelled on the repository-root `.env.example` (`LIFEOS_*` prefix).

### 23.2 Frontend

```bash
cd apps/web
npm ci                    # package-lock.json present
npm test                  # vitest run — include src/test/**/*.test.{js,jsx,ts,tsx}, environment 'node'
npm run typecheck         # tsc --noEmit
npm run lint              # eslint src vite.config.js
npm run build             # vite build → dist/, sourcemaps on
```

### 23.3 Baseline evidence to capture (committed as a PRE-0 report)

Python/Node/npm/PostgreSQL versions · `pytest` pass/fail/skip counts · `vitest` counts · typecheck and lint results · build success and bundle size · `alembic heads` output (expect single head `20260721_0001`).

### 23.4 If the baseline is red

Classify every failure as **(a)** environmental (missing DB, wrong Python) → fix the environment; **(b)** pre-existing product defect unrelated to AA → record it, do not fix it inside an AA slice, raise separately; **(c)** blocking (build or migrations fail) → **stop; Slice 0 must not begin.** Never start Slice 0 against an unexplained red baseline: without a green reference, no later failure can be attributed.

**Acceptance gate:** dependencies installed from lockfiles; all four web commands and both API commands executed; results recorded; every failure classified; no unclassified failure remains.

---

## 24. Slice plans

Every slice below states: Goal · Preconditions · Files (NEW/MODIFY) · Backend · Frontend · Data model · API · Migration · Tests · Observability · Security/privacy · Acceptance gate · Explicitly not included.

---

### 24.1 Slice 0 · Semantic History Foundation

**Goal.** A fact can be recorded, retried safely, corrected, and read back both as *current* and *as-of any past instant*, isolated per account — with `user_snapshots` untouched.

**Preconditions.** PRE-0 green.

**Files.**

| Path | Status |
| --- | --- |
| `apps/api/app/analytics/__init__.py` | NEW |
| `apps/api/app/analytics/enums.py` | NEW |
| `apps/api/app/analytics/subjects.py` | NEW |
| `apps/api/app/analytics/values.py` | NEW |
| `apps/api/app/analytics/delta.py` | NEW |
| `apps/api/app/analytics/asof.py` | NEW |
| `apps/api/app/analytics/coverage.py` | NEW |
| `apps/api/app/models/aa_metric_definition.py` | NEW |
| `apps/api/app/models/aa_measurement.py` | NEW |
| `apps/api/app/models/aa_source_coverage.py` | NEW |
| `apps/api/app/services/aa_coverage_claims.py` | NEW |
| `apps/api/app/models/mixins.py` | NEW — shared column template |
| `apps/api/app/models/__init__.py` | **MODIFY** — export new models (Alembic autogenerate depends on it) |
| `apps/api/app/schemas/aa_common.py` | NEW — value, provenance, subject, idempotency |
| `apps/api/app/schemas/aa_measurement.py` | NEW |
| `apps/api/app/services/aa_facts.py` | NEW — append, correct, as-of, idempotency |
| `apps/api/app/routes/aa_measurements.py` | NEW |
| `apps/api/app/routes/aa_history.py` | NEW |
| `apps/api/app/main.py` | **MODIFY** — include the two routers |
| `apps/api/alembic/versions/20260909_0002_aa_history_foundation.py` | NEW (M1) |
| `apps/api/tests/conftest.py` | **MODIFY** — extend `clean_database` TRUNCATE list |
| `apps/api/tests/test_aa_measurements.py` | NEW |
| `apps/api/tests/test_aa_idempotency.py` | NEW |
| `apps/api/tests/test_aa_correction.py` | NEW |
| `apps/api/tests/test_aa_asof.py` | NEW |
| `apps/api/tests/test_aa_coverage.py` | NEW |
| `apps/api/tests/test_aa_isolation.py` | NEW |
| `apps/api/tests/test_aa_schema_guards.py` | NEW — TRUNCATE-list guard, enum/CHECK parity |
| `apps/web/src/api/analytics.ts` | NEW |
| `apps/web/src/repositories/analyticsRepository.ts` | NEW |
| `apps/web/src/test/analytics-repository.test.ts` | NEW |

**Backend.** Shared mixin for the §7.1 template; `aa_metric_definitions` + `aa_measurements`; append/correct/as-of services; idempotency via `UNIQUE (user_id, idempotency_key)` returning the existing row on replay; correction via the predicate CAS of §11.3; every query filtered by `user_id` from `get_current_user`; unsafe methods behind `enforce_same_origin` + `require_json_content_type`.

**Frontend.** HTTP boundary only (`analyticsRepository`) — **no queue, no UI, no route.** Used by tests and by later slices.

**Data model.** `aa_metric_definitions`, `aa_measurements` (incl. immutable `dimensions`), `aa_source_coverage` (C6).

**API.** `POST /aa/measurements`, `POST /aa/measurements/{id}/correct`, `GET /aa/metrics/{key}/history`, `GET /aa/facts/{table}/{id}/provenance`.

**Migration.** M1, additive. Rollback: `DROP TABLE` is permitted **only while `LIFEOS_AA_WRITE_ENABLED` has never been true in production** (§22.1); once AA data exists, roll back behaviour and keep the schema. Deploy: server-only; no client depends on it.

**Tests.** Unit: value CHECK legality, delta legality, as-of selection, subject-key construction. DB: isolation, append-only, supersession chain, unique idempotency, TRUNCATE-list guard. API: append/replay/correct/history/provenance, auth on every route, cross-account 404.

**Observability.** Structured logs on idempotency replay (key, table), correction conflict (target id), and invalid-value rejection (value_type, offending field). Every AA error carries a stable `code`.

**Security/privacy.** `user_id` on every row and every query; no user id accepted from a request body (mirrors `test_state_isolation.py`); `ON DELETE CASCADE` from `users`.

**Acceptance gate.**
1. Record one Measurement → readable.
2. Re-POST the same `idempotency_key` → **one** fact, 200 with the existing row.
3. Correct it → the corrected value is current, the original is discoverable, and the active-set aggregate counts it **once**.
4. As-of query before the correction returns the original.
5. Account B cannot read or correct account A's fact (404, not 403 — no existence leak).
6. A window with no coverage claim reports `unknown_coverage`, **not** `observed` and not `missing`; a `complete` claim over a day with zero measurements reports `observed` (C6 / T-19).
7. Requesting a metric value where no observation exists returns a **derived** `no_data` response and writes **no** row (C5 / T-05).
8. Existing suites still pass; `PUT /api/v1/state` behaviour byte-identical.

**Explicitly not included.** No expectations/forecasts/targets/baselines. No signals, reviews, experiments. No UI, no route, no queue. **No user-facing history collection** — see §24.2 gate.

---

### 24.2 Slice 0b · Export & Delete Foundation

**Goal.** Personal history cannot accumulate before export and erasure exist.

**Preconditions.** Slice 0.

**Gate rule (binding).** After Slice 0 and before 0b lands, AA fact recording may exist **only** behind a dev/test flag (`LIFEOS_AA_WRITE_ENABLED`, default `false` outside `test`). No shipped user-facing surface may persist AA history until 0b is complete. This operationalises the Discovery's sequencing insight.

**Files.**

| Path | Status |
| --- | --- |
| `apps/api/app/models/aa_deletion_receipt.py` | NEW |
| `apps/api/app/models/__init__.py` | **MODIFY** |
| `apps/api/app/services/export.py` | NEW — table registry + streaming serializer |
| `apps/api/app/services/account.py` | NEW — erasure |
| `apps/api/app/services/aa_deletion.py` | NEW — tombstone / hard delete / redaction hook |
| `apps/api/app/routes/export.py` | NEW |
| `apps/api/app/routes/account.py` | NEW |
| `apps/api/app/routes/aa_facts.py` | NEW |
| `apps/api/app/main.py` | **MODIFY** |
| `apps/api/app/config.py` | **MODIFY** — `aa_write_enabled` flag |
| `apps/api/alembic/versions/20260909_0003_aa_deletion_receipts.py` | NEW (M2) |
| `apps/api/tests/conftest.py` | **MODIFY** |
| `apps/api/tests/test_export.py` | NEW |
| `apps/api/tests/test_account_deletion.py` | NEW |
| `apps/api/tests/test_aa_deletion.py` | NEW |
| `apps/web/src/api/exportAccount.ts` | NEW |
| `apps/web/src/components/SettingsPage.jsx` | **MODIFY** — server export action beside the existing client export |

**Backend.** Account-level export aggregating snapshot + every `aa_*` table + manifest, streamed to avoid loading history into memory (the 5 MiB snapshot cap does not apply to responses, but memory does). Account deletion via cascade. AA per-fact tombstone/hard delete with the redaction hook that Slice 4 will extend.

**Data model.** `aa_deletion_receipts (id, user_id, table_name, fact_id, deleted_at)` — **no content columns**, by construction.

**API.** `GET /api/v1/export`, `DELETE /api/v1/account`, `DELETE /api/v1/aa/facts/{table}/{id}?mode=`.

**Migration.** M2, additive.

**Tests.** Export contains snapshot + AA incl. **superseded and tombstoned** rows; the registry-completeness test fails if any `aa_*` table is unexported; hard delete leaves no residue and writes a receipt; account deletion leaves **zero** rows in every `aa_*` table; no dangling `source_ref`; export is account-isolated.

**Observability.** Audit log line per hard delete and per account deletion (ids and counts only, never content). Export duration and row counts.

**Acceptance gate.** Export round-trip contains current snapshot **and** AA history with correction chains represented; hard delete is complete and verified by a residue scan; the Review-redaction mechanism is structurally in place (the hook exists and is called, even though `aa_review_context_items` arrives in Slice 4); account delete cascades everything.

**Explicitly not included.** Retention policy (Slice 8). Review redaction *content* (Slice 4). Import.

---

### 24.3 Slice 1 · Shared Semantic Contracts + Frontend Primitives

**Goal.** All five comparison concepts exist and are distinguishable by construction, and the accepted C variants render from API-backed contracts.

**Preconditions.** Slice 0b.

**Files.**

| Path | Status |
| --- | --- |
| `apps/api/app/models/aa_expectation_version.py` · `aa_forecast_version.py` · `aa_baseline.py` · `aa_target.py` · `aa_preference.py` · `aa_observation.py` | NEW (6) |
| `apps/api/app/models/aa_metric_policy_version.py` · `aa_metric_membership_override.py` | NEW (2, C7) |
| `apps/api/app/services/aa_metric_policy.py` | NEW (C7) |
| `apps/api/app/models/__init__.py` | **MODIFY** |
| `apps/api/app/schemas/aa_comparison.py` | NEW |
| `apps/api/app/services/aa_comparison.py` | NEW |
| `apps/api/app/services/aa_desirability.py` | NEW — **grounding-only** derivation |
| `apps/api/app/routes/aa_comparison.py` | NEW |
| `apps/api/app/routes/aa_subjects.py` | NEW |
| `apps/api/app/main.py` | **MODIFY** |
| `apps/api/alembic/versions/20260910_0004_aa_semantic_comparison.py` | NEW (M3) |
| `apps/api/tests/conftest.py` | **MODIFY** |
| `apps/api/tests/test_aa_desirability.py` · `test_aa_comparison.py` · `test_aa_target_absence.py` | NEW |
| `apps/web/src/analytics/values.ts` · `delta.ts` | NEW |
| `apps/web/src/components/analytics/AADelta.jsx` · `AAFacts.jsx` · `AAProvenance.jsx` · `AAQualityStrip.jsx` · `AAHistoryList.jsx` | NEW (5) |
| `apps/web/src/analytics.css` | NEW — ported from `ui_kits/life-os-analytics/analytics.css` **minus demo chrome** |
| `apps/web/src/test/analytics-delta.test.ts` · `analytics-values.test.ts` | NEW |

**Design-system port rule.** Port `analytics.css` **excluding** `.aa-phone`, `.aa-phone-scroll`, `.aa-phone-notch`, `.aa-shell`, `.aa-rail`, `.aa-stage*` — the README names these as preview harness, not product. A lint/CI grep asserts none of these class names appears under `apps/web/src`.

**Backend.** Five separate concept tables plus observations. `aa_desirability.py` computes `desire` from **Target / Preference / Decision only** — it imports no expectation or forecast module, and receives no sign as input; absent grounding returns `neutral`.

**API.** `POST /aa/{expectations,forecasts,baselines,targets,preferences,observations}`, `GET /aa/subjects/{key}/summary`, `GET /aa/subjects/{key}/coverage`.

**Migration.** M3, additive.

**Tests.** All seven accepted C variants representable; `desire` is `neutral` without grounding, `favorable/unfavorable` only with it; a Target may be `is_explicitly_absent` and is distinguishable from `0`; an Actual cannot be written to `aa_forecast_versions` (no code path, asserted by a type/route test); delta legality per §9.3.

**Acceptance gate.**
1. Seven C variants render truthfully from API contracts.
2. **Expectation alone cannot produce desirability** (regression test T-01).
3. Actual is never stored in the forecast table (T-02).
4. `target absent` ≠ `target = 0` in payload and rendering.
5. No demo-chrome class names in `apps/web/src`.

**Explicitly not included.** No domain surface, no signals, no queue, no route wiring.

---

### 24.4 Slice 2 · Finance Pilot (F · C · D)

**Goal.** The first real user-facing AA domain, backed by real facts, with durable offline writes.

**Preconditions.** Slice 1; D5 queue contract (§15).

**Files.**

| Path | Status |
| --- | --- |
| `apps/web/src/repositories/analyticsWriteQueue.ts` | NEW — IndexedDB, injected `IDBFactory` |
| `apps/web/src/repositories/analyticsSyncCoordinator.ts` | NEW |
| `apps/web/src/context/AnalyticsContext.jsx` | NEW — AA state owner, **separate from `LifeDataContext`** |
| `apps/web/src/pages/finances/FinanceAnalytics.jsx` | NEW |
| `apps/web/src/pages/analytics/MetricHistoryPage.jsx` | NEW |
| `apps/web/src/components/analytics/AAChart.jsx` · `AAChartLayers.jsx` | NEW |
| `apps/web/src/context/LifeDataContext.jsx` | **MODIFY** — add `updateTransaction` / `correctTransaction`; emit AA facts |
| `apps/web/src/components/MoneyWidget.jsx` | **MODIFY** — retire `const budget = 300` in favour of the stored expectation/target |
| `apps/web/src/app/routes.js` | **MODIFY** — add `analytics` route |
| `apps/web/src/App.jsx` | **MODIFY** — mount `AnalyticsProvider` + route |
| `apps/web/package.json` | **MODIFY** — devDependency `fake-indexeddb`; test env for queue suites |
| `apps/api/app/services/aa_legacy_import.py` | NEW — transactions → measurements (+ immutable `dimensions`), policy v1 + overrides (C7), coverage claims (C6), all LEGACY_IMPORT |
| `apps/api/tests/test_aa_metric_policy_asof.py` | NEW (C7) |
| `apps/api/app/routes/aa_import.py` | NEW |
| `apps/api/tests/test_aa_legacy_import.py` | NEW |
| `apps/web/src/test/analytics-write-queue.test.ts` · `analytics-sync-coordinator.test.ts` · `analytics-offline-replay.test.ts` | NEW |

**Legacy import (C1, C6, C7, D3).** Import **only** existing `transactions[]` as `finance.transaction_amount` measurements with `source_kind = IMPORTED`, `method = LEGACY_IMPORT`, `original_recorded_at_known = false`, `recorded_at` = ingestion time, `occurred_at` = the transaction's `date`, and immutable `dimensions = {category_id, included_by_default}` captured at import (C7).

Also captured at import, all with `effective_from` = ingestion time and **never backdated**: **policy version 1** from today's `categoryOverrides`, and **membership overrides** from today's per-transaction `included_in_totals` (C7). Windows earlier than the import therefore resolve `policy_known = false` and the strip discloses «правило учёта за этот период неизвестно».

**No coverage claim is fabricated (C6).** The import writes an `aa_source_coverage` claim only for the window the import genuinely covered, with the source that covered it. Days outside any claim resolve to `unknown_coverage` — never to `observed`, and never to `missing`.

**`activityLog` is not imported (D3).** No expectation, forecast, target or baseline is backfilled. Coverage for pre-rollout windows reports `has_legacy_imports = true`.

**Frontend state ownership.** `AnalyticsContext` is a **separate provider** from `LifeDataContext`. Transactions remain snapshot-owned for the Finance list; AA measurements are emitted alongside. The two are never summed together.

**Acceptance gate** (from frozen F/C/D).
1. Three expectation versions retained (₴50,000 → ₴57,000 → ₴62,000), none deleted.
2. Target may be explicitly not set; rendered «цель на месяц не задавалась», not `0`.
3. Correction ₴12,000 → ₴1,200 counts **once** in the month total.
4. **−₴800 vs expectation renders `neutral`** with no target present.
5. Provenance chip opens the accepted 4-row popover; mobile renders the sheet.
6. Coverage «28 / 31» explicit and **backed by an `aa_source_coverage` claim**, not by transaction presence; «3 дня ещё не наступили — не считаем их нулями» (T-19).
7. **An offline-created fact survives a browser restart and replays exactly once.**
8. A snapshot 409 does not pause the AA queue (T-12).
9. **Historical reproducibility (C7):** August computed as-of T1, then inclusion policy changed at T2 — August as-of T1 is byte-identical, and any Review built on it is unchanged (T-18).
10. The Finance derivation reads no snapshot policy field (T-20).

**Explicitly not included.** Signals (Slice 3), review (4), forecast *generation* (only user/derived-recorded forecast versions are stored).

---

### 24.5 Slice 3 · Signals + Home (A · B)

**Goal.** Derived signals with persisted episode acknowledgement, and Home's quiet 0–3 section.

**Preconditions.** Slice 2.

**Files.** `apps/api/app/analytics/rules/__init__.py` (registry) · `finance_threshold.py` · `project_forecast_revision.py` · `data_stale.py` · `coverage_partial.py` (NEW, 5) · `app/models/aa_signal_episode.py` (NEW) · `models/__init__.py` (MODIFY) · `app/services/aa_signals.py` (NEW) · `app/routes/aa_signals.py` (NEW) · `main.py` (MODIFY) · M4 migration (NEW) · `conftest.py` (MODIFY) · `tests/test_aa_signal_episodes.py`, `test_aa_rules_*.py` (NEW) · `apps/web/src/components/analytics/AASignalCard.jsx` (NEW) · `apps/web/src/pages/HomePage.jsx` (MODIFY — signals **below** the first ordinary panel row) · `apps/web/src/test/analytics-signals.test.ts` (NEW).

**Acceptance gate.**
1. All six B states representable from real data.
2. Home zero-signal state is truthful (derived from coverage, not from an empty result).
3. Dismissal survives reload.
4. **An ordinary transaction inside the same threshold band does not create a new signal** (the C2 correction, test T-11a).
5. A genuine new episode (band crossing, new forecast version) reappears (T-11b).
6. A correction re-evaluates correctly and may withdraw an episode (T-11c).
7. Materiality never sets desirability (T-06).
8. Home shows at most 3, ranked by materiality.

**Explicitly not included.** Rules beyond the four in §19. No notification/alert centre.

---

### 24.6 Slice 4 · Review / Debrief (E)

**Goal.** Reviews that stay historically stable, show later corrections beside frozen values, and honour D1 erasure.

**Preconditions.** Slice 2 (context needs real facts); Slice 3 for the review-available signal.

**Files.** `app/models/aa_review.py` · `aa_review_context_item.py` · `aa_review_factor.py` · `aa_decision.py` (NEW, 4) · `models/__init__.py` (MODIFY) · `app/services/aa_reviews.py` (NEW) · `app/services/aa_deletion.py` (**MODIFY** — implement the redaction hook from 0b) · `app/routes/aa_reviews.py` (NEW) · `main.py` (MODIFY) · M5 (NEW) · `conftest.py` (MODIFY) · `tests/test_aa_reviews.py`, `test_aa_review_redaction.py`, `test_aa_review_correction_visibility.py` (NEW) · `apps/web/src/pages/analytics/ReviewPage.jsx` (NEW) · `components/analytics/AAFactorTag.jsx` (NEW) · `apps/web/src/test/analytics-review.test.ts` (NEW).

**Acceptance gate.**
1. A review reopens showing exactly what the user saw.
2. A later source correction renders «данные позже исправлены» **beside** the frozen value, never substituted.
3. A hard-deleted source value is **no longer present** in review evidence — verified by a test that scans every context row for the erased value — and renders «источник удалён».
4. User-authored text and factors survive redaction untouched.
5. `NULL` decision ≠ `'inconclusive'` (T-08).
6. Every step is skippable; saving with nothing filled is valid; no score exists.

**Explicitly not included.** System Review (7). Experiment review (6).

---

### 24.7 Slice P · Minimal Project Domain

**Goal.** Give G a truthful domain. **Prerequisite, not analytics.**

**Preconditions.** Slice 1 (forecast versions must exist).

**Files.** `apps/web/src/context/LifeDataContext.jsx` (**MODIFY** — `projects[]`, `addProject`, `setProjectForecast`, `completeProject`, `archiveProject`; `migrateStateCopy` seeds `projects: []`) · `apps/web/src/pages/ProjectsPage.jsx` (NEW) · `apps/web/src/components/ProjectCard.jsx` (NEW) · `apps/web/src/app/routes.js` (MODIFY) · `apps/web/src/test/state-migration.test.ts` (MODIFY — `projects` seeding) · `apps/web/src/test/projects.test.ts` (NEW).

**No backend migration** — Project current state lives in the snapshot; its history uses the existing `aa_forecast_versions` and `aa_measurements` tables with subject `project:project:<id>`.

**Acceptance gate.** A user can create a project, record a first estimate, revise forecasts, and complete it; each action emits the auditable AA fact of §16.2; `migrateStateCopy` seeds `projects: []` for existing snapshots with **no `schema_version` bump**; no PM features beyond §16.3.

---

### 24.8 Slice 5 · Project Analytics (G)

**Goal.** The frozen G surface, from real facts.

**Preconditions.** Slice P; Slice 4.

**Files.** `apps/web/src/pages/analytics/ForecastHistoryPage.jsx` (NEW) · `apps/web/src/pages/projects/ProjectAnalytics.jsx` (NEW) · `app/services/aa_comparison.py` (MODIFY — dual-delta helper) · `tests/test_aa_project_analytics.py` (NEW) · `apps/web/src/test/analytics-project.test.ts` (NEW).

**Acceptance gate.** First estimate 20 Aug, later 24 Aug, latest 26 Aug, actual 25 Aug; **forecast versions = 3** with the actual listed separately; delta to first `+5 дней` **neutral**; delta to latest `−1 день` **neutral**; both shown side by side; no desirability inferred from lateness without Target/Preference/Decision.

---

### 24.9 Slice 6 · Experiment (I) — including D4 `ABANDONED`

**Goal.** The frozen I surface plus the owner-approved abandon state.

**Preconditions.** Slice 4 (factors, decisions).

**Files.** `app/models/aa_experiment.py` · `aa_experiment_adherence.py` · `aa_experiment_observation.py` (NEW, 3) · `models/__init__.py` (MODIFY) · `app/services/aa_experiments.py` (NEW) · `app/routes/aa_experiments.py` (NEW) · `main.py` (MODIFY) · M6 (NEW) · `conftest.py` (MODIFY) · `tests/test_aa_experiments.py`, `test_aa_experiment_lifecycle.py`, `test_aa_adherence.py` (NEW) · `apps/web/src/pages/analytics/ExperimentPage.jsx` (NEW) · `components/analytics/AAAdherence.jsx`, `AAExpStages.jsx` (NEW) · `apps/web/src/test/analytics-experiment.test.ts` (NEW).

**Lifecycle** (`TEXT + CHECK`): `DRAFT · RUNNING · COMPLETED_AWAITING_REVIEW · REVIEWED · ABANDONED`. Legal transitions: `DRAFT→RUNNING|ABANDONED`, `RUNNING→COMPLETED_AWAITING_REVIEW|ABANDONED`, `COMPLETED_AWAITING_REVIEW→REVIEWED|ABANDONED`. `REVIEWED` and `ABANDONED` are terminal. Outcome (`aa_decisions.choice`) is **orthogonal and nullable**: `keep · modify · longer · reject · inconclusive · NULL`.

**Minimal UX delta for D4** (the only addition to the frozen package):
- an «прекратить эксперимент» ghost action, available in `DRAFT` and `RUNNING`, with a confirm step;
- status copy «прекращён · период не завершён», and the stage strip renders remaining stages as neither done nor current;
- a semantic-history row «Эксперимент прекращён»;
- adherence renders days after the abandon date as `future`, never `missed`;
- **System Review excludes `ABANDONED` from pending** (allow-list `{DRAFT, RUNNING, COMPLETED_AWAITING_REVIEW}`).

Nothing else about Experiment changes.

**Acceptance gate.** A future day never becomes a miss (T-07); `NULL` decision ≠ `inconclusive` (T-08); an abandoned experiment does not remain pending (T-09); no causal claim anywhere in the model or copy; partial adherence is a valid state; interim values shown while running but result stays `unknown`; provenance visible.

---

### 24.10 Slice 7 · Trade-off + System Review (J)

**Goal.** Cross-domain juxtaposition with no score.

**Preconditions.** Slices 5 and 6 (so all domains and pending states exist).

**Files.** `app/models/aa_importance_rating.py` · `aa_cross_reference.py` (NEW) · `models/__init__.py` (MODIFY) · `app/services/aa_system_review.py` · `aa_changes.py` (NEW) · `app/routes/aa_system_review.py` (NEW) · `main.py` (MODIFY) · M7 (NEW) · `conftest.py` (MODIFY) · `tests/test_aa_system_review.py`, `test_aa_no_global_score.py` (NEW) · `apps/web/src/pages/analytics/TradeoffPage.jsx`, `SystemReviewPage.jsx` (NEW) · `components/analytics/AAImportance.jsx` (NEW) · `apps/web/src/test/analytics-system-review.test.ts` (NEW).

**The «Что улучшилось» query is an `INNER JOIN` to grounding** (`aa_targets` ∪ `aa_preferences` ∪ `aa_decisions` naming a direction). Because those tables are physically separate from `aa_expectation_versions`, an expectation **cannot** satisfy the join. `basis` is always rendered.

**Acceptance gate.** No cross-unit mathematical aggregation is expressible (T-10); no global score anywhere; «Что улучшилось» requires grounding and expectation does not qualify; contradictions coexist and are not resolved; abandoned experiments are not «ждёт вас»; choosing nothing is a valid, affirmed outcome.

---

### 24.11 Slice 8 · Retention / Legacy / Hardening

**Goal.** D2 retention, D3 legacy finalisation, performance and honesty hardening.

**Files.** `app/models/aa_retention_policy.py` (NEW) · `app/services/aa_retention.py` (NEW) · `app/routes/aa_retention.py` (NEW) · M8 (NEW) · `conftest.py` (MODIFY) · `apps/web/src/components/SettingsPage.jsx` (MODIFY — a **separate** AA retention control) · `tests/test_aa_retention.py` (NEW).

**D2 behaviour.** Default **unlimited**. Enabling age-based deletion requires explicit confirmation naming what becomes underivable (older baselines, repeated-pattern detection, long-window coverage). Deleted history writes deletion receipts and the data-quality layer discloses the horizon — **nothing disappears silently**.

**D3 finalisation.** `activityLog` and its «очистить историю старше» control keep their current, narrower meaning. A test asserts no code path converts `activityLog` entries into AA facts.

**Acceptance gate.** Retention behaves as configured; disclosure copy present; no silent loss; index/EXPLAIN review on the history and changes queries at ~180k rows; no backfill or fabrication introduced.

---

## 25. File-level implementation manifest

Consolidated. `S` = slice. Risk: L/M/H.

| Path | Status | S | Purpose | Depends on | Risk | Test coverage |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/api/app/analytics/enums.py` | NEW | 0 | StrEnums; source of CHECK lists | — | L | `test_aa_schema_guards` |
| `apps/api/app/analytics/subjects.py` | NEW | 0 | subject triple registry/validation | enums | M | `test_aa_measurements` |
| `apps/api/app/analytics/values.py` | NEW | 0 | value construction/validation | enums | H | `test_aa_values` |
| `apps/api/app/analytics/delta.py` | NEW | 0 | delta legality + computation | values | H | `test_aa_delta` |
| `apps/api/app/analytics/asof.py` | NEW | 0 | as-of version selection | — | H | `test_aa_asof` |
| `apps/api/app/analytics/coverage.py` | NEW | 0 | coverage report | — | H | `test_aa_coverage` |
| `apps/api/app/models/mixins.py` | NEW | 0 | shared column template | — | M | schema guards |
| `apps/api/app/models/aa_metric_definition.py` | NEW | 0 | metric catalogue | mixins | L | `test_aa_measurements` |
| `apps/api/app/models/aa_measurement.py` | NEW | 0 | Actual persistence (+ immutable `dimensions`) | mixins | M | `test_aa_measurements` |
| `apps/api/app/models/aa_source_coverage.py` | NEW | 0 | **C6** coverage evidence | mixins | **H** | T-19 |
| `apps/api/app/models/aa_metric_policy_version.py` | NEW | 1 | **C7** versioned inclusion policy | mixins | **H** | T-18, T-20 |
| `apps/api/app/models/aa_metric_membership_override.py` | NEW | 1 | **C7** per-fact inclusion override | mixins | **H** | T-18, T-20 |
| `apps/api/app/services/aa_metric_policy.py` | NEW | 1 | **C7** as-of inclusion resolution | asof, models | **H** | T-18, T-20 |
| `apps/api/app/services/aa_coverage_claims.py` | NEW | 0 | **C6** record/supersede coverage claims | models | M | T-19 |
| `apps/api/tests/test_aa_coverage.py` | NEW | 0 | coverage evidence + C5 absence | coverage | **H** | T-05, T-19 |
| `apps/api/tests/test_aa_metric_policy_asof.py` | NEW | 2 | C7 historical reproducibility | policy | **H** | T-18, T-20 |
| `apps/api/app/models/__init__.py` | **MODIFY** | 0,0b,1,3,4,6,7,8 | model registry for autogenerate | each model | M | schema guards |
| `apps/api/app/services/aa_facts.py` | NEW | 0 | append/correct/idempotency | models | **H** | idempotency, correction |
| `apps/api/app/routes/aa_measurements.py` | NEW | 0 | measurement endpoints | services | M | API tests |
| `apps/api/app/routes/aa_history.py` | NEW | 0 | layered history + keyset paging | services | M | API tests |
| `apps/api/app/main.py` | **MODIFY** | 0,0b,1,3,4,6,7,8 | router registration | routes | L | smoke |
| `apps/api/alembic/versions/*_0002…0009*.py` | NEW ×8 | 0–8 | additive schema | prior head | **H** | migration up/down |
| `apps/api/tests/conftest.py` | **MODIFY** ×8 | 0–8 | **TRUNCATE list per table** | migrations | **H** | schema guard test |
| `apps/api/app/services/export.py` | NEW | 0b | account export + registry | all models | **H** | registry completeness |
| `apps/api/app/services/account.py` | NEW | 0b | account erasure | cascade | **H** | residue scan |
| `apps/api/app/services/aa_deletion.py` | NEW→**MODIFY** | 0b→4 | tombstone/hard/redaction hook | models | **H** | redaction test |
| `apps/api/app/routes/{export,account,aa_facts}.py` | NEW | 0b | account+fact endpoints | services | M | API tests |
| `apps/api/app/config.py` | **MODIFY** | 0b | `aa_write_enabled` flag | — | L | settings test |
| `apps/api/app/models/aa_{expectation_version,forecast_version,baseline,target,preference,observation}.py` | NEW ×6 | 1 | five distinct concepts | mixins | **H** | comparison tests |
| `apps/api/app/services/aa_desirability.py` | NEW | 1 | **grounding-only** desirability | targets/prefs/decisions | **H** | T-01 |
| `apps/api/app/analytics/rules/*.py` | NEW ×5 | 3 | rule catalogue v1 | signals | **H** | per-rule tests |
| `apps/api/app/models/aa_signal_episode.py` | NEW | 3 | episode + ack + fingerprint | mixins | **H** | T-11a/b/c |
| `apps/api/app/models/aa_review*.py`, `aa_decision.py` | NEW ×4 | 4 | review + redactable context | mixins | **H** | redaction, correction |
| `apps/api/app/models/aa_experiment*.py` | NEW ×3 | 6 | lifecycle, adherence, obs | mixins | M | T-07/08/09 |
| `apps/api/app/models/aa_{importance_rating,cross_reference}.py` | NEW ×2 | 7 | J persistence | mixins | L | system review |
| `apps/api/app/models/aa_retention_policy.py` | NEW | 8 | D2 | mixins | M | retention |
| `apps/web/src/api/analytics.ts` | NEW | 0 | AA HTTP calls | `api/client.ts` | L | repo test |
| `apps/web/src/repositories/analyticsRepository.ts` | NEW | 0 | AA boundary + validation | api | M | repo test |
| `apps/web/src/repositories/analyticsWriteQueue.ts` | NEW | 2 | IndexedDB durability | — | **H** | queue + replay |
| `apps/web/src/repositories/analyticsSyncCoordinator.ts` | NEW | 2 | flush/backoff/leader/status | queue | **H** | coordinator, T-12 |
| `apps/web/src/context/AnalyticsContext.jsx` | NEW | 2 | AA state owner | coordinator | M | integration |
| `apps/web/src/analytics/{values,delta}.ts` | NEW | 1 | client-side legality mirror | — | M | unit |
| `apps/web/src/analytics.css` | NEW | 1 | ported styles, **no demo chrome** | kit | M | chrome-grep CI check |
| `apps/web/src/components/analytics/AA*.jsx` | NEW ×10 | 1,2,3,4,6,7 | primitives + compositions | css | M | component tests |
| `apps/web/src/pages/analytics/*.jsx` | NEW ×5 | 2,4,5,6,7 | AA surfaces | primitives | M | page tests |
| `apps/web/src/context/LifeDataContext.jsx` | **MODIFY** | 2,P | tx correction; `projects[]`; emit AA facts | queue | **H** | migration + tx tests |
| `apps/web/src/components/MoneyWidget.jsx` | **MODIFY** | 2 | retire hardcoded `budget = 300` | expectations | M | finance tests |
| `apps/web/src/pages/HomePage.jsx` | **MODIFY** | 3 | signals below first panel row | AASignalCard | M | home tests |
| `apps/web/src/app/routes.js` | **MODIFY** | 2,P | add `analytics`, `projects` | — | L | routing |
| `apps/web/src/App.jsx` | **MODIFY** | 2 | mount `AnalyticsProvider` | context | M | smoke |
| `apps/web/src/components/SettingsPage.jsx` | **MODIFY** | 0b,8 | server export; AA retention | services | M | settings |
| `apps/web/package.json` | **MODIFY** | 2 | devDep `fake-indexeddb` | — | M | queue tests |

---

## 26. Dependency DAG

```
PRE-0 (dev baseline)
  │
  ▼
Slice 0  · history foundation
  │
  ▼
Slice 0b · export + delete            ◄── hard gate: no user-facing AA persistence before this
  │
  ▼
Slice 1  · shared semantic contracts + primitives
  │
  ├──────────────────────────────┐
  ▼                              ▼
Slice 2 · Finance pilot        Slice P · minimal Project domain   (parallel-safe)
  │                              │
  ▼                              │
Slice 3 · Signals + Home         │
  │                              │
  ▼                              │
Slice 4 · Review ────────────────┤
  │                              │
  ├──────────────┬───────────────┘
  ▼              ▼
Slice 5 ·      Slice 6 ·          (parallel-safe after 4 + P)
Project        Experiment
analytics
  │              │
  └──────┬───────┘
         ▼
    Slice 7 · Trade-off + System Review
         │
         ▼
    Slice 8 · Retention / legacy / hardening
```

**Parallelisable after foundations:** `P` runs alongside `2`/`3` (it needs only Slice 1's forecast tables and touches disjoint files). `5` and `6` run in parallel after `4` and `P`. Everything else is strictly sequential — `3` needs real Finance facts, `4` needs real context, `7` needs both domains plus experiment pending states.

---

## 27. Test matrix

**Commands** (from PRE-0): API `cd apps/api && python -m pytest`; web `cd apps/web && npm test`; plus `npm run typecheck`, `npm run lint`, `npm run build`, `ruff check .`.

**Fixtures.** Reuse `conftest.py`'s `account_factory`, `client`, `settings`, `session_factory`. Extend `clean_database` **in every migration slice**. Test DB isolation is already enforced (`_test` suffix required). Add a `frozen_clock` fixture and a fixed `TZ=Europe/Kyiv` for deterministic bitemporal and coverage tests. IndexedDB tests use `fake-indexeddb` with an injected factory (Slice 2).

### Permanent regression tests — must never be deleted

| ID | Assertion | Slice | Home |
| --- | --- | --- | --- |
| **T-01** | Expectation alone never yields desirability; `desire` = `neutral` without grounding | 1 | `test_aa_desirability.py` |
| **T-02** | An Actual can never be stored as a ForecastVersion; forecast count needs no filter | 1 | `test_aa_comparison.py` |
| **T-03** | A correction is counted once in aggregates; the original stays discoverable | 0 | `test_aa_correction.py` |
| **T-04** | A retried idempotency key cannot duplicate a fact | 0 | `test_aa_idempotency.py` |
| **T-05** | **Missing never becomes zero, and no synthetic `unknown` Measurement is created merely because an expected observation is absent.** Absence is the absence of a row; `value_type` has no `unknown` member; a derived no-data response writes nothing | 0/1 | `test_aa_values.py`, `test_aa_coverage.py` |
| **T-06** | No signal rule sets desirability; materiality is independent | 3 | `test_aa_rules_*.py` |
| **T-07** | A future adherence day is never a miss | 6 | `test_aa_adherence.py` |
| **T-08** | `NULL` decision ≠ `'inconclusive'` | 4/6 | `test_aa_experiments.py` |
| **T-09** | `ABANDONED` never appears in System Review pending | 6/7 | `test_aa_system_review.py` |
| **T-10** | No cross-unit aggregation is expressible; no global score | 7 | `test_aa_no_global_score.py` |
| **T-11a** | Same-band input churn does **not** create a new signal episode | 3 | `test_aa_signal_episodes.py` |
| **T-11b** | A genuine new episode reappears despite a prior acknowledgement | 3 | same |
| **T-11c** | A correction re-evaluates episodes and can withdraw one | 3 | same |
| **T-12** | **A snapshot 409 does not pause, freeze or drain the AA write queue** | 2 | `analytics-sync-coordinator.test.ts` |
| **T-13** | Hard delete redacts Review source context; no residue; user text survives | 4 | `test_aa_review_redaction.py` |
| **T-14** | Export includes AA history incl. superseded/tombstoned; registry covers every `aa_*` table | 0b | `test_export.py` |
| **T-15** | Account deletion leaves zero rows in every `aa_*` table | 0b | `test_account_deletion.py` |
| **T-16** | No demo-chrome class (`.aa-phone`, `.aa-shell`, `.aa-rail`, `.aa-stage*`) in `apps/web/src` | 1 | CI grep + `analytics-css.test.ts` |
| **T-17** | `activityLog` is never converted into AA facts (D3) | 8 | `test_aa_legacy_import.py` |
| **T-18** | **Historical monthly spend stays reproducible after a later inclusion-policy change** (C7): compute August as-of T1, change category/per-fact inclusion at T2 > T1, recompute as-of T1 → identical result; as-of T2 differs | 2 | `test_aa_metric_policy_asof.py` |
| **T-19** | **Coverage is never inferred from fact presence** (C6): a day with a transaction but no coverage claim is `unknown_coverage`, not `observed`; a day with a `complete` claim and zero transactions **is** `observed`; manual-only windows never report a bare fraction | 0/2 | `test_aa_coverage.py` |
| **T-20** | Derived Finance aggregates never read snapshot policy (C7): the derivation path contains no reference to `included_in_totals` / `categoryOverrides`, and computing with the snapshot mutated produces an unchanged historical result | 2 | `test_aa_metric_policy_asof.py` |

**Layer coverage.** Unit: values, delta legality, as-of, coverage, episode keys, desirability. DB: isolation, append-only, supersession chains, idempotency uniqueness, cascade completeness, TRUNCATE-list parity. API: auth on every route, cross-account 404, keyset pagination stability under concurrent appends, layered history arrays kept separate, error codes. Frontend: queue durability/replay/ordering/dead-letter, coordinator independence, primitives rendering all accepted states, review correction/redaction display. E2E (manual until a browser runner exists — none is configured today): the six acceptance scenarios of Slices 2–7.

---

## 28. Rollout / deploy order and rollback

**Order per slice:** migration → server (routers, flag off where applicable) → verify old clients unaffected → client behind a feature flag → enable.

**Old-client compatibility.** New tables and routes are invisible to an old client; `user_snapshots` and its `schema_version = 2` are untouched, so an old client and a new server interoperate at every step. **No snapshot schema bump is required to add AA.**

**Feature flags.** Server: `LIFEOS_AA_WRITE_ENABLED` (Slice 0b gate). Client: an `analytics` route flag so AA surfaces can ship dark. Both default off outside test until their slice's gate passes.

**Rollback (correction C8).** The default rollback at every stage is **non-destructive and behavioural**: disable the feature flag, and/or roll back the client and server. AA endpoints then go unused and the tables sit inert. **AA data is retained**, and is re-exposed unchanged when the change is rolled forward.

Destructive schema downgrade (`DROP TABLE`) is reserved for **pre-write** situations only — dev/test/disposable environments, or a production rollback occurring before that slice's write path was ever enabled. **Once personal AA history exists, a destructive downgrade must not be run**; recovering from a schema mistake at that point requires a separately authorized, data-preserving migration or export procedure (§22.1).

**No snapshot downgrade is ever needed** in any of these cases: `user_snapshots` is never altered by AA.

**Deploy race.** Server first, always. A client that never calls `/aa/*` is fully functional throughout.

---

## 29. Security, privacy, performance

**Account isolation.** `user_id NOT NULL` + `FK users(id) ON DELETE CASCADE` on every `aa_*` table; every query leads with `user_id`; no user id accepted from a request body (mirroring `test_state_isolation.py`, which already proves a body-supplied `user_id` is rejected 422); cross-account reads return **404, not 403**, to avoid existence leaks. Each new table gets its own isolation test.

**Privacy.** Minimal collection — persist only what an accepted surface renders. Health data is referenced, never generalised: `lib/medMath.js` logic stays in the medication domain and no medical inference enters AA. Export and deletion parity for every domain. No AI in this plan; `DERIVED` means *computed*, and every «Выведено Life OS» value in the accepted seed is a deterministic calculation.

**Retention.** D2: separate AA policy, default unlimited, explicit disclosure on enable (Slice 8).

**Performance.** ~35k rows/year, ~180k over five years (Discovery §23) — ordinary single-node PostgreSQL. Indexes: `(user_id, subject_key, occurred_at DESC)`; `(user_id, recorded_at DESC)`; partial `(user_id, subject_key, occurred_at) WHERE status = 'active'`; `UNIQUE (user_id, idempotency_key)`; `(user_id, episode_key)`; `(user_id, source_fact_id)` on review context items. Keyset pagination on `(occurred_at, id)`. **No partitioning, no time-series extension, no materialised views, no CQRS** until a measured query is slow. The snapshot stays small because history never enters it, so the 5 MiB cap ceases to be load-bearing.

---

## 30. Risks

| # | Risk | Sev | Mitigation |
| --- | --- | --- | --- |
| R1 | `conftest.clean_database` not updated with a new table → cross-test state leakage, flaky suites | **H** | Slice 0 adds a guard test introspecting `Base.metadata` against the TRUNCATE list |
| R2 | Desirability leaks from expectation (occurred 3× inside the accepted package itself) | **H** | Separate tables + `aa_desirability.py` importing no expectation module + T-01 |
| R3 | Offline queue duplicates facts after restart | **H** | Idempotency key generated **at enqueue** and persisted + `UNIQUE (user_id, idempotency_key)` + T-04 |
| R4 | Signal spam from input churn (the C2 defect) | **H** | Episode/fingerprint split + T-11a |
| R5 | Review redaction leaves residue | **H** | Normalized rows + CHECK forbidding value-with-redaction + residue-scan test T-13 |
| R6 | An `aa_*` table silently missing from export | **H** | Registry-completeness test T-14 |
| R7 | `LifeDataContext` modifications regress snapshot sync | **H** | AA state lives in a separate provider; existing coordinator untouched; existing suites must stay green |
| R8 | IndexedDB untestable in the current `node` test environment | M | Slice 2 adds `fake-indexeddb` + injected `IDBFactory`; flagged as the plan's only new frontend dependency |
| R9 | Demo chrome ported into production CSS | M | README names the classes; CI grep T-16 |
| R10 | Migration head conflicts across parallel slices | M | Strict linear `down_revision` chain; only one slice may create a migration at a time; `alembic heads` checked in CI |
| R11 | Coverage denominator wrong across timezones | M | `occurred_tz` stored; fixed-TZ tests; `observed + missing + future == denominator` asserted |
| R12 | Slice P grows into a PM suite | M | Explicit non-inclusion list §16.3; acceptance gate rejects extra features |
| R13 | Legacy import fabricates history | M | C1 provenance contract; `original_recorded_at_known = false`; no expectation/forecast/target/baseline backfill; T-17 |
| R14 | Enum evolution blocks a migration | L | `TEXT + CHECK` (§17) instead of native enums |
| R15 | A synthetic `unknown` fact is written to represent absence, corrupting counts and coverage | **H** | C5: no `unknown` value type; T-05 |
| R16 | Coverage overstated from transaction presence — «28/31» asserted without evidence | **H** | C6: `aa_source_coverage`; `unknown_coverage` bucket; T-19 |
| R17 | A later inclusion-policy change silently rewrites an old month, Review or signal | **H** | C7: versioned policy + overrides + immutable dimensions; T-18, T-20 |
| R18 | A destructive downgrade drops populated AA tables during a production rollback | **H** | C8: non-destructive rollback after first write; per-slice deploy gate (§22.1) |

---

## 31. New owner decisions

**None.** Every remaining question was decidable from repository evidence and is decided in this plan with justification. Per §31 of the brief, ordinary engineering decisions belong in the plan, not in the owner's queue.

The four post-Discovery corrections (C1–C4) were supplied as instructions, not questions, and are implemented as specified. D1's *product* behaviour was given; only its *storage representation* was left open, and §12 resolves it on evidence.

---

## 32. Implementation handoff instructions

A coding agent receiving one slice gets: this plan, the frozen design tag `adaptive-analytics-design-accepted` → `d496028`, and the Discovery report.

**Standing rules for every slice**

1. **Never modify** `apps/api/app/models/user_snapshot.py`, `app/services/state.py`, `app/routes/state.py`, `app/schemas/state.py`, `app/middleware/body_limit.py`, `apps/web/src/repositories/stateSyncCoordinator.ts`, `serverStateRepository.ts`, `stateRepository.ts`, or the existing Alembic revision. Snapshot `schema_version` stays `2`.
2. **Never modify** `ui_kits/**`, `preview/**`, `.design-sync/**`, or existing Outputs reports. The design kit is a read-only reference; port *from* it into `apps/web/src`.
3. **Every migration** must add its tables to `conftest.clean_database` in the same commit.
3a. **Never write a fact to represent absence** (C5). No observation ⇒ no row. Derived `unknown`/`no_data` is a response state.
3b. **Never infer coverage from fact presence** (C6). «Observed» requires an `aa_source_coverage` claim.
3c. **Never read `included_in_totals` or `categoryOverrides` from the snapshot inside a derivation** (C7). Resolve inclusion as-of T from `aa_metric_policy_versions` + `aa_metric_membership_overrides` + immutable `dimensions`.
3d. **Never run a destructive Alembic downgrade against populated AA tables** (C8). Roll back behaviour, keep schema and data.
4. **Every new table** must be added to the export registry (§14) in the same commit.
5. **Every unsafe route** reuses `get_current_user`, `enforce_same_origin`, `require_json_content_type`, and the `{code, message}` error envelope.
6. **Run the full existing suite** before and after; a pre-existing failure must be classified, never "fixed" opportunistically inside an AA slice.
7. **Do not add production dependencies.** The only sanctioned new package is the dev-only `fake-indexeddb` in Slice 2.
8. **Do not reopen** A–J semantics, D1–D5, or Option D. If an accepted contract appears technically impossible, stop and report rather than adapting the product.
9. Permanent regression tests T-01…T-17 may be extended, never weakened or deleted.
10. Keep `ruff` (line-length 100) and `eslint`/`tsc` clean.

---

## 33. Explicitly NOT in scope for Phase B

Snapshot architecture replacement · event sourcing, CQRS, time-series databases, partitioning, materialised read models · AI of any kind (summarisation, drafting, factor suggestion, pattern detection) · medical inference or generalising medication logic · importing `activityLog` into semantic history (D3) · backfilling Expectation, Forecast, Target, Baseline, coverage or provenance · a Life Score or any cross-unit aggregate · automatic causal conclusions · signal rules beyond the four in §19 · project-management features beyond §16.2 · notification/alert centre · multi-user sharing or collaboration · real-time push · demo chrome (`.aa-phone`, `.aa-shell`, `.aa-rail`, `.aa-stage*`) · changing `user_snapshots.schema_version` · retention implementation before Slice 8 · redesigning any A–J surface beyond the D4 `ABANDONED` delta specified in §24.9.

---

## 34. Post-plan architecture corrections (C5–C8)

Recorded after the plan's first issue and **already reconciled into every affected section**. This is a change record for traceability; the sections above are authoritative and contain no contradictory instruction. No owner decision was required, and none is raised.

| # | Defect in the first issue | Correction | Sections reconciled |
| --- | --- | --- | --- |
| **C5** | `value_type = 'unknown'` was described as "how missing is stored", conflating three distinct states and inviting synthetic rows for absent observations | `value_type` ∈ {money, date, duration, count, scale, categorical} — **no `unknown`**. Missing = **no row**. Explicit unknown = concept-specific column only where meaningful (`aa_targets.is_explicitly_absent`, adherence `state='unknown'`, `epistemic_kind='unknown'`, `aa_observations.value_availability`). Derived unknown/no-data = response state, never persisted | §1 (verdict, invariants), §7.1, §9, **new §9.1**, **new §9.2**, §9.3, §20.3, §21 semantics, **T-05**, Slice 0 gate, handoff rule 3a, R15 |
| **C6** | Finance coverage was defined as "distinct local days with ≥1 measurement", inferring source completeness from fact presence | **New `aa_source_coverage`** (M1/Slice 0): source, scope, local window, `coverage_state`, `completeness_known`, timezone, provenance, supersession. A day is `observed` only with supporting evidence; absent evidence is `unknown_coverage`. Manual-only data never claims completeness without confirmation | §7 data model, §18 catalogue, **§20 rewritten** (§20.0–§20.3), §22 M1, Slice 0 files/data model/gate, Slice 2 import + gate, manifest, **T-19**, handoff rule 3b, R16 |
| **C7** | `finance.monthly_spend` derived while honouring *current* `included_in_totals` / `categoryOverrides` — mutable snapshot policy, so a later toggle would silently rewrite historical months, Reviews and signals | **Hybrid, recommended over A or B alone**: versioned `aa_metric_policy_versions` (category intent, compact) + sparse `aa_metric_membership_overrides` (per-fact) + **immutable `dimensions` captured on the measurement at record time**. `include(fact, T)` resolves as-of T from AA tables only. Legacy policy captured at import with `effective_from` = ingestion, never backdated; earlier windows report `policy_known = false` | §7 data model, §18 catalogue, **new §18.2**, §7.1 template, §22 M3, Slice 1 files, Slice 2 import + gate, §20.3 `policy_known`, manifest, **T-18**, **T-20**, handoff rule 3c, R17 |
| **C8** | Two contradictory rollback claims: "rollback = `DROP TABLE`" *and* "data written before rollback survives" | **New §22.1 downgrade policy.** Pre-write (dev/test/disposable, or production before the slice's write path was ever enabled): schema downgrade permitted. After personal AA history exists: rollback is **non-destructive** — disable the flag, roll back behaviour, **keep schema and data**; a destructive downgrade then requires a separately authorized data-preserving procedure. Per-slice deploy gate records whether the write path was ever enabled | §22 header wording, §22 migration table, **new §22.1**, §28 rewritten, Slice 0 migration line, handoff rule 3d, R18 |

Also corrected: **"No existing table is modified"** → **"No PRE-AA existing table is modified"** (`users`, `sessions`, `user_snapshots` are never altered), with the explicit note that later AA migrations may evolve constraints or tables created by earlier AA slices — M6's `aa_decisions` CHECK widening being the worked example.

### Reconciliation check — everything previously settled still holds

| Preserved | Status after C5–C8 |
| --- | --- |
| Option D hybrid | unchanged — corrections are internal to the AA layer |
| D1–D5 | unchanged and untouched |
| Review R2 (normalized, redactable context) | unchanged |
| Signal `episode_key` / `input_fingerprint` split | unchanged |
| IndexedDB offline queue | unchanged |
| Account-level export/delete | unchanged — the 3 new tables join the export registry and the deletion cascade automatically via the shared template |
| Slice P minimal Project domain | unchanged |
| No `activityLog` backfill (D3) | unchanged; C7's legacy capture reads `categoryOverrides`/`included_in_totals` — **current-state policy, not `activityLog`** |
| No snapshot `schema_version` bump for AA | unchanged — no pre-AA table is touched |
| No global score | strengthened: still no cross-unit numeric type |
| Expectation ≠ Target | unchanged |
| Actual ≠ Forecast | unchanged |
| missing ≠ zero | **strengthened** by C5 (absence is a row's absence) and C6 (absent evidence ≠ observed) |
| No silent history loss | **strengthened** by C7 (a policy change cannot rewrite the past) and C8 (rollback cannot drop populated history) |

**Migration graph:** still **8 migrations**. The three new tables were absorbed into existing boundaries — `aa_source_coverage` into **M1** (its consumer `analytics/coverage.py` is already a Slice 0 file) and the two C7 tables into **M3** (Slice 1 already owns shared semantic contracts). No new migration and no slice reordering was required.

**New support tables: 3** — `aa_source_coverage`, `aa_metric_policy_versions`, `aa_metric_membership_overrides`.
**New permanent regression tests: 3** — T-18, T-19, T-20 (T-05 rewritten).
