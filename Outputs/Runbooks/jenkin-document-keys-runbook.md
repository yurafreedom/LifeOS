# JENKIN document encryption — keys, storage and backup runbook

Date: 2026-10-01 (Europe/Kyiv) · Slice S2 · Code: `apps/api/app/crypto/`, `apps/api/app/services/documents/`,
`apps/api/app/cli.py`. Status: implemented on `feat/jenkin-encryption-documents-20261001`; **production activation is
blocked on key custody (decision register E-06)**. Nothing in this runbook has been executed against production.

All commands run from `apps/api` with the deployment's environment (`LIFEOS_DATABASE_URL`, `LIFEOS_BOOTSTRAP_TOKEN`,
`LIFEOS_KEYRING_FILE`, …). None of them prints key material: they print key ids and 16-hex-digit **check values**
(HMAC of a fixed label), which let you compare two copies of a key without revealing it.

## 0. What is protected, and what is not

| | Protected (AES-256-GCM, encrypted in the database) | Readable in the database |
|---|---|---|
| Document file contents (every version) | ✔ | — |
| Original file name of each version | ✔ | — |
| Title and notes | ✔ | — |
| SHA-256 of each version's content (used only to recognise retries) | ✔ (inside the encrypted version metadata) | — |
| Owner id, document id, version id/number | — | ✔ (needed for authorization and ordering) |
| Verified content type (PDF/JPEG/PNG) and plaintext size | — | ✔ (quotas, listing without decryption) — but bound into the authenticated context, so editing them is detected |
| Created/updated times, document revision | — | ✔ |
| Wrapping-key id and envelope version per record | — | ✔ (operational: rotation, verification) |
| Snapshots, analytics tables, profile, health, notes, existing finance data | **not changed by S2** — still plaintext | see `Outputs/Plans/jenkin-existing-plaintext-data-plan_20261001.md` |

Threat model in one paragraph: this is **server-side encryption at rest**. Someone who obtains only the database
(a dump, a stolen backup, read access to the tables) cannot read document contents, names, titles or notes, cannot
move a ciphertext to another account/document/version/field without detection, and cannot alter, truncate or
reorder content without detection. The **running API can decrypt** anything it is authorized to serve. Whoever
controls the API process, its memory, or the keyring file can decrypt everything. It is not end-to-end or
zero-knowledge encryption, and the UI says so.

Mechanics: each version has its own random 256-bit data key (DEK) that encrypts the content and the version
metadata; each document's title/notes are encrypted under a fresh DEK on every edit. DEKs are wrapped by a
**key-encryption key (KEK)** from the keyring; the record stores only the KEK id and the 60-byte wrapped DEK.
Associated data binds: purpose, owner id, document id, version id, version number, content type, size (content), or
document id + revision (metadata), plus the KEK id (wrapping) and the envelope version. Nonces are 96-bit CSPRNG
values per encryption. Primitives: `cryptography`'s `AESGCM`; nothing custom.

## 1. Initial key provisioning

1. Decide key custody (E-06): who holds the production keyring, where its escrow copy lives, who may rotate.
   Recommended: a dedicated secret store / deployment secret mount for the running copy, and an **offline escrow
   copy** (e.g. an encrypted password-manager vault or a hardware-backed secret store) held by the owner — never
   in the same place as database backups.
2. On a trusted machine (not inside the repository):
   ```sh
   umask 077
   python -m app.cli keyring-generate /secure/path/jenkin-keyring.json --key-id kek-20261001
   ```
   The command refuses to overwrite an existing file, writes it `0600`, and prints the check value.
3. Record the key id, creation date and check value (not the key) in the operations log.
4. Make the escrow copy now, before the first document is stored. Verify it:
   `python -m app.cli keyring-check /escrow/copy.json` → same ids and check values.
5. Install the running copy (see §2), then set:
   ```
   LIFEOS_DOCUMENTS_ENABLED=true
   LIFEOS_KEYRING_FILE=/run/secrets/jenkin-keyring.json
   # optional, only for a mount that grants read through a dedicated group (0440):
   LIFEOS_KEYRING_ALLOW_GROUP_READ=true
   ```
