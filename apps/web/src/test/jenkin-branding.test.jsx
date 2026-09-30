import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  FONT_STORAGE_KEY, INTERFACE_FONTS, applyInterfaceFont, normalizeInterfaceFont,
  readInterfaceFont, writeInterfaceFont,
} from '../app/useInterfaceFont.js';
import { EDITORIAL_GLYPHS, JenkinMark, JenkinWordmark } from '../components/JenkinBrand.jsx';
import { AppearanceSection } from '../components/SettingsPage.jsx';
import { Sidebar } from '../components/Sidebar.jsx';
import { LifeLocaleContext, LifeLocales, LifeMakeT } from '../context/LocaleContext.jsx';

/* JENKIN branding: approved 01 Editorial logo, serif J favicon, and the
   optional device-local DejaVu Sans interface font. */

const read = relative => readFileSync(new URL(relative, import.meta.url));
const text = relative => read(relative).toString('utf8');
const REF = '../../../../design-references/jenkin-branding/';

function withLocale(locale, node, extra = {}) {
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), themeEff: 'dark', ...extra }}>{node}</LifeLocaleContext.Provider>,
  );
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: key => { data.delete(key); },
  };
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

describe('Brand control focus', () => {
  /* WCAG 2.x contrast of opaque sRGB colours */
  const contrast = (a, b) => {
    const lum = hex => {
      const [r, g, b2] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
    };
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it('draws the logo focus ring in a colour that holds 3:1 on every sidebar', () => {
    const css = text('../brand.css');
    expect(css).toContain('.sb-logo:focus-visible { outline: 2px solid var(--jenkin-focus); outline-offset: 2px; }');
    expect(css).toMatch(/\[data-theme="paradise"\]\[data-scene="night"\] \{[^}]*--jenkin-focus: #E9AC62;/);
    expect(css).toMatch(/\[data-theme="paradise"\]\[data-scene="day"\] \{[^}]*--jenkin-focus: var\(--o3\);/);
    const tokens = text('../styles/tokens.css');
    const lightO3 = tokens.slice(tokens.indexOf('[data-theme="light"] {')).match(/--o3:\s*(#[0-9A-Fa-f]{6});/)[1];
    expect(text('../styles/paradise.css')).toContain(`--o3: ${lightO3};`); /* paradise-day uses the same dark orange */
    expect(contrast('#E9AC62', '#FFFFFF')).toBeLessThan(3);                /* why the amber is not used on light */
    expect(contrast(lightO3, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    expect(contrast('#E9AC62', '#0E1117')).toBeGreaterThanOrEqual(3);
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

describe('Interface font preference', () => {
  it('validates to Current unless DejaVu Sans is stored', () => {
    expect(INTERFACE_FONTS).toEqual(['current', 'dejavu']);
    expect(FONT_STORAGE_KEY).toBe('lifeOsFont');
    for (const bad of [null, undefined, '', 'Dejavu', 'onest', '{"v":1}', 42]) {
      expect(normalizeInterfaceFont(bad)).toBe('current');
    }
    expect(normalizeInterfaceFont('dejavu')).toBe('dejavu');
    expect(readInterfaceFont(memoryStorage())).toBe('current');
    expect(readInterfaceFont(memoryStorage({ lifeOsFont: 'dejavu' }))).toBe('dejavu');
    expect(readInterfaceFont(memoryStorage({ lifeOsFont: 'serif' }))).toBe('current');
    expect(readInterfaceFont(null)).toBe('current');
    expect(readInterfaceFont({ getItem: () => { throw new Error('blocked'); } })).toBe('current');
  });

  it('stores only the non-default choice and survives storage failures', () => {
    const storage = memoryStorage();
    writeInterfaceFont(storage, 'dejavu');
    expect(storage.data.get('lifeOsFont')).toBe('dejavu');
    writeInterfaceFont(storage, 'current');
    expect(storage.data.has('lifeOsFont')).toBe(false);
    expect(() => writeInterfaceFont({ setItem: () => { throw new Error('quota'); }, removeItem() {} }, 'dejavu')).not.toThrow();
    expect(() => writeInterfaceFont(null, 'dejavu')).not.toThrow();
  });

  it('applies as <html data-font> only for DejaVu Sans', () => {
    const attrs = new Map();
    const root = { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k) };
    applyInterfaceFont(root, 'dejavu');
    expect(attrs.get('data-font')).toBe('dejavu');
    applyInterfaceFont(root, 'current');
    expect(attrs.has('data-font')).toBe(false);
    expect(() => applyInterfaceFont(null, 'dejavu')).not.toThrow();
  });

  it('is applied before first paint by index.html with the same key and value', () => {
    const index = text('../../index.html');
    expect(index).toContain("localStorage.getItem('lifeOsFont') === 'dejavu'");
    expect(index).toContain("document.documentElement.setAttribute('data-font', 'dejavu')");
  });

  it.each(LifeLocales)('Settings → Appearance offers Current and DejaVu Sans, Current by default (%s)', locale => {
    const t = LifeMakeT(locale);
    const html = withLocale(locale, <AppearanceSection t={t} locale={locale} setLocale={vi.fn()} />,
      { themeMode: 'dark', setTheme: vi.fn(), scenePref: 'auto', setScenePref: vi.fn() });
    expect(t('set_font')).not.toBe('set_font');
    expect(html).toContain(`<div class="set-seg" role="group" aria-label="${t('set_font')}">`);
    expect(html).toContain(`<button class="set-seg-btn is-on" aria-pressed="true">${t('set_font_current')}</button>`);
    expect(html).toContain('<button class="set-seg-btn" aria-pressed="false">DejaVu Sans</button>');
  });

  it('keeps the default fonts and overrides every element only under data-font="dejavu"', () => {
    const css = text('../brand.css');
    const faces = [...css.matchAll(/@font-face \{ font-family: "DejaVu Sans"; src: url\("\.\/assets\/fonts\/dejavu-sans\/([\w-]+\.woff)"\) format\("woff"\); font-weight: (\d+); font-style: (\w+); font-display: swap; \}/g)]
      .map(m => [m[1], m[2], m[3]]);
    expect(faces).toEqual([
      ['DejaVuSans.woff', '400', 'normal'],
      ['DejaVuSans-Bold.woff', '700', 'normal'],
      ['DejaVuSans-Oblique.woff', '400', 'italic'],
      ['DejaVuSans-BoldOblique.woff', '700', 'italic'],
    ]);
    expect(text('../styles/tokens.css')).toContain("--font-body:    'Work Sans', system-ui, sans-serif;");
  });

  it('scopes DejaVu through the tokens and per-selector overrides, never a blanket rule', () => {
    const css = text('../brand.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toContain('!important');
    expect(css).not.toMatch(/(^|[\s,])\*(\s|,|\{)/);
    expect(css).not.toMatch(/(^|[\s,}])body[\s,{]/);
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => [m[1].trim(), m[2]]);
    const tokenRule = rules.find(([sel]) => sel === ':root[data-font="dejavu"]');
    expect(tokenRule[1]).toMatch(/--font-display:\s*"DejaVu Sans"/);
    expect(tokenRule[1]).toMatch(/--font-body:\s*"DejaVu Sans"/);
    /* the mono role keeps its face */
    expect(css).not.toMatch(/--font-mono\s*:/);
    expect(rules.find(([sel]) => sel === ':root[data-font="dejavu"] .mono')[1]).toContain('font-family: var(--font-mono)');
    /* every other family declaration is either scoped to data-font or a preview sample */
    for (const [sel, body] of rules) {
      if (!/font-family/.test(body) || sel.startsWith('@font-face')) continue;
      for (const part of sel.split(',')) {
        expect(part.trim()).toMatch(/^:root\[data-font="dejavu"\] |^\.set-font-sample\.is-(current|dejavu) /);
      }
    }
  });

  it('overrides exactly the stylesheet selectors that name Onest or Work Sans directly — no gaps, no dead entries', () => {
    const brand = text('../brand.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const overrides = { display: new Set(), body: new Set() };
    for (const [, sel, body] of brand.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const role = body.includes('var(--font-display)') ? 'display' : body.includes('var(--font-body)') ? 'body' : null;
      if (role) for (const part of sel.split(',')) overrides[role].add(part.trim().replace(/\s+/g, ' '));
    }
    const files = [...readdirSync(new URL('../styles/', import.meta.url)).map(f => `../styles/${f}`), '../analytics.css'];
    const hardcoded = { display: new Set(), body: new Set() };
    for (const file of files) {
      const css = text(file).replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const family = body.match(/font(?:-family)?\s*:[^;]*(Onest|Work Sans)/);
        if (!family) continue;
        const role = family[1] === 'Onest' ? 'display' : 'body';
        for (const part of sel.split(',')) {
          const scoped = `:root[data-font="dejavu"] ${part.trim().replace(/\s+/g, ' ')}`;
          hardcoded[role].add(scoped);
          expect(overrides[role], `${file}: ${part.trim()}`).toContain(scoped);
        }
      }
    }
    /* the reverse direction: an override whose selector no longer names that
       family anywhere (e.g. the retired Calendar cubes) is dead and must go */
    for (const role of ['display', 'body']) {
      for (const scoped of overrides[role]) expect(hardcoded[role], `dead ${role} override: ${scoped}`).toContain(scoped);
    }
    expect(hardcoded.display.size + hardcoded.body.size).toBeGreaterThan(40);
  });

  it('lets the nested Calendar follow the preference through the typography tokens alone', () => {
    const rules = [];
    for (const file of ['../styles/calendar-nav.css', '../styles/finance-calendar.css']) {
      const css = text(file).replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (/\.cal-/.test(sel) && /font(?:-family)?\s*:/.test(body)) rules.push([sel.trim(), body]);
      }
    }
    /* .cal-crumb, .cal-tile, .cal-num, .cal-wrow, .cal-day-title, .cal-day-month, .cal-dialog-h */
    expect(rules.length).toBeGreaterThanOrEqual(7);
    for (const [sel, body] of rules) {
      for (const [, value] of body.matchAll(/font(?:-family)?\s*:([^;]*)/g)) {
        expect(value, sel).not.toMatch(/Onest|Work Sans|DejaVu|serif|system-ui/);
      }
    }
    /* the headings, tiles, week panels, day details, toolbar and editor use the tokens */
    const calendar = text('../styles/finance-calendar.css');
    expect(calendar).toMatch(/\.cal-dialog-h \{\s*font-family: var\(--font-display\);/);
    expect(text('../styles/calendar-nav.css')).toMatch(/\.cal-crumb \{[^}]*font: 700 15px\/1 var\(--font-display\);/);
    for (const file of ['CalendarPage.jsx', 'TileGrids.jsx', 'DayDetails.jsx', 'CalendarHistory.jsx', 'CalendarTaskEditor.jsx']) {
      expect(text(`../pages/calendar/${file}`), file).not.toMatch(/fontFamily|font-family/);
    }
  });

  it.each(LifeLocales)('Appearance previews both faces with localized Cyrillic and numbers (%s)', locale => {
    const t = LifeMakeT(locale);
    const html = withLocale(locale, <AppearanceSection t={t} locale={locale} setLocale={vi.fn()} />,
      { themeMode: 'dark', setTheme: vi.fn(), scenePref: 'auto', setScenePref: vi.fn() });
    expect(html).toContain(t('set_font_preview'));
    for (const face of ['current', 'dejavu']) {
      expect(html).toContain(`<div class="set-font-sample is-${face}">`);
    }
    expect(html.split(`<span class="set-font-sample-text" lang="${locale}">${t('set_font_sample')}</span>`)).toHaveLength(3);
    expect(t('set_font_sample')).toMatch(/0123456789/);
    expect(t('set_font_sample')).toMatch(locale === 'uk' ? /І.*Ї.*Є.*Ґ/ : /Ё/);
  });

  it('ships byte-identical runtime WOFF faces and the license from the approved package', () => {
    for (const file of ['DejaVuSans.woff', 'DejaVuSans-Bold.woff', 'DejaVuSans-Oblique.woff', 'DejaVuSans-BoldOblique.woff', 'LICENSE']) {
      expect(read(`../assets/fonts/dejavu-sans/${file}`).equals(read(`${REF}fonts/${file}`))).toBe(true);
    }
  });
});
