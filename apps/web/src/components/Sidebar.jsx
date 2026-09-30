import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';
import { LIcons } from './icons.jsx';

/* global React */
const { useContext: useCtxSB, useEffect: useEffectSB } = React;

/* Visible product name. Technical identifiers (storage keys, export file
   names, package/repo names) keep "LifeOS" until a separate rename plan. */
const BRAND_NAME = 'JENKIN';

/* v2 sidebar.
   Sections: MAIN / LIFE / MONEY / MEDS · settings pinned bottom.
   Two states: expanded (220px) and collapsed (60px, icons only).
   Active state = orange icon glow (not a ring around the icon).
   Counts come from props.counts so each route can update its own. */
function Sidebar({ route, onNav, collapsed, setCollapsed, counts = {}, user, accountName = '', syncPhase = 'saved', analyticsEnabled = false }) {
  const { t } = useCtxSB(LifeLocaleContext);
  const I = LIcons;

  /* keyboard shortcut: cmd-\ / ctrl-\ toggles collapse */
  useEffectSB(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setCollapsed(v => !v);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCollapsed]);

  const sections = [
    { id: 'main', items: [
      { id: 'home',     icon: 'home',       label: t('nav_home') },
      { id: 'calendar', icon: 'calendar',   label: t('nav_calendar') },
      { id: 'notes',    icon: 'stickyNote', label: t('nav_notes'),    count: counts.notes },
    ]},
    { id: 'life', items: [
      { id: 'me',     icon: 'user',       label: t('nav_me') },
      { id: 'tasks',  icon: 'listChecks', label: t('nav_tasks'),  count: counts.tasks },
      { id: 'habits', icon: 'repeat',     label: t('nav_habits'), count: counts.habits },
      { id: 'goals',  icon: 'target',     label: t('nav_goals'),  count: counts.goals },
      { id: 'projects', icon: 'briefcase', label: t('nav_projects'), count: counts.projects },
      { id: 'health', icon: 'heart',      label: t('nav_health') },
      { id: 'dog',    icon: 'paw',        label: t('nav_dog') },
      /* Slice 6 · the one Experiment entry, only where analytics is enabled. */
      ...(analyticsEnabled ? [{ id: 'experiment', icon: 'flag', label: t('nav_experiments') }] : []),
      /* Slice 7 · System Review (live + saved), only where analytics is enabled. */
      ...(analyticsEnabled ? [{ id: 'system-review', icon: 'eye', label: t('nav_system_review') }] : []),
    ]},
    { id: 'money', items: [
      { id: 'finances',    icon: 'wallet',        label: t('nav_finances') },
      { id: 'monthly',     icon: 'calendarRange', label: t('nav_monthly') },
      { id: 'annual',      icon: 'coins',         label: t('nav_annual') },
      { id: 'investments', icon: 'trendingUp',    label: t('nav_investments') },
    ]},
    { id: 'meds', items: [
      { id: 'medications', icon: 'pill', label: t('nav_medications') },
    ]},
  ];

  return (
    <aside className={"sb" + (collapsed ? " is-collapsed" : "")}>
      <div className="sb-top">
        <button className="sb-logo"
                onClick={() => onNav('home')}
                aria-label={BRAND_NAME}
                title={collapsed ? BRAND_NAME : undefined}>
          {collapsed ? (
            <span className="sb-logo-dot" aria-hidden="true" />
          ) : (
            <svg width="86" height="28" viewBox="0 0 124 40" fill="none" aria-hidden="true">
              <text x="0" y="29" fontFamily="Onest, system-ui, sans-serif" fontWeight="900" fontSize="28" letterSpacing="-0.03em"
                    textLength="118" lengthAdjust="spacingAndGlyphs">
                <tspan className="logo-word" fill="#F5F5F7">{BRAND_NAME}</tspan>
              </text>
            </svg>
          )}
        </button>
        <button className="sb-toggle"
                onClick={() => setCollapsed(v => !v)}
                title={collapsed ? t('sb_expand') : t('sb_collapse')}
                aria-label={collapsed ? t('sb_expand') : t('sb_collapse')}>
          {collapsed ? I.chevRight({ size: 14 }) : I.chevLeft({ size: 14 })}
        </button>
      </div>

      <nav className="sb-nav">
        {sections.map((sec, secIdx) => (
          <React.Fragment key={sec.id}>
            {secIdx > 0 && <div className="sb-divider" aria-hidden="true" />}
            {sec.items.map(it => (
              <button key={it.id}
                      className={"sb-item" + (route === it.id ? " is-active" : "")}
                      onClick={() => onNav(it.id)}
                      data-tooltip={it.label}
                      aria-label={it.label}>
                <span className="sb-icon">{I[it.icon] ? I[it.icon]() : null}</span>
                <span className="sb-label">{it.label}</span>
                {it.count != null && it.count > 0 && (
                  <span className="sb-count mono">{it.count}</span>
                )}
              </button>
            ))}
          </React.Fragment>
        ))}
      </nav>

      <div className="sb-foot">
        <button className={"sb-item sb-settings" + (route === 'settings' ? " is-active" : "")}
                onClick={() => onNav('settings')}
                data-tooltip={t('set_title')}
                aria-label={t('set_title')}>
          <span className="sb-icon">{I.command && I.command()}</span>
          <span className="sb-label">{t('set_title')}</span>
        </button>
        {!collapsed && (() => {
          /* JENKIN account block: the profile name only when the user
             entered one (never invented), the authenticated email on its
             own wrapping line, and the provider's actual sync phase on a
             separate warm-beige line — never a hardcoded "synced". */
          const name = typeof accountName === 'string' ? accountName.trim() : '';
          const initial = (name || user?.email || '?').slice(0, 1);
          return (
            <div className="sb-foot-row sb-account">
              <div className="sb-avatar" aria-hidden="true">{name ? initial.toUpperCase() : initial.toLowerCase()}</div>
              <div className="sb-foot-meta">
                {name ? <div className="sb-account-name">{name}</div> : null}
                <div className="sb-foot-name" title={user?.email || undefined}>{accountEmailParts(user?.email)}</div>
              </div>
              <div className={`sb-foot-sub sb-sync is-${syncPhase} mono`}>
                <span className="sb-sync-dot" aria-hidden="true" />
                <span className="sb-sync-text">{t(`sync_${syncPhase}`)}</span>
              </div>
            </div>
          );
        })()}
      </div>
    </aside>
  );
}

/* A long email wraps instead of shrinking or clipping: the preferred break
   is just before "@", and CSS (overflow-wrap:anywhere) breaks further only
   when one part is still wider than the sidebar. */
function accountEmailParts(email) {
  if (!email) return '—';
  const at = email.indexOf('@');
  if (at <= 0) return email;
  return <>{email.slice(0, at)}<wbr />{email.slice(at)}</>;
}

export { Sidebar, accountEmailParts };
