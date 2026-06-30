/* global React, ReactDOM */
const {
  useState: useStateApp,
  useEffect: useEffectApp,
  useMemo: useMemoApp,
  useContext: useCtxApp,
} = React;

/* ── Routes ────────────────────────────────────────────────
   v2 nav tree. Each route has an id used both as state key and as the
   URL hash (#/<id>). Add a new tab → drop an entry here + render it in
   the switch below + add a sidebar item. */
const LIFE_ROUTES = new Set([
  'home', 'calendar', 'notes',
  'me', 'tasks', 'habits', 'goals', 'health', 'dog',
  'finances', 'monthly', 'annual', 'investments',
  'medications',
  'settings',
]);

function readRouteFromHash() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '');
  /* Sprint 3A · medications sub-routes: /medications/{id} → still
     dispatch the medications surface; the page reads the id itself. */
  if (raw.startsWith('medications/') || raw === 'medications') return 'medications';
  return LIFE_ROUTES.has(raw) ? raw : 'home';
}

/* ── Sidebar collapse persistence ──────────────────────────
   localStorage.lifeOsSidebar = 'collapsed' | 'expanded' (default expanded).
   Synced to <html> data-sb attribute so CSS can react if it ever needs to. */
function useSidebarCollapsed() {
  const [collapsed, setCollapsedRaw] = useStateApp(() => {
    try { return localStorage.getItem('lifeOsSidebar') === 'collapsed'; }
    catch (e) { return false; }
  });
  useEffectApp(() => {
    try { localStorage.setItem('lifeOsSidebar', collapsed ? 'collapsed' : 'expanded'); }
    catch (e) {}
  }, [collapsed]);
  function setCollapsed(next) {
    setCollapsedRaw(typeof next === 'function' ? next : !!next);
  }
  return [collapsed, setCollapsed];
}

/* ── Theme controller ────────────────────────────────────── */
function useTheme() {
  const [prefMode, setPrefMode] = useStateApp(() => {
    try {
      const v = localStorage.getItem('lifeOsTheme');
      if (v === 'dark' || v === 'light' || v === 'paradise') return v;
    } catch (e) {}
    return 'system';
  });

  const [systemTheme, setSystemTheme] = useStateApp(() =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  );

  useEffectApp(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = e => setSystemTheme(e.matches ? 'light' : 'dark');
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler);
    };
  }, []);

  const effective = prefMode === 'system' ? systemTheme : prefMode;

  useEffectApp(() => {
    /* Suppress transitions across the theme swap. Translucent surfaces
       fed by var(--surface) with a background-color transition otherwise
       get "stuck" at the old value (custom-property transition repaint
       bug) — disabling transitions makes the new tokens apply instantly,
       then we restore them next frame for normal hover animation. */
    const el = document.documentElement;
    el.classList.add('theme-switching');
    el.setAttribute('data-theme', effective);
    void el.offsetHeight; /* force reflow with transitions off */
    const id = requestAnimationFrame(() => el.classList.remove('theme-switching'));
    return () => cancelAnimationFrame(id);
  }, [effective]);

  /* Sprint 3.6 · paradise scene clock — when paradise is active,
     data-scene="day"|"night" is resolved from Kyiv time (day 06:00–19:59)
     and re-checked every 60s. Removed entirely under dark/light. */
  useEffectApp(() => {
    const el = document.documentElement;
    if (effective !== 'paradise') {
      el.removeAttribute('data-scene');
      return;
    }
    function kyivHour() {
      try {
        return parseInt(new Intl.DateTimeFormat('en-US',
          { timeZone: 'Europe/Kiev', hour: 'numeric', hour12: false })
          .format(new Date()), 10) % 24;
      } catch (e) { return new Date().getHours(); }
    }
    function applyScene() {
      const h = kyivHour();
      const next = (h >= 20 || h < 6) ? 'night' : 'day';
      if (el.getAttribute('data-scene') === next) return;
      /* Same var()-fed-transition freeze as the data-theme guard
         (Sprint 3.5): kill .app transitions for one frame around the
         scene token swap so cards/sidebar snap to the new scene's
         values instead of freezing mid-transition. The scene layers
         sit outside .app, so their 1.4s crossfade is unaffected. */
      el.classList.add('scene-switching');
      el.setAttribute('data-scene', next);
      void el.offsetHeight;
      requestAnimationFrame(() => el.classList.remove('scene-switching'));
    }
    applyScene();
    const id = setInterval(applyScene, 60000);
    return () => clearInterval(id);
  }, [effective]);

  function setTheme(next) {
    setPrefMode(next);
    try {
      if (next === 'system') localStorage.removeItem('lifeOsTheme');
      else                   localStorage.setItem('lifeOsTheme', next);
    } catch (e) {}
  }

  return [prefMode, effective, setTheme];
}

