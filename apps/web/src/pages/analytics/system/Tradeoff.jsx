/* J1 · Trade-off view — «что менялось одновременно». The same read model as the
   review, shown as juxtaposition: every change in its own unit, side by side,
   and contradictions kept as pairs. There is no overall number, and none will
   be added: unlike units do not add up. */

import React from 'react';
import { systemReviewHash } from '../../../analytics/systemReviewFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { ChangeCard, Empty, Section, TradeoffsSection } from './Sections.jsx';

export function TradeoffView({ review, names, pending, actions, onLink }) {
  const t = useAAText();
  const items = review.sections.changed.items;
  return <>
    <div className="aa-banner" role="note"><b>{t('aa_sr_no_score_title')}</b> {t('aa_sr_no_score_body')}</div>
    <Section id="sr-tradeoff-changes" title={t('aa_sr_tradeoff_title')}
      note={t('aa_sr_tradeoff_window', review.window_start, review.window_end)}>
      {items.length ? <div className="aa-changes">
        {items.map(item => <ChangeCard key={item.ref} item={item} names={names}
          importance={review.importance[item.ref]} pendingImportance={pending.importance[item.ref]}
          onImportance={actions.setImportance} onLink={onLink} />)}
      </div> : <Empty />}
    </Section>
    <TradeoffsSection review={review} names={names} />
    <div className="aa-actions">
      <span className="aa-quiet">{t('aa_sr_tradeoff_meaning')}</span>
      <a className="aa-btn aa-btn-ghost aa-sr-btn-link" href={`${systemReviewHash(review.period)}`}>{t('aa_sr_to_review')}</a>
    </div>
  </>;
}
