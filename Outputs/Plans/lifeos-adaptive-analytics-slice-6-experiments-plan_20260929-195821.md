# LifeOS · Adaptive Analytics · Slice 6 · First-Class Experiments (I) — Implementation Plan (candidate)

Status: **EXECUTION_READY_CANDIDATE**. Drafted read-only on 2026-09-29 against pinned `main`
`414df142700653d616016ff644bff3d9c0007540`.

Companion: `lifeos-adaptive-analytics-slice-6-experiments-reconciled-discovery.md`. Its
§4–§14 are this Plan's evidence.

The serial session copies both files into `Outputs/Discoveries/` and `Outputs/Plans/` (with
timestamped names) after §0. Nothing here has been run.

---

## 0. Serial-session gate (must pass before any code)

1. `pwd` = the canonical checkout.
2. The working tree is clean.
3. `git fetch`. `origin/main` either equals `414df14` or has `414df14` as an ancestor.
4. If `main` moved, diff `414df14..origin/main` over:
   - `apps/api/{alembic,app/models,app/services/aa_deletion.py,app/services/export.py,app/analytics/enums.py,tests/conftest.py}`;
   - `apps/web/src/{repositories,context/AnalyticsContext.jsx,app}`.

   Any change there → re-reconcile the affected sections before continuing.
5. `alembic heads` = `20260928_0006` (single).
6. Mapped `aa_*` = 19. `EXPORT_TABLES` = 19. Four rule modules. `schema_version` `Literal[2]`.
7. The coordinator's head-blocking loop is unchanged.
8. The recovery stash `51184836…` is present, and the tag `adaptive-analytics-design-accepted`
   → `d4960286…`.
9. Full baseline is green on `lifeos_test`:
   - pytest (expected 420 at `414df14`), ruff, alembic heads/current;
   - Vitest (expected 316), typecheck, lint, build.
10. Branch: `feat/adaptive-analytics-slice-6-experiments` from `main`. No worktree.

---

## 1. Scope

**In scope.**
- M6: three new tables, plus ALTERs of `aa_decisions` and `aa_review_factors`.
- The Experiment service, API, detail read, list with lifecycle filter, and the D4 ABANDONED
  delta.
- Adherence, outcome/context observations, baseline and conditions (the last two through
  existing tables).
- The Experiment decision and factors.
- Registries.
- The frontend Experiment route (list · create · detail), RU/UK copy, and tests.

**Not in scope.**
- System Review / trade-off (Slice 7). Only the list filter and the
  `PENDING_LIFECYCLES` constant are delivered.
- Retention (Slice 8).
- Server-side outcome aggregation.
- Catalogued experiment metrics (sleep, fatigue, energy).
- Editing the hypothesis, window or outcome definition.
- Per-experiment deletion.
- As-of experiment reads.
- Correcting an outcome/context observation (withdraw via the existing generic tombstone/hard
  delete).
- A Home signal.
- Recommendations, scores and causal inference.
- Snapshot changes, deployment, and dependency changes.

---

## 2. Architecture placement (per `module-boundaries.md`)

| Concern | Path |
| --- | --- |
| Models (Phase B §24.9 names) | `app/models/aa_experiment.py`, `aa_experiment_adherence.py`, `aa_experiment_observation.py` (NEW); `models/__init__.py` (+3 exports) |
| Existing models widened | `app/models/aa_decision.py`, `app/models/aa_review.py` (`AAReviewFactor` only) |
| Enums | `app/analytics/enums.py` (flat vocabulary; do not split) |
| Service facade | `app/services/aa_experiments.py`. Callers (routes, tests) import only this |
| Service internals | `app/services/experiments/` (see the table below) |
| Route / schemas | `app/routes/aa_experiments.py`, `app/schemas/aa_experiments.py` (NEW); `main.py` (+1 `include_router`) |
| Error→status map | `routes/aa_measurements.py::_ERROR_STATUS` (+codes, §7.3). Every AA route reuses `_error_response` |
| Registries | `services/export.py::EXPORT_TABLES` (+3); `services/aa_deletion.py::FACT_TABLES` (+`aa_experiment_observations` only); `tests/conftest.py::TRUNCATED_TABLES` (+3) |
| Boundary map | `Outputs/architecture/module-boundaries.md` (+ Experiment section, + `api/analytics/experiments.ts` row, + page split row) |

The `app/services/experiments/` internals:

| Module | Contents |
| --- | --- |
| `errors.py` | error classes |
| `contracts.py` | `LEGAL_EDGES`, `PENDING_LIFECYCLES`, `EVIDENCE_LIFECYCLES`, `DECISION_LIFECYCLES`, limits, `TIME_SKEW` |
| `days.py` | **leaf**: IANA local-day math and adherence classification |
| `lifecycle.py` | create + transition |
| `evidence.py` | adherence, observations, baseline, conditions |
| `decisions.py` | decision + factors |
| `read_model.py` | detail + list payloads |

Internal import direction: `errors`, `days` → `contracts` → `lifecycle`/`evidence`/`decisions`
→ `read_model`. No module imports the facade.

---

## 3. Enums (`app/analytics/enums.py`)

```python
class ExperimentLifecycle(StrEnum):
    DRAFT = "DRAFT"; RUNNING = "RUNNING"
    COMPLETED_AWAITING_REVIEW = "COMPLETED_AWAITING_REVIEW"
    REVIEWED = "REVIEWED"; ABANDONED = "ABANDONED"

class AdherenceState(StrEnum):          # stored
    KEPT = "kept"; MISSED = "missed"; UNKNOWN = "unknown"

class AdherenceDay(StrEnum):            # derived, never persisted
    KEPT = "kept"; MISSED = "missed"; UNKNOWN = "unknown"
    NOT_RECORDED = "not_recorded"; FUTURE = "future"; NOT_RUN_AFTER_STOP = "not_run_after_stop"

class ExperimentObservationRole(StrEnum):
    OUTCOME = "outcome"; CONTEXT = "context"

class ExperimentOutcomeType(StrEnum):   # comparable shapes only (compute_delta)
    MONEY = "money"; DURATION = "duration"; COUNT = "count"; SCALE = "scale"

class ExperimentDecisionChoice(StrEnum):
    KEEP = "keep"; MODIFY = "modify"; LONGER = "longer"; REJECT = "reject"; INCONCLUSIVE = "inconclusive"

class ExperimentResultState(StrEnum):   # derived
    NOT_APPLICABLE = "not_applicable"; TOO_EARLY = "too_early"; NO_DATA = "no_data"; KNOWN = "known"
```

- `DecisionScope` gains `EXPERIMENT = "experiment"`. Its docstring becomes "What a decision
  or factor belongs to".
- `ReviewDecisionChoice` is **unchanged**.
- Docstrings restate the invariants:
  - no member means "no decision" (that is NULL);
  - `FUTURE`/`NOT_RECORDED`/`NOT_RUN_AFTER_STOP` are never stored;
  - `ABANDONED` is terminal and orthogonal to outcome.

---

## 4. Migration M6

The file is `apps/api/alembic/versions/<YYYYMMDD>_0007_aa_experiments.py`:
- `revision = "<YYYYMMDD>_0007"`, using the implementation date (e.g. `20260929_0007`);
- **`down_revision = "20260928_0006"`**.

It follows the M5 convention: **frozen SQL strings** (copy the M5 `VALUE_SHAPE`/`EMPTY_VALUE`
text verbatim; do not import from `app`), and a docstring with the C8 policy.

### 4.1 `aa_experiments` (state entity, not a fact; `aa_signal_episodes` precedent)

```
id                      uuid PK                       -- client-minted UUID v4; the service always supplies it
user_id                 uuid NOT NULL FK users(id) ON DELETE CASCADE
created_at              timestamptz NOT NULL DEFAULT now()        -- storage only
title                   text NOT NULL
hypothesis              text NOT NULL                              -- immutable claim
hypothesis_recorded_at  timestamptz NOT NULL                       -- client instant the claim was stated
intervention            text NOT NULL
window_start            date NOT NULL
window_end              date NOT NULL
timezone                text NOT NULL                              -- IANA; validated in schema/service
outcome_label           text NOT NULL
outcome_value_type      text NOT NULL
outcome_unit_code       text NULL
outcome_scale_min       numeric(20,6) NULL
outcome_scale_max       numeric(20,6) NULL
lifecycle               text NOT NULL DEFAULT 'DRAFT'
started_at   timestamptz NULL,  start_key    text NULL
completed_at timestamptz NULL,  complete_key text NULL
reviewed_at  timestamptz NULL,  review_key   text NULL
abandoned_at timestamptz NULL,  abandon_key  text NULL,  abandoned_from text NULL
idempotency_key         text NOT NULL                              -- create key
```

