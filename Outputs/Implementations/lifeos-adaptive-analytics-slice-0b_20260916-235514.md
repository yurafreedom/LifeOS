# LifeOS Adaptive Analytics — Slice 0b implementation

SLICE_0B_STATUS=PASS

Scope: Export & Delete Foundation only. Acceptance completed before staging.
Report timestamp is UTC; local calendar date is 2026-09-17 (Europe/Kyiv).

## 1. Exact start state and authority

- Worktree: `/Users/yurasachenko/LifeOS/LifeOS-adaptive-analytics-slice-0b`.
- Branch: `feat/adaptive-analytics-slice-0b`.
- Starting HEAD and `origin/main`: `b5d34eb160624ce0ff01614a5bb9b92e572407f9`.
- Initial working tree: clean.
- Slice 0 commit `b19b7019a46c68c324087d16724735507a5bd597`: ancestor of HEAD.
- `adaptive-analytics-design-accepted` tag: object
  `6c507b829ebc4a2a1e5b1b353db04c1a29302be0`, peeled commit
  `d4960286ec94f35472600e59c0d533dc50a64351`, unchanged.
- Local corrected implementation Plan:
  `Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md`;
  especially §§11.4, 12, 14, 21, 22/C8, 24.2, 27, 28, 29, 32 and final corrections.
- Local targeted Discovery and accepted Slice 0 report were consulted, together
  with the current implementation. No forensic reconstruction was rerun.

## 2. Reproduced environment and pre-change baseline

- Python 3.11.15; isolated backend `.venv` created from the installed Python 3.11.
- `pip install --require-hashes -r requirements-dev.lock`: PASS.
- Node 22.20.0, npm 11.11.0; `npm ci`: PASS (120 packages).
- Lockfiles and dependency versions unchanged. No dependency upgrade/audit fix.
- PostgreSQL 18.3 Homebrew service was initially stopped and was started for the
  explicitly authorized local tests. It remains running; this is not a deploy.
- Only local disposable `lifeos_test` was accessed. No `lifeos_dev`, remote/shared
  database, production database or production downgrade was touched.
- Test database initially at M1 `20260909_0002`.

Baseline, before application changes:

| Check | Result |
| --- | --- |
| Backend pytest | 114 passed, 2 warnings, 38.86 s |
| Ruff | PASS |
| Frontend Vitest | 37 passed, 7 files |
| Typecheck / lint / build | PASS / PASS / PASS |

The existing npm audit reports 5 findings (3 moderate, 2 high). These are inherited,
not introduced or repaired by this slice. They remain a separate dependency task.

## 3. M2 and schema boundaries

Migration file: `20260909_0003_aa_deletion_receipts.py`.
Revision: `20260909_0003`; down revision: `20260909_0002`.
This is the single Alembic head and the actual test-database current revision.

New table `aa_deletion_receipts` has exactly five columns:
`id`, `user_id`, `table_name`, `fact_id`, `deleted_at`.
`user_id` cascades from `users`; `fact_id` deliberately has no FK to the erased row.
There is no value, reason, provenance payload or other deleted-content column.
The receipt has a user/deleted-time index and a nonempty table-name CHECK.

Necessary AA-only evolution for the accepted NULL-value tombstone contract:

- Measurement value-shape CHECK additionally permits an erased tombstone with
  every value/unit/scale field NULL. Active and superseded value legality is
  exactly the existing Slice 0 predicate; the six-type discriminator is unchanged.
- Coverage `source_id` and `coverage_state` permit NULL for tombstones; a new CHECK
  requires both on every non-tombstoned row. Existing C6 membership, partial-unit,
  completeness, interval and enum constraints remain intact.
- Existing legally shaped legacy tombstones remain compatible; this migration
  does not rewrite their contents. API tombstoning always clears the payload.

No PRE-AA table was altered. `user_snapshots.schema_version` stays 2.
No Slice 1 or Review table was created.

## 4. Account export

