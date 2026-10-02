# LifeOS Adaptive Analytics — Slice 1 implementation

Acceptance: **PASS**. Shared semantic contracts and domain-neutral primitives only.
Publication: one implementation commit and an open PR for owner review; no merge is authorized.

## Exact starting state

- Worktree: `/Users/yurasachenko/LifeOS/LifeOS-adaptive-analytics-slice-1`.
- Branch: `feat/adaptive-analytics-slice-1`.
- Clean HEAD and `origin/main` before implementation: `335c18a54d7e0a256fe83a01589d059f6b9e00ee`.
- Slice 0 ancestor: `b19b7019a46c68c324087d16724735507a5bd597`.
- Slice 0b ancestor: `2205c3e7f589f1a72fda67d335612a6971c7af92`.
- Design tag: `adaptive-analytics-design-accepted`, peeled target `d4960286ec94f35472600e59c0d533dc50a64351`, annotated object `6c507b829ebc4a2a1e5b1b353db04c1a29302be0`.
- No existing remote Slice 1 branch or unexpected local worktree changes at start.
- Read-only remote recheck before publication: main remains the exact starting SHA; both tag SHAs remain unchanged; remote Slice 1 branch absent.

## Authoritative sources inspected

All paths below are repository-relative except the owner request and skill.

- Owner implementation request: `/Users/yurasachenko/.codex/attachments/9768e923-2968-4e3a-9534-42f1426df654/pasted-text.txt` (complete).
- `Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md`: accepted decisions and constraints, shared fact/subject/value/temporal/privacy contracts, C7 ownership, coverage, API, graph, Slice 1, migrations, tests, rollout and non-scope.
- `Outputs/Discoveries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md`: relevant technical/semantic/privacy findings.
- `Outputs/Implementations/lifeos-pre0-development-baseline_20260908-140841.md`.
- `Outputs/Implementations/lifeos-adaptive-analytics-slice-0_20260908-145309.md`.
- `Outputs/Implementations/lifeos-adaptive-analytics-slice-0b_20260916-235514.md`.
- Actual merged models, mixins, enums, schemas, services, routes, M1/M2 migrations, export registry, delete behavior, test cleanup/guards and regression tests.
- Existing frontend API, test configuration, dependencies and product architecture.
- `ui_kits/life-os-analytics/README.md`, `analytics.css`, relevant primitive implementations and accepted C gallery in `screens.jsx`.
- React performance skill `/Users/yurasachenko/.codex/plugins/cache/claude-plugins-official/vercel/0.49.2/skills/react-best-practices/upstream/SKILL.md` and applicable direct-import/state-update rules. Applied as direct component imports, cheap render-time derivation and interaction-only state; no extra framework or provider.

No frozen kit, preview, Plan, Discovery or completed implementation report was modified.

## Environment and pre-change baseline

- Python 3.11.15 in a fresh local `apps/api/.venv`; pinned development lock installed with hash verification. No package upgrade or lockfile edit.
- Node 22.20.0 / npm 11.11.0; `npm ci` using the existing lock. No new frontend dependency.
- npm reported five inherited audit findings (three moderate, two high). No audit-fix or unrelated dependency migration was attempted.
- Existing PostgreSQL 18.3 was already running. No database/server service was started by this task.
- Only local disposable database `lifeos_test`, via `postgresql+psycopg://yurasachenko@127.0.0.1:5432/lifeos_test`, was used. No development or production database access.
- Test bootstrap token was a non-production dummy supplied only to commands; no environment file was created or edited.

Baseline completed before implementation writes:

| Check | Baseline |
| --- | --- |
| pytest | 143 passed, 4 warnings, 20.23s |
| Ruff | PASS |
| Alembic heads/current | `20260909_0003`, one head |
| Vitest | 45 passed, 9 files |
| Typecheck / lint / build | PASS / PASS / PASS |

Baseline production bundle: 82 modules; CSS 124.84 kB (gzip 21.81 kB); JS 399.24 kB (gzip 113.65 kB), map 986.79 kB.

## M3 and exact new tables

Migration: `apps/api/alembic/versions/20260910_0004_aa_semantic_comparison.py`.
Revision `20260910_0004`; down revision `20260909_0003`; single Alembic head.
Frozen migration DDL does not import mutable ORM implementations.

