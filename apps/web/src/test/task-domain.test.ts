import { describe, expect, it } from 'vitest';

import { buildInitialState, migrateStateCopy } from '../context/LifeDataContext.jsx';
import {
  archiveTask,
  closeTaskUnresolved,
  completeTask,
  createQuickAddTaskRecord,
  historyInstant,
  historyStatus,
  historyTasks,
  isTaskActive,
  isTaskOverdue,
  moveTask,
  patchTask,
  reorderDay,
  restoreTask,
  semanticDue,
  setTaskDone,
  taskDate,
  tasksForDay,
  validateTaskRecord,
  withCreatedAt,
  type TaskRecord,
} from '../domain/tasks';

/* Calendar task domain (plan C06–C19, C29–C33, C36). */

const NOW = '2026-10-14T09:00:00.000Z';
const LATER = '2026-10-15T18:30:00.000Z';

function task(id: number, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    title: `задача ${id}`,
    done: false,
    stakes: false,
    tag: null,
    tagLabel: null,
    due: '',
    schedule: null,
    notes: `заметка ${id}`,
    category: { id: 'groceries' },
    subtasks: [{ id: 1, title: 'шаг', done: false }],
    created_at: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

const on = (date: string, time = '') => ({ schedule: { date, time } });
const ids = (tasks: TaskRecord[]) => tasks.map(item => item.id);
const roundTrip = (tasks: TaskRecord[]) =>
  migrateStateCopy(JSON.parse(JSON.stringify({ ...buildInitialState(), tasks }))).tasks as TaskRecord[];

describe('dates and day membership', () => {
  it('reads schedule.date as the only Calendar date authority', () => {
    expect(taskDate(task(1, on('2026-10-14')))).toBe('2026-10-14');
    expect(taskDate(task(2, { due: 'tue' }))).toBeNull();
    expect(taskDate(task(3, { due: '14:00', schedule: { date: '', time: '14:00' } }))).toBeNull();
    expect(taskDate(task(4, on('2026-02-30')))).toBeNull();
  });

  it('lists only active tasks of the day, ordered by order, then time, then creation', () => {
    const tasks = [
      task(1, on('2026-10-14', '18:00')),
      task(2, on('2026-10-14', '09:00')),
      task(3, on('2026-10-14')),
      task(4, { ...on('2026-10-14'), done: true }),
      task(5, { ...on('2026-10-14'), closure: 'archived', closed_at: NOW }),
      task(6, on('2026-10-15')),
    ];
    expect(ids(tasksForDay(tasks, '2026-10-14'))).toEqual([2, 1, 3]);
    const ordered = tasks.map(item => (item.id === 3 ? { ...item, order: 0 } : item));
    expect(ids(tasksForDay(ordered, '2026-10-14'))[0]).toBe(3);
  });

  it('C31 · an overdue task nobody marked stays active and outside History', () => {
    const overdue = task(1, on('2026-10-10'));
    expect(isTaskOverdue(overdue, '2026-10-14')).toBe(true);
    expect(isTaskActive(overdue)).toBe(true);
    expect(historyTasks([overdue])).toEqual([]);
    expect(tasksForDay([overdue], '2026-10-10')).toEqual([overdue]);
    expect(isTaskOverdue(task(2, on('2026-10-14')), '2026-10-14')).toBe(false);
    expect(isTaskOverdue(task(3, { ...on('2026-10-10'), done: true }), '2026-10-14')).toBe(false);
    expect(isTaskOverdue(task(4), '2026-10-14')).toBe(false);
  });
});

describe('completion and closure (OD-1)', () => {
  it('C11 · complete stamps completed_at; reopen clears it', () => {
    const [done] = completeTask([task(1)], 1, NOW);
    expect(done).toMatchObject({ done: true, completed_at: NOW });
    const [open] = setTaskDone([done], 1, false);
    expect(open.done).toBe(false);
    expect(open).not.toHaveProperty('completed_at');
  });

  it('C17 · close without completion and archive use the exact vocabulary', () => {
    const [closed] = closeTaskUnresolved([task(1)], 1, NOW);
    expect(closed).toMatchObject({ done: false, closure: 'closed_unresolved', closed_at: NOW });
    const [archived] = archiveTask([task(2)], 2, NOW);
    expect(archived).toMatchObject({ done: false, closure: 'archived', closed_at: NOW });
    expect(historyStatus(closed)).toBe('closed_unresolved');
    expect(historyStatus(archived)).toBe('archived');
  });

  it('C32 · completing clears any closure', () => {
    const [closed] = closeTaskUnresolved([task(1)], 1, NOW);
    const [done] = completeTask([closed], 1, LATER);
    expect(done).toMatchObject({ done: true, completed_at: LATER });
    expect(done).not.toHaveProperty('closure');
    expect(done).not.toHaveProperty('closed_at');
  });

  it('C33 · close/archive clear completion metadata', () => {
    const [done] = completeTask([task(1)], 1, NOW);
    const [closed] = closeTaskUnresolved([done], 1, LATER);
    expect(closed.done).toBe(false);
    expect(closed).not.toHaveProperty('completed_at');
    const [archived] = archiveTask([done], 1, LATER);
    expect(archived.done).toBe(false);
    expect(archived).not.toHaveProperty('completed_at');
  });
});

describe('History (derived) and Restore', () => {
  const tasks = [
    task(1, { ...on('2026-10-10'), done: true, completed_at: '2026-10-10T10:00:00.000Z' }),
    task(2, { closure: 'closed_unresolved', closed_at: '2026-10-12T10:00:00.000Z' }),
    task(3, { closure: 'archived', closed_at: '2026-10-11T10:00:00.000Z' }),
    task(4, on('2026-10-01')),
    task(5, { done: true, created_at: undefined }),
    task(6),
  ];

  it('C16/C17 · contains completed, closed_unresolved and archived only, newest first', () => {
    expect(ids(historyTasks(tasks))).toEqual([2, 3, 1, 5]);
  });

  it('C36 · a legacy done task keeps unknown timestamps (never fabricated)', () => {
    const legacy = historyTasks(tasks).find(item => item.id === 5) as TaskRecord;
    expect(historyInstant(legacy)).toBeNull();
    expect(legacy.created_at).toBeUndefined();
  });

  it('C30 · History depends only on state.tasks, never on activityLog', () => {
    const state = { ...buildInitialState(), tasks, activityLog: [] };
    const withLog = { ...state, activityLog: [{ entity_type: 'task', entity_id: 4, action: 'completed' }] };
    expect(historyTasks(state.tasks)).toEqual(historyTasks(withLog.tasks));
  });

  it('C18 · Restore clears done/closure metadata on the same id and keeps content', () => {
    for (const id of [1, 2, 3]) {
      const next = restoreTask(tasks, id);
      const restored = next.find(item => item.id === id) as TaskRecord;
      const before = tasks.find(item => item.id === id) as TaskRecord;
      expect(restored.done).toBe(false);
      for (const key of ['completed_at', 'closure', 'closed_at']) expect(restored).not.toHaveProperty(key);
      for (const key of ['title', 'notes', 'schedule', 'category', 'subtasks', 'created_at', 'stakes']) {
        expect(restored[key]).toEqual(before[key]);
      }
      expect(historyTasks(next).map(item => item.id)).not.toContain(id);
    }
  });

  it('C19 · Restore never duplicates or re-ids', () => {
    const next = restoreTask(tasks, 2);
    expect(next).toHaveLength(tasks.length);
    expect(ids(next)).toEqual(ids(tasks));
  });

  it('a restored past-dated task is active and overdue again', () => {
    const [restored] = restoreTask([task(1, { ...on('2026-10-10'), done: true, completed_at: NOW })], 1);
    expect(isTaskOverdue(restored, '2026-10-14')).toBe(true);
  });

  it('C12 · a deleted task simply no longer exists — nothing to show or restore', () => {
    const remaining = tasks.filter(item => item.id !== 1);
    expect(ids(historyTasks(remaining))).not.toContain(1);
    expect(restoreTask(remaining, 1)).toEqual(remaining);
  });
});

describe('move and reorder', () => {
  const tasks = [
    task(1, on('2026-10-14', '09:00')),
    task(2, on('2026-10-14', '10:00')),
    task(3, on('2026-10-20')),
    task(4, on('2026-10-20')),
  ];

  it('C07 · a date edit keeps the same id and appends to the destination day', () => {
    const next = moveTask(tasks, 1, { date: '2026-10-20', time: '09:00' });
    expect(next).toHaveLength(tasks.length);
    expect(ids(tasksForDay(next, '2026-10-14'))).toEqual([2]);
    expect(ids(tasksForDay(next, '2026-10-20'))).toEqual([3, 4, 1]);
    const moved = next.find(item => item.id === 1) as TaskRecord;
    for (const key of ['title', 'notes', 'category', 'subtasks', 'created_at', 'stakes']) {
      expect(moved[key]).toEqual((tasks[0] as TaskRecord)[key]);
    }
    expect(moved.due).toBe('09:00');
  });

  it('C08 / C09 · cross-month and cross-year moves', () => {
    const month = moveTask(tasks, 2, { date: '2026-11-03', time: '' });
    expect(ids(tasksForDay(month, '2026-11-03'))).toEqual([2]);
    const year = moveTask(tasks, 2, { date: '2031-01-01', time: '' });
    expect(ids(tasksForDay(year, '2031-01-01'))).toEqual([2]);
    expect(taskDate(year.find(item => item.id === 2) as TaskRecord)).toBe('2031-01-01');
  });

  it('carries the other edited fields in the same change', () => {
    const next = moveTask(tasks, 1, { date: '2026-10-14', time: '11:00' }, { title: 'новое', notes: 'n' });
    const edited = next.find(item => item.id === 1) as TaskRecord;
    expect(edited).toMatchObject({ title: 'новое', notes: 'n', schedule: { date: '2026-10-14', time: '11:00' } });
  });

  it('clearing the date takes the task out of the Calendar but keeps it', () => {
    const next = moveTask(reorderDay(tasks, '2026-10-14', 2, -1), 2, null);
    const cleared = next.find(item => item.id === 2) as TaskRecord;
    expect(cleared.schedule).toBeNull();
    expect(cleared).not.toHaveProperty('order');
    expect(next).toHaveLength(tasks.length);
  });

  it('C15 · reorder renumbers only that day and survives a snapshot round-trip', () => {
    const next = reorderDay(tasks, '2026-10-14', 2, -1);
    expect(ids(tasksForDay(next, '2026-10-14'))).toEqual([2, 1]);
    expect(next.filter(item => item.order != null).map(item => item.id).sort()).toEqual([1, 2]);
    expect(ids(tasksForDay(roundTrip(next), '2026-10-14'))).toEqual([2, 1]);
    expect(reorderDay(next, '2026-10-14', 2, -1)).toBe(next);
  });

  it('C13 · the important/routine toggle persists through a round-trip', () => {
    const next = patchTask(tasks, 1, { stakes: true });
    expect((roundTrip(next).find(item => item.id === 1) as TaskRecord).stakes).toBe(true);
  });
});

describe('creation', () => {
  it('stamps created_at once and never overwrites an existing one', () => {
    expect(withCreatedAt(task(1, { created_at: undefined }), NOW).created_at).toBe(NOW);
    expect(withCreatedAt(task(1), NOW).created_at).toBe('2026-10-01T08:00:00.000Z');
  });

  it('C06 · add-from-day keeps the exact date through the snapshot round-trip', () => {
    const created = createQuickAddTaskRecord({
      title: 'позвонить', stakes: false, category: null, tagLabel: null,
      schedule: { date: '2026-10-14', time: '' }, notes: '',
    }, NOW, 777);
    expect(created).toMatchObject({ id: 777, schedule: { date: '2026-10-14', time: '' }, due: '2026-10-14', created_at: NOW });
    expect(ids(tasksForDay(roundTrip([created]), '2026-10-14'))).toEqual([777]);
  });

  it('keeps due non-localised', () => {
    expect(semanticDue(true, null)).toBe('eod');
    expect(semanticDue(false, null)).toBe('');
    expect(semanticDue(true, { date: '2026-10-14', time: '14:00' })).toBe('14:00');
    expect(semanticDue(false, { date: '2026-10-14', time: '' })).toBe('2026-10-14');
  });
});

describe('snapshot validation (C29)', () => {
  it('keeps version 2 and leaves legacy tasks untouched', () => {
    const state = buildInitialState();
    const migrated = migrateStateCopy(state);
    expect(migrated.version).toBe(2);
    expect(migrated.tasks).toEqual(state.tasks);
    expect(migrated.tasks.every((item: TaskRecord) => !('created_at' in item))).toBe(true);
  });

  it('accepts well-formed optional metadata', () => {
    expect(() => validateTaskRecord(task(1, { done: true, completed_at: NOW, order: 0 }))).not.toThrow();
    expect(() => validateTaskRecord(task(2, { closure: 'archived', closed_at: NOW }))).not.toThrow();
    expect(() => validateTaskRecord(task(3, { closure: null }))).not.toThrow();
  });

  it.each([
    [{ created_at: 'вчера' }, /created_at/],
    [{ completed_at: '2026-10-14' }, /completed_at/],
    [{ closure: 'deleted' }, /closure/],
    [{ closed_at: 5 }, /closed_at/],
    [{ order: -1 }, /order/],
    [{ order: 1.5 }, /order/],
  ])('rejects malformed %o', (overrides, message) => {
    expect(() => migrateStateCopy({ ...buildInitialState(), tasks: [task(1, overrides as Partial<TaskRecord>)] }))
      .toThrow(message);
  });
});
