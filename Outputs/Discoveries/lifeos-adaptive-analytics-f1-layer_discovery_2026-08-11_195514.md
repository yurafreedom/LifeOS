# DISCOVERY — LifeOS Adaptive Analytics / F1-inspired Learning Layer

**Phase:** `PHASE_A_DISCOVERY`
**Mode:** `READ_ONLY`
**Repository:** `/Users/yurasachenko/LifeOS_DesignSystem`
**Branch:** `design-sync-setup`
**HEAD:** `67a1456c6165e9bdf36382a98c9713c4ed981314`
**Baseline drift:** `NO`
**Audited at:** `2026-08-11 19:55:14 EEST`

## Evidence convention

- Every implementation statement tagged `VERIFIED_CURRENT_CODE` was checked on HEAD `67a1456c6165e9bdf36382a98c9713c4ed981314`; its citation gives the current file and line anchor.
- `VERIFIED_HISTORICAL_INTENT` refers only to the reconstructed forensic artifacts and retains their `PROPOSED`, `UNRESOLVED`, `SUPERSEDED`, and `INSUFFICIENT_ARCHIVE_EVIDENCE` states.
- `USER_NEW_DIRECTION` is the new product direction in the task prompt, not historical LifeOS evidence.
- Recommendations remain `DISCOVERY_RECOMMENDATION`; they are not approved requirements or architecture.
- Unresolved choices introduced by this proposal are `NEW_PRODUCT_DECISION_REQUIRED`; no historical IDs are created.

## 1. Executive verdict

| Field | Verdict | Evidence / rationale |
| --- | --- | --- |
| `SHOULD_ADAPTIVE_ANALYTICS_EXIST` | `YES_WITH_CONSTRAINTS` | `USER_NEW_DIRECTION` — the learning loop can extend LifeOS from recording current state to comparing expectations with outcomes. `DISCOVERY_RECOMMENDATION` — constrain it to evidence, explicit uncertainty, domain trade-offs, and no global score. |
| `CURRENT_ARCHITECTURE_CAN_HOST_LAYER` | `PARTIALLY` | `VERIFIED_CURRENT_CODE` — React/Vite can host new surfaces and FastAPI/PostgreSQL can host new contracts, but the current API exposes one whole-snapshot resource and the DB stores only its latest revision (`apps/web/package.json:14-22`, `apps/api/app/routes/state.py:15-59`, `apps/api/app/models/user_snapshot.py:12-31` @ HEAD). |
| `CURRENT_HISTORY_SUPPORT` | `PARTIAL` | `VERIFIED_CURRENT_CODE` — dated transactions, dose logs, pharmacy notes and a bounded activity log exist inside the current snapshot, but task/goal/habit history and immutable snapshot revisions do not (`apps/web/src/context/LifeDataContext.jsx:47-130,382-395,504-513`, `apps/web/src/lib/activity.js:9-72`, `apps/api/app/services/state.py:17-63` @ HEAD). |
| `GTD_COMPATIBILITY` | `COMPLEMENTARY` | `VERIFIED_HISTORICAL_INTENT` — GTD answers what deserves attention and what to do; Adaptive Analytics answers what happened and what to learn. It must preserve Capture → Inbox/raw note → Clarify → six outcomes (`export_claude_lifeOS/_lifeos_forensic/08_gtd_system.md:10-23,147-170`). |
| `DASHBOARD_INTEGRATION` | `POSSIBLE_WITH_DESIGN` | `VERIFIED_CURRENT_CODE` — Home already has KPI and chart primitives, but its composition is hard-coded and partly mock/seed-backed (`apps/web/src/pages/HomePage.jsx:33-79,121-150`, `apps/web/src/data/dashboard-seed.js:3-7` @ HEAD). `VERIFIED_HISTORICAL_INTENT` — read-mostly vs actionable Home remains unresolved (`export_claude_lifeOS/_lifeos_forensic/14_conflicts_and_supersessions.md:69-77`). |
| `CURRENT_STYLE_GUIDE_SUFFICIENT` | `VISUAL_ONLY` | `VERIFIED_CURRENT_CODE` — tokens, cards, charts, responsive grids, states and themes are reusable (`apps/web/src/styles.css:8-180,2104-2285,2773-2847,4198-4227` @ HEAD). `DESIGN_REQUIRED` — analytical semantics, provenance, uncertainty and review flows are not defined by those visual rules. |
| `CLAUDE_DESIGN_REQUIRED` | `YES` | `DESIGN_REQUIRED` — a bounded interaction package is required before implementation planning; section 18 defines the minimum package. |
| `RECOMMENDED_NEXT_PHASE` | `PRODUCT_DECISIONS → CLAUDE_DESIGN → TARGETED_TECHNICAL_DISCOVERY → PHASE_B_PLAN` | `DISCOVERY_RECOMMENDATION` — resolve semantic/placement decisions first, design the interaction contract, then perform a narrow storage/event-capture audit against that contract. |

**Direct design answer:** `DESIGN_REQUIRED` — the current guide is sufficient for visual language, not for implementing trustworthy analytical interaction. Claude Design should define the smallest four-part MVP package: Signal Card, Expected-vs-Actual/Delta, Metric History, and Review/Debrief (including uncertainty/provenance states and responsive placement).

**Direct code-audit answer:** `DISCOVERY_RECOMMENDATION` — this Phase A is sufficient to establish feasibility, boundaries, major integration points and the architectural tension. It is not sufficient for a safe implementation Plan because the product/design contract is still open. After that contract is approved, run one narrow technical Discovery of event capture, retention, migration/API shape and snapshot coexistence; do not rerun a full repository audit.

## 2. Repository anchor and drift status

- `VERIFIED_CURRENT_CODE` — branch is `design-sync-setup`; HEAD is `67a1456c6165e9bdf36382a98c9713c4ed981314`; it exactly equals the requested guardrail, so `BASELINE_DRIFT=NO` (read-only `git branch --show-current` and `git rev-parse HEAD`, 2026-08-11).
- `VERIFIED_CURRENT_CODE` — the three materially relevant landed commits are `6c7039a` (Vite production build), `102aea4` (authenticated multi-account API), and `67a1456` (per-account state sync); no re-anchoring beyond current symbols is required (`git log --oneline -- apps/web/src apps/api/app`, checked at the same HEAD).
- `VERIFIED_CURRENT_CODE` — the worktree was already dirty before this audit: `.DS_Store` and `Outputs/backlog-tasks/task_log.md` modified; multiple untracked documentation/output/test trees. They are pre-existing and untouched. `UNKNOWN` — ownership/purpose of each untracked artifact was not investigated because it is outside this Discovery.
- `VERIFIED_CURRENT_CODE` — `ARCHITECTURE.md` describes the obsolete single-user/Babel/localStorage generation (`ARCHITECTURE.md:1-38` @ HEAD). Current code instead uses React 18/Vite and server sync (`apps/web/package.json:14-22`, `apps/web/src/context/LifeDataContext.jsx:263-395` @ HEAD). This document is not used as current implementation truth.

