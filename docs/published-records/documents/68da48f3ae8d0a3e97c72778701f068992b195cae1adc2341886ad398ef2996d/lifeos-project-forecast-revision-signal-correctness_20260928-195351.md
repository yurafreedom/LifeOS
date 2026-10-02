# Discovery — `project.forecast.revision` v1 reads only the live forecast

Date: 2026-09-28 · Branch: `fix/project-forecast-revision-signal-history`
Start main: `48e38c2287f525d50c9d31a40a5934e406234f4b` (== `origin/main`, PR #13 merged)
Scope: one Slice 3 rule's input query. Not Slice 5.

## A. Real write path (verified)

`POST /api/v1/aa/forecasts` (`app/routes/aa_comparison.py::forecast`)
→ `_write("forecast", …)` → `append_semantic` → `append_version`
(`app/services/aa_comparison.py`).

Under a per-grain advisory lock (`user · aa_forecast_versions · metric_key · subject_key`)
`append_version` selects the prior `status == "active"` row of the same grain,
inserts the new row with `supersedes_id = prior.id`, then retires the prior:

```
prior.status          = "superseded"
prior.superseded_by_id = row.id
prior.superseded_at   = max(now, effective_from?)   # forecasts: now
prior.supersede_kind  = "REVISION"
```

`recorded_at = datetime.now(UTC)` is stamped by the service. So after N writes
exactly one forecast row per grain is `active`; N−1 are `superseded/REVISION`.

## B. Broken read path (verified)

`app/analytics/rules/project_forecast_revision.py::inputs` builds the grain
query (`user_id`, `subject_key`, `metric_key = project.completion_date`) and wraps
it in `apply_as_of(query, AAForecastVersion, as_of)`.

`app/analytics/asof.py::apply_as_of`:
- `as_of is None` → `status == ACTIVE` (current-truth predicate);
- `as_of = T` → `recorded_at <= T AND (superseded_at IS NULL OR superseded_at > T) AND status != TOMBSTONED`.

Both answer **"which version was live?"** — each returns at most one row of a
properly superseded chain. The rule needs **"which versions had LifeOS recorded?"**.
Consequences on the real path: `rendered_values.from = None`,
`revision_count = 1`, `input_version_ids = (newest,)`.

The retrospective path is broken the same way: at any `as_of` after the second
write, only the second version is live, so history again collapses to one row.

## C. `now` vs `as_of` (verified)

`evaluate_signals(now, as_of)` (`app/services/aa_signals.py`): `now` is the
observation instant (staleness, elapsed); `as_of` is the belief instant ("only
facts recorded by then are read"). Rules receive both. The history cutoff for
this rule is therefore `as_of` (belief), never `now`.

## D. Tombstones (verified)

`app/services/aa_deletion.py::delete_fact(mode="tombstone")` sets
`status = "tombstoned"`, `tombstoned_at`, and nulls value/provenance columns. A
tombstoned row keeps its place in the `supersedes_id` chain but is excluded
outright from every read (`known_as_of_predicate`, `_project_subject_ids`,
finance, coverage). Hard delete is refused for a row linked in a chain.

## E. Episode reconciliation (verified)

`evaluate_signals` looks up episodes by `episode_key`. For an existing
`ACKNOWLEDGED` episode whose `acknowledged_fingerprint` differs from the new
fingerprint it calls `rule.reopen_on(...)`; this rule returns `False`
unconditionally. `last_fingerprint` is updated, acknowledgement is kept,
`reopened_count` unchanged. Episode key = `project.forecast.revision:1:<subject_key>:fv=<newest id>`,
so the fix (which does not change the newest id) keeps every existing key.

## Why existing tests missed it

`tests/aa_signal_helpers.forecast()` inserts rows directly with
`status = ACTIVE` and never supersedes the prior. Several ACTIVE rows in one grain
is a state production cannot produce, and exactly the state under which
`status == ACTIVE` happens to return the whole history.

## Reproduction (before any production change)

New suite `apps/api/tests/test_aa_rules_project_forecast_history.py` writes
forecasts through `POST /api/v1/aa/forecasts` (clock pinned via the service's
own `datetime` where instants must be deterministic). On unfixed code:

```
8 failed, 1 passed
T1 test_a_revision_through_the_api_keeps_the_previous_forecast_in_the_signal
   AssertionError: assert None == '2026-08-24'      (rendered_values.from)
T2 … three revisions …                     assert None == '2026-08-24'
T3 … as_of=2026-08-17 (after both writes)  assert None == '2026-08-24'
   (as_of=2026-08-15 half passes: one version is the correct answer there)
T4 [oldest] / [middle] tombstone           assert None == '2026-08-24' / '2026-08-20'
T5 pre-fix acknowledged episode            fingerprint == narrow (newest-only)
T6 genuine new revision                    assert None == '2026-08-26'
T8 account isolation                       assert None == '2026-08-24'
T7 no-semantic-drift                       passes (independent of the defect)
```

`ROOT_CAUSE_CONFIRMED=YES`, `REGRESSION_REPRODUCED=YES`.

## Observations outside scope (recorded, not changed)

- If the **newest** forecast is tombstoned, no row of the grain is `active`, so
  `_project_subject_ids` (which uses `apply_as_of`) no longer discovers the
  project and the rule is not evaluated for it. The fix does not alter subject
  discovery; that behaviour is unchanged from main.
- `aa_signal_helpers.forecast()` stays as a low-level fixture; its existing
  users (`test_aa_rules_project_forecast.py`, `test_aa_signal_episodes.py`)
  remain valid under the corrected predicate because every row they write is
  non-tombstoned.

`DISCOVERY_STATUS=COMPLETE`
