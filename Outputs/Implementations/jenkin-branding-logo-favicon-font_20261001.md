# JENKIN branding: Editorial logo, favicon, optional DejaVu Sans

Date: 2026-10-01 (Europe/Kyiv) · Branch: `feat/jenkin-branding-assets-20261001`
· Base: asset commit `2e1df765bd57718c7673aaade1c98484f9f5e049`

Spec: `JENKIN_BRANDING_HANDOFF.md` §3 (owner-approved decisions). This was a
parallel, branding-only session. The shell/materials, Tasks and nested
Calendar work belongs to the session on `handoff/jenkin-cloud-20260930`.
Nothing from that branch was merged or cherry-picked here, and nothing was
pushed to it or to `main`.

## Commits

| Commit | Scope |
|---|---|
| `acb513d` | `feat(brand)`: Editorial logo in the sidebar and login, serif J mark, and favicon set |
| `61722fe` | `feat(settings)`: optional DejaVu Sans interface font |
| `14b5b40` | `docs`: implementation report and module-boundaries entry |
| `af44927` | `fix(font)`: narrow DejaVu scope, keep `--font-mono`, Appearance preview, 768 px TopBar wrap, full verification matrix, screenshots, master context §85 |

## What changed

### Editorial logo (decisions 1–4, 9)

- `apps/web/src/components/JenkinBrand.jsx` adds `JenkinWordmark` and
  `JenkinMark`. The six glyph outlines and the glyph transform are copied
  verbatim from `01-editorial-currentcolor.svg`. The J outline is shared with
  `jenkin-icon.svg`, and a test checks that both match the reference SVG.
  The viewBoxes are cropped to the glyph bounds. Ink is `currentColor`, and
  there is no `<text>` element and no font dependency, so the marks never
  follow the interface font.
- Sidebar: the expanded sidebar shows the wordmark (20 px tall). The collapsed
  sidebar shows the serif J with its amber point (22 px), replacing the orange
  dot. The home button keeps its `aria-label="JENKIN"`, and the SVG is
  `aria-hidden` / `focusable="false"`.
- Login: `.auth-brand` renders the wordmark (30 px) with `role="img"` and
  `aria-label="JENKIN"`.
- `apps/web/src/brand.css` sets `--jenkin-ink` from the approved variants:
  `#F6EFE4` (light ink) on dark and Paradise night, and `#252A2B` (dark ink)
  on light and Paradise day. It adds the hover-only glow from `logo-effects.css`
  and a visible `:focus-visible` outline, and turns the transition off under
  `prefers-reduced-motion`. There is no permanent glow and no animation.
- `brand.css` is imported by `main.jsx` right after `styles.css`. It follows
  the `analytics.css` precedent: the pinned 14-layer manifest
  (`styles-manifest.test.js`) is unchanged.

### Favicon (decision 5)

The approved 512 px J was adapted for small sizes instead of being used as-is.
Changes: a full-bleed `#171B1D` tile, the J enlarged 12 % about the centre with
a 30-unit stroke to thicken the hairlines, and the amber point enlarged from
r=5 to r=10. Renders were compared at 16, 32, 48 and 64 px against the source:
the source J and its point almost disappear at 16 px, while the adaptation stays
legible.

- `public/assets/favicon.svg`: adapted SVG (it replaces the old orange-dot
  favicon).
- `public/assets/favicon.ico`: 16, 32 and 48 px, rasterised from the SVG in
  Chromium.
- `public/assets/apple-touch-icon.png`: 180 × 180, square (iOS applies its
  own mask).
- `index.html` links the ICO (`sizes="32x32"`), the SVG and the apple-touch
  icon.

### Optional DejaVu Sans (decisions 6–8, 10–11)

- `app/useInterfaceFont.js` provides `normalize`, `read`, `write` and `apply`
  helpers plus the `useInterfaceFont()` hook. It is a device-local
  preference, following the same pattern as theme, scene and sidebar:
  - It is stored in `localStorage.lifeOsFont`, only when the value is
    `'dejavu'`. Choosing Current removes the key.
  - Anything else, or storage that cannot be read, falls back to `'current'`.
  - There is no backend field, snapshot field, migration or server-schema
    change.
