import { requestJson } from './client';
import type { DerivedDelta } from '../analytics/delta';

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

export type AAFinanceMonth = {
  period: string;
  subject_key: string;
  timezone: string;
  as_of: string;
  availability: 'present' | 'no_data' | 'insufficient_data';
  actual: AAValue | null;
  known_subtotal: AAValue | null;
  transaction_count: number;
  excluded_count: number;
  unknown_membership_count: number;
  policy_known: boolean;
  persisted: false;
  derivation: string;
  series: Array<{ date: string; amount: string }>;
  expectations: AASemanticFact[];
  targets: AASemanticFact[];
  current_expectation: AASemanticFact | null;
  current_target: AASemanticFact | null;
  delta: DerivedDelta;
  desire: 'neutral' | 'favorable' | 'unfavorable' | 'unknown';
  coverage: AACoverageReport;
};

export function getFinanceMonth(
  period: string,
  timezone: string,
  signal?: AbortSignal,
): Promise<AAFinanceMonth> {
  const params = new URLSearchParams({ timezone });
  return requestJson<AAFinanceMonth>(
    `/api/v1/aa/finance/months/${encodeURIComponent(period)}?${params}`,
    { signal },
  );
}

export type LegacyImportResult = {
  transactions_imported: number;
  transactions_replayed: number;
  policies_imported: number;
  policies_replayed: number;
  overrides_imported: number;
  overrides_replayed: number;
  coverage_imported: number;
  coverage_replayed: number;
  activity_log_imported: 0;
  expectations_backfilled: 0;
  forecasts_backfilled: 0;
  targets_backfilled: 0;
  baselines_backfilled: 0;
  synthetic_coverage_backfilled: 0;
  moneywidget_budget_backfilled: 0;
};

export function importLegacyTransactions(timezone: string): Promise<LegacyImportResult> {
  return requestJson<LegacyImportResult>('/api/v1/aa/import/legacy-transactions', {
    method: 'POST',
    body: JSON.stringify({ timezone, coverage: [] }),
  });
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

/* ── Slice 3 · signals ───────────────────────────────────────────────── */

/** The accepted Signal Card visual family. `resolved` is episode state. */
export type AASignalState = 'normal' | 'material' | 'info' | 'stale' | 'partial' | 'resolved';
/** The ranking dimension. Never desirability — no rule may set `desire`. */
export type AASignalMateriality = 'normal' | 'info' | 'material';
/** Why absence of cards is absence of cards. Never «everything is fine» on faith. */
export type AAZeroSignalState = 'confident' | 'unknown_coverage' | 'no_data';

/**
 * One evaluated signal.
 *
 * `rendered_values` carries values, not copy: the card's sentence is composed
 * client-side from `rule_id` plus these values, so production copy stays in the
 * ru/uk dictionaries and the API never hardcodes a language.
 */
export type AASignal = {
  episode_key: string;
  rule_id: string;
  rule_version: number;
  subject_domain: string;
  subject_type: string;
  subject_id: string;
  subject_key: string;
  state: AASignalState;
  materiality: AASignalMateriality;
  /** Warm accent. True only when the underlying event is itself a stakes event. */
  stakes: boolean;
  rendered_values: Record<string, unknown>;
  provenance: Record<string, unknown>;
  /** sha256 of the exact input versions. Returned on acknowledgement so a card
   *  that changed underneath cannot be dismissed unseen. */
  input_fingerprint: string;
  first_seen_at: string;
  last_evaluated_at: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  reopened_count: number;
};

export type AASignalCoverageConfidence = {
  subjects_evaluated: number;
  subjects_with_coverage_window: number;
  subjects_with_coverage_evidence: number;
  subjects_with_unknown_coverage: number;
};

export type AASignals = {
  as_of: string;
  limit: number;
  signals: AASignal[];
  /** Episodes still holding that the user already dismissed, so the `resolved`
   *  state renders from real data rather than from remembered client state. */
  acknowledged: AASignal[];
  active_total: number;
  zero_state: AAZeroSignalState;
  coverage: AASignalCoverageConfidence;
  /** False when the AA write gate is closed: evaluated read-only. */
  persisted: boolean;
};

export type AASignalEpisode = {
  episode_key: string;
  rule_id: string;
  rule_version: number;
  subject_key: string;
  resolution: 'acknowledged' | 'withdrawn' | null;
  first_seen_at: string;
  last_evaluated_at: string;
  last_fingerprint: string;
  acknowledged_at: string | null;
  acknowledged_fingerprint: string | null;
  reopened_at: string | null;
  reopened_count: number;
  replayed: boolean;
};

export function getSignals(
  query: { limit?: number; timezone?: string; asOf?: string } = {},
  signal?: AbortSignal,
): Promise<AASignals> {
  const params = new URLSearchParams();
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.timezone != null) params.set('timezone', query.timezone);
  if (query.asOf != null) params.set('as_of', query.asOf);
  return requestJson<AASignals>(`/api/v1/aa/signals?${params.toString()}`, { signal });
}

