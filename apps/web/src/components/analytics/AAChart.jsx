import React from 'react';
import AAChartLayers from './AAChartLayers.jsx';
import { useAAText } from './useAAText.js';

export default function AAChart({ points = [], label }) {
  const t = useAAText();
  const width = 720;
  const height = 180;
  return <figure className="aa-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? t('aa_chart_label')}>
      <AAChartLayers points={points} width={width} height={height} padding={18} />
    </svg>
    {!points.length ? <figcaption>{t('aa_chart_empty')}</figcaption> : null}
  </figure>;
}
