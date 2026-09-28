# LifeOS — Adaptive Analytics Slice 4 · Review / Debrief — Implementation Plan

Plan · 2026-09-28 · based on `main` `ea3a75e` and
`Outputs/Discoveries/lifeos-adaptive-analytics-slice-4-review-targeted-discovery_20260928-162951.md`
(DISCOVERY_STATUS=PASS).

Branch: `feat/adaptive-analytics-slice-4-reviews` (one branch, one PR).

---

## 1. Goal and acceptance

Reviews that (1) reopen exactly as saved, (2) show later corrections **beside**
frozen values, (3) honour D1 — hard deletion erases source-derived frozen values
while user-authored text, factors and decision survive, (4) allow every step to be
skipped and an empty Review to be saved, (5) keep `NULL` decision ≠ `inconclusive`,
(6) contain no score, no causal inference and no recommendation.

## 2. Schema — M5 `20260928_0006_aa_reviews` (down_revision `20260928_0005`)

Additive. No pre-AA table and no earlier AA table is altered. Snapshot
`version`/`schema_version` stay `2`. SQL is frozen in the migration (M4 convention),
independent of later ORM/enum changes. Downgrade = `DROP TABLE` ×6, pre-write/disposable
environments only (C8), stated in the docstring.

All six tables: `id uuid PK`, `user_id uuid NOT NULL → users(id) ON DELETE CASCADE`,
`created_at timestamptz NOT NULL DEFAULT now()` (storage fact only). Children also
carry `review_id → aa_reviews(id) ON DELETE CASCADE` (items/sources via item).

### 2.1 `aa_reviews` — header

| column | type | notes |
| --- | --- | --- |
| subject_domain / subject_type / subject_id / subject_key | text; key generated stored | subject triple |
| window_start, window_end | date | CHECK end ≥ start |
| timezone | text | CHECK ≠ '' |
| context_as_of | timestamptz NOT NULL | the instant the frozen context was derived |
| render_manifest | jsonb NOT NULL | **layout only**: `manifest_version`, `subject_kind`, sections → ordinals. No values |
| current_revision | int NOT NULL DEFAULT 1 | CHECK ≥ 1 |
| revised_at | timestamptz NULL | CHECK `(revised_at IS NULL) = (current_revision = 1)` |

Index `(user_id, subject_key, created_at DESC)`. No context fingerprint is stored:
a hash over a small value space could be brute-forced back to an erased value.

### 2.2 `aa_review_revisions` — one row per authoring act (save = 1, each revise = n)

`review_id`, `revision int ≥ 1`, `note_text text NULL` (CHECK NULL or trimmed
non-empty, ≤ 4000 chars), `idempotency_key text NOT NULL`.
`UNIQUE (user_id, idempotency_key)`, `UNIQUE (review_id, revision)`.
Text is never overwritten; a revise with text appends a new row.

### 2.3 `aa_review_context_items` — one frozen, individually redactable evidence item

| column | notes |
| --- | --- |
| review_id, ordinal | `UNIQUE (review_id, ordinal)` |
| section | `compare · quality · alongside` |
| role | `expected · forecast · actual · delta · target · coverage · observation` |
| label_key | stable i18n key (`expectation`, `forecast_latest`, `actual`, `delta`, `target`, `coverage.observed_count`, …) — not a value |
| metric_key | text NULL |
| availability | `present · no_data · insufficient_data · not_applicable · explicitly_absent · explicitly_unknown`; NULL **only** when redacted |
| value_type, unit_code, value_num, value_date, value_text, scale_min, scale_max | frozen value as displayed; shape CHECK when `availability='present'`, all NULL otherwise |
| desire | `neutral · favorable · unfavorable · unknown`, only on `role='delta'` |
| epistemic_kind | only on `role='observation'` |
| estimate | bool |
| source_kind, basis, method, provenance_recorded_at, original_recorded_at_known | frozen provenance as displayed |
| redacted_at, redaction_reason (`source_hard_deleted`) | CHECK both-or-neither; CHECK redacted ⇒ every value/provenance/desire/epistemic column NULL and `availability` NULL — "redacted but value present" is unrepresentable |

