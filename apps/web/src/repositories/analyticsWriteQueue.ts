export type AnalyticsQueueState =
  | 'pending'
  | 'inflight'
  | 'blocked_auth'
  | 'failed_permanent'
  | 'terminal_conflict'
  /** v2 migration: no verifiable owner. Never replayed, never shown to an account. */
  | 'quarantined';

export type AnalyticsWriteRecord = {
  queue_id: number;
  user_id: string;
  operation_type: string;
  route: string;
  payload_schema_version: number;
  payload: Record<string, unknown>;
  idempotency_key: string;
  state: AnalyticsQueueState;
  attempts: number;
  next_attempt_at: number;
  client_created_at: string;
  last_error_status: number | null;
  last_error_code: string | null;
  last_error_message: string | null;
};

export type EnqueueAnalyticsWrite = Pick<
  AnalyticsWriteRecord,
  'user_id' | 'operation_type' | 'route'
> & { payload: Record<string, unknown>; payload_schema_version?: number };

export type QueueKeyFactory = () => string;

const DB_NAME = 'lifeos-adaptive-analytics';
const STORE = 'outbound_writes';
/**
 * v1 → v2 (JENKIN S1): every record must name the account that created it.
 * Records already carried `user_id` from the authenticated provider, so their
 * ownership is established and they stay with that account. A record without a
 * well-formed owner is ambiguous: it is marked `quarantined` and is never
 * assigned to whichever account signs in next.
 */
const DB_VERSION = 2;
/* An account id as the server issues it (a UUID in production; tests use short
   synthetic ids). Missing, empty, non-string or whitespace-bearing owners are
   ambiguous and quarantined. */
const OWNER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function isQueueOwner(value: unknown): value is string {
  return typeof value === 'string' && OWNER.test(value);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function defaultKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  throw new Error('A UUID v4 generator is required for durable analytics writes.');
}

export class AnalyticsWriteQueue {
  private readonly database: Promise<IDBDatabase>;

  constructor(
    idbFactory: IDBFactory,
    private readonly keyFactory: QueueKeyFactory = defaultKey,
    databaseName = DB_NAME,
  ) {
    const open = idbFactory.open(databaseName, DB_VERSION);
    open.onupgradeneeded = (event) => {
      const db = open.result;
      if (event.oldVersion < 1) {
        const store = db.createObjectStore(STORE, { keyPath: 'queue_id', autoIncrement: true });
        store.createIndex('user_id', 'user_id');
        return;
      }
      if (event.oldVersion < 2) {
        const cursorRequest = open.transaction!.objectStore(STORE).openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor == null) return;
          const row = cursor.value as AnalyticsWriteRecord;
          if (!isQueueOwner(row.user_id) && row.state !== 'quarantined') {
            cursor.update({ ...row, state: 'quarantined', last_error_code: 'owner_unknown' });
          }
          cursor.continue();
        };
      }
    };
    this.database = requestResult(open);
  }

  async enqueue(input: EnqueueAnalyticsWrite): Promise<AnalyticsWriteRecord> {
    if (!isQueueOwner(input.user_id)) {
      throw new TypeError('A durable analytics write must name the account that owns it.');
    }
    const idempotencyKey = this.keyFactory();
    const record = {
      ...input,
      payload_schema_version: input.payload_schema_version ?? 1,
      payload: { ...input.payload, idempotency_key: idempotencyKey },
      idempotency_key: idempotencyKey,
      state: 'pending' as const,
      attempts: 0,
      next_attempt_at: 0,
      client_created_at: new Date().toISOString(),
      last_error_status: null,
      last_error_code: null,
      last_error_message: null,
    };
    const db = await this.database;
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    const key = await requestResult(tx.objectStore(STORE).add(record));
    await done;
    return { ...record, queue_id: Number(key) };
  }

  async list(userId?: string): Promise<AnalyticsWriteRecord[]> {
    const db = await this.database;
    const tx = db.transaction(STORE, 'readonly');
    const done = transactionDone(tx);
    const rows = await requestResult(tx.objectStore(STORE).getAll()) as AnalyticsWriteRecord[];
    await done;
    return rows
      .filter(row => (userId == null || row.user_id === userId) && row.state !== 'quarantined')
      .sort((a, b) => a.queue_id - b.queue_id);
  }

  /** Records without a verifiable owner (diagnostics only; never replayed). */
  async quarantined(): Promise<AnalyticsWriteRecord[]> {
    const db = await this.database;
    const tx = db.transaction(STORE, 'readonly');
    const done = transactionDone(tx);
    const rows = await requestResult(tx.objectStore(STORE).getAll()) as AnalyticsWriteRecord[];
    await done;
    return rows.filter(row => row.state === 'quarantined');
  }

  async nextReady(userId: string, now = Date.now()): Promise<AnalyticsWriteRecord | null> {
    const first = await this.first(userId);
    if (first == null) return null;
    if (first.state !== 'pending' && first.state !== 'inflight') return null;
    return first.next_attempt_at <= now ? first : null;
  }

  async first(userId: string): Promise<AnalyticsWriteRecord | null> {
    return (await this.list(userId))[0] ?? null;
  }

  async getForUser(userId: string, queueId: number): Promise<AnalyticsWriteRecord | null> {
    const db = await this.database;
    const tx = db.transaction(STORE, 'readonly');
    const done = transactionDone(tx);
    const row = await requestResult(tx.objectStore(STORE).get(queueId)) as
      | AnalyticsWriteRecord
      | undefined;
    await done;
    return row?.user_id === userId ? row : null;
  }

  async update(
    queueId: number,
    patch: Partial<Omit<AnalyticsWriteRecord, 'queue_id' | 'user_id' | 'idempotency_key'>>,
    ownerId?: string,
  ): Promise<AnalyticsWriteRecord> {
    const db = await this.database;
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    const current = await requestResult(store.get(queueId)) as AnalyticsWriteRecord | undefined;
    if (current == null || (ownerId != null && current.user_id !== ownerId)) {
      tx.abort();
      throw new Error(`Queue record ${queueId} does not exist for this account.`);
    }
    const next = { ...current, ...patch };
    store.put(next);
    await done;
    return next;
  }

  async remove(queueId: number): Promise<void> {
    const db = await this.database;
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore(STORE).delete(queueId);
    await done;
  }

  async discard(userId: string, queueId: number): Promise<boolean> {
    const row = await this.getForUser(userId, queueId);
    if (row == null) return false;
    await this.remove(queueId);
    return true;
  }

  async resumeBlocked(userId: string): Promise<void> {
    const rows = await this.list(userId);
    await Promise.all(
      rows
        .filter(row => row.state === 'blocked_auth')
        .map(row => this.update(row.queue_id, { state: 'pending', next_attempt_at: 0 }, userId)),
    );
  }

  close(): void {
    void this.database.then(db => db.close());
  }
}
