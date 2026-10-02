# JENKIN security & finance roadmap — dependency-ordered plan with acceptance criteria

Date: 2026-10-01 (Europe/Kyiv). Decisions and external prerequisites:
`Outputs/Plans/jenkin-security-finance-decisions_20261001-104806.md`. Findings:
`Outputs/Discoveries/jenkin-security-finance-discovery_20261001-104806.md`.

Status vocabulary: **IMPLEMENTED** (on its feature branch — S0/S1 `feat/jenkin-account-security-20261001`, S2 `feat/jenkin-encryption-documents-20261001` — not merged),
**APPROVED** (owner-approved, not started), **PROPOSED** (architecture proposal inside an approved slice,
to be confirmed in that slice's discovery), **BLOCKED_EXTERNAL** (cannot start or finish without E-xx).
S0, S1 and S2 are implemented on branches (not merged); nothing after S2 is started.

```
S0 ─► S1 ─► S2 ─► F1 ─► F2 ─► F3
                    └──► F4 / F5 (need S2 for credentials, F1 for entities)
I1 (passkeys/TOTP) after S1; I2 (Diia) BLOCKED_EXTERNAL
```

## S0 — reconcile discovery, persist findings and roadmap — IMPLEMENTED

Acceptance (met): discovery with evidence and status; decision register; this plan; the obsolete
"wait for integration" gate removed; master context and module boundaries updated.

## S1 — security and account foundation — IMPLEMENTED (branch only)

Report: `Outputs/Implementations/jenkin-account-security-s0-s1_20261001-104806.md`. Acceptance criteria
(each verified by unit, real-backend or browser evidence named in the report): account binding on every
protected route; stale-tab writes/reads/replays/exports refused with equal revisions; cross-tab and
foreground revalidation; keyed providers; late responses discarded; effective dispose; owner-bound queue
with quarantine; logout honesty and unsaved-edit resolution; per-account recovery after expiry; legacy
import with ownership confirmation and recoverable retirement; empty new accounts and no fabricated UI;
throttled login; password change/recovery; email verification; session management; owner invitations;
audit events with retention/export/erasure; no-store private responses; CSRF on every new mutating route.

**S1 follow-ups (APPROVED, small):** a read-only "demo seed detector" that lists records in an existing
snapshot matching the old seeds (ids `t01…t15`, quick notes `101…104`, `seed_task_*`, demo goals/habits/meds)
for the owner to review and delete by hand — never automatic (D-06); Home typography (pre-existing < 12 px
eyebrows); email-change flow with re-verification.

## S2 — encryption and document foundation — IMPLEMENTED (branch `feat/jenkin-encryption-documents-20261001`, not merged) · activation BLOCKED_EXTERNAL (E-06)

Report: `Outputs/Implementations/jenkin-encryption-documents-s2_20261001.md`. Implemented as below with these
refinements (decision register A-14 … A-23): whole-object AES-GCM (no chunks, 15 MiB default, 50 MiB cap), PostgreSQL
`document_blobs` behind `BlobStore`, raw octet-stream uploads (no multipart spooling), PDF/JPEG/PNG validated by
content, encrypted PDFs refused, streamed decrypted documents export, rotation/verify/import/retire CLI. Existing
plaintext data is planned separately in `Outputs/Plans/jenkin-existing-plaintext-data-plan_20261001.md` (PROPOSED,
not implemented). Acceptance met except "key-custody runbook reviewed by the owner" (pending owner review).

Original approved scope:

Architecture (APPROVED unless marked PROPOSED):
- AES-256-GCM **envelope encryption** with a maintained library (`cryptography`'s AEAD). One random 256-bit
  data key per object; data keys wrapped by a **versioned** wrapping key (`key_id`, `key_version`).
- **Authenticated context binding**: AAD = `owner user_id ‖ table ‖ object id ‖ field ‖ schema version`, so a
  ciphertext cannot be moved to another account or field.
- **No plaintext fallback**: if a required key is unavailable, the operation fails closed with a clear
  error; nothing is written unencrypted and nothing is read as "empty".
- Rotation (re-wrap data keys, not re-encrypt payloads), backup/recovery and **key custody** procedures are
  part of the slice; deletion = data-key destruction + row deletion; export decrypts for the owner only.
- **Honest scope**: this is **server-side encryption at rest**, not end-to-end or zero-knowledge — the
  server can decrypt to serve the owner. UI and docs must say so.
- Existing `user_snapshots` and AA facts **remain plaintext** unless a separate, reviewed migration is
  designed; a separate plan addresses existing profile data (PROPOSED: field-level encryption of profile,
  medications and notes inside the snapshot, behind a schema-version bump and a reversible dual-read).
- Encrypted document storage behind a `DocumentStore` interface. PROPOSED backend: PostgreSQL chunk table
  (e.g. 512 KiB chunks) — to be **validated against deployment needs** (backup size, DB growth, streaming)
  versus object storage before implementation.
- PROPOSED initial upload limit **15 MB**, types **PDF, JPEG, PNG** verified by **content** (magic bytes +
  parser) not by extension; safe downloads (`Content-Disposition: attachment`, `nosniff`, no inline HTML/SVG);
  export and erasure coverage; never log plaintext or file names with personal data.

- **Browser-side data** (S1 hardening finding H-04): the per-account unsaved-snapshot copies
  (`lifeOsPendingSnapshot:<id>`, localStorage), the analytics write queue (IndexedDB) and the legacy
  `lifeOsState` / `lifeOsStateRetired` copies are **plaintext** in the browser profile; per-account keys are
  logical isolation, not encryption. The data-protection plan must define: what may be kept on the device at
  all; a retention limit (e.g. discard unsaved copies after N days with a visible notice); clearing on explicit
  "forget this device"; whether WebCrypto encryption with a non-extractable key adds real protection against
  the threat model (it does not protect against script running in the page); and the shared-device guidance.
  Server-side S2 encryption does not cover this storage.

Acceptance: round-trip encrypt/decrypt with AAD mismatch rejection; rotation without data loss; missing key
→ hard failure with no plaintext write; documents exported and erased with the account; size/type/content
validation tests; key-custody runbook reviewed by the owner.

## F1 — financial obligations and documents — APPROVED (after S2) · obligations part IMPLEMENTED as L1 (branch)

- Finance tabs: **Overview, Transactions, Loans & debts, Documents**.
- Normalized `fin_*` tables independent of the AA write gate (D-08): accounts, obligations, **versioned
  contractual terms**, **dated balance observations**, schedules, actual payments and **allocations**.
- Document versions and **extracted fields with page/clause provenance**; every extracted value needs
  **explicit confirmation** before it drives anything.
- A reissued contract links to the **existing obligation** (new terms version), never silently creates a new debt.
- Money in **minor units** with an **explicit currency** per amount; revision checks (CAS) and idempotency
  keys on writes. Historical snapshot transactions keep their unknown currency until the owner assigns one (D-07).

Acceptance: no float money; every amount has a currency; terms are versioned and dated; documents link to
obligations with provenance; duplicate submissions are idempotent; nothing personal enters fixtures.

## F2 — calculation engine — APPROVED (after F1) · results limited until E-10

- Pure, deterministic module using `Decimal` and explicit rounding (mode and step per contract/currency).
- Models: **fixed-installment**, **contractual daily-interest**, **revolving credit**.
- Inputs that must be **confirmed**: day-count convention, balance basis, accrual vs posting dates, grace rules,
  minimum payment, allocation order. **Missing terms → `partial` / `unsupported` with the exact missing inputs**,
  never a guess.
- Every result carries a **dated explanation ledger** and the **source term version**.
- **IMPORTANT:** a contractual daily interest rate may drive accrual; disclosed total-cost metrics (daily
  total cost, real annual cost, APR) **must not** be substituted for contractual accrual rules.
- Legal applicability flags (e.g. penalty caps) require verified context; disputed penalties are never
  silently approved or charged.

Acceptance: golden tests per model from synthetic contracts; explanation ledger reproduces totals; changing
a term creates a new version and recomputes only from its effective date; unsupported inputs reported verbatim.

**Status (2026-10-01, later):** the pure engine part of F2 is implemented as loan-document slice **L2** on
`feat/jenkin-loan-engine-l2-20261001` (not merged): `apps/api/app/services/finance/calc/`, spec
`Outputs/Plans/jenkin-loan-engine-l2-spec_20261001-163647.md`. Persistence (F1/L1) and every product surface
remain open; plan: `Outputs/Plans/jenkin-loan-document-plan_20261001-163647.md`.

## F3 — task/calendar links and funding needs — APPROVED (after F2)

- Durable **desired link state** plus recoverable, idempotent **reconciliation** with existing snapshots
  (stable provenance ids; no duplicate tasks; owner edits and Waiting/closure lifecycle preserved).
- **Task completion is not proof of payment**; settlement comes only from payment allocations.
- Monthly basic needs + required debt payments without double counting; distinguish **planned income,
  received income, credit limits and spendable funds** (restores an honest Home trend).

Acceptance: re-running reconciliation is a no-op; deleting/editing a linked task never edits a payment;
needs total equals the sum of distinct obligations.

## F4 / F5 — banks — APPROVED in principle · BLOCKED_EXTERNAL (E-07, E-08)

- **monobank**: choose the access model that matches actual use — a personal token for the owner's own
  self-hosted instance vs. a partner/corporate API to onboard other users (provider authorization required).
- Encrypted credentials (S2), documented request **pacing**, incremental sync, deduplication, holds and
  reversals, revoked-access detection and **honest sync status** (never "connected" without a successful sync).
- **Unsigned webhook notifications are hints to resync**, never trusted financial records.
- **PrivatBank**: verify personal API availability first; **statement-file import first**; a business
  connector only with verified access. No promise of unsupported integration.
- Real account tokens and private financial documents never enter Git or fixtures.

## I1 — passkeys / TOTP — APPROVED (separate security slices after S1)

WebAuthn passkeys (resident keys, user verification, per-credential sign counters) and TOTP (encrypted
secrets via S2, recovery codes shown once, replay window). Each needs its own migration and recovery story.

## I2 — Diia / id.gov.ua — BLOCKED_EXTERNAL (E-09)

Discovery and partner onboarding only. **Never link identities by matching a name or email.**

**F1 status (2026-10-01, L1):** obligations, versioned confirmed terms, dated observations, lender schedules,
actual payments and stated allocations are implemented as loan slice **L1** on `feat/jenkin-finance-l1-20261001`
(not merged): plan `Outputs/Plans/jenkin-finance-l1-plan_20261001-214039.md`, report
`Outputs/Implementations/jenkin-finance-l1_20261001.md`. **F1 remainder (not started):** `fin_accounts`, the
Finance **Overview** tab, and **F1-T** (explicit per-transaction currency, delete/income/full edit of snapshot
transactions; the `$` vs `UAH` discrepancy S-21 stays as recorded under D-07 until then). Extracted fields with
page/clause provenance remain L3/L4.
