import React from 'react';
import { formatDay, todayDateOnly } from '../../domain/calendarModel.ts';
import { historyInstant, historyStatus, historyTasks, taskDate, taskDisplayTitle } from '../../domain/tasks.ts';

/* Calendar History — a DERIVED view over state.tasks (never activityLog and
 * never a second store). Rows: completed, closed without completion and
 * archived tasks (owner-resolved OD-1). Overdue tasks nobody marked stay on
 * their day; deleted tasks no longer exist. Unknown legacy timestamps show
 * «—» — nothing is backfilled. Restore returns the SAME task to active. */

const { useRef, useState } = React;

const instantDate = (instant, intl) =>
  formatDay(todayDateOnly(instant), intl, { day: 'numeric', month: 'short', year: 'numeric' });

export function CalendarHistory({ tasks, intl, t, onRestore }) {
  const rootRef = useRef(null);
  const [status, setStatus] = useState('');
  const rows = historyTasks(tasks);
  const unknown = t('cal_history_unknown');
  const labels = {
    created: t('cal_history_created'),
    task: t('cal_history_task'),
    date: t('cal_history_date'),
    status: t('cal_history_status'),
    closed: t('cal_history_closed'),
  };

  function restore(task) {
    onRestore(task.id);
    setStatus(t('cal_status_restored'));
    setTimeout(() => rootRef.current && rootRef.current.focus(), 0);
  }

  return (
    <div className="cal-history-wrap" ref={rootRef} tabIndex={-1}>
      <p className="cal-status" role="status" aria-live="polite">{status}</p>
      {rows.length === 0 ? (
        <p className="cal-history-empty">{t('cal_history_empty')}</p>
      ) : (
        <table className="cal-history">
          <thead>
            <tr>
              <th scope="col">{labels.created}</th>
              <th scope="col">{labels.task}</th>
              <th scope="col">{labels.date}</th>
              <th scope="col">{labels.status}</th>
              <th scope="col">{labels.closed}</th>
              <th scope="col"><span className="cal-sr-only">{t('cal_history_restore')}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(task => {
              const state = historyStatus(task);
              const title = taskDisplayTitle(task, t);
              const date = taskDate(task);
              const closedAt = historyInstant(task);
              return (
                <tr key={task.id} data-task-id={task.id}>
                  <td className="cal-history-num mono" data-label={labels.created}>
                    {task.created_at ? instantDate(task.created_at, intl) : unknown}
                  </td>
                  <td className="cal-history-title">{title}</td>
                  <td className="cal-history-num mono" data-label={labels.date}>
                    {date ? formatDay(date, intl, { day: 'numeric', month: 'short', year: 'numeric' }) : unknown}
                  </td>
                  <td data-label={labels.status}>
                    <span className={`cal-state is-${state}`}>{t(`cal_state_${state}`)}</span>
                  </td>
                  <td className="cal-history-num mono" data-label={labels.closed}>
                    {closedAt ? instantDate(closedAt, intl) : unknown}
                  </td>
                  <td className="cal-history-action">
                    <button type="button" className="cal-act" aria-label={t('cal_history_restore_aria', title)} onClick={() => restore(task)}>
                      {t('cal_history_restore')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
