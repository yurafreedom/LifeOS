# Adaptive Analytics — layer design (pass 1)

Interactive click-through: **`index.html`** (rail: surface · Home scenario · desktop/mobile).
Theme split as approved — **Home renders in `paradise`, every analytical surface in `light`**. Copy is Russian, as the product ships.

## What this pass covers

| Brief output | Where |
| --- | --- |
| A · Home — no / one / three signals, desktop + mobile | rail → *A · Дом* + сценарий дома |
| B · Signal Card — 6 semantic states | rail → *B · Signal Card* · card `preview/aa-signal-card.html` |
| C · Expected vs Actual / Delta — 7 variants | rail → *C · Ожидалось / факт* · card `preview/aa-delta.html` |
| D · Metric history — finance (chart, layers, provenance, data quality) and project (forecast versions) | rail → *D · История показателя* / *История прогноза* |
| E · Review / Debrief — 5 optional steps, desktop + mobile | rail → *E · Ревью* |
| H · Subjective + objective side by side | bottom of any metric surface |

**Pass 2 (this batch): F · Finance domain, G · Project domain, mobile provenance sheet.** Both domain pages are in `domains.jsx` and reachable from the rail (*F · Финансы (домен)* / *G · Проект (домен)*) or by opening a Home signal.

**Pass 3: I · Experiment** (`experiment.jsx`, rail → *I · Эксперимент (future)*) — designed as a future capability, deliberately built from nothing new:

| Experiment concept | Primitive it reuses |
| --- | --- |
| Hypothesis | dashed claim block labelled «предположение, не факт» — never rendered as a value |
| Baseline / intervention / window | one `AADelta` row, three semantically separate cells |
| Adherence | day cells over the whole window — **kept** (соблюдено) / **missed** (прошло без соблюдения) / **future** (ещё не наступило, dashed-light) — driven by stored `kept`/`elapsed`/`total`, plus `AAQualityStrip`. Partial adherence is a state, not bad data; days that haven't happened are never drawn as misses |
| Changed conditions | quality-strip detail with `наблюдение` tags; «изменений не зафиксировано» ≠ «их не было» |
| Observations | `aa-mini` rows, each with its own provenance, labelled «измерения, не выводы» |
| Result | `AADelta` (baseline vs period) + an explicit note that a difference is not proof of cause |
| Contributing factors | the Review factor rows + `AAFactorTag`, «неизвестно» included by default |
| Decision | the Review choice list, with «Непонятно — данных недостаточно» as a first-class outcome |
| History | `AAHistoryList` — start, baseline capture, missed days, condition changes, period end |

Running experiments show interim values but no result: «рано судить · период не закончен». Nothing is recommended by the system, nothing is scored, and the decision can be left unmade.

**Pass 4: J · Trade-off + System Review** (`system.jsx`, rail → *J · Компромиссы (future)* / *J · Обзор системы (future)*) — later-phase exploration, both labelled as such on screen.

**Core rule: juxtaposition, not optimization.** How each principle is expressed:

| Principle | How the design holds it |
| --- | --- |
| No Life Score | A standing banner: «Общего балла нет и не будет» — and there is no place in the layout where one could go |
| Gains and costs stay individually visible | One card per change (часы, задачи, сон, энергия, ₴), each with its own value, unit and coverage |
| Unlike units never combined | Each card names its unit («часы · к июлю», «субъективно · шкала»); nothing sums across cards |
| Correlation ≠ causality | The contradiction block shows +24% задач beside −11% сна with «совпадение по дням есть, причинная связь не проверялась» |
| User supplies importance | Per-change menu: не решил / для меня важно / приемлемо / не считаю значимым — default is «не решил» |
| «No conclusion» is valid | A free-text «что это значит для меня» plus an explicit «Вывода нет — оставить как наблюдение» toggle |
| Contradictions coexist | Kept as a first-class block, not resolved |
| Partial coverage visible | «частичные данные» tag + «покрытие: частичное · 19 из 28 дней» on the card face |
| Provenance inspectable | Every change card carries the standard chip → popover / mobile sheet |
| «Что улучшилось» is grounded, never inferred | Qualifying grounds are exactly three: an explicit **Target**, a user **Preference/ориентир**, or a user **Decision** naming a desired direction — and the grounding is printed under the item. **An Expectation does not qualify**: it predicts what will happen, it does not declare what should. So «расходы −₴800 к ожиданию» sits in «Что менялось» (цель на месяц не задавалась), while «правило сна соблюдалось 9 из 14 дней» qualifies («по вашему ориентиру: не работать после 00:30»). Direction alone never qualifies. The group's note states the rule on screen |
| Review synthesizes, never judges | System Review = что менялось / что улучшилось / что повторилось / противоречия / ждёт вас / качество данных, each item provenance-tagged, under «Это не вердикт» |
| Adjustments are user-owned | «Что я решаю поменять» is an opt-in checklist; «Ничего не выбрано — это нормальный итог» |

