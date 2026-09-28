import React from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AAFactorTag from '../components/analytics/AAFactorTag.jsx';
import { ProjectCard } from '../components/ProjectCard.jsx';
import { LifeLocaleContext, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';
import { ReviewEvidence, ReviewFlow, SavedReview } from '../pages/analytics/ReviewPage.jsx';

const money = num => ({ type: 'money', unit_code: 'UAH', num, date: null, text: null, scale_min: null, scale_max: null });
const count = num => ({ type: 'count', unit_code: null, num, date: null, text: null, scale_min: null, scale_max: null });
const provenance = (source_kind = 'USER_REPORTED') => ({
  source_kind, basis: null, method: null, recorded_at: '2026-08-01T08:00:00Z', original_recorded_at_known: true,
});

function item(overrides) {
  return {
    ordinal: 1, section: 'compare', role: 'expected', label_key: 'expectation', metric_key: 'finance.monthly_spend',
    availability: 'present', value: money('62345.670000'), desire: null, epistemic_kind: null, estimate: false,
    provenance: provenance(), redacted: false, source_state: 'current', source_flags: [], current_value: null,
    ...overrides,
  };
}

const coverage = [
  ['observed_count', '28.000000'], ['expected_denominator', '31.000000'], ['partial_count', '0.000000'],
  ['missing_count', '0.000000'], ['unknown_coverage_count', '0.000000'], ['future_count', '3.000000'],
  ['estimated_count', '0.000000'], ['corrected_count', '0.000000'], ['has_legacy_imports', '0.000000'],
].map(([key, num], index) => item({
  ordinal: 5 + index, section: 'quality', role: 'coverage', label_key: `coverage.${key}`,
  value: count(num), provenance: provenance('DERIVED'),
}));

const financeItems = [
  item({}),
  item({ ordinal: 2, role: 'actual', label_key: 'actual', value: money('61345.670000'), provenance: provenance('DERIVED') }),
  item({ ordinal: 3, role: 'delta', label_key: 'delta', value: money('-1000.000000'), desire: 'neutral', provenance: provenance('DERIVED') }),
  ...coverage,
  item({
    ordinal: 14, section: 'alongside', role: 'observation', label_key: 'observation', metric_key: null,
    value: { type: 'scale', unit_code: null, num: '2.000000', date: null, text: null, scale_min: '1.000000', scale_max: '7.000000' },
    epistemic_kind: 'mine',
  }),
];

const context = {
  subject_key: 'finance:period:2026-08', window_start: '2026-08-01', window_end: '2026-08-31', timezone: 'Europe/Kyiv',
  context_as_of: '2026-09-28T13:00:00Z', context_fingerprint: 'c'.repeat(64),
  manifest: { manifest_version: 1, subject_kind: 'finance_period', sections: [] }, items: financeItems,
};

const projectItems = [
  item({ role: 'forecast', label_key: 'forecast_latest', metric_key: 'project.completion_date', estimate: true,
    value: { type: 'date', unit_code: null, num: null, date: '2026-08-26', text: null, scale_min: null, scale_max: null } }),
  item({ ordinal: 2, role: 'actual', label_key: 'actual', metric_key: 'project.completion_date', provenance: provenance('OBSERVED'),
    value: { type: 'date', unit_code: null, num: null, date: '2026-08-25', text: null, scale_min: null, scale_max: null } }),
  item({ ordinal: 3, role: 'delta', label_key: 'delta', metric_key: 'project.completion_date', desire: 'neutral',
    value: { type: 'duration', unit_code: 'minute', num: '-1440.000000', date: null, text: null, scale_min: null, scale_max: null } }),
];

function inLocale(locale, node) {
  return <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), setLocale: () => {} }}>{node}</LifeLocaleContext.Provider>;
}

const render = (node, locale = 'ru') => renderToStaticMarkup(inLocale(locale, node));
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');

