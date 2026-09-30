import { parseDateOnly } from '../../analytics/timezone';
import { dateKey, monthKey, yearInBounds } from '../../domain/calendarModel.ts';

/* Calendar hash grammar. One route id (`calendar`); the page reads the rest.
 *
 *   #/calendar                  days of the current Kyiv month (layout A or B)
 *   #/calendar/YYYY-MM          days of that month
 *   #/calendar/YYYY-MM-DD       day details of that date
 *   #/calendar/YYYY             the 12 month tiles of the year
 *   #/calendar/years            12-year window with the current year
 *   #/calendar/years/YYYY       window containing YYYY
 *   #/calendar/history          History
 *
 * Anything else — or a year outside [minYear, 2100] — parses to the current
 * month with `valid: false` so the page can replace the hash. */

const MONTH = /^(\d{4})-(\d{2})$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const YEAR = /^\d{4}$/;

function currentMonth(bounds, valid) {
  const { year, month } = parseDateOnly(bounds.today);
  return { view: 'month', year, month, day: null, valid };
}

export function parseCalendarHash(hash, bounds) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  if (raw !== 'calendar' && !raw.startsWith('calendar/')) return currentMonth(bounds, false);
  const rest = raw === 'calendar' ? '' : raw.slice('calendar/'.length);

  if (rest === '') return currentMonth(bounds, true);
  if (rest === 'history') return { view: 'history', valid: true };
  if (rest === 'years') return { view: 'years', year: bounds.currentYear, valid: true };

  const yearsMatch = /^years\/(\d{4})$/.exec(rest);
  if (yearsMatch) {
    const year = Number(yearsMatch[1]);
    return yearInBounds(year, bounds) ? { view: 'years', year, valid: true } : currentMonth(bounds, false);
  }
  if (YEAR.test(rest)) {
    const year = Number(rest);
    return yearInBounds(year, bounds) ? { view: 'year', year, valid: true } : currentMonth(bounds, false);
  }
  const monthMatch = MONTH.exec(rest);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    return month >= 1 && month <= 12 && yearInBounds(year, bounds)
      ? { view: 'month', year, month, day: null, valid: true }
      : currentMonth(bounds, false);
  }
  if (DAY.test(rest)) {
    try {
      const { year, month, day } = parseDateOnly(rest);
      if (yearInBounds(year, bounds)) return { view: 'month', year, month, day: dateKey(year, month, day), valid: true };
    } catch {
      /* falls through to the safe route */
    }
  }
  return currentMonth(bounds, false);
}

export function calendarHash(target) {
  switch (target.view) {
    case 'history': return '#/calendar/history';
    case 'years': return `#/calendar/years/${target.year}`;
    case 'year': return `#/calendar/${target.year}`;
    default:
      return target.day ? `#/calendar/${target.day}` : `#/calendar/${monthKey(target.year, target.month)}`;
  }
}
