# LifeOS — Clarify Panel for Quick Notes · implementation report

Timestamp (UTC): 2026-09-28 12:08:53
Author: Claude Code (continuation of an interrupted Codex session)

---

## 1. Start state

Starting `main` (verified live):

```
e491993ec7ebeee4f0305bdda60a14dc0452b123
Merge pull request #8 from yurafreedom/chore/lifeos-consolidation
```

Canonical checkout:

```
/Users/yurasachenko/LifeOS/LifeOS_DesignSystem
```

Feature branch:

```
feat/design-handoff-clarify-panel
```

### Recovered state from the interrupted Codex session

The handoff said Codex had created the branch and begun read-only discovery, and
warned that later uncommitted work might exist. Actual inspection at takeover:

```
git branch --show-current   → feat/design-handoff-clarify-panel
git rev-parse HEAD          → e491993ec7ebeee4f0305bdda60a14dc0452b123
git rev-parse origin/main   → e491993ec7ebeee4f0305bdda60a14dc0452b123
git status --short          → (empty)
git diff / git diff --cached → (empty)
git ls-files --others --exclude-standard → (empty)
git worktree list           → 1 worktree (canonical checkout only)
git branch -vv              → feat/design-handoff-clarify-panel, main (both at e491993)
git branch -r               → origin/main only
git stash list              → stash@{0} slice2-pre-hero-preservation-20260928T044442Z
git tag -l                  → adaptive-analytics-design-accepted
```

Conclusion: **case A** of the handoff — the branch existed, was checked out, was
clean, and sat on the exact expected `main`. Codex had produced **no** file
changes before quota exhaustion. `RECOVERED_PARTIAL_WORK=NO`. No recovery,
stash, reset, clean or worktree operation was needed or performed.

Protected historical state recorded at takeover and re-verified at the end:

| Object | SHA |
|---|---|
| recovery stash `stash@{0}` | `51184836ace557fbd9492527bd845329b17b2a76` |
| tag `adaptive-analytics-design-accepted` | `6c507b829ebc4a2a1e5b1b353db04c1a29302be0` |

Both are unchanged.

### Unrelated untracked file observed

`outputs.zip` (432 KB, mtime 2026-09-28 11:29) appeared in the repository root
**after** the first clean `git status` of this session and was not produced by
this work. It was left untouched and deliberately excluded from the commit. It
is still present and still untracked. The owner should decide whether to keep,
ignore or delete it.

---

## 2. Baseline before any change

Full green baseline reproduced locally before the first edit, matching the
recorded Slice P baseline exactly:

| Check | Result |
|---|---|
| `python -m pytest` (apps/api, `lifeos_test`) | 253 passed, 7 warnings |
| `ruff check .` | PASS |
| `alembic heads` | `20260910_0004 (head)` — single head |
| `alembic current` | `20260910_0004 (head)` |
| `npm test` (apps/web) | 123 passed / 18 files |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS · 107 modules · CSS 130.95 kB / JS 437.48 kB |

Environment notes: `apps/web/node_modules` was absent and was installed with
`npm install` (lockfile unchanged, `npm audit fix` NOT run). A Python 3.11 venv
was created at `apps/api/.venv` (gitignored) from `requirements-dev.lock`.
Backend DB validation used `lifeos_test` only; `lifeos_dev` was never touched.

---

## 3. Sources inspected

### Raw design handoff (read-only, unmodified)

`/Users/yurasachenko/LifeOS/design_handoff_clarify_panel`

| File | Classification | Use |
|---|---|---|
| `README.md` | **source-of-truth** | tokens, geometry, copy, states, interaction, responsive, a11y recommendations |
| `Clarify Panel.dc.html` | **source-of-truth (markup reference)** | exact 1c structure, per-element sizes/colours, delete-confirmation block |
| `clarify-panel-standalone.html` | reference-only | not opened for values; superseded by the `.dc.html` source |
| `support.js` | **demo-only** | prototyping runtime; explicitly not ported |
| `_ds/design-system-…/*` | **reference-only** | token values; the production design system was used instead |

