# Life OS — Discovery Report

**Phase:** Discovery (read-only, no feature code)
**Date:** 2026-07-01
**Status:** Draft — WAITING FOR review
**Scope:** Layout/Density (A) · Calendar rebuild (B) · GTD workflow (C)
**Basis HEAD:** `f82ec64` (branch `design-sync-setup`)

Label key: **VERIFIED** = read at file:line on current HEAD · **ASSUMED** = inferred, why-safe noted · **UNKNOWN** = needs resolution.

---

## PHASE 0 — ORIENT: findings & a blocking conflict

**Project shape CONFIRMED (VERIFIED).** Browser-run React design system, no build step (Babel-standalone in `index.html`), CSS custom properties under `[data-theme]`, hash routing, `localStorage` persistence via a single `lifeOsState` key, i18n via React context (RU primary, UA secondary). Global-scope JSX in `ui_kits/life-os/*.jsx`; seed data via `window.LifeXXX` globals (`data/*.js`). Matches the master prompt's stated shape. Source refs: `ARCHITECTURE.md:7-16`, `SKILL.md:5-14`, `ui_kits/life-os/data/*.js`.

**⚠️ BLOCKING CONFLICT #1 — `CLAUDE.md` belongs to a DIFFERENT project (VERIFIED).**
`CLAUDE.md` on disk (`CLAUDE.md:1-3`) opens with *"This is a Python 3.11 + FastAPI + aiogram 3.x + PostgreSQL project"* — it is the behavior contract for **"warehouse-ai" / "vendoru"**, a Telegram-bot backend. It references `app/services/pipeline.py`, alembic migrations, a VPS at `173.242.61.112`, `pytest`, Slack channels `#vendoru-*`, a Scope board MCP, etc. **None of it applies to this repo.** It is checked in at the repo root and was loaded as "project instructions."
- Master prompt Phase 0.1 says "if this master prompt conflicts with README/CLAUDE, THEY WIN — flag the conflict." Taken literally, that would bind me to warehouse-ai's Python three-phase/Outputs/Slack/alembic machinery, which is nonsensical here.
- **Resolution I'm proposing (needs your ack):** treat `README.md`, `SKILL.md`, and `ARCHITECTURE.md` as the governing project docs; treat `CLAUDE.md` as mis-filed and **ignore it** for this work. I will follow the master prompt's own workflow contract (Discovery → Plan → approval → batched implementation). I have NOT posted to any Slack channel and will NOT run any alembic/pytest/VPS commands. I did save this report under `Outputs/Discoveries/` (the one convention that is harmless and useful).
- Open question: do you want the wrong `CLAUDE.md` replaced with a real one for this repo (separate task), or left as-is?

**CONFLICT #2 — README/SKILL describe an aspirational spec, not current code (VERIFIED, low severity).**
`README.md` and `SKILL.md` still say *"Dark theme only"* and *"Life OS contains no decorative imagery… no stock photos, no hero artwork"* (`README.md:2`, `README.md:163`, `colors_and_type.css:2-3`). But `ARCHITECTURE.md:106,217-226` documents Sprint 3.6 adding the **`paradise` theme** with a full-screen tropical island scene (`components/ParadiseScene.jsx`, `assets/scene/island-day.jpg|island-night.jpg`). The master prompt's "THE BACKGROUND STAYS" constraint is about **paradise**, which README/SKILL predate. `ARCHITECTURE.md` is the accurate source of truth; README/SKILL are stale on these two points. No action needed for this scope beyond noting it.

**No conflict with the seven non-negotiable constraints** was found at the code level — they are all achievable on the current base. Notes per constraint appear inline below.

---

## WORK STREAM A — LAYOUT / DENSITY / READABILITY

### (1) Confirmed facts with refs

**Width cap.** `.main { max-width: 1200px; width: 100% }` — `styles.css:359`. This is the only global content cap. **There is NO `--readable` / `--measure` token** (grep confirms; only a code comment references a readability floor). — VERIFIED.

