import React from 'react';
import { ApiError } from '../../api/client.ts';
import {
  acceptInvitation,
  confirmEmailVerification,
  confirmPasswordReset,
  inspectInvitation,
} from '../../api/auth.ts';
import { JenkinWordmark } from '../../components/JenkinBrand.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { LifeLocaleContext } from '../../context/LocaleContext.jsx';

/* Pages behind the links in security mail (JENKIN S1): password reset, email
   verification, invitation acceptance. Each states exactly what happened —
   no optimistic "done" before the server confirms. */

function errorText(error, t) {
  if (!(error instanceof ApiError)) return t('auth_network_error');
  if (error.code === 'invalid_or_expired_token') return t('auth_link_invalid');
  if (error.code === 'invalid_or_expired_invitation') return t('invite_invalid');
  if (error.code === 'invitation_email_mismatch') return t('invite_email_mismatch');
  if (error.code === 'email_already_registered') return t('invite_already_registered');
  if (error.code === 'too_many_attempts') return t('auth_too_many');
  if (error.status === 422) return t('auth_password_length');
  return t('auth_action_failed');
}

function Card({ eyebrow, title, children }) {
  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-action-title">
        <div className="auth-brand" role="img" aria-label="JENKIN"><JenkinWordmark /></div>
        <p className="auth-eyebrow mono">{eyebrow}</p>
        <h1 id="auth-action-title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

function NewPasswordFields({ t, password, setPassword, confirm, setConfirm }) {
  return (
    <>
      <label>
        <span>{t('auth_new_password')}</span>
        <input type="password" autoComplete="new-password" required minLength={12}
               value={password} onChange={event => setPassword(event.target.value)} />
      </label>
      <label>
        <span>{t('auth_password_confirm')}</span>
        <input type="password" autoComplete="new-password" required minLength={12}
               value={confirm} onChange={event => setConfirm(event.target.value)} />
      </label>
    </>
  );
}

function localPasswordProblem(password, confirm, t) {
  if (password.length < 12) return t('auth_password_length');
  if (password !== confirm) return t('auth_password_mismatch');
  return '';
}

function ResetAction({ token, onDone, t, signedInAs }) {
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [state, setState] = React.useState({ phase: 'form', error: '' });
  async function submit(event) {
    event.preventDefault();
    const problem = localPasswordProblem(password, confirm, t);
    if (problem) { setState({ phase: 'form', error: problem }); return; }
    setState({ phase: 'busy', error: '' });
    try {
      await confirmPasswordReset(token, password);
      setPassword(''); setConfirm('');
      setState({ phase: 'done', error: '' });
    } catch (error) {
      setState({ phase: 'form', error: errorText(error, t) });
    }
  }
  if (state.phase === 'done') {
    return (
      <Card eyebrow={t('reset_eyebrow')} title={t('reset_done_title')}>
        <p className="auth-success" role="status">{t('reset_done_copy')}</p>
        <button className="auth-submit" onClick={() => onDone({ kind: 'password_reset' })}>{t('auth_to_login')}</button>
      </Card>
    );
  }
  return (
    <Card eyebrow={t('reset_eyebrow')} title={t('reset_title')}>
      <p className="auth-copy">{t('reset_copy')}</p>
      {signedInAs && <p className="auth-notice" role="status">{t('reset_signed_in_note', signedInAs)}</p>}
      <form className="auth-form" onSubmit={submit}>
        <NewPasswordFields t={t} password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} />
        {state.error && <div className="auth-error" role="alert">{state.error}</div>}
        <button className="auth-submit" type="submit" disabled={state.phase === 'busy'}>
          {state.phase === 'busy' ? t('auth_working') : t('reset_submit')}
        </button>
      </form>
      <button className="auth-link auth-link-button" onClick={() => onDone(null)}>{t('auth_cancel_action')}</button>
    </Card>
  );
}

