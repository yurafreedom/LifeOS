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
| AA history retention (policy, preview, apply, horizon; Slice 8) | facade `services/aa_retention.py` + `routes/aa_retention.py` + `schemas/aa_retention.py` |
| vocabulary / enums | `analytics/enums.py` (fan-in 30 — a flat vocabulary is the right shape) |

### Accounts, sessions and access (JENKIN S1)

| I want to change… | Go to |
|---|---|
| who the request is for (session → account) and the **account binding** contract (`X-LifeOS-Account`; 401 / 428 `account_binding_required` / 409 `session_user_mismatch`) | `app/dependencies.py` — every protected route depends on `get_current_user` / `get_bound_session`; only `GET /auth/me` uses the unbound `get_current_session`. `tests/test_account_binding.py::test_every_protected_route_is_bound` fails on an unbound new route |
| login, bootstrap (creates the **owner**), logout, session issue/resolve | `services/auth.py` + `routes/auth.py` |
| password change / recovery, email verification, sessions list/revoke, owner invitations, recent security events | `services/account_access.py`; anonymous routes in `routes/auth.py`, bound routes in `routes/account_security.py`; schemas in `schemas/auth.py` |
| throttling limits | `services/throttle.py::POLICIES` (DB table `auth_throttle`, digests only) |
| audit events: vocabulary, retention, purge | `services/security_audit.py` (`EVENTS`; never secrets) |
| coarse client network / device label, proxy trust | `security/client_info.py` (`Settings.trusted_proxy_hops`) |
| outgoing mail (adapter, templates) | `app/mail/` — `delivery.py` (disabled / memory / file / SMTP; `app.state.mail`), `templates.py` |
| private-response caching | `middleware/private_cache.py` |
| designate the owner on a multi-user database | `app/cli.py grant-owner <email>` |

A new account-owned table needs: model + migration + export (`services/export.py`) + erasure (FK cascade
from `users`) + `tests/conftest.py::TRUNCATED_TABLES`.

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
| PDF / DOCX / XLSX / MD | `exports/` (`document.py` model → `report.py` builder → one writer per format; `labels.py` = the only server copy, including `PRODUCT_NAME` — the visible product name (JENKIN) in export labels and DOCX/XLSX/PDF metadata; download file names keep `lifeos-*`; `fonts/` DejaVu + license) |

Internal direction: `errors`, `refs`, `periods` → `contracts` → `resolve` →
`importance`/`relations`/`contexts` → `changes` → `consequences` → `candidates`/`repeated`
→ `read_model` → `revisions`; `redaction` → models + `refs`; `exports` → models only.
A GET never writes (READ ONLY transaction in the route).

### Retention (Slice 8)

Facade: **`app/services/aa_retention.py`** — import only from here
(`routes/aa_retention.py`, tests). No module in the package imports the facade.

| I want to change… | Go to `app/services/retention/` |
|---|---|
| error codes, engine / consequences version, allowed months, advisory lock | `contracts.py` |
| the effective historical-completeness horizon (completed runs only) | `horizon.py` — **leaf** (models only); read by history, finance, coverage, signals, Project Analytics, System Review and legacy import |
| policy versions (append-only; never deletes) | `policy.py` |
| which rows a horizon may erase (whole chain / window / Project unit, semantic axes) | `eligibility.py` |
| set-based provenance redaction (UUID-token hash join) | `provenance.py` |
| preview token, atomic Apply, run audit | `engine.py` |

Bulk frozen-evidence redactors live beside their per-fact adapters:
`reviews/redaction.py` (`review_items_for_sources`, `redact_review_items`) and
`system_review/redaction.py` (`system_review_revisions_for`, `relations_for`,
`importance_for` + their bulk erasers), exported through their facades.
Retention never calls `aa_deletion.delete_fact`, never tombstones and never writes
`aa_deletion_receipts`. The F6 anti-resurrection guard lives in `services/aa_legacy_import.py`.

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
| change hash parsing / sub-routes (`medications/<id>`, `review/…`, `project-analytics/<id>`, `experiment/{new,<uuid>}`, `calendar/…`, `system-review/…`) | `app/routeRegistry.js` (`readRouteFromHash`, `normalizeRoute`; pinned by `route-registry.test.ts`). The Calendar's own grammar (`calendar/{YYYY,YYYY-MM,YYYY-MM-DD,years[/YYYY],history}`) is `pages/calendar/calendarRoute.js`; how those routes map onto the nested levels (Years → Months → Days → Day details), the selected date and its clamping, breadcrumbs, previous/next/Today steps and arrow-key geometry are the pure `pages/calendar/calendarNav.js` |
| render a route | one `case` in `App.jsx::renderRoute()` |
| make a route lazy / eager | `app/lazyRoutes.jsx` (`LAZY_ROUTE_LOADERS`; pinned by `lazy-routes.test.jsx`). Home, Login, ParadiseScene and shell chrome stay eager. One `Suspense` boundary around `renderRoute()`; its fallback is empty `.page` chrome — do not add a second loading design |
| nav entries | `components/Sidebar.jsx`, `components/MobileBottomNav.jsx` + locale copy |

