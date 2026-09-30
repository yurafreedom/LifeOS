# LifeOS GTD — completion plan

Timestamp: 2026-09-30 13:10 EEST (`20260930-131011`).
Input: `Outputs/Discoveries/lifeos-gtd-current-state_20260930-131011.md` (evidence and matrix).
Status: **plan only — nothing here is implemented or authorised for implementation.**

---

## 0. Summary

Capture → Inbox → Clarify (all six outcomes) is complete and durable.
The cycle breaks **after** Clarify:

- **Waiting** items cannot be processed.
- The Tasks «сегодня/просрочено» filters ignore `schedule.date`.
- Projects have no actions.
- There is no GTD review.

Only the first two rest on accepted requirements:

- Waiting: the accepted Delegate outcome plus the Clarify report's explicit "worth an owner decision".
- Tasks: the `schedule.date` date authority plus the §78 finding.

Next actions, Weekly Review and Focus Now exist only as the unaccepted 2026-07-01 proposal (MASTER-PROMPT §C).

Recommended order:

| # | Slice | Gate | Why this position |
|---|---|---|---|
| **G1** | **Waiting For lifecycle** | 3 owner decisions (§2) | Closes the one accepted outcome that dead-ends. Small, frontend-only, no migration |
| G2 | Tasks «сегодня/просрочено» on `schedule.date` + reschedule from the Tasks detail | 1 owner decision (already open in §78) | Makes Do-Now/Defer output reachable in Engage; foundation for G6 |
| G3 | Reference maintenance (edit, delete) | 1 small decision | Minor; completes Clarify destinations |
| G4 | Project ↔ Task link + next action | owner must accept the requirement first | Largest semantic addition; prerequisite for a useful review/focus |
| G5 | GTD Weekly Review | owner must accept the requirement first | Depends on G1 (+G4 for the project step) |
| G6 | Engage / Focus Now | owner must accept the requirement first | Depends on G2 (+G4) |

Someday/Maybe, @contexts, energy/time filters, Areas, horizons, Inbox Zero and
Waiting follow-up dates are **not planned**. They have no accepted source (discovery §3).
Do not add them unless the owner explicitly decides to.

---

## 1. Preconditions for any slice

1. **Publish the completion-audit branch first.** `fix/lifeos-completion-audit`
   (`1b396eb`) is local-only and modifies `apps/web/src/pages/TasksPage.jsx`
   and `App.jsx`. G1 and G2 edit the same files. Order: owner review → push →
   PR → merge commit → `main` fast-forward → new feature branch from `main`.
   Alternative: branch G1 from `fix/lifeos-completion-audit`. This stacks PRs,
   which is not recommended.
2. Standard gates from `AGENTS.md`. `lifeos_test` only for backend checks.
3. Honour existing contracts:
   - Clarify regression contract (§66–68): `domain/clarify.ts` is on the
     do-not-split list (`module-boundaries.md`).
   - Snapshot version stays 2.
   - `Project ≠ Goal`.
   - Quick Notes are preserved on failure.

---

## 2. Slice G1 — Waiting For lifecycle (RECOMMENDED FIRST)

### User-visible outcome
In Tasks → «ожидание», each waiting item can be opened. The user can then:
- correct the title and set/edit «от кого» (the person);
- mark it **получено** (received) or **отменить ожидание** (cancelled);
- turn it **в задачу** (back into an ordinary open Task);
- delete it permanently after confirmation.

Resolved items leave the active list and appear in a «закрыто» section with
their outcome and date. Received/cancelled items can be restored. Everything
survives reload. RU and UK.

### Existing foundation
- `waitingItems[]` `{id, title, waiting_for|null, created_at}` (`domain/clarify.ts:40-45`), validated in `context/lifeData/migrate.js:50-54`.
- Read-only list in `TasksPage.jsx:90-114`.
- The `waiting_for` display is already wired.
- Task builder `createClarifiedTaskRecord` (no invented date).
- `LifeActivity.append`.
- Precedent for closure/History/Restore in `domain/tasks.ts` (Calendar OD-1).

