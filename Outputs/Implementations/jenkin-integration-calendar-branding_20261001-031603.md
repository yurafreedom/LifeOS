# JENKIN integration: nested Calendar, shell and Tasks + Editorial branding and optional DejaVu Sans

Date: 2026-10-01 (Europe/Kyiv) · Integration branch `integration/jenkin-calendar-branding-20261001`
Status: **integrated, verified, committed and pushed to the integration branch.** Not merged, not deployed,
no PR. Both input branches and `main` were not written to.

## 1. Inputs (fetched and verified live before integrating)

| Input | Branch | Tip |
|---|---|---|
| Nested Calendar, shell materials, compact Tasks | `handoff/jenkin-cloud-20260930` | `1e130cb336c0bef0940553a0a15eece40f2bf6ec` (as reported) |
| Editorial logo, favicon, optional DejaVu Sans | `feat/jenkin-branding-assets-20261001` | `727e65862c874f7f45c3dc694b80050a3d0dc835` (reported `727e658`) |
| Merge base | — | `0730f84cc5a54000c68795c906ac2107433431f3` (as reported) |
| `origin/main` | `main` | `5e858bb0322be0cc729d3d7e73ce359597aada84` (unchanged; ancestor of both) |

Read before integrating: `AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md`, `JENKIN_CLOUD_HANDOFF.md`,
`JENKIN_CLOUD_TASK.md`, `JENKIN_BRANDING_HANDOFF.md`,
`Outputs/Implementations/jenkin-cloud-shell-tasks-calendar_20261001-013804.md`,
`Outputs/Implementations/jenkin-branding-logo-favicon-font_20261001.md`,
`Outputs/architecture/module-boundaries.md`. The cloud checkout (`git rev-parse --show-toplevel` →
`/home/user/LifeOS`) was clean on `handoff/jenkin-cloud-20260930` = `1e130cb`; no integration branch
existed locally or remotely; the cloud clone has no stash and none was manufactured.

## 2. Integration and conflict resolution

`integration/jenkin-calendar-branding-20261001` was created from `1e130cb`, and `727e658` was merged with a
normal `--no-ff` merge — **`0704970`**, parents `1e130cb` + `727e658`. Both histories are preserved; nothing
was replayed, squashed or rebased, and no whole-file ours/theirs choice was used.

- **Textual conflicts (two).**
  - `apps/web/src/test/locale-shape.test.ts` — pins recomputed from the merged dictionaries: **ru 1832 /
    uk 1831** (Calendar +8 keys, branding +5 `set_font*`, no shared key name). The parity contract (uk ⊂ ru,
    only `today_date_uppercase` ru-only) is unchanged and the test passes on it.
  - `LIFEOS_MASTER_CONTEXT.md` — both sessions appended a §85. The Calendar entry stays **§85** (the header,
    §65 and the §84 note point to it); the branding entry, which itself anticipated renumbering, is **§86**
    with its text verbatim plus an integration note (its report still says §85). **§87** is the reconciled
    integrated state.
- **Auto-merged and reviewed by hand:** `module-boundaries.md` (branding paragraph next to
  `lifeOsCalendarLayout`), `ru.js` / `uk.js`, `jenkin-ui.test.jsx` (wordmark and login assertions).
- An independent read-only review confirmed: every file changed by only one side is byte-identical to that
  side's tip; `pages/calendar/*`, `domain/*`, `TasksPage.jsx` and `App.jsx` equal the Calendar tip (focus
  policy, repeat-click guard, editor drafts, counts untouched); the Sidebar account block is unchanged
  next to the Editorial logo; no fix of either branch was lost.

## 3. Integration fixes (after the merge)

