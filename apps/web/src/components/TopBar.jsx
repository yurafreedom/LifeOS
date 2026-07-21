import React from 'react';
import { LifeLocaleContext, LifeStrings } from '../context/LocaleContext.jsx';
import { LIcons } from './icons.jsx';

/* global React */
const { useContext: useCtxTB, useState: useStateTB } = React;

function TopBar({ onQuickAdd }) {
  const { t, locale } = useCtxTB(LifeLocaleContext);
  const I = LIcons;
  const [search, setSearch] = useStateTB('');

  const now = new Date();
  const hr  = now.getHours();
  const greet = hr < 5  ? t('tb_greet_night')
              : hr < 12 ? t('tb_greet_morning')
              : hr < 18 ? t('tb_greet_afternoon')
              : hr < 23 ? t('tb_greet_evening')
              :           t('tb_greet_night');

  const intlLoc = LifeStrings[locale]._intl_locale;
  const weekday = now.toLocaleDateString(intlLoc, { weekday: 'short' }).replace('.', '');
  const dateStr = now.toLocaleDateString(intlLoc, { day: 'numeric', month: 'short' }).replace('.', '');
  const time    = now.toTimeString().slice(0, 5);

  return (
    <header className="tb">
      <div className="tb-left">
        <div className="tb-eyebrow mono">{`${time} · ${weekday} ${dateStr}`}</div>
        <h1 className="tb-title">{greet}</h1>
      </div>
      <div className="tb-right">
        <label className="tb-cmd">
          <span className="tb-cmd-icon">{I.search({ size: 16 })}</span>
          <input
            type="text"
            className="tb-cmd-input"
            placeholder={t('tb_search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="tb-kbd mono">{t('tb_kbd_cmdk')}</span>
        </label>
        <button className="tb-add" onClick={onQuickAdd} title={t('qa_eyebrow')}>
          {I.plus({ size: 18 })}
        </button>
      </div>
    </header>
  );
}

export { TopBar };
