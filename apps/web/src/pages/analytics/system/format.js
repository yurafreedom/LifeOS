/* System Review · pure formatting and labelling helpers.
   Values are formatted exactly as the server typed them; nothing here adds,
   averages or ranks across items. Copy comes from the ru/uk dictionaries. */

import { formatValue } from '../../../analytics/values';
import { isHypothesis } from '../../../analytics/systemReviewFacts';

const MINUTES_PER_DAY = 1440;

export function valueText(value, t) {
  if (!value) return t('aa_sr_no_value');
  try {
    return formatValue(value, t);
  } catch {
    return t('aa_sr_no_value');
  }
}

export function daysText(days, t) {
  const sign = days > 0 ? '+' : days < 0 ? '−' : '';
  const abs = Math.abs(days);
  return `${sign}${abs} ${t.pl ? t.pl('pl_day', abs) : t('aa_sr_days')}`;
}

/** A delta in its own unit. A date delta is shown in days, never as a duration. */
export function deltaText(delta, t) {
  if (!delta) return null;
  // Two shapes arrive: {state, value:{…}} and the Slice 5 flat {state, type, num, unit_code}.
  const value = delta.value ?? (delta.type ? { type: delta.type, num: delta.num, unit_code: delta.unit_code } : null);
  if (delta.state !== 'known' || !value) return t(`aa_sr_delta_${delta.state}`);
  if (value.type === 'duration') {
    return daysText(Math.round(Number(value.num) / MINUTES_PER_DAY), t);
  }
  const text = valueText({ ...value, num: String(value.num).replace(/^-/, '') }, t);
  const number = Number(value.num);
  return `${number > 0 ? '+' : number < 0 ? '−' : ''}${text}`;
}

export function periodTitle(period, t, { lower = false } = {}) {
  if (/^\d{4}$/.test(period)) return t('aa_sr_year_title', period);
  const [year, month] = period.split('-').map(Number);
  const name = new Intl.DateTimeFormat(t('_intl_locale'), { month: 'long', timeZone: 'UTC' })
    .format(Date.UTC(year, month - 1, 15));
  return `${lower ? name : `${name.charAt(0).toUpperCase()}${name.slice(1)}`} ${year}`;
}

/** Several reviews' names in one lookup (the waiting list spans months). */
export function mergeLookups(lookups) {
  const merged = { lookup: new Map(), transactions: new Map(), projects: new Map() };
  for (const names of lookups) {
    for (const [key, value] of names.lookup) merged.lookup.set(key, { ...(merged.lookup.get(key) ?? {}), ...value });
    for (const [key, value] of names.transactions) merged.transactions.set(key, value);
    for (const [key, value] of names.projects) merged.projects.set(key, value);
  }
  return merged;
}

export function instantText(value, t) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(t('_intl_locale'), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  });
}

export function dateText(value, t) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-').map(Number);
  return new Intl.DateTimeFormat(t('_intl_locale'), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(Date.UTC(year, month - 1, day));
}

export function relationTypeText(type, t) {
  return t(`aa_sr_rel_${type}`);
}

export function epistemicText(kind, t) {
  return t(kind === 'hypothesis' ? 'aa_sr_hypothesis' : 'aa_sr_association');
}

export { isHypothesis };

export function codeText(prefix, code, t) {
  const key = `aa_sr_${prefix}_${code}`;
  const text = t(key);
  return text === key ? String(code) : text;
}

/** Everything a ref key can be named by, gathered once per review. */
export function buildLookup(review, life) {
  const lookup = new Map();
  const transactions = new Map((life?.transactions ?? []).map(tx => [String(tx.id), tx]));
  const projects = new Map((life?.projects ?? []).map(project => [String(project.id), project]));
  for (const item of review?.sections?.changed?.items ?? []) lookup.set(item.ref, { item });
  for (const entry of review?.linkable ?? []) {
    lookup.set(entry.ref, { ...(lookup.get(entry.ref) ?? {}), entry });
  }
  for (const analysis of review?.sections?.consequences?.expenses ?? []) {
    lookup.set(analysis.ref, { ...(lookup.get(analysis.ref) ?? {}), analysis });
    lookup.set(analysis.context_ref, { ...(lookup.get(analysis.context_ref) ?? {}), expenseContext: analysis });
  }
  for (const obligation of review?.sections?.consequences?.position?.obligations ?? []) {
    lookup.set(obligation.ref, { ...(lookup.get(obligation.ref) ?? {}), obligation });
  }
  return { lookup, transactions, projects };
}

function changeLabel(kind, t) {
  return t(`aa_sr_kind_${kind}`);
}

