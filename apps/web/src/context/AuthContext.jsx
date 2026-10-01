import React from 'react';
import { ApiError } from '../api/client.ts';
import { bindAccount, onAuthSignal } from '../api/accountBinding.ts';
import { bootstrapAccount, getCurrentUser, loginAccount, logoutAccount } from '../api/auth.ts';
import { createAuthChannel } from '../app/authChannel.js';

/* AuthProvider · the tab's account identity (JENKIN S1).
 *
 * One rule: account-scoped UI is only ever shown for the account the server
 * says is signed in, and the tab's requests are bound to that account
 * (api/accountBinding.ts). Identity is revalidated with `GET /auth/me` on
 * cross-tab notices, on focus / visibility / pageshow / online, and whenever a
 * bound request is refused (`session_user_mismatch`) or unauthenticated.
 *
 * - same account          → nothing changes;
 * - another account (B)   → the tab stops working for A (generation bump aborts
 *                           A's requests, providers unmount and keep A's unsaved
 *                           edits for A only) and shows the `switched` screen;
 *                           B is displayed only after an explicit choice, in a
 *                           fresh provider tree keyed by B and a new generation;
 * - no session            → `anonymous` with an `expired` notice.
 *
 * Logout never claims success the server did not confirm: on failure the
 * session is still active and the tab stays signed in, with the error. */

const AuthContext = React.createContext(null);

const REVALIDATE_MIN_INTERVAL_MS = 2000;