Shell effects: `app/useTheme.js` (theme + paradise scene, `localStorage`
`lifeOsTheme`/`lifeOsScene`), `app/useSidebarCollapsed.js` (`lifeOsSidebar`),
`pages/calendar/calendarNav.js` `readLayout`/`writeLayout` (Calendar day layout A/B,
`lifeOsCalendarLayout`, default B — a device preference, never in the snapshot),
`app/paradisePress.js` (delegated pointer physics), `app/clarifyHandlers.js`
(the six Clarify transitions + toasts), `app/useUiSound.js` (UI sound
listeners + Settings preference hook), `app/useInterfaceFont.js` (optional
DejaVu Sans interface font, `lifeOsFont`, applied as `<html data-font>` and
pre-paint in `index.html`).

Branding: `components/JenkinBrand.jsx` (Editorial wordmark + serif J mark,
outlined `currentColor` SVG from `design-references/jenkin-branding/logo/`),
`src/brand.css` (mark ink `--jenkin-ink` and logo focus ring `--jenkin-focus`
per theme; the DejaVu `@font-face` faces; `:root[data-font="dejavu"]` re-points
only `--font-display` / `--font-body`, and each stylesheet selector that still
names 'Onest' / 'Work Sans' has exactly one scoped override —
`jenkin-branding.test.jsx` fails on a missing *or* a dead override; new styles,
the nested Calendar included, use the typography tokens instead of literals;
`--font-mono` / `.mono` are never re-pointed; imported by `main.jsx` after
`styles.css`, outside the layer manifest), favicons in `public/assets/`,
runtime fonts in `assets/fonts/dejavu-sans/`.

### UI sound effects

Facade: **`sound/index.ts`** — app code imports `sfx` / `installUiSound` /
preference accessors from here only. Importing it has no side effects.

| I want to… | Go to |
|---|---|
| add a clip, change a trim window or loudness trim | `sound/catalog.ts` `SOUND_ASSETS` (files in `assets/sfx/`, bundled by Vite) |
| add a semantic event / change a default assignment or priority | `sound/catalog.ts` `SOUND_EVENTS` + RU/UK `sfx_ev_*` copy |
| change what a click / Escape / hover means, eligibility, duplicate prevention | `sound/gestures.ts` (one cue per trusted gesture; `data-sfx="<event>"` / `data-sfx="none"` on markup) |
| change playback (voices, channels, late drop, unlock, retry) | `sound/engine.ts` (Web Audio; never throws) |
| change stored settings | `sound/preferences.ts` (`localStorage` `lifeOsSfx`, validated field by field) |
| sound a success | `sfx.emit('<event>')` **at the app's existing success boundary** (task completion: `LifeDataContext.completesTask`; server save: `RetentionSection.savePolicy`) |
| the Settings panel | `components/settings/SoundSection.jsx` |

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

### Account identity in the browser (JENKIN S1)

| I want to change… | Go to |
|---|---|
| the tab's expected account, request generation, late-response discard, auth signals | `api/accountBinding.ts` (used only through `api/client.ts::apiFetch` / `requestJson`; export and System Review downloads use `apiFetch`) |
| identity revalidation, cross-tab notices, switched / expired / signed-out states, honest logout, logout guard | `context/AuthContext.jsx` + `app/authChannel.js` (BroadcastChannel `lifeos-auth`, storage fallback) |
| the account-scoped tree | `App.jsx::AuthGate` keys `AnalyticsProvider` / `LifeDataProvider` by `user.id:generation`; `AccountSwitchedScreen` |
| links from security mail (`#/auth/{reset,verify,invite}/<token>`) | `app/authActions.js` (read once, scrubbed) + `pages/auth/AuthActionPage.jsx` |
| Settings → Security | `components/settings/SecuritySection.jsx` + `api/accountSecurity.ts` |
| unsaved snapshot edits kept per account / restore prompt | `repositories/pendingSnapshotStore.ts` + `components/PendingRecoveryPrompt.jsx`; logout resolution `components/LogoutPendingDialog.jsx` |
| the old local-only `lifeOsState` (decision, retire, restore, delete) | `repositories/legacyLocalImport.ts`; prompt `components/StateImportPrompt.jsx`; Settings → Export `components/settings/LegacyDataSection.jsx` |