### 2.4 `aa_review_context_sources` — normalized item → fact links (Discovery D-2)

`item_id → aa_review_context_items ON DELETE CASCADE`, `source_table` (CHECK in the 10
`FACT_TABLES` names), `source_fact_id uuid`. `UNIQUE (item_id, source_table, source_fact_id)`,
`INDEX (user_id, source_fact_id)` (the redaction lookup), `INDEX (item_id)`.

### 2.5 `aa_review_factors` — user-authored, append + retraction marker

`review_id`, `ordinal`, `text` (trimmed non-empty, ≤ 500), `epistemic_kind`
(`observed · mine · maybe · unknown`, DEFAULT `unknown`), `added_in_revision ≥ 1`,
`retracted_in_revision NULL` (CHECK > added), `replaces_id → aa_review_factors NULL`.
No `source_fact_id`: never redacted.

### 2.6 `aa_decisions` — nullable choice, review-scoped now, experiment-scope later (M6)

`scope` CHECK `IN ('review')`; `review_id NULL` with CHECK `scope <> 'review' OR review_id IS NOT NULL`;
`choice NULL` CHECK `choice IS NULL OR choice IN ('keep','adjust','later','inconclusive')`;
`revision ≥ 1`; `superseded_in_revision NULL` (CHECK > revision);
partial `UNIQUE (review_id) WHERE superseded_in_revision IS NULL` — one current decision.

Three distinct states: **no row** (step skipped) · **row, choice NULL** («Пока без
решения») · **row, choice `inconclusive`** («Непонятно — данных недостаточно»).

### 2.7 Enumerations

New `StrEnum`s in `app/analytics/enums.py`: `ReviewSection`, `ReviewRole`,
`ReviewAvailability`, `ReviewDecisionChoice`, `DecisionScope`, `RedactionReason`;
reuse `EpistemicKind`, `ValueType`, `SourceKind`. A schema-guard test asserts the
installed CHECKs admit exactly these members.

## 3. Files

**Backend — new**
```
apps/api/alembic/versions/20260928_0006_aa_reviews.py
apps/api/app/models/aa_review.py          (AAReview, AAReviewRevision, AAReviewContextItem,
                                            AAReviewContextSource, AAReviewFactor)
apps/api/app/models/aa_decision.py        (AADecision)
apps/api/app/schemas/aa_reviews.py
apps/api/app/services/aa_reviews.py       (context derivation, save, revise, read, redactor)
apps/api/app/routes/aa_reviews.py
apps/api/tests/aa_review_helpers.py
apps/api/tests/test_aa_reviews.py
apps/api/tests/test_aa_review_redaction.py
apps/api/tests/test_aa_review_correction_visibility.py
```
**Backend — modified**: `app/analytics/enums.py`, `app/models/__init__.py`,
`app/main.py`, `app/services/aa_deletion.py` (register redactor; call hook for
cascading membership-override dependents), `app/services/export.py`,
`app/routes/aa_measurements.py` (stable error codes), `tests/conftest.py`,
`tests/test_export.py` (manifest revision), and any test asserting M4 is head.

**Frontend — new**
```
apps/web/src/pages/analytics/ReviewPage.jsx
apps/web/src/components/analytics/AAFactorTag.jsx
apps/web/src/analytics/reviewRoute.ts     (hash build/parse, project window)
apps/web/src/analytics/aaText.js          (locale-aware primitive labels, ru fallback)
apps/web/src/test/analytics-review.test.jsx
apps/web/src/test/analytics-review.test.ts
```
**Frontend — modified**: `api/analytics.ts`, `repositories/analyticsRepository.ts`,
`context/AnalyticsContext.jsx`, `context/LocaleContext.jsx` (ru+uk keys),
`app/routes.js`, `App.jsx`, `components/ProjectCard.jsx`, `pages/ProjectsPage.jsx`,
`pages/finances/FinanceAnalytics.jsx`, `components/analytics/AA{Delta,Facts,HistoryList,Provenance,QualityStrip}.jsx`
and `analytics/{labels,values,delta}.ts` (locale-aware labels, ru default unchanged),
`analytics.css` (port Review classes from frozen CSS, no demo chrome).

