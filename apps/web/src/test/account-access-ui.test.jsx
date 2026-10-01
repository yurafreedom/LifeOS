/* JENKIN S1 · checkpoint 4, client side: mail links, bound security calls,
   honest Security settings. */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAccount, resetAccountBindingForTests } from '../api/accountBinding';
import { changePassword, createInvitation, listSessions } from '../api/accountSecurity';
import { requestPasswordReset } from '../api/auth';
import { readAuthAction, takeAuthAction } from '../app/authActions.js';
import { SecuritySection } from '../components/settings/SecuritySection.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { LifeLocaleContext, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
  resetAccountBindingForTests();
});

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789_-ABCD';

describe('links from security mail', () => {
  it('recognise only well-formed reset / verify / invite fragments', () => {
    expect(readAuthAction(`#/auth/reset/${TOKEN}`)).toEqual({ kind: 'reset', token: TOKEN });
    expect(readAuthAction(`#/auth/verify/${TOKEN}`)).toEqual({ kind: 'verify', token: TOKEN });
    expect(readAuthAction(`#/auth/invite/${TOKEN}`)).toEqual({ kind: 'invite', token: TOKEN });
    expect(readAuthAction('#/auth/reset/short')).toBeNull();
    expect(readAuthAction(`#/auth/admin/${TOKEN}`)).toBeNull();
    expect(readAuthAction('#/home')).toBeNull();
  });

  it('scrub the token from the address bar and history as soon as it is read', () => {
    const replaceState = vi.fn();
    const win = { location: { hash: `#/auth/invite/${TOKEN}`, pathname: '/', search: '' }, history: { replaceState } };
    expect(takeAuthAction(win)).toEqual({ kind: 'invite', token: TOKEN });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/#/auth/invite');
    expect(JSON.stringify(replaceState.mock.calls)).not.toContain(TOKEN);
  });
});

describe('security API calls', () => {
  function stubFetch(body = {}) {
    const fetchMock = vi.fn(async () => new globalThis.Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('are bound to the tab account', async () => {
    const fetchMock = stubFetch({ sessions: [] });
    bindAccount('account-a');
    await listSessions();
    await changePassword('old-password', 'a-brand-new-passphrase');
    await createInvitation('friend@example.com');
    for (const [, init] of fetchMock.mock.calls) {
      expect(new globalThis.Headers(init.headers).get('X-LifeOS-Account')).toBe('account-a');
    }
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ current_password: 'old-password', new_password: 'a-brand-new-passphrase' });
  });

  it('password recovery sends nothing but the address', async () => {
    const fetchMock = stubFetch({ status: 'accepted' });
    await requestPasswordReset('me@example.com');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/password-reset/request');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'me@example.com' });
  });
});

function renderSecurity(user) {
  const t = LifeMakeT('ru');
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale: 'ru', t }}>
      <AuthContext.Provider value={{ phase: 'authenticated', user }}>
        <SecuritySection t={t} />
      </AuthContext.Provider>
    </LifeLocaleContext.Provider>,
  );
}

describe('Settings → security', () => {
  const base = { id: 'u1', email: 'me@example.com', created_at: 'x' };

  it('shows the invitation manager only to the owner', () => {
    expect(renderSecurity({ ...base, role: 'owner', email_verified_at: null })).toContain(LifeStrings.ru.sec_invite_head);
    expect(renderSecurity({ ...base, role: 'member', email_verified_at: null })).not.toContain(LifeStrings.ru.sec_invite_head);
  });

  it('states verification honestly', () => {
    expect(renderSecurity({ ...base, role: 'member', email_verified_at: null })).toContain(LifeStrings.ru.sec_not_verified);
    const verified = renderSecurity({ ...base, role: 'member', email_verified_at: '2026-10-01T10:00:00Z' });
    expect(verified).toContain(LifeStrings.ru.sec_verified);
    expect(verified).not.toContain(LifeStrings.ru.sec_verify_send);
  });

  it('never claims delivery before the server answers', () => {
    const html = renderSecurity({ ...base, role: 'owner', email_verified_at: null });
    expect(html).not.toContain('отправлено на');
    expect(html).not.toContain('пароль изменён');
  });
});

describe('RU / UK copy', () => {
  it('covers every new security key in both languages', () => {
    const keys = Object.keys(LifeStrings.ru).filter(key => /^(sec_|forgot_|reset_|verify_|invite_|recovery_|logout_pending_|auth_switched_|auth_notice_|set_legacy_)/.test(key));
    expect(keys.length).toBeGreaterThan(100);
    for (const key of keys) expect(LifeStrings.uk[key], key).toBeTruthy();
  });
});
