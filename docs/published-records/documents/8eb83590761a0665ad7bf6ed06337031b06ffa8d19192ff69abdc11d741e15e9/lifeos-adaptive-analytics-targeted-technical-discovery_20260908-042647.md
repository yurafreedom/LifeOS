# LifeOS Adaptive Analytics — Targeted Technical Discovery & Target Architecture

**Mode:** `READ_ONLY_DISCOVERY_AND_ARCHITECTURE`
**Generated:** 2026-09-08 04:26:47
**Author:** Claude Opus 5 (Claude Code session `01UeEfoDq36GfaNtcNTQpLR5`)

Evidence labels used throughout:
`[VC]` VERIFIED_CURRENT_CODE · `[APC]` ACCEPTED_PRODUCT_CONTRACT · `[HC]` HISTORICAL_CONTEXT ·
`[INF]` INFERENCE · `[AR]` ARCHITECTURE_RECOMMENDATION · `[ODR]` NEW_OWNER_DECISION_REQUIRED

---

## 1. Executive verdict

**LifeOS today persists exactly one mutable current-state document per user and no semantic history whatsoever.** `[VC]`

The entire server-side persistence surface is three tables (`users`, `sessions`, `user_snapshots`) created by a single migration. `user_snapshots` is keyed on `user_id` alone — **one row per user** — holding one JSONB `payload` that is **fully replaced** on every write. The `revision` column is an optimistic-concurrency compare-and-swap counter, **not** a historical version: the previous payload is overwritten in place and is unrecoverable.

Against that, the accepted A–J design contract requires the system to state, months later and truthfully:

> «Вот что действительно произошло. Вот чего вы ожидали в тот момент. Вот как менялись прогнозы. Вот откуда взялись данные. Вот что было исправлено. Вот что остаётся неизвестным. Вот что вы решили изменить.»

**None of those seven statements is auditable in the current architecture.** Six of the seven have no representation at all; the seventh ("что действительно произошло") is representable only as *current* values, with no as-of reconstruction.

Concretely:

- **Expectation, Target, Forecast and Baseline do not exist in any form.** The only budget-like number in the product is `const budget = 300;` — a hardcoded literal in a React component (`apps/web/src/components/MoneyWidget.jsx:30`). `[VC]`
- The one history-shaped structure, `activityLog`, lives **inside** the same replaceable JSONB blob, is **FIFO-capped at 5000 entries** (`apps/web/src/lib/activity.js:31`), is **user-prunable** from Settings, records only *new* values with no before→after pair, and carries no provenance or epistemic typing. It violates the binding "No Silent History Loss" invariant by construction. `[VC]`
- There is **zero** analytics code in the product: `grep -rn "analytic" apps/web/src apps/api/app` returns nothing, and `LIFE_ROUTES` has no analytics surface. The AA layer is entirely additive. `[VC]`

**Verdict:** the accepted A–J UX is not a rendering problem, it is a **persistence** problem. No A–J surface can be implemented truthfully today. The required change is, however, unusually low-risk: because no analytics behaviour exists in production, the AA history layer can be added **alongside** the current snapshot without modifying a single existing table, endpoint, or state-sync path.

**Recommended target architecture: Option D — hybrid.** Retain `user_snapshots` unchanged as the operational current-state projection; add a new, relational, bitemporal, append-only *semantic history* with its own write endpoints, its own idempotency keys, and explicit supersession. Derived analytics (Delta, coverage, signals, summaries) are computed from that history and never stored as fact.

`TARGET_ARCHITECTURE_READY = YES`
`PHASE_B_PLAN_READY = NO` — five owner decisions (§24) shape schema, deletion semantics and migration honesty; and the G · Project pilot has a prerequisite that lies outside Adaptive Analytics entirely (§26).

---

## 2. Start-state record

Verified before any Discovery work, and re-verified at completion with no drift.

| Check | Expected | Actual | Match |
| --- | --- | --- | --- |
| `pwd` | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem-adaptive-analytics-import` | same | ✔ |
| `git rev-parse --show-toplevel` | worktree root | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem-adaptive-analytics-import` | ✔ |
| `git branch --show-current` | `design/adaptive-analytics-import` | `design/adaptive-analytics-import` | ✔ |
| `git rev-parse HEAD` | `d4960286ec94f35472600e59c0d533dc50a64351` | `d4960286ec94f35472600e59c0d533dc50a64351` | ✔ |
| `git tag --points-at HEAD` | `adaptive-analytics-design-accepted` | `adaptive-analytics-design-accepted` | ✔ |
| Tag object type | annotated | `tag` (annotated), message *"Accepted LifeOS Adaptive Analytics A-J design contract"* | ✔ |
| Tag → commit | `d496028…` | `d4960286ec94f35472600e59c0d533dc50a64351` | ✔ |

**Working tree:** `M .DS_Store` only.

This is a macOS Finder metadata file, pre-existing at session start, **treated as user-owned and left untouched**. No clean/reset/stash/checkout was performed. `git diff --stat HEAD -- apps/` was empty at both the start and the end of Discovery, confirming **no concurrent changes to persistence or API files during the Discovery** (stop condition §31.3 not triggered).

**Worktrees:** two — the main checkout at `…/LifeOS_DesignSystem` (`67a1456`, branch `design-sync-setup`) and this one. All work was confined to this worktree.

**Recent commits:**

```
d496028 design: finalize Adaptive Analytics semantic freeze      ← HEAD, tagged
d99da15 design: import accepted Adaptive Analytics A-J system
67a1456 feat(sync): persist Life OS state per account
102aea4 feat(api): add authenticated multi-account state service
6c7039a chore(web): add reproducible React production build
```

The two most recent commits are the design import and freeze; the three before them are the entire current persistence and sync implementation.

---

## 3. Accepted UX/design contract sources inspected

The design package is **present and complete**. `ui_kits/life-os-analytics/README.md` closes with an explicit status table marking every surface A · Home, B · Signal Card, C · Expected/Actual/Delta, D · Metric & Forecast history, E · Review, F · Finance, G · Project, H · Subjective+objective, I · Experiment, J · Trade-off, J · System Review and the mobile provenance sheet as **accepted**, with *"Nothing in this layer is outstanding."* `[APC]`

| File | Lines | Role in this Discovery |
| --- | --- | --- |
| `ui_kits/life-os-analytics/README.md` | 212 | Authoritative product/UX contract; semantic rules; pattern inventory; preview-only exclusions |
| `ui_kits/life-os-analytics/data.js` | 210 | Seed facts encoding accepted semantics — the single richest source of *data-shape* truth |
| `ui_kits/life-os-analytics/primitives.jsx` | 275 | `AAProvenance`, `AASignalCard`, `AADelta`, `AAFacts`, `AAChart`, `AAChartLayers`, `AAHistoryList`, `AAFactorTag`, `AAQualityStrip` |
| `ui_kits/life-os-analytics/screens.jsx` | 409 | A · Home, C+D · Metric detail, E · Review, B/C state galleries |
| `ui_kits/life-os-analytics/domains.jsx` | 161 | F · Finance, G · Project |
| `ui_kits/life-os-analytics/experiment.jsx` | 244 | I · Experiment, `AAExpStages`, `AAAdherence` |
| `ui_kits/life-os-analytics/system.jsx` | 241 | J · Trade-off, J · System Review, `AAImportance` |
| `ui_kits/life-os-analytics/analytics.css` | 347 | Production-ready styles + explicitly-flagged demo chrome |
| `preview/aa-delta.html`, `preview/aa-signal-card.html` | — | Frozen specimen cards referenced by the README's freeze note |

### 3.1 Missing expected source — reported, not worked around

The brief names `export_claude_lifeOS/_lifeos_forensic/**` as a source. **It is absent from this repository.**

```
$ ls -d export_claude_lifeOS      → ABSENT
$ find . -type d -name _lifeos_forensic -not -path './.git/*'  → (no results)
```

No forensic/product artifact set exists here under any name. This Discovery therefore proceeds **without** LifeOS forensic evidence and relies on source priority 1 (design package), 4 (current code) and 5 (historical docs). Nothing in the report depends on the missing material; where forensic evidence would have been the natural source — chiefly the *history* of past product decisions about retention and deletion — the corresponding questions are raised as owner decisions in §24 rather than inferred. No missing design behaviour has been invented.

### 3.2 Historical document explicitly demoted

`ARCHITECTURE.md` (36 KB) is stamped *"Last updated: end of Sprint 3.6 (CLOSED — June 11, 2026)"* and describes a stack of **"React (no JSX build — Babel standalone in browser)"** and **"localStorage for theme + sidebar collapse state"**.

Current code contradicts this directly: `apps/web` is a Vite + React build with a TypeScript API client, and state is persisted server-side to PostgreSQL via FastAPI. `ARCHITECTURE.md` is therefore treated as `[HC]` only and is **not** used as an architecture source anywhere in this report. Current code is implementation truth.

---

## 4. Current architecture map `[VC]`

```
apps/web  (Vite + React 18, JSX build, TS for the data layer)
  src/context/LifeDataContext.jsx      743 lines — THE state tree; every persisted field
  src/repositories/
      stateRepository.ts                15 — LifeOsState / StateEnvelope / StateRepository iface
      serverStateRepository.ts          46 — HTTP-backed implementation
      stateSyncCoordinator.ts          205 — debounce, CAS, conflict freeze, offline retry
      legacyLocalImport.ts              34 — one-time localStorage → server import
  src/api/{client,auth,state}.ts             — fetch wrapper, ApiError/NetworkError
  src/lib/{activity,finance,calendar,medMath}.js — pure helpers
  src/pages, src/components, src/profile     — surfaces (no analytics anywhere)

apps/api  (FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL/psycopg)
  app/models/{user,session,user_snapshot}.py — 3 tables, total
  app/routes/{health,auth,state}.py          — 6 endpoints, total
  app/services/{auth,state}.py
  app/schemas/state.py                       — StateReplace / StateEnvelope
  app/middleware/body_limit.py               — 5 MiB cap on PUT /api/v1/state
  alembic/versions/20260721_0001_create_accounts_and_snapshots.py  — the ONLY migration
```

### 4.1 Complete API surface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | liveness + DB check |
| `POST` | `/api/v1/auth/bootstrap` | create the first account |
| `POST` | `/api/v1/auth/login` | session cookie |
| `POST` | `/api/v1/auth/logout` | revoke session |
| `GET` | `/api/v1/auth/me` | current user |
| `GET` | `/api/v1/state` | fetch the whole snapshot (404 `state_not_initialized` if none) |
| `PUT` | `/api/v1/state` | **replace** the whole snapshot, CAS on `expected_revision` |

That is the entire contract. **There is no export endpoint, no account-deletion endpoint, no history endpoint, no range query, and no pagination anywhere in the product.**

### 4.2 Persistence architecture

```sql
users          (id uuid PK, email, password_hash, is_active, created_at, updated_at)
                 UNIQUE INDEX uq_users_email_lower ON lower(email)
sessions       (id uuid PK, user_id FK→users ON DELETE CASCADE, token_hash CHAR(64) UNIQUE,
                created_at, last_seen_at, expires_at)
user_snapshots (user_id uuid PRIMARY KEY FK→users ON DELETE CASCADE,   ← ONE ROW PER USER
                schema_version int, revision bigint DEFAULT 1,
                payload JSONB, created_at, updated_at)
                CHECK schema_version > 0, CHECK revision > 0,
                CHECK jsonb_typeof(payload) = 'object'
```

