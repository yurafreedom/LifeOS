# LifeOS Calendar — Current-Code Discovery

Date: 2026-09-29 · Mode: DISCOVERY ONLY (no repo edits, no branch change, no DB access)
Audited tree: `origin/main` = `414df142700653d616016ff644bff3d9c0007540` (read via `git show origin/main:<path>`)
All `file:line` references below are to `origin/main`.

---

## 1. Executive verdict

- **The owner's Calendar redesign is still unbuilt on main.** None of it exists: day cubes, the month and year hierarchy, the 2100 horizon, the flexible day manager, the nested editor, date-move, History and Restore.
- **The current Calendar also has correctness problems that go beyond missing features.** It renders fabricated demo events into every browsed week. It places tasks from a loose `due` string, so dated tasks land on the wrong day or disappear. Opening a task from the Calendar hands `TaskDetailModal` an incomplete task, and saving that task **overwrites the real notes, category and subtasks** (§5.4).
- **A full-date field already exists.** `task.schedule = { date: 'YYYY-MM-DD', time: 'HH:MM'|'' }` is persisted by Quick Add (`QuickAddModal.jsx:67`, `App.jsx:122`) and by Clarify's Defer outcome (`domain/clarify.ts:255-268`). The Calendar simply never reads it. The old plan's "add `task.date` plus a backfill migration" is an **obsolete assumption**: no new date field is needed, and there is no version bump.
- **Everything the redesign needs is additive, optional snapshot fields.** That covers closure and history metadata, timestamps and per-day order. Snapshot `version` stays 2, the server `schema_version` stays 2, and no Alembic migration is needed.
- **One owner decision affects the persisted state: OD-1, the History closure vocabulary.** The owner wrote "незакрытые / закрытые / в архив", and the current model has no closure state at all. Everything else is settled by the owner's text or by current code.
- **Result:** `CALENDAR_DISCOVERY_STATUS=PASS`, `IMPLEMENTATION_PLAN_READY=NO` until OD-1 is answered. Once it is answered, a Plan can be written without re-reading the archive.

---

## 2. Source recovery metadata

| Item | Value |
|---|---|
| Source-of-truth file | `/Users/yurasachenko/Downloads/LifeOS_Calendar_Recovered_Source_of_Truth.md` |
| SHA-256 | `7edbbba7fb7251397283653044509ca88a244def0e35173f71ad83a3d9cf0493` (25 449 B) |
| Archive | `/Users/yurasachenko/Archives/LifeOS/export_claude_lifeOS_2026-09-28/conversations.json` |
| Archive SHA-256 | `1691e35dd44f126dbcd41cce9cc387c8ec38aaeb0d6e75bca101c33827c400fc` (matches the value recorded in the SoT file) |
| Conversation | `3cfa1a74-079e-44e1-ae3c-bdec673f3b08` "LifeOS Dev chat" |
| Message | `019f1e07-d657-7b54-b00c-a32178200431`, sender `human`, `2026-07-01T14:14:19.721219Z` |
| Verification | Selected directly by UUID, without a semantic scan. The whitespace-normalized `attachment:0` (owner brief) and `attachment:2` (Claude refinement) are each **fully contained** in the SoT file. The SoT quotes are therefore byte-faithful to the archive. |

Authority order used: owner text (`attachment:0`) > Claude refinement (`attachment:2`) > the old plan > current code, for implementation details only.

---

## 3. Current Git baseline

| Check | Result |
|---|---|
| Checkout | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` |
| Branch | `feat/adaptive-analytics-slice-6-experiments` (**not** main) |
| HEAD | `ae55ff80e3b22c1a976a9776c9e63bfb85faae66` = `origin/main` + 4 Slice 6 commits |
| origin/main (after fetch) | `414df142700653d616016ff644bff3d9c0007540` = pinned authoring main ✔ |
| Working tree | clean |
| Worktrees | only the canonical one |
| Stash | `stash@{0}` (slice2 pre-hero preservation), untouched |

The branch was not switched, because this was a Discovery-only session. The audit reads `origin/main` through Git objects.

**Slice 6 overlap check** (`git diff --stat origin/main HEAD`):
- Slice 6 touches **no** Calendar, task, LifeData, migrate, QuickAdd, TaskDetail or Calendar CSS file.
- It does touch shared registries that Calendar will also touch: `ru.js`/`uk.js` (+176 lines each), `routes.js`, `routeRegistry.js`, `lazyRoutes.jsx`, `Sidebar.jsx`, `smoke.test.jsx`, `route-registry.test.ts`, `lazy-routes.test.jsx` and `locale-shape.test.ts`.
- That is textual merge-conflict risk only. **There is no semantic dependency on Adaptive Analytics Slice 6.**

---

## 4. Current Calendar architecture map

```
App.jsx:196-206  case 'calendar' → <CalendarView onAddSlot={() => openQuickAdd(false)}  ← date DROPPED
                                                 onOpenTask={task => setDetail({partial task})}> ← data-loss path
  components/CalendarView.jsx (157 lines, eager route, not lazy)
    ├─ state: anchor (Date, browser-local), dayModal (Date|null)
    ├─ weekStart Mon-first (:31-37); 7 days (:39-41)
    ├─ LifeCalendar.aggregate(weekStart, state, t)            (lib/calendar.js)
    ├─ header: month label, ‹ today ›, single "неделя" button (:72-84)
    ├─ .cal-pill-grid: 7 × .cal-day with ≤7 pills + "+N ещё" (:86-120)
    │     day body click → onAddSlot(d) → QuickAdd (date lost)
    └─ DayDetailModal only via "+N ещё" overflow (:109-115, :122-134)
  pages/calendar/DayDetailModal.jsx (87 lines): read-only pill list + "добавить событие"
  lib/calendar.js (134 lines): seed pool + tasks via placeTask(due) + dog meals ×7
  data/calendar-seed.js: 27 fabricated events keyed by dayOffset 0..6
