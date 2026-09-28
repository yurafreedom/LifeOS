# Life OS — Implementation Plan

**Phase:** Plan (read-only — no feature code yet)
**Date:** 2026-07-01
**Status:** Draft — WAITING FOR approval
**Basis:** Discovery Report `Outputs/Discoveries/lifeos-refinement_discovery_2026-07-01.md` + your 5 answers
**Governing docs:** README + SKILL + ARCHITECTURE + master prompt (warehouse-ai `CLAUDE.md` ignored, per your ACK)

Six batches, each independently shippable, QA'd in **4 theme/scene combos** (dark · light · paradise-day · paradise-night) × **2 locales** (RU · UA). One batch at a time; diffs shown; I wait for your confirm between batches.

**Order:** Batch 1 Density → Batch 2 Schema migration → Batch 3 Calendar → Batch 4 GTD P0 → Batch 5 GTD P1 → Batch 6 GTD P2.
Rationale: density is the visual base; the schema migration is a tiny dedicated batch that unblocks both calendar and GTD; features then build on a frozen shape.

Two genuinely-new components across the whole scope (per Constraint #7): the **calendar cube** and the **Clarify panel**. Everything else reuses capsules / tag chips / accordion cards / modal / green-check.

---

## FORWARD-COMPAT COUPLINGS (decided up front, honored in every batch)

1. **One status enum, shared by calendar + GTD.** `status ∈ {'next','waiting','someday'}`, `null`/absent = unclassified. Orthogonal to `stakes` (важно/рутина stays a separate boolean). The calendar day-modal status control (Batch 3) is built as a generic segmented control driven by this enum + the stakes boolean — NOT a hardcoded важно/рутина toggle — so Batch 4 adds Next/Waiting/Someday without touching Batch 3's control.
2. **One task-schema migration (Batch 2)** adds every new field with safe defaults so no feature causes a second churn.
3. **`--readable` token** introduced in Batch 1 and reused verbatim by the calendar day-modal and Clarify panel.

---

## BATCH 1 — LAYOUT / DENSITY / READABILITY  (complexity: M)

### Scope
Introduce `--readable` and cap the over-stretching blocks; enforce the 12px font floor (curated); harmonize adjacent button heights; raise paradise-day card opacity + add heading scrims; gate the debug rail behind `?debug`. No data/schema changes.

### Files touched
- `ui_kits/life-os/styles.css` — add `--readable`, apply caps, font-size fixes, button-height fixes, paradise card opacity, scrims.
- `ui_kits/life-os/App.jsx:385-409` — wrap `.demo-rail` in a `?debug` gate.

### 1a · `--readable` (~680px), applied ONLY to (per your Q3):
- task list container + `.tasks-chips` + `.tasks-toolbar` (TasksPage) — cap the list column, not the page.
- finance transaction list (`.fin-tx` rows / their list wrapper) + `.fin-toolbar`.
- 2-col **data** blocks: `.profile-cards`(:1598), `.pc-grid-2`(:1626), `.pc-food-cols`(:1678), `.dog-grid`(:1756), `.dog-vet`(:1870), `.dog-profile-fields`(:1776), `.health-grid`(:1888), `.mcd-titration-grid`(:1428).
- **EXCLUDED (stay wide):** `.panel-grid`(:648, KPI hero) and `.home-charts`(:2079). Token added to `styles.css :root` alongside the density tokens (`:20-54`).
- Mechanism: `max-width: var(--readable); margin-inline: auto;` (or a `.readable` utility wrapper) on the listed blocks — centered within the 1200px `.main`.

### 1b · Font floor = 12px (CURATED — leave-list for your veto)
**RAISE to ≥12px** (content / labels the user reads):
`.task-tag` 9.5→12 (:706) · `.task-due` 10→12 (:716) · `.panel-meta` 10 (:663) · `.today-date` 10 (:619) · `.goal-tag` 10 (:814) · `.goal-foot` 11 (:817) · `.money-budget-lab` 10 (:791) · `.money-list-time` 10 (:803) · `.toast-name` 10 (:933) · `.toast-ts` 10 (:936) · milestone subs 10 (:966,973) · `.qn-item` meta 10 (:1486) · `.set-row-hint` 10 (:2468) · `.pc-sub` 9.5 (:1622) + pc rows (:1633,1665) · `.dog-avatar-hint` 9 (:1774) · `.dog-inv-meta` 11 (:1841-1852) · `.meds-item-meta` 9.5 (:1944) + med metas (:1934,1991,2000,2001) · habits labels 9.5/10 (:832,880,895) · placeholders (`.task-add-input` 9.5 :736, `.qn-input-field` 10 :1451, `.tb-cmd-input` 10 :588) · `.sb-foot-sub` 9.5 (:545) · chart axis/labels 9.5-10.5 (:2140,2182,2221,2249,2040) · `.set-table-head`/cell-actions 9.5-10 (:2561,2563) · `.set-seg-glyph` 9 (:2512).

**LEAVE (proposed — intentional tiny mono chrome, please veto any you want raised):**
- `.eyebrow` mono 11px (`colors_and_type.css:182`) and the ~30 11px mono chrome labels that mirror it (uppercase-tracked technical chrome). The master prompt example ("tags 9.5→11–12") suggests 11 is tolerable; strict floor=12 would raise these too. **My recommendation: raise <11 to 12; keep pure-mono 11px eyebrows/timestamps at 11.** If you want strict 12 everywhere, say so and I'll sweep the 11px mono set too.
- Any glyph-only indicator where the box, not the text, carries meaning (e.g. `.set-seg-glyph` is a checkmark opacity — will still raise to 12 for safety).

### 1c · Button heights
- `.set-btn-danger` 36→`--btn-h-md` 30 (:2548) so it matches `.set-btn-primary`/`.set-btn-ghost` in the same row. (ARCHITECTURE.md:118 notes danger was the lone `--btn-h-lg`; harmonizing is a deliberate reversal — flagged here for sign-off.)
- `.meds-filter-chip` (:3079) given explicit `height: var(--btn-h-sm)` to match `.meds-view-tab` (:3070) in the med toolbar.
- Hit-zone ≥40px (Constraint #5): confirm padded targets on `.task-check`, filter chips, icon buttons via `::before { inset }` expansion where visual size stays small.

### 1d · Background readability (Constraint #1)
- paradise-day `--surface` 0.86→**0.96** (`styles.css:4173`); paradise-night 0.72→**~0.90** (:4291) for parity (flagged — night value not specified in prompt; recommend raising for the same reason).
- Heading/meta scrims: the over-scene text already has `text-shadow` (:4359-4400); add a subtle translucent underlay behind page titles/eyebrows where contrast <4.5:1 measured. No photo removal/darkening. No backdrop-blur under paradise (ARCHITECTURE.md:220).
- Row hover: no change needed (no low-contrast blue hover exists — prior obs was stale); verify contrast holds on paradise.

### 1e · Debug rail gate (Q4)
- `const DEBUG = new URLSearchParams(window.location.search).has('debug');` in App.jsx; render `.demo-rail` only when `DEBUG`. Query string survives hash routing (`index.html?debug#/home`). Toggles STAY in Settings; **no profile menu built.** Nothing deleted.

### QA checklist (Batch 1)
- [ ] lists/tabs/2-col/finance hold ~680px; `.panel-grid` + `.home-charts` still wide — all 4 themes.
- [ ] no rendered text <12px except vetoed mono chrome — RU + UA (UA strings are longer; check no clipping).
- [ ] adjacent buttons equal height; hit zones ≥40px.
- [ ] paradise day+night: headings/meta readable (≥4.5:1), photo intact, no invisible cards, no frozen entrance animations.
- [ ] `?debug` shows rail; plain URL hides it; Settings toggles work.

### Rollback
Pure CSS + one guarded render block; revert the two files. No state/schema impact.

---

## BATCH 2 — TASK SCHEMA MIGRATION  (complexity: M; the linchpin)

### Scope
One idempotent `LifeDataProvider.migrate()` bump adding all new task fields with safe defaults + backfill. No UI yet — features in later batches consume it.

### New fields on every task (defaults)
| Field | Type | Default / backfill |
|---|---|---|
| `date` | ISO `YYYY-MM-DD` \| null | backfill from `due` where parseable (`eod`→today, `tomorrow`→+1, weekday-code→next occurrence, `HH:MM`→today); else `null` |
| `time` | `HH:MM` \| null | from `due` if it's a time; else from `schedule.time`; else `null` |
| `order` | number | index within its day/list at migration time |
| `status` | `'next'|'waiting'|'someday'` \| null | `null` (unclassified) |
| `waitingFor` | `{person,since}` \| null | `null` |
| `contexts` | `string[]` | `[]` |
- `due` **kept** as derived/legacy display (not removed). `stakes`, `tag`, `done` untouched.

### Files touched
- `LifeDataProvider.jsx` — bump state version; add `migrate()` cases (idempotent: guard `if (t.date === undefined)`); extend `buildInitialState` seed tasks with the new fields; extend `addTask`/`updateTask` to accept/persist them.
- `App.jsx:191-210 addTaskFromUI` — populate `date`/`time`/`order` on create (derive `date` from the QuickAdd schedule; `order` = append).
- `lib/calendar.js:44-55` — `placeTask` gains an ISO-date fast-path (`task.date` used directly when present; loose-`due` parsing kept as fallback for un-backfilled/legacy).
- Read-only consumers verified unchanged by the additive shape: `TasksPage.jsx`, `TaskList.jsx`, `TaskDetailModal.jsx`, `QuickAddModal.jsx`, `GoalsWidget.jsx`.

### Behavior deltas (per caller)
- `lib/calendar.js`: now prefers `task.date`; existing week-placement unchanged when `date` absent → no regression.
- `addTaskFromUI`: new tasks get real `date` → they render on the correct calendar day immediately (previously only if `due` matched the current week).
- All others: read new fields optionally (`task.status ?? null`) → no behavior change until their batch.

### Invariants
- Migration idempotent (re-running is a no-op) — VERIFY with a double-invoke in QA.
- No existing field removed; `activityLog` untouched; localStorage key unchanged.
- Deploy-race safety (old code + new data): extra fields are ignored by old readers → safe.

### QA checklist (Batch 2)
- [ ] Fresh load (no prior state): seed tasks carry sane `date`/`order`.
- [ ] Upgrade load (existing `lifeOsState`): backfill runs once, values sane, second reload doesn't re-migrate.
- [ ] Calendar still renders identically (no visual change expected this batch).
- [ ] Both locales load without error.

### Rollback
Migration is additive + version-gated; to roll back, revert the version bump (new fields become inert). Recommend you export state before first upgrade load.

---

## BATCH 3 — CALENDAR REBUILD (cube)  (complexity: L)

### Scope
Replace the week grid with a **cube** interface zooming DAYS ⇄ MONTHS ⇄ YEARS; a flexible day-modal (done / delete / reorder / toggle status / edit-via-nested-popup / auto-move on date change); a History tab (done/overdue/archived → table + restore).

### New components
- `pages/calendar/CalendarCube.jsx` — the three-level cube grid + zoom/arrow nav state (`level ∈ days|months|years`, anchor Date). Day cube shows date number + weekday only (no tasks). Hover: gradient edge-glow + lift, 150-200ms. Year grid shows ~12 at a time, pages forward to 2100 (Q).
- Refactor `pages/calendar/DayDetailModal.jsx` → flexible day-modal (or new `DayModal.jsx`): reuses green-check (`.task-check.is-done`), delete, drag/▲▼ reorder (writes `order`), a **generic status segmented control** (stakes + status enum — forward-compat), and an edit affordance opening…
- `pages/calendar/TaskEditPopup.jsx` — nested popup-within-modal (title/description/date/time), Save. **Needs nested-modal infra** (no portal today): implement via a higher `z-index` layer (day-modal z:60 → popup z:80) + closing/stacking discipline; no backdrop-blur under paradise.
- History: a tab in the calendar surface rendering a table (creation date, title, closure status, Restore button) from `state.tasks` (done/overdue) + archived items; Restore flips `done`/`status` and re-dates. Reuses activityLog for creation date where available.

### Files touched
- `CalendarView.jsx` — becomes the cube host (or replaced by CalendarCube mounting); week-view code removed/retired.
- `lib/calendar.js` — add month/year aggregation helpers (reuse source-agnostic `aggregate`); day filter `task.date === cubeISO`.
- `styles.css` — cube grid, hover glow, flexible-modal, nested-popup, history table, `--readable` on modal content.
- `i18n.jsx` — new strings (RU+UA): month/year labels via `Intl.DateTimeFormat` where possible; history/restore copy; edit-popup labels.
- Auto-move: because day cubes filter `task.date`, editing date in the popup moves the task for free (Discovery B confirmed).

### Weekly-Review calendar marker (optional, P0 pragmatic per your note)
- A synthetic "every Friday" event the aggregator expands (no recurrence engine). Primary Weekly-Review surface is the home accordion (Batch 4). Calendar marker is a thin add in `lib/calendar.js` if you want it — flagged as optional.

### Forward-compat
- Day-modal status control uses the shared enum + stakes boolean → Batch 4 adds Next/Waiting/Someday options with zero rework.

### QA checklist (Batch 3)
- [ ] Days↔Months↔Years zoom + arrow nav; year grid bounded, pages to 2100.
- [ ] Day cube shows date+weekday only; hover glow/lift ~150-200ms; today = blue (locked).
- [ ] Day-modal: mark done (green-check), delete, reorder persists (`order`), status toggle, edit fields.
- [ ] Nested edit popup opens above modal, saves; changing date auto-moves task to correct cube.
- [ ] History tab lists done/overdue/archived + Restore works.
- [ ] All 4 themes (no invisible modal/popup under paradise; no frozen animations) × RU/UA.

### Rollback
New components are additive; `CalendarView` swap is one route change — keep the old week-view component until sign-off, then remove.

---

## BATCH 4 — GTD P0 (core)  (complexity: L, mostly the Clarify panel)

### Scope
Task statuses **Next Action / Waiting For** (Waiting carries `from whom / since when`); filter capsules следующие · в ожидании · когда-нибудь; a 6-outcome **Clarify funnel** replacing the single "в задачу"; a **Weekly Review** home accordion checklist.

### Statuses + filters
- `TaskDetailModal.jsx` + calendar day-modal (Batch 3 control): add status options; Waiting shows a `{person, since}` subline (writes `waitingFor`).
- `TasksPage.jsx:14-38` — add capsules `next/waiting/someday` (array entry + filter branch; **S** work, pattern confirmed). Same capsule component.

### Clarify funnel (the new panel — Constraint #7 sanctioned)
- New `pages/ClarifyPanel.jsx` (compact review panel) replacing `QuickNotesPage onPromote` single outcome. The "<2 min? do it now" prompt + 6 outcomes:
  1. **do-now (<2min)** → mark done immediately (or create+complete).
  2. **delegate** → create task `status:'waiting'` + `waitingFor`.
  3. **defer** → create task (→ optionally set `date`/`time`, lands on calendar).
  4. **project** → **create a new Goal** from the item title at 0% (your Q5) — `GoalsWidget`/goals state gains an add path.
  5. **reference** → **flag the source note archived** (new `note.archived=true`); stays retrievable via an archive filter in `QuickNotesPage`; **not deleted**, **leaves the active inbox count** (your Q5).
  6. **delete** → remove note.
- Note model gains `archived` boolean; `QuickNotesPage` gets an archive filter capsule and excludes archived from the active count.

### Weekly Review
- Home accordion card (reuse accordion pattern): checklist ritual — clear inbox · review next actions · check Waiting For · scan projects for a next action · review Someday. Check state persisted (lightweight, e.g. `state.weeklyReview`), resets weekly. Primary surface = home (your note). Optional synthetic Friday calendar event from Batch 3.

### Files touched
`pages/QuickNotesPage.jsx` (archive filter, count excl. archived, launch Clarify), `App.jsx` (clarify wiring replacing openQuickAdd-from-note path :330), `pages/TasksPage.jsx` (capsules), `TaskDetailModal.jsx` + Batch-3 day-modal (status/waitingFor UI), `GoalsWidget.jsx`/goals state (add-goal path), `pages/HomePage.jsx` (Weekly Review accordion), `LifeDataProvider.jsx` (note.archived, weeklyReview state, addGoal), `i18n.jsx` (RU+UA copy), `styles.css`.

### QA checklist (Batch 4)
- [ ] Set Next/Waiting/Someday; Waiting subline (from whom/since) renders + persists.
- [ ] New filter capsules filter correctly; existing filters unaffected.
- [ ] Clarify: all 6 outcomes behave (do-now completes; delegate→waiting; defer→calendar; project→new 0% goal; reference→note archived + still counted-out + retrievable; delete→gone).
- [ ] Weekly Review accordion checks persist, reset weekly.
- [ ] 4 themes × RU/UA; UA copy present for every new string.

### Rollback
Clarify is a new panel; the old single-outcome path can be feature-flagged until sign-off. Note/goal additions are additive.

---

## BATCH 5 — GTD P1 (organize)  (complexity: M)

### Scope
@-contexts as a second tag dimension (reuse `contexts[]`); Someday/Maybe list pulled out of main flow; per-goal Next Action + "⚠ no next action" stuck flag; a "Focus Now" home widget (1-3 next actions by context).

### Files touched
`categories.jsx` (context defs: @home/@computer/@calls/@errands/@5-min/@high-energy + call-icon, visually distinct from spheres), `TaskDetailModal.jsx`/day-modal (context chips editor), `TasksPage.jsx` (someday view + context filter), `GoalsWidget.jsx` (nextAction display + stuck flag; link goal↔task via `linkedGoalId`/`nextActionId`), `pages/HomePage.jsx` (Focus Now widget), `LifeDataProvider.jsx` (goal.nextAction), `i18n.jsx`, `styles.css`.

### QA checklist (Batch 5)
- [ ] Contexts render distinct from spheres (icon + color); a task can carry both a sphere `tag` and `contexts[]`.
- [ ] Someday/Maybe list separate; per-goal next action + stuck flag show; Focus Now surfaces 1-3 by context.
- [ ] 4 themes × RU/UA.

---

## BATCH 6 — GTD P2 (polish)  (complexity: M)

### Scope
Explicit horizon labels (quarter/year/life) on goals/monthly/annual; Inbox Zero counter; auto-detectors (projects with no next action; Waiting For > N days).

### Files touched
`GoalsWidget.jsx`/placeholder pages (horizon labels), `QuickNotesPage.jsx`/`HomePage.jsx` (Inbox Zero counter), detector logic in `LifeDataProvider.jsx` or a `lib/gtd.js` helper, `i18n.jsx`, `styles.css`.

### QA checklist (Batch 6)
- [ ] Horizon labels correct; Inbox Zero counter accurate; detectors flag stuck projects + stale Waiting items.
- [ ] 4 themes × RU/UA.

---

## CONFLICTS / SIGN-OFF ITEMS
1. **Button-height reversal:** harmonizing `.set-btn-danger` 36→30 reverses ARCHITECTURE.md:118's deliberate "danger is the lone `--btn-h-lg`" call. Recommend proceeding (Constraint #2 wins); needs your ack.
2. **11px mono chrome:** strict floor=12 vs. the prompt's "→11-12" example. Recommend keep pure-mono 11px eyebrows/timestamps at 11, raise everything else to 12. Veto if you want strict 12.
3. **paradise-night surface** 0.72→~0.90 not specified by the prompt (only day's 0.86→0.96). Recommend raising night for parity; confirm.
4. **Recurrence:** P0 uses the home accordion + optional synthetic Friday event; no engine. Confirmed by your note.
5. **`preview/` specimens + `/design-sync`:** the two new components (cube, Clarify panel) get dark-only preview cards after their batches; run `/design-sync` afterward (no `_ds_sync.json` anchor → full re-verify, expected).

## NOT-TOUCHED (binding)
- No changes to: the ambient dark/light token sets beyond the listed font/height fixes; medication/dog/finance business logic; activityLog structure; localStorage key name; the wordmark; stakes=orange discipline; today=blue. No new dependencies. No profile menu (per Q4). `due` field kept.

**WAITING FOR:** approval of this plan (and the 4 sign-off acks + the Q3 leave-list veto, if any) before I write Batch 1 feature code.
