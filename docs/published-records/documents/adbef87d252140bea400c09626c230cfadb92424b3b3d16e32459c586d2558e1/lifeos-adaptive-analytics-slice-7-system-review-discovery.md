# LifeOS Adaptive Analytics — Slice 7 · Trade-off + System Review — Parallel Targeted Discovery

**Mode:** PARALLEL DISCOVERY · read-only · no implementation
**Generated:** 2026-09-28
**Author:** Claude Code (Opus 5.5)
**Report location:** outside Git, `/Users/yurasachenko/LifeOS/_parallel_discovery/`
**Reconcile target (later Plan session):** `Outputs/Discoveries/lifeos-adaptive-analytics-slice-7-system-review-targeted-discovery_<timestamp>.md`

---

## 1. Executive verdict

`DISCOVERY_STATUS = PASS` — there is enough architecture to write a **provisional** Slice 7 plan.

Slice 7 is a **read-model + two-table** slice. Almost everything it juxtaposes already exists on the baseline or is promised by predecessor contracts. The baseline already provides:

- a typed value contract with no cross-unit numeric type;
- a grounding-only desirability function;
- as-of helpers and coverage reports;
- a derived signal read model;
- the generic durable queue;
- the account export and erasure registries.

What it adds is:

1. two derived reads: `GET /aa/changes` and `GET /aa/system-review`;
2. two user-owned write concepts: importance and explicit cross-references (M7);
3. two pages and one component in the frontend.

**The four findings that matter most:**

1. **A global score can be made structurally impossible.** The M7 tables need no numeric column. Every value on the existing fact tables is typed `(value_type, unit_code)`, and `compute_delta` refuses any cross-type or cross-unit pair. The remaining risks all sit in the **read model and the UI**, not the schema:
   - ordering by magnitude, importance or materiality;
   - dimensionless percentages;
   - top-level numeric fields in responses.

   These can be closed with tests (§15).
2. **"What improved" is a join, not a sign filter.** Baseline `aa_subjects.subject_summary` already builds `NormativeGrounding` only from a window-matched Target, or from a Preference paired with a Baseline. `desirability()` never receives a sign or an Expectation. Slice 7 must reuse that path and add a third grounding kind, the *directional Decision*. **The planned Slice 4 `aa_decisions.choice` vocabulary (`keep · modify · longer · reject · inconclusive · NULL`) names no direction.** A directional Decision is therefore not yet representable. This is the single most important seam to re-verify after Slice 4 merges.
3. **Reading must never write.** `evaluate_signals()` defaults to `persist=True` and upserts episode rows. System Review must call it with `persist=False`, or read episode history directly. A GET that creates rows would violate the "asking never writes" rule already established in `aa_history.py`.
4. **Two product questions are not answered by the frozen design** (§19):
   - **OD-7.1** — the cross-reference relation vocabulary, and whether any creation affordance exists. Frozen J has no UI for creating cross-references.
   - **OD-7.2** — where the System Review "meaning / no conclusion / adjustments / сохранить обзор" state persists, and where the adjustment candidates come from. The expected M7 has only two tables. The seed's pre-filled adjustment list would amount to system recommendations if it were generated.

   Both have recommended defaults. Neither blocks Discovery. Both must be answered before the final Plan.

---

## 2. Baseline SHA actually inspected

```
BASELINE_SHA          ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef   (git cat-file -e … ^{commit} → ok)
origin/main           ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef   (at inspection time)
design tag            adaptive-analytics-design-accepted
  tag object          6c507b829ebc4a2a1e5b1b353db04c1a29302be0   (verified)
  target commit       d4960286ec94f35472600e59c0d533dc50a64351   (verified)
live checkout         branch feat/adaptive-analytics-slice-4-reviews, HEAD ea3a75e
                      (another session active — NOT used as a source)
```

**Method.** All code and documents were read from Git objects only:
- `git archive ea3a75e <paths>` for the baseline;
- `git archive d496028 ui_kits/life-os-analytics` for the frozen design.

Both were extracted into this session's scratchpad. No worktree file was read as a source, and no worktree-mutating command was run. No test suite was run, because another session is mutating the checkout. Baseline counts come from the Slice 3 report: **backend 324, frontend 214**. They must be re-run by the Plan session.

---

## 3. Source authority list

| Authority | Path / object | Used for |
| --- | --- | --- |
| Repo policy | `AGENTS.md`, `CLAUDE.md` @ ea3a75e | process, safety |
| Long-lived context | `LIFEOS_MASTER_CONTEXT.md` @ ea3a75e (§36–§42) | slice status: 3 ✅, 4–8 future; M4 = `20260928_0005` |
| Parent plan | `Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` | §7 table map, §9 value contract, §12 Review, §15 queue, §21 API map, §22 migration graph, §24.6/.9/.10 Slices 4/6/7, §27 T-09/T-10 |
| Parent discovery | `Outputs/Discoveries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md` | §6 J gap, §7 persist/derive, §16 cross-domain contract, D4 rationale |
| Slice reports | `Outputs/Implementations/…slice-0, 0b, 1, 2, P, 3` | shipped contracts; Slice 3 §11–§13 (415 ordering, ack not queued, ranking) |
| Frozen design | `ui_kits/life-os-analytics/{system.jsx, data.js (changes, systemReview), README.md (Pass 4), analytics.css}` @ d496028 | J semantics, vocabulary, layout |
| Baseline code | `apps/api/app/**`, `apps/api/tests/**`, `apps/api/alembic/**`, `apps/web/src/**` @ ea3a75e | seams |

---

## 4. Current baseline architecture relevant to this slice

