import { parseDateOnly } from '../analytics/timezone';

/* Task domain — pure helpers over the operational `state.tasks` array.
 *
 * Tasks live in the server snapshot (state version 2). Every helper here takes
 * the task array and returns a NEW array; nothing is mutated in place and
 * nothing is persisted outside `state.tasks`.
 *
 * Date authority is `task.schedule.date` ('YYYY-MM-DD'); `due` is a legacy
 * display label and never places a task in the Calendar.
 *
 * Optional metadata (all additive, absent = unknown / active, never backfilled):
 *   created_at    ISO instant the task was created
 *   completed_at  ISO instant of completion (only while done)
 *   closure       'closed_unresolved' | 'archived' (never together with done)
 *   closed_at     ISO instant of that closure
 *   order         non-negative integer, meaningful within schedule.date
 *
 * Closure vocabulary (OD-1, owner-resolved 2026-09-29): «Выполнить» →
 * done + completed_at; «Закрыть без выполнения» → closed_unresolved;
 * «В архив» → archived. Delete stays a permanent removal and is never
 * History. An overdue task nobody marked stays active. */

export type TaskSchedule = { date: string; time: string };
export type TaskClosure = 'closed_unresolved' | 'archived';
export type HistoryStatus = 'completed' | TaskClosure;

export type TaskRecord = {
  id: number | string;
  title?: string;
  titleKey?: string;
  done?: boolean;
  stakes?: boolean;
  due?: string;
  schedule?: TaskSchedule | null;
  notes?: string;
  created_at?: string;
  completed_at?: string;
  closure?: TaskClosure | null;
  closed_at?: string;
  order?: number;
  [key: string]: unknown;
};

type TaskId = TaskRecord['id'];
type Instant = string | number | Date;

export const TASK_CLOSURES: ReadonlySet<TaskClosure> = new Set(['closed_unresolved', 'archived']);

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const TIME = /^\d{2}:\d{2}$/;

const sameId = (task: TaskRecord, id: TaskId) => String(task.id) === String(id);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toInstant(value: Instant): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Task timestamp is invalid.');
  return date.toISOString();
}

function isInstant(value: unknown): boolean {
  return typeof value === 'string' && ISO_INSTANT.test(value) && Number.isFinite(Date.parse(value));
}

function without(task: TaskRecord, ...keys: string[]): TaskRecord {
  const next = { ...task };
  for (const key of keys) delete next[key];
  return next;
}

/* ── Validation (snapshot boundary) ─────────────────────────────────────── */

/* Validates ONLY the optional metadata this module owns, and only when it is
   present. Legacy rows without it pass untouched; a malformed value is
   rejected instead of silently dropped (Clarify precedent). */
export function validateTaskRecord(value: unknown): void {
  if (!isPlainObject(value)) return;
  for (const key of ['created_at', 'completed_at', 'closed_at']) {
    if (value[key] != null && !isInstant(value[key])) throw new Error(`Task ${key} is invalid.`);
  }
  if (value.closure != null && !TASK_CLOSURES.has(value.closure as TaskClosure)) {
    throw new Error('Task closure is invalid.');
  }
  if (value.order != null && !(Number.isSafeInteger(value.order) && (value.order as number) >= 0)) {
    throw new Error('Task order is invalid.');
  }
}

/* ── Readers ─────────────────────────────────────────────────────────────── */

export function findTask(tasks: TaskRecord[], id: TaskId): TaskRecord | undefined {
  return tasks.find(task => sameId(task, id));
}

/** The task's calendar day, or null when it has no valid `schedule.date`. */
export function taskDate(task: TaskRecord): string | null {
  const date = task?.schedule?.date;
  if (typeof date !== 'string' || !date) return null;
  try {
    parseDateOnly(date);
    return date;
  } catch {
    return null;
  }
}

export function taskTime(task: TaskRecord): string {
  const time = task?.schedule?.time;
  return typeof time === 'string' && TIME.test(time) ? time : '';
}

export function isTaskClosed(task: TaskRecord): boolean {
  return task.closure != null && TASK_CLOSURES.has(task.closure);
}

export function isTaskActive(task: TaskRecord): boolean {
  return task.done !== true && !isTaskClosed(task);
}

