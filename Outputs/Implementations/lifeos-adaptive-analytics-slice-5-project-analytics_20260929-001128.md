# LifeOS — Adaptive Analytics Slice 5 · Project Analytics (G)

Implementation report · 2026-09-29 · Europe/Kyiv

---

## 1. Start state and process

| | |
| --- | --- |
| Checkout | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` (single worktree) |
| Start `main` = `origin/main` | `63e41adebf22400dca3e30330bb347f4feef6027` (PR #14 merge; PR #12 Slice 4, PR #13 hardening are ancestors) |
| Branch | `feat/adaptive-analytics-slice-5-project-analytics` |
| Recovery stash | `51184836ace557fbd9492527bd845329b17b2a76`, untouched |
| Frozen tag | `adaptive-analytics-design-accepted` → `6c507b82…` / `d4960286…`, untouched |
| Baseline | backend 400 passed · frontend 283 passed · Alembic `20260928_0006` head/current |

Process: reconcile existing Discovery → final Plan → implementation → validation.

- Parallel Discovery (outside the repo, baseline `ea3a75e1`) read in full and reconciled:
  `Outputs/Discoveries/lifeos-adaptive-analytics-slice-5-project-analytics-targeted-discovery_20260928-234416.md`
  (`K2_SIGNAL_DEFECT=RESOLVED`, `OWNER_DECISION_REQUIRED=NO`).
- Plan: `Outputs/Plans/lifeos-adaptive-analytics-slice-5-project-analytics-plan_20260928-234416.md`
  (`PLAN_STATUS=COMPLETE`, `OWNER_DECISIONS_OPEN=0`, Option A).

Commits:

| SHA | Commit |
| --- | --- |
| `93bbfe7` | Add Slice 5 project analytics reconciled discovery and plan |
| `6eb72ea` | Add read-only Project Analytics endpoint with forecast history and dual delta |
| `d217fbb` | Add Project Analytics page with forecast history, separate Actual and neutral dual delta |
| `52be7c3` | Polish Project Analytics header navigation and narrow layout after browser QA |
| (this commit) | Implementation report, module map, master context |

The backend tests and service landed in one commit (a test-only commit would have
been red). The frontend surface is one commit: its pure test already asserts the
route-registry dispatch, so a split would have left a red intermediate commit.

## 2. Read API — Option A

```
GET /api/v1/aa/projects/{project_id}/analytics[?as_of=<offset-aware instant>]
```

- `routes/aa_projects.py` (thin) → `services/aa_project_analytics.py` (derivation)
  → `schemas/aa_projects.py` (`ProjectAnalyticsOut`, `ProjectDeltaOut`); one
  `include_router` in `main.py`.
- Session auth; no write gate (reads work with `LIFEOS_AA_WRITE_ENABLED=false`,
  tested); no Content-Type/same-origin dependency (GET).
- `:` or empty id → `400 invalid_subject`; naive or future `as_of` → `400 invalid_time`.
- A project with no facts in this account → `200`, `state = "no_facts"`. Another
  account's project with the same id produces the identical body (tested), so
  existence does not leak.
- Read-only: no `INSERT/UPDATE`, nothing cached; a test counts every AA row
  before and after reads.

`ComparisonOut` was not reused (its reference concept cannot be a Forecast).
The Phase B Plan named `aa_comparison.py` for the dual-delta helper; that module
is the append side, so `dual_delta()` lives in the new read service and calls the
unchanged `analytics/delta.compute_delta` twice.

## 3. Semantics

**Forecast version history** (same predicate as PR #14's rule):
`user_id` first · exact `project:project:<id>` · `project.completion_date` ·
`status != tombstoned` · `recorded_at <= as_of` only for as-of · `ORDER BY
recorded_at, id`. `superseded`/`REVISION` rows count; `apply_as_of` is not used
for the list. Exact count via `COUNT(*)`; list capped at 200 with
`forecast_versions_truncated`; latest fetched separately when truncated.
Same-date re-forecast = a new version.

**Actual**: `aa_measurements`, same grain; current = `status = active`; as-of T =
`known_as_of_predicate(T) AND occurred_at <= T`; order `occurred_at, recorded_at,
id` DESC (Review's order). A corrected Actual appears once (the correction);
`actual_corrections` walks `supersedes_id`, skips tombstoned rows, bounded by
`recorded_at <= T`. `actual_count` exposes an abnormal second completion instead
of hiding it. Missing Actual is `null`.

**Dual delta**: `delta_vs_first = compute_delta(actual, first)`,
`delta_vs_latest = compute_delta(actual, latest)`; canonical minutes
`+7200` / `−1440`; absent operand → `unknown/operand_absent`.

**Grounding**: none, always. `desire = desirability(actual, None) = "neutral"`,
`grounding_id/kind = null`. Expectation (T2) and a same-subject Target with a
window (T3) are both ignored — a project Target window has no accepted meaning.
Review Decisions (`keep/adjust/later/inconclusive`) carry no direction.

**State** (`evaluated_at` = as_of or now): `no_facts` · `too_early` (forecast,
no Actual, before latest `horizon_at`) · `actual_not_recorded` (after the
horizon — never "missed") · `no_forecast` · `compared`.

**Tombstone / hard delete**: tombstoned versions leave list, count, first and
latest, now and retrospectively; `withdrawn_forecast_count` reports how many
(values are already nulled by the tombstone). `delete_fact(mode="hard")` refuses
chained facts, so only a lone never-revised forecast can be hard-deleted, and it
leaves no trace — therefore the first operand is always labelled «первая
сохранённая оценка», never "first ever".

**Duration KPI**: dropped. `started_at` is snapshot current state and cannot
honour `as_of`.

**Observations**: `observation_count` counts real `aa_observations` for the
subject (as-of aware); the UI shows it only when > 0. No project Observation
writer exists, so in practice it is hidden.

## 4. Frontend

| | |
| --- | --- |
| API domain | `api/analytics/projects.ts` + `export *` line in `api/analytics.ts` |
| Repository | `AnalyticsRepository.readProjectAnalytics` (rejects a colon id) |
| Context | `AnalyticsContext.readProjectAnalytics`, `pendingProjectWrites` (reads `queue.list`; no mutation) |
| Helpers | `analytics/projectAnalytics.ts` — hash build/parse, `formatDayDelta`, date/instant formatting, `countPendingProjectWrites` |
| Page (lazy) | `pages/projects/ProjectAnalyticsPage.jsx` — effectful shell + pure exported `ProjectAnalyticsView` |
| Sections | `pages/projects/analytics/ForecastComparison.jsx`, `ForecastHistory.jsx` |
| Route | id `project-analytics` (pushed with the other analytics routes, gated by `ANALYTICS_ROUTE_ENABLED`); hash `#/project-analytics/<encodeURIComponent(id)>`; `routeRegistry.js` dispatches the family like `review/`; loader in `lazyRoutes.jsx`; one `renderRoute` case |
| Entry | `ProjectCard` «Аналитика проекта» (`analyticsEnabled`, passed by `ProjectsPage`) |
| Review seam | «Открыть ревью» via the existing `projectReviewHash(project)` exactly when `ProjectCard` shows it (analytics enabled, `status === 'completed'`). No new Review model/API |
| CSS | `src/analytics.css` Slice 5 block: `.aa-delta.is-pair`, narrow/`@media` collapse, strip cursor, header link contrast on the paradise hero |
| Locale | 55 `aa_pj_*` keys in each of `context/locale/ru.js` and `uk.js` (ru 851→906, uk 850→905; shape test updated) |

