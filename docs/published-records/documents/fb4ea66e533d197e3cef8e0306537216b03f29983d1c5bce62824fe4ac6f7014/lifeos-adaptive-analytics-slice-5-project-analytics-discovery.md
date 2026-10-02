# LifeOS Adaptive Analytics — Slice 5 · Project Analytics (G)
## Parallel targeted Discovery (read-only, pre-Slice-4-merge)

Written: 2026-09-28 · Europe/Kyiv
Mode: DISCOVERY-ONLY · parallel wave · no production change · no Git mutation

---

## 1. Executive verdict

**DISCOVERY_STATUS = PASS.**

Core Slice 5 (Project forecast history + dual delta) is fully derivable from
facts that already exist on baseline `ea3a75e1`:

- Project current state: `snapshot.projects[]` (Slice P).
- Forecast history: `aa_forecast_versions`, metric `project.completion_date`,
  subject `project:project:<project.id>` (Slice P writes, Slice 1 table).
- Actual: `aa_measurements`, same metric/subject, `source_kind = OBSERVED`.
- Date delta, desirability boundary, as-of, provenance and history reads already
  exist (Slice 0/1).

Conclusions:

| Question | Answer |
| --- | --- |
| NEW_MIGRATION_EXPECTED | **NO** |
| NEW_PROJECT_SQL_TABLE_NEEDED | **NO** |
| NEW_API_ENDPOINT_NEEDED | **UNKNOWN_UNTIL_PLAN** (the recommendation is one read-only derived endpoint; a zero-endpoint client-side option is viable too. See §9) |
| REVIEW_IS_CORE_DEPENDENCY | **NO** (Review is only an entry-point seam) |
| SLICE_5_CORE_CAN_BE_PLANNED_BEFORE_SLICE_4_MERGE | **YES** (provisional; the Review seam must be re-verified) |

Four findings the Plan must act on:

1. **Forecast versions are superseded as `REVISION`.** Every
   `POST /api/v1/aa/forecasts` supersedes the prior live version of the same
   `(user, metric, subject)` grain. The prior row gets `status = superseded` and
   `supersede_kind = REVISION`. Any query that filters on `status = 'active'`
   (including `apply_as_of(..., as_of=None)`) therefore sees **exactly one**
   forecast version. The version count must be computed over non-tombstoned rows
   regardless of `superseded` status.
2. **There is a latent Slice 3 defect caused by (1). It is outside Slice 5 scope
   and needs owner triage.** `rules/project_forecast_revision.inputs()` uses
   `apply_as_of(query, AAForecastVersion, as_of)`. On the live path
   (`as_of=None`) this keeps only `status = active`. For forecasts written
   through the real API, `rendered_values.from` is therefore always `None` and
   `revision_count` is always 1. The fingerprint also covers only the newest
   version. Slice 3 tests do not catch this because
   `tests/aa_signal_helpers.forecast()` inserts several `ACTIVE` rows directly
   and bypasses `append_version`. I found this by static reading only; I did not
   execute anything. Slice 5 must **not** copy that query.
3. **The history endpoint's `as_of` does not mean "every version recorded by T".**
   `GET /metrics/{key}/history?as_of=T` applies `known_as_of_predicate`. That
   returns only the version live at T, which is at most one forecast per grain.
   A truthful "forecast history as believed at T" needs
   `recorded_at <= T AND status != tombstoned`, without the
   not-yet-superseded filter.
4. **The AA frontend primitives and the date-delta formatter are RU-only.**
   `formatDelta(…, true)` returns `"−1 дней"`, which is ungrammatical, and
   `AADelta`, `AAHistoryList`, `AAProvenance`, `AAQualityStrip` and
   `analytics/labels.ts` all hardcode Russian strings. Slice 5 requires RU/UK,
   so the Plan must decide how the reused primitives receive localized copy.

There are no owner decisions that block the Plan. Three product defaults
(§19) are recorded with conservative recommendations.

---

## 2. Baseline SHA actually inspected

- `BASELINE_SHA = ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef`. I verified it
  with `git cat-file -t` → `commit`. It is PR #11, "Correct stale M4 migration
  state in master context". Its first parent is the Slice 3 merge `99f0709`.
- All code, reports and plans were read **from Git objects** with
  `git show ea3a75e1…:<path>`, `git grep … ea3a75e1` and `git ls-tree`. I never
  read them from the working tree.
- Working-tree state observed during this Discovery. It is recorded only to
  document concurrency and was **not** used as a source:
  - `HEAD` → `refs/heads/feat/adaptive-analytics-slice-4-reviews` at
    `e243da757dbbd81904c83a167154f51cf284de27`. A concurrent Slice 4 session
    committed there.
  - `refs/heads/main` = `refs/remotes/origin/main` = `ea3a75e1…`, per the last
    fetch.
  - I read nothing from the Slice 4 branch. Its contents are
    `UNKNOWN_UNTIL_PREDECESSOR_MERGES`.
- Frozen design: tag `adaptive-analytics-design-accepted` → tag object
  `6c507b82…` → commit `d4960286…`. Both were verified and neither was moved. I
  read the design via `git show adaptive-analytics-design-accepted:<path>`.

---

## 3. Source authority list

Authority order (Master Context §14): owner decision > merged code > accepted
report > Phase B Plan > Discovery > comments > prototype.