/** Derived, never persisted: an active dated task whose day is before today. */
export function isTaskOverdue(task: TaskRecord, today: string): boolean {
  const date = taskDate(task);
  return date != null && isTaskActive(task) && date < today;
}

const orderKey = (task: TaskRecord) => (Number.isSafeInteger(task.order) ? (task.order as number) : Infinity);
const timeKey = (task: TaskRecord) => taskTime(task) || '99:99';

/** Active tasks of one day, in the user's order (then time, then creation order). */
export function tasksForDay(tasks: TaskRecord[], date: string): TaskRecord[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => isTaskActive(task) && taskDate(task) === date)
    .sort((a, b) => (orderKey(a.task) - orderKey(b.task))
      || timeKey(a.task).localeCompare(timeKey(b.task))
      || (a.index - b.index))
    .map(({ task }) => task);
}

export function historyStatus(task: TaskRecord): HistoryStatus | null {
  if (task.done === true) return 'completed';
  if (isTaskClosed(task)) return task.closure as TaskClosure;
  return null;
}

/** The instant a History row was closed, when known. */
export function historyInstant(task: TaskRecord): string | null {
  const value = task.done === true ? task.completed_at : task.closed_at;
  return isInstant(value) ? (value as string) : null;
}

/* Derived view over state.tasks — never a second store and never activityLog.
   Newest known closure first; rows with an unknown instant (legacy) follow,
   newest array position first. */
export function historyTasks(tasks: TaskRecord[]): TaskRecord[] {
  return tasks
    .map((task, index) => ({ task, index, at: historyInstant(task) }))
    .filter(({ task }) => historyStatus(task) != null)
    .sort((a, b) => {
      if (a.at && b.at) return b.at.localeCompare(a.at) || (b.index - a.index);
      if (a.at) return -1;
      if (b.at) return 1;
      return b.index - a.index;
    })
    .map(({ task }) => task);
}

/** Legacy display label kept in sync with the schedule — never localised. */
export function semanticDue(stakes: boolean, schedule: TaskSchedule | null | undefined): string {
  if (schedule && (schedule.time || schedule.date)) return schedule.time || schedule.date;
  return stakes ? 'eod' : '';
}

export function normalizeSchedule(schedule: Partial<TaskSchedule> | null | undefined): TaskSchedule | null {
  if (!schedule) return null;
  const date = typeof schedule.date === 'string' ? schedule.date : '';
  const time = typeof schedule.time === 'string' ? schedule.time : '';
  return date || time ? { date, time } : null;
}

/* ── Records ─────────────────────────────────────────────────────────────── */

export function withCreatedAt(task: TaskRecord, now: Instant = new Date()): TaskRecord {
  return task.created_at ? task : { ...task, created_at: toInstant(now) };
}

export type QuickAddInput = {
  title: string;
  stakes: boolean;
  category: unknown;
  tagLabel: string | null;
  schedule: Partial<TaskSchedule> | null;
  notes: string;
};

/* The Quick Add task. `schedule.date` is persisted exactly as picked (it is
   the Calendar date); `due` is the non-localised legacy label. */