CSS: styles/calendar-nav.css (legacy hour-grid .cal-grid/.cal-cell/.cal-event + .cal-head/.cal-btn),
     styles/finance-calendar.css:210-412 (.cal-pill-*, .cal-day, .modal-day-*),
     theme-light.css (18 rules), paradise.css:279-307 (.cal-btn/.cal-view-btn), tokens.css --cal-* (12),
     responsive.css:65-69 (legacy .cal-grid)
Nav: Sidebar.jsx:32, MobileBottomNav.jsx:18 (5 fixed slots incl. calendar)
Locale: ru.js:940-973 / uk.js (33 cal_* keys, 23 of them cal_seed_*)
Mirrors (stale, NOT in the app bundle): ui_kits/life-os/{CalendarView,lib/calendar,pages/calendar/DayDetailModal,…}.jsx,
     preview/calendar*.html — do not treat them as implementation sources, and do not update them.
```

---

## 5. Current task data model

### 5.1 Field map

Seed: `initialState.js:84-91`. Quick Add: `App.jsx:113-125`. Clarify: `clarify.ts:57-67, 215-268`.

| Field | Persisted? | Source of truth / writers | Consumers | Legacy concern |
|---|---|---|---|---|
| `id` | yes | `Date.now()` number (App:115, clarify:217); seeds 1–6 | all | numeric; collisions only in theory |
| `title` / `titleKey` | yes | seeds use `titleKey`; user tasks use literal `title` | App `resolvedTasks` :105-111, calendar.js:92 | **the TaskDetailModal save writes back the resolved `title`**, which freezes the locale of seed tasks |
| `done` | yes | `toggleTask` (flip) | Tasks filters, counts App:176, Today.jsx, calendar.js:89 (skips done) | a boolean only; there is no `completed_at` |
| `created_at` | **absent** | — | — | historical backfill is impossible (only the activityLog `created` entry exists, which is capped at 5000, prunable and not authoritative) |
| `completed_at` | **absent** | — | — | same |
| archived / closure | **absent** | — | — | — |
| `stakes` | yes | QuickAdd/TaskDetail toggle (`qa_routine` / `qa_stakes` = «рутина» / «важное») | pills, filters | **this is the owner's "важно/рутина" field** |
| `tag` | yes | `'today'` / `'inbox'` / seed tags; App:119 derives it | Tasks chips, `category` sort | single string |
| `tagLabel` | yes | frozen localized category name (App:120) | list meta | locale-frozen |
| `category` | yes | the whole `LifeExpenseCats` object (QuickAdd:62, TaskDetail:53) | TaskDetail | these are finance expense categories, reused for tasks |
| `due` | yes | seeds: `'eod'`, `'HH:MM'`, `'tue'`. QuickAdd: **localized** `t('due_eod')` for stakes tasks, otherwise `schedule.time` or `''` (App:121). Clarify defer: `'YYYY-MM-DD'` | calendar.js `placeTask`, list meta, Tasks "overdue" filter | **polymorphic display string**; the localized value is persisted |
| `schedule` | yes | `{date, time}` or `null` (QuickAdd:67; clarify:227/266 `{date, time:''}`) | **no reader at all** | the **closest canonical date** |
| time | inside `schedule.time` | QuickAdd | — | can be set with no date (`{date:'', time:'14:00'}`) |
| `notes` | yes | QuickAdd / TaskDetail | TaskDetail | = the owner's «описание» |
| `subtasks` | optional | TaskDetail only | TaskDetail | **fake default seed** (§5.4) |
| order | **absent** | array insertion order (append in `addTask`) | Tasks list (the "date" sort is a no-op, TasksPage:38-48) | — |
| activity linkage | derived | `activityLog` entries `entity_type:'task'` (created/edited/completed/reopened/deleted) | `ActivityTimeline` in TaskDetail | operational log, capped at 5000, prunable by the user (`clearActivityOlderThan`); **not** semantic history |
| deletion | hard | `deleteTask` filters the task out (LifeDataContext:213-223) | — | irreversible; the UI copy says «удалить навсегда?» |
| validation | none | `migrate.js:77-84` only checks that `tasks` is an array | — | new fields need their own validator (Clarify precedent) |

### 5.2 Explicit answers

- **A. Is there a canonical full-date field?** Effectively yes: `schedule.date` (`YYYY-MM-DD`), plus `schedule.time`. It is written by Quick Add (when the user opens "запланировать…") and by Clarify Defer, which validates it with `parseDateOnly` in the Kyiv zone.
- **B. Why doesn't the Calendar use it?** `lib/calendar.js` (Sprint 3B) predates `schedule` and was never updated. It parses only `due` (`calendar.js:45-56`), and only when the displayed week is the current week (`:87`).
- **C.** Not applicable, since A is yes. The loose `due` string is a display label, not a date.
- **D. Does changing a date move a task anywhere?** No. No editor exposes the date or time after creation. TaskDetailModal has no schedule fields.
- **E. Can tasks have a stable user-defined order within a day?** No. There is no order field, and the day buckets are sorted by time (`calendar.js:127`).
- **F. What does `done` mean?** A reversible boolean: "completed now". Tasks shows done tasks under «сделано». Calendar hides them. Home's task stat is **seed data** (`HomePage.jsx:137`, `LifeDashSeed`), not real tasks.
- **G. Is archive distinct from delete?** Archive does **not exist** for tasks. Only projects (`archiveProject`) and medications (soft-delete to `status:'archived'`) have archive semantics.
- **H. Is "overdue, closed unresolved" a real current state?** No. Even "overdue" is fake: the Tasks filter is `!done && due.includes(':')` (TasksPage:41), which only means "has a time". Overdue has to be *derived* (`schedule.date < today(Kyiv) && active`). An explicit "closed unresolved" state requires a **new** persisted field → OD-1.
- **I. Can Restore be represented truthfully today?** Only for completed tasks (`done:true → false`, which `toggleTask` already does). For closed or archived tasks there is nothing to restore until the closure field exists. Deleted tasks cannot be restored.

### 5.3 Consequences of the current `due` handling (verified by reading the code)

- Stakes tasks created by Quick Add persist `due = t('due_eod')` (for example «до конца дня»). `placeTask` cannot parse that string, so **stakes tasks never appear in the Calendar**, even when a date was chosen.
- A routine task scheduled for a future date with a time persists `due = 'HH:MM'`. `placeTask` puts it on **today**, and it moves to "today" again every day.
- Tasks with a date but no time, and all Clarify-deferred tasks, get `due` = `''` or `'YYYY-MM-DD'`, which is not parseable, so they are **never shown**.
- The weekday codes (`'tue'`) float to the current week, every week.

### 5.4 Pre-existing data-integrity defects that the Calendar work must fix or avoid

1. **Calendar → TaskDetail data loss.** `App.jsx:199-206` builds `{id,title,done,stakes,tag,due}` without `notes`, `category`, `subtasks` or `schedule`.
   - `TaskDetailModal.commit()` (`:52-55`) then writes `category: null`, `notes: ''` and the fake subtasks.
   - `updateTask` shallow-merges them (LifeDataContext:208-212), which overwrites the real values.
2. **Fake subtasks.** `TaskDetailModal.jsx:19-23` seeds three hardcoded Russian subtasks whenever `task.subtasks` is missing, which is true of every task created by Quick Add or Clarify. Saving persists them. This affects the Tasks page as well.
3. **Localized values persisted.** Saving from Tasks persists the resolved `title` and the localized `due` (from `resolvedTasks`), so the seed `'eod'` becomes «до конца дня».
4. **Fabricated Calendar events.** `calendar-seed.js` is anchored to `dayOffset` of *whichever* week is displayed. The same 27 fake events therefore appear in every past and future week. This violates "missing data is not zero / do not invent".

Items 1 and 2 must be fixed before, or together with, the day manager. The day manager must pass the **persisted** task (looked up by id from `state.tasks`), never a reconstructed one.

---

## 6. Snapshot / schema findings

| Item | Current |
|---|---|
| Snapshot `version` | 2 (`initialState.js:77`, `migrate.js:26,31-37`; module-boundaries says it "stays 2") |
| Server `schema_version` | `Literal[2]`, and `payload.version` must equal it (`schemas/state.py:10-18`) |
| Server payload | opaque `dict[str, JsonValue]` stored as JSONB. **No task-level validation on the server.** Max 5 MiB (`config.py:29`) |
| Sync | `StateSyncCoordinator`: whole-snapshot `PUT` with `expected_revision` (CAS), debounce 500 ms, 409 freezes sync (by design) |
| Migration precedent | Clarify added `waitingItems[]` / `references[]` additively, with validators and no version bump (`migrate.js:46-58`) |
| Alembic | the Calendar is operational snapshot state only, so it has no relational need |

**Fields the Calendar needs, classified:**

| Field (name to be finalized in the Plan) | Class |
|---|---|
| `schedule.date` / `schedule.time` (reuse) | **already exists** |
| `created_at` (ISO instant, set on create) | additive optional; **historical backfill impossible**, so legacy tasks show "—" |
| `completed_at` (set/cleared by complete/reopen) | additive optional; legacy done tasks show "—" |
| closure state (for example `closure: 'dropped'|'archived'` + `closed_at`) | additive optional; **requires owner decision OD-1** |
| per-day order (for example `order: number`) | additive optional; default derivable (fallback: array index) |

`CALENDAR_STATE_MIGRATION_REQUIRED=NO`: no version bump and no backfill. The only migrate.js change is an *optional* validator for the new optional fields, following the Clarify pattern. Absent fields mean "unknown" or "active".
`SNAPSHOT_MIGRATION_EXPECTED=NO` · `ALEMBIC_MIGRATION_EXPECTED=NO`.

---

## 7. Recovered owner requirements (canonical)

See the SoT file §1, verified against the archive. In summary:
- **Month grid:** 28–31 cubes, showing number and weekday only, with no tasks on them.
- **Cube hover:** a thin gradient highlight on the edges plus a lift. A better animation is allowed.
- **Click a cube** to open the day manager. It must support:
  - complete, with the green check from the island (Paradise) design;
  - delete;
  - reorder;
  - toggling «важно» / «рутина» (= `stakes`);
  - editing date, time, description and title in a nested popup with Save;
  - automatic move to another cube when the date changes.
- **History tab:** completed tasks, plus overdue tasks *explicitly marked* «незакрытые / закрытые / в архив». It shows a table with creation date, title and closure status, plus Restore.
- **Navigation levels:** days → months of the current year → a years tab.
- **Year range:** the owner listed «2026…2035» and then said **«лучше наверное 30 лет сразу наперед»** ("30 years ahead at once is probably better"), with a hard maximum of **2100**.

Settled by owner text, and therefore **not** owner questions:
- **Year window:** 30 years per view, capped at 2100.
- **Delete** is separate from History. It is never listed there and is irreversible.
- **"Category / status"** means the existing «важно / рутина» (`stakes`) toggle. The existing category picker can stay available but is not required.
- **«описание»** means `notes`.
- **The cube is content-free**, which means no neighbouring-month filler cubes: "сколько дней в месяце, столько и кубиков" ("as many cubes as there are days in the month").

---

## 8. H1–H7 verification

| # | Verdict | Evidence |
|---|---|---|
| H1 week/pill layout | **CONFIRMED** | `CalendarView.jsx:10-17` (comment), `:39-41` (7 days), `:86-120` (pills in the cell), `:50-52` (`moveWeek ±7`), `:81-83` (a single `cal_week` button) |
| H2 day modal overflow-oriented | **CONFIRMED** | `DayDetailModal.jsx:8-12` ("Opens when the user clicks '+ N ещё'"), `CalendarView.jsx:109-115`. Read-only list plus "добавить событие". No complete, delete, reorder or edit |
| H3 legacy `due` aggregation | **CONFIRMED** | `calendar.js:45-56` (`eod`, `tomorrow`, `HH:MM`, DOW codes), `:87` (current week only). `schedule` is ignored. Also injects the seed pool (`:69-82`) and dog meals ×7 (`:109-124`) |
| H4 full date edit/move | **CONFIRMED missing** | TaskDetailModal has no date or time inputs (`:15-27`, `:105-176`). Only Quick Add captures a schedule, at creation. Nothing reads it |
| H5 cube hierarchy / 2100 / History+Restore | **CONFIRMED missing** | nothing in `CalendarView`, routes or locale. No archive or closure field. `cal_month` / `cal_day` keys exist but are unused |
| H6 reusable components | **PARTIAL** | Reusable: `.qa-backdrop` / `.qa-modal` shell, `.qa-toggle` (рутина/важное), `.task-check` (green `--success` in dark and paradise), paradise `.btn--positive` green capsule (defined, "unused so far", `paradise.css:367-368, 435-443`), QuickAdd date/time inputs (`.qa-sched-input`), `ClarifyPanel`'s focus-trap/return/layered-Escape pattern (`ClarifyPanel.jsx:35-41, 116-179`), `timezone.ts` date-only helpers, the `--cal-*` tokens. **Not reusable as-is:** the DayDetailModal body (a pill list), the `.cal-pill*` grid, calendar.js week placement, the seed pool, TaskDetailModal as a nested editor (own window-level Esc, fake subtasks, no schedule fields, on the do-not-split list) |
| H7 task mutation gaps | **CONFIRMED** | `LifeDataContext.jsx:186-223, 634`: only `toggleTask`, `addTask`, `updateTask` (shallow merge) and `deleteTask` (hard). **Missing:** reorder, archive/close, restore of closed tasks, `created_at` / `completed_at` stamping, schedule-aware update |

---

## 9. Requirement gap matrix

| # | Requirement | Source | Current implementation | Status | Current files | Data change | UI change | Tests | Risk | Owner decision |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | Month view = 28–31 day cubes | owner | 7-column week | MISSING | CalendarView.jsx | none | new month grid | C01–C03 | low | no (OD-2 default) |
| R2 | Cube shows number and weekday only | owner | the cell has pills | MISSING | CalendarView, finance-calendar.css | none | new cube | C03–C04 | low | no |
| R3 | No task content in the cube | owner | pills rendered | CONFLICTING | same | none | remove pills | C04 | low | no |
| R4 | Hover: gradient edge + lift (open to better) | owner (direction) | pill hover tint | MISSING | CSS | none | cube hover, focus-visible parity, reduced motion | C22, C24 | low | no |
| R5 | Click a cube → day manager | owner | only the overflow opens a modal; a body click opens QuickAdd | CONFLICTING | CalendarView:102,109 | none | cube = button → manager | C05 | low | no |
| R6 | Days → months → years zoom | owner | none | MISSING | — | none | 3 levels + nav | C01, C26 | med | no |
| R7 | Years visible 30 at once, max 2100 | owner | none | MISSING | — | none | year grid paged by 30 | C10 | low | no (OD-4 lower bound: default) |
| R8 | Complete with the green check | owner | TaskDetail «выполнить»; `.task-check` | PARTIAL | TaskDetailModal, panels.css:100 | `completed_at` (additive) | check in row | C11 | low | no |
| R9 | Delete | owner | `deleteTask` hard + confirm | PARTIAL (reuse) | LifeDataContext:213 | none | confirm in manager | C12 | low | no |
| R10 | Reorder within a day | owner | none | MISSING | — | `order` (additive) | drag + keyboard/buttons | C15 | med | no |
| R11 | Toggle важно/рутина | owner | `stakes` toggle in TaskDetail/QuickAdd | PARTIAL | TaskDetailModal:107-111 | none | inline toggle in row | C13 | low | no |
| R12 | Edit title / date / time / description in a nested popup with Save | owner | TaskDetail: title + notes only | PARTIAL | TaskDetailModal | schedule write path | nested editor | C14, C25 | **high** (focus/Esc stacking, data loss §5.4) | no |
| R13 | Changing the date moves the task | owner | nothing reads schedule | MISSING | calendar.js | none (reuse schedule) | derive cube membership from `schedule.date` | C07–C09, C27 | med | no |
| R14 | Add from a day persists that date | implied by owner ("классика") | `onAddSlot` drops the date (App:198); QuickAdd has no date prop | MISSING | App.jsx, QuickAddModal | none | `defaultDate` prefill | C06 | med | no |
| R15 | History tab | owner | none; the activityLog is not history | MISSING | — | closure fields | History surface | C16–C19, C30 | med | **OD-1** |
| R16 | History: completed | owner | `done:true` exists | PARTIAL | — | `completed_at` | row | C16 | low | no |
| R17 | History: overdue, explicitly marked unclosed/closed | owner | no state | MISSING | — | new closure field | mark actions + row | C17 | **high** (semantics) | **OD-1** |
| R18 | History: archived | owner | no task archive | MISSING | — | closure `archived` | archive action | C17 | med | **OD-1** (vocabulary) |
| R19 | History shows creation date, title, closure status | owner | no `created_at` | MISSING | — | `created_at` (legacy "—") | table/list | C16 | low | no |
| R20 | Restore → active, same entity | owner | only `done` flip exists | MISSING | — | clear closure fields | Restore button | C18–C19 | med | no |
| R21 | Localization RU/UK | repo policy | 33 cal_* keys | PARTIAL | ru.js, uk.js | none | new keys, retire cal_seed_* | C20–C21 | low | no |
| R22 | Themes dark/light/paradise | repo | pill theming | PARTIAL | CSS layers | none | cube/manager theming | C22 | med (cascade order) | no |
| R23 | Mobile ≤640 | repo | 7 columns with horizontal scroll | CONFLICTING | finance-calendar.css:337-342 | none | responsive grid | C23 | low | no |
| R24 | Fabricated seed events removed | repo truthfulness | seed pool on every week | CONFLICTING | calendar-seed.js, calendar.js | none | remove | C04, C30 | low | no (OD-3 default) |
| — | Old `task.date` + backfill migration | old plan | — | OBSOLETE_OLD_ASSUMPTION | — | — | — | — | — | — |
| — | Old shared GTD status enum (next/waiting/someday) | old plan | Clarify shipped `waitingItems[]` / `references[]` as collections instead | OBSOLETE_OLD_ASSUMPTION | — | — | — | — | — | — |
| — | "Only two sanctioned new components" / no-build Babel / localStorage schema | old plan | Vite + server snapshot | OBSOLETE_OLD_ASSUMPTION | — | — | — | — | — | — |

---

## 10. History / Restore analysis

What current main can show truthfully:

| State | Truthful today? | Notes |
|---|---|---|
| completed | **yes** (`done:true`), but without a completion date | `completed_at` is recorded going forward only |
| overdue unresolved | **derivable** only for dated tasks: `schedule.date < todayKyiv && !done && !closure` | this is a *current* state, not a History entry. It stays in its day with an overdue marker |
| overdue, explicitly closed unresolved | **no** | needs a new persisted closure |
| archived | **no** | needs a new persisted closure |
| deleted | **no, and it should stay out** | a hard delete; the owner separates delete from History |

**Smallest truthful v1** (recommended, pending OD-1):
- History is a **derived view** over `state.tasks` of the rows where `done === true || closure != null`. There is no second store and no copies.
- New fields:
  - `created_at`, stamped in `addTask`, the Clarify task records and future creation paths;
  - `completed_at`, stamped and cleared by complete/reopen;
  - `closure` ∈ {OD-1 vocabulary} plus `closed_at`.
- **Restore** is a single `updateTask`-style mutation on the **same id**. It sets `done:false`, clears `completed_at`, `closure` and `closed_at`, and keeps `schedule`, `notes`, `stakes`, `category` and `subtasks`. It logs `action:'restored'`, which is already in the activity vocabulary (`activity.js:19`).
  - No duplicate is possible, because nothing is copied.
  - A restored past-dated task reappears in its original day as overdue. The user can then edit its date. This is the recommended default; it asks nothing extra of the owner.
- **Creation date for legacy tasks:** unknown, shown as "—". Do **not** backfill from the activityLog: it is capped at 5000, prunable by the user, is not semantic history (MASTER_CONTEXT §7), and seed tasks have no entry at all.
- **Undated tasks** (no `schedule.date`) can be completed and appear in History too, because History is not limited to dated tasks. They are never "overdue".
- **Bounded rendering:** tasks number in the hundreds and the snapshot is capped at 5 MiB. A plain list sorted newest-closed-first, with an optional "show more" slice, is sufficient. No virtualization.

---

## 11. Reorder analysis

- **Current state:** no order field and no DnD library. The only runtime dependencies are `react` and `react-dom`. There is no pointer-reorder or keyboard-reorder code anywhere. Day buckets sort by time.
- **Reusing the array order:** feasible, since swapping two same-day tasks' positions in `state.tasks` persists through the whole-snapshot PUT. But after a **date move**, the task's position in its new day is determined by its global array index, which is effectively arbitrary. Array order is also shared with the Tasks page, so a reorder in the Calendar silently changes the Tasks list order.
- **Recommendation:**
  - Add an optional numeric **`order`**, meaningful within the task's `schedule.date` day.
  - Sort the day list by `(order ?? +∞, schedule.time, created_at/array index)`.
  - Write `order` values only for the tasks of the affected day, renumbering 0..n-1 in a single `setStateRaw` pass (one CAS write).
  - A date move sets `order = max(dest) + 1`, which appends the task to the destination day.
- **Manual order vs time:** once the user has reordered a day, manual order wins, and times are still displayed as labels. This is the default; it is not an owner question.
- **Sync effect:** one debounced whole-snapshot PUT. A 409 conflict freezes sync as with any other mutation. No new risk.
- **Accessible fallback (required):** per-row "move up / move down" buttons, or Alt+↑/↓ on the focused row, with an `aria-live` announcement. Pointer drag is an enhancement built on native pointer events, **with no new dependency**. The move-up/down buttons alone satisfy the owner's «поменять местами» ("swap places"). v1 can ship with the buttons only.

---

## 12. Date / hierarchy analysis

- **Date math:** use pure date-only strings and the `timezone.ts` helpers (`parseDateOnly`, `nextDateOnly`, `localDateForInstant`).
  - Month length comes from `Date.UTC(y, m, 0)`. Weekday comes from `Date.UTC(...).getUTCDay()`. **Never** `toISOString().slice(0,10)` on a local Date.
  - **Today** = `localDateForInstant(new Date())` (Europe/Kyiv), the same source Clarify Defer uses (`clarify.ts:248`). The current Calendar uses browser-local `new Date()` (`calendar.js:62`, `CalendarView.jsx:27`), which is inconsistent with the rest of the app.
- **Leap years:** handled by `Date.UTC`. Cover 2028-02 (29 days), 2100-02 (28: divisible by 100 and not by 400), and 2000 if it is reachable.
- **Month lengths:** exactly N cubes. **No neighbouring-month filler** (settled by owner text).
  - Weekday alignment is an open visual point → OD-2. The recommended default is a free-flowing grid with no blank spacers. The owner wants the weekday printed *on* each cube, which only makes sense if columns are not weekday-aligned.
- **First day of week:** Monday-first, as today. Only relevant if OD-2 chooses alignment.
- **Year range:**
  - Maximum is **2100**: navigation clamps, and a date input with a year above 2100 is rejected by the editor.
  - Visible window is **30 years per view** (owner). From 2026 the pages are 2026–2055, 2056–2085 and 2086–2100.
  - Lower bound: recommended default (OD-4) is the smaller of the current Kyiv year and the earliest year among dated tasks, so past overdue days stay reachable. Month-level ‹ › navigation is clamped the same way.
- **States:** today (existing `--cal-today-col` blue tint, a locked principle per the old discovery), selected (the currently open day), and past/future. No per-cube task count, because the owner said "никаких задач" ("no tasks").
- **Keyboard/a11y:** cubes are real `<button>`s with `aria-label` = full localized date. Arrow-key roving focus within the grid is nice-to-have; Tab order is sufficient for v1. Enter/Space opens. Level switches use a tablist (the `qa-toggle` / `cal-views` pattern).

---

## 13. Route analysis

- **Current mechanics:**
  - `readRouteFromHash` supports prefix sub-routes (`medications/…`, `review/…`, `project-analytics/…`), and the page reads its own parameters from the hash with a `hashchange` listener (MedicationsPage:48-56, ReviewPage:40-55, ProjectAnalyticsPage:39-127).
  - `normalizeRoute` only allows the `medications/` prefix, so `setRoute('calendar/…')` would fall back to home. Pages therefore write `window.location.hash` directly (the MedicationsPage precedent).
  - `LIFE_ROUTES.size` is pinned at 20 in `smoke.test.jsx:47`. A **prefix does not change the size**.
- **Recommendation (smallest model that keeps useful navigation):** one route id, `calendar`, plus a prefix branch in `readRouteFromHash` and page-local hash parsing:
  - `#/calendar` → the current Kyiv month (day cubes)
  - `#/calendar/2026-09` → the day cubes of a month
  - `#/calendar/2026-09-29` → that month with the day manager open, so Back closes the manager
  - `#/calendar/2026` → the month cubes of a year
  - `#/calendar/years` or `#/calendar/years/2056` → year cubes (page start)
  - `#/calendar/history` → History
  - Invalid dates or years outside the bounds → normalize to `#/calendar` with `replace` semantics.
