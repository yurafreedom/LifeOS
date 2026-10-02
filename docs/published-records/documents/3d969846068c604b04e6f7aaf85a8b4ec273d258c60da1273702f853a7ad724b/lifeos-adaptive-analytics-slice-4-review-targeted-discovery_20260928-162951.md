# LifeOS — Adaptive Analytics Slice 4 · Review / Debrief — Targeted Discovery

Discovery · 2026-09-28 16:29 (Europe/Kyiv local clock)

---

## 1. Start state (verified live, not trusted from the prompt)

| | |
| --- | --- |
| Checkout | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` — the only worktree |
| Start branch | `main` |
| `HEAD` = `origin/main` | `ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef` (PR #11, first parent `99f0709` = Slice 3 merge) |
| Drift vs. prompt | **none** — `git fetch origin --prune` + `merge --ff-only` reported "Already up to date" |
| Porcelain | empty |
| Recovery stash | `stash@{0}` = `51184836ace557fbd9492527bd845329b17b2a76` (object type `commit`), untouched |
| Frozen tag | `adaptive-analytics-design-accepted` → tag object `6c507b82…`, target `d4960286…` — unchanged |
| Slice 4 already on main? | **No.** No `aa_review*`/`aa_decisions` model, migration, route or page exists. Precondition holds |
| Feature branch | `feat/adaptive-analytics-slice-4-reviews` (created from `ea3a75e`) |

`git diff adaptive-analytics-design-accepted HEAD -- ui_kits/ preview/` shows one
changed file, `ui_kits/life-os/LifeDataProvider.jsx` (the general kit, not the
analytics kit). The analytics kit and `preview/aa-*.html` are byte-identical to the
tag. Frozen files are read with `git show adaptive-analytics-design-accepted:<path>`.

**Path casing.** The prompt names `Outputs/Discoveries|Plans|Implementations`; Git
tracks exactly those capitalised directories (the macOS FS is case-insensitive, so
`ls` shows lowercase). Artifacts are written to the tracked capitalised paths.

## 2. Baseline (before any change)

| Check | Result |
| --- | --- |
| `apps/api: python -m pytest` | **324 passed**, 10 warnings (54.9 s) |
| `apps/api: ruff check .` | All checks passed |
| `apps/api: alembic heads` | `20260928_0005 (head)` |
| `apps/api: alembic current` | `20260928_0005 (head)` |
| `apps/web: npm test` | **214 passed** (23 files) |
| `apps/web: npm run typecheck` | clean |
| `apps/web: npm run lint` | clean |
| `apps/web: npm run build` | 110 modules · JS 469.99 kB (136.84 gzip) · CSS 142.37 kB |

Database: `lifeos_test` only (`postgresql+psycopg://<local-user>@127.0.0.1:5432/lifeos_test`,
local trust auth, supplied by env var at invocation). `lifeos_dev` was listed by
`psql -l` but never connected to. Matches the accepted Slice 3 report exactly.

## 3. Documents read

`AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md` (§§7–15, 22–23, 36–38, 43–54);
Phase B Plan §3, §7, §9, §10, §11.3–11.4, **§12 (Review storage)**, §21.2, §22,
**§24.6 (Slice 4)**, §25; Slice 3 implementation report (full); frozen kit
`README.md`, `screens.jsx` (E · `AAReview`), `primitives.jsx` (`AA_KINDS`,
`AAFactorTag`), `experiment.jsx` (choice list), `analytics.css`.

## 4. Exact `aa_*` inventory after Slice 3

13 mapped tables = 13 export entries = 13 real DB tables:

```
aa_metric_definitions (seeded reference)   aa_measurements          aa_source_coverage
aa_deletion_receipts                       aa_expectation_versions  aa_forecast_versions
aa_baselines   aa_targets   aa_preferences  aa_observations
aa_metric_policy_versions   aa_metric_membership_overrides           aa_signal_episodes
```

