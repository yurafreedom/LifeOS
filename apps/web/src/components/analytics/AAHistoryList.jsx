import React from 'react';
import { conceptLabel, formatFact } from '../../analytics/labels';
import AAProvenance from './AAProvenance';
import '../../analytics.css';

export default function AAHistoryList({ facts, narrow = false }) {
  const byId = new Map(facts.map(fact => [fact.id, fact]));
  return <div className={narrow ? 'aa-narrow' : undefined}><ol className="aa-hist" aria-label="Семантическая история">
    {facts.map(fact => {
      const prior = byId.get(fact.supersedes_id);
      return <li className="aa-hist-row" key={fact.id}>
        <time className="aa-hist-when" dateTime={fact.provenance.recorded_at}>{fact.provenance.recorded_at}</time>
        <div className="aa-hist-what">{conceptLabel(fact.concept)} · {formatFact(fact)}
          {prior ? <span> · {fact.supersede_kind === 'CORRECTION' || prior.supersede_kind === 'CORRECTION' ? 'исправление' : 'новая версия'}: {formatFact(prior)} → {formatFact(fact)}</span> : null}
          {fact.effective_from ? <span> · действует с {fact.effective_from}</span> : null}
          {fact.horizon_at ? <span> · проверяется {fact.horizon_at}</span> : null}
        </div><AAProvenance provenance={fact.provenance} narrow={narrow} />
      </li>;
    })}
  </ol></div>;
}
