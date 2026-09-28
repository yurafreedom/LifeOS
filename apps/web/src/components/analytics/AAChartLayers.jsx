import React from 'react';

export default function AAChartLayers({ points, width, height, padding }) {
  if (!points.length) return null;
  const values = points.map(point => Number(point.amount));
  const max = Math.max(...values, 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth),
    y: padding + innerHeight - (Number(point.amount) / max) * innerHeight,
  }));
  const polyline = coordinates.map(point => `${point.x},${point.y}`).join(' ');
  return <g>
    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" opacity="0.18" />
    <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="2" />
    {coordinates.map(point => <circle key={point.date} cx={point.x} cy={point.y} r="3">
      <title>{`${point.date}: ₴${point.amount}`}</title>
    </circle>)}
  </g>;
}
