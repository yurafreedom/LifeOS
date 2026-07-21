import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

/* global React */
const { useContext: useCtxG, useState: useStateG } = React;

function GoalsWidget({ goals, onAddGoal }) {
  const { t } = useCtxG(LifeLocaleContext);
  const [draft, setDraft] = useStateG('');
  /* Shipped/persisted goals carry titleKey/tagKey (localised via i18n);
     user-added goals carry a literal title/tag. Resolve either shape. */
  const gTitle = g => g.title || (g.titleKey ? t(g.titleKey) : '');
  const gTag   = g => g.tag   || (g.tagKey   ? t(g.tagKey)   : '');
  const list = goals != null ? goals : [
    { id: 1, titleKey: 'goal_emergency',     pct: 62, val: '$1,550 / $2,500', tagKey: 'goal_tag_q3'  },
    { id: 2, titleKey: 'goal_ship_v1',       pct: 81, val: '13 / 16',         tagKey: 'goal_tag_q4'  },
    { id: 3, titleKey: 'goal_half_marathon', pct: 34, val: '7 / 20',          tagKey: 'goal_tag_jan' },
  ];

  function submitGoal(e) {
    e.preventDefault();
    const v = draft.trim();
    if (!v || !onAddGoal) return;
    onAddGoal(v);
    setDraft('');
  }

  return (
    <section className="card panel is-stakes goals-card">
      <div className="panel-head">
        <h3 className="panel-title">{t('goals_title')}</h3>
        <span className="panel-meta mono is-stakes">{t('goals_meta', list.length)}</span>
      </div>
      {list.length === 0 ? (
        <div className="empty-state">{t('empty_goals')}</div>
      ) : (
        <div className="goal-list">
          {list.map(g => (
            <div key={g.id} className="goal-row">
              <div className="goal-row-head">
                <div className="goal-title">{gTitle(g)}</div>
                <div className="mono goal-tag">{gTag(g)}</div>
              </div>
              <div className="goal-track">
                <div className="goal-fill" style={{ width: g.pct + '%' }} />
              </div>
              <div className="goal-foot mono">
                <span className="goal-val">{g.val}</span>
                <span className="goal-pct">{g.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Batch 1 rev · FIX 7 — add-goal affordance. Only rendered when a
          handler is wired (Goals screen); shared read-only contexts omit it. */}
      {onAddGoal && (
        <form className="goal-add" onSubmit={submitGoal}>
          <span className="goal-add-prefix">+</span>
          <input
            type="text"
            className="goal-add-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={t('goal_add_placeholder')}
          />
          <button className="goal-add-btn" type="submit" disabled={!draft.trim()}>
            {t('goal_add_btn')}
          </button>
        </form>
      )}
    </section>
  );
}

export { GoalsWidget };
