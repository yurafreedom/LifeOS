# JENKIN S2 — encryption and document foundation

Date: 2026-10-01 (Europe/Kyiv) · Branch `feat/jenkin-encryption-documents-20261001` (pushed; **not merged, no PR,
not deployed**) · Base `origin/feat/jenkin-account-security-20261001` @ `f7a43eb0f8d36342bcb2c8c952900b56edfd123d`
(fetched live; the remote had no later commits).

Related records: discovery §8 `Outputs/Discoveries/jenkin-security-finance-discovery_20261001-104806.md`; decisions
A-14 … A-23, E-06, E-11 `Outputs/Plans/jenkin-security-finance-decisions_20261001-104806.md`; roadmap §S2; key
runbook `Outputs/Runbooks/jenkin-document-keys-runbook.md`; mail/proxy `Outputs/Runbooks/jenkin-mail-and-proxy-setup.md`;
plaintext-data plan `Outputs/Plans/jenkin-existing-plaintext-data-plan_20261001.md`; browser QA
`Outputs/Implementations/jenkin-encryption-documents_20261001/`.

## 0. Checkout

The canonical checkout (`/Users/yurasachenko/LifeOS/LifeOS_DesignSystem`) is on `handoff/jenkin-cloud-20260930`
with another session's staged files; the S1 worktree belongs to S1. As the task allowed, S2 used a new worktree
`/Users/yurasachenko/LifeOS/LifeOS_encryption-documents` (own `apps/api/.venv` and `apps/web/node_modules`). The
canonical checkout, its index, the S1 worktree, `main` and the stashes were not touched. Remove after review:
`git worktree remove /Users/yurasachenko/LifeOS/LifeOS_encryption-documents`.

S1 hardening was re-verified in source and preserved (invitation verification only for `sent`; atomic throttle
admission; invitation mail outside the transaction; head `20261001_0011` → now `20261001_0012` on top).

## 1. Commits

| Commit | Scope |
|---|---|
| `d91cd0c` | feat(api): AES-256-GCM envelope encryption, versioned keyring and key tooling; deps `cryptography`, `pypdf` |
| `13c9f1f` | feat(api): encrypted document storage, API, export, erasure and rotation; migration `20261001_0012`; key runbook |
| `8338fed` | feat(web): Finance → Documents UI and decrypted-documents export row |
| `8a5fe3c` | test(api): XOR bit-flip in tamper tests (a fixed-byte overwrite was a no-op 1 time in 256 — failed once in a Kyiv run) |
| (docs) | docs: discovery §8, decisions, roadmap, plaintext plan, mail/proxy runbook, module boundaries, master context §89, this report, QA artifacts |

Verify the tip live: `git ls-remote origin feat/jenkin-encryption-documents-20261001`.

## 2. Threat model and exact scope (checkpoint 1)

**Server-side encryption at rest — not end-to-end, not zero-knowledge.** A database-only compromise (dump, stolen
backup, read-only SQL) does not reveal document contents, original file names, titles or notes, and cannot move,
reorder, truncate or alter ciphertext undetected. The running API decrypts for authorized requests; whoever controls
the API process, its memory or the keyring can read everything.

| Encrypted (AES-256-GCM) | Readable in the database |
|---|---|
| file contents of every version; original file names; titles; notes; per-version SHA-256 (inside the encrypted version metadata) | owner id; document/version ids; version numbers; verified content type; plaintext size; created/updated times; document revision; KEK id and envelope version per record |

Readable type and size are bound into the content's associated data, so editing them is detected. **Not changed
by S2:** snapshots, analytics tables, profile/health/notes/finance data, browser storage, the account export's
temporary file — see the plaintext-data plan.

Construction (`app/crypto`): one random 256-bit DEK per version (content + version metadata) and a fresh DEK per
metadata write; DEKs wrapped by a versioned KEK (60-byte blob: nonce ‖ ciphertext ‖ tag); 96-bit `os.urandom`
nonce per encryption; length-prefixed AAD naming purpose, owner, document, version, number, type, size (or document
+ revision for metadata), plus the KEK id for wrapping and the envelope version (`1`; unknown versions →
`UnsupportedEnvelope`). Primitive: `cryptography` `AESGCM` only.

Keys: JSON keyring at `LIFEOS_KEYRING_FILE` (0600/0400, owned by the service user/root; 0440 only with
`LIFEOS_KEYRING_ALLOW_GROUP_READ`), strict schema, unique ids and material, key check values. With
`LIFEOS_DOCUMENTS_ENABLED=true` the API **refuses to start** on a missing/unsafe/malformed keyring (verified live:
0644 → `KeyringError`); nothing generates keys implicitly or derives them from a password or the bootstrap token;
an unknown KEK id on a record → 503 `document_key_unavailable` with the id in the log. Environment-variable keys are
deliberately unsupported; KMS/HSM is a future backend.

