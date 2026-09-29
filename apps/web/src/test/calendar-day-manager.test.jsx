import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { QuickAddModal } from '../components/QuickAddModal.jsx';
import { isTopDialog, nextLockState, wrapFocusIndex } from '../components/useDialog.js';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { CalendarTaskEditor, editorResult } from '../pages/calendar/CalendarTaskEditor.jsx';
import { DayManagerModal } from '../pages/calendar/DayManagerModal.jsx';

/* Day Manager + nested editor + dialog stack (plan C06, C10, C12, C13, C14,
   C24/C25 helpers, C31). Interaction itself is verified in the browser. */

const t = LifeMakeT('ru');
const noop = () => {};
const actions = { complete: noop, closeUnresolved: noop, archive: noop, remove: noop, update: noop, move: noop, reorder: noop };

function render(node, locale = 'ru') {
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ t: LifeMakeT(locale), locale }}>{node}</LifeLocaleContext.Provider>,
  );
}

const day = (date, overrides = {}) => ({ schedule: { date, time: '' }, done: false, ...overrides });
const tasks = [
  { id: 1, title: 'просроченная', ...day('2026-10-10') },
  { id: 2, title: 'сегодняшняя важная', stakes: true, ...day('2026-10-14', { schedule: { date: '2026-10-14', time: '09:30' } }) },
  { id: 3, title: 'сделанная', ...day('2026-10-14', { done: true, completed_at: '2026-10-14T08:00:00.000Z' }) },
  { id: 4, title: 'в архиве', ...day('2026-10-14', { closure: 'archived', closed_at: '2026-10-14T08:00:00.000Z' }) },
  { id: 5, title: 'другой день', ...day('2026-10-15') },
  { id: 6, titleKey: 'seed_task_ship', ...day('2026-10-14') },
];

function manager(date, locale = 'ru') {
  return render(
    <DayManagerModal date={date} tasks={tasks} today="2026-10-14" intl={locale === 'ru' ? 'ru-RU' : 'uk-UA'}
      t={LifeMakeT(locale)} actions={actions} onClose={noop} onAdd={noop} onOpenDay={noop} />, locale);
}

