# LifeOS Adaptive Analytics — Slice 8 · Owner-confirmables memo

Generated: 2026-09-29 · pinned `414df142700653d616016ff644bff3d9c0007540` · PROVISIONAL
No owner approval is claimed or implied by this memo.

## Already settled by existing owner authority (not asked again)

Default UNLIMITED (D2) · AA separate from activityLog (D2/D3) · hard erasure wins over frozen Review (D1) ·
no silent deletion (§42, plan §24.11) · preserve user-authored entities by default.

## O1 — What does a finite policy delete?

**Recommendation (conservative):** prune only eligible observational / windowed / versioned history under
whole-chain / whole-window / whole-Project-unit rules. **Never** age-prune user-authored Reviews, revisions, factors,
decisions, Experiments (+ adherence/observations as proposed), importance ratings, cross-references without an explicit
future owner change. Open or Actual-less Projects are never pruned.
Status: recommendation derivable from D2 + preservation principle; owner may confirm or widen.

## O2 — Are source-derived frozen Review values redacted when retention prunes their source?

**Recommendation: yes.** D1 already says hard erasure wins; retention is a user-chosen hard erasure. User note, factors
and decision survive; the item shows «источник удалён» (optionally with a retention-specific reason, P-D2).
Tombstone is not a substitute (Slice 4 tombstone keeps frozen values). If rejected, the Plan must add a
"pinned by Review" eligibility predicate — design change, not a blocker.
Status: follows from D1; owner may confirm.

## O3 — Allowed finite durations — **OPEN**

Old Discovery suggested e.g. 2 / 3 / 5 years with minimum 24 months (> `DISCOVERY_MONTHS`=13 and one year-over-year
comparison). **This is not an accepted owner decision.** No default finite duration will be preselected (D2).
Needed: the list of durations (or min/max) the UI offers.

## O4 — Receipt / audit granularity — **OPEN**

- (a) per-fact `aa_deletion_receipts` rows (uniform with §11.4 hard delete; ~180k rows at scale; `fact_id NOT NULL` fits).
- (b) **recommended:** run-level retention audit (horizon, timezone, per-table counts, run id, timestamps) in a new
  never-pruned table; no per-fact receipt for retention.
This changes the audit representation promised in plan §24.11 ("Deleted history writes deletion receipts"), so it
needs owner confirmation. It also decides whether the horizon lives on the policy row or in a run log.