**Inner blocks that stretch short content full-width (no own max-width)** — VERIFIED, `styles.css`:
| Block | Selector | Line | Grid/width |
|---|---|---|---|
| Home dashboard panels | `.panel-grid` | 648 | `1fr 1fr` |
| Charts row | `.home-charts` | 2079-2080 | `1fr 1fr` (→1fr <960px) |
| Profile cards | `.profile-cards` | 1598 | `1fr 1fr` |
| Profile inner 2-col | `.pc-grid-2` | 1626 | `1fr 1fr` |
| Dog food cols | `.pc-food-cols` | 1678 | `1fr 1fr` |
| Dog grid / vet / fields | `.dog-grid`/`.dog-vet`/`.dog-profile-fields` | 1756/1870/1776 | `1fr 1fr` |
| Health grid | `.health-grid` | 1888 | `1fr 1fr` |
| Med titration | `.mcd-titration-grid` | 1428 | `1fr 1fr` |
| Finance tx row | `.fin-tx` | 3808 | `28px minmax(0,1fr) 28px auto auto` |
| Med filter/tab rows | `.meds-filter-row`/`.meds-view-tabs` | 3066/3078 | flex-wrap, full width |

The **task list** itself renders as rows inside a `.panel` (rows are flex, full width of the panel) — the "two-line content stretched across half the screen" complaint. Task filter chips (`.tasks-chips`) and sort trigger likewise span the panel width. — VERIFIED (`TaskList.jsx`, `TasksPage.jsx:52-57`).

