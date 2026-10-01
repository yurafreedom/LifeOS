import { isAccountChanged } from '../api/accountBinding';
import { ApiError, NetworkError } from '../api/client';
import type { AnalyticsRepository } from './analyticsRepository';
import { AnalyticsWriteQueue } from './analyticsWriteQueue';
import type { AnalyticsWriteRecord } from './analyticsWriteQueue';

export type AnalyticsSyncPhase =
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'retrying'
  | 'blocked_auth'
  | 'failed';

export type AnalyticsSyncStatus = {
  phase: AnalyticsSyncPhase;
  pending: number;
  failed: number;
  last_error: string | null;
  failures: Array<Pick<
    AnalyticsWriteRecord,
    | 'queue_id'
    | 'operation_type'
    | 'state'
    | 'last_error_status'
    | 'last_error_code'
    | 'last_error_message'
  >>;
};

type LockManagerLike = {
  request<T>(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: unknown | null) => Promise<T>,
  ): Promise<T>;
};

type CoordinatorOptions = {
  locks?: LockManagerLike | null;
  now?: () => number;
  onStatus?: (status: AnalyticsSyncStatus) => void;
  schedule?: (callback: () => void, delay: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
};

const MAX_BACKOFF_MS = 300_000;

function isAbort(error: unknown): boolean {
  return isAccountChanged(error) || (error instanceof Error && error.name === 'AbortError')
    || (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError');
}

/** The server refused the binding: another account owns the session, or the
 *  request carried no owner. Neither is a property of the record — hold it. */
function isBindingRefusal(error: unknown): boolean {
  return error instanceof ApiError && (
    (error.status === 409 && error.code === 'session_user_mismatch')
    || (error.status === 428 && error.code === 'account_binding_required')
  );
}

export class AnalyticsSyncCoordinator {
  private inFlight: Promise<void> | null = null;
  private phase: AnalyticsSyncPhase = 'idle';
  private lastError: string | null = null;
  private retryTimer: unknown = null;
  private disposed = false;
  /** Aborts the replay in flight when the coordinator is disposed (account change, unmount). */
  private readonly controller = new AbortController();

  constructor(
    private readonly userId: string,
    private readonly queue: AnalyticsWriteQueue,
    private readonly repository: Pick<AnalyticsRepository, 'replayQueuedWrite'>,
    private readonly options: CoordinatorOptions = {},
  ) {}

  get isDisposed(): boolean {
    return this.disposed;
  }

  flush(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.inFlight != null) return this.inFlight;
    const task = this.flushWithLeaderElection().finally(() => {
      this.inFlight = null;
    });
    this.inFlight = task;
    return task;
  }

  async resumeAfterAuthentication(): Promise<void> {
    if (this.disposed) return;
    await this.queue.resumeBlocked(this.userId);
    if (this.disposed) return;
    this.phase = 'idle';
    await this.flush();
  }

  /** Stop for good: no further replay, the request in flight is aborted, no status. */
  dispose(): void {
    this.disposed = true;
    this.controller.abort();
    this.clearRetryTimer();
  }

  private async flushWithLeaderElection(): Promise<void> {
    if (this.options.locks == null) return this.flushAsLeader();
    // One leader per account across tabs. The lock only avoids duplicate
    // replays; authorization is the server's session + account binding.
    await this.options.locks.request(`aa-write-queue:${this.userId}`, { ifAvailable: true }, async lock => {
      if (lock != null) await this.flushAsLeader();
    });
  }

  private async report(): Promise<void> {
    if (this.disposed) return;
    const rows = await this.queue.list(this.userId);
    if (this.disposed) return;
    const failures = rows
      .filter(row => row.state === 'failed_permanent' || row.state === 'terminal_conflict')
      .map(row => ({
        queue_id: row.queue_id,
        operation_type: row.operation_type,
        state: row.state,
        last_error_status: row.last_error_status,
        last_error_code: row.last_error_code,
        last_error_message: row.last_error_message,
      }));
    this.options.onStatus?.({
      phase: this.phase,
      pending: rows.filter(row => ['pending', 'inflight', 'blocked_auth'].includes(row.state)).length,
      failed: failures.length,
      last_error: this.lastError,
      failures,
    });
  }

  private async flushAsLeader(): Promise<void> {
    if (this.disposed) return;
    this.clearRetryTimer();
    this.phase = 'syncing';
    await this.report();
    while (!this.disposed) {
      const now = this.options.now?.() ?? Date.now();
      const record = await this.queue.first(this.userId);
      if (this.disposed || record == null) break;
      if (record.user_id !== this.userId) break;
      if (record.state === 'blocked_auth') {
        this.phase = 'blocked_auth';
        break;
      }
      if (record.state === 'failed_permanent' || record.state === 'terminal_conflict') {
        this.phase = 'failed';
        break;
      }
      if (record.next_attempt_at > now) {
        this.phase = 'retrying';
        this.scheduleRetry(record.next_attempt_at - now);
        break;
      }
      await this.queue.update(record.queue_id, { state: 'inflight' }, this.userId);
      if (this.disposed) {
        await this.release(record);
        break;
      }
      try {
        await this.repository.replayQueuedWrite(record, this.controller.signal);
        await this.queue.remove(record.queue_id);
        this.lastError = null;
      } catch (error) {
        if (this.disposed || isAbort(error)) {
          // Not a failure of the record: it was never answered for this account.
          await this.release(record);
          break;
        }
        if (isBindingRefusal(error)) {
          await this.release(record);
          this.phase = 'blocked_auth';
          break;
        }
        await this.handleFailure(record, error, now);
        break;
      }
    }
    if (this.disposed) return;
    if (this.phase === 'syncing') this.phase = 'idle';
    await this.report();
  }

  /** Put an interrupted record back exactly as it was, attempts unchanged. */
  private async release(record: AnalyticsWriteRecord): Promise<void> {
    try {
      await this.queue.update(record.queue_id, { state: 'pending' }, this.userId);
    } catch {
      // The queue may already be closed; `inflight` is replayed as pending anyway.
    }
  }

  private async handleFailure(
    record: AnalyticsWriteRecord,
    error: unknown,
    now: number,
  ): Promise<void> {
    const status = error instanceof ApiError ? error.status : null;
    const code = error instanceof ApiError ? error.code : error instanceof Error ? error.name : 'unknown';
    const message = error instanceof Error ? error.message : String(error);
    this.lastError = message;
    const common = {
      attempts: record.attempts + 1,
      last_error_status: status,
      last_error_code: code,
      last_error_message: message,
    };
    if (status === 401) {
      this.phase = 'blocked_auth';
      await this.queue.update(record.queue_id, { ...common, state: 'blocked_auth' }, this.userId);
      return;
    }
    if (status === 400 || status === 422) {
      this.phase = 'failed';
      await this.queue.update(record.queue_id, { ...common, state: 'failed_permanent' }, this.userId);
      return;
    }
    if (status === 409) {
      this.phase = 'failed';
      await this.queue.update(record.queue_id, { ...common, state: 'terminal_conflict' }, this.userId);
      return;
    }
    if (
      error instanceof NetworkError
      || status === 408
      || status === 425
      || status === 429
      || (status != null && status >= 500 && status <= 599)
    ) {
      const delay = Math.min(1_000 * 2 ** record.attempts, MAX_BACKOFF_MS);
      this.phase = record.attempts === 0 ? 'offline' : 'retrying';
      await this.queue.update(record.queue_id, {
        ...common,
        state: 'pending',
        next_attempt_at: now + delay,
      }, this.userId);
      this.scheduleRetry(delay);
      return;
    }
    this.phase = 'failed';
    await this.queue.update(record.queue_id, { ...common, state: 'failed_permanent' }, this.userId);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer == null) return;
    if (this.options.cancelSchedule != null) {
      this.options.cancelSchedule(this.retryTimer);
    } else if (this.options.schedule == null) {
      clearTimeout(this.retryTimer as ReturnType<typeof setTimeout>);
    }
    this.retryTimer = null;
  }

  private scheduleRetry(delay: number): void {
    this.clearRetryTimer();
    const schedule = this.options.schedule ?? ((callback, wait) => setTimeout(callback, wait));
    if (this.disposed) return;
    this.retryTimer = schedule(() => {
      this.retryTimer = null;
      void this.flush();
    }, Math.max(0, delay));
  }
}
