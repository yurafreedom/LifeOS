import React, { useId, useRef, useState } from 'react';
import '../../analytics.css';

/** Native disclosure is keyboard-accessible and does not need document listeners. */
export default function AAProvenance({ provenance, narrow = false }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const rows = [['источник', provenance.source_kind], ['основание', provenance.basis || 'не указано'],
    ['когда', `${provenance.recorded_at}${provenance.original_recorded_at_known ? '' : ' · момент первоначальной записи неизвестен'}`],
    ['как', provenance.method || 'не указано']];
  return <details open={open} className={`aa-prov${narrow ? ' aa-prov-narrow' : ''}`} onToggle={event => setOpen(event.currentTarget.open)} onKeyDown={event => { if (event.key === 'Escape') close(); }}>
    <summary ref={trigger} className={`aa-prov-chip${open ? ' is-open' : ''}`} aria-controls={id}>источник</summary>
    {narrow && open ? <button type="button" className="aa-sheet-scrim" aria-label="Закрыть источник" onClick={close} /> : null}
    <div id={id} className="aa-prov-pop">{narrow ? <div className="aa-sheet-title">Источник <button type="button" className="aa-prov-chip" onClick={close}>закрыть</button></div> : null}<dl className="aa-prov-fields">{rows.map(([key, value]) => <div className="aa-prov-row" key={key}>
      <dt className="aa-prov-key">{key}</dt><dd className="aa-prov-v">{value}</dd>
    </div>)}</dl></div>
  </details>;
}