### Remaining work
1. **New pure module `apps/web/src/domain/waiting.ts`**. `clarify.ts` stays untouched.
   - **Types:**
     - `WaitingResolution = 'received' | 'cancelled' | 'converted'`.
     - Additive optional fields: `resolution`, `resolved_at` (ISO), `converted_task_id` (task id), `updated_at` (ISO).
   - **Validator `validateWaitingLifecycle(value)`**, called from `migrate.js` after `validateWaitingItemRecord`. It checks each optional field only when present:
     - `resolution` and `resolved_at` must appear together;
     - `converted_task_id` only with `converted`;
     - legacy rows pass untouched.
   - **Readers:** `isWaitingActive`, `activeWaitingItems` (current order), `resolvedWaitingItems` (newest `resolved_at` first).
   - **Transitions** (pure; each returns a new array or state):
     - `updateWaitingItem(items, id, {title?, waiting_for?}, now)` — active only; title required; empty person → `null`.
     - `resolveWaitingItem(items, id, 'received'|'cancelled', now)`.
     - `restoreWaitingItem(items, id)` — received/cancelled only. A converted item cannot be restored, because its Task already exists.
     - `deleteWaitingItem(items, id)` — permanent, any state.
     - `convertWaitingItemToTask(state, id, now, taskId)` — one returned state:
       - appends `createClarifiedTaskRecord(item.title, taskId, now)` to `tasks`;
       - marks the item `converted` with `converted_task_id`;
       - appends activity entries;
       - returns `previous` unchanged if the item is missing or already resolved (idempotent, Clarify precedent).
2. **Provider** (`context/LifeDataContext.jsx`): wire `updateWaitingItem`, `resolveWaitingItem`, `restoreWaitingItem`, `deleteWaitingItem` and `convertWaitingItemToTask` through `setStateRaw`/`mutate`.
   - Log activity with `entity_type:'waiting'` and actions `updated | received | cancelled | converted | restored | deleted`.
   - Validate before writing; throw a typed error for stale ids so the UI can report it.
3. **UI:**
   - `TasksPage.jsx` waiting branch:
     - rows become buttons;
     - active count shown on the section meta;
     - a «закрыто» section (collapsed by default) with the resolution label and date, plus «вернуть» for received/cancelled.
   - New `components/WaitingItemModal.jsx`, using the existing modal and focus patterns (as `TaskDetailModal`). It contains:
     - title and «от кого» inputs;
     - Save, Получено, Отменить ожидание, В задачу;
     - two-step Delete;
     - Esc/close with no change.
   - `App.jsx` passes the handlers.
   - RU/UK keys in `context/locale/ru.js`, `uk.js`.
   - Toasts use the existing `showToast`.
4. **Docs:**
   - `Outputs/architecture/module-boundaries.md`: add a row «waiting lifecycle → `domain/waiting.ts`».
   - Implementation report under `Outputs/Implementations/`.

### Included / excluded
- **Included:** everything above.
- **Excluded:**
  - follow-up/due dates, reminders, notifications, a "waiting > N days" detector;
  - a person/contact entity (the person stays free text);
  - a counterparty input inside the Clarify panel (see OD-G1-2);
  - showing Waiting on Home or Calendar;
  - a Sidebar waiting count;
  - Reference changes;
  - project links;
  - backend changes;
  - AA facts for waiting;
  - a Someday list.

### Models / APIs / persistence
- **Snapshot:** additive optional fields on `waitingItems[]` rows only. Version stays 2.
- **Backend:** no change. `PUT /api/v1/state` stores the payload opaquely (`apps/api/app/schemas/state.py`).
- **Export and account delete:** covered automatically through `user_snapshots`.
- **Migration:** none (no Alembic, no version bump). Existing rows are valid active items.
- **Compatibility:** an older deployed bundle that reads a snapshot with the new fields still validates it (the old validator ignores unknown keys). It would show resolved items as active until reload on the new bundle. That is acceptable, transient and non-destructive. It cannot corrupt the fields: the old client writes back the whole payload it loaded, and spread preserves unknown keys **[I — verify in implementation with a test that migrate + an old-shape write preserve the fields]**.