**Typography tokens** — VERIFIED, `styles.css:20-28`:
`--text-xs:11px · --text-sm:12px · --text-md:13px · --text-lg:15px · --text-xl:18px · --text-2xl:24px · --text-3xl:32px`. (These density tokens live in `styles.css :root`, **not** in `colors_and_type.css` — that file's `:root` only holds color/radii/spacing/motion and is still labelled "Dark theme only.")
- `.task-title` = `--text-md` = **13px** (`styles.css:702`) — OK, ≥12.
- `.task-tag` = **9.5px** (`styles.css:706`) — **violates 12px floor.**
- `.task-due` = **10px** (`styles.css:716`) — **violates floor.**
- **No readability-floor token exists** — only a comment. Sub-12px sizes are pervasive: 9/9.5/10/10.5/11px appear on well over 150 lines across the stylesheet (agent enumerated them; the largest clusters are 9.5px and 10px chrome labels). — VERIFIED.

**Button height tokens** — VERIFIED, `styles.css:50-54`: `--btn-h-sm:26px · --btn-h-md:30px · --btn-h-lg:36px · --input-h:30px · --row-h:34px`. Adjacent-height mismatches:
- Settings action rows: `.set-btn-primary` 30px (`:2535`) + `.set-btn-ghost` 30px (`:2541`) next to `.set-btn-danger` **36px** (`:2548`) — danger 6px taller. — VERIFIED.
- Med toolbar: `.meds-view-tab` 26px (`:3070`) vs `.meds-filter-chip` content-height ~22-24px, no explicit height (`:3079`) — inconsistent. — VERIFIED.

**Background & over-scene text.** `ParadiseScene.jsx` (mounts only under `data-theme="paradise"`, `:5`) is a fixed `z-index:0` layer loading `island-day.jpg`/`island-night.jpg`. Dark/light use only the ambient radial-gradient (`colors_and_type.css:23-25`). Text sitting directly on the scene already gets a scrim-via-shadow: `.tb-title/.page-title` white + `text-shadow 0 2px 8px rgba(0,0,0,.4)` (`styles.css:4359`); `.tb-eyebrow/.page-sub` (`:4363`); `.set-h/.cal-title` (`:4400`). Transparent toolbar controls get a HUD pill `rgba(0,0,0,.32)` (`:4409-…`). — VERIFIED.

**Card surface opacity per theme** — VERIFIED, `styles.css`:
| Theme/scene | `--surface` | Line |
|---|---|---|
| dark | `rgba(22,26,33,0.65)` | 78 |
| light | `rgba(255,251,246,0.72)` | 213 |
| paradise-day | `rgba(255,251,246,0.86)` | 4173 |
| paradise-night | `rgba(20,28,40,0.72)` | 4291 |
Cards use `backdrop-filter: blur(10px)` in dark/light but **blur is forced off under paradise** (`ARCHITECTURE.md:220` — Chromium drops backdrop-filter subtrees over the animated scene). The universal card selector (`styles.css:4321-4327`) enumerates **real class names** — `.panel .stat-card .chart-card .pc-card .medc .meds-item .ph-card .mdp-* .milestone .today-hero`. **`.task-row` is NOT in that list** — task rows are not "cards"; they inherit the `.panel` surface they sit in.

**Row hover.** `.task-row:hover { background-color: rgba(255,255,255,0.025) }` (`styles.css:682`); stakes variant gets an orange gradient wash (`:683`); light theme `rgba(15,20,25,0.04)` (`:2815`). **No text-color change on hover** anywhere. — VERIFIED.

**Dev toolbar / prod flag.** **None exists** — grep for `isDev`/`NODE_ENV`/`import.meta`/`dev-toolbar`/`debug` returns nothing. There is no dev-only UI element to hide, and no dev/prod flag mechanism to hide it with — both would be **net-new**. — VERIFIED (absence).

**Language + theme toggles** live in `SettingsPage.jsx` → `AppearanceSection`: language segmented control (`:188-194`), theme 4-way Dark/Light/Paradise/System (`:162-187`). **There is no profile menu / avatar dropdown** — `TopBar.jsx` has only search + quick-add (`:4-46`); moving toggles into a profile menu means **building that menu first**. — VERIFIED.

### (2) Corrections to prior observations
- ✅ Button tokens 26/30/36 — correct.
- ✅ `.main` 1200px sole cap — correct.
- ✅ `.task-title` 13px, `.task-tag` 9.5px — correct.
- ❌ **Card bg `rgba(255,251,246,.86)`** — this is the **paradise-day** value (`:4173`), NOT the generic/dark card. Dark is `0.65`, light `0.72`, paradise-night `0.72`. Constraint #1's "0.86 → 0.96" is a **paradise-day-specific** raise.
- ❌ **Card radius 10px** — actually `--r-md` = **14px** (`colors_and_type.css:64`, applied `styles.css:4121` etc.).
- ❌ **Row hover text `#3B82F6`** — no hover text-color change exists; hover is a subtle bg only. The "intended fix #1D4ED8 + opaque row fill" is moot as stated (there's no low-contrast blue hover to fix); the real readability issue is over-scene text + card opacity, already partly scrimmed.

### (3) Open questions
- Which exact blocks get `--readable` (~680px)? Master prompt says lists/tabs/2-col/finance; explicitly **exclude** KPI hero row + charts. Confirm: should `.panel-grid` (home dashboard) keep the wide grid (it's KPI-ish) while task/finance lists get capped? My read: cap task list, tasks chips, finance tx list, 2-col *data* blocks (profile/dog/health); **leave** `.home-charts`, `.panel-grid` hero stat row.
- "Dev-only UI hidden in production" — since no dev toolbar exists, is there a specific element you consider dev-only (e.g. the theme "System" option, an export/clear-history control), or is this requirement N/A for this codebase?
- Sub-12px cleanup is large (150+ sites). Do you want a blanket "raise every <12px to 12px" pass, or a curated list (tags/due/meta only) to avoid disturbing mono chrome that's intentionally small?

### (4) Risks / constraint conflicts
- **Constraint #1 (background stays + card opacity 0.96):** safe. Raising paradise-day `--surface` 0.86→0.96 is a one-token change (`:4173`); adding scrims behind headings is additive. No blur re-introduction (would break overlays per `ARCHITECTURE.md:220`).
- **Constraint #2 (`--readable`):** must be applied per-block, not globally, or it collapses the charts/KPI row. Low risk if scoped.
- Touching the shared `.panel`/`--surface` affects **all** cards across every page and all 4 theme/scene combos — blast radius is wide; every change needs the both-themes-both-locales QA.

### (5) Complexity (S/M/L)
`--readable` token + apply to lists/tabs/2-col/finance = **M** · font floor cleanup (12px) = **M** (many sites) · button-height harmonization = **S** · card opacity + heading scrims = **S** · row-hover contrast = **S** (mostly already fine) · profile menu + move toggles = **M** (net-new menu) · dev/prod hide = **S** (pending scope clarification).

---

## WORK STREAM B — CALENDAR REBUILD

### (1) Confirmed facts with refs
- **Current calendar = week view** (Mon-first, 7 columns), `CalendarView.jsx:16-131`; renders ≤7 pills/day then a "+N ещё" overflow button (`:104-108`) opening `DayDetailModal` (`pages/calendar/DayDetailModal.jsx`). Today column tinted **blue** (`is-today`, `:88`) — locked principle. — VERIFIED.
- **Event aggregation** `lib/calendar.js:57-129` — `aggregate(weekStart, state, t)` merges three sources: seed pool (`LifeCalendarSeed`, `:68-81`), `state.tasks` where `done===false` placed via `placeTask(due,todayIdx)` (`:86-103`), and dog feedings repeated daily (`:108-123`). The aggregator is source-agnostic and **reusable** for month/year grouping; the **week-scoped placement** and pill-density are not. — VERIFIED.
- **Seed shape** `data/calendar-seed.js:20-61`: `{ dayOffset:0-6, time:'HH:MM', titleKey, kind:'stakes|routine|info', source, metaKey? }`. — VERIFIED.

- **⚠️ CRITICAL — task dating.** Tasks have **NO full ISO date**. The field is `due`, a **loose string**: `'eod' | 'tomorrow' | 'HH:MM' | weekday-code(tue/fri) | ''` (`LifeDataProvider.jsx:90-97`). `placeTask` (`lib/calendar.js:44-55`) parses it heuristically and only within the current week (`due:'tue'` is meaningless if today is Thursday). **This blocks the "auto-move on date change" requirement** — the master prompt's plan (store a full ISO date; each cube filters `task.date === cubeDay`) requires **adding an ISO date field and migrating existing tasks**. — VERIFIED.
- **No order/position field** on tasks (`TasksPage.jsx:35` sorts by `stakes` boolean or `due` string only) — reorder needs a new field. — VERIFIED.
- **Task status model is binary**: `done:boolean` + `stakes:boolean` (важно/рутина). No `status` enum, no `overdue` field, no `VALID_TRANSITIONS`. "Overdue" is a filter heuristic (`due.includes(':')`, `TasksPage.jsx:31`), not real. — VERIFIED.
- **Green-check "done" affordance EXISTS and is wired** to reuse: `.task-check.is-done { background: var(--success) }` (`styles.css:687-700`) with `I.check` icon (`icons.jsx:25`), wired in `TaskList.jsx:31-34`, `TasksPage.jsx:85-87`, `TaskDetailModal.jsx:150-151`. A paradise capsule press-physics layer (`.btn--positive` etc.) exists in `App.jsx:256-290`. — VERIFIED.
- **Recurring events: NOT supported** anywhere (no rrule/frequency/repeat fields; dog feedings are a hardcoded 7-day loop). Weekly-Review recurring event needs either a new recurrence model or a pragmatic once-seeded/regenerated event. — VERIFIED (absence).

### (2) Corrections to prior observations
- ✅ "Current modal is DayDetailModal on +N overflow" — correct (`CalendarView.jsx:104-108`).
- ✅ "Tasks lack full ISO date" — **correct and critical.**
- ✅ "No reorder field" — correct.
- **Nested-modal infra: does NOT exist** (prior scope assumed a "flexible modal" upgrade). Modals are App-level siblings (`QuickAddModal`, `TaskDetailModal`), no `React.createPortal`, and `DayDetailModal` + `TaskDetailModal` share `z-index:60` (`styles.css:1048`) — opening one from the other would overlap at the same layer. A nested edit-popup-within-modal must be **built** (portal or z-index stacking). — VERIFIED.

### (3) Open questions
- Data-model decision (drives everything): add `task.date` (full ISO `YYYY-MM-DD`) + optional `task.time`, keep `due` as a derived/legacy display, and write a `LifeDataProvider.migrate()` step to backfill existing tasks? This is the single largest calendar dependency — recommend deciding it in Plan up front.
- Reorder: add `task.order` (number) or store an ordered id-array per day? (order field is simpler and localStorage-friendly.)
- Weekly Review event: real recurrence engine (bigger) vs. a single seeded "every Friday" synthetic event the aggregator expands (smaller)? Recommend the latter for P0.
- Year cube grid bound to 2100 — confirm the visible window (~12-30 years, page forward). Master prompt already specifies arrow-nav can jump anywhere.

### (4) Risks / constraint conflicts
- Adding `task.date` changes the shape read by `lib/calendar.js`, `TasksPage`, `TaskDetailModal`, `QuickAddModal`, `App.addTaskFromUI`, and the migration — **full caller inventory required in Plan** before editing.
- The cube UI is genuinely new (allowed by Constraint #7 — calendar cube + clarify panel are the two sanctioned new patterns). Hover glow/lift must respect the 150-200ms motion budget.
- Nested modal must not re-introduce backdrop-blur under paradise (`ARCHITECTURE.md:220`).
- Constraint (forward-compat, master prompt Phase 2 note): the day-modal status control must be built **extensibly** (важно/рутина now, Next/Waiting/Someday later) — don't hardcode a boolean toggle.

### (5) Complexity (S/M/L)
Cube DAYS⇄MONTHS⇄YEARS interface = **M** · flexible day-modal (done/delete/reorder/toggle/edit) = **M** · nested edit-popup (needs portal/z-index infra) = **M** · ISO-date field + migration + auto-move = **L** (touches many call-sites; the linchpin) · history tab + restore = **L** (activityLog exists, `LifeDataProvider.jsx:107` — UI is the work) · recurring Weekly-Review = **S** (pragmatic) / **L** (real engine).

---

## WORK STREAM C — GTD WORKFLOW

### (1) Confirmed facts with refs (entity → GTD stage)
- **CAPTURE** = `QuickAddModal.jsx` — creates task or expense; fields `title/stakes/category/schedule/notes` (`:9-18,58-64`). — VERIFIED.
- **INBOX** = `QuickNotesPage.jsx` — raw notes `{id,text,at}` with a live count badge `page-count` (`:32`). This is the closest thing to a GTD inbox + counter. — VERIFIED.
- **PROJECTS** = `GoalsWidget.jsx` — goal shape `{id,title,pct,val,tag}` (`:6-10`); render shows title/progress/pct/timeframe. **No next-action field, no stuck flag, no goal↔task link.** — VERIFIED.
- **CONTEXTS/TAGS** = single `tag` string on a task (`App.jsx:191-202,197`): one of `today/stakes/work/money/habit/life/inbox` or null; expense categories in `categories.jsx` (16 expense + 6 income, each `{id,kind,icon,tint,name{ru,uk}}`). — VERIFIED.
- **HARD LANDSCAPE** = calendar (stream B). — VERIFIED.
- **Filter row** `TasksPage.jsx:14-21` array `[all,today,overdue,routine,stakes,done]`; markup `.tasks-chips`/`.tasks-chip.is-on` (`:52-57`); logic in a `useMemo` (`:28-38`). **Same capsule pattern reused** in `MedicationsPage.jsx:98-100` and `FinancesPage.jsx:68-77` — new capsules slot in by adding an array entry + a filter branch. — VERIFIED.
- **"в задачу" flow**: `QuickNotesPage.jsx:60 onPromote` → `App.jsx:330 openQuickAdd(false,{title,fromNoteId})` → QuickAddModal prefilled → `App.jsx:191-210 addTaskFromUI` creates the task and **deletes the source note** (`data.deleteQuickNote`). Single outcome — this is exactly the hook the 6-outcome Clarify funnel replaces. — VERIFIED.
- **i18n** `i18n.jsx` — RU primary (`LIFE_STRINGS.ru` `:7`), UA secondary (`.uk` `:610`), EN reserved but not rendered; `LIFE_LOCALES=['ru','uk']` (`:1155`); Slavic 3-form plural via `t.pl` (`:1167-1179`). New strings = add key to both dicts. — VERIFIED.

### (2) Corrections to prior observations
- No prior observation contradicted. Reinforced: **task has a single `tag` field, not an array** — it **cannot** carry spheres + @-contexts simultaneously without a schema extension (`contexts:[]` array or a `tags:[{type,value}]` model). — VERIFIED.
- There is **no `status` field** at all — Next/Waiting/Someday all require adding it (and Waiting-For needs a `{person,since}` subline object). — VERIFIED.

### (3) Open questions
- Tag model for @-contexts (Phase 2): add a parallel `contexts: string[]` (keeps existing `tag` untouched, lowest risk) vs. refactor to `tags:[{type,value}]` (cleaner, higher blast radius)? Recommend the additive `contexts[]`.
- Clarify funnel outcomes: two of the six (project→goals, reference→notes-archive) need target surfaces — goals accept a new item? notes get an "archive/reference" state? Confirm where "reference" lands.
- Weekly Review: home card vs. recurring Friday calendar event (ties to stream B's recurrence question) — or both.
- `status` vs existing `stakes`/`tag`: should `status:'next'|'waiting'|'someday'` be orthogonal to `stakes` (recommended — важно/рутина is priority, status is GTD state), or replace the tag semantics? Confirm.

### (4) Risks / constraint conflicts
- Constraint #7 (don't reinvent components): satisfied — filter capsules, tag chips, modal all reused; only the **Clarify panel** is sanctioned-new.
- Adding `status` touches the task shape → same caller inventory as stream B's `date` field; **do both schema additions in one coordinated migration** to avoid two churns.
- Every new string must land in **both** RU and UA (`i18n.jsx`) or the UA locale breaks — QA gate.
- Forward-compat: the calendar day-modal status control (stream B) and the GTD status filters must share one status vocabulary — design the enum once.

### (5) Complexity (S/M/L) — P0 focus
Next/Waiting status (field + selector + Waiting-For subline) = **M** · filter capsules следующие/в ожидании/когда-нибудь = **S** · 6-outcome Clarify funnel (new panel) = **L** · Weekly Review checklist = **M** · (P1) @-contexts second dimension = **M** · (P1) goal next-action + stuck flag + goal↔task link = **M** · (P2) horizons/inbox-zero/auto-detectors = **M**.

---

## CROSS-STREAM SYNTHESIS (feeds the Plan)

1. **One coordinated task-schema migration is the backbone.** Streams B and C both need to extend the task object: `date` (ISO) + `time` + `order` (calendar) and `status` + `waitingFor` + `contexts` (GTD). Adding these piecemeal = two migrations + two rounds of caller churn. Recommend **one `LifeDataProvider.migrate()` bump** early that adds all new fields with safe defaults, then features light up against a stable shape. Callers to inventory before that edit: `lib/calendar.js`, `TasksPage.jsx`, `TaskList.jsx`, `TaskDetailModal.jsx`, `QuickAddModal.jsx`, `App.addTaskFromUI`, `GoalsWidget.jsx`.
2. **Shared status vocabulary.** The calendar day-modal status control and the GTD filters must use the same enum (важно/рутина coexisting with next/waiting/someday). Design it once, in the Plan.
3. **Recommended batch order (matches master prompt):** LAYOUT/DENSITY → (schema migration) → CALENDAR → GTD P0 → P1 → P2. Density first because calendar/GTD build on the fixed visual base; the schema migration is a small dedicated batch between density and calendar.
4. **Two genuinely-new components only:** the calendar **cube** and the **Clarify panel** (Constraint #7). Everything else reuses capsules/chips/modal/green-check.
5. **QA multiplier:** every batch = dark × light × paradise-day × paradise-night × RU × UA. Preview cards under `preview/` are dark-only; after adding new-component specimens, run `/design-sync`.

---

## TOP OPEN QUESTIONS FOR YOU (blocking the Plan)
1. **`CLAUDE.md` mismatch** — confirm I should ignore the warehouse-ai `CLAUDE.md` and treat README/SKILL/ARCHITECTURE + this master prompt as governing. (Blocking — it changes which workflow rules bind me.)
2. **Task schema** — approve adding `date`/`time`/`order`/`status`/`waitingFor`/`contexts` in one early migration with defaults.
3. **`--readable` scope** — confirm exactly which blocks get capped (recommend: task list + tasks chips + finance tx list + 2-col data blocks; exclude home KPI grid + charts).
4. **"Dev-only UI"** — there is no dev toolbar; tell me which element (if any) counts as dev-only, or mark N/A.
5. **Clarify targets** — where "project" and "reference" outcomes land (goals / notes-archive).

**WAITING FOR:** review of this Discovery Report (and answers to the 5 blocking questions) before I write the Phase 2 Implementation Plan.
