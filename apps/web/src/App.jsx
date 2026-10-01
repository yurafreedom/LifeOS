import React from 'react';
import { takeAuthAction } from './app/authActions.js';
import { createClarifyHandlers } from './app/clarifyHandlers.js';
import {
  CalendarPage,
  DogPage,
  ExperimentPage,
  FinanceAnalytics,
  MedicationsPage,
  MetricHistoryPage,
  ProjectAnalyticsPage,
  ReviewPage,
  RouteFallback,
  SettingsPage,
  SystemReviewPage,
  UpdatesPage,
} from './app/lazyRoutes.jsx';
import { useParadisePress } from './app/paradisePress.js';
import { saveTaskDetail } from './app/taskDetailSave.js';
import { useUiSound } from './app/useUiSound.js';
import { ANALYTICS_ROUTE_ENABLED, normalizeRoute, readRouteFromHash } from './app/routeRegistry.js';
import { useLocalePreference } from './app/useLocalePreference.js';
import { useSidebarCollapsed } from './app/useSidebarCollapsed.js';
import { useTheme } from './app/useTheme.js';
import { ClarifyPanel } from './components/ClarifyPanel.jsx';
import { MobileBottomNav } from './components/MobileBottomNav.jsx';
import { ParadiseScene } from './components/ParadiseScene.jsx';
import { QuickAddModal } from './components/QuickAddModal.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { SyncStatus } from './components/SyncStatus.jsx';
import { TaskDetailModal } from './components/TaskDetailModal.jsx';
import { Toast } from './components/Toast.jsx';
import { TopBar } from './components/TopBar.jsx';
import { LifeDataContext, LifeDataProvider } from './context/LifeDataContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AnalyticsProvider } from './context/AnalyticsContext.jsx';
import { LifeLocaleContext, LifeLocales, LifeMakeT } from './context/LocaleContext.jsx';
import { createQuickAddTaskRecord, isTaskActive } from './domain/tasks.ts';
import { FinancesPage } from './pages/FinancesPage.jsx';
import { HealthPage } from './pages/HealthPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { AuthActionPage } from './pages/auth/AuthActionPage.jsx';
import { PlaceholderPage } from './pages/PlaceholderPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { ProjectsPage } from './pages/ProjectsPage.jsx';
import { QuickNotesPage } from './pages/QuickNotesPage.jsx';
import { GoalsPage, HabitsPage } from './pages/RelocatedPages.jsx';
import { TasksPage } from './pages/TasksPage.jsx';

/* global React, ReactDOM */
const {
  useState: useStateApp,
  useEffect: useEffectApp,
  useMemo: useMemoApp,
  useContext: useCtxApp,
} = React;

/* Batch 1: the demo/debug rail (tg test / sys test / cycle milestone / empty
   states / D-L-P-S) is dev-only. Hidden unless the URL carries ?debug
   (survives hash routing, e.g. index.html?debug#/home). Nothing removed;
   real language/theme toggles remain in Settings. */
const LIFE_DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('debug');


/* AppShell · all the existing chrome + routing. Lives inside the
   LifeDataProvider so it can read tasks/quickNotes/profile/dog from
   the central tree and dispatch mutations through the same provider.
   UI-only state (toast, modal open flags, milestone, demo-rail
   empty-mode toggle) stays local — those are ephemeral, not persisted. */
