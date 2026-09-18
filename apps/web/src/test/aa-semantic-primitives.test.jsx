import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import variants from '../../../../tests/fixtures/aa_c_variants.json';
import AADelta from '../components/analytics/AADelta';
import AAFacts from '../components/analytics/AAFacts';
import AAProvenance from '../components/analytics/AAProvenance';
import AAQualityStrip from '../components/analytics/AAQualityStrip';
import AAHistoryList from '../components/analytics/AAHistoryList';
import { computeDelta, formatDelta, CategoricalComparisonError, IncompatibleUnitsError } from '../analytics/delta';
import { decimalText, decimalUnits, formatValue, InvalidValueError, validateValue } from '../analytics/values';

const provenance = { source_kind: 'USER_REPORTED', recorded_at: '2026-09-18T10:00:00Z',
  basis: 'explicit input', method: 'manual', source_ref: null, original_recorded_at_known: true };
const coverage = { window_start: '2026-08-01', window_end: '2026-08-31', timezone: 'Europe/Kyiv',
  denominator_basis: 'calendar_days', expected_denominator: 31, observed_count: 21,
  partial_count: 10, missing_count: 0, unknown_coverage_count: 0, future_count: 0,
  estimated_count: 1, corrected_count: 0, freshest_recorded_at: provenance.recorded_at,
  has_legacy_imports: false, reason: null };
function fact(id, concept, value) {
  const common = { id, subject_key: 'finance:period:2026-08',
    metric_key: 'finance.transaction_amount', value, value_type: value?.type || 'money',
    dimensions: null, provenance, status: 'active', supersedes_id: null,
    superseded_by_id: null, superseded_at: null, supersede_kind: null, supersede_reason: null,
    effective_from: null, horizon_at: null, window_start: null, window_end: null,
    timezone: null, occurred_at: null, occurred_tz: null, is_explicitly_absent: null,
    desired_direction: null, statement: null, epistemic_kind: null, value_availability: null };
  if (concept === 'actual') return { id, metric_key: common.metric_key, subject_key: common.subject_key,
    subject_domain: 'finance', subject_type: 'period', subject_id: '2026-08', value, dimensions: null,
    occurred_at: '2026-08-14T10:00:00Z', occurred_tz: 'Europe/Kyiv', provenance,
    status: 'active', supersedes_id: null, superseded_by_id: null, superseded_at: null,
    supersede_kind: null, supersede_reason: null };
  const tables = { expectation: 'aa_expectation_versions', forecast: 'aa_forecast_versions',
    baseline: 'aa_baselines', target: 'aa_targets', preference: 'aa_preferences', observation: 'aa_observations' };
  return { ...common, concept, fact_table: tables[concept],
    ...(concept === 'expectation' || concept === 'preference' ? { effective_from: '2026-08-01T00:00:00Z' } : {}),
    ...(['expectation', 'baseline', 'target'].includes(concept) ? { window_start: '2026-08-01', window_end: '2026-08-31', timezone: 'Europe/Kyiv' } : {}),
    ...(concept === 'forecast' ? { horizon_at: '2026-08-31T21:00:00Z' } : {}),
    ...(concept === 'target' ? { desired_direction: 'lower', is_explicitly_absent: false } : {}),
    ...(concept === 'observation' ? { occurred_at: '2026-08-01T00:00:00Z', occurred_tz: 'Europe/Kyiv', epistemic_kind: 'unknown', value_availability: 'present' } : {}) };
}

