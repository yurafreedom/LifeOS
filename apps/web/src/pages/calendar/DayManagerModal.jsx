import React from 'react';
import { LIcons } from '../../components/icons.jsx';
import { useDialog } from '../../components/useDialog.js';
import { formatDay } from '../../domain/calendarModel.ts';
import { isTaskOverdue, taskDisplayTitle, taskTime, tasksForDay } from '../../domain/tasks.ts';
import { CalendarTaskEditor } from './CalendarTaskEditor.jsx';

/* Day Manager — the day-specific task surface a day cube opens.
 *
 * Rows are the ACTIVE tasks whose schedule.date is this day (done or closed
 * tasks live in History). Per row: complete (green check), important/routine,
 * move up/down (keyboard-operable, announced), edit (nested editor), archive,
 * delete (permanent, confirmed) and — only when overdue — close without
 * completion. An overdue row nobody marked simply stays here. */

const { useRef, useState } = React;

export function DayManagerModal({ date, tasks, today, intl, t, actions, onClose, onAdd, onOpenDay }) {
  const I = LIcons;
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [status, setStatus] = useState(null);

  useDialog(dialogRef, { onClose });

  const rows = tasksForDay(tasks, date);
  const editing = editingId == null ? null : tasks.find(task => String(task.id) === String(editingId)) || null;
  const heading = formatDay(date, intl, { weekday: 'long', day: 'numeric', month: 'long' });
  const year = date.slice(0, 4);
  const longDate = target => formatDay(target, intl, { day: 'numeric', month: 'long', year: 'numeric' });

  /* A row that leaves the list takes focus with it — park focus on the
     heading so keyboard users stay inside the dialog. */
  function afterRowLeaves(message) {
    setStatus({ text: message });
    setConfirmId(null);
    setTimeout(() => headingRef.current && headingRef.current.focus(), 0);
  }

  function saveEdit(id, patch, schedule) {
    setEditingId(null);
    if (schedule === undefined) {
      if (Object.keys(patch).length > 0) actions.update(id, patch);
      setStatus({ text: t('cal_status_saved') });
      return;
    }
    actions.move(id, schedule, patch);
    if (!schedule.date) afterRowLeaves(t('cal_status_undated'));
    else if (schedule.date !== date) {
      setStatus({ text: t('cal_status_moved', longDate(schedule.date)), date: schedule.date });
      setTimeout(() => headingRef.current && headingRef.current.focus(), 0);
    } else setStatus({ text: t('cal_status_saved') });
  }

  return (
    <>
      <div className="qa-backdrop" onMouseDown={onClose}>
        <div
          ref={dialogRef}
          className="qa-modal cal-day-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cal-day-title"
          onMouseDown={event => event.stopPropagation()}>
          <header className="cal-dialog-head">
            <div>
              <div className="cal-dialog-eyebrow mono">{t('cal_day_eyebrow')} · {year}</div>
              <h2 className="cal-dialog-h" id="cal-day-title" ref={headingRef} tabIndex={-1}>{heading}</h2>
            </div>
            <button type="button" className="qa-close" aria-label={t('cal_close')} onClick={onClose}>{I.x({ size: 14 })}</button>
          </header>

          <div className="cal-day-body">
            {rows.length === 0 ? (
              <p className="cal-day-empty">{t('cal_day_empty')}</p>
            ) : (
              <ul className="cal-day-list" aria-label={t('cal_day_list')}>
                {rows.map((task, index) => {
                  const title = taskDisplayTitle(task, t);
                  const overdue = isTaskOverdue(task, today);
                  const time = taskTime(task);
                  return (
                    <li key={task.id} className={'cal-task' + (task.stakes ? ' is-stakes' : '')} data-task-id={task.id}>
                      <button
                        type="button"
                        className="task-check"
                        aria-label={t('cal_complete_aria', title)}
                        onClick={() => { actions.complete(task.id); afterRowLeaves(t('cal_status_completed')); }} />
                      <div className="cal-task-main">
                        <button type="button" className="cal-task-title" onClick={() => setEditingId(task.id)}>{title}</button>
                        {(time || overdue) ? (
                          <div className="cal-task-meta mono">
                            {time ? <span>{time}</span> : null}
                            {overdue ? <span className="cal-overdue">{t('cal_overdue')}</span> : null}
                          </div>
                        ) : null}
                      </div>
                      {confirmId === task.id ? (
                        <div className="cal-task-actions cal-confirm" role="group" aria-label={t('cal_actions_aria', title)}>
                          <span>{t('td_delete_confirm')}</span>
                          <button type="button" className="cal-act" onClick={() => setConfirmId(null)}>{t('qa_cancel')}</button>
                          <button
                            type="button"
                            className="cal-act is-danger-solid"
                            onClick={() => { actions.remove(task.id); afterRowLeaves(t('cal_status_deleted')); }}>
                            {t('td_delete_yes')}
                          </button>
                        </div>
                      ) : (
                        <div className="cal-task-actions" role="group" aria-label={t('cal_actions_aria', title)}>
                          <div className="qa-toggle" role="radiogroup">
                            <button
                              type="button"
                              role="radio"
                              aria-checked={!task.stakes}
                              className={'qa-toggle-btn' + (!task.stakes ? ' is-on' : '')}
                              onClick={() => task.stakes && actions.update(task.id, { stakes: false })}>
                              {t('qa_routine')}
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={!!task.stakes}
                              className={'qa-toggle-btn is-stakes' + (task.stakes ? ' is-on' : '')}
                              onClick={() => !task.stakes && actions.update(task.id, { stakes: true })}>
                              {t('qa_stakes')}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="cal-act is-icon"
                            aria-label={t('cal_move_up_aria', title)}
                            title={t('cal_move_up')}
                            disabled={index === 0}
                            onClick={() => { actions.reorder(date, task.id, -1); setStatus({ text: t('cal_status_moved_up') }); }}>
                            <span aria-hidden="true" className="cal-chev-up">{I.chevDown({ size: 13 })}</span>
                          </button>
                          <button
                            type="button"
                            className="cal-act is-icon"
                            aria-label={t('cal_move_down_aria', title)}
                            title={t('cal_move_down')}
                            disabled={index === rows.length - 1}
                            onClick={() => { actions.reorder(date, task.id, 1); setStatus({ text: t('cal_status_moved_down') }); }}>
                            <span aria-hidden="true">{I.chevDown({ size: 13 })}</span>
                          </button>
                          <button type="button" className="cal-act" onClick={() => setEditingId(task.id)}>
                            {I.edit2({ size: 12 })}{t('cal_edit')}
                          </button>
                          {overdue ? (
                            <button
                              type="button"
                              className="cal-act"
                              onClick={() => { actions.closeUnresolved(task.id); afterRowLeaves(t('cal_status_closed')); }}>
                              {t('cal_close_unresolved')}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="cal-act"
                            onClick={() => { actions.archive(task.id); afterRowLeaves(t('cal_status_archived')); }}>
                            {t('cal_archive')}
                          </button>
                          <button type="button" className="cal-act is-danger" onClick={() => setConfirmId(task.id)}>
                            {I.trash({ size: 12 })}{t('cal_delete')}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="cal-dialog-foot">
            <div className="cal-status" role="status" aria-live="polite">
              {status ? <span>{status.text}</span> : null}
              {status && status.date ? (
                <button type="button" className="cal-status-link" onClick={() => onOpenDay(status.date)}>{t('cal_open_day')}</button>
              ) : null}
            </div>
            <button type="button" className="cal-add" onClick={() => onAdd(date)}>+ {t('cal_add_task')}</button>
          </footer>
        </div>
      </div>
      {editing ? (
        <CalendarTaskEditor task={editing} t={t} onCancel={() => setEditingId(null)} onSave={saveEdit} />
      ) : null}
    </>
  );
}
