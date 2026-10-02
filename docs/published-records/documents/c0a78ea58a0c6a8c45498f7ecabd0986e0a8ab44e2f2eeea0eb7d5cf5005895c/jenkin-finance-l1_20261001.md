# JENKIN L1 — finance persistence and confirmed terms → L2 (implementation report)

Date: 2026-10-01 (Europe/Kyiv). Branch `feat/jenkin-finance-l1-20261001` (not merged; no PR, no deploy).
Worktree `/Users/yurasachenko/LifeOS/LifeOS_finance-l1` (owner-requested). Base: integration checkpoint
`69477c9365f06d6ac2831f124aa03b7a23fb5214` (`integration/jenkin-combined-20261001`, §93), verified equal to
origin at start. Plan: `Outputs/Plans/jenkin-finance-l1-plan_20261001-214039.md`. Decisions LA-13…LA-19 in
`Outputs/Plans/jenkin-loan-document-decisions_20261001-163647.md`.

## 1. Ownership check at start

`git fetch origin`; worktrees and branches listed. No L1 branch, worktree, commit or report existed locally or on
origin. Several Claude processes had the canonical checkout as their working directory (it holds another
session's staged files on `handoff/jenkin-cloud-20260930`); none owned an L1 branch. The canonical checkout,
`LifeOS_combined` and every other worktree were left untouched. Unmerged side branches newer than the base
(`feat/jenkin-usability-followup-20261001`, `docs/jenkin-completeness-hosting-discovery-20261001`) were not used
as the base; the completeness backlog was read for F1/L1 reconciliation.

## 2. What was built

### Backend (API)

* Migration **`20261001_0013`** (single head): `fin_obligations`, `fin_terms_versions`, `fin_lender_schedules`,
  `fin_lender_schedule_rows`, `fin_balance_observations`, `fin_payments`, `fin_payment_allocations`. Composite
  owner FKs everywhere; money-bearing children reference `(obligation_id, user_id, currency)`; document links
  `ON DELETE SET NULL (source_document_version_id)`. Downgrade refuses while obligations exist
  (`LIFEOS_ALLOW_DESTRUCTIVE_DOWNGRADE=finance` overrides after a backup).
* Facade `app/services/finance/obligations` (errors, sealing, terms checks, service, pure mapping, calculation,
  export) and router `app/routes/finance.py` (`/api/v1/finance/*`), plus `GET /api/v1/export/finance`.
* Distinct concepts kept apart in schema and API: original principal, credit limit (obligation columns), contractual
  terms (versioned), lender schedule (source), calculated schedule (engine, never stored), projected payments
  (`lender_schedule` mode, labelled `planned`), actual payments, stated allocations, dated observations.
* Money: `BIGINT` minor units, `StrictInt` at the API (`1.0`, `"1"`, `true` refused), currency `^[A-Z]{3}$`, immutable
  per obligation, never converted. Rates stay decimal text inside `terms`; floats anywhere in `terms` are refused
  with their path.
* Concurrency: `Idempotency-Key` on every create (digest kept inside the sealed text); concurrent duplicates
  answered as replays; obligation row lock + revision bump on every child write; CAS (`expected_revision`) on
  edits, new terms versions and deletions; replay checked before CAS.
* Encryption: labels, lender names, notes and tolerance reasons sealed with the S2 envelope (fresh DEK per write,
  context = purpose `fin.meta` + owner + table + record + revision). No second scheme. Without encryption at rest
  every finance route returns 503 `finance_unavailable`; a missing KEK shows `text_state: key_unavailable` with
  numbers still visible and refuses edits (503 `finance_key_unavailable`). S2 rotation, verify and
  `keyring-retire-key` now cover finance ciphertext.
* Export / erasure: all seven tables in the account ZIP (readable columns only; `fin\\_%` registry guard in code
  and database); decrypted text only via `GET /api/v1/export/finance` (JSON built in memory, `no-store`,
  attachment). Account deletion cascades every `fin_*` row.
* Mapping (pure): confirmed versions in effective-date order → `calculate` (one) or `calculate_versions`
  (several; payments split by version range; only the last has the horizon); currency from the obligation;
  horizon from the request; actual payments mapped per model (amortizing: not modelled, noted); every exclusion
  named in `mapping.notes`. The engine's `input_hash`, versions, dated ledger and status are returned unchanged;
  each stored lender schedule is reconciled (`authority: none_selected`). Nothing is persisted.

### Frontend (UI)

* Finance tab **«кредиты и долги / кредити та борги»** (`#/finances/loans`): list (principal, latest observation
  or "остаток не указан", terms and payment counts), create form (explicit currency, no default), obligation editor
  (text, close/reopen, delete with confirmation), terms versions (read-only rule list; manual form for
  `daily_accrual` and `amortizing` where every rule starts as "не указано в договоре" and confirmation is required),
  payments (kind, source, optional stated allocation), observations, lender-schedule table entry with optional
  tolerance + reason, calculation panel (status, missing / unsupported / invalid with paths, closing and totals in
  the obligation currency, rows, notes, observations beside, reconciliation).
* Settings → Export: «Кредиты и долги (расшифрованные)» row.
* RU + UK copy for every key (324 keys each); money via string/BigInt arithmetic (`domain/money.ts`).

| Capability | UI | API only |
|---|---|---|
| obligations CRUD, terms (daily/amortizing), payments, observations, schedules, calculation, export | ✓ | |
| revolving terms; observed/projected openings with stated dues; linking a document version | (shown read-only) | ✓ |

## 3. Legacy currency discrepancy (investigated, not changed)

Snapshot transactions have no currency field; `FinancesPage.jsx` prefixes `$`; the AA mirror
(`analytics/financeTransaction.ts`, `AnalyticsContext.jsx`) writes `unit_code: 'UAH'`, and `aa_finance.py`
aggregates UAH only. Owner decision D-07 says both stay as they are. L1 does not read, convert, relabel or link
these records; the Unreleased notes now state the limitation. Fix = slice **F1-T** (explicit per-transaction
currency chosen by the owner).

## 4. Verification (actual runs)

Isolated database `lifeos_finance_l1_test` (disposable, created for this task; LA-12 pattern). Not used:
`lifeos_dev`, `lifeos_test`, `lifeos_preview_personal`, any other session's database or the owner's keyring.

| Check | Result |
|---|---|
| `python -m pytest` (TZ=UTC), final tree | **1403 passed, 1 skipped** |
| `python -m pytest` (TZ=Europe/Kyiv), final tree | **1403 passed, 1 skipped** |
| (earlier full runs before the replay-under-lock fix, §7) | UTC 1402 passed + 1 skipped; Kyiv 1402 passed + 1 skipped |
| New suites: `test_finance_api.py` 35, `test_finance_calculation.py` 22, `test_finance_migration.py` 4, `finance_l1/` 19 (DB-free) | all pass |
| `ruff check .` | pass |
| `alembic heads` / `alembic current` (disposable DB) | `20261001_0013 (head)` / `20261001_0013 (head)` |
| Migration 0013 → 0012 → 0013 on empty finance data; refusal with an obligation present; `SET NULL (column)` definition | tested |
| Golden L2 fixtures stored through the API | 6/12 fully storable → **identical engine input hash**, status, closing, totals and explanation ledger as calling the engine directly; the other 6 (planned/early_full payments, prepayments, revolving transactions) map with named exclusions |
| Ownership: cross-account GET/PATCH/DELETE/child create/calculation → 404; DB refuses cross-account and cross-currency rows | tested |
| Idempotency: 8 concurrent retries → 1 payment; 6 concurrent distinct payments → all land, revision 7 | tested |
| Missing KEK, tampered and moved ciphertext, no plaintext in tables, unavailable without encryption | tested |
| Export ZIP (all 7 tables, no `meta_*`), decrypted export owner-only, account erasure, document deletion → `source_document_deleted` | tested |
| Rotation re-wraps 3 finance rows; verify complete; old key count 0 | tested |
| `npm test` | **958 passed (61 files)** |
| `npm run typecheck`, `npm run lint`, `npm run build`, `npm run release-notes` | pass |
| `git diff --check` | pass |

Real browser (Chrome, synthetic account `l1-qa@example.com` on `lifeos_preview_finl1qa` via
`JENKIN_PREVIEW_HOME=<scratch> scripts/preview.sh --db-suffix finl1qa --port 4730 --api-port 8730`, its own
generated QA keyring and bootstrap token):

* created a loan through the form (12 345,67 UAH shown, "остаток не указан"), entered terms with one rule left
  unset, recorded a 5 000,00 UAH payment, calculated → **«не рассчитано»** naming `rounding.interest_stage`;
* a synthetic annuity with a lender schedule differing by one kopeck → «рассчитано полностью», totals, rows,
  observation beside, reconciliation «есть расхождения» on 15.03.2026 only;
* matrix 3 themes (dark, light, paradise) × RU/UK × 320/390/768/1280 px with a loan expanded: **24/24 with 0
  page overflow, 0 elements past the viewport (tables scroll in their wrapper), 0 text below 12 px**; no console
  errors; unbound API request → 428; decrypted export returned both loans; no plaintext label/note in the DB.
* Found during QA: the automation's direct checkbox setter bypasses React, so the UI correctly refused to save
  without confirmation; a real click saved. Not a product defect.

Screenshots: `Outputs/Implementations/jenkin-finance-l1_20261001/` (01 missing input named, 02 complete result +
reconciliation, 03 mobile 390 px UK light, 04 calculation running).

## 5. Unsupported / limitations (honest list)

No OCR/AI extraction, intake review, page/clause provenance (L3/L4/L5); no charts (L4); no reminders or task
links (L6); task completion is never a payment. Revolving terms, observed openings and document links are API-only.
Amortizing calculations ignore actual payments (engine models the contract only; noted). Several term versions
calculate only for `daily_accrual` (engine reports `amendments_for_model`). Revolving purchases/withdrawals are
not stored. Payments and allocations are corrected by delete + re-add. Numbers and terms are readable in the
database (U-4 open). Legacy `$`/`UAH` unchanged (F1-T). `fin_accounts` and the Overview tab are F1 remainder.

## 6. Integration notes

Migration `20261001_0013` sits on `20261001_0012`; integrating requires a forward migration of preview databases
(the launcher backs up first). Files that the integration session will most likely touch together:
`LIFEOS_MASTER_CONTEXT.md` (§95 here; §94 is used by the unmerged usability branch), `Outputs/architecture/module-boundaries.md`,
`apps/web/src/data/releaseNotes.json` + `CHANGELOG.md`, `apps/web/src/context/locale/{ru,uk}.js`,
`apps/web/src/test/locale-shape.test.ts` (counts 2413/2412 here), `apps/web/src/pages/FinancesPage.jsx`,
`apps/web/src/app/routeRegistry.js`, `apps/web/src/components/settings/ExportSection.jsx`,
`apps/web/src/styles/finance-calendar.css`, `apps/api/app/main.py`, `apps/api/app/services/export.py`,
`apps/api/app/services/documents/rotation.py`, `apps/api/app/cli.py`, `apps/api/tests/conftest.py` and the
eleven tests that pin the Alembic head, `docs/product/JENKIN_PRODUCT_OVERVIEW.md`.

## 7. Fix found in self-review

A concurrent *retry* of a revision-checked create (new terms version) waited on the obligation lock and then
failed the revision check instead of being answered as a replay. The create flow now re-checks the idempotency
key after acquiring the lock (test: 6 concurrent identical terms requests → one version, 201 once, 200 otherwise).
The full suite was re-run under UTC and Europe/Kyiv after the fix (§4).
