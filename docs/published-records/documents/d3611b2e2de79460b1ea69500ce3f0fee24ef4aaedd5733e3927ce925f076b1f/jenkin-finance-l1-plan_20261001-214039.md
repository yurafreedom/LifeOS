# JENKIN L1 — finance persistence and confirmed contractual terms → L2

Date: 2026-10-01 (Europe/Kyiv). Branch `feat/jenkin-finance-l1-20261001`, worktree
`/Users/yurasachenko/LifeOS/LifeOS_finance-l1`, base `integration/jenkin-combined-20261001` @
`69477c9365f06d6ac2831f124aa03b7a23fb5214` (latest reviewed integration checkpoint; the later
`feat/jenkin-usability-followup-20261001` and `docs/jenkin-completeness-hosting-discovery-20261001` are
unmerged side branches and are not part of the base).

Governing records: loan plan `jenkin-loan-document-plan_20261001-163647.md` (slice L1), decisions
`jenkin-loan-document-decisions_20261001-163647.md` (LD/LA/U) and
`jenkin-security-finance-decisions_20261001-104806.md` (D-07, D-08, D-10, A-14…A-23), L2 spec
`jenkin-loan-engine-l2-spec_20261001-163647.md`, roadmap F1/F2.

**Status: IMPLEMENTED on this branch (not merged).** Report: `Outputs/Implementations/jenkin-finance-l1_20261001.md`.

Status vocabulary: **IMPLEMENTED** (this branch) · **F1 remainder** (approved F1 scope not in bounded L1) ·
**LATER** (named slice).

## 0. Discovery summary (checkpoint 1)

| Area | Verified in code at 69477c9 | Consequence for L1 |
|---|---|---|
| S1 ownership | `dependencies.get_current_user` (session → user; `X-LifeOS-Account` 428/409); `test_account_binding::test_every_protected_route_is_bound` | every new route depends on `get_current_user`; owner id never from the body |
| S1 CSRF | `security/origin.enforce_same_origin` + `require_json_content_type` on mutating routes | same on every finance mutation |
| S2 envelope | `app/crypto`: `Context(purpose, owner, fields)`, `encrypt`/`decrypt`, `new_data_key`, `wrap_data_key`/`unwrap_data_key`; KEK from `DocumentRuntime.keyring` (`require_keyring()` → 503 `documents_unavailable`) | finance free text reuses these primitives with new purposes; **no second scheme** |
| S2 rotation | `services/documents/rotation.py` (`rewrap_all`, `verify`, `records_using_key` used by `keyring-retire-key`) | must cover finance ciphertext, or retiring a KEK would orphan finance notes |
| S2 ids | `document_versions(id, user_id)` unique; composite owner FKs | finance links reference `(document_version_id, user_id)` — the DB refuses a foreign account's version |
| S2 export | account ZIP = readable columns + `DOCUMENT_TABLES` guard; decrypted data only via streamed `GET /export/documents` | finance: readable columns in the ZIP behind a `fin%` guard; decrypted finance text via a separate explicit `GET /export/finance` (in memory, no temp file) |
| Erasure | `services/account.delete_account` deletes the `users` row; FKs cascade | every `fin_*` table cascades from `users` (directly and through composite FKs) |
| L2 | facade `calculate`, `calculate_versions` (daily_accrual only), `reconcile_schedule`, `input_hash`; schema 1, engine 1.0.0; statuses complete/partial/unsupported/invalid | L1 maps persisted rows to that schema verbatim; never computes anything itself |
| Migrations | head `20261001_0012` (single) | L1 adds `20261001_0013` |
| Tests | `tests/conftest.TRUNCATED_TABLES` + schema guard; `test_documents_api::test_every_owner_scoped_table_is_exported_or_explicitly_excluded` | add every new table to both |
| Finance UI | `FinancesPage.jsx`: tabs операции / документы; snapshot transactions shown with `$`; AA mirror writes `unit_code: 'UAH'` (`analytics/financeTransaction.ts`, `AnalyticsContext.jsx`) | D-07 (OWNER): neither is reinterpreted. L1 adds a third tab and does **not** touch transactions |

