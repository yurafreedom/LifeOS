# Life OS — Design System

> Personal life-management dashboard ("Life OS"): tasks, finances, goals, calendar, habits.
> Single user, dogfooded. Dark-theme only. The discipline is the product.

Style references: **Linear, Resend, Things 3, Fantastical** — refined B2B-grade tools, not consumer-app playful.

---

## Sources

This system was generated from a written brand spec only. No codebase, Figma, or screenshots were provided. If/when those exist, the reader should layer them on top:

- Codebase: _(none provided — please attach)_
- Figma: _(none provided — please attach)_
- Reference apps: Linear (linear.app), Resend (resend.com), Things 3, Fantastical

If you have a working Life OS prototype, drop it via Import → and re-invoke this skill so screens here can be replaced with real recreations.

---

## Index

| File / folder | What's in it |
| --- | --- |
| `README.md` | This file — overview, content, visual foundations, iconography |
| `SKILL.md` | Cross-compatible Agent Skill manifest |
| `colors_and_type.css` | All tokens (color, type, radii, spacing, motion) — import this first |
| `assets/` | Logo, logomark, ambient-gradient SVG |
| `preview/` | Per-card specimens that populate the Design System tab |
| `ui_kits/life-os/` | High-fidelity recreation of the dashboard, tasks, money, goals |
| _no_ `slides/` | None — no deck template was provided |
| _no_ `fonts/` | All three faces load from Google Fonts CDN (see Typography below) |

---

## What it is

Life OS is one person's operating system for their life. It is **not** a consumer app trying to delight a million users — it is a refined personal tool that has to earn its keep every day. The aesthetic is **operator-grade**: dark interface, generous whitespace, mono for technical chrome, dry copy, and one disciplined accent color reserved for moments that actually matter.

The whole system is built around one core idea:

> **Cool primary handles the day. Warm accent only appears when something is at stake.**

Everything else is Telegram blue (`#229ED9`) or neutral. The discipline is what makes it work.

### The eight stakes triggers

Orange gradient fires for these moments and **only** these moments:

1. **goals** — committing, milestones reached, completion
2. **money** — logging expense, income, budget set
3. **today** — current day in calendar, "today" badges
4. **high-priority tasks**
5. **irreversible commits** — delete forever, archive, lock
6. **telegram-bot notifications**
7. **monthly budget at 80%+ utilization** — warning before overshoot
8. **habit/streak milestones reached** — 7-day, 30-day, 100-day

### The color boundary — never blur these

The mental model:

| Color | Meaning | Triggers |
| --- | --- | --- |
| **orange** (`var(--accent)`) | _look at this, it matters._ | the 8 triggers above — all positive, important, deliberate |
| **yellow** (`#F1B33B`) | _this is about to go wrong._ | deadline in <2h · budget at 95% · streak at risk |
| **red** (`#E5484D`) | _this went wrong._ | budget overshoot · missed deadline · broken streak · failed sync · destructive error |

Orange is for **positive/important/deliberate** moments. **Never for failure states.** A broken streak is red. A streak hit a 30-day milestone? Orange. The "you said you'd run today" telegram-bot ping at 19:47? Orange — not red, even though there's an implied failure. The bot isn't yelling at you; it's marking the moment as one that matters.

---

## Content fundamentals

**Voice.** Direct, dry, slightly witty. Like a sharp colleague who respects your time. Never a coach. Never your friend. Never excited for you.

**Person.** Second-person ("you") and imperative ("ship it", "log expense") are default. First-person plural ("we") never appears — it's a single-user product, there is no "we".

**Casing.** Sentence case everywhere. Lowercase microcopy where it reads naturally (buttons, hints, empty states). Title Case is **only** for proper nouns and product surfaces ("Inbox", "Today"). All-caps is reserved for the mono technical chrome (`14:32 · TODAY`, `USD · MONTHLY`).

**Numbers + technical metadata.** Always JetBrains Mono, tabular figures, wide-tracked, uppercase when paired with units or labels. `14:32 · TODAY`, `$1,240.00`, `USD`, `48/56`.

**Punctuation.**
- No exclamation marks — **except** for genuine wins (goal hit, streak landed, debt cleared). When you do use one, it lands.
- No emoji in UI. Anywhere. Use Lucide icons or mono glyphs.
- Em-dashes are fine. Ellipses are fine. Smart quotes preferred.

