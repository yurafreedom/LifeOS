# LifeOS — Architecture / Modularization / Build Performance · TARGETED DISCOVERY

- Created: 2026-09-28 18:13:20 EEST
- Author: Claude Code session (read-only discovery; no production code modified)
- Task class: structural hardening / development velocity. **Not** a product change.

---

## 0. Execution gate — verified live state

| Fact | Verified value |
|---|---|
| Canonical checkout | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` |
| `git worktree list` | exactly **1** worktree |
| Local branch at discovery | `feat/adaptive-analytics-slice-4-reviews` |
| Local HEAD | `e243da757dbbd81904c83a167154f51cf284de27` |
| Porcelain status | clean (also clean with `--untracked-files=all`) |
| `origin/main` | `ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef` |
| PR #12 | **OPEN**, base `main`, head `e243da75…`, `MERGEABLE` / `CLEAN` |
| Recovery stash object | `51184836ace557fbd9492527bd845329b17b2a76` — present, untouched |
| Frozen design tag `adaptive-analytics-design-accepted` | `6c507b829ebc4a2a1e5b1b353db04c1a29302be0` — untouched |

**Consequence (prompt §1C).** `origin/main` does **not** yet contain Slice 4.
The Slice 4 candidate is still an open PR. Therefore:

- Discovery, Audit and Plan are allowed and are produced.
- **Production refactor implementation must not begin from this state.**
- `ACTIVE_PRODUCT_PR_BLOCKS_IMPLEMENTATION=YES`.

### Which tree was audited, and why

The refactor is intended to run *after* Slice 4 merges. Auditing `origin/main`
(pre-Slice-4) would therefore measure a tree that will not exist when the
refactor starts, and would miss `aa_reviews.py`, `ReviewPage.jsx` and the Review
locale keys entirely — the largest new surfaces.

So the **primary audited tree is the Slice 4 candidate head `e243da7`**
(inspected read-only, on its own branch, nothing modified), which is the exact
tree that becomes `main` when PR #12 merges with a normal merge commit and no
conflicting intervening commits. `origin/main` is referenced only for contrast.

`AUDITED_PRODUCT_HEAD=e243da757dbbd81904c83a167154f51cf284de27`

**Must be re-verified after PR #12 merges** (see §9).

---

## 1. Sources read

- `AGENTS.md` (canonical operating policy)
- `CLAUDE.md` (entry point; defers to AGENTS.md — no conflict found)
- `LIFEOS_MASTER_CONTEXT.md` (2699 lines, read in full)
- `Outputs/Implementations/lifeos-adaptive-analytics-slice-3_20260928-151155.md` (present on this head)
- `Outputs/Implementations/lifeos-adaptive-analytics-slice-4_20260928-171500.md` (present on this head)
- `Outputs/Discoveries/lifeos-adaptive-analytics-slice-4-review-targeted-discovery_20260928-162951.md` (present)
- `Outputs/Plans/lifeos-adaptive-analytics-slice-4-review-implementation-plan_20260928-163820.md` (present)
- Current production code under `apps/api/app/` and `apps/web/src/`

Authority order applied as specified: owner decision → merged production code →
merged implementation reports → slice plans/discoveries → older parents → stale
comments.

---

## 2. Verified baseline (measured on `e243da7`, not quoted from history)

Backend (`apps/api`, venv, `LIFEOS_TEST_DATABASE_URL` → **`lifeos_test` only**):

```
python -m pytest        380 passed, 13 warnings, 76.22s
ruff check .            All checks passed!
python -m compileall app OK
alembic heads           20260928_0006 (head)        — single head
alembic current         20260928_0006 (head)        — against lifeos_test
```

Frontend (`apps/web`):

```
npm test                242 passed / 25 files
npm run typecheck       PASS
npm run lint            PASS
npm run build           PASS
git diff --check        PASS   (repo root)
```

Build output (`npm run build -- --manifest`), 114 modules transformed:

```
dist/assets/index-*.css   147.36 kB │ gzip:  25.65 kB
dist/assets/index-*.js    507.69 kB │ gzip: 147.19 kB │ map: 1,271.01 kB
```

> `(!) Some chunks are larger than 500 kB after minification.`

**The Vite 500 kB advisory is still crossed — by 7.69 kB.** The authoring-time
figure of 507.69 kB is confirmed exactly. There is exactly **one** JS chunk; the
application performs **zero** dynamic imports in production code.

`dist/` is gitignored (`apps/web/.gitignore`) and was not committed.

---

## 3. Production file inventory

Tracked, authored, non-test, non-migration sources:
**195 files** (193 code + 2 CSS), **25,970 LOC of code**.

### 3.1 Top production files

| LOC | Bytes | Path |
|---:|---:|---|
| 5231 | 194,578 | `apps/web/src/styles.css` |
| 1837 | 112,507 | `apps/web/src/context/LocaleContext.jsx` |
| 1403 | 49,302 | `apps/api/app/services/aa_reviews.py` |
| 938 | 43,208 | `apps/web/src/context/LifeDataContext.jsx` |
| 665 | 23,710 | `apps/api/app/services/aa_signals.py` |
| 614 | 25,603 | `apps/web/src/App.jsx` |
| 584 | 21,333 | `apps/web/src/api/analytics.ts` |
| 494 | 23,682 | `apps/web/src/pages/analytics/ReviewPage.jsx` |
| 435 | 19,448 | `apps/web/src/pages/medications/MedConfigDrawer.jsx` |
| 432 | 17,962 | `apps/web/src/components/SettingsPage.jsx` |
| 390 | 13,157 | `apps/api/app/services/aa_facts.py` |
| 374 | 12,521 | `apps/web/src/components/ClarifyPanel.jsx` |
| 347 | 12,045 | `apps/web/src/domain/clarify.ts` |
| 321 | 13,809 | `apps/web/src/data/medications.js` |
| 313 | 11,567 | `apps/api/app/services/aa_finance.py` |

The §6 seed list is **confirmed accurate**. `styles.css` is 190 KB+, `LocaleContext.jsx`
is 110 KB+, `aa_reviews.py` is ~1400 LOC — all as stated.

### 3.2 Threshold counts (diagnostic only)

- production modules **> 800 LOC: 4** — `styles.css`, `LocaleContext.jsx`, `aa_reviews.py`, `LifeDataContext.jsx`
- production modules **> 1200 LOC: 3** — `styles.css`, `LocaleContext.jsx`, `aa_reviews.py`

Nothing else in the tree is above 700 LOC. The distribution is *not* a broadly
bloated codebase; it is a small number of genuinely large files.

### 3.3 Tests

- `apps/api/tests`: 35 files, includes domain-scoped helpers `aa_helpers.py`,
  `aa_review_helpers.py`, `aa_signal_helpers.py`.
- `apps/web/src/test`: 24 files; `apps/web/tests`: 1 file.
- Largest test files: `test_aa_semantic.py` (1098), `test_aa_signal_episodes.py`
  (896), `test_aa_reviews.py` (764), `analytics-signals.test.jsx` (470).

---

## 4. Import graph

### 4.1 Backend (Python AST, 88 modules, 335 internal edges)

**Cycles: 4 reported, all one intentional pattern.**

```
app.analytics.rules → app.analytics.rules.{coverage_partial,data_stale,
                      finance_threshold,project_forecast_revision} → app.analytics.rules
