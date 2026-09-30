import React from 'react';
import { createPortal } from 'react-dom';
import { LIcons } from '../../components/icons.jsx';
import { formatDay } from '../../domain/calendarModel.ts';
import { isTaskOverdue, taskDisplayTitle, taskTime, tasksForDay } from '../../domain/tasks.ts';
import { CalendarTaskEditor } from './CalendarTaskEditor.jsx';
import { monthYearLabel } from './calendarNav.js';

/* Day details — the fourth level of the nested Calendar (approved JENKIN
 * design), shown inside the stable stage instead of the former Day Manager
 * dialog. It keeps every Day Manager behaviour:
 *
 * Rows are the ACTIVE tasks whose schedule.date is this day (done or closed
 * tasks live in History). Per row: complete, important/routine, move up/down
 * (keyboard-operable, announced, focus stays on the moved row), edit (the
 * nested CalendarTaskEditor dialog: dirty-field saves, live rebase, explicit
 * conflict choice), archive, delete (permanent, confirmed) and — only when
 * overdue — close without completion. An overdue row nobody marked stays.
 * «добавить задачу» opens Quick Add with this date. No event list or event
 * controls: Events have no production store yet.
 *
 * Escape inside the row confirmation cancels it first; the page handles the
 * next Escape (one level up). The editor is a stacked dialog with its own
 * Escape/focus handling (useDialog), portalled to <body> because the stage's
 * 3D perspective would otherwise contain a position:fixed overlay. */

const { useLayoutEffect, useRef, useState } = React;

function inBody(node) {
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}

