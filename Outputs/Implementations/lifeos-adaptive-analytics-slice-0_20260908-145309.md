# LifeOS Adaptive Analytics — Slice 0 · Semantic History Foundation

**Mode:** `IMPLEMENTATION` · Slice 0 only
**Generated:** 2026-09-08 14:53:09
**Author:** Claude Opus 5 (Claude Code session `01UeEfoDq36GfaNtcNTQpLR5`)

---

## 1. Result

`SLICE_0_STATUS = PASS`

LifeOS can now record one semantic Measurement, retry that write safely, correct it without
erasing the original, read current truth, read what was believed at an earlier instant, prove
provenance, and hold explicit source-coverage evidence — all isolated per account, with
`user_snapshots` behaviourally unchanged.

No user-facing Adaptive Analytics surface exists, and AA writes are closed by default so no
personal history can accumulate before the export and erasure foundation (Slice 0b) lands.

---

## 2. Start state

| Item | Value |
| --- | --- |
| Worktree | `/Users/yurasachenko/LifeOS/LifeOS-adaptive-analytics-slice-0` |
| Branch | `feat/adaptive-analytics-slice-0` |
| Starting HEAD | `576b9500d0ccd8f81757dde27a1f597221003b71` |
| `origin/main` | `576b9500d0ccd8f81757dde27a1f597221003b71` |
| Working tree at start | clean |
| Design tag | `adaptive-analytics-design-accepted` → `d4960286ec94f35472600e59c0d533dc50a64351` |
| Alembic head at start | `20260721_0001` (single head) |

All required start-state values matched. No reset, rebase, merge or checkout was performed.

**Authoritative sources read, in priority order:**

