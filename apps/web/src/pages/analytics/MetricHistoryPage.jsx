import React from 'react';
import AAHistoryList from '../../components/analytics/AAHistoryList.jsx';
import AAQualityStrip from '../../components/analytics/AAQualityStrip.jsx';
import AAChart from '../../components/analytics/AAChart.jsx';
import { useAAText } from '../../components/analytics/useAAText.js';
import { PageHeader } from '../../components/HeroVignette.jsx';
import { useAnalytics } from '../../context/AnalyticsContext.jsx';

export default function MetricHistoryPage({ onBack }) {
  const { finance } = useAnalytics();
  const t = useAAText();
  const month = finance.data;
  if (!month) return <section className="card panel">История метрики пока недоступна.</section>;
  const facts = [...month.expectations, ...month.targets]
    .sort((left, right) => left.provenance.recorded_at.localeCompare(right.provenance.recorded_at));
  return <section className="fin-aa">
    <PageHeader
      title="История finance.monthly_spend"
      subtitle="Actual · Expectation · Target остаются отдельными слоями"
      aside={<button className="set-btn-ghost" type="button" onClick={onBack}>Назад</button>}
    />
    {month.retention_horizon ? <p className="aa-retention-note" role="note">
      {t('aa_ret_history_truncated', month.retention_horizon)}
    </p> : null}
    <div className="card panel"><AAChart points={month.series} /><AAQualityStrip coverage={month.coverage} /></div>
    <div className="card panel"><AAHistoryList facts={facts} /></div>
  </section>;
}
