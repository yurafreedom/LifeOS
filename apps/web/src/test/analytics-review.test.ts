import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AAReviewContext, AAReviewItem } from '../api/analytics';
import {
  coverageFromItems,
  financeReviewWindow,
  newReviewHash,
  openReviewHash,
  parseReviewHash,
  projectReviewWindow,
  reviewReviseRequest,
  reviewSaveRequest,
} from '../analytics/review';
import { AnalyticsRepository } from '../repositories/analyticsRepository';
import { AnalyticsWriteQueue } from '../repositories/analyticsWriteQueue';

const REVIEW_ID = '8f14e45f-ceea-467a-9575-2c1f2f5c3a01';
const FINGERPRINT = 'b'.repeat(64);

function item(overrides: Partial<AAReviewItem>): AAReviewItem {
  return {
    ordinal: 1, section: 'compare', role: 'expected', label_key: 'expectation',
    metric_key: 'finance.monthly_spend', availability: 'present',
    value: { type: 'money', unit_code: 'UAH', num: '62345.670000' }, desire: null,
    epistemic_kind: null, estimate: false,
    provenance: { source_kind: 'USER_REPORTED', basis: null, method: null, recorded_at: '2026-08-01T08:00:00Z', original_recorded_at_known: true },
    redacted: false, source_state: null, source_flags: [], current_value: null,
    ...overrides,
  };
}

const context: AAReviewContext = {
  subject_key: 'finance:period:2026-08',
  window_start: '2026-08-01',
  window_end: '2026-08-31',
  timezone: 'Europe/Kyiv',
  context_as_of: '2026-09-28T13:00:00.123456Z',
  context_fingerprint: FINGERPRINT,
  manifest: { manifest_version: 1, subject_kind: 'finance_period', sections: [] },
  items: [
    item({}),
    item({ ordinal: 2, role: 'actual', label_key: 'actual', value: { type: 'money', unit_code: 'UAH', num: '61345.670000' } }),
  ],
};

