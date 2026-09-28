import React from 'react';
import { conceptLabel, formatFact } from '../../analytics/labels';
import { useAAText } from './useAAText.js';
import AAProvenance from './AAProvenance';
import '../../analytics.css';

export default function AAHistoryList({ facts, narrow = false }) {
  const t = useAAText();
  const byId = new Map(facts.map(fact => [fact.id, fact]));
  return <div className={narrow ? 'aa-narrow' : undefined}><ol className="aa-hist" aria-label={t('aa_pr_history_group')}>
    {facts.map(fact => {
      const prior = byId.get(fact.supersedes_id);
      return <li className="aa-hist-row" key={fact.id}>
        <time className="aa-hist-when" dateTime={fact.provenance.recorded_at}>{fact.provenance.recorded_at}</time>
        <div className="aa-hist-what">{fact.label ?? conceptLabel(fact.concept, t)} · {formatFact(fact, t)}
          {prior ? <span> · {t(fact.supersede_kind === 'CORRECTION' || prior.supersede_kind === 'CORRECTION' ? 'aa_pr_correction' : 'aa_pr_new_version')}: {formatFact(prior, t)} → {formatFact(fact, t)}</span> : null}
          {fact.effective_from ? <span> · {t('aa_pr_effective_from', fact.effective_from)}</span> : null}
          {fact.horizon_at ? <span> · {t('aa_pr_checkable_at', fact.horizon_at)}</span> : null}
        </div><AAProvenance provenance={fact.provenance} narrow={narrow} />
      </li>;
    })}
  </ol></div>;
}
