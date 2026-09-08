import React from 'react';
import { ApiError } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

function LoginPage() {
  const { t } = React.useContext(LifeLocaleContext);
  const auth = useAuth();
  const setupMode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('bootstrap') === '1';
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [bootstrapToken, setBootstrapToken] = React.useState('');
  const [localError, setLocalError] = React.useState('');
  const submittingRef = React.useRef(false);
  const busy = auth.phase === 'authenticating';

  async function submit(event) {
    event.preventDefault();
    if (busy || submittingRef.current) return;
    setLocalError('');
    if (setupMode && password !== confirmPassword) {
      setLocalError(t('auth_password_mismatch'));
      return;
    }
    if (setupMode && password.length < 12) {
      setLocalError(t('auth_password_length'));
      return;
    }
    submittingRef.current = true;
    try {
      if (setupMode) {
        await auth.bootstrap({ email, password, bootstrapToken });
        setBootstrapToken('');
        setConfirmPassword('');
      } else {
        await auth.login({ email, password });
      }
      setPassword('');
    } catch {
      setPassword('');
      setBootstrapToken('');
    } finally {
      submittingRef.current = false;
    }
  }

  function errorMessage() {
    if (localError) return localError;
    const error = auth.error;
    if (!(error instanceof ApiError)) return error ? t('auth_network_error') : '';
    if (error.code === 'bootstrap_closed') return t('auth_bootstrap_closed');
    if (error.status === 403) return t('auth_bootstrap_invalid');
    if (error.status === 422) return t('auth_validation_error');
    return t('auth_invalid_credentials');
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">Life<span>·</span>OS</div>
        <p className="auth-eyebrow mono">{setupMode ? t('auth_setup_eyebrow') : t('auth_login_eyebrow')}</p>
        <h1 id="auth-title">{setupMode ? t('auth_setup_title') : t('auth_login_title')}</h1>
        <p className="auth-copy">{setupMode ? t('auth_setup_copy') : t('auth_login_copy')}</p>
        <form onSubmit={submit} className="auth-form">
          <label>
            <span>{t('auth_email')}</span>
            <input type="email" autoComplete="email" required value={email}
                   onChange={event => setEmail(event.target.value)} />
          </label>
          <label>
            <span>{t('auth_password')}</span>
            <input type="password" autoComplete={setupMode ? 'new-password' : 'current-password'} required
                   value={password} onChange={event => setPassword(event.target.value)} />
          </label>
          {setupMode && <>
            <label>
              <span>{t('auth_password_confirm')}</span>
              <input type="password" autoComplete="new-password" required value={confirmPassword}
                     onChange={event => setConfirmPassword(event.target.value)} />
            </label>
            <label>
              <span>{t('auth_bootstrap_token')}</span>
              <input type="password" autoComplete="off" required value={bootstrapToken}
                     onChange={event => setBootstrapToken(event.target.value)} />
            </label>
          </>}
          {errorMessage() && <div className="auth-error" role="alert">{errorMessage()}</div>}
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? t('auth_working') : setupMode ? t('auth_create') : t('auth_login')}
          </button>
        </form>
        {setupMode && auth.error instanceof ApiError && auth.error.code === 'bootstrap_closed' && (
          <a className="auth-link" href="/">{t('auth_to_login')}</a>
        )}
      </section>
    </main>
  );
}

export { LoginPage };