- `index.html` sets `<html data-font="dejavu">` before first paint.
- Settings → Appearance → "шрифт интерфейса" / "шрифт інтерфейсу" is a
  segmented control with the choices **текущий/поточний** (default) and
  **DejaVu Sans**. It is an accessible `role="group"` with `aria-pressed`
  buttons.
- **Scope (corrected 2026-10-01).** The first pass redefined `--font-mono` and
  forced `font-family: "DejaVu Sans" !important` on `body *`. It now works
  like this:
  - `:root[data-font="dejavu"]` re-points only `--font-display` and
    `--font-body`. Body text, buttons and inputs follow through
    `font: inherit`.
  - The 47 selectors in `styles/*.css` and `analytics.css` that name `'Onest'`
    (21, display role) or `'Work Sans'` (26, body role) directly each get a
    scoped `:root[data-font="dejavu"] <selector>` override to the matching
    token. The paradise tooltip `::after` is included.
    `jenkin-branding.test.jsx` scans every stylesheet and fails if a new
    hardcoded selector has no override (mutation-checked).
  - `--font-mono` (the `.mono` role: labels, counts, dates, tabular numbers)
    is **unchanged**. `:root[data-font="dejavu"] .mono` restores it for the
    one case where an element is both a hardcoded selector and `.mono`
    (`.set-input.mono`).
  - There is no universal selector, no `body` rule and no `!important`; the
    test pins all three.
  - The repository has no true monospace (`monospace`) declarations and no
    icon fonts; all icons are inline SVG. There was nothing else to preserve.
  - At tablet widths in dark/light, DejaVu's wider 40 px greeting pushed the
    non-wrapping TopBar 5 px (RU) or 15 px (UK) past the viewport at 768 px.
    It is fixed with a DejaVu-scoped `.tb { flex-wrap: wrap }` /
    `.tb-right { margin-left: auto }` at ≥641 px, the same fix
    `paradise.css` already uses. Current is unchanged.
- **Appearance preview.** A "предпросмотр" / "попередній перегляд" row shows
  one localized sample in each face, labelled with the option names. Each
  sample renders in its own face whatever the active preference is.
  - RU sample: «Съешь же ещё этих мягких французских булок, да выпей чаю.
    Ёё · 0123456789».
  - UK sample: «Чуєш їх, доцю, га? Кумедна ж ти, прощайся без ґольфів!
    Іі Її Єє Ґґ · 0123456789».
  - The samples carry `lang`. Adds `set_font_preview` and `set_font_sample`;
    the locale pin is now ru 1824 / uk 1823.
- `brand.css` declares the four WOFF faces with `font-display: swap`.
- `src/assets/fonts/dejavu-sans/` holds byte-identical copies of the four
  approved WOFF files plus `LICENSE`. A scoped `.gitattributes` keeps the
  license's historical trailing space exact, and a README records where the
  files came from. The source-reference package in `design-references/` is
  untouched.
- Vite fingerprints the WOFF files. The browser downloads a face only when
  something uses it:
  - Under Current, Home, Tasks, Calendar and Settings → Account request no
    DejaVu file.
  - Opening Settings → Appearance requests only `DejaVuSans-*.woff` (Regular),
    for the preview (verified).
  - With DejaVu selected, only the weights in use load.

## Verification

### Gates (after the 2026-10-01 corrections)

Frontend, run in `apps/web`:

| Check | Result |
|---|---|
| `npm test` | 54 files, **768 tests passed** |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | built; the four DejaVu WOFF files are emitted and referenced from the CSS |
| `git diff --check` / `--cached --check` | clean |

Backend, run in `apps/api` against a local Postgres 16 `lifeos_test` in the
sandbox, with `LIFEOS_TEST_DATABASE_URL`. This branch has **no `apps/api`
changes**:

| Check | Result |
|---|---|
| `ruff check .` | clean |
| `alembic heads` / `alembic current` | `20260930_0009 (head)` / `20260930_0009 (head)` |
| `python -m pytest` | **748 passed, 2 failed, 1 skipped** |

The two failures are environment-dependent timestamp assertions:
- `test_aa_deletion.py::test_tombstone_clears_value_keeps_existence_and_retry_cannot_restore`
  expects `…Z` but got `…+00:00`.
- `test_aa_legacy_import.py::test_legacy_import_is_honest_idempotent_and_does_not_backfill_other_layers`
  compares an `occurred_at` date.

