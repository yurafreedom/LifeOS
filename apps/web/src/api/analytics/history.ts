/* Adaptive Analytics · metric history and fact provenance reads.
   Imported through ../analytics.ts. */

import { requestJson } from '../client';
import type { AAFactProvenance, AAMetricHistory, MetricHistoryQuery } from './facts';

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
  if (query.expectationCursor != null) params.set('expectation_cursor', query.expectationCursor);
  if (query.forecastCursor != null) params.set('forecast_cursor', query.forecastCursor);
  if (query.baselineCursor != null) params.set('baseline_cursor', query.baselineCursor);
  if (query.layers != null) params.set('layers', query.layers.join(','));
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