## 3. Historical LifeOS constraints

- `VERIFIED_HISTORICAL_INTENT` — LifeOS is a personal multi-domain operating surface whose strongest center is trusted capture and clarification, not “more dashboards” (`export_claude_lifeOS/_lifeos_forensic/19_handoff_summary.md:5-14`).
- `VERIFIED_HISTORICAL_INTENT` — canonical GTD minimum is Capture → raw Inbox note → Clarify → do now/delegate/defer/project/reference/delete; exact Clarify layout and several outcome mutations remain unresolved (`export_claude_lifeOS/_lifeos_forensic/19_handoff_summary.md:22`, `export_claude_lifeOS/_lifeos_forensic/08_gtd_system.md:17-23`).
- `VERIFIED_HISTORICAL_INTENT` — Home is historically read-mostly with navigation/quick-add, while later Weekly Review/Focus proposals reopen direct action; the final balance is `INSUFFICIENT_ARCHIVE_EVIDENCE` (`export_claude_lifeOS/_lifeos_forensic/07_dashboard_specification.md:5-15`, `export_claude_lifeOS/_lifeos_forensic/14_conflicts_and_supersessions.md:69-77`).
- `VERIFIED_HISTORICAL_INTENT` — the product’s visual identity is atmospheric, calm and spacious, with orange reserved for stakes rather than category decoration (`export_claude_lifeOS/_lifeos_forensic/10_design_system.md:7-28,73-94`).
- `VERIFIED_HISTORICAL_INTENT` — current forensic taxonomy remains exactly 7 conflicts, 7 actual historical open questions and 11 forensic/evidence gaps; this Discovery neither adds nor resolves any of them (`export_claude_lifeOS/_lifeos_forensic/14_conflicts_and_supersessions.md:7-77`, `export_claude_lifeOS/_lifeos_forensic/15_open_questions.md:5-79`, `export_claude_lifeOS/_lifeos_forensic/19_handoff_summary.md:58-62`).
- `VERIFIED_HISTORICAL_INTENT` — Project-vs-Goal, Clarify layout, Review/Engage, exact Home composition and Reference lifecycle remain unresolved/proposal-only. Adaptive Analytics must not depend on silently choosing them (`export_claude_lifeOS/_lifeos_forensic/15_open_questions.md:15-29,63-79`).

## 4. New product direction

- `USER_NEW_DIRECTION` — use the F1 engineering loop only as conceptual inspiration: Observe → Model → Hypothesize → Test → Measure → Compare → Diagnose → Learn → Adapt.
- `USER_NEW_DIRECTION` — prohibit racing visuals/branding, decorative telemetry, meaningless gauges, pseudo-scores and decorative gamification.
- `USER_NEW_DIRECTION` — prohibit a global Life/Productivity/Performance score; metrics describe observations, not personal worth.
- `USER_NEW_DIRECTION` — objective and subjective evidence may coexist; unknown/multiple causality must remain representable; correlation must not be labeled causation.
- `DISCOVERY_RECOMMENDATION` — name the user-facing capability around “signals”, “history”, “review”, “expectation” and “observation”, not F1 vocabulary. F1 terms should remain an internal design analogy unless later independently justified.
- `DISCOVERY_RECOMMENDATION` — optimize for a sparse learning loop triggered by material change, not an always-on cockpit.

## 5. Current relevant code map

All rows are `VERIFIED_CURRENT_CODE` at HEAD `67a1456c6165e9bdf36382a98c9713c4ed981314`.

