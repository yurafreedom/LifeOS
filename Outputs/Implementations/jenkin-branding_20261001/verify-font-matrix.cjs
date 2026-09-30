/* JENKIN branding font/layout verification matrix (sandbox tool).
 * usage: node matrix.cjs <baseUrl> <outDir> <seed.json> [mode=mock|real] [filter]
 * mock: API mocked in the browser (auth + state). real: the page talks to the
 * running FastAPI backend through the Vite dev proxy (caller logs in first).
 * Google Fonts requests are fetched with curl (TLS-verified through the
 * sandbox proxy CA) so Current renders real Onest / Work Sans. */
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [BASE, OUT, SEED, MODE = 'mock', FILTER = ''] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

const LONG_EMAIL = 'oleksandra.kovalenko-shevchenko.long-mailbox@example-university.com.ua';
const LONG_TITLE = 'Ёлка і Їжак: перевірити Іі Її Єє Ґґ та Ёё — дуже довга назва завдання, що має переноситися без горизонтального переповнення 0123456789 Надзвичайнодовгенеперервнеслово';
const kyivToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());

const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
seed.tasks = [{ id: 901, title: LONG_TITLE, done: false, stakes: true, schedule: { date: kyivToday, time: '' } }, ...seed.tasks];

const THEMES = [
  ['dark', { lifeOsTheme: 'dark' }],
  ['light', { lifeOsTheme: 'light' }],
  ['paradise-day', { lifeOsTheme: 'paradise', lifeOsScene: 'day' }],
  ['paradise-night', { lifeOsTheme: 'paradise', lifeOsScene: 'night' }],
];
const WIDTHS = [1440, 1024, 768, 390, 320];
const FONTS = ['current', 'dejavu'];
const LOCALES = ['ru', 'uk'];
const APPEARANCE = { ru: 'оформление', uk: 'оформлення' };

/* representative screenshots: key = `${font}|${locale}|${theme}|${width}|${view}` */
const SHOTS = new Set([
  'dejavu|uk|dark|1440|settings', 'dejavu|uk|light|1440|settings', 'dejavu|uk|paradise-day|1440|settings',
  'dejavu|uk|paradise-night|1440|settings', 'current|ru|dark|1440|settings', 'current|uk|light|1440|settings',
  'dejavu|ru|dark|1440|tasks', 'dejavu|ru|dark|1440|dialog', 'current|ru|dark|1440|tasks',
  'dejavu|uk|light|1024|calendar', 'current|uk|paradise-day|1024|calendar',
  'dejavu|ru|paradise-night|768|tasks', 'dejavu|uk|dark|390|settings', 'dejavu|uk|dark|390|dialog',
  'dejavu|ru|light|320|tasks', 'dejavu|ru|light|320|settings', 'dejavu|uk|paradise-day|320|dialog',
  'dejavu|ru|light|1440|home', 'current|ru|light|1440|home',
  'dejavu|ru|dark|1440|login', 'current|ru|light|320|login', 'dejavu|ru|paradise-night|390|login',
]);

