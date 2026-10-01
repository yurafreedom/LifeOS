// Editor concurrency in the real app (production preview + lifeos_test API).
// External update = another session writes the task through the production
// state API (PUT /api/v1/state with the current revision); this tab adopts it
// through the production LifeDataContext.reloadServerState() — the function
// the Settings «reload from server» control calls. The control itself is not
// reachable while the editor dialog is open, so the harness invokes the same
// function through the React tree (the only harness-driven step).
// node concurrency-check.mjs [font=current|dejavu]
import { authContext, getState, gotoApp, launch, putState } from './lib.mjs';
import { seed } from './seed.mjs';

const [font = 'current'] = process.argv.slice(2);
const results = {};
const ok = (name, value, detail) => { results[name] = value ? 'PASS' : `FAIL ${detail === undefined ? '' : JSON.stringify(detail)}`; };
const seeded = await seed();
const today = seeded.today;
const browser = await launch();
const context = await authContext(browser, { width: 1440, height: 900, font });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

const ID = 9003; // «QA сегодня: забрать посылку…», today 10:30
const find = (tasks, id) => tasks.find(t => String(t.id) === String(id));
async function external(mutate) {
  const env = await getState(context);
  const tasks = env.payload.tasks.map(t => (String(t.id) === String(ID) ? mutate({ ...t }) : t));
  return putState(context, { ...env.payload, tasks }, env.revision);
}
async function serverTask(predicate = () => true, timeout = 8000) {
  const start = Date.now();
  for (;;) {
    const t = find((await getState(context)).payload.tasks, ID);
    if (predicate(t) || Date.now() - start > timeout) return t;
    await page.waitForTimeout(150);
  }
}
/* the production reload path, reached through the React tree */
async function reloadFromServer() {
  await page.evaluate(async () => {
    const host = document.querySelector('#root');
    const key = Object.keys(host).find(k => k.startsWith('__reactContainer$'));
    let found = null;
    const stack = [host[key]];
    while (stack.length && !found) {
      const fiber = stack.pop();
      if (!fiber) continue;
      const value = fiber.memoizedProps && fiber.memoizedProps.value;
      if (value && typeof value.reloadServerState === 'function' && value.state) found = value;
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    if (!found) throw new Error('LifeDataContext value not found');
    await found.reloadServerState();
  });
  await page.waitForTimeout(400);
}
const field = selector => page.locator(`.cal-editor ${selector}`);
async function openEditor() {
  await page.evaluate(d => { location.hash = `#/calendar/${d}`; }, today);
  await page.waitForSelector(`.cal-task[data-task-id="${ID}"]`);
  await page.locator(`.cal-task[data-task-id="${ID}"] .cal-act`).filter({ hasText: /изменить|змінити/ }).click();
  await page.waitForSelector('.cal-editor');
  await page.waitForTimeout(150);
}

await gotoApp(page, `#/calendar/${today}`);
await page.waitForSelector('.cal-stage[data-level="day"]');

// A · external change to an UNTOUCHED field survives my save
await openEditor();
await field('textarea.qa-notes-input').fill('моя заметка из черновика');
await external(t => ({ ...t, title: 'QA внешнее: новое название' }));
await reloadFromServer();
ok('A · the editor stays open after the reload', await page.locator('.cal-editor').count() === 1);
ok('A · the untouched title follows the external value in the form', (await field('input.cal-input').first().inputValue()) === 'QA внешнее: новое название', await field('input.cal-input').first().inputValue());
ok('A · my notes draft is kept', (await field('textarea.qa-notes-input').inputValue()) === 'моя заметка из черновика');
await field('.qa-btn-save').click();
let saved = await serverTask(t => t && t.notes === 'моя заметка из черновика');
ok('A · save stores my notes', saved && saved.notes === 'моя заметка из черновика', saved && saved.notes);
ok('A · the external title survives the save', saved && saved.title === 'QA внешнее: новое название', saved && saved.title);
ok('A · the untouched date/time also survive', saved && saved.schedule && saved.schedule.date === today && saved.schedule.time === '10:30', saved && saved.schedule);
ok('A · the editor closed after the save', await page.locator('.cal-editor').count() === 0);

// B · same-field conflict → «взять сохранённое»
await openEditor();
await field('input.cal-input').first().fill('QA моё название B');
await external(t => ({ ...t, title: 'QA внешнее B' }));
await reloadFromServer();
ok('B · my edited title is kept in the form after the reload', (await field('input.cal-input').first().inputValue()) === 'QA моё название B');
await field('.qa-btn-save').click();
await page.waitForTimeout(250);
const notice = page.locator('.cal-editor .edit-conflict[role="alert"]');
ok('B · the conflict notice appears', await notice.count() === 1);
const noticeText = await notice.textContent().catch(() => '');
ok('B · the notice names the saved value', noticeText.includes('QA внешнее B'), noticeText);
saved = await serverTask();
ok('B · nothing was saved while the notice is shown', saved.title === 'QA внешнее B', saved.title);
ok('B · the draft is still in the form', (await field('input.cal-input').first().inputValue()) === 'QA моё название B');
await notice.locator('button').filter({ hasText: /взять сохранённое|взяти збережене/ }).click();
await page.waitForTimeout(200);
ok('B · «take saved» fills the saved value and keeps the editor open', (await field('input.cal-input').first().inputValue()) === 'QA внешнее B' && await page.locator('.cal-editor').count() === 1);
ok('B · the notice is gone', await page.locator('.cal-editor .edit-conflict').count() === 0);
await field('.qa-btn-ghost').filter({ hasText: /отмена|скасувати/ }).first().click();
await page.waitForTimeout(200);

// C · same-field conflict → «оставить моё»
await openEditor();
await field('input.cal-input').first().fill('QA моё название C');
await external(t => ({ ...t, title: 'QA внешнее C' }));
await reloadFromServer();
await field('.qa-btn-save').click();
await page.waitForTimeout(250);
ok('C · the conflict notice appears again', await notice.count() === 1);
await notice.locator('button').filter({ hasText: /оставить моё|залишити моє/ }).click();
saved = await serverTask(t => t && t.title === 'QA моё название C');
ok('C · «keep mine» saves my value over the external one', saved && saved.title === 'QA моё название C', saved && saved.title);
ok('C · same task id, one copy', (await getState(context)).payload.tasks.filter(t => String(t.id) === String(ID)).length === 1);
ok('C · the editor closed after the explicit save', await page.locator('.cal-editor').count() === 0);

// D · schedule (date/time as one unit): external time change + my date edit → conflict
await openEditor();
const [ty, tm, td] = today.split('-').map(Number);
const tomorrow = new Date(Date.UTC(ty, tm - 1, td + 1)).toISOString().slice(0, 10);
await field('input[type="date"]').fill(tomorrow);
await external(t => ({ ...t, schedule: { ...t.schedule, time: '11:45' }, due: '11:45' }));
await reloadFromServer();
await field('.qa-btn-save').click();
await page.waitForTimeout(250);
ok('D · a schedule edit over a changed schedule reports a conflict', await notice.count() === 1, await notice.textContent().catch(() => ''));
ok('D · the task did not move', (await serverTask()).schedule.date === today);
await notice.locator('button').filter({ hasText: /взять сохранённое|взяти збережене/ }).click();
await page.waitForTimeout(150);
ok('D · take saved restores date + time as one unit', (await field('input[type="date"]').inputValue()) === today && (await field('input[type="time"]').inputValue()) === '11:45');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
ok('D · Escape closes only the editor (still on the day)', await page.locator('.cal-editor').count() === 0 && (await page.evaluate(() => location.hash)) === `#/calendar/${today}`);

// E · Tasks detail editor: external change to an untouched field survives
const ID2 = 9005; // «QA завтра: тренировка»
async function external2(mutate) {
  const env = await getState(context);
  const tasks = env.payload.tasks.map(t => (String(t.id) === String(ID2) ? mutate({ ...t }) : t));
  return putState(context, { ...env.payload, tasks }, env.revision);
}
const serverTask2 = async (predicate = () => true, timeout = 8000) => {
  const start = Date.now();
  for (;;) {
    const t = find((await getState(context)).payload.tasks, ID2);
    if (predicate(t) || Date.now() - start > timeout) return t;
    await page.waitForTimeout(150);
  }
};
await page.evaluate(() => { location.hash = '#/tasks'; });
await page.waitForSelector('.tasks-filter-select');
await page.locator('.tasks-page .task-title-btn', { hasText: 'QA завтра: тренировка' }).click();
await page.waitForSelector('.td-title');
await page.locator('textarea.qa-notes-input').fill('заметка E из черновика');
await external2(t => ({ ...t, title: 'QA внешнее E' }));
await reloadFromServer();
ok('E · Tasks detail: the untouched title follows the external value', (await page.locator('.td-title').inputValue()) === 'QA внешнее E', await page.locator('.td-title').inputValue());
await page.locator('.qa-foot .qa-btn-ghost').click();
let saved2 = await serverTask2(t => t && t.notes === 'заметка E из черновика');
ok('E · Tasks detail: save keeps the external title and stores my notes', saved2 && saved2.title === 'QA внешнее E' && saved2.notes === 'заметка E из черновика', saved2 && [saved2.title, saved2.notes]);
// F · Tasks detail: same-field conflict → «keep mine»
await page.waitForTimeout(300);
if (await page.locator('.td-title').count() === 0) {
  await page.locator('.tasks-page .task-title-btn', { hasText: 'QA внешнее E' }).click();
  await page.waitForSelector('.td-title');
}
await page.locator('.td-title').fill('QA моё F');
await external2(t => ({ ...t, title: 'QA внешнее F' }));
await reloadFromServer();
await page.locator('.qa-foot .qa-btn-ghost').click();
await page.waitForTimeout(250);
const notice2 = page.locator('.edit-conflict[role="alert"]');
ok('F · Tasks detail: the conflict notice appears and names the saved value', await notice2.count() === 1 && ((await notice2.textContent()) || '').includes('QA внешнее F'), await notice2.textContent().catch(() => ''));
ok('F · Tasks detail: nothing saved while the notice is shown', (await serverTask2()).title === 'QA внешнее F');
await notice2.locator('button').filter({ hasText: /оставить моё|залишити моє/ }).click();
saved2 = await serverTask2(t => t && t.title === 'QA моё F');
ok('F · Tasks detail: «keep mine» saves my title', saved2 && saved2.title === 'QA моё F', saved2 && saved2.title);

ok('no page errors', errors.length === 0, errors);
console.log(JSON.stringify({ font, today, results }, null, 1));
await browser.close();
