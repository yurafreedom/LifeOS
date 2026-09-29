import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { decisionSaveRequests } from '../analytics/experimentFacts';
import { LAZY_ROUTE_LOADERS } from '../app/lazyRoutes.jsx';
import { LIFE_ROUTES, readRouteFromHash } from '../app/routeRegistry.js';
import AAAdherence from '../components/analytics/AAAdherence.jsx';
import AAExpStages, { stageProgress } from '../components/analytics/AAExpStages.jsx';
import { Sidebar } from '../components/Sidebar.jsx';
import { AnalyticsContext } from '../context/AnalyticsContext.jsx';
import { LifeLocaleContext, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';
import ExperimentPage, { ExperimentDetailView, ExperimentListView } from '../pages/analytics/ExperimentPage.jsx';
import { ExperimentChoiceList } from '../pages/analytics/experiment/DecisionStep.jsx';
import { StopDialog } from '../pages/analytics/experiment/Detail.jsx';
import { focusStep, historyRows } from '../pages/analytics/experiment/format.js';

const ID = '7c1d0f7e-2b1a-4c1e-9a55-0d7f5b1c2e11';

function render(node, locale = 'ru') {
  const t = LifeMakeT(locale);
  return renderToStaticMarkup(<LifeLocaleContext.Provider value={{ t, locale }}>{node}</LifeLocaleContext.Provider>);
}

const provenance = { source_kind: 'USER_REPORTED', basis: null, method: 'MANUAL', recorded_at: '2026-10-08T17:00:00Z',
  source_ref: null, original_recorded_at_known: true };
const minutes = num => ({ type: 'duration', unit_code: 'minute', num, date: null, text: null, scale_min: null, scale_max: null });

function day(date, state, record = null) {
  return { day: date, state, record };
}

function adherence(overrides = {}) {
  const days = [];
  const states = ['kept', 'missed', 'kept', 'unknown', 'not_recorded', 'kept', 'kept', 'kept', 'kept'];
  for (let index = 1; index <= 21; index += 1) {
    const date = `2026-10-${String(index).padStart(2, '0')}`;
    days.push(day(date, states[index - 1] ?? 'future',
      index <= 9 && states[index - 1] !== 'not_recorded'
        ? { id: `r${index}`, idempotency_key: `k${index}`, recorded_at: '2026-10-09T09:00:00Z', corrected: index === 2 }
        : null));
  }
  return {
    applicable: true, denominator_basis: 'experiment_elapsed_days', total_days: 21, elapsed_days: 9,
    kept: 6, missed: 1, unknown: 1, not_recorded: 1, future: 12, not_run_after_stop: 0,
    abandon_day: null, days, correction_count: 1, ...overrides,
  };
}

const baselineFact = {
  id: 'b1', concept: 'baseline', fact_table: 'aa_baselines', subject_key: `experiment:experiment:${ID}`, metric_key: null,
  value: minutes('40.000000'), value_type: 'duration', dimensions: null, provenance, status: 'active',
  supersedes_id: null, superseded_by_id: null, superseded_at: null, supersede_kind: null, supersede_reason: null,
  window_start: '2026-09-01', window_end: '2026-09-30', timezone: 'Europe/Kyiv',
};
const outcomeObs = {
  id: 'o1', role: 'outcome', label: 'Время засыпания', value: minutes('25.000000'), occurred_at: '2026-10-08T17:00:00Z',
  occurred_tz: 'Europe/Kyiv', provenance, status: 'active', supersedes_id: null, superseded_by_id: null,
};

function result(state, delta, desire = 'unknown') {
  return {
    state, reason: delta.reason ?? null, outcome_day: '2026-10-08', covered_days: 8,
    summary: { baselines: [baselineFact], observations: [outcomeObs] },
    comparison: {
      metric_key: null, current_concept: 'observation', current_id: 'o1', reference_concept: 'baseline', reference_id: 'b1',
      availability: state === 'known' ? 'present' : 'no_data', delta, desire, grounding_id: null, grounding_kind: null, coverage: null,
    },
  };
}

function detail(overrides = {}) {
  return {
    id: ID, title: 'Экран до 23:00', hypothesis: 'Если убрать экран, засыпаю быстрее.',
    hypothesis_recorded_at: '2026-09-30T09:00:00Z', intervention: 'Телефон в другой комнате с 23:00.',
    created_at: '2026-09-30T09:00:00Z', evaluated_at: '2026-10-09T09:00:00Z',
    window: { start: '2026-10-01', end: '2026-10-21', timezone: 'Europe/Kyiv', total_days: 21, local_today: '2026-10-09',
      window_elapsed: false, completion_due: false },
    outcome: { label: 'Время засыпания', value_type: 'duration', unit_code: 'minute', scale_min: null, scale_max: null },
    lifecycle: 'RUNNING', abandoned_from: null,
    lifecycle_events: [{ state: 'DRAFT', occurred_at: '2026-09-30T09:00:00Z' }, { state: 'RUNNING', occurred_at: '2026-10-01T06:00:00Z' }],
    adherence: adherence(), baseline: baselineFact, baselines: [baselineFact],
    observations: { outcome: [outcomeObs], context: [] }, conditions: [],
    result: result('too_early', { state: 'unknown', reason: 'period_not_finished' }),
    decision: { current: null, history: [], factors: [] },
    ...overrides,
  };
}

// ───────────────────── F7 · adherence ─────────────────────

describe('AAAdherence', () => {
  it('renders the server days in calendar order with every derived state', () => {
    const html = render(<AAAdherence adherence={adherence()} />);
    const states = [...html.matchAll(/data-state="([a-z_]+)"/g)].map(match => match[1]);
    expect(states.slice(0, 3)).toEqual(['kept', 'missed', 'kept']); // a missed day stays in place
    expect(states).toHaveLength(21);
    for (const cls of ['is-kept', 'is-missed', 'is-unknown', 'is-not-recorded', 'is-future']) expect(html).toContain(cls);
    expect(html).toContain('соблюдено 6 из 9 прошедших дн. · период 21 дн.');
    expect(html).toContain('aria-label="2 октября: не соблюдено · исправлено"');
    expect(html).toContain('aria-label="10 октября: ещё не наступил"');
    expect(html).toContain('aria-label="5 октября: не записано"');
    expect(html).toContain('Частичное соблюдение — обычное состояние, а не брак данных.');
  });

  it('marks days after a stop as not run, distinct from future and missed', () => {
    const stopped = adherence({
      elapsed_days: 8, future: 0, not_run_after_stop: 13, abandon_day: '2026-10-08',
      days: adherence().days.map((entry, index) => (index >= 8 ? { ...entry, state: 'not_run_after_stop', record: null } : entry)),
    });
    const html = render(<AAAdherence adherence={stopped} />);
    expect(html).toContain('is-after-stop');
    expect(html).toContain('aria-label="9 октября: не проводился"');
    expect(html).not.toContain('data-state="future"');
    expect(html).not.toContain('data-state="missed" aria-label="9');
    expect(html).toContain('не проводился после остановки: 13 дн.');
  });

  it('is not applicable before the start, and shows no not-recorded days', () => {
    const html = render(<AAAdherence adherence={{ ...adherence(), applicable: false, days: [] }} />);
    expect(html).toContain('Соблюдение считается с начала эксперимента.');
    expect(html).not.toContain('data-state');
  });
});

// ───────────────────── F8 · stages from lifecycle only ─────────────────────

describe('AAExpStages', () => {
  it.each([
    ['DRAFT', null, 0, [1]],
    ['RUNNING', null, 2, [3]],
    ['COMPLETED_AWAITING_REVIEW', null, 4, [5, 6]],
    ['REVIEWED', null, 6, []],
    ['ABANDONED', 'DRAFT', 1, []],
    ['ABANDONED', 'RUNNING', 3, []],
    ['ABANDONED', 'COMPLETED_AWAITING_REVIEW', 4, []],
  ])('%s from %s', (lifecycle, from, done, now) => {
    expect(stageProgress(lifecycle, from)).toEqual({ done, now });
    const html = render(<AAExpStages lifecycle={lifecycle} abandonedFrom={from} />);
    expect(html.match(/aa-exp-step is-done/g)?.length ?? 0).toBe(done);
    expect(html.match(/aa-exp-step is-now/g)?.length ?? 0).toBe(now.length);
  });

  it('labels a stop without treating it as an outcome', () => {
    expect(render(<AAExpStages lifecycle="ABANDONED" abandonedFrom="RUNNING" />)).toContain('прекращён · период не завершён');
    expect(render(<AAExpStages lifecycle="ABANDONED" abandonedFrom="COMPLETED_AWAITING_REVIEW" />))
      .toContain('прекращён после окончания периода');
  });

  it('never reads a decision: the same lifecycle renders the same stages whatever was decided', () => {
    const reviewedNull = detail({ lifecycle: 'REVIEWED', decision: { current: { choice: null, revision: 1, created_at: 'x' }, history: [], factors: [] } });
    const reviewedReject = detail({ lifecycle: 'REVIEWED', decision: { current: { choice: 'reject', revision: 1, created_at: 'x' }, history: [], factors: [] } });
    const stagesOf = html => html.slice(html.indexOf('aa-exp-stage'), html.indexOf('aa-exp-claim'));
    expect(stagesOf(render(<ExperimentDetailView detail={reviewedNull} />)))
      .toBe(stagesOf(render(<ExperimentDetailView detail={reviewedReject} />)));
  });
});

// ───────────────────── F9 / F10 · honesty ─────────────────────

describe('experiment detail', () => {
  it('labels the hypothesis as a claim and the result as not proof', () => {
    const html = render(<ExperimentDetailView detail={detail()} />);
    expect(html).toContain('гипотеза · предположение, не факт');
    expect(html).toContain('Разница — это разница, а не доказательство причины.');
    expect(html).toContain('измерения, не выводы');
    expect(html).toContain('Изменений условий не зафиксировано. Это не означает, что их не было.');
  });

  it('F10 · too early renders «рано судить» with an unknown desire', () => {
    const html = render(<ExperimentDetailView detail={detail()} />);
    expect(html).toContain('рано судить');
    expect(html).toContain('data-desire="unknown"');
    expect(html).toContain('Промежуточные значения показываются, но результат не считается до конца периода.');
    expect(html).toContain('на 8 окт. 2026 г. · 8 из 21 дн.');
  });

  it.each([['-15.000000', '−15 м'], ['15.000000', '+15 м']])('F10 · a known result %s is neutral', (num, text) => {
    const known = detail({
      lifecycle: 'COMPLETED_AWAITING_REVIEW',
      result: result('known', { state: 'known', type: 'duration', num, unit_code: 'minute' }, 'neutral'),
    });
    const html = render(<ExperimentDetailView detail={known} />);
    expect(html).toContain('data-desire="neutral"');
    expect(html).not.toContain('data-desire="favorable"');
    expect(html).not.toContain('data-desire="unfavorable"');
    expect(html).toContain(text);
  });

  it('F10 · an empty experiment renders empty states, never zeros or fake values', () => {
    const empty = detail({
      lifecycle: 'DRAFT', lifecycle_events: [{ state: 'DRAFT', occurred_at: '2026-09-30T09:00:00Z' }],
      adherence: { ...adherence(), applicable: false, days: [], kept: 0, missed: 0, unknown: 0, not_recorded: 0, elapsed_days: 0 },
      baseline: null, baselines: [], observations: { outcome: [], context: [] },
      result: { ...result('not_applicable', { state: 'not_applicable' }), summary: { baselines: [], observations: [] } },
    });
    const html = render(<ExperimentDetailView detail={empty} />);
    expect(html).toContain('Наблюдений пока нет.');
    expect(html).toContain('Результат появится после окончания периода.');
    expect(html).toContain('не задан');
    expect(html).not.toContain('data-state="kept"');
    expect(html).not.toMatch(/соблюдено 0 из/);
  });

  it('shows unconfirmed and failed queue records beside server truth', () => {
    const records = [
      { queue_id: 1, operation_type: 'experiment.adherence', state: 'pending', payload: {} },
      { queue_id: 2, operation_type: 'experiment.decision', state: 'failed_permanent', last_error_code: 'experiment_not_awaiting_decision', payload: {} },
    ];
    const html = render(<ExperimentDetailView detail={detail()} records={records} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Есть записи, ещё не подтверждённые сервером: 1.');
    expect(html).toContain('Не принято сервером · 1');
    expect(html).toContain('experiment_not_awaiting_decision');
  });

  it('never offers forms that the lifecycle refuses', () => {
    const abandoned = render(<ExperimentDetailView detail={detail({ lifecycle: 'ABANDONED', abandoned_from: 'RUNNING',
      result: result('not_applicable', { state: 'not_applicable' }) })} />);
    expect(abandoned).not.toContain('Отметить день');
    expect(abandoned).not.toContain('Прекратить эксперимент');
    expect(abandoned).toContain('Эксперимент прекращён до конца периода — результат не считается.');
    const reviewed = render(<ExperimentDetailView detail={detail({ lifecycle: 'REVIEWED',
      result: result('no_data', { state: 'unknown', reason: 'operand_absent' }) })} />);
    expect(reviewed).toContain('Пока без решения');
    expect(reviewed).not.toContain('Прекратить эксперимент');
  });

  it('F9 · no recommendation, score or causal wording in the Experiment UI sources', () => {
    const files = [
      '../pages/analytics/ExperimentPage.jsx',
      ...readdirSync(new URL('../pages/analytics/experiment/', import.meta.url)).map(name => `../pages/analytics/experiment/${name}`),
      '../components/analytics/AAExpStages.jsx',
      '../components/analytics/AAAdherence.jsx',
    ];
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source).not.toMatch(/recommend|score|suggest|because|caused/i);
    }
    const copy = Object.entries(LifeStrings.ru).filter(([key]) => key.startsWith('aa_ex_')).map(([, value]) => value).join(' ');
    expect(copy).not.toMatch(/рекоменд|благодаря|привело к|из-за вмешательства/i);
  });
});