Exactly eight tables added:

1. `aa_expectation_versions`
2. `aa_forecast_versions`
3. `aa_baselines`
4. `aa_targets`
5. `aa_preferences`
6. `aa_observations`
7. `aa_metric_policy_versions`
8. `aa_metric_membership_overrides`

Common storage mixins reuse account ownership, provenance, subject identity, idempotency and supersession infrastructure, not concept semantics. Each concept retains separate storage and a concept-specific write schema. All account-owned tables have `users` deletion cascades; metric references retain catalogue FKs. Window order, value shape, enum domains, lifecycle and privacy-erased shapes have database checks. M3 does not alter pre-AA or Slice 0/0b tables.

## Semantic, temporal and versioning contracts

- Expectation is an effective versioned reference for a declared date window and timezone.
- Forecast is a versioned forecast with a checkable `horizon_at`. Its value may itself be a date, separately from that horizon. No Actual discriminator, `occurred_at` or event fields can enter this contract.
- Baseline is independently captured window-scoped reference evidence, not a target or expectation revision.
- Target is an explicit normative value or an explicitly absent target. Zero, absence and no row remain distinguishable.
- Preference is an explicit normative statement/direction with effective time; it has no scalar value columns masquerading as Actual evidence.
- Observation is a separately labelled subjective observation with occurred time/timezone and epistemic kind (`observed`, `mine`, `maybe`, `unknown`). Explicitly unknown value availability is distinct from epistemic kind and from no observation row.
- Server-controlled `recorded_at`, expectation/preference/policy `effective_from`, forecast horizon, window dates, scalar date value and observation occurred time are not substituted for one another.
- New version insertion preserves prior value/content columns; only prior lifecycle/supersession metadata changes. Revision links are distinct from inherited Actual correction links.
- Per-account/table/metric/subject/window/source-fact advisory transaction locks serialize first insert and revision. Idempotency is checked again under the lock. Concurrent tests prove no fork and stable replay (201 new / 200 replay).
- Future-effective revisions leave prior versions visible before their effective transition. Backward effective transitions are rejected with `effective_order_conflict` (409), not silently rewritten.
- Historical/as-of reads use captured provenance and supersession time. No snapshot substitution or backdated legacy policy reconstruction.

## Corrected C5, C6 and C7

C5: `ValueType` remains exactly money/date/duration/count/scale/categorical. There is no unknown scalar type, no missing placeholder row and no fake zero. Missing operands produce read-only derived-unknown delta. Explicit absent Target and explicit unknown Observation retain a known scalar shape (metric catalogue, or `declared_value_type` without a metric); value columns are empty only in those intentional states or after tombstoning.

C6: coverage is reconstructed from explicit source-coverage claims, never scalar row presence. Fully observed, partial, missing, unknown coverage and future buckets remain separate. A fully observed empty period is not automatically a persisted zero. Quality statistics were constrained to the requested occurred-time window and knowledge/as-of cutoff so future recordings/corrections cannot leak into historical quality. Partial evidence suppresses premature delta; no normative grounding still means neutral desirability.

C7 foundation is assigned locally and implemented now:

- Versioned metric policy stores bounded category-exclusion rules and include/exclude default with effective and recorded times.
- Versioned per-fact membership override has typed `aa_measurements` source FK and active/history indexes. This slice supports the existing measurement source, not speculative future source tables.
- Resolver priority is captured override, captured effective policy, then immutable `dimensions.included_by_default` captured on the source measurement.
- Category matching uses the existing immutable `category_id`, not current snapshot categories.
- An exclusion policy with uncaptured category dimensions yields unknown membership, not a fabricated category match. Uncaptured policy is `policy_known=false`; captured default may still be reported with its basis. Before source knowledge, membership is unknown.
- Legacy policy with unknown original recording begins at capture, never retroactively at a guessed historical time.
- Service-level ownership checks reject another account's source fact. Source hard-delete cascades typed overrides and redacts provenance references to their IDs before removal.
- Policy/override writes and membership resolver are internal service contracts in Slice 1, not new user-facing Finance routes or aggregation pipeline.