- **Cost:** one line in routeRegistry, one parser module in `pages/calendar/`, and route-registry tests. The nested editor stays **out** of the URL, as local UI state.
- **Merge note:** Slice 6 also edits `routeRegistry.js` and `routes.js`.

---

## 14. Modal / editor analysis

| Concern | DayDetailModal | TaskDetailModal | Needed |
|---|---|---|---|
| Esc | a window listener | a window listener (plus ⌘↵) | top-most dialog only; with nesting, both fire today, so **one Esc closes both** |
| Focus | focuses close; no trap; no return | none | trap + return (the ClarifyPanel pattern) |
| Scroll lock | sets `body.overflow` and restores the previous value | none | reference-counted, or the parent owns it |
| Labeling | `role="dialog" aria-modal`, no `aria-labelledby` | `role="dialog"` only | `aria-labelledby` on both |
| z-index | `.qa-backdrop` 60 | 60 | editor above the manager (modals.css already has 70/80 tiers) |
| Content | read-only pills | title, stakes, category, fake subtasks, notes, activity | rows: check, title, time, stakes toggle, move up/down, edit, delete, overdue mark |

**Recommendation: Option B.**
- **A new `pages/calendar/DayManagerModal.jsx`** replaces DayDetailModal, which has little reusable body. Each row: `.task-check`, title, time label, «важно / рутина» toggle, ↑/↓, edit, delete (with the existing «удалить навсегда?» confirm copy), and overdue actions (OD-1).
- **A small nested `CalendarTaskEditor`**, a dialog for title, date, time and description (notes), plus Save/Cancel.
  - It reuses the `qa-*` classes and the QuickAdd `input[type=date|time]` styling.
  - Date validation: `parseDateOnly`, year ≤ 2100.
  - On Save it writes `schedule` and `due` in one `updateTask` on the persisted task.
