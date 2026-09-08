import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LIFE_ROUTES } from '../app/routes.js';

function installBrowserStubs() {
  const classList = { add() {}, remove() {} };

  globalThis.localStorage = {
    getItem() { return null; },
    removeItem() {},
    setItem() {},
  };
  globalThis.window = {
    addEventListener() {},
    confirm() { return true; },
    location: { hash: '#/home', search: '' },
    matchMedia() {
      return {
        addEventListener() {},
        addListener() {},
        matches: false,
        removeEventListener() {},
        removeListener() {},
      };
    },
    removeEventListener() {},
  };
  globalThis.document = {
    addEventListener() {},
    documentElement: {
      classList,
      getAttribute() { return null; },
      offsetHeight: 0,
      removeAttribute() {},
      setAttribute() {},
    },
    removeEventListener() {},
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
}

describe('Life OS production module graph', () => {
  it('keeps the complete route registry', () => {
    expect(LIFE_ROUTES.size).toBe(15);
    expect(LIFE_ROUTES.has('home')).toBe(true);
    expect(LIFE_ROUTES.has('settings')).toBe(true);
  });

  it('keeps private routes behind the auth boot gate', async () => {
    installBrowserStubs();
    const { default: App } = await import('../App.jsx');
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('auth-screen');
    expect(html).not.toContain('class="app"');
  });

  it('renders the provider-backed home route after hydration', async () => {
    installBrowserStubs();
    const [{ AppShell }, { LifeDataContext, buildInitialState }, { LifeLocaleContext, LifeMakeT }] = await Promise.all([
      import('../App.jsx'),
      import('../context/LifeDataContext.jsx'),
      import('../context/LocaleContext.jsx'),
    ]);
    const noop = () => {};
    const data = {
      state: buildInitialState(),
      syncPhase: 'saved',
      addTask: noop, updateTask: noop, deleteTask: noop, toggleTask: noop,
      addQuickNote: noop, deleteQuickNote: noop, updateProfile: noop, updateDog: noop,
    };
    const locale = {
      locale: 'ru', setLocale: noop, t: LifeMakeT('ru'),
      themeMode: 'dark', themeEff: 'dark', setTheme: noop,
      scenePref: 'auto', setScenePref: noop,
    };
    const html = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={locale}>
        <LifeDataContext.Provider value={data}>
          <AppShell user={{ id: 'u1', email: 'owner@example.test', created_at: 'now' }} />
        </LifeDataContext.Provider>
      </LifeLocaleContext.Provider>,
    );

    expect(html).toContain('class="app"');
    expect(html).toContain('class="home-hero"');
  });
});
