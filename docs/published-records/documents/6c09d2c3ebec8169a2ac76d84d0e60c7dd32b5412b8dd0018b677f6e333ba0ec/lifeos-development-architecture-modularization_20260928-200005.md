# LifeOS — Development Architecture Modularization · IMPLEMENTATION REPORT

- Created: 2026-09-28 20:00:05 EEST
- Branch: `refactor/development-architecture-modularization`
- Merged Slice 4 baseline: `c44adb6b6de744574cc6e84bf4e15d7784a83dcb` (merge of PR #12; parents `ea3a75e` + `e243da7`)
- Discovery: `Outputs/Discoveries/lifeos-architecture-modularization-targeted-discovery_20260928-181320.md`
- Audit: `Outputs/Audits/lifeos-development-architecture-modularity-audit_20260928-181320.md`
- Plan: `Outputs/Plans/lifeos-development-architecture-modularization-plan_20260928-181320.md` (§10 = post-merge reconciliation)
- Boundary map (new, persistent): `Outputs/architecture/module-boundaries.md`

A structural refactor plus one measured runtime change. **No product behaviour
changed**: no API URL, DB schema, migration, snapshot/server schema version,
signal rule, Review/redaction semantics, durable-queue semantics, route hash,
locale copy or theme behaviour.

---

## 1. Post-merge reconciliation

`git diff e243da7 c44adb6` is **empty** — merged main is tree-identical to the
audited Slice 4 candidate, so the Plan executed as written without re-cutting.
No overlapping PR was open; no Slice 5 work had landed. Baseline on `c44adb6`
matched the audit exactly: backend 380 passed, frontend 242 passed, Alembic
single head `20260928_0006`, entry JS 507.69 kB with the Vite 500 kB warning,
0 true import cycles. Details in Plan §10.

## 2. Commits

| # | SHA | Commit |
|---|---|---|
| 0 | `6afc9d0` | docs: add architecture hardening discovery audit and plan |
| 1 | `08ee4cc` | Add characterization tests for locale and Review contracts |
| 2 | `c04c9ca` | Split locale dictionaries behind the LocaleContext facade |
| 3 | `b160a4c` | Modularize the backend Review service behind the aa_reviews facade |
| 4 | `a431581` | Extract route registry, theme hook and shell effects from App.jsx |
| 5 | `f65ea84` | Extract the pure LifeDataContext initial-state and migration block |
| 6 | `6bda415` | Split api/analytics.ts by domain behind a facade |
| 7 | `0b6b259` | Split ReviewPage internals and the Settings privacy sections |
| 8 | `9fd427a` | Split styles.css into an ordered, cascade-preserving layer manifest |
| 9 | `ee7fc69` | Add measured route-level lazy loading |
| 10 | (this commit) | Module-boundary map, AGENTS.md pointer, this report |

Every commit was left green (targeted tests + typecheck/lint or ruff/compile,
import graph, diff inspection) before the next one started.

## 3. Modules created and facades

| Facade (unchanged import path) | Internals created |
|---|---|
| `apps/web/src/context/LocaleContext.jsx` | `context/locale/{ru.js, uk.js, makeT.js}` |
| `apps/api/app/services/aa_reviews.py` | `app/services/reviews/{errors, values, contracts, context, persistence, redaction, read_model}.py` |
| `apps/web/src/App.jsx` (composition point) | `app/{routeRegistry.js, useTheme.js, useSidebarCollapsed.js, paradisePress.js, clarifyHandlers.js, lazyRoutes.jsx}` |
| `apps/web/src/context/LifeDataContext.jsx` | `context/lifeData/{initialState.js, migrate.js}` |
| `apps/web/src/api/analytics.ts` | `api/analytics/{facts, finance, history, semantic, signals, reviews}.ts` |
| `apps/web/src/pages/analytics/ReviewPage.jsx` | `pages/analytics/review/{format.js, Evidence.jsx, Flow.jsx, SavedReview.jsx}` |
| `apps/web/src/components/SettingsPage.jsx` | `components/settings/{ExportSection.jsx, DangerSection.jsx, Row.jsx}` |
| `apps/web/src/styles.css` (ordered `@import` manifest) | `styles/` × 14 layers |

No caller import line changed except `App.jsx` (its own seams) and three test
source-pins (§8).

### Deviations from the Plan (each forced by a cycle or a correctness pin)

1. **Review `values.py` is the leaf, `contracts.py → values`** (Plan had the
   reverse). `ContextItem`'s fingerprint calls `_plain` and `_fact_value` reads
   `VALUE_COLUMNS`; the Plan's direction would be a `contracts ↔ values` cycle.
   `VALUE_COLUMNS` therefore lives in `values.py`.
2. **Semantic-fact vocabulary types live in `api/analytics/facts.ts`**
   (`SemanticConcept`, `DesiredDirection`, `EpistemicKind`, `AASemanticFact`),
   because history and finance types reference them — keeps the type graph
   acyclic with `facts.ts` as the only shared base.
3. **`eyebrow()` lives in `review/format.js`**, not the page shell: both the
   flow and the saved view use it, so leaving it in the shell would create a
   page ↔ Flow cycle. `ChoiceList`/`FactorEditor` are exported from `Flow.jsx`
   for `SavedReview.jsx`.
4. **Settings `Row` moved to `components/settings/Row.jsx`**: both extracted
   sections render it; importing it back from `SettingsPage.jsx` would be a cycle.
5. **Route-hash characterization landed with commit 4, not commit 1**:
   `readRouteFromHash` was not exported, so pinning it in a tests-only commit
   would have required a production change. It was moved verbatim and pinned
   in the same commit (`route-registry.test.ts`). `readRouteFromHash` now takes
   the hash as a parameter defaulting to `window.location.hash`, and setRoute's
   rule is a pure `normalizeRoute(next)`.
6. **Locale parity is not exact**, so the new shape test pins reality instead of
   the Plan's "key sets exactly equal": uk ⊂ ru, with one ru-only key,
   `today_date_uppercase` (boolean). It doubles as the ru-fallback case.
7. **CSS layers have trailing blank separator lines trimmed** (18 bytes of
   whitespace in total) to satisfy `git diff --check`. The byte-identity gate is
   on the **emitted** CSS, which is unchanged (§6).

## 4. Hotspot metrics — BEFORE → AFTER

| File | LOC / bytes before | LOC / bytes after |
|---|---:|---:|
| `apps/web/src/styles.css` | 5231 / 194,578 | 21 / 900 (manifest) |
| `apps/web/src/context/LocaleContext.jsx` | 1837 / 112,507 | 25 / 936 |
| `apps/api/app/services/aa_reviews.py` | 1403 / 49,302 | 77 / 2,899 (facade) |
| `apps/web/src/context/LifeDataContext.jsx` | 938 / 43,208 | 684 / 29,640 |
| `apps/web/src/App.jsx` | 614 / 25,603 | 387 / 15,437 |
| `apps/web/src/api/analytics.ts` | 584 / 21,333 | 9 / 365 (facade) |
| `apps/web/src/pages/analytics/ReviewPage.jsx` | 494 / 23,682 | 111 / 4,926 |
| `apps/web/src/components/SettingsPage.jsx` | 432 / 17,962 | 287 / 11,904 |
| `apps/api/app/services/aa_signals.py` | 665 / 23,710 | 665 / 23,710 (deliberately untouched) |

Largest new modules: `locale/ru.js` 930, `locale/uk.js` 864 (pure data),
`styles/medications.css` 619, `styles/paradise.css` 598, `reviews/context.py` 516.

| Threshold | Before | After |
|---|---:|---:|
| production modules > 800 LOC | 4 | 2 (`ru.js`, `uk.js` — dictionary data only) |
| production modules > 1200 LOC | 3 | 0 |
| `App.jsx` static route-surface imports | 16 | 10 (6 lazy) |

Review service: 1403 LOC → 7 internal modules (errors 50, values 96,
contracts 158, context 516, persistence 300, redaction 65, read_model 319) +
77-LOC facade. All 55 moved top-level definitions are AST-identical to the
original; none duplicated.

Locale: 112,507 B in one file → ru 56,481 B + uk 54,498 B + makeT 1,352 B +
936 B facade. Dictionaries deep-equal (including key order); `t()`/`t.pl()`
output identical for every key × locale × plural count against the old module.

## 5. Import graphs

| | Before | After |
|---|---|---|
| Frontend modules / static edges | 105 / 279 | 129 / 329 |
| Frontend true cycles | 0 | **0** |
| Frontend dynamic imports | 0 | 6 (the lazy routes) |
| `App.jsx` fan-out | 31 | 30 |
| Backend modules | 88 | 96 |
| Backend true import-time cycles | 0 | **0** |
| Backend deferred edges | 4 registry + 1 function-local | unchanged |

No module in `services/reviews/` imports `app.services.aa_reviews`;
`aa_deletion.SOURCE_REDACTORS` still registers `redact_review_context` through
the facade (pinned by `test_aa_review_contracts.py`).

## 6. Bundle and CSS

Default production build (`npm run build -- --manifest`):

| | Before (`c44adb6`) | After |
|---|---:|---:|
| Entry JS (`index-*.js`) | 507.69 kB | **319.85 kB** |
| JS on boot (entry + static imports, modulepreloaded) | 507.69 kB | **416.29 kB** (entry + shared `LocaleContext` chunk 96.44 kB) |
| Total JS emitted | 507.69 kB | 513.05 kB (+5.4 kB chunk overhead) |
| JS chunks | 1 | 11 |
| Vite 500 kB warning | **YES** | **NO** |
| CSS | 147.36 kB | 147.36 kB, **byte-identical** (sha256 `d024574c…`) |

Emitted route chunks: `MedicationsPage` 40.52 kB, `ReviewPage` 17.76 kB,
`SettingsPage` 13.64 kB, `DogPage` 6.73 kB, `FinanceAnalytics` 6.58 kB,
`MetricHistoryPage` 1.09 kB; shared `AAQualityStrip` 5.80, `AAFacts` 3.47,
`AAChart` 1.13 kB. The bundler (Rolldown-Vite) places modules shared between
the entry and lazy chunks — chiefly the locale dictionaries — in a separate
`LocaleContext` chunk that `index.html` modulepreloads, so it downloads in
parallel with the entry (no waterfall). With `VITE_LIFEOS_ANALYTICS_ENABLED=true`
the entry is 519.13 kB before → 331.27 kB after.

Honest attribution: the locale split (commit 2) and the API split (commit 6)
have **no bundle effect** (the API split's emitted JS was byte-identical). The
whole bundle change comes from commit 9.

CSS gate (commit 8): layers concatenate back to the original stylesheet
(modulo trimmed trailing blank lines) and the emitted `index-*.css` is
byte-identical before and after the split, and still after commit 9.

## 7. Validation (final, on the branch head)

```
apps/api   python -m pytest          see §7a
apps/api   ruff check .              All checks passed!
apps/api   python -m compileall app  OK
apps/api   alembic heads             20260928_0006 (head) — single head
apps/api   alembic current           20260928_0006 (head) — lifeos_test
apps/web   npm test                  283 passed / 29 files   (242 before)
apps/web   npm run typecheck         PASS
apps/web   npm run lint              PASS
apps/web   npm run build             PASS
apps/web   npm run build -- --manifest  PASS (no 500 kB warning)
repo       git diff --check          PASS
```

§7a Backend: **391 passed** (380 before + 11 new in
`test_aa_review_contracts.py`). Database tests used `lifeos_test` only.

New tests: `locale-shape.test.ts` (8), `route-registry.test.ts` (23),
`lazy-routes.test.jsx` (8), `styles-manifest.test.js` (2), backend
`test_aa_review_contracts.py` (11).

## 8. Tests changed (none weakened)

- `clarify-ui.test.jsx`: the Delete-guard source pin reads
  `app/clarifyHandlers.js` with the **identical** regex, plus a new pin that
  `App.jsx` wires `createClarifyHandlers({ data, t, showToast })`.
- `analytics-review.test.jsx`: the "computes no score and recommends nothing"
  guard now scans the page shell **and** every file in
  `pages/analytics/review/` (5 files) — wider than before.
- `hero-vignette.test.jsx`: the production-CSS pin resolves the `@import`
  manifest into the same ordered stylesheet and asserts the same strings.

## 9. Visual / browser QA

The Claude-in-Chrome extension was not connected, so QA was driven through
the locally installed Google Chrome in headless mode over the DevTools
protocol (Node 22 built-in WebSocket; **no dependency added**). Both builds
were production builds served by `vite preview` against a local API on
`lifeos_test` (analytics routes enabled), logged in as a throwaway test user:

- **BASE** = `c44adb6` (pre-refactor main), **AFTER** = this branch.
- Clock fixed (2026-09-28 12:00 Kyiv), `Math.random` seeded, animations and
  transitions disabled, paradise scene forced to `day` — identical for both.
- Matrix: 390 / 768 / 1440 px × dark / light / paradise × 13 routes (Home,
  Tasks, Projects, Finances, Analytics, Analytics history, Review deep link
  `#/review/new/finance%3Aperiod%3A2026-09/2026-09-01/2026-09-30`,
  Medications, Medications deep link `#/medications/sertraline`, Settings,
  Notes, Calendar, Dog) + Quick-Add modal (⌘K) on Tasks at every width/theme +
  client-side hash navigation from Home into each of the 6 lazy routes.
  **Every screen is a fresh page load (refresh / deep-link semantics).**
- 264 screens (132 BASE/AFTER pairs), compared by `#root` DOM hash and by
  per-pixel diff.

| Check | Result |
|---|---|
| Console errors / uncaught exceptions | **0** in both builds |
| Resolved `data-route` BASE vs AFTER | identical for all 132 pairs, deep links included |
| `#root` DOM identical | **122 / 132**; the 10 differences are all the Review route and differ only in a server-computed `recorded_at` timestamp of a derived fact (changes per request) |
| Pixel-identical | **123 / 132**; the 9 differences are 7 paradise screens (DOM-identical) + 2 client-nav screens with ≤ 15 px |
| Paradise pixel control | BASE vs **BASE** on the same 7 paradise screens also differs (up to 229,899 px) → paint nondeterminism of the paradise backdrop layers, not a regression |
| Quick-Add modal opens | 18 / 18 |
| Suspense | fallback observed only on the 6 lazy routes in AFTER (69 screens), never on eager routes, never left visible; every lazy screen resolved to the same DOM as BASE |
| Horizontal overflow | **identical in BASE and AFTER** (pre-existing, see §11) |

## 10. BEFORE → AFTER file-touch scenarios

| Scenario | BEFORE | AFTER |
|---|---|---|
| A. Add one locale string | `context/LocaleContext.jsx` — 2 hunks ~865 lines apart in a 112 KB file | `context/locale/ru.js` + `context/locale/uk.js` — one hunk each; provider untouched |
| B. Change Review hard-redaction | `services/aa_reviews.py:1067–1109` inside 1403 LOC with context derivation, save/revise and read model | `services/reviews/redaction.py` (65 LOC) + `tests/test_aa_review_redaction.py` |
| C. Add a Review context role | 3 regions of `aa_reviews.py` + enums + schemas + `api/analytics.ts` + `ReviewPage.jsx` + `LocaleContext.jsx` | `reviews/context.py` + `reviews/read_model.py` (+ `contracts.py` if a constant) + `api/analytics/reviews.ts` + `review/Evidence.jsx` or `review/format.js` + `locale/*.js`; save and redaction no longer in the edit path |
| D. Add an analytics API domain | one 584-LOC all-domain module | new `api/analytics/<domain>.ts` + one facade line |
| E. Add a route | `app/routes.js` + `App.jsx` import block + switch + `Sidebar` + `MobileBottomNav` + locale | `app/routes.js` + one `renderRoute` case (+ one `lazyRoutes.jsx` loader if not on the boot path) + `Sidebar` + `MobileBottomNav` + locale; hash parsing isolated in `app/routeRegistry.js` |
| F. Add a component style | search 5231 lines / 194 KB | the owning layer in `src/styles/` (72–622 lines) |
| G. Add a snapshot domain action | `LifeDataContext.jsx` (938 LOC) | `LifeDataContext.jsx` (684 LOC); seeds/migration moved out. Domain-action modules deferred (see §11) |

Claim: a materially smaller conflict surface and change blast radius.
Not claimed: "zero merge conflicts".

## 11. Deferred items and known risks

Deferred (recorded, not done):
- `LifeDataContext` domain action groups — closures over `setStateRaw`/`mutate`;
  projects/transactions depend on "durable AA enqueue first, then snapshot"
  ordering. Revisit after Slice 5.
- Theme values published through `LifeLocaleContext` — changing that is a
  behavioural API change for 50 consumers.
- `aa_signals.py` split — cohesive; revisit if Slice 6 adds a subject kind.
- The Slice 3 `project.forecast.revision` defect found earlier — not touched
  (not authorized here).
- **Pre-existing horizontal overflow found by QA, identical before and after:**
  `#/medications/<id>` at 768 px overflows by 166 px (all themes), and every
  paradise route at 768 px overflows by 16 px. Backlog candidates; not changed.

Known risks:
- A layer file edited out of order would silently change the cascade.
  Mitigation: `styles-manifest.test.js` pins order; the map documents "never
  reorder"; any future CSS move should repeat the emitted-CSS byte check.
- A first visit to a lazy route shows empty page chrome until its chunk
  arrives. Local measurement shows no visible flash, but on a slow network it
  will be a brief blank page body (shell stays).
- The shared `LocaleContext` chunk is a bundler decision (Rolldown) rather than
  an explicit one; it is modulepreloaded, so it adds no waterfall.
- `LifeDataContext.jsx` fan-in grew 18 → 20 only because split Review/Settings
  modules now import it directly (same consumers, more files).

## 12. Gate

```
ARCH_HARDENING_STATUS=PASS (pending PR/merge)
DB_MIGRATION_CREATED=NO
SNAPSHOT_VERSION=2
SERVER_SCHEMA_VERSION=2
DEPENDENCIES_ADDED=none
IMPORT_CYCLES_BEFORE=0
IMPORT_CYCLES_AFTER=0
```
