export const FINANCE_TIME_ZONE = 'Europe/Kyiv';

type FinanceTransaction = {
  id: string | number;
  amount: string | number;
  category_id: string;
  date: string;
};

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(instant: number, timeZone: string): ZonedDateTimeParts {
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
      .map(part => [part.type, Number(part.value)]),
  );
  return values as ZonedDateTimeParts;
}

export function dateOnlyAtStartOfDay(dateOnly: string, timeZone = FINANCE_TIME_ZONE): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) throw new TypeError(`Invalid date-only value: ${dateOnly}`);

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const desiredAsUtc = Date.UTC(year, month - 1, day);
  const calendarCheck = new Date(desiredAsUtc);
  if (
    calendarCheck.getUTCFullYear() !== year
    || calendarCheck.getUTCMonth() !== month - 1
    || calendarCheck.getUTCDate() !== day
  ) {
    throw new TypeError(`Invalid calendar date: ${dateOnly}`);
  }

  // Solve for the UTC instant whose IANA-local representation is 00:00:00 on
  // the source date. This is independent of the browser's own timezone and
  // lets Intl apply the historical offset for this exact date.
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

export function financeTransactionMeasurementPayload(
  transaction: FinanceTransaction,
  includedByDefault = true,
) {
  return {
    metric_key: 'finance.transaction_amount',
    subject: { domain: 'finance', type: 'transaction', id: String(transaction.id) },
    value: { type: 'money', unit_code: 'UAH', num: String(transaction.amount) },
    occurred_at: dateOnlyAtStartOfDay(transaction.date),
    occurred_tz: FINANCE_TIME_ZONE,
    provenance: {
      source_kind: 'USER_REPORTED', basis: '1 операция', method: 'Ручная запись',
    },
    dimensions: {
      category_id: transaction.category_id,
      included_by_default: includedByDefault,
    },
  };
}
