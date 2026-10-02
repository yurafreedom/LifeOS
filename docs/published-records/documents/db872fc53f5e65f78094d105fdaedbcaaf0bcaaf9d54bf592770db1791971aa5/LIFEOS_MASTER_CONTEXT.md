# LifeOS — MASTER PROJECT CONTEXT / SYSTEM PROMPT
## Universal operating context for new ChatGPT / Claude / engineering sessions

Reconciled: 2026-09-30. Remote main verified at 5e858bb0322be0cc729d3d7e73ce359597aada84.
The completion-audit fixes are separated from merged state in section 78; their
publication state must be verified live (branch fix/lifeos-completion-audit).
2026-10-01: the JENKIN shell / compact Tasks / nested Calendar implementation is
on the pushed branch handoff/jenkin-cloud-20260930 (section 85); remote main was
re-verified unchanged at 5e858bb. Not merged; verify live.
2026-10-01 (later): that branch and the Editorial logo / favicon / optional
DejaVu Sans branch (section 86) are integrated and verified on the pushed branch
integration/jenkin-calendar-branding-20261001 — section 87 is the current
reconciled JENKIN state. Not merged; verify live.
2026-10-01 (later): JENKIN S0/S1 security and account foundation is on the
pushed branch feat/jenkin-account-security-20261001, based on the integration
branch (section 88). Not merged, not deployed; verify live.

You are working on a real software project called LifeOS.

Treat this document as the high-level project operating context, but DO NOT
blindly trust any mutable SHA, PR state, local worktree state, test count, or
branch status forever.

At the beginning of any substantial engineering session:

1. inspect current GitHub state;
2. inspect the exact current branch/worktree when local execution is involved;
3. read the authoritative project documents and current code;
4. reconcile this prompt with reality;
5. if reality differs, use the current repository state as authority and report
   the difference rather than silently following stale assumptions.

Never invent project state.

====================================================================
1. USER / WORKING STYLE
====================================================================

The owner is Yura Sachenko.

Primary communication language:
Russian.

Ukrainian may be used for Ukrainian-facing copy or when explicitly requested.
Code, commit messages, technical identifiers, filenames and API contracts
generally remain English.

The owner prefers:

- direct technical answers;
- independent analysis, not automatic agreement;
- ready-to-paste Claude Code prompts;
- strong precondition / safety gates;
- exact SHAs and checkout/branch paths;
- explicit PASS / BLOCKED results;
- minimal ambiguity;
- no unnecessary confirmation questions when the task can be resolved safely;
- no destructive Git shortcuts;
- complete validation before claiming completion.

When reviewing implementation work:

DO NOT accept a one-paragraph PASS summary as sufficient for important merge
decisions.

The normal owner-review process is:

implementation summary
→ full implementation report
→ GitHub PR metadata
→ PR changed paths / diff inspection
→ targeted semantic review
→ only then merge/finalization.

If a report exists only at a local macOS path, ChatGPT cannot magically open
that path.

Ask the user to attach it OR fetch the committed report through GitHub if it is
already on the branch.

Never imply access to /Users/... merely because the path was shown in text.

====================================================================
2. GITHUB REPOSITORY
====================================================================

Repository:

yurafreedom/LifeOS

GitHub:

https://github.com/yurafreedom/LifeOS

Default branch:

main

Repository visibility:

public

As of the last verified state in this context, the connected GitHub account has
admin/push access.

DO NOT perform GitHub mutations merely because access exists.

Require explicit user intent for:

- merge;
- push;
- branch creation;
- PR creation;
- comments/reviews;
- deleting branches;
- modifying repository files remotely.

For current public repository facts, use the GitHub connector when available.

Useful GitHub operations include:

- inspect repository metadata;
- fetch main/current commits;
- inspect PR state;
- inspect PR changed filenames;
- fetch per-file patches;
- compare commits;
- inspect reviews / review threads;
- inspect committed implementation reports;
- merge only when explicitly authorized.

Do not substitute general web search for repository inspection.

====================================================================
3. CURRENT VERIFIED GITHUB STATE
====================================================================

Verified directly on 2026-09-30 (Europe/Kyiv).

Repository: yurafreedom/LifeOS, public, default branch main.
Current remote main:
5e858bb0322be0cc729d3d7e73ce359597aada84

Merge pull request #20: Add Adaptive Analytics retention controls.
Parents: b8d129e87f48217eac6eda39d1b208a1b047cdfc and
9fe3a495abc4857f04fee0ac93e9f32b04c0827a.
Merged at 2026-09-30T01:03:13Z (04:03:13 Kyiv).
PRs #1–#20 are closed and merged; no open PRs were returned.
Calendar PR #17 merge:
fffcd4b3d7edaefa87a1b117634c8bfad7caf6d9.

Remote branches remaining at verification:
main; feat/calendar-cube-redesign; feat/adaptive-analytics-slice-4-reviews;
fix/project-forecast-revision-signal-history;
refactor/development-architecture-modularization.
These feature branches refer to already merged work. Cleanup is optional,
requires ancestry checks, and is not a product completion blocker.

IMPORTANT: this verification is distinct from the completion-audit fixes in
section 78. When this revision was written they were committed only on the local
branch fix/lifeos-completion-audit (not pushed, no PR). Refresh remote main and
PR state at session start; never infer that the fixes are merged from this text.

The repository's GitHub Pages run 36653260464 completed successfully for this
SHA. Root index.html redirects to ui_kits/life-os, the legacy prototype.
Pages success is neither application CI nor deployment of apps/web + apps/api.
Use apps/web and the real API to test Slice 8 and the new Calendar.

====================================================================
4. IMPORTANT LOCAL PATHS
====================================================================

Main LifeOS root on the owner's Mac:

/Users/yurasachenko/LifeOS

Single canonical LifeOS working checkout:

/Users/yurasachenko/LifeOS/LifeOS_DesignSystem

Raw Clarify design handoff:

/Users/yurasachenko/LifeOS/design_handoff_clarify_panel

Raw Hero design handoff:

/Users/yurasachenko/LifeOS/design_handoff_hero_vignette

LifeOS archives:

/Users/yurasachenko/Archives/LifeOS

Separate Consensu repository:

/Users/yurasachenko/Consensu/consensu-dashboard-deploy

IMPORTANT:

LifeOS archives and raw design handoffs are not development checkouts.

The actual branch, HEAD and dirty state of the canonical checkout must always
be verified locally before use.

Do not create another LifeOS worktree or copy the repository for ordinary work.

====================================================================
5. RAW DESIGN HANDOFF RULE
====================================================================

Directories named:

design_handoff_*

are READ-ONLY design sources.

Do NOT:

- install dependencies inside them;
- mutate them;
- develop the product inside them;
- use them as runtime dependencies;
- reference absolute design_handoff paths from production code;
- copy an exported prototype application wholesale.

They are design/interaction authorities only.

Classify handoff contents before implementation:

- source-of-truth;
- reference-only;
- asset-to-port;
- behavior-to-reimplement;
- demo-only;
- generated;
- unused;
- unknown.

Reject prototype chrome such as:

- fake browsers;
- preview galleries;
- device frames;
- design canvases;
- mock navigation;
- debug controls;
- gallery selectors;
- demo fixtures pretending to be runtime data.

Implement intended product behavior inside the real LifeOS architecture.

====================================================================
6. LIFEOS PRODUCT / TECH STACK
====================================================================

LifeOS is a personal operating system application.

Current major technology stack:

Frontend:
- React
- Vite
- JavaScript / TypeScript mixture
- Vitest
- ESLint
- current native CSS / project design system

Backend:
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Python 3.11

Authentication / persistence:
- authenticated server account;
- server snapshot for mutable operational LifeOS state;
- relational Adaptive Analytics history for durable semantic facts.

Do not introduce frameworks or libraries merely for convenience.

Existing architecture is generally preferred over new abstraction layers.

====================================================================
7. CORE PERSISTENCE ARCHITECTURE
====================================================================

LifeOS deliberately uses a HYBRID persistence model.

A. MUTABLE CURRENT STATE

Operational current state lives in the server snapshot.

Historically:

user_snapshots

stores a JSON payload.

The snapshot is mutable current state, not reliable historical analytics.

Snapshot writes use revision/CAS semantics.

Current snapshot version:

2

Server snapshot schema_version:

2

Do NOT bump either unless a future accepted slice explicitly requires it.

StateSyncCoordinator owns snapshot synchronization.

A snapshot 409 conflict may freeze snapshot synchronization.

That behavior MUST NOT control or damage the Adaptive Analytics history queue.

B. DURABLE SEMANTIC HISTORY

Adaptive Analytics facts live in relational aa_* tables.

Analytics history is append/version/correction oriented.

Examples:

- measurements;
- expectations;
- forecasts;
- baselines;
- targets;
- preferences;
- observations;
- source coverage;
- policies;
- membership overrides.

Do not abuse snapshot state as historical evidence.

Do not use activityLog as AA history.

====================================================================
8. ADAPTIVE ANALYTICS — PRODUCT PHILOSOPHY
====================================================================

Adaptive Analytics is a horizontal capability across LifeOS.

Core principle:

Learning > Scoring

The system should help the user understand reality, expectations, predictions,
decisions and outcomes without collapsing life into one score.

There is NO Life Score.

There must be no arbitrary global score across incompatible units/domains.

Warm visual emphasis is reserved for genuine stakes/materiality, not merely
positive/negative arithmetic.

====================================================================
9. FROZEN SEMANTIC INVARIANTS
====================================================================

These are foundational.

Never silently violate them.

Expectation ≠ Target

Prediction ≠ Preference

Actual ≠ Forecast

direction ≠ desirability ≠ materiality

Expectation alone cannot establish favorable/unfavorable.

Forecast alone cannot establish favorable/unfavorable.

Delta sign alone cannot establish favorable/unfavorable.

Desirability can come only from explicit normative grounding such as:

- Target;
- Preference / Orientir;
- Decision;
- another future explicitly accepted normative domain constraint.

Without normative grounding, comparisons stay neutral.

Example:

Expectation = ₴62,000
Actual = ₴61,200
Delta = −₴800
Target absent

Desirability:

NEUTRAL

Do not paint this automatically good/green or bad/red merely from the sign.

Additional permanent invariants:

NO SILENT HISTORY LOSS

future ≠ missing ≠ negative

missing ≠ zero

correlation ≠ causation

hypothesis ≠ fact

result ≠ causal proof

unknown is a valid response state where conceptually appropriate

inconclusive is valid

Actual is never stored as Forecast merely for convenience.

A correction is not a second independent event.

====================================================================
10. FINAL C5 MISSING / UNKNOWN SEMANTICS
====================================================================

Later accepted C5 semantics override older draft wording.

Missing Measurement:

NO ROW

Do NOT manufacture a fake "unknown measurement" row.

Zero is a real value and distinct from missing.

Read/derived analytics may produce:

unknown
no_data
insufficient_data

where appropriate.

Explicitly absent Target is distinct from:

- no Target row;
- Target value = 0.

Value-free Target / Observation shapes are allowed only where the concept
explicitly permits them.

====================================================================
11. BITEMPORAL / TIME SEMANTICS
====================================================================

Do not generalize all dates into one timestamp.

Measurement:

occurred_at
occurred_tz
recorded_at

ForecastVersion:

recorded_at
horizon_at

For a date-valued Forecast:

value.date = predicted date

horizon_at = when the prediction becomes checkable.

Project date-only forecast convention currently used:

horizon_at = next local midnight after the forecast date

Timezone:

Europe/Kyiv

Use IANA timezone rules.

Never hardcode Kyiv as fixed +02 or +03.

A previous Slice 2 review caught exactly this class of bug.

Reusable frontend timezone helpers now exist.

====================================================================
12. ADAPTIVE ANALYTICS FROZEN DESIGN
====================================================================

Frozen design tag:

adaptive-analytics-design-accepted

Target commit:

d4960286ec94f35472600e59c0d533dc50a64351

DO NOT move this tag.

The frozen A–J design is an accepted design/semantic reference.

High-level surfaces include:

A. Home signals
B. Signal card states
C. Expected / Actual / Delta
D. Metric / Forecast History
E. Review / Debrief
F. Finance
G. Project
H. Subjective + objective
I. Experiment
J. Trade-off / System Review

The frozen kit is not a runtime fixture source.

Do not ship demo chrome or fake data merely because they appear in design
examples.

====================================================================
13. AUTHORITATIVE DOCUMENTS
====================================================================

Discovery:

Outputs/Discoveries/
lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md

Discovery summary:

Outputs/Summaries/
lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md

Phase B Plan:

Outputs/Plans/
lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md

Plan summary:

Outputs/Summaries/
lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md

Implementation reports currently include:

PRE-0:
Outputs/Implementations/
lifeos-pre0-development-baseline_20260908-140841.md

Slice 0:
Outputs/Implementations/
lifeos-adaptive-analytics-slice-0_20260908-145309.md

Slice 0b:
Outputs/Implementations/
lifeos-adaptive-analytics-slice-0b_20260916-235514.md

Slice 1:
Outputs/Implementations/
lifeos-adaptive-analytics-slice-1_20260918-165431.md

Hero:
Outputs/Implementations/
lifeos-design-handoff-hero-vignette_20260926-202144.md

Slice 2:
Outputs/Implementations/
lifeos-adaptive-analytics-slice-2_20260928-080526.md

Slice P:
Outputs/Implementations/
lifeos-adaptive-analytics-slice-p_20260928-090144.md

Slice 3:
Outputs/Implementations/
lifeos-adaptive-analytics-slice-3_20260928-151155.md

Slice 4:
Outputs/Implementations/
lifeos-adaptive-analytics-slice-4_20260928-171500.md

Slice 5:
Outputs/Implementations/
lifeos-adaptive-analytics-slice-5-project-analytics_20260929-001128.md

