# LifeOS — Completion-audit frontend fixes (D1, D2, D3)

Date: 2026-09-30 (Europe/Kyiv) · Branch: `fix/lifeos-completion-audit` · Base HEAD `1b396eb` · **Uncommitted working tree** · Push/PR/merge/deploy: **no**

This report covers the three frontend defects that the completion audit
(`Outputs/Implementations/lifeos-completion-audit_20260930-125002.md` §9) left open:
- D1: Project history after retention deletion.
- D2: Metric History direct entry and localization.
- D3: Paradise horizontal overflow at 768 px.

It is separate from GTD work. No GTD code was touched.

## 1. Baseline

| Item | Verified value |
|---|---|
| Checkout | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem`, single worktree |
| Branch / HEAD | `fix/lifeos-completion-audit` @ `1b396eb7ed4b7ad6a791f3bab3d316daae69dac2` (matches the reported state) |
| Publication | No remote branch (`git ls-remote` empty), no PR (`gh pr list --state all` empty). `origin/main` = `5e858bb` |
| Working tree at start | Clean except the owner's untracked `LifeOS_Completion_Audit_20260930.md` (left untouched) |
| Stash | `stash@{0}` = `51184836ace557fbd9492527bd845329b17b2a76` (recovery stash), untouched |

**Concurrent owner/agent changes during this session.** While this work was in
progress, a separate GTD session wrote three things into the working tree:
- §79 plus a pointer paragraph in `LIFEOS_MASTER_CONTEXT.md` (sha256 `4d3d35cc…addab`);
- `outputs/discoveries/lifeos-gtd-current-state_20260930-131011.md` (untracked);
- `outputs/plans/lifeos-gtd-completion-plan_20260930-131011.md` (untracked).

All three are preserved. The context file was backed up before the edit, and was
re-verified byte-identical just before the edit. The edit is confined to §78.

## 2. Root causes

### D3 · Paradise overflow — the cause was NOT the scene

The audit attributed the overflow to `ps-layer`/`ps-cloud` from bounding boxes
alone. Measured DOM geometry disproves that:

| Probe (paradise, 768 px, pre-fix build) | RU | UK |
|---|---|---|
| `documentElement.scrollWidth − innerWidth` | 16 | 25 |
| … with `#paradise-scene` `display:none` | **16** | **25** |
| … with `.ps-cloud` / `.ps-layer` / `.ps-glint` hidden | 16 / 16 / 16 | 25 / 25 / 25 |
| `window.scrollTo(10000)` → `scrollX` | 16 (real scroll) | — |
| `#paradise-scene` computed style | `position:fixed; overflow:hidden` | same |

The scene is already contained: it is a fixed element with overflow clipped, so
its oversized decorative children never reach the document's scrollable width.

The real chain:
1. `.app` is a grid of `200px 1fr`. `main.main` is a grid item with `min-width:auto`.
2. Paradise-only TopBar styles widen the greeting block:
   - `.tb-left` becomes a plate with 16 px padding plus a 1 px border;
   - `.tb-eyebrow` becomes uppercase with 0.16em tracking.
3. Next to the 280 px `min-width` search field, the TopBar's min-content becomes
   **520 px against 504 px available** (UK copy is longer, hence +25).
4. The `1fr` track grows to its min-content: `main` is 584 px instead of 568 px,
   and the document scrolls horizontally.
5. Dark/light have no plate and fit, which is why only paradise overflowed.

Hiding the scene changes nothing, and setting `main{min-width:0}` removes the
overflow (probe `overflowMainMin0 = 0`). The amount depends on the hour-dependent
greeting and the locale.

**Harness correction.** The app's locale is in-memory React state (`App.jsx`
`useState('ru')`), so every full reload returns to RU. The matrix therefore
re-selects UK after each full load and verifies both the applied theme
(`<html data-theme>`) and the locale (sidebar text) on every row.

### D1 · ForecastHistory ignored the server's retention flag

- The server (`services/aa_project_analytics.py`) sets
  `state='history_deleted_by_retention'` and `retention_history_deleted=true`
  only when a whole Project unit was erased (`pruned_project_ids`) and nothing
  survives (`no_facts`).
- It also sends `retention_horizon`.
- The TS type omitted both fields, and `ForecastHistory` rendered «Версий прогноза
  нет» / «Факт завершения не записан» for any empty array.

**Additional defect found during browser QA (D1b).** When switching from one
project's analytics to another in the same document, `ProjectAnalyticsPage`
kept the previous project's `data` until the new read resolved. So «История этого
проекта удалена…» appeared briefly under another project's title. The effect used
`setResult(previous => ({ ...previous, error: null }))`.

### D2 · MetricHistoryPage depended on prior navigation

- It read `finance.data` and never loaded it. A cold entry (`#/analytics-history`
  or a reload) therefore showed the hardcoded «История метрики пока недоступна.».
