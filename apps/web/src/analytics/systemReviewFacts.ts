/**
 * System Review (Slice 7) — pure request builders, hash routing and period helpers.
 *
 * Every write is one durable queue record with a fixed route and payload; the
 * queue mints the idempotency key at enqueue time. A user link and a finance
 * context carry a client-minted UUID so a follow-up (note edit, removal, a new
 * version) can be queued before the first write is acknowledged.
 *
 * Nothing here computes analytics: periods, statuses, proposals and
 * projections all come from the server.
 */
import { LIFEOS_TIME_ZONE } from './timezone';

export const SYSTEM_REVIEW_ROUTE = 'system-review';
const AA = '/api/v1/aa';
const PERIOD = /^\d{4}(-(0[1-9]|1[0-2]))?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Relation vocabulary. Nothing here asserts a cause; `may_*` are marked hypotheses. */
export const RELATION_TYPES = [
  'related', 'temporally_associated', 'co_occurs_with', 'conflicts_with', 'supports',
  'preceded_by', 'followed_by', 'may_contribute_to', 'may_increase_risk_of',
  'may_reduce_probability_of',
] as const;
export const HYPOTHESIS_TYPES: readonly string[] = [
  'may_contribute_to', 'may_increase_risk_of', 'may_reduce_probability_of',
];
export const RELATION_STATUSES = ['approved', 'unsure', 'rejected'] as const;
export const IMPORTANCE = ['none', 'matters', 'ok', 'ignore'] as const;
export const FUNDING_SOURCES = [
  'unknown', 'income', 'cash_balance', 'debit_balance', 'credit', 'borrowed', 'mixed',
] as const;
export const SELF_CHECK_QUESTIONS = [
  'q_know_total', 'q_repayment_plan', 'q_payments_delayed', 'q_new_spend_on_credit',
  'q_avoid_checking', 'q_income_sufficient', 'q_pattern_repeat',
] as const;

export type SystemReviewOperation =
  | 'relation.create'
  | 'relation.respond'
  | 'relation.feedback'
  | 'relation.delete'
  | 'importance.set'
  | 'finance_context.append'
  | 'finance_context.delete'
  | 'system_review.revision';

export type SystemReviewQueueRequest = {
  operation_type: SystemReviewOperation;
  route: string;
  payload: Record<string, unknown>;
};

export function isHypothesis(relationType: string): boolean {
  return HYPOTHESIS_TYPES.includes(relationType);
}

export function newClientId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  throw new Error('A UUID v4 generator is required for durable analytics writes.');
}

function requireUuid(id: string): string {
  if (!UUID.test(id)) throw new TypeError('An id is a UUID.');
  return id;
}

function requirePeriod(period: string): string {
  if (!PERIOD.test(period)) throw new TypeError('A period is YYYY-MM or YYYY.');
  return period;
}

function note(text: string | null | undefined): string | null {
  const trimmed = (text ?? '').trim();
  return trimmed ? trimmed : null;
}

export function relationCreateRequest(input: {
  fromKey: string;
  toKey: string;
  relationType?: string;
  note?: string | null;
  period?: string | null;
  id?: string;
}): SystemReviewQueueRequest {
  const relationType = input.relationType ?? 'related';
  if (!(RELATION_TYPES as readonly string[]).includes(relationType)) {
    throw new TypeError('Unknown relation type.');
  }
  if (input.fromKey === input.toKey) throw new TypeError('An item cannot be related to itself.');
  return {
    operation_type: 'relation.create',
    route: `${AA}/relations`,
    payload: {
      id: requireUuid(input.id ?? newClientId()),
      from_key: input.fromKey,
      to_key: input.toKey,
      relation_type: relationType,
      note: note(input.note),
      period: input.period ? requirePeriod(input.period) : null,
    },
  };
}

export function proposalResponseRequest(
  candidate: { proposal_key: string; period: string },
  response: 'approved' | 'rejected' | 'unsure',
  evaluatedAt: string,
  text?: string | null,
): SystemReviewQueueRequest {
  if (!/^[0-9a-f]{64}$/.test(candidate.proposal_key)) throw new TypeError('Unknown proposal.');
  return {
    operation_type: 'relation.respond',
    route: `${AA}/relations/proposals/respond`,
    payload: {
      period: requirePeriod(candidate.period),
      proposal_key: candidate.proposal_key,
      response,
      note: note(text),
      evaluated_at: evaluatedAt,
    },
  };
}

export function relationFeedbackRequest(
  relationId: string, response: 'approved' | 'rejected' | 'unsure', text?: string | null,
): SystemReviewQueueRequest {
  return {
    operation_type: 'relation.feedback',
    route: `${AA}/relations/${requireUuid(relationId)}/feedback`,
    payload: { response, note: note(text) },
  };
}

export function relationDeleteRequest(relationId: string): SystemReviewQueueRequest {
  return {
    operation_type: 'relation.delete',
    route: `${AA}/relations/${requireUuid(relationId)}/delete`,
    payload: {},
  };
}

