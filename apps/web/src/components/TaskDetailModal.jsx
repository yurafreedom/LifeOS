import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';
import { LifeCatTintClass, LifeExpenseCats } from '../data/categories.js';
import { MAX_YEAR, MIN_INPUT_YEAR, persistedSchedule, scheduleEdit } from '../domain/calendarModel.ts';
import { rebaseUntouched, reconcileDraft, resolveDraftConflicts } from '../domain/editDraft.ts';
import { taskDisplayTitle } from '../domain/tasks.ts';
import { ActivityTimeline } from './ActivityTimeline.jsx';
import { EditConflictNotice } from './EditConflictNotice.jsx';
import { LIcons } from './icons.jsx';
import { useDialog } from './useDialog.js';

/* global React */
const { useState: useStateTD, useEffect: useEffectTD, useContext: useCtxTD, useRef: useRefTD } = React;

/* The persisted task as detail-editor values (schedule = one {date, time}). */
function taskDetailValues(task, t) {
  return {
    title: taskDisplayTitle(task, t),
    stakes: !!task.stakes,
    catId: task.category ? task.category.id : null,
    /* A task without subtasks has none — never a demo list. */
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    notes: task.notes || '',
    schedule: persistedSchedule(task),
  };
}

const PATCH_FIELDS = ['title', 'stakes', 'catId', 'subtasks', 'notes'];
const DETAIL_FIELDS = ['title', 'stakes', 'catId', 'subtasks', 'notes', 'schedule'];

/* An emptied title is never saved (it keeps the persisted one), so it does
   not count as an edit either. */
const draftValues = (draft, baseline) => ({ ...draft, title: draft.title.trim() ? draft.title : baseline.title });

/* Only the fields the user actually changed — against `baseline`, the values
   the modal started from, NOT the latest task (which may have changed under
   the open modal). The patch is merged onto the persisted task by id, so
   untouched fields (schedule, due, created_at, …) keep their latest value and
   a seed task keeps its titleKey (so it stays localised) unless its title was
   edited. A field that also changed in the persisted task is left out here;
   taskDetailResult reports it as a conflict. */
function taskDetailPatch(task, draft, t, cats, baseline = taskDetailValues(task, t)) {
  const latest = taskDetailValues(task, t);
  const { apply } = reconcileDraft(baseline, draftValues(draft, baseline), latest, PATCH_FIELDS);
  const patch = {};
  const nextTitle = draft.title.trim();
  if (apply.includes('title') && nextTitle !== latest.title) patch.title = nextTitle;
  if (apply.includes('stakes')) patch.stakes = draft.stakes;
  if (apply.includes('catId')) patch.category = cats.find(c => c.id === draft.catId) || null;
  if (apply.includes('subtasks')) patch.subtasks = draft.subtasks;
  if (apply.includes('notes')) patch.notes = draft.notes;
  return patch;
}

/* The whole save decision: validation errors, then conflicts (nothing saved),
   then { patch, schedule, clearsDate } exactly as before. */
function taskDetailResult(task, draft, t, cats, { baseline = taskDetailValues(task, t), canSchedule = true } = {}) {
  const latest = taskDetailValues(task, t);
  const { conflicts } = reconcileDraft(baseline, draftValues(draft, baseline), latest, PATCH_FIELDS);
  const edit = canSchedule
    ? scheduleEdit(task, draft.schedule, baseline.schedule)
    : { errors: null, schedule: undefined, clearsDate: false };
  if (edit.errors) return { errors: edit.errors };
  if (edit.conflict) conflicts.push({ field: 'schedule', ...edit.conflict });
  if (conflicts.length > 0) return { errors: null, conflicts: DETAIL_FIELDS.flatMap(f => conflicts.filter(c => c.field === f)) };
  return { errors: null, patch: taskDetailPatch(task, draft, t, cats, baseline), schedule: edit.schedule, clearsDate: edit.clearsDate };
}

const CONFLICT_LABEL = {
  title: 'cal_field_title', stakes: 'edit_field_stakes', catId: 'qa_category',
  subtasks: 'td_subtasks', notes: 'qa_notes_expanded', schedule: 'td_schedule',
};

/* GTD G2 · the Tasks detail can set, change or clear the Calendar date/time,
   with exactly the Calendar editor's rules (calendarModel.scheduleEdit): a time
   needs a date, clearing the date clears its time and asks for confirmation,
   and a changed date moves the SAME task (the caller routes it through
   moveTask, like the Calendar). `onUpdate(id, patch, schedule)` returns
   { ok: false, code } when the task no longer exists — the dialog then stays
   open with that explanation instead of claiming a save. `canSchedule` is off
   for display-only rows (Home seed rows) that are not persisted tasks;
   `missing` marks a persisted task that has since been removed. */