| Source (at `ea3a75e1`) | Used for |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md` | policy, invariants, Slice P/3 state, roadmap |
| `Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` §16, §21, §24.6–24.8, §25–27 | Slice P / 4 / 5 contracts, endpoint map, file manifest, test matrix |
| `Outputs/Discoveries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md` §CORRECT vs SUPERSEDE | revision ≠ correction semantics |
| `Outputs/Implementations/…slice-p_20260928-090144.md` | Project write semantics, explicit non-scope |
| `Outputs/Implementations/…slice-3_20260928-151155.md` §23–24 | project signal rule, known limitations (R4: projects have no coverage denominator) |
| `Outputs/Implementations/…slice-1_20260918-165431.md` | M3 concepts, primitives |
| Backend code: `app/analytics/{asof,delta,subjects,values,enums}.py`, `app/services/{aa_comparison,aa_subjects,aa_desirability,aa_facts,aa_signals,export}.py`, `app/routes/{aa_comparison,aa_history,aa_subjects,aa_measurements,aa_facts}.py`, `app/schemas/{aa_comparison,aa_subjects}.py`, `rules/project_forecast_revision.py`, M1 catalogue in `alembic/versions/20260909_0002_…py`, `tests/{conftest,aa_signal_helpers,test_aa_rules_project_forecast}.py` | current seams |
| Frontend code: `domain/projects.ts`, `analytics/{projectFacts,timezone,delta,labels}.ts`, `api/analytics.ts`, `repositories/analyticsRepository.ts`, `context/{AnalyticsContext,LifeDataContext,LocaleContext}.jsx`, `pages/{ProjectsPage,analytics/MetricHistoryPage}.jsx`, `components/ProjectCard.jsx`, `components/analytics/AA*.jsx`, `app/routes.js`, `App.jsx`, `Sidebar.jsx` | current seams |
| Frozen design `ui_kits/life-os-analytics/{README.md,domains.jsx,data.js}` @ tag | G surface semantics and visuals only |

---

## 4. Current baseline architecture relevant to this slice

### 4.1 Project current state (snapshot, Slice P) — AVAILABLE_NOW

`apps/web/src/domain/projects.ts`:

```ts
type LifeProject = { id; title; created_at; started_at;
  status: 'active'|'completed'|'archived';
  current_forecast_date: string|null;   // YYYY-MM-DD
  completed_at: string|null };           // ISO instant
```

`validateProjectRecord` enforces the following:
- non-empty id and title;
- valid instants;
- status in the allowed set;
- `current_forecast_date` passes `parseDateOnly`;
- an `active` project has no `completed_at`;
- a `completed` project requires `completed_at`.
- Ids are `project-<uuid>`, generated with `crypto.randomUUID`, and never
  contain `:`.

Note: the validator does **not** forbid `:` in a legacy or foreign id. A `:`
would make `validate_subject` reject the AA write. No such ids are generated,
but the Plan should add a defensive guard or test.

### 4.2 Project actions → AA facts — AVAILABLE_NOW

| Action (`LifeDataContext.jsx`) | Ordering | AA fact |
| --- | --- | --- |
| `addProject(title)` | snapshot only | none |
| `setProjectForecast(id, date)` | `setProjectForecastWithDurableIntent` → **durable enqueue first** → then snapshot `current_forecast_date` → activityLog entry `forecast_revised` | `forecast.append` → `POST /api/v1/aa/forecasts` |
| `completeProject(id)` | durable enqueue first → snapshot `status = completed`, `completed_at = now` | `measurement.append` → `POST /api/v1/aa/measurements` |
| `archiveProject(id)` | snapshot only (active or completed → archived) | none |

- Only `active` projects accept forecasts or completion.
- There is no reopen path, so there is at most one completion Actual per project
  in normal use. Corrections are possible only through the generic
  measurement-correct API. No Project UI calls it.
- The completion instant is always `new Date()` at action time, so there is no
  UI backdating. The canonical scenario (Actual 25 Aug) must therefore be built
  in tests with a controlled clock or with server-side fixtures, not through the
  UI.

### 4.3 Exact write shapes — AVAILABLE_NOW (`analytics/projectFacts.ts`)

ForecastVersion payload:
```json
{ "subject": {"domain":"project","type":"project","id":"<project.id>"},
  "metric_key": "project.completion_date",
  "value": {"type":"date","date":"YYYY-MM-DD"},
  "horizon_at": "<next Europe/Kyiv local midnight after date, IANA-resolved>",
  "provenance": {"source_kind":"USER_REPORTED",
                 "basis":"Прогноз завершения проекта пользователя",
                 "method":"MANUAL_FORECAST"},
  "idempotency_key": "<assigned at enqueue>" }
```

Completion Measurement payload:
```json
{ "subject": {…same…}, "metric_key": "project.completion_date",
  "value": {"type":"date","date":"<Europe/Kyiv local date of occurred_at>"},
  "occurred_at": "<completion instant ISO>", "occurred_tz": "Europe/Kyiv",
  "provenance": {"source_kind":"OBSERVED",
                 "basis":"Фактическое завершение проекта",
                 "method":"PROJECT_COMPLETION"} }