| Commit | Fix |
|---|---|
| `40fe3b5` | **Typography × nested Calendar.** `brand.css` still overrode `.cal-h`, `.cal-cube-num`, `.cal-cube-name` (retired cube markup). Removed; `.cal-dialog-h` now uses `var(--font-display)`, so the whole nested Calendar (headings, tiles, week panels, day details, toolbar, editor) follows the interface font through the tokens. The coverage test is now **two-way** — every hardcoded Onest / Work Sans selector has an override *and* every override still matches one (mutation-checked with a re-added cube override) — plus a test that Calendar font declarations are tokens only (mutation-checked with a literal family). 17 display + 26 body overrides remain. Dead CSS removed after confirming no consumer: `.sb-logo-dot` (+ light / paradise-day), light `.logo-dot` / tspan fills, paradise-day `.logo-word`, and the text-only `.auth-brand` typography. `--font-mono` and `.mono` untouched; no universal selector, `body *` or `!important`. |
| `a051e43` | **Recorded focus gaps.** Login inputs: `outline: 2px solid var(--accent)` was invalid because `--accent` is a gradient → `var(--primary)`. Task-dialog title `.qa-title`: `outline: none` with no replacement → `:focus-visible` primary underline (border colour + 1 px shadow, no clipping, no layout shift). TopBar search: the 45 % translucent edge (≈ 1.3:1) → solid `var(--primary)` plus the theme's `--primary-focus-shadow`; the light-only translucent override removed. |
| `c35eeda` | **Calendar tiles on phone panels** (found by the integrated browser checks and the review). Tiles clip with `overflow: hidden`; at 320–340 px both fonts cut year numerals (up to 10.8 px), month names and two-digit layout-A days; at 360–390 px DejaVu cut the longer month names. Under a 380 px panel, years and months use two columns and layout A uses a 4 px inset with a 15 px numeral. |
| `b19fc71` | **Brand control focus.** The logo ring used the amber point everywhere: 9:1 on dark, but 1.99:1 on the light sidebar and ≈1.4:1 on Paradise day. `--jenkin-focus` keeps the amber on dark surfaces and uses `--o3` (#B14808) on light / Paradise day. The mark's amber point is unchanged. |

## 4. Integrated behaviour

**Shell** — visible JENKIN branding: the outlined Editorial wordmark (expanded sidebar, login) and the serif J
with its amber point (collapsed sidebar), `currentColor` ink #F6EFE4 on dark / Paradise night and #252A2B on
light / Paradise day, hover-only glow, reduced-motion safe, `aria-label="JENKIN"`; the adapted favicon set
(ICO 16/32/48, SVG, 180 px apple-touch). Unchanged navigation destinations, mobile navigation, the four
themes, matte/satin materials, the account block (profile name only if entered, the real email at 12 px on
its own wrapping line, the real saved / saving / offline / conflict / error phase on a warm-beige line) and
all compatibility identifiers (`lifeOs*`, `lifeos-*`, `LIFEOS_*`, `@life-os/web`).

**Interface font** — Settings → Appearance: **Current** (default; Onest / Work Sans) or **DejaVu Sans**,
with a localized preview (RU Ёё, UK Іі Її Єє Ґґ, digits). Device-local `localStorage.lifeOsFont` (only
`dejavu` is stored; anything else is Current), applied as `<html data-font>` before first paint. The font
never changes the outlined logo. The four approved WOFF faces load lazily; sources and licences are kept in
`design-references/jenkin-branding/` and `apps/web/src/assets/fonts/dejavu-sans/`.

**Tasks** — one counted filter dropdown sharing its pipeline with the rows, separate sorting, 13 px title/
date hierarchy, worded today/overdue cues; `schedule.date` authority, Kyiv Today / Overdue, undated
exclusion, Waiting G1 lifecycle, archive / close unresolved / restore with the same id / confirmed delete.

**Calendar** — Years → Months → Days (layout B default, A alternative, device-local validated preference)
→ Day details; clickable breadcrumbs; separate previous / Today / next / History; stable stage 620 / 560 /
auto; real counts and lifecycle History; clamping, leap years, five/six-week months, bounds, deep links,
Back/Forward; geometry-aware arrows, Escape, the toolbar/tile/dialog focus policy, the double-click guard;
live Kyiv midnight and foreground updates; reduced-motion fade; editor dirty-field saves, untouched-field
rebasing and explicit conflict resolution. Phone panels (< 380 px) show years/months in two columns.

**Known font facts (unchanged, documented):** Google's Work Sans has no Cyrillic, so under Current,
Cyrillic body text and all `.mono` text render in the OS fallback (macOS: the system UI font); under DejaVu
the `.mono` role (dates, counts, the sync line, field labels, Today, History dates) keeps `--font-mono` and
the same OS fallback for Cyrillic. No new `.mono` fallback policy was added (the branding report's open
owner decision stands).

## 5. Changed paths

Integration commits (`1e130cb..HEAD`, besides the merged branding history):
- `40fe3b5`: `apps/web/src/brand.css`, `apps/web/src/styles/{finance-calendar,shell,theme-light,paradise}.css`,
  `apps/web/src/test/jenkin-branding.test.jsx`
- `a051e43`: `apps/web/src/styles/{modals,paradise,shell,theme-light}.css`, `apps/web/src/test/jenkin-ui.test.jsx`
- `c35eeda`: `apps/web/src/styles/finance-calendar.css`, `apps/web/src/test/calendar-ui.test.jsx`
- `b19fc71`: `apps/web/src/brand.css`, `apps/web/src/test/jenkin-branding.test.jsx`
- docs commit: this report, `LIFEOS_MASTER_CONTEXT.md`, `Outputs/architecture/module-boundaries.md`,
  `Outputs/Implementations/jenkin-integration_20261001/**`

Merged from the branding branch (unchanged): `JENKIN_BRANDING_HANDOFF.md`, `design-references/jenkin-branding/**`,
`apps/web/{index.html, public/assets/favicon.{svg,ico}, public/assets/apple-touch-icon.png}`,
`apps/web/src/{brand.css, app/useInterfaceFont.js, components/JenkinBrand.jsx, assets/fonts/dejavu-sans/**}`,
`apps/web/src/{components/Sidebar.jsx, components/SettingsPage.jsx, pages/LoginPage.jsx, main.jsx}`,
`apps/web/src/context/locale/{ru,uk}.js`, `apps/web/src/test/jenkin-branding.test.jsx`, the branding report and
its `Outputs/Implementations/jenkin-branding_20261001/` artifacts. No backend, dependency, migration,
snapshot, API, cookie, storage-key or export-name change in the integration.

## 6. Automated results (final HEAD of code: `b19fc71`)

| Gate | Result |
|---|---|
| `npm test` (apps/web) | **PASS — 849 tests / 55 files** (raw merge: 842 / 55) |
| `npm run typecheck` · `npm run lint` | PASS · PASS |
| `VITE_LIFEOS_ANALYTICS_ENABLED=true npm run build` | PASS — CSS 188.30 kB (gzip 33.04), index JS 385.58 kB (gzip 119.20), CalendarPage 28.70 kB (gzip 8.76); four DejaVu WOFF faces emitted, loaded only when used |
| `git diff --check` | clean |
| `ruff check .` (apps/api) | PASS |
| `alembic heads` / `alembic current` (disposable `lifeos_test`) | `20260930_0009` / `20260930_0009` |
| `pytest` (apps/api), session zone **Europe/Kyiv** | **PASS — 750 passed, 1 skipped** |
| `pytest` (apps/api), session zone **UTC** | **FAIL — 748 passed, 2 failed, 1 skipped** (pre-existing, see 6.1) |

The backend is byte-identical between `a051e43` (where the suites ran) and `b19fc71`; the integration has no
backend change beyond `0730f84` (visible JENKIN API title and export metadata, covered by
`test_api_metadata_names_the_product_jenkin` and `test_export_labels_name_the_product_jenkin`, both passing).

### 6.1 Timestamp failures — investigated

Environment: PostgreSQL 16.13, server default `TimeZone = Etc/UTC`; the session zone was set explicitly with
libpq `PGTZ`; `LIFEOS_TEST_DATABASE_URL` → `lifeos_test` on 127.0.0.1:5432. No backend default or contract
was changed.

| Tree | `PGTZ` | When (UTC) | UTC date vs Kyiv date | Result |
|---|---|---|---|---|
| integration (`a051e43`) | UTC | 2026-09-30 23:01–23:08 | differ | 748 passed, **2 failed**, 1 skipped |
| integration (`a051e43`) | Europe/Kyiv | 23:08–23:16 | differ | 750 passed, 1 skipped |
| baseline `d396fa9` | UTC | 23:34–23:42 | differ | 746 passed, **2 failed (the same two)**, 1 skipped |
| baseline `d396fa9` | Europe/Kyiv | 23:42–23:51 | differ | 748 passed, 1 skipped |
| integration (`b19fc71`) — control | UTC | 2026-10-01 00:05–00:14 | **equal** | 748 passed, **2 failed (the same two)**, 1 skipped |

(The baseline has two tests fewer: the two JENKIN metadata tests added in `0730f84`.) The two failing tests,
their fixtures and every code path they exercise are byte-identical at `d396fa9` and HEAD.

1. `tests/test_aa_deletion.py::test_tombstone_clears_value_keeps_existence_and_retry_cannot_restore` —
   **serialization representation.** It compares `row.recorded_at.isoformat()` from its own DB session with the
   API's JSON `recorded_at`. With a UTC session psycopg returns `+00:00` while Pydantic serializes the same UTC
   instant as `Z` (`'2026-09-30T23:01:10.200122+00:00' == '2026-09-30T23:01:10.200122Z'` fails). Same instant;
   with a non-UTC session both sides use the same offset and it passes.
2. `tests/test_aa_legacy_import.py::test_legacy_import_is_honest_idempotent_and_does_not_backfill_other_layers`
   — **calendar-day extraction in the session zone.** The import stores the legacy date 2026-08-10 as Kyiv
   midnight (`datetime.combine(date, time.min, tzinfo=ZoneInfo("Europe/Kyiv"))` = 2026-08-09 21:00 UTC).
   The test takes `row.occurred_at.date()` in the session zone: UTC gives `'2026-08-09' != '2026-08-10'`.
   The stored instant is correct; the assertion is zone-dependent.

Both are **deterministic for a UTC session at any time of day** (the post-midnight control shows the same
result) and **pre-existing** (identical on the unchanged baseline). The branding report's "the run crossed
midnight Kyiv" explanation and the Calendar report's mention of only the tombstone test were incomplete.
They are outside this integration's scope and remain open: a test-side fix (compare instants, or take the
date in Europe/Kyiv) is a separate decision. The suite passes completely with a Kyiv session zone.

