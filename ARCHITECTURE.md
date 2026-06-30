# Life OS — Architecture Reference
_Last updated: end of Sprint 3.6 (CLOSED — June 11, 2026)_

## What this is
Personal life-management dashboard. Single user, dogfooded. Combines tasks, finances, goals, habits, calendar, notifications, medications, dog care, profile. RU primary, UA secondary.

## Stack
- React (no JSX build — Babel standalone in browser)
- CSS custom properties under `[data-theme]` on `<html>`
- Hash routing (`#/home`, `#/notes`, etc)
- localStorage for theme + sidebar collapse state
- i18n via React context + `makeT(locale)` + Slavic 3-form plural
- Charts: hand-rolled SVG via CSS custom properties. No Recharts.

## File map

```
/
├── README.md                       — design system overview, brand spec, content rules
├── SKILL.md                        — cross-compatible Agent Skill manifest
├── ARCHITECTURE.md                 — this file
├── colors_and_type.css             — root tokens (color, type, radii, spacing, motion)
├── assets/                         — logo, logomark, favicon (SVG)
│   └── scene/                      — Sprint 3.6 · island-day.jpg + island-night.jpg (AI-generated, user-owned)
├── preview/                        — per-card design-system specimens (one HTML per token/component)
│   └── _archive/                   — deprecated specimens (type-mono.html · old JetBrains-Mono chrome, Sprint 3.5)
├── screenshots/                    — verifier output, sprint snapshots
└── ui_kits/life-os/                — high-fidelity working app
    ├── index.html                  — entrypoint; loads React + Babel + all jsx/js
    ├── styles.css                  — full app stylesheet (single file, ~3300 lines)
    ├── App.jsx                     — root component, route dispatch, providers
    ├── LifeDataProvider.jsx        — Sprint 3A · central reducer + persisted state tree
    ├── i18n.jsx                    — LocaleContext + makeT + pluralization
    ├── icons.jsx                   — Lucide icon registry (inline SVG components)
    ├── categories.jsx              — 16 expense + 6 income category defs
    ├── lib/
    │   ├── storage.js              — Sprint 3A · load/save 'lifeOsState' to localStorage
    │   ├── activity.js             — Sprint 3A · appendActivity central log helper
    │   ├── medMath.js              — Sprint 3A · pure timer/risk/PRN math helpers
    │   ├── finance.js              — Sprint 3B · isIncluded / sumIncluded / byCategory / allCategoriesHidden
    │   └── calendar.js             — Sprint 3B · per-day event aggregator (seed + tasks + dog feedings)
    ├── components/
    │   ├── ActivityTimeline.jsx    — Sprint 3A · reusable history-row renderer
    │   ├── MultiChangeWarningModal.jsx — Sprint 3A · mode-change pause warning
    │   ├── EyeToggle.jsx           — Sprint 3B · shared two-state included/excluded toggle
    │   └── ParadiseScene.jsx       — Sprint 3.6 · living island scene (mounts only under paradise theme)
    ├── Sidebar.jsx                 — collapsible nav (200 ↔ 60px, ⌘\)
    ├── TopBar.jsx                  — cmd-K input + quick-add button
    ├── MobileBottomNav.jsx         — bottom nav below 640px
    ├── Today.jsx                   — today hero + task list (legacy /today)
    ├── TaskList.jsx                — task row + inline add
    ├── TaskDetailModal.jsx         — task detail w/ subtasks + activity
    ├── QuickAddModal.jsx           — cmd-K modal (task/expense)
    ├── MoneyWidget.jsx             — expense logger + budget bar
    ├── GoalsWidget.jsx             — goal list w/ progress
    ├── HabitsGrid.jsx              — 7-day grid + streaks
    ├── StreakMilestone.jsx         — orange-stakes 7/30/100-day banner
    ├── CalendarView.jsx            — week view
    ├── SettingsPage.jsx            — 8 sections, theme + locale + etc
    ├── Toast.jsx                   — system + telegram-bot variants
    ├── data/
    │   ├── profile.js              — window.LifeProfile (5-card seed)
    │   ├── dog.js                  — window.LifeDog (Maltipoo F1 seed)
    │   ├── medications.js          — window.LifeMeds (11 meds + 4 interactions)
    │   ├── dashboard-seed.js       — window.LifeDashSeed (Sprint 2 stats)
    │   └── calendar-seed.js        — Sprint 3B · window.LifeCalendarSeed (anchored event pool)
    ├── pages/
    │   ├── HomePage.jsx            — /home stats dashboard (Sprint 3B: derives totals from state.transactions)
    │   ├── FinancesPage.jsx        — Sprint 3B · /finances full surface (summary + logger + filter chips + tx list w/ eye toggle)
    │   ├── QuickNotesPage.jsx      — /notes
    │   ├── TasksPage.jsx           — /tasks w/ filters + sort
    │   ├── ProfilePage.jsx         — /me (5 cards)
    │   ├── DogPage.jsx             — /dog (passport, feeding, vet, inventory)
    │   ├── HealthPage.jsx          — /health (skeleton)
    │   ├── MedicationsPage.jsx     — /medications shell (Sprint 3A: 3-view tab strip + filter chips)
    │   ├── RelocatedPages.jsx      — /habits, /goals, /finances wrappers
    │   ├── PlaceholderPage.jsx     — Sprint-4 stubs (monthly/annual/investments)
    │   ├── medications/            — Sprint 3A
    │   │   ├── MedCard.jsx         — card with 3 live timers + actions + inventory chip
    │   │   ├── TakeDoseModal.jsx   — dose log entry w/ late-early + PRN warning
    │   │   ├── RefillModal.jsx     — inventory refill prompt
    │   │   ├── MedConfigDrawer.jsx — 5-section right-slide config panel
    │   │   ├── MedDetailPage.jsx   — /medications/{id} · 4 tabs
    │   │   ├── PharmNotes.jsx      — per-med pharmacist notes journal
    │   │   └── GlobalJournal.jsx   — cross-med notes feed (/medications · ЖУРНАЛ)
    │   ├── calendar/                — Sprint 3B
    │   │   └── DayDetailModal.jsx  — full-day event list, opens on "+N ещё" overflow click
    │   └── home/
    │       ├── StatCard.jsx        — hero stat tile (Batch 1)
    │       ├── ChartCard.jsx       — shared chart wrapper (Batch 2)
    │       ├── TrendChart.jsx      — 6-month line, expenses/income/net toggle (Batch 2)
    │       └── CategoryChart.jsx   — width-percent bars + orange-stakes pick (Batch 2)
    │       (UpcomingWeek.jsx + BotRecent.jsx deleted in Sprint 3.5 — /home cleanup)
    └── profile/
        ├── EditableField.jsx       — inline edit primitive
        └── cards/                  — Identity, BodyMetrics, Measurements, ClothingSizes, FoodPreferences
```

