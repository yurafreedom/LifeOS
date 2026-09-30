import { parseDateOnly } from '../../analytics/timezone';
import {
  addDays, clampedDate, dateInBounds, formatDay, formatMonth, shiftMonth, yearInBounds, yearWindow,
} from '../../domain/calendarModel.ts';

/* Nested tile Calendar — pure navigation model (approved JENKIN design).
 *
 * Levels: Years → Months → Days → Day details. The existing hash grammar
 * (calendarRoute.js) is unchanged and maps one to one:
 *   years   #/calendar/years[/YYYY]       12-year window containing YYYY
 *   months  #/calendar/YYYY               the 12 months of YYYY
 *   days    #/calendar[/YYYY-MM]          layout A or B (a view preference)
 *   day     #/calendar/YYYY-MM-DD         day details
 *   history #/calendar/history            outside the hierarchy
 *
 * The route decides the level and the period. The selected date (`cursor`,
 * 'YYYY-MM-DD') is UI state that follows the period: moving to a shorter
 * month keeps the day of month where it exists (31 Jan → 28/29 Feb). Nothing
 * here reads a clock, the DOM or animation state. */

export const LEVELS = ['years', 'months', 'days', 'day'];

export function levelOf(view) {
  if (view.view === 'history') return 'history';
  if (view.view === 'years') return 'years';
  if (view.view === 'year') return 'months';
  return view.day ? 'day' : 'days';
}

const parts = date => parseDateOnly(date);

/** The selected date inside the visible period (clamped), else unchanged. */
export function reconcileCursor(cursor, view) {
  const c = parts(cursor);
  switch (levelOf(view)) {
    case 'day':
      return view.day;
    case 'days':
      return c.year === view.year && c.month === view.month ? cursor : clampedDate(view.year, view.month, c.day);
    case 'months':
      return c.year === view.year ? cursor : clampedDate(view.year, c.month, c.day);
    default:
      return cursor;
  }
}

const monthView = (year, month) => ({ view: 'month', year, month, day: null });
const dayView = date => {
  const { year, month } = parts(date);
  return { view: 'month', year, month, day: date };
};

/* A navigation step: the route target plus the selected date it implies. */
const step = (target, cursor) => ({ target, cursor });

/** Activating a tile: a year opens its months, a month its days, a day its details. */
export function yearTileStep(year, cursor) {
  const c = parts(cursor);
  return step({ view: 'year', year }, c.year === year ? cursor : clampedDate(year, c.month, c.day));
}

export function monthTileStep(year, month, cursor) {
  const c = parts(cursor);
  return step(monthView(year, month), c.year === year && c.month === month ? cursor : clampedDate(year, month, c.day));
}

export function dayTileStep(date) {
  return step(dayView(date), date);
}

/* One level up (Escape, and the parent breadcrumb). History is outside the
   hierarchy: leaving it returns to the selected date's month. */
export function upStep(view, cursor, bounds) {
  switch (levelOf(view)) {
    case 'day': return step(monthView(view.year, view.month), cursor);
    case 'days': return step({ view: 'year', year: view.year }, cursor);
    case 'months': return step({ view: 'years', year: view.year }, cursor);
    case 'history': {
      const safe = dateInBounds(cursor, bounds) ? cursor : bounds.today;
      const { year, month } = parts(safe);
      return step(monthView(year, month), safe);
    }
    default: return null;
  }
}

/** Previous (-1) / next (+1) period of the current level, or null at a bound. */
export function periodStep(view, cursor, bounds, direction) {
  const c = parts(cursor);
  switch (levelOf(view)) {
    case 'years': {
      const range = yearWindow(view.year, bounds);
      const year = direction < 0 ? range.prev : range.next;
      return year == null ? null : step({ view: 'years', year }, cursor);
    }
    case 'months': {
      const year = view.year + direction;
      return yearInBounds(year, bounds) ? step({ view: 'year', year }, clampedDate(year, c.month, c.day)) : null;
    }
    case 'days': {
      const next = shiftMonth(view.year, view.month, direction);
      return yearInBounds(next.year, bounds)
        ? step(monthView(next.year, next.month), clampedDate(next.year, next.month, c.day))
        : null;
    }
    case 'day': {
      const date = addDays(view.day, direction);
      return dateInBounds(date, bounds) ? step(dayView(date), date) : null;
    }
    default:
      return null;
  }
}