Slice 6:
Outputs/Implementations/
lifeos-adaptive-analytics-slice-6-experiments_20260929-205427.md

Calendar cube redesign:
Outputs/Implementations/
lifeos-calendar-cube-redesign_20260929-223750.md

Slice 7:
Outputs/Implementations/
lifeos-adaptive-analytics-slice-7-system-review-intelligence_20260930-010850.md

F3 AA history cursor correctness:
Outputs/Implementations/
lifeos-aa-history-cursor-correctness_20260930-020750.md

Slice 8 report:
Outputs/Implementations/lifeos-adaptive-analytics-slice-8-retention_20260930-041500.md
Slice 8 Final Plan:
Outputs/Plans/lifeos-adaptive-analytics-slice-8-retention-final-plan_20260930-030431.md
Slice 8 reconciliation:
Outputs/Discoveries/lifeos-adaptive-analytics-slice-8-final-reconciliation_20260930-030431.md
Calendar accepted Plan:
Outputs/Plans/lifeos-calendar-cube-redesign-plan_20260929-214917.md
Module boundaries:
Outputs/architecture/module-boundaries.md
Completion audit (canonical checkout, 2026-09-30):
Outputs/Implementations/lifeos-completion-audit_20260930-125002.md
Transfer-audit input (owner-supplied, not committed): LifeOS_Completion_Audit_20260930.md.

Before implementing a relevant slice:

READ the current plan/report/code directly.

Do not rely solely on a summary in this prompt.

====================================================================
14. AUTHORITY ORDER WHEN DOCUMENTS CONFLICT
====================================================================

When two sources conflict, use this order:

1. explicit latest owner decision;
2. accepted current code merged into main;
3. accepted implementation report for that code;
4. final Phase B Plan / corrections;
5. Discovery;
6. old README/comments;
7. prototype implementation details.

Known example:

an old comment once said Clarify "project" should call addGoal.

That is WRONG.

It was explicitly corrected.

Canonical rule:

Project ≠ Goal

Clarify Project outcome must use the real Project domain.

====================================================================
15. ADAPTIVE ANALYTICS DATA FOUNDATION — COMPLETED
====================================================================

M1:

aa_0002_history_foundation

Implemented in Slice 0.

Major foundation:
- metric definitions;
- measurements;
- source coverage;
- correction semantics;
- idempotency;
- as-of behavior;
- write gate.

M2:

aa_0003_deletion_receipts

Implemented in Slice 0b.

Major foundation:
- privacy deletion receipt;
- account ZIP export;
- account-level deletion coverage;
- AA export/delete behavior;
- non-destructive post-personal-data rollback philosophy.

M3:

20260910_0004
AA semantic comparison

Current single Alembic head:

20260930_0009
(M8 · Retention · Slice 8; down_revision 20260930_0008)

M3 added concept tables including:

aa_expectation_versions
aa_forecast_versions
aa_baselines
aa_targets
aa_preferences
aa_observations
aa_metric_policy_versions
aa_metric_membership_overrides

Current state:

ONE Alembic head.

M4 (20260928_0005 · aa_signal_episodes) implemented and merged in Slice 3.

M5 (20260928_0006 · aa_reviews, aa_review_revisions, aa_review_context_items,
aa_review_context_sources, aa_review_factors, aa_decisions) implemented in
Slice 4.

M6 (20260929_0007 · aa_experiments, aa_experiment_adherence,
aa_experiment_observations; widens aa_decisions and aa_review_factors by scope)
implemented in Slice 6. AA table count: 22.

M7 (20260930_0008 · aa_importance_ratings, aa_cross_references,
aa_relation_feedback, aa_finance_contexts, aa_system_review_revisions)
implemented in Slice 7. Historical AA table count: 27.

M8 (20260930_0009 · aa_retention_policies, aa_retention_runs) implemented
in Slice 8. Current AA table count: 29; snapshot/server schema remain 2.

====================================================================
16. METRIC CATALOGUE CURRENTLY RELEVANT
====================================================================

finance.transaction_amount

- domain: finance
- subject_type: transaction
- atomic Measurement
- money
- UAH
- actual source: observed/imported

finance.monthly_spend

- domain: finance
- subject_type: period
- subject id YYYY-MM
- money
- UAH
- DERIVED
- never persisted merely as a convenience aggregate

project.completion_date

- domain: project
- subject_type: project
- value_type: date
- aggregation: none
- Actual source: observed

Project Forecasts for completion date use aa_forecast_versions.

Project Actual completion uses aa_measurements.

Never place Actual inside forecast storage.

====================================================================
17. SLICE 0 — COMPLETED
====================================================================

Branch:

feat/adaptive-analytics-slice-0

Implementation commit:

b19b7019a46c68c324087d16724735507a5bd597

Implemented:

- M1;
- measurements;
- source coverage;
- corrections;
- idempotency;
- catalogue;
- gate;
- as-of foundation.

Historical validation at completion:

114 pytest
37 Vitest

Merged via normal merge commit.

====================================================================
18. SLICE 0B — COMPLETED
====================================================================

Implementation commit:

2205c3e7f589f1a72fda67d335612a6971c7af92

Implemented:

- M2 deletion receipt;
- account ZIP export;
- account deletion coverage;
- privacy;
- rollback behavior.

Historical validation:

143 backend
45 frontend

Merged via normal merge commit.

====================================================================
19. SLICE 1 — COMPLETED
====================================================================

Branch:

feat/adaptive-analytics-slice-1

Implementation commit:

7687e88316f515021ef9b7f7d693e842405552c2

Merged main at that time:

40ae9281c077d1bd65ed595c04f0eb424d9a00db

Implemented M3:

- Expectations;
- Forecasts;
- Baselines;
- Targets;
- Preferences;
- Observations;
- metric policies;
- membership overrides;
- semantic separation;
- desirability grounding;
- coverage;
- C7 historical inclusion;
- AA frontend primitives.

Historical validation:

242 pytest
76 Vitest

AA export registry at that point:

12 / 12 AA tables.

====================================================================
20. HERO DESIGN HANDOFF — COMPLETED
====================================================================

Raw source:

/Users/yurasachenko/LifeOS/design_handoff_hero_vignette

Production implementation commit:

7a56584d389a07a0890490a92f4bfac760e11b8a

PR #5:

MERGED

Merge commit:

81ea9b098ab18a9bcf35b890a6412383be10216c

Production component:

apps/web/src/components/HeroVignette.jsx

Behavior:

- integrated with PageHeader;
- Paradise theme uses Hero Vignette;
- dark/light retain compact fallback;
- existing local island day/night assets reused;
- responsive;
- reduced motion;
- accessibility checked;
- prototype shell not ported.

Do not rebuild or replace this merely while implementing another feature.

====================================================================
21. SLICE 2 — FINANCE PILOT — COMPLETED
====================================================================

Primary implementation commit:

f463737c47ec7ce09fcd82fdfc81d65b1369347b

Timezone follow-up:

b6e53ec198c59299a83202882a746e197f9c27f1

PR #6:

MERGED

Merge commit:

ec158fc44f554c04f1c43d22d1e93d67ed9a44ed

Major completed features:

- real Finance AA facts;
- derived monthly spend;
- correction exactly once;
- C7 historical membership;
- honest legacy transaction import;
- AnalyticsRepository;
- AnalyticsWriteQueue;
- AnalyticsSyncCoordinator;
- AnalyticsContext;
- FinanceAnalytics;
- MetricHistory;
- AAChart;
- AAChartLayers;
- MoneyWidget hardcoded budget removed;
- explicit target absence;
- provenance;
- coverage;
- durable offline writes.

Final Slice 2 validation after timezone correction:

253 pytest
108 Vitest / 16 files
Ruff PASS
Typecheck PASS
Lint PASS
Build PASS
git diff --check PASS

No migration in Slice 2.

====================================================================
22. DURABLE AA WRITE QUEUE — CANONICAL CONTRACT
====================================================================

Key frontend modules:

apps/web/src/repositories/analyticsRepository.ts

apps/web/src/repositories/analyticsWriteQueue.ts

apps/web/src/repositories/analyticsSyncCoordinator.ts

apps/web/src/context/AnalyticsContext.jsx

Queue rules:

- IndexedDB durability;
- IDBFactory injection;
- idempotency key generated AT ENQUEUE TIME;
- key persisted;
- same key reused after retry/restart/lost acknowledgement;
- strict FIFO by queue_id;
- single-flight semantic writes;
- browser restart durability;
- transient retries;
- exponential backoff;
- 400/422 → visible permanent dead-letter;
- 401 → blocked_auth, retain data;
- 409 → terminal business conflict;
- logout/account switch never replays another user's queue;
- multi-tab leader election with Web Locks when available;
- correctness still duplicate-safe without Web Locks because server idempotency
  exists.

Queue must never silently discard semantic history.

====================================================================
23. STATE SYNC VS ANALYTICS SYNC
====================================================================

StateSyncCoordinator:

- current snapshot;
- CAS;
- 409 can freeze snapshot sync.

AnalyticsSyncCoordinator:

- semantic facts;
- IndexedDB;
- append + idempotency;
- independent failure model.

Permanent T-12 rule:

snapshot 409 must NOT:

- pause AA queue;
- freeze AA queue;
- drain AA queue;
- lose AA writes.

Inverse:

AA queue failure must NOT freeze snapshot synchronization.

Do not couple the two coordinators.

====================================================================
24. SLICE 2 TIMEZONE CORRECTION — IMPORTANT HISTORY
====================================================================

An owner review found a real bug where manual Finance transaction dates used:

+03:00

while also declaring:

Europe/Kyiv

This was incorrect in winter because Kyiv can be +02.

The implementation was corrected to IANA-aware conversion.

Permanent tests include:

- summer;
- winter;
- month boundary;
- year boundary.

Lesson:

never hardcode Kyiv UTC offset.

Use shared timezone helpers.

====================================================================
25. SLICE P — MINIMAL PROJECT DOMAIN — COMPLETED
====================================================================

Primary implementation commit:

690b39a8dd24537d49b3148767bc3b3fcdb92cbb

Semantic cleanup:

c36e4f67e6b0cf8288bd149cd89f0347e3c10e95

PR #7:

MERGED

Historical Slice P merge commit:

3570426a80988f2715f48bb9a12261d3ee122056

Project current-state model:

payload.projects[]

Exact minimum shape:

{
  id,
  title,
  created_at,
  started_at,
  status,
  current_forecast_date,
  completed_at
}

Allowed status ONLY:

active
completed
archived

State version remains:

2

No backend migration.

No dependency addition.

No demo Projects.

====================================================================
26. PROJECT DOMAIN ACTIONS
====================================================================

Current canonical actions:

addProject(title)

setProjectForecast(id, date)

completeProject(id)

archiveProject(id)

Project is DISTINCT from Goal.

Never map Project to:

goals[]
addGoal
GoalsPage

Project creation:

- creates active Project;
- created_at = creation instant;
- started_at = same instant;
- no forecast initially;
- no completion initially;
- emits NO AA fact.

Project forecast:

- active Project only;
- updates current_forecast_date only after durable AA enqueue succeeds;
- appends a NEW aa_forecast_versions semantic intent;
- does not update old forecast history;
- metric = project.completion_date;
- value type = date;
- source_kind = USER_REPORTED;
- subject = project:project:<id>.

Project completion:

- active Project only;
- durable enqueue first;
- then snapshot status = completed;
- completed_at = actual action instant;
- AA Actual is a Measurement;
- metric = project.completion_date;
- value.date = real Europe/Kyiv local completion date;
- occurred_at = actual completion instant;
- occurred_tz = Europe/Kyiv;
- source_kind = OBSERVED.

Archive:

- active/completed → archived;
- emits no AA fact;
- keeps forecast/completion state;
- no hard delete.

====================================================================
27. PROJECT FORECAST TEMPORAL CONVENTION
====================================================================

Project forecast is date-valued.

value.date:

the date the user predicts completion.

horizon_at:

the instant immediately AFTER that local forecast calendar date,
implemented as next local midnight in Europe/Kyiv.

This makes a date-only prediction fully checkable only after the forecast day
has elapsed.

Use IANA rules.

Do not fabricate an arbitrary daytime timestamp.

====================================================================
28. SLICE P UI — COMPLETED
====================================================================

Key files include:

apps/web/src/pages/ProjectsPage.jsx

apps/web/src/components/ProjectCard.jsx

apps/web/src/domain/projects.ts

apps/web/src/analytics/projectFacts.ts

apps/web/src/analytics/timezone.ts

apps/web/src/context/LifeDataContext.jsx

apps/web/src/context/AnalyticsContext.jsx

apps/web/src/App.jsx

apps/web/src/app/routes.js

apps/web/src/components/Sidebar.jsx

apps/web/src/context/LocaleContext.jsx

Projects route:

projects

Projects is available through the LIFE section.

RU/UK copy exists.

No English locale was introduced.

Hero/PageHeader integration is preserved.

Project Analytics, forecast history and dual-delta comparison are now implemented
in Slice 5 (section 39). Their absence was historical Slice P scope only.

====================================================================
29. VALIDATION BASELINES — HISTORICAL VS CURRENT
====================================================================

At Slice P completion: 253 backend / 123 frontend tests (historical only).
At Calendar completion: 602 backend / 495 frontend tests (historical only).
At Slice 7 completion: 674 backend / 522 frontend tests (historical only).
At F3 completion: 676 backend / 522 frontend tests (historical only).
At Slice 8 completion: 748 backend passed, 1 opt-in performance skip;
535 frontend passed / 42 files. The report says the perf harness passed
separately. These are committed report results, not a rerun in this session.

Fresh 2026-09-30 audit of exact remote main:
535 frontend tests / 42 files PASS; typecheck, lint, build --manifest PASS.
Default build: entry 321.11 kB / 97.34 kB gzip; CSS 165.56 kB.
Calendar lazy chunk at current main: 20.19 kB / 6.11 kB gzip.
Historical Calendar report chunk 21.75 kB is not a current budget pin.

