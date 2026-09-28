import React from 'react';
import { PageHeader } from '../components/HeroVignette.jsx';
import { LIcons } from '../components/icons.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

/* global React */
const { useState: useStateQN, useRef: useRefQN, useContext: useCtxQN } = React;

/* Quick Notes — raw-capture surface.
   Type, hit enter, row appears. No category, no priority, no time. Each
   note has a timestamp + actions to "promote" (open quick-add modal pre-
   filled) or delete. Notes don't show up on home / calendar / anywhere
   else until promoted. */
function QuickNotesPage({ notes, onAdd, onDelete, onPromote }) {
  const { t } = useCtxQN(LifeLocaleContext);
  const I = LIcons;
  const [draft, setDraft] = useStateQN('');
  const inputRef = useRefQN(null);

  function commit(e) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft('');
    /* keep focus — fast capture */
    inputRef.current && inputRef.current.focus();
  }

  return (
    <div className="page qn-page">
      <PageHeader
        title={t('qn_title')}
        subtitle={t('qn_subtitle')}
        aside={<span className="page-count mono">{notes.length}</span>}
      />

      <form className="qn-input" onSubmit={commit}>
        <span className="qn-input-prefix">{I.plus({ size: 16 })}</span>
        <input
          ref={inputRef}
          className="qn-input-field"
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={t('qn_placeholder')}
        />
        {draft.trim() && (
          <span className="qn-input-hint mono">↵</span>
        )}
      </form>

      {notes.length === 0 ? (
        <div className="qn-empty">{t('qn_empty')}</div>
      ) : (
        <ul className="qn-list">
          {notes.map(n => (
            <li key={n.id} className="qn-item">
              <span className="qn-item-time mono">{n.at}</span>
              <span className="qn-item-text">{n.text}</span>
              <div className="qn-item-actions">
                <button className="qn-item-btn"
                        onClick={() => onPromote(n)}
                        title={t('qn_promote_full')}>
                  {I.arrowUpRight({ size: 14 })}
                  <span>{t('qn_promote')}</span>
                </button>
                <button className="qn-item-btn is-danger"
                        onClick={() => onDelete(n.id)}
                        title={t('qn_delete')}
                        aria-label={t('qn_delete')}>
                  {I.trash({ size: 14 })}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { QuickNotesPage };
