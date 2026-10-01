# JENKIN loan documents — dependency-ordered plan and acceptance criteria

Date: 2026-10-01 (Europe/Kyiv). Discovery: `Outputs/Discoveries/jenkin-loan-document-discovery_20261001-163647.md`.
Decisions: `Outputs/Plans/jenkin-loan-document-decisions_20261001-163647.md`. Refines roadmap slices F1–F3 in
`Outputs/Plans/jenkin-security-finance-roadmap_20261001-104806.md`; it does not replace them.

Status: **IN PROGRESS** (this branch), **PLANNED**, **BLOCKED_EXTERNAL**.

## 1. Target architecture (PROPOSED)

```
S2 document versions ─► intake bundle (fin_intake_*)
    1 local preprocessing per page: text layer + coordinates, tables, local OCR for scans, quality signals
    2 classification: agreement | credit_passport | schedule | amendment | statement | unknown
    3 extraction: candidate fields + rule proposals + quotes (assisted provider with consent, else local-only)
    4 deterministic checks: quote_located → value_parsed → semantic cues → applicability validators,
      cross-document conflicts, engine-vs-lender schedule reconciliation
  ─► concise editable review ─► confirmation ─► fin_* records (versioned terms, lender schedules, observations)
  ─► L2 engine (pure) ─► calculated schedules, charts, funding needs ─► reminder intents ─► client reconciler ─► tasks
```

## 2. Slices

| Slice | Content | Depends on | Status |
|---|---|---|---|
| **L2** | Pure deterministic engine + rule catalogue v1 + reconciliation + effective-dated versions; synthetic golden fixtures. No persistence/routes/UI. | — | **IN PROGRESS** (`feat/jenkin-loan-engine-l2-20261001`) |
| L1 | `fin_obligations`, `fin_terms_versions`, `fin_lender_schedules(+rows)`, `fin_balance_observations`, `fin_payments`, `fin_allocations`; minor units + currency; CAS + idempotency; `fin_*` export registry and guard; cascade erasure; nullable links to S2 document versions; mapping L2 input ⇄ terms rows; fallback manual form + schedule-table entry. | L2 contract | PLANNED |
| L3 | Intake framework, local-only mode: bundles, durable DB job queue (`SKIP LOCKED`), local preprocessing (pypdf + pdfplumber; OCRmyPDF/Tesseract for scans), encrypted artefacts under new S2 envelope purposes, evidence levels L-a…L-d, review UI with page evidence. | **verified S2 interfaces** (§3), L1 | PLANNED |
| L4 | Review → confirmation → loan record; schedules and SVG charts; reconciliation view keeping both schedules. | L1, L2, L3 | PLANNED |
| L5 | Assisted extraction: provider adapter, consent and settings, strict schema, prompt-injection handling, retries/failure states, cost/size limits. | E-11, U-2, L3 | BLOCKED_EXTERNAL (provider) |
| L6 | Reminders (F3): `fin_reminder_intents`, task `source_ref` provenance, idempotent client reconciler; completion ≠ payment. | L1, L4 | PLANNED |
| L7 | Statements and credit passports → dated observations; current truth; funding needs. | L3–L5 | PLANNED |
| L8 | System Review adapter (U-1), read-only. | L1, L2 | PLANNED |

The approved product outcome (LD-01) is reached only after **L1 + L3 + L4 (+ L5 for automatic assisted
extraction, + L6 for reminders)**. L2 alone, or a manual form, does not complete it.

## 3. S2 interfaces required by L3 (provisional until verified)

Completion and verification of these is sufficient (LD-05); a merge into `main` is not required.

1. `read_content(db, runtime, owner, document_id, version_number)` → authenticated plaintext for one version.
2. Envelope `Context(purpose, owner, fields)` with the ability to add purposes (`fin.extraction`,
   `fin.evidence`) without a new envelope version; `encrypt`/`decrypt`, `wrap_data_key`/`unwrap_data_key`.
3. Deletion semantics: document deletion cascades versions/blobs; whether a single version can be deleted.
4. Export: the account-export guard over `document%` tables and the streamed documents export
   (`services/documents/export.py` was referenced but absent at 16:18 EEST).
5. Upload limits/types (15 MiB, PDF/JPEG/PNG, encrypted PDFs refused) and `ValidatedContent.detail` (page count).
6. Route contract: `X-LifeOS-Document-Meta`, `X-LifeOS-Expected-Revision`, `Idempotency-Key`, error codes.
7. Keyring CLI, rotation, custody runbook (E-06).
8. Browser-side data plan (H-04) — constrains where review drafts may live (proposed: server-side, encrypted).

**Exact recheck after S2 completes:** S2 commit SHA and remote state; migration head after `20261001_0012`;
`pypdf`/`cryptography` versions; signatures and tests for items 1–6; `tests/test_export.py` expectations for
document tables; whether `services/documents/__init__.py` exposes a facade (module-boundaries entry).

## 4. Acceptance criteria (provenance and semantics kept distinct)

Engine (L2 — synthetic, demonstrates defined mechanics only):
- AC-E1 ≥ 8 synthetic contract configurations with different rule combinations run through one engine with
  no lender-name branches and no per-contract source change.
- AC-E2 Golden values are computed independently of the implementation (hand derivations recorded in fixtures).
- AC-E3 Missing required inputs → `missing_inputs` naming each; unknown mechanics → `unsupported` naming each;
  an incomplete total is never labelled complete.
- AC-E4 No float money; inputs unchanged; deterministic output and canonical input hash; bounded horizon.
- AC-E5 Lender schedule reconciliation preserves both schedules and explains each difference with tolerance.

Extraction (L3/L5 — later):
- AC-X1 Provenance: every material field shown in review has a located quote or is marked `inferred`.
- AC-X2 Semantics are separate: `value_parsed`, `semantic_association`, `contractual_applicability` are
  reported independently; a located quote never auto-confirms a field.
- AC-X3 Mutation fixtures (wrong value with a correct quote, wrong unit, rate from the wrong clause, superseded
  amendment) are measured: the share caught by deterministic checks is **reported**, not assumed to be 100 %.
- AC-X4 Synthetic results are never presented as real-document accuracy; real accuracy needs E-12.

End-to-end "no code per lender" (after L4/L5):
- AC-N1 Held-out synthetic lender templates whose mechanics are all in the catalogue go from upload to a
  confirmed loan and a reconciled schedule with **zero source changes** (CI runs held-out fixtures against
  merged code; the fixture commit contains fixtures only).
- AC-N2 Contracts with mechanics outside the catalogue produce `unsupported` with evidence and no derived totals.
