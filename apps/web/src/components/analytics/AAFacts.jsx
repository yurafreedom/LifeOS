import React from 'react';
import { conceptLabel, epistemicLabel, formatFact } from '../../analytics/labels';
import '../../analytics.css';

/** Layout reuse only. No delta/desire props and no comparison semantics. */
export default function AAFacts({ facts, narrow = false }) {
  return <div className={narrow ? 'aa-narrow' : undefined}><div className="aa-facts" role="group" aria-label="Отдельные факты">
    {facts.map(fact => <div className={`aa-delta-cell${fact.value == null ? ' is-empty' : ''}`} key={fact.id}>
      <span className="aa-delta-lab">{conceptLabel(fact.concept)}</span>
      <span className="aa-delta-val">{formatFact(fact)}</span>
      {fact.epistemic_kind ? <span className="aa-delta-sub">{epistemicLabel(fact.epistemic_kind)}</span> : null}
    </div>)}
  </div></div>;
}