The sandbox Postgres runs in `Etc/UTC`, and the run crossed midnight Kyiv
(2026-09-30 22:3x UTC). These tests fall outside this branch and were not
investigated further.

`src/test/jenkin-branding.test.jsx` covers:
- the logo geometry, marks, sidebar, login, ink tokens and favicon files;
- validating, storing and applying the preference, and the pre-paint script;
- the RU/UK Appearance control and the preview samples (Ё in RU; І, Ї, Є, Ґ in
  UK; digits);
- the DejaVu scope rules: no `!important`, no universal selector, no `body`
  rule, `--font-mono` untouched, `.mono` restored;
- a full stylesheet scan: every hardcoded Onest / Work Sans selector has an
  override for the matching role;
- the runtime WOFF files and LICENSE are byte-identical to the approved
  package.

### Browser matrix

Tool: `Outputs/Implementations/jenkin-branding_20261001/verify-font-matrix.cjs`.
It runs Playwright on the sandbox Chromium and uses sandbox-specific paths. It
covers:
- fonts Current and DejaVu Sans;
- locales RU and UK;
- theme states dark, light, paradise-day and paradise-night;
- widths 1440, 1024, 768, 390 and 320.

At each combination it checks login, Home (the sidebar, or the mobile nav at
widths under 641 px), Settings → Appearance, Tasks, the task dialog, and the
Calendar this branch carries (the pre-nested cube Calendar).

The data is deliberately long:
- email `oleksandra.kovalenko-shevchenko.long-mailbox@example-university.com.ua`;
- a task titled «Ёлка і Їжак: перевірити Іі Її Єє Ґґ та Ёё — дуже довга назва
  завдання … 0123456789 Надзвичайнодовгенеперервнеслово».

The login screen has no locale switcher (locale is in-memory, default RU), so
login was checked in **RU only**.

| Run | What talks to what | Views |
|---|---|---|
| **Mocked API** | `vite preview` of the production build; `/api/v1/auth/me` and `/api/v1/state` answered inside the browser (Playwright `route`) | 440: full matrix, 80 combinations × 5 views + 40 login views |
| **Real backend** | `vite` dev server → proxy → real FastAPI (`uvicorn --factory app.main:create_app`) → Postgres `lifeos_test`, migrated to head. The account was created via the real `/auth/bootstrap`, state was seeded via the real `PUT /state`, and each context logged in through the real login form | 88: both fonts × RU/UK × {dark 1440, paradise-night 1024, paradise-day 390, light 320} × 5 views + 8 login views |

Results were identical across both runs:

| Check | Mocked API | Real backend |
|---|---|---|
| Horizontal overflow | **0 / 440 views** after the TopBar fix (before it: 20 views, all DejaVu dark/light at 768 px) | **0 / 88** |
| Text elements not in DejaVu when DejaVu is selected (excluding the mono role and the Current preview sample) | 0 | 0 |
| `.mono` instances that changed face | 0 of 9,880 | 0 of 1,936 |
| Sidebar email (1440/1024/768) | 48 checks; 12 px, no overflow (wraps across lines) | 8 checks; same |
| Keyboard focus (Tab stops audited: outline, box-shadow, border, background or colour change) | 3,160 stops | 632 stops |
| JS page errors | 0 | 0 |

Focus gaps: the same three elements show **no visible focus change under
either font**, so they predate this branch and are not caused by it. They were
not fixed here; that CSS is shell territory.
- `input.qa-title`: the task dialog title.
- The login `input`s.
- `input.tb-cmd-input`: the TopBar search.

### Actual glyph rendering vs fallback

A computed `font-family` value does not prove which font drew the glyphs. So
each check read Chromium DevTools
`CSS.getPlatformFontsForNode` for real UI nodes. That reports the font that
actually drew each glyph, and whether it is a web font (`[web]`) or an OS font
(`[system]`).

This sandbox has **DejaVu Sans installed as an OS font** and Liberation Sans
as the generic `sans-serif`. `[web]` and `[system]` therefore separate the
app's DejaVu webfont from the OS copy.

Current webfonts: Chromium itself rejects `fonts.googleapis.com` in this
sandbox (the proxy CA is not in its trust store). The matrix therefore
fetched Google Fonts with `curl`, which verifies TLS against the proxy CA, and
handed the bytes to the page. **Current was rendered with the real Onest and
Work Sans files**, not a fallback. Without that step, Current falls back to
OS fonts, which is what the first pass's screenshots showed.

