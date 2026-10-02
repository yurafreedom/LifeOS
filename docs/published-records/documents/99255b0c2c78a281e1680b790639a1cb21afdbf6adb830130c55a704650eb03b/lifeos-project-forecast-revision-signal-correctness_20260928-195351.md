# Implementation — `project.forecast.revision` v1 history correctness

Date: 2026-09-28 · Branch: `fix/project-forecast-revision-signal-history`
Start main: `48e38c2287f525d50c9d31a40a5934e406234f4b` (== `origin/main`; PR #13 merged)
Discovery: `Outputs/Discoveries/lifeos-project-forecast-revision-signal-correctness_20260928-195351.md`
Plan: `Outputs/Plans/lifeos-project-forecast-revision-signal-correctness-plan_20260928-195351.md`

This is a Slice 3 correctness fix. It does not implement Slice 5.

## Reproduced failure

New suite `apps/api/tests/test_aa_rules_project_forecast_history.py`, run on
unfixed code (commit `9b47f67`): **8 failed, 1 passed**. Representative:

```
T1 POST forecast 2026-08-24, POST forecast 2026-08-26, GET /api/v1/aa/signals
   rows: #1 superseded / REVISION, #2 active            (assertions passed)
   card["rendered_values"]["from"]  →  AssertionError: assert None == '2026-08-24'
T5 fingerprint == sha256(newest id only), expected sha256(both ids)
```

The one pass was T7 (rule identity / semantics), which is independent of the defect.

## Root cause

`project_forecast_revision.inputs` wrapped its grain query in
`apply_as_of(query, AAForecastVersion, as_of)`. `apply_as_of` answers **"which
version was live?"**: `status == active` when `as_of` is absent, and
`recorded_at <= T AND not yet superseded at T AND not tombstoned` otherwise.
`POST /api/v1/aa/forecasts` → `append_semantic` → `append_version` supersedes each
prior forecast as `REVISION`, so a live-version read of a real chain returns one
row. The Slice 3 tests seeded several ACTIVE rows directly — a state production
cannot produce — which is why they passed.

`apply_as_of` is correct everywhere else it is used (subject discovery, finance
periods, current-truth aggregates): those ask about live values. Only a
version-history rule needs the superseded rows too.

## Change

`apps/api/app/analytics/rules/project_forecast_revision.py::inputs` only:

```
WHERE user_id = :user
  AND subject_key = :project_subject_key
  AND metric_key = 'project.completion_date'
  AND status != 'tombstoned'                    -- FactStatus.TOMBSTONED
  [AND recorded_at <= :as_of]                   -- only when as_of is given
ORDER BY recorded_at ASC, id ASC
```

No "not yet superseded at T" term. `evaluate`, `episode_key`, `reopen_on`,
materiality/state/stakes, `RULE_ID`, `RULE_VERSION`, `apply_as_of`,
`aa_signals.py`, schemas and routes are unchanged.

| Evaluation | History |
|---|---|
| current (`as_of` absent) | every non-tombstoned version ever recorded for the grain |
| retrospective (`as_of = T`) | every non-tombstoned version with `recorded_at <= T`, superseded or not |
| tombstoned version | excluded outright, now and retrospectively; its value never renders |

`now` stays the observation instant; the history cutoff is the belief instant
`as_of` only.

Resulting card: `from` = immediately previous surviving version (not the first
ever — first-vs-latest is Slice 5), `to` = newest, `revision_count` = surviving
versions known, `input_version_ids` = all of them, discriminator = `fv=<newest id>`.

## Compatibility

- **Episode key**: unchanged. The discriminator was and is the newest version id,
  so every persisted episode keeps its key.
- **RULE_VERSION stays 1**: the accepted rule is unchanged; only its input read was
  wrong. A bump would mint new keys and re-surface already-acknowledged
  occurrences.
- **Acknowledgement**: an episode acknowledged under the defective newest-only
  fingerprint now sees a wider fingerprint for the same key; `reopen_on` returns
  `False`, so it stays acknowledged, `reopened_count` unchanged, `last_fingerprint`
  updated (T5 proves this with a seeded pre-fix episode).
- **Genuine new revision**: new id → new key → new unacknowledged card; the prior
  episode is withdrawn with its acknowledgement preserved (T6).

## Test-helper decision

`tests/aa_signal_helpers.forecast()` is left unchanged as a low-level fixture; the
new suite does not use it. It writes through `POST /api/v1/aa/forecasts`. Where
instants must be deterministic (T2–T8), a fixture pins `aa_comparison.datetime.now`,
so `recorded_at`/`superseded_at` bookkeeping is still the production code's own.
No sleeps.

## Tests (T1–T8)

| | Proof |
|---|---|
| T1 | real API writes: #1 superseded/REVISION, #2 active; GET /signals: from 24 Aug, to 26 Aug, count 2, key = newest, full fingerprint |
| T2 | 20 → 24 → 26 Aug: from 24, to 26, count 3, fingerprint over all 3 |
| T3 | as_of between writes: from None, to 24, count 1, key = v1; as_of after both: count 2, key = v2 |
| T4 | tombstone oldest / middle (parametrised): count 2, correct from, fingerprint over survivors, erased value absent now and retrospectively |
| T5 | pre-fix acknowledged episode (newest-only fingerprint) not reopened |
| T6 | ack, then new forecast → new unacknowledged key; old withdrawn, ack kept |
| T7 | RULE_ID, RULE_VERSION = 1, 4 rules, MATERIAL / NORMAL / no stakes, no desirability keys |
| T8 | another account's forecasts on the same project id never enter the card |

## Validation

```
focused  pytest test_aa_rules_project_forecast_history.py
               test_aa_rules_project_forecast.py test_aa_signal_episodes.py   51 passed
apps/api python -m pytest        400 passed (391 + 9 new)
apps/api ruff check .            All checks passed
apps/api python -m compileall    ok
apps/api alembic heads           20260928_0006 (head)   (single head)
apps/api alembic current         20260928_0006 (head)   — lifeos_test
apps/web npm test                283 passed / 29 files
apps/web npm run typecheck       PASS
apps/web npm run lint            PASS
apps/web npm run build           PASS
repo     git diff --check        clean
```

No migration. Snapshot `schema_version` 2 and export `snapshot_schema_version` 2
unchanged. Rule count 4. Frontend production diff empty (no browser QA needed).
No dependency changes. No Slice 5 functionality.

## Out of scope, recorded

If the newest forecast of a project is tombstoned, no row of the grain is
active and `_project_subject_ids` (live-version discovery) no longer yields the
project, so the rule is not evaluated for it. Unchanged from main; not touched here.