// ───────────────────── F11 · decision ─────────────────────

describe('experiment decision', () => {
  it('offers exactly the five experiment choices plus «Пока без решения»', () => {
    const html = render(<ExperimentChoiceList value={null} onChange={() => {}} />);
    const labels = [...html.matchAll(/role="radio"[^>]*>([^<]+)</g)].map(match => match[1]);
    expect(labels).toEqual([
      'Оставить правило', 'Изменить условия и повторить', 'Продлить период', 'Отказаться',
      'Непонятно — данных недостаточно', 'Пока без решения',
    ]);
    expect(html).toContain('aria-checked="true"'); // null is a real, selected answer
  });

  it('enqueues the decision, then REVIEWED — only while awaiting review', () => {
    const awaiting = decisionSaveRequests(ID, 'COMPLETED_AWAITING_REVIEW', '2026-10-23T09:00:00Z', { choice: 'reject' });
    expect(awaiting.map(request => request.operation_type)).toEqual(['experiment.decision', 'experiment.transition']);
    expect(awaiting[1].payload).toMatchObject({ to: 'REVIEWED' });
    const reviewed = decisionSaveRequests(ID, 'REVIEWED', '2026-10-24T09:00:00Z', { choice: null });
    expect(reviewed.map(request => request.operation_type)).toEqual(['experiment.decision']);
    expect(reviewed[0].payload.choice).toBeNull();
  });

  it('collapses consecutive equal choices in the history', () => {
    const history = [1, 2, 3].map((revision, index) => ({
      choice: ['keep', 'keep', 'reject'][index], revision, created_at: `2026-10-2${revision}T09:00:00Z`,
      superseded_in_revision: revision < 3 ? revision + 1 : null,
    }));
    const rows = historyRows(detail({ decision: { current: history[2], history, factors: [] } }), LifeMakeT('ru'));
    expect(rows.filter(row => row.key.startsWith('dec-')).map(row => row.what)).toEqual([
      'Решение изменено · Отказаться', 'Решение · Оставить правило',
    ]);
  });
});

