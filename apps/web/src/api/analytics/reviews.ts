/* Adaptive Analytics · Slice 4 Review / Debrief.
   Imported through ../analytics.ts. */

import { requestJson } from '../client';
import type { AASourceKind, AAValue } from './facts';

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