CHECK constraints (exact names):

| Name | Expression |
| --- | --- |
| `ck_aa_experiments_title` | `btrim(title) <> '' AND char_length(title) <= 200` |
| `ck_aa_experiments_hypothesis` | `btrim(hypothesis) <> '' AND char_length(hypothesis) <= 1000` |
| `ck_aa_experiments_intervention` | `btrim(intervention) <> '' AND char_length(intervention) <= 1000` |
| `ck_aa_experiments_window_order` | `window_end >= window_start` |
| `ck_aa_experiments_window_length` | `window_end - window_start <= 365` |
| `ck_aa_experiments_timezone` | `timezone <> ''` |
| `ck_aa_experiments_outcome_label` | `btrim(outcome_label) <> '' AND char_length(outcome_label) <= 200` |
| `ck_aa_experiments_outcome_value_type` | `outcome_value_type IN ('money','duration','count','scale')` |
| `ck_aa_experiments_outcome_shape` | `CASE outcome_value_type WHEN 'money' THEN outcome_unit_code ~ '^[A-Z]{3}$' AND outcome_scale_min IS NULL AND outcome_scale_max IS NULL WHEN 'duration' THEN outcome_unit_code = 'minute' AND outcome_scale_min IS NULL AND outcome_scale_max IS NULL WHEN 'count' THEN outcome_unit_code IS NULL AND outcome_scale_min IS NULL AND outcome_scale_max IS NULL WHEN 'scale' THEN outcome_unit_code IS NULL AND outcome_scale_min IS NOT NULL AND outcome_scale_max IS NOT NULL AND outcome_scale_min < outcome_scale_max ELSE false END` |
| `ck_aa_experiments_lifecycle` | `lifecycle IN ('DRAFT','RUNNING','COMPLETED_AWAITING_REVIEW','REVIEWED','ABANDONED')` |
| `ck_aa_experiments_lifecycle_shape` | `CASE lifecycle WHEN 'DRAFT' THEN started_at IS NULL AND completed_at IS NULL AND reviewed_at IS NULL AND abandoned_at IS NULL WHEN 'RUNNING' THEN started_at IS NOT NULL AND completed_at IS NULL AND reviewed_at IS NULL AND abandoned_at IS NULL WHEN 'COMPLETED_AWAITING_REVIEW' THEN started_at IS NOT NULL AND completed_at IS NOT NULL AND reviewed_at IS NULL AND abandoned_at IS NULL WHEN 'REVIEWED' THEN started_at IS NOT NULL AND completed_at IS NOT NULL AND reviewed_at IS NOT NULL AND abandoned_at IS NULL WHEN 'ABANDONED' THEN abandoned_at IS NOT NULL AND reviewed_at IS NULL ELSE false END` |
| `ck_aa_experiments_abandoned_from` | `abandoned_from IS NULL OR abandoned_from IN ('DRAFT','RUNNING','COMPLETED_AWAITING_REVIEW')` |
| `ck_aa_experiments_abandon_shape` | `abandoned_from IS NULL OR (abandoned_from = 'DRAFT' AND started_at IS NULL AND completed_at IS NULL) OR (abandoned_from = 'RUNNING' AND started_at IS NOT NULL AND completed_at IS NULL) OR (abandoned_from = 'COMPLETED_AWAITING_REVIEW' AND started_at IS NOT NULL AND completed_at IS NOT NULL)` |
| `ck_aa_experiments_start_pair` | `(started_at IS NULL) = (start_key IS NULL)` |
| `ck_aa_experiments_complete_pair` | `(completed_at IS NULL) = (complete_key IS NULL)` |
| `ck_aa_experiments_review_pair` | `(reviewed_at IS NULL) = (review_key IS NULL)` |
| `ck_aa_experiments_abandon_pair` | `(abandoned_at IS NULL) = (abandon_key IS NULL) AND (abandoned_at IS NULL) = (abandoned_from IS NULL)` |
| `ck_aa_experiments_instant_order` | `(started_at IS NULL OR started_at >= hypothesis_recorded_at) AND (completed_at IS NULL OR completed_at >= started_at) AND (reviewed_at IS NULL OR reviewed_at >= completed_at) AND (abandoned_at IS NULL OR abandoned_at >= COALESCE(completed_at, started_at, hypothesis_recorded_at))` |

Uniques and indexes:
- `uq_aa_experiments_idempotency_key (user_id, idempotency_key)`;
- `uq_aa_experiments_start_key (user_id, start_key)`;
- `uq_aa_experiments_complete_key (user_id, complete_key)`;
- `uq_aa_experiments_review_key (user_id, review_key)`;
- `uq_aa_experiments_abandon_key (user_id, abandon_key)` (NULLs distinct);
- `ix_aa_experiments_user_lifecycle (user_id, lifecycle)`;
- `ix_aa_experiments_user_created (user_id, created_at)`.

The CHECKs make every illegal *path shape* unrepresentable, for example "REVIEWED without
completion", "ABANDONED and REVIEWED", or "ABANDONED from RUNNING without a start". They cannot
stop an UPDATE that rewrites one legal shape into another. The service CAS does that (§6.2).
**No trigger.**

### 4.2 `aa_experiment_adherence`

The columns come from `AAOwnedMixin`, `AAProvenanceMixin`, `AASupersessionMixin` and
`AAIdempotencyMixin`. The table has **no value or subject columns**. Additional columns:

```
experiment_id  uuid NOT NULL FK aa_experiments(id) ON DELETE CASCADE
day            date NOT NULL                 -- local calendar day in the experiment timezone
state          text NOT NULL
```

- The template integrity set comes from `aa_integrity_constraints("aa_experiment_adherence")`:
  - `ck_…_{source_kind, status, supersede_kind, superseded_has_successor, superseded_has_timestamp, active_not_superseded, tombstoned_has_timestamp, no_self_supersedes, no_self_successor, recorded_at_known}`;
  - `uq_aa_experiment_adherence_idempotency_key (user_id, idempotency_key)`;
  - `uq_aa_experiment_adherence_supersedes_id (supersedes_id)`;
  - `ix_aa_experiment_adherence_user_recorded_at`.
- `ck_aa_experiment_adherence_state`: `state IN ('kept','missed','unknown')`.
  **No `future`/`not_recorded` member.**
- `ck_aa_experiment_adherence_correction_only`: `supersede_kind IS NULL OR supersede_kind = 'CORRECTION'`.
  A changed day record is a correction, never a revision.
- `uq_aa_experiment_adherence_active_day`: UNIQUE `(experiment_id, day) WHERE status = 'active'`.
- `ix_aa_experiment_adherence_experiment_day (experiment_id, day)`.

### 4.3 `aa_experiment_observations` (shared fact template, Phase B §7.1)

The columns come from `ValuedFactMixin`:
- identity/owner;
- the subject triple + generated `subject_key`;
- provenance;
- supersession;
- idempotency;
- `metric_key` FK;
- the value columns + `dimensions`.

Additional columns:

```
experiment_id  uuid NOT NULL FK aa_experiments(id) ON DELETE CASCADE
role           text NOT NULL
label          text NOT NULL
occurred_at    timestamptz NOT NULL
occurred_tz    text NOT NULL
```

Constraints:
- Everything from `fact_constraints("aa_experiment_observations")`:
  - the integrity set;
  - `ix_…_user_subject_recorded`;
  - `ck_…_value_type`;
  - `ck_…_value_shape` (`(status='tombstoned' AND empty) OR (NOT … AND VALUE_SHAPE)`).
- `ck_aa_experiment_observations_role`: `role IN ('outcome','context')`.
- `ck_aa_experiment_observations_label`: `btrim(label) <> '' AND char_length(label) <= 200`.
- `ck_aa_experiment_observations_occurred_tz`: `occurred_tz <> ''`.
- `ck_aa_experiment_observations_subject`:
  `subject_domain = 'experiment' AND subject_type = 'experiment' AND subject_id = experiment_id::text`.
- `ck_aa_experiment_observations_metric_key`: `metric_key IS NULL`. There are no catalogued
  experiment metrics; widening later is a constraint swap.
- `ck_aa_experiment_observations_outcome_comparable`: `role <> 'outcome' OR value_type IN ('money','duration','count','scale')`.
- `ix_aa_experiment_observations_experiment (experiment_id, role, occurred_at)`.

Matching an outcome to its experiment's definition is a cross-table rule, enforced by the service.

### 4.4 ALTER `aa_decisions` (real M5 names)

