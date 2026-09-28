import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProjectCard } from '../components/ProjectCard.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { ProjectAnalyticsView } from '../pages/projects/ProjectAnalyticsPage.jsx';

const date = value => ({ type: 'date', unit_code: null, num: null, date: value, text: null, scale_min: null, scale_max: null });
const provenance = (source_kind, recorded_at) => ({
  source_kind, basis: 'Прогноз завершения проекта пользователя', method: 'MANUAL_FORECAST',
  recorded_at, source_ref: null, original_recorded_at_known: true,
});

function forecast(id, value, recordedAt, status, supersedes = null) {
  return {
    id, concept: 'forecast', fact_table: 'aa_forecast_versions', subject_key: 'project:project:project-1f3c',
    metric_key: 'project.completion_date', value: date(value), value_type: 'date', dimensions: null,
    provenance: provenance('USER_REPORTED', recordedAt), status, supersedes_id: supersedes,
    superseded_by_id: null, superseded_at: null, supersede_kind: status === 'superseded' ? 'REVISION' : null,
    supersede_reason: null, horizon_at: `${value}T21:00:00Z`,
  };
}

function actual(id, value, source = 'OBSERVED', supersedes = null) {
  return {
    id, metric_key: 'project.completion_date', subject_key: 'project:project:project-1f3c', value: date(value),
    occurred_at: `${value}T12:00:00Z`, occurred_tz: 'Europe/Kyiv', provenance: provenance(source, '2026-08-25T12:00:00Z'),
    status: 'active', supersedes_id: supersedes, superseded_by_id: null, supersede_kind: null,
  };
}

const known = days => ({ state: 'known', type: 'duration', num: String(days * 1440), unit_code: 'minute', reason: null });
const unknown = { state: 'unknown', type: null, num: null, unit_code: null, reason: 'operand_absent' };
const neutral = (delta, reference) => ({ reference_forecast_id: reference, delta, desire: 'neutral', grounding_id: null, grounding_kind: null });

const versions = [
  forecast('f1', '2026-08-20', '2026-08-12T12:00:00Z', 'superseded'),
  forecast('f2', '2026-08-24', '2026-08-15T12:00:00Z', 'superseded', 'f1'),
  forecast('f3', '2026-08-26', '2026-08-20T12:00:00Z', 'active', 'f2'),
];

const canonical = {
  subject_key: 'project:project:project-1f3c', metric_key: 'project.completion_date', as_of: null,
  evaluated_at: '2026-09-28T12:00:00Z', state: 'compared',
  forecast_versions: versions, forecast_version_count: 3, forecast_versions_truncated: false, withdrawn_forecast_count: 0,
  first_forecast: versions[0], latest_forecast: versions[2],
  actual: actual('a1', '2026-08-25'), actual_count: 1, actual_corrections: [],
  delta_vs_first: neutral(known(5), 'f1'), delta_vs_latest: neutral(known(-1), 'f3'),
  observation_count: 0,
};

const completed = {
  id: 'project-1f3c', title: 'Редизайн Life OS', status: 'completed', created_at: '2026-07-12T09:00:00Z',
  started_at: '2026-07-12T09:00:00Z', current_forecast_date: '2026-08-26', completed_at: '2026-08-25T12:00:00Z',
};
const active = { ...completed, status: 'active', completed_at: null };

function inLocale(locale, node) {
  return <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), setLocale: () => {} }}>{node}</LifeLocaleContext.Provider>;
}
const render = (props, locale = 'ru') => renderToStaticMarkup(inLocale(locale, <ProjectAnalyticsView reviewEnabled {...props} />));
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ');
const between = (html, open, close) => html.slice(html.indexOf(open), html.indexOf(close, html.indexOf(open)));
const deltaRow = html => between(html, 'class="aa-delta is-pair"', '</div></div>');
const versionList = html => between(html, 'aria-label="Версии прогноза"', '</ol>');

