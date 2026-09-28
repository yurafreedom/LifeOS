/* Adaptive Analytics · shared fact vocabulary (values, subjects, provenance),
   measurements, corrections, coverage and metric-history types.
   Imported through ../analytics.ts. */

import { requestJson } from '../client';

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
  expectations: AASemanticFact[];
  forecasts: AASemanticFact[];
  baselines: AASemanticFact[];
  events: AAMeasurement[];
  coverage: AACoverageReport | null;
  next_cursor: string | null;
  layer_cursors: Record<string, string | null>;
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
  expectationCursor?: string;
  forecastCursor?: string;
  baselineCursor?: string;
  layers?: Array<'actual' | 'expectations' | 'forecasts' | 'baselines' | 'events'>;
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

export function correctMeasurementByIdempotencyKey(
  measurementKey: string,
  input: CorrectMeasurementInput,
): Promise<AACorrection> {
  return requestJson<AACorrection>(
    `/api/v1/aa/measurements/by-idempotency/${encodeURIComponent(measurementKey)}/correct`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

/* Semantic-concept vocabulary shared by history, finance and semantic reads. */
export type SemanticConcept = 'expectation' | 'forecast' | 'baseline' | 'target' | 'preference' | 'observation';
export type DesiredDirection = 'higher' | 'lower';
export type EpistemicKind = 'observed' | 'mine' | 'maybe' | 'unknown';
export type AASemanticFact = {
  id: string; concept: SemanticConcept; fact_table: string; subject_key: string;
  metric_key: string | null; value: AAValue | null; value_type: AAValueType | null;
  dimensions: Record<string, unknown> | null; provenance: AAProvenance; status: AAFactStatus;
  supersedes_id: string | null; superseded_by_id: string | null;
  superseded_at: string | null; supersede_kind: 'CORRECTION' | 'REVISION' | null;
  supersede_reason: string | null; effective_from: string | null; horizon_at: string | null;
  window_start: string | null; window_end: string | null; timezone: string | null;
  occurred_at: string | null; occurred_tz: string | null;
  is_explicitly_absent: boolean | null; desired_direction: DesiredDirection | null;
  statement: string | null; epistemic_kind: EpistemicKind | null;
  value_availability: 'present' | 'explicitly_unknown' | null;
};
