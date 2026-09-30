import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MAX_DAY_TIMER_MS, watchKyivDay } from '../app/useKyivToday.js';
import { saveTaskDetail } from '../app/taskDetailSave.js';
import { TaskDetailModal } from '../components/TaskDetailModal.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { msUntilNextDay, scheduleEdit, todayDateOnly, validateScheduleInput } from '../domain/calendarModel.ts';
import {
  archiveTask, closeTaskUnresolved, completeTask, findTask, moveTask, overdueTasks, patchTask, restoreTask,
  sortTasksByDate, taskViewCounts, tasksDueToday, tasksForDay, tasksForView, TASK_VIEWS,
} from '../domain/tasks.ts';
import { TasksPage } from '../pages/TasksPage.jsx';

/* GTD G2 · Tasks «сегодня» / «просрочено» on schedule.date (Europe/Kyiv),
   chronological «по дате», and date/time editing from the Tasks detail. */

const TODAY = '2026-10-14';
const task = (id, extra = {}) => ({ id, title: `t${id}`, done: false, stakes: false, ...extra });
const on = (date, time = '') => ({ schedule: { date, time } });

const TASKS = [
  task(1, on('2026-10-13')),                          // yesterday → overdue
  task(2, on(TODAY, '09:00')),                        // today
  task(3, on('2026-10-15')),                          // tomorrow
  task(4),                                            // undated
  task(5, { tag: 'today', stakes: true, due: 'eod' }), // legacy «today» tag + stakes, no date
  task(6, { due: '17:00', schedule: { date: '', time: '17:00' } }), // legacy time without date
  task(7, { ...on(TODAY), done: true, completed_at: '2026-10-14T08:00:00.000Z' }),
  task(8, { ...on('2026-10-12'), closure: 'closed_unresolved', closed_at: '2026-10-13T08:00:00.000Z' }),
  task(9, { ...on(TODAY), closure: 'archived', closed_at: '2026-10-13T08:00:00.000Z' }),
  task(10, { ...on('2026-10-01'), done: true }),
];
const ids = list => list.map(t => t.id);

describe('Today / Overdue selectors', () => {
  it('Today = active tasks dated Kyiv-today only; legacy tag/stakes/due never count', () => {
    expect(ids(tasksDueToday(TASKS, TODAY))).toEqual([2]);
  });

  it('Overdue = active tasks dated before today; completed and closed never count', () => {
    expect(ids(overdueTasks(TASKS, TODAY))).toEqual([1]);
  });

  it('moves with the day: tomorrow becomes today, today becomes overdue', () => {
    expect(ids(tasksDueToday(TASKS, '2026-10-15'))).toEqual([3]);
    expect(ids(overdueTasks(TASKS, '2026-10-15'))).toEqual([1, 2]);
  });

  it('a Do Now task (undated) is in neither view', () => {
    const doNow = task(11, { schedule: null, due: '', tag: null });
    expect(tasksDueToday([doNow], TODAY)).toEqual([]);
    expect(overdueTasks([doNow], TODAY)).toEqual([]);
  });
});

describe('JENKIN · Tasks views and their counts', () => {
  it('keeps the production views in their display order', () => {
    expect(TASK_VIEWS).toEqual(['all', 'today', 'overdue', 'routine', 'stakes', 'done']);
  });

  it('every view starts from the non-closed tasks; counts are the row counts', () => {
    expect(ids(tasksForView(TASKS, 'all', TODAY))).toEqual([1, 2, 3, 4, 5, 6, 7, 10]);
    expect(ids(tasksForView(TASKS, 'today', TODAY))).toEqual([2]);
    expect(ids(tasksForView(TASKS, 'overdue', TODAY))).toEqual([1]);
    expect(ids(tasksForView(TASKS, 'routine', TODAY))).toEqual([1, 2, 3, 4, 6]);
    expect(ids(tasksForView(TASKS, 'stakes', TODAY))).toEqual([5]);
    expect(ids(tasksForView(TASKS, 'done', TODAY))).toEqual([7, 10]);
    const counts = taskViewCounts(TASKS, TODAY);
    for (const view of TASK_VIEWS) expect(counts[view]).toBe(tasksForView(TASKS, view, TODAY).length);
  });

  it('undated tasks, the legacy «today» tag and a dateless time are never in today / overdue', () => {
    for (const view of ['today', 'overdue']) {
      const hit = ids(tasksForView(TASKS, view, TODAY));
      expect(hit).not.toContain(4);
      expect(hit).not.toContain(5);
      expect(hit).not.toContain(6);
    }
  });

  it('counts move with the Kyiv day and with the task lifecycle', () => {
    expect(taskViewCounts(TASKS, '2026-10-15')).toMatchObject({ today: 1, overdue: 2 });
    const closed = archiveTask(TASKS, 2, '2026-10-14T10:00:00.000Z');
    expect(taskViewCounts(closed, TODAY)).toMatchObject({ all: 7, today: 0 });
    const restored = restoreTask(closed, 2);
    expect(findTask(restored, 2).id).toBe(2);
    expect(taskViewCounts(restored, TODAY)).toMatchObject({ all: 8, today: 1 });
    const done = completeTask(TASKS, 1, '2026-10-14T10:00:00.000Z');
    expect(taskViewCounts(done, TODAY)).toMatchObject({ overdue: 0, done: 3 });
  });
});

