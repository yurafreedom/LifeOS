/* Adaptive Analytics · Slice 5 Project Analytics (read-only).
   Imported through ../analytics.ts. */

import { requestJson } from '../client';
import type { DerivedDelta } from '../../analytics/delta';
import type { AAMeasurement, AASemanticFact } from './facts';

export type AAProjectAnalyticsState =
  | 'no_facts' | 'too_early' | 'actual_not_recorded' | 'no_forecast' | 'compared';

/** Actual minus one Forecast version. No normative source is read: neutral. */
export type AAProjectDelta = {
  reference_forecast_id: string | null;
  delta: DerivedDelta;
  desire: 'neutral' | 'favorable' | 'unfavorable' | 'unknown';
  grounding_id: string | null;
  grounding_kind: 'target' | 'preference' | 'decision' | null;
};

/** Forecast versions and the Actual are separate fields; the Actual is never a version. */
export type AAProjectAnalytics = {
  subject_key: string;
  metric_key: string;
  as_of: string | null;
  evaluated_at: string;
  state: AAProjectAnalyticsState;
  forecast_versions: AASemanticFact[];
  forecast_version_count: number;
  forecast_versions_truncated: boolean;
  withdrawn_forecast_count: number;
  first_forecast: AASemanticFact | null;
  latest_forecast: AASemanticFact | null;
  actual: AAMeasurement | null;
  actual_count: number;
  actual_corrections: AAMeasurement[];
  delta_vs_first: AAProjectDelta;
  delta_vs_latest: AAProjectDelta;
  observation_count: number;
};

export function getProjectAnalytics(
  projectId: string,
  query: { asOf?: string } = {},
  signal?: AbortSignal,
): Promise<AAProjectAnalytics> {
  const params = new URLSearchParams();
  if (query.asOf != null) params.set('as_of', query.asOf);
  const search = params.toString();
  const suffix = search ? `?${search}` : '';
  return requestJson<AAProjectAnalytics>(
    `/api/v1/aa/projects/${encodeURIComponent(projectId)}/analytics${suffix}`,
    { signal },
  );
}
