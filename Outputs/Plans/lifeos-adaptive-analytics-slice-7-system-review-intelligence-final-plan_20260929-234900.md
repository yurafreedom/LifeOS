# LifeOS · Adaptive Analytics · Slice 7 — System Review & Relationship / Consequence Intelligence · FINAL Plan

**Status:** `FINAL_PLAN_STATUS=FINAL` · `OWNER_DECISIONS_OPEN=0`
**Generated:** 2026-09-29 · Claude Code (Opus 5.5)
**Base:** `main = origin/main = fffcd4b3d7edaefa87a1b117634c8bfad7caf6d9`, Alembic head `20260929_0007`
**Inputs:** Slice 7 master prompt (latest owner decisions OD-7.1/7.2/7.3), final reconciliation
(`Outputs/Discoveries/lifeos-adaptive-analytics-slice-7-final-reconciliation_20260929-234900.md`),
provisional plan/discovery/memo (`_parallel_planning/slice7/`, historical), current code,
frozen J (`d496028`, `system.jsx`, `analytics.css`).

Philosophy carried into every section: **LEARNING > SCORING**. No global score, no
composite, no moral label, no diagnosis, no causal claim, missing ≠ zero ≠ negative,
facts / associations / hypotheses / projections / user confirmations are distinct and
visibly so.

---

## 1. Scope

**In:** Live System Review (monthly + annual, read-only GET) · Saved System Review
(append-only revisions: save draft, finalize, revise, history) · Trade-off view (J1)
over the same read model · user-owned Importance · manual relations («Связать») ·
rule-based relation proposals with approve / reject / unsure, durable feedback and
acceptance-history ranking · explicit finance context capture (expense context,
obligations, reserve, essential commitments) · transparent consequence projections
(budget deviation, repeat scenario, debt payoff, reserve, essentials, priority
conflicts) with inputs/assumptions/calculation/horizon/missing/limitations · optional
transparent self-check · «Ревью доступно · N» and «Требует подтверждения · N» ·
revision exports PDF/DOCX/XLSX/MD · account JSON export of every new table · hard-delete
redaction · RU + UK.

**Out (hard limits):** global/Life score, optimization, "winner/net", diagnosis,
"unconscious sabotage", auto-approval, remote AI, ML training, embeddings/vector DB,
bank integration, inferred income/debt/funding, Slice 8 pruning, F3 cursor fix,
Calendar/Experiment semantic changes, fifth signal rule, deploy.

---

## 2. Vocabulary (added to `app/analytics/enums.py`)

```
Importance            none | matters | ok | ignore            (frozen J vocabulary; no numeric mapping anywhere)
RelationType          related | temporally_associated | co_occurs_with | conflicts_with | supports
                      | preceded_by | followed_by                              → epistemic 'association'
                      | may_contribute_to | may_increase_risk_of | may_reduce_probability_of → epistemic 'hypothesis'
RelationEpistemicKind association | hypothesis
RelationStatus        proposed | approved | rejected | unsure
RelationResponse      approved | rejected | unsure
RelationSource        user | rule | ai                       ('ai' reserved; never written in v1)
FinanceContextKind    expense_context | obligation | reserve | essentials | self_check
ReviewPeriodKind      month | year
SystemReviewRevisionStatus draft | finalized
```

Symmetric types (stored canonically `from_key < to_key`): `related, temporally_associated,
co_occurs_with, conflicts_with`. Directed: the rest.

**Causal denylist** (checked *before* the allow-list; normalised: casefold, trim, spaces
and hyphens → `_`): `cause, causes, caused, caused_by, definitely_caused_by, leads_to,
led_to, results_in, resulted_in, because, because_of, due_to, drives, driven_by, effect,
effect_of, причина, вызвал, вызвало, привело_к, спричинив, спричинило, призвело_до`
→ `422 causal_relation_forbidden`. Any other unknown value → `422 invalid_relation`.
The system itself never emits causal copy; a user's own note text is not censored.

---

## 3. Reference keys (value-free item identity) — `services/system_review/refs.py`

A relation endpoint, an importance target and a frozen item carry a **ref key**, never
a value. Outer separator `|` (subject keys contain `:`).

| Prefix | Shape | Validation | Domain for filters |
|---|---|---|---|
| `change` | `change|<kind>|<subject_key>|<metric_key or ->|<period>` | kind ∈ ChangeKind, subject registered, period YYYY-MM or YYYY | subject domain |
| `subject` | `subject|<subject_key>` | registered pair; must exist for the account (facts, or the experiment row) → else 404 `ref_not_found` | subject domain |
| `fact` | `fact|<table>|<uuid>` | table ∈ {aa_observations, aa_measurements, aa_targets, aa_preferences, aa_baselines, aa_expectation_versions, aa_forecast_versions, aa_experiment_observations}; row owned → else 404 | `observation` for observation tables, else subject domain of the row |
| `context` | `context|<entity uuid>` | active finance-context entity owned → else 404 | `finance` |
| `section` | `section|<period>|<section>` | importance targets only | `review` |
| `relation` | `relation|<uuid>` | importance targets only; owned relation | `relation` |

`ChangeKind`: `finance_spend_vs_expectation, finance_spend_vs_prior,
finance_expectation_revisions, finance_target_state, finance_unplanned_repeat,
project_forecast_revisions, project_completion, experiment_lifecycle, observation`.
Max length 600. The literal `redacted` is the only other legal endpoint value (after D1).

---

## 4. M7 — `apps/api/alembic/versions/20260930_0008_aa_system_review.py`

