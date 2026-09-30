import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EDITORIAL_GLYPHS, JenkinMark, JenkinWordmark } from '../components/JenkinBrand.jsx';
import { Sidebar } from '../components/Sidebar.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';

/* JENKIN branding: approved 01 Editorial logo and serif J favicon. */

const read = relative => readFileSync(new URL(relative, import.meta.url));
const text = relative => read(relative).toString('utf8');
const REF = '../../../../design-references/jenkin-branding/';

function withLocale(locale, node, extra = {}) {
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), themeEff: 'dark', ...extra }}>{node}</LifeLocaleContext.Provider>,
  );
}

describe('Editorial logo', () => {
  it('uses the exact outlined geometry of the approved Editorial SVG', () => {
    const svg = text(`${REF}logo/01-editorial-currentcolor.svg`);
    const reference = [...svg.matchAll(/<path transform="translate\(([\d.]+) 0\)" d="([^"]+)"\/>/g)]
      .map(m => [Number(m[1]), m[2]]);
    expect(reference).toHaveLength(6);
    expect(EDITORIAL_GLYPHS).toEqual(reference);
    expect(svg).toContain('translate(63.747 134.391) scale(0.163090 -0.163090)');
    expect(text('../components/JenkinBrand.jsx')).toContain("'translate(63.747 134.391) scale(0.163090 -0.163090)'");
  });

  it('renders decorative currentColor marks with no text or font dependency', () => {
    for (const html of [renderToStaticMarkup(<JenkinWordmark />), renderToStaticMarkup(<JenkinMark />)]) {
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('focusable="false"');
      expect(html).toContain('fill="currentColor"');
      expect(html).not.toMatch(/<text|font-family/);
    }
    const mark = renderToStaticMarkup(<JenkinMark />);
    expect(mark).toContain(`d="${EDITORIAL_GLYPHS[0][1]}"`);
    expect(mark).toContain('class="jenkin-mark-point"');
  });

  it.each([false, true])('sidebar home button keeps its name and shows the Editorial mark (collapsed=%s)', collapsed => {
    const html = withLocale('ru', (
      <Sidebar route="home" onNav={vi.fn()} collapsed={collapsed} setCollapsed={vi.fn()} user={{ email: 'a@b.c' }} />
    ));
    expect(html).toMatch(/<button class="sb-logo" aria-label="JENKIN"/);
    expect(html).toContain(collapsed ? '<svg class="jenkin-mark"' : '<svg class="jenkin-wordmark"');
    expect(html).not.toContain('sb-logo-dot');
    expect(html).not.toContain('<tspan');
  });

  it('login shows the wordmark with an accessible name', () => {
    const login = text('../pages/LoginPage.jsx');
    expect(login).toContain('<div className="auth-brand" role="img" aria-label="JENKIN"><JenkinWordmark /></div>');
  });

  it('inks the marks with the approved light/dark variants per theme', () => {
    const css = text('../brand.css');
    expect(text(`${REF}logo/01-editorial-light.svg`)).toContain('color="#F6EFE4"');
    expect(text(`${REF}logo/01-editorial-dark.svg`)).toContain('color="#252A2B"');
    expect(css).toMatch(/:root, \[data-theme="dark"\], \[data-theme="paradise"\]\[data-scene="night"\] \{\s*--jenkin-ink: #F6EFE4;/);
    expect(css).toMatch(/\[data-theme="light"\], \[data-theme="paradise"\]\[data-scene="day"\] \{\s*--jenkin-ink: #252A2B;/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.sb-logo:focus-visible');
    expect(text('../main.jsx')).toMatch(/import '\.\/styles\.css';\nimport '\.\/brand\.css';/);
  });
});

describe('Favicon', () => {
  it('links the adapted J icon in SVG, ICO and apple-touch forms', () => {
    const index = text('../../index.html');
    expect(index).toContain('<link rel="icon" href="/assets/favicon.ico" sizes="32x32" />');
    expect(index).toContain('<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />');
    expect(index).toContain('<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />');
  });

  it('is built from the approved serif J and amber point', () => {
    const svg = text('../../public/assets/favicon.svg');
    expect(svg).toContain(`d="${EDITORIAL_GLYPHS[0][1]}"`);
    expect(svg).toContain('fill="#171B1D"');
    expect(svg).toContain('fill="#E9AC62"');
    const ico = read('../../public/assets/favicon.ico');
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    expect(ico.readUInt16LE(4)).toBe(3); /* 16, 32, 48 */
    const png = read('../../public/assets/apple-touch-icon.png');
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
  });
});
