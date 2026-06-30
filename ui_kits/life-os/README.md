# Life OS — UI Kit (v1.0)

A high-fidelity recreation of the Life OS dashboard. Single user. Cool routine + warm stakes. **Dark and light themes — full parity.**

> No source code or Figma was provided for this product. The kit is a best-guess at what Linear/Things-grade Life OS would look like under these rules.

## Theme system

All colors flow through CSS custom properties under `[data-theme]` on `<html>`. Default: dark.

- `[data-theme="dark"]` — original brand. `#0E1117` canvas + dual radial ambient. Stakes orange uses GLOW shadows (rgba light spilling out).
- `[data-theme="light"]` — `#F7F7F4` warm off-white canvas (never pure white). No ambient gradient. Stakes orange rethought: deeper gradient `#FF7A0E → #DB5A0C → #B14808`, drop shadows instead of glows, burnt text `#8A3806` on orange tints.

A small inline `<script>` in `<head>` applies the theme attribute BEFORE the stylesheet loads, so the user never sees a flash of the wrong theme. The script reads `localStorage.lifeOsTheme` (`'dark'` / `'light'`), and if absent, falls back to `prefers-color-scheme`. The default for first-time visitors is dark.

User picks the mode in Settings → оформление → тема (segmented control: **тёмная / светлая / системная**). Selecting "системная" removes the localStorage key and starts following `prefers-color-scheme` live (changes apply without reload).

## Files

| File | What's in it |
| --- | --- |
| `index.html` | Loads all components, mounts the dashboard demo |
| `i18n.jsx` | RU primary, UA secondary. EN slot reserved (not rendered). Includes `t.pl(key, n)` for 3-form Slavic plurals. |
| `categories.jsx` | 16 expense + 6 income categories. Expenses = neutral. Income = green. **Stakes is an event property, not a category property.** |
| `icons.jsx` | Inline Lucide-style SVGs — nav + category icons |
| `Sidebar.jsx` | 220px fixed nav · routine vs stakes · Settings link at bottom |
| `TopBar.jsx` | Real search input + cmd-K target + quick-add `+` |
| `Today.jsx` | "Сегодня · N задач{а\|и\|} в работе" hero (plural-aware) |
| `TaskList.jsx` | Inbox list · checks · stakes-tinted rows · row click opens detail |
| `MoneyWidget.jsx` | Money input · 80% warning + overshoot states · empty state |
| `GoalsWidget.jsx` | Stakes-only widget with gradient progress · empty state |
| `HabitsGrid.jsx` | Today underline · clickable today · streak counters · empty state |
| `StreakMilestone.jsx` | 7 / 30 / 100-day banner (plural-aware) |
| `QuickAddModal.jsx` | ⌘K modal · title · routine/stakes · typeable category · schedule · notes |
| `TaskDetailModal.jsx` | Full task editor · subtasks · notes · activity log · complete · delete |
| `SettingsPage.jsx` | 8 sections: account · categories · telegram · monobank · notifications · appearance · export · danger zone |
| `CalendarView.jsx` | Week view · 7-day grid · hour rows · stakes events orange, routine blue |
| `MobileBottomNav.jsx` | 5-slot bottom nav (today · inbox · money · habits · more) — appears <640px |
| `Toast.jsx` | System + telegram-bot variants |
| `App.jsx` | Mounts everything, owns locale + state |
| `styles.css` | All component styles including responsive media queries |

## What works (interactive)

- **Theme switch** — Settings → оформление → тема, OR the `D` / `L` / `S` toggle in the demo rail. Persists across reload. `S` = follow OS preference.
- **Tasks** — check / uncheck, inline `+ добавить задачу…`, click row to open detail (subtasks, notes, activity log, complete/delete with confirm)
- **Quick-add modal** — `⌘ K` or top-right `+` · title · routine/stakes · typeable category dropdown · schedule expander · notes expander · Enter saves, Esc cancels
- **Calendar** — sidebar → `календарь` shows the week view. Prev/Today/Next nav. Click any empty cell to open quick-add. Stakes events render orange, routine blue.
- **Settings** — bottom-of-sidebar `настройки` link opens 8-tab settings page. Working: account fields, category list, masked token inputs, toggles, segmented controls (theme/density), language toggle (RU/UA), accent slider, danger zone.
- **Habits** — click today's cell to mark; click again to unmark; past not editable; streak line `серия N дней · лучшая M` updates with proper plurals
- **Money** — typeable amount, full category dropdown, 80% warning + overshoot states with localized hints
- **Locale switching** — `RU / UK` in demo rail OR in Settings → оформление. Every string + plural form re-renders
- **Empty states** — `empty states ON/OFF` in demo rail toggles every panel to empty mode
- **Mobile** — resize the browser below 640px: sidebar disappears, bottom nav appears, quick-add becomes a bottom sheet, layouts collapse to single column
- **Toasts** — `tg test`, `sys test`, `cycle milestone` in the demo rail

## What's faked

- No persistence — refresh resets state
- Search bar is typeable but doesn't search (real fuzzy-search across tasks/transactions/goals/notes is a build-phase feature)
- Calendar renders only week view (day/month deferred post-v1.0)
- Monobank / Telegram tokens are masked placeholders
- Subtasks, attachments, comments on TaskDetail are mock seed data
- Theme toggle has only `тёмная` available — `на улице` (light theme) is marked "скоро" (coming soon)

## v1.x ideas

- Real persistence (localStorage)
- Drag-to-reorder for categories + tasks
- Search functionality
- Day / month calendar views
- Density control (cozy / compact) wired to actual CSS sizing

