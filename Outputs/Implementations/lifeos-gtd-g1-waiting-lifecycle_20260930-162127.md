# LifeOS GTD — Slice G1: Waiting For lifecycle

Date: 2026-09-30 (Europe/Kyiv) · Branch `fix/lifeos-completion-audit` · HEAD `1b396eb7ed4b7ad6a791f3bab3d316daae69dac2`
Status: **implemented in the working tree, UNCOMMITTED, not pushed, no PR, not merged, not deployed.**
Plan: `Outputs/Plans/lifeos-gtd-completion-plan_20260930-131011.md` §2 · Discovery: `Outputs/Discoveries/lifeos-gtd-current-state_20260930-131011.md`

## 1. Baseline (verified at start)

| Item | Value |
|---|---|
| Checkout | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem`, single worktree |
| Branch / HEAD | `fix/lifeos-completion-audit` @ `1b396eb` (as reported) |
| `origin/main` | `5e858bb0322be0cc729d3d7e73ce359597aada84` |
| Remote branch | none (`git ls-remote origin fix/lifeos-completion-audit` empty) |
| Working tree at start | 20 modified + 47 untracked paths (audit D1–D3, UI sound, GTD docs, owner `sfx/` and audit file); status and SHA-1 of every path recorded before any edit |
| Stash | `stash@{0}` (slice2 preservation) — untouched |
| Running sessions | no LifeOS servers; an unrelated project's Vite on `[::1]:5173` (left alone) |

## 2. Owner decisions applied

All ten approved decisions are implemented as specified:
1. Resolved records are **kept**, with `resolution` ∈ `received | cancelled | converted`, `resolved_at`, and `converted_task_id` (converted only).
2. Active and closed records are shown separately.
3. Received/cancelled records restore with the **same id**.
4. Converted records have no restore path, neither in the UI nor in the domain (`not_restorable`).
5. Delete is separate, permanent and two-step confirmed.
6. The person is optional free text, editable after Delegate; empty → `null`.
7. Clarify's one-tap Delegate is unchanged. `domain/clarify.ts`, `ClarifyPanel.jsx`, `clarifyHandlers.js` and the three Clarify test files are byte-identical to `origin/main`.
8. There are no follow-up dates, reminders, contacts, Calendar entries or AA facts.
9. Convert creates **one ordinary undated Task** via the existing `createClarifiedTaskRecord` (`due:''`, `schedule:null`, `stakes:false`, `tag:null`, `notes:''`, `created_at`). The person stays on the closed Waiting record.
10. Snapshot compatibility is **demonstrated** (§6), including with the real older bundle.

G2–G6 were not started.

## 3. Implemented behaviour

### Domain — `apps/web/src/domain/waiting.ts` (new, pure)

- **`applyWaitingCommand(state, command, now)`**
  - Commands: `update`, `resolve` (received/cancelled), `restore`, `convert`, `delete`.
  - Returns exactly one of:
    - `applied` — new state, record and task;
    - `unchanged` — same state object: a repeat or no-op edit;
    - `invalid` — same state object plus a code: `missing`, `empty_title`, `not_active`, `not_restorable`, `invalid_resolution`, `invalid_person`, `invalid_command`, `state_missing`.
- **Edit rules.** Edits apply to active records only and write only the fields that actually change. Pending edits can travel with an outcome in the **same** transition, so typed text is never silently dropped.
- **Convert.**
  - The task and the closure land in one returned state, with two activity entries (`task created` + `waiting converted`).
  - A repeat conversion is `unchanged`.
  - The task id never collides with an existing one.
- **Activity log.** Every applied command appends its entries (`entity_type:'waiting'`, actions `updated | received | cancelled | restored | converted | deleted`) in the same state object.
- **`validateWaitingLifecycle`.** Called from `migrate.js` right after clarify's `validateWaitingItemRecord`. Rules:
  - `resolution` must be in the set;
  - `resolution` and `resolved_at` must appear together, as ISO instants;
  - converted ⇔ `converted_task_id`, which must be a safe integer or a non-empty string;
  - `updated_at` must be ISO.
  - Chronology is deliberately **not** enforced: device clocks can disagree, and a rejected field rejects the whole snapshot.
- **Selectors:** `activeWaitingItems` (stored order), `closedWaitingItems` (newest `resolved_at` first), `canRestoreWaiting`.

### Provider — `LifeDataContext.runWaitingCommand` (+ `domain/waiting.ts::commitWaitingCommand`)

- **How it runs.** The command runs inside the functional `setStateRaw` updater under react-dom's `flushSync`. The outcome is therefore computed from the state React actually applies, including updates still queued, and not from the render-time `state` closure.
- **Determinism.** `now` and the task id are fixed before the updater runs, so a StrictMode re-invocation computes the identical result.
- **Unmounted provider.** If the updater never runs, the outcome is `invalid`, never a success.
- **Contrast with Clarify.** This deliberately differs from Clarify's render-closure pre-check, which the discovery flagged as a low-risk false-success path. Clarify itself was not changed.

### UI

- **`pages/TasksPage.jsx`: new `WaitingSection`** (the `TasksPage` signature line is unchanged, as a Clarify test pins it).
  - Active rows are buttons (`aria-haspopup="dialog"`).
  - The meta line shows «передано · ждём ответа · активно: N».
  - «закрыто · N» is a disclosure (`aria-expanded`, collapsed initially). Closed rows show a localized outcome chip and the Europe/Kyiv date (`formatInstantDate`).
  - «вернуть» appears only for received/cancelled.
  - A `role=status` line (`alert` for errors) reports outcomes, following the Calendar Day Manager precedent.
  - Created dates are also Kyiv dates now (previously the raw UTC `slice(0,10)`).
- **`components/WaitingItemModal.jsx`** (new), built on `useDialog` (focus trap, Escape, scroll lock, focus return) and the Calendar editor chrome.
  - **Active record:**
    - fields: «что ждём» and «от кого»;
    - Save is a submit button, so Enter and ⌘↵ both save;
    - outcomes: получено / отменить ожидание / в задачу;
    - two-step delete, with focus on the safe «отмена».
  - **Closed record:** read-only, «вернуть» only when permitted, and a note explaining why a converted record can't return.
  - **Missing record:** a localized explanation and no actions.
  - **Closing without saving:** ×, Escape, «отмена» and the backdrop discard the draft.
  - **After Save:** the dialog closes.
  - **After an outcome:** the dialog stays on the closed record (undo within reach), and focus moves to the dialog heading.
  - **Invalid input:** the dialog stays open with a localized `role=alert` message; for the title field, `aria-invalid` is set and focus returns to it.
  - **Focus restoration:** if the opener row vanished, focus goes to the same record's row in its new list, else to the list heading, else to the empty state.
- **Copy:** RU/UK, +37 keys each. Every UK string differs from RU, which the existing Clarify localisation test enforces for `waiting_*`.
- **Styles:** a small `wt-*` block beside the existing `.waiting-*` rules in `styles/pages-core.css`, using theme tokens. At ≤480 px the row meta wraps under the title.

### Sound integration (existing system, no new emits)

- **Outcome buttons** keep the dialog open, so the arbiter plays the ordinary `control.activate` cue. Verified in the browser: «получено» played `click`, not `release`/`task.complete`.
- **Save** is a submit CTA (primary), so it plays `click`. There is no `save.success`, because this is a local snapshot change.
- **Escape/×** play `modal.close`.
- **The «закрыто» expander** plays `panel.expand`.
- **Confirmed delete** closes the dialog, so it plays `modal.close` — the same as the existing TaskDetailModal delete. This is noted for the owner's sound review, not changed.

## 4. Changed files

**G1-only (new, or first touched by G1):**
- `apps/web/src/domain/waiting.ts` (new)
- `apps/web/src/components/WaitingItemModal.jsx` (new)
- `apps/web/src/test/waiting-domain.test.ts` (new, 37 tests)
- `apps/web/src/test/waiting-ui.test.jsx` (new, 12 tests)
- `apps/web/src/context/lifeData/migrate.js` (lifecycle validator call)
- `apps/web/src/styles/pages-core.css` (`wt-*` block)
- `apps/web/src/test/state-migration.test.ts` (+3 tests)
- `outputs/implementations/lifeos-gtd-g1-waiting-lifecycle_20260930-162127.md` (this report; stage as `Outputs/Implementations/…` with `git update-index`, because of the on-disk lowercase directory)

**Pre-existing modified files that G1 appended to** (baseline hashes differed only by these additions):
- `apps/web/src/context/LifeDataContext.jsx`: `flushSync` import, `commitWaitingCommand` import, `runWaitingCommand`, and its export in the context value. The sound `completesTask` / `emitTaskComplete` edits are untouched.
- `apps/web/src/pages/TasksPage.jsx`: `WaitingSection`, modal wiring, imports. The sort trigger's `aria-haspopup`/`aria-expanded` from the sound work is preserved.
- `apps/web/src/context/locale/ru.js`, `uk.js`: +37 `waiting_*` keys each. The D1–D3 and sound keys are untouched.
- `apps/web/src/test/locale-shape.test.ts`: dictionary pin 1769/1768 → 1806/1805.
- `Outputs/architecture/module-boundaries.md`: one Operational-state row for the Waiting lifecycle.
- `LIFEOS_MASTER_CONTEXT.md`: a 3-line G1 status pointer at the end of §79, plus a new §81. §78 (audit) and §80 (sound) are untouched.

**Everything else** in the working tree is byte-identical to its start-of-session hash, including:
- `App.jsx`, the `sound/` files, `SoundSection`, `QuickAddModal`, `SettingsPage`;
- the D1–D3 files, the reports, `sfx/`, and the owner's audit file.

No backend, schema, migration, dependency or snapshot-version change.

## 5. Tests and gates

| Gate | Result |
|---|---|
| `apps/web npm test` | **653 passed / 49 files** (was 601/47) |
| `npm run typecheck` / `lint` / `build` | PASS / PASS / PASS (main JS 356.68 kB, 110.05 kB gzip) |
| repo `git diff --check` | PASS |
| `apps/api python -m pytest` (lifeos_test) | **748 passed, 1 skipped**, with `LIFEOS_AA_WRITE_ENABLED=false` in the process env. Without it, 1 failure: `test_writes_are_closed_and_reads_open_when_the_gate_is_closed` got 201 because the owner's ignored local `apps/api/.env` sets `LIFEOS_AA_WRITE_ENABLED` and `Settings(env_file=".env")` reads it. Environmental and pre-existing (no backend file changed); the `.env` was not edited |
| `ruff check .` | PASS |
| `alembic heads` / `current` (lifeos_test) | `20260930_0009 (head)` / `20260930_0009 (head)` |

New regressions:
- **Transitions and validation:** every command; trimming; person→null; empty title; allowed resolutions; pairing rules; legacy rows; 10 malformed shapes.
- **Atomic conversion:** exact task shape, both activity entries, the migrated result still valid.
- **Repeated activation:** `unchanged`, one task, no id collision.
- **Stale/missing:** all five commands are `invalid` on a missing id and return the same state object.
- **React-queue model:**
  - a record deleted by an update queued after the last render → `invalid`, with no task;
  - two activations before a re-render (StrictMode double updater) → one task, and the second is `unchanged`;
  - an updater that never runs → `invalid`.
- **Restoration guards:** converted → `not_restorable`; active → `unchanged`.
- **Compatibility:**
  - clarify's validator accepts lifecycle rows;
  - a later Delegate preserves them byte-for-byte;
  - legacy snapshots load unchanged;
  - a round-trip through the server JSON body plus reload keeps other collections intact.
- **Rendering, RU/UK:**
  - active count and rows; collapsed closed list;
  - closed ordering, labels and Kyiv date (including a 21:30Z → next-day case);
  - restore buttons only where permitted;
  - the modal in active, received, converted and missing states;
  - outcome messages: success only for `applied`, and every error code maps to real copy.

A mutation check confirmed the tests catch a removed idempotency guard and a removed restore guard (3 failures, reverted byte-identically). The tests assert behaviour and rendered output; none pins source text.

## 6. Compatibility findings

- **Legacy snapshots** (four-field rows) load unchanged; there is no backfill.
- **Server contract.** `PUT /api/v1/state` stores `payload` as opaque JSON (`schemas/state.py`, `extra="forbid"` only on the envelope). Fields round-tripped through 15 real PUTs.
- **Export.** `/api/v1/export` ZIP → `user_snapshots.ndjson` contained `resolution`, `resolved_at` and `converted_task_id` (browser-verified).
- **Older client, unit level.** The `origin/main` web tree was exported with `git archive` to the scratchpad, and a scratch test (not in the repo) ran its code on G1 snapshots. The old `migrate.js` loads them. Old Clarify Delegate plus an old-style `mutate` write preserve every field, and the new client reloads and classifies them correctly (3/3).
- **Older client, browser.** The `origin/main` bundle was built and served on :4174 against the same account and database:
  - it booted on the G1 snapshot with no error;
  - it listed all 4 records (active, received, cancelled, converted) as ordinary waiting rows;
  - its own real PUT (capturing a Quick Note; revision 14 → 15) left `waitingItems` **byte-identical**.
- **Unresolved mixed-version behaviour** (documented, not fixed; outside G1):
  1. An older bundle shows closed records as active, read-only rows. For a converted record, the item and its Task both appear. This is transient and non-destructive.
  2. An older bundle cannot restore, convert or delete them.
  3. Concurrent old/new tabs follow the existing revision CAS: a conflict freezes sync, which is unchanged.
- **Durability wording.** The UI reports the local snapshot change. Server durability follows the existing sync coordinator (500 ms debounce, in-memory pending state, `beforeunload` warning). There is no offline crash recovery beyond what the coordinator already provides.

## 7. Browser verification (production build + API on lifeos_test)

Account: new disposable `qa-g1-waiting-20260930@example.com` in `lifeos_test`, created by a direct `users` insert (per the QA memory). Sounds were observed by instrumenting `AudioBufferSourceNode.start` (buffer duration identifies the clip).

| Step | Result |
|---|---|
| Capture a note → Clarify → key `2` (Delegate) | legacy four-field record on the server (rev 3); note removed |
| Tasks → «ожидание» | «активно: 1»; row opens with keyboard Enter; focus on the title; one `click` |
| Type a person, then Escape | nothing written (rev 3), focus back on the row, `close_window` |
| Empty title + Enter | modal stays, localized `role=alert`, `aria-invalid`, rev unchanged |
| Edit person + Enter (Save) | rev 4, `waiting_for` + `updated_at`, status «сохранено», focus on the row, `click` only (no `save.success`) |
| Reload | person present |
| «получено» | rev 5, resolution + `resolved_at`, **no task created**, `click` only (no `release`), dialog shows the closed state, focus on the heading |
| Focus containment | Tab ×6 and Shift+Tab ×3 stay inside; Escape → focus falls back to the list heading (row moved) |
| Reload | «активно: 0», «закрыто · 1» collapsed; expand → `panel.expand` |
| «вернуть» from the list | rev 6, same id, resolution fields removed, status line, focus on the restored row |
| «в задачу» (real double-click) | rev 7, **exactly one** undated task (6 → 7 tasks), `converted_task_id` link, activity `task created` + `waiting converted` |
| Same-tick provider calls (via the React fiber) | convert ×2 → `applied`, `unchanged` (1 task); delete then convert → `invalid/missing` (no task); restore converted → `invalid/not_restorable` |
| Reload | the task is under «все» with no tag or date; the converted record is under «закрыто» with no restore |
| Delete → «отмена» | record kept |
| Delete → «удалить навсегда» | rev 9, record gone, **task kept**, activity `deleted`, status line, focus on the heading, `close_window` |
| Export ZIP | lifecycle fields present |
| Old bundle (:4174) | see §6 |
| Layout matrix | 24/24 at 320/390/768/1440 × dark/light/paradise × RU/UK, with the closed list expanded (3 rows incl. restore buttons) and the modal open: document overflow 0, no row or dialog control outside the viewport, iframe `clientWidth` = target width, locale asserted per frame |
| Visual | 320 paradise UK (list, closed list, modal as a bottom sheet) and 390 light RU (after a full reload) inspected |
| Console / API | no page errors or unhandled rejections; API log has no 5xx or traceback (the only 4xx were a manual curl probe and the pre-initialisation GET) |

Harness notes:
- Widths below 625 px used same-origin iframes.
- Matrix themes were applied by setting `data-theme` on a loaded frame. That leaves the paradise scene mounted, so the light-theme visual was re-checked after a full reload.
- No real touch device was used.

## 8. Limitations

- **Mixed-version display** (§6) is unresolved by design.
- **Server durability.** No server acknowledgement is shown for Waiting actions; they are local snapshot changes persisted by the existing coordinator.
- **Delete cue.** Confirmed delete plays `close_window`, consistent with TaskDetailModal. The owner may want a different cue in the sound review.
- **Clarify's provider actions** keep their original render-closure pre-check (unchanged by decision). Only Waiting commands use the flushSync outcome bridge.
- **Test data** left in `lifeos_test`: the QA user; its snapshot (probe/compat Waiting records, one probe task, one old-client note); and 2 converted-task artefacts.

## 9. Publication status

Uncommitted working tree on `fix/lifeos-completion-audit` at `1b396eb`. It is not committed, not pushed, has no PR, and is not merged or deployed. The branch is still absent from `origin`. G2 was not started.
