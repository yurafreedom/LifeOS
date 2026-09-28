import React from 'react';
import { useAAText } from './useAAText.js';
import '../../analytics.css';

export default function AAQualityStrip({ coverage }) {
  const t = useAAText();
  if (!coverage) return <div className="aa-quality">{t('aa_pr_q_unknown')}</div>;
  const buckets = [['aa_pr_q_observed', coverage.observed_count], ['aa_pr_q_partial_b', coverage.partial_count],
    ['aa_pr_q_missing', coverage.missing_count], ['aa_pr_q_unknown', coverage.unknown_coverage_count], ['aa_pr_q_future', coverage.future_count]];
  return <details className="aa-quality">
    <summary className="aa-quality-item">{t('aa_pr_q_coverage')}: <b>{t('aa_pr_q_of', coverage.observed_count, coverage.expected_denominator)}</b>
      {coverage.partial_count ? t('aa_pr_q_partial') : ''}
      {coverage.has_legacy_imports ? t('aa_pr_q_legacy') : ''}
    </summary>
    <dl className="aa-quality-detail">{buckets.map(([key, value]) => <div className="aa-prov-row" key={key}><dt>{t(key)}</dt><dd>{value}</dd></div>)}
      <div className="aa-prov-row"><dt>{t('aa_pr_q_estimated')}</dt><dd>{coverage.estimated_count}</dd></div>
      <div className="aa-prov-row"><dt>{t('aa_pr_q_corrected')}</dt><dd>{coverage.corrected_count}</dd></div>
    </dl>
  </details>;
}