/** A human name for a ref key. Unknown refs fall back to a neutral label, never the raw id. */
export function refText(ref, names, t) {
  if (!ref || ref === 'redacted') return t('aa_sr_source_deleted');
  const known = names?.lookup?.get(ref);
  const [head, ...rest] = ref.split('|');
  if (head === 'change') {
    const [kind, subjectKey, , period] = rest;
    if (kind.startsWith('project_')) {
      const projectId = subjectKey.split(':')[2];
      const title = names?.projects?.get(projectId)?.title;
      return `${changeLabel(kind, t)}${title ? ` · ${title}` : ''}`;
    }
    if (kind === 'experiment_lifecycle') {
      const title = known?.item?.details?.title;
      return title ? `${changeLabel(kind, t)} · ${title}` : changeLabel(kind, t);
    }
    return `${changeLabel(kind, t)} · ${periodTitle(period, t)}`;
  }
  if (head === 'subject') {
    const [domain, type, id] = rest.join('|').split(':');
    if (domain === 'finance' && type === 'transaction') {
      const tx = names?.transactions?.get(id);
      const amount = known?.analysis?.expense?.amount;
      const label = tx?.description || t('aa_sr_expense');
      return `${label}${amount ? ` · ${valueText(amount, t)}` : ''}`;
    }
    if (domain === 'project') return names?.projects?.get(id)?.title ?? t('aa_sr_project');
    if (domain === 'experiment') {
      return known?.entry?.details?.title ?? t('aa_sr_experiment');
    }
    return t('aa_sr_item');
  }
  if (head === 'fact') {
    const text = known?.item?.current?.value?.text;
    return text ? `${t('aa_sr_observation')} · ${text}` : t('aa_sr_observation');
  }
  if (head === 'context') {
    if (known?.obligation) return `${t('aa_sr_obligation')} · ${known.obligation.label ?? ''}`.trim();
    if (known?.expenseContext) return t('aa_sr_expense_self_report');
    return t('aa_sr_context');
  }
  return t('aa_sr_item');
}

/** The result of one impact as label/value lines — each in its own unit. */
export function impactLines(impact, t) {
  const result = impact?.result ?? {};
  const lines = [];
  const money = key => (result[key] ? valueText(result[key], t) : null);
  switch (impact?.kind) {
    case 'budget_deviation':
      if (result.target) lines.push([t('aa_sr_res_over_target'), signedMoney(result.over_target, t)]);
      if (result.expectation) lines.push([t('aa_sr_res_vs_expectation'), signedMoney(result.vs_expectation, t)]);
      lines.push([t('aa_sr_res_month_actual'), money('month_actual')]);
      break;
    case 'repeat_scenario':
      lines.push([t('aa_sr_res_monthly'), money('monthly')]);
      lines.push([t('aa_sr_res_twelve_months'), money('twelve_months')]);
      break;
    case 'debt_projection': {
      const projection = (label, entry) => {
        if (!entry) return;
        const text = entry.payoff_date ? dateText(entry.payoff_date, t) : t(`aa_sr_payoff_${entry.state}`);
        lines.push([label, text]);
      };
      projection(t('aa_sr_res_payoff_a'), result.a_as_entered);
      projection(t('aa_sr_res_payoff_b'), result.b_with_this_expense);
      projection(t('aa_sr_res_payoff_c'), result.c_if_repeated);
      if (result.delta_days_b != null) lines.push([t('aa_sr_res_shift_b'), daysText(result.delta_days_b, t)]);
      if (result.delta_days_c != null) lines.push([t('aa_sr_res_shift_c'), daysText(result.delta_days_c, t)]);
      break;
    }
    case 'reserve_projection':
      lines.push([t('aa_sr_res_reserve'), money('reserve')]);
      if (result.after_this_expense) lines.push([t('aa_sr_res_after'), money('after_this_expense')]);
      if (result.monthly_draw) lines.push([t('aa_sr_res_monthly_draw'), money('monthly_draw')]);
      if (result.months_until_threshold != null) {
        lines.push([t('aa_sr_res_months_to_threshold'), String(result.months_until_threshold)]);
      }
      break;
    case 'essentials_risk':
      lines.push([t('aa_sr_res_coverage_now'), t('aa_sr_months_value', result.coverage_months_now)]);
      lines.push([t('aa_sr_res_coverage_after'), t('aa_sr_months_value', result.coverage_months_after)]);
      break;
    default:
      break;
  }
  return lines.filter(([, value]) => value != null);
}

function signedMoney(value, t) {
  if (!value) return null;
  const number = Number(value.num);
  const text = valueText({ ...value, num: String(value.num).replace(/^-/, '') }, t);
  return `${number > 0 ? '+' : number < 0 ? '−' : ''}${text}`;
}

export function contextSummary(context, t) {
  const parts = [];
  if (context.plannedness) parts.push(codeText('plan', context.plannedness, t));
  if (context.funding_source) parts.push(codeText('fund', context.funding_source, t));
  if (context.expected_recurrence && context.expected_recurrence !== 'unknown') {
    parts.push(codeText('recur', context.expected_recurrence, t)
      + (context.recurrence_per_month ? ` · ${t('aa_sr_per_month', context.recurrence_per_month)}` : ''));
  }
  return parts.join(' · ');
}