`revision = "20260930_0008"`, `down_revision = "20260929_0007"`. Frozen SQL strings
(M5/M6 precedent); docstring states C8 (downgrade = DROP of five tables, disposable /
pre-write environments only). No existing table altered. All tables:
`id uuid PK`, `user_id uuid NOT NULL → users(id) ON DELETE CASCADE`, `created_at
timestamptz NOT NULL DEFAULT now()`, `idempotency_key text NOT NULL`,
`UNIQUE (user_id, idempotency_key)`. **No numeric column exists in the three
judgement tables** (importance, cross references, feedback).

### 4.1 `aa_importance_ratings`
```
target_key    text NOT NULL  CHECK (char_length(target_key) BETWEEN 3 AND 600)
importance    text NOT NULL  CHECK (importance IN ('none','matters','ok','ignore'))
recorded_at   timestamptz NOT NULL
status        text NOT NULL  CHECK (status IN ('active','superseded'))
supersedes_id uuid NULL → aa_importance_ratings(id)
superseded_at timestamptz NULL
CHECK ((status = 'active') = (superseded_at IS NULL))
UNIQUE INDEX uq_aa_importance_ratings_active (user_id, target_key) WHERE status = 'active'
INDEX ix_aa_importance_ratings_user_target (user_id, target_key, recorded_at)
```
No row = undecided. An explicit `none` row = "user reset". Both render «не решил»;
API returns `null` vs `"none"`.

### 4.2 `aa_cross_references`
```
source            text NOT NULL CHECK (source IN ('user','rule','ai'))
proposal_family   text NULL
proposal_model    text NULL
proposal_model_version integer NULL
proposal_key      text NULL CHECK (proposal_key IS NULL OR proposal_key ~ '^[0-9a-f]{64}$')
input_fingerprint text NULL CHECK (input_fingerprint IS NULL OR input_fingerprint ~ '^[0-9a-f]{64}$')
evidence          jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(evidence) = 'array')
from_key          text NOT NULL CHECK (char_length(from_key) BETWEEN 3 AND 600)
to_key            text NOT NULL CHECK (char_length(to_key) BETWEEN 3 AND 600)
from_domain       text NOT NULL
to_domain         text NOT NULL
relation_type     text NOT NULL CHECK (relation_type IN (<10 types>))
epistemic_kind    text NOT NULL CHECK (epistemic_kind IN ('association','hypothesis'))
period_key        text NULL CHECK (period_key IS NULL OR period_key ~ '^[0-9]{4}(-(0[1-9]|1[0-2]))?$')
status            text NOT NULL CHECK (status IN ('proposed','approved','rejected','unsure'))
note              text NULL CHECK (note IS NULL OR (btrim(note) <> '' AND char_length(note) <= 1000))
proposed_at       timestamptz NULL
responded_at      timestamptz NULL
endpoint_redacted_at timestamptz NULL
CHECK ck_…_epistemic: (relation_type IN ('may_contribute_to','may_increase_risk_of',
      'may_reduce_probability_of')) = (epistemic_kind = 'hypothesis')
CHECK ck_…_user_source: source <> 'user' OR (status = 'approved' AND proposal_key IS NULL
      AND proposal_family IS NULL AND proposed_at IS NULL)
CHECK ck_…_system_source: source = 'user' OR (proposal_key IS NOT NULL AND proposal_family
      IS NOT NULL AND proposal_model_version IS NOT NULL AND input_fingerprint IS NOT NULL
      AND proposed_at IS NOT NULL)
CHECK ck_…_no_auto_approval: source = 'user' OR ((status = 'proposed') = (responded_at IS NULL))
CHECK ck_…_distinct_endpoints: from_key <> to_key OR endpoint_redacted_at IS NOT NULL
UNIQUE INDEX uq_aa_cross_references_proposal (user_id, proposal_key) WHERE proposal_key IS NOT NULL
UNIQUE INDEX uq_aa_cross_references_manual (user_id, from_key, to_key, relation_type)
      WHERE source = 'user' AND endpoint_redacted_at IS NULL
INDEX ix_aa_cross_references_user_status (user_id, status, period_key)
INDEX ix_aa_cross_references_user_family (user_id, source, proposal_family)
```
No confidence / strength / weight / probability / score column. "System never
auto-approves" is a DB fact: a rule/ai row can be `approved` only with `responded_at`.

### 4.3 `aa_relation_feedback` (append-only events)
```
relation_id       uuid NOT NULL → aa_cross_references(id) ON DELETE CASCADE
response          text NOT NULL CHECK (response IN ('approved','rejected','unsure'))
note              text NULL CHECK (note IS NULL OR (btrim(note) <> '' AND char_length(note) <= 1000))
responded_at      timestamptz NOT NULL
input_fingerprint text NULL CHECK (… ~ '^[0-9a-f]{64}$')
INDEX ix_aa_relation_feedback_relation (relation_id, responded_at)
```
Every response (first or changed) appends one row; the relation row mirrors the latest
(`status`, `note`, `responded_at`). Nothing is updated in place except that mirror.