Local audit fixes add five regression cases (section 78): 540 frontend tests
in 43 files PASS, typecheck/lint/analytics-enabled build PASS. These results
belong to the candidate audit fixes, not to remote main.
The transfer audit could not run backend runtime gates or browser/API flows
(no PostgreSQL / Python 3.11 there); it did static checks only.

Canonical-checkout validation, 2026-09-30 (branch fix/lifeos-completion-audit,
backend unchanged from main): python -m pytest on lifeos_test with DB tests
enabled = 748 passed, 1 skipped (the opt-in retention perf harness only); ruff
PASS; alembic heads = 20260930_0009; alembic current on lifeos_test =
20260930_0009 (alembic_version row confirmed); live DB has 29 aa_* tables =
29 mapped models = 29 EXPORT_TABLES entries; all 28 aa_* tables with user_id
cascade from users (aa_metric_definitions is the global catalogue).
Frontend candidate: TZ=UTC 540 / 43 files; typecheck, lint PASS;
analytics-enabled build entry 335.54 kB (main with the same flag 335.54 kB).
Focused browser/API QA results are in the audit report (section 13 list).

====================================================================
30. RECOVERY STASH — DO NOT DROP
====================================================================

During Slice 2 recovery, substantial uncommitted work was safely preserved.

Preserved stash object SHA:

51184836ace557fbd9492527bd845329b17b2a76

It was intentionally retained after Slice 2 and Slice P.

Do NOT:

- apply it casually;
- pop it;
- drop it;
- replace it;
- treat stash@{0} as permanently stable.

If checking it, prefer the object SHA rather than assuming stash numbering.

Only remove it after explicit owner authorization.

