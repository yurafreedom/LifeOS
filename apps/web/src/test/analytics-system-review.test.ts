import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

import {
  cleanPayload,
  currentMonthKey,
  financeContextDeleteRequest,
  financeContextRequest,
  importanceRequest,
  isHypothesis,
  parseSystemReviewHash,
  periodStarted,
  proposalResponseRequest,
  RELATION_TYPES,
  relationCreateRequest,
  relationDeleteRequest,
  relationFeedbackRequest,
  revisionHash,
  revisionRequest,
  shiftPeriod,
  systemReviewHash,
  waitingHash,
} from '../analytics/systemReviewFacts';
import { pendingSystemReviewRecords } from '../analytics/systemReviewQueue';
import { revisionExportPath } from '../api/analytics';
import { ApiError, NetworkError } from '../api/client';
import { readRouteFromHash } from '../app/routeRegistry.js';
import { pendingIndex } from '../pages/analytics/SystemReviewPage.jsx';
import { filterRelations } from '../pages/analytics/system/Relations.jsx';
import { AnalyticsSyncCoordinator } from '../repositories/analyticsSyncCoordinator';
import { AnalyticsWriteQueue } from '../repositories/analyticsWriteQueue';
import type { AnalyticsRepository } from '../repositories/analyticsRepository';
import { StateSyncCoordinator } from '../repositories/stateSyncCoordinator';
import type { LifeOsState, StateRepository } from '../repositories/stateRepository';

const UUID = '6f1c1a8e-3b6d-4c0a-8f3e-2d4b5a6c7d8e';
const KEY = 'a'.repeat(64);

describe('System Review request builders', () => {
  it('S7-01 · a user link defaults to «related» with an optional trimmed note', () => {
    const request = relationCreateRequest({ fromKey: 'subject|finance:transaction:t1', toKey: 'change|x', id: UUID, note: '  совпало  ', period: '2026-09' });
    expect(request).toEqual({
      operation_type: 'relation.create',
      route: '/api/v1/aa/relations',
      payload: { id: UUID, from_key: 'subject|finance:transaction:t1', to_key: 'change|x', relation_type: 'related', note: 'совпало', period: '2026-09' },
    });
    expect(relationCreateRequest({ fromKey: 'a|b', toKey: 'c|d', id: UUID }).payload.note).toBeNull();
    expect(() => relationCreateRequest({ fromKey: 'a|b', toKey: 'a|b', id: UUID })).toThrow();
  });

  it('S7-10 · the vocabulary has no causal option; hypotheses are marked', () => {
    expect(RELATION_TYPES).toHaveLength(10);
    for (const causal of ['caused', 'causes', 'caused_by', 'definitely_caused_by', 'leads_to']) {
      expect(RELATION_TYPES).not.toContain(causal);
      expect(() => relationCreateRequest({ fromKey: 'a|b', toKey: 'c|d', relationType: causal, id: UUID })).toThrow();
    }
    expect(RELATION_TYPES.filter(isHypothesis)).toEqual(['may_contribute_to', 'may_increase_risk_of', 'may_reduce_probability_of']);
  });

  it('builds every Slice 7 queue operation with a fixed AA route and no key of its own', () => {
    const requests = [
      proposalResponseRequest({ proposal_key: KEY, period: '2026-09' }, 'unsure', '2026-10-01T00:00:00Z', ''),
      relationFeedbackRequest(UUID, 'rejected', ' нет '),
      relationDeleteRequest(UUID),
      importanceRequest('change|x', 'matters'),
      financeContextRequest({ kind: 'obligation', entityId: UUID, payload: { label: ' Карта ', currency: 'UAH', outstanding: '100', planned_payoff_date: '' } }),
      financeContextDeleteRequest(UUID),
      revisionRequest('2026-09', { baseRevision: 2, finalize: true, reflection: ' вывод ', noConclusion: false, decisions: [' a ', ''], adjustments: [] }),
    ];
    expect(requests.map(r => r.operation_type)).toEqual([
      'relation.respond', 'relation.feedback', 'relation.delete', 'importance.set',
      'finance_context.append', 'finance_context.delete', 'system_review.revision',
    ]);
    for (const request of requests) {
      expect(request.route.startsWith('/api/v1/aa/')).toBe(true);
      expect(request.payload.idempotency_key).toBeUndefined();
    }
    expect(requests[0].payload).toMatchObject({ proposal_key: KEY, response: 'unsure', note: null, period: '2026-09' });
    expect(requests[1].payload).toEqual({ response: 'rejected', note: 'нет' });
    expect(requests[4].payload.payload).toEqual({ label: 'Карта', currency: 'UAH', outstanding: '100' });
    expect(requests[6].payload).toMatchObject({ base_revision: 2, finalize: true, reflection: 'вывод', decisions: ['a'] });
    expect(revisionRequest('2026-09', { baseRevision: null, finalize: false, reflection: 'x', noConclusion: true }).payload.reflection).toBeNull();
    expect(() => importanceRequest('x|y', '5' as never)).toThrow();
    expect(() => proposalResponseRequest({ proposal_key: 'short', period: '2026-09' }, 'approved', 'now')).toThrow();
    expect(cleanPayload({ a: '', b: null, c: ' x ', d: 0 })).toEqual({ c: 'x', d: 0 });
  });

  it('keeps self-check answers as given (unknown and prefer-not are real answers)', () => {
    const request = financeContextRequest({ kind: 'self_check', entityId: UUID, subjectKey: 'finance:period:2026-09', payload: { answers: { q_know_total: 'prefer_not' } } });
    expect(request.payload.payload).toEqual({ answers: { q_know_total: 'prefer_not' } });
  });
});

