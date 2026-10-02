# Adaptive Analytics — Targeted Technical Discovery · Summary

**2026-09-08 04:26:47** · mode `READ_ONLY_DISCOVERY_AND_ARCHITECTURE`
Full report → `Outputs/Discoveries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md`

```
DISCOVERY_STATUS=COMPLETE
BRANCH=design/adaptive-analytics-import
HEAD=d4960286ec94f35472600e59c0d533dc50a64351
WORKTREE=clean except pre-existing ` M .DS_Store` (user-owned, untouched)
DESIGN_CONTRACT=adaptive-analytics-design-accepted (annotated) → d496028 · A–J complete
A_J_RECONCILIATION=0 of 11 surfaces implementable truthfully today (H partially backed)
CURRENT_HISTORY_SUPPORT=NONE (snapshot-only; `revision` is CAS, not versioning)
RECOMMENDED_ARCHITECTURE=Option D — hybrid: snapshot + durable semantic history
TARGET_ARCHITECTURE_READY=YES
PHASE_B_PLAN_READY=NO (D1/D2/D3 + Project-domain prerequisite; Slices 0/0b/1 plannable now)
APPLICATION_CODE_CHANGED=NO · DB_CHANGED=NO · COMMIT=NO · PUSH=NO · DEPLOY=NO
```

## Verdict

LifeOS persists **one mutable JSONB document per user** (`user_snapshots`, PK = `user_id`), fully replaced on every write. `revision` is an optimistic-concurrency counter; the prior payload is overwritten and unrecoverable. Of the seven statements the accepted contract promises — what happened · what you expected then · how forecasts moved · where data came from · what was corrected · what stays unknown · what you decided — **none is auditable today**.

Adaptive Analytics is a **persistence** problem, not a rendering one. It is also unusually low-risk to add: no analytics code exists in the product, so the history layer is purely additive.

## Ten highest-value findings

1. **One row per user, whole-document replace.** `user_snapshots.user_id` is the primary key; `UPDATE … SET payload = :new` destroys the prior document.
2. **`revision` is CAS, not history** — exactly the confusion §9 of the brief warned about, confirmed in `services/state.py` and `test_state_revision_conflict.py`.
3. **Expectation / Target / Forecast / Baseline do not exist.** The product's only budget is `const budget = 300;` (`MoneyWidget.jsx:30`).
4. **`activityLog` cannot serve as history:** FIFO-capped at 5000, user-prunable from Settings, inside the replaceable blob, records only *new* values (no before→after), no provenance. It violates "No Silent History Loss" by construction.
5. **No correction path exists.** `LifeDataContext` has no `updateTransaction` and no `deleteTransaction` — the accepted ₴12,000 → ₴1,200 case has no code path at all.
6. **The conflict freeze is the decisive architectural fact.** `stateSyncCoordinator.ts` sets `frozen = true` on HTTP 409 and stops *all* syncing until manual recovery, which discards pending state. Routing fact recording through that path means one concurrent write on a second device can silently stop LifeOS recording what happened.
7. **The 5 MiB pre-parse body cap** (`body_limit.py`) rules out bounded-JSONB history; `activityLog` at cap already budgets ≈750 KB.
8. **Bitemporality is the minimum viable answer.** Every fact needs `occurred_at` *and* `recorded_at`; the accepted seed already shows it (`{when:'12 авг', value:'20 авг'}` — recorded then, predicted for later).
9. **The collapse hazard is visible inside the accepted package.** «версий прогноза» is computed as `forecasts.filter(f => !f.actual)` because an actual was stored inside the forecast array — concrete evidence for separate tables per concept over one polymorphic event table.
10. **Export would silently break.** Export is client-side only (`exportJSON()` over the in-memory tree). Once history leaves the snapshot, "export" quietly stops meaning "everything" — a server export endpoint is a release blocker, not later hardening.

Also: `export_claude_lifeOS/_lifeos_forensic/**` is **absent** from this repository; `ARCHITECTURE.md` is stale (Sprint 3.6 — describes Babel-in-browser + localStorage, contradicted by the current Vite/FastAPI/Postgres stack) and was used as historical context only; dependencies are not installed, so **no tests were run**.

## Recommended architecture — Option D

Keep `user_snapshots` **unchanged** as the current-state projection. Add a relational, bitemporal, append-only semantic history with its own endpoints, idempotency keys and explicit supersession. Derive Delta, coverage, signals and summaries — never store them as fact.

- **Separate tables per concept.** `aa_targets` is physically apart from `aa_expectation_versions`, so «expectation used as desirability» is unrepresentable rather than merely discouraged. `aa_measurements` is apart from `aa_forecast_versions` — an actual is not a forecast version.
- **Provenance inline** (источник · основание · когда · как + `source_ref`) — it is rendered on nearly every row.
- **Signals derived, acknowledgements persisted**, keyed on `hash(subject, rule_id, rule_version, input_version_ids)` so corrections and genuine changes both re-surface correctly.
- **Reviews freeze *and* reference:** store the rendered context plus the input version IDs; render frozen by default, with a «данные позже исправлены» affordance when an input was later superseded.
- **Experiments:** lifecycle ⊥ outcome; `decision` nullable so `NULL` ≠ `'inconclusive'`; **per-day adherence rows** so future days are structurally never misses.
- **Migration is additive** — no change to `user_snapshots`, no `schema_version` bump, `Literal[2]` stays valid, old clients keep working. **No backfill:** history begins at deploy.
- **Scale:** ~35k rows/year, ~180k over five years. Ordinary Postgres. No partitioning, no event-sourcing framework.

## Owner decisions (5)

| ID | Question | Recommendation | Blocks |
| --- | --- | --- | --- |
| **D1** | Does hard deletion redact frozen review context? | **A** — erasure wins; keep the review, annotate «источник удалён» | Review schema (Slice 5), delete cascade (0b) |
| **D2** | Does «очистить историю старше» extend to AA history? | **C** — separate AA retention setting, unlimited by default | Retention (0b), data-quality copy |
| **D3** | What happens to the existing `activityLog` at cutover? | **A** — leave in place, do not import; AA history starts at deploy | Migration (Slice 8), first-run copy |
| **D4** | Is `ABANDONED` a real experiment lifecycle state? | **A** — add it (System Review would otherwise nag forever), but it extends accepted UX, so it is the owner's call | Experiment enum (Slice 6) |
| **D5** | Must AA fact recording survive going offline? | **A** — durable IndexedDB queue, deferred to Slice 2 (idempotency keys already make replay safe) | Slice 2 acceptance |

## Slices (do not execute)

`0` history foundation → `0b` **export & delete before history accumulates** → `1` shared semantics + primitives → `2` Finance pilot (retires the hardcoded budget) → `3` Signals + Home → `4` Review → `5` Project* → `6` Experiment → `7` Trade-off + System Review → `8` retention/migration hardening.

\* **G · Project has no domain to analyse.** No project entity exists; `goals` carry no dates or estimates. G needs either a minimal Project domain first, or a substitute second pilot (Habits is the natural candidate — dated events, no §21 sensitivity).

## Next action

Resolve **D1, D2, D3** and choose the G sequencing. Slices 0, 0b and 1 can be planned immediately without them.
