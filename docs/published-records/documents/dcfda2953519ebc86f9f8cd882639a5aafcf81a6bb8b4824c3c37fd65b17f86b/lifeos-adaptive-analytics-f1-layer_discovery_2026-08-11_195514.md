===== LIFEOS ADAPTIVE ANALYTICS DISCOVERY =====
HEAD=67a1456c6165e9bdf36382a98c9713c4ed981314; BASELINE_DRIFT=NO
SHOULD_ADAPTIVE_ANALYTICS_EXIST=YES_WITH_CONSTRAINTS; CURRENT_ARCHITECTURE_CAN_HOST_LAYER=PARTIALLY; CURRENT_HISTORY_SUPPORT=PARTIAL
GTD_COMPATIBILITY=COMPLEMENTARY; DASHBOARD_INTEGRATION=POSSIBLE_WITH_DESIGN
CURRENT_STYLE_GUIDE_SUFFICIENT=VISUAL_ONLY; CLAUDE_DESIGN_REQUIRED=YES
REUSABLE_FRONTEND_PRIMITIVES=StatCard,ChartCard,native-SVG-trend,bars,tabs,modals,drawers,forms,states,responsive-tokens
REUSABLE_BACKEND_PRIMITIVES=authenticated-per-user-state,revision-CAS,PostgreSQL/JSONB,current-snapshot-projection; NEW_DOMAIN_CONCEPTS_CANDIDATE_COUNT=15
NEW_PRODUCT_DECISIONS_REQUIRED=9; DESIGN_DECISIONS_REQUIRED=8
MVP_CANDIDATES=measurement,expectation/baseline,expected-vs-actual/delta,history,observation,review,material-signal
LATER_CANDIDATES=experiment,diagnosis,trade-off,system-review,scenario,AI,pattern-discovery
PRIMARY_ARCHITECTURE_RISK=latest-snapshot-overwrites-history; PRIMARY_PRODUCT_RISK=punitive-metric-optimization
PRIMARY_DESIGN_RISK=Home-cockpit-overload; PRIMARY_ANALYTICS_TRUST_RISK=false-causality-from-sparse/biased-data
RECOMMENDED_NEXT_PHASE=PRODUCT_DECISIONS→CLAUDE_DESIGN→TARGETED_TECHNICAL_DISCOVERY→PHASE_B_PLAN
DISCOVERY_REPORT=Outputs/Discoveries/lifeos-adaptive-analytics-f1-layer_discovery_2026-08-11_195514.md; DISCOVERY_SUMMARY=Outputs/Summaries/lifeos-adaptive-analytics-f1-layer_discovery_2026-08-11_195514.md
APPLICATION_MUTATION=NO; SOURCE_FORENSIC_MUTATION=NO; GIT_MUTATION=NO; COMMIT=NOT_RUN; PUSH=NOT_RUN; DEPLOY=NOT_RUN
- На Home варто показувати лише 1–3 суттєві пояснювані сигнали; історія та review мають жити в detail/review-поверхнях.
- Поточна activity-історія обмежена, змінна й неповна; revision контролює конкуренцію, тому провідний, але не затверджений напрям — snapshot + append-only history.
- Візуальна мова придатна до повторного використання, але provenance, uncertainty, metric-history і debrief потребують Claude Design.
- Full: Outputs/Discoveries/lifeos-adaptive-analytics-f1-layer_discovery_2026-08-11_195514.md
WAITING FOR: review of discovery
