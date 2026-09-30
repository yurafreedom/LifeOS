import { LifeActivity } from '../lib/activity.js';
import { createClarifiedTaskRecord, type ClarifiedTask, type WaitingItem } from './clarify';

/* Waiting For lifecycle (GTD slice G1) — pure helpers over `state.waitingItems`.
 *
 * Clarify's Delegate outcome creates the record (domain/clarify.ts, unchanged).
 * This module owns everything that happens to it afterwards:
 *
 *   edit title / person   active records only; empty person → null
 *   received | cancelled  closes the record; it stays visible under «закрыто»
 *   restore               received/cancelled → active again, same id
 *   convert               closes the record as `converted` AND appends one
 *                         ordinary undated Task (createClarifiedTaskRecord) in
 *                         the SAME returned state; never restorable here,
 *                         because the Task already exists
 *   delete                permanent removal, any state (UI confirms first)
 *
 * Additive optional fields (owner decisions OD-G1-1..3, 2026-09-30); legacy
 * four-field rows are valid active records and are never backfilled:
 *   resolution          'received' | 'cancelled' | 'converted'
 *   resolved_at         ISO instant — present exactly when `resolution` is
 *   converted_task_id   task id — present exactly when resolution = converted
 *   updated_at          ISO instant of the last lifecycle change
 *
 * No follow-up dates, reminders, contacts, Calendar entries or AA facts.
 *
 * Every command returns one of three outcomes so a caller can never mistake a
 * no-op for success:
 *   applied    the returned state differs and holds the change
 *   unchanged  the requested end state already holds (repeat / no edits)
 *   invalid    stale id, bad input or a forbidden transition; state untouched */

export type WaitingResolution = 'received' | 'cancelled' | 'converted';
export type WaitingCloseResolution = Exclude<WaitingResolution, 'converted'>;

export type WaitingRecord = WaitingItem & {
  resolution?: WaitingResolution | null;
  resolved_at?: string | null;
  converted_task_id?: number | string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type WaitingChanges = { title?: unknown; waiting_for?: unknown };

export type WaitingCommand =
  | { kind: 'update'; id: string; changes: WaitingChanges }
  | { kind: 'resolve'; id: string; resolution: WaitingCloseResolution; changes?: WaitingChanges }
  | { kind: 'restore'; id: string }
  | { kind: 'convert'; id: string; taskId: number; changes?: WaitingChanges }
  | { kind: 'delete'; id: string };

export type WaitingErrorCode =
  | 'state_missing'
  | 'missing'
  | 'empty_title'
  | 'invalid_person'
  | 'invalid_resolution'
  | 'not_active'
  | 'not_restorable'
  | 'invalid_command';

type UnknownRecord = Record<string, unknown>;
type Instant = string | number | Date;

export type WaitingOutcome =
  | { status: 'applied'; state: UnknownRecord; item: WaitingRecord | null; task?: ClarifiedTask }
  | { status: 'unchanged'; state: UnknownRecord; item: WaitingRecord }
  | { status: 'invalid'; state: UnknownRecord | null | undefined; code: WaitingErrorCode };

export const WAITING_RESOLUTIONS: ReadonlySet<WaitingResolution> = new Set(['received', 'cancelled', 'converted']);
const CLOSE_RESOLUTIONS: ReadonlySet<string> = new Set(['received', 'cancelled']);

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function isPlainObject(value: unknown): value is UnknownRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isInstant(value: unknown): boolean {
  return typeof value === 'string' && ISO_INSTANT.test(value) && Number.isFinite(Date.parse(value));
}

function toInstant(value: Instant): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Waiting timestamp is invalid.');
  return date.toISOString();
}

function isTaskId(value: unknown): boolean {
  return (typeof value === 'number' && Number.isSafeInteger(value))
    || (typeof value === 'string' && value.trim() !== '');
}

const sameId = (left: unknown, right: unknown) => left != null && right != null && String(left) === String(right);

/* ── Validation (snapshot boundary, after clarify's validateWaitingItemRecord) ── */

/* Checks ONLY the lifecycle fields, and only when present. Structural pairing
   is enforced; chronology is not (two devices' clocks may disagree, and a
   rejected field rejects the whole snapshot). */