6. Start the API. If the keyring is missing, unreadable, too open, malformed, or its active id is absent, the API
   **refuses to start** (`KeyringError`). It never generates a replacement key and never falls back to plaintext.
7. Smoke test with a synthetic PDF: upload, download, compare bytes; `python -m app.cli documents-verify --deep`.

Never: commit a keyring, put it in a database row, an environment variable dump, a frontend bundle, a report, a
ticket or a log; derive it from a password or from `LIFEOS_BOOTSTRAP_TOKEN`.

## 2. File permissions and supported placements

The loader requires a **regular file**, owned by the service user or root, with **no permissions for "other"** and
no group write/execute. Group read (`0440`) is refused unless `LIFEOS_KEYRING_ALLOW_GROUP_READ=true`.

| Placement | Status | Notes |
|---|---|---|
| Restricted file on the host (`0400`/`0600`, owner = service user) | Supported (preferred for self-hosting) | Outside the repository and outside any directory included in database backups. |
| Container/orchestrator secret mount | Supported | Kubernetes: `defaultMode: 0400` (or `0440` + `fsGroup` + the group-read opt-in). Docker Compose/Swarm secrets: set `mode: 0400` and `uid` to the service user. Symlinked mounts are fine (the target is checked). |
| Environment variable holding key material | **Not supported** (deliberately) | Environment is inherited by children and appears in process listings, crash reports and debug dumps. |
| Cloud KMS / HSM wrapping | **Not implemented** | Fits behind the keyring interface later (KEK operations remote, DEKs unchanged). Requires its own slice. |

## 3. Backups: keys separately from the database

- Database backups contain ciphertext, wrapped DEKs and KEK ids — **not** KEKs. Without the keyring they are
  unreadable; without the database the keyring is useless. Store them **in different places with different
  access**; whoever has both can read everything.
- After **every** keyring change (add, activate, retire), back up the new file and re-check the escrow copy's
  check values.
- Keep every KEK that any **retained** database backup still depends on until that backup has expired (§5).

## 4. Restore verification (old and current key versions)

After restoring a database backup into a disposable database:

```sh
LIFEOS_DATABASE_URL=<restored db> LIFEOS_KEYRING_FILE=<escrowed keyring> python -m app.cli documents-verify --deep
```

- `Verified N document(s) and M version(s) including content; records per key: kek-a=…, kek-b=…` and exit 0 →
  every record authenticates; the listed key ids are what this backup needs.
- `NOT complete: … record(s) on other keys` (exit 1) with no failures → readable, but not every record is on the
  active key (normal for a backup older than the last rotation). Keep the older key(s).
- `FAILED: documents/<id>` / `document_versions/<id>` → that record's key is absent or the data was altered.
  Find the key id with SQL (`SELECT kek_id FROM document_versions WHERE id = …`) and locate it in escrow. Do not
  "repair" by editing rows.

Practise this restore check at least once before storing real documents, and after each rotation.

## 5. Rotation and retirement

1. Add a new KEK and activate it on a trusted machine:
   `python -m app.cli keyring-add-key /secure/jenkin-keyring.json --key-id kek-20270101 --activate`
   (atomic replace, `0600`, old keys kept).
2. Back up the new file (escrow), verify check values.
3. Deploy the file to **every** API process and restart them. New data keys are now wrapped with the new KEK.
   (Deploy before step 4, or processes still on the old active key will keep creating old-key records — which the
   verification step then reports.)
4. Re-wrap: `python -m app.cli documents-rotate --batch-size 200`.
   Only 60-byte wrapped DEKs are rewritten; content and metadata ciphertext are untouched. Each batch commits
   separately; records edited concurrently are skipped by a compare-and-swap and re-wrapped afresh in a later batch.