function AppShell({ user }) {
  const data = useCtxApp(LifeDataContext);
  const persist = data.state;

  const { locale, setLocale, t, themeMode, themeEff, setTheme, scenePref, setScenePref } = useCtxApp(LifeLocaleContext);
  const [route, setRouteRaw]      = useStateApp(() => readRouteFromHash());
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [toast, setToast]         = useStateApp(null);
  const [milestone, setMilestone] = useStateApp({ days: 30, habitKey: 'habit_no_phone' });
  const [quickOpen, setQuickOpen] = useStateApp(false);
  const [quickStakes, setQStakes] = useStateApp(false);
  const [quickSeed, setQuickSeed] = useStateApp(null);
  const [detailTask, setDetail]   = useStateApp(null);
  const [clarifyNote, setClarify] = useStateApp(null);
  const [emptyMode, setEmptyMode] = useStateApp(false);

  function setRoute(next) {
    const { route: nextRoute, hash: target } = normalizeRoute(next);
    setRouteRaw(nextRoute);
    if (window.location.hash !== target) window.location.hash = target;
  }
  useEffectApp(() => {
    function onHash() { setRouteRaw(readRouteFromHash()); }
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/' + route;
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffectApp(() => {
    document.documentElement.setAttribute('data-route', route);
  }, [route]);

  /* Seed tasks resolve titles through i18n; user-added tasks store
     literal title. Same logic as Sprint 2 — just sourced from the
     persisted state tree instead of local useState. */
  const tasks = persist.tasks || [];
  const quickNotes = persist.quickNotes || [];
  const projects = persist.projects || [];
  const waitingItems = persist.waitingItems || [];
  const references = persist.references || [];
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
    /* schedule.date is the Calendar date; due is the non-localised label. */
    const task = createQuickAddTaskRecord({
      title,
      stakes,
      category,
      tagLabel: category ? category.name[locale] : null,
      schedule,
      notes,
    });
    data.addTask(task);
    if (fromNoteId != null) data.deleteQuickNote(fromNoteId);
    showToast({
      kind: 'sys',
      msg: stakes ? t('toast_committed', title) : t('toast_added', title),
      ts: new Date().toTimeString().slice(0,5) + ' · ' + t('nav_today'),
    });
  }

  const clarifyHandlers = createClarifyHandlers({ data, t, showToast });


  function showToast(toastObj) {
    setToast(toastObj);
    clearTimeout(window.__toastT);
    const __toastT = setTimeout(() => setToast(null), 4200);
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

  useParadisePress();
  useUiSound();

  const counts = {
    notes:  quickNotes.length,
    tasks:  resolvedTasks.filter(isTaskActive).length,
    habits: (persist.habits || []).length,
    goals:  (persist.goals || []).filter(goal => !(Number(goal.pct) >= 100)).length,
    projects: projects.filter(project => project.status === 'active').length,
  };

  function renderRoute() {
    switch (route) {
      case 'home':
        return <HomePage
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
        return <CalendarPage onAddForDay={(date) => openQuickAdd(false, { date })} />;
      case 'notes':
        return (
          <QuickNotesPage
            notes={quickNotes}
            references={references}
            onAdd={(text) => data.addQuickNote(text)}
            onClarify={(note) => setClarify(note)}
          />
        );
      case 'me':
        return <ProfilePage profile={profile} onUpdate={data.updateProfile} />;
      case 'tasks':
        return (
          <TasksPage
            tasks={emptyMode ? [] : resolvedTasks}
            waitingItems={emptyMode ? [] : waitingItems}
            onToggle={data.toggleTask}
            onAdd={addTaskFromUI}
            onOpen={(task) => setDetail({ ...task, persisted: true })}
          />
        );
      case 'habits':
        return <HabitsPage emptyMode={emptyMode} />;
      case 'goals':
        return <GoalsPage emptyMode={emptyMode} />;
      case 'projects':
        return <ProjectsPage />;
      case 'health':
        return <HealthPage />;
      case 'dog':
        return <DogPage dog={dog} onUpdate={data.updateDog} locale={locale} t={t} />;
      case 'finances':
        return <FinancesPage
          emptyMode={emptyMode}
          onAnalytics={ANALYTICS_ROUTE_ENABLED ? () => setRoute('analytics') : null}
        />;
      case 'analytics':
        return <FinanceAnalytics onHistory={() => setRoute('analytics-history')} />;
      case 'analytics-history':
        return <MetricHistoryPage onBack={() => setRoute('analytics')} />;
      case 'review':
        return <ReviewPage />;
      case 'project-analytics':
        return <ProjectAnalyticsPage />;
      case 'experiment':
        return <ExperimentPage />;
      case 'system-review':
        return <SystemReviewPage />;
      case 'monthly':
        return <PlaceholderPage title={t('ph_monthly_title')} body={t('ph_monthly_body')} />;
      case 'annual':
        return <PlaceholderPage title={t('ph_annual_title')} body={t('ph_annual_body')} />;
      case 'investments':
        return <PlaceholderPage title={t('ph_invest_title')} body={t('ph_invest_body')} />;
      case 'medications':
        return <MedicationsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'updates':
        return <UpdatesPage />;
      default:
        return <PlaceholderPage title={t('ph_home_title')} body={t('ph_home_body')} />;
    }
  }

  return (
    <React.Fragment>
      {themeEff === 'paradise' && <ParadiseScene />}
      <div className="app" data-sb={collapsed ? 'collapsed' : 'expanded'}>
        <Sidebar
          route={route}
          onNav={setRoute}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          counts={counts}
          user={user}
          accountName={profile.identity && typeof profile.identity.name === 'string' ? profile.identity.name : ''}
          syncPhase={data.syncPhase}
          analyticsEnabled={ANALYTICS_ROUTE_ENABLED} />

        <main className="main">
          <TopBar onQuickAdd={() => openQuickAdd(false)} />
          <div className="global-sync"><SyncStatus compact /></div>
          <React.Suspense fallback={<RouteFallback />}>{renderRoute()}</React.Suspense>
        </main>

        {LIFE_DEBUG && <div className="demo-rail">
          <button className="demo-btn" onClick={fireBot}>tg test</button>
          <button className="demo-btn" onClick={() => showToast({ kind: 'sys', msg: t('toast_expense', '4.20', t('habit_read')), ts: new Date().toTimeString().slice(0,5) + ' · ' + t('nav_today') })}>sys test</button>
          <button className="demo-btn" onClick={fireMilestone}>cycle milestone</button>
          <button className="demo-btn" onClick={() => openQuickAdd(false)}>⌘ K</button>
          <button className={"demo-btn" + (emptyMode ? " is-on" : "")} onClick={() => setEmptyMode(v => !v)}>empty states {emptyMode ? 'ON' : 'OFF'}</button>
          <button className="demo-btn" onClick={() => setRoute('settings')}>settings</button>
          <div className="demo-locale">
            {LifeLocales.map(loc => (
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
        </div>}

        <QuickAddModal
          open={quickOpen}
          defaultStakes={quickStakes}
          defaultTitle={quickSeed && quickSeed.title ? quickSeed.title : ''}
          defaultDate={quickSeed && quickSeed.date ? quickSeed.date : ''}
          onClose={() => { setQuickOpen(false); setQuickSeed(null); }}
          onSave={(payload) => {
            addTaskFromUI({ ...payload, fromNoteId: quickSeed ? quickSeed.fromNoteId : undefined });
            setQuickOpen(false);
            setQuickSeed(null);
          }}
        />

        {clarifyNote && (
          <ClarifyPanel
            note={clarifyNote}
            onClose={() => setClarify(null)}
            {...clarifyHandlers}
          />
        )}

        {detailTask && (() => {
          /* Always the persisted task: list rows carry display-resolved
             copies (localised title/due) that must never be saved back. A row
             opened from Tasks whose task has since been removed is shown as
             missing; Home seed rows are display-only (no schedule editing). */
          const persistedTask = tasks.find(x => String(x.id) === String(detailTask.id));
          return (
          <TaskDetailModal
            task={persistedTask || detailTask}
            canSchedule={!!persistedTask}
            missing={!persistedTask && !!detailTask.persisted}
            onClose={() => setDetail(null)}
            onUpdate={(id, patch, schedule) => saveTaskDetail({ tasks, data }, id, patch, schedule)}
            onComplete={(id) => data.toggleTask(id)}
            onDelete={(id) => data.deleteTask(id)}
          />
          );
        })()}

        <Toast toast={toast} />
        <MobileBottomNav active={route} onNav={setRoute} />
      </div>
    </React.Fragment>
  );
}

/* The cookie now belongs to another account (another tab signed in). Nothing
   of the previous account is mounted any more; its unsaved edits were kept on
   this device for that account only. The new account is shown only on an
   explicit choice, in a fresh provider tree. */
function AccountSwitchedScreen({ auth, t }) {
  return (
    <main className="auth-screen">
      <section className="auth-card" role="alertdialog" aria-labelledby="switched-title">
        <h1 id="switched-title">{t('auth_switched_title')}</h1>
        <p className="auth-copy">{t('auth_switched_copy', auth.user?.email || '', auth.next?.email || '')}</p>
        <p className="auth-copy">{t('auth_switched_kept', auth.user?.email || '')}</p>
        <div className="import-actions">
          <button className="auth-submit" onClick={auth.continueAsNext}>{t('auth_switched_continue', auth.next?.email || '')}</button>
          <button className="set-btn-ghost" onClick={() => { auth.logout().catch(() => {}); }}>{t('auth_switched_other')}</button>
        </div>
        {auth.logoutError ? <p className="auth-error" role="alert">{t('auth_logout_error')}</p> : null}
      </section>
    </main>
  );
}

function AuthGate() {
  const auth = useAuth();
  const { t } = useCtxApp(LifeLocaleContext);
  /* A link from security mail (#/auth/{reset|verify|invite}/<token>) is taken
     once, scrubbed from the URL, and handled before anything else. */
  const [action, setAction] = useStateApp(() => takeAuthAction());
  useEffectApp(() => {
    function onHash() {
      const next = takeAuthAction();
      if (next) setAction(next);
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (action && auth.phase !== 'booting') {
    return <AuthActionPage action={action} onDone={(notice) => {
      setAction(null);
      if (window.location.hash.startsWith('#/auth/')) window.location.hash = '#/home';
      if (notice) {
        auth.showNotice(notice);
        // A reset revoked every session of that account, possibly this tab's.
        void auth.revalidate({ force: true, signedOutNotice: notice });
      }
    }} />;
  }
  if (auth.phase === 'booting') {
    return <main className="auth-screen"><div className="boot-status mono">{t('boot_loading')}</div></main>;
  }
  if (auth.phase === 'error') {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>{t('boot_server_title')}</h1>
          <p className="auth-copy">{t('boot_server_copy')}</p>
          <button className="auth-submit" onClick={auth.retryBoot}>{t('boot_retry')}</button>
        </section>
      </main>
    );
  }
  if (auth.phase === 'switched') return <AccountSwitchedScreen auth={auth} t={t} />;
  if (auth.phase !== 'authenticated' || !auth.user) return <LoginPage />;
  /* Keyed by account and generation: a different account — or the same account
     after any identity transition — always mounts a fresh tree, so state loaded
     for one account can never be relabelled as another. */
  const accountKey = `${auth.user.id}:${auth.generation}`;
  return (
    <AnalyticsProvider key={'aa:' + accountKey} user={auth.user}>
      <LifeDataProvider key={'data:' + accountKey} user={auth.user} onSessionExpired={auth.expireSession} onLogout={auth.logout}>
        <AppShell user={auth.user} />
      </LifeDataProvider>
    </AnalyticsProvider>
  );
}

function App() {
  const [locale, setLocale] = useLocalePreference();
  const [themeMode, themeEff, setTheme, scenePref, setScenePref] = useTheme();
  const t = useMemoApp(() => LifeMakeT(locale), [locale]);
  const localeValue = useMemoApp(() => ({
    locale, setLocale, t, themeMode, themeEff, setTheme, scenePref, setScenePref,
  }), [locale, t, themeMode, themeEff, scenePref]);
  return (
    <LifeLocaleContext.Provider value={localeValue}>
      <AuthProvider><AuthGate /></AuthProvider>
    </LifeLocaleContext.Provider>
  );
}

export { AppShell };
export default App;
