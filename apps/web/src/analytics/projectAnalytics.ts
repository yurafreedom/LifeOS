/**
 * Project Analytics — pure helpers shared by the page, the entry point and tests.
 *
 * Nothing here derives analytics: the server answers first/latest/count and the
 * dual delta. These helpers only route, format and describe the local queue.
 */
import type { DerivedDelta } from './delta';

export const PROJECT_ANALYTICS_ROUTE = 'project-analytics';

const HASH_PREFIX = `${PROJECT_ANALYTICS_ROUTE}/`;

export function projectAnalyticsHash(projectId: string): string {
  if (!projectId || projectId.includes(':')) throw new TypeError('A project id is non-empty and contains no colon.');
  return `#/${HASH_PREFIX}${encodeURIComponent(projectId)}`;
}

/** The project id of `#/project-analytics/<id>`, or `null` for any other hash. */
export function parseProjectAnalyticsHash(hash: string): string | null {
  const raw = (hash || '').replace(/^#\/?/, '');
  if (!raw.startsWith(HASH_PREFIX)) return null;
  const encoded = raw.slice(HASH_PREFIX.length);
  if (!encoded || encoded.includes('/')) return null;
  let id: string;
  try {
    id = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  return id && !id.includes(':') ? id : null;
}

type PluralText = ((key: string, ...args: unknown[]) => string) & { pl?: (key: string, n: number) => string };

const RU_DAY_FORMS = ['день', 'дня', 'дней'];

function ruPlural(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return RU_DAY_FORMS[2];
  const mod10 = n % 10;
  if (mod10 === 1) return RU_DAY_FORMS[0];
  if (mod10 >= 2 && mod10 <= 4) return RU_DAY_FORMS[1];
  return RU_DAY_FORMS[2];
}

/** Whole days of a known date delta (canonical minutes), else `null`. */
export function deltaDays(delta: DerivedDelta | null | undefined): number | null {
  if (!delta || delta.state !== 'known' || delta.num == null) return null;
  const minutes = Number(delta.num);
  if (!Number.isFinite(minutes)) return null;
  return Math.round(minutes / 1440);
}

/**
 * `+5 дней`, `−1 день` (RU) · `+5 днів`, `−1 день` (UK). U+2212 for minus.
 * Project-specific on purpose: the shared `formatDelta` stays byte-identical
 * for Finance and Review.
 */
export function formatDayDelta(delta: DerivedDelta | null | undefined, t?: PluralText): string | null {
  const days = deltaDays(delta);
  if (days == null) return null;
  const absolute = Math.abs(days);
  const sign = days < 0 ? '−' : days > 0 ? '+' : '';
  const unit = t?.pl ? t.pl('pl_day', absolute) : ruPlural(absolute);
  return `${sign}${absolute} ${unit}`;
}

/** A date-only value (`YYYY-MM-DD`) in the viewer's locale, never shifted by a zone. */
export function formatDateOnly(value: string | null | undefined, intlLocale = 'ru-RU'): string {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(intlLocale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** An instant, shown as its Europe/Kyiv calendar date. */
export function formatInstantDate(value: string | null | undefined, intlLocale = 'ru-RU'): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(intlLocale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Kyiv' });
}

type QueueRecordLike = { operation_type: string; payload: Record<string, unknown> };

const PROJECT_WRITES = new Set(['forecast.append', 'measurement.append']);

/**
 * Local forecast/completion writes for this project the server has not yet
 * acknowledged (every queue state, including failed ones). They are reported
 * next to the history — never merged into it.
 */
export function countPendingProjectWrites(records: QueueRecordLike[], projectId: string): number {
  return records.filter(record => {
    if (!PROJECT_WRITES.has(record.operation_type)) return false;
    const subject = record.payload?.subject as { domain?: string; type?: string; id?: string } | undefined;
    return subject?.domain === 'project' && subject?.type === 'project' && String(subject?.id) === String(projectId);
  }).length;
}
