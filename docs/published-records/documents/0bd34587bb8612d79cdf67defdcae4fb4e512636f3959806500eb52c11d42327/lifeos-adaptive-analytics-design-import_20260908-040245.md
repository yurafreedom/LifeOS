# LifeOS — Adaptive Analytics A–J design import & reconciliation

**Date:** 2026-09-08
**Task:** Reconcile the accepted Claude Design A–J export into the existing LifeOS repository, verify, and freeze if safe.
**Status at commit `d99da15`:** `DESIGN_IMPORT_STATUS=BLOCKED` — import applied and committed; **design-freeze tag withheld** due to one unresolved semantic regression in the export (`preview/aa-delta.html`).

> **Superseded — see §13 "FINAL RESOLUTION" at the end of this document.** The blocker above
> was real; it was resolved in a follow-up commit, together with two C-gallery cases promoted
> from observation to required fix and a refresh of the AA README status. Final status:
> `DESIGN_IMPORT_STATUS=PASS`, `SEMANTIC_FREEZE=PASS`. §1–§12 are preserved unchanged as the
> accurate record of the state at `d99da15`.

---

## 1. Start state (captured before any modification)

| Field | Value |
| --- | --- |
| `START_WORKTREE` | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` |
| `START_BRANCH` | `design-sync-setup` |
| `START_HEAD` | `67a1456c6165e9bdf36382a98c9713c4ed981314` |
| Remote | `origin https://github.com/yurafreedom/LifeOS.git` |
| Export source | `/Users/yurasachenko/LifeOS/New version 08.09.26 Life OS Design System` (read-only) |
| Integration worktree | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem-adaptive-analytics-import` |
| Integration branch | `design/adaptive-analytics-import` (created from `START_HEAD`) |

### Pre-existing dirty state (user-owned — untouched)

Modified: `.DS_Store`, `Outputs/backlog-tasks/task_log.md`

Untracked: `AGENTS.md`, `BATCH1-FIX-PROMPT.md`, `CLAUDE.md`, `MASTER-PROMPT.md`, `lifeos-ui-map.md`,
`Outputs/{Audits,Consensu,Consensu.zip,Discoveries,Implementations,Plans,Summaries}/`,
`consensu-dashboard-deploy/`, `export_claude_lifeOS/`, `tests/`

None of these were cleaned, reset, stashed, restored, or staged. The original working directory was **not modified** by this task.

---

## 2. Inventory statistics

SHA-256 content inventories of both trees (excluding `.git/**`, `.DS_Store`, `.ruff_cache/**`):

| Metric | Count |
| --- | --- |
| Files in local repo | 10,355 |
| Files in export | 212 |
| Byte-identical in both | 65 |
| Present in both, differing | 69 |
| Export-only | 78 |
| Local-only | 10,221 |

**Key structural finding:** every one of the 69 differing paths is git-tracked **and byte-identical to `HEAD`**. There are therefore **zero `BOTH_CHANGED` paths** — no pre-existing local modification overlaps any import path, and no three-way content conflict exists.

---

## 3. Classification of the 69 differing files

| Group | Count | Nature of difference | Action |
| --- | --- | --- | --- |
| `preview/*.html` | 51 | **Only** the `@dsCard group="…"` attribute (gallery taxonomy: `Brand` → `Colors`/`Type`/`Spacing`/`Components`/`UI Kit — Life OS`); 2 files gained a marker they previously lacked | `REPLACE_LOCAL_CLEAN` — imported |
| `ui_kits/life-os/*` | 9 | Export is an **older, pre-Batch-1 snapshot** | `PRESERVE_LOCAL` |
| `README.md` | 1 | Export = `.design-sync/conventions.md` + separator + local `README.md`, byte-exact | `NO_ACTION` (build artifact) |
| `SKILL.md` | 1 | Design-side rewrite referencing `components/` (not imported) | `NO_ACTION` |
| `styles.css` | 1 | Comment reflow only; `@import` lines identical | `NO_ACTION` |
| `assets/*.svg` | 3 | Leading blank line stripped; no visual change | `NO_ACTION` (whitespace normalization) |
| `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json` | 3 | Regenerated Claude Design build artifacts | `IGNORE_GENERATED` |

### Evidence: `ui_kits/life-os/**` is stale in the export

The export's copies are net **smaller** with heavy deletions (`App.jsx` −55/+20, `LifeDataProvider.jsx` −30/+0, `styles.css` −339/+217, `GoalsWidget.jsx` −37/+8).

`GoalsWidget.jsx` is decisive — the export **lacks** the local Batch-1 work:

- the entire `goal-add` affordance (`<form className="goal-add">`, `onAddGoal`, `draft` state) marked in local source as *"Batch 1 rev · FIX 7"*
- the `titleKey`/`tagKey` i18n resolution shape (export still uses eager `t()` literals)

Batch-1 marker counts (`batch 1` / `FIX n`): local `styles.css` = **44**, export = **0**; local `App.jsx` = 1, export = 0; local `LifeDataProvider.jsx` = 2, export = 0.

The export's `ui_kits/life-os/**` corresponds to a Claude Design project seeded **before** local commit `7be0d82 feat(ui): complete Life OS Batch 1 refinement`. Importing it would have silently reverted shipped local work.

Critically, the export's `ui_kits/life-os/**` contains **zero** references to analytics/AA — the Adaptive Analytics kit is fully self-contained and required no changes to the production kit. Preserving local costs nothing.

### Evidence: `_ds_bundle.js` is `IGNORE_GENERATED`

The export's `_ds_bundle.js` (607 KB, +4376 lines) embeds **both** the new analytics kit (27 AA references) **and** the stale life-os kit (`goal-add` occurrences: **0**, vs 4 in local source). Importing it would have recorded a bundle contradicting the newer local `ui_kits/life-os/` source that this import deliberately preserves.

---

## 4. Export-only files (78) — disposition

| Path | Count | Action | Rationale |
| --- | --- | --- | --- |
| `ui_kits/life-os-analytics/**` | 10 | **`COPY_NEW` — imported** | The accepted A–J design contract |
| `preview/aa-signal-card.html` | 1 | **`COPY_NEW` — imported** | AA specimen card; semantics verified correct |
| `preview/aa-delta.html` | 1 | **`BLOCKED_CONFLICT` — excluded** | Semantic regression — see §7 |
| `components/core/**`, `components/patterns/**` | 65 | **Deferred — not imported** | See below |
| `github.md` | 1 | Deferred — not imported | Design-side platform metadata |

### Why `components/**` was deferred (owner decision required)

This is a *new*, additive Claude Design surface (16 core + 6 pattern components, each with `.d.ts` + `.prompt.md`, plus 2 gallery cards). It was **not** imported because:

1. **It is not part of the A–J brief.** The accepted contract enumerated in the AA README covers A–J surfaces, AA primitives, fixtures, and styling. A general component library is a separate surface the owner has not reviewed in this cycle.
2. **It contradicts documented repo shape.** `.design-sync/NOTES.md` states this repo is *"OFF the standard converter envelope"*, has *"no `package.json`, no `dist/`, no build, no `node_modules`, no bare imports"*, and *"ships zero importable components by design"*. These files use `import React from 'react'` and `export function` — non-runnable in this repository as it stands.
3. Local CSS tokens they reference (`--primary`, `--primary-l`, `--fg4`, `--card-pad`, `--ambient`) **do** all exist in `ui_kits/life-os/styles.css`, so they are *stylistically* coherent — the blocker is repo shape and scope, not correctness.

Deferring is fully reversible; the files remain in the read-only export.

---

## 5. Merge manifest (applied)

| Path | Classification | Action | Result |
| --- | --- | --- | --- |
| `ui_kits/life-os-analytics/analytics.css` | EXPORT_NEW | `COPY_NEW` | added |
| `ui_kits/life-os-analytics/app.jsx` | EXPORT_NEW | `COPY_NEW` | added |
| `ui_kits/life-os-analytics/data.js` | EXPORT_NEW | `COPY_NEW` | added |
| `ui_kits/life-os-analytics/domains.jsx` | EXPORT_NEW | `COPY_NEW` | added |
| `ui_kits/life-os-analytics/experiment.jsx` | EXPORT_NEW | `COPY_NEW` | added |
| `ui_kits/life-os-analytics/index.html` | EXPORT_NEW | `COPY_NEW` | added |
| `ui_kits/life-os-analytics/primitives.jsx` | EXPORT_NEW | `COPY_NEW` | added |
| `ui_kits/life-os-analytics/README.md` | EXPORT_NEW | `COPY_NEW` | added |
| `ui_kits/life-os-analytics/screens.jsx` | EXPORT_NEW | `COPY_NEW` | added |
| `ui_kits/life-os-analytics/system.jsx` | EXPORT_NEW | `COPY_NEW` | added |
| `preview/aa-signal-card.html` | EXPORT_NEW | `COPY_NEW` | added |
| `preview/*.html` (51) | EXPORT_CHANGED_LOCAL_CLEAN | `REPLACE_LOCAL_CLEAN` | metadata line only |
| `preview/aa-delta.html` | EXPORT_NEW | `BLOCKED_CONFLICT` | **excluded** |
| `ui_kits/life-os/*` (9) | EXPORT_CHANGED_LOCAL_CLEAN (export stale) | `PRESERVE_LOCAL` | untouched |
| `README.md`, `SKILL.md`, `styles.css`, `assets/*.svg` (6) | EXPORT_CHANGED_LOCAL_CLEAN | `NO_ACTION` | untouched |
| `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json` | generated | `IGNORE_GENERATED` | untouched |
| `components/**`, `github.md` (66) | EXPORT_NEW, out of scope | deferred | not imported |
| all local-only paths (10,221) | LOCAL_ONLY | `PRESERVE_LOCAL` | untouched |

No file was deleted. No destructive tree-wide replacement was used. No `rsync --delete` equivalent was used.

---

## 6. A–J source verification — **PASS**

All eleven rail surfaces present in `ui_kits/life-os-analytics/app.jsx`:

| Brief area | Rail entry | Source |
| --- | --- | --- |
| A · Home | `A · Дом` | `screens.jsx` |
| B · Signal Card | `B · Signal Card` | `primitives.jsx`, `screens.jsx` |
| C · Expected/Actual/Delta | `C · Ожидалось / факт` | `screens.jsx` (7-variant gallery) |
| D · Metric history | `D · История показателя` | `screens.jsx` |
| D · Forecast history | `D · История прогноза` | `screens.jsx` |
| E · Review / Debrief | `E · Ревью` | `screens.jsx` (5 optional steps) |
| F · Finance domain | `F · Финансы (домен)` | `domains.jsx` |
| G · Project domain | `G · Проект (домен)` | `domains.jsx` |
| H · Subjective observation | inline «рядом · объективное и субъективное» | `screens.jsx:175` |
| I · Experiment | `I · Эксперимент (future)` | `experiment.jsx` |
| J · Trade-off | `J · Компромиссы (future)` | `system.jsx` |
| J · System Review | `J · Обзор системы (future)` | `system.jsx` |

Supporting material present: `README.md` (implementation semantics), `data.js` (seed fixtures), `primitives.jsx` (shared AA primitives), `analytics.css` (styling), desktop + mobile variants, mobile provenance sheet.

---

## 7. Semantic invariant verification

### PASS

| Invariant | Evidence |
| --- | --- |
| Forbidden «ухудшался» absent | zero hits across the kit |
| Project neutral wording | `data.js:170` — «Прогноз срока пересматривался · 20 → 24 → 26 авг; факт 25 авг» |
| Actual not counted as forecast version | `domains.jsx:97` — `P.forecasts.filter(f => !f.actual)` → «версий прогноза 3 · факт отдельно» |
| Finance Target not set | «Цель на месяц … не задавалась» (explicit, not zero) |
| −₴800 neutral vs expectation | `desire: 'neutral'` at `domains.jsx:42`, `screens.jsx:89`, `screens.jsx:359`; sub «ниже ожидания · цель не задавалась» |
| Project deltas neutral | `domains.jsx:132-133` — `+5 дней` / `−1 день`, both `desire: 'neutral'` |
| System Review «Это не вердикт» | `system.jsx:169` |
| −₴800 under «Что менялось» | `data.js:172` (in `changed`, not `improved`) |
| «Что улучшилось» grounded only | `data.js` `improved` = single sleep-rule item with `basis: 'по вашему ориентиру: не работать после 00:30'` |
| Expectation excluded as desirability ground | on-screen note `system.jsx:173-176` — «Ожидание не подходит: оно предсказывает, а не предписывает» |
| No global score | `system.jsx:55` — «Общего балла нет и не будет» |
| Factor tags = explicit menu | `primitives.jsx:227-249` — 4 kinds + «убрать фактор», `role="menuitem"`; no click-to-cycle code |
| Experiment future days ≠ missed | `experiment.jsx:38` — `i < adherence.kept ? 'kept' : (i < elapsed ? 'missed' : 'future')` |
| Partial adherence valid | «Частичное соблюдение — обычное состояние, а не брак данных» |
| `AAFacts` vs `AADelta` ownership | `primitives.jsx:92` `AAFacts` accepts no `delta`/`desire`; used at `experiment.jsx:102` for baseline/intervention/period |
| Home signals below first panel row | `screens.jsx:20-41` — ordinary row first, then «системные сигналы»; quiet zero state; max 0–3 |
| Data quality = contextual strip | `AAQualityStrip` with in-place «подробнее» expansion; no tab, no global banner |
| Demo chrome documented as preview-only | AA `README.md:162-164` — `.aa-phone` / `.aa-shell` / `.aa-rail` / `.aa-stage*` explicitly excluded from product code |

### FAIL — regression (blocking the freeze tag)

**`preview/aa-delta.html`** — stale specimen card from an earlier design pass, contradicting the accepted contract that the same export documents:

- line 11: eyebrow «деньги · ниже ожидания **(желательно)**»
- line 15: `data-desire="favorable"` on `−₴800`, sub «ниже ожидания» (no «цель не задавалась»)

This is precisely the forbidden pattern *"old favorable coloring of −₴800 based only on expectation"*. Confirmed visually: the card renders −₴800 in **green**.

Secondary in the same file: line 19/23 «дата · **нежелательно**» with `+7 дней` `unfavorable` — expectation-derived normativity, and inconsistent with the accepted Project timeline (`+5 дней` / `−1 день`, both neutral).

The kit's own C gallery (`screens.jsx:353-390`) is **correct** and supersedes this card. The card was therefore **excluded from the import** so the repository contains no semantic regression. It remains in the read-only export.

### Observation — not blocking, owner review suggested

In the kit's C variant gallery, two specimens use `desire: 'unfavorable'` derived from an expectation rather than a Target/Preference/Decision:

- `screens.jsx:364` — «деньги · выше первоначального ожидания» `+₴11,200` → `unfavorable`
- `screens.jsx:384` — «вместо факта — прогноз» `+₴5,800` → `unfavorable`

These are gallery specimens whose purpose is to demonstrate that the `unfavorable` visual state exists (the pattern inventory lists six states). The **binding** Finance case (`−₴800`) is correct as neutral in all three of its occurrences, and the README rule text is correct. Flagged for the owner because the chosen examples sit in tension with the stated rule, not because a named invariant failed.

---

## 8. Render / visual verification — **PASS**

Method: repository-supported path per `.design-sync/NOTES.md` (Chrome automation against a served tree; no Playwright/Chromium cache on this machine). Served the **integration worktree** via Python stdlib `http.server` on `127.0.0.1:8777`. **No dependencies were installed. No external system was mutated.**

| Surface | Result |
| --- | --- |
| A · Home (desktop, paradise) | Signals render **below** the first ordinary panel row under a quiet «системные сигналы» eyebrow; 3 signals; only the budget-trigger signal is warm |
| C · Delta gallery | 7 variants; Finance case neutral |
| D · Forecast history | `−1 день` neutral grey; «версий прогноза 3 · наблюдений 2»; факт tagged «наблюдение» |
| E · Review | Step 1 read-only delta, «пропустить» present as left button |
| F · Finance (desktop) | `−₴800` neutral; «Цель на месяц … не задавалась»; forecast ₴67,800 neutral grey; quality strip «покрытие 28/31 · исправлений 1 · оценочных 0 · подробнее»; warm signal strip only for budget ≥80% |
| G · Project (desktop) | Two deltas side by side, both neutral; «версий прогноза 3 · факт отдельно»; 5-event semantic history |
| G · Project (mobile) | Both `AADelta` rows collapse cleanly to stacked cells inside the 390px frame; no overflow, no collision |
| I · Experiment | Hypothesis labelled «предположение, не факт»; baseline/intervention/period as `AAFacts`; adherence 9/14 with future days dashed-light, **not** drawn as misses |
| J · Trade-off | «Общего балла нет и не будет»; one card per change with its own unit; «не решил ▾» default; «частичные данные» tags; contradiction block retained |
| J · System Review | «Это не вердикт»; `−₴800` under «Что менялось»; «Что улучшилось» contains only the ориентир-grounded sleep rule with its grounding printed |
| Mobile provenance sheet | Bottom sheet with grip; scrim **contained inside** the 390px frame and does **not** cover the rail; four rows (источник / основание / когда / как); closes with «Полная история — на экране показателя» |
| `preview/aa-signal-card.html` | 6 states; single warm case correctly labelled as the budget ≥80% stakes trigger |
| Console | No errors or exceptions |

**Note:** the AA `README.md` "Status" section (lines 166–175) claims the preview harness was unavailable, that four F/G/mobile checks were "owed", and that *"I · Experiment and J · Trade-off / System Review are not started"*. All four owed checks **now pass**, and I and J are demonstrably present and complete. That Status block is stale relative to the rest of the same file (which documents Passes 3 and 4 as delivered) and should be refreshed Design-side.

---

## 9. Regression safety — **PASS**

- `ui_kits/life-os/**` — untouched; all 9 files the export would have downgraded remain at local (newer) content. Verified absent from `git diff`.
- `ds-bundle/**` (134 files), `apps/**` (8,047), `tests/**` (1,643), `screenshots/**` (137), `export_claude_lifeOS/**` (40), `consensu-dashboard-deploy/**` (32), `uploads/**`, `.design-sync/**` — all preserved; none present in the diff.
- `.design-sync/**` infrastructure preserved; repo-specific sync conventions (`config.json` `readmeHeader`, converter-off shape) respected — this is why `README.md`/`SKILL.md`/`components/**` were not imported.
- **Unexpected deletions: none.**
- **Application / backend / package / migration changes: none.** `apps/**` untouched; no `package.json`, no dependency, no migration touched.

---

## 10. Final git state

```
INTEGRATION_WORKTREE=/Users/yurasachenko/LifeOS/LifeOS_DesignSystem-adaptive-analytics-import
INTEGRATION_BRANCH=design/adaptive-analytics-import
```

Diff attributable to this task:

- **11 new files** — `ui_kits/life-os-analytics/` (10) + `preview/aa-signal-card.html`
- **51 modified files** — `preview/*.html`, one `@dsCard` metadata line each (49 replacements + 2 marker additions), 51 insertions / 49 deletions total
- **0 deletions**
- `git diff --check` clean

Original repository invariants:

```
ORIGINAL_REPOSITORY_MUTATED=NO
ORIGINAL_START_HEAD_UNCHANGED=YES  (67a1456c6165e9bdf36382a98c9713c4ed981314)
ORIGINAL_PREEXISTING_DIRTY_STATE_PRESERVED=YES
```

---

## 11. Commit / tag

Exact-path staging was used (never `git add .`). The staged set contains only the imported design files and this task's own reports — no pre-existing user work.

- `DESIGN_COMMIT` — see §12 of the summary report
- `DESIGN_TAG=NO` — withheld. §20 permits the `adaptive-analytics-design-accepted` tag only when there is **no unresolved import conflict**. `preview/aa-delta.html` is an unresolved conflict, so the freeze is not stamped.
- `PUSH=NO`, `DEPLOY=NO` — no remote or external mutation.

---

## 12. Next actions

1. **Resolve `preview/aa-delta.html`** (blocks the freeze tag). Either:
   - regenerate the card Design-side so `−₴800` is `data-desire="neutral"` with sub «ниже ожидания · цель не задавалась», and the date row matches the accepted `+5 дней` / `−1 день` neutral timeline; or
   - authorize a two-attribute local correction, after which the card can be imported and the tag created.
2. **Decide on `components/core/**` + `components/patterns/**`** (65 files) — import as a separate reviewed change, or leave the repo on its documented converter-off shape.
3. **Refresh the AA `README.md` Status block** — it understates the delivered work (claims I/J not started; claims four checks owed that now pass).
4. **Optional:** add a pointer to `ui_kits/life-os-analytics/` in root `SKILL.md` so the new kit is discoverable through the skill. Deliberately *not* done here — it is an authored change, not part of the accepted export.
5. **Review the two C-gallery `unfavorable` specimens** (§7 observation).
6. Once 1 is resolved and the tag exists, proceed to the Adaptive Analytics technical architecture Discovery (explicitly out of scope for this task).

The integration worktree is **left in place** for owner inspection and the next phase.

---

# 13. FINAL RESOLUTION — semantic freeze (appended 2026-09-08)

This section is appended, not rewritten. The blocker recorded in §7 and §11 was real; what
follows is how it was resolved. Everything above remains an accurate record of the state at
commit `d99da15`.

## 13.1 What was outstanding

| # | Item | Status at `d99da15` |
| --- | --- | --- |
| 1 | `preview/aa-delta.html` — `favorable` on `−₴800` from expectation alone | **BLOCKER** — card excluded from the import |
| 2 | C gallery: `+₴11,200` and `+₴5,800` encoded `unfavorable` from expectation/forecast alone | reported as an *observation* — **promoted by the owner to a required fix** |
| 3 | AA `README.md` Status block claiming I/J not started and four checks owed | stale, factually false at the intended freeze commit |

Item 2 is the substantive change of scope in this pass. In the first report these two
specimens were flagged but not treated as violations, on the reasoning that they were gallery
specimens and that the *binding* Finance case was correct. The owner ruled that the semantic
model governs specimens too — **visual specimen requirements do not override semantic
correctness** — and that expectation and forecast are both predictive/reference semantics
that cannot establish desirability. That ruling is correct and is now enforced.

## 13.2 Corrections applied

### `preview/aa-delta.html` — recreated, corrected (now imported)

The excluded export card was not imported as-is. A corrected card was written in its place:

| Specimen | Before (export) | After |
| --- | --- | --- |
| money | eyebrow «деньги · ниже ожидания **(желательно)**»; `data-desire="favorable"`; sub «ниже ожидания» | eyebrow «деньги · ниже ожидания · цель не задавалась»; `data-desire="neutral"`; sub «ниже ожидания · цель не задавалась» |
| date | eyebrow «дата · **нежелательно**»; `18 авг` vs `25 авг` → `+7 дней` `unfavorable` | split into the two accepted Project comparisons: «дата · к первой оценке» (`20 авг` → `25 авг` = `+5 дней`) and «дата · к последнему прогнозу» (`26 авг` → `25 авг` = `−1 день`), **both `neutral`** |
| duration | `+24 м` `neutral` | unchanged |
| incomplete / forecast | `рано судить` `unknown` | unchanged |
| no data | `—` `unknown` | unchanged |

A rule line was added at the head of the card, mirroring the C gallery's own intro, so the
card is self-documenting about why every delta is neutral:

> Знак, желательность и серьёзность — разные вещи. Ожидание и прогноз предсказывают, а не
> предписывают: «ниже ожидания» само по себе не «лучше», «выше прогноза» само по себе не
> «хуже». Желательность появляется только при цели, ориентире или решении.

The `@dsCard` marker, group, name and subtitle are preserved from the export; `viewport` was
widened `700x480` → `700x560` to fit the added sixth row.

### C gallery (`ui_kits/life-os-analytics/screens.jsx`) — the **Preferred** resolution

The owner offered two routes. The **Preferred** route (keep the analytical meaning, make the
state neutral) was taken for both, because neither specimen has any normative source to
represent — inventing a Target purely to justify a colour would have been the weaker fix.

```
'деньги · выше первоначального ожидания'           →  '… → тоже нейтрально'
  +₴11,200  desire: 'unfavorable'  sub: 'к первой оценке'
  →  desire: 'neutral'  sub: 'выше первой оценки · цель не задавалась'

'вместо факта — прогноз'
  +₴5,800   desire: 'unfavorable'  sub: 'если тренд сохранится'
  →  desire: 'neutral'  sub: 'прогноз выше ожидания · если тренд сохранится'
```

Two points worth recording:

1. **This is a genuine semantic fix with almost no visual delta.** `analytics.css:82-83`
   styles `unfavorable` as `--fg1` / `--fg2` — i.e. already visually neutral, per design
   decision #3 («+»/«−» neutral by default, the sub-line carries the meaning). Only
   `favorable` (`--green-2`) encodes tone. So the *rendered* regression was confined to
   `aa-delta.html`; the C gallery's fault was in the data model, which is exactly where it
   would have propagated into implementation.
2. **The gallery previously contradicted its own header.** `screens.jsx:397` already read
   «Ожидание предсказывает, а не предписывает… Желательность появляется только при цели,
   ориентире или решении» while two of its seven specimens did the opposite. All seven now
   obey it.

**Consequence, stated explicitly:** no specimen in the kit now demonstrates the `favorable`
or `unfavorable` visual states. That is the correct outcome under the accepted model — those
states require a Target / Preference / Decision, and no seeded scenario currently has one for
a delta. The `AADelta` pattern-inventory row (README §Pattern inventory) still correctly
documents the states the *primitive* supports; it does not claim the gallery specimens them.
No specimen was invented to fill the gap, per the binding rule.

### AA `README.md` — Status block refreshed

Only the `## Status` section was replaced. All accepted semantic rules, the pattern
inventory, the flow map, the F/G comparison table, the `AADelta`/`AAFacts` ownership rule and
the preview-only-techniques section are untouched.

The new Status block records: an area-by-area accepted table for A–J (11 rows + mobile
provenance), the four formerly-owed F/G/mobile checks marked run and passing with their
results, desktop/mobile visual verification passed with no console errors, and a new
**Final semantic guardrails applied at freeze** subsection documenting both corrections
above so the README carries its own history.

## 13.3 Re-verification — all PASS

| Invariant | Evidence |
| --- | --- |
| No `favorable`/`unfavorable` anywhere in kit or AA cards | grep across `ui_kits/life-os-analytics/**` + `preview/aa-*.html` returns **zero** value assignments; only `analytics.css:81-83` (state definitions, must remain) and the README history note |
| Expectation never establishes desirability | C gallery desire values now: **5 × `neutral`, 2 × `unknown`** |
| Forecast never establishes desirability | `+₴5,800` (forecast-vs-expectation) now `neutral` |
| `−₴800` neutral everywhere | `domains.jsx:42`, `screens.jsx:89`, `screens.jsx:359`, `preview/aa-delta.html:16` — all `neutral` with «цель не задавалась» |
| Project deltas neutral | `+5 дней` / `−1 день` neutral in `domains.jsx:132-133`, `screens.jsx:369`, `screens.jsx:210`, `preview/aa-delta.html:24,32` |
| `ухудшался` absent | zero hits |
| Expectation excluded as a desirability ground | `system.jsx:177` on-screen; README «An Expectation does not qualify» |
| System Review Finance item under «Что менялось» | `−₴800` present in `changed`, **absent** from `improved` (verified by parsing the `systemReview` block) |
| «Что улучшилось» grounded only | exactly 1 item, carrying `basis` «по вашему ориентиру: не работать после 00:30» |
| Materiality independent of desirability | `primitives.jsx:43-50` — warmth driven by `signal.stakes`, never by `desire` |

### Render re-verification (affected surfaces only)

Served the integration worktree on `127.0.0.1:8778`; no dependencies installed.

| Surface | Result |
| --- | --- |
| `preview/aa-delta.html` | `−₴800` renders **neutral dark**, no green anywhere on the card; `+5 дней` and `−1 день` both neutral; rule line renders; 6 rows, no overflow |
| C · Expected/Actual/Delta | all 7 specimens neutral/unknown; «→ тоже нейтрально» label and «выше первой оценки · цель не задавалась» sub-line correct |
| F · Finance | unchanged and correct — `−₴800` neutral, «Цель на месяц задаёт желательность · не задавалась», warm strip only from the budget ≥80% stakes trigger |
| J · System Review | unchanged and correct — «Это не вердикт»; `−₴800` under «Что менялось»; «Что улучшилось» holds only the ориентир-grounded sleep rule with its grounding printed |
| Console | no errors or exceptions (verified after a fresh load) |

**No unintended green or warm desirability encoding from expectation or forecast alone
remains on any surface.** No `unfavorable` specimen remains in C, so no normative source
needs to be proven.

## 13.4 Decisions carried forward unchanged

`components/core/**`, `components/patterns/**`, `github.md` — still **deferred**, owner-reviewed
decision, does not block the A–J freeze. Stale `ui_kits/life-os/**` — still **not imported**.
`_ds_bundle.js` — still **not replaced**. Root `SKILL.md` — **not modified** in this task.
No application, backend, database, package or migration code touched.