**Examples — do.**
- empty state: `nothing for today. enjoy it.`
- destructive confirm: `delete this goal? this is irreversible.`
- toast (system): `expense logged · $42.00 → food`
- toast (telegram-bot): `you said you'd run today. it's 19:47.`
- button: `log expense` / `commit goal` / `mark done`
- section header: `TODAY · 5 DUE` (mono, uppercase)
- streak hit: `12 days. don't break it.`
- streak broken: `streak broke at 12. start again.`

**Examples — do NOT.**
- 🎉 You hit your goal! Amazing work! 💪
- We're so excited to see you back today!
- Let's crush your goals together!
- Pro tip: try our new feature ✨
- Oops! Something went wrong 😬

**Money + time.** Money is always shown to two decimal places in mono. Time is always 24-hour mono with the wide-tracked uppercase suffix (`14:32 · TODAY`, `09:00 · TUE`). Dates relative ("today", "tue") for the next week, absolute ("12 jun") beyond.

**Microcopy length.** Short. A button is 1–3 words. A toast is 1 sentence. A confirm dialog is 1 question + 2 verbs. If you need a paragraph to explain a control, the control is wrong.

---

## Visual foundations

### Background + ambient lighting
The canvas is `#0E1117` (near-black with a cold cast). It is **never** flat — a faint dual radial-gradient sits on every screen:
- Telegram-blue glow `rgba(34,158,217,0.10)` at top-right (`92% -10%`, 900×600px)
- Orange glow `rgba(255,138,30,0.07)` at bottom-left (`-10% 110%`, 700×500px)

These are background-attached so they don't move on scroll. They create depth without ever reading as "decorative gradient". Result: the screen feels lit, not painted.

### Color
Two brand colors. That's the whole system. Plus three semantic colors for state.

- **Primary (Telegram blue)** `#229ED9` — navigation, default buttons, links, neutral progress, the routine "do this 10× per day" UI. Lighter `#5BB8E8` for hover/highlight, deeper `#1577A8` for pressed.
- **Energy accent** is a 135° gradient `#FFC066 → #FF8A1E → #FF6B0A`. **Reserved for the eight stakes triggers** (see above). **Never decorative.** **Never for failure states** — see the color boundary table above.
- Semantic: `#1D9E75` success, `#E5484D` danger (= "this went wrong"), `#F1B33B` warning (= "about to go wrong").

### Surfaces
Cards are `rgba(255,255,255,0.035)` over the dark canvas. Borders are `rgba(255,255,255,0.08)` — hairlines, never thicker than 1px. Radii: 14px (default card), 18px (large cards), 10px (controls), 6px (chips), 999px (pills).

No glassmorphism. No backdrop-blur. The translucency is structural (lets ambient light through), not stylistic.

### Typography
- **Display** — **Onest** 700–900, letter-spacing -0.02 to -0.03em on large sizes.
- **Body** — **Work Sans** 400–600. Primary text font across the entire interface. Cards, lists, descriptions, microcopy, form labels.
- **Mono** — **JetBrains Mono** 500. Numbers, timestamps, IDs, technical metadata, mono-tabular figures. Uppercase + 0.14–0.22em letter-spacing for technical chrome (`14:32 · TODAY`). Inter is fallback only.

All three load from Google Fonts via `colors_and_type.css` and all three have Cyrillic — Ukrainian/Russian UI is supported.

### Spacing
4pt scale: 4, 8, 12, 16, 20, 24, 32, 40, 56, 72. Use 16 for tight (within a card), 24 for default (between cards), 40+ for breathing room around large sections. Be generous.

### Borders + shadows
- Borders: hairline `rgba(255,255,255,0.08)`, strong `rgba(255,255,255,0.14)`, focus `rgba(34,158,217,0.55)`.
- Shadows: **subtle only**. `0 8px 24px -12px rgba(0,0,0,0.5)` is the heaviest shadow that ever ships. No drop-shadow halos, no neumorphism. A 1px inset highlight `0 1px 0 rgba(255,255,255,0.04) inset` gives cards a tiny top edge.

### Hover, press, focus
- **Hover** on cards/rows: `translateY(-1px)` + bump to `rgba(255,255,255,0.055)` + slightly stronger border. No color shift.
- **Hover** on accent CTAs: `translateY(-2px)` + accent glow `0 10px 28px -10px rgba(255,107,10,0.55)`.
- **Press**: `translateY(0)` and slightly darken. No scale.
- **Focus**: 2px blue ring `rgba(34,158,217,0.55)` outset. Never a fuzzy box-shadow halo.

