import React from 'react';
import { formatDelta } from '../../analytics/delta';
import { formatValue } from '../../analytics/values';
import { useAAText } from './useAAText.js';
import '../../analytics.css';

const layerNames = { actual: 'actual', forecast: 'forecasts', observation: 'observations', expectation: 'expectations', baseline: 'baselines' };
const labelKeys = { actual: 'aa_pr_actual', forecast: 'aa_pr_forecast', observation: 'aa_pr_observation', expectation: 'aa_pr_expectation', baseline: 'aa_pr_baseline' };

/**
 * API IDs select the operands; a forecast can never silently acquire an Actual label.
 *
 * `notes` annotates a cell (`reference`, `current`, `delta`) without changing
 * which operand it shows — Review uses it for «источник удалён» and for later
 * correction flags *beside* a frozen value. `extra` is appended to the cell's
 * own sub-line; any other key replaces the matching cell field.
 */
export default function AADelta({ summary, comparison, narrow = false, notes = {} }) {
  const t = useAAText();
  const current = summary[layerNames[comparison.current_concept]]?.find(row => row.id === comparison.current_id);
  const reference = summary[layerNames[comparison.reference_concept]]?.find(row => row.id === comparison.reference_id);
  const partial = comparison.availability === 'insufficient_data';
  const estimated = comparison.current_concept === 'forecast' || partial;
  const grounded = comparison.grounding_id && ['target', 'preference', 'decision'].includes(comparison.grounding_kind);
  const desire = comparison.delta.state === 'unknown' ? 'unknown' : grounded ? comparison.desire : 'neutral';
  const targetAbsent = summary.targets?.some(row => row.metric_key === comparison.metric_key && row.is_explicitly_absent);
  const coverage = comparison.coverage;
  const values = [
    { key: 'reference', label: t(labelKeys[comparison.reference_concept] || 'aa_pr_expectation'),
      value: reference?.value ? formatValue(reference.value, t) : '—', sub: reference ? null : t('aa_pr_not_set'), empty: !reference?.value },
    { key: 'current', label: t(labelKeys[comparison.current_concept] || 'aa_pr_actual'), value: formatValue(current?.value, t), empty: !current?.value, estimate: estimated,
      sub: coverage ? `${partial ? t('aa_pr_counting') : ''}${t('aa_pr_coverage_days', coverage.observed_count, coverage.expected_denominator)}` : null },
    { key: 'delta', label: t('aa_pr_delta'), value: formatDelta(comparison.delta, reference?.value?.type === 'date', t), delta: true,
      sub: targetAbsent ? t('aa_pr_target_absent') : grounded ? t(comparison.grounding_kind === 'target' ? 'aa_pr_by_target' : 'aa_pr_by_preference') : comparison.delta.state === 'known' ? t('aa_pr_desire_undefined') : null },
  ].map(cell => {
    const { extra, ...note } = notes[cell.key] || {};
    const merged = { ...cell, ...note };
    return extra ? { ...merged, sub: [merged.sub, extra].filter(Boolean).join(' · ') } : merged;
  });
  return <div className={narrow ? 'aa-narrow' : undefined}><div className="aa-delta" role="group" aria-label={t('aa_pr_compare_group')}>
    {values.map(cell => <div key={cell.key} className={`aa-delta-cell${cell.delta ? ' is-delta' : ''}${cell.estimate ? ' is-estimate' : ''}${cell.empty ? ' is-empty' : ''}`} data-desire={cell.delta ? desire : undefined}>
      <span className="aa-delta-lab">{cell.label}</span><span className="aa-delta-val">{cell.value}</span>
      {cell.sub ? <span className="aa-delta-sub">{cell.sub}</span> : null}
    </div>)}
  </div></div>;
}
