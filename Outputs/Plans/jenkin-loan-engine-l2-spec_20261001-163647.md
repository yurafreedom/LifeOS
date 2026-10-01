# JENKIN L2 — deterministic loan calculation engine: specification and rule catalogue

Date: 2026-10-01 (Europe/Kyiv). Engine version **1.0.0**, input schema version **1**.
Code: `apps/api/app/services/finance/calc/` (facade `__init__.py`). Tests: `apps/api/tests/finance_calc/`.
Plan: `Outputs/Plans/jenkin-loan-document-plan_20261001-163647.md` (slice L2).

## 1. Purpose and boundaries

A pure function library: **confirmed contractual rules + dated inputs → dated rows, balances, totals and an
explanation ledger**. No database, routes, UI, files, network, clock, AI or documents. It never stores
anything, never decides what a contract says, and never presents a calculated balance as the lender's.

AI (later slices) may *propose* inputs in this schema; only confirmed inputs should reach the engine. The
engine executes **no** generated code and has no formula language: every mechanic is an enumerated rule
implemented once in Python.

## 2. API (facade)

| Function | Input | Output |
|---|---|---|
| `calculate(document)` | one model input (§4) | result (§5) |
| `calculate_versions(document)` | `{"schema_version": 1, "versions": [{"effective_from", "input"}]}` (daily_accrual only) | `{status, segments[], boundaries[], closing, input_hash, …}` |
| `reconcile_schedule(result, lender_schedule)` | a `calculate` result + a published schedule (§7) | difference report |
| `payments_from_lender_schedule(schedule, basis=)` | published schedule | `daily_accrual` payments (kind `regular`) |
| `input_hash(document)` | any JSON-compatible document | `sha256:<hex>` of canonical JSON |

Inputs are never modified. Results are new dicts. Changing any input changes `input_hash`, so a new result
is always separately identifiable; earlier results are not rewritten.

## 3. Common input rules

- JSON types only. **Floats and `Decimal` objects are rejected** (`float_not_allowed`, `decimal_must_be_text`).
  Rates are plain decimal text (`"0.01"`; no exponent, sign, comma or spaces).
- Money: integers in **minor units** of the single `currency` (ISO 4217 letters). One currency per calculation.
- Dates: `YYYY-MM-DD`, calendar dates in the contract's local sense (no time zone arithmetic).
- `schema_version: 1` and `model` are required.
- Unknown fields → `unsupported` `unknown_field` (non-blocking → result can only be `partial`).
- Every contractual rule listed as required below has **no default**.
- Rates: `interest = {source_metric: "contractual_rate", kind: "fixed", value, unit: percent|fraction,
  per: day|month|year, day_count?}`. `source_metric` ∈ {apr, real_annual_cost, daily_total_cost,
  total_cost_of_credit, effective_rate} → unsupported `disclosed_metric_not_accrual_input`.
  `kind` ∈ {variable, floating, indexed} → `variable_rate`; `stepped` → `stepped_rate`.
- Rounding: `{mode: half_up|half_even|down|up, step_minor ≥ 1, interest_stage: daily|at_posting}`
  (`interest_stage` only in daily-accruing models).
- Opening: `{date, basis: contractual_disbursement|observed|projected, principal_minor, interest_due_minor,
  fees_due_minor}`; dues are required unless the basis is a disbursement (which cannot carry dues).
- Penalties: `penalties: [{id}]` are recorded in `not_applied` (`penalty_not_applied`) and never charged.
- Bounds: horizon ≤ 50 × 366 days, ≤ 5 000 events per list, ≤ 600 periods/cycles, ≤ 50 versions.

## 4. Models and supported-rule catalogue

### 4.1 `daily_accrual`

Required: `currency, opening, horizon.end_date, interest (per day | per year + day_count),
balance_basis = outstanding_principal, accrual.first_day (opening_day | day_after_opening),
accrual.payment_effect (same_day | next_day), rounding (with interest_stage), allocation`
(a permutation of `fees, interest, principal`; `penalties` is accepted as a no-op and reported).
Optional: `fees[]`, `payments[]`, `early_repayment` (required when an early payment exists), `penalties[]`.

- Day counts: `ACT_365_FIXED`, `ACT_360`, `ACT_ACT_ISDA` (rate ÷ days in that calendar year). `30_360`,
  `ACT_365L` → unsupported by name.
