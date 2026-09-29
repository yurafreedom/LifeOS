import {
  acknowledgeSignalEpisode,
  correctMeasurement,
  correctMeasurementByIdempotencyKey,
  getFinanceMonth,
  getFactProvenance,
  getMetricHistory,
  getExperiment,
  getProjectAnalytics,
  getReview,
  getReviewContext,
  getSignals,
  getSystemReview,
  getSystemReviewWaiting,
  getRevision,
  listExperiments,
  listFinanceContexts,
  listRelations,
  listRevisions,
  listReviews,
  recordMeasurement,
  importLegacyTransactions,
} from '../api/analytics';
import type {
  AACorrection,
  AAExperimentDetail,
  AAExperimentLifecycle,
  AAExperimentList,
  AAFactProvenance,
  AAMeasurement,
  AAMetricHistory,
  AAProjectAnalytics,
  AASubject,
  AAValue,
  CorrectMeasurementInput,
  MetricHistoryQuery,
  RecordMeasurementInput,
  AAFinanceMonth,
  AASignalEpisode,
  AASignals,
  AAReview,
  AAReviewContext,
  AAReviewList,
  AARevision,
  AARevisionSummary,
  AASystemReview,
  AAWaiting,
  AAFinanceContext,
  AARelation,
  RelationFilters,
  LegacyImportResult,
} from '../api/analytics';
import { requestJson } from '../api/client';
import type { AnalyticsWriteRecord } from './analyticsWriteQueue';

/**
 * The HTTP boundary for Adaptive Analytics facts.
 *
 * This is infrastructure only: no UI, no route, and no durable queue. It is
 * completely independent of `StateSyncCoordinator` — the snapshot's compare-and-
 * swap and this append path never share a failure, so a snapshot conflict can
 * never stall a fact and a fact failure can never freeze the snapshot.
 *
 * Idempotency keys are minted here, before the first attempt, so that a retry
 * of any kind resolves to the fact the server already stored rather than
 * creating a second one.
 */

const EXPERIMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPERIMENT_LIFECYCLES: readonly AAExperimentLifecycle[] = [
  'DRAFT', 'RUNNING', 'COMPLETED_AWAITING_REVIEW', 'REVIEWED', 'ABANDONED',
];

export type IdempotencyKeyFactory = () => string;

