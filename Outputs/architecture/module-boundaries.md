# LifeOS — module boundaries

"I want to change X — where do I go?" A living map of where responsibilities
live and which import paths are stable. Created by the development-architecture
modularization (`Outputs/Implementations/lifeos-development-architecture-modularization_*.md`).
Keep it current when a boundary moves; do not duplicate it elsewhere.

**One rule above all:** high-fan-in modules are reached through their
**facade**. Callers import the facade path; only the facade and sibling
internal modules import the internals. Internal modules never import their
own facade (that is a true import cycle).

---

## Backend (`apps/api/app`)

Dependency direction (enforced by review, measured by the import graph):

```
routes/  →  services/  →  analytics/ (primitives, enums, rules/)  →  models/ (+ db, config, security)
```

No model imports a service; no analytics primitive imports a route. The only
reverse edges are the lazy imports inside `analytics/rules/__init__.py::_registry()`
(the sanctioned registry pattern).

| I want to change… | Go to |
|---|---|
| an HTTP endpoint / status code / request schema | `routes/aa_*.py` + `schemas/aa_*.py` (+ router registration in `main.py`) |
| a new AA fact table | model in `models/`, migration, **and** the export registry (`services/export.py`) and deletion coverage (`services/aa_deletion.py`) in the same change — this co-change is a safety property, not a smell |
| fact append/correct/read | `services/aa_facts.py` (fan-in 16 — do not split) |
| finance derivation | `services/aa_finance.py` |
| signals evaluation | `services/aa_signals.py`; one rule = one module in `analytics/rules/` |
| Project Analytics (forecast version history, Actual, dual delta; read-only) | `services/aa_project_analytics.py` + `routes/aa_projects.py` + `schemas/aa_projects.py` |
| Experiments (lifecycle, adherence, evidence, decision; Slice 6) | facade `services/aa_experiments.py` + `routes/aa_experiments.py` + `schemas/aa_experiments.py` |
| System Review, relations, importance, finance context, exports (Slice 7) | facade `services/aa_system_review.py` + `routes/aa_system_review.py` + `schemas/aa_system_review.py` |
| vocabulary / enums | `analytics/enums.py` (fan-in 30 — a flat vocabulary is the right shape) |

### Review / Debrief

Facade: **`app/services/aa_reviews.py`** — import only from here
(`routes/aa_reviews.py`, `services/aa_deletion.py`, tests).

| I want to change… | Go to `app/services/reviews/` |
|---|---|
| an error code or message (API contract) | `errors.py` (pinned by `tests/test_aa_review_contracts.py`) |
| constants, `SOURCE_MODELS`, `ERASED_ITEM_VALUES`, `ContextItem`, `ReviewContext` | `contracts.py` |
| value quantization / provenance helpers, `VALUE_COLUMNS` | `values.py` (leaf: imports nothing from the package) |
| how evidence is derived (subjects, windows, roles, deltas) | `context.py` |
| save / revise / idempotency | `persistence.py` |
| **D1 hard-erasure of frozen items** | `redaction.py` — registered in `aa_deletion.SOURCE_REDACTORS` **through the facade**; runs inside the hard-delete transaction |
| read-time correction flags, payloads, read/list | `read_model.py` |

Internal direction: `errors`, `values` → `contracts` → `context` → `persistence`;
`redaction` → `contracts`; `read_model` → `contracts`, `values`, `errors`.

### Experiments

Facade: **`app/services/aa_experiments.py`** — import only from here
(`routes/aa_experiments.py`, tests).

| I want to change… | Go to `app/services/experiments/` |
|---|---|
| an error code or message | `errors.py` (status map in `routes/aa_measurements.py::_ERROR_STATUS`) |
| legal edges, pending/evidence/decision lifecycles, limits, skew | `contracts.py` |
| the server clock, IANA local days, adherence classification | `days.py` (leaf; tests pin `server_now` here) |
| create / transition (replay, no-op, legality, CAS) | `lifecycle.py` |
| adherence, outcome/context observations, baseline, conditions | `evidence.py` |
| decision revisions and experiment-scoped factors | `decisions.py` |
| detail / list payloads (pure reads) | `read_model.py` |

Internal direction: `errors`, `days` → `contracts` → `lifecycle`/`evidence`/`decisions`
→ `read_model`. Decisions and factors share `aa_decisions` / `aa_review_factors`
with Review through a `scope` column; each scope keeps its own vocabulary.

### System Review (Slice 7)

Facade: **`app/services/aa_system_review.py`** — import only from here
(`routes/aa_system_review.py`, `services/aa_deletion.py`, tests). Its clock
(`server_now`) resolves `system_review/periods.server_now` at call time; tests pin that.

