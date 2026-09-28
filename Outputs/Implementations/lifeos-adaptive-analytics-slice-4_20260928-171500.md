# LifeOS — Adaptive Analytics Slice 4 · Review / Debrief (E)

Implementation report · 2026-09-28

---

## 1. Start state and process

| | |
| --- | --- |
| Checkout | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` (single worktree, unchanged) |
| Start `main` = `origin/main` | `ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef` (PR #11; first parent `99f0709` = Slice 3) — no drift |
| Feature branch | `feat/adaptive-analytics-slice-4-reviews` |
| Recovery stash | `51184836ace557fbd9492527bd845329b17b2a76` untouched |
| Frozen tag | `adaptive-analytics-design-accepted` → `6c507b82…` / `d4960286…` untouched |

Process followed: **Discovery → Plan → Implementation → Validation → PR**.

- Discovery: `Outputs/Discoveries/lifeos-adaptive-analytics-slice-4-review-targeted-discovery_20260928-162951.md` — `DISCOVERY_STATUS=PASS`, `OWNER_DECISION_REQUIRED=NO`.
- Plan: `Outputs/Plans/lifeos-adaptive-analytics-slice-4-review-implementation-plan_20260928-163820.md` — `PLAN_STATUS=COMPLETE`, `OWNER_DECISIONS_OPEN=0`.
- Both were committed on the branch (`fb7f8a4`) before any production code.

Baseline before changes: 324 pytest · ruff clean · alembic `20260928_0005` head/current · 214 Vitest (23 files) · typecheck/lint/build clean.

## 2. Drift from the Phase B Plan (all resolved in Discovery, none an owner decision)

| # | Plan | Implemented | Reason |
| --- | --- | --- | --- |
| D-1 | M5 `aa_0006_reviews` on M3 | `20260928_0006_aa_reviews` on `20260928_0005` | accepted chain naming |
| D-2 | one `source_fact_id` per item | normalized **`aa_review_context_sources`** | a derived value (monthly total, delta, coverage) has many sources; D1 requires erasing it when **any** is hard-deleted |
| D-3 | `aa_reviews.free_text` | **`aa_review_revisions`** (one row per save/revise) | text must be appendable without overwriting |
| D-4 | review decision vocabulary unspecified | `keep · adjust · later · inconclusive` + `NULL` | frozen E choice list + frozen README («Непонятно — данных недостаточно» as first-class outcome) + plan T-08 |
| D-5 | review-available signal | **not built** | would be a fifth Signal rule; catalogue stays exactly four (tested) |
| D-6 | four endpoints | + bounded `GET /reviews?subject=` | a saved Review must be findable to be reopened |
| D-7 | trade-off step | real Observations in the window, else an honest empty line | no cost facts exist before Slice 7; nothing invented |
| D-8 | tombstone | flags «источник позже отозван», frozen value kept | plan §11.4: only HARD delete redacts |

`aa_reviews` intentionally stores **no** context fingerprint: a hash over a small
value space could be brute-forced back to an erased value.

## 3. Migration M5 — `apps/api/alembic/versions/20260928_0006_aa_reviews.py`

Additive; no pre-AA or earlier AA table altered; snapshot `version`/`schema_version`
stay `2`. SQL frozen in the file. Downgrade = drop six tables, pre-write/disposable
environments only (C8, stated in the docstring). Every table: `user_id → users ON
DELETE CASCADE`; children `review_id → aa_reviews ON DELETE CASCADE`; sources
`item_id → aa_review_context_items ON DELETE CASCADE`.

| Table | Holds | Key constraints |
| --- | --- | --- |
| `aa_reviews` | subject, window, tz, `context_as_of`, values-free `render_manifest`, `current_revision`, `revised_at` | window order, `(revised_at IS NULL) = (current_revision = 1)` |
| `aa_review_revisions` | one authoring act + optional note | `UNIQUE (user_id, idempotency_key)`, `UNIQUE (review_id, revision)`, note trimmed ≤ 4000 |
| `aa_review_context_items` | frozen value + frozen provenance as displayed | value-shape CHECK when `availability='present'`, empty otherwise; **`ck_…_redacted_erased`**: redacted ⇒ every value/provenance/desire/epistemic column NULL — residue is unrepresentable |
| `aa_review_context_sources` | item → fact links | source table allow-list, `INDEX (user_id, source_fact_id)` |
| `aa_review_factors` | user factor + epistemic kind (`unknown` default) | added/retracted revision order, `replaces_id` |
| `aa_decisions` | nullable choice, review scope | `choice IS NULL OR IN (keep, adjust, later, inconclusive)`, partial unique current decision per review |

Three decision states are distinct and tested: **no row** (step skipped) · **row,
`choice NULL`** («Пока без решения») · **row, `inconclusive`**.

## 4. Server design

**Context** (`app/services/aa_reviews.py::build_context`) is derived **as of an explicit
instant** from real facts only:

- Finance period: `derive_month` + `monthly_spend_inputs` (the same derivation the
  Finance surface and the finance signal use) → expected, derived actual (sources =
  included transactions + deciding policy/override versions), delta (desirability only
  from a Target), target incl. explicit absence, nine coverage buckets (sources = claims +
  window transactions), observations in the window.
- Project: latest Forecast version (estimate), Actual completion Measurement, date
  delta (neutral unless a Target grounds it), target, observations. No quality section
  (no denominator — consistent with Slice 3).
- Absent inputs → `no_data` items; nothing fabricated, nothing written.

**Save** is one queue record → one POST → one transaction. The body carries only user
content plus `context_as_of` and `context_fingerprint`; the server re-derives, compares
and stores **its own** items. A later replay (offline for days) reproduces the same
context via as-of reads; if it cannot (a source erased/tombstoned in between), the save
is `409 review_context_changed` → visible `terminal_conflict` in the queue with the
user's text retained and exportable. A future `context_as_of` is rejected.

**Revise** appends a revision: note row, factor retraction markers + new rows (with
`replaces_id`), decision superseded + new row. Frozen evidence is never re-derived.

**Read** returns frozen items unchanged plus `source_state`/`source_flags`
(`current · corrected · revised · withdrawn · redacted`) and, for single-source
corrected/revised items, `current_value` **beside** the frozen one. Output is normalized
to storage precision and UTC so a reopened Review is byte-identical to the context seen.

**Redaction (D1)**: `redact_review_context` is registered in
`aa_deletion.SOURCE_REDACTORS` and runs inside `delete_fact`'s transaction (never
commits, never logs content): erases every item linked to the fact and deletes all
links of those items. `delete_fact` now also calls the hook for membership overrides
that cascade with a hard-deleted measurement.

**API** (session auth; ownership from session only; cross-account → 404):

```
GET  /api/v1/aa/reviews/context?subject=&from=&to=&timezone=
GET  /api/v1/aa/reviews?subject=&limit≤50
POST /api/v1/aa/reviews                    (JSON 415 dep + write gate dep + same-origin)
GET  /api/v1/aa/reviews/{id}
POST /api/v1/aa/reviews/{id}/revise        (same guards)
```

Wrong `Content-Type` is **415 before parsing** (Slice 3 regression guarded). Validation
errors use the stable `{code, message}` envelope (`invalid_review`). New codes:
`review_not_found` 404, `review_context_changed` 409, `idempotency_key_reused` 409,
`unsupported_review_subject` / `invalid_review_window` / `invalid_factor` /
`empty_revision` / `invalid_review` 422.

## 5. Export / erasure

All six tables added to `EXPORT_TABLES` and `TRUNCATED_TABLES`; **mapped AA tables
(19) == export registry (19) == real DB AA tables (19)**, enforced by the existing
registry checks. Account deletion is the FK cascade — verified by test (owner's rows all
gone, other account intact). Export after a redaction contains the redaction marker and
the user's text, never the erased value.

## 6. Frontend

- `pages/analytics/ReviewPage.jsx` — route `review` (gated like other analytics routes),
  hash `#/review/new/<subject>/<from>/<to>` or `#/review/<id>`. Five optional steps from
  frozen E; «пропустить» always left; empty save valid; saved confirmation with
  `AAHistoryList`; reopened view with flags, all notes, retracted factors, decision
  history, and «Дополнить».