function defaultKeyFactory(): string {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto != null && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }
  // Deterministic enough for a key that only needs to be unique per account.
  return `aa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function subjectKey(subject: AASubject): string {
  return `${subject.domain}:${subject.type}:${subject.id ?? ''}`;
}

/**
 * Mirrors the server's value contract so an impossible value is rejected before
 * it reaches the network. The server enforces the same rules again; this is a
 * fast failure, never the only guard.
 */
export function assertValueIsWellShaped(value: AAValue): void {
  const present = (field: keyof AAValue): boolean => value[field] != null;
  const required: Record<AAValue['type'], Array<keyof AAValue>> = {
    money: ['num', 'unit_code'],
    date: ['date'],
    duration: ['num', 'unit_code'],
    count: ['num'],
    scale: ['num', 'scale_min', 'scale_max'],
    categorical: ['text'],
  };
  const fields: Array<keyof AAValue> = ['unit_code', 'num', 'date', 'text', 'scale_min', 'scale_max'];
  const needed = required[value.type];
  if (needed == null) {
    throw new TypeError(`Unknown value type: ${String(value.type)}`);
  }
  for (const field of needed) {
    if (!present(field)) {
      throw new TypeError(`A ${value.type} value requires ${String(field)}.`);
    }
  }
  for (const field of fields) {
    if (!needed.includes(field) && present(field)) {
      throw new TypeError(`A ${value.type} value must not carry ${String(field)}.`);
    }
  }
  if (value.type === 'money' && !/^[A-Z]{3}$/.test(value.unit_code ?? '')) {
    throw new TypeError('A money value requires an ISO-4217 currency code.');
  }
  if (value.type === 'duration' && value.unit_code !== 'minute') {
    throw new TypeError('A duration value is carried in canonical minutes.');
  }
}

export type RecordMeasurementRequest = Omit<RecordMeasurementInput, 'idempotency_key'> & {
  idempotency_key?: string;
};

export type CorrectMeasurementRequest = Omit<CorrectMeasurementInput, 'idempotency_key'> & {
  idempotency_key?: string;
};

export class AnalyticsRepository {
  private readonly newIdempotencyKey: IdempotencyKeyFactory;

  constructor(newIdempotencyKey: IdempotencyKeyFactory = defaultKeyFactory) {
    this.newIdempotencyKey = newIdempotencyKey;
  }

  async recordMeasurement(request: RecordMeasurementRequest): Promise<AAMeasurement> {
    // `async` so a shape rejection surfaces as a rejected promise, the same way
    // a server rejection does; a caller has one failure path, not two.
    assertValueIsWellShaped(request.value);
    return recordMeasurement({
      ...request,
      idempotency_key: request.idempotency_key ?? this.newIdempotencyKey(),
    });
  }

  async correctMeasurement(
    measurementId: string,
    request: CorrectMeasurementRequest,
  ): Promise<AACorrection> {
    assertValueIsWellShaped(request.value);
    return correctMeasurement(measurementId, {
      ...request,
      idempotency_key: request.idempotency_key ?? this.newIdempotencyKey(),
    });
  }

  async correctMeasurementByKey(
    measurementKey: string,
    request: CorrectMeasurementRequest,
  ): Promise<AACorrection> {
    assertValueIsWellShaped(request.value);
    return correctMeasurementByIdempotencyKey(measurementKey, {
      ...request,
      idempotency_key: request.idempotency_key ?? this.newIdempotencyKey(),
    });
  }

  replayQueuedWrite(record: AnalyticsWriteRecord): Promise<unknown> {
    if (record.payload_schema_version !== 1) {
      throw new TypeError(`Unsupported analytics payload schema ${record.payload_schema_version}.`);
    }
    if (!record.route.startsWith('/api/v1/aa/') || record.route.includes('..')) {
      throw new TypeError('Queued analytics route is outside the AA API boundary.');
    }
    if (record.payload.idempotency_key !== record.idempotency_key) {
      throw new TypeError('Queued analytics idempotency identity changed.');
    }
    return requestJson(record.route, { method: 'POST', body: JSON.stringify(record.payload) });
  }

  readFinanceMonth(period: string, timezone: string, signal?: AbortSignal): Promise<AAFinanceMonth> {
    return getFinanceMonth(period, timezone, signal);
  }

  importLegacyTransactions(timezone: string): Promise<LegacyImportResult> {
    return importLegacyTransactions(timezone);
  }

  readMetricHistory(
    metricKey: string,
    query: MetricHistoryQuery,
    signal?: AbortSignal,
  ): Promise<AAMetricHistory> {
    if (!query.from || !query.to) {
      throw new TypeError('A metric history read requires an explicit range.');
    }
    return getMetricHistory(metricKey, query, signal);
  }

  readFactProvenance(
    factTable: string,
    factId: string,
    signal?: AbortSignal,
  ): Promise<AAFactProvenance> {
    return getFactProvenance(factTable, factId, signal);
  }

  readSignals(
    query: { limit?: number; timezone?: string; asOf?: string } = {},
    signal?: AbortSignal,
  ): Promise<AASignals> {
    if (query.limit != null && (!Number.isInteger(query.limit) || query.limit < 0)) {
      throw new TypeError('A signal limit must be a non-negative integer.');
    }
    return getSignals(query, signal);
  }

  /**
   * Acknowledge one episode.
   *
   * The fingerprint the card was rendered from travels with the request: the
   * server refuses the acknowledgement if the signal has been re-evaluated since,
   * so a user cannot dismiss something they were never shown.
   */
  acknowledgeSignal(episodeKey: string, inputFingerprint: string): Promise<AASignalEpisode> {
    if (!/^[0-9a-f]{64}$/.test(inputFingerprint)) {
      throw new TypeError('An episode acknowledgement requires the observed sha256 fingerprint.');
    }
    return acknowledgeSignalEpisode(episodeKey, inputFingerprint);
  }

  /**
   * The evidence a new Review would freeze. Always an explicit, bounded window —
   * never an all-time read. Saving goes through the durable queue, not here.
   */
  readReviewContext(
    query: { subject: string; from: string; to: string; timezone?: string },
    signal?: AbortSignal,
  ): Promise<AAReviewContext> {
    if (!/^[^:]+:[^:]+:[^:]*$/.test(query.subject)) {
      throw new TypeError('A review subject is domain:type:id.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.from) || !/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
      throw new TypeError('A review context read requires an explicit from/to window.');
    }
    return getReviewContext(query, signal);
  }

  /**
   * Project Analytics: the server's forecast version history, the separate
   * Actual and the dual delta. Current truth, or as LifeOS knew it at `asOf`.
   */
  readProjectAnalytics(
    projectId: string,
    query: { asOf?: string } = {},
    signal?: AbortSignal,
  ): Promise<AAProjectAnalytics> {
    if (!projectId || projectId.includes(':')) {
      throw new TypeError('A project id is non-empty and contains no colon.');
    }
    return getProjectAnalytics(projectId, query, signal);
  }

  readReview(reviewId: string, signal?: AbortSignal): Promise<AAReview> {
    return getReview(reviewId, signal);
  }

  listReviews(subject: string, signal?: AbortSignal): Promise<AAReviewList> {
    return listReviews(subject, 20, signal);
  }

  readExperiment(experimentId: string, signal?: AbortSignal): Promise<AAExperimentDetail> {
    if (!EXPERIMENT_ID.test(experimentId)) throw new TypeError('An experiment id is a UUID.');
    return getExperiment(experimentId, signal);
  }

  listExperiments(
    query: { lifecycles?: AAExperimentLifecycle[]; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<AAExperimentList> {
    const limit = query.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError('limit is 1–50.');
    for (const lifecycle of query.lifecycles ?? []) {
      if (!EXPERIMENT_LIFECYCLES.includes(lifecycle)) throw new TypeError(`Unknown lifecycle: ${lifecycle}`);
    }
    return listExperiments({ lifecycles: query.lifecycles, limit }, signal);
  }

  /** The live System Review for a month or a year. A pure server read. */
  readSystemReview(period: string, signal?: AbortSignal): Promise<AASystemReview> {
    return getSystemReview(period, 'Europe/Kyiv', signal);
  }

  readSystemReviewWaiting(signal?: AbortSignal): Promise<AAWaiting> {
    return getSystemReviewWaiting(signal);
  }

  listRelations(
    filters: RelationFilters, signal?: AbortSignal,
  ): Promise<{ relations: AARelation[]; limit: number }> {
    return listRelations(filters, signal);
  }

  listFinanceContexts(kinds: string[] = [], signal?: AbortSignal): Promise<{ contexts: AAFinanceContext[] }> {
    return listFinanceContexts(kinds, signal);
  }

  listRevisions(
    period: string, signal?: AbortSignal,
  ): Promise<{ period: string; period_kind: string; revisions: AARevisionSummary[] }> {
    return listRevisions(period, signal);
  }

  readRevision(period: string, revision: number, compare = false, signal?: AbortSignal): Promise<AARevision> {
    return getRevision(period, revision, compare, signal);
  }
}
