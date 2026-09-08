import React from 'react';
import { LIcons } from '../components/icons.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

/* global React */
const { useContext: useCtxHealth } = React;

/* Health tab — Sprint 1 ships the skeleton only. Sprint 3 will populate
   each section with real data (labs scheduled, doctor visits, medical
   purchases tagged from finances, health-scoped goals). */
function HealthPage() {
  const { t } = useCtxHealth(LifeLocaleContext);
  const I = LIcons;

  const sections = [
    { id: 'labs',      title: t('health_labs'),      empty: t('health_labs_empty'),      icon: 'syringe' },
    { id: 'visit',     title: t('health_visit'),     empty: t('health_visit_empty'),     icon: 'heart' },
    { id: 'purchases', title: t('health_purchases'), empty: t('health_purchases_empty'), icon: 'wallet' },
    { id: 'goals',     title: t('health_goals'),     empty: t('health_goals_empty'),     icon: 'target' },
  ];

  return (
    <div className="page health-page">
      <header className="page-head">
        <div className="page-head-left">
          <h2 className="page-title">{t('health_title')}</h2>
          <div className="page-sub mono">{t('health_subtitle')}</div>
        </div>
      </header>
      <div className="health-grid">
        {sections.map(s => (
          <section className="pc-card health-card" key={s.id}>
            <header className="pc-head">
              <span className="health-icon">{I[s.icon] && I[s.icon]({ size: 16 })}</span>
              <h3 className="pc-title">{s.title}</h3>
            </header>
            <div className="health-empty">{s.empty}</div>
          </section>
        ))}
      </div>
    </div>
  );
}

export { HealthPage };
