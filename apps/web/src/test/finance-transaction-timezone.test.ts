import { describe, expect, it } from 'vitest';
import {
  dateOnlyAtStartOfDay,
  FINANCE_TIME_ZONE,
  financeTransactionMeasurementPayload,
} from '../analytics/financeTransaction';

function localDateTime(instant: string, timeZone = FINANCE_TIME_ZONE) {
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
  const values = Object.fromEntries(
    formatter.formatToParts(new Date(instant))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
}

describe('Finance date-only occurrence semantics', () => {
  it.each([
    ['summer', '2026-08-01'],
    ['winter', '2026-12-01'],
  ])('keeps the source calendar date at Kyiv midnight in %s', (_season, dateOnly) => {
    const occurrence = dateOnlyAtStartOfDay(dateOnly);
    expect(localDateTime(occurrence)).toEqual({ date: dateOnly, time: '00:00:00' });
  });

  it('keeps a December 1 transaction in December rather than November', () => {
    const payload = financeTransactionMeasurementPayload({
      id: 'winter-boundary', amount: '1200', category_id: 'food', date: '2026-12-01',
    });
    const local = localDateTime(payload.occurred_at);
    expect(local.date).toBe('2026-12-01');
    expect(local.date.slice(0, 7)).toBe('2026-12');
    expect(payload.occurred_tz).toBe(FINANCE_TIME_ZONE);
  });

  it('keeps a January 1 transaction inside the new local year', () => {
    const occurrence = dateOnlyAtStartOfDay('2027-01-01');
    expect(localDateTime(occurrence)).toEqual({ date: '2027-01-01', time: '00:00:00' });
  });
});
