/* System Review · «Ждёт вас». Two separate lists, never merged:
   «Ревью доступно» — concrete objects ready to be reviewed (an experiment
   awaiting its decision, an ended month or year without a finalized review);
   «Требует подтверждения» — the system's proposals still waiting for your answer. */

import React from 'react';
import { systemReviewHash } from '../../../analytics/systemReviewFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { periodTitle } from './format.js';
import { ProposalCard } from './Relations.jsx';
import { Section } from './Sections.jsx';

function availableHref(item) {
  if (item.kind === 'experiment') return `#/experiment/${item.experiment_id}`;
  return systemReviewHash(item.period);
}

function availableText(item, t) {
  if (item.kind === 'experiment') return t('aa_sr_wait_experiment', item.title);
  if (item.kind === 'annual_review') return t('aa_sr_wait_annual', item.period);
  return t('aa_sr_wait_monthly', periodTitle(item.period, t));
}

export function WaitingView({ waiting, error, pending, actions, names }) {
  const t = useAAText();
  if (!waiting) {
    return <section className="card panel" aria-busy={!error}>
      {error ? <p className="aa-none" role="alert">{t('aa_sr_unavailable')}</p> : <p className="aa-note">{t('aa_sr_loading')}</p>}
    </section>;
  }
  return <div className="aa-sr">
    <a className="aa-link" href={systemReviewHash()}>‹ {t('aa_sr_back_to_review')}</a>
    <Section id="sr-available" title={t('aa_sr_review_available', waiting.review_available.count)} note={t('aa_sr_review_available_note')}>
      {waiting.review_available.items.length ? <ul className="aa-review-list">
        {waiting.review_available.items.map(item => <li key={`${item.kind}-${item.period ?? item.experiment_id}`}>
          <a className="aa-exp-item-link" href={availableHref(item)}>
            <span className="aa-exp-item-title">{availableText(item, t)}</span>
            <span className="aa-quiet">{t(`aa_sr_wait_kind_${item.kind}`)}</span>
          </a>
        </li>)}
      </ul> : <p className="aa-none">{t('aa_sr_review_available_empty')}</p>}
    </Section>
    <Section id="sr-confirm" title={t('aa_sr_requires', waiting.requires_confirmation.count)}
      note={t('aa_sr_requires_horizon', waiting.requires_confirmation.horizon_months)}>
      {waiting.requires_confirmation.items.length ? <div className="aa-col">
        {waiting.requires_confirmation.items.map(candidate => <ProposalCard key={candidate.proposal_key}
          candidate={candidate} names={names} pending={pending} actions={actions} evaluatedAt={waiting.evaluated_at} />)}
      </div> : <p className="aa-none">{t('aa_sr_requires_empty')}</p>}
    </Section>
  </div>;
}
