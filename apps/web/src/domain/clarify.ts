import { LifeActivity } from '../lib/activity.js';
import { localDateForInstant, parseDateOnly } from '../analytics/timezone';

/* Clarify — the GTD processing step for Quick Notes.
 *
 * A raw Quick Note leaves the inbox through exactly one of six outcomes. Five
 * create real persisted operational state; the sixth deletes the note through
 * the existing deleteQuickNote path.
 *
 * The invariant this module exists to enforce: the destination record is built
 * and validated BEFORE the source note is touched, and destination creation +
 * source removal land in ONE state update. A caller therefore cannot observe a
 * half-applied Clarify, and a validation failure leaves the note intact.
 *
 * Waiting and Reference are deliberately minimal operational collections in the
 * existing snapshot (state version stays 2). They are not tags, not Task
 * statuses and not hidden labels — each has its own record and its own visible
 * retrieval surface. */

export type ClarifyOutcome =
  | 'do_now'
  | 'delegate'
  | 'defer'
  | 'project'
  | 'reference'
  | 'delete';

export type ClarifyPersistingOutcome = Exclude<ClarifyOutcome, 'delete'>;

export type QuickNoteLike = {
  id: string | number;
  text: string;
  at?: string;
};

/* Delegate → Waiting. Personal operational "handed over, waiting for an
   answer" state. `waiting_for` is optional because the accepted Clarify
   handoff exposes no counterparty input; the field stays in the shape so a
   later surface can fill it without another migration. */
export type WaitingItem = {
  id: string;
  title: string;
  waiting_for: string | null;
  created_at: string;
};

/* Reference → something worth keeping, with no action attached. */
export type ReferenceItem = {
  id: string;
  text: string;
  created_at: string;
};

/* Do Now / Defer both produce an ordinary Task. Nothing is invented: no due
   label, no stakes flag and no category unless the user picked a defer date,
   in which case the existing `schedule` representation carries it. */
export type ClarifiedTask = {
  id: number;
  title: string;
  done: boolean;
  stakes: boolean;
  tag: null;
  tagLabel: null;
  due: string;
  schedule: { date: string; time: string } | null;
  notes: string;
};

type UnknownRecord = Record<string, unknown>;

/* Clarify failures are user-facing: the panel has to say WHY the note stayed in
   the inbox. `code` is the stable key the UI localises; `message` stays English
   for logs and tests, exactly like the rest of the domain layer. */
export type ClarifyErrorCode =
  | 'state_missing'
  | 'stale_note'
  | 'empty_note'
  | 'defer_missing'
  | 'defer_invalid'
  | 'defer_past';

export class ClarifyError extends Error {
  readonly code: ClarifyErrorCode;

  constructor(code: ClarifyErrorCode, message: string) {
    super(message);
    this.name = 'ClarifyError';
    this.code = code;
  }
}

type ClarifyTarget = {
  collection: 'tasks' | 'waitingItems' | 'projects' | 'references';
  entityType: string;
  /* Tasks and Projects append (production order); Waiting and Reference
     prepend so their retrieval surfaces read newest-first like quickNotes. */
  append: boolean;
};

const CLARIFY_TARGETS: Record<ClarifyPersistingOutcome, ClarifyTarget> = {
  do_now:    { collection: 'tasks',        entityType: 'task',      append: true  },
  defer:     { collection: 'tasks',        entityType: 'task',      append: true  },
  delegate:  { collection: 'waitingItems', entityType: 'waiting',   append: false },
  project:   { collection: 'projects',     entityType: 'project',   append: true  },
  reference: { collection: 'references',   entityType: 'reference', append: false },
};

export const CLARIFY_OUTCOMES: readonly ClarifyOutcome[] = [
  'do_now',
  'delegate',
  'defer',
  'project',
  'reference',
  'delete',
];

function isPlainObject(value: unknown): value is UnknownRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function sameId(left: unknown, right: unknown): boolean {
  return left != null && right != null && String(left) === String(right);
}

