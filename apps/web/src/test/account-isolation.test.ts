/* JENKIN S1 · account isolation across tabs (checkpoints 1–2).
 *
 * Tab A loaded account A; another tab signed out and signed in as B, so the
 * shared cookie now names B. Nothing tab A still holds may be saved into,
 * replayed into, or presented as B. The server half is pinned by
 * apps/api/tests/test_account_binding.py; this file pins the client half with a
 * fake server that, like the real one, resolves the cookie to B and refuses a
 * request bound to A with 409 `session_user_mismatch`. Both accounts hold the
 * same snapshot revision, so a revision coincidence cannot mask a cross write.
 */

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_HEADER,
  bindAccount,
  onAuthSignal,
  resetAccountBindingForTests,
} from '../api/accountBinding';
import { ApiError, requestJson } from '../api/client';
import { AnalyticsRepository } from '../repositories/analyticsRepository';
import { AnalyticsSyncCoordinator } from '../repositories/analyticsSyncCoordinator';
import { AnalyticsWriteQueue } from '../repositories/analyticsWriteQueue';
import {
  clearPendingSnapshot,
  readPendingSnapshot,
  savePendingSnapshot,
} from '../repositories/pendingSnapshotStore';
import { ServerStateRepository } from '../repositories/serverStateRepository';
import { StateSyncCoordinator } from '../repositories/stateSyncCoordinator';
import type { LifeOsState } from '../repositories/stateRepository';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

type Snapshot = { revision: number; payload: LifeOsState };

/** A server whose single shared cookie names `signedIn`. */
function fakeServer() {
  const snapshots: Record<string, Snapshot> = {
    [A]: { revision: 7, payload: { version: 2, owner: 'A' } },
    [B]: { revision: 7, payload: { version: 2, owner: 'B' } },
  };
  const measurements: Array<{ owner: string; key: string }> = [];
  const server = {
    signedIn: A as string | null,
    snapshots,
    measurements,
    requests: [] as Array<{ path: string; method: string; account: string | null }>,
    fetch: vi.fn(async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      const account = headers.get(ACCOUNT_HEADER);
      const method = init.method ?? 'GET';
      server.requests.push({ path, method, account });
      const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
        status, headers: { 'Content-Type': 'application/json' },
      });
      if (server.signedIn == null) return json(401, { code: 'not_authenticated', message: 'x' });
      if (path === '/api/v1/auth/me') return json(200, { id: server.signedIn, email: 'x@example.com', created_at: 'x' });
      if (account == null) return json(428, { code: 'account_binding_required', message: 'x' });
      if (account !== server.signedIn) return json(409, { code: 'session_user_mismatch', message: 'x' });
      const owner = server.signedIn;
      if (path === '/api/v1/state' && method === 'GET') {
        const snap = snapshots[owner];
        return json(200, { schema_version: 2, revision: snap.revision, payload: snap.payload, created_at: 'x', updated_at: 'x' });
      }
      if (path === '/api/v1/state' && method === 'PUT') {
        const body = JSON.parse(String(init.body));
        const snap = snapshots[owner];
        if (body.expected_revision !== snap.revision) return json(409, { code: 'revision_conflict', message: 'x', current_revision: snap.revision });
        snapshots[owner] = { revision: snap.revision + 1, payload: body.payload };
        return json(200, { schema_version: 2, revision: snap.revision + 1, payload: body.payload, created_at: 'x', updated_at: 'x' });
      }
      if (path === '/api/v1/aa/measurements') {
        const body = JSON.parse(String(init.body));
        measurements.push({ owner, key: body.idempotency_key });
        return json(201, { ok: true });
      }
      return json(404, { code: 'not_found', message: 'x' });
    }),
  };
  return server;
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
}

let server: ReturnType<typeof fakeServer>;

beforeEach(() => {
  server = fakeServer();
  vi.stubGlobal('fetch', server.fetch);
  vi.stubGlobal('window', { localStorage: memoryStorage(), addEventListener() {}, removeEventListener() {} });
  bindAccount(A);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetAccountBindingForTests();
});

/** Another tab: sign out of A, sign in as B (the shared cookie changes). */
function anotherTabSignsInAsB() {
  server.signedIn = B;
}

