# LifeOS · Adaptive Analytics · Slice 7 · System Review, Relationship & Consequence Intelligence — Implementation Report

Status: **implemented and validated on `feat/adaptive-analytics-slice-7-system-review-intelligence`**.
No deploy. Normal merge-commit PR.

## 1. Start state and sources

| Item | Value |
|---|---|
| Start `main` / `origin/main` | `fffcd4b3d7edaefa87a1b117634c8bfad7caf6d9` (PR #17 merge; contains Slice 6 PR #16 and Calendar PR #17) |
| Checkout | canonical `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem`, clean, one worktree |
| Recovery stash | `51184836ace557fbd9492527bd845329b17b2a76` (stash@{0}), untouched |
| Frozen tag | `adaptive-analytics-design-accepted` → tag `6c507b82…` → commit `d4960286…`, unmoved |
| Owner decisions | Slice 7 master prompt (OD-7.1, OD-7.2 = B + C, OD-7.3) — all RESOLVED; `OWNER_DECISIONS_OPEN=0` |
| Read in full | `AGENTS.md`, `CLAUDE.md`, `LIFEOS_MASTER_CONTEXT.md`, `Outputs/architecture/module-boundaries.md`, the three `_parallel_planning/slice7/` files, Slice 6 and Calendar reports, frozen J (`system.jsx`, `analytics.css`), the relevant code |
| Reconciliation | `Outputs/Discoveries/lifeos-adaptive-analytics-slice-7-final-reconciliation_20260929-234900.md` |
| Final Plan | `Outputs/Plans/lifeos-adaptive-analytics-slice-7-system-review-intelligence-final-plan_20260929-234900.md` (committed before M7) |

## 2. Baseline (before any production change)

backend **602 passed** (`lifeos_test`), ruff/compileall clean, Alembic head/current
`20260929_0007`, **22** AA tables, **4** signal rules; frontend **495 passed / 39 files**,
typecheck/lint/build/build --manifest clean, entry JS 319.72 kB, no 500 kB warning; static
import cycles backend 0 / frontend 0; `LIFE_ROUTES` 21.

## 3. Commits

| SHA | Commit |
|---|---|
| `f3b2757` | docs: Slice 7 final reconciliation and Plan |
| `4f3d008` | M7 persistence foundation (+ export/TRUNCATE/redactor registries) |
| `5defba7` | relation, importance and finance-context services |
| `3523a3a` | read-only System Review derivation, proposals and consequences |
| `38e8547` | append-only saved revisions |
| `2925cbd` | PDF / DOCX / XLSX / MD exports |
| `cc3dd45` | API routes + backend test matrix |
| `108bee2` | frontend (route, pages, queue ops, CSS, RU/UK) + tests |
| `88e31fc` | fixes found in browser/export QA |
| (this) | report, module boundaries, master context |

## 4. M7 — exact schema

`alembic/versions/20260930_0008_aa_system_review.py`: **revision `20260930_0008`, down_revision
`20260929_0007`**, frozen SQL, C8 docstring; downgrade drops only the five tables. No existing
table altered; `user_snapshots.schema_version` stays 2. **AA tables 22 → 27** (mapped =
`EXPORT_TABLES` = DB = 27). Single head/current `20260930_0008`.

| Table | Purpose | Key constraints |
|---|---|---|
| `aa_importance_ratings` | user-owned importance, append-only | `importance ∈ none/matters/ok/ignore`; one active per `(user, target_key)` (partial unique); active⇔no `superseded_at`; **no numeric column** |
| `aa_cross_references` | relation identity + current status | 10 types CHECK; `epistemic_kind ∈ association/hypothesis` **tied to the type** (`may_*` ⇔ hypothesis); user source ⇒ `approved` and no proposal metadata; rule/ai source ⇒ family, model, version, sha256 key and fingerprint, `proposed_at`; **`status='proposed'` ⇔ `responded_at IS NULL`** (the system cannot approve itself); distinct endpoints unless redacted; unique proposal occurrence; unique active user link |
| `aa_relation_feedback` | append-only answers | `response ∈ approved/rejected/unsure`; FK cascade to relation |
| `aa_finance_contexts` | explicit user-authored finance context, versioned per entity | `kind ∈ expense_context/obligation/reserve/essentials/self_check`; subject rules per kind; one active version per entity; one active expense context per transaction / self-check per month; payload must be a JSON object |
| `aa_system_review_revisions` | Saved System Review, append-only | month/year period CHECKs; `(user, kind, key, revision)` unique; revision 1 ⇔ no predecessor; finalized ⇔ `finalized_at`; `NOT (no_conclusion AND reflection)`; `source_ids uuid[]` + GIN index for redaction |

All five: `user_id → users ON DELETE CASCADE`, `(user_id, idempotency_key)` unique, in
`EXPORT_TABLES` and `TRUNCATED_TABLES`. Tests: `test_aa_system_review_migration.py`
(roundtrip on `lifeos_test`, enum ⇄ CHECK parity for 9 constraints, DB backstops, no score-like
or numeric judgement columns).

## 5. Relation epistemic model, proposals, feedback, ranking

* Five layers kept apart: **fact** = the endpoints (changes, subjects, observations,
  contexts); **association** / **hypothesis** = `epistemic_kind`; **projection** = consequences
  (never stored as relations); **user confirmation** = relation status.
* Vocabulary: `related, temporally_associated, co_occurs_with, conflicts_with, supports,
  preceded_by, followed_by` (association) · `may_contribute_to, may_increase_risk_of,
  may_reduce_probability_of` (hypothesis). Causal words (`caused, caused_by,
  definitely_caused_by, leads_to, because, due to, причина…`) → **422
  `causal_relation_forbidden`** before the allow-list.
* Endpoints are value-free **ref keys** (`change|…`, `subject|…`, `fact|table|id`,
  `context|id`); `section|…`/`relation|…` are importance targets only.
* **Manual «Связать»**: `source=user`, `status=approved`, default `related`, optional note,
  canonical order for symmetric types, natural duplicates replay, hard delete of own links.
* **Candidates (v1, deterministic, read-only)** — six families, each on explicit inputs only:
  credit-funded expense ↔ named obligation (hypothesis); emotional self-report ↔ unplanned
  expense (hypothesis); observation within ±3 days of an unplanned expense (association);
  repeated unplanned spending ↔ obligation (hypothesis); same-month finance change ↔ project
  revision / experiment event (association); observation inside an experiment window
  (association). Not generated: "no active paid project" (not represented), income.
  Bounds: ≤200 contexts, ≤100 observations, ≤10 obligations, ≤10 cross-domain pairs, ≤30 out;
  observations bucketed by local date before pairing (no O(N²) over history).
* **Identity**: `proposal_key = sha256(v1|family|from|to|period)` (occurrence);
  `input_fingerprint = sha256(sorted evidence version ids + rule version)`. A GET never
  persists a candidate; the row is created at the first answer with the **server's own
  re-derivation** (unknown key → 409 `proposal_not_current`). Answered keys are never
  re-proposed; later evidence changes show `evidence_changed_since_response` (`unsure` →
  `revisit_eligible`, never counted).
* **Ranking**: per family, Laplace-smoothed approval share over the user's past answers,
  then fixed family order, then key. Only order changes; the share is never returned or shown;
  type/epistemic kind/status untouched; UI says «это не уверенность и не вероятность».

## 6. Live System Review (OD-7.2 B)

`GET /api/v1/aa/system-review?period=YYYY-MM|YYYY` — READ ONLY repeatable-read transaction,
no persist flag exists; tested: every Slice 7 GET (review month/year, waiting, relations,
contexts, revisions, revision+compare, export) writes **zero rows** with the write gate open.
Sections: changed (finance month vs expectation / prior / target state / expectation
revisions; project forecast revisions and completions via the Slice 5 helper; experiment
lifecycle events; free observations), improved (Target grounding only, mandatory `basis`),
repeated (the **four existing rules re-evaluated as pure modules** for M-2..M, or the 12 months;
forecast-revision and unplanned-expense recurrence; unknown-coverage windows disclosed),
trade-offs (grounded favorable × unfavorable pairs incl. explicit priorities,
`causality_checked:false`), consequences, relations, requires confirmation, quality. Structural
order only; no top-level number; sources stripped from the live response. Annual view: per-month
finance cards, year project/experiment events, recurrence across 12 months, funding summary
(counts + same-currency sums), no candidates.

## 7. Saved System Review (OD-7.2 C)

`POST /api/v1/aa/system-reviews/{period}/revisions` appends revision N+1 (draft or finalized)
with reflection / no-conclusion / decisions / adjustments (user-typed only) and a **frozen**
copy of the live review with per-item sources; `base_revision` mismatch → 409
`revision_conflict` with `current_revision`; a lost unique race → replay-by-key or 409
(tested with 4 concurrent saves: exactly one 201). Finalize only after the period ended.
Status: IN_PROGRESS / AVAILABLE / FINALIZED (+ `has_newer_draft`), never auto-finalized.
History list, exact revision read, `compare=true` flags "live evidence changed since".
Corrected source → live changes, saved revision unchanged (tested).

## 8. «Ревью доступно» / «Требует подтверждения» (OD-7.3)

`GET /api/v1/aa/system-review/waiting`: **review available** = experiments in
`COMPLETED_AWAITING_REVIEW` + ended months among the previous 12 with AA evidence and no
finalized month revision + the previous year with evidence and no finalized year revision.
Current month/year never; Slice 4 per-subject Reviews never. **Requires confirmation** = live
unanswered candidates of the current and two previous months (`horizon_months: 3`, stated in
the UI). Separate lists, never merged. No fifth signal rule (catalogue asserted = 4).

## 9. Consequence engine and finance context

Explicit, versioned `aa_finance_contexts` (expense: plannedness, funding source, named
obligation, purpose, motive, emotional self-report, worth-it, recurrence + frequency;
obligation: label/kind/currency/outstanding/payment/rate/as_of/planned payoff; reserve;
essentials; self-check). Nothing inferred; «не знаю» default; free text never copied into
relations, proposals, evidence or logs (tested).

Impacts (each: inputs with origin, assumptions, calculation, horizon, result, missing inputs,
limitations; `needs_input` instead of any guessed number; same currency only):
budget deviation (vs Target / vs Expectation "не оценка"), repeat scenario (amount × n,
× 12), **debt payoff** (monthly amortisation, fixed payment/rate, 600-month cap,
`does_not_decrease`, day-precise final partial payment; A as entered / B with this expense /
C if repeated; shifts in days), reserve (months to threshold; missing threshold → explicit
"до нуля" assumption), essentials coverage, explicit priority conflicts (Target exceeded,
payoff after the user's planned date). Attention flags list the exact conditions that raised
them. §37 scenario tested end-to-end: 180 UAH unplanned credit, obligation 20 000 / 2 000 /
24 % → payoff 2027-08-09 → 2027-08-13 (+4 days) → 2027-11-13 if repeated 2×/month (+96 days),
₴360/month, ₴4 320/12 months, emotional self-report ↔ expense proposed as a hypothesis.

**Self-check** «Самопроверка LifeOS (не клинический тест)»: 7 questions, answers
yes/no/unknown/prefer-not; one note iff ≥ 2 indicators; shows exactly which answers triggered
it and the rule; unknown/prefer-not never count; no diagnosis vocabulary anywhere (tested).

## 10. Exports

`GET …/revisions/{n}/export?format=pdf|docx|xlsx|md&locale=ru|uk` from one neutral report
model (redaction identical in all formats). Stdlib-only writers: MD (escaped GFM), XLSX (typed
numbers, inline strings, **no `<f>` ever**, `quotePrefix` for `= + - @ \t \r`), DOCX (real
headings/tables, editable), PDF 1.7 (A4, embedded **subset DejaVu Sans / Bold**,
CIDFontType2 Identity-H + ToUnicode, wrapped tables, page numbers). Account ZIP export carries
all five tables (all statuses). **Dependencies added: none**; asset added: DejaVu fonts +
license (`app/services/system_review/exports/fonts/`, 1.4 MB; must be included if the API is
ever packaged as a wheel).

Export QA (real files from the QA account, revision 2 with redactions): `pdfinfo` → A4, 5
pages, PDF 1.7, no warnings; `pdftotext` → Cyrillic title, «источник удалён», decisions;
page images reviewed (no tofu, readable tables); LibreOffice headless: XLSX → 6 sheets as CSV,
`=HYPERLINK("…")` stays literal text; DOCX → text with headings and tables (UK); MD valid
UTF-8 with stable headings. Generated QA files were not committed.

## 11. Privacy / redaction / queue

* Three D1 adapters appended to `SOURCE_REDACTORS` (through the facade): frozen revision items
  (**per item / per impact** — deleting one transaction redacts only what it fed), relation
  endpoints/evidence (`redacted`), importance of erased items; the id leaves `source_ids`.
  Reflection, decisions, adjustments, relation notes/status survive (tested). Deleting a finance
  context hard-deletes all its versions and runs the same adapters.
* Account deletion: users cascade; zero rows in all five tables (tested).
* Queue: 8 new op types on the unchanged FIFO/single-flight/head-blocking queue; keys minted at
  enqueue; deletes are POST routes; T-12 re-asserted with Slice 7 ops (snapshot 409 ⟂ AA; AA 409
  ⟂ snapshot); retry after lost ack reuses the key (no duplicate).

## 12. Frontend

Route `system-review` (lazy, analytics-gated, Sidebar «обзор системы»): month, year,
`/tradeoff` (J1), `/revisions/<n>`, `/waiting`. `LIFE_ROUTES` 21 → 22. Sections as in §6 plus
position/context forms, expense analyses with assumptions under each result, self-check,
relations with filters (type/status/source/domain/importance) and a text + dashed-border
hypothesis marker, proposal cards («Подтвердить / Не связано / Не уверен» + "почему
предложено" + family history), «Связать» dialog (useDialog focus trap/Escape/focus return),
`AAImportance` menu (menuitemradio, arrows, Escape), saved review (draft / finalize / new
revision, history, PDF/DOCX/XLSX/MD). Pending queue answers show «ждёт отправки — пока не
учтён» and never decrement counts. J classes ported to `analytics.css` without demo chrome.
RU/UK: +506 keys each (ru 1118 → 1625, uk 1117 → 1624 incl. `nav_system_review`).

## 13. Browser QA (production build, `vite preview`, local API on `lifeos_test`)

Seeded through the real API (throwaway QA account; July/August/September 2026 and December
2025 transactions, Target/Expectation, observation, obligation/reserve/essentials, three
expense contexts, self-check, answered proposals, manual link, draft + finalized revisions,
one hard-deleted transaction, an experiment awaiting review).

* Headless Chrome (DevTools protocol) matrix: 3 themes × 6 widths (320/390/768/1024/1440/1920)
  × 8 screens (populated month, trade-off, in-progress month, empty month, annual, finalized
  revision with redaction, draft revision, waiting) = 144 loads + 6 Home baselines. **0 console
  errors** except the expected pre-login `GET /auth/me` 401. First run found 320/390 px
  overflow caused by native selects → fixed; second run: overflow only paradise 768 px (+28 px),
  identical on untouched `#/home` → pre-existing, not attributable. 38 full-page screenshots
  reviewed (dark/light/paradise, 390/1440).
* Interactive (Chrome): answer from «Ждёт вас» (count 4 → 3 only after server ack); API down →
  answer shows pending, count unchanged → API back + `online` → drained once, count 3 → 2;
  «Связать» with a hypothesis type + note (stored approved/hypothesis, focus returned);
  dialog Escape + focus return; importance menu keyboard; save draft → revision 3 appended,
  1–2 untouched; all four exports 200 with correct media types; UK locale on six screens:
  no untranslated keys, no Russian-only letters outside seeded user text, overflow 0.
* QA fixes (`88e31fc`): self-check raw keys, unknown-vs-partial coverage tag, plural copy,
  select overflow, tag stretch, waiting labels, export wording/order.

## 14. Validation (final, actual)

| Check | Result |
|---|---|
| `apps/api: python -m pytest` (`lifeos_test`) | **674 passed** (602 → 674) |
| ruff / compileall | pass / pass |
| `alembic heads` / `current` | `20260930_0008 (head)` / `20260930_0008 (head)` |
| DB `aa_%` tables | 27 |
| `apps/web: npm test` | **522 passed / 41 files** (495 → 522) |
| typecheck / lint / build / build --manifest | pass / pass / pass / pass |
| `git diff --check` | pass |
| import cycles | backend 0, frontend 0 |
| signal rules | 4 (tested) |
| bundle | entry JS 319.72 → **321.10 kB** (97.33 kB gzip); new lazy `SystemReviewPage` 77.37 kB (18.38 kB gzip); `LocaleContext` 130.91 → 200.23 kB (RU/UK copy); CSS 163.17 kB; no 500 kB warning |

New suites: `test_aa_system_review_migration.py`, `test_aa_relations.py`,
`test_aa_system_review.py`, `test_aa_system_review_revisions.py`, `test_aa_consequences.py`,
`test_aa_system_review_privacy.py`, `test_aa_system_review_exports.py`;
`analytics-system-review.test.ts`, `analytics-system-review.test.jsx`. Updated pins (not
weakened): Alembic head (5 files), AA table count 27, `SOURCE_REDACTORS` tuple,
`LIFE_ROUTES` 22 (3 files), lazy loader map, locale counts. S7-01…S7-50 each map to at least
one test (S7-36/37 RU/UK render tests; S7-44 account ZIP manifest).

## 15. Deviations from the Plan (all engineering, no product semantics)

1. `ck_aa_cross_references_user_source/system_source` also pin `proposal_model` (stricter).
2. Debt payoff date is day-precise (partial last payment) so a small one-off change is visible.
3. Each consequence impact carries its own sources, so D1 redacts one impact, not the whole
   analysis; the analysis itself rests on the expense + its context.
4. Removing an own link is idempotent without a receipt (absent → 200 `replayed:true`).
5. Answering a proposal whose key still exists but whose evidence moved is accepted; the
   server's current fingerprint/evidence is stored.
6. Home is unchanged; the two counts live on the System Review page and `#/system-review/waiting`.
7. The Waiting view reads (never writes) the reviews of the proposals' months to name items.
8. Exports add server-side RU/UK labels (`exports/labels.py`) — the only server copy.

## 16. Non-scope (confirmed not done)

No global/Life score, no diagnosis, no causal claims, no auto-approval, no remote AI, no ML /
embeddings, no bank integration, no inferred income/debt/funding, no Slice 8 pruning (retention
stays unlimited; every row has `created_at`/`recorded_at` for Slice 8), no F3 cursor fix, no
Calendar/Experiment semantic change, no fifth signal rule, no deploy, no dependency added.

## 17. PR

Branch `feat/adaptive-analytics-slice-7-system-review-intelligence`; title «Add System Review
and relationship intelligence»; normal merge commit (see PR metadata in the session result).