- **A tiny shared dialog hook** (focus trap, focus return, top-of-stack Escape) extracted from the ClarifyPanel pattern. ClarifyPanel itself is not changed.
- **Why not Option A:** evolving DayDetailModal gives no real reuse.
- **Why not Option C:** TaskDetailModal is on the do-not-split list, lacks schedule fields, and carries the fake-subtask defect.
  - The fake-subtask default and the partial-task construction in `App.jsx:199-206` should still get a **minimal correctness fix** in the same track: default subtasks to `[]`, and pass the persisted task. The calendar's existing `onOpenTask` path is otherwise a data-loss path.
- **Moving a task while the manager is open:** the manager derives its rows from `state.tasks` filtered by `schedule.date === openDay`. After Save, the moved task simply leaves the list. Show a transient confirmation naming the destination date, with a link to it. The same id is kept.

---

## 15. Quick Add / add-from-day

- `CalendarView` calls `onAddSlot(d)` with a date (`:102, :131`), but `App.jsx:198` wires `onAddSlot={() => openQuickAdd(false)}`, so **the date is discarded**.
- `QuickAddModal` has no `defaultDate` prop. It resets `date` to `''` on every open (`:29-36`).
- `addTaskFromUI` **does** preserve `schedule` (App:122), so a date the user picks is persisted in `schedule.date`. It is just never pre-filled, and the calendar never reads it.
- **Required changes:**
  - `openQuickAdd(stakes, seed)` carries `seed.date`.
  - QuickAdd accepts `defaultDate`, opening the schedule expander pre-filled.
  - `addTaskFromUI` stamps `created_at` and stops persisting localized `due` for dated tasks: use `due = schedule.time || schedule.date`, matching Clarify Defer's non-localized convention.
  - The Clarify guard test `clarify-ui.test.jsx:294-299` pins `addTaskFromUI(`, `<QuickAddModal` and `onQuickAdd={() => openQuickAdd(false)}`, so keep those strings or update the pins honestly.
  - **C06 must assert that the new task appears in the exact cube after a reload.**
