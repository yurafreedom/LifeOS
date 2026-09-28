# DISCOVERY — LifeOS post-forensic artifact consistency correction

**Task:** strict read-only post-forensic artifact consistency correction
**Phase:** A — DISCOVERY (read-only)
**Date:** 2026-08-11
**Repository snapshot:** `design-sync-setup` / `67a1456c6165e9bdf36382a98c9713c4ed981314`
**Mutation policy:** source export JSON, application code, Git index/history, commit, push and deploy are out of scope.

## 1. Scope and evidence basis

- **VERIFIED (HEAD `67a1456c`; `export_claude_lifeOS/_lifeos_forensic/00_source_inventory.md:3-7,11-17`):** the existing reconstruction is explicitly read-only, uses 16 JSON sources, and already records the repository guardrail. No full forensic reconstruction is needed to diagnose the reported artifact mismatches.
- **VERIFIED (HEAD `67a1456c`; `export_claude_lifeOS/_lifeos_forensic/14_conflicts_and_supersessions.md:5-77`):** the conflict registry contains seven definition headings, exactly `LIFEOS-CONFLICT-0001` through `LIFEOS-CONFLICT-0007`, without duplicate or missing number in that sequence.
- **VERIFIED (HEAD `67a1456c`; `export_claude_lifeOS/_lifeos_forensic/15_open_questions.md:3-59`):** the canonical actual-question registry contains seven definition headings, exactly `LIFEOS-OQ-0001` through `LIFEOS-OQ-0007`.
- **VERIFIED (HEAD `67a1456c`; `export_claude_lifeOS/_lifeos_forensic/15_open_questions.md:61-74`):** the same register separately contains ten forensic gaps, but its heading/name is not mirrored consistently in the master spec.

## 2. Conflict-count mismatch — factual cause

| Artifact claim | Evidence | Verdict |
|---|---|---|
| Conflict registry has 7 definitions | `14_conflicts_and_supersessions.md:7,17,28,39,48,59,69` | **VERIFIED** |
| Completion gate reports 7 | `20_validation_report.md:26` | **VERIFIED** |
| Original implementation report reports 7 | `Outputs/Implementations/lifeos-claude-export-forensic_implementation_no-commit_2026-08-11.md:75-79,105-114` | **VERIFIED** |
| Compact implementation summary reports 7 | `Outputs/Summaries/lifeos-claude-export-forensic_implementation_no-commit_2026-08-11.md:5` | **VERIFIED** |
| Identity check reports 6 | `20_validation_report.md:38-44` | **VERIFIED; INCORRECT** |

**VERIFIED CAUSE (HEAD `67a1456c`):** this is a single stale validation datum at `20_validation_report.md:44`, not a missing conflict. The registry, completion gate, original implementation report and compact summary all establish seven. No eighth conflict is justified.

**UNKNOWN:** the edit chronology that left the stale `6` cannot be proven from Git because the forensic root is currently untracked. The artifact-level diagnosis does not depend on that chronology.

### Conflict identity inventory

1. `LIFEOS-CONFLICT-0001` — whole-shell width vs scoped readable width (`14:7-15`).
2. `LIFEOS-CONFLICT-0002` — dark Hero vs lighter daytime header (`14:17-26`).
3. `LIFEOS-CONFLICT-0003` — Clarify layout variants (`14:28-37`).
4. `LIFEOS-CONFLICT-0004` — localStorage history vs server-backed current architecture (`14:39-46`).
5. `LIFEOS-CONFLICT-0005` — Project vs Goal (`14:48-57`).
6. `LIFEOS-CONFLICT-0006` — GTD-first vs recorded batch sequence (`14:59-67`).
7. `LIFEOS-CONFLICT-0007` — read-mostly Home vs actionable GTD Home (`14:69-77`).

### Propagation evidence

- **VERIFIED (HEAD `67a1456c`; `07_dashboard_specification.md:5,50-51,86,95-97,111-114`):** Home actionability, header treatment, Project/Goal and server-backed widget contracts retain unresolved/proposed status.
- **VERIFIED (HEAD `67a1456c`; `08_gtd_system.md:22-31,35-44,94-110,134-143`):** Clarify layout, Project/Goal, Reference, Review and Focus Now are not silently canonicalized.
- **VERIFIED (HEAD `67a1456c`; `10_design_system.md:53-56,89-90,147-148`):** header and Clarify design ambiguity remains explicit.
- **VERIFIED (HEAD `67a1456c`; `13_architecture_history.md:18-24,36-47` and `16_current_repo_reconciliation.md:8,29-35`):** historical localStorage and current server-backed reality remain separated.
- **VERIFIED (HEAD `67a1456c`; `17_master_lifeos_spec.md:85-89,103-120,230-235` and `19_handoff_summary.md:18,22,26,38,46-50`):** read-mostly/actionable Home, header, GTD and architecture ambiguity is propagated into the master/handoff artifacts.

## 3. Open-question taxonomy — factual cause

### Canonical actual historical questions

**VERIFIED (HEAD `67a1456c`; `15_open_questions.md:5-59` and `19_handoff_summary.md:56-58`):** the seven actual historical questions are:

1. `LIFEOS-OQ-0001` — header day/night treatment.
2. `LIFEOS-OQ-0002` — Clarify layout.
3. `LIFEOS-OQ-0003` — Project vs Goal.
4. `LIFEOS-OQ-0004` — dog-food inventory calculation.
5. `LIFEOS-OQ-0005` — dog expenses vs Finance source of truth.
6. `LIFEOS-OQ-0006` — dog editing pattern.
7. `LIFEOS-OQ-0007` — whether the delivery sequence was revised to GTD-first.

### What the master currently does