## Value legality, delta and desirability boundary

- Shared backend boundary and frontend mirrors accept the same six scalar shapes and reject forbidden fields, non-finite numbers and lossy `numeric(20,6)` storage input.
- Frontend arithmetic uses fixed-point BigInt, not floating-point subtraction. Derived delta may exceed an operand's storage range without being incorrectly revalidated as a new persisted value.
- Money requires the exact same currency; no FX conversion. Duration uses canonical minute; count requires matching unit; scale requires matching bounds and unit. Cross-type/unit comparisons fail explicitly.
- Date minus date is duration in canonical minutes; display may show days. Category has juxtaposition only, never fabricated numeric delta.
- Missing operand is derived unknown; incompatible delta is not applicable with stable reason. Both are read-only.
- Desirability service accepts Actual value plus explicit normative grounding only (Target, Preference or reserved future Decision kind). It has no Expectation/Forecast/delta/sign/materiality dependency or input.
- Actual against explicit Target may produce favorable/unfavorable/neutral. Preference grounds against captured Baseline, never against Expectation.
- With no normative grounding, positive/negative/equal differences remain neutral. Forecast/subjective interpretation is never passed as Actual. Targets for a different reference period/timezone do not ground that comparison.
- Frontend displays grey unknown for a derived-unknown delta; this display tone does not rewrite the backend's neutral ungrounded desirability. Numeric sign alone does not assign colors or score.
- Structural T-01 dependency tests and T-02 forecast/storage tests permanently guard these boundaries.

## API and security

Authenticated, origin-checked, JSON-only, default-gated POST endpoints at `/api/v1/aa/`:
`expectations`, `forecasts`, `baselines`, `targets`, `preferences`, `observations`.
Six explicit payloads, no generic semantic-kind POST and no client-supplied `user_id`.
Strict extra-field rejection and stable errors; target must supply exactly a value or explicit absence.

Authenticated read-only endpoints:

- `GET /api/v1/aa/subjects/{key}/summary`: typed separate Actual/E/F/B/Target/Preference/Observation layers, concept/ID-linked comparisons, optional as-of/metric filter, bounded scan (200 per layer) and explicit truncation. Latest visible row per concept/metric in this summary is not a domain total; complete ranged revisions remain in history.
- `GET /api/v1/aa/subjects/{key}/coverage`: explicit ordered date range (maximum 3661 days), IANA timezone and optional aware as-of cutoff.
- Existing metric history gains independent E/F/B layers, layer selection and opaque `(recorded_at,id)` cursors; Actual retains `(occurred_at,id)` cursor contract. Wrong temporal cursor kind and naive timestamps are rejected rather than bridged silently.
- Existing provenance endpoint recognizes all ten supported fact tables, including policy/override records; account-scoped queries conceal cross-account existence identically to missing facts.

Reads are not collection-gated. All six new writes reuse the unchanged write gate. Default remains closed; production opt-in remains refused by the inherited configuration. No gate/environment configuration was changed.

## Export, deletion and test cleanup

- Strict explicit export registry now contains all twelve AA tables (four inherited, eight new). Metadata/database/registry equality stays fail-closed; no permissive subset fallback.
- Account-scoped read-only export includes new rows and lifecycle states. Existing limits, manifest, atomic export checks and snapshot behavior are preserved.
- All eight tables join per-fact deletion and account deletion coverage. Tombstone erases scalar content/dimensions, Preference statement/direction, policy JSON, override membership and private provenance content as applicable.
- Hard deletion preserves chain-safety conflicts and contentless receipt semantics. Cross-table nested source references are redacted; typed membership dependents cascade with reference redaction.
- Existing registry-driven account cascades are tested for every new table and account isolation.
- Test cleanup lists every new owned table explicitly; schema completeness/cascade guards now cover all mapped AA tables. No test accidentally truncates seeded metric catalogue data.

## Frontend primitives and frozen C evidence