1. `Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — the
   local merged copy including corrections C5–C8 (§34), read in full.
2. `Outputs/Discoveries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md`
3. `ui_kits/life-os-analytics/**` — read-only reference; unmodified.
4. Current repository code, re-inspected directly rather than assumed.

`Outputs/Implementations/lifeos-pre0-development-baseline_20260908-140841.md` supplied the PRE-0
reference figures.

---

## 3. Dependency reproduction

The worktree began with no `apps/api/.venv` and no `apps/web/node_modules`.

| Component | Version |
| --- | --- |
| Python | 3.11.15 (`python3.11 -m venv .venv`) |
| Node | v22.20.0 |
| npm | 11.11.0 |
| PostgreSQL | 18.3 (Homebrew) |

**Backend:** `pip install --require-hashes -r requirements-dev.lock` — installed from the committed
hashed lockfile, no unlocked substitute, exit 0.

**Frontend:** `npm ci` from `package-lock.json`, exit 0. No package added, updated or removed; no
`npm audit fix`; the lockfile is unchanged. The known npm-audit advisories are outside this slice.

**Test database:** the pre-existing local disposable `lifeos_test` was inspected before use (four
tables: `alembic_version`, `sessions`, `user_snapshots`, `users`) and used unchanged. `lifeos_dev`
was never touched, and no remote or shared database was contacted. The connection string was
supplied through `LIFEOS_TEST_DATABASE_URL` at invocation time only; **no credentials were written
to any repository file and none appear in this report.**

### 3.1 Pre-change baseline in this worktree

Re-run after dependency setup and **before** any implementation:

| Check | Result | PRE-0 reference | Match |
| --- | --- | --- | --- |
| `python -m pytest` | 11 passed / 0 failed / 0 skipped | 11 passed | ✔ |
| `ruff check .` | All checks passed! | PASS | ✔ |
| `alembic heads` | `20260721_0001 (head)` — one head | one head | ✔ |
| `npm test` | 28 passed (6 files) | 28 passed | ✔ |
| `npm run typecheck` | PASS | PASS | ✔ |
| `npm run lint` | PASS | PASS | ✔ |
| `npm run build` | PASS · `index-D67jDXey.js` 397.13 kB | PASS | ✔ |

Baseline green. Implementation proceeded.

---

## 4. Implemented architecture

The frozen split is preserved exactly. `user_snapshots` remains the mutable current-state
document with CAS on `revision`; the new `aa_*` tables are append-oriented semantic history with
provenance and supersession. Neither writes the other's data, and no snapshot code path was
changed to accommodate AA.

### 4.1 Analytics contracts — `apps/api/app/analytics/`

| Module | Contract |
| --- | --- |
| `enums.py` | `ValueType`, `SourceKind`, `FactStatus`, `SupersedeKind`, `CoverageState`, `DayCoverage`, `DerivedAvailability`, `ActualSource`, `Aggregation`, `DenominatorBasis`. Persisted as `TEXT` + `CHECK`, never native PostgreSQL enums, so a future value can be added inside an ordinary transactional migration. `check_in()` renders the SQL membership predicate from the Python members. |
| `subjects.py` | The generic typed triple `(subject_domain, subject_type, subject_id)` with a registry of legal `(domain, type)` pairs validated at the service boundary, not by the database. No foreign key is invented into snapshot JSONB. |
| `values.py` | Per-`value_type` required/forbidden columns, ISO-4217 money codes, canonical `minute` durations, scale-bounds validity. `value_check_sql()` renders the identical rule as a database CHECK. |
| `delta.py` | Delta legality: same type, matching units, matching scale bounds; `date − date → duration(minute)`; categorical pairs have no delta; an absent operand returns a **derived** `DeltaUnknown` and fabricates nothing. |
| `asof.py` | The single as-of predicate — `recorded_at <= T AND (superseded_at IS NULL OR superseded_at > T) AND status <> 'tombstoned'`, ordered `recorded_at DESC, id DESC` for deterministic ties — reused by every concept. |
| `coverage.py` | Per-day resolution from coverage claims into `observed / partial / missing / unknown_coverage / future`, and a `CoverageReport` whose constructor refuses to exist unless the buckets exhaust the denominator. Pure derivation; performs no IO. |

### 4.2 Persistence

`apps/api/app/models/mixins.py` holds the shared column template — identity and account ownership
with cascade, the subject triple with its generated `subject_key`, the discriminated value,
inline provenance, supersession, and idempotency — plus `aa_integrity_constraints(table)`, which
gives every account-owned AA table the identical integrity rules by construction.

Three tables, described in §6.

### 4.3 API

| Method / path | Purpose |
| --- | --- |
| `POST /api/v1/aa/measurements` | Record one Measurement. 201 created / 200 on replay. |
| `POST /api/v1/aa/measurements/{id}/correct` | Correct one Measurement. 201 created / 200 on replay / 409 `correction_conflict` / 404. |
| `GET /api/v1/aa/metrics/{metric_key}/history` | Layered history over a mandatory range, keyset-paginated on `(occurred_at, id)`, with optional `as_of` reconstruction and an optional coverage report. |
| `GET /api/v1/aa/facts/{table}/{id}/provenance` | The four-row provenance grammar plus correction status. |

Every route reuses the existing `get_current_user` session dependency. Every unsafe route reuses
`enforce_same_origin` and `require_json_content_type`, and returns the existing `{code, message}`
envelope. **No endpoint accepts a user id** — request models forbid extra fields, so a
body-supplied `user_id` is a 422, mirroring `test_state_isolation.py`. There is no unbounded
all-history download: omitting the range returns 400 `range_required`.

### 4.4 Correction

A correction never updates a value in place. The replacement is inserted with
`supersedes_id = <target>`, then a **predicate CAS** claims the target only while it is unclaimed:

```sql
UPDATE aa_measurements
   SET status = 'superseded', superseded_at = now(), supersede_kind = 'CORRECTION',
       supersede_reason = :reason, superseded_by_id = :new_id
 WHERE id = :target AND user_id = :u AND superseded_at IS NULL AND status = 'active';
```

Zero rows claimed means someone corrected it first, and the whole transaction is rolled back with
409 `correction_conflict`. `UNIQUE (supersedes_id)` closes the same race from the other side, so a
row can never acquire two successors. A four-way concurrent correction race is exercised in
`test_aa_correction.py`: exactly one 201, the rest 409, one successor, one active row.

### 4.5 Idempotency

`UNIQUE (user_id, idempotency_key)` plus lookup → insert → recover-from-conflict. A replay returns
the fact the earlier attempt created, with 200 rather than 201, and never a second row — including
a replay that carries a different value, which returns what was stored rather than overwriting it.
Keys are scoped per account, so two accounts may legitimately mint the same key. A correction
replay returns the correction already made instead of reporting a conflict with itself.

### 4.6 As-of

`GET …/history?as_of=<instant>` reconstructs what was believed then. Before a correction it
returns the original value; after it, the corrected one; with no `as_of` it returns current truth.
Before the fact existed it returns an empty layer — and writes nothing.

### 4.7 Coverage evidence (C6)

`aa_source_coverage` stores what a source declares it covered over a local window, as an ordinary
fact with provenance, supersession and idempotency. A wider re-import supersedes the narrower
earlier claim rather than overwriting it, so the earlier belief stays recoverable.

`aa_coverage_claims.py` records, supersedes and reads claims; `analytics/coverage.py` turns them
into a report. Measurements are consulted only for the report's colouring fields
(`corrected_count`, `estimated_count`, `has_legacy_imports`, `freshest_recorded_at`) — **never** to
establish coverage.

### 4.8 Provenance

Stored inline as `source_kind` (источник), `basis` (основание), `recorded_at` (когда), `method`
(как), plus machine-readable `source_ref`. Only the accepted enum values exist: no `HYPOTHESIS`, no
`INFERRED`, nothing added for symmetry. `recorded_at` is `NOT NULL` and always means *when LifeOS
learned the fact*; `original_recorded_at_known = false` is permitted only for `IMPORTED` records
and is enforced by a CHECK. `recorded_at` is not accepted from a caller.

### 4.9 Write gate

`LIFEOS_AA_WRITE_ENABLED` (`Settings.aa_write_enabled`) defaults to **false**, and
`app/security/aa_gate.py` refuses both write endpoints with 403 `aa_writes_disabled` while it is
closed. `Settings` additionally **refuses to be constructed at all** when
`environment = production` and the flag is true, so the 0 → 0b privacy sequencing invariant cannot
be defeated by configuration. Reads remain available — the gate stops history accumulating, not
the API existing.

### 4.10 C5 / C6 compliance — stated explicitly

**C5 · missing = no Measurement row.**
`ValueType` has six members and no `unknown`. There is no representation, in Python or in SQL, for
a Measurement whose value columns are empty — `test_aa_schema_guards.py` proves a direct SQL insert
of one is rejected. A window with no observations returns an empty layer and a coverage report
saying so; asking the question repeatedly writes nothing. `0` is a real observed value and is
never interchangeable with absence. Derived unknown / no-data is a response state
(`DeltaUnknown`, `DerivedAvailability.NO_DATA`) that is never persisted.

**C6 · coverage ≠ transaction presence.**
A day is `observed` only when an active `aa_source_coverage` claim states `complete` **and**
`completeness_known`. A day carrying a measurement but no claim is `unknown_coverage`. A day with a
`complete` claim and zero measurements **is** `observed`. Absence of evidence is never promoted to
`observed` and never demoted to `missing` — `missing` requires a source affirming that nothing
happened. A window with no claim reports `reason = "не установлена"` rather than a bare fraction.

---

## 5. Migration M1

| Property | Value |
| --- | --- |
| File | `apps/api/alembic/versions/20260909_0002_aa_history_foundation.py` |
| `revision` | `20260909_0002` |
| `down_revision` | `20260721_0001` |
| Heads after | `20260909_0002` — **one head** |
| Verified | `upgrade` → `downgrade -1` → `upgrade` round-trip clean against `lifeos_test` |

**Tables created:** `aa_metric_definitions`, `aa_measurements`, `aa_source_coverage`.

**Seed data:** metric catalogue v1 — `finance.transaction_amount`, `finance.monthly_spend`
(`actual_source = derived`, `aggregation = sum`), `project.completion_date`.

**Indexes:** `ix_aa_measurements_user_subject_occurred_at`,
`ix_aa_measurements_user_metric_occurred_at`, `ix_aa_measurements_user_recorded_at`,
partial `ix_aa_measurements_active_user_subject_occurred_at WHERE status = 'active'`,
`ix_aa_source_coverage_user_recorded_at`,
partial `ix_aa_source_coverage_active_user_subject_window WHERE status = 'active'`.

**Key constraints (both fact tables):** `UNIQUE (user_id, idempotency_key)`;
`UNIQUE (supersedes_id)`; `status IN (active, superseded, tombstoned)`;
`status <> 'superseded' OR superseded_by_id IS NOT NULL`;
`status <> 'superseded' OR superseded_at IS NOT NULL`;
`status <> 'active' OR (superseded_at IS NULL AND superseded_by_id IS NULL)`;
`status <> 'tombstoned' OR tombstoned_at IS NOT NULL`; `supersedes_id <> id`;
`superseded_by_id <> id`; `original_recorded_at_known OR source_kind = 'IMPORTED'`;
`source_kind` and `supersede_kind` membership; `FK users(id) ON DELETE CASCADE`.

**`aa_measurements` additionally:** the per-`value_type` value-shape CHECK, `value_type`
membership, `occurred_tz <> ''`, `FK aa_metric_definitions(metric_key)`.

**`aa_source_coverage` additionally:** `coverage_state` membership;
`window_end_date >= window_start_date`; `timezone <> ''`; `source_id <> ''`;
`NOT completeness_known OR coverage_state <> 'unknown'`;
`(coverage_state = 'partial') = (observed_units IS NOT NULL AND expected_units IS NOT NULL)`;
`observed_units IS NULL OR (observed_units >= 0 AND observed_units <= expected_units)`.

### 5.1 Migration safety

No PRE-AA table was modified. `users`, `sessions` and `user_snapshots` are untouched — a schema
guard test asserts `user_snapshots` still has exactly its six original columns.
`user_snapshots.schema_version` remains `2`. The existing revision `20260721_0001` is unmodified.

The migration docstring records the C8 downgrade policy: `DROP TABLE` is permitted only while no
personal AA history exists; once it does, rollback is behavioural — disable the flag, keep the
schema and the data.

---

## 6. Data model

### `aa_metric_definitions` — reference data, not account-owned

`metric_key` (PK), `domain`, `subject_type`, `subject_id_form`, `value_type`, `unit_code`,
`aggregation`, `actual_source`, `coverage_basis`, `derivation`, `description`, `created_at`,
`updated_at`. There is deliberately **no desirability column**: whether a change is good or bad
belongs to Target, Preference and Decision.

### `aa_measurements` — timestamped objective observations

Shared template (identity, `user_id`, subject triple + generated `subject_key`, discriminated
value, immutable `dimensions`, provenance, supersession, idempotency) plus `metric_key`,
`occurred_at` and `occurred_tz`. Both temporal columns are `NOT NULL` here: an observation that
happened has a time, and coverage counts local days so the zone must travel with it. There is **no
availability column** — an objective observation either happened or did not.

### `aa_source_coverage` — explicit source-completeness evidence

Shared template plus `source_id`, optional `metric_key`, `window_start_date`, `window_end_date`,
`timezone`, `coverage_state`, `completeness_known`, `observed_units`, `expected_units`.

---

## 7. Tests

### 7.1 New backend tests — 103

| File | Tests | Covers |
| --- | --- | --- |
| `test_aa_values.py` | 20 | value legality; **T-05** (no `unknown` member, zero ≠ missing, no empty value) |
| `test_aa_delta.py` | 7 | delta legality, no implicit conversion, derived unknown |
| `test_aa_measurements.py` | 12 | append, read back, invalid shapes, metric mismatch, unregistered subject, body-supplied `user_id` rejected, auth on every route, mandatory range, keyset paging, provenance |
| `test_aa_idempotency.py` | 5 | **T-04** — replay, replay with a different value, per-account key scoping, 4-way concurrent replay, no duplicate in history |
| `test_aa_correction.py` | 7 | **T-03** — original preserved, counted once, discoverable, second correction 409, correction replay, 4-way race yields one successor, cross-account 404 |
| `test_aa_asof.py` | 4 | before/after correction, before existence, deterministic ties, tombstone exclusion |
| `test_aa_coverage.py` | 12 | **T-19** — zero-transaction day observed, transaction-bearing day unknown, absent evidence never complete, affirmed `none`, partial fractions, supersession, isolation, reads write nothing (**T-05**), bucket invariant |
| `test_aa_isolation.py` | 3 | cross-account read/correct/existence, cascade erasure, origin and content-type guards |
| `test_aa_schema_guards.py` | 29 | TRUNCATE-list parity, enum/CHECK parity, no `unknown` in the DB constraint, illegal value shapes rejected at the DB, supersession integrity, idempotency uniqueness, one-successor rule, coverage constraints, `user_snapshots` columns unchanged |
| `test_aa_write_gate.py` | 4 | closed by default, production refuses to open it, writes 403 and persist nothing, reads still work |

`tests/aa_helpers.py` holds shared request builders.

### 7.2 Permanent regression tests assigned to Slice 0

| ID | Home | Status |
| --- | --- | --- |
| **T-03** | `test_aa_correction.py` | implemented |
| **T-04** | `test_aa_idempotency.py` | implemented |
| **T-05** (corrected meaning) | `test_aa_values.py`, `test_aa_coverage.py`, `test_aa_schema_guards.py` | implemented |
| **T-19** (C6) | `test_aa_coverage.py` | implemented |

None was weakened.

### 7.3 Results

| Check | Result |
| --- | --- |
| `python -m pytest` | **114 passed**, 0 failed, 0 skipped, 10.78s (11 original + 103 new) |
| `ruff check .` | All checks passed! |
| `alembic heads` | `20260909_0002 (head)` — one head |
| `alembic current` | `20260909_0002 (head)` |
| `npm test` | **37 passed** (7 files), 0.60s (28 original + 9 new) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — `index-D67jDXey.js` 397.13 kB, byte-identical to baseline |
| `git diff --check` | clean |

The build hash and size are unchanged from the pre-change baseline, confirming that no AA code
entered the application bundle: the new frontend modules are infrastructure that nothing imports
yet.

---

## 8. Snapshot non-regression

Not one protected file was modified:

`app/models/user_snapshot.py` · `app/services/state.py` · `app/routes/state.py` ·
`app/schemas/state.py` · `app/middleware/body_limit.py` ·
`apps/web/src/repositories/stateSyncCoordinator.ts` · `serverStateRepository.ts` ·
`stateRepository.ts` · `alembic/versions/20260721_0001_*.py`

`test_state_isolation.py` and `test_state_revision_conflict.py` pass unchanged, so
`PUT /api/v1/state` CAS behaviour is unchanged. `user_snapshots.schema_version` stays `2`, and a
schema guard asserts the table's column set is exactly what it was.

`SNAPSHOT_REGRESSION = PASS`

---

## 9. Files changed

**Modified (4):**

| Path | Change |
| --- | --- |
| `apps/api/app/config.py` | `aa_write_enabled` flag + production refusal |
| `apps/api/app/main.py` | register the two AA routers |
| `apps/api/app/models/__init__.py` | export the three new models (Alembic autogenerate depends on it) |
| `apps/api/tests/conftest.py` | `TRUNCATED_TABLES` / `SEEDED_TABLES` + AA tables in cleanup; tests open the write gate explicitly |

**New — backend (21):**
`app/analytics/{__init__,enums,subjects,values,delta,asof,coverage}.py` ·
`app/models/{mixins,aa_metric_definition,aa_measurement,aa_source_coverage}.py` ·
`app/schemas/{aa_common,aa_measurement}.py` ·
`app/services/{aa_facts,aa_coverage_claims}.py` ·
`app/routes/{aa_measurements,aa_history}.py` · `app/security/aa_gate.py` ·
`alembic/versions/20260909_0002_aa_history_foundation.py` ·
`tests/aa_helpers.py`

**New — backend tests (10):** `tests/test_aa_{values,delta,measurements,idempotency,correction,asof,coverage,isolation,schema_guards,write_gate}.py`

**New — frontend (3):** `src/api/analytics.ts` · `src/repositories/analyticsRepository.ts` ·
`src/test/analytics-repository.test.ts`

Nothing under `ui_kits/**`, `preview/**`, `.design-sync/**` or the existing Outputs reports was
touched. No `.DS_Store`, `.env`, credential, `.venv`, `node_modules`, `dist` or database artefact
is staged.

---

## 10. Plan deviations

Three, each conservative and each documented here rather than silently taken.

**D-1 · The write gate is created in Slice 0, not Slice 0b.**
The plan lists `app/config.py` (the `aa_write_enabled` flag) under Slice 0b's files, while its own
binding gate rule (§24.2) requires the flag to protect the interval *after* Slice 0. The task brief
(§16) directs that this ordering inconsistency be resolved conservatively. The gate therefore
exists here, before any write endpoint could be exposed, and additionally refuses to be enabled in
production at all. This is not a scope expansion; it is what the already-accepted 0 → 0b privacy
sequencing invariant requires.

**D-2 · `CoverageReport.policy_known` is deferred to Slice 1.**
The plan's `CoverageReport` (§20.3) includes `policy_known`, a C7 concept resolved from
`aa_metric_policy_versions`. Those tables belong to M3 / Slice 1, and the brief (§7) forbids
pulling C7 into Slice 0. The field arrives with the tables that give it an answer; adding it later
is additive.

**D-3 · The metric catalogue is seeded in full by M1.**
§18 annotates each metric with the slice whose *domain surface* uses it (2, 2, P/5), while the
migration graph places "seed metric rows (data migration)" in M1. `aa_measurements.metric_key` is a
foreign key into the catalogue, so Slice 0 cannot record anything without at least one definition.
All three catalogue-v1 rows are seeded by M1 as reference data. No domain surface is implemented.

Two smaller judgement calls, both stricter than the plan's text:

- The value CHECK **forbids every column a `value_type` does not require**, not only the columns
  the plan's table lists as forbidden. This makes "no illegal multiple value columns" structural.
- `aa_measurements.occurred_at` and `occurred_tz` are `NOT NULL`, tightening the shared template's
  nullable defaults for the one concept whose meaning requires both.

The migration filename follows the plan verbatim (`20260909_0002_aa_history_foundation.py`) even
though it was authored on 2026-09-08, so the artefact matches the plan's manifest.

---

## 11. Explicitly not implemented

No Slice 0b work of any kind: no export, no account deletion, no deletion receipts, no
tombstone/hard-delete API, no `aa_deletion_receipts` table.

No Expectation, Forecast, Target, Baseline, Preference or Observation tables. No C7 policy or
membership-override tables. No Signal, Review, Factor, Decision, Experiment, Importance,
Cross-reference or Retention tables. No M2.

No signal rules, no desirability derivation, no Finance legacy import, no Finance UI, no category
policy UI, no AA UI, no route, no `AnalyticsContext`, no IndexedDB queue, no design-primitive port,
no `analytics.css`. No Home signal section.

No AI, no telemetry service, no health-domain expansion. No production dependency was added, and
no frontend dependency was added at all.

---

## 12. Acceptance gate

| # | Requirement | Result |
| --- | --- | --- |
| 1 | One Measurement can be recorded and read | PASS |
| 2 | Missing does not create a synthetic Measurement | PASS |
| 3 | Zero remains distinct from missing | PASS |
| 4 | Same idempotency key cannot duplicate a fact | PASS |
| 5 | Correction creates a new version and preserves the original | PASS |
| 6 | Active/current result counts the corrected value once | PASS |
| 7 | As-of before correction returns the original | PASS |
| 8 | As-of after correction returns the corrected value | PASS |
| 9 | Coverage evidence is independent from fact presence | PASS |
| 10 | Account B cannot read or correct Account A's facts | PASS |
| 11 | Cross-account response leaks no existence (404, not 403) | PASS |
| 12 | Provenance is stored and read per contract | PASS |
| 13 | M1 is the single Alembic head | PASS |
| 14 | Test cleanup includes all AA M1 tables | PASS |
| 15 | Existing snapshot tests remain green | PASS |
| 16 | `PUT /api/v1/state` behaviour unchanged | PASS |
| 17 | No user-facing AA history collection before 0b | PASS |
| 18 | No expectation/forecast/target/baseline implementation | PASS |
| 19 | No Signal/Review/Experiment implementation | PASS |
| 20 | No AA UI or offline queue | PASS |
| 21 | Full backend and frontend baseline green | PASS |

---

## 13. Status block

```
SLICE_0_STATUS=PASS
M1=20260909_0002_aa_history_foundation (down_revision 20260721_0001)
AA_TABLES=aa_metric_definitions, aa_measurements, aa_source_coverage
WRITE_GATE=LIFEOS_AA_WRITE_ENABLED, default false, production refuses true
PYTEST=114 passed / 0 failed / 0 skipped (10.78s)
RUFF=PASS
ALEMBIC_HEAD=20260909_0002 (single head)
VITEST=37 passed / 7 files
TYPECHECK=PASS
LINT=PASS
BUILD=PASS
SNAPSHOT_REGRESSION=PASS
C5_MISSING_MODEL=PASS
C6_COVERAGE_MODEL=PASS
ACCOUNT_ISOLATION=PASS
IDEMPOTENCY=PASS
CORRECTION=PASS
AS_OF=PASS
READY_FOR_SLICE_0B=YES
```

Slice 0b may begin after owner acceptance. Until it lands, AA writes must remain disabled for
production use.