- The title, subtitle and «Назад» were hardcoded Russian.
- The shared `AAChart` label and empty caption were hardcoded Russian.
- The horizon was interpolated as raw `YYYY-MM-DD`.

A related trap: `loadFinance` left `loading:true` on `AbortError`. If the user left
the page mid-load, a return visit would wait forever, and the new
"load only if not already loading" guard would make that permanent.

## 3. Changes

| File | Change |
|---|---|
| `apps/web/src/styles/paradise.css` | For `min-width:641px`: `[data-theme=paradise] .tb{flex-wrap:wrap}` and `.tb-right{margin-left:auto}`. When the greeting plate and the search can't share a row, the search/add row wraps under the plate, still right-aligned. ≤640 px keeps its existing stretched column. No change to the scene, animations, dark/light or global `overflow`. |
| `apps/web/src/pages/projects/analytics/ForecastHistory.jsx` | `erased = data.retention_history_deleted === true \|\| data.state === 'history_deleted_by_retention'` (server semantics only). An empty section says "unavailable after retention" when erased, and "not recorded" otherwise. Records the server returns are always rendered. |
| `apps/web/src/api/analytics/projects.ts` | Type now declares the existing server fields `retention_history_deleted?` and `retention_horizon?`. |
| `apps/web/src/pages/projects/ProjectAnalyticsPage.jsx` | Adds a `resultForProject(result, id)` helper, and results are tagged with their `projectId`. A same-project refresh keeps its data; another project shows loading instead of its predecessor's state. |
| `apps/web/src/pages/analytics/MetricHistoryPage.jsx` | Cold-entry load through the existing `analytics.loadFinance(currentPeriod(), signal)`, guarded by `needsFinanceLoad` (only when ready, no data and not already loading). It adds no new client, cache or request path. Distinct loading / error+retry / empty / history views. Fully localized; the `finance.monthly_spend` id is kept verbatim, with a `<wbr>` after the dot so it wraps instead of clipping at 390 px. Horizon formatted by the existing `formatDateOnly` (UTC-anchored date-only, no zone shift). |
| `apps/web/src/context/AnalyticsContext.jsx` | `loadFinance` on `AbortError` clears `loading` (keeps data/error). |
| `apps/web/src/components/analytics/AAChart.jsx` | Default aria label and empty caption come from locale keys. The RU strings are byte-identical, so the Finance page's RU output is unchanged. |
| `apps/web/src/context/locale/ru.js`, `uk.js` | 12 new keys each: `aa_pj_no_versions_retention`, `aa_pj_actual_absent_retention`, `aa_mh_*` (8), `aa_chart_label`, `aa_chart_empty`. |
| `apps/web/src/test/locale-shape.test.ts` | Dictionary-size pin 1709/1708 → 1721/1720. The subset and ru-only-flag assertions are unchanged. |
| `apps/web/src/test/project-history-retention.test.jsx` (new) | 10 cases: RU/UK erased, ordinary empty (with and without a policy horizon), retained evidence, a retained record under the flag, copy distinctness, and the project switch. |
| `apps/web/src/test/metric-history-page.test.jsx` (new) | 11 cases: the cold-load predicate (no duplicate / no re-read), the view state machine, RU/UK loading / error+retry / empty / header / subtitle / back / chart, no RU-only letters in UK, and date-only horizon formatting. |

The erased copy says the history is **unavailable** after the retention rule. It
does not assert that a forecast or completion definitely existed:
- RU: «Версии прогноза недоступны: история этого проекта удалена правилом хранения.»
- UK: «Версії прогнозу недоступні: історію цього проєкту видалено правилом зберігання.»

## 4. RED → GREEN

- **RED.** With only the two new test files applied, **16 failed / 4 passed**. The
  failures were missing retention copy, erased sections still saying "not
  recorded", no cold-load or view helpers, the RU fallback on cold entry, the
  hardcoded header, and the raw ISO horizon. The 4 passing cases were ordinary
  empty and retained evidence, which were already correct.
- **GREEN.** After the source changes, all pass.
- **D1b.** The stale-project display was first caught in the browser: the
  `p-fresh` check failed on the pre-fix build. The regression was then added with
  the fix, and the browser check passes on the fixed build.
- **D3.** Verified in the browser only, as instructed (no CSS-declaration test).

## 5. Frontend gates