| Path | Role | Why relevant | Current limitation | Reuse potential |
| --- | --- | --- | --- | --- |
| `apps/web/src/App.jsx:43-53,190-260,343-437` | App shell, hash dispatch, navigation, modal ownership | Integration point for routes and global surface placement | Route composition is a manual conditional chain; task creation shape is minimal | `REUSABLE_WITH_VARIANT` for route/shell wiring |
| `apps/web/src/app/routes.js:1-17` | Route constants | Defines Home, Tasks, Goals, Calendar, Notes, Finance, Health and placeholder domains | No analytics/review/metric route | `REUSABLE_AS_IS` plus approved route later |
| `apps/web/src/context/LifeDataContext.jsx:14-28,47-130,263-395` | Per-user state, boot/import/sync and mutations | Current frontend source of canonical account state | Whole payload; generic domain shapes; no analytics contract | `REUSABLE_WITH_VARIANT`; do not overload blindly |
| `apps/web/src/repositories/stateRepository.ts:1-15` | Generic snapshot envelope contract | Defines schema version/revision/payload boundary | Payload is opaque; no history/event methods | `REUSABLE_AS_IS` for current snapshot only |
| `apps/web/src/repositories/stateSyncCoordinator.ts:20-205` | Debounced optimistic snapshot sync | Protects current revision semantics | One frozen conflict path; no append-only analytical channel | `REUSABLE_AS_IS` for current state; analytics needs separate decision |
| `apps/web/src/api/state.ts:4-20` | GET/PUT state client | Only current persistence API | No measurement, signal, review or history endpoint | `REUSABLE_AS_IS` only for snapshot |
| `apps/web/src/pages/HomePage.jsx:33-79,81-150` | Current Dashboard/Home composition | Existing visibility and navigation surface | Four stats/two charts hard-coded; much data seeded | `REUSABLE_WITH_VARIANT` for sparse previews only |
| `apps/web/src/pages/home/StatCard.jsx:18-33` | Clickable KPI card | Potential small signal/summary shell | Only eyebrow/value/context; no provenance/delta/uncertainty | `REUSABLE_WITH_VARIANT` |
| `apps/web/src/pages/home/ChartCard.jsx:11-22` | Chart chrome | Header/control/body/footer shell | No analytical state contract | `REUSABLE_WITH_VARIANT` |
| `apps/web/src/pages/home/TrendChart.jsx:22-145` | Native SVG time-series | Existing visualization/tooltips/toggle/partial state | Finance-specific three series; no annotations or provenance | `REUSABLE_WITH_VARIANT` |
| `apps/web/src/pages/home/CategoryChart.jsx:26-147` | Horizontal comparative bars | Existing threshold and exception emphasis | Finance categories only; one hard stakes rule | `REUSABLE_WITH_VARIANT`, not generic as-is |
| `apps/web/src/data/dashboard-seed.js:3-90` | Home mock data | Explains apparent metrics | Seed is not production evidence/history | `NOT_REUSABLE_AS_DATA_TRUTH` |
| `apps/web/src/pages/QuickNotesPage.jsx:8-76` | Raw note capture/list | Current Inbox-like surface and possible observation capture | Promote goes directly to task quick-add; no six-outcome Clarify | `REUSABLE_WITH_VARIANT`; do not conflate observation and Inbox item |
| `apps/web/src/pages/TasksPage.jsx:8-107` | Task filtering/list | Candidate project/task signal entry | No timestamps/estimate/actual/block/rework model; no Project page | `REUSABLE_WITH_VARIANT` for entity navigation |
| `apps/web/src/TaskDetailModal.jsx` | `UNKNOWN` path from task prompt | Expected task detail owner | File does not exist at this path | Actual owner is `apps/web/src/components/TaskDetailModal.jsx`; no assumption retained |
| `apps/web/src/components/TaskDetailModal.jsx:15-27,52-55,178-184` | Task editing and activity timeline | Possible task review/detail host | Several details/subtasks are UI-local or seed-like; no estimate/forecast model | `REUSABLE_WITH_VARIANT` after domain decisions |
| `apps/web/src/GoalsWidget.jsx:7-76` | Goal list/progress | Candidate expectation/actual domain | Static percentage/value shape; no deadline/history/forecast | `REUSABLE_WITH_VARIANT` only visually |
| `apps/web/src/CalendarView.jsx:10-137` | Week calendar | Planned-vs-actual/context source candidate | Thin week view; no actual/history semantics | `REUSABLE_WITH_VARIANT` for navigation, not analytics truth |
| `apps/web/src/lib/calendar.js:22-129` | Seed/task/dog event aggregation | Shows available calendar derivation path | Sources include seed; task due is a string; no immutable actual event record | `REUSABLE_WITH_VARIANT` after data contract |
| `apps/web/src/pages/FinancesPage.jsx:31-73,88-230` | Expense capture, current budget/utilization and list | Best non-medical pilot with dated records | Cap is seeded; expenses only; no forecast/runway/scenario history | `REUSABLE_WITH_VARIANT` |
| `apps/web/src/lib/finance.js:18-59` | Inclusion, sum and category aggregation | Existing deterministic derivations | No periods, expectations, incomes or forecasts | `REUSABLE_AS_IS` as a low-level aggregator |
| `apps/web/src/pages/HealthPage.jsx:11-40` | Health route | Boundary for future sensitive analytics | Skeleton/empty sections only | `NOT_READY` for analytics MVP |
| `apps/web/src/lib/medMath.js:42-158` | Dose schedule, actual delta, usual time, inventory risk | Closest implemented expected-vs-actual/forecast primitives | Medication-specific; not a generic analytics contract | `REUSABLE_AS_REFERENCE`, not core abstraction |
| `apps/web/src/pages/medications/PharmNotes.jsx:6-132` | Dated subjective +/- journal | Existing subjective observation pattern | Binary polarity and medication-specific semantics | `REUSABLE_AS_REFERENCE`; do not universalize scale |
| `apps/web/src/lib/activity.js:9-72` | Bounded activity entries/query/prune | Existing temporal audit-like data | Incomplete, mutable, deletable and capped at 5000 inside snapshot | `REUSABLE_WITH_VARIANT` for UI timeline, not analytical source of truth |
| `apps/web/src/styles.css:8-180,2104-2285,2773-2847,4198-4227` | Tokens, cards, charts, responsive and state styling | Visual foundation for new surfaces | No semantic analytical components or provenance states | `REUSABLE_AS_IS` visually; variants need design |
| `.design-sync/conventions.md:1-49` | Claude Design package conventions | Defines token/class reuse and stakes rules | Styling guide, not a UX/data specification | `REUSABLE_AS_IS` for design execution |
| `apps/api/app/routes/state.py:15-59` | Authenticated state GET/PUT | Current backend entry point | Only current whole snapshot; no historical query | `REUSABLE_AS_IS` for current state |
| `apps/api/app/schemas/state.py:7-29` | State request/envelope schemas | Revision/payload contract | Payload is generic JSON; no analytical validation | `REUSABLE_AS_IS` for snapshot only |
| `apps/api/app/services/state.py:17-63` | Atomic create/update by expected revision | Current consistency mechanism | Update overwrites payload and increments current revision | `REUSABLE_AS_IS` beside, not as history |
| `apps/api/app/models/user_snapshot.py:12-31` | One JSONB snapshot row per user | Current DB truth | No revision/event/measurement rows retained | `REUSABLE_AS_IS` as current-state projection |
| `apps/api/alembic/versions/20260721_0001_create_accounts_and_snapshots.py:49-64` | Account/snapshot schema migration | Proves storage topology | Only `user_snapshots`; no analytics history | `REUSABLE_AS_BASELINE`; future migration would be new |

### Integration map

```text
App shell / hash routes
├── Home: hard-coded 4 StatCards + TrendChart + CategoryChart
├── GTD-adjacent: QuickNotes → direct task promotion; Tasks; Goals; Calendar
├── Domains: Finance; Health skeleton; Medications; Dog
└── Placeholder: Monthly; Annual; Investments

LifeDataContext (whole LifeOsState v2)
  → StateSyncCoordinator (500 ms debounce, expected revision)
  → /api/v1/state GET/PUT
  → state service (atomic compare-and-update)
  → one user_snapshots JSONB row per account
```

`VERIFIED_CURRENT_CODE` — this map is grounded in `apps/web/src/App.jsx:190-437`, `apps/web/src/context/LifeDataContext.jsx:263-395`, `apps/web/src/repositories/stateSyncCoordinator.ts:20-205`, `apps/api/app/routes/state.py:15-59`, and `apps/api/app/services/state.py:17-63` @ HEAD.

## 6. Dashboard integration findings

- `VERIFIED_CURRENT_CODE` — Home has four clickable stat cards and two charts in a fixed JSX composition; there is no widget registry, slot system or server-driven composition (`apps/web/src/pages/HomePage.jsx:81-150` @ HEAD).
- `VERIFIED_CURRENT_CODE` — finance data is partly derived from current transactions, while hero metrics, caps, prior five months and 30-day category data remain seed-backed (`apps/web/src/pages/HomePage.jsx:33-79,139-145`, `apps/web/src/data/dashboard-seed.js:3-90` @ HEAD).
- `VERIFIED_CURRENT_CODE` — reusable states include empty/partial chart treatment, footer disclosure, segmented controls, navigation clicks and responsive 4→2→1 KPI / 2→1 chart grids (`apps/web/src/pages/home/TrendChart.jsx:22-145`, `apps/web/src/styles.css:2116-2187,2255-2285` @ HEAD).
- `INFERENCE` — adding many persistent analytical cards would increase density and imply confidence the data model does not yet support.

| Placement class | Suitable candidates | Verdict |
| --- | --- | --- |
| A. Lightweight dashboard signal | One to three material exceptions; completed review/experiment notice | `DISCOVERY_RECOMMENDATION` — preferred persistent/conditional Home footprint |
| B. Dashboard analytical card | One bounded expected/actual/delta summary | `POSSIBLE_WITH_DESIGN`; show only when useful/current |
| C. Expandable dashboard detail | Short evidence/provenance reveal | `DESIGN_REQUIRED`; no current generic pattern proves it |
| D. Entity detail analytics | Project/task, finance period, goal or metric history | `DISCOVERY_RECOMMENDATION` — primary analytical depth |
| E. Dedicated review flow | Debrief/Weekly/System review | `DISCOVERY_RECOMMENDATION`; avoids overloading Home and preserves GTD boundary |
| F. Dedicated analytics workspace | Cross-domain history/trade-offs/scenarios | `LIKELY_LATER`; not justified for MVP |