`apps/api/app/services/state.py` — the write path in full:

- `expected_revision == 0` → `INSERT … ON CONFLICT DO NOTHING RETURNING *`
- otherwise → `UPDATE … WHERE user_id = :u AND revision = :expected SET revision = revision + 1, payload = :new RETURNING *`
- zero rows returned → re-read current revision, `ROLLBACK`, raise `RevisionConflictError` → HTTP 409 with `current_revision`

**The `UPDATE` overwrites `payload` in place. The prior document is gone.** There is no shadow table, no trigger, no WAL-derived audit, no `pg_temporal` extension. `revision` distinguishes *"someone else wrote since you read"* — nothing more.

### 4.3 Synchronization coordinator `apps/web/src/repositories/stateSyncCoordinator.ts`

- **Debounced whole-payload PUT**, 500 ms (`debounceMs ?? 500`).
- Phases: `saved | saving | offline | conflict | error`.
- **On HTTP 409 the coordinator sets `frozen = true` and stops syncing entirely.** No merge, no rebase, no field-level reconciliation. Recovery requires an explicit `reloadServerState()` / `resetRevision()`, which **discards the pending local payload**.
- On `NetworkError` → `offline`; the pending payload is retained **in memory only** and retried on the `window online` event.
- `getPendingPayload()` + `exportUnsaved()` exist precisely because unsynced state can otherwise be lost when the tab closes.

This conflict-freeze behaviour is the single most important constraint on the target architecture and is analysed in §9 and §19.

---

## 5. Current persistence / history capability `[VC]`

Everything the product persists lives in one JSONB document. Classification per the §9 taxonomy:

| Field (in `payload`) | Shape | Classification |
| --- | --- | --- |
| `version` | `2` (pinned `Literal[2]` server-side) | schema marker |
| `profile`, `dog` | objects | **CURRENT-STATE-ONLY**, MUTABLE |
| `tasks[]` | `{id, title/titleKey, done, stakes, tag, due}` | **CURRENT-STATE-ONLY**, MUTABLE — *no timestamps at all* |
| `transactions[]` | `{id, amount, category_id, date, description, source, included_in_totals}` | **TEMPORAL (day granularity)**, MUTABLE. `source: 'monobank'\|'manual'` is a nascent provenance field |
| `categoryOverrides{}` | `{[catId]: {included_in_totals}}` | CURRENT-STATE-ONLY, MUTABLE |
| `goals[]` | `{id, title, pct, val, tag}` | CURRENT-STATE-ONLY — **no dates, no estimates, no history** |
| `habits[]` | `{id, titleKey, week[7], streak, best}` | CURRENT-STATE-ONLY — a rolling 7-slot window, **overwritten weekly** |
| `medications[]` | config incl. `inventory_count`, `status` | CURRENT-STATE-ONLY; soft-delete → `status:'archived'` |
| `doseLogs{medId:[]}` | `{taken_at ISO, dose_mg, mode, note}` | **TEMPORAL / APPEND-ONLY in practice** — the richest genuine time series in the product |
| `pharmNotes{medId:[]}` | `{id, date, polarity '+/−', text}` | TEMPORAL (day), MUTABLE — subjective observations |
| `modeStyles{medId}` | `{type, target, startedAt}` | a stored *intent* with a start timestamp |
| `quickNotes[]` | `{id, text, at}` | `at` is a **clock string** (`'08:14'`), not a date |
| `activityLog[]` | `{id, timestamp, entity_type, entity_id, action, details}` | **PRUNABLE, CAPPED, LOSSY** — see below |
| *(seeds)* | `dashboard-seed.js`, `calendar-seed.js`, `medications.js`, `dog.js`, `profile.js` | **SEED/MOCK** |

### 5.1 `activityLog` — the only history-shaped structure, and why it cannot serve

`apps/web/src/lib/activity.js`:

```js
var CAP = 5000;
…
var next = safe.concat([full]);
if (next.length > CAP) next = next.slice(next.length - CAP);   // ← oldest silently dropped
```

`apps/web/src/context/LifeDataContext.jsx:642`:

```js
function clearActivityOlderThan(cutoffISO) { … LifeActivity.pruneOlderThan(prev.activityLog, cutoffISO) … }
```
surfaced in Settings as *«очистить историю старше»* (`LocaleContext.jsx:617`).

Five disqualifying properties:

1. **Bounded** — FIFO cap 5000 drops the oldest entries with no record that anything was dropped. At ~150 B/entry it also already occupies ≈750 KB of a 5 MiB payload budget.
2. **Prunable** — a user-facing control deletes history by age.
3. **Co-located with mutable state** — it is a field inside the very document that `PUT /api/v1/state` replaces wholesale. One bad write destroys the history along with the state.
4. **No before→after.** `updateTask` logs `details: { title: task.title }` — the *new* title only. `editPharmNote` logs no values at all. A correction is therefore unrepresentable: the accepted F case «Операция исправлена · ₴12,000 → ₴1,200» cannot be produced from this log.
5. **No provenance, no epistemic status, no supersession, no idempotency key.** `details` is free-form and untyped.

### 5.2 What is NOT stored — anywhere

`Expectation` · `ExpectationVersion` · `Target` · `Baseline` · `Forecast` · `ForecastVersion` · `MetricDefinition` · `Measurement` (as a typed concept) · `Signal` · `SignalAcknowledgement` · `Review` · `ReviewFactor` · `Decision` · `Experiment` · `Adherence` · `Correction` · `Supersession` · `Tombstone` · `Provenance` · `CrossDomainReference` · coverage · data quality · importance.

Two specific proofs:

- `apps/web/src/components/MoneyWidget.jsx:30` — `const budget = 300;` The product's only budget is a **hardcoded literal**, not user data. The accepted F surface requires *three stored expectation versions* (₴50,000 → ₴57,000 → ₴62,000), none deleted.
- `LifeDataContext` exposes `addTransaction`, `toggleTransactionInclusion`, `toggleCategoryInclusion` — and **no `updateTransaction` and no `deleteTransaction`**. The accepted correction case has no code path whatsoever.

### 5.3 Export / delete today

- **Export** is client-side only: `exportJSON()` serialises the in-memory tree; `downloadState()` triggers a browser download. No server endpoint.
- **Account deletion** does not exist as an endpoint. `ON DELETE CASCADE` from `users` is defined, so a manual DB deletion would cascade — but nothing exposes it.
- **Domain deletion** is inconsistent: medications soft-delete to `archived` (retaining `doseLogs`), tasks and pharm notes hard-delete from the array.

---

## 6. Gap analysis against A–J `[APC]` vs `[VC]`

For each accepted surface: what it needs, what exists, and whether it can be built truthfully today.

