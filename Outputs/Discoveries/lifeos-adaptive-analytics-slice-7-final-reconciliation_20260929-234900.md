# LifeOS · Adaptive Analytics · Slice 7 — Final Reconciliation (post Slice 6 + Calendar)

**Generated:** 2026-09-29 · Claude Code (Opus 5.5) · canonical checkout, branch
`feat/adaptive-analytics-slice-7-system-review-intelligence`
**Reconciles:** `/Users/yurasachenko/LifeOS/_parallel_planning/slice7/`
(`…-reconciled-discovery.md`, `…-provisional-plan.md`, `…-owner-decisions.md`;
baseline `414df142700653d616016ff644bff3d9c0007540`) **against current main**.
The historical provisional files are not modified; this file supersedes them where
they conflict. Authority: latest owner decisions (Slice 7 master prompt, 2026-09-29)
> current merged code > accepted reports > Phase B Plan > provisional planning.

---

## 1. Live state

| Item | Value |
|---|---|
| `main` = `origin/main` | `fffcd4b3d7edaefa87a1b117634c8bfad7caf6d9` (Merge PR #17, Calendar cube redesign) |
| Contains Slice 6 (PR #16) | YES — M6 `20260929_0007`, `aa_experiments*` |
| Contains Calendar (PR #17) | YES |
| Working tree | clean, one worktree (canonical checkout) |
| Recovery stash | `51184836ace557fbd9492527bd845329b17b2a76` (stash@{0}) retained |
| Frozen tag | `adaptive-analytics-design-accepted` → tag `6c507b82…` → commit `d4960286…`, unmoved |
| Commits since `414df14` | 17 (Slice 6, Calendar and their docs); 103 files, +14 147 / −910 |

## 2. Baseline (actual, before any production change)

| Check | Result |
|---|---|
| backend `python -m pytest` (`lifeos_test`) | **602 passed**, 20 warnings (pre-existing deprecations) |
| `ruff check .` / `compileall app` | pass / pass |
| `alembic heads` / `current` | `20260929_0007 (head)` / `20260929_0007 (head)` |
| DB `aa_%` tables | **22** (= mapped = `EXPORT_TABLES`) |
| Signal rules | **4** (`finance.monthly_spend.threshold`, `project.forecast.revision`, `data.source.stale`, `coverage.window.partial`) |
| frontend `npm test` | **495 passed / 39 files** |
| typecheck / lint / build / build --manifest | pass / pass / pass / pass |
| entry JS | 319.72 kB (96.93 kB gzip), no 500 kB warning |
| import cycles (static, module-level) | backend 0, frontend 0 |
| `LIFE_ROUTES` (test mode) | 21 |

## 3. What changed since the provisional baseline (`414df14`)

Slice 6 (M6 + service + UI) and the Calendar cube redesign. Shared files touched by
both and relevant to Slice 7: `main.py` (+1 router), `services/export.py` (+3 tables),
`services/aa_deletion.py` (+`aa_experiment_observations` in `FACT_TABLES`),
`tests/conftest.py` (+3 truncated), `App.jsx`, `app/routes.js`,
`app/routeRegistry.js`, `app/lazyRoutes.jsx`, `Sidebar.jsx`, `locale/{ru,uk}.js`.
Calendar added the `calendar/…` sub-route grammar and `components/useDialog.js`
(stacked dialogs, focus trap) — reusable by Slice 7 dialogs. Calendar did **not**
touch AA code, queue, CSS of analytics, or Alembic.

## 4. Slice 6 dependencies — all closed

`OLD_ASSUMPTION → CURRENT_REALITY → PLAN_CHANGE`

| ID | Old assumption | Current reality | Plan change |
|---|---|---|---|
| S6-1 | M6 id unknown | `20260929_0007`, down `20260928_0006`, single head | M7 `down_revision = "20260929_0007"` |
| S6-2 | `aa_experiments` columns unknown | state entity: claim cols, `lifecycle`, per-state instant+key pairs (`started_at/start_key`, `completed_at/complete_key`, `reviewed_at/review_key`, `abandoned_at/abandon_key/abandoned_from`), client UUID `id` | experiment refs are `subject|experiment:experiment:<uuid>`; lifecycle events for «Что менялось» read the instant columns |
| S6-3 | lifecycle values expected | `ck_aa_experiments_lifecycle`: `DRAFT, RUNNING, COMPLETED_AWAITING_REVIEW, REVIEWED, ABANDONED` | «Ревью доступно» counts only `COMPLETED_AWAITING_REVIEW` (OD-7.3) |
| S6-4 | transition timestamps unknown | one instant per state, entered at most once; no transition history table | "entered in window" = instant ∈ window; review-available is *current* state |
| S6-5 | abandon semantics | `ABANDONED` from DRAFT/RUNNING/CAR, `abandoned_from`, D4: not failure | ABANDONED never pending, never review-available |
| S6-6 | adherence API unknown | `aa_experiment_adherence` kept/missed/unknown; derived future/not_recorded/not_run_after_stop | Slice 7 does not read adherence rows (no adherence-derived candidate in v1; see Plan §8 F6 uses observations only) |
| S6-7 | observation linkage unknown | outcome/context → `aa_experiment_observations` (`subject = experiment:experiment:<id>`, `metric_key IS NULL`); conditions → `aa_observations` with the experiment subject; baseline → `aa_baselines` | non-experiment `aa_observations` (subject domain ≠ experiment) are the only "free" observations; experiment conditions are excluded from temporal candidates to avoid re-linking what the user already attached |
| S6-8 | decision widening | `aa_decisions.scope ∈ {review, experiment}`, experiment choices `keep|modify|longer|reject|inconclusive`, **no direction column** | Decisions never ground «Что улучшилось» (unchanged) |
| S6-9 | registries | `EXPORT_TABLES` 22, `TRUNCATED_TABLES` 22 AA + 3, `FACT_TABLES` + experiment observations, `SOURCE_REDACTORS = (redact_review_context,)` | M7 adds 5 tables to both registries; 3 new redaction adapters appended to `SOURCE_REDACTORS` |
| S6-10 | queue ops | experiment ops are plain `enqueue(op, route, payload)`; client-minted UUID for creates; coordinator/queue/replay unchanged; replay is **POST only** | Slice 7 adds ops the same way; deletes are `POST …/delete` routes; relation id / context entity id client-minted |
| S6-11 | frontend | `#/experiment`, `.aa-exp-*` CSS, `AAExpStages`, `AAAdherence`; `.aa-checkline`, `.aa-banner`, `.aa-change*`, `.aa-pair*`, `.aa-sr-*` still **not** ported | Slice 7 ports those J classes into `analytics.css` |
| S6-12 | master context/test baseline | master context §40 records 602/375; Calendar §40b records 602/495 | actual 602/495 (§2) |

`PENDING_LIFECYCLES` is exported by the facade but its meaning (DRAFT/RUNNING/CAR)
is "open experiments", not "review available"; OD-7.3 narrows Slice 7 to CAR only.

## 5. Calendar drift (shared route/locale/module baseline only)

`LIFE_ROUTES` stays 21 after Calendar (sub-paths of `calendar`). Locale dictionaries
now ru 1118 / uk 1117 keys (pinned in `locale-shape.test.ts`). `routeRegistry.js`
adds `calendar/…`; Slice 7 adds `system-review` + `system-review/…` the same way.
`lazy-routes.test.jsx` pins the loader map; `smoke.test.jsx` pins `LIFE_ROUTES.size`.
No Calendar semantics are touched by Slice 7.

## 6. Current Review schema (Slice 4, unchanged by S6 except scope widening)

`aa_reviews`, `aa_review_revisions` (note ≤ 4000), `aa_review_context_items`
(section CHECK `compare|quality|alongside`, role CHECK
`expected|forecast|actual|delta|target|coverage|observation`), `aa_review_context_sources`,
`aa_review_factors` (+scope), `aa_decisions` (+scope). `resolve_review_subject`:
`finance:period`, `project:project` only; `system:window` → 422. Save re-derives and
compares a fingerprint (409 on drift). No no-conclusion field, no adjustment list, no
direction. **Verdict unchanged: Saved System Review must not reuse `aa_reviews`**
(semantic abuse of section/role CHECKs, whole-month fingerprint churn). OD-7.2 = B + C
is met by a dedicated revision table (Plan §4.5). Redaction precedent reused:
`redact_review_context` pattern (erase in the hard-delete transaction, drop links).

## 7. Current Experiment reviewable state

Only `lifecycle = 'COMPLETED_AWAITING_REVIEW'` is a concrete object "ready for the
user to review": it is entered explicitly (client «period over» transition after
`window_end` in the experiment's zone) and left by `REVIEWED` or `ABANDONED`. A
RUNNING experiment whose window ended (`completion_due`) is **not** counted — it is
not yet in the reviewable state.

## 8. Current signal behaviour

`evaluate_signals(…, persist=True)` default; `GET /api/v1/aa/signals` passes
`persist=settings.aa_write_enabled` → the existing GET **writes episodes when the
gate is open**. Slice 7 must not copy that route. Rules are pure modules
(`handles/inputs/evaluate/episode_key`) that never write; `evaluation_subjects`
is bounded to 13 months relative to `now`. **Historical evaluation without
persistence is possible** by calling the four rule modules directly for an explicit
`SignalSubject` (finance period) — Slice 7's «Что повторилось» uses exactly that
(read-only evaluator, Plan §9.3), never `aa_signal_episodes`. Catalogue stays 4.

## 9. Relation storage recommendation

Two tables, not one:

* `aa_cross_references` — relation identity + endpoints (value-free ref keys) +
  `relation_type` + explicit `epistemic_kind` (`association|hypothesis`, DB-tied to
  the type) + `source` (`user|rule|ai`) + proposal metadata (family, model,
  version, `proposal_key`, `input_fingerprint`, evidence refs) + **current** status.
* `aa_relation_feedback` — append-only response events (approve/reject/unsure +
  note + time + fingerprint seen). "Do not erase rejected/unsure history" and
  "replace ranking with a model later" both need the event log; the current status
  on the relation row serves filters and ranking.

System candidates are **derived live** (GET is read-only) with a deterministic
`proposal_key`; the relation row is created at the user's first response. Nothing is
persisted merely because a candidate was shown.

## 10. System Review revision schema recommendation

No header table: one append-only `aa_system_review_revisions` row per explicit save
(draft) / finalize / revise, unique `(user, period_kind, period_key, revision)`;
optimistic concurrency via `base_revision` (409 on mismatch, unique-violation →
replay or 409). Frozen context stored as JSONB items each carrying its source refs;
a `source_ids uuid[]` manifest (GIN) lets the hard-delete adapter find and redact
exactly the affected items. Logical status (IN_PROGRESS / AVAILABLE / FINALIZED) is
derived from period end + existence of a finalized revision; a GET never writes.

## 11. Finance context gaps (what LifeOS does **not** model today)

Snapshot `transactions[]`: `{id, amount, category_id, date, description, source
(entry channel: monobank|manual), included_in_totals}`. AA: `finance.transaction_amount`
(UAH), derived `finance.monthly_spend`, Expectations/Targets per month, policy/
membership versions. **Not modeled anywhere:** plannedness, funding source, purpose,
motive, emotional context, worth-it, recurrence, accounts/balances, cash reserve,
debts/obligations (principal, payment, rate), essential commitments, income, paid
projects (`projects[]` has no income attribute). Consequently:

* "unplanned spend + no active paid project" **cannot** be generated (not represented).
* source of funds, reserve, debt and essentials exist only if the user enters them
  explicitly → new user-authored `aa_finance_contexts` (Plan §4.4).
* income stays "не моделируется" (shown as a named missing input, never inferred).
* `aa_observations` do not fit expense context (categorical label ≠ free text;
  field identity would need new catalogue metrics; would leak into generic
  history/comparison) → dedicated table.

## 12. Export dependency assessment

Current deps: backend FastAPI/SQLAlchemy/pydantic/psycopg/alembic only; frontend
React only. Nothing produces PDF/DOCX/XLSX.

* **MD** — plain text; stdlib.
* **XLSX / DOCX** — OOXML = ZIP + XML; `zipfile` + `xml.sax.saxutils.escape`;
  no dependency needed. XLSX cells are written as typed inline strings / numbers,
  never formulas; strings starting with `= + - @ \t \r` get `quotePrefix`.
* **PDF** — requires a Cyrillic-capable embedded font. A hand-written PDF 1.7 writer
  (stdlib) with a TrueType CIDFontType2 / Identity-H font, `ToUnicode` CMap (text
  extractable) and a glyph-level subset (unused glyph outlines zeroed) is feasible.
  Font asset: **DejaVu Sans + DejaVu Sans Bold** (Bitstream Vera-derived license,
  free redistribution/embedding; license text committed beside the files).
* **Decision:** `DEPENDENCIES_ADDED = none` (no pip/npm package). One asset
  addition: two DejaVu TTF files + license under `apps/api/app/services/system_review/exports/fonts/`.
  Local QA can use the already-installed poppler (`pdftotext`, `pdfinfo`) and
  LibreOffice headless to open DOCX/XLSX; neither is a project dependency.

## 13. Migration design (summary; exact DDL in the Plan)

M7 `20260930_0008_aa_system_review`, `down_revision = "20260929_0007"`, frozen SQL,
C8 docstring. **Five** tables (semantics-driven count, not a target number):
`aa_importance_ratings`, `aa_cross_references`, `aa_relation_feedback`,
`aa_finance_contexts`, `aa_system_review_revisions`. No change to any existing table;
`user_snapshots.schema_version` stays 2. AA tables 22 → 27.

## 14. Owner decisions (from the Slice 7 master prompt — all RESOLVED)

* **OD-7.1** manual «Связать» (source user, status approved, optional note), system
  proposals (proposed → approve/reject/unsure), durable feedback, deterministic
  acceptance-history ranking (no ML), forward-compatible `source=ai`, richer typed
  vocabulary with explicit epistemic kind, causal family forbidden, hypothesis types
  allowed only as marked hypotheses, filters by type/status/source/domain/period/importance.
* **OD-7.2** B + C: Live derived review (GET, no writes) + durable Saved review with
  append-only revisions.
* **OD-7.3** «Ревью доступно» = concrete reviewable objects only (experiment CAR;
  ended month/year with evidence and no finalized System Review). «Требует
  подтверждения» = unresolved proposed relations only. No fifth signal rule.

Engineering choices made (not product semantics, recorded in the Plan): candidate
materialization at first response; bounded 3-month horizon for the global
«Требует подтверждения» count; annual review has no candidate generation of its own
(candidates are monthly); importance of an erased item is erased with it.

```
RECONCILIATION_STATUS=RECONCILED_THROUGH_SLICE_6_AND_CALENDAR
CURRENT_MAIN=fffcd4b3d7edaefa87a1b117634c8bfad7caf6d9
SLICE_6_DEPENDENCIES_OPEN=0
OWNER_DECISIONS_OPEN=0
ALEMBIC_HEAD_BEFORE=20260929_0007
AA_TABLES_BEFORE=22
SIGNAL_RULES=4
GET_SIGNALS_ROUTE_PERSISTS_WHEN_GATE_OPEN=YES (not copied)
HISTORICAL_SIGNAL_EVAL_READ_ONLY=YES (rule modules, explicit subject)
EXPORT_DEPENDENCIES_NEEDED=NONE (font asset only)
```
