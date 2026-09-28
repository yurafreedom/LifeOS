# LifeOS Adaptive Analytics — Slice 5 · Project Analytics (G) — Final Plan

Written: 2026-09-28 · Europe/Kyiv
Baseline: `main` = `origin/main` = `63e41adebf22400dca3e30330bb347f4feef6027`
Branch: `feat/adaptive-analytics-slice-5-project-analytics`
Discovery: `Outputs/Discoveries/lifeos-adaptive-analytics-slice-5-project-analytics-targeted-discovery_20260928-234416.md`
(reconciles the parallel Discovery at baseline `ea3a75e1`).

Slice 5 is a **read-only** analytics surface over facts Slice P already writes.
It creates no table, no migration, no write path and no new semantic concept.

---

## 1. Read API — Option A

**Selected: Option A, one derived GET.**

```
GET /api/v1/aa/projects/{project_id}/analytics[?as_of=<offset-aware ISO instant>]
```

Why not Option B: the generic history endpoint's `as_of` answers "which version
was live at T" (`apply_as_of`), so the browser cannot obtain "every version
recorded by T" from it, and first/latest/count/Actual-correction rules would be
reimplemented in JS. One server read keeps them consistent with PR #14.

Route properties:

- Session auth (`get_current_user`); `user_id` comes only from the session.
- No write gate, no Content-Type guard (GET), no same-origin check — identical to
  the existing AA read routes.
- No persistence and no side effect: the service only `SELECT`s.
- `project_id` → `SubjectRef("project", "project", project_id)` →
  `validate_subject`. Empty id or an id containing `:` → `400 invalid_subject`.
- `as_of` without an offset → `400 invalid_time`; `as_of` later than the server
  clock → `400 invalid_time` (a future instant would claim horizons had passed).
- A project with no facts in **this** account answers `200` with
  `state = "no_facts"`. Another account's project with the same id answers the
  byte-identical empty body, so existence does not leak. (A 404 would turn the
  most ordinary state — a new project with no forecast — into an error.)

Files:

| Layer | File |
| --- | --- |
| route (thin) | `apps/api/app/routes/aa_projects.py` (NEW) — reuses `_bad_request` from `routes/aa_history.py` like `aa_subjects.py` does |
| schema | `apps/api/app/schemas/aa_projects.py` (NEW) |
| derivation | `apps/api/app/services/aa_project_analytics.py` (NEW) |
| registration | `apps/api/app/main.py` — one `include_router` |

`ComparisonOut` is **not** reused: its `reference_concept` is
`expectation | baseline`, and widening it to `forecast` would change a shared
contract. A dedicated DTO states the Project semantics truthfully.

Deviation from Phase B Plan §24.8 ("dual-delta helper in `aa_comparison.py`"):
`aa_comparison.py` is the append-side module. The dual delta is two calls of the
unchanged `analytics/delta.compute_delta`, so the helper `dual_delta()` lives in
the new read service. No shared comparison code is duplicated.

## 2. Response — `ProjectAnalyticsOut`

```
subject_key                  "project:project:<id>"
metric_key                   "project.completion_date"
as_of                        echo of the query (null for current)
evaluated_at                 as_of, or the server clock for a current read
state                        no_facts | too_early | actual_not_recorded | no_forecast | compared
forecast_versions            [SemanticOut(concept="forecast")]  ASC by (recorded_at, id), ≤ 200
forecast_version_count       exact COUNT over the same predicate (not capped)
forecast_versions_truncated  count > 200
withdrawn_forecast_count     tombstoned versions of the grain recorded by evaluated_at (count only)
first_forecast               SemanticOut | null   earliest surviving
latest_forecast              SemanticOut | null   newest surviving
actual                       MeasurementOut | null   (separate field, never in forecast_versions)
actual_count                 number of current Actual rows (normally 1)
actual_corrections           [MeasurementOut]  earlier versions of `actual`, ASC by recorded_at
delta_vs_first               ProjectDeltaOut
delta_vs_latest              ProjectDeltaOut
observation_count            real aa_observations for the subject, as of evaluated_at
```

`ProjectDeltaOut = { reference_forecast_id, delta: DerivedDeltaOut, desire,
grounding_id: null, grounding_kind: null }`.

## 3. Forecast history predicate (aligned with PR #14)

```
FROM aa_forecast_versions
WHERE user_id = :user                               -- first, always
  AND subject_key = 'project:project:<id>'
  AND metric_key = 'project.completion_date'
  AND status != 'tombstoned'
  [AND recorded_at <= :as_of]                       -- only for as_of
ORDER BY recorded_at ASC, id ASC
```

- `superseded` / `REVISION` rows **count**; there is no "not yet superseded at
  T" term. `apply_as_of` is not used for the version list.
- Same-date re-forecast = a new row = a new version.
- Ordering is the recorded order; never the forecasted `value_date`.
- `first` = first row; `latest` = last row (fetched separately if truncated).
- Snapshot `current_forecast_date` is never read by the server.

