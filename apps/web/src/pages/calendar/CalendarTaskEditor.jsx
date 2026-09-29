import React from 'react';
import { LIcons } from '../../components/icons.jsx';
import { useDialog } from '../../components/useDialog.js';
import { MAX_YEAR, MIN_INPUT_YEAR, isAcceptableTaskDate } from '../../domain/calendarModel.ts';
import { taskDisplayTitle, taskTime } from '../../domain/tasks.ts';

/* Nested Calendar task editor (owner: «отдельным всплывающим попапом внутри
 * попапа с возможностью сохранить»). Edits title, date, time and description
 * of the PERSISTED task; everything else (subtasks, category, stakes, tags,
 * created_at) is left alone. Saving reports only what changed:
 *   onSave(id, patch, schedule | undefined)
 * A changed date moves the same task to its new day (no copy). */

const { useRef, useState } = React;
const TIME = /^\d{2}:\d{2}$/;

/** Pure validation + change detection for the editor form. */
export function editorResult(task, form, t) {
  const errors = {};
  const title = form.title.trim();
  if (!title) errors.title = 'cal_err_title';
  if (form.date && !isAcceptableTaskDate(form.date)) errors.date = 'cal_err_date';
  if (form.time && !TIME.test(form.time)) errors.time = 'cal_err_time';
  if (Object.keys(errors).length > 0) return { errors };

  const initialDate = task.schedule && task.schedule.date ? task.schedule.date : '';
  const initialTime = taskTime(task);
  const patch = {};
  if (title !== taskDisplayTitle(task, t)) patch.title = title;
  if (form.notes !== (task.notes || '')) patch.notes = form.notes;
  const scheduleChanged = form.date !== initialDate || form.time !== initialTime;
  return {
    errors: null,
    patch,
    schedule: scheduleChanged ? { date: form.date, time: form.time } : undefined,
    clearsDate: Boolean(initialDate) && !form.date,
  };
}

export function CalendarTaskEditor({ task, t, onCancel, onSave }) {
  const I = LIcons;
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const [form, setForm] = useState(() => ({
    title: taskDisplayTitle(task, t),
    date: task.schedule && task.schedule.date ? task.schedule.date : '',
    time: taskTime(task),
    notes: task.notes || '',
  }));
  const [errors, setErrors] = useState({});
  const [confirmClear, setConfirmClear] = useState(false);

  useDialog(dialogRef, { onClose: onCancel, initialFocusRef: titleRef });

  const set = key => event => {
    setForm(prev => ({ ...prev, [key]: event.target.value }));
    if (key === 'date') setConfirmClear(false);
  };

  function save(event) {
    if (event) event.preventDefault();
    const result = editorResult(task, form, t);
    if (result.errors) { setErrors(result.errors); return; }
    setErrors({});
    if (result.clearsDate && !confirmClear) { setConfirmClear(true); return; }
    onSave(task.id, result.patch, result.schedule);
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
