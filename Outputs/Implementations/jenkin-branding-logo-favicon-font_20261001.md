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
| *(this report)* | `docs`: implementation report and module-boundaries entry |

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
- `brand.css` declares the four WOFF faces with `font-display: swap`.
  - Under `:root[data-font="dejavu"]` it re-points `--font-display`,
    `--font-body` and `--font-mono`.
  - Many layers name `'Onest'` or `'Work Sans'` directly (about 44 rules), so
    `body` and `body *` also get `font-family: "DejaVu Sans" !important`, but
    only under that attribute.
  - Current leaves every existing font rule untouched.
- `src/assets/fonts/dejavu-sans/` holds byte-identical copies of the four
  approved WOFF files plus `LICENSE`. A scoped `.gitattributes` keeps the
  license's historical trailing space exact, and a README records where the
  files came from. The source-reference package in `design-references/` is
  untouched.
- Vite fingerprints the WOFF files. The browser downloads them only after
  DejaVu Sans is selected: none are requested under Current.

## Verification

Commands run in `apps/web`:

| Check | Result |
|---|---|
| `npm test` | 54 files, 764 tests passed |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | built; four DejaVu WOFF files emitted and referenced from the CSS |
| `git diff --cached --check` (repo root, every commit) | clean |

The new file `src/test/jenkin-branding.test.jsx` covers:

- the glyph geometry matches the reference SVG;
- the marks are decorative and `currentColor`, with no text element;
- the sidebar in both collapsed and expanded states;
- the login wordmark;
- the per-theme ink tokens;
- the favicon links, the ICO header (3 images) and the 180 × 180 PNG;
- validating, reading, writing and applying the font preference, including
  storage that throws;
- the pre-paint script;
- the RU/UK Settings control;
- the `@font-face` set, and that every font override is scoped to
  `data-font="dejavu"`;
- the runtime WOFF files and LICENSE are byte-identical to the approved
  package.

Browser check (Chromium via Playwright, against `vite preview` with the API
mocked):

- The sidebar was checked expanded and collapsed, and the login card, in dark,
  light, Paradise day and Paradise night.
- Choosing DejaVu Sans in Settings:
  - sets `data-font` and `lifeOsFont`;
  - switches the computed font to DejaVu Sans;
  - downloads only the faces in use;
  - survives a reload.
- Choosing Current again removes both the attribute and the key and restores
  Onest / Work Sans.
- The logo ink (`rgb(37, 42, 43)` on light) is the same under both fonts.
- Google Fonts is unreachable in this sandbox, so in these screenshots
  Current falls back to a system sans. The computed `font-family` values were
  used to check the switch instead.

Not run: backend gates (`pytest`, `ruff`, `alembic`), because no backend file
changed.

## Files likely to overlap with `handoff/jenkin-cloud-20260930`

| File | This branch | Integration note |
|---|---|---|
| `apps/web/src/components/Sidebar.jsx` | `sb-logo` contents → `<JenkinMark/>` / `<JenkinWordmark/>`; one import | Small hunk in `.sb-top`; the account block and navigation are untouched |
| `apps/web/src/pages/LoginPage.jsx` | `.auth-brand` contents; one import | One-line hunk |
| `apps/web/index.html` | favicon/apple-touch links; `data-font` pre-paint block at the top of the inline script | Keep both if the other branch edits `<head>` |
| `apps/web/src/components/SettingsPage.jsx` | Appearance font row, import, `AppearanceSection` export | |
| `apps/web/src/context/locale/{ru,uk}.js` | `set_font`, `set_font_current`, `set_font_dejavu` after `set_accent_intensity` | |
| `apps/web/src/test/locale-shape.test.ts` | ru 1819→1822, uk 1818→1821 | If the other branch also adds keys, the pinned counts must be the sum of both |
| `apps/web/src/test/jenkin-ui.test.jsx` | two assertions in "visible branding" (`<svg class="jenkin-wordmark"`, the new `.auth-brand` markup) | |
| `apps/web/src/main.jsx` | `import './brand.css'` | |
| `Outputs/architecture/module-boundaries.md` | Shell effects paragraph + Branding paragraph | |

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