- Reused primitives: `AADelta` (new optional `notes` for erased/flagged cells),
  `AAFacts`, `AAQualityStrip`, `AAProvenance`, `AAHistoryList`. New `AAFactorTag`
  (explicit menu, ↑/↓/Escape, focus return).
- `analytics/review.ts` — pure routing, windows (IANA Kyiv), payload builders.
- Entry points: completed `ProjectCard` → «Открыть ревью» (primary); `FinanceAnalytics` →
  «Ревью месяца» (ghost). No Home signal.
- RU + UK: 132 keys per locale; the shared primitives now read `LifeLocaleContext` with
  a Russian fallback (`useAAText`), so existing pages render unchanged.
- CSS ported from the frozen kit without demo chrome (T-16 guard passes).
- Visual check in Chrome of the real component output with production `styles.css` +
  `analytics.css`: desktop 1440 px and a 390 px viewport — no horizontal overflow, delta
  collapses to one column, «источник удалён» and correction flags render in place.

## 7. Tests

**Backend 324 → 380 (+56)**: `test_aa_reviews.py` (43), `test_aa_review_redaction.py`
(9), `test_aa_review_correction_visibility.py` (4), helpers `aa_review_helpers.py`.
Coverage: context equals `derive_month`; target-only desirability; explicit absence;
project forecast/actual/delta; no-data writes nothing; reopen identical; empty review;
every step skippable (parametrised); NULL ≠ inconclusive ≠ skipped; vocabulary; idempotent
replay + key reuse 409; offline replay freezes the seen context; changed context 409;
future as-of 422; revise appends (notes, retractions, decision history); revise
validation; cross-account isolation; 415/403/422 guards; gate closed; bounded list;
manifest values-free; export; account erasure; catalogue exactly four; enum/CHECK parity;
redacted-with-value rejected by the DB; M5 roundtrip; snapshot contract v2; redaction of
expectation / transaction-derived items / observation / cascaded override with residue
scans of every column; **transactional rollback on adapter failure**; other account
untouched; correction/revision/withdrawal flags with frozen values unchanged.

