import { dateOnlyAtStartOfDay, localDateForInstant, nextDateOnly, parseDateOnly } from '../analytics/timezone';
import { taskDate, taskTime, type TaskRecord } from './tasks';

/* Calendar date model — pure date-only arithmetic, no browser-local Dates.
 *
 * Every date is a 'YYYY-MM-DD' string; weekdays and month lengths come from
 * Date.UTC, and "today" is the Europe/Kyiv local day (localDateForInstant), the
 * same source Clarify uses. Nothing here slices the UTC ISO string of a local
 * Date, so no day shifts around midnight.
 *
 * Owner bounds: navigation up to 2100; the lower bound is the earlier of the
 * current year and the earliest real dated task. The approved JENKIN design
 * (third export) shows the year level as 12 year tiles (4 × 3), so a year
 * window is 12 years, still anchored at the current year (it replaced the
 * earlier 30-year windows; the route grammar is unchanged). */

export const MAX_YEAR = 2100;
export const MIN_INPUT_YEAR = 1900;
export const WINDOW_YEARS = 12;

export type DayCell = { date: string; day: number; weekday: number };
/** A cell of the 7 × 6 month grid; `inMonth` is false for neighbouring-month days. */
export type GridCell = DayCell & { inMonth: boolean };
export type MonthCell = { year: number; month: number; key: string };
export type YearWindow = { start: number; end: number; years: number[]; prev: number | null; next: number | null };

const pad = (value: number, size = 2) => String(value).padStart(size, '0');

export const monthKey = (year: number, month: number) => `${pad(year, 4)}-${pad(month)}`;
export const dateKey = (year: number, month: number, day: number) => `${monthKey(year, month)}-${pad(day)}`;

export function todayDateOnly(now: string | number | Date = new Date()): string {
  return localDateForInstant(now);
}

/** Milliseconds until the next Europe/Kyiv day starts (DST-aware), ≥ 1. */
export function msUntilNextDay(now: string | number | Date = new Date()): number {
  const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const next = Date.parse(dateOnlyAtStartOfDay(nextDateOnly(todayDateOnly(at))));
  return Math.max(1, next - at);
}

export function yearOf(dateOnly: string): number {
  return parseDateOnly(dateOnly).year;
}

/** 28/29/30/31 — month is 1-based. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(dateOnly: string): number {
  const { year, month, day } = parseDateOnly(dateOnly);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/** Exactly one cell per day of the month — no neighbouring-month filler. */
export function monthDays(year: number, month: number): DayCell[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, index) => {
    const date = dateKey(year, month, index + 1);
    return { date, day: index + 1, weekday: weekdayIndex(date) };
  });
}