## Locked principles (do not re-litigate)
- Stakes = orange = event property, never category property
- Today indicator = blue (wayfinding, not stakes)
- Typography: Onest 700–900 display / Work Sans 400–600 body. **JetBrains Mono removed (Sprint 3.5)** — all numerics, timestamps, dosages, IDs use Work Sans 500 + `font-variant-numeric: tabular-nums`. One UI font family (+ Onest for display headlines & hero numbers).
- Chrome casing: **sentence case everywhere (Sprint 3.5)**. Uppercase reserved for the `Life·OS` wordmark only; international codes/IDs (USD, TX-…) may stay caps.
- Card surface: **semi-transparent + `backdrop-filter: blur(10–12px)` + soft orange tint border over a gradient canvas (variant А, Sprint 3.5)**. Routine = 1px low-alpha tint; stakes = 1.5px saturated border + glow. Stakes stays an event property, never a category one.
- Sidebar: **200px expanded ↔ 60px collapsed (Sprint 3.5)**. Group structure = thin dividers, no text section headers. Light sidebar is pure white.
- Themes: dark default, light first-class, system follows OS. **Third theme `paradise` (Sprint 3.6)**: explicit choice only (system never resolves to it), `data-theme="paradise"` + `data-scene="day"|"night"` from the Europe/Kiev clock. Dark and light token sets are the user's rollback — never refactor or "unify" them when touching paradise.
- RU primary, UA secondary, EN reserved (not rendered)
- Charts: blue family + neutral. One orange accent per chart max, only on stakes-triggered data points.
- Density tokens (Sprint 2 Batch 0.5): `--text-*` / `--pad-*` / `--btn-h-*` / `--input-h` / `--row-h` / `--icon-*` in `:root`.
- Persistence (Sprint 3A): single localStorage key `'lifeOsState'`; all writes go through `lib/storage.js` throttled `saveState`; every mutation appends to `state.activityLog`. Never bypass the LifeDataProvider dispatchers.
- Life OS is not clinical decision-support. Medication interactions, role chips, and warnings are informational — never alerts.

