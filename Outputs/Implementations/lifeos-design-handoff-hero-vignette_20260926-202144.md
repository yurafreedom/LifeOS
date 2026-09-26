# LifeOS Hero Vignette — production integration

Date: 2026-09-26 20:21 EEST

Branch: `feat/design-handoff-hero-vignette`

Worktree: `/Users/yurasachenko/LifeOS/LifeOS-design-handoff-hero-vignette`

## Verdict

`HERO_VIGNETTE_STATUS=PASS`

The approved Claude Design variant 1b is integrated as a production React/CSS
page-header pattern. Clarify, Adaptive Analytics Slice 2 and Project Slice P are
explicitly out of scope and were not changed or started.

## Exact Git start state

- `origin/main`: `40ae9281c077d1bd65ed595c04f0eb424d9a00db`
- start HEAD: `40ae9281c077d1bd65ed595c04f0eb424d9a00db`
- frozen tag `adaptive-analytics-design-accepted`:
  `d4960286ec94f35472600e59c0d533dc50a64351`
- the prior clean `feat/design-handoff-clarify-hero` worktree was preserved;
  Hero work was split to a fresh branch/worktree before any product edit.

## Handoff inventory and classification

Authoritative read-only source:
`/Users/yurasachenko/LifeOS/design_handoff_hero_vignette`

| File | Format | Classification | Production decision |
| --- | --- | --- | --- |
| `README.md` | Markdown | `SOURCE_OF_TRUTH` | anatomy, behavior, accessibility and responsive contract |
| `hero-vignette.css` | CSS | `SOURCE_OF_TRUTH`, `BEHAVIOR_TO_REIMPLEMENT` | geometry, exact gradient, typography, container breakpoint |
| `demo.html` | HTML/CSS | `REFERENCE_ONLY`, `DEMO_ONLY` | comparison shell and gradient island placeholder rejected |
| `tokens/colors_and_type.css` | CSS | `REFERENCE_ONLY` | duplicate design tokens; no new font import copied |
| `tokens/life-os-ui-kit.css` | CSS | `REFERENCE_ONLY` | duplicate product kit; current `apps/web/src/styles.css` remains authoritative |

No React package, package manifest, build config, raster/SVG asset, fixture or
production dependency exists in the handoff. Its remote Google Fonts reference
was not copied. There is no runtime mock data in the integration.

## Design anatomy understood

- A 190px minimum-height scene (`240px` via the optional tall modifier), clipped
  at the existing 12px radius.
- Decorative island media is absolutely layered below an in-flow text block.
- The text block owns the exact bottom-to-top gradient:
  `0.82 → 0.66 → 0.30 → 0`, eliminating a bordered/backdrop-blurred plate.
- Optional date, 32px compact / 44px wide title, and 13px subtitle retain the
  supplied shadows and contrast treatment.
- Layout adapts from its own width via container queries, not the viewport.
- The vignette itself has no controls or state. Existing page controls may be
  carried in an optional aside and stack below 520px to avoid clipping.

## Production mapping

The target is every current generic LifeOS section header that previously used
`.page-head`: Profile, Finances, Quick Notes, Medications, Dog, Tasks, Habits,
Goals and Health. Home, Calendar, Settings, detail screens and TopBar retain their
specialized headers.

`PageHeader` preserves the exact compact `.page-head` fallback in dark/light.
Only effective `paradise` theme renders `HeroVignette`, because that is the only
current theme backed by the decorative island scene. This preserves existing
theme behavior and avoids loading scene assets in dark/light.

The old variant-1a plate remains on the independent TopBar greeting. Its stale
`.page-head` selector and related text overrides were removed so the new page
hero has no plate, border, blur or orange accent.

## Component architecture

- `HeroVignette`: pure presentational component; no hooks, fetch, effects or
  product state. Accepts title, optional subtitle/date/aside, scene sources and
  tall modifier.
- `PageHeader`: narrow theme adapter using the existing `LifeLocaleContext`.
  It chooses either the established compact header or the production vignette.
- Scene constants use current self-contained assets:
  `/assets/scene/island-day.jpg` and `/assets/scene/island-night.jpg`.
- Both scene layers cross-fade from the existing root `data-scene` contract and
  use a gentle scene-only breath. Reduced-motion disables both animation and
  cross-fade.