System Review also states its own boundaries: it replaces neither Home (1–3 signals now) nor the GTD weekly review (what to do next); the overlap is left open per §36.

### Visual reuse vs semantic ownership

These are tracked separately, deliberately:

- `AADelta` **owns the difference semantic**. Its cells are operands of one comparison plus that comparison's result; only it accepts `delta` / `desire`.
- `AAFacts` **shares AADelta's grid layout and cell typography and nothing else.** It renders unrelated stored facts side by side — baseline / intervention / period on the Experiment surface, and any future "three facts in a row" case. It accepts no `delta` and no `desire`, so a fact row can never be misread as a computed difference.
- Both share `.aa-delta-cell`, `.aa-delta-lab`, `.aa-delta-val`, `.aa-delta-sub` (CSS-level reuse) and both collapse to one column under `.aa-narrow`.

Rule for implementers: **layout reuse is free, semantic reuse is not.** If a row is not "X versus Y, difference Z", it is `AAFacts`.

Nothing is deferred after this batch. The trade-off *primitive* already exists (review step 4), so J is a composition exercise rather than new UX.

### What F/G prove

Neither domain has its own analytics components. Finance and Project both render the same six primitives — `AADelta`, `AASignalCard` (inline variant), `AAHistoryList`, `AAQualityStrip`, `AAProvenance`, and the review entry — over different value *types*:

| Concept | Finance | Project |
| --- | --- | --- |
| Actual | ₴61,200 (28 из 31 дня) | 25 авг · наблюдение системы |
| Baseline / typical | ₴54,300 за месяц | +3 дня к оценке (6 прошлых проектов) |
| Expectation | ₴62,000 · three stored versions | 20 авг · первая оценка (записана 12 авг) |
| Target | не задавалась (explicit, not zero) | — |
| Forecast | ₴67,800 · dashed grey, estimate style | 26 авг · последняя из 3 версий (записана 20 авг) |
| Delta | −₴800 к ожиданию — **neutral**: there is no target, and an expectation is predictive, not normative | +5 дней к первой оценке · −1 день к последнему прогнозу (both **neutral**) |
| Signal | `AASignalCard variant="inline"`, warm only because budget ≥80% is trigger #7 | none on the page — nothing material is open |
| History | expectation versions, collapsed by default | 5 semantic events, always visible |
| Provenance | chip → popover / sheet | chip on the delta header |
| Review | «открыть ревью месяца» (ghost — optional) | «открыть ревью» (primary — project closed) |

Project deliberately shows **two deltas side by side** — +5 дней to the first estimate, −1 день to the last forecast (it finished a day early against the final version) — because collapsing them would hide how the model changed, and because one number would have to pick a sign — the same reason Finance keeps all three expectation versions.

Counts never mix concepts: «версий прогноза» is 3 (the observed completion is a fact, listed separately with the «наблюдение» tag), derived from `forecasts.filter(f => !f.actual)` rather than the array length.

### Expectation is predictive, not normative

