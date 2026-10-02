# PLAN for LifeOS Claude export forensic reconstruction

**Дата:** 2026-08-11 15:21:07 EEST
**Фаза:** B — Plan, read-only
**HEAD:** `67a1456c6165e9bdf36382a98c9713c4ed981314`
**Branch:** `design-sync-setup`
**Source root:** `export_claude_lifeOS/`
**Authorized forensic output root:** `export_claude_lifeOS/_lifeos_forensic/`
**Discovery basis:** `export_claude_lifeOS/_lifeos_forensic/00_source_inventory.md`
**Task specification:** `/Users/yurasachenko/.codex/attachments/f95d7782-317f-4dcd-bbf2-b43bb8906a0a/pasted-text.txt`

## 1. Plan verdict

**RECOMMEND APPROVAL.** The corpus is structurally readable and source integrity has a complete SHA-256 baseline. Phase C will build a provenance-preserving semantic reconstruction without modifying source JSON, application code or Git state. It will produce the 20 required artifacts, perform the required second and contradiction passes, then validate coverage, identifiers, JSONL, redaction and source hashes.

## 2. Re-anchored evidence and basis drift

- **VERIFIED:** current HEAD remains `67a1456c6165e9bdf36382a98c9713c4ed981314`; no commit landed since the Discovery basis.
- **VERIFIED:** the only forensic artifact currently present is `export_claude_lifeOS/_lifeos_forensic/00_source_inventory.md`; `find .../_lifeos_forensic -maxdepth 1 -type f` → exactly 1 file.
- **VERIFIED:** structural baseline is 17 physical source files, 16 parseable JSON, 66 conversation records and 3,203 messages (`00_source_inventory.md:290-303`).
- **VERIFIED:** 60 parent references are unresolved and 8 Design Chat project UUIDs lack matching project exports (`00_source_inventory.md:202-215`).
- **VERIFIED:** all required output artifacts and their contents are specified by the user (`pasted-text.txt:1642-2229`).
- **VERIFIED:** second semantic pass, contradiction pass and completion gates are mandatory (`pasted-text.txt:2237-2274`, `:2538-2595`).
- **VERIFIED:** historical intent, implementation claims and current repository reality must remain separate (`pasted-text.txt:1292-1384`).
- **VERIFIED:** source JSON is currently user-owned/untracked as one directory; pre-existing unrelated worktree changes remain untouched.

## 3. Binding scope

### In scope

1. Read every parseable source record under `export_claude_lifeOS/`, including message text, visible content blocks, attachment extracted content, project docs and memories.
2. Classify all 66 discovered conversations as HIGH/MEDIUM/LOW/IRRELEVANT.
3. Canonicalize duplicate evidence while preserving all physical source locations.
4. Build evidence, decision, requirement, conflict, supersession and open-question registries.
5. Reconstruct product, GTD, dashboard, IA, design, pages/flows, data model and architecture history.
6. Reconcile historical intent only against the supplied/reverified HEAD `67a1456` guardrail.
7. Produce and validate `00`–`19` artifacts plus limited helper/validation artifacts inside `_lifeos_forensic/`.

### Out of scope

1. Product implementation or code fixes.
2. Editing/export normalization in place.
3. New architecture/product decisions.
4. Network/web research.
5. Installing dependencies.
6. Starting frontend/backend, database, Docker, browser or deployment flows.
7. Commit, push, deploy, branch changes or Git staging.
8. Publishing personal/login metadata or secrets.

## 4. Files to create or update

All semantic outputs are under the dedicated forensic output root. The separate `Outputs/Plans`, `Outputs/Summaries` and final `Outputs/Implementations` files are mandatory workflow reports only.

### 4.1 Existing forensic artifact to update

| File | Planned range | Purpose | Plan section |
|---|---|---|---|
| `export_claude_lifeOS/_lifeos_forensic/00_source_inventory.md` | append after current end (`:307`) | Add final integrity recheck, semantic coverage completion result and any proven structural correction; never rewrite source facts silently. | §15 validation |

### 4.2 Required forensic artifacts to create

