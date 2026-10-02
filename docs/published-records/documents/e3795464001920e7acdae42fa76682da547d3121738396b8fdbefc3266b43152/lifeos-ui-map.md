# Life OS — UI Architecture Map

**Purpose:** the shared vocabulary. Every screen, block, control, and token named once, mapped to its CSS class / component / `file:line`. Change-requests reference elements by the human names here; CC resolves them to the exact class/file without guessing.

**Status:** reference (read-only inventory). **Basis:** branch `design-sync-setup` incl. uncommitted Batch-1 revision. All paths under `ui_kits/life-os/`.

---

## NAMING CONVENTION — how to reference anything

> **`<Screen> › <Block> › <Element>` (`.class`)**

Examples:
- **Tasks › filter row › capsules** (`.tasks-chip`)
- **Home › KPI hero › budget card** (`.stat-card`)
- **TopBar › search field** (`.tb-cmd-input`)
- **Finances › transaction list › row eye toggle** (`EyeToggle`)

Human names use the RU label the user sees. The class in parentheses is the machine handle. When two things share a class, the map says so and proposes a distinguishing name.

---

## ROUTER — the 15 routes

Hash router in `App.jsx:20-34` (`LIFE_ROUTES`), dispatched in `renderRoute()` `App.jsx:306-372`.

| RU name | route | top component |
|---|---|---|
| главная | `#/home` | `pages/HomePage.jsx:20` |
| задачи | `#/tasks` | `pages/TasksPage.jsx:7` |
| календарь | `#/calendar` | `CalendarView.jsx:16` |
| заметки | `#/notes` | `pages/QuickNotesPage.jsx:9` |
| я | `#/me` | `pages/ProfilePage.jsx:9` |
| привычки | `#/habits` | `pages/RelocatedPages.jsx:8` → `HabitsGrid.jsx:10` |
| цели | `#/goals` | `pages/RelocatedPages.jsx:22` → `GoalsWidget.jsx:4` |
| здоровье | `#/health` | `pages/HealthPage.jsx:7` |
| собака | `#/dog` | `pages/DogPage.jsx:12` |
| финансы | `#/finances` | `pages/FinancesPage.jsx:16` |
| ежемесячные | `#/monthly` | `pages/PlaceholderPage.jsx:4` |
| годовые | `#/annual` | `pages/PlaceholderPage.jsx:4` |
| инвестиции | `#/investments` | `pages/PlaceholderPage.jsx:4` |
| препараты | `#/medications` (+ `/medications/{id}`) | `pages/MedicationsPage.jsx:18` (detail `MedDetailPage.jsx:17`) |
| настройки | `#/settings` | `SettingsPage.jsx:4` |

