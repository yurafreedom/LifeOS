import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TaskDetailModal, taskDetailPatch, taskDisplayTitle } from '../components/TaskDetailModal.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { LifeExpenseCats } from '../data/categories.js';
import { patchTask } from '../domain/tasks.ts';

/* P0 · task-integrity regressions (Calendar plan C14, C34). */

const t = LifeMakeT('ru');
const cats = LifeExpenseCats;
const category = cats[0];
const persisted = {
  id: 42,
  title: 'купить подарок',
  done: false,
  stakes: false,
  tag: null,
  tagLabel: category.name.ru,
  category,
  due: '14:00',
  schedule: { date: '2026-10-14', time: '14:00' },
  notes: 'бюджет 50',
  subtasks: [{ id: 1, title: 'выбрать', done: false }],
  created_at: '2026-10-01T08:00:00.000Z',
};

function draftOf(task, overrides = {}) {
  return {
    title: taskDisplayTitle(task, t),
    stakes: !!task.stakes,
    catId: task.category ? task.category.id : null,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    notes: task.notes || '',
    ...overrides,
  };
}

describe('TaskDetail save · only changed fields reach the persisted task', () => {
  it('produces an empty patch when nothing was edited', () => {
    expect(taskDetailPatch(persisted, draftOf(persisted), t, cats)).toEqual({});
  });

  it('C14 · a title edit preserves notes, category, subtasks, schedule, due and created_at', () => {
    const patch = taskDetailPatch(persisted, draftOf(persisted, { title: 'купить два подарка' }), t, cats);
    expect(patch).toEqual({ title: 'купить два подарка' });
    const [saved] = patchTask([persisted], 42, patch);
    expect(saved).toEqual({ ...persisted, title: 'купить два подарка' });
  });

  it('a display-resolved copy can no longer overwrite persisted fields', () => {
    /* What a list row used to hand the modal: resolved title and localised due,
       without notes/category/subtasks/schedule. The modal now receives the
       persisted task; the patch from an untouched form is empty. */
    const tasks = [persisted, { id: 7, title: 'другая', done: false }];
    const next = patchTask(tasks, '42', {});
    expect(next[0]).toEqual(persisted);
    expect(next[1]).toBe(tasks[1]);
  });

  it('keeps a seed titleKey localisable unless the title is edited', () => {
    const seed = { id: 1, titleKey: 'seed_task_ship', done: false, stakes: true, tag: 'today', due: 'eod' };
    expect(taskDetailPatch(seed, draftOf(seed), t, cats)).toEqual({});
    expect(taskDetailPatch(seed, draftOf(seed, { stakes: false }), t, cats)).toEqual({ stakes: false });
  });

  it('never writes due or schedule', () => {
    const patch = taskDetailPatch(persisted, draftOf(persisted, {
      title: 'x', stakes: true, catId: null, subtasks: [], notes: '',
    }), t, cats);
    expect(Object.keys(patch).sort()).toEqual(['category', 'notes', 'stakes', 'subtasks', 'title']);
  });
});

describe('C34 · TaskDetailModal never injects demo subtasks', () => {
  function render(task) {
    return renderToStaticMarkup(
      <LifeLocaleContext.Provider value={{ t, locale: 'ru' }}>
        <LifeDataContext.Provider value={{ state: { activityLog: [] } }}>
          <TaskDetailModal task={task} onClose={() => {}} onUpdate={() => {}} onComplete={() => {}} onDelete={() => {}} />
        </LifeDataContext.Provider>
      </LifeLocaleContext.Provider>,
    );
  }

  it('renders an empty subtask list for a task that has none', () => {
    const html = render({ id: 5, title: 'без подзадач', done: false });
    expect(html).not.toContain('набросать первый экран');
    expect(html).not.toContain('свести цвета');
    expect(html).not.toContain('подключить аналитику');
    expect(html).toContain('0/0');
  });

  it('shows the localised title for a seed task', () => {
    const html = render({ id: 1, titleKey: 'seed_task_ship', done: false, stakes: true });
    expect(html).toContain(t('seed_task_ship'));
  });

  it('has no hardcoded subtask fixture left in the source', () => {
    const source = readFileSync(new URL('../components/TaskDetailModal.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/набросать первый экран|свести цвета|подключить аналитику/);
  });
});

describe('App edit wiring', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');

  it('opens the persisted task and saves a patch by id', () => {
    expect(app).toContain('onUpdate={(id, patch) => data.updateTaskFields(id, patch)}');
    expect(app).toContain('tasks.find(x => String(x.id) === String(detailTask.id))');
  });

  it('does not persist a localised due label for new tasks', () => {
    expect(app).not.toContain("due: stakes ? t('due_eod')");
  });
});