export function yearMonths(year: number): MonthCell[] {
  return Array.from({ length: 12 }, (_, index) => ({ year, month: index + 1, key: monthKey(year, index + 1) }));
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** min(current Kyiv year, earliest year among real dated tasks). */
export function minNavigableYear(currentYear: number, tasks: TaskRecord[] = []): number {
  let min = currentYear;
  for (const task of tasks) {
    const date = taskDate(task);
    if (date) min = Math.min(min, yearOf(date));
  }
  return min;
}

export type CalendarBounds = { today: string; currentYear: number; minYear: number; maxYear: number };

export function calendarBounds(tasks: TaskRecord[], now: string | number | Date = new Date()): CalendarBounds {
  return calendarBoundsForDay(tasks, todayDateOnly(now));
}

/* Bounds for an already-known Kyiv day (the page passes useKyivToday(), which
   re-renders at Kyiv midnight and on tab return). `floorYear` keeps a year the
   open page could already navigate reachable after a New Year rollover, so an
   explicit route into the year just left is never invalidated mid-session. */
export function calendarBoundsForDay(tasks: TaskRecord[], today: string, floorYear?: number): CalendarBounds {
  const currentYear = yearOf(today);
  let minYear = minNavigableYear(currentYear, tasks);
  if (Number.isInteger(floorYear)) minYear = Math.min(minYear, floorYear as number);
  return { today, currentYear, minYear, maxYear: MAX_YEAR };
}

export const yearInBounds = (year: number, bounds: CalendarBounds) =>
  Number.isInteger(year) && year >= bounds.minYear && year <= bounds.maxYear;

export function clampYear(year: number, bounds: CalendarBounds): number {
  return Math.min(bounds.maxYear, Math.max(bounds.minYear, year));
}

/* 12-year windows anchored at the current year — [cur+12k, cur+12k+11] —
   clamped to [minYear, 2100]. From 2026: 2026–2037, 2038–2049, …, 2098–2100;
   earlier dated tasks open a backward window down to minYear. Only real,
   navigable years are listed (a clamped window has fewer than 12). */
export function yearWindow(year: number, bounds: CalendarBounds): YearWindow {
  const target = clampYear(year, bounds);
  const k = Math.floor((target - bounds.currentYear) / WINDOW_YEARS);
  const rawStart = bounds.currentYear + k * WINDOW_YEARS;
  const start = Math.max(bounds.minYear, rawStart);
  const end = Math.min(bounds.maxYear, rawStart + WINDOW_YEARS - 1);
  const years = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return {
    start,
    end,
    years,
    prev: start - 1 >= bounds.minYear ? start - 1 : null,
    next: end + 1 <= bounds.maxYear ? end + 1 : null,
  };
}

/* ── Nested tile Calendar (JENKIN): month grid, week panels, clamping ───── */

/** The date `days` after (or before) a date-only value, in pure UTC arithmetic. */
export function addDays(dateOnly: string, days: number): string {
  const { year, month, day } = parseDateOnly(dateOnly);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return dateKey(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** (year, month) with the same day of month where it exists: 31 → 30/29/28. */
export function clampedDate(year: number, month: number, day: number): string {
  return dateKey(year, month, Math.min(Math.max(1, Math.trunc(day) || 1), daysInMonth(year, month)));
}

/** Is this date-only value inside the navigable [minYear, 2100] range? */
export function dateInBounds(dateOnly: string, bounds: CalendarBounds): boolean {
  try {
    return yearInBounds(parseDateOnly(dateOnly).year, bounds);
  } catch {
    return false;
  }
}

/* Layout A: 7 Monday-first columns × 6 rows = 42 cells, starting with the
   week that contains the 1st. Leading and trailing cells are the real
   neighbouring-month days (inMonth: false). */
export function monthGrid(year: number, month: number): GridCell[] {
  const first = dateKey(year, month, 1);
  const offset = weekdayIndex(first);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(first, index - offset);
    const parts = parseDateOnly(date);
    return { date, day: parts.day, weekday: index % 7, inMonth: parts.year === year && parts.month === month };
  });
}

/* Layout B: only the month's real Monday–Sunday weeks — 4, 5 or 6 of them
   (February 2027: 4; February 2026: 5; August 2026: 6). */
export function monthWeeks(year: number, month: number): GridCell[][] {
  const cells = monthGrid(year, month);
  const weeks = Math.ceil((weekdayIndex(dateKey(year, month, 1)) + daysInMonth(year, month)) / 7);
  return Array.from({ length: weeks }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/* Locale formatting of a date-only value, evaluated in UTC so the label is
   the stored calendar day whatever the browser zone is. */
export function formatDay(dateOnly: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  const { year, month, day } = parseDateOnly(dateOnly);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatMonth(year: number, month: number, locale: string, options: Intl.DateTimeFormatOptions): string {
  return formatDay(dateKey(year, month, 1), locale, options);
}

/** Valid calendar input: a real date-only value with MIN_INPUT_YEAR ≤ year ≤ 2100. */
export function isAcceptableTaskDate(value: string): boolean {
  try {
    const { year } = parseDateOnly(value);
    return year >= MIN_INPUT_YEAR && year <= MAX_YEAR;
  } catch {
    return false;
  }
}

/* ── Schedule input (GTD G2) ─────────────────────────────────────────────── */

export type ScheduleInputError = 'cal_err_date' | 'cal_err_time' | 'cal_err_time_needs_date';
export type ScheduleInputResult =
  | { errors: { date?: ScheduleInputError; time?: ScheduleInputError }; schedule?: undefined }
  | { errors: null; schedule: { date: string; time: string } | null };

const INPUT_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/* The single validation for every task date/time editor (Calendar editor,
   Tasks detail). A time only ever refines a date: a time without a date is
   rejected rather than stored as a dateless "due" (normalizeSchedule would
   keep it). Empty date + empty time = no schedule (null). Past dates are
   allowed — rescheduling into the past is a real, visible "overdue" choice. */
export function validateScheduleInput(input: { date?: unknown; time?: unknown }): ScheduleInputResult {
  const date = typeof input.date === 'string' ? input.date.trim() : '';
  const time = typeof input.time === 'string' ? input.time.trim() : '';
  const errors: { date?: ScheduleInputError; time?: ScheduleInputError } = {};
  if (date && !isAcceptableTaskDate(date)) errors.date = 'cal_err_date';
  if (time && !INPUT_TIME.test(time)) errors.time = 'cal_err_time';
  else if (time && !date) errors.time = 'cal_err_time_needs_date';
  if (errors.date || errors.time) return { errors };
  return { errors: null, schedule: date ? { date, time } : null };
}

export type ScheduleValue = { date: string; time: string };
export type ScheduleEditResult =
  | { errors: { date?: ScheduleInputError; time?: ScheduleInputError }; schedule?: undefined; clearsDate?: undefined; conflict?: undefined }
  | { errors: null; schedule: ScheduleValue | undefined; clearsDate: boolean; conflict?: undefined }
  | { errors: null; conflict: { mine: ScheduleValue; saved: ScheduleValue }; schedule?: undefined; clearsDate?: undefined };

/** The persisted schedule as one editor value: a time only with a date. */
export function persistedSchedule(task: TaskRecord): ScheduleValue {
  const date = taskDate(task) || '';
  return { date, time: date ? taskTime(task) : '' };
}

const sameSchedule = (a: ScheduleValue, b: ScheduleValue) => a.date === b.date && a.time === b.time;

/* A task editor's date/time fields against the persisted task. `schedule` is
   undefined when neither changed; a cleared date is reported as
   { date: '', time: '' } (moveTask stores no schedule and drops `order`),
   with `clearsDate` so the UI can confirm leaving the Calendar first.

   `baseline` is the schedule the editor started from (default: the task's).
   Date + time are one unit: an input equal to the baseline is untouched and
   never re-sent, even if the task has since moved; an edited input over a
   schedule that ALSO changed meanwhile is a `conflict`, not a silent move. */
export function scheduleEdit(task: TaskRecord, input: { date?: unknown; time?: unknown }, baseline?: ScheduleValue): ScheduleEditResult {
  const latest = persistedSchedule(task);
  const base = baseline || latest;
  const typed = { date: typeof input.date === 'string' ? input.date.trim() : '', time: typeof input.time === 'string' ? input.time.trim() : '' };
  if (sameSchedule(typed, base)) return { errors: null, schedule: undefined, clearsDate: false };
  const checked = validateScheduleInput(input);
  if (checked.errors) return { errors: checked.errors };
  const next = checked.schedule || { date: '', time: '' };
  if (sameSchedule(next, latest)) return { errors: null, schedule: undefined, clearsDate: false };
  if (!sameSchedule(latest, base)) return { errors: null, conflict: { mine: next, saved: latest } };
  return { errors: null, schedule: next, clearsDate: Boolean(latest.date) && !next.date };
}