**Persistent visibility rule:** `DISCOVERY_RECOMMENDATION` — Home should show only a small number of current, material, explainable signals or previews. Stable metrics and full histories should live in entity/detail/review surfaces. The current read-mostly/actionable historical conflict remains unresolved rather than being decided by this report.

## 7. GTD integration findings

`VERIFIED_HISTORICAL_INTENT` — GTD and Adaptive Analytics are separate but compatible layers:

```text
GTD:                 capture → clarify meaning → organize → engage
Adaptive Analytics: observe → compare → review evidence → decide adjustment
```

### Safe integration points

- `DISCOVERY_RECOMMENDATION` — task completion may emit an observed outcome only when required data exists; it must not add friction to every completion.
- `DISCOVERY_RECOMMENDATION` — project/goal review can surface forecast movement, estimate bias and review notes after Project-vs-Goal is resolved.
- `DISCOVERY_RECOMMENDATION` — Weekly Review may link to a separate analytical review, but Weekly Review itself remains proposal/gap historically (`export_claude_lifeOS/_lifeos_forensic/08_gtd_system.md:134-157`).
- `DISCOVERY_RECOMMENDATION` — Dashboard signals can link to evidence/detail, not replace GTD priorities.
- `DISCOVERY_RECOMMENDATION` — Calendar can provide planned dates only after its event source and actual-event semantics become reliable.

### Risky integration points

- `DISCOVERY_RECOMMENDATION` — do not inject metric configuration, causal diagnosis or experiment setup into canonical Clarify.
- `DISCOVERY_RECOMMENDATION` — do not automatically convert every raw Inbox note into an Observation; these represent different user intent.
- `DISCOVERY_RECOMMENDATION` — do not turn task completion into a mandatory debrief.
- `DISCOVERY_RECOMMENDATION` — do not let a forecast or “optimization” reorder GTD commitments without user choice.

`VERIFIED_CURRENT_CODE` — current QuickNotes promotes directly into task quick-add and does not implement six-outcome Clarify (`apps/web/src/pages/QuickNotesPage.jsx:8-76`, `apps/web/src/App.jsx:242-260,375-382` @ HEAD). Therefore the new layer must not be used to work around this existing GTD gap.

## 8. Current data/history capability

| Capability | Current support | Evidence | Reusable | Missing | Risk |
| --- | --- | --- | --- | --- | --- |
| historical state | `PARTIAL` | Bounded activity entries, but latest snapshot only (`apps/web/src/lib/activity.js:9-72`; `apps/api/app/services/state.py:17-63` @ HEAD) | UI timelines | Immutable revisions/snapshots | Reconstructing state from incomplete events |
| metrics | `PARTIAL` | Current finance aggregates and med calculations (`apps/web/src/lib/finance.js:18-49`; `apps/web/src/lib/medMath.js:42-147` @ HEAD) | Derivation functions | Generic definition/unit/cadence | Comparing unlike values |
| forecasts | `PARTIAL` | Medication inventory/schedule forecasts only (`apps/web/src/lib/medMath.js:42-147` @ HEAD) | Pattern reference | Generic forecast versions and horizon | Treating specialist logic as universal |
| expected values | `PARTIAL` | Dose interval expectation and seed budget cap (`apps/web/src/lib/medMath.js:123-134`; `apps/web/src/pages/FinancesPage.jsx:44-52` @ HEAD) | Domain examples | Persisted generic expectation/baseline | Seed mistaken for truth |
| actual values | `PARTIAL` | Dated expense and dose records (`apps/web/src/context/LifeDataContext.jsx:156-173,564-580` @ HEAD) | Records in those domains | Generic measurement contract | Coverage gaps |
| trend | `PARTIAL` | Home SVG series; prior months seeded (`apps/web/src/pages/HomePage.jsx:60-70`; `apps/web/src/pages/home/TrendChart.jsx:22-145` @ HEAD) | Visual primitive | Reliable history/annotations | Misleading synthetic trend |
| event/history storage | `PARTIAL` | `activityLog` capped at 5000 and prunable (`apps/web/src/lib/activity.js:25-72`; `apps/web/src/context/LifeDataContext.jsx:641-695` @ HEAD) | Recent activity UI | Durable append-only backend store | Deletion, incompleteness, JSONB growth |
| experiment storage | `ABSENT` | No route/state/model concept in current inventories (`apps/web/src/app/routes.js:1-17`; `apps/web/src/context/LifeDataContext.jsx:47-130`; `apps/api/app/main.py:43-45` @ HEAD) | None | Entire lifecycle | Pseudo-science without design |
| review/debrief | `ABSENT` | No current state/route; historical Review is proposal/gap (`apps/web/src/app/routes.js:1-17` @ HEAD; forensic `08_gtd_system.md:134-157`) | Activity timeline as reference only | Review record/decision/follow-up | Retrospective bias |
| diagnosis | `ABSENT` | Multi-change warning is a caution, not causal diagnosis (`apps/web/src/pages/medications/MedConfigDrawer.jsx:95-143,409-433` @ HEAD) | Warning/uncertainty pattern | Cause/provenance model | False causality |
| cross-domain linkage | `ABSENT` | Snapshot has parallel domain arrays/objects, no typed links (`apps/web/src/context/LifeDataContext.jsx:104-130` @ HEAD) | Shared account scope only | Link semantics | Accidental correlation |
| visualization | `SUPPORTED` | Native SVG trend, bars, stat/card shells and responsive CSS (`apps/web/src/pages/home/*`; `apps/web/src/styles.css:2104-2285` @ HEAD) | Strong visual basis | Analytical semantics/annotations | Attractive but unsupported claims |
| dashboard integration | `PARTIAL` | Fixed Home composition and navigation callbacks (`apps/web/src/pages/HomePage.jsx:81-150` @ HEAD) | Cards/charts/navigation | Extensible composition, server truth | Cockpit overload |
| subjective observations | `PARTIAL` | Dated pharmacy notes with +/- polarity (`apps/web/src/pages/medications/PharmNotes.jsx:6-132` @ HEAD) | Capture/list pattern | Generic scale/provenance/privacy | Overgeneralizing binary sentiment |
| trade-off representation | `ABSENT` | No typed cross-domain comparison in current state (`apps/web/src/context/LifeDataContext.jsx:104-130` @ HEAD) | Parallel data can later feed it | Explicit links and user weighting | Hidden value judgment |

**Answer:** `CURRENT_HISTORY_SUPPORT=PARTIAL`. `VERIFIED_CURRENT_CODE` — the current persistence model preserves enough temporal evidence for a few narrow examples (expenses, doses, pharmacy notes and recent activity), but not enough for general Adaptive Analytics. Current JSONB revisions are concurrency counters, not historical revisions: updating a snapshot replaces its payload and increments one row (`apps/api/app/services/state.py:40-51`, `apps/api/app/models/user_snapshot.py:20-31` @ HEAD).

## 9. Snapshot/revision implications

