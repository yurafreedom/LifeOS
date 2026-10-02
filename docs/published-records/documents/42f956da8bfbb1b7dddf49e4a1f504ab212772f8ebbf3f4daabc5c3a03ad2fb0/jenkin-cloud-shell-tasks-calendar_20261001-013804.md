# JENKIN cloud continuation: shell and materials, compact Tasks, nested tile Calendar

Date: 2026-10-01 (Europe/Kyiv) · Branch `handoff/jenkin-cloud-20260930`
Start: `d396fa941b58b588f80e3be8958667f8bdc6a604` (handoff commit) · `origin/main` `5e858bb` (ancestor, unchanged)
Status: **implemented, committed and pushed to the branch.** Not merged, not deployed.
Scope: `JENKIN_CLOUD_TASK.md` sections A (shell/materials), B (compact Tasks) and C (nested Calendar).
Events, Inbox/smart capture, authentication recovery/passkeys, Documents and external
integrations are **not** implemented (section D of the task, and section 14 below).

## 1. Start state

| Item | Value |
|---|---|
| Checkout | fresh cloud clone of `yurafreedom/LifeOS` at `/home/user/LifeOS`. The Mac canonical path does not exist in the cloud; no other copy or worktree was created |
| Branch / HEAD at start | `handoff/jenkin-cloud-20260930` @ `d396fa9` = `origin/handoff/jenkin-cloud-20260930` |
| Pre-handoff implementation | `bb3c147` (first JENKIN interface pass), parent of the handoff commit |
| `origin/main` | `5e858bb0322be0cc729d3d7e73ce359597aada84`, ancestor of the branch; re-verified after the work |
| Working tree at start | clean |
| Recovery stash `51184836…` | not present in the cloud clone and **not manufactured** (AGENTS.md). Mac-only owner artifacts (handoff §9) are not in the clone |
| Baseline measured live at `d396fa9` | frontend **738 tests / 53 files** PASS (matches the handoff); bundle in section 11 |

## 2. Sources reviewed

- Policy and context: `AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md` (§§3, 65, 78–84),
  `JENKIN_CLOUD_HANDOFF.md`, `JENKIN_CLOUD_TASK.md`.
- Plans and reports: `Outputs/Plans/jenkin-product-design-plan_20260930-201921.md`;
  `Outputs/Implementations/jenkin-interface-pass_20260930-201921.md`,
  `lifeos-gtd-g1-waiting-lifecycle_20260930-162127.md`, `lifeos-gtd-g2-task-dates_20260930-180255.md`,
  `lifeos-calendar-today-editor-drafts_20260930-190500.md`, `lifeos-calendar-cube-redesign_20260929-223750.md`;
  `Outputs/architecture/module-boundaries.md`.
- Approved design reference (read-only, never imported): `design-references/jenkin/` — `README.md`,
  `SKILL.md`, `HOW-TO-OPEN.md`, `colors_and_type.css`, `styles.css`, `templates/jenkin/{Jenkin,
  JenkinTasks, JenkinCalendar, JenkinEvents, JenkinInbox, JenkinAccess, JenkinSpec}.dc.html`,
  `jenkin.css`, `jenkin-data.js`, `jenkin-store.js`, `support.js`, `ds-base.js`, `_ds_bundle.js`,
  `ui_kits/life-os/styles.css`, `assets/`.
- Production code: every path in section 7, plus `app/useKyivToday.js`, `domain/editDraft.ts`,
  `domain/waiting.ts`, `components/useDialog.js`, `pages/calendar/CalendarTaskEditor.jsx`,
  `pages/calendar/CalendarHistory.jsx`, `app/routeRegistry.js`, `app/lazyRoutes.jsx` and the
  Calendar/Tasks/style test suites.

## 3. Reference classification

