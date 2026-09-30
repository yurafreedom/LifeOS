import React from 'react';
import AAHistoryList from '../../components/analytics/AAHistoryList.jsx';
import AAQualityStrip from '../../components/analytics/AAQualityStrip.jsx';
import AAChart from '../../components/analytics/AAChart.jsx';
import { useAAText } from '../../components/analytics/useAAText.js';
import { PageHeader } from '../../components/HeroVignette.jsx';
import { useAnalytics } from '../../context/AnalyticsContext.jsx';
import { formatDateOnly } from '../../analytics/projectAnalytics';

const METRIC_KEY = 'finance.monthly_spend';

/* A cold entry (direct link or reload) has no month yet: it is loaded through the
   shared AnalyticsContext loader. A month already loaded by Finance analytics is
   reused, and a load already in flight is not repeated. A failed load waits for
   the explicit retry instead of looping. */
export function needsFinanceLoad({ ready, finance }) {
  return Boolean(ready) && !finance.data && !finance.loading && !finance.error;
}

export function metricHistoryView({ finance }) {
  const month = finance.data;
  if (month) {
    const empty = !month.series?.length && !month.expectations?.length && !month.targets?.length;
    return empty ? 'empty' : 'history';
  }
  if (finance.error) return 'error';
  // Not ready yet, loading, or about to load on this cold entry.
  return 'loading';
}

export default function MetricHistoryPage({ onBack }) {
  const analytics = useAnalytics();
  const { finance, ready } = analytics;
  const t = useAAText();
  const locale = t('_intl_locale');

  React.useEffect(() => {
    if (!needsFinanceLoad({ ready, finance })) return undefined;
    const controller = new window.AbortController();
    void analytics.loadFinance(analytics.currentPeriod(), controller.signal).catch(() => undefined);
    return () => controller.abort();
    /* Re-evaluated whenever the shared state settles: a read that was in flight
       on mount but then aborted elsewhere (Finance analytics unmounting) leaves
       `loading` false with no data, and this page must then load it itself. */
  }, [ready, finance.loading, !!finance.data, !!finance.error]);

  const view = metricHistoryView({ finance });
  const month = finance.data;
  /* The metric id stays verbatim; <wbr> lets it wrap after the dot on a phone
     instead of being clipped inside the hero. */
  const [titleBefore, titleAfter = ''] = t('aa_mh_title', '\u0000').split('\u0000');
  const [idDomain, idName] = METRIC_KEY.split('.');
  const header = <PageHeader
    title={<>{titleBefore}{idDomain}.<wbr />{idName}{titleAfter}</>}
    subtitle={t('aa_mh_subtitle')}
    aside={<button className="set-btn-ghost" type="button" onClick={onBack}>{t('aa_mh_back')}</button>}
  />;

  if (view === 'loading') {
    return <section className="fin-aa">{header}
      <section className="card panel" aria-busy="true"><p className="aa-note" role="status">{t('aa_mh_loading')}</p></section>
    </section>;
  }
  if (view === 'error') {
    return <section className="fin-aa">{header}
      <section className="card panel">
        <p className="aa-none" role="alert">{t('aa_mh_error')}</p>
        <button className="set-btn-ghost" type="button"
          onClick={() => { void analytics.loadFinance(analytics.currentPeriod()).catch(() => undefined); }}>
          {t('aa_mh_retry')}
        </button>
      </section>
    </section>;
  }

  const facts = [...month.expectations, ...month.targets]
    .sort((left, right) => left.provenance.recorded_at.localeCompare(right.provenance.recorded_at));
  return <section className="fin-aa">
    {header}
    {month.retention_horizon ? <p className="aa-retention-note" role="note">
      {t('aa_ret_history_truncated', formatDateOnly(month.retention_horizon, locale))}
    </p> : null}
    {view === 'empty'
      ? <div className="card panel"><p className="aa-none">{t('aa_mh_empty')}</p><AAQualityStrip coverage={month.coverage} /></div>
      : <>
        <div className="card panel"><AAChart points={month.series} /><AAQualityStrip coverage={month.coverage} /></div>
        <div className="card panel">
          {facts.length ? <AAHistoryList facts={facts} /> : <p className="aa-none">{t('aa_mh_no_facts')}</p>}
        </div>
      </>}
  </section>;
}