| I want to change… | Go to `app/services/system_review/` |
|---|---|
| an error code or message | `errors.py` (status map in `routes/aa_measurements.py::_ERROR_STATUS`) |
| ref-key grammar (`change|…`, `subject|…`, `fact|…`, `context|…`) | `refs.py` (leaf) · ownership: `resolve.py` |
| limits, causal denylist, typed-value helpers, advisory lock | `contracts.py` |
| periods, logical status, the clock | `periods.py` (leaf) |
| user links, answers, feedback log, filters, ranking input | `relations.py` |
| rule-based proposals (families, key, fingerprint, ranking) | `candidates.py` (read-only) |
| what changed / improved / quality | `changes.py` · recurrence over the four rules: `repeated.py` |
| projections (budget, repeat, debt, reserve, essentials, priorities) | `consequences.py` · self-check: `selfcheck.py` |
| explicit finance context (versions, deletion) | `contexts.py` |
| live review + waiting assembly (pure reads) | `read_model.py` |
| saved revisions (freeze, append, read) | `revisions.py` |
| **D1 redaction of revisions / relations / importance** | `redaction.py` — registered in `aa_deletion.SOURCE_REDACTORS` through the facade |
| PDF / DOCX / XLSX / MD | `exports/` (`document.py` model → `report.py` builder → one writer per format; `labels.py` = the only server copy; `fonts/` DejaVu + license) |

Internal direction: `errors`, `refs`, `periods` → `contracts` → `resolve` →
`importance`/`relations`/`contexts` → `changes` → `consequences` → `candidates`/`repeated`
→ `read_model` → `revisions`; `redaction` → models + `refs`; `exports` → models only.
A GET never writes (READ ONLY transaction in the route).

---

## Frontend (`apps/web/src`)

```
main.jsx → App.jsx (AppShell, AuthGate, App, renderRoute)
             ↓
           app/ (route registry, lazy routes, theme, shell effects, clarify handlers)
             ↓
           pages/**  ← lazy boundaries live here
             ↓
           components/** + domain hooks
             ↓
           repositories/ + api/  →  api/client.ts
```

Contexts coordinate state; they are not service locators. Known smell, kept
deliberately: theme values are published through `LifeLocaleContext`.

### Routing

| I want to… | Go to |
|---|---|
| add a route id | `app/routes.js` (`LIFE_ROUTES`; pinned size in `smoke.test.jsx`) |
| change hash parsing / sub-routes (`medications/<id>`, `review/…`, `project-analytics/<id>`, `experiment/{new,<uuid>}`, `calendar/…`, `system-review/…`) | `app/routeRegistry.js` (`readRouteFromHash`, `normalizeRoute`; pinned by `route-registry.test.ts`). The Calendar's own grammar (`calendar/{YYYY,YYYY-MM,YYYY-MM-DD,years[/YYYY],history}`) is `pages/calendar/calendarRoute.js` |
| render a route | one `case` in `App.jsx::renderRoute()` |
| make a route lazy / eager | `app/lazyRoutes.jsx` (`LAZY_ROUTE_LOADERS`; pinned by `lazy-routes.test.jsx`). Home, Login, ParadiseScene and shell chrome stay eager. One `Suspense` boundary around `renderRoute()`; its fallback is empty `.page` chrome — do not add a second loading design |
| nav entries | `components/Sidebar.jsx`, `components/MobileBottomNav.jsx` + locale copy |

Shell effects: `app/useTheme.js` (theme + paradise scene, `localStorage`
`lifeOsTheme`/`lifeOsScene`), `app/useSidebarCollapsed.js` (`lifeOsSidebar`),
`app/paradisePress.js` (delegated pointer physics), `app/clarifyHandlers.js`
(the six Clarify transitions + toasts).

### Locale

Facade: **`context/LocaleContext.jsx`** (50 importers) — exports
`LifeStrings`, `LifeLocales`, `LifeMakeT`, `LifeLocaleContext`.

| I want to… | Go to |
|---|---|
| add / change Russian copy | `context/locale/ru.js` |
| add / change Ukrainian copy | `context/locale/uk.js` (missing keys fall back to ru) |
| change `t()` / plural logic | `context/locale/makeT.js` |

Both dictionaries are loaded synchronously (12 modules read
`LifeStrings[locale]._intl_locale`). Shape pinned by `locale-shape.test.ts`.

### Operational state

**`context/LifeDataContext.jsx`** is the single operational snapshot provider
(18 importers). One state, one provider — never add a competing store.

| I want to… | Go to |
|---|---|
| change seeds / the initial snapshot | `context/lifeData/initialState.js` |
| change snapshot migration / validation | `context/lifeData/migrate.js` (snapshot `version` stays 2) |
| add a domain action | `LifeDataContext.jsx` provider body. Projects/transactions enqueue the durable AA write **before** mutating the snapshot — keep that order |
| task semantics (Calendar date = `schedule.date`, completion/closure/restore, move, per-day `order`, `created_at`, optional-field validators) | `domain/tasks.ts` (pure; the provider only wires actions). History is derived from `state.tasks`, never `activityLog` |
| Calendar date math (month lengths, weekdays, 30-year windows, bounds ≤ 2100, Kyiv today) | `domain/calendarModel.ts` |

`buildInitialState` / `migrateStateCopy` are re-exported from `LifeDataContext.jsx`.

### Analytics HTTP API

Facade: **`api/analytics.ts`** (`export *` of each domain).

