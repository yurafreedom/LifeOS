# LifeOS Adaptive Analytics — Slice 7 · Trade-off + System Review — Reconciled Discovery

**Mode:** PARALLEL read-only reconciliation · no implementation
**Generated:** 2026-09-29 · Claude Code (Opus 5.5)
**Location:** outside Git, `/Users/yurasachenko/LifeOS/_parallel_planning/slice7/`
**Reconciles:** `/Users/yurasachenko/LifeOS/_parallel_discovery/lifeos-adaptive-analytics-slice-7-system-review-discovery.md` (old Discovery, baseline `ea3a75e`)
**Against:** pinned main `414df142700653d616016ff644bff3d9c0007540` (includes Slice 4, Architecture Hardening and Slice 5; **not** Slice 6)

---

## 1. Verdict

`RECONCILIATION_STATUS = RECONCILED_THROUGH_SLICE_5 · SLICE_6_SEAMS_OPEN`

The old Discovery survives in shape: Slice 7 is still a derived read model plus two user-owned tables. Five of its predictions changed once Slice 4 and 5 became real code:

| # | Old Discovery said | Pinned main says | Consequence |
|---|---|---|---|
| R-1 | Decision `choice` planned as `keep·modify·longer·reject·inconclusive·NULL`; a direction field might arrive | Actual `ReviewDecisionChoice = keep·adjust·later·inconclusive` + `NULL`. **No direction column** on `aa_decisions`. `DecisionScope = review` only | **Decision is not a grounding source in Slice 7.** No `NormativeGrounding("decision", …)` is constructed anywhere in the codebase; Slice 7 must not be the first |
| R-2 | "Review available" definition would come from Slice 4 | Slice 4 **deliberately did not build it** (report §2, D-5: it would have been a fifth signal rule) | «Ждёт вас · Ревью доступно» has **no source**. New owner decision **OD-7.3** (recommended: omit the count) |
| R-3 | OD-7.2 path A (reuse `aa_reviews` with `system:window`) recommended | `resolve_review_subject` accepts only `finance:period` and `project:project`; `system:window` → `422 unsupported_review_subject`. Section/role CHECKs are frozen SQL in M5 (`compare·quality·alongside`; `expected·forecast·actual·delta·target·coverage·observation`). No no-conclusion field, no adjustment concept | **Path A is not a truthful fit** without widening M5 CHECKs and adding a whole-system context builder. Recommendation flips to **path B** (see §9) |
| R-4 | `evaluate_signals(persist=False)` must be used | Confirmed, and sharper: `GET /api/v1/aa/signals` itself passes `persist=settings.aa_write_enabled`, so the *existing* GET writes episodes when the gate is open | Slice 7 must **not** copy the signals route pattern. `persist=False` hard-coded; test with gate **open** |
| R-5 | Grounding resolution lived only in `aa_subjects.subject_summary` | It now lives in **three** places with slightly different rules (§5) | Slice 7 needs one explicit resolver; which rule it adopts is a Plan decision (conservative choice recorded) |

Also changed: migration head is now `20260928_0006` (M5, file `20260928_0006_aa_reviews.py`), export/TRUNCATE registries hold 19 AA tables, and the Architecture Hardening pass introduced facades and module boundaries that Slice 7 must follow.

---

## 2. Baseline actually inspected

```
PINNED_BASELINE     414df142700653d616016ff644bff3d9c0007540  (git cat-file -t → commit)
origin/main         414df142700653d616016ff644bff3d9c0007540  (ls-remote at start and at finish)
local HEAD          414df14…, branch main, status clean  (not used as source)
design tag          adaptive-analytics-design-accepted → d4960286ec94f35472600e59c0d533dc50a64351
HEAD commit         Merge PR #15 feat/adaptive-analytics-slice-5-project-analytics
```