const fontCache = new Map();
async function routeFonts(ctx) {
  await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, async route => {
    const url = route.request().url();
    try {
      if (!fontCache.has(url)) {
        const body = execFileSync('curl', ['-sS', '--fail', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', url], { maxBuffer: 1 << 26 });
        fontCache.set(url, body);
      }
      const type = url.includes('googleapis') ? 'text/css; charset=utf-8' : 'font/woff2';
      await route.fulfill({ status: 200, body: fontCache.get(url), headers: { 'content-type': type, 'access-control-allow-origin': '*' } });
    } catch (e) { await route.abort(); }
  });
}

function mockApi(ctx, authed) {
  let payload = JSON.parse(JSON.stringify(seed)); let revision = 1;
  return ctx.route('**/api/**', route => {
    const u = route.request().url(); const m = route.request().method();
    if (u.includes('/auth/me')) return authed
      ? route.fulfill({ json: { id: 'u1', email: LONG_EMAIL, created_at: '2026-01-01T00:00:00Z' } })
      : route.fulfill({ status: 401, json: { code: 'not_authenticated', message: 'no' } });
    if (u.includes('/state')) {
      if (m !== 'GET') { payload = JSON.parse(route.request().postData()).payload; revision += 1; }
      return route.fulfill({ json: { schema_version: 2, revision, payload, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } });
    }
    return route.fulfill({ status: 404, json: { code: 'not_found', message: 'x' } });
  });
}

/* in-page measurements */
function measure() {
  const vw = window.innerWidth;
  const probe = document.createElement('span');
  probe.style.fontFamily = 'var(--font-mono)'; document.body.appendChild(probe);
  const monoFamily = getComputedStyle(probe).fontFamily; probe.remove();
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') return true; } return false; };
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const label = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const offenders = [];
  const families = {}; let monoCount = 0; const nonDejavu = []; let dotMono = 0; let dotMonoBad = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && !clipped(el) && getComputedStyle(el).position !== 'fixed') offenders.push(label(el) + ` right=${Math.round(r.right)}`);
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const ff = getComputedStyle(el).fontFamily;
    if (el.classList.contains('mono')) { dotMono += 1; if (ff !== monoFamily) dotMonoBad += 1; }
    if (!hasText && !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) continue;
    families[ff] = (families[ff] || 0) + 1;
    if (ff === monoFamily) monoCount += 1;
    else if (!/DejaVu/.test(ff) && !el.closest('.set-font-sample.is-current') && !el.closest('svg')) nonDejavu.push(label(el) + ' :: ' + ff);
  }
  return {
    docOverflow: document.documentElement.scrollWidth - vw,
    offenders: offenders.slice(0, 8), offenderCount: offenders.length,
    families, monoFamily, monoCount, dotMono, dotMonoBad,
    nonDejavu: nonDejavu.slice(0, 8), nonDejavuCount: nonDejavu.length,
    dataFont: document.documentElement.getAttribute('data-font'),
  };
}

async function focusAudit(page, presses = 10) {
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  const missing = []; let checked = 0;
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const snap = () => { const s = getComputedStyle(el); return [s.outlineStyle + s.outlineWidth + s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.color].join('|'); };
      const s = getComputedStyle(el);
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
      const focused = snap(); el.blur(); const idle = snap(); el.focus();
      return { ok: ring || focused !== idle, label: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '') };
    });
    if (!r) continue; checked += 1; if (!r.ok) missing.push(r.label);
  }
  return { checked, missing: [...new Set(missing)] };
}

async function glyphs(page, selectors) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const out = {};
  for (const [name, sel] of Object.entries(selectors)) {
    try {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
      if (!nodeId) { out[name] = 'absent'; continue; }
      const text = (await page.$eval(sel, el => el.value || el.textContent)).slice(0, 60);
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      out[name] = { text, fonts: fonts.map(f => `${f.familyName}${f.isCustomFont ? ' [web]' : ' [system]'} ×${f.glyphCount}`) };
    } catch (e) { out[name] = 'error: ' + e.message.slice(0, 80); }
  }
  await cdp.detach();
  return out;
}

