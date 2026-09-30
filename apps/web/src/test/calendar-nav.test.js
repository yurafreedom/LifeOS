import { describe, expect, it } from 'vitest';

import { LifeMakeT } from '../context/LocaleContext.jsx';
import { MAX_YEAR } from '../domain/calendarModel.ts';
import { calendarHash, parseCalendarHash } from '../pages/calendar/calendarRoute.js';
import {
  DEFAULT_LAYOUT, LAYOUT_KEY, breadcrumbs, columnsFromTops, dayTileStep, gridArrowTarget, levelOf, monthTileStep,
  periodLabel, periodStep, readLayout, reconcileCursor, todayStep, upStep, weekArrowTarget, writeLayout, yearTileStep,
} from '../pages/calendar/calendarNav.js';

/* Nested tile Calendar — pure navigation model (JENKIN). */

const bounds = { today: '2026-10-14', currentYear: 2026, minYear: 2026, maxYear: MAX_YEAR };
const t = LifeMakeT('ru');
const month = (year, m) => ({ view: 'month', year, month: m, day: null });
const day = date => ({ view: 'month', year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: date });
const route = step => (step ? calendarHash(step.target) : null);

describe('levels map onto the unchanged route grammar', () => {
  it.each([
    ['#/calendar/years', 'years'],
    ['#/calendar/years/2050', 'years'],
    ['#/calendar/2027', 'months'],
    ['#/calendar', 'days'],
    ['#/calendar/2026-11', 'days'],
    ['#/calendar/2026-11-05', 'day'],
    ['#/calendar/history', 'history'],
  ])('%s → %s', (hash, level) => {
    expect(levelOf(parseCalendarHash(hash, bounds))).toBe(level);
  });
});

describe('Years → Months → Days → Day details', () => {
  it('descends through tiles and every step is a real hash that parses back', () => {
    let cursor = bounds.today;
    let step = yearTileStep(2027, cursor);
    expect(route(step)).toBe('#/calendar/2027');
    expect(step.cursor).toBe('2027-10-14');
    step = monthTileStep(2027, 2, step.cursor);
    expect(route(step)).toBe('#/calendar/2027-02');
    expect(step.cursor).toBe('2027-02-14');
    step = dayTileStep('2027-02-03');
    expect(route(step)).toBe('#/calendar/2027-02-03');
    for (const hash of ['#/calendar/2027', '#/calendar/2027-02', '#/calendar/2027-02-03']) {
      expect(parseCalendarHash(hash, bounds).valid).toBe(true);
    }
    cursor = step.cursor;
    expect(cursor).toBe('2027-02-03');
  });

  it('goes one level up (Escape / parent breadcrumb) and keeps the selected date', () => {
    expect(route(upStep(day('2026-10-20'), '2026-10-20', bounds))).toBe('#/calendar/2026-10');
    expect(route(upStep(month(2026, 10), '2026-10-20', bounds))).toBe('#/calendar/2026');
    expect(route(upStep({ view: 'year', year: 2031 }, '2031-03-01', bounds))).toBe('#/calendar/years/2031');
    expect(upStep({ view: 'years', year: 2026 }, '2026-10-20', bounds)).toBeNull();
    expect(upStep(day('2026-10-20'), '2026-10-20', bounds).cursor).toBe('2026-10-20');
  });

  it('leaving History returns to the selected month (safe if the date left the bounds)', () => {
    expect(route(upStep({ view: 'history' }, '2027-05-09', bounds))).toBe('#/calendar/2027-05');
    expect(route(upStep({ view: 'history' }, '2020-01-01', bounds))).toBe('#/calendar/2026-10');
  });

  it('Today opens the current Kyiv month with today selected', () => {
    expect(todayStep(bounds)).toEqual({ target: month(2026, 10), cursor: '2026-10-14' });
  });
});