## 7. Browser verification (production build + real API on disposable `lifeos_test`)

Environment: `vite preview` of the analytics-enabled production build (127.0.0.1:4173, `/api` proxied to
`uvicorn` on 127.0.0.1:8000 at `20260930_0009`), Playwright 1.56.1 / Chromium 1194 headless shell,
`Europe/Kyiv`, a real account with a 71-character email, data seeded through the real `PUT /api/v1/state`
relative to the Kyiv day (overdue, today with/without time, tomorrow, next week, undated, completed,
archived, closed unresolved, 2028-02-29, 2100-12-31, August 2026, previous year, a long Ukrainian/Russian title
«Ёлка і Їжак: перевірити Іі Її Єє Ґґ та Ёё — … Надзвичайнодовгенеперервнеслово», two active and one closed
Waiting record). Google Fonts (Current) were served to Chromium from files fetched with `curl` through the
verified proxy (Chromium here does not trust the proxy CA); TLS was never disabled. **No mocked API was
used.** One harness-only step is noted under editor concurrency.

| Check (all on the final build) | Result |
|---|---|
| Combined matrix: Current/DejaVu × RU/UK × dark/light/Paradise day/night × 1440/1024/768/390/320 (80 configurations, 960 Calendar views): Tasks counts format, 13 px rows, long title, email ≥ 12 px unclipped, real sync text, `data-font`, wordmark (6 paths, no text, correct ink), collapsed sidebar J mark (22 px, point, no account block) or mobile nav, Settings → Appearance (control state, localized preview), Calendar B and A at years / months / 5- and 6-week days / day details / History: 0 document overflow, no text < 12 px, stable stage 1040/760/504/358/288 px wide, 620/620/560/auto/auto high | **PASS 80/80**; wordmark 98.3 × 20 px under both fonts in every theme at 1440/1024/768 (phones show the mobile nav instead) |
| Glyph rendering (CDP `getPlatformFontsForNode`, 598 nodes: shell, Tasks, every Calendar level, Day details, editor, History, Settings, login; both fonts × RU/UK × four themes) | **PASS, 0 unexpected.** Under DejaVu every non-mono node — including І Ї Є Ґ and Ё in the long title, Calendar headings, tiles, week panels, day details and editor — is drawn by **DejaVu Sans [web]** (not the OS copy, which is also installed here); mono nodes keep Work Sans [web] + OS fallback; under Current display text is Onest [web] |
| Phone tile clipping (17 widths 320–1440 × RU/UK × both fonts; years, months, days A/B, day details; repeated at 10 widths in the final batch) | **PASS 68/68 and 40/40** after `c35eeda` (before: clipping at 320–390 px) |
| Keyboard focus by real Tab/Shift+Tab: login inputs, TopBar search, task-dialog title (4 themes × 2 fonts × 1440/390) | **PASS 16/16** — 3.43–6.26:1, 0 px shift |
| Logo focus ring (4 themes × expanded/collapsed × 2 fonts) | **PASS 16/16** after `b19fc71` — 3.81–9.11:1 (before: 1.99 / 1.37 on light / Paradise day) |
| Font preference: default Current, switch to DejaVu (applies at once, stores the key, logo unchanged), reload (attribute set by `index.html` before the app mounts), switch back (attribute and key removed), reload; favicon links (ICO 32, SVG, apple-touch 180) served with correct types; UK login reached by switching to UK and logging out | **PASS 19/19** |
| Calendar keyboard/focus/geometry harness (45 checks each) in 1440 dark RU Current, 1440 light UK DejaVu, 1024 Paradise-day RU DejaVu, 768 Paradise-night UK Current, 390 dark UK DejaVu, 320 light RU Current, and with reduced motion 1440 Paradise-night RU DejaVu and 390 Paradise-day UK Current | **PASS 8 × 45/45** |
| Persistence flows, both fonts: edit/reorder/complete → History → restore same id, close unresolved / archive → restore, confirmed delete never in History, Quick Add prefilled, undated absent (19 each); Tasks date move + Today count, completion counts, Waiting received → restore same record, sort Escape (11 each) | **PASS 2 × 19/19, 2 × 11/11** |
| Filter counts equal rendered rows for all 7 options (1440 dark RU DejaVu, 390 Paradise-day UK DejaVu, 320 light RU Current, 1024 Paradise-night UK Current) | **PASS 4/4** |
| Editor concurrency, both fonts (28 checks each, below) | **PASS 2 × 28/28** |
| Kyiv midnight / foreground rollover with an explicit day route and an open editor draft (DejaVu) | **PASS 9/9** |
| Review-hardening re-check: double clicks, toolbar focus, Back with Quick Add open, modified arrows, sort Escape, Waiting eyebrow, opaque History button (DejaVu) | **PASS 28/28** |
| Tile transition settles in all four themes (DejaVu) | **PASS** |

