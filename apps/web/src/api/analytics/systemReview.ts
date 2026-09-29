/* System Review (Slice 7) — reads. Writes go through the durable queue
   (analytics/systemReviewFacts.ts builds them). Every read is pure on the
   server: nothing is written because a page was opened. */

import { ApiError, NetworkError, requestJson } from '../client';

export type AATypedValue = {
  type: string;
  unit_code?: string | null;
  num?: string | null;
  date?: string | null;
  text?: string | null;
  scale_min?: string | null;
  scale_max?: string | null;
};

export type AASystemReviewItem = {
  ref: string;
  kind: string;
  domain: string;
  subject_key?: string | null;
  metric_key?: string | null;
  period: string;
  current?: { concept: string; value: AATypedValue | null; availability: string } | null;
  reference?: { concept: string; value: AATypedValue | null; availability: string } | null;
  delta?: { state: string; value?: AATypedValue; reason?: string; direction?: string } | null;
  desire: string;
  basis?: Record<string, unknown> | null;
  details: Record<string, unknown>;
  coverage?: Record<string, unknown> | null;
  provenance?: Record<string, unknown> | null;
  redacted?: boolean;
};

export type AARelationEndpoint = { key: string; domain: string; redacted?: boolean };

export type AARelation = {
  id: string;
  source: 'user' | 'rule' | 'ai';
  family: string | null;
  rule_version: number | null;
  proposal_key: string | null;
  from: AARelationEndpoint;
  to: AARelationEndpoint;
  relation_type: string;
  epistemic_kind: 'association' | 'hypothesis';
  status: 'proposed' | 'approved' | 'rejected' | 'unsure';
  note: string | null;
  period: string | null;
  proposed_at: string | null;
  responded_at: string | null;
  evidence: Array<{ ref: string; role: string }>;
  endpoint_redacted: boolean;
  evidence_changed_since_response: boolean | null;
  revisit_eligible: boolean;
  history: Array<{ response: string; note: string | null; responded_at: string }>;
};

export type AACandidate = {
  proposal_key: string;
  family: string;
  rule_version: number;
  source: 'rule';
  status: 'proposed';
  from: AARelationEndpoint;
  to: AARelationEndpoint;
  relation_type: string;
  epistemic_kind: 'association' | 'hypothesis';
  period: string;
  evidence: Array<{ ref: string; role: string }>;
  conditions: Array<{ field: string; value: unknown }>;
  input_fingerprint: string;
  rank: number;
  history: { approved: number; rejected: number; unsure: number };
};

export type AAImpact = {
  kind: string;
  state: 'computed' | 'needs_input' | 'not_applicable';
  inputs: Array<{ name: string; value: unknown; source: string; ref: string | null }>;
  assumptions: string[];
  calculation: { formula: string; cap_months?: number } | null;
  horizon: string | null;
  result: Record<string, unknown> | null;
  missing_inputs: string[];
  limitations: string[];
  redacted?: boolean;
};

export type AAExpenseAnalysis = {
  ref: string;
  context_ref: string;
  transaction_id: string;
  expense: { amount: AATypedValue; date: string; category_id: string | null };
  context: Record<string, unknown>;
  context_version: number;
  impacts: AAImpact[];
  priority: Record<string, unknown> | null;
  attention: Array<{ flag: string; conditions: Array<{ field: string; value: unknown }> }>;
  missing_inputs: string[];
  redacted?: boolean;
};

export type AASystemReview = {
  period: string;
  period_kind: 'month' | 'year';
  timezone: string;
  window_start: string;
  window_end: string;
  evaluated_at: string;
  period_state: 'in_progress' | 'ended';
  status: 'IN_PROGRESS' | 'AVAILABLE' | 'FINALIZED';
  not_a_verdict: true;
  saved: {
    count: number;
    latest_revision: { revision: number; status: string; created_at: string } | null;
    finalized_revision: number | null;
    has_newer_draft: boolean;
  };
  sections: {
    changed: { items: AASystemReviewItem[]; truncated: boolean };
    improved: { items: AASystemReviewItem[]; truncated: boolean };
    repeated: { items: Array<Record<string, unknown>>; truncated: boolean };
    tradeoffs: { items: Array<Record<string, unknown>>; truncated: boolean };
    consequences: {
      expenses: AAExpenseAnalysis[];
      position: Record<string, unknown> | null;
      priorities: Array<Record<string, unknown>>;
      self_check: Record<string, unknown> | null;
      unplanned_count: number;
      contexts_without_transaction: number;
      funding_summary: Array<Record<string, unknown>> | null;
    };
    relations: { items: AARelation[]; truncated: boolean };
    requires_confirmation: { count: number; items: AACandidate[]; truncated: boolean };
    quality: { items: Array<Record<string, unknown>> };
  };
  linkable: Array<{ ref: string; domain: string; kind: string; details: Record<string, unknown> }>;
  importance: Record<string, { importance: string; recorded_at: string }>;
};