## Density exceptions (Sprint 2 Batch 0.5 judgment calls)
- Hero numbers (40px / 56px on `/today` and `/home` hero areas) — left untouched. Dominant elements on their pages.
- Checkbox visual 16px + `::before { inset: -5px }` hit area = 26px to clear 24px accessibility floor.
- Sidebar collapsed icons stay 18px (`--icon-lg`). Expanded = 14px.
- Money input dropped to `--text-md` + weight 600 (not the default 500) — preserves "money is centerpiece" without re-introducing height.
- `set-btn-danger` is the only `--btn-h-lg` button. All others `--btn-h-md` (30px).

## Surfaces (tabs in sidebar nav)

**MAIN**
- `/home` — stats dashboard (Batches 1–3 complete: hero stats, trend + category charts, upcoming, bot)
- **`/calendar`** — Sprint 3B: week view redesigned to pill-density layout. 7 day columns Mon-first, each holding up to N=8 thin horizontal pills (18px tall, 3px colored left bar + HH:MM mono time + truncated title). 9th+ event collapses into "+N ещё" overflow row opening DayDetailModal. Pill colors per stakes discipline: orange=stakes, blue=routine, neutral=info. Today column gets locked --blue tint (NOT orange). Events aggregated by `lib/calendar.js` from seed pool + state.tasks (with parseable `due`) + state.dog.feeding.meals. Density slider in Settings → оформление deferred to Sprint 4.
- `/notes` — quick capture (full)

**LIFE**
- `/me` — profile, 5 cards, EU/US/UA size conversion (full)
- `/tasks` — dedicated task view with filters (full)
- `/habits` — relocated from home (full)
- `/goals` — relocated from home (full)
- `/health` — skeleton (Sprint 3 populates)
- `/dog` — passport + feeding + vet + inventory (skeleton, Maltipoo F1 seed)

**MONEY**
- `/finances` — relocated from home (full)
- `/monthly` — placeholder (Sprint 4)
- `/annual` — placeholder (Sprint 4)
- `/investments` — placeholder (Sprint 4)

**ЛЕКАРСТВА**
- `/medications` — Sprint 3A interactive tracker: 3-view tab strip (СПИСОК / ЖУРНАЛ / ИСТОРИЯ), per-med card with 3 live timers (next dose / t½ / full elimination), inventory risk tiers (yellow/orange/red), TakeDoseModal with late-early + PRN anti-stacking, MedConfigDrawer with 5 sections (basic / interval / strategy / inventory / delete), 4 mode styles (steady / up / down / prn), MultiChangeWarningModal on parallel changes, per-med detail page at `/medications/{id}` with 4 tabs, pharm-notes journals (per-med + global)
- All state persists via `lib/storage.js` (localStorage 'lifeOsState'). All mutations append to `state.activityLog` consumed by ActivityTimeline component.

**bottom**
- `/settings` — 8 sections (full)

