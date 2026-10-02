# LifeOS GTD — Slice G2: actual task dates and rescheduling

Date: 2026-09-30 (Europe/Kyiv) · Branch `fix/lifeos-completion-audit`
Status: **implemented and committed locally.** Not pushed, no PR, not merged, not deployed.
Plan: `Outputs/Plans/lifeos-gtd-completion-plan_20260930-131011.md` §3 (OD-G2-1 resolved by the owner: recommended option).

## 1. Stage 1 — review and checkpoint commits (before G2)

### Baseline

| Item | Value |
|---|---|
| Branch / HEAD at start | `fix/lifeos-completion-audit` @ `1b396eb` |
| `origin/main` | `5e858bb`; the branch does not exist on `origin` |
| Index at start | empty |
| Working tree at start | 23 modified + 49 untracked paths (audit D1–D3, UI sound, GTD docs + G1, owner files) |
| Recovery stash | `stash@{0}` = `51184836ace557fbd9492527bd845329b17b2a76`, untouched |

### Review

An independent read-only review ran over the completed scope. It found no high-severity defects. Two concrete defects were fixed before committing:

1. **MetricHistoryPage (D2)** could stay on "loading" forever. This happened when it mounted during a Finance read that was then aborted elsewhere, because its load effect depended only on `ready`.
   - Fix: the effect now re-evaluates when `finance.loading` / data / error change.
   - A failed read waits for the explicit retry instead of re-requesting.
   - `AnalyticsContext.loadFinance` uses a request counter, so only the latest request writes `finance`. An older aborted read can no longer clear `loading` for a newer one.
   - A regression assertion was added.
2. **WaitingItemModal (G1):** the status message named the record by its title before a rename made in the same transition. It now uses the title from the outcome.

### Commits

Shared files hold several features. Their intermediate versions were derived from `HEAD` plus the final text: each stage only **adds** the hunks of its feature, which was checked by diff. They were staged with `git update-index` without touching the working tree. Each staged tree was exported with `git archive` and verified in isolation (tests, typecheck, lint, build).

| Commit | Scope | Isolated verification |
|---|---|---|
| `1845c5f` | audit D1–D3 + post-review hardening; report | 561 tests / 45 files, typecheck, lint, build |
| `bc5bc64` | UI sound effects, 17 runtime clips from `apps/web/src/assets/sfx/`; report | 601 tests / 47 files, all gates |
| `c1353e1` | GTD discovery + plan + G1; report | 653 tests / 49 files, all gates |

- All new reports were staged under the canonical `Outputs/{Discoveries,Plans,Implementations}/` paths (the on-disk directory is lowercase).
- `git diff --cached --check` was clean for each commit.
- In the sound commit, MASTER_CONTEXT §80 briefly precedes §79; the next commit adds §79. This is noted in the commit message.

Deliberately **not** committed (owner inputs):
- repo-root `sfx/` (audio originals);
- `LifeOS_Completion_Audit_20260930.md`;
- `apps/web/src/Архив.zip`: a 557 KB Finder archive of `src` that appeared at 17:32 during this session. The agent did not create it, and it was left untouched.

## 2. G2 implemented behaviour

- **«сегодня»:** active tasks whose `schedule.date` equals the current Europe/Kyiv date (`tasksDueToday`).
- **«просрочено»:** `isTaskOverdue`, i.e. active and dated before Kyiv today (`overdueTasks`).
- **Excluded from both:**
  - undated tasks, including Do Now tasks and legacy rows with `tag:'today'`, `stakes`, a `due` label, or a time without a date;
  - completed, archived and closed_unresolved tasks.
- **Legacy records** are not rewritten or backfilled.
- **«по дате»** (`sortTasksByDate`; previously a no-op):
  - dated tasks first, by date;
  - within a date, exactly the Calendar day order (`tasksForDay`): the explicit per-day `order`, then timed before untimed by time, then stored position;
  - undated tasks last, in stored order;
  - stable for ties.
- **The open view follows the date** (`app/useKyivToday.js`).
  - A timer re-reads the Kyiv day at the next Kyiv midnight. It is DST-aware via `msUntilNextDay` and capped at 1 h, so a late or suspended timer is corrected.
  - `focus`, `visibilitychange` and `pageshow` also re-check.
  - State changes only when the day actually changes.