// ───────────────────── F12 · stop dialog ─────────────────────

describe('stop dialog', () => {
  it('is a modal dialog with a cancel and a confirm', () => {
    const html = render(<StopDialog onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Прекращение — не провал и не вывод о гипотезе.');
  });

  it('keeps Tab inside the dialog', () => {
    expect(focusStep(0, 2, false)).toBe(1);
    expect(focusStep(1, 2, false)).toBe(0);
    expect(focusStep(0, 2, true)).toBe(1);
    expect(focusStep(-1, 2, true)).toBe(1);
  });

  it('is offered for DRAFT and RUNNING only (D4)', () => {
    for (const lifecycle of ['DRAFT', 'RUNNING']) {
      expect(render(<ExperimentDetailView detail={detail({ lifecycle })} />)).toContain('Прекратить эксперимент');
    }
    for (const lifecycle of ['COMPLETED_AWAITING_REVIEW', 'REVIEWED']) {
      expect(render(<ExperimentDetailView detail={detail({ lifecycle })} />)).not.toContain('Прекратить эксперимент');
    }
  });
});

// ───────────────────── F14 · RU / UK ─────────────────────

describe('locale', () => {
  it('has the same experiment keys in ru and uk, and uk is Ukrainian', () => {
    const ru = Object.keys(LifeStrings.ru).filter(key => key.startsWith('aa_ex_') || key === 'nav_experiments');
    const uk = Object.keys(LifeStrings.uk).filter(key => key.startsWith('aa_ex_') || key === 'nav_experiments');
    expect(uk.sort()).toEqual(ru.sort());
    for (const key of uk) expect(LifeStrings.uk[key]).not.toMatch(/[ыэъёЫЭЪЁ]/);
  });

  it('renders a full UK detail without Russian-only letters outside user data', () => {
    const neutral = detail({ title: 'Екран до 23:00', hypothesis: 'Якщо прибрати екран, засинаю швидше.',
      intervention: 'Телефон в іншій кімнаті.', outcome: { ...detail().outcome, label: 'Час засинання' },
      baseline: baselineFact, observations: { outcome: [{ ...outcomeObs, label: 'Час засинання' }], context: [] } });
    const html = render(<ExperimentDetailView detail={neutral} />, 'uk');
    expect(html).toContain('гіпотеза · припущення, не факт');
    expect(html).toContain('дотримано 6 з 9 дн., що минули · період 21 дн.');
    expect(html).toContain('рано судити');
    expect(html.replace(/<[^>]+>/g, ' ')).not.toMatch(/[ыэъёЫЭЪЁ]/);
  });
});

// ───────────────────── F15 · route, entry, gating ─────────────────────

describe('experiment route', () => {
  it('is one analytics-gated, lazily loaded route with a hash family', async () => {
    expect(LIFE_ROUTES.size).toBe(21);
    expect(readRouteFromHash('#/experiment')).toBe('experiment');
    expect(readRouteFromHash('#/experiment/new')).toBe('experiment');
    expect(readRouteFromHash(`#/experiment/${ID}`)).toBe('experiment');
    const module = await LAZY_ROUTE_LOADERS.experiment();
    expect(module.default).toBe(ExperimentPage);
  });

  it('shows the Sidebar entry only when analytics is enabled', () => {
    const props = { route: 'home', onNav: () => {}, collapsed: false, setCollapsed: () => {}, user: { email: 'a@b.c' } };
    expect(render(<Sidebar {...props} analyticsEnabled />)).toContain('эксперименты');
    expect(render(<Sidebar {...props} />)).not.toContain('эксперименты');
  });

  it('is inert when the analytics client is off', () => {
    const html = render(<AnalyticsContext.Provider value={{ enabled: false }}><ExperimentPage /></AnalyticsContext.Provider>);
    expect(html).toContain('Аналитика выключена.');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<button');
  });

  it('lists open and closed experiments and unsaved creates from the queue', () => {
    const data = { lifecycles: [], limit: 50, experiments: [
      { id: ID, title: 'Идёт', lifecycle: 'RUNNING', abandoned_from: null, window_start: '2026-10-01', window_end: '2026-10-21',
        timezone: 'Europe/Kyiv', window_elapsed: false, completion_due: false, created_at: '2026-09-30T09:00:00Z' },
      { id: '2b1a7c1d-0f7e-4c1e-9a55-0d7f5b1c2e11', title: 'Прекращён', lifecycle: 'ABANDONED', abandoned_from: 'RUNNING',
        window_start: '2026-10-01', window_end: '2026-10-21', timezone: 'Europe/Kyiv', window_elapsed: false,
        completion_due: false, created_at: '2026-09-29T09:00:00Z' },
    ] };
    const queued = [{ queue_id: 9, operation_type: 'experiment.create',
      payload: { id: '3c1d0f7e-2b1a-4c1e-9a55-0d7f5b1c2e11', title: 'В очереди' } }];
    const html = render(<ExperimentListView data={data} queued={queued} />);
    expect(html).toContain('Идут и ждут решения');
    expect(html).toContain('Завершённые и прекращённые');
    expect(html).toContain('В очереди');
    expect(html).toContain('ещё не сохранено на сервере');
    expect(render(<ExperimentListView data={{ ...data, experiments: [] }} />)).toContain('Экспериментов пока нет.');
  });
});

// ───────────────────── F16 · T-16 no demo chrome ─────────────────────

describe('no demo chrome', () => {
  it('ships none of the frozen kit’s showcase classes or demo copy', () => {
    // Built indirectly so this file does not trip the repository-wide T-16 scan.
    const banned = ['phone', 'shell', 'rail', 'stage', 'layers'].map(name => `aa-${name}`);
    const html = render(<ExperimentDetailView detail={detail()} />);
    const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap(match => match[1].split(' ')));
    for (const cls of banned) expect(classes.has(cls)).toBe(false);
    expect(html).not.toContain('будущая возможность');
    const css = readFileSync(new URL('../analytics.css', import.meta.url), 'utf8');
    for (const cls of banned) expect(css).not.toMatch(new RegExp(`\\.${cls}\\b`));
  });
});
