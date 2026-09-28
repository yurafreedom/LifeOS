# PLAN — LifeOS post-forensic artifact consistency correction

**Task:** strict read-only post-forensic artifact consistency correction
**Phase:** B — PLAN (read-only; no forensic artifact changes yet)
**Date:** 2026-08-11
**Repository snapshot:** `design-sync-setup` / `67a1456c6165e9bdf36382a98c9713c4ed981314`
**Basis:** approved Discovery at `Outputs/Discoveries/lifeos-post-forensic-consistency-correction_discovery_2026-08-11_180602.md`
**Execution policy:** artifact-only, no full reconstruction, no source/application/Git mutation, no commit/push/deploy.

## 1. Binding outcome

Phase C will produce one internally consistent taxonomy without changing historical conclusions:

```text
CONFLICTS_FINAL=7
CONFLICT_IDS_FINAL=LIFEOS-CONFLICT-0001..LIFEOS-CONFLICT-0007
OPEN_QUESTIONS_FINAL=7
OPEN_QUESTION_IDS_FINAL=LIFEOS-OQ-0001..LIFEOS-OQ-0007
FORENSIC_GAPS_FINAL=11
```

- **VERIFIED (HEAD `67a1456c`; `14_conflicts_and_supersessions.md:7-77`):** all seven conflict definitions already exist and remain untouched.
- **VERIFIED (HEAD `67a1456c`; `15_open_questions.md:5-59`):** all seven historical open-question definitions already exist and remain semantically untouched.
- **VERIFIED (HEAD `67a1456c`; `03_decision_ledger.md:263-273`):** Reference lifecycle is based on proposal-only `LIFEOS-DEC-0022`; it will be classified as a forensic/evidence gap, not assigned a `LIFEOS-OQ-*` ID.
- **VERIFIED (HEAD `67a1456c`; `20_validation_report.md:26,38-44`):** the only conflict-count defect is the Identity Checks value `6`; the completion gate already says `7`.

## 2. Exact files to modify

### 2.1 `export_claude_lifeOS/_lifeos_forensic/15_open_questions.md`

**Current checksum:** `3e2fda9aacf59ce75891a8240d0d6a891e175c05439d3e22dbd3b4d256536e30`
**Planned regions:** current lines `3`, `61-74` (re-anchor by headings if line numbers move).

Changes:

1. Rename `## Actual unresolved project questions` to `## Actual Historical Open Questions`.
2. Add an explicit count statement: 7 definitions, `LIFEOS-OQ-0001`–`0007`.
3. Rename `## FORENSIC_GAPS` to `## Forensic / Evidence Gaps`.
4. Add an explicit gap count of 11.
5. Preserve the existing ten gap conclusions exactly in substance.
6. Append/insert `Reference lifecycle` as the eleventh gap, explicitly stating:
   - archive mechanics are Claude proposal-only;
   - no user-accepted destination/lifecycle was found;
   - it receives no `LIFEOS-OQ-*` ID.

No existing OQ question/options/evidence/status field will change.

### 2.2 `export_claude_lifeOS/_lifeos_forensic/17_master_lifeos_spec.md`

**Current checksum:** `095a5eae4a990248f47c1843419fe02530af5a3713ebc3f03dafc5c84a08ffb4`
**Planned region:** current lines `341-352`, re-anchored by `## 21. Open Questions` and `## 22. Evidence and Provenance Methodology`.

Replace the mixed ten-item list with two explicit subsections:

1. `### Actual Historical Open Questions — 7`
   - list all seven canonical IDs and short labels in registry order;
   - restore omitted `LIFEOS-OQ-0007` delivery-sequence question;
   - no new question or ID.
2. `### Forensic / Evidence Gaps — 11`
   - mirror the eleven canonical gap labels from `15_open_questions.md`;
   - place Reference lifecycle here and label it proposal-only;
   - split the current combined `Review/Engage` label into existing canonical `Reflect/Weekly Review` and `Engage/Focus Now` gaps.

Section numbering `1`–`22`, all other master content and evidence methodology remain unchanged.

### 2.3 `export_claude_lifeOS/_lifeos_forensic/19_handoff_summary.md`

**Current checksum:** `25b5c79fa158f4b21a2b31527bc9f414ee3f0eb130335f7a0501c28c631675d4`
**Planned region:** current lines `56-62`, re-anchored by `## OPEN_QUESTIONS`, `## FORENSIC_GAPS`, and `## FILES_TO_READ_FIRST`.

Changes:

1. Add `Count: 7` and the seven canonical `LIFEOS-OQ-*` IDs to the existing historical-question summary without changing its labels.
2. Rename the gap heading to `## FORENSIC / EVIDENCE GAPS`.
3. Add `Count: 11` and align the condensed labels with the full canonical gap register, including proposal-only Reference lifecycle.

