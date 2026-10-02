# STOP AUDIT — PF-01 Batch 0 QA conflict

**Phase:** C browser QA, pre-commit
**Date:** 2026-07-21
**Basis HEAD:** `f82ec642747eca051be904a1cccf2ddb83ac1910` (`design-sync-setup`)
**Result:** STOP before source edit/commit due to a prior-decision conflict

## Confirmed QA results

- **VERIFIED (WT atop HEAD `f82ec64`, browser at `127.0.0.1:4173`):** dark, light, paradise-day, and paradise-night each rendered in RU and UK — exactly eight combinations — with zero horizontal document overflow.
- **VERIFIED:** manual paradise scene selection produced `data-scene=day|night`; paradise-day logo fill was `rgb(26,31,41)`, paradise-night fill was `rgb(245,245,247)`.
- **VERIFIED:** focused paradise-day search used opaque `rgba(255,251,246,0.96)` with matching dark text/caret `rgb(26,31,41)`.
- **VERIFIED:** plain URL rendered zero `.demo-rail`; `?debug` rendered exactly one rail with 12 expected controls.
- **VERIFIED:** goal QA changed exactly 3→4 rows; the unique new goal remained exactly once after reload; task and note sidebar counts remained `5` and `4`.
- **VERIFIED:** Tasks toolbar and list card both measured 680px at the same x coordinate; all Task capsules were 26px; inactive capsules were cream and the active capsule was orange/white.
- **VERIFIED:** modified surfaces stayed left-anchored and bounded: dog 680px; habits ≤1040px; medications/settings ≤1040px; finance ≤680px; Home hero/charts remained wide at 1016px.
- **VERIFIED:** capsule heights were consistently 26px across Tasks, Finances, Medications, Settings, and Home charts.

## Conflict discovered

- **VERIFIED:** the shared rule at `ui_kits/life-os/styles.css:1618-1626` makes every `.chart-segctrl-btn.is-on` orange/white.
- **VERIFIED:** the more specific deliberate override at `ui_kits/life-os/styles.css:2244-2253` makes `.chart-segctrl.is-quiet .chart-segctrl-btn.is-on` neutral.
- **VERIFIED:** `ui_kits/life-os/pages/home/CategoryChart.jsx:146-151` opts the category-period control into `is-quiet`; browser QA therefore rendered active «месяц» neutral, while active «расходы» was orange.
- **VERIFIED:** `BATCH1-FIX-PROMPT.md` FIX 6 says active capsules across all six surfaces should be orange/white.
- **VERIFIED:** `MASTER-PROMPT.md` non-negotiable color discipline reserves orange for stakes, and the current override comment explicitly identifies the category chart as a non-stakes row.
- **Risk:** changing the override would satisfy FIX 6 literally but reverse a deliberate stakes-color decision; retaining it preserves the higher-level color invariant but requires an explicit accepted deviation from the approved QA wording.

## Recommendation

Retain the neutral active state for `.chart-segctrl.is-quiet` and treat it as the single intentional exception to FIX 6. This preserves “orange = stakes” and changes no existing user-approved visual.

## Actions not taken

- No source code edited.
- Nothing staged or committed.
- Browser QA stopped before declaring Batch 0 green.

## Required sign-off

Confirm: retain the neutral active «месяц/30 дней» CategoryChart capsule as the intentional non-stakes exception.