Authenticated `GET /api/v1/export` returns an attachment `lifeos-account.zip` with
`Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

Members: `account.ndjson`, `sessions.ndjson`, `user_snapshots.ndjson`, one NDJSON
member for every AA table, and `manifest.json`. Password hashes and session token
hashes/tokens are excluded; non-secret session metadata is included.

Export registry explicitly includes:

- `aa_metric_definitions` (global, non-personal reference catalogue);
- `aa_measurements`;
- `aa_source_coverage`;
- `aa_deletion_receipts`.

Every account-owned query scopes by authenticated `user_id`; the catalogue is the
only shared AA reference table. No history status filter or result cap is applied:
active, superseded and tombstoned rows, correction links and inline provenance
are exported. Decimal precision survives as strings; timestamps/dates use ISO.

The manifest names export format/version, snapshot schema version, current
Alembic revision, account, export time, files/row counts, AA column types/nullability
and interpretation rules for corrections, missing measurements and coverage.

One read-only REPEATABLE READ transaction prevents torn export history. Database
rows use bounded 200-row streaming batches. ZIP/NDJSON serialization is disk-backed
in a temporary file, not a history-sized list/BytesIO. HTTP transfer uses 64 KiB
chunks. File cleanup is covered on completion, iterator cancellation/disconnect
and serialization failure. ZIP64 is supported; the 5 MiB snapshot *request* cap is
not an export-response limit.

Completeness fails closed against both ORM AA metadata and the actual database
AA table names, including wrong table bindings. Tests introduce an unregistered
model and a transient unmapped test table and prove neither can be silently omitted.
The transient table is removed by the test; it is not an application migration.

Settings retains current snapshot JSON export and adds an explicit full-account
ZIP action, busy state, disabled repeat click and localized RU/UK error feedback.
React guidance influenced this small change: direct imports, an event-handler
request rather than an effect, and no new UI dependencies. No AA analytics UI exists.
The frontend receives a Blob to download; bounded-history-memory guarantees here
apply to the backend, not to the browser's completed-download Blob.

## 5. Account deletion

Authenticated `DELETE /api/v1/account` requires JSON
`{"confirmation":"DELETE_ACCOUNT"}`. Unknown fields (including `user_id`) are
rejected. Same-origin enforcement is retained.

One user-scoped DELETE commits through the existing database CASCADE boundary.
It removes the user, all sessions, snapshot, measurements, coverage and receipts,
including both directions of correction chains. Global metric definitions survive.
The response is empty 204, clears the cookie and prevents caching. All other
device/session tokens immediately become unusable.

T-15 dynamically checks every mapped account-owned table, not a handpicked subset.
A second account and its facts survive the deletion unchanged.

## 6. Per-fact deletion and references

Authenticated `DELETE /api/v1/aa/facts/{table}/{id}?mode=tombstone|hard` supports
only `aa_measurements` and `aa_source_coverage`. It cannot delete the account,
global metric definitions or receipts. Ownership comes solely from the session.
Unknown or other-account rows receive identical 404 `{code,message}` responses.
Unsafe same-origin enforcement applies; this bodyless endpoint has no JSON body
to validate. Invalid modes/UUIDs use inherited FastAPI request validation.

Tombstone retains row existence, semantic timestamps, provenance kind and
structural identifiers/chain links. It clears value/unit/scale/dimensions and
free-text provenance/reason/source-reference content. Coverage tombstones clear
source identifier/state/unit counts and no longer claim known completeness.
Repeated tombstoning preserves its first timestamp. Slice 0 idempotent replay
returns the erased tombstone rather than restoring its value.

Hard deletion locks the owned row, erases dependent source-reference payloads,
invokes the transactional redaction hook, deletes the row and inserts a metadata
receipt in one transaction. Failure rolls the operation back, including receipt
and provenance changes. Existing supersession FKs cannot become dangling.

The Plan's §21 referenced-and-blocked 409 is used for facts participating in a
correction/supersession chain (either direction). No chain surgery or deletion of
additional facts is silently authorized. These facts can be tombstoned, or removed
by account deletion. A blocked hard delete does not claim successful erasure and
does not create a receipt.

Slice 0 source-reference JSON is untyped. Owned measurement/coverage references
are scanned in bounded keyset batches; nested UUIDs, dictionary keys and
table-qualified/URI UUID references are recognized. The entire dependent
`source_ref`, `basis` and `method` are cleared conservatively. Other-account rows
are never modified. This is an O(account-provenance) foundation scan, not a future
indexed Review-context implementation or a redesign of the provenance grammar.

## 7. Future Review redaction interface

`redact_source_context(db, user_id, table_name, fact_id)` runs the registered
`SOURCE_REDACTORS` adapters in the erasure transaction before commit. Adapters must
erase source-derived content, use the supplied account scope, and never commit or
log/retain values. A failing adapter aborts erasure.

There are currently no adapters because Review/context tables do not exist.
Tests register a callable, prove actual hard-delete invocation and correct IDs,
and prove rollback when it fails. Slice 4 must supply its real context adapter;
this slice does not pretend that future Review data already exists.

## 8. Security and resulting recording gate

All new routes use existing session authentication. Cross-account object deletion
does not reveal existence. Account deletion requires explicit confirmation;
unsafe origin and applicable JSON content-type checks remain enforced. Export,
receipt and deletion logs contain IDs/counts/durations only, never fact payloads.
Decoded-export and structured-log residue assertions prove erased markers absent.

`LIFEOS_AA_WRITE_ENABLED` stays **default false**, unchanged from Slice 0.
Existing `Settings` also continues to refuse `aa_write_enabled=true` in production.
An explicitly enabled development/test environment can record facts. Export and
erasure do not depend on the recording gate and work when it is closed.
This slice completes infrastructure, not permission to enable product collection;
future production opt-in requires a separately reviewed gate-policy change.

## 9. Migration rollback verification (C8)

The test fixture first upgrades M1 → M2. The permanent M2 regression asserts zero
personal rows before downgrade, then verifies M2 → M1 → M2 on `lifeos_test` only.
It compares columns, CHECKs, FKs, PKs and indexes of `users`, `sessions` and
`user_snapshots` across the round-trip: identical.

Production policy remains C8: once personal AA history exists, roll back behavior
while retaining AA schema/data. Never run this destructive downgrade on populated
production history. The test is not an operational instruction to do that.

## 10. Final acceptance evidence

| Check | Actual result |
| --- | --- |
| Complete backend pytest | 143 passed, 4 warnings, 13.04 s |
| Ruff | PASS |
| Complete frontend Vitest | 45 passed, 9 files |
| TypeScript typecheck | PASS |
| ESLint | PASS |
| Vite production build | PASS; 82 modules; JS 399.24 kB / gzip 113.65 kB |
| Alembic heads | `20260909_0003` — single head |
| Alembic current | `20260909_0003` |
| Alembic metadata check | No new upgrade operations detected |
| `git diff --check` | PASS |
| Slice 0 regressions | NO — all original 114 tests still pass |
| Snapshot behavior regression | NO — original state suites pass; protected files unchanged |

Warnings are the existing Starlette/httpx deprecation and Alembic path-separator
deprecation (the latter repeats during the added round-trip), not new warning types.
Initial new-test fixture errors were corrected to existing Slice 0 constraints
(idempotency-key minimum length and closed-gate 403); no foundation contract was
weakened to make tests pass. Standalone Alembic diagnostics were rerun successfully
with complete test-only settings; no `.env` file was created.

The 29 additional backend tests cover T-14/T-15, all-history export/manifest,
406-row multi-batch export, registry metadata/DB mismatches, file/chunk cleanup,
auth secrets, isolation, metadata-only receipts, content/log residue,
nested/qualified source references, hook invocation/rollback, tombstone replay,
correction-chain blocking, both coverage modes, confirmation/origin/content type,
closed-gate privacy operations, all-session revocation and M2/pre-AA schema safety.
Eight additional frontend tests cover binary download transport/errors/abort and
Settings export rendering in both locales.

Post-suite database inspection: `users=0`, `sessions=0`, `user_snapshots=0`,
`aa_measurements=0`, `aa_source_coverage=0`, `aa_deletion_receipts=0`.
The only AA tables present are the four registry entries above.

Every Slice 0b acceptance item in the attached implementation contract is PASS.
Code/report are ready for the explicitly authorized commit, first branch push and
unmerged PR. The commit containing this report records its exact reviewed contents;
the subsequent final task response records the immutable commit/remote/PR identity.

## 11. Changed files

Modified:

- `apps/api/app/main.py`
- `apps/api/app/models/__init__.py`
- `apps/api/app/models/aa_source_coverage.py`
- `apps/api/app/models/mixins.py`
- `apps/api/tests/conftest.py`
- `apps/web/src/components/SettingsPage.jsx`
- `apps/web/src/context/LocaleContext.jsx`

Added:

- `apps/api/alembic/versions/20260909_0003_aa_deletion_receipts.py`
- `apps/api/app/models/aa_deletion_receipt.py`
- `apps/api/app/routes/aa_facts.py`
- `apps/api/app/routes/account.py`
- `apps/api/app/routes/export.py`
- `apps/api/app/services/aa_deletion.py`
- `apps/api/app/services/account.py`
- `apps/api/app/services/export.py`
- `apps/api/tests/test_aa_deletion.py`
- `apps/api/tests/test_aa_m2_migration.py`
- `apps/api/tests/test_account_deletion.py`
- `apps/api/tests/test_export.py`
- `apps/web/src/api/exportAccount.ts`
- `apps/web/src/test/export-account.test.ts`
- `apps/web/src/test/settings-export.test.jsx`
- this implementation report.

## 12. Plan interpretation, deviations and explicit non-scope

1. Config/gate was already delivered in Slice 0, so it is deliberately not edited.
2. M2 additionally evolves the minimum AA-only constraints needed for genuine
   NULL-value tombstones. This is permitted by §22; PRE-AA tables remain additive
   and untouched. Merely adding a receipt table would leave tombstoning impossible.
3. Streaming uses a disk-backed ZIP built before HTTP transfer. This trades
   time-to-first-byte and temporary disk space for bounded memory and a coherent,
   complete archive; it is not incremental ZIP generation during network delivery.
4. Referenced correction-chain facts use the Plan's explicit 409 path. Hard erasure
   is verified for accepted standalone deletions, not falsely reported for blocked
   requests. Account cascade supplies complete chain erasure.
5. Account cascade matrix lives in the privacy suite; the plan-named dedicated
   account-deletion suite additionally proves all-device session revocation.

No semantic comparison, expectation, forecast, baseline, target, preference,
observation, signal, Review, experiment, trade-off or retention tables/features.
No Finance analytics or UI primitives port. No snapshot architecture/schema bump,
event sourcing, CQRS, provenance/correction/idempotency/C5/C6 redesign, forensic
artifact/source changes, dependency upgrades, tag movement, main-branch edits,
force push, PR merge, deploy or Slice 1 work.

READY_FOR_SLICE_1=NO — Slice 0b still needs owner review/merge; this task ends at
the open, verified Slice 0b PR.