describe('Kyiv day boundary', () => {
  it.each([
    ['2026-10-13T20:59:59.000Z', '2026-10-13'], // 23:59:59 Kyiv (+03)
    ['2026-10-13T21:00:00.000Z', '2026-10-14'], // 00:00 Kyiv
    ['2026-12-31T21:59:59.000Z', '2026-12-31'], // 23:59:59 Kyiv (+02, winter)
    ['2026-12-31T22:00:00.000Z', '2027-01-01'],
  ])('todayDateOnly(%s) = %s regardless of the system zone', (instant, day) => {
    expect(todayDateOnly(instant)).toBe(day);
  });

  it('msUntilNextDay counts to Kyiv midnight, including the 25-hour DST day', () => {
    expect(msUntilNextDay('2026-10-13T20:59:00.000Z')).toBe(60_000);
    // 2026-10-25 (DST ends): 00:00 +03 → next 00:00 +02 is 25 h later.
    expect(msUntilNextDay('2026-10-24T21:00:00.000Z')).toBe(25 * 3600_000);
  });
});

describe('watchKyivDay · the open view follows the date', () => {
  function harness(startIso) {
    let clock = Date.parse(startIso);
    const pending = [];
    const listeners = {};
    const timers = {
      setTimeout: (fn, ms) => { const h = { fn, at: clock + ms }; pending.push(h); return h; },
      clearTimeout: h => { const i = pending.indexOf(h); if (i >= 0) pending.splice(i, 1); },
    };
    const events = {
      visibilityState: 'visible',
      addEventListener: (type, fn) => { listeners[type] = fn; },
      removeEventListener: type => { delete listeners[type]; },
    };
    const days = [];
    const dispose = watchKyivDay({ now: () => clock, onDay: d => days.push(d), timers, target: events, doc: events });
    return {
      days, pending, listeners, dispose,
      advance(ms) {
        clock += ms;
        for (;;) {
          const due = pending.filter(h => h.at <= clock).sort((a, b) => a.at - b.at)[0];
          if (!due) break;
          pending.splice(pending.indexOf(due), 1);
          due.fn();
        }
      },
      jump(ms) { clock += ms; }, // clock moves while timers are suspended
    };
  }

  it('reports the new day just after Kyiv midnight and not before', () => {
    const h = harness('2026-10-13T20:58:00.000Z'); // 23:58 Kyiv
    h.advance(60_000);
    expect(h.days).toEqual([]);
    h.advance(90_000);
    expect(h.days).toEqual(['2026-10-14']);
    expect(h.pending).toHaveLength(1); // re-armed for the next midnight
  });

  it('catches up when a suspended tab becomes visible or regains focus', () => {
    const h = harness('2026-10-13T12:00:00.000Z');
    h.jump(24 * 3600_000); // laptop slept; no timer fired
    expect(h.days).toEqual([]);
    h.listeners.visibilitychange();
    expect(h.days).toEqual(['2026-10-14']);
    h.listeners.focus(); // same day again → no duplicate report
    expect(h.days).toEqual(['2026-10-14']);
  });

  it('never sleeps longer than an hour, and the disposer detaches everything', () => {
    const h = harness('2026-10-13T00:00:00.000Z');
    expect(h.pending[0].at - Date.parse('2026-10-13T00:00:00.000Z')).toBe(MAX_DAY_TIMER_MS);
    h.dispose();
    expect(h.pending).toHaveLength(0);
    expect(Object.keys(h.listeners)).toEqual([]);
  });
});

describe('«по дате» sort', () => {
  it('orders by date, then Calendar day order (explicit order, timed before untimed), undated last, stable', () => {
    const list = [
      task('u1'),
      task('b-untimed', on('2026-10-14')),
      task('c', on('2026-10-20')),
      task('b-late', on('2026-10-14', '18:00')),
      task('a', on('2026-10-01')),
      task('b-early', on('2026-10-14', '08:00')),
      task('u2', { schedule: { date: '', time: '09:00' } }),
      task('b-ordered', { ...on('2026-10-14', '23:00'), order: 0 }),
      task('u3'),
    ];
    expect(ids(sortTasksByDate(list))).toEqual([
      'a', 'b-ordered', 'b-early', 'b-late', 'b-untimed', 'c', 'u1', 'u2', 'u3',
    ]);
    /* The same-day order is exactly the Calendar's. */
    const day = ids(tasksForDay(list, '2026-10-14'));
    expect(ids(sortTasksByDate(list)).filter(id => day.includes(id))).toEqual(day);
  });
});

