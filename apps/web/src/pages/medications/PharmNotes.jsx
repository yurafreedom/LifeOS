import React from 'react';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeStrings } from '../../context/LocaleContext.jsx';

/* global React */
/* pages/medications/PharmNotes.jsx · Sprint 3A Batch 4
 *
 * Per-med pharmacist-notes journal. Inline capture row at the top,
 * reverse-chronological list below. Each note: polarity (+/-), date,
 * free text. Hover reveals edit + delete.
 *
 * Reused by MedDetailPage's ЖУРНАЛ tab. Global feed is a separate
 * component (GlobalJournal) that pulls notes across all meds. */

const { useState: useStatePN, useContext: useCtxPN, useMemo: useMemoPN } = React;

function PharmNotes({ medId }) {
  const data = useCtxPN(LifeDataContext);
  const { t } = useCtxPN(LifeLocaleContext);

  const notes = data.state.pharmNotes[medId] || [];

  const [polarity, setPolarity] = useStatePN('+');
  const [text, setText]         = useStatePN('');
  const [date, setDate]         = useStatePN(() => new Date().toISOString().slice(0, 10));
  const [editing, setEditing]   = useStatePN(null);   // noteId being edited

  function commit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (editing) {
      data.editPharmNote(medId, editing, { polarity, text: trimmed, date });
      setEditing(null);
    } else {
      data.addPharmNote(medId, { polarity, text: trimmed, date });
    }
    setText('');
  }
  function startEdit(n) {
    setEditing(n.id);
    setPolarity(n.polarity);
    setText(n.text);
    setDate(n.date);
  }
  function cancelEdit() {
    setEditing(null);
    setText('');
    setPolarity('+');
    setDate(new Date().toISOString().slice(0, 10));
  }

  const summary = useMemoPN(() => {
    const cutoff = Date.now() - 30 * 86400000;
    let plus = 0, minus = 0;
    notes.forEach(n => {
      const ts = new Date(n.date).getTime();
      if (!isFinite(ts) || ts < cutoff) return;
      if (n.polarity === '+') plus++;
      if (n.polarity === '-') minus++;
    });
    return { plus, minus };
  }, [notes]);

  return (
    <div className="pn">
      <div className="pn-capture">
        <div className="pn-polarity">
          <button className={"pn-pol pn-pol-plus" + (polarity === '+' ? " is-on" : "")}
                  onClick={() => setPolarity('+')}>+</button>
          <button className={"pn-pol pn-pol-minus" + (polarity === '-' ? " is-on" : "")}
                  onClick={() => setPolarity('-')}>−</button>
        </div>
        <input
          type="text"
          className="tdm-input pn-input"
          placeholder={t('pn_capture_ph')}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }} />
        <input
          type="date"
          className="tdm-input pn-date"
          value={date}
          onChange={e => setDate(e.target.value)} />
        <button className="qa-btn-save pn-save" onClick={commit}>{t('pn_save_short')}</button>
        {editing && (
          <button className="qa-btn-ghost" onClick={cancelEdit}>{t('pn_cancel')}</button>
        )}
      </div>

      {notes.length > 0 && (
        <div className="pn-summary mono">
          {t('pn_summary', summary.plus, summary.minus)}
        </div>
      )}

      <ul className="pn-list">
        {notes.length === 0 && (
          <li className="pn-empty mono">{t('pn_empty')}</li>
        )}
        {notes.map(n => (
          <PharmNoteRow key={n.id} note={n} medId={medId}
            data={data} t={t} onEdit={() => startEdit(n)} />
        ))}
      </ul>
    </div>
  );
}

function PharmNoteRow({ note, medId, data, t, onEdit }) {
  const intlLoc = (LifeStrings.ru && LifeStrings.ru._intl_locale) || 'ru-RU';
  const d = new Date(note.date);
  const when = d.toLocaleDateString(intlLoc, { day: '2-digit', month: '2-digit' });
  return (
    <li className={"pn-row pn-row-" + (note.polarity === '+' ? 'plus' : 'minus')}>
      <span className={"pn-row-mark pn-row-mark-" + (note.polarity === '+' ? 'plus' : 'minus')}>
        {note.polarity === '+' ? '+' : '−'}
      </span>
      <span className="pn-row-date mono">{when}</span>
      <span className="pn-row-text">{note.text}</span>
      <div className="pn-row-actions">
        <button className="pn-row-act mono" onClick={onEdit}>{t('pn_edit')}</button>
        <button className="pn-row-act pn-row-act-del mono"
                onClick={() => data.deletePharmNote(medId, note.id)}>
          {t('pn_delete')}
        </button>
      </div>
    </li>
  );
}

export { PharmNotes };
