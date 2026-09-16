import { requestJson } from './client';

export type AAValueType = 'money' | 'date' | 'duration' | 'count' | 'scale' | 'categorical';

export type AASourceKind =
  | 'OBSERVED'
  | 'USER_REPORTED'
  | 'IMPORTED'
  | 'DERIVED'
  | 'ESTIMATED'
  | 'FORECAST'
  | 'UNKNOWN';

export type AAFactStatus = 'active' | 'superseded' | 'tombstoned';

/**
 * A value in the shape its `type` requires. There is deliberately no `unknown`
 * type: a missing observation is the absence of a fact, never a stored one.
 */
export type AAValue = {
  type: AAValueType;
  unit_code?: string | null;
  num?: string | null;
  date?: string | null;
  text?: string | null;
  scale_min?: string | null;
  scale_max?: string | null;
};

export type AASubject = {
  domain: string;
  type: string;
  id?: string;
};

/** источник · основание · когда · как */
export type AAProvenance = {
  source_kind: AASourceKind;
  basis: string | null;
  method: string | null;
  recorded_at: string;
  source_ref: Record<string, unknown> | null;
  original_recorded_at_known: boolean;
};

export type AAProvenanceInput = {
  source_kind: AASourceKind;
  basis?: string | null;
  method?: string | null;
  source_ref?: Record<string, unknown> | null;
  original_recorded_at_known?: boolean;
};

export type AAMeasurement = {
  id: string;
  metric_key: string;
  subject_key: string;
  subject_domain: string;
  subject_type: string;
  subject_id: string;
  value: AAValue;
  dimensions: Record<string, unknown> | null;
  occurred_at: string;
  occurred_tz: string;
  provenance: AAProvenance;
  status: AAFactStatus;
  supersedes_id: string | null;
  superseded_by_id: string | null;
  superseded_at: string | null;
  supersede_kind: 'CORRECTION' | 'REVISION' | null;
  supersede_reason: string | null;
};

export type AACorrection = {
  measurement: AAMeasurement;
  superseded: AAMeasurement;
};

export type AACoverageReport = {
  window_start: string;
  window_end: string;
  timezone: string;
  denominator_basis: string;
  expected_denominator: number;
  observed_count: number;
  partial_count: number;
  missing_count: number;
  /** Elapsed days with no evidence either way — never «observed», never «missing». */
  unknown_coverage_count: number;
  /** Days that have not happened yet. Never counted as a miss or as a zero. */
  future_count: number;
  estimated_count: number;
  corrected_count: number;
  freshest_recorded_at: string | null;
  has_legacy_imports: boolean;
  reason: string | null;
};

/** Layers stay in separate arrays so an Actual can never be counted as a forecast. */
export type AAMetricHistory = {
  metric_key: string;
  subject_key: string | null;
  range_from: string;
  range_to: string;
  as_of: string | null;
  actual: AAMeasurement[];
  expectations: AAMeasurement[];
  forecasts: AAMeasurement[];
  baselines: AAMeasurement[];
  events: AAMeasurement[];
  coverage: AACoverageReport | null;
  next_cursor: string | null;
};

export type AAFactProvenance = {
  fact_table: string;
  fact_id: string;
  provenance: AAProvenance;
  status: AAFactStatus;
  supersedes_id: string | null;
  superseded_by_id: string | null;
  supersede_kind: 'CORRECTION' | 'REVISION' | null;
  supersede_reason: string | null;
};

export type RecordMeasurementInput = {
  metric_key: string;
  subject: AASubject;
  value: AAValue;
  occurred_at: string;
  occurred_tz: string;
  provenance: AAProvenanceInput;
  dimensions?: Record<string, unknown> | null;
  idempotency_key: string;
};

export type CorrectMeasurementInput = {
  value: AAValue;
  reason: string;
  provenance: AAProvenanceInput;
  dimensions?: Record<string, unknown> | null;
  idempotency_key: string;
};

export type MetricHistoryQuery = {
  from: string;
  to: string;
  subject?: string;
  asOf?: string;
  coverageFrom?: string;
  coverageTo?: string;
  timezone?: string;
  cursor?: string;
  limit?: number;
};

export function recordMeasurement(input: RecordMeasurementInput): Promise<AAMeasurement> {
  return requestJson<AAMeasurement>('/api/v1/aa/measurements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function correctMeasurement(
  measurementId: string,
  input: CorrectMeasurementInput,
): Promise<AACorrection> {
  return requestJson<AACorrection>(
    `/api/v1/aa/measurements/${encodeURIComponent(measurementId)}/correct`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function getMetricHistory(
  metricKey: string,
  query: MetricHistoryQuery,
  signal?: AbortSignal,
): Promise<AAMetricHistory> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.subject != null) params.set('subject', query.subject);
  if (query.asOf != null) params.set('as_of', query.asOf);
  if (query.coverageFrom != null) params.set('coverage_from', query.coverageFrom);
  if (query.coverageTo != null) params.set('coverage_to', query.coverageTo);
  if (query.timezone != null) params.set('timezone', query.timezone);
  if (query.cursor != null) params.set('cursor', query.cursor);
  if (query.limit != null) params.set('limit', String(query.limit));
  return requestJson<AAMetricHistory>(
    `/api/v1/aa/metrics/${encodeURIComponent(metricKey)}/history?${params.toString()}`,
    { signal },
  );
}

export function getFactProvenance(
  factTable: string,
  factId: string,
  signal?: AbortSignal,
): Promise<AAFactProvenance> {
  return requestJson<AAFactProvenance>(
    `/api/v1/aa/facts/${encodeURIComponent(factTable)}/${encodeURIComponent(factId)}/provenance`,
    { signal },
  );
}