- Alternatively, the day manager can host its own inline add (title plus the fixed date). The recommendation is to reuse QuickAdd with the pre-fill, avoiding a second creation path.

---

## 16. Task move semantics

**A "move" edits `schedule.date` (and optionally `schedule.time`) on the same id in one mutation.** No copy-delete. `notes`, `subtasks`, `category`, `stakes`, `created_at`, `done` and closure are all preserved. It logs `edited`, as the existing `updateTask` already does. Cube membership is derived from persisted state. `order` is set to append to the destination day.

| Case | Behavior |
|---|---|
| same month / other month / other year | identical code path; only the date string changes |
| past date | **allowed**; the task becomes overdue on that day. Nothing in the owner text forbids it, and Clarify's future-only rule applies to Defer only |
| year > 2100 or an invalid date | rejected in the editor (Save disabled, inline error); never persisted |
| completed task | editable; stays completed and moves its History "day". v1 recommendation: allow |
| closed/archived task | edited only after Restore; the day manager does not show closed tasks |
| clearing the date | makes the task undated, so it leaves the Calendar and stays in Tasks. Allowed, but the editor should confirm, since the task leaves the Calendar |

Flagged as unresolved but **not blocking**: none. The defaults above follow current semantics without inventing policy.

---

## 17. Localization / theme / responsive