No other L1 branch, worktree or commit exists (checked `git worktree list`, local + remote branches).
Other Claude sessions run in the canonical checkout; none owns an L1 branch.

## 1. F1 versus L1 (explicit reconciliation)

| F1 item (roadmap) | L1 | Where it goes |
|---|---|---|
| obligations, versioned terms, dated balance observations, schedules, actual payments, allocations | **IMPLEMENTED** | this plan |
| document links with provenance | **IMPLEMENTED** as nullable links to S2 document versions + source kind (no page/clause extraction) | page/clause provenance = L3/L4 |
| minor units + explicit currency, CAS, idempotency | **IMPLEMENTED** | — |
| tab "Loans & debts" | **IMPLEMENTED** (`#/finances/loans`) | — |
| `fin_accounts` (bank/cash accounts) | not in L1 | **F1 remainder** (needs its own semantics: account vs obligation; feeds F4/F5) |
| tab "Overview" | not in L1 | **F1 remainder** (needs funding-needs semantics from F3; would otherwise show invented totals) |
| Transactions with explicit per-transaction currency, delete/income/full edit (S-21) | not in L1 | **F1 remainder = slice F1-T** (backlog §1.4) |
| extracted fields needing confirmation | manual confirmation only (`confirm: true`) | L3/L4 |

## 2. Schema (migration `20261001_0013_finance_obligations`)

All tables: prefix `fin_`, `user_id → users ON DELETE CASCADE`, `UNIQUE (id, user_id)`, children reference
their parent with **composite owner FKs** `(parent_id, user_id)` so the database refuses cross-account links.
Money: `BIGINT` minor units, never float; currency `CHAR(3)` `^[A-Z]{3}$`. Money-bearing children carry the
currency and reference `(obligation_id, user_id, currency) → fin_obligations(id, user_id, currency)`, so a
payment/observation/schedule in another currency than its obligation is impossible at the DB level.
Sealed free text: columns `meta_envelope_version, meta_kek_id, meta_wrapped_dek (60 B), meta_nonce (12 B),
meta_ciphertext` (S2 envelope v1), all NOT NULL — every row with free text is sealed, so every such write
needs the keyring (fail closed).

| Table | Readable columns | Sealed JSON | Notes |
|---|---|---|---|
| `fin_obligations` | kind (`loan` \| `credit_line` \| `other_debt`), currency, original_principal_minor?, credit_limit_minor?, status (`active` \| `closed`), revision, idempotency_key, created/updated | `{label, lender, notes}` | original principal ≠ observed balance ≠ credit limit; three separate nullable columns |
| `fin_terms_versions` | obligation_id, version_number, effective_from, terms_schema_version (=1), model, terms JSONB, source_kind (`manual_entry` \| `document`), source_document_version_id?, confirmed_at, idempotency_key | `{note}` | append-only; **only confirmed** rows exist (`confirm: true` required); effective_from strictly increasing per obligation |
| `fin_lender_schedules` | obligation_id, terms_version_id?, currency, source_kind, source_document_version_id?, tolerance_per_component_minor?, idempotency_key | `{label, note, tolerance_reason}` | a published schedule, never "truth" |
| `fin_lender_schedule_rows` | schedule_id, row_index, due_date, payment/principal/interest/fees/balance_after `_minor` (nullable, ≥ 0; ≥ 1 present) | — | ≤ 600 rows |
| `fin_balance_observations` | obligation_id, observed_on, currency, balance_minor, principal/interest/fees `_minor`?, source_kind (`user_reported` \| `lender_statement` \| `lender_app` \| `document`), source_document_version_id?, idempotency_key | `{note}` | dated; not a calculation input in L1 |
| `fin_payments` | obligation_id, paid_on, currency, amount_minor (> 0), payment_kind (`regular` \| `early_partial`), source_kind (`user_reported` \| `bank_statement` \| `lender_statement` \| `document`), source_document_version_id?, idempotency_key | `{note}` | actual payments only; a completed task is never a payment |
| `fin_payment_allocations` | payment_id, component (`principal` \| `interest` \| `fees` \| `penalties` \| `other`), amount_minor (> 0), basis (`user_reported` \| `lender_statement`) | — | stated, not calculated; Σ ≤ payment (service) |

