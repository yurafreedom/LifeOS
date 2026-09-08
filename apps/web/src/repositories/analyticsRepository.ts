import {
  correctMeasurement,
  getFactProvenance,
  getMetricHistory,
  recordMeasurement,
} from '../api/analytics';
import type {
  AACorrection,
  AAFactProvenance,
  AAMeasurement,
  AAMetricHistory,
  AASubject,
  AAValue,
  CorrectMeasurementInput,
  MetricHistoryQuery,
  RecordMeasurementInput,
} from '../api/analytics';

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
}