describe('frozen C gallery — shared fixture inputs also exercised through the backend API', () => {
  it.each(variants)('$name renders API-referenced typed values and the derived result', variant => {
    const summary = { subject_key: 'finance:period:2026-08', as_of: provenance.recorded_at,
      truncated: false, actual: [], expectations: [], forecasts: [], baselines: [],
      targets: [], preferences: [], observations: [], comparisons: [] };
    const layer = { actual: 'actual', expectation: 'expectations', baseline: 'baselines',
      forecast: 'forecasts', observation: 'observations' };
    const referenceId = '00000000-0000-4000-8000-000000000001';
    const currentId = '00000000-0000-4000-8000-000000000002';
    if (variant.reference) summary[layer[variant.reference_concept]].push(fact(referenceId, variant.reference_concept, variant.reference));
    if (variant.current) summary[layer[variant.current_concept]].push(fact(currentId, variant.current_concept, variant.current));
    if (variant.target_absent) summary.targets.push({ ...fact('00000000-0000-4000-8000-000000000003', 'target', null), is_explicitly_absent: true });
    const metric = variant.reference?.type === 'money' ? 'finance.transaction_amount' : variant.reference?.type === 'date' ? 'project.completion_date' : null;
    const subjectKey = metric === 'project.completion_date' ? 'project:project:p01' : summary.subject_key;
    summary.subject_key = subjectKey;
    for (const name of Object.values(layer).concat('targets')) {
      for (const row of summary[name]) {
        row.metric_key = metric; row.subject_key = subjectKey;
        if (name === 'actual' && metric === 'project.completion_date') Object.assign(row, { subject_domain: 'project', subject_type: 'project', subject_id: 'p01' });
      }
    }
    const comparison = { metric_key: metric, current_concept: variant.current_concept,
      current_id: variant.current ? currentId : null, reference_concept: variant.reference_concept,
      reference_id: variant.reference ? referenceId : null, availability: variant.partial ? 'insufficient_data' : variant.current ? 'present' : 'no_data',
      delta: { type: null, num: null, unit_code: null, scale_min: null, scale_max: null, reason: null, ...variant.delta }, desire: 'neutral', grounding_id: null, grounding_kind: null,
      coverage: variant.partial ? coverage : null };
    summary.comparisons.push(comparison);
    const html = renderToStaticMarkup(<AADelta summary={summary} comparison={comparison} narrow />);
    expect(html).toContain(variant.render);
    if (variant.current) expect(html).toContain(formatValue(variant.current));
    expect(html).not.toContain('data-desire="favorable"');
    expect(html).not.toContain('data-desire="unfavorable"');
    if (variant.partial) {
      expect(html).toContain('is-estimate'); expect(html).toContain('21 из 31');
      expect(html).not.toContain('−₴20,100');
    }
    if (variant.current_concept === 'forecast') {
      expect(html).toContain('прогноз'); expect(html).not.toContain('>факт<');
    }
    if (variant.target_absent) expect(html).toContain('цель не задавалась');
    if (!variant.current) expect(html).toContain('нет данных');
    if (variant.reference && !variant.partial) {
      const result = computeDelta(variant.current, variant.reference);
      expect(result.state).toBe(variant.delta.state);
      expect(decimalUnits(result.num)).toBe(decimalUnits(variant.delta.num));
    }
  });
});

describe('value legality mirrors the server without implicit conversions', () => {
  const money = (num, unit_code = 'UAH') => ({ type: 'money', num, unit_code });
  it('does exact six-place subtraction and preserves a real zero', () => {
    expect(computeDelta(money('0.3'), money('0.2')).num).toBe('0.1');
    expect(computeDelta(money('99999999999999.999999'), money('99999999999999.999998')).num).toBe('0.000001');
    expect(validateValue(money('0')).num).toBe('0');
    expect(decimalText(decimalUnits('-1.123456'))).toBe('-1.123456');
    expect(validateValue(money('1.0000000')).num).toBe('1.0000000');
    const large = computeDelta(money('99999999999999.999999'), money('-99999999999999.999999'));
    expect(formatDelta(large)).toBe('+₴199,999,999,999,999.999998');
  });
  it.each([
    [money('1'), money('1', 'USD')],
    [money('1'), { type: 'count', num: '1' }],
    [{ type: 'scale', num: '7', scale_min: '0', scale_max: '10' }, { type: 'scale', num: '7', scale_min: '1', scale_max: '10' }],
  ])('rejects an illegal pair %#', (current, reference) => {
    expect(() => computeDelta(current, reference)).toThrow(IncompatibleUnitsError);
  });
  it('categorical values stay juxtaposed without arithmetic', () => {
    expect(() => computeDelta({ type: 'categorical', text: 'low' }, { type: 'categorical', text: 'high' })).toThrow(CategoricalComparisonError);
  });
  it('absent operands produce only an unwritten derived no-answer', () => {
    expect(computeDelta(null, money('1'))).toEqual({ state: 'unknown', reason: 'operand_absent' });
    expect(computeDelta(money('1'), null).state).toBe('unknown');
  });
  it.each([
    { type: 'money', num: '1' }, { type: 'unknown' },
    { type: 'duration', num: '60', unit_code: 'hour' },
    { type: 'count', num: '1', unit_code: 'UAH' }, { type: 'categorical', text: ' ' },
    { type: 'scale', num: '11', scale_min: '0', scale_max: '10' },
    { type: 'date', date: '2026-02-30' }, { type: 'money', num: 'NaN', unit_code: 'UAH' },
    { type: 'count', num: '0.0000001' }, { type: 'count', num: '100000000000000' },
  ])('rejects malformed scalar %#', value => expect(() => validateValue(value)).toThrow(InvalidValueError));
  it('date subtraction is canonical minutes and duration subtraction stays minutes', () => {
    expect(computeDelta({ type: 'date', date: '2026-08-25' }, { type: 'date', date: '2026-08-20' })).toMatchObject({ type: 'duration', num: '7200', unit_code: 'minute' });
    expect(computeDelta({ type: 'duration', num: '402', unit_code: 'minute' }, { type: 'duration', num: '378', unit_code: 'minute' }).num).toBe('24');
  });
});