Every account-owned table has `user_id → users.id ON DELETE CASCADE`
(`AAOwnedMixin`), asserted by `test_all_analytics_tables_exist_with_a_cascade_from_users`.

## 5. Export / erasure mechanics

- `app/services/export.py::EXPORT_TABLES` — explicit dict. `validate_export_registry()`
  asserts **mapped `aa_*` == registry**; `build_account_export` additionally asserts
  **registry == real `aa_%` tables in `information_schema`**. A new table that is not
  registered fails export loudly — exactly the invariant the prompt requires.
- `tests/conftest.py::TRUNCATED_TABLES` + `test_every_mapped_table_is_either_cleaned_or_seeded`
  guard test-state leakage for any new mapped table.
- Account deletion is the `users` FK cascade; there is no per-table erasure code to
  extend. New tables need `user_id … ON DELETE CASCADE` and, for children,
  `review_id … ON DELETE CASCADE`.
- `tests/test_export.py` asserts `manifest["alembic_revision"]` — must be bumped to M5.

## 6. `aa_deletion.py` behaviour today

- `FACT_TABLES` = the 8 `SEMANTIC_TABLES` (6 concepts + policy + override) +
  `aa_measurements` + `aa_source_coverage`.
- `delete_fact(mode="hard")`, **one transaction**: refuses any fact inside a correction
  chain (`DeletionConflictError`, 409); redacts dependent `source_ref` provenance;
  for a measurement also redacts provenance referencing its cascading membership
  overrides; calls **`redact_source_context(db, user_id, table_name, fact_id)`** — the
  Slice 0b hook, today iterating an **empty** `SOURCE_REDACTORS` tuple; deletes the row;
  inserts a content-free `aa_deletion_receipts` row; commits. Any exception → rollback.
- `mode="tombstone"` nulls value columns *in place* on the source row and keeps it.
- The docstring contract for the hook: "adapters must erase source-derived content in
  the supplied transaction. They must not commit, log content, or retain a deleted value."

### Transactionally safe Review redaction — finding

The hook is exactly the right seam. A Review redactor registered in
`SOURCE_REDACTORS` runs **inside** `delete_fact`'s transaction before the source row is
deleted and before commit, so a failing redaction rolls back the deletion, and a
successful deletion can never commit with residue. Two additions are needed:

1. The membership overrides that cascade with a hard-deleted measurement are sources
   of derived Finance values too; the hook must also be called for those dependent ids
   (today only their *provenance* is redacted).
2. A derived Review value (monthly spend, delta) has **many** sources. Plan §12's single
   `source_fact_id` column cannot express that. See §13 (drift D-2).

## 7. Detecting later corrections beside frozen values

Every fact table carries `status`, `superseded_at`, `superseded_by_id`,
`supersede_kind ∈ {CORRECTION, REVISION}`, `tombstoned_at`. A frozen item that keeps
`(source_table, source_fact_id)` links can therefore be classified at read time by an
ordinary lookup, never by re-deriving the value:

| Source state now | Flag | Frozen value |
| --- | --- | --- |
| active | — | shown |
| superseded, `CORRECTION` | **later corrected** («данные позже исправлены»), current chain-head value shown beside for single-source items | unchanged |
| superseded, `REVISION` | **later revised** («позже появилась новая версия») — kept distinct: *correction ≠ legitimate revision* | unchanged |
| `tombstoned` | **source withdrawn** — plan §11.4 scopes redaction to HARD delete only; tombstone keeps existence | unchanged |
| row gone (hard delete) | **redacted** at delete time («источник удалён») | **erased** |

A hard delete inside a correction chain is refused today, so "corrected" and
"hard-deleted" can never be the same source — the states cannot collide.

## 8. `AnalyticsWriteQueue` capability for a compound Review save