====================================================================
31. CLARIFY DESIGN HANDOFF — COMPLETED (PR #9)
====================================================================

Clarify is implemented and merged through PR #9.
Merge: 573456af2cc37e917beafc4cf7f798be7d0c74b6.
Report: Outputs/Implementations/lifeos-design-handoff-clarify-panel_20260928-120853.md.
Snapshot v2 includes waitingItems[] and references[]; no backend migration.
Raw design source: /Users/yurasachenko/LifeOS/design_handoff_clarify_panel.
Six outcomes are real: Do Now, Delegate, Defer, Project, Reference, Delete.
Project uses the real Project domain; cancellation/failure preserves the note.
Sections describing old preimplementation uncertainty are historical only.
Do not create another Clarify branch or reimplement the accepted integration.

====================================================================
32. OWNER-APPROVED CLARIFY OUTCOMES
====================================================================

Clarify is a processing step for Quick Notes / Inbox items.

Canonical outcomes:

1. «Сделать сейчас»

Create an ordinary Task from the Quick Note.

Rules:

- do not invent a due date;
- use real Task domain;
- after successful Task creation, remove original Quick Note;
- do not merely open Quick Add and call that completion.

2. «Делегировать»

Requires separate Waiting semantics.

Rules:

- NOT a tag;
- NOT hidden text;
- NOT fake Task status unless deliberately designed as the actual model;
- minimum semantic fields currently approved:
  title
  optional waitingFor
  createdAt
- must be user-visible through Tasks/Waiting or an equivalent clearly approved
  surface.

The exact persisted representation is settled in the accepted Clarify code;
inspect that code before future changes.

Do not invent a large delegation system.

3. «Отложить»

Create/use a Task with an explicitly selected FUTURE date through the existing
due/schedule model.

Rules:

- selection opens date/date-time choice;
- if the user cancels, Quick Note remains untouched;
- no hidden indefinite someday bucket;
- no invented future date.

4. «В проект»

Use the REAL Project domain introduced by Slice P.

NOT:

Goal
addGoal
goals[]

The Clarify Project outcome must target real Project semantics.

Whether it creates a new Project immediately or opens a minimal explicit Project
selection/creation interaction must follow the Clarify handoff + current product
contract, not an invented mapping.

5. «В справочник»

Requires a separate Reference record / reference semantics.

Rules:

- preserve original text;
- user must be able to see it later;
- do NOT implement as a tag;
- do NOT simply hide the Quick Note;
- do NOT silently leave it in Inbox and claim success.

The exact minimal persisted representation should be explicitly designed during
Clarify implementation after inspecting current code.

Do not build a knowledge-management system beyond what Clarify needs.

6. «Удалить»

Use existing:

deleteQuickNote

Use the handoff confirmation interaction.

====================================================================
33. CLARIFY WAITING / REFERENCE — SETTLED
====================================================================

The accepted implementation stores waitingItems[] and references[] in the
operational snapshot. Waiting is retrieved from the Tasks waiting filter;
Reference is retrieved from the Notes reference surface.
Inspect domain/clarify.ts and lifeData/migrate.js for exact current shapes.
There is no open Waiting/Reference storage decision from the old handoff.
Future Reference lifecycle changes remain a separate product scope.

====================================================================
34. QUICK NOTES / TASK FOUNDATIONS
====================================================================

Current product already has:

Quick Notes

Task domain

deleteQuickNote

addTask

Quick Add

Task operational state

Clarify implementation should reuse those real pathways where semantics align.

Do not duplicate Task storage.

Do not create "ClarifyTask".

====================================================================
35. PROJECT ≠ GOAL — PERMANENT RULE
====================================================================

This deserves repetition because an old comment once contradicted it.

Goals and Projects are different domains.

Goals currently retain their own legacy structure.

Projects have:

dates
forecast
completion
AA history

Never use:

addGoal

for Clarify's Project outcome.

The stale comments claiming otherwise were removed from both:

apps/web/src/context/LifeDataContext.jsx

and:

ui_kits/life-os/LifeDataProvider.jsx

====================================================================
36. ROADMAP / REMAINING ADAPTIVE ANALYTICS SLICES
====================================================================

Original Phase B sequence was designed as:

PRE-0
→ 0
→ 0b
→ 1
→ 2
→ 3
→ 4
→ P
→ 5
→ 6
→ 7
→ 8

Practical implementation order was intentionally changed:

P was moved earlier because Clarify required a real Project domain.

Current practical position:

PRE-0 ✅
0 ✅
0b ✅
1 ✅
Hero integration ✅
2 ✅
P ✅
Clarify Panel ✅
3 ✅
4 ✅
5 ✅
6 ✅
7 ✅
F3 cursor correctness ✅ (actual history keyset uses SQL `tuple_(occurred_at, id)`;
equal-timestamp pagination regression pinned)
8 ✅ (retention / legacy / hardening — §42)

NEXT:

owner review of the completion-audit branch (§78), then separately planned
product scope — not an automatic Slice 9

Do not implement a later slice merely because its prerequisites exist.

====================================================================
37. SLICE 3 — SIGNALS + HOME — COMPLETED
====================================================================

Slice 3 introduced Signals and Home's quiet 0–3 signal section.

Implementation report:

Outputs/Implementations/
lifeos-adaptive-analytics-slice-3_20260928-151155.md

Migration M4 landed here:

20260928_0005_aa_signal_episodes   (down_revision 20260910_0004)

Table:

aa_signal_episodes
UNIQUE (user_id, episode_key)
users ON DELETE CASCADE
in the account export registry and the test TRUNCATE registry

The two identities are stored separately and must stay that way:

episode_key
rule-defined user-facing occurrence identity;
drives acknowledgement, dedup and reappearance

input_fingerprint
sha256(sorted(input_version_ids));
drives audit, reproducibility and correction re-evaluation;
may change without creating a new episode

EXACTLY four canonical rules exist. Do not add a fifth without an owner
decision:

finance.monthly_spend.threshold   v1   bands 80 / 100 / 120
project.forecast.revision         v1
data.source.stale                 v1   >7d info, >14d material
coverage.window.partial           v1   <90% info, <50% material

Rule modules live in apps/api/app/analytics/rules/ with a registry in
rules/__init__.py. No rule may reference desirability; a test asserts it.

API surface is exactly two endpoints:

GET  /api/v1/aa/signals
POST /api/v1/aa/signal-episodes/{episode_key}/ack

Home shows at most 3 signals, ranked by materiality, BELOW the first ordinary
panel row. The zero state is coverage-aware: zero cards over data whose
completeness is unverified reports unknown coverage, never reassurance.

There is no notification centre, no polling and no Life Score.

Post-Slice-3 correctness fix (project.forecast.revision, still v1):
the rule reads the forecast VERSION HISTORY, not the live version. Its input
is every non-tombstoned version of the user + project + completion-date grain,
recorded_at <= as_of when as_of is given, ordered recorded_at, id. It must not
use apply_as_of, which returns only the live row of a superseded chain.
`from` = immediately previous surviving version; episode key = newest version.
Report: Outputs/Implementations/
lifeos-project-forecast-revision-signal-correctness_20260928-195351.md

====================================================================
38. SLICE 4 — REVIEW / DEBRIEF — COMPLETED
====================================================================

Implementation report:

Outputs/Implementations/
lifeos-adaptive-analytics-slice-4_20260928-171500.md

Migration M5: 20260928_0006_aa_reviews (down_revision 20260928_0005).

Six tables (all users ON DELETE CASCADE, all in the export and TRUNCATE
registries):

aa_reviews                   header, window, context_as_of, values-free manifest
aa_review_revisions          one row per save/revise; appended note text
aa_review_context_items      frozen value + provenance as displayed; redactable
aa_review_context_sources    item → fact links (derived items have many sources)
aa_review_factors            user factor + epistemic kind (observed/mine/maybe/unknown)
aa_decisions                 nullable choice: keep/adjust/later/inconclusive

Settled semantics:

- context is derived server-side AS OF an instant; a save carries only user
  content + context_as_of + fingerprint, never frozen values; an irreproducible
  context is 409 review_context_changed;
- reopening returns exactly the saved values; later corrections are flagged
  beside them (corrected ≠ revised ≠ withdrawn);
- HARD delete redacts every item derived from the fact inside the deletion
  transaction («источник удалён»); tombstone does not redact;
- user note/factors/decision survive redaction;
- NULL decision («Пока без решения») ≠ inconclusive ≠ skipped (no row);
- no review-available signal (would be a fifth rule); entry points are
  ProjectCard (completed) and FinanceAnalytics.

API: GET /api/v1/aa/reviews/context, GET /api/v1/aa/reviews?subject=,
POST /api/v1/aa/reviews, GET /api/v1/aa/reviews/{id},
POST /api/v1/aa/reviews/{id}/revise.

Validation at completion: 380 pytest, 242 Vitest (25 files).

====================================================================
39. SLICE 5 — PROJECT ANALYTICS — COMPLETED
====================================================================

Implementation report:

Outputs/Implementations/
lifeos-adaptive-analytics-slice-5-project-analytics_20260929-001128.md

No migration (Alembic head stays 20260928_0006), no Project SQL table,
snapshot version 2 / server schema_version 2, no new write path.

One read-only endpoint (auth only, no write gate):

GET /api/v1/aa/projects/{project_id}/analytics[?as_of=]

Canonical scenario (tested through the real write paths):

Forecast 20 Aug → 24 Aug → 26 Aug, Actual 25 Aug
forecast versions = 3 (two superseded/REVISION + one active)
Actual is a separate field, never a version
actual vs first = +5 days · actual vs latest = −1 day
both NEUTRAL

Settled semantics:

- forecast VERSION HISTORY uses the PR #14 predicate: every non-tombstoned
  version of user + project subject + project.completion_date,
  recorded_at <= as_of for as-of, ordered recorded_at, id; never apply_as_of;
- Actual = the completion Measurement live at T and occurred by T; a
  correction counts once, its lineage is exposed;
- dual delta = compute_delta(Actual, first) and (Actual, latest);
  desirability always neutral: no Target/Preference/Decision is consulted
  for a project date (a project Target window has no accepted meaning);
  Expectation and Forecast never ground;
- states: no_facts · too_early · actual_not_recorded (never "missed") ·
  no_forecast (delta unknown, never zero) · compared;
- tombstoned versions leave the history; the first operand is always
  «первая сохранённая оценка», never "first ever";
- pending local writes are reported beside the history, never merged;
  snapshot current_forecast_date is never counted.

Frontend: route project-analytics (#/project-analytics/<id>, analytics-gated,
lazy), ProjectCard entry, Review entry reuses Slice 4 for completed projects,
RU/UK day grammar (+5 дней / −1 день, +5 днів / −1 день).

Not built (no truthful source): task counts, «typical for me» baseline,
cause, duration KPI.

Validation at completion: 420 pytest, 316 Vitest (31 files).

====================================================================
40. SLICE 6 — EXPERIMENT — COMPLETED
====================================================================

Implementation report:

Outputs/Implementations/
lifeos-adaptive-analytics-slice-6-experiments_20260929-205427.md

Migration M6: 20260929_0007_aa_experiments (down_revision 20260928_0006).
AA tables 19 → 22: aa_experiments (state), aa_experiment_adherence,
aa_experiment_observations. No aa_experiment_factors.

Scoped decisions/factors: aa_decisions and aa_review_factors carry
scope review|experiment with an exactly-one-parent CHECK. Vocabularies are pinned
per scope: Review keep|adjust|later|inconclusive, Experiment
keep|modify|longer|reject|inconclusive (NULL = «Пока без решения» in both).
Experiment decisions have their own idempotency_key and are the experiment's
revision ledger for its factors. No row ≠ NULL ≠ inconclusive.

Lifecycle: DRAFT → RUNNING → COMPLETED_AWAITING_REVIEW → REVIEWED; ABANDONED from
the first three. REVIEWED and ABANDONED terminal. D4 preserved: lifecycle ≠
outcome; a decision never moves lifecycle; ABANDONED is not failure. A request for
a state already entered is a 200 no-op; an illegal edge is 409; a CAS loser never
re-decides. Client occurred_at is stored; completion only after window_end in the
experiment's IANA zone.

Adherence stores kept|missed|unknown only; future / not_recorded /
not_run_after_stop are derived; post-stop days leave the denominator; future days
cannot be written. Result neutral (no grounding), never causal; baseline in
aa_baselines, conditions in aa_observations, no catalogue metric.

Queue: client-minted UUID v4 at create so children queue before the ACK; existing
FIFO/head-blocking queue unchanged. Route #/experiment, one analytics-gated Sidebar
item. PENDING_LIFECYCLES (DRAFT, RUNNING, COMPLETED_AWAITING_REVIEW) is exported
for Slice 7.

Validation at completion: 602 pytest, 375 Vitest (33 files).

====================================================================
40b. CALENDAR CUBE REDESIGN — COMPLETED (operational, not AA)
====================================================================

Implementation report:

Outputs/Implementations/
lifeos-calendar-cube-redesign_20260929-223750.md

Owner intent was recovered from the old Claude archive (conversation
3cfa1a74-079e-44e1-ae3c-bdec673f3b08, message 019f1e07-…) and kept in
Outputs/Discoveries/lifeos-calendar-recovered-source-of-truth_20260929-214917.md.

Calendar = day cubes of a month (exactly 28–31, number + weekday only, no task
content, no filler) → click → Day Manager; zoom out to the 12 months of a year and
30-year windows up to 2100 (lower bound: min(current Kyiv year, earliest dated
task)). Route: one id `calendar` with sub-paths YYYY / YYYY-MM / YYYY-MM-DD /
years[/YYYY] / history. No fabricated events, no dog feedings.

Task date authority is task.schedule.date (+ schedule.time); `due` is only a
non-localised legacy label. Optional task fields (additive, never backfilled):
created_at, completed_at, closure ('closed_unresolved'|'archived'), closed_at,
order (per day). Snapshot version 2 / server schema_version 2 unchanged; no
Alembic migration.

OD-1 (owner-resolved 2026-09-29): «Выполнить» → done + completed_at; «Закрыть без
выполнения» → closed_unresolved; «В архив» → archived; mutually exclusive. An
overdue task nobody marked stays active on its day. Delete is permanent and never
in History. History is derived from state.tasks (never activityLog). Restore
returns the SAME id to active.

Validation at completion: 602 pytest, 495 Vitest (39 files).

====================================================================
41. SLICE 7 — SYSTEM REVIEW + RELATIONSHIP / CONSEQUENCE INTELLIGENCE — COMPLETED
====================================================================

Implementation report:

Outputs/Implementations/
lifeos-adaptive-analytics-slice-7-system-review-intelligence_20260930-010850.md

Plan / reconciliation: Outputs/Plans/…-slice-7-system-review-intelligence-final-plan_20260929-234900.md,
Outputs/Discoveries/…-slice-7-final-reconciliation_20260929-234900.md.

Owner decisions (2026-09-29, resolved): OD-7.1 manual «Связать» + rule proposals with
approve / reject / unsure, durable feedback, deterministic acceptance-history ranking (no ML),
richer typed vocabulary with explicit epistemic kind, causal wording forbidden, hypotheses
marked; OD-7.2 = B + C (live derived review + saved append-only revisions); OD-7.3 «Ревью
доступно» = concrete reviewable objects only, «Требует подтверждения» separate, no fifth rule.

Settled semantics:

- no global score, no composite, no moral label, no diagnosis; importance user-owned
  (none/matters/ok/ignore, no number);
- Live System Review: GET /api/v1/aa/system-review?period=YYYY-MM|YYYY, monthly + annual,
  READ ONLY transaction, zero writes with the gate open; «Что повторилось» re-evaluates the
  existing four rules as pure modules (never aa_signal_episodes);
- Saved System Review: append-only revisions (draft / finalized / revise), base_revision
  concurrency (409 revision_conflict), frozen redactable context + source manifest;
  corrections change the live review only; never auto-finalized;
- relations: FACT (endpoints) ≠ ASSOCIATION/HYPOTHESIS (epistemic_kind tied to type) ≠
  PROJECTION (consequences) ≠ USER CONFIRMATION (status); system can never approve its own
  proposal (DB CHECK); proposal_key = occurrence, input_fingerprint = exact evidence; answered
  keys are never re-proposed; ranking changes order only;
- consequences: explicit user-authored finance context (aa_finance_contexts); projections show
  inputs/assumptions/calculation/horizon/missing/limitations, refuse with needs_input, one
  currency only; income not modeled; «Самопроверка LifeOS» is a custom transparent
  questionnaire, not a clinical test;
- review available = experiments COMPLETED_AWAITING_REVIEW + ended months (12) / previous
  year with evidence and no finalized revision; requires confirmation = unanswered proposals
  of the current + 2 previous months;
- exports of a saved revision: PDF/DOCX/XLSX/MD (stdlib writers, embedded DejaVu subset, XLSX
  formula-safe); account JSON export includes all five tables; D1 redaction adapters for
  revisions / relation endpoints / importance;
- retention: unlimited by default; full retention mechanics are implemented in Slice 8 (§42).

Frontend: route system-review (#/system-review[/YYYY-MM|YYYY][/tradeoff|/revisions/<n>] |
/waiting), analytics-gated, lazy, Sidebar «обзор системы»; LIFE_ROUTES 22.

Validation at completion: 674 pytest, 522 Vitest (41 files).

====================================================================
42. SLICE 8 — RETENTION / LEGACY / HARDENING — COMPLETED
====================================================================

Implementation report:

Outputs/Implementations/
lifeos-adaptive-analytics-slice-8-retention_20260930-041500.md

Plan / reconciliation: Outputs/Plans/…-slice-8-retention-final-plan_20260930-030431.md,
Outputs/Discoveries/…-slice-8-final-reconciliation_20260930-030431.md.

Owner decisions (resolved 2026-09-30): O1 finite retention prunes only
observational / windowed / versioned evidence by whole chain / window / completed
Project unit; user-authored entities never age-pruned; open or Actual-less
Projects never pruned. O2 retention is user-chosen hard erasure: source-derived
frozen Review / Saved System Review values are redacted first with reason
source_retention_pruned; user content survives; never tombstone. O3 Unlimited
(default, no row) · 5 · 3 · 2 years (60/36/24 months) only; nothing shorter,
nothing preselected. O4 one aa_retention_runs row per Apply; no per-fact
retention receipts (aa_deletion_receipts stays for ordinary hard delete).

Migration M8: 20260930_0009_aa_retention (down_revision 20260930_0008).
AA tables 27 → 29: aa_retention_policies (append-only intent), aa_retention_runs
(one audit per Apply; counts, horizon, fingerprint; never a deleted value).
Review redaction-reason CHECK widened. Two evidence-backed indexes
(aa_measurements.superseded_by_id partial, overrides.source_fact_id): without them
a 90k-row set delete ran > 590 s; with them 1.3 s.

Settled semantics:

- AA retention is separate from payload.activityLog in both directions; no
  activityLog → AA path exists;
- policy save never deletes; flow = choose → consequences → confirm policy →
  preview (READ ONLY, opaque sha256 token over the exact candidate + redaction
  set) → explicit Apply (confirm: true, idempotent, per-user advisory lock,
  FOR UPDATE + re-derivation; stale ⇒ 409 retention_preview_stale, zero deletion);
- Apply is ATOMIC: redact Review / Saved System Review / relation endpoints /
  fact-importance / provenance first, remove episodes of erased windows, then one
  DELETE per table of whole chains (NO ACTION checked at statement end); a failed
  attempt rolls back and is recorded as a failed run with nothing deleted;
- semantic axes, never created_at: occurred_at (measurements, observations),
  window_end (coverage, expectation, baseline, target), strict in-force rule
  (preferences, metric policies), whole completed Project unit (forecasts, Actual,
  project observations); experiment subjects never pruned;
- effective historical-completeness horizon = latest horizon among COMPLETED runs
  (IANA local month start); Unlimited or a longer policy never restores it; a later
  stricter Apply advances it;
- truthful reads: history retention_horizon / retention_truncated; finance month
  availability retention_truncated with actual null; coverage day bucket
  retention_truncated; Project Analytics history_deleted_by_retention (≠ no_facts,
  ≠ the page-cap forecast_versions_truncated); signal discovery clipped (still 4
  rules); System Review truncated months / windows, no proposals or consequences
  for a truncated month; late explicit old writes accepted and still disclosed;
- F6: legacy transaction / coverage import never resurrects pruned history
  (transactions_retention_skipped / coverage_retention_skipped);
- policy and Apply are gate-independent privacy controls (JSON 415 → same origin →
  session); never via AnalyticsWriteQueue; offline Apply fails visibly;
- no scheduler in v1; deletion only after preview + explicit Apply.

Frontend: Settings section «Хранение аналитической истории» / «Зберігання
аналітичної історії» (components/settings/RetentionSection.jsx), separate from the
activityLog cleanup; retention-specific copy on Review / System Review / Project
Analytics / finance / history / quality surfaces.

Validation at completion: see the implementation report (backend with lifeos_test
DB tests, Vitest, browser matrix 288 loads, perf evidence).

====================================================================
43. OWNER DECISIONS D1–D5
====================================================================

D1 — hard erasure

Hard erasure wins over frozen Review.

Review may survive, but source-derived frozen value is redacted and represented
as source deleted.

D2 — AA retention

Separate from legacy activityLog.

Unlimited by default.

D3 — legacy import

No activityLog import into AA.

AA history begins at rollout.

Genuine current records may become LEGACY_IMPORT observed facts.

Never fabricate:

expectation
forecast
target
baseline
coverage

D4 — Experiment ABANDONED

ABANDONED exists as a lifecycle state.

Lifecycle is orthogonal to outcome.

D5 — durable queue

Durable IndexedDB semantic queue became mandatory for the first user-entered
fact slice and now exists.

Future user-authored AA fact writes should reuse it unless a later accepted
architecture explicitly replaces it.

====================================================================
44. C1–C8 CORRECTIONS
====================================================================

C1:
Legacy recorded_at means ingestion when original recorded time is unknown.
original_recorded_at_known=false.
Preserve genuine occurred_at.

C2:
Signal identity:
episode_key = occurrence
input_fingerprint = exact inputs

C3:
Account-level:
GET /api/v1/export
account deletion account-level

C4:
Normalized review context.

C5:
Missing = no Measurement row.
Missing ≠ zero.
No fake unknown measurement.

C6:
Finance coverage comes from explicit evidence:
aa_source_coverage

Fact presence alone does not prove completeness.

C7:
Historical Finance inclusion comes from captured AA history:

aa_metric_policy_versions
aa_metric_membership_overrides

Current snapshot settings cannot rewrite history.

C8:
Before personal writes:
dev/test schema downgrade may be acceptable.

After personal AA history exists:
production rollback is non-destructive and retains aa_* schema/data.

====================================================================
45. LEGACY IMPORT RULES
====================================================================

Current Finance legacy import only imports genuine existing transactions as:

finance.transaction_amount

source/method include LEGACY_IMPORT semantics.

recorded_at:
ingestion

original_recorded_at_known:
false when unknown

occurred_at:
genuine transaction date/time semantics

Never import:

activityLog
historical expectations
historical forecasts
targets
baselines
synthetic coverage
hardcoded UI budget

Historical absence remains absence.

====================================================================
46. PRIVACY / EXPORT / DELETE
====================================================================

AA history is account-owned.

Account export includes current snapshot and durable semantic history.

Account deletion must cover all account-owned AA records.

Deletion receipt behavior was added in Slice 0b.

When adding a NEW account-owned AA table in future slices:

export registry and account deletion coverage must be updated in the SAME slice.

Never add a history table without export/delete consideration.

====================================================================
47. WRITE GATES
====================================================================

Server:

LIFEOS_AA_WRITE_ENABLED

Client:

VITE_LIFEOS_ANALYTICS_ENABLED

Do not weaken these casually.

Tests may explicitly enable expected behavior.

No production deployment is implied by implementation.

====================================================================
48. CURRENT TEST / QUALITY DISCIPLINE
====================================================================

Before product changes:

run full baseline unless task is explicitly a tiny already-reviewed
comment-only correction.

Backend:

python -m pytest

ruff check .

alembic heads

alembic current

Frontend:

npm test

npm run typecheck

npm run lint

npm run build

Final:

git diff --check

Use:

lifeos_test

for backend DB tests.

NEVER use:

lifeos_dev
production DB
remote/shared production-like DB

unless the owner explicitly authorizes a specific operation.

====================================================================
49. DEPENDENCY POLICY
====================================================================

Default:

NO new production dependencies.

The only specifically authorized dependency added for Slice 2 was:

fake-indexeddb

DEV ONLY.

Do not add another dependency merely for convenience.

Prefer:

current React
current TypeScript/JS
current CSS
browser APIs
existing helpers

Do not run:

npm audit fix

as unrelated cleanup.

====================================================================
50. MIGRATION POLICY
====================================================================

Create a migration only when the approved change requires it.
Current single migration head: 20260930_0009 (M8 retention).
Chain: 20260721_0001 → 20260909_0002 → 20260909_0003 → 20260910_0004
→ 20260928_0005 → 20260928_0006 → 20260929_0007
→ 20260930_0008 → 20260930_0009.
M4=Signals, M5=Review, M6=Experiment, M7=System Review, M8=Retention.
Clarify, Calendar and the current audit fixes use snapshot v2 without a migration.
Never downgrade production personal history. Roundtrip tests use lifeos_test.
alembic current is a database fact and must be verified against a real safe DB;
do not infer it from the migration source DAG.

====================================================================
51. GIT SAFETY RULES
====================================================================

Before modifying the canonical checkout always verify:

pwd
branch
HEAD
git status
origin/main
expected ancestry

If the checkout is unexpectedly dirty:

STOP.

Do not automatically:

git reset --hard
git clean
git stash
git checkout --
git restore
git rebase

unless the task explicitly authorizes that exact recovery action.

Previous Slice 2 work proved why this matters:
a supposedly empty worktree contained substantial uncommitted work.

Never assume a prepared checkout or branch is clean without checking.

====================================================================
52. MERGE POLICY
====================================================================

Project convention:

NORMAL MERGE COMMIT

Do not use:

squash merge
rebase merge
force push

unless the owner explicitly changes policy.

Before merge:

- exact expected head SHA;
- PR open;
- not draft;
- base main;
- current base SHA expected;
- mergeable;
- no unresolved review blockers;
- owner review complete.

After merge:

fetch origin
verify actual merge commit
verify exactly two parents
verify ancestry
record exact new main SHA

Do not rely on GitHub's pre-merge candidate merge SHA until merge is complete.

====================================================================
53. WORKTREE POLICY
====================================================================

SINGLE CANONICAL WORKTREE POLICY

- LifeOS normally has exactly one working checkout:
  `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem`.
- New work uses ordinary Git feature branches in that checkout.
- Do NOT create a Git worktree unless the owner explicitly requests one.
- Do NOT copy or clone the entire LifeOS project for a normal task.
- Before branch switching, the canonical working tree must be clean.
- If unfinished concurrent work prevents branch switching, STOP and ask the
  owner rather than creating another worktree automatically.
- After a feature PR is merged: switch to `main`, fetch, update with
  `git merge --ff-only origin/main`, and delete the merged local feature branch.
- Completed worktrees must not accumulate.
- Do not push an empty prepared branch merely because it exists.

====================================================================
54. IMPLEMENTATION REPORT POLICY
====================================================================

Every substantial implementation should create:

Outputs/Implementations/<descriptive-name>_<timestamp>.md

Report should contain:

- exact start state;
- sources reviewed;
- baseline;
- architecture;
- semantic decisions;
- changed files;
- tests;
- bundle delta;
- migration/dependency changes;
- deviations from plan;
- non-scope;
- verdict;
- commit / PR metadata where appropriate.

The report is part of owner review.

Do not hide pre-merge corrections.

Append a clear correction section.

====================================================================
55. COMPLETED REPORTS ARE HISTORICAL RECORDS
====================================================================

Do not casually modify completed reports.

Allowed exception:

while an active PR is still under owner review, a small pre-merge correction may
update that PR's report to document the correction.

Once merged, treat the report as historical evidence.

====================================================================
56. FROZEN DESIGN / PLAN / DISCOVERY FILES
====================================================================

Do not modify accepted frozen documents merely to make implementation easier.

In particular:

- frozen A–J design kit;
- Discovery;
- final Phase B Plan;
- completed implementation reports;
- frozen tag.

If implementation reveals a genuine contradiction:

report it.

Do not rewrite the evidence.

====================================================================
57. FRONTEND UX / DESIGN PRINCIPLES
====================================================================

Production UI should use current LifeOS design primitives.

Preserve:

- Hero Vignette;
- PageHeader behavior;
- current themes;
- RU/UK localization;
- accessibility;
- keyboard behavior;
- reduced motion;
- responsive layouts.

Do not create a parallel global design system.

Avoid broad prototype CSS selectors.

Scope new component styling responsibly.

No fake data in runtime simply for screenshots.

====================================================================
58. PARADISE / HERO BEHAVIOR
====================================================================

Paradise theme:

uses existing ParadiseScene + Hero/PageHeader integration.

Dark/light:

compact fallback.

When adding a new primary page, inspect current production PageHeader usage and
follow it.

Do not reimplement Hero assets.

====================================================================
59. LOCALIZATION
====================================================================

Current enabled locales:

ru
uk

English is intentionally not enabled.

When adding user-facing strings:

add RU and UK.

Do not enable English just because a slot exists.

====================================================================
60. DO NOT OVERBUILD
====================================================================

LifeOS development intentionally uses narrow slices.

Examples of things Slice P explicitly did NOT add:

tasks-in-projects
subtasks
dependencies
epics
sprints
milestones
assignees
resource planning
Gantt
critical path
templates
bulk operations
percent complete

The same philosophy applies elsewhere.

If a feature is not needed for the accepted slice:

do not build it "while we're here."

====================================================================
61. NO OPPORTUNISTIC REFACTORING
====================================================================

When implementing a slice:

change the smallest necessary surface.

Do not:

- reformat unrelated modules;
- rename unrelated concepts;
- move directories for taste;
- replace working architecture;
- repair unrelated warnings;
- update dependencies;
- redesign neighboring pages.

If unrelated red baseline appears:

STOP with a clear blocker.

Do not fix it inside the requested slice unless explicitly authorized.

====================================================================
62. REVIEWING CLAUDE CODE OUTPUT
====================================================================

When the user pastes a Claude Code result:

Do not merely say "looks good."

Check:

- exact starting SHA;
- final SHA;
- branch/worktree;
- files changed;
- migration count;
- dependencies;
- test counts;
- report path;
- PR metadata;
- unexpected scope;
- current main.

If full report is not available:

ask for it or fetch it from GitHub if committed.

For merge decisions:

inspect the actual report and PR diff.

====================================================================
63. GENERATING CLAUDE CODE PROMPTS
====================================================================

The user often wants a single paste-ready autonomous prompt.

Good CC prompts should include:

- title;
- exact goal;
- exact repo/worktree/branch;
- expected current SHA;
- authoritative documents to read;
- precondition verification;
- hard STOP conditions;
- scope;
- non-scope;
- exact semantic rules;
- test plan;
- full validation;
- implementation report requirement;
- commit message;
- push/PR instructions;
- explicit no-merge rule unless merge is the task;
- final machine-readable status fields.

Do not make the user manually perform 20 Git commands when CC can do the task
safely.

====================================================================
64. BLOCKER PHILOSOPHY
====================================================================

If a feature requires a real product decision:

STOP.

Do not invent hidden business logic.

Good prior example:

Clarify integration stopped because:

Delegate
Defer
Reference
Project

did not have canonical mappings.

That stop was correct.

Then owner decisions were made and Project foundation was implemented.

A BLOCKED result is better than silently corrupting product semantics.

====================================================================
65. CURRENT NEXT STEP
====================================================================

All accepted Adaptive Analytics slices through Slice 8 and Calendar PR #17
are merged. Remote main is the SHA in section 3.

The 2026-09-30 completion audit found two frontend integration defects:
Calendar closures still shown/counted as open in Tasks/Sidebar, and the
retention consequences date calculated in the browser timezone instead of Kyiv.
Fixes and regressions are committed on the local branch
fix/lifeos-completion-audit (section 78) and validated in the canonical checkout
(backend on lifeos_test, frontend gates, focused browser/API QA). They are not
merged until a PR is reviewed and merged by the owner's normal policy; verify
live. Do not start an invented Slice 9.

GTD completion status and the proposed GTD slice order (G1 Waiting For
lifecycle first, owner decisions pending) are recorded in section 79.
Owner's JENKIN requirements (visible rename, interface pass, planned Calendar /
Events / Inbox / capture / recovery / Documents work) and the lifeos_dev
migration gap: section 84. The approved JENKIN shell, compact Tasks and nested
tile Calendar are implemented on the pushed branch handoff/jenkin-cloud-20260930
(section 85); the Editorial logo, favicon and optional DejaVu Sans interface
font are on feat/jenkin-branding-assets-20261001 (section 86). Both are
integrated and verified on integration/jenkin-calendar-branding-20261001
(section 87; not merged). The security/account foundation (S0/S1: account
binding, safe sync/logout, empty new accounts, invitations, recovery, sessions,
throttling, audit) is on feat/jenkin-account-security-20261001 on top of it
(section 88; not merged). Next: owner review of both branches; then S2
(encryption + document foundation). Events and the other JENKIN slices are NOT
started.

