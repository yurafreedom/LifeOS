import { describe, expect, it } from 'vitest';

import {
  MAX_YEAR,
  calendarBounds,
  daysInMonth,
  formatDay,
  isAcceptableTaskDate,
  minNavigableYear,
  monthDays,
  shiftMonth,
  todayDateOnly,
  weekdayIndex,
  yearMonths,
  yearWindow,
  type CalendarBounds,
} from '../domain/calendarModel';
import { calendarHash, parseCalendarHash } from '../pages/calendar/calendarRoute.js';

/* Calendar date hierarchy + route grammar (plan C01, C02, C10, C26, C27). */

const bounds: CalendarBounds = { today: '2026-10-14', currentYear: 2026, minYear: 2026, maxYear: MAX_YEAR };

describe('month model', () => {
  it.each([
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 4, 30],
    [2026, 1, 31],
    [2100, 2, 28],
    [2000, 2, 29],
  ])('C01/C02 · %i-%i has %i days and exactly that many cells', (year, month, days) => {
    expect(daysInMonth(year, month)).toBe(days);
    const cells = monthDays(year, month);
    expect(cells).toHaveLength(days);
    expect(cells[0].day).toBe(1);
    expect(cells[cells.length - 1].date).toBe(`${year}-${String(month).padStart(2, '0')}-${days}`);
  });

  it('computes Monday-first weekdays from the date alone', () => {
    expect(weekdayIndex('2026-10-12')).toBe(0); // Monday
    expect(weekdayIndex('2026-10-18')).toBe(6); // Sunday
    expect(weekdayIndex('2100-12-31')).toBe(4); // Friday
  });

  it('lists the 12 months of a year and shifts across year ends', () => {
    expect(yearMonths(2027).map(cell => cell.key)).toEqual(
      Array.from({ length: 12 }, (_, index) => `2027-${String(index + 1).padStart(2, '0')}`));
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('year windows and bounds', () => {
  it('C10 · 30-year windows anchored at the current year and capped at 2100', () => {
    const first = yearWindow(2026, bounds);
    expect([first.start, first.end, first.years.length]).toEqual([2026, 2055, 30]);
    expect(first.prev).toBeNull();
    const second = yearWindow(first.next as number, bounds);
    expect([second.start, second.end]).toEqual([2056, 2085]);
    const last = yearWindow(2099, bounds);
    expect([last.start, last.end, last.years.length, last.next]).toEqual([2086, 2100, 15, null]);
    expect(yearWindow(2150, bounds).end).toBe(2100);
  });

  it('OD-4 · the lower bound is the earlier of this year and the earliest dated task', () => {
    expect(minNavigableYear(2026, [])).toBe(2026);
    const tasks = [
      { id: 1, schedule: { date: '2024-05-01', time: '' } },
      { id: 2, schedule: { date: '2031-01-01', time: '' } },
      { id: 3, due: 'tue' },
    ];
    expect(minNavigableYear(2026, tasks)).toBe(2024);
    const withPast = { ...bounds, minYear: 2024 };
    const back = yearWindow(2025, withPast);
    expect([back.start, back.end, back.prev]).toEqual([2024, 2025, null]);
    expect(yearWindow(2026, withPast).prev).toBe(2025);
  });

  it('rejects task dates above 2100 or malformed', () => {
    expect(isAcceptableTaskDate('2100-12-31')).toBe(true);
    expect(isAcceptableTaskDate('2101-01-01')).toBe(false);
    expect(isAcceptableTaskDate('2026-02-30')).toBe(false);
    expect(isAcceptableTaskDate('1999-06-01')).toBe(true);
    expect(isAcceptableTaskDate('')).toBe(false);
  });
});

describe('C27 · Kyiv day, no timezone shift', () => {
  it('uses the Europe/Kyiv day around UTC midnight', () => {
    expect(todayDateOnly('2026-10-13T21:30:00.000Z')).toBe('2026-10-14'); // 00:30 Kyiv (+03)
    expect(todayDateOnly('2026-12-31T22:30:00.000Z')).toBe('2027-01-01'); // 00:30 Kyiv (+02)
    expect(calendarBounds([], '2026-12-31T22:30:00.000Z').currentYear).toBe(2027);
  });

  it('formats a date-only value as the same calendar day', () => {
    expect(formatDay('2026-10-14', 'ru-RU', { day: 'numeric' })).toBe('14');
    expect(formatDay('2026-01-01', 'uk-UA', { day: 'numeric', month: 'numeric' })).toMatch(/^01?\.01?$/);
  });

});

describe('C26 · Calendar hash grammar', () => {
  it.each([
    ['#/calendar', { view: 'month', year: 2026, month: 10, day: null, valid: true }],
    ['#/calendar/2026-11', { view: 'month', year: 2026, month: 11, day: null, valid: true }],
    ['#/calendar/2026-10-14', { view: 'month', year: 2026, month: 10, day: '2026-10-14', valid: true }],
    ['#/calendar/2027', { view: 'year', year: 2027, valid: true }],
    ['#/calendar/years', { view: 'years', year: 2026, valid: true }],
    ['#/calendar/years/2060', { view: 'years', year: 2060, valid: true }],
    ['#/calendar/history', { view: 'history', valid: true }],
  ])('%s', (hash, parsed) => {
    expect(parseCalendarHash(hash, bounds)).toEqual(parsed);
  });

  it.each([
    '#/calendar/2101', '#/calendar/2101-01', '#/calendar/2101-01-01', '#/calendar/years/2101',
    '#/calendar/2025', '#/calendar/2026-13', '#/calendar/2026-02-30', '#/calendar/week', '#/calendar/2026-10-14/x',
  ])('%s normalises to the current month', hash => {
    expect(parseCalendarHash(hash, bounds)).toEqual({ view: 'month', year: 2026, month: 10, day: null, valid: false });
  });

  it('builds canonical hashes that parse back to the same view', () => {
    for (const target of [
      { view: 'month', year: 2026, month: 3, day: null },
      { view: 'month', year: 2026, month: 10, day: '2026-10-14' },
      { view: 'year', year: 2030 },
      { view: 'years', year: 2056 },
      { view: 'history' },
    ]) {
      expect(parseCalendarHash(calendarHash(target), bounds)).toEqual({ ...target, valid: true });
    }
  });

  it('closing a day returns to the month route (Back target)', () => {
    expect(calendarHash({ view: 'month', year: 2026, month: 10, day: null })).toBe('#/calendar/2026-10');
  });
});