describe('stale tab after another tab signed in as B', () => {
  it('a snapshot save from tab A is refused and never lands in B, with equal revisions', async () => {
    const statuses: string[] = [];
    const mismatches: string[] = [];
    const coordinator = new StateSyncCoordinator({
      repository: new ServerStateRepository(),
      initialRevision: 7,
      onStatus: snapshot => statuses.push(snapshot.phase),
      onSessionExpired: () => statuses.push('expired'),
      onAccountMismatch: () => mismatches.push('mismatch'),
      debounceMs: 0,
    });
    anotherTabSignsInAsB();
    coordinator.enqueue({ version: 2, owner: 'A-edited-in-stale-tab' });
    await coordinator.flushNow();

    expect(server.snapshots[B]).toEqual({ revision: 7, payload: { version: 2, owner: 'B' } });
    expect(server.snapshots[A].payload.owner).toBe('A');
    expect(server.requests.at(-1)).toMatchObject({ method: 'PUT', account: A });
    expect(mismatches).toEqual(['mismatch']);
    // A mismatch is not a revision conflict: nothing froze, nothing expired.
    expect(statuses).not.toContain('conflict');
    expect(statuses).not.toContain('expired');
    // The edit is still unsaved — kept for A, never discarded.
    expect(coordinator.getUnsavedPayload()).toEqual({ version: 2, owner: 'A-edited-in-stale-tab' });
  });

  it('a read from tab A is refused instead of presenting B as A, and the auth listener is told', async () => {
    const signals: string[] = [];
    const stop = onAuthSignal(signal => signals.push(`${signal.kind}:${signal.expectedUserId}`));
    anotherTabSignsInAsB();
    await expect(new ServerStateRepository().load()).rejects.toMatchObject({
      status: 409, code: 'session_user_mismatch',
    });
    expect(signals).toEqual([`mismatch:${A}`]);
    stop();
  });

  it('queued analytics of A are never replayed as B and stay pending for A', async () => {
    const queue = new AnalyticsWriteQueue(new IDBFactory(), () => crypto.randomUUID(), 'stale-replay');
    await queue.enqueue({ user_id: A, operation_type: 'measurement.append', route: '/api/v1/aa/measurements', payload: { v: 1 } });
    await queue.enqueue({ user_id: A, operation_type: 'measurement.append', route: '/api/v1/aa/measurements', payload: { v: 2 } });
    anotherTabSignsInAsB();
    const coordinator = new AnalyticsSyncCoordinator(A, queue, new AnalyticsRepository(), { locks: null });
    await coordinator.flush();

    expect(server.measurements).toEqual([]);
    const rows = await queue.list(A);
    expect(rows.map(row => [row.state, row.attempts])).toEqual([['pending', 0], ['pending', 0]]);
    expect(await queue.list(B)).toEqual([]);
    expect(server.requests.filter(r => r.path === '/api/v1/aa/measurements').map(r => r.account)).toEqual([A]);
  });

  it('a response for A that settles after the tab switched to B never reaches B', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    server.fetch.mockImplementationOnce(async () => {
      await gate;
      return new Response(JSON.stringify({ schema_version: 2, revision: 7, payload: { version: 2, owner: 'A' }, created_at: 'x', updated_at: 'x' }), { status: 200 });
    });
    const late = requestJson('/api/v1/state');
    bindAccount(B);
    release();
    await expect(late).rejects.toMatchObject({ name: 'AbortError', reason: 'account_changed' });
  });

  it('replays queued writes as their own owner, even when the tab is bound elsewhere', async () => {
    server.signedIn = A;
    bindAccount(B);
    const repository = new AnalyticsRepository();
    await repository.replayQueuedWrite({
      queue_id: 1, user_id: A, operation_type: 'measurement.append', route: '/api/v1/aa/measurements',
      payload_schema_version: 1, payload: { idempotency_key: 'k-1' }, idempotency_key: 'k-1',
      state: 'pending', attempts: 0, next_attempt_at: 0, client_created_at: 'x',
      last_error_status: null, last_error_code: null, last_error_message: null,
    });
    expect(server.requests.at(-1)?.account).toBe(A);
    expect(server.measurements).toEqual([{ owner: A, key: 'k-1' }]);
  });
});

