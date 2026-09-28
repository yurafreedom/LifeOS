# LifeOS — Development Architecture / Modularity AUDIT

- Created: 2026-09-28 18:13:20 EEST
- Discovery artifact: `Outputs/Discoveries/lifeos-architecture-modularization-targeted-discovery_20260928-181320.md`
- Audited product head: `e243da757dbbd81904c83a167154f51cf284de27` (Slice 4 candidate, PR #12 OPEN)
- `origin/main` at audit time: `ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef`

This audit is a **risk map**, not a list of big files. Ranking is by change blast
radius and conflict surface, with size used only as corroboration.

---

## 0. Method and the weight given to each signal

| Signal | Weight | Why |
|---|---|---|
| Responsibility count (independent reasons to change) | **high** | directly predicts blast radius |
| Fan-in | **high** | decides whether a facade is mandatory |
| Measured bundle attribution | **high** | objective, from the emitted source map |
| Selector-order analysis (CSS) | **high** | objective, decides feasibility |
| Size (LOC/bytes) | medium | corroborating only — a smell, never a reason |
| Git churn / co-change | **low** | 40 commits total, one commit per slice; Jaccard is degenerate here (Discovery §6). Used only where a per-commit line-delta made the signal unambiguous. |

---

## 1. Candidate matrix

### 1.1 `apps/web/src/context/LocaleContext.jsx` — **PRIORITY 1**

| Field | Value |
|---|---|
| Size / LOC | 112,507 bytes / 1837 LOC |
| Responsibilities | 2: (a) RU+UK translation **data** (1791 lines, 97%); (b) locale factory + React context (37 lines) |
| Fan-in | **50** — the highest in the frontend |
| Fan-out | 1 (`react`) |
| Churn | edited in 5 of 25 AA-era commits; **+10, +60, +97, +80, +266** lines, all additions |
| Co-change | with `App.jsx` (J=0.50), `AnalyticsContext.jsx` (J=0.43) — weak signal, ignored |
| Bundle impact | 63,673 B = **13.44% of the JS chunk**, the largest application module |
| State / side effects | none beyond `React.createContext` |
| Test coupling | 8 frontend test files; parity/shape assertions in `clarify-ui`, `analytics-signals`, `analytics-review` |
| **Change blast radius** | adding one string opens a 112 KB file and edits two hunks ~865 lines apart |
| Extraction opportunity | `context/locale/ru.js`, `context/locale/uk.js`, `context/locale/makeT.js`; `LocaleContext.jsx` becomes a ~45-line facade |
| Extraction risk | **low**. Pure data move. Risks are mechanical only: object-literal integrity, trailing commas, and the `_intl_locale` key that 12 production modules read. |
| Bundle effect | **none, by design** — the facade statically imports both dictionaries because current behaviour requires both synchronously. Must not be claimed as a bundle win. |
| **Recommended action** | **FACADE + SPLIT** |
| Priority | **1 — highest value-to-risk ratio in the repository** |

Justification: this is the only file in LifeOS that *every* product slice is
guaranteed to edit, in the same two places, forever. It is also 97% data behind a
37-line API, so the boundary is unusually crisp.

---

### 1.2 `apps/api/app/services/aa_reviews.py` — **PRIORITY 2**

| Field | Value |
|---|---|
| Size / LOC | 49,302 bytes / 1403 LOC; 35 functions, 10 classes |
| Responsibilities | **6–7 independent axes**: errors/contracts · context DTOs · value+provenance helpers · context derivation · persistence (save/revise) · **redaction/privacy (D1)** · read model + payload serialization |
| Fan-in | **3** (`routes/aa_reviews.py`, `services/aa_deletion.py`, `tests/test_aa_review_redaction.py`) |
| Fan-out | 10 internal modules |
| Churn | 1 commit (created in Slice 4) — no meaningful churn history yet |
| Bundle impact | n/a (backend) |
| State / side effects | SQLAlchemy session writes; `redact_review_context` runs **inside the hard-delete transaction** |
| Test coupling | `test_aa_reviews.py` (764), `test_aa_review_redaction.py` (280), `test_aa_review_correction_visibility.py` (144), helpers `aa_review_helpers.py` (235) |
| **Change blast radius** | adding one context role edits 3 distant regions of one 1403-LOC file; changing redaction means reviewing a file that also contains context derivation and the read model |
| Extraction opportunity | package `app/services/reviews/` — `errors.py`, `contracts.py` (DTOs+constants), `values.py` (shared helpers), `context.py`, `persistence.py`, `redaction.py`, `read_model.py`; keep `app/services/aa_reviews.py` as facade |
| Extraction risk | **low-to-moderate**. Mitigated by: only 3 importers; 7 of 8 error classes referenced nowhere else; routes catch the `AAServiceError` base rather than concrete types; the codebase already proves the lazy-registry facade pattern in `app/analytics/rules/__init__.py`. |
| **Recommended action** | **FACADE + SPLIT** |
| Priority | **2** |

Privacy note: `redact_review_context` is registered in
`aa_deletion.SOURCE_REDACTORS` and must remain server-side and transaction-aware.
Isolating it in its own module *improves* reviewability of the D1 guarantee —
which is the strongest single argument for this split.

---

### 1.3 `apps/web/src/styles.css` — **PRIORITY 3**

| Field | Value |
|---|---|
| Size / LOC | 194,578 bytes / 5231 LOC; 50 labelled sections |
| Responsibilities | tokens · density · light-theme overrides · layout/shell · ~35 component/page sections · responsive · two cross-cutting override layers |
| Fan-in | 1 (`main.jsx`) |
| Bundle impact | 147.36 kB emitted CSS (25.65 kB gzip) — unchanged by splitting |
| Measured order risk | 1427 rules / 1341 distinct selectors; **42** duplicated; **23** spread >300 lines, concentrated in the two trailing override layers (glass card system 4604–4634, paradise 4635–5231) plus 2 in-band exceptions |
| **Change blast radius** | adding one component style = searching 5231 lines; every styling change is a diff against the same file |
| Extraction opportunity | `styles/` layer directory with an explicit ordered `@import` manifest that **reproduces the original concatenation order exactly** |
| Extraction risk | **moderate** — the cascade is the product. Mitigated by a hard gate: the emitted `dist/assets/index-*.css` must be **byte-identical** before and after. |
| **Recommended action** | **CSS-SPLIT** (order-preserving only) |
| Priority | **3** |

Explicitly rejected: reordering into "all components then all pages then all
themes"; CSS Modules; any class renaming.

---

### 1.4 `apps/web/src/App.jsx` — **PRIORITY 4**

| Field | Value |
|---|---|
| Size / LOC | 25,603 bytes / 614 LOC |
| Responsibilities | **6**: hash route parsing · sidebar persistence · theme/scene controller (120 LOC) · app shell + global DOM effects (paradise pointer physics) · Clarify + quick-add + modal orchestration · route rendering (16-case switch) |
| Fan-in | 2 (`main.jsx`, `smoke.test.jsx`) |
| Fan-out | **31 — highest in the frontend**; 16 of those are route surfaces |
| Churn | 4 of 25 AA-era commits; every routed feature edits it |
| Bundle impact | 11,151 B itself; **gatekeeps ~96 kB of `src/pages/**`** by importing all 16 route surfaces statically |
| State / side effects | 4 global listener effects (`hashchange`, `keydown`/⌘K, delegated pointer physics, `matchMedia`); writes `localStorage` (`lifeOsTheme`, `lifeOsScene`, `lifeOsSidebar`); sets `data-route`/`data-theme` on `<html>` |
| Test coupling | `smoke.test.jsx` (pins `LIFE_ROUTES.size === 19` and home markup) |
| **Change blast radius** | adding a route edits the import block, the switch, and (elsewhere) `routes.js`, `Sidebar`, `MobileBottomNav`, `LocaleContext` |
| Extraction opportunity | `app/routeRegistry` (parse + registry, absorbing `readRouteFromHash`), `app/useTheme.js`, `app/useSidebarCollapsed.js`, `app/paradisePress.js`, `app/clarifyHandlers.js`; keep `AppShell` as the composition point |
| Extraction risk | **moderate** — `AppShell` is a single large closure; extracted hooks must receive dependencies explicitly. Theme values are currently published through `LifeLocaleContext`, a real coupling smell. |
| **Recommended action** | **SPLIT** (structural) + **LAZY-LOAD** (runtime, see §3) |
| Priority | **4** |

**Constraint:** do not "fix" the theme-through-locale-context coupling in this
PR. Changing which context publishes `themeMode`/`themeEff` is a behavioural API
change to 50 consumers and is out of scope for a structural refactor. Record it
as backlog.

---

### 1.5 `apps/web/src/context/LifeDataContext.jsx` — **PRIORITY 5 (partial)**

| Field | Value |
|---|---|
| Size / LOC | 43,208 bytes / 938 LOC |
| Responsibilities | pure defaults/seeds/migration (250 LOC, React-free) · sync wiring · 10 domain action groups · export/maintenance |
| Fan-in | **18** |
| Fan-out | 13 |
| Bundle impact | 20,237 B (4.27%) |
| State / side effects | **owns the single operational snapshot state**; `mutate` performs `setState` + `activityLog` append atomically |
| Test coupling | 7 frontend test files; `state-migration.test.ts` already tests `buildInitialState`/`migrateStateCopy` in isolation |
| **Change blast radius** | adding a domain action opens a 938-LOC provider |
| Extraction opportunity — **accepted** | lines 53–302: `buildDefaultHabits`, `buildInitialState`, `isoDaysAgo`, `buildDefaultGoals`, `seedTransactions`, `defaultScheduleTimes`, `isPlainObject`, `migrateStateCopy`, `buildLegacyPreview` → `context/lifeData/initialState.js` + `context/lifeData/migrate.js`. **Zero React, already publicly exported, already independently tested.** |
| Extraction opportunity — **deferred** | the 10 domain action groups. They are closures over `setStateRaw`/`mutate`, and several (projects, transactions) also depend on the analytics queue ordering ("durable enqueue first, then snapshot"). Converting them to factories is mechanical but touches ordering-sensitive AA semantics. |
| Extraction risk | low for the pure block; **moderate-to-high** for action groups |
| **Recommended action** | **SPLIT (pure block only)** · **DEFER (domain actions)** |
| Priority | **5** |

Hard rule carried from master context §7A and prompt §11.4: there must remain
**one** operational snapshot state and one provider. Do not create competing stores.

---

### 1.6 `apps/web/src/api/analytics.ts` — **PRIORITY 6**

| Field | Value |
|---|---|
| Size / LOC | 21,333 bytes / 584 LOC; ~70% TypeScript type declarations |
| Responsibilities | 6 API domains, already banner-separated: facts · finance+legacy import · metric history/provenance · semantic concepts · signals · reviews |
| Fan-in | **2** |
| Bundle impact | **≈ 0** — types are erased at build time |
| Test coupling | 0 test files import it directly |
| **Change blast radius** | a new AA domain edits one all-domain HTTP module |
| Extraction opportunity | `api/analytics/{facts,finance,history,semantic,signals,reviews}.ts` + `api/analytics.ts` facade re-exporting |
| Extraction risk | **very low** — 2 importers, no runtime behaviour in the type half |
| **Recommended action** | **FACADE + SPLIT** |
| Priority | **6** |

Must be reported honestly as an ownership/conflict change with **no bundle benefit**.

---

### 1.7 `apps/web/src/pages/analytics/ReviewPage.jsx` — **PRIORITY 7**

| Field | Value |
|---|---|
| Size / LOC | 23,682 bytes / 494 LOC |
| Responsibilities | formatters/labels · evidence table components · step-wizard flow · saved-review view · hash-driven route shell |
| Fan-in | 1 (`App.jsx`) |
| Fan-out | 11 |
| Bundle impact | 15,663 B — **2nd-largest lazy-load candidate** |
| Test coupling | `analytics-review.test.jsx` already imports `flagText`, `deltaProps`, `ReviewEvidence`, `ReviewFlow`, `SavedReview` directly — internal boundaries are already partly real |
| Extraction opportunity | `pages/analytics/review/{format,Evidence,Flow,SavedReview}.jsx` + route shell |
| Extraction risk | low — the seams already exist as exports |
| **Recommended action** | **SPLIT** + **LAZY-LOAD** |
| Priority | **7** |

---

### 1.8 `apps/web/src/components/SettingsPage.jsx` — **PRIORITY 8 (narrow)**

| Field | Value |
|---|---|
| Size / LOC | 17,962 bytes / 432 LOC |
| Responsibilities | already 8 internal section components + 3 shared primitives |
| Fan-in | 1 |
| Bundle impact | 12,770 B — **3rd-largest lazy-load candidate** |
| Test coupling | `settings-export.test.jsx` imports `ExportSection` |
| Extraction opportunity — accepted | `ExportSection` (51 LOC, account ZIP export) and `DangerSection` (86 LOC, account deletion) — real async/privacy logic, locally testable |
| Extraction opportunity — rejected | `AccountSection` (17), `TelegramSection` (18), `MonobankSection` (16), `NotificationsSection` (14), `CategoriesSection` (43) — small static forms. Splitting these is exactly the one-component-per-file fragmentation prompt §5 forbids. |
| Extraction risk | low |
| **Recommended action** | **SPLIT (privacy sections only)** + **LAZY-LOAD** |
| Priority | **8** |

---

### 1.9 `apps/api/app/services/aa_signals.py` — **DEFER**

| Field | Value |
|---|---|
| Size / LOC | 23,710 bytes / 665 LOC |
| Responsibilities | **3** groups: subject discovery (143 LOC) · evaluation+episode reconciliation+ranking (300 LOC) · acknowledgement (56 LOC) |
| Fan-in | 1 route + 6 test modules |
| **Change blast radius** | moderate — the file is cohesive: everything in it serves "evaluate the four-rule catalogue" |
| **Recommended action** | **DEFER** |
| Priority | — |

Rationale: 665 LOC with 3 coherent groups behind one purpose is not a
responsibility overload. The rule modules are *already* extracted into
`app/analytics/rules/` with a registry — the genuinely independent axis was
separated in Slice 3. Splitting further would produce modules that only ever
change together. Per prompt §5, a line count alone is not a reason.

Revisit if Slice 6 (Experiment) adds a different subject kind.

---

### 1.10 Other candidates assessed and rejected

| Path | LOC | Verdict | Reason |
|---|---:|---|---|
| `apps/web/src/pages/medications/MedConfigDrawer.jsx` | 435 | **KEEP** (but lazy-load with its route) | one cohesive drawer; 12,227 B — most valuable as part of the medications lazy chunk |
| `apps/api/app/services/aa_facts.py` | 390 | **KEEP** | fan-in 16 — the most-depended-on service; errors + append/correct/read for one concept. Splitting a 16-fan-in module is pure risk. |
| `apps/web/src/components/ClarifyPanel.jsx` | 374 | **KEEP** | one modal, one interaction contract |
| `apps/web/src/domain/clarify.ts` | 347 | **KEEP** | already a domain module, already extracted |
| `apps/web/src/data/medications.js` | 321 | **KEEP** | data table; lazy-loads with medications |
| `apps/api/app/services/aa_finance.py` | 313 | **KEEP** | cohesive derived-metric service |
| `apps/api/app/analytics/enums.py` | 285 | **KEEP** | 25 enum classes, fan-in 30 — a registry-like vocabulary. High fan-in + trivially cohesive. |
| `apps/api/app/models/aa_review.py` | 298 | **KEEP** | 6 related ORM models for one migration |

---

## 2. Dependency direction

### 2.1 Backend — current state is already correct

Measured, not assumed:

```
routes/ (aa_*, auth, state)
   ↓
services/ (aa_reviews, aa_signals, aa_facts, aa_finance, export, …)
   ↓
analytics/ (enums, values, subjects, asof, delta, coverage, rules/)
   ↓
models/ (+ db, config, security)
```

Verified: **no model imports a service**; **no analytics primitive imports a
route**; the only reverse edges are the four deliberate lazy registry imports in
`analytics/rules/__init__.py`.

Intended flow **after** the Review split (new constraint to enforce):

```
routes/aa_reviews.py
   ↓            (imports ONLY the facade)
services/aa_reviews.py              ← stable facade, re-export only
   ↓
services/reviews/read_model.py ─┐
services/reviews/persistence.py ─┼→ services/reviews/context.py
services/reviews/redaction.py  ─┘        ↓
                                  services/reviews/values.py
                                  services/reviews/contracts.py
                                  services/reviews/errors.py
```

Rules to enforce:
- `services/reviews/*` must not import `app.routes.*`.
- `services/aa_deletion.py` keeps importing the **facade**, not
  `services/reviews/redaction` directly, so the D1 registration point stays one
  greppable line.
- No module inside `services/reviews/` may import the facade (that would be a
  true cycle). Internal modules import each other directly, downward only.

### 2.2 Frontend — intended flow

```
main.jsx → App.jsx (shell + providers)
   ↓
app/ (route registry, theme hook, shell effects)
   ↓
pages/**            ← lazy boundaries live here
   ↓
components/** + domain hooks
   ↓
repositories/ + api/
   ↓
api/client.ts
```

Contexts coordinate state; they must not become service locators. Current
violation to record but **not** fix here: `LifeLocaleContext` also carries theme
state (§1.4).

### 2.3 Facade strategy

| Facade | Mandatory? | Why |
|---|---|---|
| `context/LocaleContext.jsx` | **yes** | 50 importers; 12 production modules read `LifeStrings[locale]._intl_locale` |
| `services/aa_reviews.py` | **yes** | keeps `SOURCE_REDACTORS` registration and route imports byte-identical |
| `api/analytics.ts` | **optional but cheap** | only 2 importers; facade costs ~10 lines and avoids touching them |
| `context/LifeDataContext.jsx` | **yes** | 18 importers; `buildInitialState`/`migrateStateCopy` stay exported from the same path |
| `styles.css` | **yes** | `main.jsx` keeps importing `./styles.css`; it becomes the ordered `@import` manifest |

**No barrel file may re-export a module that imports the barrel.** The Python
precedent in `analytics/rules/__init__.py` (lazy import inside a function) is the
sanctioned escape hatch if one is ever needed — but none of the splits above
needs it, because all internal dependencies point downward.

---

## 3. Bundle / runtime optimization assessment

Baseline (measured, `e243da7`): **entry JS 507.69 kB**, gzip 147.19 kB; CSS
147.36 kB; **advisory crossed by 7.69 kB**; 1 chunk; 0 dynamic imports.

| Candidate | Attributed bytes | Verdict | Reason |
|---|---:|---|---|
| Medications route | ≈ 43,800 | **LAZY-LOAD** | largest single win; a non-home surface reached deliberately |
| `ReviewPage` | 15,663 | **LAZY-LOAD** | analytics-gated route; not on the default path |
| `SettingsPage` | 12,770 | **LAZY-LOAD** | reached deliberately, never on boot |
| `FinanceAnalytics` + `MetricHistoryPage` | ≈ 8,000 | **LAZY-LOAD** | analytics-gated |
| `DogPage` | 6,533 | **LAZY-LOAD** (low priority) | secondary route |
| `HomePage` | 3,976 | **KEEP EAGER** | default route; lazy-loading it would add boot flicker and break `smoke.test.jsx` |
| `LoginPage` | 2,655 | **KEEP EAGER** | rendered by the auth gate before anything else |
| `ParadiseScene` | 2,337 | **KEEP EAGER** | too small to justify a chunk; mounts inside a theme switch where a fallback would flash |
| Shell primitives (`Sidebar`, `TopBar`, `Toast`, `MobileBottomNav`) | small | **KEEP EAGER** | prompt §12 explicitly forbids manufacturing chunks from always-used primitives |

**Feasibility is confirmed empirically, not assumed.** Because every UI test
renders through `renderToStaticMarkup` (`environment: 'node'`), `React.lazy` was
probed against the installed React 18.3.1: an unresolved lazy component renders
the **Suspense fallback** without throwing, and renders the real component once
the module promise has settled. See Discovery §7.

Consequences to carry into the Plan:
- Any test asserting a lazy route's markup must `await` that route's module first.
- `smoke.test.jsx` is unaffected (it asserts only home) but pins
  `LIFE_ROUTES.size === 19`, which the route registry must preserve.
- The Suspense fallback must be a single small product-appropriate element —
  **not** a second loading design.

Projected: deferring medications + settings + review alone removes ≈72 kB from
the entry chunk versus the 7.69 kB needed, so the advisory should clear with
margin. **This is a projection from source-map attribution, not a measurement;
the Plan requires it to be re-measured.**

---

## 4. Explicit "DO NOT SPLIT" list

Protection against over-modularization. These stay intact:

1. `apps/api/app/services/aa_facts.py` — fan-in 16; splitting the most-depended-on service is pure risk.
2. `apps/api/app/analytics/enums.py` — fan-in 30; a cohesive vocabulary, not logic.
3. `apps/api/app/analytics/rules/*` — **already** correctly modularized in Slice 3. Do not touch the registry.
4. `apps/api/app/services/aa_signals.py` — cohesive; DEFER (§1.9).
5. `apps/api/app/models/*` — one model module per migration concept; already right.
6. `apps/web/src/domain/clarify.ts`, `domain/projects.ts` — already extracted domain modules.
7. `apps/web/src/repositories/*` — `analyticsRepository`, `analyticsWriteQueue`, `analyticsSyncCoordinator`, `stateSyncCoordinator` are already separate and carry the durable-queue contract. **Do not reorganise queue code in a structural refactor.**
8. `apps/web/src/analytics.css` — 193 lines, already domain-scoped.
9. `apps/web/src/components/ClarifyPanel.jsx`, `QuickAddModal.jsx`, `TaskDetailModal.jsx` — one interaction contract each.
10. Small `SettingsPage` sections (`Account`, `Telegram`, `Monobank`, `Notifications`, `Categories`).
11. `apps/web/src/components/icons.jsx` — fan-in 24; a flat icon registry is the correct shape.
12. Backend test files — already use domain-scoped helpers; splitting them now is noise.

---

## 5. Metrics to carry into the Plan (BEFORE column, measured)

```
PRODUCTION_MODULES_GT_800_BEFORE=4
PRODUCTION_MODULES_GT_1200_BEFORE=3
IMPORT_CYCLES_BEFORE=0            (+4 deferred-registry edges, intentional)
AA_REVIEWS_LOC_BEFORE=1403
LOCALE_CONTEXT_BYTES_BEFORE=112507
LIFEDATA_CONTEXT_LOC_BEFORE=938
APP_LOC_BEFORE=614
ROOT_STATIC_ROUTE_IMPORTS_BEFORE=16
ROOT_STYLES_BYTES_BEFORE=194578
ANALYTICS_API_BYTES_BEFORE=21333
ENTRY_JS_KB_BEFORE=507.69
TOTAL_JS_KB_BEFORE=507.69
CSS_KB_BEFORE=147.36
VITE_500KB_WARNING_BEFORE=YES
BACKEND_TESTS_BEFORE=380
FRONTEND_TESTS_BEFORE=242
```

---

## 6. Audit gate

```
AUDIT_STATUS=PASS
OWNER_DECISION_REQUIRED=NO
IMPLEMENTATION_PLAN_ALLOWED=YES
ACTIVE_PRODUCT_PR_BLOCKS_IMPLEMENTATION=YES
EXPECTED_DB_MIGRATION=NO
EXPECTED_SNAPSHOT_VERSION=2
EXPECTED_SERVER_SCHEMA_VERSION=2
```

No product-semantic decision is required. Every accepted item is structural, and
every rejected item is rejected on measured evidence rather than taste.