export type AAWaiting = {
  evaluated_at: string;
  timezone: string;
  review_available: { count: number; items: Array<Record<string, string>> };
  requires_confirmation: { count: number; items: AACandidate[]; horizon_months: number };
};

export type AAFinanceContext = {
  entity_id: string;
  kind: 'expense_context' | 'obligation' | 'reserve' | 'essentials' | 'self_check';
  subject_key: string | null;
  version: number;
  status: string;
  recorded_at: string;
  payload: Record<string, unknown>;
};

export type AARevisionSummary = {
  revision: number;
  status: 'draft' | 'finalized';
  created_at: string;
  finalized_at: string | null;
  context_as_of: string;
  redacted_at: string | null;
  has_reflection: boolean;
  no_conclusion: boolean;
  decisions: number;
  adjustments: number;
};

export type AARevision = {
  period: string;
  period_kind: 'month' | 'year';
  timezone: string;
  revision: number;
  status: 'draft' | 'finalized';
  created_at: string;
  finalized_at: string | null;
  context_as_of: string;
  reflection: string | null;
  no_conclusion: boolean;
  decisions: string[];
  adjustments: string[];
  redacted_at: string | null;
  frozen: Record<string, unknown>;
  live_sources_changed: boolean | null;
};

export type ExportFormat = 'pdf' | 'docx' | 'xlsx' | 'md';

const SR = '/api/v1/aa';
const PERIOD = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

function assertPeriod(period: string): void {
  if (!PERIOD.test(period)) throw new TypeError('A period is YYYY-MM or YYYY.');
}

function query(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value == null) continue;
    for (const entry of Array.isArray(value) ? value : [value]) search.append(name, entry);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function getSystemReview(
  period: string, timezone = 'Europe/Kyiv', signal?: AbortSignal,
): Promise<AASystemReview> {
  assertPeriod(period);
  return requestJson(`${SR}/system-review${query({ period, timezone })}`, { signal });
}

export function getSystemReviewWaiting(signal?: AbortSignal): Promise<AAWaiting> {
  return requestJson(`${SR}/system-review/waiting`, { signal });
}

export type RelationFilters = {
  status?: string[];
  type?: string[];
  source?: string[];
  domain?: string[];
  period?: string;
  importance?: string[];
};

export function listRelations(
  filters: RelationFilters = {}, signal?: AbortSignal,
): Promise<{ relations: AARelation[]; limit: number }> {
  if (filters.period) assertPeriod(filters.period);
  return requestJson(`${SR}/relations${query(filters)}`, { signal });
}

export function listFinanceContexts(
  kinds: string[] = [], signal?: AbortSignal,
): Promise<{ contexts: AAFinanceContext[] }> {
  return requestJson(`${SR}/finance-contexts${query({ kind: kinds })}`, { signal });
}

export function listRevisions(
  period: string, signal?: AbortSignal,
): Promise<{ period: string; period_kind: string; revisions: AARevisionSummary[] }> {
  assertPeriod(period);
  return requestJson(`${SR}/system-reviews/${period}/revisions`, { signal });
}

export function getRevision(
  period: string, revision: number, compare = false, signal?: AbortSignal,
): Promise<AARevision> {
  assertPeriod(period);
  if (!Number.isInteger(revision) || revision < 1) throw new TypeError('A revision is ≥ 1.');
  return requestJson(
    `${SR}/system-reviews/${period}/revisions/${revision}${compare ? '?compare=true' : ''}`,
    { signal },
  );
}

export function revisionExportPath(
  period: string, revision: number, format: ExportFormat, locale: 'ru' | 'uk',
): string {
  assertPeriod(period);
  if (!['pdf', 'docx', 'xlsx', 'md'].includes(format)) throw new TypeError('Unknown export format.');
  return `${SR}/system-reviews/${period}/revisions/${revision}/export${query({ format, locale })}`;
}

/** Download one saved revision as a file. The server streams it; nothing is written. */
export async function downloadRevisionExport(
  period: string, revision: number, format: ExportFormat, locale: 'ru' | 'uk',
): Promise<{ blob: Blob; filename: string }> {
  const path = revisionExportPath(period, revision, format, locale);
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin' });
  } catch (error) {
    throw new NetworkError(error);
  }
  if (!response.ok) {
    let code = `http_${response.status}`;
    let message = `Request failed with status ${response.status}.`;
    try {
      const body = await response.json() as { code?: string; message?: string };
      code = body.code ?? code;
      message = body.message ?? message;
    } catch { /* not JSON */ }
    throw new ApiError(response.status, code, message);
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1]
    ?? `lifeos-system-review-${period}-r${revision}.${format}`;
  return { blob: await response.blob(), filename };
}