| Node (text) | DejaVu Sans selected | Current |
|---|---|---|
| Long task title «Ёлка і Їжак … Іі Її Єє Ґґ … Ёё» (row and dialog) | **DejaVu Sans [web]**, every glyph | Row: Work Sans [web] for Latin/digits + **OS fallback** for Cyrillic. Dialog title: Onest [web] |
| Settings row labels, sidebar nav, mobile nav, email | **DejaVu Sans [web]** | Row labels: OS fallback (DejaVu Sans [system]). Sidebar and mobile nav: Liberation Sans [system]. Email (Latin): Work Sans [web] |
| Page titles, Calendar heading and cubes, login heading | **DejaVu Sans [web]** | Onest [web] (login heading: Work Sans + OS fallback) |
| Preview sample «DejaVu Sans» | **DejaVu Sans [web]**, all glyphs incl. І Ї Є Ґ / Ё | same (the preview always uses its own face) |
| Preview sample «поточний/текущий» | Work Sans [web] + OS fallback for Cyrillic | same |
| `.mono` labels (dialog eyebrow, preview labels, login eyebrow) | Work Sans [web] + OS fallback for Cyrillic: the mono face is preserved | same |

Conclusions:
- With DejaVu selected, І Ї Є Ґ and Ё are drawn by the **app's DejaVu webfont**
  on every checked surface, in both locales and every theme and width.
- **Current, a fact that predates this branch:** Google's **Work Sans has no
  Cyrillic glyphs**. Under Current, Cyrillic body text and `.mono` text has
  always rendered in the OS fallback: here the OS DejaVu or Liberation, on
  macOS the system UI font. Only Onest (headings, titles) renders Cyrillic as
  a webfont. So the owner's Mac shows Current Cyrillic body text in the system
  font, not Work Sans.
- Because `--font-mono` is kept, **`.mono` Cyrillic still uses the OS
  fallback when DejaVu is selected**. **Open owner decision:** adding
  `"DejaVu Sans"` as the Cyrillic fallback of `--font-mono` under
  `data-font="dejavu"` would keep Work Sans for Latin and tabular digits while
  drawing Cyrillic in DejaVu. It was not done, because the instruction was to
  preserve the mono typography.

### Screenshots (JPEG, viewport)

Directory: `Outputs/Implementations/jenkin-branding_20261001/`. There is no
screenshot convention in this repository. Root `screenshots/` holds old
design-system captures, and `AGENTS.md` names `Outputs/` as the home for
implementation records. The images therefore sit next to this report.

File names follow `<font>_<locale>_<theme>_<width>_<view>.jpg`. Both runs
fetched Current's webfonts through curl, as above, so Current shots show the
real Onest / Work Sans files.

Mocked API: `screenshots/mock-api/`
- `screenshots/mock-api/dejavu_uk_dark_1440_settings.jpg`
- `screenshots/mock-api/dejavu_uk_light_1440_settings.jpg`
- `screenshots/mock-api/dejavu_uk_paradise-day_1440_settings.jpg`
- `screenshots/mock-api/dejavu_uk_paradise-night_1440_settings.jpg`
- `screenshots/mock-api/current_ru_dark_1440_settings.jpg`
- `screenshots/mock-api/current_uk_light_1440_settings.jpg`
- `screenshots/mock-api/dejavu_ru_dark_1440_tasks.jpg`
- `screenshots/mock-api/current_ru_dark_1440_tasks.jpg`
- `screenshots/mock-api/dejavu_ru_dark_1440_dialog.jpg`
- `screenshots/mock-api/dejavu_uk_light_1024_calendar.jpg`
- `screenshots/mock-api/current_uk_paradise-day_1024_calendar.jpg`
- `screenshots/mock-api/dejavu_ru_paradise-night_768_tasks.jpg`
- `screenshots/mock-api/dejavu_uk_dark_390_settings.jpg`
- `screenshots/mock-api/dejavu_uk_dark_390_dialog.jpg`
- `screenshots/mock-api/dejavu_ru_light_320_tasks.jpg`
- `screenshots/mock-api/dejavu_ru_light_320_settings.jpg`
- `screenshots/mock-api/dejavu_uk_paradise-day_320_dialog.jpg`
- `screenshots/mock-api/dejavu_ru_light_1440_home.jpg`
- `screenshots/mock-api/current_ru_light_1440_home.jpg`
- `screenshots/mock-api/dejavu_ru_dark_1440_login.jpg`
- `screenshots/mock-api/current_ru_light_320_login.jpg`
- `screenshots/mock-api/dejavu_ru_paradise-night_390_login.jpg`

