import React from 'react';
import { LifeLocaleContext } from '../../context/LocaleContext.jsx';
import { ChartCard } from './ChartCard.jsx';

/* global React */
const { useState: useStTrend, useContext: useCtxTrend, useMemo: useMemoTrend } = React;

/* TrendChart — last 6 months, three series toggle (расходы / доходы / нетто).
   Native SVG only — no Recharts (per ARCHITECTURE.md locked decision).

   Series colors (stakes discipline, blues + neutral only):
     expenses → --blue
     income   → --blue-3 (blue-deep)
     net      → --fg3 (muted), thinner area (opacity 0.05)

   Big total = the LAST month of the selected series (NOT sum of 6).

   Empty states:
     · 0 months → empty CTA card
     · 1-2 months → render chart + muted footer
*/
function TrendChart({ data, onNav }) {
  const { t, locale } = useCtxTrend(LifeLocaleContext);
  const [series, setSeries] = useStTrend('expenses');
  const [hover, setHover] = useStTrend(null);

  /* ── 0-data empty state ───────────────────────────────── */
  if (!data || data.length === 0) {
    return (
      <ChartCard
        eyebrow={t('chart_trend_title')}
        total={null}>
        <div className="chart-empty">
          <div className="chart-empty-msg">{t('chart_empty_cat')}</div>
          <button className="chart-empty-cta mono"
                  onClick={() => onNav && onNav('finances')}>
            {t('chart_empty_trend_cta')}
          </button>
        </div>
      </ChartCard>
    );
  }

  /* ── value extraction per selected series ─────────────── */
  const valueOf = (m) => series === 'net' ? (m.income - m.expenses)
                      : series === 'income' ? m.income
                      : m.expenses;
  const values = data.map(valueOf);
  const lastVal = values[values.length - 1];

  /* For 1-2 months we still render the chart, but footer warns. */
  const partial = data.length < 3;

  /* ── scale: clamp Y to data range; net can go negative → include 0 */
  const minV = series === 'net' ? Math.min(0, ...values) : Math.min(...values);
  const maxV = Math.max(...values);
  const range = (maxV - minV) || 1;

  const W = 600, H = 220, padX = 28, padTop = 18, padBot = 32;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBot;
  const xAt = (i) => data.length === 1 ? W / 2 : padX + (innerW * i / (data.length - 1));
  const yAt = (v) => padTop + innerH - ((v - minV) / range) * innerH;

  const points = data.map((m, i) => `${xAt(i).toFixed(2)},${yAt(values[i]).toFixed(2)}`).join(' ');
  const baselineY = padTop + innerH;
  const areaPath = data.length === 1
    ? null
    : `M${xAt(0).toFixed(2)},${baselineY} ` +
      data.map((m, i) => `L${xAt(i).toFixed(2)},${yAt(values[i]).toFixed(2)}`).join(' ') +
      ` L${xAt(data.length - 1).toFixed(2)},${baselineY} Z`;

  const seriesClass = series === 'expenses' ? 'is-expenses'
                    : series === 'income'   ? 'is-income'
                    : 'is-net';

  const fmt = (n) => '$' + Math.round(n).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU');

  /* ── tooltip position (CSS %, scales with SVG aspect) ── */
  const tipLeftPct = hover != null ? (xAt(hover) / W) * 100 : 0;
  const tipTopPct  = hover != null ? (yAt(values[hover]) / H) * 100 : 0;

  return (
    <ChartCard
      eyebrow={t('chart_trend_title')}
      total={fmt(lastVal)}
      controls={
        <div className="chart-segctrl">
          {[
            { id: 'expenses', label: t('chart_toggle_expenses') },
            { id: 'income',   label: t('chart_toggle_income') },
            { id: 'net',      label: t('chart_toggle_net') },
          ].map(seg => (
            <button key={seg.id}
                    type="button"
                    className={"chart-segctrl-btn mono" + (series === seg.id ? ' is-on' : '')}
                    onClick={() => setSeries(seg.id)}>
              {seg.label}
            </button>
          ))}
        </div>
      }
      footer={partial ? t('chart_empty_trend') : null}>
      <div className={"trend-chart " + seriesClass}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="trend-svg">
          {areaPath && <path d={areaPath} className="trend-area" />}
          <polyline points={points} className="trend-line" />
          {data.map((m, i) => (
            <circle key={'d' + i}
                    cx={xAt(i)} cy={yAt(values[i])} r={hover === i ? 4 : 2.5}
                    className={"trend-dot" + (hover === i ? ' is-hov' : '')} />
          ))}
          {data.map((m, i) => (
            <text key={'l' + i}
                  x={xAt(i)} y={H - 8}
                  className="trend-xlabel mono"
                  textAnchor="middle">
              {m['label_' + locale] || m.label_ru}
            </text>
          ))}
          {/* invisible hit areas — wider than dots so hover is forgiving */}
          {data.map((m, i) => {
            const halfStep = innerW / Math.max(1, (data.length - 1)) / 2;
            return (
              <rect key={'h' + i}
                    x={xAt(i) - halfStep} y={0}
                    width={halfStep * 2} height={H - padBot + 8}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)} />
            );
          })}
        </svg>
        {hover != null && (
          <div className="trend-tooltip mono"
               style={{ left: tipLeftPct + '%', top: tipTopPct + '%' }}>
            <span className="trend-tooltip-label">
              {(data[hover]['label_' + locale] || data[hover].label_ru)}
            </span>
            <span className="trend-tooltip-val">{fmt(values[hover])}</span>
          </div>
        )}
      </div>
    </ChartCard>
  );
}

export { TrendChart };
