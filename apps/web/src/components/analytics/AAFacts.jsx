import React from 'react';
import { conceptLabel, epistemicLabel, formatFact } from '../../analytics/labels';
import { useAAText } from './useAAText.js';
import '../../analytics.css';

/** Layout reuse only. No delta/desire props and no comparison semantics. */
export default function AAFacts({ facts, narrow = false }) {
  const t = useAAText();
  return <div className={narrow ? 'aa-narrow' : undefined}><div className="aa-facts" role="group" aria-label={t('aa_pr_facts_group')}>
    {facts.map(fact => <div className={`aa-delta-cell${fact.value == null ? ' is-empty' : ''}`} key={fact.id}>
      <span className="aa-delta-lab">{fact.label ?? conceptLabel(fact.concept, t)}</span>
      <span className="aa-delta-val">{formatFact(fact, t)}</span>
      {fact.epistemic_kind ? <span className="aa-delta-sub">{epistemicLabel(fact.epistemic_kind, t)}</span> : null}
      {fact.note ? <span className="aa-delta-sub">{fact.note}</span> : null}
    </div>)}
  </div></div>;
}
