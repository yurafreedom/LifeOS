# LifeOS · Adaptive Analytics · Slice 6 · First-Class Experiments — Parallel Targeted Discovery

Status: **provisional, parallel-wave Discovery**. Written outside Git on 2026-09-28.
It does not authorize implementation. Before any M6 code, the Slice 6 Plan must copy
this document into `Outputs/Discoveries/` and re-verify it against then-current `main`.

---

## 1. Executive verdict

**DISCOVERY_STATUS = PASS (provisional).** Enough is known to draft a Slice 6 plan.
Three things were settled from the baseline code, not assumed:

1. **The durable queue can carry dependent Experiment writes safely, with no change to its
   failure model.** The queue has four properties that make this work:
   - Replay is strict FIFO and single-flight.
   - A dead-lettered (`failed_permanent`) or `terminal_conflict` record **blocks the head of
     the queue** (`analyticsSyncCoordinator.ts` `flushAsLeader` → `break`). A write that
     depends on a failed create is therefore never sent past it.
   - The idempotency key is minted at enqueue.
   - The route is fixed at enqueue time.

   The one thing missing is **an experiment identity the client knows at enqueue time**, so
   routes like `/experiments/{id}/transition` can be built before the create is acknowledged.
   A client-minted experiment UUID solves this (§11, §16). The queue already has a precedent
   for addressing an unacknowledged parent: `POST /measurements/by-idempotency/{key}/correct`.
2. **The lifecycle can be enforced in the DB and in the service together.** Every lifecycle
   state is entered at most once, because the transition graph is a DAG. So per-state
   timestamp and idempotency-key columns on `aa_experiments` encode the **entire path**, and
   CHECK constraints can make every illegal path shape unrepresentable. The service adds a
   predicate CAS (`WHERE lifecycle = :from`) for concurrency and returns `409 invalid_transition`.
   This also makes transitions idempotent on replay **without a fourth table** (§8.1).
3. **Future days, post-abandon days and missing days are never stored as misses.**
   - Adherence storage is `kept | missed | unknown`, one active row per elapsed local day.
   - `future` is derived at read time and is **never persisted**.
   - Elapsed days with no row are a derived `not_recorded`, kept distinct from explicit
     `unknown` (missing ≠ explicit unknown).
   - Days after the abandon date are derived and rendered as not-run / `future`-styled. The
     server rejects writes for them.

The Slice 4 dependency is **real and structural**:
- `aa_decisions` does not exist on the baseline.
- Its exact shape can only be known after Slice 4 merges.
- The in-flight Slice 4 plan (unmerged, non-authoritative, §5.3) already points to a
  reconciliation hazard: **Review and Experiment use different choice vocabularies.** Frozen
  Review offers `keep · adjust · later · (none)`. Frozen Experiment offers
  `keep · modify · longer · reject · inconclusive`. M6 cannot simply "widen a CHECK". It must
  install a **scope-dependent choice CHECK**.
- The factor seam ("Что могло повлиять" on the Experiment page) is **not addressed** by the
  parent plan's M6 note. It has to be decided in the Slice 6 Plan (§17, R-2).

No owner decision is required. Everything open is an engineering decision for the Plan, or
a contract to re-verify after Slice 4 merges.

---

## 2. Baseline SHA actually inspected

- `ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef`. `git cat-file -e …^{commit}` passed.
- All code was read from `git archive ea3a75e…` extracted into a session scratchpad, **not**
  from the working tree.
- The canonical checkout was on `feat/adaptive-analytics-slice-4-reviews` at inspection time,
  because another session was active. It was not touched.
- The frozen design was read from tag `adaptive-analytics-design-accepted`: tag object
  `6c507b82…`, target `d4960286…`.
- The in-flight Slice 4 branch commit `fb7f8a4` was read **read-only**, and only as a
  non-authoritative preview (§5.3).

---

## 3. Source authority list

| Rank | Source | Use |
| --- | --- | --- |
| 1 | Owner decisions D1–D5 (esp. **D4 ABANDONED**, **D5 durable queue**) | binding |
| 2 | Code at `ea3a75e` | current truth |
| 3 | Slice 3 report `Outputs/Implementations/lifeos-adaptive-analytics-slice-3_20260928-151155.md` (415-before-422, M4 conventions), plus Slice 0/0b/1/2/P reports | accepted precedent |
| 4 | Phase B Plan `…phase-b-implementation-plan_20260908-045036.md` §6 table list, §7.1, §8, §9.2, §10, §11.1, §15, §17, §20.3, §21, §22, §24.6, §24.9, T-07/T-08/T-09 | parent contract |
| 5 | Targeted Technical Discovery `…20260908-042647.md` | background |
| 6 | Frozen I · Experiment: `ui_kits/life-os-analytics/experiment.jsx`, `data.js` (`experiments[]`), `analytics.css` (`.aa-exp-*`, `.aa-adh*`), `README.md` Pass 3 and the AAFacts/AADelta rule | product / semantic / visual only |
| — | Unmerged Slice 4 plan at `fb7f8a4` | **preview only, not authority** |

`AGENTS.md`, `CLAUDE.md` and `LIFEOS_MASTER_CONTEXT.md` were read. Master context §36 says
the next slice is 4. §40 restates D4.

---

## 4. Current baseline architecture relevant to this slice (AVAILABLE_NOW)

**Backend**
- **Mixins** (`app/models/mixins.py`, `aa_semantic.py`):
  - `AAOwnedMixin`: uuid PK, `user_id` FK `users ON DELETE CASCADE`, `created_at` as a storage fact only.
  - `AASubjectMixin`: typed triple plus a generated stored `subject_key`.
  - `AAValueMixin`: discriminated value, with no `unknown` value type.
  - `AAProvenanceMixin`: `source_kind`, `basis`, `method`, `source_ref`, `recorded_at`, `original_recorded_at_known`.
  - `AASupersessionMixin`: `supersedes_id`/`superseded_by_id`/`supersede_kind` `CORRECTION|REVISION`/`status` `active|superseded|tombstoned`.
  - `AAIdempotencyMixin`.
  - `aa_integrity_constraints()` adds `UNIQUE(user_id, idempotency_key)` and `UNIQUE(supersedes_id)` (no forked history).
  - `fact_constraints(window=…, observation=…)` and `WindowMixin` (`window_start`, `window_end`, `timezone`).
- **Enums** (`app/analytics/enums.py`):
  - Stored as TEXT + CHECK, rendered by `check_in()`. A schema-guard test asserts that the installed CHECKs equal the enum members.
  - Relevant existing enums: `EpistemicKind` (`observed/mine/maybe/unknown`), `ObservationAvailability`, `DayCoverage` (includes `FUTURE`), `DenominatorBasis.EXPERIMENT_ELAPSED_DAYS`, which **already exists** and is waiting for this slice.
