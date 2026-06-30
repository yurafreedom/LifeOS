/* global React */
/* pages/medications/RefillModal.jsx · Sprint 3A Batch 2
 *
 * Compact inventory-refill prompt. User enters how many units they
 * just added; we add to the existing count and persist. */

const { useState: useStateRM, useContext: useCtxRM } = React;

function RefillModal({ med, onClose }) {
  const data = useCtxRM(window.LifeDataContext);
  const { t, locale } = useCtxRM(window.LifeLocaleContext);
  const I = window.LIcons;
  const [add, setAdd] = useStateRM('30');
  const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
  const current = med.inventory_count || 0;
  const next = current + (parseInt(add, 10) || 0);

  function save() {
    data.setMedicationInventory(med.id, next);
    onClose();
  }

  return (
    <div className="qa-backdrop" onMouseDown={onClose}>
      <div className="qa-modal tdm-modal tdm-refill" onMouseDown={e => e.stopPropagation()} role="dialog">
        <div className="qa-head">
          <span className="qa-eyebrow mono">{t('meds_refill_title')} · {medName}</span>
          <button className="qa-close" onClick={onClose}>{I.x ? I.x({ size: 14 }) : '×'}</button>
        </div>

        <label className="tdm-field">
          <span className="tdm-lab mono">{t('meds_refill_add')}</span>
          <input
            type="number"
            className="tdm-input"
            value={add}
            onChange={e => setAdd(e.target.value)}
            min="0" step="1" autoFocus />
        </label>

        <div className="tdm-refill-total mono">
          {t('meds_refill_total')}: {next}
        </div>

        <div className="qa-foot">
          <div className="qa-foot-actions">
            <button className="qa-btn-ghost" onClick={onClose}>{t('qa_cancel')}</button>
            <button className="qa-btn-save" onClick={save}>{t('meds_inv_refill')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.RefillModal = RefillModal;