## 3. Storage and API (checkpoint 2)

- Tables (`models/document.py`, migration `20261001_0012`): `documents`, `document_versions` (immutable),
  `document_blobs` (ciphertext, `STORAGE EXTERNAL`), composite `(id, user_id)` FKs so the database refuses a
  version/blob under another account's document; CHECKs on nonce/wrapped-key lengths, types, sizes.
- Storage: PostgreSQL behind `BlobStore` (`PostgresBlobStore`); **whole-object** encryption (no chunks) with a
  15 MiB default and a 50 MiB hard cap; the full object is authenticated before any byte is returned.
- Routes (`routes/documents.py`, all bound via `get_current_user`): `GET /documents/status`, `GET /documents`,
  `POST /documents`, `GET /documents/{id}`, `PATCH /documents/{id}` (expected_revision), `POST /documents/{id}/versions`
  (`X-LifeOS-Expected-Revision`), `GET /documents/{id}/content`, `GET /documents/{id}/versions/{n}/content`,
  `DELETE /documents/{id}` (expected_revision), `GET /export/documents`.
- Uploads: raw `application/octet-stream` body (no multipart → no Starlette disk spooling), metadata in
  `X-LifeOS-Document-Meta` (base64url JSON; never in the URL), `Idempotency-Key` required; same-origin check; size
  enforced on received bytes (Content-Length only for early refusal); bounded transfer slots (503 `documents_busy`
  with `Retry-After`); exact per-account count/byte quotas under a row lock.
- Validation by bytes (`services/documents/validation.py`): PNG structure with CRCs, JPEG marker walk, PDF via
  pypdf (no rendering, no external references); encrypted PDFs refused with an honest message; extension/declared
  type mismatches refused; **not antivirus** (stated in UI and docs).
- Downloads: authorize → decrypt + authenticate → digest/size check → `Content-Disposition: attachment` (RFC 6266
  UTF-8 + ASCII fallback, extension of the *verified* type), `nosniff`, `no-store`, `CSP: default-src 'none'; sandbox`,
  `CORP: same-origin`; header-bound (no bearer/public URLs). The client re-types the blob as octet-stream.
- Foreign ids are indistinguishable from missing (`document_not_found`). Retries are idempotent; stale revisions are
  `revision_conflict` (never overwrite); concurrent version uploads: exactly one wins, versions are append-only.

## 4. UI (checkpoint 3)

Finance → **операции | документы** (`#/finances/documents`): intro stating that no amounts/loans are extracted,
"как защищены документы" with the precise scope, usage line, upload with guidance (localized file button),
pending/success/failure/retry, list (type · size · version · date; notes), details (title/notes editing, version
history with per-version download, new version upload, inline confirmed deletion mentioning backups), honest
unavailable and key-unavailable states. No "all data encrypted" claim anywhere (pinned by a test). Settings →
Export gains "Документы (расшифрованные файлы)" with a plaintext warning (only when enabled).

## 5. Rotation, export, erasure (checkpoint 4)

- CLI (`app/cli.py`): `keyring-generate`, `keyring-add-key [--activate]`, `keyring-import-key`, `keyring-activate`,
  `keyring-check`, `keyring-retire-key` (refuses the active key and any key still used by a live record),
  `documents-rotate` (re-wraps DEKs only, batches, CAS, resumable), `documents-verify [--deep]` (exit 0 only when
  every live record authenticates *and* uses the active key — live-DB completion, not backup compatibility).
- Account export: readable document columns (`documents`, `document_versions`) + a manifest note; never ciphertext,
  wrapped keys or KEK ids. Decrypted files only via the explicit, bound, streamed `GET /api/v1/export/documents`
  (no temporary file; one version in memory at a time; unreadable versions listed with their state; stops if the
  session ends). Completeness guards: registry check for `document*` tables + a test that every owner-scoped table
  is exported or explicitly excluded with a reason.
- Erasure: document deletion removes rows, wrapped keys and blobs in one transaction; account deletion cascades.
  Backups keep ciphertext and wrapped keys until they expire; KEK destruction is deployment-wide (runbook §8).
- Pre-existing export behaviour recorded: the account ZIP is a plaintext server temp file (unchanged).

## 6. Findings fixed on the way

- Alembic's `fileConfig` disabled existing application loggers when migrations ran in-process (tests): log-secrecy
  assertions could pass vacuously. `disable_existing_loggers=False`.
- The `HTTPException` handler dropped headers (`Retry-After`).
- QA: native file input text followed the browser language; replaced by a localized button. "0 bytes" showed "1 КБ".

## 7. Verification

Only `lifeos_test` was used; `lifeos_dev` was never connected to. No real mail, no real documents, no owner keys.