- `VERIFIED_CURRENT_CODE` — frontend mutations replace/merge the in-memory snapshot and schedule a whole-payload write (`apps/web/src/context/LifeDataContext.jsx:382-395`, `apps/web/src/repositories/stateSyncCoordinator.ts:51-100` @ HEAD).
- `VERIFIED_CURRENT_CODE` — backend compare-and-update prevents lost concurrent writes when expected revision mismatches, but it does not retain the old payload (`apps/api/app/services/state.py:25-63` @ HEAD).
- `INFERENCE` — analytics arrays inside the snapshot would make every new measurement participate in whole-document conflicts and payload growth.
- `INFERENCE` — revision number cannot answer “what changed?” without stored prior states/events.
- `DISCOVERY_RECOMMENDATION` — preserve current snapshot semantics as the projection/current configuration boundary; do not redefine its revision counter as analytical history.

## 10. Domain-agnostic analytical model candidates

These are 15 candidate concept families, not a schema.

| Candidate | Similar current concept | Cross-domain role | Persist or derive? | Collision / design need |
| --- | --- | --- | --- | --- |
| Metric | Finance aggregate, medication calculation | Defines what/unit/cadence | Likely persisted definition | `DESIGN_REQUIRED`; avoid Goal duplication |
| Measurement | Transaction, dose log, profile history seed | Timestamped actual value | Persist raw observations | Provenance/quality required |
| Baseline | Budget cap/usual dose time analogues | Comparison reference | Mixed; version if user-defined | Semantics/date range decision |
| Target | Goal percentage/budget cap analogue | Desired value | Persist only when user intends target | Must not moralize deviations |
| Expectation | Expected dose time analogue | What user/model expected | Persist when later accuracy matters | Distinguish from Target |
| Forecast | Medication inventory forecast analogue | Future estimate + horizon | Persist versions if accuracy audited | Method/provenance required |
| Observation | Pharmacy note analogue | Subjective/context evidence | Persist | Scale/free-text/privacy design |
| Signal | Current warning/card states | Material change requiring attention | Usually derived; optionally acknowledge | Threshold/expiry design |
| Delta | Dose/finance arithmetic | Actual−expected comparison | Prefer derived from versioned inputs | Units/direction semantics |
| Experiment | None | Bounded learning cycle | Persist if accepted | Full lifecycle design required |
| Hypothesis | None | Testable proposition | Persist under Experiment | Never present as fact |
| Intervention/Result | Medication mode changes/activity analogue | What changed and what followed | Persist explicit action/result | Correlation risk |
| Diagnosis/Contributing Factor | None; only cautionary multi-change warning | User/system explanation candidates | Persist provenance/uncertainty if accepted | High trust risk; likely later |
| Review/Decision/Adjustment | Activity notes only | Debrief and next adaptation | Persist concise record | GTD Review ownership unresolved |
| Scenario/Tradeoff | None | Compare options/gains/costs | Derive scenario; persist assumptions/choice | High complexity/value judgment |

`DISCOVERY_RECOMMENDATION` — do not build one polymorphic “everything event” entity in Phase B without first validating query, retention and provenance needs. Reuse shared semantic fields where justified, while keeping domain-owned facts in domain models.

## 11. Project analytics feasibility

- `VERIFIED_CURRENT_CODE` — tasks currently carry id/title/done/stakes/tag/due/schedule/notes; create/edit/complete/reopen actions appear in `activityLog`, but the task object itself has no created/updated/completed timestamp, estimate, actual duration, blocked interval, scope version or forecast (`apps/web/src/App.jsx:242-260`, `apps/web/src/context/LifeDataContext.jsx:397-435` @ HEAD).
- `VERIFIED_CURRENT_CODE` — goals contain title, percentage/value and tag, without deadline/history/forecast (`apps/web/src/context/LifeDataContext.jsx:140-146,490-502` @ HEAD).
- `VERIFIED_HISTORICAL_INTENT` — a distinct Project entity versus Goal remains unresolved (`export_claude_lifeOS/_lifeos_forensic/15_open_questions.md:23-29`).
- `INFERENCE` — current data can count completion events only where activity entries survived; it cannot reliably calculate planned-vs-actual duration, deadline forecast, blocked time, rework, scope change or recurring failure mode.
- `DISCOVERY_RECOMMENDATION` — project analytics is a plausible pilot only after the Project/Goal ownership decision and new timestamp/expectation capture are approved. Do not infer effort or causality from current task counts.

## 12. Finance analytics feasibility

- `VERIFIED_CURRENT_CODE` — transactions have date, amount, category, source and inclusion state; current spend and category totals can be derived (`apps/web/src/context/LifeDataContext.jsx:156-173,437-488`, `apps/web/src/lib/finance.js:18-49` @ HEAD).
- `VERIFIED_CURRENT_CODE` — the current budget cap and category caps come from dashboard seed rather than an account-owned dated budget model (`apps/web/src/pages/FinancesPage.jsx:44-52`, `apps/web/src/pages/HomePage.jsx:43-49` @ HEAD).
- `VERIFIED_CURRENT_CODE` — current transaction UI is expense-oriented; no income forecast, cash-flow plan, runway or scenario model is present (`apps/web/src/pages/FinancesPage.jsx:31-73,115-230` @ HEAD).
- `INFERENCE` — actual spend by current period/category is feasible now; expected-vs-actual spending requires persisted period expectations; cash-flow and runway require income/balance semantics; scenario modeling requires explicit assumptions.
- `DISCOVERY_RECOMMENDATION` — finance is the safest first visible domain only after replacing seed expectations with account-owned, dated data. It must not grow into an accounting system in this initiative.

## 13. Health/personal-development extensibility

- `VERIFIED_CURRENT_CODE` — Health is a skeleton with empty cards; generic sleep/energy/stress/training/learning records do not exist (`apps/web/src/pages/HealthPage.jsx:11-40` @ HEAD).
- `VERIFIED_CURRENT_CODE` — medication surfaces contain real temporal UX patterns: expected dose vs actual delta, dated actual doses, subjective notes and inventory forecast (`apps/web/src/lib/medMath.js:42-147`, `apps/web/src/pages/medications/TakeDoseModal.jsx:54-127`, `apps/web/src/pages/medications/PharmNotes.jsx:21-132` @ HEAD).
- `INFERENCE` — those patterns demonstrate reusable interaction ideas, not a generic health inference model. Medication logic carries domain-specific safety assumptions and must remain isolated.
- `DISCOVERY_RECOMMENDATION` — keep core analytics domain-agnostic through typed value/unit/time/provenance semantics. Add health domains only through later domain adapters and explicit consent/retention controls.
- `DISCOVERY_RECOMMENDATION` — sensitive measurements, notes and cross-domain relationships require per-account isolation, minimal collection, export/delete/retention behavior and no AI disclosure by default. No medical inference belongs in this scope.

## 14. Experimentation feasibility

