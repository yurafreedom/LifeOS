# LifeOS — Development Architecture Modularization · IMPLEMENTATION PLAN

- Created: 2026-09-28 18:13:20 EEST
- Discovery: `Outputs/Discoveries/lifeos-architecture-modularization-targeted-discovery_20260928-181320.md`
- Audit: `Outputs/Audits/lifeos-development-architecture-modularity-audit_20260928-181320.md`
- Planned against: `e243da757dbbd81904c83a167154f51cf284de27` (Slice 4 candidate, PR #12 **OPEN**)
- Branch to use: `refactor/development-architecture-modularization`

> **This plan is not executable yet.** `origin/main` is `ea3a75e…` and does not
> contain Slice 4. Implementation starts only from a clean `main` that already
> contains everything being modularized. See §0 and §9.

---

## 0. Preconditions — all must hold before commit 1

```
git switch main
git fetch origin --prune
git merge --ff-only origin/main
```

Then verify:

1. `HEAD == origin/main`, and that commit is a **merge commit with two parents**.
2. `git status --porcelain --untracked-files=all` is empty.
3. `git worktree list` shows exactly one worktree.
4. PR #12 is `MERGED`; no other overlapping product PR is open.
5. Recovery stash object `51184836ace557fbd9492527bd845329b17b2a76` present.
6. Frozen tag `adaptive-analytics-design-accepted` still at `6c507b82…`.
7. Re-run the §10 baseline on merged main and **replace** the BEFORE numbers in
   this plan if they differ from the audited head.
8. Re-run both import-graph scripts; confirm 0 true frontend cycles and 0 true
   backend cycles (4 deferred-registry edges expected).

If any of 1–6 fails: **STOP** and report.

---

## 1. Scope split — structural vs runtime

These are related but **separate**, and are planned and committed separately:

| | Work | Commits |
|---|---|---|
| **PART A — STRUCTURAL MODULARIZATION** | moving responsibilities behind stable facades. Zero bundle intent. | 1–8 |
| **PART B — RUNTIME BUNDLE OPTIMIZATION** | route-level `React.lazy`. Zero structural intent. | 9 |

Part B depends on Part A only for commit 4 (route registry). Part A is
independently valuable and independently revertible.

---

## 2. Commit sequence

Each commit is a rollback point: the tree is green at every one.

| # | Commit | Area |
|---|---|---|
| 1 | Add characterization tests for boundaries not yet pinned | tests only |
| 2 | Split locale dictionaries behind the `LocaleContext` facade | frontend |
| 3 | Modularize the backend Review service behind `aa_reviews` facade | backend |
| 4 | Extract route registry, theme hook and shell effects from `App.jsx` | frontend |
| 5 | Extract `LifeDataContext` pure state block | frontend |
| 6 | Split `api/analytics.ts` by API domain behind a facade | frontend |
| 7 | Split `ReviewPage` and the two privacy `SettingsPage` sections | frontend |
| 8 | Split `styles.css` into an ordered layer manifest | CSS |
| 9 | Add measured route-level lazy loading | bundle |
| 10 | Module-boundary map + implementation report | docs |

---

## 3. PART A — structural modularization

### Commit 1 — characterization (tests only, no production change)

Purpose: pin behaviour **before** moving it, per prompt §13. Only add tests where
a boundary is not already covered. Do not weaken any existing test.

| Test to add | Pins | Why it does not exist yet |
|---|---|---|
| `src/test/locale-shape.test.ts` | `Object.keys(LifeStrings) === ['ru','uk']`; RU/UK key sets are **exactly equal**; every value is `string` or a 3-element array; `_intl_locale` present in both; `LifeStrings.en === undefined` | today parity is asserted only for *new-key prefixes* in `clarify-ui` / `analytics-signals` / `analytics-review`. A whole-dictionary parity test is the real safety net for a data move. |
| `src/test/locale-shape.test.ts` (same file) | `makeT('uk')('some_ru_only_key')` falls back to RU; `t.pl` picks one/few/many for 1, 3, 11, 21 | `makeT` fallback + Slavic plural logic is currently untested directly |
| `src/test/route-registry.test.ts` | `readRouteFromHash` for: `''`, `#/home`, `#/unknown`, `#/medications`, `#/medications/42`, `#/review/new/...`, `#/review/<id>`, `#/analytics` | today only `LIFE_ROUTES.size === 19` is pinned; the hash-parsing rules are untested |
| `apps/api/tests/test_aa_review_contracts.py` | every review error class is an `AAServiceError` and its `code`/`message` values are exactly the current strings | the codes are the API contract and are currently only asserted indirectly through route responses |

Rollback point: tests-only commit; revert is free.

---

### Commit 2 — locale dictionaries (PRIORITY 1)

**Source:** `apps/web/src/context/LocaleContext.jsx` (1837 LOC / 112,507 B)

**Destination:**

| File | Content | Approx LOC |
|---|---|---|
| `apps/web/src/context/locale/ru.js` | the `ru` object, verbatim, as `export const ru = { … }` | ~928 |
| `apps/web/src/context/locale/uk.js` | the `uk` object, verbatim, as `export const uk = { … }` | ~863 |
| `apps/web/src/context/locale/makeT.js` | `makeT` incl. `t.pl`, plus `LIFE_LOCALES` | ~40 |
| `apps/web/src/context/LocaleContext.jsx` | **facade** | ~25 |

**Facade content (exports unchanged, same path):**

```js
import React from 'react';
import { ru } from './locale/ru.js';
import { uk } from './locale/uk.js';
import { LIFE_LOCALES, makeT as makeTFactory } from './locale/makeT.js';

const LifeStrings = { ru, uk };
const LifeLocales = LIFE_LOCALES;
const LifeMakeT   = locale => makeTFactory(locale, LifeStrings);
const LifeLocaleContext = React.createContext({
  locale: 'ru', t: LifeMakeT('ru'), setLocale: () => {},
});
export { LifeStrings, LifeLocales, LifeMakeT, LifeLocaleContext };
```

- **Exports:** identical four symbols from the identical path.
- **Imports that change:** **none.** All 50 importers untouched.
- **Callers affected:** none.
- **Tests affected:** none must change. `clarify-ui`, `analytics-signals`,
  `analytics-review` keep importing `LifeStrings` from the same path.
- **Cycle risk:** none — `ru.js`/`uk.js`/`makeT.js` import nothing internal.
- **Bundle effect:** **none, intentionally.** Both dictionaries stay statically
  imported because current behaviour requires both synchronously. *This must be
  reported as a conflict-surface win, not a bundle win.*
- **Mechanical risk to guard:** the dictionaries are moved **verbatim**; no key
  renaming, no reordering, no copy edits. `makeT` gains the dictionary as a
  parameter instead of closing over a module global — the only logic change, and
  it is covered by commit 1's fallback test.

**Rollback point:** revert this commit alone; nothing else depends on it.

---

### Commit 3 — backend Review service (PRIORITY 2)

**Source:** `apps/api/app/services/aa_reviews.py` (1403 LOC)

**Destination package `apps/api/app/services/reviews/`:**

| File | Moved from lines | Responsibility | Approx LOC |
|---|---|---|---|
| `errors.py` | 118–158 | the 8 `AAServiceError` subclasses | ~45 |
| `contracts.py` | 75–112, 165–252 | constants (`PROJECT_METRIC`, `MANIFEST_VERSION`, `MAX_ALONGSIDE`, `MAX_WINDOW_DAYS`, `LIST_LIMIT_MAX`, `SOURCE_MODELS`, `VALUE_COLUMNS`, `ERASED_ITEM_VALUES`, `STORAGE_QUANTUM`) + `ContextItem`, `ReviewContext` | ~130 |
| `values.py` | 255–332 | `_q`, `_utc`, `_plain`, `_fact_value`, `_value_out_to_fact`, `_provenance`, `_semantic_provenance`, `_derived_provenance` | ~85 |
| `context.py` | 335–793 | `_delta_item`, `_target_items`, `_observation_items`, `_classify_version_ids`, `_finance_context`, `_latest`, `_project_context`, `_month_bounds`, `resolve_review_subject`, `validate_window`, `build_context` | ~465 |
| `persistence.py` | 799–1061 | `_persist_items`, `_revision_by_key`, `save_review`, `_choice`, `revise_review` | ~270 |
| `redaction.py` | 1067–1109 | `redact_review_context` (D1 hard-erasure adapter) | ~50 |
| `read_model.py` | 1115–1403 | `_source_states`, `_state_of`, `PRIORITY`, `_chain_head`, `_value_payload`, `_item_payload`, `context_payload`, `_stored_item_payload`, `_decision_payload`, `read_review`, `list_reviews` | ~295 |
| `__init__.py` | — | empty or `__all__` only; **must not import the facade** | ~1 |

**Facade `apps/api/app/services/aa_reviews.py` (~35 lines):** keeps the current
module docstring and re-exports exactly the symbols callers use today:

```python
from app.services.reviews.contracts import (
    LIST_LIMIT_MAX, MANIFEST_VERSION, MAX_ALONGSIDE, MAX_WINDOW_DAYS,
    PROJECT_METRIC, ContextItem, ReviewContext,
)
from app.services.reviews.context import (
    build_context, resolve_review_subject, validate_window,
)
from app.services.reviews.errors import (
    EmptyRevisionError, IdempotencyKeyReusedError, InvalidFactorError,
    InvalidReviewError, InvalidReviewWindowError, ReviewContextChangedError,
    ReviewNotFoundError, UnsupportedReviewSubjectError,
)
from app.services.reviews.persistence import revise_review, save_review
from app.services.reviews.read_model import context_payload, list_reviews, read_review
from app.services.reviews.redaction import redact_review_context

__all__ = [ ... ]
```

- **Imports that change:** **none.** `routes/aa_reviews.py` (8 symbols),
  `services/aa_deletion.py` (`redact_review_context`) and
  `tests/test_aa_review_redaction.py` all keep their current import lines.
- **Internal dependency direction (must be enforced, no cycles):**

```
errors.py     → (nothing internal)
contracts.py  → errors
values.py     → contracts
context.py    → contracts, values, errors
persistence.py→ contracts, values, errors, context
redaction.py  → contracts, errors
read_model.py → contracts, values, errors
```

  **No module in `services/reviews/` may import `app.services.aa_reviews`.**

- **Tests affected:** none must change. Add nothing beyond commit 1.
- **Cycle risk:** low — all internal edges point downward. Verify with the
  backend AST script: expected result is still **0 true cycles, 4
  deferred-registry edges**.
- **Privacy constraint:** `aa_deletion.SOURCE_REDACTORS` must keep importing the
  **facade**, so the D1 registration stays one greppable line and
  `redact_review_context` remains server-side and transaction-aware.
- **Bundle effect:** n/a.
- **Risk to guard:** shared private helpers must be moved **once** into
  `values.py`/`contracts.py` and imported — **never duplicated** across modules.

**Rollback point:** this commit is self-contained; revert restores the single file.

---

### Commit 4 — `App.jsx` seams (PRIORITY 4, structural half)

**Source:** `apps/web/src/App.jsx` (614 LOC)

| Destination | Moved from | Exports |
|---|---|---|
| `apps/web/src/app/routeRegistry.js` | `App.jsx:53–63` + merges with existing `app/routes.js` | `LIFE_ROUTES`, `ANALYTICS_ROUTE_ENABLED`, `readRouteFromHash`, `normalizeRoute` |
| `apps/web/src/app/useTheme.js` | `App.jsx:83–203` | `useTheme` |
| `apps/web/src/app/useSidebarCollapsed.js` | `App.jsx:67–81` | `useSidebarCollapsed` |
| `apps/web/src/app/paradisePress.js` | `App.jsx:355–397` (delegated pointer-physics effect) | `useParadisePress` |
| `apps/web/src/app/clarifyHandlers.js` | `App.jsx:288–318` | `createClarifyHandlers({ data, t, showToast })` |

`App.jsx` keeps `AppShell`, `AuthGate`, `App` and `renderRoute` — the composition
point — and drops to roughly **300 LOC**.

- **Imports that change:** `App.jsx` only. `pages/ProjectsPage.jsx` imports
  `LIFE_ROUTES` from `app/routes.js`; keep `app/routes.js` as a re-export facade
  so that line is untouched, **or** leave `routes.js` as-is and have
  `routeRegistry.js` import from it. Prefer the latter — fewer moving parts.
- **Behaviour that must not change:** `LIFE_ROUTES.size === 19`; `#/medications/<id>`
  → `medications`; `#/review/...` → `review` only when the route is enabled;
  unknown hash → `home`; `localStorage` keys `lifeOsTheme`, `lifeOsScene`,
  `lifeOsSidebar`; `data-route` / `data-theme` attributes on `<html>`.
- **Explicitly NOT done here:** moving theme state out of `LifeLocaleContext`.
  That is a behavioural API change for 50 consumers. Record as backlog.
- **Tests affected:** `smoke.test.jsx` must still pass unchanged; commit 1's
  `route-registry.test.ts` now targets the extracted module directly.
- **Cycle risk:** low — `app/*` modules import nothing from `pages/` or `components/`.
- **Bundle effect:** negligible on its own (this is the structural half).

---

### Commit 5 — `LifeDataContext` pure state block (PRIORITY 5, partial)

**Source:** `apps/web/src/context/LifeDataContext.jsx:53–302`

| Destination | Content |
|---|---|
| `apps/web/src/context/lifeData/initialState.js` | `buildDefaultHabits`, `buildInitialState`, `isoDaysAgo`, `buildDefaultGoals`, `seedTransactions`, `defaultScheduleTimes` |
| `apps/web/src/context/lifeData/migrate.js` | `isPlainObject`, `migrateStateCopy`, `buildLegacyPreview` |

`LifeDataContext.jsx` keeps the provider and all domain actions, re-exports
`buildInitialState` and `migrateStateCopy` from the same path, and drops to
roughly **690 LOC**.

- **Imports that change:** none — `buildInitialState` / `migrateStateCopy` keep
  their current import path for all 18 importers and for `state-migration.test.ts`.
- **DEFERRED, with reason:** the 10 domain action groups (tasks, transactions,
  projects, goals/habits, quick notes, clarify, profile, dog, medications,
  maintenance). They close over `setStateRaw`/`mutate`, and projects/transactions
  additionally depend on the **"durable AA enqueue first, then snapshot mutate"**
  ordering. Converting them to factories is mechanical but puts ordering-sensitive
  AA semantics at risk for a purely structural gain. Revisit after Slice 5.
- **Hard rule:** one operational snapshot state, one provider. No second store.
- **Cycle risk:** none — both new modules are React-free and import only `data/` + `lib/`.

---

### Commit 6 — `api/analytics.ts` by domain (PRIORITY 6)

**Source:** `apps/web/src/api/analytics.ts` (584 LOC)

| Destination | Moved from lines | Domain |
|---|---|---|
| `api/analytics/facts.ts` | 1–189 | values, subjects, provenance, measurements, corrections, coverage |
| `api/analytics/finance.ts` | 190–250 | finance month, legacy import |
| `api/analytics/history.ts` | 251–284 | metric history, fact provenance |
| `api/analytics/semantic.ts` | 285–350 | expectation/forecast/baseline/target/preference/observation |
| `api/analytics/signals.ts` | 351–452 | Slice 3 signals |
| `api/analytics/reviews.ts` | 453–584 | Slice 4 Review / Debrief |
| `api/analytics.ts` | — | **facade**: `export * from './analytics/*.ts'` |

- **Imports that change:** none. The 2 importers (`analytics/review.ts`,
  `repositories/analyticsRepository.ts`) keep their current lines.
- **Cycle risk:** low. `facts.ts` holds the shared base types; the other five
  import **from `facts.ts` directly**, never from the facade.
- **Bundle effect:** **≈ 0** — most of the module is TypeScript types, erased at
  build time. Must be reported honestly as an ownership change only.
- **Tests affected:** none (0 test files import it directly).

---

### Commit 7 — `ReviewPage` + `SettingsPage` privacy sections (PRIORITIES 7–8)

**`apps/web/src/pages/analytics/ReviewPage.jsx` (494 LOC) →**

| Destination | Content |
|---|---|
| `pages/analytics/review/format.js` | `formatInstant`, `choiceLabel`, `flagText`, `cellNote`, `provenanceLabel`, `deltaProps`, `CONCEPT_OF_ROLE`, `CHOICE_KEYS` |
| `pages/analytics/review/Evidence.jsx` | `ReviewEvidence`, `alongsideFacts`, `Alongside`, `evidenceHistory` |
| `pages/analytics/review/Flow.jsx` | `ChoiceList`, `FactorEditor`, `STEP_COPY`, `ReviewFlow` |
| `pages/analytics/review/SavedReview.jsx` | `SavedReview` |
| `pages/analytics/ReviewPage.jsx` | `useNarrow`, `eyebrow`, `exitHash`, `readHash`, the route shell, **plus re-exports** of `flagText`, `deltaProps`, `ReviewEvidence`, `ReviewFlow`, `SavedReview` |

`analytics-review.test.jsx` already imports those five symbols from
`ReviewPage.jsx`; the re-export keeps that test untouched.

**`apps/web/src/components/SettingsPage.jsx` (432 LOC) →**

| Destination | Content |
|---|---|
| `components/settings/ExportSection.jsx` | `ExportSection` (account ZIP export) |
| `components/settings/DangerSection.jsx` | `DangerSection` (account deletion) |
| `components/SettingsPage.jsx` | everything else + **re-export** of `ExportSection` |

`settings-export.test.jsx` imports `ExportSection` from `SettingsPage.jsx`; the
re-export keeps it untouched.

**Explicitly not split:** `AccountSection` (17 LOC), `TelegramSection` (18),
`MonobankSection` (16), `NotificationsSection` (14), `CategoriesSection` (43),
`Row`, `Toggle`, `ThemeGlyph`. Splitting these is the fragmentation prompt §5 forbids.

---

### Commit 8 — `styles.css` cascade-safe split (PRIORITY 3)

**Source:** `apps/web/src/styles.css` (5231 lines). **The cascade is the product**,
so the split is by **contiguous line range only**, reproducing the original
concatenation order exactly. Boundaries are the `/* ====` opener lines verified
in Discovery §8.

| # | Destination `apps/web/src/styles/` | Lines | Content |
|---:|---|---|---|
| 1 | `tokens.css` | 1–360 | UI Kit header, density tokens, dark tokens, light-theme token overrides |
| 2 | `shell.css` | 361–618 | Layout, Sidebar, TopBar |
| 3 | `panels.css` | 619–1104 | Today hero, Panel card, Task list, Money widget, Goals, Habits, Toast, Milestone, money warnings, demo controls, category tints |
| 4 | `modals.css` | 1105–1457 | Quick-add modal, task title, Task detail modal, Settings page, Placeholder page |
| 5 | `pages-core.css` | 1458–1979 | Generic page chrome, Hero vignette, Quick Notes, Clarify panel |
| 6 | `pages-life.css` | 1980–2508 | Tasks toolbar, inline editable field, Profile, Dog, Health, Medications (read-only) |
| 7 | `home.css` | 2509–3084 | Home dashboard, charts row, trend/category, Upcoming, Telegram footer |
| 8 | `calendar-nav.css` | 3085–3182 | Calendar week view, mobile bottom nav |
| 9 | `responsive.css` | 3183–3254 | single column + bottom nav below 640px |
| 10 | `theme-light.css` | 3255–3563 | the second `[data-theme="light"]` override block |
| 11 | `medications.css` | 3564–4185 | Sprint 3A interactive, MedConfigDrawer, MedDetailPage/PharmNotes/GlobalJournal |
| 12 | `finance-calendar.css` | 4186–4602 | Sprint 3B flexible finance, calendar pills, DayDetailModal |
| 13 | `glass.css` | **4603–4633** | **cross-cutting glass card layer — MUST stay second-to-last** |
| 14 | `paradise.css` | **4634–5231** | **paradise theme — MUST stay last** |

`apps/web/src/styles.css` becomes the ordered manifest only:

```css
@import './styles/tokens.css';
@import './styles/shell.css';
/* … in exactly this order … */
@import './styles/glass.css';
@import './styles/paradise.css';
```

`main.jsx` keeps `import './styles.css'` unchanged.

**Order-significant pairs that this range split preserves by construction**
(verified in Discovery §8.2): `.money-log` 806 → 5010+; `.panel` 669 → 4610/4619;
`.today-hero` 622 → 4623; `[data-theme="light"] .sb` 388 → 3274;
`.meds-view-tab` / `.meds-filter-chip` 2002 → 3571/3575.

**HARD ACCEPTANCE GATE for this commit:** the emitted
`dist/assets/index-*.css` must be **byte-identical** to the baseline build
(compare `sha256`, ignoring the content-hash in the filename). If it is not
byte-identical, the split changed the cascade — revert and re-cut the boundaries.

- **Imports that change:** none.
- **Cycle risk:** n/a.
- **Bundle effect:** zero bytes by design; Vite inlines `@import` at build time.
- **Explicitly rejected:** CSS Modules; class renaming; reordering into
  component/page taxonomies; splitting `analytics.css` (193 lines, already scoped).

---

## 4. PART B — runtime bundle optimization

### Commit 9 — route-level lazy loading

**Baseline to beat:** entry JS **507.69 kB**, advisory **crossed by 7.69 kB**,
1 chunk, 0 dynamic imports.

**Mechanism:** `React.lazy` + `import()` + one `Suspense` boundary around
`renderRoute()` inside `AppShell`. **No new dependency** (React 18.3.1 ships both).

| Route surface | Measured attributed bytes | Action |
|---|---:|---|
| Medications (`MedicationsPage` + drawer + detail + card + dose modal + journal + pharm notes + `data/medications.js` + `lib/medMath.js`) | ≈ 43,800 | **lazy** |
| `pages/analytics/ReviewPage` | 15,663 | **lazy** |
| `components/SettingsPage` | 12,770 | **lazy** |
| `pages/finances/FinanceAnalytics` + `pages/analytics/MetricHistoryPage` | ≈ 8,000 | **lazy** |
| `pages/DogPage` | 6,533 | **lazy** |
| `pages/HomePage` | 3,976 | **eager** — default route; lazy would flicker on boot and break `smoke.test.jsx` |
| `pages/LoginPage` | 2,655 | **eager** — rendered by the auth gate |
| `components/ParadiseScene` | 2,337 | **eager** — too small; a fallback would flash on theme switch |
| Shell primitives (`Sidebar`, `TopBar`, `Toast`, `MobileBottomNav`, `SyncStatus`) | small | **eager** — prompt §12 forbids manufacturing chunks |

Projected removal from the entry chunk: **≈ 87 kB** against the 7.69 kB needed.
*This is a projection from source-map attribution and must be re-measured.*

**Suspense fallback:** one small product-appropriate element reusing existing
page chrome (e.g. `<div className="page" />` or the existing boot/sync idiom).
**Do not introduce a second loading design.** No spinner library, no skeleton system.

**Test consequences (verified empirically in Discovery §7):**
- `renderToStaticMarkup` renders the **fallback** for an unresolved lazy module
  and does **not** throw; it renders the real component once the module promise
  has settled.
- `smoke.test.jsx` is unaffected (asserts home only, which stays eager) and its
  `LIFE_ROUTES.size === 19` assertion stays true.
- **Add** `src/test/lazy-routes.test.jsx`: for each lazy route, `await` its
  `import()` and assert the resolved default export is the same component the
  eager version rendered — the "lazy route resolves to same page" characterization
  prompt §13 requires.

**Measurement to record:** entry JS, total emitted JS, per-chunk list, CSS,
advisory status — before and after.

**Do NOT:** add a router dependency; add a bundle analyzer; set
`build.chunkSizeWarningLimit` to silence the advisory; lazy-load to hit a number
rather than to defer real work.

---

## 5. Commit 10 — persistent module-boundary map

**Path decision.** The repository has no `docs/` directory. It has an established
authored-artifact root `Outputs/` (77 tracked files) which **already contains an
empty `Outputs/architecture/` directory** — an established, untracked placeholder
for exactly this. Using it respects the existing convention rather than inventing
a parallel one.

**Create:** `Outputs/architecture/module-boundaries.md`

It answers *"I want to change X — where do I go?"* and covers: backend domain
boundaries; the Review package and its facade; frontend state boundaries; API
modules; routing and the route registry; locale files; style layers and the
cascade rule; the analytics durable queue (**do not reorganise**); tests and
helpers; and the rule that high-fan-in modules are reached through their facade,
never through internal modules.

**Pointer only** (do not duplicate the document): add ~2 lines to `AGENTS.md`
under "Repository roles" naming the map. `AGENTS.md` is the canonical policy file,
so the pointer belongs there, not in `CLAUDE.md`.

---

## 6. Acceptance scenarios — BEFORE → AFTER file-touch map

To be reproduced with real paths in the implementation report.

| Scenario | BEFORE | AFTER |
|---|---|---|
| **A. Add one locale string** | `context/LocaleContext.jsx` — 2 hunks ~865 lines apart in a **112 KB** file | `context/locale/ru.js` + `context/locale/uk.js` — one hunk each in ~50 KB files; provider untouched |
| **B. Change Review hard-redaction** | `services/aa_reviews.py:1067–1109` inside a **1403-LOC** file also holding context derivation, save/revise and the read model | `services/reviews/redaction.py` (~50 LOC) + `test_aa_review_redaction.py` |
| **C. Add a Review context role** | 3 distant regions of `aa_reviews.py` + enums + schemas + `api/analytics.ts` + `ReviewPage.jsx` + `LocaleContext.jsx` | `services/reviews/context.py` + `read_model.py` + `contracts.py` + `api/analytics/reviews.ts` + `pages/analytics/review/Evidence.jsx` + `context/locale/*.js` — **save and redaction implementations no longer in the edit path** |
| **D. Add an analytics API domain** | one 584-LOC all-domain module | a new `api/analytics/<domain>.ts` + one facade line |
| **E. Add a route** | `app/routes.js` + `App.jsx` import block + `App.jsx` switch + `Sidebar` + `MobileBottomNav` + locale | `app/routeRegistry.js` + one `renderRoute` case + `Sidebar` + `MobileBottomNav` + locale — route parsing no longer duplicated in `App.jsx` |
| **F. Add a component style** | search **5231 lines / 194 KB** | the owning layer file (~300–620 lines each) |
| **G. Add a snapshot domain action** | `LifeDataContext.jsx` (938 LOC) | `LifeDataContext.jsx` (~690 LOC); seeds/migration no longer in the way. *Domain-action modules deferred — state this honestly.* |

**Claim to make:** materially smaller conflict surface and change blast radius.
**Claim never to make:** "zero merge conflicts".

---

## 7. Behaviour that must not change

API URLs · request/response semantics · DB schema · migration head
(`20260928_0006`) · snapshot version 2 · server schema_version 2 · business rules ·
the four signal rules · Review semantics · redaction semantics · durable queue
semantics · route hashes · locale copy · theme behaviour · accessibility
semantics · responsive behaviour.

If moving code exposes an existing bug: document it, add a failing
characterization if appropriate, and fix it **in this PR only** if it is a small
correctness bug whose fix is necessary for safe modularization. Otherwise
backlog it. **No product change may be smuggled into this PR.**

---

## 8. Validation

Per commit: the smallest relevant tests + typecheck/import check + diff inspection.
Never stack broken refactors.

Full gate before PR:

```
apps/api:   python -m pytest            (expect 380 + the commit-1 additions)
apps/api:   ruff check .
apps/api:   python -m compileall app
apps/api:   alembic heads               (expect 20260928_0006, ONE head)
apps/api:   alembic current             (lifeos_test ONLY)
apps/web:   npm test                    (expect 242 + the commit-1/9 additions)
apps/web:   npm run typecheck
apps/web:   npm run lint
apps/web:   npm run build -- --manifest
repo root:  git diff --check
```

Structural re-checks: re-run both import-graph scripts; **0 new cycles**;
re-run the inventory and compare hotspot metrics; re-run the CSS
byte-identity check.

Visual/browser QA at **390 / 768 / 1440 px** — required because routing, lazy
loading and CSS all change. Cover Home, Tasks, Projects, Finances, Analytics,
Review, Medications, Settings; dark/light/paradise; route refresh and deep-link
(`#/medications/<id>`, `#/review/<id>`); modals and overlays; no horizontal
overflow; Suspense behaviour shows no flicker regression.

---

## 9. Plan gate

```
PLAN_STATUS=COMPLETE
IMPLEMENTATION_READY=NO
OWNER_DECISIONS_OPEN=0
CURRENT_MAIN=ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef
AUDITED_PRODUCT_HEAD=e243da757dbbd81904c83a167154f51cf284de27
ACTIVE_PRODUCT_PR_BLOCKS_IMPLEMENTATION=YES
EXPECTED_DB_MIGRATION=NO
EXPECTED_SNAPSHOT_VERSION=2
EXPECTED_SERVER_SCHEMA_VERSION=2
```

`IMPLEMENTATION_READY=NO` for exactly one reason: **PR #12 is still open**, so
`main` does not yet contain the code this plan modularizes. No owner decision is
outstanding. Once PR #12 merges and the §0 preconditions re-verify, this plan
becomes executable as written.

---

## 10. POST-MERGE RECONCILIATION (appended 2026-09-28, after PR #12 merged)

Sections 0–9 above are preserved unchanged as the original planning evidence.
This section records the §0 gate as re-verified on merged `main`.

| §0 check | Result |
|---|---|
| 1. `HEAD == origin/main`, two-parent merge commit | `c44adb6b6de744574cc6e84bf4e15d7784a83dcb` — parents `ea3a75e` + `e243da7` ✅ |
| 2. porcelain clean (tracked) | ✅ (only these three artifacts untracked, by design) |
| 3. one worktree | ✅ |
| 4. PR #12 `MERGED`; no overlapping product PR open | ✅ — `gh pr list --state open` is empty; no Slice 5 work landed |
| 5. recovery stash `51184836…` | present ✅ |
| 6. tag `adaptive-analytics-design-accepted` → `6c507b82…` | unchanged ✅ |
| 7. baseline re-run | see below — **identical to the audited head** |
| 8. import graphs | 0 true cycles frontend and backend ✅ |

**Tree identity.** `git diff e243da7 c44adb6` is **empty**: the merged tree is
byte-identical to the audited Slice 4 candidate, so every path, line range and
metric in §§2–6 remains valid. No step needs re-cutting.

Measured on `c44adb6`:

```
backend  python -m pytest      380 passed, 13 warnings
         ruff check .          All checks passed!
         compileall app        OK
         alembic heads         20260928_0006 (head)   — single head
         alembic current       20260928_0006 (head)   — lifeos_test
frontend npm test              242 passed / 25 files
         typecheck / lint      PASS / PASS
         build -- --manifest   index.css 147.36 kB · index.js 507.69 kB (gzip 147.19 kB)
         Vite 500 kB advisory  YES (crossed by 7.69 kB); 1 JS chunk; 0 dynamic imports
import graph (frontend)        105 modules · 279 static edges · 0 cycles · 0 dynamic imports
import graph (backend)         88 modules · 0 true import-time cycles ·
                               4 deferred registry edges (rules/__init__) +
                               1 function-local import (rules.coverage_partial → aa_coverage_claims)
hotspots                       styles.css 5231/194578 · LocaleContext.jsx 1837/112507 ·
                               aa_reviews.py 1403/49302 · LifeDataContext.jsx 938/43208 ·
                               App.jsx 614/25603 · api/analytics.ts 584/21333 ·
                               ReviewPage.jsx 494/23682 · SettingsPage.jsx 432/17962
```

The backend edge count (330 vs 335 in Discovery §4.1) differs only because the
reconciliation script counts runtime top-level edges and lists function-local
imports separately; the cycle result is the same.

### Updated gate

```
PLAN_STATUS=COMPLETE
IMPLEMENTATION_READY=YES
OWNER_DECISIONS_OPEN=0
CURRENT_MAIN=c44adb6b6de744574cc6e84bf4e15d7784a83dcb
AUDITED_PRODUCT_HEAD=e243da757dbbd81904c83a167154f51cf284de27 (tree-identical to CURRENT_MAIN)
ACTIVE_PRODUCT_PR_BLOCKS_IMPLEMENTATION=NO
EXPECTED_DB_MIGRATION=NO
EXPECTED_SNAPSHOT_VERSION=2
EXPECTED_SERVER_SCHEMA_VERSION=2
```
