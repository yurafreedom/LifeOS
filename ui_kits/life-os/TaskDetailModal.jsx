/* global React */
const { useState: useStateTD, useEffect: useEffectTD, useContext: useCtxTD, useRef: useRefTD } = React;

function TaskDetailModal({ task, onClose, onUpdate, onComplete, onDelete }) {
  const { t, locale } = useCtxTD(window.LifeLocaleContext);
  const I = window.LIcons;
  const cats = window.LifeExpenseCats;

  const [title, setTitle]     = useStateTD(task ? task.title : '');
  const [stakes, setStakes]   = useStateTD(task ? !!task.stakes : false);
  const [catId, setCatId]     = useStateTD(task && task.category ? task.category.id : null);
  const [catOpen, setCatOpen] = useStateTD(false);
  const [subtasks, setSubs]   = useStateTD(task && task.subtasks ? task.subtasks : [
    { id: 1, title: 'набросать первый экран', done: true  },
    { id: 2, title: 'свести цвета',           done: true  },
    { id: 3, title: 'подключить аналитику',   done: false },
  ]);
  const [newSub, setNewSub]   = useStateTD('');
  const [notes, setNotes]     = useStateTD(task ? (task.notes || '') : '');
  const [confirmDel, setCD]   = useStateTD(false);
  const [menuOpen, setMO]     = useStateTD(false);

  const catBoxRef = useRefTD(null);

  useEffectTD(() => {
    if (!task) return;
    function handler(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  useEffectTD(() => {
    if (!catOpen) return;
    function handler(e) {
      if (catBoxRef.current && !catBoxRef.current.contains(e.target)) setCatOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catOpen]);

  if (!task) return null;

  function commit() {
    onUpdate({ ...task, title: title.trim() || task.title, stakes, category: cats.find(c => c.id === catId) || null, subtasks, notes });
    onClose();
  }
  function toggleSub(id) {
    setSubs(s => s.map(x => x.id === id ? { ...x, done: !x.done } : x));
  }
  function addSub(e) {
    e.preventDefault();
    if (!newSub.trim()) return;
    setSubs(s => [...s, { id: Date.now(), title: newSub.trim(), done: false }]);
    setNewSub('');
  }
  function removeSub(id) {
    setSubs(s => s.filter(x => x.id !== id));
  }

  const subDone  = subtasks.filter(s => s.done).length;
  const subTotal = subtasks.length;
  const selectedCat = cats.find(c => c.id === catId);

  /* Activity is now sourced from the global activityLog via the
     shared <ActivityTimeline /> component — see
     components/ActivityTimeline.jsx. Sprint 3A Batch 1.
     The old inline mock has been removed. */

  return (
    <div className="qa-backdrop" onMouseDown={onClose}>
      <div className="qa-modal td-modal" onMouseDown={e => e.stopPropagation()} role="dialog">

        <div className="qa-head">
          <span className="qa-eyebrow mono">{t('td_eyebrow')} {task.stakes && <span className="td-eyebrow-stakes">· {t('qa_stakes')}</span>}</span>
          <div className="td-head-actions">
            <button className="td-menu-btn" onClick={() => setMO(o => !o)}>{I.moreHorizontal({ size: 14 })}</button>
            {menuOpen && (
              <div className="td-menu">
                {!confirmDel ? (
                  <button className="td-menu-item is-danger" onClick={() => setCD(true)}>{t('td_delete')}</button>
                ) : (
                  <div className="td-menu-confirm">
                    <div className="mono td-menu-confirm-q">{t('td_delete_confirm')}</div>
                    <div className="td-menu-confirm-row">
                      <button className="td-menu-item" onClick={() => { setCD(false); setMO(false); }}>{t('qa_cancel')}</button>
                      <button className="td-menu-item is-danger-solid" onClick={() => { onDelete(task.id); onClose(); }}>{t('td_delete_yes')}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button className="qa-close" onClick={onClose}><I.x size={14}/></button>
          </div>
        </div>

        <input className="qa-title td-title" value={title} onChange={e => setTitle(e.target.value)} />

        <div className="qa-row">
          <div className="qa-toggle">
            <button className={"qa-toggle-btn" + (!stakes ? " is-on" : "")} onClick={() => setStakes(false)}>{t('qa_routine')}</button>
            <button className={"qa-toggle-btn is-stakes" + (stakes ? " is-on" : "")} onClick={() => setStakes(true)}>{t('qa_stakes')}</button>
          </div>
          <div className="qa-cat" ref={catBoxRef}>
            <button className="qa-cat-trigger" onClick={() => setCatOpen(o => !o)}>
              {selectedCat ? (
                <React.Fragment>
                  <span className={"qa-cat-dot " + window.LifeCatTintClass[selectedCat.tint]}>
                    {I[selectedCat.icon] && I[selectedCat.icon]({ size: 13 })}
                  </span>
                  <span className="qa-cat-name">{selectedCat.name[locale]}</span>
                </React.Fragment>
              ) : (
                <span className="qa-cat-placeholder">{t('qa_category')}</span>
              )}
              <span className="qa-cat-chev">{I.chevDown({ size: 12 })}</span>
            </button>
            {catOpen && (
              <div className="qa-cat-pop">
                <div className="qa-cat-list">
                  <button className="qa-cat-opt" onClick={() => { setCatId(null); setCatOpen(false); }}>
                    <span className="qa-cat-dot cat-tint-neutral">{I.x({ size: 11 })}</span>
                    <span className="qa-cat-opt-name">{t('qa_no_category')}</span>
                  </button>
                  {cats.map(c => (
                    <button key={c.id} className="qa-cat-opt" onClick={() => { setCatId(c.id); setCatOpen(false); }}>
                      <span className={"qa-cat-dot " + window.LifeCatTintClass[c.tint]}>
                        {I[c.icon] && I[c.icon]({ size: 13 })}
                      </span>
                      <span className="qa-cat-opt-name">{c.name[locale]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SUBTASKS */}
        <div className="td-section">
          <div className="td-section-head">
            <span className="mono td-section-lab">{t('td_subtasks')}</span>
            <span className="mono td-section-count">{subDone}/{subTotal}</span>
          </div>
          <div className="td-subtask-list">
            {subtasks.map(s => (
              <div key={s.id} className={"td-subtask" + (s.done ? " is-done" : "")}>
                <button className={"task-check" + (s.done ? " is-done" : "")} onClick={() => toggleSub(s.id)}>
                  {s.done && I.check({ size: 11 })}
                </button>
                <span className="td-subtask-title">{s.title}</span>
                <button className="td-subtask-remove" onClick={() => removeSub(s.id)} title={t('qa_cancel')}>{I.x({ size: 11 })}</button>
              </div>
            ))}
            <form className="td-subtask-add" onSubmit={addSub}>
              <span className="td-subtask-prefix">+</span>
              <input className="td-subtask-input" placeholder={t('td_subtask_add')} value={newSub} onChange={e => setNewSub(e.target.value)} />
            </form>
          </div>
        </div>

        {/* NOTES */}
        <div className="td-section">
          <div className="td-section-head">
            <span className="mono td-section-lab">{t('qa_notes_expanded')}</span>
          </div>
          <textarea className="qa-notes-input" rows={2} placeholder={t('qa_notes_placeholder')} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* ACTIVITY · global activityLog filtered by entity */}
        <div className="td-section">
          <div className="td-section-head">
            <span className="mono td-section-lab">{t('td_activity')}</span>
          </div>
          <window.ActivityTimeline entityType="task" entityId={task.id} />
        </div>

        <div className="qa-foot">
          <div className="qa-foot-hints mono">
            <span className="qa-kbd">⌘ ↵</span><span>{t('td_save')}</span>
            <span className="qa-foot-sep">·</span>
            <span className="qa-kbd">ESC</span><span>{t('qa_cancel')}</span>
          </div>
          <div className="qa-foot-actions">
            <button className="qa-btn-ghost" onClick={() => { commit(); }}>{t('td_save')}</button>
            <button className={"qa-btn-save" + (stakes ? " is-stakes" : "")} onClick={() => { onComplete(task.id); onClose(); }}>
              {task.done ? t('td_uncomplete') : t('td_complete')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

window.TaskDetailModal = TaskDetailModal;