```sql
ALTER TABLE aa_decisions ADD COLUMN experiment_id uuid NULL REFERENCES aa_experiments(id) ON DELETE CASCADE;  -- default name aa_decisions_experiment_id_fkey
ALTER TABLE aa_decisions ADD COLUMN idempotency_key text NULL;
ALTER TABLE aa_decisions DROP CONSTRAINT ck_aa_decisions_scope;
ALTER TABLE aa_decisions ADD  CONSTRAINT ck_aa_decisions_scope CHECK (scope IN ('review','experiment'));
ALTER TABLE aa_decisions DROP CONSTRAINT ck_aa_decisions_review_scope;
ALTER TABLE aa_decisions ADD  CONSTRAINT ck_aa_decisions_parent CHECK (
  (scope = 'review'     AND review_id IS NOT NULL AND experiment_id IS NULL) OR
  (scope = 'experiment' AND experiment_id IS NOT NULL AND review_id IS NULL));
ALTER TABLE aa_decisions DROP CONSTRAINT ck_aa_decisions_choice;
ALTER TABLE aa_decisions ADD  CONSTRAINT ck_aa_decisions_review_choice CHECK (
  scope <> 'review' OR choice IS NULL OR choice IN ('keep','adjust','later','inconclusive'));
ALTER TABLE aa_decisions ADD  CONSTRAINT ck_aa_decisions_experiment_choice CHECK (
  scope <> 'experiment' OR choice IS NULL OR choice IN ('keep','modify','longer','reject','inconclusive'));
ALTER TABLE aa_decisions ADD  CONSTRAINT ck_aa_decisions_idempotency CHECK (
  (scope = 'experiment') = (idempotency_key IS NOT NULL));
ALTER TABLE aa_decisions ADD  CONSTRAINT uq_aa_decisions_idempotency_key UNIQUE (user_id, idempotency_key);
CREATE UNIQUE INDEX uq_aa_decisions_current_experiment  ON aa_decisions (experiment_id)
  WHERE superseded_in_revision IS NULL AND experiment_id IS NOT NULL;
CREATE UNIQUE INDEX uq_aa_decisions_experiment_revision ON aa_decisions (experiment_id, revision)
  WHERE experiment_id IS NOT NULL;
```

- These are unchanged: `ck_aa_decisions_revision`, `ck_aa_decisions_superseded_order`,
  `uq_aa_decisions_current_review`.
- Existing rows (all review scope, `review_id` set, key NULL) satisfy every new CHECK.
- Lock: a brief `ACCESS EXCLUSIVE`, with a CHECK validation scan over a small table.
  This is acceptable (Phase B §22).

ORM `AADecision`:
- adds `experiment_id` and `idempotency_key`;
- `__table_args__` mirror the names above;
- review choices are rendered with `check_in('choice', ReviewDecisionChoice)`, experiment
  choices with `check_in('choice', ExperimentDecisionChoice)`;
- the docstring records both vocabularies and the tri-state.

### 4.5 ALTER `aa_review_factors` (Factor seam A)

```sql
ALTER TABLE aa_review_factors ADD COLUMN scope text NOT NULL DEFAULT 'review';
ALTER TABLE aa_review_factors ADD COLUMN experiment_id uuid NULL REFERENCES aa_experiments(id) ON DELETE CASCADE;
ALTER TABLE aa_review_factors ALTER COLUMN review_id DROP NOT NULL;
ALTER TABLE aa_review_factors ADD CONSTRAINT ck_aa_review_factors_scope CHECK (scope IN ('review','experiment'));
ALTER TABLE aa_review_factors ADD CONSTRAINT ck_aa_review_factors_parent CHECK (
  (scope = 'review'     AND review_id IS NOT NULL AND experiment_id IS NULL) OR
  (scope = 'experiment' AND experiment_id IS NOT NULL AND review_id IS NULL));
CREATE UNIQUE INDEX uq_aa_review_factors_experiment_ordinal ON aa_review_factors (experiment_id, ordinal)
  WHERE experiment_id IS NOT NULL;
```

- `DEFAULT 'review'` is kept, so Slice 4 `persistence.py` needs **no change**.
- ORM `AAReviewFactor`:
  - `scope` has `server_default 'review'`;
  - `review_id` becomes `Mapped[uuid.UUID | None]`;
  - new `experiment_id` column.

  Do **not** reuse `_review_fk()`, which is `nullable=False`; give this model its own
  nullable mapping.
- The model docstring gains: *"`added_in_revision`/`retracted_in_revision` count the parent's
  authoring ledger: `aa_review_revisions.revision` for review scope, the experiment's
  `aa_decisions.revision` for experiment scope."*
- `replaces_id` must point at a factor of the same parent. This is enforced by the service.

### 4.6 Downgrade (C8)

The docstring says: *disposable / pre-write environments only. Once experiment writes are
enabled in production, roll back behaviour and the write gate, never this schema.*

Steps, in order:
1. `DELETE FROM aa_review_factors WHERE scope = 'experiment'`;
   `DELETE FROM aa_decisions WHERE scope = 'experiment'`. The downgrade destroys experiment
   history by design, as dropping the tables does.
2. Drop `uq_aa_review_factors_experiment_ordinal`, `ck_aa_review_factors_parent` and
   `ck_aa_review_factors_scope`. `ALTER review_id SET NOT NULL`. Drop `experiment_id` and `scope`.
3. Drop `uq_aa_decisions_experiment_revision`, `uq_aa_decisions_current_experiment`,
   `uq_aa_decisions_idempotency_key`, `ck_aa_decisions_idempotency`,
   `ck_aa_decisions_experiment_choice`, `ck_aa_decisions_review_choice` and
   `ck_aa_decisions_parent`.
4. Recreate the **exact M5** `ck_aa_decisions_choice`, `ck_aa_decisions_review_scope` and
   `ck_aa_decisions_scope` (`IN ('review')`). Drop `idempotency_key` and `experiment_id`.
5. Drop `aa_experiment_observations`, `aa_experiment_adherence` and `aa_experiments`.

**Parent-plan errata (recorded here; the frozen Phase B Plan is not edited):**
- §22's "only if no row already uses `ABANDONED`" conflates `aa_experiments.lifecycle` with the
  `aa_decisions` scope CHECK. The real precondition is "no experiment-scoped decision or factor
  rows", which step 1 handles.
- §22's "Enum implications: adding `ABANDONED` in M6 is DROP/ADD CONSTRAINT" is also wrong.
  `aa_experiments` is *created* with `ABANDONED`. The only CHECK swaps are on `aa_decisions`
  (and the new factor CHECKs).

`user_snapshots` is untouched. Snapshot `version` and server `schema_version` stay **2**.

---

## 5. Registries, export, privacy

| Registry | Change | After |
| --- | --- | --- |
| `models/__init__.py` | + `AAExperiment`, `AAExperimentAdherence`, `AAExperimentObservation` | mapped `aa_*` = **22** |
| `EXPORT_TABLES` | + `aa_experiments`, `aa_experiment_adherence`, `aa_experiment_observations`. The comment says superseded adherence rows and every decision revision leave with the export | **22** = mapped = DB |
| `TRUNCATED_TABLES` | Insert `"aa_experiment_observations", "aa_experiment_adherence", "aa_experiments"` directly after `"aa_review_factors"` | `TRUNCATE … CASCADE` unchanged |
| `aa_deletion.FACT_TABLES` | + `"aa_experiment_observations": AAExperimentObservation` | Tombstone/hard delete + provenance route (`aa_history.PROVENANCE_TABLES`) cover it. `_redact_provenance` scans it |
| Adherence | **Not** in `FACT_TABLES`. The generic tombstone would keep `state`. Day changes are CORRECTION supersession; account deletion erases it | — |
| `SOURCE_REDACTORS` | unchanged. The result is derived at read time from live facts; nothing experiment-side freezes a copy | — |
| `REVIEW_SOURCE_TABLES` / Review CHECKs | unchanged | — |
| Account deletion | `users` CASCADE covers all three tables plus the experiment-scoped decision and factor rows. The experiment FKs also cascade | T-15 extended |

A hard-deleted baseline or outcome observation makes the result `no_data`, with reason
`operand_absent`. Nothing else needs redaction.

---

## 6. Service semantics

### 6.1 Common rules

- Every function takes `user_id` from the session. Every load is
  `WHERE id = :id AND user_id = :u`. A missing or foreign experiment →
  **404 `experiment_not_found`**, identical in both cases.
- **Time validation.** A client instant must be timezone-aware and ≤ server now +
  `TIME_SKEW = 5 min`, otherwise 422 `invalid_time`. Every stored instant respects
  `ck_aa_experiments_instant_order`, which the service checks first, answering 422
  `invalid_time` rather than surfacing an `IntegrityError`.
- **Local day.** `local_date(instant, tz) = instant.astimezone(ZoneInfo(tz)).date()` and
  `local_today = local_date(server_now, tz)`. These are shared with `coverage._local_today`
  semantics; `days.py` imports the helper or reimplements it identically and tests pin equality.
