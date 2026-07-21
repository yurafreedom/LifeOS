import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';
import { LifeCatTintClass, LifeExpenseCats } from '../data/categories.js';
import { LIcons } from './icons.jsx';

/* global React */
const { useState: useStateQA, useEffect: useEffectQA, useContext: useCtxQA, useRef: useRefQA, useMemo: useMemoQA } = React;

function QuickAddModal({ open, onClose, onSave, defaultStakes = false, defaultTitle = '' }) {
  const { t, locale } = useCtxQA(LifeLocaleContext);
  const I = LIcons;
  const cats = LifeExpenseCats;

  const [title, setTitle]       = useStateQA('');
  const [stakes, setStakes]     = useStateQA(defaultStakes);
  const [catId, setCatId]       = useStateQA(null);
  const [catQuery, setCatQuery] = useStateQA('');
  const [catOpen, setCatOpen]   = useStateQA(false);
  const [showSched, setSched]   = useStateQA(false);
  const [date, setDate]         = useStateQA('');
  const [time, setTime]         = useStateQA('');
  const [showNotes, setNotes]   = useStateQA(false);
  const [notesText, setNotesT]  = useStateQA('');

  const titleRef = useRefQA(null);
  const catBoxRef = useRefQA(null);

  /* reset when re-opened */
  useEffectQA(() => {
    if (open) {
      setTitle(defaultTitle || ''); setStakes(defaultStakes); setCatId(null); setCatQuery('');
      setCatOpen(false); setSched(false); setDate(''); setTime('');
      setNotes(false); setNotesT('');
      setTimeout(() => titleRef.current && titleRef.current.focus(), 30);
    }
  }, [open, defaultStakes, defaultTitle]);

  /* esc to close, cmd+enter to save */
  useEffectQA(() => {
    if (!open) return;
    function handler(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  /* click outside category dropdown to close */
  useEffectQA(() => {
    if (!catOpen) return;
    function handler(e) {
      if (catBoxRef.current && !catBoxRef.current.contains(e.target)) setCatOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catOpen]);

  function commit() {
    const v = title.trim();
    if (!v) { titleRef.current && titleRef.current.focus(); return; }
    const cat = cats.find(c => c.id === catId) || null;
    onSave({
      title: v,
      stakes,
      category: cat,
      schedule: showSched && (date || time) ? { date, time } : null,
      notes: showNotes ? notesText.trim() : '',
    });
  }

  if (!open) return null;

  const filteredCats = catQuery
    ? cats.filter(c => c.name[locale].toLowerCase().includes(catQuery.toLowerCase()))
    : cats;
  const selectedCat = cats.find(c => c.id === catId);

  return (
    <div className="qa-backdrop" onMouseDown={onClose}>
      <div className="qa-modal" onMouseDown={e => e.stopPropagation()} role="dialog">

        <div className="qa-head">
          <span className="qa-eyebrow mono">{t('qa_eyebrow')}</span>
          <button className="qa-close" onClick={onClose} title="esc"><I.x size={14}/></button>
        </div>

        {/* title — autofocus, Onest, large */}
        <input
          ref={titleRef}
          className="qa-title"
          placeholder={stakes ? t('qa_title_stakes') : t('qa_title')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } }}
        />

        {/* row: routine/stakes toggle + category */}
        <div className="qa-row">
          <div className="qa-toggle" role="tablist">
            <button
              role="tab" aria-selected={!stakes}
              className={"qa-toggle-btn" + (!stakes ? " is-on" : "")}
              onClick={() => setStakes(false)}>{t('qa_routine')}</button>
            <button
              role="tab" aria-selected={stakes}
              className={"qa-toggle-btn is-stakes" + (stakes ? " is-on" : "")}
              onClick={() => setStakes(true)}>{t('qa_stakes')}</button>
          </div>

          <div className="qa-cat" ref={catBoxRef}>
            <button className={"qa-cat-trigger" + (selectedCat ? " is-set" : "")} onClick={() => setCatOpen(o => !o)}>
              {selectedCat ? (
                <React.Fragment>
                  <span className={"qa-cat-dot " + LifeCatTintClass[selectedCat.tint]} aria-hidden="true">
                    {I[selectedCat.icon] ? I[selectedCat.icon]({ size: 13 }) : null}
                  </span>
                  <span className="qa-cat-name">{selectedCat.name[locale]}</span>
                </React.Fragment>
              ) : (
                <span className="qa-cat-placeholder">{t('qa_category')}</span>
              )}
              <span className="qa-cat-chev"><I.chevDown size={12}/></span>
            </button>
            {catOpen && (
              <div className="qa-cat-pop">
                <input
                  className="qa-cat-search mono"
                  placeholder={t('qa_category')}
                  value={catQuery}
                  onChange={e => setCatQuery(e.target.value)}
                  autoFocus
                />
                <div className="qa-cat-list">
                  <button className="qa-cat-opt" onClick={() => { setCatId(null); setCatOpen(false); setCatQuery(''); }}>
                    <span className="qa-cat-dot cat-tint-neutral"><I.x size={11}/></span>
                    <span className="qa-cat-opt-name">{t('qa_no_category')}</span>
                  </button>
                  {filteredCats.map(c => (
                    <button key={c.id} className="qa-cat-opt" onClick={() => { setCatId(c.id); setCatOpen(false); setCatQuery(''); }}>
                      <span className={"qa-cat-dot " + LifeCatTintClass[c.tint]}>
                        {I[c.icon] ? I[c.icon]({ size: 13 }) : null}
                      </span>
                      <span className="qa-cat-opt-name">{c.name[locale]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* schedule expander */}
        <div className="qa-expander">
          {!showSched ? (
            <button className="qa-expand-link mono" onClick={() => setSched(true)}>
              <I.clock size={12}/> {t('qa_schedule_collapsed')}
            </button>
          ) : (
            <div className="qa-expand-body">
              <div className="qa-expand-head">
                <span className="mono qa-expand-lab">{t('qa_schedule_expanded')}</span>
                <button className="qa-expand-collapse" onClick={() => setSched(false)}><I.x size={11}/></button>
              </div>
              <div className="qa-sched-row">
                <input type="date" className="qa-sched-input mono" value={date} onChange={e => setDate(e.target.value)}/>
                <input type="time" className="qa-sched-input mono" value={time} onChange={e => setTime(e.target.value)}/>
              </div>
            </div>
          )}
        </div>

        {/* notes expander */}
        <div className="qa-expander">
          {!showNotes ? (
            <button className="qa-expand-link mono" onClick={() => setNotes(true)}>
              <I.plus size={12}/> {t('qa_notes_collapsed')}
            </button>
          ) : (
            <div className="qa-expand-body">
              <div className="qa-expand-head">
                <span className="mono qa-expand-lab">{t('qa_notes_expanded')}</span>
                <button className="qa-expand-collapse" onClick={() => setNotes(false)}><I.x size={11}/></button>
              </div>
              <textarea
                className="qa-notes-input"
                placeholder={t('qa_notes_placeholder')}
                value={notesText}
                onChange={e => setNotesT(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        {/* foot */}
        <div className="qa-foot">
          <div className="qa-foot-hints mono">
            <span className="qa-kbd">⌘ ↵</span>
            <span>{stakes ? t('qa_save') + ' · важное' : t('qa_save')}</span>
            <span className="qa-foot-sep">·</span>
            <span className="qa-kbd">ESC</span>
            <span>{t('qa_cancel')}</span>
          </div>
          <div className="qa-foot-actions">
            <button className="qa-btn-ghost" onClick={onClose}>{t('qa_cancel')}</button>
            <button className={"qa-btn-save" + (stakes ? " is-stakes" : "")} onClick={commit} disabled={!title.trim()}>
              {t('qa_save')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export { QuickAddModal };