- **Row labels:** dated rows show the Calendar date (+ time) in a `<time dateTime>`, red when overdue. Undated rows keep the legacy display label.
- **Task detail date/time** (`TaskDetailModal`):
  - set, change or clear the date and time;
  - «убрать дату» clears both;
  - clearing the date always clears its time;
  - clearing a stored date asks the Calendar's confirmation («да, без даты»);
  - a time without a date is rejected with a localized `role=alert` and `aria-invalid`;
  - impossible dates and out-of-range years or times are rejected;
  - past dates are allowed.
- **One rule set.** The rules are `calendarModel.validateScheduleInput` / `scheduleEdit`, shared with the Calendar editor. The Calendar editor therefore now also rejects a dateless time, which it used to store.
- **Save.** A schedule change goes through `moveTask`, the same path as the Calendar editor:
  - the **same id** moves to the new day's order;
  - `due` is re-derived by `semanticDue`;
  - `order` is dropped when the date is cleared;
  - the lifecycle and every unrelated field are kept.
  Other edits are field patches. A task that no longer exists gets `{ok:false, code:'missing'}` (`app/taskDetailSave.js`): the dialog explains it, and Save, Complete and the menu are disabled. Nothing is recreated.
  - **Why no flushSync here:** the check reads the render state of the click's handler. React commits that state before dispatching the next discrete event, and the provider updaters no-op for a missing id. There is no demonstrated need for the G1 flushSync bridge.
- **Seed rows.** Home seed rows (not persisted tasks) stay display-only, with no date fields.
- **Dialog behaviour.** `TaskDetailModal` now uses the shared `useDialog`: focus trap, top-most Escape, and focus return. The phone footer wraps and hides the hints (≤640 px), which fixes a 320 px overflow that also affected the old footer.
- **Copy:** RU/UK, +5 keys each (dictionary pin 1811/1810).
- **Sound:** mappings are unchanged, and there are no new emits. Scheduling is a local snapshot change, so there is no `save.success`. A Save that closes the dialog keeps the existing `modal.close` cue, the same as before G2.

## 3. Changed files (G2 commit)

- **New:**
  - `apps/web/src/app/useKyivToday.js`
  - `apps/web/src/app/taskDetailSave.js`
  - `apps/web/src/test/tasks-g2.test.jsx` (28 tests)
- **Modified:**
  - `apps/web/src/domain/tasks.ts`
  - `apps/web/src/domain/calendarModel.ts`
  - `apps/web/src/pages/TasksPage.jsx` (selectors, live day, date labels; signature unchanged)
  - `apps/web/src/components/TaskDetailModal.jsx`
  - `apps/web/src/pages/calendar/CalendarTaskEditor.jsx`
  - `apps/web/src/App.jsx` (persisted/missing detection, save routing)
  - `apps/web/src/context/locale/ru.js`, `uk.js`
  - `apps/web/src/styles/panels.css`, `modals.css`
- **Tests with deliberate contract updates:**
  - `apps/web/src/test/calendar-day-manager.test.jsx`: «clear date keeps time» → cleared together, plus the time-without-date rejection.
  - `apps/web/src/test/task-integrity.test.jsx`: the source pin follows the new save wiring; behaviour is covered in `tasks-g2`.
  - `apps/web/src/test/locale-shape.test.ts`
- **Docs:**
  - `Outputs/architecture/module-boundaries.md`
  - `LIFEOS_MASTER_CONTEXT.md` (§81 status line, §82)
  - this report

The Clarify files and tests, G1 files, sound files and backend are unchanged.

## 4. Verification

**Gates** (`apps/web`):
- `npm test` **682 passed / 50 files** (was 653/49);
- typecheck, lint and build PASS;
- `git diff --check` clean.

**Backend.** Not re-run for G2 (no backend file changed). Its last full run this day: 748 passed + 1 skipped on lifeos_test, with `LIFEOS_AA_WRITE_ENABLED=false`.

**New regressions** (`tasks-g2.test.jsx`):
- **Views:** yesterday / today / tomorrow / undated; legacy today tag + stakes + dateless time; completed, closed_unresolved and archived; a Do Now task.
- **Day change:** today→overdue as the day moves; Kyiv midnight boundaries in summer (+03) and winter (+02); `msUntilNextDay` on the 25-hour DST day.
- **Rollover watcher:** a report just after midnight and not before; catch-up after a suspended tab via visibility/focus; no duplicate report; the 1 h cap; the disposer.
- **Sort:** chronological, Calendar day order, undated last, stable; the same-day order equals `tasksForDay`.
- **Input validation:** set, change, clear; time without a date; impossible dates; the 2101 bound; `24:00`; past dates allowed; no-change detection; a legacy dateless time is not a schedule.
- **Save routing:** a move keeps id, title, notes, category, subtasks, `created_at` and done-ness, and gets the new day order; clearing drops schedule, due and order; a completed task stays completed; closures are kept; a plain edit doesn't touch the schedule; a missing task → `{ok:false}` with no call.
- **Rendering:** default chronological order + `<time>` labels; the overdue class; detail fields RU/UK; no dateless time shown; seed rows unscheduled; the missing state with disabled actions.