describe('selected date clamping', () => {
  it('keeps the day of month, clamped to shorter months (leap years included)', () => {
    expect(reconcileCursor('2026-01-31', month(2026, 2))).toBe('2026-02-28');
    expect(reconcileCursor('2028-01-31', month(2028, 2))).toBe('2028-02-29');
    expect(reconcileCursor('2026-03-31', month(2026, 4))).toBe('2026-04-30');
    expect(reconcileCursor('2028-02-29', { view: 'year', year: 2029 })).toBe('2029-02-28');
    expect(monthTileStep(2026, 2, '2026-01-31').cursor).toBe('2026-02-28');
    expect(yearTileStep(2029, '2028-02-29').cursor).toBe('2029-02-28');
  });

  it('keeps the date when it is already inside the period; years/history keep it too', () => {
    expect(reconcileCursor('2026-10-14', month(2026, 10))).toBe('2026-10-14');
    expect(reconcileCursor('2026-10-14', { view: 'years', year: 2050 })).toBe('2026-10-14');
    expect(reconcileCursor('2026-10-14', { view: 'history' })).toBe('2026-10-14');
    expect(reconcileCursor('2026-10-14', day('2026-12-01'))).toBe('2026-12-01');
  });
});

describe('previous / next period and the bounds', () => {
  it('days: month steps across the year boundary, clamping the day', () => {
    const next = periodStep(month(2026, 12), '2026-12-31', bounds, 1);
    expect(route(next)).toBe('#/calendar/2027-01');
    const feb = periodStep(month(2027, 1), '2027-01-31', bounds, 1);
    expect([route(feb), feb.cursor]).toEqual(['#/calendar/2027-02', '2027-02-28']);
    expect(periodStep(month(2026, 1), '2026-01-15', bounds, -1)).toBeNull(); // below minYear
    expect(periodStep(month(2100, 12), '2100-12-01', bounds, 1)).toBeNull(); // above 2100
  });

  it('months: year steps; years: 12-year windows; day: one day', () => {
    expect(route(periodStep({ view: 'year', year: 2026 }, '2026-10-14', bounds, 1))).toBe('#/calendar/2027');
    expect(periodStep({ view: 'year', year: 2026 }, '2026-10-14', bounds, -1)).toBeNull();
    expect(periodStep({ view: 'year', year: 2100 }, '2100-01-01', bounds, 1)).toBeNull();
    expect(route(periodStep({ view: 'years', year: 2026 }, '2026-10-14', bounds, 1))).toBe('#/calendar/years/2038');
    expect(periodStep({ view: 'years', year: 2099 }, '2026-10-14', bounds, 1)).toBeNull();
    expect(route(periodStep(day('2026-12-31'), '2026-12-31', bounds, 1))).toBe('#/calendar/2027-01-01');
    expect(periodStep(day('2100-12-31'), '2100-12-31', bounds, 1)).toBeNull();
    expect(periodStep(day('2026-01-01'), '2026-01-01', bounds, -1)).toBeNull();
    expect(periodStep({ view: 'history' }, '2026-10-14', bounds, 1)).toBeNull();
  });

  it('an earlier dated task lowers the bound, as before', () => {
    const withPast = { ...bounds, minYear: 2025 };
    expect(route(periodStep(month(2026, 1), '2026-01-15', withPast, -1))).toBe('#/calendar/2025-12');
    expect(route(periodStep({ view: 'years', year: 2026 }, '2026-10-14', withPast, -1))).toBe('#/calendar/years/2025');
  });
});

describe('breadcrumbs', () => {
  const labels = crumbs => crumbs.map(c => [c.label, c.step ? route(c.step) : null]);

  it('shows the path with clickable parents and a non-clickable current level', () => {
    expect(labels(breadcrumbs(day('2026-10-20'), '2026-10-20', bounds, 'ru-RU', t))).toEqual([
      ['календарь', '#/calendar/years/2026'], ['2026', '#/calendar/2026'], ['октябрь', '#/calendar/2026-10'], ['20', null]]);
    expect(labels(breadcrumbs(month(2026, 10), '2026-10-20', bounds, 'ru-RU', t))).toEqual([
      ['календарь', '#/calendar/years/2026'], ['2026', '#/calendar/2026'], ['октябрь', null]]);
    expect(labels(breadcrumbs({ view: 'year', year: 2031 }, '2031-10-20', bounds, 'ru-RU', t))).toEqual([
      ['календарь', '#/calendar/years/2031'], ['2031', null]]);
    expect(labels(breadcrumbs({ view: 'years', year: 2031 }, '2031-10-20', bounds, 'ru-RU', t))).toEqual([['календарь', null]]);
    expect(labels(breadcrumbs({ view: 'history' }, '2031-10-20', bounds, 'ru-RU', t))).toEqual([
      ['календарь', '#/calendar/years/2031'], ['история', null]]);
  });

  it('is localised in Ukrainian', () => {
    const uk = LifeMakeT('uk');
    expect(breadcrumbs(day('2026-10-20'), '2026-10-20', bounds, 'uk-UA', uk).map(c => c.label))
      .toEqual(['календар', '2026', 'жовтень', '20']);
    expect(periodLabel(month(2026, 10), bounds, 'uk-UA', uk)).toBe('жовтень 2026');
    expect(periodLabel({ view: 'years', year: 2026 }, bounds, 'uk-UA', uk)).toBe('2026 – 2037');
  });
});