- **Subject registry** (`app/analytics/subjects.py`):
  - `("experiment","experiment")` is **already registered**.
  - Validation happens at the service boundary, so no migration is needed.
  - `subject_id` must not contain `:`. A UUID string is fine.
- **Idempotency pattern** (`services/aa_facts.py`): lookup → insert → recover on `IntegrityError` → return `replayed=True`. The route returns 201 when created and 200 on replay.
- **Queue-safe dependent addressing**: `POST /api/v1/aa/measurements/by-idempotency/{measurement_key}/correct`, documented as "Queue-safe correction when the create acknowledgement has not arrived yet".
- **Route guards**:
  - `dependencies=[Depends(require_json_content_type), Depends(require_aa_write_enabled)]` rejects a wrong content type with **415 before body parsing** (Slice 3 fix).
  - The route body calls `enforce_same_origin`.
  - The user comes from `get_current_user`.
  - Errors use the `{code, message}` envelope.
- **Local days** (`app/analytics/coverage.py` `classify_days`):
  - `today = now.astimezone(ZoneInfo(tz)).date()`.
  - A day is **future iff `day > today`**. Today counts as elapsed.
- **`compute_delta`** (`app/analytics/delta.py`) returns `DeltaUnknown` for an absent operand and raises for incompatible units.
- **`desirability()`** grounds only on Target/Preference (Decision is named in the contract).
- **Baselines** (`aa_baselines`) and **observations** (`aa_observations`, with `epistemic_kind` default `unknown` and `value_availability`) exist, with POST routes in `routes/aa_comparison.py`.
- **Export registry** (`services/export.py` `EXPORT_TABLES`, 13 `aa_*` tables): `validate_export_registry()` asserts that mapped `aa_*` equals the registry.
- **Deletion** (`services/aa_deletion.py`):
  - `FACT_TABLES` = the semantic tables plus measurements and coverage.
  - `SOURCE_REDACTORS = ()` is the extension hook (Slice 4 fills it).
  - Account deletion is `DELETE users` → cascade.
- **Test TRUNCATE registry** (`tests/conftest.py` `TRUNCATED_TABLES`) has a guard test in `test_aa_schema_guards.py`.
- **Alembic**: one head, `20260928_0005` (M4). M4 convention: frozen SQL in the migration, and a docstring stating the C8 downgrade policy.

**Frontend**
- **`AnalyticsWriteQueue`** (IndexedDB `lifeos-adaptive-analytics`/`outbound_writes`):
  - Record fields: `{queue_id, user_id, operation_type, route, payload_schema_version, payload, idempotency_key, state, attempts, next_attempt_at, …}`.
  - The key is minted at enqueue.
  - `first(userId)` returns the lowest `queue_id` in any state.
- **`AnalyticsSyncCoordinator`**:
  - 401 → `blocked_auth`.
  - 400/422 → `failed_permanent`.
  - 409 → `terminal_conflict`.
  - Network/408/425/429/5xx → backoff.
  - **Anything else, including 403 and 404, → `failed_permanent`.**
  - Any failed or conflicted head record **stops the flush**.
- **`AnalyticsRepository.replayQueuedWrite`** requires `payload_schema_version === 1`, a route inside `/api/v1/aa/`, and `payload.idempotency_key === record.idempotency_key`. It always POSTs.
- **`AnalyticsContext.enqueue(operation_type, route, payload)`**:
  - Returns `null` when `ANALYTICS_CLIENT_ENABLED` is false, so experiments (which are pure AA) must be hidden or disabled when the flag is off.
  - Per-concept helpers exist, e.g. `enqueueProjectForecast`.
- **Timezone** (`analytics/timezone.ts`): `LIFEOS_TIME_ZONE`, `parseDateOnly`, `dateOnlyAtStartOfDay`, `nextDateOnly`, `dateOnlyAfterEndOfDay`, `localDateForInstant`. All are IANA-aware (the Slice 2 lesson).
- **Production AA primitives use API-shaped props, not the frozen kit's props:**
  - `AADelta({summary, comparison})` picks operands from API ids, via `layerNames` for `actual/forecast/observation/expectation/baseline`.
  - `AAFacts({facts})`, `AAHistoryList({facts})` (fact rows with provenance), `AAProvenance({provenance})`.
  - **`AAQualityStrip({coverage})` renders a `CoverageReport` only.**
  - **`AAFactorTag` does not exist** on the baseline. Slice 4 adds it.
- **Routes**: `analytics` and `analytics-history` are behind `ANALYTICS_ROUTE_ENABLED`. The page switch is in `App.jsx`.

**Absent on the baseline:**
- `aa_reviews*`, `aa_decisions`, `aa_experiment*`.
- Any lifecycle concept.
- `AAFactorTag`, `AAAdherence`, `AAExpStages`, `ExperimentPage`.

---

## 5. Planned predecessor contracts this slice depends on

### 5.1 Classification

| Dependency | Class | Notes |
| --- | --- | --- |
| Mixins, subject registry incl. `experiment:experiment`, idempotency, by-key addressing, 415 guard, export/TRUNCATE/deletion registries, timezone helpers, `DenominatorBasis.EXPERIMENT_ELAPSED_DAYS`, `DayCoverage.FUTURE`, `aa_baselines`, `aa_observations`, `compute_delta`, queue/coordinator | **AVAILABLE_NOW** | verified at `ea3a75e` |
| `aa_decisions` exists; nullable `choice`; NULL ≠ `inconclusive`; "review **or** experiment scoped"; M6 widens its CHECK | **PLANNED_PREDECESSOR_CONTRACT** (parent plan §6, §22, §24.6) | enough to reason about |
| `aa_review_factors` with `epistemic_kind` default `unknown`; `AAFactorTag.jsx` | **PLANNED_PREDECESSOR_CONTRACT** (§24.6) | enough to reason about |
| Exact `aa_decisions` columns: scope column name, `review_id` nullability, `choice` CHECK name/members, revision/supersession model, partial unique index | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | see §18 |
| M5 revision id (the `down_revision` for M6) | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | preview says `20260928_0006` |
| Whether Reviews can take subject `experiment:experiment` | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | preview says **no** (finance:period, project:project only) |
| Slice 4 composite-FK / parent-child ownership convention | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | adopt it if it exists |
| `SOURCE_REDACTORS` adapter shape after Slice 4 | **UNKNOWN_UNTIL_PREDECESSOR_MERGES** | Slice 6 probably needs no adapter (§12) |
| Slice 5 (Project Analytics) | **not a dependency** | the plan says 5 ∥ 6 after 4 and P. Slice 5 may touch `aa_comparison.py` and `AADelta`, so re-verify for merge conflicts |
| Owner decision | **none required** | |