describe('schedule input validation (shared by Calendar and Tasks)', () => {
  it('sets, changes and clears', () => {
    expect(validateScheduleInput({ date: '2026-10-20', time: '' })).toEqual({ errors: null, schedule: { date: '2026-10-20', time: '' } });
    expect(validateScheduleInput({ date: '2026-10-20', time: '07:30' }).schedule).toEqual({ date: '2026-10-20', time: '07:30' });
    expect(validateScheduleInput({ date: '', time: '' })).toEqual({ errors: null, schedule: null });
  });

  it('rejects a time without a date, impossible dates, out-of-range years and times', () => {
    expect(validateScheduleInput({ date: '', time: '10:00' }).errors).toEqual({ time: 'cal_err_time_needs_date' });
    expect(validateScheduleInput({ date: '2026-02-30' }).errors).toEqual({ date: 'cal_err_date' });
    expect(validateScheduleInput({ date: '2101-01-01' }).errors).toEqual({ date: 'cal_err_date' });
    expect(validateScheduleInput({ date: '2026-10-20', time: '24:00' }).errors).toEqual({ time: 'cal_err_time' });
    expect(validateScheduleInput({ date: '2020-01-01' }).errors).toBeNull(); // past dates are allowed
  });

  it('scheduleEdit reports only real changes and flags leaving the Calendar', () => {
    const dated = task(1, on('2026-10-14', '10:00'));
    expect(scheduleEdit(dated, { date: '2026-10-14', time: '10:00' })).toEqual({ errors: null, schedule: undefined, clearsDate: false });
    expect(scheduleEdit(dated, { date: '2026-10-16', time: '10:00' }).schedule).toEqual({ date: '2026-10-16', time: '10:00' });
    expect(scheduleEdit(dated, { date: '', time: '' })).toEqual({ errors: null, schedule: { date: '', time: '' }, clearsDate: true });
    /* A legacy dateless time is not a schedule: an untouched form is no change. */
    expect(scheduleEdit(task(2, { schedule: { date: '', time: '17:00' } }), { date: '', time: '' }).schedule).toBeUndefined();
  });
});

describe('saving from the Tasks detail', () => {
  /* A provider stand-in that applies the real domain transitions. */
  function provider(initial) {
    const data = {
      tasks: initial,
      moveTask: vi.fn((id, schedule, patch) => { data.tasks = moveTask(data.tasks, id, schedule, patch); }),
      updateTaskFields: vi.fn((id, patch) => { data.tasks = patchTask(data.tasks, id, patch); }),
    };
    return data;
  }
  const base = {
    id: 42, title: 'позвонить', done: false, stakes: false, notes: 'n', category: { id: 'x' }, subtasks: [{ id: 1 }],
    created_at: '2026-10-01T09:00:00.000Z', schedule: { date: '2026-10-14', time: '' }, due: '2026-10-14', order: 0,
  };

  it('a date change moves the SAME task to the new Calendar day, keeping id and unrelated fields', () => {
    const data = provider([task(1, { ...on('2026-10-20'), order: 0 }), base]);
    expect(saveTaskDetail({ tasks: data.tasks, data }, 42, {}, { date: '2026-10-20', time: '09:30' })).toEqual({ ok: true });
    const moved = findTask(data.tasks, 42);
    expect(moved).toMatchObject({
      id: 42, title: 'позвонить', notes: 'n', category: { id: 'x' }, subtasks: [{ id: 1 }],
      created_at: base.created_at, done: false, schedule: { date: '2026-10-20', time: '09:30' }, due: '09:30', order: 1,
    });
    expect(ids(tasksForDay(data.tasks, '2026-10-14'))).toEqual([]);
    expect(ids(tasksForDay(data.tasks, '2026-10-20'))).toEqual([1, 42]);
    expect(data.tasks).toHaveLength(2);
  });

  it('clearing the date removes it from dated views but keeps the task', () => {
    const data = provider([base]);
    saveTaskDetail({ tasks: data.tasks, data }, 42, {}, { date: '', time: '' });
    const cleared = findTask(data.tasks, 42);
    expect(cleared.schedule).toBeNull();
    expect(cleared.due).toBe('');
    expect(cleared.order).toBeUndefined();
    expect(tasksDueToday(data.tasks, '2026-10-14')).toEqual([]);
    expect(sortTasksByDate(data.tasks)).toHaveLength(1);
  });

  it('keeps the lifecycle: rescheduling a completed task leaves it completed', () => {
    const done = completeTask([base], 42, '2026-10-14T12:00:00.000Z');
    const data = provider(done);
    saveTaskDetail({ tasks: data.tasks, data }, 42, {}, { date: '2026-10-21', time: '' });
    expect(findTask(data.tasks, 42)).toMatchObject({ done: true, completed_at: '2026-10-14T12:00:00.000Z' });
  });

  it('a plain field edit does not touch the schedule', () => {
    const data = provider([base]);
    saveTaskDetail({ tasks: data.tasks, data }, 42, { title: 'написать' }, undefined);
    expect(data.moveTask).not.toHaveBeenCalled();
    expect(findTask(data.tasks, 42)).toMatchObject({ title: 'написать', schedule: base.schedule, order: 0 });
  });

  it('reports a missing task and never recreates it', () => {
    const data = provider([]);
    expect(saveTaskDetail({ tasks: data.tasks, data }, 42, { title: 'x' }, { date: '2026-10-20', time: '' }))
      .toEqual({ ok: false, code: 'missing' });
    expect(data.moveTask).not.toHaveBeenCalled();
    expect(data.updateTaskFields).not.toHaveBeenCalled();
    expect(data.tasks).toEqual([]);
  });

  it('closed tasks keep their closure when moved', () => {
    const closed = closeTaskUnresolved([base], 42, '2026-10-14T12:00:00.000Z');
    const archived = archiveTask([base], 42, '2026-10-14T12:00:00.000Z');
    for (const tasks of [closed, archived]) {
      const moved = moveTask(tasks, 42, { date: '2026-10-22', time: '' });
      expect(findTask(moved, 42).closure).toBe(findTask(tasks, 42).closure);
    }
  });
});

