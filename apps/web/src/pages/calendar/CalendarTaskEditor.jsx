import React from 'react';
import { EditConflictNotice } from '../../components/EditConflictNotice.jsx';
import { LIcons } from '../../components/icons.jsx';
import { useDialog } from '../../components/useDialog.js';
import { MAX_YEAR, MIN_INPUT_YEAR, persistedSchedule, scheduleEdit } from '../../domain/calendarModel.ts';
import { rebaseUntouched, reconcileDraft, resolveDraftConflicts, sameDraftValue } from '../../domain/editDraft.ts';
import { taskDisplayTitle } from '../../domain/tasks.ts';

/* Nested Calendar task editor (owner: «отдельным всплывающим попапом внутри
 * попапа с возможностью сохранить»). Edits title, date, time and description
 * of the PERSISTED task; everything else (subtasks, category, stakes, tags,
 * created_at) is left alone. Saving reports only what the USER changed
 * (against the values the form started from, not the latest task):
 *   onSave(id, patch, schedule | undefined)
 * A changed date moves the same task to its new day (no copy). */

const { useEffect, useRef, useState } = React;

/** The persisted task as editor values (schedule = one {date, time} unit). */
export function calendarEditorValues(task, t) {
  return { title: taskDisplayTitle(task, t), schedule: persistedSchedule(task), notes: task.notes || '' };
}

const formValues = form => ({ title: form.title, schedule: { date: form.date, time: form.time }, notes: form.notes });
const valuesForm = values => ({ title: values.title, date: values.schedule.date, time: values.schedule.time, notes: values.notes });

/** Pure validation + change detection for the editor form. Date/time rules
    are the shared calendarModel.scheduleEdit (also used by the Tasks detail):
    a time needs a date, and clearing the date clears its time.

    `baseline` is what the form started from (default: the task itself). Only
    fields the user changed from it are written; untouched fields keep the
    latest persisted value. A field changed by the user AND in the persisted
    task meanwhile is returned in `conflicts` and nothing is saved. */
export function editorResult(task, form, t, baseline = calendarEditorValues(task, t)) {
  const latest = calendarEditorValues(task, t);
  const draft = formValues(form);
  const { apply, conflicts } = reconcileDraft(baseline, draft, latest, ['title', 'notes']);
  const errors = {};
  const title = form.title.trim();
  if (!title && !sameDraftValue(draft.title, baseline.title)) errors.title = 'cal_err_title';
  const schedule = scheduleEdit(task, { date: form.date, time: form.time }, baseline.schedule);
  if (schedule.errors) Object.assign(errors, schedule.errors);
  if (Object.keys(errors).length > 0) return { errors };
  if (schedule.conflict) conflicts.push({ field: 'schedule', ...schedule.conflict });
  if (conflicts.length > 0) return { errors: null, conflicts: FIELDS.flatMap(field => conflicts.filter(c => c.field === field)) };

  const patch = {};
  if (apply.includes('title') && title !== latest.title) patch.title = title;
  if (apply.includes('notes')) patch.notes = form.notes;
  return { errors: null, patch, schedule: schedule.schedule, clearsDate: schedule.clearsDate };
}

const FIELDS = ['title', 'schedule', 'notes'];
const FIELD_LABEL = { title: 'cal_field_title', schedule: 'td_schedule', notes: 'cal_field_notes' };