### 5.2 Parent-plan promises Slice 6 relies on

- Tables `aa_experiments`, `aa_experiment_adherence` (one row per elapsed day), and `aa_experiment_observations` (shared fact template, own provenance).
- M6 extends the `aa_decisions` CHECK to allow experiment scope. The plan says the brief `ACCESS EXCLUSIVE` lock is negligible.
- Lifecycle is TEXT + CHECK with exactly the D4 states and transitions. Outcome is orthogonal and nullable.
- D4 UX delta:
  - an «прекратить эксперимент» ghost action in DRAFT and RUNNING, with a confirm step;
  - the status «прекращён · период не завершён»;
  - remaining stages rendered neither done nor current;
  - a history row «Эксперимент прекращён»;
  - post-abandon days never `missed`;
  - System Review pending uses the allow-list `{DRAFT, RUNNING, COMPLETED_AWAITING_REVIEW}` (Slice 7 consumes this).
- Coverage example: running «6 / 9 прошедших · период 21 дн.», never 6/21. Completed «9 из 14».

### 5.3 In-flight Slice 4 preview (fb7f8a4, NOT authoritative, may change)

- M5 `20260928_0006_aa_reviews`, six tables.
- `aa_decisions` would have:
  - `scope CHECK IN ('review')`;
  - `review_id NULL` with `CHECK scope<>'review' OR review_id IS NOT NULL`;
  - `choice NULL CHECK IN ('keep','adjust','later','inconclusive')`;
  - `revision`, `superseded_in_revision`;
  - partial `UNIQUE(review_id) WHERE superseded_in_revision IS NULL`.
- Three distinct states: no row, row with NULL choice, row with `inconclusive`.
- Review subjects: finance:period and project:project only.
- Factors are review-scoped (`review_id`), use `added_in_revision`/`retracted_in_revision`, and are never redacted.

If this lands as previewed, the shape is **designed to be widened** (a `scope` column plus a
nullable parent FK), which is good for M6. It still leaves the choice-vocabulary and factor
seams below.

---

## 6. Exact current code seams (baseline paths)

| Seam | File | Slice 6 action |
| --- | --- | --- |
| model registry | `apps/api/app/models/__init__.py` | add 3 models |
| enums | `apps/api/app/analytics/enums.py` | add `ExperimentLifecycle`, `AdherenceState` (stored), `AdherenceDay` (derived), experiment `DecisionChoice` members/scope (after S4) |
| mixins | `apps/api/app/models/mixins.py`, `aa_semantic.py` | reuse. Observations use `ValuedFactMixin` + `fact_constraints` |
| subjects | `apps/api/app/analytics/subjects.py` | **no change** (pair already registered) |
| idempotency / by-key precedent | `services/aa_facts.py`, `routes/aa_measurements.py:117-146` | copy the pattern |
| guards | `app/security/origin.py`, `security/aa_gate.py`, `dependencies.py` | reuse unchanged |
| local days | `app/analytics/coverage.py` `_local_today` / `classify_days` | reuse the day rule (`day > today` ⇒ future) |
| delta / desire | `app/analytics/delta.py`, `services/aa_desirability.py` | reuse. Result desire stays `neutral` unless grounded |
| export | `apps/api/app/services/export.py` `EXPORT_TABLES` | +3 |
| deletion | `apps/api/app/services/aa_deletion.py` `FACT_TABLES` | + `aa_experiment_observations` (it is a fact table) |
| TRUNCATE | `apps/api/tests/conftest.py` `TRUNCATED_TABLES` | +3 (children before parent, or CASCADE) |
| router mount | `apps/api/app/main.py` | + `aa_experiments.router` |
| queue | `apps/web/src/repositories/analyticsWriteQueue.ts`, `analyticsSyncCoordinator.ts`, `analyticsRepository.ts` | **no change required** (§11) |
| enqueue helpers | `apps/web/src/context/AnalyticsContext.jsx`; request builders modelled on `analytics/projectFacts.ts` | add `analytics/experimentFacts.ts` + context helpers |
| tz helpers | `apps/web/src/analytics/timezone.ts` | reuse. May need `localDaysBetween` |
| primitives | `components/analytics/AAFacts.jsx`, `AADelta.jsx`, `AAQualityStrip.jsx`, `AAProvenance.jsx`, `AAHistoryList.jsx` | adapt inputs (§10) |
| routes | `apps/web/src/app/routes.js`, `App.jsx` | add `experiment` route (flag-gated) |
| locale | `apps/web/src/context/LocaleContext.jsx` | RU + UK strings |

---

## 7. Exact expected future seams (post-Slice-4)

- **`apps/api/app/models/aa_decision.py`** (S4):
  - add `experiment_id` FK → `aa_experiments(id) ON DELETE CASCADE`;
  - widen `scope` to `review|experiment`;
  - add exactly-one-parent CHECK `num_nonnulls(review_id, experiment_id) = 1` tied to `scope`;
  - add partial unique `(experiment_id) WHERE <current>`;
  - make the choice CHECK scope-dependent.
- **`aa_review_factors`** (S4): the factor seam, decided in the Plan (R-2).
- **`AAFactorTag.jsx`** (S4): reused unchanged on the Experiment page.
- **Slice 4 decision enum** (e.g. `ReviewDecisionChoice`): add an Experiment-scope enum.
  **Do not merge the two vocabularies.** `keep` means different things in each scope
  («Оставить как есть» vs «Оставить правило»).
- **`aa_deletion.SOURCE_REDACTORS`**: probably no Slice 6 adapter (see §12).
- **Slice 5 edits** to `aa_comparison.py`/`AADelta.jsx`: rebase onto them if they are merged first.

---

## 8. Data model implications (recommended M6 shape; the Plan finalizes it)

### 8.1 `aa_experiments` (state entity, not a fact; follows the `aa_signal_episodes` precedent)

| column | notes |
| --- | --- |
| `id uuid PK` | **client-minted** UUID v4 (§16), no server default needed |
| `user_id` | FK users CASCADE. `UNIQUE (id, user_id)` for composite child FKs |
| `title text NOT NULL` | trimmed, non-empty, bounded |
| `hypothesis text NOT NULL` | the claim. **Immutable.** The API family has no edit endpoint |
| `hypothesis_recorded_at timestamptz NOT NULL` | plan §10 |
| `intervention text NOT NULL` | frozen «вмешательство» |
| `window_start date, window_end date, timezone text` | `WindowMixin`; `CHECK end ≥ start`; tz ≠ '' (IANA validated in service) |
| `outcome_label text NOT NULL`, `outcome_value_type` (+ `outcome_unit_code`, `outcome_scale_min/max`) | what the result compares. Needed because no sleep/fatigue metric exists in the catalogue (§17 R-4) |
| `lifecycle text NOT NULL DEFAULT 'DRAFT'` | CHECK in the 5 D4 members |
| `started_at`, `start_key` | set on DRAFT→RUNNING |
| `completed_at`, `complete_key` | set on RUNNING→CAR |
| `reviewed_at`, `review_key` | set on CAR→REVIEWED |
| `abandoned_at`, `abandon_key`, `abandoned_from text` | set on →ABANDONED. `abandoned_from ∈ {DRAFT,RUNNING,COMPLETED_AWAITING_REVIEW}` |
| `idempotency_key text NOT NULL` | create key. `UNIQUE(user_id, idempotency_key)` |
| `created_at` | storage only |

