import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import {
  EXPERIMENT_CHOICES,
  PENDING_LIFECYCLES,
  addDays,
  completionDue,
  experimentAdherenceRequest,
  experimentBaselineRequest,
  experimentConditionRequest,
  experimentCreateRequest,
  experimentDecisionRequest,
  experimentHash,
  experimentObservationRequest,
  experimentTransitionRequest,
  newExperimentHash,
  newExperimentId,
  outcomeValue,
  parseExperimentHash,
  pendingAdherenceKey,
  pendingExperimentRecords,
  windowEndFor,
  windowLength,
} from '../analytics/experimentFacts';
import { AnalyticsRepository } from '../repositories/analyticsRepository';
import { AnalyticsSyncCoordinator } from '../repositories/analyticsSyncCoordinator';
import { AnalyticsWriteQueue } from '../repositories/analyticsWriteQueue';

const ID = '7c1d0f7e-2b1a-4c1e-9a55-0d7f5b1c2e11';
const USER = 'account-a';

function createInput(id = ID) {
  return {
    id,
    title: ' Экран до 23:00 ',
    hypothesis: 'Если убрать экран, засыпаю быстрее.',
    hypothesisRecordedAt: '2026-09-30T09:00:00.000Z',
    intervention: 'Телефон в другой комнате.',
    windowStart: '2026-10-01',
    windowEnd: '2026-10-21',
    outcome: { label: 'Время засыпания', value_type: 'duration' as const, unit_code: 'minute' },
  };
}

function queue(name: string, factory = new IDBFactory()) {
  let index = 0;
  return new AnalyticsWriteQueue(factory, () => `key-${++index}`, name);
}

async function enqueueAll(target: AnalyticsWriteQueue, requests: ReturnType<typeof experimentCreateRequest>[]) {
  for (const request of requests) {
    await target.enqueue({ user_id: USER, ...request });
  }
}

const createThenChildren = () => [
  experimentCreateRequest(createInput()),
  experimentTransitionRequest(ID, 'RUNNING', '2026-10-01T06:00:00.000Z'),
  experimentAdherenceRequest(ID, '2026-10-01', 'kept'),
];

afterEach(() => vi.restoreAllMocks());

// ───────────────────── F1 · builders ─────────────────────