describe('keyboard geometry', () => {
  it('counts rendered columns from the tiles on the first row', () => {
    expect(columnsFromTops([10, 10, 10, 10, 80, 80, 80, 80, 150, 150, 150, 150])).toBe(4);
    expect(columnsFromTops([10, 10.5, 11, 70, 70, 70])).toBe(3); // sub-pixel rows
    expect(columnsFromTops([])).toBe(1);
  });

  it('grids (years, months, layout A) follow the rendered rows and stop at the ends', () => {
    expect(gridArrowTarget(5, 'ArrowDown', 4, 12)).toBe(9);
    expect(gridArrowTarget(5, 'ArrowUp', 4, 12)).toBe(1);
    expect(gridArrowTarget(1, 'ArrowUp', 4, 12)).toBe(1);
    expect(gridArrowTarget(10, 'ArrowDown', 4, 12)).toBe(10);
    expect(gridArrowTarget(3, 'ArrowRight', 4, 12)).toBe(4); // reading order continues on the next row
    expect(gridArrowTarget(0, 'ArrowLeft', 4, 12)).toBe(0);
    expect(gridArrowTarget(5, 'ArrowDown', 3, 12)).toBe(8); // a 3-column phone grid
    expect(gridArrowTarget(20, 'ArrowDown', 7, 42)).toBe(27); // layout A: same weekday next week
    expect(gridArrowTarget(5, 'Enter', 4, 12)).toBeNull();
  });

  it('layout B: ↑/↓ inside the week panel, ←/→ to the same weekday of the next / previous panel', () => {
    expect(weekArrowTarget(3, 'ArrowDown', 35)).toBe(4);
    expect(weekArrowTarget(6, 'ArrowDown', 35)).toBe(6); // Sunday stays in its panel
    expect(weekArrowTarget(7, 'ArrowUp', 35)).toBe(7); // Monday stays in its panel
    expect(weekArrowTarget(9, 'ArrowRight', 35)).toBe(16);
    expect(weekArrowTarget(9, 'ArrowLeft', 35)).toBe(2);
    expect(weekArrowTarget(2, 'ArrowLeft', 35)).toBe(2); // first panel
    expect(weekArrowTarget(30, 'ArrowRight', 35)).toBe(30); // last panel
    expect(weekArrowTarget(30, 'ArrowRight', 42)).toBe(37); // a sixth week exists
    expect(weekArrowTarget(3, 'Home', 35)).toBeNull();
  });
});

describe('A / B layout preference', () => {
  function memoryStorage(initial = {}) {
    const values = { ...initial };
    return {
      values,
      getItem: key => (key in values ? values[key] : null),
      setItem: (key, value) => { values[key] = String(value); },
    };
  }

  it('defaults to B (week panels) and follows the device-preference convention', () => {
    expect(DEFAULT_LAYOUT).toBe('B');
    expect(LAYOUT_KEY).toBe('lifeOsCalendarLayout');
    expect(readLayout(memoryStorage())).toBe('B');
    expect(readLayout(memoryStorage({ lifeOsCalendarLayout: 'A' }))).toBe('A');
    expect(readLayout(memoryStorage({ lifeOsCalendarLayout: 'weird' }))).toBe('B');
    expect(readLayout(null)).toBe('B');
    expect(readLayout({ getItem: () => { throw new Error('blocked'); } })).toBe('B');
  });

  it('stores only A or B and never throws', () => {
    const storage = memoryStorage();
    writeLayout(storage, 'A');
    expect(storage.values).toEqual({ lifeOsCalendarLayout: 'A' });
    writeLayout(storage, 'C');
    expect(storage.values).toEqual({ lifeOsCalendarLayout: 'A' });
    expect(() => writeLayout({ setItem: () => { throw new Error('quota'); } }, 'B')).not.toThrow();
  });
});
