/**
 * Experiments (Slice 6) — pure request builders, hash routing and queue reads.
 *
 * Every Experiment write is one durable queue record with a fixed route and
 * payload. The experiment id is minted here (UUID v4) *before* the create is
 * enqueued, so a transition, adherence day or decision queued right after it
 * can already address `/experiments/<id>/…`. No builder mints an idempotency
 * key: the queue does, at enqueue time.
 *
 * Local-day helpers exist for UI enablement only. The server re-checks every
 * rule against its own clock in the experiment's IANA zone.
 */
import type {
  AAAdherenceState,
  AAExperimentLifecycle,
  AAExperimentOutcomeType,
  ExperimentDecisionChoice,
} from '../api/analytics/experiments';
import { pendingCreates, pendingExperimentRecords } from './experimentQueue';
import { LIFEOS_TIME_ZONE, localDateForInstant, parseDateOnly } from './timezone';

export { pendingCreates, pendingExperimentRecords };

export const EXPERIMENT_ROUTE = 'experiment';
export const EXPERIMENTS_API = '/api/v1/aa/experiments';
export const EXPERIMENT_TIME_ZONE = LIFEOS_TIME_ZONE;
export const EXPERIMENT_LIFECYCLES: readonly AAExperimentLifecycle[] = [
  'DRAFT', 'RUNNING', 'COMPLETED_AWAITING_REVIEW', 'REVIEWED', 'ABANDONED',
];
/** The Phase B allow-list: ABANDONED and REVIEWED are never pending. */
export const PENDING_LIFECYCLES: readonly AAExperimentLifecycle[] = [
  'DRAFT', 'RUNNING', 'COMPLETED_AWAITING_REVIEW',
];
export const EXPERIMENT_CHOICES: readonly ExperimentDecisionChoice[] = [
  'keep', 'modify', 'longer', 'reject', 'inconclusive',
];
export const OUTCOME_TYPES: readonly AAExperimentOutcomeType[] = ['duration', 'count', 'scale', 'money'];
export const STORED_ADHERENCE: readonly AAAdherenceState[] = ['kept', 'missed', 'unknown'];
export const MAX_WINDOW_DAYS = 366;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ExperimentOperation =
  | 'experiment.create'
  | 'experiment.transition'
  | 'experiment.adherence'
  | 'experiment.observation'
  | 'experiment.baseline'
  | 'experiment.condition'
  | 'experiment.decision';

export type ExperimentQueueRequest = {
  operation_type: ExperimentOperation;
  route: string;
  payload: Record<string, unknown>;
};

export type ExperimentValue = {
  type: AAExperimentOutcomeType | 'categorical';
  unit_code?: string | null;
  num?: string;
  text?: string;
  scale_min?: string | null;
  scale_max?: string | null;
};

export type OutcomeDefinition = {
  label: string;
  value_type: AAExperimentOutcomeType;
  unit_code?: string | null;
  scale_min?: string | null;
  scale_max?: string | null;
};

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** A fresh client id. No fallback: without `crypto.randomUUID` creation is disabled. */
export function newExperimentId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    const id = globalThis.crypto.randomUUID();
    if (UUID_V4.test(id)) return id;
  }
  throw new Error('A UUID v4 generator is required for durable analytics writes.');
}

export function canMintExperimentId(): boolean {
  return typeof globalThis.crypto?.randomUUID === 'function';
}

function childRoute(id: string, leaf: string): string {
  if (!isUuid(id)) throw new TypeError('An experiment id is a UUID.');
  return `${EXPERIMENTS_API}/${id}/${leaf}`;
}

export function experimentCreateRequest(input: {
  id: string;
  title: string;
  hypothesis: string;
  hypothesisRecordedAt: string;
  intervention: string;
  windowStart: string;
  windowEnd: string;
  timezone?: string;
  outcome: OutcomeDefinition;
}): ExperimentQueueRequest {
  if (!isUuid(input.id)) throw new TypeError('An experiment id is a UUID.');
  const outcome: Record<string, unknown> = { label: input.outcome.label.trim(), value_type: input.outcome.value_type };
  if (input.outcome.unit_code) outcome.unit_code = input.outcome.unit_code;
  if (input.outcome.value_type === 'scale') {
    outcome.scale_min = input.outcome.scale_min;
    outcome.scale_max = input.outcome.scale_max;
  }
  return {
    operation_type: 'experiment.create',
    route: EXPERIMENTS_API,
    payload: {
      id: input.id,
      title: input.title.trim(),
      hypothesis: input.hypothesis.trim(),
      hypothesis_recorded_at: input.hypothesisRecordedAt,
      intervention: input.intervention.trim(),
      window_start: input.windowStart,
      window_end: input.windowEnd,
      timezone: input.timezone ?? EXPERIMENT_TIME_ZONE,
      outcome,
    },
  };
}