export function validateWaitingLifecycle(value: unknown): void {
  if (!isPlainObject(value)) return;
  const { resolution, resolved_at: resolvedAt, converted_task_id: taskId, updated_at: updatedAt } = value;
  if (resolution != null && !WAITING_RESOLUTIONS.has(resolution as WaitingResolution)) {
    throw new Error('Waiting item resolution is invalid.');
  }
  if ((resolution != null) !== (resolvedAt != null)) {
    throw new Error('Waiting item resolution and resolved_at must be set together.');
  }
  if (resolvedAt != null && !isInstant(resolvedAt)) throw new Error('Waiting item resolved_at is invalid.');
  if (updatedAt != null && !isInstant(updatedAt)) throw new Error('Waiting item updated_at is invalid.');
  if (resolution === 'converted' && taskId == null) {
    throw new Error('A converted waiting item must link its task.');
  }
  if (taskId != null) {
    if (resolution !== 'converted') throw new Error('Only a converted waiting item links a task.');
    if (!isTaskId(taskId)) throw new Error('Waiting item converted_task_id is invalid.');
  }
}

/* ── Readers ─────────────────────────────────────────────────────────────── */

export function isWaitingActive(item: WaitingRecord): boolean {
  return item.resolution == null;
}

export function canRestoreWaiting(item: WaitingRecord): boolean {
  return item.resolution != null && CLOSE_RESOLUTIONS.has(item.resolution);
}

/** Active records in their stored order (newest Delegate first). */
export function activeWaitingItems(items: WaitingRecord[]): WaitingRecord[] {
  return items.filter(isWaitingActive);
}

/* The instant a record was resolved, as epoch ms. `resolved_at` may carry any
   UTC offset (the validator accepts +03:00 as well as Z), so it is compared as
   a parsed instant, never as a string. */
function resolvedAtMs(item: WaitingRecord): number {
  const ms = typeof item.resolved_at === 'string' ? Date.parse(item.resolved_at) : NaN;
  return Number.isFinite(ms) ? ms : -Infinity;
}

/** Closed records, most recently resolved first (stable for equal instants). */
export function closedWaitingItems(items: WaitingRecord[]): WaitingRecord[] {
  return items
    .map((item, index) => ({ item, index, at: resolvedAtMs(item) }))
    .filter(({ item }) => !isWaitingActive(item))
    .sort((a, b) => (a.at === b.at ? a.index - b.index : (b.at > a.at ? 1 : -1)))
    .map(({ item }) => item);
}

export function findWaitingItem(items: unknown, id: unknown): WaitingRecord | undefined {
  if (!Array.isArray(items)) return undefined;
  return items.find(item => isPlainObject(item) && sameId(item.id, id)) as WaitingRecord | undefined;
}

/* ── Commands ────────────────────────────────────────────────────────────── */

type Edit = { ok: true; next: WaitingRecord; fields: string[] } | { ok: false; code: WaitingErrorCode };

/* Normalises title/person edits against the current record. Only fields that
   really change are written; an empty person is "nobody named" (null). */
function applyChanges(item: WaitingRecord, changes: WaitingChanges | undefined): Edit {
  const next: WaitingRecord = { ...item };
  const fields: string[] = [];
  if (!changes) return { ok: true, next, fields };
  if (!isPlainObject(changes)) return { ok: false, code: 'invalid_command' };
  if ('title' in changes) {
    if (typeof changes.title !== 'string') return { ok: false, code: 'empty_title' };
    const title = changes.title.trim();
    if (!title) return { ok: false, code: 'empty_title' };
    if (title !== item.title) { next.title = title; fields.push('title'); }
  }
  if ('waiting_for' in changes) {
    if (changes.waiting_for != null && typeof changes.waiting_for !== 'string') {
      return { ok: false, code: 'invalid_person' };
    }
    const person = changes.waiting_for == null ? null : (changes.waiting_for.trim() || null);
    if (person !== (item.waiting_for ?? null)) { next.waiting_for = person; fields.push('waiting_for'); }
  }
  return { ok: true, next, fields };
}