describe('Day Manager rows', () => {
  it('lists only the active tasks of that day', () => {
    const html = manager('2026-10-14');
    expect(html).toContain('сегодняшняя важная');
    expect(html).toContain(t('seed_task_ship'));
    expect(html).not.toContain('сделанная');
    expect(html).not.toContain('в архиве');
    expect(html).not.toContain('другой день');
    expect(html).toContain('09:30');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby="cal-day-title"');
    expect(html).toMatch(/<h2[^>]*id="cal-day-title"[^>]*>среда, 14 октября<\/h2>/);
  });

  it('offers complete, important/routine, reorder, edit, archive and delete per row', () => {
    const html = manager('2026-10-14');
    for (const text of ['выполнить: сегодняшняя важная', 'переместить выше: сегодняшняя важная',
      'переместить ниже: сегодняшняя важная', '>изменить<', '>в архив<', '>удалить<', '>рутина<', '>важное<']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('aria-checked="true" class="qa-toggle-btn is-stakes is-on"');
    /* focus follows the moved row via these hooks (verified in the browser) */
    expect(html).toContain('data-move="up"');
    expect(html).toContain('data-move="down"');
  });

  it('C31 · an overdue unmarked task stays on its day with the overdue mark and close action', () => {
    const past = manager('2026-10-10');
    expect(past).toContain('просроченная');
    expect(past).toContain('cal-overdue');
    expect(past).toContain('>закрыть без выполнения<');
    const current = manager('2026-10-14');
    expect(current).not.toContain('cal-overdue');
    expect(current).not.toContain('закрыть без выполнения');
  });

  it('renders a truthful empty day — no fake rows', () => {
    const html = manager('2026-10-20');
    expect(html).toContain('на этот день задач нет');
    expect(html).not.toContain('cal-task');
  });

  it('is fully localised in Ukrainian', () => {
    const html = manager('2026-10-14', 'uk');
    expect(html).toContain('>змінити<');
    expect(html).toContain('>в архів<');
    expect(html).toContain('додати задачу');
    expect(html).toMatch(/середа, 14 жовтня/);
  });
});

describe('nested editor', () => {
  const task = { id: 9, title: 'купить', notes: 'молоко', schedule: { date: '2026-10-14', time: '10:00' }, subtasks: [{ id: 1 }], category: { id: 'x' } };
  const form = overrides => ({ title: 'купить', date: '2026-10-14', time: '10:00', notes: 'молоко', ...overrides });

  it('reports no change for an untouched form', () => {
    expect(editorResult(task, form(), t)).toEqual({ errors: null, patch: {}, schedule: undefined, clearsDate: false });
  });

  it('C14 · edits title, time and description without touching other fields', () => {
    const result = editorResult(task, form({ title: 'купить хлеб', notes: 'и молоко', time: '18:00' }), t);
    expect(result.patch).toEqual({ title: 'купить хлеб', notes: 'и молоко' });
    expect(result.schedule).toEqual({ date: '2026-10-14', time: '18:00' });
    expect(Object.keys(result.patch)).not.toContain('subtasks');
  });

  it('C07 · a new date is reported as a schedule change (same id moves)', () => {
    expect(editorResult(task, form({ date: '2027-01-05' }), t).schedule).toEqual({ date: '2027-01-05', time: '10:00' });
  });

  it('C10 · rejects 2101, an impossible date and a malformed time; allows past dates', () => {
    expect(editorResult(task, form({ date: '2101-01-01' }), t).errors).toEqual({ date: 'cal_err_date' });
    expect(editorResult(task, form({ date: '2026-02-30' }), t).errors).toEqual({ date: 'cal_err_date' });
    expect(editorResult(task, form({ time: '25' }), t).errors).toEqual({ time: 'cal_err_time' });
    expect(editorResult(task, form({ title: '  ' }), t).errors).toEqual({ title: 'cal_err_title' });
    expect(editorResult(task, form({ date: '2020-03-01' }), t).errors).toBeNull();
  });

  it('flags clearing the date so the user must confirm leaving the Calendar', () => {
    expect(editorResult(task, form({ date: '' }), t)).toMatchObject({ clearsDate: true, schedule: { date: '', time: '10:00' } });
  });

  it('keeps a seed titleKey unless the title is edited', () => {
    const seed = { id: 1, titleKey: 'seed_task_ship', schedule: { date: '2026-10-14', time: '' } };
    expect(editorResult(seed, { title: t('seed_task_ship'), date: '2026-10-14', time: '', notes: '' }, t).patch).toEqual({});
  });

  it('renders a labelled nested dialog with bounded date input', () => {
    const html = render(<CalendarTaskEditor task={task} t={t} onCancel={noop} onSave={noop} />);
    expect(html).toContain('aria-labelledby="cal-editor-title"');
    expect(html).toContain('max="2100-12-31"');
    expect(html).toContain('value="2026-10-14"');
    expect(html).toContain('cal-editor-backdrop');
  });
});

describe('C06 · add-from-day prefills Quick Add with the exact date', () => {
  it('opens the schedule block pre-filled', () => {
    const html = render(<QuickAddModal open onClose={noop} onSave={noop} defaultDate="2026-10-14" />);
    expect(html).toContain('type="date"');
    expect(html).toContain('value="2026-10-14"');
  });

  it('keeps the collapsed schedule without a date', () => {
    expect(render(<QuickAddModal open onClose={noop} onSave={noop} />)).not.toContain('type="date"');
  });

  it('wires the Day Manager add button to Quick Add with that date', () => {
    const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
    expect(app).toContain('<CalendarPage onAddForDay={(date) => openQuickAdd(false, { date })} />');
    expect(app).toContain("defaultDate={quickSeed && quickSeed.date ? quickSeed.date : ''}");
  });
});

describe('C24 / C25 · dialog stack helpers', () => {
  it('only the last dialog in the document is top-most', () => {
    const parent = {};
    const child = {};
    expect(isTopDialog([parent], parent)).toBe(true);
    expect(isTopDialog([parent, child], parent)).toBe(false);
    expect(isTopDialog([parent, child], child)).toBe(true);
    expect(isTopDialog([], parent)).toBe(false);
  });

  it('wraps Tab and Shift+Tab inside the dialog', () => {
    expect(wrapFocusIndex(2, 3, false)).toBe(0);
    expect(wrapFocusIndex(0, 3, true)).toBe(2);
    expect(wrapFocusIndex(1, 3, false)).toBe(2);
    expect(wrapFocusIndex(0, 0, false)).toBe(-1);
  });

  it('keeps the body locked until the last nested dialog closes', () => {
    let state = { count: 0, saved: null };
    let step = nextLockState(state, 1, 'auto');
    expect(step.overflow).toBe('hidden');
    state = { count: step.count, saved: step.saved };
    step = nextLockState(state, 1, 'hidden');
    expect(step.overflow).toBe('hidden');
    state = { count: step.count, saved: step.saved };
    step = nextLockState(state, -1, 'hidden');
    expect([step.count, step.overflow]).toEqual([1, 'hidden']);
    state = { count: step.count, saved: step.saved };
    step = nextLockState(state, -1, 'hidden');
    expect([step.count, step.overflow]).toEqual([0, 'auto']);
  });
});