| Area | Baseline fact | File |
| --- | --- | --- |
| Value contract | `ValueType ∈ {money, date, duration, count, scale, categorical}`, no `unknown`, per-type required/forbidden columns + DB CHECK | `app/analytics/values.py`, `enums.py` |
| Delta legality | `compute_delta` → `Delta` / `DeltaUnknown`; raises `IncompatibleUnitsError` for cross-type pairs, mismatched currency or duration units, or mismatched scale bounds; `CategoricalComparisonError` for categorical | `app/analytics/delta.py` |
| Desirability | `desirability(actual, NormativeGrounding)`; grounding kinds `target · preference · decision`; no grounding → `neutral`; incompatible → `unknown`; docstring: *"Future Decision can supply explicit grounding, but no Decision table … exists"* | `app/services/aa_desirability.py` |
| Grounding resolution | only in `subject_summary`: a Target counts when it is window-matched to the reference and not `is_explicitly_absent`. Otherwise Preference + Baseline, where the reference value is the **baseline**. Partial coverage → actual withheld → `unknown` | `app/services/aa_subjects.py:146-169` |
| As-of | `apply_as_of`, `known_as_of_predicate`, `as_of_order` (recorded_at ≤ T, not superseded by T, not tombstoned) | `app/analytics/asof.py` |
| Coverage | `coverage_report_for_window` over `aa_source_coverage`; `DenominatorBasis` already includes `experiment_elapsed_days`, `expected_observations` | `app/analytics/coverage.py`, `services/aa_coverage_claims.py` |
| Signals | derived `SignalReport`/`SignalCard` (materiality, stakes, provenance, `rendered_values`); **`evaluate_signals(persist=True)` by default writes episodes**; exactly 4 rules; ranking = materiality, stakes, recency, key — no score | `app/services/aa_signals.py` |
| Subjects | registry already contains `("experiment","experiment")` and **`("system","window")`**, the latter reserved for Slice 7 | `app/analytics/subjects.py` |
| Range/pagination | `aa_history`: `from`/`to` mandatory (`400 range_required`), tz-aware timestamps required, keyset cursor base64 `{time, id}`; `MAX_HISTORY_LIMIT = 200`, default 50 | `app/routes/aa_history.py`, `services/aa_facts.py` |
| Unsafe-route guards | `require_json_content_type` + `require_aa_write_enabled` as **route dependencies** (run before body parse → 415, not 422); `enforce_same_origin` in handler; `{code,message}` errors; 404 for cross-account | `security/origin.py`, `security/aa_gate.py`, `routes/aa_signals.py:84`, `routes/aa_comparison.py:61` |
| Versioned appends | `append_version`: replay check, `pg_advisory_xact_lock(grain)`, supersede prior active as `REVISION`, IntegrityError → replay | `app/services/aa_comparison.py` |
| Export | `EXPORT_TABLES` registry; `validate_export_registry` asserts mapped `aa_*` == registry; runtime check vs real DB tables; filters by `user_id` when column exists | `app/services/export.py` |
| Erasure | `DELETE FROM users` cascade; guard test asserts every `aa_*` table has cascade from users | `services/account.py`, `tests/test_aa_schema_guards.py:64` |
| Test registry | `TRUNCATED_TABLES` + `SEEDED_TABLES`; guard tests: every mapped table is cleaned or seeded | `tests/conftest.py:67-91` |
| Per-fact delete | `FACT_TABLES` (semantic + measurements + coverage); `SOURCE_REDACTORS = ()` hook (Slice 4 fills); provenance `source_ref` scrub | `services/aa_deletion.py` |
| Durable queue | generic IndexedDB `AnalyticsWriteQueue` (`operation_type`, `route`, `payload`, key-at-enqueue); coordinator is single-flight; 401 → blocked_auth; 400/422 → failed_permanent; 409 → terminal_conflict; 5xx/network → backoff; `AnalyticsContext.enqueue(op, route, payload)` | `apps/web/src/repositories/analyticsWriteQueue.ts`, `analyticsSyncCoordinator.ts`, `context/AnalyticsContext.jsx:67` |
| Ack precedent | Slice 3 **deliberately did not queue** signal ack, because it is fingerprint-dependent and must fail visibly | Slice 3 report §13 |
| Frontend primitives | `AADelta, AAFacts, AAProvenance, AAQualityStrip, AAHistoryList, AAChart*, AASignalCard`; only page `MetricHistoryPage`; route gated by `ANALYTICS_ROUTE_ENABLED` | `components/analytics/`, `app/routes.js:23` |
| CSS | `analytics.css` ported **without** the J classes: `.aa-banner`, `.aa-changes`, `.aa-change*`, `.aa-pair*`, `.aa-sr-group/item/text`, `.aa-checkline`, `.aa-checkbox`, `.aa-menu*` are absent | `apps/web/src/analytics.css` |
| i18n | `LocaleContext` RU primary / UK secondary; `AASignalCard` renders server `rule_id` + `rendered_values` through ru/uk dictionaries (server sends structure, not prose) | `context/LocaleContext.jsx`, `AASignalCard.jsx` |
| Migrations | `0001 → 20260909_0002 (M1) → 20260909_0003 (M2) → 20260910_0004 (M3) → 20260928_0005 (M4)`; single head | `alembic/versions/` |

**Not present on baseline:** reviews, decisions, experiments, project-analytics helper, importance, cross-references, `/aa/changes`, `/aa/system-review`, and any J page.

---

## 5. Planned predecessor contracts this slice depends on

