// Real-API Tasks flows after the compact JENKIN pass.
import { authContext, getState, gotoApp, launch } from './lib.mjs';
import { seed } from './seed.mjs';

const results = {};
const ok = (name, value, detail) => { results[name] = value ? 'PASS' : `FAIL ${detail === undefined ? '' : JSON.stringify(detail)}`; };
const seeded = await seed();
const browser = await launch();
const context = await authContext(browser, { width: 1440, height: 900 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const find = (list, id) => list.find(t => String(t.id) === String(id));
const server = async (predicate, timeout = 8000) => {
  const start = Date.now();
  for (;;) {
    const payload = (await getState(context)).payload;
    if (predicate(payload) || Date.now() - start > timeout) return payload;
    await page.waitForTimeout(150);
  }
};
const count = async value => {
  const text = await page.$eval(`.tasks-filter-select option[value="${value}"]`, o => o.textContent);
  return Number(text.split('·').pop().trim());
};

await gotoApp(page, '#/tasks');
await page.waitForSelector('.tasks-filter-select');

// 1 · detail edit: move the «tomorrow» task to today at 07:45 → same id, Today count +1
const todayBefore = await count('today');
await page.locator('.task-title-btn', { hasText: 'QA завтра: тренировка' }).click();
await page.waitForSelector('.td-modal, [role="dialog"]');
await page.fill('.td-schedule input[type="date"]', seeded.today);
await page.fill('.td-schedule input[type="time"]', '07:45');
await page.locator('.qa-foot .qa-btn-ghost').click();
let payload = await server(p => find(p.tasks, 9005)?.schedule?.time === '07:45');
ok('detail save moves the SAME task (id kept, one copy)', find(payload.tasks, 9005)?.schedule?.date === seeded.today && payload.tasks.filter(t => String(t.id) === '9005').length === 1, find(payload.tasks, 9005));
await page.waitForTimeout(200);
ok('the Today count follows (+1)', (await count('today')) === todayBefore + 1, [todayBefore, await count('today')]);
ok('the row now says «сегодня · 07:45»', await page.locator('.task-due.is-today', { hasText: 'сегодня · 07:45' }).count() === 1);

// 2 · completion toggle updates the counts truthfully
const doneBefore = await count('done');
const overdueBefore = await count('overdue');
await page.locator('.task-row', { hasText: 'QA просроченная: сдать отчёт по кварталу' }).locator('.task-check').click();
payload = await server(p => find(p.tasks, 9001)?.done === true);
ok('toggle persists completion', find(payload.tasks, 9001)?.done === true && !!find(payload.tasks, 9001)?.completed_at);
await page.waitForTimeout(150);
ok('done +1 and overdue -1 in the dropdown', (await count('done')) === doneBefore + 1 && (await count('overdue')) === overdueBefore - 1, [doneBefore, await count('done'), overdueBefore, await count('overdue')]);
const pressed = await page.locator('.task-row', { hasText: 'QA просроченная: сдать отчёт по кварталу' }).locator('.task-check').getAttribute('aria-pressed');
ok('the toggle exposes its pressed state', pressed === 'true', pressed);

// 3 · Waiting view: received → closed list → restore (G1 lifecycle intact)
await page.selectOption('.tasks-filter-select', 'waiting');
await page.waitForSelector('.waiting-list');
const activeBefore = await page.locator('.waiting-list:not(.is-closed) .waiting-row').count();
await page.locator('.waiting-open', { hasText: 'QA ответ от бухгалтера' }).click();
await page.waitForSelector('.wt-modal');
await page.locator('.wt-outcome-row .cal-act').first().click();
payload = await server(p => (p.waitingItems.find(w => w.id === 'waiting-qa-1') || {}).resolution === 'received');
ok('Waiting received is persisted with resolved_at', !!(payload.waitingItems.find(w => w.id === 'waiting-qa-1') || {}).resolved_at);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
ok('active Waiting count drops by one', await page.locator('.waiting-list:not(.is-closed) .waiting-row').count() === activeBefore - 1);
ok('the dropdown counts active Waiting records', (await count('waiting')) === activeBefore - 1, await count('waiting'));
await page.locator('.wt-closed-toggle').click();
await page.locator('.waiting-row.is-closed', { hasText: 'QA ответ от бухгалтера' }).locator('.wt-restore').click();
payload = await server(p => (p.waitingItems.find(w => w.id === 'waiting-qa-1') || {}).resolution == null);
ok('restore returns the SAME Waiting record to active', payload.waitingItems.filter(w => w.id === 'waiting-qa-1').length === 1 && !(payload.waitingItems.find(w => w.id === 'waiting-qa-1') || {}).resolved_at);

// 4 · sort stays separate and keyboard-closable
await page.selectOption('.tasks-filter-select', 'all');
await page.locator('.tasks-sort-trigger').click();
await page.locator('.tasks-sort-opt').first().focus();
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
ok('Escape closes the sort list and focuses its trigger', await page.locator('.tasks-sort-pop').count() === 0
  && (await page.evaluate(() => document.activeElement && document.activeElement.className)).includes('tasks-sort-trigger'));

console.log(JSON.stringify({ today: seeded.today, results, errors }, null, 1));
await browser.close();
