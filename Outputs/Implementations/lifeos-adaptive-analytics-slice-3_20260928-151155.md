# LifeOS — Adaptive Analytics Slice 3 · Signals + Home (A · B)

Implementation report · 2026-09-28

---

## 1. Start state

| | |
| --- | --- |
| Repository | `yurafreedom/LifeOS` |
| Checkout | `/Users/yurasachenko/LifeOS/LifeOS_DesignSystem` (single worktree) |
| Start branch | `main` |
| Start `HEAD` | `573456af2cc37e917beafc4cf7f798be7d0c74b6` |
| `origin/main` at start | `573456af2cc37e917beafc4cf7f798be7d0c74b6` — identical, no drift |
| Start commit subject | Merge PR #9 — Integrate Clarify panel for Quick Notes |
| Feature branch | `feat/adaptive-analytics-slice-3-signals` (ordinary branch, same checkout) |
| Worktrees | 1, unchanged |
| Recovery stash | `stash@{0}` (`slice2-pre-hero-preservation-20260928T044442Z`) untouched |
| Frozen design tag | `adaptive-analytics-design-accepted` untouched |

The handoff SHA was verified against live Git rather than trusted: branch, `HEAD`,
`origin/main`, porcelain status and worktree count were all checked before any
change, and `git fetch origin --prune` confirmed main had not advanced.

## 2. `outputs.zip` disposition

**`OUTPUTS_ZIP_STATUS=RESOLVED_ARCHIVE_MOVED`**

Inspected non-destructively before touching it:

```
-rw-r--r--  422K  Sep 28 11:29  outputs.zip
Zip archive data, at least v2.0 to extract, compression method=store
sha256  df08c73e59f3b6c7f34f989d7424aa275a8a5a81bc9975828d24fb55c6c2de73
```

Classification evidence:

- The archive contains `outputs/` (lowercase) with `plans/`, `audits/`,
  `discoveries/`, `summaries/`, `implementations/`, `backlog-tasks/`, plus
  `__MACOSX/` resource forks and a `.DS_Store` — a macOS Finder "Compress"
  export, not authored source.
- 72 real files. Every one was extracted and compared byte-for-byte against the
  tracked `Outputs/` tree: **all 72 identical, zero differences.**
- The name set is a strict subset of tracked `Outputs/`; the only tracked file
  absent from it is
  `Outputs/Implementations/lifeos-design-handoff-clarify-panel_20260928-120853.md`,
  which was written at 12:08, after the 11:29 archive.

So it is a redundant export of content the repository already holds under
version control. It was **preserved, not deleted**, and moved outside the Git
worktree:

```
/Users/yurasachenko/LifeOS/_archive/outputs_export_20260928-1129.zip
sha256  df08c73e59f3b6c7f34f989d7424aa275a8a5a81bc9975828d24fb55c6c2de73   (unchanged)
```

`/Users/yurasachenko/LifeOS/_archive/` did not previously exist; it was created
because no archive location existed and the file had to land somewhere outside
the worktree while being kept.

## 3. Documentation and design sources inspected

`AGENTS.md` · `CLAUDE.md` · `LIFEOS_MASTER_CONTEXT.md` ·
`Outputs/Plans/lifeos-adaptive-analytics-phase-b-implementation-plan_20260908-045036.md`
(§13 episode identity, §19 rule catalogue, §20 coverage contract, §21.2 endpoint
map, §22 migration graph + §22.1 downgrade policy, §24.5 Slice 3, §25 file
manifest) ·
`Outputs/Discoveries/lifeos-adaptive-analytics-targeted-technical-discovery_20260908-042647.md`
· the Slice 0 / 0b / 1 / 2 / P and Clarify implementation reports ·
`ui_kits/life-os-analytics/README.md`, `analytics.css`, `primitives.jsx`,
`screens.jsx` and `preview/aa-signal-card.html` as **read-only semantic
references**. No frozen file is imported at runtime, no demo chrome was copied,
and no seed state from the kit became runtime truth.

### One place the sources had to be reconciled

§19 rates a project forecast revision as materiality `material`, while the frozen
gallery renders «Прогноз сдвинулся» as the **base** card with no modifier class,
and gives `is-material is-stakes` to the finance threshold card. These are not in
conflict once read as two dimensions, which is how the design already treats
sign, desirability and severity:

- **materiality** is the ranking weight — §19 is authoritative;
- **state** is the visual family — the gallery is authoritative.

The implementation keeps both, separately, rather than picking one and
discarding the other. No threshold or vocabulary was invented to bridge them.

## 4. Baseline (recorded before any modification)