| # | Surface | Required persisted facts | Exists today | Truthful today? |
| --- | --- | --- | --- | --- |
| **A** | Home · 0–3 signals | signal derivation inputs; materiality rules; **acknowledgement** ("просмотрено"); freshness | nothing | **No** |
| **B** | Signal Card · 6 states | `normal/material/info` rules; `stale` ← per-source last-import time; `partial` ← coverage; `resolved` ← persisted ack; provenance 4-tuple | nothing; `transactions.source` is the only provenance-ish field | **No** |
| **C** | Expected/Actual/Delta | Expectation (versioned) · Actual (+coverage) · Target (**explicitly absent ≠ zero**) · Forecast; `desire` grounded only in Target/Preference/Decision | none of the five concepts exist | **No** |
| **D** | Metric / Forecast history | expectation versions w/ dates · forecast versions · baseline · event annotations · **corrections (before→after)** · missing-vs-zero · quality strip (покрытие / исправлений / оценочных / причина) | `activityLog` only — capped, prunable, no before→after, no provenance | **No** |
| **E** | Review / Debrief | frozen Expected/Actual/Delta context *as seen at review time* · free-text observation · n factors with epistemic tag · uncertainty · decision · revisability | nothing | **No** |
| **F** | Finance domain | 3 expectation versions (none deleted) · correction ₴12,000→₴1,200 · coverage 28/31 · target explicitly not set · forecast ₴67,800 · typical ₴54,300 | hardcoded `budget = 300`; no expectation; **no transaction edit/delete path**; no coverage | **No** |
| **G** | Project domain | project entity · first estimate (recorded 12 авг) · 3 forecast versions · actual as a **separate fact** · two coexisting deltas | **no project entity at all**; `goals` carry `pct`/`tag` and no dates or estimates | **No** — and blocked by a missing domain, not only by AA |
| **H** | Subjective + objective | subjective scale values (energy, stress 7/10) + note + timestamp, adjacent to objective measures, never collapsed | `pharmNotes` (`date`, `polarity +/−`, `text`) is the closest analogue: day granularity, med-scoped, not linked to a metric or window; no scales | **Partial backing only** |
| **I** | Experiment | hypothesis · baseline (+window +provenance) · intervention · window · **per-day adherence** (kept/missed/**future**) · changed conditions · observations · result · factors · decision (nullable) | nothing | **No** |
| **J** | Trade-off | per-change value + **unit** + coverage + provenance + user-owned importance; contradictions retained; no composite | nothing; no cross-domain query capability (single opaque JSONB) | **No** |
| **J** | System Review | changed / grounded-improved / repeated / contradictions / pending / data quality / user adjustments over a window | nothing | **No** |

**Score: 0 of 11 A–J surfaces are implementable truthfully on the current persistence model.** H alone has partial backing.

### 6.1 The three gaps that bite hardest

1. **No as-of reconstruction.** Every value in the snapshot is *now*. «Вот чего вы ожидали в тот момент» requires knowing when the system learned a fact, separately from when the fact occurred. Nothing records the former.
2. **No correction semantics.** `activityLog` records that an edit happened, not what it replaced. D and F both render corrections as `original → corrected`.
3. **No coverage / missing-data model.** The contract is emphatic — *«Missing is never zero»*, *«3 дня ещё не наступили — не считаем их нулями»*, *«Неполное покрытие не заменяется нулями и не достраивается оценкой»*. `LifeFinance.sumIncluded` sums whatever rows exist and has no notion of an expected denominator, so absence and zero are indistinguishable today.

---

## 7. Persist vs derive matrix `[AR]`

A derived value is acceptable **only** if it is deterministically reproducible from immutable/versioned inputs *as of a stated timestamp*, or its own derivation is versioned and audited.

### 7.1 Persist

| Concept | Why it must be persisted | Reproducible otherwise? |
| --- | --- | --- |
| Measurement (actual) | irreducible observation | no |
| ExpectationVersion | user intent at a point in time; F stores three, none deleted | no |
| ForecastVersion | G renders 3 versions + the actual separately | no |
| Baseline | I captures it *before* the intervention; cannot be recomputed after conditions change | no |
| Target / Preference / Decision-direction | **the only legitimate source of desirability** | no |
| Observation (subjective) | user-reported evidence (H) | no |
| Review + frozen context | must remain stable a year later (§14) | no |
| ReviewFactor (+ epistemic kind) | user interpretation, not fact | no |
| Decision / Adjustment | user-owned; absence is meaningful | no |
| Experiment, adherence days, experiment observations | I | no |
| Provenance (source, basis, when, how) | B/D/F/J render it on every card | no |
| Correction / supersession links | D and F render `original → corrected` | no |
| SignalAcknowledgement | the `resolved` state of B survives reload | no |
| Importance rating (J) | user-owned, defaults to «не решил» | no |
| Cross-domain reference | must be **explicit**, never inferred from overlap | no |

### 7.2 Derive

| Derived value | Immutable inputs required to reproduce it |
| --- | --- |
| **Delta** (C) | the two operand version IDs + their values + unit + comparison timestamp |
| `desire` (favorable/unfavorable/neutral/unknown) | the grounding record ID (Target ∣ Preference ∣ Decision) or its **absence** → `neutral` |
| Coverage % | window bounds + expected denominator + measurement `occurred_at` set |
| Forecast error | ForecastVersion IDs + the Measurement that closed the subject |
| Signal candidacy + materiality | the triggering version IDs + rule ID + rule version |
| Signal `stale` | `max(recorded_at)` per source + evaluation time |
| Signal `partial` | coverage inputs above |
| Adherence kept/missed/**future** | per-day adherence rows + window bounds + evaluation date |
| «версий прогноза» count | ForecastVersion rows for the subject — *not* mixed with the actual |
| System Review groups (changed/repeated/contradictions) | the underlying version rows over the window + grouping rule version |
| Trade-off card values | per-domain measurements + comparison window; **never summed across units** |

### 7.3 Two derivation rules the contract forces

- **`desire` is derived from grounding, not from sign.** The README is explicit: *"Qualifying grounds are exactly three: an explicit Target, a user Preference/ориентир, or a user Decision naming a desired direction… An Expectation does not qualify."* The freeze note records that two gallery specimens and the `preview/aa-delta.html` money specimen were **corrected at freeze** from `favorable`/`unfavorable` to `neutral` for exactly this reason. The derivation must therefore take *grounding record or null* as an input and return `neutral` on null — never inspect the sign.
- **Rule versions must be recorded with derived output that a user acted on.** If a signal was acknowledged under rule v1, a later rule v2 must not retroactively rewrite what the user dismissed. Store `rule_id` + `rule_version` on the acknowledgement.

---

## 8. Candidate canonical data contracts `[AR]`

Conceptual contracts first; SQL names in §10.3 are illustrative.

### 8.1 The bitemporal spine — the core answer to §8 of the brief

> *"What facts and history must LifeOS persist so that, months or years later, it can truthfully reproduce the accepted A–J UX?"*

**Every analytical fact carries two independent times:**

- `occurred_at` — when the thing happened in the world (or the window it applies to)
- `recorded_at` — when LifeOS learned it

Plus a third, derived from supersession: `valid_until` — when this row stopped being the system's current belief.

This is the minimum that makes *«Вот чего вы ожидали в тот момент»* answerable: the expectation in force on 15 August is `the row with the greatest recorded_at ≤ 15 Aug that was not superseded before 15 Aug`. Without `recorded_at`, that query is impossible and history can only be reconstructed as fiction.

The accepted seed data already demonstrates the need: G's forecasts are `{when: '12 авг', value: '20 авг'}` — *recorded on* the 12th, *predicting* the 20th. Two times, both required, both rendered on screen.

### 8.2 Concept ledger

| Concept | Owner | Persisted / derived | Identity | Scope | Notes |
| --- | --- | --- | --- | --- | --- |
| `MetricDefinition` | AA shared | persisted | `(user_id, domain, key)` | account | unit kind, value type (money/date/duration/count/scale/categorical), aggregation, **no desirability** |
| `Measurement` | domain, AA-shaped | persisted, append-only | uuid | account + subject | `occurred_at`, `recorded_at`, value, unit, provenance, `supersedes_id` |
| `Baseline` | AA | persisted | uuid | account + subject | value + window + provenance; captured **before** an intervention |
| `ExpectationVersion` | AA | persisted, append-only | uuid | account + subject | predictive; `effective_from`, `recorded_at`, note |
| `ForecastVersion` | AA | persisted, append-only | uuid | account + subject | estimate; separate table from Expectation |
| `Target` | AA | persisted | uuid | account + subject | **normative**; may be explicitly absent (`not_set`, ≠ zero) |
| `Preference` (ориентир) | AA | persisted | uuid | account | names a desired direction, e.g. «не работать после 00:30» |
| `Observation` | AA | persisted | uuid | account + subject | user-reported/subjective; scale or text; `kind` epistemic |
| `Signal` | AA | **derived** | `signal_key` (stable hash) | account | content never stored as fact |
| `SignalAcknowledgement` | AA | **persisted** | uuid | account | `signal_key`, `acknowledged_at`, `rule_id`, `rule_version`, input version IDs |
| `Review` | AA | persisted | uuid | account + subject + window | + **frozen context** (§14) |
| `ReviewFactor` | AA | persisted | uuid | review | text + `kind ∈ {observed, mine, maybe, unknown}` |
| `Decision` | AA | persisted, **nullable** | uuid | review ∣ experiment | absence ≠ `inconclusive` |
| `Experiment` | AA | persisted | uuid | account | hypothesis, intervention, window, lifecycle |
| `ExperimentAdherenceDay` | AA | persisted | `(experiment_id, day)` | experiment | one row per day; future days are **absent or explicitly future**, never misses |
| `ExperimentObservation` | AA | persisted | uuid | experiment | measurement-shaped, own provenance |
| `Provenance` | AA | persisted **inline** (§13) | — | per fact | `source_kind`, `basis`, `recorded_at`, `method`, `source_ref` |
| `Correction` / `Supersession` | AA | persisted as columns | — | per fact | `supersedes_id`, `superseded_at`, `superseded_by_id`, `reason` |
| `Tombstone` | AA | persisted | — | per fact | `status ∈ {active, superseded, tombstoned}` |
| `CrossDomainReference` | AA | persisted | uuid | account | **explicit only**; never inferred |
| `ImportanceRating` | AA | persisted | `(user_id, change_key)` | account | J; default «не решил» |

### 8.3 Why *not* a single polymorphic event table

The brief warns against it; the accepted design supplies the concrete reason.

The README documents that «версий прогноза» is **3**, computed as `forecasts.filter(f => !f.actual)` — because the seed put the observed completion *inside* the `forecasts` array with an `actual: true` flag. The design then had to filter it back out and print *«3 · факт отдельно»* on screen.

That filter is the collapse hazard made visible **inside the accepted artefact itself**: once an Actual lives in the Forecast collection, every count, every "latest version", and every delta must remember to exclude it, forever, at every call site. A generic `aa_events` table would reproduce that hazard for all twelve concepts at once.

**Recommendation:** separate tables per concept, sharing a common column *template* (identity, subject, bitemporal pair, value, unit, provenance, supersession, status) but never a shared row space. In particular:

- `Target` is **physically separate** from `ExpectationVersion` and `ForecastVersion`. It is the only normative source, so schema-level separation makes «expectation used as desirability» not merely discouraged but unrepresentable.
- `Measurement` is **physically separate** from `ForecastVersion`. An actual is not a forecast version — the G surface says so on screen.
- `AAFacts` vs `AADelta` in the component layer has an exact schema analogue: shared shape, distinct semantics, no interchange.

Cost: ~12 narrow tables instead of one wide one. At personal scale (§21) this costs nothing and buys correctness by construction.

---

## 9. Current-state vs history — architecture options `[AR]`

Re-evaluated against current code, not against any prior recommendation.

### Option A — extend the current snapshot only

Add expectations/forecasts/reviews as new fields in `payload`.

| Criterion | Assessment |
| --- | --- |
| Correctness | **Fails.** History inside a wholly-replaced document is destroyed by any faulty write; no as-of query |
| Queryability | none — JSONB blob, no indexes, all filtering client-side after full download |
| Payload growth | **Fails the 5 MiB cap.** `activityLog` alone already budgets ≈750 KB at cap |
| Conflict behaviour | **Fails.** Every fact write flows through the CAS PUT; a 409 sets `frozen = true` and *all* recording stops |
| Migration | trivial | 
| Corrections / provenance / idempotency | absent, and nothing in the shape encourages them |
| Export / delete | inherits client-only export |
| **Verdict** | **Rejected** — violates "No Silent History Loss" by construction |

### Option B — snapshot + bounded history inside JSONB

The status quo generalised: keep history in `payload` with caps.

Bounded history *is* silent history loss. This is precisely what `activityLog` does today (CAP 5000, FIFO, no drop record), and the accepted contract forbids it: *«История версионируется, а не перезаписывается… Ничего молча не исчезает.»* Every Option A defect also applies. **Rejected.**

### Option C — separate append-only analytical history, snapshot retired

Move all state to relational tables and drop `user_snapshots`.

| Criterion | Assessment |
| --- | --- |
| Correctness | good |
| Cost | **Very high.** `LifeDataContext.jsx` (743 lines) and every page read from one in-memory tree; the whole offline/debounce model, the legacy-import path, `migrateStateCopy`, and 5 of 6 web test suites assume it |
| Risk | rewrites working, tested, shipped code (`67a1456`, `102aea4`) to deliver a feature that touches none of it |
| Migration | large, user-visible, with a real regression surface |
| **Verdict** | **Rejected for now** — correct destination, wrong first move. Nothing in Option D forecloses it later |

### Option D — hybrid: current snapshot + durable semantic history ✅

`user_snapshots` stays exactly as it is, as the **operational current-state projection**. A new relational, bitemporal, append-only **semantic history** is added beside it with its own endpoints.

| Criterion | Assessment |
| --- | --- |
| Correctness | full as-of reconstruction, supersession, provenance |
| Queryability | real indexes, range/keyset pagination, cross-domain queries for J |
| Payload growth | **snapshot stays small — history never enters it**; the 5 MiB cap is no longer load-bearing |
| Conflict behaviour | **decisive advantage** — append endpoints bypass the CAS PUT entirely, so a snapshot 409 freeze cannot stop fact recording |
| Client complexity | moderate: one new repository + append queue; existing coordinator untouched |
| Migrations | purely additive; **no change to `user_snapshots`, no `schema_version` bump**, `Literal[2]` in `schemas/state.py` stays valid |
| Retention / corrections / provenance / idempotency | first-class, by design |
| Export / delete | new endpoints required (§16) — a genuine new obligation, called out |
| Operational cost | ~12 tables, 1–3 migrations, 2–4 endpoints per slice |
| Compatibility with existing sync | **total** — nothing existing changes |
| **Verdict** | **RECOMMENDED** |

### 9.1 The evidence that decides it

Three facts in current code, not general principle:

1. **`stateSyncCoordinator.ts` freezes on conflict.** `frozen = true` halts *all* subsequent writes until manual recovery, and recovery discards the pending payload. Routing measurements or expectation versions through that path means a single concurrent write on another device can silently stop LifeOS from recording what happened. For a system whose product promise is *"вот что действительно произошло"*, that is disqualifying. Option D's separate append path — where writes are commutative and carry idempotency keys — has no such failure mode.
2. **The 5 MiB body cap is enforced before JSON parsing** (`SnapshotBodyLimitMiddleware`, `max_snapshot_bytes = 5_242_880`). Years of measurements cannot live under it. Under Option D the cap constrains only current state, which is bounded by design.
3. **There is no analytics code to migrate.** `grep -rn "analytic" apps/web/src apps/api/app` → no matches; `LIFE_ROUTES` has no analytics entry. The AA layer is greenfield, so the hybrid's usual cost — reconciling two sources of truth for the same feature — **does not arise**: the snapshot owns current state, history owns the past, and no existing surface reads history.

---

## 10. Recommended target architecture `[AR]`

### 10.1 Shape

```
┌─────────────────────────────┐         ┌──────────────────────────────────────┐
│ CURRENT STATE               │         │ SEMANTIC HISTORY (new)               │
│ user_snapshots (unchanged)  │         │ relational · bitemporal · append-only │
│ one JSONB row per user      │         │ per-fact provenance + supersession    │
│ CAS on `revision`           │         │ idempotency-keyed appends             │
│ PUT /api/v1/state           │         │ POST /api/v1/aa/… (new)              │
└──────────────┬──────────────┘         └──────────────────┬───────────────────┘
               │  "what is true now"                       │  "how we got here"
               └────────────────┬──────────────────────────┘
                                ▼
                  ┌───────────────────────────────┐
                  │ DERIVED ANALYTICS (computed)  │
                  │ Delta · coverage · signals ·  │
                  │ summaries · adherence         │
                  │ never stored as fact          │
                  └───────────────────────────────┘
```

**Division of ownership**

- *Stays in the snapshot:* tasks, profile, dog, medication config, habits, quick notes, category overrides, UI preferences, goals — everything the app needs to paint the current screen. Unchanged.
- *Becomes durable history:* measurements, expectation/forecast versions, baselines, targets, preferences, observations, reviews (+frozen context), factors, decisions, experiments (+adherence, +observations), signal acknowledgements, importance ratings, cross-references, corrections/tombstones.
- *Dual representation:* a small, explicitly-derived read model may be projected back into the snapshot for first-paint speed (e.g. today's 0–3 signals) — **marked as a cache, never read as evidence, always recomputable.**

### 10.2 How each contract is met

| Requirement | Mechanism |
| --- | --- |
| «что действительно произошло» | `Measurement` rows, append-only, with `occurred_at` |
| «чего вы ожидали в тот момент» | `ExpectationVersion` + `recorded_at` → as-of query |
| «как менялись прогнозы» | `ForecastVersion` rows, one per revision, never overwritten |
| «откуда взялись данные» | inline provenance 4-tuple on every fact (§13) |
| «что было исправлено» | `supersedes_id` / `superseded_by_id` + `status` + reason (§12) |
| «что остаётся неизвестным» | `unknown` is a stored value, not a null; coverage is explicit; absence stays absence |
| «что вы решили изменить» | `Decision` rows, nullable, distinct from `inconclusive` |
| Expectation ≠ Target | **separate tables**; `desire` derivation reads only Target/Preference/Decision |
| Materiality ⊥ desirability | independent columns; materiality from stakes triggers, desirability from grounding |
| Missing ≠ zero | coverage denominators stored; no zero-fill anywhere; aggregation functions take an explicit window |
| No global score | no table, column or endpoint aggregates across units — enforced by having no cross-unit numeric type |

### 10.3 Illustrative schema sketch (names not final)

```sql
-- shared column template on every fact table:
--   id uuid PK, user_id uuid NOT NULL FK→users ON DELETE CASCADE,
--   subject_domain text, subject_type text, subject_id text,     -- typed reference triple
--   occurred_at timestamptz, occurred_tz text,                   -- see §11.4
--   recorded_at timestamptz NOT NULL DEFAULT now(),
--   source_kind aa_source_kind NOT NULL,  basis text,  method text,  source_ref text,
--   supersedes_id uuid NULL REFERENCES <same table>(id),
--   superseded_by_id uuid NULL, superseded_at timestamptz NULL, supersede_reason text,
--   status aa_status NOT NULL DEFAULT 'active',                  -- active|superseded|tombstoned
--   idempotency_key text NOT NULL,
--   UNIQUE (user_id, idempotency_key)

aa_metric_definitions      (…, domain, key, unit_kind, value_type, aggregation)
aa_measurements            (…, value_num, value_text, unit)
aa_baselines               (…, value_num, value_text, unit, window_start, window_end)
aa_expectation_versions    (…, value_num, value_text, unit, effective_from, note)
aa_forecast_versions       (…, value_num, value_text, unit, horizon_at, note)
aa_targets                 (…, value_num, value_text, unit, is_explicitly_absent bool,
                               desired_direction aa_direction)   -- NORMATIVE, separate on purpose
aa_preferences             (…, statement text, desired_direction aa_direction)
aa_observations            (…, scale_value numeric, scale_max numeric, text, kind aa_epistemic)
aa_signal_acknowledgements (…, signal_key text, rule_id text, rule_version int,
                               input_version_ids uuid[], acknowledged_at, resolution)
aa_reviews                 (…, subject_ref, window_start, window_end,
                               frozen_context jsonb, frozen_input_ids uuid[],
                               free_text, revised_at)
aa_review_factors          (…, review_id, text, kind aa_epistemic)
aa_decisions               (…, review_id NULL, experiment_id NULL,
                               choice aa_decision_choice NULL, note)   -- NULL = no decision
aa_experiments             (…, title, hypothesis, intervention,
                               window_start, window_end, lifecycle aa_experiment_lifecycle)
aa_experiment_adherence    (experiment_id, day date, state aa_adherence_state, PRIMARY KEY(...))
aa_experiment_observations (…, experiment_id, label, value_num, value_text, unit)
aa_importance_ratings      (user_id, change_key, importance aa_importance)
aa_cross_references        (…, from_ref, to_ref, relation aa_relation, created_by 'user')

-- indexes
CREATE INDEX ON aa_measurements (user_id, subject_domain, subject_type, subject_id, occurred_at DESC);
CREATE INDEX ON aa_measurements (user_id, recorded_at DESC);
CREATE INDEX ON aa_expectation_versions (user_id, subject_id, recorded_at DESC) WHERE status = 'active';
-- …mirrored per fact table
```

### 10.4 Operational cost

3 Alembic migrations for the spine; ~12 tables; 2–4 endpoints per slice; no change to the existing 7 endpoints; no change to `user_snapshots`; no `schema_version` bump; existing tests remain valid unmodified.

---

## 11. Semantic version / history contract `[AR]`

### 11.1 Six distinct operations — never conflated

| Operation | Meaning | Effect |
| --- | --- | --- |
| **CREATE** | a new fact is learned | new row, `status = active` |
| **EDIT** | a *non-semantic* attribute changes (label, note wording, display order) | in-place update; **not** versioned |
| **CORRECT** | the recorded fact was **wrong** | new row with `supersedes_id`; old row → `status = superseded`. Both retained. Analytics counts the corrected row **once**, never twice |
| **SUPERSEDE** | the fact was right then and has been **revised** (a new forecast) | new row, prior row remains historically valid for its interval — *not* an error |
| **DELETE** (soft) | the user removes it from their life | `status = tombstoned`; content redacted per §16; existence + timestamps retained so history and reviews stay coherent |
| **HARD DELETE** | the user exercises erasure | row removed, cascading per §16; dependent reviews annotated «источник удалён» |

**CORRECT and SUPERSEDE are different and both are needed.** The accepted D surface renders them differently: a correction shows `original → corrected` («Операция исправлена · ₴12,000 → ₴1,200»), a supersession shows a version sequence («Прогноз изменён · 24 авг → 26 авг»). Collapsing them would make the finance correction indistinguishable from a genuine change of mind.

### 11.2 The two worked cases from the contract

**Finance correction.** ₴12,000 entered, corrected to ₴1,200:

```
m1: value 12000, occurred 17 Aug, recorded 17 Aug, status=superseded, superseded_by=m2
m2: value  1200, occurred 17 Aug, recorded 28 Aug, supersedes=m1, reason='wrong amount entered'
```
August total counts m2 only. D renders the pair. Two genuine expenses are never implied. A review saved on 20 August still shows the ₴12,000-era context (§14) with a correction affordance.

**Project forecast chain.** Reproducible in full:

```
f1 recorded 12 Aug → predicts 20 Aug     ┐ three ForecastVersion rows
f2 recorded 15 Aug → predicts 24 Aug     │ none superseded — each was correct when made
f3 recorded 20 Aug → predicts 26 Aug     ┘
m1 occurred 25 Aug, recorded 25 Aug      ← a Measurement, NOT a forecast version
```
«версий прогноза 3 · факт отдельно» becomes `COUNT(*) FROM aa_forecast_versions` — no filter to forget. Both accepted deltas (+5 days to f1, −1 day to f3) are computable, and neither has to pick a sign.

### 11.3 What must *not* be versioned

Do not record every click. **Not** versioned: UI state (theme, sidebar, layer toggles, expanded strips), draft text before save, navigation, ephemeral toggles, task `done` flips *unless* a metric definition subscribes to them as measurements. The test: **would a user ever ask "what did this look like before?"** If no, it is snapshot state.

### 11.4 Timezone semantics

`occurred_at timestamptz` + `occurred_tz text` (IANA name). Rationale from the contract: coverage is counted in **days** («28 из 31 дня», «19 из 28 дней», «9 из 14 дней»), and day boundaries are local. Storing UTC alone makes coverage wrong for anyone who travels — and the accepted I surface *has* a travel confounder («Две поездки в середине периода»). Windows are stored as local dates plus the zone in force.

---

## 12. Provenance contract `[AR]`

### 12.1 Shape — matched to the UI, not invented

`AAProvenance` renders exactly four rows: **источник · основание · когда · как**. The contract is therefore a 4-tuple, plus a machine-readable link:

| Field | UI row | Example from accepted seed |
| --- | --- | --- |
| `source_kind` | источник | «Из моих записей + импорт» |
| `basis` | основание | «184 операции · monobank» |
| `recorded_at` | когда | «28 авг, 08:40» |
| `method` | как | «Сумма расходов за период минус корректировки» |
| `source_ref` | *(not rendered)* | IDs of the underlying records |

### 12.2 Inline columns, not a join table

Every signal card, delta header, history row, observation, and J change card carries a provenance chip — provenance is read on essentially **every** analytical row. A join table would add a lookup per row for data that is never queried independently and never shared between facts. **Recommendation: five inline columns on each fact table.** Revisit only if provenance ever needs to be queried on its own.

### 12.3 Epistemic states

Justified against actual rendering, not chosen for symmetry. The design carries **two distinct** epistemic vocabularies and they must not be merged:

**(a) Fact provenance** — `aa_source_kind`, drives the «источник» row:

| Value | Evidence in the accepted package |
| --- | --- |
| `OBSERVED` | «Наблюдение системы» — tag `data-kind="observed"` |
| `USER_REPORTED` | «Моя запись» / «Из моих записей» |
| `IMPORTED` | «Импорт» / «monobank» — matches `transactions.source` today |
| `DERIVED` | «Выведено Life OS» |
| `ESTIMATED` | `is-estimate` cell style |
| `FORECAST` | forecast tail, hollow end point |
| `UNKNOWN` | «причина не установлена» |

`HYPOTHESIS` and `INFERRED` are deliberately **excluded** from this enum. A hypothesis is not a source of a value — the I surface renders it in a dashed claim block «предположение, не факт» and *never as a value*, so it is a column on `aa_experiments`, not a provenance kind. `INFERRED` has no distinct rendering separate from `DERIVED`; adding it would be enum aesthetics. `[INF]` — flagged as a judgement, revisit if a future surface distinguishes them.

**(b) Interpretation kind** — `aa_epistemic`, on review factors and observations. Fixed exactly by `AA_KINDS` in `primitives.jsx`: `observed` (наблюдение) · `mine` (моя трактовка) · `maybe` (возможный фактор) · `unknown` (неизвестно). **`unknown` is the default**, not a null.

### 12.4 Freshness and correction status

`stale` is derived: `now − max(recorded_at) per source > threshold` (the B gallery shows «обновлено 9 дней назад»). Correction status is derived from `status` + `superseded_by_id`, surfaced by the quality strip's «исправлений · 1».

---

## 13. Signal contract `[AR]`

### 13.1 Derived content, persisted acknowledgement

Validated against all six accepted B states:

| State | Source | Storage |
| --- | --- | --- |
| `normal` / `material` / `info` | rule evaluation over version rows | derived |
| `stale` | `max(recorded_at)` per source vs now | derived |
| `partial` | coverage vs window denominator | derived |
| `resolved` («просмотрено») | **user action** — survives reload | **persisted** |

Only `resolved` requires storage. Confirmed against A (`onDismiss` → the card moves to resolved) and F (the inline variant has no dismiss). The pattern in the brief holds.

### 13.2 Identity, dedup, reappearance

```
signal_key = hash(user_id, subject_ref, rule_id, rule_version, sorted(input_version_ids))
```

Consequences, each checked against accepted behaviour:

- **Dedup** — re-deriving over unchanged inputs yields the same key; an acknowledged signal stays hidden.
- **Reappearance on genuine change** — a new `ForecastVersion` changes `input_version_ids` → new key → the signal reappears. Correct: *«Это третье изменение за месяц»* is exactly a signal that should return.
- **Behaviour after correction** — correcting a measurement supersedes it, so inputs change, so the key changes and the signal is re-evaluated on corrected data. The stale acknowledgement never suppresses the corrected signal, and it remains on record that the user dismissed the *pre-correction* signal. This falls out of the key rather than needing special handling.
- **Rule evolution** — `rule_version` in the key prevents a rule change from retroactively re-opening or silently altering what the user already dismissed.

### 13.3 Materiality, expiry, Home's 0–3

- **Domain owns materiality.** The stakes triggers are domain rules (the accepted seed marks the finance signal `stakes: true` with the comment *"trigger #7: budget at 98%"*). AA owns the *grammar*, the domain owns *what counts as material*. Materiality never implies desirability — the README: warm *"says 'look at this', not 'this is good or bad'"*.
- **Expiry:** signals expire when their window closes or their inputs are superseded; no separate TTL.
- **Home:** derive candidates → drop acknowledged → rank by materiality → **take at most 3**. Zero is a first-class state, rendered as *«Ничего существенного не менялось. Данные за неделю на месте.»* — which is itself a claim about data quality and must be derived from coverage, not from an empty result set.

### 13.4 Stale/partial signals

A stale or partial signal is **shown, tagged, and never silently dropped** (B has explicit states for both). It must not be suppressed for being imperfect — suppression would make absence of a signal mean two different things.

---

## 14. Review contract `[AR]`

### 14.1 The problem

> *"A Review viewed one year later must not silently become a different review merely because current source data changed."*

Two naive options both fail:

- **Store only source IDs** → the review re-derives from *current* data. Open the August review in a year and the ₴12,000 correction has silently rewritten what you reviewed. Fails the invariant.
- **Store only a frozen snapshot** → the review is stable but *dishonest*: it never reveals that its evidence was later corrected. Fails "No Silent History Loss" from the other side.

### 14.2 Recommendation — freeze **and** reference

Every review stores **both**:

1. `frozen_context jsonb` — the exact rendered context as seen at review time: the AADelta cells (labels, values, units, sub-lines), coverage, provenance tuples, and the derivation rule versions used.
2. `frozen_input_ids uuid[]` — the specific fact-version IDs the context was derived from.

**Display rule:** render the frozen context by default — that *is* the review. On open, compare `frozen_input_ids` against current status; if any is `superseded` or `tombstoned`, show a quiet affordance — *«данные позже исправлены»* — that reveals the current values **beside**, never instead of, the frozen ones.

This satisfies both invariants at once: the review is historically stable *and* the later correction is visible. It reuses the existing grammar exactly — the corrected-vs-original juxtaposition is the same pattern D already uses, and «противоречия остаются рядом» is already an accepted principle.

### 14.3 Scope, revision, deletion

- **Subject + window:** a review references `(subject_ref, window_start, window_end)` — the accepted flows are «ревью месяца» (Finance) and «ревью проекта» (Project).
- **What is frozen:** derived context (step 1's delta) and provenance. **Not** frozen: the user's own free text, factors and decision — those are the user's living interpretation, revisable. The README confirms: *«Ревью можно открыть снова и дополнить.»*
- **Revisions:** additive; keep `revised_at` and version the free text/factors so that a re-opened review does not silently rewrite what was said at the time.
- **Deletion of referenced data:** the frozen context contains *values*. Whether erasure must reach inside it is **`[ODR]` D1** (§24).
- **No score.** There is no aggregate column, and step completion is not tracked as progress — every step is skippable and «Ничего не выбрано — нормальный итог».

---

## 15. Experiment contract `[AR]`

### 15.1 Lifecycle ⊥ outcome — two independent columns

**Lifecycle** — the accepted set is exactly four (`data.js`: `status: 'draft' · 'running' · 'review' · 'decided'`; `AAExpStages` maps `{draft:1, running:3, review:5, decided:6}`):

| Recommended name | Accepted value |
| --- | --- |
| `DRAFT` | `draft` |
| `RUNNING` | `running` |
| `COMPLETED_AWAITING_DECISION` | `review` |
| `REVIEWED` | `decided` |

`ABANDONED` appears **nowhere** in the accepted package. It is a plausible fifth state but promoting it here would be inventing product behaviour → **`[ODR]` D4** (§24). The four accepted states are canonical until decided.

**Outcome** — a separate, **nullable** column. The accepted choice list (`experiment.jsx`) is exactly: `keep` · `modify` · `longer` · `reject` · `inconclusive`.

**The critical invariant is structural:** `decision IS NULL` ≠ `decision = 'inconclusive'`.
- `NULL` = the user has not decided. The seed ships `decision: null` on a completed experiment, and the UI states *«Решение можно не принимать. Эксперимент останется в истории.»*
- `'inconclusive'` = the user actively concluded *«Непонятно — данных недостаточно»*.

A nullable column with an explicit `inconclusive` value makes these unconfusable. **`NOT NULL DEFAULT 'inconclusive'` would silently destroy a real product distinction** and must never be used.

### 15.2 Adherence — per-day rows

Store one row per day: `(experiment_id, day, state)` with `state ∈ {kept, missed, future, unknown}`.

**Why per-day rather than the seed's `{kept, elapsed, total}` counters:**

- `AAAdherence` derives each cell's kind from its index against `kept`/`elapsed`, which loses *which* days were kept. D-style annotation, condition correlation and honest re-derivation all need the actual days.
- «Future days are not missed days» becomes **structural**: days beyond today simply have no `kept`/`missed` row. With counters, "future" is a computed nicety that a later refactor can lose. The accepted copy is emphatic — *«прошло без соблюдения»* vs *«ещё не наступило»*, and *«дни, которые не наступили, никогда не рисуются как пропуски»*.
- `elapsed` becomes derived from the window and today, so it cannot drift.
- Cost: 14–21 rows per experiment. Negligible.

`kept / elapsed` remains derivable exactly (`COUNT(*) FILTER (WHERE state='kept')`), so the accepted quality-strip values are unchanged.

### 15.3 The rest

- **Hypothesis:** a text column on `aa_experiments` with `hypothesis_recorded_at`. **Never** a provenance kind and never a value — it renders in a dashed claim block labelled «предположение, не факт».
- **Baseline:** its own row (`aa_baselines`) with window and provenance, captured **before** the intervention. Not a measurement of the period.
- **Changed conditions:** observations with `kind='observed'`, stored beside the result. The strip must render `0` as *«Изменений условий не зафиксировано. Это не означает, что их не было»* — absence of record ≠ absence of event.
- **Interim values:** shown while `RUNNING`, but the result delta is `unknown` with *«рано судить · период не закончен»*. The result is not computed until the window closes.
- **No causal claim in the model.** There is no `cause` column and no confidence score. The link between intervention and result is a *juxtaposition*, and the schema offers nowhere to assert otherwise. Contributing factors are `aa_review_factors`-shaped with `unknown` included by default.

---

## 16. Cross-domain / System Review contract `[AR]`

### 16.1 Querying several domains without a score

The shared spine makes this a **union over fact tables filtered by window**, grouped by `subject_domain`:

```sql
SELECT subject_domain, subject_id, value_num, value_text, unit, coverage…
FROM   aa_measurements
WHERE  user_id = :u AND occurred_at BETWEEN :start AND :end AND status = 'active'
-- one row per change, each keeping its own unit and coverage
```

**No composite score is possible because no aggregation crosses `unit`.** J's cards are «+11 ч», «+24%», «−11%», «ниже», «−₴800» — five incompatible types. The recommended schema stores `unit` on every value and offers no cross-unit numeric type, so *"sum the month"* has no expressible query. The banner *«Общего балла нет и не будет»* is enforced by the data model, not by discipline.

### 16.2 The six System Review groups

| Group | Derivation | Guard |
| --- | --- | --- |
| Что менялось | version rows in window | none needed |
| **Что улучшилось** | changes **joined to a grounding record** (Target ∣ Preference ∣ Decision) | `INNER JOIN` on grounding — no grounding, no row. An expectation join is **not** permitted. `basis` is always rendered |
| Что повторилось | pattern rule over ≥2 prior windows | tagged as observation, never «приговор» |
| Противоречия | two changes in one window with opposing user-grounded directions | rendered side by side, **never resolved** |
| Ждёт вас | open reviews + experiments awaiting decision | counts only |
| Качество данных | coverage per domain over the window | «Неполное покрытие не заменяется нулями» |

The «улучшилось» join is the schema-level expression of the freeze rule. Because `aa_targets` / `aa_preferences` are physically separate from `aa_expectation_versions`, an expectation *cannot* satisfy that join — the correctness lives in the schema, not in a code review. The accepted seed proves the intended behaviour: «расходы −₴800 к ожиданию» sits in *changed*; «правило сна соблюдалось 9 из 14 дней» sits in *improved* with basis *«по вашему ориентиру: не работать после 00:30»*.

### 16.3 Cross-domain relationships

Required: typed references (`subject_domain`/`subject_type`/`subject_id`), temporal alignment (shared window semantics + local-day boundaries), coverage per series, and **explicit user-created relationships only** (`aa_cross_references`, `created_by = 'user'`).

**Temporal overlap must never create a relationship row.** The accepted seed models exactly this restraint: item `c6` «Часы и сон» carries `value: 'связь не установлена'` with method *«Совпадение по дням; причинность не проверялась»* — an overlap is recorded as an *observation that overlap exists*, not as a link. A `relation` value asserting causality must not exist in the enum.

### 16.4 Boundaries

System Review replaces neither Home (0–3 signals now) nor the GTD weekly review (what to do next). They read different data over different windows for different questions; the overlap is left open per the accepted design.

---

## 17. API / use-case inventory `[AR]`

Worked backwards from the accepted UX. **Queries and writes first**, endpoints second.

### 17.1 Reads

| # | Use case | Surface | Shape |
| --- | --- | --- | --- |
| R1 | current material signals (≤3, unacknowledged) | A | derive + filter |
| R2 | signal detail + provenance | B | by `signal_key` |
| R3 | current expected/actual/delta for a subject | C, F, G | as-of now |
| R4 | metric history over a range (actual + baseline + expectation versions + forecast versions + events) | D | **range query, paginated** |
| R5 | expectation version history for a subject | F | ordered by `recorded_at` |
| R6 | forecast version history + the actual **as a separate fact** | G | two result sets, never merged |
| R7 | provenance detail for one value | everywhere | by fact ID |
| R8 | data quality / coverage for a window | D, F, I, J | coverage aggregate |
| R9 | review context for a subject+window | E | as-of, pre-save |
| R10 | saved review, historically frozen (+ correction flags) | E | by review ID |
| R11 | experiment state, adherence days, observations | I | by experiment ID |
| R12 | changes across domains for a window | J | union, grouped by domain |
| R13 | system review groups for a period | J | six grouped queries |
| R14 | subjective + objective side by side | H | two series, one window |
| R15 | pending reviews / experiments | J | counts |

### 17.2 Writes

| # | Use case | Semantics |
| --- | --- | --- |
| W1 | record a measurement | append, idempotency-keyed |
| W2 | **correct** a measurement | append + supersede |
| W3 | create/update an expectation | **append a new version** — never an update |
| W4 | set / explicitly unset a Target | append; `is_explicitly_absent` is a real value |
| W5 | record a forecast version | append |
| W6 | capture a baseline | append |
| W7 | add an observation | append |
| W8 | acknowledge / resolve a signal | upsert on `signal_key` |
| W9 | save a review (freezes context) | append + freeze |
| W10 | revise a review | append revision |
| W11 | create / start / complete an experiment | lifecycle transition |
| W12 | record adherence for a day | upsert on `(experiment_id, day)` |
| W13 | record a decision (or leave it null) | append; nullable |
| W14 | set importance on a change | upsert |
| W15 | create an explicit cross-reference | append |
| W16 | tombstone / hard-delete a fact | §16 semantics |

### 17.3 Proposed boundaries

```
GET  /api/v1/aa/signals                         → R1
GET  /api/v1/aa/signals/{signal_key}            → R2
POST /api/v1/aa/signals/{signal_key}/ack        → W8
GET  /api/v1/aa/subjects/{ref}/summary          → R3
GET  /api/v1/aa/subjects/{ref}/history          → R4,R5,R6  (?from&to&layers=&cursor=&limit=)
GET  /api/v1/aa/subjects/{ref}/quality          → R8
GET  /api/v1/aa/facts/{id}/provenance           → R7
POST /api/v1/aa/facts                           → W1,W3,W4,W5,W6,W7  (typed body, idempotency key)
POST /api/v1/aa/facts/{id}/correct              → W2
DELETE /api/v1/aa/facts/{id}                    → W16 (mode=tombstone|hard)
GET  /api/v1/aa/reviews/context?subject=&from=&to=   → R9
GET  /api/v1/aa/reviews/{id}                    → R10
POST /api/v1/aa/reviews                         → W9,W10
GET  /api/v1/aa/experiments/{id}                → R11
POST /api/v1/aa/experiments…                    → W11,W12,W13
GET  /api/v1/aa/changes?from=&to=               → R12
GET  /api/v1/aa/system-review?from=&to=         → R13,R15
POST /api/v1/aa/importance                      → W14
GET  /api/v1/aa/export                          → §16 (whole-account, incl. snapshot)
```

**Pagination:** R4, R12 and R13 grow without bound. Use **keyset pagination** on `(occurred_at, id)` — offsets drift as history is appended. Range parameters are mandatory, never defaulted to "all time".

**Layering:** R4 must return the layers the chart toggles (`expect`, `forecast`, `typical`, `events`) as **separate arrays**, never merged into one series — merging is the collapse hazard again, at the API boundary.

---

## 18. Migration / coexistence strategy `[AR]`

### 18.1 Division

| Stays in `user_snapshots` | Moves to semantic history | Dual (cache only) |
| --- | --- | --- |
| tasks, profile, dog, medication config, habits, quick notes, category overrides, goals, UI prefs | measurements, expectation/forecast versions, baselines, targets, preferences, observations, reviews, factors, decisions, experiments, adherence, acknowledgements, importance, cross-references | today's ≤3 signals, explicitly a cache, always recomputable |

### 18.2 What can be honestly migrated, and what cannot

| Existing data | Migratable? | Treatment |
| --- | --- | --- |
| `transactions[]` | **partially** | amount/date/category/`source` are genuine user data → import as `aa_measurements` with `source_kind` from `source` (`monobank`→`IMPORTED`, `manual`→`USER_REPORTED`). But `recorded_at` is **unknown** (never captured) → set `recorded_at = NULL` with an explicit `imported_recorded_at_unknown` provenance flag. Never fabricate it |
| `doseLogs` | **yes** | `taken_at` is a genuine instant. Import as measurements. Subject to §17 (health data is referenced, not generalised) |
| `pharmNotes` | **yes** | → `aa_observations`, `kind='mine'`, day granularity preserved as day granularity |
| `activityLog` | **NO — not as fact** | capped, prunable, no before→after, no provenance. Importing it as history would manufacture an audit trail that was never audited → **`[ODR]` D3** |
| `habits[].week` | **no** | a rolling 7-slot window with no dates; past weeks were already overwritten |
| `goals` | **no** | no dates, no estimates, nothing temporal to import |
| `MoneyWidget` budget | **no** | a hardcoded constant, not user data. There is no expectation history to migrate — **there never was one** |

**Binding rule:** *historical absence must be represented as absence.* No backfill of expectations, forecasts, baselines, targets, coverage or provenance. **New history begins at the deploy timestamp**, and surfaces must say so — the grammar already has the vocabulary (*«данные за период отсутствуют»*, `empty` delta cells, «не задавалась»).

### 18.3 Sequencing and compatibility

1. **Additive migration only.** New `aa_*` tables. **No change to `users`, `sessions`, or `user_snapshots`.** `schema_version` stays `2` and the `Literal[2]` in `apps/api/app/schemas/state.py` remains valid — so an old client and a new server interoperate unchanged.
2. **Deploy race:** server first (new tables + endpoints are invisible to old clients), client second. An old client that never calls `/aa/*` is fully functional throughout. Rollback = stop calling the endpoints; the tables are inert.
3. **Forward compatibility:** version the AA payloads independently (`aa_schema_version`) so AA can evolve without touching snapshot versioning.
4. **Frontend:** a **new** `AnalyticsRepository` alongside `ServerStateRepository`. `LifeDataContext` and `StateSyncCoordinator` are **not modified** in the foundation slices — this is what keeps the blast radius near zero.
5. **Existing accounts:** no state rewrite, no forced re-login, no import prompt. AA surfaces appear empty and truthfully say why.

---

## 19. Concurrency / idempotency analysis `[AR]`

### 19.1 Keep the existing mechanism for the snapshot

Compare-and-swap on `revision` is correct for a whole-document replace and is directly covered by `apps/api/tests/test_state_revision_conflict.py` (201 → 200 → 409 with `current_revision`). **Do not replace it.** No evidence suggests it is insufficient for what it guards.

### 19.2 Why AA writes must not use it

`stateSyncCoordinator.ts` on 409 sets `frozen = true` and stops syncing until manual recovery, which discards pending local state. Routing fact recording through that path means one concurrent write on a second device can silently stop LifeOS recording what happened — unacceptable for a system whose promise is auditable history.

**Recommendation:** AA history writes are **appends on a separate path**, not part of the snapshot document. Appends are naturally commutative — two devices recording two measurements do not conflict — so no CAS is needed. Where a specific row is mutated (correction, acknowledgement, adherence upsert), guard it with a predicate rather than a global counter:

```sql
UPDATE aa_measurements SET superseded_by_id = :new, status = 'superseded', superseded_at = now()
WHERE id = :target AND user_id = :u AND superseded_at IS NULL;   -- 0 rows ⇒ already corrected
```

### 19.3 Idempotency

Every append carries a **client-generated** `idempotency_key` (UUID v4), with `UNIQUE (user_id, idempotency_key)`. On conflict the server returns the existing row and `200` rather than creating a duplicate.

This closes the highest-risk failure mode in the whole design: a network retry after a successful-but-unacknowledged write would otherwise create **two genuine measurements** — precisely the "two real expenses" error the correction contract exists to prevent. It also makes offline replay safe.

Per-operation:

| Operation | Strategy |
| --- | --- |
| measurement / observation append | idempotency key |
| expectation / forecast version append | idempotency key (a genuine second version has a different key) |
| import batch | batch ID + per-row key → re-running an import is a no-op |
| correction | predicate CAS on `superseded_at IS NULL` |
| signal acknowledgement | upsert on `(user_id, signal_key)` — naturally idempotent |
| review save | idempotency key; revisions are appends |
| adherence | upsert on `(experiment_id, day)` — naturally idempotent |
| signal derivation | pure read; no writes, no idempotency concern |

### 19.4 Offline

Current AA-relevant behaviour: pending state is **in memory only**; `exportUnsaved()` exists because it can be lost. For *current state* that is a recoverable annoyance. For *fact recording* it is silent history loss → **`[ODR]` D5** (§24).

---

## 20. Retention / export / delete analysis `[AR]`

### 20.1 Account isolation

Mirror the proven pattern: `user_id NOT NULL` + `FK → users(id) ON DELETE CASCADE` on **every** `aa_*` table, every query filtered by the authenticated user, no user ID ever accepted from a request body. `apps/api/tests/test_state_isolation.py` already establishes both the rule (a body-supplied `user_id` is rejected 422) and the test pattern; AA needs the identical suite per table.

### 20.2 Export — a new obligation that must not be missed

Export today is `exportJSON()` serialising the in-memory state tree. **Under Option D, AA history is not in that tree.** Shipping AA without a server export endpoint would silently degrade an existing user-facing promise: "export" would quietly stop meaning "everything".

**Recommendation:** `GET /api/v1/aa/export` returning snapshot **and** full semantic history — including superseded rows, provenance, and tombstone records — as a streamed archive. Treat this as a **release blocker for the first slice that persists AA data**, not as later hardening.

### 20.3 Deletion — reconciling audit correctness with erasure rights

**"Append-only" must not come to mean "the user can never delete their information."** Three distinct operations:

| Operation | Retains | Removes | Use |
| --- | --- | --- | --- |
| **CORRECT** | both versions | nothing | the value was wrong |
| **TOMBSTONE** | existence, timestamps, provenance kind | the content/value | "remove this from my life", history stays coherent |
| **HARD DELETE** | nothing (optionally an anonymous counter) | the row and its dependents | erasure right |

Cascade rules for hard delete:

- Derived values: never stored, so nothing to clean.
- Signal acknowledgements referencing deleted inputs: delete with them.
- Reviews referencing deleted facts: the review **survives** (it is the user's own writing) and is annotated «источник удалён» — but whether erasure reaches into `frozen_context`, which physically contains the deleted values, is **`[ODR]` D1**.
- Account deletion: `ON DELETE CASCADE` already removes everything; the missing piece is an **endpoint** exposing it (none exists today).

### 20.4 Retention

The product already ships *«очистить историю старше»* for `activityLog`, so users have an existing expectation that history is theirs to clear. Whether that control extends to AA semantic history is **`[ODR]` D2** — it determines whether "No Silent History Loss" means *no loss at all* or *no loss that the user did not explicitly request*. `[INF]` The latter reading is consistent with the contract's spirit (the invariant targets *silent* loss) but this changes retention semantics and must not be decided silently.

---

## 21. Privacy / AI boundaries `[AR]`

### 21.1 Sensitive domains

Health and medication data are inspected here **only as existing implementation references** (`doseLogs` is the product's richest genuine time series and the best evidence of what temporal storage already looks like). No medical inference is designed, and `lib/medMath.js` logic is **not** generalised into the analytics layer. Domain-specific medication safety rules stay in the medication domain.

Technical requirements for future sensitive history: per-account isolation (§20.1), minimal collection (store what a surface renders, nothing speculative), export and deletion parity with every other domain, provenance on every fact, and no cross-domain inference without an explicit user-created reference (§16.3).

### 21.2 AI boundary

**AI is not part of this architecture.** Nothing in the accepted A–J package requires it: every «Выведено Life OS» value in the seed is a deterministic computation (*«Пересчёт по объёму и скорости за 14 дней»*, *«Сумма расходов за период минус корректировки»*), and all factor tags, decisions and interpretations are user-authored. `DERIVED` provenance means *computed*, not *generated*.

If AI is added later, the existing spine already carries most of what it would need, and the following must be non-negotiable: source record IDs, model + version, generation time, the generated text itself, stated uncertainty, user confirmation/edit state, and supersession. An AI suggestion enters as `HYPOTHESIS`-adjacent content **requiring user confirmation before it can become a fact**, and no AI output may ever populate a `desire` grounding or a causal relation. **AI suggestion ≠ fact. AI inference ≠ verified cause.**

---

## 22. Test / acceptance strategy `[AR]`

Defined, not written. Dependencies are **not installed** in this worktree (`apps/web/node_modules` and `apps/api/.venv` are both absent) and installing them is forbidden in this mode, so **no tests were executed**. The existing suites were read as evidence of the current contract.

Existing coverage (12 API tests + 25 web assertions across 6 suites): auth, session revocation, origin/content-type enforcement, body limit before JSON parsing, production cookie policy, **state CAS**, **snapshot isolation by user**, state migration, legacy import, repository and sync-coordinator behaviour.

### Future acceptance matrix

**Unit** — delta arithmetic per value type (money/date/duration/count/scale); as-of version selection; coverage with gaps and future days; materiality rules; **`desire` returns `neutral` when grounding is absent** (the freeze regression, made permanent); `NULL` decision ≠ `inconclusive`; unit never crosses in aggregation.

**Database** — account isolation per table; append-only enforcement; supersession chains; correction counted once; idempotency key rejects duplicates; ordering under equal timestamps; tombstone vs hard-delete cascade; `ON DELETE CASCADE` completeness.

**API** — history range + keyset pagination stability under concurrent appends; layers returned separately; provenance completeness; concurrent correction (second attempt sees 0 rows); auth/isolation on every AA endpoint; export includes superseded rows and tombstones.

**Frontend** — snapshot + history reconciliation; stale/partial/no-data rendering; **expectation never renders as desirability**; missing never renders as zero; signal acknowledgement survives reload; a review re-opened after a source correction shows frozen values plus the correction affordance.

**E2E** — Finance expectation history (3 versions, none deleted) → correction ₴12,000→₴1,200 → month total counts it once; Project forecast chain 20→24→26 with actual 25 and **both** deltas neutral; review save → reopen a year later → unchanged; experiment lifecycle including future-days-are-not-misses and a null decision; account isolation; export/delete round-trip.

---

## 23. Performance / query implications `[AR]`

### 23.1 Realistic personal scale

| Source | Per day | Per year | 5 years |
| --- | --- | --- | --- |
| Measurements (all domains) | 10–50 | ~11k–18k | ~55k–90k |
| Finance transactions | ~7 | ~2.5k | ~12k |
| Task/project events | ~50 | ~18k | ~90k |
| Observations (subjective) | 1–3 | ~700 | ~3.5k |
| Reviews | — | ~12–50 | ~250 |
| Experiments (+ adherence rows) | — | ~10 (+200 days) | ~50 (+1k) |
| **Total** | — | **~35k rows/yr** | **~180k rows** |

**Postgres treats this as small.** A few hundred thousand rows with correct indexes is well inside single-node, sub-millisecond territory. **Do not overengineer**: no partitioning, no time-series extension, no event-sourcing framework, no CQRS read stores, no materialised views until a measured query is actually slow.

### 23.2 Indexing

```sql
(user_id, subject_domain, subject_type, subject_id, occurred_at DESC)  -- R4 metric history
(user_id, recorded_at DESC)                                            -- as-of + freshness
(user_id, occurred_at) WHERE status = 'active'                         -- partial: skips superseded
UNIQUE (user_id, idempotency_key)                                      -- retry safety
(user_id, signal_key)                                                  -- acknowledgement lookup
```

### 23.3 Payload and fetch strategy

- **Snapshot stays small** — the 5 MiB cap stops being load-bearing once history moves out. This alone resolves the growth risk in the current design (`activityLog` at cap already budgets ≈750 KB).
- **Never fetch all history.** Every AA read is window-scoped; the metric chart fetches a range, the history list pages by keyset.
- **First paint:** Home may read a small cached signal set from the snapshot, then reconcile against a derived fetch. Cache, never evidence.
- **JSONB vs relational:** relational for facts (queried, indexed, joined); JSONB **only** for `frozen_context` (opaque, written once, read whole) and free-form provenance `basis` overflow. This is the inverse of today's arrangement, and deliberately so.

---

## 24. Owner decisions required `[ODR]`

Five. Each changes product semantics, privacy behaviour, irreversible history behaviour, or major architecture cost. Ordinary engineering choices have been decided in this report, not escalated.

---

### D1 — Does hard deletion reach inside frozen review context?

**Question.** A review freezes the values it was written against (§14). If the user hard-deletes a source record, must the frozen context be redacted too, or does the review keep what it displayed at the time?

**Why it matters.** Determines whether erasure is complete, and determines the schema: a review that must be redactable cannot store raw values — it must store references plus a verification hash, which materially weakens historical stability.

- **Option A — Erasure wins.** Redact frozen context on hard delete; the review shows «источник удалён». Complete erasure; the review becomes partly unreadable.
- **Option B — Frozen context is the user's own record.** Keep it; hard delete removes only the source fact. Reviews stay stable; deleted values survive inside them.
- **Option C — Ask at deletion time**, per review, defaulting to redact.

**Recommendation: A**, with the review preserved and annotated. Erasure should mean erasure; a review that says «источник удалён» is honest, and the user's own free text — the part that matters most — is untouched.
**Trade-off:** some old reviews lose their numeric context.
**Blocks:** review schema (Slice 5) and the deletion cascade (Slice 0b).

---

### D2 — Does «очистить историю старше» apply to AA semantic history?

**Question.** The product already ships a Settings control that prunes `activityLog` by age. Does that control extend to Adaptive Analytics history?

**Why it matters.** It decides what "No Silent History Loss" means. If retention is user-configurable, the invariant is *"no loss the user did not explicitly request"* — a different and weaker guarantee that must be stated on screen, because a pruned window makes «что повторилось» and baselines quietly unavailable.

- **Option A — AA history is exempt.** Only correction/tombstone/hard-delete remove AA facts. Strongest invariant; the existing control keeps its narrower meaning.
- **Option B — One control covers both**, with an explicit warning naming what will become underivable.
- **Option C — Separate AA retention setting**, defaulting to unlimited.

**Recommendation: C.** Preserves the invariant by default, keeps the user's existing expectation that history is theirs, and makes any loss explicit and separately chosen.
**Trade-off:** one more setting.
**Blocks:** retention design (Slice 0b) and the on-screen wording of data-quality copy.

---

### D3 — What happens to the existing `activityLog` at cutover?

**Question.** ~5000 capped, prunable, provenance-free entries exist per active account. Discard, import as a marked legacy stream, or leave in place?

**Why it matters.** Importing it as semantic history would manufacture an audit trail that was never audited — it has no before→after values and no provenance — and would make the first months of AA history look richer than the evidence supports.

- **Option A — Leave in place, do not import.** AA history starts at deploy. Cleanest honesty; the old timeline UI keeps working unchanged.
- **Option B — Import as a read-only `imported_legacy` stream**, visibly distinct, never usable as expectation/forecast/baseline evidence or as review grounding.
- **Option C — Discard.**

**Recommendation: A**, with B available later if users ask. `activityLog` continues to serve the existing timeline; AA states plainly that its history begins at deploy.
**Trade-off:** AA surfaces are empty for a while — which is the truth.
**Blocks:** migration scope (Slice 8) and first-run copy.

---

### D4 — Is `ABANDONED` a real experiment lifecycle state?

**Question.** The accepted package defines exactly four states (`draft`, `running`, `review`, `decided`). Can a user abandon an experiment mid-run?

**Why it matters.** Small but genuinely product-semantic, and it must not be invented. An abandoned experiment is not a completed one with no decision — treating it as `review` forever would leave a permanent, misleading "ждёт вас" item on System Review.

- **Option A — Add `ABANDONED`.** Requires a small UX addition (an abandon action, and how the history row reads).
- **Option B — Keep four states.** Abandonment is expressed as completion with `decision = 'reject'` or no decision at all.

**Recommendation: A**, because System Review counts pending experiments and an abandoned one would otherwise nag indefinitely — but this is a **UX addition** to a frozen package and is therefore the owner's call, not an inference.
**Trade-off:** a small extension to accepted design.
**Blocks:** experiment schema enum (Slice 6).

---

### D5 — Must AA fact recording survive going offline?

**Question.** Today, unsynced state lives in memory only and can be lost when the tab closes (`exportUnsaved()` exists precisely because of this). For *facts*, is that acceptable?

**Why it matters.** A measurement recorded offline and then lost is silent history loss at the moment of observation — the one place the contract is least willing to tolerate it. Fixing it means a durable client-side queue (IndexedDB) with replay, which is real client work.

- **Option A — Durable offline queue.** IndexedDB + replay on reconnect, deduplicated by the idempotency keys already required (§19.3). Facts are never lost.
- **Option B — Online-only recording.** AA write UI is disabled offline, with an explicit reason. Cheap and honest; degrades mobile use.
- **Option C — Best-effort in memory** (today's behaviour) with a visible warning.

**Recommendation: A**, deferred to the slice that first accepts user-entered facts (Slice 2), not required for Slice 0. The idempotency design already makes replay safe, so the incremental cost is the storage layer alone.
**Trade-off:** meaningful frontend work; an offline queue needs its own tests.
**Blocks:** Slice 2 acceptance; Option B would need product copy.

---

## 25. Risks

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| R1 | **Desirability leaks from expectation.** The freeze note records this exact bug occurring three times inside the accepted package itself | **High** | Physically separate `aa_targets`/`aa_preferences`; `desire` derivation takes grounding-or-null and never reads sign; permanent unit test |
| R2 | **Actual drifts into the forecast collection** — already visible in the seed's `forecasts[].actual` flag | **High** | Separate tables; API returns layers as separate arrays; counts never filter |
| R3 | **Snapshot conflict freeze halts fact recording** if AA writes ride the snapshot path | **High** | Separate append endpoints (§19.2) — the central reason Option D wins |
| R4 | **Retry duplicates a measurement**, creating two genuine expenses | **High** | Mandatory idempotency keys with a unique constraint |
| R5 | **Export silently stops meaning "everything"** once history leaves the snapshot | **High** | Server export endpoint as a release blocker for the first persisting slice |
| R6 | **Backfill fabricates history** from `activityLog` | High | D3; binding no-backfill rule; new history begins at deploy |
| R7 | **A review silently changes** after a source correction | High | Freeze + reference, with a correction affordance (§14.2) |
| R8 | **Missing rendered as zero** in coverage or charts | Medium | Coverage denominators stored; no zero-fill; explicit future-day handling |
| R9 | **G · Project has no domain to analyse** — no project entity exists at all | Medium | Sequencing (§26); Finance leads; Project needs a domain prerequisite |
| R10 | **Schema sprawl** — ~12 tables for one feature | Medium | Shared column template; generated migrations; scale analysis shows the cost is structural, not operational |
| R11 | **Demo chrome leaks into production** (`.aa-phone`, `.aa-shell`, `.aa-rail`, `.aa-stage*`) | Low | README names them explicitly; lint rule on the AA CSS namespace |
| R12 | **A composite score creeps in** via a well-meaning summary | Medium | No cross-unit numeric type exists; unit mandatory on every value |
| R13 | Timezone drift corrupts day-granularity coverage | Medium | `occurred_tz` stored alongside `occurred_at` (§11.4) |

---

## 26. Recommended implementation slices — DISCOVERY ONLY, do not execute

Reordered from the candidate sequence on two pieces of evidence: **export/delete must precede history accumulation**, and **G · Project has a prerequisite outside AA**.

| Slice | Scope | Backend | Frontend | Migration | Tests | Depends on | Acceptance gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **0** · History foundation | bitemporal spine, provenance, supersession, idempotency, isolation | `aa_metric_definitions`, `aa_measurements`; `POST /aa/facts`, `/correct`; auth+isolation | none | 1 additive | DB + API isolation, append-only, idempotency, supersession | — | A measurement can be recorded, corrected, and read back as-of any date; snapshot untouched |
| **0b** · Export & delete | erasure + export **before** personal history accumulates | `GET /aa/export`, `DELETE /aa/facts/{id}`, account delete | export UI wiring | — | export completeness incl. superseded + tombstones | 0 | Full round-trip export/delete; export still means "everything" |
| **1** · Shared semantics | expectation/forecast/baseline/target/preference tables; AA primitives ported (minus demo chrome) | 5 tables + endpoints | `AADelta`, `AAFacts`, `AAProvenance`, `AAQualityStrip`, `AAHistoryList` | 1 additive | `desire` grounding, unit correctness, layer separation | 0 | C renders all 7 accepted variants from real data; expectation never yields desirability |
| **2** · Finance pilot (F, C, D) | expectation versions, corrections, coverage, quality strip, real budget | history + quality endpoints | Finance surfaces; **offline queue per D5** | 1 | E2E: 3 versions, correction counted once | 1, D5 | The accepted F screen renders from stored facts; `MoneyWidget`'s hardcoded `budget = 300` is retired; a transaction correction path exists |
| **3** · Signals + Home (A, B) | derivation engine, acknowledgement, freshness | rules, `signal_key`, ack endpoint | Home section, `AASignalCard` | 1 | dedup, reappearance, post-correction, ack persistence | 2 | All 6 B states from real data; Home shows 0–3; ack survives reload |
| **4** · Review (E) | frozen context + correction affordance | reviews, factors, decisions | 5 optional steps | 1 | reopen-after-correction stability | 2, 3 | A review reopened after a source correction shows frozen values **and** the correction |
| **5** · Project pilot (G) | forecast versions, two coexisting deltas | forecast endpoints | Project surfaces | — | E2E forecast chain | 4 + **project-domain prerequisite** | «версий прогноза 3 · факт отдельно»; both deltas neutral |
| **6** · Experiment (I) | lifecycle ⊥ outcome, per-day adherence | experiments, adherence, observations | Experiment surface | 1 | null-vs-inconclusive, future-days | 4, D4 | Future days never render as misses; no decision is a valid end state |
| **7** · Trade-off + System Review (J) | cross-domain window queries, importance, groundedness join | changes + system-review endpoints | J surfaces | 1 | no cross-unit aggregation possible | 5, 6 | «улучшилось» is empty without grounding; contradictions coexist; no score exists anywhere |
| **8** · Hardening | retention (D2), legacy treatment (D3), performance | retention jobs | settings | 1 | retention, scale | all | Retention behaves as decided; no silent loss |

### 26.1 The G · Project prerequisite

**G cannot be built as an analytics slice alone.** There is no project entity anywhere in the product: `goals` carry `{id, title, pct, val, tag}` with no dates, no estimates and no completion facts. G requires *first estimate recorded 12 Aug*, *three forecast revisions*, and *an observed completion* — none of which has a domain to attach to.

Options: (a) build a minimal Project domain first (outside AA scope); (b) reorder so a second pilot uses a domain with real temporal data — **Habits** is the natural candidate (`toggleHabitToday` already produces dated events, and unlike medications it carries no §21 sensitivity); (c) defer G. This is flagged for Phase B planning, not decided here.

---

## 27. Phase B prerequisites

Before an implementation plan can be written:

1. **Owner decisions D1, D2, D3 resolved** — they shape the review schema, retention semantics and migration honesty. D4 and D5 can be resolved later (they block Slices 6 and 2 respectively).
2. **G · Project sequencing chosen** (§26.1).
3. **Metric definition catalogue drafted** — which subjects get AA treatment first, with unit kinds and value types. Finance expenses is the obvious first; the rest is a product call.
4. **Stakes trigger list confirmed.** The accepted seed cites *"trigger #7: budget ≥ 80%"*, implying an established list of eight. That list is **not present in this repository** and must be located or authored before Slice 3.
5. **Development environment reproducible** — `apps/web/node_modules` and `apps/api/.venv` are absent here, so no test baseline could be established.
6. **Signal rule catalogue** — the rules, their versions, and their materiality thresholds.

---

## 28. Explicitly NOT touched

- **No application code changed.** No file under `apps/` was modified — verified by `git diff --stat HEAD -- apps/` (empty) at start and end.
- **No database changed.** No connection was opened; no migration created, run, or reverted; no query executed against any database.
- **No dependencies installed.** `node_modules` and `.venv` remain absent; **no tests were executed**.
- **No commits, no pushes, no tags, no deploys.** HEAD is unchanged at `d496028`.
- **No Git state altered.** No checkout, switch, reset, merge, rebase, stash, or clean.
- **`.DS_Store` left exactly as found** — pre-existing modification, treated as user-owned.
- **No A–J UX redesigned.** One item (`ABANDONED`) that would extend accepted UX is raised as an owner decision rather than adopted.
- **No design-package files modified.** `ui_kits/life-os-analytics/**` read only.
- **No external service contacted.**
- **Only new files created:** this report and its summary, under `Outputs/`.

---

## 29. Evidence anchors

| Claim | Anchor |
| --- | --- |
| One row per user; whole-document replace | `apps/api/app/models/user_snapshot.py` (`user_id` PK) |
| `revision` is CAS, not versioning | `apps/api/app/services/state.py` (`UPDATE … WHERE revision = :expected`) |
| Confirmed by test | `apps/api/tests/test_state_revision_conflict.py` (201→200→409) |
| Three tables, one migration | `apps/api/alembic/versions/20260721_0001_create_accounts_and_snapshots.py` |
| 5 MiB body cap, pre-parse | `apps/api/app/middleware/body_limit.py`; `config.py` `max_snapshot_bytes = 5_242_880` |
| Seven endpoints total; no export/delete/history | `apps/api/app/routes/{health,auth,state}.py` |
| Conflict freezes all syncing | `apps/web/src/repositories/stateSyncCoordinator.ts` (`frozen = true` on 409) |
| Offline pending is memory-only | same file (`pending`), plus `exportUnsaved()` in `LifeDataContext.jsx` |
| `activityLog` capped at 5000, FIFO | `apps/web/src/lib/activity.js:31,~50` |
| `activityLog` user-prunable | `LifeDataContext.jsx:642`; `LocaleContext.jsx:617` («очистить историю старше») |
| Edits record only new values | `LifeDataContext.jsx:420` (`updateTask`), `:624` (`editPharmNote`) |
| **Budget is a hardcoded constant** | `apps/web/src/components/MoneyWidget.jsx:30` — `const budget = 300;` |
| No transaction edit/delete path | `LifeDataContext.jsx` exported value object (`addTransaction`, `toggleTransactionInclusion`, `toggleCategoryInclusion` only) |
| Totals have no coverage concept | `apps/web/src/lib/finance.js` (`sumIncluded`) |
| Nascent provenance on transactions | `LifeDataContext.jsx:156` seed — `source: 'monobank' \| 'manual'` |
| `doseLogs` is the only real time series | `LifeDataContext.jsx:564` (`takeDose`, `taken_at` ISO) |
| Medication soft-delete precedent | `LifeDataContext.jsx:548` (`status: 'archived'`) |
| Zero analytics code in product | `grep -rn "analytic" apps/web/src apps/api/app` → no matches; `apps/web/src/app/routes.js` |
| Account isolation pattern + test | `apps/api/tests/test_state_isolation.py` |
| Snapshot schema pinned to v2 | `apps/api/app/schemas/state.py` (`Literal[2]`) |
| A–J accepted and complete | `ui_kits/life-os-analytics/README.md` — status table, *"Nothing in this layer is outstanding."* |
| Expectation ≠ desirability; freeze corrections | README §"Final semantic guardrails applied at freeze" |
| «версий прогноза» filter hazard | README — `forecasts.filter(f => !f.actual)` |
| `AADelta` vs `AAFacts` semantic ownership | `primitives.jsx` component comments; README §"Visual reuse vs semantic ownership" |
| Epistemic tag vocabulary | `primitives.jsx` — `AA_KINDS` |
| Experiment lifecycle values | `data.js` (`status: 'draft'·'running'·'review'·'decided'`); `experiment.jsx` (`AAExpStages`) |
| Decision values; `null` = no decision | `experiment.jsx` choice list; `data.js` `decision: null` |
| Future days ≠ missed days | `experiment.jsx` (`AAAdherence`) |
| Grounded improvement rule | `data.js` `systemReview.improved[].basis`; `system.jsx` warn note |
| Overlap ≠ causation | `data.js` change `c6` — «связь не установлена» |
| Demo chrome exclusions | README §"Preview-only techniques" |
| `ARCHITECTURE.md` is stale | its own header (Sprint 3.6, June 11 2026) vs the current Vite/FastAPI/Postgres stack |
| Forensic artifacts absent | `ls -d export_claude_lifeOS` → absent; `find … -name _lifeos_forensic` → none |
| Dependencies absent (no tests run) | `apps/web/node_modules`, `apps/api/.venv` both absent |

---

## Completion status

`DISCOVERY_STATUS = COMPLETE`
`TARGET_ARCHITECTURE_READY = YES` — one recommendation (Option D · hybrid), argued from three specific properties of current code: the conflict-freeze in `stateSyncCoordinator.ts`, the pre-parse 5 MiB snapshot cap, and the complete absence of existing analytics code to migrate.
`PHASE_B_PLAN_READY = NO` — D1/D2/D3 shape schema, deletion and migration honesty; the G · Project pilot has a prerequisite outside Adaptive Analytics. **Slices 0, 0b and 1 are fully plannable today.**

`APPLICATION_CODE_CHANGED = NO` · `DB_CHANGED = NO` · `COMMIT = NO` · `PUSH = NO` · `DEPLOY = NO`
