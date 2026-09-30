import React from 'react';
import { dateInBounds, formatDay, formatMonth, monthGrid, monthKey, monthWeeks, yearMonths } from '../../domain/calendarModel.ts';
import { monthYearLabel } from './calendarNav.js';

/* Nested tile Calendar — the four tile surfaces of the approved JENKIN
 * design: 12 year tiles, 12 month tiles, day layout A (7 × 6 grid) and day
 * layout B (week panels). Every summary is a real count of ACTIVE dated
 * tasks (activeTaskCounts); an empty period stays empty. There are no event
 * rows, event controls or demo content: Events have no production store.
 *
 * Markup contract used by CalendarPage for focus and arrow keys:
 *   [data-nav="grid" | "weeks"]  the tile container
 *   [data-tile="1"]              a focusable tile (disabled when out of range)
 *   [data-autofocus="1"]         the selected tile (focused after navigation)
 *   [data-adjacent="1"]          a neighbouring-month day (layouts A/B)
 * `data-spin` restarts the approved rotateY transition; nothing depends on
 * the animation finishing. */

const taskCount = (count, t) => `${count} ${t.pl('pl_task', count)}`;

/* The second click of a double click (event.detail 2) would land on a tile of
   the NEXT level mid-transition; only single activations navigate. Keyboard
   activations have detail 0. */
const single = handler => event => {
  if (event && event.detail > 1) return;
  handler();
};

const flag = value => (value ? '1' : undefined);

function TaskDots({ count, overdue }) {
  if (!count) return null;
  return (
    <span className={'cal-dots' + (overdue ? ' is-overdue' : '')} aria-hidden="true">
      {Array.from({ length: Math.min(count, 3) }, (_, index) => <i key={index} />)}
    </span>
  );
}