describe('experiment request builders', () => {
  it('address the client id, never mint a key and keep an explicit null choice', () => {
    const requests = [
      experimentCreateRequest(createInput()),
      experimentTransitionRequest(ID, 'ABANDONED', '2026-10-05T10:00:00.000Z'),
      experimentAdherenceRequest(ID, '2026-10-02', 'missed', 'prior-key'),
      experimentObservationRequest(ID, {
        role: 'outcome', label: 'Время засыпания', value: { type: 'duration', unit_code: 'minute', num: '25' },
        occurredAt: '2026-10-05T20:00:00.000Z',
      }),
      experimentBaselineRequest(ID, {
        value: { type: 'duration', unit_code: 'minute', num: '40' }, windowStart: '2026-09-01', windowEnd: '2026-09-30',
      }),
      experimentConditionRequest(ID, { text: 'Жара', epistemicKind: 'maybe', occurredAt: '2026-10-05T20:00:00.000Z' }),
      experimentDecisionRequest(ID, null),
    ];
    const [create, ...children] = requests;
    expect(create).toMatchObject({
      operation_type: 'experiment.create', route: '/api/v1/aa/experiments',
      payload: { id: ID, title: 'Экран до 23:00', timezone: 'Europe/Kyiv' },
    });
    for (const request of children) expect(request.route.startsWith(`/api/v1/aa/experiments/${ID}/`)).toBe(true);
    for (const request of requests) expect(request.payload).not.toHaveProperty('idempotency_key');
    const decision = requests[requests.length - 1];
    expect(decision.payload).toHaveProperty('choice', null);
    expect(Object.keys(decision.payload)).toContain('choice');
    expect(requests[2].payload).toMatchObject({ day: '2026-10-02', state: 'missed', supersedes_idempotency_key: 'prior-key' });
  });

  it('refuse a non-UUID id', () => {
    expect(() => experimentTransitionRequest('not-a-uuid', 'RUNNING', 'x')).toThrow(TypeError);
    expect(() => experimentCreateRequest(createInput('../../x'))).toThrow(TypeError);
  });

  it('mint a UUID v4 and refuse to fall back without crypto.randomUUID', () => {
    const id = newExperimentId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    vi.stubGlobal('crypto', {});
    expect(() => newExperimentId()).toThrow('A UUID v4 generator is required for durable analytics writes.');
    vi.unstubAllGlobals();
  });

  it('build outcome values in the defined shape and exactly five experiment choices', () => {
    expect(outcomeValue({ label: 'x', value_type: 'duration', unit_code: 'minute' }, '25,5'))
      .toEqual({ type: 'duration', unit_code: 'minute', num: '25.5' });
    expect(outcomeValue({ label: 'x', value_type: 'scale', scale_min: '1', scale_max: '10' }, '7'))
      .toEqual({ type: 'scale', num: '7', scale_min: '1', scale_max: '10' });
    expect(EXPERIMENT_CHOICES).toEqual(['keep', 'modify', 'longer', 'reject', 'inconclusive']);
    expect(EXPERIMENT_CHOICES).not.toContain('adjust');
    expect(PENDING_LIFECYCLES).toEqual(['DRAFT', 'RUNNING', 'COMPLETED_AWAITING_REVIEW']);
  });

  it('do date-only arithmetic without a zone', () => {
    expect(windowEndFor('2026-10-01', 21)).toBe('2026-10-21');
    expect(windowEndFor('2026-12-30', 4)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(windowLength('2026-10-01', '2026-10-21')).toBe(21);
  });
});

describe('experiment hashes', () => {
  it.each([
    ['#/experiment', { view: 'list' }],
    ['#/experiment/new', { view: 'new' }],
    [`#/experiment/${ID}`, { view: 'detail', id: ID }],
    [`#/experiment/${ID.toUpperCase()}`, { view: 'detail', id: ID }],
    ['#/experiment/not-a-uuid', { view: 'list' }],
    ['#/experiments', null],
    ['#/review/new', null],
  ])('%s', (hash, expected) => {
    expect(parseExperimentHash(hash)).toEqual(expected);
  });

  it('round-trip', () => {
    expect(parseExperimentHash(experimentHash(ID))).toEqual({ view: 'detail', id: ID });
    expect(parseExperimentHash(newExperimentHash())).toEqual({ view: 'new' });
  });
});

describe('repository reads', () => {
  it('validate the id and the list bounds before any request', () => {
    const repository = new AnalyticsRepository();
    expect(() => repository.readExperiment('../x')).toThrow(TypeError);
    expect(() => repository.listExperiments({ limit: 51 })).toThrow(RangeError);
    expect(() => repository.listExperiments({ lifecycles: ['PAUSED' as never] })).toThrow(TypeError);
  });
});

// ───────────────────── F2–F6 · the durable queue, unchanged ─────────────────────

describe('experiment writes on the durable queue', () => {
  it('F2 · children are queued before the create is acknowledged and replay in FIFO order', async () => {
    const target = queue('f2');
    await enqueueAll(target, createThenChildren());
    const records = await target.list(USER);
    expect(records.map(record => record.operation_type)).toEqual([
      'experiment.create', 'experiment.transition', 'experiment.adherence',
    ]);
    const sent: string[] = [];
    const coordinator = new AnalyticsSyncCoordinator(USER, target, {
      replayQueuedWrite: vi.fn(async record => { sent.push(record.route); }),
    }, { locks: null });
    await coordinator.flush();
    expect(sent).toEqual([
      '/api/v1/aa/experiments',
      `/api/v1/aa/experiments/${ID}/transition`,
      `/api/v1/aa/experiments/${ID}/adherence`,
    ]);
    expect(await target.list(USER)).toEqual([]);
  });

  it('F3 · a refused create blocks every child: nothing after it is sent', async () => {
    const target = queue('f3');
    await enqueueAll(target, createThenChildren());
    const replay = vi.fn(async () => { throw new ApiError(422, 'invalid_experiment', 'no'); });
    const coordinator = new AnalyticsSyncCoordinator(USER, target, { replayQueuedWrite: replay }, { locks: null });
    await coordinator.flush();
    await coordinator.flush();
    expect(replay).toHaveBeenCalledTimes(1);
    const records = await target.list(USER);
    expect(records.map(record => record.state)).toEqual(['failed_permanent', 'pending', 'pending']);
  });

  it('F4 · a 5xx create backs off, keeps its key, and children wait', async () => {
    let now = 1_000;
    const target = queue('f4');
    await enqueueAll(target, createThenChildren());
    const calls: string[] = [];
    let fail = true;
    const replay = vi.fn(async (record: { operation_type: string; idempotency_key: string }) => {
      calls.push(`${record.operation_type}:${record.idempotency_key}`);
      if (fail) throw new ApiError(503, 'unavailable', 'later');
    });
    const coordinator = new AnalyticsSyncCoordinator(USER, target, { replayQueuedWrite: replay as never }, {
      locks: null, now: () => now, schedule: () => undefined,
    });
    await coordinator.flush();
    expect(calls).toEqual(['experiment.create:key-1']);
    now = 2_000;
    fail = false;
    await coordinator.flush();
    expect(calls).toEqual([
      'experiment.create:key-1', 'experiment.create:key-1',
      'experiment.transition:key-2', 'experiment.adherence:key-3',
    ]);
  });

  it('F5 · discarding the failed create lets children replay into a visible 404 failure', async () => {
    const target = queue('f5');
    await enqueueAll(target, createThenChildren());
    const replay = vi.fn(async (record: { operation_type: string }) => {
      if (record.operation_type === 'experiment.create') throw new ApiError(422, 'invalid_experiment', 'no');
      throw new ApiError(404, 'experiment_not_found', 'Experiment not found.');
    });
    const coordinator = new AnalyticsSyncCoordinator(USER, target, { replayQueuedWrite: replay as never }, { locks: null });
    await coordinator.flush();
    const [head] = await target.list(USER);
    expect(await target.discard(USER, head.queue_id)).toBe(true);
    await coordinator.flush();
    const records = await target.list(USER);
    expect(records[0]).toMatchObject({
      operation_type: 'experiment.transition', state: 'failed_permanent', last_error_status: 404,
    });
    expect(records).toHaveLength(2); // never silently applied or dropped
  });

  it('F6 · a restarted queue replays the same keys', async () => {
    const factory = new IDBFactory();
    const first = queue('f6', factory);
    await enqueueAll(first, createThenChildren());
    const keys = (await first.list(USER)).map(record => record.idempotency_key);
    first.close();
    const reopened = new AnalyticsWriteQueue(factory, () => 'never-used', 'f6');
    const sent: string[] = [];
    const coordinator = new AnalyticsSyncCoordinator(USER, reopened, {
      replayQueuedWrite: vi.fn(async record => { sent.push(record.idempotency_key); }),
    }, { locks: null });
    await coordinator.flush();
    expect(sent).toEqual(keys);
  });
});

// ───────────────────── queue reads (never mutations) ─────────────────────

describe('pending experiment records', () => {
  it('select this experiment’s records, including its unacknowledged create', async () => {
    const target = queue('pending');
    const other = '2b1a7c1d-0f7e-4c1e-9a55-0d7f5b1c2e11';
    await enqueueAll(target, [
      ...createThenChildren(),
      experimentTransitionRequest(other, 'RUNNING', '2026-10-01T06:00:00.000Z'),
      experimentAdherenceRequest(ID, '2026-10-01', 'missed', 'key-3'),
    ]);
    const records = await target.list(USER);
    const mine = pendingExperimentRecords(records, ID);
    expect(mine.map(record => record.operation_type)).toEqual([
      'experiment.create', 'experiment.transition', 'experiment.adherence', 'experiment.adherence',
    ]);
    expect(pendingAdherenceKey(records, ID, '2026-10-01')).toBe('key-5');
    expect(pendingAdherenceKey(records, ID, '2026-10-02')).toBeNull();
  });

  it('F13 · completion is due once: not while a completion is queued', () => {
    const detail = { id: ID, lifecycle: 'RUNNING', window: { end: '2026-10-21', timezone: 'Europe/Kyiv', completion_due: false } };
    const after = Date.parse('2026-10-22T00:30:00+03:00');
    const before = Date.parse('2026-10-21T23:30:00+03:00');
    expect(completionDue(detail, [], before)).toBe(false);
    expect(completionDue(detail, [], after)).toBe(true);
    const queued = [{ ...experimentTransitionRequest(ID, 'COMPLETED_AWAITING_REVIEW', 'x') }];
    expect(completionDue(detail, queued, after)).toBe(false);
    expect(completionDue({ ...detail, lifecycle: 'ABANDONED' }, [], after)).toBe(false);
    expect(completionDue({ ...detail, window: { ...detail.window, completion_due: true } }, [], before)).toBe(true);
  });
});