describe('dispose stops the replay loop', () => {
  it('no further record is sent after dispose, and the interrupted record is released unchanged', async () => {
    const queue = new AnalyticsWriteQueue(new IDBFactory(), () => crypto.randomUUID(), 'dispose-loop');
    for (let index = 0; index < 3; index += 1) {
      await queue.enqueue({ user_id: A, operation_type: 'measurement.append', route: '/api/v1/aa/measurements', payload: { index } });
    }
    let coordinator: AnalyticsSyncCoordinator;
    const sent: number[] = [];
    const repository = {
      replayQueuedWrite: vi.fn(async (record: { payload: { index: number } }, signal?: AbortSignal) => {
        sent.push(record.payload.index);
        if (record.payload.index === 0) return;
        // Disposed while the second request is in flight: the request is aborted.
        coordinator.dispose();
        expect(signal?.aborted).toBe(true);
        throw new DOMException('aborted', 'AbortError');
      }),
    };
    coordinator = new AnalyticsSyncCoordinator(A, queue, repository as never, { locks: null });
    await coordinator.flush();

    expect(sent).toEqual([0, 1]);
    const rows = await queue.list(A);
    expect(rows.map(row => [row.payload.index, row.state, row.attempts])).toEqual([[1, 'pending', 0], [2, 'pending', 0]]);
    await coordinator.flush();
    expect(sent).toEqual([0, 1]);
  });

  it('dispose aborts the snapshot request in flight and keeps its payload unsaved', async () => {
    let seenSignal: AbortSignal | undefined;
    const repository = {
      load: vi.fn(),
      replace: vi.fn((_payload: LifeOsState, _revision: number, signal?: AbortSignal) => {
        seenSignal = signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      }),
      reset: vi.fn(),
    };
    const coordinator = new StateSyncCoordinator({
      repository: repository as never, initialRevision: 3, onStatus: () => {}, onSessionExpired: () => {}, debounceMs: 0,
    });
    coordinator.enqueue({ version: 2, edit: 1 });
    const flushing = coordinator.flushNow();
    coordinator.dispose();
    await flushing;
    expect(seenSignal?.aborted).toBe(true);
    expect(coordinator.getUnsavedPayload()).toEqual({ version: 2, edit: 1 });
    expect(coordinator.getRevision()).toBe(3);
  });
});

describe('pending snapshot recovery is per account', () => {
  it('a copy kept for A is offered only to A and never to B', () => {
    expect(savePendingSnapshot(A, { version: 2, owner: 'A-unsaved' }, 7, 'expired')).toBe(true);
    expect(readPendingSnapshot(B)).toBeNull();
    expect(readPendingSnapshot(A)).toMatchObject({ user_id: A, base_revision: 7, payload: { owner: 'A-unsaved' } });
    clearPendingSnapshot(A);
    expect(readPendingSnapshot(A)).toBeNull();
  });

  it('a record copied under another account key is rejected', () => {
    savePendingSnapshot(A, { version: 2, owner: 'A' }, 1, 'expired');
    const storage = (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage;
    storage.setItem(`lifeOsPendingSnapshot:${B}`, storage.getItem(`lifeOsPendingSnapshot:${A}`)!);
    expect(readPendingSnapshot(B)).toBeNull();
  });
});

describe('queue v1 → v2 ownership migration', () => {
  it('keeps owned records with their owner and quarantines ownerless ones', async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const open = factory.open('legacy-queue', 1);
      open.onupgradeneeded = () => {
        const store = open.result.createObjectStore('outbound_writes', { keyPath: 'queue_id', autoIncrement: true });
        store.createIndex('user_id', 'user_id');
        const base = { operation_type: 'measurement.append', route: '/api/v1/aa/measurements', payload_schema_version: 1, attempts: 0, next_attempt_at: 0, client_created_at: 'x', last_error_status: null, last_error_code: null, last_error_message: null };
        store.add({ ...base, user_id: A, payload: { idempotency_key: 'a' }, idempotency_key: 'a', state: 'pending' });
        store.add({ ...base, payload: { idempotency_key: 'orphan' }, idempotency_key: 'orphan', state: 'pending' });
        store.add({ ...base, user_id: '', payload: { idempotency_key: 'blank' }, idempotency_key: 'blank', state: 'pending' });
      };
      open.onsuccess = () => { open.result.close(); resolve(); };
      open.onerror = () => reject(open.error);
    });
    const queue = new AnalyticsWriteQueue(factory, () => 'unused', 'legacy-queue');
    expect((await queue.list(A)).map(row => row.idempotency_key)).toEqual(['a']);
    expect((await queue.list()).map(row => row.idempotency_key)).toEqual(['a']);
    expect((await queue.quarantined()).map(row => row.idempotency_key)).toEqual(['orphan', 'blank']);
    // Whoever signs in next does not inherit them.
    expect(await queue.list(B)).toEqual([]);
    queue.close();
  });

  it('refuses to enqueue a write without an owner', async () => {
    const queue = new AnalyticsWriteQueue(new IDBFactory(), () => 'k', 'no-owner');
    await expect(queue.enqueue({ user_id: '', operation_type: 'x', route: '/api/v1/aa/measurements', payload: {} }))
      .rejects.toBeInstanceOf(TypeError);
  });
});

describe('error classification', () => {
  it('a domain 409 is not an account mismatch and does not notify the auth listener', async () => {
    const signals: unknown[] = [];
    const stop = onAuthSignal(signal => signals.push(signal));
    server.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'revision_conflict', message: 'x', current_revision: 9 }), { status: 409 }));
    await expect(requestJson('/api/v1/state', { method: 'PUT', body: '{}' })).rejects.toBeInstanceOf(ApiError);
    expect(signals).toEqual([]);
    stop();
  });
});
