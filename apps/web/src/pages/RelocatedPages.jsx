import React from 'react';
import { GoalsWidget } from '../components/GoalsWidget.jsx';
import { HabitsGrid } from '../components/HabitsGrid.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

/* global React */
const { useContext: useCtxHP } = React;

/* Habits / Goals / Finances pages — thin wrappers around the existing
   widgets. Habits/Goals/Money were composited together on the old home;
   each gets a dedicated page now. No redesign — just a page header + the
   widget rendered full-width. */
function HabitsPage({ emptyMode }) {
  const { t } = useCtxHP(LifeLocaleContext);
  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-left">
          <h2 className="page-title">{t('habits_title')}</h2>
        </div>
      </header>
      <HabitsGrid habits={emptyMode ? [] : undefined} />
    </div>
  );
}

function GoalsPage({ emptyMode }) {
  const { t } = useCtxHP(LifeLocaleContext);
  const data = useCtxHP(LifeDataContext);
  const goals = emptyMode ? [] : (data.state.goals || []);
  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-left">
          <h2 className="page-title">{t('goals_title')}</h2>
        </div>
      </header>
      <GoalsWidget goals={goals} onAddGoal={data.addGoal} />
    </div>
  );
}

/* FinancesPage moved to pages/FinancesPage.jsx in Sprint 3B —
   the wrapper around MoneyWidget was too thin to host the per-row
   eye-toggle interaction. MoneyWidget.jsx still ships for any
   future home-dashboard logger context but is no longer rendered. */

export { HabitsPage, GoalsPage };