describe('Project Analytics · canonical scenario', () => {
  it('shows three versions, the Actual apart, and +5 / −1 days, both neutral', () => {
    const html = render({ project: completed, data: canonical });
    expect(html).toContain('Редизайн Life OS');
    expect(text(html)).toContain('версий прогноза: 3 · факт отдельно');
    expect(html).toContain('+5 дней');
    expect(html).toContain('−1 день');
    expect(html).not.toContain('−1 дней');
    const deltas = deltaRow(html);
    expect(deltas.match(/data-desire="neutral"/g)).toHaveLength(2);
    expect(html).not.toMatch(/data-desire="(favorable|unfavorable)"/);
    expect(html).not.toMatch(/is-(good|bad|late|early|favorable|unfavorable)/);
    expect(text(html)).toContain('позже, чем');
    expect(text(html)).toContain('раньше, чем');
    expect(html).toContain('Цель не задавалась');
  });

  it('keeps the Actual out of the version list', () => {
    const html = render({ project: completed, data: canonical });
    const list = versionList(html);
    expect(list.match(/<li /g)).toHaveLength(3);
    expect(list).toContain('dateTime="2026-08-20"');
    expect(list).toContain('dateTime="2026-08-26"');
    expect(list).not.toContain('dateTime="2026-08-25"');
    expect(list).not.toContain('Проект завершён');
    expect(html).toContain('aria-labelledby="pa-actual"');
    expect(between(html, 'aria-labelledby="pa-actual"', '</ol>')).toContain('dateTime="2026-08-25"');
    expect(html).toContain('data-operand="actual"');
  });

  it('labels provenance truthfully and never as derived by Life OS', () => {
    const html = render({ project: completed, data: canonical });
    expect(text(html)).toContain('ваш прогноз');
    expect(text(html)).toContain('наблюдение · завершение проекта');
    expect(html).toContain('первая сохранённая оценка');
    expect(html).not.toMatch(/выведено/i);
    expect(html).toContain('USER_REPORTED');
    expect(html).toContain('OBSERVED');
  });

  it('fabricates no task count, baseline, observation or cause', () => {
    const html = text(render({ project: completed, data: canonical }));
    expect(html).not.toMatch(/задач|типично|прошлым проектам|наблюдений|причина|длительность|балл/i);
  });

  it('renders every date as a machine-readable <time>', () => {
    const html = render({ project: completed, data: canonical });
    for (const value of ['2026-08-20', '2026-08-24', '2026-08-26', '2026-08-25']) {
      expect(html).toContain(`dateTime="${value}"`);
    }
    // The history column shows a localized date; the raw instant is only its machine value.
    expect(html).toContain('class="aa-hist-when" dateTime="2026-08-12T12:00:00Z">');
    expect(html).not.toContain('dateTime="2026-08-12T12:00:00Z">2026-08-12T12:00:00Z<');
    expect(html).toContain('aria-label="Прогнозы и факт"');
    expect(html).toContain('aria-label="Разница факта с прогнозами"');
  });

  it('is complete in Ukrainian, with the right day grammar', () => {
    const html = render({ project: completed, data: canonical }, 'uk');
    expect(html).toContain('+5 днів');
    expect(html).toContain('−1 день');
    expect(text(html)).toContain('версій прогнозу: 3 · факт окремо');
    expect(html).toContain('перша збережена оцінка');
    expect(html).toContain('aria-label="Різниця факту з прогнозами"');
    // Only data (the project title) may be Russian; the copy itself is Ukrainian.
    expect(text(html).replace('Редизайн Life OS', '')).not.toMatch(/[ыэъё]/i);
  });
});

describe('Project Analytics · truthful states', () => {
  const base = {
    ...canonical, actual: null, actual_count: 0,
    delta_vs_first: neutral(unknown, 'f1'), delta_vs_latest: neutral(unknown, 'f3'),
  };

  it('no forecast and no Actual is an empty state', () => {
    const html = render({ project: active, data: {
      ...base, state: 'no_facts', forecast_versions: [], forecast_version_count: 0,
      first_forecast: null, latest_forecast: null, delta_vs_first: neutral(unknown, null), delta_vs_latest: neutral(unknown, null),
    } });
    expect(html).toContain('Прогноз и факт завершения ещё не записаны.');
    expect(html).not.toContain('aa-delta is-pair');
    expect(html).toContain('Версий прогноза нет.');
  });

  it('a future horizon without an Actual is too early — no delta', () => {
    const html = render({ project: active, data: { ...base, state: 'too_early' } });
    const deltas = deltaRow(html);
    expect(deltas).toContain('рано судить');
    expect(deltas).toContain('срок прогноза ещё не наступил');
    expect(deltas.match(/data-desire="unknown"/g)).toHaveLength(2);
    expect(deltas).not.toMatch(/\d+ (день|дня|дней)/);
  });

  it('a passed horizon without an Actual is never overdue or missed', () => {
    const html = render({ project: active, data: { ...base, state: 'actual_not_recorded' } });
    expect(deltaRow(html)).toContain('факт не записан');
    expect(html).toContain('срок прогноза прошёл, факт завершения не записан');
    expect(text(html)).not.toMatch(/просроч|пропущ|опозд|сорван|провал/i);
    expect(html).toContain('Факт завершения не записан.');
  });

  it('an Actual without a forecast has an unknown delta, never zero', () => {
    const html = render({ project: completed, data: {
      ...canonical, state: 'no_forecast', forecast_versions: [], forecast_version_count: 0,
      first_forecast: null, latest_forecast: null,
      delta_vs_first: neutral(unknown, null), delta_vs_latest: neutral(unknown, null),
    } });
    expect(html).toContain('прогноз не задавался — разница неизвестна');
    expect(deltaRow(html)).not.toMatch(/0 дней|\+0|−0/);
    expect(text(html)).toContain('версий прогноза: 0 · факт отдельно');
    expect(between(html, 'aria-labelledby="pa-actual"', '</ol>')).toContain('dateTime="2026-08-25"');
  });

  it('one forecast shows first and latest as the same version, with a note', () => {
    const only = forecast('f1', '2026-08-26', '2026-08-12T12:00:00Z', 'active');
    const html = render({ project: completed, data: {
      ...canonical, forecast_versions: [only], forecast_version_count: 1, first_forecast: only, latest_forecast: only,
      delta_vs_first: neutral(known(-1), 'f1'), delta_vs_latest: neutral(known(-1), 'f1'),
    } });
    expect(html).toContain('Одна версия прогноза — первая и последняя оценки совпадают.');
    expect(deltaRow(html).match(/−1 день/g)).toHaveLength(2);
  });

  it('a corrected Actual is shown once, with its lineage', () => {
    const original = { ...actual('a0', '2026-08-24'), status: 'superseded', supersede_kind: 'CORRECTION' };
    const corrected = actual('a1', '2026-08-25', 'USER_REPORTED', 'a0');
    const html = render({ project: completed, data: { ...canonical, actual: corrected, actual_corrections: [original] } });
    const block = between(html, 'aria-labelledby="pa-actual"', '</ol>');
    expect(block).toContain('Исправлено, было:');
    expect(block).toContain('dateTime="2026-08-24"');
    expect(block).toContain('исправлено вами');
    expect(block.match(/Проект завершён/g)).toHaveLength(1);
    expect(text(html)).toContain('наблюдение · завершение проекта · исправлено');
  });

  it('reports withdrawn versions and real observations only when they exist', () => {
    const html = render({ project: completed, data: { ...canonical, withdrawn_forecast_count: 1, observation_count: 2 } });
    expect(text(html)).toContain('отозвано версий: 1 · показаны только сохранённые');
    expect(text(html)).toContain('наблюдений: 2');
  });
});

