import React from 'react';
import { PageHeader } from '../../components/HeroVignette.jsx';
import { LIcons } from '../../components/icons.jsx';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeStrings } from '../../context/LocaleContext.jsx';
import { calendarBounds, formatMonth, monthKey, shiftMonth, yearInBounds, yearWindow } from '../../domain/calendarModel.ts';
import { calendarHash, parseCalendarHash } from './calendarRoute.js';
import { DayCubes, MonthCubes, YearCubes } from './CubeGrids.jsx';
import { DayManagerModal } from './DayManagerModal.jsx';

/* Calendar — route shell (one route id, `calendar`; the hash carries the
 * level and date, see calendarRoute.js).
 *
 * Owner design (recovered source of truth): a clean month of day cubes →
 * drill into one day to manage its real tasks → zoom out to the months of a
 * year and to years up to 2100. Only real tasks with a `schedule.date` exist
 * here: no seeded demo events and no repeated routine rows from other pages. */

const { useContext, useEffect, useMemo, useRef, useState } = React;

const LEVELS = [
  { id: 'month', key: 'cal_level_days' },
  { id: 'year', key: 'cal_level_months' },
  { id: 'years', key: 'cal_level_years' },
  { id: 'history', key: 'cal_level_history' },
];

const SUBTITLE = { month: 'cal_sub_days', year: 'cal_sub_months', years: 'cal_sub_years', history: 'cal_sub_history' };

function readHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/* The year a level switch keeps as context. */
function contextYear(view, bounds) {
  return view.view === 'history' ? bounds.currentYear : view.year;
}

/** Pure view: everything below the route shell, for rendering and tests. */
export function CalendarView({ view, bounds, intl, t, onNavigate }) {
  const I = LIcons;
  const todayYear = bounds.currentYear;
  const [todayY, todayM] = bounds.today.split('-').map(Number);

  function levelTarget(level) {
    const year = contextYear(view, bounds);
    if (level === 'month') {
      if (view.view === 'month') return { view: 'month', year: view.year, month: view.month, day: null };
      return year === todayY ? { view: 'month', year, month: todayM, day: null } : { view: 'month', year, month: 1, day: null };
    }
    if (level === 'history') return { view: 'history' };
    return { view: level, year };
  }

  let heading = '';
  let prev = null;
  let next = null;
  let prevKey = '';
  let nextKey = '';
  let grid = null;

  if (view.view === 'month') {
    heading = `${formatMonth(view.year, view.month, intl, { month: 'long' })} ${view.year}`;
    const before = shiftMonth(view.year, view.month, -1);
    const after = shiftMonth(view.year, view.month, 1);
    prev = yearInBounds(before.year, bounds) ? { view: 'month', ...before, day: null } : null;
    next = yearInBounds(after.year, bounds) ? { view: 'month', ...after, day: null } : null;
    prevKey = 'cal_prev_month';
    nextKey = 'cal_next_month';
    grid = (
      <DayCubes
        year={view.year}
        month={view.month}
        today={bounds.today}
        selected={view.day}
        intl={intl}
        t={t}
        onOpen={date => onNavigate({ view: 'month', year: view.year, month: view.month, day: date }, { day: true })} />
    );
  } else if (view.view === 'year') {
    heading = String(view.year);
    prev = yearInBounds(view.year - 1, bounds) ? { view: 'year', year: view.year - 1 } : null;
    next = yearInBounds(view.year + 1, bounds) ? { view: 'year', year: view.year + 1 } : null;
    prevKey = 'cal_prev_year';
    nextKey = 'cal_next_year';
    grid = (
      <MonthCubes
        year={view.year}
        today={bounds.today}
        intl={intl}
        onOpen={(year, month) => onNavigate({ view: 'month', year, month, day: null })} />
    );
  } else if (view.view === 'years') {
    const range = yearWindow(view.year, bounds);
    heading = t('cal_years_range', range.start, range.end);
    prev = range.prev != null ? { view: 'years', year: range.prev } : null;
    next = range.next != null ? { view: 'years', year: range.next } : null;
    prevKey = 'cal_prev_window';
    nextKey = 'cal_next_window';
    grid = <YearCubes years={range.years} currentYear={todayYear} onOpen={year => onNavigate({ view: 'year', year })} />;
  }

  const activeLevel = view.view;
  return (
    <section className="panel cal-panel" aria-labelledby="cal-heading">
      <div className="cal-toolbar">
        <div className="cal-views mono" role="tablist" aria-label={t('cal_levels')}>
          {LEVELS.map(level => (
            <button
              key={level.id}
              type="button"
              role="tab"
              aria-selected={activeLevel === level.id}
              className={'cal-view-btn' + (activeLevel === level.id ? ' is-on' : '')}
              onClick={() => onNavigate(levelTarget(level.id))}>
              {t(level.key)}
            </button>
          ))}
        </div>
        {activeLevel !== 'history' ? (
          <div className="cal-nav">
            <button type="button" className="cal-btn" aria-label={t(prevKey)} disabled={!prev} onClick={() => prev && onNavigate(prev)}>
              {I.chevLeft({ size: 14 })}
            </button>
            <h3 className="cal-h" id="cal-heading" aria-live="polite">{heading}</h3>
            <button type="button" className="cal-btn" aria-label={t(nextKey)} disabled={!next} onClick={() => next && onNavigate(next)}>
              {I.chevRight({ size: 14 })}
            </button>
            <button
              type="button"
              className="cal-btn mono"
              onClick={() => onNavigate({ view: 'month', year: todayY, month: todayM, day: null })}>
              {t('cal_today')}
            </button>
          </div>
        ) : (
          <h3 className="cal-h" id="cal-heading">{t('cal_history_title')}</h3>
        )}
      </div>
      {grid}
    </section>
  );
}

