# Audit follow-up — Calendar Kyiv day and stale editor drafts

Date: 2026-09-30 · Branch: `fix/lifeos-completion-audit` · Base: `fdd1bb9`
Commits (local only; not pushed, no PR, no merge, no deploy):

- `ce985a7` fix(web): Calendar follows the live Europe/Kyiv day
- `4c6f04c` fix(web): task editors save only genuinely edited fields; surface conflicts
- docs commit: this report + `LIFEOS_MASTER_CONTEXT.md` §80/§81 headings, §83

G3 was not started. Existing commits, owner files (`sfx/`,
`LifeOS_Completion_Audit_20260930.md`, `apps/web/src/Архив.zip`) and the
recovery stash were not touched.

## 1. Calendar follows the current Europe/Kyiv day

**Defect.** `CalendarPage` memoised `calendarBounds(tasks)` on `[tasks]`, so
"today" froze until the task array changed.

**Fix.**
- `CalendarPage` reads the existing `useKyivToday()` hook (next Kyiv midnight,
  capped at 1 h, plus focus / visibilitychange / pageshow). No new timers.
- New `calendarBoundsForDay(tasks, today, floorYear?)` in
  `domain/calendarModel.ts`; `calendarBounds(tasks, now)` now delegates to it,
  so the Kyiv day still comes only from `todayDateOnly` / `localDateForInstant`.
- Memo deps: `[tasks, today, openedYear]`.
- What moves at rollover: today highlight, the Today button target,
  `currentYear` (year window and year cube), and the overdue label plus
  «закрыть без выполнения» in an already-open Day Manager.
- What stays: explicit `#/calendar/YYYY[-MM[-DD]]` and `years/YYYY` routes.
  The Day Manager `key` is the route day, so an open Day Manager and its
  nested editor, including an unsaved draft, stay mounted.
- The undated `#/calendar` route keeps its meaning, "the current Kyiv month",
  and so follows the rollover.
- New Year: the Kyiv year the page opened in stays a navigable `minYear`
  floor while the page is mounted. An explicit route into the year just left
  (for example an open 31 December Day Manager at midnight) is therefore not
  treated as invalid and replaced. A fresh load keeps the original rule,
  `min(current year, earliest dated task)`.

## 2. Stale editor drafts no longer overwrite untouched fields

**Defect.** `CalendarTaskEditor.editorResult` and `TaskDetailModal`
(`taskDetailPatch` + `scheduleEdit`) compared the form's opening values against
the latest task prop. Take a task replaced under a mounted editor (A, 30 Sep
09:00 → B, 1 Oct 10:00). If the user edited only the notes, the save restored
title A and 30 Sep 09:00.

**Fix.**
- `domain/editDraft.ts` handles each field against a baseline:
  - **untouched:** keeps the latest value.
  - **edited, and the persisted value is unchanged:** the edit is applied.
  - **both sides made the same change:** no-op.
  - **otherwise:** conflict.
  - `rebaseUntouched` moves untouched fields to the latest value, so the form
    shows what is saved.
  - `resolveDraftConflicts` handles `mine` and `saved`.
- `scheduleEdit(task, input, baseline?)` treats `{date, time}` as one unit.
  An input equal to the baseline is never re-sent. An edit over a schedule that
  also changed meanwhile returns `conflict` instead of moving the task. Without
  a baseline, behaviour is unchanged.
- `editorResult(task, form, t, baseline?)` and
  `taskDetailPatch(task, draft, t, cats, baseline?)` behave as before when no
  baseline is passed. The new `taskDetailResult` makes the whole Tasks-detail
  save decision in this order: validation errors, then conflicts, then
  `{patch, schedule, clearsDate}`.
- `components/EditConflictNotice.jsx` is a shared `role="alert"` notice:
  - It lists each conflicting field with its current saved value.
  - «взять сохранённое» puts the saved value into the form and keeps the
    editor open.
  - «оставить моё» overwrites explicitly: it rebases on the saved value and
    saves. If the value changed again in the meantime, the conflict is
    reported again.
  - Nothing is saved while the notice is shown, and the draft is kept.
  - RU/UK add 7 keys each; the locale pin is now 1818/1817.