**Editor concurrency.** The supported production path for an external change is: another session writes
the task through `PUT /api/v1/state` with the current revision, and this tab adopts the server snapshot
through `LifeDataContext.reloadServerState()` — the function behind Settings «reload from server». That
control cannot be reached while the editor dialog is open, so the harness invoked the same production
function through the React tree (**the only harness-driven step**). Verified in the Calendar editor:
an external title change to an untouched field rebases into the open form and survives my notes save
(date/time intact); a same-field conflict shows the notice with the saved value, saves nothing, keeps the
draft; «взять сохранённое» fills the saved value and keeps the editor open; «оставить моё» saves my value
over the external one (same id, one copy); a schedule edit over an externally changed time reports a
conflict and «take saved» restores date + time as one unit; Escape closes only the editor. The same
rebase and «keep mine» were verified in the Tasks detail editor.

**Not verified / limitations of the environment:**
- Chromium only. Firefox and WebKit are not installed, and installing them (`playwright install`) is
  not allowed in this environment.
- No screen reader was run. Native pickers and option lists are OS-drawn, and in headless Chromium they
  format in en-US.
- Headless Chromium does not request favicons on load. It also refuses an in-page fetch of the exact URL
  `/assets/favicon.ico`, so the check fetched each linked icon with a query string. Their presence in a
  real browser tab was not observed.