- One queue record = one `route` + one JSON `payload` + one idempotency key minted at
  enqueue time; strict FIFO, single-flight, IndexedDB-durable; 400/422 → visible
  `failed_permanent`; **409 → visible `terminal_conflict`, record retained with
  export/discard** (already surfaced in `FinanceAnalytics`' `QueueFailures`).
- A compound Review (text + factors + decision + context reference) fits **one** record
  and **one** POST. No queue change is needed; the queue is payload-agnostic.
- `replayQueuedWrite` requires the route under `/api/v1/aa/` and
  `payload.idempotency_key === record.idempotency_key` — satisfied by a Review POST.

### Should Review be one server transaction? — **Yes**

Header, context items, their source links, text, factors and decision must commit
together or not at all; a partial Review would show the user something they never
authored. One POST → one DB transaction → idempotent replay by key.

### How the server freezes "what the user saw" without trusting client values

`GET /reviews/context` returns the items plus `context_as_of` and a
`context_fingerprint` (sha256 over the canonical item content and source ids). The
save carries back **only** `context_as_of` + `context_fingerprint`. The server re-derives
the context **as of `context_as_of`** with the existing bitemporal predicate
(`known_as_of_predicate`, `monthly_spend_inputs(as_of=…)`), compares fingerprints and
persists the server-derived items. Client-supplied values are never stored.

- Offline replay days later still reproduces the identical context, because as-of
  reconstruction ignores anything recorded after `context_as_of`.
- If the reconstruction differs (a source was hard-deleted or tombstoned in between, or a
  transaction-visibility race), the save is **409 `review_context_changed`** → visible
  `terminal_conflict` in the queue with the user's text retained and exportable. Nothing
  is silently saved against a context the user did not see.

## 9. Provenance / read APIs usable for Review context

| Existing code | Reuse for Review |
| --- | --- |
| `services/aa_finance.py::monthly_spend_inputs` + `derive_month` | Finance period Actual (derived) and its **exact input ids**, current Expectation, current Target (incl. explicit absence), delta, desirability, coverage — all as-of |
| `services/aa_coverage_claims.py::coverage_report_for_window` | frozen coverage buckets for `AAQualityStrip` |
| `analytics/asof.py::apply_as_of` | every direct fact read |
| `analytics/delta.py::compute_delta`, `services/aa_desirability.py::desirability` | Project date delta; desirability **only** from a Target (never Expectation/Forecast) |
| `AAForecastVersion`, `AAMeasurement` for `project.completion_date` | Project latest forecast (Expectation role) + Actual |
| `AAObservation` in window | "рядом" items for step 4 |
| `GET /aa/facts/{table}/{id}/provenance` | not needed — provenance is frozen onto items |

## 10. Route / navigation entry points

- Hash router in `App.jsx` (`#/<route>`); `LIFE_ROUTES` in `app/routes.js`; analytics
  routes are gated by `ANALYTICS_ROUTE_ENABLED` (test mode or `VITE_LIFEOS_ANALYTICS_ENABLED`).
- Precedent for a parameterised route: `medications/<id>` — `readRouteFromHash`
  dispatches the prefix and the page reads its own id from the hash. Review can use
  `#/review/…` the same way.
- Entry points per the frozen flow map: Project → «открыть ревью» (primary when the
  project is completed); Finance → «открыть ревью месяца» (ghost, optional).
  `ProjectCard.jsx` and `FinanceAnalytics.jsx` are the seams.
- Frozen Home also shows a «Доступно ревью» (`sig-review`) **signal**. See §12.

## 11. Component reuse

| Component | Status | Use in Review |
| --- | --- | --- |
| `AADelta` | exists; takes `(summary, comparison)` | step 1, fed from frozen items |
| `AAFacts` | exists | step 4 «рядом» items, target |
| `AAQualityStrip` | exists; takes a coverage report | step 1, rebuilt from frozen coverage items |
| `AAProvenance` | exists | each frozen item |
| `AAHistoryList` | exists; takes fact-like rows | saved confirmation + review history |
| `AAFactorTag` | **missing** — frozen kit only | new production component (explicit menu, keyboard) |
| CSS `.aa-factor .aa-menu .aa-choice-btn .aa-steps .aa-step-dot .aa-textarea .aa-tradeoff .aa-btn .aa-actions .aa-help .aa-field .aa-quiet` | **not yet ported** | port from frozen `analytics.css`, excluding demo chrome |

The existing primitives hardcode Russian labels (Slice 2 debt). The prompt requires
RU/UK for this slice, and the Review page renders these primitives, so their labels
must become locale-aware (reading `LifeLocaleContext`, falling back to `ru` when no
provider is mounted so existing tests and pages are unchanged).

## 12. Conflict with the exact-four Signal catalogue — **none, by omission**

The frozen A · Home seed includes a «Доступно ревью» card (`sig-review`), and plan
§24.6 lists "Slice 3 for the review-available signal" as a precondition. Implementing
it would be a **fifth rule**, which the accepted catalogue forbids without an owner
decision. Slice 4 therefore ships **no** review-available signal; Review is reached
from the domain surfaces (§10). A test asserts the catalogue is still exactly four.

## 13. Drift from the old Phase B Plan

| # | Plan said | Current reality / decision | Why it is not an owner decision |
| --- | --- | --- | --- |
| D-1 | M5 = `aa_0006_reviews`, down_revision M3 | Chain convention is `<date>_<ordinal>`; head is `20260928_0005`. M5 = **`20260928_0006_aa_reviews`**, down_revision `20260928_0005` | naming follows accepted history |
| D-2 | one `source_fact_id` per context item | Derived items (monthly spend, delta, coverage) have many sources; D1 requires a derived value be erased when **any** contributing fact is hard-deleted. Add normalized link table **`aa_review_context_sources`** `(item_id, source_table, source_fact_id)`, index `(user_id, source_fact_id)` | implements accepted D1 + C4 ("normalized, not JSONB"); a `uuid[]` column would be the less-normalized alternative |
| D-3 | `aa_reviews.free_text`; "text appendable; nothing overwrites in place" | A single column cannot be appended without overwriting. Add **`aa_review_revisions`** (one row per save/revise, carries that act's text + idempotency key). Factors/decisions reference the revision that added/retracted/superseded them | implements accepted "revisable later / never silently rewritten" |
| D-4 | decision choices unspecified for review scope; T-08 "NULL ≠ inconclusive" in Slice 4 | E screen: keep / adjust / later / «Пока без решения»; README: the Review choice list carries «Непонятно — данных недостаточно» as a first-class outcome. Review vocabulary = **`keep · adjust · later · inconclusive`** + **NULL** («Пока без решения» / skipped). M6 later widens the CHECK for experiment scope | reconciles frozen E + frozen README + plan T-08; nothing invented |
| D-5 | "Slice 3 for the review-available signal" | not built — would be a fifth rule (§12) | catalogue rule is explicit |
| D-6 | four endpoints | plus `GET /api/v1/aa/reviews?subject=` (bounded list) so a saved Review can be found and reopened | a read; needed for "reopens identically" to be reachable in the product |
| D-7 | trade-off step shows cost rows | No cost/trade-off facts exist yet (Slice 7). Step 4 shows the subject's **real** observations in the window as juxtaposed facts, else an honest empty line; never invented values | "no demo data as runtime truth" |
| D-8 | tombstone | plan §11.4: only HARD delete redacts review context; tombstone keeps the frozen value and flags «источник позже отозван» | plan is explicit |

## 14. Owner decisions

None required. Every open point above is resolved by accepted semantics, the frozen
design, the Phase B plan or current code (authority order, master context §14).

```
DISCOVERY_STATUS=PASS
OWNER_DECISION_REQUIRED=NO
IMPLEMENTATION_PLAN_ALLOWED=YES
```
