# JENKIN — protecting existing plaintext data (plan, not implemented)

Date: 2026-10-01 (Europe/Kyiv) · Companion to S2 (`Outputs/Implementations/jenkin-encryption-documents-s2_20261001.md`)
and the key runbook (`Outputs/Runbooks/jenkin-document-keys-runbook.md`). Status: **PROPOSED**. S2 deliberately did
**not** encrypt, transform or migrate any of the data below; every item needs the owner's review and its own slice.

## 0. Ground rules for every item

- **Threat model first.** Server-side encryption at rest protects against database-only disclosure (dumps, stolen
  backups, read-only SQL access). It does nothing against the running API, its keys, or a compromised server.
  Browser-side encryption at rest protects against reading the profile's files offline (another OS user, a disk
  image, a synced profile). It does **nothing** against script running in the JENKIN origin (XSS, a malicious
  extension with page access, a compromised bundle): such script can call the same decryption the app calls.
  Neither replaces the other; neither is end-to-end.
- **No raw key next to ciphertext.** A browser design that stores the decryption key in the same storage as the
  ciphertext (localStorage/IndexedDB, extractable or exported) adds nothing and must not be described as
  protection. WebCrypto non-extractable `CryptoKey` objects stored in IndexedDB prevent *copying the key out*, but
  any same-origin script can still *use* them, and anyone with the profile on the same browser can too.
- **Reuse S2 primitives.** Server-side items use `app/crypto` (AES-256-GCM envelope, keyring, AAD binding, rotation
  tooling). No second scheme.
- **Reversible, verified migrations.** Every server migration is: schema-version bump → dual-read (plaintext *or*
  envelope) → background re-encryption in idempotent batches with CAS → verification that counts what is left →
  only then removal of the plaintext read path. Downgrades must say whether they decrypt (data-preserving) or drop.
- **Missing data is not zero; nothing is invented.** A record that cannot be decrypted is shown as unavailable,
  never as empty.

## 1. Server: `user_snapshots.payload` (health, medications, notes, profile, tasks, existing finance)

- **Current exposure.** One JSONB document per account, plaintext. Includes profile, health/medication logs, pet
  data, quick notes, tasks, projects, habits and the historical `transactions[]` (no currency, D-07).
- **Proposed protection.** Field-group encryption inside the snapshot: keep the structural/sync fields readable
  (`version`, revision, ids needed for merges), encrypt sensitive groups (`profile`, `medications`, `doseLogs`,
  `health`, `notes`/`quickNotes`, `transactions`, `dog`) as envelope blobs with AAD = owner ‖ snapshot ‖ group ‖
  schema version. Alternative (simpler, less granular): encrypt the whole payload; costs server-side features that
  read the snapshot (System Review context, analytics import), which would then decrypt in memory.
- **Key custody.** The same deployment keyring as documents (one KEK set, per-group DEKs).
- **Migration / recovery.** Snapshot schema v3; dual-read; re-encrypt on next write *plus* a background batch for idle
  accounts; `documents-verify`-style verifier for snapshots. Recovery: the plaintext column is cleared only after
  verification; a backup taken before then still holds plaintext (state this in the report).
- **Retention.** Unchanged (current snapshot only). Older plaintext lingers in WAL/backups until they expire.
- **Logout / account switch.** Server data is unaffected by client logout; binding (S1) already prevents cross-account
  reads.
- **Compatibility.** The optimistic-concurrency revision and conflict UI must keep working; export must decrypt for
  the owner; AA legacy import reads `transactions[]` and must go through the decrypting read path.

## 2. Server: Adaptive Analytics tables (`aa_*`)

- **Current exposure.** Plaintext facts (amounts, values, notes in reviews/decisions, finance context, experiment
  text). Indexed and queried by SQL (time ranges, subjects, metric keys).
- **Proposed protection.** Encrypt only free-text and user-entered narrative columns (`value_text`, review/decision
  text, `aa_finance_contexts` free text). Numeric values used by SQL aggregation stay readable unless the owner
  accepts moving those computations into the application. Subjects/metric keys stay readable (they drive indexes).
- **Key custody.** Same keyring.
- **Migration / recovery.** Per-table batches with CAS on (`id`, `status`), dual-read, verifier. Superseded and
  tombstoned rows are migrated too (history must not stay plaintext). Retention/erasure (Slice 8) must clear the
  envelope, not just the plaintext column.
- **Retention.** Existing retention policies apply unchanged.
- **Logout / switch.** No change (server).
- **Compatibility.** Export registry and completeness guards must describe encrypted columns; System Review exports
  decrypt in memory; redaction markers stay plaintext (they contain no values).