export function YearTiles({ years, label, cursorYear, currentYear, counts, spin, t, onOpen }) {
  return (
    <div className="cal-grid cal-grid12 cal-grid-years" data-nav="grid" data-spin={spin || undefined} role="group" aria-label={label}>
      {years.map(year => {
        const count = counts.year.get(String(year)) || 0;
        const isCurrent = year === currentYear;
        return (
          <button
            key={year}
            type="button"
            className={'cal-tile cal-tile-year' + (isCurrent ? ' is-gloss' : '')}
            data-tile="1"
            data-year={year}
            data-today={flag(isCurrent)}
            data-selected={flag(year === cursorYear)}
            data-autofocus={flag(year === cursorYear)}
            aria-current={isCurrent ? 'date' : undefined}
            aria-label={count ? `${year}, ${taskCount(count, t)}` : String(year)}
            onClick={single(() => onOpen(year))}>
            <span className="cal-num cal-num-year">{year}</span>
            {count ? <span className="cal-sub">{taskCount(count, t)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function MonthTiles({ year, cursor, today, counts, spin, intl, t, onOpen }) {
  const currentMonth = today.slice(0, 7);
  const selectedMonth = cursor.slice(0, 7);
  return (
    <div className="cal-grid cal-grid12 cal-grid-months" data-nav="grid" data-spin={spin || undefined} role="group" aria-label={String(year)}>
      {yearMonths(year).map(cell => {
        const name = formatMonth(cell.year, cell.month, intl, { month: 'long' });
        const full = monthYearLabel(cell.year, cell.month, intl);
        const count = counts.month.get(cell.key) || 0;
        const isCurrent = cell.key === currentMonth;
        return (
          <button
            key={cell.key}
            type="button"
            className={'cal-tile cal-tile-month' + (isCurrent ? ' is-gloss' : '')}
            data-tile="1"
            data-month={monthKey(cell.year, cell.month)}
            data-today={flag(isCurrent)}
            data-selected={flag(cell.key === selectedMonth)}
            data-autofocus={flag(cell.key === selectedMonth)}
            aria-current={isCurrent ? 'date' : undefined}
            aria-label={count ? `${full}, ${taskCount(count, t)}` : full}
            onClick={single(() => onOpen(cell.year, cell.month))}>
            <span className="cal-num cal-num-month">{name}</span>
            <span className="cal-eyebrow">{String(cell.month).padStart(2, '0')} · {cell.year}</span>
            {count ? <span className="cal-sub">{taskCount(count, t)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* One day as a tile (A) or a week row (B): the same state and label. */
function dayState(cell, { cursor, today, counts, bounds }) {
  const count = counts.day.get(cell.date) || 0;
  return {
    count,
    inBounds: dateInBounds(cell.date, bounds),
    isToday: cell.date === today,
    selected: cell.inMonth && cell.date === cursor,
    overdue: count > 0 && cell.date < today,
    weekend: cell.weekday >= 5,
  };
}

function dayLabel(cell, state, intl, t) {
  const full = formatDay(cell.date, intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const bits = [state.isToday ? t('cal_cube_today', full) : full];
  if (state.count) bits.push(taskCount(state.count, t));
  if (state.overdue) bits.push(t('cal_overdue'));
  return bits.join(', ');
}

const dayAttrs = (cell, state) => ({
  'data-tile': '1',
  'data-date': cell.date,
  'data-today': flag(state.isToday),
  'data-selected': flag(state.selected),
  'data-autofocus': flag(state.selected),
  'data-weekend': flag(state.weekend),
  'data-adjacent': flag(!cell.inMonth),
  'aria-current': state.isToday ? 'date' : undefined,
  disabled: !state.inBounds,
});

const shortWeekday = (date, intl) => formatDay(date, intl, { weekday: 'short' }).replace('.', '');

/* Layout A — seven weekday columns × six date rows (42 cells). */
export function DaysGridA({ year, month, cursor, today, bounds, counts, spin, intl, t, onOpen }) {
  const cells = monthGrid(year, month);
  const context = { cursor, today, counts, bounds };
  return (
    <div className="cal-grid cal-grid-a" data-nav="grid" data-spin={spin || undefined} role="group"
         aria-label={monthYearLabel(year, month, intl)}>
      {cells.slice(0, 7).map(cell => (
        <div key={`wd-${cell.weekday}`} className="cal-wdh" aria-hidden="true">{shortWeekday(cell.date, intl)}</div>
      ))}
      {cells.map(cell => {
        const state = dayState(cell, context);
        return (
          <button
            key={cell.date}
            type="button"
            className={'cal-tile cal-tile-day' + (state.isToday ? ' is-gloss' : '')}
            {...dayAttrs(cell, state)}
            aria-label={dayLabel(cell, state, intl, t)}
            onClick={single(() => onOpen(cell.date))}>
            <span className="cal-num cal-num-day">{cell.day}</span>
            {state.count ? <span className="cal-line cal-line-a">{taskCount(state.count, t)}</span> : null}
            <TaskDots count={state.count} overdue={state.overdue} />
          </button>
        );
      })}
    </div>
  );
}

/* Layout B — the month's real weeks as panels of seven day rows, four panels
   per row; a fifth / sixth week continues on the next row. */
export function DaysWeeksB({ year, month, cursor, today, bounds, counts, spin, intl, t, onOpen }) {
  const weeks = monthWeeks(year, month);
  const context = { cursor, today, counts, bounds };
  return (
    <div className="cal-grid cal-grid-b" data-nav="weeks" data-spin={spin || undefined} role="group"
         aria-label={monthYearLabel(year, month, intl)}>
      {weeks.map((week, index) => {
        const first = week[0];
        const last = week[6];
        const range = `${first.day}–${last.day}`;
        return (
          <div key={first.date} className="cal-tile cal-week" role="group" aria-label={`${t('cal_week', index + 1)}, ${range}`}>
            <div className="cal-week-h" aria-hidden="true">
              <span>{t('cal_week', index + 1)}</span>
              <span className="mono">{range}</span>
            </div>
            {week.map(cell => {
              const state = dayState(cell, context);
              return (
                <button
                  key={cell.date}
                  type="button"
                  className="cal-wrow"
                  {...dayAttrs(cell, state)}
                  aria-label={dayLabel(cell, state, intl, t)}
                  onClick={single(() => onOpen(cell.date))}>
                  <span className="cal-num cal-num-row">{cell.day}</span>
                  <span className="cal-wd">{shortWeekday(cell.date, intl)}</span>
                  <span className="cal-wline">
                    {state.count ? <span className="cal-line">{taskCount(state.count, t)}</span> : null}
                    <TaskDots count={state.count} overdue={state.overdue} />
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