/** Today: the current Kyiv month's days with today selected. */
export function todayStep(bounds) {
  const { year, month } = parts(bounds.today);
  return step(monthView(year, month), bounds.today);
}

/* Breadcrumbs: calendar root (years) / year / month / day. The last crumb is
   the current level and has no step. History: root / history. */
export function breadcrumbs(view, cursor, bounds, intl, t) {
  const level = levelOf(view);
  const rootYear = level === 'history'
    ? (dateInBounds(cursor, bounds) ? parts(cursor).year : bounds.currentYear)
    : view.year;
  const crumbs = [{ level: 'years', label: t('cal_title'), step: step({ view: 'years', year: rootYear }, cursor) }];
  if (level === 'history') {
    crumbs.push({ level: 'history', label: t('cal_history_title'), step: null });
  } else {
    if (level !== 'years') crumbs.push({ level: 'months', label: String(view.year), step: step({ view: 'year', year: view.year }, cursor) });
    if (level === 'days' || level === 'day') {
      crumbs.push({ level: 'days', label: formatMonth(view.year, view.month, intl, { month: 'long' }), step: step(monthView(view.year, view.month), cursor) });
    }
    if (level === 'day') crumbs.push({ level: 'day', label: String(parts(view.day).day), step: null });
  }
  crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], step: null };
  return crumbs;
}

/** «октябрь 2026» — month and year without the locale's «г.» suffix. */
export function monthYearLabel(year, month, intl) {
  return `${formatMonth(year, month, intl, { month: 'long' })} ${year}`;
}

/** The period in words (screen-reader heading / live region). */
export function periodLabel(view, bounds, intl, t) {
  switch (levelOf(view)) {
    case 'years': {
      const range = yearWindow(view.year, bounds);
      return range.start === range.end ? String(range.start) : t('cal_years_range', range.start, range.end);
    }
    case 'months': return String(view.year);
    case 'days': return monthYearLabel(view.year, view.month, intl);
    case 'day': return formatDay(view.day, intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    default: return t('cal_history_title');
  }
}

/* ── Keyboard geometry ──────────────────────────────────────────────────── */

/** Columns of a rendered tile grid: tiles on the first tile's row (±2 px). */
export function columnsFromTops(tops) {
  if (!tops.length) return 1;
  return Math.max(1, tops.filter(top => Math.abs(top - tops[0]) < 2).length);
}

/* Grids (years, months, layout A): ←/→ move one tile in reading order, ↑/↓
   one rendered row. Moving past either end stays put. */
export function gridArrowTarget(index, key, columns, count) {
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[key];
  if (delta == null) return null;
  const next = index + delta;
  return next >= 0 && next < count ? next : index;
}

/* Layout B week panels (7 day rows each, in week order): ↑/↓ stay inside the
   week panel; ←/→ go to the same weekday in the previous / next panel. */
export function weekArrowTarget(index, key, count) {
  const week = Math.floor(index / 7);
  const weekday = index % 7;
  if (key === 'ArrowUp') return weekday > 0 ? index - 1 : index;
  if (key === 'ArrowDown') return weekday < 6 && index + 1 < count ? index + 1 : index;
  if (key === 'ArrowLeft') return week > 0 ? index - 7 : index;
  if (key === 'ArrowRight') return index + 7 < count ? index + 7 : index;
  return null;
}

/* ── A / B day layout (device preference) ───────────────────────────────── */

/* Stored like the other device preferences (lifeOsTheme, lifeOsSidebar):
   browser-local, validated, never part of the server snapshot. B (week
   panels) is the default. */
export const LAYOUT_KEY = 'lifeOsCalendarLayout';
export const DEFAULT_LAYOUT = 'B';

export function readLayout(storage) {
  try {
    const value = storage && storage.getItem(LAYOUT_KEY);
    return value === 'A' || value === 'B' ? value : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function writeLayout(storage, layout) {
  try {
    if (storage && (layout === 'A' || layout === 'B')) storage.setItem(LAYOUT_KEY, layout);
  } catch {
    /* private mode / blocked storage: the choice lasts for this page only */
  }
}