/** Dismissal is acknowledgement against an episode, never a deletion. */
export function acknowledgeSignalEpisode(
  episodeKey: string,
  inputFingerprint: string,
): Promise<AASignalEpisode> {
  return requestJson<AASignalEpisode>(
    `/api/v1/aa/signal-episodes/${encodeURIComponent(episodeKey)}/ack`,
    {
      method: 'POST',
      body: JSON.stringify({ resolution: 'acknowledged', input_fingerprint: inputFingerprint }),
    },
  );
}

/* ── Slice 4 · Review / Debrief ─────────────────────────────────────────── */

export type AAReviewSection = 'compare' | 'quality' | 'alongside';
export type AAReviewRole =
  | 'expected' | 'forecast' | 'actual' | 'delta' | 'target' | 'coverage' | 'observation';
export type AAReviewAvailability =
  | 'present' | 'no_data' | 'insufficient_data' | 'not_applicable'
  | 'explicitly_absent' | 'explicitly_unknown';
export type AAReviewSourceState = 'current' | 'corrected' | 'revised' | 'withdrawn' | 'redacted';
export type AAEpistemicKind = 'observed' | 'mine' | 'maybe' | 'unknown';
/** `null` is «Пока без решения» — never the same as `'inconclusive'`. */
export type AAReviewChoice = 'keep' | 'adjust' | 'later' | 'inconclusive';

export type AAReviewItemProvenance = {
  source_kind: AASourceKind | null;
  basis: string | null;
  method: string | null;
  recorded_at: string | null;
  original_recorded_at_known: boolean | null;
};

export type AAReviewItem = {
  ordinal: number;
  section: AAReviewSection;
  role: AAReviewRole;
  label_key: string;
  metric_key: string | null;
  /** `null` only when the item was redacted by a hard deletion. */
  availability: AAReviewAvailability | null;
  value: AAValue | null;
  desire: 'neutral' | 'favorable' | 'unfavorable' | 'unknown' | null;
  epistemic_kind: AAEpistemicKind | null;
  estimate: boolean;
  provenance: AAReviewItemProvenance | null;
  redacted: boolean;
  source_state: AAReviewSourceState | null;
  source_flags: AAReviewSourceState[];
  /** A later value shown *beside* the frozen one, never instead of it. */
  current_value: AAValue | null;
};

export type AAReviewManifest = {
  manifest_version: number;
  subject_kind: 'finance_period' | 'project';
  sections: Array<{ key: AAReviewSection; ordinals: number[] }>;
};

export type AAReviewContext = {
  subject_key: string;
  window_start: string;
  window_end: string;
  timezone: string;
  context_as_of: string;
  context_fingerprint: string;
  manifest: AAReviewManifest;
  items: AAReviewItem[];
};

export type AAReviewFactor = {
  id: string;
  ordinal: number;
  text: string;
  epistemic_kind: AAEpistemicKind;
  added_in_revision: number;
  retracted_in_revision: number | null;
  replaces_id: string | null;
};

export type AAReviewDecision = {
  id: string;
  choice: AAReviewChoice | null;
  revision: number;
  superseded_in_revision: number | null;
  created_at: string;
};

export type AAReview = {
  id: string;
  subject: { domain: string; type: string; id: string };
  subject_key: string;
  window_start: string;
  window_end: string;
  timezone: string;
  context_as_of: string;
  created_at: string;
  revised_at: string | null;
  current_revision: number;
  manifest: AAReviewManifest;
  items: AAReviewItem[];
  revisions: Array<{ revision: number; created_at: string; note_text: string | null }>;
  factors: AAReviewFactor[];
  /** `null` — the step was skipped; `{ choice: null }` — «Пока без решения». */
  decision: AAReviewDecision | null;
  decisions: AAReviewDecision[];
  replayed: boolean;
};

export type AAReviewSummary = {
  id: string;
  subject_key: string;
  window_start: string;
  window_end: string;
  created_at: string;
  revised_at: string | null;
  current_revision: number;
  decision_state: 'none' | 'undecided' | 'chosen';
  decision_choice: AAReviewChoice | null;
};

export type AAReviewList = { subject_key: string; limit: number; reviews: AAReviewSummary[] };

export function getReviewContext(
  query: { subject: string; from: string; to: string; timezone?: string },
  signal?: AbortSignal,
): Promise<AAReviewContext> {
  const params = new URLSearchParams({ subject: query.subject, from: query.from, to: query.to });
  if (query.timezone != null) params.set('timezone', query.timezone);
  return requestJson<AAReviewContext>(`/api/v1/aa/reviews/context?${params.toString()}`, { signal });
}

export function getReview(reviewId: string, signal?: AbortSignal): Promise<AAReview> {
  return requestJson<AAReview>(`/api/v1/aa/reviews/${encodeURIComponent(reviewId)}`, { signal });
}

export function listReviews(
  subject: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<AAReviewList> {
  const params = new URLSearchParams({ subject, limit: String(limit) });
  return requestJson<AAReviewList>(`/api/v1/aa/reviews?${params.toString()}`, { signal });
}