## Sprint log
- **v1.0** — design system foundation, themes, i18n, all components
- **v1.1** — theme toggle disambiguation + Life·OS wordmark
- **v2.0 Sprint 1** — collapsible sidebar, new nav tree, new surfaces skeleton, medications seed
- **v2.0 Sprint 2 Batch 0** — section header МЕДИЦИНА→ЛЕКАРСТВА, dog inventory empty state
- **v2.0 Sprint 2 Batch 1** — dashboard seed + 4 hero stat cards + StatCard component
- **v2.0 Sprint 2 Batch 0.5** — density pass (tokens in `:root`, all control heights compacted, hero numbers preserved)
- **v2.0 Sprint 2 Batch 2** — CLOSED 2026-05-22 · trend chart (native SVG, 3-series toggle) + category bars (width-percent, single orange-stakes pick)
- **v2.0 Sprint 2 Batch 3** — CLOSED 2026-05-22 · upcoming-this-week aggregated card + telegram bot recent footer
- **v2.0 Sprint 2 Batch 4** — CLOSED 2026-05-22 · design system specimen cards (home-dashboard, stat-card, chart-trend, chart-categories, upcoming-week, density-tokens) + verifier pass
- **v2.0 Sprint 2** — CLOSED 2026-05-22 (all batches shipped)
- **v2.0 Sprint 3A Batch 1** — CLOSED 2026-05-23 · localStorage persistence + central LifeDataProvider state tree + global activityLog + ActivityTimeline component (refactored TaskDetailModal to consume it) + Settings export/clear-history actions
- **v2.0 Sprint 3A Batch 2** — CLOSED 2026-05-23 · MedCard + 3 live timers + TakeDoseModal (with late-early + PRN anti-stacking) + RefillModal + inventory risk tiers + view-tabs + filter chips
- **v2.0 Sprint 3A Batch 3** — CLOSED 2026-05-23 · MedConfigDrawer (5 sections) + 4 mode styles + titration preview + MultiChangeWarningModal
- **v2.0 Sprint 3A Batch 4** — CLOSED 2026-05-23 · MedDetailPage (4 tabs at /medications/{id}) + PharmNotes (per-med journal) + GlobalJournal (cross-med feed) + dose history
- **v2.0 Sprint 3A Batch 5** — CLOSED 2026-05-23 · design system specimens (med-card, take-dose-modal, med-config-drawer, multi-change-warning, pharm-notes, activity-timeline) + ARCHITECTURE.md update
- **v2.0 Sprint 3A** — CLOSED 2026-05-23 (medications interactive + history timeline persisted)
- **v2.0 Sprint 3B Batch 1** — CLOSED 2026-05-23 · flexible finance: per-tx + per-category eye toggles, EyeToggle shared component, lib/finance.js totals helpers, FinancesPage (own surface, replaces MoneyWidget wrapper), HomePage derives spent + category breakdown + current-month trend from state, SettingsPage categories grid grows third column, all toggles emit activityLog entries
- **v2.0 Sprint 3B Batch 2** — CLOSED 2026-05-23 · calendar redesign: week view replaced with day-cell pill density (N=8 pills/day, +N overflow), DayDetailModal at pages/calendar/, lib/calendar.js aggregator, data/calendar-seed.js, today=blue locked principle reaffirmed
- **v2.0 Sprint 3B Batch 3** — CLOSED 2026-05-23 · design system specimens (finance-eye-toggle, calendar-pills, day-detail-modal) + ARCHITECTURE.md update + verifier pass
- **v2.0 Sprint 3B** — CLOSED 2026-05-23 (flexible finance + calendar pill redesign)
- **v2.0 Sprint 3.5** — CLOSED 2026-06-02 · visual refinement pass: typography consolidation (JetBrains Mono removed → Work Sans tabular-nums), uppercase removal (wordmark excepted), card system rebuild (semi-transparent + backdrop-blur + soft orange tint, variant А), sidebar refresh (200px, dividers, pure-white light sidebar), /home cleanup (UpcomingWeek + BotRecent deleted), theme-toggle repaint fix, design-system specimen sweep + 2 new specimens (visual-refinement, card-system-v2)
- **v2.0 Sprint 3.6** — CLOSED 2026-06-11 · paradise theme: living island scene (ported from approved living-island-v3.html), day/night by Kyiv time, paradise token sets day+night mapped onto existing token names, 4th theme option in Settings («остров»/«острів» + palm glyph), anti-flash extended, specimen paradise-theme.html
- **v2.0 Sprint 3.6 Batch 2.5** — CLOSED 2026-06-11 · paradise capsule buttons (follow-up): tactile capsule style ported from approved paradise-buttons-v4.html, paradise-scoped only — cream plate + gradient body + hover gloss + spring press with damped wobble. Stakes-aware: cream routine default, orange reserved for stakes/confirm. Dark/light buttons untouched.
- **v2.0 Sprint 4** — PENDING · investments + monthly/annual expense tabs + density slider wiring + paper-cut polish backlog (incl. TakeDoseModal footer fix, radius-token rollout) + optional financial widget on /home (planned spending next 7 days)