## 3. Browser: pending unsaved snapshots (`lifeOsPendingSnapshot:<user id>` in localStorage)

- **Current exposure.** Full snapshot payload in plaintext, per account key, kept until restored or discarded (S1
  H-04). Survives restarts; readable by anyone with the browser profile and by any same-origin script.
- **Proposed protection.** (a) **Minimise first**: store only the *diff* that was unsaved, cap age (e.g. 14 days) with
  a visible notice before discard, and offer "forget this device" that clears it. (b) **Optional encryption at rest**
  with a key that is *not stored on the device*: a per-account "device copy key" wrapped server-side (fetched only
  after authentication, held in memory). Then a stolen profile without a live session cannot read the copy; a
  logged-in attacker or same-origin script still can.
- **Key custody.** Server-held per-account wrapping key (from the S2 keyring) that releases a per-device key only to
  an authenticated, bound session; nothing persistent in the browser.
- **Migration / recovery.** Restart recovery requires the user to sign in again before the copy can be decrypted and
  offered (today it is offered right after sign-in anyway). If the server is unreachable, the copy stays encrypted
  and is offered later; an explicit "download unsaved copy" stays available only after decryption.
- **Retention.** Age cap + explicit discard; cleared on "forget this device" and on confirmed account deletion.
- **Logout / switch.** Unchanged S1 rules (kept per account, offered only to that account); with encryption, a
  different account cannot decrypt another account's copy even on the same device.
- **Shared devices.** Guidance in the UI: on a shared computer, choose "sign out and discard" (or "forget this
  device"); copies otherwise remain for the next sign-in of that account.
- **Compatibility.** Existing plaintext copies are read once, then rewritten encrypted (or discarded after the
  notice). Older bundles cannot read encrypted copies — gate by a version marker.

## 4. Browser: IndexedDB analytics write queue (`lifeos-adaptive-analytics`)

- **Current exposure.** Queued AA writes (values, notes) in plaintext until replayed; owner-bound and quarantined
  (S1), not encrypted.
- **Proposed protection.** Same per-account device-copy key as §3 for the `payload` field; keep routing metadata
  (owner, idempotency key, attempts) readable so replay scheduling works without the key. Replay waits for an
  authenticated session (it already does).
- **Migration / recovery.** IndexedDB v3 upgrade encrypts existing records lazily on first authenticated start;
  undecryptable records are quarantined, never dropped silently, and surfaced in Settings.
- **Retention.** Replayed records are deleted (unchanged); quarantined records get an age cap with notice.
- **Logout / switch.** Unchanged (owner-bound replay).
- **Compatibility.** The AA write gate and server idempotency are unchanged.

## 5. Browser: legacy and retired local data (`lifeOsState`, `lifeOsStateRetired`)

- **Current exposure.** Pre-server plaintext snapshot(s) on old devices.
- **Proposed protection.** Do not encrypt — **retire**: after a successful import (or an explicit decline), offer
  permanent deletion with a short grace period and a final download; show a Settings notice while any legacy copy
  remains. Encryption would add little for data whose only purpose is a one-time import.
- **Retention.** Grace period (e.g. 30 days) then a prompt to delete; never deleted without confirmation (D-06).
- **Logout / switch / shared devices.** Already ownership-gated (S1); the plan adds the retirement prompt.

## 6. Account exports and server temporary files

- **Current exposure.** `GET /api/v1/export` writes a plaintext ZIP to an anonymous `TemporaryFile` (unlinked on
  POSIX) for the duration of the download; blocks remain in the temp filesystem until reused. The decrypted
  documents export (S2) is streamed without any temp file. Downloaded archives are plaintext on the user's device.
- **Proposed protection.** (a) Stream the account export like the documents export (no temp file); or (b) place the
  temp directory on tmpfs / an encrypted volume and document it as a deployment requirement. (c) Optional
  passphrase-encrypted export (e.g. age/ZIP-AES) chosen by the user, with the honest note that a forgotten
  passphrase makes the export useless.
- **Key custody.** (c) user-held passphrase only; never stored.
- **Retention.** Server: none beyond the request. Client: the user's responsibility; the UI says so.
- **Logout / switch.** Exports are account-bound and aborted on account change (S1); unchanged.

## 7. Sequencing proposal

1. §6(a) streamed account export (small, removes server plaintext residue).
2. §1 snapshot field-group encryption (largest privacy gain; needs dual-read).
3. §3/§4 browser device-copy key (needs a small server endpoint; design review for XSS limits).
4. §2 AA free-text columns.
5. §5 legacy retirement prompt.

Each step: discovery against live code, owner approval of the exact field list, migration with verifier and an
honest report of what stays readable.
