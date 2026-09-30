import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { saveTaskDetail } from '../app/taskDetailSave.js';
import { EditConflictNotice } from '../components/EditConflictNotice.jsx';
import { TaskDetailModal, taskDetailPatch, taskDetailResult } from '../components/TaskDetailModal.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { scheduleEdit } from '../domain/calendarModel.ts';
import { rebaseUntouched, reconcileDraft, resolveDraftConflicts } from '../domain/editDraft.ts';
import { calendarEditorValues, editorResult } from '../pages/calendar/CalendarTaskEditor.jsx';

/* Audit follow-up · stale editor drafts must not overwrite untouched fields.
 *
 * Both task editors keep the values they opened with. When the persisted task
 * changes underneath a mounted editor, only the fields the user actually edited
 * may be written; untouched fields keep the latest persisted value. Date and
 * time are one schedule unit. A field edited by the user AND changed in the
 * persisted task is a conflict: nothing is saved silently. */

const t = LifeMakeT('ru');
const cats = [];

/* Opened on A (30 Sep 09:00); persisted meanwhile became B (1 Oct 10:00). */
const A = { id: 9, title: 'A', notes: '', stakes: false, subtasks: [], schedule: { date: '2026-09-30', time: '09:00' } };
const B = { ...A, title: 'B', schedule: { date: '2026-10-01', time: '10:00' } };

const calBaseline = { title: 'A', schedule: { date: '2026-09-30', time: '09:00' }, notes: '' };
const calForm = overrides => ({ title: 'A', date: '2026-09-30', time: '09:00', notes: '', ...overrides });

const tdBaseline = { title: 'A', stakes: false, catId: null, subtasks: [], notes: '', schedule: { date: '2026-09-30', time: '09:00' } };
const tdDraft = overrides => ({ title: 'A', stakes: false, catId: null, subtasks: [], notes: '', ...overrides });

describe('Calendar editor · stale draft', () => {
  it('RED repro · editing only notes keeps the latest title and schedule', () => {
    expect(editorResult(B, calForm({ notes: 'new note' }), t, calBaseline))
      .toEqual({ errors: null, patch: { notes: 'new note' }, schedule: undefined, clearsDate: false });
  });

  it('applies genuine edits and leaves the concurrently changed schedule alone', () => {
    const latest = { ...A, schedule: B.schedule };
    expect(editorResult(latest, calForm({ title: 'C' }), t, calBaseline))
      .toEqual({ errors: null, patch: { title: 'C' }, schedule: undefined, clearsDate: false });
  });

  it('a schedule the user edited while nobody else did is saved', () => {
    const result = editorResult({ ...A, title: 'B' }, calForm({ time: '11:00' }), t, calBaseline);
    expect(result).toEqual({ errors: null, patch: {}, schedule: { date: '2026-09-30', time: '11:00' }, clearsDate: false });
  });

  it('same-field edit on both sides is a conflict, not a silent overwrite', () => {
    const result = editorResult(B, calForm({ title: 'C' }), t, calBaseline);
    expect(result.errors).toBeNull();
    expect(result.conflicts).toEqual([{ field: 'title', mine: 'C', saved: 'B' }]);
    expect(result.patch).toBeUndefined();
  });

  it('date/time is one unit: my time vs their date is a schedule conflict', () => {
    const result = editorResult(B, calForm({ time: '11:00' }), t, calBaseline);
    expect(result.conflicts).toEqual([{
      field: 'schedule',
      mine: { date: '2026-09-30', time: '11:00' },
      saved: { date: '2026-10-01', time: '10:00' },
    }]);
  });

  it('both sides making the same change is not a conflict', () => {
    expect(editorResult(B, calForm({ title: 'B' }), t, calBaseline))
      .toEqual({ errors: null, patch: {}, schedule: undefined, clearsDate: false });
  });

  it('clearing the date still asks for confirmation when the schedule was untouched elsewhere', () => {
    const latest = { ...A, notes: 'theirs' };
    expect(editorResult(latest, calForm({ date: '', time: '' }), t, calBaseline))
      .toEqual({ errors: null, patch: {}, schedule: { date: '', time: '' }, clearsDate: true });
  });

  it('clearing a date that was moved elsewhere is a conflict, never a silent clear', () => {
    const result = editorResult(B, calForm({ date: '', time: '' }), t, calBaseline);
    expect(result.conflicts.map(c => c.field)).toEqual(['schedule']);
  });

  it('validation still runs on edited fields before conflicts', () => {
    expect(editorResult(B, calForm({ title: ' ', time: '25' }), t, calBaseline).errors)
      .toEqual({ title: 'cal_err_title', time: 'cal_err_time' });
  });

  it('without a baseline it behaves exactly as before (baseline = the task)', () => {
    expect(editorResult(A, calForm({ notes: 'x' }), t)).toEqual({ errors: null, patch: { notes: 'x' }, schedule: undefined, clearsDate: false });
  });
});

