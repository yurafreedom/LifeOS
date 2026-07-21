import React from 'react';
import { ApiError } from '../api/client.ts';
import { bootstrapAccount, getCurrentUser, loginAccount, logoutAccount } from '../api/auth.ts';

const AuthContext = React.createContext(null);

function AuthProvider({ children }) {
  const [state, setState] = React.useState({ phase: 'booting', user: null, error: null });
  const [bootGeneration, setBootGeneration] = React.useState(0);

  React.useEffect(() => {
    const controller = new window.AbortController();
    let active = true;
    setState(prev => ({ phase: 'booting', user: prev.user, error: null }));
    getCurrentUser(controller.signal)
      .then(user => {
        if (active) setState({ phase: 'authenticated', user, error: null });
      })
      .catch(error => {
        if (!active || error?.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 401 && error.code === 'not_authenticated') {
          setState({ phase: 'anonymous', user: null, error: null });
        } else {
          setState({ phase: 'error', user: null, error });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [bootGeneration]);

  async function login(input) {
    setState({ phase: 'authenticating', user: null, error: null });
    try {
      const user = await loginAccount(input);
      setState({ phase: 'authenticated', user, error: null });
      return user;
    } catch (error) {
      setState({ phase: 'anonymous', user: null, error });
      throw error;
    }
  }

  async function bootstrap(input) {
    setState({ phase: 'authenticating', user: null, error: null });
    try {
      const user = await bootstrapAccount(input);
      setState({ phase: 'authenticated', user, error: null });
      return user;
    } catch (error) {
      setState({ phase: 'anonymous', user: null, error });
      throw error;
    }
  }

  async function logout() {
    setState({ phase: 'logging_out', user: null, error: null });
    try {
      await logoutAccount();
      setState({ phase: 'anonymous', user: null, error: null });
    } catch (error) {
      setState({ phase: 'anonymous', user: null, error });
      throw error;
    }
  }

  function retryBoot() {
    setBootGeneration(value => value + 1);
  }

  function expireSession() {
    setState({ phase: 'anonymous', user: null, error: null });
  }

  const value = React.useMemo(() => ({
    ...state,
    login,
    bootstrap,
    logout,
    retryBoot,
    expireSession,
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

export { AuthContext, AuthProvider, useAuth };