- Unchanged:
  - missing-task protection (`missing` state, `saveTaskDetail` returns
    `{ok:false}` and never recreates);
  - lifecycle fields (not editor fields);
  - date validation (it runs before conflicts);
  - the clear-date confirmation;
  - the rule that an emptied Tasks-detail title is ignored.

## Verification

| Check | Result |
|---|---|
| RED before the fixes | 16 of 20 new tests failed for the reported reasons: stale title and schedule in the patch; Sept today / 2026 window after a mocked rollover |
| `npm test` (apps/web) | 727 passed / 52 files |
| `npm run typecheck` · `lint` · `build` | PASS |
| `git diff --check` | clean |
| New tests under TZ=UTC, Europe/Kyiv, America/Los_Angeles, Pacific/Kiritimati | 68/68 each |
| Backend | not run: no backend change |

The new tests are `test/calendar-rollover.test.jsx` and
`test/editor-stale-draft.test.jsx`. They cover:
- untouched-field preservation and genuine edits;
- same-field conflicts, including date/time as one unit;
- convergent edits;
- date clearing, both confirmed and conflicting;
- deleted tasks;
- display-only rows;
- the editDraft primitives;
- the localized notice in RU and UK;
- midnight, tab-return and year-boundary bounds;
- the Today button target;
- explicit routes and the undated route.

**Browser (production `vite preview` + API on `lifeos_test`, QA user
`qa-stale-draft-20260930@example.com`).**
- **Calendar editor repro.** Before the edit, the form fields rebased to B and
  1 Oct 10:00. Saving an edit to notes only stored notes, title B and
  1 Oct 10:00.
- **Same-field title conflict.** The localized notice appeared, the draft «C»
  was kept and nothing was saved. «оставить моё» then saved C.
- **Tasks detail repro.** The untouched fields rebased. Saving an edit to notes
  only kept E and 2 Oct 08:00.
- **Tasks detail schedule conflict.** The notice showed «2026-10-03 08:00» and
  the draft stayed. «взять сохранённое» filled 2026-10-03 08:00 and the dialog
  stayed open.
- **Task deleted while the Tasks detail was open.** The missing message
  appeared, save was disabled and the draft text was kept.
- **Kyiv midnight** (`Date.now` shifted, `focus` fired) with
  `#/calendar/2026-09-30` and the editor open showing a draft:
  - the row gained «просрочено» and «закрыть без выполнения»;
  - 30 Sep lost is-today;
  - the hash, the editor and the draft were unchanged;
  - Today then went to October 2026 with 1 Oct marked.
- **New Year** (`visibilitychange`) on `#/calendar/2026-12`, with no 2026
  tasks left:
  - the route stayed, and the heading still read «декабрь 2026»;
  - the years window was 2027–2056 with 2027 current;
  - `#/calendar` showed January 2027 with 1 Jan marked.
- **Console.** No errors, but tracking only started after the page loaded.

## Limitations

- **Calendar editor, task deleted while open.** The editor unmounts and its
  draft is lost. This is existing behaviour and was kept deliberately; the
  Tasks detail does keep the draft.
- **Conflict scope.** Conflicts are detected against what the editor saw. If
  a persisted change arrives after the user presses «оставить моё» and before
  that save lands, the provider overwrites it. The time between the two is
  one React event, and provider updates are local-first.
- **New Year floor.** The `minYear` floor lasts for the mounted page only. A
  reload on 1 January with no earlier dated tasks treats last year's routes
  as out of range (existing semantics).
- **Rollover tests.** The rollover-to-render wiring is unit-tested with a
  mocked `useKyivToday`, because the test environment is `node` and has no
  DOM. The hook's timer and events keep their existing G2 tests. The real
  wiring was exercised in the browser.
