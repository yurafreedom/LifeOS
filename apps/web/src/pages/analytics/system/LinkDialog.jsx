/* System Review · «Связать»: the user links two items they see as connected.
   The default is a plain association («связано»). A `may_*` type is always
   labelled as a hypothesis. There is no causal option to choose. */

import React from 'react';
import {
  RELATION_TYPES,
  isHypothesis,
  relationCreateRequest,
} from '../../../analytics/systemReviewFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { useDialog } from '../../../components/useDialog.js';
import { refText, relationTypeText } from './format.js';

export function LinkDialog({ from, review, names, onClose, onSave, busy = false }) {
  const t = useAAText();
  const dialogRef = React.useRef(null);
  const titleId = React.useId();
  useDialog(dialogRef, { onClose });
  const targets = (review?.linkable ?? []).filter(entry => entry.ref !== from);
  const [to, setTo] = React.useState(targets[0]?.ref ?? '');
  const [type, setType] = React.useState('related');
  const [note, setNote] = React.useState('');
  const hypothesis = isHypothesis(type);

  function save(event) {
    event.preventDefault();
    if (!to) return;
    onSave(relationCreateRequest({
      fromKey: from, toKey: to, relationType: type, note,
      period: review?.period ?? null,
    }));
  }

  return <div className="aa-exp-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="aa-exp-dialog aa-sr-link-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
      ref={dialogRef} onSubmit={save}>
      <h3 className="panel-title" id={titleId}>{t('aa_sr_link_title')}</h3>
      <p className="aa-sr-text"><b>{refText(from, names, t)}</b></p>
      {targets.length ? <>
        <label className="aa-field">
          <span className="aa-quiet">{t('aa_sr_link_with')}</span>
          <select className="aa-input" value={to} onChange={event => setTo(event.target.value)}>
            {targets.map(entry => <option key={entry.ref} value={entry.ref}>{refText(entry.ref, names, t)}</option>)}
          </select>
        </label>
        <label className="aa-field">
          <span className="aa-quiet">{t('aa_sr_link_type')}</span>
          <select className="aa-input" value={type} onChange={event => setType(event.target.value)}>
            {RELATION_TYPES.map(option => <option key={option} value={option}>
              {relationTypeText(option, t)}{isHypothesis(option) ? ` · ${t('aa_sr_hypothesis')}` : ''}
            </option>)}
          </select>
        </label>
        <p className={`aa-quiet aa-sr-link-kind${hypothesis ? ' is-hypothesis' : ''}`}>
          {t(hypothesis ? 'aa_sr_link_is_hypothesis' : 'aa_sr_link_is_association')}
        </p>
        <label className="aa-field">
          <span className="aa-quiet">{t('aa_sr_note_optional')}</span>
          <textarea className="aa-textarea" maxLength={1000} value={note}
            placeholder={t('aa_sr_note_placeholder')} onChange={event => setNote(event.target.value)} />
        </label>
      </> : <p className="aa-none">{t('aa_sr_link_nothing')}</p>}
      <div className="aa-actions">
        <span className="aa-quiet">{t('aa_sr_link_not_cause')}</span>
        <span className="aa-actions-right">
          <button type="button" className="aa-btn aa-btn-ghost" onClick={onClose}>{t('aa_sr_cancel')}</button>
          <button type="submit" className="aa-btn aa-btn-primary" disabled={!to || busy}>{t('aa_sr_link_save')}</button>
        </span>
      </div>
    </form>
  </div>;
}
