# STOP AUDIT — PF-01 Batch 0 pre-implementation

**Phase:** C pre-edit change-safety audit
**Date:** 2026-07-21
**Basis HEAD:** `f82ec642747eca051be904a1cccf2ddb83ac1910` (`design-sync-setup`)
**Approved plan basis:** `Outputs/Plans/lifeos-production-foundation_plan_2026-07-21_011746.md`
**Result:** STOP before editing or committing

## Evidence checked

- **VERIFIED (HEAD `f82ec64`):** current branch is `design-sync-setup`; HEAD still matches the approved Plan basis.
- **VERIFIED (WT atop HEAD `f82ec64`):** the tracked dirty set remains ten files and `+533/-265`; `.DS_Store` is one of them and is excluded from staging.
- **VERIFIED (HEAD `f82ec64`):** `git log --` for the nine Life OS files contains only `17dbd74 first commit`; no later landed commit intersects Batch 0.
- **VERIFIED (WT atop HEAD `f82ec64`):** `git diff --check` returns zero errors.
- **UNKNOWN:** `Outputs/backlog-tasks/task_log.md` and `claude_observations.md` do not exist, so they cannot provide evidence of an earlier deliberate decision.

## Planned changes that are present

- **VERIFIED:** debug rail is gated by `?debug` in `ui_kits/life-os/App.jsx:9-14,423-447`.
- **VERIFIED:** add-goal flow is implemented through `GoalsWidget`, `LifeDataProvider.addGoal`, `GoalsPage`, and RU/UA strings in `ui_kits/life-os/GoalsWidget.jsx:3-70`, `LifeDataProvider.jsx:113-123,301-317,463-470`, `pages/RelocatedPages.jsx:21-35`, `i18n.jsx:418-419,978-979`.
- **VERIFIED:** width caps, 12px readability floor, focused-search surface, active navigation, unified capsules, tasks toolbar, and finance copy are represented in the dirty diff and correspond to the approved Batch 1 plus `BATCH1-FIX-PROMPT.md` fixes 1-3 and 5-8.

## Surprises requiring owner sign-off

### 1. Manual paradise day/night control

- **VERIFIED:** `ui_kits/life-os/App.jsx:68-78,106-168` adds persistent `lifeOsScene` state and changes the theme-controller contract from three to five values.
- **VERIFIED:** `ui_kits/life-os/SettingsPage.jsx:158-168,197-205` adds the user-facing Auto/Day/Night control.
- **VERIFIED:** `ui_kits/life-os/index.html:20-37` changes the pre-paint scene resolver to honor the new key.
- **VERIFIED:** RU/UA strings are added at `ui_kits/life-os/i18n.jsx:531-535,1082-1086`.
- **VERIFIED:** neither the approved PF-01 Plan Batch 0 mapping nor the earlier `lifeos-refinement_plan_2026-07-01.md` includes this feature.
- **Risk:** medium. It adds a persisted state key with writers/readers and changes shared theme context, so silently bundling it violates Plan adherence.
- **Recommendation:** preserve and include it in Batch 0 because it makes the required four-scene QA deterministic, but only after explicit owner approval.

### 2. Paradise-day logo recolor

- **VERIFIED:** `ui_kits/life-os/Sidebar.jsx:68-70` adds `.logo-word`; `ui_kits/life-os/styles.css:4448-4451` makes the wordmark dark in paradise-day.
- **VERIFIED:** the earlier approved plan's binding not-touched list explicitly says the wordmark is not changed.
- **Risk:** low technically, but it reverses a prior scope boundary.
- **Recommendation:** preserve as a contrast fix only with explicit owner approval.

### 3. FIX 4 uses a rounded plate, not the default full-width soft scrim

- **VERIFIED:** `ui_kits/life-os/styles.css:4453-4474` implements a rounded, bordered plate around `.tb-left` and `.page-head`.
- **VERIFIED:** `BATCH1-FIX-PROMPT.md` default direction asks for a soft gradient scrim spanning content width, but permits a user-selected Claude Design alternative.
- **UNKNOWN:** no saved approval record proves that "Hero-подложка variant 1a" was the selected alternative; only the code comment states it.
- **Risk:** medium visual/scope risk; changing it now could overwrite a deliberate user selection, while committing it without confirmation may lock in an unapproved alternative.
- **Recommendation:** keep the existing plate if it is the selected Claude Design variant; otherwise re-plan the scrim before editing.

## State lifecycle impact of surprise 1

| Event | Current dirty behavior |
|---|---|
| Writer | Settings writes `day`/`night`; Auto removes `lifeOsScene` |
| Runtime reader | `useTheme` reads the key and skips the minute clock for a manual scene |
| Pre-paint reader | `index.html` reads the same key to avoid a wrong-scene flash |
| Clearer | Selecting Auto removes the key |
| Restart | Browser reload preserves manual day/night through localStorage |
| Corrupt value | Falls back to Auto |
| Double-tap | Idempotent local state/key replacement |
| Deploy race | Old code ignores the extra localStorage key; new code handles absence, so both directions are safe |

## Invariants

- **Billing:** VERIFIED N/A on HEAD `f82ec64`; no billing path is touched.
- **Status machine:** VERIFIED N/A; no task status behavior is touched.
- **FSM:** VERIFIED N/A; no aiogram/FSM exists in this UI code.
- **Telegram callback data:** VERIFIED N/A; no Telegram keyboard exists.
- **Persistence:** VERIFIED impacted only by the unplanned `lifeOsScene` key and the planned persisted `goals` field.

## Actions deliberately not taken

- No source code edited.
- No user-owned dirty hunk reverted or staged.
- No browser QA run because the exact variant to verify is not yet signed off.
- No commit, push, or deployment performed.

## Required sign-off

Confirm whether Batch 0 must retain all three existing choices:

1. manual Auto/Day/Night control;
2. dark paradise-day wordmark;
3. rounded "Hero-подложка 1a" header plate.

After confirmation, Batch 0 can proceed to browser QA and one atomic commit.