- **Locale:**
  - New RU and UK keys are needed for the level tabs, History, closure labels (OD-1), editor labels, reorder a11y, the overdue marker and the move confirmation.
  - The 23 `cal_seed_*` keys become dead once the seed pool is removed. Delete them in both dictionaries, because `locale-shape.test.ts` pins parity.
  - `cal_add_event` → «добавить задачу».
  - Month and weekday names come from `Intl` using `LifeStrings[locale]._intl_locale`, as today. English stays disabled.
- **Themes:**
  - Calendar rules live in `finance-calendar.css` (pills, day modal) and `calendar-nav.css` (head, buttons, legacy hour-grid), with overrides in `theme-light.css` and `paradise.css`. The cascade order is pinned by `styles-manifest.test.js`.
  - New cube and manager rules belong in `finance-calendar.css`, with paradise overrides in `paradise.css` (last).
  - The green check is `.task-check.is-done` (`--success`, green) in dark and paradise. **In light it is blue by design** (`theme-light.css:74`).
  - Paradise's `.btn--positive` green capsule, "defined per reference, unused so far", is the island-design green confirm. Use it for the explicit «выполнить» action in paradise.
  - Hover: a gradient border via `background-clip` / mask or an `::before` ring, plus `translateY(-2px)` over 150–200 ms using `var(--ease)`.
    - Existing lifts are −1px on `.qa-btn-save` and `.money-log`.
    - Honour `prefers-reduced-motion`; there is precedent in `pages-core.css` and `paradise.css`.
    - Give `:focus-visible` the same emphasis.