### 4.4 `aa_finance_contexts` (explicit user-authored finance context)
```
entity_id     uuid NOT NULL                     -- client-minted logical identity
kind          text NOT NULL CHECK (kind IN ('expense_context','obligation','reserve','essentials','self_check'))
subject_key   text NOT NULL DEFAULT ''
payload       jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object')
version       integer NOT NULL CHECK (version >= 1)
status        text NOT NULL CHECK (status IN ('active','superseded'))
supersedes_id uuid NULL → aa_finance_contexts(id)
superseded_at timestamptz NULL
recorded_at   timestamptz NOT NULL
CHECK ((status = 'active') = (superseded_at IS NULL))
CHECK ((kind IN ('expense_context','self_check')) = (subject_key <> ''))
CHECK (kind <> 'expense_context' OR subject_key ~ '^finance:transaction:[^:]+$')
CHECK (kind <> 'self_check' OR subject_key ~ '^finance:period:[0-9]{4}-(0[1-9]|1[0-2])$')
UNIQUE (user_id, entity_id, version)
UNIQUE INDEX uq_aa_finance_contexts_active_entity (user_id, entity_id) WHERE status = 'active'
UNIQUE INDEX uq_aa_finance_contexts_active_subject (user_id, kind, subject_key)
      WHERE status = 'active' AND kind IN ('expense_context','self_check')
INDEX ix_aa_finance_contexts_user_kind (user_id, kind, status)
```
Payload schemas are validated by pydantic per kind (`extra="forbid"`), decimals stored as
strings, currency `^[A-Z]{3}$`. All fields optional except where marked:

* `expense_context`: `plannedness planned|unplanned|unknown` (default `unknown`) ·
  `funding_source income|cash_balance|debit_balance|credit|borrowed|mixed|unknown`
  (default `unknown`) · `obligation_entity_id uuid?` (only with credit/borrowed/mixed) ·
  `purpose ≤300` · `motive ≤1000` · `emotional_context ≤1000` (self-report, never
  interpreted) · `worth_it yes|no|unsure|null` · `expected_recurrence
  one_off|occasional|recurring|unknown` (default `unknown`) · `recurrence_per_month
  decimal 0 < n ≤ 31` (only with occasional/recurring).
* `obligation`: `label ≤120` (required) · `obligation_kind credit_card|loan|personal_debt|other`
  · `currency` (required) · `outstanding ≥ 0` (required) · `monthly_payment > 0?` ·
  `annual_rate_percent 0–200?` · `as_of date` (required) · `planned_payoff_date date?`.
* `reserve`: `label ≤120` · `currency` · `amount ≥ 0` · `threshold ≥ 0?` · `as_of date` (required fields: currency, amount, as_of).
* `essentials`: `currency` · `monthly_amount > 0` · `as_of` (all required).
* `self_check`: `questionnaire "lifeos_debt_selfcheck_v1"` · `answers {q_id: yes|no|unknown|prefer_not}` (only known ids).

### 4.5 `aa_system_review_revisions` (Saved System Review — append-only)
```
period_kind       text NOT NULL CHECK (period_kind IN ('month','year'))
period_key        text NOT NULL
timezone          text NOT NULL CHECK (timezone <> '')
revision          integer NOT NULL CHECK (revision >= 1)
previous_revision_id uuid NULL → aa_system_review_revisions(id)
status            text NOT NULL CHECK (status IN ('draft','finalized'))
finalized_at      timestamptz NULL
context_as_of     timestamptz NOT NULL
reflection        text NULL CHECK (reflection IS NULL OR (btrim(reflection) <> '' AND char_length(reflection) <= 4000))
no_conclusion     boolean NOT NULL DEFAULT false
decisions         jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(decisions) = 'array')
adjustments       jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(adjustments) = 'array')
frozen_context    jsonb NOT NULL CHECK (jsonb_typeof(frozen_context) = 'object')
source_ids        uuid[] NOT NULL DEFAULT '{}'
redacted_at       timestamptz NULL
CHECK ((period_kind = 'month' AND period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    OR (period_kind = 'year' AND period_key ~ '^[0-9]{4}$'))
CHECK ((revision = 1) = (previous_revision_id IS NULL))
CHECK ((status = 'finalized') = (finalized_at IS NOT NULL))
CHECK (NOT (no_conclusion AND reflection IS NOT NULL))
UNIQUE (user_id, period_kind, period_key, revision)
INDEX ix_aa_system_review_revisions_period (user_id, period_kind, period_key, revision)
INDEX ix_aa_system_review_revisions_sources USING gin (source_ids)
```
Decisions / adjustments: arrays of ≤ 20 non-empty strings ≤ 500 chars (service-validated),
**user-typed only** — the system never seeds or suggests them.

AA tables **22 → 27**. `alembic heads` = `20260930_0008` only.

---

## 5. Periods and logical status — `services/system_review/periods.py`

`period=YYYY-MM` → month; `period=YYYY` → year. Window = local calendar month/year in
`timezone` (IANA, default `Europe/Kyiv`; invalid → 422 `invalid_timezone`). Year range
2000–2100 (else 422 `invalid_period`); missing → 400 `period_required`; a period that
has not started → 422 `period_in_future`.

`period_state = in_progress | ended` (ended ⇔ local today > window end).
Logical status: `IN_PROGRESS` (not ended) · `AVAILABLE` (ended, no finalized
revision) · `FINALIZED` (ended, ≥1 finalized revision; `has_newer_draft` flag when the
latest revision is a draft). A month is never auto-finalized. The logical review exists
for every started period without any row (GET creates nothing).

---

## 6. Live System Review — `GET /api/v1/aa/system-review?period=&timezone=`

Auth only; **no write gate; zero writes** (no persist parameter exists; signal rules are
called as pure modules; the handler never commits). One repeatable-read, read-only
transaction (`SET TRANSACTION READ ONLY`) so a stray write would fail loudly.