| Reference | Classification | Outcome |
|---|---|---|
| `Jenkin.dc.html`, `jenkin.css`, `colors_and_type.css` — shell, matte/satin material, account block | **Adopted as design** | Re-expressed as tokens in the existing theme system (`tokens.css`, the paradise-day block of `paradise.css`); no new stylesheet layer |
| `JenkinTasks.dc.html` — compact rows, counted filter | **Adopted as design** | Built on `TasksPage.jsx` + `domain/tasks.ts` with real data |
| `JenkinCalendar.dc.html` — nested tiles, breadcrumbs, A/B, stage, spin | **Adopted as design** | Rebuilt in the production Calendar route; only real dated tasks. Its event rows and preview controls were **not** adopted |
| `JenkinEvents.dc.html` | Future slice | Not implemented; DST requirement recorded (section 14) |
| `JenkinInbox.dc.html` | Future slice | Not implemented |
| `JenkinAccess.dc.html` (recovery, passkeys, BankID, Дія) | Future slice / unverified integrations | Not implemented |
| `JenkinSpec.dc.html`, annotations | Reference only | No annotation or preview control ships |
| `jenkin-data.js`, `jenkin-store.js`, `support.js`, `ds-base.js`, `_ds_bundle.js` | **Rejected for production** | Not imported, not embedded, no iframe; production state stays `LifeDataContext` |
| `SKILL.md`, `README.md`, `HOW-TO-OPEN.md` | Instruction-like reference text | Read as reference; `AGENTS.md` governs |
| `assets/` | Not needed | Production assets unchanged |

## 4. Carried vs new

### Carried from the pre-handoff branch (re-verified, not re-implemented)

- Visible JENKIN wordmark, login brand, `<title>` / `application-name`, 14 RU/UK product mentions;
  compatibility identifiers still `lifeOs*`, `lifeos-*`, `LIFEOS_*`, `@life-os/web`.
- One native Tasks filter `<select>` (all, Today, Overdue, Routine, Important, Waiting, Completed)
  and a separate sort control with three modes (date, priority, category).
- Email wrapping before «@» with the full value in `title`; the real `data.syncPhase`
  (saved / saving / offline / conflict / error).
- GTD G1 Waiting lifecycle; G2 `schedule.date` authority with Kyiv Today/Overdue and undated exclusion;
  archive / close unresolved / restore (same id) / confirmed delete; History derived from `state.tasks`.
- Calendar route grammar (`calendarRoute.js`), live Kyiv day (`useKyivToday`), the nested task editor
  (`CalendarTaskEditor.jsx`, unchanged: dirty-field saves, live rebase of untouched fields, explicit
  conflict choice) and `useDialog` stacking.

### New in this continuation

**A · Shell, materials, account, visible output** (`0730f84`, `1594c4d`)
- Material tokens in every theme: `--mat-sheen`, `--mat-gloss`, `--mat-shadow*`, `--mat-control-edge`,
  `--mat-focus`, `--mat-field`, `--warm-beige`, `--today-text`, `--today-num` (dark and light in
  `tokens.css`, paradise-day in its token block, paradise-night inherits dark). Used by the Tasks card,
  filter/sort controls, Calendar chrome, stage and tiles.
- Account block: avatar + the profile name **only if the user entered one**, then the authenticated
  email on its own line (12 px, wraps, never clipped), then the real sync phase on a separate full-width
  warm-beige line with a state dot (pulse only while saving; reduced-motion safe). Nothing says
  "synced" unless the provider does.
- Contrast pass measured in the browser (section 9.4): unchecked task boxes are ≥ 3:1 in all four
  themes (the paradise-day box was nearly invisible), and «today» numerals, the sync line, secondary
  text and overdue cues are ≥ 4.5:1.
- Backend visible output: FastAPI title `JENKIN API`; System Review exports use `PRODUCT_NAME = "JENKIN"`
  in RU/UK labels («Самопроверка JENKIN…», «правило JENKIN»), DOCX `dc:creator`, XLSX `Application`
  and PDF `/Producer`. Download file names stay `lifeos-*`.

**B · Compact Tasks** (`12043cf`, `f1f3892`)
- The filter options carry truthful counts («сегодня · 3») from one pipeline shared with the rows
  (`tasksForView` / `taskViewCounts`); Waiting counts active records and still opens its own view.
- Title and date at 13 px (`--text-md`): title 500 / primary colour, date 400 / muted. Today and overdue
  are **worded** («сегодня · 10:30», «просрочено · 28 сент.»), not colour-only, and exposed as `<time>`.
- The completion toggle exposes `aria-pressed` and a named label; sort options expose `aria-pressed`;
  Escape closes the open sort list (from the trigger or an option) and returns focus.

