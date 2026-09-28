/* Adaptive Analytics · semantic concepts (expectation, forecast, baseline,
   target, preference, observation) and subject summary/coverage reads.
   Imported through ../analytics.ts. */

import { requestJson } from '../client';
import type { DerivedDelta } from '../../analytics/delta';
import type {
  AACoverageReport,
  AAMeasurement,
  AAProvenanceInput,
  AASemanticFact,
  AASubject,
  AAValue,
  AAValueType,
  DesiredDirection,
  EpistemicKind,
} from './facts';

export type AAComparison = {
  metric_key: string | null; current_concept: 'actual' | 'forecast' | 'observation' | null;
  current_id: string | null; reference_concept: 'expectation' | 'baseline' | null;
  reference_id: string | null; availability: 'present' | 'no_data' | 'insufficient_data';
  delta: DerivedDelta; desire: 'neutral' | 'favorable' | 'unfavorable' | 'unknown';
  grounding_id: string | null; grounding_kind: 'target' | 'preference' | 'decision' | null;
  coverage: AACoverageReport | null;
};
export type AASubjectSummary = {
  subject_key: string; as_of: string; truncated: boolean; actual: AAMeasurement[];
  expectations: AASemanticFact[]; forecasts: AASemanticFact[]; baselines: AASemanticFact[];
  targets: AASemanticFact[]; preferences: AASemanticFact[]; observations: AASemanticFact[];
  comparisons: AAComparison[];
};
type SemanticInput = { subject: AASubject; metric_key?: string | null; provenance: AAProvenanceInput; idempotency_key: string };
type ValueInput = SemanticInput & { value: AAValue; dimensions?: Record<string, unknown> | null };
type WindowInput = { window_start: string; window_end: string; timezone: string };
export type RecordExpectationInput = ValueInput & WindowInput & { effective_from: string };
export type RecordForecastInput = ValueInput & { horizon_at: string };
export type RecordBaselineInput = ValueInput & WindowInput;
export type RecordTargetInput = SemanticInput & WindowInput & { desired_direction: DesiredDirection; declared_value_type?: AAValueType; dimensions?: Record<string, unknown> | null } & (
  { value: AAValue; is_explicitly_absent?: false } | { value?: null; is_explicitly_absent: true }
);
export type RecordPreferenceInput = SemanticInput & { statement: string; desired_direction: DesiredDirection; effective_from: string };
export type RecordObservationInput = SemanticInput & { epistemic_kind?: EpistemicKind; occurred_at: string; occurred_tz: string; dimensions?: Record<string, unknown> | null; declared_value_type?: AAValueType } & (
  { value: AAValue; value_availability?: 'present' } | { value?: null; value_availability: 'explicitly_unknown' }
);

function postSemantic(path: string, input: object): Promise<AASemanticFact> {
  return requestJson<AASemanticFact>(`/api/v1/aa/${path}`, { method: 'POST', body: JSON.stringify(input) });
}
export const recordExpectation = (input: RecordExpectationInput) => postSemantic('expectations', input);
export const recordForecast = (input: RecordForecastInput) => postSemantic('forecasts', input);
export const recordBaseline = (input: RecordBaselineInput) => postSemantic('baselines', input);
export const recordTarget = (input: RecordTargetInput) => postSemantic('targets', input);
export const recordPreference = (input: RecordPreferenceInput) => postSemantic('preferences', input);
export const recordObservation = (input: RecordObservationInput) => postSemantic('observations', input);

export function getSubjectSummary(key: string, query: { asOf?: string; metricKey?: string } = {}, signal?: AbortSignal): Promise<AASubjectSummary> {
  const params = new URLSearchParams();
  if (query.asOf) params.set('as_of', query.asOf);
  if (query.metricKey) params.set('metric_key', query.metricKey);
  return requestJson<AASubjectSummary>(`/api/v1/aa/subjects/${encodeURIComponent(key)}/summary?${params}`, { signal });
}
export function getSubjectCoverage(key: string, query: { from: string; to: string; timezone: string; asOf?: string }, signal?: AbortSignal): Promise<AACoverageReport> {
  const params = new URLSearchParams({ from: query.from, to: query.to, timezone: query.timezone });
  if (query.asOf) params.set('as_of', query.asOf);
  return requestJson<AACoverageReport>(`/api/v1/aa/subjects/${encodeURIComponent(key)}/coverage?${params}`, { signal });
}