export function createQuickAddTaskRecord(
  input: QuickAddInput,
  now: Instant = new Date(),
  id: number = Date.now(),
): TaskRecord {
  const schedule = normalizeSchedule(input.schedule);
  return {
    id,
    title: input.title,
    done: false,
    stakes: !!input.stakes,
    tag: input.stakes ? 'today' : (input.category ? null : 'inbox'),
    tagLabel: input.tagLabel,
    due: semanticDue(!!input.stakes, schedule),
    schedule,
    notes: input.notes,
    created_at: toInstant(now),
  };
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

function mapTask(tasks: TaskRecord[], id: TaskId, update: (task: TaskRecord) => TaskRecord): TaskRecord[] {
  return tasks.map(task => (sameId(task, id) ? { ...update(task), id: task.id } : task));
}

/* Merge a patch of edited fields onto the PERSISTED task with this id. Fields
   the caller did not edit are never touched, so a partial or display-resolved
   object can no longer overwrite notes, category, subtasks or schedule. */
export function patchTask(tasks: TaskRecord[], id: TaskId, patch: Partial<TaskRecord>): TaskRecord[] {
  return mapTask(tasks, id, task => ({ ...task, ...patch }));
}

/* Complete ⇄ reopen. Completing clears any closure (mutual exclusivity);
   reopening clears the completion instant. */
export function setTaskDone(tasks: TaskRecord[], id: TaskId, done: boolean, now: Instant = new Date()): TaskRecord[] {
  return mapTask(tasks, id, task => (done
    ? { ...without(task, 'closure', 'closed_at'), done: true, completed_at: toInstant(now) }
    : { ...without(task, 'completed_at'), done: false }));
}

export const completeTask = (tasks: TaskRecord[], id: TaskId, now: Instant = new Date()) =>
  setTaskDone(tasks, id, true, now);

function closeTask(tasks: TaskRecord[], id: TaskId, closure: TaskClosure, now: Instant): TaskRecord[] {
  return mapTask(tasks, id, task => ({
    ...without(task, 'completed_at'), done: false, closure, closed_at: toInstant(now),
  }));
}

export const closeTaskUnresolved = (tasks: TaskRecord[], id: TaskId, now: Instant = new Date()) =>
  closeTask(tasks, id, 'closed_unresolved', now);

export const archiveTask = (tasks: TaskRecord[], id: TaskId, now: Instant = new Date()) =>
  closeTask(tasks, id, 'archived', now);

/* Restore: the SAME task back to active. Only closure/completion metadata is
   cleared; schedule, content and created_at stay. A past date makes it
   overdue again. */
export function restoreTask(tasks: TaskRecord[], id: TaskId): TaskRecord[] {
  return mapTask(tasks, id, task => ({ ...without(task, 'completed_at', 'closure', 'closed_at'), done: false }));
}

/* Give each task of one day's sequence an explicit order matching its
   position, so an appended or swapped task lands exactly where intended.
   Only the tasks in `sequence` are touched. */
function withDayOrder(tasks: TaskRecord[], sequence: TaskRecord[]): TaskRecord[] {
  const positions = new Map(sequence.map((task, index) => [String(task.id), index]));
  return tasks.map(task => {
    const position = positions.get(String(task.id));
    return position == null || task.order === position ? task : { ...task, order: position };
  });
}

/* Move = change the schedule of the SAME task (no copy-delete). A new day
   appends the task after that day's existing tasks; clearing the date drops
   the order. `patch` carries other edited fields so a Calendar save is one
   state change. */
export function moveTask(
  tasks: TaskRecord[],
  id: TaskId,
  schedule: Partial<TaskSchedule> | null,
  patch: Partial<TaskRecord> = {},
): TaskRecord[] {
  const current = findTask(tasks, id);
  if (!current) return tasks;
  const nextSchedule = normalizeSchedule(schedule);
  const nextDate = nextSchedule && nextSchedule.date ? nextSchedule.date : null;
  const dayChanged = nextDate !== taskDate(current);
  const stakes = patch.stakes != null ? !!patch.stakes : !!current.stakes;

  let next = tasks;
  let order: number | undefined = current.order;
  if (dayChanged && nextDate) {
    const destination = tasksForDay(tasks, nextDate).filter(task => !sameId(task, id));
    next = withDayOrder(tasks, destination);
    order = destination.length;
  }
  return mapTask(next, id, task => {
    const base = { ...task, ...patch, schedule: nextSchedule, due: semanticDue(stakes, nextSchedule) };
    if (!nextDate) return without(base, 'order');
    return order == null ? base : { ...base, order };
  });
}

/* Swap a task with its neighbour inside one day, then renumber that day
   0..n-1. Moving past either end is a no-op. */
export function reorderDay(tasks: TaskRecord[], date: string, id: TaskId, direction: -1 | 1): TaskRecord[] {
  const day = tasksForDay(tasks, date);
  const index = day.findIndex(task => sameId(task, id));
  const target = index + direction;
  if (index < 0 || target < 0 || target >= day.length) return tasks;
  const sequence = day.slice();
  [sequence[index], sequence[target]] = [sequence[target], sequence[index]];
  return withDayOrder(tasks, sequence);
}
