# LifeOS Calendar Cube Redesign — Implementation Report

Date: 2026-09-29 · Branch: `feat/calendar-cube-redesign` · Deploy: **no**

## 1. Baseline and provenance

| Item | Value |
|---|---|
| Start `main` = `origin/main` | `55ac0408d5cffebbc514a591e15e56f18edaaf39`. PR #16 (Slice 6) MERGED; head `1d3ddc1`, merge commit `55ac040` |
| Recovered owner source-of-truth | original found at `~/.Trash/LifeOS_Calendar_Recovered_Source_of_Truth.md`, SHA-256 `7edbbba7fb7251397283653044509ca88a244def0e35173f71ad83a3d9cf0493`; archive `conversations.json` SHA-256 `1691e35d…400fc`; conversation `3cfa1a74-079e-44e1-ae3c-bdec673f3b08`, message `019f1e07-d657-7b54-b00c-a32178200431` |
| Repo copy of the source | `Outputs/Discoveries/lifeos-calendar-recovered-source-of-truth_20260929-214917.md`. Line-end whitespace was normalized (otherwise identical) so `git diff --check` passes. SHA-256 `63eb435e0c0acdca863be8b7f660eb354c000df55731c627b954fe5b2ae97ed3` |
| External Discovery | `/Users/yurasachenko/LifeOS/_parallel_planning/calendar/lifeos-calendar-current-code-discovery.md`, SHA-256 `1fb40c209a0b79c215bc211c3444bb338fa7da4a6f58c86f7731104220402ee0` |
| Repo Discovery copy | `Outputs/Discoveries/lifeos-calendar-current-code-discovery_20260929-214917.md`, byte-identical (same SHA-256) |
| Plan | `Outputs/Plans/lifeos-calendar-cube-redesign-plan_20260929-214917.md` (records OD-1) |

**Short reverify: PASS.** The Slice 6 delta touched only the shared registries (`App.jsx`, `routes.js`, `routeRegistry.js`, `lazyRoutes.jsx`, `Sidebar.jsx`, `ru.js`/`uk.js`, test pins). There was no change to the Calendar or task files, the task mutations, `migrate.js`, or the Calendar CSS.

**OD-1: `RESOLVED_BY_OWNER` on 2026-09-29.**
- Complete → `done:true` + `completed_at`.
- «Закрыть без выполнения» → `closure:'closed_unresolved'` + `closed_at`.
- «В архив» → `closure:'archived'` + `closed_at`.
- These states are mutually exclusive.
- An overdue task nobody marked stays active on its day.
- Delete stays permanent and outside History.
- Restore acts on the same id.

OD-2, OD-3 and OD-4 were kept at their Discovery defaults.

**Baseline before code (actual):**
- Frontend: 375 passed / 33 files; typecheck, lint and build pass; entry JS 323.34 kB; CSS 152.57 kB.
- Backend (`lifeos_test`): 602 passed; ruff and compileall pass; Alembic head/current `20260929_0007`; 22 AA tables.

## 2. Commits

| Commit | Content |
|---|---|
| `4007f7a` | docs: reconciled Discovery, recovered source, Plan (+ OD-1) |
| `33a9448` | P0 task integrity |
| `7f628c7` | P1 task-domain primitives, timestamps, closure states, validators |
| `dee19af` | P2 date hierarchy model + route parsing |
| `b4bad7d` | P3 cube views replacing the pill Calendar, fake data removed, lazy route |
| `299eec7` | P4 Day Manager, nested editor, dialog stack, Quick Add date prefill |
| `b7a9669` | P5 History + Restore |
| `15e9b31` | Browser-QA fixes (layout overflow, editor footer, reorder focus) |
| (this commit) | docs: report, module boundaries, master context; source-copy whitespace normalization |

## 3. Task data contract

- **Date authority:** `task.schedule.date` (`YYYY-MM-DD`) plus `schedule.time`. There is no `task.date`. `due` is only a non-localized legacy label (`semanticDue`: time, else date, else `'eod'` for stakes, else `''`).
- **New optional fields**, all additive, absent = unknown/active, never backfilled:
  - `created_at`, `completed_at`, `closed_at`: ISO instants;
  - `closure`: `'closed_unresolved'|'archived'`;
  - `order`: a safe integer ≥ 0 within `schedule.date`.