The handoff remains compact; it points readers to `15_open_questions.md` for full reasoning.

### 2.4 `export_claude_lifeOS/_lifeos_forensic/20_validation_report.md`

**Current checksum:** `6c1bd403ac7229d7c77e91a6b0b02ac4ab473fb99faeceda1a2d8a40f1522ed6`
**Planned regions:** current lines `24`, `38-44`, and validation-result text only where needed after actual checks.

Changes:

1. Completion gate: replace unspecified “separate forensic gaps” with exact `7 actual historical questions + 11 forensic/evidence gaps`.
2. Identity Checks: correct `LIFEOS-CONFLICT-*` from 6 to 7.
3. Add an explicit taxonomy check: 11 forensic/evidence gaps, deliberately without `LIFEOS-OQ-*` IDs.
4. Preserve `OVERALL_STATUS=PASS` only if every Phase C gate passes.
5. Preserve the existing JSONL/source-integrity facts only if rerun outputs remain identical; otherwise stop and report instead of rewriting toward a pass.

## 3. Required workflow files

### New files after implementation

1. `Outputs/Implementations/lifeos-post-forensic-consistency-correction_implementation_no-commit_2026-08-11.md`
   - authoritative correction report;
   - exact files changed, before/after counts, commands and outputs;
   - final compact key/value correction report requested by the user;
   - explicit no-commit/no-push/no-deploy status.
2. `Outputs/Summaries/lifeos-post-forensic-consistency-correction_implementation_no-commit_2026-08-11.md`
   - ≤20 lines;
   - same final key/value facts as chat;
   - link to the full implementation report.

### Existing workflow file

3. `Outputs/backlog-tasks/task_log.md`
   - append one required task entry after successful checks;
   - identify the task as no-commit artifact correction;
   - record duration/token counts as estimates if counters remain unavailable.

No existing original forensic implementation report or its summary will be edited: their `CONFLICTS=7` and `OPEN_QUESTIONS=7` facts are already correct (`Outputs/Implementations/...:75-79,105-114`; `Outputs/Summaries/...:5`).

## 4. Files explicitly not modified

Binding not-touched list:

- `export_claude_lifeOS/_lifeos_forensic/14_conflicts_and_supersessions.md` — seven correct definitions preserved.
- `export_claude_lifeOS/_lifeos_forensic/18_evidence_index.jsonl` — 43 correct JSONL records preserved.
- `export_claude_lifeOS/_lifeos_forensic/03_decision_ledger.md`.
- `export_claude_lifeOS/_lifeos_forensic/04_requirements_ledger.md`.
- all other `00`–`14` and `16` forensic artifacts.
- all 16 source export JSON files and `.DS_Store` under the source root.
- `apps/`, tests, configuration, dependencies, migrations and all application/runtime code.
- original forensic implementation report and compact summary.
- Git index, refs, history and remotes.
- VPS/remote services.

No full forensic reconstruction, semantic rerouting or raw-corpus rescan will run.

## 5. Signatures, schemas and migrations

- **Function signatures before/after:** N/A; no code symbols change.
- **Data/API schemas before/after:** N/A; Markdown taxonomy only.
- **Dependencies:** none.
- **Environment variables:** none.
- **DB migrations/Alembic:** N/A; no schema or database access.
- **Seed files:** none.
- **Runtime filesystem paths:** none added.

## 6. Blast-radius inventory

### Grep-confirmed consumers/callers

| Edited artifact | Grep-confirmed consumers | Behavior delta | Compatibility verdict |
|---|---|---|---|
| `15_open_questions.md` | `08_gtd_system.md:157`; `17_master_lifeos_spec.md:341-352`; `19_handoff_summary.md:56-62`; `20_validation_report.md:24,43-44`; original implementation report references at lines `33,149` | headings/counts become explicit; Reference lifecycle joins gaps | All tolerate it; `08` already treats Reference/Review/Engage as proposed or unresolved and needs no edit |
| `17_master_lifeos_spec.md` | `19_handoff_summary.md:67`; original implementation report line `53`; original compact summary line `8` | section 21 becomes typed 7+11 taxonomy | Paths/headings remain; no consumer expects the old untyped ten-item count |
| `19_handoff_summary.md` | original implementation report line `54`; designed as first-read artifact at its own line `66` | condensed counts/list align with canonical registry | Handoff semantics unchanged; ambiguity becomes clearer |
| `20_validation_report.md` | `00_source_inventory.md:318`; original implementation report lines `10,58`; original compact summary line `19` | stale identity value corrected; exact taxonomy gate added | Existing links remain valid; overall status stays conditional on rerun |

