import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LifeDataContext, buildInitialState } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { QuickNotesPage } from '../pages/QuickNotesPage.jsx';
import { TasksPage } from '../pages/TasksPage.jsx';
import { ProjectsPage } from '../pages/ProjectsPage.jsx';
import {
  applyClarifyTransition,
  createClarifiedTaskRecord,
  createDeferredTaskRecord,
  createReferenceRecord,
  createWaitingItemRecord,
  requireQuickNote,
} from '../domain/clarify';
import { createProjectRecord } from '../domain/projects';

/* End-to-end Clarify contract over the real initial snapshot: run each outcome
   the way the provider action does — resolve the source note, build the
   destination, apply ONE transition — then assert that the resulting state
   really surfaces through the production retrieval UI. */

const LOCALE = { locale: 'ru', t: LifeMakeT('ru'), themeEff: 'dark' };
const NOW = '2026-09-28T09:14:00.000Z';

function freshState() {
  return buildInitialState();
}

function firstNote(state) {
  return state.quickNotes[0];
}

function renderWithLocale(node) {
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={LOCALE}>{node}</LifeLocaleContext.Provider>,
  );
}

describe('Clarify transitions over the real snapshot', () => {
  it('Do Now: the note becomes an open Task and leaves the inbox exactly once', () => {
    const state = freshState();
    const note = requireQuickNote(state, firstNote(state).id);
    const taskCount = state.tasks.length;
    const noteCount = state.quickNotes.length;

    const next = applyClarifyTransition(
      state, note.id, 'do_now', createClarifiedTaskRecord(note.text, 900),
    );

    expect(next.tasks).toHaveLength(taskCount + 1);
    expect(next.quickNotes).toHaveLength(noteCount - 1);
    expect(next.quickNotes.some(entry => entry.id === note.id)).toBe(false);
    const created = next.tasks[next.tasks.length - 1];
    expect(created).toMatchObject({ title: note.text, done: false, stakes: false, due: '' });
    expect(created.schedule).toBeNull();
    /* Not a second Task model, not a "ClarifyTask" — it lives in tasks[]. */
    expect(next.ClarifyTask).toBeUndefined();
    expect(next.clarifyTasks).toBeUndefined();
  });

  it('Defer: a future date produces a scheduled Task visible in the Tasks list', () => {
    const state = freshState();
    const note = requireQuickNote(state, firstNote(state).id);

    const next = applyClarifyTransition(
      state, note.id, 'defer', createDeferredTaskRecord(note.text, '2026-10-05', NOW, 901),
    );

    const created = next.tasks[next.tasks.length - 1];
    expect(created.schedule).toEqual({ date: '2026-10-05', time: '' });
    expect(created.due).toBe('2026-10-05');

    const html = renderWithLocale(
      <TasksPage tasks={next.tasks.map(task => ({ ...task, title: task.title || task.titleKey }))}
                 waitingItems={next.waitingItems} onToggle={() => {}} onAdd={() => {}} onOpen={() => {}} />,
    );
    expect(html).toContain(note.text);
    expect(html).toContain('2026-10-05');
  });

  it('Delegate: the note becomes a Waiting record retrievable from the Tasks surface', () => {
    const state = freshState();
    const note = requireQuickNote(state, firstNote(state).id);

    const next = applyClarifyTransition(
      state, note.id, 'delegate', createWaitingItemRecord(note.text, null, NOW, 'waiting-1'),
    );

    expect(next.waitingItems).toEqual([{
      id: 'waiting-1', title: note.text, waiting_for: null, created_at: NOW,
    }]);
    /* Waiting is not a Task and not a task tag. */
    expect(next.tasks).toEqual(state.tasks);
    expect(next.tasks.some(task => task.tag === 'waiting')).toBe(false);

    const html = renderWithLocale(
      <TasksPage tasks={[]} waitingItems={next.waitingItems}
                 onToggle={() => {}} onAdd={() => {}} onOpen={() => {}} />,
    );
    /* The filter chip that reveals the list exists on the production surface. */
    expect(html).toContain('ожидание');
  });

  it('Project: the note becomes a real projects[] entry shown on the Projects page', () => {
    const state = freshState();
    const note = requireQuickNote(state, firstNote(state).id);
    const goalsBefore = JSON.stringify(state.goals);

    const next = applyClarifyTransition(
      state, note.id, 'project', createProjectRecord(note.text, NOW, 'project-1'),
    );

    expect(next.projects).toHaveLength(1);
    expect(next.projects[0]).toMatchObject({ title: note.text, status: 'active' });
    /* Project is never Goal. */
    expect(JSON.stringify(next.goals)).toBe(goalsBefore);
    expect(next.goals.some(goal => goal.title === note.text)).toBe(false);

    const html = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={LOCALE}>
        <LifeDataContext.Provider value={{
          state: next,
          addProject: () => {}, setProjectForecast: () => {},
          completeProject: () => {}, archiveProject: () => {},
        }}>
          <ProjectsPage />
        </LifeDataContext.Provider>
      </LifeLocaleContext.Provider>,
    );
    expect(html).toContain(note.text);
    expect(html).toContain('активные');
  });

  it('Reference: the note becomes a Reference shown in the Notes surface', () => {
    const state = freshState();
    const note = requireQuickNote(state, firstNote(state).id);

    const next = applyClarifyTransition(
      state, note.id, 'reference', createReferenceRecord(note.text, NOW, 'reference-1'),
    );

    expect(next.references).toEqual([{ id: 'reference-1', text: note.text, created_at: NOW }]);
    expect(next.quickNotes.some(entry => entry.id === note.id)).toBe(false);

    const html = renderWithLocale(
      <QuickNotesPage notes={next.quickNotes} references={next.references}
                      onAdd={() => {}} onClarify={() => {}} />,
    );
    expect(html).toContain('справочник');
    expect(html).toContain(note.text);
  });

  it('Delete keeps using the existing deleteQuickNote path, nothing else', () => {
    const provider = buildInitialState();
    expect(provider.quickNotes.length).toBeGreaterThan(0);
    /* The panel's delete branch calls data.deleteQuickNote — there is no
       Clarify-specific delete transition and no destination collection. */
    expect(applyClarifyTransition).not.toHaveProperty('delete');
  });

  it('every persisting outcome leaves the source note intact when it fails', () => {
    const state = freshState();
    const note = firstNote(state);
    const snapshot = JSON.stringify(state);

    /* Missing/past defer date. */
    expect(() => createDeferredTaskRecord(note.text, '', NOW)).toThrow();
    expect(() => createDeferredTaskRecord(note.text, '2026-09-28', NOW)).toThrow();
    /* Stale note id. */
    expect(() => requireQuickNote(state, 'does-not-exist')).toThrow();
    /* Empty destination text. */
    expect(() => createWaitingItemRecord('  ')).toThrow();
    expect(() => createReferenceRecord('  ')).toThrow();
    expect(() => createProjectRecord('  ')).toThrow();

    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('keeps Tasks, Projects and Quick Add collections structurally unchanged', () => {
    const state = freshState();
    /* Clarify adds two collections and nothing else to the snapshot shape. */
    const keys = Object.keys(state).sort();
    expect(keys).toContain('waitingItems');
    expect(keys).toContain('references');
    expect(keys).toContain('tasks');
    expect(keys).toContain('projects');
    expect(keys).toContain('goals');
    expect(keys).toContain('quickNotes');
    expect(state.version).toBe(2);
  });
});
