import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { archiveTask, closeTaskUnresolved, historyTasks, restoreTask } from '../domain/tasks.ts';
import { TasksPage } from '../pages/TasksPage.jsx';

const active = { id: 1, title: 'ACTIVE_ROW', done: false, stakes: false };
const completed = { id: 2, title: 'COMPLETED_ROW', done: true };
const at = '2026-09-30T08:00:00.000Z';

function render(tasks, locale) {
  const t = LifeMakeT(locale);
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ t, locale }}>
      <TasksPage tasks={tasks} />
    </LifeLocaleContext.Provider>,
  );
}

describe('Calendar closure across Tasks and History', () => {
  it.each(['ru', 'uk'])('keeps closed rows in History and out of ordinary task controls (%s)', locale => {
    const tasks = closeTaskUnresolved(archiveTask([
      active, completed,
      { id: 3, title: 'ARCHIVED_ROW', done: false },
      { id: 4, title: 'UNRESOLVED_ROW', done: false },
    ], 3, at), 4, at);
    const html = render(tasks, locale);
    expect(html).toContain('ACTIVE_ROW');
    expect(html).toContain('COMPLETED_ROW');
    expect(html).not.toContain('ARCHIVED_ROW');
    expect(html).not.toContain('UNRESOLVED_ROW');
    expect(html).toContain(LifeMakeT(locale)('tasks_page_meta', 1, 4));
    expect(historyTasks(tasks).map(task => task.id)).toEqual([4, 3, 2]);
  });

  it('restores the same archived task to Tasks without duplication', () => {
    const archived = archiveTask([active], 1, at);
    expect(render(archived, 'ru')).not.toContain('ACTIVE_ROW');
    const restored = restoreTask(archived, 1);
    expect(render(restored, 'ru')).toContain('ACTIVE_ROW');
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(1);
    expect(historyTasks(restored)).toEqual([]);
  });
});
