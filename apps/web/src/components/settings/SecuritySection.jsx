import React from 'react';
import { ApiError } from '../../api/client.ts';
import {
  changePassword,
  createInvitation,
  listInvitations,
  listSecurityEvents,
  listSessions,
  revokeInvitation,
  revokeOtherSessions,
  revokeSession,
  sendEmailVerification,
} from '../../api/accountSecurity.ts';
import { useAuth } from '../../context/AuthContext.jsx';
import { LifeLocaleContext } from '../../context/LocaleContext.jsx';
import { Row } from './Row.jsx';

/* Settings → Безопасность (JENKIN S1): email verification, password change,
   sessions, the owner's private invitations and recent security events.
   Every status shown is the server's answer — "sent" only after the mail
   adapter accepted the message, "changed" only after the server confirmed. */

function useFormatDate() {
  const { locale } = React.useContext(LifeLocaleContext);
  return React.useCallback((iso) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU', {
      timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }, [locale]);
}

function apiMessage(error, t, fallbackKey) {
  if (error?.name === 'AbortError') return '';
  if (!(error instanceof ApiError)) return t('auth_network_error');
  const map = {
    mail_unavailable: 'sec_mail_unavailable',
    mail_delivery_failed: 'sec_mail_failed',
    too_many_attempts: 'auth_too_many',
    already_verified: 'sec_already_verified',
    invalid_current_password: 'sec_current_wrong',
    email_already_registered: 'sec_invite_registered',
    owner_required: 'sec_owner_required',
    invitation_not_pending: 'sec_invite_not_pending',
    session_not_found: 'sec_session_gone',
  };
  if (map[error.code]) return t(map[error.code]);
  if (error.status === 422) return t('auth_validation_error');
  return t(fallbackKey);
}

function EmailVerification({ t }) {
  const auth = useAuth();
  const [state, setState] = React.useState({ busy: false, message: '', error: '' });
  const verified = !!auth.user?.email_verified_at;
  async function send() {
    setState({ busy: true, message: '', error: '' });
    try {
      await sendEmailVerification();
      setState({ busy: false, message: t('sec_verify_sent', auth.user?.email || ''), error: '' });
    } catch (error) {
      setState({ busy: false, message: '', error: apiMessage(error, t, 'sec_mail_failed') });
    }
  }
  return (
    <Row label={t('sec_email_status')} hint={state.error || state.message}>
      <div className="sec-inline">
        <span className={'sec-badge mono' + (verified ? ' is-ok' : '')}>{verified ? t('sec_verified') : t('sec_not_verified')}</span>
        {!verified && (
          <button className="set-btn-ghost" disabled={state.busy} onClick={send}>
            {state.busy ? t('auth_working') : t('sec_verify_send')}
          </button>
        )}
      </div>
    </Row>
  );
}

function PasswordChange({ t, onChanged }) {
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [state, setState] = React.useState({ busy: false, message: '', error: '' });
  async function submit(event) {
    event.preventDefault();
    if (next.length < 12) { setState({ busy: false, message: '', error: t('auth_password_length') }); return; }
    if (next !== confirm) { setState({ busy: false, message: '', error: t('auth_password_mismatch') }); return; }
    setState({ busy: true, message: '', error: '' });
    try {
      const result = await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      setState({ busy: false, message: t('sec_password_changed', result.revoked_sessions), error: '' });
      onChanged();
    } catch (error) {
      setCurrent('');
      setState({ busy: false, message: '', error: apiMessage(error, t, 'sec_password_failed') });
    }
  }
  return (
    <form className="sec-form" onSubmit={submit}>
      <div className="set-subhead mono">{t('sec_password_head')}</div>
      <label className="sec-field">
        <span>{t('sec_password_current')}</span>
        <input className="set-input" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} />
      </label>
      <label className="sec-field">
        <span>{t('auth_new_password')}</span>
        <input className="set-input" type="password" autoComplete="new-password" required minLength={12} value={next} onChange={e => setNext(e.target.value)} />
      </label>
      <label className="sec-field">
        <span>{t('auth_password_confirm')}</span>
        <input className="set-input" type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)} />
      </label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.message && <p className="auth-success" role="status">{state.message}</p>}
      <button className="set-btn-primary" type="submit" disabled={state.busy}>{state.busy ? t('auth_working') : t('sec_password_submit')}</button>
    </form>
  );
}

