import { formatValue } from './values';
import type { FactValue } from './values';

const concepts: Record<string, string> = { actual: 'факт', expectation: 'ожидалось', forecast: 'прогноз',
  baseline: 'типично', target: 'цель', preference: 'ориентир', observation: 'наблюдение' };
export const conceptLabel = (concept = 'actual'): string => concepts[concept] || concept;
const kinds: Record<string, string> = { observed: 'наблюдение', mine: 'моя трактовка', maybe: 'возможный фактор', unknown: 'неизвестно' };
export const epistemicLabel = (kind: string): string => kinds[kind] || kind;

/** Content/availability only — never comparison or desirability. */
export function formatFact(fact: { status?: string; value?: FactValue | null; is_explicitly_absent?: boolean | null;
  value_availability?: string | null; statement?: string | null }): string {
  if (fact.status === 'tombstoned') return 'удалено';
  if (fact.is_explicitly_absent) return 'не задавалась';
  if (fact.value_availability === 'explicitly_unknown') return 'не знаю';
  if (fact.statement) return fact.statement;
  return formatValue(fact.value);
}