| Dependency | Source | Class | What Slice 7 needs from it |
| --- | --- | --- | --- |
| Finance facts, as-of policy, coverage | Slices 0–2 | **AVAILABLE_NOW** | changed / quality inputs |
| Project forecast versions + completion | Slice P | **AVAILABLE_NOW** | changed / repeated inputs |
| Signal episodes (4 rules) | Slice 3 | **AVAILABLE_NOW** | repeated (recurrence), quality (stale/partial) |
| Target / Preference / Baseline / Observation | Slice 1 | **AVAILABLE_NOW** | improved grounding (Target, Preference) |
| `aa_reviews`, `aa_review_context_items`, `aa_review_factors`, `aa_decisions` (M5) | Plan §12, §24.6 | **PLANNED_PREDECESSOR_CONTRACT** | "Ждёт вас · ревью доступно"; Decision grounding; possibly System Review save (OD-7.2) |
| **Directional Decision** field | Plan §9 "decision naming a direction", §24.10 | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | the planned `choice` enum has no direction; Slice 4 may or may not add `desired_direction` |
| "Review available" definition (what counts as pending review) | Plan §24.6 mentions a "review-available signal" but master context locks the catalogue at 4 rules | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | count for «Ревью доступно» |
| Dual-delta project helper | Slice 5, Plan §24.8 | **PLANNED_PREDECESSOR_CONTRACT** | project change cards (first vs latest forecast) |
| `aa_experiments` lifecycle `DRAFT · RUNNING · COMPLETED_AWAITING_REVIEW · REVIEWED · ABANDONED`; terminal `REVIEWED`,`ABANDONED`; decisions orthogonal/nullable (M6) | Plan §24.9, D4 | **PLANNED_PREDECESSOR_CONTRACT** | pending allow-list |
| Lifecycle **transition history** (timestamped transitions vs. only a current column) | not specified | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | as-of pending ("was it pending on 31 Aug?") |
| Adherence rows / experiment observations / preference-to-experiment linkage | Plan §24.9 | **PLANNED** (linkage **UNKNOWN**) | seed improved item «правило сна 9 из 14 · по вашему ориентиру» |
| M5/M6 revision ids (M7 `down_revision`) | — | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | linear chain |
| Cross-reference relation vocabulary + creation UI | — | **OWNER_DECISION_REQUIRED** (OD-7.1) | M7 CHECK list |
| System Review save/meaning/adjustments persistence + adjustment source | — | **OWNER_DECISION_REQUIRED** (OD-7.2) | whether M7 grows or reuses M5 |

---

## 6. Exact current code seams

| Seam | Location | Slice 7 use |
| --- | --- | --- |
| `desirability()` + `NormativeGrounding` | `services/aa_desirability.py` | the only way "improved" may be decided; extend the grounding resolver, not the function |
| Grounding resolution logic | `services/aa_subjects.py:146-169` (inline in `subject_summary`) | **extract** into a reusable `resolve_grounding(db, user, metric, subject, window, as_of)` so System Review and the subject summary share one rule; keep behaviour byte-identical (existing tests) |
| `compute_delta` / `IncompatibleUnitsError` | `analytics/delta.py` | every change card; categorical → juxtaposition only |
| `apply_as_of`, `as_of_order` | `analytics/asof.py` | belief-instant reproducibility of the review |
| `coverage_report_for_window` | `services/aa_coverage_claims.py` | "Качество данных" + per-card coverage |
| `evaluate_signals(..., persist=False)` / `aa_signal_episodes` | `services/aa_signals.py` | repeated + quality; **never persist from a GET** |
| `SUBJECT_REGISTRY` incl. `system:window` | `analytics/subjects.py` | subject for a saved System Review (if OD-7.2 → reuse Reviews) |
| cursor encode/decode | `routes/aa_history.py:72-88` | reuse for `/changes` keyset cursor (generalise the `time_field`, or add a tuple cursor) |
| `append_version` (advisory-lock + supersede) | `services/aa_comparison.py` | importance revisions (pattern; the model lacks `metric_key`, so a sibling helper or a generalised grain is needed) |
| `EXPORT_TABLES`, `validate_export_registry` | `services/export.py` | + 2 tables |
| `TRUNCATED_TABLES` | `tests/conftest.py` | + 2 tables |
| `FACT_TABLES`, `SOURCE_REDACTORS`, `_redact_provenance` | `services/aa_deletion.py` | decide whether M7 tables are per-fact deletable; cross-refs that name fact ids need a redactor |
| router registration | `app/main.py:57-69` | + `aa_system_review` router |
| `models/__init__.py` | registry | + 2 models (autogenerate + export guard depend on it) |
| `AnalyticsContext.enqueue` | `context/AnalyticsContext.jsx:67` | `importance.set`, `cross_reference.create` |
| `analyticsRepository.replayQueuedWrite` | `repositories/analyticsRepository.ts` | route-generic replay; no change expected |
| J CSS | `apps/web/src/analytics.css` | port J classes from frozen `analytics.css:313-347` (+ `.aa-menu*` 234-247), **not** demo chrome (T-16) |

---

## 7. Exact expected future seams (to be confirmed after merge)

| Future seam | Expected owner | Slice 7 expectation |
| --- | --- | --- |
| `app/models/aa_decision.py` — `choice` nullable, review- or experiment-scoped | Slice 4 (+ M6 widening) | read-only; grounding **only** if a direction column exists and is non-null |
| `app/services/aa_reviews.py` — "review available" query | Slice 4 | pending review count; Slice 7 must not invent its own definition |
| `app/models/aa_experiment.py` — `lifecycle` TEXT+CHECK | Slice 6 | allow-list query |
| experiment transition record (or `lifecycle_changed_at`) | Slice 6 | as-of pending; if absent, pending is "current" and the response says so |
| `app/services/aa_experiments.py` adherence classification (kept/missed/unknown/future) | Slice 6 | improved candidate only with grounding; future ≠ missed |
| `aa_comparison` dual-delta helper | Slice 5 | project change cards |
| `SOURCE_REDACTORS` entry for review context | Slice 4 | if cross-refs may point at facts, Slice 7 adds its own redactor alongside |

---

## 8. Data model implications

### 8.1 Semantic truth matrix

Legend: **Y** yes · **N** no · **C** conditional (condition stated) · src = current (baseline) or future (predecessor).