function render(locale, node) {
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), themeEff: 'dark' }}>{node}</LifeLocaleContext.Provider>,
  );
}

describe('Tasks page rendering', () => {
  it('defaults to chronological order and labels dated rows with their Calendar date', () => {
    const html = render('ru', <TasksPage tasks={[task(1), task(2, on('2026-10-20', '09:30')), task(3, on('2026-10-05'))]}
      waitingItems={[]} onToggle={vi.fn()} onAdd={vi.fn()} onOpen={vi.fn()} />);
    expect(html.indexOf('>t3<')).toBeLessThan(html.indexOf('>t2<'));
    expect(html.indexOf('>t2<')).toBeLessThan(html.indexOf('>t1<'));
    expect(html).toContain('dateTime="2026-10-20T09:30"');
    expect(html).toMatch(/20 окт\.? · 09:30/);
  });

  it('marks a past dated active task as overdue', () => {
    const html = render('uk', <TasksPage tasks={[task(1, on('2020-01-02'))]}
      waitingItems={[]} onToggle={vi.fn()} onAdd={vi.fn()} onOpen={vi.fn()} />);
    expect(html).toContain('class="task-due mono is-overdue"');
  });
});

describe('Tasks detail · date and time', () => {
  const props = { onClose: vi.fn(), onUpdate: vi.fn(), onComplete: vi.fn(), onDelete: vi.fn() };

  it('shows the Calendar date and time of a persisted task (RU/UK)', () => {
    const t1 = task(1, on('2026-10-20', '09:30'));
    const ru = render('ru', <TaskDetailModal task={t1} {...props} />);
    expect(ru).toContain('дата и время');
    expect(ru).toContain('value="2026-10-20"');
    expect(ru).toContain('value="09:30"');
    expect(ru).toContain('>убрать дату<');
    expect(ru).toMatch(/role="dialog" aria-modal="true"/);
    const uk = render('uk', <TaskDetailModal task={t1} {...props} />);
    expect(uk).toContain('дата й час');
    expect(uk).toContain('>прибрати дату<');
  });

  it('never shows a legacy dateless time as a schedule', () => {
    const html = render('ru', <TaskDetailModal task={task(1, { due: '17:00', schedule: { date: '', time: '17:00' } })} {...props} />);
    expect(html).not.toContain('value="17:00"');
    expect(html).not.toContain('>убрать дату<');
  });

  it('offers no scheduling for display-only rows', () => {
    expect(render('ru', <TaskDetailModal task={task(1)} canSchedule={false} {...props} />)).not.toContain('дата и время');
  });

  it('explains a removed task and disables its actions', () => {
    const html = render('ru', <TaskDetailModal task={task(1)} missing {...props} />);
    expect(html).toContain('этой задачи больше нет');
    expect(html).not.toContain('дата и время');
    expect(html).toMatch(/<button class="qa-btn-ghost" disabled="">/);
  });
});
