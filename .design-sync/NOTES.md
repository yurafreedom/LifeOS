# design-sync notes — Life OS Design System

## Repo shape: OFF the standard converter envelope

This design system is **not** a conventional npm package and the converter
(`package-build.mjs`) **cannot run** against it. Key facts a future sync must know:

- **No `package.json`, no `dist/`, no build, no `node_modules`, no bare imports.**
- Components in `ui_kits/life-os/*.jsx` are **global-scope function declarations**
  (`/* global React */`, `function GoalsWidget(...)`) that communicate through
  `window.*` globals (`window.LifeLocaleContext`, `window.LifeOSDesignSystem_9f5940`).
  They have **no ES exports**, so there is nothing for esbuild to expose as
  `window.<globalName>.<Name>` — the DS ships **zero importable components** by design.
- The pre-existing root `_ds_bundle.js` (format 3) already has `components:[]` for this
  exact reason. It is a valid, near-empty `@ds-bundle` namespace stub and is reused as-is.
- The DS's real, uploadable value is: **the styling system** (`styles.css` →
  `colors_and_type.css` tokens + `ui_kits/life-os/styles.css` 169 KB themed component
  classes, dark/light under `[data-theme]`) + **57 hand-authored preview cards**
  (`preview/*.html`) + **brand assets** (`assets/`). Every design the agent builds is made
  on-brand via the **CSS classes**, exactly as the repo's own `SKILL.md` instructs
  ("import `styles.css`, use the classes, copy the `ui_kits/life-os/*.jsx` patterns").

## Fonts
- Brand fonts (Onest / Work Sans / JetBrains Mono) load **remotely** from Google Fonts via
  `@import` in `colors_and_type.css` (and `<link>` in each preview card). Nothing to bundle —
  this is `[FONT_REMOTE]` (informational, no action). Families load at runtime.

## Preview cards
- Cards are **self-contained static mockups**: they inline their own styles and link
  `preview/_base.css` + remote fonts; they do **not** render live components (there are none)
  and do **not** link the real `styles.css`. They are documentation of the look for the
  component picker — not a proof of the shipped CSS. The shipped `styles.css` closure is the
  real contract for designs.
- Source cards carry `<!-- @dsCard ... -->` on **line 2** (line 1 is `<!doctype html>`).
  The app self-check reads it from **line 1**, so the build moves the marker to line 1.
- 2 cards had no `@dsCard` marker in the source: `card-system-v2.html`,
  `visual-refinement.html` — markers authored during the build.

## Verification path
- No playwright/chromium cache on this machine; Google Chrome.app is present. Render
  verification is done through the Chrome automation tools against a served `.review.html`
  (not `package-validate.mjs`, which expects the converter's `components/` layout).

## Re-sync risks / what can go stale
- **No `_ds_sync.json` anchor is uploaded** — this shape is outside the converter's hash
  recipe, so omitting the sidecar is the honest choice. Consequence: **every re-sync
  re-verifies everything** (there is no fast diff). This is expected, not a bug.
- The build is produced by the ad-hoc steps recorded here + in git, not by `package-build.mjs`.
  If the DS ever grows a real build with ES exports, revisit and use the standard converter.
- Card look depends on remote Google Fonts being reachable at render time.
