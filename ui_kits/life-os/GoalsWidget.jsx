/* global React */
const { useContext: useCtxG } = React;

function GoalsWidget({ goals }) {
  const { t } = useCtxG(window.LifeLocaleContext);
  const list = goals != null ? goals : [
    { id: 1, title: t('goal_emergency'),     pct: 62, val: '$1,550 / $2,500', tag: t('goal_tag_q3')  },
    { id: 2, title: t('goal_ship_v1'),       pct: 81, val: '13 / 16',         tag: t('goal_tag_q4')  },
    { id: 3, title: t('goal_half_marathon'), pct: 34, val: '7 / 20',          tag: t('goal_tag_jan') },
  ];
  return (
    <section className="card panel is-stakes">
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
                <div className="goal-title">{g.title}</div>
                <div className="mono goal-tag">{g.tag}</div>
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
    </section>
  );
}

window.GoalsWidget = GoalsWidget;