**Method.** `git archive 414df14 AGENTS.md CLAUDE.md LIFEOS_MASTER_CONTEXT.md Outputs apps/api apps/web/src` and `git archive adaptive-analytics-design-accepted ui_kits/life-os-analytics` extracted into this session's scratchpad. Every fact below comes from those extracts. No worktree file was used as a source, no test suite was run, no DB was contacted.

**Slice 5 merged: YES** (HEAD is the PR #15 merge; `LIFEOS_MASTER_CONTEXT.md` §36 shows `5 ✅`, NEXT SLICE = Slice 6).
**Slice 6 on baseline: NO** (no `aa_experiment*` model, no M6, `DecisionScope` has only `review`).

---

## 3. Authority order applied

owner > current code @414df14 > accepted reports (Slices 0–5, P, Architecture Hardening) > Phase B Plan (§7, §21, §22, §24.10, §27) > this reconciled Discovery > old Discovery > frozen prototype J.

No owner decision in repo settles OD-7.1, OD-7.2 or OD-7.3. The only owner text on Slice 7 is master context §8 ("no arbitrary global score across incompatible units/domains") and §41 ("Trade-offs retain incompatible dimensions. No global composite score. Contradictions can coexist. Importance should remain user-owned.").

---

## 4. Predecessor state — reverified facts

### 4.1 Slice 4 Review schema (M5 `20260928_0006`, down `20260928_0005`)

| Table | Relevant columns | Relevance to Slice 7 |
|---|---|---|
| `aa_reviews` | subject triple + generated `subject_key`, `window_start/end` (Date), `timezone`, `context_as_of`, `render_manifest` (layout only), `current_revision`, `revised_at` | subject support gated by service, not DB |
| `aa_review_revisions` | `revision`, `note_text` (trimmed, ≤4000), `idempotency_key` | free text exists, per Review |
| `aa_review_context_items` | `section` CHECK `compare·quality·alongside`; `role` CHECK `expected·forecast·actual·delta·target·coverage·observation`; value shape; `desire` only on `role='delta'`; redaction CHECKs | CHECK lists are **hard-coded SQL in M5** — widening = migration |
| `aa_review_context_sources` | `source_table` allow-list of 10 fact tables | D1 redaction linkage |
| `aa_review_factors` | `text` ≤500, `epistemic_kind`, added/retracted revision | "contributing factor", never causal |
| `aa_decisions` | `scope` CHECK `review`; `review_id`; `choice` NULL or `keep·adjust·later·inconclusive`; `revision`, `superseded_in_revision`; unique current per review | **no direction field** |

`CURRENT_DECISION_DIRECTION_FIELD = NO`.

`NULL` ≠ `inconclusive` ≠ no row — three distinct states (T-08 already covered for review scope).

### 4.2 Review route + subject support

`GET /reviews/context`, `GET /reviews`, `POST /reviews`, `GET /reviews/{id}`, `POST /reviews/{id}/revise`. Write guards are route dependencies (`require_json_content_type`, `require_aa_write_enabled`) → 415 before 422. Save = client sends `context_as_of` + fingerprint; server re-derives and stores its own items; mismatch → `409 review_context_changed`.

`resolve_review_subject`: `finance:period` → `finance_period`; `project:project` (non-empty id) → `project`; anything else → `UnsupportedReviewSubjectError`. Finance windows must equal the calendar month. `MAX_WINDOW_DAYS = 3661`.

Facade: `app/services/aa_reviews.py`; internals `app/services/reviews/{errors,values,contracts,context,persistence,redaction,read_model}.py`.

### 4.3 Signal catalogue — exactly four (test `test_the_catalogue_holds_exactly_the_four_accepted_rules`)

`finance.monthly_spend.threshold` · `project.forecast.revision` · `data.source.stale` · `coverage.window.partial`.

`evaluate_signals(..., persist: bool = True)` — default still writes. `aa_signal_episodes` columns: `episode_key, rule_id, rule_version, first_seen_at, last_evaluated_at, last_fingerprint, acknowledged_*, resolution, reopened_at, reopened_count` + subject. **There is no per-window occurrence history**, and episodes exist only for evaluations that ran with the gate open. Episode rows are therefore a *biased sample* for recurrence (see §7.3).

### 4.4 Slice 5 Project Analytics

`GET /api/v1/aa/projects/{project_id}/analytics` → `services/aa_project_analytics.py::project_analytics(db, user_id, subject, as_of, now)`. Forecast history uses the "recorded by T, non-tombstoned, including superseded" predicate (not `apply_as_of`), capped at `MAX_FORECAST_VERSIONS = 200` with `forecast_versions_truncated`. Actual = completion Measurement live at T. `dual_delta(actual, first, latest)` → two `ProjectDeltaOut`, **always `desire = desirability(actual, None) = neutral`**, `grounding_* = None`. States: `compared · no_forecast · no_facts · too_early · actual_not_recorded`. Read-only; no migration.

### 4.5 Grounding and desirability

`services/aa_desirability.py::desirability(actual, NormativeGrounding|None)`; kinds `target·preference·decision`; no grounding → `neutral`; type/unit/scale mismatch or categorical → `unknown`.

`NormativeGrounding` is constructed in exactly three places (see §5). `DesiredDirection = higher·lower` exists on `aa_targets` and `aa_preferences` only.

### 4.6 Architecture Hardening boundaries (`Outputs/architecture/module-boundaries.md`)

Backend direction `routes → services → analytics → models`. High-fan-in modules reached through facades. New AA fact table = model + migration + export registry + deletion coverage **in the same change**. Do-not-split: `aa_facts.py`, `enums.py`, `rules/*`, `aa_signals.py`, `models/*`, durable queue repositories, `analytics.css`.

Frontend: routes in `app/routes.js` (`LIFE_ROUTES` pinned), `app/routeRegistry.js`, `app/lazyRoutes.jsx`, `App.jsx::renderRoute`; analytics API facade `api/analytics.ts` with one module per domain; locale `context/locale/{ru,uk}.js` (shape pinned by `locale-shape.test.ts`); pages split into shell + internals folder.

### 4.7 Export / TRUNCATE / privacy registries

- `EXPORT_TABLES` (19 AA tables) + `validate_export_registry()` (mapped `aa_*` == registry).
- `tests/conftest.py::TRUNCATED_TABLES` (19 AA + `user_snapshots`, `sessions`, `users`), `SEEDED_TABLES = {aa_metric_definitions, alembic_version}`.
- `services/aa_deletion.py`: `FACT_TABLES`, `SOURCE_REDACTORS = (redact_review_context,)`.
- Account erasure = `users` FK cascade.

### 4.8 Frontend infrastructure

- `ANALYTICS_ROUTE_ENABLED` gates `analytics, analytics-history, review, project-analytics`.
- Queue ops in use: `measurement.append`, `measurement.correct`, `membership.set`, `policy.append`, `expectation.append`, `target.append`, project forecast/completion, review save/revise. `AnalyticsContext.enqueue(op, route, payload)`.
- Coordinator: 401 → `blocked_auth`; 400/422 → `failed_permanent`; 409 → `terminal_conflict`; network/408/425/429/5xx → backoff; anything else (403, 415, 404) → `failed_permanent`.
- `analytics.css` has `.aa-menu*` but **none** of `.aa-banner`, `.aa-changes`, `.aa-change*`, `.aa-pair*`, `.aa-sr-group/item/text`, `.aa-checkline`, `.aa-checkbox`.
- Components: `AAChart, AAChartLayers, AADelta, AAFactorTag, AAFacts, AAHistoryList, AAProvenance, AAQualityStrip, AASignalCard, useAAText`.

### 4.9 Registered metrics

Only three rows in `aa_metric_definitions`: `finance.transaction_amount`, `finance.monthly_spend`, `project.completion_date`. The frozen J seed domains (work hours, tasks closed, sleep, morning energy) have **no AA facts** — they must not be rendered.

---

## 5. Grounding: three current resolvers

| Site | Target rule | Preference rule | Decision |
|---|---|---|---|
| `aa_subjects.subject_summary` (L146–169) | as-of, not `is_explicitly_absent`, **and** `(window_start, window_end, timezone)` equal to the reference's when the reference has a window | Preference + Baseline, reference value = Baseline | never |
| `aa_finance` month (L273) | as-of via `_current_semantic` (subject = `finance:period:YYYY-MM`, metric `finance.monthly_spend`, `effective_from ≤ T`), not absent | not used | never |
| `reviews/context._target_items` (L110–134) | Target for the subject/metric, not absent | not used | never |
| `aa_project_analytics` | **not consulted** — always neutral | not used | never |

**Reconciled rule for Slice 7** (conservative, no owner semantics invented): a change is *grounded* only through a new single resolver that implements the **strictest existing rule** — the `subject_summary` rule — as-of the review instant:

1. Target: same user, subject, metric; recorded ≤ T and live at T; not `is_explicitly_absent`; if the Target carries a window, it must equal the change window + timezone; `desired_direction` non-null.
2. else Preference (live at T, `desired_direction` non-null) **paired with** a Baseline (live at T) — reference = Baseline.
3. Decision: never (R-1).

A parity test pins resolver ≡ `subject_summary` grounding for finance subjects.

**Project dates:** Slice 5 deliberately consults no grounding, while Review context does consult a Target. Slice 7 v1 keeps project cards **ungrounded (Changed only)** so the same project delta never reads "neutral" on Project Analytics and "improved" on System Review. This is a subtractive default; lifting it is an owner call recorded as open item P7-Q1 in the Plan.

---

## 6. Semantic truth matrix (reconciled)

Legend: Y · N · C (conditional) · S6 = must reverify after Slice 6.

| Concept | Changed | Grounds «Improved» | Repeated | Contradiction side | Waiting | Source today |
|---|---|---|---|---|---|---|
| Finance monthly spend Actual | Y — vs Expectation in force, vs prior month; same `(money, UAH)` only; policy resolved as-of (C7) | N (operand) | C — via re-derived existing rule | C (grounded only) | N | `aa_finance.derive_month` |
| Expectation revision | Y (version list) | **N** | C (same-direction revisions over ≥2 windows) | N | N | `aa_expectation_versions` |
| Target set / revised / explicitly absent | Y («цель не задавалась», never 0) | **Y** (§5) | N | as basis | N | `aa_targets` |
| Preference recorded | Y | **Y** with Baseline (§5) | N | as basis | N | `aa_preferences` |
| Project forecast revision | Y | **N** | C (`project.forecast.revision` recurrence) | N | N | Slice 5 helper |
| Project completion + dual delta | Y (both deltas, neutral) | N in v1 (§5) | N | N | N | Slice 5 helper |
| Observation | Y (scale same bounds / categorical juxtaposition; `explicitly_unknown` → no delta) | C — only if §5 grounding exists for the same metric; never from `epistemic_kind` | N | C | N | `aa_observations` |
| Coverage / quality | N as change | N | C (repeated partial coverage via `coverage.window.partial`) | N | N | `aa_source_coverage`, coverage report |
| Signals | N as change | **N** (materiality never grounds; T-06) | Y (recurrence of existing rules) | N | N | `aa_signals` with `persist=False` |
| Review | N | N | N | N | **no source (OD-7.3)** | Slice 4 |
| Review Decision | N | **N** (no direction) | N | N | N | Slice 4 |
| Experiment lifecycle / adherence / observations | S6 | S6 (grounding still required) | S6 | S6 | S6 allow-list | absent |

---

## 7. Group semantics (reconciled)

### 7.1 What changed
Typed change cards from real sources only. Each card keeps its own `value_type`, `unit_code`/scale bounds, subject, window, provenance and coverage. Direction is descriptive («выше», «+₴800»), never desirability. **No reduction across cards** — no sum, no count-weighted index, no percentage across metrics.

### 7.2 What improved
`change ⋈ grounding(§5) → desirability == favorable`. Excluded: Expectation-only, Forecast-only, sign-only, mismatched/absent Target, Review Decision, `unknown` (partial coverage or incompatible), `neutral`, `unfavorable`. Every item carries a mandatory `basis` (kind, fact id, direction, reference value, window, recorded_at, provenance). Partial/unknown quality → disclosed in Data quality, not improved.

### 7.3 What repeated
Only recurrence of existing derivations; **no fifth rule, no pattern catalogue**.

Reconciled correction: recurrence must not be read from `aa_signal_episodes` alone (episodes are written only when a gate-open `GET /signals` happened, so absence of a row ≠ absence of the condition). Recommended source: re-evaluate the existing four rules read-only (`persist=False`) at each prior window's as-of, for ≥2 prior windows of the same length; windows with unknown coverage are disclosed, not counted. **Must verify in Plan session** that `evaluate_signals`' `evaluation_subjects` covers a historical period when `as_of` is set to that period's end; if not, the repeated group ships limited to forecast/expectation same-direction revision recurrence, which is direct fact derivation. Seed «три инженерные задачи…» needs tasks-in-projects → out of scope, never faked.

### 7.4 Contradictions
Two changes in the same window, **both grounded**, one `favorable` and one `unfavorable`. Rendered as a pair with both bases; no `winner`, `net`, `resolution`, `tradeoff_value`. Ungrounded up/down pairs are not contradictions. Standing copy «совпадение по дням есть, причинная связь не проверялась». With today's three metrics, contradictions will usually be empty — honest empty copy «Нечего показать за период.».

### 7.5 Waiting for you
Not notifications (no badge, no push, no Home entry). Today: **no pending source exists** (Review-available not built, Slice 6 absent). After Slice 6: exact allow-list `DRAFT`, `RUNNING`, `COMPLETED_AWAITING_REVIEW`, counted **per lifecycle**, never merged; `REVIEWED`, `ABANDONED` and any unknown value are not pending (T-09 permanent). Review count governed by OD-7.3.

### 7.6 Data quality
Coverage per domain (`observed·partial·missing·unknown_coverage·future`), corrections count, legacy-import flag, policy-known, stale sources. «Неполное покрытие не заменяется нулями».

Top framing: «Это не вердикт.» (J2) and «Общего балла нет и не будет.» (J1).

---

## 8. Reading must not write

Every Slice 7 GET: no `aa_signal_episodes` upsert (hard-coded `persist=False`, **not** `settings.aa_write_enabled`), no importance, no cross-reference, no Review, no semantic fact, no coverage claim. Verified by row-count test across all `aa_*` tables with the write gate **open**.

---

## 9. OD-7.2 evidence — can `aa_reviews` hold System Review?

| Question | Answer from code | Verdict |
|---|---|---|
| Can `aa_reviews` truthfully use `system:window`? | DB accepts any subject triple, but `resolve_review_subject` raises for `system:window`; manifest `subject_kind` only `finance_period`/`project` | **No** without new service code |
| Can the context builder derive a valid system-window context? | `build_context` has two branches; items must fit `section ∈ {compare,quality,alongside}` and `role ∈ {expected,forecast,actual,delta,target,coverage,observation}` (DB CHECK). System groups (changed/improved/repeated/contradiction/pending) and a signal-recurrence item have no role; fingerprint over every domain in a month would 409 on almost any concurrent write | **No** without an M5 CHECK swap migration + new builder |
| Can revisions hold free text / no-conclusion / adjustments without abuse? | Free text: yes (`note_text`). No-conclusion: no field — using `decision.choice='inconclusive'` would conflate «Вывода нет — оставить как наблюдение» with «данных недостаточно». Adjustments: no concept — `aa_review_factors` are contributing factors with epistemic kind, not intended changes; `decision='adjust'` is a single choice, not a list | **No** — semantic abuse |

Therefore reuse (A) is not truthful; (B) derived/read-only System Review with persistence limited to importance + cross-references is the conservative recommendation; (C) a third M7 table is a schema/product expansion requiring owner approval. Detailed in the owner memo.

---

## 10. Slice 6 dependencies — `MUST_REVERIFY_AFTER_SLICE_6_MERGE`

| ID | Item | Not invented here |
|---|---|---|
| S6-1 | M6 revision id → M7 `down_revision` | UNKNOWN |
| S6-2 | `aa_experiments` final columns | UNKNOWN |
| S6-3 | lifecycle CHECK name and exact values | expected `DRAFT·RUNNING·COMPLETED_AWAITING_REVIEW·REVIEWED·ABANDONED` (master context §40), unverified |
| S6-4 | transition timestamps / history (as-of pending) | UNKNOWN; if absent, pending is "current" and the response says `pending_as_of_supported=false` |
| S6-5 | abandon semantics (date, remaining days = `future`) | UNKNOWN |
| S6-6 | adherence API / classification | UNKNOWN |
| S6-7 | experiment observation schema / linkage to Preference | UNKNOWN |
| S6-8 | decision widening (`DecisionScope`, choices) — even if widened, **no direction** unless an explicit field is added | UNKNOWN |
| S6-9 | export / TRUNCATE / redactor changes | UNKNOWN |
| S6-10 | new queue op types / coordinator handling | UNKNOWN |
| S6-11 | new frontend routes/pages/CSS already ported (e.g. `.aa-checkline`) | UNKNOWN |
| S6-12 | master context slice status + test baselines | UNKNOWN |

---

## 11. Risks (reconciled)

| # | Risk | Mitigation |
|---|---|---|
| R7-1 | Decision treated as grounding | Resolver imports only Target/Preference/Baseline models; import-graph test |
| R7-2 | GET writes episodes (existing signals route pattern) | hard-coded `persist=False`; gate-open row-count test |
| R7-3 | Hidden score via ordering | fixed structural sort; permutation test over magnitude/importance/materiality |
| R7-4 | Dimensionless % invites cross-card compare | no standalone percent field; relative change only inside one card with base unit |
| R7-5 | Fixture leakage (hours/tasks/sleep/energy) | render only real domains; empty copy |
| R7-6 | Pages disagree (Project neutral vs System improved) | project ungrounded in v1 (§5) |
| R7-7 | Episode sampling bias in «повторилось» | read-only re-evaluation per prior window (§7.3) |
| R7-8 | Generated adjustments = recommendations | OD-7.2; no generated list under any option |
| R7-9 | «Ревью доступно» invented definition | OD-7.3 |
| R7-10 | M7 head race with Slice 6 | M7 only after Slice 6 merges |
| R7-11 | Cross-refs to fact ids leave D1 residue | refs are change keys / subject keys only |
| R7-12 | Separator collision in `change_key` (`subject_key` contains `:`) | use `|` as outer separator, validate by regex |

---

```
RECONCILIATION_STATUS=RECONCILED_THROUGH_SLICE_5 (Slice 6 seams open)
PINNED_BASELINE=414df142700653d616016ff644bff3d9c0007540
CURRENT_DECISION_DIRECTION_FIELD=NO
REVIEW_AVAILABLE_DEFINITION_EXISTS=NO
SYSTEM_WINDOW_REVIEW_SUPPORTED=NO
GET_SIGNALS_ROUTE_PERSISTS_WHEN_GATE_OPEN=YES
MIGRATION_HEAD=20260928_0006
AA_TABLES_IN_EXPORT_REGISTRY=19
```
