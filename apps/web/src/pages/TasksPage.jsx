import React from 'react';
import { PageHeader } from '../components/HeroVignette.jsx';
import { LIcons } from '../components/icons.jsx';
import { formatInstantDate } from '../analytics/projectAnalytics.ts';
import { WAITING_RESOLUTION_KEYS, WaitingItemModal, waitingOutcomeMessage } from '../components/WaitingItemModal.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';
import {
  isTaskActive, isTaskClosed, isTaskOverdue, overdueTasks, sortTasksByDate, taskDate, taskTime, tasksDueToday,
} from '../domain/tasks.ts';
import { formatDay } from '../domain/calendarModel.ts';
import { useKyivToday } from '../app/useKyivToday.js';
import { activeWaitingItems, canRestoreWaiting, closedWaitingItems } from '../domain/waiting.ts';

/* global React */
const {
  useState: useStateTP, useMemo: useMemoTP, useContext: useCtxTP, useEffect: useEffectTP, useRef: useRefTP,
} = React;

/* Tasks tab — master view of every task across routine + stakes.
   Filter chips on the left, sort dropdown on the right. Reuses the same
   task-row markup as the home composite, opens TaskDetailModal on click.

   The "ожидание" chip is the retrieval surface for Clarify's Delegate outcome.
   Waiting items are a distinct persisted collection, NOT tasks and NOT a task
   tag — they render as their own list so the difference stays visible.
   GTD G1: active records open WaitingItemModal; resolved ones sit in a
   collapsed «закрыто» list with their outcome and date (restore where the
   domain allows it). Actions go through LifeDataContext.runWaitingCommand,
   which reports applied | unchanged | invalid — only `applied` is announced. */
