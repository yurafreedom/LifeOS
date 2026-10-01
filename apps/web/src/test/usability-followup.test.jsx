import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE, LOCALE_STORAGE_KEY, applyLocale, normalizeLocale, readLocale, useLocalePreference, writeLocale,
} from '../app/useLocalePreference.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { LifeLocaleContext, LifeLocales, LifeMakeT } from '../context/LocaleContext.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';

/* JENKIN usability follow-up: persisted RU/UK locale (login/setup included),
   the phone sync chip that may not cover content, and the 12 px Home hints. */

const text = relative => readFileSync(new URL(relative, import.meta.url)).toString('utf8');
const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: key => { data.delete(key); },
  };
}

const saved = {};
function installBrowser({ stored = {}, search = '' } = {}) {
  for (const key of ['localStorage', 'window', 'document']) saved[key] = globalThis[key];
  const attrs = new Map([['lang', 'ru']]);
  const listeners = [];
  globalThis.localStorage = memoryStorage(stored);
  globalThis.window = {
    addEventListener: (type) => listeners.push(type),
    removeEventListener() {},
    location: { hash: '#/home', search },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  };
  globalThis.document = {
    addEventListener() {}, removeEventListener() {},
    documentElement: {
      classList: { add() {}, remove() {} }, offsetHeight: 0,
      getAttribute: k => (attrs.has(k) ? attrs.get(k) : null),
      setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k),
    },
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  return { attrs, listeners };
}

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

/* The same wiring as App(): the stored preference feeds LifeLocaleContext. */
function LocaleRoot({ children }) {
  const [locale, setLocale] = useLocalePreference();
  const value = React.useMemo(() => ({ locale, setLocale, t: LifeMakeT(locale) }), [locale]);
  return <LifeLocaleContext.Provider value={value}>{children}</LifeLocaleContext.Provider>;
}

const anonymous = { phase: 'anonymous', user: null, error: null, notice: null };
function renderLogin() {
  return renderToStaticMarkup(
    <LocaleRoot><AuthContext.Provider value={anonymous}><LoginPage /></AuthContext.Provider></LocaleRoot>,
  );
}