describe('Review · five optional steps', () => {
  it('step 1 shows the frozen comparison, neutral without a target, with its quality strip', () => {
    const html = render(<ReviewFlow context={context} onSave={() => {}} />);
    expect(html).toContain('Что ожидалось и что вышло?');
    expect(html).toContain('₴62,345.67');
    expect(html).toContain('₴61,345.67');
    expect(html).toContain('−₴1,000');
    expect(html).toContain('data-desire="neutral"');
    expect(html).toContain('желательность не определена');
    expect(html).toContain('покрытие: <b>28 из 31</b>');
    expect(html).toContain('шаг 1 из 5');
  });

  it('«пропустить» is always the left-hand action and every step can be reached', () => {
    const questions = ['Что ожидалось и что вышло?', 'Что изменилось?', 'Что могло повлиять?', 'Чего это стоило?', 'Что дальше?'];
    questions.forEach((question, step) => {
      const html = render(<ReviewFlow context={context} onSave={() => {}} initialStep={step} />);
      expect(html).toContain(question);
      const actions = html.slice(html.indexOf('class="aa-actions"'));
      expect(actions.indexOf('пропустить')).toBeLessThan(actions.indexOf(step === 4 ? 'сохранить ревью' : 'дальше'));
      expect(html).not.toMatch(/required/);
    });
  });

  it('step 3 defaults to «неизвестно» and says an unknown cause is normal', () => {
    const html = render(<ReviewFlow context={context} onSave={() => {}} initialStep={2} />);
    expect(html).toContain('добавить фактор…');
    expect(html).toContain('Причина может остаться неизвестной — это нормальное состояние.');
  });

  it('step 4 juxtaposes real facts only and computes no score', () => {
    const html = render(<ReviewFlow context={context} onSave={() => {}} initialStep={3} />);
    expect(html).toContain('моя трактовка');
    expect(html).toContain('2/7');
    expect(html).toContain('Общий балл не считается.');
    const empty = render(<ReviewFlow context={{ ...context, items: financeItems.slice(0, 3) }} onSave={() => {}} initialStep={3} />);
    expect(empty).toContain('Рядом с этим периодом других записанных фактов нет.');
  });

  it('step 5 is a radiogroup where «Пока без решения» and «Непонятно» are different answers', () => {
    const html = render(<ReviewFlow context={context} onSave={() => {}} initialStep={4} />);
    expect(html).toContain('role="radiogroup"');
    expect((html.match(/role="radio"/g) || []).length).toBe(5);
    expect(html).toContain('Непонятно — данных недостаточно');
    expect(html).toContain('Пока без решения');
    expect(html).not.toContain('aria-checked="true"');
  });

  it('a project review labels the reference as the latest forecast and the delta in days', () => {
    const html = render(<ReviewEvidence items={projectItems} />);
    expect(html).toContain('последний прогноз');
    expect(html).toContain('26 авг.');
    expect(html).toContain('−1 дней');
    expect(html).toContain('is-estimate');
  });
});