function withoutResolution(item: WaitingRecord): WaitingRecord {
  const next = { ...item };
  delete next.resolution;
  delete next.resolved_at;
  delete next.converted_task_id;
  return next;
}

function uniqueTaskId(tasks: unknown[], preferred: number): number {
  let id = preferred;
  while (tasks.some(task => isPlainObject(task) && sameId(task.id, id))) id += 1;
  return id;
}

/* Activity ids. LifeActivity.append would otherwise mint a fresh id on every
   call, so the same transition evaluated twice (a StrictMode re-run of the
   state updater) would produce two different logs. A command therefore gets
   its ids up front: the provider bridge prepares them once, outside the
   updater (prepareWaitingActivityIds); a direct caller that passes none gets
   ids derived from the command itself, which are equally deterministic. */
export const WAITING_ACTIVITY_SLOTS = 2; // convert writes two entries; every other command one

let activityCounter = 0;
export function prepareWaitingActivityIds(): string[] {
  const random = () => (typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  return Array.from({ length: WAITING_ACTIVITY_SLOTS }, () => {
    activityCounter += 1;
    return `aw-${activityCounter.toString(36)}-${random()}`;
  });
}

function derivedActivityIds(command: WaitingCommand, at: string): string[] {
  return Array.from({ length: WAITING_ACTIVITY_SLOTS }, (_, slot) => `aw-${command.kind}-${command.id}-${at}-${slot}`);
}

function logEntry(
  id: string, entityType: string, entityId: unknown, action: string, details: UnknownRecord, timestamp: string,
) {
  return { id, entity_type: entityType, entity_id: entityId, action, details, timestamp };
}

const invalid = (state: UnknownRecord | null | undefined, code: WaitingErrorCode): WaitingOutcome =>
  ({ status: 'invalid', state, code });

/* One command → one returned state. `previous` is never mutated; every
   applied outcome replaces waitingItems (and, for convert, tasks) and appends
   its activity entries in the same object. */
export function applyWaitingCommand(
  previous: UnknownRecord | null | undefined,
  command: WaitingCommand,
  now: Instant = new Date(),
  activityIds?: readonly string[],
): WaitingOutcome {
  if (!isPlainObject(previous) || !Array.isArray(previous.waitingItems)) return invalid(previous, 'state_missing');
  if (!isPlainObject(command) || typeof command.id !== 'string') return invalid(previous, 'invalid_command');
  const at = toInstant(now);
  const ids = activityIds && activityIds.length >= WAITING_ACTIVITY_SLOTS
    ? activityIds
    : derivedActivityIds(command, at);
  const items = previous.waitingItems as WaitingRecord[];
  const index = items.findIndex(item => isPlainObject(item) && sameId(item.id, command.id));
  if (index < 0) return invalid(previous, 'missing');
  const item = items[index];
  const log = Array.isArray(previous.activityLog) ? previous.activityLog : [];

  const replace = (next: WaitingRecord) => items.map((entry, i) => (i === index ? next : entry));

  switch (command.kind) {
    case 'update': {
      if (!isWaitingActive(item)) return invalid(previous, 'not_active');
      const edit = applyChanges(item, command.changes);
      if (!edit.ok) return invalid(previous, edit.code);
      if (edit.fields.length === 0) return { status: 'unchanged', state: previous, item };
      const next = { ...edit.next, updated_at: at };
      return {
        status: 'applied',
        item: next,
        state: {
          ...previous,
          waitingItems: replace(next),
          activityLog: LifeActivity.append(log, logEntry(ids[0], 'waiting', item.id, 'updated',
            { title: next.title, fields: edit.fields }, at)),
        },
      };
    }

    case 'resolve': {
      if (!CLOSE_RESOLUTIONS.has(command.resolution)) return invalid(previous, 'invalid_resolution');
      if (item.resolution === command.resolution) return { status: 'unchanged', state: previous, item };
      if (!isWaitingActive(item)) return invalid(previous, 'not_active');
      const edit = applyChanges(item, command.changes);
      if (!edit.ok) return invalid(previous, edit.code);
      const next: WaitingRecord = { ...edit.next, resolution: command.resolution, resolved_at: at, updated_at: at };
      const details: UnknownRecord = { title: next.title };
      if (edit.fields.length) details.fields = edit.fields;
      return {
        status: 'applied',
        item: next,
        state: {
          ...previous,
          waitingItems: replace(next),
          activityLog: LifeActivity.append(log, logEntry(ids[0], 'waiting', item.id, command.resolution, details, at)),
        },
      };
    }

    case 'restore': {
      if (isWaitingActive(item)) return { status: 'unchanged', state: previous, item };
      if (!canRestoreWaiting(item)) return invalid(previous, 'not_restorable');
      const next = { ...withoutResolution(item), updated_at: at };
      return {
        status: 'applied',
        item: next,
        state: {
          ...previous,
          waitingItems: replace(next),
          activityLog: LifeActivity.append(log, logEntry(ids[0], 'waiting', item.id, 'restored',
            { title: next.title, from: item.resolution }, at)),
        },
      };
    }

    case 'convert': {
      /* Repeat activation: the task was already created once — never twice. */
      if (item.resolution === 'converted') return { status: 'unchanged', state: previous, item };
      if (!isWaitingActive(item)) return invalid(previous, 'not_active');
      if (!Array.isArray(previous.tasks)) return invalid(previous, 'state_missing');
      if (!Number.isSafeInteger(command.taskId)) return invalid(previous, 'invalid_command');
      const edit = applyChanges(item, command.changes);
      if (!edit.ok) return invalid(previous, edit.code);
      const tasks = previous.tasks as unknown[];
      const task = createClarifiedTaskRecord(edit.next.title, uniqueTaskId(tasks, command.taskId), at);
      const next: WaitingRecord = {
        ...edit.next, resolution: 'converted', resolved_at: at, converted_task_id: task.id, updated_at: at,
      };
      const details: UnknownRecord = { title: next.title, task_id: task.id };
      if (edit.fields.length) details.fields = edit.fields;
      let activityLog = LifeActivity.append(log, logEntry(ids[0], 'task', task.id, 'created',
        { title: task.title, waiting_id: item.id }, at));
      activityLog = LifeActivity.append(activityLog, logEntry(ids[1], 'waiting', item.id, 'converted', details, at));
      return {
        status: 'applied',
        item: next,
        task,
        state: { ...previous, waitingItems: replace(next), tasks: [...tasks, task], activityLog },
      };
    }

    case 'delete': {
      return {
        status: 'applied',
        item: null,
        state: {
          ...previous,
          waitingItems: items.filter((_, i) => i !== index),
          activityLog: LifeActivity.append(log, logEntry(ids[0], 'waiting', item.id, 'deleted',
            { title: item.title, resolution: item.resolution ?? null }, at)),
        },
      };
    }

    default:
      return invalid(previous, 'invalid_command');
  }
}

/* ── Provider bridge ─────────────────────────────────────────────────────── */

/* Runs a command against the state React will actually apply it to — the
   functional updater's `prev`, including updates still queued — and reports
   the outcome synchronously. `flush` must execute the scheduled updater before
   returning (the provider passes react-dom's flushSync). A provider that never
   runs the updater (unmounted) yields `invalid`, never a false success.
   `now`, `taskId` and the activity ids are all fixed before the updater is
   scheduled, so a re-invoked updater (StrictMode) computes the identical
   state — activity ids included — while every separate command gets new ids. */
export function commitWaitingCommand(
  setState: (updater: (prev: UnknownRecord) => UnknownRecord) => void,
  flush: (run: () => void) => void,
  command: WaitingCommand,
  now: Instant,
  activityIds: readonly string[] = prepareWaitingActivityIds(),
): WaitingOutcome {
  let outcome: WaitingOutcome | null = null;
  flush(() => {
    setState(prev => {
      const result = applyWaitingCommand(prev, command, now, activityIds);
      outcome = result;
      return result.status === 'applied' ? result.state : prev;
    });
  });
  const settled = outcome as WaitingOutcome | null;
  return settled ?? { status: 'invalid', state: null, code: 'state_missing' };
}