async function settle(page) {
  await page.waitForTimeout(350);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

async function shot(page, key) {
  if (!SHOTS.has(key)) return null;
  const file = path.join(OUT, key.replace(/\|/g, '_') + '.jpg');
  await page.screenshot({ path: file, type: 'jpeg', quality: 78 });
  return path.basename(file);
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const font of FONTS) for (const [theme, themeStorage] of THEMES) for (const width of WIDTHS) {
    const storage = { ...themeStorage, lifeOsSidebar: 'expanded', ...(font === 'dejavu' ? { lifeOsFont: 'dejavu' } : {}) };
    const height = width <= 390 ? 780 : 900;
    /* login (RU only: the login screen has no locale switcher) */
    if (!FILTER || FILTER.split(',').some(f => `${font}|ru|${theme}|${width}`.includes(f))) {
      const ctx = await browser.newContext({ viewport: { width, height } });
      await ctx.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
      await routeFonts(ctx); if (MODE === 'mock') await mockApi(ctx, false);
      const page = await ctx.newPage();
      await page.goto(BASE + '/'); await page.waitForSelector('.auth-card'); await settle(page);
      const key = `${font}|ru|${theme}|${width}|login`;
      results.push({ key, mode: MODE, ...(await page.evaluate(measure)), focus: await focusAudit(page, 6),
        glyphs: await glyphs(page, { heading: '.auth-card h1', eyebrow: '.auth-eyebrow' }), shot: await shot(page, key) });
      await ctx.close();
    }
    for (const locale of LOCALES) {
      if (FILTER && !FILTER.split(',').some(f => `${font}|${locale}|${theme}|${width}`.includes(f))) continue;
      const ctx = await browser.newContext({ viewport: { width, height } });
      await ctx.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
      await routeFonts(ctx); if (MODE === 'mock') await mockApi(ctx, true);
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      if (MODE === 'real') {
        await page.goto(BASE + '/'); await page.waitForSelector('.auth-card');
        await page.locator('input[type="email"]').fill(LONG_EMAIL);
        await page.locator('input[type="password"]').fill(process.env.REAL_PASSWORD);
        await page.locator('.auth-form button[type="submit"]').click();
        await page.waitForSelector('main.main', { timeout: 20000 });
      }
      const base = `${font}|${locale}|${theme}|${width}`;
      await page.goto(BASE + '/#/settings'); await page.waitForSelector('.set-nav');
      if (locale === 'uk') { await page.getByRole('button', { name: APPEARANCE.ru, exact: true }).click(); await page.getByRole('button', { name: 'UK', exact: true }).first().click(); }
      await page.getByRole('button', { name: APPEARANCE[locale], exact: true }).click();
      await page.locator('.set-font-preview').scrollIntoViewIfNeeded(); await settle(page);
      results.push({ key: `${base}|settings`, mode: MODE, ...(await page.evaluate(measure)),
        glyphs: await glyphs(page, { sampleCurrent: '.set-font-sample.is-current .set-font-sample-text', sampleDejavu: '.set-font-sample.is-dejavu .set-font-sample-text', rowLabel: '.set-body .set-row-label, .set-body label, .set-body .set-seg-btn', monoLabel: '.set-font-sample-label.mono' }),
        shot: await shot(page, `${base}|settings`) });

      await page.evaluate(() => { location.hash = '#/home'; }); await page.waitForTimeout(500); await settle(page);
      results.push({ key: `${base}|home`, mode: MODE, ...(await page.evaluate(measure)), focus: await focusAudit(page),
        sidebar: await page.evaluate(() => { const n = document.querySelector('.sb-foot-name'); if (!n || !n.getBoundingClientRect().width) return 'hidden (mobile nav)'; const s = getComputedStyle(n); return { fontSize: s.fontSize, overflow: n.scrollWidth - n.clientWidth, lines: Math.round(n.getBoundingClientRect().height / parseFloat(s.lineHeight)) }; }),
        glyphs: await glyphs(page, { navLabel: '.sb-item .sb-label', email: '.sb-foot-name', mnav: '.mnav-label' }),
        shot: await shot(page, `${base}|home`) });

      await page.evaluate(() => { location.hash = '#/tasks'; }); await page.waitForSelector('.task-title-btn'); await settle(page);
      results.push({ key: `${base}|tasks`, mode: MODE, ...(await page.evaluate(measure)), focus: await focusAudit(page),
        glyphs: await glyphs(page, { longTitle: '.task-title-btn', pageTitle: '.page-title, .ph-title, h1' }),
        shot: await shot(page, `${base}|tasks`) });

      await page.locator('.task-title-btn', { hasText: 'Ёлка' }).first().click();
      await page.waitForSelector('[role="dialog"]'); await settle(page);
      results.push({ key: `${base}|dialog`, mode: MODE, ...(await page.evaluate(measure)), focus: await focusAudit(page, 8),
        glyphs: await glyphs(page, { dialogTitle: '[role="dialog"] textarea, [role="dialog"] input[type="text"], [role="dialog"] .td-title', dialogEyebrow: '[role="dialog"] .mono' }),
        shot: await shot(page, `${base}|dialog`) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);

      await page.evaluate(() => { location.hash = '#/calendar'; }); await page.waitForTimeout(700); await settle(page);
      results.push({ key: `${base}|calendar`, mode: MODE, ...(await page.evaluate(measure)), focus: await focusAudit(page),
        glyphs: await glyphs(page, { calHeading: '.cal-h, .page-title', cube: '.cal-cube-name, .cal-cube-num' }),
        shot: await shot(page, `${base}|calendar`) });
      if (errors.length) results.push({ key: `${base}|errors`, errors });
      await ctx.close();
      process.stdout.write('.');
    }
  }
  fs.writeFileSync(path.join(OUT, `results-${MODE}.json`), JSON.stringify(results, null, 1));
  console.log('\n', results.length, 'views');
  await browser.close();
})();