Each `*_key` is `UNIQUE(user_id, *_key)` where not null, or a single `UNIQUE` across keys
enforced by the service.

**DB CHECKs: path legality is encoded in the row shape, because each state is entered at most once.**

- `DRAFT` ⇔ all four instants NULL.
- `RUNNING` ⇔ `started_at` set; completed, reviewed and abandoned NULL.
- `COMPLETED_AWAITING_REVIEW` ⇔ started and completed set; reviewed and abandoned NULL.
- `REVIEWED` ⇔ started, completed and reviewed set; abandoned NULL.
- `ABANDONED` ⇔ `abandoned_at` set, reviewed NULL, **and** `abandoned_from` agrees with the shape:
  - DRAFT ⇒ started NULL;
  - RUNNING ⇒ started set, completed NULL;
  - CAR ⇒ started and completed set.
- Ordering: `started_at ≤ completed_at ≤ reviewed_at`; `abandoned_at ≥ coalesce(completed_at, started_at, hypothesis_recorded_at)`.
- Each instant and its key are both-or-neither.

These CHECKs make, for example, "REVIEWED without completion" and "ABANDONED and REVIEWED"
unrepresentable. They cannot stop an UPDATE that rewrites a terminal row into another
*legal* shape. That is the service's job, via the CAS (§8.4). A trigger is **not recommended**:
it adds hidden behaviour, and the service is the single writer.

### 8.2 `aa_experiment_adherence`

- One row per (experiment, local day) that the user actually established. `user_id`,
  `experiment_id` (composite FK `(experiment_id, user_id)` → `aa_experiments(id, user_id)`
  ON DELETE CASCADE), `day date`.
- `state text CHECK IN ('kept','missed','unknown')`. **No `future` member, and no row for future days.**
- Provenance columns via `AAProvenanceMixin`. Default `USER_REPORTED`.
- Supersession and idempotency via the mixins, so a changed mind is a `CORRECTION` chain and
  never an in-place update (no silent history loss).
- Partial `UNIQUE (experiment_id, day) WHERE status = 'active'`.
- **Cross-table rules the DB cannot check** (enforced in the service):
  - `window_start ≤ day ≤ window_end`;
  - `day ≤ local today`;
  - if abandoned: `day ≤ local_date(abandoned_at, tz)`;
  - lifecycle ∈ {RUNNING, COMPLETED_AWAITING_REVIEW}.

### 8.3 `aa_experiment_observations` (shared fact template, plan §7.1)

- `ValuedFactMixin` + `fact_constraints(…)`. Subject = `experiment:experiment:<experiment_id>`
  **and** an explicit `experiment_id` composite FK. The FK is for cascade and ownership. The
  subject is for the generic read and redaction machinery.
- `metric_key NULL` is allowed, because no experiment metrics are catalogued.
- Plus `label text NOT NULL` and `role text CHECK IN ('outcome','context')`.
  - The **outcome** role must match the experiment's `outcome_value_type`/unit/scale. It is
    the result operand.
  - **context** holds interim or supplementary values («энергия утром чаще «нормально»»).
- `occurred_at/occurred_tz` as in `aa_observations`.
- «дней с записью 12 из 14» is **derived** (counted), never stored as an observation.
- «Условия изменились» (conditions): store them as `aa_observations` on subject
  `experiment:experiment:<id>` with `epistemic_kind`, reusing Slice 1 unchanged. This is the
  frozen "наблюдение" tag semantic. Alternatively, a `condition` role on this table. **The
  Plan decides (R-5).**

**Baseline** reuses `aa_baselines` (Slice 1) on subject `experiment:experiment:<id>`, with
its own window, provenance and `DERIVED`/`USER_REPORTED` source kind. **No new table.**

### 8.4 Lifecycle service strategy

`transition(experiment_id, to, occurred_at, key)` works like this:

1. Load the row owned by the user. Missing → 404.
2. If the target state's key equals `key` → replay 200. If that state was already entered
   with a different key → 409 `invalid_transition`.
3. Check that `(current → to)` is in the legal set. Otherwise → 409 `invalid_transition`.
4. Apply the preconditions:
   - `RUNNING→CAR` requires `local_today(tz) > window_end`. Early completion is what
     `ABANDONED` exists for, and the frozen copy says «результат не считается до конца периода».
   - `DRAFT→RUNNING` requires a window and an outcome definition.
5. Run the CAS `UPDATE … WHERE id=:id AND user_id=:u AND lifecycle=:from`. Zero rows → re-read
   → replay or 409.

The DB CHECKs are the backstop.

- **Decision is not a transition.** Recording a decision never changes the lifecycle, and
  REVIEWED may have a NULL choice.
- **`longer`/`modify` never reopen a terminal experiment.** A new attempt is a new experiment.
  An explicit "derived from" link is non-scope.

---

## 9. API implications

The accepted family is reconciled below. Every unsafe route uses `dependencies=[require_json_content_type, require_aa_write_enabled]` (415 before 422), `enforce_same_origin`, and the session user. `user_id` in a body is never trusted. Another account's id → **404** (indistinguishable from missing).

| Route | Body | Result | Errors |
| --- | --- | --- | --- |
| `POST /api/v1/aa/experiments` | `id` (client UUID), title, hypothesis, intervention, window_start/end, timezone, outcome definition, `idempotency_key` (`extra=forbid`) | 201 / 200 replay | 422 `invalid_experiment`; 409 `idempotency_key_reused` (same key, different body); 409 `experiment_id_unavailable` (PK taken by another row; see §16 on oracle risk) |
| `POST /…/{id}/transition` | `to`, `occurred_at` (client action instant), `idempotency_key` | 200 (replay 200) | 404; 409 `invalid_transition`; 422 `window_not_elapsed`/`invalid_time` |
| `POST /…/{id}/adherence` | `day`, `state ∈ kept/missed/unknown`, optional `corrects_idempotency_key` / `corrects_id`, `idempotency_key` | 201 / 200 | 404; 409 `adherence_day_recorded` (active row exists and no correction target); 409 `experiment_not_accepting_evidence` (DRAFT/terminal); 422 `adherence_day_future`, `adherence_day_outside_window`, `adherence_after_stop` |
| `POST /…/{id}/observations` | label, role, value, occurred_at/tz, provenance, key | 201 / 200 | 404; 409 lifecycle; 422 shape mismatch vs outcome definition |
| `POST /…/{id}/decision` | `choice ∈ experiment vocabulary \| null`, key | 201 / 200 | 404; 409 `experiment_not_awaiting_decision` (only CAR or REVIEWED); 422 `invalid_choice` |
| `GET /api/v1/aa/experiments/{id}` | `?timezone&as_of` | detail (§10) | 404 |
| (recommended) `GET /api/v1/aa/experiments` | `?limit ≤ 50` | bounded list for navigation and Slice 7 pending | — |