`desire` is populated **only** from an explicit Target, a user Preference/ориентир, or a user Decision that names a desired direction. Being under or over an *expectation* is not desirability — the current Finance seed has «цель на месяц не задавалась», so −₴800 renders **neutral** in C, F and the metric surface alike. Project deltas are neutral for the same reason.

If an expectation is also *wanted*, model that normative meaning separately (a Target, or a stored preference) rather than deriving it from the expectation.

Materiality is a **third, independent** dimension: the Finance signal stays warm because budget ≥80% is stakes trigger #7 — that says "look at this", not "this is good or bad".

### Mobile provenance

`AAProvenance` takes `narrow`: desktop renders the 260px popover, mobile renders a bottom sheet (scrim + grip + the same four rows) and ends with «Полная история — на экране показателя» instead of duplicating the analytical detail.

## Decisions this design makes

1. **Signals sit below the first ordinary panel row on Home** (owner decision) under a quiet `СИСТЕМНЫЕ СИГНАЛЫ` eyebrow — everyday state reads first; analytics is a secondary observational layer. Max 0–3 signals; zero signals is a first-class, reassuring state.
2. **Analytics never borrows stakes orange.** A material signal is a stronger hairline + dark dot. Warm appears only when the underlying event is itself one of the eight triggers (`signal.stakes`, e.g. budget ≥ 80%) — the finance signal is the single warm card in the demo.
3. **Sign, desirability and severity are separate.** «+» and «−» are neutral by default; `data-desire` only nudges tone (favorable = quiet green, unknown = grey «рано судить», unfavorable stays neutral with the sub-line carrying the meaning).
4. **Five concepts stay distinct** — факт / типично / ожидалось / цель / прогноз — by label, position and line style: solid blue actual · dotted grey baseline · long-dashed grey expectation steps · short-dashed grey forecast tail with a hollow end point. No color encodes analytics.
5. **History is versioned, not overwritten.** Expectation changes render as stepped dashed segments with their own dates; the semantic history list shows corrections as original value → corrected value. Nothing silently disappears.
6. **Provenance is progressive.** A 9px «источник» chip opens a popover with источник / основание / когда / как. No permanent provenance labels in the layout.
7. **Missing is never zero.** Uncovered days are simply absent from the line, with an explicit note; partial actuals render dashed and underlined.
8. **Review is optional at every step** — «пропустить» is always the left-hand button, «неизвестно» is a valid factor tag *and* a valid final state, no aggregate score exists, and no step is required in order to save.
9. **Data quality is contextual**: a one-line strip under the chart (покрытие · исправлений · оценочных · причина) that expands in place. No global banner, no tab.
10. **Factor tags use an explicit menu** (наблюдение / моя трактовка / возможный фактор / неизвестно / убрать фактор) — discoverable and keyboard/screen-reader friendly, not click-to-cycle.

## Pattern inventory

