// Kyiv midnight (timer) and tab-resume (focus / visibilitychange) rollover in the real app.
import { authContext, gotoApp, launch } from './lib.mjs';
import { seed } from './seed.mjs';

const results = {};
const ok = (name, value, detail) => { results[name] = value ? 'PASS' : `FAIL ${detail === undefined ? '' : JSON.stringify(detail)}`; };
await seed();

/* A controllable clock: every no-arg Date / Date.now() is shifted by
   window.__qaOffset (ms). Date.UTC / Date.parse / Intl stay real. */
const clockScript = () => {
  const RealDate = Date;
  window.__qaOffset = Number(sessionStorage.getItem('__qaOffset') || 0);
  class QADate extends RealDate {
    constructor(...args) { if (args.length === 0) super(RealDate.now() + window.__qaOffset); else super(...args); }
    static now() { return RealDate.now() + window.__qaOffset; }
  }
  window.Date = QADate;
};

function kyivParts(ms) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return f.format(new Date(ms));
}
/* offset so that "now" is `seconds` before the next Kyiv midnight */
function offsetBeforeMidnight(seconds) {
  const now = Date.now();
  const kyivDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  const [y, m, d] = kyivDate.split('-').map(Number);
  // next Kyiv midnight: try +2h/+3h offsets (EEST/EET)
  for (const off of [3, 2]) {
    const midnight = Date.UTC(y, m - 1, d + 1, 0 - off, 0, 0);
    const label = kyivParts(midnight);
    if (label.endsWith('00:00:00')) return midnight - seconds * 1000 - now;
  }
  throw new Error('no midnight');
}

const browser = await launch();

// A · midnight via the timer, with an explicit day route and an open editor draft
{
  const context = await authContext(browser, { width: 1440, height: 900 });
  const offset = offsetBeforeMidnight(6);
  await context.addInitScript(o => sessionStorage.setItem('__qaOffset', String(o)), offset);
  await context.addInitScript(clockScript);
  const page = await context.newPage();
  const dayBefore = kyivParts(Date.now() + offset).slice(0, 10);
  await gotoApp(page, `#/calendar/${dayBefore}`);
  await page.waitForSelector('.cal-task');
  const hasOverdueBefore = await page.locator('.cal-day-tasks .cal-overdue').count();
  const row = page.locator('.cal-task').first();
  const taskId = await row.getAttribute('data-task-id');
  await row.locator('.cal-act', { hasText: 'изменить' }).click();
  await page.waitForSelector('.cal-editor');
  await page.fill('.cal-editor textarea', 'черновик до полуночи');
  await page.waitForTimeout(7500); // the timer fires ~250 ms after Kyiv midnight
  const hash = await page.evaluate(() => location.hash);
  ok('A · explicit day route survives midnight', hash === `#/calendar/${dayBefore}`, hash);
  ok('A · editor still open with the draft', await page.locator('.cal-editor').count() === 1
    && (await page.$eval('.cal-editor textarea', el => el.value)) === 'черновик до полуночи');
  ok('A · the day was not overdue before midnight', hasOverdueBefore === 0, hasOverdueBefore);
  ok('A · after midnight its active rows are overdue with «закрыть без выполнения»',
    await page.locator(`.cal-task[data-task-id="${taskId}"] .cal-overdue`).count() === 1
    && await page.locator(`.cal-task[data-task-id="${taskId}"] .cal-act`, { hasText: 'закрыть без выполнения' }).count() === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  ok('A · Escape then closes only the editor', await page.locator('.cal-editor').count() === 0 && (await page.evaluate(() => location.hash)) === `#/calendar/${dayBefore}`);
  await page.locator('.cal-seg-btn', { hasText: 'сегодня' }).click();
  await page.waitForTimeout(150);
  const todayTile = await page.$eval('[data-today="1"][data-date]', el => el.dataset.date).catch(() => null);
  const dayAfter = kyivParts(Date.now() + offset + 8000).slice(0, 10);
  ok('A · Today now opens the new Kyiv day', todayTile === dayAfter, { todayTile, dayAfter });
  await context.close();
}

// B · resume after a long sleep: focus / visibilitychange re-read the day
{
  const context = await authContext(browser, { width: 1440, height: 900 });
  await context.addInitScript(() => sessionStorage.setItem('__qaOffset', '0'));
  await context.addInitScript(clockScript);
  const page = await context.newPage();
  await gotoApp(page, '#/calendar');
  await page.waitForSelector('[data-today="1"][data-date]');
  const before = await page.$eval('[data-today="1"][data-date]', el => el.dataset.date);
  await page.evaluate(() => { window.__qaOffset = 24 * 3600 * 1000; });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(200);
  const after = await page.$eval('[data-today="1"][data-date]', el => el.dataset.date).catch(() => null);
  ok('B · visibilitychange moves today to the next day', after && after > before, { before, after });
  await page.evaluate(() => { window.__qaOffset = 2 * 24 * 3600 * 1000; });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(200);
  const after2 = await page.$eval('[data-today="1"][data-date]', el => el.dataset.date).catch(() => null);
  ok('B · focus moves today again', after2 && after2 > after, { after, after2 });
  ok('B · the undated #/calendar keeps meaning the current month', (await page.evaluate(() => location.hash)) === '#/calendar');
  await context.close();
}

console.log(JSON.stringify(results, null, 1));
await browser.close();