| File | Purpose | Primary phase |
|---|---|---|
| `01_relevance_index.md` | All 66 conversations, physical sources, date range, relevance and classification rationale; includes irrelevant count. | corpus routing |
| `02_conversation_timeline.md` | Decision/evolution timeline, not transcript summary. | chronology |
| `03_decision_ledger.md` | Stable `LIFEOS-DEC-*` registry with rationale, status, supersession and sources. | decision graph |
| `04_requirements_ledger.md` | Stable `LIFEOS-REQ-*` registry preserving user authority and unknown priority. | requirements |
| `05_product_vision.md` | Evidence-based north star, philosophy, user problem, boundaries, anti-goals. | product pass |
| `06_information_architecture.md` | Navigation/page/module/entity hierarchy with status and conflicts. | IA pass |
| `07_dashboard_specification.md` | Dashboard purpose, layout, actions, widgets, data and GTD integration. | dashboard pass |
| `08_gtd_system.md` | Capture/Clarify/Organize/Reflect/Engage and evidence-supported LifeOS mapping. | GTD pass |
| `09_gtd_to_ui_mapping.md` | Implementation-oriented GTD→entity→screen→component→mutation→state map. | GTD/UI pass |
| `10_design_system.md` | Confirmed/proposed/superseded design foundations, components, states and philosophy. | design pass |
| `11_pages_and_flows.md` | Page-by-page specs and evidence-supported user flows. | UX flow pass |
| `12_domain_data_model.md` | Human model, entity relations and Mermaid ER only when evidence is sufficient. | domain pass |
| `13_architecture_history.md` | Architecture evolution, latest archive intent and separate current reality. | architecture pass |
| `14_conflicts_and_supersessions.md` | Conflicts, rejections, supersessions, chronology and confidence. | contradiction pass |
| `15_open_questions.md` | Actual open project questions separated from forensic evidence gaps. | unresolved pass |
| `16_current_repo_reconciliation.md` | Archive intent/current reality/relationship/gap/implication matrix. | reconciliation |
| `17_master_lifeos_spec.md` | Primary reconstructed product/UX/GTD/design/architecture specification. | final synthesis |
| `18_evidence_index.jsonl` | Machine-readable, unique and redacted `LIFEOS-EV-*` evidence records. | provenance core |
| `19_handoff_summary.md` | High-signal next-agent handoff and reading order. | handoff |

### 4.3 Additional helper artifacts

| File | Purpose | Content restriction |
|---|---|---|
| `_work/forensic_index.py` | Reproducible read-only parser/index validator using Python stdlib only. | No source writes; no network; no dependency install. |
| `_work/coverage_state.json` | Metadata-only coverage counters, source IDs/hashes and pass completion flags. | No full message text, secrets or login metadata. |
| `20_validation_report.md` | Actual gate outputs, source integrity, redaction review, ID/reference checks and completion verdict. | No raw secret matches; only counts/redacted locations. |

No persistent raw-text corpus copy or unredacted candidate JSONL will be created.

## 5. Helper design and signatures

There is no existing helper code. The new helper is analytical output, not LifeOS application implementation.

```python
def load_json(path: Path) -> Any
def source_json_paths(root: Path) -> list[Path]
def iter_standard_conversations(root: Path) -> Iterator[ConversationRecord]
def iter_design_conversations(root: Path) -> Iterator[ConversationRecord]
def iter_project_documents(root: Path) -> Iterator[DocumentRecord]
def extract_fragments(message: Mapping[str, Any], source_kind: str) -> list[TextFragment]
def normalize_text(value: str) -> str
def fingerprint_message(record: MessageRecord) -> str
def redact_secrets(value: str) -> tuple[str, list[str]]
def build_metadata_index(root: Path) -> CoverageState
def verify_source_hashes(root: Path, expected: Mapping[str, str]) -> list[HashMismatch]
def validate_evidence_jsonl(path: Path) -> ValidationResult
def validate_identifier_references(output_root: Path) -> ValidationResult
```

### Helper invariants

1. Input files open read-only.
2. Output is restricted to `_lifeos_forensic/`.
3. No user/login field values enter `coverage_state.json`.
4. Message text is processed in memory; only selected, redacted evidence excerpts persist.
5. Stable ordering is timestamp → source kind/path → conversation ID → message ID → fragment ordinal.
6. Fingerprints do not replace source IDs; they only support physical-duplication detection.
7. A source read/parse failure stops synthesis and marks overall status incomplete.

## 6. Phase C execution sequence

### Stage 0 — Preflight and immutability snapshot

