/** Scalar shapes mirror the server. Availability is NOT a value type. */
export type ValueType = 'money' | 'date' | 'duration' | 'count' | 'scale' | 'categorical';
export type Numeric = string | number;
export interface FactValue {
  type: ValueType;
  unit_code?: string | null;
  num?: Numeric | null;
  date?: string | null;
  text?: string | null;
  scale_min?: Numeric | null;
  scale_max?: Numeric | null;
}

export class InvalidValueError extends Error {
  readonly code = 'invalid_value_for_type';
}

const required: Record<ValueType, readonly (keyof FactValue)[]> = {
  money: ['num', 'unit_code'], date: ['date'], duration: ['num', 'unit_code'],
  count: ['num'], scale: ['num', 'scale_min', 'scale_max'], categorical: ['text'],
};
const columns = ['unit_code', 'num', 'date', 'text', 'scale_min', 'scale_max'] as const;
const factor = 1_000_000n;

/** Exact fixed-point arithmetic, not binary floating-point currency maths. */
export function decimalUnits(value: Numeric): bigint {
  const text = String(value);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new InvalidValueError('Expected a finite decimal with at most six places');
  const fraction = (match[3] || '').replace(/0+$/, '');
  if (fraction.length > 6) throw new InvalidValueError('Expected at most six significant decimal places');
  const units = BigInt(match[2]) * factor + BigInt(fraction.padEnd(6, '0'));
  return match[1] === '-' ? -units : units;
}

export function decimalText(units: bigint): string {
  const absolute = units < 0 ? -units : units;
  const fraction = String(absolute % factor).padStart(6, '0').replace(/0+$/, '');
  return `${units < 0 ? '-' : ''}${absolute / factor}${fraction ? `.${fraction}` : ''}`;
}

export function dateMillis(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new InvalidValueError('Expected ISO date');
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new InvalidValueError('Invalid calendar date');
  }
  return timestamp;
}

export function validateValue(value: FactValue): FactValue {
  const fields = required[value.type];
  if (!fields) throw new InvalidValueError('Unknown value type');
  for (const column of columns) {
    const present = value[column] !== undefined && value[column] !== null;
    if (present !== fields.includes(column)) throw new InvalidValueError(`Invalid ${value.type} ${column}`);
  }
  for (const column of ['num', 'scale_min', 'scale_max'] as const) {
    if (value[column] != null) {
      const units = decimalUnits(value[column]!);
      if (units <= -100_000_000_000_000n * factor || units >= 100_000_000_000_000n * factor) throw new InvalidValueError('numeric(20,6) overflow');
    }
  }
  if (value.type === 'money' && !/^[A-Z]{3}$/.test(value.unit_code!)) throw new InvalidValueError('Invalid currency');
  if (value.type === 'duration' && value.unit_code !== 'minute') throw new InvalidValueError('Duration must use minutes');
  if (value.type === 'date') dateMillis(value.date!);
  if (value.type === 'categorical' && !value.text!.trim()) throw new InvalidValueError('Empty category');
  if (value.type === 'scale') {
    const low = decimalUnits(value.scale_min!);
    const high = decimalUnits(value.scale_max!);
    const num = decimalUnits(value.num!);
    if (low >= high || num < low || num > high) throw new InvalidValueError('Invalid scale bounds');
  }
  return value;
}

export function grouped(value: Numeric): string {
  const [whole, fraction] = String(value).split('.');
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${groupedWhole}.${fraction.replace(/0+$/, '')}`.replace(/\.$/, '') : groupedWhole;
}

export function formatValue(value: FactValue | null | undefined): string {
  if (value == null) return 'нет данных';
  validateValue(value);
  switch (value.type) {
    case 'money': return `${value.unit_code === 'UAH' ? '₴' : value.unit_code === 'USD' ? '$' : `${value.unit_code} `}${grouped(value.num!)}`;
    case 'date': return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dateMillis(value.date!));
    case 'duration': {
      const units = decimalUnits(value.num!);
      const absolute = units < 0 ? -units : units;
      const hours = absolute / (60n * factor);
      const minutes = decimalText(absolute % (60n * factor));
      return `${units < 0 ? '−' : ''}${hours ? `${hours} ч ` : ''}${minutes} м`;
    }
    case 'count': return grouped(value.num!);
    case 'scale': return `${grouped(value.num!)}/${grouped(value.scale_max!)}`;
    case 'categorical': return value.text!;
  }
}
