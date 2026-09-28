# Plan — `project.forecast.revision` v1 history correctness

Discovery: `Outputs/Discoveries/lifeos-project-forecast-revision-signal-correctness_20260928-195351.md`

## Change

One production file: `apps/api/app/analytics/rules/project_forecast_revision.py`.

Replace `apply_as_of(query, AAForecastVersion, as_of)` in `inputs()` with an
explicit version-history predicate:

```
grain:        user_id AND subject_key AND metric_key = project.completion_date
always:       status != FactStatus.TOMBSTONED
as_of given:  recorded_at <= as_of
order:        recorded_at ASC, id ASC
```

No "not yet superseded at T" condition — that is the live-version question and
would collapse the history back to one row.

Untouched: `evaluate`, `episode_key`, `reopen_on`, `RULE_ID`, `RULE_VERSION`,
materiality/state/stakes, `apply_as_of`/`known_as_of_predicate` (correct for
live-version reads elsewhere), `aa_signals.py`, API schema/URLs, migrations,
frontend.

## Tests

New `tests/test_aa_rules_project_forecast_history.py` (T1–T8), written through the
real write path; pinned service clock where instants must be deterministic.
`aa_signal_helpers.forecast()` stays unchanged as a documented low-level fixture.

## Commits

1. tests — failing production-path regression + temporal/ack compatibility
2. fix — rule input-history predicate
3. docs — Discovery, Plan, Implementation report, master-context note

## Gate

```
PLAN_STATUS=COMPLETE
OWNER_DECISION_REQUIRED=NO
IMPLEMENTATION_READY=YES
EXPECTED_MIGRATION=NO
EXPECTED_RULE_VERSION=1
EXPECTED_RULE_COUNT=4
```