- `created_at` is stamped by `addTask` (all UI creation paths) and by the Clarify Do Now/Defer builders. Legacy rows show «—».
- **Validation:** `migrate.js` calls `validateTaskRecord`, which rejects malformed present fields only. Snapshot `version` 2 and server `schema_version` 2 are **unchanged**. **No Alembic migration** (head `20260929_0007`).
- History is derived from `state.tasks`. No reads from `activityLog`.

## 4. P0 — task integrity

- **Detail path:** the task detail modal now receives the **persisted** task by id, never a list row's display-resolved copy.
- **Edit path:** `TaskDetailModal` saves only changed fields (`taskDetailPatch`), which `updateTaskFields` merges by id. Notes, category, subtasks, schedule, `due` and `created_at` can no longer be overwritten.
- **Subtasks:** the three hardcoded Russian demo subtasks are gone; absent subtasks means `[]`.
- **Seed titles:** a seed `titleKey` stays localizable unless the title is edited.
- **New stakes tasks** store `'eod'`, not the localized label.
- **Calendar → TaskDetail data-loss path:** removed. The Calendar no longer reconstructs partial tasks.

## 5. Modules

| File | Role |
|---|---|
| `domain/tasks.ts` | pure task domain: readers, History, move/reorder, complete/close/archive/restore, validators, record builders |
| `domain/calendarModel.ts` | date-only model: month lengths, Monday-first weekdays, months of a year, 30-year windows, bounds, formatting (UTC-evaluated), Kyiv today |
| `pages/calendar/calendarRoute.js` | hash grammar parse/build |
| `pages/calendar/CalendarPage.jsx` | route shell (lazy) + pure `CalendarView` |
| `pages/calendar/CubeGrids.jsx` | day, month and year cubes |
| `pages/calendar/DayManagerModal.jsx` | Day Manager |
| `pages/calendar/CalendarTaskEditor.jsx` | nested editor + pure `editorResult` |
| `pages/calendar/CalendarHistory.jsx` | derived History table |
| `components/useDialog.js` | stacked-dialog behaviour: top-most-only Escape/Tab, focus in/return, ref-counted scroll lock |

- **Deleted:** `components/CalendarView.jsx`, `pages/calendar/DayDetailModal.jsx`, `lib/calendar.js`, `data/calendar-seed.js`.
- **Provider actions** (`LifeDataContext`): `updateTaskFields`, `completeTask`, `closeTaskUnresolved`, `archiveTask`, `restoreTask`, `moveTask`, `reorderTaskInDay`. `toggleTask` stamps and clears `completed_at`; `addTask` stamps `created_at`.

## 6. Behaviour

- **Hierarchy:**
  - Month: exactly 28–31 day cubes showing number + `Intl` weekday only, with no neighbouring-month filler, tasks, pills or counts. Cubes flow freely (OD-2).
  - Year: 12 month cubes.
  - Years: 30-year windows anchored at the current Kyiv year, clamped to `[min(current year, earliest dated task), 2100]`. From 2026 the windows are 2026–2055, 2056–2085 and 2086–2100.
  - The date editor rejects years above 2100 (and below 1900).
- **Routes:** one id `calendar`. `#/calendar[/YYYY | /YYYY-MM | /YYYY-MM-DD | /years[/YYYY] | /history]`.
  - Invalid or out-of-range hashes are replaced with `#/calendar`.
  - A day opened from its month is a history push, so Back or closing returns to the month. A deep-linked day closes by replace.
  - The nested editor is never in the URL. `LIFE_ROUTES` stays 21.
- **Cube interaction:** a thin primary→accent gradient edge plus a 2px lift and hover shadow, the same on `:focus-visible`. `prefers-reduced-motion` removes both.
- **Day Manager:** lists the active tasks of the day, in manual order, then time, then creation.
  - Per row: green-check complete, important/routine toggle, ↑/↓ (keyboard, announced, focus stays on the moved row), edit, archive, and permanent delete with confirmation. «закрыть без выполнения» appears only on overdue rows.
  - Status line uses `aria-live`. The add button opens Quick Add with `defaultDate` = that day.