| Check | Result |
|---|---|
| `TZ=UTC npm test` | **561 passed / 45 files** (540/43 before + 21 new) |
| `npm test` (local EEST) | 561 passed |
| New suites under `TZ=America/Los_Angeles` | 21 passed |
| `npm run typecheck` / `npm run lint` | pass / pass |
| `VITE_LIFEOS_ANALYTICS_ENABLED=true npm run build -- --manifest` | pass. Entry `index-Cc-qOtWN.js` **335.57 kB** (101.45 kB gzip; +0.03 kB), CSS `index-3IlLLO-G.css` 165.68 kB (+0.12 kB), MetricHistoryPage 2.56 kB, ProjectAnalyticsPage 10.47 kB, SettingsPage 23.46 kB. No 500 kB warning |
| `git diff --check` | pass |
| Backend | **Not rerun.** No file under `apps/api` changed; the API was only started read/write against `lifeos_test` for browser QA |

## 6. Browser verification

**Setup.** The same setup as the audit, for this session only:
- analytics-enabled production build served by `vite preview` on 127.0.0.1:4173
  (the `/api` proxy is inherited);
- `uvicorn --factory app.main:create_app` on **`lifeos_test`**;
- headless Chrome over CDP, with no dependencies added.

A fresh disposable account, `qa-fe3-25ae92ce@example.com`, was seeded with the
Slice 8 `_seed_world`. `_seed_world` overwrote the seeded password, so it was
reset directly for this QA row in `lifeos_test` only. All services were stopped
afterwards.

**Same-project retention fixture (genuine).**
1. `p-done` was added to the operational snapshot (`PUT /api/v1/state` 200).
2. API state before Apply: `compared`.
3. Policy 24 months → preview (horizon `2024-09-01`) → Apply: `completed`,
   18 rows deleted, 1 project unit.
4. API state after Apply: `history_deleted_by_retention`,
   `retention_history_deleted=true`, 0 versions, no actual.
5. `p-done` is still in the snapshot.
6. Added `p-fresh` (no AA facts → `no_facts`, flag false) and `p-late`
   (completed after the horizon → retained, `compared`, 1 version + actual).

### 6.1 D1/D2 flows — 22/22 PASS, 0 console errors

1. RU and UK `p-done`: the notice plus both sub-sections say "unavailable"; no
   «нет/не записан», no «не найден».
2. RU and UK, about 60 ms after switching `p-done` → `p-fresh`: `p-done`'s notice
   is never shown under `p-fresh`'s title (D1b).
3. RU and UK `p-fresh`: «Версий прогноза нет.» / «Факт завершения не записан.»
   (UK equivalents), and no retention copy (no inference from empty arrays).
4. RU and UK `p-late`: 2 retained records rendered, and no empty or retention copy.
5. Cold direct entry `/#/analytics-history`: exactly **1** month request, then the
   localized header and history. Horizon «История до 1 сент. 2024 г. …», with no ISO.
6. `Page.reload`: loads again, 1 request.
7. In-app navigation Home → Finance analytics (1 request) → «История метрики»
   (**0** further requests: the loaded month is reused) → «Назад» returns to
   `#/analytics`.
8. UK in-app: «Історія finance.monthly_spend», «…залишаються окремими шарами»,
   «Назад», «Історію до 1 вер. 2024 р. …», and no RU-only letters.
9. Month URL blocked: the localized error «Не удалось загрузить историю метрики.»
   with «Повторить». Unblock → Retry loads the page.
10. Leaving mid-load: the month request is held via CDP `Fetch`, and the page shows
    «Загрузка истории метрики…». Navigating away aborts it. On return the page
    loads, not stuck.
11. Horizon under `America/Los_Angeles`, `Pacific/Kiritimati` and `UTC` browser
    zones: always «1 сент. 2024 г.», never 31 авг / 2 сент.
12. Paradise «Назад» is reachable by Tab with `:focus-visible` (outline
    `auto 1px`).

### 6.2 D3 overflow matrix — 0 overflow

| Run | Loads | Theme mismatch | Locale mismatch | Overflow rows | Console errors |
|---|---|---|---|---|---|
| **Before** (pre-fix build), paradise × RU/UK × 320/390/768/1440 × 8 screens | 64 | 0 | 0 | **16**: all 768 px rows, **RU +16 / UK +25** (the audit numbers reproduced exactly) | 0 |
| **After**, dark/light/paradise × RU/UK × 320/390/768/1440 × 8 screens | 192 | 0 | 0 | **0** | 0 |
| **After**, all themes × RU/UK × 641/700/820/900/1024 × 8 screens | 240 | 0 | 0 | **0** | 0 |

- **Screens:** home, tasks, projects, calendar/2026-10, settings,
  project-analytics/p-done, analytics, analytics-history.
- **Animations:** for every paradise row, every scene animation (clouds, breathe,
  glint) was scrubbed to phases 0, 0.2, 0.4, 0.6, 0.8 and 0.999 via the Web
  Animations API. The worst `scrollWidth`/`scrollX` over all phases was recorded:
  **0 after the fix** (and exactly 16 / 25 before, identical at every phase,
  confirming the animations never contributed).
- **Vertical scroll (paradise):** 320 px and 768 px scroll normally (to 400 px),
  and the add button stays inside the viewport.