```
{ period, period_kind, timezone, window_start, window_end, evaluated_at,
  period_state, status, not_a_verdict: true,
  saved: { latest_revision: {revision, status, created_at}|null, finalized_revision: int|null, count },
  sections: {
    changed:      { items: [ChangeItem], truncated },
    improved:     { items: [ImprovedItem], truncated },
    repeated:     { items: [RepeatItem], truncated },
    tradeoffs:    { items: [TradeoffPair], truncated },
    consequences: { expenses: [ExpenseAnalysis], position: PositionSummary, truncated },
    relations:    { items: [Relation], truncated },
    requires_confirmation: { count, items: [Candidate] },
    quality:      { items: [QualityItem] } },
  linkable: [ {ref, domain, kind} ],          -- what «Связать» may target in this period
  importance: { <ref>: {importance, recorded_at} } }
```
Every numeric value is a typed value `{type, unit_code|scale, num|date}`; there is **no
top-level or cross-card numeric field**; counts are per-section integers only. Ordering
is structural (`domain_rank, subject_key, kind_rank, ref`) — never magnitude or
importance. Each group ≤ 50 items with `truncated`.

### 6.1 What changed (month)
* Finance (`aa_finance.derive_month`, read-only): `finance_spend_vs_expectation`
  (Actual vs Expectation in force, delta only same type+unit, desire from the finance
  month's own Target grounding), `finance_spend_vs_prior` (Actual vs prior month's
  Actual; **always neutral**), `finance_expectation_revisions` (versions recorded in
  window), `finance_target_state` (present / explicitly absent / none — «цель не
  задавалась», never 0). Emitted only when the month has data or references.
* Projects: forecast versions recorded in window per project (count, first→latest date,
  neutral) and completion Measurements occurred in window (Slice 5 `project_analytics`,
  dual delta, neutral). Titles come from the client snapshot (server has none).
* Experiments: lifecycle instants inside window (`started/completed/reviewed/abandoned`),
  with title; no outcome interpretation.
* Observations: non-experiment `aa_observations` occurred in window (value or
  «явно неизвестно», epistemic kind shown).

### 6.2 What improved
Only `desire == favorable` from explicit grounding: finance Target (as-of, not
explicitly absent, same window) or Preference + Baseline. Every item carries a
mandatory `basis {kind, fact_id, direction, reference}`. Expectation, Forecast, sign,
Decision, project dates: never.

### 6.3 What repeated (read-only evaluator over the existing four rules)
`repeated.py` builds explicit `SignalSubject`s for the finance periods `M-2, M-1, M`
(month view) or the 12 months (year view) and calls each rule module's
`handles/inputs/evaluate` with `now = min(period end, now)` — pure reads, no
`aa_signal_episodes` access, catalogue asserted to be 4. A rule that holds in ≥ 2 of the
windows yields `{source: rule_id, windows, coverage_disclosed}`. Plus fact-derived
recurrence: project forecast revisions in ≥ 2 of the windows per project; unplanned
expenses (explicit context) in ≥ 2 windows. Unknown-coverage windows are disclosed,
not counted. «закономерность, не приговор».

### 6.4 Trade-offs / contradictions
Pairs in the same window where both sides are grounded and one is favorable, the other
unfavorable: grounded finance change vs explicit-priority conflicts from §10.6 (Target,
obligation planned payoff date). Rendered side by side with both bases,
`causality_checked: false`; no winner/net/resolution field. Ungrounded up/down is not a
contradiction. Empty → honest empty copy.

### 6.5 Quality
Finance coverage report (observed/partial/missing/unknown/future), unknown membership,
corrections count, legacy-import flag, named missing inputs (income: *not modeled*).

### 6.6 Annual view
changed = per-month finance Actual cards (+ vs prior month), project completions and
experiment lifecycle events in the year; improved = months favorable vs their Target;
repeated = rule recurrence across the 12 months; tradeoffs = union of monthly pairs;
consequences = aggregate of explicit expense contexts (counts by plannedness × funding,
money sums per funding source **within one currency only**); relations = persisted
relations whose `period_key` is in the year. No candidate generation for the year view
(candidates are monthly; the view links to months).

---

## 7. Relations — manual, feedback, filters (`relations.py`)

* **Manual create** `POST /api/v1/aa/relations`
  `{id (client uuid v4), from_key, to_key, relation_type = 'related', note?, period?, idempotency_key}`
  → order: replay by key (same body → 200 `replayed`; different → 409
  `idempotency_key_reused`) → causal denylist → allow-list → ref validation/ownership →
  self-relation 422 → canonical order for symmetric types → natural duplicate (same
  endpoints+type, active user link) → 200 existing → insert `source=user,
  status=approved, epistemic_kind` from type. 201.
* **Respond to a proposal** `POST /api/v1/aa/relations/proposals/respond`
  `{period, proposal_key, response, note?, evaluated_at, idempotency_key}` → replay →
  re-derive candidates for `period` (read-only generator) → key not present → 409
  `proposal_not_current` → if a row with this key exists, append feedback (a changed
  answer) else insert the relation row (`source=rule`, family, model `lifeos_rules`,
  version, key, **server** fingerprint + evidence, `proposed_at = clamp(evaluated_at)`)
  + first feedback row; `status = response`. Never `approved` without a response.
* **Change answer / note** `POST /api/v1/aa/relations/{id}/feedback`
  `{response, note?, idempotency_key}` (manual links accept only `approved`, i.e. note edit).
* **Delete own link** `POST /api/v1/aa/relations/{id}/delete` `{idempotency_key}` —
  `source=user` only (else 409 `relation_not_deletable`); hard delete, feedback cascades;
  replay of the same key after deletion → 200 `{deleted: true, replayed: true}` (a
  deletion receipt is not needed: user-authored, not a fact).