### Operational state

**`context/LifeDataContext.jsx`** is the single operational snapshot provider
(18 importers). One state, one provider — never add a competing store.

| I want to… | Go to |
|---|---|
| change the initial snapshot of a new account (**empty**) | `context/lifeData/initialState.js` — demo content lives only in the test fixture `context/lifeData/demoState.js`; production code must not import it (`honest-production-state.test.jsx`) |
| change snapshot migration / validation | `context/lifeData/migrate.js` (snapshot `version` stays 2) |
| add a domain action | `LifeDataContext.jsx` provider body. Projects/transactions enqueue the durable AA write **before** mutating the snapshot — keep that order |
| task semantics (Calendar date = `schedule.date`, completion/closure/restore, move, per-day `order`, `created_at`, optional-field validators) | `domain/tasks.ts` (pure; the provider only wires actions). History is derived from `state.tasks`, never `activityLog`. The Tasks «показать» views and their counts are `tasksForView` / `taskViewCounts` (one pipeline for rows and counts); the nested Calendar's tile summaries are `activeTaskCounts` (active dated tasks per day / month / year = the Day details rows) |
| Calendar date math (month lengths, weekdays, 12-year windows anchored at the current year, bounds ≤ 2100, Kyiv today, `msUntilNextDay`, the 7 × 6 month grid of layout A `monthGrid`, the real week panels of layout B `monthWeeks`, `clampedDate`, `addDays`, `dateInBounds`) and the **one** task date/time input rule (`validateScheduleInput` / `scheduleEdit`: a time needs a date, clearing the date clears its time, used by the Calendar editor and the Tasks detail) | `domain/calendarModel.ts` |
| Tasks «сегодня» / «просрочено» / «по дате» (GTD G2: `schedule.date` against the Kyiv day; legacy tag/stakes/due never date authority) | `domain/tasks.ts` `tasksDueToday` / `overdueTasks` / `sortTasksByDate`; the live Kyiv day for an open page is `app/useKyivToday.js` (midnight timer + focus/visibility/pageshow re-check); Tasks detail save routing (schedule change → `moveTask`, missing task → `{ok:false}`) is `app/taskDetailSave.js` |
| Waiting For lifecycle after Delegate (edit title/person, received / cancelled, restore, convert → undated Task, delete; lifecycle-field validation; active/closed selectors) — GTD G1 | `domain/waiting.ts` (pure `applyWaitingCommand` → `applied` \| `unchanged` \| `invalid`; `commitWaitingCommand` is the provider bridge). Provider: `LifeDataContext.runWaitingCommand` (runs the updater under `flushSync`, so the outcome comes from the state React applies, not the render closure). UI: `pages/TasksPage.jsx::WaitingSection` + `components/WaitingItemModal.jsx`. Record **creation** stays in `domain/clarify.ts` (unchanged) |

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
| History retention (direct calls only — policy and Apply never use the write queue) | `api/analytics/retention.ts` |

A new domain = a new module + one facade line. Domain modules import shared
types from `facts.ts` only.

**Durable analytics queue — do not reorganise in structural work:**
`repositories/analyticsRepository.ts`, `analyticsWriteQueue.ts`,
`analyticsSyncCoordinator.ts`, `stateSyncCoordinator.ts`.
JENKIN S1 invariants: IndexedDB v2 — every record has an owner (`isQueueOwner`), ownerless v1 records are
`quarantined`; updates are owner-checked; replay is bound to the record's owner; `dispose()` aborts and
stops the loop; a binding refusal or abort releases the record unchanged; Web Lock `aa-write-queue:<user>`.

### Pages split into modules