- **Legacy CSS:**
  - `.cal-pill*`, `.cal-pill-grid`, `.cal-day*` and `.modal-day-*` become unused once CalendarView and DayDetailModal are replaced. The same applies to the already-dead `.cal-grid`, `.cal-cell`, `.cal-event` and `.cal-col-*` rules, and to `responsive.css:65-69`.
  - Remove them in the same change. Note that the `.cal-head`, `.cal-btn` and `.cal-views` chrome is reusable.
  - The module-boundaries rule "keep the emitted CSS byte-identical" applies to *structural* moves only, not to feature changes.
- **Responsive:**
  - A pure CSS grid, `repeat(auto-fill, minmax(~64px, 1fr))`, with the readable max-width.
  - Approximate cubes per row: 4 at 320 px (8 rows), 5 at 390 px, ~7 at 768 px with the sidebar, 7–8 at 1024 px, and a capped width at 1440/1920 px.
  - The month level has 12 cubes (3/4/6 columns). The year level has 30 cubes on the same grid.
  - **No horizontal scroll**, which replaces today's `minmax(72px)` × 7 overflow on mobile.
  - The day manager is a full-height sheet at ≤640 px; the nested editor is also full-screen there.

---

## 18. Future test matrix

**Existing coverage:** **zero** Calendar tests (no test imports CalendarView, calendar.js or DayDetailModal). Task mutations are only mocked in `smoke.test.jsx:76`.

**Pins that will need truthful updates:**
- `route-registry.test.ts` (the new calendar prefix);
- `locale-shape.test.ts` (new and removed keys);
- `styles-manifest.test.js` (only if a layer is added, which is not recommended);
- `clarify-ui.test.jsx:294-299` (the QuickAdd wiring strings);
- `state-migration.test.ts` (validators for the new optional fields);
- `smoke.test.jsx` (the route size stays 20);
- `lazy-routes.test.jsx` (only if the Calendar becomes lazy, which is optional).