* **List/filter** `GET /api/v1/aa/relations?status=&type=&source=&domain=&period=&importance=&limit=`
  (repeatable params; `period` = YYYY-MM or YYYY prefix; `importance` joins the active
  rating on `relation|<id>`). Proposed candidates are not rows; they are returned by the
  review read under `requires_confirmation`.

Each relation in responses: `{id, from, to (ref + domain + resolved label hint), type,
epistemic_kind, status, source, family, rule_version, note, proposed_at, responded_at,
evidence, evidence_changed_since_response, endpoint_redacted, history: [feedback…]}`.

---

## 8. Candidate engine (v1, deterministic, `candidates.py`) — read-only

Bounded per month: inputs loaded once (≤ 200 expense contexts, ≤ 100 observations,
≤ 10 obligations, month changes); pre-filtered before pairing; ≤ 30 candidates out;
complexity O(E·O) with E ≤ 200, O ≤ 100 and ±3-day pre-bucketing by local date.

| Family (`proposal_family`) | When (all inputs explicit) | Pair | Type / epistemic |
|---|---|---|---|
| F1 `finance_credit_obligation` | expense context `funding ∈ {credit, borrowed, mixed}` and `obligation_entity_id` names an active obligation | `subject|finance:transaction:X` → `context|<obligation>` | `may_contribute_to` / hypothesis |
| F2 `finance_emotional_context` | expense context `plannedness = unplanned` and non-empty `emotional_context` | `context|<expense ctx>` → `subject|finance:transaction:X` | `may_contribute_to` / hypothesis |
| F3 `observation_temporal` | non-experiment observation occurred within ±3 local days of an unplanned expense | observation ↔ expense | `temporally_associated` / association |
| F4 `finance_repeated_unplanned_obligation` | ≥ 2 unplanned expenses in month and ≥ 1 active obligation | `change|finance_unplanned_repeat|finance:period:M|-|M` → `context|<obligation>` | `may_increase_risk_of` / hypothesis |
| F5 `period_cross_domain` | finance month change with a known delta vs prior **and** project forecast revisions / experiment lifecycle events in the same month (≤ 10 pairs) | change ↔ change | `co_occurs_with` / association |
| F6 `experiment_observation_temporal` | non-experiment observation occurred inside a RUNNING/completed experiment's window within the month | `subject|experiment:experiment:E` ↔ observation | `temporally_associated` / association |

Not generated (not represented): "no active paid project", income, anything from
experiment-attached conditions (the user already attached them).

**Identity.** `proposal_key = sha256("v1|" + family + "|" + from + "|" + to + "|" + period)`
— the occurrence (user-facing identity). `input_fingerprint = sha256(sorted evidence
version ids + "rule_version=1")` via the shared `rules.input_fingerprint` helper —
exact evidence. Same key → same candidate (no duplicate); a new period or different
endpoints → a new occurrence. A key with any response row is **never re-proposed**
(rejected stays rejected, unsure is not re-counted); if the fingerprint later differs the
relation shows `evidence_changed_since_response` (unsure → `revisit_eligible`, listed,
never counted in «Требует подтверждения»).

**Why suggested.** Each candidate carries `explanation {family, conditions: [...],
window}` (structured; copy is client-side) + `evidence [{ref, role}]` + `rule_version`.

**Ranking (acceptance history, never truth).** For each family, counts of current
statuses over `source='rule'` rows: `a, r, u`. Candidates sorted by
`(−(a+1)/(a+r+2), family_order, proposal_key)`; returned with `rank` (1..n) and
`history {approved:a, rejected:r, unsure:u}`. The ratio is never returned, never shown
and never called confidence; type, epistemic kind and status are unaffected.

---

## 9. Importance (`importance.py`)

`POST /api/v1/aa/importance {target_key, importance, idempotency_key}` → replay →
validate target (`refs`, incl. `section|…`, `relation|…`) → advisory xact lock on
`(user, target_key)` → supersede active → insert active. 201/200. Importance affects
only client-side ordering/filtering the user asks for ("важное сначала") and the
`importance` relation filter; never grouping, never derivation, never a number.

---

## 10. Consequence intelligence (`consequences.py`, pure math + assembly)

For each active `expense_context` whose transaction's **live** AA measurement occurred
in the window (amount/date/category from the measurement; if none → item state
`source_unavailable`, no numbers):

`ExpenseAnalysis {ref, expense{amount, date, category_id}, context{…user-entered…},
picture{reserve|missing, obligations[], essentials|missing, income: not_modeled,
month{actual, target, expectation}}, impacts[Impact], attention[Flag], missing_inputs[]}`

`Impact {kind, state: computed|needs_input|not_applicable, inputs[], assumptions[],
calculation{formula_id, steps[]}, horizon, result{…typed…}, missing_inputs[],
limitations[]}`. No impact is emitted as "computed" when an input is missing. All
arithmetic in `Decimal`, money quantized to 0.01; **currencies must be equal** or the
impact is `not_applicable` with `limitation: currency_mismatch` (no conversion).

1. **budget_deviation** — needs month Actual (availability present) and a Target (not
   explicitly absent) and/or Expectation in UAH. `over_target = actual − target`;
   `vs_expectation = actual − expectation` (descriptive, labelled «не оценка»);
   `expense_amount` shown beside. Missing both → `needs_input [target_or_expectation]`.
2. **repeat_scenario** — needs `expected_recurrence ∈ {occasional, recurring}` and
   `recurrence_per_month = n`. `monthly = amount × n`; `twelve_months = monthly × 12`
   (horizon 12 months; assumption: same amount each time). Else `needs_input [recurrence_per_month]`.