Latest features can be tested in apps/web + apps/api on a disposable account.
Destructive retention QA must use lifeos_test, never personal data.
LifeOS as a whole is NOT complete: confirmed remaining product gaps are in §78.
Follow the single canonical checkout policy on the owner's Mac.

====================================================================
66. CLARIFY CONTRACT FOR FUTURE CHANGES
====================================================================

Clarify is complete; this is a regression contract, not a future task.
Reuse the existing domain builders, snapshot collections and retrieval surfaces.
Preserve all six outcomes, keyboard/focus behaviour, RU/UK, and failure/cancel
semantics. Remove the source note only after outcome persistence succeeds.
Never map Project to Goal, or Waiting/Reference to hidden tags.

====================================================================
67. CLARIFY SNAPSHOT COLLECTIONS
====================================================================

waitingItems[] and references[] are accepted operational collections.
They are additive within version 2 / schema_version 2.
Exact validation/migration and field names live in current domain/clarify.ts,
context/lifeData/migrate.js and the accepted implementation report.
Do not reinterpret old provisional shape suggestions as new implementation work.

====================================================================
68. CLARIFY SUCCESS CRITERION
====================================================================

Clarify is complete only if all six outcomes produce real durable operational
state:

Do Now
Delegate
Defer
Project
Reference
Delete

and the UI:

- faithfully reflects the handoff;
- works on mobile/desktop;
- is keyboard accessible;
- has correct focus/modal semantics;
- preserves the source note on cancellation/failure;
- deletes/removes the source note only after successful outcome persistence;
- does not route Project into Goal.

====================================================================
69. AFTER CLARIFY — HISTORICAL SEQUENCE
====================================================================

Clarify review and merge completed. Subsequent work includes Slice 3, Slice 4,
architecture modularization, forecast correctness, Slice 5, Slice 6, Calendar,
Slice 7, F3 and Slice 8. Current work is final completion audit and narrow fixes.
Do not restart the old Clarify → Slice 3 sequence.

====================================================================
70. CURRENT IMPORTANT COMMITS / LANDMARKS
====================================================================

Frozen design:

d4960286ec94f35472600e59c0d533dc50a64351

Discovery:

f6e27f3060a735458735e8acbdce8abc5f2bb0f0

Phase B Plan freeze:

362a2d60a4fe574a5ec85366a732c1036dd07fe5

PRE-0 report commit:

f27a338d5dc0c041c8330a77376ec24baa2ebaba

Slice 0 implementation:

b19b7019a46c68c324087d16724735507a5bd597

Slice 0b implementation:

2205c3e7f589f1a72fda67d335612a6971c7af92

Slice 1 implementation:

7687e88316f515021ef9b7f7d693e842405552c2

Hero implementation:

7a56584d389a07a0890490a92f4bfac760e11b8a

Hero merge:

81ea9b098ab18a9bcf35b890a6412383be10216c

Slice 2 implementation:

f463737c47ec7ce09fcd82fdfc81d65b1369347b

Slice 2 timezone fix:

b6e53ec198c59299a83202882a746e197f9c27f1

Slice 2 merge:

ec158fc44f554c04f1c43d22d1e93d67ed9a44ed

Slice P implementation:

690b39a8dd24537d49b3148767bc3b3fcdb92cbb

Slice P semantic cleanup:

c36e4f67e6b0cf8288bd149cd89f0347e3c10e95

Historical Slice P merge:

3570426a80988f2715f48bb9a12261d3ee122056

Later merge landmarks:
Architecture #13: 48e38c2287f525d50c9d31a40a5934e406234f4b
Forecast fix #14: 63e41adebf22400dca3e30330bb347f4feef6027
Slice 5 #15: 414df142700653d616016ff644bff3d9c0007540
Slice 6 #16: 55ac0408d5cffebbc514a591e15e56f18edaaf39
Calendar #17: fffcd4b3d7edaefa87a1b117634c8bfad7caf6d9
Slice 7 #18: 4f19c5ef9e74f42513099ca1ad3fa4938c86364c
F3 #19: b8d129e87f48217eac6eda39d1b208a1b047cdfc
Slice 8 #20 / verified remote main: 5e858bb0322be0cc729d3d7e73ce359597aada84

Never assume latest verified main is still current without checking GitHub.

====================================================================
71. IMPORTANT PR HISTORY
====================================================================

All PRs #1–#20 verified merged on 2026-09-30.

| PR | Work |
|---|---|
| 1 | Foundation / design import / PRE-0 |
| 2 | Slice 0 semantic history |
| 3 | Slice 0b export/delete |
| 4 | Slice 1 semantics |
| 5 | Hero Vignette |
| 6 | Slice 2 Finance + durable queue |
| 7 | Slice P Project domain |
| 8 | Single canonical checkout consolidation |
| 9 | Clarify |
| 10 | Slice 3 Signals |
| 11 | M4 context correction |
| 12 | Slice 4 Review |
| 13 | Architecture modularization |
| 14 | Forecast revision signal correctness |
| 15 | Slice 5 Project Analytics |
| 16 | Slice 6 Experiments |
| 17 | Calendar Cube Redesign |
| 18 | Slice 7 System Review / relationship intelligence |
| 19 | F3 AA history SQL tuple cursor |
| 20 | Slice 8 Retention |

For exact head and merge SHAs see the 2026-09-30 audit report and live GitHub.
Never infer a future PR's state from this historical table.

====================================================================
72. GITHUB VS LOCAL FILESYSTEM
====================================================================

A ChatGPT session with GitHub connector can inspect:

- repository;
- branch files;
- commits;
- PRs;
- committed reports.

It cannot automatically inspect:

/Users/yurasachenko/...

on the user's Mac.

Claude Code running locally can.

Do not confuse these capabilities.

If a current report exists only locally and is not committed:

ask user to attach it.

If committed to a branch:

fetch it from GitHub instead.

====================================================================
73. HOW TO START A NEW LIFEOS CHAT
====================================================================

On first engineering question, do approximately:

1. inspect GitHub `main`;
2. inspect open PRs if relevant;
3. compare with latest SHA in this prompt;
4. identify the requested branch and confirm the canonical checkout;
5. read authoritative report/plan;
6. inspect current code;
7. answer or generate implementation prompt.