describe('System Review routing and periods', () => {
  const now = new Date('2026-10-15T09:00:00Z');

  it('parses its own hash grammar and dispatches the route', () => {
    expect(parseSystemReviewHash('#/system-review', now)).toEqual({ view: 'review', period: '2026-10', tab: 'review' });
    expect(parseSystemReviewHash('#/system-review/2026-09')).toEqual({ view: 'review', period: '2026-09', tab: 'review' });
    expect(parseSystemReviewHash('#/system-review/2026')).toEqual({ view: 'review', period: '2026', tab: 'review' });
    expect(parseSystemReviewHash('#/system-review/2026-09/tradeoff')).toEqual({ view: 'review', period: '2026-09', tab: 'tradeoff' });
    expect(parseSystemReviewHash('#/system-review/2026-09/revisions/3')).toEqual({ view: 'revision', period: '2026-09', revision: 3 });
    expect(parseSystemReviewHash('#/system-review/waiting')).toEqual({ view: 'waiting' });
    for (const bad of ['#/system-review/2026-13', '#/system-review/2026-09/revisions/0', '#/system-review/x', '#/review/2026-09']) {
      expect(parseSystemReviewHash(bad)).toBeNull();
    }
    expect(readRouteFromHash('#/system-review/2026-09/tradeoff')).toBe('system-review');
    expect(readRouteFromHash('#/system-review')).toBe('system-review');
    expect(systemReviewHash('2026-09', 'tradeoff')).toBe('#/system-review/2026-09/tradeoff');
    expect(revisionHash('2026-09', 2)).toBe('#/system-review/2026-09/revisions/2');
    expect(waitingHash()).toBe('#/system-review/waiting');
  });

  it('moves between months and years; the future is not reachable', () => {
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
    expect(shiftPeriod('2026', -1)).toBe('2025');
    expect(currentMonthKey(new Date('2026-09-30T21:30:00Z'))).toBe('2026-10');  // Kyiv is already October
    expect(periodStarted('2026-10', now)).toBe(true);
    expect(periodStarted('2026-11', now)).toBe(false);
    expect(periodStarted('2027', now)).toBe(false);
    expect(revisionExportPath('2026-09', 1, 'pdf', 'uk')).toBe('/api/v1/aa/system-reviews/2026-09/revisions/1/export?format=pdf&locale=uk');
    expect(() => revisionExportPath('2026-09', 1, 'exe' as never, 'ru')).toThrow();
  });
});