### Motion
- Default easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out, snappy).
- Durations: 120ms fast (hover), 180ms default, 260ms slow (modal in).
- Fades and small translations. No bounce. No spring. No parallax. Things appear, disappear, and move with intent.

### Transparency + blur
- Translucent surface fills are structural (cards over ambient gradient).
- Backdrop blur is used in **one place only**: the top app-bar when content scrolls under it. `backdrop-filter: blur(12px)` + 80% opaque bg. Never on cards. Never on popovers.

### Imagery
Life OS contains no decorative imagery. No mascots, no illustrations, no stock photos, no hero artwork. The only visual textures are the ambient gradient and the orange-gradient avatar used for the Telegram-bot. If you need to show a person or asset (e.g. a contact), use initials in a colored circle.

### Money input — the one tinted control
Expense/income inputs are tinted with `var(--accent-tint)` (`rgba(255,138,30,0.06)`) with a subtle accent border on focus. Entering money should feel deliberate. This is the only place in the system where accent color leaks into an everyday input.

### Telegram-bot notifications
A distinct toast variant: orange-gradient avatar (32px circle, accent gradient fill, white "tg" or initial), separated from system toasts which use a neutral surface. The voice in these toasts is the bot — slightly more pointed than the rest of the UI (`you said you'd run today. it's 19:47.`).

### Layout rules
- Sidebar nav: 240px fixed on desktop, collapsible. Always pinned left.
- Top bar: 56px, sticky, backdrop-blurred on scroll.
- Content max-width: 1200px, centered. Generous gutters (40px+).
- Lists prefer single-column over grids unless there are >12 items.

---

## Iconography

**System.** [Lucide](https://lucide.dev) — 1.5px stroke, no fills, sharp corners. Loaded from CDN via `lucide@latest`. It's the closest off-the-shelf match to the Linear/Things aesthetic.

> ⚠️ **Substitution flag.** No icon library was specified or shipped — Lucide was chosen as the closest CDN match to the stated aesthetic (sharp, monoline, minimal). If the user has a preferred set (Phosphor, Tabler, custom), swap it in.

**Sizing.** 16px default in lists/buttons, 20px in sidebar/cards, 24px in empty states. Never larger — Life OS is not an app that shouts.

**Color.** Inherit `currentColor`. Default `var(--fg-3)` (muted), `var(--fg-1)` on active row, `var(--primary)` on selected nav item. Accent gradient on icons is **off-limits** — accent is for fills/strokes that mark stakes, not for icon tint.

**Emoji.** Never in UI. Acceptable in user-entered content (a task title the user typed). Never in chrome.

**Unicode.** Sparing use of `·` `›` `—` `★` for visual separators. Not as decoration.

**SVG vs icon font.** SVG only. The Lucide CDN renders inline SVG from a data-tag attribute. No icon font.

**Logo.** Three directions to evaluate (see `preview/logo-directions.html`):

- `assets/logo-a-wordmark.svg` — **A · pure wordmark.** "life · os" in Onest 900, tracked tight at -0.03em. The `·` separator is the only color element, rendered in the accent gradient. Clean, type-led, scales 16px → header.
- `assets/logo-b-monogram.svg` — **B · abstract monogram.** L + O in `#F5F5F7` with a single orange-gradient diagonal cutting through — the "stakes line" against routine baseline.
- `assets/logo-c-glyph.svg` — **C · data-glyph.** Three Telegram-blue bars (routine baseline) with a tall orange-gradient spike at the end. Reads as a sparkline frozen mid-motion. Most "Linear-grade" of the three.
- `assets/logo.svg` / `assets/logomark.svg` — placeholders (the original four-bar mark used in v0.1). Will be removed once a direction is picked.

All three directions are dark-bg native, no enclosing shapes, and gradient is only ever on the accent element — never on the wordmark itself.

---

## Caveats for the reader

- **No source code or Figma to recreate from.** Everything here was synthesized from the brand spec. UI kits are a best-guess at what a Linear/Things-grade Life OS would look like under these rules — replace with real screens when they exist.
- **Lucide is a placeholder icon set.** Swap to user-preferred library.
- **Cyrillic** has been stress-tested against the typical failure-point strings in `preview/type-cyrillic-stress.html`: `Підписати документи з нотаріусом до п'ятниці включно` (Work Sans body, long descenders + apostrophe), `ЦІНА БЕЗДІЯЛЬНОСТІ` (JetBrains Mono small caps, wide-tracked). All three faces support both UA and RU via Google Fonts.