describe('Review · frozen values, later corrections and erasure', () => {
  it('flags a later correction beside the frozen value, never instead of it', () => {
    const items = projectItems.map(row => (row.role === 'actual' ? {
      ...row, source_state: 'corrected', source_flags: ['corrected'],
      current_value: { type: 'date', unit_code: null, num: null, date: '2026-08-27', text: null, scale_min: null, scale_max: null },
    } : row));
    const html = render(<ReviewEvidence items={items} />);
    expect(html).toContain('25 авг.');
    expect(html).toContain('данные позже исправлены · сейчас: 27 авг.');
  });

  it('keeps a revision distinct from a correction, and names a withdrawn source', () => {
    const revised = financeItems.map(row => (row.role === 'expected'
      ? { ...row, source_state: 'revised', source_flags: ['revised'], current_value: money('70000.000000') } : row));
    const revisedHtml = render(<ReviewEvidence items={revised} />);
    expect(revisedHtml).toContain('позже появилась новая версия · сейчас: ₴70,000');
    expect(revisedHtml).not.toContain('исправлены');
    const withdrawn = financeItems.map(row => (row.role === 'expected'
      ? { ...row, source_state: 'withdrawn', source_flags: ['withdrawn'] } : row));
    expect(render(<ReviewEvidence items={withdrawn} />)).toContain('источник позже отозван');
  });

  it('renders «источник удалён» in place of an erased value and leaks nothing', () => {
    const erase = row => ({ ...row, redacted: true, availability: null, value: null, desire: null, provenance: null,
      source_state: 'redacted', source_flags: ['redacted'] });
    const items = financeItems.map(row => (['expected', 'delta', 'coverage'].includes(row.role) ? erase(row) : row));
    const html = render(<ReviewEvidence items={items} />);
    // Two erased cells (reference, delta) plus the erased coverage line.
    expect((html.match(/источник удалён/g) || []).length).toBe(3);
    expect(html).toContain('данные о покрытии: источник удалён');
    expect(html).not.toContain('62,345');
    expect(html).not.toContain('1,000');
    expect(html).toContain('₴61,345.67');
  });
});

describe('Review · reopened', () => {
  const review = {
    id: '8f14e45f-ceea-467a-9575-2c1f2f5c3a01', subject: { domain: 'finance', type: 'period', id: '2026-08' },
    subject_key: 'finance:period:2026-08', window_start: '2026-08-01', window_end: '2026-08-31', timezone: 'Europe/Kyiv',
    context_as_of: '2026-09-28T13:00:00Z', created_at: '2026-09-28T13:01:00Z', revised_at: '2026-09-29T09:00:00Z',
    current_revision: 2, manifest: context.manifest, items: financeItems,
    revisions: [
      { revision: 1, created_at: '2026-09-28T13:01:00Z', note_text: 'Объём вырос после аудита.' },
      { revision: 2, created_at: '2026-09-29T09:00:00Z', note_text: 'Не только аудит.' },
    ],
    factors: [
      { id: 'f1', ordinal: 1, text: 'Аудит', epistemic_kind: 'observed', added_in_revision: 1, retracted_in_revision: 2, replaces_id: null },
      { id: 'f2', ordinal: 2, text: 'Аудит', epistemic_kind: 'mine', added_in_revision: 2, retracted_in_revision: null, replaces_id: 'f1' },
    ],
    decision: { id: 'd2', choice: null, revision: 2, superseded_in_revision: null, created_at: '2026-09-29T09:00:00Z' },
    decisions: [
      { id: 'd1', choice: 'keep', revision: 1, superseded_in_revision: 2, created_at: '2026-09-28T13:01:00Z' },
      { id: 'd2', choice: null, revision: 2, superseded_in_revision: null, created_at: '2026-09-29T09:00:00Z' },
    ],
    replayed: false,
  };

  it('shows every note, keeps retracted factors visible, and the decision history', () => {
    const html = render(<SavedReview review={review} onRevise={() => {}} />);
    expect(html).toContain('Объём вырос после аудита.');
    expect(html).toContain('дополнение 1');
    expect(html).toContain('убран в дополнении 1');
    expect(html).toContain('Пока без решения');
    expect(html).toContain('ранее: Оставить как есть');
    expect(html).toContain('Значения показаны так, как они были при сохранении.');
  });

  it('distinguishes a skipped decision step from «Пока без решения» and from «Непонятно»', () => {
    const skipped = render(<SavedReview review={{ ...review, decision: null, decisions: [] }} onRevise={() => {}} />);
    expect(skipped).toContain('Шаг пропущен — решение не записано.');
    const inconclusive = render(<SavedReview review={{ ...review, decisions: [], decision: { ...review.decision, choice: 'inconclusive' } }} onRevise={() => {}} />);
    const decisionSection = inconclusive.slice(inconclusive.indexOf('id="aa-rv-decision"'), inconclusive.indexOf('id="aa-rv-revise"'));
    expect(decisionSection).toContain('Непонятно — данных недостаточно');
    expect(decisionSection).not.toContain('Шаг пропущен');
  });
});