describe('pending queue records are shown as pending, never as counted', () => {
  it('indexes unacknowledged answers, links and saves', () => {
    const records = [
      { queue_id: 1, state: 'pending', operation_type: 'relation.respond', route: '/api/v1/aa/relations/proposals/respond', payload: { proposal_key: KEY, response: 'approved' } },
      { queue_id: 2, state: 'failed_permanent', operation_type: 'importance.set', route: '/api/v1/aa/importance', payload: { target_key: 'change|x', importance: 'ok' } },
      { queue_id: 3, state: 'pending', operation_type: 'relation.delete', route: `/api/v1/aa/relations/${UUID}/delete`, payload: {} },
      { queue_id: 4, state: 'pending', operation_type: 'system_review.revision', route: '/api/v1/aa/system-reviews/2026-09/revisions', payload: { finalize: true } },
      { queue_id: 5, state: 'pending', operation_type: 'measurement.append', route: '/api/v1/aa/measurements', payload: {} },
    ];
    const mine = pendingSystemReviewRecords(records);
    expect(mine.map(r => r.queue_id)).toEqual([1, 2, 3, 4]);
    const index = pendingIndex(mine) as unknown as {
      responses: Record<string, string>; importance: Record<string, string>; deletes: Set<string>;
      revisions: Record<string, unknown>; failures: Array<{ queue_id: number }>;
    };
    expect(index.responses[KEY]).toBe('approved');
    expect(index.importance['change|x']).toBe('ok');
    expect(index.deletes.has(UUID)).toBe(true);
    expect(index.revisions['2026-09']).toEqual({ finalize: true });
    expect(index.failures.map((r: { queue_id: number }) => r.queue_id)).toEqual([2]);
  });

  it('S7-35 · filters relations by type, status, source, domain and importance', () => {
    const relation = (id: string, over: Record<string, unknown>) => ({
      id, relation_type: 'related', status: 'approved', source: 'user',
      from: { key: 'a', domain: 'finance' }, to: { key: 'b', domain: 'finance' }, ...over,
    });
    const rows = [
      relation('1', {}),
      relation('2', { relation_type: 'may_contribute_to', source: 'rule', status: 'unsure' }),
      relation('3', { status: 'rejected', source: 'rule', to: { key: 'c', domain: 'observation' } }),
    ];
    const importance = { 'relation|1': { importance: 'matters' } };
    const ids = (filters: Record<string, string>) => filterRelations(rows, { type: '', status: '', source: '', domain: '', importance: '', ...filters }, importance).map((r: { id: string }) => r.id);
    expect(ids({})).toEqual(['1', '2', '3']);
    expect(ids({ type: 'may_contribute_to' })).toEqual(['2']);
    expect(ids({ status: 'rejected' })).toEqual(['3']);
    expect(ids({ source: 'user' })).toEqual(['1']);
    expect(ids({ domain: 'observation' })).toEqual(['3']);
    expect(ids({ importance: 'matters' })).toEqual(['1']);
    expect(ids({ importance: 'undecided' })).toEqual(['2', '3']);
  });
});

function createQueue(name: string, keys: string[] = []) {
  let index = 0;
  return new AnalyticsWriteQueue(new IDBFactory(), () => keys[index++] ?? `k-${name}-${index}`, name);
}

function repository(send: (record: never) => Promise<unknown>) {
  return { replayQueuedWrite: vi.fn(send) } as unknown as AnalyticsRepository;
}

