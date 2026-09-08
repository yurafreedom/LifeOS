# Adaptive Analytics A–J design import — summary

**2026-09-08 · `DESIGN_IMPORT_STATUS=BLOCKED`** (import applied + committed; freeze tag withheld)

Full report: `Outputs/Implementations/lifeos-adaptive-analytics-design-import_20260908-040245.md`

## What happened

The accepted Claude Design A–J Adaptive Analytics package was reconciled into an isolated Git worktree
(`../LifeOS_DesignSystem-adaptive-analytics-import`, branch `design/adaptive-analytics-import`, from
`67a1456`). The owner's original working directory was **not modified**.

## Imported (12 files)

- `ui_kits/life-os-analytics/**` — 10 files, the full A–J contract
- `preview/aa-signal-card.html`
- `preview/*.html` — 51 files, `@dsCard group=` gallery taxonomy only (no render change)

## Deliberately not imported

| What | Why |
| --- | --- |
| `ui_kits/life-os/*` (9) | **Export is stale** — pre-Batch-1. Local `styles.css` carries 44 Batch-1 markers, export 0; export lacks the `goal-add` affordance entirely. Local preserved. |
| `_ds_bundle.js` + 2 build artifacts | Regenerated; embeds the **stale** life-os kit alongside the new AA kit |
| `README.md` | Export = `.design-sync/conventions.md` + local README, byte-exact (upload build artifact) |
| `SKILL.md`, `styles.css`, `assets/*.svg` | Comment reflow / whitespace / references to non-imported `components/` |
| `components/**` + `github.md` (66) | New Design surface, **outside the A–J brief**, and contradicts `.design-sync/NOTES.md` (repo is off the converter envelope, ships no importable components). Deferred for owner decision. |
| `preview/aa-delta.html` | **Semantic regression** — see below |

## The blocker

`preview/aa-delta.html` is a stale specimen card that renders **−₴800 in green** with
`data-desire="favorable"` and the eyebrow «ниже ожидания **(желательно)**» — the exact forbidden
pattern of deriving desirability from an expectation alone. The kit's own C gallery is correct
(`neutral`, «цель не задавалась») and supersedes it. The card was excluded so the repository holds
no regression; the freeze tag is withheld until it is resolved Design-side.

## Verification

- **A–J source: PASS** — all 11 rail surfaces + H inline, README, fixtures, primitives, styles, desktop + mobile, mobile provenance sheet.
- **Semantics: PASS** (one FAIL isolated to the excluded card) — −₴800 neutral, Project deltas neutral, actual excluded from forecast count, «Что улучшилось» grounded only in the ориентир, «Это не вердикт», no global score, explicit factor menu, future experiment days not counted as missed, `AAFacts` ≠ `AADelta`.
- **Visual: PASS** — 13 surfaces rendered in Chrome against the integration worktree; no console errors. All four checks the AA README listed as "owed" now pass; that README Status block is itself stale.
- **Regressions: none.** No deletions. `apps/**`, `tests/**`, `ds-bundle/**`, `.design-sync/**` untouched. No DB/package/migration change.

## State

```
ORIGINAL_REPOSITORY_MUTATED=NO
PREEXISTING_DIRTY_PRESERVED=YES
PUSH=NO   DEPLOY=NO   DESIGN_TAG=NO
```

## Next

1. Fix or regenerate `preview/aa-delta.html` → then create `adaptive-analytics-design-accepted`.
2. Decide on `components/**` (65 files) as a separate reviewed change.
3. Refresh the AA README Status block (understates delivered work).
4. Technical Discovery only after the freeze tag exists.