- `VERIFIED_CURRENT_CODE` — there is no Experiment/Hypothesis/Intervention/Result entity or route in current state/API (`apps/web/src/context/LifeDataContext.jsx:47-130`, `apps/web/src/app/routes.js:1-17`, `apps/api/app/main.py:43-45` @ HEAD).
- `INFERENCE` — a trustworthy experiment needs a time-bounded hypothesis, chosen baseline, intervention period, raw observations, deviations/context, interpretation and explicit decision. Without these separations, the UI would encourage post-hoc storytelling.
- `NEW_PRODUCT_DECISION_REQUIRED` — candidate result states `KEEP`, `MODIFY`, `REJECT`, `RUN_LONGER`, `INCONCLUSIVE` are reasonable vocabulary to design-test, not an approved enum.
- `DISCOVERY_RECOMMENDATION` — Experiment is `LIKELY_LATER`, after generic measurements and reviews prove useful. A design prototype may be explored now, but implementation should not lead the MVP.

## 15. Review/debrief feasibility

- `VERIFIED_HISTORICAL_INTENT` — Weekly Review/Reflect is proposed but not historically resolved (`export_claude_lifeOS/_lifeos_forensic/08_gtd_system.md:134-157`).
- `VERIFIED_CURRENT_CODE` — current UI can render entity activity timelines and notes, but there is no durable review record, decision, adjustment or follow-up contract (`apps/web/src/components/ActivityTimeline.jsx:1-80`, `apps/web/src/context/LifeDataContext.jsx:641-695` @ HEAD).
- `DISCOVERY_RECOMMENDATION` — a short Review/Debrief is necessary for the first coherent learning loop: Expected, Actual, Delta, what was observed, uncertainty, keep/change next. It should be optional and linked from an entity/material signal rather than mandatory on every completion.
- `NEW_PRODUCT_DECISION_REQUIRED` — decide whether analytical review is independent, nested under future GTD Weekly Review, or linked bi-directionally. Do not resolve the historical Review gap inside analytics.

## 16. Cross-domain trade-off feasibility

- `VERIFIED_CURRENT_CODE` — data domains share a single account snapshot but have no typed cross-domain links or common measurement semantics (`apps/web/src/context/LifeDataContext.jsx:104-130` @ HEAD).
- `INFERENCE` — parallel time series can be displayed together once aligned by time/unit/provenance, but co-movement alone cannot establish cost or cause.
- `DISCOVERY_RECOMMENDATION` — later Trade-off views should show several independently labeled changes and let the user state importance/interpretation; do not compute a weighted global optimum or Life Score.
- `NEW_PRODUCT_DECISION_REQUIRED` — explicitly modeling a claimed relationship requires source, direction, confidence/uncertainty and user confirmation. Until then, present juxtaposition only.

## 17. Existing design-system capability

| Capability | Classification | Evidence / limitation |
| --- | --- | --- |
| typography, spacing, radii, colors, themes | `REUSABLE_AS_IS` | `VERIFIED_CURRENT_CODE` — density and theme tokens exist (`apps/web/src/styles.css:8-180` @ HEAD) |
| routine/stakes surfaces | `REUSABLE_AS_IS` | `VERIFIED_CURRENT_CODE` — glass card and stakes modifiers exist (`apps/web/src/styles.css:4198-4227` @ HEAD) |
| Stat/KPI shell | `REUSABLE_WITH_VARIANT` | Current value/context is insufficient for expectation, provenance and uncertainty (`apps/web/src/pages/home/StatCard.jsx:18-33` @ HEAD) |
| Chart card and time series | `REUSABLE_WITH_VARIANT` | SVG, toggles, tooltip/partial/empty patterns exist; annotations and data quality do not (`apps/web/src/pages/home/ChartCard.jsx:11-22`, `TrendChart.jsx:22-145` @ HEAD) |
| bars/progress/badges/status | `REUSABLE_WITH_VARIANT` | Existing finance/goal/med states are domain-specific; generic semantics require design |
| tabs/segmented controls/filters | `REUSABLE_AS_IS` visually | Existing chart and medication controls establish interaction chrome (`apps/web/src/styles.css:2227-2253`; `apps/web/src/pages/medications/MedDetailPage.jsx:12-23,49-87` @ HEAD) |
| dialogs/modals/drawers/forms/lists | `REUSABLE_AS_IS` visually | Existing task/medication surfaces provide shells, not analytical flows |
| empty/loading/error | `REUSABLE_WITH_VARIANT` | Chart empty/partial and auth/sync status exist; analytics needs no-data/stale/estimated/conflict states (`apps/web/src/styles.css:2255-2285,4775-4844` @ HEAD) |
| responsive primitives | `REUSABLE_AS_IS` | Home and app layouts collapse at 960/720/640/420px (`apps/web/src/styles.css:2167-2187,2773-2847` @ HEAD) |
| analytical provenance/uncertainty | `NEW_COMPONENT_REQUIRED` | No current generic pattern |
| diagnosis/experiment/debrief/trade-off flows | `REQUIRES_CLAUDE_DESIGN` | No current interaction contract |

`VERIFIED_CURRENT_CODE` — the design-sync package explicitly ships tokens/classes rather than importable components (`.design-sync/NOTES.md:3-21` @ HEAD/worktree artifact). `INFERENCE` — Claude Design should return screen/component specifications that reuse these classes and tokens, not a competing visual system.

## 18. Claude Design work required

`CLAUDE_DESIGN_REQUIRED=YES` and `CURRENT_STYLE_GUIDE_SUFFICIENT=VISUAL_ONLY`.

### Smallest necessary pre-implementation package

1. **Telemetry/Signal Card — `NEEDED_FOR_MVP`.** Material change, evidence source, observed/derived/estimated state, timestamp/freshness, one link to detail, dismiss/acknowledge behavior.
2. **Expected vs Actual / Delta — `NEEDED_FOR_MVP`.** Direction-neutral language, units, comparison period, missing/partial data and “expectation changed” handling.
3. **Metric Detail / History — `NEEDED_FOR_MVP`.** Series plus expectation/forecast versions, annotations, provenance and empty/stale/insufficient-data states.
4. **Debrief / Review — `NEEDED_FOR_MVP`.** Expected, actual, delta, observation, uncertainty, decision/adjustment; optional rather than punitive.

### Design now for coherence, implement later unless promoted

5. **Experiment — `LIKELY_LATER`, `REQUIRES_PRODUCT_DECISION`.** Prototype lifecycle and inconclusive state to ensure the core model does not block it.
6. **Diagnosis / Contributing Factors — `LIKELY_LATER`, `REQUIRES_PRODUCT_DECISION`.** Must support unknown, multiple factors and provenance.
7. **Trade-off View — `LIKELY_LATER`.** Juxtapose gains/costs without a single score.
8. **System Review — `LIKELY_LATER`; `OVERLAPS_EXISTING_UI` historically.** Explore relationship to Home and proposed Weekly Review without selecting the canonical owner.

### Claude Design deliverables

- Desktop and mobile states for the four MVP primitives.
- Placement map across Home preview, entity detail and review flow.
- State matrix: loading, no data, partial data, stale, observed, user-reported, derived, estimated/forecast, unknown cause, conflict/error.
- Copy guidance enforcing non-moral, non-causal language.
- Click paths and ownership boundaries; no F1/racing aesthetics.
- Token/class reuse annotation from `apps/web/src/styles.css` and `.design-sync/conventions.md`.