**The transition `occurred_at` matters.** The queue may replay hours after the action. The
server must not stamp `started_at` or `abandoned_at` with its own receive time. It stores the
client action instant, validated as not in the future beyond a small skew and monotonic with
earlier instants. `recorded_at`/`created_at` stay server truth. Project completion uses the
same pattern.

**`GET` detail returns derived data only, and writes nothing:**
- `adherence`: per-day classification `kept · missed · unknown · not_recorded · future · not_run_after_stop`; `elapsed_count`; `total_days`; counts for each.
- The **coverage report** for outcome observations, kept separate from adherence (coverage ≠ adherence).
- `result`:
  - `state: too_early` (RUNNING/DRAFT → `DeltaUnknown`, rendered «рано судить», with interim values shown);
  - `known` (CAR/REVIEWED with a baseline and an outcome, via `compute_delta`);
  - `no_data`;
  - `not_applicable` (abandoned before completion).
- `desire = neutral` unless explicit grounding exists.
- Lifecycle instants, decision history, and provenance for every fact.

---

## 10. Frontend / product implications

- **`ExperimentPage.jsx`** (route `experiment`, gated by `ANALYTICS_ROUTE_ENABLED` and hidden
  when `ANALYTICS_CLIENT_ENABLED` is false). It follows the existing PageHeader/Hero usage.
- **The Hero is not modified.**
- No demo chrome (`.aa-phone`, `.aa-shell`, `.aa-rail`, `.aa-stage*`). The T-16 grep must stay green.
- **Do not port the frozen `.aa-layers` experiment switcher.** The page shows one experiment by id.
- The frozen eyebrow «эксперимент · будущая возможность» is prototype copy and must not ship.
- **`AAExpStages` (new)**:
  - The frozen status mapping (`draft/running/review/decided`) conflates lifecycle with decision. Production maps from `lifecycle` only:
    - DRAFT → `hypothesis` is current;
    - RUNNING → `run` is current;
    - CAR → `result`/`decision` are current;
    - REVIEWED → all done.
  - **ABANDONED**: stages reached before the stop are done. **The remaining stages are neither `is-done` nor `is-now`.** Add an explicit «прекращён · период не завершён» label.
  - Decision presence never changes the stage.
- **`AAAdherence` (new)**:
  - **Must render real per-day states in calendar order.** The frozen implementation fills
    `kept` cells first and then `missed`. That is a demo shortcut and must not be ported.
  - Add an `unknown`/`not_recorded` cell style. The frozen CSS has only kept/missed/future.
  - Copy «соблюдено X из Y прошедших дней · период N дн.».
  - «Частичное соблюдение — обычное состояние, а не брак данных.»
  - Post-abandon days use the `future` cell style but a distinct accessible label («не проводился»).
- **Reuse**:
  - `AAFacts` for baseline / intervention / period. These are facts, not delta operands, per the README rule.
  - `AAProvenance` for baseline and observation provenance.
  - `AAHistoryList` for the semantic history. It currently expects fact rows, so lifecycle events («Эксперимент начат/прекращён», «Период закончен») need either an adapter to fact-like rows or a small prop extension. **Do not inject HTML strings** like the frozen `what: '<b>…'`.
  - `AADelta` for the result. It needs a `layerNames`/label entry for experiment observation vs baseline, or the detail API returns a `summary`+`comparison` pair it already understands.
  - `AAFactorTag` (Slice 4) for factors.
- **`AAQualityStrip` takes a `CoverageReport`.** Adherence must **not** be passed as coverage.
  Either pass the real observation coverage, or add a separate strip variant for «условия
  изменились · причина не установлена». The Plan decides (R-6).
- **Hypothesis block**: dashed claim labelled «гипотеза · предположение, не факт». It is never
  rendered as a value or a result.
- **No-causality copy**: «Разница — это разница, а не доказательство причины…». No
  recommendation, no score, no suggested decision. «Решение можно не принимать. Эксперимент
  останется в истории.»
- **Decision list**: `keep` «Оставить правило» · `modify` «Изменить условия и повторить» ·
  `longer` «Продлить период» · `reject` «Отказаться» · `inconclusive` «Непонятно — данных
  недостаточно». Also an explicit way to save **without** a decision, which records NULL and
  is distinct from not visiting (§5.3 tri-state).
- **Stop action**: ghost button «прекратить эксперимент» in DRAFT and RUNNING only (D4),
  with a confirm dialog that uses correct modal/focus semantics.
- **RU + UK** for every new string. English is not enabled.
- **Responsive**: `.aa-narrow`, 16px gutters, a wrapped adherence grid, keyboard-operable choice list, reduced motion.

---

## 11. Durable-write implications

- **Every** user-authored Experiment write (create, transition, adherence, observation,
  decision, and baseline/conditions via existing routes) goes through
  `AnalyticsContext.enqueue` (D5). **No ad-hoc fetch.**
- **Dependency ordering is already guaranteed:**
  - Records replay in ascending `queue_id`, single-flight.
  - A dead-lettered or conflicted head **stops** the flush, so a child can never be sent
    after its parent failed.
  - A lost acknowledgement on the parent is retried with the same key → 200 replay before
    any child is sent.
- **The one requirement is an identity known at enqueue time.**
  - With a **client-minted `id`**, every child route (`/experiments/<id>/…`) and the subject
    `experiment:experiment:<id>` (baseline/conditions) can be built immediately.
  - **Server-generated IDs would break this.** The route is frozen at enqueue, so children
    could not be enqueued until the create acknowledgement arrived. That means either
    in-memory waiting (not durable across restart, which violates D5) or a new
    "resolve-route-at-send" queue feature.
  - A fallback that needs no queue change is **by-idempotency addressing**
    (`/experiments/by-idempotency/{create_key}/…`). It mirrors the measurement-correction
    precedent, but it doubles the route surface. **Recommend the client-minted UUID.**
