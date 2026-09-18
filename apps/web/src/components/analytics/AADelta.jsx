import React from 'react';
import { formatDelta } from '../../analytics/delta';
import { formatValue } from '../../analytics/values';
import '../../analytics.css';

const layerNames = { actual: 'actual', forecast: 'forecasts', observation: 'observations', expectation: 'expectations', baseline: 'baselines' };
const labels = { actual: 'факт', forecast: 'прогноз', observation: 'наблюдение', expectation: 'ожидалось', baseline: 'типично' };

/** API IDs select the operands; a forecast can never silently acquire an Actual label. */
export default function AADelta({ summary, comparison, narrow = false }) {
  const current = summary[layerNames[comparison.current_concept]]?.find(row => row.id === comparison.current_id);
  const reference = summary[layerNames[comparison.reference_concept]]?.find(row => row.id === comparison.reference_id);
  const partial = comparison.availability === 'insufficient_data';
  const estimated = comparison.current_concept === 'forecast' || partial;
  const grounded = comparison.grounding_id && ['target', 'preference', 'decision'].includes(comparison.grounding_kind);
  const desire = comparison.delta.state === 'unknown' ? 'unknown' : grounded ? comparison.desire : 'neutral';
  const targetAbsent = summary.targets?.some(row => row.metric_key === comparison.metric_key && row.is_explicitly_absent);
  const coverage = comparison.coverage;
  const values = [
    { label: labels[comparison.reference_concept] || 'ожидалось', value: reference?.value ? formatValue(reference.value) : '—', sub: reference ? null : 'не задавалось', empty: !reference?.value },
    { label: labels[comparison.current_concept] || 'факт', value: formatValue(current?.value), empty: !current?.value, estimate: estimated,
      sub: coverage ? `${partial ? 'ещё считается · ' : ''}${coverage.observed_count} из ${coverage.expected_denominator} дня` : null },
    { label: 'разница', value: formatDelta(comparison.delta, reference?.value?.type === 'date'), delta: true,
      sub: targetAbsent ? 'цель не задавалась' : grounded ? `по вашему ${comparison.grounding_kind === 'target' ? 'целевому значению' : 'ориентиру'}` : comparison.delta.state === 'known' ? 'желательность не определена' : null },
  ];
  return <div className={narrow ? 'aa-narrow' : undefined}><div className="aa-delta" role="group" aria-label="Сравнение">
    {values.map(cell => <div key={cell.label} className={`aa-delta-cell${cell.delta ? ' is-delta' : ''}${cell.estimate ? ' is-estimate' : ''}${cell.empty ? ' is-empty' : ''}`} data-desire={cell.delta ? desire : undefined}>
      <span className="aa-delta-lab">{cell.label}</span><span className="aa-delta-val">{cell.value}</span>
      {cell.sub ? <span className="aa-delta-sub">{cell.sub}</span> : null}
    </div>)}
  </div></div>;
}
