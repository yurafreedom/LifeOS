/**
 * Review / Debrief — pure helpers shared by the page, the entry points and tests.
 *
 * A Review save carries only what the user wrote plus the instant and
 * fingerprint of the context they looked at. It never carries a frozen value:
 * the server re-derives the context as of that instant and stores its own
 * result, so a queued write replayed days later still freezes exactly what the
 * user saw, and no client can author a "source-derived" number.
 */
import type {
  AAEpistemicKind,
  AAReviewChoice,
  AAReviewContext,
  AAReviewItem,
  AACoverageReport,
} from '../api/analytics';
import { LIFEOS_TIME_ZONE, localDateForInstant, parseDateOnly } from './timezone';

export const REVIEW_STEPS = ['compare', 'note', 'factors', 'alongside', 'decision'] as const;
export type ReviewStep = (typeof REVIEW_STEPS)[number];

export const REVIEW_CHOICES: readonly AAReviewChoice[] = ['keep', 'adjust', 'later', 'inconclusive'];
export const EPISTEMIC_KINDS: readonly AAEpistemicKind[] = ['observed', 'mine', 'maybe', 'unknown'];

/** `undefined` — step skipped (nothing stored); `null` — «Пока без решения». */
export type DecisionDraft = AAReviewChoice | null | undefined;

export type FactorDraft = { key: string; text: string; epistemic_kind: AAEpistemicKind };

export type ReviewRoute =
  | { mode: 'new'; subject: string; from: string; to: string }
  | { mode: 'open'; id: string };

export type ReviewQueueRequest = {
  operation_type: 'review.save' | 'review.revise';
  route: string;
  payload: Record<string, unknown>;
};