- **Idempotency.** Replay is looked up by `(user_id, idempotency_key)` **before** any
  validation that depends on current state. After an `IntegrityError`: rollback, look up the
  key again, and return the replay or re-raise.

### 6.2 Create — `lifecycle.create_experiment`

1. A replay of `(user_id, key)` returns 200 when the stored row's id and every client field
   equal the body. Otherwise 409 `idempotency_key_reused`.
2. Validate:
   - `id` is a UUID with `version == 4`;
   - text bounds;
   - IANA timezone (`validate_timezone`);
   - `window_end ≥ window_start` and a length ≤ 366 days;
   - the outcome shape;
   - `hypothesis_recorded_at` is not in the future beyond the skew.

   Failures → 422 `invalid_experiment`.
3. INSERT with `lifecycle = DRAFT`. On `IntegrityError`:
   - roll back and look up `(user_id, key)`;
   - found → step 1;
   - otherwise → **409 `experiment_id_unavailable`**.

   The body is generic (`"This experiment id cannot be used."`) and identical whether the id
   belongs to this account under another key or to another account. No field of the other row
   is read into the response.

Accepted residual: a client that already knows a foreign UUID learns only that it is
"unavailable". Experiment ids never leave their account, so the risk is negligible.
Alternative rejected: `PRIMARY KEY (user_id, id)` would force composite FKs on four tables,
against the Slice 4 convention.

### 6.3 Transition — `lifecycle.transition`

```python
LEGAL_EDGES = {
  ("DRAFT", "RUNNING"), ("DRAFT", "ABANDONED"),
  ("RUNNING", "COMPLETED_AWAITING_REVIEW"), ("RUNNING", "ABANDONED"),
  ("COMPLETED_AWAITING_REVIEW", "REVIEWED"), ("COMPLETED_AWAITING_REVIEW", "ABANDONED"),
}
STATE_COLUMNS = {"RUNNING": ("started_at", "start_key"),
                 "COMPLETED_AWAITING_REVIEW": ("completed_at", "complete_key"),
                 "REVIEWED": ("reviewed_at", "review_key"),
                 "ABANDONED": ("abandoned_at", "abandon_key")}
```

The request is `to ∈ {RUNNING, COMPLETED_AWAITING_REVIEW, REVIEWED, ABANDONED}` plus
`occurred_at` and `idempotency_key`. `DRAFT` is not a target (422).

1. Load the owned row → 404.
2. **Same-key replay.** If `row.<key of to> == key` → 200 `{replayed: true}`.
3. **Key reuse.** If the key appears in any other key column of any experiment of this user,
   or as a create key → 409 `idempotency_key_reused`. This is one indexed query over the five
   key columns.