## 19. F1 concept → LifeOS value map

| F1-inspired concept | LifeOS interpretation | Potential domains | Current support | Risk |
| --- | --- | --- | --- | --- |
| Telemetry | Timestamped observations/measurements | Finance, tasks, habits, later health | `PARTIAL` | Decorative metric volume |
| Baseline | Explicit comparison reference and period | Finance, projects, experiments | `PARTIAL` analogues only | Bad/outdated baseline |
| Expected vs actual | Compare stated model with observed result | Projects, finance, medication timing | `PARTIAL` in medication | Moralizing deviation |
| Delta | Unit-aware difference | Any metric | `PARTIAL` domain arithmetic | Direction/value ambiguity |
| Forecast | Versioned estimate with horizon/method | Projects, finance, inventory | `PARTIAL` medication only | Presenting estimate as fact |
| Signal | Material, explainable change | Home, entity detail, review | `PARTIAL` warning styles | Alert fatigue |
| Strategy | User-chosen adjustment | Review, experiment, planning | `ABSENT` | System prescribing priorities |
| Debrief | Evidence-based review and next decision | Projects, goals, periods | `ABSENT` | Retrospective certainty |
| Reliability | Accuracy/coverage of a model or source | Forecasts, imports, routines | `ABSENT` | Pseudo-score |
| Driver feedback | User-reported context/experience | Any domain; sensitive in health | `PARTIAL` pharmacy notes | Forced/binary scales |
| Simulation | Explicit scenario with assumptions | Finance/projects | `ABSENT` | False precision |
| Correlation | Observed co-movement only | Cross-domain review | `ABSENT` | False causality |

`DISCOVERY_RECOMMENDATION` — none of these F1 terms needs to appear in user-facing navigation.

## 20. Failure modes / analytical trust risks

| Failure mode | Product manifestation | Required guardrail |
| --- | --- | --- |
| Selection bias | Only recorded days look representative | Show coverage/missing periods |
| Missing data | Gaps rendered as zero | Explicit no-data/partial states |
| Bad baseline | Arbitrary comparison drives alarm | Show source, period and version |
| Measurement noise | Small changes treated as meaningful | Materiality threshold and uncertainty |
| Confounding variables | Coincident changes blamed as cause | “Possible factor”, unknown/multiple allowed |
| False causality | AI/user wording becomes fact | Provenance and confirmation; no causal verb by default |
| Small sample | One week becomes a pattern | Show sample/window; allow inconclusive |
| Cherry-picking | Convenient range selected silently | Visible range and comparison basis |
| Overfitting routines | System prescribes from narrow history | Suggestions remain optional hypotheses |
| Metric gaming | User optimizes count instead of outcome | Multiple context measures; no global score |
| Survivorship bias | Deleted/abandoned work disappears | Retention and explicit exclusions |
| Recency bias | Latest event dominates review | Fixed windows and historical context |
| Confirmation bias | Only confirming observations recorded | Neutral prompts and contradictory evidence |
| AI hallucinated causes | Plausible narrative shown as diagnosis | AI output tagged suggestion/inferred; user confirmation required |

`DISCOVERY_RECOMMENDATION` — future analytical values need an explicit epistemic/provenance dimension. Candidate states `OBSERVED`, `USER_REPORTED`, `DERIVED`, `ESTIMATED`, `FORECAST`, `HYPOTHESIS`, `INFERRED`, `UNKNOWN` are justified as a design/data requirement, but their names are not finalized.

### Future AI boundary

- `DISCOVERY_RECOMMENDATION` — AI may later summarize deviations, suggest candidate factors or draft reviews only from linked input records.
- `DISCOVERY_RECOMMENDATION` — store/display model/version/time, source record IDs, generated text, confidence/uncertainty, user confirmation/edit state and supersession.
- `DISCOVERY_RECOMMENDATION` — AI suggestion is never a fact; inferred cause is never verified cause. AI is `NOT_JUSTIFIED_YET` for MVP.

## 21. Architecture options

All options remain `ARCHITECTURE_OPTION`; no implementation is approved.

| Option | Fit | Advantages | Risks | Migration/query | Sync/revision/frontend implications |
| --- | --- | --- | --- | --- | --- |
| A. Extend snapshot only | High mechanical fit | Smallest surface; reuses current API/sync | Unbounded payload, incomplete retention, whole-document conflicts, poor temporal queries | No new table; expensive client-side scans | Every event bumps snapshot revision; frontend owns analytics logic |
| B. Snapshot + bounded history in JSONB | Medium; mirrors activityLog | Quick recent trends; offline-ish single document | Pruning destroys longitudinal truth; conflicts and payload growth remain | Payload migration/versioning; limited query/indexing | Current sync retained but history competes with ordinary edits |
| C. Separate append-only analytical history | Medium | Durable/queryable time series and provenance; independent retention | Dual-write consistency and additional API/schema complexity | New tables/indexes/migration; strong queries | Separate write path and conflict/idempotency contract; frontend joins projection/history |
| D. Hybrid current snapshot + append-only history | Best conceptual fit | Snapshot remains current projection/config; history supports learning | Highest initial design/consistency complexity | New tables/API plus optional projections | Keep current revision semantics; event writes need idempotency and ownership; UI fetches current + history |

`DISCOVERY_RECOMMENDATION` — Option D is the leading direction because current revision semantics are valuable for account state while analytical questions require durable temporal evidence. This is not approval to create tables, APIs, migrations or dependencies. After product/UX decisions, the targeted technical Discovery must test event ownership, idempotency, retention, deletion/export, query shapes and deploy compatibility.

## 22. NEW_PRODUCT_DECISIONS_REQUIRED

Nine genuine new decisions were revealed; none changes a historical ledger.

| ID | Question | Recommendation for sign-off discussion | Why blocking |
| --- | --- | --- | --- |
| `AA-NPD-01` | First-class module or horizontal capability? | Horizontal capability with domain adapters and possibly one review entry point | Determines ownership/routes/schema |
| `AA-NPD-02` | Which pilot domains? | Finance actuals + one task/project workflow after Project/Goal decision; exclude Health from first implementation | Determines capture/data feasibility |
| `AA-NPD-03` | What is persisted vs derived? | Persist raw measurements, user expectations, forecast versions, observations and reviews; derive delta/signal where reproducible | Determines history model |
| `AA-NPD-04` | What are Metric/Measurement/Expectation/Baseline semantics? | Define units, period/cadence, timezone, source and version before schema | Prevents invalid comparisons |
| `AA-NPD-05` | How much belongs on Home? | Exception-driven 1–3 signals/previews; detail and review elsewhere | Prevents cockpit overload; preserves historical ambiguity |
| `AA-NPD-06` | Where does analytical Review live relative to GTD Review? | Separate record/flow with optional links until historical Weekly Review is resolved | Avoids silently resolving GTD gap |
| `AA-NPD-07` | How are cause, uncertainty and provenance represented? | Mixed free text + linked evidence + explicit unknown/multiple/source states; no forced cause | Trust and AI boundary |
| `AA-NPD-08` | Is Experiment universal and what is its lifecycle? | Defer implementation; design-test universal entity and inconclusive state | Prevents misleading science |
| `AA-NPD-09` | How are subjective observations and cross-domain trade-offs represented? | Allow optional typed/free-text observations; juxtapose domains without weighted score | Privacy and value-judgment risk |