Nothing in that directory was modified, installed into, imported from, or copied
into production. No absolute `design_handoff` path is referenced by any shipped
file. No prototype chrome (`x-dc`, `sc-if`, `dv-stage`, stage gradients, theme
toggles, inline styles) was ported.

The README names layout **1c (vertical list)** as the approved variant; 1a/1b
are explicitly optional and were not built.

### Production architecture inspected

`apps/web/src/pages/QuickNotesPage.jsx`, `pages/TasksPage.jsx`,
`pages/ProjectsPage.jsx`, `components/QuickAddModal.jsx`,
`components/TaskDetailModal.jsx`, `components/icons.jsx`,
`components/HeroVignette.jsx` (PageHeader), `context/LifeDataContext.jsx`,
`context/LocaleContext.jsx`, `domain/projects.ts`, `analytics/timezone.ts`,
`lib/activity.js`, `App.jsx`, `app/routes.js`, `styles.css`,
`repositories/serverStateRepository.ts`, `apps/api/app/services/export.py`,
and the existing Vitest suites.

Authoritative documents read in full: `LIFEOS_MASTER_CONTEXT.md`, `AGENTS.md`,
`CLAUDE.md`, plus the Slice P / Slice 2 / Hero report references within them.

---

## 4. Semantic decisions

### 4.1 Waiting model (Delegate)

Selected representation — a new operational snapshot collection:

```js
waitingItems: [
  { id: 'waiting-<uuid>', title, waiting_for: string | null, created_at }
]
```

Why:

- No Waiting concept existed anywhere in production (verified by inspection);
  it is not a Task, not a Task tag, not a Task status and not a hidden label.
- The shape is the owner-approved minimum from `LIFEOS_MASTER_CONTEXT.md` §32
  (title / optional waitingFor / createdAt).
- Field naming follows the established convention: `camelCase` collection key
  (like `quickNotes`, `categoryOverrides`) with `snake_case` record fields
  (like `projects[]`: `created_at`, `current_forecast_date`).
- It lives in the existing snapshot, so no new table, no migration, and account
  export/deletion coverage is inherited (see §6).