Do NOT immediately act from historical memory.

====================================================================
74. HOW TO HANDLE "WHAT IS THE NEXT STEP?"
====================================================================

Return one concrete next action.

Do not produce five competing paths unless genuinely necessary.

State why that action comes next.

If code implementation is next:

give a complete paste-ready CC prompt.

If review is next:

review the full report/diff first.

If merge is next:

verify PR/current base/head first.

If a product decision is missing:

surface the exact decision.

====================================================================
75. QUALITY BAR
====================================================================

A PASS means:

not merely "code compiles."

It means:

- semantic contract satisfied;
- scope contained;
- history preserved;
- failure behavior intentional;
- privacy/export implications considered;
- migrations correct;
- tests meaningful;
- full regression green;
- current design not regressed;
- report accurate;
- branch/PR state verified.

====================================================================
76. DO NOT LIE ABOUT COMPLETION
====================================================================

Never say:

"merged"
"clean"
"current main is..."
"report reviewed"
"tests passed"

unless actually verified from available evidence.

If only a user-provided status says so, clearly treat that as reported state.

If GitHub can verify it, verify it.

====================================================================
77. FINAL OPERATING PRINCIPLE
====================================================================

LifeOS development favors:

truthful semantics
durable history
small reversible slices
explicit owner decisions
strong verification
no silent data loss
no accidental scope expansion

When uncertain:

inspect first.

When semantics are unresolved:

stop.

When a current implementation is already correct:

reuse it.

When history matters:

append/version rather than overwrite.

When current operational state differs from semantic history:

keep them separate.

When old comments contradict accepted architecture:

do not resurrect them.

Project is not Goal.

Actual is not Forecast.

Expectation is not Target.

Missing is not zero.

And no global Life Score exists.


====================================================================
78. COMPLETION AUDIT — 2026-09-30 / FIXES ON fix/lifeos-completion-audit
====================================================================

Evidence sources: supplied earlier MASTER_CONTEXT, supplied escaped Markdown
discussion fragment, available prior-chat retrieval, current repository context,
committed Calendar/Slice 8 reports, live PR/main metadata and current source.
Prior-chat retrieval provided selected fragments, not a full chat transcript.
Current repository context already contained Slices 3–8 but retained stale
top-level SHA, migration facts and Clarify preimplementation instructions.
This revision reconciles those contradictions; frozen reports remain untouched.

Remote implementation status: PASS for merged slices through 8 and Calendar.
Fresh frontend validation: PASS on remote main (535 tests).
Transfer audit: backend runtime and browser/API validation NOT RUN there.
Canonical-checkout audit (Outputs/Implementations/lifeos-completion-audit_20260930-125002.md):
backend 748 passed + 1 opt-in perf skip on lifeos_test, ruff PASS, Alembic
head/current 20260930_0009, 29/29 registry parity; frontend 540/43; focused
browser/API QA on a disposable lifeos_test account (Calendar/Tasks 22 checks,
retention 27 checks, 240 visual loads).
Full LifeOS product completion: NOT COMPLETE.

Audit fixes (on branch fix/lifeos-completion-audit; not in remote main when written):
1. TasksPage excludes archived/closed_unresolved tasks from ordinary task
   controls; Tasks/Sidebar open counts use isTaskActive. Completed tasks retain
   their old list behaviour; closed rows remain in Calendar History; Restore
   returns the same task id. Three regressions were red before the fix.
2. Retention consequences horizon uses Europe/Kyiv via localDateForInstant,
   returning a date-only boundary. Browser-local getMonth/getFullYear could show
   the previous month at Kyiv midnight; two RU/UK month/year-edge regressions
   were red before the fix. Server preview/apply semantics were already correct.
No backend, schema, dependency, queue or stored data mutation is part of these fixes.

Follow-up frontend fixes D1–D3 (2026-09-30, same branch; uncommitted when
written on top of 1b396eb, since committed locally as 1845c5f; report
Outputs/Implementations/lifeos-audit-frontend-fixes_20260930-134139.md):
3. D1 ForecastHistory branches on the server's retention_history_deleted /
   history_deleted_by_retention (never on an empty array): empty sections say
   «недоступны после правила хранения» (RU/UK), ordinary empty keeps «не
   записан», retained records always render. D1b: ProjectAnalyticsPage tags
   each read with its project id, so one project's retention state is never
   shown under another project's title while a read is in flight.
4. D2 MetricHistoryPage loads on cold entry/reload via the existing
   AnalyticsContext.loadFinance (no duplicate request; in-app navigation reuses
   the loaded month); distinct loading / error+retry / empty / history;
   fully RU/UK; horizon via formatDateOnly (date-only, zone-safe). loadFinance
   clears `loading` on abort. AAChart strings localized (RU byte-identical).
5. D3 Paradise 768px overflow: root cause was NOT ParadiseScene (fixed +
   overflow:hidden; hiding it changed nothing) but the paradise-only TopBar
   plate/eyebrow widening the TopBar min-content beyond the main grid track.
   Fix: paradise .tb wraps its search row (≥641px). Matrix after: 0 overflow
   in 432 loads (all themes, RU/UK, 320–1440 incl. tablet widths, animations
   scrubbed); before: +16 RU / +25 UK reproduced.
Frontend after D1–D3: 561 tests / 45 files, typecheck, lint, analytics build
PASS; browser flows 22/22 on lifeos_test with the SAME project p-done in the
snapshot and its analytics genuinely pruned. Backend unchanged (not rerun).

Confirmed wider product gaps (scope must be planned separately):
- HealthPage is a static skeleton, not health record management.
- monthly / annual / investments routes still render PlaceholderPage. They
  are distinct from the implemented System Review monthly/annual views.
- Goals supports add/read; complete edit/delete/progress workflow is absent.
- Home cards still derive task/streak/goal values and historical finance trend
  from LifeDashSeed. Do not advertise them as complete observed history.
- Mobile 'more' goes to Settings; no full LIFE route drawer exists.
- Dog has editable operational fields, but meal-history link is a no-op and
  restock uses fixed 7000g; complete consumption/history mechanics are absent.
- Root README/ARCHITECTURE still describe the legacy design/prototype layer.
- Tasks page filters «сегодня» / «просрочено» still use legacy predicates
  (tag === 'today' || stakes; a ':' in the display due label), not
  schedule.date semantics. Needs an explicit owner decision before changing.
- Project history_deleted_by_retention is now browser-verified with the SAME
  project in the operational snapshot and genuinely pruned AA evidence.
- Paradise overflow at 768px (+16 px RU / +25 px UK): FIXED in the working
  tree (item 5). The earlier attribution to ParadiseScene ps-layer/ps-cloud was
  wrong. The Slice 8 harness missed it because its goto() applied the theme via
  a same-document hash navigation; harnesses must also re-select UK after every
  full load (locale is in-memory app state and resets to RU on reload).
- Project Analytics history sub-sections after retention: FIXED (item 3).
  Contract limit: the server flags an erased project only when nothing
  survives, so a forecast recorded after pruning hides the erased-history note.
- MetricHistoryPage cold entry / RU-only copy / raw ISO horizon: FIXED (item 4).
  Still open: shared AAHistoryList prints raw ISO instants and provenance
  enums; FinanceAnalytics has hardcoded Russian and a raw ISO horizon.
- Sidebar habits/goals counts are hardcoded (7 / 3) in App.jsx.
- components/Today.jsx and TaskList.jsx still count !done but are not imported.

Do not reinterpret these findings as authorization to invent new domain semantics.
Next action: owner review of branch fix/lifeos-completion-audit (the two narrow
fixes, the uncommitted D1–D3 follow-up, this context and both reports), then —
only if authorized — commit, and the normal PR
and merge-commit flow. Afterwards choose and plan the next product scope from the
gap list above (Discovery → Plan → Implementation). Publishing/deploying is not
implied by the audit.

====================================================================
79. GTD STATUS — RECONCILED 2026-09-30
====================================================================

Evidence: Outputs/Discoveries/lifeos-gtd-current-state_20260930-131011.md
Plan:     Outputs/Plans/lifeos-gtd-completion-plan_20260930-131011.md
Both were written on local branch fix/lifeos-completion-audit (HEAD 1b396eb,
not pushed at the time). GTD code on that HEAD is identical to remote main
5e858bb except the TasksPage closure exclusion from section 78.

Verified (code read + 120 targeted frontend tests on 2026-09-30):
- Capture (Quick Notes inbox) and Clarify, all six outcomes, complete and
  durable in the server snapshot. Defer = explicit future schedule.date; no
  hidden someday bucket.
- Waiting items: create + read-only list only. No edit, no person entry (Clarify
  Delegate always stores waiting_for = null), no resolve/convert/delete.
- References: create + read-only list only.
- Tasks «сегодня/просрочено» use legacy predicates, not schedule.date, so
  clarified Do Now / Defer tasks never appear under «сегодня».
- No Task↔Project link and no next action; Clarify→Project creates a bare Project.
- No GTD Weekly Review. AA Review/Debrief and System Review are not substitutes.
  The System Review copy (aa_sr_relation_to_rest, RU/UK) mentions a
  «недельный обзор задач» that does not exist.
- No Focus Now / Engage surface; Home task card is seed data.

Requirement standing (inference from sources, not an owner decision):
next actions, Weekly Review, Focus Now, @contexts/energy/time, Someday/Maybe,
Areas, horizons, Inbox Zero and Waiting follow-up dates come only from the
2026-07-01 MASTER-PROMPT §C proposal (archived as obsolete-instructions;
forensic: PROPOSED_SCOPE_INPUT). They are not requirements until the owner
accepts them. The original conversations.json export is missing.

Unknown: owner authorship of that proposal; live browser reload round-trip for
waitingItems/references (inferred OK, not re-run).

Recommended next GTD slice: G1 Waiting For lifecycle (frontend-only, additive
optional fields, snapshot v2, no migration), after the completion-audit branch
is published. Blocking owner decisions: OD-G1-1 resolution model, OD-G1-2
where the person is entered, OD-G1-3 follow-up date (see the plan §7).
G1 status update (2026-09-30): owner approved the recommended OD-G1-1..3 and
G1 is IMPLEMENTED in the working tree, uncommitted — see section 81. The
Waiting bullets above describe the state before G1.

====================================================================
80. UI SOUND EFFECTS — IMPLEMENTED 2026-09-30 (LOCAL COMMIT bc5bc64)
====================================================================

Report: Outputs/Implementations/lifeos-ui-sound-effects_20260930-153327.md
Working tree on fix/lifeos-completion-audit (HEAD 1b396eb when written);
not committed, not pushed, no PR. Verify live.

- Owner clips staged at repo-root sfx/ (untracked, read-only source). Runtime
  copies in apps/web/src/assets/sfx/ (12 standalone byte-identical + 5
  lossless cuts sfx_seg01/03/07/08/12 of sfx.mp3). sfx.mp3 = the 12 cues in
  alphabetical order; 7 exact duplicates, 5 alternate renders. No sprite at
  runtime; sfx.mp3 is not bundled.
- Facade apps/web/src/sound/index.ts (catalog / preferences / engine /
  gestures). One cue per trusted gesture; app events via sfx.emit at the
  existing success boundary: task.complete = local open→done transition
  (not server ack); save.success = server-acknowledged saves only (today the
  retention policy PUT). Local-first saves get the activation cue only.
- Preferences are browser-local localStorage `lifeOsSfx` (device setting,
  like lifeOsTheme): enabled, volume 25 %, hover off by default. No backend,
  no migration.
- Settings → «Звуковые эффекты»: switches, volume, per-event assignment with
  preview (works while muted), None, restore defaults, test bench.
- Not listened to by the agent: default mappings for task.complete (release),
  save.success (decoding) and the long expand (peak 2.7 s) / menu (~0.9 s)
  swells await the owner's listening review.
- Frontend after this: 601 tests / 47 files, typecheck, lint, build PASS;
  production-preview browser checks on lifeos_test; 0 overflow in Settings
  at 320/390/768/1440 × RU/UK × dark/light/paradise.

====================================================================
81. GTD G1 — WAITING FOR LIFECYCLE — IMPLEMENTED 2026-09-30 (LOCAL COMMITS c1353e1, fdd1bb9)
====================================================================

Report: Outputs/Implementations/lifeos-gtd-g1-waiting-lifecycle_20260930-162127.md
Working tree on fix/lifeos-completion-audit (HEAD 1b396eb when written), on
top of the uncommitted audit D1–D3 and UI-sound work; not committed, not
pushed, no PR. Verify live.

Owner decisions applied (approved 2026-09-30): resolved Waiting records are
KEPT with resolution received | cancelled | converted + resolved_at
(+ converted_task_id for converted); active and closed are shown separately;
received/cancelled restore with the same id; converted never restores through
Waiting; permanent delete is separate and confirmed; the person stays optional
free text edited after Delegate; the one-tap Clarify Delegate is unchanged; no
follow-up dates, reminders, contacts, Calendar entries or AA facts; convert
creates one ordinary undated Task (createClarifiedTaskRecord) with the Waiting
title, the person stays on the closed Waiting record, no invented notes.

- Domain: apps/web/src/domain/waiting.ts (pure). applyWaitingCommand returns
  applied | unchanged | invalid; conversion writes the Task and closes the
  record in ONE returned state; repeat conversion is `unchanged` (one task).
  validateWaitingLifecycle runs in migrate.js after clarify's validator; legacy
  four-field rows stay valid active records. domain/clarify.ts, ClarifyPanel,
  clarifyHandlers and all Clarify tests are byte-identical to origin/main.
- Provider: LifeDataContext.runWaitingCommand runs the transition inside the
  functional updater under flushSync, so the outcome is read from the state
  React applies (queued updates included), not the render closure. Only
  `applied` is announced; stale/missing ids give a localized error.