- Google Fonts were served to the browser from files fetched with curl, as described above.

## 8. Screenshots and verification artifacts

`Outputs/Implementations/jenkin-integration_20261001/screenshots/` (JPEG, production build + `lifeos_test`):
`01-calendar-days-B-1440-dark-ru-dejavu`, `02-calendar-days-B-1440-dark-ru-current`,
`03-calendar-days-A-1440-light-uk-dejavu`, `04-calendar-years-1024-paradise-day-uk-dejavu`,
`05-calendar-months-768-paradise-night-ru-current`, `06-calendar-day-details-1440-paradise-day-uk-dejavu`,
`07-calendar-editor-1440-dark-ru-dejavu`, `08-calendar-history-1024-light-ru-dejavu`,
`09-calendar-days-A-390-dark-uk-dejavu` (full page), `10-calendar-days-B-320-paradise-day-ru-current`,
`11-tasks-1440-dark-uk-dejavu`, `12-tasks-390-light-ru-current`,
`13-settings-appearance-1440-paradise-night-uk-dejavu`, `14-settings-appearance-1024-light-ru-current`,
`15-sidebar-collapsed-1440-light-ru-dejavu`, `16-focus-search-1440-paradise-day-ru-current`,
`17-focus-task-title-1440-dark-uk-dejavu`, `18-login-1024-dark-ru-current` (keyboard focus on the email
field), `19-login-390-paradise-night-ru-dejavu`.