1. Reconfirm HEAD/branch and existing dirty state without changing Git.
2. Recompute all 16 source JSON hashes and compare with `00_source_inventory.md:249-276`.
3. Recount the structural baseline: 17 physical source files, 16 JSON, 58 standard conversations, 8 Design Chats, 3,203 messages, 21 project docs, 593 attachments, 1,226 file references.
4. Stop immediately on hash/count drift; do not infer whether another process changed the source.

### Stage 1 — Reproducible metadata and provenance index

1. Create `_work/forensic_index.py` and metadata-only `_work/coverage_state.json`.
2. Canonicalize source locations and IDs without rewriting source JSON.
3. Map every standard/Design conversation and message, parent reference, attachment, file reference, memory and project document.
4. Preserve unresolved parent references explicitly.
5. Treat the 10 repeated file UUID references as one referenced file identity with all physical message locations.
6. Record Design project metadata gaps instead of fabricating project instructions.

### Stage 2 — Relevance routing for the entire corpus

1. Review all 58 conversation titles and summaries, all 8 Design Chat metadata records, memory blocks and project metadata.
2. Run broad multilingual semantic candidate searches across visible message text, tool results, project docs and attachment extracted content.
3. Use LifeOS/product/GTD/design/architecture concepts as routing hints, never as automatic acceptance.
4. Assign HIGH/MEDIUM/LOW/IRRELEVANT to all 66 conversations.
5. Fully read/analyze all HIGH and MEDIUM conversations.
6. Inspect every LOW conversation for isolated high-authority user decisions, including short Russian corrections.
7. Track IRRELEVANT records quantitatively with rationale; do not synthesize their content.
8. Produce `01_relevance_index.md` only after counts sum exactly to 66.

### Stage 3 — First evidence extraction pass

For each relevant evidence window:

1. Capture source file, physical source set, conversation ID/title, message ID, parent ID, timestamp and role.
2. Assign one epistemic classification from the allowed set.
3. Assign domain/topics and HIGH/MEDIUM/LOW confidence.
4. Preserve a concise excerpt with enough surrounding context to show acceptance/rejection/rationale.
5. Redact secret-shaped material before persistence.
6. Never promote Claude proposal to decision without user acceptance evidence.
7. Never promote conversational implementation claim to repository fact.
8. Write/validate `18_evidence_index.jsonl` incrementally with stable `LIFEOS-EV-*` IDs.

### Stage 4 — Authority-aware ledgers and chronology

1. Cluster evidence into unique decisions and requirements.
2. Assign stable chronological `LIFEOS-DEC-*` and `LIFEOS-REQ-*` IDs.
3. Preserve first seen, decision date, last confirmation, rationale, alternatives and supersession links.
4. Separate actual open questions from missing evidence.
5. Produce `03_decision_ledger.md`, `04_requirements_ledger.md`, initial `14_conflicts_and_supersessions.md`, `15_open_questions.md` and `02_conversation_timeline.md`.
6. Verify every ledger source resolves to a real evidence record.

### Stage 5 — Domain reconstruction passes

Run separate evidence-driven passes in this order:

1. Product vision → `05_product_vision.md`.
2. Information architecture/navigation → `06_information_architecture.md`.
3. Dashboard → `07_dashboard_specification.md`.
4. GTD Capture/Clarify/Organize/Reflect/Engage → `08_gtd_system.md`.
5. GTD→UI/dashboard/entity/state mapping → `09_gtd_to_ui_mapping.md`.
6. Design foundations/components/states/philosophy → `10_design_system.md`.
7. Pages and flows → `11_pages_and_flows.md`.
8. Conceptual domain/data model → `12_domain_data_model.md`.
9. Technical evolution → `13_architecture_history.md`.

Every unsupported mapping uses `INSUFFICIENT_ARCHIVE_EVIDENCE`; proposals remain proposals.

### Stage 6 — Dedicated second semantic pass

1. Search for short user approvals/rejections/corrections in RU/UA/EN.
2. Re-query concepts without their canonical names: e.g. Capture without “GTD”, architecture decisions inside bug/implementation conversations, design decisions inside screenshots or UI critiques.
3. Check attachment extracted content and project documents again for decisions absent from message text.
4. Revisit LOW conversations around dates of high-impact decisions.
5. Update evidence and ledgers; record actual changes made by second pass in `20_validation_report.md`.

### Stage 7 — Dedicated contradiction/supersession pass

For dashboard, navigation, tasks, projects, areas, goals, GTD, design, persistence, frontend/backend, auth, accounts and sync:

