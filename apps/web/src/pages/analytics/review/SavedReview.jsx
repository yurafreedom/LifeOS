/* Review · a saved Review with its flags, notes, factors, decision and «дополнить». */

import React from 'react';
import AAFacts from '../../../components/analytics/AAFacts.jsx';
import AAFactorTag from '../../../components/analytics/AAFactorTag.jsx';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { itemsIn, reviewReviseRequest } from '../../../analytics/review';
import { choiceLabel, eyebrow, formatInstant } from './format.js';
import { ReviewEvidence, alongsideFacts } from './Evidence.jsx';
import { ChoiceList, FactorEditor } from './Flow.jsx';

/** A saved Review: frozen evidence with flags, everything the user wrote, and «дополнить». */
export function SavedReview({ review, projects, onRevise, narrow = false }) {
  const t = useAAText();
  const [note, setNote] = React.useState('');
  const [added, setAdded] = React.useState([]);
  const [retracted, setRetracted] = React.useState([]);
  const [decision, setDecision] = React.useState(undefined);
  const [message, setMessage] = React.useState(null);
  const noteId = React.useId();
  const current = review.factors.filter(factor => factor.retracted_in_revision == null && !retracted.includes(factor.id));
  const withdrawn = review.factors.filter(factor => factor.retracted_in_revision != null);
  const history = review.decisions.filter(row => row.superseded_in_revision != null);

  async function submit(event) {
    event.preventDefault();
    const request = reviewReviseRequest(review.id, { note, addFactors: added, retractFactorIds: retracted, decision });
    if (!request) { setMessage(t('aa_rv_revise_nothing')); return; }
    try {
      await onRevise(request);
      setNote(''); setAdded([]); setRetracted([]); setDecision(undefined);
      setMessage(t('aa_rv_revise_queued'));
    } catch {
      setMessage(t('aa_rv_save_failed'));
    }
  }

  return <div className="aa-col">
    <div className="aa-review-head">
      <div className="aa-eyebrow">{eyebrow(review.subject_key, t, projects)}</div>
      <span className="aa-quiet">
        {t('aa_rv_created', formatInstant(review.created_at, t))}
        {review.revised_at ? ` · ${t('aa_rv_revised', formatInstant(review.revised_at, t))}` : ''}
      </span>
    </div>
    <section className="aa-review-card" aria-labelledby="aa-rv-evidence">
      <h2 className="aa-q" id="aa-rv-evidence">{t('aa_rv_evidence')}</h2>
      <div className="aa-help">{t('aa_rv_frozen_note')}</div>
      <ReviewEvidence items={review.items} narrow={narrow} />
      {itemsIn(review.items, 'alongside').length ? <AAFacts facts={alongsideFacts(review.items, t)} narrow={narrow} /> : null}
    </section>
    <section className="aa-review-card" aria-labelledby="aa-rv-notes">
      <h3 className="aa-eyebrow aa-eyebrow-strong" id="aa-rv-notes">{t('aa_rv_notes')}</h3>
      {review.revisions.some(row => row.note_text)
        ? review.revisions.filter(row => row.note_text).map(row => <p key={row.revision} className="aa-factor-text">
          {row.revision > 1 ? <span className="aa-quiet">{t('aa_rv_revision_n', row.revision - 1)} · </span> : null}{row.note_text}
        </p>)
        : <p className="aa-quiet">{t('aa_rv_notes_none')}</p>}
    </section>
    <section className="aa-review-card" aria-labelledby="aa-rv-factors">
      <h3 className="aa-eyebrow aa-eyebrow-strong" id="aa-rv-factors">{t('aa_rv_factors')}</h3>
      {current.length || withdrawn.length ? null : <p className="aa-quiet">{t('aa_rv_factors_none')}</p>}
      {current.map(factor => <div className="aa-factor" key={factor.id}>
        <span className="aa-factor-text">{factor.text}</span>
        <AAFactorTag kind={factor.epistemic_kind}
          onChange={kind => {
            setRetracted(ids => [...ids, factor.id]);
            setAdded(list => [...list, { key: `re-${factor.id}`, text: factor.text, epistemic_kind: kind, replaces_id: factor.id }]);
          }}
          onRemove={() => setRetracted(ids => [...ids, factor.id])} />
      </div>)}
      {withdrawn.map(factor => <div className="aa-factor is-retracted" key={factor.id}>
        <span className="aa-factor-text">{factor.text} <span className="aa-quiet">· {t('aa_rv_retracted', factor.retracted_in_revision - 1)}</span></span>
        <AAFactorTag kind={factor.epistemic_kind} readOnly />
      </div>)}
    </section>
    <section className="aa-review-card" aria-labelledby="aa-rv-decision">
      <h3 className="aa-eyebrow aa-eyebrow-strong" id="aa-rv-decision">{t('aa_rv_decision')}</h3>
      <p className="aa-factor-text">{review.decision ? choiceLabel(review.decision.choice, t) : t('aa_rv_decision_skipped')}</p>
      {history.length ? <p className="aa-quiet">{t('aa_rv_decision_history', history.map(row => choiceLabel(row.choice, t)).join(' → '))}</p> : null}
    </section>
    <form className="aa-review-card" onSubmit={submit} aria-labelledby="aa-rv-revise">
      <h3 className="aa-q" id="aa-rv-revise">{t('aa_rv_revise_title')}</h3>
      <label className="aa-quiet" htmlFor={noteId}>{t('aa_rv_revise_note')}</label>
      <textarea id={noteId} className="aa-textarea" value={note} maxLength={4000} onChange={event => setNote(event.target.value)} />
      <FactorEditor factors={added.filter(factor => !factor.replaces_id)}
        onChange={list => setAdded([...added.filter(factor => factor.replaces_id), ...list])} idPrefix="add" />
      <ChoiceList value={decision} onChange={setDecision} allowUnchanged name="revise" />
      {message ? <p className="aa-quiet" role="status">{message}</p> : null}
      <div className="aa-actions"><span />
        <button type="submit" className="aa-btn aa-btn-primary">{t('aa_rv_revise_save')}</button>
      </div>
    </form>
  </div>;
}