Verification artifacts in `Outputs/Implementations/jenkin-integration_20261001/`:
- `results/browser-summary.txt` — one line per browser step with its exit status;
- `results/browser-logs.tar.gz` — every step's raw output;
- `results/combined-matrix-result.json.gz` and `results/glyph-check-result.json.gz` — per-configuration and
  per-node data;
- `results/backend-timezone-runs.txt` — the five backend runs, plus ruff/alembic;
- `results/tile-clip-17-widths.txt` — the phone-clipping re-measurement after `c35eeda`;
- `qa/` — the Playwright harness. It is sandbox-specific: it expects the preview on 127.0.0.1:4173, the API
  on 127.0.0.1:8000, and test credentials read at run time from a scratch directory that is not committed.

## 9. Remaining limitations and open items

- Backend: the two UTC-session test failures in 6.1 are pre-existing and open; the suite passes with a
  Europe/Kyiv session zone.
- `lifeos_dev` on the owner's Mac remains at `20260721_0001` (not migrated; owner decision).
- Owner decision still open from the branding report: whether `.mono` should gain DejaVu Sans as its
  Cyrillic fallback under the DejaVu preference (not changed here).
- Pre-existing, observed, not changed (out of scope): `.auth-link { color: var(--accent) }` has the same
  gradient-as-colour root cause as the old login outline (the link renders in the inherited text colour);
  `.set-font-sample-label` is 11 px; legacy tag chips can sit next to the real date cue; the branding
  branch's `verify-font-matrix.cjs` still samples the retired cube Calendar (historical artifact).
- Future slices remain unstarted: Events (with the recorded DST requirement — on 25 October 2026 in
  Europe/Kyiv, start 03:30 UTC+02 and end 03:45 must not silently become 04:30; resolve start/end
  ambiguity independently, preserve entered values, reject inconsistent chronology), smart capture, auth
  recovery/passkeys, BankID/Дія, Documents, HELSI, phone-change automation, private-key storage. Quick
  Notes, Clarify and authentication are unchanged.

## 10. Commits (branch `integration/jenkin-calendar-branding-20261001`)

