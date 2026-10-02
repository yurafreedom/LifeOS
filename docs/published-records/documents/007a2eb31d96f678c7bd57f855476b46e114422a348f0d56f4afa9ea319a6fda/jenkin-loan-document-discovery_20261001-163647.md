# JENKIN loan documents → loan record — discovery (corrected)

Date: 2026-10-01 (Europe/Kyiv). Read-only discovery performed earlier the same day, corrected on owner
instruction and persisted with the L2 engine branch `feat/jenkin-loan-engine-l2-20261001`.
Companions: `Outputs/Plans/jenkin-loan-document-decisions_20261001-163647.md` (decision register) and
`Outputs/Plans/jenkin-loan-document-plan_20261001-163647.md` (dependency-ordered plan and acceptance).

Labels: **APPROVED** (owner product requirement — this task or D-01…D-12 in
`jenkin-security-finance-decisions_20261001-104806.md`), **PROPOSED** (architecture proposal),
**VERIFIED** (code or official documentation read on 2026-10-01), **UNVERIFIED**.

## 0. Required product outcome (APPROVED — unchanged by any slice)

upload loan agreement / credit passport / payment schedule (and later amendments, statements) →
**automatic extraction** → **concise editable review** → **confirmed loan record** → schedules,
calculations and charts → **optional** task/calendar reminders. Adding another loan that uses supported
contractual rules must need **no developer code and no lender-specific patch**.

Manual entry forms are **fallback infrastructure**, not the product. Neither a manual form nor the L2
calculation engine completes this outcome; each slice report must say what remains.

## 1. Inspected state