export function DayDetails({ date, tasks, today, intl, t, actions, onAdd, onOpenDay, spin }) {
  const I = LIcons;
  const rootRef = useRef(null);
  const headingRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [status, setStatus] = useState(null);
  /* A focus target inside this day to move to right after the next commit —
     synchronously, so focus never rests on <body> in between. */
  const focusAfterCommit = useRef(null);
  useLayoutEffect(() => {
    const selector = focusAfterCommit.current;
    if (!selector) return;
    focusAfterCommit.current = null;
    const target = rootRef.current && rootRef.current.querySelector(selector);
    if (target) target.focus();
  });

  const rows = tasksForDay(tasks, date);
  const editing = editingId == null ? null : tasks.find(task => String(task.id) === String(editingId)) || null;
  const weekday = formatDay(date, intl, { weekday: 'long' });
  const monthYear = monthYearLabel(Number(date.slice(0, 4)), Number(date.slice(5, 7)), intl);
  const dayNumber = Number(date.slice(8, 10));
  const isToday = date === today;
  const overdueCount = rows.filter(task => isTaskOverdue(task, today)).length;
  const longDate = target => formatDay(target, intl, { day: 'numeric', month: 'long', year: 'numeric' });
  const summary = rows.length ? `${rows.length} ${t.pl('pl_task', rows.length)}` : t('cal_day_empty');

  /* A row that leaves the list takes focus with it — park focus on the day
     heading so keyboard users stay in the day. */
  function afterRowLeaves(message) {
    setStatus({ text: message });
    setConfirmId(null);
    setTimeout(() => headingRef.current && headingRef.current.focus({ preventScroll: true }), 0);
  }

  /* Keep keyboard focus on the moved row: its button in the same direction,
     or — once it reached the top/bottom and that button is disabled — the
     opposite one (a disabled button would drop focus to the page). */
  function reorder(id, direction) {
    actions.reorder(date, id, direction);
    setStatus({ text: t(direction < 0 ? 'cal_status_moved_up' : 'cal_status_moved_down') });
    setTimeout(() => {
      const row = rootRef.current && rootRef.current.querySelector(`[data-task-id="${id}"]`);
      if (!row) return;
      const same = row.querySelector(`[data-move="${direction < 0 ? 'up' : 'down'}"]`);
      const other = row.querySelector(`[data-move="${direction < 0 ? 'down' : 'up'}"]`);
      const target = same && !same.disabled ? same : other;
      if (target) target.focus();
    }, 0);
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
      setTimeout(() => headingRef.current && headingRef.current.focus({ preventScroll: true }), 0);
    } else setStatus({ text: t('cal_status_saved') });
  }

  function openEditor(id) {
    setConfirmId(null);
    setEditingId(id);
  }

  /* The confirmation replaces the row's actions, so the focused Delete
     button disappears: focus moves to the safe «отмена» instead of <body>,
     and returns to Delete when the confirmation is dismissed. */
  function askDelete(id) {
    focusAfterCommit.current = `[data-task-id="${id}"] [data-confirm-cancel]`;
    setConfirmId(id);
  }

  function cancelDelete(id) {
    focusAfterCommit.current = `[data-task-id="${id}"] [data-delete]`;
    setConfirmId(null);
  }

  /* Escape closes the local delete confirmation before anything else. */
  function onKeyDown(event) {
    if (event.key !== 'Escape' || confirmId == null) return;
    if (event.target.closest && event.target.closest('[role="dialog"]')) return;
    event.preventDefault();
    event.stopPropagation();
    cancelDelete(confirmId);
  }

  return (
    <div className="cal-grid cal-day" ref={rootRef} data-nav="day" data-spin={spin || undefined} onKeyDown={onKeyDown}>
      <section className={'cal-tile cal-day-summary' + (isToday ? ' is-gloss' : '')} data-today={isToday ? '1' : undefined}
               aria-labelledby="cal-day-title">
        <span className="cal-eyebrow">{weekday}</span>
        <h3 className="cal-day-title" id="cal-day-title" ref={headingRef} tabIndex={-1} data-autofocus="1">
          <span className="cal-num cal-num-big">{dayNumber}</span>
          <span className="cal-day-month">{monthYear}</span>
        </h3>
        <p className="cal-sub cal-day-sum">
          {summary}
          {overdueCount ? <span className="cal-overdue">{t('cal_overdue')}</span> : null}
        </p>
        <div className="cal-status" role="status" aria-live="polite">
          {status ? <span>{status.text}</span> : null}
          {status && status.date ? (
            <button type="button" className="cal-status-link" onClick={() => onOpenDay(status.date)}>{t('cal_open_day')}</button>
          ) : null}
        </div>
        <button type="button" className="cal-add" onClick={() => onAdd(date)}>{I.plus({ size: 12 })}{t('cal_add_task')}</button>
      </section>

      <section className="cal-tile cal-day-tasks" aria-label={t('cal_day_list')}>
        <span className="cal-eyebrow">{t('cal_day_list')} · {rows.length}</span>
        {rows.length === 0 ? (
          <p className="cal-day-empty">{t('cal_day_empty')}</p>
        ) : (
          <ul className="cal-day-list">
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
                    <button type="button" className="cal-task-title" onClick={() => openEditor(task.id)}>{title}</button>
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
                      <button type="button" className="cal-act" data-confirm-cancel="1" onClick={() => cancelDelete(task.id)}>{t('qa_cancel')}</button>
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
                        data-move="up"
                        disabled={index === 0}
                        onClick={() => reorder(task.id, -1)}>
                        <span aria-hidden="true" className="cal-chev-up">{I.chevDown({ size: 13 })}</span>
                      </button>
                      <button
                        type="button"
                        className="cal-act is-icon"
                        aria-label={t('cal_move_down_aria', title)}
                        title={t('cal_move_down')}
                        data-move="down"
                        disabled={index === rows.length - 1}
                        onClick={() => reorder(task.id, 1)}>
                        <span aria-hidden="true">{I.chevDown({ size: 13 })}</span>
                      </button>
                      <button type="button" className="cal-act" onClick={() => openEditor(task.id)}>
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
                      <button type="button" className="cal-act is-danger" data-delete="1" onClick={() => askDelete(task.id)}>
                        {I.trash({ size: 12 })}{t('cal_delete')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {editing ? inBody(
        <CalendarTaskEditor task={editing} t={t} onCancel={() => setEditingId(null)} onSave={saveEdit} />,
      ) : null}
    </div>
  );
}