3. **debt_projection** — needs funding ∈ {credit, borrowed, mixed} **and** a linked
   obligation with `outstanding`, `monthly_payment`, `annual_rate_percent` (0 allowed),
   same currency. Monthly simulation `B₍k+1₎ = B₍k₎·(1 + i/12) + add − P`,
   cap 600 months. A = as entered; B (one-off) = +amount only if expense date >
   obligation `as_of` (else explained «сумма могла уже входить в остаток»; not added);
   C (repeated) = add `amount × n` monthly (needs recurrence). Outputs payoff months,
   payoff date (`as_of + k months`), delta months/days, total interest; states
   `does_not_decrease` when `P ≤ B·i/12 + add`, `beyond_horizon` at 600 months.
   Missing any input → `needs_input [...]`.
4. **reserve_projection** — needs funding ∈ {cash_balance, debit_balance} and a reserve
   (same currency). One-off: `after = amount_reserve − amount` if expense date > reserve
   `as_of`. Repeated: `draw = amount × n`; `months_to_threshold = floor((reserve −
   threshold) / draw)`; threshold missing → computed to 0 **with the explicit assumption
   «порог не задан — расчёт до нуля»**. Assumption always shown: «прочие поступления и
   расходы не учитываются» (income not modeled).
5. **essentials_risk** — needs reserve + essentials (same currency):
   `coverage_now = reserve / essentials`, `coverage_after_month = (reserve − draw) /
   essentials` (draw = repeated or one-off amount). Otherwise not emitted / needs_input.
6. **priority_conflict** — explicit only: month Actual above a lower-direction Target
   (`target_exceeded`), or debt projection B/C payoff date later than the obligation's
   `planned_payoff_date` (`payoff_after_planned_date`).

**Attention flags** (enumerated, each lists the exact conditions that raised it; no
level, no score): `unplanned_credit_funded` (plannedness=unplanned ∧ funding ∈ credit/
borrowed) · `repeated_unplanned_in_period` (≥ 2 unplanned in window) ·
`debt_payoff_moves_later` (Δ > 0 days) · `reserve_reaches_threshold_within_12_months` ·
`target_exceeded` · `user_marked_not_worth_it` (worth_it = no).
Copy example (client): «Незапланировано, оплачено кредитом; при текущих допущениях о
погашении проекция закрытия сдвигается на 11 дней.» Never «плохая покупка», never a
number out of 100.

**Position summary** (review level): active obligations / reserve / essentials with
`as_of`; missing ones named («нужен ввод»), income «не моделируется».

---

## 11. Self-check (`selfcheck.py`) — «Самопроверка LifeOS (не клинический тест)»

Questionnaire `lifeos_debt_selfcheck_v1`, answers `yes | no | unknown | prefer_not`:
`q_know_total` (know exact total owed) · `q_repayment_plan` (concrete repayment plan) ·
`q_payments_delayed` (delays in last 3 months) · `q_new_spend_on_credit` (new
non-essential spending on credit/borrowing) · `q_avoid_checking` (avoid checking
balance/debt) · `q_income_sufficient` (expect income sufficient for planned repayment) ·
`q_pattern_repeat` (believe the pattern will likely repeat).
Indicators: `q_know_total=no, q_repayment_plan=no, q_payments_delayed=yes,
q_new_spend_on_credit=yes, q_avoid_checking=yes, q_income_sufficient=no,
q_pattern_repeat=yes`. Flag `repayment_friction_pattern_worth_reviewing` iff ≥ 2
indicators; response lists `triggered_by` (question ids + answers), `rule
"≥2 of 7 indicators"`, `not_clinical: true`. `unknown`/`prefer_not` never count.
Offered when an active obligation exists (and highlighted when F1/F4 conditions hold);
stored as `self_check` context per month. Copy: «Возможно, есть повторяющееся
затруднение с погашением, которое стоит рассмотреть.» Never a diagnosis.

---

## 12. Finance context API (`contexts.py`)

* `POST /api/v1/aa/finance-contexts {entity_id, kind, subject_key?, payload,
  idempotency_key}` → replay → validate payload by kind → advisory lock `(user,
  entity_id)` → if active version exists: must be same kind/subject (else 409
  `finance_context_conflict`), supersede it; `expense_context`/`self_check` also
  unique per subject (a second entity for the same subject → 409). New version = max+1.
* `POST /api/v1/aa/finance-contexts/{entity_id}/delete {idempotency_key}` → hard
  delete every version of the entity (user's explicit deletion of possibly sensitive
  text) **and** in the same transaction run the Slice 7 redactors with source
  `("aa_finance_contexts", entity_id)`: frozen review items redacted, relation endpoints
  redacted, importance on `context|<entity>` erased. Replay after deletion → 200.
* `GET /api/v1/aa/finance-contexts?kind=` → active versions (for forms).
Sensitive text never enters relation rows, evidence, candidates' explanations or logs;
candidates reference the context by ref only.

---

## 13. Saved System Review (`revisions.py`)

`POST /api/v1/aa/system-reviews/{period}/revisions`
`{base_revision: int|null, finalize: bool, reflection?, no_conclusion, decisions[],
adjustments[], timezone, idempotency_key}`:
1. replay by key (same period → 200 `replayed`; other → 409 `idempotency_key_reused`);
2. validate period (started), finalize ⇒ period ended (else 422 `period_not_ended`),
   `no_conclusion ⇒ reflection empty`;
