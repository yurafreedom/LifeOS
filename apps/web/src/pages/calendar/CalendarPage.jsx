import React from 'react';
import { PageHeader } from '../../components/HeroVignette.jsx';
import { LIcons } from '../../components/icons.jsx';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeStrings } from '../../context/LocaleContext.jsx';
import { useKyivToday } from '../../app/useKyivToday.js';
import { calendarBoundsForDay, yearOf, yearWindow } from '../../domain/calendarModel.ts';
import { activeTaskCounts } from '../../domain/tasks.ts';
import { calendarHash, parseCalendarHash } from './calendarRoute.js';
import {
  breadcrumbs, columnsFromTops, dayTileStep, gridArrowTarget, levelOf, monthTileStep, periodLabel, periodStep,
  readLayout, reconcileCursor, todayStep, upStep, weekArrowTarget, writeLayout, yearTileStep,
} from './calendarNav.js';
import { DaysGridA, DaysWeeksB, MonthTiles, YearTiles } from './TileGrids.jsx';
import { CalendarHistory } from './CalendarHistory.jsx';
import { DayDetails } from './DayDetails.jsx';

/* Calendar — route shell (one route id, `calendar`; the hash carries the
 * level and date, see calendarRoute.js) for the nested tile Calendar of the
 * approved JENKIN design: Years → Months → Days (layout A or B) → Day details,
 * with History as a separate control. Only real tasks with a `schedule.date`
 * exist here: no seeded demo events, no event controls, no filler content. */

const { useContext, useEffect, useMemo, useRef, useState } = React;

const SUBTITLE = { days: 'cal_sub_days', months: 'cal_sub_months', years: 'cal_sub_years', day: 'cal_sub_day', history: 'cal_sub_history' };
const STEP_KEYS = {
  years: ['cal_prev_window', 'cal_next_window'],
  months: ['cal_prev_year', 'cal_next_year'],
  days: ['cal_prev_month', 'cal_next_month'],
  day: ['cal_prev_day', 'cal_next_day'],
  history: ['cal_prev_month', 'cal_next_month'],
};
const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const LAYOUTS = [['A', 'cal_layout_a'], ['B', 'cal_layout_b']];

function readHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

function storage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/* The second click of a double click lands on whatever the first one
   revealed — a tile of the next level, a Day details action, the next
   History row's Restore. Inside the stage only single activations act
   (keyboard activation reports detail 0; the portalled editor is outside
   the stage element and keeps its own clicks). */
export function ignoreRepeatClick(event) {
  if (event.detail > 1 && event.currentTarget.contains(event.target)) event.stopPropagation();
}

/* After a navigation, a toolbar control that is still usable keeps focus, so
   previous / next / Today / A·B / History can be pressed again; otherwise
   (a tile, a breadcrumb that became the current level, a period arrow that
   reached its bound, or nothing) focus moves into the stage. An open dialog
   (Quick Add, the task editor) keeps focus. */
export function stageFocusTarget(root, doc) {
  if (!root || !doc || doc.querySelector('[role="dialog"]')) return null;
  const active = doc.activeElement;
  if (active && active.isConnected && !active.disabled && active.closest && active.closest('.cal-toolbar')) return null;
  return root.querySelector('[data-autofocus="1"]:not([disabled])')
    || root.querySelector('[data-tile]:not([disabled]):not([data-adjacent="1"])')
    || root.querySelector('[data-tile]:not([disabled])');
}

