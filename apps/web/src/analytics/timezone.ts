export const LIFEOS_TIME_ZONE = 'Europe/Kyiv';

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    calendar: 'iso8601',
    numberingSystem: 'latn',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function zonedParts(instant: number, timeZone: string): ZonedDateTimeParts {
  const values = Object.fromEntries(
    formatterFor(timeZone).formatToParts(new Date(instant))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  );
  return values as ZonedDateTimeParts;
}

export function parseDateOnly(dateOnly: string): { year: number; month: number; day: number } {
  const match = DATE_ONLY_PATTERN.exec(dateOnly);
  if (!match) throw new TypeError(`Invalid date-only value: ${dateOnly}`);
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day
  ) {
    throw new TypeError(`Invalid calendar date: ${dateOnly}`);
  }
  return { year, month, day };
}

export function dateOnlyAtStartOfDay(
  dateOnly: string,
  timeZone = LIFEOS_TIME_ZONE,
): string {
  const { year, month, day } = parseDateOnly(dateOnly);
  const desiredAsUtc = Date.UTC(year, month - 1, day);

  // Solve for the UTC instant whose IANA-local representation is 00:00:00 on
  // the source date. This never consults the browser's own local timezone.
  let instant = desiredAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const represented = zonedParts(instant, timeZone);
    const representedAsUtc = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
      represented.second,
    );
    const correction = desiredAsUtc - representedAsUtc;
    if (correction === 0) break;
    instant += correction;
  }

  const resolved = zonedParts(instant, timeZone);
  if (
    resolved.year !== year
    || resolved.month !== month
    || resolved.day !== day
    || resolved.hour !== 0
    || resolved.minute !== 0
    || resolved.second !== 0
  ) {
    throw new RangeError(`Local midnight does not resolve for ${dateOnly} in ${timeZone}`);
  }
  return new Date(instant).toISOString();
}

export function nextDateOnly(dateOnly: string): string {
  const { year, month, day } = parseDateOnly(dateOnly);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    String(next.getUTCFullYear()).padStart(4, '0'),
    String(next.getUTCMonth() + 1).padStart(2, '0'),
    String(next.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function dateOnlyAfterEndOfDay(
  dateOnly: string,
  timeZone = LIFEOS_TIME_ZONE,
): string {
  return dateOnlyAtStartOfDay(nextDateOnly(dateOnly), timeZone);
}

export function localDateForInstant(
  value: string | number | Date,
  timeZone = LIFEOS_TIME_ZONE,
): string {
  const instant = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(instant)) throw new TypeError(`Invalid instant: ${String(value)}`);
  const parts = zonedParts(instant, timeZone);
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}