**Docs**: this plan, the Discovery, the implementation report, `LIFEOS_MASTER_CONTEXT.md`.

## 4. Context derivation (server, `aa_reviews.build_context`)

Always evaluated **as of an explicit instant** so a save can reproduce it.
Subjects supported: `finance:period:YYYY-MM` (window must equal the month) and
`project:project:<id>` (client window, ≤ 3661 days). Anything else → 422
`unsupported_review_subject`.

**Finance period** (`finance.monthly_spend`) via `derive_month` + `monthly_spend_inputs`:
compare = expected (current Expectation) · actual (derived; sources = included
transaction ids + deciding policy/override versions) · delta (desire from `derive_month`,
which grounds only on a non-absent Target; sources = union incl. Target) · target (if a
row exists; explicit absence kept as `explicitly_absent`). quality = coverage buckets
(sources = coverage claims + window transactions). alongside = the subject's
Observations in the window (≤ 20).

**Project** (`project.completion_date`): compare = latest Forecast version
(`estimate`) · Actual completion Measurement · date delta (neutral unless a Target
grounds it) · target if any. No quality section (no denominator; matches Slice 3).
alongside = Observations in the window.

Absent inputs yield items with `availability='no_data'` and no value — never a
fabricated operand, never a written fact. Fingerprint = sha256 over canonical JSON of
subject, window, timezone and every item's content + sorted sources.

## 5. API contracts (all under `/api/v1/aa`, session auth, ownership from session only)

| Method / path | Guards | Body / query | Response | Errors |
| --- | --- | --- | --- | --- |
| `GET /reviews/context` | auth | `subject, from, to, timezone=Europe/Kyiv` | items + `context_as_of` + `context_fingerprint` + manifest | 400 `range_required`, 422 `unsupported_review_subject` / `invalid_review_window` |
| `POST /reviews` | JSON content-type **dependency** (415 before parsing), write gate dependency, same-origin | `subject, window_start, window_end, timezone, context_as_of, context_fingerprint, note_text?, factors[], decision?{choice}, idempotency_key`; `extra=forbid` | 201 review / 200 replay | 409 `review_context_changed`, 409 `idempotency_key_reused`, 422 `invalid_review` |
| `GET /reviews` | auth | `subject, limit ≤ 50` | bounded summaries, newest first | 400 |
| `GET /reviews/{id}` | auth | — | review + items with `source_state` (`current · corrected · revised · withdrawn · redacted`) and `current_value` for single-source corrected/revised items + revisions + factors (incl. retracted) + decision history | 404 `review_not_found` |
| `POST /reviews/{id}/revise` | same as POST | `note_text?, add_factors[], retract_factor_ids[], decision?{choice}, idempotency_key` | 201 / 200 replay | 404, 409 `idempotency_key_reused`, 422 `empty_revision` / `invalid_factor` |

Validation failures return the stable envelope `{code, message}`. Cross-account ids
are simply not found.

## 6. Durable-write strategy

Save and revise are each **one** `AnalyticsWriteQueue` record → **one** POST → **one**
DB transaction. The queue payload carries only user-authored content plus
`context_as_of` / `context_fingerprint` — never frozen values. Replays are idempotent by
key. A context that can no longer be reproduced returns 409 → visible
`terminal_conflict` with the user's text retained and exportable (existing
`QueueFailures` UI). Snapshot sync is untouched (T-12).

## 7. Redaction (D1) and correction visibility

`aa_reviews.redact_review_context(db, user_id, table, fact_id)` registered in
`SOURCE_REDACTORS`; runs inside `delete_fact`'s transaction, never commits or logs
content: select affected item ids by `(user_id, source_table, source_fact_id)` →
`UPDATE` items nulling every value/provenance/desire/epistemic column, set
`redacted_at`, `redaction_reason='source_hard_deleted'` → delete **all** source links of
those items (no dangling id remains). `delete_fact` additionally invokes the hook for
the membership overrides that cascade with a hard-deleted measurement. Tombstone does
not redact (plan §11.4) and renders «источник позже отозван». Corrections render
«данные позже исправлены» beside the frozen value; revisions render «позже появилась
новая версия»; they are never conflated.