3. `current = max(revision)`; `base_revision ≠ current` → 409 `revision_conflict`
   (deterministic; response carries `current_revision`);
4. freeze: build the live review at server `now` (same read model), convert to
   `frozen_context {manifest_version: 1, sections: {…items with sources…},
   relations_snapshot, pending_proposals_count, quality}`; `source_ids` = every fact id
   and context entity id referenced by any item;
5. insert revision `current+1` (`previous_revision_id`, `status = finalized|draft`,
   `finalized_at`), commit; unique violation → replay-by-key or 409 `revision_conflict`.
Reads: `GET …/revisions` (list: revision, status, created_at, finalized_at,
redacted_at, sizes), `GET …/revisions/{n}` (frozen context exactly as saved + user
content + live `sources_changed` flag computed by comparing the live source manifest —
corrected/new data changes the **live** review only; revision 1 is never rewritten).

---

## 14. Waiting — `GET /api/v1/aa/system-review/waiting?timezone=`

* **review_available** `{count, items}` = experiments in `COMPLETED_AWAITING_REVIEW`
  + ended months among the 12 months before the current one that have AA evidence
  (transaction measurement occurred, finance Expectation/Target for the period, project
  forecast recorded / completion occurred, experiment instant, non-experiment observation,
  finance context recorded) and **no finalized** month revision + the previous calendar
  year if it has evidence and no finalized year revision. Current month/year never.
  Project/Finance Slice 4 Reviews are **not** counted.
* **requires_confirmation** `{count, items, horizon_months: 3}` = live candidates of the
  current and the two previous months whose key has no row. Separate count, never merged.
Clicking a count opens `#/system-review/waiting` with the exact items.

---

## 15. Redaction / privacy (`redaction.py`, registered in `aa_deletion.SOURCE_REDACTORS`)

Three adapters (same transactional contract as `redact_review_context`: no commit, no
content logging, no link left behind), appended **through the facade**:
1. `redact_system_review_sources(db, user_id, table, id)` — revisions with
   `id = ANY(source_ids)`: every frozen item whose sources include `(table, id)` becomes
   `{section, kind, ordinal, redacted: true, redaction_reason: 'source_hard_deleted'}`;
   the id is removed from `source_ids`; `redacted_at = now`. User reflection /
   decisions / adjustments untouched.
2. `redact_relation_endpoints(…)` — relations whose `from_key`/`to_key` embed the id
   (`fact|table|id`, `context|id`) → endpoint `'redacted'`, `endpoint_redacted_at`;
   evidence entries embedding it → `{"ref": "redacted", "role": …}`. Note/status kept.
3. `erase_importance_for_source(…)` — delete ratings whose `target_key` embeds the id.
Account deletion: `users` cascade (all five). Export: all rows, all statuses (superseded
importance, superseded contexts, every feedback event, every revision incl. redaction
markers). Retention: unlimited default, no pruning, Slice 8 governs later
(`created_at`/`recorded_at` present on every row for that).

---

## 16. Exports (`exports/`)

`GET /api/v1/aa/system-reviews/{period}/revisions/{n}/export?format=pdf|docx|xlsx|md&locale=ru|uk`
(auth only, read-only). One neutral report model (`document.py`: title, meta, notice,
summary counts, sections as tables/paragraphs, user content, provenance, redaction
markers) rendered by four writers — redaction therefore identical in every format.
Server-side export labels (RU/UK) live in `exports/labels.py` (the only server copy).

* **MD** — stable headings (`#`, `##`), GFM tables, UTF-8, cells escaped (`|`, newlines).
* **XLSX** — sheets `Summary, Facts, Relations, Consequences, User Decisions, Provenance`;
  strings as inline strings, numbers as numbers, dates as ISO text; strings starting with
  `= + - @ \t \r` stored with `quotePrefix` style (never a formula; no `<f>` element exists).
* **DOCX** — WordprocessingML with Heading1/2 styles and real tables; editable.
* **PDF** — PDF 1.7, A4, DejaVu Sans / Bold embedded as CIDFontType2 (Identity-H) with a
  glyph subset and `ToUnicode` (extractable text), word-wrapped paragraphs and tables,
  page numbers. No raw JSON body.
Filenames `lifeos-system-review-<period>-r<n>.<ext>`; `Content-Disposition: attachment`;
`Cache-Control: no-store`. Account ZIP (`GET /api/v1/export`) unchanged in shape; the five
tables join `EXPORT_TABLES`.

---

## 17. Error map (added to `routes/aa_measurements._ERROR_STATUS`)

`invalid_relation 422 · causal_relation_forbidden 422 · self_relation 422 · invalid_ref 422
· ref_not_found 404 · relation_not_found 404 · relation_not_deletable 409 ·
proposal_not_current 409 · invalid_importance 422 · invalid_period 422 · period_in_future
422 · period_not_ended 422 · revision_conflict 409 · revision_not_found 404 ·
invalid_system_review 422 · invalid_finance_context 422 · finance_context_not_found 404 ·
finance_context_conflict 409 · invalid_export_format 422` (+ existing
`idempotency_key_reused 409`). Route classes map `RequestValidationError` to the
surface's `invalid_*` code. Writes: `require_json_content_type` + write gate as route
dependencies (415 before 422), `enforce_same_origin`, body `user_id` → 422.

---

## 18. Durable queue (frontend) — no queue/coordinator/replay change

