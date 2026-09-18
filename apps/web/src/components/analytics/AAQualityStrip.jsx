import React from 'react';
import '../../analytics.css';

export default function AAQualityStrip({ coverage }) {
  if (!coverage) return <div className="aa-quality">покрытие неизвестно</div>;
  const buckets = [['полностью наблюдалось', coverage.observed_count], ['частично', coverage.partial_count],
    ['не наблюдалось', coverage.missing_count], ['покрытие неизвестно', coverage.unknown_coverage_count], ['будущие дни', coverage.future_count]];
  return <details className="aa-quality">
    <summary className="aa-quality-item">покрытие: <b>{coverage.observed_count} из {coverage.expected_denominator}</b>
      {coverage.partial_count ? ' · частичные данные' : ''}
      {coverage.has_legacy_imports ? ' · часть данных импортирована · момент записи неизвестен' : ''}
    </summary>
    <dl className="aa-quality-detail">{buckets.map(([key, value]) => <div className="aa-prov-row" key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
      <div className="aa-prov-row"><dt>оценочные</dt><dd>{coverage.estimated_count}</dd></div>
      <div className="aa-prov-row"><dt>исправленные</dt><dd>{coverage.corrected_count}</dd></div>
    </dl>
  </details>;
}