## 8. Frontend

- Route `review` (gated like other analytics routes); hash `#/review/new/<subject>/<from>/<to>`
  or `#/review/<id>`, parsed by the page (medications precedent).
- `ReviewPage`: five optional steps from frozen E — compare (`AADelta` +
  `AAQualityStrip` + `AAProvenance`), «Что изменилось?» (textarea), «Что могло
  повлиять?» (factor rows + `AAFactorTag`, add/remove, «неизвестно» default), «Чего это
  стоило?» (`AAFacts` of real alongside items or an honest empty line), «Что дальше?»
  (single-select radiogroup: оставить / скорректировать / вернуться позже / непонятно —
  данных недостаточно / пока без решения). «пропустить» always left; saving with nothing
  filled is valid. Saved state: `AAHistoryList` of the frozen items + queue status.
- Open mode: frozen context with flags, notes history, factors (retracted listed as
  such), decision history, and «дополнить» (note, add/retract factors, change decision).
- Entry points: `ProjectCard` «Открыть ревью» (completed projects), `FinanceAnalytics`
  «Ревью месяца» (ghost). No Home signal (no fifth rule).
- RU + UK for all new copy; AA primitives read `LifeLocaleContext` with `ru` fallback.
- Accessibility: steps announced via `aria-live`, progress dots `aria-hidden` with text
  «шаг n из 5», radiogroup semantics, menu with Escape/focus return, visible
  focus, reduced motion, 390 px layout without horizontal scroll.

## 9. Export / delete implications

Six new tables added to `EXPORT_TABLES` and `TRUNCATED_TABLES` in the same slice;
mapped == registry == real remains enforced. Account deletion = FK cascade, verified by
test. Hard delete path extended as §7. Export of a redacted review contains the item
with NULL values and its redaction marker only.

## 10. Tests

Backend (`lifeos_test` only): context from real facts (finance equals `derive_month`;
project forecast/actual/delta); reopen identical; empty review; each step skippable
(parametrised); NULL vs `inconclusive` vs no row; idempotent replay; key reuse 409;
context changed 409; revise appends (text history, factor retraction keeps row,
decision superseded); cross-account 404 + list isolation; 415 before 422; gate closed
403; cross-origin 403; `user_id` in body 422; later correction flagged + frozen
unchanged + current value beside; revision ≠ correction; tombstone ⇒ withdrawn, value
kept; hard delete redacts (expectation; transaction ⇒ derived actual/delta/coverage;
cascaded override) with a **residue scan** of every item/source/manifest column;
user text/factors/decision survive; redaction transactional (failing adapter rolls back
the deletion); other account untouched; manifest values-free; export includes all six
tables; account deletion removes all review rows; catalogue still exactly four rules;
schema guards; M5 downgrade/upgrade roundtrip.

Frontend: step flow and skipping; empty save payload; payload carries no frozen
values; decision tri-state payloads; factor menu keyboard; open mode renders
corrected/revised/withdrawn/«источник удалён»; ru/uk key parity and a full UK render
without Russian leakage; route build/parse; no demo chrome classes.

## 11. Rollback

Before personal review data exists: `alembic downgrade 20260928_0005` + revert the
merge. After: keep schema and data (C8); disable via `LIFEOS_AA_WRITE_ENABLED` /
`VITE_LIFEOS_ANALYTICS_ENABLED` and revert UI.

## 12. Non-scope

Slices 5–8; System Review; Experiment decisions; causal inference; recommendations;
Life Score; GTD Weekly Review; a fifth signal rule / review-available signal;
notification centre; dependency changes; deployment.

## 13. Git / validation sequence

Commit Discovery + Plan → implement backend (migration, models, service, routes,
redactor, registries) → backend tests → frontend → frontend tests → full validation
(pytest, ruff, alembic heads/current, npm test/typecheck/lint/build, `git diff --check`)
→ implementation report + master context → commit → push → PR → inspect remote PR →
merge (merge commit) → main ff-only → delete branch local + remote.

```
PLAN_STATUS=COMPLETE
IMPLEMENTATION_READY=YES
OWNER_DECISIONS_OPEN=0
```
