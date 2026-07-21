import React from 'react';
import { LIcons } from '../../components/icons.jsx';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import { LifeLocaleContext } from '../../context/LocaleContext.jsx';
import { LifeMedMath } from '../../lib/medMath.js';

/* global React */
/* pages/medications/TakeDoseModal.jsx · Sprint 3A Batch 2
 *
 * Quick dose-logging modal. Defaults to NOW + per-dose-amount; user
 * may edit timestamp + dose + add a note. Shows late/early indicator
 * if timestamp differs from expected (last dose + interval) by more
 * than 30 minutes, and a PRN anti-stacking warning if last dose was
 * < interval ago.
 *
 * Save → data.takeDose(medId, payload) which appends to doseLogs,
 * decrements inventory, and emits an activityLog entry.
 *
 * Visual idiom: matches the QuickAdd modal (qa-backdrop / qa-modal
 * shell) so it doesn't introduce new modal chrome. */

const { useState: useStateTD2, useEffect: useEffectTD2, useContext: useCtxTD2, useMemo: useMemoTD2 } = React;

function TakeDoseModal({ med, onClose }) {
  const data = useCtxTD2(LifeDataContext);
  const { t, locale } = useCtxTD2(LifeLocaleContext);
  const M = LifeMedMath;
  const I = LIcons;

  /* All state pre-fills. timestamp = now (local datetime input);
     dose = round(daily / per-day) defaulting to strength_mg if no
     daily total. */
  const defaultTs = useMemoTD2(() => toLocalInput(new Date()), []);
  const defaultDose = (() => {
    if (med.current_dose_mg_per_day && med.doses_per_day) {
      return Math.round((med.current_dose_mg_per_day / med.doses_per_day) * 10) / 10;
    }
    return med.strength_mg || '';
  })();

  const [ts, setTs]     = useStateTD2(defaultTs);
  const [dose, setDose] = useStateTD2(defaultDose);
  const [note, setNote] = useStateTD2('');

  useEffectTD2(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const doseLog = data.state.doseLogs[med.id] || [];
  const modeStyle = data.state.modeStyles[med.id] || null;
  const takenMs = new Date(ts).getTime();

  const delta = M.dosingDelta(med, doseLog, takenMs);
  const prnGap = M.prnStackingGap(med, doseLog, modeStyle, takenMs);

  const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
  const unitH = t('meds_unit_h');
  const unitM = t('meds_unit_m');

  function save() {
    data.takeDose(med.id, {
      taken_at: new Date(ts).toISOString(),
      dose_mg: parseFloat(dose) || null,
      mode: modeStyle ? modeStyle.type : 'scheduled',
      note: note.trim(),
    });
    onClose();
  }

  return (
    <div className="qa-backdrop" onMouseDown={onClose}>
      <div className="qa-modal tdm-modal" onMouseDown={e => e.stopPropagation()} role="dialog">
        <div className="qa-head">
          <span className="qa-eyebrow mono">{t('meds_take_title', medName)}</span>
          <button className="qa-close" onClick={onClose}>{I.x ? I.x({ size: 14 }) : '×'}</button>
        </div>

        <div className="tdm-row">
          <label className="tdm-field">
            <span className="tdm-lab mono">{t('meds_take_when')}</span>
            <input
              type="datetime-local"
              className="tdm-input"
              value={ts}
              onChange={e => setTs(e.target.value)} />
          </label>
          <label className="tdm-field tdm-field-dose">
            <span className="tdm-lab mono">{t('meds_take_dose')}</span>
            <input
              type="number"
              className="tdm-input"
              value={dose}
              onChange={e => setDose(e.target.value)}
              step="0.5"
              min="0" />
          </label>
        </div>

        <label className="tdm-field tdm-field-note">
          <span className="tdm-lab mono">{t('meds_take_note')}</span>
          <input
            type="text"
            className="tdm-input"
            placeholder={t('meds_take_note_ph')}
            value={note}
            onChange={e => setNote(e.target.value)} />
        </label>

        {delta && (
          <div className="tdm-indicator mono">
            {delta.kind === 'late'
              ? t('meds_late_by',  M.formatHM(delta.deltaMs, unitH, unitM))
              : t('meds_early_by', M.formatHM(delta.deltaMs, unitH, unitM))}
          </div>
        )}

        {prnGap != null && (
          <div className="tdm-prn-warn mono">
            {t('meds_prn_anti_stack',
               M.formatHM(prnGap, unitH, unitM),
               med.dose_interval_h || 6)}
          </div>
        )}

        <div className="qa-foot">
          <div className="qa-foot-hints mono">
            <span className="qa-kbd">⌘ ↵</span><span>{t('meds_take_save')}</span>
            <span className="qa-foot-sep">·</span>
            <span className="qa-kbd">ESC</span><span>{t('qa_cancel')}</span>
          </div>
          <div className="qa-foot-actions">
            <button className="qa-btn-ghost" onClick={onClose}>{t('qa_cancel')}</button>
            <button className="qa-btn-save btn--stakes" onClick={save}>{t('meds_take_save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function toLocalInput(d) {
  /* datetime-local needs "YYYY-MM-DDTHH:MM" in local time, not UTC.
     toISOString applies UTC, so build manually. */
  const pad = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
       + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

export { TakeDoseModal };
