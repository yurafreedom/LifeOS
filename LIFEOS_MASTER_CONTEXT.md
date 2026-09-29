# LifeOS — MASTER PROJECT CONTEXT / SYSTEM PROMPT
## Universal operating context for new ChatGPT / Claude / engineering sessions

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

Last verified current main:

3570426a80988f2715f48bb9a12261d3ee122056

Commit message:

Merge pull request #7 from yurafreedom/feat/adaptive-analytics-slice-p
Add minimal Project domain for Adaptive Analytics

PR #7:

MERGED

PR #7 head:

c36e4f67e6b0cf8288bd149cd89f0347e3c10e95

Primary Slice P implementation commit:

690b39a8dd24537d49b3148767bc3b3fcdb92cbb

Current state MUST be refreshed before a new implementation session because
main may have moved since this prompt was written.

Repository consolidation started from this exact main on:

chore/lifeos-consolidation

This branch consolidates the canonical context, repository instructions and
previously untracked authored LifeOS artifacts. Verify its current PR state
live; do not infer that it has already been merged from this document.

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

20260929_0007
(M6 · Experiments · Slice 6; down_revision 20260928_0006)

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

Current merge commit / current verified main:

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

No Project Analytics exists yet.

No forecast-history chart exists yet.

No dual-delta Project analysis exists yet.

====================================================================
29. CURRENT GREEN BASELINE AFTER SLICE P
====================================================================

Last accepted Slice P validation:

Backend:

253 passed
7 warnings

Ruff:

PASS

Alembic:

20260910_0004
one head/current

Frontend:

123 passed
18 files

Typecheck:

PASS

Lint:

PASS

Build:

PASS
107 modules

git diff --check:

PASS

Approximate accepted bundle after Slice P:

CSS:
130.95 kB
23.21 kB gzip

JS:
437.48 kB
125.11 kB gzip

Source map:
1,092.48 kB

Actual future baseline is always whatever the repository produces now.

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

Clarify was implemented, validated and merged. It introduced waitingItems[] and
references[] inside snapshot v2 with no backend/schema change. Those decisions
are settled; the section below is retained as the accepted design context.

Implementation report:

Outputs/Implementations/
lifeos-design-handoff-clarify-panel_20260928-120853.md
====================================================================

Raw design source:

/Users/yurasachenko/LifeOS/design_handoff_clarify_panel

Original mapping analysis identified target:

#/notes
Quick Note row
→ Clarify modal/popover

The prototype primarily demonstrated visual/interaction behavior and deletion
confirmation.

The handoff README expects SIX real outcomes.

The first integration attempt correctly stopped because four/five domain
semantics were not yet canonical.

Those semantics are now largely owner-approved.

Hero has already been separated and completed.

Clarify must now be implemented as its OWN production integration.

Before implementation:

verify the canonical checkout is clean and current;

fetch `origin` and fast-forward local `main`;

create or inspect the ordinary feature branch:

feat/design-handoff-clarify-panel

Use the canonical checkout. Do not create a dedicated worktree unless the owner
explicitly requests one.

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

The exact persisted representation should be inspected/designed minimally during
Clarify implementation.

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
33. CLARIFY — IMPORTANT DOMAIN GAP STILL TO DESIGN
====================================================================

The semantic intent for Waiting and Reference is approved.

Their exact persisted model is NOT yet frozen at the same level as Project.

Before writing those collections:

inspect current snapshot architecture and existing UI.

Choose the SMALLEST truthful representation.

Do not silently infer tags/status values.

Do not create unrelated infrastructure.

If multiple materially different representations remain possible and affect
product semantics:

STOP and ask the owner.

Do not hide uncertainty inside code.

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

NEXT SLICE:

Slice 7 — Trade-off / System Review, after a serial reverify and any owner
decisions it needs.

Then, unless the owner changes priorities:

Slice 7
→ Slice 8

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
41. SLICE 7 — FUTURE TRADE-OFF
====================================================================

Trade-offs retain incompatible dimensions.

No global composite score.

Contradictions can coexist.

Importance should remain user-owned.

====================================================================
42. SLICE 8 — FUTURE RETENTION
====================================================================

AA history has its own retention semantics.

Owner decision:

separate AA retention

unlimited by default

Legacy activityLog retention is separate.

Do not silently prune durable AA history.

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

Only create a migration when the planned slice explicitly requires one.

Current Alembic head:

20260929_0007

M4 (aa_signal_episodes) was created by Slice 3 and is merged.
M5 (Review / Debrief) was created by Slice 4.
M6 (Experiments) was created by Slice 6.

Clarify currently should not need an Alembic migration if its operational state
is added to the snapshot.

If an implementation unexpectedly appears to require backend relational schema
outside the planned slice:

STOP and explain why.

Do not silently invent a future migration early.

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

Slice P, Clarify, Slice 3, Slice 4 (Review / Debrief), Slice 5 (Project
Analytics) and Slice 6 (Experiments) are complete. Verify the exact current main SHA live; do not trust a
SHA written here.

The next major product task is:

Adaptive Analytics Slice 7 — Trade-off / System Review (see §41), after a
serial reverify against current main

Follow the Discovery → Plan → Implementation gates on an ordinary feature
branch in the canonical checkout after fast-forwarding local `main`.

====================================================================
66. CLARIFY IMPLEMENTATION EXPECTATIONS
====================================================================

Clarify must integrate:

raw design intent

+

real LifeOS operational semantics.

It must NOT merely reproduce the prototype.

Before code changes:

inventory handoff
inspect QuickNotesPage
inspect Task/QuickAdd
inspect Projects
inspect state migration
inspect routing
inspect localization
inspect current CSS
inspect accessibility patterns

Determine the smallest truthful persisted representations for:

Waiting
Reference

before implementing those outcomes.

No hidden tag hacks.

No Goal fallback.

No indefinite someday bucket.

No fake confirmation of success.

Quick Note should disappear only after the selected outcome has been
successfully persisted.

====================================================================
67. LIKELY CLARIFY SNAPSHOT CHANGES
====================================================================

These are NOT automatically final schemas.

They are areas to design explicitly.

Possible new operational collections may include:

waitingItems[]
references[]

If used, they must:

- be additive;
- be seeded safely for old snapshots;
- not bump state version without a real reason;
- validate existing records;
- preserve input immutability in migration;
- have user-visible retrieval surfaces;
- remain minimal.

Do not implement them merely because these names appear here.

First confirm against current architecture and the handoff.

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
69. AFTER CLARIFY
====================================================================

After Clarify implementation:

owner review full report
→ PR diff review
→ merge
→ verify main
→ proceed to Adaptive Analytics Slice 3 unless priorities change.

Do not jump directly to Slice 5 merely because Project now exists.

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

Slice P merge / latest verified main:

3570426a80988f2715f48bb9a12261d3ee122056

Never assume latest verified main is still current without checking GitHub.

====================================================================
71. IMPORTANT PR HISTORY
====================================================================

PR #5:
Hero Vignette
MERGED

PR #6:
Adaptive Analytics Slice 2
Finance Pilot + durable queue
MERGED

PR #7:
Minimal Project Domain
MERGED

For any later PR:

inspect current live status rather than relying on this document.

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
