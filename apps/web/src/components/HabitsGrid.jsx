import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';
import { LIcons } from './icons.jsx';

/* global React */
const { useState: useStateH, useContext: useCtxH } = React;

/* Days are Mon-first (matches UA/RU week). Today index computed from JS. */
function getTodayIdx() {
  /* JS getDay: 0=Sun..6=Sat. Convert to Mon-first 0..6. */
  return (new Date().getDay() + 6) % 7;
}

function HabitsGrid({ habits: habitsProp, onToggle }) {
  const { t } = useCtxH(LifeLocaleContext);
  const I = LIcons;
  const todayIdx = getTodayIdx();
  const dayKeys = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];

  /* Mon-first week: 1 = done, 0 = empty/missed/future */
  const [habitsState, setHabits] = useStateH([
    { id: 1, titleKey: 'habit_read',     week: [1,1,1,0,1,0,0], streak: 12, best: 28 },
    { id: 2, titleKey: 'habit_no_phone', week: [1,1,0,1,1,0,0], streak: 30, best: 30 },
    { id: 3, titleKey: 'habit_walk',     week: [1,1,1,1,0,0,0], streak: 4,  best: 16 },
    { id: 4, titleKey: 'habit_write',    week: [1,0,1,1,0,0,0], streak: 2,  best: 41 },
  ]);
  const habits = habitsProp != null ? habitsProp : habitsState;

  function toggleToday(habitId) {
    if (onToggle) {
      onToggle(habitId, todayIdx);
      return;
    }
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h;
      const next = h.week.slice();
      next[todayIdx] = next[todayIdx] ? 0 : 1;
      return { ...h, week: next };
    }));
  }

  const total = habits.reduce((s,h) => s + h.week.slice(0, todayIdx + 1).reduce((a,b) => a+b, 0), 0);
  const max   = habits.length * (todayIdx + 1);

  return (
    <section className="card panel">
      <div className="panel-head">
        <h3 className="panel-title">{t('habits_title')}</h3>
        <span className="panel-meta mono">
          <span className="habits-counter">{total}</span>/<span className="habits-counter-max">{max}</span> {t('habits_meta_period')}
        </span>
      </div>

      {habits.length === 0 ? (
        <div className="empty-state empty-habits">
          <div>{t('habits_empty')}</div>
          <button className="empty-action mono">{t('habits_add')}</button>
        </div>
      ) : (
        <div className="habits-grid">
          {/* day header */}
          <div className="habits-row habits-row-head">
            <div />
            {dayKeys.map((d, i) => (
              <div key={i} className={"habits-day mono" + (i === todayIdx ? " is-today" : "")}>{d}</div>
            ))}
            <div />
          </div>

          {habits.map(h => (
            <React.Fragment key={h.id}>
              <div className="habits-row">
                <div className="habits-name">{h.titleKey ? t(h.titleKey) : h.name}</div>
                {h.week.map((v, i) => {
                  const isPast   = i < todayIdx;
                  const isToday  = i === todayIdx;
                  const isFuture = i > todayIdx;
                  const cls = [
                    "habits-cell",
                    v ? "is-done" : "",
                    isToday  ? "is-today"  : "",
                    isFuture ? "is-future" : "",
                    isPast && !v ? "is-missed" : "",
                  ].filter(Boolean).join(' ');
                  if (isToday) {
                    return (
                      <button key={i} className={cls} onClick={() => toggleToday(h.id)} title="отметить">
                        {!v && <span className="habits-cell-plus" aria-hidden="true">+</span>}
                      </button>
                    );
                  }
                  return <div key={i} className={cls} />;
                })}
                <div />
              </div>
              <div className="habits-row habits-streak-row">
                <div className="habits-streak mono">{t('habits_streak', h.streak, t.pl('pl_day', h.streak), h.best)}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </section>
  );
}

export { HabitsGrid };
