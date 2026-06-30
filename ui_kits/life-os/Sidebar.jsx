/* global React */
const { useContext: useCtxSB, useEffect: useEffectSB } = React;

/* v2 sidebar.
   Sections: MAIN / LIFE / MONEY / MEDS · settings pinned bottom.
   Two states: expanded (220px) and collapsed (60px, icons only).
   Active state = orange icon glow (not a ring around the icon).
   Counts come from props.counts so each route can update its own. */
function Sidebar({ route, onNav, collapsed, setCollapsed, counts = {} }) {
  const { t } = useCtxSB(window.LifeLocaleContext);
  const I = window.LIcons;

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
      { id: 'health', icon: 'heart',      label: t('nav_health') },
      { id: 'dog',    icon: 'paw',        label: t('nav_dog') },
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
                title={collapsed ? 'Life·OS' : undefined}>
          {collapsed ? (
            <span className="sb-logo-dot" aria-hidden="true" />
          ) : (
            <svg width="86" height="28" viewBox="0 0 124 40" fill="none">
              <defs>
                <linearGradient id="sbDot" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%"  stopColor="#FFC066"/>
                  <stop offset="48%" stopColor="#FF8A1E"/>
                  <stop offset="100%" stopColor="#FF6B0A"/>
                </linearGradient>
              </defs>
              <text x="0" y="29" fontFamily="Onest, system-ui, sans-serif" fontWeight="900" fontSize="28" letterSpacing="-0.03em">
                <tspan fill="#F5F5F7">Life</tspan>
                <tspan fill="url(#sbDot)">·</tspan>
                <tspan fill="#F5F5F7">OS</tspan>
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
        {!collapsed && (
          <div className="sb-foot-row">
            <div className="sb-avatar">d</div>
            <div className="sb-foot-meta">
              <div className="sb-foot-name">dogfood</div>
              <div className="sb-foot-sub mono">v0.5 · {t('footer_local')}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