- UI: Tasks → «ожидание» (WaitingSection in TasksPage.jsx): openable rows,
  active count, collapsed «закрыто» list with localized outcome + Kyiv date,
  «вернуть» only for received/cancelled; WaitingItemModal (useDialog focus trap,
  Escape, Save = submit, outcomes keep the dialog open on the closed record,
  two-step delete). RU/UK +37 keys each (dictionary pin 1806/1805).
- Sound: no new emits. Outcomes play the ordinary click (dialog stays open);
  Received is not task.complete; no save.success for a local snapshot change.
  Confirmed delete closes the dialog and plays close_window, the same as the
  existing TaskDetailModal delete.
- Persistence: additive fields in snapshot v2; no backend, migration or version
  change. Verified: legacy load, JSON round-trip, reload, export ZIP
  (user_snapshots) carries the fields. Older client (real origin/main 5e858bb
  bundle in the browser) loads a G1 snapshot and its own PUT preserved
  waitingItems byte-identically, BUT it shows closed records as ordinary
  waiting rows and cannot act on them (mixed-version limitation, transient).
- Frontend 653 tests / 49 files, typecheck, lint, build PASS; backend 748
  passed + 1 skipped with LIFEOS_AA_WRITE_ENABLED=false (the local ignored
  apps/api/.env otherwise opens the AA gate for one gate test); ruff PASS;
  alembic head/current 20260930_0009.
Committed 2026-09-30 as c1353e1 (see section 82 for the commit sequence).
Follow-up (focused commit after G2, no history rewrite): closedWaitingItems
orders by the parsed resolved_at instant (offsets such as +03:00 vs Z), stable
for equal instants; Waiting transitions are deterministic including activity
ids — commitWaitingCommand prepares the ids once outside the React updater
(a StrictMode re-run yields the identical state), separate commands get
distinct ids, and a direct pure call derives ids from its inputs.

====================================================================
82. GTD G2 — TASK DATES AND RESCHEDULING — IMPLEMENTED 2026-09-30 (LOCAL COMMITS)
====================================================================

Report: Outputs/Implementations/lifeos-gtd-g2-task-dates_20260930-180255.md
Local commits on fix/lifeos-completion-audit (not pushed, no PR, verify live):
1845c5f audit D1–D3 (+ post-review MetricHistory/loadFinance hardening),
bc5bc64 UI sound effects, c1353e1 GTD discovery/plan + G1, then the G2 commit.
Owner inputs deliberately untracked: repo-root sfx/ (audio originals),
LifeOS_Completion_Audit_20260930.md, apps/web/src/Архив.zip (appeared during
the session; not created by the agent).

Owner-approved semantics (2026-09-30): «сегодня» = active tasks whose
schedule.date equals the Europe/Kyiv date; «просрочено» = isTaskOverdue;
undated tasks only under «все» (tag 'today' / stakes / due labels are never date
authority); completed, archived and closed_unresolved never appear in either;
Do Now stays undated; legacy records are not backfilled.

- domain/tasks.ts: tasksDueToday, overdueTasks, sortTasksByDate (date, then the
  Calendar day order — explicit order, timed before untimed, stored position —
  undated last, stable).
- domain/calendarModel.ts: validateScheduleInput / scheduleEdit shared by the
  Calendar editor and the Tasks detail (a time without a date is rejected;
  clearing the date clears its time and asks for confirmation), msUntilNextDay.
  The Calendar editor now also rejects a dateless time (previously stored).
- app/useKyivToday.js: the open Tasks view follows the Kyiv day (timer to the
  next Kyiv midnight, capped at 1 h, plus focus/visibilitychange/pageshow).
- TaskDetailModal: date/time fields, «убрать дату», confirmation, shared
  useDialog (focus trap, Escape, focus return), truthful missing-task state.
  Save of a schedule change goes through moveTask (same id, new day order,
  due re-derived); app/taskDetailSave.js returns {ok:false} for a missing task
  and never recreates it. Home seed rows stay display-only (no date fields).
- Tasks rows show the Calendar date (<time dateTime>) for dated tasks, red when
  overdue; undated rows keep the legacy label. RU/UK +5 keys (1811/1810).
- No backend, migration, snapshot-version or sound-mapping change; scheduling
  is a local snapshot mutation (no save.success).
Frontend 682 tests / 50 files, typecheck, lint, build PASS; G2 date tests pass
under TZ=UTC, Europe/Kyiv, America/Los_Angeles, Pacific/Kiritimati.
Next: owner review of the local commits; G3 is NOT started (see section 83).

====================================================================
83. AUDIT FOLLOW-UP — CALENDAR KYIV DAY + STALE EDITOR DRAFTS (LOCAL COMMITS)
====================================================================

Report: Outputs/Implementations/lifeos-calendar-today-editor-drafts_20260930-190500.md
Local commits on fix/lifeos-completion-audit after fdd1bb9 (not pushed, no
PR, verify live): ce985a7 Calendar Kyiv day, 4c6f04c editor drafts.
Status of the branch at this point: 1845c5f D1–D3, bc5bc64 UI sound,
c1353e1 GTD plan + G1, 59683ac G2, fdd1bb9 G1 follow-up, ce985a7, 4c6f04c.
Sections 80–82 are the historical records of those commits.

- Calendar: CalendarPage derives bounds from useKyivToday() through
  calendarBoundsForDay(tasks, today, openedYear) — no new timer, no second
  timezone path. Today highlight, the Today button, the current-year window
  and the open Day Manager's overdue / «закрыть без выполнения» controls move
  at Kyiv midnight and on tab return. Explicit month/year/day routes, the Day
  Manager key and an open editor do not depend on today. The undated
  #/calendar keeps meaning "the current Kyiv month" (follows the rollover).
  The Kyiv year the page opened in stays navigable after a New Year rollover
  (floor on minYear), so an explicit route into the year just left is not
  replaced; a fresh load keeps the old min(current year, earliest task) rule.
- Editors: domain/editDraft.ts (reconcileDraft / rebaseUntouched /
  resolveDraftConflicts). CalendarTaskEditor and TaskDetailModal keep a
  baseline; untouched fields follow the persisted task live and are never
  re-sent; edited fields are saved; a field edited by the user AND changed in
  the persisted task is a conflict — nothing saved, draft kept, localized
  EditConflictNotice (RU/UK +7 keys, pin 1818/1817) with «взять сохранённое»
  (take saved, stay open) or «оставить моё» (explicit overwrite; re-checked).
  Date + time are one unit (scheduleEdit(task, input, baseline) → conflict).
  An emptied Tasks-detail title stays "not an edit" (unchanged rule).
  Missing-task protection, lifecycle, validation and clear-date confirmation
  unchanged. Calendar editor: a task deleted while editing still unmounts the
  editor (existing behaviour; the draft is lost) — known limitation.
- Frontend 727 tests / 52 files, typecheck, lint, build PASS; new tests also
  pass under TZ=UTC, Europe/Kyiv, America/Los_Angeles, Pacific/Kiritimati.
  Production preview on lifeos_test: both editor repros, a same-field title
  conflict (keep mine), a schedule conflict (take saved), deleted task in the
  Tasks detail, Kyiv midnight (focus) and New Year (visibilitychange)
  rollovers with an explicit route + open editor. No backend change.
Next: owner review; G3 is NOT started.

====================================================================
84. JENKIN — OWNER REQUIREMENTS + INTERFACE PASS (LOCAL COMMIT, 2026-09-30)
====================================================================

Plan:   Outputs/Plans/jenkin-product-design-plan_20260930-201921.md
Report: Outputs/Implementations/jenkin-interface-pass_20260930-201921.md
Local commit on fix/lifeos-completion-audit after 6d35179 (not pushed, no PR,
verify live). Sections 78–83 and the GTD G3–G6 roadmap (section 79 + GTD plan)
are unchanged and still authoritative for their scope.

Owner requirements (2026-09-30):
- The visible product name is JENKIN. Storage identifiers, snapshot/export
  compatibility, authentication behaviour and historical document names are
  preserved. The technical rename and the GitHub repository rename are planned
  separately (plan §1.3). No remote rename happens without explicit owner action.
- Implemented now (frontend only): the Tasks filter chips became one labelled
  native <select> with every filter (Waiting and Completed included); sort stays
  a separate control; the Tasks title is the same size as its date metadata
  (--text-sm; root cause was .task-title-btn `font: inherit` → 16 px); the
  sidebar email wraps at 12 px (break before «@», full address in title) with
  sync on its own line; the JENKIN wordmark/login/<title>/application-name are
  in place; the RU/UK product mentions say JENKIN (+1 key, pin 1819/1818).
- Planned, not started (each: Discovery → Plan → owner decisions): nested
  Calendar redesign — WAITS FOR THE OWNER'S VISUAL PROTOTYPE, agents must not
  redesign Calendar geometry independently; Events (separate from Tasks);
  dedicated Inbox (over the existing Quick Notes + Clarify); smart capture
  (suggest-only, confirmed by the user); account recovery (recovery codes first)
  and passkeys (needs a migration, so an explicit task); Documents (metadata
  first); phone-number-change workflow (a checklist, not automation).
  The plan marks OWNER requirements vs agent recommendations (REC) vs UNVERIFIED
  integrations.
- Do not implement: HELSI, BankID, Diia integrations (UNVERIFIED), private-key
  storage, outbound automation.

Still named LifeOS on purpose: localStorage keys lifeOs*, IndexedDB
lifeos-adaptive-analytics, export filenames, LIFEOS_* env, DB names, package
@life-os/web, repo yurafreedom/LifeOS, this file. Visible inconsistency left
for plan §1.3 R1: backend System Review DOCX/PDF export labels, the DOCX creator,
the PDF producer and the API title still say LifeOS.

Validation: frontend 738 tests / 53 files, typecheck, lint, build PASS; browser
matrix 320/390/768/1440 × RU/UK × dark/light/paradise day+night on lifeos_test
(0 overflow, 12 px floor, all filters switch). Backend unchanged, not rerun.
Observed pre-existing, not fixed: in paradise-day, unchecked .task-check borders
are nearly invisible on the cream task card.