export function experimentTransitionRequest(
  id: string,
  to: Exclude<AAExperimentLifecycle, 'DRAFT'>,
  occurredAt: string,
): ExperimentQueueRequest {
  return {
    operation_type: 'experiment.transition',
    route: childRoute(id, 'transition'),
    payload: { to, occurred_at: occurredAt },
  };
}

export function experimentAdherenceRequest(
  id: string,
  day: string,
  state: 'kept' | 'missed' | 'unknown',
  supersedesKey?: string | null,
): ExperimentQueueRequest {
  parseDateOnly(day);
  const payload: Record<string, unknown> = { day, state };
  if (supersedesKey) payload.supersedes_idempotency_key = supersedesKey;
  return { operation_type: 'experiment.adherence', route: childRoute(id, 'adherence'), payload };
}

export function experimentObservationRequest(id: string, input: {
  role: 'outcome' | 'context';
  label: string;
  value: ExperimentValue;
  occurredAt: string;
  occurredTz?: string;
}): ExperimentQueueRequest {
  return {
    operation_type: 'experiment.observation',
    route: childRoute(id, 'observations'),
    payload: {
      role: input.role,
      label: input.label.trim(),
      value: input.value,
      occurred_at: input.occurredAt,
      occurred_tz: input.occurredTz ?? EXPERIMENT_TIME_ZONE,
    },
  };
}

export function experimentBaselineRequest(id: string, input: {
  value: ExperimentValue;
  windowStart: string;
  windowEnd: string;
  basis?: string | null;
}): ExperimentQueueRequest {
  const payload: Record<string, unknown> = {
    value: input.value, window_start: input.windowStart, window_end: input.windowEnd,
  };
  if (input.basis?.trim()) payload.basis = input.basis.trim();
  return { operation_type: 'experiment.baseline', route: childRoute(id, 'baseline'), payload };
}

export function experimentConditionRequest(id: string, input: {
  text: string;
  epistemicKind: 'observed' | 'mine' | 'maybe' | 'unknown';
  occurredAt: string;
  occurredTz?: string;
}): ExperimentQueueRequest {
  return {
    operation_type: 'experiment.condition',
    route: childRoute(id, 'conditions'),
    payload: {
      text: input.text.trim(),
      epistemic_kind: input.epistemicKind,
      occurred_at: input.occurredAt,
      occurred_tz: input.occurredTz ?? EXPERIMENT_TIME_ZONE,
    },
  };
}

/** `choice` is always present: `null` is an explicit «Пока без решения». */
export function experimentDecisionRequest(
  id: string,
  choice: ExperimentDecisionChoice | null,
  addFactors: Array<{ text: string; epistemic_kind: string; replaces_id?: string | null }> = [],
  retractIds: string[] = [],
): ExperimentQueueRequest {
  return {
    operation_type: 'experiment.decision',
    route: childRoute(id, 'decision'),
    payload: {
      choice,
      add_factors: addFactors.map(factor => ({
        text: factor.text.trim(),
        epistemic_kind: factor.epistemic_kind,
        ...(factor.replaces_id ? { replaces_id: factor.replaces_id } : {}),
      })),
      retract_factor_ids: retractIds,
    },
  };
}

/**
 * «Save decision»: the decision first, then — only while awaiting review — the
 * REVIEWED transition. FIFO + head blocking means a refused decision keeps
 * REVIEWED from ever being sent. The decision itself never implies a lifecycle.
 */
export function decisionSaveRequests(
  id: string,
  lifecycle: AAExperimentLifecycle,
  occurredAt: string,
  input: {
    choice: ExperimentDecisionChoice | null;
    addFactors?: Array<{ text: string; epistemic_kind: string; replaces_id?: string | null }>;
    retractIds?: string[];
  },
): ExperimentQueueRequest[] {
  const requests = [experimentDecisionRequest(id, input.choice, input.addFactors ?? [], input.retractIds ?? [])];
  if (lifecycle === 'COMPLETED_AWAITING_REVIEW') {
    requests.push(experimentTransitionRequest(id, 'REVIEWED', occurredAt));
  }
  return requests;
}