```

Inspected directly: `rules/__init__.py` defines the shared contracts
(`Evaluation`, `SignalSubject`, `compose_episode_key`) at module top, and imports
the four rule modules **lazily inside `_registry()`** with the comment
*"Imported lazily so a rule module may import this package's helpers."*

This is a deliberate registry/facade pattern with **no import-time cycle**. It is
a *precedent to copy*, not a defect to fix. Counted separately below.

**`IMPORT_CYCLES_BEFORE = 0` true import-time cycles (4 deferred-registry edges).**

Highest fan-in:

| Fan-in | Module |
|---:|---|
| 31 | `app.models` |
| 30 | `app.analytics.enums` |
| 19 | `app.models.base` |
| 17 | `app.config` |
| 16 | `app.services.aa_facts` |
| 15 | `app.db` |
| 14 | `app.dependencies` |

Highest fan-out: `app.models` (19), `app.main` (18), `app.services.aa_finance` (13),
then the route modules (10–12 each).

Dependency direction is already clean: routes → services → analytics primitives →
models. **No model imports a service. No utility imports a route.**

### 4.2 Frontend (105 production code modules, 279 internal static edges)

**Cycles: 0.** Verified by DFS over the resolved static import graph.

**Dynamic `import()` in production code: 0.** The only three dynamic imports in
the whole tree are inside `src/test/smoke.test.jsx`.

Highest fan-in:

| Fan-in | Module |
|---:|---|
| **50** | `context/LocaleContext.jsx` |
| 24 | `components/icons.jsx` |
| 18 | `context/LifeDataContext.jsx` |
| 11 | `api/client.ts` |
| 11 | `components/HeroVignette.jsx` |
| 8 | `components/analytics/useAAText.js` |
| 7 | `context/AnalyticsContext.jsx` |

Highest fan-out: `App.jsx` (**31**), `LifeDataContext.jsx` (13), then pages at 8–11.

Notably low fan-in, contradicting an intuitive assumption:

| Module | Fan-in | Importers |
|---|---:|---|
| `api/analytics.ts` | **2** | `analytics/review.ts`, `repositories/analyticsRepository.ts` |
| `pages/analytics/ReviewPage.jsx` | 1 | `App.jsx` |
| `components/SettingsPage.jsx` | 1 | `App.jsx` |
| `app/routes.js` | 2 | `App.jsx`, `pages/ProjectsPage.jsx` |

**Implication:** several "big" files are cheap to split because almost nothing
imports them. A stable facade is only strictly required for `LocaleContext.jsx`
(50 importers) and `LifeDataContext.jsx` (18).

### 4.3 Root static route imports

`App.jsx` statically imports **16 route-rendering surfaces**:

```
pages/DogPage, pages/FinancesPage, pages/HealthPage, pages/HomePage,
pages/LoginPage, pages/MedicationsPage, pages/PlaceholderPage,
pages/ProfilePage, pages/ProjectsPage, pages/QuickNotesPage,
pages/RelocatedPages (GoalsPage+HabitsPage), pages/TasksPage,
pages/analytics/MetricHistoryPage, pages/analytics/ReviewPage,
pages/finances/FinanceAnalytics, components/SettingsPage
```

`ROOT_STATIC_ROUTE_IMPORTS_BEFORE = 16`.

**Finding:** the three analytics routes (`analytics`, `analytics-history`,
`review`) are gated at *runtime* by `ANALYTICS_ROUTE_ENABLED` in `app/routes.js`,
but `App.jsx` imports `FinanceAnalytics`, `MetricHistoryPage` and `ReviewPage`
**unconditionally**. In a build without `VITE_LIFEOS_ANALYTICS_ENABLED`, that code
still ships to every user while being unreachable.

### 4.4 CSS import edges

- `main.jsx → styles.css` (the single global stylesheet)
- `analytics.css` is imported by 7 `components/analytics/*` modules plus
  `pages/analytics/ReviewPage.jsx` (bundler-deduplicated).

---

## 5. Responsibility audit of hotspots

### 5.1 `apps/api/app/services/aa_reviews.py` — 1403 LOC, 35 functions, 10 classes

Top-level structure, read from the AST (line ranges exact):

| Lines | Responsibility |
|---|---|
| 1–74 | module docstring + imports (10 internal modules) |
| 75–112 | constants: `PROJECT_METRIC`, `MANIFEST_VERSION`, `MAX_ALONGSIDE`, `MAX_WINDOW_DAYS`, `LIST_LIMIT_MAX`, `SOURCE_MODELS`, `VALUE_COLUMNS`, `ERASED_ITEM_VALUES` |
| 118–158 | **errors** — 8 classes, all `AAServiceError` subclasses carrying `code`/`message` |
| 165–252 | **context DTOs** — `ContextItem`, `ReviewContext` |
| 255–332 | **value / provenance helpers** — `_q`, `_utc`, `_plain`, `_fact_value`, `_value_out_to_fact`, `_provenance`, `_semantic_provenance`, `_derived_provenance` |
| 335–793 | **context derivation** — `_delta_item`, `_target_items`, `_observation_items`, `_classify_version_ids`, `_finance_context`, `_latest`, `_project_context`, `_month_bounds`, `resolve_review_subject`, `validate_window`, `build_context` |
| 799–1061 | **persistence** — `_persist_items`, `_revision_by_key`, `save_review`, `_choice`, `revise_review` |
| 1067–1109 | **redaction / privacy** — `redact_review_context` (D1 hard-erasure adapter) |
| 1115–1403 | **read model** — `_source_states`, `_state_of`, `PRIORITY`, `_chain_head`, `_value_payload`, `_item_payload`, `context_payload`, `_stored_item_payload`, `_decision_payload`, `read_review`, `list_reviews` |

**Independent reasons this file changes:** a new context role; a changed delta
rule; a new subject kind; a change to save/revise idempotency; a change to
redaction semantics; a change to how corrections are surfaced at read time; a
new API field. That is **six to seven independent axes in one module** — the
clearest responsibility overload in the repository.

**Public surface is tiny.** Only 3 modules import it:

| Importer | Symbols |
|---|---|
| `app/routes/aa_reviews.py` | `LIST_LIMIT_MAX`, `UnsupportedReviewSubjectError`, `build_context`, `context_payload`, `list_reviews`, `read_review`, `revise_review`, `save_review` |
| `app/services/aa_deletion.py` | `redact_review_context` (registered in `SOURCE_REDACTORS`) |
| `tests/test_aa_review_redaction.py` | `redact_review_context` |

Seven of the eight error classes are referenced **nowhere outside this module** —
routes catch the `AAServiceError` base and read `.code`/`.message`. So moving the
error classes is behaviour-neutral by construction.

### 5.2 `apps/api/app/services/aa_signals.py` — 665 LOC

| Lines | Responsibility |
|---|---|
| 73–85 | errors (3) |
| 89–137 | DTOs: `SignalCard`, `CoverageConfidence`, `SignalReport`, `_Outcome` |
| 143–285 | **subject discovery** — `_month_bounds`, `_period_id`, `_earliest_discovery_period`, `_finance_periods`, `_project_subject_ids`, `evaluation_subjects` |
| 291–589 | **evaluation + episode reconciliation + ranking** — `_evaluate_rules`, `_coverage_confidence`, `_zero_state`, `_existing_episodes`, `_card`, `_rank`, `evaluate_signals` (154 LOC) |
| 595–650 | **acknowledgement** — `acknowledge_episode` |

Three groups, not seven. Subject discovery is genuinely independent of
evaluation. This is a *milder* case than `aa_reviews.py`.

### 5.3 `apps/web/src/context/LocaleContext.jsx` — 1837 LOC / 112,507 bytes

| Lines | Content | Share |
|---|---|---|
| 1–8 | imports + header comment | — |
| **9–936** | `ru:` dictionary | ~928 lines |
| **937–1799** | `uk:` dictionary | ~863 lines |
| 1800–1837 | `LIFE_LOCALES`, `makeT` (incl. Slavic 3-form `t.pl`), `React.createContext`, exports | ~37 lines |

**97% of this file is dictionary data.** The provider/factory logic is 37 lines.

Public exports: `LifeStrings`, `LifeLocales`, `LifeMakeT`, `LifeLocaleContext`.
`LifeStrings` is read directly by **12 production modules** (all for
`LifeStrings[locale]._intl_locale`) and by 3 test files.

Behaviour pinned by existing tests that must keep passing unchanged:

- `analytics-signals.test.jsx:297` — `expect(Object.keys(LifeStrings)).toEqual(['ru','uk'])`
- `clarify-ui.test.jsx:233` — `expect(LifeStrings.en).toBeUndefined()`
- `clarify-ui.test.jsx:236–248` — RU/UK key parity, non-empty, and RU ≠ UK for new keys
- `analytics-review.test.jsx:226` — `aa_(rv|pr)_*` key parity

### 5.4 `apps/web/src/context/LifeDataContext.jsx` — 938 LOC

| Lines | Responsibility |
|---|---|
| 53–302 | **pure, React-free**: `buildDefaultHabits`, `buildInitialState`, `isoDaysAgo`, `buildDefaultGoals`, `seedTransactions`, `defaultScheduleTimes`, `isPlainObject`, `migrateStateCopy`, `buildLegacyPreview` (~250 LOC) |
| 304–438 | provider setup, sync wiring (`attachAcknowledged`), `mutate` |
| 439–478 | Tasks |
| 479–569 | Transactions (flexible finance, `correctTransaction`) |
| 570–627 | Projects (Slice P; enqueues AA facts before mutating) |
| 628–653 | Goals / habits |
| 654–665 | Quick notes |
| 666–715 | Clarify (6 outcomes) |
| 716–727 | Profile, Dog |
| 728–829 | **Medications** (~102 LOC — the largest single domain group) |
| 830–937 | Maintenance / export / `exportUnsaved` / provider value |

All domain actions are closures over `setStateRaw` / `mutate`; several also
depend on the analytics queue. `buildInitialState` and `migrateStateCopy` are
already public exports and are independently tested by `state-migration.test.ts`.

### 5.5 `apps/web/src/App.jsx` — 614 LOC

| Lines | Responsibility |
|---|---|
| 1–32 | 31 static imports (16 of them route surfaces) |
| 46 | `LIFE_DEBUG` (`?debug` flag) |
| 53–63 | **route parsing** — `readRouteFromHash` (medications/* and review/* sub-route rules) |
| 67–81 | sidebar collapse persistence |
| 83–203 | **theme/scene controller** — `useTheme` (~120 LOC: pref mode, system media query, paradise scene pref) |
| 204–571 | **`AppShell`** (~368 LOC): route state + hash sync, derived collections, `addTaskFromUI`, 6 Clarify handlers, toast, quick-add, ⌘K, **paradise pointer-physics global listeners** (~40 LOC of DOM effects), `counts`, `renderRoute()` switch (410–486), full shell JSX, debug rail, 3 modals |
| 572–598 | `AuthGate` |
| 599–612 | `App` — composes `LifeLocaleContext.Provider` with locale **and theme** values |

**Coupling smell confirmed:** `useTheme` lives in `App.jsx` but its values
(`themeMode`, `themeEff`, `setTheme`, `scenePref`, `setScenePref`) are published
through `LifeLocaleContext` — the locale context doubles as the theme context.

### 5.6 `apps/web/src/api/analytics.ts` — 584 LOC

Already banner-separated by API domain; roughly 70% is TypeScript type
declarations (erased at build time):

| Lines | Domain |
|---|---|
| 1–189 | facts: values, subjects, provenance, measurements, corrections, coverage, history |
| 190–250 | finance month + legacy import |
| 251–284 | metric history + fact provenance |
| 285–350 | semantic concepts (expectation/forecast/baseline/target/preference/observation) |
| 351–452 | Slice 3 · signals |
| 453–584 | Slice 4 · Review / Debrief |

Fan-in 2. Because most of the file is types, splitting it has **no bundle
effect** — it is purely an ownership/conflict-surface change.

### 5.7 `apps/web/src/pages/analytics/ReviewPage.jsx` — 494 LOC

Contains: `useNarrow` hook, formatters (`formatInstant`, `choiceLabel`,
`flagText`, `cellNote`, `provenanceLabel`), `deltaProps`, `ReviewEvidence`,
`alongsideFacts`/`Alongside`, `evidenceHistory`, `ChoiceList`, `FactorEditor`,
`eyebrow`/`exitHash`, `STEP_COPY`, `ReviewFlow` (step wizard), `SavedReview`,
`readHash`, and the `ReviewPage` route shell.

Already exports `flagText`, `deltaProps`, `ReviewEvidence`, `ReviewFlow`,
`SavedReview` — `analytics-review.test.jsx` imports these directly, so the
internal boundaries are already partly real.

### 5.8 `apps/web/src/components/SettingsPage.jsx` — 432 LOC

Already internally decomposed into 8 section components — `AccountSection` (17),
`CategoriesSection` (43), `TelegramSection` (18), `MonobankSection` (16),
`NotificationsSection` (14), `AppearanceSection` (69), `ExportSection` (51),
`DangerSection` (86) — plus shared `Row`, `Toggle`, `ThemeGlyph`.

Only `ExportSection` and `DangerSection` carry real async/privacy logic
(account export / account deletion). `ExportSection` is already exported and
tested by `settings-export.test.jsx`.

---

## 6. Git churn / co-change audit — **and its limits**

**The honest headline: this repository's history is too short and too coarse for
co-change analysis to be trustworthy evidence.**

- Total commits scanned: **40**. Commits in the Adaptive Analytics era
  (since 2026-09-08): **25**.
- The project deliberately ships one large commit per slice. Consequently almost
  every file touched by a slice co-changes with every other file in that slice,
  and Jaccard coefficients land at 0.5–1.0 for pairs with no real semantic
  coupling at all.

Churn counts (AA era, top):

| Commits | File |
|---:|---|
| 5 | `apps/web/src/context/AnalyticsContext.jsx` |
| 5 | `apps/web/src/context/LocaleContext.jsx` |
| 5 | `apps/api/app/main.py` |
| 4 | `apps/web/src/App.jsx` |
| 4 | `apps/web/src/analytics.css` |
| 4 | `apps/web/src/api/analytics.ts` |
| 4 | `apps/api/app/routes/aa_measurements.py` |
| 4 | `apps/api/app/services/export.py` |
| 4 | `apps/api/app/models/__init__.py` |
| 4 | `apps/web/src/context/LifeDataContext.jsx` |

Two conclusions **are** safe to draw:

**(a) The registry cluster is intentional, not a defect.**
`main.py` ↔ `models/__init__.py` ↔ `export.py` ↔ `enums.py` co-change at J = 0.75–1.00.
This is exactly the checklist that master context §46 *requires*: a new
account-owned AA table must update the export registry and deletion coverage in
the same slice. **Do not "fix" this coupling** — it is a safety property.

**(b) The locale file is a genuine, repeating conflict surface.**
Every AA-era frontend slice appends to `LocaleContext.jsx`:

| Commit | Lines added to `LocaleContext.jsx` |
|---|---:|
| `2205c3e` (Slice 0b) | +10 |
| `690b39a` (Slice P) | +60 |
| `4dae14e` | +97 |
| `5dedca8` | +80 |
| `e243da7` (Slice 4) | **+266** |

All additions, zero deletions — but they land in **two distant hunks of one
112 KB file** (end of the `ru` block ≈ line 930, end of the `uk` block ≈ line 1795).
Two concurrent slices adding copy collide in the same two hunks every time.

---

## 7. Test blast-radius audit

Frontend test files importing each hotspot:

| Module | Test files |
|---|---:|
| `context/LocaleContext.jsx` | 8 |
| `context/LifeDataContext.jsx` | 7 |
| `App.jsx` | 2 |
| `pages/analytics/ReviewPage.jsx` | 1 |
| `components/SettingsPage.jsx` | 1 |
| `api/analytics.ts` | 0 |

Backend: `aa_reviews` / `aa_signals` appear in 10 test modules, but the suite
**already uses domain-scoped helpers** (`aa_helpers.py`, `aa_review_helpers.py`,
`aa_signal_helpers.py`) rather than a generic dump. Test structure is healthy.

Largest test files — `test_aa_semantic.py` (1098), `test_aa_signal_episodes.py`
(896), `test_aa_reviews.py` (764) — are merge-conflict hotspots but are
behaviourally well-organised. No test currently has to import a giant module it
does not actually exercise.

**No test weakening is required by anything proposed here.**

### Critical constraint discovered: how frontend UI tests render

`vite.config.js` sets `test.environment: 'node'`, and **every** UI test renders
via `renderToStaticMarkup` from `react-dom/server` (verified across 10 test
files). This directly constrains route-level lazy loading, so it was probed
empirically against the installed React 18.3.1:

```
UNRESOLVED   -> "<div class=\"fb\">LOADING</div>"     (renders fallback, does NOT throw)
PRE-RESOLVED -> "<div class=\"real-page\">REAL</div>" (renders real component)
```

**Result:** `React.lazy` + `Suspense` under `renderToStaticMarkup` renders the
fallback when the module has not resolved, and the real component once the module
promise has settled. It does not crash. Route-level code splitting is therefore
**viable**, provided any test that asserts a lazily-loaded route's markup first
awaits that route's module.

`smoke.test.jsx` asserts only the **home** route (`class="home-hero"`), and home
must stay eagerly loaded regardless — so that test is unaffected.
`smoke.test.jsx:47` also pins `LIFE_ROUTES.size === 19`, which any route-registry
change must preserve exactly.

---

## 8. CSS architecture audit

### 8.1 `styles.css` — 5231 lines, 194,578 bytes, 50 labelled sections

Sections are already banner-delimited and chronologically ordered
(UI Kit → tokens → light theme → layout → sidebar → TopBar → … → Sprint 3A →
Sprint 3B → Sprint 3.5 → Sprint 3.6).

Measured selector statistics:

- top-level rule selectors: **1427**; distinct: **1341**
- selectors declared more than once: **42**
- of those, spread over more than 300 lines: **23**

### 8.2 Where order genuinely matters

The widest-spread duplicates cluster almost entirely into **two deliberate
cross-cutting override layers at the end of the file**:

| Lines | Layer | Re-declares |
|---|---|---|
| 4604–4634 | *Sprint 3.5 · Variant А — glass card system* | `.panel`, `.stat-card`, `.chart-card`, `.pc-card`, `.medc`, `.meds-item`, `.meds-interactions`, `.ph-card`, `.mdp-stat`, `.mdp-timers-card`, `.milestone`, `.today-hero`, `*.is-stakes` |
| 4635–5231 | *Sprint 3.6 · Paradise theme* | `.money-log`, `.set-btn-primary`, `.medc-action-take`, `.btn--stakes`, `.qa-backdrop`, `.mcd-backdrop`, … |

Examples of the measured spread:

```
span 4324  .money-log            lines [806, 5010, 5030, 5041, 5096, 5107, …]
span 4001  .today-hero           lines [622, 4623]
span 3950  .panel                lines [669, 4610, 4619]
span 2886  [data-theme="light"] .sb  lines [388, 3274]
span 1569  .meds-view-tab        lines [2002, 3571]
```

So the real cascade contract is:

```
tokens/density (1–360)
  → light-theme token overrides (214–360)
  → layout + components + pages (362–4603)      ← largely order-independent among themselves
  → glass card system (4604–4634)               ← MUST stay after all card components
  → paradise theme (4635–5231)                  ← MUST stay last
```

Two genuine exceptions inside the component band that must keep relative order:

- `.meds-view-tab` / `.meds-filter-chip` declared at **2002** (Tasks-page toolbar,
  shared chip rules) and refined at **3571/3575** (Medications).
- `[data-theme="light"] .sb` at **388** and again at **3274** (same specificity;
  the later rule adds `border-right-color`).

**Conclusion:** a split is feasible **only** if the original concatenation order
is reproduced exactly. It is not safe to reorder into "all components, then all
pages, then all themes".

### 8.3 `analytics.css` — 193 lines / 15,351 bytes

Four labelled blocks (Slice 1 primitives, Slice 3 signal card + Home signals,
a11y naming note, Slice 4 Review). Small, cohesive, already domain-scoped.
No action indicated.

---

## 9. Frontend bundle audit

### 9.1 Per-module attribution of the single JS chunk

Attributed from the emitted source map (no analyzer dependency added);
473,687 of 507,690 bytes attributed:

| Bytes | Share | Module |
|---:|---:|---|
| 128,699 | 27.17% | `react-dom` (production.min) |
| **63,673** | **13.44%** | **`src/context/LocaleContext.jsx`** |
| 20,237 | 4.27% | `src/context/LifeDataContext.jsx` |
| 15,663 | 3.31% | `src/pages/analytics/ReviewPage.jsx` |
| 12,770 | 2.70% | `src/components/SettingsPage.jsx` |
| 12,341 | 2.61% | `src/components/icons.jsx` |
| 12,227 | 2.58% | `src/pages/medications/MedConfigDrawer.jsx` |
| 11,151 | 2.35% | `src/App.jsx` |
| 7,195 | 1.52% | `src/components/ClarifyPanel.jsx` |
| 6,533 | 1.38% | `src/pages/DogPage.jsx` |
| 6,425 | 1.36% | `react` |
| 6,341 | 1.34% | `src/data/medications.js` |
| 6,274 | 1.32% | `src/components/TaskDetailModal.jsx` |
| 5,957 | 1.26% | `src/pages/medications/MedDetailPage.jsx` |
| 5,837 | 1.23% | `src/pages/FinancesPage.jsx` |
| 5,623 | 1.19% | `src/pages/finances/FinanceAnalytics.jsx` |

Grouped:

| Bytes | Share | Group |
|---:|---:|---|
| 139,879 | 29.53% | `node_modules` (react + react-dom + scheduler) |
| 96,056 | 20.28% | `src/pages/**` |
| 90,591 | 19.12% | `src/context/**` |
| 84,104 | 17.76% | `src/components/**` |
| 31,733 | 6.70% | other `src` |
| 14,333 | 3.03% | `src/data/**` |
| 10,089 | 2.13% | `src/analytics/**` |
| 6,902 | 1.46% | `src/repositories` + `src/api` |

### 9.2 Measured lazy-load candidates

Aggregating the medications surface (`MedicationsPage`, `MedConfigDrawer`,
`MedDetailPage`, `MedCard`, `TakeDoseModal`, `GlobalJournal`, `PharmNotes`,
`data/medications.js`, `lib/medMath.js`):

| Candidate | Attributed bytes |
|---|---:|
| Medications surface (whole route) | **≈ 43,800** |
| `ReviewPage` | 15,663 |
| `SettingsPage` | 12,770 |
| `DogPage` | 6,533 |
| `FinanceAnalytics` | 5,623 |

The advisory is exceeded by only **7.69 kB**. Deferring *any one* of the top
three candidates clears it; deferring medications + settings + review removes
roughly **72 kB** from the entry chunk with comfortable margin.

### 9.3 Two important bundle caveats

1. **Splitting `LocaleContext.jsx` will not shrink the bundle.** Current
   behaviour requires both dictionaries to be present synchronously —
   `LifeStrings[locale]._intl_locale` is read by 12 production modules, and tests assert
   `Object.keys(LifeStrings) === ['ru','uk']`. A facade that statically imports
   `ru` and `uk` keeps every byte in the entry chunk. The locale split is a
   **conflict-surface and ownership** win, **not** a bundle win, and must not be
   reported as one.

2. **Splitting `api/analytics.ts` will not shrink the bundle** either — most of
   it is types, erased at build time.

The genuine bundle lever is **route-level `React.lazy`**, and nothing else.

---

## 10. Development-change scenarios (current cost)

Traced against the real module graph and confirmed against the actual Slice 3 /
Slice 4 commits.

| # | Change | Files touched today | Unrelated code exposed | Conflict surface |
|---|---|---|---|---|
| 1 | Add one RU/UK locale key | `context/LocaleContext.jsx` (**1 file, 112 KB**) | all 1791 dictionary lines + `makeT` + context creation | **two hunks in one 112 KB file — every slice, every time** |
| 2 | Add a top-level route | `app/routes.js`, `App.jsx` (import + `renderRoute` case), `components/Sidebar.jsx`, `components/MobileBottomNav.jsx`, `context/LocaleContext.jsx` (nav copy) | whole 614-LOC `App.jsx` incl. theme controller + Clarify + pointer physics | high — `App.jsx` is edited by every routed feature |
| 3 | Add an AA endpoint | `app/routes/aa_*.py`, `app/schemas/aa_*.py`, `app/services/aa_*.py`, `app/main.py` | `main.py` router registration only | moderate; intentional |
| 4 | Add a Review context role | `services/aa_reviews.py` (context derivation **and** read model **and** payload builders, ~3 distant regions of one 1403-LOC file), `analytics/enums.py`, `schemas/aa_reviews.py`, `api/analytics.ts`, `pages/analytics/ReviewPage.jsx`, `LocaleContext.jsx` | save/revise/redaction implementations sit between the edited regions | **high — one 1403-LOC file edited in 3 places** |
| 5 | Change Review redaction | `services/aa_reviews.py:1067–1109` | 1358 unrelated lines in the same file; context derivation and read model both in scope for review | high, and privacy-sensitive |
| 6 | Add a snapshot domain mutation | `context/LifeDataContext.jsx` (provider interior) | all other domain actions, migration, seeds | moderate–high |
| 7 | Add an analytics queued write | `api/analytics.ts`, `repositories/analyticsRepository.ts`, `repositories/analyticsWriteQueue.ts`, `context/AnalyticsContext.jsx` | whole 584-LOC all-domain HTTP module | moderate |
| 8 | Add a component-specific style | `src/styles.css` — **search 5231 lines / 194 KB** to find the owning section | every other section | **high — single-file, always** |
| 9 | Add a settings section | `components/SettingsPage.jsx` | 7 other sections | low–moderate |

Scenarios **1, 4, 5 and 8** are where the real cost is concentrated.

---

## 11. Invariants confirmed unaffected

Nothing in this discovery requires touching:

- `Expectation ≠ Target`, `Actual ≠ Forecast`, `Prediction ≠ Preference`
- `missing ≠ zero`, `missing ≠ explicit unknown`, `future ≠ missed`
- `direction ≠ desirability ≠ materiality`
- `correction ≠ revision ≠ new event`
- `NO_DECISION ≠ INCONCLUSIVE`, `ABANDONED ≠ PENDING`
- `coverage ≠ fact presence`
- no Life Score, no cross-unit global score
- snapshot `state.version = 2`; server `schema_version = 2`
- single Alembic head `20260928_0006`
- exactly four signal rules; no rule references desirability
- API URLs, route hashes, locale copy, theme behaviour, queue semantics

**No database migration is indicated.** No broken migration was found.

---

## 12. Discovery gate

```
DISCOVERY_STATUS=PASS
AUDIT_STATUS=PASS                      (see the Audit artifact)
OWNER_DECISION_REQUIRED=NO
IMPLEMENTATION_PLAN_ALLOWED=YES
ACTIVE_PRODUCT_PR_BLOCKS_IMPLEMENTATION=YES
```

No product or semantic decision is required. Every remaining choice is
structural and is resolved in the Audit and Plan.

### Must be re-verified after PR #12 merges, before any implementation

1. `origin/main` SHA, and that it is a normal merge commit with two parents.
2. That the merged tree still matches `e243da7` for the audited files — re-run
   the inventory (`LOC`/bytes for the 15 hotspots) and both import graphs.
3. Rebuild the bundle baseline: entry JS, total JS, CSS, advisory status.
4. Re-run the full backend + frontend baseline (expect 380 / 242 unless Slice 4
   review changed something pre-merge).
5. Confirm no Slice 5 work has landed that touches the same seams.
6. Confirm the recovery stash object and the frozen design tag are still
   untouched.
