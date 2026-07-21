import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';
import { LIcons } from './icons.jsx';

/* global React */
const { useState: useStateTL, useContext: useCtxTL } = React;

function TaskList({ tasks, onToggle, onAdd, onOpen }) {
  const { t } = useCtxTL(LifeLocaleContext);
  const I = LIcons;
  const [draft, setDraft] = useStateTL('');
  const [stakes, setStakes] = useStateTL(false);

  function commit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd({ title: draft.trim(), stakes });
    setDraft('');
    setStakes(false);
  }

  return (
    <section className="card panel">
      <div className="panel-head">
        <h3 className="panel-title">{t('tasks_title')}</h3>
        <span className="panel-meta mono">{t('tasks_open_total', tasks.filter(x => !x.done).length, tasks.length)}</span>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">{t('empty_tasks')}</div>
      ) : (
        <div className="task-list">
          {tasks.map(task => (
            <div key={task.id} className={"task-row" + (task.stakes ? " is-stakes" : "")}>
              <button className={"task-check" + (task.done ? " is-done" : "")}
                      onClick={() => onToggle(task.id)}>
                {task.done && I.check({ size: 12 })}
              </button>
              <button className={"task-title task-title-btn" + (task.done ? " is-done" : "")}
                      onClick={() => onOpen && onOpen(task)}>{task.title}</button>
              <div className="task-meta">
                {(task.tag || task.tagLabel) && (
                  <span className={"task-tag" + (task.stakes ? " is-stakes" : "")}>
                    {task.tagLabel || t('tag_' + task.tag, task.tag)}
                  </span>
                )}
                {task.due && <span className="task-due mono">{task.due}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="task-add" onSubmit={commit}>
        <span className={"task-add-prefix" + (stakes ? " is-stakes" : "")}>{stakes ? '★' : '+'}</span>
        <input
          type="text"
          className="task-add-input"
          placeholder={stakes ? t('tasks_add_stakes') : t('tasks_add')}
          value={draft}
          onChange={e => setDraft(e.target.value)} />
        <button type="button"
                className={"task-add-toggle mono" + (stakes ? " is-stakes" : "")}
                onClick={() => setStakes(s => !s)}>
          {stakes ? t('tasks_toggle_stakes') : t('tasks_toggle_routine')}
        </button>
      </form>
    </section>
  );
}

export { TaskList };