### Acceptance criteria
1. A waiting item created through Clarify can be opened from Tasks → «ожидание».
2. Title and person edits persist across reload. An empty title is rejected; the modal stays open and the data is unchanged.
3. «Получено» / «Отменить ожидание» move the item to «закрыто» with the correct label and `resolved_at`. It is no longer in the active list.
4. «Вернуть» restores received/cancelled items to active with the same id. Converted items have no restore action.
5. «В задачу» creates exactly one ordinary open Task: title = the waiting title, no date, `stakes:false`, `created_at` set. The waiting item becomes `converted` with `converted_task_id`, in one state update. Double activation creates no duplicate.
6. Delete requires confirmation and removes the item permanently. Cancelling the confirmation changes nothing.
7. Legacy snapshots (the four-field rows) load unchanged. A malformed lifecycle field is rejected at `migrate.js`, following the precedent.
8. Clarify behaviour and tests are unchanged. `domain/clarify.ts` is untouched.
9. No new dependency, no backend or migration change. RU/UK parity. Keyboard: Esc closes, focus returns to the row.
10. Full `AGENTS.md` gates green.

### Tests
- `src/test/waiting-domain.test.ts`:
  - every transition, including the idempotency, stale-id and restore-converted guard;
  - validator acceptance/rejection;
  - legacy row pass-through;
  - activity entries.
- `src/test/state-migration.test.ts`: extend with lifecycle fields (valid, malformed, legacy).
- `src/test/waiting-ui.test.jsx`, using `renderToStaticMarkup` (the repo has no DOM library):
  - active/closed sections;
  - the counts;
  - the person line;
  - the modal markup in each state;
  - RU/UK keys present.
- A source-contract test that `clarify.ts` has no waiting-lifecycle imports (keeps the Clarify contract).

### Manual checks (disposable account on `lifeos_test`)
1. Capture → Clarify → Delegate.
2. Open the item, set the person, then reload.
3. Mark received, then reload.
4. Restore it.
5. Convert to a task: the task appears in Tasks «все» and not in Calendar (no date).
6. Delete with confirmation.
7. Repeat at 390 px mobile width and in dark/light themes.
8. Check export JSON contains the fields.

### Owner decisions required before G1
See §7, OD-G1-1..3.

---

## 3. Slice G2 — Tasks «сегодня/просрочено» by `schedule.date`, reschedule from Tasks

- **Outcome:**
  - «сегодня» lists active tasks dated Kyiv-today.
  - «просрочено» lists `isTaskOverdue`.
  - The Tasks detail modal can set, change or clear the date (the same semantics as `CalendarTaskEditor`).
  - So Do-Now/Defer output is reachable from Tasks.
- **Foundation:**
  - `taskDate`, `isTaskOverdue`, `localDateForInstant` (Kyiv);
  - Calendar editor semantics;
  - the `semanticDue` sync of the legacy `due` label.
- **Work:**
  - replace the predicates at `TasksPage.jsx:43-44`;
  - make «date» sort real (by `schedule.date`, then time);
  - add a date/time field to `TaskDetailModal` that patches `schedule` + `due` via the existing `updateTaskFields`.
- **Excluded:** Home redesign, Focus Now, priority/context fields, recurrence.
- **Persistence:** none new.
- **Migration:** none. Seed rows with `tag:'today'` and no `schedule` are handled per OD-G2-1.
- **Acceptance:**
  - a deferred task appears under «сегодня» exactly on its date and under «просрочено» afterwards if still active;
  - closed and completed tasks never appear in either;
  - rescheduling from Tasks moves the task in Calendar;
  - Kyiv-midnight edge tests pass under `TZ=UTC`.
- **Tests:**
  - extend `task-domain.test.ts` with a pure `tasksForTodayFilter`/overdue selector;
  - Tasks UI static tests;
  - Kyiv edge regressions.
- **Decision:** OD-G2-1 (§7).