Document links: `FOREIGN KEY (source_document_version_id, user_id) REFERENCES document_versions(id, user_id)
ON DELETE SET NULL (source_document_version_id)` (PostgreSQL ≥ 15). When a document is deleted, the link
becomes NULL while `source_kind = 'document'` remains → API state `source_document_deleted` (the U-5 proposal:
keep the confirmed facts, mark the source deleted).

Sealed contexts (`services/finance/sealing.py`): `Context("fin.meta", owner, (("table", t), ("record", id),
("revision", r)))`; obligations bind their current revision (re-sealed on every edit with a fresh data key, as
S2 document metadata); immutable rows bind revision `1`.

Downgrade: refuses while any `fin_obligations` row exists unless `LIFEOS_ALLOW_DESTRUCTIVE_DOWNGRADE=finance`
(same contract as S2's `documents`).

## 3. API contracts (`/api/v1/finance`, router `routes/finance.py`)

Every route: `get_current_user` (S1 binding). Every mutation: `enforce_same_origin` +
`require_json_content_type`. Feature gate: `DocumentRuntime.require_keyring()` → 503
`finance_unavailable` when encryption at rest is not enabled (the free text cannot be stored otherwise).
Foreign or missing ids → 404 `obligation_not_found` / `record_not_found` (indistinguishable).

Concurrency rules:
* **create** of an obligation, terms version, lender schedule, observation or payment requires a client-minted
  `Idempotency-Key` header (16–128 `[A-Za-z0-9_-]`, unique per account and table). A retry with the same key
  and the same canonical request returns the original (200 instead of 201); the same key with a different
  request → 409 `idempotency_conflict`. A concurrent duplicate loses the unique-constraint race and is answered
  as a replay.
* every child write bumps `fin_obligations.revision` (under `FOR UPDATE` of the obligation row);
* writes that change or remove existing state — obligation edit/delete, a new terms version, deleting a
  schedule/observation/payment — require `expected_revision` (CAS) → 409 `revision_conflict` with
  `current_revision`. Replay is detected **before** the CAS check, so a retried success never conflicts.
* append-only facts (payment, observation, lender schedule) need only the idempotency key.

| Method | Path | Body / query | Result |
|---|---|---|---|
| GET | `/finance/obligations` | — | list: obligation views (+ latest observation, terms count, latest terms summary) |
| POST | `/finance/obligations` | `{kind, currency, label, lender?, notes?, original_principal_minor?, credit_limit_minor?}` | 201/200 view |
| GET | `/finance/obligations/{id}` | — | full detail: terms versions, schedules + rows, observations, payments + allocations |
| PATCH | `/finance/obligations/{id}` | `{expected_revision, label?, lender?, notes?, status?, original_principal_minor?, credit_limit_minor?}` (`null` clears a number; currency immutable) | view |
| DELETE | `/finance/obligations/{id}` | `{expected_revision}` | 204; cascades everything of it |
| POST | `/finance/obligations/{id}/terms` | `{expected_revision, effective_from, terms, confirm: true, source{kind, document_version_id?}, note?}` | 201/200 detail |
| POST | `/finance/obligations/{id}/lender-schedules` | `{terms_version_number?, label, note?, source, tolerance?{per_component_minor, reason}, rows[]}` | 201/200 detail |
| DELETE | `/finance/obligations/{id}/lender-schedules/{sid}` | `{expected_revision}` | detail |
| POST | `/finance/obligations/{id}/observations` | `{observed_on, currency, balance_minor, principal_minor?, interest_minor?, fees_minor?, source, note?}` | 201/200 detail |
| DELETE | `/finance/obligations/{id}/observations/{oid}` | `{expected_revision}` | detail |
| POST | `/finance/obligations/{id}/payments` | `{paid_on, currency, amount_minor, payment_kind, source, allocations?[{component, amount_minor, basis}], note?}` | 201/200 detail |
| DELETE | `/finance/obligations/{id}/payments/{pid}` | `{expected_revision}` | detail |
| GET | `/finance/obligations/{id}/calculation` | `?horizon_end=YYYY-MM-DD&payments=actual\|none` | mapping + L2 result + reconciliations (read-only; never stored) |
| GET | `/export/finance` | — | decrypted finance JSON (attachment, no-store, built in memory) |

`terms` (`terms_schema_version` 1) is the **contractual part** of an L2 input document: allowed keys are the
L2 model keys minus the per-calculation ones. Refused at write (422 `invalid_terms`, with path): non-object,
floats anywhere, non-JSON values, model outside `daily_accrual | amortizing | revolving`, a `currency` /
`schema_version` / `horizon` / `payments` / `prepayments` / `transactions` key (those come from the
obligation, the request and the stored payments), more than 64 KiB canonical JSON. Everything else is stored as
confirmed and judged by the engine at calculation time — missing rules are reported, never filled in.

Sealed-text states in responses: `ok` | `key_unavailable` | `integrity_failed` (text `null`, numbers still
shown). Edits of an obligation whose current text cannot be opened are refused (503
`finance_key_unavailable`) rather than overwriting it.

## 4. Mapping persisted terms → L2 (`services/finance/mapping.py`)

Pure function of loaded rows (no DB access inside). Output:
`{mapping_version: 1, engine_input, term_versions_used[{id, version_number, effective_from, input_hash}],
payments_included, notes[{code, path?, detail}], horizon_end}`.

* Terms with `effective_from > horizon_end` are not used (`term_version_after_horizon` note).
* One version → `calculate({schema_version: 1, currency: obligation.currency, horizon: {end_date}, **terms,
  [payments]})`.
* Several versions → `calculate_versions({schema_version: 1, versions: [{effective_from, input}]})`; only the
  last version gets the horizon; payments are assigned to the version whose range contains their date. The
  engine itself reports `amendments_for_model` for non-daily models — L1 does not pre-empt it.
* Payments (`payments=actual`): `daily_accrual` → `{date, amount_minor, kind: payment_kind, basis: "actual"}`;
  `revolving` → `{date, amount_minor, basis: "actual"}`; `amortizing` → **not mapped** (L2 models the contractual
  schedule and due-date prepayments only) → note `actual_payments_not_modelled_for_amortizing`.
  Payments before the first version's effective date → note `payment_before_first_terms`, excluded.
* `payments=none` → the contractual projection only.
* Revolving transactions are not stored in L1 → note `revolving_transactions_not_recorded`.
* The engine's `input_hash` is the deterministic identity of the calculation; results carry
  `engine_version`, `schema_version`, `explanations` (dated ledger) and `status` unchanged.
* Reconciliation: each stored lender schedule is converted to the L2 schedule shape and passed to
  `reconcile_schedule` against the single-version result (for a multi-version result: against the last
  segment, labelled so). Both schedules are returned; `authority: "none_selected"`.
* Balance observations are shown beside the calculation, never fed into it (a later explicit
  "observed opening" is an L4 choice).

## 5. UI scope (minimal, `#/finances/loans`)

Third Finance tab "кредиты и долги / кредити та борги" in `pages/finances/FinanceLoans.jsx` +
`pages/finances/loans/*`, API client `api/finance.ts` (through `apiFetch`, so S1 binding/late-response rules
apply), RU/UK copy, existing `.card .panel`, `.tasks-chip`, `.set-btn*`, form styles; new rules under
`.fl-*` in `styles/finance-calendar.css`.

| Capability | UI | API |
|---|---|---|
| create / edit / close / delete obligation | ✓ | ✓ |
| terms version: `daily_accrual`, `amortizing` manual form (every rule optional, explicit confirmation) | ✓ | ✓ |
| terms version: `revolving` | **API only** (shown read-only in the UI) | ✓ |
| link terms / payments / observations / schedules to an S2 document version | **API only**; the UI shows the link and "source document deleted" | ✓ |
| balance observations: add / list / delete | ✓ | ✓ |
| payments with optional stated allocations: add / list / delete | ✓ | ✓ |
| lender schedule table entry: add / list / delete | ✓ | ✓ |
| calculation: status, missing/unsupported (readable paths), closing (labelled calculated), totals, rows, reconciliation summary | ✓ (compact table, no charts) | ✓ |
| decrypted finance export | Settings → Export row | ✓ |

Unavailable data is shown as "нет данных / unavailable", never `0`; money is formatted with the stored
currency code (`Intl.NumberFormat` currency style) from minor units via string arithmetic.

## 6. Acceptance criteria

* AC-L1-1 every new route bound (S1 test) and owner-isolated (cross-account 404; composite FKs refuse
  cross-account links at DB level, tested with direct inserts).
* AC-L1-2 no float money or rates accepted; every amount carries the obligation currency (DB composite FK).
* AC-L1-3 idempotent retries return the original; concurrent duplicates (threads) create exactly one row;
  stale `expected_revision` refused without writes.
* AC-L1-4 terms append-only, effective-dated, strictly increasing, confirmed only; a reissued contract is a new
  version of the same obligation (no new obligation is created by adding terms).
* AC-L1-5 persisted terms → L2 input reproduced exactly (golden L2 fixtures stored through the API give the
  same `input_hash` and closing values as calling the engine directly); missing rules → `missing_inputs` paths;
  APR → `unsupported`; versions → `calculate_versions` segments.
* AC-L1-6 lender schedule and calculated schedule both returned; differences explained; no authority chosen.
* AC-L1-7 export: every `fin_*` table in the account ZIP (readable columns) and guarded; decrypted text only in
  `/export/finance`; erasure removes every `fin_*` row; documents deleted → link NULL + `source_document_deleted`.
* AC-L1-8 missing keyring → 503 for every finance route; missing KEK for a row → `key_unavailable` text state,
  edits refused; rotation re-wraps and verify/retire count finance rows.
* AC-L1-9 migration 0012 → 0013 → 0012 on empty data; downgrade refused with obligations present.
* AC-L1-10 UI: create → terms → payment → schedule → calculation in a real browser against the QA API, RU/UK,
  themes, desktop + mobile, no overflow.

## 7. Unsupported / out of scope (stated, not hidden)

OCR/AI extraction (L3/L5), page/clause provenance, review/confirmation of proposals (L4), charts (L4), reminders
and task links (L6), statements/credit passports (L7), System Review adapter (L8, U-1 open), bank connectors
(F4/F5), `fin_accounts` + Overview + F1-T transactions currency (F1 remainder), revolving transactions storage,
amortizing actual-payment modelling (engine), observed-balance openings, editing a stored payment/allocation
(delete + re-add), encryption of numeric terms (U-4 open: numbers stay readable, free text sealed), multiple
currencies per obligation, FX conversion of anything.

## 8. Implementation notes (as built)

* Migration `20261001_0013_finance_obligations` holds the DDL as static SQL generated from the models; the
  document links are `ON DELETE SET NULL (source_document_version_id)`. ORM metadata says `SET NULL` only
  (SQLAlchemy cannot express the column list); the database is authoritative.
* The idempotency request digest (SHA-256 of the canonical request) is stored **inside** the sealed text, never
  readable (a readable hash of short notes could be brute-forced).
* Every child write bumps the obligation revision and re-seals its text under a fresh data key (its context binds
  the revision, as S2 document metadata does). Consequence: if the obligation's own text cannot be opened (KEK
  missing), child writes are refused with 503 `finance_key_unavailable` rather than silently continuing.
* `services/documents/rotation.py` re-wraps, verifies and counts the finance `meta_*` keys; `keyring-retire-key`
  refuses while any finance row uses the key. `documents-verify` prints the finance count.
* Calculation payment modes: `none` (contract only), `actual` (recorded payments), `lender_schedule` (a stored
  schedule's published payments as `planned`, daily_accrual only) — the last was added because the L2 spec models
  "annuity-labelled daily-accrual" schedules exactly this way.
* UI: first terms version opens on its effective date; later versions offer "carry over the previous calculated
  balance (projected)" or a new disbursement; observed openings, revolving terms and document links are API-only.