| Pattern | Purpose | Anatomy | States | Interaction | Responsive | Reused in | New? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `AASignalCard` (`.aa-signal`) | Surface one meaningful change without an alert center | domain eyebrow + dot · title · from→to + magnitude · body · footer (freshness, provenance, actions) | normal · material · info · stale · partial · resolved | open context · dismiss (moves to resolved) | stacks; footer wraps | Home, future System Review | **New**, built on the kit's card + tag classes |
| `AADelta` (`.aa-delta`) | Universal expected/actual/delta comparison | 3 cells: label · value · sub-line | favorable · unfavorable · neutral · unknown · estimate · empty | cells are the entry point into history | 3 columns → 1 column under `.aa-narrow` | Metric detail, Review step 1 | **New** universal primitive (replaces per-domain stat rows) |
| `AAProvenance` (`.aa-prov`) | Answer «откуда это значение» | chip → popover with 4 rows | closed · open | click toggles | popover becomes a sheet on mobile (pass 2) | everywhere a derived number appears | **New** |
| `AAChart` + `AAChartLayers` | Layered value history | axis · actual line · baseline · expectation versions · forecast tail · event markers | layers on/off · narrow | toggle layers; labels drop out when narrow | reduced viewBox | Metric detail | **New** (kit charts were finance-specific) |
| `AAHistoryList` (`.aa-hist`) | Semantic event history | when · what · provenance tag | — | rows will link to the event | 3 columns → stacked | Metric detail, Review confirmation | **New** |
| Factor row (`.aa-factor`) + `AAFactorTag` | Contributing factors with an epistemic tag | text · tag ▾ menu | observed · mine · maybe · unknown | menu: pick kind or remove | full width | Review step 3, future Diagnosis | **New** |
| `AAQualityStrip` (`.aa-quality`) | Qualify a metric in one line | items · «подробнее» | collapsed · expanded | expands in place | wraps | under every history chart | **New** |
| Trade-off row (`.aa-tradeoff`) | Show cost side by side, no composite score | label · mono value | — | — | full width | Review step 4, future Trade-off view | **New** |
| Choice list (`.aa-choice-btn`) | Pick an adjustment, or none | single-select sentence rows | default · selected | click | full width | Review step 5, future Experiment decision | Could reuse `SegmentedControl`; kept as a list because options are sentences |
| From the kit, unchanged | — | `.card.panel`, `.task-row`, `.money-budget`, `.habits-cell`, tags, button styles mirroring `.qa-btn-save` / `.set-btn-ghost` | — | — | — | Home | Reused |

## Flow map

```
Home (paradise)
  └─ Signal card → «посмотреть контекст»
       ├─ finance signal  → Metric history (light) ─┐
       ├─ project signal  → Forecast history (light)─┤→ «открыть ревью» → Review
       └─ review signal   → Review ──────────────────┘

Review · 5 optional steps
  1 ожидалось / факт / разница   (read-only delta)
  2 что изменилось               (free text, skippable)
  3 что могло повлиять           (n factors: наблюдение / моя трактовка / возможный фактор / неизвестно)
  4 чего это стоило              (trade-off rows, no score)
  5 что дальше                   (оставить / скорректировать / позже / без решения)
  → saved → written into the entity's semantic history

Exit at any point: «выйти» / «пропустить». Nothing is required.
```

A future Experiment maps onto the same primitives with no new UX: baseline = delta cell, run = history chart with an intervention event marker, result = delta, decision = choice list.

## Owner decisions applied (pass 1.1)

1. Signals moved below the first Home panel row. ✔
2. Data quality → contextual expandable strip, not a tab. ✔
3. Factor tags → explicit menu with remove. ✔
4. Forecast and expectation → neutral grey; warm only for genuine stakes events; «+»/«−» neutral by default. ✔

## Files

`analytics.css` · `data.js` (seed facts) · `primitives.jsx` (Provenance, SignalCard, Delta, Chart, HistoryList) · `screens.jsx` (Home, Metric, Review, state galleries) · `app.jsx` (shell + rail) · `index.html`.

## Preview-only techniques

`.aa-phone { transform: translateZ(0) }` exists **solely so the demo's 390px phone frame becomes a containing block** for the `position: fixed` provenance sheet and its scrim. It is a preview-harness device, not a production requirement: on a real phone the sheet is fixed to the actual viewport and no transform is needed. Do not carry `.aa-phone`, `.aa-phone-scroll`, `.aa-phone-notch`, `.aa-shell`, `.aa-rail` or `.aa-stage*` into product code — they are demo chrome. Everything else in `analytics.css` is product-ready.

## Status

F · Finance, G · Project and the mobile provenance sheet are **source-reviewed; visual acceptance pending** — the preview harness was unavailable (even static, JS-free cards timed out), so these four checks are still owed:

1. F · Финансы, desktop
2. G · Проект, desktop
3. G · Проект, mobile — the two `AADelta` rows collapsing to six stacked cells
4. Mobile provenance sheet opened from «источник» — must stay inside the 390px frame, scrim must not cover the rail

I · Experiment and J · Trade-off / System Review are **not started**, pending owner approval.