function validInstant(
  value: string | number | Date,
  label = 'Clarify timestamp',
): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${label} is invalid.`);
  return date.toISOString();
}

function requiredText(value: unknown, label: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}

function generatedId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readArray(state: UnknownRecord, key: string): unknown[] {
  const value = state[key];
  if (!Array.isArray(value)) throw new TypeError(`State collection ${key} is invalid.`);
  return value;
}

/* ── Validation · used by the snapshot migration boundary ─────────────── */

export function validateWaitingItemRecord(value: unknown): WaitingItem {
  if (!isPlainObject(value)) throw new TypeError('Waiting item data is invalid.');
  if (typeof value.id !== 'string' || !value.id) throw new TypeError('Waiting item id is invalid.');
  if (typeof value.title !== 'string' || !value.title.trim()) {
    throw new TypeError('Waiting item title is invalid.');
  }
  if (typeof value.created_at !== 'string') {
    throw new TypeError('Waiting item timestamp is invalid.');
  }
  validInstant(value.created_at, 'Waiting item timestamp');
  if (value.waiting_for != null && typeof value.waiting_for !== 'string') {
    throw new TypeError('Waiting item counterparty is invalid.');
  }
  return value as WaitingItem;
}

export function validateReferenceRecord(value: unknown): ReferenceItem {
  if (!isPlainObject(value)) throw new TypeError('Reference data is invalid.');
  if (typeof value.id !== 'string' || !value.id) throw new TypeError('Reference id is invalid.');
  if (typeof value.text !== 'string' || !value.text.trim()) {
    throw new TypeError('Reference text is invalid.');
  }
  if (typeof value.created_at !== 'string') {
    throw new TypeError('Reference timestamp is invalid.');
  }
  validInstant(value.created_at, 'Reference timestamp');
  return value as ReferenceItem;
}

/* ── Destination record builders ──────────────────────────────────────── */

export function createWaitingItemRecord(
  title: string,
  waitingFor: string | null = null,
  now: string | number | Date = new Date(),
  id: string = generatedId('waiting'),
): WaitingItem {
  const counterparty = waitingFor == null ? null : (String(waitingFor).trim() || null);
  return {
    id,
    title: requiredText(title, 'Waiting item title'),
    waiting_for: counterparty,
    created_at: validInstant(now),
  };
}

export function createReferenceRecord(
  text: string,
  now: string | number | Date = new Date(),
  id: string = generatedId('reference'),
): ReferenceItem {
  return {
    id,
    text: requiredText(text, 'Reference text'),
    created_at: validInstant(now),
  };
}

/* Do Now. A normal open Task and nothing else: no due label, no schedule, no
   stakes flag, no category invented because the item came through Clarify. */
export function createClarifiedTaskRecord(
  title: string,
  id: number = Date.now(),
): ClarifiedTask {
  return {
    id,
    title: requiredText(title, 'Task title'),
    done: false,
    stakes: false,
    tag: null,
    tagLabel: null,
    due: '',
    schedule: null,
    notes: '',
  };
}

/* Defer requires an explicitly chosen future calendar date. "Future" is
   resolved against the Europe/Kyiv local date through the shared IANA helper —
   never a hardcoded UTC offset. */
export function assertFutureDeferDate(
  deferDate: unknown,
  now: string | number | Date = new Date(),
): string {
  if (typeof deferDate !== 'string' || !deferDate.trim()) {
    throw new ClarifyError('defer_missing', 'A defer date must be selected.');
  }
  const dateOnly = deferDate.trim();
  try {
    parseDateOnly(dateOnly);
  } catch {
    throw new ClarifyError('defer_invalid', `A defer date is not a valid date: ${dateOnly}`);
  }
  const today = localDateForInstant(now);
  if (dateOnly <= today) {
    throw new ClarifyError('defer_past', 'A defer date must be later than today.');
  }
  return dateOnly;
}

export function createDeferredTaskRecord(
  title: string,
  deferDate: unknown,
  now: string | number | Date = new Date(),
  id: number = Date.now(),
): ClarifiedTask {
  const date = assertFutureDeferDate(deferDate, now);
  return {
    ...createClarifiedTaskRecord(title, id),
    due: date,
    schedule: { date, time: '' },
  };
}

/* ── Source lookup ────────────────────────────────────────────────────── */

/* Raises before anything is written when the caller acts on a note that is no
   longer in the inbox, so a stale panel never reports a false success. */
export function requireQuickNote(
  state: UnknownRecord | null | undefined,
  noteId: string | number,
): QuickNoteLike {
  if (!isPlainObject(state)) {
    throw new ClarifyError('state_missing', 'Operational state is not loaded.');
  }
  const notes = readArray(state, 'quickNotes');
  const note = notes.find(entry => isPlainObject(entry) && sameId(entry.id, noteId));
  if (!isPlainObject(note)) {
    throw new ClarifyError('stale_note', 'The source Quick Note no longer exists.');
  }
  if (typeof note.text !== 'string' || !note.text.trim()) {
    throw new ClarifyError('empty_note', 'The source Quick Note has no text.');
  }
  return note as unknown as QuickNoteLike;
}

/* ── The single atomic transition ─────────────────────────────────────── */

/* Destination creation + source-note removal + both activity entries in one
   returned state object. Returns `previous` unchanged when the note has
   already left the inbox or the destination record already exists, so a
   double dispatch cannot duplicate the destination. */
export function applyClarifyTransition(
  previous: UnknownRecord,
  noteId: string | number,
  outcome: ClarifyPersistingOutcome,
  record: UnknownRecord,
): UnknownRecord {
  const target = CLARIFY_TARGETS[outcome];
  if (!target) throw new TypeError(`Unknown Clarify outcome: ${String(outcome)}`);
  if (!isPlainObject(previous)) throw new TypeError('Operational state is not loaded.');
  if (!isPlainObject(record) || record.id == null) {
    throw new TypeError('Clarify destination record is invalid.');
  }

  const quickNotes = readArray(previous, 'quickNotes');
  const source = quickNotes.find(entry => isPlainObject(entry) && sameId(entry.id, noteId));
  if (!source) return previous;

  const destination = readArray(previous, target.collection);
  const alreadyThere = destination.some(
    entry => isPlainObject(entry) && sameId(entry.id, record.id),
  );
  if (alreadyThere) return previous;

  const label = typeof record.title === 'string'
    ? record.title
    : String(record.text ?? '');

  let activityLog = LifeActivity.append(readArray(previous, 'activityLog'), {
    entity_type: target.entityType,
    entity_id: record.id,
    action: 'created',
    details: { title: label, clarify_outcome: outcome },
  });
  activityLog = LifeActivity.append(activityLog, {
    entity_type: 'quick_note',
    entity_id: noteId,
    action: 'clarified',
    details: { outcome, destination_id: record.id },
  });

  return {
    ...previous,
    [target.collection]: target.append
      ? [...destination, record]
      : [record, ...destination],
    quickNotes: quickNotes.filter(
      entry => !(isPlainObject(entry) && sameId(entry.id, noteId)),
    ),
    activityLog,
  };
}