describe('Review routing', () => {
  it('round-trips a new finance and project review through the hash', () => {
    const finance = newReviewHash('finance:period:2026-08', '2026-08-01', '2026-08-31');
    expect(finance).toBe('#/review/new/finance%3Aperiod%3A2026-08/2026-08-01/2026-08-31');
    expect(parseReviewHash(finance)).toEqual({
      mode: 'new', subject: 'finance:period:2026-08', from: '2026-08-01', to: '2026-08-31',
    });
    const project = newReviewHash('project:project:p1', '2026-08-11', '2026-08-25');
    expect(parseReviewHash(project)).toMatchObject({ mode: 'new', subject: 'project:project:p1' });
    expect(parseReviewHash(openReviewHash(REVIEW_ID))).toEqual({ mode: 'open', id: REVIEW_ID });
  });

  it('refuses subjects, windows and ids a Review does not support', () => {
    expect(() => newReviewHash('system:window:x', '2026-08-01', '2026-08-31')).toThrow(TypeError);
    expect(() => newReviewHash('project:project:p1', '2026-08-31', '2026-08-01')).toThrow(TypeError);
    expect(() => openReviewHash('not-a-uuid')).toThrow(TypeError);
    expect(parseReviewHash('#/review/new/finance%3Aperiod%3A2026-08/2026-02-30/2026-08-31')).toBeNull();
    expect(parseReviewHash('#/review/<script>')).toBeNull();
    expect(parseReviewHash('#/home')).toBeNull();
  });

  it('derives the finance month and the Kyiv-local project window', () => {
    expect(financeReviewWindow('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(financeReviewWindow('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    // 21:30 UTC on 10 Aug is 00:30 on 11 Aug in Kyiv (summer, +03) — IANA, not a fixed offset.
    expect(projectReviewWindow({ started_at: '2026-08-10T21:30:00Z', completed_at: '2026-08-25T12:00:00Z' }))
      .toEqual({ from: '2026-08-11', to: '2026-08-25' });
    // Winter: 22:30 UTC on 10 Jan is 00:30 on 11 Jan in Kyiv (+02).
    expect(projectReviewWindow({ started_at: '2027-01-10T22:30:00Z', completed_at: '2027-01-20T10:00:00Z' }).from)
      .toBe('2027-01-11');
  });
});

describe('Review save payload', () => {
  it('an empty Review carries only the context reference — no frozen value ever', () => {
    const request = reviewSaveRequest(context, {});
    expect(request).toMatchObject({ operation_type: 'review.save', route: '/api/v1/aa/reviews' });
    expect(Object.keys(request.payload).sort()).toEqual([
      'context_as_of', 'context_fingerprint', 'subject', 'timezone', 'window_end', 'window_start',
    ]);
    expect(request.payload.subject).toEqual({ domain: 'finance', type: 'period', id: '2026-08' });
    const encoded = JSON.stringify(request.payload);
    expect(encoded).not.toContain('62345');
    expect(encoded).not.toContain('61345');
  });

  it('keeps skipped, undecided and inconclusive decisions distinct', () => {
    expect(reviewSaveRequest(context, { decision: undefined }).payload).not.toHaveProperty('decision');
    expect(reviewSaveRequest(context, { decision: null }).payload.decision).toEqual({ choice: null });
    expect(reviewSaveRequest(context, { decision: 'inconclusive' }).payload.decision)
      .toEqual({ choice: 'inconclusive' });
    // @ts-expect-error — outside the review vocabulary
    expect(() => reviewSaveRequest(context, { decision: 'reject' })).toThrow(TypeError);
  });

  it('omits blank text and blank factors, and keeps each factor kind', () => {
    const request = reviewSaveRequest(context, {
      note: '   ',
      factors: [
        { key: 'a', text: '  Аудит  ', epistemic_kind: 'observed' },
        { key: 'b', text: ' ', epistemic_kind: 'maybe' },
        { key: 'c', text: 'Причина неизвестна', epistemic_kind: 'unknown' },
      ],
    });
    expect(request.payload).not.toHaveProperty('note_text');
    expect(request.payload.factors).toEqual([
      { text: 'Аудит', epistemic_kind: 'observed' },
      { text: 'Причина неизвестна', epistemic_kind: 'unknown' },
    ]);
  });

  it('builds a revision only when something is appended', () => {
    expect(reviewReviseRequest(REVIEW_ID, { note: ' ' })).toBeNull();
    const request = reviewReviseRequest(REVIEW_ID, {
      retractFactorIds: ['f1', 'f1'],
      addFactors: [{ key: 'x', text: 'Аудит', epistemic_kind: 'mine', replaces_id: 'f1' }],
      decision: null,
    });
    expect(request).toMatchObject({ operation_type: 'review.revise', route: `/api/v1/aa/reviews/${REVIEW_ID}/revise` });
    expect(request?.payload).toEqual({
      retract_factor_ids: ['f1'],
      add_factors: [{ text: 'Аудит', epistemic_kind: 'mine', replaces_id: 'f1' }],
      decision: { choice: null },
    });
  });
});

describe('Review evidence helpers', () => {
  it('rebuilds frozen coverage, and refuses to when a source was erased', () => {
    const coverage = [
      item({ ordinal: 5, section: 'quality', role: 'coverage', label_key: 'coverage.observed_count', value: { type: 'count', num: '28.000000' } }),
      item({ ordinal: 6, section: 'quality', role: 'coverage', label_key: 'coverage.expected_denominator', value: { type: 'count', num: '31.000000' } }),
      item({ ordinal: 7, section: 'quality', role: 'coverage', label_key: 'coverage.has_legacy_imports', value: { type: 'count', num: '1.000000' } }),
    ];
    expect(coverageFromItems(context.items)).toBeNull();
    expect(coverageFromItems(coverage)).toMatchObject({ observed_count: 28, expected_denominator: 31, has_legacy_imports: true });
    const erased = coverage.map(row => ({ ...row, redacted: true, value: null, availability: null }));
    expect(coverageFromItems(erased)).toBe('redacted');
  });
});

describe('Review durable write', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('queues the whole Review as one record and replays it as one POST', async () => {
    const queue = new AnalyticsWriteQueue(new IDBFactory(), () => 'review-key-0001', 'review-queue');
    const request = reviewSaveRequest(context, { note: 'Своими словами.', decision: 'keep' });
    const record = await queue.enqueue({ user_id: 'account-a', ...request });
    const [stored] = await queue.list('account-a');
    expect(stored.route).toBe('/api/v1/aa/reviews');
    expect(stored.payload).toMatchObject({ note_text: 'Своими словами.', idempotency_key: 'review-key-0001' });
    expect(JSON.stringify(stored.payload)).not.toContain('62345');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: REVIEW_ID }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    await new AnalyticsRepository().replayQueuedWrite(record);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/v1/aa/reviews');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ idempotency_key: 'review-key-0001', decision: { choice: 'keep' } });
    queue.close();
  });

  it('refuses an unbounded context read before touching the network', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const repository = new AnalyticsRepository();
    expect(() => repository.readReviewContext({ subject: 'finance:period:2026-08', from: '', to: '2026-08-31' }))
      .toThrow(TypeError);
    expect(() => repository.readReviewContext({ subject: 'finance', from: '2026-08-01', to: '2026-08-31' }))
      .toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads context with the explicit window and timezone', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(context), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await new AnalyticsRepository().readReviewContext({
      subject: 'finance:period:2026-08', from: '2026-08-01', to: '2026-08-31', timezone: 'Europe/Kyiv',
    });
    const [path] = fetchMock.mock.calls[0];
    expect(path).toBe(
      '/api/v1/aa/reviews/context?subject=finance%3Aperiod%3A2026-08&from=2026-08-01&to=2026-08-31&timezone=Europe%2FKyiv',
    );
  });
});
