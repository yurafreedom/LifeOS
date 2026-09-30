import { formatValue } from './values';
import type { AAText, FactValue } from './values';

const concepts: Record<string, string> = { actual: 'факт', expectation: 'ожидалось', forecast: 'прогноз',
  baseline: 'типично', target: 'цель', preference: 'ориентир', observation: 'наблюдение' };
export const conceptLabel = (concept = 'actual', t?: AAText): string =>
  t && concepts[concept] ? t(`aa_pr_${concept}`) : concepts[concept] || concept;
const kinds: Record<string, string> = { observed: 'наблюдение', mine: 'моя трактовка', maybe: 'возможный фактор', unknown: 'неизвестно' };
export const epistemicLabel = (kind: string, t?: AAText): string =>
  t && kinds[kind] ? t(`aa_pr_kind_${kind}`) : kinds[kind] || kind;

const RU_FACT: Record<string, string> = {
  aa_pr_deleted: 'удалено', aa_pr_target_absent_short: 'не задавалась', aa_pr_explicitly_unknown: 'не знаю',
  aa_pr_source_deleted: 'источник удалён',
};
const say = (t: AAText | undefined, key: string): string => (t ? t(key) : RU_FACT[key]);

/** Content/availability only — never comparison or desirability. */
export function formatFact(fact: { status?: string; value?: FactValue | null; is_explicitly_absent?: boolean | null;
  value_availability?: string | null; statement?: string | null; redacted?: boolean;
  redaction_reason?: string | null }, t?: AAText): string {
  if (fact.redacted) {
    return say(t, fact.redaction_reason === 'source_retention_pruned'
      ? 'aa_pr_source_deleted_retention' : 'aa_pr_source_deleted');
  }
  if (fact.status === 'tombstoned') return say(t, 'aa_pr_deleted');
  if (fact.is_explicitly_absent) return say(t, 'aa_pr_target_absent_short');
  if (fact.value_availability === 'explicitly_unknown') return say(t, 'aa_pr_explicitly_unknown');
  if (fact.statement) return fact.statement;
  return formatValue(fact.value, t);
}
