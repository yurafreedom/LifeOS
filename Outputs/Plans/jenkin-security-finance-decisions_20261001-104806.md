# JENKIN security & finance — decision register

Date: 2026-10-01 (Europe/Kyiv). Companion to
`Outputs/Discoveries/jenkin-security-finance-discovery_20261001-104806.md` and
`Outputs/Plans/jenkin-security-finance-roadmap_20261001-104806.md`.

Columns: **Kind** — OWNER (approved by the owner on 2026-10-01), ARCH (routine architecture choice made
under that approval; recorded so it can be reviewed), EXTERNAL (a prerequisite only the owner or a third
party can supply). Approval never supplies credentials, keys, deployment facts or partner access.

Loan-document workflow decisions (LD-xx, LA-xx, U-xx; 2026-10-01, later) are kept in
`Outputs/Plans/jenkin-loan-document-decisions_20261001-163647.md`.

## 1. Owner-approved decisions

| ID | Decision | Kind | Where it lives |
|---|---|---|---|
| D-01 | Additional accounts are created only by private, owner-issued invitations — no public registration. | OWNER | `services/account_access.py`, Settings → Security |
| D-02 | Invitations are email-bound, single-use and expiring; 7 days is the initial default. | OWNER | `Settings.invitation_ttl_seconds` |
| D-03 | Development/test mail adapters and production SMTP sit behind one delivery interface. | OWNER | `app/mail/` |
| D-04 | Standard, maintained libraries are used where needed; necessary new dependencies are approved despite the default prohibition. S1 needed **none** (stdlib `smtplib`/`email`/`secrets`/`hashlib`, existing `pwdlib`). | OWNER | — |
| D-05 | New production accounts start empty. | OWNER | `lifeData/initialState.js` |
| D-06 | Existing owner records are never automatically deleted as "demo". | OWNER | No cleanup migration; detection only (roadmap S1-follow-up) |
| D-07 | Historical transaction currency is not silently reinterpreted. | OWNER | `$` labels and AA `UAH` facts left as they are (finding S-21) |
| D-08 | Financial and bank entities use normalized `fin_*` tables, independent of the AA write gate. | OWNER | F1 |
| D-09 | Documents and bank credentials use established authenticated envelope encryption (S2). | OWNER | S2 |
| D-10 | Financial calculations are deterministic, explainable and based on confirmed contractual terms. | OWNER | F2 |
| D-11 | Diia stays a documented future integration until partner requirements and access exist. | OWNER | I2 |
| D-12 | The S0 → S1 → S2 → F1–F5 → I1/I2 sequence below is approved; slices after S1 are not started. | OWNER | roadmap |

## 2. Architecture choices made under that approval (S1)

| ID | Choice | Rationale |
|---|---|---|
| A-01 | `X-LifeOS-Account` request header carries the client's *expected* account; every protected route requires it (428 when missing, 409 `session_user_mismatch` when different). `/auth/me` unbound; logout optionally bound. | The cookie is shared by tabs; only the client knows which account its in-memory state belongs to. Never an authorization credential. Technical identifiers keep the `LifeOS` name until the rename plan (master context §84). |
| A-02 | Client generation counter: binding another account aborts all requests and discards late responses. | Late A responses must never reach B's state. |
| A-03 | Cross-tab: BroadcastChannel `lifeos-auth` (storage-event fallback); messages are hints, identity always re-read from `/auth/me`. | Avoids trusting another tab's claim. |
| A-04 | Account switch shows an explicit screen; the new account's tree is mounted only on a choice. | Prevents the user editing B while believing it is A. |
| A-05 | Unsaved snapshot edits kept per account in `localStorage` (`lifeOsPendingSnapshot:<id>`), restored only by compare-and-swap. | Synchronous on unmount; never replayed into another account; never auto-merged. |
| A-06 | Queue isolation = mandatory owner on every record + owner-checked updates + owner-bound replay + quarantine for ownerless v1 records; one IndexedDB database. | v1 records already had owners, so per-account databases would only add migration risk. |
| A-07 | Throttling stored in PostgreSQL (`auth_throttle`) keyed by SHA-256 digests. **Hardened:** admission is one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` per policy, committed before slow work. Request quotas (recovery, verification mail, invitations) consume a slot per request; failure counters (login, password change, token guessing) reserve a slot before the secret is checked and refund it on success. | Works with several workers and processes; concurrent requests cannot exceed a limit (reproduced race fixed); no plaintext email/IP stored. Limits in `services/throttle.py::POLICIES`. |
| A-08 | Recovery: 202 for every address, mail sent after the response; 503 for every address when no mail backend exists. | No enumeration through body or timing; no false "sent". |
| A-09 | Invitations without working mail return the link once to the owner ("manual"/"failed"), never store it. | Lets a self-hosted owner onboard someone without SMTP while saying plainly that no mail went out. |
| A-10 | Tokens travel in the URL fragment (`#/auth/{reset,verify,invite}/<token>`) and are scrubbed from history on read. | Fragments are not sent to servers or in Referer. |
| A-11 | Audit: coarse network (/24, /48) and device label; 365-day retention; exported; erased with the account except one anonymous `account_deleted`. | Useful security history without unnecessary personal data. |
| A-13 | **Invitation authorization ≠ email verification.** Only an invitation delivered by mail (`delivery = sent`, link never shown to anyone) verifies the address on acceptance — the same standard as a verification link. `manual`, `failed` and `pending` invitations create an unverified member, who verifies through the normal flow. Invitation mail is sent with no transaction open (`pending` → `sent`/`failed`). Migration `20261001_0011` clears only acceptance-derived verification of unsent invitations. | A link the owner saw proves only the invitation. |
| A-12 | `Cache-Control: no-store`, `Pragma: no-cache`, `Vary: Cookie` on all `/api` responses except `/api/healthz`. | Private responses must not be cached or shared. |