function CalendarPage({ onAddForDay = () => {} }) {
  const { t, locale } = useContext(LifeLocaleContext);
  const data = useContext(LifeDataContext);
  const tasks = (data.state && data.state.tasks) || [];
  const intl = LifeStrings[locale]._intl_locale;
  const bounds = useMemo(() => calendarBounds(tasks), [tasks]);
  const [hash, setHash] = useState(readHash);
  /* Month a day was opened from by a history push — closing the Day Manager
     then goes Back to it, exactly like the browser Back button. */
  const pushedFrom = useRef(null);

  useEffect(() => {
    function onHash() { setHash(readHash()); }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const view = parseCalendarHash(hash, bounds);

  /* Invalid or out-of-range deep links are replaced (no extra history entry). */
  useEffect(() => {
    if (view.valid) return;
    window.history.replaceState(null, '', '#/calendar');
    setHash('#/calendar');
  }, [view.valid]);

  function navigate(target, { day = false } = {}) {
    pushedFrom.current = day ? monthKey(target.year, target.month) : null;
    const next = calendarHash(target);
    if (window.location.hash !== next) window.location.hash = next;
  }

  function replaceWith(target) {
    const next = calendarHash(target);
    window.history.replaceState(null, '', next);
    setHash(next);
  }

  function closeDay() {
    if (pushedFrom.current === monthKey(view.year, view.month)) {
      pushedFrom.current = null;
      window.history.back();
      return;
    }
    replaceWith({ view: 'month', year: view.year, month: view.month, day: null });
  }

  function openDay(date) {
    const [year, month] = date.split('-').map(Number);
    replaceWith({ view: 'month', year, month, day: date });
  }

  const actions = {
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
      <PageHeader title={t('cal_title')} subtitle={t(SUBTITLE[view.view])} />
      <CalendarView view={view} bounds={bounds} intl={intl} t={t} onNavigate={navigate} />
      {view.view === 'month' && view.day ? (
        <DayManagerModal
          key={view.day}
          date={view.day}
          tasks={tasks}
          today={bounds.today}
          intl={intl}
          t={t}
          actions={actions}
          onClose={closeDay}
          onAdd={onAddForDay}
          onOpenDay={openDay} />
      ) : null}
    </div>
  );
}

export default CalendarPage;
export { CalendarPage };
