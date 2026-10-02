# LifeOS Adaptive Analytics — Slice 7 · Trade-off + System Review — PROVISIONAL Plan Candidate

**Status:** `PLAN_FINALITY = PROVISIONAL` — not an implementation authorization.
**Generated:** 2026-09-29 · Claude Code (Opus 5.5) · parallel read-only session
**Pinned baseline:** `414df142700653d616016ff644bff3d9c0007540` (Slice 5 merged, Slice 6 absent)
**Inputs:** reconciled Discovery (same folder), owner-decision memo (same folder), Phase B Plan §7/§21/§22/§24.10/§27, module-boundaries, frozen J (`d496028`).

This plan cannot become final until:
1. Slice 6 is merged and every `MUST_REVERIFY_AFTER_SLICE_6_MERGE` item (§12) is closed against the then-current main;
2. the owner answers OD-7.1, OD-7.2 and OD-7.3 (memo);
3. the Plan session re-runs the baseline test counts.

Default choices below assume the **recommended** owner answers; each dependent section names what changes under the alternatives.

---

## 1. Goal and non-goals

**Goal.** A typed multi-domain read model for one calendar month, rendered as J1 (Trade-off: «Что менялось одновременно») and J2 (System Review: six groups under «Это не вердикт»), with two user-owned write concepts: importance and explicit cross-references.

**Non-goals (forbidden, structurally tested):** global score · cross-unit sum or composite · optimization result · winner · net benefit · ranking by magnitude/importance/materiality · hidden causal inference · a fifth signal rule or pattern catalogue · generated adjustment recommendations · notifications for «Ждёт вас» · any GET that writes · fixture domains (hours, tasks, sleep, energy).

---

## 2. Preconditions (checked at the start of the implementation session)

- `main` contains Slices 4, 5 **and 6**; clean tree; ordinary feature branch `feat/adaptive-analytics-slice-7-system-review` in the canonical checkout.
- `alembic heads` = single head = actual M6 id.
- Baseline counts re-run (`pytest`, Vitest) and recorded.
- OD-7.1 / OD-7.2 / OD-7.3 answered in writing.

---

## 3. Window, identity and ordering