| ID | Test | Layer |
|---|---|---|
| C01 | month cube count = 28/29/30/31 (2026-02, 2028-02, 2026-04, 2026-01) | unit (pure month model) |
| C02 | leap: 2028-02 = 29, 2100-02 = 28 | unit |
| C03 | the cube DOM has only number + weekday | component |
| C04 | no task text, pills or seed titles inside the grid | component |
| C05 | clicking a cube opens the manager for that exact date (aria-label/heading) | component |
| C06 | add-from-day → `schedule.date` = cube date → appears in the cube after re-migration of the payload | integration |
| C07 | a date edit keeps the same id; source list −1, destination +1; array length unchanged | unit + component |
| C08 | cross-month move | unit |
| C09 | cross-year move | unit |
| C10 | 2100 clamp (nav + editor reject 2101); year pages 30 wide | unit |
| C11 | complete from the manager sets `done` and `completed_at`; the reopen path clears them | unit |
| C12 | delete: confirm, gone from state, never in History | unit + component |
| C13 | the stakes toggle persists | unit |
| C14 | title/time/notes edit persists; notes, subtasks and category untouched (regression for §5.4) | unit |
| C15 | reorder: `order` renumbered for the day only; stable after `migrateStateCopy(JSON round-trip)` | unit |
| C16 | History lists completed with creation date ("—" if unknown) | component |
| C17 | History lists the OD-1 closure states | component |
| C18 | Restore clears closure/done on the same id | unit |
| C19 | Restore never duplicates (length and ids unchanged) | unit |
| C20 / C21 | RU / UK labels and `Intl` month names | component |
| C22 | dark/light/paradise render (class hooks) plus manual browser QA | manual + static |
| C23 | 320/390/768/1024/1440: no horizontal overflow | manual browser QA |
| C24 | keyboard: Tab to a cube, Enter opens, focus returns to the cube on close | component |
| C25 | nested editor: Esc closes only the editor; the second Esc closes the manager; focus returns correctly | component |
| C26 | hash parse/normalize for all calendar sub-routes; Back closes the day | unit (route parser) |
| C27 | no timezone shift: today = Kyiv date near midnight UTC; no `toISOString().slice` | unit |
| C28 | Tasks page, QuickAdd and Clarify Do Now/Defer unchanged (existing suites green) | regression |
| C29 | a mutation produces one enqueue; the snapshot passes `migrateStateCopy` and the server `StateReplace` (version 2) | unit |
| C30 | History derives from `state.tasks` only; clearing the activityLog does not change History | unit |

---

## 19. Risks

1. **Data loss via the existing Calendar → TaskDetail path** (§5.4). High; this exists today. Fix it first.
2. **Nested Esc/focus/scroll-lock conflicts** between window-level listeners. Medium.
3. **Legacy `due` expectations.** Removing `due`-based placement means seed tasks and time-only tasks no longer appear in the Calendar. That is truthful, but visible. Mention it in the PR.
4. **Removing the fabricated seed events** leaves the Calendar visibly empty for accounts without dated tasks. This is the correct behavior per "missing data is not zero" (OD-3).
5. **Merge conflicts with Slice 6** in the locale, route and test files. Implement after Slice 6 merges, or expect a routine merge.
6. **Kyiv vs browser-local "today"** for users outside the Kyiv zone. Follow the app convention (Kyiv).
7. **Scope creep:** recurring events, time grid, DnD library, external sync and GTD statuses are all **excluded**.

---

## 20. Owner decisions

| ID | Decision | Required? |
|---|---|---|
| **OD-1** | History closure vocabulary for overdue tasks: what «незакрытые / закрытые / в архив» mean as persisted states. Recommended: `completed` (existing `done`), `closed_unresolved` («закрыта без выполнения»), `archived` | **YES**: affects persisted fields and History |
| OD-2 | Month grid: free-flow cubes (recommended; the owner put the weekday on each cube) vs Monday-aligned with blank spacers | NO: default adopted, owner may override |
| OD-3 | Remove fabricated seed events and daily dog-feeding entries from the Calendar (recommended: remove both; the day manager manages tasks) | NO: default adopted |
| OD-4 | Earliest navigable year: min(current Kyiv year, earliest dated-task year) | NO: default adopted |

Details are in `lifeos-calendar-owner-decisions.md`.

---

## 21. Implementation sequencing recommendation

On an ordinary feature branch, after Slice 6 merges and `main` is fast-forwarded:

- **P0 — Task-integrity fixes.** Keep these in a small separate commit.
  - TaskDetailModal: default subtasks to `[]`.
  - The Calendar/any `onOpenTask` passes the persisted task.
  - Stop persisting localized `due` from the TaskDetail save (keep the persisted `due`; do not merge the resolved display fields).
  - Tests: C14 regression.
- **P1 — Task domain primitives.** A pure `domain/tasks.ts`:
  - date helpers: `taskDate(task)` → validated `schedule.date` | null; `isOverdue(task, today)`; `dayTasks(state, date)` with ordering;
  - mutations: `moveTask`, `reorderDay`, `completeTask` (with `completed_at`), `closeTask`/`restoreTask` (OD-1), `created_at` stamping;
  - provider wiring in LifeDataContext; optional-field validators in `migrate.js` (no version bump).
  - Tests: C07–C11, C13, C15, C18–C19, C27, C29, C30.
- **P2 — Month model and route.** A pure month/year/years model (clamped to 2100), the hash parser, and the `routeRegistry` prefix. Tests: C01, C02, C10, C26.
- **P3 — Cube UI.** Month, year and years levels plus the tablist and hover/focus/reduced-motion; remove the pill grid, seed pool and dead CSS; RU/UK. Tests: C03–C05, C20–C24.
- **P4 — Day manager, nested editor, dialog hook, add-from-day pre-fill.** Tests: C05, C06, C11–C15, C25.
- **P5 — History surface and Restore.** Tests: C16–C19, C30.
- **P6 — Full validation.** The AGENTS.md checklist, browser QA across dark/light/paradise × RU/UK × 320–1920, and an implementation report under `Outputs/Implementations/`.

**Estimated size: large.** It is frontend-only and snapshot-only, with no backend change and no dependency added.

---

## 22. Plan readiness

| Gate | Status |
|---|---|
| Archive source recovered / canonical source verified | ✔ both |
| Current task state understood | ✔ |
| Migration need classified | ✔ additive optional fields only; no version bump; no Alembic |
| History/Restore semantics resolved or explicitly owner-blocked | ⛔ **owner-blocked on OD-1** (everything else resolved) |
| Reorder persistence understood | ✔ optional `order` field + a11y buttons |
| Route strategy plannable | ✔ single `calendar` id + prefix sub-routes |
| Responsive architecture understood | ✔ auto-fill CSS grid, no horizontal scroll |
| Reusable components identified | ✔ §8 H6, §14 |
| No hidden dependency on Slice 6 | ✔ textual merge overlap only |

`CALENDAR_DISCOVERY_STATUS=PASS` · `IMPLEMENTATION_PLAN_READY=NO` (it becomes YES as soon as OD-1 is answered; OD-2 to OD-4 have adopted defaults).
