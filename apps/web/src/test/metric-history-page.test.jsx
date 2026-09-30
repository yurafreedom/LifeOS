import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import MetricHistoryPage, { metricHistoryView, needsFinanceLoad } from '../pages/analytics/MetricHistoryPage.jsx';
import { AnalyticsContext } from '../context/AnalyticsContext.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';

/* Completion-audit D2: a cold direct entry (#/analytics-history, reload) must load
   the month through the shared AnalyticsContext loader instead of relying on a
   prior visit to Finance analytics; every string is localized; the retention
   horizon is a date-only value shown without a zone shift. */

const coverage = {
  window_start: '2026-09-01', window_end: '2026-09-30', timezone: 'Europe/Kyiv',
  denominator_basis: 'calendar_days', expected_denominator: 30, observed_count: 0,
  partial_count: 0, missing_count: 0, unknown_coverage_count: 0, future_count: 0,
  estimated_count: 0, corrected_count: 0, freshest_recorded_at: null, has_legacy_imports: false, reason: null,
};
const expectation = {
  id: 'e1', concept: 'expectation', fact_table: 'aa_expectation_versions', subject_key: 'finance:period:2026-09',
  metric_key: 'finance.monthly_spend', value: { type: 'money', unit_code: 'UAH', num: '50000' }, value_type: 'money',
  dimensions: null, status: 'active', supersedes_id: null, superseded_by_id: null, superseded_at: null,
  supersede_kind: null, supersede_reason: null, effective_from: null, horizon_at: null,
  window_start: '2026-09-01', window_end: '2026-09-30', timezone: 'Europe/Kyiv', occurred_at: null, occurred_tz: null,
  is_explicitly_absent: false, desired_direction: null, statement: null, epistemic_kind: null, value_availability: null,
  provenance: { source_kind: 'USER_REPORTED', basis: 'manual', method: 'MANUAL', recorded_at: '2026-09-02T10:00:00Z', source_ref: null, original_recorded_at_known: true },
};
const month = {
  period: '2026-09', subject_key: 'finance:period:2026-09', timezone: 'Europe/Kyiv', as_of: '2026-09-30T09:00:00Z',
  availability: 'present', actual: { type: 'money', unit_code: 'UAH', num: '1200' },
  series: [{ date: '2026-09-01', amount: '1200' }], expectations: [expectation], targets: [],
  current_expectation: expectation, current_target: null, coverage, retention_horizon: null,
};
const emptyMonth = { ...month, series: [], expectations: [], targets: [], current_expectation: null, actual: null };

function contextValue(finance, overrides = {}) {
  return {
    enabled: true, ready: true, finance, loadFinance: vi.fn().mockResolvedValue(finance.data),
    currentPeriod: () => '2026-09', ...overrides,
  };
}
function render(value, locale = 'ru') {
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), setLocale: () => {} }}>
      <AnalyticsContext.Provider value={value}>
        <MetricHistoryPage onBack={() => undefined} />
      </AnalyticsContext.Provider>
    </LifeLocaleContext.Provider>,
  );
}
const cold = { data: null, loading: false, error: null };
const RU_ONLY = /[ыэъё]/i;

describe('Metric History · cold entry (audit D2)', () => {
  it('loads on a cold entry only, never duplicating a load or re-reading a loaded month', () => {
    expect(needsFinanceLoad({ ready: true, finance: cold })).toBe(true);
    expect(needsFinanceLoad({ ready: false, finance: cold })).toBe(false);
    expect(needsFinanceLoad({ ready: true, finance: { ...cold, loading: true } })).toBe(false);
    expect(needsFinanceLoad({ ready: true, finance: { data: month, loading: false, error: null } })).toBe(false);
    /* A failed read waits for the explicit retry; it is not re-requested in a loop. */
    expect(needsFinanceLoad({ ready: true, finance: { ...cold, error: new Error('x') } })).toBe(false);
  });

  it('tells loading, error, empty and history apart', () => {
    expect(metricHistoryView({ ready: false, finance: cold })).toBe('loading');
    expect(metricHistoryView({ ready: true, finance: cold })).toBe('loading');
    expect(metricHistoryView({ ready: true, finance: { ...cold, loading: true } })).toBe('loading');
    expect(metricHistoryView({ ready: true, finance: { ...cold, error: new Error('x') } })).toBe('error');
    expect(metricHistoryView({ ready: true, finance: { data: emptyMonth, loading: false, error: null } })).toBe('empty');
    expect(metricHistoryView({ ready: true, finance: { data: month, loading: false, error: null } })).toBe('history');
    // A background refresh keeps showing the month already on screen.
    expect(metricHistoryView({ ready: true, finance: { data: month, loading: true, error: null } })).toBe('history');
  });

  for (const locale of ['ru', 'uk']) {
    const t = LifeMakeT(locale);

    it(`${locale}: a cold entry shows loading, not «unavailable»`, () => {
      const html = render(contextValue(cold), locale);
      expect(html).toContain(t('aa_mh_loading'));
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain('История метрики пока недоступна');
    });

    it(`${locale}: a failed load says so and offers a retry`, () => {
      const html = render(contextValue({ ...cold, error: new Error('boom') }), locale);
      expect(html).toContain(t('aa_mh_error'));
      expect(html).toContain(t('aa_mh_retry'));
      expect(html).toContain('role="alert"');
    });

    it(`${locale}: an empty month is a truthful empty state`, () => {
      const html = render(contextValue({ data: emptyMonth, loading: false, error: null }), locale);
      expect(html).toContain(t('aa_mh_empty'));
      expect(html).not.toContain(t('aa_mh_loading'));
    });

    it(`${locale}: header, subtitle, back and chart are localized; the metric id is kept`, () => {
      const html = render(contextValue({ data: month, loading: false, error: null }), locale);
      expect(html.replace(/<wbr\/?>/g, '')).toContain(t('aa_mh_title', 'finance.monthly_spend'));
      expect(html).toContain(t('aa_mh_subtitle'));
      expect(html).toContain(`>${t('aa_mh_back')}</button>`);
      expect(html).toContain(t('aa_chart_label'));
      expect(html).toMatch(/finance\.(<wbr\/?>)?monthly_spend/);
      if (locale === 'uk') {
        expect(html).not.toMatch(RU_ONLY);
        for (const state of [cold, { ...cold, error: new Error('x') }, { data: emptyMonth, loading: false, error: null }]) {
          expect(render(contextValue(state), 'uk')).not.toMatch(RU_ONLY);
        }
      }
    });
  }

  it('shows the retention horizon as a localized calendar date, never raw ISO or shifted', () => {
    const data = { ...month, retention_horizon: '2024-09-01' };
    const ru = render(contextValue({ data, loading: false, error: null }), 'ru');
    const uk = render(contextValue({ data, loading: false, error: null }), 'uk');
    expect(ru).not.toContain('2024-09-01');
    expect(uk).not.toContain('2024-09-01');
    expect(ru).toMatch(/История до 1 сент\. 2024/);
    expect(uk).toMatch(/Історію до 1 вер\. 2024/);
    expect(ru).not.toMatch(/31 авг/);
    expect(uk).not.toMatch(/31 серп/);
  });
});