| Check | Result |
| --- | --- |
| `apps/api: python -m pytest` | **253 passed** |
| `apps/api: ruff check .` | All checks passed |
| `apps/api: alembic heads` | `20260910_0004 (head)` |
| `apps/api: alembic current` | `20260910_0004 (head)` |
| `apps/web: npm test` | **180 passed** (21 files) |
| `apps/web: npm run typecheck` | clean |
| `apps/web: npm run lint` | clean |
| `apps/web: npm run build` | built, 458.12 kB JS / 138.78 kB CSS |

Database: `lifeos_test` only
(`postgresql+psycopg://…@127.0.0.1:5432/lifeos_test`). `lifeos_dev` and any
shared or production database were never contacted; `conftest.py` independently
refuses any database whose name does not end in `_test`.

## 5. Migration M4

**`apps/api/alembic/versions/20260928_0005_aa_signal_episodes.py`**

```
revision      = "20260928_0005"
down_revision = "20260910_0004"
```

Naming follows the existing chain convention (`<authoring date>_<ordinal>_<slug>`),
matching `20260721_0001`, `20260909_0002`, `20260909_0003`, `20260910_0004`.

Additive only. No pre-AA table is altered — `users`, `sessions` and
`user_snapshots` are untouched, `user_snapshots.schema_version` stays `2`, and
`Literal[2]` in `app/schemas/state.py` remains valid, so existing clients are
unaffected. No Slice 0/0b/1 table is modified either.

**Downgrade policy (C8).** `downgrade()` drops the table and is written for
disposable and pre-write environments only. Once personal acknowledgement
history exists, the rollback path is the AA write gate and client behaviour —
never this downgrade. This is stated in the migration's own docstring so the
constraint travels with the file.

### `aa_signal_episodes` — exact schema

| Column | Type | Null | Note |
| --- | --- | --- | --- |
| `id` | `uuid` | no | primary key |
| `user_id` | `uuid` | no | FK `users.id` **ON DELETE CASCADE** |
| `created_at` | `timestamptz` | no | `now()`; storage fact only |
| `subject_domain` | `text` | no | |
| `subject_type` | `text` | no | |
| `subject_id` | `text` | no | default `''` |
| `subject_key` | `text` | no | generated, stored: `domain:type:id` |
| `episode_key` | `text` | no | rule-defined occurrence identity |
| `rule_id` | `text` | no | |
| `rule_version` | `integer` | no | |
| `first_seen_at` | `timestamptz` | no | |
| `last_evaluated_at` | `timestamptz` | no | monotonic |
| `last_fingerprint` | `text` | no | sha256 hex |
| `acknowledged_at` | `timestamptz` | yes | |
| `acknowledged_fingerprint` | `text` | yes | sha256 hex |
| `resolution` | `text` | yes | `acknowledged` \| `withdrawn` \| NULL |
| `reopened_at` | `timestamptz` | yes | see below |
| `reopened_count` | `integer` | no | default `0` |

Every column the accepted contract requires is present. Two columns go beyond it
(`reopened_at`, `reopened_count`), which the contract permits ("at minimum").
They exist because a withdrawn episode whose condition holds again is a *fresh
occurrence* under the **same** key, so its acknowledgement must be cleared —
without these two columns that clearing would silently destroy the only evidence
that the user ever dismissed that band, contradicting the requirement that
dismissal "remain auditable". They carry no rendered copy and no signal JSON.

Deliberately **absent**: value columns, the provenance grammar, and the
supersession chain. An episode is state, not an append-only fact; the facts a
signal reads already carry all three, and a second copy could diverge from them.
Rendered card content stays derivable from source facts plus rule evaluation.

**Constraints**

- `uq_aa_signal_episodes_episode_key` — `UNIQUE (user_id, episode_key)`
- `ck_…_resolution` — `resolution IS NULL OR resolution IN ('acknowledged','withdrawn')`
- `ck_…_acknowledged_pair` — `(acknowledged_at IS NULL) = (acknowledged_fingerprint IS NULL)`
- `ck_…_acknowledged_has_instant` — `resolution <> 'acknowledged' OR acknowledged_at IS NOT NULL`
- `ck_…_last_fingerprint` / `ck_…_acknowledged_fingerprint` — `~ '^[0-9a-f]{64}$'`
- `ck_…_episode_key_present` — `episode_key <> ''`
- `ck_…_evaluated_order` — `last_evaluated_at >= first_seen_at`
- `ck_…_rule_version` — `>= 1`
- `ck_…_reopened_count` — `>= 0`
- `ck_…_reopened_pair` — `(reopened_at IS NULL) = (reopened_count = 0)`

