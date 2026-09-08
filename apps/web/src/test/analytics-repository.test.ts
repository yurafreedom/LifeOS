import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsRepository, assertValueIsWellShaped, subjectKey } from '../repositories/analyticsRepository';
import type { AAValue } from '../api/analytics';

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const MONEY: AAValue = { type: 'money', unit_code: 'UAH', num: '1200.00' };

const MEASUREMENT = {
  metric_key: 'finance.transaction_amount',
  subject: { domain: 'finance', type: 'transaction', id: 't01' },
  value: MONEY,
  occurred_at: '2026-08-14T10:00:00+00:00',
  occurred_tz: 'Europe/Kyiv',
  provenance: { source_kind: 'USER_REPORTED' as const, basis: '1 операция' },
};

describe('analytics repository', () => {
  it('composes a subject key the way the server does', () => {
    expect(subjectKey({ domain: 'finance', type: 'period', id: '2026-08' })).toBe('finance:period:2026-08');
    // An account-scoped subject has an empty id rather than a missing one.
    expect(subjectKey({ domain: 'system', type: 'window' })).toBe('system:window:');
  });

  it('mints an idempotency key before the first attempt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'm1' }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const repository = new AnalyticsRepository(() => 'key-fixed-0001');

    await repository.recordMeasurement(MEASUREMENT);

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/v1/aa/measurements');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(JSON.parse(init.body as string).idempotency_key).toBe('key-fixed-0001');
  });

  it('reuses a caller-supplied key so a retry stays the same write', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ id: 'm1' }, 200)));
    vi.stubGlobal('fetch', fetchMock);
    const repository = new AnalyticsRepository(() => 'generated-key');

    await repository.recordMeasurement({ ...MEASUREMENT, idempotency_key: 'queued-key' });
    await repository.recordMeasurement({ ...MEASUREMENT, idempotency_key: 'queued-key' });

    const keys = fetchMock.mock.calls.map(call => JSON.parse((call[1] as RequestInit).body as string).idempotency_key);
    expect(keys).toEqual(['queued-key', 'queued-key']);
  });

  it('sends a correction to the correction path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ measurement: {}, superseded: {} }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const repository = new AnalyticsRepository(() => 'key-correct');

    await repository.correctMeasurement('m1', {
      value: { type: 'money', unit_code: 'UAH', num: '120.00' },
      reason: 'Сумма записана с лишним нулём',
      provenance: { source_kind: 'USER_REPORTED' },
    });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/aa/measurements/m1/correct');
  });

  it('requires an explicit range before reading history', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const repository = new AnalyticsRepository();

    expect(() => repository.readMetricHistory('finance.transaction_amount', { from: '', to: '' }))
      .toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes as-of and coverage bounds through to the query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ actual: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const repository = new AnalyticsRepository();

    await repository.readMetricHistory('finance.monthly_spend', {
      from: '2026-08-01T00:00:00+00:00',
      to: '2026-08-31T23:59:59+00:00',
      subject: 'finance:period:2026-08',
      asOf: '2026-08-20T08:40:00+00:00',
      coverageFrom: '2026-08-01',
      coverageTo: '2026-08-31',
      timezone: 'Europe/Kyiv',
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url.startsWith('/api/v1/aa/metrics/finance.monthly_spend/history?')).toBe(true);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('as_of')).toBe('2026-08-20T08:40:00+00:00');
    expect(params.get('coverage_from')).toBe('2026-08-01');
    expect(params.get('timezone')).toBe('Europe/Kyiv');
  });

  it('reads provenance for one fact', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ fact_table: 'aa_measurements' }));
    vi.stubGlobal('fetch', fetchMock);
    await new AnalyticsRepository().readFactProvenance('aa_measurements', 'm1');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/aa/facts/aa_measurements/m1/provenance');
  });

  it('rejects an impossible value before it reaches the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const repository = new AnalyticsRepository();

    await expect(repository.recordMeasurement({
      ...MEASUREMENT,
      value: { type: 'money', num: '10.00' },
    })).rejects.toBeInstanceOf(TypeError);
    await expect(repository.recordMeasurement({
      ...MEASUREMENT,
      value: { type: 'money', unit_code: 'UAH', num: '10.00', text: 'also text' },
    })).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts every legal value shape and no others', () => {
    expect(() => assertValueIsWellShaped({ type: 'money', unit_code: 'UAH', num: '0' })).not.toThrow();
    expect(() => assertValueIsWellShaped({ type: 'date', date: '2026-08-25' })).not.toThrow();
    expect(() => assertValueIsWellShaped({ type: 'duration', unit_code: 'minute', num: '45' })).not.toThrow();
    expect(() => assertValueIsWellShaped({ type: 'count', num: '3' })).not.toThrow();
    expect(() => assertValueIsWellShaped({ type: 'scale', num: '7', scale_min: '1', scale_max: '10' })).not.toThrow();
    expect(() => assertValueIsWellShaped({ type: 'categorical', text: 'низкая' })).not.toThrow();

    expect(() => assertValueIsWellShaped({ type: 'duration', unit_code: 'hour', num: '2' })).toThrow(TypeError);
    expect(() => assertValueIsWellShaped({ type: 'money', unit_code: 'uah', num: '1' })).toThrow(TypeError);
    // There is no way to spell "we do not know" as a value.
    expect(() => assertValueIsWellShaped({ type: 'unknown' as never })).toThrow(TypeError);
    expect(() => assertValueIsWellShaped({ type: 'money', unit_code: 'UAH' })).toThrow(TypeError);
  });
});
