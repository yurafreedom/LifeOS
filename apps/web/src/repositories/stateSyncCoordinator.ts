import { ApiError, NetworkError } from '../api/client';
import type { LifeOsState, StateEnvelope, StateRepository } from './stateRepository';

export type SyncPhase = 'saved' | 'saving' | 'offline' | 'conflict' | 'error';
export type SyncSnapshot = {
  phase: SyncPhase;
  error: unknown | null;
  currentRevision: number | null;
  hasPending: boolean;
};

export type SyncCoordinatorOptions = {
  repository: StateRepository;
  initialRevision: number;
  onStatus: (snapshot: SyncSnapshot) => void;
  onSessionExpired: () => void;
  debounceMs?: number;
};

export class StateSyncCoordinator {
  private readonly repository: StateRepository;
  private readonly onStatus: SyncCoordinatorOptions['onStatus'];
  private readonly onSessionExpired: SyncCoordinatorOptions['onSessionExpired'];
  private readonly debounceMs: number;
  private revision: number;
  private pending: LifeOsState | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<StateEnvelope | null> | null = null;
  private disposed = false;
  private frozen = false;
  private replacing = false;
  private lastPhase: SyncPhase = 'saved';
  private lastError: unknown | null = null;
  private lastCurrentRevision: number | null = null;
  private readonly onlineHandler: () => void;

  constructor(options: SyncCoordinatorOptions) {
    this.repository = options.repository;
    this.revision = options.initialRevision;
    this.onStatus = options.onStatus;
    this.onSessionExpired = options.onSessionExpired;
    this.debounceMs = options.debounceMs ?? 500;
    this.onlineHandler = () => {
      if (this.lastPhase === 'offline' && this.pending && !this.disposed) void this.retry();
    };
    if (typeof window !== 'undefined') window.addEventListener('online', this.onlineHandler);
    this.emit('saved', null);
  }

  enqueue(payload: LifeOsState): void {
    if (this.disposed) return;
    this.pending = payload;
    if (this.replacing) return;
    if (this.frozen) {
      this.emit(this.lastPhase, this.lastError, this.lastCurrentRevision);
      return;
    }
    this.emit('saving', null);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flushNow();
    }, this.debounceMs);
  }

  flushNow(): Promise<StateEnvelope | null> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.disposed || this.frozen || this.replacing || !this.pending) {
      return this.inFlight ?? Promise.resolve(null);
    }
    if (this.inFlight) {
      return this.inFlight.then(() => this.flushNow());
    }

    const payload = this.pending;
    const expectedRevision = this.revision;
    this.pending = null;
    this.emit('saving', null);
    const request = this.repository.replace(payload, expectedRevision)
      .then((envelope) => {
        if (this.disposed) return null;
        this.revision = envelope.revision;
        this.emit(this.pending ? 'saving' : 'saved', null);
        return envelope;
      })
      .catch((error: unknown) => {
        if (this.disposed) return null;
        if (!this.pending) this.pending = payload;
        if (error instanceof ApiError && error.status === 401) {
          this.dispose();
          this.onSessionExpired();
        } else if (error instanceof ApiError && error.status === 409) {
          this.frozen = true;
          const body = error.details as { current_revision?: unknown } | null;
          const current = typeof body?.current_revision === 'number' ? body.current_revision : null;
          this.emit('conflict', error, current);
        } else if (error instanceof NetworkError) {
          this.emit('offline', error);
        } else {
          this.emit('error', error);
        }
        return null;
      })
      .finally(() => {
        if (this.inFlight === request) this.inFlight = null;
        if (!this.disposed && !this.frozen && !this.replacing && this.pending && this.lastPhase === 'saving') {
          void this.flushNow();
        }
      });
    this.inFlight = request;
    return request;
  }

  retry(): Promise<StateEnvelope | null> {
    if (this.disposed || this.frozen) return Promise.resolve(null);
    if (!this.pending) {
      this.emit('saved', null);
      return Promise.resolve(null);
    }
    this.emit('saving', null);
    return this.flushNow();
  }

  async replaceNow(payload: LifeOsState): Promise<StateEnvelope> {
    if (this.disposed) throw new Error('Sync coordinator is disposed.');
    if (this.frozen) throw new Error('Sync coordinator is frozen by a revision conflict.');
    this.replacing = true;
    try {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.pending = null;
      if (this.inFlight) await this.inFlight;
      if (this.disposed || this.frozen) throw new Error('Sync coordinator is unavailable.');
      if (this.lastPhase === 'offline' || this.lastPhase === 'error' || this.lastPhase === 'conflict') {
        throw this.lastError ?? new Error('Pending state was not acknowledged by the server.');
      }
      this.emit('saving', null);
      try {
        const envelope = await this.repository.reset(payload, this.revision);
        if (this.disposed) throw new Error('Sync coordinator is disposed.');
        this.pending = null;
        this.revision = envelope.revision;
        this.emit('saved', null);
        return envelope;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          this.dispose();
          this.onSessionExpired();
        } else if (error instanceof ApiError && error.status === 409) {
          this.frozen = true;
          const body = error.details as { current_revision?: unknown } | null;
          const current = typeof body?.current_revision === 'number' ? body.current_revision : null;
          this.emit('conflict', error, current);
        } else if (error instanceof NetworkError) {
          this.emit('offline', error);
        } else {
          this.emit('error', error);
        }
        throw error;
      }
    } finally {
      this.replacing = false;
    }
  }

  resetRevision(revision: number): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    this.revision = revision;
    this.frozen = false;
    this.emit('saved', null);
  }

  getPendingPayload(): LifeOsState | null {
    return this.pending;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onlineHandler);
  }

  private emit(phase: SyncPhase, error: unknown | null, currentRevision: number | null = null): void {
    if (this.disposed) return;
    this.lastPhase = phase;
    this.lastError = error;
    this.lastCurrentRevision = currentRevision;
    this.onStatus({
      phase,
      error,
      currentRevision,
      hasPending: this.pending !== null || phase === 'saving',
    });
  }
}