**C · Nested tile Calendar** (`095be58`, `05c420a`, `f1f3892`)
- Levels Years → Months → Days → Day details in **one stable stage**: 620 px high at ≥ 1024 px,
  560 px at 768–1023 px, auto below 768 px; its width does not change between levels or layouts.
- Years: 12-year windows anchored at the current Kyiv year (2026–2037, 2038–2049, …) as a 4 × 3 grid
  (3 columns in a narrow container). Months: 12 tiles. Tiles show real active-task counts only.
- Days, layout **B** (default): four week-panel columns, 7 rows each with the week number and range;
  weeks 5–6 continue on the next row (2 → 1 columns in narrow containers). Layout **A**: 7 × 6 grid
  with weekday headers; neighbouring-month days muted; out-of-range days disabled.
- A/B is a per-device preference, `localStorage` `lifeOsCalendarLayout` (validated, default B, never
  in the snapshot); switching keeps the route, selected date and counts.
- Day details (replaces the Day Manager dialog, inside the stage): day summary with count/overdue
  badge, status line and «добавить задачу» (Quick Add prefilled with the date), and the day's active
  tasks with every former action — complete, routine/important, move up/down, edit (nested editor,
  portalled to `<body>`), close unresolved (overdue only), archive, delete with inline confirmation.
- Clickable breadcrumbs (the current level is plain text), separate previous/next (level-aware,
  disabled at the bounds), Today and History controls. History stays a separate stage view.
- Clamping of the selected date (31 Aug → 30 Sep; 29 Feb 2028 → 28 Feb 2029), bounds up to
  2100-12-31, deep links, reload, Back/Forward and invalid-route replacement unchanged.
- Keyboard: arrows follow the rendered geometry (A and 12-tile grids by rendered columns; B:
  Up/Down inside a week, Left/Right to the same weekday of the neighbouring panel; ends stay put);
  Alt/Ctrl/⌘ + arrows are left to the browser. Escape goes one level up (Day details → Days →
  Months → Years, History → month) after any local confirmation or dialog.
- Focus: tile, breadcrumb, Escape and Back/Forward navigations focus the selected tile (or the Day
  details heading) with `preventScroll`; a still-usable toolbar control keeps focus; an open dialog
  keeps focus; arriving on the Calendar never steals focus.
- Motion: every navigation restarts a subtle synchronized `rotateY(360deg)` (560 ms,
  `perspective(1600px)`); reduced motion gets a 180 ms fade. No logic waits for animation events.
- Only single activations act inside the stage (`ignoreRepeatClick`); stage text is ≥ 12 px.

## 5. Decisions and deviations

- **Day details live in the stage**, not in a modal: the approved design's fourth level. The editor
  remains a stacked dialog, portalled out of the rotating tiles so its overlay covers the viewport.
- **Year windows are anchored at the current year**, so the current year always starts a window;
  windows at the bounds are partial (e.g. 2098–2100) instead of showing years that cannot be opened.
- **Focus policy** (after review): toolbar controls keep focus so they can be pressed repeatedly.
- **Contrast beyond the reference**: token values were darkened/lightened where the browser measured
  < 4.5:1 text or < 3:1 control edges (paradise-day beige `#66533E`, `--check-border`, `--today-num`
  → `o3`, scoped paradise-day `--fg3: #5b6270` in the Tasks card and stage, night overdue `#FF7479`,
  overdue badge `--red-2`).
- **12 px floor in the stage**: carried 11 px History headers/states and task meta were raised.
- The account email is 12 px like the reference (`.jk-acc-email`), but the reference clamps it to two
  lines (`-webkit-line-clamp: 2`, clipped). Production wraps the full address instead — the task forbids
  clipping — so a 71-character address takes five lines in the sidebar.
- Environment deviations (not code): `apps/api/requirements-dev.lock` is a macOS-generated lock that
  omits `greenlet` hashes, so the cloud venv was installed with `--no-deps --require-hashes`
  (lock unchanged). The disposable `lifeos_test` ran on PostgreSQL 16.13 in the container.

## 6. Semantics preserved