No separate Forecast History route: the version list and the separate Actual are
sections of the one page (one deep link).

Rendering rules held: operand row (first / latest in estimate style / Actual),
delta pair with `data-desire="neutral"` (known) or `"unknown"`; no sign-based
class; factual sub-lines («позже, чем 20 авг.», «раньше, чем 26 авг.»); an
explicit note that the sign is direction only; single-version note; correction
lineage («Исправлено, было: …», «исправлено вами»); `<time dateTime>` everywhere;
localized `aria-label`s on every group; forecasts «ваш прогноз», Actual
«наблюдение · завершение проекта», never «выведено».

Day grammar: `formatDayDelta` uses `t.pl('pl_day', n)` and U+2212 —
`+5 дней` / `−1 день` (RU), `+5 днів` / `−1 день` (UK). The shared
`formatDelta` is unchanged (Finance/Review byte-identical; test pins it).

Pending local writes: the page counts this project's `forecast.append` /
`measurement.append` queue records (every state) and shows a neutral
`role="status"` note; the history and the count remain server-only. The
history is re-read when the count changes (after a drain).

Not built (no truthful source): task count, «typical for me» baseline, cause,
observation count unless real rows exist, duration KPI.

## 5. Tests

**Backend 400 → 420** — `apps/api/tests/test_aa_project_analytics.py` (20), all
through the real API write paths with the semantic write clock pinned:
T1 canonical · T2 Expectation neutral · T3 Target neutral · T4 as-of (count 2,
latest 24, v3 and Actual invisible, `too_early`; before everything `no_facts`) ·
T4b correction invisible at the original's `recorded_at` · T5 correction once +
lineage · T6 tombstone middle/first (now and as-of; withdrawn 1) · T7 same-date
re-forecast · T8 no_facts / too_early / actual_not_recorded / no_forecast / one
forecast / real observation counted · T9 account isolation (identical empty body)
· T10 401, 400s, gate-closed reads, zero side-effect rows · T11 no project table,
head `20260928_0006`, export registry parity. PR #14 suites (T12) green in the
full run.

**Frontend 283 → 316** — `analytics-project.test.ts` (9: routing, RU/UK day
grammar incl. `−1 день`, unknown ≠ 0, shared formatter unchanged, pending filter,
repository GET) and `analytics-project.test.jsx` (19: canonical, Actual outside
the version list, provenance labels, no fabrication, `<time>`, full UK, every
truthful state, correction lineage, withdrawn/observations, pending note, Review
only when completed, unknown project, narrow collapse, ProjectCard entry,
no score/recommendation and no snapshot-forecast read). Pins updated: route
count 19 → 20 (`smoke`, `route-registry` + 4 new hash cases), lazy loader map,
locale shape counts.

