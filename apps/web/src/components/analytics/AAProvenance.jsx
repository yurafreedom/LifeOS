import React, { useId, useRef, useState } from 'react';
import { useAAText } from './useAAText.js';
import '../../analytics.css';

/** Native disclosure is keyboard-accessible and does not need document listeners. */
export default function AAProvenance({ provenance, narrow = false }) {
  const t = useAAText();
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const rows = [[t('aa_pr_prov_source'), provenance.source_kind], [t('aa_pr_prov_basis'), provenance.basis || t('aa_pr_prov_unspecified')],
    [t('aa_pr_prov_when'), `${provenance.recorded_at}${provenance.original_recorded_at_known ? '' : t('aa_pr_prov_recorded_unknown')}`],
    [t('aa_pr_prov_how'), provenance.method || t('aa_pr_prov_unspecified')]];
  return <details open={open} className={`aa-prov${narrow ? ' aa-prov-narrow' : ''}`} onToggle={event => setOpen(event.currentTarget.open)} onKeyDown={event => { if (event.key === 'Escape') close(); }}>
    <summary ref={trigger} className={`aa-prov-chip${open ? ' is-open' : ''}`} aria-controls={id}>{t('aa_pr_prov_chip')}</summary>
    {narrow && open ? <button type="button" className="aa-sheet-scrim" aria-label={t('aa_pr_prov_close_label')} onClick={close} /> : null}
    <div id={id} className="aa-prov-pop">{narrow ? <div className="aa-sheet-title">{t('aa_pr_prov_title')} <button type="button" className="aa-prov-chip" onClick={close}>{t('aa_pr_prov_close')}</button></div> : null}<dl className="aa-prov-fields">{rows.map(([key, value]) => <div className="aa-prov-row" key={key}>
      <dt className="aa-prov-key">{key}</dt><dd className="aa-prov-v">{value}</dd>
    </div>)}</dl></div>
  </details>;
}