- Accrual: day *D* accrues `principal × daily_rate`; through the horizon end inclusive; never on interest or fees.
- `interest_stage = daily`: each day rounded; `at_posting`: exact sum rounded at posting points — each
  payment day (before allocation) and the horizon end (a version boundary is a horizon end).
- Fees: `one_off {date, amount_minor}`, `one_off_percent {date, rate, base: opening_principal}`,
  `periodic_fixed {amount_minor, schedule}`, `periodic_percent {rate, base: opening_principal |
  outstanding_principal, schedule}`; `schedule = {first_date, every_months 1–12, anchor_day 1–31,
  until: date | "loan_closure"}`. Unknown fee kinds are excluded and named (`unsupported_fee_kind`) → `partial`.
- Payments: `{date, amount_minor, kind: regular | early_partial | early_full, basis: actual | planned}`;
  `early_full` has no amount (calculated payoff). Early repayment: `{allowed, fee: none | fixed}`;
  percent fees → unsupported; `allowed = false` with an early payment → invalid.
- Allocation in the stated order; leftover → explicit `overpayment_minor`, principal never negative.
- **Same-day order:** next_day accrual → fees (input order) → posting → payments (input order) →
  same_day accrual. A loan is *closed* when a payment brings every balance to zero; `until: loan_closure`
  fees stop then.

### 4.2 `amortizing`

Required: `currency, opening (no dues), horizon, interest (per month, or per year + period_rate_rule =
annual_div_12), method (annuity | equal_principal), term {periods 1–600, frequency = monthly,
first_payment_date, anchor_day}, rounding {mode, step_minor}, final_adjustment =
last_payment_settles_balance`. Optional: `fees[]` (dates must be due dates), `prepayments[]`
(+ `early_repayment {allowed, fee, recalculation: reduce_term | reduce_payment}`), `penalties[]`.

- Due dates: anchored monthly dates (31 → 28/29/30, the anchor never drifts).
- **Regular first period only**: opening on an anchor date and the first payment one month later;
  otherwise `irregular_first_period` (unsupported, not approximated).
- A per-day rate → `daily_rate_requires_daily_accrual_model`. A document calling a daily-accrual
  schedule "annuity" is modelled with `daily_accrual` + the published payments + reconciliation.
- Interest per period = round(B × i). Annuity A = round(B·i / (1 − (1+i)^−n)) (B / n when i = 0);
  equal principal part = round(B / n). The last instalment (or the first whose principal part reaches the
  balance) settles the exact remainder.
- Prepayments only on due dates, after that instalment; between dates → unsupported. After a
  prepayment: `reduce_payment` recomputes A (or the part) over the remaining periods; `reduce_term` keeps it.
- Not modelled: missed/partial instalments, holidays, business-day shifts, intra-period interest
  (`closing.interest_since_last_due_minor = null`).

### 4.3 `revolving` (limited)

Required: `currency; opening {date, basis, purchases_minor, cash_minor, interest_due_minor,
fees_due_minor, purchases_in_grace, previous_statement_paid_in_full}; horizon; interest (day | year +
day_count); accrual.payment_effect; rounding (interest_stage: daily | at_posting = at statement);
interest_bearing ⊆ {purchases_out_of_grace, cash, posted_interest, fees}; grace (none |
full_statement_payment {eligible ⊆ {purchase, cash_withdrawal}, requires_previous_paid_in_full,
loss_policy, loss_charge: due_date | next_statement}); allocation (permutation of fees, interest, cash,
purchases); cycles [{statement_date, due_date}]`. Optional: `minimum_payment {percent, of =
statement_balance, floor_minor, plus ⊆ {interest, fees}}` (absent → `partial`, minimums `null`),
`transactions [{date, amount_minor, kind: purchase | cash_withdrawal}]`, `payments [{date, amount_minor,
basis}]`, `fees` (one_off, periodic_fixed with a date `until`), `credit_limit_minor`, `penalties`.

- Opening purchases still in grace → unsupported (`opening_purchases_in_grace`).
- Cycles: statements strictly increase after the opening; `statement < due < next statement`.
- Day order: next_day accrual → transactions → fees → payments → same_day accrual → statement → due
  evaluation. Interest accrued in a cycle is charged on its statement date.
