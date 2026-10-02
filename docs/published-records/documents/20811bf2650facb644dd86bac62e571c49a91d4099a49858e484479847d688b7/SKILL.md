---
name: life-os-design
description: Use this skill to generate well-branded interfaces and assets for Life OS, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping a Russian-first personal life-operating-system dashboard (tasks, calendar, finances, habits, medications, dog, profile) with dark / light / paradise themes.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view — always link `styles.css` first. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions (surface, fidelity, theme, whether the UI is routine or stakes, locale RU/UA), and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## The one rule that runs the system

**Cool primary handles the day. Warm accent only appears when something is at stake.** Stakes = goals, money moments, "today", high priority, irreversible commits, telegram-bot pings, budget at 80%+, streak milestones. Never decorative. If a screen looks "too cool", leave it.

## Where things are

- `styles.css` — the only file to link; it imports `colors_and_type.css` (foundation tokens) and `ui_kits/life-os/styles.css` (themed component layer, which wins on conflicts).
- `components/core/`, `components/patterns/` — React primitives with `.d.ts` + `.prompt.md` next to each.
- `preview/` — one specimen card per foundation or component; read them to see a token in context.
- `ui_kits/life-os/` — the full product recreation; copy or adapt these screens.
- `assets/` — logo, logomark, favicon, paradise scene photography.

## Hard rules — never violate

- Themes: `[data-theme="dark"|"light"|"paradise"]` on `<html>`, applied pre-paint. Dark stakes uses GLOW; light/paradise stakes uses SHADOW. The dark gradient `#FFC066 → #FF8A1E → #FF6B0A` does not work on light — use `#FF7A0E → #DB5A0C → #B14808` with burnt text `#8A3806` on tints.
- Orange is positive/important/deliberate. Yellow = about to go wrong. Red = went wrong. Categories are never stakes-tinted.
- No emoji in UI chrome. No exclamation marks except genuine wins. No purple gradients, mascots or illustrations.
- Money inputs always carry the accent tint. Numbers and timestamps are always tabular, uppercase, wide-tracked (mono behaviour; the face is Work Sans since Sprint 3.5).
- Icons are inline Lucide-style SVG at 1.5px stroke, 12/14/18px, `currentColor`. The only accent-tinted icon is the active sidebar glyph.
- Copy is Russian primary, Ukrainian secondary, lowercase microcopy, dry voice, second person.
