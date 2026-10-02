# Collection and publication accounting

Initial collection: 2026-10-02T09:03:44.310668Z. Run timestamps and before/after file identity/hash evidence are in `runs/`.

Baseline full SHA: `69477c9365f06d6ac2831f124aa03b7a23fb5214`. Latest completed integration checkpoint verified from branch ancestry and its integration report. Later parallel branches are retained separately.

## Totals

- checkout count: 13
- source count: 18
- candidate count: 1994
- eligible occurrences: 1891
- unique published documents: 205
- deduplicated copies: 1686
- conflicting source paths: 12
- preserved conflicting versions: 45
- additional conflicting versions: 33
- withheld: 31
- excluded: 72
- unstable pending: 0
- retained prior occurrences: 0
- total preserved objects: 205
- reference occurrences: 34438
- unresolved or excluded reference occurrences: 30707

## Source coverage

| Source | Type | Candidates | Distinct versions present | New unique objects | Duplicate occurrences | Pending | Withheld | Excluded | Missing | Unsupported reference occurrences |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 13c9f1f | checkout | 136 | 134 | 134 | 0 | 0 | 2 | 0 | False | 2243 |
| LifeOS_DesignSystem | checkout | 128 | 127 | 3 | 124 | 0 | 1 | 0 | False | 2172 |
| LifeOS_account-security | checkout | 135 | 133 | 0 | 133 | 0 | 2 | 0 | False | 2239 |
| LifeOS_combined | checkout | 152 | 150 | 24 | 126 | 0 | 2 | 0 | False | 2371 |
| LifeOS_completeness-discovery | checkout | 154 | 152 | 2 | 150 | 0 | 2 | 0 | False | 2388 |
| LifeOS_encryption-documents | checkout | 140 | 138 | 4 | 134 | 0 | 2 | 0 | False | 2273 |
| LifeOS_finance-l1 | checkout | 154 | 152 | 9 | 143 | 0 | 2 | 0 | False | 2418 |
| LifeOS_loan-engine | checkout | 140 | 138 | 4 | 134 | 0 | 2 | 0 | False | 2267 |
| LifeOS_preview-launcher | checkout | 136 | 134 | 1 | 133 | 0 | 2 | 0 | False | 2249 |
| LifeOS_security-audit-20261001-215642 | checkout | 161 | 153 | 3 | 150 | 0 | 8 | 0 | False | 2377 |
| LifeOS_usability-followup | checkout | 153 | 151 | 5 | 146 | 0 | 2 | 0 | False | 2393 |
| _parallel_discovery | parallel | 4 | 4 | 4 | 0 | 0 | 0 | 0 | False | 209 |
| _parallel_planning | parallel | 11 | 11 | 8 | 3 | 0 | 0 | 0 | False | 217 |
| design_handoff_clarify_panel | design | 1 | 1 | 1 | 0 | 0 | 0 | 0 | False | 6 |
| design_handoff_hero_vignette | design | 1 | 1 | 1 | 0 | 0 | 0 | 0 | False | 5 |
| feat-jenkin-account-security-20261001 | checkout | 135 | 133 | 0 | 133 | 0 | 2 | 0 | False | 2239 |
| historical-outputs-export-20260928 | archive | 144 | 71 | 0 | 71 | 0 | 1 | 72 | False | 866 |
| main | checkout | 109 | 108 | 2 | 106 | 0 | 1 | 0 | False | 1775 |

New unique objects are assigned in deterministic source order; distinct versions present can overlap sources. Every candidate has exactly one disposition. Duplicate occurrence counts are global deduplication accounting.

## Withheld, excluded and pending candidates