describe('Project Analytics · seams', () => {
  it('says so when local writes are not yet acknowledged, without counting them', () => {
    const html = render({ project: completed, data: canonical, pending: 2 });
    expect(html).toContain('role="status"');
    expect(html).toContain('Есть записи, ещё не подтверждённые сервером: 2.');
    expect(text(html)).toContain('версий прогноза: 3');
  });

  it('offers Review only for a completed project, through the Slice 4 route', () => {
    const done = render({ project: completed, data: canonical });
    expect(done).toContain('href="#/review/new/project%3Aproject%3Aproject-1f3c/2026-07-12/2026-08-25"');
    expect(done).toContain('Открыть ревью');
    expect(render({ project: active, data: canonical })).not.toContain('#/review/');
    expect(render({ project: completed, data: canonical, reviewEnabled: false })).not.toContain('#/review/');
    // The analytics surface stands alone while the data is loading, too.
    expect(render({ project: completed })).toContain('Загрузка аналитики проекта…');
  });

  it('shows an honest state for an unknown project or an unavailable read', () => {
    expect(render({ project: null })).toContain('Проект не найден в этом аккаунте.');
    expect(render({ project: completed, error: new Error('x') })).toContain('Аналитика проекта сейчас недоступна.');
  });

  it('collapses to stacked cells on a narrow screen', () => {
    const html = render({ project: completed, data: canonical, narrow: true });
    expect(html).toContain('project-analytics-page aa-narrow');
    const css = readFileSync(new URL('../analytics.css', import.meta.url), 'utf8');
    expect(css).toContain('.aa-narrow .aa-delta.is-pair { grid-template-columns: 1fr; }');
    expect(css).toMatch(/@media \(max-width: 700px\) \{\s*\.aa-delta\.is-pair \{ grid-template-columns: 1fr; \}/);
  });

  it('links each project card to its analytics only when analytics routes exist', () => {
    const card = props => render({}, 'ru') && renderToStaticMarkup(inLocale('ru', <ProjectCard project={active}
      onForecast={() => {}} onComplete={() => {}} onArchive={() => {}} {...props} />));
    expect(card({ analyticsEnabled: true })).toContain('href="#/project-analytics/project-1f3c"');
    expect(card({ analyticsEnabled: true })).toContain('Аналитика проекта');
    expect(card({})).not.toContain('#/project-analytics/');
  });

  it('computes no score, recommends nothing and never reads the snapshot forecast', () => {
    const dir = new URL('../pages/projects/', import.meta.url);
    const files = ['ProjectAnalyticsPage.jsx', ...readdirSync(new URL('analytics/', dir)).map(name => `analytics/${name}`)];
    for (const file of files) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      expect(source).not.toMatch(/\.current_forecast_date/);
      // Code, not the doc comment that says what is absent.
      expect(source).not.toMatch(/(score|recommend)\w*\s*(=|\(|:)/i);
    }
  });
});