const SUBJECT = /^(finance:period:\d{4}-\d{2}|project:project:[^:/]+)$/;
const REVIEW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDate(value: string): boolean {
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

export function newReviewHash(subject: string, from: string, to: string): string {
  if (!SUBJECT.test(subject)) throw new TypeError(`Unsupported review subject: ${subject}`);
  if (!isDate(from) || !isDate(to) || from > to) throw new TypeError('A review needs an ordered window.');
  return `#/review/new/${encodeURIComponent(subject)}/${from}/${to}`;
}

export function openReviewHash(reviewId: string): string {
  if (!REVIEW_ID.test(reviewId)) throw new TypeError('A review id is a UUID.');
  return `#/review/${reviewId}`;
}

export function parseReviewHash(hash: string): ReviewRoute | null {
  const raw = hash.replace(/^#\/?/, '');
  const parts = raw.split('/');
  if (parts[0] !== 'review') return null;
  if (parts[1] === 'new' && parts.length === 5) {
    let subject: string;
    try {
      subject = decodeURIComponent(parts[2]);
    } catch {
      return null;
    }
    const [from, to] = [parts[3], parts[4]];
    if (!SUBJECT.test(subject) || !isDate(from) || !isDate(to) || from > to) return null;
    return { mode: 'new', subject, from, to };
  }
  if (parts.length === 2 && REVIEW_ID.test(parts[1])) return { mode: 'open', id: parts[1] };
  return null;
}

export function subjectFromKey(key: string): { domain: string; type: string; id: string } {
  const [domain, type, id] = key.split(':');
  return { domain, type, id: id ?? '' };
}

export function financeReviewWindow(period: string): { from: string; to: string } {
  const [year, month] = period.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, '0')}` };
}

/** Local Kyiv dates of the project's life: start → completion (or today). */
export function projectReviewWindow(
  project: { started_at?: string | null; created_at?: string | null; completed_at?: string | null },
  now: Date = new Date(),
): { from: string; to: string } {
  const start = project.started_at ?? project.created_at ?? now.toISOString();
  const from = localDateForInstant(start, LIFEOS_TIME_ZONE);
  const to = localDateForInstant(project.completed_at ?? now, LIFEOS_TIME_ZONE);
  return from <= to ? { from, to } : { from: to, to: from };
}

function cleanNote(note: string | null | undefined): string | null {
  return note != null && note.trim() ? note : null;
}

function cleanFactors(factors: FactorDraft[]) {
  return factors
    .map(factor => ({ text: factor.text.trim(), epistemic_kind: factor.epistemic_kind }))
    .filter(factor => factor.text)
    .map(factor => {
      if (!EPISTEMIC_KINDS.includes(factor.epistemic_kind)) {
        throw new TypeError(`Unknown epistemic kind: ${String(factor.epistemic_kind)}`);
      }
      return factor;
    });
}

function decisionPayload(decision: DecisionDraft): { choice: AAReviewChoice | null } | undefined {
  if (decision === undefined) return undefined;
  if (decision !== null && !REVIEW_CHOICES.includes(decision)) {
    throw new TypeError(`Unknown decision: ${String(decision)}`);
  }
  return { choice: decision };
}

/** The queued save. Every field the user left empty is simply absent. */
export function reviewSaveRequest(
  context: AAReviewContext,
  draft: { note?: string | null; factors?: FactorDraft[]; decision?: DecisionDraft },
): ReviewQueueRequest {
  const payload: Record<string, unknown> = {
    subject: subjectFromKey(context.subject_key),
    window_start: context.window_start,
    window_end: context.window_end,
    timezone: context.timezone,
    context_as_of: context.context_as_of,
    context_fingerprint: context.context_fingerprint,
  };
  const note = cleanNote(draft.note);
  if (note != null) payload.note_text = note;
  const factors = cleanFactors(draft.factors ?? []);
  if (factors.length) payload.factors = factors;
  const decision = decisionPayload(draft.decision);
  if (decision !== undefined) payload.decision = decision;
  return { operation_type: 'review.save', route: '/api/v1/aa/reviews', payload };
}

/** The queued revision, or `null` when there is nothing to append. */
export function reviewReviseRequest(
  reviewId: string,
  draft: {
    note?: string | null;
    addFactors?: Array<FactorDraft & { replaces_id?: string | null }>;
    retractFactorIds?: string[];
    decision?: DecisionDraft;
  },
): ReviewQueueRequest | null {
  if (!REVIEW_ID.test(reviewId)) throw new TypeError('A review id is a UUID.');
  const payload: Record<string, unknown> = {};
  const note = cleanNote(draft.note);
  if (note != null) payload.note_text = note;
  const add = (draft.addFactors ?? [])
    .filter(factor => factor.text.trim())
    .map(factor => {
      const [clean] = cleanFactors([factor]);
      return factor.replaces_id ? { ...clean, replaces_id: factor.replaces_id } : clean;
    });
  if (add.length) payload.add_factors = add;
  if (draft.retractFactorIds?.length) payload.retract_factor_ids = [...new Set(draft.retractFactorIds)];
  const decision = decisionPayload(draft.decision);
  if (decision !== undefined) payload.decision = decision;
  if (!Object.keys(payload).length) return null;
  return {
    operation_type: 'review.revise',
    route: `/api/v1/aa/reviews/${reviewId}/revise`,
    payload,
  };
}

export function itemsIn(items: AAReviewItem[], section: AAReviewItem['section']): AAReviewItem[] {
  return items.filter(item => item.section === section);
}

/** The frozen coverage buckets, rebuilt for `AAQualityStrip`, or why they cannot be. */
export function coverageFromItems(
  items: AAReviewItem[],
): AACoverageReport | 'redacted' | null {
  const coverage = itemsIn(items, 'quality').filter(item => item.role === 'coverage');
  if (!coverage.length) return null;
  if (coverage.some(item => item.redacted || item.value == null)) return 'redacted';
  const report: Record<string, number | boolean> = {};
  for (const item of coverage) {
    const key = item.label_key.replace(/^coverage\./, '');
    const count = Number(item.value?.num ?? 0);
    report[key] = key === 'has_legacy_imports' ? count > 0 : count;
  }
  return report as unknown as AACoverageReport;
}

/** The compare section as the operands `AADelta` expects. */
export function compareModel(items: AAReviewItem[]) {
  const compare = itemsIn(items, 'compare');
  const reference = compare.find(item => item.role === 'expected' || item.role === 'forecast') ?? null;
  const current = compare.find(item => item.role === 'actual') ?? null;
  const delta = compare.find(item => item.role === 'delta') ?? null;
  const target = compare.find(item => item.role === 'target') ?? null;
  return { reference, current, delta, target };
}