- **Nested editor:** title, date, time and description. A save is one change to the same task id. A new date moves the task and appends it to that day, and the status names the destination with an «открыть день» link. Clearing the date requires confirmation.
- **History:** shows completed / closed_unresolved / archived, newest first. Columns: created, title, task date, status, closed; «—» when unknown. Restore clears only completion/closure metadata. Past-dated restored tasks come back overdue.
- **Fake data removed:** the 27 seeded events and the daily dog-feeding rows are gone from the Calendar. The Dog page is untouched. An empty Calendar is truthful.
- **Localization:** RU and UK: +70 `cal_*` keys each, −33 removed (`cal_seed_*` plus the unused week/pill keys). ru 1081 → 1118, uk 1080 → 1117. Month and weekday names come from `Intl`.
- **CSS:**
  - Cubes, manager, editor and History live in `finance-calendar.css`; the toolbar chrome lives in `calendar-nav.css`.
  - Removed the dead pill, hour-grid and day-modal rules (including `theme-light.css`/`responsive.css`), the dead `--cal-*` pill tokens, and the dead paradise `.cal-title` selector.
  - History stacks via a container query. The manifest order is unchanged.

## 7. Validation (final, actual)

| Check | Result |
|---|---|
| `apps/web: npm test` | **495 passed / 39 files** (375 → 495) |
| typecheck / lint / build / build --manifest | pass / pass / pass / pass |
| static import cycles (frontend, script) | **0** (151 modules) |
| `apps/api: python -m pytest` (`lifeos_test`) | **602 passed** |
| ruff / compileall | pass / pass |
| `alembic heads` / `current` | `20260929_0007 (head)` / `20260929_0007 (head)` |
| AA tables | 22 |
| snapshot / server schema version | 2 / 2 |
| signal rules | 4 (backend suite unchanged and green) |
| `git diff --check` | pass |
| dependencies added | none |

New suites:
- `task-integrity.test.jsx`: C14, C34.
- `task-domain.test.ts`: C06–C09, C11–C19, C29–C33, C36, validators.
- `calendar-model.test.ts`: C01, C02, C10, C26, C27.
- `calendar-source.test.jsx`: C27 guard.
- `calendar-ui.test.jsx`: C01, C03–C05, C10, C16, C17, C20, C21, C30, C35, C36.
- `calendar-day-manager.test.jsx`: C06, C07, C10, C12–C14, C24/C25 helpers, C31.

Updated pins (not weakened):
- `clarify.test.ts`: the task shape now includes `created_at`, from a deterministic clock.
- `route-registry.test.ts`: calendar sub-routes.
- `locale-shape.test.ts`: counts.
- `lazy-routes.test.jsx`: `calendar` is lazy.

**Bundle:**

| Asset | Before → after |
|---|---|
| entry JS | **323.34 → 319.72 kB** |
| new lazy `CalendarPage` chunk | 21.75 kB (6.68 kB gzip) |
| CSS | 152.57 → 153.83 kB |
| `LocaleContext` chunk | 126.79 → 130.91 kB |

No 500 kB warning. The Calendar was made lazy because the new surface added +3.8 kB to the entry while eager (Plan §9 rule); the old eager week view left the entry.

## 8. Browser / visual QA

Setup: headless Chrome over DevTools (Node built-ins), production build via `vite preview`, local API on **lifeos_test**, and a throwaway bootstrapped QA user with a v2 snapshot seeded through the real API. The seed covered: legacy seed tasks, three tasks on today, an overdue stakes task, a future task, 2028-02-29, 2100-12-31, and completed / closed_unresolved / archived / legacy-done rows. The real clock was Kyiv 2026-09-29.

- **Matrix:** 320/390/768/1024/1440/1920 × dark/light/paradise × 9 screens = **162 screens**. The screens: 28-day month, 31-day month, months of a year, the 30-year window, the 2086–2100 window, a Day Manager with several tasks, an overdue day, an empty day, and History. Every screen was a fresh document load (deep-link refresh).
  - Results: all expectations met; **0 console errors / exceptions**.
  - No task content in cubes.
  - Horizontal overflow: none attributable to the Calendar.