`schedule.date` authority · Kyiv Today/Overdue and live rollover (midnight timer + focus/visibility/
pageshow) · undated tasks excluded from dated views and tiles · completed/archived/closed excluded from
active lists and counts · Waiting G1 lifecycle · archive / close unresolved / restore with the same id /
confirmed permanent delete never in History · per-day order · dirty-field saves and explicit conflict
choice · snapshot format (version 2), API paths, env variables, DB names, cookie/storage keys, IndexedDB,
package names and export file names · route grammar and deep links · stacked dialogs.

## 7. Changed paths (`d396fa9..f1f3892`)

- Backend: `apps/api/app/main.py`; `apps/api/app/services/system_review/exports/{labels,docx,xlsx,pdf}.py`;
  tests `apps/api/tests/{test_aa_system_review_exports,test_health}.py`.
- Shell/Tasks: `apps/web/src/{App.jsx, components/Sidebar.jsx, pages/TasksPage.jsx, domain/tasks.ts}`,
  `apps/web/src/context/locale/{ru,uk}.js` (pin 1827 / 1826).
- Calendar: `apps/web/src/domain/calendarModel.ts`; `apps/web/src/pages/calendar/{CalendarPage.jsx,
  calendarRoute.js}`; **added** `calendarNav.js`, `TileGrids.jsx`, `DayDetails.jsx`; **removed**
  `CubeGrids.jsx`, `DayManagerModal.jsx`.
- Styles: `apps/web/src/styles/{tokens,shell,panels,pages-life,calendar-nav,finance-calendar,paradise,
  theme-light}.css` (cascade manifest unchanged: 14 layers).
- Tests: `apps/web/src/test/{jenkin-ui, calendar-ui, calendar-nav (new), calendar-model, calendar-rollover,
  calendar-source, calendar-day-details (renamed from calendar-day-manager), clarify-ui, locale-shape,
  tasks-g2}`.
- Docs (docs commit): this report, `LIFEOS_MASTER_CONTEXT.md`, `Outputs/architecture/module-boundaries.md`;
  screenshots `screenshots/jenkin-cloud-20260930/`.

## 8. Tests and gates (final code, `f1f3892`)

| Gate | Result |
|---|---|
| `npm test` (apps/web) | **822 passed / 54 files** (baseline 738 / 53) |
| `npm run typecheck` · `npm run lint` | PASS · PASS |
| `VITE_LIFEOS_ANALYTICS_ENABLED=true npm run build` | PASS |
| `git diff --check` | clean |
| Backend `pytest` (after the last backend change, `0730f84`; later commits are frontend-only) | **750 passed, 1 skipped** (baseline 748 + 1 skipped; +2 JENKIN tests) with `PGTZ=Europe/Kyiv` |
| `ruff check .` | All checks passed |
| `alembic heads` / `alembic current` (disposable `lifeos_test`) | `20260930_0009` / `20260930_0009` |

Focused behaviour tests added or rewritten: counted filter options RU/UK with fixed Kyiv day, empty
counts, sort separate + Escape wrapper, 13 px hierarchy and worded cues, toggle labels; account name/
email/sync/beige; material and contrast tokens (with WCAG maths on opaque light pairs); backend labels
and DOCX/XLSX/PDF metadata; Calendar navigation model (`calendar-nav.test.js`, 23 tests: levels,
cursor clamping incl. leap years, up/period/Today steps, bounds, breadcrumbs, arrow geometry, layout
storage); UI (twelve tiles, A 7 × 6, B panels for Feb 2026 / Feb 2028 / Aug 2026, B default, A/B
switch keeps route and data, toolbar separation, stage sizes, reduced motion, no animation-event
dependency, no fake data/events, History, focus policy, repeat-click guard, modifier arrows);
Day details actions; Kyiv rollover with explicit route and open editor.

Timezone note: with a UTC PostgreSQL session, the baseline already fails
`tests/test_aa_deletion.py::test_tombstone_clears_value_keeps_existence_and_retry_cannot_restore`
(`…Z` vs `…+00:00` isoformat). It passes with `PGTZ=Europe/Kyiv`, and the handoff's Mac run (748 + 1
skipped) passed as well. Pre-existing, unrelated to this work, not changed.

## 9. Browser verification

