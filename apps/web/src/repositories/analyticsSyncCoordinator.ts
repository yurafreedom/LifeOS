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

export class AnalyticsSyncCoordinator {
  private inFlight: Promise<void> | null = null;
  private phase: AnalyticsSyncPhase = 'idle';
  private lastError: string | null = null;
  private retryTimer: unknown = null;
  private disposed = false;

  constructor(
    private readonly userId: string,
    private readonly queue: AnalyticsWriteQueue,
    private readonly repository: Pick<AnalyticsRepository, 'replayQueuedWrite'>,
    private readonly options: CoordinatorOptions = {},
  ) {}

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
    await this.queue.resumeBlocked(this.userId);
    this.phase = 'idle';
    await this.flush();
  }

  dispose(): void {
    this.disposed = true;
    this.clearRetryTimer();
  }

  private async flushWithLeaderElection(): Promise<void> {
    if (this.options.locks == null) return this.flushAsLeader();
    await this.options.locks.request('aa-write-queue', { ifAvailable: true }, async lock => {
      if (lock != null) await this.flushAsLeader();
    });
  }

  private async report(): Promise<void> {
    const rows = await this.queue.list(this.userId);
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
    this.clearRetryTimer();
    this.phase = 'syncing';
    await this.report();
    for (;;) {
      const now = this.options.now?.() ?? Date.now();
      const record = await this.queue.first(this.userId);
      if (record == null) break;
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
      await this.queue.update(record.queue_id, { state: 'inflight' });
      try {
        await this.repository.replayQueuedWrite(record);
        await this.queue.remove(record.queue_id);
        this.lastError = null;
      } catch (error) {
        await this.handleFailure(record, error, now);
        break;
      }
    }
    if (this.phase === 'syncing') this.phase = 'idle';
    await this.report();
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
      await this.queue.update(record.queue_id, { ...common, state: 'blocked_auth' });
      return;
    }
    if (status === 400 || status === 422) {
      this.phase = 'failed';
      await this.queue.update(record.queue_id, { ...common, state: 'failed_permanent' });
      return;
    }
    if (status === 409) {
      this.phase = 'failed';
      await this.queue.update(record.queue_id, { ...common, state: 'terminal_conflict' });
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
      });
      this.scheduleRetry(delay);
      return;
    }
    this.phase = 'failed';
    await this.queue.update(record.queue_id, { ...common, state: 'failed_permanent' });
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
    this.retryTimer = schedule(() => {
      this.retryTimer = null;
      void this.flush();
    }, Math.max(0, delay));
  }
}