## Decisions log
- **Charts library decision**: hand-rolled SVG, no Recharts. Rationale: only one chart per sprint, tighter stakes color control, lighter bundle, fewer dependencies. _Re-confirmed in Sprint 2 Batch 2 — the spec floated trying Recharts via CDN first, but the locked principle won. TrendChart is native SVG with React-state-driven tooltips; CategoryChart is plain divs + CSS bars (not a chart-library task by design)._
- **Sprint 2 Batch 2 trend-chart color discipline**: expenses → `--blue`, income → `--blue-3` (blue-deep), net → `--fg3` (muted, lower-opacity area). No green for income, no red for negative net. Net stays inside the blues-+-neutral family.
- **Sprint 2 Batch 2 single orange-stakes rule** (CategoryChart): from seed, `subscriptions 140/150 = 93%` triggers the lone orange row. The chart computes utilization for every visible top-6 row and picks the highest qualifier ≥ 80%; ties broken by higher utilization. Maximum one orange per chart, always.
- **Sprint 2 Batch 3 upcoming aggregation**: for Sprint 2 we render `seed.upcomingItems` pre-aggregated (overdue first, then seed order). The cross-surface aggregation rules in the spec — overdue tasks → bills → appointments → stakes-today → goals ≥ 90% — land in Sprint 3 when the real surfaces feed a unified upcoming source.
- **Sprint 2 Batch 3 bot click is a no-op** — TODO Sprint 4 once a bot conversation surface exists. Rows carry `data-todo="sprint-4-bot-conversation"` for future grep.
- **Upcoming widget click on a task opens TaskDetailModal with a synthetic task object built from seed.** Sprint 3 will reconcile when real tasks acquire due-date metadata.
- **Hero responsive breakpoints set at 720px (2x2) and 420px (1-col).** 420 floor protects readability on narrow phones.
- **`data/medications.js`** ships as `window.LifeMeds = [...]` (not ES exports) due to Babel-standalone limitation. Sprint 3 will refactor when adding interactivity.
- **URL-hash routing** chosen over real router for design-system fidelity in iframe contexts.
- **Sprint 3A persistence**: localStorage `'lifeOsState'` single key, no eviction. Throttled writes (500 ms trailing edge) via `lib/storage.js`. Backend migration deferred to Sprint 5+ or v3.0.
- **Sprint 3A activityLog**: single global array of `{ id, timestamp, entity_type, entity_id, action, details }`. Capped at 5000 entries (FIFO). Task/transaction modals consume it via the shared `<ActivityTimeline entityType= entityId= />` component; the deprecated per-entity `_activity` arrays from Sprint 2 are gone.
- **Sprint 3A CYP2D6 interactions**: data preserved in `data/medications.js` (`window.LifeMedInteractions`), NOT rendered in the new interactive UI. Life OS is a work-life-balance tool, not clinical decision support. The interactions table from Sprint 1 is removed; the data stays accessible to future features (a med-detail «interactions» sub-tab if user requests it).
- **Sprint 3A 3 timers per med card**: next dose (interval-based, ticks every 30s), t½ half-life decay (computed once per minute), full elimination (5×t½, static). All recompute on dose log. Uses `half_life_active_metabolite_h` when present (DDCAR case for cariprazine).
- **Sprint 3A mode styles**: stored separately in `state.modeStyles[medId]`, NOT on the med object. Four types: `steady` (default), `up` (up-titration), `down` (down-titration / discontinuation), `prn` (anti-stacking, no schedule). MultiChangeWarningModal fires when changing mode style on a medication while ≥1 OTHER active medication has had a `mode_changed` activity entry in the past 7 days; soft (does not block).
- **Sprint 3A auto-shift scheduling**: actual dose-taken timestamp becomes the new anchor for next-dose computation. «Obычно принимаешь в HH:MM» line shows mean time-of-day across last 14 doses only when standard deviation < 90 minutes — hides when the pattern is unstable.
- **Sprint 3A inventory risk tiers**: ≤7 days → yellow `купить скоро`, ≤3 days → orange `купить срочно`, ≤1 day → red `заканчивается`, 0 → red `закончился` + take button disabled. `low_stock_threshold_days` (default 7) is per-med overridable in the config drawer.
- **Sprint 3A soft delete**: removing a medication via the drawer flips its `status` to `'archived'`. Dose logs and activity history are retained. Archived meds are excluded from all filter views including `all`.
- **Sprint 3A mode-style state location** (judgment call): mode style lives in `state.modeStyles[medId]`, separate from the med object. Mode has its own lifecycle (`startedAt`, `currentStage`, progress timing) that can outlive med-level changes like `strength_mg` adjustment.
- **Sprint 3A radii** (judgment call): literal pixel radii used throughout (4 / 8 / 12 / 14 / 16 / 20). Radius tokens (`--r-xs` through `--r-pill`) live in `colors_and_type.css` but the working stylesheet uses literals to match the surrounding Sprint 1/2 code. Token rollout deferred to Sprint 4 polish.
- **Sprint 3A dose-log seed location** (judgment call): seed dose values are inline in `buildInitialState()` in `LifeDataProvider.jsx`, not extracted to a `data/seed.js` file. The spec referenced `data/seed.js` informally; keeping the seeding logic co-located with the provider for now. Will extract when backend migration happens (v3.0+) and seed data needs to live outside the client.
- **Sprint 3A TakeDoseModal footer cramping** (known issue): the `qa-foot-hints` row (⌘ ↵ ZAPISAT DOZU · ESC OTMENA) cramps at the modal's 440px width when the longer RU label renders. Deferred to Sprint 4 polish — either drop the hint row on this modal or shorten the label.
- **Sprint 3B flexible-finance gate semantics**: a transaction counts toward totals only when BOTH `tx.included_in_totals !== false` AND `categoryOverrides[tx.category_id]?.included_in_totals !== false`. Hidden items remain visible in the /finances list (grayed, line-through amount, eye-off glyph) but vanish from monthly spend, trend chart, category bars, budget utilization %. Excluded categories vanish from the /home category breakdown entirely (not zero-bar). Toggle a category off and ALL its transactions visually exclude regardless of per-tx flag; toggling them individually still flips the per-tx flag in state for when the category is re-included. Both gates persist; both append `{entity_type: 'transaction'|'category', action: 'included'|'excluded'}` to `state.activityLog`.
- **Sprint 3B historical trend recompute scope** (judgment call): only the CURRENT month's data point in the /home trend chart recomputes from `state.transactions` filtered by eye-toggles. Prior 5 months stay on `seed.last6Months` because per-tx history doesn't exist for past months yet. When backend lands (v3.0+) and historical transactions become real, the recompute extends to the full window.
- **Sprint 3B v1→v2 migration**: snapshots without `state.transactions` (Sprint 3A had an empty array because no logger surface existed yet) get reseeded by the v2 migration in `LifeDataProvider.migrate()` so the demo has content on first paint after upgrade. `state.categoryOverrides: {}` added unconditionally. Pre-existing transactions are preserved.
- **Sprint 3B calendar pill density locked** at N=8 pills/cell, 18px pill height. Density slider in Settings → оформление stays visible but tooltipped "Sprint 4" — wiring it requires settling on min/max bounds (4–12 likely) and adjusting the cell min-height calc, which is paper-cut polish work.
- **Sprint 3B calendar event sources** (Sprint 3B subset): seed pool (LifeCalendarSeed) + state.tasks (only when `due` parses as eod/HH:MM/weekday-code AND the displayed week IS the current calendar week) + state.dog.feeding.meals (daily across all 7 days, only when meal.time is actually set). Medication doses, bills from transactions, and health appointments deferred to Sprint 4 — they need real "next-occurrence" math that the current surfaces don't yet expose.
- **Sprint 3B grid min-content trap reaffirmed**: any grid using `1fr` for content tracks (vs fixed-px tracks) must wrap in `minmax(0, 1fr)` to override the implicit `min-content` track minimum, or one long unbroken word in a cell will push siblings off the right edge. Caught twice this sprint: `.fin-tx` (chip column collision), `.cal-pill-grid` (Sunday clipping). Pattern: `repeat(N, minmax(0, 1fr))`. Pre-existing 1fr grids from Sprint 1–2 left alone (no observed regressions); new grids must use the safe form.