## 6. Validation (branch head)

| Check | Result |
| --- | --- |
| `apps/api: python -m pytest` | **420 passed** (lifeos_test) |
| `apps/api: ruff check .` | All checks passed |
| `apps/api: python -m compileall app` | ok |
| `apps/api: alembic heads` / `current` | `20260928_0006 (head)` / `20260928_0006 (head)` |
| `apps/web: npm test` | **316 passed / 31 files** |
| `apps/web: npm run typecheck` / `lint` | pass / pass |
| `apps/web: npm run build` / `-- --manifest` | pass, no 500 kB warning |
| `git diff --check` | clean |
| Import cycles (static graph) | frontend 134 modules / 348 edges / **0**; backend 99 modules / **0** |
| Rule catalogue | exactly four modules in `analytics/rules/` (PR #14 T7 green) |

Bundle (default build): entry JS 319.85 → **322.11 kB** (+2.26 kB: helper module
imported by `ProjectCard`/`AnalyticsContext`, 110 locale strings); new lazy chunk
`ProjectAnalyticsPage` 9.96 kB; CSS 147.36 → 148.00 kB. With
`VITE_LIFEOS_ANALYTICS_ENABLED=true` the entry is 333.88 kB (was 331.27 kB).

## 7. Browser / visual QA

Headless Google Chrome over the DevTools protocol (Node 22 built-in WebSocket; no
dependency), production build (`VITE_LIFEOS_ANALYTICS_ENABLED=true`) served by
`vite preview`, local API on **lifeos_test**, throwaway bootstrapped QA user.
Seeded through the real API: canonical (20/24/26 Aug + Actual 25 Aug), future
forecast, passed forecast, no facts, Actual only, one forecast + corrected Actual,
unknown id. Every screen is a fresh document load (deep-link refresh semantics).

- Matrix 390 / 768 / 1440 × dark / light / paradise × 9 screens (Projects list, 7
  Project Analytics states, Review deep link) = 81, + 14 UK screens + 2 click
  flows = **95 screens, all settled, 0 console errors**.
- Canonical: `+5 дней` / `−1 день`, both `data-desire="neutral"`, «версий
  прогноза: 3 · факт отдельно»; pair row = 2 columns at 768/1440, **1 column at
  390**.
- UK (switched in Settings, client-side navigation): `+5 днів` / `−1 день`, all
  copy Ukrainian (no ы/э/ъ/ё outside seeded project titles), 0 overflow at 390.
- Clicks: ProjectCard «Аналитика проекта» → page; «Открыть ревью» →
  `#/review/new/project%3Aproject%3Aproject-qa-canonical/2026-07-12/2026-08-25`,
  Review renders.
- Pending sync, real browser: API restarted with the AA write gate closed; a
  forecast revision submitted from the Projects card stays queued (403). The page
  shows «Есть записи, ещё не подтверждённые сервером: 1…», count stays 1 and the
  latest operand stays the server's 15 Nov while the snapshot says 20 Nov.
- Horizontal overflow: none on the Project Analytics page at any width/theme.
  Paradise at 768 px overflows by 28 px on **every** route (Home, Tasks,
  Settings included) from the `ParadiseScene` backdrop layers (`ps-layer`);
  pre-existing (recorded by the hardening report), zero page elements involved.
- QA findings fixed in `52be7c3`: back link invisible on the paradise scene →
  moved into the `PageHeader` aside with hero contrast; section heads wrap at
  390 px; Review link label centred.

The only network error logged was the expected first-login `GET /api/v1/state`
404 for a brand-new account (and, in the gated run, the deliberate 403).

## 8. Invariants

No migration (`20260928_0006` remains head) · no `projects`/`aa_projects` table
(tested) · `EXPORT_TABLES` / `TRUNCATED_TABLES` / mapped AA set unchanged · snapshot
`version` 2 and server `schema_version` 2 unchanged (no snapshot code touched) ·
no write path, no queue/CAS/coordinator change · exactly four signal rules · no
dependency change · no deploy · no force-push · stash and tag untouched · no
Slice 6/7/8 work.

## 9. Deferred / backlog

1. **Project Target grounding is inconsistent across read paths** (Discovery N1):
   Review context and subject summary ground a project delta on the latest
   same-subject Target ignoring its window; Project Analytics stays neutral. No UI
   writes project Targets. Owner to decide whether a project Target is a defined
   concept; then all three should share one rule.
2. **Review's project date delta renders `−1 дней`** through the shared
   `formatDelta` (pinned by `analytics-review.test.jsx`). Fix the shared date
   branch with `pl_day` and update that pin.
3. `AAProvenance` prints raw ISO `recorded_at` and raw `source_kind` codes in
   its popover (all surfaces).
4. Paradise 768 px backdrop overflow (pre-existing, all routes).
5. A lone forecast that was hard-deleted leaves no trace; the UI already avoids
   "first ever" wording, but no gap indicator is possible without subject-level
   deletion receipts.
6. Home `project.forecast.revision` signal card could link to Project Analytics
   (navigation only; not done).
