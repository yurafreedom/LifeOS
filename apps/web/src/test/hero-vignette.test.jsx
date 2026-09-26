import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  HERO_DAY_SCENE,
  HERO_NIGHT_SCENE,
  HeroVignette,
  PageHeader,
} from '../components/HeroVignette.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

describe('Hero vignette handoff integration', () => {
  it('renders local decorative scene layers and accessible page copy', () => {
    const html = renderToStaticMarkup(
      <HeroVignette title="собака" subtitle="уход, прогулки и корм" date="среда · 2 июля" />,
    );

    expect(html).toContain('class="hero-scene"');
    expect(html).toContain(`src="${HERO_DAY_SCENE}"`);
    expect(html).toContain(`src="${HERO_NIGHT_SCENE}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<h2 class="hero-head__title">собака</h2>');
    expect(html).toContain('уход, прогулки и корм');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
  });

  it('preserves the compact page header outside the paradise theme', () => {
    const html = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={{ themeEff: 'dark' }}>
        <PageHeader title="задачи" subtitle="3 открыто" />
      </LifeLocaleContext.Provider>,
    );

    expect(html).toContain('class="page-head"');
    expect(html).toContain('class="page-title"');
    expect(html).not.toContain('hero-scene');
    expect(html).not.toContain('/assets/scene/');
  });

  it('selects the production vignette for paradise and keeps optional controls', () => {
    const html = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={{ themeEff: 'paradise' }}>
        <PageHeader title="препараты" aside={<button type="button">список</button>} />
      </LifeLocaleContext.Provider>,
    );

    expect(html).toContain('class="hero-scene"');
    expect(html).toContain('class="hero-head__aside"');
    expect(html).toContain('<button type="button">список</button>');
    expect(html).not.toContain('class="page-head"');
  });

  it('keeps the approved gradient, container breakpoint and motion fallback in production CSS', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

    expect(css).toContain('rgba(6, 10, 16, 0.82) 0%');
    expect(css).toContain('rgba(6, 10, 16, 0.66) 38%');
    expect(css).toContain('@container (min-width: 720px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