**VERIFIED (HEAD `67a1456c`):** `git log --all -- <four forensic paths>` returns no commits because these forensic artifacts are untracked; there are no landed commits to re-anchor. Phase C will re-anchor by headings, not cached line numbers.

### Shared state

- Markdown cross-references and counts are the only shared state.
- No FSM keys, module dictionaries, sessions, database state, cache, account/tenant data or external state is read/written.
- `18_evidence_index.jsonl` remains the evidence-ID source of truth but is read-only.

## 7. Behavior matrix

| Reader/path | Before | After | Invariant |
|---|---|---|---|
| Conflict registry reader | 7 definitions; validation identity says 6 | 7 definitions; all validation surfaces say 7 | No conflict added/deleted/renumbered |
| Open-question registry reader | 7 actual OQs + 10 gaps | 7 actual OQs + 11 gaps | Existing OQ definitions/IDs unchanged |
| Master-spec reader | one mixed 10-item list; OQ-0007 absent | two typed lists: 7 actual + 11 gaps | No proposal promoted to historical decision/question |
| Handoff reader | 7 actual questions by prose; partial gap subset | explicit counts and canonical labels | Remains compact and points to full register |
| Validation reader | conflicting 7/6 conflict facts; unspecified gap count | exact 7 conflicts, 7 actual OQs, 11 gaps | PASS only after actual checks |
| Evidence consumer | 43-record JSONL | unchanged 43-record JSONL | Every evidence reference resolves |
| Future implementation agent | may mistake gaps for historical questions | sees taxonomy boundaries | `INSUFFICIENT_ARCHIVE_EVIDENCE` preserved |

## 8. Invariants checklist

- **Conflict identities:** exactly seven, `0001`–`0007`, unique; no content changes.
- **Open-question identities:** exactly seven, `0001`–`0007`, unique; no content changes.
- **Forensic gaps:** exactly eleven taxonomy items; no `LIFEOS-OQ-*` IDs assigned.
- **Reference lifecycle:** remains `PROPOSED`/evidence gap, never promoted.
- **Evidence:** 43 unique JSONL records; 42 source-resolved plus one intentional memory record; zero errors.
- **Source hashes:** 16/16 match baseline.
- **Historical ambiguity:** `UNRESOLVED` and `INSUFFICIENT_ARCHIVE_EVIDENCE` preserved.
- **Billing:** VERIFIED N/A; no pipeline/credits/export code or data.
- **Status machine:** VERIFIED N/A; no runtime transitions.
- **FSM keys:** VERIFIED N/A; no bot state.
- **callback_data ≤64 bytes:** VERIFIED N/A; no keyboard/callback code.
- **Tenant/account isolation:** VERIFIED N/A; no application query or account behavior.
- **Git:** HEAD and staged-diff checksum must remain unchanged.
- **Application tree:** deterministic checksum of files under `apps/` must remain unchanged across Phase C.

## 9. Phase C implementation sequence

1. Capture pre-edit HEAD, staged diff checksum, scoped artifact checksums and aggregate `apps/` file checksum.
2. Re-run the four heading/count probes immediately before editing; stop on surprise or parallel-session drift.
3. Apply one minimal patch to `15`, `17`, `19`, and `20` only.
4. Run exact identity/reference/taxonomy gates in §10.
5. Run JSONL and source SHA-256 helpers in §10.
6. Confirm binding not-touched checksums (`14`, `18`, decision/requirement ledgers, source JSON aggregate, `apps/`) remain unchanged.
7. If all checks pass, write the full correction implementation report first, then its ≤20-line summary.
8. Append the required task-log entry.
9. Re-run HEAD/index/status and final allowlist audit.
10. Return the user-requested compact correction report. Do not stage, commit, push or deploy.

If any pre-edit checksum differs from this Plan’s snapshot, stop before editing and report a parallel-session conflict.

## 10. Static validation gates and expected counts

### 10.1 Identity definitions

1. Conflict headings in `14` → **exactly 7**:
   `0001,0002,0003,0004,0005,0006,0007`.
2. OQ headings in `15` → **exactly 7**:
   `0001,0002,0003,0004,0005,0006,0007`.
3. Duplicate conflict IDs → **0**.
4. Duplicate OQ IDs → **0**.
5. Master actual-question entries → **exactly 7**, one reference to each OQ ID.
6. Numbered canonical gap entries in `15` → **exactly 11**.
7. Master gap entries → **exactly 11**, matching the canonical labels.
8. `Reference lifecycle` occurrences classified as a historical OQ → **0**; classified as a forensic/evidence gap → **at least 2** (`15`, `17`; additionally condensed in `19`).

### 10.2 Cross-reference resolver

A read-only Python check will normalize full and shorthand identifiers and assert:

```text
EV definitions=43; unresolved references=0
DEC definitions=34; unresolved references=0
REQ definitions=25; unresolved references=0
OQ definitions=7; unresolved references=0
CONFLICT definitions=7; unresolved references=0
```

### 10.3 Evidence JSONL

```bash
python3 export_claude_lifeOS/_lifeos_forensic/_work/forensic_index.py \
  validate-evidence export_claude_lifeOS/_lifeos_forensic/18_evidence_index.jsonl
```

Expected:

```text
lines=43
unique_ids=43
resolved_source_records=42
errors=[]
```

### 10.4 Source integrity

```bash
python3 export_claude_lifeOS/_lifeos_forensic/_work/forensic_index.py check-source
```

Expected:

```text
checked=16
matched=16
mismatches=[]
```

### 10.5 Summary-count agreement

Expected after patch:

- original implementation report: conflicts 7, actual OQs 7 — unchanged;
- original compact summary: `CONFLICTS=7`, `OPEN_QUESTIONS=7` — unchanged;
- `20` completion gate: conflicts 7, actual OQs 7, forensic gaps 11;
- `20` identity checks: conflict definitions 7, OQ definitions 7;
- `15`, `17`, `19`: actual OQs 7, gaps 11.

### 10.6 No-mutation checks

- HEAD before/after → exact `67a1456c6165e9bdf36382a98c9713c4ed981314`.
- staged diff before/after → empty SHA-256 `e3b0c442…b855`.
- application-tree aggregate checksum before/after → exact match.
- `14` checksum before/after → `36d32322…56f`.
- `18` checksum before/after → `21da4c44…c6c`.
- source hash helper → 16/16.
- changed-file allowlist → only four correction artifacts plus Phase A/B/C workflow reports and required task log.

### 10.7 Syntax/lint/runtime tests

- `py_compile`: N/A — no Python file changes.
- `ruff`: N/A — no Python file changes.
- imports: N/A — no runtime modules touched.
- `pytest`: forbidden/not applicable under repository verification policy.
- browser/API/database/bot: not run; no runtime behavior changes.
- Alembic: N/A — no migration.

## 11. BOT TESTS («Ціль / Кроки / Очікую»)

**N/A — evidence:** the allowlist contains Markdown workflow/forensic artifacts only; no aiogram handler, callback, keyboard, FSM key or bot-visible string changes.

- **Ціль:** prove neighbor runtime paths are unaffected.
- **Кроки:** compare application-tree checksum and keep all bot files outside the changed-file allowlist; do not start the bot or run tgtest.
- **Очікую:** identical application checksum and zero bot/application paths in the diff.

Neighbor artifact regression (required equivalent): leave `14` and `18` byte-identical while verifying their definitions/references against the corrected counts.

## 12. Rollback plan

Because the task is no-commit and must not mutate Git state:

1. Retain pre-edit checksums and exact original text for the four planned regions.
2. If any gate fails, use a targeted reverse `apply_patch` only on the four edited forensic files.
3. Do not use `git reset`, `git checkout`, file deletion or any destructive broad command.
4. Re-run checksums, helper validations, HEAD and index checks after rollback.
5. Workflow reports remain as an honest failed/rolled-back audit record if failure occurs.

## 13. Consolidated sign-off items

1. **Correction surface:** edit only `15`, `17`, `19`, `20` plus required Phase C implementation/summary and task-log artifacts. **Recommendation: APPROVE.** Evidence: approved Discovery identified exactly these inconsistent consumers.
2. **Canonical taxonomy:** 7 actual historical OQs + 11 forensic/evidence gaps. **Recommendation: APPROVE.** This is already binding in the user amendment.
3. **Reference lifecycle:** gap #11, proposal-only, no OQ ID. **Recommendation: APPROVE.** Evidence: `DEC-0022` is `PROPOSED` at `03_decision_ledger.md:263-273`.
4. **Original implementation summary:** do not edit because its 7/7 facts remain true. **Recommendation: APPROVE.** Only `20` contains the stale conflict count.
5. **No Git/runtime action:** no stage/commit/push/deploy and no runtime tests. **Recommendation: APPROVE.** The task explicitly forbids Git/application mutation.

No unresolved architectural or naming decision remains inside the correction scope.

## 14. Planned final response contract

After successful Phase C, chat and the correction summary will return exactly the requested compact fields:

```text
CAUSE=
FILES_CORRECTED=
CONFLICTS_FINAL=
CONFLICT_IDS_FINAL=
OPEN_QUESTIONS_FINAL=
FORENSIC_GAPS_FINAL=
REFERENCE_VALIDATION=
SOURCE_HASH_CHECK=
OVERALL_STATUS=
```

WAITING FOR: plan approval