## 4. Slice G3 — Reference maintenance

- **Outcome:** a Reference row can be opened, its text edited, or deleted after confirmation.
- **Foundation:** `references[]`, the Notes section.
- **Work:**
  - `domain/reference.ts` (update/delete + optional `updated_at`);
  - provider actions;
  - a small modal;
  - RU/UK.
- **Excluded:** search, folders, tags, backlinks, sending back to Inbox.
- **Persistence:** additive optional `updated_at`; no migration.
- **Acceptance:** edit persists; empty text is rejected; delete is permanent after confirmation; legacy rows are valid.
- **Decision:** whether to add «вернуть во входящие» (re-clarify). Recommendation: no, not accepted anywhere.
- Can be merged into G1's PR only if the owner prefers fewer PRs. Recommended as a separate PR.

## 5. Slice G4 — Project ↔ Task link and next action (requirement not yet accepted)

- **Outcome if accepted:**
  - a task can belong to one active Project;
  - a project card shows its open tasks and its next action;
  - active projects with no open task/next action are flagged «нет следующего шага».
- **Foundation:**
  - Project domain (`projects.ts`);
  - Task domain;
  - `ProjectCard`.
  - Clarify→Project already creates the Project.
- **Model proposal:** additive optional `task.project_id` (string, must reference an existing project). Next action is either:
  - (a) an explicit `project.next_action_task_id`; or
  - (b) derived as "the first active task of the project in the user's order".
- **Work:** domain validation, provider actions, a task-detail project selector, ProjectCard section, RU/UK.
- **Project completion:** the behaviour of linked open tasks per OD-G4-3.
- **AA:** no new facts unless separately planned. Project forecast/actual stay unchanged.
- **Migration:** none (additive). Validation must tolerate dangling ids after a project is deleted or archived. Projects cannot be deleted today.
- **Excluded:** subprojects, Areas, Goal linkage, auto-generated tasks.
- **Decisions:** OD-G4-1..3 (§7). They are listed now but are **not** needed before G1.

## 6. Slices G5 / G6 — Weekly Review and Engage (requirements not yet accepted)

**G5 GTD Weekly Review**, if accepted. This is a guided checklist page (not AA) over live lists:
1. Inbox count, linking to Notes.
2. Active Waiting items (G1).
3. Overdue and next-7-days tasks (G2).
4. Active projects without a next action (G4).

"Завершить обзор" appends `{id, completed_at, counts}` to a new snapshot collection `gtdReviews[]`. This is append-only history. There is no scheduler, no notifications and no automatic reset.

The shipped System Review copy (`aa_sr_relation_to_rest`, RU/UK) that mentions a «недельный обзор задач» must either point to G5 or be rewritten. That copy fix is independent and tiny.

**G6 Engage / Focus Now**, if accepted. A Home or Tasks panel shows up to 3 active actions:
- overdue first;
- then today;
- then project next actions (G4);
- stakes first within each group.

Each action offers Выполнить / Перенести (date) / Открыть. There are no contexts, energy or time filters unless the owner separately accepts those inputs. Its seed-data replacement overlaps the Home truthfulness gap in §78.

---

## 7. Owner decisions

### Required before G1 (the only blocking decisions now)

**OD-G1-1 — What "done" means for a Waiting item.**
- **Recommended (A):** keep the record. Set `resolution ∈ {received, cancelled, converted}` + `resolved_at` and show it in «закрыто». Received/cancelled can be restored. Delete is a separate, permanent action.
  - This matches the Task closure/History/Restore precedent (Calendar OD-1) and the "append/version rather than overwrite" principle.
  - It preserves who/what was delegated.
- **(B) Remove on resolve:** simpler, but it loses the delegation history. There is no undo, and a mis-tap destroys data.
- **(C) Delete only:** it cannot distinguish received from abandoned, and it makes a future Weekly Review blind to outcomes.

