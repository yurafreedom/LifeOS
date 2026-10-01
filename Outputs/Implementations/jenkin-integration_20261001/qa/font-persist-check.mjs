// Font preference persistence and switching back, favicon links/requests, the
// logo under both fonts, and the UK login screen (reached by switching the
// in-app locale to UK and logging out — the locale lives above the auth gate).
import { authContext, gotoApp, launch, ORIGIN } from './lib.mjs';

const results = {};
const ok = (name, value, detail) => { results[name] = value ? 'PASS' : `FAIL ${detail === undefined ? '' : JSON.stringify(detail)}`; };
const browser = await launch();

for (const [theme, scene] of [['dark', null], ['paradise', 'day']]) {
  const tag = scene ? `${theme}-${scene}` : theme;
  const context = await authContext(browser, { width: 1440, height: 900, theme, scene, font: 'current' });
  const page = await context.newPage();
  const iconRequests = [];
  page.on('request', r => { if (/favicon|apple-touch-icon/.test(r.url()) && !r.url().includes('qa=1')) iconRequests.push(r.url().replace(ORIGIN, '')); });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await gotoApp(page, '#/tasks');
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForSelector('.set-wrap');
  const state = () => page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-font'),
    stored: localStorage.getItem('lifeOsFont'),
    pressed: [...document.querySelectorAll('.set-seg[role="group"]')].filter(g => /DejaVu Sans/.test(g.textContent)).flatMap(g => [...g.querySelectorAll('button')].map(b => b.getAttribute('aria-pressed'))),
    wordmark: (() => { const w = document.querySelector('.sb-logo .jenkin-wordmark'); const r = w.getBoundingClientRect(); return `${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10} ${getComputedStyle(w).color}`; })(),
    body: getComputedStyle(document.body).fontFamily,
  }));
  await page.locator('.set-nav-btn').nth(5).click();
  await page.waitForSelector('.set-font-preview');
  const initial = await state();
  ok(`${tag} · Current is the default (no attribute, no key, Current pressed)`, initial.attr === null && initial.stored === null && initial.pressed.join() === 'true,false', initial);
  await page.locator('.set-seg-btn', { hasText: 'DejaVu Sans' }).click();
  await page.waitForTimeout(200);
  const chosen = await state();
  ok(`${tag} · choosing DejaVu applies at once and stores lifeOsFont=dejavu`, chosen.attr === 'dejavu' && chosen.stored === 'dejavu' && chosen.pressed.join() === 'false,true' && /DejaVu Sans/.test(chosen.body), chosen);
  ok(`${tag} · the logo does not change with the font`, chosen.wordmark === initial.wordmark, [initial.wordmark, chosen.wordmark]);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const early = await page.evaluate(() => document.documentElement.getAttribute('data-font'));
  ok(`${tag} · after reload the attribute is set by index.html before the app mounts`, early === 'dejavu', early);
  await page.waitForSelector('.set-wrap'); // the Settings route (it has no .page element)
  await page.locator('.set-nav-btn').nth(5).click();
  await page.waitForSelector('.set-font-preview');
  const persisted = await state();
  ok(`${tag} · the preference persists across reload`, persisted.attr === 'dejavu' && persisted.pressed.join() === 'false,true', persisted);
  await page.locator('.set-seg-btn').filter({ hasText: /^(текущий|поточний)$/ }).click();
  await page.waitForTimeout(200);
  const back = await state();
  ok(`${tag} · switching back to Current removes the attribute and the key`, back.attr === null && back.stored === null && back.pressed.join() === 'true,false' && /Work Sans/.test(back.body), back);
  await page.reload();
  await page.waitForSelector('.set-wrap');
  ok(`${tag} · Current survives reload`, (await page.evaluate(() => document.documentElement.getAttribute('data-font'))) === null);
  /* favicon links resolve with the right types */
  const icons = await page.evaluate(async () => Promise.all([...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map(async l => {
    /* headless Chromium refuses an in-page fetch of the exact URL /assets/favicon.ico
       (the favicon slot); a query string reaches the same file on the server */
    const r = await fetch(l.href + (l.href.includes('?') ? '&' : '?') + 'qa=1');
    const b = new Uint8Array(await r.arrayBuffer());
    return { rel: l.rel, href: l.getAttribute('href'), sizes: l.getAttribute('sizes'), status: r.status, type: r.headers.get('content-type'), bytes: b.length };
  })));
  ok(`${tag} · favicon links: ICO 32, SVG, apple-touch 180 all served`, icons.length === 3 && icons.every(i => i.status === 200 && i.bytes > 0)
    && icons.some(i => i.href === '/assets/favicon.ico') && icons.some(i => i.href === '/assets/favicon.svg' && /svg/.test(i.type)) && icons.some(i => i.href === '/assets/apple-touch-icon.png' && /png/.test(i.type)), icons);
  results[`${tag} · icon requests made by Chromium on load`] = iconRequests.length ? `INFO ${[...new Set(iconRequests)].join(', ')}` : 'INFO none (headless Chromium does not fetch favicons)';
  ok(`${tag} · no page errors`, errors.length === 0, errors);
  await context.close();
}

/* UK login: switch the in-app locale to UK, then log out (Settings → account) */
{
  const context = await authContext(browser, { width: 1024, height: 900, theme: 'light', font: 'dejavu' });
  const page = await context.newPage();
  await gotoApp(page, '#/settings', { locale: 'uk' });
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.locator('.set-nav-btn').first().click();
  await page.locator('.set-btn-ghost').filter({ hasText: /вийти|выйти/ }).click();
  await page.waitForSelector('.auth-card h1');
  const login = await page.evaluate(() => ({ h1: document.querySelector('.auth-card h1').textContent, brand: document.querySelector('.auth-brand').getAttribute('aria-label'), wordmark: !!document.querySelector('.auth-brand svg.jenkin-wordmark'), attr: document.documentElement.getAttribute('data-font') }));
  ok('UK login after logout renders in Ukrainian with the Editorial wordmark', /[іїєґ]/i.test(login.h1) && login.brand === 'JENKIN' && login.wordmark && login.attr === 'dejavu', login);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-LifeOS/83220779-9984-57ca-9822-0c2fde4b9e7d/scratchpad/shots/int-login-uk.jpg', type: 'jpeg', quality: 80 });
  await context.close();
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
