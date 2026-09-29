import React from 'react';
import { formatDay, formatMonth, monthDays, monthKey, yearMonths } from '../../domain/calendarModel.ts';

/* Calendar cubes. Owner requirement: a day cube shows the day number and the
   weekday — nothing else. No task titles, pills, counts or neighbouring-month
   filler; the month grid has exactly 28–31 cubes and simply wraps. */

const shortWeekday = (date, intl) => formatDay(date, intl, { weekday: 'short' }).replace('.', '');

function cubeClass(base, { today, selected, past }) {
  return base + (today ? ' is-today' : '') + (selected ? ' is-selected' : '') + (past ? ' is-past' : '');
}

export function DayCubes({ year, month, today, selected = null, intl, t, onOpen }) {
  return (
    <ul className="cal-cubes cal-cubes-days" aria-label={formatMonth(year, month, intl, { month: 'long', year: 'numeric' })}>
      {monthDays(year, month).map(cell => {
        const isToday = cell.date === today;
        const full = formatDay(cell.date, intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return (
          <li key={cell.date}>
            <button
              type="button"
              className={cubeClass('cal-cube', { today: isToday, selected: cell.date === selected, past: cell.date < today })}
              data-date={cell.date}
              aria-label={isToday ? t('cal_cube_today', full) : full}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onOpen(cell.date)}>
              <span className="cal-cube-num">{cell.day}</span>
              <span className="cal-cube-dow mono">{shortWeekday(cell.date, intl)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MonthCubes({ year, today, intl, onOpen }) {
  const currentMonth = today.slice(0, 7);
  return (
    <ul className="cal-cubes cal-cubes-months" aria-label={String(year)}>
      {yearMonths(year).map(cell => {
        const name = formatMonth(cell.year, cell.month, intl, { month: 'long' });
        const isCurrent = cell.key === currentMonth;
        return (
          <li key={cell.key}>
            <button
              type="button"
              className={cubeClass('cal-cube cal-cube-month', { today: isCurrent, past: cell.key < currentMonth })}
              data-month={monthKey(cell.year, cell.month)}
              aria-label={formatMonth(cell.year, cell.month, intl, { month: 'long', year: 'numeric' })}
              aria-current={isCurrent ? 'date' : undefined}
              onClick={() => onOpen(cell.year, cell.month)}>
              <span className="cal-cube-name">{name}</span>
              <span className="cal-cube-dow mono">{cell.year}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function YearCubes({ years, currentYear, onOpen }) {
  return (
    <ul className="cal-cubes cal-cubes-years" aria-label={`${years[0]} – ${years[years.length - 1]}`}>
      {years.map(year => (
        <li key={year}>
          <button
            type="button"
            className={cubeClass('cal-cube cal-cube-year', { today: year === currentYear, past: year < currentYear })}
            data-year={year}
            aria-current={year === currentYear ? 'date' : undefined}
            onClick={() => onOpen(year)}>
            <span className="cal-cube-num">{year}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
