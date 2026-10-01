# JENKIN L2 — deterministic loan calculation engine: implementation report

Date: 2026-10-01 (Europe/Kyiv). Branch `feat/jenkin-loan-engine-l2-20261001` in the owner-authorised isolated
worktree `/Users/yurasachenko/LifeOS/LifeOS_loan-engine`, based on `feat/jenkin-account-security-20261001`
@ `f7a43eb0f8d36342bcb2c8c952900b56edfd123d` (fetched; unchanged on the remote). Pushed; **not merged, no PR,
no deploy**. Specification and rule catalogue: `Outputs/Plans/jenkin-loan-engine-l2-spec_20261001-163647.md`.

## 1. What this slice is — and is not

Implemented: a pure, reusable calculation module `apps/api/app/services/finance/calc/` (facade
`__init__.py`: `calculate`, `calculate_versions`, `reconcile_schedule`, `payments_from_lender_schedule`,
`input_hash`, `ENGINE_VERSION`, `SCHEMA_VERSION`).

Not implemented (by scope, LD-06): tables, migrations, API routes, financial UI, document processing, OCR,
external AI calls, background workers, task/calendar writes, bank connections. The System Review
`Obligation` and `simulate_payoff` are **unchanged** (no file under `services/system_review/` was touched).

**The required product outcome (LD-01: upload → automatic extraction → concise editable review → confirmed
loan → schedules/charts → optional reminders) is NOT complete.** L2 is the deterministic calculation core
it will use. The extraction, review, persistence, charts and reminders slices remain (plan §2).

## 2. Commits

| SHA | Content |
|---|---|
| `d24215e` | Corrected discovery, decision register, dependency-ordered plan |
| `db7d79e` | Engine core (contracts, numbers, reader, ledger, terms, engine) and the `daily_accrual`, `amortizing`, `revolving` models; golden, input and invariant tests |
| `9158718` | Lender-schedule reconciliation and effective-dated versions; their tests |
| (docs commit) | This report, engine specification, module boundaries, roadmap/decision cross-references, master context |

## 3. Implemented mechanics (sub-checkpoints A–F)

- **A — core:** typed versioned input (JSON-compatible, `schema_version: 1`), canonical SHA-256 input hash,
  engine version `1.0.0`; strict reader separating `missing_inputs`, `unsupported` (named path/value/code)
  and `errors`; blocking vs non-blocking issues; statuses `complete | partial | unsupported | invalid`;
  explanation ledger linked from every row; fixed, documented same-day order; bounds on every loop.
- **B — daily accrual:** contractual per-day rate or annual rate with ACT/365F, ACT/360, ACT/ACT ISDA;
  outstanding-principal basis only; explicit first accrual day and payment effect; per-day or at-posting
  rounding; one-off / periodic fixed / periodic percent fees (opening or outstanding principal base,
  anchored month-end schedule, `until` date or loan closure); stated allocation order; regular, partial and
  full early repayment with none/fixed fee; explicit overpayment; penalties recorded, never applied.
- **C — amortizing:** monthly annuity and equal principal; annual ÷ 12 or stated monthly period rate;
  regular first period only (irregular → unsupported); anchored month-end due dates; final-payment
  adjustment; fees on due dates; prepayments on due dates with reduce_term / reduce_payment.
  A per-day rate is refused for this model, so "annuity" wording never triggers the monthly formula.
- **D — revolving (limited):** explicit statement/due cycles; stated interest-bearing buckets; grace on full
  statement payment with eligibility, previous-statement condition, loss policy and charge date; shadow
  interest; parameterised minimum (absent → partial); oldest-first allocation within a bucket; held
  overpayment; missing rules → unsupported, never inferred from APR or product names.
- **E — reconciliation:** immutable supplied schedule; per-row/component/total differences; explicit
  tolerance with reason (else exact); unmatched rows on both sides; both schedules preserved;
  `authority: none_selected`.
- **F — versions:** daily-accrual amendments with strictly increasing effective dates; explicit observed or
  projected opening, or the previous closing carried as projected; boundary day belongs to the new version;
  overlaps and out-of-range events rejected; earlier results unchanged (tested).

Explicit limits: no variable/stepped rates, capitalisation, 30/360, business-day shifts, irregular first
periods, intra-period interest in period models, prepayments between due dates, percent early-repayment
fees, missed instalments, revolving promotional rates, balance transfers, late fees, legal caps or penalties;
amendments only for `daily_accrual`; one currency per calculation.