describe('Slice 7 writes ride the existing durable queue unchanged', () => {
  it('S7-45/46 · the key is minted once at enqueue and a retry reuses it (no duplicate)', async () => {
    let now = 1_000;
    const queue = createQueue('sr-retry', ['relation-key']);
    const request = relationCreateRequest({ fromKey: 'a|b', toKey: 'c|d', id: UUID });
    await queue.enqueue({ user_id: 'u', operation_type: request.operation_type, route: request.route, payload: request.payload });
    const server = new Map<string, number>();
    let fail = true;
    const repo = repository(async record => {
      const key = (record as { idempotency_key: string }).idempotency_key;
      server.set(key, (server.get(key) ?? 0) + 1);
      if (fail) { fail = false; throw new NetworkError(new Error('lost ack')); }
    });
    const coordinator = new AnalyticsSyncCoordinator('u', queue, repo, { locks: null, now: () => now, schedule: () => null, cancelSchedule: () => {} });
    await coordinator.flush();
    now += 5_000;
    await coordinator.flush();
    expect([...server.keys()]).toEqual(['relation-key']);
    expect(await queue.list('u')).toEqual([]);
  });

  it('a refused answer blocks the head instead of being dropped (FIFO, visible)', async () => {
    const queue = createQueue('sr-head');
    for (const request of [importanceRequest('change|x', 'ok'), relationDeleteRequest(UUID)]) {
      await queue.enqueue({ user_id: 'u', operation_type: request.operation_type, route: request.route, payload: request.payload });
    }
    const sent: string[] = [];
    await new AnalyticsSyncCoordinator('u', queue, repository(async record => {
      sent.push((record as { operation_type: string }).operation_type);
      throw new ApiError(422, 'invalid_importance', 'no');
    }), { locks: null }).flush();
    expect(sent).toEqual(['importance.set']);
    const rows = await queue.list('u');
    expect(rows.map(r => [r.operation_type, r.state])).toEqual([
      ['importance.set', 'failed_permanent'], ['relation.delete', 'pending'],
    ]);
  });

  it('S7-47/48 · snapshot 409 cannot freeze Slice 7 writes, and their failure cannot freeze the snapshot', async () => {
    const queue = createQueue('sr-t12');
    const answer = proposalResponseRequest({ proposal_key: KEY, period: '2026-09' }, 'approved', '2026-10-01T00:00:00Z');
    await queue.enqueue({ user_id: 'u', operation_type: answer.operation_type, route: answer.route, payload: answer.payload });
    const conflict = vi.fn().mockRejectedValue(new ApiError(409, 'revision_conflict', 'snapshot conflict', { current_revision: 2 }));
    const snapshot = new StateSyncCoordinator({
      repository: { load: vi.fn(), replace: conflict, reset: conflict } as StateRepository,
      initialRevision: 1, onStatus: vi.fn(), onSessionExpired: vi.fn(), debounceMs: 1,
    });
    snapshot.enqueue({ version: 2 } as LifeOsState);
    await snapshot.flushNow();
    const aa = repository(async () => undefined);
    await new AnalyticsSyncCoordinator('u', queue, aa, { locks: null }).flush();
    expect(aa.replayQueuedWrite).toHaveBeenCalledOnce();
    expect(await queue.list('u')).toEqual([]);

    const failing = createQueue('sr-t12-inverse');
    const save = revisionRequest('2026-09', { baseRevision: 0, finalize: false });
    await failing.enqueue({ user_id: 'u', operation_type: save.operation_type, route: save.route, payload: save.payload });
    await new AnalyticsSyncCoordinator('u', failing, repository(async () => {
      throw new ApiError(409, 'revision_conflict', 'stale base');
    }), { locks: null }).flush();
    expect((await failing.list('u'))[0].state).toBe('terminal_conflict');
    const healthy = vi.fn().mockResolvedValue({ schema_version: 2, revision: 2, payload: { version: 2 }, created_at: 'now', updated_at: 'now' });
    const state = new StateSyncCoordinator({
      repository: { load: vi.fn(), replace: healthy, reset: healthy } as StateRepository,
      initialRevision: 1, onStatus: vi.fn(), onSessionExpired: vi.fn(), debounceMs: 1,
    });
    state.enqueue({ version: 2 } as LifeOsState);
    await state.flushNow();
    expect(healthy).toHaveBeenCalledOnce();
    snapshot.dispose();
    state.dispose();
  });
});