/** A value in the experiment's own outcome shape, from the number the user typed. */
export function outcomeValue(outcome: OutcomeDefinition, num: string): ExperimentValue {
  const value: ExperimentValue = { type: outcome.value_type, num: num.trim().replace(',', '.') };
  if (outcome.value_type === 'money' || outcome.value_type === 'duration') value.unit_code = outcome.unit_code ?? null;
  if (outcome.value_type === 'scale') {
    value.scale_min = outcome.scale_min ?? null;
    value.scale_max = outcome.scale_max ?? null;
  }
  return value;
}

// ── routing ──────────────────────────────────────────────────────────────

export type ExperimentView = { view: 'list' } | { view: 'new' } | { view: 'detail'; id: string };

export function experimentHash(id?: string | null): string {
  if (id == null) return `#/${EXPERIMENT_ROUTE}`;
  if (!isUuid(id)) throw new TypeError('An experiment id is a UUID.');
  return `#/${EXPERIMENT_ROUTE}/${id}`;
}

export const newExperimentHash = (): string => `#/${EXPERIMENT_ROUTE}/new`;

/** `#/experiment` → list · `#/experiment/new` → create · `#/experiment/<uuid>` → detail. */
export function parseExperimentHash(hash: string): ExperimentView | null {
  const raw = (hash || '').replace(/^#\/?/, '');
  if (raw === EXPERIMENT_ROUTE) return { view: 'list' };
  if (!raw.startsWith(`${EXPERIMENT_ROUTE}/`)) return null;
  const rest = raw.slice(EXPERIMENT_ROUTE.length + 1);
  if (rest === 'new') return { view: 'new' };
  return isUuid(rest) ? { view: 'detail', id: rest.toLowerCase() } : { view: 'list' };
}

// ── local days (UI enablement only) ──────────────────────────────────────

export function localToday(timezone = EXPERIMENT_TIME_ZONE, now: Date | number = Date.now()): string {
  return localDateForInstant(now, timezone);
}

/** A calendar date shifted by whole days. Date-only arithmetic, no zone involved. */
export function addDays(dateOnly: string, days: number): string {
  const { year, month, day } = parseDateOnly(dateOnly);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [
    String(shifted.getUTCFullYear()).padStart(4, '0'),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** The last day of a window of `days` local days starting at `start`. */
export function windowEndFor(start: string, days: number): string {
  return addDays(start, days - 1);
}

/** Inclusive local-day count of a window. */
export function windowLength(start: string, end: string): number {
  const a = parseDateOnly(start);
  const b = parseDateOnly(end);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000) + 1;
}

// ── the local queue, read only ──────────────────────────────────────────

type QueueRecordLike = {
  queue_id?: number;
  operation_type: string;
  route: string;
  payload: Record<string, unknown>;
  idempotency_key?: string;
  state?: string;
};

export function hasPendingTransition(records: QueueRecordLike[], id: string, to: string): boolean {
  return pendingExperimentRecords(records, id)
    .some(record => record.operation_type === 'experiment.transition' && record.payload?.to === to);
}

/** The key of the newest queued, unacknowledged record for a day — what a correction must name. */
export function pendingAdherenceKey(records: QueueRecordLike[], id: string, day: string): string | null {
  const matches = pendingExperimentRecords(records, id)
    .filter(record => record.operation_type === 'experiment.adherence' && record.payload?.day === day);
  const last = matches[matches.length - 1];
  return (last?.idempotency_key as string | undefined) ?? (last?.payload?.idempotency_key as string | undefined) ?? null;
}

/**
 * «Period over»: RUNNING, the window has ended (server says so, or the client's
 * local day is past it) and no completion is queued yet. Duplicates from other
 * tabs are harmless: the server answers an already-entered target with a no-op.
 */
export function completionDue(
  detail: { id: string; lifecycle: string; window: { end: string; timezone: string; completion_due: boolean } },
  records: QueueRecordLike[],
  now: Date | number = Date.now(),
): boolean {
  if (detail.lifecycle !== 'RUNNING') return false;
  const ended = detail.window.completion_due || localToday(detail.window.timezone, now) > detail.window.end;
  return ended && !hasPendingTransition(records, detail.id, 'COMPLETED_AWAITING_REVIEW');
}