| Concept | Что менялось | ground «улучшилось» | Что повторилось | Противоречия | Ждёт вас | unit | coverage | provenance | arithmetic delta | normative / predictive | src |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Measurement / Actual** | Y (window vs prior window, or vs the expectation in force; same `(value_type, unit)` only) | **N** — it is the *operand*, never the ground | C — recurrence of a derived pattern over ≥2 prior windows | C — as one side, only when grounded (see §8.3) | N | Y | Y (derived metrics via `aa_source_coverage`; atomic facts n/a) | Y | Y, same type+unit | descriptive | current |
| **Expectation** | Y (version revisions, e.g. ₴50k→57k→62k) | **N** (predicts, does not prescribe) | Y (revision recurrence) | **N** | N | Y | n/a (belief; comparison inherits Actual's coverage) | Y | Y as reference operand only | **predictive** | current |
| **Forecast** | Y (revisions 20→24→26 авг; actual separate) | **N** | Y (e.g. "корректируется вверх третий месяц") | **N** | N | Y (`date`) | n/a | Y | Y date−date → days | **predictive** | current (project), future (Slice 5 helper) |
| **Baseline** | N as its own item (it is a captured reference) | **N** as ground; it is the *reference value* in Preference grounding | N | N | N | Y | Y (its window) | Y | Y as reference operand | descriptive reference | current |
| **Target** | Y (set / revised / explicitly absent, rendered «цель не задавалась», never 0) | **Y** — window-matched, not `is_explicitly_absent`, with `desired_direction` | N | Y (as a basis) | N | Y | n/a | Y | Y as reference operand | **normative** | current |
| **Preference** | Y (recorded/revised) | **Y** — with `desired_direction`; reference = Baseline (current rule); basis = `statement` | N | Y (as a basis) | N | N (no value) | n/a | Y | N itself | **normative** | current |
| **Observation** (subjective) | Y (scale same bounds, or categorical juxtaposition "ниже"; `explicitly_unknown` → no delta) | C — only if a Target/Preference/Decision grounds the same metric; never from `epistemic_kind` | C | C (grounded only) | N | Y (scale bounds / categorical) | C (`expected_observations` basis; no claim → unknown) | Y + `epistemic_kind` | scale same bounds only; categorical never | descriptive (self-report) | current storage; **no subjective metric/subject registered yet** |
| **Signals** | **N** as items (materiality ≠ change; Home owns "now") | **N** (materiality never grounds) | **Y** — recurrence of the same `rule_id` + subject across ≥2 prior windows | N | N | inherited | stale/partial feed **Качество данных** | Y | N | neither (materiality) | current |
| **Review** | N (an interpretation, not a change) | N (text/factors are hypotheses) | N | N | **Y** «Ревью доступно» (definition from Slice 4) | — | frozen context keeps its own | Y | N | interpretive | **future (Slice 4)** |
| **Decision** | C (an adjustment the user recorded) | **C** — only a *directional* Decision; `NULL` ≠ `inconclusive`, neither grounds | N | Y (as a basis) | N | N | n/a | Y | N | **normative** (only if directional) | **future (Slice 4/6); direction field unknown** |
| **Project Analytics** | Y (forecast revisions, dual delta +5 / −1 дней, both neutral) | C (only with a date Target / Preference / directional Decision) | Y (revision recurrence) | C | N | Y | n/a (event metric) | Y | Y date−date | descriptive + predictive layers | current facts; **future helper (Slice 5)** |
| **Experiment** | Y (lifecycle transitions, adherence over elapsed days) | C (grounding required; seed item needs the Preference↔Experiment linkage) | C | C | **Y only** `DRAFT`,`RUNNING`,`COMPLETED_AWAITING_REVIEW` | Y (count of elapsed days) | Y (`experiment_elapsed_days`) | Y | Y count−count within one experiment | hypothesis ≠ fact; result unknown while running | **future (Slice 6)** |
| **Coverage** | N | N | N | N | N | days | **is** coverage | Y | N | descriptive | current |
| **Provenance** | attribute of every item (mandatory) | basis provenance must render | attribute | attribute | attribute | — | — | **is** provenance | N | — | current |

### 8.2 M7 — expected tables (no score table, no optimization table)

**`aa_importance_ratings`** — user-owned importance, append-only versions.

```
id uuid PK · user_id FK users ON DELETE CASCADE
change_key text NOT NULL                    -- deterministic, value-free (§8.4)
importance text NOT NULL CHECK IN ('none','matters','ok','ignore')
recorded_at timestamptz NOT NULL
source_kind 'USER_REPORTED' (CHECK) · basis/method NULL
supersedes_id / superseded_by_id / superseded_at / supersede_kind('REVISION') / status
idempotency_key text NOT NULL · created_at
UNIQUE (user_id, idempotency_key)
UNIQUE (user_id, change_key) WHERE status = 'active'     -- one live rating
INDEX (user_id, change_key, recorded_at)
-- NO numeric column. NO ordinal/weight mapping anywhere in code.
```

The vocabulary comes from the frozen `AA_IMPORTANCE`: `none`=«не решил», `matters`=«для меня важно», `ok`=«приемлемо», `ignore`=«не считаю значимым».

**Default undecided = no row.** An explicit `none` row records "user reset to undecided". Both render «не решил», but they stay distinct in storage (missing ≠ explicit).

**`aa_cross_references`** — explicit user-created relations only.

```
id uuid PK · user_id FK CASCADE
from_kind text CHECK IN ('change','subject')   -- NOT raw fact ids (see §12)
from_ref  text NOT NULL
to_kind   text CHECK IN ('change','subject')
to_ref    text NOT NULL
relation  text NOT NULL CHECK IN (<OD-7.1 allow-list>)
note      text NULL                             -- user words; no system text
created_by text NOT NULL DEFAULT 'user' CHECK (created_by = 'user')
recorded_at · status ('active','tombstoned') · tombstoned_at · idempotency_key · created_at
UNIQUE (user_id, idempotency_key)
CHECK  (NOT (from_kind = to_kind AND from_ref = to_ref))
UNIQUE (user_id, from_kind, from_ref, to_kind, to_ref, relation) WHERE status = 'active'
-- NO confidence / strength / weight / lag column; no 'causes' value can exist.
```

### 8.3 Group semantics (grounding joins, not filters)

- **Что менялось:** every derived change card in the window, each with its own `(value_type, unit)`, coverage and provenance. Direction is descriptive text only («выше», «ниже», «+₴800»).
- **Что улучшилось:** `change ⋈ grounding`. It is an inner join on `(user, metric_key, subject_key, window)` to a Target, a Preference or a directional Decision **resolved as-of** the review instant, and `desirability(actual, grounding) == 'favorable'`. Results are handled as follows:
  - no grounding → the change stays only in *changed*;
  - `unfavorable` → it stays in *changed* and may seed a contradiction;
  - `unknown` (partial coverage or incompatible) → it is **not** improved and is disclosed in quality.

  `basis` is required in the response schema, and the item is rejected server-side if it is absent. The basis carries the grounding kind, statement or target value, window, recording time and provenance. The resolver module imports only Target, Preference and Decision models, and T-01 is extended with an import-graph test.
- **Что повторилось:** recurrence of an **existing** derivation over ≥2 prior windows of the same length. Sources are the same `rule_id`+subject signal episodes, same-direction forecast or expectation revisions, and repeated partial coverage. It is tagged «закономерность, не приговор». **No fifth signal rule, no new pattern catalogue** (master context §37 locks the catalogue at four). The seed item «три инженерные задачи…» needs tasks-in-projects, which Slice P excludes, so it is **not** reproducible and must not be faked.
- **Противоречия:** a pair of changes in the same window where both are grounded and one is `favorable` while the other is `unfavorable`. They are rendered side by side (`.aa-pair`), each with its basis, and there is no winner, net or resolution field. An ungrounded «вверх/вниз» pair is **not** a contradiction, because direction ≠ desirability. Adjacent overlap may show a derived "same days" note («совпадение по дням есть, причинная связь не проверялась»). That note is **never** a relation row.
- **Ждёт вас:**
  - reviews available (Slice 4's definition);
  - experiments where `lifecycle IN ('DRAFT','RUNNING','COMPLETED_AWAITING_REVIEW')`, returned **per lifecycle** (the seed's «1 закончен · 1 идёт») and never merged into a weighted count. The filter is an **allow-list**, so any future lifecycle value is not pending by default (fail-closed);
  - `ABANDONED` and `REVIEWED` are never pending.
- **Качество данных:** coverage per domain in the window (observed/partial/missing/unknown/future), corrections, estimated share, legacy-import flag, `policy_known`, and stale sources. «Неполное покрытие не заменяется нулями».

**Why ABANDONED must never be pending.**
- D4 made it a terminal state that the user chose deliberately. It is not "completed without a decision".
- No review or decision is owed. Keeping it would nag forever («ждёт вас» with no possible exit), and would conflate stopping with awaiting review (ABANDONED ≠ PENDING).
- After abandonment the remaining days are `future`, not `missed`, so there is nothing to judge.
- A deny-list would silently treat any new lifecycle value as pending, so only the allow-list is safe.

### 8.4 Change identity

Importance and cross-references attach to *derived* changes, so a change needs a deterministic, **value-free** key. The recommended form is:

`v1:<kind>:<metric_key>:<subject_key>:<window_start>:<window_end>[:<comparison>]`

- No fact ids and no values, so a correction does not orphan a rating (correction ≠ new event), and a hard delete leaves no value residue in the key.
- A version prefix allows a later rule change to be recognised.

This mirrors the Slice 3 `episode_key` lesson (C2): the user-facing identity is rule-defined, and audit identity is separate.

---

## 9. API implications

| Endpoint | Contract (provisional) |
| --- | --- |
| `GET /api/v1/aa/changes` | `from`, `to` **required** (`400 range_required`), local dates + `timezone` (IANA). Max span to be fixed by the Plan (recommend ≤ 93 days). Optional `as_of` (tz-aware). `cursor` + `limit` (≤ 200). Keyset over the deterministic sort tuple `(domain, subject_key, metric_key, kind)`, never over magnitude. Items: `change_key, domain, subject, metric_key, kind, current{value}, reference{concept,value}, delta{state,…}, direction_text, coverage, provenance, importance{value, recorded_at}\|null`. **No top-level numeric aggregate.** |
| `GET /api/v1/aa/system-review` | same window params. Response: `{window, as_of, groups:{changed[], improved[], repeated[], contradictions[], pending{reviews, experiments:{DRAFT,RUNNING,COMPLETED_AWAITING_REVIEW}}, quality[]}}`. Each group is bounded (a Plan constant) and carries a `truncated` flag. Items are **structured** (i18n on client), never HTML. Must perform **zero writes** (signals with `persist=False`). |
| `POST /api/v1/aa/importance` | body `{change_key, importance, idempotency_key}`. Route deps: `require_json_content_type`, `require_aa_write_enabled`. Handler: `enforce_same_origin`. Ownership from session only. `422 invalid_importance`. Replay → 200 + `replayed:true`. Unknown `change_key` shape → `422 invalid_change_key`. |
| `POST /api/v1/aa/cross-references` | body `{from:{kind,ref}, to:{kind,ref}, relation, note?, idempotency_key}`. Same guards. `422 causal_relation_forbidden` for any causal-family relation (explicit denylist checked **before** the allow-list → stable code). `422 invalid_relation` otherwise. `404` if a referenced subject is not this account's. Self-reference → `422 self_reference`. |
| (retract cross-ref) | Plan decision: `DELETE /api/v1/aa/cross-references/{id}` (tombstone), or register in `FACT_TABLES` and reuse `DELETE /aa/facts/{table}/{id}`. The latter is recommended because it inherits receipts. |

Error envelope `{code, message}`. The Slice 3 regression still applies: wrong Content-Type must return **415 before body parsing**.

---

## 10. Frontend / product implications

- **Pages:** `TradeoffPage.jsx` (J1) and `SystemReviewPage.jsx` (J2), reachable only behind `ANALYTICS_ROUTE_ENABLED`. **Component:** `AAImportance.jsx`, a menu with `role="menu"`, `menuitemradio`, `aria-checked`, Escape/outside-click close, focus return and `placement="left"`.
- **Reuse:**
  - `AAProvenance` on every card;
  - `AAQualityStrip` for quality;
  - `AADelta` **only** when the server returns `delta.state == 'known'` (same type and unit);
  - `AAFacts` for categorical or incompatible juxtaposition;
  - `AAHistoryList` for recurrence detail.
- The contradiction pair uses `.aa-pair`, **not** `AADelta`, because it is not "X vs Y, difference Z".
- **Standing copy:** «Общего балла нет и не будет», «Это не вердикт», the improved-rule note, «Нечего показать за период.» for empty groups, and the boundary note (Home / GTD).
- **Honesty about domains.** The seed's work hours, tasks closed, sleep and energy have **no AA facts** on the baseline. The pages must render only existing domains (finance, project, and later experiment/review/observations). Empty groups show the accepted empty copy and are never filled with fixtures.
- **Do not port** `dangerouslySetInnerHTML`. Emphasis comes from structured fields; strings live in ru/uk dictionaries, following the `AASignalCard` pattern.
- **Port the J CSS** (`.aa-banner`, `.aa-changes`, `.aa-change*`, `.aa-pair*`, `.aa-sr-*`, `.aa-checkline`, `.aa-checkbox`, `.aa-menu*`) with the `.aa-narrow` single-column rules. No demo chrome (T-16). Responsive: 2-col → 1-col under narrow, and the pair collapses.
- **Importance must never sort, filter-by-default or weight anything.** It is displayed beside the card and nothing else.
- «Что это значит для меня» / «Вывода нет» / «Что я решаю поменять» / «сохранить обзор» depend on OD-7.2. «Ничего не выбрано — это нормальный итог» and «Вывода нет» must be savable, valid end states.

---

## 11. Durable-write implications

| Write | Strategy | Rationale |
| --- | --- | --- |
| importance | **durable queue**: `operation_type 'importance.set'`, route `/api/v1/aa/importance`; key generated at enqueue; server append-version under `pg_advisory_xact_lock(user, 'aa_importance_ratings', change_key)`; replay returns the existing row | D5: user-entered AA facts survive offline. Unlike a signal ack (Slice 3, not queued), importance does not depend on a fingerprint that may go stale, so replay later is truthful. Single-flight order means the user's last choice on a device wins |
| cross-reference | **durable queue**: `'cross_reference.create'`; client pre-validates the relation against the same allow-list so a causal value is never enqueued; if one is, `422` → `failed_permanent` dead letter, surfaced | append-only, idempotent; natural-duplicate pair returns the existing row |
| UI state | optimistic from the pending queue record, reconciled on flush; `409/422` surfaced (no silent drop) | existing coordinator semantics |
| T-12 | a snapshot 409 must not pause these writes | reuse existing test pattern |

Cross-device last-writer: the server orders by `recorded_at` on arrival. This is acceptable and documented. There is no CAS on importance, because a rating is a preference, not a counter.

---

## 12. Export / privacy / delete implications

- **Registries:** add both models to `models/__init__.py`, `EXPORT_TABLES`, `TRUNCATED_TABLES`. The existing guards (`validate_export_registry`, `test_every_mapped_table_is_either_cleaned_or_seeded`, `test_all_analytics_tables_exist_with_a_cascade_from_users`) will fail until they are added. That is the desired forcing function. Goal: `mapped aa_* == EXPORT_TABLES == real DB aa_*`.
- **Account erasure:** `user_id … ON DELETE CASCADE`, so the existing residue test covers them once they are registered.
- **Per-fact hard delete (D1):**
  - importance and cross-references **store no source values**, and change keys are value-free;
  - cross-references reference `change`/`subject`, not fact ids, so a fact hard delete leaves them valid;
  - the change renders «источник удалён» or disappears.
  - If the Plan allows `fact` refs, it must add a `SOURCE_REDACTORS` adapter that tombstones or removes the reference in the same transaction, with a residue-scan test.
- **Privacy:** notes are user text and are exported. The server generates no prose.

---

## 13. Temporal / as-of implications

- The window is local dates + IANA timezone. Future days in the window are `future`, never missed or zero, so partial windows render «рано судить».
- `as_of` is the belief instant, and every input read goes through `apply_as_of`:
  - Finance totals resolve policy as-of (C7, existing `aa_finance`), never the current snapshot policy;
  - grounding resolves as-of, so a Target set after the window does not retro-ground (current snapshot policy ≠ historical policy);
  - importance resolves as-of too, so its history is preserved.
- Pending experiments as-of need lifecycle-transition timestamps from Slice 6. If only a current column exists, the response marks `pending.as_of_supported=false` and uses current state.
- Recurrence compares ≥2 **prior** windows of equal length. A window with unknown coverage cannot count as a recurrence instance; it is disclosed instead.

---

## 14. Migration implications

- **M7 is one additive revision** creating `aa_importance_ratings` + `aa_cross_references`, with indexes and CHECKs rendered from `StrEnum` via `check_in` (enum/CHECK parity test).
- `down_revision` = the **actual** head after Slices 4 and 6 (expected M6). It is unknown now and must be re-read with `alembic heads`. Slice 5 is planned with no migration.
- Linear chain only (R10). Do not create the revision until predecessors have merged.
- Downgrade is `DROP TABLE`, permitted **pre-write only** (C8).
- No change to pre-AA tables. `schema_version` stays 2.
- Test DB: `lifeos_test` only.

---

## 15. Test strategy implications

Minimum set (backend `test_aa_system_review.py`, `test_aa_no_global_score.py`, `test_aa_importance.py`, `test_aa_cross_references.py`; frontend `analytics-system-review.test.jsx`, `analytics-importance.test.jsx`).

**Pending (T-09):**
- allow-list exact;
- ABANDONED not pending;
- REVIEWED not pending;
- an unknown future lifecycle value is not pending.

**No global score (T-10):**
- introspect every `aa_*` table: no column named or like `score|weight|priority|rank|total|composite`;
- M7 tables have no numeric column;
- the `/changes` and `/system-review` JSON has no top-level numeric aggregate;
- no ordinal mapping of importance exists (AST grep);
- item order is invariant under permuting magnitudes, importance and materiality.

**No cross-unit arithmetic:** money UAH vs duration, and scale with differing bounds, yield `not_applicable`, never a number. A frontend test asserts no reduction across cards.

**Improved:**
- Expectation-only → not improved (T-01 extension);
- Forecast-only → not improved;
- positive delta with no grounding → changed only;
- a window-mismatched Target does not ground;
- an `is_explicitly_absent` Target does not ground;
- Preference with Baseline grounds;
- directional Decision grounds (after Slice 4), while a NULL or `inconclusive` decision does not;
- an unfavorable result is not improved;
- partial coverage → not improved and disclosed;
- the resolver import graph excludes the expectation and forecast modules;
- basis is present in every improved item (schema + render test).

**Contradictions:** coexist; no `winner`/`resolution`/`net` field; ungrounded up/down is not a contradiction; both bases are rendered.

**No causal assertion:**
- copy scan for causal verbs in ru/uk strings;
- the overlap note always carries «причинная связь не проверялась»;
- no cross-reference row is created by any read or derivation (row-count before/after GETs).

**Cross-references:** user-created only (`created_by='user'` CHECK); causal family → `422 causal_relation_forbidden`; self-reference rejected; foreign subject → 404.

**Importance:** default undecided (no row → `none`); not inferred from delta sign, materiality or severity; explicit `none` ≠ no row; revision history retained; as-of.

**No conclusion / no adjustment:** saving with nothing filled is valid (per OD-7.2 home).

**Structural and access:**
- `/changes` without from/to → 400; span cap enforced; keyset stable under concurrent appends;
- isolation: cross-account 404, body `user_id` rejected, 415 before 422;
- write gate closed → no writes;
- GET writes nothing (row counts, including `aa_signal_episodes`).

**Durability:** offline importance/cross-ref survives restart and replays once; snapshot 409 independence (T-12 pattern).

**Export and erasure:** registry parity; export contains both tables including superseded rows; account delete leaves zero rows.

**Frontend:**
- RU/UK strings exist for every new key;
- `role`/`aria` on the importance menu, keyboard close;
- narrow layout collapses;
- no demo chrome;
- empty group copy.

**Migration:** M7 up/down on `lifeos_test`; enum/CHECK parity.

---

## 16. Concurrency / idempotency implications

- **Importance:** advisory-lock grain `(user_id, table, change_key)` plus a partial unique `WHERE status='active'` backstop. `IntegrityError` → replay lookup. `UNIQUE(user_id, idempotency_key)` handles replay. Concurrent tabs are safe via the Web Locks leader or server idempotency.
- **Cross-references:** `UNIQUE(user_id, idempotency_key)` plus a partial unique active pair. A concurrent duplicate returns the existing row (200, `replayed`), not 409.
- **Reads:** a repeatable-read snapshot per request is recommended, so the groups do not tear across a concurrent correction (mirrors the export).
- `evaluate_signals` is read-only in this path (`persist=False`), so there is no episode write contention from System Review.

---

## 17. Risks / ambiguities / hidden coupling

| # | Risk | Mitigation |
| --- | --- | --- |
| R7-1 | **Directional Decision may not exist** after Slice 4 (`choice` has no direction) | Re-verify. If absent, Decision is simply not a grounding source; improved uses Target/Preference only and the gap is documented. Never infer direction from `keep`/`reject` |
| R7-2 | **GET writes rows** via `evaluate_signals(persist=True)` | `persist=False` + row-count test |
| R7-3 | **Hidden score via ordering** (by \|delta\|, materiality, importance) | Deterministic structural sort + permutation test |
| R7-4 | **Percent changes are dimensionless** («+24%») and invite cross-card comparison or summing | Emit relative change only as a presentation of one metric's own delta, carrying `metric_key` + base unit; never a standalone numeric type; no aggregate endpoint |
| R7-5 | **Fixture leakage**: the seed domains (hours, tasks, sleep, energy) are not in AA | Render only real domains; empty-state copy |
| R7-6 | Seed `improved` item needs Experiment adherence + Preference linkage | Only after Slice 6; otherwise not reproducible, so no fake |
| R7-7 | «Что повторилось» could become a hidden fifth rule set | Restrict to recurrence of existing derivations; owner gate for any new pattern |
| R7-8 | «Что я решаю поменять» seed list = system recommendations if generated | OD-7.2; non-scope: no AI or recommendations |
| R7-9 | Grounding logic is duplicated if System Review re-implements it | Extract `resolve_grounding` from `subject_summary` with no behaviour change |
| R7-10 | N+1 cost of calling `subject_summary` per subject (it caps at 200 rows each) | Window-scoped batch queries; bounded groups with `truncated` |
| R7-11 | Migration head race with Slices 4/6 | Create M7 only after both merge |
| R7-12 | Cross-refs pointing at fact ids create D1 residue | Refs limited to change/subject, or a redactor adapter |
| R7-13 | `system:window` is already in `SUBJECT_REGISTRY` without a table using it | Use it only if OD-7.2 chooses Review reuse; otherwise leave it inert |
| R7-14 | Importance history vs "upsert" wording in plan §21.2 | Append-version with supersession satisfies both (one live row; history kept) |

---

## 18. What MUST be re-verified after predecessor merge

1. `aa_decisions` schema: is there a direction column? What are the `choice` values, the scope columns (review/experiment) and the M6 CHECK widening?
2. Slice 4's definition and query for **"review available"** (the pending review count), and whether it added any rule (the master context says four).
3. Whether `aa_reviews` can take subject `system:window` and hold free text, a no-conclusion flag, and user adjustments (OD-7.2 path A).
4. `aa_experiments.lifecycle` exact values/CHECK; terminal states; **transition timestamps/history**; the abandon date; adherence classification API.
5. Linkage between a Preference/Target and an Experiment subject (the seed's improved item).
6. The Slice 5 dual-delta helper's name/signature and the project change card shape.
7. `SOURCE_REDACTORS` registration shape after Slice 4.
8. Actual `alembic heads` (M5/M6 ids) → M7 `down_revision`.
9. `EXPORT_TABLES` / `TRUNCATED_TABLES` contents after Slices 4/6.
10. Queue/coordinator changes (any new status codes, e.g. 415/403 handling).
11. Master context says Slices 4, 5 and 6 are complete; test baselines re-run.
12. Frontend: the pages/components added by 4/5/6 (e.g. `ReviewPage`, `ExperimentPage`, `AAFactorTag`) and any J CSS already ported.

---

## 19. Owner decisions

**OD-7.1 — Cross-reference relation vocabulary and creation affordance.** *Required before the final Plan.*

The frozen J design contains **no UI for creating a cross-reference** and **no relation vocabulary**. The Plan fixes only the table, the endpoint and `causal_relation_forbidden`. Choosing the relation values is product semantics.

- **Recommended default:**
  - allow-list = `{'related'}` («связаны — по моему мнению»), plus an optional user note;
  - causal family denylisted with the stable 422;
  - Slice 7 ships storage + API + **rendering** of existing references;
  - creation is a single minimal «связать» action on a change card, **or** API-only if the owner prefers zero UX delta to the frozen package.

**OD-7.2 — System Review save, «Что это значит для меня», «Вывода нет» and adjustments: persistence home and candidate source.** *Required before the final Plan.*

The frozen J2/J1 include a savable review with free text, a no-conclusion toggle and a user-owned adjustments checklist. The expected M7 has only two tables. The seed pre-fills adjustment candidates, and a generated list would be a system recommendation (non-scope).

- **Recommended default:**
  - **(A)** persist as a Slice 4 `aa_reviews` row with subject `system:window` (free text; the no-conclusion flag, if Slice 4 has it; adjustments as user-authored items);
  - adjustment candidates come **only** from user-authored text, optionally prefilled from the user's own earlier Review decisions, **never** generated;
  - if Slice 4's schema cannot hold this, choose between an extra M7 table (deviating from the "two tables" expectation) and non-persisted J2 reflection.

**Resolved conservatively by this Discovery (owner may override):**
- «Что повторилось» uses only recurrence of existing derivations; no new rule catalogue.
- Importance vocabulary = the frozen `none|matters|ok|ignore`, with default undecided = no row.

---

## 20. Implementation-planning readiness

- **Provisional Plan can be written now:** file list, M7 table shapes, API contracts, read-model algorithms, durable-write strategy, test matrix, and export/erasure wiring are all determinable from the baseline + Plan.
- **The final Plan requires** Slices 4, 5 and 6 merged, the §18 items re-verified on the then-current main, and OD-7.1 / OD-7.2 answered.
- **Implementation must not start** before that re-verification.

### Required explicit answers

```
GLOBAL_SCORE_STRUCTURALLY_AVOIDABLE=YES
CHANGES_READ_MODEL_CURRENT_INPUTS=finance.monthly_spend actual (as-of policy, C7) vs expectation-in-force and vs prior window; expectation version revisions; target set/revised/explicitly-absent; preference records; project forecast versions + completion measurement (date deltas); subjective observations (scale same-bounds / categorical juxtaposition); source-coverage claims (quality); signal episodes (recurrence + stale/partial quality only)
CHANGES_READ_MODEL_FUTURE_INPUTS=Slice 4 reviews (pending count) + decisions (directional grounding if a direction field exists); Slice 5 dual-delta project helper; Slice 6 experiment lifecycle transitions, adherence (elapsed-day counts), experiment observations
SYSTEM_REVIEW_DEPENDENCIES_ON_SLICE_4=aa_decisions schema + direction field (improved/contradiction grounding); "review available" definition (Ждёт вас · ревью); aa_reviews subject system:window capacity for saving the System Review (OD-7.2 path A); SOURCE_REDACTORS registration shape
SYSTEM_REVIEW_DEPENDENCIES_ON_SLICE_6=aa_experiments.lifecycle values/CHECK (allow-list DRAFT,RUNNING,COMPLETED_AWAITING_REVIEW; REVIEWED & ABANDONED terminal/not pending); lifecycle transition timestamps for as-of pending; adherence classification (future≠missed); experiment↔preference linkage for grounded improved; M6 head id
M7_EXPECTED_TABLES=aa_importance_ratings, aa_cross_references (no score table, no optimization table, no numeric columns)
IMPORTANCE_DURABLE_WRITE_STRATEGY=IndexedDB AnalyticsWriteQueue op 'importance.set' → POST /api/v1/aa/importance; idempotency key at enqueue; server append-version with REVISION supersession under advisory lock (user, change_key); partial unique one active row per change_key; replay → existing row 200; single-flight order = last device choice wins
CROSS_REFERENCE_DURABLE_WRITE_STRATEGY=IndexedDB queue op 'cross_reference.create' → POST /api/v1/aa/cross-references; key at enqueue; client pre-validates relation allow-list; append-only, active-pair unique → replay/duplicate returns existing row; causal relation → 422 causal_relation_forbidden → failed_permanent dead letter surfaced; retraction via tombstone
PREDECESSOR_DETAILS_TO_REVERIFY=aa_decisions direction field + choice vocab; review-available definition; aa_reviews system:window capacity; aa_experiments lifecycle + transition history + abandon date; adherence API; experiment↔preference linkage; Slice 5 helper signature; SOURCE_REDACTORS shape; alembic head (M5/M6 ids); EXPORT/TRUNCATE registries; queue status handling; master-context slice status; test baselines
SLICE_7_PROVISIONAL_PLAN_CAN_BE_WRITTEN_NOW=YES
```

---

```
DISCOVERY_STATUS=PASS
BASELINE_SHA=ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef
OWNER_DECISION_REQUIRED=YES
PREDECESSOR_MERGE_REQUIRED_FOR_DISCOVERY=NO
PREDECESSOR_MERGE_REQUIRED_FOR_PLAN=YES
PLAN_CAN_START_NOW=YES
PLAN_MUST_REVERIFY_AFTER_MERGE=YES
PRODUCTION_FILES_CHANGED=NO
GIT_BRANCH_CHANGED=NO
COMMIT_CREATED=NO
PR_CREATED=NO
```

`PLAN_CAN_START_NOW=YES` refers to a **provisional** plan only. OD-7.1 and OD-7.2 carry recommended defaults and must be confirmed before that plan is final.