function TaskDetailModal({ task, onClose, onUpdate, onComplete, onDelete, canSchedule = true, missing = false }) {
  const { t, locale } = useCtxTD(LifeLocaleContext);
  const I = LIcons;
  const cats = LifeExpenseCats;

  /* `baseline` = the persisted values the fields started from (see
     taskDetailResult); `initial` seeds both it and the field states. */
  const [initial]             = useStateTD(() => (task ? taskDetailValues(task, t) : null));
  const [baseline, setBase]   = useStateTD(initial);
  const [title, setTitle]     = useStateTD(initial ? initial.title : '');
  const [stakes, setStakes]   = useStateTD(initial ? initial.stakes : false);
  const [catId, setCatId]     = useStateTD(initial ? initial.catId : null);
  const [catOpen, setCatOpen] = useStateTD(false);
  const [subtasks, setSubs]   = useStateTD(initial ? initial.subtasks : []);
  const [newSub, setNewSub]   = useStateTD('');
  const [notes, setNotes]     = useStateTD(initial ? initial.notes : '');
  const [confirmDel, setCD]   = useStateTD(false);
  const [menuOpen, setMO]     = useStateTD(false);
  const [date, setDate]       = useStateTD(initial ? initial.schedule.date : '');
  const [time, setTime]       = useStateTD(initial ? initial.schedule.time : '');
  const [errors, setErrors]   = useStateTD({});
  const [confirmClear, setConfirmClear] = useStateTD(false);
  const [failure, setFailure] = useStateTD(null);
  const [conflicts, setConflicts] = useStateTD(null);

  const draft = { title, stakes, catId, subtasks, notes, schedule: { date, time } };
  function applyDraft(values) {
    setTitle(values.title); setStakes(values.stakes); setCatId(values.catId);
    setSubs(values.subtasks); setNotes(values.notes);
    setDate(values.schedule.date); setTime(values.schedule.time);
  }

  /* The persisted task changed under the open modal: fields the user has not
     touched show (and keep) the latest saved value. A missing task keeps the
     draft as it is. */
  const latestKey = task && !missing ? JSON.stringify(taskDetailValues(task, t)) : null;
  useEffectTD(() => {
    if (latestKey == null || !baseline) return;
    const moved = rebaseUntouched(baseline, draft, JSON.parse(latestKey), DETAIL_FIELDS);
    if (!moved) return;
    setBase(moved.baseline);
    applyDraft(moved.draft);
  }, [latestKey]);

  const catBoxRef = useRefTD(null);
  const dialogRef = useRefTD(null);

  /* Shared dialog behaviour: focus in on open, Tab wraps, Escape closes the
     top-most dialog only, focus returns to the opener. */
  useDialog(dialogRef, { onClose });

  useEffectTD(() => {
    if (!task) return;
    function handler(e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  useEffectTD(() => {
    if (!catOpen) return;
    function handler(e) {
      if (catBoxRef.current && !catBoxRef.current.contains(e.target)) setCatOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catOpen]);

  if (!task) return null;

  function commit(values = draft, base = baseline) {
    if (missing) return;
    const edit = taskDetailResult(task, values, t, cats, { baseline: base, canSchedule });
    if (edit.errors) { setErrors(edit.errors); return; }
    setErrors({});
    if (edit.conflicts) { setConflicts(edit.conflicts); return; }
    setConflicts(null);
    if (edit.clearsDate && !confirmClear) { setConfirmClear(true); return; }
    const { patch } = edit;
    if (Object.keys(patch).length === 0 && edit.schedule === undefined) { onClose(); return; }
    const result = onUpdate(task.id, patch, edit.schedule);
    if (result && result.ok === false) { setFailure(t('td_err_missing')); return; }
    onClose();
  }
  /* 'mine' saves the draft over the value now saved (explicit choice);
     'saved' takes the saved values into the fields and keeps the modal open. */
  function resolveConflicts(choice) {
    const next = resolveDraftConflicts(baseline, draft, taskDetailValues(task, t), conflicts.map(c => c.field), choice);
    setBase(next.baseline);
    applyDraft(next.draft);
    setConflicts(null);
    if (choice === 'mine') commit(next.draft, next.baseline);
  }
  const conflictText = (field, value) => {
    if (field === 'stakes') return t(value ? 'qa_stakes' : 'qa_routine');
    if (field === 'catId') { const cat = cats.find(c => c.id === value); return cat ? cat.name[locale] : t('qa_no_category'); }
    if (field === 'subtasks') return `${value.filter(x => x.done).length}/${value.length}`;
    return undefined;
  };
  function changeDate(value) {
    /* The time only refines a date: clearing the date clears its time. */
    setDate(value);
    if (!value) setTime('');
    setConfirmClear(false);
    setErrors({});
  }
  function toggleSub(id) {
    setSubs(s => s.map(x => x.id === id ? { ...x, done: !x.done } : x));
  }
  function addSub(e) {
    e.preventDefault();
    if (!newSub.trim()) return;
    setSubs(s => [...s, { id: Date.now(), title: newSub.trim(), done: false }]);
    setNewSub('');
  }
  function removeSub(id) {
    setSubs(s => s.filter(x => x.id !== id));
  }

  const subDone  = subtasks.filter(s => s.done).length;
  const subTotal = subtasks.length;
  const selectedCat = cats.find(c => c.id === catId);

  /* Activity is now sourced from the global activityLog via the
     shared <ActivityTimeline /> component — see
     components/ActivityTimeline.jsx. Sprint 3A Batch 1.
     The old inline mock has been removed. */

  return (
    <div className="qa-backdrop" onMouseDown={onClose}>
      <div className="qa-modal td-modal" ref={dialogRef} onMouseDown={e => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-label={t('td_eyebrow')}>

        <div className="qa-head">
          <span className="qa-eyebrow mono">{t('td_eyebrow')} {task.stakes && <span className="td-eyebrow-stakes">· {t('qa_stakes')}</span>}</span>
          <div className="td-head-actions">
            <button className="td-menu-btn" disabled={missing} aria-label={t('td_menu')} onClick={() => setMO(o => !o)}>{I.moreHorizontal({ size: 14 })}</button>
            {menuOpen && (
              <div className="td-menu">
                {!confirmDel ? (
                  <button className="td-menu-item is-danger" onClick={() => setCD(true)}>{t('td_delete')}</button>
                ) : (
                  <div className="td-menu-confirm">
                    <div className="mono td-menu-confirm-q">{t('td_delete_confirm')}</div>
                    <div className="td-menu-confirm-row">
                      <button className="td-menu-item" onClick={() => { setCD(false); setMO(false); }}>{t('qa_cancel')}</button>
                      <button className="td-menu-item is-danger-solid" onClick={() => { onDelete(task.id); onClose(); }}>{t('td_delete_yes')}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button className="qa-close" onClick={onClose}><I.x size={14}/></button>
          </div>
        </div>

        <input className="qa-title td-title" value={title} onChange={e => setTitle(e.target.value)} />

        <div className="qa-row">
          <div className="qa-toggle">
            <button className={"qa-toggle-btn" + (!stakes ? " is-on" : "")} onClick={() => setStakes(false)}>{t('qa_routine')}</button>
            <button className={"qa-toggle-btn is-stakes" + (stakes ? " is-on" : "")} onClick={() => setStakes(true)}>{t('qa_stakes')}</button>
          </div>
          <div className="qa-cat" ref={catBoxRef}>
            <button className="qa-cat-trigger" onClick={() => setCatOpen(o => !o)}>
              {selectedCat ? (
                <React.Fragment>
                  <span className={"qa-cat-dot " + LifeCatTintClass[selectedCat.tint]}>
                    {I[selectedCat.icon] && I[selectedCat.icon]({ size: 13 })}
                  </span>
                  <span className="qa-cat-name">{selectedCat.name[locale]}</span>
                </React.Fragment>
              ) : (
                <span className="qa-cat-placeholder">{t('qa_category')}</span>
              )}
              <span className="qa-cat-chev">{I.chevDown({ size: 12 })}</span>
            </button>
            {catOpen && (
              <div className="qa-cat-pop">
                <div className="qa-cat-list">
                  <button className="qa-cat-opt" onClick={() => { setCatId(null); setCatOpen(false); }}>
                    <span className="qa-cat-dot cat-tint-neutral">{I.x({ size: 11 })}</span>
                    <span className="qa-cat-opt-name">{t('qa_no_category')}</span>
                  </button>
                  {cats.map(c => (
                    <button key={c.id} className="qa-cat-opt" onClick={() => { setCatId(c.id); setCatOpen(false); }}>
                      <span className={"qa-cat-dot " + LifeCatTintClass[c.tint]}>
                        {I[c.icon] && I[c.icon]({ size: 13 })}
                      </span>
                      <span className="qa-cat-opt-name">{c.name[locale]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DATE · GTD G2 — the Calendar date (schedule.date), not the legacy label */}
        {canSchedule && !missing ? (
          <div className="td-section td-schedule">
            <div className="td-section-head">
              <span className="mono td-section-lab" id="td-schedule-lab">{t('td_schedule')}</span>
              {date ? (
                <button type="button" className="td-schedule-clear" onClick={() => changeDate('')}>{t('td_clear_date')}</button>
              ) : null}
            </div>
            <div className="cal-field-row" role="group" aria-labelledby="td-schedule-lab">
              <label className="cal-field">
                <span className="cal-field-lab mono">{t('cal_field_date')}</span>
                <input type="date" className="cal-input mono"
                       min={`${MIN_INPUT_YEAR}-01-01`} max={`${MAX_YEAR}-12-31`}
                       value={date} onChange={e => changeDate(e.target.value)}
                       aria-invalid={errors.date ? 'true' : undefined}
                       aria-describedby={errors.date ? 'td-err-date' : undefined} />
                {errors.date ? <span className="cal-field-err" id="td-err-date" role="alert">{t(errors.date)}</span> : null}
              </label>
              <label className="cal-field">
                <span className="cal-field-lab mono">{t('cal_field_time')}</span>
                <input type="time" className="cal-input mono"
                       value={time} onChange={e => { setTime(e.target.value); setErrors({}); }}
                       aria-invalid={errors.time ? 'true' : undefined}
                       aria-describedby={errors.time ? 'td-err-time' : undefined} />
                {errors.time ? <span className="cal-field-err" id="td-err-time" role="alert">{t(errors.time)}</span> : null}
              </label>
            </div>
            {confirmClear ? <div className="cal-confirm" role="alert"><span>{t('cal_clear_date_q')}</span></div> : null}
          </div>
        ) : null}

        {conflicts && !missing ? (
          <EditConflictNotice conflicts={conflicts} labels={CONFLICT_LABEL} t={t} format={conflictText} onResolve={resolveConflicts} />
        ) : null}

        {missing || failure ? (
          <p className="cal-field-err td-missing" role="alert">{failure || t('td_err_missing')}</p>
        ) : null}

        {/* SUBTASKS */}
        <div className="td-section">
          <div className="td-section-head">
            <span className="mono td-section-lab">{t('td_subtasks')}</span>
            <span className="mono td-section-count">{subDone}/{subTotal}</span>
          </div>
          <div className="td-subtask-list">
            {subtasks.map(s => (
              <div key={s.id} className={"td-subtask" + (s.done ? " is-done" : "")}>
                <button className={"task-check" + (s.done ? " is-done" : "")} onClick={() => toggleSub(s.id)}>
                  {s.done && I.check({ size: 11 })}
                </button>
                <span className="td-subtask-title">{s.title}</span>
                <button className="td-subtask-remove" onClick={() => removeSub(s.id)} title={t('qa_cancel')}>{I.x({ size: 11 })}</button>
              </div>
            ))}
            <form className="td-subtask-add" onSubmit={addSub}>
              <span className="td-subtask-prefix">+</span>
              <input className="td-subtask-input" placeholder={t('td_subtask_add')} value={newSub} onChange={e => setNewSub(e.target.value)} />
            </form>
          </div>
        </div>

        {/* NOTES */}
        <div className="td-section">
          <div className="td-section-head">
            <span className="mono td-section-lab">{t('qa_notes_expanded')}</span>
          </div>
          <textarea className="qa-notes-input" rows={2} placeholder={t('qa_notes_placeholder')} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* ACTIVITY · global activityLog filtered by entity */}
        <div className="td-section">
          <div className="td-section-head">
            <span className="mono td-section-lab">{t('td_activity')}</span>
          </div>
          <ActivityTimeline entityType="task" entityId={task.id} />
        </div>

        <div className="qa-foot">
          <div className="qa-foot-hints mono">
            <span className="qa-kbd">⌘ ↵</span><span>{t('td_save')}</span>
            <span className="qa-foot-sep">·</span>
            <span className="qa-kbd">ESC</span><span>{t('qa_cancel')}</span>
          </div>
          <div className="qa-foot-actions">
            <button className="qa-btn-ghost" disabled={missing} onClick={() => { commit(); }}>
              {confirmClear ? t('cal_clear_date_ok') : t('td_save')}
            </button>
            <button className={"qa-btn-save" + (stakes ? " is-stakes" : "")} disabled={missing} onClick={() => { onComplete(task.id); onClose(); }}>
              {task.done ? t('td_uncomplete') : t('td_complete')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export { TaskDetailModal, taskDetailPatch, taskDetailResult, taskDetailValues, taskDisplayTitle };