Environment: production `vite preview` (127.0.0.1:4173, build with analytics enabled) proxied to the
real API (`uvicorn`, 127.0.0.1:8000) on a disposable cloud **`lifeos_test`** at `20260930_0009`;
Playwright 1.56.1 + Chromium, `Europe/Kyiv`; a real bootstrapped account with a 71-character email
`owner.long.verification.address+jenkin-qa@subdomain.example-mailbox.com`; QA tasks seeded through the
real API relative to the Kyiv day (overdue, today with/without time, tomorrow, next week, undated,
completed, archived, closed unresolved, 2028-02-29, 2100-12-31, August 2026, previous year; two active
and one closed Waiting record). The Onest/Work Sans fonts were served to the browser from files fetched
through the verified proxy (Chromium here does not trust the proxy CA; TLS was never disabled).
All checks are automated browser checks unless marked otherwise.

### 9.1 Matrix — 40 / 40 PASS (520 page views, final build)

5 widths × 4 themes (dark, light, paradise-day, paradise-night) × RU/UK. Per configuration: Tasks
(7 options, each «label · N»; title and date 13 px; email ≥ 12 px and not clipped; the real sync text;
document title JENKIN; 0 horizontal overflow), then layouts **B and A** × years / months / October
(5 weeks) / August (6 weeks) / Day details / History: 0 document overflow, no visible panel text < 12 px,
one stage width per viewport, fixed stage height, A = 42 day tiles, B August = 6 × 7, 12 year and
12 month tiles.

| Width | Stage (all levels, both layouts) | Account block |
|---|---|---|
| 1440 | 1040 × 620 | email 12 px, 5 lines, unclipped; sync 12 px, own line |
| 1024 | 760 × 620 | same |
| 768 | 504 × 560 | same |
| 390 | 358 × auto | sidebar replaced by the mobile nav (carried) |
| 320 | 288 × auto | same |

### 9.2 Interaction checks (final build)

- Calendar keyboard/focus/geometry harness, **45 / 45** in each of 1440 dark RU, 1024 light UK,
  768 paradise-day RU, 390 paradise-night UK, 320 dark UK, and with reduced motion 1440 paradise-day UK
  and 390 light RU: stage stability, A/B switch, Escape chain with focus on the selected tile, no page
  scroll from focus, arrows on 12-tile grids by rendered columns, Enter, breadcrumbs, six-week August,
  B and A arrow geometry and edges, Day details heading focus, 31 Aug → 30 Sep clamp, repeatable
  «next», Back/Forward with focus, reload deep link, no focus theft on arrival, editor Escape and focus
  return, delete-confirmation Escape and focus return, Escape from `<body>`, spin vs reduced fade,
  no overflow.
- Calendar persistence flows **19 / 19** (real API): editor save keeps id and untouched date/time,
  reorder persists with focus kept, complete → History → Restore same id, close unresolved and archive
  → History → restore same ids, confirmed delete never in History, Quick Add prefilled and Escape closes
  only it, undated tasks absent.
- Tasks flows **11 / 11**: detail date move keeps the id and the Today count follows; the row reads
  «сегодня · 07:45»; completion persists with counts updated; Waiting received → count drops → restore
  same record; sort Escape.
- Tasks filter counts equal the rendered rows for all 7 options at 1440 dark RU, 390 paradise-day UK,
  320 light RU and 1024 paradise-night UK (0 overflow, 13 px / 500 and 13 px / 400).
- Kyiv rollover **9 / 9**: midnight timer with an explicit day route and an open editor draft; rows
  become overdue with «закрыть без выполнения»; Escape closes only the editor; Today opens the new
  day; visibilitychange and focus resume; the undated `#/calendar` follows the current month.
- Transition: all 12 tiles settle fully visible in all four themes.
- Review fixes **28 / 28**: second clicks (detail 2) on revealed Day details controls change nothing in
  A and B while single clicks still work; a real double click on Restore restores one task; Enter twice
  on «next month» moves two months with focus kept; Today, A/B and History keep focus; a breadcrumb and
  a bound-disabled «next» hand focus to a tile; Back with Quick Add open keeps focus in the dialog;
  modified arrows are not captured; sort Escape from the trigger; the Waiting eyebrow style; opaque
  History button in paradise day/night.

### 9.3 Not verified here

