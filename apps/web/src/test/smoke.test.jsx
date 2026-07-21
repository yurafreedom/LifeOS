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

  it('renders the provider-backed home route', async () => {
    installBrowserStubs();
    const { default: App } = await import('../App.jsx');
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('class="app"');
    expect(html).toContain('class="home-hero"');
  });
});