**Window.** `period=YYYY-MM` + `timezone` (IANA, default `Europe/Kyiv`) + optional `as_of` (tz-aware; future → `422`). Matches `finance.monthly_spend` grain and the Slice 4 finance Review window, avoids arbitrary-window re-derivation of monthly metrics, and J2 is already month-framed («Август · что известно»). Days after `as_of` inside the month are `future` (J1's «1 авг — 28 авг · 28 дней»).

**Change key** (value-free, deterministic, user-scoped by row ownership):

```
v1|<kind>|<metric_key>|<subject_key>|<period>
kind ∈ {actual_vs_expectation, actual_vs_prior, expectation_revisions,
        target_state, preference_state, forecast_revisions, completion,
        observation}           (+ experiment kinds after S6 re-verify)
```

`|` is the outer separator because `subject_key` contains `:`. Server validates with one regex + `validate_subject(parse_subject_key(...))` + known `metric_key` + known `kind` → otherwise `422 invalid_change_key`. No fact ids and no values in the key, so a correction does not orphan a rating and a hard delete leaves no residue.

**Ordering (all groups).** Fixed structural tuple: `(domain_rank, subject_key, metric_key, kind_rank, change_key)` where `domain_rank` is a constant table (`finance, project, observation, experiment`). Never magnitude, importance, materiality, desirability or recency-of-value. Permutation test (§10) pins it.

---

## 4. Migration candidate — M7 (do NOT create before Slice 6 merges)

- File: `apps/api/alembic/versions/<date>_<next>_aa_tradeoff.py`; `down_revision = <actual M6 id>` — **UNKNOWN (S6-1)**.
- One additive revision; frozen SQL in the file (M5 precedent); no pre-AA or earlier AA table altered; `user_snapshots.schema_version` stays **2**; server schema stays 2.
- Downgrade = `DROP TABLE` ×2 — pre-write/disposable environments only (C8, stated in docstring).

### 4.1 `aa_importance_ratings`

```
id uuid PK · user_id → users ON DELETE CASCADE · created_at
change_key        text NOT NULL  CHECK (change_key ~ '^v1\|')  and length ≤ 512
importance        text NOT NULL  CHECK IN ('none','matters','ok','ignore')
recorded_at       timestamptz NOT NULL
status            text NOT NULL  CHECK IN ('active','superseded')
supersedes_id     uuid NULL → aa_importance_ratings.id
superseded_at     timestamptz NULL
idempotency_key   text NOT NULL
CHECK ((status='active') = (superseded_at IS NULL))
UNIQUE (user_id, idempotency_key)
UNIQUE (user_id, change_key) WHERE status = 'active'        -- one live rating
INDEX  (user_id, change_key, recorded_at)
```
No numeric column. No ordinal/weight mapping anywhere (AST test). Default undecided = **no row**; explicit `none` row = "user reset to undecided"; both render «не решил» but the API exposes `importance: null` vs `"none"`.

### 4.2 `aa_cross_references`

```
id uuid PK · user_id → users ON DELETE CASCADE · created_at
from_key          text NOT NULL        -- a change_key (v1|…) or a subject_key
to_key            text NOT NULL
from_kind / to_kind text NOT NULL CHECK IN ('change','subject')
relation          text NOT NULL CHECK IN ('related')          -- OD-7.1 allow-list
note              text NULL CHECK (note IS NULL OR (btrim(note) <> '' AND char_length(note) <= 500))
created_by        text NOT NULL DEFAULT 'user' CHECK (created_by = 'user')
recorded_at       timestamptz NOT NULL
status            text NOT NULL CHECK IN ('active','retracted')
retracted_at      timestamptz NULL
CHECK ((status='active') = (retracted_at IS NULL))
CHECK (NOT (from_kind = to_kind AND from_key = to_key))        -- self-reference
idempotency_key   text NOT NULL
UNIQUE (user_id, idempotency_key)
UNIQUE (user_id, least(from_key,to_key), greatest(from_key,to_key), relation) WHERE status='active'
```
No confidence / strength / weight / lag / direction column. `related` is symmetric, so the pair is stored canonically. The CHECK list depends on OD-7.1; `retracted`/`retracted_at` exist only if the owner wants retraction (OD-7.1 consequence).

**No score table. No optimization table. No third table** unless OD-7.2 = C (§5.4).

---

## 5. API candidate

All routes: session auth; ownership from the session only; body `user_id` rejected; cross-account → 404; `{code, message}` envelope. Writes: `require_json_content_type` + `require_aa_write_enabled` as route dependencies (415 before 422), `enforce_same_origin` in handler.

### 5.1 `GET /api/v1/aa/system-review?period=&timezone=&as_of=` (the only new read)

The old Discovery proposed a separate `GET /aa/changes`. With a month window and the three registered metrics, one bounded read serves both J1 (uses `changed` + `contradictions`) and J2 (all groups). A second endpoint is deferred until a real volume need appears.

```
{
  period, timezone, as_of, evaluated_at,
  not_a_verdict: true,
  groups: {
    changed:        { items: [ChangeCard],   truncated: bool },
    improved:       { items: [ImprovedItem], truncated: bool },
    repeated:       { items: [RepeatItem],   truncated: bool },
    contradictions: { items: [Pair],         truncated: bool },
    pending:        { reviews: null | …(OD-7.3), experiments: null | {DRAFT:int, RUNNING:int, COMPLETED_AWAITING_REVIEW:int}, as_of_supported: bool },
    quality:        { items: [QualityItem],  truncated: bool }
  }
}
ChangeCard   = { change_key, domain, subject, metric_key, kind, window,
                 current:{concept, value?, availability}, reference:{concept, value?, availability},
                 delta:{state: known|unknown|not_applicable, value?, reason?},
                 direction: higher|lower|same|null,         -- descriptive only
                 coverage, provenance, importance:{value, recorded_at}|null,
                 cross_references:[{id, other_key, relation, note, recorded_at}] }
ImprovedItem = { change_key, basis:{kind: target|preference, fact_id, direction,
                 reference_value, window?, recorded_at, provenance} }   -- basis REQUIRED
RepeatItem   = { source: rule_id | revision_kind, subject, windows:[period…], coverage_disclosed:[…] }
Pair         = { a: change_key, a_basis, b: change_key, b_basis, causality_checked: false }
```

Bounds: each group ≤ `MAX_GROUP_ITEMS = 50` with `truncated` (the window is one month; explicit truncation replaces a cursor in v1). Every `value` is typed `(type, unit_code | scale bounds)`. **No top-level numeric field**; numbers only occur inside typed values or per-lifecycle counts. Items are structured; prose is client-side ru/uk.

Server algorithm (single repeatable-read snapshot):
1. Finance: `aa_finance` month derivation for `finance:period:<period>` and prior period (policy as-of, C7). Cards: `actual_vs_expectation` (only same type+unit), `actual_vs_prior`, `expectation_revisions`, `target_state`, `preference_state`.
2. Projects: subjects with AA facts in the window → `project_analytics(...)` (Slice 5 helper, unchanged). Cards: `forecast_revisions`, `completion` (dual delta, neutral).
3. Observations in the window: typed juxtaposition; scale delta only for equal bounds; categorical never subtracted.
4. Grounding: new resolver `system_review/grounding.py` implementing the `subject_summary` rule (reconciled Discovery §5); Decision never; project never in v1 (P7-Q1).
5. Improved = changed ⋈ grounding with `desirability == favorable`; `unknown` → quality disclosure.
6. Contradictions = pairs within the window where both are grounded, one favorable, one unfavorable.
7. Repeated = `evaluate_signals(..., as_of=<prior period end>, persist=False)` for the two prior periods + current (verify historical coverage, reconciled Discovery §7.3), plus same-direction revision recurrence; unknown-coverage windows disclosed, not counted.
8. Pending = OD-7.3 / S6 allow-list.
9. Quality = coverage report per domain + corrections + legacy flag + stale.
10. Importance and cross-refs joined **as-of** by change_key.

Zero writes: `persist=False` is a literal, never `settings.aa_write_enabled`.

Errors: `400 period_required`, `422 invalid_period`, `422 invalid_time` (naive `as_of`), `422 invalid_timezone`.

### 5.2 `POST /api/v1/aa/importance`

Body `{change_key, importance, idempotency_key}`. Service: replay lookup → `pg_advisory_xact_lock(hash(user_id, 'aa_importance_ratings', change_key))` → supersede prior active row → insert active → `IntegrityError` → replay. 201 new / 200 `replayed:true`. Errors `422 invalid_importance`, `422 invalid_change_key`, `409 idempotency_key_reused` (same key, different body). Importance never enters desirability, ordering, filtering or grouping.

### 5.3 `POST /api/v1/aa/cross-references` (subject to OD-7.1)

Body `{from:{kind,key}, to:{kind,key}, relation, note?, idempotency_key}`. Order of checks: **causal denylist first** (`causes, caused_by, leads_to, because, effect, drives, affects, influences, результат, причина…`, case-insensitive, trimmed) → `422 causal_relation_forbidden`; then allow-list → `422 invalid_relation`; self-reference → `422 self_reference`; key shape → `422 invalid_change_key`; subject ownership → `require_subject(...)` → `404` for a subject with no facts in this account; natural duplicate → 200 existing row. Retraction (if OD-7.1 keeps it): `POST /api/v1/aa/cross-references/{id}/retract` (tombstone; 404 cross-account).

### 5.4 OD-7.2 variants
- **B (recommended):** no System Review save endpoint. J1 «Что это значит для меня» / «Вывода нет» and J2 «Что я решаю поменять» / «сохранить обзор» are **not rendered**; J2 keeps «открыть ревью» as navigation to the existing per-subject Review, where free text, decision and «Непонятно» already persist.
- **A:** not recommended (reconciled Discovery §9). Would add an M5 CHECK-swap migration + a system-window context builder.
- **C:** third table `aa_system_review_notes` (user text, `no_conclusion` bool, user-authored adjustment lines, revision append) + `POST /aa/system-review/notes` + queue op — only with explicit owner approval.

---

## 6. Durable writes

| Op | Route | Rules |
|---|---|---|
| `importance.set` | `/api/v1/aa/importance` | key generated at enqueue; optimistic UI from pending record; single-flight order ⇒ last choice on a device wins; server `recorded_at` order across devices (documented, no CAS) |
| `cross_reference.create` | `/api/v1/aa/cross-references` | client pre-validates the allow-list (a causal value is never enqueued); a `422` still lands as visible `failed_permanent` |
| `cross_reference.retract` (OD-7.1) | `/api/v1/aa/cross-references/{id}/retract` | only after the create has synced (needs server id) |

Queue files (`analyticsWriteQueue.ts`, `analyticsSyncCoordinator.ts`, `analyticsRepository.ts` replay) are **not** changed; only `AnalyticsContext` gains `enqueueImportance`, `enqueueCrossReference`, `readSystemReview`. T-12: snapshot 409 never pauses these writes.

---

## 7. Export / privacy / delete

- `models/__init__.py` + `EXPORT_TABLES` + `TRUNCATED_TABLES` gain both tables in the **same commit** as the models (module-boundaries rule); target parity `mapped aa_* == EXPORT_TABLES == real DB aa_*` = 21 (+ Slice 6 tables, S6-9).
- Export includes superseded importance rows and retracted cross-references.
- Account delete: FK cascade; covered by the existing residue test once registered (T-15).
- Per-fact hard delete (D1): neither table stores a value or a fact id → **no `SOURCE_REDACTORS` entry needed**; a card whose sources are deleted disappears or renders «источник удалён»; its importance row remains user-authored content (exported, not redacted). Not added to `FACT_TABLES` (user-authored, not facts).
- Notes are user text; the server generates no prose.

---

## 8. Backend file plan (module boundaries respected)

| File | Change |
|---|---|
| `app/models/aa_importance_rating.py`, `aa_cross_reference.py` | NEW |
| `app/models/__init__.py` | + 2 models |
| `app/analytics/enums.py` | + `Importance`, `CrossReferenceRelation`, `ChangeKind`; causal denylist constant |
| `alembic/versions/<date>_<next>_aa_tradeoff.py` | NEW (after S6) |
| `app/services/aa_system_review.py` | NEW **facade** (routes/tests import only this) |
| `app/services/system_review/{contracts,change_key,grounding,changes,groups,importance,cross_references}.py` | NEW package; internal direction `contracts → change_key → grounding → changes → groups`; `importance`/`cross_references` → `contracts`; never import the facade |
| `app/schemas/aa_system_review.py` | NEW |
| `app/routes/aa_system_review.py` + `app/main.py` | NEW router + one registration line |
| `app/services/export.py` | + 2 registry entries |
| `tests/conftest.py` | + 2 `TRUNCATED_TABLES` |
| `Outputs/architecture/module-boundaries.md` | + System Review section |
| unchanged by design | `aa_signals.py`, `rules/*`, `aa_finance.py`, `aa_project_analytics.py`, `aa_reviews` package, `aa_desirability.py` |

## 9. Frontend file plan

| File | Change |
|---|---|
| `api/analytics/systemReview.ts` + facade line in `api/analytics.ts` | NEW |
| `repositories/analyticsRepository.ts` | + `readSystemReview` read method only |
| `context/AnalyticsContext.jsx` | + `readSystemReview`, `enqueueImportance`, `enqueueCrossReference` |
| `pages/analytics/SystemReviewPage.jsx` (shell) + `pages/analytics/system/{Group.jsx, ChangeCard.jsx, ContradictionPair.jsx, Pending.jsx, Quality.jsx, format.js}` | NEW |
| `pages/analytics/TradeoffPage.jsx` | NEW (J1: banner, change cards with importance, contradiction pairs, causality note) |
| `components/analytics/AAImportance.jsx` | NEW — `role="menu"`, `menuitemradio`, `aria-checked`, Escape/outside close, focus return, `placement="left"` |
| `app/routes.js` (+ `system-review`, `tradeoff` under `ANALYTICS_ROUTE_ENABLED`; update pinned size), `app/routeRegistry.js`, `app/lazyRoutes.jsx`, `App.jsx::renderRoute` | MODIFY |
| `analytics.css` | port J classes `.aa-banner, .aa-changes, .aa-change*, .aa-pair*, .aa-sr-group/item/text, .aa-checkline/.aa-checkbox` (latter only if OD-7.2 = C) with `.aa-narrow` rules; no demo chrome (T-16) |
| `context/locale/ru.js`, `uk.js` | all new keys, RU and UK |

Rendering rules: `AADelta` only for `delta.state == 'known'`; `AAFacts` for categorical/incompatible; `AAProvenance` on every card; `AAQualityStrip` for quality; `.aa-pair` for contradictions; no `dangerouslySetInnerHTML`; importance never sorts/filters; empty group «Нечего показать за период.».

---

## 10. Future test matrix (not run in this session)

### Permanent
| ID | Assertion | Home |
|---|---|---|
| T-01 | Expectation alone never desirability; resolver import graph excludes expectation/forecast models | `test_aa_system_review.py`, `test_aa_desirability.py` |
| T-08 | `NULL` decision ≠ `inconclusive`; neither grounds | `test_aa_system_review.py` |
| T-09 | `ABANDONED` never pending; `REVIEWED` never pending; unknown lifecycle not pending (S6) | `test_aa_system_review.py` |
| T-10 | no global score / cross-unit composite | `test_aa_no_global_score.py` |
| T-12 | snapshot 409 independent of AA queue incl. `importance.set`, `cross_reference.create` | `analytics-sync-coordinator.test.ts` |
| T-14 | export contains both tables incl. superseded/retracted; registry parity | `test_export.py` |
| T-15 | account delete leaves zero rows in both | `test_account_deletion.py` |
| T-16 | no demo chrome after CSS port | `analytics-css.test.ts` |

### No global score (T-10 detail)
- introspect all `aa_*` columns: none named/like `score|weight|priority|rank|total|composite|net|winner`;
- M7 tables contain **no numeric column** (`information_schema` type check);
- response has no top-level numeric field and no numeric field outside typed values / per-lifecycle counts (recursive schema walk);
- no importance→number mapping (AST grep over `app/` and `src/`);
- order invariant under permuting magnitudes, importance and signal materiality (property test);
- frontend: no reduction across cards (render test with money + scale + date cards).

### Improved
Expectation-only → not improved · Forecast-only → not improved · positive sign without grounding → changed only · window-mismatched Target → not grounding · explicitly-absent Target → not grounding · Preference without Baseline → not grounding · Preference+Baseline → grounds · Review Decision (`keep/adjust/later/inconclusive/NULL`) → not grounding · partial coverage → not improved, disclosed · `unfavorable` → not improved · project delta → never improved in v1 · `basis` present on every improved item (schema + render) · resolver parity with `subject_summary`.

### Contradictions
coexist · no `winner/resolution/net` field · ungrounded up/down is not a contradiction · both bases rendered · `causality_checked:false` always.

### Causality
ru/uk copy scan for causal verbs outside the explicit negation string · overlap note always «причинная связь не проверялась» · no GET creates a cross-reference (row counts).

### Importance
no row → `null` vs explicit `none` distinct in API and storage · revision keeps history, one active row · as-of read returns the rating live at T · not inferred from sign/materiality · idempotent replay · concurrent set → one active row.

### Cross-reference
self-reference `422` · foreign/unknown subject `404` · causal family `422 causal_relation_forbidden` (checked before allow-list, case/whitespace variants) · `created_by='user'` CHECK · idempotent queue replay returns existing row · natural duplicate (either order) returns existing row · retract (if kept).

### Reads
GET `/system-review` with write gate **open** writes zero rows in every `aa_*` table incl. `aa_signal_episodes` · no Review/importance/cross-ref/semantic fact created.

### Structural
`400 period_required` · naive `as_of` 422 · future `as_of` 422 · group bounds + `truncated` · 415 before 422 on both POSTs · write gate closed → 403/no writes · body `user_id` rejected · cross-account 404.

### Repeated
only existing four rule ids or revision kinds appear · catalogue still exactly four · unknown-coverage windows not counted.

### Frontend
RU/UK keys exist (locale-shape) · importance menu roles/keyboard · narrow layout collapses pair to one column · empty-group copy · no fixture domain strings · «Это не вердикт» and «Общего балла нет и не будет» rendered · no save controls under OD-7.2 = B.

### Migration
M7 up/down on `lifeos_test`; enum/CHECK parity; single head.

---

## 11. Commit sequence (implementation session)

1. docs: final Discovery + final Plan into `Outputs/` (after re-verification).
2. M7 + models + enums + export/TRUNCATE registries (+ guard tests green).
3. change key + grounding resolver + parity tests.
4. read model + GET route + zero-write + no-global-score tests.
5. importance + cross-reference services/routes + tests.
6. frontend API/context/queue ops + tests.
7. pages, component, CSS port, locale + tests.
8. browser QA (desktop + narrow, RU/UK) · module-boundaries update · implementation report · master context status.

Full validation gate from `AGENTS.md` before claiming completion.

---

## 12. Open items

### MUST_REVERIFY_AFTER_SLICE_6_MERGE
S6-1 M6 revision id · S6-2 `aa_experiments` columns · S6-3 lifecycle values + CHECK name · S6-4 transition timestamps (as-of pending) · S6-5 abandon semantics · S6-6 adherence API · S6-7 experiment observation schema / Preference linkage · S6-8 decision scope/choice widening (still no direction unless an explicit field) · S6-9 export/TRUNCATE/redactor changes · S6-10 queue ops/coordinator · S6-11 frontend routes/pages/CSS already ported · S6-12 master context status + test baselines.

### Owner decisions
OD-7.1 (cross-reference vocabulary + creation UX) · OD-7.2 (System Review persistence) · OD-7.3 («Ревью доступно» source). See memo.

### Plan-session questions (conservative default applied, owner may lift)
- **P7-Q1** project date grounding — v1 ungrounded (consistent with Slice 5 page).
- **P7-Q2** «Что повторилось» historical re-evaluation feasibility — verify `evaluate_signals` subject coverage at historical `as_of`; fallback = revision recurrence only.
- **P7-Q3** month-only window — v1 `period=YYYY-MM`.
