import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AASignalCard, { signalClassName, signalCopy } from '../components/analytics/AASignalCard.jsx';
import { AnalyticsContext } from '../context/AnalyticsContext.jsx';
import { LifeLocaleContext, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { AnalyticsRepository } from '../repositories/analyticsRepository';

const FINGERPRINT = 'a'.repeat(64);

function signal(overrides = {}) {
  return {
    episode_key: 'finance.monthly_spend.threshold:1:finance:period:2026-08:band=80',
    rule_id: 'finance.monthly_spend.threshold',
    rule_version: 1,
    subject_domain: 'finance',
    subject_type: 'period',
    subject_id: '2026-08',
    subject_key: 'finance:period:2026-08',
    state: 'material',
    materiality: 'material',
    stakes: true,
    rendered_values: {
      period: '2026-08',
      band: 80,
      percent: 90,
      spend: '900',
      reference: '1000',
      unit_code: 'UAH',
      reference_kind: 'expectation',
      operation_count: 9,
      days_remaining: 3,
    },
    provenance: {
      source_kinds: ['IMPORTED', 'USER_REPORTED'],
      operation_count: 9,
      newest_recorded_at: '2026-08-28T08:40:00Z',
      derivation: 'SUM of 9 active included transaction fact(s) minus corrections',
      policy_known: true,
    },
    input_fingerprint: FINGERPRINT,
    first_seen_at: '2026-08-28T08:40:00Z',
    last_evaluated_at: '2026-08-28T08:40:00Z',
    acknowledged: false,
    acknowledged_at: null,
    reopened_count: 0,
    ...overrides,
  };
}

const forecastSignal = signal({
  episode_key: 'project.forecast.revision:1:project:project:p1:fv=f2',
  rule_id: 'project.forecast.revision',
  subject_domain: 'project',
  subject_type: 'project',
  subject_id: 'p1',
  subject_key: 'project:project:p1',
  state: 'normal',
  materiality: 'material',
  stakes: false,
  rendered_values: {
    from: '2026-08-24',
    to: '2026-08-26',
    revision_count: 3,
    recorded_at: '2026-08-16T10:00:00Z',
    horizon_at: '2026-08-26T00:00:00Z',
    value_type: 'date',
  },
  provenance: { derived_by: 'lifeos', forecast_version_count: 3, newest_recorded_at: '2026-08-16T10:00:00Z' },
});

const staleSignal = signal({
  episode_key: 'data.source.stale:1:finance:period:2026-08:IMPORTED:since=2026-08-17',
  rule_id: 'data.source.stale',
  state: 'stale',
  materiality: 'info',
  stakes: false,
  rendered_values: {
    source_kind: 'IMPORTED',
    days_stale: 9,
    newest_recorded_at: '2026-08-11T10:00:00Z',
    since: '2026-08-18',
    threshold_days: 7,
  },
  provenance: { source_kinds: ['IMPORTED'], newest_recorded_at: '2026-08-11T10:00:00Z', fact_count: 12 },
});

const partialSignal = signal({
  episode_key: 'coverage.window.partial:1:finance:period:2026-08:window=2026-08',
  rule_id: 'coverage.window.partial',
  state: 'partial',
  materiality: 'info',
  stakes: false,
  rendered_values: {
    window_id: '2026-08',
    observed: 21,
    elapsed: 28,
    expected_denominator: 31,
    partial_days: 0,
    missing_days: 0,
    unknown_coverage_days: 7,
    future_days: 3,
    percent: 75,
  },
  provenance: { window_id: '2026-08', observed: 21, denominator: 28, denominator_basis: 'calendar_days', claim_count: 1 },
});

const resolvedSignal = signal({ state: 'resolved', acknowledged: true, stakes: true, acknowledged_at: '2026-08-28T09:00:00Z' });

/** One locale in, one locale out: the provider is the card's only source. */
function render(node, locale = 'ru') {
  const t = LifeMakeT(locale);
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale, t, setLocale: () => {} }}>
      {typeof node === 'function' ? node(t) : node}
    </LifeLocaleContext.Provider>,
  );
}