## 2a. Architecture choices made under that approval (S2, 2026-10-01)

| ID | Choice | Rationale |
|---|---|---|
| A-14 | AES-256-GCM envelope (`cryptography` `AESGCM`), random 256-bit DEK per version and per metadata write, DEKs wrapped by a versioned KEK; 96-bit CSPRNG nonces; envelope version stored per record. | Rotation re-wraps 60-byte keys, never content; metadata edits never accumulate under one key. |
| A-15 | Associated data = length-prefixed `purpose ‖ owner ‖ document ‖ version ‖ number ‖ content_type ‖ size` (content and version metadata), `owner ‖ document ‖ revision` (descriptive metadata), plus `kek_id` for wrapping. | Unambiguous encoding; detects cross-owner/object/field substitution, reordering, and edits to readable size/type columns. |
| A-16 | Keyring = one restricted JSON file (`LIFEOS_KEYRING_FILE`, 0600/0400, owner = service user/root; 0440 only with opt-in); environment-variable keys deliberately unsupported; KMS/HSM deferred. Startup fails closed when documents are enabled; nothing generates keys implicitly. | Simple, auditable custody for a self-hosted owner; secret mounts supported. |
| A-17 | Whole-object encryption (no chunking) with a 15 MiB default and a 50 MiB hard cap; the whole version is authenticated before any byte is returned. | Bounded memory makes streaming unnecessary; avoids premature-release of unauthenticated plaintext. |
| A-18 | PostgreSQL `document_blobs` behind a `BlobStore` interface; composite `(id, user_id)` FKs; `STORAGE EXTERNAL`. | No external dependency; atomic version+blob commits; replaceable later. |
| A-19 | Uploads are raw `application/octet-stream` bodies (no multipart, no `UploadFile`), metadata in a base64url header, `Idempotency-Key` required, revision CAS (`X-LifeOS-Expected-Revision`) on new versions; read limit enforced on received bytes. | Starlette spools multipart files > 1 MiB to disk (plaintext residue); octet-stream is not a CORS-simple type; retries cannot duplicate. |
| A-20 | Content validated by bytes: PNG/JPEG structural walk (CRC, markers; no pixel decoding), PDF via pypdf (`pypdf==6.19.0`); encrypted PDFs refused; not antivirus. | No decoder attack surface for images; honest scope. |
| A-21 | Account export keeps readable document columns only; decrypted files only via the explicit streamed `GET /api/v1/export/documents` (no temp file). | The existing account export writes a server temp file. |
| A-22 | Migration `20261001_0012` downgrade refuses while documents exist unless `LIFEOS_ALLOW_DESTRUCTIVE_DOWNGRADE=documents`. | A destructive downgrade must not masquerade as data-preserving. |
| A-23 | Dependencies added: `cryptography==50.0.2`, `pypdf==6.19.0` (hashed lock files regenerated with pip-compile). | D-04. |

## 3. External prerequisites for production activation (BLOCKED_EXTERNAL)

| ID | Needed from | Exactly what | Blocks |
|---|---|---|---|
| E-01 | Owner / hosting | SMTP host, port, security mode (`starttls`/`ssl`), username, password (secret), verified sender address (`LIFEOS_MAIL_FROM`) with SPF/DKIM for its domain. | Recovery and verification mail; invitation mail (manual links still work). |
| E-02 | Owner / hosting | Public HTTPS URL of the web app (`LIFEOS_PUBLIC_APP_URL`). | Links in mail (production refuses SMTP without it). |
| E-03 | Owner / hosting | Deployment topology: number of trusted reverse-proxy hops (`LIFEOS_TRUSTED_PROXY_HOPS`), allowed hosts/origins, TLS termination. | Correct per-network throttling and audit networks behind a proxy. |
| E-04 | Owner | Decision to migrate `lifeos_dev` (at `20260721_0001`) — agents migrate only `lifeos_test`. | Using S1 locally against the owner's dev data. |
| E-05 | Owner (if several accounts pre-exist) | `python -m app.cli grant-owner <email>` to designate the owner. | Invitations on a database with more than one historical user. |
| E-06 | Owner | Key custody for S2: where the production keyring lives (host file / secret mount), who holds the offline escrow copy, who may rotate, backup-retention period of database backups (decides when old keys may be destroyed). Procedure ready: `Outputs/Runbooks/jenkin-document-keys-runbook.md`. | S2 activation (encryption must not fall back to plaintext). |
| E-11 | Owner / hosting | Memory budget and database/backup size headroom for documents (≈ 3 × 15 MiB per concurrent transfer; documents grow every DB backup). | Choosing `DOCUMENT_MAX_*` limits in production. |
| E-07 | monobank | Which access model applies (personal token for the owner's own self-hosted use vs. a corporate/partner API for onboarding others) and its terms. | F4. |
| E-08 | PrivatBank | Whether a personal API is actually available for the owner's accounts; otherwise statement files only. | F5. |
| E-09 | Diia / id.gov.ua | Partner requirements, contracts, certificates and test access. | I2. |
| E-10 | Owner | Confirmed contractual terms (rates, day-count, grace, allocation order, fees) per obligation — from documents, not memory. | F2 results beyond "partial / unsupported". |
