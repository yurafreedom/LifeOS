/** Difference only: this module has no desirability or materiality inputs. */
import { dateMillis, decimalText, decimalUnits, grouped, validateValue } from './values';
import type { FactValue, Numeric, ValueType } from './values';

export class IncompatibleUnitsError extends Error {
  readonly code: string = 'incompatible_units';
}
export class CategoricalComparisonError extends IncompatibleUnitsError {
  override readonly code = 'categorical_delta_undefined';
}
export interface DerivedDelta {
  state: 'known' | 'unknown' | 'not_applicable';
  type?: ValueType | null;
  num?: Numeric | null;
  unit_code?: string | null;
  scale_min?: Numeric | null;
  scale_max?: Numeric | null;
  reason?: string | null;
}

export function computeDelta(current: FactValue | null, reference: FactValue | null): DerivedDelta {
  if (current == null || reference == null) return { state: 'unknown', reason: 'operand_absent' };
  validateValue(current);
  validateValue(reference);
  if (current.type !== reference.type) throw new IncompatibleUnitsError('Different value types');
  if (current.type === 'categorical') throw new CategoricalComparisonError('Juxtaposition only');
  if (current.type === 'date') {
    const days = (dateMillis(current.date!) - dateMillis(reference.date!)) / 86_400_000;
    return { state: 'known', type: 'duration', num: String(days * 1440), unit_code: 'minute' };
  }
  if ((current.unit_code ?? null) !== (reference.unit_code ?? null)) throw new IncompatibleUnitsError('Different units');
  if (current.type === 'scale' && (decimalUnits(current.scale_min!) !== decimalUnits(reference.scale_min!) || decimalUnits(current.scale_max!) !== decimalUnits(reference.scale_max!))) {
    throw new IncompatibleUnitsError('Different scale bounds');
  }
  return { state: 'known', type: current.type, num: decimalText(decimalUnits(current.num!) - decimalUnits(reference.num!)),
    unit_code: current.unit_code ?? null, scale_min: current.scale_min ?? null, scale_max: current.scale_max ?? null };
}

export function formatDelta(delta: DerivedDelta, dateComparison = false): string {
  if (delta.state !== 'known') return delta.reason === 'insufficient_data' ? 'рано судить' : '—';
  const units = decimalUnits(delta.num!);
  const absolute = units < 0 ? -units : units;
  const sign = units < 0 ? '−' : units > 0 ? '+' : '';
  if (dateComparison) return `${sign}${decimalText(absolute / 1440n)} дней`;
  if (delta.type === 'scale') return `${sign}${decimalText(absolute)}`;
  const number = grouped(decimalText(absolute));
  if (delta.type === 'money') return `${sign}${delta.unit_code === 'UAH' ? '₴' : delta.unit_code === 'USD' ? '$' : `${delta.unit_code} `}${number}`;
  if (delta.type === 'duration') return `${sign}${number} м`;
  return sign + number;
}