- `AADelta`: API concept/ID-linked operands, descriptive neutral difference, exact scalar/date formatting, forecast label/dashed state, partial/no-data state and explicit normative grounding only.
- `AAFacts`: layout reuse for separate concept facts, no delta/desirability interface; unknown/absent/deleted/Preference content remains honestly labelled.
- `AAProvenance`: native keyboard disclosure, four secondary provenance rows, unknown original recording note, desktop popover / explicit narrow bottom-sheet, Escape/close trigger focus restoration. No global listeners or HTML injection.
- `AAQualityStrip`: explicit coverage summary/details, separate buckets, estimated/corrected counts and legacy recording uncertainty.
- `AAHistoryList`: escaped content, concept labels, immutable old→new values, revisions versus corrections, effective/horizon dates and secondary provenance.
- `src/analytics.css` ports only primitive styles, tokens and responsive behavior, adding focus visibility. No demo shell, phone, rail, stage or speculative future product styles.
- Recursive permanent demo-chrome guard scans every product-source file and is part of the normal frontend suite plus an explicit run.
- Root shared fixture provides all seven accepted C cases to real backend API contract tests and frontend realistic API-shaped render tests: neutral negative money, neutral positive money, date delay, duration comparison, partial/early judgment, forecast-only and no facts/no data. Real UUID/concept/table/value/provenance shapes are used in the render proofs.
- C monetary fixtures exercise generic scalar comparison, not a fabricated monthly finance sum. No Finance aggregation/pilot or product page is connected in Slice 1.
- No provider/context, persistence bridge or offline queue. Unconnected primitives do not alter the existing product bundle or snapshot domain.

## Migration verification and C8

On empty disposable AA history in `lifeos_test`, permanent tests verify M2→M3, M3→M2, then M2→M3. Exactly eight tables disappear/reappear; pre-AA users/sessions/user_snapshots and Slice 0/0b table columns remain unchanged. ORM/database columns and named checks agree; enums match the central domains. Final current/head is `20260910_0004`, one head.

The inherited M2 round-trip now restores the original current revision so its existing proof cannot strand the suite below M3. Its old preservation assertions remain intact.

C8 remains binding: once personal AA history exists in production, rollback is non-destructive behavioral rollback (disable/roll back behavior), not schema/history destruction. Tested downgrade is for disposable empty test data only, not a production rollback recommendation.

## Final validation

| Check | Final result |
| --- | --- |
| Complete pytest suite | **242 passed, 7 warnings, 32.80s** |
| Ruff check | **PASS** |
| Alembic heads/current | **`20260910_0004` / `20260910_0004`, one head** |
| Complete Vitest suite | **76 passed, 11 files, 1.23s** |
| Typecheck | **PASS** |
| ESLint | **PASS** |
| Production build | **PASS**, 82 modules |
| Explicit demo-chrome guard | **1 passed, 1 file, 129ms** |
| Explicit schema/export/M3 round-trip tests | **40 passed, 5 warnings, 4.25s** |
| `git diff --check` | **PASS** |

Permanent additions contribute 99 backend cases and 31 frontend cases beyond baseline. Old Slice 0/0b, export/privacy, auth, state isolation/revision and snapshot tests remain green.
Warnings are inherited Starlette/httpx deprecation advice and Alembic `path_separator` configuration deprecation, repeated by added migration checks; no dependency upgrade was authorized.
Final existing product bundle remains CSS 124.84 kB (gzip 21.81 kB), JS `index-CTYrT0nU.js` 399.24 kB (gzip 113.65 kB), map 986.79 kB: primitives are not wired into product routes.

## Changed paths (49 including this report)

### Added (32)