The sha256 shape is enforced in the database, not only in Python, so a direct SQL
write cannot substitute an opaque token for the fingerprint.

**Indexes**

- `ix_aa_signal_episodes_user_rule (user_id, rule_id)`
- `ix_aa_signal_episodes_user_subject (user_id, subject_key)`
- `ix_aa_signal_episodes_user_active (user_id, last_evaluated_at) WHERE resolution IS NULL`

Every index and constraint leads with `user_id`, so no query can resolve across
accounts.

## 6. Export, cleanup registry and account erasure

- `app/services/export.py` — `EXPORT_TABLES` gains `aa_signal_episodes`.
  `validate_export_registry()` already asserts *mapped AA tables == registry*,
  and `build_account_export` additionally asserts *registry == real AA tables in
  the database*. Both invariants hold; the existing export completeness tests
  stayed green without modification.
- `tests/conftest.py` — `aa_signal_episodes` added to `TRUNCATED_TABLES`. The
  pre-existing guard `test_every_mapped_table_is_either_cleaned_or_seeded`
  would have failed otherwise, which is exactly what it is for.
- Account erasure needed no code change: the `ON DELETE CASCADE` from `users`
  removes episodes with the account. Verified directly rather than assumed —
  `test_deleting_an_account_cascades_its_signal_episodes` deletes account A
  through `DELETE /api/v1/account` and asserts A's episodes are gone while B's
  survive.
- `test_all_analytics_tables_exist_with_a_cascade_from_users` (existing, Slice 0)
  now covers the new table automatically and passes.

## 7. Rule contract

`apps/api/app/analytics/rules/__init__.py` holds the shared contract and the
registry. Each rule is its own module; there is no conditional engine, because a
single `if rule_id == …` evaluator is how one rule quietly acquires another's
thresholds.

Every rule module exposes:

```
RULE_ID, RULE_VERSION
handles(subject)                        -> bool
inputs(db, *, user_id, subject, now, as_of)   -> exact fact rows / semantic inputs
evaluate(rule_inputs)                   -> Evaluation | None
episode_key(subject, evaluation)        -> str
reopen_on(episode, evaluation)          -> bool
```

`evaluate()` returning `None` is how a rule says "nothing holds". No rule ever
synthesizes a value so a card has content.

`Evaluation` carries `materiality`, `state`, `stakes`, `rendered_values`,
`input_version_ids`, `discriminator` and `provenance`. It refuses two things at
construction time:

- `state = RESOLVED` — resolved is episode state, never a rule verdict;
- any desirability key in `rendered_values` (`desire`, `desirability`,
  `desired_direction`, `favorable`, `unfavorable`).

`rendered_values` carries **values only** — numbers, dates, counts, codes. No
rendered copy crosses the API boundary, which is what keeps the Ukrainian locale
from being stranded.

## 8. The two identities, kept separate

**`episode_key`** — `<rule_id>:<version>:<subject_key>:<discriminator>`, composed
by `compose_episode_key()`. The shape is shared so keys stay greppable; the
**discriminator**, which decides what counts as one occurrence, belongs to the
rule. It drives acknowledgement, dedup and reappearance.

**`input_fingerprint`** — `sha256(sorted(input_version_ids))`, implemented as:

```python
joined = "\n".join(sorted(str(i) for i in input_version_ids))
hashlib.sha256(joined.encode("utf-8")).hexdigest()
```

Sorted, so it depends on *which* versions were read and not on query order.
Newline-joined, so two ids cannot concatenate into a third
(`("ab","c")` ≠ `("a","bc")` — asserted). It drives audit, reproducibility and
correction re-evaluation, and it may change while the episode does not.

Because AA rows are append-only with supersession, a row id *is* a version id: a
correction creates a new row with a new id, so the fingerprint moves while the
band — and therefore the episode — does not.

### Episode-key algorithms

| Rule | Discriminator | Worked example |
| --- | --- | --- |
| R1 | `band=<80\|100\|120>` | `finance.monthly_spend.threshold:1:finance:period:2026-08:band=80` |
| R2 | `fv=<newest_forecast_version_id>` | `project.forecast.revision:1:project:project:p1:fv=<uuid>` |
| R3 | `<source_kind>:since=<YYYY-MM-DD>` | `data.source.stale:1:finance:period:2026-08:IMPORTED:since=2026-08-17` |
| R4 | `window=<id>` or `window=<id>:tier=material` | `coverage.window.partial:1:finance:period:2026-08:window=2026-08` |