describe('Locale preference', () => {
  it('accepts only the enabled locales and falls back to RU', () => {
    expect(LOCALE_STORAGE_KEY).toBe('lifeOsLocale');
    expect(DEFAULT_LOCALE).toBe('ru');
    expect(LifeLocales).toEqual(['ru', 'uk']);
    for (const bad of [null, undefined, '', 'en', 'UK', 'ua', 'uk-UA', ' uk', '"uk"', '{"locale":"uk"}', 42, {}]) {
      expect(normalizeLocale(bad)).toBe('ru');
    }
    expect(normalizeLocale('uk')).toBe('uk');
    expect(normalizeLocale('ru')).toBe('ru');
  });

  it('reads the stored value and survives missing or blocked storage', () => {
    expect(readLocale(memoryStorage())).toBe('ru');
    expect(readLocale(memoryStorage({ lifeOsLocale: 'uk' }))).toBe('uk');
    expect(readLocale(memoryStorage({ lifeOsLocale: 'en' }))).toBe('ru');
    expect(readLocale(null)).toBe('ru');
    expect(readLocale({ getItem: () => { throw new Error('blocked'); } })).toBe('ru');
  });

  it('writes a validated value and never throws on storage failure', () => {
    const storage = memoryStorage();
    writeLocale(storage, 'uk');
    expect(storage.data.get('lifeOsLocale')).toBe('uk');
    writeLocale(storage, 'ru');
    expect(storage.data.get('lifeOsLocale')).toBe('ru');
    writeLocale(storage, 'en');
    expect(storage.data.get('lifeOsLocale')).toBe('ru');
    expect(() => writeLocale({ setItem: () => { throw new Error('quota'); } }, 'uk')).not.toThrow();
    expect(() => writeLocale(null, 'uk')).not.toThrow();
  });

  it('applies the locale as <html lang>', () => {
    const attrs = new Map();
    const root = { setAttribute: (k, v) => attrs.set(k, v) };
    applyLocale(root, 'uk');
    expect(attrs.get('lang')).toBe('uk');
    applyLocale(root, 'xx');
    expect(attrs.get('lang')).toBe('ru');
    expect(() => applyLocale(null, 'uk')).not.toThrow();
  });

  it('is applied before first paint by index.html with the same key and validation', () => {
    const index = text('../../index.html');
    expect(index).toContain("localStorage.getItem('lifeOsLocale')");
    expect(index).toContain("if (locale === 'ru' || locale === 'uk') document.documentElement.setAttribute('lang', locale);");
  });

  it('starts App in the stored locale (boot screen) and ignores an invalid value', async () => {
    const { default: App } = await import('../App.jsx');
    installBrowser({ stored: { lifeOsLocale: 'uk' } });
    expect(renderToStaticMarkup(<App />)).toContain(LifeMakeT('uk')('boot_loading'));
    installBrowser({ stored: { lifeOsLocale: 'en' } });
    expect(renderToStaticMarkup(<App />)).toContain(LifeMakeT('ru')('boot_loading'));
    expect(LifeMakeT('uk')('boot_loading')).not.toBe(LifeMakeT('ru')('boot_loading'));
  });

  it.each(LifeLocales)('renders the login page in the stored locale (%s)', locale => {
    installBrowser({ stored: { lifeOsLocale: locale } });
    const t = LifeMakeT(locale);
    const html = renderLogin();
    expect(html).toContain(t('auth_login_title'));
    expect(html).toContain(t('auth_email'));
    expect(html).not.toContain(t('auth_setup_title'));
  });

  it.each(LifeLocales)('renders the first-account setup page in the stored locale (%s)', locale => {
    installBrowser({ stored: { lifeOsLocale: locale }, search: '?bootstrap=1' });
    const t = LifeMakeT(locale);
    const other = LifeMakeT(locale === 'ru' ? 'uk' : 'ru');
    const html = renderLogin();
    expect(html).toContain(t('auth_setup_title'));
    expect(html).toContain(t('auth_password_confirm'));
    expect(t('auth_setup_title')).not.toBe(other('auth_setup_title'));
    expect(html).not.toContain(other('auth_setup_title'));
  });

  it('does not follow other tabs live: no storage listener is registered', () => {
    const { listeners } = installBrowser({ stored: { lifeOsLocale: 'uk' } });
    renderLogin();
    expect(listeners).not.toContain('storage');
    const source = stripComments(text('../app/useLocalePreference.js'));
    expect(source).not.toMatch(/addEventListener\(\s*['"]storage/);
  });

  it('App reads the preference instead of a hard-coded RU state', () => {
    const app = text('../App.jsx');
    expect(app).toContain('const [locale, setLocale] = useLocalePreference();');
    expect(app).not.toMatch(/useStateApp\('ru'\)/);
  });
});

describe('Global sync chip', () => {
  const css = stripComments(text('../styles/paradise.css'));
  const atMost = width => css.slice(css.lastIndexOf(`@media (max-width: ${width}px) {`)).split(/\n}\n/)[0];
  const problem = '.global-sync:has(.sync-offline, .sync-error, .sync-conflict)';

  it('is never a fixed layer over content', () => {
    expect(css).not.toMatch(/\.global-sync[^{]*\{[^}]*position: fixed/);
  });

  it('keeps the approved top-right spot on wide screens but scrolls away with the top bar', () => {
    expect(css).toContain('.global-sync { position: absolute; top: 10px; right: 14px; z-index: 30; }');
  });

  it('takes its own row under the top bar below 1024 px', () => {
    expect(atMost(1023)).toMatch(/\.global-sync \{\s*position: static; display: flex; justify-content: flex-end;/);
  });

  it('shows offline, error and conflict as a sticky full-width band at every width', () => {
    const band = css.slice(css.indexOf(problem + ' {'));
    expect(band).toMatch(/^\.global-sync:has\(\.sync-offline, \.sync-error, \.sync-conflict\) \{\s*position: sticky; top: 0;/);
    expect(band.slice(0, band.indexOf('}'))).toContain('background: var(--nav-bg)');
    expect(band.slice(0, band.indexOf('}'))).toContain('margin: 0 calc(-1 * var(--pad-2xl)) 12px; padding: 8px var(--pad-2xl);');
    expect(atMost(640)).toContain(problem + ' {\n    margin: -4px -16px 12px; padding: 8px 16px;');
    expect(css).toContain('html:has(.global-sync .sync-offline, .global-sync .sync-error, .global-sync .sync-conflict) { scroll-padding-top: 56px; }');
  });

  it('matches the shell breakpoints (sidebar hidden at 640 px) and gutters', () => {
    const responsive = stripComments(text('../styles/responsive.css'));
    expect(responsive).toMatch(/@media \(max-width: 640px\) \{\s*\.app \{ grid-template-columns: 1fr; \}\s*\.sb \{ display: none; \}\s*\.main \{ padding: 16px 16px 96px; \}/);
    expect(stripComments(text('../styles/shell.css'))).toContain('.main { padding: var(--pad-lg) var(--pad-2xl) 40px; width: 100%; }');
  });

  it('stops the saving pulse under reduced motion, like the sidebar dot', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .sync-saving .sync-dot { animation: none; } }');
    expect(stripComments(text('../styles/shell.css'))).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.sb-sync\.is-saving \.sb-sync-dot \{ animation: none; \}/);
  });

  it('keeps the recovery role and actions of the status component', () => {
    const component = text('../components/SyncStatus.jsx');
    expect(component).toContain("const needsRecovery = phase === 'offline' || phase === 'error' || phase === 'conflict';");
    expect(component).toContain("role={needsRecovery ? 'status' : undefined}");
    expect(text('../App.jsx')).toContain('<div className="global-sync"><SyncStatus compact /></div>');
  });
});

describe('Home empty-state hints', () => {
  it('inherit the 12 px --text-sm of .stat-context, mute the colour and wrap instead of truncating', () => {
    const css = stripComments(text('../styles/home.css'));
    expect(css).toMatch(/\.stat-context \{\s*font-size: var\(--text-sm\);/);
    expect(css).toContain('.stat-context.is-empty { color: var(--fg4); white-space: normal; overflow-wrap: anywhere; }');
    expect(css).not.toMatch(/\.stat-context\.is-empty \{[^}]*font-size/);
    expect(text('../styles/tokens.css')).toMatch(/--text-sm:\s+12px;/);
  });
});