**OD-G1-2 — Where the person («от кого») is entered.**
- **Recommended (A):** only when editing the item after Delegate. The Clarify panel keeps its accepted one-tap Delegate (handoff and §66 regression contract unchanged). `waiting_for` was designed to be "filled later without a migration" (Clarify report §13.2).
- **(B) Optional inline field in Clarify Delegate:** faster to fill, but it changes an accepted handoff and the Clarify contract. It needs design approval and adds a second step to a one-tap outcome.

**OD-G1-3 — Follow-up date.**
- **Recommended (A):** not in G1. No accepted source requires it, and forensic lists it as unresolved.
- **(B) Optional `follow_up_date`:** it immediately raises unresolved questions:
  - Does it appear in the Calendar?
  - Does it become overdue?
  - Are there reminders?
  That would turn G1 into a scheduling feature. Revisit with G5/G6.

Sub-choices that follow from recommendation (A) and need no separate decision unless the owner objects:
- «В задачу» creates an undated Task with the waiting title only. The person is kept on the resolved waiting record and not copied into task notes (no invented text).
- Delete requires two-step confirmation, as for Tasks and Quick Notes.

### Required before G2
**OD-G2-1 — Meaning of «сегодня».**
- **Recommended:** active tasks with `schedule.date == Kyiv today`.
  - Undated tasks stay under «все».
  - The legacy `tag==='today' || stakes` predicate is dropped.
  - Undated seed tasks tagged `today` then leave «сегодня».
- **Alternative:** additionally keep undated `tag==='today'` rows, for continuity. The filter then mixes two semantics, and that tag keeps a meaning nobody accepted.

«просрочено» = `isTaskOverdue` is not a real choice: it is the existing domain definition.

### Required before G4–G6 (acceptance of the requirement itself)
- **OD-G4-0:** Should Projects contain tasks and a next action at all? Clarify report §15 lists it as explicit non-scope, and the only source is the 2026-07-01 proposal.
- **OD-G4-1:** How is the next action chosen: explicit pointer or derived first active task? Recommended: derived, which needs no extra state and cannot dangle.
- **OD-G4-2:** Should Clarify→Project offer an optional first action? Recommended: no in G4. It changes the Clarify contract.
- **OD-G4-3:** What happens to open tasks when a project is completed?
  - Recommended: block completion while linked active tasks exist, with an explicit per-task choice.
  - Alternatives: auto-close them (hidden bulk mutation); leave them linked to a completed project (orphans).
- **OD-G5-0:** Should LifeOS have a GTD Weekly Review? This includes scope, the persisted completion record, and what happens to the System Review copy.
- **OD-G6-0:** Should LifeOS have Focus Now? If yes, which inputs (the stakes/date/project only, as recommended) and where it lives (Home vs Tasks)?

---

## 8. MASTER_CONTEXT addition (applied as §79)

```text
79. GTD STATUS — RECONCILED 2026-09-30
Evidence: Outputs/Discoveries/lifeos-gtd-current-state_20260930-131011.md
Plan:     Outputs/Plans/lifeos-gtd-completion-plan_20260930-131011.md
Verified complete: Capture (Quick Notes inbox) and Clarify, all six outcomes,
durable in the server snapshot. Defer = explicit future schedule.date; no
hidden someday bucket.
Verified partial/missing: Waiting items are create+list only (no edit, person
entry, resolve, convert or delete); References are create+list only; Tasks
«сегодня/просрочено» use legacy predicates, not schedule.date; no Task↔Project
link or next action; no GTD Weekly Review (System Review copy in RU/UK refers to a
«недельный обзор задач» that does not exist); no Focus Now/Engage surface.
Accepted requirements vs proposals: next actions, Weekly Review, Focus Now,
@contexts/energy/time, Someday/Maybe, Areas, horizons, Inbox Zero and Waiting
follow-up dates come only from the 2026-07-01 MASTER-PROMPT §C proposal
(archived as obsolete-instructions; forensic: PROPOSED_SCOPE_INPUT). They are
not requirements until the owner accepts them. Original conversations.json is
missing.
Recommended next GTD slice: G1 Waiting For lifecycle, after publishing
fix/lifeos-completion-audit; needs owner decisions OD-G1-1..3.
```
