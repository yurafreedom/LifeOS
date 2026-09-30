/* Review · pure formatting and labelling helpers shared by the evidence,
   flow and saved-review views. */

import { compareModel, coverageFromItems, subjectFromKey } from '../../../analytics/review';
import { formatValue } from '../../../analytics/values';

const CONCEPT_OF_ROLE = { expected: 'expectation', forecast: 'forecast', actual: 'actual', observation: 'observation', target: 'target' };

const CHOICE_KEYS = { keep: 'aa_rv_choice_keep', adjust: 'aa_rv_choice_adjust', later: 'aa_rv_choice_later', inconclusive: 'aa_rv_choice_inconclusive' };

function formatInstant(value, t) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(t('_intl_locale'), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
  });
}

function choiceLabel(choice, t) {
  return choice == null ? t('aa_rv_choice_none') : t(CHOICE_KEYS[choice]);
}

/** Slice 8: the user's retention rule and a manual hard delete read apart. */
export function sourceDeletedKey(item) {
  return item?.redaction_reason === 'source_retention_pruned'
    ? 'aa_pr_source_deleted_retention' : 'aa_pr_source_deleted';
}

/** A flag shown beside a frozen value — never a substitute for it. */
export function flagText(item, t) {
  if (!item || item.redacted) return null;
  const now = item.current_value ? t('aa_rv_now', formatValue(item.current_value, t)) : null;
  const flags = item.source_flags ?? [];
  if (flags.includes('corrected')) return [t('aa_rv_flag_corrected'), now].filter(Boolean).join(' · ');
  if (flags.includes('withdrawn')) return t('aa_rv_flag_withdrawn');
  if (flags.includes('revised')) return [t('aa_rv_flag_revised'), now].filter(Boolean).join(' · ');
  return null;
}

function cellNote(item, t) {
  if (!item) return {};
  if (item.redacted) return { value: t(sourceDeletedKey(item)), empty: true, sub: null, estimate: false };
  const extra = flagText(item, t);
  return { ...(item.estimate ? { estimate: true } : {}), ...(extra ? { extra } : {}) };
}

/** The compare section, mapped onto the operands `AADelta` already understands. */
export function deltaProps(items, t) {
  const { reference, current, delta, target } = compareModel(items);
  const referenceConcept = reference?.role === 'forecast' ? 'forecast' : 'expectation';
  const coverage = coverageFromItems(items);
  const grounded = target != null && target.availability === 'present' && !target.redacted;
  const deltaValue = delta?.availability === 'present' && delta.value
    ? { state: 'known', type: delta.value.type, num: delta.value.num, unit_code: delta.value.unit_code,
      scale_min: delta.value.scale_min, scale_max: delta.value.scale_max }
    : {
      state: delta?.availability === 'not_applicable' ? 'not_applicable' : 'unknown',
      reason: delta?.availability === 'insufficient_data' ? 'insufficient_data' : 'operand_absent',
    };
  const summary = {
    actual: current?.value ? [{ id: 'current', value: current.value }] : [],
    expectations: referenceConcept === 'expectation' && reference?.value ? [{ id: 'reference', value: reference.value }] : [],
    forecasts: referenceConcept === 'forecast' && reference?.value ? [{ id: 'reference', value: reference.value }] : [],
    targets: target && !target.redacted
      ? [{ metric_key: target.metric_key, is_explicitly_absent: target.availability === 'explicitly_absent' }]
      : [],
  };
  const comparison = {
    metric_key: current?.metric_key ?? reference?.metric_key ?? null,
    current_concept: 'actual',
    current_id: 'current',
    reference_concept: referenceConcept,
    reference_id: 'reference',
    availability: current?.availability === 'insufficient_data' ? 'insufficient_data' : 'present',
    delta: deltaValue,
    desire: delta?.desire ?? 'neutral',
    grounding_id: grounded ? 'target' : null,
    grounding_kind: grounded ? 'target' : null,
    coverage: coverage && coverage !== 'redacted' ? coverage : null,
  };
  const notes = {
    reference: {
      ...(reference?.role === 'forecast' ? { label: t('aa_rv_label_forecast_latest') } : {}),
      ...cellNote(reference, t),
    },
    current: cellNote(current, t),
    delta: cellNote(delta, t),
  };
  return { summary, comparison, notes };
}

function provenanceLabel(item, t) {
  if (item.label_key === 'forecast_latest') return t('aa_rv_label_forecast_latest');
  if (item.role === 'delta') return t('aa_pr_delta');
  return t(`aa_pr_${CONCEPT_OF_ROLE[item.role] ?? 'actual'}`);
}

function eyebrow(subjectKey, t, projects) {
  const subject = subjectFromKey(subjectKey);
  if (subject.domain === 'finance') return t('aa_rv_eyebrow_finance', subject.id);
  const title = projects?.find(project => String(project.id) === subject.id)?.title;
  return t('aa_rv_eyebrow_project', title ?? '');
}

export { CONCEPT_OF_ROLE, CHOICE_KEYS, formatInstant, choiceLabel, cellNote, provenanceLabel, eyebrow };