| Page | Internals |
|---|---|
| `pages/analytics/ReviewPage.jsx` (route shell; re-exports the views) | `pages/analytics/review/{format.js, Evidence.jsx, Flow.jsx, SavedReview.jsx}` |
| `pages/projects/ProjectAnalyticsPage.jsx` (route shell; exports the pure `ProjectAnalyticsView`) | `pages/projects/analytics/{ForecastComparison.jsx, ForecastHistory.jsx}`; helpers in `analytics/projectAnalytics.ts` |
| `pages/analytics/ExperimentPage.jsx` (route shell; re-exports `ExperimentDetailView`, `ExperimentListView`) | `pages/analytics/experiment/{format.js, ExperimentList.jsx, CreateForm.jsx, Detail.jsx, EvidenceForms.jsx, DecisionStep.jsx}`; shared `components/analytics/{AAExpStages, AAAdherence}.jsx` |
| `pages/analytics/SystemReviewPage.jsx` (lazy route shell; exports `ReviewView`, `pendingIndex`) | `pages/analytics/system/{format.js, ReviewView.jsx, Sections.jsx, Tradeoff.jsx, Relations.jsx, LinkDialog.jsx, Consequences.jsx, ContextForms.jsx, SelfCheck.jsx, SavedReview.jsx, RevisionView.jsx, Waiting.jsx}`; shared `components/analytics/AAImportance.jsx` |
| `pages/calendar/CalendarPage.jsx` (lazy route shell: hash, selected date, A/B preference, focus and transition restarts; exports the pure, hook-free `CalendarView`: breadcrumbs, controls, one stable stage; plus the two stage policies `stageFocusTarget` — where focus goes after a navigation, never away from a usable toolbar control or an open dialog — and `ignoreRepeatClick` — only single activations act inside the stage) | `pages/calendar/{calendarRoute.js, calendarNav.js, TileGrids.jsx, DayDetails.jsx, CalendarTaskEditor.jsx, CalendarHistory.jsx}` — `TileGrids.jsx` = year / month tiles and day layouts A and B, `DayDetails.jsx` = the in-stage fourth level with every former Day Manager action (its nested editor is portalled to `<body>`); stacked-dialog behaviour of the editor in `components/useDialog.js` |
| `components/SettingsPage.jsx` (re-exports `ExportSection`) | `components/settings/{ExportSection.jsx, DangerSection.jsx, RetentionSection.jsx, Row.jsx}`; small static sections stay in the page on purpose. `RetentionSection` exports the pure `RetentionView` + `runApply`; activityLog cleanup stays in `DangerSection` |

### Styles — the cascade is the product

`src/styles.css` is an **ordered `@import` manifest**; `main.jsx` imports it.
Each layer is a contiguous range of the original single stylesheet. **Never
reorder**; add a rule to the layer that owns the component.

| Layer (`src/styles/`) | Owns |
|---|---|
| `tokens.css` | UI-kit tokens, density, dark tokens, light-theme token overrides; the JENKIN material tokens (`--mat-*`, `--warm-beige`, `--today-text`, `--today-num`) — paradise-day values live in the paradise-day token block of `paradise.css`, paradise-night inherits dark |
| `shell.css` | layout, sidebar, top bar |
| `panels.css` | today hero, panel card, task list, money, goals, habits, toast, milestone |
| `modals.css` | quick add, task detail, settings page, placeholder |
| `pages-core.css` | page chrome, hero vignette, quick notes, Clarify panel |
| `pages-life.css` | tasks toolbar, inline field, profile, dog, health, medications (read-only) |
| `home.css` | home dashboard, charts, upcoming, telegram footer |
| `calendar-nav.css` | nested Calendar chrome (breadcrumbs, A/B switch, previous / Today / next, History; the `cal` size container), mobile bottom nav |
| `responsive.css` | < 640 px single column |
| `theme-light.css` | the second light-theme override block |
| `medications.css` | interactive medications, config drawer, detail/journal |
| `finance-calendar.css` | flexible finance, the nested Calendar stage, tiles, layouts A/B, week panels, day details, day task rows, nested editor, History, the tile transition + reduced-motion fade |
| `glass.css` | **cross-cutting glass-card layer — must stay second-to-last** |
| `paradise.css` | **paradise theme — must stay last** |

Order pinned by `styles-manifest.test.js`. Any split or move must keep the
emitted `dist/assets/index-*.css` byte-identical. `analytics.css` (Adaptive
Analytics components) is separate and imported by those components.
`brand.css` (logo marks, optional interface font) is imported by `main.jsx`
right after `styles.css`, outside the manifest: it wins ties against every
layer without reordering them, and no layer may style `.jenkin-*` or
`--jenkin-*`.

---

## Do-not-split list

`services/aa_facts.py`, `analytics/enums.py`, `analytics/rules/*`,
`services/aa_signals.py` (cohesive; revisit only if a new subject kind lands),
`models/*`, `domain/clarify.ts`, `domain/projects.ts`, the durable queue
repositories, `analytics.css`, `ClarifyPanel` / `QuickAddModal` /
`TaskDetailModal`, the small Settings sections, `components/icons.jsx`.