R3's `since` is the day the source **first** crossed the threshold, derived as
`newest_recorded_at + 7 days` in the subject's timezone. It is a property of the
data, not of today, which is precisely why tomorrow's evaluation computes the
same key and finds the same episode instead of firing again.

R4's info tier carries no tier suffix — matching §13.3(d)'s literal
`…:window=2026-08` — and only the worse tier appends `:tier=material`.

## 9. The four rules

### R1 · `finance.monthly_spend.threshold` v1

Reads the period through `monthly_spend_inputs()` in
`app/services/aa_finance.py`. That function was **extracted from** `derive_month`
rather than reimplemented, so the Finance surface and the signal cannot disagree
about the same number; a test asserts the card's `spend` equals the Finance
month's `actual`. Historical inclusion resolves through the versioned C7 policy
as of the evaluation instant, never from current snapshot category settings, and
the policy/override version that decided each inclusion is folded into the
fingerprint (a new optional `Membership.version_id` field carries it).

Reference: the active Expectation for the period, else the active Target. A
Target recorded as explicitly absent is not a reference — «цель не задавалась» is
a stated absence, not a number. Bands 80/100/120; only the highest crossed band
fires. No reference ⇒ no signal (there is nothing to cross, not "100 % of
nothing"). Any unknown membership ⇒ no signal, because a partly unknown aggregate
must not be compared as if it were complete. A reference in a currency the
derivation does not aggregate ⇒ no signal.

materiality `material`, state `material`, **`stakes = true`** — budget at or past
the user's own reference is accepted trigger #7 and the single warm case in the
design. Desirability is never touched.

### R2 · `project.forecast.revision` v1

Reads `AAForecastVersion` rows for the project subject, metric
`project.completion_date`. Any genuine new forecast version is a new episode,
keyed on the newest version's id. An ordinary Task/Project edit appends no
forecast version, so re-evaluation produces the identical key and identical
fingerprint — asserted. The fingerprint spans the *whole* forecast history, so a
correction anywhere in it is re-evaluated.

materiality `material` (§19), state `normal` (frozen gallery), `stakes = false`.
A forecast moving later is not «bad» and earlier is not «good»: that judgement
needs a Target or a Preference, which a rule may not invent.

### R3 · `data.source.stale` v1

`max(recorded_at)` per `source_kind` over the measurement rows in the subject's
fact scope. Thresholds: `> 7 days ⇒ info`, `> 14 days ⇒ material`. Both tiers
share one episode, because crossing from 7 to 14 days does not restart the
staleness period — only the weight changes. Fresh data moves
`newest_recorded_at`, the condition stops holding, the episode is withdrawn; a
later quiet spell computes a different `since` and is a different episode.

One card per subject, reporting the source that has been silent longest, rather
than one card per source kind. `input_version_ids` is the newest row alone: older
rows cannot end this staleness period, so including them would churn the
fingerprint for nothing.

No facts at all is **not** stale data — it is no data, which is coverage's
subject, not freshness's.

### R4 · `coverage.window.partial` v1

Reads `coverage_report_for_window()` over `aa_source_coverage`. Coverage is never
inferred from fact presence (C6) — a test seeds twenty days of transactions with
no claim and asserts no coverage card and an `unknown_coverage` zero state.

Denominator is **elapsed** days (`expected_denominator - future_count`), because
`future ≠ missing`: a period on its tenth day is not 32 % covered. Thresholds
`< 90 % ⇒ info`, `< 50 % ⇒ material`.

The rule fires only when coverage evidence actually exists. With no evidence at
all, the window's completeness is *unknown*, and reporting that as «0 % covered»
would read to the user as «you spent nothing» — §20's explicit warning. That case
is carried by the zero state instead.

`handles()` is limited to subjects with a calendar window (finance periods); a
project's lifetime carries no coverage denominator in this slice.

## 10. Correction re-evaluation

On each evaluation, `evaluate_signals()` reconciles produced keys against stored
episodes for the (rule, subject) pairs it actually re-evaluated — never more, so
an undiscovered subject cannot be spuriously withdrawn.

| Situation | Behaviour |
| --- | --- |
| **A.** Condition no longer holds | `resolution = 'withdrawn'`, card disappears. **Acknowledgement history is kept** — the card vanishing is not a reason to forget the dismissal. |
| **B.** Holds, same occurrence, fingerprint moved | `reopen_on()` consulted; all four rules return `False`, so the acknowledgement stands and `last_fingerprint` updates for audit. |
| **C.** Rule considers it a new occurrence | A different `episode_key` is emitted, so a fresh unacknowledged card appears while the earlier episode's record is retained. |
| **D.** A *withdrawn* episode's condition holds again | Same key, fresh occurrence: acknowledgement cleared, `first_seen_at` reset, `reopened_at`/`reopened_count` record the transition. This is §13.3(a)'s "band re-entered from below". |

Nothing is deleted in any branch.

## 11. API surface

Two endpoints — the smallest surface Slice 3 needs, matching §21.2. No
notification centre, no polling infrastructure, no alert history.

### `GET /api/v1/aa/signals`

`?limit=0..10` (default 3) · `?timezone=` · `?as_of=`

Returns `as_of`, `limit`, `signals[]` (active, ranked, bounded),
`acknowledged[]` (still-holding dismissed episodes, same bound),
`active_total`, `zero_state`, `coverage`, `persisted`.

`acknowledged[]` exists so the `resolved` state is renderable from real
evaluation data rather than from remembered client state; it is bounded by the
same limit and is not an all-history read.

**The write gate.** Evaluation records episode state, which is personal data, so
it is persisted only when `aa_write_enabled`. With the gate closed the same
signals are returned read-only, `persisted: false`, and nothing accumulates. The
gate keeps meaning what it meant in Slice 0b; it was not modified.

### `POST /api/v1/aa/signal-episodes/{episode_key}/ack`

Body: `resolution` (only `acknowledged` accepted), `input_fingerprint`
(sha256 hex, required), optional `idempotency_key`.

- Ownership comes from the session; an episode that is not this account's is
  simply **not found**. No identifier in the body is treated as authority.
- `require_json_content_type` and `require_aa_write_enabled` are **route
  dependencies**, so they run before body parsing — a `text/plain` body gets 415,
  not 422. `enforce_same_origin` runs in the handler. This matches the
  `aa_measurements` convention.
- `409 episode_changed` when the submitted fingerprint is not the episode's
  current one: the card on screen is then not the card being acknowledged, and
  accepting it would dismiss something the user never read.
- Replaying the same acknowledgement returns `200` with `replayed: true`.
  Idempotency is established by episode identity, so `idempotency_key` is
  accepted for queue compatibility but is not a second source of truth.
- `422 unsupported_resolution` for `withdrawn` — withdrawal is the rule observing
  its own condition, never a user action.

New stable error codes registered in `_ERROR_STATUS`: `episode_not_found` (404),
`episode_changed` (409), `unsupported_resolution` (422).

## 12. Ranking

`materiality` (material > info > normal), then `stakes`, then `first_seen_at`
descending, then `episode_key` ascending. Deterministic, and asserted to be.

There is no global numeric score, no cross-domain composite priority and no Life
Score. Two signals in different units are never added or normalised against each
other — ordering compares materiality and, failing that, recency and key.

## 13. Home integration

`apps/web/src/pages/HomePage.jsx` gains a `HomeSignals` section rendered
**between** `home-hero` (the first ordinary panel row) and `home-charts`. A test
asserts the document order `home-hero < home-signals < home-charts`, so the
position cannot silently drift.

- Quiet eyebrow «системные сигналы» (`.aa-eyebrow`, uppercased by CSS).
- At most 3 cards; the server bounds it and the client renders what it receives.
- No badge, no unread count, no "all signals" entry point — asserted absent.
- Hidden entirely in `emptyMode` (the demo empty-state) and when the analytics
  context is unavailable, so Home renders unchanged without it.
- Opening a card navigates to the existing surface for its domain (`finances`,
  `projects`). No new page was created.
- The rest of the dashboard was not reordered and its responsive layout is
  untouched.

`AnalyticsContext` gains `signals` state, `loadSignals()` and
`acknowledgeSignal()`. Acknowledgement deliberately does **not** go through the
durable offline write queue: a dismissal that cannot reach the server must fail
visibly, because the card staying put is the honest outcome.

## 14. The six visual states

`apps/web/src/components/analytics/AASignalCard.jsx` is new production code built
on the current AA primitives; the prototype was not copied.

Three dimensions stay independent, exactly as the frozen design requires:

```js
classes = ['aa-signal']
state !== 'normal'                         -> is-<state>
(stale|partial) && materiality !== normal  -> is-<materiality>
stakes && state !== 'resolved'             -> is-stakes
```

| Case | Class list | Source |
| --- | --- | --- |
| R1 finance threshold | `aa-signal is-material is-stakes` | frozen gallery, card 3 |
| R2 forecast revision | `aa-signal` | frozen gallery, card 1 |
| R3 stale, info tier | `aa-signal is-stale is-info` | gallery card 5 + §19 tier |
| R3 stale, material tier | `aa-signal is-stale is-material` | " |
| R4 partial, info tier | `aa-signal is-partial is-info` | gallery card 6 + §19 tier |
| R4 partial, material tier | `aa-signal is-partial is-material` | " |
| acknowledged | `aa-signal is-resolved` | gallery card 7 |

`is-normal` is not a class: the base card carries no modifier, as in the gallery.

Materiality is a stronger hairline and a dark dot, never warm fill. Warm appears
only through `is-stakes`, which only R1 sets, and an acknowledged card drops it
even when the underlying event was stakes. Sign never colours desirability.

**Visually verified in Chrome** against the real component output and the
production `styles.css` + `analytics.css` at 390 × 900 (light and dark) and
1440 × 900: all six states render as the frozen gallery shows them, the finance
card is the only warm one, no horizontal overflow at phone width, and dark theme
resolves correctly through the host tokens.

## 15. Zero-signal semantics

Zero active cards is a first-class state and a truthful one:

| `zero_state` | Meaning | Copy |
| --- | --- | --- |
| `confident` | Every evaluated window has coverage evidence and no unknown-coverage days | «Ничего существенного не менялось. Данные за период на месте.» |
| `unknown_coverage` | Something evaluated has unknown or absent coverage evidence | «Существенных изменений не видно, но полнота данных не подтверждена.» |
| `no_data` | Nothing to evaluate at all | «Пока нет данных, по которым можно судить.» |

A subject with no coverage denominator at all (a project) cannot produce
`confident` — asserted. Reassurance the evidence cannot support would be a
comfortable lie, so the gate for `confident` is evidence, not emptiness.

## 16. Provenance

Signals reuse the existing `AAProvenance` component — no second provenance
component was created — and keep the accepted four-row grammar behind the 9px
«источник» chip, so nothing clutters the card permanently.

| Rule | источник | основание | когда | как |
| --- | --- | --- | --- | --- |
| R1 | source mix (`IMPORTED · USER_REPORTED`) | operation count | newest import time | «SUM of N active included transaction fact(s) minus corrections» |
| R2 | `DERIVED` (выведено Life OS) | forecast version count | newest recording time | derivation |
| R3 | source kind | fact count | newest record time | `max(recorded_at)` per source kind |
| R4 | claim source | observed / denominator | evaluation time | explicit source coverage evidence over elapsed local days |

## 17. Localization

All new user-facing copy exists in **both** `ru` and `uk` — 35 keys each,
asserted key-by-key by a test that fails if any `aa_sig_*` key is missing from
`uk`. English is not enabled; `LifeStrings` is asserted to contain exactly
`['ru', 'uk']`.

No frozen Russian prototype copy is hardcoded in production: the API sends values
and the card composes every sentence from locale keys. A test renders the whole
card in Ukrainian and asserts no Russian leaks through.

One design correction came out of that test: `AASignalCard` originally took `t`
and `locale` as two props, which let a caller pass a Russian `t` alongside
`locale="uk"` and render a half-translated card. The component now reads
`LifeLocaleContext` itself, so there is one source of locale.

## 18. Accessibility and responsive

- Cards are `<article>` with `aria-label`; the section is `<section
  aria-labelledby>` with an `<h2>` eyebrow and card `<h3>` titles.
- Open and dismiss are real `<button type="button">` elements — keyboard
  reachable and screen-reader named. `AAProvenance` remains a native
  `<details>`/`<summary>` disclosure.
- Not colour-only: materiality is named in a visually-hidden `.aa-sr-only` span,
  and stale/partial/resolved additionally carry visible text tags.
- `.aa-link:focus-visible` gets a visible outline.
- `@media (prefers-reduced-motion: reduce)` disables the card transition and
  hover lift.
- `@media (max-width: 700px)` tightens padding; verified at 390px with no
  horizontal scroll.
- No preview-only phone/stage/device CSS was imported — the existing T-16 chrome
  guard scans all of `src/` and passes.

## 19. Tests

**Backend — 71 new tests across 6 files** (253 → 324).

| File | Covers |
| --- | --- |
| `tests/test_aa_rules_finance_threshold.py` (13) | bands; no-reference; unknown membership; **T-11a** ack survives 90→91→92→93 %; **T-11b** 100 % is a new episode; **T-11c** correction withdraws; re-entry after withdrawal is a fresh occurrence; fingerprint contract; provenance |
| `tests/test_aa_rules_project_forecast.py` (5) | no forecast ⇒ no signal; revision ⇒ new episode; **ordinary edit ⇒ no new signal**; fingerprint spans history |
| `tests/test_aa_rules_data_stale.py` (7+1 param) | fresh ⇒ silent; >7 info / >14 material; repeated stale days ⇒ one episode; dismissal holds; fresh import withdraws; later period ⇒ new episode; quietest source wins |
| `tests/test_aa_rules_coverage_partial.py` (8) | full coverage silent; **facts alone never prove coverage**; <90 info; <50 material + distinct episode; no daily respawn; worse tier reappears; unvouched claim ≠ evidence; affirmed-none ≠ unknown |
| `tests/test_aa_signal_episodes.py` (37) | catalogue is exactly 4; **T-06** no rule reaches desirability; `resolved` rejected as a verdict; all six states from real data; Home ≤ 3 ranked; three zero states; dismissal survives reload; gate closed ⇒ no writes; both identities stored separately; retrospective evaluation is monotonic; 5 schema guards; account isolation; 9 HTTP tests; export; cascade; no fact writes; Finance agreement; M4 roundtrip; snapshot contract untouched |
| `tests/aa_signal_helpers.py` | shared seeding (rows written directly so `recorded_at` is controllable) |

**Frontend — 34 new tests across 2 files** (180 → 214).

`src/test/analytics-signals.test.jsx` — class composition for all six states,
warm accent only on stakes, screen-reader naming, provenance reuse, keyboard
buttons, copy composed from values, no desirability anywhere, ru/uk parity,
stylesheet contents and absence of demo chrome, and eight Home integration tests
(position, ceiling, zero states, absent provider, empty mode, project titles).

`src/test/analytics-signals.test.ts` — repository boundary: bounded limit, input
rejection before the network, fingerprint sent with the acknowledgement,
same-origin JSON.

**Existing regressions** — all 253 backend and 180 frontend baseline tests still
pass. Snapshot sync, the AA write queue, Finance Slice 2, Project Slice P and
Clarify are unaffected.

### Three defects the tests caught during implementation

1. `last_evaluated_at` could be moved backwards by a retrospective (`as_of`)
   read, violating `last_evaluated_at >= first_seen_at`. It is now monotonic.
2. `require_json_content_type` ran inside the handler, after FastAPI had already
   parsed the body, so a wrong content type produced 422 instead of 415. Moved to
   a route dependency.
3. `days_remaining` was measured from the belief instant rather than the
   observation instant. `now` and `as_of` are now separate throughout
   `evaluate_signals`, which is also the honest distinction: `now` is what
   "stale" and "elapsed" measure against, `as_of` is what was known.

## 20. Validation (after implementation)

| Check | Result |
| --- | --- |
| `apps/api: python -m pytest` | **324 passed**, 10 warnings |
| `apps/api: ruff check .` | All checks passed |
| `apps/api: alembic heads` | `20260928_0005 (head)` |
| `apps/api: alembic current` | `20260928_0005 (head)` |
| `apps/web: npm test` | **214 passed** (23 files) |
| `apps/web: npm run typecheck` | clean |
| `apps/web: npm run lint` | clean |
| `apps/web: npm run build` | built, 469.99 kB JS / 142.37 kB CSS |
| `repo root: git diff --check` | clean |

Migration exercised against `lifeos_test` only: `upgrade head`, full suite,
plus an in-test `downgrade 20260910_0004` / `upgrade head` roundtrip asserting
every earlier table's columns are byte-identical afterwards.

## 21. Changed files

**New (19)**

```
apps/api/alembic/versions/20260928_0005_aa_signal_episodes.py
apps/api/app/analytics/rules/__init__.py
apps/api/app/analytics/rules/finance_threshold.py
apps/api/app/analytics/rules/project_forecast_revision.py
apps/api/app/analytics/rules/data_stale.py
apps/api/app/analytics/rules/coverage_partial.py
apps/api/app/models/aa_signal_episode.py
apps/api/app/schemas/aa_signals.py
apps/api/app/services/aa_signals.py
apps/api/app/routes/aa_signals.py
apps/api/tests/aa_signal_helpers.py
apps/api/tests/test_aa_signal_episodes.py
apps/api/tests/test_aa_rules_finance_threshold.py
apps/api/tests/test_aa_rules_project_forecast.py
apps/api/tests/test_aa_rules_data_stale.py
apps/api/tests/test_aa_rules_coverage_partial.py
apps/web/src/components/analytics/AASignalCard.jsx
apps/web/src/test/analytics-signals.test.jsx
apps/web/src/test/analytics-signals.test.ts
```

**Modified (16)**

```
apps/api/app/analytics/enums.py            signal enums (derived; only SignalResolution is persisted)
apps/api/app/main.py                       register aa_signals router
apps/api/app/models/__init__.py            register AASignalEpisode
apps/api/app/routes/aa_measurements.py     three new stable error codes
apps/api/app/services/aa_finance.py        extract monthly_spend_inputs (behaviour-preserving)
apps/api/app/services/aa_metric_policy.py  optional Membership.version_id for the fingerprint
apps/api/app/services/export.py            export registry
apps/api/tests/conftest.py                 TRUNCATE registry
apps/api/tests/test_aa_semantic.py         M3 asserts its chain position, not that it is head
apps/api/tests/test_export.py              manifest revision bumped to 20260928_0005
apps/web/src/analytics.css                 signal card + section styles ported from the frozen kit
apps/web/src/api/analytics.ts              signal types, getSignals, acknowledgeSignalEpisode
apps/web/src/repositories/analyticsRepository.ts  readSignals, acknowledgeSignal
apps/web/src/context/AnalyticsContext.jsx  signals state, loadSignals, acknowledgeSignal
apps/web/src/context/LocaleContext.jsx     35 ru + 35 uk keys
apps/web/src/pages/HomePage.jsx            signals section below the first panel row
```

`tests/test_aa_semantic.py` needed a semantic change rather than a bumped
constant: it asserted "M3 is head", which is now permanently false. Bumping it
would have made the *M3* test assert something about M4, so it now asserts M3's
position in the chain (`down_revision == 20260909_0003`) and still exercises the
same downgrade. The two `manifest["alembic_revision"]` assertions were bumped, as
each slice does.

## 22. Dependencies

**None added, none upgraded, no lockfile touched.** `apps/web/package.json`,
`package-lock.json` and the API requirements are unmodified. `npm audit fix` was
not run.

## 23. Explicit non-scope — confirmed not implemented

Slice 4 Review/Debrief · Slice 5 Project Analytics · Slice 6 Experiment ·
Slice 7 Trade-off/System Review · Slice 8 Retention · reviews created from signal
cards · notification centre · notification daemon/push/email · rules beyond the
canonical four · ML or recommendation scoring · Life Score · Waiting lifecycle ·
Reference management expansion · dependency upgrades · deployment · AA production
gate changes.

Clarify is untouched apart from regression coverage. `snapshot_version` stays 2
and `SERVER_SCHEMA_VERSION` stays 2.

## 24. Known limitations

1. **Subject discovery is bounded to 13 months** (`DISCOVERY_MONTHS`) and to
   periods that have begun. A correction to a finance period older than that
   horizon will not re-evaluate its episodes. This is deliberate — signals speak
   about the present and an unbounded scan would be both slow and beside the
   point — but it is a real boundary, not an accident.
2. **Evaluation is synchronous on read.** `GET /signals` evaluates all four rules
   over all discovered subjects. At current data volumes this is fine; at large
   history it would want caching or a background pass. No index is missing, but
   nothing memoizes across requests.
3. **R3 has no dedicated per-source subject.** Freshness is reported per subject
   (the quietest source wins) rather than one card per source kind. That matches
   the design's single «финансы · август» stale card and keeps Home quiet, but a
   user with two stale sources sees only the quieter one named.
4. **R4 only evaluates subjects with a calendar window.** Projects contribute
   `unknown_coverage` to the zero state but never a coverage card, because a
   project lifetime has no accepted denominator in this slice.
5. **Acknowledgement is not offline-durable.** It is a direct call, not a queued
   write; offline, the dismissal fails and the card stays. That is the honest
   behaviour, but it is a behavioural difference from the Slice 2 fact path.
6. **`reopened_at` / `reopened_count` go beyond the literal accepted contract.**
   Justified in §5 above; if the owner prefers the minimal shape, removing them
   means accepting that reopening silently erases the record of a prior
   dismissal.

## 25. Verdict

**PASS.**

All Slice 3 acceptance gates in plan §24.5 are satisfied and covered by durable
tests: six states from real data, a truthful coverage-aware zero state, dismissal
surviving reload, an ordinary transaction inside a band not creating a new
signal, genuine new episodes reappearing, corrections re-evaluating and
withdrawing, materiality never setting desirability, and Home showing at most
three ranked by materiality.

The frozen invariants hold: Expectation ≠ Target, Actual ≠ Forecast, Prediction ≠
Preference, direction ≠ desirability ≠ materiality, missing ≠ zero, future ≠
missing, correction ≠ new event. No Life Score, no cross-unit score, no
notification centre, and no semantics invented where the plan was silent.
