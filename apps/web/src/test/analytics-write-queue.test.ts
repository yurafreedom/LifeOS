import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { AnalyticsWriteQueue } from '../repositories/analyticsWriteQueue';

function input(user = 'account-a', operation = 'measurement.append') {
  return {
    user_id: user,
    operation_type: operation,
    route: '/api/v1/aa/measurements',
    payload: { value: operation },
  };
}

describe('AnalyticsWriteQueue', () => {
  it('persists queue order and the enqueue-time idempotency key across recreation', async () => {
    const factory = new IDBFactory();
    const first = new AnalyticsWriteQueue(factory, () => 'stable-key-0001', 'durability');
    const queued = await first.enqueue(input());
    first.close();
    const restarted = new AnalyticsWriteQueue(factory, () => 'must-not-be-used', 'durability');
    const [stored] = await restarted.list('account-a');
    expect(stored).toMatchObject({
      queue_id: queued.queue_id,
      idempotency_key: 'stable-key-0001',
      payload_schema_version: 1,
      state: 'pending',
      attempts: 0,
    });
    expect(stored.client_created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(stored.payload.idempotency_key).toBe('stable-key-0001');
  });

  it('returns writes FIFO and never exposes another account', async () => {
    const queue = new AnalyticsWriteQueue(new IDBFactory(), (() => {
      let value = 0;
      return () => `fifo-key-${++value}`;
    })(), 'fifo');
    const one = await queue.enqueue(input('account-a', 'create'));
    const two = await queue.enqueue(input('account-a', 'correct'));
    await queue.enqueue(input('account-b', 'private'));
    expect((await queue.list('account-a')).map(row => row.queue_id)).toEqual([
      one.queue_id, two.queue_id,
    ]);
    expect((await queue.nextReady('account-a'))?.operation_type).toBe('create');
  });

  it('retains blocked and terminal records until explicit action', async () => {
    const queue = new AnalyticsWriteQueue(new IDBFactory(), () => 'state-key', 'states');
    const row = await queue.enqueue(input());
    await queue.update(row.queue_id, {
      state: 'failed_permanent', attempts: 1, last_error_status: 422,
    });
    expect((await queue.list())[0]).toMatchObject({ state: 'failed_permanent', attempts: 1 });
    expect(await queue.discard('account-b', row.queue_id)).toBe(false);
    expect(await queue.discard('account-a', row.queue_id)).toBe(true);
    expect(await queue.list()).toEqual([]);
  });
});