/** Pure view: everything below the route shell, for rendering and tests. */
export function CalendarView({
  view, bounds, intl, t, onNavigate, tasks = [], onRestore = () => {},
  cursor: cursorProp = null, layout = 'B', spin = null, counts: countsProp = null,
  onLayout = () => {}, dayActions = null, onAddForDay = () => {}, stageRef = null,
}) {
  const I = LIcons;
  const level = levelOf(view);
  const cursor = reconcileCursor(cursorProp || bounds.today, view);
  const counts = countsProp || activeTaskCounts(tasks);
  const go = step => step && onNavigate(step.target, step.cursor);
  const crumbs = breadcrumbs(view, cursor, bounds, intl, t);
  const prev = periodStep(view, cursor, bounds, -1);
  const next = periodStep(view, cursor, bounds, 1);
  const [prevKey, nextKey] = STEP_KEYS[level];

  /* Escape goes one level up (stacked dialogs keep their own Escape); the
     arrows follow the rendered tile geometry. */
  function onKeyDown(event) {
    const target = event.target;
    if (event.defaultPrevented || !target || !target.closest) return;
    if (target.closest('[role="dialog"]')) return;
    if (event.key === 'Escape') {
      if (typeof document !== 'undefined' && document.querySelector('[role="dialog"]')) return;
      const up = upStep(view, cursor, bounds);
      if (!up) return;
      event.preventDefault();
      go(up);
      return;
    }
    if (!ARROWS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!target.matches || !target.matches('[data-tile]')) return;
    const container = target.closest('[data-nav]');
    if (!container) return;
    const tiles = Array.from(container.querySelectorAll('[data-tile]'));
    const index = tiles.indexOf(target);
    if (index < 0) return;
    event.preventDefault();
    const nextIndex = container.getAttribute('data-nav') === 'weeks'
      ? weekArrowTarget(index, event.key, tiles.length)
      : gridArrowTarget(index, event.key, columnsFromTops(tiles.map(tile => tile.offsetTop)), tiles.length);
    const tile = nextIndex == null ? null : tiles[nextIndex];
    if (tile && !tile.disabled) tile.focus();
  }

  let stage = null;
  if (level === 'years') {
    stage = (
      <YearTiles
        years={yearWindow(view.year, bounds).years}
        label={periodLabel(view, bounds, intl, t)}
        cursorYear={yearOf(cursor)}
        currentYear={bounds.currentYear}
        counts={counts}
        spin={spin}
        t={t}
        onOpen={year => go(yearTileStep(year, cursor))} />
    );
  } else if (level === 'months') {
    stage = (
      <MonthTiles year={view.year} cursor={cursor} today={bounds.today} counts={counts} spin={spin} intl={intl} t={t}
        onOpen={(year, month) => go(monthTileStep(year, month, cursor))} />
    );
  } else if (level === 'days') {
    const Days = layout === 'A' ? DaysGridA : DaysWeeksB;
    stage = (
      <Days year={view.year} month={view.month} cursor={cursor} today={bounds.today} bounds={bounds} counts={counts}
        spin={spin} intl={intl} t={t} onOpen={date => go(dayTileStep(date))} />
    );
  } else if (level === 'day') {
    stage = (
      <DayDetails
        key={view.day}
        date={view.day}
        tasks={tasks}
        today={bounds.today}
        intl={intl}
        t={t}
        spin={spin}
        actions={dayActions}
        onAdd={onAddForDay}
        onOpenDay={date => go(dayTileStep(date))} />
    );
  } else {
    stage = (
      <div className="cal-grid cal-history-stage" data-nav="history">
        <CalendarHistory tasks={tasks} intl={intl} t={t} onRestore={onRestore} />
      </div>
    );
  }

  return (
    <section className="cal-panel" aria-labelledby="cal-heading" onKeyDown={onKeyDown}>
      <h3 className="cal-sr-only" id="cal-heading" aria-live="polite">{periodLabel(view, bounds, intl, t)}</h3>
      <div className="cal-toolbar">
        <nav className="cal-crumbs" aria-label={t('cal_breadcrumbs')}>
          <ol className="cal-crumb-list">
            {crumbs.map(crumb => (
              <li key={crumb.level} className="cal-crumb-item">
                {crumb.step ? (
                  <button type="button" className="cal-crumb" data-level={crumb.level} onClick={() => go(crumb.step)}>{crumb.label}</button>
                ) : (
                  <span className="cal-crumb" data-level={crumb.level} aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <div className="cal-tools">
          <div className="cal-seg" role="group" aria-label={t('cal_layout')}>
            {LAYOUTS.map(([id, key]) => (
              <button
                key={id}
                type="button"
                className="cal-seg-btn"
                aria-pressed={layout === id}
                aria-label={`${id} · ${t(key)}`}
                title={t(key)}
                onClick={() => onLayout(id)}>
                <span>{id}</span><span className="cal-seg-long" aria-hidden="true"> · {t(key)}</span>
              </button>
            ))}
          </div>
          <div className="cal-seg" role="group" aria-label={t('cal_period')}>
            <button type="button" className="cal-seg-btn is-icon" aria-label={t(prevKey)} title={t(prevKey)} disabled={!prev} onClick={() => go(prev)}>
              {I.chevLeft({ size: 14 })}
            </button>
            <button type="button" className="cal-seg-btn mono" onClick={() => go(todayStep(bounds))}>{t('cal_today')}</button>
            <button type="button" className="cal-seg-btn is-icon" aria-label={t(nextKey)} title={t(nextKey)} disabled={!next} onClick={() => go(next)}>
              {I.chevRight({ size: 14 })}
            </button>
          </div>
          <button
            type="button"
            className="cal-tool-btn cal-history-btn"
            aria-pressed={level === 'history'}
            onClick={() => (level === 'history' ? go(upStep(view, cursor, bounds)) : onNavigate({ view: 'history' }, cursor))}>
            {I.clock({ size: 13 })}{t('cal_history_title')}
          </button>
        </div>
      </div>
      <div className="cal-stage" ref={stageRef} data-level={level} data-layout={level === 'days' ? layout : undefined}
        onClickCapture={ignoreRepeatClick}>
        {stage}
      </div>
    </section>
  );
}

function CalendarPage({ onAddForDay = () => {} }) {
  const { t, locale } = useContext(LifeLocaleContext);
  const data = useContext(LifeDataContext);
  const tasks = (data.state && data.state.tasks) || [];
  const intl = LifeStrings[locale]._intl_locale;
  /* Today is the live Europe/Kyiv day, not the day the task list last
     changed: highlight, the Today button, the current-year window and the
     day details' overdue controls all move at midnight and on tab return.
     Explicit routes, the selected date, the layout and an open editor are
     untouched (none of them depends on today); the undated #/calendar keeps
     meaning "the current Kyiv month". */
  const today = useKyivToday();
  const [openedYear] = useState(() => yearOf(today));
  const bounds = useMemo(() => calendarBoundsForDay(tasks, today, openedYear), [tasks, today, openedYear]);
  const counts = useMemo(() => activeTaskCounts(tasks), [tasks]);
  const [hash, setHash] = useState(readHash);
  const hashRef = useRef(hash);
  hashRef.current = hash;
  const view = parseCalendarHash(hash, bounds);
  /* The selected date is UI state; reconcileCursor keeps it inside the
     visible period (clamped to the month length). */
  const [cursorState, setCursor] = useState(() => today);
  const cursor = reconcileCursor(cursorState, view);
  const [layout, setLayoutState] = useState(() => readLayout(storage()));
  /* data-spin alternates a/b to restart the approved rotateY transition on
     every navigation; state never waits for it. */
  const [spin, setSpin] = useState(null);
  const pendingFocus = useRef(false);
  const stageRef = useRef(null);

  const flip = () => setSpin(current => (current === 'a' ? 'b' : 'a'));

  useEffect(() => {
    function onHash() {
      const next = readHash();
      /* Browser Back/Forward (or any outside hash change) is a navigation
         too: same transition and focus as an in-page one. */
      if (next !== hashRef.current && next.replace(/^#\/?/, '').startsWith('calendar')) {
        pendingFocus.current = true;
        flip();
      }
      setHash(next);
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /* Invalid or out-of-range deep links are replaced (no extra history entry). */
  useEffect(() => {
    if (view.valid) return;
    window.history.replaceState(null, '', '#/calendar');
    setHash('#/calendar');
  }, [view.valid]);

  /* After a navigation: focus the selected tile, else the first real tile of
     the view, without scrolling the page — unless a usable toolbar control or
     an open dialog holds focus (stageFocusTarget). Not on the first mount:
     arriving on the Calendar never steals focus. */
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const target = stageFocusTarget(stageRef.current, document);
    if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
  });

  /* Escape also works when focus rests on the page itself (after a click
     on empty space): the same one-level-up step as inside the Calendar. */
  const escapeUp = useRef(null);
  escapeUp.current = () => {
    const up = upStep(view, cursor, bounds);
    if (up) navigate(up.target, up.cursor);
  };
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target !== document.body && event.target !== document.documentElement) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      escapeUp.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function navigate(target, nextCursor) {
    const next = calendarHash(target);
    pendingFocus.current = true;
    if (nextCursor) setCursor(nextCursor);
    flip();
    setHash(next);
    if (window.location.hash !== next) window.location.hash = next;
  }

  /* The layout switch only re-lays the same days: focus stays where it is. */
  function chooseLayout(next) {
    if (next === layout) return;
    setLayoutState(next);
    writeLayout(storage(), next);
    if (levelOf(view) === 'days') flip();
  }

  const dayActions = {
    complete: id => data.completeTask(id),
    closeUnresolved: id => data.closeTaskUnresolved(id),
    archive: id => data.archiveTask(id),
    remove: id => data.deleteTask(id),
    update: (id, patch) => data.updateTaskFields(id, patch),
    move: (id, schedule, patch) => data.moveTask(id, schedule, patch),
    reorder: (date, id, direction) => data.reorderTaskInDay(date, id, direction),
  };

  return (
    <div className="page calendar-page">
      <PageHeader title={t('cal_title')} subtitle={t(SUBTITLE[levelOf(view)])} />
      <CalendarView
        view={view}
        cursor={cursor}
        bounds={bounds}
        layout={layout}
        spin={spin}
        counts={counts}
        intl={intl}
        t={t}
        tasks={tasks}
        stageRef={stageRef}
        onNavigate={navigate}
        onLayout={chooseLayout}
        onRestore={id => data.restoreTask(id)}
        dayActions={dayActions}
        onAddForDay={onAddForDay} />
    </div>
  );
}

export default CalendarPage;
export { CalendarPage };