This follows the repository React best-practice guidance: direct imports,
module-level constants, no derived/effect state, no new provider, no unnecessary
memoization, and no third-party UI/CSS-in-JS dependency.

## CSS and responsive strategy

- Handoff values are locally namespaced under `.hero-scene` / `.hero-head`.
- Existing global tokens provide radius, typefaces and density.
- `@container (min-width: 720px)` applies the approved 88/24/20 padding and 44px
  title when the hero itself is wide.
- `@container (max-width: 520px)` stacks optional page controls under the copy.
- In-flow copy lets wrapped headings grow the scene instead of overlapping the
  next card.
- No fixed positioning, external URL, horizontal-scrolling shell, backdrop
  filter, border or accent treatment was introduced.

## Accessibility

- The page title remains a semantic `h2` inside `header`, preserving the existing
  document hierarchy.
- Media is decorative: wrapper `aria-hidden="true"` plus empty image alt text.
- Text remains real selectable content above the contrast gradient.
- Existing interactive tabs/counts remain outside the hidden media layer.
- Reduced-motion has an explicit production fallback.
- Dark/light accessibility and focus behavior are unchanged.

## Prototype technique deviations

- The demo's CSS-gradient island placeholder was rejected; the existing real
  day/night assets are reused.
- Duplicate handoff token files and remote font loading were rejected.
- The component is theme-aware through the existing product context rather than
  importing a prototype shell or global design system.
- An optional aside contract preserves existing medication tabs and note counts;
  its narrow stacking is production hardening beyond the static specimen.

## Tests and visual verification

Focused Vitest coverage verifies:

1. local decorative media, title/subtitle/date and no external asset URLs;
2. unchanged dark/light compact header;
3. paradise selection and retained page controls;
4. exact gradient stops, 720px container breakpoint and reduced-motion CSS.

Temporary untracked visual harnesses outside the repository were rendered with
headless Chrome at desktop and narrow widths for day and night assets. The
checks confirmed crop, radius, gradient fade, contrast, hierarchy and stacking.
No screenshots or harness artifacts enter Git.

## Baseline

- API: `242 passed` (PostgreSQL `lifeos_test`)
- ruff: PASS
- Alembic: `20260910_0004 (head)`
- frontend: `76 passed` / 11 files
- typecheck: PASS
- lint: PASS
- build: PASS
- bundle: 82 modules; CSS 124.84 kB / 21.81 kB gzip; JS 399.24 kB /
  113.65 kB gzip; source map 986.79 kB

## Final implementation validation

- API: `242 passed` (7 existing dependency/config deprecation warnings)
- ruff: PASS
- Alembic: `20260910_0004 (head)`
- focused + regression frontend: `80 passed` / 12 files
- typecheck: PASS
- lint: PASS
- build: PASS
- bundle: 83 modules; CSS 126.69 kB / 22.37 kB gzip; JS 399.21 kB /
  113.90 kB gzip; source map 988.65 kB
- bundle delta: +1 module; CSS +1.85 kB / +0.56 kB gzip; JS -0.03 kB /
  +0.25 kB gzip; no production dependency
- `git diff --check`: PASS
- handoff source integrity: PASS (5/5 SHA-256 values unchanged)
- application scope audit: PASS; only Hero component, generic page integrations,
  focused test, namespaced CSS and this report are present

## Changed application files

- added `apps/web/src/components/HeroVignette.jsx`
- added `apps/web/src/test/hero-vignette.test.jsx`
- modified `apps/web/src/styles.css`
- modified page integrations:
  `DogPage.jsx`, `FinancesPage.jsx`, `HealthPage.jsx`, `MedicationsPage.jsx`,
  `ProfilePage.jsx`, `QuickNotesPage.jsx`, `RelocatedPages.jsx`, `TasksPage.jsx`

## Explicit non-scope

- no Clarify UI or partial Clarify persistence
- no `addGoal` mapping for Project
- no Waiting, deferred Task, Project or Reference record
- no Slice 2 or Slice P implementation/worktree mutation
- no backend, database or migration change
- no design-system source change
- no deployment and no merge

## Source integrity

The five handoff files were hashed before work. Final SHA-256 comparison must
match those values exactly; `.DS_Store` is excluded by policy. The final check
matched all five files exactly and found no handoff-source mutation.