**Width-cap legend:** each block is marked **CAPPED** (its own class or a wrapping class is in the Batch-1 `--readable` set) or **FULL** (no cap → stretches full width now that `.main`'s 1200px cap was removed). The capped set is exactly: `.tasks-toolbar · .tasks-list-card · .fin-summary · .fin-toolbar · .fin-tx-card · .profile-cards · .dog-grid · .health-grid · .goals-card`.

---

## GLOBAL / SHARED (chrome + reused parts)

### TopBar — `TopBar.jsx:4-46`
Greeting + clock on the left, search + quick-add on the right. Sits over the scene under paradise.
- **eyebrow clock** — `.tb-eyebrow` — `HH:MM · weekday date` (mono) — `TopBar.jsx:25`
- **greeting title** — `.tb-title` — time-of-day greeting — `TopBar.jsx:26`
- **search field** — `.tb-cmd` (label wrapper) / `.tb-cmd-input` (input) / `.tb-cmd-icon` / `.tb-kbd` (⌘K badge) — `TopBar.jsx:29-39`; styles `styles.css:574-601`.
  - ⚠️ **DEAD CONTROL:** typing only sets local `search` state (`TopBar.jsx:7,35-36`) that nothing reads. It does NOT search or route. ⌘K (below) opens QuickAdd, not this field. → see **Findings §3** for the invisible-on-focus bug.
- **quick-add "+"** — `.tb-add` — calls `onQuickAdd` → opens QuickAddModal — `TopBar.jsx:40-42`
- **⌘K shortcut** — handler in `App.jsx:246` (`(metaKey||ctrlKey)&&key==='k'`) → opens QuickAddModal (NOT the search field).

### Sidebar — `Sidebar.jsx:1-127`; styles `styles.css:390-508`
Collapsible left nav (200px ↔ 60px, toggle ⌘\, persisted to `localStorage.lifeOsSidebar`). Groups: MAIN / LIFE / MONEY / MEDS + settings footer. Thin dividers, no text group headers.

| RU label | route | Lucide icon |
|---|---|---|
| главная | home | `home` |
| календарь | calendar | `calendar` |
| заметки | notes | `stickyNote` |
| я | me | `user` |
| задачи | tasks | `listChecks` |
| привычки | habits | `repeat` |
| цели | goals | `target` |
| здоровье | health | `heart` |
| собака | dog | `paw` |
| финансы | finances | `wallet` |
| ежемесячные | monthly | `calendarRange` |
| годовые | annual | `coins` |
| инвестиции | investments | `trendingUp` |
| препараты | medications | `pill` |
| настройки | settings | `command` |

- **nav item** — `.sb-item`; active = `.sb-item.is-active` (blue-tint bg `--primary-soft`, icon `--o2` + orange glow) — `styles.css:455-479`
- **logo** — `.sb-logo` (→ home); wordmark tspans `.logo-word` (`Sidebar.jsx:68-70`), glow dot `.sb-logo-dot`. Per-theme ink: dark = light `#F5F5F7`; light = dark `var(--text)` (`styles.css:2814`); **paradise-day = dark `#1a1f29`** (`styles.css:4388`); paradise-night = light (inherits). The `·` keeps its accent gradient in all themes.
- **collapse toggle** — ⌘\ handler `Sidebar.jsx:14-23`; collapsed state adds `.sb.is-collapsed`.

### Reused controls (restyle-one-hits-all)
- **filter capsule** — the single most-shared control. Base pill shape reused as:
  - `.tasks-chip` — Tasks filter row + **Finances** filter row (Finances reuses `.tasks-chip` inside `.fin-toolbar`) — `styles.css:1524`, `TasksPage.jsx:55`, `FinancesPage.jsx:162`
  - `.meds-filter-chip` — Medications status filter + GlobalJournal med filter — `styles.css:3107`, `MedicationsPage.jsx:100`
  - `.meds-view-tab` — Medications view tabs (список/журнал/история) — `styles.css:3095`
  - `.set-seg` / `.set-seg-btn` — Settings segmented controls (theme/lang/density/clear-history) — `SettingsPage.jsx:162-202`
  - `.chart-segctrl-btn` — Home chart series/period toggles — `TrendChart.jsx:84`, `CategoryChart.jsx:144`
- **tag / badge chip** — `.task-tag` (tasks, `styles.css:712`), `.fin-tx-cat-chip` (finances category, `styles.css` fin block), `.medc-supp`/`.medc-mode-badge` (meds).
- **green-check "done"** — `.task-check` / `.task-check.is-done` (green `--success` fill + `I.check`) — `styles.css:694-707`. Reused: `TaskList.jsx:31`, `TasksPage.jsx:85`, `TaskDetailModal.jsx` subtasks. **This is the affordance to reuse for the calendar day-modal (Batch 3).**
- **card surface** — `.panel` / `.card` (fill = `--surface` per theme) — `styles.css:660`; specialized: `.stat-card` (home KPI), `.chart-card` (home charts), `.pc-card` (profile/dog/health), `.medc`/`.meds-item` (meds), `.milestone` (streak).
- **StatCard** — `pages/home/StatCard.jsx:16-34` (eyebrow/value/context, clickable → route).
- **ChartCard** — `pages/home/ChartCard.jsx` (wrapper: eyebrow + total + body) used by TrendChart + CategoryChart.
- **EyeToggle** — `components/EyeToggle.jsx` — include/exclude eye; Finances per-tx + per-category, Settings per-category.
- **accordion / expander** — `.qa-expander` (`.qa-expand-head` + body) — QuickAddModal schedule/notes sections — `styles.css:1188`.

### Modals & overlays (z-index)
| Modal | class | z-index | file | nested? |
|---|---|---|---|---|
| QuickAddModal | `.qa-backdrop`/`.qa-modal` | 60; category popover `.qa-cat-pop` **70** | `QuickAddModal.jsx`; `styles.css:1071,1167` | popover floats at 70 |
| TaskDetailModal | `.qa-modal` chrome | 60; task menu **80** | `TaskDetailModal.jsx`; `styles.css:1303` | menu pops at 80 |
| DayDetailModal | `.qa-modal.modal-day` (560px) | 60 | `pages/calendar/DayDetailModal.jsx` | no |
| TakeDoseModal | `.qa-modal.tdm-modal` (440px) | 60 | `pages/medications/TakeDoseModal.jsx` | no |
| RefillModal | `.qa-modal.tdm-refill` (360px) | 60 | `pages/medications/RefillModal.jsx` | no |
| MedConfigDrawer | `.mcd-backdrop`/`.mcd-panel` (420px right-slide) | 60 | `pages/medications/MedConfigDrawer.jsx` | no |
| MultiChangeWarningModal | `.qa-modal.mcw-modal` (480px) | 60 | `components/MultiChangeWarningModal.jsx` | no |
| StreakMilestone | `.milestone` (fixed toast, bottom-right) | — | `StreakMilestone.jsx` | n/a |

⚠️ **No portal / no z-index stacking discipline:** all backdrops share z-index 60. Only in-modal popovers (`.qa-cat-pop` 70, task menu 80) go higher. Genuine nested modals (a modal opened from a modal) are NOT supported — must be built for the calendar edit-popup (Batch 3).

### Debug rail — `.demo-rail` — `App.jsx:392-416`
Gated by `LIFE_DEBUG` (`App.jsx:13-14`, `?debug` query param). Buttons: `tg test` · `sys test` · `cycle milestone` · `⌘K` · `empty states` · `settings` + a RU/UA locale switch + a D/L/P/S theme switch. Hidden without `?debug`; nothing deleted.

---

## SCREENS

## главная — #/home
- Top component: `pages/HomePage.jsx:20` · Responsibility: KPI dashboard (4 stat tiles + 2 charts).
- Blocks (top → bottom):

### KPI hero row  (class: `.home-hero`, `pages/HomePage.jsx:115`; styles `styles.css:2041`)
- Responsibility: 4 clickable stat tiles.  **Width-capped: FULL** (intentionally wide).
- Elements:
  - бюджет месяца — `.stat-card` (`.stat-value.is-over`/`.is-stakes`) — budget %, → finances — `HomePage.jsx:117`, `StatCard.jsx:19`
  - самая длинная серия — `.stat-card` — streak days, → habits — `HomePage.jsx:117`
  - ближайшая цель — `.stat-card` — goal %, → goals — `HomePage.jsx:117`
  - задачи · эта неделя — `.stat-card` — done/total, → tasks — `HomePage.jsx:117`

### charts row  (class: `.home-charts`, `HomePage.jsx:128`; styles `styles.css:2104`)
- Responsibility: 6-month trend + current-month categories.  **Width-capped: FULL** (charts need width).
- Elements:
  - **тенденция · 6 месяцев** — `TrendChart.jsx:18` in `ChartCard`
    - series toggle расходы/доходы/нетто — `.chart-segctrl-btn.is-on` — `TrendChart.jsx:86-88`
    - chart svg — `.trend-chart` (`.trend-area`/`.trend-line`/`.trend-dot`) + `.trend-tooltip` — `TrendChart.jsx:100-136`
  - **категории · текущий месяц** — `CategoryChart.jsx:20` in `ChartCard`
    - period toggle месяц/30 дней — `.chart-segctrl-btn` — `CategoryChart.jsx:148-150`
    - category rows — `.cat-row` (`.cat-row-bar-fill`; `.is-stakes` on the single ≥80% row) — `CategoryChart.jsx:124`
    - «+N других» — `.cat-row.is-others` — `CategoryChart.jsx:117`

## задачи — #/tasks
- Top component: `pages/TasksPage.jsx:7` · Responsibility: master task list with filter + sort.
- Blocks:

### page header  (`.page-head`, `TasksPage.jsx:44`) — **FULL**
- заголовок «задачи» — `.page-title` — `TasksPage.jsx:46`
- подзаголовок «X/Y · задач» — `.page-sub.mono` — `TasksPage.jsx:47`

### filter + sort toolbar  (`.tasks-toolbar`, `TasksPage.jsx:51`) — **CAPPED** (left-anchored)
- filter capsules — `.tasks-chips` › `.tasks-chip.is-on` — все · сегодня · просрочено · рутина · важное · сделано — `TasksPage.jsx:52-57`
- sort trigger — `.tasks-sort-trigger` → dropdown `.tasks-sort-pop` (по дате / по приоритету / по категории) — `TasksPage.jsx:59-70`

### task list card  (`.tasks-list-card.card.panel`, `TasksPage.jsx:81`) — **CAPPED** (left-anchored)
- **task row** — `.task-row` (`.is-stakes`) — `TasksPage.jsx:84` / `TaskList.jsx`
  - done checkbox — `.task-check.is-done` (green) — `TasksPage.jsx:85`
  - title — `.task-title` (2-line clamp, → detail modal) — `TasksPage.jsx:89`
  - meta chips — `.task-meta` (fixed/right): `.task-tag` + `.task-due` — `TasksPage.jsx:91-97`
- empty state — `.empty-state` — `TasksPage.jsx:79` — **FULL** (uncapped)

## календарь — #/calendar
- Top component: `CalendarView.jsx:16` · Responsibility: week view (Batch-3 cube rebuild planned).
- Blocks:

### week header  (`.cal-head`, `CalendarView.jsx:68`) — **FULL**
- month label — `.cal-h` — `CalendarView.jsx:69`
- prev / today / next — `.cal-btn` — `CalendarView.jsx:71-73`
- «неделя» view toggle (disabled) — `.cal-view-btn.is-on` — `CalendarView.jsx:76`

### day grid  (`.cal-pill-grid`, `styles.css:3938`) — **FULL** (stretches; rebuild target)
- 7× day cell — `.cal-day` (`.is-today` blue tint) — `CalendarView.jsx:88`
  - weekday — `.cal-day-dow` — `CalendarView.jsx:90`
  - date number — `.cal-day-num.is-today` — `CalendarView.jsx:93`
  - quiet-day placeholder — `.cal-day-empty` — `CalendarView.jsx:98`
  - event pill — `.cal-pill` (`.is-stakes`/`.is-routine`/`.is-info`, 3px bar + HH:MM + title) — `CalendarView.jsx:101`
  - «+N ещё» overflow — `.cal-pill.cal-pill-more` → opens DayDetailModal — `CalendarView.jsx:105-108`

### DayDetailModal  (`.qa-modal.modal-day`, 560px, z-60) — **FULL** (fixed width)
- title (year + full date) — `.modal-day-title` — `DayDetailModal.jsx:37-40`
- close — `.qa-close` — `DayDetailModal.jsx:41`
- event list — `.modal-day-list` › `.cal-pill-lg` — `DayDetailModal.jsx:50-69`
- «+ добавить событие» — `.modal-day-add` — `DayDetailModal.jsx:74-76`

## заметки — #/notes
- Top component: `pages/QuickNotesPage.jsx:9` · Responsibility: raw capture inbox → promote/delete.
- Blocks:

### page header  (`.page-head`, `QuickNotesPage.jsx:27`) — **FULL**
- «заметки» — `.page-title` — `:29`
- «быстрая фиксация…» — `.page-sub.mono` — `:30`
- inbox count — `.page-count.mono` — `:32`

### note input  (`.qn-input`, `QuickNotesPage.jsx:35`) — **FULL**
- «+» prefix — `.qn-input-prefix` — `:36`
- text field — `.qn-input-field` (autofocus, Enter commits) — `:39`
- ↵ hint — `.qn-input-hint` — `:46`

### notes list  (`.qn-list`, `QuickNotesPage.jsx:53`) — **FULL**
- note row — `.qn-item` (time / text / actions) — `:55-57`
  - «в задачу» promote — `.qn-item-btn` → `onPromote` (Batch-4 Clarify hook) — `:59-60`
  - delete — `.qn-item-btn.is-danger` — `:65-66`
- empty state — `.qn-empty` — `:51`

## я — #/me
- Top component: `pages/ProfilePage.jsx:9` · Responsibility: 5 inline-editable profile cards.
- Blocks:

### page header  (`.page-head`) — **FULL** — «я» `.page-title` `:24`; sub `.page-sub` `:25`
### profile cards grid  (`.profile-cards`, `styles.css:1604`) — **CAPPED**
- **личное** — `.pc-card` `IdentityCard.jsx:4` — name/age/city/bio via `EditableField`; inner 2-col `.pc-grid-2`
- **тело** — `.pc-card` `BodyMetricsCard.jsx:6` — height/weight + weight `.pc-sparkline` + notes
- **мерки** — `.pc-card` `MeasurementsCard.jsx:4` — 8 measurements (`.pc-grid-2`) + notes
- **размеры** — `.pc-card.pc-card-wide` `ClothingSizesCard.jsx:7` — `.pc-sizes-table` EU→US→UA/UK (edit EU auto-derives)
- **еда** — `.pc-card.pc-card-wide` `FoodPreferencesCard.jsx:6` — allergy/likes/dislikes tag groups (`.pc-food-cols`, `.pc-food-tag`) + notes
- «+ добавить секцию» (disabled) — `.profile-add-section` — `ProfilePage.jsx:41` — **FULL**
- *Inner grids `.pc-grid-2`, `.pc-food-cols` inherit the cap from `.profile-cards`.*

## привычки — #/habits
- Top component: `pages/RelocatedPages.jsx:8` → `HabitsGrid.jsx:10` · Responsibility: 7-day habit grid + streaks.
- Blocks:

### page header  (`.page-head`) — **FULL** — «привычки» `.page-title` `RelocatedPages.jsx:14`; counter `.panel-meta.mono` `HabitsGrid.jsx:41`
### habits grid card  (`.panel.card` › `.habits-grid`, `HabitsGrid.jsx:38`) — ⚠️ **FULL (uncapped)**
- weekday header row — `.habits-row.habits-row-head` › `.habits-day.is-today` — `:54-59`
- per-habit row — `.habits-row` › `.habits-name` + 7× `.habits-cell` (`.is-done`/`.is-missed`/`.is-future`; today = clickable button) — `:64-85`
- streak row — `.habits-streak-row` › `.habits-streak.mono` — `:88-90`
- empty state — `.empty-state.empty-habits` + `.empty-action` — `:48-49`

## цели — #/goals
- Top component: `pages/RelocatedPages.jsx:22` → `GoalsWidget.jsx:4` · Responsibility: goal progress bars.
- Blocks:

### page header  (`.page-head`) — **FULL** — «цели» `.page-title` `RelocatedPages.jsx:28`; count `.panel-meta.mono.is-stakes` `GoalsWidget.jsx:15`
### goals card  (`.card.panel.is-stakes.goals-card`, `GoalsWidget.jsx:12`; styles `styles.css:831`) — **CAPPED**
- goal row — `.goal-row` — `:22`
  - title — `.goal-title` — `:24`
  - timeframe tag — `.goal-tag.mono` (e.g. Q3) — `:25`
  - progress — `.goal-track` › `.goal-fill` (width=pct) — `:27-28`
  - footer val/pct — `.goal-foot.mono` (`.goal-val` / `.goal-pct`) — `:31-32`
- empty state — `.empty-state` — `:18`
- *Batch-5 will add per-goal next-action + «⚠ нет след. действия» stuck flag here (currently absent).*

## здоровье — #/health
- Top component: `pages/HealthPage.jsx:7` · Responsibility: skeleton, 4 metric cards.
- Blocks:

### page header  (`.page-head`) — **FULL** — «здоровье» `.page-title` `:22`; sub `.page-sub` `:23`
### health grid  (`.health-grid`, `styles.css:1894`) — **CAPPED**
- 4× card — `.pc-card.health-card` (icon + title `.health-icon`/`.pc-title` + empty `.health-empty`) — анализы/визит/покупки/цели — `HealthPage.jsx:28-33`

## собака — #/dog
- Top component: `pages/DogPage.jsx:12` · Responsibility: passport/feeding/inventory/vet/tasks/expenses.
- Blocks:

### page header  (`.page-head`) — **FULL** — «собака» `.page-title` `:27`; sub `:28`
### reminders rail  (`.dog-reminders`, `:33`) — ⚠️ **FULL (uncapped)** — 3× `.dog-reminder` pills (feed/walk/vet)
### dog grid  (`.dog-grid`, `styles.css:1761`) — **CAPPED**
- **паспорт** — `.pc-card.dog-profile-card` — `.dog-profile-body` (avatar `.dog-avatar` + `.dog-profile-fields` 2-col: name/breed/birth/weight) — `:51-91`
- **кормление** — `.pc-card` — `.dog-meals` › 3× `.dog-meal-row` (num/time/portion/`.dog-feed-btn`) + history link — `:98-124`
- **инвентарь** — `.pc-card` — `.dog-inv` (food `.dog-inv-track-bar` + secondary treats/hygiene) — `:131-158`
- **ветеринар** — `.pc-card` — `.dog-vet` 2-col (last / `.is-next` blue) — `:171-186`
- **задачи по собаке** — `.pc-card` — `.dog-empty` — `:194-197`
- **расходы за месяц** — `.pc-card` — `.dog-empty` — `:205-209`
- *Inner grids `.dog-profile-fields`, `.dog-vet` inherit the cap from `.dog-grid`.*

## финансы — #/finances
- Top component: `pages/FinancesPage.jsx:16` · Responsibility: summary + logger + filter + tx list.
- Blocks:

### page header  (`.page-head`, `:97`) — **FULL** — «финансы» `.page-title` `:99`; «N транзакций · $ · окт» `.page-sub.mono` `:100`
### budget summary  (`.fin-summary`, `styles.css:3762`) — **CAPPED**
- в-тоталах cell / скрыто cell — `.fin-summary-cell` — `:109-119`
- budget bar — `.fin-summary-bar-fill` (`.is-warn`/`.is-over`) + `.fin-summary-bar-meta.mono` — `:123-127`
- inline logger — `.fin-logger` ($ input + category select + «записать») — `:132-150`
### filter chips  (`.fin-toolbar` › `.tasks-chip`, `:154`) — **CAPPED** — все / в тоталах / скрытые + `.tasks-chip-count` — `:162-164`
### transaction list  (`.fin-tx-card`, `styles.css:3806`) — **CAPPED**
- **tx row** — `.fin-tx` (`.is-excluded` grayed+strike) — `:192`
  - icon — `.fin-tx-icon` — `:193`
  - category + «категория скрыта» chip — `.fin-tx-cat` / `.fin-tx-cat-chip` — `:197-202`
  - description — `.fin-tx-desc` — `:205`
  - eye toggle — `EyeToggle` (per-tx include/exclude) — `:207-212`
  - amount — `.fin-tx-amt.mono` — `:214`
  - meta «source · DD.MM» — `.fin-tx-meta.mono` — `:215`

## ежемесячные / годовые / инвестиции — #/monthly #/annual #/investments
- Top component: `pages/PlaceholderPage.jsx:4` (ONE component, 3 routes) · Responsibility: centered stub card.
### placeholder  (`.ph-page` › `.ph-card`, 520px centered) — **FULL** (centered, not `--readable`)
- eyebrow — `.ph-eyebrow.mono` — `:8` · body — `.ph-body` — `:9`

## настройки — #/settings
- Top component: `SettingsPage.jsx:4` · Responsibility: 8-section settings (nav + body).
### section nav  (`.set-nav`, `styles.css:2470`) — **FULL** — 8× `.set-nav-btn` (аккаунт/категории/telegram-бот/monobank/уведомления/оформление/экспорт/`.is-danger` опасная зона) — `:26`
### body sections  (`.set-body`) — **FULL** (all `.set-*` uncapped):
- **аккаунт** — `.set-row` + `.set-input` (name; email `.is-readonly`) — `:58-62`
- **категории** — `.set-table.set-table-cat` (name+dot / budget / `EyeToggle`) + «+ добавить категорию» — `:67-104`
- **telegram-бот** — token/chatID `.set-input.mono` + «отправить тест» `.set-btn-primary` + rules toggles — `:110-123`
- **monobank** — API token + last-sync `.set-mono-time` + «синхронизировать» `.set-btn-primary` — `:128-138`
- **уведомления** — `Toggle` rows (goal/budget/streak/bot) + quiet hours — `:144-152`
- **оформление** — theme `.set-seg.set-seg-theme` (тёмная/светлая/остров/системная) + language `.set-seg` (RU/UK) + accent `.set-range` + density `.set-seg` — `:158-202`
- **экспорт** — 3× `.set-btn-ghost` (JSON/CSV/Markdown) — `:208-213`
- **опасная зона** — `.set-danger-card` delete-all + state export + clear-history `.set-seg` (3/6/12mo) + `.set-clear-confirm` (cancel `.set-btn-ghost` + `.set-btn-danger`) — `:218-275`

## препараты — #/medications
- Top component: `pages/MedicationsPage.jsx:18` · Responsibility: 3-view tracker + modal orchestration.
### page header + view tabs  (`.page-head` + `.meds-view-tabs`, `:79-87`) — **FULL** — «препараты» `.page-title`; tabs `.meds-view-tab.is-on` СПИСОК/ЖУРНАЛ/ИСТОРИЯ
### status filter  (`.meds-filter-row`, `:97`) — **FULL** — `.meds-filter-chip.is-on` активные/приостановленные/планируемые/все
### card grid  (`.medc-grid`, `:107`) — ⚠️ **FULL (uncapped)**
- **med card** — `.medc` `MedCard.jsx:68`
  - image/glyph — `.medc-img`/`.medc-img-fallback` — `:69-73`
  - name/dose/БАД/mode — `.medc-name`/`.medc-dose`/`.medc-supp`/`.medc-mode-badge` — `:82-199`
  - 3 timers — `.medc-timers` › `.medc-timer` (next / t½ / full elim) + `.medc-usual` — `:92-126`
  - actions — `.medc-action-take` «принял»→TakeDose / `.medc-action-later` / `.medc-action-skip` / `.medc-config` gear→Drawer — `:131-151`
  - inventory — `.medc-inv-text` + risk chip `.medc-inv-chip-soon/-urgent/-low/-empty` + «пополнить»→RefillModal — `:154-167`
- empty — `.meds-empty` — `:118`
### Modals/drawer (see Global table for z-index)
- **TakeDoseModal** `.tdm-modal` — когда/доза/заметка + late/early `.tdm-indicator` + PRN `.tdm-prn-warn` + save `.qa-btn-save.btn--stakes` — `TakeDoseModal.jsx`
- **RefillModal** `.tdm-refill` — «добавить таблеток» + «будет всего» — `RefillModal.jsx`
- **MedConfigDrawer** `.mcd-panel` — 5 sections: основное / интервал / стратегия приёма (steady/up/down/prn `.mcd-radio`) / запасы / удалить (`.is-danger`) + footer save — `MedConfigDrawer.jsx`
- **MultiChangeWarningModal** `.mcw-modal` — soft parallel-change warning + proceed `.btn--stakes` — `MultiChangeWarningModal.jsx`
### MedDetailPage — `/medications/{id}` — `MedDetailPage.jsx:17`
- back `.mdp-back`; header `.page-head.mdp-head`; tabs `.mdp-tabs` (ОБЗОР/ЖУРНАЛ/ИСТОРИЯ ДОЗ/КОНФИГУРАЦИЯ)
  - ОБЗОР — `.mdp-stat-grid` 4 stats + `.mdp-timers-card` + `.mdp-notes`
  - ЖУРНАЛ — **PharmNotes** (`.pn-capture` polarity ± / text / date / save; `.pn-summary`; `.pn-row` list)
  - ИСТОРИЯ ДОЗ — `.mdp-doses` `.pn-row` + `ActivityTimeline`
  - КОНФИГУРАЦИЯ — `.mdp-config-grid` read-only + «открыть панель настроек»→Drawer
- **GlobalJournal** (`.meds-view` ЖУРНАЛ across all meds) — `.gj-chip-row` med filter (`.meds-filter-chip`) + `.gj-pol-toggle` (все/только+/только−) + `.gj-search` + `.pn-row` feed — `GlobalJournal.jsx`

---

## DESIGN TOKENS MAP

Colour/semantic tokens live in `colors_and_type.css` (canonical dark) and are **re-declared per theme in `styles.css`** (dark `:root` ~`:90-210`, light `[data-theme="light"]` `:213`, paradise-day `[data-theme="paradise"][data-scene="day"]` `:4194`, paradise-night `…[data-scene="night"]` `:4312`). Density/layout tokens live in `styles.css :root` `:20-61` (theme-independent).

| Token | dark | light | paradise-day | paradise-night | applied |
|---|---|---|---|---|---|
| `--primary` (blue) | `#229ED9` | `#1B8AC4` | (light family) | (dark family) | nav active, default buttons, links, today, focus ring |
| `--accent` (STAKES gradient) | `#FFC066→#FF8A1E→#FF6B0A` | `#FF7A0E→#DB5A0C→#B14808` | light family (`--o2 #DB5A0C`) | dark family | the 8 stakes triggers ONLY; `.is-stakes`, orange chart pick, `--accent-border` |
| `--success` (green) | `#1D9E75` | `#0F7A50` | ← | ← | `.task-check.is-done`, income, pharm «+» |
| `--danger` (red, semantic) | `#E5484D` | `#C92429` | ← | ← | delete, over-budget, missed, `.set-btn-danger` |
| `--warning` (yellow) | `#F1B33B` | `#B57F0F` | ← | ← | «about to go wrong» (deadline<2h, budget 95%) |
| `--fg1` (primary text) | `#F5F5F7` | `#0F1419` | `#1a1f29` | `#eaf1f8` | body text, `.tb-cmd-input` |
| `--surface` (card fill) | `rgba(22,26,33,0.65)` | `rgba(255,251,246,0.72)` | `rgba(255,251,246,0.96)` ¹ | `rgba(20,28,40,0.90)` ¹ | `.panel`/`.card`/`.tb-cmd` at rest |
| `--surface-h` (hover/focus) | `rgba(255,255,255,0.055)` | `#F2F2EF` | `rgba(10,20,40,0.06)` ⚠ | (inherits dark) | `:hover`/`:focus-within` bg → **see search bug** |
| `--border` | `rgba(255,255,255,0.08)` | (theme) | `rgba(255,255,255,0.5)` | `rgba(150,180,210,0.18)` | hairlines |
| **layout** | | | | | |
| `--readable` | `680px` (theme-independent) | | | | max-width of capped blocks |
| `--readable-mi` | `0 auto` (LEFT-anchored; `auto`=centered) | | | | margin-inline of capped blocks |
| `--btn-h-sm/md/lg` | `26 / 30 / 36px` | | | | control heights (danger now md) |
| `--input-h` / `--row-h` | `30 / 34px` | | | | inputs / rows |
| `--text-xs…3xl` | `11 / 12 / 13 / 15 / 18 / 24 / 32px` | | | | type scale (12px floor after Batch 1; xs 11 = mono chrome only) |
| `--r-sm/md/lg/pill` | `6 / 10 / 12 / 999px` | | | | radii (styles.css overrides colors_and_type) |
| **motion** | `--dur-fast 120 / --dur 180 / --dur-slow 260`; `--ease cubic-bezier(.22,1,.36,1)` | | | | transitions |

¹ paradise surface raised in Batch 1 (day 0.86→0.96, night 0.72→0.90). ⚠ `--surface-h` on paradise-day is near-transparent → the search-focus bug (Findings §3).

**4-combo theme switching:** `<html data-theme="dark|light|paradise">` + (paradise only) `data-scene="day|night"`, owned by `useTheme` (`App.jsx:55`) from the Europe/Kiev clock (day 06:00–19:59), re-checked every 60s; anti-flash head script sets both pre-paint. Runtime swaps wrapped in `html.theme-switching` / `html.scene-switching` transition-kill guards (Chromium var()-transition freeze). **No backdrop-blur under paradise** (compositor drops blurred subtrees over the animated scene — ARCHITECTURE.md:220).

---

## FINDINGS

### 1 · Uncapped blocks (the "sections blew up" list)
Now that `.main`'s 1200px cap is removed, these have **no width cap** and stretch full-width. Grouped by screen; **bold = likely wants a `--readable` (or its own generous) cap** in a follow-up density pass.

- **Home:** `.home-hero`, `.home-charts` — *intentionally* full-width (KPI + charts). Optional generous cap (~1600px) only if sparse at ultrawide.
- **Tasks:** page header `.page-head`, `.empty-state` — **header/empty uncapped** (list itself is capped).
- **Calendar:** `.cal-head`, **`.cal-pill-grid`** — rebuilt in Batch 3.
- **Notes:** **`.qn-input`**, **`.qn-list`**, `.page-head`.
- **Profile:** `.page-head`, `.profile-add-section` (grid `.profile-cards` capped).
- **Habits:** **`.habits-grid`** (whole 7-day grid uncapped), `.page-head`.
- **Health:** `.page-head` (grid capped).
- **Dog:** **`.dog-reminders`**, `.page-head` (grid capped).
- **Finances:** `.page-head` (summary/filter/tx all capped).
- **Placeholders:** `.ph-page` (card is 520px centered).
- **Settings:** **`.set-layout` / `.set-nav` / `.set-body`** (whole settings surface uncapped).
- **Medications:** **`.medc-grid`**, `.meds-view-tabs`, `.meds-filter-row`, `.meds-empty`; detail **`.mdp-stat-grid` / `.mdp-config-grid` / `.mdp-doses`**, `.gj-*`.
- **Generic (multi-use):** `.panel-grid` (`styles.css:657`) — generic 2-col grid; any consumer stretches unless wrapped.

### 2 · Shared-class controls (restyle-one-hits-all)
- **Filter capsule:** `.tasks-chip` (tasks **+** finances), `.meds-filter-chip` (meds + GlobalJournal), `.meds-view-tab` (meds), `.set-seg-btn` (settings ×4), `.chart-segctrl-btn` (home charts). *One restyle touches 6 surfaces.*
- **Card surface:** `.panel`/`.card` + specializations `.stat-card`/`.chart-card`/`.pc-card`/`.medc`/`.meds-item`/`.milestone` — all fed by `--surface`.
- **Tag chip:** `.task-tag`, `.fin-tx-cat-chip`, `.medc-*` badges.
- **Buttons:** `.set-btn-primary/ghost/danger`, `.qa-btn-save/ghost`, `.tb-add`.
- **Done control:** `.task-check.is-done` (TaskList/TasksPage/TaskDetailModal).
- **EyeToggle** (Finances ×2 + Settings).

### 3 · Search input — invisible-on-focus (named bug, VERIFIED)
- **Bug:** **TopBar › search field › typed text unreadable on focus under paradise-day.**
- **Class:** `.tb-cmd` (wrapper) / `.tb-cmd-input` (input).
- **Root cause (verified, NOT a text-color issue):** at rest `.tb-cmd { background: var(--surface) }` = paradise-day cream **0.96** (opaque) → dark input text `--fg1 #1a1f29` reads fine. On focus `.tb-cmd:focus-within { background: var(--surface-h) }` (`styles.css:585`), and paradise-day `--surface-h = rgba(10,20,40,0.06)` (`styles.css:4207`) — a **6%-opacity tint**. The opaque cream collapses to near-transparent, the **bright island-day photo shows through**, and dark `#1a1f29` text loses contrast against it. Caret inherits `--fg1`, same problem.
- **File:line:** `styles.css:585` (`.tb-cmd:focus-within` → `--surface-h`); `styles.css:4207` (paradise-day `--surface-h`); input `styles.css:590-595`.
- **Themes affected:** **paradise-day = severe.** Dark/light/paradise-night OK (their `--surface-h` stays readable-contrast: dark/night keep light text on dark; light stays opaque `#F2F2EF`).
- **Correct fix direction (for a later batch, NOT done here):** under paradise-day, keep `.tb-cmd` focus background opaque (e.g. `var(--surface)` or a solid cream) instead of the transparent `--surface-h`; optionally set an explicit `caret-color`. *(Agent's earlier "white-text-on-white" theory was wrong — text color is fine; the surface goes transparent over the scene.)*
- **Secondary note:** the search field is currently a **dead control** — typed text sets local `search` state (`TopBar.jsx:7,35`) that nothing consumes; ⌘K (`App.jsx:246`) opens QuickAdd instead. Wire or repurpose it in a future batch.

---

*Proposed durable home:* commit this file as `docs/UI-MAP.md` so it loads as a companion to README/ARCHITECTURE in every session. **Staged as a proposal — not committed without your ack.**
