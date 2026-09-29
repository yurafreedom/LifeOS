/* Adaptive Analytics · Slice 6 Experiments (reads). Writes go through the
   durable queue (see analytics/experimentFacts.ts). Imported through ../analytics.ts. */

import { requestJson } from '../client';
import type { DerivedDelta } from '../../analytics/delta';
import type { AAProvenance, AASemanticFact, AAValue } from './facts';

export type AAExperimentLifecycle =
  | 'DRAFT' | 'RUNNING' | 'COMPLETED_AWAITING_REVIEW' | 'REVIEWED' | 'ABANDONED';
/** `null` is «Пока без решения» — never the same as `'inconclusive'`. */
export type ExperimentDecisionChoice = 'keep' | 'modify' | 'longer' | 'reject' | 'inconclusive';
export type AAAdherenceState =
  | 'kept' | 'missed' | 'unknown' | 'not_recorded' | 'future' | 'not_run_after_stop';
export type AAExperimentOutcomeType = 'money' | 'duration' | 'count' | 'scale';

export type AAAdherenceDay = {
  day: string;
  state: AAAdherenceState;
  record: { id: string; idempotency_key: string; recorded_at: string; corrected: boolean } | null;
};

export type AAAdherence = {
  applicable: boolean;
  denominator_basis: 'experiment_elapsed_days';
  total_days: number;
  elapsed_days: number;
  kept: number;
  missed: number;
  unknown: number;
  not_recorded: number;
  future: number;
  not_run_after_stop: number;
  abandon_day: string | null;
  days: AAAdherenceDay[];
  correction_count: number;
};

export type AAExperimentObservation = {
  id: string;
  role: 'outcome' | 'context';
  label: string;
  value: AAValue | null;
  occurred_at: string;
  occurred_tz: string;
  provenance: AAProvenance;
  status: string;
  supersedes_id: string | null;
  superseded_by_id: string | null;
};

export type AAExperimentResult = {
  state: 'not_applicable' | 'too_early' | 'no_data' | 'known';
  reason: string | null;
  outcome_day: string | null;
  covered_days: number | null;
  summary: { baselines: AASemanticFact[]; observations: AAExperimentObservation[] };
  comparison: {
    metric_key: null;
    current_concept: 'observation';
    current_id: string | null;
    reference_concept: 'baseline';
    reference_id: string | null;
    availability: 'present' | 'no_data';
    delta: DerivedDelta;
    desire: 'neutral' | 'unknown';
    grounding_id: null;
    grounding_kind: null;
    coverage: null;
  };
};

export type AAExperimentFactor = {
  id: string;
  text: string;
  epistemic_kind: 'observed' | 'mine' | 'maybe' | 'unknown';
  added_in_revision: number;
  retracted_in_revision: number | null;
  replaces_id: string | null;
};

export type AAExperimentDetail = {
  id: string;
  title: string;
  hypothesis: string;
  hypothesis_recorded_at: string;
  intervention: string;
  created_at: string;
  evaluated_at: string;
  window: {
    start: string; end: string; timezone: string; total_days: number; local_today: string;
    window_elapsed: boolean; completion_due: boolean;
  };
  outcome: {
    label: string; value_type: AAExperimentOutcomeType; unit_code: string | null;
    scale_min: string | null; scale_max: string | null;
  };
  lifecycle: AAExperimentLifecycle;
  abandoned_from: AAExperimentLifecycle | null;
  lifecycle_events: Array<{ state: AAExperimentLifecycle; occurred_at: string }>;
  adherence: AAAdherence;
  baseline: AASemanticFact | null;
  baselines: AASemanticFact[];
  observations: { outcome: AAExperimentObservation[]; context: AAExperimentObservation[] };
  conditions: AASemanticFact[];
  result: AAExperimentResult;
  decision: {
    current: { choice: ExperimentDecisionChoice | null; revision: number; created_at: string } | null;
    history: Array<{
      choice: ExperimentDecisionChoice | null; revision: number; created_at: string;
      superseded_in_revision: number | null;
    }>;
    factors: AAExperimentFactor[];
  };
  replayed?: boolean;
  no_op?: boolean;
};

export type AAExperimentListItem = {
  id: string;
  title: string;
  lifecycle: AAExperimentLifecycle;
  abandoned_from: AAExperimentLifecycle | null;
  window_start: string;
  window_end: string;
  timezone: string;
  window_elapsed: boolean;
  completion_due: boolean;
  created_at: string;
};

export type AAExperimentList = {
  lifecycles: AAExperimentLifecycle[];
  limit: number;
  experiments: AAExperimentListItem[];
};

export function getExperiment(experimentId: string, signal?: AbortSignal): Promise<AAExperimentDetail> {
  return requestJson<AAExperimentDetail>(
    `/api/v1/aa/experiments/${encodeURIComponent(experimentId)}`,
    { signal },
  );
}

export function listExperiments(
  query: { lifecycles?: AAExperimentLifecycle[]; limit?: number } = {},
  signal?: AbortSignal,
): Promise<AAExperimentList> {
  const params = new URLSearchParams();
  for (const lifecycle of query.lifecycles ?? []) params.append('lifecycle', lifecycle);
  if (query.limit != null) params.set('limit', String(query.limit));
  const search = params.toString();
  return requestJson<AAExperimentList>(`/api/v1/aa/experiments${search ? `?${search}` : ''}`, { signal });
}