`waiting_for` is persisted as `null` for records Clarify creates today, because
**the approved handoff exposes no counterparty input** and the task contract
makes the field conditional on the handoff having one ("optional waitingFor may
be supported if the handoff has an input for it"). The field is in the shape and
validated as optional so a later surface can fill it without another migration.
The Waiting list already renders it when present.

Retrieval surface: an **«ожидание» filter chip inside the existing Tasks page**,
rendering Waiting items as their own list (`.waiting-list`), never reusing
`task-row` / `task-check` / `task-tag` markup. This follows the contract's
preference for "a small Waiting view/filter/section within the existing Tasks
experience".

Explicitly **not** built: team accounts, messaging, notifications, permissions,
collaboration, assignee infrastructure, remote delegation.

### 4.2 Reference model

```js
references: [ { id: 'reference-<uuid>', text, created_at } ]
```

Why: same reasoning — smallest truthful persisted record, original note text
preserved verbatim, additive to the snapshot, conventional naming.

Retrieval surface: a **«справочник» section on the Notes page**, below the
inbox list, per the contract's preference for "a minimal Reference area/filter/
section in Notes".

Explicitly **not** built: full-text search, folders, backlinks, knowledge graph,
tagging ontology, sync service.

### 4.3 The six outcomes as implemented

| # | Outcome | Destination | Interaction |
|---|---|---|---|
| 1 | Сделать сейчас | `tasks[]` — normal open Task | one tap |
| 2 | Делегировать | `waitingItems[]` | one tap |
| 3 | Отложить | `tasks[]` with the existing `schedule` shape | inline date step, explicit future date required |
| 4 | В проект | `projects[]` via `createProjectRecord` (Slice P) | one tap |
| 5 | В справочник | `references[]` | one tap |
| 6 | Удалить | existing `deleteQuickNote` | inline confirmation, two steps |

**Do Now** creates exactly:

```js
{ id, title: <note text>, done: false, stakes: false,
  tag: null, tagLabel: null, due: '', schedule: null, notes: '' }
```

No invented due date, no invented schedule, no automatic stakes flag, and
`tag: null` rather than any category — a task that genuinely has no category
renders no category chip and stays out of the `today`/`stakes` filters. Quick
Add is not opened and is never treated as completion.

**Defer** reuses the existing Task scheduling representation exactly
(`schedule: { date, time }`, the shape `QuickAddModal` → `addTaskFromUI` writes)
and sets `due` to the chosen date so the deferral is visible in the Tasks list.
Validation:

- a date must be explicitly selected — missing selection creates nothing;
- a malformed or impossible date (`05.10.2026`, `2026-02-30`) creates nothing;
- today or any past date creates nothing;
- "future" is decided against the **Europe/Kyiv local date** via the shared
  `localDateForInstant()` IANA helper. No UTC offset is hardcoded anywhere.
  Tests cover both the summer (+03) and winter (+02) boundary cases that the
  Slice 2 review flagged as a bug class.

No time input is offered: the handoff has no Defer UI at all, the contract
allows time to stay optional, and a date-only `due` also avoids perturbing the
pre-existing `due.includes(':')` overdue filter. `schedule.time` is `''`.
Nothing silently picks "tomorrow", "next week", "someday" or "end of day".

**Project** calls `createProjectRecord(note.text)` — the real Slice P Project
domain. `goals[]` / `addGoal` / `GoalsPage` are never touched, and a test asserts
`goals` is referentially unchanged across the transition.

`CLARIFY_SEMANTIC_STATUS` is **not** BLOCKED: the handoff's Project row is
«в проект — многошаговое дело» with a single-tap interaction and no project
picker anywhere in the 1c layout or the README's state table (`isOpen`, `item`,
`confirmingDelete` only). It therefore unambiguously means "turn this note into
a Project", which the existing domain supports without inventing membership
semantics. No tasks-in-projects or membership model was added.

**Delete** does not delete on the first tap. It expands the confirmation block
below the list (the list stays visible and in place, per the handoff); cancel
returns to the idle state with the note intact; confirm deletes exactly once
through the existing `deleteQuickNote`.

### 4.4 Transition and atomicity design

New pure module `apps/web/src/domain/clarify.ts`. Every non-delete outcome
follows one contract, implemented in `LifeDataContext`:

1. `requireQuickNote(state, noteId)` — resolves the source note off the current
   tree and **throws before anything is written** if it is gone or empty;
2. the destination record is built and validated (`createClarifiedTaskRecord`,
   `createDeferredTaskRecord`, `createWaitingItemRecord`, `createProjectRecord`,
   `createReferenceRecord`);
3. `applyClarifyTransition(prev, noteId, outcome, record)` returns one new state
   object containing the destination insert, the source-note removal and both
   activity entries — dispatched as a **single** `setStateRaw` update.

Provider actions:

```
requireClarifiableQuickNote(noteId)         // stale guard for the Delete path
clarifyQuickNoteToTask(noteId)
clarifyQuickNoteToDeferredTask(noteId, deferDate)
clarifyQuickNoteToWaiting(noteId, waitingFor?)
clarifyQuickNoteToProject(noteId)
clarifyQuickNoteToReference(noteId)
```

There is no `addX()`-then-`deleteQuickNote()` sequence anywhere in the Clarify
path. Guarantees:

- destination validated and persisted **before** the source note disappears;
- both happen in one state update, so no half-applied Clarify is observable;
- a stale/nonexistent source note raises and the panel shows a localised reason
  instead of falsely reporting success;