/** `toLocaleString` separates thousands with a narrow no-break space. */
function ruMoney(amount) {
  return `₴${amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}

describe('AASignalCard · accepted visual states', () => {
  it('composes the frozen class list for every state without inventing one', () => {
    // Exactly the markup the frozen gallery uses for each case.
    expect(signalClassName(signal())).toBe('aa-signal is-material is-stakes');
    expect(signalClassName(forecastSignal)).toBe('aa-signal');
    expect(signalClassName(staleSignal)).toBe('aa-signal is-stale is-info');
    expect(signalClassName({ ...staleSignal, materiality: 'material' }))
      .toBe('aa-signal is-stale is-material');
    expect(signalClassName(partialSignal)).toBe('aa-signal is-partial is-info');
    expect(signalClassName({ ...partialSignal, materiality: 'material' }))
      .toBe('aa-signal is-partial is-material');
    expect(signalClassName(resolvedSignal)).toBe('aa-signal is-resolved');
  });

  it('never carries the warm accent unless the rule set stakes', () => {
    expect(signalClassName({ ...signal(), stakes: false })).not.toContain('is-stakes');
    // A material signal is a stronger hairline and a dark dot, not warm fill.
    expect(signalClassName({ ...forecastSignal, state: 'material' }))
      .toBe('aa-signal is-material');
    // An acknowledged card drops the accent even when the event was stakes.
    expect(signalClassName(resolvedSignal)).not.toContain('is-stakes');
  });

  it('renders all six states from real payload shapes', () => {
    const html = render((
      <div>
        {[signal(), forecastSignal, staleSignal, partialSignal, resolvedSignal].map(s => (
          <AASignalCard key={s.episode_key} signal={s} />
        ))}
        <AASignalCard signal={{ ...forecastSignal, materiality: 'info' }} />
      </div>
    ));
    for (const state of ['is-material', 'is-stakes', 'is-stale', 'is-partial', 'is-resolved']) {
      expect(html).toContain(state);
    }
    expect(html).toContain('data-state="normal"');
    expect(html).toContain('data-materiality="info"');
  });

  it('names materiality and state for assistive technology, not only in colour', () => {
    const html = render(<AASignalCard signal={staleSignal} />);
    expect(html).toContain('aa-sr-only');
    expect(html).toContain('информационный');
    // The stale/partial tags are text, so the dashed border is never the only cue.
    expect(html).toContain('данные устарели');
    expect(render(<AASignalCard signal={partialSignal} />))
      .toContain('частичные данные');
    expect(render(<AASignalCard signal={resolvedSignal} />))
      .toContain('просмотрено');
  });

  it('exposes provenance through the existing progressive-disclosure component', () => {
    const html = render(<AASignalCard signal={signal()} />);
    // The shared AAProvenance chip, not a second provenance component.
    expect(html).toContain('aa-prov-chip');
    expect(html).toContain('источник');
    // Detail stays inside the popover rather than cluttering the card.
    expect(html).toContain('IMPORTED · USER_REPORTED');
    expect(html).toContain('aa-prov-pop');
  });

  it('marks a derived interpretation as derived, not as an observation', () => {
    const html = render(<AASignalCard signal={forecastSignal} />);
    expect(html).toContain('DERIVED');
  });

  it('keeps the dismiss and open actions keyboard reachable as real buttons', () => {
    const html = render(<AASignalCard signal={signal()} onOpen={() => {}} onDismiss={() => {}} />);
    expect(html).toContain('<button type="button" class="aa-link"');
    expect(html).toContain('aa-link aa-link-quiet');
    expect(html).toContain('посмотреть контекст');
    expect(html).toContain('скрыть');
    expect(html).toContain('aria-label="системный сигнал');
  });

  it('offers no actions on an acknowledged card', () => {
    const html = render((t) => (
      <AASignalCard signal={resolvedSignal} onOpen={() => {}} onDismiss={() => {}} />
    ));
    expect(html).not.toContain('скрыть');
    expect(html).not.toContain('посмотреть контекст');
  });
});

describe('AASignalCard · copy is composed from values, never sent as copy', () => {
  it('renders the finance threshold sentence from the reported numbers', () => {
    const copy = signalCopy(signal(), LifeMakeT('ru'), 'ru');
    expect(copy.title).toBe('Расходы приблизились к ожиданию');
    expect(copy.from).toBe(ruMoney(1000));
    expect(copy.to).toBe(ruMoney(900));
    expect(copy.magnitude).toBe('осталось 3 дня');
    expect(copy.body).toBe('по вашему ожиданию на период');
  });

  it('names the reference the rule actually used', () => {
    const onTarget = signal({
      rendered_values: { ...signal().rendered_values, reference_kind: 'target' },
    });
    expect(signalCopy(onTarget, LifeMakeT('ru'), 'ru').body).toBe('по вашей цели на период');
  });

  it('titles each finance band distinctly', () => {
    const t = LifeMakeT('ru');
    const at = (band) => signalCopy(
      signal({ rendered_values: { ...signal().rendered_values, band } }), t, 'ru',
    ).title;
    expect(new Set([at(80), at(100), at(120)]).size).toBe(3);
  });

  it('states a forecast shift without judging its direction', () => {
    const copy = signalCopy(forecastSignal, LifeMakeT('ru'), 'ru');
    expect(copy.title).toBe('Прогноз сдвинулся');
    expect(copy.magnitude).toBe('+2 дня');
    // No «хуже», «отставание» or any other verdict: a later date is not bad.
    const html = render(<AASignalCard signal={forecastSignal} />);
    for (const verdict of ['хуже', 'лучше', 'плохо', 'отлично', 'отставание']) {
      expect(html).not.toContain(verdict);
    }
  });

  it('reads a first forecast as set rather than shifted', () => {
    const first = {
      ...forecastSignal,
      rendered_values: { ...forecastSignal.rendered_values, from: null, revision_count: 1 },
    };
    const copy = signalCopy(first, LifeMakeT('ru'), 'ru');
    expect(copy.title).toBe('Задан прогноз завершения');
    expect(copy.from).toBeNull();
    expect(copy.magnitude).toBeNull();
  });

  it('reports coverage against elapsed days and states the future ones', () => {
    const copy = signalCopy(partialSignal, LifeMakeT('ru'), 'ru');
    expect(copy.title).toBe('Покрыто 21 из 28 прошедших дней');
    // «future ≠ missing»: the three remaining days are named, never counted as a gap.
    expect(copy.body).toContain('Остальное не считаем нулями.');
    expect(copy.body).toContain('3 дня ещё не наступили.');
    expect(copy.title).not.toContain('31');
  });

  it('reports staleness in days since the newest record', () => {
    const copy = signalCopy(staleSignal, LifeMakeT('ru'), 'ru');
    expect(copy.title).toBe('Значение может быть неполным');
    expect(copy.body).toBe('Последняя запись — 9 дней назад.');
    expect(copy.timestamp).toBe('обновлено 9 дней назад');
  });

  it('carries no desirability anywhere in a rendered card', () => {
    const html = [signal(), forecastSignal, staleSignal, partialSignal]
      .map(s => render(<AASignalCard signal={s} />))
      .join('');
    for (const word in { favorable: 1, unfavorable: 1, desire: 1 }) {
      expect(html).not.toContain(word);
    }
    expect(html).not.toContain('желательн');
  });
});

describe('signal copy exists in both supported locales', () => {
  it('defines every aa_sig key in ru and uk, and enables no third locale', () => {
    const keys = Object.keys(LifeStrings.ru).filter(key => key.startsWith('aa_sig_'));
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      expect(LifeStrings.uk[key], `uk is missing ${key}`).toBeTruthy();
      // A Ukrainian entry that is byte-identical to Russian is an untranslated
      // placeholder, except where the term is genuinely the same.
      expect(typeof LifeStrings.uk[key]).toBe('string');
    }
    expect(Object.keys(LifeStrings)).toEqual(['ru', 'uk']);
  });

  it('renders the whole card in Ukrainian', () => {
    const html = render(
      <AASignalCard signal={signal()} onOpen={() => {}} onDismiss={() => {}} />,
      'uk',
    );
    expect(html).toContain('Витрати наблизилися до очікування');
    expect(html).toContain('сховати');
    expect(html).toContain('подивитися контекст');
    expect(html).toContain('фінанси');
    expect(html).not.toContain('скрыть');
  });

  it('localizes the zero state in both languages', () => {
    for (const locale of ['ru', 'uk']) {
      const t = LifeMakeT(locale);
      for (const key of ['aa_sig_zero_confident', 'aa_sig_zero_unknown', 'aa_sig_zero_no_data']) {
        expect(t(key)).not.toBe(key);
      }
    }
  });
});

describe('the ported stylesheet carries the signal states and no preview chrome', () => {
  const css = readFileSync(new URL('../analytics.css', import.meta.url), 'utf8');

  it('defines every state class the card can emit', () => {
    for (const rule of [
      '.aa-signal {',
      '.aa-signal.is-material',
      '.aa-signal.is-stakes',
      '.aa-signal.is-info',
      '.aa-signal.is-stale',
      '.aa-signal.is-partial',
      '.aa-signal.is-resolved',
      '.aa-none',
      '.aa-eyebrow',
      '.aa-sr-only',
    ]) {
      expect(css).toContain(rule);
    }
  });

  it('imports no preview rail, stage or device-frame styles', () => {
    for (const part of ['shell', 'rail', 'stage', 'phone', 'device', 'demo']) {
      expect(css).not.toContain(`aa-${part}`);
    }
  });

  it('respects reduced motion and mobile width', () => {
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('@media (max-width: 700px)');
  });
});

describe('Home integration', () => {
  const locale = { locale: 'ru', t: LifeMakeT('ru'), setLocale: () => {} };
  const data = { state: { transactions: [], categoryOverrides: {}, projects: [] } };

  function home(analytics, props = {}) {
    return renderToStaticMarkup(
      <LifeLocaleContext.Provider value={locale}>
        <LifeDataContext.Provider value={data}>
          <AnalyticsContext.Provider value={analytics}>
            <HomePage onNav={() => {}} {...props} />
          </AnalyticsContext.Provider>
        </LifeDataContext.Provider>
      </LifeLocaleContext.Provider>,
    );
  }

  function provider(report) {
    return {
      enabled: true,
      ready: true,
      signals: { data: report, loading: false, error: null, dismissing: null },
      loadSignals: () => Promise.resolve(report),
      acknowledgeSignal: () => Promise.resolve({}),
    };
  }

  it('places the signals section below the first ordinary panel row', () => {
    const html = home(provider({
      signals: [signal()], acknowledged: [], zero_state: 'confident', active_total: 1, limit: 3,
    }));
    const hero = html.indexOf('class="home-hero"');
    const signals = html.indexOf('home-signals');
    const charts = html.indexOf('class="home-charts"');
    expect(hero).toBeGreaterThan(-1);
    expect(signals).toBeGreaterThan(hero);
    expect(charts).toBeGreaterThan(signals);
  });

  it('renders the quiet eyebrow and never an alert-centre affordance', () => {
    const html = home(provider({
      signals: [signal()], acknowledged: [], zero_state: 'confident', active_total: 1, limit: 3,
    }));
    expect(html).toContain('системные сигналы');
    expect(html).toContain('aa-eyebrow');
    // No badge, no unread count, no "all notifications" entry point.
    for (const affordance of ['badge', 'unread', 'notification', 'все сигналы']) {
      expect(html.toLowerCase()).not.toContain(affordance);
    }
  });

  it('shows at most three cards even when the server reports more are active', () => {
    const many = [1, 2, 3].map(index => signal({
      episode_key: `rule:1:subject:band=${index}`,
    }));
    const html = home(provider({
      signals: many, acknowledged: [], zero_state: 'confident', active_total: 9, limit: 3,
    }));
    expect(html.split('<article class="aa-signal').length - 1).toBe(3);
  });

  it('renders the truthful zero state for each reason', () => {
    const confident = home(provider({ signals: [], acknowledged: [], zero_state: 'confident', active_total: 0, limit: 3 }));
    expect(confident).toContain('Ничего существенного не менялось');

    const unknown = home(provider({ signals: [], acknowledged: [], zero_state: 'unknown_coverage', active_total: 0, limit: 3 }));
    // Absence of cards over unvouched data must not read as reassurance.
    expect(unknown).toContain('полнота данных не подтверждена');
    expect(unknown).not.toContain('Ничего существенного не менялось');

    const none = home(provider({ signals: [], acknowledged: [], zero_state: 'no_data', active_total: 0, limit: 3 }));
    expect(none).toContain('Пока нет данных');
  });

  it('falls back to the honest no-data state before the first read returns', () => {
    const html = home(provider(null));
    expect(html).toContain('Пока нет данных');
    expect(html).not.toContain('Ничего существенного не менялось');
  });

  it('renders Home unchanged when analytics is unavailable', () => {
    const html = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={locale}>
        <LifeDataContext.Provider value={data}>
          <HomePage onNav={() => {}} />
        </LifeDataContext.Provider>
      </LifeLocaleContext.Provider>,
    );
    expect(html).toContain('class="home-hero"');
    expect(html).toContain('class="home-charts"');
    expect(html).not.toContain('home-signals');
  });

  it('shows no signals section in the empty-state demo mode', () => {
    const html = home(provider({
      signals: [signal()], acknowledged: [], zero_state: 'confident', active_total: 1, limit: 3,
    }), { emptyMode: true });
    expect(html).not.toContain('home-signals');
  });

  it('labels a project signal with the name the client already holds', () => {
    const withProject = {
      state: { transactions: [], categoryOverrides: {}, projects: [{ id: 'p1', title: 'редизайн life os' }] },
    };
    const html = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={locale}>
        <LifeDataContext.Provider value={withProject}>
          <AnalyticsContext.Provider value={provider({
            signals: [forecastSignal], acknowledged: [], zero_state: 'confident', active_total: 1, limit: 3,
          })}>
            <HomePage onNav={() => {}} />
          </AnalyticsContext.Provider>
        </LifeDataContext.Provider>
      </LifeLocaleContext.Provider>,
    );
    expect(html).toContain('редизайн life os');
  });
});
