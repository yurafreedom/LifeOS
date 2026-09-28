import React from 'react';
import { PageHeader } from '../components/HeroVignette.jsx';
import { LIcons } from '../components/icons.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

/* global React */
const { useState: useStateQN, useRef: useRefQN, useContext: useCtxQN } = React;

/* Quick Notes — raw-capture surface plus the Clarify step.
   Type, hit enter, row appears. No category, no priority, no time. Tapping a
   row opens the Clarify panel, which is the only way a note leaves the inbox:
   it turns into a Task, Waiting item, deferred Task, Project or Reference, or
   is deleted after confirmation. Notes don't show up on home / calendar /
   anywhere else until clarified.

   The References section below the inbox is the retrieval surface for the
   Clarify "в справочник" outcome — Reference is a real persisted record, not a
   hidden note. */
function QuickNotesPage({ notes, references = [], onAdd, onClarify }) {
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
              <button className="qn-item-open"
                      onClick={() => onClarify(n)}
                      title={t('qn_clarify_full')}>
                <span className="qn-item-time mono">{n.at}</span>
                <span className="qn-item-text">{n.text}</span>
                <span className="qn-item-cta mono">
                  <span>{t('qn_clarify')}</span>
                  {I.chevRight({ size: 14 })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="qn-refs" aria-labelledby="qn-refs-title">
        <div className="panel-head">
          <h3 className="panel-title" id="qn-refs-title">{t('reference_section_title')}</h3>
          <span className="panel-meta mono">{references.length}</span>
        </div>
        {references.length === 0 ? (
          <div className="qn-empty">{t('reference_empty')}</div>
        ) : (
          <ul className="qn-ref-list">
            {references.map(item => (
              <li key={item.id} className="qn-ref-item">
                <span className="qn-ref-icon" aria-hidden="true">{I.bookOpen({ size: 14 })}</span>
                <span className="qn-ref-text">{item.text}</span>
                <span className="qn-ref-date mono">{item.created_at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export { QuickNotesPage };