| Domain | Module |
|---|---|
| shared vocabulary, measurements, coverage, semantic-fact types | `api/analytics/facts.ts` |
| finance month, legacy import | `api/analytics/finance.ts` |
| metric history, fact provenance | `api/analytics/history.ts` |
| expectation / forecast / baseline / target / preference / observation | `api/analytics/semantic.ts` |
| signals | `api/analytics/signals.ts` |
| Review / Debrief | `api/analytics/reviews.ts` |
| Project Analytics | `api/analytics/projects.ts` |
| Experiments (reads; writes are queue builders in `analytics/experimentFacts.ts`, queue reads in `analytics/experimentQueue.ts`) | `api/analytics/experiments.ts` |
| System Review (reads + export download; writes are queue builders in `analytics/systemReviewFacts.ts`, queue reads in `analytics/systemReviewQueue.ts`) | `api/analytics/systemReview.ts` |

A new domain = a new module + one facade line. Domain modules import shared
types from `facts.ts` only.

**Durable analytics queue — do not reorganise in structural work:**
`repositories/analyticsRepository.ts`, `analyticsWriteQueue.ts`,
`analyticsSyncCoordinator.ts`, `stateSyncCoordinator.ts`.

### Pages split into modules

| Page | Internals |
|---|---|
| `pages/analytics/ReviewPage.jsx` (route shell; re-exports the views) | `pages/analytics/review/{format.js, Evidence.jsx, Flow.jsx, SavedReview.jsx}` |
| `pages/projects/ProjectAnalyticsPage.jsx` (route shell; exports the pure `ProjectAnalyticsView`) | `pages/projects/analytics/{ForecastComparison.jsx, ForecastHistory.jsx}`; helpers in `analytics/projectAnalytics.ts` |
| `pages/analytics/ExperimentPage.jsx` (route shell; re-exports `ExperimentDetailView`, `ExperimentListView`) | `pages/analytics/experiment/{format.js, ExperimentList.jsx, CreateForm.jsx, Detail.jsx, EvidenceForms.jsx, DecisionStep.jsx}`; shared `components/analytics/{AAExpStages, AAAdherence}.jsx` |
| `pages/analytics/SystemReviewPage.jsx` (lazy route shell; exports `ReviewView`, `pendingIndex`) | `pages/analytics/system/{format.js, ReviewView.jsx, Sections.jsx, Tradeoff.jsx, Relations.jsx, LinkDialog.jsx, Consequences.jsx, ContextForms.jsx, SelfCheck.jsx, SavedReview.jsx, RevisionView.jsx, Waiting.jsx}`; shared `components/analytics/AAImportance.jsx` |
| `pages/calendar/CalendarPage.jsx` (lazy route shell; exports the pure `CalendarView`) | `pages/calendar/{calendarRoute.js, CubeGrids.jsx, DayManagerModal.jsx, CalendarTaskEditor.jsx, CalendarHistory.jsx}`; stacked-dialog behaviour in `components/useDialog.js` |
| `components/SettingsPage.jsx` (re-exports `ExportSection`) | `components/settings/{ExportSection.jsx, DangerSection.jsx, Row.jsx}`; small static sections stay in the page on purpose |

### Styles — the cascade is the product

`src/styles.css` is an **ordered `@import` manifest**; `main.jsx` imports it.
Each layer is a contiguous range of the original single stylesheet. **Never
reorder**; add a rule to the layer that owns the component.

| Layer (`src/styles/`) | Owns |
|---|---|
| `tokens.css` | UI-kit tokens, density, dark tokens, light-theme token overrides |
| `shell.css` | layout, sidebar, top bar |
| `panels.css` | today hero, panel card, task list, money, goals, habits, toast, milestone |
| `modals.css` | quick add, task detail, settings page, placeholder |
| `pages-core.css` | page chrome, hero vignette, quick notes, Clarify panel |
| `pages-life.css` | tasks toolbar, inline field, profile, dog, health, medications (read-only) |
| `home.css` | home dashboard, charts, upcoming, telegram footer |
| `calendar-nav.css` | calendar toolbar chrome (level tabs, navigation), mobile bottom nav |
| `responsive.css` | < 640 px single column |
| `theme-light.css` | the second light-theme override block |
| `medications.css` | interactive medications, config drawer, detail/journal |
| `finance-calendar.css` | flexible finance, calendar cubes, Day Manager, nested editor, History |
| `glass.css` | **cross-cutting glass-card layer — must stay second-to-last** |
| `paradise.css` | **paradise theme — must stay last** |

Order pinned by `styles-manifest.test.js`. Any split or move must keep the
emitted `dist/assets/index-*.css` byte-identical. `analytics.css` (Adaptive
Analytics components) is separate and imported by those components.

---

## Do-not-split list

`services/aa_facts.py`, `analytics/enums.py`, `analytics/rules/*`,
`services/aa_signals.py` (cohesive; revisit only if a new subject kind lands),
`models/*`, `domain/clarify.ts`, `domain/projects.ts`, the durable queue
repositories, `analytics.css`, `ClarifyPanel` / `QuickAddModal` /
`TaskDetailModal`, the small Settings sections, `components/icons.jsx`.
