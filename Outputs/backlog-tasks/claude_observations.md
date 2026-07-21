# Claude observations

No out-of-scope observations recorded during PF-01 Batch 0.

## [2026-07-21] During Task PF-01 Batch 1: stale JS/JSX source count in production plan
**File:** Outputs/Plans/lifeos-production-foundation_plan_2026-07-21_011746.md:101
**Issue:** The plan says 63 current JS/JSX files, while HEAD `7be0d82` contains 61. The migration re-anchored by the complete script-order and symbol inventory and migrated all 61 live files.
**Risk:** low
**Recommended action:** Use the symbol-anchored 61-file HEAD inventory as the Batch 1 basis; do not treat the stale count as two missing modules.

## [2026-07-21] During Task PF-01 Batch 2: architecture document describes the retired browser-Babel runtime
**File:** ARCHITECTURE.md:7
**Issue:** The architecture reference still says the application runs JSX through Babel in the browser, while the tracked application now uses Vite scripts and ES modules in `apps/web/package.json:5-20`.
**Risk:** medium
**Recommended action:** Refresh ARCHITECTURE.md in a dedicated documentation task after the backend/frontend production topology is finalized.

## [2026-07-21] During Task PF-01 Batch 2: habit toggles bypass the persisted Life OS snapshot
**File:** apps/web/src/components/HabitsGrid.jsx:21
**Issue:** HabitsGrid owns its mutable habit state locally, while the shared persisted snapshot only initializes `habits` at `apps/web/src/context/LifeDataContext.jsx:107`; server snapshot storage alone will not persist habit toggles.
**Risk:** medium
**Recommended action:** Move habits into the shared LifeDataContext contract in a separate Batch 3 frontend task with migration coverage.

## [2026-07-21] During Task PF-01 Batch 3: foundation plan describes a retired empty-snapshot bootstrap
**File:** Outputs/Plans/lifeos-production-foundation_plan_2026-07-21_011746.md:313
**Issue:** The broad PF-01 foundation plan says bootstrap creates an empty snapshot, while the deliberate Batch 2 API contract creates no snapshot row and returns typed `404 state_not_initialized` until the first expected-revision-0 PUT.
**Risk:** medium
**Recommended action:** Re-anchor future frontend and deployment work to the live Batch 2 state API contract; correct the foundation plan in a dedicated documentation task instead of recreating an empty row.