/* AppShell · all the existing chrome + routing. Lives inside the
   LifeDataProvider so it can read tasks/quickNotes/profile/dog from
   the central tree and dispatch mutations through the same provider.
   UI-only state (toast, modal open flags, milestone, demo-rail
   empty-mode toggle) stays local — those are ephemeral, not persisted. */
function AppShell() {
  const data = useCtxApp(window.LifeDataContext);
  const persist = data.state;

  const [locale, setLocale]       = useStateApp('ru');
  const [themeMode, themeEff, setTheme] = useTheme();
  const [route, setRouteRaw]      = useStateApp(() => readRouteFromHash());
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [toast, setToast]         = useStateApp(null);
  const [milestone, setMilestone] = useStateApp({ days: 30, habitKey: 'habit_no_phone' });
  const [quickOpen, setQuickOpen] = useStateApp(false);
  const [quickStakes, setQStakes] = useStateApp(false);
  const [quickSeed, setQuickSeed] = useStateApp(null);
  const [detailTask, setDetail]   = useStateApp(null);
  const [emptyMode, setEmptyMode] = useStateApp(false);

  function setRoute(next) {
    if (!LIFE_ROUTES.has(next) && !next.startsWith('medications/')) next = 'home';
    setRouteRaw(LIFE_ROUTES.has(next) ? next : 'medications');
    const target = '#/' + next;
    if (window.location.hash !== target) window.location.hash = target;
  }
  useEffectApp(() => {
    function onHash() { setRouteRaw(readRouteFromHash()); }
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/' + route;
    return () => window.removeEventListener('hashchange', onHash);
    /* eslint-disable-next-line */
  }, []);
  useEffectApp(() => {
    document.documentElement.setAttribute('data-route', route);
  }, [route]);

  const t = useMemoApp(() => window.LifeMakeT(locale), [locale]);
  const ctxValue = useMemoApp(() => ({ locale, setLocale, t, themeMode, themeEff, setTheme }),
                              [locale, t, themeMode, themeEff]);

  /* Seed tasks resolve titles through i18n; user-added tasks store
     literal title. Same logic as Sprint 2 — just sourced from the
     persisted state tree instead of local useState. */
  const tasks = persist.tasks || [];
  const quickNotes = persist.quickNotes || [];
  const profile = persist.profile || {};
  const dog = persist.dog || {};

  const resolvedTasks = useMemoApp(() =>
    tasks.map(task => ({
      ...task,
      title: task.title != null ? task.title : t(task.titleKey),
      due:   task.due === 'eod' ? t('due_eod') : task.due === 'tue' ? t('due_tue') : task.due,
    }))
  , [tasks, t]);

  function addTaskFromUI({ title, stakes, category, schedule, notes, fromNoteId }) {
    const task = {
      id: Date.now(),
      title,
      done: false,
      stakes,
      tag: stakes ? 'today' : (category ? null : 'inbox'),
      tagLabel: category ? category.name[locale] : null,
      due: stakes ? t('due_eod') : (schedule && schedule.time ? schedule.time : ''),
      schedule,
      notes,
    };
    data.addTask(task);
    if (fromNoteId != null) data.deleteQuickNote(fromNoteId);
    showToast({
      kind: 'sys',
      msg: stakes ? t('toast_committed', title) : t('toast_added', title),
      ts: new Date().toTimeString().slice(0,5) + ' · ' + t('nav_today'),
    });
  }

  function showToast(toastObj) {
    setToast(toastObj);
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => setToast(null), 4200);
  }
  function fireBot() {
    const hr = new Date().toTimeString().slice(0,5);
    showToast({ kind: 'bot', msg: t('toast_bot_run', hr), ts: hr + ' · ' + t('nav_today') });
  }
  function fireMilestone() {
    const tiers = [
      { days: 7,   habitKey: 'habit_read' },
      { days: 30,  habitKey: 'habit_no_phone' },
      { days: 100, habitKey: 'habit_walk' },
    ];
    const idx = milestone ? tiers.findIndex(t2 => t2.days === milestone.days) : -1;
    setMilestone(tiers[(idx + 1) % tiers.length]);
  }
  function openQuickAdd(stakes = false, seed = null) {
    setQStakes(stakes);
    setQuickSeed(seed);
    setQuickOpen(true);
  }

  /* cmd-K opens quick add */
  useEffectApp(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openQuickAdd(false);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  /* Paradise capsule click physics (Sprint 3.6 Batch 2.5).
     Delegated pointer listeners — covers capsule buttons inside
     lazily-mounted modals/drawers without per-button wiring.
     pointerdown → .pressing (CSS eases into scale+tilt);
     pointerup/leave/cancel → .releasing (damped wobble keyframe,
     removed on animationend). Paradise-only; under dark/light the
     classes are never added. Under prefers-reduced-motion the CSS
     neutralizes the transform/wobble (press = brightness dip). */
  useEffectApp(() => {
    const SEL = '.qa-btn-save, .set-btn-primary, .money-log, .medc-action-take, .btn--stakes, .btn--positive';
    let pressed = null;
    function release() {
      if (!pressed) return;
      const b = pressed;
      pressed = null;
      b.removeEventListener('pointerleave', release);
      if (!b.classList.contains('pressing')) return;
      b.classList.remove('pressing');
      b.classList.add('releasing');
    }
    function down(e) {
      if (document.documentElement.getAttribute('data-theme') !== 'paradise') return;
      const b = e.target.closest ? e.target.closest(SEL) : null;
      if (!b || b.disabled) return;
      pressed = b;
      b.classList.remove('releasing');
      b.classList.add('pressing');
      b.addEventListener('pointerleave', release);
    }
    function onAnimEnd(e) {
      if (e.animationName === 'paradise-btn-wobble') e.target.classList.remove('releasing');
    }
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    document.addEventListener('animationend', onAnimEnd, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      document.removeEventListener('animationend', onAnimEnd, true);
    };
  }, []);

  const counts = {
    notes:  quickNotes.length,
    tasks:  resolvedTasks.filter(x => !x.done).length,
    habits: 7,
    goals:  3,
  };

  function renderRoute() {
    switch (route) {
      case 'home':
        return <window.HomePage
                  onNav={setRoute}
                  emptyMode={emptyMode}
                  onOpenTask={(row) => setDetail({
                    id: row.id,
                    title: row['title_' + locale] || row.title_ru || '',
                    done: false,
                    stakes: !!row.stakes,
                    tag: row.overdue ? 'today' : (row.stakes ? 'stakes' : 'today'),
                    due: row.when ? (row.when['label_' + locale] || row.when.label_ru) : '',
                  })} />;
      case 'calendar':
        return <window.CalendarView
                  onAddSlot={() => openQuickAdd(false)}
                  onOpenTask={(task) => setDetail({
                    id: task.id,
                    title: task.titleKey ? t(task.titleKey) : (task.title || ''),
                    done: !!task.done,
                    stakes: !!task.stakes,
                    tag: task.tag || (task.stakes ? 'stakes' : 'today'),
                    due: task.due || '',
                  })} />;
      case 'notes':
        return (
          <window.QuickNotesPage
            notes={quickNotes}
            onAdd={(text) => data.addQuickNote(text)}
            onDelete={(id) => data.deleteQuickNote(id)}
            onPromote={(note) => openQuickAdd(false, { title: note.text, fromNoteId: note.id })}
          />
        );
      case 'me':
        return <window.ProfilePage profile={profile} onUpdate={data.updateProfile} />;
      case 'tasks':
        return (
          <window.TasksPage
            tasks={emptyMode ? [] : resolvedTasks}
            onToggle={data.toggleTask}
            onAdd={addTaskFromUI}
            onOpen={(task) => setDetail(task)}
          />
        );
      case 'habits':
        return <window.HabitsPage emptyMode={emptyMode} />;
      case 'goals':
        return <window.GoalsPage emptyMode={emptyMode} />;
      case 'health':
        return <window.HealthPage />;
      case 'dog':
        return <window.DogPage dog={dog} onUpdate={data.updateDog} locale={locale} t={t} />;
      case 'finances':
        return <window.FinancesPage emptyMode={emptyMode} />;
      case 'monthly':
        return <window.PlaceholderPage title={t('ph_monthly_title')} body={t('ph_monthly_body')} />;
      case 'annual':
        return <window.PlaceholderPage title={t('ph_annual_title')} body={t('ph_annual_body')} />;
      case 'investments':
        return <window.PlaceholderPage title={t('ph_invest_title')} body={t('ph_invest_body')} />;
      case 'medications':
        return <window.MedicationsPage />;
      case 'settings':
        return <window.SettingsPage />;
      default:
        return <window.PlaceholderPage title={t('ph_home_title')} body={t('ph_home_body')} />;
    }
  }

  return (
    <window.LifeLocaleContext.Provider value={ctxValue}>
      {themeEff === 'paradise' && <window.ParadiseScene />}
      <div className="app" data-sb={collapsed ? 'collapsed' : 'expanded'}>
        <window.Sidebar
          route={route}
          onNav={setRoute}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          counts={counts} />

        <main className="main">
          <window.TopBar onQuickAdd={() => openQuickAdd(false)} />
          {renderRoute()}
        </main>

        <div className="demo-rail">
          <button className="demo-btn" onClick={fireBot}>tg test</button>
          <button className="demo-btn" onClick={() => showToast({ kind: 'sys', msg: t('toast_expense', '4.20', t('habit_read')), ts: new Date().toTimeString().slice(0,5) + ' · ' + t('nav_today') })}>sys test</button>
          <button className="demo-btn" onClick={fireMilestone}>cycle milestone</button>
          <button className="demo-btn" onClick={() => openQuickAdd(false)}>⌘ K</button>
          <button className={"demo-btn" + (emptyMode ? " is-on" : "")} onClick={() => setEmptyMode(v => !v)}>empty states {emptyMode ? 'ON' : 'OFF'}</button>
          <button className="demo-btn" onClick={() => setRoute('settings')}>settings</button>
          <div className="demo-locale">
            {window.LifeLocales.map(loc => (
              <button key={loc}
                      className={"demo-locale-btn mono" + (locale === loc ? " is-on" : "")}
                      onClick={() => setLocale(loc)}>{loc.toUpperCase()}</button>
            ))}
          </div>
          <div className="demo-locale" title="theme">
            <button className={"demo-locale-btn mono" + (themeMode === 'dark' ? " is-on" : "")}
                    onClick={() => setTheme('dark')}>D</button>
            <button className={"demo-locale-btn mono" + (themeMode === 'light' ? " is-on" : "")}
                    onClick={() => setTheme('light')}>L</button>
            <button className={"demo-locale-btn mono" + (themeMode === 'paradise' ? " is-on" : "")}
                    onClick={() => setTheme('paradise')}>P</button>
            <button className={"demo-locale-btn mono" + (themeMode === 'system' ? " is-on" : "")}
                    onClick={() => setTheme('system')}>S</button>
          </div>
        </div>

        <window.QuickAddModal
          open={quickOpen}
          defaultStakes={quickStakes}
          defaultTitle={quickSeed ? quickSeed.title : ''}
          onClose={() => { setQuickOpen(false); setQuickSeed(null); }}
          onSave={(payload) => {
            addTaskFromUI({ ...payload, fromNoteId: quickSeed ? quickSeed.fromNoteId : undefined });
            setQuickOpen(false);
            setQuickSeed(null);
          }}
        />

        {detailTask && (
          <window.TaskDetailModal
            task={detailTask}
            onClose={() => setDetail(null)}
            onUpdate={(t2) => data.updateTask(t2)}
            onComplete={(id) => data.toggleTask(id)}
            onDelete={(id) => data.deleteTask(id)}
          />
        )}

        <window.Toast toast={toast} />
        <window.MobileBottomNav active={route} onNav={setRoute} />
      </div>
    </window.LifeLocaleContext.Provider>
  );
}

/* App root · wraps the shell in the data provider so every nested
   surface (med cards, drawers, history timelines) can read and
   mutate the persisted tree via useContext(LifeDataContext). */
function App() {
  return (
    <window.LifeDataProvider>
      <AppShell />
    </window.LifeDataProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