## 23. DESIGN_DECISIONS_REQUIRED

| ID | Question | Why it matters | Affected surfaces | Data-model effect | Recommended exploration | Blocks Plan |
| --- | --- | --- | --- | --- | --- | --- |
| `AA-DD-01` | Signal card density, materiality, expiry and acknowledgement | Controls Home load/alert fatigue | Home, entity detail | Signal derivation/ack state | 3 severities without moral language; conditional vs persistent | YES |
| `AA-DD-02` | Expected/Actual/Delta language and direction | A “negative” delta may be good, bad or neutral | Card, detail, review | Value/unit/period semantics | Money/date/count/duration variants | YES |
| `AA-DD-03` | Metric history annotations and provenance reveal | Prevents chart from overstating truth | Detail | History/version/source requirements | Partial/stale/forecast/changed-baseline states | YES |
| `AA-DD-04` | Diagnosis/contributing-factor uncertainty flow | Avoids forced causality | Detail/review | Cause source/link/confidence | Unknown, multiple, user-reported, AI-suggested | NO for MVP; YES before diagnosis |
| `AA-DD-05` | Experiment setup/run/result flow | Prevents pseudo-scientific UX | Experiment/review | Lifecycle and result states | Baseline/intervention/inconclusive prototype | NO for measurement MVP |
| `AA-DD-06` | Review/debrief cadence and friction | Learning loop needs reflection without punishment | Entity review, system review | Review/decision/adjustment record | Optional 5-field flow; defer/skip behavior | YES |
| `AA-DD-07` | Trade-off comparison without a score | Preserves multi-objective life choices | Review/workspace | Cross-domain links/units | Side-by-side changes + user interpretation | NO for MVP |
| `AA-DD-08` | System Review vs Home vs GTD Weekly Review placement | Avoids duplicate ownership | Home, review, navigation, mobile | Aggregation/query boundary | Navigation/placement prototype, desktop/mobile | YES for broader review; not for first entity pilot |

## 24. MVP candidates vs later capabilities

### `MVP_CANDIDATES`

1. Persisted timestamped Measurement with unit/source/provenance and explicit missing state.
2. Persisted user Expectation/Baseline version where later comparison is intended.
3. Derived Expected vs Actual and Delta with neutral semantics.
4. Simple historical trend/detail with visible coverage, period and source.
5. Optional user Observation plus concise Review/Debrief and Decision/Adjustment.
6. Sparse material Signal linking to evidence; Home shows only conditional preview(s).

### `LATER_CANDIDATES`

- Experiment lifecycle after measurement/review semantics are proven.
- Diagnosis/contributing factors with uncertainty and provenance.
- Cross-domain trade-off and System Review.
- Scenario modeling and forecast-accuracy history.
- AI summaries/hypotheses with traceable sources and confirmation.
- Pattern/correlation discovery with coverage/sample disclosures.

### `NOT_JUSTIFIED_YET`

- Global Life/Productivity/Performance score.
- Automated causal diagnosis.
- Cross-domain optimization or prescriptive ranking.
- Predictive modeling from current sparse data.
- Racing/F1 interface, gauges, decorative telemetry or gamification.
- Separate analytics subsystem for every domain.

## 25. Risks

| Risk class | Primary risk | Mitigation direction |
| --- | --- | --- |
| Architecture | Current snapshot overwrites history; embedding large event arrays would damage payload/conflict/query behavior | Preserve snapshot projection; validate hybrid history after contracts |
| Product | The layer becomes a punitive optimization engine or duplicates GTD | Non-moral copy, optional reviews, explicit boundary, no score |
| Design | Home becomes a dense cockpit | Exception-driven 1–3 previews; depth elsewhere |
| Analytical trust | Sparse/biased data and plausible narratives become causal certainty | Coverage, provenance, epistemic states, unknown/inconclusive |
| Privacy | Sensitive cross-domain history exposes intimate patterns | Minimize, isolate, retain/delete/export controls, AI opt-in later |
| Migration | New history semantics conflict with existing v2 snapshots | Additive migration and deploy-race contract; targeted Discovery |
| Adoption | Manual capture burden exceeds value | Pilot only measures with clear decisions/useful feedback |

## 26. Recommended next phase

`DISCOVERY_RECOMMENDATION` — use this sequence:

```text
Phase A Discovery (this report)
→ approve/resolve AA-NPD-01…09 needed for the pilot
→ Claude Design: four MVP primitives + state/placement matrix
→ targeted technical Discovery: event/history ownership, API, migration,
  idempotency, retention/export/delete, exact caller/event inventory
→ Phase B Implementation Plan
→ implementation only after Plan approval
```

Why not Plan immediately: `VERIFIED_CURRENT_CODE` proves the storage gap, but `NEW_PRODUCT_DECISION_REQUIRED` and `DESIGN_REQUIRED` choices still determine what must be stored and where it appears. Designing a schema now would freeze unapproved semantics.

Why not a full additional audit: this report already maps the relevant shell, routes, domains, state, API, sync, persistence, history and visual primitives. The follow-up should be narrow and contract-driven.

## 27. Binding not-touched list

- `APPLICATION_MUTATION=NO` — no `apps/**`, tests, migrations, DB, runtime or dependencies modified.
- `SOURCE_FORENSIC_MUTATION=NO` — no file under `export_claude_lifeOS/_lifeos_forensic/**` modified.
- `GIT_MUTATION=NO` — no staging, commit, push, checkout, reset, stash or clean.
- `NETWORK/VPS/DEPLOY=NO` — no network, browser, VPS, service, database, frontend or backend runtime action.
- Only this Discovery report and its matching compact summary were created under `Outputs/`.
- Historical taxonomy remains 7 conflicts / 7 actual historical open questions / 11 forensic-evidence gaps.
- No historical decision, requirement, conflict or open-question identifiers were created or changed.

## Completion gates

- [x] actual HEAD/branch recorded
- [x] historical forensic baseline read
- [x] current dashboard code mapped
- [x] current GTD integration points mapped
- [x] current state/persistence path mapped
- [x] history/event availability established
- [x] analytics feasibility assessed
- [x] current reusable design primitives assessed
- [x] Claude Design requirement assessed
- [x] brand-guide sufficiency answered
- [x] snapshot/history architectural tension assessed
- [x] new product decisions listed
- [x] design decisions listed
- [x] analytical trust/failure modes assessed
- [x] MVP candidates separated from later capabilities
- [x] no historical unresolved question silently resolved
- [x] no historical forensic artifacts modified
- [x] no application/runtime/Git mutation
- [x] Discovery report created
- [x] compact summary created
