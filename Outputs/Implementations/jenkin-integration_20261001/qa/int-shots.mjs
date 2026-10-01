// Representative screenshots of the integrated app (production preview + lifeos_test).
// <nn>-<view>-<layout?>-<width>-<theme>-<locale>-<font>.jpg
import { mkdirSync } from 'node:fs';
import { authContext, gotoApp, launch, ORIGIN, routeFonts } from './lib.mjs';
import { seed } from './seed.mjs';

const OUT = '/home/user/LifeOS/Outputs/Implementations/jenkin-integration_20261001/screenshots';
mkdirSync(OUT, { recursive: true });
const seeded = await seed();
const today = seeded.today;
const SHOTS = [
  // name, hash, width, theme, scene, locale, layout, font, extra
  ['01-calendar-days-B-1440-dark-ru-dejavu', `#/calendar/${today.slice(0, 7)}`, 1440, 'dark', null, 'ru', 'B', 'dejavu'],
  ['02-calendar-days-B-1440-dark-ru-current', `#/calendar/${today.slice(0, 7)}`, 1440, 'dark', null, 'ru', 'B', 'current'],
  ['03-calendar-days-A-1440-light-uk-dejavu', `#/calendar/${today.slice(0, 7)}`, 1440, 'light', null, 'uk', 'A', 'dejavu'],
  ['04-calendar-years-1024-paradise-day-uk-dejavu', '#/calendar/years', 1024, 'paradise', 'day', 'uk', 'B', 'dejavu'],
  ['05-calendar-months-768-paradise-night-ru-current', '#/calendar/2026', 768, 'paradise', 'night', 'ru', 'B', 'current'],
  ['06-calendar-day-details-1440-paradise-day-uk-dejavu', `#/calendar/${today}`, 1440, 'paradise', 'day', 'uk', 'B', 'dejavu'],
  ['07-calendar-editor-1440-dark-ru-dejavu', `#/calendar/${today}`, 1440, 'dark', null, 'ru', 'B', 'dejavu', 'editor'],
  ['08-calendar-history-1024-light-ru-dejavu', '#/calendar/history', 1024, 'light', null, 'ru', 'B', 'dejavu'],
  ['09-calendar-days-A-390-dark-uk-dejavu', `#/calendar/${today.slice(0, 7)}`, 390, 'dark', null, 'uk', 'A', 'dejavu', 'full'],
  ['10-calendar-days-B-320-paradise-day-ru-current', `#/calendar/${today.slice(0, 7)}`, 320, 'paradise', 'day', 'ru', 'B', 'current'],
  ['11-tasks-1440-dark-uk-dejavu', '#/tasks', 1440, 'dark', null, 'uk', null, 'dejavu'],
  ['12-tasks-390-light-ru-current', '#/tasks', 390, 'light', null, 'ru', null, 'current'],
  ['13-settings-appearance-1440-paradise-night-uk-dejavu', '#/settings', 1440, 'paradise', 'night', 'uk', null, 'dejavu', 'appearance'],
  ['14-settings-appearance-1024-light-ru-current', '#/settings', 1024, 'light', null, 'ru', null, 'current', 'appearance'],
  ['15-sidebar-collapsed-1440-light-ru-dejavu', `#/calendar/${today.slice(0, 7)}`, 1440, 'light', null, 'ru', 'B', 'dejavu', 'collapsed'],
  ['16-focus-search-1440-paradise-day-ru-current', '#/tasks', 1440, 'paradise', 'day', 'ru', null, 'current', 'focus-search'],
  ['17-focus-task-title-1440-dark-uk-dejavu', '#/tasks', 1440, 'dark', null, 'uk', null, 'dejavu', 'focus-title'],
];

const browser = await launch();
for (const [name, hash, width, theme, scene, locale, layout, font, extra] of SHOTS) {
  const context = await authContext(browser, { width, height: 900, theme, scene, layout, font });
  const page = await context.newPage();
  await gotoApp(page, hash, { locale });
  await page.mouse.move(1, 1);
  if (extra === 'appearance') { await page.locator('.set-nav-btn').nth(5).click(); await page.waitForSelector('.set-font-preview'); }
  if (extra === 'collapsed') { await page.locator('.sb-toggle').click(); }
  await page.waitForTimeout(900);
  await page.evaluate(() => document.fonts.ready);
  /* the hero / scene images must be decoded before the capture */
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  if (extra === 'editor') {
    await page.locator('.cal-task', { hasText: 'Ёлка' }).locator('.cal-act').filter({ hasText: /изменить|змінити/ }).click();
    await page.waitForSelector('.cal-editor');
  }
  if (extra === 'focus-search') {
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    for (let i = 0; i < 60; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement.matches('.tb-cmd-input'))) break; }
  }
  if (extra === 'focus-title') {
    await page.locator('.tasks-page .task-title-btn', { hasText: 'Ёлка' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('.qa-title');
    for (let i = 0; i < 20; i++) { if (await page.evaluate(() => document.activeElement.matches('.qa-title'))) break; await page.keyboard.press('Tab'); }
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 78, fullPage: extra === 'full' });
  if (extra === 'collapsed') await page.locator('.sb-toggle').click(); // restore the device preference
  console.log(name);
  await context.close();
}
/* logged-out login cards: RU Current (dark) and RU DejaVu (paradise-night) */
for (const [name, theme, scene, font] of [['18-login-1024-dark-ru-current', 'dark', null, 'current'], ['19-login-390-paradise-night-ru-dejavu', 'paradise', 'night', 'dejavu']]) {
  const context = await browser.newContext({ viewport: { width: name.includes('390') ? 390 : 1024, height: 800 } });
  await routeFonts(context);
  await context.addInitScript(([t, s, f]) => {
    localStorage.setItem('lifeOsTheme', t); if (s) localStorage.setItem('lifeOsScene', s);
    if (f === 'dejavu') localStorage.setItem('lifeOsFont', 'dejavu');
  }, [theme, scene, font]);
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/`);
  await page.waitForSelector('.auth-card');
  await page.keyboard.press('Tab'); // keyboard focus on the email field
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 78 });
  console.log(name);
  await context.close();
}
await browser.close();
