import React from 'react';
import { LifeLocaleContext, LifeStrings } from '../context/LocaleContext.jsx';

/* global React */
/* components/MultiChangeWarningModal.jsx · Sprint 3A Batch 3
 *
 * Soft warning shown when the user changes mode_style on a medication
 * while ≥1 OTHER active medication has had a 'mode_changed' entry in
 * the global activityLog within the last 7 days. Does NOT block —
 * user can dismiss + proceed. Fires once per change confirmation. */

const { useContext: useCtxMW } = React;

function MultiChangeWarningModal({ recentChanges, currentMed, onProceed, onCancel }) {
  const { t, locale } = useCtxMW(LifeLocaleContext);

  const medName = currentMed['name_' + (locale === 'uk' ? 'ua' : 'ru')] || currentMed.name_ru;
  const intlLoc = (LifeStrings[locale] && LifeStrings[locale]._intl_locale) || 'ru-RU';

  return (
    <div className="qa-backdrop" onMouseDown={onCancel}>
      <div className="qa-modal mcw-modal" onMouseDown={e => e.stopPropagation()} role="dialog">
        <div className="qa-head">
          <span className="qa-eyebrow mono">{t('mcw_title')}</span>
        </div>

        <div className="mcw-body">
          <div className="mcw-intro">{t('mcw_intro')}</div>
          <ul className="mcw-list">
            {recentChanges.map(c => {
              const dt = new Date(c.timestamp);
              const when = dt.toLocaleDateString(intlLoc, { day: '2-digit', month: '2-digit' });
              return (
                <li key={c.id} className="mcw-list-item">
                  <span className="mcw-dot">·</span>
                  <span className="mcw-list-name">{c.medName}</span>
                  <span className="mcw-list-when mono">({when})</span>
                </li>
              );
            })}
          </ul>
          <div className="mcw-changing">{t('mcw_changing', medName)}</div>
          <p className="mcw-rationale">{t('mcw_body')}</p>
        </div>

        <div className="qa-foot">
          <div className="qa-foot-actions">
            <button className="qa-btn-ghost" onClick={onCancel}>{t('mcw_postpone')}</button>
            <button className="qa-btn-save btn--stakes" onClick={onProceed}>{t('mcw_proceed')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { MultiChangeWarningModal };