| op | route | notes |
|---|---|---|
| `relation.create` | `/api/v1/aa/relations` | client UUID v4 `id` |
| `relation.respond` | `/api/v1/aa/relations/proposals/respond` | `period, proposal_key, evaluated_at` |
| `relation.feedback` | `/api/v1/aa/relations/{id}/feedback` | |
| `relation.delete` | `/api/v1/aa/relations/{id}/delete` | only for user links |
| `importance.set` | `/api/v1/aa/importance` | |
| `finance_context.append` | `/api/v1/aa/finance-contexts` | client UUID `entity_id` |
| `finance_context.delete` | `/api/v1/aa/finance-contexts/{entity_id}/delete` | |
| `system_review.revision` | `/api/v1/aa/system-reviews/{period}/revisions` | one pending per period (UI disables while pending) |

Keys minted by the queue at enqueue. UI shows queued items as «ещё не подтверждено
сервером» and re-reads server truth after the queue drains; a pending proposal answer
does **not** decrement «Требует подтверждения» until the server acknowledged it. T-12
(snapshot 409 ⟂ AA queue) re-asserted with the new ops.

---

## 19. Frontend

* API `api/analytics/systemReview.ts` (+1 facade line): reads, export download (blob).
* Builders/routing `analytics/systemReviewFacts.ts` (queue requests, hash grammar,
  period helpers), queue reads `analytics/systemReviewQueue.ts`.
* `AnalyticsContext`: `readSystemReview, readSystemReviewWaiting, listRelations,
  listRevisions, readRevision, listFinanceContexts, enqueueSystemReview,
  pendingSystemReviewWrites`.
* Route `system-review` (lazy, analytics-gated, Sidebar item «обзор системы»):
  `#/system-review` (current month) · `#/system-review/YYYY-MM` · `#/system-review/YYYY` ·
  `…/<period>/tradeoff` (J1) · `…/<period>/revisions/<n>` · `#/system-review/waiting`.
  `LIFE_ROUTES` 21 → 22.
* Page shell `pages/analytics/SystemReviewPage.jsx`; internals
  `pages/analytics/system/{route.js, format.js, Header.jsx, Sections.jsx, Tradeoff.jsx,
  Relations.jsx, LinkDialog.jsx, Proposals.jsx, Consequences.jsx, ContextForms.jsx,
  SelfCheck.jsx, SavedReview.jsx, Revisions.jsx, Waiting.jsx}`;
  `components/analytics/AAImportance.jsx` (menu, `menuitemradio`, Escape/outside close,
  focus return). Dialogs reuse `components/useDialog.js`.
* Visual: J classes ported to `analytics.css` (`.aa-banner, .aa-changes, .aa-change*,
  .aa-pair*, .aa-sr-*, .aa-checkline, .aa-checkbox, .aa-mini*, .aa-warn-note`) + a Slice 7
  block (`.aa-rel*`, `.aa-hyp` dashed "гипотеза" marker with text label, `.aa-proj*`
  assumptions directly under results, `.aa-filter*`). Hypothesis vs association vs
  approved/rejected/unsure distinguishable by text label + border style, not colour only.
  No demo chrome, no fixture domains.
* RU + UK copy for every new key (`aa_sr_*`, `nav_system_review`); English stays off.

---

## 20. Tests

Backend (new): `test_aa_system_review_migration.py` (M7 roundtrip on `lifeos_test`,
CHECK/enum parity, single head, 27 tables, no numeric column in judgement tables) ·
`test_aa_relations.py` (S7-01…11, 35, 45) · `test_aa_system_review.py` (S7-12, 13, 18…25,
27…29, 50, repeated/rules=4) · `test_aa_system_review_revisions.py` (S7-14, 15, 49) ·
`test_aa_consequences.py` (S7-30…34, finance scenario §37) · `test_aa_system_review_privacy.py`
(S7-16, 17, 26, 38, 39, 44) · `test_aa_system_review_exports.py` (S7-40…43).
Updated pins: head `20260930_0008` (export manifest ×4, project analytics, reviews
head tests), `TRUNCATED_TABLES` +5.
Frontend (new): `analytics-system-review.test.ts` (builders, hash grammar, queue ops,
S7-46/47/48 with the coordinator) · `analytics-system-review.test.jsx` (sections, empty
states, hypothesis label, proposal buttons + pending state, link dialog, filters,
consequence missing inputs, self-check transparency, saved review/finalize/revise,
waiting counts separate, RU/UK S7-36/37). Updated pins: `LIFE_ROUTES` size, lazy
loaders, locale counts.

---

## 21. Commits

1. docs: Slice 7 final reconciliation + Plan
2. M7 + models + enums + export/TRUNCATE/redactor registries
3. relations + importance + finance contexts services/routes
4. read-only System Review derivation (changes, repeated, tradeoffs, quality, candidates, waiting)
5. saved revisions + redaction
6. consequence engine + self-check
7. frontend (API, context, pages, CSS, RU/UK)
8. exports
9. QA fixes
10. report + master context + module boundaries

## 22. Rollback

Behaviour: close the AA write gate (writes stop; reads stay pure) or revert the merge.
Schema: M7 downgrade drops the five tables — only on disposable / pre-write environments
(C8). After personal Slice 7 history exists in production, never downgrade; keep the
tables and roll back behaviour.

```
FINAL_PLAN_STATUS=FINAL
OWNER_DECISIONS_OPEN=0
M7=20260930_0008 (down 20260929_0007)
NEW_TABLES=aa_importance_ratings,aa_cross_references,aa_relation_feedback,aa_finance_contexts,aa_system_review_revisions
AA_TABLES=22→27
SIGNAL_RULES=4 (unchanged)
DEPENDENCIES_ADDED=none (DejaVu font asset only)
```