## 4. Example (synthetic lender A)

Input (abridged): `daily_accrual`, UAH, opening 2026-01-01 contractual disbursement 1 234 567 minor units,
`0.01 %/day` contractual rate, `day_after_opening`, `same_day`, `half_up` per day, allocation
fees → interest → principal, actual payment 500 000 on 2026-01-05, horizon 2026-01-10.

Output (abridged, actual engine output):

| Row | Values | Explanation |
|---|---|---|
| accrual 2026-01-02…01-04 | 3 days × base 1 234 567 × 0.0001 (exact 370.3701) → 369 | rule `interest`, per-day rounding |
| payment 2026-01-05 | 500 000 → interest 369, principal 499 631; balance 734 936 | rule `allocation`, order fees/interest/principal |
| accrual 2026-01-05…01-10 | 6 days × 734 936 × 0.0001 (exact 440.9616) → 438 | rule `interest` |

`status: complete`, `closing: principal 734 936, interest_due 438, total 735 374, nature: calculated,
derived_from: contractual_disbursement_opening`, `balance_nature: calculated_not_lender_statement`,
`input_hash: sha256:9d3b6ed6…12c0c`, `engine_version: 1.0.0`. Rounding the same loan at posting instead
gives 811 (lender C fixture) — the rounding stage is a contractual input, not an engine choice.

## 5. Verification (exactly what was run)

Synthetic contracts only; no owner data, no chat narrative converted into terms or fixtures.

| Check | Where | Result |
|---|---|---|
| Engine tests (pure, no DB) | `apps/api`, `pytest tests/finance_calc` | **411 passed** |
| — golden synthetic contracts | 12 configurations (A–L), 3 models, hand derivations stored in each fixture | all match |
| — inputs/issues | missing, unsupported, invalid, disclosed metrics, floats | pass |
| — invariants | 200 seeded daily, 40 amortizing, 60 revolving inputs + determinism/hash/bounds/order | pass |
| Full backend suite | `pytest` against an **isolated disposable DB** `lifeos_l2engine_test` (created, used, dropped) | **1233 passed, 1 skipped** (S1 baseline 822 + 411) |
| `ruff check .` | `apps/api` | pass |
| `alembic heads` / `alembic current` | isolated DB | `20261001_0011 (head)` / `20261001_0011 (head)` |
| Web: `npm ci` (lockfile), `npm test`, `typecheck`, `lint`, `build` | `apps/web` (untouched) | 882 passed; clean; clean; built |
| `git diff --check` | repo | clean |

Golden values were derived by hand (written in each fixture's `derivation`) and were not produced by the
engine; the generator script only wrote those literals. Commit `db7d79e` was also verified on its own
(exported tree: 396 engine tests + ruff).

**Why an isolated database:** at gate time S2's session was running `pytest` against the shared
`lifeos_test` (process in `LifeOS_encryption-documents/apps/api`), and S2's tests migrate that database to
its unmerged revision `20261001_0012`, which this branch (head `0011`) cannot upgrade from without
downgrading S2's state. The owner's task allowed a disposable test database; the conftest guard (`*_test`)
was respected, `lifeos_dev` and `lifeos_test` were never connected to, and the disposable database was dropped.

No claim is made about OCR or AI extraction accuracy: synthetic fixtures demonstrate the defined mechanics only.

## 6. Shared-documentation overlap with S2

S2 (`feat/jenkin-encryption-documents-20261001`, local commit `d91cd0c` + uncommitted work at 16:36 EEST)
is likely to edit the same shared files. Edits here were kept additive:
- `LIFEOS_MASTER_CONTEXT.md` — one appended section **without a number** (numbering left to integration);
- `Outputs/architecture/module-boundaries.md` — one new "Finance calculation engine (L2)" block;
- `Outputs/Plans/jenkin-security-finance-roadmap_20261001-104806.md` — a status line under F2 only;
- `Outputs/Plans/jenkin-security-finance-decisions_20261001-104806.md` — one cross-reference line near the top.
No code overlap: S2 owns `app/crypto`, `app/services/documents`, `routes/documents.py`, `models/document.py`,
config, export and migration `0012`; L2 touches none of them.

## 7. Next slice

L1 — finance persistence and confirmed-terms mapping (see plan §2), then L3 intake once the S2 interfaces
in plan §3 are complete and verified.