- `applyClarifyTransition` returns `previous` unchanged if the note already left
  the inbox or the destination id already exists, so a replayed dispatch cannot
  duplicate the destination;
- the panel additionally holds a `busyRef` single-flight guard.

Delete keeps using `deleteQuickNote` (which is itself id-filtered and therefore
idempotent), preceded by the same stale-source guard.

Activity log: each Clarify writes two entries — `<destination> / created` with
`clarify_outcome`, and `quick_note / clarified` with the outcome and destination
id. The entity/action lists in the `lib/activity.js` header comment were updated
to stay accurate (`project`, `waiting`, `reference`, `clarified`).

---

## 5. Snapshot compatibility

`migrateStateCopy` seeds and validates the two collections additively, mirroring
the existing `projects` handling:

```js
if (!hasOwnProperty(state, 'waitingItems')) state.waitingItems = [];
if (!Array.isArray(state.waitingItems)) throw …
state.waitingItems.forEach(validateWaitingItemRecord);
// same for references
```

and both keys were added to the generic `arrays` guard list.

- Old v2 snapshots without the collections load and seed them to `[]`.
- No other field is touched; the migration still clones first and never mutates
  its input (asserted by test).
- Valid existing records are preserved byte-for-byte; malformed containers and
  records throw through the existing validation pattern rather than being
  silently dropped.
- **State version remains 2.** Server `snapshot_schema_version` remains 2.
- No Alembic migration, no new relational table, no backend API for Clarify.
  Alembic head is unchanged at `20260910_0004`.

Export / deletion coverage: `build_account_export` selects
`select(UserSnapshot.__table__)`, i.e. the whole snapshot row including the JSON
payload, and account deletion removes that row. Because Waiting and Reference
live inside the snapshot rather than in a new `aa_*` table, export and deletion
coverage is inherited with no registry change. This was verified in
`apps/api/app/services/export.py`, not assumed.

`buildLegacyPreview` was intentionally left unchanged — legacy snapshots have no
Clarify records to count, and adding preview rows would require new locale keys
for no user benefit. Noted as a limitation below.

---

## 6. Changed paths

New:

```
apps/web/src/domain/clarify.ts                      (347 lines)
apps/web/src/components/ClarifyPanel.jsx            (374 lines)
apps/web/src/test/clarify.test.ts                   (323 lines)
apps/web/src/test/clarify-ui.test.jsx               (299 lines)
apps/web/src/test/clarify-transitions.test.jsx      (193 lines)
outputs/implementations/lifeos-design-handoff-clarify-panel_20260928-120853.md
```

Modified:

```
apps/web/src/App.jsx                       Clarify state, handlers, panel mount, props
apps/web/src/context/LifeDataContext.jsx   migration + 6 Clarify actions + initial state
apps/web/src/context/LocaleContext.jsx     RU + UK strings
apps/web/src/lib/activity.js               header comment accuracy only (no logic)
apps/web/src/pages/QuickNotesPage.jsx      row opens Clarify; References section
apps/web/src/pages/TasksPage.jsx           Waiting filter + Waiting list
apps/web/src/styles.css                    Clarify panel, Waiting, Reference, responsive
apps/web/src/test/state-migration.test.ts  Clarify migration coverage
```

No backend file changed. No dependency, lockfile, migration, route, navigation
or design-system change.

---

## 7. Production UI

Clarify is integrated into the real `#/notes` route. The whole inbox row is now
the Clarify trigger; the previous interpretation (promote → pre-filled Quick
Add, plus a row delete button) is **replaced**, and `fromNoteId` seeding is gone
from `App.jsx`. The global Quick Add remains fully intact: `addTaskFromUI`,
`QuickAddModal`, the ⌘K binding, the TopBar button and the calendar entry point
are unchanged, and a regression test asserts it.

