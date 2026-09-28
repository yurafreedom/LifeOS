# LifeOS Adaptive Analytics — Slice 5 · Project Analytics (G)
## Targeted Discovery — reconciliation of the parallel Discovery against current main

Written: 2026-09-28 23:44 · Europe/Kyiv
Mode: reconciliation, not a fresh Discovery.

Source Discovery (outside the repo, read in full):
`/Users/yurasachenko/LifeOS/_parallel_discovery/lifeos-adaptive-analytics-slice-5-project-analytics-discovery.md`
(baseline `ea3a75e1`, verdict PASS, no owner decisions). Its §4–§17 findings are
kept unless this document marks them RESOLVED or CHANGED. This document
re-verifies its §18 predecessor-dependent items and reconciles paths moved by the
architecture hardening.

---

## 1. Live state

| Item | Value |
| --- | --- |
| `main` = `origin/main` | `63e41adebf22400dca3e30330bb347f4feef6027` (PR #14 merge) |
| Ancestry | `ea3a75e1` (old baseline) → `c44adb6` (PR #12, Slice 4) → `48e38c2` (PR #13, hardening) → `63e41ad` (PR #14) |
| Worktrees | one (`/Users/yurasachenko/LifeOS/LifeOS_DesignSystem`) |
| Working tree | clean |
| Recovery stash | `stash@{0}` = `51184836ace557fbd9492527bd845329b17b2a76`, untouched |
| Frozen tag | `adaptive-analytics-design-accepted` → tag `6c507b82…` → commit `d4960286…`, unchanged |
| Open PRs | none |
| Slice 5 branch/PR before this session | none (only merged `origin/feat/adaptive-analytics-slice-4-reviews` remains remotely) |
| Backend baseline | `python -m pytest` **400 passed** (lifeos_test) |
| Frontend baseline | `npm test` **283 passed / 29 files** |
| Alembic | `heads` = `current` = `20260928_0006 (head)`, single head |

---

## 2. §18 reconciliation checklist

| # | Item | Result on `63e41ad` |
| --- | --- | --- |
| 1 | main SHA and ancestry | `63e41ad`; Slice 4, hardening, PR #14 all merged. **RESOLVED** |
| 2 | Alembic single head | `20260928_0006` (Slice 4's M5). Slice 5 adds none. **CONFIRMED** |
| 3 | Export / TRUNCATE / model registry | 19 mapped AA tables == `EXPORT_TABLES` == real DB; parity enforced by `test_export.py`, `test_aa_schema_guards.py`, `test_aa_signal_episodes.py::test_the_export_registry_still_matches_the_real_schema`, `test_aa_semantic.py::test_m3_…registry_schema_parity`. Slice 5 adds no table. **CONFIRMED** |
| 4 | Review route + project support | Route id `review` (analytics-gated). Hash `#/review/new/<subject>/<from>/<to>` or `#/review/<uuid>`, built by `analytics/review.ts::newReviewHash`. Project subjects `project:project:<id>` are accepted (`SUBJECT` regex; server `resolve_review_subject`). The window comes from `projectReviewWindow(project)`: local Kyiv date of `started_at` → `completed_at`. `ProjectCard.jsx::projectReviewHash(project)` already builds it and shows «Открыть ревью» for `status === 'completed'` only. The Review context builder includes the **latest** forecast, the Actual, the latest→Actual delta and observations. **Reusable as-is** |
| 4b | Decision grounding | `aa_decisions.choice ∈ {keep, adjust, later, inconclusive, NULL}`, review-scoped, with **no** metric and no `desired_direction`. It cannot ground a date delta. **Not a grounding source** |
| 5 | desirability / delta schema / primitives | `aa_desirability.desirability` and `NormativeGrounding` unchanged; `compute_delta` unchanged; `ComparisonOut.reference_concept` is still `Literal["expectation","baseline"]`, so it cannot express Forecast as a reference. `AADelta` gained an optional `notes` prop (Slice 4). **CONFIRMED** |
| 6 | Localization | Hardening split `context/locale/{ru,uk,makeT}.js` behind the `LocaleContext.jsx` facade. Slice 4 localized every AA primitive through `components/analytics/useAAText.js` (RU fallback). Old finding 4 (primitives RU-only) is **RESOLVED** for labels. Still open: `formatDelta(…, true)` renders `"−1 дней"` (pinned as such by `analytics-review.test.jsx:121`); `AAHistoryList` / `AAProvenance` still print raw ISO instants and raw `source_kind` codes. `pl_day` exists in both dictionaries (`день/дня/дней`, `день/дні/днів`) and `t.pl` implements the Slavic 3-form rule |
| 7 | App routing | Route ids in `app/routes.js` (analytics routes pushed only when `ANALYTICS_ROUTE_ENABLED`); hash parsing in `app/routeRegistry.js` (`medications/…` and `review/…` sub-route families); lazy loaders in `app/lazyRoutes.jsx`; one `case` per route in `App.jsx::renderRoute`. Pinned by `route-registry.test.ts`, `lazy-routes.test.jsx`, `smoke.test.jsx` (route count 19). Old K11 (special cases duplicated inside `App.jsx`) is **RESOLVED** by the registry |
| 8 | AnalyticsContext / API facade | `api/analytics.ts` is an `export *` facade over `api/analytics/{facts,finance,history,semantic,signals,reviews}.ts`; "a new domain = a new module + one facade line". `AnalyticsContext` exposes Review reads as plain functions over `AnalyticsRepository` (pattern to copy). The queue exposes `list(userId)`; the context has no per-subject pending read yet |
| 9 | K2 Slice 3 forecast-revision defect | **RESOLVED by PR #14**: `rules/project_forecast_revision.inputs` reads `status != tombstoned [AND recorded_at <= as_of] ORDER BY recorded_at, id`. Slice 5 adopts that exact history predicate |
| 10 | 415 Content-Type | Covered in `test_security.py`, `test_aa_semantic.py`, `test_aa_isolation.py`, `test_aa_deletion.py`, `test_aa_signal_episodes.py`, `test_aa_reviews.py`. Slice 5 adds only a GET, so no new 415 surface |
| 11 | Stash + tag | unchanged (see §1) |
| 12 | Stable facades | Backend `routes → services → analytics → models`; Review facade `services/aa_reviews.py`; frontend facades `LocaleContext.jsx`, `api/analytics.ts`, `LifeDataContext.jsx`, `styles.css` manifest. Slice 5 plan respects all of them (§5) |
| 13 | Overlapping PRs | none open |

---

## 3. Findings kept, resolved or changed

| Old finding | Status |
| --- | --- |
| F1 · REVISION supersession → `status='active'` sees one version | **KEPT** — Slice 5 counts every non-tombstoned version |
| F2 / K2 · Slice 3 rule used the live-version read | **RESOLVED** (PR #14) |
| F3 / K3 · history endpoint `as_of` = live-at-T, not "versions recorded by T" | **KEPT** — `aa_history.read_metric_history` still applies `apply_as_of` to the forecasts layer when `as_of` is set. It is the decisive reason for Option A |
| F4 / K4 · primitives RU-only | **RESOLVED** for primitive labels (Slice 4 `useAAText`); the date-delta grammar (`−1 дней`) is **KEPT** and handled by a Project-specific formatter (Finance and Review output unchanged) |
| K5 · «выведено Life OS» vs `USER_REPORTED` | **KEPT** — copy says «ваш прогноз» |
| K6 · tasks / typical / observations / cause without a source | **KEPT** — omitted; observation count only when real rows exist |
| K7 · `AAQualityStrip(null)` says «покрытие неизвестно» | **KEPT** — Project page uses its own strip items |
| K8 · snapshot ahead of server history | **KEPT** — pending-write note |
| K9 · hard-deleted first forecast | **CHANGED / narrowed**: `aa_deletion.delete_fact(mode="hard")` refuses a fact that has `supersedes_id`, `superseded_by_id` or a linked successor (`DeletionConflictError`). A version inside a chain can only be **tombstoned**; only a lone, never-revised forecast can be hard-deleted. Tombstoned rows keep their grain columns (values nulled), so withdrawn versions are countable without exposing values. A hard-deleted lone forecast leaves no trace in the grain (receipts carry no subject) — the UI therefore never claims "first ever" (label «первая сохранённая оценка») |
| K10 · global `formatDelta` change | **KEPT** — not changed |
| K11 · hash special cases in `App.jsx` | **RESOLVED** by `app/routeRegistry.js` |
| K12 · merge conflicts with Slice 4 | **RESOLVED** (Slice 4 merged) |
| K13 · project id containing `:` | **KEPT** — the endpoint validates the subject and returns `400 invalid_subject` |

### New finding N1 — existing project-Target handling elsewhere

Two accepted read paths already turn a same-subject `aa_targets` row into
grounding for a project delta **without consulting the Target's window**:

- `services/reviews/context.py::_project_context` — latest Target as-of, window ignored;
- `services/aa_subjects.subject_summary` — the window check only runs when the
  reference has a window; a project reference never does.

`aa_targets` requires `window_start/window_end/timezone`, and no accepted
contract defines what a window means for a project completion date. No UI or
queue path writes project Targets (only raw API use could create one).

Slice 5 decision (owner safe default, prompt §10): **deltas stay neutral; no
Target is consulted.** Adopting the Review behaviour would mean inventing the
semantics of a project Target window. The divergence is recorded as backlog
(owner to decide whether project Targets are a defined concept; if so, Review,
subject summary and Project Analytics should share one rule). This does not
block Slice 5 — the canonical case has no Target anyway.

### New finding N2 — Review's project date delta grammar

Review's project compare cell renders `−1 дней` through the shared
`formatDelta`, and a test pins that string. Out of Slice 5 scope; backlog
("fix date-delta pluralisation in the shared formatter and update the Review
pin"). Slice 5 uses its own plural-correct formatter.

---

## 4. Hardening path reconciliation

| Old Discovery path | Current path |
| --- | --- |
| `App.jsx` `readRouteFromHash` / `setRoute` | `app/routeRegistry.js` (`readRouteFromHash`, `normalizeRoute`) |
| `App.jsx` static page imports | `app/lazyRoutes.jsx` (`LAZY_ROUTE_LOADERS`) |
| `context/LocaleContext.jsx` (new keys) | `context/locale/ru.js`, `context/locale/uk.js` |
| `api/analytics.ts` (new function) | new `api/analytics/projects.ts` + one facade line |
| `styles.css` | unchanged; AA component rules live in `src/analytics.css` (imported by AA components) |
| `services/aa_reviews.py` | facade over `services/reviews/*` — Slice 5 does not touch it |
| `services/aa_comparison.py` "dual-delta helper" (Plan §24.8) | `aa_comparison.py` is the append-side module (`append_version`); read-time derivation goes to a new read service `services/aa_project_analytics.py` using `analytics/delta.compute_delta` and `aa_desirability.desirability` unchanged |

---

## 5. Answers

```
OLD_BASELINE=ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef
CURRENT_BASELINE=63e41adebf22400dca3e30330bb347f4feef6027
K2_SIGNAL_DEFECT=RESOLVED
SLICE_4_REVIEW_SEAM=REUSABLE (ProjectCard.projectReviewHash; status=completed only; no new Review model/API)
HARDENING_PATH_RECONCILIATION=DONE (§4)
NEW_MIGRATION_EXPECTED=NO
NEW_PROJECT_SQL_TABLE_NEEDED=NO
OWNER_DECISION_REQUIRED=NO   (N1 recorded as backlog; the prompt fixes the neutral default)
PLAN_READY=YES
DISCOVERY_STATUS=PASS
```