1. Search later corrections/rejections/replacements.
2. Compare chronology and user authority.
3. Assign only allowed resolution values.
4. Preserve both old and replacement decisions.
5. Mark insufficient evidence `UNRESOLVED`.
6. Finalize `14_conflicts_and_supersessions.md` and revise affected ledgers/domain specs.

### Stage 8 — Current repository reconciliation

1. Use only the verified HEAD `67a1456` reality supplied in the task and re-anchored Discovery.
2. Build the required relationship matrix across frontend, localStorage, server persistence, backend, auth/accounts, revision sync, dashboard/GTD, placeholder pages, health/CRUD and deployment.
3. Label any claim outside that guardrail `REQUIRES_REPO_VERIFICATION`.
4. Never let current implementation erase historical intent.
5. Produce `16_current_repo_reconciliation.md`.

### Stage 9 — Final synthesis and handoff

1. Generate `17_master_lifeos_spec.md` from validated ledgers/domain artifacts, not directly from raw chat summaries.
2. Answer all 36 required final questions; use `INSUFFICIENT_ARCHIVE_EVIDENCE` where necessary.
3. Generate `19_handoff_summary.md` with the required reading order and high-risk supersessions/gaps.
4. Keep the handoff compact; do not duplicate the full master spec.

### Stage 10 — Final validation

Execute all gates in §15, write actual results to `20_validation_report.md`, append final integrity status to `00_source_inventory.md`, then produce the required compact terminal summary.

## 7. Evidence and excerpt policy

1. User-visible message text has highest authority for requirements/acceptance.
2. Claude-visible response text can establish PROPOSED, IMPLEMENTATION_CLAIM, RATIONALE or OBSERVED_PROBLEM, not user acceptance by itself.
3. Tool results/attachments/project docs may establish artifacts and historical implementation claims; they do not prove current repository reality.
4. Internal `thinking` blocks are included in structural coverage but are not standalone authority for a user decision. They may only route investigation or support low-confidence Claude rationale when the visible conversation corroborates it.
5. Excerpts target 100–700 characters; longer windows only when needed to preserve an explicit choice among alternatives.
6. Evidence uses source-native language. Synthesis may paraphrase, but the source relationship remains explicit.
7. No full transcript or full attachment is copied into outputs.

## 8. Secret/privacy handling

### Redaction targets

- API/access/refresh/session tokens and cookies;
- passwords and bootstrap tokens;
- private keys/authorization headers;
- unnecessary email, phone, IP, location, user agent and login metadata;
- credential-bearing URLs and environment assignments.

### Process

1. Privacy-only JSON remains structural-only.
2. Automated redaction runs before evidence serialization.
3. Secret-like matches are reviewed in memory; output receives `[REDACTED_SECRET]`.
4. Final scan records counts only, never the matching secret text.
5. Product-relevant personal context is minimized to what explains a requirement.

## 9. Behavior / consumer matrix

No application caller changes occur. The relevant downstream consumers are forensic artifacts.

| Producer | Consumers | Required behavior delta |
|---|---|---|
| `18_evidence_index.jsonl` | ledgers, domain specs, master spec, handoff | New provenance source; all IDs unique and references resolvable. |
| `03_decision_ledger.md` | timeline, conflicts, master, handoff | Decisions remain authority-aware and supersession-linked. |
| `04_requirements_ledger.md` | domain specs, reconciliation, master | Explicit user requirements remain separate from proposals. |
| `14_conflicts_and_supersessions.md` | every affected domain artifact | Old/new decisions both preserved; no silent reconciliation. |
| `16_current_repo_reconciliation.md` | master, handoff | Historical/current layers never merged. |
| `17_master_lifeos_spec.md` | future product/design/engineering agents | Synthesizes only validated ledgers/evidence. |
| `_work/forensic_index.py` | coverage and validation outputs only | Must not mutate source or application files. |

## 10. Blast radius

- **Source shared state:** read-only JSON corpus and its SHA-256 baseline.
- **Written state:** Markdown/JSONL/metadata helper outputs under `_lifeos_forensic/`; mandatory workflow reports under `Outputs/`.
- **Runtime callers:** none.
- **Database/network:** none.
- **Git:** read-only status/HEAD checks only.
- **Risk of semantic blast radius:** a wrongly promoted proposal would contaminate multiple downstream specs. Mitigation: evidence index first, authority status required, references validated.
- **Risk of ID blast radius:** renumbering after publication would break cross-references. Mitigation: stable chronological assignment after first extraction; later additions append IDs rather than renumber.