**Other test checks:**
- The date-sensitive files (5 files, 136 tests) pass under `TZ=UTC`, `Europe/Kyiv`, `America/Los_Angeles` and `Pacific/Kiritimati`.
- A mutation that drops the time-needs-date rule fails 2 tests; it was reverted byte-identically.

**Browser** (production preview + API on lifeos_test; new disposable account `qa-g2-dates-20260930@example.com`):

| Check | Result |
|---|---|
| Capture → Clarify (key 3) → Defer tomorrow | task `schedule {2026-10-01}` on the server (rev 3), in the Calendar day 1 October |
| Tasks «сегодня»/«просрочено» | empty: the legacy seed «выпустить лендинг» (tag today + stakes) and «зафиксировать цели Q4» (due 17:00) no longer appear. «все» by date: the dated task first |
| Detail: clear the date, then enter a time only → Save | time cleared with the date; the time-only save was rejected with a localized alert + `aria-invalid`; no write |
| Detail: today 09:30 → Save | rev 4, same id and `created_at`, `due` 09:30, `order` 0, activity `edited` [schedule]; in «сегодня»; Calendar: gone from 1 October, on 30 September at 09:30 |
| Yesterday → Save | rev 5; in «просрочено» with the red label; «сегодня» empty |
| Moved to tomorrow, reload | persisted; the page clock +24 h + a focus event → the task appears in «сегодня» without a reload, and leaves again when the clock is restored |
| «убрать дату» → Save → «да, без даты» | confirmation first (no write), then rev 7: `schedule:null`, `due:''`, `order` dropped; still under «все»; the Calendar day is empty |
| Detail open, task removed underneath | «этой задачи больше нет — изменения не сохранены»; Save, Complete and the menu disabled; ⌘↵ and Escape → nothing recreated |
| G1 | delegate → received → restore → convert → convert = applied ×3 / unchanged; the task is undated and not in «сегодня»; the closed list renders |
| Task History | checkbox → done + `completed_at`, `release` played once (the doubled log entry was a double instrumentation wrap: one source node was created); in Calendar History; «восстановить» → active, same id |
| Keyboard | the detail opens with focus inside and Tab contained; Escape closes; the Clarify digit keys work |
| Layout | 48/48 clean: 320/390/768/1440 × dark/light/paradise × RU/UK, list + detail open, default **and** the armed-confirmation state. Document overflow 0, all dialog controls inside the viewport, iframe width asserted, locale asserted per frame. The first pass found the footer overflow at 320 (and 390 paradise); it was fixed and re-measured |
| Visual | 320 paradise UK after a real theme reload: detail sheet, date/time row, «прибрати дату» |
| Console / API | no page errors; the API log had no 5xx or traceback (the only 4xx were the pre-login session check and the first state GET before initialisation) |

**Harness notes:**
- The automation tab reports `visibilityState: 'hidden'`. The first rollover attempt exposed that the watcher skipped wakes while hidden. That gate was removed, since a wake only compares dates, and the rollover was re-verified.
- Native date pickers were filled through the input's value setter; the saves themselves were real clicks.

## 5. Limitations

- The Calendar page itself still computes "today" at render; only the Tasks views follow rollover live. Calendar is out of G2 scope.
- If the task open in the detail is deleted underneath it, focus falls back to `<body>` on close, because the opener row no longer exists.
- Legacy seed rows keep their legacy display labels, e.g. `17:00` or «до конца дня», with no date meaning. That label is only a display string now.
- Home still shows seed data (a known §78 gap, out of scope).
- A stakes toggle without a schedule change does not re-derive `due` (unchanged pre-existing behaviour).
- Test data remains in lifeos_test for the QA account: one deleted seed task, one regression task, one closed Waiting record.

## 6. Publication status

Local commits only on `fix/lifeos-completion-audit`. They are not pushed: the branch is absent from `origin`, there is no PR, and nothing is merged or deployed. G3 was not started.