- The native `<select>` option list and native date/time pickers are OS-drawn (not capturable); in
  headless Chromium they format as en-US regardless of page locale.
- Screen-reader output (VoiceOver/NVDA) was not run; ARIA semantics are covered by tests.
- The editor's conflict choice (take saved / keep mine) was not re-exercised in the browser this session;
  the editor is unchanged and uses the same live-task wiring as before, covered by
  `editor-stale-draft.test.jsx`.
- Safari/WebKit and Firefox were not run (Chromium only).

### 9.4 Contrast (WCAG ratio, computed colours composited over their surfaces, 1440 px)

| Element | dark | light | paradise-day* | paradise-night* |
|---|---|---|---|---|
| unchecked task box edge (≥ 3) | 3.34 | 3.18 | 3.15 | 3.32 |
| task title | 16.52 | 18.12 | 14.77 | 15.17 |
| date | 5.52 | 4.73 | 5.48 | 7.95 |
| «сегодня» cue | 7.63 | 5.41 | 4.94 | 7.33 |
| «просрочено» cue | 4.60 | 5.45 | 4.99 | 6.61 |
| sync line (beige) | 9.72 | 5.46 | 5.04 | 9.64 |
| email | 10.78 | 12.95 | 6.90 | 11.93 |
| today numeral | 10.18 | 5.17 | 4.97 | 9.89 |
| weekday / week header | 5.05 / 5.41 | 4.52 / 4.70 | 5.52 / 5.93 | 7.36 / 7.88 |
| overdue badge (Day details) | 5.88 | 5.68 | 5.50 | 5.74 |

\* Paradise surfaces are ≥ 90 % opaque over a photo; the photo was approximated by a flat scene colour.

## 10. Screenshots

`screenshots/jenkin-cloud-20260930/` (JPEG, production preview + `lifeos_test`, final build):
`01-calendar-days-B-1440-dark-ru`, `02-calendar-days-A-1440-light-uk`, `03-calendar-years-1024-paradise-day-ru`,
`04-calendar-months-768-paradise-night-uk`, `05-calendar-day-details-1440-dark-ru`,
`06-calendar-history-1024-light-ru`, `07-calendar-days-B-six-weeks-768-dark-uk`,
`08-calendar-days-B-390-paradise-day-uk`, `09-calendar-days-A-320-dark-ru` (full page),
`10-calendar-editor-1440-paradise-night-ru`, `11-tasks-1440-dark-ru`, `12-tasks-390-paradise-day-uk`,
`13-tasks-320-light-ru`, `14-tasks-1024-paradise-night-uk`, `15-login-1024-ru`.

## 11. Bundle impact (`VITE_LIFEOS_ANALYTICS_ENABLED=true`, measured at `d396fa9` and `f1f3892`)

| Asset | Baseline | Final | Δ |
|---|---|---|---|
| `CalendarPage` chunk (lazy) | 19.84 kB (gzip 5.99) | 28.70 kB (gzip 8.76) | +8.86 kB (+2.77) |
| `index` JS | 381.41 kB (gzip 117.54) | 383.20 kB (gzip 118.21) | +1.79 kB (+0.67) |
| `index` CSS | 174.15 kB (gzip 30.29) | 184.67 kB (gzip 32.34) | +10.52 kB (+2.05) |

## 12. Dependencies and migrations

No dependency added, removed or upgraded (`package.json`, lockfiles unchanged); `npm audit fix` not run.
No migration; Alembic head stays `20260930_0009`. No snapshot/API/storage contract change; the only new
browser key is `lifeOsCalendarLayout` (device preference).

## 13. Independent review

A read-only review of `d396fa9..095be58` reported six issues; all were confirmed and fixed in `f1f3892`
with tests and browser checks (section 9.2): the second click of a double click acting on revealed Day
details/History controls; focus pulled into the stage after toolbar presses and behind an open Quick Add
on Back; Alt/Ctrl/⌘ + arrows captured; the Waiting dialog's `.cal-dialog-eyebrow` rule removed with the
old Day Manager CSS; translucent History button fills over the Paradise scene; sort Escape only inside
the list (and a listbox `aria-haspopup` on a disclosure). It found no correctness issue in the navigation
model, date math, counts, backend metadata or dialog stacking.