`withdrawn_forecast_count` = same grain, `status = 'tombstoned'`, same
`recorded_at` bound — metadata only (tombstone already nulls values).

## 4. Actual predicate and corrections

```
FROM aa_measurements
WHERE user_id = :user AND subject_key = :key AND metric_key = 'project.completion_date'
  current:  status = 'active'
  as_of T:  known_as_of_predicate(T)  AND occurred_at <= T
ORDER BY occurred_at DESC, recorded_at DESC, id DESC   -- same order as Review's _latest
```

- A correction supersedes its original (`CORRECTION`), so the current Actual is
  the corrected row, **once**. `actual_count` exposes an abnormal second
  completion honestly instead of hiding it.
- `actual_corrections`: walk `supersedes_id` from the chosen Actual, user-scoped,
  skipping tombstoned rows, bounded to `recorded_at <= T` for `as_of`; returned
  oldest first.
- For `as_of = T` a correction recorded after T is invisible; the original is
  still `known_as_of(T)` because its `superseded_at` is after T.
- Missing Actual is `null` — never a zero date, never "missed".

## 5. Dual delta and normative grounding

```
delta_vs_first  = compute_delta(actual, first_forecast)    # Actual − first
delta_vs_latest = compute_delta(actual, latest_forecast)   # Actual − latest
```

Date-only subtraction; canonical `DURATION` in minutes (`+7200`, `−1440`).
Absent operand → `{state:"unknown", reason:"operand_absent"}`.

Grounding: **none, always** (Discovery N1). `desire = desirability(actual, None)`
= `"neutral"`. Expectation, Forecast and Review Decisions are never consulted.
No Target UI. Canonical: both `neutral`, `grounding_id = null`.

## 6. State (server-derived, `evaluated_at` = as_of or now)

| state | condition | deltas |
| --- | --- | --- |
| `no_facts` | no surviving forecast, no Actual | unknown |
| `too_early` | forecasts, no Actual, `evaluated_at < latest.horizon_at` | unknown |
| `actual_not_recorded` | forecasts, no Actual, `evaluated_at >= latest.horizon_at` | unknown |
| `no_forecast` | Actual, no forecast | unknown (`operand_absent`) |
| `compared` | both | known |

No state or copy says overdue / missed / late-is-bad.

## 7. Duration KPI — dropped

`started_at` is snapshot current state and cannot honour `as_of`; mixing it
with bitemporal AA facts would present current state as history. Not built.

## 8. Tombstone / hard delete

