import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';
import { LIcons } from './icons.jsx';

/* global React */
const { useContext: useCtxMN } = React;

/* Bottom nav for mobile (<640px). 5 fixed slots: home / tasks / notes / calendar / more.
   The full sidebar tree lives on desktop; mobile picks 4 high-traffic destinations
   and "more" jumps to settings (eventually a sheet listing the rest). */
function MobileBottomNav({ active, onNav }) {
  const { t } = useCtxMN(LifeLocaleContext);
  const I = LIcons;
  const items = [
    { id: 'home',     label: t('nav_home'),     icon: 'home' },
    { id: 'tasks',    label: t('nav_tasks'),    icon: 'listChecks' },
    { id: 'notes',    label: t('nav_notes'),    icon: 'stickyNote' },
    { id: 'calendar', label: t('nav_calendar'), icon: 'calendar' },
    { id: 'more',     label: t('nav_more'),     icon: 'moreHorizontal' },
  ];
  return (
    <nav className="mnav" role="navigation">
      {items.map(it => (
        <button key={it.id}
                className={"mnav-btn" + (active === it.id ? " is-on" : "")}
                onClick={() => onNav(it.id === 'more' ? 'settings' : it.id)}>
          <span className="mnav-icon">{I[it.icon] && I[it.icon]({ size: 20 })}</span>
          <span className="mnav-label">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

export { MobileBottomNav };