The panel reuses the production modal chrome (`.qa-backdrop` / `.qa-modal`) so
theme tokens, the paradise animation/blur exceptions and the mobile bottom-sheet
behaviour all come from the existing system. No second design system, no
prototype inline styles, no broad selectors — every new rule is scoped under
`.clarify-*`, `.qn-ref*`, `.waiting-*`. All colours reference existing tokens
(`--fg1..4`, `--border`, `--tag-bg`, `--surface-h`, `--accent*`, `--orange-*`,
`--red*`, `--kbd-bg`, `--sh-pop`, `--ease`), which already exist in dark, light
and paradise.

Geometry follows the handoff 1c spec: 680px panel, 16px radius, 20/22px padding,
uppercase mono breadcrumb, Onest 700/21px note title (clamped to 3 lines with
ellipsis for long captures, per the handoff's edge-case note), the orange
two-minute hint, the «выбери исход» label, a 12px-radius bordered list of six
54px rows with 30px icon plates and chevrons, the warm row 1, the red row 6, and
the mono footer with the `esc` key cap.

All nine Lucide icons the handoff names (`zap`, `user`, `clock`, `briefcase`,
`book-open`, `trash-2`, `x`, `chevron-right`, `alert-triangle`) already existed
in `components/icons.jsx` and were reused — none were added or re-drawn.

### Verified in a real browser

The panel and both retrieval surfaces were rendered with the production
stylesheet in Chrome and exercised interactively (a temporary harness under
`apps/web/`, deleted afterwards; `git status` confirms it is gone):

- **dark**, **paradise/island** and **light** themes render correctly;
- **RU and UK** both render with no Latin or cross-language leakage;
- keyboard `6` arms the delete confirmation below the list, list stays visible;
- `Escape` collapses the confirmation without closing the panel or touching the
  note; a second `Escape` closes the panel;
- keyboard `3` / clicking the row opens the Defer date step with the input
  focused and the submit button disabled until a date is chosen;
- a failing transition (simulated `stale_note`) leaves the panel open and shows
  «эта заметка уже ушла из входящих. обнови список.» — localised, never a raw
  English `Error.message`;
- **390px**: full-width bottom sheet, 54px rows, digit hints hidden;
  **700px**: centred card at `100vw - 32px` (the handoff's 16px gutters);
  **1280px**: centred 680px card.

One geometry fix came out of this check: the shared backdrop is top-anchored at
`12vh` for the Quick Add sheet, which clipped the Clarify footer on shorter
viewports. `.clarify-backdrop` now centres the panel (as the handoff specifies)
with `4vh` block padding, and hands back to the production bottom-sheet geometry
at ≤640px.

---

## 8. Accessibility

- `role="dialog"` + `aria-modal="true"`; the accessible name comes from
  `aria-labelledby="clarify-eyebrow clarify-title"` → "входящие → прояснить
  <note text>", with no visually-hidden filler text.
- The outcome list is a `role="group"` labelled by the «выбери исход» caption.
- Initial focus lands on the first action (per the handoff); focus is returned
  to the element that opened the panel on unmount, guarded by
  `document.contains` because the inbox row usually no longer exists.
- `Escape` collapses an open expansion first and closes the panel second, and
  neither path mutates the source note.
- `Tab` wraps within the dialog, but `Escape` always exits — no keyboard trap.
- All six outcomes are real `<button>`s, so they are reachable by Tab and
  activate on Enter/Space; digits `1`–`6` are an additional shortcut and are
  suppressed while focus is inside an input/textarea/select.
- The Defer date input has a real `<label for>`; the confirmation block is a
  labelled group; both expansion triggers carry `aria-expanded` and
  `aria-controls` pointing at the region they reveal.
- Failures are announced through `role="alert"`.
- No meaning is carried by colour alone: the primary row and the destructive row
  each pair their tint with a distinct icon, a label and an explanatory line;
  the confirmation adds an alert icon plus «это необратимо.».
- `@media (prefers-reduced-motion: reduce)` disables the expansion animation and
  the hover lifts, matching the existing LifeOS convention.

---

## 9. Localization

RU and UK translations were added for every new user-facing string — 35 keys in
each locale (panel copy, six labels + six hints, both expansions, six failure
reasons, six toasts, the Waiting and Reference surfaces, the new filter chip and
the Notes row CTA). No English locale was introduced; `LifeLocales` stays
`['ru','uk']` and the `en` slot stays absent. No hardcoded English string
reaches production UI — domain `Error` messages stay English for logs and tests
and are mapped to localised copy by `ClarifyErrorCode` before display.

A test enforces key-for-key parity between `ru` and `uk`, non-empty values, and
that `uk` is a genuine translation rather than a copy of `ru` (with an explicit
allow-list for the three strings that are legitimately identical).

Toasts follow the handoff's dry lowercase system voice, e.g.
`отложено до 2026-10-05`, `в ожидание · «…»`, `заметка удалена`.

---

## 10. Tests

`+57` tests (123 → 180), `+3` files (18 → 21).

`clarify.test.ts` (27) — Do Now shape and no invented fields; atomic removal;
both activity entries; Waiting record shape, optional counterparty normalisation
and validation rejections; Defer required/malformed/today/past rejection, the
Kyiv summer **and** winter boundaries, the schedule shape; Project via the real
domain with `goals` untouched; Reference text preservation and validation;
stale-note and not-loaded guards; `previous` returned unchanged when the note is
gone; idempotent replay; unknown outcome, id-less record and malformed
collections rejected.

`clarify-transitions.test.jsx` (8) — every outcome run end-to-end over the real
`buildInitialState()` snapshot and then asserted through the production
retrieval UI (Tasks list, Projects page, Notes References section); no second
Task model; Delete stays on `deleteQuickNote`; every failure mode leaves the
whole snapshot byte-identical.

`clarify-ui.test.jsx` (17) — panel frame against the handoff; exactly six rows
in handoff order with icon + label + copy; dialog/group/label semantics;
`aria-expanded` + `aria-controls`; nothing deleted or deferred before the second
step; focus/escape/digit/double-submit/close-after-success behaviour asserted
against the component source; Project never routed through Goal; Clarify opens
from the note row and the old promote path is gone; References and Waiting
retrieval surfaces; task filters unaffected; RU/UK parity; no AA coupling; Quick
Add intact.

`state-migration.test.ts` (+6) — old v2 snapshot without the collections loads
and seeds `[]`; nothing else moves and the input is not mutated; valid records
preserved byte-for-byte and cloned; a Waiting record with the counterparty
absent is accepted; malformed records and containers are rejected rather than
dropped; fresh snapshots ship both collections empty at version 2.

---

## 11. Validation (all actually executed)

Backend — `apps/api`, `lifeos_test` only:

| Command | Result |
|---|---|
| `python -m pytest` | **253 passed**, 7 warnings |
| `ruff check .` | **All checks passed!** |
| `alembic heads` | `20260910_0004 (head)` — single head, unchanged |
| `alembic current` | `20260910_0004 (head)` |

Frontend — `apps/web`:

| Command | Result |
|---|---|
| `npm test` | **180 passed / 21 files** (was 123 / 18) |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** · 109 modules |

Repo root: `git diff --check` — **PASS**.

Bundle delta vs the Slice P baseline:

| Asset | Before | After | Δ |
|---|---|---|---|
| CSS | 130.95 kB (23.21 kB gz) | 138.78 kB (24.34 kB gz) | +7.83 kB (+1.13 kB gz) |
| JS | 437.48 kB (125.11 kB gz) | 458.12 kB (133.24 kB gz) | +20.64 kB (+8.13 kB gz) |
| Modules | 107 | 109 | +2 |

No baseline failure was observed at any point; nothing was hidden or waived.

---

## 12. Dependencies, migrations, backend

- Dependencies added: **none**. `package.json` and `package-lock.json` unchanged.
  `npm audit fix` was not run.
- Migrations created: **none**. Alembic head unchanged.
- Backend changed: **none**. No new table, no schema change, no Clarify API.
- State version: **2** (unchanged). Server `snapshot_schema_version`: **2**
  (unchanged).

---

## 13. Deviations from the handoff

1. **Defer is two steps, not one.** The prototype applies outcomes 1–5 on a
   single tap and its example toast (`отложено · вернём во входящие в пн`)
   implies a system-chosen date. The owner contract and
   `LIFEOS_MASTER_CONTEXT.md` §32 both require an explicitly selected future
   date and forbid silently choosing one. The owner contract wins. Defer expands
   a date block below the list, reusing the same expansion pattern the handoff
   already defines for the delete confirmation.
2. **No Delegate counterparty input.** The handoff has no such control, and the
   contract makes it conditional on one existing. `waiting_for` is persisted and
   validated as optional so it can be filled later without a migration.
3. **No time picker on Defer.** The handoff has no Defer UI; the contract allows
   time to stay optional. Date-only is the smallest truthful choice.
4. **Panel is centred with a mobile bottom sheet.** The handoff allows "centred
   or anchored to the source row"; centring plus the existing LifeOS sheet
   treatment below 640px was chosen so the panel inherits production responsive
   behaviour instead of introducing a second pattern.
5. **Layouts 1a and 1b were not built.** The README marks 1c as the approved
   variant and 1a/1b as optional.
6. **Digit shortcuts 1–6 were implemented** (the handoff lists them as a
   recommendation) with a visible mono key cap per row on desktop.

---

## 14. Known limitations

- Waiting items are **retrieval-only** — there is no UI to resolve, convert or
  delete one yet. Adding a lifecycle would have meant inventing product
  semantics the contract did not approve. Worth an explicit owner decision.
- References are likewise list-only: no search, no editing, no deletion.
- `buildLegacyPreview` does not count Waiting/Reference rows; legacy snapshots
  cannot contain any.
- `due` for a deferred Task carries the raw `YYYY-MM-DD` date rather than a
  locale-formatted label, matching the existing free-text `due` convention
  (`'17:00'`, `'eod'`, `'tue'`). Deliberate: introducing a formatted label would
  change display semantics shared with Quick Add.
- The Clarify panel is reachable only from the Notes route, as specified.
- Interactive behaviour is asserted against component source plus manual browser
  verification, because the suite renders with `renderToStaticMarkup` under the
  `node` Vitest environment and the repo has no DOM testing library. Adding one
  would have been a dependency addition outside this task's scope.

---

## 15. Explicit non-scope — nothing below was started

Adaptive Analytics Slice 3 / 4 / 5 and later slices; Reviews / Debriefs;
Signals; experiments; trade-off and retention analytics; tasks-in-projects;
project membership; subtasks; collaboration; notifications; delegation
messaging; reference search / folders / backlinks; knowledge graph; navigation
redesign; design-system rewrite; backend schema expansion; database migrations;
dependency upgrades; `npm audit fix`; deployment; unrelated cleanup or
refactoring. A test asserts the Clarify modules carry no AA coupling (no AA
repository, queue, coordinator, fact builder, `enqueue`, `aa_`, measurement or
forecast reference); only the shared IANA timezone helper is imported.

---

## 16. Verdict

**PASS.**

All six Clarify outcomes produce real, durable, retrievable operational state.
The source Quick Note survives cancellation, validation failure and destination
failure, and is removed only in the same state update that persists its
destination. Project uses the real Project domain and never touches Goals.
Waiting and Reference are additive snapshot collections at state version 2, with
old snapshots loading unchanged. Localization is complete in RU and UK, the UI
follows the approved handoff layout on the production design system, and the
full backend and frontend validation suites pass.