describe('Tasks detail · stale draft', () => {
  it('RED repro · editing only notes keeps the latest title', () => {
    expect(taskDetailPatch(B, tdDraft({ notes: 'new note' }), t, cats, tdBaseline)).toEqual({ notes: 'new note' });
  });

  it('RED repro · an untouched schedule is not re-sent from the stale draft', () => {
    expect(scheduleEdit(B, { date: '2026-09-30', time: '09:00' }, tdBaseline.schedule))
      .toEqual({ errors: null, schedule: undefined, clearsDate: false });
  });

  it('keeps genuine edits of every field', () => {
    const latest = { ...A, notes: 'theirs' };
    const subtasks = [{ id: 1, title: 's', done: false }];
    expect(taskDetailPatch(latest, tdDraft({ title: 'C', stakes: true, subtasks }), t, cats, tdBaseline))
      .toEqual({ title: 'C', stakes: true, subtasks });
  });

  it('a conflicting field is left out of the patch (the caller reports it)', () => {
    expect(taskDetailPatch(B, tdDraft({ title: 'C', notes: 'n' }), t, cats, tdBaseline)).toEqual({ notes: 'n' });
  });
});

describe('Tasks detail · full save decision', () => {
  const draft = overrides => ({ ...tdDraft(), schedule: { date: '2026-09-30', time: '09:00' }, ...overrides });

  it('notes-only edit over a moved task: patch = notes, no schedule', () => {
    expect(taskDetailResult(B, draft({ notes: 'n' }), t, cats, { baseline: tdBaseline }))
      .toEqual({ errors: null, patch: { notes: 'n' }, schedule: undefined, clearsDate: false });
  });

  it('title and schedule conflicts are reported together, in field order', () => {
    const result = taskDetailResult(B, draft({ title: 'C', schedule: { date: '2026-10-05', time: '' } }), t, cats, { baseline: tdBaseline });
    expect(result.conflicts.map(c => c.field)).toEqual(['title', 'schedule']);
    expect(result.patch).toBeUndefined();
  });

  it('an emptied title is not an edit (the persisted title is kept, no conflict)', () => {
    expect(taskDetailResult(B, draft({ title: '  ' }), t, cats, { baseline: tdBaseline }))
      .toEqual({ errors: null, patch: {}, schedule: undefined, clearsDate: false });
  });

  it('clearing the date asks for confirmation; clearing a moved date conflicts', () => {
    const cleared = draft({ schedule: { date: '', time: '' } });
    expect(taskDetailResult({ ...A, notes: 'theirs' }, cleared, t, cats, { baseline: tdBaseline }))
      .toMatchObject({ clearsDate: true, schedule: { date: '', time: '' }, patch: {} });
    expect(taskDetailResult(B, cleared, t, cats, { baseline: tdBaseline }).conflicts.map(c => c.field)).toEqual(['schedule']);
  });

  it('display-only rows never touch the schedule', () => {
    expect(taskDetailResult(B, draft({ schedule: { date: '', time: '' } }), t, cats, { baseline: tdBaseline, canSchedule: false }))
      .toEqual({ errors: null, patch: {}, schedule: undefined, clearsDate: false });
  });

  it('a time without a date is still rejected before any conflict check', () => {
    expect(taskDetailResult(B, draft({ title: 'C', schedule: { date: '', time: '10:00' } }), t, cats, { baseline: tdBaseline }).errors)
      .toEqual({ time: 'cal_err_time_needs_date' });
  });

  it('lifecycle fields are never in the patch (they are not editor fields)', () => {
    const closed = { ...B, closure: 'archived', closed_at: '2026-10-01T08:00:00.000Z', done: false };
    const { patch } = taskDetailResult(closed, draft({ notes: 'n' }), t, cats, { baseline: tdBaseline });
    expect(patch).toEqual({ notes: 'n' });
  });
});

