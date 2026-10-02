# JENKIN loan documents — decision register

Date: 2026-10-01 (Europe/Kyiv). Extends `Outputs/Plans/jenkin-security-finance-decisions_20261001-104806.md`
(D-01…D-12, A-01…A-13, E-01…E-10 remain authoritative). Discovery:
`Outputs/Discoveries/jenkin-loan-document-discovery_20261001-163647.md`. Plan:
`Outputs/Plans/jenkin-loan-document-plan_20261001-163647.md`.

Kinds: **OWNER** (approved by the owner), **ARCH** (architecture choice under that approval, reviewable),
**EXTERNAL** (only the owner or a third party can supply), **OPEN** (genuinely unresolved).

## 1. Owner-approved

| ID | Decision | Kind |
|---|---|---|
| LD-01 | Product outcome: upload → automatic extraction → concise editable review → confirmed loan → schedules/charts → optional reminders. Supported contractual rules for a new lender need no code. | OWNER |
| LD-02 | AI extracts and proposes supported rule configurations; deterministic code performs all arithmetic. No arbitrary or generated calculation code from documents. | OWNER (with D-10) |
| LD-03 | Manual forms are fallback infrastructure, not completion of LD-01. | OWNER |
| LD-04 | Necessary maintained dependencies are authorised (restates D-04); add only when actually required. | OWNER |
| LD-05 | Dependent work may start once the required S2 interfaces are complete and verified; merging S2 into `main` is not a prerequisite. | OWNER |
| LD-06 | L2 is limited to a pure calculation module: no tables, migrations, routes, UI, document processing, AI calls, workers, task/calendar writes or bank connections. The System Review calculation is preserved. | OWNER |

## 2. Architecture choices

| ID | Choice | Rationale |
|---|---|---|
| LA-01 | Evidence check levels `quote_located`, `value_parsed`, `semantic_association`, `contractual_applicability`, `user_confirmed` are independent fields; none implies another. | A located quote proves only that text exists. |
| LA-02 | Lender schedule, calculated schedule and actual observations are separate series; mismatches keep both with an explained diff; no silent authority. | A published schedule is a source, not truth. |
| LA-03 | Engine at `apps/api/app/services/finance/calc/` — pure, ORM/HTTP/UI-independent, typed versioned input (`schema_version`) and output (`engine_version`, canonical input hash). | Reusable by later persistence, review and reminders. |
| LA-04 | Money results in integer minor units; rates and intermediates in `Decimal`; `Decimal` never built from `float` (rejected at validation). | Exactness; float money is forbidden (F1). |
| LA-05 | Supported mechanics are an enumerated catalogue; anything else is reported as `unsupported` by name. Missing required inputs → `missing_inputs`; **no silent defaults**. | No per-lender code; honest partial results. |
| LA-06 | APR / real annual cost / total-cost metrics are not accepted as accrual inputs; a contractual daily rate may drive daily accrual. | Roadmap F2. |
| LA-07 | Same-day events use a fixed, documented order; overlapping term versions are rejected. | Reproducibility. |
| LA-08 | Future extraction tables use the `fin_*` prefix (S2's export guard requires `document%` = exactly its three tables). | Avoids breaking export. |
| LA-09 | Future adapter, not replacement: System Review keeps `simulate_payoff`; a later slice may route a confirmed `fin_*` loan through the engine and expose it to System Review read-only. | Preserve current contracts. |
| LA-10 | Engine result status: `complete` / `partial` (computed for the supported part; `totals.complete=false`, `excludes` named) / `unsupported` (nothing computed: missing required input or central mechanic outside the catalogue) / `invalid` (malformed or contradictory). | Keeps "missing" distinct from "wrong" and never labels an incomplete total complete. |
| LA-11 | L2 catalogue v1 (spec §4): `daily_accrual`, `amortizing` (monthly, regular first period, period-rate rule), limited `revolving` (explicit cycles and grace policy); amendments for `daily_accrual` only. Everything else is named `unsupported`. | Limited, verifiable scope; extends by adding enumerated rules, not lender code. |
| LA-12 | Gate runs that need PostgreSQL while another session holds or migrates `lifeos_test` to an unmerged revision use an isolated, disposable `*_test` database, dropped afterwards (owner-permitted for L2). `lifeos_dev` is never used. | Avoids interfering with S2's shared test database and its unmerged migration. |

## 3. External prerequisites

| ID | Needed | Blocks |
|---|---|---|
| E-06 | Key custody for S2 | S2 activation → any stored document |
| E-11 | AI provider account/key, ZDR if wanted, region terms | assisted extraction (L5) |
| E-12 | Owner-run calibration on own documents locally, or anonymised samples | any claim about real-document extraction accuracy |
| E-07/E-08 | Bank access models | bank-sourced current balances (F4/F5) |

## 4. Open decisions

| ID | Question |
|---|---|
| U-1 | Does `fin_obligations` become the source for the System Review `Obligation`, or do both coexist with a link? |
| U-2 | External provider (or local-only), consent scope (per account / per bundle), whether page images may be sent |
| U-3 | Retention period for raw extraction artefacts |
| U-4 | Encrypt confirmed numeric terms, or keep them readable/queryable |
| U-5 | Behaviour of confirmed terms when the source document is deleted (proposed: keep, mark `source_deleted`) |
| U-6 | Maximum age of a balance observation to count as current |
| U-7 | Password-protected PDFs: unsupported (current S2) or an in-memory unlock flow |
| U-8 | Rule catalogue scope beyond L2 v1 (variable rates, capitalisation, business-day rules) |
| U-9 | Rounding tolerance policy for lender-schedule reconciliation beyond "one rounding step per component per row" |

## 5. L1 architecture choices (2026-10-01, branch `feat/jenkin-finance-l1-20261001`)

| ID | Choice | Rationale |
|---|---|---|
| LA-13 | Confirmed terms are stored as the contractual part of the L2 input schema (`terms` JSONB, `terms_schema_version` 1), refused at write only for floats, non-JSON, calculation keys, unknown model and size; completeness is judged by the engine at calculation time. | 1:1 mapping (spec §9) without a second rule vocabulary; missing rules stay visibly missing. |
| LA-14 | Only confirmed term versions exist in L1 (`confirm: true` required, `confirmed_at` stored). Unconfirmed proposals belong to the L3/L4 intake tables. | "Explicitly confirmed" is a property of every `fin_terms_versions` row. |
| LA-15 | Money-bearing children reference `(obligation_id, user_id, currency)`; currency is immutable. | The DB itself refuses a cross-currency or cross-account fact; nothing is converted. |
| LA-16 | Free text (labels, lender names, notes, tolerance reasons) is sealed with the S2 envelope (`fin.meta` purpose, owner + table + record + revision); numbers, dates and terms stay readable (U-4 remains open). Finance routes require encryption at rest (503 `finance_unavailable` otherwise). | Reuse S2, fail closed, keep calculation inputs queryable. |
| LA-17 | Document deletion clears only the link (`SET NULL (column)`); `source_kind = 'document'` remains and the API reports `source_document_deleted` (implements the U-5 proposal for L1). | Confirmed facts survive their source's deletion, honestly labelled. |
| LA-18 | Calculations are never persisted in L1; every response carries the engine version, input hash and term versions used. | Recompute deterministically; no stale cached results. |
| LA-19 | Legacy snapshot transactions are untouched: `$` labels and AA `UAH` facts stay as they are (D-07); explicit per-transaction currency is slice F1-T. | No silent reinterpretation. |