| SHA | Subject |
|---|---|
| `07049701698aa220769890c14e6040b036fb969b` | Merge JENKIN branding (Editorial logo, favicon, optional DejaVu Sans) into the Calendar integration |
| `40fe3b598a01d184ccf1a840e1998023cd5bbe19` | fix(brand): reconcile the DejaVu Sans overrides with the nested Calendar; drop dead logo CSS |
| `a051e4334acec348c061f020413122e0d45ec2c6` | fix(a11y): visible keyboard focus for the task title, login inputs and TopBar search |
| `c35eeda62e2028b534e6403a154df69b4b8d7dd3` | fix(calendar): keep years, month names and day numbers inside their tiles on phone panels |
| `b19fc71f07c2bc9d1c081a9bcb46b5b64798f76a` | fix(brand): logo focus ring holds 3:1 on the light sidebars |
| docs commit | this report, master context §86 note + §87, module boundaries, screenshots and artifacts (SHA in the final response) |

## 11. Owner testing on the Mac (safe with a dirty or staged canonical checkout)

Nothing below switches, resets, cleans, stashes or rewrites the canonical checkout, its index, its local
branches or the recovery stash. A separate disposable worktree is used because the canonical checkout may be
dirty or staged, and `git fetch` + `git switch` would not update an existing local branch of the same name.

```sh
# 0 · in the canonical checkout (AGENTS.md path); its state is not touched
CANON="<your canonical LifeOS_DesignSystem checkout>"
cd "$CANON"
git fetch origin integration/jenkin-calendar-branding-20261001
git rev-parse FETCH_HEAD          # must print the SHA from the final response

# 1 · a separate detached test worktree next to it (no local branch is created or moved)
git worktree add --detach ../LifeOS-jenkin-integration-test FETCH_HEAD
cd ../LifeOS-jenkin-integration-test
git rev-parse HEAD                # same SHA

# 2 · frontend gates
cd apps/web
npm ci
npm test && npm run typecheck && npm run lint && VITE_LIFEOS_ANALYTICS_ENABLED=true npm run build

# 3 · API on lifeos_test ONLY — explicit environment; the worktree has no .env, and these
#     exports override any .env (which may point to lifeos_dev)
cd ../api
export LIFEOS_ENVIRONMENT=development
export LIFEOS_DATABASE_URL='postgresql+psycopg://<test-user>:<test-password>@127.0.0.1:5432/lifeos_test'
export LIFEOS_TEST_DATABASE_URL="$LIFEOS_DATABASE_URL"
export LIFEOS_BOOTSTRAP_TOKEN='<any local token of 32+ characters>'
export LIFEOS_ALLOWED_HOSTS='["localhost","127.0.0.1"]'
export LIFEOS_ALLOWED_ORIGINS='["http://localhost:5173","http://127.0.0.1:5173"]'
export LIFEOS_COOKIE_SECURE=false
PY="$CANON/apps/api/.venv/bin"    # no Python dependency changed, so the existing venv is reused
"$PY/alembic" current             # must print 20260930_0009 for lifeos_test; stop if it names another database
# optional backend suite — it TRUNCATES the lifeos_test tables, so run it before creating the
# browser test account; PGTZ=Europe/Kyiv gives the fully green run (see 6.1)
PGTZ=Europe/Kyiv "$PY/python" -m pytest
"$PY/uvicorn" app.main:create_app --factory --host 127.0.0.1 --port 8000

# 4 · second terminal: the app
cd "$CANON/../LifeOS-jenkin-integration-test/apps/web"
VITE_LIFEOS_ANALYTICS_ENABLED=true npm run dev
# open http://localhost:5173/#/calendar — then #/calendar/years, #/calendar/history, #/tasks,
# Settings → оформление → шрифт интерфейса (текущий / DejaVu Sans).
# No account in lifeos_test yet (or after pytest)? Create one at http://localhost:5173/?bootstrap=1
# with the LIFEOS_BOOTSTRAP_TOKEN value exported above.

# 5 · afterwards, remove only the test worktree (the canonical checkout is untouched)
cd "$CANON" && git worktree remove ../LifeOS-jenkin-integration-test
```