## 11. Invariants checklist

| Invariant | Verdict / evidence |
|---|---|
| Source JSON immutable | REQUIRED; verify 16/16 hashes before and after. |
| Complete structural coverage | REQUIRED baseline: 17 files, 66 conversations, 3,203 messages (`00_source_inventory.md:290-303`). |
| Relevance coverage | HIGH+MEDIUM+LOW+IRRELEVANT must equal 66. |
| Evidence provenance | Every important claim resolves to source file + conversation/message IDs/timestamp/role where available. |
| Decision authority | Claude proposal/claim cannot become DECIDED without acceptance evidence. |
| Historical/current separation | REQUIRED by task (`pasted-text.txt:1292-1384`). |
| Secret safety | No secret/private login values in artifacts. |
| Stable IDs | `EV`, `DEC`, `REQ`, `OQ` unique and cross-references valid. |
| Negative evidence | Absolute “never discussed” only if full relevant coverage supports it. |
| Billing | **VERIFIED N/A:** no LifeOS billing/credits behavior is changed. |
| Status state-machine | **VERIFIED N/A:** no application state transitions are changed. |
| FSM keys | **VERIFIED N/A:** no FSM exists in this forensic output task. |
| callback_data ≤64B | **VERIFIED N/A:** no Telegram keyboard/callback is created. |
| DB migration | **VERIFIED N/A:** no schema or Alembic file changes. |

## 12. Database, API, dependency and deployment plan

- Database migrations: none.
- API signatures/routes: none.
- Environment variables: none.
- External dependencies: none; Python standard library and existing `jq`, `rg`, shell utilities only.
- Network/API calls: forbidden.
- Deployment: forbidden.
- Commit/push: forbidden by task operating mode.

## 13. BOT TESTS («Ціль / Кроки / Очікую»)

### Ціль

Confirm that bot/runtime verification is genuinely not applicable and that no product flow is invoked by the forensic task.

### Кроки

1. Verify `git diff --exit-code -- apps/web apps/api` remains exit 0.
2. Verify no bot/server/database/browser command appears in actual execution log.
3. Verify output writes are restricted to approved report/output directories.

### Очікую

- No bot startup, callback, paid operation or external service call.
- No runtime smoke claimed as PASS.

### Neighbor-path regression

Recompute source JSON hashes and compare repository application diff. This is the relevant adjacent regression for a read-only forensic task.

## 14. Rollback plan

Original export and application code remain untouched, so forensic output rollback is isolated.

1. Do not use `git reset`, checkout or destructive source commands.
2. If outputs are rejected, move newly created `01`–`20` and `_work/` into a dated `_lifeos_forensic/_rejected/` subdirectory only after explicit user request; preserve them for recovery.
3. Retain original `00_source_inventory.md` or restore its pre-Phase-C version from the Plan-recorded content.
4. Reconfirm 16/16 source hashes after rollback.

## 15. Static and forensic validation gates

### 15.1 Helper gates

| Gate | Expected |
|---|---|
| `python -m py_compile _work/forensic_index.py` with pycache redirected to temp | exit 0; exactly 1 helper compiled |
| `ruff check _work/forensic_index.py` if existing Ruff executable is available | exit 0 or explicit environment gap; no installation |
| helper `--check-source` mode | 16/16 source hashes match |
| helper `--coverage` mode | exact structural baseline preserved |

### 15.2 Artifact gates

| Gate | Expected |
|---|---|
| Required numbered artifacts | exactly 20 files `00`–`19`, all non-empty |
| Additional validation artifact | exactly one `20_validation_report.md` |
| Relevance rows | exactly 66 unique conversation IDs |
| Relevance sum | HIGH + MEDIUM + LOW + IRRELEVANT = 66 |
| Standard message coverage | 3,187 unique IDs accounted for structurally |
| Design message coverage | 16 unique IDs accounted for structurally |
| Evidence JSONL parse | every non-empty line passes `jq -e`; zero invalid lines |
| Evidence IDs | line count = unique `LIFEOS-EV-*` count |
| Decision IDs | all `LIFEOS-DEC-*` definitions unique; every reference resolves |
| Requirement IDs | all `LIFEOS-REQ-*` definitions unique; every reference resolves |
| Open-question IDs | all `LIFEOS-OQ-*` definitions unique; every reference resolves |
| Allowed classifications | zero values outside specified enum |
| Allowed confidence | only HIGH/MEDIUM/LOW |
| Required final questions | all 36 answered or explicitly `INSUFFICIENT_ARCHIVE_EVIDENCE` |
| Required GTD sections | all 21 present in `08_gtd_system.md` |
| Required master sections | all 22 present in `17_master_lifeos_spec.md` |