- **Pre-existing, not attributed:** paradise at 768 px shows +16 px (RU) / +25 px (UK). It comes from `ParadiseScene` `ps-layer` and occurs identically on untouched `#/home`, `#/tasks` and `#/projects`.
- **UK:** 390/1440 × dark/light × 7 screens plus the editor. 0 Russian-only letters outside seeded task titles, 0 overflow, 0 errors.
- **Nested editor overflow:** 320/390/768/1440 × 3 themes × RU/UK, all 0.
- **Flows (35/35 pass):**
  1. month → day → Back;
  2. month → year → years → Back ×2;
  3. deep-link day refresh + Escape → month;
  4. add-from-day: Quick Add prefilled; Escape closes only Quick Add; saved task on that exact day after reload;
  5. date edit moves the same id (status + «открыть день», notes and `created_at` kept, no duplicate);
  6. reorder persists after reload, and focus stays on the moved row;
  7. important persists;
  8. complete → History with `completed_at`;
  9. close without completion → History;
  10. archive → History;
  11. Restore: same id, active again, overdue on its original day, no duplicate;
  12. delete: confirmation, gone, never in History;
  13–14. nested Escape closes the editor first, then the manager;
  15. focus returns to the Edit button and to the cube;
  16. keyboard-only: Enter on a focused cube opens the day, and Tab/Shift+Tab stay inside the dialog;
  17. 2101 rejected with a message.
  - Tasks-page regression: TaskDetail shows no demo subtasks, and a save without edits leaves the persisted task byte-identical.
- **Kyiv near UTC midnight (C27):** verified by unit tests (`todayDateOnly('2026-10-13T21:30Z') = 2026-10-14`, year rollover). The browser clock was not emulated.
- **QA findings fixed in `15e9b31`:**
  - the toolbar at 320 px and History at 768 px widened the shell column;
  - the nested editor footer clipped Save in UK at 390 px;
  - moving a row to the top dropped focus with its disabled ↑ button.
- The QA servers were stopped afterwards. The QA user lived only in `lifeos_test`, which the backend suite resets.

## 9. Deviations and corrections

1. **The recovered source file had moved to the Trash.** It was verified by SHA-256 and preserved in the repo, with line-end whitespace normalized only (both SHAs recorded).
2. **Git and the on-disk case disagree** (`outputs/` on disk vs `Outputs/` in the index, with `core.ignorecase`). New docs were staged with `git update-index --cacheinfo` under the canonical `Outputs/…` paths.
3. **`useDialog.js` and all `cal_*` copy landed in the P3 commit**, one commit before their first use in P4. The history is still green at every commit.
4. **Interactive focus behaviour** is covered by pure helper tests plus real-browser QA. No DOM test dependency was added (Slice 6 precedent).
5. **Behaviour changes on the Tasks list:**
   - A stakes task created with a schedule now shows its time or date instead of «до конца дня».
   - Time-only tasks (no date) and seed tasks are no longer placed on "today" in the Calendar (truthful: no `schedule.date`).

## 10. Known backlog (not done here)

- Pointer drag reorder (optional; buttons and keyboard satisfy the requirement).
- Mobile navigation to LIFE routes and the paradise 768 px backdrop overflow (both pre-existing).
- TaskDetailModal cannot edit the schedule (the Calendar editor can); a TaskDetail redesign is out of scope.
- Home's task stat still comes from `LifeDashSeed` (pre-existing, outside the Calendar).
- Next track: **Slice 7 (Trade-off / System Review) → F3 cursor correctness → Slice 8 retention.**

## 11. Invariants

- Dependencies added: **none**.
- Deploy: **no**.
- Force-push/rebase/reset: **no**.
- Recovery stash `51184836…` retained.
- Frozen tag `adaptive-analytics-design-accepted` unmoved (→ `d4960286`).
- One worktree.
- Snapshot `version` 2 / server `schema_version` 2.
- No Alembic migration.
- No AA/Experiment change.
- No Slice 7/8 work.
- No `dist/` committed.

Verdict: **CALENDAR_STATUS=PASS** (pending normal-merge of the PR).