5. Verify: `python -m app.cli documents-verify --deep` must exit 0 ("every record authenticates and uses the active
   key"). This is **live-database completion only**.
6. Retire the old KEK **only** when no retained backup needs it:
   `python -m app.cli keyring-retire-key /secure/jenkin-keyring.json --key-id kek-20261001 --confirm-no-backups-need-it`
   It refuses while any live record still uses that key, and refuses the active key. Keep the escrowed old key until
   the last backup made before the rotation has expired; then destroy it.

Nothing removes a key automatically.

## 6. Missing or lost keys

- **API refuses to start** (`KeyringError: …`): the configured file is missing, unreadable, too open or malformed.
  Fix the file/permissions/mount; do not disable documents to "get it running" unless you accept that documents
  become unavailable (the UI then shows "storage is off").
- **A record names an unknown key** (`document_key_unavailable`, HTTP 503; the log line `document.key_unavailable`
  carries the record id and the missing `kek_id`, never content): restore that key from escrow into the running
  keyring with `python -m app.cli keyring-import-key <keyring> --from <escrow file> --key-id <kek id>` (atomic,
  `0600`, does not change the active key), compare check values with `keyring-check`, redeploy, restart. The UI shows "the key for this document is not configured on the server" and refuses to
  overwrite unreadable metadata.
- **A KEK is truly lost**: every record wrapped only by it is permanently unreadable — in the live database and in
  every backup. There is no recovery path; this is the intended property of the design. Users can delete those
  documents; nothing else can decrypt them.

## 7. Partial rotation

An interrupted `documents-rotate` is safe: the database holds a mix of old-key and new-key records, and both keys are
in the keyring, so everything stays readable. Re-run `documents-rotate`; it continues where it stopped. Do not retire
the old key until `documents-verify` exits 0. A rotation that reports `unreadable` records has found records whose
key is missing or whose data was altered — investigate them (§4) before going further.

## 8. Deletion and backup-retention limits

- Deleting a document removes, in one transaction, its row, every version row, every **wrapped DEK** and every
  content ciphertext (`document_blobs`) from the live tables. Account deletion cascades the same way.
- PostgreSQL keeps dead tuples until VACUUM, and WAL/replicas/point-in-time backups keep older pages for their own
  retention. **Backups taken before the deletion still contain the ciphertext and the wrapped DEKs** until they
  expire. JENKIN does not claim immediate cryptographic erasure from backups.
- Crypto-shredding by KEK deletion is **deployment-wide**: destroying a KEK makes *every* record (all accounts)
  that still depends on it unreadable, in the live database and in backups. It cannot erase one user's documents.
- The decrypted documents export (`jenkin-documents.zip`) and downloaded files are plaintext copies outside
  JENKIN's protection once they leave the server.

## 9. Configuration reference (all `LIFEOS_`-prefixed)

| Variable | Default | Meaning |
|---|---|---|
| `DOCUMENTS_ENABLED` | `false` | Turns document storage on; requires `KEYRING_FILE`. |
| `KEYRING_FILE` | — | Path of the JSON keyring. |
| `KEYRING_ALLOW_GROUP_READ` | `false` | Accept `0440` secret mounts. |
| `DOCUMENT_MAX_BYTES` | 15 MiB | Per version; hard upper bound 50 MiB (whole-object AES-GCM in memory). |
| `DOCUMENT_MAX_PER_ACCOUNT` | 1000 | Documents per account. |
| `DOCUMENT_MAX_ACCOUNT_BYTES` | 512 MiB | Plaintext bytes across all versions per account. |
| `DOCUMENT_MAX_CONCURRENT_TRANSFERS` | 4 | Uploads/downloads/exports holding plaintext in memory per process (503 `documents_busy` beyond). |

Peak memory per transfer ≈ 3 × the version size (request body, ciphertext, validation buffers). Size the process
for `DOCUMENT_MAX_CONCURRENT_TRANSFERS × 3 × DOCUMENT_MAX_BYTES` plus the normal baseline.

## 10. Storage choice (PostgreSQL) and its limits

Ciphertext lives in `document_blobs` (`bytea`, `STORAGE EXTERNAL` — no futile compression) behind the `BlobStore`
interface (`services/documents/store.py`). Reasons: no external service to operate, version + blob commit atomically,
one backup story. Costs: documents grow the database and every database backup (≈ plaintext size + 28 bytes per
version), and downloads are not streamed (whole-object authentication first). If the database grows uncomfortable,
an object-storage `BlobStore` can replace it; that backend would need its own deletion and retention procedure.
