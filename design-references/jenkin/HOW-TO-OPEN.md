# JENKIN prototype — self-contained archive

Open `templates/jenkin/Jenkin.dc.html` over a local static server (e.g. `npx serve .` from this folder) — the Design Component runtime fetches sibling files, so file:// will not work.

Layout (mirrors the Life OS design-system repo):
- `styles.css`, `colors_and_type.css`, `ui_kits/life-os/styles.css` — design tokens + kit CSS loaded by `templates/jenkin/ds-base.js`
- `_ds_bundle.js` — compiled design-system components
- `assets/` — logo, favicon, paradise scene photos
- `templates/jenkin/` — the prototype: `Jenkin.dc.html` (shell) + child components, `jenkin.css`, `jenkin-data.js` (strings + seed data), `jenkin-store.js` (session store, timezone + validation)

State is session-only; reload resets it. Fixed "today": 30 Sep 2026.
