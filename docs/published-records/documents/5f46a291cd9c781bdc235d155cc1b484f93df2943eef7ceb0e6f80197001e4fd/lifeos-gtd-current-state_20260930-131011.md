# LifeOS GTD — current state vs requirements (Discovery)

Timestamp: 2026-09-30 13:10 EEST (`20260930-131011`).
Type: discovery / reconciliation only. No product code was changed.
Companion plan: `Outputs/Plans/lifeos-gtd-completion-plan_20260930-131011.md`.

Legend used throughout:
**[V]** verified in this session (code read, test run, file read) ·
**[I]** inference from verified code, not executed ·
**[U]** unknown / could not be verified.

---

## 1. Repository state at investigation time

| Fact | Value | Basis |
|---|---|---|
| Checkout | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` | [V] |
| Branch | `fix/lifeos-completion-audit` | [V] `git branch -vv` |
| HEAD | `1b396eb7ed4b7ad6a791f3bab3d316daae69dac2` (completion-audit fixes + report + master context) | [V] |
| Local `main` | `5e858bb` | [V] |
| Remote `origin/main` | `5e858bb0322be0cc729d3d7e73ce359597aada84` (PR #20 merge) | [V] `git ls-remote origin` |
| `fix/lifeos-completion-audit` on GitHub | **absent** from `git ls-remote` — the HEAD commit is local-only, not pushed, no PR | [V] |
| Working tree | only untracked owner file `LifeOS_Completion_Audit_20260930.md` (preserved, not modified) | [V] |
| Stash | `stash@{0}` "slice2-pre-hero-preservation-20260928T044442Z" — untouched | [V] |
| Concurrent change | `apps/web/src/test/project-history-retention.test.jsx` appeared untracked at 13:13 during this investigation. It was not created by this session and was left untouched | [V] |

Consequences for this reconciliation:

- **Behaviour in current checkout** = `origin/main` + the two narrow audit fixes
  (Tasks/Sidebar closure exclusion; Kyiv retention horizon). Neither fix changes
  Clarify, Waiting, Reference or Projects. Everything GTD-related below is
  therefore **identical on remote main and on HEAD** [V: `git show --stat HEAD`
  touches only `App.jsx`, `TasksPage.jsx`, `RetentionSection.jsx`, two tests, docs].
- The `TasksPage` closure exclusion (`isTaskClosed` filter) exists **only locally**.
  On remote main, archived / closed-unresolved tasks still render as open rows.
- The preceding completion audit is complete as a document, but its branch
  still awaits owner review. That is a publication dependency for any slice
  that touches `TasksPage.jsx` (see the plan, §1).

Checks performed in this session (no full suite, per task instructions):

- `npx vitest run` on 9 GTD-relevant files (`clarify.test.ts`,
  `clarify-transitions.test.jsx`, `clarify-ui.test.jsx`, `task-domain.test.ts`,
  `task-closure-integration.test.jsx`, `task-integrity.test.jsx`,
  `projects.test.ts`, `projects-ui.test.jsx`, `state-migration.test.ts`) →
  **9 files / 120 tests PASS** on HEAD `1b396eb`.
- Static code reading of the web domain, provider, pages and handlers, and of the
  backend state route / schema / model. No backend tests, no browser run,
  no live DB inspection.

---

## 2. Requirement sources and precedence

Precedence applied: latest explicit owner decision → accepted reconciliation →
original specification → historical proposal.

| ID | Source | Date | Standing |
|---|---|---|---|
| S-MC | `LIFEOS_MASTER_CONTEXT.md` §14, §31–35, §64, §66–68, §78 | reconciled 2026-09-30 | **Accepted.** §32 is headed "OWNER-APPROVED CLARIFY OUTCOMES" |
| S-CLR | `Outputs/Implementations/lifeos-design-handoff-clarify-panel_20260928-120853.md` (PR #9, merge `573456af`) | 2026-09-28 | **Accepted** implementation report. §13 deviations, §14 known limitations, §15 non-scope |
| S-HO | `/Users/yurasachenko/LifeOS/design_handoff_clarify_panel/README.md` | 2026-09-20 | **Accepted** hi-fi design (layout 1c approved). Where it conflicts with S-MC (one-tap Defer, toast "вернём во входящие в пн"), S-MC wins, as S-CLR §13.1 records |
| S-OWN | Owner Clarify brief, `/Users/yurasachenko/Archives/LifeOS/export_claude_lifeOS_2026-09-28/design_chats/a5595142-647f-4b3b-b063-2c4b73527750.json`, message 0 | 2026-07-02 | **Owner text.** Six outcomes, "< 2 мин? сделай сейчас" hint |
| S-MP | `/Users/yurasachenko/Archives/LifeOS/pre-consolidation-2026-09-28/obsolete-instructions/MASTER-PROMPT.md` §C "GTD WORKFLOW" (lines 138–160) | 2026-07-01 | **Historical proposal / proposed scope input.** Forensic classifies it as `PROPOSED_SCOPE_INPUT`, "not item-by-item acceptance" (`_lifeos_forensic/08_gtd_system.md:29`). Archived as "obsolete-instructions" |
| S-RP | `Outputs/Plans/lifeos-refinement_plan_2026-07-01.md` + discovery | 2026-07-01 | **Historical proposal.** Ends "WAITING FOR: approval"; the resumption discovery (2026-07-21:97) calls it "context, not proof of approved implementation" |
| S-FOR | `/Users/yurasachenko/Archives/LifeOS/export_claude_lifeOS_2026-09-28/_lifeos_forensic/` (08, 15, 03, 04, 14, 17) | 2026-08-11 | **Evidence-graded reconstruction.** Canonical minimum (08:170): "Capture feeds an Inbox of raw items; Clarify is a distinct six-outcome decision step with a two-minute hint; tasks need real temporal/organizational support…" |
| S-CAL | `Outputs/Discoveries/lifeos-calendar-current-code-discovery_20260929-214917.md:239` | 2026-09-29 | **Accepted reconciliation.** It marks the old `status ∈ {next, waiting, someday}` enum `OBSOLETE_OLD_ASSUMPTION` |

Missing or unavailable originals [V: searched, not found]:

1. **`conversations.json`** from the Claude export (the "LifeOS Dev chat": owner answers Q1–Q5 and
   the GTD-audit attachment EV-000039). It is cited by
   `Outputs/Discoveries/lifeos-claude-export-forensic_discovery_2026-08-11_145202.md:6`,
   `_lifeos_forensic/00_source_inventory.md` §2 and
   `lifeos-calendar-recovered-source-of-truth_20260929-214917.md:5`.
   `/Users/yurasachenko/Archives/LifeOS/export_claude_lifeOS_2026-09-28/` contains
   only `design_chats/`, `projects/`, `memories.json`, `users.json`, `login_history.json`.
   Only excerpts survive, in `_lifeos_forensic/18_evidence_index.jsonl`.
2. **The standalone GTD audit/plan attachment.** Per forensic 08:161, "No complete GTD plan attachment is
   available as an exported source record." The only full text is S-MP.
3. **The owner session in which the §32 Clarify decisions were made.** Master context §78 says prior-chat
   retrieval "provided selected fragments, not a full chat transcript."
   §32 is treated as accepted because it is labelled owner-approved and
   PR #9 was merged on it.

Consequence: S-MP's authorship (owner-written vs assistant-drafted and pasted)
cannot be established. It is treated as a historical proposal, not a requirement.

---

## 3. Requirements → implementation matrix

Statuses: `implemented / partial / missing / conflicting / unverified`.
"Not required" rows are listed so that proposals are not mistaken for gaps.

### 3.1 Capture / Inbox

| Requirement | Source | Implementation evidence | Status | Gap | Verification |
|---|---|---|---|---|---|
| Raw capture into an Inbox of Quick Notes | S-FOR 08:170; S-MC §32 ("processing step for Quick Notes / Inbox items"); S-OWN | `QuickNotesPage.jsx:25-56` input + Enter → `addQuickNote` (`LifeDataContext.jsx:470-475`), prepends `{id: Date.now(), text, at:'HH:MM'}` and logs activity | **implemented** | `at` stores only `HH:MM`, not a date. The capture day is recoverable only from `id`/activityLog **[I]** | code read [V] |
| Inbox visible with count | S-HO (tap a row in Inbox) | `QuickNotesPage.jsx:40` count; Sidebar `counts.notes = quickNotes.length` (`App.jsx:176`) | **implemented** | — | code read [V] |
| Notes do not leak into Home/Calendar before Clarify | S-HO; page comment | `QuickNotesPage.jsx` comment; notes are read only by this page | **implemented** | — | code read [V] |
| Global capture shortcut | — (no accepted source) | Cmd/Ctrl-K opens **QuickAddModal = Task**, not a note (`App.jsx:161-171`) | not required | Leftover: `fromNoteId` path in `addTaskFromUI` is dead code (nothing sets `quickSeed.fromNoteId`) | code read [V] |
| Inbox Zero counter | S-MP Phase 3 | none | not required (proposal) | — | — |

### 3.2 Clarify (six outcomes)

Shared mechanics: `requireQuickNote` → build the record → `applyClarifyTransition`
(`domain/clarify.ts:301-351`) writes the destination, removes the note and
appends two activity entries in ONE `setStateRaw` update. The update is idempotent
on a stale note or a duplicate id.
Panel: `components/ClarifyPanel.jsx` (layout 1c, digits 1–6, Esc, focus).
Handlers: `app/clarifyHandlers.js`.

| Outcome / rule | Source | Evidence | Status | Gap | Verification |
|---|---|---|---|---|---|
| Do Now → ordinary Task, no invented date, note removed after success | S-MC §32.1 | `createClarifiedTaskRecord` (`clarify.ts:216-234`): `due:''`, `schedule:null`, `stakes:false`, `tag:null` | **implemented** | Downstream: such a task never matches the Tasks «сегодня» filter (see 3.6) | tests `clarify.test.ts`, `clarify-transitions.test.jsx` PASS [V] |
| Delegate → separate Waiting record (not a tag/status); fields title, optional waitingFor, createdAt | S-MC §32.2 | `createWaitingItemRecord` → `waitingItems[]` `{id,title,waiting_for,created_at}` (`clarify.ts:40-45,187-200`) | **implemented** (creation) | The handler never passes a counterparty (`clarifyHandlers.js:21-23`), so `waiting_for` is always `null` from the UI | tests PASS [V]; code read |
| Defer → Task with an explicitly selected FUTURE date; cancel keeps the note; no hidden someday; no invented date | S-MC §32.3 | `assertFutureDeferDate` (Kyiv, strictly after today) + `createDeferredTaskRecord` → `schedule:{date,time:''}`; panel date block `ClarifyPanel.jsx:285-321` | **implemented** | Date-only (accepted deviation, S-CLR §13.3) | tests PASS [V] |
| Project → REAL Project domain, never Goal | S-MC §32.4, §35, §14 | `clarifyQuickNoteToProject` → `createProjectRecord` → `projects[]` (`LifeDataContext.jsx:517-522`) | **implemented** | Creates the Project only, with no first action (see 3.4) | tests PASS [V] |
| Reference → separate record, text preserved, visible later, not a tag/hidden note | S-MC §32.5 | `createReferenceRecord` → `references[]` `{id,text,created_at}`; shown on the Notes page | **implemented** (creation + retrieval) | Lifecycle absent (3.5) | tests PASS [V] |
| Delete → existing `deleteQuickNote` with handoff confirmation | S-MC §32.6; S-HO | `onDelete` → `requireClarifiableQuickNote` + `deleteQuickNote`; two-step confirm in panel | **implemented** | — | `clarify-ui.test.jsx` PASS [V] |
| Cancel/failure preserves the note | S-MC §68 | `ClarifyPanel.run()` catches `ClarifyError`, localises it, and keeps the panel open | **implemented** | **[I] low-risk:** the provider validates against the render-time `state` closure. If the note vanishes between render and the functional update, the transition is a no-op but the handler still toasts success. The busy flag makes this unlikely; not reproduced | code read |
| Provider actions under test | quality bar | Tests call the domain functions and statically rendered UI. No test drives `LifeDataProvider` actions; the repo has no DOM testing library (S-CLR §14) | **partial** (test depth) | — | [V] |

### 3.3 Waiting For

| Requirement | Source | Evidence | Status | Gap | Verification |
|---|---|---|---|---|---|
| Created through Clarify Delegate | S-MC §32.2 | see 3.2 | **implemented** | — | [V] |
| Person ("waitingFor") optional field | S-MC §32.2 (optional); S-CLR §13.2 (no handoff control; field kept so it "can be filled later without a migration") | Field persisted/validated; displayed when present (`TasksPage.jsx:103-105`) | **partial** | No UI anywhere can set it, so it is always `null` in practice | code read [V] |
| User-visible through Tasks/Waiting | S-MC §32.2, §33 | «ожидание» chip → separate list (`TasksPage.jsx:30, 90-114`) with title, person if any, created date | **implemented** (read-only) | No count; rows are not interactive | code read [V] |
| View / edit / complete / cancel / convert back to Task | **No accepted requirement.** S-CLR §14: "retrieval-only … Worth an explicit owner decision"; S-FOR 08 §15: "UNRESOLVED: … follow-up date, reminders and completion/reclaim semantics" | No code other than the Clarify transition writes `waitingItems` (provider exports `LifeDataContext.jsx:700-714`) | **missing** (the cycle is broken; semantics need an owner decision) | Waiting items can only accumulate. A delegated item can never be closed | code read [V] |
| Follow-up / due date, "Waiting > N days" detector | S-MP Phase 1/3 only | none | not required (proposal) | — | — |
| Durability | S-MC §33 | Part of the snapshot (see §4) | **implemented** [I: survives reload by construction; no round-trip test] | — | code read |

### 3.4 Projects / Next Actions

| Requirement | Source | Evidence | Status | Gap | Verification |
|---|---|---|---|---|---|
| Project is a real domain, distinct from Goal | S-MC §35 | `domain/projects.ts` (`active/completed/archived`, forecast, completion); `ProjectsPage.jsx`; AA forecast/actual on the server (`aa_forecast_versions`, `aa_measurements`) | **implemented** | — | `projects*.test` PASS [V] |
| Create / forecast / complete / archive | Slice P (accepted) | `createProjectRecord`, `setProjectForecastWithDurableIntent`, `completeProjectWithDurableIntent`, `archiveProjectRecord` | **implemented** | Rename, reopen, cancel and delete are absent; they are not GTD requirements | [V] |
| Task ↔ Project relationship | S-MP ("per-goal NEXT ACTION"); S-FOR 08 §11 "next-action linkage … INSUFFICIENT_ARCHIVE_EVIDENCE"; **S-CLR §15 lists "tasks-in-projects; project membership" as explicit non-scope** | No `projectId` on tasks and no task list on projects (`tasks.ts:28-43`, `projects.ts:5-13`) | **missing — requires an owner decision** (never accepted) | — | grep + code read [V] |
| Next action per project, "no next action" flag | S-MP Phase 2/3 only | none | **missing — requires an owner decision** | Without it, a Clarify→Project item becomes a title with no actionable step | [V] |
| What happens to associated tasks on project completion | — | N/A (no association) | missing (depends on the link) | — | [V] |

### 3.5 Reference

| Requirement | Source | Evidence | Status | Gap | Verification |
|---|---|---|---|---|---|
| Separate record, text preserved, retrievable | S-MC §32.5, §33 | `references[]`; Notes page section with count (`QuickNotesPage.jsx:79-97`) | **implemented** | — | [V] |
| Edit / delete / search | S-MC §33: "Future Reference lifecycle changes remain a separate product scope"; S-CLR §15 excludes search/folders/backlinks | none | **missing (not yet required)** | A mistaken Reference cannot be removed or corrected | [V] |

### 3.6 Tasks, Calendar, Engage / action selection

| Requirement | Source | Evidence | Status | Gap | Verification |
|---|---|---|---|---|---|
| Date authority = `schedule.date`; Calendar day shows active dated tasks | Calendar PR #17 accepted; `domain/tasks.ts` header | `tasksForDay` in Day Manager (`DayManagerModal.jsx:28`); deferred Clarify tasks therefore appear on their day | **implemented** | — | `task-domain.test.ts` PASS [V] |
| Complete / close unresolved / archive / restore / reschedule (edit date) / reorder | Calendar OD-1 (owner-resolved 2026-09-29) | Day Manager + `domain/tasks.ts` | **implemented** in Calendar | `TaskDetailModal` (Tasks page) cannot change the date. Rescheduling exists only in Calendar | code read [V] |
| Tasks «сегодня» / «просрочено» | S-MC §78: "legacy predicates … Needs an explicit owner decision before changing" | `TasksPage.jsx:43-44`: `tag==='today' \|\| stakes`; `due.includes(':')`. `isTaskOverdue` exists but is not used | **conflicting** with `schedule.date` authority | Do-Now and deferred tasks never appear under «сегодня». Overdue is a label heuristic | code read [V] |
| Closed tasks excluded from the Tasks list | completion audit F-AUDIT-01 | `TasksPage.jsx:42` `!isTaskClosed` | **implemented locally only** (HEAD `1b396eb`, not on remote) | awaiting publication | test PASS [V] |
| Home shows real actionable tasks | — (no accepted Engage spec) | `HomePage.jsx:137` uses `seed.tasksThisWeek` (seed 23/30). `onOpenTask` prop unused. `Today.jsx`/`TaskList.jsx` unimported | **partial** (not a GTD requirement, but a truthfulness gap already in §78) | — | code read [V] |
| Focus Now / next-action picker | S-MP Phase 2 only; S-FOR 08 §6 "No accepted Engage algorithm"; gap #4 | none | **missing — requires an owner decision** (never accepted) | — | grep [V] |
| Context / energy / time-available / priority filters | S-MP (@contexts incl. @5-min/@high-energy) only; S-FOR 04:35 "Claude-only mechanics such as `contexts: string[]` … are not user requirements" | no fields; "priority" sort = `stakes` first | not required (proposal) | — | grep [V] |
| Start (timer) an action | no source | none | not required | — | — |

### 3.7 Weekly Review (GTD)

| Requirement | Source | Evidence | Status | Gap | Verification |
|---|---|---|---|---|---|
| GTD Weekly Review ritual (inbox, next actions, waiting, projects, someday) | S-MP Phase 1; S-RP (home accordion, `state.weeklyReview`); S-FOR 08 §5 "No user-accepted Reflect workflow"; DEC-0023 `PROPOSED` | none. `ReviewPage.jsx:11` says "semantic reflection, not a GTD weekly review". System Review (Slice 7) covers month/year analytics; its «Ждёт вас» lists experiments/reviews/proposals, not GTD lists | **missing — requires an owner decision** | — | code read [V] |
| AA Review / Debrief / System Review as a substitute | no accepted decision | — | not a substitute | — | — |
| Shipped copy about a weekly review | — | `ru.js:1286` / `uk.js:1222` `aa_sr_relation_to_rest`: «Обзор не заменяет ни Дом, ни недельный обзор задач…», rendered at `pages/analytics/system/ReviewView.jsx:109` | **conflicting** | UI copy refers to a feature that does not exist | code read [V] |

### 3.8 Someday/Maybe and Defer constraints

| Requirement | Source | Evidence | Status | Verification |
|---|---|---|---|---|
| No hidden indefinite someday bucket via Defer; no invented date | S-MC §32.3 (accepted); S-CLR "Nothing silently picks … 'someday'" | `assertFutureDeferDate` rejects missing/today/past | **implemented** | tests PASS [V] |
| Visible Someday/Maybe list | S-MP only; status enum superseded (S-CAL:239); S-FOR gap #2 | none | **not required.** The accepted rule forbids a *hidden* bucket via Defer. It does not decide on a visible list. Do not introduce one | [V] |

### 3.9 Areas / Horizons

No evidence of an accepted Area model (S-FOR 08 §12). Horizons appear only in S-MP Phase 3.
**Not required.**

---

## 4. Durability, assessed separately from workflow

| Aspect | Evidence | Assessment |
|---|---|---|
| Storage | `quickNotes`, `tasks`, `waitingItems`, `references`, `projects` are keys of one snapshot payload. `GET/PUT /api/v1/state` (`apps/api/app/routes/state.py`) compare-and-swaps on the revision. Postgres `user_snapshots` holds JSONB, one row per user | Server-backed [V code] |
| Atomicity | Clarify destination creation and note removal happen in one state object, so they are always saved together | Strong [V code] |
| Client write path | `StateSyncCoordinator` debounces 500 ms. Pending state is **in memory only**. `beforeunload` warns. 409 freezes sync; offline retries on `online` | Unsaved edits can be lost on a crash within the debounce/offline window. This is shared by every snapshot edit, not GTD-specific [V code] |
| Validation | Client `migrate.js:50-59` validates each Waiting/Reference record and **rejects the whole snapshot** on a malformed one. Quick Note records are not validated individually. The server validates only `payload.version == schema_version` | Additive optional fields are safe. A malformed field would block load, so validators must accept legacy rows [V code] |
| Export / account delete | `user_snapshots` is included in the export (`services/export.py`); cascade delete via FK `ondelete=CASCADE` | [V code]; deletion test coverage **[U]** |
| AA coupling | Clarify, Waiting and Reference have no AA facts. Projects have AA forecast/actual through the durable IndexedDB queue | Correct separation [V] |
| Reload round-trip for waiting/references | Not covered by any test; no browser run in this session | **[U]** (inferred OK) |

---

## 5. Where the operational GTD cycle breaks

1. **Waiting For is a dead end.** A delegated item can be created and viewed,
   but it can never be received, cancelled, corrected, assigned a person or turned
   back into an action. The list only grows. This is the most concrete break:
   the accepted Delegate outcome feeds a list the user cannot process.
2. **Engage has no reliable "today".** Clarified tasks (Do Now: no date; Defer:
   `schedule.date`) do not match the Tasks «сегодня» filter (legacy tag/stakes).
   «просрочено» ignores `schedule.date`. Home shows seed numbers. The only
   date-truthful action surface is the Calendar Day Manager.
3. **Project → action gap.** Clarify→Project creates a bare Project with no
   link to any task. Project work cannot be expressed as next actions. This is not an
   accepted requirement yet, so it is a decision, not a defect.
4. **Review is absent.** There is no GTD Weekly Review, and the System Review copy implies
   there is one.
5. **Reference cannot be maintained** (no edit/delete). This is minor, and lifecycle is
   explicitly a separate scope.

Capture → Clarify itself is complete and durable for all six outcomes.

---

## 6. What could not be verified

- **[U]** Owner authorship and acceptance of S-MP items. The source chat
  (`conversations.json`) is missing, so Weekly Review, Focus Now, contexts,
  Someday, next actions and Waiting follow-up remain proposals.
- **[U]** Owner Q1–Q5 answers cited by the 2026-07-01 plan.
- **[U]** Live browser/API behaviour of Clarify outcomes and the reload round-trip in
  this session. It was not run; the Clarify report's manual browser QA is historical.
- **[U]** Whether `test_account_deletion.py` asserts snapshot removal.
- **[U]** The stale-closure false-success path in the Clarify provider actions
  (inferred from code, not reproduced).

---

## 7. Proposed MASTER_CONTEXT addition

Applied as a new §79 in `LIFEOS_MASTER_CONTEXT.md` in this session. That file had
no uncommitted edits, so the addition could not overwrite owner changes. The text is
reproduced in the plan (§8) for reference.
