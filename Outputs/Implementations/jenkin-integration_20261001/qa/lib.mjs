// JENKIN cloud QA helpers (scratchpad only; not part of the repository).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

export const ORIGIN = 'http://127.0.0.1:4173';
export const SCR = '/tmp/claude-0/-home-user-LifeOS/83220779-9984-57ca-9822-0c2fde4b9e7d/scratchpad';
export const EMAIL = 'owner.long.verification.address+jenkin-qa@subdomain.example-mailbox.com';
export const PASSWORD = 'qa-' + readFileSync(`${SCR}/secrets/db_password`, 'utf8').slice(0, 16);
const BOOTSTRAP = readFileSync(`${SCR}/secrets/bootstrap_token`, 'utf8');

export async function launch() {
  return chromium.launch({ headless: true });
}

const json = { 'Content-Type': 'application/json', Origin: ORIGIN };

/* Real Onest / Work Sans: served from files curl fetched through the
   verified proxy (Chromium here does not trust the proxy CA). */
export async function routeFonts(context) {
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({
    status: 200, contentType: 'text/css', body: readFileSync(`${SCR}/fonts/fonts.css`, 'utf8'),
  }));
  await context.route('https://fonts.gstatic.com/**', route => {
    const name = route.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_');
    try {
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: readFileSync(`${SCR}/fonts/${name}`) });
    } catch {
      return route.fulfill({ status: 404, body: '' });
    }
  });
}

/** Authenticated context: bootstrap the first account, else log in. */
export async function authContext(browser, { width = 1440, height = 900, theme = 'dark', scene = null, reducedMotion = 'no-preference', layout = null, font = process.env.QA_FONT || null } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion, locale: 'ru-RU', timezoneId: 'Europe/Kyiv' });
  let r = await context.request.post(`${ORIGIN}/api/v1/auth/bootstrap`, { headers: json, data: { email: EMAIL, password: PASSWORD, bootstrap_token: BOOTSTRAP } });
  if (r.status() !== 201 && r.status() !== 200) {
    r = await context.request.post(`${ORIGIN}/api/v1/auth/login`, { headers: json, data: { email: EMAIL, password: PASSWORD } });
    if (!r.ok()) throw new Error('login failed ' + r.status() + ' ' + (await r.text()));
  }
  await routeFonts(context);
  await context.addInitScript(([t, s, l, f]) => {
    try {
      if (sessionStorage.getItem('qa-prefs-applied')) return; // only the first document: later changes come from the app
      sessionStorage.setItem('qa-prefs-applied', '1');
      localStorage.setItem('lifeOsTheme', t);
      if (s) localStorage.setItem('lifeOsScene', s); else localStorage.removeItem('lifeOsScene');
      if (l) localStorage.setItem('lifeOsCalendarLayout', l);
      if (f === 'dejavu') localStorage.setItem('lifeOsFont', 'dejavu'); else if (f === 'current') localStorage.removeItem('lifeOsFont');
    } catch (e) { /* ignore */ }
  }, [theme, scene, layout, font]);
  return context;
}

export async function getState(context) {
  const r = await context.request.get(`${ORIGIN}/api/v1/state`, { headers: { Origin: ORIGIN } });
  if (r.status() === 404) return null;
  if (!r.ok()) throw new Error('state ' + r.status());
  return r.json();
}

export async function putState(context, payload, expected) {
  const r = await context.request.put(`${ORIGIN}/api/v1/state`, { headers: json, data: { expected_revision: expected, schema_version: 2, payload } });
  if (!r.ok()) throw new Error('put ' + r.status() + ' ' + (await r.text()));
  return r.json();
}

/** Load the app once so it initializes the snapshot itself. */
export async function ensureInitialized(context) {
  let env = await getState(context);
  if (env) return env;
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/#/home`);
  await page.waitForSelector('.sb, .mnav', { timeout: 20000 });
  for (let i = 0; i < 40 && !env; i++) {
    await page.waitForTimeout(250);
    env = await getState(context);
  }
  await page.close();
  if (!env) throw new Error('state never initialized');
  return env;
}

export async function gotoApp(page, hash, { locale = 'ru' } = {}) {
  await page.goto(`${ORIGIN}/${hash}`);
  await page.waitForSelector('.page', { timeout: 20000 });
  if (locale !== 'ru') {
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    /* Settings opens on «аккаунт»; the language switch lives in «оформление» (6th section). */
    const nav = page.locator('.set-nav-btn').nth(5);
    await nav.waitFor({ timeout: 10000 });
    await nav.click();
    const btn = page.locator('.set-seg-btn', { hasText: locale.toUpperCase() }).first();
    await btn.waitFor({ timeout: 10000 });
    await btn.click();
    await page.evaluate(h => { window.location.hash = h; }, hash);
    await page.waitForTimeout(300);
  }
}

export async function overflow(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return { doc: d.scrollWidth - d.clientWidth, body: document.body.scrollWidth - window.innerWidth };
  });
}