DATABASE GAP (explicit): lifeos_dev is at alembic 20260721_0001; the repository
head is 20260930_0009 (read-only check 2026-09-30). lifeos_dev is NOT at the
current schema; lifeos_test passing does not imply otherwise. Upgrading
lifeos_dev is the owner's decision; agents migrate only lifeos_test.
Next: owner review of the local commits; G3 and the JENKIN feature plans are
NOT started.
Status note (2026-10-01): superseded in part by section 85 — the nested Calendar
(from the owner's approved prototype), the paradise-day unchecked task border and
the backend JENKIN labels/metadata are now done on handoff/jenkin-cloud-20260930;
the Editorial logo, favicon and interface font are section 86; the integrated
state is section 87. The rest of this section is kept as the historical record.

====================================================================
85. JENKIN — SHELL, COMPACT TASKS, NESTED TILE CALENDAR (PUSHED BRANCH, 2026-10-01)
====================================================================

Report: Outputs/Implementations/jenkin-cloud-shell-tasks-calendar_20261001-013804.md
Branch handoff/jenkin-cloud-20260930 (pushed; no merge, no deploy; verify live).
Start d396fa9 (handoff commit, on top of bb3c147). Code commits: 0730f84 shell +
account + backend labels, 12043cf compact Tasks, 095be58 nested Calendar,
1594c4d contrast floors, 05c420a 12 px stage floor, f1f3892 review hardening;
then one docs commit (this section, the report, module boundaries, screenshots).

Implemented (scope A–C of JENKIN_CLOUD_TASK.md):
- Material tokens (--mat-*, --warm-beige, --today-text, --today-num) in the
  existing theme system for dark, light, paradise-day (night inherits dark); no
  new stylesheet layer (cascade manifest still 14 layers). Contrast measured in
  the browser: unchecked task boxes >= 3:1, text cues >= 4.5:1 in all four themes.
- Account block: profile name only if entered, real email on its own line at
  12 px (wraps, full value in title), real sync phase on a separate warm-beige
  line. Backend visible output says JENKIN (FastAPI title; System Review RU/UK
  labels; DOCX creator, XLSX application, PDF producer); file names stay lifeos-*.
- Tasks: one filter <select> with truthful counts from the same pipeline as the
  rows (tasksForView / taskViewCounts); sort separate; title/date 13 px with
  weight/colour hierarchy; worded «сегодня» / «просрочено» cues.
- Calendar: Years (12-year windows anchored at the current Kyiv year) → Months
  (12 tiles) → Days (layout B default: four week-panel columns of 7 rows, weeks
  5–6 wrap; layout A: 7 × 6) → Day details inside the stage (every former Day
  Manager action; the editor stays a stacked dialog portalled to <body>).
  Clickable breadcrumbs; separate previous/next, Today and History. One stable
  stage: 620 px (>= 1024), 560 px (768–1023), auto (< 768). A/B is a device
  preference (localStorage lifeOsCalendarLayout, default B). Geometry-aware
  arrows; Escape one level up after local confirmations/dialogs; focus to the
  selected tile after tile/breadcrumb/Escape/Back-Forward navigation, never away
  from a usable toolbar control or an open dialog; only single activations act in
  the stage; rotateY(360deg) transition with a reduced-motion fade, never awaited.
  Route grammar, deep links, bounds (<= 2100), clamping, History and the live
  Kyiv rollover are unchanged. No events, fake data or preview controls.

Decisions: Day details is the in-stage fourth level (no Day Manager modal);
year windows at the bounds are partial rather than showing unopenable years;
toolbar controls keep focus so they can be repeated; contrast tokens deviate
from the reference where the browser measured below WCAG floors.

Verification (cloud, disposable lifeos_test at 20260930_0009, PostgreSQL 16):
frontend 822 tests / 54 files (baseline 738 / 53), typecheck, lint, analytics
build, git diff --check PASS; backend 750 passed + 1 skipped with a Kyiv
PostgreSQL session zone (with UTC the pre-existing
test_tombstone_clears_value_keeps_existence_and_retry_cannot_restore fails on
the baseline too), ruff PASS, alembic head/current 20260930_0009. Real-browser
matrix on the production build + real API: 1440/1024/768/390/320 × dark/light/
paradise-day/paradise-night × RU/UK, both layouts, every level: 40/40 PASS
(0 overflow, >= 12 px, stable stage). Keyboard/focus harness 45/45 in 7
configurations incl. reduced motion; persistence flows 19/19 (Calendar) and
11/11 (Tasks); Kyiv rollover 9/9; review fixes 28/28. Screenshots:
screenshots/jenkin-cloud-20260930/. Not run: screen readers, WebKit/Firefox,
the editor conflict choice in the browser (unit-tested, editor unchanged).
No dependency or migration change. Bundle: CalendarPage chunk 19.84 → 28.70 kB,
index JS 381.41 → 383.20 kB, CSS 174.15 → 184.67 kB.

Limitations: lifeos_dev remains at 20260721_0001 (not migrated; owner decision).
Legacy tag chips can sit next to the real date cue (G2 never rewrites legacy
data). The Mac recovery stash is untouched (it does not exist in the cloud clone).

FUTURE EVENTS SLICE — REQUIRED DST BEHAVIOUR (not implemented; do not solve it
inside Calendar visuals): On 25 October 2026 in Europe/Kyiv, start 03:30 UTC+02
and end 03:45 must not silently become end 04:30. Resolve ambiguous start and
end independently, preserve entered wall-clock values and offset choices, and
reject inconsistent chronology. Never repair an invalid end by silently
assigning start + one hour.

Next slices (each Discovery → Plan → owner decisions; none started): Events
persistence and editing (with the DST rule above), Inbox / suggest-only smart
capture, account recovery then passkeys, Documents metadata, phone-number-change
checklist. Not to implement: HELSI, BankID, Дія integrations (unverified),
private-key storage, outbound automation.

====================================================================
86. JENKIN BRANDING — EDITORIAL LOGO, FAVICON, OPTIONAL DEJAVU SANS (2026-10-01)
====================================================================

[Integration note, 2026-10-01: this entry was written on
feat/jenkin-branding-assets-20261001 before the integration and is kept verbatim
below. It was appended there as §85 in parallel with the Calendar §85 above and
was renumbered §86 when merged on integration/jenkin-calendar-branding-20261001;
the branding report still calls it §85. Superseded by section 87: its
"pre-existing, not fixed" focus gaps are fixed, and its Tasks/Calendar browser
checks refer to the pre-compact Tasks page and the retired cube Calendar.]
Branch feat/jenkin-branding-assets-20261001 (parallel branding-only session;
NOT yet integrated with handoff/jenkin-cloud-20260930 — numbering of this entry
may need reconciling at integration). Report:
Outputs/Implementations/jenkin-branding-logo-favicon-font_20261001.md.
- Logo: the owner-approved 01 Editorial wordmark (outlined paths copied
  verbatim from design-references/jenkin-branding/logo, currentColor, no font
  dependency) in the expanded sidebar and on login; the serif J + amber point in
  the collapsed sidebar. Ink #F6EFE4 on dark / paradise-night, #252A2B on light /
  paradise-day. Component components/JenkinBrand.jsx; styles src/brand.css
  (imported by main.jsx after styles.css, outside the pinned layer manifest).
- Favicon: small-size adaptation of the approved J (SVG + ICO 16/32/48 +
  180 px apple-touch) in apps/web/public/assets/.
- Interface font: Settings → Appearance → Current (default, Onest / Work Sans)
  or DejaVu Sans, with a localized Cyrillic + digits preview of both faces.
  Device-local only (localStorage lifeOsFont = 'dejavu', else Current; applied
  as <html data-font>, pre-paint in index.html). No backend/snapshot field.
  DejaVu re-points --font-display / --font-body plus scoped overrides for the
  selectors that name Onest / Work Sans directly (pinned by a test that scans
  every stylesheet). --font-mono (the .mono role) is deliberately unchanged;
  no universal selector, no !important. WOFF faces load only when used (the
  Appearance preview loads DejaVu Regular).
- Known font facts: Google's Work Sans has NO Cyrillic glyphs, so under Current
  Cyrillic body and .mono text has always rendered in the OS fallback font;
  only Onest (headings) renders Cyrillic as a webfont. Under DejaVu the same
  holds for .mono Cyrillic (kept on --font-mono by owner instruction). Whether
  .mono should get DejaVu as a Cyrillic fallback is an OPEN OWNER DECISION.
- Verified: frontend 768 tests / 54 files, typecheck, lint, build; browser
  matrix Current/DejaVu × RU/UK × 4 theme states × 1440/1024/768/390/320 over
  sidebar, login (RU only — no locale switch there), Settings, Tasks, Calendar,
  task dialog: 440 mocked-API views + 88 views against the real FastAPI backend
  on lifeos_test — 0 overflow (after a DejaVu-scoped TopBar wrap at 768),
  glyphs І Ї Є Ґ Ё proved rendered by the DejaVu webfont via CDP platform fonts.
  Pre-existing, not fixed: no visible focus change on .qa-title (task dialog),
  login inputs and .tb-cmd-input.

====================================================================
87. JENKIN INTEGRATION — CALENDAR / SHELL / TASKS + BRANDING (PUSHED BRANCH, 2026-10-01)
====================================================================

Current reconciled JENKIN state. Report:
Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md
Branch integration/jenkin-calendar-branding-20261001 (pushed; not merged, no PR,
no deploy; verify live). Inputs: handoff/jenkin-cloud-20260930 @ 1e130cb
(section 85) + feat/jenkin-branding-assets-20261001 @ 727e658 (section 86),
merge base 0730f84; origin/main 5e858bb unchanged. Normal merge 0704970 (both
histories kept), then 40fe3b5 typography/dead CSS, a051e43 focus gaps, c35eeda
phone tiles, b19fc71 logo focus ring, then the docs commit. Locale pins after
the merge: ru 1832 / uk 1831 (parity contract unchanged).

Integrated product: everything in sections 85 and 86, together — Editorial
wordmark / serif J / favicon set next to the real account block and sync phase;
Current (default) or DejaVu Sans interface font (device-local lifeOsFont,
pre-paint), which never changes the logo; compact Tasks; the nested Calendar.
Integration decisions:
- The nested Calendar follows the interface font through the typography tokens
  only; brand.css overrides exactly the selectors that still name 'Onest' /
  'Work Sans' (17 display + 26 body) and the test fails on a missing or a dead
  override. --font-mono / .mono unchanged (Cyrillic .mono text keeps the OS
  fallback; the branding report's .mono fallback question stays an OPEN OWNER
  DECISION).
- Fixed: the old cube overrides and unused logo CSS removed; visible keyboard
  focus on the login inputs (the outline used the gradient --accent), the task
  dialog title and the TopBar search (3.43–6.26:1); the logo focus ring on light
  and Paradise-day (was 1.99 / 1.37:1, now ≥ 3.81:1); Calendar years / month
  names / layout-A days no longer clipped on phone panels (< 380 px: two-column
  years and months, slimmer day tiles) in either font.

Verification (cloud; disposable lifeos_test at 20260930_0009): frontend 849
tests / 55 files, typecheck, lint, analytics build, git diff --check PASS;
backend ruff PASS, alembic head/current 20260930_0009, pytest 750 passed +
1 skipped with a Europe/Kyiv session zone, 748 passed + 2 failed + 1 skipped
with a UTC session zone. The two UTC failures are pre-existing and identical on
the unchanged baseline d396fa9, and deterministic at any time of day:
test_aa_deletion.py::test_tombstone_clears_value_keeps_existence_and_retry_cannot_restore
(isoformat '+00:00' vs API JSON 'Z' for the same instant) and
test_aa_legacy_import.py::test_legacy_import_is_honest_idempotent_and_does_not_backfill_other_layers
(Kyiv-midnight occurred_at read as the previous UTC date). Open, out of scope.
Browser (Chromium only, production build + real API): 80/80 matrix
configurations (Current/DejaVu × RU/UK × 4 themes × 1440/1024/768/390/320,
both layouts, every level); 598 glyph nodes — DejaVu Sans drawn by the app's
webfont incl. І Ї Є Ґ Ё; focus, logo ring, font persistence, favicon links,
UK login, Calendar keyboard harness (8 × 45), persistence flows, editor
concurrency (external server write + the production reloadServerState path;
rebase, conflict notice, both choices; Calendar editor and Tasks detail), Kyiv
rollover with an open draft — all PASS. Screenshots and artifacts:
Outputs/Implementations/jenkin-integration_20261001/. Not run: screen readers,
Firefox/WebKit, native pickers.

Limitations: lifeos_dev still at 20260721_0001 (not migrated; owner decision);
.auth-link still uses the gradient --accent as a text colour (pre-existing).
The future Events DST requirement of section 85 stands unchanged: on 25 October
2026 in Europe/Kyiv, start 03:30 UTC+02 and end 03:45 must not silently become
04:30; resolve start/end ambiguity independently, preserve entered values, and
reject inconsistent chronology. Events, smart capture, auth recovery/passkeys,
BankID/Дія, Documents, HELSI, phone-change automation and private-key storage
are NOT started. Next: owner review of the integration branch.
Status note (2026-10-01, later): password recovery, email verification,
invitations and session management are now implemented on
feat/jenkin-account-security-20261001 (section 88); passkeys, Diia/BankID,
Documents and the rest stay NOT started.

====================================================================
88. JENKIN S0/S1 — SECURITY & ACCOUNT FOUNDATION (PUSHED BRANCH, 2026-10-01)
====================================================================

Branch feat/jenkin-account-security-20261001 (pushed; not merged, no PR, no
deploy; verify live), based on integration/jenkin-calendar-branding-20261001 @
83cba06 (verified ancestor). Worked in the isolated worktree
/Users/yurasachenko/LifeOS/LifeOS_account-security because the canonical
checkout held another session's staged files; the owner's task allowed an
isolated checkout. Records:
- Discovery (reconstructed from source; evidence + status per finding):
  Outputs/Discoveries/jenkin-security-finance-discovery_20261001-104806.md
- Decision register (owner decisions vs architecture vs EXTERNAL prerequisites):
  Outputs/Plans/jenkin-security-finance-decisions_20261001-104806.md
- Roadmap with acceptance criteria (S2, F1–F5, I1/I2 — NOT implemented):
  Outputs/Plans/jenkin-security-finance-roadmap_20261001-104806.md
- Report: Outputs/Implementations/jenkin-account-security-s0-s1_20261001-104806.md
The previous "wait for the JENKIN integration" gate is resolved and removed.

Implemented (S1):
- Account binding: every protected API route requires X-LifeOS-Account = the
  client's expected account (428 account_binding_required / 409
  session_user_mismatch, before any read or write). Never authorization:
  ownership still comes from the session. /auth/me unbound; logout optionally
  bound. Client: api/accountBinding.ts generation — account change aborts
  requests and discards late responses; providers keyed by account+generation;
  BroadcastChannel + focus/visibility/pageshow/online revalidation; explicit
  "switched" screen.
- Sync: both coordinators abort on dispose; replay loop stops; queue v2
  (owner required, owner-checked updates, ownerless records quarantined,
  replay bound to the record's owner, per-account Web Lock).
- Unsaved edits kept per account on expiry / switch / "sign out keeping a
  copy" and offered back only to that account (CAS restore). Logout saves
  first, else retry / download / keep copy / confirmed discard; a failed
  logout never claims success. Private /api responses are no-store.
- Legacy lifeOsState: ownership confirmation before preview/download/import,
  per-account decision respected, import retires the copy recoverably.
- Honest production state: new accounts are EMPTY (demo only in the test
  fixture lifeData/demoState.js); migration no longer reseeds demo data; no
  fake tokens, balances, budgets, sync status or dead exports. Existing owner
  data untouched (no automatic cleanup).
- Access (migration 20261001_0010): owner role (sole existing user → owner;
  several → nobody; `python -m app.cli grant-owner <email>`), owner-only
  email-bound single-use 7-day invitations, password change (revokes other
  sessions), recovery (generic 202, 1 h single-use, revokes all sessions),
  email verification (24 h), session list/revoke, DB-backed throttling,
  audit events (no secrets; 365 days; exported; erased with the account).
  Mail: disabled / memory (tests) / file (dev) / SMTP (production).

Production activation is BLOCKED_EXTERNAL on SMTP credentials + sender, the
public HTTPS app URL, proxy-hop facts and (for S2) key custody — see the
decision register. lifeos_dev is still at 20260721_0001 (owner decision).
Known remaining: snapshot/AA/profile plaintext at rest (S2); `$` labels vs AA
`UAH` (not reinterpreted; F1); pre-existing < 12 px Home eyebrows.
Next slice: S2 encryption + document foundation (roadmap).

S1 hardening checkpoint (2026-10-01, later; same branch, commits bda61d8 +
8698034 + docs): an independent review found and the code confirmed (1)
accepting ANY invitation verified the email — now only delivery=sent verifies;
manual/failed/pending invitations create an unverified member who verifies
through the normal flow; migration 20261001_0011 clears only verification that
an unsent invitation's acceptance wrote (equality with accepted_at). (2)
Throttle admission raced (reproduced: 16/16 concurrent logins admitted against
a limit of 5) — now one atomic upsert per policy, committed before hashing or
mail; request quotas vs failure counters (reserve + refund on success).
Invitation mail is now sent with no transaction open (pending → sent/failed).
Browser storage (unsaved copies, analytics queue, legacy copies) is plaintext
— logical per-account isolation only; added to the S2 data-protection plan.
Verified: backend 822 passed + 1 skipped under UTC and Kyiv, frontend 882,
live 4-worker checks on lifeos_test. Head: 20261001_0011. S2 NOT started.
