# Building with the Life OS design system

This is a **dark-first, CSS-class + design-token** system (not an importable-component
library). You build screens by writing your own JSX/HTML and styling it with the **tokens**
and **class conventions** below — the same way this system's own `ui_kits/life-os/*.jsx`
components are built. Read `styles.css` and its imports before styling; read
`ui_kits/life-os/styles.css` + the matching `*.jsx` to copy a specific component's markup.

## Setup

- **Import `styles.css`** (it `@import`s `colors_and_type.css` for tokens and
  `ui_kits/life-os/styles.css` for component classes; brand fonts load remotely from
  Google Fonts). Import it once at the root — everything below depends on it.
- **Theme** is a `data-theme` attribute on a root element:
  `[data-theme="dark"]` (default), `[data-theme="light"]`, `[data-theme="paradise"]`.
  Both dark and light drive off the same tokens. On dark, stakes use **glow**; on light,
  **shadow** — don't hand-roll either.
- Fonts, via tokens: `--font-display` (Onest, headlines + hero numbers),
  `--font-body` (Work Sans, everything else), `--font-mono` (JetBrains Mono, figures/meta).

## The one rule: cool default, warm only at stake

Cool blue (`--blue*`) is the resting state of the whole UI. The warm accent
(`--accent*`) and the **`.is-stakes`** modifier appear **only** for the eight stakes
triggers: goals, money moments, "today", high-priority, irreversible commits,
telegram-bot notifications, overdue, streak risk. Categories are never stakes-tinted.
If a screen looks "too cool," leave it. Use `.is-routine` for the calm default panel.

## Style with tokens (all exist in the shipped CSS — prefer these over literals)

- **Type scale**: `--text-xs --text-sm --text-md --text-lg --text-xl --text-2xl --text-3xl`
- **Spacing** (4pt): `--s-1` … `--s-10`
- **Radii**: `--r-xs --r-sm --r-md --r-lg --r-xl --r-pill`
- **Text/fg**: `--fg-1 --fg-2 --fg-3 --fg-4`, `--muted`, `--text-soft`
- **Surfaces**: `--bg-base --bg-elev-1 --bg-elev-2 --card --surface`
- **Cool primary**: `--blue --blue-2 --blue-3 --blue-tint`
- **Warm accent (stakes only)**: `--accent --accent-mid --accent-soft --accent-glow --accent-border --accent-tint`
- **Semantic**: `--success/--success-soft --warning/--warning-soft --red/--red-tint --green/--green-tint --yellow/--yellow-tint`
- **Elevation**: `--shadow-1 --shadow-2 --shadow-card --shadow-hover --shadow-stakes`

## Class conventions

Classes are **feature-specific BEM** plus reusable **`.is-*` state modifiers** — don't
invent generic names (`.btn-primary` does not exist here). Reusable primitives that do
exist: `.card`, `.panel`, `.stat-card`, `.task-row`, `.cat-row`, `.cal-pill`, `.goal-track`
/ `.goal-fill`, `.empty-state`, `.mono`. State modifiers: **`.is-stakes` `.is-routine`**
`.is-today` `.is-done` `.is-over` `.is-overdue` `.is-warn` `.is-danger` `.is-active`
`.is-collapsed` `.is-income` `.is-expenses`. When you need a component that isn't a bare
primitive, open the matching `ui_kits/life-os/*.jsx` and reuse its exact class names.

## Idiomatic snippet

```jsx
// A stakes panel (a goal) vs a routine panel — same card, one modifier.
<section className="card panel is-stakes">
  <h3 style={{ font: `700 var(--text-lg)/1 var(--font-display)`, color: 'var(--fg-1)' }}>
    emergency fund
  </h3>
  <div className="goal-track"><div className="goal-fill" style={{ width: '62%' }} /></div>
  <span className="mono" style={{ color: 'var(--accent)' }}>$1,550 / $2,500</span>
</section>

<section className="card panel is-routine" style={{ marginTop: 'var(--s-4)' }}>
  {/* cool, calm — no accent, no glow */}
</section>
```

## Hard rules

No emoji in UI chrome (Lucide icons only). No exclamation marks except genuine wins.
No purple gradients, mascots, or illustrations. The dark accent gradient
`#FFC066 → #FF8A1E → #FF6B0A` does not work on light — light uses `#FF7A0E → #DB5A0C → #B14808`.