- **No queue schema change and no `payload_schema_version` bump** are needed. `replayQueuedWrite`
  already accepts any `/api/v1/aa/` POST route.
- **Compound UI actions become ordered enqueues.** Example "create + baseline + start": enqueue
  create, then baseline, then transition. Each has its own key.
  - If the page shows optimistic state, it must come from pending queue records, the Project
    pattern of updating after durable enqueue succeeds.
  - **Never** mark the experiment RUNNING in any snapshot. Experiments do **not** live in
    `user_snapshots` (keep persistence separate; snapshot `version`/`schema_version` stay 2).
- **"Save" on the decision step** enqueues the decision (possibly NULL) and then the
  `→REVIEWED` transition. If the decision dead-letters, the head block stops the transition,
  so REVIEWED is never reached with a silently lost decision.
- **409 semantics on replay:**
  - A transition replay with the same key must return **200**, never 409. §8.4 guarantees
    this via the per-state key columns.
  - A genuine `invalid_transition` becomes `terminal_conflict`, which is visible and not dropped.
- **404 → `failed_permanent`** in the coordinator's default branch. A child whose parent does
  not exist is dead-lettered visibly, never silently discarded.
- **T-12 is unchanged**: the snapshot coordinator stays uncoupled.

---

## 12. Export / privacy / delete implications