| Item | Value |
|---|---|
| Canonical checkout | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem`, `handoff/jenkin-cloud-20260930` @ `d396fa9` (not used for this work) |
| `main` = `origin/main` | `5e858bb0322be0cc729d3d7e73ce359597aada84` |
| S1 base (remote, verified after fetch) | `feat/jenkin-account-security-20261001` @ `f7a43eb0f8d36342bcb2c8c952900b56edfd123d` |
| S2 (other session, not touched) | worktree `LifeOS_encryption-documents`, branch `feat/jenkin-encryption-documents-20261001`. During discovery all work was uncommitted on `f7a43eb`; at 16:36 EEST a local commit `d91cd0c` (envelope encryption + keyring tooling) existed, **not pushed**, with further uncommitted work. Treated as **provisional**. |
| L2 work | isolated worktree `/Users/yurasachenko/LifeOS/LifeOS_loan-engine`, branch `feat/jenkin-loan-engine-l2-20261001` from `f7a43eb` (owner-authorised worktree) |

No private loan document was found by file name under `/Users/yurasachenko/LifeOS` (depth 4); none was
opened or uploaded. **All document-content reasoning is synthetic; real-document behaviour is UNVERIFIED.**

## 2. Existing architecture (VERIFIED at `f7a43eb` unless marked S2)

Reusable:
- **Account isolation (S1):** every protected route needs `X-LifeOS-Account` (428/409);
  `tests/test_account_binding.py::test_every_protected_route_is_bound` covers new routes automatically.
- **S2 documents (provisional):** owner-scoped `documents`, `document_versions`, `document_blobs` with
  composite `(id, user_id)` FKs; immutable versions; `Idempotency-Key` uploads; revision CAS; content-sniffed
  PDF/JPEG/PNG; **password-protected PDFs refused**; 15 MiB default; AES-256-GCM per-object DEK, versioned KEK,
  AAD = purpose + owner + object fields; `read_content(db, runtime, owner, document_id, version)` decrypts and
  authenticates one version; pluggable `BlobStore`; fail-closed `documents_enabled`.
- **Export/erasure:** erasure = `users` cascade (`services/account.py`); export has a completeness guard over
  `aa_*` tables. S2 adds a guard requiring the `document%` tables to be **exactly**
  `{documents, document_versions, document_blobs}` — a future `document_*` intake table would break export;
  intake tables must use another prefix (`fin_*`) or extend that registry deliberately. No account-erasure UI.
- **Revisions / idempotency:** AA mixins (`models/mixins.py`: idempotency key per owner, single successor,
  active/superseded/tombstoned); snapshot whole-document CAS (`services/state.py`).
- **System Review `Obligation`** (`services/system_review/contexts.py:94`): user-entered, versioned label,
  kind, currency, outstanding, monthly payment, annual rate %, as-of, planned payoff; `MAX_OBLIGATIONS = 10`.
  **Overlaps the future loan record** (decision U-1).
- **`simulate_payoff`** (`services/system_review/consequences.py:208`): Decimal monthly amortisation,
  `ROUND_HALF_UP` to cents, ≤ 600 months; returns payoff month count, total interest and final fraction only.
- **Charts:** hand-rolled SVG (`ARCHITECTURE.md:13`, `components/analytics/AAChart.jsx`).
- **Localization:** RU and UK only (EN deliberately disabled); `test/locale-shape.test.ts` pins key counts.
  Exact decimal display: `analytics/values.ts:26-40`.
- **Kyiv dates:** `analytics/timezone.ts`, `domain/calendarModel.ts`, `app/useKyivToday.js`.

Missing (VERIFIED absent): finance entities beyond AA; transaction currency (float amounts, `$` labels, AA
records UAH — S-21/D-07); task provenance and idempotent task creation (`Date.now()` ids); reminders or
notifications; any server writer of snapshot content (whole-snapshot CAS; a 409 freezes the client); file
upload UI; durable background jobs (only in-process `BackgroundTasks`); any OCR/AI dependency or provider config.

## 3. Capability / gap table

| Capability | Status |
|---|---|
| Encrypted upload, versions, download | S2 — provisional |
| Bundle grouping (agreement + passport + schedule) | missing |
| Password-protected PDFs | refused by S2 (U-7) |
| PDF text / page split | partial (`pypdf` added by S2; no OCR/tables) |
| Tables, OCR, multimodal analysis | missing |
| Durable extraction jobs | missing |
| Evidence storage (page, quote, region, check levels) | missing |
| Typed versioned contractual terms | missing |
| Deterministic calculation engine | **L2 (this branch): pure module, no persistence** |
| Dated balances / payments / allocations | missing |
| Task/calendar reminders | missing (needs task provenance + client reconciler) |
| Charts, RU/UK strings, Kyiv dates, account isolation | reusable |
| Export/erasure for new finance data | missing (registry per new table family) |
| External-provider consent and settings | missing |

## 4. Evidence model (CORRECTED)

**Finding a quote proves that text exists on a page — not that the extracted field is correct.**
Each material field carries independent check levels; none implies another:

| Level | Question | Established by |
|---|---|---|
| L-a `quote_located` | Does the cited text exist at the cited page/region? | deterministic search in the page text layer / local OCR text |
| L-b `value_parsed` | Was the value parsed correctly from that text (digits, decimal comma, thousands separators, currency, date format)? | deterministic parser over the located quote; mismatch with the proposed value is a failure |
| L-c `semantic_association` | Does that text actually state *this field* (e.g. the contractual daily rate, not a penalty rate, an example, or a disclosed total-cost metric)? | proposal + deterministic cues (labels, table headers, units next to the number); otherwise **unverified** and shown to the user |
| L-d `contractual_applicability` | Does it apply to this loan, period, balance basis and date range? Units (per day / per annum / per month), period, balance basis, exceptions (promo periods, conditions), effective dates, superseding amendments | rule-catalogue validators + cross-document checks; anything unresolved is a review item |
| L-e `user_confirmed` | Did the user accept the value as a term of this loan? | explicit confirmation; may also be `disputed` |

Other statuses: `extracted`, `inferred` (no quote), `derived` (computed), `conflicting` (documents disagree),
`missing`, `unsupported`. **Schema-valid AI output and a matching quote never imply L-b…L-e.**

## 5. Schedules (CORRECTED)

Three series are kept **separate** and never merged:
1. **Lender schedule** — a *source-labelled published schedule* (document version, page, publication date).
   It is not unconditional truth and **not proof of current debt**.
2. **Calculated schedule** — engine output from confirmed rules, with engine version and input hash.
3. **Actual dated balances/payments** — statements, bank sync or dated user statements.

On mismatch both schedules are **preserved**, the differences are explained per row/component and in total
(with the tolerance stated), and **neither is silently chosen as authoritative**. A user's resolution is a
recorded decision, not a rewrite of either source.

## 6. Current financial truth

Contracts establish terms, not current debt or available credit. Current balances come only from dated
observations (statements, future bank sync F4/F5, user statements). Projections are labelled "projected
from … as of …" and never shown as the bank's balance. **No refinancing suggestion without an observed
available limit/balance** and confirmed terms on both sides. A credit passport is a dated snapshot:
observations stamped with the report date; other lenders' loans are *suggested*, never auto-created.

## 7. Document processing (VERIFIED from official documentation, 2026-10-01)

- **Claude API:** PDF pages sent as image + extracted text; 32 MB request, 600 pages (100 below 1M context);
  no encrypted PDFs. **Citations are incompatible with structured outputs (400)** and **scanned PDFs are not
  citable**. Not used for training without permission; not retained by default; Files API and Batch not
  ZDR-eligible. Prices: Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 4.5 $1/$5 per MTok.
- **OpenAI:** PDFs as text + page images; strict JSON schema; no location feature for file inputs.
- **Gemini:** schema subset; Google says "always validate values"; **free tier may be used for product
  improvement / human review — unacceptable for this data**.
- **Google Document AI / Azure Document Intelligence:** UK/RU printed OCR with boxes and table spans;
  no Ukrainian handwriting. Prices/retention partly UNVERIFIED.
- **AWS Textract: no Cyrillic** — excluded.
- **Local:** pypdf (BSD), pdfplumber (MIT), OCRmyPDF/Tesseract (`ukr+rus`, ≥300 DPI, weak on tables),
  Docling (MIT, per-model licences). **PyMuPDF is AGPL/commercial — avoid.**

Consequence (PROPOSED): evidence verification is our own (L-a…L-d above), not a provider citation feature.

## 8. Privacy and security

Document text is untrusted data (Anthropic's official guidance names OCR output from uploads as an indirect
injection vector). Extraction calls get no tools beyond the output schema, no network, no account data;
output is validated against the enumerated rule catalogue; instruction-like text is recorded as
`suspicious_instructions`. Owner-scoped jobs with composite FKs; workers re-derive the owner. **Server-side
S2 encryption does not prevent disclosure to an external provider**: assisted extraction requires explicit
consent naming provider, region and retention; local-only mode must exist. Logs carry ids/counts/codes only.
Extraction artefacts are encrypted with S2 envelopes under new purposes and erased with their source version.

## 9. Corrections applied (2026-10-01, owner instruction)

1. Evidence levels separated (§4); quote/JSON validity never implies correctness.
2. Lender schedule is source-labelled and not authoritative; three separate series; mismatches keep both (§5).
3. **Necessary maintained dependencies are already authorised (D-04).** Dependency approval is no longer
   listed as a blocker; dependencies are added only when actually required.
4. **S2 dependency = completion and verification of the required S2 interfaces**, not a merge into `main`
   (plan §3 lists them and the exact recheck).
5. Product outcome restated (§0); manual entry and L2 are infrastructure, not completion.
6. Acceptance criteria keep provenance and semantic validation distinct, and do not claim that every AI
   error is detectable or every contract supportable; synthetic fixtures demonstrate defined mechanics only.