describe('Deleted task while editing', () => {
  it('saveTaskDetail refuses a task that no longer exists (never recreated)', () => {
    const data = { moveTask: vi.fn(), updateTaskFields: vi.fn() };
    expect(saveTaskDetail({ tasks: [], data }, 9, { notes: 'n' }, undefined)).toEqual({ ok: false, code: 'missing' });
    expect(data.moveTask).not.toHaveBeenCalled();
    expect(data.updateTaskFields).not.toHaveBeenCalled();
  });

  it('the missing Tasks detail keeps its explanation and disables saving', () => {
    const html = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={{ t, locale: 'ru', themeEff: 'dark' }}>
        <TaskDetailModal task={A} missing onClose={() => {}} onUpdate={() => {}} onComplete={() => {}} onDelete={() => {}} />
      </LifeLocaleContext.Provider>,
    );
    expect(html).toContain(t('td_err_missing'));
    expect(html).not.toContain('edit-conflict');
  });
});

describe('editDraft primitives', () => {
  const fields = ['title', 'schedule', 'notes'];
  const base = calendarEditorValues(A, t);

  it('reconcile: untouched / applied / converged / conflict', () => {
    const latest = { ...base, title: 'B', notes: 'x' };
    const draft = { ...base, title: 'C', notes: 'x', schedule: { date: '2026-09-30', time: '11:00' } };
    expect(reconcileDraft(base, draft, latest, fields)).toEqual({
      apply: ['schedule'],
      conflicts: [{ field: 'title', mine: 'C', saved: 'B' }],
    });
  });

  it('rebase moves only untouched fields to the latest value', () => {
    const latest = calendarEditorValues(B, t);
    const draft = { ...base, notes: 'mine' };
    const moved = rebaseUntouched(base, draft, latest, fields);
    expect(moved.draft).toEqual({ title: 'B', schedule: { date: '2026-10-01', time: '10:00' }, notes: 'mine' });
    expect(moved.baseline.notes).toBe('');
    expect(rebaseUntouched(latest, latest, latest, fields)).toBeNull();
  });

  it("resolve 'mine' then saves the draft; a further change conflicts again", () => {
    const latest = calendarEditorValues(B, t);
    const form = { title: 'C', date: '2026-09-30', time: '09:00', notes: '' };
    const draft = { title: 'C', schedule: base.schedule, notes: '' };
    const mine = resolveDraftConflicts(base, draft, latest, ['title'], 'mine');
    expect(editorResult(B, form, t, mine.baseline)).toEqual({ errors: null, patch: { title: 'C' }, schedule: undefined, clearsDate: false });
    expect(editorResult({ ...B, title: 'D' }, form, t, mine.baseline).conflicts).toEqual([{ field: 'title', mine: 'C', saved: 'D' }]);
  });

  it("resolve 'saved' takes the persisted value and keeps other edits", () => {
    const latest = calendarEditorValues(B, t);
    const draft = { title: 'C', schedule: base.schedule, notes: 'mine' };
    const saved = resolveDraftConflicts(base, draft, latest, ['title'], 'saved');
    expect(saved.draft).toEqual({ title: 'B', schedule: base.schedule, notes: 'mine' });
  });
});

describe('conflict notice', () => {
  it.each(['ru', 'uk'])('%s · localized, lists the saved values and both choices', locale => {
    const lt = LifeMakeT(locale);
    const html = renderToStaticMarkup(
      <EditConflictNotice
        conflicts={[{ field: 'title', mine: 'C', saved: 'B' }, { field: 'schedule', mine: {}, saved: { date: '2026-10-01', time: '10:00' } }]}
        labels={{ title: 'cal_field_title', schedule: 'td_schedule' }}
        t={lt}
        onResolve={() => {}} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(lt('edit_conflict_q'));
    expect(html).toContain(lt('edit_conflict_field', lt('cal_field_title'), 'B'));
    expect(html).toContain('2026-10-01 10:00');
    expect(html).toContain(lt('edit_conflict_mine'));
    expect(html).toContain(lt('edit_conflict_saved'));
    expect(lt('edit_conflict_q')).not.toBe('edit_conflict_q');
  });
});