- **Sprint 3.5 typography**: JetBrains Mono removed entirely. Numerics, timestamps, dosages, IDs all use Work Sans with `font-variant-numeric: tabular-nums`. One font family across the whole UI (plus Onest for display headlines). `--font-mono` retained as an alias pointing at Work Sans so the ~30 `var(--font-mono)` call-sites didn't all need touching.
- **Sprint 3.5 uppercase**: uppercase eyebrows removed across the app. Only exception: the wordmark `Life·OS`. Everywhere else uses sentence-case Work Sans in muted color for chrome labels. All positive `letter-spacing` tracking (the 0.14–0.22em that only suited JetBrains-Mono caps) was stripped; negative display tracking preserved. International codes/IDs (USD, EUR, UAH, TX-…, med ids) and the `БАД` supplement acronym kept as-is.
- **Sprint 3.5 card visual**: semi-transparent surface (rgba off-white on light, rgba dark on dark) + `backdrop-filter: blur(10–12px)` + a subtle vertical background gradient on the main canvas (and per-stage gradients in specimens) so the blur has something to sample.
- **Sprint 3.5 light accent**: soft orange tint border on routine cards (rgba(219,90,12,0.18)). Stakes events use a stronger border (1.5px solid rgba(219,90,12,0.65)) plus soft glow shadow. This is variant А — an intensity gradient. Stakes discipline preserved: routine = ambient warmth, stakes = signal.
- **Sprint 3.5 sidebar headers**: group text headers removed. Only thin dividers between groups (0.5px, var(--border-soft)). Section structure conveyed by spacing + divider line, not by text labels.
- **Sprint 3.5 sidebar width**: 200px expanded (was 240 in code / 220 by convention). Count badge flows after the label with a fixed 12px gap and flex-shrink:0 instead of margin-left:auto.
- **Sprint 3.5 /home cleanup**: Upcoming and Bot widgets deleted (no longer rendered, components + preview specimen + i18n keys + seed fields physically removed). Home stays short on purpose. Future financial widgets (next-7-days planned spending) land in Sprint 4 alongside recurring-expense surfaces.
- **Sprint 3.5 `--surface` scoping** (judgment call): the spec redefined the global `--surface` token to the glass value, which this codebase also uses for controls (inputs/chips/toggles). Kept that redefinition (controls pick up the glass color) but scoped `backdrop-filter` to card surfaces only — controls get the color without blur. Universal card selector lists the real class names (.panel/.stat-card/.chart-card/.pc-card/.medc/.mdp-*/.meds-item/.ph-card), not the spec's assumed .med-card/.task-row/.tx-row.
- **Sprint 3.5 theme-toggle repaint fix** (judgment call, not in spec): translucent surfaces fed by `var(--surface)` with a `background-color` transition got "stuck" at the old value on a live theme switch (Chromium custom-property-transition repaint bug). App.jsx now adds an `html.theme-switching` class around the `data-theme` swap that disables transitions (`* { transition: none }`) for one frame, so the new tokens apply instantly. Fresh loads were always fine; this only affected runtime toggles.
- **Sprint 3.5 font weights** (judgment call): index.html loads the full Onest 400–900 + Work Sans 400–700 ranges (the prior set minus JetBrains), not the narrower subset the spec sketched, to avoid faux-weight on the Onest 500 used by qa-title-input.
- **Sprint 3.5 sidebar count alignment** (judgment call): the spec prose said "count close to the label" but its literal CSS keeps `.sb-label { flex: 1 }` which right-aligns the count. Followed the CSS — counts sit at the right edge with a consistent 12px min-gap (reads cleaner than counts floating mid-row).
- **Sprint 3.5 specimen chrome retention** (judgment call): component-anatomy specimens (card-anatomy, med-card, calendar-pills, etc.) keep their original card chrome — they demonstrate structure, not the surface system, so re-skinning them as glass would muddy what each is teaching. The new glass surface is showcased in the two purpose-built specimens (card-system-v2, visual-refinement) + the live home-dashboard iframe. The `БАД` supplement acronym is also kept uppercase (it's an established term/abbreviation, read as chrome would over-correct it).
- **Sprint 3.5 specimen sweep**: type/uppercase/tracking + font-URL JetBrains removed across all 56 `/preview/*.html` + `_base.css`. `type-mono.html` (the old technical-chrome demonstrator) moved to `/preview/_archive/` with a DEPRECATED banner and its JetBrains styling restored for historical reference. New specimens `card-system-v2.html` + `visual-refinement.html` added.

- **Sprint 3.6 third theme 'paradise'**: `data-theme="paradise"` + `data-scene="day"|"night"` resolved from the Europe/Kiev clock (day 06:00–19:59), re-checked every 60s by useTheme; anti-flash head script sets BOTH attributes pre-paint. Scene component (`components/ParadiseScene.jsx`) mounts only under this theme — dark/light untouched as the user's fallback, zero scene DOM/image loads otherwise. Assets: `/assets/scene/island-day.jpg` + `island-night.jpg` (AI-generated, user-owned). System mode stays dark/light only; paradise is an explicit choice. No manual day/night override in 3.6 (auto only).
- **Sprint 3.6 scene performance patterns (mandatory)**: opaque day floor under the night crossfade; single SVG-displacement sea layer with JS fade-swap (fade 0 → swap image → fade 1, 720ms); static native-pixel patch over the small island (ellipse 18% 22% at 77% 12%). Naive two-layer crossfade of filtered layers causes dark tile-band flicker — never reintroduce. Scene swap logic reacts to `data-scene` via MutationObserver; useTheme owns the clock, the component never computes time.
- **Sprint 3.6 scene degradation**: prefers-reduced-motion → fully static (no breathe/sea/glints/clouds, day/night crossfade only); <768px → sea, glint and patch layers not rendered at all (CPU + patch misalignment on tall aspect ratios).
- **Sprint 3.6 NO backdrop-filter under paradise** (hard-won, deviation from reference): Chromium's compositor drops entire backdrop-filter subtrees when blurred elements sit over the six-layer animated scene (SVG displacement + transform animations) — cards, the search field and whole modals render INVISIBLE, and entrance keyframe animations freeze at frame 0 (modal stuck at opacity 0). The reference prototype survived with blur only because it had four cards and no blurred sidebar/modals. Under paradise every backdrop-filter is overridden to none; the glass read is carried by surface translucency (reference values: cards rgba(255,251,246,.86) day / rgba(20,28,40,.72) night; sidebar .84/.78). Entrance animations (qa-fade/qa-rise/toast-in/milestone-in/mcd-slide-in/sb tooltip) are `animation: none` under paradise — overlays appear instantly. Do not re-add blur without testing every overlay in both scenes.
- **Sprint 3.6 paradise token sets** (judgment calls): day block is a full light-derived token set (all token names re-mapped); night block is deltas over the dark base — everything not listed intentionally inherits dark. Day uses the light orange family (#DB5A0C mid) for stakes; night keeps the dark orange family — stakes borders/glow use the spec values (rgba(219,90,12,.5–.65) + 0 0 0 1px .16 / 0 8px 24px .14) in both scenes. Night elevations get a blue cast (#141C28/#1A2433) instead of neutral dark so modals sit on-scene. Modal backdrop solid rgba(8,10,14,0.72), no blur.
- **Sprint 3.6 over-scene chrome**: text directly on the scene (tb-title, page-title, set-h, cal-title, page-sub, tb-eyebrow) = white + text-shadow 0 2px 8px rgba(0,0,0,.4) in both scenes (reference brand/greet treatment). Transparent-background toolbar controls (meds view tabs, meds filter chips, tasks chips, sort trigger, calendar nav) get the reference HUD pill: rgba(0,0,0,0.32) fill + white text; active state flips to var(--surface) + var(--primary). Settings .set-nav/.set-body get the card surface so rows never float naked on the scene.
- **Sprint 3.6 card scene-change behavior** (revised after verifier): the reference's .8s card cross-dissolve is NOT ported. Transitions on var()-fed properties freeze mid-flight on token swaps (same Chromium repaint bug as Sprint 3.5's html.theme-switching guard) — cards/sidebar stayed wearing the previous theme's colors indefinitely. Cards snap on scene change instead; the scene's own 1.4s crossfade carries the perceived smoothness. useTheme wraps every data-scene write in an `html.scene-switching` class whose transition-kill is scoped to `.app` only (the scene layers sit outside `.app`, so their 1.4s crossfade still runs).
- **Sprint 3.6 Batch 2.5 paradise capsule buttons**: Paradise theme adds a tactile capsule button (cream plate + inner gradient body, layered shadows, hover gloss, spring press with damped wobble). Stakes-aware: cream for routine actions, orange reserved for stakes/confirm — orange-as-signal preserved. Sized to match existing button height for layout parity (default keeps each button's `--btn-h-md` 30px: 3px plate ring + 24px body; the lone `--btn-h-lg` button `.money-log` gets CTA proportions 4px + 28px). Paradise-scoped; dark/light buttons unchanged. prefers-reduced-motion disables the press/wobble (press = subtle brightness dip; gradient/plate/shadows/hover kept).
- **Sprint 3.6 Batch 2.5 capsule implementation** (judgment call): the reference's two-element anatomy (plate wrapping a body span) is realized WITHOUT markup changes — the button element is the cream plate; the gradient body is `::before` and the hover gloss `::after`, both at negative z-index under `isolation: isolate` (paint above the plate background, below the label). DOM stays byte-identical across themes; dark/light flat styles never see the pseudos (no `content` outside paradise scope). Click physics wired generically: one delegated pointer-listener effect in App.jsx (`pointerdown` → `.pressing`, `pointerup/leave/cancel` → `.releasing`, class dropped on `animationend`), covering capsules inside lazily-mounted modals/drawers. The `.pressing` transform carries `!important` — pressing implies hovering, and legacy `:hover` transforms (`.qa-btn-save.is-stakes:hover` translateY at higher specificity) would otherwise override the press scale.
- **Sprint 3.6 Batch 2.5 capsule scope + color roles** (judgment calls): capsule applies to filled action buttons only — `.qa-btn-save`, `.set-btn-primary`, `.money-log`, `.medc-action-take`. Orange capsules: `.qa-btn-save.is-stakes` (existing stakes signal), `.medc-action-take` («принял» = dose confirm), and new `.btn--stakes` marker on TakeDoseModal save («записать дозу») and MultiChangeWarning proceed (confirming a flagged risky parallel change). `.btn--stakes` has zero dark/light rules, so adding the class changes nothing outside paradise. Ghost/cancel buttons stay flat — the spec's role list mentions «Отмена» → cream, but turning footer cancels into capsules would make save and cancel visually identical cream pills (both routine); secondary hierarchy wins. Danger buttons stay flat red (destructive ≠ stakes; orange must not absorb red's meaning). `.money-log` is cream under paradise despite being orange-accent in dark/light — logging an expense is a routine action and orange stays reserved. Milestone dismiss («скрыть») stays flat chrome. Green capsule variant `.btn--positive` defined with reference values but unused.