**VERIFIED (HEAD `67a1456c`; `17_master_lifeos_spec.md:341-352`):** the master’s single ten-item `Open Questions` list contains only six of the seven registered historical questions. It omits `LIFEOS-OQ-0007` and adds four differently classified items:

- Reference lifecycle;
- Review/Engage model;
- Areas model;
- Responsive behavior.

**VERIFIED (HEAD `67a1456c`; `03_decision_ledger.md:263-285`, `08_gtd_system.md:23,30-31,35-44,98-103,134-143`, `10_design_system.md:114`, `15_open_questions.md:61-74`):** these four master items are unsupported/proposal-only mechanics or evidence gaps, not definitions in the actual historical-question registry. `Review/Engage` combines two distinct gaps already separated in `15`; Areas and responsive rules are also already forensic gaps. Reference lifecycle is proposal-only (`LIFEOS-DEC-0022`) and needs sign-off, but is not currently represented in the ten-item `FORENSIC_GAPS` register.

**VERIFIED CAUSE:** the number `10` in the master is not an alternative `OPEN_QUESTIONS` count. It is an untyped mixture of six actual historical questions and four gap categories, while one actual historical question is absent.

### Taxonomy implication for the Plan

- **RECOMMENDED:** make `17_master_lifeos_spec.md` explicitly mirror all seven `LIFEOS-OQ-*` definitions under `Actual Historical Open Questions`.
- **RECOMMENDED:** move Reference lifecycle, Reflect/Weekly Review, Engage/Focus Now, Areas and responsive behavior under `Forensic / Evidence Gaps`.
- **RECOMMENDED:** add Reference lifecycle to the canonical gap register in `15_open_questions.md`. This preserves the existing `PROPOSED` conclusion and makes the complete forensic-gap count 11 rather than concealing that gap.
- **RECOMMENDED:** have the master mirror the full canonical eleven-gap register, rather than showing an unexplained subset. This yields exactly 7 actual questions and 11 forensic/evidence gaps.

No source evidence or historical conclusion would change; this is taxonomy and cross-artifact consistency only.

## 4. Read-only integrity checks executed

### Identity and reference resolution

- **VERIFIED:** `LIFEOS-CONFLICT-*` definitions = 7 unique; referenced conflict IDs = the same 7; unresolved literal references = 0.
- **VERIFIED:** `LIFEOS-OQ-*` definitions = 7 unique; referenced OQ IDs = the same 7; unresolved literal references = 0.
- **VERIFIED:** `LIFEOS-EV-*` JSONL definitions = 43 unique; all 43 normalized `EV-*` references resolve; unreferenced evidence definitions = 0.
- **VERIFIED:** `LIFEOS-DEC-*` definitions = 34; all 34 normalized `DEC-*` references resolve.
- **VERIFIED:** `LIFEOS-REQ-*` definitions = 25; all 25 normalized `REQ-*` references resolve.

### Evidence JSONL

Command:

```text
python3 export_claude_lifeOS/_lifeos_forensic/_work/forensic_index.py \
  validate-evidence export_claude_lifeOS/_lifeos_forensic/18_evidence_index.jsonl
```

Result:

```text
lines=43
unique_ids=43
resolved_source_records=42
errors=[]
```

**VERIFIED (HEAD `67a1456c`; `18_evidence_index.jsonl:1-43`):** JSONL remains valid; one memory record intentionally has no conversation/message pair, matching `20_validation_report.md:48-50`.

### Source SHA-256

Command:

```text
python3 export_claude_lifeOS/_lifeos_forensic/_work/forensic_index.py check-source
```

Result:

```text
checked=16
matched=16
mismatches=[]
```

**VERIFIED (HEAD `67a1456c`; `_work/coverage_state.json:3-20`):** all 16 stored source hashes still match.

### Repository mutation guard

- **VERIFIED at Discovery start/end:** HEAD remained `67a1456c6165e9bdf36382a98c9713c4ed981314`.
- **VERIFIED at Discovery start:** Git index diff was empty (`SHA-256 e3b0c442…b855`).
- **VERIFIED:** the working tree already contained pre-existing modified/untracked files before this correction; none was treated as created by this task. The only Phase A writes are this required Discovery report and its matching summary under `Outputs/`.
- **VERIFIED:** no application code, source export JSON, commit, push or deploy action occurred.

## 5. Risks and boundaries

- **Risk:** correcting only the master without adding Reference lifecycle to the canonical gap registry would leave two competing gap inventories.
- **Risk:** changing the original implementation report’s already-correct conflict/open-question counts would create noise without changing a fact.
- **Binding not-touched list:** source JSON; `18_evidence_index.jsonl`; `14_conflicts_and_supersessions.md`; decision/requirement ledgers; application code; Git index/history; commits; remote systems.
- **Billing / status machine / FSM / callback_data:** **VERIFIED N/A**; the task is Markdown/JSONL forensic metadata only and touches no runtime path.

## 6. Discovery verdict

`DISCOVERY_STATUS=CORRECTION_REQUIRED`

Expected minimal correction surface for Phase C, subject to Phase B approval:

1. `20_validation_report.md` — correct the stale conflict identity count and make final taxonomy counts explicit.
2. `15_open_questions.md` — preserve seven actual OQs; classify Reference lifecycle as the eleventh forensic/evidence gap.
3. `17_master_lifeos_spec.md` — split §21 into the two requested taxonomies and mirror their IDs/counts.
4. `19_handoff_summary.md` — align its condensed forensic-gap inventory/count with the canonical register.
5. New correction implementation report + matching summary under `Outputs/` as required by the repository workflow.

The original forensic implementation summary should remain unchanged unless the approved Plan identifies a factual statement in it that becomes false; none was found in Discovery.

WAITING FOR: review of discovery