Existing tests changed: M4 test asserts chain position instead of head (same pattern
Slice 3 used for M3); two export manifest revisions bumped to `20260928_0006`.

**Frontend 214 → 242 (+28)**: `analytics-review.test.ts` (11) and
`analytics-review.test.jsx` (17): routing, windows (summer/winter Kyiv), payload carries
no frozen value, decision tri-state, revise builder, coverage rebuild, durable queue
record + single POST replay, bounded reads; step rendering, skip placement, radiogroup,
project date delta, correction/revision/withdrawn/erased rendering, reopened view,
accessibility attributes, RU/UK key parity, full UK render without Russian letters, entry
points. `smoke.test.jsx` route count 18 → 19.

## 8. Validation (final)

| Check | Result |
| --- | --- |
| `apps/api: python -m pytest` | **380 passed**, 13 warnings (lifeos_test only) |
| `apps/api: ruff check .` | All checks passed |
| `apps/api: alembic heads` / `current` | `20260928_0006 (head)` / `20260928_0006 (head)` |
| `apps/web: npm test` | **242 passed** (25 files) |
| `apps/web: npm run typecheck` / `lint` | clean / clean |
| `apps/web: npm run build` | built, 114 modules, JS 507.69 kB (147.19 gzip), CSS 147.36 kB |
| `git diff --check` | clean |

The JS bundle crossed Vite's 500 kB advisory (469.99 → 507.69 kB): a warning, not a
failure. Code-splitting is out of scope and was not attempted.

## 9. Dependencies, deployment, non-scope

No dependency added or upgraded; lockfiles untouched; `npm audit fix` not run. No
deployment. Not implemented: Slices 5–8, System Review, experiment decisions, causal
inference, recommendations, Life Score, GTD weekly review, a fifth signal rule,
notification centre.

## 10. Known limitations

1. A save whose context cannot be reproduced (source erased/tombstoned between viewing
   and saving) is refused with 409 and stays in the queue as a visible conflict; the user
   must re-open the Review to save against current evidence.
2. Derived items (monthly total, delta, coverage) show «данные позже исправлены» but no
   single current value beside them — there is no one successor to show.
3. Finance context re-reads the month twice (`derive_month` and `monthly_spend_inputs`)
   to obtain exact input ids; fine at current volume.
4. Primitive localization covers the Review path; `FinanceAnalytics`' own page copy
   remains Russian-only as before (pre-existing).