- `13c9f1f/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `13c9f1f/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_DesignSystem/outputs/plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: sensitive-material review pending: connection_userpass.
- `LifeOS_account-security/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_account-security/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_combined/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_combined/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_completeness-discovery/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_completeness-discovery/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_encryption-documents/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_encryption-documents/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_finance-l1/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_finance-l1/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_loan-engine/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_loan-engine/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_preview-launcher/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_preview-launcher/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_security-audit-20261001-215642/Outputs/Audits/jenkin-security-20261001-215642/README.md` — **withheld**: Unpublished actionable security-audit details against the pinned baseline; withheld pending owner public-disclosure decision..
- `LifeOS_security-audit-20261001-215642/Outputs/Audits/jenkin-security-20261001-215642/evidence/source-review.md` — **withheld**: Unpublished actionable security-audit details against the pinned baseline; withheld pending owner public-disclosure decision..
- `LifeOS_security-audit-20261001-215642/Outputs/Audits/jenkin-security-20261001-215642/findings.md` — **withheld**: Unpublished actionable security-audit details against the pinned baseline; withheld pending owner public-disclosure decision..
- `LifeOS_security-audit-20261001-215642/Outputs/Audits/jenkin-security-20261001-215642/remediation-plan.md` — **withheld**: Unpublished actionable security-audit details against the pinned baseline; withheld pending owner public-disclosure decision..
- `LifeOS_security-audit-20261001-215642/Outputs/Audits/jenkin-security-20261001-215642/report.md` — **withheld**: Unpublished actionable security-audit details against the pinned baseline; withheld pending owner public-disclosure decision..
- `LifeOS_security-audit-20261001-215642/Outputs/Audits/jenkin-security-20261001-215642/threat-model.md` — **withheld**: Unpublished actionable security-audit details against the pinned baseline; withheld pending owner public-disclosure decision..
- `LifeOS_security-audit-20261001-215642/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_security-audit-20261001-215642/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_usability-followup/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `LifeOS_usability-followup/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `feat-jenkin-account-security-20261001/Outputs/Implementations/jenkin-integration-calendar-branding_20261001-031603.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `feat-jenkin-account-security-20261001/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `historical-outputs-export-20260928/__MACOSX/outputs/audits/._pf-01-batch-0-preimplementation_audit_2026-07-21_030012.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/audits/._pf-01-batch-0-qa-conflict_audit_2026-07-21_040844.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/audits/._pf-01-batch-3-1-local-verification_audit_2026-07-21_232305.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/audits/._pf-01-batch-3-static-counts_audit_2026-07-21_222213.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/audits/._pf-01-batch-3-vitest-scope_audit_2026-07-21_220056.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/audits/._pf-01-batch-3_preimplementation-scope_audit_2026-07-21_214113.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/backlog-tasks/._claude_observations.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/backlog-tasks/._task_log.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._lifeos-adaptive-analytics-f1-layer_discovery_2026-08-11_195514.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._lifeos-chatgpt-browser-handoff_discovery_2026-08-10_125824.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._lifeos-claude-export-forensic_discovery_2026-08-11_145202.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._lifeos-post-forensic-consistency-correction_discovery_2026-08-11_180602.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._lifeos-production-resumption_discovery_2026-07-21_010749.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._lifeos-refinement_discovery_2026-07-01.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._pf-01-batch-2_discovery_2026-07-21_062832.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._pf-01-batch-3-1-local-verification_discovery_2026-07-21_223736.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._pf-01-batch-3_discovery_2026-07-21_183556.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/discoveries/._pf-01-local-run-and-data_discovery_2026-07-22_033951.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-adaptive-analytics-design-import_20260908-040245.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-adaptive-analytics-slice-0_20260908-145309.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-adaptive-analytics-slice-0b_20260916-235514.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-adaptive-analytics-slice-1_20260918-165431.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-adaptive-analytics-slice-2_20260928-080526.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-adaptive-analytics-slice-p_20260928-090144.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-batch-0_implementation_7be0d82_2026-07-21.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-claude-export-forensic_implementation_no-commit_2026-08-11.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-consolidation_2026-09-28.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-design-handoff-hero-vignette_20260926-202144.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-post-forensic-consistency-correction_implementation_no-commit_2026-08-11.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-pre0-development-baseline_20260908-140841.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._lifeos-production-web_implementation_6c7039a_2026-07-21.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._pf-01-batch-2_implementation_102aea4_2026-07-21.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/implementations/._pf-01-batch-3_implementation_67a1456_2026-07-21.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/plans/._lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/plans/._lifeos-claude-export-forensic_plan_2026-08-11_152107.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/plans/._lifeos-post-forensic-consistency-correction_plan_2026-08-11_192833.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/plans/._lifeos-production-foundation_plan_2026-07-21_011746.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/plans/._lifeos-refinement_plan_2026-07-01.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/plans/._pf-01-batch-2_plan_2026-07-21_132405.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/plans/._pf-01-batch-3-1-local-verification_plan_2026-07-21_225632.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/plans/._pf-01-batch-3_plan_2026-07-21_191900.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-adaptive-analytics-design-import_20260908-040245.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-adaptive-analytics-f1-layer_discovery_2026-08-11_195514.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-batch-0_implementation_7be0d82_2026-07-21.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-chatgpt-browser-handoff_discovery_2026-08-10_125824.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-claude-export-forensic_discovery_2026-08-11_145202.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-claude-export-forensic_implementation_no-commit_2026-08-11.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-claude-export-forensic_plan_2026-08-11_152107.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-post-forensic-consistency-correction_discovery_2026-08-11_180602.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-post-forensic-consistency-correction_implementation_no-commit_2026-08-11.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-post-forensic-consistency-correction_plan_2026-08-11_192833.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-production-foundation_plan_2026-07-21_011746.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-production-resumption_discovery_2026-07-21_010749.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._lifeos-production-web_implementation_6c7039a_2026-07-21.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-0-preimplementation_audit_2026-07-21_030012.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-0-qa-conflict_audit_2026-07-21_040844.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-2_discovery_2026-07-21_062832.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-2_implementation_102aea4_2026-07-21.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-2_plan_2026-07-21_132405.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-3-1-local-verification_audit_2026-07-21_232305.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-3-1-local-verification_discovery_2026-07-21_223736.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-3-1-local-verification_plan_2026-07-21_225632.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-3-static-counts_audit_2026-07-21_222213.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-3-vitest-scope_audit_2026-07-21_220056.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-3_discovery_2026-07-21_183556.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-3_implementation_67a1456_2026-07-21.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-3_plan_2026-07-21_191900.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-batch-3_preimplementation-scope_audit_2026-07-21_214113.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/__MACOSX/outputs/summaries/._pf-01-local-run-and-data_discovery_2026-07-22_033951.md` — **excluded**: AppleDouble/resource-fork metadata; not authored Markdown.
- `historical-outputs-export-20260928/outputs/plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..
- `main/Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md` — **withheld**: Historical test-database connection includes a literal user/password; live validity versus example status is unresolved. Withheld pending owner credential classification..

## Source/path issues

None detected.

## Hygiene and limitations

All eligible bytes were scanned before staging using bounded secret/private-key/DSN/account/financial/health pattern recognizers and hash-bound manual review of matches. Technical examples, synthetic QA records and documented paths are not automatically secrets. No sensitive values are logged. Newly flagged bytes remain withheld until reviewed; reviewed hashes never override explicit withheld-path decisions. Unpublished actionable security reports are withheld for owner disclosure review in this public repository.

Archive central-directory checks precede reads: 2000-member, 64 MiB total, 16 MiB/member, 100:1 expansion bounds; no absolute/traversal/symlink/encrypted/nested-archive entries; read directly without extraction or execution. ZIP dates are metadata, not authorship proof. AppleDouble files are accounted for and excluded. Other ZIPs, assets, screenshots, runtimes, fonts, mail, databases and dumps were not imported.

Every copied object is hash-checked against a stable double-read snapshot. Manifest provenance, object completeness, deterministic ordering and generated local links are validated by the collector. Relative-reference parsing covers Markdown links, reference definitions, HTML src/href and explicit extension-bearing code paths; arbitrary prose references and heading fragments may need human interpretation. Missing/excluded attachment references are detailed in [LINK_MAP.md](LINK_MAP.md). Application suites were not run for this isolated documentation task.