export function CalendarTaskEditor({ task, t, onCancel, onSave }) {
  const I = LIcons;
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  /* `baseline` = the persisted values the form started from; see editorResult. */
  const [edit, setEdit] = useState(() => {
    const values = calendarEditorValues(task, t);
    return { baseline: values, form: valuesForm(values) };
  });
  const { form, baseline } = edit;
  const [errors, setErrors] = useState({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [conflicts, setConflicts] = useState(null);

  useDialog(dialogRef, { onClose: onCancel, initialFocusRef: titleRef });

  /* The persisted task changed under the open editor: fields the user has not
     touched show (and keep) the latest saved value. */
  const latest = calendarEditorValues(task, t);
  const latestKey = JSON.stringify(latest);
  useEffect(() => {
    setEdit(prev => {
      const moved = rebaseUntouched(prev.baseline, formValues(prev.form), JSON.parse(latestKey), FIELDS);
      return moved ? { baseline: moved.baseline, form: valuesForm(moved.draft) } : prev;
    });
  }, [latestKey]);

  const set = key => event => {
    const value = event.target.value;
    /* The time only refines a date: clearing the date clears its time. */
    setEdit(prev => ({
      ...prev,
      form: key === 'date' && !value ? { ...prev.form, date: '', time: '' } : { ...prev.form, [key]: value },
    }));
    if (key === 'date') setConfirmClear(false);
    setConflicts(null);
  };

  function submit(nextForm, nextBaseline) {
    const result = editorResult(task, nextForm, t, nextBaseline);
    if (result.errors) { setErrors(result.errors); return; }
    setErrors({});
    if (result.conflicts) { setConflicts(result.conflicts); return; }
    setConflicts(null);
    if (result.clearsDate && !confirmClear) { setConfirmClear(true); return; }
    onSave(task.id, result.patch, result.schedule);
  }

  function save(event) {
    if (event) event.preventDefault();
    submit(form, baseline);
  }

  /* 'mine' saves the draft over the value now saved (explicit choice);
     'saved' takes the saved value into the form and keeps the editor open. */
  function resolve(choice) {
    const fields = conflicts.map(c => c.field);
    const next = resolveDraftConflicts(baseline, formValues(form), latest, fields, choice);
    const nextForm = valuesForm(next.draft);
    setEdit({ baseline: next.baseline, form: nextForm });
    setConflicts(null);
    if (choice === 'mine') submit(nextForm, next.baseline);
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save(event);
  }

  const field = (key, label, input) => (
    <label className="cal-field">
      <span className="cal-field-lab mono">{label}</span>
      {input}
      {errors[key] ? <span className="cal-field-err" id={`cal-err-${key}`} role="alert">{t(errors[key])}</span> : null}
    </label>
  );

  return (
    <div className="qa-backdrop cal-editor-backdrop" onMouseDown={onCancel}>
      <form
        ref={dialogRef}
        className="qa-modal cal-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-editor-title"
        onMouseDown={event => event.stopPropagation()}
        onSubmit={save}
        onKeyDown={onKeyDown}
        noValidate>
        <div className="cal-dialog-head">
          <h2 className="cal-dialog-h" id="cal-editor-title">{t('cal_edit_title')}</h2>
          <button type="button" className="qa-close" aria-label={t('cal_close')} onClick={onCancel}>{I.x({ size: 14 })}</button>
        </div>
        {field('title', t('cal_field_title'), (
          <input
            ref={titleRef}
            className="cal-input"
            value={form.title}
            onChange={set('title')}
            aria-invalid={errors.title ? 'true' : undefined}
            aria-describedby={errors.title ? 'cal-err-title' : undefined} />
        ))}
        <div className="cal-field-row">
          {field('date', t('cal_field_date'), (
            <input
              type="date"
              className="cal-input mono"
              min={`${MIN_INPUT_YEAR}-01-01`}
              max={`${MAX_YEAR}-12-31`}
              value={form.date}
              onChange={set('date')}
              aria-invalid={errors.date ? 'true' : undefined}
              aria-describedby={errors.date ? 'cal-err-date' : undefined} />
          ))}
          {field('time', t('cal_field_time'), (
            <input
              type="time"
              className="cal-input mono"
              value={form.time}
              onChange={set('time')}
              aria-invalid={errors.time ? 'true' : undefined}
              aria-describedby={errors.time ? 'cal-err-time' : undefined} />
          ))}
        </div>
        {field('notes', t('cal_field_notes'), (
          <textarea className="qa-notes-input" rows={3} value={form.notes} onChange={set('notes')} />
        ))}
        {conflicts ? <EditConflictNotice conflicts={conflicts} labels={FIELD_LABEL} t={t} onResolve={resolve} /> : null}
        {confirmClear ? (
          <div className="cal-confirm" role="alert">
            <span>{t('cal_clear_date_q')}</span>
          </div>
        ) : null}
        <div className="qa-foot">
          <div className="qa-foot-hints mono">
            <span className="qa-kbd">⌘ ↵</span><span>{t('qa_save')}</span>
            <span className="qa-foot-sep">·</span>
            <span className="qa-kbd">ESC</span><span>{t('qa_cancel')}</span>
          </div>
          <div className="qa-foot-actions">
            <button type="button" className="qa-btn-ghost" onClick={onCancel}>{t('qa_cancel')}</button>
            <button type="submit" className="qa-btn-save">{confirmClear ? t('cal_clear_date_ok') : t('qa_save')}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
