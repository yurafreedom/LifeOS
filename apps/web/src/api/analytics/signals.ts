/* Adaptive Analytics · Slice 3 signals.
   Imported through ../analytics.ts. */

import { requestJson } from '../client';

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