- **Registries**:
  - `EXPORT_TABLES` +3, `TRUNCATED_TABLES` +3, `models/__init__` +3.
  - Keep `validate_export_registry()` and the schema-guard test green: mapped `aa_*` == export registry == real DB `aa_*` tables (then 13 + Slice 4's 6 + 3).
- **Account deletion**: every new table has `user_id → users ON DELETE CASCADE`. Children also
  have `experiment_id` CASCADE. Extend the zero-residue test (T-15) to the three tables and to
  experiment-scoped `aa_decisions` rows.
- **Per-fact delete** (`DELETE /aa/facts/{table}/{id}`): add `aa_experiment_observations` to
  `FACT_TABLES` (it is a template fact). Adherence rows are supersession-bearing facts too.
  - **Recommend adding them to `FACT_TABLES`** so they are tombstone- and hard-deletable.
    Their value columns differ (`state`), so the Plan must check the generic delete code paths
    for value-column assumptions.
  - `aa_experiments` itself is **not** per-row deletable in this slice. Account deletion covers
    it. Per-experiment deletion is non-scope.
- **Redaction (D1)**: no experiment table freezes copies of other facts' values. The result is
  derived at read time from the live baseline and observations. So a hard-deleted baseline
  simply yields `result: no_data` / «источник удалён», and **no `SOURCE_REDACTORS` adapter is
  needed**.
  - `source_ref` on experiment observations may point at other facts. The existing
    `_redact_provenance` already scans every `FACT_TABLES` model once the observations table is
    registered there.
- **Export content**: include all lifecycle instants, the abandon origin, all adherence rows
  including superseded and tombstoned, and all decision revisions. The manifest revision/table
  list is updated.

---

## 13. Temporal / as-of implications

- The window is **local dates plus an IANA `timezone`**, stored as it was when the experiment
  was created (plan §10.2, travel confounder). **Never a fixed offset** (Slice 2 lesson).
  Tests cover summer and winter Kyiv and DST-boundary windows.
- **Elapsed rule**: reuse `classify_days`. `day > local_today(tz, now)` ⇒ `future`. Today counts
  as elapsed, which matches the frozen running example 20 Aug → 28 Aug = «9 прошедших».
- **Abandon boundary**: `abandon_day = local_date(abandoned_at, tz)`. Days in
  `(abandon_day, window_end]` are derived as `not_run_after_stop`, never counted in the elapsed
  denominator, and never `missed`. The denominator for an abandoned experiment is
  `min(today, abandon_day, window_end) − window_start + 1`.
- **`hypothesis_recorded_at`, `started_at`, `completed_at`, `abandoned_at`** are client action
  instants (§9). `created_at`/`recorded_at` are server truth.
- **As-of reads**: adherence and observations use the existing `apply_as_of` (recorded ≤ T,
  supersession interval). Lifecycle as-of can be derived from the instants: state at T is the
  latest instant ≤ T. It does not need a history table.

---

## 14. Migration implications

- **M6**: a new revision after the *actual* merged M5 (preview: `20260928_0006`, so M6 would be
  `…_0007`). Follow the M4 convention: frozen SQL, a C8 docstring, additive.
- **Creates**: `aa_experiments` (with `UNIQUE(id,user_id)`), `aa_experiment_adherence`,
  `aa_experiment_observations`, and their indexes:
  - `(user_id, lifecycle)` for pending lists;
  - `(experiment_id, day)` partial active;
  - `(user_id, subject_key, recorded_at)` from `fact_constraints`.
- **Alters `aa_decisions`** (the exact DDL depends on the merged M5):
  - `ADD COLUMN experiment_id uuid NULL` with a composite FK → `aa_experiments(id, user_id)` ON DELETE CASCADE;
  - drop and re-add the `scope` CHECK as `IN ('review','experiment')`;
  - add a parent CHECK (`scope='review'` ⇔ `review_id` set and `experiment_id` NULL, and vice versa);
  - **replace the `choice` CHECK with a scope-dependent one**:
    `choice IS NULL OR (scope='review' AND choice IN (<S4 set>)) OR (scope='experiment' AND choice IN ('keep','modify','longer','reject','inconclusive'))`;
  - add a partial unique index for the current experiment decision.

  This is a brief `ACCESS EXCLUSIVE` lock on a small table. It is acceptable per the plan.
- **Downgrade**: disposable/pre-write only (C8). Recreating the narrower `aa_decisions` CHECKs
  is only possible if **no experiment-scoped decision rows** exist.
- **Parent-plan errata to record (not to rewrite)**:
  - The §22 table says the M6 downgrade is possible "only if no row already uses `ABANDONED`".
    It conflates the new `aa_experiments.lifecycle` with the `aa_decisions` scope CHECK.
  - §22 "Enum implications" says adding `ABANDONED` in M6 is `DROP`/`ADD CONSTRAINT`. In fact
    `aa_experiments` is **created** in M6 with `ABANDONED` already in its CHECK. The only CHECK
    swap is on `aa_decisions`.
- `user_snapshots` is untouched. Snapshot version and schema_version stay 2.

---

## 15. Test strategy implications

**Backend** (lifeos_test only):
- `test_aa_experiment_lifecycle.py`:
  - all 6 legal transitions;
  - every illegal pair among the 5×5 states rejected with 409 `invalid_transition`;
  - REVIEWED and ABANDONED terminal (every outgoing transition rejected);
  - replay of the same key → 200, no double-write;
  - concurrent CAS → exactly one wins;
  - the DB CHECK rejects an illegal row shape on a direct insert;
  - `RUNNING→CAR` before the window elapses → rejected;
  - `occurred_at` in the future → rejected.
- `test_aa_adherence.py`:
  - **T-07** future day never missed (write rejected, and the derived day is `future`);
  - elapsed day without a row → `not_recorded`, not missed and not explicit unknown;
  - explicit `unknown` kept distinct;
  - partial adherence (e.g. 6/9) is valid;
  - post-abandon days → `not_run_after_stop`, never missed; writes after the stop are rejected;
  - a correction chain counts once;
  - Kyiv DST, winter/summer, and the window crossing month/year.
- `test_aa_experiments.py`:
  - create idempotency and client id;
  - cross-account 404 on every route;
  - a body `user_id` is ignored or forbidden;
  - 415 before 422 on every POST;
  - write gate closed → 403;
  - **T-08** NULL decision ≠ `inconclusive` ≠ no row;
  - an experiment-scope choice is not accepted in review scope and vice versa;
  - a decision never changes lifecycle;
  - a running experiment's result is `too_early` with interim values present and no final delta;
  - the result delta `desire = neutral` without grounding;
  - hypothesis stored as a claim (no `source_kind` HYPOTHESIS; the enum still lacks it);
  - provenance present on observations and baseline;
  - no causal field anywhere in the schema or response (a grep/assert test, e.g. no `cause`/`because`/`effect_of` keys and no inferred columns).
- **Export/erasure**:
  - the registry guard;
  - the round-trip includes the 3 tables and experiment decisions;
  - account deletion leaves zero residue;
  - hard delete of a baseline → result `no_data`, no residue.
- **M6 migration** up/down round-trip on lifeos_test, plus the schema-guard enum-vs-CHECK test for the new enums.

**Frontend** (`analytics-experiment.test.ts` and component tests):
- request builders (client id, routes, keys at enqueue);
- queue ordering for a create → children chain;
- a head dead-letter blocks children;
- replay after restart (fake-indexeddb) is idempotent;
- `AAAdherence` renders real per-day order, including unknown/not_recorded/future/after-stop, and «X из Y прошедших»;
- `AAExpStages` for all 5 lifecycles, including ABANDONED with no done/current remaining stages;
- the hypothesis label is present;
- the no-causality copy is present;
- no recommendation text;
- RU/UK strings;
- T-16 (no demo chrome);
- the page is hidden when the client flag is off;
- the stop confirm dialog focus behaviour.

---

## 16. Concurrency / idempotency implications

- **Client-minted `id`**:
  - UUID v4 from `crypto.randomUUID()` (the queue already requires it).
  - The server checks `(user_id, idempotency_key)` first (replay), then inserts.
  - A PK collision with **another account's** row is astronomically unlikely by chance. A
    malicious client reusing a known foreign id learns only "unavailable", and experiment ids
    never cross accounts in any response.
  - Return a generic 409 `experiment_id_unavailable` with no data. Document the residual
    existence-oracle risk as accepted and negligible.
  - Alternative with no oracle at all: `PRIMARY KEY (user_id, id)`. **The Plan chooses.**
    Recommendation: global PK plus `UNIQUE(id,user_id)`, for composite FKs and simpler joins.
- **Same key, different payload** → 409 `idempotency_key_reused`, matching the Slice 4 preview.
  The Plan decides whether to compare a payload hash.
- **Transitions**: the per-state key columns plus CAS give exactly-once semantics under
  multi-tab double flush. This holds even without Web Locks.
- **Adherence**: the partial unique `(experiment_id, day) WHERE active` plus
  `UNIQUE(supersedes_id)` means two concurrent writes for one day cannot both be active, and a
  double correction cannot fork.
- **Decisions**: current-decision uniqueness per experiment follows the merged S4 revision model.

---

## 17. Risks / ambiguities / hidden coupling

| ID | Item | Resolution class |
| --- | --- | --- |
| **R-1** | **Choice vocabulary divergence.** Review (frozen) is `keep/adjust/later/(none)`; the S4 preview is `keep/adjust/later/inconclusive`. Experiment is `keep/modify/longer/reject/inconclusive`. A plain CHECK widening would let `reject` onto a Review or `adjust` onto an Experiment | Plan: scope-dependent CHECK (§14). Separate enums per scope |
| **R-2** | **Factor seam.** The frozen page shows «Что могло повлиять» with `AAFactorTag`. The parent plan's M6 widens only `aa_decisions`. The S4 preview scopes factors to `review_id` and does not support experiment subjects for Reviews | Plan, after S4 merge. **Recommended**: widen `aa_review_factors` with the same `scope`/`experiment_id` mechanism in M6 (mirrors decisions, one factor model). **Alternative**: an experiment Review via subject `experiment:experiment` (needs S4 context derivation for experiments; larger). **Not recommended**: a separate `aa_experiment_factors` table (duplicates the concept). Escalate only if the Plan wants a table outside the parent list |
| R-3 | `CAR→ABANDONED` is legal in the API (D4/plan) but the D4 UX puts the stop action only in DRAFT/RUNNING | Implement API legality. UI follows the D4 spec (no stop button in CAR). Not an owner decision: both are specified |
| R-4 | No experiment outcome metrics exist in the catalogue (sleep, fatigue). The frozen result compares a baseline with a period value | Store the outcome definition on `aa_experiments` and user-reported outcome observations (`metric_key NULL`). **No derivation engine and no new catalogued metrics** in Slice 6 |
| R-5 | «Условия изменились»: `aa_observations` (existing, has `epistemic_kind`) vs a role on the experiment observations table | Plan. Recommend `aa_observations` on the experiment subject (reuse) |
| R-6 | `AAQualityStrip` is coverage-only. Adherence must not masquerade as coverage | Plan: pass real coverage, or add a separate strip variant |
| R-7 | Frozen `AAAdherence` fills kept cells first (demo). Frozen `AAExpStages` maps decision into status | Do not port. Production is lifecycle-only, with calendar-true cells |
| R-8 | The queue has no dependency metadata. Correctness relies on FIFO plus head-of-line blocking. A future "skip dead letter" feature would break ordering | Document it as an invariant. Add a test that a child is not sent while its parent head is failed |
| R-9 | Offline replay delays → server-time lifecycle stamps would be wrong | The client sends `occurred_at` (§9) |
| R-10 | Plan §22 errata (the ABANDONED/downgrade wording) | Record in the Slice 6 Plan. Do not edit the frozen plan |
| R-11 | Slice 5 is parallel and may edit `AADelta.jsx` / `aa_comparison.py` | Re-verify and rebase at Plan time |
| R-12 | Slice 7 needs a pending query using the allow-list `{DRAFT,RUNNING,CAR}` | Expose `GET /experiments` with a lifecycle filter. T-09 lands in 6/7 |

---

## 18. What MUST be re-verified after predecessor merge

1. The Slice 4 merge commit is on `main` and `alembic heads` is a single head equal to M5's
   real revision id. Set M6 `down_revision` to it.
2. The exact `aa_decisions` DDL:
   - column names (`scope`, `review_id`, `choice`, revision columns);
   - CHECK constraint **names** (needed for DROP);
   - the choice members;
   - the current-decision uniqueness mechanism;
   - how "no decision" (row with NULL) is represented;
   - whether the `inconclusive` review member landed.
3. The Slice 4 enum names (`DecisionScope`, `ReviewDecisionChoice`, …) and the schema-guard test mechanics for scope-dependent CHECKs.
4. The `aa_review_factors` shape and whether Review subjects can include `experiment:experiment`. This decides R-2.
5. The Slice 4 parent/child ownership convention: composite FK or plain FK plus service check. Match it.
6. The `SOURCE_REDACTORS` adapter signature, and whether any S4 redaction code assumes decisions are review-only.
7. The `AAFactorTag.jsx` props and RU/UK keys.
8. `EXPORT_TABLES` / `TRUNCATED_TABLES` / `FACT_TABLES` contents and counts after S4 (and S5 if merged).
9. Any change to `analyticsSyncCoordinator` failure classification or head-blocking behaviour.
10. The Slice 5 changes to `AADelta.jsx`, `aa_comparison.py` and `routes.js`/`App.jsx`, if Slice 5 merged first.
11. The master context's recorded state and the report list.
12. The recovery stash `51184836…` is retained and the design tag is unmoved.

---

## 19. Owner decisions

**None required.**
- D4 already fixes ABANDONED and its UX delta.
- D5 fixes the queue.
- The parent plan fixes the tables, lifecycle, transitions and the nullable orthogonal decision.

All open items (R-1…R-12) are engineering choices for the Plan or re-verifications. The only
item that *could* escalate is R-2, if the Plan chooses a factor table outside the parent plan's
table list. The recommended option avoids that.

---

## 20. Implementation-planning readiness

- A **provisional** Slice 6 Plan can be drafted now. It would cover the M6 tables for
  experiments/adherence/observations, the lifecycle DB+service strategy, the queue/ID strategy,
  the API, frontend, tests and export/delete.
- It **cannot be finalized, and implementation cannot start**, until Slice 4 merges. The
  `aa_decisions` alteration DDL, M6's `down_revision` and the factor seam depend on the merged
  shape.
- The Plan must also rebase over Slice 5 if it merges first.

### Required explicit outputs

```
DECISION_DEPENDENCY_ON_SLICE_4=HARD — aa_decisions (and aa_review_factors / AAFactorTag) are created by Slice 4 M5; M6 must ALTER them; exact DDL, constraint names, choice set and revision model UNKNOWN_UNTIL_PREDECESSOR_MERGES
QUEUE_CAN_SUPPORT_COMPOUND_EXPERIMENT_WRITES=YES — strict FIFO + single-flight + head-of-line blocking on failed_permanent/terminal_conflict + enqueue-time keys; no queue change required, given client-known experiment identity
CLIENT_GENERATED_ID_STRATEGY_VIABLE=YES — client-minted UUID v4 experiment id sent in create payload; server replays by (user_id, idempotency_key), guards PK collision with generic 409; server-generated ids would force non-durable waiting or a new resolve-at-send queue feature (fallback: by-idempotency routes, existing precedent)
M6_EXPECTED_TABLES=aa_experiments, aa_experiment_adherence, aa_experiment_observations (+ ALTER aa_decisions: experiment_id FK, scope CHECK, scope-dependent choice CHECK, experiment current-decision uniqueness; aa_review_factors scope widening only if Plan adopts R-2 recommendation)
LIFECYCLE_DB_CONSTRAINT_STRATEGY=TEXT+CHECK lifecycle members; per-state instant+idempotency-key columns (each state entered at most once — DAG) with row-shape CHECKs making every illegal path unrepresentable, abandoned_from consistency CHECK, instant ordering CHECKs; no trigger
LIFECYCLE_SERVICE_STRATEGY=service is the single writer: owner-scoped load → same-key replay 200 → legal-edge table → preconditions (RUNNING→CAR only after window_end elapsed in experiment tz; client occurred_at validated) → predicate CAS UPDATE WHERE lifecycle=:from → 409 invalid_transition; decision never mutates lifecycle
FUTURE_DAY_STORAGE_STRATEGY=never stored; adherence rows only for elapsed local days (day ≤ local today in experiment IANA tz, within window); future derived at read time via classify_days rule (day > today); writes for future days rejected 422
POST_ABANDON_ADHERENCE_STRATEGY=abandon_day = local date of client-supplied abandoned_at in experiment tz; days after it are derived not_run_after_stop (future-styled cell, distinct a11y label), excluded from elapsed denominator, never missed; adherence writes after abandon_day rejected; pre-abandon rows retained
SLICE_6_PLAN_CAN_BE_DRAFTED_BEFORE_SLICE_4_MERGE=YES
EXACT_ITEMS_TO_REVERIFY_AFTER_SLICE_4_MERGE=M5 revision id/single head; aa_decisions columns + CHECK names + choice set + NULL/no-row representation + current-decision uniqueness; Slice 4 enum names & schema-guard mechanics; aa_review_factors shape & review subject support (R-2); parent/child FK ownership convention; SOURCE_REDACTORS adapter contract; AAFactorTag props & locale keys; EXPORT/TRUNCATE/FACT registries; coordinator failure classification; Slice 5 edits to AADelta/aa_comparison/routes if merged; master context state; recovery stash & design tag
```

---

```
DISCOVERY_STATUS=PASS
BASELINE_SHA=ea3a75e1acc5a5b4ef9e3b3a285e3dfeeb8ff9ef
OWNER_DECISION_REQUIRED=NO
PREDECESSOR_MERGE_REQUIRED_FOR_DISCOVERY=NO
PREDECESSOR_MERGE_REQUIRED_FOR_PLAN=YES
PLAN_CAN_START_NOW=YES
PLAN_MUST_REVERIFY_AFTER_MERGE=YES
PRODUCTION_FILES_CHANGED=NO
GIT_BRANCH_CHANGED=NO
COMMIT_CREATED=NO
PR_CREATED=NO
```

Note on `PREDECESSOR_MERGE_REQUIRED_FOR_PLAN=YES` together with `PLAN_CAN_START_NOW=YES`: a
provisional draft can start now, but finalizing the Plan (`IMPLEMENTATION_READY=YES`) requires
Slice 4 to be merged.