function VerifyAction({ token, onDone, t }) {
  const auth = useAuth();
  const [state, setState] = React.useState({ phase: 'ready', error: '' });
  async function confirm() {
    setState({ phase: 'busy', error: '' });
    try {
      await confirmEmailVerification(token);
      setState({ phase: 'done', error: '' });
      void auth.revalidate({ force: true, refreshUser: true });
    } catch (error) {
      setState({ phase: 'ready', error: errorText(error, t) });
    }
  }
  if (state.phase === 'done') {
    return (
      <Card eyebrow={t('verify_eyebrow')} title={t('verify_done_title')}>
        <p className="auth-success" role="status">{t('verify_done_copy')}</p>
        <button className="auth-submit" onClick={() => onDone(null)}>{t('auth_continue')}</button>
      </Card>
    );
  }
  return (
    <Card eyebrow={t('verify_eyebrow')} title={t('verify_title')}>
      <p className="auth-copy">{t('verify_copy')}</p>
      {state.error && <div className="auth-error" role="alert">{state.error}</div>}
      <div className="import-actions">
        <button className="auth-submit" disabled={state.phase === 'busy'} onClick={confirm}>
          {state.phase === 'busy' ? t('auth_working') : t('verify_submit')}
        </button>
        <button className="set-btn-ghost" onClick={() => onDone(null)}>{t('auth_cancel_action')}</button>
      </div>
    </Card>
  );
}

function InviteAction({ token, onDone, t }) {
  const auth = useAuth();
  const [preview, setPreview] = React.useState({ phase: 'loading', email: '', error: '' });
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [submit, setSubmit] = React.useState({ busy: false, error: '' });

  React.useEffect(() => {
    let active = true;
    inspectInvitation(token)
      .then(result => { if (active) setPreview({ phase: 'ready', email: result.email, error: '' }); })
      .catch(error => { if (active && error?.name !== 'AbortError') setPreview({ phase: 'invalid', email: '', error: errorText(error, t) }); });
    return () => { active = false; };
  }, [token]);

  async function accept(event) {
    event.preventDefault();
    const problem = localPasswordProblem(password, confirm, t);
    if (problem) { setSubmit({ busy: false, error: problem }); return; }
    setSubmit({ busy: true, error: '' });
    try {
      const user = await acceptInvitation({ token, email: preview.email, password });
      setPassword(''); setConfirm('');
      onDone(null);
      auth.acceptSession(user);
    } catch (error) {
      setSubmit({ busy: false, error: errorText(error, t) });
    }
  }

  if (auth.phase === 'authenticated' && auth.user) {
    return (
      <Card eyebrow={t('invite_eyebrow')} title={t('invite_title')}>
        <p className="auth-notice" role="status">{t('invite_signed_in', auth.user.email)}</p>
        <div className="import-actions">
          <button className="set-btn-ghost" onClick={() => { auth.logout().catch(() => {}); }}>{t('auth_logout')}</button>
          <button className="set-btn-ghost" onClick={() => onDone(null)}>{t('auth_cancel_action')}</button>
        </div>
      </Card>
    );
  }
  if (preview.phase === 'loading') {
    return <Card eyebrow={t('invite_eyebrow')} title={t('invite_title')}><p className="boot-status mono">{t('boot_loading')}</p></Card>;
  }
  if (preview.phase === 'invalid') {
    return (
      <Card eyebrow={t('invite_eyebrow')} title={t('invite_title')}>
        <div className="auth-error" role="alert">{preview.error}</div>
        <button className="auth-link auth-link-button" onClick={() => onDone(null)}>{t('auth_to_login')}</button>
      </Card>
    );
  }
  return (
    <Card eyebrow={t('invite_eyebrow')} title={t('invite_title')}>
      <p className="auth-copy">{t('invite_copy')}</p>
      <form className="auth-form" onSubmit={accept}>
        <label>
          <span>{t('auth_email')}</span>
          <input type="email" autoComplete="username" readOnly value={preview.email} />
        </label>
        <NewPasswordFields t={t} password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} />
        {submit.error && <div className="auth-error" role="alert">{submit.error}</div>}
        <button className="auth-submit" type="submit" disabled={submit.busy}>
          {submit.busy ? t('auth_working') : t('invite_submit')}
        </button>
      </form>
    </Card>
  );
}

function AuthActionPage({ action, onDone }) {
  const { t } = React.useContext(LifeLocaleContext);
  const auth = useAuth();
  if (action.kind === 'reset') {
    return <ResetAction token={action.token} onDone={onDone} t={t}
                        signedInAs={auth.phase === 'authenticated' ? auth.user?.email : null} />;
  }
  if (action.kind === 'verify') return <VerifyAction token={action.token} onDone={onDone} t={t} />;
  return <InviteAction token={action.token} onDone={onDone} t={t} />;
}

export { AuthActionPage };
