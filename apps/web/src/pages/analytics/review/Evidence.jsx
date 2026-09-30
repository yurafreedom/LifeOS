/* Review · the frozen evidence: compare section, alongside facts and the
   evidence history list. */

import React from 'react';
import AADelta from '../../../components/analytics/AADelta.jsx';
import AAFacts from '../../../components/analytics/AAFacts.jsx';
import AAProvenance from '../../../components/analytics/AAProvenance.jsx';
import AAQualityStrip from '../../../components/analytics/AAQualityStrip.jsx';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { coverageFromItems, itemsIn } from '../../../analytics/review';
import { CONCEPT_OF_ROLE, deltaProps, flagText, formatInstant, provenanceLabel } from './format.js';

/** Step 1 and the reopened Review share one rendering of the frozen evidence. */
export function ReviewEvidence({ items, narrow = false }) {
  const t = useAAText();
  const { summary, comparison, notes } = deltaProps(items, t);
  const coverage = coverageFromItems(items);
  const sourced = itemsIn(items, 'compare').filter(item => item.provenance && !item.redacted);
  return <div className="aa-col">
    <AADelta summary={summary} comparison={comparison} narrow={narrow} notes={notes} />
    {sourced.length ? <div className="aa-review-sources">
      {sourced.map(item => <span className="aa-review-source" key={item.ordinal}>
        {provenanceLabel(item, t)}<AAProvenance provenance={item.provenance} narrow={narrow} />
      </span>)}
    </div> : null}
    {coverage === 'redacted'
      ? <p className="aa-flag aa-flag-erased">{t('aa_rv_quality_deleted')}</p>
      : coverage ? <AAQualityStrip coverage={coverage} /> : null}
  </div>;
}

function alongsideFacts(items, t) {
  return itemsIn(items, 'alongside').map(item => ({
    id: `item-${item.ordinal}`,
    concept: CONCEPT_OF_ROLE[item.role] ?? 'observation',
    value: item.value,
    value_availability: item.availability === 'explicitly_unknown' ? 'explicitly_unknown' : null,
    epistemic_kind: item.epistemic_kind,
    redacted: item.redacted,
    redaction_reason: item.redaction_reason,
    note: flagText(item, t),
  }));
}

function Alongside({ items, narrow }) {
  const t = useAAText();
  const facts = alongsideFacts(items, t);
  return <div className="aa-col">
    {facts.length ? <AAFacts facts={facts} narrow={narrow} /> : <div className="aa-none">{t('aa_rv_alongside_none')}</div>}
    <div className="aa-quiet">{t('aa_rv_worth_it')}</div>
  </div>;
}

function evidenceHistory(items, t) {
  return items
    .filter(item => item.section !== 'quality' && item.provenance && !item.redacted && item.provenance.recorded_at)
    .map(item => ({
      id: `item-${item.ordinal}`,
      concept: CONCEPT_OF_ROLE[item.role] ?? 'actual',
      label: provenanceLabel(item, t),
      value: item.value,
      is_explicitly_absent: item.availability === 'explicitly_absent',
      value_availability: item.availability === 'explicitly_unknown' ? 'explicitly_unknown' : null,
      provenance: { ...item.provenance, recorded_at: formatInstant(item.provenance.recorded_at, t) },
    }));
}

export { alongsideFacts, Alongside, evidenceHistory };