describe('Review · accessibility', () => {
  it('the factor tag is an explicit, named menu button', () => {
    const html = render(<AAFactorTag kind="maybe" onChange={() => {}} onRemove={() => {}} />);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="тип фактора: возможный фактор"');
    expect(html).toContain('data-kind="maybe"');
    const readOnly = render(<AAFactorTag kind="unknown" readOnly />);
    expect(readOnly).not.toContain('<button');
    expect(readOnly).toContain('неизвестно');
  });

  it('announces the step, labels the note field and keeps a focusable question heading', () => {
    const html = render(<ReviewFlow context={context} onSave={() => {}} initialStep={1} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toMatch(/<label class="aa-sr-only" for="[^"]+">Что изменилось, своими словами<\/label>/);
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('class="aa-steps" aria-hidden="true"');
  });
});

describe('Review · RU / UK', () => {
  const keys = locale => Object.keys(LifeStrings[locale]).filter(key => /^aa_(rv|pr)_/.test(key));

  it('every Review and primitive key exists in both locales', () => {
    expect(keys('ru').length).toBeGreaterThan(100);
    expect(new Set(keys('uk'))).toEqual(new Set(keys('ru')));
  });

  it('renders every step in Ukrainian without Russian leaking through', () => {
    for (let step = 0; step < 5; step += 1) {
      const html = render(<ReviewFlow context={context} onSave={() => {}} initialStep={step} />, 'uk');
      expect(text(html)).not.toMatch(/[ыэъё]/i);
    }
    const html = render(<ReviewFlow context={context} onSave={() => {}} />, 'uk');
    expect(html).toContain('Що очікувалося і що вийшло?');
    expect(html).toContain('пропустити');
    expect(render(<ReviewFlow context={context} onSave={() => {}} initialStep={4} />, 'uk'))
      .toContain('Незрозуміло — даних недостатньо');
  });
});

describe('Review · entry points and boundaries', () => {
  const completed = {
    id: 'p1', title: 'Редизайн', status: 'completed', created_at: '2026-08-10T21:30:00Z', started_at: '2026-08-10T21:30:00Z',
    current_forecast_date: '2026-08-26', completed_at: '2026-08-25T12:00:00Z',
  };

  it('a completed project offers «Открыть ревью» over its Kyiv-local lifetime', () => {
    const html = render(<ProjectCard project={completed} onForecast={() => {}} onComplete={() => {}} onArchive={() => {}} reviewEnabled />);
    expect(html).toContain('href="#/review/new/project%3Aproject%3Ap1/2026-08-11/2026-08-25"');
    expect(html).toContain('Открыть ревью');
    const active = render(<ProjectCard project={{ ...completed, status: 'active', completed_at: null }} onForecast={() => {}} onComplete={() => {}} onArchive={() => {}} reviewEnabled />);
    expect(active).not.toContain('Открыть ревью');
    const gated = render(<ProjectCard project={completed} onForecast={() => {}} onComplete={() => {}} onArchive={() => {}} />);
    expect(gated).not.toContain('Открыть ревью');
  });

  // Demo chrome is guarded for all of src/ by tests/aa-demo-chrome.test.js (T-16).
  it('computes no score and recommends nothing', () => {
    /* The page shell plus every module it was split into (pages/analytics/review/). */
    const reviewDir = new URL('../pages/analytics/review/', import.meta.url);
    const files = [
      new URL('../pages/analytics/ReviewPage.jsx', import.meta.url),
      ...readdirSync(reviewDir).map(name => new URL(name, reviewDir)),
    ];
    expect(files.length).toBe(5);
    for (const file of files) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/\bscore\b|lifeScore|recommendation/i);
    }
  });
});