## 14. Limitations and follow-ups

- **Events DST requirement (future Events slice, not implemented):** On 25 October 2026 in
  Europe/Kyiv, start 03:30 UTC+02 and end 03:45 must not silently become end 04:30. Resolve ambiguous
  start and end independently, preserve entered wall-clock values and offset choices, and reject
  inconsistent chronology. Never repair an invalid end by silently assigning start + one hour.
- **`lifeos_dev` is behind:** the Mac `lifeos_dev` was verified at `20260721_0001` while the repository
  and `lifeos_test` are at `20260930_0009`. Not migrated; upgrading it is the owner's decision.
- Legacy tasks keep their stored tag chip, so a row can show a legacy «сегодня» chip next to the real
  cue «просрочено · 30 сент.» (G2: legacy tag/stakes/due are never date authority; data not rewritten).
- Year windows at the bounds are partial (e.g. 2098–2100, or a window starting at the earliest task year).
- The sidebar nav scrolls when a long email wraps to 5 lines on short viewports (carried behaviour).
- Not started: Events, Inbox/smart capture, authentication recovery/passkeys, Documents, BankID/Дія/HELSI
  or other integrations, phone-number-change automation, private-key storage.

## 15. Commit metadata (branch `handoff/jenkin-cloud-20260930`, author Claude, Kyiv time)

| SHA | Kyiv time | Subject |
|---|---|---|
| `0730f84cc5a54000c68795c906ac2107433431f3` | 2026-10-01 00:30 | feat(jenkin): shell material tokens, real account block, visible JENKIN output |
| `12043cf47231e5ca9d1c22a57ad28855d2586871` | 2026-10-01 00:36 | feat(tasks): compact JENKIN Tasks — counted filter, 13 px rows, worded date cues |
| `095be5809577cccee0bee7df8eae45944333f365` | 2026-10-01 00:58 | feat(calendar): nested JENKIN tile Calendar — Years → Months → Days (A/B) → Day details |
| `1594c4d93418480087635ce9dce8148ec3ffbd29` | 2026-10-01 01:16 | fix(jenkin): contrast floors measured in the browser across all four themes |
| `05c420a1dd075c6b368562269707adaf9a5c4ae9` | 2026-10-01 01:29 | fix(calendar): keep the stage text at the 12 px floor |
| `f1f38923d8004104e1830e0c71860b512fe855d4` | 2026-10-01 01:33 | fix(calendar,tasks): review hardening — repeat clicks, toolbar focus, modifier arrows, sort Escape |

The code commits were pushed normally and `origin/handoff/jenkin-cloud-20260930` was verified equal to
`f1f3892` before the docs commit. The docs commit (this report, master context §85, module boundaries,
screenshots) follows; its SHA and the final remote verification are in the session's final response.

## 16. Owner test on the Mac

```sh
cd /Users/yurasachenko/LifeOS/LifeOS_DesignSystem   # the canonical checkout; commit or park your own work first
git fetch origin handoff/jenkin-cloud-20260930
git switch handoff/jenkin-cloud-20260930             # creates the tracking branch on first use
git rev-parse HEAD                                   # must equal the pushed SHA from the final response
cd apps/web
npm ci                                               # no dependency changed; skip if node_modules is current
npm test && npm run typecheck && npm run lint && VITE_LIFEOS_ANALYTICS_ENABLED=true npm run build
# API on lifeos_test ONLY (lifeos_dev is still at 20260721_0001): in apps/api, with LIFEOS_DATABASE_URL
# pointing at lifeos_test (shell export or the ignored .env), check the schema, then serve:
cd ../api && .venv/bin/alembic current                # expect 20260930_0009
.venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
# second terminal:
cd /Users/yurasachenko/LifeOS/LifeOS_DesignSystem/apps/web && VITE_LIFEOS_ANALYTICS_ENABLED=true npm run dev
# open http://127.0.0.1:5173/#/calendar (then #/calendar/years, #/calendar/history, #/tasks)
```

Optional backend gate on the Mac (integration tests skip unless `LIFEOS_TEST_DATABASE_URL` points at `lifeos_test`): `cd apps/api && .venv/bin/python -m pytest && .venv/bin/ruff check . && .venv/bin/alembic heads`.
