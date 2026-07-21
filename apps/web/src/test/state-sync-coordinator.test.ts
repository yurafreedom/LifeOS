import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '../api/client';
import { StateSyncCoordinator, type SyncSnapshot } from '../repositories/stateSyncCoordinator';
import type { LifeOsState, StateEnvelope, StateRepository } from '../repositories/stateRepository';

const state = (value: number) => ({ version: 2, value }) as LifeOsState;
const env = (revision: number, payload = state(revision)): StateEnvelope => ({
  schema_version: 2, revision, payload, created_at: 'now', updated_at: 'now',
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup(replace: StateRepository['replace']) {
  const statuses: SyncSnapshot[] = [];
  const expired = vi.fn();
  const repository: StateRepository = { load: vi.fn(), replace, reset: replace };
  const coordinator = new StateSyncCoordinator({
    repository, initialRevision: 1, onStatus: status => statuses.push(status),
    onSessionExpired: expired, debounceMs: 20,
  });
  return { coordinator, statuses, expired };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('StateSyncCoordinator', () => {
  it('coalesces debounce payloads', async () => {
    vi.useFakeTimers();
    const replace = vi.fn().mockResolvedValue(env(2, state(2)));
    const { coordinator } = setup(replace);
    coordinator.enqueue(state(1));
    coordinator.enqueue(state(2));
    await vi.advanceTimersByTimeAsync(20);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(state(2), 1);
    coordinator.dispose();
  });

  it('serializes a mutation arriving during PUT', async () => {
    const first = deferred<StateEnvelope>();
    const replace = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(env(3, state(3)));
    const { coordinator } = setup(replace);
    coordinator.enqueue(state(2));
    const flushing = coordinator.flushNow();
    coordinator.enqueue(state(3));
    expect(replace).toHaveBeenCalledTimes(1);
    first.resolve(env(2, state(2)));
    await flushing;
    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(2));
    expect(replace).toHaveBeenLastCalledWith(state(3), 2);
    coordinator.dispose();
  });

  it('preserves offline payload for explicit retry', async () => {
    const replace = vi.fn()
      .mockRejectedValueOnce(new NetworkError(new Error('offline')))
      .mockResolvedValueOnce(env(2));
    const { coordinator, statuses } = setup(replace);
    coordinator.enqueue(state(2));
    await coordinator.flushNow();
    expect(statuses.at(-1)?.phase).toBe('offline');
    await coordinator.retry();
    expect(replace).toHaveBeenCalledTimes(2);
    coordinator.dispose();
  });

  it('freezes on conflict and expires on 401', async () => {
    const conflict = new ApiError(409, 'revision_conflict', 'Conflict', { current_revision: 4 });
    const replace = vi.fn().mockRejectedValue(conflict);
    const first = setup(replace);
    first.coordinator.enqueue(state(2));
    await first.coordinator.flushNow();
    first.coordinator.enqueue(state(3));
    await first.coordinator.retry();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(first.statuses.at(-1)).toMatchObject({ phase: 'conflict', currentRevision: 4 });
    first.coordinator.dispose();

    const second = setup(vi.fn().mockRejectedValue(new ApiError(401, 'not_authenticated', 'Expired')));
    second.coordinator.enqueue(state(2));
    await second.coordinator.flushNow();
    expect(second.expired).toHaveBeenCalledOnce();
  });

  it('ignores a late response after disposal', async () => {
    const request = deferred<StateEnvelope>();
    const { coordinator, statuses } = setup(vi.fn().mockReturnValue(request.promise));
    coordinator.enqueue(state(2));
    const flushing = coordinator.flushNow();
    const before = statuses.length;
    coordinator.dispose();
    request.resolve(env(2));
    await flushing;
    expect(statuses).toHaveLength(before);
  });

  it('does not reset after an unacknowledged in-flight save', async () => {
    const request = deferred<StateEnvelope>();
    const replace = vi.fn().mockReturnValue(request.promise);
    const { coordinator } = setup(replace);
    coordinator.enqueue(state(2));
    const flushing = coordinator.flushNow();
    const resetting = coordinator.replaceNow(state(0));
    request.reject(new NetworkError(new Error('offline')));
    await flushing;
    await expect(resetting).rejects.toBeInstanceOf(NetworkError);
    expect(replace).toHaveBeenCalledTimes(1);
    coordinator.dispose();
  });

  it('keeps reset exclusive while an earlier save settles', async () => {
    const first = deferred<StateEnvelope>();
    const replace = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(env(3, state(0)));
    const { coordinator } = setup(replace);
    coordinator.enqueue(state(2));
    const flushing = coordinator.flushNow();
    const resetting = coordinator.replaceNow(state(0));
    coordinator.enqueue(state(9));
    first.resolve(env(2, state(2)));
    await flushing;
    await resetting;
    expect(replace).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenLastCalledWith(state(0), 2);
    coordinator.dispose();
  });
});