describe('secondary facts, provenance, quality and semantic history', () => {
  it('does not mislabel a stored Preference or erased fact as missing data', () => {
    const facts = [{ ...fact('preference', 'preference', null), statement: 'не работать после 00:30' },
      { ...fact('deleted', 'observation', null), status: 'tombstoned' }];
    const html = renderToStaticMarkup(<AAFacts facts={facts} />);
    expect(html).toContain('ориентир'); expect(html).toContain('не работать после 00:30');
    expect(html).toContain('удалено'); expect(html).not.toContain('нет данных');
    const actual = renderToStaticMarkup(<AAFacts facts={[fact('actual', 'actual', { type: 'count', num: '0' })]} />);
    expect(actual).toContain('>факт<');
  });
  it('AAFacts has no desire/delta semantics and keeps zero/absent/unknown separate', () => {
    const facts = [fact('zero', 'target', { type: 'count', num: '0' }),
      { ...fact('absent', 'target', null), is_explicitly_absent: true },
      { ...fact('unknown', 'observation', null), value_availability: 'explicitly_unknown', epistemic_kind: 'unknown' }];
    const html = renderToStaticMarkup(<AAFacts facts={facts} desire="favorable" delta="5" />);
    expect(html).toContain('>0<'); expect(html).toContain('не задавалась'); expect(html).toContain('не знаю');
    expect(html).not.toContain('data-desire'); expect(html).not.toContain('is-delta');
  });
  it('provenance retains the four-row grammar with honest imported recording uncertainty', () => {
    const html = renderToStaticMarkup(<AAProvenance provenance={{ ...provenance, original_recorded_at_known: false, basis: '<script>private</script>' }} narrow />);
    for (const label of ['источник', 'основание', 'когда', 'как']) expect(html).toContain(label);
    expect(html).toContain('момент первоначальной записи неизвестен');
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<details'); expect(html).toContain('<summary');
  });
  it('quality never labels unknown or future coverage as observed', () => {
    const html = renderToStaticMarkup(<AAQualityStrip coverage={{ ...coverage, has_legacy_imports: true, future_count: 3, unknown_coverage_count: 7, partial_count: 0 }} />);
    expect(html).toContain('покрытие неизвестно'); expect(html).toContain('будущие дни');
    expect(html).toContain('часть данных импортирована');
    expect(renderToStaticMarkup(<AAQualityStrip />)).toContain('покрытие неизвестно');
  });
  it('history labels revision vs correction and escapes content without inner HTML', () => {
    const first = { ...fact('first', 'forecast', { type: 'count', num: '1' }), status: 'superseded', supersede_kind: 'CORRECTION' };
    const next = { ...fact('next', 'forecast', { type: 'count', num: '2' }), supersedes_id: 'first', horizon_at: '2026-10-01T10:00:00Z' };
    const html = renderToStaticMarkup(<AAHistoryList facts={[first, next]} narrow />);
    expect(html).toContain('исправление: 1 → 2'); expect(html).toContain('проверяется');
    const unsafe = renderToStaticMarkup(<AAHistoryList facts={[{ ...next, statement: '<img src=x onerror=bad()>' }]} />);
    expect(unsafe).not.toContain('<img');
  });
  it('a supplied positive desire without a grounding ID is not rendered favorable', () => {
    const summary = { actual: [fact('a', 'actual', { type: 'count', num: '2' })], baselines: [fact('b', 'baseline', { type: 'count', num: '1' })], targets: [] };
    const comparison = { current_concept: 'actual', current_id: 'a', reference_concept: 'baseline', reference_id: 'b', delta: { state: 'known', type: 'count', num: '1' }, desire: 'favorable' };
    expect(renderToStaticMarkup(<AADelta summary={summary} comparison={comparison} />)).toContain('data-desire="neutral"');
    const grounded = { ...comparison, grounding_id: 't', grounding_kind: 'target' };
    expect(renderToStaticMarkup(<AADelta summary={summary} comparison={grounded} />)).toContain('data-desire="favorable"');
  });
});