```

Subject key on the server is `project:project:<id>` (`SubjectRef.subject_key`,
a generated DB column). The pair `("project","project")` is in
`SUBJECT_REGISTRY`.

### 4.4 Metric catalogue — AVAILABLE_NOW

`project.completion_date` (M1 seed): `domain=project`, `subject_type=project`,
`value_type=date`, `unit_code=NULL`, `aggregation=none`,
`actual_source=observed`, `coverage_basis=NULL`, `derivation=NULL`.

Because `coverage_basis` is NULL, **coverage is not applicable** to projects.
Slice 3 report §24 item 4 confirms this: "a project lifetime has no accepted
denominator".

### 4.5 Forecast append semantics — AVAILABLE_NOW (critical)

`services/aa_comparison.append_version` for `concept="forecast"`:

- It checks idempotent replay by `(user_id, idempotency_key)`, first outside
  the lock and again under it.
- It takes a `pg_advisory_xact_lock` over the grain
  `(user, table, metric_key, subject_key)`, so revisions on one project are
  serialized.
- It finds the prior `status = 'active'` row in the same grain. The new row gets
  `supersedes_id = prior.id`. The prior row gets:
  - `status = 'superseded'`;
  - `superseded_by_id = new.id`;
  - `superseded_at = now`;
  - `supersede_kind = 'REVISION'`.
- Value columns never change.

Consequences:
- At any instant there is **one** `active` forecast per project. The version
  list is the chain of `superseded` + `active` rows, excluding `tombstoned`.
- Re-submitting the **same** date creates a new version. The count is of
  versions, not of distinct dates.
- No API corrects a forecast. A forecast can only be revised (a new version) or
  erased (`DELETE /api/v1/aa/facts/aa_forecast_versions/{id}?mode=tombstone|hard`).
  Within Project data, "correction" (`CORRECTION`) exists only for the Actual
  measurement.

### 4.6 Measurement semantics — AVAILABLE_NOW

- `POST /measurements` appends.
- `POST /measurements/{id}/correct` and
  `/measurements/by-idempotency/{key}/correct` create a corrected row. The
  original becomes `superseded` with `supersede_kind = CORRECTION`.
- `read_history` (actual layer) with `as_of=None` shows **active only**, so a
  corrected Actual appears once as its corrected value. The lineage is available
  via `supersedes_id` and via
  `GET /facts/aa_measurements/{id}/provenance`.

### 4.7 Read APIs — AVAILABLE_NOW

| Endpoint | Behaviour relevant to Projects |
| --- | --- |
| `GET /api/v1/aa/metrics/{metric_key}/history?from&to&subject&as_of&layers&limit&*_cursor` | `from`/`to` are mandatory. **actual** = measurements by `occurred_at` in range, `apply_as_of` (active only when `as_of` is absent). **forecasts** = versions by `recorded_at` in range, `status != tombstoned` (includes superseded REVISION rows), ordered `recorded_at DESC, id DESC`, `limit ≤ 200` + layer cursor. When `as_of` is set, forecasts are further filtered by `known_as_of` (only the version live at T). Auth required; no write gate. |
| `GET /api/v1/aa/subjects/{key}/summary?as_of&metric_key` | One **current** row per concept per metric. Comparison uses `current ∈ {actual, forecast, observation}` against `reference ∈ {expectation, baseline}` only. **Forecast is never a reference**, so for a Project it yields `availability = no_data`. It cannot express the dual delta. |
| `GET /api/v1/aa/facts/{table}/{id}/provenance` | Provenance, status, supersession lineage. Cross-account → 404. |
| `GET /api/v1/aa/signals` | Includes `project.forecast.revision` (see finding 2). |

`ComparisonOut.reference_concept` is `Literal["expectation","baseline"]` and
`current_concept` is `Literal["actual","forecast","observation"]`. Reusing it
for "Actual vs Forecast" would require widening the schema.

### 4.8 Delta and desirability — AVAILABLE_NOW

- Backend `analytics/delta.compute_delta(current, reference)`: for DATE it
  returns `Delta(DURATION, days × 1440, unit "minute")`. Date-only values give
  exact integer days with no DST exposure. Absent operand →
  `DeltaUnknown("operand_absent")`.
- Frontend `analytics/delta.computeDelta` gives the same result.
  `formatDelta(delta, true)` returns `"${sign}${n} дней"`: RU-only, with no
  plural agreement.
- `services/aa_desirability.desirability(actual, grounding)`:
  - `grounding=None` → `"neutral"`.
  - Grounding kinds are only `target | preference | decision`.
  - Expectation and Forecast **cannot** be passed as grounding.
  - For dates, `direction="lower"` means earlier.
- Frontend `AADelta` forces `desire = 'neutral'` unless `grounding_id` is
  present and `grounding_kind ∈ {target, preference, decision}`.

### 4.9 Frontend routing and surfaces — AVAILABLE_NOW

- **Hash router** (`App.jsx`): `readRouteFromHash` handles exactly one
  sub-route family, `medications/<id>`. The page itself parses the id from
  `location.hash` (`MedicationsPage.jsx:178`), and `setRoute` special-cases the
  `medications/` prefix. All other routes are flat ids in
  `LIFE_ROUTES` (`app/routes.js`).
- **Analytics routes** `analytics` and `analytics-history` are appended only
  when `ANALYTICS_ROUTE_ENABLED` (test mode or
  `VITE_LIFEOS_ANALYTICS_ENABLED === 'true'`).
- `MetricHistoryPage.jsx` is Finance-specific: it reads `finance.data` and has
  hardcoded RU copy. It is not a generic metric history page.
- `ProjectsPage.jsx` renders `ProjectCard` per status group through
  `PageHeader`. The Sidebar entry `projects` is in the LIFE section.
- `ProjectCard.jsx` already has date and instant formatters (locale-aware,
  `Europe/Kyiv`) and localized keys (`project_*`, RU and UK).
- `AnalyticsContext` exposes `enqueueProjectForecast`,
  `enqueueProjectCompletion`, `finance`, `signals`, `sync`, and so on. There is
  no project read state yet.
- `AnalyticsRepository.readMetricHistory` (range mandatory) and
  `readFactProvenance` exist. `api/analytics.ts` has `getMetricHistory` with
  layer cursors and `getSubjectSummary`.

### 4.10 AA primitives — AVAILABLE_NOW, with constraints

| Primitive | Reusable for G? | Constraint |
| --- | --- | --- |
| `AADelta({summary, comparison})` | Partly. It is driven by the `ComparisonOut` shape and IDs. The G design uses two 3-cell rows (operands; deltas). | Hardcoded RU labels. Reference labels fall back to «ожидалось». Delta cell uses `formatDelta` (RU, no plural). |
| `AAFacts({facts})` | Yes, for the operand row (first forecast / latest forecast / Actual) as separate facts without comparison semantics. | RU labels via `labels.ts`. |
| `AAHistoryList({facts})` | Yes, for forecast versions + Actual. It already renders «новая версия» vs «исправление» from `supersede_kind`. | Raw ISO `recorded_at` / `horizon_at` strings. RU only. |
| `AAProvenance({provenance})` | Yes. | RU only. |
| `AAQualityStrip({coverage})` | **No as-is.** With `coverage=null` it prints «покрытие неизвестно», which is wrong for a metric with no coverage basis. | Needs a project-appropriate variant or props (the design's strip is "версий прогноза · наблюдений · причина"). |

---

## 5. Planned predecessor contracts this slice depends on

| Dependency | Classification | Contract source |
| --- | --- | --- |
| Slice P Project domain + fact writes | **AVAILABLE_NOW** | merged; §4.1–4.3 |
| Slice 1 forecast/measurement tables, desirability, delta, primitives | **AVAILABLE_NOW** | merged |
| Slice 0 history/provenance/as-of reads | **AVAILABLE_NOW** | merged |
| Slice 2 durable write queue | **AVAILABLE_NOW** | merged (writes already exist; Slice 5 adds no writes) |
| Slice 3 project signal (for linking a signal → Project Analytics) | **AVAILABLE_NOW**, with finding 2 defect | merged |
| Slice 4 Review entry: `ReviewPage.jsx`, `GET /api/v1/aa/reviews/context?subject=&from=&to=`, `POST /api/v1/aa/reviews` (subject, window, context items…) | **PLANNED_PREDECESSOR_CONTRACT** | Phase B Plan §21.2, §24.6 |
| Slice 4 route id / hash shape for opening a review for a subject+window; whether the context builder includes project forecast versions and the Actual; `review-available` affordance | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | not knowable at baseline |
| Slice 4 changes to shared files (`App.jsx`, `routes.js`, `LocaleContext.jsx`, `AnalyticsContext.jsx`, `api/analytics.ts`, `analytics.css`, `main.py`, export registry, deletion hook) | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | merge-conflict surface |

The Phase B Plan lists Slice 4 as a precondition of Slice 5 (§24.8). The design
only requires Review as the «открыть ревью» action on a closed project (README
G table: "Review — «открыть ревью» (primary — project closed)"). Core analytics
therefore do not depend on Review's data model.

---

## 6. Exact current code seams (baseline)

Backend:
- `app/services/aa_comparison.py`: Plan §24.8 names this file for the
  "dual-delta helper". Existing pure pieces: `CONCEPT_MODELS["forecast"]`,
  `append_version` (write side only).
- `app/analytics/delta.py`: `compute_delta` (reuse unchanged).
- `app/services/aa_desirability.py`: `desirability`, `NormativeGrounding` (reuse
  unchanged).
- `app/analytics/asof.py`: `known_as_of_predicate`, `apply_as_of` (see finding
  3; a forecast-version-list query needs its own predicate:
  `recorded_at <= T AND status != tombstoned`).
- `app/routes/aa_history.py` / `app/routes/aa_subjects.py`: patterns for an
  authenticated read route with `_bad_request` / `_not_found` and cross-account
  404.
- `app/analytics/subjects.py`: `SubjectRef`, `validate_subject`,
  `parse_subject_key`.
- `app/main.py`: router registration (only if a new route file is added).

Frontend:
- `apps/web/src/pages/ProjectsPage.jsx` / `components/ProjectCard.jsx`: entry
  point («аналитика проекта» link per card; most meaningful when the project
  has ≥1 forecast or is completed).
- `apps/web/src/App.jsx` `readRouteFromHash` / `setRoute` and
  `app/routes.js`: sub-route family (e.g. `projects/<id>` and
  `projects/<id>/forecasts`), modelled on the existing `medications/<id>`
  precedent. Gate on `ANALYTICS_ROUTE_ENABLED`.
- `apps/web/src/api/analytics.ts` + `repositories/analyticsRepository.ts`: add
  one read function (if an endpoint is added) or reuse `readMetricHistory`.
- `apps/web/src/analytics/delta.ts`: `computeDelta` (reuse), `formatDelta`
  (needs locale- and plural-correct day formatting, e.g. `Intl.PluralRules`
  for ru/uk, without changing Finance output).
- `apps/web/src/context/LocaleContext.jsx`: new RU+UK keys.
- `components/analytics/*`, `analytics/labels.ts`: localization seam (finding
  4).

---

## 7. Exact expected future seams

| Seam | Owner slice | Slice 5 action |
| --- | --- | --- |
| «открыть ревью» button on Project Analytics for `status ∈ {completed, archived-after-completion}` | 4 → 5 | Render only if the Slice 4 review route exists on then-current main. Otherwise omit (no dead button). Pass subject `project:project:<id>` and window `[local date of started_at, Actual date]` in whatever form Slice 4's route accepts. |
| Review context content for a project subject (does `GET /reviews/context` include forecast versions + the Actual?) | 4 | Re-verify after merge. Slice 5 must not write review context itself. |
| Link from the Home `project.forecast.revision` signal card → Project Analytics | 3 → 5 | Optional. It is a navigation-only change in the signal card's action. Re-verify card props on then-current main. |
| Slice 6/7 reuse of any date-delta formatter created here | 6, 7 | Keep the helper generic (date-only operands, no project coupling). |

---

## 8. Data model implications

- **No new table and no new column.** Every datum needed is already persisted:

  | Need | Source |
  | --- | --- |
  | first forecast | earliest non-tombstoned `aa_forecast_versions` row by `(recorded_at ASC, id ASC)` for `(user, project.completion_date, project:project:<id>)` |
  | latest forecast | the single `status='active'` row of that grain. Equivalently, the newest non-tombstoned row, since REVISION supersession keeps exactly one active row. |
  | forecast count | `COUNT(*)` of non-tombstoned rows in that grain. `superseded` REVISION rows **count**; tombstoned rows do not; hard-deleted rows no longer exist. |
  | Actual | the active `aa_measurements` row of the same metric+subject (a corrected Actual resolves to its correction; the lineage is visible) |
  | project title/status/started_at | snapshot `projects[]` (current state only; never evidence) |

- **Forecast count excludes the Actual structurally.** The two concepts live in
  different tables (Plan §16.2, T-02). The count query touches only
  `aa_forecast_versions`, and no filter can confuse them. Tests should assert
  this at the table level (Actual row exists, count still 3).
- **Dual delta is derived, never persisted** (`compute_delta` is read-time; the
  `DeltaUnknown` docstring states "Rendered, never persisted").
- Duration "started → Actual" (the design's «длительность 44 дн») is derivable
  from the snapshot `started_at` and the Actual date. It is a neutral current
  view, not AA evidence. Its inclusion is optional (§19).

---

## 9. API implications

Two viable designs. The Plan chooses one, hence
`NEW_API_ENDPOINT_NEEDED = UNKNOWN_UNTIL_PLAN`.

**Option A — one read-only derived endpoint (recommended).**
`GET /api/v1/aa/projects/{project_id}/forecast-analysis?as_of=<aware ts>`. The
exact path is for the Plan to fix; it could also be
`GET /api/v1/aa/subjects/{key}/forecast-analysis`.

- Session auth, `user_id` from the session only.
- GET, so no Content-Type/same-origin guard and no write gate (matching the
  existing read routes).
- Builds `SubjectRef("project","project",project_id)` → `validate_subject` → 400
  `invalid_subject` on a colon or empty id.
- 404 (`fact_not_found` envelope) when the caller has no non-tombstoned fact for
  that subject. Unknown and cross-account ids behave identically, so existence
  does not leak.
- Response keeps concepts in separate fields:
  ```
  { subject_key, metric_key, as_of,
    forecast_versions: [SemanticOut…]  (ASC by recorded_at,id; includes superseded REVISION rows; excludes tombstoned),
    forecast_version_count,
    first_forecast_id, latest_forecast_id,
    actual: MeasurementOut | null,   // separate field, never inside forecast_versions
    delta_vs_first:  DerivedDeltaOut + desire + grounding_id/kind,
    delta_vs_latest: DerivedDeltaOut + desire + grounding_id/kind }
  ```
- Implemented by a pure helper in `services/aa_comparison.py`, as Plan §24.8
  names it. It reuses `compute_delta` and `desirability`.
- Pros:
  - one truthful as-of implementation (finding 3) instead of reimplementing
    lineage rules in JS;
  - the backend test `tests/test_aa_project_analytics.py` (Plan §24.8) exercises
    real `append_version` supersession;
  - bounded: the version list is capped. The Plan picks a cap (e.g. 200,
    matching `MAX_HISTORY_LIMIT`) and a `truncated` flag rather than silent
    loss.

**Option B — zero new endpoints.**
The frontend derives everything from
`GET /metrics/project.completion_date/history?subject=project:project:<id>&layers=actual,forecasts&from=<project.created_at>&to=<now>`.

- Works for the live view: the forecasts layer includes superseded rows.
- Does **not** give a truthful as-of forecast list (finding 3) unless as-of is
  emulated with `to=T` and no `as_of`. That emulation is wrong for rows
  tombstoned after T, which is consistent with system-wide tombstone exclusion
  anyway, and for Actual corrections made after T.
- Requires the client to reimplement first/latest/count/lineage rules and the
  desirability boundary.
- Requires `from ≤ earliest recorded_at`. Using `project.created_at` from the
  snapshot is correct because no forecast can precede creation, but it couples
  the read to snapshot state.

Either option:
- no write endpoints, so no new Content-Type/415 surface;
- **the Slice 3 fix "wrong JSON Content-Type → 415" is untouched**;
- keep the `{code,message}` error envelope and cross-account 404 parity.

---

## 10. Frontend and product implications

Surfaces (Plan §24.8 names these; the exact route ids are for the Plan):

- `apps/web/src/pages/projects/ProjectAnalytics.jsx`: per-project G page.
  Contents:
  - header: title, status, Actual date;
  - KPIs: «версий прогноза N · факт отдельно»; optional duration;
  - **operand row**: первая оценка / последний прогноз / факт, with Forecast
    cells in estimate style and the Actual solid;
  - **delta row**: к первой оценке / к последнему прогнозу, both
    `data-desire="neutral"` unless grounded;
  - project-appropriate quality strip;
  - «что менялось» history list;
  - optional Review entry (§7).
- `apps/web/src/pages/analytics/ForecastHistoryPage.jsx`: full forecast
  version list with `horizon_at` («проверяется …»), provenance chips, and the
  Actual listed separately with its correction lineage.

Truthfulness constraints versus the frozen mock (Plan outranks prototype):

- **Provenance labels.** The design shows forecasts as «выведено Life OS». Real
  Project forecasts are `USER_REPORTED` / `MANUAL_FORECAST`, so the copy must
  say user-reported (e.g. «ваш прогноз»), never «выведено».
- **Design README table vs Plan.** The README table maps "первая оценка" to the
  Expectation row. The accepted Plan §16.2 stores the first estimate as a
  **ForecastVersion**. Use the Plan: "первая оценка" = the first ForecastVersion,
  concept `forecast`. Do not write or read an Expectation for projects.
- Design elements **without a truthful data source today** must not be
  fabricated:
  - «задач 58 · 14 добавлены позже» and «Объём увеличен на 14 задач»:
    tasks-in-projects are non-scope;
  - «типично для меня +3 дня по 6 прошлым проектам»: this is a Baseline
    concept; no project Baseline exists and D3 forbids backfill;
  - «наблюдений 2» and «причина не установлена»: no project Observation writer
    exists. Render a count only if real `aa_observations` rows exist for the
    subject; otherwise omit the item or show 0 truthfully.
- **States to render truthfully:**
  - no forecast and no Actual → empty state;
  - forecasts but no Actual, before the latest `horizon_at` → deltas «рано
    судить» (future ≠ missed);
  - forecasts but no Actual, after the latest `horizon_at` → still no delta.
    Show neutral wording like «факт не записан», **never** «просрочено» or
    «missed»;
  - Actual but no forecast → «прогноз не задавался» with delta unknown
    (`operand_absent`), never zero;
  - one version → first == latest; both deltas are shown and equal, with a
    note;
  - corrected Actual → corrected value plus the «исправление» lineage.
- **Snapshot vs history divergence.**
  `snapshot.current_forecast_date` is written after durable enqueue but
  possibly before server acknowledgement. The analytics view must show
  server-acknowledged history. If the queue still holds unsent
  `forecast.append` / `measurement.append` records for this subject, show a
  neutral «есть несинхронизированные записи» note rather than a silently wrong
  count. `AnalyticsContext.sync` status is the seam.
- **RU/UK:** all new copy goes through `LocaleContext` with RU and UK keys; no
  English. The primitives' hardcoded RU (finding 4) needs one of these Plan
  choices:
  - (a) add optional localized-label props to the primitives, with the current
    RU defaults unchanged so Finance does not regress; or
  - (b) have them read `LifeLocaleContext` with RU fallback.

  Choice (a) is the smaller, Finance-safe option.
- **Day formatting:** `+5 дней` / `−1 день` (RU), `+5 днів` / `−1 день` (UK) via
  plural rules. U+2212 minus is the existing convention.
- **Responsive / a11y:**
  - two 3-cell rows collapse to six stacked cells at 390px, per the design
    (README "G · Проект, mobile");
  - existing `aa-narrow` classes;
  - native `<details>` provenance is already keyboard-accessible;
  - use `<time dateTime>` with localized visible text instead of raw ISO;
  - use `role="group"` with localized `aria-label`s.
- **Hero/PageHeader:** use `PageHeader` as `ProjectsPage` and
  `MetricHistoryPage` do.
- **Gate:** routes only when `ANALYTICS_ROUTE_ENABLED`, matching the existing
  analytics routes.

---

## 11. Durable-write implications

- **Slice 5 introduces no new writes.** It is read-only analytics over facts
  written by Slice P through the Slice 2 durable queue (IndexedDB, idempotency
  key at enqueue, FIFO, single-flight, dead-letter).
- The ordering Slice P already guarantees ("durable enqueue → then snapshot") is
  unaffected.
- No coupling between `StateSyncCoordinator` and `AnalyticsSyncCoordinator` may
  be introduced. A snapshot 409 must not affect analytics reads, and vice versa.
- The Review entry, if present, delegates to Slice 4's own write path. Slice 5
  writes nothing for it.

---

## 12. Export, privacy and delete implications

- No new AA table, so these do **not** change:
  - `EXPORT_TABLES` (`services/export.py`);
  - `TRUNCATED_TABLES` (`tests/conftest.py`);
  - model registry;
  - deletion cascade.

  The invariant "mapped AA tables == export registry == real DB AA tables" is
  preserved trivially. A regression test that re-asserts parity (existing
  `test_export.py`) is sufficient.
- Account deletion already cascades `aa_forecast_versions` / `aa_measurements`
  from `users`.
- Per-fact tombstone and hard delete: tombstoned forecasts leave the count and
  the first/latest selection. A hard-deleted forecast disappears. If it was the
  first version, "first" becomes the earliest surviving version. The UI must not
  claim "first ever" beyond what survives. Recommended copy: «первая
  сохранённая оценка» when the lineage shows a gap, or simply «первая оценка»
  with provenance. The Plan picks the copy.
- **After Slice 4:** hard delete also redacts Review context (D1). Slice 5 does
  not touch that path.
- Account isolation: every query is scoped by `user_id` first. `subject_id` is
  not globally unique, so two accounts may both hold `project:project:X`. Tests
  must assert cross-account 404 and no leakage.

---

## 13. Temporal and as-of implications

- Forecast values are date-only. `horizon_at` is the next Europe/Kyiv local
  midnight after the date (IANA). Actual `value.date` is the Kyiv local date of
  `occurred_at`. The delta is a pure date-only subtraction:
  `actual.value_date − forecast.value_date` → days, with no DST exposure.
  - Canonical: 25 Aug − 20 Aug = **+5 days**; 25 Aug − 26 Aug = **−1 day**.
  - Operand order is `current = Actual`, `reference = Forecast`, matching
    `compute_delta(current, reference)`.
- **Version ordering** is `recorded_at` (server receive time), then `id`. For
  offline writes, `recorded_at` is sync time, not tap time. FIFO replay
  preserves relative order, and that is the accepted bitemporal meaning
  ("when LifeOS recorded it"). Do not re-sort by `value_date`.
- **Truthful as-of(T)** (finding 3):
  - forecast versions known at T: `recorded_at ≤ T AND status ≠ tombstoned`;
  - latest at T: the newest such row;
  - Actual at T: measurement `known_as_of(T)` and `occurred_at ≤ T`;
  - deltas are computed from those rows;
  - `desire` stays neutral unless grounding was known at T.

  Using the history endpoint's `as_of` directly would return only one version
  and must be avoided or documented.
- `future ≠ missed`:
  - `now < latest.horizon_at` with no Actual → «рано судить»;
  - after the horizon with no Actual → still no delta and no negative wording.
- Display: date-only values formatted as UTC dates (existing
  `ProjectCard.formatDateOnly` pattern); instants in `Europe/Kyiv`.

---

## 14. Migration implications

- **NEW_MIGRATION_EXPECTED = NO.** The Alembic head stays `20260928_0005` on
  baseline. After Slice 4, the head will be Slice 4's M5 (Plan §22:
  `aa_0006_reviews`). Slice 5 must not add a revision.
- **NEW_PROJECT_SQL_TABLE_NEEDED = NO.** Project current state stays in
  `user_snapshots.payload.projects[]`. `state.version = 2` and
  `schema_version = 2` stay unchanged.
- A test should assert that no `projects` / `aa_projects` table exists in the
  mapped metadata or the real DB (the "no Project SQL table" requirement).

---

## 15. Test strategy implications

Backend (`apps/api/tests/test_aa_project_analytics.py`, lifeos_test only):

1. **Canonical scenario through the real write path.** Call `append_semantic` /
   `POST /forecasts` three times (20, 24, 26 Aug) with increasing
   `recorded_at`, then write the completion Measurement 25 Aug. Do **not** use
   the Slice 3 direct-insert helper, which bypasses supersession. Assert:
   - count = 3;
   - two rows `superseded/REVISION` + one `active`;
   - the Actual is absent from the forecast list and present in `actual`;
   - first = 20 Aug, latest = 26 Aug;
   - delta_vs_first = +5 d (7200 minute);
   - delta_vs_latest = −1 d (−1440 minute);
   - both `desire = neutral`, `grounding_id = null`.
2. Expectation cannot ground: add an Expectation on the same subject/metric →
   still neutral.
3. Allowed grounding follows existing rules: the desirability helper accepts only
   target, preference or decision. A unit test on the helper confirms that a
   Forecast or Expectation cannot be passed as grounding. Project-level Target
   grounding per §19-D2.
4. As-of truthfulness:
   - T between versions 2 and 3 → count 2, latest 24 Aug, no Actual, delta
     unknown;
   - T after completion → full result;
   - a correction to the Actual after T is invisible at T.
5. Revision vs correction: correct the Actual (`/measurements/{id}/correct`) →
   the corrected value is used once and the lineage is exposed. Count is still 3.
6. Tombstone a middle forecast → count 2 and the chain renders honestly.
   Tombstone the first → "first" moves.
7. Same-date re-forecast counts as a new version.
8. Account isolation → 404 parity; invalid subject → 400.
9. No Project SQL table; export/TRUNCATE parity unchanged; Alembic single head
   unchanged.
10. (If Option A) GET requires auth (401) and is unaffected by the write gate.

Frontend (`apps/web/src/test/analytics-project.test.{ts,jsx}`):
- pure helper tests (first/latest/count/delta/neutral) for any client
  derivation;
- RU and UK day plurals (+5 дней/днів, −1 день);
- rendering: two delta cells with `data-desire="neutral"`; the «факт отдельно»
  count; estimate styling on forecasts; the Actual not inside the version list;
- empty, early, after-horizon-no-actual, actual-no-forecast and single-version
  states;
- sub-route parsing (`projects/<id>` …) and back-navigation;
- the analytics gate hides the routes when disabled;
- Review entry: rendered only when the Slice 4 route exists (test with a stub);
  absent otherwise;
- a11y: `aria-label`s localized; provenance disclosure keyboard/Escape; narrow
  layout class applied;
- Finance regression: existing `finance-analytics` / `aa-semantic-primitives`
  tests stay green with the primitive-localization change.

Baseline suites run only on a stable checkout (not during this parallel wave).

---

## 16. Concurrency and idempotency implications

- Slice 5 has no writes, so it adds no idempotency surface.
- Server reads are consistent per request. Concurrent forecast revisions are
  serialized by the advisory lock, and each read sees exactly one `active`
  version.
- The "Actual cannot precede its own forecasts" ordering is not enforced and
  need not be. Deltas are defined regardless of recording order.
- Frontend: reads should be abortable (`AbortSignal`, the existing pattern), and
  the view should re-fetch after queue drain for the project. The trigger is
  `AnalyticsContext.sync` status, to avoid showing a stale count right after a
  local revision.
- Git concurrency: Slice 4 is actively editing shared frontend files (§5), so
  Slice 5 implementation must start from then-current main after Slice 4 merges.

---

## 17. Risks, ambiguities and hidden coupling

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| K1 | Counting via `status='active'` / `apply_as_of(None)` returns 1 version | **H** | Count non-tombstoned rows. Test through the real `append_version` path. |
| K2 | Slice 3 `project.forecast.revision` has the same K1 defect (from = None, count = 1 in production) | M (outside scope) | Report to the owner as a separate follow-up (§19-D4). Slice 5 must not "fix" it silently (no opportunistic refactoring) and must not reuse its query. |
| K3 | History endpoint `as_of` ≠ "versions known by T" | M | Option A implements the correct predicate. With Option B, document and test the emulation. |
| K4 | Primitives are RU-only; localizing them could regress Finance | M | Optional props with RU defaults; Finance tests stay green. |
| K5 | Design copy «выведено Life OS» contradicts `USER_REPORTED` provenance | M | Truthful copy per provenance. |
| K6 | Design shows task counts, a typical baseline, observations and a cause with no data source | M | Omit or render as truthful zero/absent. No fabrication. |
| K7 | `AAQualityStrip(null)` says «покрытие неизвестно» for a metric with no coverage basis | L | Project-specific strip items. |
| K8 | Snapshot `current_forecast_date` ahead of server history while the queue is pending | L | «несинхронизировано» note. Never count snapshot state as a version. |
| K9 | Hard-deleted first forecast silently changes "first" | L | Copy/lineage per §12. |
| K10 | `formatDelta` "−1 дней" grammar also affects Finance date comparisons if changed globally | L | New locale-aware formatter. Leave the Finance path unchanged unless it is proven identical. |
| K11 | Hash sub-route parsing is a special case (`medications/`) in two places in `App.jsx` | L | Generalize minimally or add a parallel `projects/` special case. Test both. |
| K12 | Merge conflicts with Slice 4 in App/routes/Locale/Analytics context/api/css | M | Plan after Slice 4 merges. Re-read those files on then-current main. |
| K13 | Project id containing `:` would fail subject validation | L | Defensive guard + test. No generated id contains it. |

---

## 18. What MUST be re-verified after predecessor merge

1. Current `origin/main` SHA and ancestry from `ea3a75e1`. Slice 4 is merged
   with a report, and the master context marks Slice 4 complete.
2. Alembic single head (expected: Slice 4's M5). Slice 5 still adds none.
3. `EXPORT_TABLES` / `TRUNCATED_TABLES` / model registry after Slice 4 (new
   `aa_review*` / `aa_decisions`). Slice 5 still adds none.
4. The Slice 4 Review route id, hash shape, accepted query/props for a
   subject+window, and whether the project subject is supported by the context
   builder. Also whether `aa_decisions` introduces a Decision grounding path
   that the dual delta must honour (Plan: Decision is an allowed normative
   source).
5. Whether Slice 4 changed `aa_desirability.desirability`,
   `ComparisonOut`/`DerivedDeltaOut`, `AADelta` or `AAHistoryList` props, or
   `analytics/labels.ts`.
6. Whether Slice 4 localized any AA primitive (it may already solve K4).
7. `App.jsx` routing / `routes.js` after Slice 4 (route list, sub-route
   handling).
8. `AnalyticsContext` / `api/analytics.ts` / `analyticsRepository.ts` exports
   after Slice 4.
9. Whether K2 (the Slice 3 revision-rule defect) was fixed by then, or an owner
   decision was taken.
10. The Slice 3 415 Content-Type behaviour remains covered by tests.
11. Recovery stash `51184836…` and the frozen tag are unchanged.

---

## 19. Owner decisions

**None blocking.** The following are recorded with a recommended default that
the Plan may adopt without owner input, because each default is the
conservative, non-fabricating choice. The owner may override.

- **D1 — "типично для меня" (Baseline) cell.** Default: **omit** in Slice 5. No
  project Baseline exists, and deriving one from past projects is a new derived
  concept that is not in the accepted Plan §24.8 gate.
- **D2 — Normative grounding for project dual deltas.**
  - Default: reuse `desirability()` unchanged and consume only an explicit,
    non-absent **Target** on the same subject+metric (or a Slice 4 Decision
    that names a direction, if it exists after merge).
  - Otherwise the result is neutral.
  - No UI in Slice 5 creates such a Target, so in practice both deltas render
    neutral.
  - Expectation and Forecast are never grounding.
  - If the Plan finds that a project Target's window semantics are genuinely
    undefined, it should keep the result **always neutral** and stop short of
    inventing a window rule.
- **D3 — Duration KPI** (started → Actual). Default: include it as a neutral
  derived value only when an Actual exists. Otherwise omit it; the Plan may also
  drop it entirely.
- **D4 — Slice 3 defect K2.** This is **not** a Slice 5 decision. It needs
  separate owner triage: fix it in a dedicated follow-up PR, or fold it into
  Slice 5 by explicit authorization. Default: report it and do not change it in
  Slice 5.

---

## 20. Implementation-planning readiness

- Architecture, data sources, derivation rules, semantics, API options, UI
  surfaces, test matrix and risks are known well enough to write a
  **provisional** Slice 5 Plan now.
- The **final** Plan (committed to `Outputs/Plans/` on the feature branch) must
  be written after Slice 4 merges. It must re-verify §18, choose Option A or B
  (§9), and settle the Review seam (§7).
- Implementation must not start before that re-verification.

Answers requested by the prompt:

```
NEW_MIGRATION_EXPECTED=NO
NEW_PROJECT_SQL_TABLE_NEEDED=NO
NEW_API_ENDPOINT_NEEDED=UNKNOWN_UNTIL_PLAN   (recommendation: one read-only GET, Option A)
REVIEW_IS_CORE_DEPENDENCY=NO
SLICE_5_CORE_CAN_BE_PLANNED_BEFORE_SLICE_4_MERGE=YES
```

Canonical scenario (derivation check):

```
Forecast 1: 20 Aug   (recorded t1)  → superseded / REVISION
Forecast 2: 24 Aug   (recorded t2)  → superseded / REVISION
Forecast 3: 26 Aug   (recorded t3)  → active
Actual:     25 Aug   aa_measurements (OBSERVED) — separate table
forecast_count  = 3
delta vs first  = 25 − 20 = +5 days  (7200 minute)  → neutral (no grounding)
delta vs latest = 25 − 26 = −1 day   (−1440 minute) → neutral (no grounding)
```

---

```
DISCOVERY_STATUS=PASS
BASELINE_SHA=ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef
OWNER_DECISION_REQUIRED=NO
PREDECESSOR_MERGE_REQUIRED_FOR_DISCOVERY=NO
PREDECESSOR_MERGE_REQUIRED_FOR_PLAN=YES
PLAN_CAN_START_NOW=NO
PLAN_MUST_REVERIFY_AFTER_MERGE=YES
PRODUCTION_FILES_CHANGED=NO
GIT_BRANCH_CHANGED=NO
COMMIT_CREATED=NO
PR_CREATED=NO
```

Note on `PLAN_CAN_START_NOW=NO`: a provisional draft could be written today. The
Plan artifact itself, however, must be based on then-current main (Master
Prompt PLAN GATE), and the Review seam plus the shared frontend files are being
changed by Slice 4 right now. So the committed Plan waits for the Slice 4 merge.
