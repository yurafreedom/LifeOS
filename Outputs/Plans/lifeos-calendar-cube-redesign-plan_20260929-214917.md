# LifeOS Calendar Cube Redesign — Implementation Plan

Date: 2026-09-29 · Base: `main` = `origin/main` = `55ac0408d5cffebbc514a591e15e56f18edaaf39`
(PR #16 / Slice 6 merged, head `1d3ddc1`). Branch: `feat/calendar-cube-redesign`.

## 0. Sources and identity

| Source | Path | SHA-256 |
|---|---|---|
| Recovered owner source-of-truth | `Outputs/Discoveries/lifeos-calendar-recovered-source-of-truth_20260929-214917.md` (byte copy; original was found in `~/.Trash/`) | `7edbbba7fb7251397283653044509ca88a244def0e35173f71ad83a3d9cf0493` |
| Current-code Discovery (audited `414df14`) | `Outputs/Discoveries/lifeos-calendar-current-code-discovery_20260929-214917.md` (byte copy of `_parallel_planning/calendar/…`) | `1fb40c209a0b79c215bc211c3444bb338fa7da4a6f58c86f7731104220402ee0` |
| Owner-decision memo (external) | `/Users/yurasachenko/LifeOS/_parallel_planning/calendar/lifeos-calendar-owner-decisions.md` | `5f15194fc3df35cca2ba0c9bc8188f3e08f464a140735bcd7e170a835cf981f3` |

The archive supplies product intent. Current main supplies implementation reality.

## 1. Short post-Slice-6 reverify — PASS

- `git diff --name-status 414df14 55ac040` touches only shared registries:
  - `App.jsx` (+`experiment` case, Sidebar prop), `routes.js` (+`experiment`, `LIFE_ROUTES` 21), `routeRegistry.js` (+`experiment/` prefix), `lazyRoutes.jsx`, `Sidebar.jsx`;
  - `ru.js` / `uk.js` (+175 `aa_ex_*` keys), `lazy-routes.test.jsx`, `locale-shape.test.ts`, `module-boundaries.md`, `LIFEOS_MASTER_CONTEXT.md`.
- No change to `CalendarView.jsx`, `DayDetailModal.jsx`, `TaskDetailModal.jsx`, `lib/calendar.js`, `QuickAddModal.jsx`, the LifeData task mutations, `migrate.js` / `initialState.js`, or the Calendar CSS.
- Drift is textual only: pins are now `LIFE_ROUTES.size` 21 and locale counts ru 1081 / uk 1080. The Discovery's findings stand unchanged.

`CALENDAR_REVERIFY_STATUS=PASS`

## 2. Owner decisions

The Discovery was written with OD-1 open. It is recorded here as resolved; the Discovery text is not rewritten.

**OD-1 — `RESOLVED_BY_OWNER` on 2026-09-29.** The Discovery recommendation was approved.

| Action | Persisted | History label (RU / UK) |
|---|---|---|
| «Выполнить» | `done:true`, `completed_at:<now>`, `closure`/`closed_at` removed | «Выполнена» / «Виконана» |
| «Закрыть без выполнения» | `done:false`, `completed_at` removed, `closure:'closed_unresolved'`, `closed_at:<now>` | «Закрыта, не выполнена» / «Закрита, не виконана» |
| «В архив» | `done:false`, `completed_at` removed, `closure:'archived'`, `closed_at:<now>` | «В архиве» / «В архіві» |

Rules that follow from OD-1:
- **Overdue and unmarked:** stays active on its day with an overdue indicator. It never auto-closes and never enters History by the passage of time.
- **Delete:** permanent hard removal. Never in History, never restorable. No trash.
- **Restore:** acts on the same id. It sets `done:false` and removes `completed_at`, `closure` and `closed_at`, and preserves everything else. No clone. A past-dated restored task is active and overdue again.
- **Mutual exclusivity:** a task is never both completed and closed. Complete clears closure; close and archive clear completion.

**OD-2 / OD-3 / OD-4:** the Discovery defaults stay in force.
- OD-2: cubes flow freely with no spacer or filler cells.
- OD-3: the seed events and dog feedings are removed from the Calendar.
- OD-4: the lower year bound is min(current Kyiv year, earliest real `schedule.date` year); the upper bound is 2100; the year view shows 30-year windows.

`OWNER_DECISIONS_OPEN=0` · `IMPLEMENTATION_PLAN_READY=YES`

## 3. Invariants

- **Date authority:** `task.schedule.date` (`YYYY-MM-DD`) plus `schedule.time` (`HH:MM`|`''`). No `task.date` field. `due` is a legacy display label, never a Calendar date.
- **Versions:** snapshot `version` stays 2, and server `schema_version` stays 2. No Alembic migration; head stays `20260929_0007`. No dependency.
- **New optional task fields:**
  - `created_at`, `completed_at`, `closed_at`: ISO instants;
  - `closure`: `'closed_unresolved'|'archived'`;
  - `order`: a non-negative safe integer, meaningful within the task's `schedule.date`.
  - Absent means unknown or active.
  - No backfill of any kind, including from `activityLog`.
- **History** is derived from `state.tasks` only.
- **Today** = `localDateForInstant(new Date())` (Europe/Kyiv). No `toISOString().slice(0,10)` on local Dates anywhere in the new code.

## 4. Modules and files

### New

| File | Role |
|---|---|
| `src/domain/tasks.ts` | Pure task domain. The Constants, Readers, Mutations and Record rows below. |
| `src/domain/calendarModel.ts` | Pure date-only model: `MAX_YEAR=2100`, `MIN_INPUT_YEAR=1900` (editor floor), `WINDOW_YEARS=30`, `daysInMonth(y,m)`, `weekdayIndex(date)` (Mon=0), `monthKey`, `monthDays(y,m)`, `yearMonths(y)`, `minNavigableYear(todayYear, tasks)`, `yearWindow(anchorYear, currentYear, minYear)`, `shiftMonth`, `clampYear`. |
| `src/pages/calendar/calendarRoute.js` | Pure hash grammar: `parseCalendarHash(hash, bounds)` → `{view, year, month, day}` or a normalized fallback; `calendarHash(view)`. |
| `src/pages/calendar/CalendarPage.jsx` | Route shell. Reads and writes the hash, owns the level tabs and navigation, and renders the grids, the Day Manager and History. Exports pure views for tests. |
| `src/pages/calendar/CubeGrids.jsx` | `DayCubes`, `MonthCubes`, `YearCubes` (buttons only, no task content). |
| `src/pages/calendar/DayManagerModal.jsx` | Day Manager dialog. |
| `src/pages/calendar/CalendarTaskEditor.jsx` | Nested editor dialog for title, date, time and notes. |
| `src/pages/calendar/CalendarHistory.jsx` | History view (a derived table). |
| `src/components/useDialog.js` | Shared dialog behaviour, plus the pure `dialogStack` helpers. |
| `src/test/task-domain.test.ts`, `src/test/calendar-model.test.ts`, `src/test/calendar-ui.test.jsx` | Tests. |

`domain/tasks.ts` in detail:

- **Constants:** `TASK_CLOSURES`.
- **Validation:** `validateTaskRecord` validates only the optional new fields, and only when present.
- **Readers:**
  - `taskDate(task)` → a valid `schedule.date` or `null`;
  - `isTaskActive`, `isTaskOverdue(task, today)`;
  - `tasksForDay(tasks, date)`, which returns active tasks ordered by (`order` ?? ∞, time or `''`-last, array index);
  - `historyTasks(tasks)`, sorted newest `completed_at`/`closed_at` first, with unknowns last by descending array index;
  - `historyStatus(task)`;
  - `semanticDue(stakes, schedule)`.
- **Mutations:** each is `(tasks, id, …, now) → tasks`:
  - `setTaskDone`, `completeTask`, `reopenTask`, `closeTaskUnresolved`, `archiveTask`, `restoreTask`;
  - `moveTask(tasks, id, schedule)`, which uses the same id and appends to the destination order;
  - `reorderDay(tasks, date, id, direction)`, which renumbers that day's active tasks 0..n-1;
  - `patchTask(tasks, id, patch)`.
- **Record builders:** `withCreatedAt(task, now)`, `createQuickAddTaskRecord(input, now, id)`.

### Changed

| File | Change |
|---|---|
| `context/LifeDataContext.jsx` | `addTask` stamps `created_at` (via `withCreatedAt`) if absent. `toggleTask` uses `setTaskDone` (stamps/clears `completed_at`, clears closure). New thin actions, each one `setStateRaw` pass with an activity entry: `updateTaskFields(id, patch)`, `setTaskStakes`, `moveTask`, `reorderTaskInDay`, `closeTaskUnresolved`, `archiveTask`, `restoreTask` (action `restored`). `updateTask` is kept for compatibility but is no longer used by the editor paths. |
| `context/lifeData/migrate.js` | `state.tasks.forEach(validateTaskRecord)`. Throws only on malformed new optional fields; legacy rows pass untouched. |
| `domain/clarify.ts` | `createClarifiedTaskRecord(title, id, now)` adds `created_at`; `createDeferredTaskRecord` passes `now` through. |
| `App.jsx` | Detail state holds the task id and looks up the persisted task. `onUpdate(id, patch)` → `updateTaskFields`. `addTaskFromUI` builds through `createQuickAddTaskRecord`: `created_at`, non-localized `due` (`semanticDue`), `schedule` preserved. `openQuickAdd(stakes, seed)` passes `seed.date` to `QuickAddModal defaultDate`. The `calendar` case renders `CalendarPage` with `onAddForDay(date)`. |
| `components/TaskDetailModal.jsx` | Subtasks default to `[]`. Title shown as `task.title ?? t(titleKey)`. `commit()` sends only the changed fields (`taskDetailPatch(initial, edited)`, exported and pure). A `titleKey` title is not frozen unless edited. `due` is never written. |
| `components/QuickAddModal.jsx` | `defaultDate` prop: the initial state opens the schedule block with the date prefilled, and the reset effect honours it. |
| `app/routeRegistry.js` | `calendar` and `calendar/…` → `calendar` (a prefix, like `experiment/`). `LIFE_ROUTES` stays 21. |
| `app/lazyRoutes.jsx` | Decided by bundle measurement (§9). Default: make `calendar` lazy, since it is a non-default route with new surfaces. |
| `styles/finance-calendar.css` | Replace the `.cal-pill*` / `.cal-day*` / `.modal-day-*` blocks with cube, manager, editor and history rules, including light-theme overrides in the same layer. |
| `styles/calendar-nav.css` | Keep `.cal-head`/`.cal-h`/`.cal-nav`/`.cal-btn`/`.cal-views`/`.cal-view-btn`. Remove the dead hour-grid rules (`.cal-grid`, `.cal-col-*`, `.cal-cell`, `.cal-event*`, `.cal-time`, `.cal-day-*`). |
| `styles/responsive.css`, `styles/theme-light.css`, `styles/paradise.css` | Remove the dead `.cal-*` pill/grid overrides. Add paradise overrides for cube and history surfaces in `paradise.css`. |
| `context/locale/ru.js`, `uk.js` | Add the `cal_*` Calendar keys. Remove `cal_seed_*` and the now-unused `cal_week`, `cal_day`, `cal_month`, `cal_more_n`, `cal_add_event`, `cal_quiet_day`. |
| Tests | Updated truthfully: `clarify.test.ts` (shape + `created_at`), `route-registry.test.ts`, `locale-shape.test.ts` (counts), `lazy-routes.test.jsx` if lazy, `state-migration.test.ts`. |

### Deleted

`components/CalendarView.jsx`, `pages/calendar/DayDetailModal.jsx`, `lib/calendar.js`, `data/calendar-seed.js`.

The stale `ui_kits/life-os/*` and `preview/*.html` mirrors are not part of the app bundle and stay untouched.

## 5. Behaviour specification

### 5.1 Route grammar

This is the one existing route id `calendar`. The page parses the rest of the hash.

| Hash | View |
|---|---|
| `#/calendar` | day cubes of the current Kyiv month |
| `#/calendar/YYYY-MM` | day cubes of that month |
| `#/calendar/YYYY-MM-DD` | that month with the Day Manager open (Back → `#/calendar/YYYY-MM`) |
| `#/calendar/YYYY` | the 12 month cubes of that year |
| `#/calendar/years` | the 30-year window containing the current year |
| `#/calendar/years/YYYY` | the window containing YYYY |
| `#/calendar/history` | History |

- **Windows** are anchored at the current Kyiv year: `[cur+30k, cur+30k+29]`, clamped to `[minYear, 2100]`. So 2026–2055, 2056–2085, 2086–2100, and backwards `[max(minYear, cur−30), cur−1]` when earlier tasks exist.
- **Out-of-range or invalid** hashes are replaced with `#/calendar` using `history.replaceState` plus a state update, so there is no extra history entry.
- **Navigation** assigns `window.location.hash`, so Back and Forward work and deep links survive a refresh.
- **The nested editor** is local state only and never appears in the URL.

### 5.2 Cubes

- **A day cube** is a `<button class="cal-cube">` containing the number and the `Intl` short weekday only.
  - `aria-label` is the full localized date, with «сегодня» appended for today.
  - State classes: `is-today`, `is-selected`, `is-past`.
  - Exactly `daysInMonth` cubes, with no filler.
- **Month cubes** show the `Intl` month name. **Year cubes** show the year number; the last window may be shorter.
- **Grid:** `repeat(auto-fill, minmax(64px, 1fr))` inside a readable max-width, with no horizontal scroll.
- **Hover and `:focus-visible`:** a gradient edge ring (a masked `::before`, primary → accent) fades in, plus `translateY(-2px)` and `--shadow-hover` over ~180 ms `var(--ease)`.
- **`prefers-reduced-motion`:** no transform and no transition.
- **Level tablist:** «дни» / «месяцы» / «годы» / «история». Each level has its own ‹ › and «сегодня».

### 5.3 Day Manager

- The dialog `aria-labelledby` is the full date heading.
- **Rows** are `tasksForDay(tasks, date)`. Each row has:
  - `.task-check` (complete) and the title;
  - the time, and an overdue badge when overdue;
  - the stakes toggle (`qa-toggle` рутина / важное);
  - ↑ / ↓ buttons (disabled at the ends);
  - edit and archive buttons;
  - «закрыть без выполнения» when overdue only;
  - delete with an inline confirmation (`td_delete_confirm`).
- **Status line** (`role="status"`, `aria-live="polite"`): announces moves, reorders and completion. After a date move it shows «Перенесено на …» with a button that opens the destination day.
- **Footer:** «+ добавить задачу» opens QuickAdd with `defaultDate=date`. The manager stays open underneath, and QuickAdd is the top dialog.
- **Empty day:** a truthful empty line. No fake rows.
- **At ≤640 px:** a full-height sheet, via the existing `.qa-backdrop` / `.qa-modal` responsive rules.

### 5.4 Nested editor

- **Fields:** title (required), date (`''` or valid, year 1900–2100), time (`''` or `HH:MM`), and notes.
- **Save** makes one `updateTaskFields` / `moveTask` change on the persisted task id. It sets `schedule` (`null` when both date and time are empty), `due = semanticDue(stakes, schedule)`, `title` and `notes`. Subtasks, category, tag, stakes and `created_at` are untouched.
- **Clearing the date** requires an inline confirmation: «задача уйдёт из календаря и останется в задачах».
- Errors are inline and Save is disabled until they are fixed. ⌘↵ saves; Esc cancels only the editor.

### 5.5 History

- **Rows:** `historyTasks(state.tasks)`. Columns: created (`—` if unknown), title, status (from the OD-1 labels), closed/completed date (`—` if unknown), and Restore.
- **Layout:** a `<table>` at ≥641 px; stacked rows with inline labels at ≤640 px.
- **Empty state:** a truthful line.
- History reads no `activityLog`.

### 5.6 Dialog stack (`useDialog`)

- **Focus:** on mount it records `document.activeElement` and focuses the initial element. On unmount it returns focus if that element is still in the document.
- **Top dialog:** a dialog is on top when it is the last `[role="dialog"][aria-modal="true"]` in the DOM, so a legacy QuickAdd rendered later counts as the top. Only the top dialog handles Escape and the Tab wrap.
- **Scroll lock:** a module-level reference count, so the body is unlocked only when the last dialog closes.
- **Pure helpers** (`isTopDialog(list, el)`, `lockCount` transitions, `focusStep`) are unit-tested. Interaction is verified in the browser.

## 6. Commit sequence

1. `docs:` reconciled Discovery + SoT copies + this Plan (with the OD-1 record).
2. `fix:` task integrity — the persisted-task detail path, subtasks `[]`, a changed-fields patch, no localized `due`/title freezing. Tests C14, C34.
3. `feat:` task domain primitives, validators and the Clarify/QuickAdd `created_at` path. Tests C07–C09, C11, C13, C15–C19, C29–C33, C36.
4. `feat:` date hierarchy model and route parsing. Tests C01, C02, C10, C26, C27.
5. `feat:` cube views replacing the week/pill Calendar, fake seed and dog rows removed, RU/UK, CSS. Tests C03–C05, C20, C21, C35.
6. `feat:` Day Manager, nested editor, dialog stack, QuickAdd date prefill. Tests C06, C12, C24/C25 (helpers).
7. `feat:` History and Restore UI. Tests C16–C19 (render).
8. `fix:` scoped browser-QA corrections, if needed.
9. `docs:` implementation report, module-boundaries and master context.

## 7. Test strategy

There is no new test dependency. Vitest runs in the node environment, with `renderToStaticMarkup` for markup, pure domain and model tests, route parser tests, migration tests, and the existing smoke test. Interactive focus, Escape, overflow and theming are covered by real-browser QA: headless Chrome over DevTools on `vite preview` with a local API on `lifeos_test` and a throwaway QA user.

| ID | Where |
|---|---|
| C01, C02, C10, C27 | calendar-model.test.ts |
| C26 | calendar-model.test.ts (route) + route-registry.test.ts, plus browser |
| C03, C04, C05, C20, C21, C35 | calendar-ui.test.jsx (static markup + source/file checks) |
| C06 | task-domain.test.ts (`createQuickAddTaskRecord` → JSON round-trip → `migrateStateCopy` → `tasksForDay`), plus browser |
| C07–C09, C11–C19, C29–C33, C36 | task-domain.test.ts, plus calendar-ui (History render) |
| C14, C34 | calendar-ui.test.jsx (`taskDetailPatch`, TaskDetailModal markup) |
| C22–C25 | browser QA (plus `useDialog` pure helpers) |
| C28 | the existing suites, unchanged and green |

## 8. Baseline and validation commands

- **Baseline** (recorded before code): `apps/web: npm test · typecheck · lint · build · build -- --manifest`; `apps/api: pytest · ruff · compileall · alembic heads/current`.
- **Final:** the same, plus `git diff --check`, an import-cycle scan with the Slice 6 method (static graph), and bundle sizes for entry JS, CSS and the Calendar chunk.

## 9. Lazy-loading decision rule

Calendar is currently eager. If the new Calendar adds more than ~3 kB to the entry, it becomes lazy through `LAZY_ROUTE_LOADERS.calendar`, and `lazy-routes.test.jsx` is updated. Home and the shell stay eager.

## 10. Out of scope

Recurring events, a time grid, sync or Google Calendar, a DnD library, a trash system, Slice 7/8, the F3 cursor fix, retention, the global Paradise 768 backdrop, mobile navigation, AA/Experiment semantics, and redesigning TaskDetailModal.

## Plan gate

```
CALENDAR_PLAN_STATUS=COMPLETE
OWNER_DECISIONS_OPEN=0
IMPLEMENTATION_READY=YES
SNAPSHOT_VERSION_CHANGE=NO
SERVER_SCHEMA_VERSION_CHANGE=NO
ALEMBIC_MIGRATION=NO
DEPENDENCIES_ADDED=none
```
