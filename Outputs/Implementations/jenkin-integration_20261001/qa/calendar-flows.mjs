// Real-API persistence flows for the nested Calendar (production preview + lifeos_test).
import { authContext, getState, gotoApp, launch } from './lib.mjs';
import { seed } from './seed.mjs';

const results = {};
const ok = (name, value, detail) => { results[name] = value ? 'PASS' : `FAIL ${detail === undefined ? '' : JSON.stringify(detail)}`; };
const seeded = await seed();
const today = seeded.today;

const browser = await launch();
const context = await authContext(browser, { width: 1440, height: 900 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const hash = () => page.evaluate(() => location.hash);
/* Poll the SERVER snapshot until the predicate holds (debounced sync ≈ 0.5 s). */
const serverTasks = async (predicate = () => true, timeout = 8000) => {
  const start = Date.now();
  for (;;) {
    const tasks = (await getState(context)).payload.tasks;
    if (predicate(tasks) || Date.now() - start > timeout) return tasks;
    await page.waitForTimeout(150);
  }
};
const find = (tasks, id) => tasks.find(t => String(t.id) === String(id));

await gotoApp(page, `#/calendar/${today}`);
await page.waitForSelector('.cal-stage[data-level="day"]');

// 1 · edit title through the nested editor → saved on the server, same id
const row = page.locator('.cal-task[data-task-id="9015"]');
await row.locator('.cal-act', { hasText: 'изменить' }).click();
await page.waitForSelector('.cal-editor');
await page.fill('.cal-editor input.cal-input:not([type])', 'QA сегодня третья (изменена)');
await page.click('.cal-editor .qa-btn-save');
await page.waitForTimeout(150);
let tasks = await serverTasks(ts => find(ts, 9015)?.title === 'QA сегодня третья (изменена)');
ok('editor save persists the title on the same task id', find(tasks, 9015)?.title === 'QA сегодня третья (изменена)' && tasks.filter(t => String(t.id) === '9015').length === 1, find(tasks, 9015));
ok('editor save kept the date/time (untouched fields)', find(tasks, 9015)?.schedule?.date === today && find(tasks, 9015)?.schedule?.time === '18:15', find(tasks, 9015)?.schedule);

// 2 · reorder: move the last row up → explicit order persisted
const order = async () => page.$$eval('.cal-task', rows => rows.map(r => r.dataset.taskId));
const before = await order();
await page.locator(`.cal-task[data-task-id="${before[2]}"] [data-move="up"]`).click();
await page.waitForTimeout(150);
const after = await order();
ok('reorder moves the row up', after[1] === before[2], { before, after });
tasks = await serverTasks(ts => find(ts, before[2]).order === 1);
ok('reorder persists the day order', find(tasks, before[2]).order === 1, find(tasks, before[2]));
const focused = await page.evaluate(() => document.activeElement && document.activeElement.dataset.move);
ok('focus stays on the moved row', focused === 'up' || focused === 'down', focused);

// 3 · complete → History → Restore (same id, active again)
await page.locator('.cal-task[data-task-id="9003"] .task-check').click();
tasks = await serverTasks(ts => find(ts, 9003).done === true);
ok('complete stores done + completed_at', find(tasks, 9003).done === true && !!find(tasks, 9003).completed_at, find(tasks, 9003));
ok('completed task left the day list', await page.locator('.cal-task[data-task-id="9003"]').count() === 0);
await page.locator('.cal-history-btn').click();
await page.waitForSelector('.cal-history');
ok('History button opens the History route', (await hash()) === '#/calendar/history', await hash());
await page.locator('tr[data-task-id="9003"] .cal-act').click();
tasks = await serverTasks(ts => find(ts, 9003).done === false);
ok('Restore returns the SAME task to active', find(tasks, 9003).done === false && !find(tasks, 9003).completed_at && tasks.filter(t => String(t.id) === '9003').length === 1, find(tasks, 9003));

// 4 · archive and close-without-completion (overdue) → History, then restore both
await page.keyboard.press('Escape');
await page.waitForTimeout(120);
ok('Escape leaves History to the selected month', /^#\/calendar\/\d{4}-\d{2}$/.test(await hash()), await hash());
const overdueDay = (await getState(context)).payload.tasks.find(t => String(t.id) === '9001').schedule.date;
await page.evaluate(h => { location.hash = h; }, `#/calendar/${overdueDay}`);
await page.waitForSelector('.cal-task[data-task-id="9001"]');
await page.locator('.cal-task[data-task-id="9001"] .cal-act', { hasText: 'закрыть без выполнения' }).click();
tasks = await serverTasks(ts => find(ts, 9001).closure === 'closed_unresolved');
ok('close without completion stores closed_unresolved', find(tasks, 9001).closure === 'closed_unresolved' && !!find(tasks, 9001).closed_at, find(tasks, 9001));
await page.evaluate(h => { location.hash = h; }, `#/calendar/${today}`);
await page.waitForSelector('.cal-task[data-task-id="9004"]');
await page.locator('.cal-task[data-task-id="9004"] .cal-act', { hasText: 'в архив' }).click();
tasks = await serverTasks(ts => find(ts, 9004).closure === 'archived');
ok('archive stores archived', find(tasks, 9004).closure === 'archived', find(tasks, 9004));
await page.evaluate(() => { location.hash = '#/calendar/history'; });
await page.waitForSelector('tr[data-task-id="9001"]');
ok('History lists both closures', await page.locator('tr[data-task-id="9001"]').count() === 1 && await page.locator('tr[data-task-id="9004"]').count() === 1);
await page.locator('tr[data-task-id="9001"] .cal-act').click();
await page.waitForTimeout(100);
await page.locator('tr[data-task-id="9004"] .cal-act').click();
tasks = await serverTasks(ts => !find(ts, 9001).closure && !find(ts, 9004).closure);
ok('both restored with the same ids', !find(tasks, 9001).closure && !find(tasks, 9004).closure, [find(tasks, 9001), find(tasks, 9004)]);

// 5 · delete asks first, then removes permanently (never in History)
await page.evaluate(h => { location.hash = h; }, `#/calendar/${today}`);
await page.waitForSelector('.cal-task[data-task-id="9015"]');
await page.locator('.cal-task[data-task-id="9015"] [data-delete]').click();
await page.locator('.cal-task[data-task-id="9015"] .is-danger-solid').click();
tasks = await serverTasks(ts => !find(ts, 9015));
ok('confirmed delete removes the task permanently', !find(tasks, 9015));
await page.evaluate(() => { location.hash = '#/calendar/history'; });
await page.waitForSelector('.cal-history, .cal-history-empty');
ok('a deleted task never appears in History', await page.locator('tr[data-task-id="9015"]').count() === 0);

// 6 · add from the day: Quick Add prefilled with that date; Escape closes only Quick Add
await page.evaluate(h => { location.hash = h; }, `#/calendar/${today}`);
await page.waitForSelector('.cal-day-summary .cal-add');
await page.click('.cal-day-summary .cal-add');
await page.waitForSelector('.qa-modal');
const prefilled = await page.$eval('.qa-modal input[type="date"]', el => el.value).catch(() => null);
ok('Quick Add opens prefilled with the day', prefilled === today, prefilled);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
ok('Escape closes Quick Add only (day details stay)', await page.locator('.qa-modal').count() === 0 && (await hash()) === `#/calendar/${today}`, await hash());

// 7 · undated tasks never reach the Calendar
tasks = (await getState(context)).payload.tasks;
const undated = tasks.filter(t => !(t.schedule && t.schedule.date));
await page.evaluate(() => { location.hash = '#/calendar/years'; });
await page.waitForSelector('.cal-grid-years');
const html = await page.content();
ok('undated tasks are not on any tile or list', undated.every(t => !html.includes(t.title || '___')), undated.map(t => t.title));

console.log(JSON.stringify({ today, results, errors }, null, 1));
await browser.close();