- Grace-eligible transactions accrue *shadow* interest. At the due date of their statement: grace kept iff
  payments in (statement, due] ≥ statement balance and (if required) the previous statement was paid in
  full. Lost → `retroactive_from_transaction_date` (all shadow), `from_statement_date` (days after the
  statement), `from_due_date` (none), charged on the due date or the next statement.
- Minimum = min(balance, max(floor, round(balance × percent)) + interest/fees charged on that statement
  as stated). A missed minimum is reported (`late_payment_consequences_not_applied`); no fee is charged.
- Within a bucket payments reach the oldest transaction first (fixed). Overpayment is held and reported,
  not applied to later transactions. `available_credit_calculated_minor` appears only if a limit is given
  and is labelled calculated.

### 4.4 Effective-dated versions (`calculate_versions`, daily_accrual only)

Strictly increasing `effective_from` (equal/decreasing → `ambiguous_version_overlap`). Version 1 opens on
its effective date; later versions open the day before theirs, accrue from the day after opening, and take
either an explicit observed/projected opening or `{"basis": "projected_from_previous"}` (previous closing,
labelled `projected`). Events must lie inside their version's range. Only the last version has a horizon.
Amendments of amortizing/revolving inputs → unsupported (`amendments_for_model`).

## 5. Result

```
engine_version, schema_version, input_hash, model,
status: complete | partial | unsupported | invalid,
missing_inputs[path], unsupported[{path, code, value?}], errors[{path, code}],
not_applied[{path, code, value?}], limitations[code],
balance_nature: "calculated_not_lender_statement",
currency, opening{…}, closing{…, nature: "calculated", derived_from: "<basis>_opening"},
totals{…, complete: bool, excludes[path]}, horizon{end_date},
rows[{date, kind, label?, amounts…, balances_after?, explanation[seq]}],
explanations[{seq, date, code, rule (input path), amount_minor?, inputs{…}}]
```

- `complete` — computed; nothing missing, excluded or unsupported.
- `partial` — computed for the supported part; `totals.complete = false` and `excludes` names what is left out.
- `unsupported` — nothing computed: a required input is missing or a central mechanic is outside the catalogue.
- `invalid` — malformed or contradictory input; nothing computed.

Row kinds: `opening, accrual (from, to, days, base, daily_rate, interest_exact, interest_minor?),
interest_posted, fee, payment, installment, prepayment, transaction, statement, due_evaluation`.
Labels: `<basis>_opening`, `actual_payment` / `planned_payment`, `calculated_schedule`.

## 6. Arithmetic

`Decimal` with 60 significant digits and trapped `InvalidOperation`/`DivisionByZero`/`Overflow`; values are
built only from decimal text or integers. Rounding to `step_minor` with the stated mode
(half_up / half_even / down = toward zero / up = away from zero). Results are integers.

## 7. Lender-schedule reconciliation

Lender schedule: `{source {label, …}, tolerance? {per_component_minor, reason}, rows [{due_date,
payment_minor?, principal_minor?, interest_minor?, fees_minor?, balance_after_minor?}]}`. Matching by date
against `installment` or `payment` rows. Only published components are compared. Without a tolerance the
comparison is exact. Output: per-row `match | within_tolerance | mismatch`, per-component
calculated/lender/difference, totals with `max_explained_by_tolerance`, unmatched rows on both sides,
`authority: "none_selected"`, the lender rows verbatim and the calculated input hash. Not comparable when
either side is unsupported/invalid. A lender schedule is a source-labelled publication, not truth and not
proof of current debt.

## 8. Invariants (tested)

Accounting identity per model; allocations + overpayment = payment; balances never negative;
determinism; canonical hash independent of key order; inputs unchanged; bounded loops; reproducible
same-day order; no `float(`/`eval`/`exec`/`compile` calls and no float literals in the engine source.

## 9. Future adapters (not implemented in L2)

- **F1 / L1 persistence:** confirmed `fin_terms_versions` rows map 1:1 to this input schema; results may be
  cached keyed by `(input_hash, engine_version)`; contractual facts are never mutated by a calculation.
- **System Review (U-1, LA-09):** `simulate_payoff` stays as is. A later adapter may compute a confirmed
  `fin_*` loan with this engine and expose its payoff date/total interest to System Review read-only, labelled
  with the engine version; the user-entered `Obligation` context keeps its current contract.
- **Extraction (L3/L5):** AI output targets this schema; anything outside the catalogue becomes a named
  `unsupported` item for review, never code.