- Tombstoned versions leave the list, the count, first and latest, now and
  retrospectively (same as PR #14). Their number is shown, never their value.
- Hard delete of a chained version is refused by `delete_fact`; a lone forecast
  can be hard-deleted and then leaves no trace. Therefore the first operand is
  always labelled «первая сохранённая оценка» — never "first ever".
- Nothing is cached or persisted; every read re-derives from surviving rows.

## 9. Frontend

| Concern | Path |
| --- | --- |
| API domain | `apps/web/src/api/analytics/projects.ts` (NEW) + one line in `api/analytics.ts` |
| repository read | `AnalyticsRepository.readProjectAnalytics(projectId, query, signal)` |
| context | `AnalyticsContext`: `readProjectAnalytics(projectId, signal)` (read) and `pendingProjectWrites(projectId)` (reads `queue.list(user.id)`, no mutation) |
| pure helpers | `apps/web/src/analytics/projectAnalytics.ts` (NEW): hash build/parse, day-delta formatter, date/instant formatting, pending filter |
| page (lazy) | `apps/web/src/pages/projects/ProjectAnalyticsPage.jsx` (NEW, default export) |
| forecast history + Actual | `apps/web/src/pages/projects/analytics/ForecastHistory.jsx` (NEW) |
| operand + delta rows | `apps/web/src/pages/projects/analytics/ForecastComparison.jsx` (NEW) |
| route id | `app/routes.js`: `'project-analytics'` pushed with the other analytics routes (gated) |
| hash | `#/project-analytics/<encodeURIComponent(project.id)>`; `app/routeRegistry.js` dispatches the `project-analytics/` family (like `review/`) |
| lazy loader | `app/lazyRoutes.jsx`: `'project-analytics'` |
| render | one `case` in `App.jsx::renderRoute` |
| entry point | `ProjectCard.jsx`: «Аналитика проекта» link when analytics routes are enabled |
| Review seam | page shows `projectReviewHash(project)` («Открыть ревью») exactly when `ProjectCard` does: analytics enabled and `status === 'completed'` |
| locale | `context/locale/ru.js`, `context/locale/uk.js` — `aa_pj_*` keys |
| CSS | `src/analytics.css` (AA component layer): a small "Slice 5" block — `.aa-delta.is-pair`, narrow/`@media` collapse |

Separate Forecast History route: **not created**. The full version list and the
separate Actual are a section of the Project Analytics page (the design's
«история прогноза →» becomes an in-page anchor). One route, one deep link.

Rendering rules:

- `PageHeader` (title = project title from the snapshot; subtitle = status).
- Unknown project id (not in the snapshot) → honest not-found state; no fetch.
- Operand row: «первая сохранённая оценка», «последний прогноз» (estimate style),
  «факт» (solid). Delta row (pair): «к первой оценке», «к последнему прогнозу»,
  `data-desire="neutral"` when known, `"unknown"` otherwise. No sign-based class.
- Day formatting: `formatDayDelta` → `+5 дней` / `−1 день` (RU), `+5 днів` /
  `−1 день` (UK), U+2212, `t.pl('pl_day', n)`. Shared `formatDelta` unchanged.
- Sub-lines are factual and neutral: «позже первой оценки (20 авг.)», «раньше
  последнего прогноза (26 авг.)».
- One version: both cells shown, plus «одна версия прогноза — первая и последняя совпадают».
- Provenance: forecasts «ваш прогноз» (`USER_REPORTED`), Actual «наблюдение ·
  завершение проекта» (`OBSERVED`), plus the existing `AAProvenance` chip.
- Quality strip: «версий прогноза N · факт отдельно»; «наблюдений N» only when
  N > 0; «отозвано версий N» only when N > 0. No task count, no typical-for-me,
  no cause.
- Pending note (neutral) when the local queue holds `forecast.append` /
  `measurement.append` records for this subject; the page refetches when the
  count drops. Snapshot values never enter the list or the count.
- `<time dateTime>` for all dates/instants; localized `aria-label` on groups;
  narrow layout collapses rows to stacked cells.

## 10. Backend test matrix — `apps/api/tests/test_aa_project_analytics.py`

Writes go through the real API (`POST /forecasts`, `/measurements`,
`/measurements/{id}/correct`, `DELETE /facts/…`), with the semantic write clock
pinned like PR #14's suite.

| | Proof |
| --- | --- |
| T1 | canonical 20/24/26 + Actual 25: count 3; 2 superseded/REVISION + 1 active; Actual not in list; first 20, latest 26; +7200 / −1440 minutes; both neutral; grounding null; state `compared` |
| T2 | same-subject Expectation → still neutral |
| T3 | same-subject Target (explicit, with window and direction) → still neutral, grounding null |
| T4 | as_of between v2 and v3: count 2, latest 24, v3 absent, Actual absent; as_of at original Actual: correction invisible |
| T5 | correction: corrected value once, `actual_corrections` holds the original, count still 3 |
| T6 | tombstone middle → count 2 ordered, withdrawn 1; tombstone first → first = 24 |
| T7 | same-date re-forecast counts as a new version |
| T8 | missing states: no_facts; too_early; actual_not_recorded; no_forecast (delta unknown/operand_absent); one forecast + Actual |
| T9 | same project id in two accounts: no leakage, identical empty body for the other account |
| T10 | 401 unauthenticated; read works with the write gate closed; `:` in id → 400; naive/future as_of → 400; no rows written by reads |
| T11 | no `projects`/`aa_projects` table in metadata or DB; Alembic head unchanged; export registry unchanged |
| T12 | PR #14 suites stay green (run in the full suite) |

## 11. Frontend test matrix

`apps/web/src/test/analytics-project.test.ts` (pure) and
`apps/web/src/test/analytics-project.test.jsx` (render):

hash build/parse + registry dispatch; `formatDayDelta` RU/UK incl. `−1 день`,
`+5 дней/днів`, `+2 дня/дні`, `0`; canonical render (count 3, Actual outside the
version list, both neutral, no favorable/unfavorable); UK render; too_early,
actual_not_recorded, no_forecast, no_facts, single version; pending note;
provenance labels, no «выведено»; no task/baseline/observation fabrication;
Review link only when completed; unknown project; narrow class; ProjectCard
entry link; route count 19 → 20 and lazy loaders updated; existing Finance
primitive tests untouched.

## 12. Commit sequence

1. docs: reconciled Discovery + this Plan
2. backend tests (characterisation of the read contract)
3. backend: service + schema + route
4. frontend: API domain, repository/context reads, helpers, page, route
5. frontend: RU/UK copy + CSS
6. integration: ProjectCard entry, Review seam, pending note
7. docs: implementation report + master context

(Commits 2–3 may be combined if the test module cannot import a missing route
green; every commit stays green.)

## 13. Rollback points

Each commit is independently revertible. The backend endpoint is additive and
unused if the frontend commit is reverted; the frontend route is gated by
`ANALYTICS_ROUTE_ENABLED`. No data migration, so rollback never touches data.

## 14. Gate

```
PLAN_STATUS=COMPLETE
OWNER_DECISIONS_OPEN=0
IMPLEMENTATION_READY=YES
SELECTED_READ_API_OPTION=A
PROJECT_ANALYTICS_ENDPOINT=GET /api/v1/aa/projects/{project_id}/analytics
EXPECTED_DB_MIGRATION=NO
EXPECTED_PROJECT_SQL_TABLE=NO
EXPECTED_SNAPSHOT_VERSION=2
EXPECTED_SERVER_SCHEMA_VERSION=2
```