function Sessions({ t, refreshKey }) {
  const format = useFormatDate();
  const [state, setState] = React.useState({ phase: 'loading', rows: [], error: '', busy: null });
  const load = React.useCallback((signal) => {
    listSessions(signal)
      .then(rows => setState({ phase: 'ready', rows, error: '', busy: null }))
      .catch(error => {
        if (error?.name === 'AbortError') return;
        setState(prev => ({ ...prev, phase: 'error', error: apiMessage(error, t, 'sec_load_failed'), busy: null }));
      });
  }, [t]);
  React.useEffect(() => {
    const controller = new window.AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);
  async function revoke(id) {
    setState(prev => ({ ...prev, busy: id, error: '' }));
    try { await revokeSession(id); } catch (error) {
      setState(prev => ({ ...prev, busy: null, error: apiMessage(error, t, 'sec_revoke_failed') }));
      return;
    }
    load();
  }
  async function revokeOthers() {
    setState(prev => ({ ...prev, busy: 'others', error: '' }));
    try { await revokeOtherSessions(); } catch (error) {
      setState(prev => ({ ...prev, busy: null, error: apiMessage(error, t, 'sec_revoke_failed') }));
      return;
    }
    load();
  }
  const others = state.rows.filter(row => !row.current).length;
  return (
    <section className="sec-block" aria-labelledby="sec-sessions-head">
      <div className="set-subhead mono" id="sec-sessions-head">{t('sec_sessions_head')}</div>
      {state.phase === 'loading' && <p className="set-row-hint">{t('boot_loading')}</p>}
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <ul className="sec-list">
        {state.rows.map(row => (
          <li key={row.id} className="sec-item">
            <div className="sec-item-main">
              <span className="sec-item-title">{row.device || t('sec_device_unknown')}</span>
              {row.current && <span className="sec-badge mono is-ok">{t('sec_session_current')}</span>}
            </div>
            <div className="sec-item-meta mono">{t('sec_session_meta', format(row.created_at), format(row.last_seen_at))}</div>
            {!row.current && (
              <button className="set-btn-ghost" disabled={state.busy != null} onClick={() => revoke(row.id)}>
                {state.busy === row.id ? t('auth_working') : t('sec_session_revoke')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {others > 0 && (
        <button className="set-btn-ghost" disabled={state.busy != null} onClick={revokeOthers}>
          {state.busy === 'others' ? t('auth_working') : t('sec_sessions_revoke_others', others)}
        </button>
      )}
    </section>
  );
}

function Invitations({ t }) {
  const format = useFormatDate();
  const [email, setEmail] = React.useState('');
  const [rows, setRows] = React.useState({ phase: 'loading', items: [], error: '' });
  const [created, setCreated] = React.useState(null);
  const [state, setState] = React.useState({ busy: false, error: '' });
  const [copied, setCopied] = React.useState(false);
  const load = React.useCallback((signal) => {
    listInvitations(signal)
      .then(items => setRows({ phase: 'ready', items, error: '' }))
      .catch(error => {
        if (error?.name === 'AbortError') return;
        setRows({ phase: 'error', items: [], error: apiMessage(error, t, 'sec_load_failed') });
      });
  }, [t]);
  React.useEffect(() => {
    const controller = new window.AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function invite(event) {
    event.preventDefault();
    setState({ busy: true, error: '' });
    setCreated(null);
    setCopied(false);
    try {
      const result = await createInvitation(email);
      setCreated(result);
      setEmail('');
      setState({ busy: false, error: '' });
      load();
    } catch (error) {
      setState({ busy: false, error: apiMessage(error, t, 'sec_invite_failed') });
    }
  }
  async function revoke(id) {
    try { await revokeInvitation(id); } catch (error) {
      setState({ busy: false, error: apiMessage(error, t, 'sec_invite_failed') });
      return;
    }
    load();
  }
  async function copy() {
    try {
      await window.navigator.clipboard.writeText(created.invite_url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <section className="sec-block" aria-labelledby="sec-invite-head">
      <div className="set-subhead mono" id="sec-invite-head">{t('sec_invite_head')}</div>
      <p className="set-row-hint sec-copy">{t('sec_invite_copy')}</p>
      <form className="sec-inline sec-invite-form" onSubmit={invite}>
        <input className="set-input" type="email" required placeholder={t('auth_email')} aria-label={t('auth_email')}
               value={email} onChange={e => setEmail(e.target.value)} />
        <button className="set-btn-primary" type="submit" disabled={state.busy}>{state.busy ? t('auth_working') : t('sec_invite_submit')}</button>
      </form>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {created && created.delivery === 'sent' && (
        <p className="auth-success" role="status">{t('sec_invite_sent', created.email)}</p>
      )}
      {created && created.invite_url && (
        <div className="auth-notice sec-manual" role="status">
          <p>{t(created.delivery === 'failed' ? 'sec_invite_mail_failed' : 'sec_invite_manual', created.email)}</p>
          <div className="sec-inline">
            <input className="set-input mono" readOnly value={created.invite_url} aria-label={t('sec_invite_link')} onFocus={e => e.target.select()} />
            <button type="button" className="set-btn-ghost" onClick={copy}>{copied ? t('sec_copied') : t('sec_copy')}</button>
          </div>
        </div>
      )}
      {rows.error && <p className="auth-error" role="alert">{rows.error}</p>}
      {rows.items.length > 0 && (
        <ul className="sec-list">
          {rows.items.map(item => (
            <li key={item.id} className="sec-item">
              <div className="sec-item-main">
                <span className="sec-item-title">{item.email}</span>
                <span className={'sec-badge mono' + (item.status === 'accepted' ? ' is-ok' : '')}>{t('sec_invite_status_' + item.status)}</span>
              </div>
              <div className="sec-item-meta mono">{t('sec_invite_meta', format(item.created_at), format(item.expires_at), t('sec_delivery_' + item.delivery))}</div>
              {item.status === 'pending' && <button className="set-btn-ghost" onClick={() => revoke(item.id)}>{t('sec_invite_revoke')}</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const EVENT_KEYS = new Set([
  'account_bootstrapped', 'login_succeeded', 'login_failed', 'login_throttled', 'logout',
  'session_revoked', 'sessions_revoked_others', 'password_changed', 'password_change_failed',
  'password_reset_requested', 'password_reset_delivery_failed', 'password_reset_completed',
  'email_verification_sent', 'email_verified', 'invitation_created', 'invitation_revoked',
  'invitation_accepted',
]);

function SecurityEvents({ t, refreshKey }) {
  const format = useFormatDate();
  const [state, setState] = React.useState({ rows: [], error: '' });
  React.useEffect(() => {
    const controller = new window.AbortController();
    listSecurityEvents(controller.signal)
      .then(rows => setState({ rows: rows.slice(0, 20), error: '' }))
      .catch(error => { if (error?.name !== 'AbortError') setState({ rows: [], error: apiMessage(error, t, 'sec_load_failed') }); });
    return () => controller.abort();
  }, [t, refreshKey]);
  return (
    <section className="sec-block" aria-labelledby="sec-events-head">
      <div className="set-subhead mono" id="sec-events-head">{t('sec_events_head')}</div>
      <p className="set-row-hint sec-copy">{t('sec_events_copy')}</p>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.rows.length === 0 && !state.error && <p className="set-row-hint">{t('sec_events_empty')}</p>}
      <ul className="sec-list sec-events">
        {state.rows.map((row, index) => (
          <li key={row.occurred_at + index} className="sec-item">
            <div className="sec-item-main">
              <span className="sec-item-title">{EVENT_KEYS.has(row.event) ? t('sec_event_' + row.event) : row.event}</span>
            </div>
            <div className="sec-item-meta mono">{[format(row.occurred_at), row.device_label, row.network].filter(Boolean).join(' · ')}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SecuritySection({ t }) {
  const auth = useAuth();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const refresh = React.useCallback(() => setRefreshKey(value => value + 1), []);
  return (
    <div className="sec-wrap">
      <Row label={t('set_account_email')}><input className="set-input is-readonly" readOnly value={auth.user?.email || ''} /></Row>
      <EmailVerification t={t} />
      <PasswordChange t={t} onChanged={refresh} />
      <Sessions t={t} refreshKey={refreshKey} />
      {auth.user?.role === 'owner' && <Invitations t={t} />}
      <SecurityEvents t={t} refreshKey={refreshKey} />
    </div>
  );
}