| Check | Result |
|---|---|
| Baseline (S1 tip) | backend 822 + 1 skipped (as reported); frontend 882 |
| `apps/api: python -m pytest`, `PGTZ=UTC` | **912 passed, 1 skipped** (final run: see §7.1) |
| `apps/api: python -m pytest`, `PGTZ=Europe/Kyiv` | **912 passed, 1 skipped** (final run: see §7.1) |
| `ruff check .` | All checks passed |
| `alembic heads` / `current` (lifeos_test) | `20261001_0012 (head)` / `20261001_0012 (head)` |
| CLI round trip on lifeos_test: downgrade → `20260930_0009` (3 steps) → upgrade head (3 steps) | PASS; plus tests: empty round trip, refusal with documents present |
| `apps/web: npm test` | **895 passed** (59 files) — one earlier run had 3 transient timing failures in `smoke`/`projects-ui` while the browser matrix loaded the CPU; they pass in isolation and in every rerun |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS |
| `git diff --check` | PASS |

New backend tests (+90): `test_crypto_envelope.py` (round trips, nonce freshness, tamper/truncate/extend, context
substitution incl. cross-owner, AAD ambiguity, unknown envelope/KEK ids, keyring validation and permissions),
`test_document_validation.py`, `test_documents_api.py` (formats, binding, cross-owner, CSRF/multipart, read-time
limits incl. chunked bodies and lying Content-Length, no temp files, failure cleanup, idempotency incl. concurrent
retries, revision conflicts, concurrent versions, quotas, tampering of blobs/size/type/wrapped keys, ciphertext
swaps across versions and owners, unknown key, disabled/fail-closed start, transfer slots, logs free of secrets,
exports, deletion, account erasure, DB-level owner FK), `test_document_rotation.py` (rotation without touching
ciphertext, interruption + resume, concurrent edit vs CAS, lost key, CLI rotate/verify/retire/import, destructive
downgrade refusal, empty round trip, export after rotation). Frontend +13 (`finance-documents.test.jsx`).

Browser (production build + real API): 20 scenarios and an 80-configuration matrix (5 widths × RU/UK ×
Current/DejaVu × 4 themes): 0 overflow, 0 text < 12 px — `Outputs/Implementations/jenkin-encryption-documents_20261001/README.md`.
Downloaded bytes matched the synthetic originals (SHA-256) for v1, v2 and single-version documents.

### 7.1 Final run (code at `8a5fe3c`)
Backend `PGTZ=UTC` **912 passed, 1 skipped**; `PGTZ=Europe/Kyiv` **912 passed, 1 skipped**; ruff clean; frontend
**895 passed (59 files)**, typecheck / lint / build PASS; `git diff --check` PASS. One earlier Kyiv run failed a
single tamper test because a fixed-byte overwrite happened to equal the random ciphertext byte (no tampering
occurred); fixed in `8a5fe3c`, then 15/15 repeated runs of the tamper tests and both full runs above passed.

Not run / environment-limited: production deployment and real key custody (E-06), KMS/HSM, real SMTP, proxy
topology (E-03), Firefox/WebKit, screen readers, multi-process load on upload slots, very large real-world PDFs.

## 8. Production prerequisites (activation is BLOCKED_EXTERNAL)

1. **E-06 key custody**: where the production keyring lives (host file or secret mount), who holds the offline
   escrow copy, who may rotate, and the database-backup retention period (decides when old keys may be destroyed).
   Then follow runbook §1 (generate, escrow, verify check values, set `LIFEOS_DOCUMENTS_ENABLED=true` and
   `LIFEOS_KEYRING_FILE`), §4 restore drill before storing real documents.
2. **E-11 capacity**: memory ≈ `DOCUMENT_MAX_CONCURRENT_TRANSFERS × 3 × DOCUMENT_MAX_BYTES` + baseline; database and
   backup growth ≈ stored plaintext size.
3. Deploy migration `20261001_0012` (and the S1 migrations) to the target database — `lifeos_dev` is still at
   `20260721_0001` and was not touched (owner decision E-04).
4. Install the hashed lock files (`cryptography==50.0.2`, `pypdf==6.19.0` added).
5. Owner review of the key runbook (roadmap acceptance item).
SMTP (E-01/E-02) and proxy facts (E-03) are not prerequisites for documents; their setup is in the mail/proxy runbook.

## 9. Next slice

F1 — financial obligations and document linkage: `fin_*` tables (accounts, obligations, versioned contractual
terms, dated balance observations, schedules, payments, allocations), money in minor units with explicit currency,
documents linked to obligations with page/clause provenance and explicit confirmation of every extracted value,
reissued contracts as new term versions of the existing obligation. Builds on this slice's document ids and
encryption (sensitive free text through `app/crypto`).
