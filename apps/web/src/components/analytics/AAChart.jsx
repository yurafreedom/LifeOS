import React from 'react';
import AAChartLayers from './AAChartLayers.jsx';

export default function AAChart({ points = [], label = 'Динамика фактических операций' }) {
  const width = 720;
  const height = 180;
  return <figure className="aa-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <AAChartLayers points={points} width={width} height={height} padding={18} />
    </svg>
    {!points.length ? <figcaption>Нет фактических операций за период.</figcaption> : null}
  </figure>;
}