Real backend: `screenshots/real-backend/`
- `screenshots/real-backend/dejavu_uk_dark_1440_settings.jpg`
- `screenshots/real-backend/current_ru_dark_1440_settings.jpg`
- `screenshots/real-backend/dejavu_ru_dark_1440_tasks.jpg`
- `screenshots/real-backend/current_ru_dark_1440_tasks.jpg`
- `screenshots/real-backend/dejavu_ru_dark_1440_dialog.jpg`
- `screenshots/real-backend/dejavu_ru_light_320_settings.jpg`
- `screenshots/real-backend/dejavu_ru_light_320_tasks.jpg`
- `screenshots/real-backend/dejavu_ru_dark_1440_login.jpg`
- `screenshots/real-backend/current_ru_light_320_login.jpg`

Raw results:
- `matrix-summary.txt`
- `results-mock-api.json.gz`
- `results-real-backend.json.gz`

## Files likely to overlap with `handoff/jenkin-cloud-20260930`

| File | This branch | Integration note |
|---|---|---|
| `apps/web/src/components/Sidebar.jsx` | `sb-logo` contents → `<JenkinMark/>` / `<JenkinWordmark/>`; one import | Small hunk in `.sb-top`; the account block and navigation are untouched |
| `apps/web/src/pages/LoginPage.jsx` | `.auth-brand` contents; one import | One-line hunk |
| `apps/web/index.html` | favicon/apple-touch links; `data-font` pre-paint block at the top of the inline script | Keep both if the other branch edits `<head>` |
| `apps/web/src/components/SettingsPage.jsx` | Appearance font row, import, `AppearanceSection` export | |
| `apps/web/src/context/locale/{ru,uk}.js` | `set_font`, `set_font_current`, `set_font_dejavu`, `set_font_preview`, `set_font_sample` after `set_accent_intensity` | |
| `apps/web/src/test/locale-shape.test.ts` | ru 1819→1824, uk 1818→1823 | If the other branch also adds keys, the pinned counts must be the sum of both |
| `apps/web/src/test/jenkin-ui.test.jsx` | two assertions in "visible branding" (`<svg class="jenkin-wordmark"`, the new `.auth-brand` markup) | |
| `apps/web/src/main.jsx` | `import './brand.css'` | |
| `Outputs/architecture/module-boundaries.md` | Shell effects paragraph + Branding paragraph | |
| `LIFEOS_MASTER_CONTEXT.md` | appended §85 | The other branch may also append §85; renumber at integration |
| `apps/web/src/brand.css` (new) | lists every hardcoded Onest/Work Sans selector | If the other branch adds or renames such selectors, `jenkin-branding.test.jsx` fails until the override list is updated. That is intended |

Deliberately **not** touched, to avoid conflicts with the shell work:

- Now-unused logo rules in `styles/shell.css` (`.sb-logo-dot`),
  `styles/theme-light.css` (`.sb-logo .logo-dot`, `.sb-logo tspan`) and
  `styles/paradise.css` (`.sb-logo-dot`, `.sb-logo .logo-word`).
- The text-only `.auth-brand` typography in `styles/paradise.css`.

These rules are harmless dead CSS and can be removed after integration.

`public/assets/logo.svg` and `logomark.svg` (old marks, not referenced by the
app) were left as they are.

## Not done / open

- No web app manifest or 192/512 PWA icons were added. There is no manifest
  today, and adding one would be new scope.
- The Satin/Modular studies and the comparison sheet remain reference-only,
  as the handoff requires.
- **Open owner decision:** whether `--font-mono` should gain `"DejaVu Sans"` as
  its Cyrillic fallback under DejaVu. See "Actual glyph rendering vs fallback".
- There are three focus-indicator gaps that predate this branch
  (`.qa-title`, login inputs, `.tb-cmd-input`). They belong to the shell
  session or a follow-up.
- UK login was not checked: the login screen has no locale switcher.
