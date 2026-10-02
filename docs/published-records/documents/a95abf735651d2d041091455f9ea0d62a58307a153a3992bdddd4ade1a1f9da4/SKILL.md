---
name: life-os-design
description: Use this skill to generate well-branded interfaces and assets for Life OS, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping a dark-theme personal life-management dashboard ("tasks, finances, goals, calendar, habits").
user-invocable: true
---

# Life OS — design skill

Read the `README.md` file within this skill first — it contains the brand context, content fundamentals, visual foundations, and iconography rules in detail. Then explore:

- `colors_and_type.css` — every token (color, type, radii, spacing, motion). Import this into any artifact you make.
- `assets/` — logo SVGs (`logo.svg`, `logomark.svg`).
- `preview/` — single-purpose cards showing each foundation and component in isolation. Read them when you need to see how a token or component looks in context.
- `ui_kits/life-os/` — the dashboard recreation. `styles.css` has the production-grade component styles; `*.jsx` are the components. Copy or adapt these when you build new screens.

## The one rule that runs the system

**Cool primary handles the day. Warm accent only appears when something is at stake.**

Stakes = goals, money moments, "today", high-priority, irreversible commits, telegram-bot notifications. Never decorative. If a screen looks "too cool" — leave it. The discipline is what makes the system work.

## When asked to create something

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Always import `colors_and_type.css` first.

If working on production code, copy the relevant `ui_kits/life-os/*.jsx` components and `styles.css`, and read the rules in `README.md` to become an expert.

The UI kit at `ui_kits/life-os/` ships with full i18n: `i18n.jsx` is RU primary, UA secondary. An EN slot is reserved in the data model but deliberately not rendered (no toggle UI for it yet) — when EN strings are written, add `en` to the `LIFE_LOCALES` list and the toggle picks it up. Categories live in `categories.jsx` (16 expense + 6 income), each with a Lucide icon ref and a tint class (`routine` / `stakes` / `income` / `neutral`).

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions (audience, surface, fidelity, whether it's stakes or routine UI, target locale RU/UA), and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Hard rules — never violate

- Dark theme is default; light theme ships in v1.0. Both drive off the same token system in `colors_and_type.css` and `ui_kits/life-os/styles.css` under `[data-theme]`.
- The eight stakes triggers (see README) are event-driven. Categories are NEVER stakes-tinted. Light theme raises the bar for using orange even further — bar must be filled with deliberate moments, not background warmth.
- On dark, stakes uses GLOW (rgba light spilling outward + the ambient radial-gradient background). On light, stakes uses SHADOW (rgba dark sinking inward) — no glow filters, no ambient gradient.
- The dark gradient `#FFC066 → #FF8A1E → #FF6B0A` does NOT work on light. Use the light gradient `#FF7A0E → #DB5A0C → #B14808` and burnt text `#8A3806` on orange tints.
- No emoji in UI chrome. Use Lucide icons.
- No exclamation marks except for genuine wins.
- No purple gradients. No mascots. No illustrations.
- Money inputs always carry the accent tint (dark or light).
- Numbers and timestamps are always JetBrains Mono, uppercase, wide-tracked.