function TasksPage({ tasks, waitingItems = [], onToggle, onAdd, onOpen }) {
  const { t } = useCtxTP(LifeLocaleContext);
  const I = LIcons;
  const [filter, setFilter] = useStateTP('all');
  const [sort, setSort]     = useStateTP('date');
  const [sortOpen, setSortOpen] = useStateTP(false);

  const filters = [
    { id: 'all',     label: t('tasks_filter_all') },
    { id: 'today',   label: t('tasks_filter_today') },
    { id: 'overdue', label: t('tasks_filter_overdue') },
    { id: 'routine', label: t('tasks_filter_routine') },
    { id: 'stakes',  label: t('tasks_filter_stakes') },
    { id: 'waiting', label: t('tasks_filter_waiting') },
    { id: 'done',    label: t('tasks_filter_done') },
  ];
  const sorts = [
    { id: 'date',     label: t('tasks_sort_date') },
    { id: 'priority', label: t('tasks_sort_priority') },
    { id: 'category', label: t('tasks_sort_category') },
  ];

  /* GTD G2: «сегодня» / «просрочено» come from schedule.date against the live
     Europe/Kyiv day (useKyivToday re-renders at midnight and on tab return).
     Legacy tag/stakes/due labels never place a task on a day. */
  const today = useKyivToday();
  const filtered = useMemoTP(() => {
    // Calendar closures stay in History until Restore; ordinary task controls
    // must not present them as unchecked tasks merely because done is false.
    let xs = tasks.filter(task => !isTaskClosed(task));
    if (filter === 'today')   xs = tasksDueToday(xs, today);
    if (filter === 'overdue') xs = overdueTasks(xs, today);
    if (filter === 'routine') xs = xs.filter(x => !x.stakes && isTaskActive(x));
    if (filter === 'stakes')  xs = xs.filter(x => x.stakes && isTaskActive(x));
    if (filter === 'done')    xs = xs.filter(x => x.done);
    if (sort === 'date')      xs = sortTasksByDate(xs);
    if (sort === 'priority')  xs.sort((a, b) => (b.stakes ? 1 : 0) - (a.stakes ? 1 : 0));
    if (sort === 'category')  xs.sort((a, b) => String(a.tag || '').localeCompare(String(b.tag || '')));
    return xs;
  }, [tasks, filter, sort, today]);

  const openCount = tasks.filter(isTaskActive).length;
  const waitingView = filter === 'waiting';

  return (
    <div className="page tasks-page">
      <PageHeader
        title={t('tasks_page_title')}
        subtitle={<>{t('tasks_page_meta', openCount, tasks.length)} · {t.pl('pl_task', openCount)}</>}
      />

      <div className="tasks-toolbar">
        <div className="tasks-chips">
          {filters.map(f => (
            <button key={f.id}
                    className={"tasks-chip" + (filter === f.id ? " is-on" : "")}
                    onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="tasks-sort">
          <button className="tasks-sort-trigger mono"
                  aria-haspopup="listbox" aria-expanded={sortOpen}
                  onClick={() => setSortOpen(o => !o)}>
            <span>{t('tasks_sort_label')}: {sorts.find(s => s.id === sort).label}</span>
            <I.chevDown size={12}/>
          </button>
          {sortOpen && (
            <div className="tasks-sort-pop"
                 onMouseLeave={() => setSortOpen(false)}>
              {sorts.map(s => (
                <button key={s.id}
                        className={"tasks-sort-opt" + (sort === s.id ? " is-on" : "")}
                        onClick={() => { setSort(s.id); setSortOpen(false); }}>{s.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {waitingView ? (
        <WaitingSection waitingItems={waitingItems} />
      ) : filtered.length === 0 ? (
        <div className="empty-state">{t('tasks_empty')}</div>
      ) : (
        <section className="card panel tasks-list-card">
          <div className="task-list">
            {filtered.map(task => (
              <div key={task.id} className={"task-row" + (task.stakes ? " is-stakes" : "")}>
                <button className={"task-check" + (task.done ? " is-done" : "")}
                        onClick={() => onToggle(task.id)}>
                  {task.done && I.check({ size: 12 })}
                </button>
                <button className={"task-title task-title-btn" + (task.done ? " is-done" : "")}
                        onClick={() => onOpen && onOpen(task)}>{task.title}</button>
                <div className="task-meta">
                  {(task.tag || task.tagLabel) && (
                    <span className={"task-tag" + (task.stakes ? " is-stakes" : "")}>
                      {task.tagLabel || t('tag_' + task.tag, task.tag)}
                    </span>
                  )}
                  {taskDate(task) ? (
                    <time className={"task-due mono" + (isTaskOverdue(task, today) ? " is-overdue" : "")}
                          dateTime={taskTime(task) ? `${taskDate(task)}T${taskTime(task)}` : taskDate(task)}>
                      {formatDay(taskDate(task), t('_intl_locale'), { day: 'numeric', month: 'short' })}
                      {taskTime(task) ? ` · ${taskTime(task)}` : ''}
                    </time>
                  ) : task.due && <span className="task-due mono">{task.due}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

/* Tasks → «ожидание» (GTD G1). Active records first, with their count; the
   resolved ones in a «закрыто» list that starts collapsed. Rows open the
   detail dialog; «вернуть» appears only where the domain allows a restore. */
function WaitingSection({ waitingItems, defaultClosedOpen = false }) {
  const { t } = useCtxTP(LifeLocaleContext);
  const I = LIcons;
  const data = useCtxTP(LifeDataContext);
  const runWaiting = data && data.runWaitingCommand;
  const intlLocale = t('_intl_locale');
  const [openWaitingId, setOpenWaitingId] = useStateTP(null);
  const [closedOpen, setClosedOpen] = useStateTP(defaultClosedOpen);
  const [waitingStatus, setWaitingStatus] = useStateTP(null);
  const [focusWaitingId, setFocusWaitingId] = useStateTP(null);
  const waitingHeadingRef = useRefTP(null);
  const waitingListRef = useRefTP(null);
  const emptyRef = useRefTP(null);

  const activeWaiting = useMemoTP(() => activeWaitingItems(waitingItems), [waitingItems]);
  const closedWaiting = useMemoTP(() => closedWaitingItems(waitingItems), [waitingItems]);
  const openWaiting = openWaitingId == null
    ? null
    : waitingItems.find(item => String(item.id) === String(openWaitingId));

  /* After the dialog closes or a row moves between lists, put focus back on
     the same record's row if it is still rendered, else on the list heading —
     never leave it on <body>. Runs after the dialog's own focus return. */
  useEffectTP(() => {
    if (focusWaitingId == null) return;
    setFocusWaitingId(null);
    const active = document.activeElement;
    if (active && active !== document.body && document.contains(active)) return;
    const root = waitingListRef.current;
    const row = root && Array.from(root.querySelectorAll('[data-waiting-id]'))
      .find(element => element.getAttribute('data-waiting-id') === String(focusWaitingId));
    const fallback = row || waitingHeadingRef.current || emptyRef.current;
    if (fallback) fallback.focus();
  }, [focusWaitingId]);

  function openWaitingRecord(id) {
    setWaitingStatus(null);
    setOpenWaitingId(id);
  }
  function commandWaiting(command) {
    if (!runWaiting) return null;
    return runWaiting(command);
  }
  function closeWaitingModal(note) {
    const id = openWaitingId;
    setOpenWaitingId(null);
    if (note !== undefined) setWaitingStatus(note);
    setFocusWaitingId(id);
  }
  function restoreFromList(item) {
    const command = { kind: 'restore', id: item.id };
    const outcome = commandWaiting(command);
    setWaitingStatus(waitingOutcomeMessage(outcome, command, t, item.title));
    setFocusWaitingId(item.id);
  }

  const status = (
    <p className={'cal-status wt-list-status' + (waitingStatus ? ' is-' + waitingStatus.tone : '')}
       role={waitingStatus && waitingStatus.tone === 'error' ? 'alert' : 'status'}>
      {waitingStatus ? waitingStatus.text : ''}
    </p>
  );

  return (
    <>
      {waitingItems.length === 0 ? (
        <div className="empty-state" ref={emptyRef} tabIndex={-1}>
          {status}
          {t('waiting_empty')}
        </div>
      ) : (
        <section className="card panel tasks-list-card" aria-labelledby="tasks-waiting-title" ref={waitingListRef}>
          <div className="panel-head">
            <h3 className="panel-title" id="tasks-waiting-title" ref={waitingHeadingRef} tabIndex={-1}>{t('waiting_section_title')}</h3>
            <span className="panel-meta mono">{t('waiting_section_meta')} · {t('waiting_active_meta', activeWaiting.length)}</span>
          </div>
          {status}
          {activeWaiting.length === 0 ? (
            <p className="wt-empty">{t('waiting_active_empty')}</p>
          ) : (
            <ul className="waiting-list">
              {activeWaiting.map(item => (
                <li key={item.id} className="waiting-row">
                  <span className="waiting-icon" aria-hidden="true">{I.user({ size: 14 })}</span>
                  <button type="button" className="waiting-title waiting-open" data-waiting-id={item.id}
                          aria-haspopup="dialog" onClick={() => openWaitingRecord(item.id)}>{item.title}</button>
                  <span className="waiting-meta">
                    {item.waiting_for
                      ? <span className="waiting-for">{t('waiting_for', item.waiting_for)}</span>
                      : null}
                    <span className="waiting-date mono">{formatInstantDate(item.created_at, intlLocale)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {closedWaiting.length > 0 ? (
            <div className="wt-closed-section">
              <button type="button" className="wt-closed-toggle mono" aria-expanded={closedOpen}
                      aria-controls="tasks-waiting-closed" onClick={() => setClosedOpen(open => !open)}>
                <span className={'wt-closed-chev' + (closedOpen ? ' is-open' : '')} aria-hidden="true">{I.chevRight({ size: 12 })}</span>
                <span>{t('waiting_closed_count', closedWaiting.length)}</span>
              </button>
              {closedOpen ? (
                <ul className="waiting-list is-closed" id="tasks-waiting-closed" aria-label={t('waiting_closed_title')}>
                  {closedWaiting.map(item => (
                    <li key={item.id} className="waiting-row is-closed">
                      <span className="waiting-icon" aria-hidden="true">{I.user({ size: 14 })}</span>
                      <button type="button" className="waiting-title waiting-open" data-waiting-id={item.id}
                              aria-haspopup="dialog" onClick={() => openWaitingRecord(item.id)}>{item.title}</button>
                      <span className="waiting-meta">
                        <span className={'wt-res is-' + item.resolution}>{t(WAITING_RESOLUTION_KEYS[item.resolution])}</span>
                        <span className="waiting-date mono">{formatInstantDate(item.resolved_at, intlLocale)}</span>
                        {canRestoreWaiting(item) ? (
                          <button type="button" className="cal-act wt-restore"
                                  aria-label={t('waiting_restore_aria', item.title)}
                                  onClick={() => restoreFromList(item)}>{t('waiting_restore')}</button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      )}

      {openWaitingId != null ? (
        <WaitingItemModal
          key={openWaitingId}
          item={openWaiting}
          t={t}
          intlLocale={intlLocale}
          onCommand={commandWaiting}
          onClose={() => closeWaitingModal(undefined)}
          onDone={note => closeWaitingModal(note)}
        />
      ) : null}
    </>
  );
}

export { TasksPage, WaitingSection };
