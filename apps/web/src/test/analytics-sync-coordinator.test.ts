import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '../api/client';
import { AnalyticsSyncCoordinator } from '../repositories/analyticsSyncCoordinator';
import { AnalyticsWriteQueue } from '../repositories/analyticsWriteQueue';
import { StateSyncCoordinator } from '../repositories/stateSyncCoordinator';
import type { AnalyticsRepository } from '../repositories/analyticsRepository';
import type { LifeOsState, StateRepository } from '../repositories/stateRepository';

function createQueue(name: string, keys: string[] = [], factory = new IDBFactory()) {
  let index = 0;
  return new AnalyticsWriteQueue(
    factory,
    () => keys[index++] ?? `queue-key-${index}`,
    name,
  );
}

async function enqueue(queue: AnalyticsWriteQueue, user = 'account-a', op = 'measurement.append') {
  return queue.enqueue({
    user_id: user,
    operation_type: op,
    route: op === 'measurement.correct'
      ? '/api/v1/aa/measurements/by-idempotency/create-key/correct'
      : '/api/v1/aa/measurements',
    payload: { operation: op },
  });
}

function repository(send: (record: never) => Promise<unknown>) {
  return { replayQueuedWrite: vi.fn(send) } as unknown as AnalyticsRepository;
}

describe('AnalyticsSyncCoordinator', () => {
  it('replays FIFO single-flight and removes successful writes once', async () => {
    const queue = createQueue('success', ['create-key', 'correct-key']);
    await enqueue(queue, 'account-a', 'measurement.append');
    await enqueue(queue, 'account-a', 'measurement.correct');
    const active: number[] = [];
    let concurrent = 0;
    const sent: string[] = [];
    const repo = repository(async record => {
      concurrent += 1;
      active.push(concurrent);
      sent.push((record as { idempotency_key: string }).idempotency_key);
      await Promise.resolve();
      concurrent -= 1;
    });
    const coordinator = new AnalyticsSyncCoordinator('account-a', queue, repo, { locks: null });
    await Promise.all([coordinator.flush(), coordinator.flush(), coordinator.flush()]);
    expect(sent).toEqual(['create-key', 'correct-key']);
    expect(Math.max(...active)).toBe(1);
    expect(await queue.list('account-a')).toEqual([]);
  });

  it('retries an unacknowledged success with the same key without duplicating server state', async () => {
    let now = 1_000;
    const queue = createQueue('lost-ack', ['durable-key']);
    await enqueue(queue);
    const server = new Set<string>();
    let first = true;
    const repo = repository(async record => {
      const key = (record as { idempotency_key: string }).idempotency_key;
      server.add(key);
      if (first) {
        first = false;
        throw new NetworkError(new Error('response lost'));
      }
    });
    const coordinator = new AnalyticsSyncCoordinator('account-a', queue, repo, {
      locks: null, now: () => now, schedule: () => undefined,
    });
    await coordinator.flush();
    expect((await queue.list())[0]).toMatchObject({
      idempotency_key: 'durable-key', attempts: 1, next_attempt_at: 2_000,
    });
    now = 2_000;
    await coordinator.flush();
    expect(server).toEqual(new Set(['durable-key']));
    expect(repo.replayQueuedWrite).toHaveBeenCalledTimes(2);
    expect(await queue.list()).toEqual([]);
  });

  it('restores a delayed retry after a browser-style queue recreation', async () => {
    const factory = new IDBFactory();
    let now = 1_000;
    const firstQueue = createQueue('restart-backoff', ['restart-key'], factory);
    await enqueue(firstQueue);
    await new AnalyticsSyncCoordinator(
      'account-a',
      firstQueue,
      repository(async () => { throw new NetworkError(new Error('offline')); }),
      { locks: null, now: () => now, schedule: () => undefined },
    ).flush();
    firstQueue.close();

    const scheduled: number[] = [];
    const restartedQueue = createQueue('restart-backoff', [], factory);
    const repo = repository(async () => undefined);
    const restarted = new AnalyticsSyncCoordinator('account-a', restartedQueue, repo, {
      locks: null,
      now: () => now,
      schedule: (_callback, delay) => { scheduled.push(delay); return delay; },
    });
    now = 1_500;
    await restarted.flush();
    expect(repo.replayQueuedWrite).not.toHaveBeenCalled();
    expect(scheduled).toEqual([500]);
    now = 2_000;
    await restarted.flush();
    expect(repo.replayQueuedWrite).toHaveBeenCalledOnce();
    expect(await restartedQueue.list()).toEqual([]);
  });

  it('backs off exponentially and caps retries at five minutes', async () => {
    let now = 1_000;
    const delays: number[] = [];
    const queue = createQueue('backoff-cap');
    await enqueue(queue);
    const coordinator = new AnalyticsSyncCoordinator(
      'account-a',
      queue,
      repository(async () => { throw new NetworkError(new Error('offline')); }),
      {
        locks: null,
        now: () => now,
        schedule: (_callback, delay) => { delays.push(delay); return delay; },
      },
    );
    for (let attempt = 0; attempt < 11; attempt += 1) {
      await coordinator.flush();
      const [record] = await queue.list('account-a');
      now = record.next_attempt_at;
    }
    expect(delays).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 32_000,
      64_000, 128_000, 256_000, 300_000, 300_000,
    ]);
  });

  it.each([
    [401, 'blocked_auth'],
    [400, 'failed_permanent'],
    [422, 'failed_permanent'],
    [409, 'terminal_conflict'],
  ] as const)('retains HTTP %s as visible %s', async (status, state) => {
    const queue = createQueue(`http-${status}`);
    await enqueue(queue);
    const repo = repository(async () => {
      throw new ApiError(status, `error-${status}`, `reason-${status}`, { reason: 'server' });
    });
    await new AnalyticsSyncCoordinator('account-a', queue, repo, { locks: null }).flush();
    expect((await queue.list())[0]).toMatchObject({
      state, last_error_status: status, last_error_code: `error-${status}`,
    });
  });

  it('resumes a 401 record after re-authentication without data loss', async () => {
    const queue = createQueue('reauth', ['auth-key']);
    await enqueue(queue);
    const repo = repository(vi.fn()
      .mockRejectedValueOnce(new ApiError(401, 'not_authenticated', 'expired'))
      .mockResolvedValueOnce({ id: 'fact' }));
    const coordinator = new AnalyticsSyncCoordinator('account-a', queue, repo, { locks: null });
    await coordinator.flush();
    await coordinator.resumeAfterAuthentication();
    expect(await queue.list()).toEqual([]);
    expect(repo.replayQueuedWrite).toHaveBeenCalledTimes(2);
  });

  it('keeps strict FIFO behind a dead letter until the user discards it', async () => {
    const queue = createQueue('dead-letter-barrier', ['create-key', 'correction-key']);
    const create = await enqueue(queue, 'account-a', 'measurement.append');
    await enqueue(queue, 'account-a', 'measurement.correct');
    const send = vi.fn()
      .mockRejectedValueOnce(new ApiError(422, 'invalid_fact', 'invalid create'))
      .mockResolvedValueOnce({ id: 'correction' });
    const coordinator = new AnalyticsSyncCoordinator(
      'account-a', queue, repository(send), { locks: null },
    );
    await coordinator.flush();
    await coordinator.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect((await queue.list('account-a')).map(row => row.state)).toEqual([
      'failed_permanent', 'pending',
    ]);
    expect(await queue.discard('account-a', create.queue_id)).toBe(true);
    await coordinator.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(await queue.list('account-a')).toEqual([]);
  });

  it('treats local replay validation errors as visible permanent failures', async () => {
    const queue = createQueue('local-validation');
    await enqueue(queue);
    await new AnalyticsSyncCoordinator(
      'account-a',
      queue,
      repository(async () => { throw new TypeError('unsupported payload'); }),
      { locks: null },
    ).flush();
    expect((await queue.list())[0]).toMatchObject({
      state: 'failed_permanent',
      last_error_code: 'TypeError',
    });
  });

  it('logout/account switch retains A and never flushes it as B', async () => {
    const queue = createQueue('accounts', ['a-key', 'b-key']);
    await enqueue(queue, 'account-a');
    await enqueue(queue, 'account-b');
    const repo = repository(async () => undefined);
    await new AnalyticsSyncCoordinator('account-b', queue, repo, { locks: null }).flush();
    expect((await queue.list('account-a')).map(row => row.idempotency_key)).toEqual(['a-key']);
    expect(await queue.list('account-b')).toEqual([]);
  });

  it('uses the named Web Lock and only flushes when elected', async () => {
    const queue = createQueue('locks');
    await enqueue(queue);
    const repo = repository(async () => undefined);
    const denied = { request: vi.fn(async (_name, _options, callback) => callback(null)) };
    await new AnalyticsSyncCoordinator('account-a', queue, repo, { locks: denied }).flush();
    // One lock per account: two accounts' queues never block each other.
    expect(denied.request).toHaveBeenCalledWith('aa-write-queue:account-a', { ifAvailable: true }, expect.any(Function));
    expect(repo.replayQueuedWrite).not.toHaveBeenCalled();
    expect(await queue.list()).toHaveLength(1);
    const elected = { request: vi.fn(async (_name, _options, callback) => callback({ name: 'aa-write-queue' })) };
    await new AnalyticsSyncCoordinator('account-a', queue, repo, { locks: elected }).flush();
    expect(await queue.list()).toEqual([]);
  });

  it('remains duplicate-safe with two tabs and no Web Locks', async () => {
    const factory = new IDBFactory();
    const firstQueue = createQueue('no-locks', ['shared-key'], factory);
    await enqueue(firstQueue);
    const secondQueue = createQueue('no-locks', [], factory);
    const server = new Set<string>();
    const send = vi.fn(async record => {
      server.add((record as { idempotency_key: string }).idempotency_key);
      await Promise.resolve();
    });
    await Promise.all([
      new AnalyticsSyncCoordinator(
        'account-a', firstQueue, repository(send), { locks: null },
      ).flush(),
      new AnalyticsSyncCoordinator(
        'account-a', secondQueue, repository(send), { locks: null },
      ).flush(),
    ]);
    expect(server).toEqual(new Set(['shared-key']));
    expect(await firstQueue.list()).toEqual([]);
  });

  it('T-12: snapshot 409 cannot freeze or drain AA, and AA failure cannot freeze snapshot sync', async () => {
    const queue = createQueue('t12');
    await enqueue(queue);
    const aaRepo = repository(async () => undefined);
    const stateReplace = vi.fn().mockRejectedValue(
      new ApiError(409, 'revision_conflict', 'snapshot conflict', { current_revision: 2 }),
    );
    const snapshot = new StateSyncCoordinator({
      repository: {
        load: vi.fn(), replace: stateReplace, reset: stateReplace,
      } as StateRepository,
      initialRevision: 1,
      onStatus: vi.fn(),
      onSessionExpired: vi.fn(),
      debounceMs: 1,
    });
    snapshot.enqueue({ version: 2 } as LifeOsState);
    await snapshot.flushNow();
    await new AnalyticsSyncCoordinator('account-a', queue, aaRepo, { locks: null }).flush();
    expect(aaRepo.replayQueuedWrite).toHaveBeenCalledOnce();
    expect(await queue.list()).toEqual([]);

    const failingQueue = createQueue('t12-inverse');
    await enqueue(failingQueue);
    await new AnalyticsSyncCoordinator(
      'account-a', failingQueue,
      repository(async () => { throw new ApiError(422, 'invalid', 'AA only'); }),
      { locks: null },
    ).flush();
    const healthyReplace = vi.fn().mockResolvedValue({
      schema_version: 2, revision: 2, payload: { version: 2 }, created_at: 'now', updated_at: 'now',
    });
    const healthy = new StateSyncCoordinator({
      repository: { load: vi.fn(), replace: healthyReplace, reset: healthyReplace } as StateRepository,
      initialRevision: 1, onStatus: vi.fn(), onSessionExpired: vi.fn(), debounceMs: 1,
    });
    healthy.enqueue({ version: 2 } as LifeOsState);
    await healthy.flushNow();
    expect(healthyReplace).toHaveBeenCalledOnce();
    snapshot.dispose();
    healthy.dispose();
  });

  it('keeps durable AA intent when snapshot sync succeeds while analytics is offline', async () => {
    const queue = createQueue('snapshot-success-aa-offline', ['offline-aa-key']);
    await enqueue(queue);
    await new AnalyticsSyncCoordinator(
      'account-a',
      queue,
      repository(async () => { throw new NetworkError(new Error('offline')); }),
      { locks: null, schedule: () => undefined },
    ).flush();

    const replace = vi.fn().mockResolvedValue({
      schema_version: 2,
      revision: 2,
      payload: { version: 2 },
      created_at: 'now',
      updated_at: 'now',
    });
    const snapshot = new StateSyncCoordinator({
      repository: { load: vi.fn(), replace, reset: replace } as StateRepository,
      initialRevision: 1,
      onStatus: vi.fn(),
      onSessionExpired: vi.fn(),
      debounceMs: 1,
    });
    snapshot.enqueue({ version: 2 } as LifeOsState);
    await snapshot.flushNow();
    expect(replace).toHaveBeenCalledOnce();
    expect((await queue.list('account-a'))[0]).toMatchObject({
      idempotency_key: 'offline-aa-key',
      state: 'pending',
      attempts: 1,
    });
    snapshot.dispose();
  });
});