function AuthProvider({ children }) {
  const [state, setStateRaw] = React.useState({
    phase: 'booting', user: null, error: null, generation: 0,
    notice: null, next: null, loggingOut: false, logoutError: null,
  });
  const stateRef = React.useRef(state);
  const setState = React.useCallback((update) => {
    setStateRaw(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      stateRef.current = next;
      return next;
    });
  }, []);
  const [bootGeneration, setBootGeneration] = React.useState(0);
  const channelRef = React.useRef(null);
  const guardRef = React.useRef(null);
  const revalidatingRef = React.useRef(null);
  const lastRevalidateRef = React.useRef(0);

  const enterAuthenticated = React.useCallback((user, notice = null) => {
    bindAccount(user.id);
    setState(prev => ({
      phase: 'authenticated', user, error: null, generation: prev.generation + 1,
      notice, next: null, loggingOut: false, logoutError: null,
    }));
  }, [setState]);

  const enterAnonymous = React.useCallback((notice = null, error = null) => {
    bindAccount(null);
    setState(prev => ({
      phase: 'anonymous', user: null, error, generation: prev.generation + 1,
      notice, next: null, loggingOut: false, logoutError: null,
    }));
  }, [setState]);

  /* Ask the server who is signed in and reconcile the tab with the answer. */
  const revalidate = React.useCallback(({ force = false, refreshUser = false, signedOutNotice = null } = {}) => {
    const current = stateRef.current;
    if (current.phase !== 'authenticated' && current.phase !== 'switched' && current.phase !== 'anonymous') {
      return Promise.resolve();
    }
    if (revalidatingRef.current) return revalidatingRef.current;
    const now = Date.now();
    if (!force && now - lastRevalidateRef.current < REVALIDATE_MIN_INTERVAL_MS) return Promise.resolve();
    lastRevalidateRef.current = now;
    const task = getCurrentUser()
      .then(user => {
        const latest = stateRef.current;
        if (latest.phase === 'authenticated' && latest.user?.id === user.id) {
          // Same account: only refresh its descriptive fields (role, verification).
          if (refreshUser) setState(prev => (prev.user?.id === user.id ? { ...prev, user } : prev));
          return;
        }
        if (latest.phase === 'switched' && latest.next?.id === user.id) return;
        if (latest.phase === 'authenticated' && latest.user) {
          // Another tab signed in as someone else: stop working for the old account first.
          bindAccount(null);
          setState(prev => ({
            ...prev, phase: 'switched', next: user, error: null,
            generation: prev.generation + 1, loggingOut: false, logoutError: null,
          }));
          return;
        }
        if (latest.phase === 'switched') {
          setState(prev => ({ ...prev, next: user }));
          return;
        }
        // Anonymous tab: another tab signed in. Show that account in a fresh tree.
        enterAuthenticated(user, { kind: 'signed_in_elsewhere' });
      })
      .catch(error => {
        if (error?.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 401) {
          const latest = stateRef.current;
          if (latest.phase === 'anonymous') return;
          enterAnonymous(signedOutNotice ?? {
            kind: latest.phase === 'authenticated' ? 'expired' : 'signed_out_elsewhere',
            email: latest.user?.email ?? null,
          });
        }
        // Network trouble is not a logout: keep the current view; the next
        // bound request or focus event will revalidate again.
      })
      .finally(() => { revalidatingRef.current = null; });
    revalidatingRef.current = task;
    return task;
  }, [enterAnonymous, enterAuthenticated, setState]);

  /* Boot: who is signed in? */
  React.useEffect(() => {
    const controller = new window.AbortController();
    let active = true;
    setState(prev => ({ ...prev, phase: 'booting', error: null }));
    getCurrentUser(controller.signal)
      .then(user => { if (active) enterAuthenticated(user); })
      .catch(error => {
        if (!active || error?.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 401 && error.code === 'not_authenticated') {
          enterAnonymous();
        } else {
          bindAccount(null);
          setState(prev => ({ ...prev, phase: 'error', user: null, error }));
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [bootGeneration, enterAnonymous, enterAuthenticated, setState]);

  /* Cross-tab notices, server refusals and foreground/resume all revalidate. */
  React.useEffect(() => {
    const channel = createAuthChannel(() => { void revalidate({ force: true }); });
    channelRef.current = channel;
    const unsubscribe = onAuthSignal(() => { void revalidate({ force: true }); });
    const onForeground = () => {
      if (document.visibilityState === 'hidden') return;
      void revalidate();
    };
    const onPageShow = (event) => { if (event.persisted) void revalidate({ force: true }); };
    window.addEventListener('focus', onForeground);
    window.addEventListener('online', onForeground);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onForeground);
    return () => {
      channel.close();
      channelRef.current = null;
      unsubscribe();
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('online', onForeground);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onForeground);
    };
  }, [revalidate]);

  async function login(input) {
    setState(prev => ({ ...prev, phase: 'authenticating', error: null }));
    try {
      const user = await loginAccount(input);
      enterAuthenticated(user);
      channelRef.current?.post('signed_in');
      return user;
    } catch (error) {
      setState(prev => ({ ...prev, phase: 'anonymous', user: null, error }));
      throw error;
    }
  }

  async function bootstrap(input) {
    setState(prev => ({ ...prev, phase: 'authenticating', error: null }));
    try {
      const user = await bootstrapAccount(input);
      enterAuthenticated(user);
      channelRef.current?.post('signed_in');
      return user;
    } catch (error) {
      setState(prev => ({ ...prev, phase: 'anonymous', user: null, error }));
      throw error;
    }
  }

  /* A flow that already established a session (invitation acceptance). */
  function acceptSession(user) {
    enterAuthenticated(user);
    channelRef.current?.post('signed_in');
  }

  /* The data provider registers a guard that saves (or explicitly resolves)
     unsaved edits before a voluntary logout. It returns true when it is safe
     to proceed; false when it opened its own resolution dialog. */
  function setLogoutGuard(guard) {
    guardRef.current = guard;
    return () => { if (guardRef.current === guard) guardRef.current = null; };
  }

  async function logout({ force = false } = {}) {
    const current = stateRef.current;
    if (current.phase === 'switched' || current.phase === 'error') {
      // Nothing account-scoped is mounted; sign out whoever the cookie names.
      force = true;
    } else if (current.phase !== 'authenticated') {
      return { status: 'skipped' };
    }
    if (!force && guardRef.current) {
      const ready = await guardRef.current();
      if (!ready) return { status: 'blocked' };
    }
    setState(prev => ({ ...prev, loggingOut: true, logoutError: null }));
    try {
      await logoutAccount();
    } catch (error) {
      if (error?.name === 'AbortError') return { status: 'aborted' };
      // The server did not confirm: the session may still be active. Stay signed in.
      setState(prev => ({ ...prev, loggingOut: false, logoutError: error }));
      throw error;
    }
    enterAnonymous({ kind: 'signed_out' });
    channelRef.current?.post('signed_out');
    return { status: 'signed_out' };
  }

  function continueAsNext() {
    const current = stateRef.current;
    if (current.phase !== 'switched' || !current.next) return;
    enterAuthenticated(current.next, { kind: 'switched_from', email: current.user?.email ?? null });
  }

  function retryBoot() {
    setBootGeneration(value => value + 1);
  }

  /* A coordinator saw 401: confirm with the server rather than guessing. */
  function expireSession() {
    void revalidate({ force: true });
  }

  function dismissNotice() {
    setState(prev => ({ ...prev, notice: null }));
  }

  function showNotice(notice) {
    setState(prev => ({ ...prev, notice }));
  }

  const value = React.useMemo(() => ({
    ...state,
    login,
    bootstrap,
    acceptSession,
    logout,
    retryBoot,
    expireSession,
    revalidate,
    continueAsNext,
    setLogoutGuard,
    dismissNotice,
    showNotice,
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

export { AuthContext, AuthProvider, useAuth };