- **Screenshots reviewed:**
  - paradise UK 768 home: the search row wraps under the plate, right-aligned;
  - paradise RU 1440 home: unchanged single row;
  - paradise RU 768 tasks;
  - paradise RU/UK 390 metric history: the title wraps at the dot, no clipping;
  - dark UK 1440 `p-done`: the retention notice plus "unavailable" sections.

  The full-page captures show a dark band below 900 px. That is a
  `captureBeyondViewport` artifact of the fixed, viewport-sized scene, not a
  rendering defect.

## 7. Remaining limitations (not changed here)

- **Contract limitation (D1):** the server flags a project as erased only when
  nothing survives. If a new forecast is recorded after the unit was pruned, the
  page shows only the new evidence, with no retention note for the erased earlier
  history. Handling this would need a server field; nothing is inferred.
- **Locale persistence:** the locale is in-memory app state and resets to RU on
  every reload. This is pre-existing and affects all pages, including a Metric
  History reload.
- **Metric History rows:** `AAHistoryList` (shared with Review/Finance) still
  prints `recorded_at`, `effective_from` and `horizon_at` as raw ISO instants, and
  provenance enum values (`USER_REPORTED`, `MANUAL`) are shown verbatim.
- **Finance analytics** still has hardcoded Russian text, and its
  `aa_ret_finance_truncated` horizon is raw ISO (`FinanceAnalytics.jsx:160`).
  Out of this task's scope.
- **Paradise legibility:** the retention note on Finance/Metric History sits
  directly on the scene without a card backing, and the ghost «Назад» in the hero
  is low-contrast. Both are pre-existing visual-design questions.
- **Empty-month nuance:** `metricHistoryView` treats a month with no series points
  and no expectations/targets as empty. Coverage is still shown via
  `AAQualityStrip`.
- **Analytics unavailable:** without IndexedDB, the context is never `ready`, and
  the page stays in its loading state. This is the same behaviour as other AA
  pages; the route is gated by `ANALYTICS_ROUTE_ENABLED`.

## 8. Exact changed files (uncommitted)

```text
M  LIFEOS_MASTER_CONTEXT.md   (§78 edits by this task; §79 + one pointer paragraph by the concurrent GTD session)
M  apps/web/src/api/analytics/projects.ts
M  apps/web/src/components/analytics/AAChart.jsx
M  apps/web/src/context/AnalyticsContext.jsx
M  apps/web/src/context/locale/ru.js
M  apps/web/src/context/locale/uk.js
M  apps/web/src/pages/analytics/MetricHistoryPage.jsx
M  apps/web/src/pages/projects/ProjectAnalyticsPage.jsx
M  apps/web/src/pages/projects/analytics/ForecastHistory.jsx
M  apps/web/src/styles/paradise.css
M  apps/web/src/test/locale-shape.test.ts
?? apps/web/src/test/metric-history-page.test.jsx
?? apps/web/src/test/project-history-retention.test.jsx
?? Outputs/Implementations/lifeos-audit-frontend-fixes_20260930-134139.md   (this report; on disk under lowercase outputs/)
```

The following are not part of this task and are left untouched:
- `LifeOS_Completion_Audit_20260930.md` (owner);
- `outputs/discoveries/lifeos-gtd-current-state_20260930-131011.md` (GTD session);
- `outputs/plans/lifeos-gtd-completion-plan_20260930-131011.md` (GTD session).

When committing, the new report must be staged under its canonical-case path
`Outputs/Implementations/…` (`git update-index --add --cacheinfo`). A plain
`git add` of the lowercase path would not stage it correctly.

## 9. Invariants and status

- **Changes:**
  - dependencies: none;
  - migrations: none;
  - backend files: 0;
  - snapshot/server schema: unchanged (2/2);
  - durable queue: unchanged;
  - global `html/body overflow-x`: not used.
- **Data:**
  - QA data exists only in `lifeos_test`;
  - no production or personal data was touched.
- **Git:**
  - branch `fix/lifeos-completion-audit`, HEAD `1b396eb7ed4b7ad6a791f3bab3d316daae69dac2`;
  - **not committed, not pushed, no PR, no merge, no deploy**;
  - no stash, reset, rebase or clean;
  - recovery stash `51184836…` retained;
  - one worktree.

```text
D1_PROJECT_HISTORY_RETENTION=FIXED (+D1b stale-project display)
D2_METRIC_HISTORY_COLD_ENTRY_I18N=FIXED
D3_PARADISE_768_OVERFLOW=FIXED (root cause: paradise TopBar min-content, not ParadiseScene)
FRONTEND=561/45 · typecheck/lint/build PASS · BROWSER=flows 22/22, matrix 0/432 overflow after (16/64 before)
PUBLICATION=none (uncommitted on fix/lifeos-completion-audit @ 1b396eb)
```
