/* @ds-bundle: {"format":3,"namespace":"LifeOSDesignSystem_9f5940","components":[],"sourceHashes":{"ui_kits/life-os/App.jsx":"073dd29c60b1","ui_kits/life-os/CalendarView.jsx":"37fce588d3ce","ui_kits/life-os/GoalsWidget.jsx":"54f02d6a57c7","ui_kits/life-os/HabitsGrid.jsx":"598f1c588fdc","ui_kits/life-os/LifeDataProvider.jsx":"d2ba6d3b6aba","ui_kits/life-os/MobileBottomNav.jsx":"09a3b1848f06","ui_kits/life-os/MoneyWidget.jsx":"38e91f93400f","ui_kits/life-os/QuickAddModal.jsx":"b60df8439f15","ui_kits/life-os/SettingsPage.jsx":"78099f3751ac","ui_kits/life-os/Sidebar.jsx":"f9978f618944","ui_kits/life-os/StreakMilestone.jsx":"e32d8a351121","ui_kits/life-os/TaskDetailModal.jsx":"b306bb7dcf4c","ui_kits/life-os/TaskList.jsx":"d13e964d7792","ui_kits/life-os/Toast.jsx":"dba1f90f19a0","ui_kits/life-os/Today.jsx":"917545506420","ui_kits/life-os/TopBar.jsx":"b02512096dce","ui_kits/life-os/categories.jsx":"3bfb562b22f4","ui_kits/life-os/components/ActivityTimeline.jsx":"7514c3dafa87","ui_kits/life-os/components/EyeToggle.jsx":"6439e1076b2c","ui_kits/life-os/components/MultiChangeWarningModal.jsx":"f7ff2901e1c5","ui_kits/life-os/components/ParadiseScene.jsx":"6fbd04b684ed","ui_kits/life-os/data/calendar-seed.js":"4023d3e39ab6","ui_kits/life-os/data/dashboard-seed.js":"9151189f8849","ui_kits/life-os/data/dog.js":"fb2deb244f8c","ui_kits/life-os/data/medications.js":"0a043435542d","ui_kits/life-os/data/profile.js":"f37a3d03c3c7","ui_kits/life-os/i18n.jsx":"f90d5e501022","ui_kits/life-os/icons.jsx":"6bde995015cf","ui_kits/life-os/lib/activity.js":"4f0c07de95f0","ui_kits/life-os/lib/calendar.js":"681c15ba281f","ui_kits/life-os/lib/finance.js":"78af6b919cc4","ui_kits/life-os/lib/medMath.js":"79e20e72f8e5","ui_kits/life-os/lib/storage.js":"81fcd007edac","ui_kits/life-os/pages/DogPage.jsx":"00c8b31a3b01","ui_kits/life-os/pages/FinancesPage.jsx":"5fe7b68e233b","ui_kits/life-os/pages/HealthPage.jsx":"9b844c301647","ui_kits/life-os/pages/HomePage.jsx":"2b6de00b94c4","ui_kits/life-os/pages/MedicationsPage.jsx":"a552b075fa44","ui_kits/life-os/pages/PlaceholderPage.jsx":"e9c81829d039","ui_kits/life-os/pages/ProfilePage.jsx":"e813c00e4083","ui_kits/life-os/pages/QuickNotesPage.jsx":"fc26f04f061b","ui_kits/life-os/pages/RelocatedPages.jsx":"2479781dc6b0","ui_kits/life-os/pages/TasksPage.jsx":"300464ce35ce","ui_kits/life-os/pages/calendar/DayDetailModal.jsx":"615ef1b2ce80","ui_kits/life-os/pages/home/CategoryChart.jsx":"55eac53c4b84","ui_kits/life-os/pages/home/ChartCard.jsx":"a8c99312fdbe","ui_kits/life-os/pages/home/StatCard.jsx":"8aecc730d787","ui_kits/life-os/pages/home/TrendChart.jsx":"51dabe2872f2","ui_kits/life-os/pages/medications/GlobalJournal.jsx":"ca686af63375","ui_kits/life-os/pages/medications/MedCard.jsx":"41caaf309750","ui_kits/life-os/pages/medications/MedConfigDrawer.jsx":"e9cd62d19425","ui_kits/life-os/pages/medications/MedDetailPage.jsx":"9e66fedfb72b","ui_kits/life-os/pages/medications/PharmNotes.jsx":"32615a5fca0c","ui_kits/life-os/pages/medications/RefillModal.jsx":"e149b7bf84c9","ui_kits/life-os/pages/medications/TakeDoseModal.jsx":"827a0a752cfb","ui_kits/life-os/profile/EditableField.jsx":"4c717b04fc0b","ui_kits/life-os/profile/cards/BodyMetricsCard.jsx":"239a1d8f0f14","ui_kits/life-os/profile/cards/ClothingSizesCard.jsx":"663b58272f63","ui_kits/life-os/profile/cards/FoodPreferencesCard.jsx":"ef642b8cbe5b","ui_kits/life-os/profile/cards/IdentityCard.jsx":"4c80d7b38419","ui_kits/life-os/profile/cards/MeasurementsCard.jsx":"bac9272896a1"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.LifeOSDesignSystem_9f5940 = window.LifeOSDesignSystem_9f5940 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/life-os/App.jsx
try { (() => {
/* global React, ReactDOM */
const {
  useState: useStateApp,
  useEffect: useEffectApp,
  useMemo: useMemoApp,
  useContext: useCtxApp
} = React;

/* ── Routes ────────────────────────────────────────────────
   v2 nav tree. Each route has an id used both as state key and as the
   URL hash (#/<id>). Add a new tab → drop an entry here + render it in
   the switch below + add a sidebar item. */
const LIFE_ROUTES = new Set(['home', 'calendar', 'notes', 'me', 'tasks', 'habits', 'goals', 'health', 'dog', 'finances', 'monthly', 'annual', 'investments', 'medications', 'settings']);
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
    try {
      return localStorage.getItem('lifeOsSidebar') === 'collapsed';
    } catch (e) {
      return false;
    }
  });
  useEffectApp(() => {
    try {
      localStorage.setItem('lifeOsSidebar', collapsed ? 'collapsed' : 'expanded');
    } catch (e) {}
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
  const [systemTheme, setSystemTheme] = useStateApp(() => window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
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
        return parseInt(new Intl.DateTimeFormat('en-US', {
          timeZone: 'Europe/Kiev',
          hour: 'numeric',
          hour12: false
        }).format(new Date()), 10) % 24;
      } catch (e) {
        return new Date().getHours();
      }
    }
    function applyScene() {
      const h = kyivHour();
      const next = h >= 20 || h < 6 ? 'night' : 'day';
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
      if (next === 'system') localStorage.removeItem('lifeOsTheme');else localStorage.setItem('lifeOsTheme', next);
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
  const [locale, setLocale] = useStateApp('ru');
  const [themeMode, themeEff, setTheme] = useTheme();
  const [route, setRouteRaw] = useStateApp(() => readRouteFromHash());
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [toast, setToast] = useStateApp(null);
  const [milestone, setMilestone] = useStateApp({
    days: 30,
    habitKey: 'habit_no_phone'
  });
  const [quickOpen, setQuickOpen] = useStateApp(false);
  const [quickStakes, setQStakes] = useStateApp(false);
  const [quickSeed, setQuickSeed] = useStateApp(null);
  const [detailTask, setDetail] = useStateApp(null);
  const [emptyMode, setEmptyMode] = useStateApp(false);
  function setRoute(next) {
    if (!LIFE_ROUTES.has(next) && !next.startsWith('medications/')) next = 'home';
    setRouteRaw(LIFE_ROUTES.has(next) ? next : 'medications');
    const target = '#/' + next;
    if (window.location.hash !== target) window.location.hash = target;
  }
  useEffectApp(() => {
    function onHash() {
      setRouteRaw(readRouteFromHash());
    }
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/' + route;
    return () => window.removeEventListener('hashchange', onHash);
    /* eslint-disable-next-line */
  }, []);
  useEffectApp(() => {
    document.documentElement.setAttribute('data-route', route);
  }, [route]);
  const t = useMemoApp(() => window.LifeMakeT(locale), [locale]);
  const ctxValue = useMemoApp(() => ({
    locale,
    setLocale,
    t,
    themeMode,
    themeEff,
    setTheme
  }), [locale, t, themeMode, themeEff]);

  /* Seed tasks resolve titles through i18n; user-added tasks store
     literal title. Same logic as Sprint 2 — just sourced from the
     persisted state tree instead of local useState. */
  const tasks = persist.tasks || [];
  const quickNotes = persist.quickNotes || [];
  const profile = persist.profile || {};
  const dog = persist.dog || {};
  const resolvedTasks = useMemoApp(() => tasks.map(task => ({
    ...task,
    title: task.title != null ? task.title : t(task.titleKey),
    due: task.due === 'eod' ? t('due_eod') : task.due === 'tue' ? t('due_tue') : task.due
  })), [tasks, t]);
  function addTaskFromUI({
    title,
    stakes,
    category,
    schedule,
    notes,
    fromNoteId
  }) {
    const task = {
      id: Date.now(),
      title,
      done: false,
      stakes,
      tag: stakes ? 'today' : category ? null : 'inbox',
      tagLabel: category ? category.name[locale] : null,
      due: stakes ? t('due_eod') : schedule && schedule.time ? schedule.time : '',
      schedule,
      notes
    };
    data.addTask(task);
    if (fromNoteId != null) data.deleteQuickNote(fromNoteId);
    showToast({
      kind: 'sys',
      msg: stakes ? t('toast_committed', title) : t('toast_added', title),
      ts: new Date().toTimeString().slice(0, 5) + ' · ' + t('nav_today')
    });
  }
  function showToast(toastObj) {
    setToast(toastObj);
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => setToast(null), 4200);
  }
  function fireBot() {
    const hr = new Date().toTimeString().slice(0, 5);
    showToast({
      kind: 'bot',
      msg: t('toast_bot_run', hr),
      ts: hr + ' · ' + t('nav_today')
    });
  }
  function fireMilestone() {
    const tiers = [{
      days: 7,
      habitKey: 'habit_read'
    }, {
      days: 30,
      habitKey: 'habit_no_phone'
    }, {
      days: 100,
      habitKey: 'habit_walk'
    }];
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
    notes: quickNotes.length,
    tasks: resolvedTasks.filter(x => !x.done).length,
    habits: 7,
    goals: 3
  };
  function renderRoute() {
    switch (route) {
      case 'home':
        return /*#__PURE__*/React.createElement(window.HomePage, {
          onNav: setRoute,
          emptyMode: emptyMode,
          onOpenTask: row => setDetail({
            id: row.id,
            title: row['title_' + locale] || row.title_ru || '',
            done: false,
            stakes: !!row.stakes,
            tag: row.overdue ? 'today' : row.stakes ? 'stakes' : 'today',
            due: row.when ? row.when['label_' + locale] || row.when.label_ru : ''
          })
        });
      case 'calendar':
        return /*#__PURE__*/React.createElement(window.CalendarView, {
          onAddSlot: () => openQuickAdd(false),
          onOpenTask: task => setDetail({
            id: task.id,
            title: task.titleKey ? t(task.titleKey) : task.title || '',
            done: !!task.done,
            stakes: !!task.stakes,
            tag: task.tag || (task.stakes ? 'stakes' : 'today'),
            due: task.due || ''
          })
        });
      case 'notes':
        return /*#__PURE__*/React.createElement(window.QuickNotesPage, {
          notes: quickNotes,
          onAdd: text => data.addQuickNote(text),
          onDelete: id => data.deleteQuickNote(id),
          onPromote: note => openQuickAdd(false, {
            title: note.text,
            fromNoteId: note.id
          })
        });
      case 'me':
        return /*#__PURE__*/React.createElement(window.ProfilePage, {
          profile: profile,
          onUpdate: data.updateProfile
        });
      case 'tasks':
        return /*#__PURE__*/React.createElement(window.TasksPage, {
          tasks: emptyMode ? [] : resolvedTasks,
          onToggle: data.toggleTask,
          onAdd: addTaskFromUI,
          onOpen: task => setDetail(task)
        });
      case 'habits':
        return /*#__PURE__*/React.createElement(window.HabitsPage, {
          emptyMode: emptyMode
        });
      case 'goals':
        return /*#__PURE__*/React.createElement(window.GoalsPage, {
          emptyMode: emptyMode
        });
      case 'health':
        return /*#__PURE__*/React.createElement(window.HealthPage, null);
      case 'dog':
        return /*#__PURE__*/React.createElement(window.DogPage, {
          dog: dog,
          onUpdate: data.updateDog,
          locale: locale,
          t: t
        });
      case 'finances':
        return /*#__PURE__*/React.createElement(window.FinancesPage, {
          emptyMode: emptyMode
        });
      case 'monthly':
        return /*#__PURE__*/React.createElement(window.PlaceholderPage, {
          title: t('ph_monthly_title'),
          body: t('ph_monthly_body')
        });
      case 'annual':
        return /*#__PURE__*/React.createElement(window.PlaceholderPage, {
          title: t('ph_annual_title'),
          body: t('ph_annual_body')
        });
      case 'investments':
        return /*#__PURE__*/React.createElement(window.PlaceholderPage, {
          title: t('ph_invest_title'),
          body: t('ph_invest_body')
        });
      case 'medications':
        return /*#__PURE__*/React.createElement(window.MedicationsPage, null);
      case 'settings':
        return /*#__PURE__*/React.createElement(window.SettingsPage, null);
      default:
        return /*#__PURE__*/React.createElement(window.PlaceholderPage, {
          title: t('ph_home_title'),
          body: t('ph_home_body')
        });
    }
  }
  return /*#__PURE__*/React.createElement(window.LifeLocaleContext.Provider, {
    value: ctxValue
  }, themeEff === 'paradise' && /*#__PURE__*/React.createElement(window.ParadiseScene, null), /*#__PURE__*/React.createElement("div", {
    className: "app",
    "data-sb": collapsed ? 'collapsed' : 'expanded'
  }, /*#__PURE__*/React.createElement(window.Sidebar, {
    route: route,
    onNav: setRoute,
    collapsed: collapsed,
    setCollapsed: setCollapsed,
    counts: counts
  }), /*#__PURE__*/React.createElement("main", {
    className: "main"
  }, /*#__PURE__*/React.createElement(window.TopBar, {
    onQuickAdd: () => openQuickAdd(false)
  }), renderRoute()), /*#__PURE__*/React.createElement("div", {
    className: "demo-rail"
  }, /*#__PURE__*/React.createElement("button", {
    className: "demo-btn",
    onClick: fireBot
  }, "tg test"), /*#__PURE__*/React.createElement("button", {
    className: "demo-btn",
    onClick: () => showToast({
      kind: 'sys',
      msg: t('toast_expense', '4.20', t('habit_read')),
      ts: new Date().toTimeString().slice(0, 5) + ' · ' + t('nav_today')
    })
  }, "sys test"), /*#__PURE__*/React.createElement("button", {
    className: "demo-btn",
    onClick: fireMilestone
  }, "cycle milestone"), /*#__PURE__*/React.createElement("button", {
    className: "demo-btn",
    onClick: () => openQuickAdd(false)
  }, "\u2318 K"), /*#__PURE__*/React.createElement("button", {
    className: "demo-btn" + (emptyMode ? " is-on" : ""),
    onClick: () => setEmptyMode(v => !v)
  }, "empty states ", emptyMode ? 'ON' : 'OFF'), /*#__PURE__*/React.createElement("button", {
    className: "demo-btn",
    onClick: () => setRoute('settings')
  }, "settings"), /*#__PURE__*/React.createElement("div", {
    className: "demo-locale"
  }, window.LifeLocales.map(loc => /*#__PURE__*/React.createElement("button", {
    key: loc,
    className: "demo-locale-btn mono" + (locale === loc ? " is-on" : ""),
    onClick: () => setLocale(loc)
  }, loc.toUpperCase()))), /*#__PURE__*/React.createElement("div", {
    className: "demo-locale",
    title: "theme"
  }, /*#__PURE__*/React.createElement("button", {
    className: "demo-locale-btn mono" + (themeMode === 'dark' ? " is-on" : ""),
    onClick: () => setTheme('dark')
  }, "D"), /*#__PURE__*/React.createElement("button", {
    className: "demo-locale-btn mono" + (themeMode === 'light' ? " is-on" : ""),
    onClick: () => setTheme('light')
  }, "L"), /*#__PURE__*/React.createElement("button", {
    className: "demo-locale-btn mono" + (themeMode === 'paradise' ? " is-on" : ""),
    onClick: () => setTheme('paradise')
  }, "P"), /*#__PURE__*/React.createElement("button", {
    className: "demo-locale-btn mono" + (themeMode === 'system' ? " is-on" : ""),
    onClick: () => setTheme('system')
  }, "S"))), /*#__PURE__*/React.createElement(window.QuickAddModal, {
    open: quickOpen,
    defaultStakes: quickStakes,
    defaultTitle: quickSeed ? quickSeed.title : '',
    onClose: () => {
      setQuickOpen(false);
      setQuickSeed(null);
    },
    onSave: payload => {
      addTaskFromUI({
        ...payload,
        fromNoteId: quickSeed ? quickSeed.fromNoteId : undefined
      });
      setQuickOpen(false);
      setQuickSeed(null);
    }
  }), detailTask && /*#__PURE__*/React.createElement(window.TaskDetailModal, {
    task: detailTask,
    onClose: () => setDetail(null),
    onUpdate: t2 => data.updateTask(t2),
    onComplete: id => data.toggleTask(id),
    onDelete: id => data.deleteTask(id)
  }), /*#__PURE__*/React.createElement(window.Toast, {
    toast: toast
  }), /*#__PURE__*/React.createElement(window.MobileBottomNav, {
    active: route,
    onNav: setRoute
  })));
}

/* App root · wraps the shell in the data provider so every nested
   surface (med cards, drawers, history timelines) can read and
   mutate the persisted tree via useContext(LifeDataContext). */
function App() {
  return /*#__PURE__*/React.createElement(window.LifeDataProvider, null, /*#__PURE__*/React.createElement(AppShell, null));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/CalendarView.jsx
try { (() => {
/* global React */
const {
  useState: useStateCal,
  useContext: useCtxCal,
  useMemo: useMemoCal,
  useCallback: useCbCal
} = React;

/* Sprint 3B · CalendarView redesign.
   Replaces the v1 hour-grid with a thin-pill day-cell layout:
     · 7 day columns (Mon-first), each tall enough for up to 8 pills.
     · Pill = 3px colored left bar + HH:MM mono + truncated title (18px tall).
     · 9th+ event → "+ N ещё" overflow row → opens DayDetailModal.
     · Today column gets the locked --blue tint (NOT stakes orange).
     · Density (N=8) hardcoded for 3B; Settings slider says "Sprint 4".
   Events come from lib/calendar.js aggregator. */

const CAL_MAX_PILLS = 8;
const CAL_VISIBLE_BEFORE_OVERFLOW = 7; // 8th slot used by "+N ещё"

function CalendarView({
  onAddSlot,
  onOpenTask
}) {
  const {
    t,
    locale
  } = useCtxCal(window.LifeLocaleContext);
  const data = useCtxCal(window.LifeDataContext);
  const intlLoc = window.LifeStrings[locale]._intl_locale;
  const [anchor, setAnchor] = useStateCal(new Date());
  const [dayModal, setDayModal] = useStateCal(null); // Date | null

  /* Mon-first week of `anchor`. */
  const weekStart = useMemoCal(() => {
    const d = new Date(anchor);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [anchor]);
  const days = useMemoCal(() => Array.from({
    length: 7
  }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);
  const {
    days: buckets,
    todayIdx
  } = useMemoCal(() => window.LifeCalendar.aggregate(weekStart, data.state, t), [weekStart, data.state, t]);
  const monthLabel = days[3].toLocaleDateString(intlLoc, {
    month: 'long',
    year: 'numeric'
  });
  function moveWeek(delta) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + delta * 7);
    setAnchor(d);
  }
  function jumpToday() {
    setAnchor(new Date());
  }
  function openDay(d) {
    setDayModal(d);
  }
  function closeDay() {
    setDayModal(null);
  }

  /* Click routing for pills + day-modal rows. */
  const handlePill = useCbCal(ev => {
    if (!ev) return;
    if (ev.entity && ev.entity.type === 'task' && onOpenTask) {
      const task = (data.state.tasks || []).find(x => String(x.id) === String(ev.entity.id));
      if (task) onOpenTask(task);
      return;
    }
    /* All other entity types route through the day-detail modal for
       now — Sprint 4 wires per-source detail surfaces (bills →
       TransactionDetailModal, meds → MedDetailPage, etc). */
    // no-op for now
  }, [data.state.tasks, onOpenTask]);
  return /*#__PURE__*/React.createElement("div", {
    className: "cal cal-pill-view"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cal-head"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "cal-h"
  }, monthLabel), /*#__PURE__*/React.createElement("div", {
    className: "cal-nav"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cal-btn",
    onClick: () => moveWeek(-1),
    "aria-label": t('cal_prev')
  }, t('cal_prev')), /*#__PURE__*/React.createElement("button", {
    className: "cal-btn mono",
    onClick: jumpToday
  }, t('cal_today')), /*#__PURE__*/React.createElement("button", {
    className: "cal-btn",
    onClick: () => moveWeek(1),
    "aria-label": t('cal_next')
  }, t('cal_next'))), /*#__PURE__*/React.createElement("div", {
    className: "cal-views mono"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cal-view-btn is-on"
  }, t('cal_week')))), /*#__PURE__*/React.createElement("div", {
    className: "cal-pill-grid"
  }, days.map((d, i) => {
    const events = buckets[i] || [];
    const isToday = i === todayIdx;
    const overflow = Math.max(0, events.length - CAL_VISIBLE_BEFORE_OVERFLOW);
    const shown = overflow > 0 ? events.slice(0, CAL_VISIBLE_BEFORE_OVERFLOW) : events.slice(0, CAL_MAX_PILLS);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "cal-day" + (isToday ? " is-today" : "")
    }, /*#__PURE__*/React.createElement("div", {
      className: "cal-day-head"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cal-day-dow mono"
    }, d.toLocaleDateString(intlLoc, {
      weekday: 'short'
    }).replace('.', '')), /*#__PURE__*/React.createElement("div", {
      className: "cal-day-num" + (isToday ? " is-today" : "")
    }, d.getDate())), /*#__PURE__*/React.createElement("div", {
      className: "cal-day-body",
      onClick: () => onAddSlot && onAddSlot(d)
    }, events.length === 0 && /*#__PURE__*/React.createElement("div", {
      className: "cal-day-empty mono"
    }, t('cal_quiet_day')), shown.map(ev => /*#__PURE__*/React.createElement(CalPill, {
      key: ev.id,
      ev: ev,
      onClick: e => {
        e.stopPropagation();
        handlePill(ev);
      }
    })), overflow > 0 && /*#__PURE__*/React.createElement("button", {
      className: "cal-pill cal-pill-more mono",
      onClick: e => {
        e.stopPropagation();
        openDay(d);
      }
    }, t('cal_more_n', overflow))));
  })), dayModal && /*#__PURE__*/React.createElement(window.DayDetailModal, {
    date: dayModal,
    events: buckets[days.findIndex(x => x.getFullYear() === dayModal.getFullYear() && x.getMonth() === dayModal.getMonth() && x.getDate() === dayModal.getDate())] || [],
    onClose: closeDay,
    onAddEvent: () => {
      closeDay();
      onAddSlot && onAddSlot(dayModal);
    },
    onOpenEvent: handlePill
  }));
}

/* Inner pill — kept inline so styles stay local. */
function CalPill({
  ev,
  onClick
}) {
  const kindClass = ev.kind === 'stakes' ? ' is-stakes' : ev.kind === 'routine' ? ' is-routine' : ' is-info';
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cal-pill" + kindClass,
    onClick: onClick,
    title: ev.time + ' · ' + ev.title
  }, /*#__PURE__*/React.createElement("span", {
    className: "cal-pill-bar",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cal-pill-time mono"
  }, ev.time), /*#__PURE__*/React.createElement("span", {
    className: "cal-pill-title"
  }, ev.title));
}
window.CalendarView = CalendarView;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/CalendarView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/GoalsWidget.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxG
} = React;
function GoalsWidget({
  goals
}) {
  const {
    t
  } = useCtxG(window.LifeLocaleContext);
  const list = goals != null ? goals : [{
    id: 1,
    title: t('goal_emergency'),
    pct: 62,
    val: '$1,550 / $2,500',
    tag: t('goal_tag_q3')
  }, {
    id: 2,
    title: t('goal_ship_v1'),
    pct: 81,
    val: '13 / 16',
    tag: t('goal_tag_q4')
  }, {
    id: 3,
    title: t('goal_half_marathon'),
    pct: 34,
    val: '7 / 20',
    tag: t('goal_tag_jan')
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "card panel is-stakes"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "panel-title"
  }, t('goals_title')), /*#__PURE__*/React.createElement("span", {
    className: "panel-meta mono is-stakes"
  }, t('goals_meta', list.length))), list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, t('empty_goals')) : /*#__PURE__*/React.createElement("div", {
    className: "goal-list"
  }, list.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.id,
    className: "goal-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "goal-row-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "goal-title"
  }, g.title), /*#__PURE__*/React.createElement("div", {
    className: "mono goal-tag"
  }, g.tag)), /*#__PURE__*/React.createElement("div", {
    className: "goal-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "goal-fill",
    style: {
      width: g.pct + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "goal-foot mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "goal-val"
  }, g.val), /*#__PURE__*/React.createElement("span", {
    className: "goal-pct"
  }, g.pct, "%"))))));
}
window.GoalsWidget = GoalsWidget;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/GoalsWidget.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/HabitsGrid.jsx
try { (() => {
/* global React */
const {
  useState: useStateH,
  useContext: useCtxH
} = React;

/* Days are Mon-first (matches UA/RU week). Today index computed from JS. */
function getTodayIdx() {
  /* JS getDay: 0=Sun..6=Sat. Convert to Mon-first 0..6. */
  return (new Date().getDay() + 6) % 7;
}
function HabitsGrid({
  habits: habitsProp
}) {
  const {
    t
  } = useCtxH(window.LifeLocaleContext);
  const I = window.LIcons;
  const todayIdx = getTodayIdx();
  const dayKeys = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

  /* Mon-first week: 1 = done, 0 = empty/missed/future */
  const [habitsState, setHabits] = useStateH([{
    id: 1,
    name: t('habit_read'),
    week: [1, 1, 1, 0, 1, 0, 0],
    streak: 12,
    best: 28
  }, {
    id: 2,
    name: t('habit_no_phone'),
    week: [1, 1, 0, 1, 1, 0, 0],
    streak: 30,
    best: 30
  }, {
    id: 3,
    name: t('habit_walk'),
    week: [1, 1, 1, 1, 0, 0, 0],
    streak: 4,
    best: 16
  }, {
    id: 4,
    name: t('habit_write'),
    week: [1, 0, 1, 1, 0, 0, 0],
    streak: 2,
    best: 41
  }]);
  const habits = habitsProp != null ? habitsProp : habitsState;
  function toggleToday(habitId) {
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h;
      const next = h.week.slice();
      next[todayIdx] = next[todayIdx] ? 0 : 1;
      return {
        ...h,
        week: next
      };
    }));
  }
  const total = habits.reduce((s, h) => s + h.week.slice(0, todayIdx + 1).reduce((a, b) => a + b, 0), 0);
  const max = habits.length * (todayIdx + 1);
  return /*#__PURE__*/React.createElement("section", {
    className: "card panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "panel-title"
  }, t('habits_title')), /*#__PURE__*/React.createElement("span", {
    className: "panel-meta mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "habits-counter"
  }, total), "/", /*#__PURE__*/React.createElement("span", {
    className: "habits-counter-max"
  }, max), " ", t('habits_meta_period'))), habits.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-state empty-habits"
  }, /*#__PURE__*/React.createElement("div", null, t('habits_empty')), /*#__PURE__*/React.createElement("button", {
    className: "empty-action mono"
  }, t('habits_add'))) : /*#__PURE__*/React.createElement("div", {
    className: "habits-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "habits-row habits-row-head"
  }, /*#__PURE__*/React.createElement("div", null), dayKeys.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "habits-day mono" + (i === todayIdx ? " is-today" : "")
  }, d)), /*#__PURE__*/React.createElement("div", null)), habits.map(h => /*#__PURE__*/React.createElement(React.Fragment, {
    key: h.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "habits-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "habits-name"
  }, h.name), h.week.map((v, i) => {
    const isPast = i < todayIdx;
    const isToday = i === todayIdx;
    const isFuture = i > todayIdx;
    const cls = ["habits-cell", v ? "is-done" : "", isToday ? "is-today" : "", isFuture ? "is-future" : "", isPast && !v ? "is-missed" : ""].filter(Boolean).join(' ');
    if (isToday) {
      return /*#__PURE__*/React.createElement("button", {
        key: i,
        className: cls,
        onClick: () => toggleToday(h.id),
        title: "\u043E\u0442\u043C\u0435\u0442\u0438\u0442\u044C"
      }, !v && /*#__PURE__*/React.createElement("span", {
        className: "habits-cell-plus",
        "aria-hidden": "true"
      }, "+"));
    }
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: cls
    });
  }), /*#__PURE__*/React.createElement("div", null)), /*#__PURE__*/React.createElement("div", {
    className: "habits-row habits-streak-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "habits-streak mono"
  }, t('habits_streak', h.streak, t.pl('pl_day', h.streak), h.best)))))));
}
window.HabitsGrid = HabitsGrid;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/HabitsGrid.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/LifeDataProvider.jsx
try { (() => {
/* global React */
/* LifeDataProvider · central state tree
 *
 * Single React reducer-ish state container holding everything that
 * persists across reloads. Backed by lib/storage.js. Children get
 * read/write access via window.LifeDataContext.
 *
 * Sprint 3A goal: hoist tasks / profile / dog / quickNotes out of
 * App.jsx scattered useState calls into one tree, plus add new
 * persisted fields (medications, doseLogs, pharmNotes, modeStyles,
 * activityLog). The dispatcher functions exposed here are the only
 * legal way to mutate persisted state — every mutation appends to
 * activityLog in the same setState pass.
 *
 * Keep this file as a thin orchestrator. Heavy mutation logic that
 * needs unit-testable purity should live in lib/. */

const {
  useState: useStateDP,
  useEffect: useEffectDP,
  useMemo: useMemoDP,
  useRef: useRefDP
} = React;
const LifeDataContext = React.createContext(null);
window.LifeDataContext = LifeDataContext;

/* Build the initial state tree. Called once on mount when no
   localStorage snapshot exists. Falls back to the seed objects we
   ship from data/*. */
function buildInitialState() {
  const meds = (window.LifeMeds || []).map(m => ({
    ...m,
    image_path: m.image_path != null ? m.image_path : null,
    inventory_count: m.inventory_count || 0,
    low_stock_threshold_days: m.low_stock_threshold_days || 7,
    schedule: Array.isArray(m.schedule) ? m.schedule : defaultScheduleTimes(m),
    discontinuation_template: m.discontinuation_template || null
  }));

  /* Seed dose logs — one per active med, ~6-12h ago. Gives the
     three timers something to compute against on first load. QA
     scenario 2 needs this. */
  const doseLogs = {};
  const now = Date.now();
  meds.forEach(m => {
    doseLogs[m.id] = [];
    if (m.status === 'active' && m.dose_interval_h && m.current_dose_mg_per_day) {
      const dosesBack = Math.min(3, m.doses_per_day || 1);
      for (let i = dosesBack; i >= 1; i--) {
        const hoursAgo = (m.dose_interval_h || 24) * i - Math.random() * 0.3;
        const ts = new Date(now - hoursAgo * 3600000).toISOString();
        const dose = Math.round(m.current_dose_mg_per_day / (m.doses_per_day || 1) * 10) / 10;
        doseLogs[m.id].unshift({
          taken_at: ts,
          dose_mg: dose,
          mode: 'scheduled',
          note: ''
        });
      }
    }
  });

  /* Seed pharmacist notes for two meds — enough to exercise the
     summary chip and the global journal feed. */
  const pharmNotes = {
    bupropion: [{
      id: 'pn1',
      date: isoDaysAgo(2),
      polarity: '+',
      text: 'энергия в первой половине дня лучше'
    }, {
      id: 'pn2',
      date: isoDaysAgo(5),
      polarity: '+',
      text: 'легче сесть за работу с утра'
    }, {
      id: 'pn3',
      date: isoDaysAgo(8),
      polarity: '-',
      text: 'сухость во рту, особенно утром'
    }],
    vortioxetine: [{
      id: 'pn4',
      date: isoDaysAgo(3),
      polarity: '+',
      text: 'настроение ровнее на 5 неделю'
    }, {
      id: 'pn5',
      date: isoDaysAgo(12),
      polarity: '-',
      text: 'тошнота в первый час после приёма'
    }]
  };

  /* Inventory — give a couple meds low counts so the risk-tier
     chips have something to render on first paint. */
  const invSeed = {
    sertraline: 18,
    bupropion: 24,
    vortioxetine: 11,
    duloxetine: 5,
    // → yellow "купить скоро"
    milnacipran: 2,
    // → orange "купить срочно"
    lamotrigine: 41,
    nac: 1,
    // → red "заканчивается"
    magtein: 0 // → red "закончился"
  };
  meds.forEach(m => {
    if (invSeed[m.id] != null) m.inventory_count = invSeed[m.id];
  });
  return {
    version: 2,
    profile: window.LifeProfileSeed || {},
    dog: window.LifeDogSeed || {},
    medications: meds,
    doseLogs,
    pharmNotes,
    modeStyles: {},
    tasks: [{
      id: 1,
      titleKey: 'seed_task_ship',
      done: false,
      stakes: true,
      tag: 'today',
      due: 'eod'
    }, {
      id: 2,
      titleKey: 'seed_task_commit',
      done: false,
      stakes: true,
      tag: 'stakes',
      due: '17:00'
    }, {
      id: 3,
      titleKey: 'seed_task_review',
      done: false,
      stakes: false,
      tag: 'work',
      due: '14:00'
    }, {
      id: 4,
      titleKey: 'seed_task_log',
      done: true,
      stakes: false,
      tag: 'money',
      due: '09:12'
    }, {
      id: 5,
      titleKey: 'seed_task_read',
      done: false,
      stakes: false,
      tag: 'habit',
      due: '21:00'
    }, {
      id: 6,
      titleKey: 'seed_task_mum',
      done: false,
      stakes: false,
      tag: 'life',
      due: 'tue'
    }],
    transactions: seedTransactions(),
    categoryOverrides: {},
    habits: {},
    quickNotes: [{
      id: 101,
      text: 'спросить у врача про дозу',
      at: '08:14'
    }, {
      id: 102,
      text: 'идея: разделить расходы на постоянные/перем.',
      at: '11:02'
    }, {
      id: 103,
      text: 'мама — найти билеты на декабрь',
      at: '14:48'
    }, {
      id: 104,
      text: 'послушать тот подкаст про CYP2D6',
      at: '17:21'
    }],
    activityLog: []
  };
}
function isoDaysAgo(d) {
  return new Date(Date.now() - d * 86400000).toISOString();
}

/* Sprint 3B · seed transactions for the flexible-finance demo.
   Numbers chosen to mirror dashboard-seed.categoryBreakdown so the
   /home hero, trend chart, and category bars all line up with the
   /finances list when totals are computed from this source.

   One row ships with included_in_totals: false to demonstrate the
   excluded visual + the gap between "$2,480 spent" (seed) and
   "$2,380 in totals" (derived) on first load. */
function seedTransactions() {
  return [{
    id: 't01',
    amount: 1100,
    category_id: 'rent',
    date: '2026-10-01',
    description: 'аренда · октябрь',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't02',
    amount: 145,
    category_id: 'groceries',
    date: '2026-10-03',
    description: 'сильпо · крупная закупка',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't03',
    amount: 95,
    category_id: 'groceries',
    date: '2026-10-08',
    description: 'novus · продукты',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't04',
    amount: 140,
    category_id: 'groceries',
    date: '2026-10-15',
    description: 'wolt · доставка',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't05',
    amount: 75,
    category_id: 'restaurants',
    date: '2026-10-04',
    description: 'kontora · ужин',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't06',
    amount: 42,
    category_id: 'restaurants',
    date: '2026-10-07',
    description: 'кафе с другом',
    source: 'manual',
    included_in_totals: true
  }, {
    id: 't07',
    amount: 68,
    category_id: 'restaurants',
    date: '2026-10-12',
    description: 'sushi · доставка',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't08',
    amount: 55,
    category_id: 'restaurants',
    date: '2026-10-19',
    description: 'shokeen · обед',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't09',
    amount: 220,
    category_id: 'utilities',
    date: '2026-10-05',
    description: 'свет + газ',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't10',
    amount: 140,
    category_id: 'subscriptions',
    date: '2026-10-02',
    description: 'софт · подписки',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't11',
    amount: 95,
    category_id: 'transport',
    date: '2026-10-09',
    description: 'uber · поездки',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't12',
    amount: 65,
    category_id: 'health',
    date: '2026-10-11',
    description: 'аптека',
    source: 'manual',
    included_in_totals: true
  }, {
    id: 't13',
    amount: 100,
    category_id: 'health',
    date: '2026-10-13',
    description: 'терапия',
    source: 'manual',
    included_in_totals: false
  }, {
    id: 't14',
    amount: 85,
    category_id: 'entertainment',
    date: '2026-10-14',
    description: 'кино · 2 билета',
    source: 'monobank',
    included_in_totals: true
  }, {
    id: 't15',
    amount: 55,
    category_id: 'care',
    date: '2026-10-17',
    description: 'парикмахер',
    source: 'manual',
    included_in_totals: true
  }];
}
function defaultScheduleTimes(m) {
  /* Map schedule_default slot names → reasonable clock times.
     User can edit these in the config drawer (Batch 3). */
  const map = {
    morning: '08:00',
    midday: '13:00',
    afternoon: '16:00',
    evening: '21:00',
    night: '23:00'
  };
  return (m.schedule_default || []).map(s => map[s] || '08:00');
}

/* Migration shim for old snapshots. When we bump version, dispatch
   keyed migrations from here. */
function migrate(state) {
  if (!state || typeof state !== 'object') return null;
  /* Sprint 3B · v1 → v2: seed transactions + categoryOverrides for
     flexible-finance. v1 snapshots had transactions:[] from Sprint 3A
     because no logger surface existed yet — reseed so the demo has
     content on first paint after upgrade. */
  if (!state.version || state.version < 2) {
    if (!Array.isArray(state.transactions) || state.transactions.length === 0) {
      state.transactions = seedTransactions();
    }
    if (state.categoryOverrides == null) state.categoryOverrides = {};
    state.version = 2;
  }
  return state;
}

/* ── Provider ─────────────────────────────────────────── */
function LifeDataProvider(props) {
  const [state, setStateRaw] = useStateDP(() => {
    const persisted = migrate(window.LifeStorage.load());
    return persisted || buildInitialState();
  });

  /* Persist on every change. lib/storage.js throttles writes
     internally, so we can fire on every state diff without
     hammering localStorage. */
  useEffectDP(() => {
    window.LifeStorage.save(state);
  }, [state]);

  /* setState + activity append in a single transaction. updater is
     `(prev) => nextPartial` returning JUST the fields to merge;
     logEntry is appended to activityLog atomically. Pass logEntry
     = null to skip the log (rare — only for ephemeral toggles). */
  function mutate(updater, logEntry) {
    setStateRaw(prev => {
      const patch = typeof updater === 'function' ? updater(prev) : updater;
      const next = {
        ...prev,
        ...(patch || {})
      };
      if (logEntry) {
        next.activityLog = window.LifeActivity.append(next.activityLog, logEntry);
      }
      return next;
    });
  }

  /* ── Tasks ────────────────────────────────────────── */
  function toggleTask(id) {
    /* Single-pass mutation. We read the task off the *previous* tree
       inside the updater (NOT the stale `state` closure), flip its
       done flag, and emit the right action label in the same tx. */
    setStateRaw(prev => {
      const tasks = prev.tasks.map(x => x.id === id ? {
        ...x,
        done: !x.done
      } : x);
      const before = prev.tasks.find(x => x.id === id);
      const log = before ? {
        entity_type: 'task',
        entity_id: id,
        action: before.done ? 'reopened' : 'completed',
        details: {
          title: before.title || before.titleKey
        }
      } : null;
      const next = {
        ...prev,
        tasks
      };
      if (log) next.activityLog = window.LifeActivity.append(next.activityLog, log);
      return next;
    });
  }
  function addTask(task) {
    mutate(prev => ({
      tasks: [...prev.tasks, task]
    }), {
      entity_type: 'task',
      entity_id: task.id,
      action: 'created',
      details: {
        title: task.title,
        stakes: !!task.stakes
      }
    });
  }
  function updateTask(task) {
    mutate(prev => ({
      tasks: prev.tasks.map(x => x.id === task.id ? {
        ...x,
        ...task
      } : x)
    }), {
      entity_type: 'task',
      entity_id: task.id,
      action: 'edited',
      details: {
        title: task.title
      }
    });
  }
  function deleteTask(id) {
    setStateRaw(prev => {
      const old = prev.tasks.find(x => x.id === id);
      const tasks = prev.tasks.filter(x => x.id !== id);
      const log = {
        entity_type: 'task',
        entity_id: id,
        action: 'deleted',
        details: {
          title: old && (old.title || old.titleKey)
        }
      };
      return {
        ...prev,
        tasks,
        activityLog: window.LifeActivity.append(prev.activityLog, log)
      };
    });
  }

  /* ── Transactions · Sprint 3B ─────────────────────── */
  /* Flexible-finance toggles. A transaction counts toward totals only
     when its own flag is on AND its category isn't blanket-excluded.
     Both gates persisted; both append to activityLog. */
  function addTransaction(tx) {
    const entry = {
      id: tx.id || 't' + Date.now(),
      amount: tx.amount,
      category_id: tx.category_id,
      date: tx.date || new Date().toISOString().slice(0, 10),
      description: tx.description || '',
      source: tx.source || 'manual',
      included_in_totals: tx.included_in_totals !== false
    };
    mutate(prev => ({
      transactions: [entry, ...prev.transactions]
    }), {
      entity_type: 'transaction',
      entity_id: entry.id,
      action: 'created',
      details: {
        amount: entry.amount,
        category_id: entry.category_id,
        description: entry.description
      }
    });
  }
  function toggleTransactionInclusion(transactionId) {
    setStateRaw(prev => {
      const tx = prev.transactions.find(x => x.id === transactionId);
      if (!tx) return prev;
      const nextIncluded = tx.included_in_totals === false ? true : false;
      const transactions = prev.transactions.map(x => x.id === transactionId ? {
        ...x,
        included_in_totals: nextIncluded
      } : x);
      const log = {
        entity_type: 'transaction',
        entity_id: transactionId,
        action: nextIncluded ? 'included' : 'excluded',
        details: {
          amount: tx.amount,
          category_id: tx.category_id,
          description: tx.description
        }
      };
      return {
        ...prev,
        transactions,
        activityLog: window.LifeActivity.append(prev.activityLog, log)
      };
    });
  }
  function toggleCategoryInclusion(categoryId) {
    setStateRaw(prev => {
      const cur = prev.categoryOverrides[categoryId];
      const currentlyIncluded = !cur || cur.included_in_totals !== false;
      const nextIncluded = !currentlyIncluded;
      const categoryOverrides = {
        ...prev.categoryOverrides,
        [categoryId]: {
          ...(cur || {}),
          included_in_totals: nextIncluded
        }
      };
      const log = {
        entity_type: 'category',
        entity_id: categoryId,
        action: nextIncluded ? 'included' : 'excluded',
        details: {
          category_id: categoryId
        }
      };
      return {
        ...prev,
        categoryOverrides,
        activityLog: window.LifeActivity.append(prev.activityLog, log)
      };
    });
  }

  /* ── Quick notes ───────────────────────── */
  function addQuickNote(text) {
    const at = new Date().toTimeString().slice(0, 5);
    const id = Date.now();
    mutate(prev => ({
      quickNotes: [{
        id,
        text,
        at
      }, ...prev.quickNotes]
    }), {
      entity_type: 'quick_note',
      entity_id: id,
      action: 'created',
      details: {
        text
      }
    });
  }
  function deleteQuickNote(id) {
    mutate(prev => ({
      quickNotes: prev.quickNotes.filter(n => n.id !== id)
    }), {
      entity_type: 'quick_note',
      entity_id: id,
      action: 'deleted'
    });
  }

  /* ── Profile ──────────────────────────────────────── */
  function updateProfile(slice, patch) {
    mutate(prev => ({
      profile: {
        ...prev.profile,
        [slice]: {
          ...prev.profile[slice],
          ...patch
        }
      }
    }), {
      entity_type: 'profile',
      entity_id: slice,
      action: 'edited',
      details: {
        fields: Object.keys(patch)
      }
    });
  }

  /* ── Dog ──────────────────────────────────────────── */
  function updateDog(slice, patch) {
    mutate(prev => ({
      dog: {
        ...prev.dog,
        [slice]: {
          ...prev.dog[slice],
          ...patch
        }
      }
    }), {
      entity_type: 'profile',
      entity_id: 'dog.' + slice,
      action: 'edited',
      details: {
        fields: Object.keys(patch)
      }
    });
  }

  /* ── Medications ──────────────────────────────────── */
  function updateMedication(medId, patch) {
    mutate(prev => ({
      medications: prev.medications.map(m => m.id === medId ? {
        ...m,
        ...patch
      } : m)
    }), {
      entity_type: 'med_config',
      entity_id: medId,
      action: 'edited',
      details: {
        fields: Object.keys(patch)
      }
    });
  }
  function deleteMedication(medId) {
    /* soft delete → archived status, retain dose logs */
    mutate(prev => ({
      medications: prev.medications.map(m => m.id === medId ? {
        ...m,
        status: 'archived'
      } : m)
    }), {
      entity_type: 'med_config',
      entity_id: medId,
      action: 'deleted'
    });
  }
  function setMedicationStatus(medId, status) {
    updateMedication(medId, {
      status
    });
  }
  function setMedicationInventory(medId, count) {
    mutate(prev => ({
      medications: prev.medications.map(m => m.id === medId ? {
        ...m,
        inventory_count: count
      } : m)
    }), {
      entity_type: 'med_config',
      entity_id: medId,
      action: 'inventory_updated',
      details: {
        count
      }
    });
  }

  /* Dose actions */
  function takeDose(medId, payload) {
    const entry = {
      taken_at: payload.taken_at || new Date().toISOString(),
      dose_mg: payload.dose_mg != null ? payload.dose_mg : null,
      mode: payload.mode || 'scheduled',
      note: payload.note || ''
    };
    mutate(prev => {
      const list = (prev.doseLogs[medId] || []).slice();
      list.unshift(entry);
      const meds = prev.medications.map(m => {
        if (m.id !== medId) return m;
        const inv = Math.max(0, (m.inventory_count || 0) - 1);
        return {
          ...m,
          inventory_count: inv
        };
      });
      return {
        doseLogs: {
          ...prev.doseLogs,
          [medId]: list
        },
        medications: meds
      };
    }, {
      entity_type: 'med_dose',
      entity_id: medId,
      action: 'dose_taken',
      details: {
        dose_mg: entry.dose_mg,
        taken_at: entry.taken_at,
        note: entry.note
      }
    });
  }
  function snoozeDose(medId, byHours) {
    mutate(prev => prev, {
      entity_type: 'med_dose',
      entity_id: medId,
      action: 'dose_snoozed',
      details: {
        by_hours: byHours || 1
      }
    });
  }
  function skipDose(medId) {
    mutate(prev => prev, {
      entity_type: 'med_dose',
      entity_id: medId,
      action: 'dose_skipped',
      details: {
        skipped_at: new Date().toISOString()
      }
    });
  }

  /* Mode style */
  function setModeStyle(medId, modeStyle) {
    mutate(prev => ({
      modeStyles: {
        ...prev.modeStyles,
        [medId]: {
          ...modeStyle,
          startedAt: modeStyle.startedAt || new Date().toISOString()
        }
      }
    }), {
      entity_type: 'mode_style',
      entity_id: medId,
      action: 'mode_changed',
      details: {
        type: modeStyle.type,
        target: modeStyle.target
      }
    });
  }

  /* Pharm notes */
  function addPharmNote(medId, note) {
    const id = 'pn' + Date.now();
    const entry = {
      id,
      date: note.date || new Date().toISOString().slice(0, 10),
      polarity: note.polarity || '+',
      text: note.text || ''
    };
    mutate(prev => ({
      pharmNotes: {
        ...prev.pharmNotes,
        [medId]: [entry, ...(prev.pharmNotes[medId] || [])]
      }
    }), {
      entity_type: 'note',
      entity_id: medId + '/' + id,
      action: 'note_added',
      details: {
        polarity: entry.polarity,
        text: entry.text
      }
    });
  }
  function editPharmNote(medId, noteId, patch) {
    mutate(prev => ({
      pharmNotes: {
        ...prev.pharmNotes,
        [medId]: (prev.pharmNotes[medId] || []).map(n => n.id === noteId ? {
          ...n,
          ...patch
        } : n)
      }
    }), {
      entity_type: 'note',
      entity_id: medId + '/' + noteId,
      action: 'note_edited'
    });
  }
  function deletePharmNote(medId, noteId) {
    mutate(prev => ({
      pharmNotes: {
        ...prev.pharmNotes,
        [medId]: (prev.pharmNotes[medId] || []).filter(n => n.id !== noteId)
      }
    }), {
      entity_type: 'note',
      entity_id: medId + '/' + noteId,
      action: 'note_deleted'
    });
  }

  /* ── Maintenance ──────────────────────────────────── */
  function clearActivityOlderThan(cutoffISO) {
    mutate(prev => ({
      activityLog: window.LifeActivity.pruneOlderThan(prev.activityLog, cutoffISO)
    }), null);
  }
  function exportJSON() {
    /* Snapshot the most recent state via the setter trick — closures
       might otherwise hand us the value at last render. */
    let snap = null;
    setStateRaw(s => {
      snap = s;
      return s;
    });
    return JSON.stringify(snap || state, null, 2);
  }
  function hardReset() {
    window.LifeStorage.clear();
    setStateRaw(buildInitialState());
  }
  const value = useMemoDP(() => ({
    state,
    /* tasks */toggleTask,
    addTask,
    updateTask,
    deleteTask,
    /* transactions */addTransaction,
    toggleTransactionInclusion,
    toggleCategoryInclusion,
    /* notes */addQuickNote,
    deleteQuickNote,
    /* profile + dog */updateProfile,
    updateDog,
    /* meds */updateMedication,
    deleteMedication,
    setMedicationStatus,
    setMedicationInventory,
    takeDose,
    snoozeDose,
    skipDose,
    /* modes */setModeStyle,
    /* pharm notes */addPharmNote,
    editPharmNote,
    deletePharmNote,
    /* maint */clearActivityOlderThan,
    exportJSON,
    hardReset
  }), [state]);
  return React.createElement(LifeDataContext.Provider, {
    value
  }, props.children);
}
window.LifeDataProvider = LifeDataProvider;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/LifeDataProvider.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/MobileBottomNav.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxMN
} = React;

/* Bottom nav for mobile (<640px). 5 fixed slots: home / tasks / notes / calendar / more.
   The full sidebar tree lives on desktop; mobile picks 4 high-traffic destinations
   and "more" jumps to settings (eventually a sheet listing the rest). */
function MobileBottomNav({
  active,
  onNav
}) {
  const {
    t
  } = useCtxMN(window.LifeLocaleContext);
  const I = window.LIcons;
  const items = [{
    id: 'home',
    label: t('nav_home'),
    icon: 'home'
  }, {
    id: 'tasks',
    label: t('nav_tasks'),
    icon: 'listChecks'
  }, {
    id: 'notes',
    label: t('nav_notes'),
    icon: 'stickyNote'
  }, {
    id: 'calendar',
    label: t('nav_calendar'),
    icon: 'calendar'
  }, {
    id: 'more',
    label: t('nav_more'),
    icon: 'moreHorizontal'
  }];
  return /*#__PURE__*/React.createElement("nav", {
    className: "mnav",
    role: "navigation"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    className: "mnav-btn" + (active === it.id ? " is-on" : ""),
    onClick: () => onNav(it.id === 'more' ? 'settings' : it.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "mnav-icon"
  }, I[it.icon] && I[it.icon]({
    size: 20
  })), /*#__PURE__*/React.createElement("span", {
    className: "mnav-label"
  }, it.label))));
}
window.MobileBottomNav = MobileBottomNav;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/MobileBottomNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/MoneyWidget.jsx
try { (() => {
/* global React */
const {
  useState: useStateMW,
  useContext: useCtxMW
} = React;
function MoneyWidget({
  logged: loggedProp
}) {
  const {
    t,
    locale
  } = useCtxMW(window.LifeLocaleContext);
  const I = window.LIcons;
  const cats = window.LifeExpenseCats;
  const [amount, setAmount] = useStateMW('42.00');
  const [catId, setCatId] = useStateMW('groceries');
  const [loggedState, setLogged] = useStateMW([{
    id: 1,
    amount: 4.20,
    cat: 'restaurants',
    at: '08:14'
  }, {
    id: 2,
    amount: 32.50,
    cat: 'groceries',
    at: '12:02'
  }, {
    id: 3,
    amount: 14.00,
    cat: 'restaurants',
    at: '13:31'
  }, {
    id: 4,
    amount: 18.00,
    cat: 'restaurants',
    at: '19:48'
  }, {
    id: 5,
    amount: 76.40,
    cat: 'groceries',
    at: 'ПН'
  }, {
    id: 6,
    amount: 98.00,
    cat: 'restaurants',
    at: 'СБ'
  }, {
    id: 7,
    amount: 115.00,
    cat: 'restaurants',
    at: 'ПТ'
  }]);
  const logged = loggedProp != null ? loggedProp : loggedState;
  const isEmpty = logged.length === 0;
  const spent = logged.reduce((s, l) => s + l.amount, 0);
  const budget = 300;
  const pct = Math.min(100, spent / budget * 100);
  const warn = pct >= 80;
  const over = spent > budget;
  const intlLoc = window.LifeStrings[locale]._intl_locale;
  const monthShort = new Date().toLocaleDateString(intlLoc, {
    month: 'short'
  }).replace('.', '');

  /* days left in current month */
  const today = new Date();
  const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
  function catName(id) {
    const c = cats.find(x => x.id === id);
    return c ? c.name[locale] : id;
  }
  function logIt(e) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    const at = new Date().toTimeString().slice(0, 5);
    setLogged([{
      id: Date.now(),
      amount: n,
      cat: catId,
      at
    }, ...logged]);
    setAmount('');
  }
  const trackedCat = 'restaurants';
  const trackedSpent = logged.filter(l => l.cat === trackedCat).reduce((s, l) => s + l.amount, 0);
  const trackedPct = Math.min(100, trackedSpent / budget * 100);
  const trackedWarn = trackedPct >= 80;
  const trackedOver = trackedSpent > budget;
  return /*#__PURE__*/React.createElement("section", {
    className: "card panel" + (trackedWarn ? " is-stakes" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "panel-title"
  }, t('money_title')), /*#__PURE__*/React.createElement("div", {
    className: "panel-head-right"
  }, trackedWarn && !trackedOver && /*#__PURE__*/React.createElement("span", {
    className: "mono money-warn-badge"
  }, t('money_warn_badge')), trackedOver && /*#__PURE__*/React.createElement("span", {
    className: "mono money-over-badge"
  }, t('money_over_badge')), /*#__PURE__*/React.createElement("span", {
    className: "mono panel-meta"
  }, t('money_period_currency', monthShort)))), /*#__PURE__*/React.createElement("form", {
    className: "money-input-row",
    onSubmit: logIt
  }, /*#__PURE__*/React.createElement("div", {
    className: "money-input-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "money-prefix mono"
  }, "$"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "money-input mono",
    value: amount,
    onChange: e => setAmount(e.target.value),
    placeholder: t('money_amt_placeholder'),
    inputMode: "decimal"
  })), /*#__PURE__*/React.createElement("select", {
    className: "money-bucket mono",
    value: catId,
    onChange: e => setCatId(e.target.value)
  }, cats.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name[locale]))), /*#__PURE__*/React.createElement("button", {
    className: "money-log",
    type: "submit"
  }, t('money_log'))), isEmpty ? /*#__PURE__*/React.createElement("div", {
    className: "empty-state",
    style: {
      marginTop: 4
    }
  }, t('empty_money')) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "money-budget"
  }, /*#__PURE__*/React.createElement("div", {
    className: "money-budget-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono money-budget-lab" + (trackedWarn ? " is-stakes" : "")
  }, t('money_budget_pre', catName(trackedCat), monthShort.toLowerCase())), /*#__PURE__*/React.createElement("span", {
    className: "mono money-budget-val"
  }, "$", trackedSpent.toFixed(2), " / $", budget, ".00")), /*#__PURE__*/React.createElement("div", {
    className: "money-budget-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "money-budget-fill" + (trackedOver ? " is-over" : trackedWarn ? " is-warn" : ""),
    style: {
      width: trackedPct + '%'
    }
  })), trackedWarn && !trackedOver && /*#__PURE__*/React.createElement("div", {
    className: "mono money-budget-hint"
  }, t('money_warn_hint', daysLeft, t.pl('pl_day', daysLeft))), trackedOver && /*#__PURE__*/React.createElement("div", {
    className: "mono money-budget-hint is-over"
  }, t('money_over_hint', (trackedSpent - budget).toFixed(2)))), /*#__PURE__*/React.createElement("ul", {
    className: "money-list"
  }, logged.slice(0, 3).map(l => /*#__PURE__*/React.createElement("li", {
    key: l.id,
    className: "money-list-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono money-list-time"
  }, l.at), /*#__PURE__*/React.createElement("span", {
    className: "money-list-where"
  }, catName(l.cat)), /*#__PURE__*/React.createElement("span", {
    className: "mono money-list-amt"
  }, "$", l.amount.toFixed(2)))))));
}
window.MoneyWidget = MoneyWidget;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/MoneyWidget.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/QuickAddModal.jsx
try { (() => {
/* global React */
const {
  useState: useStateQA,
  useEffect: useEffectQA,
  useContext: useCtxQA,
  useRef: useRefQA,
  useMemo: useMemoQA
} = React;
function QuickAddModal({
  open,
  onClose,
  onSave,
  defaultStakes = false,
  defaultTitle = ''
}) {
  const {
    t,
    locale
  } = useCtxQA(window.LifeLocaleContext);
  const I = window.LIcons;
  const cats = window.LifeExpenseCats;
  const [title, setTitle] = useStateQA('');
  const [stakes, setStakes] = useStateQA(defaultStakes);
  const [catId, setCatId] = useStateQA(null);
  const [catQuery, setCatQuery] = useStateQA('');
  const [catOpen, setCatOpen] = useStateQA(false);
  const [showSched, setSched] = useStateQA(false);
  const [date, setDate] = useStateQA('');
  const [time, setTime] = useStateQA('');
  const [showNotes, setNotes] = useStateQA(false);
  const [notesText, setNotesT] = useStateQA('');
  const titleRef = useRefQA(null);
  const catBoxRef = useRefQA(null);

  /* reset when re-opened */
  useEffectQA(() => {
    if (open) {
      setTitle(defaultTitle || '');
      setStakes(defaultStakes);
      setCatId(null);
      setCatQuery('');
      setCatOpen(false);
      setSched(false);
      setDate('');
      setTime('');
      setNotes(false);
      setNotesT('');
      setTimeout(() => titleRef.current && titleRef.current.focus(), 30);
    }
  }, [open, defaultStakes, defaultTitle]);

  /* esc to close, cmd+enter to save */
  useEffectQA(() => {
    if (!open) return;
    function handler(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commit();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  /* click outside category dropdown to close */
  useEffectQA(() => {
    if (!catOpen) return;
    function handler(e) {
      if (catBoxRef.current && !catBoxRef.current.contains(e.target)) setCatOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catOpen]);
  function commit() {
    const v = title.trim();
    if (!v) {
      titleRef.current && titleRef.current.focus();
      return;
    }
    const cat = cats.find(c => c.id === catId) || null;
    onSave({
      title: v,
      stakes,
      category: cat,
      schedule: showSched && (date || time) ? {
        date,
        time
      } : null,
      notes: showNotes ? notesText.trim() : ''
    });
  }
  if (!open) return null;
  const filteredCats = catQuery ? cats.filter(c => c.name[locale].toLowerCase().includes(catQuery.toLowerCase())) : cats;
  const selectedCat = cats.find(c => c.id === catId);
  return /*#__PURE__*/React.createElement("div", {
    className: "qa-backdrop",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-modal",
    onMouseDown: e => e.stopPropagation(),
    role: "dialog"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-eyebrow mono"
  }, t('qa_eyebrow')), /*#__PURE__*/React.createElement("button", {
    className: "qa-close",
    onClick: onClose,
    title: "esc"
  }, /*#__PURE__*/React.createElement(I.x, {
    size: 14
  }))), /*#__PURE__*/React.createElement("input", {
    ref: titleRef,
    className: "qa-title",
    placeholder: stakes ? t('qa_title_stakes') : t('qa_title'),
    value: title,
    onChange: e => setTitle(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commit();
      }
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "qa-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-toggle",
    role: "tablist"
  }, /*#__PURE__*/React.createElement("button", {
    role: "tab",
    "aria-selected": !stakes,
    className: "qa-toggle-btn" + (!stakes ? " is-on" : ""),
    onClick: () => setStakes(false)
  }, t('qa_routine')), /*#__PURE__*/React.createElement("button", {
    role: "tab",
    "aria-selected": stakes,
    className: "qa-toggle-btn is-stakes" + (stakes ? " is-on" : ""),
    onClick: () => setStakes(true)
  }, t('qa_stakes'))), /*#__PURE__*/React.createElement("div", {
    className: "qa-cat",
    ref: catBoxRef
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-cat-trigger" + (selectedCat ? " is-set" : ""),
    onClick: () => setCatOpen(o => !o)
  }, selectedCat ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-dot " + window.LifeCatTintClass[selectedCat.tint],
    "aria-hidden": "true"
  }, I[selectedCat.icon] ? I[selectedCat.icon]({
    size: 13
  }) : null), /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-name"
  }, selectedCat.name[locale])) : /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-placeholder"
  }, t('qa_category')), /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-chev"
  }, /*#__PURE__*/React.createElement(I.chevDown, {
    size: 12
  }))), catOpen && /*#__PURE__*/React.createElement("div", {
    className: "qa-cat-pop"
  }, /*#__PURE__*/React.createElement("input", {
    className: "qa-cat-search mono",
    placeholder: t('qa_category'),
    value: catQuery,
    onChange: e => setCatQuery(e.target.value),
    autoFocus: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "qa-cat-list"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-cat-opt",
    onClick: () => {
      setCatId(null);
      setCatOpen(false);
      setCatQuery('');
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-dot cat-tint-neutral"
  }, /*#__PURE__*/React.createElement(I.x, {
    size: 11
  })), /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-opt-name"
  }, t('qa_no_category'))), filteredCats.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    className: "qa-cat-opt",
    onClick: () => {
      setCatId(c.id);
      setCatOpen(false);
      setCatQuery('');
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-dot " + window.LifeCatTintClass[c.tint]
  }, I[c.icon] ? I[c.icon]({
    size: 13
  }) : null), /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-opt-name"
  }, c.name[locale]))))))), /*#__PURE__*/React.createElement("div", {
    className: "qa-expander"
  }, !showSched ? /*#__PURE__*/React.createElement("button", {
    className: "qa-expand-link mono",
    onClick: () => setSched(true)
  }, /*#__PURE__*/React.createElement(I.clock, {
    size: 12
  }), " ", t('qa_schedule_collapsed')) : /*#__PURE__*/React.createElement("div", {
    className: "qa-expand-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-expand-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono qa-expand-lab"
  }, t('qa_schedule_expanded')), /*#__PURE__*/React.createElement("button", {
    className: "qa-expand-collapse",
    onClick: () => setSched(false)
  }, /*#__PURE__*/React.createElement(I.x, {
    size: 11
  }))), /*#__PURE__*/React.createElement("div", {
    className: "qa-sched-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "qa-sched-input mono",
    value: date,
    onChange: e => setDate(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    type: "time",
    className: "qa-sched-input mono",
    value: time,
    onChange: e => setTime(e.target.value)
  })))), /*#__PURE__*/React.createElement("div", {
    className: "qa-expander"
  }, !showNotes ? /*#__PURE__*/React.createElement("button", {
    className: "qa-expand-link mono",
    onClick: () => setNotes(true)
  }, /*#__PURE__*/React.createElement(I.plus, {
    size: 12
  }), " ", t('qa_notes_collapsed')) : /*#__PURE__*/React.createElement("div", {
    className: "qa-expand-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-expand-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono qa-expand-lab"
  }, t('qa_notes_expanded')), /*#__PURE__*/React.createElement("button", {
    className: "qa-expand-collapse",
    onClick: () => setNotes(false)
  }, /*#__PURE__*/React.createElement(I.x, {
    size: 11
  }))), /*#__PURE__*/React.createElement("textarea", {
    className: "qa-notes-input",
    placeholder: t('qa_notes_placeholder'),
    value: notesText,
    onChange: e => setNotesT(e.target.value),
    rows: 3
  }))), /*#__PURE__*/React.createElement("div", {
    className: "qa-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-foot-hints mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-kbd"
  }, "\u2318 \u21B5"), /*#__PURE__*/React.createElement("span", null, stakes ? t('qa_save') + ' · важное' : t('qa_save')), /*#__PURE__*/React.createElement("span", {
    className: "qa-foot-sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "qa-kbd"
  }, "ESC"), /*#__PURE__*/React.createElement("span", null, t('qa_cancel'))), /*#__PURE__*/React.createElement("div", {
    className: "qa-foot-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-ghost",
    onClick: onClose
  }, t('qa_cancel')), /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-save" + (stakes ? " is-stakes" : ""),
    onClick: commit,
    disabled: !title.trim()
  }, t('qa_save'))))));
}
window.QuickAddModal = QuickAddModal;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/QuickAddModal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/SettingsPage.jsx
try { (() => {
/* global React */
const {
  useState: useStateSet,
  useContext: useCtxSet
} = React;
function SettingsPage() {
  const {
    t,
    locale,
    setLocale
  } = useCtxSet(window.LifeLocaleContext);
  const I = window.LIcons;
  const sections = [{
    id: 'account',
    label: t('set_account')
  }, {
    id: 'categories',
    label: t('set_categories')
  }, {
    id: 'telegram',
    label: t('set_telegram')
  }, {
    id: 'monobank',
    label: t('set_monobank')
  }, {
    id: 'notifications',
    label: t('set_notifications')
  }, {
    id: 'appearance',
    label: t('set_appearance')
  }, {
    id: 'export',
    label: t('set_export')
  }, {
    id: 'danger',
    label: t('set_danger')
  }];
  const [sel, setSel] = useStateSet('account');
  return /*#__PURE__*/React.createElement("div", {
    className: "set-wrap"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "set-h"
  }, t('set_title')), /*#__PURE__*/React.createElement("div", {
    className: "set-layout"
  }, /*#__PURE__*/React.createElement("nav", {
    className: "set-nav"
  }, sections.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    className: "set-nav-btn" + (sel === s.id ? " is-on" : "") + (s.id === 'danger' ? " is-danger" : ""),
    onClick: () => setSel(s.id)
  }, s.label))), /*#__PURE__*/React.createElement("div", {
    className: "set-body"
  }, sel === 'account' && /*#__PURE__*/React.createElement(AccountSection, {
    t: t
  }), sel === 'categories' && /*#__PURE__*/React.createElement(CategoriesSection, {
    t: t,
    locale: locale
  }), sel === 'telegram' && /*#__PURE__*/React.createElement(TelegramSection, {
    t: t
  }), sel === 'monobank' && /*#__PURE__*/React.createElement(MonobankSection, {
    t: t
  }), sel === 'notifications' && /*#__PURE__*/React.createElement(NotificationsSection, {
    t: t
  }), sel === 'appearance' && /*#__PURE__*/React.createElement(AppearanceSection, {
    t: t,
    locale: locale,
    setLocale: setLocale
  }), sel === 'export' && /*#__PURE__*/React.createElement(ExportSection, {
    t: t
  }), sel === 'danger' && /*#__PURE__*/React.createElement(DangerSection, {
    t: t
  }))));
}
function Row({
  label,
  hint,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "set-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-row-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-row-label"
  }, label), hint && /*#__PURE__*/React.createElement("div", {
    className: "set-row-hint mono"
  }, hint)), /*#__PURE__*/React.createElement("div", {
    className: "set-row-control"
  }, children));
}
function AccountSection({
  t
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Row, {
    label: t('set_account_name')
  }, /*#__PURE__*/React.createElement("input", {
    className: "set-input",
    defaultValue: "dogfood"
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('set_account_email'),
    hint: "read-only"
  }, /*#__PURE__*/React.createElement("input", {
    className: "set-input is-readonly",
    readOnly: true,
    defaultValue: "me@life.os"
  })));
}
function CategoriesSection({
  t,
  locale
}) {
  const cats = window.LifeCategories;
  const data = React.useContext(window.LifeDataContext);
  const overrides = data && data.state && data.state.categoryOverrides || {};
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "set-table set-table-cat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-table-head mono"
  }, /*#__PURE__*/React.createElement("span", null, t('set_cat_name')), /*#__PURE__*/React.createElement("span", null, t('set_cat_budget')), /*#__PURE__*/React.createElement("span", null, t('set_cat_in_totals'))), cats.map(c => {
    const o = overrides[c.id];
    const included = !o || o.included_in_totals !== false;
    const tip = included ? t('eye_cat_exclude') : t('eye_cat_include');
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      className: "set-table-row" + (included ? '' : ' is-excluded')
    }, /*#__PURE__*/React.createElement("div", {
      className: "set-table-cell"
    }, /*#__PURE__*/React.createElement("span", {
      className: "qa-cat-dot " + window.LifeCatTintClass[c.tint]
    }, window.LIcons[c.icon] && window.LIcons[c.icon]({
      size: 12
    })), /*#__PURE__*/React.createElement("span", null, c.name[locale])), /*#__PURE__*/React.createElement("div", {
      className: "set-table-cell mono"
    }, c.kind === 'expense' ? '$' + (100 + c.id.length * 20) : '—'), /*#__PURE__*/React.createElement("div", {
      className: "set-table-cell set-table-cell-eye"
    }, /*#__PURE__*/React.createElement(window.EyeToggle, {
      included: included,
      onToggle: () => data && data.toggleCategoryInclusion(c.id),
      title: tip,
      ariaLabel: tip,
      size: 14
    })));
  }), /*#__PURE__*/React.createElement("button", {
    className: "set-add-row mono"
  }, t('set_cat_add'))));
}
function TelegramSection({
  t
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Row, {
    label: t('set_tg_token'),
    hint: "hidden when set"
  }, /*#__PURE__*/React.createElement("input", {
    className: "set-input mono",
    type: "password",
    defaultValue: "1234567:AAAAAAAA-bot-token-masked"
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('set_tg_chat')
  }, /*#__PURE__*/React.createElement("input", {
    className: "set-input mono",
    defaultValue: "123456789"
  })), /*#__PURE__*/React.createElement(Row, {
    label: ""
  }, /*#__PURE__*/React.createElement("button", {
    className: "set-btn-primary"
  }, t('set_tg_test'))), /*#__PURE__*/React.createElement("div", {
    className: "set-subhead mono"
  }, "RULES"), /*#__PURE__*/React.createElement(Row, {
    label: t('set_notif_bot')
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: true
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('set_notif_goal')
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: true
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('set_notif_streak')
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: true
  })));
}
function MonobankSection({
  t
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Row, {
    label: t('set_mono_token')
  }, /*#__PURE__*/React.createElement("input", {
    className: "set-input mono",
    type: "password",
    defaultValue: "uXXXXXXXXXXXXXXXX-monobank-token-masked"
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('set_mono_last'),
    hint: t('set_mono_pending', 7) + ' · ' + t.pl('pl_tx', 7)
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono set-mono-time"
  }, "2026-05-21 14:02")), /*#__PURE__*/React.createElement(Row, {
    label: ""
  }, /*#__PURE__*/React.createElement("button", {
    className: "set-btn-primary"
  }, t('set_mono_sync'))));
}
function NotificationsSection({
  t
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Row, {
    label: t('set_notif_goal')
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: true
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('set_notif_budget')
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: true
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('set_notif_streak')
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: true
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('set_notif_bot')
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: false
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('set_quiet_hours'),
    hint: "22:00 \u2192 09:00"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono set-mono-time"
  }, "22:00 \u2014 09:00")));
}
function AppearanceSection({
  t,
  locale,
  setLocale
}) {
  const {
    themeMode,
    themeEff,
    setTheme
  } = React.useContext(window.LifeLocaleContext);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Row, {
    label: t('set_theme')
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-seg set-seg-theme"
  }, /*#__PURE__*/React.createElement("button", {
    className: "set-seg-btn" + (themeMode === 'dark' ? " is-on" : ""),
    onClick: () => setTheme('dark')
  }, /*#__PURE__*/React.createElement(ThemeGlyph, {
    kind: "dark"
  }), /*#__PURE__*/React.createElement("span", null, t('set_theme_dark'))), /*#__PURE__*/React.createElement("button", {
    className: "set-seg-btn" + (themeMode === 'light' ? " is-on" : ""),
    onClick: () => setTheme('light')
  }, /*#__PURE__*/React.createElement(ThemeGlyph, {
    kind: "light"
  }), /*#__PURE__*/React.createElement("span", null, t('set_theme_light'))), /*#__PURE__*/React.createElement("button", {
    className: "set-seg-btn" + (themeMode === 'paradise' ? " is-on" : ""),
    onClick: () => setTheme('paradise')
  }, /*#__PURE__*/React.createElement(ThemeGlyph, {
    kind: "paradise"
  }), /*#__PURE__*/React.createElement("span", null, t('set_theme_paradise'))), /*#__PURE__*/React.createElement("button", {
    className: "set-seg-btn set-seg-btn-system" + (themeMode === 'system' ? " is-on" : ""),
    onClick: () => setTheme('system'),
    title: "auto · " + themeEff
  }, /*#__PURE__*/React.createElement(ThemeGlyph, {
    kind: "system"
  }), /*#__PURE__*/React.createElement("span", null, t('set_theme_system')), /*#__PURE__*/React.createElement("span", {
    className: "set-seg-auto mono"
  }, "AUTO")))), /*#__PURE__*/React.createElement(Row, {
    label: t('set_lang')
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-seg"
  }, window.LifeLocales.map(loc => /*#__PURE__*/React.createElement("button", {
    key: loc,
    className: "set-seg-btn" + (locale === loc ? " is-on" : ""),
    onClick: () => setLocale(loc)
  }, loc.toUpperCase())))), /*#__PURE__*/React.createElement(Row, {
    label: t('set_accent_intensity'),
    hint: "100%"
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "set-range",
    min: "50",
    max: "120",
    defaultValue: "100"
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('set_density')
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-seg"
  }, /*#__PURE__*/React.createElement("button", {
    className: "set-seg-btn is-on"
  }, t('set_density_cozy')), /*#__PURE__*/React.createElement("button", {
    className: "set-seg-btn"
  }, t('set_density_compact')))));
}
function ExportSection({
  t
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Row, {
    label: t('set_export_json'),
    hint: ".json \xB7 184 KB"
  }, /*#__PURE__*/React.createElement("button", {
    className: "set-btn-ghost"
  }, "download")), /*#__PURE__*/React.createElement(Row, {
    label: t('set_export_csv'),
    hint: ".csv \xB7 12 KB"
  }, /*#__PURE__*/React.createElement("button", {
    className: "set-btn-ghost"
  }, "download")), /*#__PURE__*/React.createElement(Row, {
    label: t('set_export_md'),
    hint: ".md \xB7 24 KB"
  }, /*#__PURE__*/React.createElement("button", {
    className: "set-btn-ghost"
  }, "download")));
}
function DangerSection({
  t
}) {
  const data = React.useContext(window.LifeDataContext);
  const [confirmCount, setConfirmCount] = useStateSet(null); // months -> shows confirm row
  const [feedback, setFeedback] = useStateSet('');
  function exportJson() {
    if (!data) return;
    const blob = new Blob([data.exportJSON()], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifeOsState.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clearHistory(months) {
    if (!data) return;
    const cutoff = new Date(Date.now() - months * 30 * 86400000).toISOString();
    const before = (data.state.activityLog || []).length;
    data.clearActivityOlderThan(cutoff);
    const after = Math.max(0, before - 0); // we don't know after value synchronously
    /* approximate — we count rows older than the cutoff right now */
    const removed = (data.state.activityLog || []).filter(e => new Date(e.timestamp).getTime() < new Date(cutoff).getTime()).length;
    setFeedback(t('set_clear_done', removed));
    setConfirmCount(null);
    setTimeout(() => setFeedback(''), 3000);
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "set-danger-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-danger-msg"
  }, t('set_danger_msg')), /*#__PURE__*/React.createElement("button", {
    className: "set-btn-danger"
  }, t('set_danger_btn'))), /*#__PURE__*/React.createElement("div", {
    className: "set-subhead mono"
  }, "SPRINT 3A \xB7 STATE"), /*#__PURE__*/React.createElement(Row, {
    label: t('set_export_state'),
    hint: t('set_export_state_hint')
  }, /*#__PURE__*/React.createElement("button", {
    className: "set-btn-ghost",
    onClick: exportJson
  }, t('set_export_json'), " \u2193")), /*#__PURE__*/React.createElement(Row, {
    label: t('set_clear_history'),
    hint: t('set_clear_history_hint')
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-seg"
  }, /*#__PURE__*/React.createElement("button", {
    className: "set-seg-btn" + (confirmCount === 3 ? " is-on" : ""),
    onClick: () => setConfirmCount(3)
  }, t('set_clear_3mo')), /*#__PURE__*/React.createElement("button", {
    className: "set-seg-btn" + (confirmCount === 6 ? " is-on" : ""),
    onClick: () => setConfirmCount(6)
  }, t('set_clear_6mo')), /*#__PURE__*/React.createElement("button", {
    className: "set-seg-btn" + (confirmCount === 12 ? " is-on" : ""),
    onClick: () => setConfirmCount(12)
  }, t('set_clear_12mo')))), confirmCount != null && /*#__PURE__*/React.createElement(Row, {
    label: "",
    hint: feedback || ''
  }, /*#__PURE__*/React.createElement("div", {
    className: "set-clear-confirm"
  }, /*#__PURE__*/React.createElement("button", {
    className: "set-btn-ghost",
    onClick: () => setConfirmCount(null)
  }, t('qa_cancel')), /*#__PURE__*/React.createElement("button", {
    className: "set-btn-danger",
    onClick: () => clearHistory(confirmCount)
  }, t('set_clear_do')))), feedback && confirmCount == null && /*#__PURE__*/React.createElement("div", {
    className: "set-subhead mono",
    style: {
      color: 'var(--success)'
    }
  }, feedback));
}
function Toggle({
  on
}) {
  const [v, setV] = useStateSet(on);
  return /*#__PURE__*/React.createElement("button", {
    className: "set-toggle" + (v ? " is-on" : ""),
    onClick: () => setV(!v)
  }, /*#__PURE__*/React.createElement("span", {
    className: "set-toggle-knob"
  }));
}

/* Theme glyph — 14px. Dark = filled moon, light = sun, system = half-and-half
   (left half moon-fill, right half sun-rays). Gives the segmented control a
   visual signal beyond the label, so "системная" is identifiable even when
   it resolves to dark and matches "тёмная" textually. */
function ThemeGlyph({
  kind
}) {
  if (kind === 'dark') {
    return /*#__PURE__*/React.createElement("svg", {
      className: "set-seg-glyph",
      width: "14",
      height: "14",
      viewBox: "0 0 14 14",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M11.2 8.6A4.4 4.4 0 0 1 5.4 2.8a4.6 4.6 0 1 0 5.8 5.8z",
      fill: "currentColor"
    }));
  }
  if (kind === 'light') {
    return /*#__PURE__*/React.createElement("svg", {
      className: "set-seg-glyph",
      width: "14",
      height: "14",
      viewBox: "0 0 14 14",
      "aria-hidden": "true",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.4",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "7",
      cy: "7",
      r: "2.6"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7 1.4v1.6M7 11v1.6M1.4 7h1.6M11 7h1.6M3.1 3.1l1.1 1.1M9.8 9.8l1.1 1.1M3.1 10.9l1.1-1.1M9.8 4.2l1.1-1.1"
    }));
  }
  if (kind === 'paradise') {
    /* palm tree — stroke style matches the sun glyph (1.4 / round caps) */
    return /*#__PURE__*/React.createElement("svg", {
      className: "set-seg-glyph",
      width: "14",
      height: "14",
      viewBox: "0 0 14 14",
      "aria-hidden": "true",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.4",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M7.4 12.4c-.1-2.9.3-5.2 1.2-7"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8.6 5.4C7.1 4.2 5.3 4.1 3.9 5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8.6 5.4c1.6-1 3.3-.8 4.4.3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8.6 5.4C8 3.7 6.8 2.7 5.2 2.6"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8.6 5.4c.6-1.7 1.9-2.6 3.4-2.5"
    }));
  }
  // system — split disc: left half solid (night), right half hollow with center sun
  return /*#__PURE__*/React.createElement("svg", {
    className: "set-seg-glyph",
    width: "14",
    height: "14",
    viewBox: "0 0 14 14",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 1.4a5.6 5.6 0 0 0 0 11.2V1.4z",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "5.6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.1"
  }));
}
window.SettingsPage = SettingsPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/SettingsPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/Sidebar.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxSB,
  useEffect: useEffectSB
} = React;

/* v2 sidebar.
   Sections: MAIN / LIFE / MONEY / MEDS · settings pinned bottom.
   Two states: expanded (220px) and collapsed (60px, icons only).
   Active state = orange icon glow (not a ring around the icon).
   Counts come from props.counts so each route can update its own. */
function Sidebar({
  route,
  onNav,
  collapsed,
  setCollapsed,
  counts = {}
}) {
  const {
    t
  } = useCtxSB(window.LifeLocaleContext);
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
  const sections = [{
    id: 'main',
    items: [{
      id: 'home',
      icon: 'home',
      label: t('nav_home')
    }, {
      id: 'calendar',
      icon: 'calendar',
      label: t('nav_calendar')
    }, {
      id: 'notes',
      icon: 'stickyNote',
      label: t('nav_notes'),
      count: counts.notes
    }]
  }, {
    id: 'life',
    items: [{
      id: 'me',
      icon: 'user',
      label: t('nav_me')
    }, {
      id: 'tasks',
      icon: 'listChecks',
      label: t('nav_tasks'),
      count: counts.tasks
    }, {
      id: 'habits',
      icon: 'repeat',
      label: t('nav_habits'),
      count: counts.habits
    }, {
      id: 'goals',
      icon: 'target',
      label: t('nav_goals'),
      count: counts.goals
    }, {
      id: 'health',
      icon: 'heart',
      label: t('nav_health')
    }, {
      id: 'dog',
      icon: 'paw',
      label: t('nav_dog')
    }]
  }, {
    id: 'money',
    items: [{
      id: 'finances',
      icon: 'wallet',
      label: t('nav_finances')
    }, {
      id: 'monthly',
      icon: 'calendarRange',
      label: t('nav_monthly')
    }, {
      id: 'annual',
      icon: 'coins',
      label: t('nav_annual')
    }, {
      id: 'investments',
      icon: 'trendingUp',
      label: t('nav_investments')
    }]
  }, {
    id: 'meds',
    items: [{
      id: 'medications',
      icon: 'pill',
      label: t('nav_medications')
    }]
  }];
  return /*#__PURE__*/React.createElement("aside", {
    className: "sb" + (collapsed ? " is-collapsed" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "sb-top"
  }, /*#__PURE__*/React.createElement("button", {
    className: "sb-logo",
    onClick: () => onNav('home'),
    title: collapsed ? 'Life·OS' : undefined
  }, collapsed ? /*#__PURE__*/React.createElement("span", {
    className: "sb-logo-dot",
    "aria-hidden": "true"
  }) : /*#__PURE__*/React.createElement("svg", {
    width: "86",
    height: "28",
    viewBox: "0 0 124 40",
    fill: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "sbDot",
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#FFC066"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "48%",
    stopColor: "#FF8A1E"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#FF6B0A"
  }))), /*#__PURE__*/React.createElement("text", {
    x: "0",
    y: "29",
    fontFamily: "Onest, system-ui, sans-serif",
    fontWeight: "900",
    fontSize: "28",
    letterSpacing: "-0.03em"
  }, /*#__PURE__*/React.createElement("tspan", {
    fill: "#F5F5F7"
  }, "Life"), /*#__PURE__*/React.createElement("tspan", {
    fill: "url(#sbDot)"
  }, "\xB7"), /*#__PURE__*/React.createElement("tspan", {
    fill: "#F5F5F7"
  }, "OS")))), /*#__PURE__*/React.createElement("button", {
    className: "sb-toggle",
    onClick: () => setCollapsed(v => !v),
    title: collapsed ? t('sb_expand') : t('sb_collapse'),
    "aria-label": collapsed ? t('sb_expand') : t('sb_collapse')
  }, collapsed ? I.chevRight({
    size: 14
  }) : I.chevLeft({
    size: 14
  }))), /*#__PURE__*/React.createElement("nav", {
    className: "sb-nav"
  }, sections.map((sec, secIdx) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: sec.id
  }, secIdx > 0 && /*#__PURE__*/React.createElement("div", {
    className: "sb-divider",
    "aria-hidden": "true"
  }), sec.items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    className: "sb-item" + (route === it.id ? " is-active" : ""),
    onClick: () => onNav(it.id),
    "data-tooltip": it.label,
    "aria-label": it.label
  }, /*#__PURE__*/React.createElement("span", {
    className: "sb-icon"
  }, I[it.icon] ? I[it.icon]() : null), /*#__PURE__*/React.createElement("span", {
    className: "sb-label"
  }, it.label), it.count != null && it.count > 0 && /*#__PURE__*/React.createElement("span", {
    className: "sb-count mono"
  }, it.count)))))), /*#__PURE__*/React.createElement("div", {
    className: "sb-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "sb-item sb-settings" + (route === 'settings' ? " is-active" : ""),
    onClick: () => onNav('settings'),
    "data-tooltip": t('set_title'),
    "aria-label": t('set_title')
  }, /*#__PURE__*/React.createElement("span", {
    className: "sb-icon"
  }, I.command && I.command()), /*#__PURE__*/React.createElement("span", {
    className: "sb-label"
  }, t('set_title'))), !collapsed && /*#__PURE__*/React.createElement("div", {
    className: "sb-foot-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sb-avatar"
  }, "d"), /*#__PURE__*/React.createElement("div", {
    className: "sb-foot-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sb-foot-name"
  }, "dogfood"), /*#__PURE__*/React.createElement("div", {
    className: "sb-foot-sub mono"
  }, "v0.5 \xB7 ", t('footer_local'))))));
}
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/StreakMilestone.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxSM
} = React;
function StreakMilestone({
  milestone,
  onDismiss
}) {
  const {
    t
  } = useCtxSM(window.LifeLocaleContext);
  const I = window.LIcons;
  if (!milestone) return null;
  const {
    days,
    habit
  } = milestone;
  return /*#__PURE__*/React.createElement("div", {
    className: "milestone",
    role: "status"
  }, /*#__PURE__*/React.createElement("div", {
    className: "milestone-icon",
    "aria-hidden": "true"
  }, I.star({
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    className: "milestone-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono milestone-eyebrow"
  }, t('milestone_eyebrow', days, t.pl('pl_day', days))), /*#__PURE__*/React.createElement("div", {
    className: "milestone-line"
  }, t('milestone_line', days, t.pl('pl_day', days))), /*#__PURE__*/React.createElement("div", {
    className: "mono milestone-sub"
  }, habit)), /*#__PURE__*/React.createElement("button", {
    className: "milestone-dismiss mono",
    onClick: onDismiss
  }, t('milestone_dismiss')));
}
window.StreakMilestone = StreakMilestone;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/StreakMilestone.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/TaskDetailModal.jsx
try { (() => {
/* global React */
const {
  useState: useStateTD,
  useEffect: useEffectTD,
  useContext: useCtxTD,
  useRef: useRefTD
} = React;
function TaskDetailModal({
  task,
  onClose,
  onUpdate,
  onComplete,
  onDelete
}) {
  const {
    t,
    locale
  } = useCtxTD(window.LifeLocaleContext);
  const I = window.LIcons;
  const cats = window.LifeExpenseCats;
  const [title, setTitle] = useStateTD(task ? task.title : '');
  const [stakes, setStakes] = useStateTD(task ? !!task.stakes : false);
  const [catId, setCatId] = useStateTD(task && task.category ? task.category.id : null);
  const [catOpen, setCatOpen] = useStateTD(false);
  const [subtasks, setSubs] = useStateTD(task && task.subtasks ? task.subtasks : [{
    id: 1,
    title: 'набросать первый экран',
    done: true
  }, {
    id: 2,
    title: 'свести цвета',
    done: true
  }, {
    id: 3,
    title: 'подключить аналитику',
    done: false
  }]);
  const [newSub, setNewSub] = useStateTD('');
  const [notes, setNotes] = useStateTD(task ? task.notes || '' : '');
  const [confirmDel, setCD] = useStateTD(false);
  const [menuOpen, setMO] = useStateTD(false);
  const catBoxRef = useRefTD(null);
  useEffectTD(() => {
    if (!task) return;
    function handler(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commit();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  useEffectTD(() => {
    if (!catOpen) return;
    function handler(e) {
      if (catBoxRef.current && !catBoxRef.current.contains(e.target)) setCatOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catOpen]);
  if (!task) return null;
  function commit() {
    onUpdate({
      ...task,
      title: title.trim() || task.title,
      stakes,
      category: cats.find(c => c.id === catId) || null,
      subtasks,
      notes
    });
    onClose();
  }
  function toggleSub(id) {
    setSubs(s => s.map(x => x.id === id ? {
      ...x,
      done: !x.done
    } : x));
  }
  function addSub(e) {
    e.preventDefault();
    if (!newSub.trim()) return;
    setSubs(s => [...s, {
      id: Date.now(),
      title: newSub.trim(),
      done: false
    }]);
    setNewSub('');
  }
  function removeSub(id) {
    setSubs(s => s.filter(x => x.id !== id));
  }
  const subDone = subtasks.filter(s => s.done).length;
  const subTotal = subtasks.length;
  const selectedCat = cats.find(c => c.id === catId);

  /* Activity is now sourced from the global activityLog via the
     shared <ActivityTimeline /> component — see
     components/ActivityTimeline.jsx. Sprint 3A Batch 1.
     The old inline mock has been removed. */

  return /*#__PURE__*/React.createElement("div", {
    className: "qa-backdrop",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-modal td-modal",
    onMouseDown: e => e.stopPropagation(),
    role: "dialog"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-eyebrow mono"
  }, t('td_eyebrow'), " ", task.stakes && /*#__PURE__*/React.createElement("span", {
    className: "td-eyebrow-stakes"
  }, "\xB7 ", t('qa_stakes'))), /*#__PURE__*/React.createElement("div", {
    className: "td-head-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "td-menu-btn",
    onClick: () => setMO(o => !o)
  }, I.moreHorizontal({
    size: 14
  })), menuOpen && /*#__PURE__*/React.createElement("div", {
    className: "td-menu"
  }, !confirmDel ? /*#__PURE__*/React.createElement("button", {
    className: "td-menu-item is-danger",
    onClick: () => setCD(true)
  }, t('td_delete')) : /*#__PURE__*/React.createElement("div", {
    className: "td-menu-confirm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono td-menu-confirm-q"
  }, t('td_delete_confirm')), /*#__PURE__*/React.createElement("div", {
    className: "td-menu-confirm-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "td-menu-item",
    onClick: () => {
      setCD(false);
      setMO(false);
    }
  }, t('qa_cancel')), /*#__PURE__*/React.createElement("button", {
    className: "td-menu-item is-danger-solid",
    onClick: () => {
      onDelete(task.id);
      onClose();
    }
  }, t('td_delete_yes'))))), /*#__PURE__*/React.createElement("button", {
    className: "qa-close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(I.x, {
    size: 14
  })))), /*#__PURE__*/React.createElement("input", {
    className: "qa-title td-title",
    value: title,
    onChange: e => setTitle(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "qa-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-toggle"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-toggle-btn" + (!stakes ? " is-on" : ""),
    onClick: () => setStakes(false)
  }, t('qa_routine')), /*#__PURE__*/React.createElement("button", {
    className: "qa-toggle-btn is-stakes" + (stakes ? " is-on" : ""),
    onClick: () => setStakes(true)
  }, t('qa_stakes'))), /*#__PURE__*/React.createElement("div", {
    className: "qa-cat",
    ref: catBoxRef
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-cat-trigger",
    onClick: () => setCatOpen(o => !o)
  }, selectedCat ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-dot " + window.LifeCatTintClass[selectedCat.tint]
  }, I[selectedCat.icon] && I[selectedCat.icon]({
    size: 13
  })), /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-name"
  }, selectedCat.name[locale])) : /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-placeholder"
  }, t('qa_category')), /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-chev"
  }, I.chevDown({
    size: 12
  }))), catOpen && /*#__PURE__*/React.createElement("div", {
    className: "qa-cat-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-cat-list"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-cat-opt",
    onClick: () => {
      setCatId(null);
      setCatOpen(false);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-dot cat-tint-neutral"
  }, I.x({
    size: 11
  })), /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-opt-name"
  }, t('qa_no_category'))), cats.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    className: "qa-cat-opt",
    onClick: () => {
      setCatId(c.id);
      setCatOpen(false);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-dot " + window.LifeCatTintClass[c.tint]
  }, I[c.icon] && I[c.icon]({
    size: 13
  })), /*#__PURE__*/React.createElement("span", {
    className: "qa-cat-opt-name"
  }, c.name[locale]))))))), /*#__PURE__*/React.createElement("div", {
    className: "td-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "td-section-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono td-section-lab"
  }, t('td_subtasks')), /*#__PURE__*/React.createElement("span", {
    className: "mono td-section-count"
  }, subDone, "/", subTotal)), /*#__PURE__*/React.createElement("div", {
    className: "td-subtask-list"
  }, subtasks.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    className: "td-subtask" + (s.done ? " is-done" : "")
  }, /*#__PURE__*/React.createElement("button", {
    className: "task-check" + (s.done ? " is-done" : ""),
    onClick: () => toggleSub(s.id)
  }, s.done && I.check({
    size: 11
  })), /*#__PURE__*/React.createElement("span", {
    className: "td-subtask-title"
  }, s.title), /*#__PURE__*/React.createElement("button", {
    className: "td-subtask-remove",
    onClick: () => removeSub(s.id),
    title: t('qa_cancel')
  }, I.x({
    size: 11
  })))), /*#__PURE__*/React.createElement("form", {
    className: "td-subtask-add",
    onSubmit: addSub
  }, /*#__PURE__*/React.createElement("span", {
    className: "td-subtask-prefix"
  }, "+"), /*#__PURE__*/React.createElement("input", {
    className: "td-subtask-input",
    placeholder: t('td_subtask_add'),
    value: newSub,
    onChange: e => setNewSub(e.target.value)
  })))), /*#__PURE__*/React.createElement("div", {
    className: "td-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "td-section-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono td-section-lab"
  }, t('qa_notes_expanded'))), /*#__PURE__*/React.createElement("textarea", {
    className: "qa-notes-input",
    rows: 2,
    placeholder: t('qa_notes_placeholder'),
    value: notes,
    onChange: e => setNotes(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "td-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "td-section-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono td-section-lab"
  }, t('td_activity'))), /*#__PURE__*/React.createElement(window.ActivityTimeline, {
    entityType: "task",
    entityId: task.id
  })), /*#__PURE__*/React.createElement("div", {
    className: "qa-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-foot-hints mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-kbd"
  }, "\u2318 \u21B5"), /*#__PURE__*/React.createElement("span", null, t('td_save')), /*#__PURE__*/React.createElement("span", {
    className: "qa-foot-sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "qa-kbd"
  }, "ESC"), /*#__PURE__*/React.createElement("span", null, t('qa_cancel'))), /*#__PURE__*/React.createElement("div", {
    className: "qa-foot-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-ghost",
    onClick: () => {
      commit();
    }
  }, t('td_save')), /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-save" + (stakes ? " is-stakes" : ""),
    onClick: () => {
      onComplete(task.id);
      onClose();
    }
  }, task.done ? t('td_uncomplete') : t('td_complete'))))));
}
window.TaskDetailModal = TaskDetailModal;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/TaskDetailModal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/TaskList.jsx
try { (() => {
/* global React */
const {
  useState: useStateTL,
  useContext: useCtxTL
} = React;
function TaskList({
  tasks,
  onToggle,
  onAdd,
  onOpen
}) {
  const {
    t
  } = useCtxTL(window.LifeLocaleContext);
  const I = window.LIcons;
  const [draft, setDraft] = useStateTL('');
  const [stakes, setStakes] = useStateTL(false);
  function commit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd({
      title: draft.trim(),
      stakes
    });
    setDraft('');
    setStakes(false);
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "card panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "panel-title"
  }, t('tasks_title')), /*#__PURE__*/React.createElement("span", {
    className: "panel-meta mono"
  }, t('tasks_open_total', tasks.filter(x => !x.done).length, tasks.length))), tasks.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, t('empty_tasks')) : /*#__PURE__*/React.createElement("div", {
    className: "task-list"
  }, tasks.map(task => /*#__PURE__*/React.createElement("div", {
    key: task.id,
    className: "task-row" + (task.stakes ? " is-stakes" : "")
  }, /*#__PURE__*/React.createElement("button", {
    className: "task-check" + (task.done ? " is-done" : ""),
    onClick: () => onToggle(task.id)
  }, task.done && I.check({
    size: 12
  })), /*#__PURE__*/React.createElement("button", {
    className: "task-title task-title-btn" + (task.done ? " is-done" : ""),
    onClick: () => onOpen && onOpen(task)
  }, task.title), /*#__PURE__*/React.createElement("div", {
    className: "task-meta"
  }, (task.tag || task.tagLabel) && /*#__PURE__*/React.createElement("span", {
    className: "task-tag" + (task.stakes ? " is-stakes" : "")
  }, task.tagLabel || t('tag_' + task.tag, task.tag)), task.due && /*#__PURE__*/React.createElement("span", {
    className: "task-due mono"
  }, task.due))))), /*#__PURE__*/React.createElement("form", {
    className: "task-add",
    onSubmit: commit
  }, /*#__PURE__*/React.createElement("span", {
    className: "task-add-prefix" + (stakes ? " is-stakes" : "")
  }, stakes ? '★' : '+'), /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "task-add-input",
    placeholder: stakes ? t('tasks_add_stakes') : t('tasks_add'),
    value: draft,
    onChange: e => setDraft(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "task-add-toggle mono" + (stakes ? " is-stakes" : ""),
    onClick: () => setStakes(s => !s)
  }, stakes ? t('tasks_toggle_stakes') : t('tasks_toggle_routine'))));
}
window.TaskList = TaskList;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/TaskList.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/Toast.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxToast
} = React;
function Toast({
  toast
}) {
  const {
    t
  } = useCtxToast(window.LifeLocaleContext);
  if (!toast) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "toast " + (toast.kind === 'bot' ? "is-bot" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "toast-av " + (toast.kind === 'bot' ? "is-bot" : "")
  }, toast.kind === 'bot' ? 'tg' : 'sys'), /*#__PURE__*/React.createElement("div", {
    className: "toast-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "toast-name mono " + (toast.kind === 'bot' ? "is-bot" : "")
  }, toast.kind === 'bot' ? t('toast_name_bot') : t('toast_name_sys')), /*#__PURE__*/React.createElement("div", {
    className: "toast-msg"
  }, toast.msg), /*#__PURE__*/React.createElement("div", {
    className: "toast-ts mono"
  }, toast.ts)));
}
window.Toast = Toast;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/Toast.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/Today.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxToday
} = React;
function Today({
  tasks
}) {
  const {
    t,
    locale
  } = useCtxToday(window.LifeLocaleContext);
  const due = tasks.filter(x => !x.done).length;
  const done = tasks.filter(x => x.done).length;
  const total = tasks.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const intlLoc = window.LifeStrings[locale]._intl_locale;
  const dateLine = new Date().toLocaleDateString(intlLoc, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "today-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "today-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "today-eyebrow mono"
  }, t('today_eyebrow', due, t.pl('pl_task', due))), /*#__PURE__*/React.createElement("span", {
    className: "today-date mono"
  }, dateLine)), /*#__PURE__*/React.createElement("div", {
    className: "today-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "today-num mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "today-num-done"
  }, done), /*#__PURE__*/React.createElement("span", {
    className: "today-num-slash"
  }, "/"), /*#__PURE__*/React.createElement("span", {
    className: "today-num-total"
  }, total)), /*#__PURE__*/React.createElement("div", {
    className: "today-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "today-meta-line"
  }, t('today_meta_stakes')), /*#__PURE__*/React.createElement("div", {
    className: "today-progress"
  }, /*#__PURE__*/React.createElement("div", {
    className: "today-progress-fill",
    style: {
      width: pct + '%'
    }
  })))));
}
window.Today = Today;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/Today.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/TopBar.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxTB,
  useState: useStateTB
} = React;
function TopBar({
  onQuickAdd
}) {
  const {
    t,
    locale
  } = useCtxTB(window.LifeLocaleContext);
  const I = window.LIcons;
  const [search, setSearch] = useStateTB('');
  const now = new Date();
  const hr = now.getHours();
  const greet = hr < 5 ? t('tb_greet_night') : hr < 12 ? t('tb_greet_morning') : hr < 18 ? t('tb_greet_afternoon') : hr < 23 ? t('tb_greet_evening') : t('tb_greet_night');
  const intlLoc = window.LifeStrings[locale]._intl_locale;
  const weekday = now.toLocaleDateString(intlLoc, {
    weekday: 'short'
  }).replace('.', '');
  const dateStr = now.toLocaleDateString(intlLoc, {
    day: 'numeric',
    month: 'short'
  }).replace('.', '');
  const time = now.toTimeString().slice(0, 5);
  return /*#__PURE__*/React.createElement("header", {
    className: "tb"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tb-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tb-eyebrow mono"
  }, `${time} · ${weekday} ${dateStr}`), /*#__PURE__*/React.createElement("h1", {
    className: "tb-title"
  }, greet)), /*#__PURE__*/React.createElement("div", {
    className: "tb-right"
  }, /*#__PURE__*/React.createElement("label", {
    className: "tb-cmd"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tb-cmd-icon"
  }, I.search({
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "tb-cmd-input",
    placeholder: t('tb_search'),
    value: search,
    onChange: e => setSearch(e.target.value)
  }), /*#__PURE__*/React.createElement("span", {
    className: "tb-kbd mono"
  }, t('tb_kbd_cmdk'))), /*#__PURE__*/React.createElement("button", {
    className: "tb-add",
    onClick: onQuickAdd,
    title: t('qa_eyebrow')
  }, I.plus({
    size: 18
  }))));
}
window.TopBar = TopBar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/TopBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/categories.jsx
try { (() => {
/* global React */
/* Life OS category seed data.
   Each entry: { id, kind, icon (LIcons key), tint, name: { ru, uk } }.

   v0.3.1 — TINT RULE CORRECTED.
   Stakes is NOT a property of a category. Stakes is a property of an
   EVENT (budget at 80%+, milestone hit, one-off purchase above threshold,
   irreversible action). Tinting whole expense categories orange just
   pollutes the signal.

   Tints:
     - 'neutral' — ALL expense categories, no exceptions
                   (rent / utilities / health / education / travel
                    are recurring, however large — they're routine,
                    not stakes-as-moments)
     - 'income'  — green, all income categories
*/

const LIFE_CATEGORIES = [/* ── EXPENSES — all neutral ───────────────────────────────── */
{
  id: 'groceries',
  kind: 'expense',
  icon: 'shoppingCart',
  tint: 'neutral',
  name: {
    ru: 'продукты',
    uk: 'продукти'
  }
}, {
  id: 'restaurants',
  kind: 'expense',
  icon: 'utensils',
  tint: 'neutral',
  name: {
    ru: 'рестораны, кафе',
    uk: 'ресторани, кафе'
  }
}, {
  id: 'transport',
  kind: 'expense',
  icon: 'car',
  tint: 'neutral',
  name: {
    ru: 'транспорт',
    uk: 'транспорт'
  }
}, {
  id: 'utilities',
  kind: 'expense',
  icon: 'zap',
  tint: 'neutral',
  name: {
    ru: 'коммуналка',
    uk: 'комуналка'
  }
}, {
  id: 'rent',
  kind: 'expense',
  icon: 'home',
  tint: 'neutral',
  name: {
    ru: 'аренда, ипотека',
    uk: 'оренда, іпотека'
  }
}, {
  id: 'connectivity',
  kind: 'expense',
  icon: 'wifi',
  tint: 'neutral',
  name: {
    ru: 'связь и интернет',
    uk: "зв'язок та інтернет"
  }
}, {
  id: 'subscriptions',
  kind: 'expense',
  icon: 'creditCard',
  tint: 'neutral',
  name: {
    ru: 'подписки, софт',
    uk: 'підписки, софт'
  }
}, {
  id: 'health',
  kind: 'expense',
  icon: 'pill',
  tint: 'neutral',
  name: {
    ru: 'здоровье, аптека',
    uk: "здоров'я, аптека"
  }
}, {
  id: 'clothing',
  kind: 'expense',
  icon: 'shirt',
  tint: 'neutral',
  name: {
    ru: 'одежда',
    uk: 'одяг'
  }
}, {
  id: 'entertainment',
  kind: 'expense',
  icon: 'film',
  tint: 'neutral',
  name: {
    ru: 'развлечения',
    uk: 'розваги'
  }
}, {
  id: 'education',
  kind: 'expense',
  icon: 'bookOpen',
  tint: 'neutral',
  name: {
    ru: 'образование, курсы',
    uk: 'освіта, курси'
  }
}, {
  id: 'gifts_out',
  kind: 'expense',
  icon: 'gift',
  tint: 'neutral',
  name: {
    ru: 'подарки',
    uk: 'подарунки'
  }
}, {
  id: 'travel',
  kind: 'expense',
  icon: 'plane',
  tint: 'neutral',
  name: {
    ru: 'путешествия',
    uk: 'подорожі'
  }
}, {
  id: 'care',
  kind: 'expense',
  icon: 'scissors',
  tint: 'neutral',
  name: {
    ru: 'красота, уход',
    uk: 'краса, догляд'
  }
}, {
  id: 'household',
  kind: 'expense',
  icon: 'package',
  tint: 'neutral',
  name: {
    ru: 'дом, быт',
    uk: 'дім, побут'
  }
}, {
  id: 'other_out',
  kind: 'expense',
  icon: 'moreHorizontal',
  tint: 'neutral',
  name: {
    ru: 'другое',
    uk: 'інше'
  }
}, /* ── INCOME — all green ───────────────────────────────────── */
{
  id: 'salary',
  kind: 'income',
  icon: 'briefcase',
  tint: 'income',
  name: {
    ru: 'зарплата',
    uk: 'зарплата'
  }
}, {
  id: 'freelance',
  kind: 'income',
  icon: 'laptop',
  tint: 'income',
  name: {
    ru: 'фриланс, контракты',
    uk: 'фріланс, контракти'
  }
}, {
  id: 'cortexmd',
  kind: 'income',
  icon: 'building',
  tint: 'income',
  name: {
    ru: 'CortexMD выручка',
    uk: 'CortexMD виручка'
  }
}, {
  id: 'investments',
  kind: 'income',
  icon: 'trendingUp',
  tint: 'income',
  name: {
    ru: 'инвестиции, дивиденды',
    uk: 'інвестиції, дивіденди'
  }
}, {
  id: 'gifts_in',
  kind: 'income',
  icon: 'gift',
  tint: 'income',
  name: {
    ru: 'подарки (входящие)',
    uk: 'подарунки (вхідні)'
  }
}, {
  id: 'other_in',
  kind: 'income',
  icon: 'moreHorizontal',
  tint: 'income',
  name: {
    ru: 'другое',
    uk: 'інше'
  }
}];
const CAT_TINT_CLASS = {
  income: 'cat-tint-income',
  neutral: 'cat-tint-neutral'
};
window.LifeCategories = LIFE_CATEGORIES;
window.LifeCatTintClass = CAT_TINT_CLASS;
window.LifeExpenseCats = LIFE_CATEGORIES.filter(c => c.kind === 'expense');
window.LifeIncomeCats = LIFE_CATEGORIES.filter(c => c.kind === 'income');
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/categories.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/components/ActivityTimeline.jsx
try { (() => {
/* global React */
/* components/ActivityTimeline.jsx
 *
 * Renders the chronological history of a single entity from the
 * global activityLog. Drops into TaskDetailModal, MedDetailPage,
 * and the per-med dose-history tab.
 *
 * Props:
 *   entityType  — 'task' | 'transaction' | 'med_dose' | 'med_config'
 *                 | 'mode_style' | 'note' | etc. Pass null to show
 *                 every entry (used by the global ИСТОРИЯ tab).
 *   entityId    — id of the row. Null = no filter on id.
 *   emptyKey    — i18n key for the empty state. Defaults to a
 *                 generic message.
 *   limit       — max rows to render (default 50).
 *   filter      — additional optional `entry => boolean` filter
 *                 (used by global ИСТОРИЯ tab to scope to a med).
 *
 * Visual: same mono row vocabulary as TaskDetailModal had inline
 * before. Newest first. */

const {
  useContext: useCtxAT
} = React;
function ActivityTimeline({
  entityType,
  entityId,
  emptyKey,
  limit,
  filter
}) {
  const data = useCtxAT(window.LifeDataContext);
  const {
    locale,
    t
  } = useCtxAT(window.LifeLocaleContext);
  if (!data) return null;
  const log = data.state.activityLog || [];
  let rows = window.LifeActivity.entriesFor(log, entityType, entityId);
  if (filter) rows = rows.filter(filter);
  const cap = limit || 50;
  if (rows.length > cap) rows = rows.slice(0, cap);
  if (rows.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "atl atl-empty mono"
    }, t(emptyKey || 'atl_empty'));
  }
  const intlLoc = window.LifeStrings[locale] && window.LifeStrings[locale]._intl_locale || 'ru-RU';
  return /*#__PURE__*/React.createElement("div", {
    className: "atl"
  }, rows.map(r => {
    const d = new Date(r.timestamp);
    const when = d.toLocaleDateString(intlLoc, {
      day: 'numeric',
      month: 'short'
    }) + ' · ' + d.toTimeString().slice(0, 5);
    return /*#__PURE__*/React.createElement("div", {
      key: r.id,
      className: "atl-row mono"
    }, /*#__PURE__*/React.createElement("span", {
      className: "atl-when"
    }, when), /*#__PURE__*/React.createElement("span", {
      className: "atl-what"
    }, describeAction(r, t, locale)), r.details && r.details.text ? /*#__PURE__*/React.createElement("span", {
      className: "atl-detail"
    }, r.details.text.slice(0, 80)) : null);
  }));
}
function describeAction(entry, t, locale) {
  const a = entry.action;
  const lookup = window.LifeATLLabels && window.LifeATLLabels[locale === 'uk' ? 'uk' : 'ru'];
  if (lookup && lookup[a]) return lookup[a];
  return a.replace(/_/g, ' ');
}

/* Localized action labels. Lives here, not in i18n.jsx, to keep
   the action vocabulary co-located with the timeline component. */
window.LifeATLLabels = {
  ru: {
    created: 'создано',
    edited: 'отредактировано',
    completed: 'выполнено',
    reopened: 'возвращено в работу',
    deleted: 'удалено',
    restored: 'восстановлено',
    dose_taken: 'доза принята',
    dose_skipped: 'доза пропущена',
    dose_snoozed: 'отложено на час',
    mode_changed: 'стратегия изменена',
    inventory_updated: 'инвентарь обновлён',
    note_added: 'заметка добавлена',
    note_edited: 'заметка отредактирована',
    note_deleted: 'заметка удалена'
  },
  uk: {
    created: 'створено',
    edited: 'відредаговано',
    completed: 'виконано',
    reopened: 'повернуто в роботу',
    deleted: 'видалено',
    restored: 'відновлено',
    dose_taken: 'дозу прийнято',
    dose_skipped: 'дозу пропущено',
    dose_snoozed: 'відкладено на годину',
    mode_changed: 'стратегію змінено',
    inventory_updated: 'інвентар оновлено',
    note_added: 'нотатку додано',
    note_edited: 'нотатку відредаговано',
    note_deleted: 'нотатку видалено'
  }
};
window.ActivityTimeline = ActivityTimeline;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/components/ActivityTimeline.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/components/EyeToggle.jsx
try { (() => {
/* global React */
/* Sprint 3B · shared eye toggle.
   Two states (included / excluded). 150ms fade between glyphs.
   Used in:
     · /finances transaction rows
     · Settings → категории grid
*/

function EyeToggle({
  included,
  onToggle,
  size,
  title,
  ariaLabel
}) {
  const I = window.LIcons;
  const px = size || 14;
  const Icon = included ? I.eye : I.eyeOff;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "eye-tog" + (included ? " is-on" : " is-off"),
    onClick: e => {
      e.stopPropagation();
      onToggle && onToggle();
    },
    title: title || '',
    "aria-label": ariaLabel || title || '',
    "aria-pressed": !included
  }, Icon ? /*#__PURE__*/React.createElement(Icon, {
    size: px
  }) : null);
}
window.EyeToggle = EyeToggle;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/components/EyeToggle.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/components/MultiChangeWarningModal.jsx
try { (() => {
/* global React */
/* components/MultiChangeWarningModal.jsx · Sprint 3A Batch 3
 *
 * Soft warning shown when the user changes mode_style on a medication
 * while ≥1 OTHER active medication has had a 'mode_changed' entry in
 * the global activityLog within the last 7 days. Does NOT block —
 * user can dismiss + proceed. Fires once per change confirmation. */

const {
  useContext: useCtxMW
} = React;
function MultiChangeWarningModal({
  recentChanges,
  currentMed,
  onProceed,
  onCancel
}) {
  const {
    t,
    locale
  } = useCtxMW(window.LifeLocaleContext);
  const medName = currentMed['name_' + (locale === 'uk' ? 'ua' : 'ru')] || currentMed.name_ru;
  const intlLoc = window.LifeStrings[locale] && window.LifeStrings[locale]._intl_locale || 'ru-RU';
  return /*#__PURE__*/React.createElement("div", {
    className: "qa-backdrop",
    onMouseDown: onCancel
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-modal mcw-modal",
    onMouseDown: e => e.stopPropagation(),
    role: "dialog"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-eyebrow mono"
  }, t('mcw_title'))), /*#__PURE__*/React.createElement("div", {
    className: "mcw-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcw-intro"
  }, t('mcw_intro')), /*#__PURE__*/React.createElement("ul", {
    className: "mcw-list"
  }, recentChanges.map(c => {
    const dt = new Date(c.timestamp);
    const when = dt.toLocaleDateString(intlLoc, {
      day: '2-digit',
      month: '2-digit'
    });
    return /*#__PURE__*/React.createElement("li", {
      key: c.id,
      className: "mcw-list-item"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mcw-dot"
    }, "\xB7"), /*#__PURE__*/React.createElement("span", {
      className: "mcw-list-name"
    }, c.medName), /*#__PURE__*/React.createElement("span", {
      className: "mcw-list-when mono"
    }, "(", when, ")"));
  })), /*#__PURE__*/React.createElement("div", {
    className: "mcw-changing"
  }, t('mcw_changing', medName)), /*#__PURE__*/React.createElement("p", {
    className: "mcw-rationale"
  }, t('mcw_body'))), /*#__PURE__*/React.createElement("div", {
    className: "qa-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-foot-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-ghost",
    onClick: onCancel
  }, t('mcw_postpone')), /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-save btn--stakes",
    onClick: onProceed
  }, t('mcw_proceed'))))));
}
window.MultiChangeWarningModal = MultiChangeWarningModal;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/components/MultiChangeWarningModal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/components/ParadiseScene.jsx
try { (() => {
/* global React */
/* ════════════════════════════════════════════════════════════════
   ParadiseScene — Sprint 3.6
   Living island scene, ported from the approved reference
   (living-island-v3.html). Mounted ONLY under data-theme="paradise";
   day/night driven by the data-scene attribute on <html> (set by
   useTheme + the anti-flash head script — this component never
   computes time itself, it only reacts to the attribute).

   THREE MANDATORY PERFORMANCE PATTERNS (do not "simplify" away):
   1. OPAQUE DAY FLOOR — .ps-bg-day is always opacity:1 at the bottom
      of the stack; night fades in ABOVE it. Crossfading two layers
      lets the dark page bg bleed through mid-transition → dark
      flashing bands.
   2. SINGLE SEA FILTER LAYER — exactly one displaced (#ps-ripple)
      layer exists. Scene change = fade to 0 (.7s) → swap image →
      fade back (720ms timeout). Two simultaneous filtered layers
      double CPU → tile-band flicker.
   3. STATIC ISLAND PATCH — unfiltered day+night pair masked to the
      small island sits above the sea so displacement never touches
      it ("jelly pixels" otherwise). Native-pixel, cheap.

   Degradation: prefers-reduced-motion → static (no breathe, no sea,
   no glints, no clouds). Viewport <768px → no sea / glint / patch.
   ════════════════════════════════════════════════════════════════ */
(function () {
  const {
    useState: usePsState,
    useEffect: usePsEffect,
    useRef: usePsRef
  } = React;

  /* Relative to index.html (ui_kits/life-os/) → project /assets/scene/ */
  const PS_IMG_DAY = '../../assets/scene/island-day.jpg';
  const PS_IMG_NIGHT = '../../assets/scene/island-night.jpg';
  const PS_CSS = `
#paradise-scene{position:fixed;inset:0;z-index:0;overflow:hidden;background:#0b1320;pointer-events:none}
.ps-layer{position:absolute;inset:-3%;background-size:cover;background-position:center;
  animation:ps-breathe 50s ease-in-out infinite alternate;transform:translateZ(0)}
@keyframes ps-breathe{from{transform:scale(1.0) translateY(0)}to{transform:scale(1.045) translateY(-1%)}}

/* base: DAY is the permanent floor (always opaque), NIGHT fades in above it */
.ps-bg-day{background-image:url("${PS_IMG_DAY}")}
.ps-bg-night{background-image:url("${PS_IMG_NIGHT}");opacity:0;transition:opacity 1.4s ease;will-change:opacity}
html[data-scene="night"] .ps-bg-night{opacity:1}

/* SEA: a SINGLE displaced layer; JS swaps its image at scene change (fade out -> swap -> fade in) */
#ps-sea{-webkit-mask:radial-gradient(ellipse 52% 56% at 50% 52%, transparent 43%, #000 88%);
        mask:radial-gradient(ellipse 52% 56% at 50% 52%, transparent 43%, #000 88%);
  filter:url(#ps-ripple);background-image:url("${PS_IMG_DAY}");
  transition:opacity .7s ease;will-change:opacity}

/* glints */
.ps-glint{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:.4;
  -webkit-mask:radial-gradient(ellipse 52% 56% at 50% 52%, transparent 45%, #000 90%);
          mask:radial-gradient(ellipse 52% 56% at 50% 52%, transparent 45%, #000 90%)}
html[data-scene="night"] .ps-glint{opacity:.25}
.ps-glint::before{content:"";position:absolute;inset:-20%;
  background:radial-gradient(140px 60px at 25% 35%,rgba(190,230,255,.18),transparent 60%),
            radial-gradient(160px 70px at 72% 62%,rgba(160,215,255,.15),transparent 60%),
            radial-gradient(120px 50px at 50% 82%,rgba(200,235,255,.16),transparent 60%);
  animation:ps-drift1 30s linear infinite}
@keyframes ps-drift1{0%{transform:translate(0,0)}100%{transform:translate(5%,-4%)}}

/* STATIC PATCH over the small island: day floor + night overlay (no filter, cheap) */
.ps-patch{-webkit-mask:radial-gradient(ellipse 18% 22% at 77% 12%, #000 55%, transparent 98%);
              mask:radial-gradient(ellipse 18% 22% at 77% 12%, #000 55%, transparent 98%);
  pointer-events:none}
.ps-patch-day{background-image:url("${PS_IMG_DAY}")}
.ps-patch-night{background-image:url("${PS_IMG_NIGHT}");opacity:0;transition:opacity 1.4s ease;will-change:opacity}
html[data-scene="night"] .ps-patch-night{opacity:1}

/* clouds */
.ps-cloud{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.5),transparent 70%);
  filter:blur(8px);pointer-events:none;opacity:.45;will-change:transform}
.ps-c1{width:340px;height:120px;top:8%;left:-20%;animation:ps-cloud 90s linear infinite}
.ps-c2{width:260px;height:90px;top:18%;left:-30%;animation:ps-cloud 120s linear infinite;animation-delay:-50s;opacity:.35}
@keyframes ps-cloud{from{transform:translateX(0)}to{transform:translateX(160vw)}}
html[data-scene="night"] .ps-cloud{opacity:.16}

/* degradation: reduced motion = static island + day/night crossfade only */
@media (prefers-reduced-motion: reduce){
  .ps-layer{animation:none}
  #ps-sea,.ps-glint,.ps-cloud{display:none}
}
`;
  function ParadiseScene() {
    const [psNarrow, setPsNarrow] = usePsState(() => window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
    const seaRef = usePsRef(null);
    const curNightRef = usePsRef(null);
    const swapTRef = usePsRef(null);

    /* viewport <768px: do not render sea / glint / patch at all */
    usePsEffect(() => {
      if (!window.matchMedia) return;
      const mq = window.matchMedia('(max-width: 767px)');
      const handler = e => setPsNarrow(e.matches);
      mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
      return () => {
        mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler);
      };
    }, []);

    /* Preload both images so the day↔night swap never pops */
    usePsEffect(() => {
      [PS_IMG_DAY, PS_IMG_NIGHT].forEach(src => {
        const im = new Image();
        im.src = src;
      });
    }, []);

    /* Single-sea image swap, reacting to data-scene on <html>.
       Pattern from reference: fade out .7s → swap → fade in (720ms). */
    usePsEffect(() => {
      const el = document.documentElement;
      curNightRef.current = null;
      function sync() {
        const night = el.getAttribute('data-scene') === 'night';
        const sea = seaRef.current;
        if (sea) {
          const want = 'url("' + (night ? PS_IMG_NIGHT : PS_IMG_DAY) + '")';
          if (curNightRef.current === null) {
            sea.style.backgroundImage = want; /* first paint: no fade */
          } else if (curNightRef.current !== night) {
            sea.style.opacity = '0';
            clearTimeout(swapTRef.current);
            swapTRef.current = setTimeout(() => {
              if (seaRef.current) {
                seaRef.current.style.backgroundImage = want;
                seaRef.current.style.opacity = '1';
              }
            }, 720);
          }
        }
        curNightRef.current = night;
      }
      sync();
      const mo = new MutationObserver(sync);
      mo.observe(el, {
        attributes: true,
        attributeFilter: ['data-scene']
      });
      return () => {
        mo.disconnect();
        clearTimeout(swapTRef.current);
      };
    }, [psNarrow]);
    return /*#__PURE__*/React.createElement("div", {
      id: "paradise-scene",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("style", null, PS_CSS), /*#__PURE__*/React.createElement("svg", {
      width: "0",
      height: "0",
      style: {
        position: 'absolute'
      }
    }, /*#__PURE__*/React.createElement("filter", {
      id: "ps-ripple",
      x: "-10%",
      y: "-10%",
      width: "120%",
      height: "120%"
    }, /*#__PURE__*/React.createElement("feTurbulence", {
      type: "fractalNoise",
      baseFrequency: "0.012 0.02",
      numOctaves: "2",
      seed: "3",
      result: "n"
    }, /*#__PURE__*/React.createElement("animate", {
      attributeName: "baseFrequency",
      dur: "20s",
      values: "0.012 0.02;0.016 0.025;0.012 0.02",
      repeatCount: "indefinite"
    })), /*#__PURE__*/React.createElement("feDisplacementMap", {
      in: "SourceGraphic",
      in2: "n",
      scale: "9",
      xChannelSelector: "R",
      yChannelSelector: "G"
    }))), /*#__PURE__*/React.createElement("div", {
      className: "ps-layer ps-bg-day"
    }), /*#__PURE__*/React.createElement("div", {
      className: "ps-layer ps-bg-night"
    }), !psNarrow && /*#__PURE__*/React.createElement("div", {
      className: "ps-layer",
      id: "ps-sea",
      ref: seaRef
    }), !psNarrow && /*#__PURE__*/React.createElement("div", {
      className: "ps-glint"
    }), !psNarrow && /*#__PURE__*/React.createElement("div", {
      className: "ps-layer ps-patch ps-patch-day"
    }), !psNarrow && /*#__PURE__*/React.createElement("div", {
      className: "ps-layer ps-patch ps-patch-night"
    }), /*#__PURE__*/React.createElement("div", {
      className: "ps-cloud ps-c1"
    }), /*#__PURE__*/React.createElement("div", {
      className: "ps-cloud ps-c2"
    }));
  }
  window.ParadiseScene = ParadiseScene;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/components/ParadiseScene.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/data/calendar-seed.js
try { (() => {
/* data/calendar-seed.js
 *
 * Sprint 3B · seed event pool to demonstrate the new pill density.
 *
 * Events are anchored to "this week" relative to today. The aggregator
 * in lib/calendar.js merges these with state.tasks, state.dog feeding
 * times, and (eventually) state.medications doses into per-day buckets.
 *
 * Shape:
 *   { dayOffset: -3..+3 from week-Mon, time: 'HH:MM',
 *     titleKey: i18n key, kind: 'stakes'|'routine'|'info',
 *     source: 'task'|'health'|'work'|'social'|'bill'|'med',
 *     metaKey?: optional second-line key for DayDetailModal }
 *
 * dayOffset is 0-based against Monday of the current display week. We
 * intentionally seed two days near max density so the "+N ещё"
 * overflow + DayDetailModal are visible by default.
 */

window.LifeCalendarSeed = [/* Monday — sparse */
{
  dayOffset: 0,
  time: '09:00',
  titleKey: 'cal_seed_standup',
  kind: 'routine',
  source: 'work'
}, {
  dayOffset: 0,
  time: '14:00',
  titleKey: 'cal_seed_walk',
  kind: 'info',
  source: 'health'
}, {
  dayOffset: 0,
  time: '17:30',
  titleKey: 'cal_seed_gym',
  kind: 'routine',
  source: 'health'
}, /* Tuesday — medium */
{
  dayOffset: 1,
  time: '08:30',
  titleKey: 'cal_seed_call_mum',
  kind: 'routine',
  source: 'social'
}, {
  dayOffset: 1,
  time: '11:00',
  titleKey: 'cal_seed_review_pr',
  kind: 'routine',
  source: 'work'
}, {
  dayOffset: 1,
  time: '15:00',
  titleKey: 'cal_seed_therapy',
  kind: 'stakes',
  source: 'health'
}, {
  dayOffset: 1,
  time: '19:00',
  titleKey: 'cal_seed_dinner_a',
  kind: 'info',
  source: 'social'
}, /* Wednesday — DENSE (9 events → triggers overflow) */
{
  dayOffset: 2,
  time: '07:00',
  titleKey: 'cal_seed_run',
  kind: 'routine',
  source: 'health'
}, {
  dayOffset: 2,
  time: '09:00',
  titleKey: 'cal_seed_standup',
  kind: 'routine',
  source: 'work'
}, {
  dayOffset: 2,
  time: '10:30',
  titleKey: 'cal_seed_design_rev',
  kind: 'routine',
  source: 'work'
}, {
  dayOffset: 2,
  time: '12:00',
  titleKey: 'cal_seed_lunch_x',
  kind: 'info',
  source: 'social'
}, {
  dayOffset: 2,
  time: '14:00',
  titleKey: 'cal_seed_ship_v1',
  kind: 'stakes',
  source: 'work'
}, {
  dayOffset: 2,
  time: '16:00',
  titleKey: 'cal_seed_one_on_one',
  kind: 'routine',
  source: 'work'
}, {
  dayOffset: 2,
  time: '17:30',
  titleKey: 'cal_seed_bill_rent',
  kind: 'info',
  source: 'bill'
}, {
  dayOffset: 2,
  time: '18:30',
  titleKey: 'cal_seed_groceries',
  kind: 'info',
  source: 'work'
}, {
  dayOffset: 2,
  time: '20:00',
  titleKey: 'cal_seed_vet_call',
  kind: 'info',
  source: 'health'
}, {
  dayOffset: 2,
  time: '21:00',
  titleKey: 'cal_seed_read',
  kind: 'routine',
  source: 'work'
}, /* Thursday — medium */
{
  dayOffset: 3,
  time: '09:30',
  titleKey: 'cal_seed_focus',
  kind: 'routine',
  source: 'work'
}, {
  dayOffset: 3,
  time: '11:00',
  titleKey: 'cal_seed_q4_commit',
  kind: 'stakes',
  source: 'work'
}, {
  dayOffset: 3,
  time: '14:00',
  titleKey: 'cal_seed_walk',
  kind: 'info',
  source: 'health'
}, {
  dayOffset: 3,
  time: '18:00',
  titleKey: 'cal_seed_dentist',
  kind: 'stakes',
  source: 'health'
}, /* Friday — medium */
{
  dayOffset: 4,
  time: '09:00',
  titleKey: 'cal_seed_standup',
  kind: 'routine',
  source: 'work'
}, {
  dayOffset: 4,
  time: '12:30',
  titleKey: 'cal_seed_lunch_team',
  kind: 'info',
  source: 'social'
}, {
  dayOffset: 4,
  time: '15:00',
  titleKey: 'cal_seed_demo',
  kind: 'stakes',
  source: 'work'
}, {
  dayOffset: 4,
  time: '19:00',
  titleKey: 'cal_seed_movie',
  kind: 'info',
  source: 'social'
}, /* Saturday — sparse */
{
  dayOffset: 5,
  time: '10:00',
  titleKey: 'cal_seed_run',
  kind: 'routine',
  source: 'health'
}, {
  dayOffset: 5,
  time: '15:00',
  titleKey: 'cal_seed_dinner_a',
  kind: 'info',
  source: 'social'
}

/* Sunday — empty by design (demonstrates the "тихий день" feel) */];
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/data/calendar-seed.js", error: String((e && e.message) || e) }); }

// ui_kits/life-os/data/dashboard-seed.js
try { (() => {
/* data/dashboard-seed.js
 *
 * Mock seed for /home stats dashboard. Numbers are realistic for one
 * person living in a tier-1 city; replace with real aggregates once
 * the data layer lands.
 *
 * Currency is USD across the kit (per money-widget v1 convention). */

window.LifeDashSeed = {
  /* ── headline numbers (current month) ─────────────────────────── */
  budget: {
    capUsd: 4000,
    spentUsd: 2480,
    /* category caps used by the categories chart to decide if any one
       row deserves the orange-stakes treatment. Sum doesn't need to
       equal capUsd — these are soft sub-caps. */
    capsByCat: {
      rent: 1200,
      groceries: 450,
      restaurants: 300,
      subscriptions: 150,
      utilities: 250,
      transport: 180,
      health: 200,
      entertainment: 150,
      care: 120,
      household: 200
    }
  },
  /* ── trend chart · last 6 months ──────────────────────────────── */
  /* monthKey is a stable id; label is what we render on the X-axis. */
  last6Months: [{
    monthKey: '2026-01',
    label_ru: 'янв',
    label_uk: 'січ',
    expenses: 3120,
    income: 5200
  }, {
    monthKey: '2026-02',
    label_ru: 'фев',
    label_uk: 'лют',
    expenses: 2850,
    income: 5200
  }, {
    monthKey: '2026-03',
    label_ru: 'мар',
    label_uk: 'бер',
    expenses: 4180,
    income: 6800
  }, {
    monthKey: '2026-04',
    label_ru: 'апр',
    label_uk: 'кві',
    expenses: 2920,
    income: 5200
  }, {
    monthKey: '2026-05',
    label_ru: 'май',
    label_uk: 'тра',
    expenses: 3650,
    income: 5500
  }, {
    monthKey: '2026-06',
    label_ru: 'июн',
    label_uk: 'чер',
    expenses: 2480,
    income: 5200
  }],
  /* ── category breakdown · current month ───────────────────────── */
  /* sums to 2480 (matches budget.spentUsd). Sorted unsorted on purpose
     — the chart sorts descending at render time. */
  categoryBreakdown: [{
    catId: 'rent',
    amount: 1100
  }, {
    catId: 'groceries',
    amount: 380
  }, {
    catId: 'utilities',
    amount: 220
  }, {
    catId: 'restaurants',
    amount: 240
  }, {
    catId: 'subscriptions',
    amount: 140
  },
  // 93% of cap 150 → triggers orange stakes
  {
    catId: 'transport',
    amount: 95
  }, {
    catId: 'health',
    amount: 165
  }, {
    catId: 'entertainment',
    amount: 85
  }, {
    catId: 'care',
    amount: 55
  }],
  /* 30-day variant — used by the "30 дней" filter. Slightly different
     numbers since the window slides over a different range. */
  categoryBreakdown30d: [{
    catId: 'rent',
    amount: 1100
  }, {
    catId: 'groceries',
    amount: 410
  }, {
    catId: 'restaurants',
    amount: 285
  }, {
    catId: 'utilities',
    amount: 220
  }, {
    catId: 'subscriptions',
    amount: 140
  }, {
    catId: 'transport',
    amount: 118
  }, {
    catId: 'health',
    amount: 165
  }, {
    catId: 'entertainment',
    amount: 95
  }, {
    catId: 'care',
    amount: 62
  }, {
    catId: 'household',
    amount: 45
  }],
  /* ── streak (hero card 2) ─────────────────────────────────────── */
  longestStreak: {
    days: 47,
    habitKey: 'habit_write'
  },
  /* ── goal (hero card 3) ───────────────────────────────────────── */
  nearestGoal: {
    titleKey: 'goal_emergency',
    pct: 84
  },
  /* ── tasks this week (hero card 4) ────────────────────────────── */
  tasksThisWeek: {
    done: 23,
    total: 30
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/data/dashboard-seed.js", error: String((e && e.message) || e) }); }

// ui_kits/life-os/data/dog.js
try { (() => {
/* global */
/* Dog seed data. Placeholders deliberate — user fills in real values
   when the dog is bought. The vet visit dates follow standard Maltipoo F1
   puppy vaccination schedule (DHP → DHPP → DHPP+rabies → yearly boosters);
   user should verify with their actual vet upon purchase. */

window.LifeDogSeed = {
  profile: {
    name: '',
    // user names the dog post-purchase
    breed: {
      ru: 'мальтипу F1',
      uk: 'мальтіпу F1'
    },
    breedEn: 'Maltipoo F1',
    birth: '',
    // empty until known
    weight: '' // empty until first vet visit
  },
  feeding: {
    meals: [{
      id: 'm1',
      time: '08:00',
      portion: ''
    }, {
      id: 'm2',
      time: '14:00',
      portion: ''
    }, {
      id: 'm3',
      time: '20:00',
      portion: ''
    }]
  },
  inventory: {
    food: {
      remainingG: 0,
      totalG: 0,
      daysPerKg: 0
    },
    treats: null,
    hygiene: null
  },
  vet: {
    last: {
      date: '06.10.2025',
      note_ru: 'профилактический осмотр, чип, первая вакцинация.',
      note_uk: 'профілактичний огляд, чип, перша вакцинація.'
    },
    next: {
      date: '12.12.2025',
      note_ru: 'ревакцинация DHPPi+L.',
      note_uk: 'ревакцинація DHPPi+L.'
    }
    /* TODO: verify schedule with actual vet upon purchase. Standard
       Maltipoo F1 puppy plan per public veterinary references:
         6–8 wk : DHP (first)
         10–12wk: DHPP
         14–16wk: DHPP + rabies
         yearly : boosters */
  },
  reminders: {
    /* mock countdowns — Sprint 3 wires these to real timers */
    nextFeedIn: '2ч 14м',
    nextWalkIn: '45м'
  },
  tasks: [],
  expenses: {
    thisMonth: 0,
    byCategory: {}
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/data/dog.js", error: String((e && e.message) || e) }); }

// ui_kits/life-os/data/medications.js
try { (() => {
/* data/medications.js
 *
 * Personal medication data for Life OS. All pharmacokinetic values
 * are standard pharmacological estimates from public references;
 * they should be verified by the user's pharmacist or psychiatrist
 * before being used for clinical decisions. This data exists only
 * to power the in-app tracker — Life OS does NOT provide medical
 * advice.
 *
 * CYP2D6 NOTE: bupropion (and its active metabolites) is a moderate-
 * to-strong CYP2D6 inhibitor. Sertraline at ≥150 mg/day is also a
 * moderate CYP2D6 inhibitor. Concurrent use raises exposure of
 * CYP2D6-substrate drugs in this list — see `interactions` field at
 * the bottom.
 *
 * NOTE: The spec hands this off as an ES module (`export const`).
 * Life OS currently loads everything via plain <script> tags + Babel
 * standalone, so we mount the same shapes onto window globals. The
 * structure is unchanged from the spec — Sprint 3 reads from these
 * directly. */

window.LifeMeds = [{
  id: "sertraline",
  name_ru: "Сертралин",
  name_ua: "Сертралін",
  brand_common: "Золофт / Zoloft",
  active_en: "Sertraline",
  status: "active",
  strength_mg: 50,
  current_dose_mg_per_day: 150,
  doses_per_day: 1,
  schedule_default: ["morning"],
  half_life_h: 26,
  dose_interval_h: 24,
  cyp2d6_role: "weak_inhibitor",
  // dose-dependent ≥150 mg/day
  interaction_flags: ["self_2d6_inhibitor_at_high_dose"],
  inventory_count: 0,
  // user fills
  notes_ru: "При дозе 150 мг сам по себе становится умеренным " + "ингибитором CYP2D6."
}, {
  id: "bupropion",
  name_ru: "Бупропион",
  name_ua: "Бупропіон",
  brand_common: "Бупринол (UA) / Wellbutrin",
  active_en: "Bupropion",
  status: "active",
  strength_mg: 150,
  current_dose_mg_per_day: 225,
  doses_per_day: 2,
  schedule_default: ["morning", "midday"],
  schedule_notes_ru: "Утром — 150 мг. В обед — 75 мг " + "(половина таблетки 150 мг — производитель " + "не рекомендует ломать, пользователь делает " + "это намеренно).",
  half_life_h: 14,
  half_life_metabolite_h: 24,
  // hydroxybupropion, active
  dose_interval_h: 6,
  // between morning and midday dose
  cyp2d6_role: "moderate_inhibitor",
  // via metabolites
  interaction_flags: ["primary_2d6_inhibitor"],
  inventory_count: 0,
  notes_ru: "Мощный ингибитор CYP2D6 через метаболиты " + "(threohydrobupropion, erythrohydrobupropion). " + "Повышает экспозицию субстратов CYP2D6 в этом списке."
}, {
  id: "vortioxetine",
  name_ru: "Вортиоксетин",
  name_ua: "Вортіоксетин",
  brand_common: "Бринтелликс / Brintellix / Trintellix",
  active_en: "Vortioxetine",
  status: "active",
  strength_mg: 10,
  current_dose_mg_per_day: 10,
  doses_per_day: 1,
  schedule_default: ["morning"],
  half_life_h: 66,
  dose_interval_h: 24,
  cyp2d6_role: "substrate",
  interaction_flags: ["2d6_substrate"],
  inventory_count: 0,
  notes_ru: "Метаболизируется преимущественно CYP2D6. С " + "бупропионом AUC увеличивается в 2.3 раза, Cmax в " + "2.1 раза (Springer Clin Pharmacokinet 2017). " + "Производитель официально рекомендует снижать дозу " + "вдвое при совместном приёме с сильными " + "ингибиторами CYP2D6."
}, {
  id: "duloxetine",
  name_ru: "Дулоксетин",
  name_ua: "Дулоксетин",
  brand_common: "Симбалта / Cymbalta",
  active_en: "Duloxetine",
  status: "active",
  strength_mg: 30,
  current_dose_mg_per_day: 30,
  doses_per_day: 1,
  schedule_default: ["morning"],
  half_life_h: 12,
  dose_interval_h: 24,
  cyp2d6_role: "substrate",
  interaction_flags: ["2d6_substrate_partial", "1a2_substrate"],
  inventory_count: 0,
  notes_ru: "Частично метаболизируется CYP2D6 и CYP1A2. " + "Теоретически бупропион может повысить уровни, но " + "клинически значимый эффект не подтверждён " + "(Mental Health Clin 2016)."
}, {
  id: "milnacipran",
  name_ru: "Милнаципран",
  name_ua: "Мілнаципран",
  brand_common: "Иксел / Savella",
  active_en: "Milnacipran",
  status: "active",
  strength_mg: 50,
  current_dose_mg_per_day: 50,
  doses_per_day: 1,
  schedule_default: ["morning"],
  half_life_h: 8,
  dose_interval_h: 24,
  cyp2d6_role: "none",
  interaction_flags: [],
  inventory_count: 0,
  notes_ru: "Не метаболизируется через CYP2D6 значимо. " + "Минимальный риск взаимодействий с бупропионом."
}, {
  id: "lamotrigine",
  name_ru: "Ламотриджин",
  name_ua: "Ламотриджин",
  brand_common: "Епілептал (UA) / Lamictal",
  active_en: "Lamotrigine",
  status: "active",
  strength_mg: 50,
  current_dose_mg_per_day: 50,
  doses_per_day: 1,
  schedule_default: ["evening"],
  half_life_h: 25,
  dose_interval_h: 24,
  cyp2d6_role: "none",
  interaction_flags: ["ugt_substrate"],
  inventory_count: 0,
  notes_ru: "Метаболизируется через UGT, не через CYP2D6. " + "Без значимых взаимодействий с этим списком."
}, {
  id: "atomoxetine",
  name_ru: "Атомоксетин",
  name_ua: "Атомоксетин",
  brand_common: "Страттера / Strattera",
  active_en: "Atomoxetine",
  status: "inactive",
  // not currently taken; might return later
  strength_mg: 18,
  current_dose_mg_per_day: 0,
  doses_per_day: 0,
  schedule_default: [],
  schedule_notes_ru: "Раньше принимался 10/18 мг с делением " + "пополам. Сейчас не принимается. " + "Возможен возврат в будущем.",
  half_life_h: 5,
  // extensive 2D6 metabolizers; ~24h with 2D6 inhibitor
  half_life_h_with_2d6_inhibitor: 24,
  dose_interval_h: 24,
  cyp2d6_role: "substrate_major",
  interaction_flags: ["2d6_substrate_major", "5x_exposure_with_bupropion"],
  inventory_count: 0,
  notes_ru: "Сильно зависит от CYP2D6 (PubMed 27518170). С " + "бупропионом AUC увеличивается в 5.1 раза, t½ " + "удлиняется значительно. Если будет возврат — " + "потребует пересмотра дозы при сочетании с " + "бупропионом или сертралином 150 мг."
}, {
  id: "methylphenidate",
  name_ru: "Метилфенидат",
  name_ua: "Метилфенідат",
  brand_common: "Concerta / Ritalin / Medikinet",
  active_en: "Methylphenidate",
  status: "planned",
  // готовится к РДУГ диагностике
  strength_mg: null,
  current_dose_mg_per_day: 0,
  doses_per_day: 0,
  schedule_default: [],
  half_life_h: 3,
  // immediate-release; ER varies
  half_life_h_er: 8,
  dose_interval_h: null,
  cyp2d6_role: "none",
  interaction_flags: ["ces1_substrate"],
  inventory_count: 0,
  notes_ru: "Метаболизируется в основном эстеразой CES1, " + "практически не зависит от CYP2D6. Бупропион не " + "должен значимо влиять на экспозицию. Ожидание " + "получения после РДУГ-диагностики."
}, {
  id: "cariprazine",
  name_ru: "Карипразин",
  name_ua: "Каріпразин",
  brand_common: "Vraylar / Reagila",
  active_en: "Cariprazine",
  status: "considering",
  // под вопросом, не принимался
  strength_mg: 1.5,
  current_dose_mg_per_day: 0,
  doses_per_day: 0,
  schedule_default: [],
  half_life_h: 48,
  // parent compound
  half_life_active_metabolite_h: 360,
  // ~15 days (DDCAR)
  dose_interval_h: 24,
  cyp2d6_role: "none",
  interaction_flags: ["3a4_substrate", "extremely_long_half_life"],
  inventory_count: 0,
  notes_ru: "Метаболизируется через CYP3A4, не CYP2D6. " + "Активный метаболит didesmethyl-cariprazine имеет " + "период полувыведения ~2-3 недели — выход на " + "стабильный уровень и вывод из организма занимают " + "недели. Решение об началe требует осознанности " + "из-за инерции препарата."
}, {
  id: "nac",
  name_ru: "NAC (N-ацетилцистеин)",
  name_ua: "NAC (N-ацетилцистеїн)",
  brand_common: "NAC supplement",
  active_en: "N-Acetylcysteine",
  status: "active",
  strength_mg: 600,
  current_dose_mg_per_day: 1200,
  doses_per_day: 2,
  // 2 таблетки по 600 мг
  schedule_default: ["morning", "evening"],
  half_life_h: 6,
  dose_interval_h: 12,
  cyp2d6_role: "none",
  interaction_flags: ["supplement"],
  is_supplement: true,
  inventory_count: 0,
  notes_ru: "БАД, не лекарство. Без значимых взаимодействий с " + "психиатрическими препаратами в этом списке."
}, {
  id: "magtein",
  name_ru: "Magtein (Magnesium L-Threonate)",
  name_ua: "Magtein (Магній L-треонат)",
  brand_common: "Magtein / Magnesium L-Threonate",
  active_en: "Magnesium L-Threonate",
  status: "active",
  strength_mg: null,
  // dose by capsules, not mg
  current_dose_mg_per_day: null,
  doses_per_day: 3,
  // 3 капсулы вечером
  schedule_default: ["evening"],
  schedule_notes_ru: "3 капсулы вечером, одной дозой.",
  half_life_h: null,
  dose_interval_h: 24,
  cyp2d6_role: "none",
  interaction_flags: ["supplement"],
  is_supplement: true,
  inventory_count: 0,
  notes_ru: "БАД для поддержки памяти и обучения. Без " + "значимых взаимодействий с препаратами списка."
}];

// Known clinically significant interactions in this user's list.
// Sprint 3 will render these as warning chips on the relevant
// medication cards.
window.LifeMedInteractions = [{
  a: "bupropion",
  b: "atomoxetine",
  severity: "major",
  effect_ru: "AUC атомоксетина увеличивается в 5.1× из-за " + "ингибирования CYP2D6 бупропионом.",
  clinical_action_ru: "Требует значительного снижения дозы " + "атомоксетина или замены препарата.",
  source: "PubMed 27518170 (Todor et al. 2016)"
}, {
  a: "bupropion",
  b: "vortioxetine",
  severity: "moderate",
  effect_ru: "AUC вортиоксетина увеличивается в 2.3×, Cmax в " + "2.1×. Adverse events наблюдаются в 3 раза чаще.",
  clinical_action_ru: "Производитель рекомендует снижать дозу " + "вортиоксетина вдвое при сочетании.",
  source: "Springer Clin Pharmacokinet 2017"
}, {
  a: "bupropion",
  b: "duloxetine",
  severity: "minor",
  effect_ru: "Теоретическое повышение экспозиции дулоксетина " + "через CYP2D6 + CYP1A2.",
  clinical_action_ru: "Клинически значимый эффект не " + "подтверждён. Мониторинг побочных " + "эффектов рекомендован.",
  source: "Mental Health Clin 2016"
}, {
  a: "sertraline",
  b: "vortioxetine",
  severity: "minor",
  effect_ru: "Сертралин в дозе 150 мг сам по себе — умеренный " + "ингибитор CYP2D6, что может усилить эффект " + "бупропиона на вортиоксетин.",
  clinical_action_ru: "Учитывать кумулятивный эффект двух " + "ингибиторов CYP2D6 в схеме.",
  source: "Mental Health Clin 2016"
}];
window.LifeMedStatusLabels = {
  active: {
    ru: "принимается",
    ua: "приймається",
    color: "blue"
  },
  inactive: {
    ru: "приостановлен",
    ua: "призупинений",
    color: "muted"
  },
  planned: {
    ru: "ожидается",
    ua: "очікується",
    color: "orange"
  },
  considering: {
    ru: "под вопросом",
    ua: "під питанням",
    color: "muted"
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/data/medications.js", error: String((e && e.message) || e) }); }

// ui_kits/life-os/data/profile.js
try { (() => {
/* global */
/* Profile seed data and size-conversion utility. Loaded as a plain
   global; v2.1+ may move this to /data/profile.js with serialized
   persistence. */

window.LifeProfileSeed = {
  identity: {
    name: '',
    age: 25,
    city: '',
    bio: ''
  },
  body: {
    heightCm: 178,
    weightKg: 72.4,
    history: [{
      date: '01.05',
      weight: 73.4
    }, {
      date: '08.05',
      weight: 72.9
    }, {
      date: '15.05',
      weight: 72.4
    }],
    notes: 'утром натощак.'
  },
  measurements: {
    chest: 96,
    waist: 80,
    hips: 96,
    neck: 38,
    shoulders: 45,
    sleeve: 64,
    inseam: 80,
    shoe: 27.5,
    notes: ''
  },
  sizes: {
    /* canonical EU value per type. shoes is EU shoe size,
       pants is EU waist cm, others are EU jacket-style numbers. */
    shirt: 48,
    pants: 81,
    jacket: 48,
    shoes: 42,
    suit: 48,
    tshirt: 48
  },
  food: {
    allergies: [],
    likes: [],
    dislikes: [],
    notes: ''
  }
};

/* ──────────────────────────────────────────────────────────
   Size conversion tables. EU is the source of truth; US +
   regional column auto-derived. Lookup is exact-match on the
   EU column — if the user enters a non-table EU value (e.g.
   shirt 49), we return null and the table shows "—".
   ────────────────────────────────────────────────────────── */
const SHIRT_TABLE = [{
  eu: 44,
  us: 34,
  ua: '44 (XS)'
}, {
  eu: 46,
  us: 36,
  ua: '46 (S)'
}, {
  eu: 48,
  us: 38,
  ua: '48 (M)'
}, {
  eu: 50,
  us: 40,
  ua: '50 (L)'
}, {
  eu: 52,
  us: 42,
  ua: '52 (XL)'
}, {
  eu: 54,
  us: 44,
  ua: '54 (XXL)'
}];
const PANTS_TABLE = [{
  eu: 71,
  us: 'W28'
}, {
  eu: 76,
  us: 'W30'
}, {
  eu: 81,
  us: 'W32'
}, {
  eu: 86,
  us: 'W34'
}, {
  eu: 91,
  us: 'W36'
}, {
  eu: 96,
  us: 'W38'
}];
const SHOES_TABLE = [{
  eu: 40,
  us: 7,
  uk: 6.5
}, {
  eu: 41,
  us: 8,
  uk: 7.5
}, {
  eu: 42,
  us: 9,
  uk: 8.5
}, {
  eu: 43,
  us: 10,
  uk: 9.5
}, {
  eu: 44,
  us: 11,
  uk: 10.5
}, {
  eu: 45,
  us: 12,
  uk: 11.5
}, {
  eu: 46,
  us: 13,
  uk: 12.5
}];

/* Convert an EU size to {us, alt, altLabel} for the given type.
   altLabel is 'UA' for shirt-family rows and 'UK' for shoes. */
window.lifeConvertSize = function lifeConvertSize(type, eu) {
  if (eu == null || eu === '') return {
    us: '—',
    alt: '—',
    altLabel: 'UA'
  };
  const n = Number(eu);
  if (type === 'shoes') {
    const row = SHOES_TABLE.find(r => r.eu === n);
    return row ? {
      us: row.us,
      alt: row.uk,
      altLabel: 'UK'
    } : {
      us: '—',
      alt: '—',
      altLabel: 'UK'
    };
  }
  if (type === 'pants') {
    const row = PANTS_TABLE.find(r => r.eu === n);
    return row ? {
      us: row.us,
      alt: n,
      altLabel: 'UA'
    } : {
      us: '—',
      alt: '—',
      altLabel: 'UA'
    };
  }
  /* shirt-family: shirt / jacket / suit / tshirt */
  const row = SHIRT_TABLE.find(r => r.eu === n);
  return row ? {
    us: row.us,
    alt: row.ua,
    altLabel: 'UA'
  } : {
    us: '—',
    alt: '—',
    altLabel: 'UA'
  };
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/data/profile.js", error: String((e && e.message) || e) }); }

// ui_kits/life-os/i18n.jsx
try { (() => {
/* global React */
/* Life OS i18n — RU primary, UA secondary.
   English slot reserved for a future iteration (LOCALES list left
   as ['ru','uk'] for now; do NOT add 'en' to it until strings exist). */

const LIFE_STRINGS = {
  ru: {
    /* sidebar */
    sb_routine: 'рутина',
    sb_stakes: 'важное',
    /* v2 sidebar — new tree */
    sb_collapse: 'свернуть',
    sb_expand: 'развернуть',
    nav_inbox: 'входящие',
    nav_habits: 'привычки',
    nav_calendar: 'календарь',
    nav_today: 'сегодня',
    nav_goals: 'цели',
    nav_money: 'финансы',
    /* v2 — new nav items */
    nav_home: 'главная',
    nav_notes: 'заметки',
    nav_tasks: 'задачи',
    nav_me: 'я',
    nav_health: 'здоровье',
    nav_dog: 'собака',
    nav_finances: 'финансы',
    nav_monthly: 'ежемесячные',
    nav_annual: 'годовые',
    nav_investments: 'инвестиции',
    nav_medications: 'препараты',
    /* placeholders for not-yet-built tabs */
    ph_sprint2: 'Sprint 2 наполнит эту страницу обзорными метриками и графиками.',
    ph_sprint3: 'Sprint 3 принесёт интерактивную часть.',
    ph_sprint4: 'Sprint 4 построит этот раздел.',
    ph_home_title: 'Home · stats dashboard',
    ph_home_body: 'Sprint 2 наполнит эту страницу обзорными метриками и графиками. Пока — переходи в нужную вкладку через сайдбар.',
    ph_meds_title: 'Medications · interactive tracker',
    ph_meds_body: 'Sprint 3 принесёт таймер дозы, инвентарь, лог приёма и предупреждения о взаимодействиях CYP2D6. Данные уже в кодовой базе — см. data/medications.js.',
    ph_monthly_title: 'Monthly · coming in Sprint 4',
    ph_monthly_body: 'Регулярные ежемесячные счета — Sprint 4 построит этот раздел.',
    ph_annual_title: 'Annual · coming in Sprint 4',
    ph_annual_body: 'Годовые подписки и сборы — Sprint 4 построит этот раздел.',
    ph_invest_title: 'Investments · coming in Sprint 4',
    ph_invest_body: 'Портфель: акции, крипта, прочее. Sprint 4 построит этот раздел.',
    /* quick notes */
    qn_title: 'заметки',
    qn_subtitle: 'быстрая фиксация. потом разгребёшь.',
    qn_placeholder: 'что на уме? enter — добавить',
    qn_empty: 'пусто. сюда быстро сваливать мысли — разгребать потом.',
    qn_promote: 'в задачу',
    qn_promote_full: 'превратить в задачу',
    qn_delete: 'удалить',
    qn_count: '{0} заметок',
    qn_count_one: '{0} заметка',
    /* tasks page */
    tasks_page_title: 'задачи',
    tasks_page_meta: '{0}/{1}',
    tasks_filter_all: 'все',
    tasks_filter_today: 'сегодня',
    tasks_filter_overdue: 'просрочено',
    tasks_filter_routine: 'рутина',
    tasks_filter_stakes: 'важное',
    tasks_filter_done: 'сделано',
    tasks_sort_label: 'сортировать',
    tasks_sort_date: 'по дате',
    tasks_sort_priority: 'по приоритету',
    tasks_sort_category: 'по категории',
    tasks_empty: 'задач пока нет. ⌘ K чтобы добавить первую.',
    /* profile / me */
    profile_title: 'я',
    profile_subtitle: 'личные данные. редактируется на месте.',
    profile_add_section: '+ добавить секцию',
    profile_add_disabled: 'будет доступно в v2.1+',
    /* identity card */
    pc_identity: 'личное',
    pc_id_name: 'имя',
    pc_id_age: 'возраст',
    pc_id_city: 'город',
    pc_id_bio: 'о себе',
    pc_id_bio_ph: 'одной-двумя строками…',
    pc_id_name_ph: 'Имя Фамилия',
    pc_id_age_ph: '25',
    pc_id_city_ph: 'Город',
    /* body metrics */
    pc_body: 'тело',
    pc_body_height: 'рост',
    pc_body_weight: 'вес',
    pc_body_notes: 'заметки',
    pc_body_notes_ph: 'утром натощак · последнее взвешивание…',
    pc_body_unit_cm: 'см',
    pc_body_unit_kg: 'кг',
    pc_body_history: 'последние замеры',
    /* measurements */
    pc_meas: 'мерки',
    pc_meas_sub: 'все в сантиметрах',
    pc_meas_chest: 'грудь',
    pc_meas_waist: 'талия',
    pc_meas_hips: 'бёдра',
    pc_meas_neck: 'шея',
    pc_meas_shoulders: 'плечи',
    pc_meas_sleeve: 'длина рукава',
    pc_meas_inseam: 'шаг (inseam)',
    pc_meas_shoe: 'стопа',
    pc_meas_notes_ph: 'что важно запомнить про мерки…',
    /* clothing sizes */
    pc_sizes: 'размеры',
    pc_sizes_sub: 'EU → US → UA/UK. правишь EU — таблица обновится.',
    pc_sizes_type: 'тип',
    pc_sizes_shirt: 'рубашка',
    pc_sizes_pants: 'брюки',
    pc_sizes_jacket: 'пиджак',
    pc_sizes_shoes: 'обувь',
    pc_sizes_suit: 'костюм',
    pc_sizes_tshirt: 'футболка',
    /* food preferences */
    pc_food: 'еда',
    pc_food_allergies: 'аллергии · ограничения',
    pc_food_allergies_ph: '+ добавить ограничение',
    pc_food_likes: 'нравится',
    pc_food_dislikes: 'не нравится',
    pc_food_tag_ph: '+ добавить',
    pc_food_notes: 'заметка',
    pc_food_notes_ph: 'произвольный контекст про еду…',
    /* dog tab */
    dog_title: 'собака',
    dog_subtitle: 'график, инвентарь, ветеринар. живые таймеры — в Sprint 3.',
    dog_name_placeholder: '[выбери имя]',
    dog_unset: '—',
    /* dog · live reminders */
    dog_rem_feed: 'следующее кормление через {0}',
    dog_rem_walk: 'следующая прогулка через {0}',
    dog_rem_vet: 'визит к ветеринару через {0} {1}',
    /* dog · profile card */
    dog_pf: 'паспорт',
    dog_pf_name: 'имя',
    dog_pf_breed: 'порода',
    dog_pf_birth: 'дата рождения',
    dog_pf_weight: 'вес',
    dog_pf_photo: 'фото',
    dog_pf_photo_hint: 'будет в v2.1+',
    /* dog · feeding */
    dog_feed: 'кормление',
    dog_feed_sub: '3 приёма в день',
    dog_feed_meal: 'приём {0}',
    dog_feed_portion_ph: '— г',
    dog_feed_feed_now: 'покормить',
    dog_feed_history: 'история кормлений →',
    /* dog · inventory */
    dog_inv: 'инвентарь',
    dog_inv_food: 'сухой корм',
    dog_inv_treats: 'лакомства',
    dog_inv_hygiene: 'гигиена',
    dog_inv_food_empty: 'вес мешка не указан · добавить',
    dog_inv_empty: 'не указано',
    dog_inv_buy_new: 'купить новый',
    /* dog · vet */
    dog_vet: 'ветеринар',
    dog_vet_last: 'последний визит',
    dog_vet_next: 'следующий визит',
    dog_vet_seed_last_dt: '06.10.2025',
    dog_vet_seed_last_what: 'профилактический осмотр, чип, первая вакцинация.',
    dog_vet_seed_next_dt: '12.12.2025',
    dog_vet_seed_next_what: 'ревакцинация DHPPi+L.',
    /* dog · tasks */
    dog_tasks: 'задачи по собаке',
    dog_tasks_empty: 'задачи по собаке появятся здесь.',
    /* dog · expenses */
    dog_exp: 'расходы за месяц',
    dog_exp_zero: '$0',
    dog_exp_empty: 'расходы на собаку появятся когда добавишь первые транзакции с тегом «собака».',
    /* health tab */
    health_title: 'здоровье',
    health_subtitle: 'анализы, врачи, медпокупки, цели по здоровью. наполнение — Sprint 3.',
    health_labs: 'ближайшие анализы',
    health_labs_empty: 'ничего не запланировано.',
    health_visit: 'следующий визит к врачу',
    health_visit_empty: 'нет записей.',
    health_purchases: 'медицинские покупки',
    health_purchases_empty: 'покупки появятся после связи с финансами в Sprint 3.',
    health_goals: 'цели по здоровью',
    health_goals_empty: 'целей пока нет — добавьте первую.',
    /* meds */
    meds_title: 'препараты',
    meds_subtitle: 'статичный список. интерактив — в Sprint 3.',
    meds_dose_per_day: '{0} мг/день',
    meds_doses_per_day: '{0} приём × {1}',
    meds_supplement: 'БАД',
    meds_no_dose: 'не принимается',
    meds_half_life: 't½ {0} ч',
    meds_2d6_inhibitor: 'CYP2D6 · ингибитор',
    meds_2d6_substrate: 'CYP2D6 · субстрат',
    meds_2d6_role_strong: 'сильный',
    meds_2d6_role_moderate: 'умеренный',
    meds_2d6_role_weak: 'слабый',
    meds_2d6_role_major: 'мажорный',
    meds_interactions: 'клинически значимые взаимодействия',
    meds_severity_major: 'мажор',
    meds_severity_moderate: 'умеренное',
    meds_severity_minor: 'минор',
    meds_status_active: 'принимается',
    meds_status_inactive: 'приостановлен',
    meds_status_planned: 'ожидается',
    meds_status_considering: 'под вопросом',
    /* ————— Sprint 3A · Medications interactive ————— */
    /* view-mode tabs */
    meds_view_list: 'список',
    meds_view_journal: 'журнал',
    meds_view_history: 'история',
    /* status filter chips */
    meds_filter_active: 'активные',
    meds_filter_inactive: 'приостановленные',
    meds_filter_planned: 'планируемые',
    meds_filter_all: 'все',
    /* timers */
    meds_timer_next: 'след. доза: через {0} ({1})',
    meds_timer_now: 'можно принимать сейчас',
    meds_timer_halflife: 't½: ~{0}ч (закончится в {1} без дозы)',
    meds_timer_full: 'полный вывод: ~{0} {1} (метаб.)',
    meds_timer_full_ddcar: 'полный вывод: ~{0} {1} (DDCAR)',
    meds_no_doses_yet: 'доз ещё не принимал. первый приём включит таймеры.',
    meds_usual_time: 'обычно принимаешь в {0}',
    meds_prn_label: 'по требованию',
    /* card action buttons */
    meds_btn_take: 'принял',
    meds_btn_later: 'позже',
    meds_btn_skip: 'пропустил',
    meds_btn_config: 'настроить',
    /* inventory */
    meds_inv_label: 'inventory: {0} таб. · ~{1} {2} запаса',
    meds_inv_label_caps: 'inventory: {0} капс. · ~{1} {2} запаса',
    meds_inv_label_undef: 'inventory: {0} · задать расход',
    meds_inv_refill: 'пополнить',
    meds_inv_soon: 'купить скоро',
    meds_inv_urgent: 'купить срочно',
    meds_inv_running_out: 'заканчивается',
    meds_inv_empty: 'закончился',
    /* refill modal */
    meds_refill_title: 'пополнить запас',
    meds_refill_add: 'добавить таблеток',
    meds_refill_total: 'будет всего',
    /* take-dose modal */
    meds_take_title: 'принять {0}',
    meds_take_when: 'когда',
    meds_take_dose: 'доза, мг',
    meds_take_note: 'заметка',
    meds_take_note_ph: 'вместе с едой, тихо в голове…',
    meds_take_save: 'записать дозу',
    meds_late_by: 'позже обычного на {0}',
    meds_early_by: 'раньше обычного на {0}',
    meds_prn_anti_stack: 'предыдущая доза {0} назад. обычный интервал — {1}ч. продолжить?',
    /* duration formatting (singular forms not pluralized here — use t.pl) */
    meds_unit_h: 'ч',
    meds_unit_m: 'м',
    meds_unit_d: 'дн.',
    pl_meds_day: ['день', 'дня', 'дней'],
    /* config drawer */
    mcd_title: 'настройка {0}',
    mcd_sec_basic: 'основное',
    mcd_sec_interval: 'интервал',
    mcd_sec_strategy: 'стратегия приёма',
    mcd_sec_inventory: 'запасы',
    mcd_sec_delete: 'удалить препарат',
    mcd_status: 'активность',
    mcd_dose_current: 'текущая доза',
    mcd_dose_unit_mg: 'мг',
    mcd_dose_unit_caps: 'капсул',
    mcd_dose_unit_ml: 'мл',
    mcd_doses_per_day: 'приёмов в день',
    mcd_schedule: 'расписание',
    mcd_schedule_add: '+ слот',
    mcd_schedule_mismatch: 'расписание ({0}) не совпадает с количеством приёмов ({1})',
    mcd_interval_dose: 'интервал между дозами, ч',
    mcd_interval_halflife: 'полувыведение t½, ч',
    mcd_interval_metab: 't½ активного метаболита, ч',
    mcd_metab_hint: 'опционально — нужно для некоторых препаратов (карипразин, т.д.)',
    mcd_mode_steady: 'долгосрочно ровная',
    mcd_mode_up: 'титрование вверх',
    mcd_mode_down: 'титрование вниз / отмена',
    mcd_mode_prn: 'по требованию (PRN)',
    mcd_mode_steady_hint: 'без дополнительных параметров.',
    mcd_mode_prn_hint: 'без расписания. анти-стекинг в modal-е приёма.',
    mcd_target_dose: 'цель, мг',
    mcd_step_type: 'тип шага',
    mcd_step_size: 'размер шага, мг',
    mcd_step_interval: 'интервал шага, дней',
    mcd_step_linear: 'линейный',
    mcd_step_stepwise: 'ступенчатый',
    mcd_step_custom: 'произвольный',
    mcd_titration_plan: 'план:',
    mcd_titration_to: 'дней на стадии',
    mcd_titration_stage: 'день {0} из {1} на стадии {2}мг',
    mcd_titration_target: 'цель',
    mcd_inv_count: 'количество в наличии',
    mcd_inv_threshold: 'порог «купить скоро», дней',
    mcd_delete_msg: 'препарат перейдёт в архив. история доз сохранится.',
    mcd_delete_btn: 'удалить',
    mcd_delete_confirm: 'уверен?',
    mcd_save: 'сохранить',
    mcd_close: 'закрыть',
    /* multi-change warning modal */
    mcw_title: 'риск множественных изменений',
    mcw_intro: 'за последние 7 дней ты менял:',
    mcw_changing: 'сейчас меняешь {0}.',
    mcw_body: 'при параллельных изменениях сложно отделить эффекты каждого препарата. стандартная рекомендация — выдерживать паузу 2-4 недели между изменениями.',
    mcw_proceed: 'понял, продолжить',
    mcw_postpone: 'отложить изменение',
    /* med detail page */
    mdp_back: 'к списку',
    mdp_tab_overview: 'обзор',
    mdp_tab_journal: 'журнал',
    mdp_tab_doses: 'история доз',
    mdp_tab_config: 'конфигурация',
    mdp_doses_empty: 'доз пока не принимал. история появится после первого приёма.',
    mdp_config_open_drawer: 'открыть панель настроек',
    /* pharm notes */
    pn_capture_ph: 'что заметил?',
    pn_save: 'сохранить',
    pn_empty: 'наблюдений пока нет. сюда — короткие заметки об эффектах препарата.',
    pn_summary: 'за 30 дней: {0} плюсов · {1} минуса',
    pn_edit: 'изменить',
    pn_delete: 'удалить',
    pn_save_short: 'сохр.',
    pn_cancel: 'отмена',
    /* global journal */
    gj_filter_polarity: 'полярность',
    gj_filter_all: 'все',
    gj_filter_plus: 'только +',
    gj_filter_minus: 'только −',
    gj_search_ph: 'поиск по тексту…',
    gj_empty: 'записей по фильтру нет.',
    /* dose history */
    dh_dose: 'доза',
    dh_mode_scheduled: 'по расписанию',
    dh_mode_prn: 'PRN',
    dh_mode_skip: 'пропущено',
    /* home dashboard */
    home_card_budget: 'бюджет месяца',
    home_card_budget_ctx: '${0} из ${1}',
    home_card_budget_empty: 'бюджет не задан · задать',
    home_card_streak: 'самая длинная серия',
    home_card_streak_ctx: '{0} · {1} {2}',
    home_card_streak_empty: 'ни одной активной серии',
    home_card_goal: 'ближайшая цель',
    home_card_goal_empty: 'целей нет · добавить',
    home_card_tasks: 'задачи · эта неделя',
    home_card_tasks_ctx: 'выполнено',
    home_card_tasks_empty: 'на эту неделю задач нет',
    /* charts */
    chart_trend_title: 'тенденция · 6 месяцев',
    chart_categories_title: 'категории · текущий месяц',
    chart_toggle_expenses: 'расходы',
    chart_toggle_income: 'доходы',
    chart_toggle_net: 'нетто',
    chart_filter_month: 'месяц',
    chart_filter_30: '30 дней',
    chart_others: '+ {0} других',
    chart_empty_trend: 'недостаточно данных для тренда · нужно ≥2 месяца',
    chart_empty_trend_cta: 'добавить первую транзакцию',
    chart_empty_cat: 'транзакций в этом месяце ещё нет.',
    /* upcoming */
    /* bot */
    /* topbar */
    tb_greet_morning: 'доброе утро.',
    tb_greet_afternoon: 'добрый день.',
    tb_greet_evening: 'добрый вечер.',
    tb_greet_night: 'поздний вечер.',
    tb_search: 'поиск или переход…',
    tb_kbd_cmdk: '⌘ K',
    /* today hero */
    today_eyebrow: 'сегодня · {0} {1} в работе',
    today_date_uppercase: true,
    today_meta_stakes: 'сначала важные. остальное подождёт.',
    /* tasks */
    tasks_title: 'входящие',
    tasks_open_total: '{0} открыто · {1} всего',
    tasks_add: 'добавить задачу…',
    tasks_add_stakes: 'что на кону?',
    tasks_toggle_routine: 'рутина',
    tasks_toggle_stakes: 'важное',
    /* task tags */
    tag_today: 'сегодня',
    tag_stakes: 'важное',
    tag_work: 'работа',
    tag_money: 'финансы',
    tag_habit: 'привычка',
    tag_life: 'жизнь',
    tag_inbox: 'входящие',
    /* seed task titles */
    seed_task_ship: 'выпустить лендинг',
    seed_task_commit: 'зафиксировать цели Q4',
    seed_task_review: 'просмотреть pull-реквесты',
    seed_task_log: 'записать октябрьские расходы',
    seed_task_read: 'прочитать 30 страниц',
    seed_task_mum: 'позвонить маме',
    /* due hints */
    due_eod: 'до конца дня',
    due_tue: 'вт',
    /* money */
    money_title: 'финансы',
    money_period_currency: '{0} · USD',
    money_amt_placeholder: '0.00',
    money_log: 'записать',
    money_budget_pre: '{0} · {1}',
    money_warn_badge: '80%+ · важное',
    money_over_badge: 'перерасход',
    money_warn_hint: 'почти перерасход · {0} {1} до конца октября',
    money_over_hint: 'перерасход на ${0} · так нельзя',
    /* goals */
    goals_title: 'цели',
    goals_meta: '{0} открыто · важное',
    goal_emergency: 'подушка безопасности',
    goal_ship_v1: 'выпустить Life·OS v1',
    goal_half_marathon: 'полумарафон',
    goal_tag_q3: 'Q3',
    goal_tag_q4: 'Q4',
    goal_tag_jan: 'янв',
    /* habits */
    habits_title: 'привычки',
    habits_meta: '{0}/{1} на этой неделе',
    habits_meta_period: 'на этой неделе',
    habits_empty: 'привычек ещё нет — начни с малого.',
    habits_add: '+ добавить привычку',
    habits_streak: 'серия {0} {1} · лучшая {2}',
    habit_read: '30 страниц в день',
    habit_no_phone: 'без телефона в кровати',
    habit_walk: '8 тысяч шагов',
    habit_write: 'писать каждый день',
    /* streak milestone */
    milestone_eyebrow: 'веха · серия {0} {1}',
    milestone_line: '{0} {1}. не сорви серию.',
    milestone_sub: '{0}',
    milestone_dismiss: 'скрыть',
    /* quick-add modal */
    qa_eyebrow: 'быстрое добавление',
    qa_title: 'что нужно сделать?',
    qa_title_stakes: 'что на кону?',
    qa_routine: 'рутина',
    qa_stakes: 'важное',
    qa_category: 'категория',
    qa_no_category: 'без категории',
    qa_schedule_collapsed: 'запланировать…',
    qa_schedule_expanded: 'расписание',
    qa_date: 'дата',
    qa_time: 'время',
    qa_notes_collapsed: 'заметки…',
    qa_notes_expanded: 'заметки',
    qa_notes_placeholder: 'что-нибудь важное про эту задачу…',
    qa_save: 'сохранить',
    qa_cancel: 'отмена',
    qa_save_hint: '⌘ ↵ сохранить',
    qa_cancel_hint: 'ESC отмена',
    /* toasts */
    toast_added: 'добавлено · {0}',
    toast_committed: 'зафиксировано · {0}',
    toast_expense: 'расход записан · ${0} → {1}',
    toast_bot_run: 'ты обещал пробежку. сейчас {0}.',
    toast_name_sys: 'система',
    toast_name_bot: 'telegram-бот',
    /* empty states */
    empty_tasks: 'сегодня задач нет. добавь одну или выдохни.',
    empty_money: 'в этом месяце расходов нет. либо здорово, либо моно не синхронизируется.',
    empty_goals: 'целей пока нет. поставь одну — в этом весь смысл.',
    empty_calendar: 'событий не запланировано. тихий день.',
    /* ————— Sprint 3B · flexible finance ————— */
    fin_subtitle: '{0} транзакций · {1} в тоталах',
    fin_period: '{0} · USD',
    fin_budget_label: 'бюджет {0}',
    fin_budget_val: '${0} из ${1}',
    fin_total_in: 'в тоталах',
    fin_total_hidden: 'скрыто из тоталов',
    fin_section_recent: 'последние транзакции',
    fin_log: 'записать',
    fin_amt_ph: '0.00',
    fin_logged_just_now: 'только что',
    fin_empty_tx: 'транзакций пока нет. ⌘ K чтобы записать первую.',
    fin_filter_all: 'все',
    fin_filter_visible: 'в тоталах',
    fin_filter_hidden: 'скрытые',
    eye_include_tip: 'включить в тоталы',
    eye_exclude_tip: 'исключить из тоталов',
    eye_cat_include: 'учитывать категорию',
    eye_cat_exclude: 'не учитывать категорию',
    fin_cat_off_chip: 'категория скрыта',
    set_cat_in_totals: 'в тоталах',
    home_cat_all_hidden: 'все категории скрыты из тоталов. вернуть в настройках → категории.',
    home_card_budget_derived: 'учтено ${0} · скрыто ${1}',
    activity_tx_excluded: 'транзакция «{0}» исключена из тоталов',
    activity_tx_included: 'транзакция «{0}» включена в тоталы',
    activity_cat_excluded: 'категория «{0}» исключена из тоталов',
    activity_cat_included: 'категория «{0}» включена в тоталы',
    /* misc */
    footer_local: 'локально',
    placeholder_404: 'не реализовано',
    /* task detail modal */
    td_eyebrow: 'задача',
    td_subtasks: 'подзадачи',
    td_subtask_add: 'добавить подзадачу…',
    td_activity: 'история',
    td_log_created: 'создана',
    td_log_edited: 'отредактирована',
    td_complete: 'выполнить',
    td_uncomplete: 'вернуть в работу',
    td_save: 'сохранить',
    td_delete: 'удалить',
    td_delete_confirm: 'удалить навсегда?',
    td_delete_yes: 'да, удалить',
    /* activity timeline */
    atl_empty: 'история пуста',
    /* settings */
    set_title: 'настройки',
    set_account: 'аккаунт',
    set_categories: 'категории',
    set_cat_name: 'категория',
    set_telegram: 'telegram-бот',
    set_monobank: 'monobank',
    set_notifications: 'уведомления',
    set_appearance: 'оформление',
    set_export: 'экспорт данных',
    set_danger: 'опасная зона',
    set_account_name: 'имя',
    set_account_email: 'почта',
    set_lang: 'язык',
    set_theme: 'тема',
    set_theme_dark: 'тёмная',
    set_theme_light: 'светлая',
    set_theme_system: 'системная',
    set_theme_paradise: 'остров',
    set_accent_intensity: 'интенсивность акцента',
    set_density: 'плотность',
    set_density_cozy: 'уютная',
    set_density_compact: 'плотная',
    set_tg_token: 'токен бота',
    set_tg_chat: 'chat id',
    set_tg_test: 'отправить тест',
    set_mono_token: 'API-токен',
    set_mono_last: 'последняя синхронизация',
    set_mono_sync: 'синхронизировать сейчас',
    set_mono_pending: '{0} транзакций с последней синхронизации',
    set_quiet_hours: 'тихие часы',
    set_export_json: 'JSON',
    set_export_csv: 'CSV',
    set_export_md: 'Markdown',
    set_danger_msg: 'удалит все задачи, цели, привычки, расходы. это необратимо.',
    set_danger_btn: 'удалить все данные',
    set_export_state: 'выгрузить state в JSON',
    set_export_state_hint: 'полный снимок localStorage',
    set_clear_history: 'очистить историю старше',
    set_clear_history_hint: 'удалит activityLog старше порога',
    set_clear_3mo: '3 месяца',
    set_clear_6mo: '6 месяцев',
    set_clear_12mo: '12 месяцев',
    set_clear_do: 'очистить',
    set_clear_done: 'удалено: {0}',
    set_cat_add: '+ добавить категорию',
    set_cat_budget: 'месячный бюджет',
    set_notif_goal: 'веха цели',
    set_notif_budget: 'бюджет 80%+',
    set_notif_streak: 'веха серии',
    set_notif_bot: 'напоминания бота',
    /* calendar */
    cal_title: 'календарь',
    cal_today: 'сегодня',
    cal_week: 'неделя',
    cal_day: 'день',
    cal_month: 'месяц',
    cal_prev: '‹',
    cal_next: '›',
    cal_more_n: '+ {0} ещё',
    cal_add_event: 'добавить событие',
    cal_quiet_day: 'тихий день',
    /* Sprint 3B · seeded calendar events */
    cal_seed_standup: 'дейли',
    cal_seed_walk: 'прогулка',
    cal_seed_gym: 'спортзал',
    cal_seed_call_mum: 'позвонить маме',
    cal_seed_review_pr: 'просмотр PR',
    cal_seed_therapy: 'терапия',
    cal_seed_dinner_a: 'ужин с Аней',
    cal_seed_run: 'пробежка',
    cal_seed_design_rev: 'ревью макетов',
    cal_seed_lunch_x: 'обед с Х',
    cal_seed_ship_v1: 'релиз v1',
    cal_seed_one_on_one: '1:1 с тимлидом',
    cal_seed_bill_rent: 'аренда — списание',
    cal_seed_groceries: 'продукты',
    cal_seed_vet_call: 'звонок ветеринару',
    cal_seed_read: 'чтение 30 страниц',
    cal_seed_focus: 'focus block',
    cal_seed_q4_commit: 'цели Q4',
    cal_seed_dentist: 'стоматолог',
    cal_seed_lunch_team: 'обед с командой',
    cal_seed_demo: 'демо клиенту',
    cal_seed_movie: 'кино',
    cal_seed_dog_feed: 'кормление пса',
    /* mobile nav */
    nav_more: 'ещё',
    /* plural forms · [one, few, many] · slavic 3-form */
    pl_task: ['задача', 'задачи', 'задач'],
    pl_day: ['день', 'дня', 'дней'],
    pl_left: ['остался', 'осталось', 'осталось'],
    pl_goal: ['цель', 'цели', 'целей'],
    pl_habit: ['привычка', 'привычки', 'привычек'],
    pl_event: ['событие', 'события', 'событий'],
    pl_tx: ['транзакция', 'транзакции', 'транзакций'],
    /* date formatting locale (passed to Intl) */
    _intl_locale: 'ru-RU'
  },
  uk: {
    sb_routine: 'рутина',
    sb_stakes: 'важливе',
    sb_collapse: 'згорнути',
    sb_expand: 'розгорнути',
    nav_inbox: 'вхідні',
    nav_habits: 'звички',
    nav_calendar: 'календар',
    nav_today: 'сьогодні',
    nav_goals: 'цілі',
    nav_money: 'фінанси',
    nav_home: 'головна',
    nav_notes: 'нотатки',
    nav_tasks: 'задачі',
    nav_me: 'я',
    nav_health: 'здоровʼя',
    nav_dog: 'собака',
    nav_finances: 'фінанси',
    nav_monthly: 'щомісячні',
    nav_annual: 'річні',
    nav_investments: 'інвестиції',
    nav_medications: 'препарати',
    ph_sprint2: 'Sprint 2 наповнить цю сторінку оглядовими метриками та графіками.',
    ph_sprint3: 'Sprint 3 принесе інтерактивну частину.',
    ph_sprint4: 'Sprint 4 побудує цей розділ.',
    ph_home_title: 'Home · stats dashboard',
    ph_home_body: 'Sprint 2 наповнить цю сторінку оглядовими метриками та графіками. Поки — переходь у потрібну вкладку через сайдбар.',
    ph_meds_title: 'Medications · interactive tracker',
    ph_meds_body: 'Sprint 3 принесе таймер дози, інвентар, лог прийому та попередження про взаємодії CYP2D6. Дані вже в кодовій базі — див. data/medications.js.',
    ph_monthly_title: 'Monthly · coming in Sprint 4',
    ph_monthly_body: 'Регулярні щомісячні рахунки — Sprint 4 побудує цей розділ.',
    ph_annual_title: 'Annual · coming in Sprint 4',
    ph_annual_body: 'Річні підписки та збори — Sprint 4 побудує цей розділ.',
    ph_invest_title: 'Investments · coming in Sprint 4',
    ph_invest_body: 'Портфель: акції, крипта, інше. Sprint 4 побудує цей розділ.',
    qn_title: 'нотатки',
    qn_subtitle: 'швидка фіксація. потім розгребеш.',
    qn_placeholder: 'що на думці? enter — додати',
    qn_empty: 'порожньо. сюди швидко скидати думки — розгрібати потім.',
    qn_promote: 'у задачу',
    qn_promote_full: 'перетворити на задачу',
    qn_delete: 'видалити',
    qn_count: '{0} нотаток',
    qn_count_one: '{0} нотатка',
    tasks_page_title: 'задачі',
    tasks_page_meta: '{0}/{1}',
    tasks_filter_all: 'усі',
    tasks_filter_today: 'сьогодні',
    tasks_filter_overdue: 'прострочено',
    tasks_filter_routine: 'рутина',
    tasks_filter_stakes: 'важливе',
    tasks_filter_done: 'зроблено',
    tasks_sort_label: 'сортувати',
    tasks_sort_date: 'за датою',
    tasks_sort_priority: 'за пріоритетом',
    tasks_sort_category: 'за категорією',
    tasks_empty: 'задач поки немає. ⌘ K щоб додати першу.',
    profile_title: 'я',
    profile_subtitle: 'особисті дані. редагується на місці.',
    profile_add_section: '+ додати секцію',
    profile_add_disabled: 'буде доступно у v2.1+',
    pc_identity: 'особисте',
    pc_id_name: "імʼя",
    pc_id_age: 'вік',
    pc_id_city: 'місто',
    pc_id_bio: 'про себе',
    pc_id_bio_ph: 'одним-двома рядками…',
    pc_id_name_ph: "Імʼя Прізвище",
    pc_id_age_ph: '25',
    pc_id_city_ph: 'Місто',
    pc_body: 'тіло',
    pc_body_height: 'зріст',
    pc_body_weight: 'вага',
    pc_body_notes: 'нотатки',
    pc_body_notes_ph: 'ранок натще · останнє зважування…',
    pc_body_unit_cm: 'см',
    pc_body_unit_kg: 'кг',
    pc_body_history: 'останні заміри',
    pc_meas: 'мірки',
    pc_meas_sub: 'усе в сантиметрах',
    pc_meas_chest: 'груди',
    pc_meas_waist: 'талія',
    pc_meas_hips: 'стегна',
    pc_meas_neck: 'шия',
    pc_meas_shoulders: 'плечі',
    pc_meas_sleeve: 'довжина рукава',
    pc_meas_inseam: 'крок (inseam)',
    pc_meas_shoe: 'стопа',
    pc_meas_notes_ph: 'що важливо запамʼятати про мірки…',
    pc_sizes: 'розміри',
    pc_sizes_sub: 'EU → US → UA/UK. правиш EU — таблиця оновиться.',
    pc_sizes_type: 'тип',
    pc_sizes_shirt: 'сорочка',
    pc_sizes_pants: 'штани',
    pc_sizes_jacket: 'піджак',
    pc_sizes_shoes: 'взуття',
    pc_sizes_suit: 'костюм',
    pc_sizes_tshirt: 'футболка',
    pc_food: 'їжа',
    pc_food_allergies: 'алергії · обмеження',
    pc_food_allergies_ph: '+ додати обмеження',
    pc_food_likes: 'подобається',
    pc_food_dislikes: 'не подобається',
    pc_food_tag_ph: '+ додати',
    pc_food_notes: 'нотатка',
    pc_food_notes_ph: 'довільний контекст про їжу…',
    dog_title: 'собака',
    dog_subtitle: 'графік, інвентар, ветеринар. живі таймери — у Sprint 3.',
    dog_name_placeholder: '[обери імʼя]',
    dog_unset: '—',
    dog_rem_feed: 'наступне годування через {0}',
    dog_rem_walk: 'наступна прогулянка через {0}',
    dog_rem_vet: 'візит до ветеринара через {0} {1}',
    dog_pf: 'паспорт',
    dog_pf_name: "імʼя",
    dog_pf_breed: 'порода',
    dog_pf_birth: 'дата народження',
    dog_pf_weight: 'вага',
    dog_pf_photo: 'фото',
    dog_pf_photo_hint: 'буде у v2.1+',
    dog_feed: 'годування',
    dog_feed_sub: '3 прийоми на день',
    dog_feed_meal: 'прийом {0}',
    dog_feed_portion_ph: '— г',
    dog_feed_feed_now: 'нагодувати',
    dog_feed_history: 'історія годувань →',
    dog_inv: 'інвентар',
    dog_inv_food: 'сухий корм',
    dog_inv_treats: 'ласощі',
    dog_inv_hygiene: 'гігієна',
    dog_inv_food_empty: 'вагу мішка не зазначено · додати',
    dog_inv_empty: 'не вказано',
    dog_inv_buy_new: 'купити новий',
    dog_vet: 'ветеринар',
    dog_vet_last: 'останній візит',
    dog_vet_next: 'наступний візит',
    dog_vet_seed_last_dt: '06.10.2025',
    dog_vet_seed_last_what: 'профілактичний огляд, чип, перша вакцинація.',
    dog_vet_seed_next_dt: '12.12.2025',
    dog_vet_seed_next_what: 'ревакцинація DHPPi+L.',
    dog_tasks: 'задачі по собаці',
    dog_tasks_empty: 'задачі по собаці зʼявляться тут.',
    dog_exp: 'витрати за місяць',
    dog_exp_zero: '$0',
    dog_exp_empty: 'витрати на собаку зʼявляться, коли додаси перші транзакції з тегом «собака».',
    health_title: 'здоровʼя',
    health_subtitle: 'аналізи, лікарі, медпокупки, цілі зі здоровʼя. наповнення — Sprint 3.',
    health_labs: 'найближчі аналізи',
    health_labs_empty: 'нічого не заплановано.',
    health_visit: 'наступний візит до лікаря',
    health_visit_empty: 'немає записів.',
    health_purchases: 'медичні покупки',
    health_purchases_empty: 'покупки зʼявляться після звʼязки з фінансами у Sprint 3.',
    health_goals: 'цілі зі здоровʼя',
    health_goals_empty: 'цілей поки немає — додайте першу.',
    meds_title: 'препарати',
    meds_subtitle: 'статичний список. інтерактив — у Sprint 3.',
    meds_dose_per_day: '{0} мг/день',
    meds_doses_per_day: '{0} прийом × {1}',
    meds_supplement: 'БАД',
    meds_no_dose: 'не приймається',
    meds_half_life: 't½ {0} год',
    meds_2d6_inhibitor: 'CYP2D6 · інгібітор',
    meds_2d6_substrate: 'CYP2D6 · субстрат',
    meds_2d6_role_strong: 'сильний',
    meds_2d6_role_moderate: 'помірний',
    meds_2d6_role_weak: 'слабкий',
    meds_2d6_role_major: 'мажорний',
    meds_interactions: 'клінічно значущі взаємодії',
    meds_severity_major: 'мажор',
    meds_severity_moderate: 'помірне',
    meds_severity_minor: 'мінор',
    meds_status_active: 'приймається',
    meds_status_inactive: 'призупинений',
    meds_status_planned: 'очікується',
    meds_status_considering: 'під питанням',
    meds_view_list: 'список',
    meds_view_journal: 'журнал',
    meds_view_history: 'історія',
    meds_filter_active: 'активні',
    meds_filter_inactive: 'призупинені',
    meds_filter_planned: 'плановані',
    meds_filter_all: 'усі',
    meds_timer_next: 'наст. доза: через {0} ({1})',
    meds_timer_now: 'можна приймати зараз',
    meds_timer_halflife: 't½: ~{0}г (вийде о {1} без дози)',
    meds_timer_full: 'повний вивід: ~{0} {1} (метаб.)',
    meds_timer_full_ddcar: 'повний вивід: ~{0} {1} (DDCAR)',
    meds_no_doses_yet: 'доз ще не приймав. перший прийом ввімкне таймери.',
    meds_usual_time: 'зазвичай приймаєш о {0}',
    meds_prn_label: 'за потребою',
    meds_btn_take: 'прийняв',
    meds_btn_later: 'пізніше',
    meds_btn_skip: 'пропустив',
    meds_btn_config: 'налаштувати',
    meds_inv_label: 'inventory: {0} таб. · ~{1} {2} запасу',
    meds_inv_label_caps: 'inventory: {0} капс. · ~{1} {2} запасу',
    meds_inv_label_undef: 'inventory: {0} · задати витрату',
    meds_inv_refill: 'поповнити',
    meds_inv_soon: 'купити скоро',
    meds_inv_urgent: 'купити терміново',
    meds_inv_running_out: 'закінчується',
    meds_inv_empty: 'закінчився',
    meds_refill_title: 'поповнити запас',
    meds_refill_add: 'додати таблеток',
    meds_refill_total: 'буде всього',
    meds_take_title: 'прийняти {0}',
    meds_take_when: 'коли',
    meds_take_dose: 'доза, мг',
    meds_take_note: 'нотатка',
    meds_take_note_ph: 'разом з їжею, тихо в голові…',
    meds_take_save: 'записати дозу',
    meds_late_by: 'пізніше за звичне на {0}',
    meds_early_by: 'раніше за звичне на {0}',
    meds_prn_anti_stack: 'попередня доза {0} тому. звичний інтервал — {1}г. продовжити?',
    meds_unit_h: 'г',
    meds_unit_m: 'хв',
    meds_unit_d: 'дн.',
    pl_meds_day: ['день', 'дні', 'днів'],
    mcd_title: 'налаштування {0}',
    mcd_sec_basic: 'основне',
    mcd_sec_interval: 'інтервал',
    mcd_sec_strategy: 'стратегія прийому',
    mcd_sec_inventory: 'запаси',
    mcd_sec_delete: 'видалити препарат',
    mcd_status: 'активність',
    mcd_dose_current: 'поточна доза',
    mcd_dose_unit_mg: 'мг',
    mcd_dose_unit_caps: 'капсул',
    mcd_dose_unit_ml: 'мл',
    mcd_doses_per_day: 'прийомів на день',
    mcd_schedule: 'розклад',
    mcd_schedule_add: '+ слот',
    mcd_schedule_mismatch: 'розклад ({0}) не збігається з кількістю прийомів ({1})',
    mcd_interval_dose: 'інтервал між дозами, г',
    mcd_interval_halflife: 'період напіввиведення t½, г',
    mcd_interval_metab: 't½ активного метаболіту, г',
    mcd_metab_hint: 'опціонально — потрібно для деяких препаратів (каріпразин, тощо)',
    mcd_mode_steady: 'довгостроково рівна',
    mcd_mode_up: 'титрування вгору',
    mcd_mode_down: 'титрування вниз / відміна',
    mcd_mode_prn: 'за потребою (PRN)',
    mcd_mode_steady_hint: 'без додаткових параметрів.',
    mcd_mode_prn_hint: 'без розкладу. анти-стекінг в modal-і прийому.',
    mcd_target_dose: 'ціль, мг',
    mcd_step_type: 'тип кроку',
    mcd_step_size: 'розмір кроку, мг',
    mcd_step_interval: 'інтервал кроку, днів',
    mcd_step_linear: 'лінійний',
    mcd_step_stepwise: 'ступінчастий',
    mcd_step_custom: 'довільний',
    mcd_titration_plan: 'план:',
    mcd_titration_to: 'днів на стадії',
    mcd_titration_stage: 'день {0} з {1} на стадії {2}мг',
    mcd_titration_target: 'ціль',
    mcd_inv_count: 'кількість в наявності',
    mcd_inv_threshold: 'поріг «купити скоро», днів',
    mcd_delete_msg: 'препарат перейде в архів. історія доз збережеться.',
    mcd_delete_btn: 'видалити',
    mcd_delete_confirm: 'впевнений?',
    mcd_save: 'зберегти',
    mcd_close: 'закрити',
    mcw_title: 'ризик множинних змін',
    mcw_intro: 'за останні 7 днів ти змінював:',
    mcw_changing: 'зараз змінюєш {0}.',
    mcw_body: 'при паралельних змінах важко відокремити ефекти кожного препарату. стандартна рекомендація — витримувати паузу 2-4 тижні між змінами.',
    mcw_proceed: 'зрозумів, продовжити',
    mcw_postpone: 'відкласти зміну',
    mdp_back: 'до списку',
    mdp_tab_overview: 'огляд',
    mdp_tab_journal: 'журнал',
    mdp_tab_doses: 'історія доз',
    mdp_tab_config: 'конфігурація',
    mdp_doses_empty: 'доз ще не приймав. історія з’явиться після першого прийому.',
    mdp_config_open_drawer: 'відкрити панель налаштувань',
    pn_capture_ph: 'що помітив?',
    pn_save: 'зберегти',
    pn_empty: 'спостережень поки немає. сюди — короткі нотатки про ефекти препарату.',
    pn_summary: 'за 30 днів: {0} плюсів · {1} мінусів',
    pn_edit: 'змінити',
    pn_delete: 'видалити',
    pn_save_short: 'збер.',
    pn_cancel: 'скас.',
    gj_filter_polarity: 'полярність',
    gj_filter_all: 'усі',
    gj_filter_plus: 'лише +',
    gj_filter_minus: 'лише −',
    gj_search_ph: 'пошук за текстом…',
    gj_empty: 'записів за фільтром немає.',
    dh_dose: 'доза',
    dh_mode_scheduled: 'за розкладом',
    dh_mode_prn: 'PRN',
    dh_mode_skip: 'пропущено',
    home_card_budget: 'бюджет місяця',
    home_card_budget_ctx: '${0} з ${1}',
    home_card_budget_empty: 'бюджет не задано · задати',
    home_card_streak: 'найдовша серія',
    home_card_streak_ctx: '{0} · {1} {2}',
    home_card_streak_empty: 'жодної активної серії',
    home_card_goal: 'найближча ціль',
    home_card_goal_empty: 'цілей немає · додати',
    home_card_tasks: 'завдання · цього тижня',
    home_card_tasks_ctx: 'виконано',
    home_card_tasks_empty: 'на цей тиждень задач немає',
    chart_trend_title: 'тенденція · 6 місяців',
    chart_categories_title: 'категорії · поточний місяць',
    chart_toggle_expenses: 'витрати',
    chart_toggle_income: 'доходи',
    chart_toggle_net: 'нетто',
    chart_filter_month: 'місяць',
    chart_filter_30: '30 днів',
    chart_others: '+ {0} інших',
    chart_empty_trend: 'недостатньо даних для тренду · потрібно ≥2 місяці',
    chart_empty_trend_cta: 'додати першу транзакцію',
    chart_empty_cat: 'транзакцій у цьому місяці ще немає.',
    tb_greet_morning: 'доброго ранку.',
    tb_greet_afternoon: 'доброго дня.',
    tb_greet_evening: 'доброго вечора.',
    tb_greet_night: 'пізній вечір.',
    tb_search: 'пошук або перехід…',
    tb_kbd_cmdk: '⌘ K',
    today_eyebrow: 'сьогодні · {0} {1} у роботі',
    today_meta_stakes: 'спершу важливі. решта почекає.',
    tasks_title: 'вхідні',
    tasks_open_total: '{0} відкрито · {1} усього',
    tasks_add: 'додати задачу…',
    tasks_add_stakes: 'що на кону?',
    tasks_toggle_routine: 'рутина',
    tasks_toggle_stakes: 'важливе',
    tag_today: 'сьогодні',
    tag_stakes: 'важливе',
    tag_work: 'робота',
    tag_money: 'фінанси',
    tag_habit: 'звичка',
    tag_life: 'життя',
    tag_inbox: 'вхідні',
    seed_task_ship: 'випустити лендинг',
    seed_task_commit: 'зафіксувати цілі Q4',
    seed_task_review: 'переглянути pull-реквести',
    seed_task_log: 'записати жовтневі витрати',
    seed_task_read: 'прочитати 30 сторінок',
    seed_task_mum: 'зателефонувати мамі',
    due_eod: 'до кінця дня',
    due_tue: 'вт',
    money_title: 'фінанси',
    money_period_currency: '{0} · USD',
    money_amt_placeholder: '0.00',
    money_log: 'записати',
    money_budget_pre: '{0} · {1}',
    money_warn_badge: '80%+ · важливе',
    money_over_badge: 'перевитрата',
    money_warn_hint: 'майже перевитрата · {0} {1} до кінця жовтня',
    money_over_hint: 'перевитрата на ${0} · так не можна',
    goals_title: 'цілі',
    goals_meta: '{0} відкрито · важливе',
    goal_emergency: 'подушка безпеки',
    goal_ship_v1: 'випустити Life·OS v1',
    goal_half_marathon: 'напівмарафон',
    goal_tag_q3: 'Q3',
    goal_tag_q4: 'Q4',
    goal_tag_jan: 'січ',
    habits_title: 'звички',
    habits_meta: '{0}/{1} цього тижня',
    habits_meta_period: 'цього тижня',
    habits_empty: 'звичок ще немає — почни з малого.',
    habits_add: '+ додати звичку',
    habits_streak: 'серія {0} {1} · найкраща {2}',
    habit_read: '30 сторінок на день',
    habit_no_phone: 'без телефону в ліжку',
    habit_walk: '8 тисяч кроків',
    habit_write: 'писати щодня',
    milestone_eyebrow: 'віха · серія {0} {1}',
    milestone_line: '{0} {1}. не зірви серію.',
    milestone_sub: '{0}',
    milestone_dismiss: 'сховати',
    qa_eyebrow: 'швидке додавання',
    qa_title: 'що потрібно зробити?',
    qa_title_stakes: 'що на кону?',
    qa_routine: 'рутина',
    qa_stakes: 'важливе',
    qa_category: 'категорія',
    qa_no_category: 'без категорії',
    qa_schedule_collapsed: 'запланувати…',
    qa_schedule_expanded: 'розклад',
    qa_date: 'дата',
    qa_time: 'час',
    qa_notes_collapsed: 'нотатки…',
    qa_notes_expanded: 'нотатки',
    qa_notes_placeholder: 'щось важливе про цю задачу…',
    qa_save: 'зберегти',
    qa_cancel: 'скасувати',
    qa_save_hint: '⌘ ↵ зберегти',
    qa_cancel_hint: 'ESC скасувати',
    toast_added: 'додано · {0}',
    toast_committed: 'зафіксовано · {0}',
    toast_expense: 'витрату записано · ${0} → {1}',
    toast_bot_run: 'ти обіцяв пробіжку. зараз {0}.',
    toast_name_sys: 'система',
    toast_name_bot: 'telegram-бот',
    empty_tasks: 'сьогодні задач немає. додай одну або видихни.',
    empty_money: 'цього місяця витрат немає. або чудово, або моно не синхронізується.',
    empty_goals: 'цілей поки немає. постав одну — у цьому весь сенс.',
    empty_calendar: 'подій не заплановано. тихий день.',
    /* ————— Sprint 3B · flexible finance ————— */
    fin_subtitle: '{0} транзакцій · {1} у підсумках',
    fin_period: '{0} · USD',
    fin_budget_label: 'бюджет {0}',
    fin_budget_val: '${0} з ${1}',
    fin_total_in: 'у підсумках',
    fin_total_hidden: 'сховано з підсумків',
    fin_section_recent: 'останні транзакції',
    fin_log: 'записати',
    fin_amt_ph: '0.00',
    fin_logged_just_now: 'щойно',
    fin_empty_tx: 'транзакцій поки немає. ⌘ K щоб записати першу.',
    fin_filter_all: 'усі',
    fin_filter_visible: 'у підсумках',
    fin_filter_hidden: 'сховані',
    eye_include_tip: 'врахувати в підсумках',
    eye_exclude_tip: 'не враховувати в підсумках',
    eye_cat_include: 'враховувати категорію',
    eye_cat_exclude: 'не враховувати категорію',
    fin_cat_off_chip: 'категорія схована',
    set_cat_in_totals: 'у підсумках',
    home_cat_all_hidden: 'усі категорії сховано з підсумків. повернути в налаштуваннях → категорії.',
    home_card_budget_derived: 'враховано ${0} · сховано ${1}',
    activity_tx_excluded: 'транзакція «{0}» виключена з підсумків',
    activity_tx_included: 'транзакція «{0}» включена до підсумків',
    activity_cat_excluded: 'категорія «{0}» виключена з підсумків',
    activity_cat_included: 'категорія «{0}» включена до підсумків',
    footer_local: 'локально',
    placeholder_404: 'не реалізовано',
    td_eyebrow: 'задача',
    td_subtasks: 'підзадачі',
    td_subtask_add: 'додати підзадачу…',
    td_activity: 'історія',
    td_log_created: 'створена',
    td_log_edited: 'відредагована',
    td_complete: 'виконати',
    td_uncomplete: 'повернути в роботу',
    td_save: 'зберегти',
    td_delete: 'видалити',
    td_delete_confirm: 'видалити назавжди?',
    td_delete_yes: 'так, видалити',
    atl_empty: 'історія порожня',
    set_title: 'налаштування',
    set_account: 'акаунт',
    set_categories: 'категорії',
    set_cat_name: 'категорія',
    set_telegram: 'telegram-бот',
    set_monobank: 'monobank',
    set_notifications: 'сповіщення',
    set_appearance: 'оформлення',
    set_export: 'експорт даних',
    set_danger: 'небезпечна зона',
    set_account_name: "ім'я",
    set_account_email: 'пошта',
    set_lang: 'мова',
    set_theme: 'тема',
    set_theme_dark: 'темна',
    set_theme_light: 'світла',
    set_theme_system: 'системна',
    set_theme_paradise: 'острів',
    set_accent_intensity: 'інтенсивність акценту',
    set_density: 'щільність',
    set_density_cozy: 'затишна',
    set_density_compact: 'щільна',
    set_tg_token: 'токен бота',
    set_tg_chat: 'chat id',
    set_tg_test: 'надіслати тест',
    set_mono_token: 'API-токен',
    set_mono_last: 'остання синхронізація',
    set_mono_sync: 'синхронізувати зараз',
    set_mono_pending: '{0} транзакцій з останньої синхронізації',
    set_quiet_hours: 'тихі години',
    set_export_json: 'JSON',
    set_export_csv: 'CSV',
    set_export_md: 'Markdown',
    set_danger_msg: 'видалить усі задачі, цілі, звички, витрати. це незворотно.',
    set_danger_btn: 'видалити всі дані',
    set_export_state: 'вивантажити state в JSON',
    set_export_state_hint: 'повний знімок localStorage',
    set_clear_history: 'очистити історію старшу',
    set_clear_history_hint: 'видалить activityLog старший порогу',
    set_clear_3mo: '3 місяці',
    set_clear_6mo: '6 місяців',
    set_clear_12mo: '12 місяців',
    set_clear_do: 'очистити',
    set_clear_done: 'видалено: {0}',
    set_cat_add: '+ додати категорію',
    set_cat_budget: 'місячний бюджет',
    set_notif_goal: 'віха цілі',
    set_notif_budget: 'бюджет 80%+',
    set_notif_streak: 'віха серії',
    set_notif_bot: 'нагадування бота',
    cal_title: 'календар',
    cal_today: 'сьогодні',
    cal_week: 'тиждень',
    cal_day: 'день',
    cal_month: 'місяць',
    cal_prev: '‹',
    cal_next: '›',
    cal_more_n: '+ {0} ще',
    cal_add_event: 'додати подію',
    cal_quiet_day: 'тихий день',
    /* Sprint 3B · seeded calendar events */
    cal_seed_standup: 'дейлі',
    cal_seed_walk: 'прогулянка',
    cal_seed_gym: 'спортзал',
    cal_seed_call_mum: 'зателефонувати мамі',
    cal_seed_review_pr: 'перегляд PR',
    cal_seed_therapy: 'терапія',
    cal_seed_dinner_a: 'вечеря з Анею',
    cal_seed_run: 'пробіжка',
    cal_seed_design_rev: 'рев\'ю макетів',
    cal_seed_lunch_x: 'обід з Х',
    cal_seed_ship_v1: 'реліз v1',
    cal_seed_one_on_one: '1:1 з тімлідом',
    cal_seed_bill_rent: 'оренда — списання',
    cal_seed_groceries: 'продукти',
    cal_seed_vet_call: 'дзвінок ветеринару',
    cal_seed_read: 'читання 30 сторінок',
    cal_seed_focus: 'focus block',
    cal_seed_q4_commit: 'цілі Q4',
    cal_seed_dentist: 'стоматолог',
    cal_seed_lunch_team: 'обід з командою',
    cal_seed_demo: 'демо клієнту',
    cal_seed_movie: 'кіно',
    cal_seed_dog_feed: 'годування пса',
    nav_more: 'ще',
    pl_task: ['задача', 'задачі', 'задач'],
    pl_day: ['день', 'дні', 'днів'],
    pl_left: ['залишився', 'залишилось', 'залишилось'],
    pl_goal: ['ціль', 'цілі', 'цілей'],
    pl_habit: ['звичка', 'звички', 'звичок'],
    pl_event: ['подія', 'події', 'подій'],
    pl_tx: ['транзакція', 'транзакції', 'транзакцій'],
    _intl_locale: 'uk-UA'
  }

  /* en: { ... }   ← reserved slot. Do not enable until strings exist. */
};

/* Locales the language toggle will render.
   English deliberately omitted — slot reserved in data model only. */
const LIFE_LOCALES = ['ru', 'uk'];
function makeT(locale) {
  const dict = LIFE_STRINGS[locale] || LIFE_STRINGS.ru;
  const t = function (key, ...args) {
    const raw = dict[key] != null ? dict[key] : LIFE_STRINGS.ru[key] != null ? LIFE_STRINGS.ru[key] : key;
    if (typeof raw !== 'string') return raw;
    return raw.replace(/\{(\d+)\}/g, (_, i) => args[+i] != null ? args[+i] : '');
  };
  /* Slavic 3-form plural picker.
     Usage: t.pl('pl_task', 5)  →  'задач'
     Forms are stored in the dict under pl_* keys: [one, few, many]. */
  t.pl = function (key, n) {
    const forms = dict[key] && Array.isArray(dict[key]) ? dict[key] : LIFE_STRINGS.ru[key] && Array.isArray(LIFE_STRINGS.ru[key]) ? LIFE_STRINGS.ru[key] : null;
    if (!forms) return '';
    const abs = Math.abs(n) | 0;
    const mod100 = abs % 100;
    if (mod100 >= 11 && mod100 <= 19) return forms[2];
    const mod10 = abs % 10;
    if (mod10 === 1) return forms[0];
    if (mod10 >= 2 && mod10 <= 4) return forms[1];
    return forms[2];
  };
  return t;
}
window.LifeStrings = LIFE_STRINGS;
window.LifeLocales = LIFE_LOCALES;
window.LifeMakeT = makeT;
window.LifeLocaleContext = React.createContext({
  locale: 'ru',
  t: makeT('ru'),
  setLocale: () => {}
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/i18n.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/icons.jsx
try { (() => {
/* global React */
/* Inline Lucide-style icons. Stroke 1.5, no fill, sharp corners. currentColor.
   Sized by parent — use width/height/font-size or class. */

const __ic = children => (props = {}) => {
  const size = props.size || 18;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, children);
};
window.LIcons = {
  /* ── nav / chrome ─────────────────────────────────────── */
  inbox: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("polyline", {
    points: "22 12 16 12 14 15 10 15 8 12 2 12"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
  }))),
  repeat: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("polyline", {
    points: "17 1 21 5 17 9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 11V9a4 4 0 0 1 4-4h14"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 23 3 19 7 15"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 13v2a4 4 0 0 1-4 4H3"
  }))),
  calendar: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "2",
    x2: "16",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "2",
    x2: "8",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "10",
    x2: "21",
    y2: "10"
  }))),
  target: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "2"
  }))),
  flag: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "22",
    x2: "4",
    y2: "15"
  }))),
  dollar: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "1",
    x2: "12",
    y2: "23"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
  }))),
  search: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65"
  }))),
  plus: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  }))),
  check: __ic(/*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })),
  x: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }))),
  chevDown: __ic(/*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  })),
  command: __ic(/*#__PURE__*/React.createElement("path", {
    d: "M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"
  })),
  clock: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 6 12 12 16 14"
  }))),
  star: __ic(/*#__PURE__*/React.createElement("path", {
    d: "M12 2 L13.8 7.5 L19.5 7.8 L15 11.6 L16.5 17.2 L12 14 L7.5 17.2 L9 11.6 L4.5 7.8 L10.2 7.5 Z"
  })),
  /* ── category icons ───────────────────────────────────── */
  shoppingCart: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "21",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "20",
    cy: "21",
    r: "1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"
  }))),
  utensils: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M3 2v7c0 1.1.9 2 2 2h2v11"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 2v20"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"
  }))),
  car: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6.5",
    cy: "16.5",
    r: "2.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "16.5",
    cy: "16.5",
    r: "2.5"
  }))),
  zap: __ic(/*#__PURE__*/React.createElement("polygon", {
    points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2"
  })),
  home: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "9 22 9 12 15 12 15 22"
  }))),
  wifi: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M5 12.55a11 11 0 0 1 14.08 0"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M1.42 9a16 16 0 0 1 21.16 0"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.53 16.11a6 6 0 0 1 6.95 0"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "20",
    x2: "12.01",
    y2: "20"
  }))),
  creditCard: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "1",
    y: "4",
    width: "22",
    height: "16",
    rx: "2",
    ry: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "1",
    y1: "10",
    x2: "23",
    y2: "10"
  }))),
  pill: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m8.5 8.5 7 7"
  }))),
  shirt: __ic(/*#__PURE__*/React.createElement("path", {
    d: "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"
  })),
  film: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "20",
    rx: "2.18",
    ry: "2.18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "7",
    y1: "2",
    x2: "7",
    y2: "22"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "17",
    y1: "2",
    x2: "17",
    y2: "22"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "12",
    x2: "22",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "7",
    x2: "7",
    y2: "7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "17",
    x2: "7",
    y2: "17"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "17",
    y1: "17",
    x2: "22",
    y2: "17"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "17",
    y1: "7",
    x2: "22",
    y2: "7"
  }))),
  bookOpen: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
  }))),
  gift: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("polyline", {
    points: "20 12 20 22 4 22 4 12"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "7",
    width: "20",
    height: "5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "22",
    x2: "12",
    y2: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"
  }))),
  plane: __ic(/*#__PURE__*/React.createElement("path", {
    d: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
  })),
  scissors: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "6",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "18",
    r: "3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20",
    y1: "4",
    x2: "8.12",
    y2: "15.88"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "14.47",
    y1: "14.48",
    x2: "20",
    y2: "20"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8.12",
    y1: "8.12",
    x2: "12",
    y2: "12"
  }))),
  package: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: "16.5",
    y1: "9.4",
    x2: "7.5",
    y2: "4.21"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "3.27 6.96 12 12.01 20.73 6.96"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "22.08",
    x2: "12",
    y2: "12"
  }))),
  moreHorizontal: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "12",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "5",
    cy: "12",
    r: "1"
  }))),
  briefcase: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "7",
    width: "20",
    height: "14",
    rx: "2",
    ry: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
  }))),
  laptop: __ic(/*#__PURE__*/React.createElement("path", {
    d: "M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"
  })),
  building: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "2",
    width: "16",
    height: "20",
    rx: "2",
    ry: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 22v-4h6v4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 6h.01"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 6h.01"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 6h.01"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 10h.01"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 14h.01"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 10h.01"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 14h.01"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 10h.01"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 14h.01"
  }))),
  trendingUp: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("polyline", {
    points: "23 6 13.5 15.5 8.5 10.5 1 18"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 6 23 6 23 12"
  }))),
  /* ── v2 sidebar additions ─────────────────────────────── */
  user: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "7",
    r: "4"
  }))),
  listChecks: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("polyline", {
    points: "3 8 5 10 9 6"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "3 16 5 18 9 14"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "13",
    y1: "9",
    x2: "21",
    y2: "9"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "13",
    y1: "17",
    x2: "21",
    y2: "17"
  }))),
  heart: __ic(/*#__PURE__*/React.createElement("path", {
    d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
  })),
  paw: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "10",
    r: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "10",
    cy: "6",
    r: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "14",
    cy: "6",
    r: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "10",
    r: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 14.5C8 17 6.5 18 6.5 20a2.5 2.5 0 0 0 4.4 1.6 2 2 0 0 1 2.2 0A2.5 2.5 0 0 0 17.5 20c0-2-1.5-3-2-5.5-.4-2-1.7-3-3.5-3s-3.1 1-3.5 3z"
  }))),
  stickyNote: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11l5-5V5a2 2 0 0 0-2-2z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "16 21 16 16 21 16"
  }))),
  wallet: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M20 12V8H6a2 2 0 0 1-2-2V18a2 2 0 0 0 2 2h14v-4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 12v4h-4a2 2 0 0 1 0-4z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 6V18"
  }))),
  calendarRange: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "2",
    x2: "16",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "2",
    x2: "8",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "10",
    x2: "21",
    y2: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "14",
    x2: "12",
    y2: "22"
  }))),
  coins: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("ellipse", {
    cx: "8",
    cy: "9",
    rx: "6",
    ry: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 9v5c0 1.7 2.7 3 6 3s6-1.3 6-3V9"
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: "16",
    cy: "15",
    rx: "6",
    ry: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 15v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"
  }))),
  chevLeft: __ic(/*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })),
  chevRight: __ic(/*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  })),
  panelLeft: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "3",
    x2: "9",
    y2: "21"
  }))),
  bell: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13.73 21a2 2 0 0 1-3.46 0"
  }))),
  bone: __ic(/*#__PURE__*/React.createElement("path", {
    d: "M17.4 6a2.4 2.4 0 0 0-3.4-3.4l-1 1a2.4 2.4 0 0 1-3.4 0l-1-1A2.4 2.4 0 0 0 6 6 2.4 2.4 0 0 0 2.6 9.4l1 1a2.4 2.4 0 0 1 0 3.4l-1 1A2.4 2.4 0 0 0 6 18a2.4 2.4 0 0 0 3.4 3.4l1-1a2.4 2.4 0 0 1 3.4 0l1 1A2.4 2.4 0 0 0 18 18a2.4 2.4 0 0 0 3.4-3.4l-1-1a2.4 2.4 0 0 1 0-3.4l1-1A2.4 2.4 0 0 0 17.4 6z"
  })),
  ruler: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m7.5 12.5 2 2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m10.5 9.5 2 2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m13.5 6.5 2 2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m4.5 15.5 2 2"
  }))),
  scale: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 21h10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 3v18"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"
  }))),
  utensilsAlt: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M17 22V11"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 22V13"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 22V2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 6h4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 14a4 4 0 0 0-4-4"
  }))),
  syringe: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "m18 2 4 4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m17 7 3-3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m19 9-8.5 8.5a1 1 0 0 1-1.5 0L7 16l-3 3 1 1 3-3 1.5 1.5a1 1 0 0 0 1.5 0L19 9z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m9 11 4 4"
  }))),
  alertTriangle: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "m10.29 3.86-8.18 14.39A2 2 0 0 0 3.84 21h16.32a2 2 0 0 0 1.74-2.75L13.71 3.86a2 2 0 0 0-3.42 0z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "9",
    x2: "12",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17"
  }))),
  edit2: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"
  }))),
  trash: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("polyline", {
    points: "3 6 5 6 21 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  }))),
  arrowUpRight: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: "7",
    y1: "17",
    x2: "17",
    y2: "7"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 7 17 7 17 17"
  }))),
  flame: __ic(/*#__PURE__*/React.createElement("path", {
    d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
  })),
  /* ── Sprint 3B · flexible finance toggle ────────────── */
  eye: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }))),
  eyeOff: __ic(/*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M9.88 9.88a3 3 0 0 0 4.24 4.24"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "2",
    x2: "22",
    y2: "22"
  }))),
  filter: __ic(/*#__PURE__*/React.createElement("polygon", {
    points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
  }))
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/lib/activity.js
try { (() => {
/* lib/activity.js
 *
 * Central activity log helper. Pure functions — they take the
 * current activityLog array and return a new one with the entry
 * appended. App-level dispatcher calls these inside the reducer.
 *
 * Entry shape:
 *   {
 *     id:          string,                 // unique
 *     timestamp:   ISO string,
 *     entity_type: 'task' | 'transaction' | 'med_dose' |
 *                  'med_config' | 'habit' | 'goal' |
 *                  'profile' | 'mode_style' | 'note' | 'quick_note',
 *     entity_id:   string | number,
 *     action:      'created' | 'edited' | 'completed' | 'reopened' |
 *                  'deleted' | 'restored' | 'dose_taken' |
 *                  'dose_skipped' | 'dose_snoozed' |
 *                  'mode_changed' | 'inventory_updated' |
 *                  'note_added' | 'note_edited' | 'note_deleted',
 *     details:     object                  // free-form
 *   }
 *
 * Cap: 5000 entries. Oldest dropped FIFO. Generous because each
 * entry is small (~150 bytes serialized) and the export tool can
 * preserve anything important.
 */

(function () {
  var CAP = 5000;
  var uidCounter = 0;
  function uid() {
    uidCounter += 1;
    return 'a' + Date.now().toString(36) + uidCounter.toString(36);
  }
  function appendActivity(log, entry) {
    var safe = Array.isArray(log) ? log : [];
    var full = {
      id: entry.id || uid(),
      timestamp: entry.timestamp || new Date().toISOString(),
      entity_type: entry.entity_type,
      entity_id: entry.entity_id != null ? entry.entity_id : null,
      action: entry.action,
      details: entry.details || {}
    };
    var next = safe.concat([full]);
    if (next.length > CAP) next = next.slice(next.length - CAP);
    return next;
  }

  /* Filter helper used by ActivityTimeline. */
  function entriesFor(log, entityType, entityId) {
    if (!Array.isArray(log)) return [];
    return log.filter(function (e) {
      if (entityType != null && e.entity_type !== entityType) return false;
      if (entityId != null && String(e.entity_id) !== String(entityId)) return false;
      return true;
    }).slice().reverse(); // newest first
  }

  /* Drop entries older than `cutoffISO`. Used by Settings "очистить
     историю". Returns new array. */
  function pruneOlderThan(log, cutoffISO) {
    if (!Array.isArray(log)) return [];
    var cutoff = new Date(cutoffISO).getTime();
    if (!isFinite(cutoff)) return log.slice();
    return log.filter(function (e) {
      var t = new Date(e.timestamp).getTime();
      return isFinite(t) && t >= cutoff;
    });
  }
  window.LifeActivity = {
    append: appendActivity,
    entriesFor: entriesFor,
    pruneOlderThan: pruneOlderThan,
    CAP: CAP
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/lib/activity.js", error: String((e && e.message) || e) }); }

// ui_kits/life-os/lib/calendar.js
try { (() => {
/* lib/calendar.js
 *
 * Sprint 3B · per-day event aggregator for the redesigned calendar.
 *
 * Inputs:
 *   weekStart  Date — Monday 00:00 of the displayed week
 *   state      central state tree (LifeDataProvider)
 *   t          i18n function (so titles resolve to current locale)
 *
 * Output: 7 arrays (Mon..Sun) of event objects, each sorted by time.
 *   event = {
 *     id:     stable string,
 *     time:   'HH:MM',         // 24h, used for sort + display
 *     title:  string,          // resolved
 *     kind:   'stakes'|'routine'|'info',
 *     source: 'task'|'health'|'work'|'bill'|'med'|'dog'|'social',
 *     entity: { type, id? }    // for click routing
 *   }
 *
 * Source mix (Sprint 3B):
 *   1. seed pool (LifeCalendarSeed) — anchored to weekStart by dayOffset
 *   2. state.tasks — only those whose `due` field is parseable as a
 *      day in the current week (eod → today, 'HH:MM' → today, weekday
 *      codes → that weekday).
 *   3. state.dog.feeding.meals — repeat daily, 7 days, kind=info,
 *      source=dog. Only when meals[].time is set.
 *
 * NB: medications doses left as a future hook (the dispenser surface
 * doesn't yet expose "when next dose is due" cleanly; Sprint 4 wires
 * it). Bills are seeded directly in the pool.
 */

(function () {
  const DOW_CODES = {
    'mon': 0,
    'tue': 1,
    'wed': 2,
    'thu': 3,
    'fri': 4,
    'sat': 5,
    'sun': 6
  };
  function sameWeek(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /* Parse a task.due string into { dayIdx, time }. Returns null if we
     can't place it. Conservative — we don't invent times. */
  function placeTask(due, todayIdx) {
    if (!due) return null;
    const s = String(due).trim().toLowerCase();
    if (s === 'eod') return {
      dayIdx: todayIdx,
      time: '23:00'
    };
    if (s === 'tomorrow') return {
      dayIdx: Math.min(6, todayIdx + 1),
      time: '12:00'
    };
    if (/^\d{1,2}:\d{2}$/.test(s)) {
      const [h, m] = s.split(':');
      return {
        dayIdx: todayIdx,
        time: h.padStart(2, '0') + ':' + m
      };
    }
    if (DOW_CODES[s] != null) return {
      dayIdx: DOW_CODES[s],
      time: '12:00'
    };
    return null;
  }
  function aggregate(weekStart, state, t) {
    const days = [[], [], [], [], [], [], []];

    /* Today index inside the displayed week, or -1 if not this week. */
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let todayIdx = -1;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      if (sameWeek(d, today)) {
        todayIdx = i;
        break;
      }
    }

    /* 1 · seed pool */
    const seed = window.LifeCalendarSeed || [];
    seed.forEach((ev, i) => {
      const idx = ev.dayOffset;
      if (idx < 0 || idx > 6) return;
      days[idx].push({
        id: 'seed:' + i,
        time: ev.time,
        title: t(ev.titleKey),
        kind: ev.kind,
        source: ev.source,
        entity: {
          type: 'seed',
          id: ev.titleKey
        }
      });
    });

    /* 2 · tasks — only when we can place them this week and only when
       the displayed week IS this calendar week. (Browsing prev/next
       week shouldn't fabricate task pills there.) */
    if (todayIdx >= 0 && Array.isArray(state.tasks)) {
      state.tasks.forEach(task => {
        if (task.done) return;
        const placed = placeTask(task.due, todayIdx);
        if (!placed) return;
        const title = task.titleKey ? t(task.titleKey) : task.title || task.title_ru || '';
        if (!title) return;
        days[placed.dayIdx].push({
          id: 'task:' + task.id,
          time: placed.time,
          title: title,
          kind: task.stakes ? 'stakes' : 'routine',
          source: 'task',
          entity: {
            type: 'task',
            id: task.id
          }
        });
      });
    }

    /* 3 · dog feedings — only when the user has set actual times. We
       skip empty placeholder rows so we don't dilute density with
       fake content. */
    const meals = state.dog && state.dog.feeding && state.dog.feeding.meals;
    if (Array.isArray(meals)) {
      meals.forEach((meal, mi) => {
        if (!meal.time || !/^\d{1,2}:\d{2}$/.test(meal.time)) return;
        for (let i = 0; i < 7; i++) {
          days[i].push({
            id: 'dog:' + meal.id + ':' + i,
            time: meal.time,
            title: t('cal_seed_dog_feed'),
            kind: 'info',
            source: 'dog',
            entity: {
              type: 'dog',
              id: meal.id
            }
          });
        }
      });
    }

    /* sort each bucket by time */
    days.forEach(arr => arr.sort((a, b) => a.time.localeCompare(b.time)));
    return {
      days,
      todayIdx
    };
  }
  window.LifeCalendar = {
    aggregate
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/lib/calendar.js", error: String((e && e.message) || e) }); }

// ui_kits/life-os/lib/finance.js
try { (() => {
/* lib/finance.js
 *
 * Sprint 3B · pure helpers for the flexible-finance feature.
 *
 * A transaction counts toward totals only if BOTH gates are open:
 *   1. transaction.included_in_totals !== false
 *   2. categoryOverrides[transaction.category_id]?.included_in_totals !== false
 *
 * Helpers exported on window.LifeFinance:
 *   isIncluded(tx, overrides)            → boolean
 *   sumIncluded(txList, overrides)       → number
 *   byCategory(txList, overrides)        → [{ catId, amount }] aggregated, only-included
 *   allCategoriesHidden(overrides, cats) → boolean (extreme empty-state hint)
 */

(function () {
  function isIncluded(tx, overrides) {
    if (!tx) return false;
    if (tx.included_in_totals === false) return false;
    var o = overrides && overrides[tx.category_id];
    if (o && o.included_in_totals === false) return false;
    return true;
  }
  function sumIncluded(txList, overrides) {
    if (!Array.isArray(txList)) return 0;
    var total = 0;
    for (var i = 0; i < txList.length; i++) {
      if (isIncluded(txList[i], overrides)) total += +txList[i].amount || 0;
    }
    return total;
  }
  function byCategory(txList, overrides) {
    if (!Array.isArray(txList)) return [];
    var bucket = {};
    for (var i = 0; i < txList.length; i++) {
      var tx = txList[i];
      if (!isIncluded(tx, overrides)) continue;
      bucket[tx.category_id] = (bucket[tx.category_id] || 0) + (+tx.amount || 0);
    }
    var out = [];
    for (var k in bucket) {
      if (Object.prototype.hasOwnProperty.call(bucket, k)) {
        out.push({
          catId: k,
          amount: bucket[k]
        });
      }
    }
    return out;
  }

  /* Sprint 3B QA scenario: if EVERY category is overridden off, the
     /home category breakdown shows a hint pointing at Settings. */
  function allCategoriesHidden(overrides, expenseCats) {
    if (!overrides || !expenseCats || expenseCats.length === 0) return false;
    for (var i = 0; i < expenseCats.length; i++) {
      var c = expenseCats[i];
      var o = overrides[c.id];
      if (!o || o.included_in_totals !== false) return false;
    }
    return true;
  }

  /* Convenience: how many transactions are excluded? Used in
     /finances page header chip. */
  function excludedCount(txList, overrides) {
    if (!Array.isArray(txList)) return 0;
    var n = 0;
    for (var i = 0; i < txList.length; i++) {
      if (!isIncluded(txList[i], overrides)) n += 1;
    }
    return n;
  }
  window.LifeFinance = {
    isIncluded: isIncluded,
    sumIncluded: sumIncluded,
    byCategory: byCategory,
    allCategoriesHidden: allCategoriesHidden,
    excludedCount: excludedCount
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/lib/finance.js", error: String((e && e.message) || e) }); }

// ui_kits/life-os/lib/medMath.js
try { (() => {
/* lib/medMath.js
 *
 * Pure helpers for medication timer math + duration formatting.
 * No React, no DOM. Imported by MedCard, TakeDoseModal, MedDetailPage.
 *
 * Glossary
 *   med            — entry from state.medications
 *   doseLog        — array of { taken_at, dose_mg, mode, note }, NEWEST first
 *   modeStyle      — entry from state.modeStyles[medId] or null
 *   nowMs          — Date.now() snapshot (passed in so React can re-render
 *                    on tick without these fns reading wall-clock directly).
 */

(function () {
  const HR = 3600 * 1000;
  const DAY = 24 * HR;

  /* Format "5ч 47м" / "5г 47хв" — accepts a positive ms delta. */
  function formatHM(ms, unitH, unitM) {
    if (ms < 0) ms = 0;
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return m + unitM;
    if (m === 0) return h + unitH;
    return h + unitH + ' ' + m + unitM;
  }

  /* HH:MM in local time. */
  function formatClock(date) {
    return date.toTimeString().slice(0, 5);
  }

  /* Pick the most recent dose log entry. Returns null if list empty. */
  function lastDose(doseLog) {
    if (!Array.isArray(doseLog) || doseLog.length === 0) return null;
    /* arrays are stored newest-first in state.doseLogs */
    return doseLog[0];
  }

  /* Timer 1 · next dose
     Returns { etaMs, eta: 'HH:MM' } if a schedule exists, else null.
     For PRN-mode meds, callers should hide this timer. */
  function nextDose(med, doseLog, modeStyle, nowMs) {
    if (modeStyle && modeStyle.type === 'prn') return null;
    const interval = med.dose_interval_h;
    if (!interval) return null;
    const last = lastDose(doseLog);
    if (!last) return {
      etaMs: 0,
      eta: formatClock(new Date(nowMs))
    };
    const lastMs = new Date(last.taken_at).getTime();
    const targetMs = lastMs + interval * HR;
    return {
      etaMs: targetMs - nowMs,
      eta: formatClock(new Date(targetMs))
    };
  }

  /* Timer 2 · half-life decay
     Returns { halfLifeH, exitClock } where exitClock is HH:MM when
     concentration falls below 1 t½ after the last dose. */
  function halfLifeTimer(med, doseLog, nowMs) {
    const h = med.half_life_h;
    if (h == null) return null;
    const last = lastDose(doseLog);
    if (!last) return null;
    const lastMs = new Date(last.taken_at).getTime();
    const exitMs = lastMs + h * HR;
    return {
      halfLifeH: h,
      exitClock: formatClock(new Date(exitMs))
    };
  }

  /* Timer 3 · full elimination (~5 half-lives)
     Uses half_life_active_metabolite_h if present (DDCAR case for
     cariprazine, etc). Returns { days, useMetabolite }. */
  function fullEliminationTimer(med) {
    const useMetabolite = med.half_life_active_metabolite_h != null;
    const h = useMetabolite ? med.half_life_active_metabolite_h : med.half_life_h;
    if (h == null) return null;
    const days = Math.round(5 * h / 24);
    return {
      days,
      useMetabolite
    };
  }

  /* "Обычно принимаешь в HH:MM" — mean time-of-day over last 14
     entries, only if stddev < 90 minutes (spec). */
  function usualTime(doseLog) {
    if (!Array.isArray(doseLog) || doseLog.length < 3) return null;
    const sample = doseLog.slice(0, 14).map(e => {
      const d = new Date(e.taken_at);
      return d.getHours() * 60 + d.getMinutes();
    });
    /* circular mean would be nicer but overkill for one-per-day */
    const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
    const variance = sample.reduce((a, b) => a + (b - mean) * (b - mean), 0) / sample.length;
    const std = Math.sqrt(variance);
    if (std > 90) return null;
    const h = Math.floor(mean / 60);
    const m = Math.round(mean % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* Inventory risk tier given count + per-day consumption rate.
     Returns { daysLeft, tier, chipKey } where tier ∈
     'safe' | 'soon' | 'urgent' | 'low' | 'empty'.
     `low` (0-1 days) maps to red "заканчивается"; `empty` (0 doses
     and 0 inventory) maps to "закончился" + disabled take button. */
  function inventoryRisk(med, modeStyle) {
    const count = med.inventory_count || 0;
    const dosesPerDay = modeStyle && modeStyle.type === 'prn' ? 1 // PRN: assume 1/day worst-case
    : med.doses_per_day || 1;
    const daysLeft = dosesPerDay > 0 ? count / dosesPerDay : null;
    if (count === 0) return {
      daysLeft: 0,
      tier: 'empty',
      chipKey: 'meds_inv_empty'
    };
    if (daysLeft != null && daysLeft <= 1) return {
      daysLeft,
      tier: 'low',
      chipKey: 'meds_inv_running_out'
    };
    if (daysLeft != null && daysLeft <= 3) return {
      daysLeft,
      tier: 'urgent',
      chipKey: 'meds_inv_urgent'
    };
    if (daysLeft != null && daysLeft <= 7) return {
      daysLeft,
      tier: 'soon',
      chipKey: 'meds_inv_soon'
    };
    return {
      daysLeft,
      tier: 'safe',
      chipKey: null
    };
  }

  /* Late/early indicator for TakeDoseModal. Returns
     { kind: 'late' | 'early', deltaMs } or null if within 30min of
     expected. */
  function dosingDelta(med, doseLog, takenAtMs) {
    const interval = med.dose_interval_h;
    if (!interval) return null;
    const last = lastDose(doseLog);
    if (!last) return null;
    const lastMs = new Date(last.taken_at).getTime();
    const expectedMs = lastMs + interval * HR;
    const delta = takenAtMs - expectedMs;
    if (Math.abs(delta) < 30 * 60 * 1000) return null;
    return {
      kind: delta > 0 ? 'late' : 'early',
      deltaMs: Math.abs(delta)
    };
  }

  /* PRN anti-stacking: returns ms since last dose if user is in PRN
     mode AND that gap is shorter than dose_interval_h. Else null. */
  function prnStackingGap(med, doseLog, modeStyle, nowMs) {
    if (!modeStyle || modeStyle.type !== 'prn') return null;
    const last = lastDose(doseLog);
    if (!last) return null;
    const interval = med.dose_interval_h || 6;
    const gap = nowMs - new Date(last.taken_at).getTime();
    if (gap >= interval * HR) return null;
    return gap;
  }
  window.LifeMedMath = {
    HR,
    DAY,
    formatHM,
    formatClock,
    lastDose,
    nextDose,
    halfLifeTimer,
    fullEliminationTimer,
    usualTime,
    inventoryRisk,
    dosingDelta,
    prnStackingGap
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/lib/medMath.js", error: String((e && e.message) || e) }); }

// ui_kits/life-os/lib/storage.js
try { (() => {
/* lib/storage.js
 *
 * localStorage persistence for the entire Life OS state tree.
 *
 * Contract:
 *   loadState()      → parsed object | null
 *   saveState(state) → throttled write (500ms trailing edge)
 *
 * Single key: 'lifeOsState'. No eviction, no migration scaffolding
 * yet — version field is reserved on the state object for when we
 * need it (Sprint 5+ / v3.0 backend port).
 *
 * Safe against quota errors and disabled storage (private mode):
 * swallowed silently so nothing crashes; in-memory state still
 * works for the session. */

(function () {
  var KEY = 'lifeOsState';
  var THROTTLE_MS = 500;
  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  /* Throttled trailing-edge writer. Multiple rapid setState calls
     during a single interaction collapse into one write, but the
     LAST state always lands within THROTTLE_MS. */
  var pending = null;
  var timer = null;
  var lastFlush = 0;
  function flushNow() {
    if (pending == null) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(pending));
    } catch (e) {
      /* quota, private mode, etc — silent */
    }
    pending = null;
    lastFlush = Date.now();
    timer = null;
  }
  function saveState(state) {
    pending = state;
    if (timer) return;
    var elapsed = Date.now() - lastFlush;
    var wait = elapsed >= THROTTLE_MS ? 0 : THROTTLE_MS - elapsed;
    timer = setTimeout(flushNow, wait);
  }
  function clearState() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
    pending = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /* Force-flush on page hide so a refresh mid-throttle doesn't
     lose the most recent change. */
  window.addEventListener('beforeunload', flushNow);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushNow();
  });
  window.LifeStorage = {
    load: loadState,
    save: saveState,
    clear: clearState,
    flush: flushNow,
    KEY: KEY
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/lib/storage.js", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/DogPage.jsx
try { (() => {
/* global React */
const {
  useState: useStateDog,
  useContext: useCtxDog,
  useMemo: useMemoDog
} = React;

/* Dog tab.
   Sprint 1 ships seed data + layout. The live reminders rail at the top
   shows mock countdowns; Sprint 3 will replace these with real timers
   bound to last-feed-at, last-walk-at, and the next vet visit date. */
function DogPage({
  dog,
  onUpdate,
  locale,
  t
}) {
  const I = window.LIcons;
  const Field = window.EditableField;
  const vetCountdown = useMemoDog(() => {
    const [d, m, y] = dog.vet.next.date.split('.').map(Number);
    const next = new Date(y, m - 1, d);
    const days = Math.max(0, Math.ceil((next - new Date()) / 86400000));
    return days;
  }, [dog.vet.next.date]);
  return /*#__PURE__*/React.createElement("div", {
    className: "page dog-page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, t('dog_title')), /*#__PURE__*/React.createElement("div", {
    className: "page-sub mono"
  }, t('dog_subtitle')))), /*#__PURE__*/React.createElement("div", {
    className: "dog-reminders"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dog-reminder"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dog-reminder-icon"
  }, I.utensilsAlt({
    size: 14
  })), t('dog_rem_feed', dog.reminders.nextFeedIn)), /*#__PURE__*/React.createElement("span", {
    className: "dog-reminder"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dog-reminder-icon"
  }, I.paw({
    size: 14
  })), t('dog_rem_walk', dog.reminders.nextWalkIn)), /*#__PURE__*/React.createElement("span", {
    className: "dog-reminder"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dog-reminder-icon"
  }, I.syringe({
    size: 14
  })), t('dog_rem_vet', vetCountdown, t.pl('pl_day', vetCountdown)))), /*#__PURE__*/React.createElement("div", {
    className: "dog-grid"
  }, /*#__PURE__*/React.createElement("section", {
    className: "pc-card dog-profile-card"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('dog_pf'))), /*#__PURE__*/React.createElement("div", {
    className: "dog-profile-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dog-avatar",
    title: t('dog_pf_photo_hint')
  }, /*#__PURE__*/React.createElement("span", {
    className: "dog-avatar-paw"
  }, I.paw({
    size: 38
  })), /*#__PURE__*/React.createElement("span", {
    className: "dog-avatar-hint mono"
  }, t('dog_pf_photo'))), /*#__PURE__*/React.createElement("div", {
    className: "dog-profile-fields"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('dog_pf_name')), dog.profile.name ? /*#__PURE__*/React.createElement(Field, {
    value: dog.profile.name,
    placeholder: t('dog_name_placeholder'),
    onChange: v => onUpdate('profile', {
      name: v
    })
  }) : /*#__PURE__*/React.createElement("button", {
    className: "dog-name-placeholder",
    onClick: () => onUpdate('profile', {
      name: 'буква'
    }),
    title: t('dog_name_placeholder')
  }, t('dog_name_placeholder'))), /*#__PURE__*/React.createElement("div", {
    className: "pc-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('dog_pf_breed')), /*#__PURE__*/React.createElement("div", {
    className: "dog-static"
  }, dog.profile.breed[locale])), /*#__PURE__*/React.createElement("div", {
    className: "pc-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('dog_pf_birth')), /*#__PURE__*/React.createElement(Field, {
    value: dog.profile.birth,
    placeholder: t('dog_unset'),
    mono: true,
    onChange: v => onUpdate('profile', {
      birth: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "pc-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('dog_pf_weight')), /*#__PURE__*/React.createElement(Field, {
    value: dog.profile.weight,
    placeholder: t('dog_unset'),
    mono: true,
    suffix: "\u043A\u0433",
    onChange: v => onUpdate('profile', {
      weight: v
    })
  }))))), /*#__PURE__*/React.createElement("section", {
    className: "pc-card"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('dog_feed')), /*#__PURE__*/React.createElement("span", {
    className: "pc-sub mono"
  }, t('dog_feed_sub'))), /*#__PURE__*/React.createElement("div", {
    className: "dog-meals"
  }, dog.feeding.meals.map((meal, i) => /*#__PURE__*/React.createElement("div", {
    className: "dog-meal-row",
    key: meal.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "dog-meal-num mono"
  }, i + 1), /*#__PURE__*/React.createElement(Field, {
    value: meal.time,
    type: "time",
    mono: true,
    onChange: v => onUpdate('feeding', {
      meals: dog.feeding.meals.map(m => m.id === meal.id ? {
        ...m,
        time: v
      } : m)
    })
  }), /*#__PURE__*/React.createElement(Field, {
    value: meal.portion,
    mono: true,
    placeholder: t('dog_feed_portion_ph'),
    suffix: "\u0433",
    onChange: v => onUpdate('feeding', {
      meals: dog.feeding.meals.map(m => m.id === meal.id ? {
        ...m,
        portion: v
      } : m)
    })
  }), /*#__PURE__*/React.createElement("button", {
    className: "dog-feed-btn mono",
    type: "button",
    title: t('dog_feed_feed_now')
  }, I.check({
    size: 12
  }), /*#__PURE__*/React.createElement("span", null, t('dog_feed_feed_now')))))), /*#__PURE__*/React.createElement("a", {
    className: "dog-meal-history mono",
    href: "#",
    onClick: e => e.preventDefault()
  }, t('dog_feed_history'))), /*#__PURE__*/React.createElement("section", {
    className: "pc-card"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('dog_inv'))), /*#__PURE__*/React.createElement("div", {
    className: "dog-inv"
  }, dog.inventory.food.totalG ? /*#__PURE__*/React.createElement("div", {
    className: "dog-inv-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dog-inv-name"
  }, t('dog_inv_food')), /*#__PURE__*/React.createElement("div", {
    className: "dog-inv-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dog-inv-track-bar",
    style: {
      width: dog.inventory.food.remainingG / dog.inventory.food.totalG * 100 + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "dog-inv-meta mono"
  }, `${dog.inventory.food.remainingG}г / ${dog.inventory.food.totalG}г`)) : /*#__PURE__*/React.createElement("div", {
    className: "dog-inv-row dog-inv-row-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dog-inv-name"
  }, t('dog_inv_food')), /*#__PURE__*/React.createElement("button", {
    className: "dog-inv-empty-link mono",
    type: "button",
    onClick: () => onUpdate('inventory', {
      food: {
        ...dog.inventory.food,
        totalG: 7000,
        remainingG: 7000
      }
    })
  }, t('dog_inv_food_empty'))), /*#__PURE__*/React.createElement("div", {
    className: "dog-inv-secondary"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dog-inv-secondary-row"
  }, /*#__PURE__*/React.createElement("span", null, t('dog_inv_treats')), /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, t('dog_inv_empty'))), /*#__PURE__*/React.createElement("div", {
    className: "dog-inv-secondary-row"
  }, /*#__PURE__*/React.createElement("span", null, t('dog_inv_hygiene')), /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, t('dog_inv_empty')))))), /*#__PURE__*/React.createElement("section", {
    className: "pc-card"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('dog_vet'))), /*#__PURE__*/React.createElement("div", {
    className: "dog-vet"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dog-vet-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('dog_vet_last')), /*#__PURE__*/React.createElement(Field, {
    value: dog.vet.last.date,
    mono: true,
    onChange: v => onUpdate('vet', {
      last: {
        ...dog.vet.last,
        date: v
      }
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "dog-vet-note"
  }, dog.vet.last['note_' + locale])), /*#__PURE__*/React.createElement("div", {
    className: "dog-vet-block is-next"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('dog_vet_next')), /*#__PURE__*/React.createElement(Field, {
    value: dog.vet.next.date,
    mono: true,
    onChange: v => onUpdate('vet', {
      next: {
        ...dog.vet.next,
        date: v
      }
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "dog-vet-note"
  }, dog.vet.next['note_' + locale])))), /*#__PURE__*/React.createElement("section", {
    className: "pc-card"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('dog_tasks'))), dog.tasks.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "dog-empty"
  }, t('dog_tasks_empty')) : /*#__PURE__*/React.createElement("div", null)), /*#__PURE__*/React.createElement("section", {
    className: "pc-card"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('dog_exp')), /*#__PURE__*/React.createElement("span", {
    className: "pc-sub mono"
  }, t('dog_exp_zero'), " / MONTH")), /*#__PURE__*/React.createElement("div", {
    className: "dog-empty"
  }, t('dog_exp_empty')))));
}
window.DogPage = DogPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/DogPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/FinancesPage.jsx
try { (() => {
/* global React */
const {
  useState: useStateFin,
  useContext: useCtxFin,
  useMemo: useMemoFin
} = React;

/* Sprint 3B · FinancesPage — full surface (replaces the v1 wrapper
   that just rendered <MoneyWidget/>). Sources transactions from the
   central state tree, exposes the per-transaction eye toggle, and
   shows totals that respect category overrides.

   Composition:
     header           page-head + tx count + in-totals chip
     budget summary   overall monthly utilization (cap from seed,
                      spent from state, hidden amount split out)
     logger row       amount + category select + log
     filter chips     all · visible · hidden
     transaction list grouped by date, each row with EyeToggle */
function FinancesPage({
  emptyMode
}) {
  const {
    t,
    locale
  } = useCtxFin(window.LifeLocaleContext);
  const data = useCtxFin(window.LifeDataContext);
  const I = window.LIcons;
  const F = window.LifeFinance;
  const state = data.state;
  const txAll = state.transactions || [];
  const txList = emptyMode ? [] : txAll;
  const overrides = state.categoryOverrides || {};
  const expenseCats = window.LifeExpenseCats || [];
  const catLookup = useMemoFin(() => {
    const m = {};
    (window.LifeCategories || []).forEach(c => {
      m[c.id] = c;
    });
    return m;
  }, []);

  /* ── derived totals ───────────────────────────────────── */
  const inTotals = F.sumIncluded(txList, overrides);
  const hidden = txList.reduce((s, x) => s + (F.isIncluded(x, overrides) ? 0 : +x.amount || 0), 0);
  const visibleCount = txList.filter(x => F.isIncluded(x, overrides)).length;
  const seed = window.LifeDashSeed || {};
  const cap = seed.budget && seed.budget.capUsd || 4000;
  const pct = cap > 0 ? Math.min(100, inTotals / cap * 100) : 0;
  const warn = pct >= 80 && pct <= 100;
  const over = inTotals > cap;
  const intlLoc = window.LifeStrings[locale]._intl_locale;
  const monthShort = new Date().toLocaleDateString(intlLoc, {
    month: 'short'
  }).replace('.', '');
  const fmt = n => Number(n).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  /* ── logger form ──────────────────────────────────────── */
  const [amount, setAmount] = useStateFin('');
  const [catId, setCatId] = useStateFin('groceries');
  function logIt(e) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    data.addTransaction({
      amount: n,
      category_id: catId,
      date: new Date().toISOString().slice(0, 10),
      description: catLookup[catId] ? catLookup[catId].name[locale] : catId,
      source: 'manual'
    });
    setAmount('');
  }

  /* ── filter chips ─────────────────────────────────────── */
  const [filter, setFilter] = useStateFin('all');
  const filters = [{
    id: 'all',
    label: t('fin_filter_all')
  }, {
    id: 'visible',
    label: t('fin_filter_visible')
  }, {
    id: 'hidden',
    label: t('fin_filter_hidden')
  }];
  const filtered = useMemoFin(() => {
    if (filter === 'visible') return txList.filter(x => F.isIncluded(x, overrides));
    if (filter === 'hidden') return txList.filter(x => !F.isIncluded(x, overrides));
    return txList;
  }, [txList, overrides, filter]);

  /* sort newest-first by date (then by id as tiebreaker so logged-now
     entries land on top before their `date` clock-ticks past). */
  const sorted = useMemoFin(() => filtered.slice().sort((a, b) => {
    const ad = String(a.date || ''),
      bd = String(b.date || '');
    if (ad !== bd) return bd.localeCompare(ad);
    return String(b.id).localeCompare(String(a.id));
  }), [filtered]);
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(intlLoc, {
      day: '2-digit',
      month: '2-digit'
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "page fin-page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, t('money_title')), /*#__PURE__*/React.createElement("div", {
    className: "page-sub mono"
  }, t('fin_subtitle', txList.length, '$' + fmt(inTotals)), " \xB7 ", t('fin_period', monthShort)))), /*#__PURE__*/React.createElement("section", {
    className: "card panel fin-summary" + (over ? ' is-over' : warn ? ' is-warn' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-eyebrow mono"
  }, t('fin_total_in')), /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-val mono"
  }, "$", fmt(inTotals)), /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-meta mono"
  }, t('fin_budget_val', fmt(inTotals), fmt(cap)))), /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-eyebrow mono"
  }, t('fin_total_hidden')), /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-val mono fin-summary-val-quiet"
  }, "$", fmt(hidden)), /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-meta mono"
  }, txList.length - visibleCount, "/", txList.length, " \xB7 ", t.pl('pl_tx', txList.length - visibleCount))), /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-bar-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-bar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-bar-fill" + (over ? ' is-over' : warn ? ' is-warn' : ''),
    style: {
      width: pct + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "fin-summary-bar-meta mono"
  }, Math.round(pct), "% \xB7 ", t('fin_budget_label', monthShort.toLowerCase())))), /*#__PURE__*/React.createElement("form", {
    className: "fin-logger",
    onSubmit: logIt
  }, /*#__PURE__*/React.createElement("div", {
    className: "money-input-wrap fin-logger-amount"
  }, /*#__PURE__*/React.createElement("span", {
    className: "money-prefix mono"
  }, "$"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "money-input mono",
    value: amount,
    onChange: e => setAmount(e.target.value),
    placeholder: t('fin_amt_ph'),
    inputMode: "decimal"
  })), /*#__PURE__*/React.createElement("select", {
    className: "money-bucket mono fin-logger-cat",
    value: catId,
    onChange: e => setCatId(e.target.value)
  }, expenseCats.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name[locale]))), /*#__PURE__*/React.createElement("button", {
    className: "money-log fin-logger-go",
    type: "submit"
  }, t('fin_log')))), /*#__PURE__*/React.createElement("div", {
    className: "tasks-toolbar fin-toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tasks-chips"
  }, filters.map(f => {
    const count = f.id === 'all' ? txList.length : f.id === 'visible' ? visibleCount : txList.length - visibleCount;
    return /*#__PURE__*/React.createElement("button", {
      key: f.id,
      className: "tasks-chip" + (filter === f.id ? " is-on" : ""),
      onClick: () => setFilter(f.id)
    }, f.label, " ", /*#__PURE__*/React.createElement("span", {
      className: "tasks-chip-count mono"
    }, count));
  }))), /*#__PURE__*/React.createElement("section", {
    className: "card panel fin-tx-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "panel-title"
  }, t('fin_section_recent')), /*#__PURE__*/React.createElement("div", {
    className: "panel-head-right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono panel-meta"
  }, sorted.length, " \xB7 ", t.pl('pl_tx', sorted.length)))), sorted.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, t('fin_empty_tx')) : /*#__PURE__*/React.createElement("ul", {
    className: "fin-tx-list"
  }, sorted.map(tx => {
    const cat = catLookup[tx.category_id];
    const Icon = cat && I[cat.icon];
    const included = F.isIncluded(tx, overrides);
    const catHidden = overrides[tx.category_id] && overrides[tx.category_id].included_in_totals === false;
    const txOff = tx.included_in_totals === false;
    const eyeTitle = txOff ? t('eye_include_tip') : t('eye_exclude_tip');
    return /*#__PURE__*/React.createElement("li", {
      key: tx.id,
      className: "fin-tx" + (included ? '' : ' is-excluded')
    }, /*#__PURE__*/React.createElement("span", {
      className: "fin-tx-icon " + (cat ? window.LifeCatTintClass[cat.tint] : '')
    }, Icon ? /*#__PURE__*/React.createElement(Icon, {
      size: 14
    }) : /*#__PURE__*/React.createElement("span", {
      className: "fin-tx-icon-dot"
    })), /*#__PURE__*/React.createElement("div", {
      className: "fin-tx-where"
    }, /*#__PURE__*/React.createElement("div", {
      className: "fin-tx-where-top"
    }, /*#__PURE__*/React.createElement("span", {
      className: "fin-tx-cat"
    }, cat ? cat.name[locale] : tx.category_id), catHidden && /*#__PURE__*/React.createElement("span", {
      className: "fin-tx-cat-chip mono",
      title: t('fin_cat_off_chip')
    }, t('fin_cat_off_chip'))), /*#__PURE__*/React.createElement("span", {
      className: "fin-tx-desc"
    }, tx.description)), /*#__PURE__*/React.createElement(window.EyeToggle, {
      included: !txOff,
      onToggle: () => data.toggleTransactionInclusion(tx.id),
      title: eyeTitle,
      ariaLabel: eyeTitle,
      size: 14
    }), /*#__PURE__*/React.createElement("span", {
      className: "fin-tx-amt mono"
    }, "$", fmt(tx.amount)), /*#__PURE__*/React.createElement("span", {
      className: "fin-tx-meta mono"
    }, tx.source || '', " \xB7 ", fmtDate(tx.date)));
  }))));
}
window.FinancesPage = FinancesPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/FinancesPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/HealthPage.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxHealth
} = React;

/* Health tab — Sprint 1 ships the skeleton only. Sprint 3 will populate
   each section with real data (labs scheduled, doctor visits, medical
   purchases tagged from finances, health-scoped goals). */
function HealthPage() {
  const {
    t
  } = useCtxHealth(window.LifeLocaleContext);
  const I = window.LIcons;
  const sections = [{
    id: 'labs',
    title: t('health_labs'),
    empty: t('health_labs_empty'),
    icon: 'syringe'
  }, {
    id: 'visit',
    title: t('health_visit'),
    empty: t('health_visit_empty'),
    icon: 'heart'
  }, {
    id: 'purchases',
    title: t('health_purchases'),
    empty: t('health_purchases_empty'),
    icon: 'wallet'
  }, {
    id: 'goals',
    title: t('health_goals'),
    empty: t('health_goals_empty'),
    icon: 'target'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "page health-page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, t('health_title')), /*#__PURE__*/React.createElement("div", {
    className: "page-sub mono"
  }, t('health_subtitle')))), /*#__PURE__*/React.createElement("div", {
    className: "health-grid"
  }, sections.map(s => /*#__PURE__*/React.createElement("section", {
    className: "pc-card health-card",
    key: s.id
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "health-icon"
  }, I[s.icon] && I[s.icon]({
    size: 16
  })), /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, s.title)), /*#__PURE__*/React.createElement("div", {
    className: "health-empty"
  }, s.empty)))));
}
window.HealthPage = HealthPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/HealthPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/HomePage.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxHome,
  useMemo: useMemoHome
} = React;

/* HomePage — Sprint 2 stats dashboard.
   Batches:
     1 · header (existing TopBar above) + hero stat row (this batch)
     2 · trend chart + category chart
     3 · upcoming-this-week + recent bot
     4 · design-system cards + verifier
   Sections render unconditionally; each handles its own empty state.

   Stat seeds come from window.LifeDashSeed; navigation requests funnel
   through props.onNav so we don't re-import the route registry here.

   Sprint 3B · flexible finance: budget/category/trend numbers are now
   derived from state.transactions filtered by the per-tx + per-category
   eye toggles. Only the CURRENT month's trend point recomputes —
   prior 5 months stay on seed (we don't carry per-transaction history
   for past months). */
function HomePage({
  onNav,
  onOpenTask,
  emptyMode
}) {
  const {
    t,
    locale
  } = useCtxHome(window.LifeLocaleContext);
  const data = React.useContext(window.LifeDataContext);
  const seed = emptyMode ? {} : window.LifeDashSeed || {};
  const F = window.LifeFinance;

  /* ── derived finance (Sprint 3B) ────────────────────────────────── */
  const txAll = data && data.state && data.state.transactions || [];
  const overrides = data && data.state && data.state.categoryOverrides || {};
  const txList = emptyMode ? [] : txAll;
  const inTotals = F.sumIncluded(txList, overrides);
  const hiddenAmt = txList.reduce((s, x) => s + (F.isIncluded(x, overrides) ? 0 : +x.amount || 0), 0);

  /* ── hero stats — derive presentation values from seed ──────────── */
  const seedBudget = seed.budget || {
    capUsd: 0,
    spentUsd: 0
  };
  const budget = {
    capUsd: seedBudget.capUsd,
    spentUsd: emptyMode || txAll.length === 0 ? seedBudget.spentUsd : inTotals,
    capsByCat: seedBudget.capsByCat
  };
  const budgetPct = budget.capUsd > 0 ? Math.round(budget.spentUsd / budget.capUsd * 100) : null;
  const budgetWarn = budgetPct != null && budgetPct >= 80 && budgetPct <= 100;
  const budgetOver = budgetPct != null && budgetPct > 100;
  const streak = seed.longestStreak;
  const goal = seed.nearestGoal;
  const tasks = seed.tasksThisWeek || {
    done: 0,
    total: 0
  };
  const fmt = n => Number(n).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU');

  /* Trend: keep prior months on seed, replace CURRENT (last) month
     with derived sum. When no transactions exist (empty mode or fresh
     v1 snapshot pre-migration) fall back to seed entirely. */
  const trendData = useMemoHome(() => {
    const base = seed.last6Months || [];
    if (emptyMode || txAll.length === 0 || base.length === 0) return base;
    const next = base.slice();
    const last = next[next.length - 1];
    next[next.length - 1] = {
      ...last,
      expenses: inTotals
    };
    return next;
  }, [seed.last6Months, emptyMode, txAll.length, inTotals]);

  /* Category breakdown: rebuild from transactions when we have any,
     otherwise fall back to seed. categoryOverrides drops whole rows. */
  const catBreakdown = useMemoHome(() => {
    if (emptyMode || txAll.length === 0) return seed.categoryBreakdown || [];
    return F.byCategory(txAll, overrides);
  }, [emptyMode, txAll, overrides, seed.categoryBreakdown]);
  const allCatsHidden = !emptyMode && F.allCategoriesHidden(overrides, window.LifeExpenseCats || []);
  const cards = useMemoHome(() => [{
    id: 'budget',
    eyebrow: t('home_card_budget'),
    value: budget.capUsd > 0 ? `${budgetPct}%` : null,
    valueClass: budgetOver ? 'is-over' : budgetWarn ? 'is-stakes' : '',
    context: hiddenAmt > 0 && !emptyMode ? t('home_card_budget_derived', fmt(budget.spentUsd), fmt(hiddenAmt)) : t('home_card_budget_ctx', fmt(budget.spentUsd), fmt(budget.capUsd)),
    emptyContext: t('home_card_budget_empty'),
    onClick: () => onNav(budget.capUsd > 0 ? 'finances' : 'settings')
  }, {
    id: 'streak',
    eyebrow: t('home_card_streak'),
    value: streak && streak.days > 0 ? streak.days : null,
    context: streak ? t('home_card_streak_ctx', t(streak.habitKey), streak.days, t.pl('pl_day', streak.days)) : '',
    emptyContext: t('home_card_streak_empty'),
    onClick: () => onNav('habits')
  }, {
    id: 'goal',
    eyebrow: t('home_card_goal'),
    value: goal && goal.pct > 0 ? `${goal.pct}%` : null,
    context: goal ? t(goal.titleKey) : '',
    emptyContext: t('home_card_goal_empty'),
    onClick: () => onNav('goals')
  }, {
    id: 'tasks',
    eyebrow: t('home_card_tasks'),
    value: tasks.total > 0 ? `${tasks.done} / ${tasks.total}` : null,
    context: t('home_card_tasks_ctx'),
    emptyContext: t('home_card_tasks_empty'),
    onClick: () => onNav('tasks')
  }], [t, locale, budget, budgetPct, budgetWarn, budgetOver, streak, goal, tasks, onNav, hiddenAmt, emptyMode]);
  return /*#__PURE__*/React.createElement("div", {
    className: "page home-page"
  }, /*#__PURE__*/React.createElement("section", {
    className: "home-hero"
  }, cards.map(c => /*#__PURE__*/React.createElement(window.StatCard, {
    key: c.id,
    eyebrow: c.eyebrow,
    value: c.value,
    valueClass: c.valueClass,
    context: c.context,
    emptyContext: c.emptyContext,
    onClick: c.onClick
  }))), /*#__PURE__*/React.createElement("section", {
    className: "home-charts"
  }, /*#__PURE__*/React.createElement(window.TrendChart, {
    data: emptyMode ? [] : trendData,
    onNav: onNav
  }), /*#__PURE__*/React.createElement(window.CategoryChart, {
    monthData: allCatsHidden ? [] : emptyMode ? [] : catBreakdown,
    days30Data: emptyMode ? [] : seed.categoryBreakdown30d || [],
    capsByCat: seed.budget && seed.budget.capsByCat || {},
    locale: locale,
    allHidden: allCatsHidden,
    allHiddenHint: t('home_cat_all_hidden'),
    onEmptyCta: () => onNav && onNav('finances')
  })));
}
window.HomePage = HomePage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/HomePage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/MedicationsPage.jsx
try { (() => {
/* global React */
/* pages/MedicationsPage.jsx · Sprint 3A Batch 2 rewrite
 *
 * Three-view container for the medications surface:
 *
 *   СПИСОК   — overview grid of MedCards filtered by status chips
 *   ЖУРНАЛ   — global pharm-notes feed (Batch 4 — stub for now)
 *   ИСТОРИЯ  — dose log timeline across all meds (Batch 4 — stub)
 *
 * The previous Sprint 1 read-only list + CYP2D6 interactions table
 * has been retired. CYP2D6 data still lives in data/medications.js
 * for clinical context and may resurface in a future detail tab,
 * but per the architectural decision Life OS is not a clinical
 * decision-support tool. */

const {
  useState: useStateMP,
  useContext: useCtxMP,
  useEffect: useEffMP
} = React;
function MedicationsPage() {
  const data = useCtxMP(window.LifeDataContext);
  const {
    t,
    locale
  } = useCtxMP(window.LifeLocaleContext);
  const I = window.LIcons;
  const [view, setView] = useStateMP('list'); // list | journal | history
  const [filter, setFilter] = useStateMP('active');
  const [takeMed, setTakeMed] = useStateMP(null);
  const [refillMed, setRefMed] = useStateMP(null);
  const [configMed, setCfgMed] = useStateMP(null);

  /* Hash-based sub-route. /medications/{id} opens MedDetailPage
     (Batch 4 — for now we render a small inline placeholder so the
     navigation contract holds). */
  const [subId, setSubId] = useStateMP(() => parseSubRoute());
  useEffMP(() => {
    function onHash() {
      setSubId(parseSubRoute());
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  function openDetail(id) {
    window.location.hash = '#/medications/' + id;
  }
  function closeDetail() {
    window.location.hash = '#/medications';
  }
  if (subId) {
    if (window.MedDetailPage) {
      return /*#__PURE__*/React.createElement(window.MedDetailPage, {
        medId: subId,
        onBack: closeDetail
      });
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "page meds-page"
    }, /*#__PURE__*/React.createElement("button", {
      className: "medc-refill mono",
      onClick: closeDetail
    }, "\u2190 ", t('meds_view_list')), /*#__PURE__*/React.createElement("div", {
      className: "ph-card meds-ph"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ph-eyebrow mono"
    }, "med \xB7 ", subId), /*#__PURE__*/React.createElement("div", {
      className: "ph-body"
    }, "Sprint 3A Batch 4: \u0434\u0435\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D \u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u0430.")));
  }
  const meds = data.state.medications || [];
  const filtered = meds.filter(m => {
    if (filter === 'all') return m.status !== 'archived';
    if (filter === 'active') return m.status === 'active';
    if (filter === 'inactive') return m.status === 'inactive';
    if (filter === 'planned') return m.status === 'planned' || m.status === 'considering';
    return true;
  });
  const order = {
    active: 0,
    planned: 1,
    considering: 2,
    inactive: 3,
    archived: 4
  };
  const sorted = filtered.slice().sort((a, b) => {
    const s = (order[a.status] ?? 9) - (order[b.status] ?? 9);
    if (s !== 0) return s;
    return (a.is_supplement ? 1 : 0) - (b.is_supplement ? 1 : 0);
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "page meds-page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, t('meds_title')), /*#__PURE__*/React.createElement("div", {
    className: "page-sub mono"
  }, filtered.length, " \xB7 ", viewLabel(view, t))), /*#__PURE__*/React.createElement("div", {
    className: "meds-view-tabs"
  }, ['list', 'journal', 'history'].map(v => /*#__PURE__*/React.createElement("button", {
    key: v,
    className: "meds-view-tab mono" + (view === v ? " is-on" : ""),
    onClick: () => setView(v)
  }, viewLabel(v, t))))), view === 'list' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "meds-filter-row"
  }, ['active', 'inactive', 'planned', 'all'].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    className: "meds-filter-chip mono" + (filter === f ? " is-on" : ""),
    onClick: () => setFilter(f)
  }, t('meds_filter_' + f)))), /*#__PURE__*/React.createElement("div", {
    className: "medc-grid"
  }, sorted.map(med => /*#__PURE__*/React.createElement(window.MedCard, {
    key: med.id,
    med: med,
    onOpenTake: m => setTakeMed(m),
    onOpenConfig: m => setCfgMed(m),
    onOpenRefill: m => setRefMed(m),
    onOpenDetail: openDetail
  })), sorted.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "meds-empty mono"
  }, "\xB7 \u043D\u0435\u0442 \u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u043E\u0432 \u0432 \u044D\u0442\u043E\u0439 \u0433\u0440\u0443\u043F\u043F\u0435 \xB7"))), view === 'journal' && (window.GlobalJournal ? /*#__PURE__*/React.createElement(window.GlobalJournal, null) : /*#__PURE__*/React.createElement("div", {
    className: "ph-card meds-ph"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ph-eyebrow mono"
  }, "\u0416\u0423\u0420\u041D\u0410\u041B \xB7 BATCH 4"), /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, "\u0413\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0439 \u0444\u0438\u0434 pharm-notes \u2014 Sprint 3A Batch 4."))), view === 'history' && /*#__PURE__*/React.createElement("div", {
    className: "meds-history-view"
  }, /*#__PURE__*/React.createElement(window.ActivityTimeline, {
    entityType: null,
    entityId: null,
    filter: e => e.entity_type === 'med_dose' || e.entity_type === 'med_config' || e.entity_type === 'mode_style',
    emptyKey: "atl_empty",
    limit: 200
  })), takeMed && /*#__PURE__*/React.createElement(window.TakeDoseModal, {
    med: takeMed,
    onClose: () => setTakeMed(null)
  }), refillMed && /*#__PURE__*/React.createElement(window.RefillModal, {
    med: refillMed,
    onClose: () => setRefMed(null)
  }), configMed && window.MedConfigDrawer && /*#__PURE__*/React.createElement(window.MedConfigDrawer, {
    med: configMed,
    onClose: () => setCfgMed(null)
  }), configMed && !window.MedConfigDrawer && /*#__PURE__*/React.createElement("div", {
    className: "qa-backdrop",
    onMouseDown: () => setCfgMed(null)
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-modal",
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-eyebrow mono"
  }, "config \xB7 ", configMed.id), /*#__PURE__*/React.createElement("button", {
    className: "qa-close",
    onClick: () => setCfgMed(null)
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "ph-body",
    style: {
      padding: 12
    }
  }, "Sprint 3A Batch 3 \u043D\u0430\u043F\u043E\u043B\u043D\u0438\u0442 \u044D\u0442\u043E\u0442 drawer."))));
}
function parseSubRoute() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '');
  if (!raw.startsWith('medications/')) return null;
  const id = raw.slice('medications/'.length);
  return id || null;
}
function viewLabel(view, t) {
  if (view === 'list') return t('meds_view_list');
  if (view === 'journal') return t('meds_view_journal');
  if (view === 'history') return t('meds_view_history');
  return view;
}
window.MedicationsPage = MedicationsPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/MedicationsPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/PlaceholderPage.jsx
try { (() => {
/* global React */
/* Generic placeholder page used for routes whose body lands in a later
   sprint (e.g. home stats, medications tracker, investments). */
function PlaceholderPage({
  title,
  body
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ph-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ph-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ph-eyebrow mono"
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "ph-body"
  }, body)));
}
window.PlaceholderPage = PlaceholderPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/PlaceholderPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/ProfilePage.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxPP
} = React;

/* Profile / Me page.
   Cards are individual components under profile/cards/. To add a new
   card: write the component, mount it onto window, and add one line
   to the CARDS array below. Each card receives its slice of profile
   data + an update callback that does a shallow merge into that slice. */
function ProfilePage({
  profile,
  onUpdate
}) {
  const {
    t
  } = useCtxPP(window.LifeLocaleContext);
  const CARDS = [{
    id: 'identity',
    comp: window.IdentityCard,
    slice: 'identity'
  }, {
    id: 'body',
    comp: window.BodyMetricsCard,
    slice: 'body'
  }, {
    id: 'measurements',
    comp: window.MeasurementsCard,
    slice: 'measurements'
  }, {
    id: 'sizes',
    comp: window.ClothingSizesCard,
    slice: 'sizes'
  }, {
    id: 'food',
    comp: window.FoodPreferencesCard,
    slice: 'food'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "page profile-page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, t('profile_title')), /*#__PURE__*/React.createElement("div", {
    className: "page-sub mono"
  }, t('profile_subtitle')))), /*#__PURE__*/React.createElement("div", {
    className: "profile-cards"
  }, CARDS.map(c => {
    const Comp = c.comp;
    if (!Comp) return null;
    return /*#__PURE__*/React.createElement(Comp, {
      key: c.id,
      data: profile[c.slice],
      onChange: patch => onUpdate(c.slice, patch)
    });
  })), /*#__PURE__*/React.createElement("button", {
    className: "profile-add-section",
    disabled: true,
    title: t('profile_add_disabled')
  }, t('profile_add_section')));
}
window.ProfilePage = ProfilePage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/ProfilePage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/QuickNotesPage.jsx
try { (() => {
/* global React */
const {
  useState: useStateQN,
  useRef: useRefQN,
  useContext: useCtxQN
} = React;

/* Quick Notes — raw-capture surface.
   Type, hit enter, row appears. No category, no priority, no time. Each
   note has a timestamp + actions to "promote" (open quick-add modal pre-
   filled) or delete. Notes don't show up on home / calendar / anywhere
   else until promoted. */
function QuickNotesPage({
  notes,
  onAdd,
  onDelete,
  onPromote
}) {
  const {
    t
  } = useCtxQN(window.LifeLocaleContext);
  const I = window.LIcons;
  const [draft, setDraft] = useStateQN('');
  const inputRef = useRefQN(null);
  function commit(e) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft('');
    /* keep focus — fast capture */
    inputRef.current && inputRef.current.focus();
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "page qn-page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, t('qn_title')), /*#__PURE__*/React.createElement("div", {
    className: "page-sub mono"
  }, t('qn_subtitle'))), /*#__PURE__*/React.createElement("span", {
    className: "page-count mono"
  }, notes.length)), /*#__PURE__*/React.createElement("form", {
    className: "qn-input",
    onSubmit: commit
  }, /*#__PURE__*/React.createElement("span", {
    className: "qn-input-prefix"
  }, I.plus({
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    className: "qn-input-field",
    autoFocus: true,
    value: draft,
    onChange: e => setDraft(e.target.value),
    placeholder: t('qn_placeholder')
  }), draft.trim() && /*#__PURE__*/React.createElement("span", {
    className: "qn-input-hint mono"
  }, "\u21B5")), notes.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "qn-empty"
  }, t('qn_empty')) : /*#__PURE__*/React.createElement("ul", {
    className: "qn-list"
  }, notes.map(n => /*#__PURE__*/React.createElement("li", {
    key: n.id,
    className: "qn-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qn-item-time mono"
  }, n.at), /*#__PURE__*/React.createElement("span", {
    className: "qn-item-text"
  }, n.text), /*#__PURE__*/React.createElement("div", {
    className: "qn-item-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qn-item-btn",
    onClick: () => onPromote(n),
    title: t('qn_promote_full')
  }, I.arrowUpRight({
    size: 14
  }), /*#__PURE__*/React.createElement("span", null, t('qn_promote'))), /*#__PURE__*/React.createElement("button", {
    className: "qn-item-btn is-danger",
    onClick: () => onDelete(n.id),
    title: t('qn_delete'),
    "aria-label": t('qn_delete')
  }, I.trash({
    size: 14
  })))))));
}
window.QuickNotesPage = QuickNotesPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/QuickNotesPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/RelocatedPages.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxHP
} = React;

/* Habits / Goals / Finances pages — thin wrappers around the existing
   widgets. Habits/Goals/Money were composited together on the old home;
   each gets a dedicated page now. No redesign — just a page header + the
   widget rendered full-width. */
function HabitsPage({
  emptyMode
}) {
  const {
    t
  } = useCtxHP(window.LifeLocaleContext);
  return /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, t('habits_title')))), /*#__PURE__*/React.createElement(window.HabitsGrid, {
    habits: emptyMode ? [] : undefined
  }));
}
function GoalsPage({
  emptyMode
}) {
  const {
    t
  } = useCtxHP(window.LifeLocaleContext);
  return /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, t('goals_title')))), /*#__PURE__*/React.createElement(window.GoalsWidget, {
    goals: emptyMode ? [] : undefined
  }));
}

/* FinancesPage moved to pages/FinancesPage.jsx in Sprint 3B —
   the wrapper around MoneyWidget was too thin to host the per-row
   eye-toggle interaction. MoneyWidget.jsx still ships for any
   future home-dashboard logger context but is no longer rendered. */

window.HabitsPage = HabitsPage;
window.GoalsPage = GoalsPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/RelocatedPages.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/TasksPage.jsx
try { (() => {
/* global React */
const {
  useState: useStateTP,
  useMemo: useMemoTP,
  useContext: useCtxTP
} = React;

/* Tasks tab — master view of every task across routine + stakes.
   Filter chips on the left, sort dropdown on the right. Reuses the same
   task-row markup as the home composite, opens TaskDetailModal on click. */
function TasksPage({
  tasks,
  onToggle,
  onAdd,
  onOpen
}) {
  const {
    t
  } = useCtxTP(window.LifeLocaleContext);
  const I = window.LIcons;
  const [filter, setFilter] = useStateTP('all');
  const [sort, setSort] = useStateTP('date');
  const [sortOpen, setSortOpen] = useStateTP(false);
  const filters = [{
    id: 'all',
    label: t('tasks_filter_all')
  }, {
    id: 'today',
    label: t('tasks_filter_today')
  }, {
    id: 'overdue',
    label: t('tasks_filter_overdue')
  }, {
    id: 'routine',
    label: t('tasks_filter_routine')
  }, {
    id: 'stakes',
    label: t('tasks_filter_stakes')
  }, {
    id: 'done',
    label: t('tasks_filter_done')
  }];
  const sorts = [{
    id: 'date',
    label: t('tasks_sort_date')
  }, {
    id: 'priority',
    label: t('tasks_sort_priority')
  }, {
    id: 'category',
    label: t('tasks_sort_category')
  }];
  const filtered = useMemoTP(() => {
    let xs = tasks.slice();
    if (filter === 'today') xs = xs.filter(x => x.tag === 'today' || x.stakes);
    if (filter === 'overdue') xs = xs.filter(x => !x.done && x.due && x.due.includes(':'));
    if (filter === 'routine') xs = xs.filter(x => !x.stakes && !x.done);
    if (filter === 'stakes') xs = xs.filter(x => x.stakes && !x.done);
    if (filter === 'done') xs = xs.filter(x => x.done);
    if (sort === 'priority') xs.sort((a, b) => (b.stakes ? 1 : 0) - (a.stakes ? 1 : 0));
    if (sort === 'category') xs.sort((a, b) => String(a.tag || '').localeCompare(String(b.tag || '')));
    return xs;
  }, [tasks, filter, sort]);
  const openCount = tasks.filter(x => !x.done).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "page tasks-page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, t('tasks_page_title')), /*#__PURE__*/React.createElement("div", {
    className: "page-sub mono"
  }, t('tasks_page_meta', openCount, tasks.length), " \xB7 ", t.pl('pl_task', openCount)))), /*#__PURE__*/React.createElement("div", {
    className: "tasks-toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tasks-chips"
  }, filters.map(f => /*#__PURE__*/React.createElement("button", {
    key: f.id,
    className: "tasks-chip" + (filter === f.id ? " is-on" : ""),
    onClick: () => setFilter(f.id)
  }, f.label))), /*#__PURE__*/React.createElement("div", {
    className: "tasks-sort"
  }, /*#__PURE__*/React.createElement("button", {
    className: "tasks-sort-trigger mono",
    onClick: () => setSortOpen(o => !o)
  }, /*#__PURE__*/React.createElement("span", null, t('tasks_sort_label'), ": ", sorts.find(s => s.id === sort).label), /*#__PURE__*/React.createElement(I.chevDown, {
    size: 12
  })), sortOpen && /*#__PURE__*/React.createElement("div", {
    className: "tasks-sort-pop",
    onMouseLeave: () => setSortOpen(false)
  }, sorts.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    className: "tasks-sort-opt" + (sort === s.id ? " is-on" : ""),
    onClick: () => {
      setSort(s.id);
      setSortOpen(false);
    }
  }, s.label))))), filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, t('tasks_empty')) : /*#__PURE__*/React.createElement("section", {
    className: "card panel tasks-list-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "task-list"
  }, filtered.map(task => /*#__PURE__*/React.createElement("div", {
    key: task.id,
    className: "task-row" + (task.stakes ? " is-stakes" : "")
  }, /*#__PURE__*/React.createElement("button", {
    className: "task-check" + (task.done ? " is-done" : ""),
    onClick: () => onToggle(task.id)
  }, task.done && I.check({
    size: 12
  })), /*#__PURE__*/React.createElement("button", {
    className: "task-title task-title-btn" + (task.done ? " is-done" : ""),
    onClick: () => onOpen && onOpen(task)
  }, task.title), /*#__PURE__*/React.createElement("div", {
    className: "task-meta"
  }, (task.tag || task.tagLabel) && /*#__PURE__*/React.createElement("span", {
    className: "task-tag" + (task.stakes ? " is-stakes" : "")
  }, task.tagLabel || t('tag_' + task.tag, task.tag)), task.due && /*#__PURE__*/React.createElement("span", {
    className: "task-due mono"
  }, task.due)))))));
}
window.TasksPage = TasksPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/TasksPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/calendar/DayDetailModal.jsx
try { (() => {
/* global React */
const {
  useEffect: useEffectDDM,
  useContext: useCtxDDM,
  useRef: useRefDDM
} = React;

/* Sprint 3B · DayDetailModal
   Opens when the user clicks "+ N ещё" overflow on a day cell. Renders
   the full event list for that day with slightly larger pills (22px,
   text-md title). Esc closes. Footer button funnels to QuickAdd
   pre-filled with the date. */
function DayDetailModal({
  date,
  events,
  onClose,
  onAddEvent,
  onOpenEvent
}) {
  const {
    t,
    locale
  } = useCtxDDM(window.LifeLocaleContext);
  const I = window.LIcons;
  const closeRef = useRefDDM(null);
  useEffectDDM(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose && onClose();
    }
    window.addEventListener('keydown', onKey);
    if (closeRef.current) closeRef.current.focus();
    /* Prevent body scroll while the modal is up. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);
  if (!date) return null;
  const intlLoc = window.LifeStrings[locale]._intl_locale;
  const fullDate = date.toLocaleDateString(intlLoc, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "qa-backdrop",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-modal modal-day",
    onMouseDown: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("header", {
    className: "modal-day-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-day-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-day-eyebrow mono"
  }, date.toLocaleDateString(intlLoc, {
    year: 'numeric'
  })), /*#__PURE__*/React.createElement("h3", {
    className: "modal-day-h"
  }, fullDate)), /*#__PURE__*/React.createElement("button", {
    className: "qa-close",
    onClick: onClose,
    ref: closeRef,
    "aria-label": "close"
  }, I.x ? /*#__PURE__*/React.createElement(I.x, {
    size: 16
  }) : '×')), /*#__PURE__*/React.createElement("div", {
    className: "modal-day-body"
  }, events.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, t('cal_quiet_day')) : /*#__PURE__*/React.createElement("ul", {
    className: "modal-day-list"
  }, events.map(ev => {
    const kindClass = ev.kind === 'stakes' ? ' is-stakes' : ev.kind === 'routine' ? ' is-routine' : ' is-info';
    return /*#__PURE__*/React.createElement("li", {
      key: ev.id
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "cal-pill cal-pill-lg" + kindClass,
      onClick: () => onOpenEvent && onOpenEvent(ev)
    }, /*#__PURE__*/React.createElement("span", {
      className: "cal-pill-bar",
      "aria-hidden": "true"
    }), /*#__PURE__*/React.createElement("span", {
      className: "cal-pill-time mono"
    }, ev.time), /*#__PURE__*/React.createElement("span", {
      className: "cal-pill-title"
    }, ev.title), /*#__PURE__*/React.createElement("span", {
      className: "cal-pill-src mono"
    }, ev.source || '')));
  }))), /*#__PURE__*/React.createElement("footer", {
    className: "modal-day-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "modal-day-add",
    onClick: onAddEvent
  }, "+ ", t('cal_add_event')))));
}
window.DayDetailModal = DayDetailModal;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/calendar/DayDetailModal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/home/CategoryChart.jsx
try { (() => {
/* global React */
const {
  useState: useStCat,
  useContext: useCtxCat,
  useMemo: useMemoCat
} = React;

/* CategoryChart — horizontal width-percent bars (NOT a chart-library task).

   Layout per row:
     · icon (--icon-sm) · category name · amount (mono, right-aligned)
     · bar 3px tall underneath, width relative to LARGEST visible row.

   Filter chip: month (default) | 30 days — for Sprint 2 both filters
   point at seed (visual control works, no real 30-day aggregation yet).

   Truncation: top 6, remaining collapse to "+ N других" row using sum.

   Orange-stakes rule:
     · Any row where amount / capsByCat[catId] ≥ 0.80 qualifies.
     · Exactly ONE row gets the orange treatment per chart — the one
       with the highest utilization. Others stay blue.
*/
function CategoryChart({
  monthData,
  days30Data,
  capsByCat,
  locale,
  onEmptyCta,
  allHidden,
  allHiddenHint
}) {
  const {
    t
  } = useCtxCat(window.LifeLocaleContext);
  const [window_, setWindow] = useStCat('month');
  const I = window.LIcons;
  const raw = window_ === 'month' ? monthData : days30Data;

  /* ── Sprint 3B · extreme empty state: every category hidden ──── */
  if (allHidden) {
    return /*#__PURE__*/React.createElement(window.ChartCard, {
      eyebrow: t('chart_categories_title'),
      total: null,
      controls: /*#__PURE__*/React.createElement(FilterChips, {
        value: window_,
        setValue: setWindow,
        a: {
          id: 'month',
          label: t('chart_filter_month')
        },
        b: {
          id: '30d',
          label: t('chart_filter_30')
        }
      })
    }, /*#__PURE__*/React.createElement("div", {
      className: "chart-empty"
    }, /*#__PURE__*/React.createElement("div", {
      className: "chart-empty-msg"
    }, allHiddenHint || t('chart_empty_cat'))));
  }

  /* ── 0-data empty state ──────────────────────────────── */
  if (!raw || raw.length === 0) {
    return /*#__PURE__*/React.createElement(window.ChartCard, {
      eyebrow: t('chart_categories_title'),
      total: null,
      controls: /*#__PURE__*/React.createElement(FilterChips, {
        value: window_,
        setValue: setWindow,
        a: {
          id: 'month',
          label: t('chart_filter_month')
        },
        b: {
          id: '30d',
          label: t('chart_filter_30')
        }
      })
    }, /*#__PURE__*/React.createElement("div", {
      className: "chart-empty"
    }, /*#__PURE__*/React.createElement("div", {
      className: "chart-empty-msg"
    }, t('chart_empty_cat'))));
  }

  /* ── sort descending, take top 6 + "others" ──────────── */
  const sorted = raw.slice().sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  const othersSum = rest.reduce((s, r) => s + r.amount, 0);

  /* visible rows include the others-aggregate row if applicable */
  const visible = top.map(r => ({
    ...r,
    isOthers: false
  }));
  if (rest.length > 0) {
    visible.push({
      catId: '__others',
      amount: othersSum,
      othersCount: rest.length,
      isOthers: true
    });
  }
  const maxVisible = Math.max(...visible.map(r => r.amount), 1);
  const total = visible.reduce((s, r) => s + r.amount, 0);

  /* ── orange-stakes pick: highest-utilization row ≥ 80% (top rows only) */
  const caps = capsByCat || {};
  let orangeId = null;
  let orangeUtil = -1;
  top.forEach(r => {
    const cap = caps[r.catId];
    if (!cap || cap <= 0) return;
    const util = r.amount / cap;
    if (util >= 0.80 && util > orangeUtil) {
      orangeUtil = util;
      orangeId = r.catId;
    }
  });
  const cats = window.LifeCategories || [];
  const catLookup = {};
  cats.forEach(c => {
    catLookup[c.id] = c;
  });
  const fmt = n => '$' + Math.round(n).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU');
  return /*#__PURE__*/React.createElement(window.ChartCard, {
    eyebrow: t('chart_categories_title'),
    total: fmt(total),
    controls: /*#__PURE__*/React.createElement(FilterChips, {
      value: window_,
      setValue: setWindow,
      a: {
        id: 'month',
        label: t('chart_filter_month')
      },
      b: {
        id: '30d',
        label: t('chart_filter_30')
      }
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "cat-list"
  }, visible.map(row => {
    const isOrange = !row.isOthers && row.catId === orangeId;
    const cat = catLookup[row.catId];
    const name = row.isOthers ? t('chart_others', row.othersCount) : cat ? cat.name[locale] || cat.name.ru : row.catId;
    const Icon = row.isOthers ? I && I.moreHorizontal : cat && I && I[cat.icon];
    const pct = row.amount / maxVisible * 100;
    return /*#__PURE__*/React.createElement("div", {
      key: row.catId,
      className: "cat-row" + (isOrange ? ' is-stakes' : '') + (row.isOthers ? ' is-others' : '')
    }, /*#__PURE__*/React.createElement("div", {
      className: "cat-row-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "cat-row-icon"
    }, Icon ? /*#__PURE__*/React.createElement(Icon, {
      size: 12
    }) : /*#__PURE__*/React.createElement("span", {
      className: "cat-row-icon-dot"
    })), /*#__PURE__*/React.createElement("span", {
      className: "cat-row-name"
    }, name), /*#__PURE__*/React.createElement("span", {
      className: "cat-row-amt mono"
    }, fmt(row.amount))), /*#__PURE__*/React.createElement("div", {
      className: "cat-row-bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cat-row-bar-fill",
      style: {
        width: pct + '%'
      }
    })));
  })));
}
function FilterChips({
  value,
  setValue,
  a,
  b
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "chart-segctrl is-quiet"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "chart-segctrl-btn mono" + (value === a.id ? ' is-on' : ''),
    onClick: () => setValue(a.id)
  }, a.label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "chart-segctrl-btn mono" + (value === b.id ? ' is-on' : ''),
    onClick: () => setValue(b.id)
  }, b.label));
}
window.CategoryChart = CategoryChart;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/home/CategoryChart.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/home/ChartCard.jsx
try { (() => {
/* global React */
/* ChartCard — shared wrapper for both trend + category charts.
   Layout:
     · eyebrow (mono uppercase --text-xs)
     · big total beneath (--text-2xl, mono)
     · optional control row (toggle / filter chip)
     · body fills the remainder
     · optional footer (muted line — partial-data warning etc) */
function ChartCard({
  eyebrow,
  total,
  controls,
  children,
  footer,
  variant
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "chart-card" + (variant ? ' is-' + variant : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "chart-card-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chart-card-eyebrow mono"
  }, eyebrow), total != null && /*#__PURE__*/React.createElement("div", {
    className: "chart-card-total mono"
  }, total)), controls && /*#__PURE__*/React.createElement("div", {
    className: "chart-card-controls"
  }, controls), /*#__PURE__*/React.createElement("div", {
    className: "chart-card-body"
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "chart-card-footer mono"
  }, footer));
}
window.ChartCard = ChartCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/home/ChartCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/home/StatCard.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxSC
} = React;

/* StatCard — one glanceable number, one context line, one mono eyebrow.
   No progress bars, no sub-breakdowns. Clicking navigates to the
   dedicated tab via the onClick passed in by the page.

   Props:
     eyebrow       — mono uppercase top label
     value         — big number (or null when empty)
     valueClass    — extra class to apply to the value (e.g. "is-stakes"
                     for orange, "is-over" for red)
     context       — small line below the number
     emptyContext  — context line when value is null (rendered muted)
     onClick       — navigate callback */
function StatCard({
  eyebrow,
  value,
  valueClass,
  context,
  emptyContext,
  onClick
}) {
  const empty = value == null || value === '' || value === '—';
  return /*#__PURE__*/React.createElement("button", {
    className: "stat-card" + (empty ? " is-empty" : ""),
    onClick: onClick,
    type: "button"
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat-eyebrow mono"
  }, eyebrow), /*#__PURE__*/React.createElement("span", {
    className: "stat-value mono" + (valueClass ? ' ' + valueClass : '')
  }, empty ? '—' : value), /*#__PURE__*/React.createElement("span", {
    className: "stat-context" + (empty ? ' is-empty' : '')
  }, empty ? emptyContext || '' : context));
}
window.StatCard = StatCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/home/StatCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/home/TrendChart.jsx
try { (() => {
/* global React */
const {
  useState: useStTrend,
  useContext: useCtxTrend,
  useMemo: useMemoTrend
} = React;

/* TrendChart — last 6 months, three series toggle (расходы / доходы / нетто).
   Native SVG only — no Recharts (per ARCHITECTURE.md locked decision).

   Series colors (stakes discipline, blues + neutral only):
     expenses → --blue
     income   → --blue-3 (blue-deep)
     net      → --fg3 (muted), thinner area (opacity 0.05)

   Big total = the LAST month of the selected series (NOT sum of 6).

   Empty states:
     · 0 months → empty CTA card
     · 1-2 months → render chart + muted footer
*/
function TrendChart({
  data,
  onNav
}) {
  const {
    t,
    locale
  } = useCtxTrend(window.LifeLocaleContext);
  const [series, setSeries] = useStTrend('expenses');
  const [hover, setHover] = useStTrend(null);

  /* ── 0-data empty state ───────────────────────────────── */
  if (!data || data.length === 0) {
    return /*#__PURE__*/React.createElement(window.ChartCard, {
      eyebrow: t('chart_trend_title'),
      total: null
    }, /*#__PURE__*/React.createElement("div", {
      className: "chart-empty"
    }, /*#__PURE__*/React.createElement("div", {
      className: "chart-empty-msg"
    }, t('chart_empty_cat')), /*#__PURE__*/React.createElement("button", {
      className: "chart-empty-cta mono",
      onClick: () => onNav && onNav('finances')
    }, t('chart_empty_trend_cta'))));
  }

  /* ── value extraction per selected series ─────────────── */
  const valueOf = m => series === 'net' ? m.income - m.expenses : series === 'income' ? m.income : m.expenses;
  const values = data.map(valueOf);
  const lastVal = values[values.length - 1];

  /* For 1-2 months we still render the chart, but footer warns. */
  const partial = data.length < 3;

  /* ── scale: clamp Y to data range; net can go negative → include 0 */
  const minV = series === 'net' ? Math.min(0, ...values) : Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const W = 600,
    H = 220,
    padX = 28,
    padTop = 18,
    padBot = 32;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBot;
  const xAt = i => data.length === 1 ? W / 2 : padX + innerW * i / (data.length - 1);
  const yAt = v => padTop + innerH - (v - minV) / range * innerH;
  const points = data.map((m, i) => `${xAt(i).toFixed(2)},${yAt(values[i]).toFixed(2)}`).join(' ');
  const baselineY = padTop + innerH;
  const areaPath = data.length === 1 ? null : `M${xAt(0).toFixed(2)},${baselineY} ` + data.map((m, i) => `L${xAt(i).toFixed(2)},${yAt(values[i]).toFixed(2)}`).join(' ') + ` L${xAt(data.length - 1).toFixed(2)},${baselineY} Z`;
  const seriesClass = series === 'expenses' ? 'is-expenses' : series === 'income' ? 'is-income' : 'is-net';
  const fmt = n => '$' + Math.round(n).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU');

  /* ── tooltip position (CSS %, scales with SVG aspect) ── */
  const tipLeftPct = hover != null ? xAt(hover) / W * 100 : 0;
  const tipTopPct = hover != null ? yAt(values[hover]) / H * 100 : 0;
  return /*#__PURE__*/React.createElement(window.ChartCard, {
    eyebrow: t('chart_trend_title'),
    total: fmt(lastVal),
    controls: /*#__PURE__*/React.createElement("div", {
      className: "chart-segctrl"
    }, [{
      id: 'expenses',
      label: t('chart_toggle_expenses')
    }, {
      id: 'income',
      label: t('chart_toggle_income')
    }, {
      id: 'net',
      label: t('chart_toggle_net')
    }].map(seg => /*#__PURE__*/React.createElement("button", {
      key: seg.id,
      type: "button",
      className: "chart-segctrl-btn mono" + (series === seg.id ? ' is-on' : ''),
      onClick: () => setSeries(seg.id)
    }, seg.label))),
    footer: partial ? t('chart_empty_trend') : null
  }, /*#__PURE__*/React.createElement("div", {
    className: "trend-chart " + seriesClass
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "none",
    className: "trend-svg"
  }, areaPath && /*#__PURE__*/React.createElement("path", {
    d: areaPath,
    className: "trend-area"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: points,
    className: "trend-line"
  }), data.map((m, i) => /*#__PURE__*/React.createElement("circle", {
    key: 'd' + i,
    cx: xAt(i),
    cy: yAt(values[i]),
    r: hover === i ? 4 : 2.5,
    className: "trend-dot" + (hover === i ? ' is-hov' : '')
  })), data.map((m, i) => /*#__PURE__*/React.createElement("text", {
    key: 'l' + i,
    x: xAt(i),
    y: H - 8,
    className: "trend-xlabel mono",
    textAnchor: "middle"
  }, m['label_' + locale] || m.label_ru)), data.map((m, i) => {
    const halfStep = innerW / Math.max(1, data.length - 1) / 2;
    return /*#__PURE__*/React.createElement("rect", {
      key: 'h' + i,
      x: xAt(i) - halfStep,
      y: 0,
      width: halfStep * 2,
      height: H - padBot + 8,
      fill: "transparent",
      onMouseEnter: () => setHover(i),
      onMouseLeave: () => setHover(null)
    });
  })), hover != null && /*#__PURE__*/React.createElement("div", {
    className: "trend-tooltip mono",
    style: {
      left: tipLeftPct + '%',
      top: tipTopPct + '%'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "trend-tooltip-label"
  }, data[hover]['label_' + locale] || data[hover].label_ru), /*#__PURE__*/React.createElement("span", {
    className: "trend-tooltip-val"
  }, fmt(values[hover])))));
}
window.TrendChart = TrendChart;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/home/TrendChart.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/medications/GlobalJournal.jsx
try { (() => {
/* global React */
/* pages/medications/GlobalJournal.jsx · Sprint 3A Batch 4
 *
 * Global pharm-notes feed for /medications · ЖУРНАЛ view. Combines
 * pharmNotes[*] across every medication, sorted reverse-chronological,
 * with per-med chip filter, polarity filter (all / + only / − only),
 * and full-text search. Hover row to edit/delete (same UX as the
 * per-med PharmNotes component). */

const {
  useState: useStateGJ,
  useContext: useCtxGJ,
  useMemo: useMemoGJ
} = React;
function GlobalJournal() {
  const data = useCtxGJ(window.LifeDataContext);
  const {
    t,
    locale
  } = useCtxGJ(window.LifeLocaleContext);
  const meds = data.state.medications || [];
  const pharm = data.state.pharmNotes || {};

  /* default: all meds selected (empty set = all in our UX convention) */
  const [selectedMeds, setSelectedMeds] = useStateGJ([]);
  const [polarity, setPolarity] = useStateGJ('all');
  const [search, setSearch] = useStateGJ('');
  function toggleMed(id) {
    setSelectedMeds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }
  const allMedsActive = meds.filter(m => m.status !== 'archived');
  const allNotes = useMemoGJ(() => {
    const rows = [];
    for (const med of allMedsActive) {
      const list = pharm[med.id] || [];
      const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
      for (const n of list) rows.push({
        ...n,
        medId: med.id,
        medName
      });
    }
    rows.sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      return tb - ta;
    });
    return rows;
  }, [pharm, allMedsActive, locale]);
  const filtered = useMemoGJ(() => {
    return allNotes.filter(n => {
      if (selectedMeds.length > 0 && !selectedMeds.includes(n.medId)) return false;
      if (polarity === '+' && n.polarity !== '+') return false;
      if (polarity === '-' && n.polarity !== '-') return false;
      if (search && !n.text.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allNotes, selectedMeds, polarity, search]);
  const intlLoc = window.LifeStrings[locale] && window.LifeStrings[locale]._intl_locale || 'ru-RU';
  return /*#__PURE__*/React.createElement("div", {
    className: "gj"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gj-filters"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gj-chip-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "meds-filter-chip mono" + (selectedMeds.length === 0 ? " is-on" : ""),
    onClick: () => setSelectedMeds([])
  }, t('meds_filter_all')), allMedsActive.map(med => {
    const name = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
    return /*#__PURE__*/React.createElement("button", {
      key: med.id,
      className: "meds-filter-chip mono" + (selectedMeds.includes(med.id) ? " is-on" : ""),
      onClick: () => toggleMed(med.id)
    }, name);
  })), /*#__PURE__*/React.createElement("div", {
    className: "gj-controls"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gj-pol-toggle"
  }, /*#__PURE__*/React.createElement("button", {
    className: "gj-pol mono" + (polarity === 'all' ? " is-on" : ""),
    onClick: () => setPolarity('all')
  }, t('gj_filter_all')), /*#__PURE__*/React.createElement("button", {
    className: "gj-pol pn-pol-plus mono" + (polarity === '+' ? " is-on" : ""),
    onClick: () => setPolarity('+')
  }, t('gj_filter_plus')), /*#__PURE__*/React.createElement("button", {
    className: "gj-pol pn-pol-minus mono" + (polarity === '-' ? " is-on" : ""),
    onClick: () => setPolarity('-')
  }, t('gj_filter_minus'))), /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "tdm-input gj-search",
    placeholder: t('gj_search_ph'),
    value: search,
    onChange: e => setSearch(e.target.value)
  }))), /*#__PURE__*/React.createElement("ul", {
    className: "gj-list pn-list"
  }, filtered.length === 0 && /*#__PURE__*/React.createElement("li", {
    className: "pn-empty mono"
  }, t('gj_empty')), filtered.map(n => {
    const when = new Date(n.date).toLocaleDateString(intlLoc, {
      day: '2-digit',
      month: '2-digit'
    });
    return /*#__PURE__*/React.createElement("li", {
      key: n.medId + '/' + n.id,
      className: "pn-row pn-row-" + (n.polarity === '+' ? 'plus' : 'minus')
    }, /*#__PURE__*/React.createElement("span", {
      className: "pn-row-mark pn-row-mark-" + (n.polarity === '+' ? 'plus' : 'minus')
    }, n.polarity === '+' ? '+' : '−'), /*#__PURE__*/React.createElement("span", {
      className: "pn-row-date mono"
    }, when), /*#__PURE__*/React.createElement("span", {
      className: "gj-row-med mono"
    }, n.medName), /*#__PURE__*/React.createElement("span", {
      className: "pn-row-text"
    }, n.text), /*#__PURE__*/React.createElement("div", {
      className: "pn-row-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "pn-row-act pn-row-act-del mono",
      onClick: () => data.deletePharmNote(n.medId, n.id)
    }, t('pn_delete'))));
  })));
}
window.GlobalJournal = GlobalJournal;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/medications/GlobalJournal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/medications/MedCard.jsx
try { (() => {
/* global React */
/* pages/medications/MedCard.jsx · Sprint 3A Batch 2
 *
 * Per-medication card with 3 live timers, action row, inventory chip.
 * Clicking the card body opens the per-med detail page (Batch 4).
 * Clicking [принял] opens TakeDoseModal; [⚙] opens MedConfigDrawer (Batch 3).
 *
 * Timers tick once per 30s via the useNow hook. The two static timers
 * (t½, full elimination) recompute on the same tick — cheap, keeps
 * code branchless. */

const {
  useState: useStateMC,
  useEffect: useEffectMC,
  useContext: useCtxMC
} = React;
function useNow(intervalMs) {
  const [now, setNow] = useStateMC(() => Date.now());
  useEffectMC(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs || 30000);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
function MedCard({
  med,
  onOpenTake,
  onOpenConfig,
  onOpenRefill,
  onOpenDetail
}) {
  const data = useCtxMC(window.LifeDataContext);
  const {
    t,
    locale
  } = useCtxMC(window.LifeLocaleContext);
  const M = window.LifeMedMath;
  const I = window.LIcons;
  const now = useNow(30000);
  const doseLog = data.state.doseLogs[med.id] || [];
  const modeStyle = data.state.modeStyles[med.id] || null;
  const isPRN = modeStyle && modeStyle.type === 'prn';
  const supp = med.is_supplement === true;
  const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
  const unitH = t('meds_unit_h');
  const unitM = t('meds_unit_m');

  /* ── Timers ─────────────────────────────────────────── */
  const nd = M.nextDose(med, doseLog, modeStyle, now);
  const hl = M.halfLifeTimer(med, doseLog, now);
  const fe = M.fullEliminationTimer(med);
  const usual = M.usualTime(doseLog);
  const risk = M.inventoryRisk(med, modeStyle);

  /* ── Role chip (informational, NOT a stakes signal) ── */
  const role = roleChip(med.cyp2d6_role, t);

  /* ── Mode badge in header (steady / titration / PRN) ── */
  const modeBadge = renderModeBadge(modeStyle, t);

  /* Inactive cards (planned/considering/inactive/archived) get
     dimmed treatment and disable timer rendering. Spec lets the
     filter chips control which statuses are visible, so by default
     we only render active ones — but the parent passes whatever
     status the filter resolved to. */
  const inactive = med.status !== 'active';
  const totalDose = med.current_dose_mg_per_day;
  const subtitle = [med.brand_common, role ? role.label : null].filter(Boolean).join(' · ');
  function cardBodyClick(e) {
    if (e.target.closest('.medc-action, .medc-config, .medc-refill, .medc-img')) return;
    if (onOpenDetail) onOpenDetail(med.id);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "medc" + (inactive ? " is-inactive" : ""),
    onClick: cardBodyClick
  }, /*#__PURE__*/React.createElement("div", {
    className: "medc-img"
  }, med.image_path ? /*#__PURE__*/React.createElement("img", {
    src: med.image_path,
    alt: ""
  }) : /*#__PURE__*/React.createElement("div", {
    className: "medc-img-fallback",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement(PillGlyph, null))), /*#__PURE__*/React.createElement("div", {
    className: "medc-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "medc-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "medc-id"
  }, /*#__PURE__*/React.createElement("span", {
    className: "medc-name"
  }, medName), totalDose > 0 && /*#__PURE__*/React.createElement("span", {
    className: "medc-dose mono"
  }, "\xB7 ", totalDose, " \u043C\u0433/\u0434\u0435\u043D\u044C"), supp && /*#__PURE__*/React.createElement("span", {
    className: "medc-supp mono"
  }, "\u0411\u0410\u0414")), modeBadge), /*#__PURE__*/React.createElement("div", {
    className: "medc-sub mono"
  }, subtitle), /*#__PURE__*/React.createElement("div", {
    className: "medc-timers"
  }, isPRN ? /*#__PURE__*/React.createElement("div", {
    className: "medc-timer mono medc-timer-prn"
  }, /*#__PURE__*/React.createElement("span", {
    className: "medc-arrow"
  }, "\u25B8"), " ", t('meds_prn_label')) : nd ? /*#__PURE__*/React.createElement("div", {
    className: "medc-timer mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "medc-arrow"
  }, "\u25B8"), nd.etaMs > 0 ? t('meds_timer_next', M.formatHM(nd.etaMs, unitH, unitM), nd.eta) : t('meds_timer_now')) : /*#__PURE__*/React.createElement("div", {
    className: "medc-timer mono medc-timer-muted"
  }, /*#__PURE__*/React.createElement("span", {
    className: "medc-arrow"
  }, "\u25B8"), " ", t('meds_no_doses_yet')), hl && /*#__PURE__*/React.createElement("div", {
    className: "medc-timer mono medc-timer-muted"
  }, /*#__PURE__*/React.createElement("span", {
    className: "medc-arrow"
  }, "\u25B8"), t('meds_timer_halflife', hl.halfLifeH, hl.exitClock)), fe && /*#__PURE__*/React.createElement("div", {
    className: "medc-timer mono medc-timer-muted"
  }, /*#__PURE__*/React.createElement("span", {
    className: "medc-arrow"
  }, "\u25B8"), fe.useMetabolite ? t('meds_timer_full_ddcar', fe.days, t.pl('pl_meds_day', fe.days)) : t('meds_timer_full', fe.days, t.pl('pl_meds_day', fe.days)))), usual && /*#__PURE__*/React.createElement("div", {
    className: "medc-usual mono"
  }, t('meds_usual_time', usual)), /*#__PURE__*/React.createElement("div", {
    className: "medc-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "medc-action medc-action-take",
    disabled: risk.tier === 'empty',
    onClick: e => {
      e.stopPropagation();
      onOpenTake(med);
    }
  }, t('meds_btn_take')), /*#__PURE__*/React.createElement("button", {
    className: "medc-action medc-action-later",
    onClick: e => {
      e.stopPropagation();
      data.snoozeDose(med.id, 1);
    }
  }, t('meds_btn_later')), /*#__PURE__*/React.createElement("button", {
    className: "medc-action medc-action-skip",
    onClick: e => {
      e.stopPropagation();
      data.skipDose(med.id);
    }
  }, t('meds_btn_skip')), /*#__PURE__*/React.createElement("button", {
    className: "medc-config",
    title: t('meds_btn_config'),
    onClick: e => {
      e.stopPropagation();
      onOpenConfig(med);
    }
  }, I.settings ? I.settings({
    size: 14
  }) : '⚙')), /*#__PURE__*/React.createElement("div", {
    className: "medc-inv medc-inv-" + risk.tier
  }, /*#__PURE__*/React.createElement("span", {
    className: "medc-inv-text mono"
  }, inventoryText(med, risk, t, supp)), risk.chipKey && /*#__PURE__*/React.createElement("span", {
    className: "medc-inv-chip mono medc-inv-chip-" + risk.tier
  }, t(risk.chipKey)), /*#__PURE__*/React.createElement("button", {
    className: "medc-refill mono",
    onClick: e => {
      e.stopPropagation();
      onOpenRefill(med);
    }
  }, t('meds_inv_refill')))));
}
function inventoryText(med, risk, t, supp) {
  const count = med.inventory_count || 0;
  const days = risk.daysLeft != null ? Math.floor(risk.daysLeft) : null;
  if (days == null) return t('meds_inv_label_undef', count);
  const dayWord = t.pl('pl_meds_day', days);
  return supp ? t('meds_inv_label_caps', count, days, dayWord) : t('meds_inv_label', count, days, dayWord);
}
function roleChip(role, t) {
  if (role === 'moderate_inhibitor') return {
    label: t('meds_2d6_inhibitor') + ' · ' + t('meds_2d6_role_moderate')
  };
  if (role === 'weak_inhibitor') return {
    label: t('meds_2d6_inhibitor') + ' · ' + t('meds_2d6_role_weak')
  };
  if (role === 'strong_inhibitor') return {
    label: t('meds_2d6_inhibitor') + ' · ' + t('meds_2d6_role_strong')
  };
  if (role === 'substrate_major') return {
    label: t('meds_2d6_substrate') + ' · ' + t('meds_2d6_role_major')
  };
  if (role === 'substrate') return {
    label: t('meds_2d6_substrate')
  };
  return null;
}
function renderModeBadge(modeStyle, t) {
  if (!modeStyle) return null;
  if (modeStyle.type === 'steady') return /*#__PURE__*/React.createElement("span", {
    className: "medc-mode-badge medc-mode-steady mono"
  }, "steady");
  if (modeStyle.type === 'up') return /*#__PURE__*/React.createElement("span", {
    className: "medc-mode-badge medc-mode-up mono"
  }, "\u2191 titration");
  if (modeStyle.type === 'down') return /*#__PURE__*/React.createElement("span", {
    className: "medc-mode-badge medc-mode-down mono"
  }, "\u2193 taper");
  if (modeStyle.type === 'prn') return /*#__PURE__*/React.createElement("span", {
    className: "medc-mode-badge medc-mode-prn mono"
  }, "prn");
  return null;
}
function PillGlyph() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 48 48",
    width: "44",
    height: "44",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "9",
    y: "18",
    width: "30",
    height: "12",
    rx: "6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "24",
    y1: "18",
    x2: "24",
    y2: "30",
    stroke: "currentColor",
    strokeWidth: "1.6"
  }));
}
window.MedCard = MedCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/medications/MedCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/medications/MedConfigDrawer.jsx
try { (() => {
/* global React */
/* pages/medications/MedConfigDrawer.jsx · Sprint 3A Batch 3
 *
 * Right-side slide-in panel for editing a medication's configuration.
 * Five collapsible sections:
 *   1. ОСНОВНОЕ — status, dose, schedule
 *   2. ИНТЕРВАЛ — dose_interval_h, half_life
 *   3. СТРАТЕГИЯ ПРИЁМА — steady / up / down / prn
 *   4. ЗАПАСЫ — inventory_count, low_stock_threshold_days
 *   5. УДАЛИТЬ ПРЕПАРАТ — soft delete to 'archived'
 *
 * Edits live in local draft state; nothing persists until Save. When
 * the mode strategy changes AND ≥1 other med had mode_changed in the
 * last 7 days, MultiChangeWarningModal interrupts. */

const {
  useState: useStateCD,
  useEffect: useEffectCD,
  useContext: useCtxCD,
  useMemo: useMemoCD
} = React;
function MedConfigDrawer({
  med,
  onClose
}) {
  const data = useCtxCD(window.LifeDataContext);
  const {
    t,
    locale
  } = useCtxCD(window.LifeLocaleContext);
  const I = window.LIcons;

  /* Initial mode style — if none set, infer 'steady' as the default
     so the radio always has a selection. */
  const liveMode = data.state.modeStyles[med.id];
  const [draft, setDraft] = useStateCD(() => ({
    status: med.status || 'active',
    current_dose_mg_per_day: med.current_dose_mg_per_day || 0,
    dose_unit: med.is_supplement ? 'caps' : 'mg',
    doses_per_day: med.doses_per_day || 1,
    schedule: Array.isArray(med.schedule) ? med.schedule.slice() : [],
    dose_interval_h: med.dose_interval_h || 24,
    half_life_h: med.half_life_h || '',
    half_life_active_metabolite_h: med.half_life_active_metabolite_h || '',
    inventory_count: med.inventory_count || 0,
    low_stock_threshold_days: med.low_stock_threshold_days || 7
  }));
  const [mode, setMode] = useStateCD(() => liveMode ? {
    ...liveMode
  } : {
    type: 'steady'
  });
  const [confirmDel, setConfirmDel] = useStateCD(false);
  const [warnState, setWarnState] = useStateCD(null); // null | { recentChanges, onConfirm }

  /* Close on Esc */
  useEffectCD(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
  function patchDraft(p) {
    setDraft(d => ({
      ...d,
      ...p
    }));
  }
  function patchMode(p) {
    setMode(m => ({
      ...m,
      ...p
    }));
  }
  function addScheduleSlot() {
    patchDraft({
      schedule: [...draft.schedule, '08:00']
    });
  }
  function removeScheduleSlot(i) {
    patchDraft({
      schedule: draft.schedule.filter((_, idx) => idx !== i)
    });
  }
  function setScheduleSlot(i, value) {
    patchDraft({
      schedule: draft.schedule.map((s, idx) => idx === i ? value : s)
    });
  }
  function commitAll() {
    /* persist med fields + status */
    data.updateMedication(med.id, {
      status: draft.status,
      current_dose_mg_per_day: Number(draft.current_dose_mg_per_day) || 0,
      doses_per_day: Number(draft.doses_per_day) || 0,
      schedule: draft.schedule.slice(),
      dose_interval_h: Number(draft.dose_interval_h) || null,
      half_life_h: draft.half_life_h === '' ? null : Number(draft.half_life_h),
      half_life_active_metabolite_h: draft.half_life_active_metabolite_h === '' ? null : Number(draft.half_life_active_metabolite_h),
      inventory_count: Number(draft.inventory_count) || 0,
      low_stock_threshold_days: Number(draft.low_stock_threshold_days) || 7
    });
    /* persist mode style if it changed */
    if (modeChanged(liveMode, mode)) {
      data.setModeStyle(med.id, mode);
    }
    onClose();
  }
  function trySave() {
    /* Multi-change warning: only when MODE has changed AND at least one
       OTHER medication had a mode_changed activity in the past 7 days. */
    if (modeChanged(liveMode, mode)) {
      const recent = recentOtherModeChanges(data.state, med.id, locale);
      if (recent.length > 0) {
        setWarnState({
          recentChanges: recent
        });
        return;
      }
    }
    commitAll();
  }
  function deleteSoft() {
    data.deleteMedication(med.id);
    onClose();
  }

  /* Up/down titration preview line — show first 3 stages + target. */
  const titrationPreview = useMemoCD(() => {
    if (mode.type !== 'up' && mode.type !== 'down') return null;
    const start = Number(draft.current_dose_mg_per_day) || 0;
    const target = Number(mode.target_dose_mg) || 0;
    const step = Number(mode.step_size_mg) || 0;
    const interval = Number(mode.step_interval_days) || 0;
    if (!start || !target || !step || !interval) return null;
    const dir = mode.type === 'up' ? 1 : -1;
    const stages = [];
    let v = start;
    let day = 0;
    while (stages.length < 6 && (dir > 0 ? v < target : v > target)) {
      stages.push({
        day,
        dose: v
      });
      v = Math.max(0, v + dir * step);
      day += interval;
    }
    stages.push({
      day,
      dose: target,
      target: true
    });
    return {
      stages,
      totalDays: day,
      target
    };
  }, [mode, draft.current_dose_mg_per_day]);

  /* Progress on titration (mock — driven from modeStyle.startedAt) */
  const titrationProgress = useMemoCD(() => {
    if (!titrationPreview || !liveMode || !liveMode.startedAt) return null;
    const elapsed = (Date.now() - new Date(liveMode.startedAt).getTime()) / 86400000;
    const dayInt = Math.floor(elapsed);
    const total = titrationPreview.totalDays;
    if (total <= 0) return null;
    const stepInterval = Number(mode.step_interval_days) || 7;
    const stageIdx = Math.min(titrationPreview.stages.length - 1, Math.floor(dayInt / stepInterval));
    const stage = titrationPreview.stages[stageIdx];
    return {
      day: dayInt,
      total,
      stage
    };
  }, [titrationPreview, liveMode, mode.step_interval_days]);
  const scheduleMismatch = draft.schedule.length > 0 && draft.schedule.length !== Number(draft.doses_per_day);
  return /*#__PURE__*/React.createElement("div", {
    className: "mcd-backdrop",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("aside", {
    className: "mcd-panel",
    onMouseDown: e => e.stopPropagation(),
    role: "dialog"
  }, /*#__PURE__*/React.createElement("header", {
    className: "mcd-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mcd-eyebrow mono"
  }, t('mcd_title', '').trim()), /*#__PURE__*/React.createElement("h3", {
    className: "mcd-name"
  }, medName)), /*#__PURE__*/React.createElement("button", {
    className: "qa-close",
    onClick: onClose
  }, I.x ? I.x({
    size: 14
  }) : '×')), /*#__PURE__*/React.createElement("div", {
    className: "mcd-body"
  }, /*#__PURE__*/React.createElement(Section, {
    label: t('mcd_sec_basic')
  }, /*#__PURE__*/React.createElement(Row, {
    label: t('mcd_status')
  }, /*#__PURE__*/React.createElement("select", {
    className: "tdm-input mcd-select",
    value: draft.status,
    onChange: e => patchDraft({
      status: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "active"
  }, t('meds_status_active')), /*#__PURE__*/React.createElement("option", {
    value: "inactive"
  }, t('meds_status_inactive')), /*#__PURE__*/React.createElement("option", {
    value: "planned"
  }, t('meds_status_planned')), /*#__PURE__*/React.createElement("option", {
    value: "considering"
  }, t('meds_status_considering')))), /*#__PURE__*/React.createElement(Row, {
    label: t('mcd_dose_current')
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-inline"
  }, /*#__PURE__*/React.createElement("input", {
    className: "tdm-input mcd-num",
    type: "number",
    min: "0",
    step: "5",
    value: draft.current_dose_mg_per_day,
    onChange: e => patchDraft({
      current_dose_mg_per_day: e.target.value
    })
  }), /*#__PURE__*/React.createElement("select", {
    className: "tdm-input mcd-select-sm",
    value: draft.dose_unit,
    onChange: e => patchDraft({
      dose_unit: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "mg"
  }, t('mcd_dose_unit_mg')), /*#__PURE__*/React.createElement("option", {
    value: "caps"
  }, t('mcd_dose_unit_caps')), /*#__PURE__*/React.createElement("option", {
    value: "ml"
  }, t('mcd_dose_unit_ml'))))), /*#__PURE__*/React.createElement(Row, {
    label: t('mcd_doses_per_day')
  }, /*#__PURE__*/React.createElement("input", {
    className: "tdm-input mcd-num",
    type: "number",
    min: "0",
    step: "1",
    value: draft.doses_per_day,
    onChange: e => patchDraft({
      doses_per_day: e.target.value
    })
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('mcd_schedule')
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-schedule"
  }, draft.schedule.map((slot, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "mcd-schedule-slot"
  }, /*#__PURE__*/React.createElement("input", {
    type: "time",
    className: "tdm-input mcd-time",
    value: slot,
    onChange: e => setScheduleSlot(i, e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "mcd-x",
    onClick: () => removeScheduleSlot(i),
    title: "remove"
  }, "\xD7"))), /*#__PURE__*/React.createElement("button", {
    className: "mcd-add-slot mono",
    onClick: addScheduleSlot
  }, t('mcd_schedule_add')))), scheduleMismatch && /*#__PURE__*/React.createElement("div", {
    className: "mcd-warn mono"
  }, t('mcd_schedule_mismatch', draft.schedule.length, draft.doses_per_day))), /*#__PURE__*/React.createElement(Section, {
    label: t('mcd_sec_interval')
  }, /*#__PURE__*/React.createElement(Row, {
    label: t('mcd_interval_dose')
  }, /*#__PURE__*/React.createElement("input", {
    className: "tdm-input mcd-num",
    type: "number",
    min: "0",
    step: "1",
    value: draft.dose_interval_h,
    onChange: e => patchDraft({
      dose_interval_h: e.target.value
    })
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('mcd_interval_halflife')
  }, /*#__PURE__*/React.createElement("input", {
    className: "tdm-input mcd-num",
    type: "number",
    min: "0",
    step: "0.5",
    value: draft.half_life_h,
    onChange: e => patchDraft({
      half_life_h: e.target.value
    })
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('mcd_interval_metab'),
    hint: t('mcd_metab_hint')
  }, /*#__PURE__*/React.createElement("input", {
    className: "tdm-input mcd-num",
    type: "number",
    min: "0",
    step: "1",
    value: draft.half_life_active_metabolite_h,
    onChange: e => patchDraft({
      half_life_active_metabolite_h: e.target.value
    })
  }))), /*#__PURE__*/React.createElement(Section, {
    label: t('mcd_sec_strategy')
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-radio-list"
  }, /*#__PURE__*/React.createElement(ModeRadio, {
    value: "steady",
    current: mode.type,
    label: t('mcd_mode_steady'),
    hint: t('mcd_mode_steady_hint'),
    onSelect: () => setMode({
      type: 'steady'
    })
  }), /*#__PURE__*/React.createElement(ModeRadio, {
    value: "up",
    current: mode.type,
    label: t('mcd_mode_up'),
    onSelect: () => setMode({
      type: 'up',
      target_dose_mg: mode.target_dose_mg || '',
      step_type: mode.step_type || 'linear',
      step_size_mg: mode.step_size_mg || 25,
      step_interval_days: mode.step_interval_days || 7
    })
  }, mode.type === 'up' && /*#__PURE__*/React.createElement(TitrationFields, {
    mode: mode,
    patchMode: patchMode,
    t: t,
    preview: titrationPreview,
    progress: titrationProgress
  })), /*#__PURE__*/React.createElement(ModeRadio, {
    value: "down",
    current: mode.type,
    label: t('mcd_mode_down'),
    onSelect: () => {
      const tpl = med.discontinuation_template;
      setMode({
        type: 'down',
        target_dose_mg: mode.target_dose_mg || (tpl ? tpl.target : 0),
        step_type: mode.step_type || 'linear',
        step_size_mg: mode.step_size_mg || (tpl ? tpl.step : 25),
        step_interval_days: mode.step_interval_days || (tpl ? tpl.interval_days : 14)
      });
    }
  }, mode.type === 'down' && /*#__PURE__*/React.createElement(TitrationFields, {
    mode: mode,
    patchMode: patchMode,
    t: t,
    preview: titrationPreview,
    progress: titrationProgress
  })), /*#__PURE__*/React.createElement(ModeRadio, {
    value: "prn",
    current: mode.type,
    label: t('mcd_mode_prn'),
    hint: t('mcd_mode_prn_hint'),
    onSelect: () => setMode({
      type: 'prn'
    })
  }))), /*#__PURE__*/React.createElement(Section, {
    label: t('mcd_sec_inventory')
  }, /*#__PURE__*/React.createElement(Row, {
    label: t('mcd_inv_count')
  }, /*#__PURE__*/React.createElement("input", {
    className: "tdm-input mcd-num",
    type: "number",
    min: "0",
    step: "1",
    value: draft.inventory_count,
    onChange: e => patchDraft({
      inventory_count: e.target.value
    })
  })), /*#__PURE__*/React.createElement(Row, {
    label: t('mcd_inv_threshold')
  }, /*#__PURE__*/React.createElement("input", {
    className: "tdm-input mcd-num",
    type: "number",
    min: "0",
    step: "1",
    value: draft.low_stock_threshold_days,
    onChange: e => patchDraft({
      low_stock_threshold_days: e.target.value
    })
  }))), /*#__PURE__*/React.createElement(Section, {
    label: t('mcd_sec_delete'),
    danger: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-delete-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-delete-msg"
  }, t('mcd_delete_msg')), !confirmDel ? /*#__PURE__*/React.createElement("button", {
    className: "mcd-btn-danger",
    onClick: () => setConfirmDel(true)
  }, t('mcd_delete_btn')) : /*#__PURE__*/React.createElement("div", {
    className: "mcd-delete-confirm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono mcd-confirm-q"
  }, t('mcd_delete_confirm')), /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-ghost",
    onClick: () => setConfirmDel(false)
  }, t('qa_cancel')), /*#__PURE__*/React.createElement("button", {
    className: "mcd-btn-danger",
    onClick: deleteSoft
  }, t('mcd_delete_btn')))))), /*#__PURE__*/React.createElement("footer", {
    className: "mcd-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-ghost",
    onClick: onClose
  }, t('mcd_close')), /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-save",
    onClick: trySave
  }, t('mcd_save')))), warnState && /*#__PURE__*/React.createElement(window.MultiChangeWarningModal, {
    recentChanges: warnState.recentChanges,
    currentMed: med,
    onCancel: () => setWarnState(null),
    onProceed: () => {
      setWarnState(null);
      commitAll();
    }
  }));
}
function Section({
  label,
  danger,
  children
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "mcd-section" + (danger ? " is-danger" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-section-head mono"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "mcd-section-body"
  }, children));
}
function Row({
  label,
  hint,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mcd-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-row-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-row-label"
  }, label), hint && /*#__PURE__*/React.createElement("div", {
    className: "mcd-row-hint mono"
  }, hint)), /*#__PURE__*/React.createElement("div", {
    className: "mcd-row-control"
  }, children));
}
function ModeRadio({
  value,
  current,
  label,
  hint,
  onSelect,
  children
}) {
  const active = current === value;
  return /*#__PURE__*/React.createElement("div", {
    className: "mcd-radio" + (active ? " is-on" : "")
  }, /*#__PURE__*/React.createElement("button", {
    className: "mcd-radio-trigger",
    onClick: onSelect
  }, /*#__PURE__*/React.createElement("span", {
    className: "mcd-radio-dot" + (active ? " is-on" : "")
  }), /*#__PURE__*/React.createElement("span", {
    className: "mcd-radio-label"
  }, label), hint && /*#__PURE__*/React.createElement("span", {
    className: "mcd-radio-hint mono"
  }, hint)), active && children && /*#__PURE__*/React.createElement("div", {
    className: "mcd-radio-body"
  }, children));
}
function TitrationFields({
  mode,
  patchMode,
  t,
  preview,
  progress
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mcd-titration"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-titration-grid"
  }, /*#__PURE__*/React.createElement("label", {
    className: "mcd-tf"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mcd-row-label"
  }, t('mcd_target_dose')), /*#__PURE__*/React.createElement("input", {
    className: "tdm-input mcd-num",
    type: "number",
    min: "0",
    step: "5",
    value: mode.target_dose_mg || '',
    onChange: e => patchMode({
      target_dose_mg: e.target.value
    })
  })), /*#__PURE__*/React.createElement("label", {
    className: "mcd-tf"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mcd-row-label"
  }, t('mcd_step_type')), /*#__PURE__*/React.createElement("select", {
    className: "tdm-input mcd-select",
    value: mode.step_type || 'linear',
    onChange: e => patchMode({
      step_type: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "linear"
  }, t('mcd_step_linear')), /*#__PURE__*/React.createElement("option", {
    value: "stepwise"
  }, t('mcd_step_stepwise')), /*#__PURE__*/React.createElement("option", {
    value: "custom"
  }, t('mcd_step_custom')))), /*#__PURE__*/React.createElement("label", {
    className: "mcd-tf"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mcd-row-label"
  }, t('mcd_step_size')), /*#__PURE__*/React.createElement("input", {
    className: "tdm-input mcd-num",
    type: "number",
    min: "0",
    step: "5",
    value: mode.step_size_mg || '',
    onChange: e => patchMode({
      step_size_mg: e.target.value
    })
  })), /*#__PURE__*/React.createElement("label", {
    className: "mcd-tf"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mcd-row-label"
  }, t('mcd_step_interval')), /*#__PURE__*/React.createElement("input", {
    className: "tdm-input mcd-num",
    type: "number",
    min: "0",
    step: "1",
    value: mode.step_interval_days || '',
    onChange: e => patchMode({
      step_interval_days: e.target.value
    })
  }))), preview && /*#__PURE__*/React.createElement("div", {
    className: "mcd-preview mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mcd-preview-lab"
  }, t('mcd_titration_plan')), preview.stages.map((s, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "mcd-preview-stage" + (s.target ? " is-target" : "")
  }, s.dose, "\u043C\u0433", i > 0 ? ' (день ' + s.day : '', s.target ? ', ' + t('mcd_titration_target') + ')' : i > 0 ? ')' : '', i < preview.stages.length - 1 && /*#__PURE__*/React.createElement("span", {
    className: "mcd-preview-arrow"
  }, " \u2192 ")))), progress && /*#__PURE__*/React.createElement("div", {
    className: "mcd-progress"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-progress-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mcd-progress-fill",
    style: {
      width: Math.min(100, progress.day / progress.total * 100) + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "mcd-progress-lab mono"
  }, t('mcd_titration_stage', progress.day, progress.total, progress.stage.dose))));
}
function modeChanged(a, b) {
  if (!a && b && b.type === 'steady') return false; // initial null + default steady = no change
  if (!a) return true;
  return JSON.stringify(stripStarted(a)) !== JSON.stringify(stripStarted(b));
}
function stripStarted(m) {
  if (!m) return m;
  const {
    startedAt,
    currentStage,
    ...rest
  } = m;
  return rest;
}
function recentOtherModeChanges(state, excludeMedId, locale) {
  const cutoff = Date.now() - 7 * 86400000;
  const seen = new Map();
  /* activityLog is oldest-first internally — newest at end. Iterate in
     reverse so the first sighting per med is the most recent. */
  const log = state.activityLog || [];
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e.action !== 'mode_changed') continue;
    if (e.entity_id === excludeMedId) continue;
    if (new Date(e.timestamp).getTime() < cutoff) continue;
    if (!seen.has(e.entity_id)) seen.set(e.entity_id, e);
  }
  return Array.from(seen.values()).map(e => {
    const m = (state.medications || []).find(mm => mm.id === e.entity_id);
    return {
      ...e,
      medName: m ? m['name_' + (locale === 'uk' ? 'ua' : 'ru')] || m.name_ru : e.entity_id
    };
  });
}
window.MedConfigDrawer = MedConfigDrawer;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/medications/MedConfigDrawer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/medications/MedDetailPage.jsx
try { (() => {
/* global React */
/* pages/medications/MedDetailPage.jsx · Sprint 3A Batch 4
 *
 * Full-route detail page for a single medication. Reached via
 * /medications/{med_id}. Hosts four tabs:
 *
 *   ОБЗОР           — at-a-glance card (timers + inventory mirror)
 *   ЖУРНАЛ          — per-med pharmacist notes (PharmNotes component)
 *   ИСТОРИЯ ДОЗ     — dose log timeline + activity events for this med
 *   КОНФИГУРАЦИЯ    — read-only summary + button that opens MedConfigDrawer
 *
 * The page rides the standard .page chrome so the global topbar and
 * sidebar remain visible. */

const {
  useState: useStateMD,
  useContext: useCtxMD,
  useMemo: useMemoMD
} = React;
function MedDetailPage({
  medId,
  onBack
}) {
  const data = useCtxMD(window.LifeDataContext);
  const {
    t,
    locale
  } = useCtxMD(window.LifeLocaleContext);
  const I = window.LIcons;
  const med = (data.state.medications || []).find(m => m.id === medId);
  const [tab, setTab] = useStateMD('overview');
  const [openDrawer, setOpenDrawer] = useStateMD(false);
  if (!med) {
    return /*#__PURE__*/React.createElement("div", {
      className: "page"
    }, /*#__PURE__*/React.createElement("button", {
      className: "medc-refill mono",
      onClick: onBack
    }, "\u2190 ", t('mdp_back')), /*#__PURE__*/React.createElement("div", {
      className: "meds-empty mono"
    }, "\xB7 \u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \xB7"));
  }
  const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
  const statusLabels = window.LifeMedStatusLabels || {};
  const statusDef = statusLabels[med.status] || {};
  const tabs = [{
    id: 'overview',
    label: t('mdp_tab_overview')
  }, {
    id: 'journal',
    label: t('mdp_tab_journal')
  }, {
    id: 'doses',
    label: t('mdp_tab_doses')
  }, {
    id: 'config',
    label: t('mdp_tab_config')
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "page mdp-page"
  }, /*#__PURE__*/React.createElement("button", {
    className: "mdp-back mono",
    onClick: onBack
  }, "\u2190 ", t('mdp_back')), /*#__PURE__*/React.createElement("header", {
    className: "page-head mdp-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head-left"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "page-title"
  }, medName), /*#__PURE__*/React.createElement("div", {
    className: "page-sub mono"
  }, med.brand_common, " \xB7 ", statusDef[locale === 'uk' ? 'ua' : 'ru'] || med.status))), /*#__PURE__*/React.createElement("div", {
    className: "mdp-tabs"
  }, tabs.map(tb => /*#__PURE__*/React.createElement("button", {
    key: tb.id,
    className: "mdp-tab mono" + (tab === tb.id ? " is-on" : ""),
    onClick: () => setTab(tb.id)
  }, tb.label))), /*#__PURE__*/React.createElement("div", {
    className: "mdp-tab-body"
  }, tab === 'overview' && /*#__PURE__*/React.createElement(OverviewTab, {
    med: med
  }), tab === 'journal' && /*#__PURE__*/React.createElement(window.PharmNotes, {
    medId: medId
  }), tab === 'doses' && /*#__PURE__*/React.createElement(DosesTab, {
    medId: medId,
    med: med
  }), tab === 'config' && /*#__PURE__*/React.createElement(ConfigTab, {
    med: med,
    onOpenDrawer: () => setOpenDrawer(true)
  })), openDrawer && /*#__PURE__*/React.createElement(window.MedConfigDrawer, {
    med: med,
    onClose: () => setOpenDrawer(false)
  }));
}

/* ── Overview tab ───────────────────────────────────────── */
function OverviewTab({
  med
}) {
  const data = useCtxMD(window.LifeDataContext);
  const {
    t,
    locale
  } = useCtxMD(window.LifeLocaleContext);
  const M = window.LifeMedMath;
  const doseLog = data.state.doseLogs[med.id] || [];
  const modeStyle = data.state.modeStyles[med.id] || null;
  const now = Date.now();
  const nd = M.nextDose(med, doseLog, modeStyle, now);
  const hl = M.halfLifeTimer(med, doseLog, now);
  const fe = M.fullEliminationTimer(med);
  const usual = M.usualTime(doseLog);
  const risk = M.inventoryRisk(med, modeStyle);
  const unitH = t('meds_unit_h');
  const unitM = t('meds_unit_m');
  const notes = med['notes_' + (locale === 'uk' ? 'ua' : 'ru')] || med.notes_ru;
  return /*#__PURE__*/React.createElement("div", {
    className: "mdp-overview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat-lab mono"
  }, "\u0442\u0435\u043A\u0443\u0449\u0430\u044F \u0434\u043E\u0437\u0430"), /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat-val"
  }, med.current_dose_mg_per_day || '—', " ", /*#__PURE__*/React.createElement("span", {
    className: "mdp-stat-unit mono"
  }, "\u043C\u0433/\u0434\u0435\u043D\u044C"))), /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat-lab mono"
  }, "\u043F\u0440\u0438\u0451\u043C\u043E\u0432 \u0432 \u0434\u0435\u043D\u044C"), /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat-val"
  }, med.doses_per_day || '—')), /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat-lab mono"
  }, "t\xBD"), /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat-val"
  }, med.half_life_h != null ? med.half_life_h + 'ч' : '—')), /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat-lab mono"
  }, "\u0437\u0430\u043F\u0430\u0441"), /*#__PURE__*/React.createElement("div", {
    className: "mdp-stat-val mdp-stat-risk-" + risk.tier
  }, med.inventory_count || 0))), /*#__PURE__*/React.createElement("div", {
    className: "mdp-timers-card"
  }, nd && /*#__PURE__*/React.createElement("div", {
    className: "medc-timer mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "medc-arrow"
  }, "\u25B8"), nd.etaMs > 0 ? t('meds_timer_next', M.formatHM(nd.etaMs, unitH, unitM), nd.eta) : t('meds_timer_now')), hl && /*#__PURE__*/React.createElement("div", {
    className: "medc-timer mono medc-timer-muted"
  }, /*#__PURE__*/React.createElement("span", {
    className: "medc-arrow"
  }, "\u25B8"), t('meds_timer_halflife', hl.halfLifeH, hl.exitClock)), fe && /*#__PURE__*/React.createElement("div", {
    className: "medc-timer mono medc-timer-muted"
  }, /*#__PURE__*/React.createElement("span", {
    className: "medc-arrow"
  }, "\u25B8"), fe.useMetabolite ? t('meds_timer_full_ddcar', fe.days, t.pl('pl_meds_day', fe.days)) : t('meds_timer_full', fe.days, t.pl('pl_meds_day', fe.days))), usual && /*#__PURE__*/React.createElement("div", {
    className: "medc-usual mono"
  }, t('meds_usual_time', usual))), notes && /*#__PURE__*/React.createElement("div", {
    className: "mdp-notes"
  }, notes));
}

/* ── Doses tab ──────────────────────────────────────────── */
function DosesTab({
  medId,
  med
}) {
  const data = useCtxMD(window.LifeDataContext);
  const {
    t,
    locale
  } = useCtxMD(window.LifeLocaleContext);
  const doseLog = data.state.doseLogs[medId] || [];
  if (doseLog.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "pn-empty mono"
    }, t('mdp_doses_empty'));
  }
  const intlLoc = window.LifeStrings[locale] && window.LifeStrings[locale]._intl_locale || 'ru-RU';
  return /*#__PURE__*/React.createElement("div", {
    className: "mdp-doses"
  }, /*#__PURE__*/React.createElement("ul", {
    className: "pn-list"
  }, doseLog.map((d, i) => {
    const dt = new Date(d.taken_at);
    const when = dt.toLocaleDateString(intlLoc, {
      day: '2-digit',
      month: '2-digit'
    }) + ' · ' + dt.toTimeString().slice(0, 5);
    return /*#__PURE__*/React.createElement("li", {
      key: d.taken_at + '/' + i,
      className: "pn-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pn-row-date mono"
    }, when), /*#__PURE__*/React.createElement("span", {
      className: "pn-row-text"
    }, d.dose_mg != null ? d.dose_mg + ' мг' : t('dh_dose'), d.mode && d.mode !== 'scheduled' && /*#__PURE__*/React.createElement("span", {
      className: "mdp-dose-mode mono"
    }, " \xB7 ", d.mode)), d.note && /*#__PURE__*/React.createElement("span", {
      className: "atl-detail"
    }, d.note));
  })), /*#__PURE__*/React.createElement("div", {
    className: "mdp-section-head mono"
  }, "activity log"), /*#__PURE__*/React.createElement(window.ActivityTimeline, {
    entityType: "med_dose",
    entityId: medId,
    limit: 100
  }), /*#__PURE__*/React.createElement(window.ActivityTimeline, {
    entityType: "med_config",
    entityId: medId,
    limit: 50
  }), /*#__PURE__*/React.createElement(window.ActivityTimeline, {
    entityType: "mode_style",
    entityId: medId,
    limit: 20
  }));
}

/* ── Config tab — read-only summary + drawer trigger ────── */
function ConfigTab({
  med,
  onOpenDrawer
}) {
  const {
    t,
    locale
  } = useCtxMD(window.LifeLocaleContext);
  const data = useCtxMD(window.LifeDataContext);
  const modeStyle = data.state.modeStyles[med.id] || null;
  const rows = [{
    lab: t('mcd_status'),
    val: med.status
  }, {
    lab: t('mcd_dose_current'),
    val: (med.current_dose_mg_per_day || 0) + ' мг'
  }, {
    lab: t('mcd_doses_per_day'),
    val: med.doses_per_day || '—'
  }, {
    lab: t('mcd_schedule'),
    val: (med.schedule || []).join(', ') || '—'
  }, {
    lab: t('mcd_interval_dose'),
    val: med.dose_interval_h ? med.dose_interval_h + ' ч' : '—'
  }, {
    lab: t('mcd_interval_halflife'),
    val: med.half_life_h != null ? med.half_life_h + ' ч' : '—'
  }, {
    lab: t('mcd_sec_strategy'),
    val: modeStyle ? modeStyle.type : 'steady (default)'
  }, {
    lab: t('mcd_inv_count'),
    val: med.inventory_count || 0
  }, {
    lab: t('mcd_inv_threshold'),
    val: (med.low_stock_threshold_days || 7) + ' дн.'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "mdp-config"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mdp-config-grid"
  }, rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "mdp-config-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mdp-config-lab mono"
  }, r.lab), /*#__PURE__*/React.createElement("span", {
    className: "mdp-config-val"
  }, r.val)))), /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-save",
    onClick: onOpenDrawer
  }, t('mdp_config_open_drawer')));
}
window.MedDetailPage = MedDetailPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/medications/MedDetailPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/medications/PharmNotes.jsx
try { (() => {
/* global React */
/* pages/medications/PharmNotes.jsx · Sprint 3A Batch 4
 *
 * Per-med pharmacist-notes journal. Inline capture row at the top,
 * reverse-chronological list below. Each note: polarity (+/-), date,
 * free text. Hover reveals edit + delete.
 *
 * Reused by MedDetailPage's ЖУРНАЛ tab. Global feed is a separate
 * component (GlobalJournal) that pulls notes across all meds. */

const {
  useState: useStatePN,
  useContext: useCtxPN,
  useMemo: useMemoPN
} = React;
function PharmNotes({
  medId
}) {
  const data = useCtxPN(window.LifeDataContext);
  const {
    t
  } = useCtxPN(window.LifeLocaleContext);
  const notes = data.state.pharmNotes[medId] || [];
  const [polarity, setPolarity] = useStatePN('+');
  const [text, setText] = useStatePN('');
  const [date, setDate] = useStatePN(() => new Date().toISOString().slice(0, 10));
  const [editing, setEditing] = useStatePN(null); // noteId being edited

  function commit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (editing) {
      data.editPharmNote(medId, editing, {
        polarity,
        text: trimmed,
        date
      });
      setEditing(null);
    } else {
      data.addPharmNote(medId, {
        polarity,
        text: trimmed,
        date
      });
    }
    setText('');
  }
  function startEdit(n) {
    setEditing(n.id);
    setPolarity(n.polarity);
    setText(n.text);
    setDate(n.date);
  }
  function cancelEdit() {
    setEditing(null);
    setText('');
    setPolarity('+');
    setDate(new Date().toISOString().slice(0, 10));
  }
  const summary = useMemoPN(() => {
    const cutoff = Date.now() - 30 * 86400000;
    let plus = 0,
      minus = 0;
    notes.forEach(n => {
      const ts = new Date(n.date).getTime();
      if (!isFinite(ts) || ts < cutoff) return;
      if (n.polarity === '+') plus++;
      if (n.polarity === '-') minus++;
    });
    return {
      plus,
      minus
    };
  }, [notes]);
  return /*#__PURE__*/React.createElement("div", {
    className: "pn"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pn-capture"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pn-polarity"
  }, /*#__PURE__*/React.createElement("button", {
    className: "pn-pol pn-pol-plus" + (polarity === '+' ? " is-on" : ""),
    onClick: () => setPolarity('+')
  }, "+"), /*#__PURE__*/React.createElement("button", {
    className: "pn-pol pn-pol-minus" + (polarity === '-' ? " is-on" : ""),
    onClick: () => setPolarity('-')
  }, "\u2212")), /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "tdm-input pn-input",
    placeholder: t('pn_capture_ph'),
    value: text,
    onChange: e => setText(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') commit();
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "tdm-input pn-date",
    value: date,
    onChange: e => setDate(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-save pn-save",
    onClick: commit
  }, t('pn_save_short')), editing && /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-ghost",
    onClick: cancelEdit
  }, t('pn_cancel'))), notes.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "pn-summary mono"
  }, t('pn_summary', summary.plus, summary.minus)), /*#__PURE__*/React.createElement("ul", {
    className: "pn-list"
  }, notes.length === 0 && /*#__PURE__*/React.createElement("li", {
    className: "pn-empty mono"
  }, t('pn_empty')), notes.map(n => /*#__PURE__*/React.createElement(PharmNoteRow, {
    key: n.id,
    note: n,
    medId: medId,
    data: data,
    t: t,
    onEdit: () => startEdit(n)
  }))));
}
function PharmNoteRow({
  note,
  medId,
  data,
  t,
  onEdit
}) {
  const intlLoc = window.LifeStrings.ru && window.LifeStrings.ru._intl_locale || 'ru-RU';
  const d = new Date(note.date);
  const when = d.toLocaleDateString(intlLoc, {
    day: '2-digit',
    month: '2-digit'
  });
  return /*#__PURE__*/React.createElement("li", {
    className: "pn-row pn-row-" + (note.polarity === '+' ? 'plus' : 'minus')
  }, /*#__PURE__*/React.createElement("span", {
    className: "pn-row-mark pn-row-mark-" + (note.polarity === '+' ? 'plus' : 'minus')
  }, note.polarity === '+' ? '+' : '−'), /*#__PURE__*/React.createElement("span", {
    className: "pn-row-date mono"
  }, when), /*#__PURE__*/React.createElement("span", {
    className: "pn-row-text"
  }, note.text), /*#__PURE__*/React.createElement("div", {
    className: "pn-row-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "pn-row-act mono",
    onClick: onEdit
  }, t('pn_edit')), /*#__PURE__*/React.createElement("button", {
    className: "pn-row-act pn-row-act-del mono",
    onClick: () => data.deletePharmNote(medId, note.id)
  }, t('pn_delete'))));
}
window.PharmNotes = PharmNotes;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/medications/PharmNotes.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/medications/RefillModal.jsx
try { (() => {
/* global React */
/* pages/medications/RefillModal.jsx · Sprint 3A Batch 2
 *
 * Compact inventory-refill prompt. User enters how many units they
 * just added; we add to the existing count and persist. */

const {
  useState: useStateRM,
  useContext: useCtxRM
} = React;
function RefillModal({
  med,
  onClose
}) {
  const data = useCtxRM(window.LifeDataContext);
  const {
    t,
    locale
  } = useCtxRM(window.LifeLocaleContext);
  const I = window.LIcons;
  const [add, setAdd] = useStateRM('30');
  const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
  const current = med.inventory_count || 0;
  const next = current + (parseInt(add, 10) || 0);
  function save() {
    data.setMedicationInventory(med.id, next);
    onClose();
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "qa-backdrop",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-modal tdm-modal tdm-refill",
    onMouseDown: e => e.stopPropagation(),
    role: "dialog"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-eyebrow mono"
  }, t('meds_refill_title'), " \xB7 ", medName), /*#__PURE__*/React.createElement("button", {
    className: "qa-close",
    onClick: onClose
  }, I.x ? I.x({
    size: 14
  }) : '×')), /*#__PURE__*/React.createElement("label", {
    className: "tdm-field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tdm-lab mono"
  }, t('meds_refill_add')), /*#__PURE__*/React.createElement("input", {
    type: "number",
    className: "tdm-input",
    value: add,
    onChange: e => setAdd(e.target.value),
    min: "0",
    step: "1",
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "tdm-refill-total mono"
  }, t('meds_refill_total'), ": ", next), /*#__PURE__*/React.createElement("div", {
    className: "qa-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-foot-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-ghost",
    onClick: onClose
  }, t('qa_cancel')), /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-save",
    onClick: save
  }, t('meds_inv_refill'))))));
}
window.RefillModal = RefillModal;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/medications/RefillModal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/pages/medications/TakeDoseModal.jsx
try { (() => {
/* global React */
/* pages/medications/TakeDoseModal.jsx · Sprint 3A Batch 2
 *
 * Quick dose-logging modal. Defaults to NOW + per-dose-amount; user
 * may edit timestamp + dose + add a note. Shows late/early indicator
 * if timestamp differs from expected (last dose + interval) by more
 * than 30 minutes, and a PRN anti-stacking warning if last dose was
 * < interval ago.
 *
 * Save → data.takeDose(medId, payload) which appends to doseLogs,
 * decrements inventory, and emits an activityLog entry.
 *
 * Visual idiom: matches the QuickAdd modal (qa-backdrop / qa-modal
 * shell) so it doesn't introduce new modal chrome. */

const {
  useState: useStateTD2,
  useEffect: useEffectTD2,
  useContext: useCtxTD2,
  useMemo: useMemoTD2
} = React;
function TakeDoseModal({
  med,
  onClose
}) {
  const data = useCtxTD2(window.LifeDataContext);
  const {
    t,
    locale
  } = useCtxTD2(window.LifeLocaleContext);
  const M = window.LifeMedMath;
  const I = window.LIcons;

  /* All state pre-fills. timestamp = now (local datetime input);
     dose = round(daily / per-day) defaulting to strength_mg if no
     daily total. */
  const defaultTs = useMemoTD2(() => toLocalInput(new Date()), []);
  const defaultDose = (() => {
    if (med.current_dose_mg_per_day && med.doses_per_day) {
      return Math.round(med.current_dose_mg_per_day / med.doses_per_day * 10) / 10;
    }
    return med.strength_mg || '';
  })();
  const [ts, setTs] = useStateTD2(defaultTs);
  const [dose, setDose] = useStateTD2(defaultDose);
  const [note, setNote] = useStateTD2('');
  useEffectTD2(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const doseLog = data.state.doseLogs[med.id] || [];
  const modeStyle = data.state.modeStyles[med.id] || null;
  const takenMs = new Date(ts).getTime();
  const delta = M.dosingDelta(med, doseLog, takenMs);
  const prnGap = M.prnStackingGap(med, doseLog, modeStyle, takenMs);
  const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
  const unitH = t('meds_unit_h');
  const unitM = t('meds_unit_m');
  function save() {
    data.takeDose(med.id, {
      taken_at: new Date(ts).toISOString(),
      dose_mg: parseFloat(dose) || null,
      mode: modeStyle ? modeStyle.type : 'scheduled',
      note: note.trim()
    });
    onClose();
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "qa-backdrop",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-modal tdm-modal",
    onMouseDown: e => e.stopPropagation(),
    role: "dialog"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-eyebrow mono"
  }, t('meds_take_title', medName)), /*#__PURE__*/React.createElement("button", {
    className: "qa-close",
    onClick: onClose
  }, I.x ? I.x({
    size: 14
  }) : '×')), /*#__PURE__*/React.createElement("div", {
    className: "tdm-row"
  }, /*#__PURE__*/React.createElement("label", {
    className: "tdm-field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tdm-lab mono"
  }, t('meds_take_when')), /*#__PURE__*/React.createElement("input", {
    type: "datetime-local",
    className: "tdm-input",
    value: ts,
    onChange: e => setTs(e.target.value)
  })), /*#__PURE__*/React.createElement("label", {
    className: "tdm-field tdm-field-dose"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tdm-lab mono"
  }, t('meds_take_dose')), /*#__PURE__*/React.createElement("input", {
    type: "number",
    className: "tdm-input",
    value: dose,
    onChange: e => setDose(e.target.value),
    step: "0.5",
    min: "0"
  }))), /*#__PURE__*/React.createElement("label", {
    className: "tdm-field tdm-field-note"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tdm-lab mono"
  }, t('meds_take_note')), /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "tdm-input",
    placeholder: t('meds_take_note_ph'),
    value: note,
    onChange: e => setNote(e.target.value)
  })), delta && /*#__PURE__*/React.createElement("div", {
    className: "tdm-indicator mono"
  }, delta.kind === 'late' ? t('meds_late_by', M.formatHM(delta.deltaMs, unitH, unitM)) : t('meds_early_by', M.formatHM(delta.deltaMs, unitH, unitM))), prnGap != null && /*#__PURE__*/React.createElement("div", {
    className: "tdm-prn-warn mono"
  }, t('meds_prn_anti_stack', M.formatHM(prnGap, unitH, unitM), med.dose_interval_h || 6)), /*#__PURE__*/React.createElement("div", {
    className: "qa-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qa-foot-hints mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qa-kbd"
  }, "\u2318 \u21B5"), /*#__PURE__*/React.createElement("span", null, t('meds_take_save')), /*#__PURE__*/React.createElement("span", {
    className: "qa-foot-sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "qa-kbd"
  }, "ESC"), /*#__PURE__*/React.createElement("span", null, t('qa_cancel'))), /*#__PURE__*/React.createElement("div", {
    className: "qa-foot-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-ghost",
    onClick: onClose
  }, t('qa_cancel')), /*#__PURE__*/React.createElement("button", {
    className: "qa-btn-save btn--stakes",
    onClick: save
  }, t('meds_take_save'))))));
}
function toLocalInput(d) {
  /* datetime-local needs "YYYY-MM-DDTHH:MM" in local time, not UTC.
     toISOString applies UTC, so build manually. */
  const pad = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
window.TakeDoseModal = TakeDoseModal;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/pages/medications/TakeDoseModal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/profile/EditableField.jsx
try { (() => {
/* global React */
const {
  useState: useStateEF,
  useRef: useRefEF,
  useEffect: useEffectEF
} = React;

/* Inline-editable field. Click → input; blur or Enter → save.
   Used across profile cards for name / age / city / numeric fields. */
function EditableField({
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
  suffix,
  multiline = false,
  width
}) {
  const [editing, setEditing] = useStateEF(false);
  const [draft, setDraft] = useStateEF(value);
  const ref = useRefEF(null);
  useEffectEF(() => {
    setDraft(value);
  }, [value]);
  useEffectEF(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if (ref.current.select && !multiline) ref.current.select();
    }
  }, [editing, multiline]);
  function commit() {
    setEditing(false);
    if (draft !== value) onChange(type === 'number' ? draft === '' ? null : Number(draft) : draft);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }
  function onKey(e) {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  }
  const empty = value == null || value === '';
  const cls = "ef-display" + (empty ? " is-empty" : "") + (mono ? " mono" : "");
  if (editing) {
    return multiline ? /*#__PURE__*/React.createElement("textarea", {
      ref: ref,
      className: "ef-input ef-input-multi" + (mono ? " mono" : ""),
      value: draft == null ? '' : draft,
      placeholder: placeholder,
      style: width ? {
        width
      } : undefined,
      onChange: e => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: onKey,
      rows: 3
    }) : /*#__PURE__*/React.createElement("input", {
      ref: ref,
      type: type === 'number' ? 'text' : type,
      inputMode: type === 'number' ? 'decimal' : undefined,
      className: "ef-input" + (mono ? " mono" : ""),
      value: draft == null ? '' : draft,
      placeholder: placeholder,
      style: width ? {
        width
      } : undefined,
      onChange: e => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: onKey
    });
  }
  return /*#__PURE__*/React.createElement("button", {
    className: cls,
    style: width ? {
      width
    } : undefined,
    onClick: () => setEditing(true),
    type: "button"
  }, empty ? placeholder : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, value), suffix && /*#__PURE__*/React.createElement("span", {
    className: "ef-suffix mono"
  }, suffix)));
}
window.EditableField = EditableField;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/profile/EditableField.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/profile/cards/BodyMetricsCard.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxBM,
  useMemo: useMemoBM
} = React;

/* Body metrics card. Inline editable height + weight, last-3 weigh-in
   sparkline (mock data). Notes field at the bottom. */
function BodyMetricsCard({
  data,
  onChange
}) {
  const {
    t
  } = useCtxBM(window.LifeLocaleContext);
  const Field = window.EditableField;
  const points = useMemoBM(() => {
    const series = data.history || [];
    if (series.length < 2) return null;
    const vals = series.map(s => s.weight);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const W = 160,
      H = 32;
    return series.map((s, i) => {
      const x = i / (series.length - 1) * (W - 4) + 2;
      const y = H - 4 - (s.weight - min) / range * (H - 8);
      return {
        x,
        y,
        label: s.date,
        weight: s.weight
      };
    });
  }, [data.history]);
  return /*#__PURE__*/React.createElement("section", {
    className: "pc-card"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('pc_body'))), /*#__PURE__*/React.createElement("div", {
    className: "pc-body pc-grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('pc_body_height')), /*#__PURE__*/React.createElement(Field, {
    value: data.heightCm,
    type: "number",
    mono: true,
    suffix: t('pc_body_unit_cm'),
    onChange: v => onChange({
      heightCm: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "pc-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('pc_body_weight')), /*#__PURE__*/React.createElement(Field, {
    value: data.weightKg,
    type: "number",
    mono: true,
    suffix: t('pc_body_unit_kg'),
    onChange: v => onChange({
      weightKg: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "pc-row pc-row-wide"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('pc_body_history')), points ? /*#__PURE__*/React.createElement("div", {
    className: "pc-sparkline"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "180",
    height: "40",
    viewBox: "0 0 180 40"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: points.map(p => p.x + ',' + p.y).join(' '),
    fill: "none",
    stroke: "var(--primary)",
    strokeWidth: "1.5",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), points.map((p, i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: p.x,
    cy: p.y,
    r: i === points.length - 1 ? 3 : 2,
    fill: i === points.length - 1 ? 'var(--primary-l)' : 'var(--primary)'
  }))), /*#__PURE__*/React.createElement("div", {
    className: "pc-sparkline-labels mono"
  }, points.map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "pc-sparkline-label" + (i === points.length - 1 ? " is-last" : "")
  }, p.label, " \xB7 ", p.weight, t('pc_body_unit_kg'))))) : /*#__PURE__*/React.createElement("div", {
    className: "pc-empty-inline"
  }, "\u2014")), /*#__PURE__*/React.createElement("div", {
    className: "pc-row pc-row-wide"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('pc_body_notes')), /*#__PURE__*/React.createElement(Field, {
    value: data.notes,
    placeholder: t('pc_body_notes_ph'),
    multiline: true,
    onChange: v => onChange({
      notes: v
    })
  }))));
}
window.BodyMetricsCard = BodyMetricsCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/profile/cards/BodyMetricsCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/profile/cards/ClothingSizesCard.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxCS
} = React;

/* Clothing sizes — EU is the source of truth, US + UA/UK are derived
   via window.lifeConvertSize(type, eu). Edit the EU column and the
   other two cells auto-update. */
function ClothingSizesCard({
  data,
  onChange
}) {
  const {
    t
  } = useCtxCS(window.LifeLocaleContext);
  const Field = window.EditableField;
  const rows = [{
    key: 'shirt',
    label: t('pc_sizes_shirt')
  }, {
    key: 'pants',
    label: t('pc_sizes_pants')
  }, {
    key: 'jacket',
    label: t('pc_sizes_jacket')
  }, {
    key: 'shoes',
    label: t('pc_sizes_shoes')
  }, {
    key: 'suit',
    label: t('pc_sizes_suit')
  }, {
    key: 'tshirt',
    label: t('pc_sizes_tshirt')
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "pc-card pc-card-wide"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('pc_sizes')), /*#__PURE__*/React.createElement("span", {
    className: "pc-sub mono"
  }, t('pc_sizes_sub'))), /*#__PURE__*/React.createElement("div", {
    className: "pc-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-sizes-table"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-sizes-head mono"
  }, /*#__PURE__*/React.createElement("span", null, t('pc_sizes_type')), /*#__PURE__*/React.createElement("span", null, "EU"), /*#__PURE__*/React.createElement("span", null, "US"), /*#__PURE__*/React.createElement("span", null, "UA/UK")), rows.map(r => {
    const eu = data[r.key];
    const conv = window.lifeConvertSize(r.key, eu);
    return /*#__PURE__*/React.createElement("div", {
      className: "pc-sizes-row",
      key: r.key
    }, /*#__PURE__*/React.createElement("span", {
      className: "pc-sizes-type"
    }, r.label), /*#__PURE__*/React.createElement(Field, {
      value: eu,
      type: "number",
      mono: true,
      width: 68,
      onChange: v => onChange({
        [r.key]: v
      })
    }), /*#__PURE__*/React.createElement("span", {
      className: "pc-sizes-derived mono"
    }, conv.us), /*#__PURE__*/React.createElement("span", {
      className: "pc-sizes-derived mono"
    }, conv.alt));
  }))));
}
window.ClothingSizesCard = ClothingSizesCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/profile/cards/ClothingSizesCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/profile/cards/FoodPreferencesCard.jsx
try { (() => {
/* global React */
const {
  useState: useStateFP,
  useContext: useCtxFP
} = React;

/* Food preferences — allergies, likes, dislikes are tag lists with
   inline add/remove. Plus a freeform notes textarea at the bottom. */
function FoodPreferencesCard({
  data,
  onChange
}) {
  const {
    t
  } = useCtxFP(window.LifeLocaleContext);
  const Field = window.EditableField;
  return /*#__PURE__*/React.createElement("section", {
    className: "pc-card pc-card-wide"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('pc_food'))), /*#__PURE__*/React.createElement("div", {
    className: "pc-body pc-food-body"
  }, /*#__PURE__*/React.createElement(FoodTagGroup, {
    label: t('pc_food_allergies'),
    placeholder: t('pc_food_allergies_ph'),
    tags: data.allergies,
    onChange: next => onChange({
      allergies: next
    }),
    tone: "danger"
  }), /*#__PURE__*/React.createElement("div", {
    className: "pc-food-cols"
  }, /*#__PURE__*/React.createElement(FoodTagGroup, {
    label: t('pc_food_likes'),
    placeholder: t('pc_food_tag_ph'),
    tags: data.likes,
    onChange: next => onChange({
      likes: next
    }),
    tone: "ok"
  }), /*#__PURE__*/React.createElement(FoodTagGroup, {
    label: t('pc_food_dislikes'),
    placeholder: t('pc_food_tag_ph'),
    tags: data.dislikes,
    onChange: next => onChange({
      dislikes: next
    }),
    tone: "muted"
  })), /*#__PURE__*/React.createElement("div", {
    className: "pc-row pc-row-wide"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('pc_food_notes')), /*#__PURE__*/React.createElement(Field, {
    value: data.notes,
    placeholder: t('pc_food_notes_ph'),
    multiline: true,
    onChange: v => onChange({
      notes: v
    })
  }))));
}
function FoodTagGroup({
  label,
  tags,
  placeholder,
  onChange,
  tone
}) {
  const [draft, setDraft] = useStateFP('');
  function add(e) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onChange([...tags, v]);
    setDraft('');
  }
  function remove(idx) {
    onChange(tags.filter((_, i) => i !== idx));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "pc-food-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "pc-food-tags"
  }, tags.map((tag, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "pc-food-tag pc-food-tag-" + tone
  }, /*#__PURE__*/React.createElement("span", null, tag), /*#__PURE__*/React.createElement("button", {
    className: "pc-food-tag-x",
    onClick: () => remove(i),
    "aria-label": "remove"
  }, "\xD7"))), /*#__PURE__*/React.createElement("form", {
    className: "pc-food-add",
    onSubmit: add
  }, /*#__PURE__*/React.createElement("input", {
    className: "pc-food-add-input",
    value: draft,
    onChange: e => setDraft(e.target.value),
    placeholder: placeholder
  }))));
}
window.FoodPreferencesCard = FoodPreferencesCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/profile/cards/FoodPreferencesCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/profile/cards/IdentityCard.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxIC
} = React;
function IdentityCard({
  data,
  onChange
}) {
  const {
    t
  } = useCtxIC(window.LifeLocaleContext);
  const Field = window.EditableField;
  return /*#__PURE__*/React.createElement("section", {
    className: "pc-card"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('pc_identity'))), /*#__PURE__*/React.createElement("div", {
    className: "pc-body pc-grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('pc_id_name')), /*#__PURE__*/React.createElement(Field, {
    value: data.name,
    placeholder: t('pc_id_name_ph'),
    onChange: v => onChange({
      name: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "pc-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('pc_id_age')), /*#__PURE__*/React.createElement(Field, {
    value: data.age,
    type: "number",
    mono: true,
    placeholder: t('pc_id_age_ph'),
    onChange: v => onChange({
      age: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "pc-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('pc_id_city')), /*#__PURE__*/React.createElement(Field, {
    value: data.city,
    placeholder: t('pc_id_city_ph'),
    onChange: v => onChange({
      city: v
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "pc-row pc-row-wide"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('pc_id_bio')), /*#__PURE__*/React.createElement(Field, {
    value: data.bio,
    placeholder: t('pc_id_bio_ph'),
    multiline: true,
    onChange: v => onChange({
      bio: v
    })
  }))));
}
window.IdentityCard = IdentityCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/profile/cards/IdentityCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/life-os/profile/cards/MeasurementsCard.jsx
try { (() => {
/* global React */
const {
  useContext: useCtxMC
} = React;
function MeasurementsCard({
  data,
  onChange
}) {
  const {
    t
  } = useCtxMC(window.LifeLocaleContext);
  const Field = window.EditableField;
  const rows = [{
    key: 'chest',
    label: t('pc_meas_chest')
  }, {
    key: 'waist',
    label: t('pc_meas_waist')
  }, {
    key: 'hips',
    label: t('pc_meas_hips')
  }, {
    key: 'neck',
    label: t('pc_meas_neck')
  }, {
    key: 'shoulders',
    label: t('pc_meas_shoulders')
  }, {
    key: 'sleeve',
    label: t('pc_meas_sleeve')
  }, {
    key: 'inseam',
    label: t('pc_meas_inseam')
  }, {
    key: 'shoe',
    label: t('pc_meas_shoe')
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "pc-card"
  }, /*#__PURE__*/React.createElement("header", {
    className: "pc-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pc-title"
  }, t('pc_meas')), /*#__PURE__*/React.createElement("span", {
    className: "pc-sub mono"
  }, t('pc_meas_sub'))), /*#__PURE__*/React.createElement("div", {
    className: "pc-body pc-grid-2"
  }, rows.map(r => /*#__PURE__*/React.createElement("div", {
    className: "pc-row",
    key: r.key
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, r.label), /*#__PURE__*/React.createElement(Field, {
    value: data[r.key],
    type: "number",
    mono: true,
    suffix: t('pc_body_unit_cm'),
    onChange: v => onChange({
      [r.key]: v
    })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "pc-row pc-row-wide"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pc-label mono"
  }, t('pc_body_notes')), /*#__PURE__*/React.createElement(Field, {
    value: data.notes,
    placeholder: t('pc_meas_notes_ph'),
    multiline: true,
    onChange: v => onChange({
      notes: v
    })
  }))));
}
window.MeasurementsCard = MeasurementsCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/life-os/profile/cards/MeasurementsCard.jsx", error: String((e && e.message) || e) }); }

})();