export function importanceRequest(
  targetKey: string, importance: typeof IMPORTANCE[number],
): SystemReviewQueueRequest {
  if (!(IMPORTANCE as readonly string[]).includes(importance)) {
    throw new TypeError('Unknown importance.');
  }
  return {
    operation_type: 'importance.set',
    route: `${AA}/importance`,
    payload: { target_key: targetKey, importance },
  };
}

/** Drop empty strings so an untouched optional field stays absent, never "". */
export function cleanPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(payload)) {
    if (value == null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    out[name] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
}

export function financeContextRequest(input: {
  kind: 'expense_context' | 'obligation' | 'reserve' | 'essentials' | 'self_check';
  payload: Record<string, unknown>;
  subjectKey?: string;
  entityId?: string;
}): SystemReviewQueueRequest {
  return {
    operation_type: 'finance_context.append',
    route: `${AA}/finance-contexts`,
    payload: {
      entity_id: requireUuid(input.entityId ?? newClientId()),
      kind: input.kind,
      subject_key: input.subjectKey ?? '',
      payload: input.kind === 'self_check' ? input.payload : cleanPayload(input.payload),
    },
  };
}

export function financeContextDeleteRequest(entityId: string): SystemReviewQueueRequest {
  return {
    operation_type: 'finance_context.delete',
    route: `${AA}/finance-contexts/${requireUuid(entityId)}/delete`,
    payload: {},
  };
}

export function revisionRequest(period: string, input: {
  baseRevision: number | null;
  finalize: boolean;
  reflection?: string | null;
  noConclusion?: boolean;
  decisions?: string[];
  adjustments?: string[];
  timezone?: string;
}): SystemReviewQueueRequest {
  const lines = (values: string[] | undefined) => (values ?? []).map(v => v.trim()).filter(Boolean);
  const noConclusion = Boolean(input.noConclusion);
  return {
    operation_type: 'system_review.revision',
    route: `${AA}/system-reviews/${requirePeriod(period)}/revisions`,
    payload: {
      base_revision: input.baseRevision,
      finalize: input.finalize,
      reflection: noConclusion ? null : note(input.reflection),
      no_conclusion: noConclusion,
      decisions: lines(input.decisions),
      adjustments: lines(input.adjustments),
      timezone: input.timezone ?? LIFEOS_TIME_ZONE,
    },
  };
}

// ───────────────────────────── periods ─────────────────────────────

export function currentMonthKey(now = new Date(), timeZone = LIFEOS_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' })
    .formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  return `${year}-${month}`;
}

export function isYear(period: string): boolean {
  return /^\d{4}$/.test(period);
}

export function shiftPeriod(period: string, delta: number): string {
  requirePeriod(period);
  if (isYear(period)) return String(Number(period) + delta);
  const [year, month] = period.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** A period is reachable only once it has started (the server refuses the future). */
export function periodStarted(period: string, now = new Date()): boolean {
  const current = currentMonthKey(now);
  return isYear(period) ? period <= current.slice(0, 4) : period <= current;
}

// ───────────────────────────── hash routing ─────────────────────────────

export type SystemReviewView =
  | { view: 'review'; period: string; tab: 'review' | 'tradeoff' }
  | { view: 'revision'; period: string; revision: number }
  | { view: 'waiting' };

/** `#/system-review[/<period>[/tradeoff | /revisions/<n>]] | #/system-review/waiting`. */
export function parseSystemReviewHash(hash: string, now = new Date()): SystemReviewView | null {
  const raw = (hash || '').replace(/^#\/?/, '');
  if (raw !== SYSTEM_REVIEW_ROUTE && !raw.startsWith(`${SYSTEM_REVIEW_ROUTE}/`)) return null;
  const parts = raw.split('/').slice(1).filter(Boolean);
  if (parts.length === 0) return { view: 'review', period: currentMonthKey(now), tab: 'review' };
  if (parts[0] === 'waiting' && parts.length === 1) return { view: 'waiting' };
  const [period, leaf, revision] = parts;
  if (!PERIOD.test(period)) return null;
  if (parts.length === 1) return { view: 'review', period, tab: 'review' };
  if (leaf === 'tradeoff' && parts.length === 2) return { view: 'review', period, tab: 'tradeoff' };
  if (leaf === 'revisions' && parts.length === 3 && /^[1-9]\d{0,5}$/.test(revision)) {
    return { view: 'revision', period, revision: Number(revision) };
  }
  return null;
}

export function systemReviewHash(period?: string, tab: 'review' | 'tradeoff' = 'review'): string {
  if (!period) return `#/${SYSTEM_REVIEW_ROUTE}`;
  requirePeriod(period);
  return `#/${SYSTEM_REVIEW_ROUTE}/${period}${tab === 'tradeoff' ? '/tradeoff' : ''}`;
}

export function revisionHash(period: string, revision: number): string {
  return `#/${SYSTEM_REVIEW_ROUTE}/${requirePeriod(period)}/revisions/${revision}`;
}

export function waitingHash(): string {
  return `#/${SYSTEM_REVIEW_ROUTE}/waiting`;
}