- `Outputs/Implementations/lifeos-adaptive-analytics-slice-1_20260918-165431.md`
- `apps/api/alembic/versions/20260910_0004_aa_semantic_comparison.py`
- `apps/api/app/models/aa_semantic.py`
- `apps/api/app/models/aa_expectation_version.py`
- `apps/api/app/models/aa_forecast_version.py`
- `apps/api/app/models/aa_baseline.py`
- `apps/api/app/models/aa_target.py`
- `apps/api/app/models/aa_preference.py`
- `apps/api/app/models/aa_observation.py`
- `apps/api/app/models/aa_metric_policy_version.py`
- `apps/api/app/models/aa_metric_membership_override.py`
- `apps/api/app/schemas/aa_comparison.py`
- `apps/api/app/schemas/aa_subjects.py`
- `apps/api/app/services/aa_comparison.py`
- `apps/api/app/services/aa_desirability.py`
- `apps/api/app/services/aa_metric_policy.py`
- `apps/api/app/services/aa_subjects.py`
- `apps/api/app/routes/aa_comparison.py`
- `apps/api/app/routes/aa_subjects.py`
- `apps/api/tests/test_aa_semantic.py`
- `apps/web/src/analytics.css`
- `apps/web/src/analytics/values.ts`
- `apps/web/src/analytics/delta.ts`
- `apps/web/src/analytics/labels.ts`
- `apps/web/src/components/analytics/AADelta.jsx`
- `apps/web/src/components/analytics/AAFacts.jsx`
- `apps/web/src/components/analytics/AAProvenance.jsx`
- `apps/web/src/components/analytics/AAQualityStrip.jsx`
- `apps/web/src/components/analytics/AAHistoryList.jsx`
- `apps/web/src/test/aa-semantic-primitives.test.jsx`
- `apps/web/tests/aa-demo-chrome.test.js`
- `tests/fixtures/aa_c_variants.json`

### Modified (17)

- `apps/api/app/analytics/enums.py`
- `apps/api/app/analytics/values.py`
- `apps/api/app/analytics/delta.py`
- `apps/api/app/models/__init__.py`
- `apps/api/app/main.py`
- `apps/api/app/routes/aa_measurements.py`
- `apps/api/app/routes/aa_history.py`
- `apps/api/app/schemas/aa_measurement.py`
- `apps/api/app/services/aa_coverage_claims.py`
- `apps/api/app/services/aa_deletion.py`
- `apps/api/app/services/export.py`
- `apps/api/tests/conftest.py`
- `apps/api/tests/test_aa_m2_migration.py`
- `apps/api/tests/test_aa_schema_guards.py`
- `apps/api/tests/test_export.py`
- `apps/web/src/api/analytics.ts`
- `apps/web/vite.config.js`

## Plan alignment and disclosed implementation choices

No accepted semantic boundary or assigned Slice 1 deliverable was removed. Concrete choices resolving unspecified implementation detail:

- Shared read representation is explicitly concept/table-labelled while write schemas/storage remain separate; there is no generic kind write boundary.
- Explicit value-free Target/Observation states use optional declared shape without a metric, not an unknown ValueType. Storage validates privacy-erased content separately.
- Summary is bounded latest-per-metric/concept with a truncation flag, not a new aggregation engine; ranged history carries full versions and independent temporal cursors.
- C7 source FK is restricted to existing measurement facts, plus a historical index in addition to the active lookup index. Policy/override services have no speculative public endpoint.
- Shared numeric input validation rejects otherwise silently rounded PostgreSQL inputs; exact frontend arithmetic mirrors that storage legality while allowing larger derived differences.
- Window/as-of filtering of inherited quality statistics is a necessary correction for the new historical subject contract, with regression proof rather than a new coverage definition.
- Frontend native disclosure replaces harness-specific interaction plumbing; only primitive CSS is ported. The external test directory keeps prohibited class literals out of product source while permanently scanning it.
- M2 test restores the entry revision rather than hardcoding M2; no historical migration/report is rewritten.

## Scope and acceptance

PASS: exact starting state; one M3 head; eight distinct tables; Actual/Forecast separation; T-01/T-02; Target absent/zero/missing; C5/C6/C7; temporal/version/replay concurrency; all seven C proofs; scalar/delta parity; export/deletion/isolation; demo exclusion; unchanged production gate; unchanged snapshots; complete old/new tests and static/build checks.

Not implemented: Finance Analytics/pilot, monthly money aggregation, MoneyWidget integration, IndexedDB queue, sync coordinator, AnalyticsProvider/Context, application analytics routes/pages, Home signals/rules, Reviews, Decisions, Projects, Experiments, Trade-offs, System Review, retention settings, global or cross-unit score, Slice 2, Slice P, deployment. `LifeDataContext` and frozen artifacts are unchanged. No fake-indexeddb or new dependency.

Only local disposable test data and ignored environment/build outputs were used. No main mutation, force push, history rewrite, tag move, application runtime, development/production DB access or deploy. Owner review/acceptance is the next step; PR must remain open and unmerged.
