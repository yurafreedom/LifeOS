import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import FinanceAnalytics from '../pages/finances/FinanceAnalytics';
import MetricHistoryPage from '../pages/analytics/MetricHistoryPage';
import { AnalyticsContext } from '../context/AnalyticsContext';
import { LifeLocaleContext } from '../context/LocaleContext';

const provenance = {
  source_kind: 'USER_REPORTED', basis: 'план пользователя', method: 'manual',
  recorded_at: '2026-08-01T00:00:00Z', source_ref: null,
  original_recorded_at_known: true,
};

function semantic(id, concept, amount, overrides = {}) {
  return {
    id, concept, fact_table: concept === 'target' ? 'aa_targets' : 'aa_expectation_versions',
    subject_key: 'finance:period:2026-08', metric_key: 'finance.monthly_spend',
    value: amount == null ? null : { type: 'money', unit_code: 'UAH', num: amount },
    value_type: 'money', dimensions: null, provenance: { ...provenance, recorded_at: `2026-08-0${id}T00:00:00Z` },
    status: id === '3' || concept === 'target' ? 'active' : 'superseded',
    supersedes_id: null, superseded_by_id: null, superseded_at: null,
    supersede_kind: null, supersede_reason: null, effective_from: `2026-08-0${id}T00:00:00Z`,
    horizon_at: null, window_start: '2026-08-01', window_end: '2026-08-31',
    timezone: 'Europe/Kyiv', occurred_at: null, occurred_tz: null,
    is_explicitly_absent: false, desired_direction: null, statement: null,
    epistemic_kind: null, value_availability: null, ...overrides,
  };
}

const expectations = [
  semantic('1', 'expectation', '50000'),
  semantic('2', 'expectation', '57000'),
  semantic('3', 'expectation', '62000'),
];
const absentTarget = semantic('4', 'target', null, {
  is_explicitly_absent: true, desired_direction: 'lower', effective_from: null,
});
const coverage = {
  window_start: '2026-08-01', window_end: '2026-08-31', timezone: 'Europe/Kyiv',
  denominator_basis: 'calendar_days', expected_denominator: 31, observed_count: 28,
  partial_count: 0, missing_count: 0, unknown_coverage_count: 0, future_count: 3,
  estimated_count: 0, corrected_count: 1, freshest_recorded_at: '2026-08-28T10:00:00Z',
  has_legacy_imports: true, reason: null,
};
const month = {
  period: '2026-08', subject_key: 'finance:period:2026-08', timezone: 'Europe/Kyiv',
  as_of: '2026-08-28T10:00:00Z', availability: 'present',
  actual: { type: 'money', unit_code: 'UAH', num: '61200' },
  known_subtotal: { type: 'money', unit_code: 'UAH', num: '61200' },
  transaction_count: 9, excluded_count: 1, unknown_membership_count: 0,
  policy_known: true, persisted: false, derivation: 'SUM active included facts',
  series: [{ date: '2026-08-01', amount: '1200' }, { date: '2026-08-28', amount: '61200' }],
  expectations, targets: [absentTarget], current_expectation: expectations[2],
  current_target: absentTarget,
  delta: { state: 'known', type: 'money', unit_code: 'UAH', num: '-800' },
  desire: 'neutral', coverage,
};

function contextValue(overrides = {}) {
  return {
    enabled: true, ready: true, sync: { phase: 'idle', pending: 0, failed: 0, last_error: null },
    finance: { data: month, loading: false, error: null },
    loadFinance: vi.fn().mockResolvedValue(month), importLegacy: vi.fn(),
    discardQueueFailure: vi.fn(), exportQueueFailure: vi.fn(),
    currentPeriod: () => '2026-08',
    ...overrides,
  };
}

describe('Finance F/C/D acceptance', () => {
  it('renders three expectation versions, absent target, neutral −800, coverage and provenance', () => {
    const html = renderToStaticMarkup(
      <AnalyticsContext.Provider value={contextValue()}>
        <FinanceAnalytics onHistory={() => undefined} />
      </AnalyticsContext.Provider>,
    );
    for (const value of ['₴50,000', '₴57,000', '₴62,000']) expect(html).toContain(value);
    expect(html).toContain('−₴800');
    expect(html).toContain('data-desire="neutral"');
    expect(html).not.toContain('data-desire="favorable"');
    expect(html).not.toContain('data-desire="unfavorable"');
    expect(html).toContain('Цель на месяц явно не задавалась. Это не ₴0.');
    expect(html).toContain('28 из 31');
    expect(html).toContain('3 дня ещё не наступили и не считаются нулями');
    expect(html).toContain('часть данных импортирована');
    expect(html).toContain('источник');
    expect(html).toContain('Отдельные факты');
    expect(html).not.toContain('Life Score');
    expect(html).not.toContain('demo-rail');
  });

  it('keeps history concepts separate and charts only real API-shaped points', () => {
    const html = renderToStaticMarkup(
      <AnalyticsContext.Provider value={contextValue()}>
        <MetricHistoryPage onBack={() => undefined} />
      </AnalyticsContext.Provider>,
    );
    expect(html).toContain('Actual · Expectation · Target остаются отдельными слоями');
    expect(html).toContain('<svg');
    expect(html).toContain('ожидалось');
    expect(html).toContain('цель');
  });

  it('preserves Hero/PageHeader behavior on both analytics pages', () => {
    const finance = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={{ themeEff: 'paradise' }}>
        <AnalyticsContext.Provider value={contextValue()}>
          <FinanceAnalytics onHistory={() => undefined} />
        </AnalyticsContext.Provider>
      </LifeLocaleContext.Provider>,
    );
    const history = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={{ themeEff: 'paradise' }}>
        <AnalyticsContext.Provider value={contextValue()}>
          <MetricHistoryPage onBack={() => undefined} />
        </AnalyticsContext.Provider>
      </LifeLocaleContext.Provider>,
    );
    expect(finance).toContain('class="hero-scene"');
    expect(history).toContain('class="hero-scene"');
  });

  it('surfaces retained queue conflicts with explicit export and discard actions', () => {
    const value = contextValue({
      sync: {
        phase: 'failed', pending: 1, failed: 1, last_error: 'already corrected',
        failures: [{
          queue_id: 7, operation_type: 'measurement.correct', state: 'terminal_conflict',
          last_error_status: 409, last_error_code: 'correction_conflict',
          last_error_message: 'already corrected',
        }],
      },
    });
    const html = renderToStaticMarkup(
      <AnalyticsContext.Provider value={value}>
        <FinanceAnalytics onHistory={() => undefined} />
      </AnalyticsContext.Provider>,
    );
    expect(html).toContain('Требуют решения · 1');
    expect(html).toContain('correction_conflict');
    expect(html).toContain('Экспорт');
    expect(html).toContain('Удалить из очереди');
  });

  it('has no hardcoded MoneyWidget budget fallback', () => {
    const source = readFileSync(new URL('../components/MoneyWidget.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/const\s+budget\s*=\s*300/);
    expect(source).toContain('current_expectation');
    expect(source).toContain('is_explicitly_absent');
  });
});