4. **Target-idempotence.** If `row.<instant of to> IS NOT NULL` (the state was already entered
   on this row's path) → 200 `{no_op: true}`. Nothing is written and the new key is not stored.
5. **Legality.** If `(row.lifecycle, to) ∉ LEGAL_EDGES` → **409 `invalid_transition`**. This
   includes every edge out of REVIEWED or ABANDONED and every skip, e.g. DRAFT→REVIEWED.
6. **Preconditions** (422):
   - `occurred_at` must be ≥ the latest stored instant among `hypothesis_recorded_at`,
     `started_at` and `completed_at` → else `invalid_time`.
   - →RUNNING: `local_date(occurred_at) ≤ window_end` → else `window_already_ended`.
   - →COMPLETED_AWAITING_REVIEW: `local_date(occurred_at) > window_end` **and**
     `local_today > window_end` → else `window_not_elapsed`.
   - →ABANDONED: no active adherence row with `day > local_date(occurred_at)` → else
     `invalid_time`.
   - →REVIEWED: **no decision precondition**. Lifecycle is independent of decision; REVIEWED
     with no decision row is the valid "skipped" state.
7. **CAS:**

   ```sql
   UPDATE aa_experiments
      SET lifecycle = :to, <instant> = :occurred_at, <key> = :key
          [, abandoned_from = :from]
    WHERE id = :id AND user_id = :u AND lifecycle = :from
   RETURNING id
   ```

   - 0 rows → roll back, re-read, and re-enter at step 2. That lands on replay, no-op, or 409.
   - `IntegrityError` on a key unique → roll back and re-enter at step 2.
8. Commit. Response 200 (`replayed: false`).

A decision write never touches `aa_experiments.lifecycle`. The transition code never reads
`aa_decisions`.

### 6.4 Adherence — `evidence.record_adherence`

The request is `day`, `state ∈ AdherenceState`, optional `supersedes_idempotency_key`, and
`idempotency_key`.

1. Replay → 200. If the key belongs to another experiment's row → 409 `idempotency_key_reused`.
2. Load the owned row `FOR UPDATE` → 404.
3. `lifecycle ∉ {RUNNING, COMPLETED_AWAITING_REVIEW}` → **409
   `experiment_not_accepting_evidence`**. This covers DRAFT, REVIEWED and **every
   post-abandon write**.
4. `day < window_start` or `day > window_end` → 422 `adherence_day_outside_window`.
   `day > local_today` → **422 `adherence_day_future`**.
5. Look up the active row for `(experiment_id, day)`:
   - none, and no `supersedes_idempotency_key` → INSERT, 201;
   - none, but a supersedes key was given → 409 `adherence_day_recorded`;
   - an active row exists and `supersedes_idempotency_key == active.idempotency_key` →
     INSERT a CORRECTION successor (`supersedes_id`, and mark the prior superseded, as in
     `aa_comparison.append_version`), 201;
   - an active row exists, and the supersedes key is absent or different → **409
     `adherence_day_recorded`**. This is deterministic under replay; a stale correction never
     silently wins.
6. Provenance is set by the server: `source_kind = USER_REPORTED`, `method = 'MANUAL'`.
   `recorded_at` is server time.

### 6.5 Outcome/context observation — `evidence.record_observation`

The request is `role`, `label`, `value`, `occurred_at`, `occurred_tz` (IANA), optional
`basis`/`method` (≤ 500), and `idempotency_key`.

- Replay → 200.
- Lifecycle must be in `{RUNNING, COMPLETED_AWAITING_REVIEW}` → else 409.
- `local_date(occurred_at, experiment.timezone)` must fall in `[window_start, window_end]` and
  `occurred_at` must be ≤ now + skew → else 422 `observation_outside_window` / `invalid_time`.
- `role = outcome` → the value must equal the outcome definition (type, unit_code,
  scale_min/max) → else 422 `outcome_shape_mismatch`.
- Stored with:
  - `subject = experiment:experiment:<id>`;
  - `metric_key = NULL`;
  - `source_kind = USER_REPORTED`.

### 6.6 Baseline — `evidence.record_baseline` → existing `aa_baselines`

The request is `value`, `window_start`, `window_end`, optional `basis`/`method`, and `idempotency_key`.

- Lifecycle must be in `{DRAFT, RUNNING}` → else 409 `experiment_not_accepting_evidence`.
  A baseline is fixed before the result.
- `window_end < experiment.window_start` → else 422 `baseline_window_invalid`.
- The value must match the outcome definition → else 422 `outcome_shape_mismatch`.
- Build a `BaselineCreate` with:
  - `subject = experiment:experiment:<id>`;
  - `metric_key = None`;
  - `timezone = experiment.timezone`;
  - provenance `USER_REPORTED`.

  Call `aa_comparison.append_semantic(db, concept="baseline", …)` unchanged. Baselines append
  without supersession; the experiment uses the **latest active** one by `(recorded_at, id)`.

### 6.7 Condition — `evidence.record_condition` → existing `aa_observations`

The request is `text` (≤ 200, trimmed, non-empty), `epistemic_kind ∈ EpistemicKind`,
`occurred_at`, `occurred_tz`, and `idempotency_key`.

- Lifecycle must be in `{RUNNING, COMPLETED_AWAITING_REVIEW}`.
- Stored through `append_semantic(concept="observation")` as:
  - `value = {type: categorical, text}`;
  - `value_availability = present`;
  - subject = the experiment;
  - `metric_key = None`;
  - `USER_REPORTED`.

This is the frozen «условия изменились · наблюдение» semantic. The detail labels it a
*condition*, never a cause.

### 6.8 Decision + factors — `decisions.record_decision`

The request is:
- `choice: ExperimentDecisionChoice | None` — **required** key; an explicit `null` means
  «Пока без решения»;
- `add_factors: [{text ≤ 500, epistemic_kind, replaces_id?}]` (≤ 20);
- `retract_factor_ids: [uuid]` (≤ 20);
- `idempotency_key`.

1. **Replay.** Look up `aa_decisions` by `(user_id, key)`. A match with
   `scope = experiment` and the same `experiment_id` → 200. Any other match → 409
   `idempotency_key_reused`.
2. Load the owned experiment `FOR UPDATE` → 404. Lifecycle must be in
   `{COMPLETED_AWAITING_REVIEW, REVIEWED}` → else **409 `experiment_not_awaiting_decision`**.
3. `revision = COALESCE(MAX(revision), 0) + 1` over this experiment's decision rows. Set
   `superseded_in_revision = revision` on the current row, if any. INSERT the new row with
   `scope = 'experiment'`, `experiment_id`, `choice` (possibly NULL), `revision`, and
   `idempotency_key`.
4. Retract factors: each must be `scope = experiment`, have the same `experiment_id`, and have
   `retracted_in_revision IS NULL` → else 422 `invalid_factor`. Set
   `retracted_in_revision = revision`.
5. Add factors with `scope = 'experiment'`, `ordinal = max + 1…`, and
   `added_in_revision = revision`. A `replaces_id` must be a factor of the same experiment →
   else 422 `invalid_factor`.
6. Commit → 201. **The lifecycle is not touched.**

Every save appends one decision revision, carrying the choice the user saw at save time.
That is how "no row" (never saved) stays distinct from "NULL" (saved without choosing). The
read model collapses consecutive equal choices when it renders «решение изменено»; the export
keeps every row.

### 6.9 Read model — `read_model.experiment_detail` / `list_experiments`

These are **pure reads**: no INSERT or UPDATE, no cache. `evaluated_at` is server now. There
is no `as_of` in Slice 6.

**Detail**:

```
id, title, hypothesis, hypothesis_recorded_at, intervention, created_at, evaluated_at
window: {start, end, timezone, total_days, local_today, window_elapsed, completion_due}
    completion_due = lifecycle == RUNNING and local_today > window_end
outcome: {label, value_type, unit_code, scale_min, scale_max}
lifecycle, abandoned_from
lifecycle_events: [{state, occurred_at}]           # from instants, ascending; DRAFT = hypothesis_recorded_at
adherence: {applicable, denominator_basis: "experiment_elapsed_days",
            total_days, elapsed_days, kept, missed, unknown, not_recorded, future, not_run_after_stop,
            abandon_day, days: [{day, state: AdherenceDay,
                                 record: {id, idempotency_key, recorded_at, corrected: bool} | null}],
            correction_count}
baseline: SemanticOut | null, baselines: [SemanticOut]           # latest first
observations: {outcome: [ExperimentObservationOut], context: [ExperimentObservationOut]}   # active, occurred_at asc
conditions: [SemanticOut]                                        # aa_observations on the subject, active
result: {state: ExperimentResultState, reason,
         outcome_day, covered_days,                              # local day of the operand, days since window_start + 1
         summary: {baselines: [..], observations: [..]},         # AADelta contract
         comparison: {metric_key: null, current_concept: "observation", current_id,
                      reference_concept: "baseline", reference_id,
                      availability: "present" | "no_data", delta: DeltaOut,
                      desire: "neutral" | "unknown", grounding_id: null, grounding_kind: null,
                      coverage: null}}
decision: {current: {choice, revision, created_at} | null,
           history: [{choice, revision, created_at, superseded_in_revision}],
           factors: [{id, text, epistemic_kind, added_in_revision, retracted_in_revision, replaces_id}]}
```

**Adherence classification** (`days.classify_adherence`):
- not applicable if the lifecycle is DRAFT, or ABANDONED with `abandoned_from = DRAFT`;
- otherwise, for each `d` in `[window_start, window_end]`:
  - `abandon_day` set and `d > abandon_day` → `not_run_after_stop`;
  - else `d > local_today` → `future`;
  - else an active row → its state;
  - else `not_recorded`.

The function asserts both invariants:
- `kept + missed + unknown + not_recorded == elapsed_days`;
- `elapsed + future + not_run_after_stop == total_days`.

**Result:**
- `not_applicable`: lifecycle DRAFT, or ABANDONED with `abandoned_from ∈ {DRAFT, RUNNING}`.
  The operands are still listed, but no delta is computed.
- `too_early`: RUNNING. The delta is `unknown / period_not_finished`, and the latest interim
  outcome is exposed as `current_id`.
- `no_data`: COMPLETED_AWAITING_REVIEW / REVIEWED / (ABANDONED from COMPLETED_AWAITING_REVIEW)
  with a missing baseline or outcome. The delta is `unknown / operand_absent`.
- `known`: the same lifecycles with both operands. The delta is
  `compute_delta(outcome, baseline)` and `desire = desirability(outcome, None)`, which is
  always `neutral`.
- The operand is the latest active outcome with `(occurred_at, recorded_at, id)` DESC.

The response has **no** `cause`, `because`, `effect`, `recommendation`, `score` or
`suggested_*` key. A test asserts this recursively.

**List** — `GET /experiments?lifecycle=…&limit=`:
- `lifecycle` is repeatable; each value must be an `ExperimentLifecycle` member (else 422
  `invalid_experiment`).
- `limit` defaults to 20, 1 ≤ limit ≤ 50.
- Ordered `created_at DESC, id DESC`.
- Each item is `{id, title, lifecycle, abandoned_from, window_start, window_end, timezone,
  window_elapsed, completion_due, created_at}`.
- `PENDING_LIFECYCLES = (DRAFT, RUNNING, COMPLETED_AWAITING_REVIEW)` is exported by the
  facade for Slice 7. It is the Phase B allow-list, and ABANDONED and REVIEWED are excluded.

---

## 7. API

### 7.1 Routes (`routes/aa_experiments.py`, prefix `/api/v1/aa`)

`ExperimentRoute(APIRoute)` maps `RequestValidationError` to 422
`{code: "invalid_experiment", message}` (the `ReviewRoute` pattern). Unsafe routes use
`dependencies=WRITE_GUARDS` (`require_json_content_type` then `require_aa_write_enabled`), so a
wrong content type is **415 before any parse → 422**. The route body calls
`enforce_same_origin`, and the user comes from `get_current_user`. Every schema sets
`extra="forbid"`, so a body `user_id` → 422.

| Method · path | Body | Success | Errors |
| --- | --- | --- | --- |
| `POST /experiments` | `ExperimentCreate`: `id`, `title`, `hypothesis`, `hypothesis_recorded_at`, `intervention`, `window_start`, `window_end`, `timezone`, `outcome{label, value_type, unit_code?, scale_min?, scale_max?}`, `idempotency_key` | 201 detail / 200 replay | 415, 403 gate/origin, 422 `invalid_experiment`/`invalid_time`, 409 `idempotency_key_reused`, 409 `experiment_id_unavailable` |
| `GET /experiments` | `?lifecycle=…&limit=` | 200 list | 401, 422 `invalid_experiment` |
| `GET /experiments/{experiment_id}` | — | 200 detail | 401, 404 `experiment_not_found` |
| `POST /experiments/{id}/transition` | `to`, `occurred_at`, `idempotency_key` | 200 detail (`replayed` / `no_op`) | 404, 409 `invalid_transition`/`idempotency_key_reused`, 422 `window_not_elapsed`/`window_already_ended`/`invalid_time` |
| `POST /experiments/{id}/adherence` | `day`, `state`, `supersedes_idempotency_key?`, `idempotency_key` | 201 / 200 | 404, 409 `experiment_not_accepting_evidence`/`adherence_day_recorded`/`idempotency_key_reused`, 422 `adherence_day_future`/`adherence_day_outside_window` |
| `POST /experiments/{id}/observations` | `role`, `label`, `value`, `occurred_at`, `occurred_tz`, `basis?`, `method?`, `idempotency_key` | 201 / 200 | 404, 409, 422 `outcome_shape_mismatch`/`observation_outside_window`/`invalid_time` |
| `POST /experiments/{id}/baseline` | `value`, `window_start`, `window_end`, `basis?`, `method?`, `idempotency_key` | 201 / 200 | 404, 409, 422 `baseline_window_invalid`/`outcome_shape_mismatch` |
| `POST /experiments/{id}/conditions` | `text`, `epistemic_kind`, `occurred_at`, `occurred_tz`, `idempotency_key` | 201 / 200 | 404, 409, 422 |
| `POST /experiments/{id}/decision` | `choice` (required, nullable), `add_factors`, `retract_factor_ids`, `idempotency_key` | 201 / 200 | 404, 409 `experiment_not_awaiting_decision`/`idempotency_key_reused`, 422 `invalid_experiment`/`invalid_factor` |

- The `{experiment_id}` path parameter is typed `UUID`. A malformed id → 422
  `invalid_experiment`, which is fine because the queue never builds one.
- Every write returns the full detail plus `replayed` (and `no_op` for transitions), as Review
  writes return `read_review`.

### 7.2 Schemas (`schemas/aa_experiments.py`)

These reuse `IdempotencyKey`, `ValueIn`, `SemanticOut`, `ValueOut`, `ProvenanceOut` and
`validate_timezone` from `aa_common`/`aa_comparison`.

- `DecisionCreate.choice: ExperimentDecisionChoice | None` has **no default**, so an absent
  field → 422 and never becomes NULL. A Review choice such as `"adjust"` → 422 by enum.
- `TransitionCreate.to` is `Literal["RUNNING", "COMPLETED_AWAITING_REVIEW", "REVIEWED", "ABANDONED"]`.
- Instants are `AwareDatetime`.

### 7.3 `_ERROR_STATUS` additions

- 404: `experiment_not_found`.
- 409:
  - `invalid_transition`;
  - `experiment_id_unavailable`;
  - `experiment_not_accepting_evidence`;
  - `experiment_not_awaiting_decision`;
  - `adherence_day_recorded`.
- 422:
  - `invalid_experiment`;
  - `invalid_time`;
  - `window_not_elapsed`;
  - `window_already_ended`;
  - `adherence_day_future`;
  - `adherence_day_outside_window`;
  - `observation_outside_window`;
  - `outcome_shape_mismatch`;
  - `baseline_window_invalid`.

`idempotency_key_reused` (409) and `invalid_factor` (422) already exist and are reused.
`experiments/errors.py` classes subclass `AAServiceError`.

---

## 8. Frontend

### 8.1 Data layer

- **`api/analytics/experiments.ts`** (NEW) + one `export *` line in `api/analytics.ts`:
  - types `AAExperiment`, `AAExperimentDetail`, `AAExperimentListItem`, `AAAdherenceDay`,
    `AAExperimentResult`, `ExperimentDecisionChoice`;
  - `getExperiment(id, signal)`;
  - `listExperiments({lifecycles, limit}, signal)`.

  Shared types are imported from `facts.ts` only.
- **`analytics/experimentFacts.ts`** (NEW, pure):
  - **`newExperimentId()`** requires `globalThis.crypto.randomUUID`. It throws the same error
    as the queue's `defaultKey` when it is missing, so creation is disabled rather than
    falling back.
  - Builders return `{operation_type, route, payload}`:
    - `experimentCreateRequest(input)` → `experiment.create`, `/api/v1/aa/experiments`,
      payload including `id`;
    - `experimentTransitionRequest(id, to, occurredAt)` → `experiment.transition`,
      `/api/v1/aa/experiments/<id>/transition`;
    - `experimentAdherenceRequest(id, day, state, supersedesKey?)`;
    - `experimentObservationRequest`;
    - `experimentBaselineRequest`;
    - `experimentConditionRequest`;
    - `experimentDecisionRequest(id, choice, addFactors, retractIds)`. `choice` is always
      present (`null` allowed).
  - `experimentHash(id)` / `parseExperimentHash(hash)` → `{view: 'list'|'new'|'detail', id}`.
  - `pendingExperimentRecords(records, id)` filters records whose route starts with
    `/api/v1/aa/experiments/<id>/`, or an `experiment.create` whose `payload.id === id`
    (any state).
  - Local-day helpers use `analytics/timezone.ts` (`localDateForInstant`, `nextDateOnly`) for
    **UI enablement only**. The server is authoritative.

  No builder mints the idempotency key; the queue does.
- **`AnalyticsRepository`**:
  - `readExperiment(id)` rejects a non-UUID;
  - `listExperiments(query)` bounds `limit ≤ 50` and validates lifecycle members.
- **`AnalyticsContext`**:
  - `enqueueExperiment(request)` = the existing `enqueue(...)`;
  - `readExperiment`, `listExperiments`;
  - `pendingExperimentWrites(id)` reads `queue.list`; it never mutates.

  **No queue, coordinator or repository-replay change.**

### 8.2 Route

- `app/routes.js`: `routes.push(…, 'experiment')` in the analytics-gated line → `LIFE_ROUTES.size` 21.
- `app/routeRegistry.js`: `raw === 'experiment' || raw.startsWith('experiment/')` → `'experiment'`,
  when `LIFE_ROUTES.has('experiment')`.
- Hashes:
  - `#/experiment` → list;
  - `#/experiment/new` → create;
  - `#/experiment/<uuid>` → detail.
- `app/lazyRoutes.jsx`: `experiment: () => import('../pages/analytics/ExperimentPage.jsx')` plus
  a `React.lazy` export. There is one `renderRoute` case in `App.jsx`.
- Entry point:
  - `components/Sidebar.jsx` gets an item `{id: 'experiment', icon: <existing icon>,
    label: t('nav_experiments')}` in the `life` group, **only when `ANALYTICS_ROUTE_ENABLED`**.
  - The mobile «ещё» drawer reaches it. The implementer verifies that `more` opens the Sidebar
    drawer; if it does not, add the same gated item to that drawer and nothing else.
  - The page renders nothing actionable when `useAnalytics().enabled` is false.

### 8.3 Page and components

- **`pages/analytics/ExperimentPage.jsx`** is the route shell. Internals live in
  `pages/analytics/experiment/`:

  | File | Contents |
  | --- | --- |
  | `format.js` | shared copy helpers |
  | `ExperimentList.jsx` | lifecycle chips; pending/closed groups use `PENDING_LIFECYCLES` |
  | `CreateForm.jsx` | title, hypothesis, intervention, window start + length, outcome definition |
  | `Detail.jsx` | the detail view |
  | `EvidenceForms.jsx` | adherence day picker, observation, baseline, condition |
  | `DecisionStep.jsx` | experiment `ChoiceList` + factor editor using `AAFactorTag` |

  The Review `ChoiceList` is **not** reused because it hard-codes review choices.
- **`components/analytics/AAExpStages.jsx`** (NEW). Stages: гипотеза · базовый уровень ·
  период · наблюдения · результат · решение. Mapping from **lifecycle only**:
  - DRAFT → hypothesis `is-now`;
  - RUNNING → run `is-now` (earlier stages done);
  - COMPLETED_AWAITING_REVIEW → result/decision `is-now`;
  - REVIEWED → all done;
  - ABANDONED → stages reached before `abandoned_from` are done, and the rest are **neither
    `is-done` nor `is-now`**, plus the label «прекращён · период не завершён» (from
    COMPLETED_AWAITING_REVIEW: «прекращён после окончания периода»).

  The decision value is never read.
- **`components/analytics/AAAdherence.jsx`** (NEW). It renders `adherence.days` **in calendar
  order** from the server. Cell classes are:
  - `is-kept`;
  - `is-missed`;
  - `is-unknown`;
  - `is-not-recorded`;
  - `is-future`;
  - `is-after-stop` (future styling with a distinct accessible label «не проводился»).

  Each cell has a localized `aria-label` with the date. Copy: «соблюдено X из Y прошедших дней
  · период N дн.» and «Частичное соблюдение — обычное состояние, а не брак данных.» The
  frozen kept-first fill is **not ported**.
- **Detail composition** (frozen I, minus demo):
  1. PageHeader with back link and status copy.
  2. `AAExpStages`.
  3. Claim block «гипотеза · предположение, не факт» (`.aa-exp-claim`).
  4. `AAFacts` for baseline / intervention / period. These are facts, not delta operands.
  5. `AAAdherence`.
  6. A quality line built from the adherence counts and conditions. It is **not**
     `AAQualityStrip`, which takes a `CoverageReport` only; adherence is never passed as
     coverage. It shows conditions with an epistemic tag, «причина · не установлена», and
     «Изменений условий не зафиксировано. Это не означает, что их не было.»
  7. Observations: «измерения, не выводы», with `AAProvenance`.
  8. Result via **`AADelta` unchanged**, fed the API `summary`/`comparison`. `notes` provide
     «до вмешательства» and «на <дата> · <covered_days> из <total_days> дн.». `too_early`
     renders «рано судить», with the fixed notes «Промежуточные значения показываются, но
     результат не считается до конца периода.» and «Разница — это разница, а не доказательство
     причины.»
  9. «Что могло повлиять» with `AAFactorTag` and a decision list, only in
     COMPLETED_AWAITING_REVIEW/REVIEWED. The list is: `keep` «Оставить правило» · `modify`
     «Изменить условия и повторить» · `longer` «Продлить период» · `reject` «Отказаться» ·
     `inconclusive` «Непонятно — данных недостаточно» · `null` «Пока без решения», with
     «Решение можно не принимать. Эксперимент останется в истории.»
  10. «Что менялось» from `lifecycle_events` + adherence corrections + conditions, rendered
      as plain text nodes. There are **no HTML strings**. It gets its own small list, or
      `AAHistoryList` over fact rows where they are facts.
- **Actions → ordered queue records** (each with its own key minted at enqueue):
  - **Create** enqueues `create`, then optionally `baseline`, then optionally
    `transition RUNNING` when the user chose «начать сейчас».
  - **Stop** («прекратить эксперимент», ghost button, DRAFT/RUNNING only per D4) opens a
    confirm dialog with focus trap/return and Escape, then enqueues `transition ABANDONED`
    with `occurred_at = now`. The API also allows it from COMPLETED_AWAITING_REVIEW; the UI
    does not offer it there, as D4 specifies.
  - **Period over.** When the detail or list shows `completion_due`, or the client local today
    is after `window_end`, the lifecycle is RUNNING, and no pending `experiment.transition` to
    COMPLETED_AWAITING_REVIEW exists for this id, the page enqueues it with `occurred_at = now`.
    Duplicates from other tabs are a server 200 no-op.
  - **Save decision** enqueues `decision` (choice or `null`, factor diff). In
    COMPLETED_AWAITING_REVIEW it then enqueues `transition REVIEWED`. If the decision
    dead-letters, the head block keeps REVIEWED from ever being sent.
  - **Adherence**: pick a day's state. If the day already has `record`, send
    `supersedes_idempotency_key = record.idempotency_key`. If a pending record for that day
    exists in the queue, send its key.
- **No optimistic server state.** The page shows server truth plus a neutral `role="status"`
  note: «Есть записи, ещё не подтверждённые сервером: N». It re-reads when the pending count
  changes (the Slice 5 pattern).
- **Unacknowledged create.** If the detail GET returns 404 and a pending `experiment.create`
  with this id is in the queue, the page shows the queued title/hypothesis marked «ещё не
  сохранено на сервере». These are read from the queue record, never fabricated.
- A dead-lettered record shows through the existing sync UI (discard/export).
- **CSS**: `src/analytics.css` gets a Slice 6 block ported from frozen `.aa-exp-*` / `.aa-adh*`,
  plus the new `is-unknown` / `is-not-recorded` / `is-after-stop` cells. Narrow layout: 16 px
  gutters, the adherence grid wraps, no horizontal overflow at 390 px, and reduced motion is
  respected. **No** `.aa-phone`/`.aa-shell`/`.aa-rail`/`.aa-stage*` (T-16). Neither the
  `.aa-layers` switcher nor the eyebrow «будущая возможность» ships.
- **Locale**: `aa_ex_*` keys plus `nav_experiments` in **both** `context/locale/ru.js` and
  `uk.js`, with UK written properly (not a fallback). Plurals go through `t.pl('pl_day', n)`.
  `locale-shape.test.ts` counts are updated.

---

## 9. Test matrix (to write in the serial session; none run here)

Backend tests run on `lifeos_test` only. New files:
- `tests/test_aa_experiment_lifecycle.py`;
- `tests/test_aa_adherence.py` (the **T-07** home);
- `tests/test_aa_experiments.py` (the **T-08** experiment home, plus the T-09 precursor);
- `tests/test_aa_experiment_migration.py`;
- helper `tests/aa_experiment_helpers.py`.

Each test drives the real API. A frozen server clock is injected, following the Slice 5 pinned
write clock, and `TZ=Europe/Kyiv` is used.

| # | Area | Assertions |
| --- | --- | --- |
| L1 | Legal edges | All 6 legal edges succeed. Instants and keys are set. `abandoned_from` is correct for each of 3 origins |
| L2 | Illegal edges | For every `(from ∈ 5 states, to ∈ 4 targets)` pair outside `LEGAL_EDGES` whose target was never entered → 409 `invalid_transition`. Includes REVIEWED→* and ABANDONED→* (terminal) and DRAFT→COMPLETED_AWAITING_REVIEW/REVIEWED |
| L3 | Replay | Same key → 200 `replayed`. The row is unchanged and the instant is not overwritten |
| L4 | Target-idempotence | Different key, target already entered (RUNNING twice; ABANDONED twice; COMPLETED_AWAITING_REVIEW after REVIEWED) → 200 `no_op`. The second key is not stored |
| L5 | Key reuse | A start key reused for ABANDONED, or on another experiment → 409 `idempotency_key_reused` |
| L6 | CAS | Two sessions/threads race DRAFT→RUNNING vs DRAFT→ABANDONED. Exactly one lifecycle wins; the loser gets 409 or no-op, never both applied. The DB row satisfies every CHECK |
| L7 | DB backstop | A direct SQL INSERT/UPDATE of each illegal shape (REVIEWED without completed; ABANDONED + reviewed; `abandoned_from = 'RUNNING'` without start; half pairs; order violations; lifecycle `'PAUSED'`) → `IntegrityError` |
| L8 | IANA completion | Window ending 2026-10-24 Kyiv, around the DST switch on 2026-10-25. →COMPLETED_AWAITING_REVIEW at 2026-10-24T20:59Z (23:59 local, UTC+3) → 422 `window_not_elapsed`. At 2026-10-24T21:00Z (00:00 local 25th) → 200. Winter case in January (UTC+2). A fixed-offset implementation fails one of them |
| L9 | Client occurrence time | `started_at` equals the client `occurred_at` even when replayed "hours later" (server clock advanced). A future instant beyond 5 min → 422 `invalid_time`. A non-monotonic instant → 422 |
| L10 | Decision ⊥ lifecycle | Recording any choice (incl. `reject`) in COMPLETED_AWAITING_REVIEW leaves the lifecycle COMPLETED_AWAITING_REVIEW. REVIEWED with no decision row is allowed. A decision in DRAFT/RUNNING/ABANDONED → 409 |
| A1 **T-07** | Future day | A write for local tomorrow → 422 `adherence_day_future`, and no row is created. The derived day is `future`, never `missed` |
| A2 | Today elapsed | A write for local today → 201 |
| A3 | Missing vs unknown | An elapsed day without a row → `not_recorded`. An explicit `unknown` stays `unknown`. The counts are separate |
| A4 | Partial | 6 kept / 3 missed of 9 elapsed, window 21 → `elapsed_days = 9`, `total_days = 21`, both invariants hold (never 6/21) |
| A5 | Post-abandon | Abandon on day 8 of 21. Days 9–21 → `not_run_after_stop`; `elapsed_days = 8`; `missed` counts only real missed rows; any adherence write → 409 `experiment_not_accepting_evidence`; pre-abandon rows are retained |
| A6 | Abandon guard | An active row exists for a day after the proposed abandon date → 422 `invalid_time` |
| A7 | Denominator | Abandoned experiments exclude post-stop days from the denominator (explicit arithmetic assertion) |
| A8 | Corrections | A correction with the right supersedes key → one active row, `correction_count = 1`, counted once. A stale or missing supersedes key → 409 `adherence_day_recorded`. Concurrent double correction → `uq_…_supersedes_id` stops the fork |
| A9 | Window edges | A day before start or after end → 422. A window crossing month and year boundaries |
| A10 | Not applicable | DRAFT and abandoned-from-DRAFT → `applicable = false`, no `not_recorded` days |
| E1 | Create | A client UUID v4 id is the stored id. Replay 200. Same key with a different body → 409 `idempotency_key_reused`. A non-v4 UUID → 422 |
| E2 | Id collision | Account B posts account A's id → 409 `experiment_id_unavailable`. The response body is byte-identical to the own-account-other-key case and contains no A data. A's row is unchanged |
| E3 **T-08** | Tri-state | No decision row / row with `choice NULL` / row `inconclusive` are all distinct in DB and API. Omitting `choice` → 422 (never NULL) |
| E4 | Scope vocab | API: `adjust`/`later` on an experiment → 422. Review revise with `reject`/`modify`/`longer` → 422. DB: direct INSERT of `scope='review', choice='reject'` and `scope='experiment', choice='adjust'` → `IntegrityError`. The parent CHECK rejects both-parents and no-parent |
| E5 | Decision revisions | Two saves → revisions 1, 2; exactly one current; history kept. Factors added in r1 and retracted in r2 carry the right numbers. `replaces_id` across experiments → 422 `invalid_factor`. A review factor id cannot be retracted by an experiment decision |
| E6 | Isolation | Every route, including list, rejects account B reading or writing A's experiment with 404 (writes) or omits it (list). A body `user_id` → 422 |
| E7 | Guards | For every POST route: a wrong Content-Type → **415 before 422** (an invalid body with the wrong type still gives 415). Gate closed → 403 `aa_writes_disabled`. Cross-origin → 403. Reads work with the gate closed |
| E8 | Result | RUNNING → `too_early`, delta unknown, interim value present. COMPLETED_AWAITING_REVIEW with baseline + outcome → `known`, `desire == "neutral"` with the delta sign positive and negative. Missing baseline → `no_data`. Abandoned from RUNNING → `not_applicable`. A baseline hard-deleted via `DELETE /aa/facts/aa_baselines/{id}?mode=hard` → `no_data` and no residue |
| E9 | No fake outcomes | No `metric_key` is ever set. No catalogue row is added (`aa_metric_definitions` count unchanged). An outcome with a type other than the definition's → 422. «дней с записью» is not stored |
| E10 | No causal assertion | The recursive key scan of every detail/list response finds no forbidden key (`cause`, `because`, `effect`, `caused_by`, `recommend*`, `score`, `suggest*`). ORM column names are scanned the same way |
| E11 | Hypothesis | Stored as a column; no `source_kind = HYPOTHESIS`; not editable (no route) |
| E12 | Read-only reads | Every `aa_*` row count is unchanged before and after the detail/list GETs |
| E13 **T-09 precursor** | Pending list | `?lifecycle=DRAFT&lifecycle=RUNNING&lifecycle=COMPLETED_AWAITING_REVIEW` excludes ABANDONED and REVIEWED. The `PENDING_LIFECYCLES` constant equals that tuple. (T-09 proper lands in Slice 7's `test_aa_system_review.py`) |
| P1 **T-14** | Export | All 3 tables plus experiment decisions and factors appear, including superseded adherence rows and all decision revisions. Registry parity is 22 == 22 == 22. Manifest revision = M6 |
| P2 **T-15** | Account delete | Zero rows remain in all 22 `aa_*` tables for the deleted account; the other account is intact |
| P3 | Fact delete | Tombstone and hard delete of an experiment observation go through the generic route. Adherence is not deletable through it (404 table) |
| M1 | Migration | Roundtrip on `lifeos_test`: M6 down → M5 (tables gone; `aa_decisions`/`aa_review_factors` constraints/columns exactly as M5, compared with `pg_get_constraintdef`) → up. Chain: M6 `down_revision == "20260928_0006"`, single head. Earlier tables are untouched. With experiment-scoped decision/factor rows present, the downgrade still succeeds (step 1 deletes them) |
| M2 | Enum/CHECK parity | For each new `ck_*` built from an enum (lifecycle, abandoned_from, adherence state, role, outcome type, review_choice minus `'review'`, experiment_choice minus `'experiment'`, `ck_aa_decisions_scope`, `ck_aa_review_factors_scope`), the quoted members equal the enum. Registered in `test_aa_schema_guards.py`/`test_aa_reviews.py` |
| M3 | Guards | `test_every_mapped_table_is_either_cleaned_or_seeded` and `…cascade_from_users` pass with the 3 new tables |
| R1 | Review regression | The full existing Review suite passes unchanged, apart from the pins in Discovery §12. A review save still writes factors with `scope = 'review'` via the default |
| S1 | Permanent | **T-07, T-08, T-09 (precursor), T-12, T-14, T-15** green. Catalogue exactly four rules. `schema_version` 2 |

Frontend tests: `analytics-experiment.test.ts` (pure) and `analytics-experiment.test.jsx` (components).

| # | Assertions |
| --- | --- |
| F1 | Builders: routes contain the client id; `choice: null` is preserved in the payload; builders never set `idempotency_key`; `newExperimentId()` returns a v4 and throws without `crypto.randomUUID` |
| F2 | **Dependent queued write**: with the real `AnalyticsWriteQueue` (fake-indexeddb) and a stub repository, enqueue create → transition → adherence **before** any acknowledgement; replay order is exactly FIFO |
| F3 | **Failed parent blocks child**: the stub returns 422 for create → the create is `failed_permanent`, and the transition/adherence are never sent (the stub call log has 1 entry) |
| F4 | 5xx on create → backoff; the child is not sent until the create succeeds; the key is unchanged across retries |
| F5 | Discard the failed create → the child is sent → stub 404 → `failed_permanent` (visible), never silently applied |
| F6 | Restart replay: re-create the queue on the same fake DB → the same keys replay |
| F7 | `AAAdherence` renders calendar-true order (a missed day before a kept day stays in place), every derived class, localized a11y labels, «X из Y прошедших» with the server's `elapsed_days` |
| F8 | `AAExpStages` for all 5 lifecycles × each `abandoned_from`. ABANDONED remaining stages have no `is-done`/`is-now`. Decision presence never changes the stage |
| F9 | Hypothesis label present. No-causality note present. No recommendation/score text: source scan of `pages/analytics/experiment/**` and both new components |
| F10 | Result `too_early` renders «рано судить» with `data-desire="unknown"`. `known` → `data-desire="neutral"` for both signs. No fake adherence/outcome: an empty detail renders empty states, never zeros |
| F11 | The decision list has exactly the 5 experiment choices plus «Пока без решения». Saving enqueues decision **then** transition REVIEWED (COMPLETED_AWAITING_REVIEW only). The decision never maps to lifecycle in the UI state |
| F12 | Stop dialog: DRAFT/RUNNING only; focus trap/return; Escape; enqueues ABANDONED |
| F13 | Period-over auto-enqueue happens once; it is not repeated while a pending record exists |
| F14 | RU/UK: full UK render without Russian-only letters (ы/э/ъ/ё) outside user data; key parity |
| F15 | Route pins: `LIFE_ROUTES.size` 21; hash cases `#/experiment`, `#/experiment/new`, `#/experiment/<uuid>`; lazy loader; Sidebar item only when analytics is enabled; page inert with the client flag off |
| F16 | **T-12** `analytics-sync-coordinator.test.ts` unchanged and green. **T-16** no demo-chrome classes |

---

## 10. Commit plan (each commit green)

1. `docs: add Slice 6 reconciled discovery and plan` — copy both files into `Outputs/`.
2. `Add M6 experiments schema, widen decisions and factors by scope` — enums; 3 models;
   `AADecision`/`AAReviewFactor`; migration; registries (export, TRUNCATE, FACT_TABLES);
   migration + guard + parity tests; update the existing pins (Discovery §12).
3. `Add Experiment lifecycle, evidence and decision service with API` — `services/experiments/*`,
   facade, schemas, route, `main.py`, error map; the lifecycle, adherence and experiments suites.
4. `Add Experiment page with stages, adherence, result and decision` — API domain, builders,
   repository/context, route/registry/lazy/Sidebar, components, page, CSS, locale, frontend tests.
5. Browser QA fixes, if any.
6. `Record Slice 6 implementation report and context` — report under `Outputs/Implementations/`;
   `module-boundaries.md`; `LIFEOS_MASTER_CONTEXT.md` §§13, 15, 36, 40, 50 (head, table count 22,
   next slice 7).

---

## 11. Validation (serial session)

```
apps/api: python -m pytest   (lifeos_test only)   ruff check .   alembic heads   alembic current
apps/web: npm test   npm run typecheck   npm run lint   npm run build (+ --manifest; no 500 kB warning)
repo:     git diff --check
```

- Import cycles: 0 (static graph), backend and frontend.
- Browser QA uses the Slice 5 method: headless Chrome via DevTools, a production build with
  `VITE_LIFEOS_ANALYTICS_ENABLED=true`, and a local API on `lifeos_test`.
- QA matrix: 390/768/1440 × dark/light/paradise. States: DRAFT, RUNNING (6/9 of 21),
  COMPLETED_AWAITING_REVIEW with result, REVIEWED with NULL decision, ABANDONED from RUNNING,
  pending create. Plus UK screens and the gate-closed pending-queue case.
- The known paradise 768 px backdrop overflow is pre-existing and not attributed to this slice.

---

## 12. Rollback / release

- The server gate `LIFEOS_AA_WRITE_ENABLED` and client flag `VITE_LIFEOS_ANALYTICS_ENABLED`
  are unchanged. No deployment is implied.
- After personal experiment writes exist, rollback is behavioural (gate/flag) and never the
  M6 downgrade (C8).

---

## 13. Open items

- `OWNER_DECISIONS_OPEN = 0`.
- **Non-blocking defaults** (Discovery §14): decisions only in COMPLETED_AWAITING_REVIEW /
  REVIEWED; immutable definition; user-reported period-to-date outcome with no server
  averaging; Sidebar entry.
- **Re-verify at the serial gate (§0):** `main` movement; head; registry counts; coordinator
  loop; route count pin; locale counts.

```
PLAN_STATUS=EXECUTION_READY_CANDIDATE
M6_DOWN_REVISION=20260928_0006
M6_NEW_TABLES=aa_experiments, aa_experiment_adherence, aa_experiment_observations
M6_ALTERS=aa_decisions, aa_review_factors
AA_TABLE_COUNT_AFTER=22
SNAPSHOT_VERSION=2  SERVER_SCHEMA_VERSION=2
SIGNAL_RULES=4 (unchanged)
QUEUE_CHANGE_REQUIRED=NO
DEPENDENCIES_ADDED=none
```