### 15.3 Safety gates

| Gate | Expected |
|---|---|
| Source hash recheck | exactly 16/16 match baseline |
| Source parse recheck | 16 PASS / 0 FAIL |
| Secret scanner | zero unredacted high-confidence matches after manual review |
| Privacy-source value check | zero copied email/phone/IP/location/user-agent values |
| Source output isolation | no files created beside original JSON except `_lifeos_forensic/` directory |
| Application diff | `git diff --exit-code -- apps/web apps/api` → exit 0 |
| Git mutation | no stage/commit/push/deploy |

### 15.4 Semantic integrity gates

1. Sample every DECIDED record back to its evidence window.
2. Sample every SUPERSEDED/REJECTED record to both old and later authority evidence.
3. Verify all IMPLEMENTATION_CLAIM entries remain separate from current repo reality.
4. Verify each LOW-confidence item is not phrased as canonical.
5. Verify each reconciliation row uses an allowed relationship value.
6. Verify no unsupported GTD theory fills archive gaps.
7. Record second-pass additions and contradiction-pass changes quantitatively.

## 16. BINDING NOT-TOUCHED list

- `export_claude_lifeOS/*.json`
- `export_claude_lifeOS/design_chats/*.json`
- `export_claude_lifeOS/projects/*.json`
- `apps/web/**`
- `apps/api/**`
- root `README.md`, `ARCHITECTURE.md`, prompt/user-owned files and tests
- Git index, commits, branches and remotes
- external systems, VPS, database and network

## 17. Stop conditions

Stop without improvisation if:

1. any source hash changes;
2. any JSON becomes unreadable;
3. a source schema differs materially from Discovery;
4. a parallel session modifies `_lifeos_forensic/`;
5. a secret cannot be safely redacted while preserving the evidence meaning;
6. a conflict prevents reliable corpus processing itself (for example, source identity or record boundaries cannot be established), rather than merely making the historical project record genuinely ambiguous;
7. the helper would need a new dependency or write outside the authorized output root.

Historical ambiguity is not a stop condition. If a high-impact decision has irreconcilable candidates with no chronology/authority basis:

- preserve all conflicting evidence;
- classify the conflict as `UNRESOLVED`;
- assign confidence appropriately;
- record it in `14_conflicts_and_supersessions.md`;
- propagate the unresolved state into affected ledgers and domain specifications;
- use `INSUFFICIENT_ARCHIVE_EVIDENCE` where a canonical conclusion cannot be established.

## 18. Consolidated SIGN-OFF ITEMS

1. **Helper:** approve `_work/forensic_index.py` using Python stdlib only. Recommendation: **APPROVE** for reproducible 176-MB corpus coverage.
2. **Artifact language:** Russian analytical prose, English fixed enums/IDs/schema fields, original-language excerpts. Recommendation: **APPROVE** for owner readability and machine stability.
3. **Internal thinking blocks:** structurally cover but never use as standalone user-decision authority. Recommendation: **APPROVE**.
4. **Evidence excerpts:** default 100–700 characters, longer only for decision context. Recommendation: **APPROVE**.
5. **Extra validation artifact:** create `20_validation_report.md`. Recommendation: **APPROVE** because completion claims need durable actual gate output.
6. **Git policy:** no stage/commit/push/deploy despite generated forensic artifacts. Recommendation: **APPROVE**, matching the explicit forensic operating mode.
7. **Repository reconciliation:** limit current-state claims to HEAD `67a1456` guardrail; anything else becomes `REQUIRES_REPO_VERIFICATION`. Recommendation: **APPROVE**.

## 19. Expected Phase C completion output

The terminal response will use the exact compact metric block required by the task, followed by 10–20 highest-value findings. It will not paste the forensic specification. `OVERALL_STATUS=PASS` is allowed only if all material corpus and validation gates pass; otherwise status will name the incomplete layer.

**WAITING FOR:** explicit approval of this Plan and the seven sign-off items, then command `Continue` for PHASE C implementation.
